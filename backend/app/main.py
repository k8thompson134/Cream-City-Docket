import os
import re
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import joinedload

from .database import SessionLocal
from .models import Alder, AlderElectionRecord, AlderOfficeRecord, Event, EventItem, IssueTag, Matter, MatterSponsor, MatterTag, MayorAction, Subscriber, SubscriberPreference, Vote


@asynccontextmanager
async def lifespan(app: FastAPI):
    from scheduler import start_scheduler, stop_scheduler
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="Cream City Docket API", lifespan=lifespan)

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "https://creamcitydocket.com",
    "https://www.creamcitydocket.com",
]
if extra := os.getenv("CORS_ORIGINS"):
    ALLOWED_ORIGINS += [o.strip() for o in extra.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
)

EXCLUDED_TYPES = {
    "Communication", "Fire and Police Communication",
    "Communication to Finance", "APPEAL", "Motion", "Claim", "Settlement",
}

LEGISLATIVE_TYPES = {
    "Ordinance", "Charter Ordinance", "Charter Ordinance-Zoning",
    "Resolution", "Resolution-Immediate Adoption",
}


def _serialize_matter(m: Matter) -> dict:
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
    }


@app.get("/api/bills")
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
                joinedload(Matter.tags).joinedload(MatterTag.tag),
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


@app.get("/api/bills/{bill_id}/votes")
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


@app.get("/api/upcoming")
def get_upcoming():
    """Bills with agenda dates in the next 14 days, ordered soonest first."""
    session = SessionLocal()
    try:
        now = datetime.utcnow()
        cutoff = now + timedelta(days=14)
        matters = (
            session.query(Matter)
            .options(
                joinedload(Matter.sponsors).joinedload(MatterSponsor.alder),
                joinedload(Matter.tags).joinedload(MatterTag.tag),
            )
            .filter(
                Matter.agenda_date >= now,
                Matter.agenda_date <= cutoff,
                Matter.matter_type.notin_(EXCLUDED_TYPES),
                ~Matter.title.ilike('%meeting minutes%'),
                ~Matter.title.ilike('%official record%'),
            )
            .order_by(Matter.agenda_date.asc())
            .limit(6)
            .all()
        )
        return [_serialize_matter(m) for m in matters]
    finally:
        session.close()


@app.get("/api/mayor")
def get_mayor():
    session = SessionLocal()
    try:
        actions = (
            session.query(MayorAction)
            .options(
                joinedload(MayorAction.matter).joinedload(Matter.tags).joinedload(MatterTag.tag),
                joinedload(MayorAction.matter).joinedload(Matter.sponsors).joinedload(MatterSponsor.alder),
            )
            .filter(MayorAction.matter_id.isnot(None))
            .order_by(MayorAction.action_date.desc().nullslast())
            .all()
        )

        stats: dict[str, int] = {"signed": 0, "vetoed": 0, "lapsed": 0, "published": 0}
        serialized = []
        for a in actions:
            t = a.action_type.lower()
            if t in stats:
                stats[t] += 1
            if a.matter:
                serialized.append({
                    "action_type": a.action_type,
                    "action_date": a.action_date.isoformat() if a.action_date else None,
                    "matter": _serialize_matter(a.matter),
                })

        return {
            "name": "Cavalier Johnson",
            "title": "Mayor of Milwaukee",
            "photo_url": "/mayor-johnson.jpg",
            "bio": (
                "Mayor Cavalier Johnson took office as Acting Mayor in late 2021 and was elected the "
                "forty-fifth chief executive of the City of Milwaukee in April 2022, winning with more "
                "than seventy percent of the vote. He is the first Black Mayor elected in the city and "
                "only the fourth elected mayor in the past sixty-two years. Before taking on his role "
                "as Acting Mayor, Johnson served as Common Council President while representing the "
                "city's 2nd Aldermanic District. He has prioritized violence reduction, economic "
                "development, and roadway safety."
            ),
            "address": "City Hall, 200 E. Wells Street, Room 201, Milwaukee, WI 53202",
            "phone": "414-286-2200",
            "hours": "Monday–Friday, 8:00 AM–4:45 PM",
            "twitter": "@MayorMKE",
            "facebook": "https://www.facebook.com/MayorofMilwaukee",
            "stats": stats,
            "actions": serialized,
        }
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
        tags = [row[0] for row in session.query(IssueTag.name).order_by(IssueTag.name).all()]
        from .models import PollLog
        last_poll = session.query(PollLog).filter_by(success=True).order_by(PollLog.polled_at.desc()).first()
        last_synced = last_poll.polled_at.isoformat() if last_poll else None
        return {"matter_types": types, "statuses": statuses, "tags": tags, "last_synced": last_synced}
    finally:
        session.close()


