"""
Import specific matters from Legistar by file number.

Useful for pulling in bills that predate the poller's start date.
The Legistar web URL ID is different from the API MatterId — this script
searches by file number (e.g. 251790) which is reliable across both.

Run from the backend/ directory:
    python -m scripts.import_matter --file 251790
    python -m scripts.import_matter --file 251790 251895 251524
"""
import argparse
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.database import SessionLocal
from app.models import MayorAction
from poller import client
from poller.poll import _upsert_matter, _upsert_sponsors, _upsert_history

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("import_matter")


def import_by_file_number(file_number: str) -> None:
    log.info("Searching Legistar for file number %s...", file_number)

    results = client._get("/Matters", params={"$filter": f"MatterFile eq '{file_number}'"})
    if not results:
        log.error("No matter found with file number %s.", file_number)
        return

    data = results[0] if isinstance(results, list) else results
    legistar_matter_id = data.get("MatterId")
    log.info("Found: %s (MatterId=%s)", data.get("MatterTitle", "")[:80], legistar_matter_id)

    session = SessionLocal()
    try:
        matter = _upsert_matter(session, data)
        if not matter:
            log.error("Failed to upsert matter for file %s.", file_number)
            return

        _upsert_sponsors(session, matter, legistar_matter_id, person_cache={})
        _upsert_history(session, matter, legistar_matter_id)

        mayor_actions = session.query(MayorAction).filter_by(matter_id=matter.id).all()
        if mayor_actions:
            for a in mayor_actions:
                log.info("  Mayor action found: %s on %s", a.action_type, a.action_date)
        else:
            log.info("  No mayor actions found for this bill.")

        session.commit()
        log.info("Done — file %s imported.", file_number)

    except Exception:
        session.rollback()
        log.exception("Import failed")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import Legistar matters by file number")
    parser.add_argument("--file", nargs="+", required=True, help="File number(s), e.g. 251790 251895")
    args = parser.parse_args()
    for f in args.file:
        import_by_file_number(f.strip())
