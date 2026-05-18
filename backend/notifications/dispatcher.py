"""
Alert dispatcher — runs after each enrichment cycle.
Finds newly enriched or recently changed matters, matches subscribers,
sends trigger-appropriate alerts, and logs to alert_log.

Trigger types:
  introduced         — matter enriched for the first time
  hearing_scheduled  — agenda_date set within next 14 days, matter recently changed
  council_vote       — status moved to an In Council* status, matter recently changed
  mayor_signed       — mayor signed, matter recently changed
  mayor_vetoed       — mayor vetoed, matter recently changed
"""
import logging
import os
from datetime import datetime, timedelta

from sqlalchemy import or_
from sqlalchemy.orm import joinedload

from app.database import SessionLocal
from app.models import (
    AlertLog, Matter, MatterSponsor, MatterTag,
    MayorAction, Subscriber,
)
from notifications.email import send_email
from notifications.templates import alert_email

log = logging.getLogger(__name__)

SITE_URL = os.getenv("SITE_URL", "https://creamcitydocket.com")
DISPATCH_WINDOW_HOURS = 2
HEARING_LOOKAHEAD_DAYS = 14

COUNCIL_VOTE_STATUSES = {
    "In Council",
    "In Council-Adoption",
    "In Council-Passage",
    "In Council-Confirmation",
    "In Council-Approval",
}


def _manage_url(token: str) -> str:
    return f"{SITE_URL}/manage/{token}"


def _unsubscribe_url(token: str) -> str:
    return f"{SITE_URL}/manage/{token}?action=unsubscribe"


def _format_date(dt: datetime | None) -> str:
    if not dt:
        return ""
    return dt.strftime("%b %d, %Y").replace(" 0", " ")


def _already_sent(session, subscriber_id: int, matter_id: int, trigger: str) -> bool:
    return (
        session.query(AlertLog)
        .filter_by(subscriber_id=subscriber_id, matter_id=matter_id, trigger_event=trigger)
        .first()
    ) is not None


def _active_triggers(matter: Matter, since: datetime, now: datetime) -> list[str]:
    """Return which trigger events apply to this matter right now."""
    triggers = []

    if matter.enriched_at and matter.enriched_at >= since:
        triggers.append("introduced")

    recently_changed = matter.last_modified_utc and matter.last_modified_utc >= since

    if recently_changed:
        if (
            matter.agenda_date
            and matter.agenda_date >= now
            and matter.agenda_date <= now + timedelta(days=HEARING_LOOKAHEAD_DAYS)
        ):
            triggers.append("hearing_scheduled")

        if matter.matter_status in COUNCIL_VOTE_STATUSES:
            triggers.append("council_vote")

        for action in matter.mayor_actions:
            if action.action_type == "signed":
                triggers.append("mayor_signed")
            elif action.action_type == "vetoed":
                triggers.append("mayor_vetoed")

    return triggers


def run_dispatcher() -> None:
    session = SessionLocal()
    try:
        now = datetime.utcnow()
        since = now - timedelta(hours=DISPATCH_WINDOW_HOURS)

        matters = (
            session.query(Matter)
            .options(
                joinedload(Matter.tags).joinedload(MatterTag.tag),
                joinedload(Matter.sponsors).joinedload(MatterSponsor.alder),
                joinedload(Matter.mayor_actions),
            )
            .filter(
                Matter.summary.isnot(None),
                or_(
                    Matter.enriched_at >= since,
                    Matter.last_modified_utc >= since,
                ),
            )
            .all()
        )

        if not matters:
            log.info("Dispatcher: no matters to check")
            return

        log.info("Dispatcher: checking %d matters", len(matters))

        subscribers = (
            session.query(Subscriber)
            .options(joinedload(Subscriber.preferences))
            .all()
        )

        alerts_sent = 0

        for matter in matters:
            triggers = _active_triggers(matter, since, now)
            if not triggers:
                continue

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
                wants_mayor_alerts = any(
                    p.preference_type == "mayor_actions" for p in subscriber.preferences
                )

                mayor_triggers = {t for t in triggers if t in ("mayor_signed", "mayor_vetoed")}
                non_mayor_triggers = {t for t in triggers if t not in ("mayor_signed", "mayor_vetoed")}

                # Skip if subscriber has no matching interest
                has_match = matched_tags or matched_districts
                has_mayor_match = wants_mayor_alerts and mayor_triggers
                if not has_match and not has_mayor_match:
                    continue

                # Only send non-mayor triggers if tag/district matches
                active_triggers = set()
                if has_match:
                    active_triggers |= non_mayor_triggers
                    active_triggers |= mayor_triggers  # also send mayor if tag matched
                if has_mayor_match:
                    active_triggers |= mayor_triggers

                if not active_triggers:
                    continue

                trigger_reason = (
                    ", ".join(sorted(matched_tags))
                    if matched_tags
                    else ", ".join(sorted(matched_districts)) if matched_districts
                    else "mayor actions"
                )

                for trigger in active_triggers:
                    if _already_sent(session, subscriber.id, matter.id, trigger):
                        continue

                    mayor_action = None
                    if trigger in ("mayor_signed", "mayor_vetoed"):
                        action_type = "signed" if trigger == "mayor_signed" else "vetoed"
                        mayor_action = next(
                            (a for a in matter.mayor_actions if a.action_type == action_type),
                            None,
                        )

                    subject, html, text = alert_email(
                        trigger_event=trigger,
                        matter_title=matter.title,
                        matter_summary=matter.summary,
                        matter_type=matter.matter_type,
                        matter_status=matter.matter_status,
                        intro_date=_format_date(matter.intro_date),
                        agenda_date=_format_date(matter.agenda_date),
                        mayor_action_date=_format_date(
                            mayor_action.action_date if mayor_action else None
                        ),
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
                            trigger_event=trigger,
                        ))
                        alerts_sent += 1

        session.commit()
        log.info("Dispatcher: sent %d alerts", alerts_sent)

    except Exception as e:
        session.rollback()
        log.exception("Dispatcher failed: %s", e)
    finally:
        session.close()
