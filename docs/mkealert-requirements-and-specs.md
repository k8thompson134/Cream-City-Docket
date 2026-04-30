# MKE Alert: Requirements and Specifications
*v0.2 | April 2026*

---

## 1. Overview

This document defines the functional requirements, non-functional requirements, technical constraints, and system specifications for MKE Alert v1. It should be read alongside the Problem Statement and User Stories document.

MKE Alert is a civic technology web application that monitors Milwaukee Common Council legislation via the Legistar API, enriches filings with LLM-generated plain-language summaries and issue area tags, and delivers proactive email alerts to subscribers before votes occur.

---

## 2. Legistar API Reference

MKE Alert is built on the Granicus Legistar Web API, a public REST API used by approximately 70% of large U.S. municipalities. Understanding Legistar's terminology is essential for reading this document, as Legistar's naming conventions differ from common civic vocabulary.

### 2.1 Terminology Mapping

| Legistar Term | Plain Language Equivalent | Notes |
|---|---|---|
| Matter | Bill or ordinance filing | The core legislative record. Every bill, resolution, and ordinance is a Matter. |
| MatterText / Versions | Full bill text | Full legislative text with version history. Separate from the Matter record itself. |
| MatterSponsor | Sponsoring alder(s) | Each Matter can have multiple sponsors. |
| MatterStatus | Bill status | Where the bill is in the process (e.g. introduced, in committee, passed). |
| MatterType | Type of filing | Distinguishes ordinances, resolutions, appointments, etc. |
| MatterHistory | Legislative history log | Timestamped record of every action taken on a Matter. |
| MatterAttachment | Attached documents | PDFs and supporting files attached to a filing. |
| Body | Legislative body or committee | The Common Council itself and each committee are Bodies. |
| Event | Meeting or hearing | A scheduled meeting of any Body. |
| EventItem | Agenda item within a meeting | Each Matter on a meeting agenda appears as an EventItem. |
| RollCall | Attendance record for a vote | Tracks which persons were present for a given EventItem vote. |
| Vote | Individual alder vote record | Per-person vote (yes/no/abstain) on an EventItem. Accessible by EventItem or by Person. |
| Person | Any named individual in the system | Includes alders, staff, and public figures. Alders are Persons with OfficeRecords. |
| OfficeRecord | A person's term in office | Links a Person to a Body for a date range (e.g. Alder Brower's term on the council). |

### 2.2 Key API Endpoints Used by MKE Alert

All endpoints are prefixed with `https://webapi.legistar.com/v1/milwaukee/`

| Endpoint | Purpose |
|---|---|
| `GET /Matters` | Poll for new and updated filings |
| `GET /Matters/{id}` | Fetch a single filing's metadata |
| `GET /Matters/{id}/Versions` | Check if bill text has been updated |
| `GET /Matters/{id}/Texts/{textId}` | Fetch full bill text for LLM enrichment |
| `GET /Matters/{id}/Sponsors` | Get sponsoring alders for a filing |
| `GET /Matters/{id}/Histories` | Get the full legislative history of a filing |
| `GET /Events` | Get scheduled meetings and hearings |
| `GET /Events/{id}/EventItems` | Get agenda items for a specific meeting |
| `GET /EventItems/{id}/Votes` | Get all votes on a specific agenda item |
| `GET /Persons/{id}/Votes` | Get all votes cast by a specific alder |
| `GET /Persons` | Get all persons (used to build alder list) |
| `GET /Persons/{id}/OfficeRecords` | Confirm current council membership |
| `GET /Bodies` | Get all bodies (council + committees) |

### 2.3 API Notes

- The API is public and requires no authentication for read operations.
- Supports OData v3 query parameters including `$filter`, `$top`, `$skip`, and `$orderby` for filtering and pagination.
- Example filter to fetch Matters introduced after a specific date: `GET /Matters?$filter=MatterIntroDate ge datetime'2026-04-01T00:00:00'`
- Full bill text lives at MatterTexts, not on the Matter record itself, and requires a separate API call per filing during enrichment.
- Roll-call votes and individual alder votes are fully exposed via the Votes and RollCalls endpoints, confirming that alder accountability features (US-15, US-16) are buildable in v1.

