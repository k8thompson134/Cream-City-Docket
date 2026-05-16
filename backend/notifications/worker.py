"""
Notification worker — digest and priority alert pipeline.

Flow:
1. After each poll, `queue_notifications()` checks new/updated matters
   against subscriber preferences and enqueues matches into NotificationQueue.
2. Priority matches (tags in subscriber's priority_tags list) are sent
   immediately as individual emails.
3. Digest items accumulate in the queue and are flushed by
   `send_digests("daily")` or `send_digests("weekly")` on schedule.

Run directly:
  python -m notifications.worker queue        # process new matters
  python -m notifications.worker digest-daily  # flush daily digests
  python -m notifications.worker digest-weekly # flush weekly digests
"""
import logging
import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.database import SessionLocal
from app.models import (
    AlertLog, Matter, MatterTag, NotificationQueue, Subscriber,
    SubscriberPreference, IssueTag,
)
from notifications.templates import render_digest_email, render_priority_email
from notifications.email import send_email

log = logging.getLogger("notifications")


def _get_subscriber_tag_names(session, subscriber: Subscriber) -> set[str]:
    """Return the set of tag names a subscriber is tracking."""
    return {
        p.preference_value
        for p in subscriber.preferences
        if p.preference_type == "tag"
    }


def _get_subscriber_districts(session, subscriber: Subscriber) -> set[str]:
    """Return the set of districts a subscriber is tracking."""
    return {
        p.preference_value
        for p in subscriber.preferences
        if p.preference_type == "district"
    }


def _matter_matches_subscriber(
    matter: Matter,
    tag_names: set[str],
    districts: set[str],
) -> bool:
    """Check if a matter matches any of the subscriber's tracked tags or districts."""
    # Match on tags
    matter_tags = {mt.tag.name for mt in matter.tags if mt.tag}
    if matter_tags & tag_names:
        return True

    # Match on sponsor district
    for sponsor in matter.sponsors:
        if sponsor.alder and sponsor.alder.district in districts:
            return True

    return False


def _is_priority_for_subscriber(
    matter: Matter,
    subscriber: Subscriber,
    districts: set[str],
) -> bool:
    """Determine if a matter should trigger an immediate priority alert."""
    priority_tags = set(subscriber.priority_tags or [])
    if not priority_tags and not subscriber.priority_district:
        return False

    # Check tag-based priority
    matter_tags = {mt.tag.name for mt in matter.tags if mt.tag}
    if matter_tags & priority_tags:
        return True

    # Check district-based priority
    if subscriber.priority_district and districts:
        for sponsor in matter.sponsors:
            if sponsor.alder and sponsor.alder.district in districts:
                return True

    return False


def _unsubscribe_url(subscriber: Subscriber) -> str:
    base = os.getenv("SITE_URL", "https://creamcitydocket.com")
    return f"{base}/subscribe?token={subscriber.unsubscribe_token}"


