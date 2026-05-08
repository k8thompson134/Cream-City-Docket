"""
Alert dispatcher — runs after each enrichment cycle.
Finds newly enriched matters, matches subscribers, sends alerts, logs to alert_log.
"""
import logging
import os
from datetime import datetime, timedelta

from sqlalchemy.orm import joinedload

from app.database import SessionLocal
from app.models import (
    AlertLog, Alder, IssueTag, Matter, MatterSponsor, MatterTag,
    Subscriber, SubscriberPreference,
)
from notifications.email import send_email
from notifications.templates import alert_email

log = logging.getLogger(__name__)

SITE_URL = os.getenv("SITE_URL", "https://creamcitydocket.com")
TRIGGER_EVENT = "introduced"

# Only dispatch matters enriched within this window to avoid re-processing old data
DISPATCH_WINDOW_HOURS = 2


def _manage_url(token: str) -> str:
    return f"{SITE_URL}/manage/{token}"


def _unsubscribe_url(token: str) -> str:
    return f"{SITE_URL}/manage/{token}?action=unsubscribe"


def _format_date(dt: datetime | None) -> str:
    if not dt:
        return ""
    return dt.strftime("%b %d, %Y").replace(" 0", " ")


def run_dispatcher() -> None:
    session = SessionLocal()
    try:
        since = datetime.utcnow() - timedelta(hours=DISPATCH_WINDOW_HOURS)

        matters = (
            session.query(Matter)
            .options(
                joinedload(Matter.tags).joinedload(MatterTag.tag),
                joinedload(Matter.sponsors).joinedload(MatterSponsor.alder),
            )
            .filter(
                Matter.enriched_at >= since,
                Matter.summary.isnot(None),
            )
            .all()
        )

        if not matters:
            log.info("Dispatcher: no newly enriched matters to dispatch")
            return

        log.info("Dispatcher: checking %d matters", len(matters))

        subscribers = (
            session.query(Subscriber)
            .options(joinedload(Subscriber.preferences))
            .all()
        )

        alerts_sent = 0

        for matter in matters:
            matter_tags = {mt.tag.name for mt in matter.tags if mt.tag}
            sponsor_districts = {
                f"District {s.alder.district}"
                for s in matter.sponsors
                if s.alder and s.alder.district and s.alder.district.isdigit()
            }
            sponsor_names = [
                s.alder.name.replace("ALD. ", "Ald. ").title()
                for s in matter.sponsors if s.alder
            ]

            for subscriber in subscribers:
                already_alerted = session.query(AlertLog).filter_by(
                    subscriber_id=subscriber.id,
                    matter_id=matter.id,
                    trigger_event=TRIGGER_EVENT,
                ).first()
                if already_alerted:
                    continue

                tag_prefs = {
                    p.preference_value
                    for p in subscriber.preferences
                    if p.preference_type == "tag"
                }
                district_prefs = {
                    p.preference_value
                    for p in subscriber.preferences
                    if p.preference_type == "district"
                }

                matched_tags = matter_tags & tag_prefs
                matched_districts = sponsor_districts & district_prefs

                if not matched_tags and not matched_districts:
                    continue

                if matched_tags:
                    trigger_reason = ", ".join(sorted(matched_tags))
                else:
                    trigger_reason = ", ".join(sorted(matched_districts))

                subject, html, text = alert_email(
                    matter_title=matter.title,
                    matter_summary=matter.summary,
                    matter_type=matter.matter_type,
                    matter_status=matter.matter_status,
                    intro_date=_format_date(matter.intro_date),
                    tags=sorted(matter_tags),
                    sponsors=sponsor_names,
                    file_number=matter.file_number,
                    trigger_reason=trigger_reason,
                    manage_url=_manage_url(subscriber.unsubscribe_token),
                    unsubscribe_url=_unsubscribe_url(subscriber.unsubscribe_token),
                )

                sent = send_email(to=subscriber.email, subject=subject, html=html, text=text)
                if sent:
                    session.add(AlertLog(
                        subscriber_id=subscriber.id,
                        matter_id=matter.id,
                        trigger_event=TRIGGER_EVENT,
                    ))
                    alerts_sent += 1

        session.commit()
        log.info("Dispatcher: sent %d alerts", alerts_sent)

    except Exception as e:
        session.rollback()
        log.exception("Dispatcher failed: %s", e)
    finally:
        session.close()