---

## 3. Milwaukee Legislative Process Reference

Understanding how Milwaukee's legislative process actually works is essential for modeling status flows, edge cases, and alert logic correctly. This section documents the key process rules discovered during research.

### 3.1 Matter Types

Not all Matters are legislation that constituents care about. The Common Council produces a high volume of routine administrative filings that should be filtered or deprioritized in the feed and alert system.

| Matter Type | Description | Alert-worthy? |
|---|---|---|
| Ordinance | Permanent change to the Milwaukee Code of Ordinances | Yes |
| Charter Ordinance | Permanent change to the City Charter; higher vote threshold and longer effective date | Yes, high priority |
| Resolution | One-time policy directive or statement; does not change permanent law | Usually yes |
| Motion | Internal council action; does not require mayoral approval (e.g. license approvals) | Rarely |
| Appointment | Mayor's appointment of a department head or board member; council confirms or rejects | Sometimes, depending on subscriber interest |
| Communication | Informational filing; no vote required | No |
| Claim / Settlement | Legal claims against the city | No |

The system shall use MatterType to filter and label Matters appropriately. Motions, claims, and communications shall be excluded from the default feed view but retained in the database.

### 3.2 Effective Dates and Publication

- Standard ordinances take effect the day after publication in the official city newspaper.
- Publication must occur within 15 days (excluding holidays and weekends) of council passage.
- Charter ordinances take effect 60 days after publication, not the day after. This delay must be surfaced clearly on charter ordinance detail pages.

### 3.3 Substitute Files and Amendments

Bills are frequently amended during the legislative process. Legistar tracks this through versioning:

- A Matter introduced by title only is the "Original."
- When the completed text is filed, it becomes "Substitute 1."
- Further amendments produce "Substitute 2," and so on.

The system must handle substitute versions gracefully: re-running LLM enrichment when a new substitute is detected (FR-04), displaying version history on the detail page, and alerting subscribers when a bill they are tracking has been substantially amended.

### 3.4 Fast-Track: Resolutions for Immediate Adoption

Resolutions that neither appropriate funds nor create a charge against a city fund may be adopted at the same meeting they are introduced via a two-thirds council vote. This bypasses the normal committee hearing stage entirely.

For MKE Alert this means: a Matter can go from introduction to passage in a single meeting with no "hearing scheduled" alert window. The system must handle this status flow gracefully rather than assuming every Matter will pass through a committee stage.

### 3.5 Veto and Override Rules

- The mayor may sign, veto, or allow legislation to lapse into law (unsigned after a set period).
- A veto override requires 10 votes (two-thirds of the 15-member council).
- If the original legislation required a higher threshold to pass (e.g. a charter ordinance requires 10 votes to pass), that same higher threshold is required to override the veto.
- A vetoed file may not be amended by the council; it must be overridden as-is or re-introduced as a new file.

*Real-world reference: In November 2025, the council voted 13-1 to pass a 4% city worker wage increase. Mayor Johnson vetoed it back to 3%. The council subsequently overrode the veto with 10 votes. MKE Alert should have surfaced alerts at every stage: passage, veto, and override vote scheduled.*

### 3.6 End-of-Term Lapse

All Matters that are still on file and have not been voted on at the end of a council term (every four years) are automatically deemed indefinitely postponed. The system must detect this status and update affected Matters accordingly rather than leaving them visible as active in the feed.

### 3.7 Appointments and Mayoral Role in Legislation

The mayor cannot directly introduce legislation. All bills must be sponsored by one or more alders. The mayor's legislative role is limited to signing, vetoing, or allowing bills to lapse, and submitting the annual budget.

The council confirms or rejects the mayor's appointments of department heads and board members. These appear as Matters in Legistar and can be significant (a police chief appointment, for example) but are generally distinct from legislation and should be labeled and filterable separately.

---

