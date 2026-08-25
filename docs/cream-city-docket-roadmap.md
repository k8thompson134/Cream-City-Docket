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

## Immediate next steps (not backlog — do these first, this week)

- **Confirm the poller fix held.** Re-run `docket-health` and check both poller lines are ✅ (as of this writing, the first real post-fix poll cycle hadn't completed yet).
- **Validate the notification pipeline end-to-end for real** — the dev plan has flagged "real-world alert test" as pending since May; now's the actual window to confirm a live bill triggers a live immediate alert *and* that a digest-mode subscriber gets a real batched email at the next 7am CT cron, not just synthetic/local testing.
