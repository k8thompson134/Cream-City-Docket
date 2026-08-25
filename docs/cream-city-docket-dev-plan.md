# Cream City Docket — Development Plan
*Version 0.9 | Updated August 25, 2026*

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
| Veto alert, hearing alert, substitute amendment alert variants | 2 hrs | ✅ Done | hearing_scheduled, council_vote, mayor_signed, mayor_vetoed triggers live |
| Status-change alerts (e.g. bill moves to full council) | 2 hrs | ✅ Done | Uses last_modified_utc window + AlertLog dedup |

### Production polish

| Task | Effort | Status | Notes |
|---|---|---|---|
| Mobile responsiveness | 2 hrs | ✅ Done | Media queries across all pages, mobile nav |
| SEO: page titles, meta descriptions, Open Graph tags | 1 hr | ✅ Done | usePageTitle hook, meta tags on all routes |
| Error states and empty states across all pages | 1 hr | ✅ Done | |
| Loading states and skeleton screens | 1 hr | ✅ Done | AlderHeroSkeleton + bill feed skeletons |
| Final accessibility pass — keyboard nav, screen reader | 2 hrs | ⬜ Pending | Partial — tooltips, tabs, forms done; full audit not done |
| Performance check — Lighthouse, API response times | 1 hr | ⬜ Pending | |
| Environment variables and secrets on Railway | 30 min | ✅ Done | RESEND_API_KEY, FROM_EMAIL, SITE_URL set |
| README — project overview, setup instructions, architecture | 2 hrs | ✅ Done | Updated May 7 |
| Vercel SPA rewrite rule (404 on refresh) | 30 min | ✅ Done | vercel.json added May 8 |
| Vote history backfill script | 1 hr | ✅ Done | 3,799+ votes loaded May 8 |

### Feed and bill discovery (May 17, 2026)

| Task | Effort | Status | Notes |
|---|---|---|---|
| Text search — debounced 300ms, searches title + summary | 1 hr | ✅ Done | `search` param on `GET /api/bills`, `ilike` filter |
| Urgency sort — "Urgent first" toggle, CASE bucket backend | 1 hr | ✅ Done | Hearing <7d → bucket 0, intro <14d → bucket 1, else 2 |
| Legislative-only default filter with "Show all types" notice | 30 min | ✅ Done | `legislative_only` param; `LEGISLATIVE_TYPES` set in backend |
| Shareable bill URLs — `?bill=123` URL sync | 30 min | ✅ Done | `useSearchParams`; opens detail panel on load |
| Data freshness indicator — "Last synced 23m ago" | 30 min | ✅ Done | `last_synced` from `GET /api/meta`, formatted relative time |
| Default feed filter preference in Settings | 30 min | ✅ Done | `defaultTypeFilter` setting, select dropdown |

### Bill detail panel and full page (May 17, 2026)

| Task | Effort | Status | Notes |
|---|---|---|---|
| Next hearing callout — gold banner with date + urgency | 30 min | ✅ Done | Shows when `agenda_date` is set |
| Dynamic urgency copy — specific dates, full council vs committee | 1 hr | ✅ Done | `urgencyCopy()` helper with days-until and body name logic |
| Plain-English timeline labels | 30 min | ✅ Done | `TIMELINE_LABELS` map + `friendlyAction()` helper |
| Council vote breakdown — yea/nay/other per alder | 1 hr | ✅ Done | `GET /api/bills/:id/votes`, `BillVote[]`, breakdown table |
| Vote value bug fix — "Aye"/"Nay" not "Yea"/"Nay" | 15 min | ✅ Done | `YEA_VALUES`/`NAY_VALUES` sets in frontend and alder page |
| Substitute amendment notice — purple callout, Legistar link | 30 min | ✅ Done | Detects "SUBSTITUTE" in `MatterHistory.action_name` |
| AI confidence indicator | 30 min | ✅ Done | `showConfidenceIndicator` setting wired to detail panel |
| Full bill page at `/bills/:id` | 2 hrs | ✅ Done | Hero, timeline, vote breakdown, sidebar, sponsor links, SEO |

### Alder pages (May 17, 2026)

| Task | Effort | Status | Notes |
|---|---|---|---|
| Vote history click-to-detail — inline panel below card | 1 hr | ✅ Done | `VoteDetailPanel`, dark navy, dismisses on re-click |
| Sponsored bills clickable — inline detail panel | 30 min | ✅ Done | Same pattern as vote history |
| Activity snippet on alder list cards | 30 min | ✅ Done | `recent_bills` (30d) + `recent_votes` (7d) from backend |
| Vote issue breakdown — yea/nay/other per tag on Votes tab | 1 hr | ✅ Done | `VoteIssueBreakdown` component, aggregated per tag |
| Cross-council tag ranks — rank badges on Issue Areas | 1 hr | ✅ Done | Backend GROUP BY all alders; "Most of any alder" / "2nd of 15" |
| District sort fix — string "1, 10, 11" → numerical | 15 min | ✅ Done | SQLAlchemy CASE + `cast(district, Integer)` |