## 4. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Backend framework | Python + FastAPI | Clean async support, good for API-driven architecture, new framework addition to portfolio |
| Database | PostgreSQL | Relational data fits legislative structure well, already in use on Railway |
| Job scheduler | APScheduler (in-process) | Sufficient for v1 polling frequency, avoids Redis dependency of Celery; revisit if scale grows |
| LLM | Claude Haiku via Anthropic API | Low cost at expected volume, no self-hosting complexity |
| Frontend framework | React + TypeScript + Vite | Proven stack, fast build tooling, keeps frontend simple while backend is the portfolio focus |
| Email delivery | Resend or SendGrid (free tier) | TBD; both support transactional email at low volume for free |
| Hosting | Railway (Hobby Plan) | Already in use for Stormglass backend, familiar deployment workflow |

---

## 5. System Architecture Overview

MKE Alert is composed of three loosely coupled subsystems:

**5.1 Data Pipeline (Poller + Enrichment Worker)**
A scheduled background job polls the Milwaukee Legistar API for new and updated Matters. New Matters are written to the database as raw records. A separate enrichment step fetches the full MatterText, calls Claude Haiku to generate a plain-language summary and assign issue area tags, then updates the record. Summaries are cached permanently after first generation and only re-requested if a new MatterText version is detected.

**5.2 Web Application**
A FastAPI backend serves a REST API consumed by a React + TypeScript frontend. The frontend is a single-page application built with Vite. No server-side rendering is required. The backend handles browsing, filtering, bill detail, alder profiles, and subscription management endpoints.

**5.3 Notification Dispatcher**
A scheduled job runs after the enrichment worker and checks newly enriched or updated Matters against subscriber preferences. Matching subscribers are queued for email delivery. Emails are sent via transactional email provider (Resend or SendGrid).

---

## 6. Functional Requirements

### 6.1 Data Ingestion

| ID | Requirement | Source |
|---|---|---|
| FR-01 | The system shall poll `GET /Matters` on a scheduled interval and retrieve all Matters introduced or updated since the last poll | US-01, US-04 |
| FR-02 | The system shall detect and record MatterStatus changes to existing filings (e.g. referred to committee, scheduled for hearing, advanced to full council) by comparing against stored status on each poll | US-04, US-08, US-09 |
| FR-03 | The system shall store raw Matter data in the database before enrichment, so that ingestion and LLM processing are decoupled | Architecture |
| FR-04 | The system shall check `GET /Matters/{id}/Versions` before re-enriching a filing; enrichment shall only be re-run if a new MatterText version (substitute) exists | Cost constraint, Section 3.3 |
| FR-05 | The system shall handle Legistar API failures gracefully by logging the error and retrying on the next scheduled poll without data loss | Reliability |
| FR-06 | The system shall store the timestamp of each successful poll for auditing and debugging | Reliability |
| FR-07 | The system shall sync Event and EventItem data to track upcoming hearing dates and locations for each Matter | US-12, FR-18 |
| FR-08 | The system shall store MatterType for every ingested Matter and use it to filter, label, and deprioritize routine filings | Section 3.1 |
| FR-09 | The system shall exclude Motions, Claims, Settlements, and Communications from the default feed view; these shall be stored in the database but not surfaced to users unless explicitly searched | Section 3.1 |
| FR-10 | The system shall detect and record when a Matter has reached end-of-term lapse status and update its MatterStatus accordingly so it does not remain visible as active in the feed | Section 3.6 |

### 6.2 LLM Enrichment

| ID | Requirement | Source |
|---|---|---|
| FR-11 | The system shall fetch full bill text via `GET /Matters/{id}/Texts/{textId}` and pass it to Claude Haiku to generate a one-paragraph plain-language summary | US-17 |
| FR-12 | The system shall pass the bill text and title to Claude Haiku to assign one or more issue area tags from the predefined taxonomy | US-18 |
| FR-13 | The system shall cache the generated summary and tags in the database and shall not call the LLM API again for the same Matter version | Cost constraint |
| FR-14 | The system shall define a fixed issue area taxonomy; the LLM maps Matters to this taxonomy rather than generating free-form tags | US-02, consistency |

