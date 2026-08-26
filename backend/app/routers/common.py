"""Shared constants/helpers used across route modules."""

from ..models import Matter

EXCLUDED_TYPES = {
    "Communication", "Fire and Police Communication",
    "Communication to Finance", "APPEAL", "Motion", "Claim", "Settlement",
}

LEGISLATIVE_TYPES = {
    "Ordinance", "Charter Ordinance", "Charter Ordinance-Zoning",
    "Resolution", "Resolution-Immediate Adoption",
}


def serialize_matter(m: Matter) -> dict:
    sponsors = [
        {
            "id": s.alder.id,
            "name": s.alder.name,
            "district": s.alder.district,
            "email": s.alder.email,
            "phone": s.alder.phone,
        }
        for s in m.sponsors if s.alder
    ]
    # Deduplicate sponsors (multiple versions can repeat same alder)
    seen = set()
    unique_sponsors = []
    for s in sponsors:
        if s["name"] not in seen:
            seen.add(s["name"])
            unique_sponsors.append(s)

    return {
        "id": m.id,
        "legistar_matter_id": m.legistar_matter_id,
        "legistar_guid": m.legistar_guid,
        "file_number": m.file_number,
        "title": m.title,
        "matter_type": m.matter_type,
        "matter_status": m.matter_status,
        "body_name": m.body_name,
        "intro_date": m.intro_date.isoformat() if m.intro_date else None,
        "agenda_date": m.agenda_date.isoformat() if m.agenda_date else None,
        "passed_date": m.passed_date.isoformat() if m.passed_date else None,
        "sponsors": unique_sponsors,
        "summary": m.summary,
        "tags": [mt.tag.name for mt in m.tags if mt.tag],
        "legistar_web_url": m.legistar_web_url,
    }