### Subscribe and Settings (May 17, 2026)

| Task | Effort | Status | Notes |
|---|---|---|---|
| Subscribe defaults — Housing/Labor/Food Access pre-selected | 15 min | ✅ Done | `DEFAULT_TAGS` set |
| Deselect all button | 15 min | ✅ Done | Clears tag selection |
| Subscription summary line above submit | 15 min | ✅ Done | Describes selected tags + district |
| Mayor action alerts toggle | 30 min | ✅ Done | `mayor_actions` preference; dispatcher extended |
| Reset confirmation in Settings | 15 min | ✅ Done | `confirmReset` state, yes/cancel inline |

### About / content (May 17, 2026)

| Task | Effort | Status | Notes |
|---|---|---|---|
| Glossary: In Council-Adoption and In Council-Passage | 15 min | ✅ Done | Added to About page glossary |

**Remaining estimated effort: ~4–8 hours**

### Still pending / deferred

| Task | Effort | Status | Notes |
|---|---|---|---|
| Full accessibility audit (WCAG AA — keyboard nav, screen reader) | 2 hrs | ⬜ Pending | Partial done; tooltips, tabs, forms done |
| Lighthouse / performance pass | 1 hr | ⬜ Pending | API response times, bundle size |
| Real-world alert test: subscriber receives matching alert | — | ⬜ Pending | Needs a new bill to be introduced and enriched |
| Update About page trigger story copy | 30 min | ✅ Done May 18 | Added "What triggers an alert" section with 4 specific triggers |
| Terms / committees to alder quick-facts sidebar | 30 min | ✅ Done May 18 | Current term start/expiry + committee list with Chair badge |
| Placeholder avatar for alders without photos | 30 min | ✅ Done | SVG initials avatar fallback (see Alders.css `.alder-card-avatar--initials`) |

### Definition of done

- ✅ A real subscriber receives a real confirmation email
- ⬜ A real subscriber receives a real alert when a new matching bill is introduced *(needs real-world test)*
- ✅ Status-change alerts implemented (hearing scheduled, council vote, mayor signed/vetoed, mayor actions)
- ✅ Unsubscribe and preference management work end-to-end
- ✅ Duplicate alert prevention via AlertLog
- ✅ Mobile layout functional
- ✅ README complete
- ✅ Shareable bill URLs, full bill page, text search, urgency sort
- ✅ Vote history with click-to-detail on alder profiles
- ✅ Cross-council issue area ranks, vote issue breakdown
- ✅ Full accessibility audit (keyboard nav, screen reader) — completed May 18
- ✅ Lighthouse / performance pass — completed May 18

---

## Milestone 5 — AI Enrichment Sprint ✅ Complete
*Completed May 18, 2026.*

| Task | Status | Notes |
|---|---|---|
| AI legislative focus summary on alder profiles | ✅ Done | `scripts/enrich_alders.py` — 16 active alders enriched |
| AI vote pattern summary | ✅ Skipped | Client-side computed sentence is sufficient; no AI version needed |
| Substitute amendment diff | ✅ Done | `run_substitute_enrichment()` in worker; 11 bills backfilled; runs hourly |
| Vote summary sentence on bill detail | ✅ Skipped | `groupVoteSummary()` client-side is good enough |
| Political history tab — election results | ⬜ Deferred | Model + API exist; data not imported. Needs external sourcing (city clerk records). |

---

## Milestone 6 — Incident: Notification Pipeline Outage ✅ Resolved
*Outage window: May 21 – August 25, 2026 (discovered and fixed August 25, 2026, after ~3 months of project inactivity.)*

The poller silently failed on **every single run** starting May 21 — three days after Milestone 5 wrapped up. `_upsert_votes` deduped on `legistar_vote_id`, but the DB's actual unique constraint is `(alder_id, event_item_id)`; when Legistar reissued a vote id for the same alder/item, the insert threw `UniqueViolation` deep inside the poll transaction, rolling back every matter/history/mayor-action update from that cycle. Confirmed via `poll_log`: 503 clean runs, then continuous failures with zero successes for the entire outage window. The dispatcher itself was healthy the whole time — it just never had anything new to check, since nothing new ever landed in the database. Alert volume: 81 alerts sent total, all before May 21; zero since.