**Initial issue area taxonomy (v1):**
Housing, Food Access, Policing and Public Safety, Labor, Immigration, Transportation, Environment, Education, Healthcare, Small Business, Budget and Finance, Land Use and Zoning, Other

### 6.3 Web Application - Browsing and Discovery

| ID | Requirement | Source |
|---|---|---|
| FR-15 | The system shall display a paginated feed of Matters ordered by introduction date, most recent first, excluding routine administrative MatterTypes | US-01, Section 3.1 |
| FR-16 | Each Matter in the feed shall display the plain-language summary, issue area tags, MatterType label, sponsoring alder, current MatterStatus, and next hearing date if scheduled | US-01, US-03, US-04 |
| FR-17 | The system shall allow users to filter the feed by one or more issue area tags | US-02 |
| FR-18 | The system shall allow users to filter the feed by aldermanic district | US-11 |
| FR-19 | Each Matter shall have a unique, shareable URL at a permanent route (e.g. /bills/[id]) | US-14 |
| FR-20 | Each Matter detail page shall include a direct link to the original Legistar filing | US-05 |
| FR-21 | Each Matter detail page shall display the next scheduled Event including date, time, and location sourced from EventItem data | US-12 |
| FR-22 | Each Matter detail page shall display the sponsoring alder's name, email address, phone number, and district | US-13 |
| FR-23 | Each Matter detail page shall display a full legislative status timeline including introduction, committee referral, committee vote, council vote, mayoral action, and override outcome where applicable | Section 3.2, 3.5 |
| FR-24 | Charter ordinance detail pages shall prominently display the 60-day delayed effective date and explain what that means in plain language | Section 3.2 |
| FR-25 | Matter detail pages shall display substitute version history when a bill has been amended, showing which version is current and linking to prior versions | Section 3.3 |
| FR-26 | The subscription page shall include a static aldermanic district map image and a link to the City of Milwaukee's official district lookup tool for users who do not know their district | US-06 |

### 6.4 Alder Profiles

| ID | Requirement | Source |
|---|---|---|
| FR-27 | The system shall provide a profile page for each alder displaying their contact information, current sponsored Matters, and recent legislative activity | US-15 |
| FR-28 | The system shall display individual alder vote history sourced from `GET /Persons/{id}/Votes`, confirmed available via the Legistar API | US-15, US-16 |

### 6.5 Mayor Profile and Actions

| ID | Requirement | Source |
|---|---|---|
| FR-29 | The system shall provide a mayor profile page displaying a history of bills signed, vetoed, and allowed to lapse | Section 3.7 |
| FR-30 | The mayor profile shall note that the mayor cannot directly introduce legislation; their role is executive action on council-passed Matters | Section 3.7 |

### 6.6 Veto Workflow

Milwaukee operates under a system where the mayor can sign, veto, or allow legislation to lapse into law. The Common Council can override a veto with 10 votes (two-thirds of the 15-member council), except where the original legislation required a higher threshold, in which case that higher threshold applies to the override as well. A vetoed file may not be amended; it must be overridden as-is or re-introduced as a new file.

*Real-world reference: In November 2025, the council voted 13-1 to increase city worker raises to 4%. Mayor Johnson vetoed the measure back to 3%. The council subsequently overrode the veto. MKE Alert should have surfaced alerts at each stage.*

| ID | Requirement | Source |
|---|---|---|
| FR-31 | The system shall track and display mayoral action status for each Matter including: sent to mayor, signed, vetoed, and lapsed into law | MatterHistory, Section 3.5 |
| FR-32 | The system shall detect and record veto events via MatterHistory and update the Matter's status accordingly | Section 3.5 |
| FR-33 | The system shall detect and record veto override votes via EventItem vote records and update Matter status to reflect the override outcome | Section 3.5 |
| FR-34 | The system shall send subscriber alerts when a Matter they are tracking is vetoed by the mayor | Section 3.5 |
| FR-35 | The system shall send subscriber alerts when a veto override vote is scheduled | Section 3.5 |
| FR-36 | The veto override threshold (10 votes, or higher if the original passage required it) shall be documented on the Matter detail page when a Matter is in vetoed status | Section 3.5 |

