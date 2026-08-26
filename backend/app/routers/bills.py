from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy.orm import joinedload

from ..database import SessionLocal
from ..models import EventItem, IssueTag, Matter, MatterSponsor, MatterTag, Vote
from .common import EXCLUDED_TYPES, LEGISLATIVE_TYPES, serialize_matter

router = APIRouter()


@router.get("/api/bills")
def list_bills(
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    matter_type: str | None = Query(None),
    status: str | None = Query(None),
    tag: str | None = Query(None),
    sponsored_by: int | None = Query(None),
    legislative_only: bool = Query(False),
    sort: str = Query('urgency'),
    search: str | None = Query(None),
):
    from sqlalchemy import case, or_
    session = SessionLocal()
    try:
        q = session.query(Matter).options(
            joinedload(Matter.sponsors).joinedload(MatterSponsor.alder),
            joinedload(Matter.tags).joinedload(MatterTag.tag),
        )

        if matter_type:
            q = q.filter(Matter.matter_type == matter_type)
        elif legislative_only:
            q = q.filter(Matter.matter_type.in_(LEGISLATIVE_TYPES))
        else:
            q = q.filter(Matter.matter_type.notin_(EXCLUDED_TYPES))

        if status:
            q = q.filter(Matter.matter_status == status)

        if tag:
            q = q.filter(Matter.tags.any(MatterTag.tag.has(IssueTag.name == tag)))

        if sponsored_by:
            q = q.filter(Matter.sponsors.any(MatterSponsor.alder_id == sponsored_by))

        if search:
            pattern = f'%{search}%'
            q = q.filter(or_(
                Matter.title.ilike(pattern),
                Matter.summary.ilike(pattern),
            ))

        total = q.count()

        if sort == 'urgency':
            now = datetime.utcnow()
            week_out = now + timedelta(days=7)
            two_weeks_ago = now - timedelta(days=14)
            urgency_bucket = case(
                (Matter.agenda_date.between(now, week_out), 0),
                (Matter.intro_date >= two_weeks_ago, 1),
                else_=2,
            )
            matters = (
                q.order_by(urgency_bucket, Matter.agenda_date.asc().nullslast(), Matter.intro_date.desc().nullslast(), Matter.id.desc())
                .offset(skip)
                .limit(limit)
                .all()
            )
        else:
            matters = (
                q.order_by(Matter.intro_date.desc().nullslast(), Matter.id.desc())
                .offset(skip)
                .limit(limit)
                .all()
            )

        return {"total": total, "skip": skip, "limit": limit, "items": [serialize_matter(m) for m in matters]}
    finally:
        session.close()


@router.get("/api/bills/{bill_id}")
def get_bill(bill_id: int):
    session = SessionLocal()
    try:
        m = (
            session.query(Matter)
            .options(
                joinedload(Matter.sponsors).joinedload(MatterSponsor.alder),
                joinedload(Matter.history),
                joinedload(Matter.mayor_actions),
                joinedload(Matter.tags).joinedload(MatterTag.tag),
            )
            .filter(Matter.id == bill_id)
            .first()
        )
        if not m:
            raise HTTPException(status_code=404, detail="Bill not found")

        result = serialize_matter(m)
        result["history"] = sorted(
            [
                {
                    "action_name": h.action_name,
                    "action_date": h.action_date.isoformat() if h.action_date else None,
                    "result": h.result,
                }
                for h in m.history
            ],
            key=lambda x: x["action_date"] or "9999",
        )
        result["mayor_actions"] = [
            {
                "action_type": a.action_type,
                "action_date": a.action_date.isoformat() if a.action_date else None,
            }
            for a in m.mayor_actions
        ]
        result["substitute_summary"] = m.substitute_summary
        return result
    finally:
        session.close()


@router.get("/api/bills/{bill_id}/votes")
def get_bill_votes(bill_id: int):
    session = SessionLocal()
    try:
        votes = (
            session.query(Vote)
            .options(
                joinedload(Vote.alder),
                joinedload(Vote.event_item).joinedload(EventItem.event),
            )
            .filter(Vote.matter_id == bill_id)
            .order_by(Vote.voted_at)
            .all()
        )
        return [
            {
                "alder_id": v.alder.id if v.alder else None,
                "alder_name": v.alder.name if v.alder else "Unknown",
                "alder_district": v.alder.district if v.alder else None,
                "vote_value": v.vote_value,
                "voted_at": v.voted_at.isoformat() if v.voted_at else None,
                "event_body_name": (
                    v.event_item.event.body_name
                    if v.event_item and v.event_item.event else None
                ),
                "event_date": (
                    v.event_item.event.date.isoformat()
                    if v.event_item and v.event_item.event and v.event_item.event.date else None
                ),
            }
            for v in votes
        ]
    finally:
        session.close()
