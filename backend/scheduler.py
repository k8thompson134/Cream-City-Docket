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


def _check_pipeline_health():
    from notifications.health_alerts import check_pipeline_health
    try:
        check_pipeline_health()
    except Exception as e:
        log.error("Pipeline health check itself failed: %s", e)


def _enrich_alders():
    from scripts.enrich_alders import run as run_alder_enrichment
    try:
        # force=True -- focus summaries go stale as an alder's bill count
        # grows, so a monthly refresh needs to re-enrich, not just backfill
        # alders that have never been enriched.
        run_alder_enrichment(force=True)
    except Exception as e:
        log.error("Alder enrichment failed: %s", e)


def start_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        return
    _scheduler = BackgroundScheduler()
    _scheduler.add_job(_poll_then_enrich, "interval", hours=1, id="poll_and_enrich")
    # 7am Central matches the delivery time promised on the subscribe page.
    _scheduler.add_job(_send_daily_digests, "cron", hour=7, timezone="America/Chicago", id="send_daily_digests")
    _scheduler.add_job(_send_weekly_digests, "cron", day_of_week="mon", hour=7, timezone="America/Chicago", id="send_weekly_digests")
    _scheduler.add_job(_check_pipeline_health, "interval", minutes=30, id="check_pipeline_health")
    # Monthly, off-peak (5am CT on the 1st) so it doesn't overlap the hourly poll+enrich job.
    _scheduler.add_job(_enrich_alders, "cron", day=1, hour=5, timezone="America/Chicago", id="enrich_alders")
    _scheduler.start()
    log.info("Scheduler started — poll + enrich every hour, digests daily/weekly at 7am CT, "
             "pipeline health check every 30min, alder enrichment monthly")


def stop_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        log.info("Scheduler stopped")