@app.get("/api/alders")
def list_alders():
    session = SessionLocal()
    try:
        from sqlalchemy import cast, Integer, case, func
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        seven_days_ago = datetime.utcnow() - timedelta(days=7)

        alders = (
            session.query(Alder)
            .filter(Alder.active == True)
            .order_by(
                case((Alder.district.regexp_match(r'^\d+$'), cast(Alder.district, Integer)), else_=999),
                Alder.name,
            )
            .all()
        )

        # Recent activity counts per alder
        recent_bills = dict(
            session.query(MatterSponsor.alder_id, func.count())
            .join(Matter, MatterSponsor.matter_id == Matter.id)
            .filter(Matter.intro_date >= thirty_days_ago)
            .group_by(MatterSponsor.alder_id)
            .all()
        )
        recent_votes = dict(
            session.query(Vote.alder_id, func.count())
            .filter(Vote.voted_at >= seven_days_ago)
            .group_by(Vote.alder_id)
            .all()
        )

        return [
            {
                "id": a.id,
                "legistar_person_id": a.legistar_person_id,
                "name": a.name,
                "district": a.district,
                "email": a.email,
                "phone": a.phone,
                "photo_url": a.photo_url,
                "recent_bills": recent_bills.get(a.id, 0),
                "recent_votes": recent_votes.get(a.id, 0),
            }
            for a in alders
        ]
    finally:
        session.close()


