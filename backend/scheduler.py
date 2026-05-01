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
    try:
        run_poll()
    except Exception as e:
        log.error("Poller failed: %s", e)
    try:
        run_enrichment(batch_size=100)
    except Exception as e:
        log.error("Enrichment failed: %s", e)


def start_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        return
    _scheduler = BackgroundScheduler()
    _scheduler.add_job(_poll_then_enrich, "interval", hours=1, id="poll_and_enrich")
    _scheduler.start()
    log.info("Scheduler started — poll + enrich every hour")


def stop_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        log.info("Scheduler stopped")
