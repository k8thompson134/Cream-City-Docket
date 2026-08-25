# Cream City Docket — Roadmap: Reliability, Architecture, Feature Direction
*Written August 25, 2026, immediately after the Milestone 6 outage fix (see `cream-city-docket-dev-plan.md`).*

This is a forward-looking companion to the dev plan, which is a changelog of what's been built. This doc scopes what's next: reliability gaps the outage exposed, architecture debt worth paying down as the codebase grows, and feature direction grounded in `cream-city-docket-manifesto.md`'s stated pain points and long-term vision rather than invented scope.

Larger items (m effort and up) are also filed on the Lair task board under category **Cream City Docket** so they don't just live in a markdown file. IDs are noted next to each.

---

## 1. Reliability / Ops

The whole Milestone 6 incident boils down to one root cause with no containment: a bug that silently rolled back every poll for 3 months, with zero signal reaching anyone until this session went looking. Everything in this section exists to make sure that specific failure mode — *broken for months, nobody notices* — can't happen again.

| Item | Why | Effort | Lair task |
|---|---|---|---|
| **Outage alerting** — a scheduled check that emails/pages the project owner if the poller goes stale (no success in >3h) or fails repeatedly | This is the single highest-value fix here. `docket-health` (built today) proves the check is cheap to run; it just isn't wired to notify anyone automatically yet — it's still a manual "remember to run this" step | m | #421 |
| **Admin/ops status endpoint** — an authenticated route or page surfacing poll_log/alert_log/subscriber health, so pipeline status is checkable from a phone without Railway CLI access | Today the only way to check "is this working" is `railway link` + ad hoc SQL, or the local-only `docket-health` skill. Neither is available from a phone, which matters given how this project actually gets picked back up (in bursts, after gaps) | m | #422 |
| **CI pipeline** — GitHub Actions running the backend test suite + `tsc --noEmit` on every push | There's no staging environment; every push to `main` deploys straight to production, and nothing currently stops a broken commit from doing so | m | #423 |
| **Regression tests for the code that actually broke** — poller vote-dedup, dispatcher tag/district/mayor_actions matching, digest queue drain | Zero test coverage exists on any of this. The one test file in the repo covers Legistar URL construction, not the pipeline that was silently dead for 3 months | m | #424 |

## 2. Architecture / Code Quality

Nothing here is urgent, but all of it gets more expensive to fix the longer it's deferred.

| Item | Why | Effort | Lair task |
|---|---|---|---|
| **Split `backend/app/main.py`** (753 lines, every route in one file) into `routers/bills.py`, `routers/alders.py`, `routers/subscriptions.py`, `routers/meta.py` | Single-file route sprawl gets harder to navigate with every new endpoint; already the largest file in the backend by a wide margin | m | #425 |
| **Rate limiting on `POST /api/subscriptions`** | No throttling exists today. Each request creates a `Subscriber` row and triggers a real Resend send — currently abusable for cost or spam with no guardrail | s | #426 |
| **Delete dead `notifications/sender.py`** — an unused SendGrid/SMTP wrapper; `notifications/email.py` (Resend) is the real, only-used sender | Confirmed zero references anywhere in the codebase | xs | *(quick win — just do it, not worth a task)* |
| **Split the largest frontend pages** — `AlderDetail.tsx` (741 lines), `BillPage.tsx` (591), `App.tsx` (616) — into smaller components (tabs, timeline, vote-breakdown as their own pieces) | Not broken, but these are the three largest files in the frontend and will keep growing as more alder/bill detail features land | l | #427 |

## 3. Feature Direction (grounded in the manifesto)

Pulled from `cream-city-docket-manifesto.md` §9–14 (primary users, pain points, long-term vision) — not new scope invented for this doc.

| Item | Manifesto grounding | Effort | Lair task |
|---|---|---|---|
| **Public testimony info** — surface when/where/how to give public testimony on a bill, on the bill page or as an alert type | §10 pain points, explicitly named: *"difficult to know when and where to give public testimony"* — currently unaddressed by the product | l | #428 |
| **Automate `scripts/enrich_alders.py`** — currently a manual one-off; alder legislative-focus summaries go stale as their bill count grows | Directly noted as a gap in the dev plan's Remaining/Future section already; just needs an APScheduler cron instead of manual re-runs | s | #429 |
| **Political History tab — real election data** | Deferred since Milestone 5; model + API already exist, just needs sourcing from Milwaukee Elections Commission / city clerk records | l | #430 |
| **Neighborhood-level tracking** (finer than the current 15-district granularity) | §14 long-term vision: *"neighborhood-specific policy tracking with granular filtering"* — would need geocoding/boundary data beyond alder districts | xl | #431 |
| **Expand beyond Milwaukee Common Council** (county → state → multi-city) | §14 long-term vision, explicitly the largest stated ambition — noted here as a real direction, not something to plan concretely yet | xl | *(not filed — too far out to scope meaningfully right now)* |

