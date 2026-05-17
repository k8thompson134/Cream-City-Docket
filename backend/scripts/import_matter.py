"""
Import a specific matter from Legistar by ID.

Useful for pulling in bills that predate the poller's start date
and were never synced via the incremental update window.

Run from the backend/ directory:
    python -m scripts.import_matter --id 12345
"""
import argparse
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.database import SessionLocal
from app.models import Matter
from poller import client
from poller.poll import _upsert_matter, _upsert_sponsors, _upsert_history

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("import_matter")


def import_matter(legistar_matter_id: int) -> None:
    log.info("Fetching matter %d from Legistar...", legistar_matter_id)

    data = client.get(f"/Matters/{legistar_matter_id}")
    if not data:
        log.error("Matter %d not found on Legistar.", legistar_matter_id)
        return

    session = SessionLocal()
    try:
        matter = _upsert_matter(session, data)
        if not matter:
            log.error("Failed to upsert matter %d.", legistar_matter_id)
            return

        log.info("Matter upserted: %s (id=%d)", matter.title[:80], matter.id)

        _upsert_sponsors(session, matter, legistar_matter_id)
        log.info("Sponsors synced.")

        _upsert_history(session, matter, legistar_matter_id)
        log.info("History and mayor actions synced.")

        session.commit()
        log.info("Done. Matter %d is now in the database.", legistar_matter_id)

    except Exception:
        session.rollback()
        log.exception("Import failed")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import a specific Legistar matter by ID")
    parser.add_argument("--id", type=int, required=True, help="Legistar matter ID (from the URL on Legistar)")
    args = parser.parse_args()
    import_matter(args.id)
