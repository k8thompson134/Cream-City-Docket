# Cream City Docket

Milwaukee city government, made understandable.

Cream City Docket monitors Milwaukee Common Council legislation and delivers plain-English summaries and timely email alerts so residents can act before votes happen — not after.

**Live at [creamcitydocket.com](https://creamcitydocket.com)**

---

## Status

**Milestone 3 (Backend API + Frontend)** — In progress. Core browsing and discovery features live and deployed. Email alerts system in development (Milestone 4).

| Milestone | Focus | Status |
|-----------|-------|--------|
| 1 — Data Foundation | Legistar API + PostgreSQL poller | Complete |
| 2 — Enrichment Pipeline | Claude Haiku summaries & issue tags | Complete |
| 3 — Backend API + Frontend | FastAPI + React, live at creamcitydocket.com | In progress |
| 4 — Alerts + Subscriptions | Email alerts and preferences | Next |

---

## What's live right now

- **Bill feed** — Browse all Milwaukee legislation with type, status, and issue area filters
- **Search & filter** — Find bills by keyword, status, type, and issue area
- **Plain-language summaries** — AI-generated summaries at 8th-grade reading level
- **Issue tagging** — 13-category taxonomy (housing, labor, policing, etc.)
- **Timeline view** — Committee votes, council votes, mayoral actions
- **Legistar links** — Direct links to official city records
- **Real-time updates** — Database polls the Legistar API every hour
- **Accessible** — WCAG AA standards (in progress)

---

## What's coming (Milestone 4)

- **Email alerts** — Subscribe by district and issue area
- **Smart notifications** — Alerts before key hearings and votes
- **Preferences** — Manage subscriptions and customize alert rules

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python + FastAPI |
| Database | PostgreSQL |
| Scheduler | APScheduler |
| LLM | Claude Haiku (Anthropic API) |
| Frontend | React + TypeScript + Vite |
| Email | Resend (coming in M4) |
| Hosting | Railway (backend) + Vercel (frontend) |

---

## Project structure

```
.
├── backend/
│   ├── app/                    # FastAPI application
│   │   ├── main.py            # Entry point, CORS setup, lifespan handlers
│   │   ├── api/               # Route handlers
│   │   │   ├── bills.py       # GET /api/bills and /api/bills/:id
│   │   │   └── meta.py        # GET /api/meta (filter options)
│   │   ├── models.py          # SQLAlchemy ORM models (15 tables)
│   │   └── schemas.py         # Pydantic response schemas
│   ├── enrichment/            # Claude Haiku integration
│   │   ├── worker.py          # Fetch text, generate summaries & tags
│   │   └── prompts.py         # 8th-grade summary + issue taxonomy
│   ├── poller/                # Legistar API poller
│   │   ├── fetch.py           # HTTP client with retry logic
│   │   ├── upsert.py          # Matter, Alder, MatterHistory ingestion
│   │   └── models.py          # API response types
│   ├── explore/               # (M1) API reconnaissance scripts
│   ├── migrations/            # Alembic schema migrations
│   ├── scheduler.py           # APScheduler setup (hourly poll + enrich)
│   ├── requirements.txt       # Python dependencies
│   └── alembic.ini            # Migration config
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── BillFeed.tsx   # Paginated bill list with filters
│   │   │   ├── BillDetail.tsx # Full bill view with timeline
│   │   │   └── ...
│   │   ├── hooks/             # Custom React hooks
│   │   ├── api.ts             # API client
│   │   ├── types.ts           # TypeScript interfaces
│   │   └── main.tsx           # Entry point
│   ├── package.json           # Node dependencies
│   ├── vite.config.ts         # Build config
│   └── tsconfig.json
└── docs/
    └── cream-city-docket-dev-plan.md  # Full development roadmap
```

---

## Development

### Prerequisites

- Python 3.11+
- PostgreSQL (or connect to Railway instance)
- Node.js 18+

### Setup

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Add DATABASE_URL, ANTHROPIC_API_KEY
alembic upgrade head
python -m app.main  # Starts FastAPI + scheduler
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev  # Vite dev server on localhost:5173
```

The frontend connects to the live backend API at `creamcitydocket.com/api` by default (configurable in `src/api.ts`).

### Environment variables

Backend requires:
- `DATABASE_URL` — PostgreSQL connection string
- `ANTHROPIC_API_KEY` — Claude API key for enrichment
- `RESEND_API_KEY` — (M4, email alerts)

---

## Key files

- **dev-plan** — Full project roadmap, architecture decisions, and milestone status
- **FINDINGS.md** (backend/explore/) — API reconnaissance results, MatterTypes, MatterStatus values
- **schema diagram** — See Alembic migrations for full data model

---

Built by Kate Thompson — Software Engineering student, Milwaukee School of Engineering.
[Portfolio](https://k8thompson.dev)
