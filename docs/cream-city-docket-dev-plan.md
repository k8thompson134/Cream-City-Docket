# Cream City Docket — Development Plan
*Version 0.6 | Updated May 7, 2026*

---

## Overview

This plan sequences the build into four milestones. Each milestone has a clear completion criteria — a "definition of done" that must be met before moving to the next phase. This prevents the common failure mode of building UI before the data layer is proven.

**Guiding principle:** Never build the frontend before the backend has real data to feed it.

**Estimated total effort:** 8–12 weeks of part-time work (10–15 hrs/week)

**Infrastructure as of May 7, 2026:**
- Domain: creamcitydocket.com (Vercel)
- Railway project provisioned, connected to GitHub repo
- Railway PostgreSQL instance live with full schema applied
- Resend email domain verified (creamcitydocket.com, us-east-1)
- Working branch: `main`

---

## Milestone 1 — Data Foundation ✅ COMPLETE
*Completed April 30, 2026.*

All API questions answered, poller live, 271+ matters, 15 alders, 647+ history events in Railway. See original plan for full details.

---

## Milestone 2 — Enrichment Pipeline ✅ COMPLETE
*Completed April 30, 2026.*

Claude Haiku integration, APScheduler, 187 bills enriched. See original plan for full details.

---

## Milestone 3 — Backend API and Full Frontend ✅ COMPLETE
*Deployed April 30, 2026. Alder pages completed May 7, 2026.*

### FastAPI backend

| Task | Status | Notes |
|---|---|---|
| `GET /api/bills` — paginated feed with type/status/tag/sponsor filters | ✅ Done | Added `sponsored_by` filter May 7 |
| `GET /api/bills/:id` — full detail with timeline and mayor actions | ✅ Done | |
| `GET /api/meta` — filter dropdown options including tags | ✅ Done | |
| `POST /api/subscriptions` — create/update subscription | ✅ Done | |
| `GET /api/alders` — list all alders | ✅ Done | Built May 7 |
| `GET /api/alders/:id` — alder profile with sponsored bills, vote history | ✅ Done | Built May 7 |
| `GET /api/mayor` — mayor profile and action history | ⬜ Post-launch | |
| Vote polling — events → event items → votes via Legistar | ✅ Done | Built May 7; data populates as meetings are polled |

### React frontend

| Task | Status | Notes |
|---|---|---|
| React + TypeScript + Vite project setup | ✅ Done | |
| Bill feed with type/status/issue-area/sponsor filters and pagination | ✅ Done | Sponsored By filter added May 7 |
| Plain-language summaries in feed and detail panel | ✅ Done | |
| Issue tag chips on bill rows | ✅ Done | |
| Bill detail panel — timeline, mayor actions, sponsor links, Legistar link | ✅ Done | Sponsor names now link to alder profiles |
| Nav bar with all page links | ✅ Done | Includes Alders |
| About page with glossary sidebar | ✅ Done | |
| Settings page — summaries, compact feed, file numbers, a11y toggles | ✅ Done | |
| Subscribe page — 3-step form wired to `POST /api/subscriptions` | ✅ Done | Pre-selects district when coming from alder profile |
| Alders list page — 15 cards sorted by district, contact info | ✅ Done | Built May 7 |
| Alder profile — hero with photo, tabs (Bills, Votes, Issue Areas) | ✅ Done | Built May 7 |
| Alder photos — all 15 sourced from city.milwaukee.gov | ✅ Done | Built May 7 |
| Issue Areas tab — tag bar chart, links to filtered docket | ✅ Done | Built May 7 |
| Vote History tab — built, populates as meetings are polled | ✅ Done | |
| Brewers navy/gold color scheme | ✅ Done | |
| Deployed to Vercel at creamcitydocket.com | ✅ Done | |
| Mobile responsiveness | ⬜ Pending | |
| WCAG AA accessibility audit | ⬜ Pending | |

### Data scripts (one-time)

