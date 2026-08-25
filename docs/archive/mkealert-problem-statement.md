# MKE Alert: Problem Statement and User Stories
*v0.1 | April 2026*

---

## Problem Statement

Milwaukee residents, organizers, and journalists have no practical way to learn about city legislation **before it passes**. The City of Milwaukee's legislative data is publicly available through the Legistar system, but it is buried behind a clunky interface that requires users to already know what they are looking for. No alert system exists for new filings. Local media coverage of legislation typically arrives only after a full council vote. Aldermanic offices do not proactively notify constituents about upcoming votes.

The result is a democratic gap: by the time most residents learn a bill exists, the window to contact their alder, show up to a committee hearing, or organize a response has already closed.

This is especially harmful to working-class constituents, student communities, and advocacy organizations who lack lobbyists or insider connections to City Hall. These are often the same communities most affected by decisions around housing, food access, policing, labor, and public safety.

**MKE Alert** bridges this gap by monitoring Milwaukee's Legistar legislative database, using an LLM to summarize and categorize new filings in plain language, and delivering timely, actionable alerts to subscribers before votes occur.

---

## Assumptions and Constraints (v1)

- Scope is Milwaukee city government only (Common Council legislation via Legistar API)
- No user authentication required for browsing; email required only for alert subscriptions
- LLM summarization is handled via the Anthropic API (Claude)
- Primary delivery mechanisms: web app and email digest
- SMS is out of scope for v1 but the architecture should not preclude it
- v1 is not monetized and is designed to be low-cost to run

---

## User Personas

### 1. The Constituent
A Milwaukee resident who wants to know when something affecting their neighborhood, school, or daily life is moving through City Hall, in time to actually do something about it.
*Example: A student living near MSOE who would have wanted to know about the food truck curfew before it passed.*

### 2. The Organizer
A member of a political or advocacy organization (DSA, tenant union, mutual aid group, etc.) who needs to track legislation relevant to their issue areas and mobilize members quickly when something lands.
*Example: A YDSA co-chair coordinating rapid response across three campuses.*

### 3. The Journalist / Researcher
Someone who covers Milwaukee politics or studies local government and needs to catch legislation early, before it is newsworthy enough for mainstream coverage.
*Example: An Urban Milwaukee contributor or a UWM political science researcher.*

### 4. The Casual Civic Browser
Someone who is not plugged into city politics but wants a readable, low-friction way to understand what their city government is actually doing.
*Example: A Milwaukee resident who occasionally wonders what their alder is up to.*

---

## User Stories

### Browsing and Discovery

**US-01**
As a **casual civic browser**,
I want to see a feed of recently introduced legislation summarized in plain English,
so that I can understand what is happening at City Hall without reading legal documents.

**US-02**
As a **constituent**,
I want to filter legislation by issue area (housing, food access, policing, labor, immigration, etc.),
so that I can quickly find bills relevant to things I care about.

**US-03**
As a **constituent**,
I want to see which alder sponsored a bill and which committee it is in,
so that I know who is responsible and where it is in the process.

**US-04**
As an **organizer**,
I want to see the current status and next scheduled hearing date for any bill,
so that I know how much time my chapter has to organize a response.

**US-05**
As a **journalist or researcher**,
I want to access the original Legistar filing linked directly from each summary,
so that I can verify the source and read the full legal text when needed.

**US-06**
As a **constituent**,
I want to look up my aldermanic district by address,
so that I can quickly find legislation sponsored by or affecting my alder.

---

### Alerts and Subscriptions

**US-07**
As a **constituent**,
I want to subscribe to email alerts filtered by issue area,
so that I only receive notifications about legislation relevant to me.

**US-08**
As an **organizer**,
I want to receive an alert when a bill in my tracked issue areas is scheduled for a committee hearing,
so that my chapter can show up, submit testimony, or contact alders before the vote.

**US-09**
As a **constituent**,
I want to receive an alert when a bill advances from committee to full council,
so that I know the final vote is imminent and can contact my alder.

**US-10**
As any **subscriber**,
I want to be able to unsubscribe or change my alert preferences at any time,
so that I am in control of what I receive.

**US-11**
As an **organizer**,
I want to subscribe to alerts for a specific aldermanic district,
so that I can track what one alder is sponsoring or voting on.

---

### Civic Action

**US-12**
As a **constituent or organizer**,
I want to see the date, time, and location of the next committee hearing for a bill,
so that I know exactly when and where to show up to speak.

**US-13**
As a **constituent**,
I want to see my alder's email address and phone number on a bill page,
so that I can contact them without having to hunt through the city website.

**US-14**
As an **organizer**,
I want a shareable link to a bill's summary page,
so that I can send it to members who can immediately see what is happening and when the hearing is.

---

### Alder Accountability

**US-15**
As a **constituent**,
I want to see a profile page for my alder showing their recent votes and sponsored legislation,
so that I can hold them accountable at election time.

**US-16**
As a **journalist**,
I want to see voting patterns across all alders on a given issue area,
so that I can identify trends or outliers in council behavior.

---

### LLM-Powered Features

**US-17**
As a **casual civic browser**,
I want each bill to include a one-paragraph plain-language summary,
so that I do not need a law degree to understand what it does.

**US-18**
As an **organizer**,
I want bills to be automatically tagged with relevant issue areas,
so that I do not have to manually categorize hundreds of filings.

---

## Out of Scope for v1

- Milwaukee County legislation (separate Legistar instance, v2 candidate)
- Wisconsin state legislature tracking
- SMS alerts
- User accounts and saved searches with login
- Vote history (Legistar may not expose individual roll-call votes via API; needs investigation)
- Mobile app

---

## Open Questions

1. Does the Milwaukee Legistar API expose individual roll-call votes, or only pass/fail outcomes? *(affects US-15, US-16)*
2. What is the Legistar API rate limit and what polling frequency can be sustained cheaply?
3. Should issue area tagging be fully automated by LLM, or should there be a human-curated taxonomy that the LLM maps to?
4. What email service fits the budget and scale for v1? (SendGrid free tier, Resend, Buttondown, etc.)
