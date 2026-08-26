from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import joinedload

from ..database import SessionLocal
from ..models import Alder, AlderElectionRecord, AlderOfficeRecord, EventItem, IssueTag, Matter, MatterSponsor, MatterTag, Vote
from .common import serialize_matter

router = APIRouter()


@router.get("/api/alders")
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


@router.get("/api/alders/{alder_id}")
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

        seen_vote_keys: set[tuple] = set()
        vote_history = []
        for v in votes:
            if not v.matter:
                continue
            key = (v.matter_id, v.voted_at)
            if key in seen_vote_keys:
                continue
            seen_vote_keys.add(key)
            vote_history.append({
                "vote_value": v.vote_value,
                "voted_at": v.voted_at.isoformat() if v.voted_at else None,
                "matter": serialize_matter(v.matter),
            })

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
            "focus_summary": a.focus_summary,
            "sponsored_bills": [serialize_matter(m) for m in sponsored_bills],
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
