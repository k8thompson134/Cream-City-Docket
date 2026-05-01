# Legistar API Exploration Findings
*Generated from scripts 01–06 | April 30, 2026*

---

## Q1: Is MatterText available reliably?

**Answer: Yes — 100% coverage across all MatterTypes sampled.**

The correct workflow (the requirements doc had the path slightly wrong):
1. `GET /Matters/{id}/Versions` — returns `[{"Key": "87237", "Value": "1"}, ...]` where Key is the textId and Value is the version number
2. `GET /Matters/{id}/Texts/{textId}` — returns the full text record

Key fields returned:
- `MatterTextPlain` — plain text, ready for LLM enrichment
- `MatterTextRtf` — RTF format (not needed)
- `MatterTextVersion` — version string ("0" = Original, "1" = Substitute 1, etc.)

`GET /Matters/{id}/Texts` (without a textId) returns 405. Always use the Versions → Texts pattern.

---

## Q2: What MatterTypes does Milwaukee actually use?

**Milwaukee has more types than the requirements doc anticipated.** 30-day sample (555 matters):

| MatterType | 30-day count | Alert-worthy? | Notes |
|---|---|---|---|
| Resolution | 203 | Usually yes | Includes Historic Preservation, Zoning, etc. |
| Communication | 92 | No | Filter from feed |
| Appointment | 70 | Sometimes | Mayor appointments — filterable |
| Ordinance | 53 | Yes | Core legislative type |
| Fire and Police Resolution | 48 | Rarely | FPC personnel actions (promotions, demotions) |
| APPEAL | 42 | No | Administrative Review Board nuisance fee appeals |
| Motion | 14 | Rarely | Internal council actions |
| Fire and Police Communication | 10 | No | FPC informational filings |
| Communication to Finance | 6 | No | Filter from feed |
| Housing Authority Resolution | 6 | Sometimes | Housing Authority board actions |
| Plan Commission Resolution | 5 | Sometimes | Zoning/land use from Plan Commission |
| Resolution-Immediate Adoption | 4 | Yes — HIGH PRIORITY | Fast-track, no hearing window |
| Charter Ordinance | 1 | Yes — HIGH PRIORITY | 60-day effective date delay |
| Budget | 1 | Yes | Annual budget filings |

**Recommended additions to requirements:**
- Add "Fire and Police Resolution" and "APPEAL" to the excluded/deprioritized list (along with Communication, Motion, Claim)
- Add "Resolution-Immediate Adoption" as a special alert type (fast-track — no hearing window)
- Housing Authority Resolution and Plan Commission Resolution can be included as Resolutions

---

## Q3: How does MatterStatus change over time?

**MatterStatus strings Milwaukee actually uses:**

Active statuses:
- `In Committee` — referred to a committee, awaiting hearing
- `In Commission` — at the Fire and Police Commission or other body
- `In Council` — before the full council
- `In Council-Adoption` — council vote pending (adoption)
- `In Council-Passage` — council vote pending (passage)
- `In Council-Confirmation` — council confirmation vote (appointments)
- `In Council-Approval` — council approval vote
- `In Council-Placed on File` — will be filed without action

Terminal statuses:
- `Passed` — enacted by council
- `Placed On File` — shelved without vote
- `Dead` — failed or killed

**Observed MatterHistory action names** (from 3 passed ordinances):
- `ASSIGNED TO` — committee referral
- `DRAFT SUBMITTED` — text submitted before intro
- `RECOMMENDED FOR PASSAGE` — committee recommended passage
- `AMENDED` — bill was amended
- `PASSED` — full council passage
- `SIGNED` — mayor signed ✓ (mayoral actions confirmed in MatterHistory)
- `PUBLISHED` — published in official newspaper

Note: `MatterHistoryBodyName` appears null in all sampled history records — use `MatterBodyName` from the Matter record instead.

---

## Q4: Are mayoral actions visible in MatterHistory?

**Yes — confirmed.** SIGNED and PUBLISHED appear as MatterHistory events with dates.

Example (Matter 73583, food truck ordinance):
```
2026-04-22  [SIGNED]
2026-05-08  [PUBLISHED]
```

VETO events were not found in the 30-day sample (no vetoes in that period). The structure should be the same — a `VETOED` or `RETURNED` action in MatterHistory. Will need to verify with a historical veto when one occurs.

---

## Q5: What is the practical polling frequency?

**Incremental polling via `MatterLastModifiedUtc` works correctly.**

- Filter: `$filter=MatterLastModifiedUtc ge datetime'2026-04-30T20:24:33'`
- Response time: ~0.31 seconds
- No rate-limit headers detected in responses

Volume observed (April 30, 2026 — active council day):
- Last 1 hour: 49 matters modified
- Last 24 hours: 143 matters modified
- Last 7 days: 266 matters modified

**Important fix for the poller:** the requirements doc referred to `MatterLastModified` — the actual field is `MatterLastModifiedUtc`. The ordering param `$orderby=MatterLastModified desc` returns 400; use `$orderby=MatterLastModifiedUtc desc` or `$orderby=MatterId desc`.

---

## Q6: What does a realistic month of Milwaukee data look like?

**30-day total: 555 matters. Alert-worthy subset: 257.**

Weekly estimates:
- All types: ~138/week
- Alert-worthy (Ordinance + Charter Ordinance + Resolution): ~64/week for LLM enrichment

**Claude Haiku cost estimate:**
- ~64 enrichments/week
- Assuming 2000 input tokens + 200 output tokens per bill
- Input: $0.10/week | Output: $0.05/week
- **Total: ~$0.61/month** — well within the <$2/month target in NFR-05

---

## Additional Findings

**Sponsors endpoint works:** `GET /Matters/{id}/Sponsors` returns alder names and IDs. The food truck ordinance (Matter 73583) confirms ALD. BAUMAN as sole sponsor.

**Attachments:** `GET /Matters/{id}/Attachments` returns PDF hyperlinks (hosted at `milwaukee.legistar1.com`). These are the supporting documents referenced in bill detail pages.

**Correct API field names (fixes for data model):**
- `MatterLastModifiedUtc` (not `MatterLastModified`)
- `MatterTextPlain` (text content field in the Texts endpoint)
- `MatterTextVersion` (version string: "0", "1", etc.)

**Real-world confirmation:** Matter 73583 = the April 2026 food truck curfew ordinance. Status: Passed. Signed 2026-04-22. Substitute 1 filed 2026-04-06. Sponsored by ALD. BAUMAN.

---

## Known Limitation: Legistar Web URLs

The Legistar web interface (`milwaukee.legistar.com/LegislationDetail.aspx`) uses a **LegislationID** that is entirely separate from the **MatterId** exposed by the API. There is no field in the API response that maps a Matter to its corresponding web URL ID.

Attempts to construct detail page URLs using `MatterId`, `MatterGuid`, or the gateway endpoint all return "Invalid parameters!" errors. The Legistar web UI is JavaScript-rendered, so the correct ID cannot be scraped from the search results page either.

**Current workaround:** Link to the Legistar search page (`/Legislation.aspx`) and display the `MatterFile` number (e.g. "File #252101") so users know what to search for manually.

**Possible future fix:** Cache the LegislationID→MatterId mapping by intercepting Legistar search results via a headless browser or by finding an undocumented API endpoint that exposes the web ID. Not worth the complexity for v1.
