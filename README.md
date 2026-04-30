# Cream City Docket

Milwaukee city government, made understandable.

Cream City Docket monitors Milwaukee Common Council legislation and delivers plain-English summaries and timely email alerts so residents can act before votes happen — not after.

---

## Status

🚧 **In active development.** Pre-implementation documentation complete. Build starting with Milestone 1 (data foundation).

---

## What it does

- Monitors new Milwaukee legislation via the public [Legistar Web API](https://webapi.legistar.com/v1/milwaukee)
- Summarizes bills in plain English using Claude Haiku (Anthropic)
- Tags legislation by issue area: housing, labor, policing, food access, immigration, healthcare, and more
- Sends email alerts before hearings, committee votes, and full council votes
- Tracks mayoral actions including signatures, vetoes, and override votes
- Surfaces alder vote history, sponsored legislation, and election history
- Links directly to official city records for every bill

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python + FastAPI |
| Database | PostgreSQL |
| Scheduler | APScheduler |
| LLM | Claude Haiku (Anthropic API) |
| Frontend | React + TypeScript + Vite |
| Email | Resend |
| Hosting | Railway |

---

## Project documentation

Full pre-implementation documentation lives in `/docs`:

- `manifesto.md` — Product thesis and founding memo
- `problem-statement.md` — User personas and user stories
- `requirements.md` — Functional and non-functional requirements, data model, API endpoints
- `dev-plan.md` — Milestone-based development plan with effort estimates
- `architecture/` — C4 container diagram, pipeline sequence diagram, system flowchart
- `wireframes/` — Lo-fi wireframes for all six screens

---

## Development

### Prerequisites

- Python 3.11+
- PostgreSQL
- Node.js 18+

### Setup

```bash
# Clone the repo
git clone https://github.com/yourusername/cream-city-docket.git
cd cream-city-docket

# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # add your API keys

# Run database migrations
alembic upgrade head

# Frontend
cd ../frontend
npm install
npm run dev
```

### Environment variables

```
DATABASE_URL=
ANTHROPIC_API_KEY=
RESEND_API_KEY=
```

---

## Quick API check

Before running anything, verify the Legistar API is reachable and inspect the real data shape:

```python
import httpx, json

r = httpx.get(
    "https://webapi.legistar.com/v1/milwaukee/matters",
    params={"$top": 5, "$orderby": "MatterLastModified desc"}
)
print(json.dumps(r.json(), indent=2))
```

---

## Built by

Kate Thompson — Software Engineering student, Milwaukee School of Engineering.
[Portfolio](https://k8controlpanel.com) · Milwaukee, WI