### 6.7 Alerts and Subscriptions

| ID | Requirement | Source |
|---|---|---|
| FR-37 | The system shall allow any user to subscribe to email alerts by providing an email address and selecting one or more issue area tags or aldermanic districts | US-07, US-11 |
| FR-38 | The system shall send an alert when a new Matter matching a subscriber's preferences is introduced | US-07 |
| FR-39 | The system shall send an alert when a Matter matching a subscriber's preferences has an Event scheduled | US-08 |
| FR-40 | The system shall send an alert when a Matter matching a subscriber's preferences advances from committee to full council vote, detected via MatterStatus change | US-09 |
| FR-41 | The system shall send an alert when a Matter matching a subscriber's preferences is passed via fast-track immediate adoption, noting that no committee hearing occurred | Section 3.4 |
| FR-42 | The system shall send an alert when a Matter matching a subscriber's preferences is amended and a new substitute version is filed | Section 3.3 |
| FR-43 | Alert emails shall include the plain-language summary, Event details if applicable, alder contact information, and a link to the Matter detail page | US-08, US-13 |
| FR-44 | The system shall provide a one-click unsubscribe link in every alert email | US-10 |
| FR-45 | The system shall provide a preference management page accessible via a link in alert emails, requiring no login | US-10 |
| FR-46 | The system shall not send duplicate alerts for the same Matter and status change to the same subscriber | Reliability |

---

## 7. Non-Functional Requirements

### 7.1 Performance

| ID | Requirement |
|---|---|
| NFR-01 | The web application feed page shall load within 2 seconds under normal conditions |
| NFR-02 | The Legistar API shall be polled no more than once per hour to avoid rate limiting and unnecessary API load |
| NFR-03 | LLM enrichment shall be processed asynchronously and shall not block the polling job or API response times |

### 7.2 Cost

| ID | Requirement |
|---|---|
| NFR-04 | LLM API costs shall be minimized through caching; each Matter version shall be summarized at most once |
| NFR-05 | The system shall be designed to run within Railway Hobby Plan resource limits ($5/month) plus estimated Haiku API costs of under $2/month at expected Milwaukee Common Council filing volume |
| NFR-06 | Email delivery shall use a free tier service for v1; paid email tiers are out of scope unless subscriber volume exceeds free tier limits |

### 7.3 Reliability

| ID | Requirement |
|---|---|
| NFR-07 | The polling job shall be fault-tolerant; a failed poll shall not crash the application or corrupt existing data |
| NFR-08 | The system shall log all API errors, enrichment failures, and email delivery failures for debugging |
| NFR-09 | The system shall use database transactions where appropriate to prevent partial writes |

### 7.4 Usability

| ID | Requirement |
|---|---|
| NFR-10 | The frontend shall be usable on mobile screen sizes |
| NFR-11 | Plain-language summaries shall target an accessible reading level (8th grade or below) |
| NFR-12 | No login or account creation shall be required to browse legislation |

### 7.5 Accessibility

Disabled people are a primary stakeholder for this project. Legislative decisions around healthcare, housing, transportation, and public services disproportionately affect people with disabilities, and limited energy capacity (as with conditions like ME/CFS, POTS, and Long COVID) makes it especially difficult to monitor legislation through existing clunky government interfaces. MKE Alert's core value proposition of proactive alerts and plain-language summaries directly serves this community.

| ID | Requirement |
|---|---|
| NFR-16 | The frontend shall conform to WCAG 2.1 AA standards |
| NFR-17 | All images shall include descriptive alt text |
| NFR-18 | The interface shall be fully navigable by keyboard |
| NFR-19 | Color shall not be the sole means of conveying information (e.g. issue area tags shall include text labels, not just color coding) |
| NFR-20 | Font sizes and contrast ratios shall meet WCAG AA minimums |
| NFR-21 | Alert emails shall be screen reader compatible with semantic HTML structure |
| NFR-22 | The preference management page shall not require timed interactions or complex motor tasks |

