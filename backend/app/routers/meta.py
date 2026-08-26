import os
from datetime import datetime, timedelta

from fastapi import APIRouter
from fastapi.responses import Response
from sqlalchemy.orm import joinedload

from ..database import SessionLocal
from ..models import Alder, IssueTag, Matter, MatterSponsor, MatterTag, Mayor, MayorAction, PollLog
from .common import EXCLUDED_TYPES, serialize_matter

router = APIRouter()


@router.get("/api/upcoming")
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
        return [serialize_matter(m) for m in matters]
    finally:
        session.close()


@router.get("/api/mayor")
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

        stats: dict[str, int] = {"signed": 0, "vetoed": 0, "veto_overridden": 0, "lapsed": 0, "published": 0}
        serialized = []
        for a in actions:
            t = a.action_type.lower()
            if t in stats:
                stats[t] += 1
            if a.matter:
                serialized.append({
                    "action_type": a.action_type,
                    "action_date": a.action_date.isoformat() if a.action_date else None,
                    "matter": serialize_matter(a.matter),
                })

        mayor = session.query(Mayor).filter_by(active=True).first()

        return {
            "name": mayor.name if mayor else None,
            "title": mayor.title if mayor else None,
            "photo_url": mayor.photo_url if mayor else None,
            "bio": mayor.bio if mayor else None,
            "address": mayor.address if mayor else None,
            "phone": mayor.phone if mayor else None,
            "hours": mayor.hours if mayor else None,
            "twitter": mayor.twitter if mayor else None,
            "facebook": mayor.facebook if mayor else None,
            "stats": stats,
            "actions": serialized,
        }
    finally:
        session.close()


@router.get("/api/meta")
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
        last_poll = session.query(PollLog).filter_by(success=True).order_by(PollLog.polled_at.desc()).first()
        last_synced = last_poll.polled_at.isoformat() if last_poll else None
        return {"matter_types": types, "statuses": statuses, "tags": tags, "last_synced": last_synced}
    finally:
        session.close()


@router.get("/sitemap.xml")
def sitemap():
    """XML sitemap for search engines. Mirrors the same visibility rules as the
    public feed (GET /api/bills) — excluded matter types stay out of the sitemap."""
    site_url = os.getenv("SITE_URL", "https://creamcitydocket.com")
    session = SessionLocal()
    try:
        static_paths = ["/", "/alders", "/mayor", "/about", "/subscribe"]

        matters = (
            session.query(Matter.id, Matter.updated_at)
            .filter(
                Matter.summary.isnot(None),
                Matter.matter_type.notin_(EXCLUDED_TYPES),
            )
            .all()
        )
        alders = session.query(Alder.id, Alder.updated_at).filter_by(active=True).all()

        urls = [(path, None) for path in static_paths]
        urls += [(f"/bills/{m.id}", m.updated_at) for m in matters]
        urls += [(f"/alders/{a.id}", a.updated_at) for a in alders]

        entries = "\n".join(
            f"  <url>\n    <loc>{site_url}{path}</loc>\n"
            + (f"    <lastmod>{lastmod.date().isoformat()}</lastmod>\n" if lastmod else "")
            + "  </url>"
            for path, lastmod in urls
        )
        xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            f"{entries}\n"
            "</urlset>"
        )
        return Response(content=xml, media_type="application/xml")
    finally:
        session.close()
