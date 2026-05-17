"""
One-time script: backfill mayor actions from Legistar matter history.

The hourly poller only syncs matters modified since the last run, so mayor
actions (signed, vetoed, lapsed, published) on older bills are missing.
This script iterates every matter in the database, re-fetches its full
MatterHistory from Legistar, and upserts any mayor actions found.

Run from the backend/ directory:
    python -m scripts.backfill_mayor_actions
"""
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.database import SessionLocal
from app.models import Matter, MayorAction
from poller import client
from poller.poll import _upsert_history

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("backfill_mayor_actions")


def backfill() -> None:
    session = SessionLocal()
    try:
        matters = session.query(Matter).order_by(Matter.id).all()
        log.info("Processing %d matters...", len(matters))

        added = 0
        for i, matter in enumerate(matters, 1):
            before = session.query(MayorAction).filter_by(matter_id=matter.id).count()
            _upsert_history(session, matter, matter.legistar_matter_id)
            after = session.query(MayorAction).filter_by(matter_id=matter.id).count()
            new = after - before
            if new:
                added += new
                log.info(
                    "Matter %s (id=%d): +%d mayor action(s)",
                    matter.file_number or matter.legistar_matter_id,
                    matter.id,
                    new,
                )

            if i % 100 == 0:
                session.commit()
                log.info("Progress: %d / %d matters, %d actions added so far", i, len(matters), added)

        session.commit()
        log.info("Done. Scanned %d matters, added %d mayor actions.", len(matters), added)

    except Exception:
        session.rollback()
        log.exception("Backfill failed")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    backfill()