### 7.6 Security

| ID | Requirement |
|---|---|
| NFR-23 | The Anthropic API key shall be stored as an environment variable and never committed to version control |
| NFR-24 | Email addresses collected for subscriptions shall not be shared or used for any purpose other than alert delivery |
| NFR-25 | Unsubscribe tokens shall be unique per subscriber and not guessable |

---

## 8. Data Model (Preliminary)

Legistar source names are noted in parentheses where the mapping is non-obvious.

**matters** (Legistar: Matters)
- id, legistar_matter_id, title, raw_text, current_text_version, matter_status, matter_type, is_charter_ordinance, sponsor_id, introduced_date, next_event_date, next_event_location, next_event_id, summary, enriched_at, legistar_url, created_at, updated_at

**matter_tags** (join table)
- matter_id, tag_id

**issue_tags**
- id, name, slug

**alders** (Legistar: Persons + OfficeRecords)
- id, legistar_person_id, name, district, email, phone, created_at, updated_at

**committees** (Legistar: Bodies)
- id, legistar_body_id, name, created_at, updated_at

**events** (Legistar: Events)
- id, legistar_event_id, body_id, date, time, location, created_at, updated_at

**votes** (Legistar: Votes, sourced via Persons/{id}/Votes)
- id, legistar_vote_id, alder_id, event_item_id, matter_id, vote_value, voted_at

**mayor** (Legistar: Person with executive role)
- id, legistar_person_id, name, email, phone, term_start, created_at, updated_at

**mayor_actions** (Legistar: MatterHistory events)
- id, matter_id, action_type (signed, vetoed, lapsed), action_date, created_at

**subscribers**
- id, email, unsubscribe_token, created_at, updated_at

**subscriber_preferences**
- id, subscriber_id, preference_type (tag or district), preference_value

**alert_log**
- id, subscriber_id, matter_id, trigger_event, sent_at

---

## 9. API Endpoints (Preliminary)

**Matters**
- GET /api/bills - paginated feed with optional tag, district, and matter_type filters
- GET /api/bills/:id - Matter detail with full status timeline and substitute version history

**Alders**
- GET /api/alders - list all alders
- GET /api/alders/:id - alder profile, sponsored Matters, and vote history

**Mayor**
- GET /api/mayor - mayor profile and action history

**Subscriptions**
- POST /api/subscriptions - create new subscription
- GET /api/subscriptions/:token - get preferences by unsubscribe token
- PATCH /api/subscriptions/:token - update preferences
- DELETE /api/subscriptions/:token - unsubscribe

---

## 10. Out of Scope for v1

- Milwaukee County legislation (separate Legistar instance, v2 candidate)
- Wisconsin state legislature tracking
- SMS alerts
- User accounts with login and saved searches
- Mobile app
- Celery/Redis job queue (revisit if APScheduler proves insufficient)
- Address-to-district geocoding (replaced by static map image and link to city lookup tool)
- Surfacing routine administrative Matters (motions, claims, communications) in the public feed

---

## 11. Open Questions

1. Does the Legistar API expose full MatterText reliably for all filing types, or only for some? *(affects LLM summary quality in FR-11; to be verified by sampling live Milwaukee data early in implementation)*
2. Resend vs. SendGrid: final email provider decision pending comparison of free tier limits and developer experience
3. What is the realistic new Matter volume per week for Milwaukee Common Council? *(affects cost estimates in NFR-04)*
4. Does the Legistar API expose mayoral action events (signed, vetoed) via MatterHistory reliably, or will additional work be needed for FR-31 and FR-32? *(to be verified against live Milwaukee data)*

*Resolved: Roll-call votes and individual alder votes are confirmed available via `GET /Persons/{id}/Votes` and `GET /EventItems/{id}/Votes`. Alder accountability features are buildable in v1.*
*Resolved: Address-to-district geocoding removed from scope; replaced with static district map and external link to city lookup tool.*
*Resolved: Parks removed from issue taxonomy as Milwaukee parks are primarily Milwaukee County jurisdiction, which is out of scope for v1.*