| Script | Status |
|---|---|
| `scripts/patch_alder_districts.py` — correct district numbers for all 15 alders | ✅ Done |
| `scripts/patch_alder_contacts.py` — email + phone from city.milwaukee.gov | ✅ Done |
| `scripts/patch_alder_photos.py` — headshot URLs for all 15 alders | ✅ Done |

---

## Milestone 4 — Alerts, Subscriptions, and Polish 🔄 IN PROGRESS

### Subscription system

| Task | Effort | Status | Notes |
|---|---|---|---|
| `POST /api/subscriptions` — create/update subscription | 2 hrs | ✅ Done | |
| Confirmation email via Resend on subscribe | 1 hr | ✅ Done | Built May 7 |
| `GET /api/subscriptions/:token` — fetch preferences | 1 hr | ✅ Done | Built May 7 |
| `PATCH /api/subscriptions/:token` — update preferences | 1 hr | ✅ Done | Built May 7 |
| `DELETE /api/subscriptions/:token` — unsubscribe | 30 min | ✅ Done | Built May 7 |
| Manage preferences page frontend (`/manage/:token`) | 2 hrs | ✅ Done | Built May 7 |

### Notification dispatcher

| Task | Effort | Status | Notes |
|---|---|---|---|
| Dispatcher job: query newly enriched Matters since last dispatch | 2 hrs | ✅ Done | Built May 7; 2-hour rolling window |
| Subscriber matching logic: tags and district against preferences | 2 hrs | ✅ Done | Built May 7 |
| Duplicate alert prevention via alert_log | 1 hr | ✅ Done | Built May 7 |
| Integrate Resend email provider | 1 hr | ✅ Done | Domain verified May 7 |
| Alert email template — responsive HTML + plain text | 2 hrs | ✅ Done | Built May 7 |
| Add dispatcher to APScheduler (runs after each enrich cycle) | 30 min | ✅ Done | Built May 7 |
| End-to-end test: subscribe → confirmation email delivered | 1 hr | ✅ Done | Confirmed working May 7 |
| Veto alert, hearing alert, substitute amendment alert variants | 2 hrs | ⬜ Pending | Currently only "introduced" trigger |
| Status-change alerts (e.g. bill moves to full council) | 2 hrs | ⬜ Pending | Requires tracking previous status |

### Production polish

| Task | Effort | Status | Notes |
|---|---|---|---|
| Mobile responsiveness | 2 hrs | ⬜ Pending | |
| SEO: page titles, meta descriptions, Open Graph tags | 1 hr | ⬜ Pending | |
| Error states and empty states across all pages | 1 hr | ⬜ Pending | |
| Loading states and skeleton screens | 1 hr | ⬜ Pending | |
| Final accessibility pass — keyboard nav, screen reader | 2 hrs | ⬜ Pending | |
| Performance check — Lighthouse, API response times | 1 hr | ⬜ Pending | |
| Environment variables and secrets on Railway | 30 min | ⬜ Pending | Add RESEND_API_KEY, FROM_EMAIL, SITE_URL |
| README — project overview, setup instructions, architecture | 2 hrs | ⬜ Pending | Portfolio artifact |

**Remaining estimated effort: ~15 hours**

### Definition of done

- ✅ A real subscriber receives a real confirmation email
- ⬜ A real subscriber receives a real alert when a new matching bill is introduced
- ⬜ Status-change alerts working (hearing scheduled, full council vote)
- ⬜ Unsubscribe and preference management work end-to-end *(endpoints done, needs QA)*
- ⬜ No duplicate alerts for the same Matter and trigger event *(logic done, needs real-world test)*
- ⬜ Mobile layout functional on 375px viewport
- ⬜ README complete, project presentable as a portfolio piece

---

## Summary

| Milestone | Focus | Status |
|---|---|---|
| 1 — Data Foundation | Legistar API exploration + poller + database | ✅ Complete |
| 2 — Enrichment Pipeline | Claude Haiku integration + APScheduler | ✅ Complete |
| 3 — Backend API + Frontend | FastAPI + React, all pages, alder pages, deployed | ✅ Complete |
| 4 — Alerts + Polish | Email alerts, manage prefs, production polish | 🔄 In progress |