def queue_notifications(since_minutes: int = 65) -> dict:
    """Check recently updated matters and enqueue notifications for matching subscribers.

    Args:
        since_minutes: Look back this many minutes for updated matters.
                       Default 65 gives 5 min overlap with the hourly poll.

    Returns:
        Dict with counts: {checked, queued, priority_sent, skipped}
    """
    session = SessionLocal()
    counts = {"checked": 0, "queued": 0, "priority_sent": 0, "skipped": 0}

    try:
        cutoff = datetime.utcnow() - timedelta(minutes=since_minutes)

        # Get recently updated matters (ones the poller just touched)
        matters = (
            session.query(Matter)
            .filter(Matter.updated_at >= cutoff)
            .all()
        )
        log.info("Checking %d recently updated matters for notifications", len(matters))

        # Get all active subscribers with their preferences eagerly loaded
        subscribers = (
            session.query(Subscriber)
            .filter(Subscriber.active == True)
            .all()
        )

        if not subscribers:
            log.info("No active subscribers — skipping notification queue")
            return counts

        for matter in matters:
            counts["checked"] += 1
            trigger_event = "updated"  # Default trigger

            # Determine trigger type from matter state
            if matter.created_at and matter.created_at >= cutoff:
                trigger_event = "introduced"
            elif matter.passed_date and matter.passed_date >= cutoff:
                trigger_event = "passed"
            elif matter.agenda_date and matter.agenda_date >= cutoff:
                trigger_event = "hearing_scheduled"

            for subscriber in subscribers:
                tag_names = _get_subscriber_tag_names(session, subscriber)
                districts = _get_subscriber_districts(session, subscriber)

                if not _matter_matches_subscriber(matter, tag_names, districts):
                    counts["skipped"] += 1
                    continue

                # Check if we already notified this subscriber about this matter+event
                already_queued = session.query(NotificationQueue).filter_by(
                    subscriber_id=subscriber.id,
                    matter_id=matter.id,
                    trigger_event=trigger_event,
                ).first()
                already_sent = session.query(AlertLog).filter_by(
                    subscriber_id=subscriber.id,
                    matter_id=matter.id,
                    trigger_event=trigger_event,
                ).first()
                if already_queued or already_sent:
                    counts["skipped"] += 1
                    continue

                is_priority = _is_priority_for_subscriber(matter, subscriber, districts)

                # Priority items: send immediately regardless of digest mode
                if is_priority and subscriber.digest_mode != "immediate":
                    try:
                        subject, html, text = render_priority_email(
                            matter, trigger_event, _unsubscribe_url(subscriber)
                        )
                        send_email(to=subscriber.email, subject=subject, html=html, text=text)
                        session.add(AlertLog(
                            subscriber_id=subscriber.id,
                            matter_id=matter.id,
                            trigger_event=trigger_event,
                            delivery_type="immediate",
                        ))
                        counts["priority_sent"] += 1
                        log.info("Priority alert sent to %s for matter %d",
                                 subscriber.email, matter.legistar_matter_id)
                    except Exception as e:
                        log.error("Failed to send priority alert to %s: %s",
                                  subscriber.email, e)
                    continue

                # Immediate mode subscribers get everything right away
                if subscriber.digest_mode == "immediate":
                    try:
                        subject, html, text = render_priority_email(
                            matter, trigger_event, _unsubscribe_url(subscriber)
                        )
                        send_email(to=subscriber.email, subject=subject, html=html, text=text)
                        session.add(AlertLog(
                            subscriber_id=subscriber.id,
                            matter_id=matter.id,
                            trigger_event=trigger_event,
                            delivery_type="immediate",
                        ))
                        counts["priority_sent"] += 1
                    except Exception as e:
                        log.error("Failed to send immediate alert to %s: %s",
                                  subscriber.email, e)
                    continue

                # Otherwise, queue for digest
                session.add(NotificationQueue(
                    subscriber_id=subscriber.id,
                    matter_id=matter.id,
                    trigger_event=trigger_event,
                    is_priority=is_priority,
                ))
                counts["queued"] += 1

        session.commit()
        log.info("Notification queue complete: %s", counts)

    except Exception as e:
        log.exception("Notification queue failed: %s", e)
        session.rollback()
        raise
    finally:
        session.close()

    return counts


def send_digests(period: str = "daily") -> dict:
    """Drain the NotificationQueue for all subscribers on the given digest schedule.

    Args:
        period: "daily" or "weekly"

    Returns:
        Dict with counts: {subscribers_emailed, items_sent, errors}
    """
    session = SessionLocal()
    counts = {"subscribers_emailed": 0, "items_sent": 0, "errors": 0}

    try:
        # Find subscribers on this digest schedule who have queued items
        subscribers = (
            session.query(Subscriber)
            .filter(
                Subscriber.active == True,
                Subscriber.digest_mode == period,
            )
            .all()
        )

        for subscriber in subscribers:
            queued = (
                session.query(NotificationQueue)
                .filter_by(subscriber_id=subscriber.id)
                .order_by(NotificationQueue.is_priority.desc(), NotificationQueue.created_at.asc())
                .all()
            )

            if not queued:
                continue

            # Build digest items
            digest_items = []
            for q in queued:
                digest_items.append({
                    "matter": q.matter,
                    "trigger_event": q.trigger_event,
                    "is_priority": q.is_priority,
                })

            try:
                subject, html, text = render_digest_email(
                    digest_items, period, _unsubscribe_url(subscriber)
                )
                send_email(to=subscriber.email, subject=subject, html=html, text=text)

                # Log all items as sent and clear queue
                for q in queued:
                    session.add(AlertLog(
                        subscriber_id=subscriber.id,
                        matter_id=q.matter_id,
                        trigger_event=q.trigger_event,
                        delivery_type="digest",
                    ))
                    session.delete(q)

                counts["subscribers_emailed"] += 1
                counts["items_sent"] += len(queued)
                log.info("Digest sent to %s — %d items", subscriber.email, len(queued))

            except Exception as e:
                log.error("Failed to send digest to %s: %s", subscriber.email, e)
                counts["errors"] += 1

        session.commit()
        log.info("Digest flush (%s) complete: %s", period, counts)

    except Exception as e:
        log.exception("Digest flush failed: %s", e)
        session.rollback()
        raise
    finally:
        session.close()

    return counts


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s — %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )

    cmd = sys.argv[1] if len(sys.argv) > 1 else "queue"

    if cmd == "queue":
        queue_notifications()
    elif cmd == "digest-daily":
        send_digests("daily")
    elif cmd == "digest-weekly":
        send_digests("weekly")
    else:
        print(f"Unknown command: {cmd}")
        print("Usage: python -m notifications.worker [queue|digest-daily|digest-weekly]")
        sys.exit(1)
