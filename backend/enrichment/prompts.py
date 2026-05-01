ISSUE_TAXONOMY = [
    "Housing",
    "Food Access",
    "Policing and Public Safety",
    "Labor",
    "Immigration",
    "Transportation",
    "Environment",
    "Education",
    "Healthcare",
    "Small Business",
    "Budget and Finance",
    "Land Use and Zoning",
    "Other",
]

SUMMARY_SYSTEM = """You summarize Milwaukee city legislation for everyday residents.
Write clearly at an 8th grade reading level. Be factual and neutral — no opinion or advocacy.
Focus on what the legislation actually does and who it affects.
Do not start with "This ordinance" or "This resolution" — vary your openings.
Write 2–3 sentences maximum."""

SUMMARY_USER = """Summarize this Milwaukee {matter_type} in plain English:

Title: {title}

Full text:
{text}"""

TAGS_SYSTEM = f"""You categorize Milwaukee city legislation into issue areas.
Return ONLY a JSON array of 1–3 tags chosen from this exact list:
{ISSUE_TAXONOMY}
No other tags. No explanation. Just the JSON array."""

TAGS_USER = """Categorize this Milwaukee legislation:

Title: {title}

Text (excerpt):
{text_excerpt}"""