## 4. Hyper-local / persona-based alert targeting

**Case study: the Water Street food truck curfew.** Matter #46, "A substitute ordinance relating to time-limited food truck zones" (Ald. Bauman) — narrows the hours food trucks can operate in Milwaukee's time-limited food peddler zones (11pm–6am generally, 10pm–6am Downtown). Tagged `Food Access` + `Small Business` today. A subscriber with `Small Business` in their tags *would* get this alert as things stand — the gap isn't visibility, it's **specificity**: they'd get every small-business bill in the city, with no way to say "I specifically care about Water Street" or "I specifically run a food truck."

Pulled the actual bill text to ground what's buildable, rather than guessing:

- The raw ordinance text **never mentions "Water Street."** It only references code sections (`68-37-1-e-1-a`) and a zone name (*"Downtown time-limited food peddler vehicle zone"*). Which real streets fall inside that zone is knowledge external to Legistar — the city's own zone map, not anything in the bill.
- Other matter types *do* routinely cite exact addresses in the title or body — sampled zoning/plan-commission bills turned up "350 South Water Street," "234 South Water Street," "1026 North 24th Street," etc. Address-level matching is genuinely buildable for that class of bill today, no new data needed.

That split — some bills name a real address, most zone/code-based ones don't — is the whole reason this needs to be three separate, differently-shaped pieces instead of one:

| Item | What it catches | What it needs | Effort | Lair task |
|---|---|---|---|---|
| **Free-text keyword watch** — a subscriber adds watch phrases ("Brady Street," "MSOE," a landlord's name, "food truck") matched against title+summary+raw_text | Anything the bill text literally names — addresses, institutions, named entities, informal terms | Just a new `SubscriberPreference` type + `ILIKE`/full-text match in the dispatcher against existing columns. No new data. | m | #432 |
| **Address extraction + matching for zoning/development bills** | The "234 South Water Street" class of bill specifically — lets a homeowner watch their own block | An extraction step (regex or LLM) pulling cited addresses during enrichment into a queryable column, then fuzzy-matching a subscriber's watched address/block against it | m | #433 |
| **Zone/code-reference resolution** — cross-reference zone names, BIDs, and similar code-level designations against a real map of what streets/corridors they cover, so a bill like #46 resolves to "Water Street, Brady Street, [other zoned corridors]" even though the text never says so | The actual Water Street curfew case — this is the one that *needs* external knowledge the bill text doesn't contain | Sourcing Milwaukee's food-peddler-zone / BID / historic-district maps as reference data (similar sourcing effort to the Political History election-data task, #430) and feeding it into enrichment. Genuinely hard, not just an engineering task. | xl | #434 |
| **Persona templates on the subscribe page** — "I'm a food truck vendor," "I'm a business owner on [corridor]," "I'm a student at [MSOE/UWM]," "I rent from [landlord]" as friendly presets that expand into the right combination of keyword/address/zone watches underneath | Lets a non-expert subscriber get this specificity without knowing Legistar jargon like "time-limited food peddler vehicle zone" | Depends on #432 (and ideally #433/#434) existing first — this is the UX layer on top | m | #435 |

Build order matters here: #432 (keyword watch) is cheap, self-contained, and immediately useful on its own — do it first. #433 (address extraction) is a natural next step. #434 (zone resolution) is the only piece that would have caught the Water Street bill *by name* rather than by lucky tag overlap, but it's also the most speculative and data-dependent — treat it as a real "someday," not a near-term commitment. #435 only makes sense once at least #432 exists.

## Immediate next steps (not backlog — do these first, this week)

- **Confirm the poller fix held.** Re-run `docket-health` and check both poller lines are ✅ (as of this writing, the first real post-fix poll cycle hadn't completed yet).
- **Validate the notification pipeline end-to-end for real** — the dev plan has flagged "real-world alert test" as pending since May; now's the actual window to confirm a live bill triggers a live immediate alert *and* that a digest-mode subscriber gets a real batched email at the next 7am CT cron, not just synthetic/local testing.
