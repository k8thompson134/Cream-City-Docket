"""
One-time script: backfill vote history from Legistar events.

The hourly poller only picks up events modified since the last poll run,
so votes from council meetings before the first deploy are missing.
This script fetches all events back to a configurable start date and
upserts any votes that are linked to matters already in the database.

Run from the backend/ directory:
    python -m scripts.backfill_votes
    python -m scripts.backfill_votes --since 2024-01-01
"""
import argparse
import logging
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.database import SessionLocal
from app.models import Alder, Event, EventItem, Matter, Vote
from poller import client
from poller.poll import _upsert_event, _upsert_event_item, _upsert_votes

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("backfill_votes")

DEFAULT_SINCE = "2023-01-01T00:00:00"


def backfill(since_str: str) -> None:
    log.info("Fetching events since %s ...", since_str)
    events_data = client._paginate("/Events", {
        "$filter": f"EventDate ge datetime'{since_str}'",
        "$orderby": "EventDate asc",
    })
    log.info("Found %d events to process", len(events_data))

    session = SessionLocal()
    votes_added = 0
    events_processed = 0

    try:
        for event_raw in events_data:
            event = _upsert_event(session, event_raw)
            if not event:
                continue

            items_data = client.get_event_items(event.legistar_event_id)
            for item_raw in items_data:
                event_item = _upsert_event_item(session, event, item_raw)
                if not event_item or not event_item.matter_id:
                    continue

                before = session.query(Vote).filter_by(
                    event_item_id=event_item.id
                ).count()
                _upsert_votes(session, event_item, event.date)
                after_flush_count = session.query(Vote).filter_by(
                    event_item_id=event_item.id
                ).count()
                # count new (unflushed) Vote objects added to session
                new_votes = len([
                    obj for obj in session.new
                    if isinstance(obj, Vote) and obj.event_item_id == event_item.id
                ])
                votes_added += new_votes

            events_processed += 1
            if events_processed % 50 == 0:
                session.commit()
                log.info("Processed %d / %d events, %d votes added so far",
                         events_processed, len(events_data), votes_added)

        session.commit()
        log.info("Done. Processed %d events, added %d new votes.", events_processed, votes_added)

    except Exception:
        session.rollback()
        log.exception("Backfill failed")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill vote history from Legistar")
    parser.add_argument(
        "--since",
        default=DEFAULT_SINCE,
        help=f"Fetch events on or after this date (default: {DEFAULT_SINCE})",
    )
    args = parser.parse_args()
    since = args.since
    if len(since) == 10:
        since = since + "T00:00:00"
    backfill(since)