@app.get("/api/alders/{alder_id}")
def get_alder(alder_id: int):
    session = SessionLocal()
    try:
        a = session.query(Alder).filter(Alder.id == alder_id).first()
        if not a:
            raise HTTPException(status_code=404, detail="Alder not found")

        sponsor_entries = (
            session.query(MatterSponsor)
            .options(
                joinedload(MatterSponsor.matter).joinedload(Matter.tags).joinedload(MatterTag.tag),
                joinedload(MatterSponsor.matter).joinedload(Matter.sponsors).joinedload(MatterSponsor.alder),
            )
            .filter(MatterSponsor.alder_id == a.id)
            .all()
        )

        seen = set()
        sponsored_bills = []
        for s in sponsor_entries:
            if s.matter and s.matter_id not in seen:
                seen.add(s.matter_id)
                sponsored_bills.append(s.matter)

        sponsored_bills.sort(key=lambda m: m.intro_date or datetime.min, reverse=True)

        votes = (
            session.query(Vote)
            .options(
                joinedload(Vote.event_item).joinedload(EventItem.event),
                joinedload(Vote.matter).joinedload(Matter.tags).joinedload(MatterTag.tag),
                joinedload(Vote.matter).joinedload(Matter.sponsors).joinedload(MatterSponsor.alder),
            )
            .filter(Vote.alder_id == a.id, Vote.matter_id.isnot(None))
            .order_by(Vote.voted_at.desc().nullslast())
            .all()
        )

        vote_history = [
            {
                "vote_value": v.vote_value,
                "voted_at": v.voted_at.isoformat() if v.voted_at else None,
                "matter": _serialize_matter(v.matter),
            }
            for v in votes if v.matter
        ]

        # Tag ranks: how does this alder compare to others per issue area?
        from sqlalchemy import func as sqlfunc, distinct as sqldistinct
        my_tag_counts = {}
        for bill in sponsored_bills:
            for mt in bill.tags:
                if mt.tag:
                    my_tag_counts[mt.tag.name] = my_tag_counts.get(mt.tag.name, 0) + 1

        tag_ranks = {}
        if my_tag_counts:
            all_tag_counts = (
                session.query(
                    IssueTag.name,
                    MatterSponsor.alder_id,
                    sqlfunc.count(sqldistinct(MatterTag.matter_id)).label("cnt"),
                )
                .join(MatterTag, MatterTag.tag_id == IssueTag.id)
                .join(MatterSponsor, MatterSponsor.matter_id == MatterTag.matter_id)
                .filter(IssueTag.name.in_(list(my_tag_counts.keys())))
                .group_by(IssueTag.name, MatterSponsor.alder_id)
                .all()
            )
            tag_count_lists: dict[str, list[int]] = {}
            for tag_name, _, cnt in all_tag_counts:
                tag_count_lists.setdefault(tag_name, []).append(cnt)

            for tag_name, my_count in my_tag_counts.items():
                counts = sorted(tag_count_lists.get(tag_name, [my_count]), reverse=True)
                rank = sum(1 for c in counts if c > my_count) + 1
                tag_ranks[tag_name] = {"rank": rank, "total": len(counts)}

        now = datetime.utcnow()

        def _serialize_office_record(r: AlderOfficeRecord) -> dict:
            return {
                "body_name": r.body_name,
                "title": r.title,
                "start_date": r.start_date.isoformat() if r.start_date else None,
                "end_date": r.end_date.isoformat() if r.end_date else None,
                "is_current": r.end_date is None or r.end_date > now,
            }

        COUNCIL_BODY_KEYWORDS = {"common council", "city council"}

        def _is_council_seat(r: AlderOfficeRecord) -> bool:
            body = (r.body_name or "").lower()
            return any(kw in body for kw in COUNCIL_BODY_KEYWORDS)

        office_records = (
            session.query(AlderOfficeRecord)
            .filter_by(alder_id=a.id)
            .order_by(AlderOfficeRecord.start_date.desc().nullslast())
            .all()
        )

        council_terms = [_serialize_office_record(r) for r in office_records if _is_council_seat(r)]
        committee_roles = [_serialize_office_record(r) for r in office_records if not _is_council_seat(r)]

        election_records = (
            session.query(AlderElectionRecord)
            .filter_by(alder_id=a.id)
            .order_by(AlderElectionRecord.year.desc(), AlderElectionRecord.election_type.asc())
            .all()
        )

        return {
            "id": a.id,
            "legistar_person_id": a.legistar_person_id,
            "name": a.name,
            "district": a.district,
            "email": a.email,
            "phone": a.phone,
            "photo_url": a.photo_url,
            "website": a.website,
            "twitter": a.twitter,
            "facebook": a.facebook,
            "sponsored_bills": [_serialize_matter(m) for m in sponsored_bills],
            "vote_history": vote_history,
            "tag_ranks": tag_ranks,
            "council_terms": council_terms,
            "committee_roles": committee_roles,
            "election_records": [
                {
                    "year": r.year,
                    "election_type": r.election_type,
                    "result": r.result,
                    "vote_pct": float(r.vote_pct) if r.vote_pct is not None else None,
                    "opponent_count": r.opponent_count,
                    "was_uncontested": r.was_uncontested,
                    "notes": r.notes,
                }
                for r in election_records
            ],
        }
    finally:
        session.close()


class SubscribeRequest(BaseModel):
    email: str
    tags: list[str] = []
    district: str | None = None
    mayor_actions: bool = False


