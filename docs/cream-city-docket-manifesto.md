# Cream City Docket — Founding Memo and Product Thesis
*Version 0.1 | April 2026*

---

> "Well, it's passed already. So, you know, rally away, I guess. I mean, it's already passed."
> — Alderman Robert Bauman, on food truck owners protesting the downtown curfew ordinance
> *(WISN 12, April 2026)*

---

## 1. One-Line Summary

Cream City Docket helps Milwaukee residents understand city legislation before decisions are final.

---

## 2. Executive Summary

Cream City Docket is a civic transparency tool that helps Milwaukee residents track, understand, and respond to city legislation before votes happen. It takes publicly available legislative data and turns it into plain-English summaries, structured issue tagging, and timely alerts so people can actually act on what is happening at City Hall.

The project exists because city government information is technically public, but in practice it is fragmented, hard to navigate, and often surfaces too late for meaningful public participation. Milwaukee residents frequently only learn about important decisions after they are already passed or too far along to influence.

Milwaukee is the starting point because it is a city with a strong civic identity, a history of practical municipal governance, and a population of students, renters, workers, and organizers who are directly affected by city decisions but often least able to track them in real time.

---

## 3. The Trigger Story

In April 2026, the Milwaukee Common Council passed legislation imposing a 10:00 PM curfew on food trucks in downtown nightlife areas. The bill was sponsored by Alderman Robert Bauman, recommended by the Milwaukee Police Department, and supported by institutional stakeholders including Milwaukee School of Engineering, which sits near the Water Street entertainment district. The legislation passed 14-0, with no votes in opposition.

This blindsided residents who were unaware the bill was even being considered until after it had passed. Only after the fact did media coverage and public backlash emerge. Food truck owners were not meaningfully consulted beforehand, and many stated the ordinance could severely impact their livelihoods, since a large portion of their revenue comes after bar close.

The decision also directly affects MSOE students. Campus dining options often close at 10:00 PM or earlier, and on-campus convenience stores are no longer available. This left food trucks as one of the only reliable, late-night, walkable food options for students. The ordinance worsens an existing food access gap for students working late or returning from evening activities.

This issue stuck with me personally because I relied on those food trucks as a student at MSOE. After long nights working on projects, going to Mr. Taco or Fatty Patty was part of the routine — one of the only accessible, safe, and walkable food options available late at night. It also created a small but real community space where students, workers, and residents interacted.

What made this frustrating was not just the policy itself, but the timing. There was no real opportunity to understand, respond to, or influence the decision before it was already complete. That experience highlighted a larger structural issue: important local decisions can move through City Hall without residents ever realizing they were being discussed.

---

## 4. The Bigger Problem

This situation illustrates a broader civic problem: unless representatives actively communicate upcoming legislation, it is extremely difficult for the average Milwaukee resident to stay informed in real time.

Milwaukee does have public systems for tracking legislation, agendas, and meetings, but they are fragmented across different websites and require prior knowledge of where to look and what to search for. This makes the system effectively usable only for people who are already highly engaged or professionally involved in politics.

Journalists often cover legislation only once it reaches a final vote or becomes publicly controversial. By that point, meaningful participation has already passed. This creates frustration on both sides: residents feel excluded, while representatives receive backlash after decisions are already finalized and difficult to reverse.

In practice, this gap allows well-connected actors, institutional stakeholders, and politically engaged insiders to track and influence decisions far earlier than the general public. Even though the information is technically public, it is not practically accessible in a way that supports timely civic participation.

---

## 5. Core Beliefs

- City government should be transparent with its residents.
- Publicly available information should be accessible and understandable.
- True democracy requires participation before decisions are finalized, not after.
- People can only hold their representatives accountable if they know what those representatives are doing.
- Cities should serve residents, not just institutional or donor interests.
- Communication is a public service, not an afterthought.
- Notice only matters if it arrives in time to act on it.
- Civic systems should reduce barriers to participation, not reinforce them.

---

## 6. Milwaukee Context

Milwaukee is an ideal place to start this project because it combines strong local identity with a real gap in civic communication and legislative visibility.

City decisions in Milwaukee directly affect daily life — housing, zoning, nightlife, transportation, public safety, and neighborhood development — but many of these decisions receive limited public attention until late in the process.

Milwaukee also has a civic tradition often associated with sewer socialism: the idea that local government should be practical, competent, and focused on improving everyday life through public services and infrastructure. Cream City Docket is inspired by that tradition in a modern form, using technology to improve transparency, communication, and civic participation at the neighborhood level.

