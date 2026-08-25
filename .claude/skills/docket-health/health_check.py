#!/usr/bin/env python3
"""
Cream City Docket — notification pipeline health check.

Checks the same things that took months to notice were broken in the
2026-05-21 to 2026-08-25 outage: poller success/freshness, alert activity,
digest queue depth, and Alembic migration head sanity.

Pure SQL + regex on the migration files — no `app.*` imports — so it runs
under any local Python with sqlalchemy + psycopg2 installed, regardless of
whether the local venv happens to match the backend's pinned version.

Usage (from the repo root, or anywhere — paths are resolved relative to
this file):

    railway link --project abundant-determination --environment production --service backend
    railway service Postgres
    railway run --service Postgres python3 .claude/skills/docket-health/health_check.py

`railway run` executes this script LOCALLY with Railway's env vars
injected. DATABASE_URL points at postgres.railway.internal, which only
resolves inside Railway's network — use DATABASE_PUBLIC_URL instead, which
this script does automatically.
"""
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    from sqlalchemy import create_engine, text
except ImportError:
    sys.exit(
        "sqlalchemy not installed in this Python.\n"
        "Run with the backend venv, e.g.:\n"
        "  railway run --service Postgres backend/.venv/bin/python3 .claude/skills/docket-health/health_check.py"
    )

REPO_ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS_DIR = REPO_ROOT / "backend" / "migrations" / "versions"

OK, WARN, FAIL = "OK", "WARN", "FAIL"
_SEVERITY = {OK: 0, WARN: 1, FAIL: 2}
results = []


def check(label, status, detail):
    results.append((label, status, detail))


def _aware(dt):
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def main():
    url = os.environ.get("DATABASE_PUBLIC_URL") or os.environ.get("DATABASE_URL")
    if not url:
        sys.exit(
            "No DATABASE_URL / DATABASE_PUBLIC_URL in the environment.\n"
            "Run this via `railway run --service Postgres python3 <this file>` "
            "after `railway link` / `railway service Postgres`."
        )

    engine = create_engine(url)
    now = datetime.now(timezone.utc)

    with engine.connect() as conn:
        # --- Poller: most recent run ---
        row = conn.execute(
            text("select polled_at, success, error_message from poll_log order by polled_at desc limit 1")
        ).first()
        if row is None:
            check("Poller (latest run)", FAIL, "No poll_log rows at all — poller may never have run.")
        else:
            polled_at, success, error_message = row
            age = now - _aware(polled_at)
            if not success:
                check(
                    "Poller (latest run)", FAIL,
                    f"Most recent poll ({age} ago) FAILED: {(error_message or '')[:200]}",
                )
            elif age > timedelta(hours=3):
                check("Poller (latest run)", WARN, f"Most recent poll succeeded but was {age} ago (job runs hourly).")
            else:
                check("Poller (latest run)", OK, f"Most recent poll succeeded {age} ago.")

        # --- Poller: last successful run, regardless of recent failures ---
        last_success = conn.execute(
            text("select polled_at from poll_log where success = true order by polled_at desc limit 1")
        ).scalar()
        if last_success is None:
            check("Poller (last success ever)", FAIL, "No poll has ever succeeded.")
        else:
            ls_age = now - _aware(last_success)
            status = WARN if ls_age > timedelta(hours=6) else OK
            check("Poller (last success ever)", status, f"{ls_age} ago ({last_success.isoformat()}).")

        # --- Alerts ---
        alert_count, last_alert = conn.execute(
            text("select count(*), max(sent_at) from alert_log")
        ).first()
        check(
            "Alerts sent (all-time)", OK,
            f"{alert_count} total, most recent {last_alert.isoformat() if last_alert else 'never'}.",
        )

        # --- Digest queue ---
        queued, oldest_queued = conn.execute(
            text("select count(*), min(created_at) from notification_queue")
        ).first()
        if queued:
            q_age = now - _aware(oldest_queued)
            status = WARN if q_age > timedelta(days=8) else OK
            check("Digest queue", status, f"{queued} item(s) queued, oldest is {q_age} old.")
        else:
            check("Digest queue", OK, "Empty.")

        # --- Subscribers ---
        total_subs, active_subs = conn.execute(
            text("select count(*), count(*) filter (where active) from subscribers")
        ).first()
        check("Subscribers", OK, f"{active_subs} active / {total_subs} total.")

        # --- Migrations ---
        try:
            current = conn.execute(text("select version_num from alembic_version")).scalar()
        except Exception:
            current = None

    # revision -> list of down_revisions (merge migrations have more than one,
    # e.g. `down_revision = ('a1b2c3d4e5f6', 'a4e8f2d19c30')`)
    revisions = {}
    if MIGRATIONS_DIR.exists():
        for f in MIGRATIONS_DIR.glob("*.py"):
            src = f.read_text()
            rev_m = re.search(r"^revision:.*=\s*['\"](\w+)['\"]", src, re.M)
            down_line_m = re.search(r"^down_revision:.*$", src, re.M)
            downs = re.findall(r"['\"](\w+)['\"]", down_line_m.group(0)) if down_line_m else []
            if rev_m:
                revisions[rev_m.group(1)] = downs

    down_revisions = {d for downs in revisions.values() for d in downs}
    heads = [r for r in revisions if r not in down_revisions]

    if current is None:
        check("Migrations", WARN, "Could not read alembic_version from the DB.")
    elif current not in revisions:
        check(
            "Migrations", FAIL,
            f"DB is stamped to revision '{current}', which matches no file in migrations/versions/.",
        )
    elif len(heads) > 1:
        check(
            "Migrations", WARN,
            f"{len(heads)} migration heads with no merge migration: {heads}. "
            f"`alembic upgrade head` will fail as-is (DB is currently stamped to '{current}').",
        )
    else:
        check("Migrations", OK, f"Single head, DB stamped to '{current}'.")

    # --- Report ---
    icon = {OK: "✅", WARN: "⚠️ ", FAIL: "❌"}
    print(f"Cream City Docket health check — {now.isoformat()}\n")
    worst = OK
    for label, status, detail in results:
        print(f"{icon[status]} {label}: {detail}")
        if _SEVERITY[status] > _SEVERITY[worst]:
            worst = status
    print(f"\nOverall: {worst}")
    sys.exit(1 if worst == FAIL else 0)


if __name__ == "__main__":
    main()
