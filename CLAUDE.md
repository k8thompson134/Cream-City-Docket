# CLAUDE.md

Cream City Docket — a civic-alerts site for Milwaukee Common Council legislation. Tracks bills from Legistar, summarizes them with Claude Haiku, and emails subscribers when something they care about moves.

Read `docs/cream-city-docket-dev-plan.md` first for milestone history and current status — especially the **Milestone 6** section, a full postmortem of a 3-month silent outage in the notification pipeline (2026-05-21 to 2026-08-25). Most of the "known footguns" below trace back to that incident. `docs/cream-city-docket-manifesto.md` and `docs/mkealert-*.md` hold the original problem statement/requirements (the project was originally called "mkealert").

## Architecture

- **Backend** — FastAPI + SQLAlchemy + Alembic, deployed on **Railway** (project `abundant-determination`, service `backend`, plus a `Postgres` service). Root dir for the Railway service is `backend/`.
- **Frontend** — React + TypeScript + Vite, deployed on **Vercel** at `creamcitydocket.com`. No API proxy layer — the frontend calls the Railway backend directly cross-origin (`VITE_API_URL`), except `/sitemap.xml`, which Vercel rewrites straight to the backend (see `frontend/vercel.json`).
- **Both auto-deploy on push to `main`.** There is no staging environment and no CI. Every push goes straight to production — treat pushes accordingly, and prefer verifying against prod data read-only (see Railway CLI recipes below) before pushing anything that touches the notification pipeline.

### The notification pipeline (the part that breaks)

One `BackgroundScheduler` job (`backend/scheduler.py`, `_poll_then_enrich`) runs hourly and chains, in order:

1. **`poller/poll.py` — `run_poll()`.** Pulls new/changed Matters, sponsors, history, mayor actions, and votes from the Legistar API into Postgres. Runs inside one SQLAlchemy transaction — if anything in this function raises, **everything it touched that cycle rolls back**, silently, forever, until the underlying bug is fixed. This is exactly what happened for 3 months (a vote dedup key mismatch — see dev plan Milestone 6).
2. **`enrichment/worker.py` — `run_enrichment()` / `run_substitute_enrichment()`.** Calls Claude Haiku to write plain-language summaries and substitute-amendment diffs for newly-fetched matters.
3. **`notifications/dispatcher.py` — `run_dispatcher()`.** Matches recently-changed matters (2-hour rolling window) against subscriber tag/district/mayor_actions preferences. Sends immediately if `digest_mode == "immediate"` or the match hits a subscriber's `priority_tags`/`priority_district`; otherwise queues into `NotificationQueue` for later.

Separately, two cron jobs (7am **Central** time, matching the copy on the subscribe page) call `notifications/dispatcher.py`'s `send_digests("daily"|"weekly")`, which drains `NotificationQueue` per subscriber through `render_digest_email` and logs to `AlertLog`.

Key tables: `Subscriber` / `SubscriberPreference` (tag/district/mayor_actions opt-ins), `AlertLog` (sent, dedup key), `NotificationQueue` (queued-not-yet-sent), `PollLog` (poll success/failure history — check this first when anything email-related seems off).

`notifications/email.py` wraps the Resend API. `notifications/templates.py` has all the HTML/text email builders.

## Local dev

```sh
cd backend
python3 -m venv .venv          # pinned to 3.13 via backend/.python-version — Railway resolves 3.13 too, keep them matching
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env           # fill in DATABASE_URL, ANTHROPIC_API_KEY, RESEND_API_KEY, FROM_EMAIL, SITE_URL
uvicorn app.main:app --reload
```

```sh
cd frontend
npm install
npm run dev
```

**Don't let the local venv drift from 3.13.** `app/models.py` and friends use `X | None` union syntax, which doesn't parse on 3.9/3.10. This isn't hypothetical — a stale 3.9 venv blocked local smoke-testing entirely during the Milestone 6 investigation and had to be rebuilt mid-session.

## Checking production state (Railway CLI)

No local replica of prod exists — the only way to see real pipeline health is against the live DB. Recipe used throughout the Milestone 6 investigation:

```sh
railway link --project abundant-determination --environment production --service backend
railway logs                                    # app logs
railway logs -f "dispatcher"                    # filter to a substring
railway service Postgres                        # switch the linked service before DB queries
railway run --service Postgres python3 - <<'EOF'
import os
from sqlalchemy import create_engine, text
url = os.environ.get('DATABASE_PUBLIC_URL') or os.environ.get('DATABASE_URL')
eng = create_engine(url)
with eng.connect() as conn:
    print(conn.execute(text("select polled_at, success, error_message from poll_log order by polled_at desc limit 5")).fetchall())
EOF
```

`railway run` executes **locally** with Railway's env vars injected — it needs a local Python with `sqlalchemy`/`psycopg2` installed (the backend `.venv` works), and it resolves `postgres.railway.internal` as unreachable, so use `DATABASE_PUBLIC_URL`, not `DATABASE_URL`, for anything run this way.

For a one-shot health summary instead of hand-writing queries, use the **`docket-health`** skill (`.claude/skills/docket-health/`) — it runs the same checks (poll freshness, alert activity, queue depth, migration head sanity) in one pass.

## Known footguns

- **Migration history briefly forks, then merges — this is fine, don't re-flag it.** `a1b2c3d4e5f6` (photo_url) and `a4e8f2d19c30` (digest/notification_queue) both branch off `97263e2118bf`, but `d1e2f3g4h5i6` merges them (`down_revision = ('a1b2c3d4e5f6', 'a4e8f2d19c30')`), continuing on through `e2f3g4h5i6j7` → `f3g4h5i6j7k8` → `g4h5i6j7k8l9`, a single current head. Production's `alembic_version` is correctly stamped to `g4h5i6j7k8l9`. (An earlier pass of this file wrongly called this an unresolved fork with a "phantom" stamp — that was checked against a stale local checkout mid-session, not the real repo. `docket-health` parses this correctly; trust it over hand-counting.)
- **Swallowed exceptions in the pipeline.** `poller/poll.py`, `notifications/dispatcher.py`, and `enrichment/worker.py` all wrap their top-level run functions in `except Exception: log.exception(...)`. That's appropriate so one bad cycle doesn't crash the scheduler — but it also means a persistent bug (like the May–August outage) produces no user-facing signal at all, just a log line nobody's watching. Run `docket-health` periodically, especially after returning to this project from a gap.
- **`dispatcher.py` and `main.py` must agree on preference value formats.** A past bug stored districts as bare numbers (`"5"`) in `SubscriberPreference` but compared them against `"District 5"` in the dispatcher — silently zero matches, no error. If you touch matching logic on either side, check the other.
- **This project goes dormant for months at a time.** There's no automated staleness alert — if you're picking this back up after a gap, run `docket-health` before assuming anything is working.

## Testing

`backend/tests/test_legistar_links.py` is the only test in the repo, and it only covers Legistar URL construction. Nothing covers the poller, dispatcher matching logic, or the vote-dedup fix from Milestone 6 — which is exactly the code that broke silently for 3 months. If you touch any of `poller/poll.py`, `notifications/dispatcher.py`, or the matching/dedup logic, add a regression test for the specific case you fixed rather than relying on manual smoke-testing against prod.