The city has a large population of students, renters, workers, and neighborhood residents who are directly impacted by city policy but often lack the time or tools to track it effectively. Starting in Milwaukee allows this project to focus deeply on a real community with real civic needs, rather than generalizing too early.

---

## 7. What the Product Does

- Monitors new Milwaukee Common Council legislation and agenda items via the public Legistar API
- Summarizes bills in plain English using an LLM (Claude Haiku)
- Tags legislation by issue area: housing, labor, policing, food access, immigration, healthcare, and more
- Sends email alerts before hearings, committee meetings, and full council votes
- Displays sponsor, committee, status, and full legislative timeline for every bill
- Surfaces mayoral actions including signatures, vetoes, and override votes
- Links directly to official city records for verification
- Helps users identify their alderperson and district
- Provides shareable bill links for organizers and journalists

---

## 8. What the Product Is Not

- Partisan propaganda or ideological advocacy
- Outrage bait or engagement-driven content
- A replacement for journalism
- A rumor or speculation platform
- A cluttered government portal
- A surveillance or data harvesting tool
- A place where opinion is disguised as fact

---

## 9. Primary Users

**Tier 1 — Core audience**
Community organizers, journalists and local reporters, politically engaged residents, transparency and accountability advocates

**Tier 2 — Directly served**
Students, disabled residents, small business owners, neighborhood association members

**Tier 3 — Secondary benefit**
Alders and city staff who benefit from a more informed and engaged constituent base

---

## 10. User Pain Points

- Found out about legislation after it already passed
- No way to know a proposal existed until it was too late to respond
- Hard to find where legislation lives or how to track its progress
- Legal language is difficult to understand without a law degree
- Unclear who represents them or how to contact that person
- No time to attend or follow city meetings regularly
- Information is scattered across multiple city systems
- No centralized way to see alder activity or voting patterns
- Difficult to know when and where to give public testimony

---

## 11. Product Principles

- Clarity beats formality
- Actionable information beats comprehensive information
- Trust beats engagement
- Timeliness beats perfection
- Simplicity beats feature complexity
- Mobile usability is essential, not optional
- Facts come first, interpretation comes second
- The user experience should reduce cognitive load, not add to it

---

## 12. Trust and Neutrality Standards

Maintaining neutrality is important so the product remains useful to people across political perspectives. At the same time, the project is guided by non-partisan values: transparency, civic participation, and accountability.

All factual claims are clearly sourced. The system is explicit about where information comes from and maintains a clear separation between raw data, LLM-generated summaries, and any optional analysis.

The product prioritizes accuracy and honesty, including being transparent when information is incomplete or uncertain, rather than inferring or guessing missing details.

Where contextual commentary exists, it is clearly labeled as interpretation rather than fact. The product can surface light structural observations — for example, when a legislative process is unusually fast, unusually opaque, or deviates from typical patterns — but commentary never replaces or obscures the underlying facts.

---

## 13. Why This Could Matter

If successful, Cream City Docket could lead to:

- Earlier and more informed civic participation in Milwaukee
- More effective public comment periods with broader participation
- Stronger local journalism coverage of under-reported legislation
- Increased accountability for elected officials at the city level
- Better communication between residents and representatives
- Greater public awareness of how local government actually operates
- Reduced "surprise legislation" effect on communities most impacted by policy

---

## 14. Long-Term Vision

- Expand to Milwaukee County government
- Expand to Wisconsin state legislature
- Multi-city civic transparency platform built on the Legistar API
- Tools for comparing legislative activity and alder voting patterns across cities
- Representative accountability dashboards
- Neighborhood-specific policy tracking with granular filtering

---

## 15. Why I Am Building This

I am building this because I experienced firsthand how difficult it is to stay informed about local legislation that directly affects daily life. As a Milwaukee student and resident involved in civic life, I watched decisions move through City Hall without meaningful public awareness until after the fact.

I care about transparency, practical governance, and building software that makes civic participation easier for ordinary people. I also want to build things that solve actual structural problems rather than existing as disposable applications.

This is a project that combines the software engineering skills I have developed at MSOE — API integration, data pipelines, LLM tooling, full-stack web development — with a problem I genuinely care about solving in the city I live in.

---

## 16. Tagline Candidates

- Know before the vote.
- Milwaukee government, made understandable.
- Public information you can actually use.
- Transparency that arrives on time.
- City Hall updates for regular people.
- Follow City Hall before it is too late.

---

*Cream City Docket is a project by Kate Thompson. Built in Milwaukee.*
