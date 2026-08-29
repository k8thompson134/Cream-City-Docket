"""
Pipeline health monitoring -- the thing that should have caught the
2026-05-21 to 2026-08-25 silent poller outage months earlier than it was
(see docs/cream-city-docket-dev-plan.md, Milestone 6). Runs on the same
in-process scheduler as the poller/digests (scheduler.py) and emails the
owner if the poller stops succeeding, instead of just logging to a void.

Reuses the same checks as .claude/skills/docket-health/health_check.py's
manual diagnostic, but runs automatically inside the deployed app (so it
has DATABASE_URL already, no Railway CLI step needed) and actually alerts.
"""
import logging
import os
from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.models import PollLog
from notifications.email import send_email

log = logging.getLogger(__name__)

OWNER_ALERT_EMAIL = os.getenv("OWNER_ALERT_EMAIL", "")
STALE_AFTER = timedelta(hours=3)  # poller runs hourly; 3 missed runs is a real problem
CONSECUTIVE_FAILURE_THRESHOLD = 3
ALERT_COOLDOWN = timedelta(hours=6)  # don't re-page every 30min for the same ongoing outage

# Process-local state -- fine given this runs on the single in-process
# scheduler (railway.toml has no --workers flag, one process). Resets on
# deploy/restart, which just means a restart can re-send one alert for an
# outage already in progress -- harmless, and much better than silence.
_last_alert_sent_at: datetime | None = None
_last_alert_was_failure = False


def _aware(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def check_pipeline_health() -> dict:
    """Checks poller freshness/success. Fires an owner alert email on an
    unhealthy result (rate-limited by ALERT_COOLDOWN) and a one-time recovery
    email on transition back to healthy. Returns {"healthy": bool, "reasons": [...]}."""
    global _last_alert_sent_at, _last_alert_was_failure

    session = SessionLocal()
    try:
        recent = (
            session.query(PollLog)
            .order_by(PollLog.polled_at.desc())
            .limit(CONSECUTIVE_FAILURE_THRESHOLD)
            .all()
        )
        last_success = (
            session.query(PollLog)
            .filter(PollLog.success.is_(True))
            .order_by(PollLog.polled_at.desc())
            .first()
        )
    finally:
        session.close()

    now = datetime.now(timezone.utc)
    reasons = []

    if not recent:
        reasons.append("No poll_log rows at all -- poller may never have run.")
    else:
        consecutive_failures = 0
        for row in recent:
            if not row.success:
                consecutive_failures += 1
            else:
                break
        if consecutive_failures >= CONSECUTIVE_FAILURE_THRESHOLD:
            reasons.append(
                f"Last {consecutive_failures} poll attempts all failed. "
                f"Most recent error: {(recent[0].error_message or '')[:300]}"
            )

    if last_success is None:
        reasons.append("No poll has ever succeeded.")
    else:
        age = now - _aware(last_success.polled_at)
        if age > STALE_AFTER:
            reasons.append(f"Last successful poll was {age} ago (poller runs hourly).")

    healthy = not reasons

    if not healthy:
        should_alert = _last_alert_sent_at is None or (now - _last_alert_sent_at) > ALERT_COOLDOWN
        if not OWNER_ALERT_EMAIL:
            log.error("Pipeline unhealthy but OWNER_ALERT_EMAIL is not set -- no alert sent: %s", reasons)
        elif should_alert:
            body = "The Cream City Docket notification pipeline looks unhealthy:\n\n" + "\n".join(
                f"- {r}" for r in reasons
            )
            send_email(
                to=OWNER_ALERT_EMAIL,
                subject="⚠️ Cream City Docket pipeline unhealthy",
                html=f"<p>{body.replace(chr(10), '<br>')}</p>",
                text=body,
            )
            _last_alert_sent_at = now
            _last_alert_was_failure = True
            log.error("Pipeline health alert sent: %s", reasons)
    elif _last_alert_was_failure:
        if OWNER_ALERT_EMAIL:
            send_email(
                to=OWNER_ALERT_EMAIL,
                subject="✅ Cream City Docket pipeline recovered",
                html="<p>The notification pipeline is healthy again.</p>",
                text="The notification pipeline is healthy again.",
            )
        _last_alert_was_failure = False
        log.info("Pipeline health recovered")

    return {"healthy": healthy, "reasons": reasons}
