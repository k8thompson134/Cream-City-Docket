"""
APScheduler setup.
Runs the Legistar poller hourly, then the enrichment worker immediately after.
Import and call start_scheduler() from main.py on app startup.
"""
import logging
from apscheduler.schedulers.background import BackgroundScheduler

log = logging.getLogger(__name__)
_scheduler: BackgroundScheduler | None = None


def _poll_then_enrich():
    from poller.poll import run_poll
    from enrichment.worker import run_enrichment
    from notifications.dispatcher import run_dispatcher
    try:
        run_poll()
    except Exception as e:
        log.error("Poller failed: %s", e)
    try:
        run_enrichment(batch_size=100)
    except Exception as e:
        log.error("Enrichment failed: %s", e)
    try:
        from enrichment.worker import run_substitute_enrichment
        run_substitute_enrichment(batch_size=20)
    except Exception as e:
        log.error("Substitute enrichment failed: %s", e)
    try:
        run_dispatcher()
    except Exception as e:
        log.error("Dispatcher failed: %s", e)


def _send_daily_digests():
    from notifications.dispatcher import send_digests
    try:
        send_digests("daily")
    except Exception as e:
        log.error("Daily digest send failed: %s", e)


def _send_weekly_digests():
    from notifications.dispatcher import send_digests
    try:
        send_digests("weekly")
    except Exception as e:
        log.error("Weekly digest send failed: %s", e)


def start_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        return
    _scheduler = BackgroundScheduler()
    _scheduler.add_job(_poll_then_enrich, "interval", hours=1, id="poll_and_enrich")
    # 7am Central matches the delivery time promised on the subscribe page.
    _scheduler.add_job(_send_daily_digests, "cron", hour=7, timezone="America/Chicago", id="send_daily_digests")
    _scheduler.add_job(_send_weekly_digests, "cron", day_of_week="mon", hour=7, timezone="America/Chicago", id="send_weekly_digests")
    _scheduler.start()
    log.info("Scheduler started — poll + enrich every hour, digests daily/weekly at 7am CT")


def stop_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        log.info("Scheduler stopped")