@app.post("/api/subscriptions")
def create_subscription(body: SubscribeRequest):
    if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', body.email):
        raise HTTPException(status_code=422, detail="Invalid email address")
    if not body.tags and not body.district:
        raise HTTPException(status_code=422, detail="Select at least one issue area or district")

    session = SessionLocal()
    try:
        sub = session.query(Subscriber).filter(Subscriber.email == body.email).first()
        if sub:
            session.query(SubscriberPreference).filter(
                SubscriberPreference.subscriber_id == sub.id
            ).delete()
        else:
            sub = Subscriber(email=body.email, unsubscribe_token=secrets.token_hex(32))
            session.add(sub)
            session.flush()

        for tag in body.tags:
            session.add(SubscriberPreference(
                subscriber_id=sub.id,
                preference_type="tag",
                preference_value=tag,
            ))
        if body.district:
            session.add(SubscriberPreference(
                subscriber_id=sub.id,
                preference_type="district",
                preference_value=body.district,
            ))
        if body.mayor_actions:
            session.add(SubscriberPreference(
                subscriber_id=sub.id,
                preference_type="mayor_actions",
                preference_value="true",
            ))

        session.commit()

        # Send confirmation email (best-effort — don't fail the request if it errors)
        try:
            import os
            from notifications.email import send_email
            from notifications.templates import confirmation_email
            site_url = os.getenv("SITE_URL", "https://creamcitydocket.com")
            manage_url = f"{site_url}/manage/{sub.unsubscribe_token}"
            unsubscribe_url = f"{site_url}/manage/{sub.unsubscribe_token}?action=unsubscribe"
            subj, html, text = confirmation_email(
                tags=body.tags,
                district=body.district,
                manage_url=manage_url,
                unsubscribe_url=unsubscribe_url,
            )
            send_email(to=sub.email, subject=subj, html=html, text=text)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error("Confirmation email failed: %s", e)

        return {"ok": True}
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@app.get("/api/subscriptions/{token}")
def get_subscription(token: str):
    session = SessionLocal()
    try:
        sub = session.query(Subscriber).filter_by(unsubscribe_token=token).first()
        if not sub:
            raise HTTPException(status_code=404, detail="Subscription not found")
        return {
            "email": sub.email,
            "tags": [p.preference_value for p in sub.preferences if p.preference_type == "tag"],
            "district": next((p.preference_value for p in sub.preferences if p.preference_type == "district"), None),
            "mayor_actions": any(p.preference_type == "mayor_actions" for p in sub.preferences),
        }
    finally:
        session.close()


class UpdateSubscriptionRequest(BaseModel):
    tags: list[str] = []
    district: str | None = None


@app.patch("/api/subscriptions/{token}")
def update_subscription(token: str, body: UpdateSubscriptionRequest):
    if not body.tags and not body.district:
        raise HTTPException(status_code=422, detail="Select at least one issue area or district")
    session = SessionLocal()
    try:
        sub = session.query(Subscriber).filter_by(unsubscribe_token=token).first()
        if not sub:
            raise HTTPException(status_code=404, detail="Subscription not found")
        session.query(SubscriberPreference).filter_by(subscriber_id=sub.id).delete()
        for tag in body.tags:
            session.add(SubscriberPreference(subscriber_id=sub.id, preference_type="tag", preference_value=tag))
        if body.district:
            session.add(SubscriberPreference(subscriber_id=sub.id, preference_type="district", preference_value=body.district))
        session.commit()
        return {"ok": True}
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@app.delete("/api/subscriptions/{token}")
def delete_subscription(token: str):
    session = SessionLocal()
    try:
        sub = session.query(Subscriber).filter_by(unsubscribe_token=token).first()
        if not sub:
            raise HTTPException(status_code=404, detail="Subscription not found")
        session.query(SubscriberPreference).filter_by(subscriber_id=sub.id).delete()
        session.delete(sub)
        session.commit()
        return {"ok": True}
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
