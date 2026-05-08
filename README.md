# Cream City Docket

Milwaukee city government, made understandable.

Cream City Docket tracks Milwaukee Common Council legislation and sends plain-English email alerts so residents can act before a vote happens, not after. Live at [creamcitydocket.com](https://creamcitydocket.com).

---

## What it does

- Polls Milwaukee's public [Legistar API](https://webapi.legistar.com/v1/milwaukee) every hour for new and updated legislation
- Summarizes each bill in plain English using Claude Haiku
- Tags bills by issue area using a 12-category taxonomy
- Sends email alerts to subscribers when matching bills are introduced, scheduled for a hearing, or voted on
- Profiles all 15 Milwaukee alders with sponsored bills, vote history, and issue area breakdowns
- Tracks mayoral actions including signatures, vetoes, and veto overrides
- Inline glossary tooltips explain civic terms throughout the app

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11 + FastAPI |
| Database | PostgreSQL (Railway) |
| Scheduler | APScheduler (hourly poll + enrich + dispatch) |
| LLM | Claude Haiku via Anthropic API |
| Frontend | React + TypeScript + Vite |
| Email | Resend |
| Hosting | Railway (backend + DB), Vercel (frontend) |

---

## Architecture

```
Legistar API (hourly)
    └── Poller — upserts matters, sponsors, history, events, votes
    └── Enrichment worker — Claude Haiku summaries + issue tags
    └── Dispatcher — matches subscribers, sends Resend alerts

FastAPI
    GET  /api/bills          — paginated feed, filterable by type/status/tag/sponsor
    GET  /api/bills/:id      — full detail with timeline and mayor actions
    GET  /api/upcoming       — bills with hearings in the next 14 days
    GET  /api/alders         — all 15 council members
    GET  /api/alders/:id     — profile with sponsored bills and vote history
    GET  /api/meta           — filter dropdown options
    POST /api/subscriptions  — subscribe (sends confirmation email)
    GET  /api/subscriptions/:token   — fetch preferences
    PATCH /api/subscriptions/:token  — update preferences
    DELETE /api/subscriptions/:token — unsubscribe

React frontend (creamcitydocket.com)
    /           — bill feed with filters, upcoming hearings, tooltips
    /alders     — council directory
    /alders/:id — alder profile with tabs
    /subscribe  — subscription form
    /manage/:token — manage preferences / unsubscribe
    /about      — about page + civic glossary
    /settings   — display, AI, and accessibility preferences
```

---

## Local development

### Prerequisites

- Python 3.11+
- Node.js 18+
- A PostgreSQL database (local or Railway)

### Backend setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env   # fill in your values
alembic upgrade head   # apply all migrations
uvicorn app.main:app --reload
```

### Frontend setup

```bash
cd frontend
npm install
npm run dev
```

### Environment variables

**Backend** (`backend/.env`):

```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...
FROM_EMAIL=alerts@creamcitydocket.com
SITE_URL=https://creamcitydocket.com
```

**Frontend** (Vercel environment or `frontend/.env.local`):

```
VITE_API_URL=https://your-backend.railway.app
```

---

## One-time data scripts

Run these after first deploy or when alder data needs refreshing:

```bash
cd backend
python -m scripts.patch_alder_districts   # set correct district numbers
python -m scripts.patch_alder_contacts    # email + phone from city website
python -m scripts.patch_alder_photos      # headshot URLs from city website
```

---

## Deployment

Backend and database are hosted on [Railway](https://railway.app). Frontend is on [Vercel](https://vercel.com).

After deploying a new backend version:

```bash
# Apply any pending database migrations
alembic upgrade head
```

Railway environment variables to set: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `FROM_EMAIL`, `SITE_URL`.

Vercel environment variables to set: `VITE_API_URL`.

---

## Known limitations

- **Legistar deep links don't work.** The Legistar web interface uses a `LegislationID` that isn't exposed by the API. All bill links go to the Legistar search page instead of a direct URL. See `backend/explore/FINDINGS.md` for details.
- **Vote history populates over time.** Vote data is collected from council meeting events as they are polled. Historical votes before the first poll are not backfilled.
- **Alder photos** are sourced from the city website and may become stale when council membership changes.

---

## Built by

Kate Thompson, Software Engineering student at Milwaukee School of Engineering and Milwaukee resident.

[Portfolio](https://k8thompson.dev) · [hello@creamcitydocket.com](mailto:hello@creamcitydocket.com)
