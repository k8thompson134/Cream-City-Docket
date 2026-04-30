from datetime import datetime
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import joinedload

from .database import SessionLocal
from .models import Matter, MatterSponsor

app = FastAPI(title="Cream City Docket API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

EXCLUDED_TYPES = {
    "Communication", "Fire and Police Communication",
    "Communication to Finance", "APPEAL", "Motion", "Claim", "Settlement",
}


def _serialize_matter(m: Matter) -> dict:
    sponsors = [
        {"name": s.alder.name, "district": s.alder.district}
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
        "file_number": m.file_number,
        "title": m.title,
        "matter_type": m.matter_type,
        "matter_status": m.matter_status,
        "body_name": m.body_name,
        "intro_date": m.intro_date.isoformat() if m.intro_date else None,
        "passed_date": m.passed_date.isoformat() if m.passed_date else None,
        "sponsors": unique_sponsors,
        "summary": m.summary,
    }


@app.get("/api/bills")
def list_bills(
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    matter_type: str | None = Query(None),
    status: str | None = Query(None),
):
    session = SessionLocal()
    try:
        q = session.query(Matter).options(
            joinedload(Matter.sponsors).joinedload(MatterSponsor.alder)
        )

        if matter_type:
            q = q.filter(Matter.matter_type == matter_type)
        else:
            q = q.filter(Matter.matter_type.notin_(EXCLUDED_TYPES))

        if status:
            q = q.filter(Matter.matter_status == status)

        total = q.count()
        matters = (
            q.order_by(Matter.intro_date.desc().nullslast(), Matter.id.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        return {"total": total, "skip": skip, "limit": limit, "items": [_serialize_matter(m) for m in matters]}
    finally:
        session.close()


@app.get("/api/bills/{bill_id}")
def get_bill(bill_id: int):
    session = SessionLocal()
    try:
        m = (
            session.query(Matter)
            .options(
                joinedload(Matter.sponsors).joinedload(MatterSponsor.alder),
                joinedload(Matter.history),
                joinedload(Matter.mayor_actions),
            )
            .filter(Matter.id == bill_id)
            .first()
        )
        if not m:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Bill not found")

        result = _serialize_matter(m)
        result["history"] = sorted(
            [
                {
                    "action_name": h.action_name,
                    "action_date": h.action_date.isoformat() if h.action_date else None,
                    "result": h.result,
                }
                for h in m.history
            ],
            key=lambda x: x["action_date"] or "",
        )
        result["mayor_actions"] = [
            {
                "action_type": a.action_type,
                "action_date": a.action_date.isoformat() if a.action_date else None,
            }
            for a in m.mayor_actions
        ]
        return result
    finally:
        session.close()


@app.get("/api/meta")
def get_meta():
    """Returns distinct matter types and statuses for filter dropdowns."""
    session = SessionLocal()
    try:
        types = [
            row[0] for row in
            session.query(Matter.matter_type).filter(
                Matter.matter_type.notin_(EXCLUDED_TYPES)
            ).distinct().order_by(Matter.matter_type).all()
        ]
        statuses = [
            row[0] for row in
            session.query(Matter.matter_status).distinct().order_by(Matter.matter_status).all()
        ]
        return {"matter_types": types, "statuses": statuses}
    finally:
        session.close()
