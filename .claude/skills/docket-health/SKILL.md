---
name: docket-health
description: Check Cream City Docket's notification pipeline health against production — poller freshness/success, alert activity, digest queue depth, migration head sanity. Use when returning to this project after a gap, when notifications seem stuck or absent, or before/after touching poller.py, dispatcher.py, or migrations.
---

# Docket Health Check

This project's core failure mode is silent: a bug in the poller or dispatcher can stop all email notifications for months with no error surfaced anywhere a human would see it (see `docs/cream-city-docket-dev-plan.md`, Milestone 6, for the 3-month incident that motivated this skill). This skill runs the same diagnostic queries used to root-cause that outage, in one pass, against live production data.

## Steps

1. **Link Railway to the right project/service**, if not already linked in this session:
   ```sh
   railway link --project abundant-determination --environment production --service backend
   ```
   (Two Railway projects exist under this account — `abundant-determination` is Cream City Docket. Don't confuse it with the other one.)

2. **Switch the linked service to Postgres** before running the check (needed so `DATABASE_PUBLIC_URL` is injected):
   ```sh
   railway service Postgres
   ```

3. **Run the bundled script.** It needs `sqlalchemy` + `psycopg2` — the backend venv already has both:
   ```sh
   railway run --service Postgres <repo-root>/backend/.venv/bin/python3 <skill-dir>/health_check.py
   ```
   Resolve `<skill-dir>` to this file's own directory and `<repo-root>` to the git repo root — do not guess absolute paths.

4. **Read the output.** Each line is `✅ OK`, `⚠️ WARN`, or `❌ FAIL` for one check: latest poll run, last successful poll (regardless of recent failures), all-time alert count, digest queue depth/age, subscriber counts, and Alembic migration head sanity. The script exits non-zero only on a `FAIL`.

5. **Report a short summary to the user** — don't just dump the raw output. Lead with the overall verdict, then call out any `WARN`/`FAIL` lines specifically (what's wrong, and point at the relevant section of `CLAUDE.md`'s "Known footguns" if it matches one of the documented ones). If everything is `OK`, say so briefly; don't pad it out.

## Notes

- `railway run` executes the script **locally**, not inside the Railway container — it just injects env vars. That's why `DATABASE_PUBLIC_URL` (not the internal `DATABASE_URL`, which only resolves inside Railway's network) is required, and why the script falls back to it automatically.
- The script does not import anything from `app/` or `notifications/` — it's pure SQL plus a regex scan of `backend/migrations/versions/*.py` — so it's immune to local Python version drift (see `CLAUDE.md` for why that's mattered before).
- This is read-only. It never writes to the database.
