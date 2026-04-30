"""
Legistar poller — M1 implementation.
Fetches new/updated Matters from Milwaukee Legistar and upserts into PostgreSQL.
Run directly: python -m poller.poll
"""
import logging
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Allow running from backend/ directory
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.database import SessionLocal
from app.models import (
    Alder, Event, EventItem, Matter, MatterHistory,
    MatterSponsor, MayorAction, PollLog,
)
from poller import client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("poller")

# MatterHistory action names that map to mayor actions
MAYOR_ACTION_MAP = {
    "SIGNED": "signed",
    "VETOED": "vetoed",
    "RETURNED": "vetoed",
    "PUBLISHED": "published",
    "LAPSED": "lapsed",
}

# MatterTypes to store but exclude from the public feed
EXCLUDED_TYPES = {
    "Communication",
    "Fire and Police Communication",
    "Communication to Finance",
    "APPEAL",
    "Motion",
    "Claim",
    "Settlement",
}


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%fZ"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return None


def _upsert_alder(session, person_id: int, display_name: str, person_cache: dict) -> Alder | None:
    """Get or create an Alder from a Legistar PersonId. Caches API calls within a poll run."""
    if person_id in person_cache:
        return person_cache[person_id]

    existing = session.query(Alder).filter_by(legistar_person_id=person_id).first()
    if existing:
        person_cache[person_id] = existing
        return existing

    person_data = client.get_person(person_id)
    if not person_data:
        log.warning("Could not fetch Person %d", person_id)
        person_cache[person_id] = None
        return None

    # Try to find district from OfficeRecords
    district = None
    office_records = client.get_person_office_records(person_id)
    for rec in office_records:
        body = rec.get("OfficeRecordBodyName", "") or ""
        if "district" in body.lower():
            district = body.split()[-1]  # e.g. "COMMON COUNCIL DISTRICT 3" → "3"
            break

    alder = Alder(
        legistar_person_id=person_id,
        name=person_data.get("PersonFullName") or display_name,
        district=district,
        email=person_data.get("PersonEmail"),
        phone=person_data.get("PersonPhone"),
        active=True,
    )
    session.add(alder)
    session.flush()
    person_cache[person_id] = alder
    log.info("Created alder: %s (district %s)", alder.name, alder.district)
    return alder


def _upsert_matter(session, raw: dict) -> Matter:
    """Insert or update a Matter record. Returns the db object."""
    legistar_id = raw["MatterId"]
    matter = session.query(Matter).filter_by(legistar_matter_id=legistar_id).first()

    fields = {
        "legistar_guid": raw.get("MatterGuid", ""),
        "file_number": raw.get("MatterFile"),
        "title": raw.get("MatterTitle", ""),
        "matter_type": raw.get("MatterTypeName", ""),
        "matter_status": raw.get("MatterStatusName", ""),
        "body_name": raw.get("MatterBodyName"),
        "intro_date": _parse_dt(raw.get("MatterIntroDate")),
        "agenda_date": _parse_dt(raw.get("MatterAgendaDate")),
        "passed_date": _parse_dt(raw.get("MatterPassedDate")),
        "enactment_date": _parse_dt(raw.get("MatterEnactmentDate")),
        "enactment_number": raw.get("MatterEnactmentNumber"),
        "last_modified_utc": _parse_dt(raw.get("MatterLastModifiedUtc")),
        "updated_at": datetime.utcnow(),
    }

    if matter:
        for k, v in fields.items():
            setattr(matter, k, v)
    else:
        matter = Matter(legistar_matter_id=legistar_id, **fields)
        session.add(matter)

    session.flush()
    return matter


def _upsert_sponsors(session, matter: Matter, matter_id: int, person_cache: dict) -> None:
    sponsors_data = client.get_matter_sponsors(matter_id)
    for s in sponsors_data:
        person_id = s.get("MatterSponsorNameId")
        if not person_id:
            continue
        display_name = s.get("MatterSponsorName", "")
        matter_version = s.get("MatterSponsorMatterVersion", "0")

        alder = _upsert_alder(session, person_id, display_name, person_cache)
        if not alder:
            continue

        existing = session.query(MatterSponsor).filter_by(
            matter_id=matter.id,
            alder_id=alder.id,
            matter_version=matter_version,
        ).first()
        if not existing:
            session.add(MatterSponsor(
                matter_id=matter.id,
                alder_id=alder.id,
                matter_version=matter_version,
                sequence=s.get("MatterSponsorSequence", 0),
            ))


def _upsert_history(session, matter: Matter, matter_id: int) -> None:
    histories = client.get_matter_histories(matter_id)
    for h in histories:
        action_name = (h.get("MatterHistoryActionName") or "").strip()
        action_date = _parse_dt(h.get("MatterHistoryActionDate"))
        result = h.get("MatterHistoryPassedFlagName")

        if not action_name:
            continue

        existing = session.query(MatterHistory).filter_by(
            matter_id=matter.id,
            action_name=action_name,
            action_date=action_date,
        ).first()
        if not existing:
            session.add(MatterHistory(
                matter_id=matter.id,
                action_name=action_name,
                action_date=action_date,
                result=result,
            ))

        # Detect mayoral actions from history
        mayor_type = MAYOR_ACTION_MAP.get(action_name.upper())
        if mayor_type:
            existing_action = session.query(MayorAction).filter_by(
                matter_id=matter.id,
                action_type=mayor_type,
            ).first()
            if not existing_action:
                session.add(MayorAction(
                    matter_id=matter.id,
                    action_type=mayor_type,
                    action_date=action_date,
                ))
                log.info("Mayor action '%s' on matter %d", mayor_type, matter_id)


def _get_last_poll_time(session) -> str:
    """Return ISO timestamp string for the last successful poll, or 7 days ago."""
    last = (
        session.query(PollLog)
        .filter_by(success=True)
        .order_by(PollLog.polled_at.desc())
        .first()
    )
    if last:
        dt = last.polled_at
    else:
        dt = datetime.utcnow() - timedelta(days=7)
        log.info("No prior poll found — bootstrapping from %s", dt.date())
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def run_poll() -> None:
    session = SessionLocal()
    poll_start = datetime.utcnow()
    matters_fetched = 0
    matters_upserted = 0
    error_message = None

    try:
        since_str = _get_last_poll_time(session)
        log.info("Polling for matters modified since %s", since_str)

        matters_data = client.get_matters_since(since_str)
        matters_fetched = len(matters_data)
        log.info("Fetched %d matters from Legistar", matters_fetched)

        person_cache: dict[int, Alder | None] = {}

        for raw in matters_data:
            matter = _upsert_matter(session, raw)
            _upsert_sponsors(session, matter, raw["MatterId"], person_cache)
            _upsert_history(session, matter, raw["MatterId"])
            matters_upserted += 1

        session.add(PollLog(
            polled_at=poll_start,
            matters_fetched=matters_fetched,
            matters_upserted=matters_upserted,
            success=True,
        ))
        session.commit()
        log.info("Poll complete — %d matters upserted", matters_upserted)

    except Exception as e:
        error_message = str(e)
        log.exception("Poll failed: %s", e)
        session.rollback()
        session.add(PollLog(
            polled_at=poll_start,
            matters_fetched=matters_fetched,
            matters_upserted=matters_upserted,
            success=False,
            error_message=error_message,
        ))
        session.commit()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    run_poll()