While root-causing this live against production (via the Railway CLI — `poll_log`/`alert_log` history, not guesswork from the code), several other latent bugs surfaced, unrelated to the poller but with real user impact:

| Issue | Impact | Status |
|---|---|---|
| Poller vote dedup on wrong key | Silently killed all new data since May 21 | ✅ Fixed |
| `Subscribe.tsx` called a dead `/api/subscribe` endpoint (backend only ever exposed `/api/subscriptions`) | Every signup, preference update, and unsubscribe 404'd | ✅ Fixed |
| Confirmation/alert emails linked to `/manage/{token}`, a route that has never existed | Every "manage preferences" / "unsubscribe" link in every email was dead | ✅ Fixed |
| `dispatcher.py` matched districts as `"District 5"` against the bare `"5"` stored by `SubscriberPreference` | District-only subscriptions have never matched anything, independent of the poller bug | ✅ Fixed |
| `digest_mode` / `priority_tags` / `priority_district` — fully built subscribe-page UI, never wired to the backend at all | Subscribers picking "daily digest" got individual immediate emails instead, contradicting the UI's own copy | ✅ Fixed — dispatcher now queues non-immediate matches into `NotificationQueue`, drained by a new `send_digests()` on a 7am CT daily/weekly cron |
| `notifications/worker.py` — a second, disconnected implementation of the same digest pipeline, never imported anywhere | Dead code, diverging from `dispatcher.py`'s feature set (no `mayor_actions` support) | ✅ Deleted — consolidated into `dispatcher.py` |

**Correction (same day):** an earlier pass of this section flagged the migration history as an unresolved two-head fork with production stamped to an untracked "phantom" revision. That was checked against a stale local git checkout mid-session, not the actual repo — the real history already merges the fork (`d1e2f3g4h5i6`, `down_revision = ('a1b2c3d4e5f6', 'a4e8f2d19c30')`) and continues to a single current head (`g4h5i6j7k8l9`), which production is correctly stamped to. No migration cleanup is actually needed. Verified with the new `docket-health` skill (see below), which parses merge-migration tuples correctly.

---

## Remaining / Future

See `cream-city-docket-roadmap.md` for the fuller forward-looking scope (reliability/ops gaps, architecture debt, feature direction grounded in the manifesto) — the larger items there are also filed on the Lair task board under category "Cream City Docket". This table stays as the short list.

| Item | Notes |
|---|---|
| Real-world alert test | Now actually meaningful to check — pipeline was dark May 21–Aug 25 (see Milestone 6). Watch the next few poll cycles for a real bill triggering a real email end-to-end. |
| Election data for Political History tab | Needs manual sourcing from Milwaukee Elections Commission or city clerk records |
| ~~`sitemap.xml`~~ | ✅ Done Aug 25, 2026 — `GET /sitemap.xml` on the backend (static pages + all public bills + active alders), proxied from `creamcitydocket.com/sitemap.xml` via a Vercel rewrite. Matches the same visibility rules as `GET /api/bills`. |
| Re-run `enrich_alders.py` monthly | Alder legislative focus summaries should refresh as their bill count grows — hasn't run since ~May 18, given the project's dormancy |
| ~~Alembic merge migration~~ | ✅ Not actually needed — see the Milestone 6 correction above. Migration history already merges cleanly; prod is stamped to the correct single head. |
| Verify the poller fix with a real successful poll | `docket-health` still shows the last completed poll as the pre-fix failure (the scheduler's hourly timer restarts on each redeploy, so the first real post-fix run hadn't fired yet as of this writing). Re-run `docket-health` in ~an hour and confirm a ✅ on both poller checks. |
| Add a `docket-health` skill (`.claude/skills/docket-health/`) | ✅ Done Aug 25, 2026 — one-shot report on poller freshness, alert activity, digest queue depth, and migration sanity. Run it any time this project is picked back up after a gap. |

---

## Summary

| Milestone | Focus | Status |
|---|---|---|
| 1 — Data Foundation | Legistar API exploration + poller + database | ✅ Complete |
| 2 — Enrichment Pipeline | Claude Haiku integration + APScheduler | ✅ Complete |
| 3 — Backend API + Frontend | FastAPI + React, all pages, alder pages, deployed | ✅ Complete |
| 4 — Alerts + Polish | Email alerts, manage prefs, production polish, a11y, perf | ✅ Complete |
| 5 — AI Enrichment | Alder focus summaries, substitute diffs | ✅ Complete |
| 6 — Notification Outage | 3-month silent poller failure, root-caused and fixed; digest mode wired end-to-end | ✅ Resolved |
