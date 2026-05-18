"""
Backfill legistar_web_url for existing matters that have a file number
but no web URL stored yet.

Run from the backend/ directory:
    python -m scripts.backfill_legistar_urls
    python -m scripts.backfill_legistar_urls --limit 50
"""
import argparse
import logging
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.database import SessionLocal
from app.models import Matter
from poller.legistar_web import fetch_legistar_web_url

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("backfill_legistar_urls")


def run(limit: int | None = None) -> None:
    session = SessionLocal()
    try:
        q = (
            session.query(Matter)
            .filter(Matter.file_number.isnot(None))
            .filter(Matter.legistar_web_url.is_(None))
            .order_by(Matter.intro_date.desc().nullslast())
        )
        if limit:
            q = q.limit(limit)

        matters = q.all()
        log.info("Found %d matters to backfill", len(matters))

        updated = 0
        for matter in matters:
            url = fetch_legistar_web_url(matter.file_number)
            if url:
                matter.legistar_web_url = url
                session.commit()
                updated += 1
                log.info("  ✓ File %s → %s", matter.file_number, url)
            else:
                log.info("  ✗ File %s — not found", matter.file_number)
            time.sleep(0.5)  # be polite to Legistar's servers

        log.info("Done — %d/%d matters updated", updated, len(matters))
    finally:
        session.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill Legistar web URLs for existing matters")
    parser.add_argument("--limit", type=int, default=None, help="Max number of matters to process")
    args = parser.parse_args()
    run(limit=args.limit)
