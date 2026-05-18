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
    stream=sys.stdout,
    force=True,
)
log = logging.getLogger("backfill_legistar_urls")


def run(limit: int | None = None) -> None:
    session = SessionLocal()
    try:
        q = (
            session.query(Matter.id, Matter.file_number)
            .filter(Matter.file_number.isnot(None))
            .filter(Matter.legistar_web_url.is_(None))
            .order_by(Matter.intro_date.desc().nullslast())
        )
        if limit:
            q = q.limit(limit)

        rows = q.all()
        total = len(rows)
        log.info("Found %d matters to backfill", total)
        sys.stdout.flush()

        updated = 0
        for i, (matter_id, file_number) in enumerate(rows, 1):
            print(f"[{i}/{total}] file {file_number} … ", end="", flush=True)
            url = fetch_legistar_web_url(file_number)
            if url:
                session.query(Matter).filter_by(id=matter_id).update({"legistar_web_url": url})
                session.commit()
                updated += 1
                print(f"✓")
            else:
                print(f"✗ not found")
            time.sleep(0.5)

        log.info("Done — %d/%d matters updated", updated, total)
    finally:
        session.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill Legistar web URLs for existing matters")
    parser.add_argument("--limit", type=int, default=None, help="Max number of matters to process")
    args = parser.parse_args()
    run(limit=args.limit)
