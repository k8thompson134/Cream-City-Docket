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
    MatterSponsor, MayorAction, PollLog, Vote,
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
    "RETURNED NOT SIGNED": "vetoed",
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


def _extract_district(office_records: list) -> str | None:
    """Extract a numeric district string from Legistar OfficeRecord body names."""
    import re
    for rec in office_records:
        body = rec.get("OfficeRecordBodyName", "") or ""
        if "district" in body.lower():
            match = re.search(r'\b(\d+)\b', body)
            if match:
                return match.group(1)
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

    office_records = client.get_person_office_records(person_id)
    district = _extract_district(office_records)
    email = person_data.get("PersonEmail")
    phone = person_data.get("PersonPhone")
    photo_url = person_data.get("PersonPhotoURL") or person_data.get("PersonPhotoUrl")

    alder = Alder(
        legistar_person_id=person_id,
        name=person_data.get("PersonFullName") or display_name,
        district=district,
        email=email,
        phone=phone,
        photo_url=photo_url,
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


def _upsert_event(session, raw: dict) -> Event | None:
    legistar_event_id = raw.get("EventId")
    if not legistar_event_id:
        return None

    event = session.query(Event).filter_by(legistar_event_id=legistar_event_id).first()
    date = _parse_dt(raw.get("EventDate"))
    body_name = raw.get("EventBodyName")
    location = raw.get("EventLocation")

    if event:
        event.date = date
        event.body_name = body_name
        event.location = location
        event.updated_at = datetime.utcnow()
    else:
        event = Event(
            legistar_event_id=legistar_event_id,
            body_name=body_name,
            date=date,
            location=location,
        )
        session.add(event)
    session.flush()
    return event


def _upsert_event_item(session, event: Event, raw: dict) -> EventItem | None:
    legistar_event_item_id = raw.get("EventItemId")
    if not legistar_event_item_id:
        return None

    legistar_matter_id = raw.get("EventItemMatterId")
    matter_id = None
    if legistar_matter_id:
        matter = session.query(Matter).filter_by(legistar_matter_id=legistar_matter_id).first()
        if matter:
            matter_id = matter.id

    event_item = session.query(EventItem).filter_by(legistar_event_item_id=legistar_event_item_id).first()
    if event_item:
        event_item.matter_id = matter_id
        event_item.action_name = raw.get("EventItemActionName")
        event_item.passed_flag = raw.get("EventItemPassedFlagName")
    else:
        event_item = EventItem(
            legistar_event_item_id=legistar_event_item_id,
            event_id=event.id,
            matter_id=matter_id,
            action_name=raw.get("EventItemActionName"),
            passed_flag=raw.get("EventItemPassedFlagName"),
        )
        session.add(event_item)
    session.flush()
    return event_item


def _upsert_votes(session, event_item: EventItem, event_date: datetime | None) -> None:
    votes_data = client.get_event_item_votes(event_item.legistar_event_item_id)
    for v in votes_data:
        legistar_vote_id = v.get("VoteId")
        person_id = v.get("VotePersonId")
        if not legistar_vote_id or not person_id:
            continue

        alder = session.query(Alder).filter_by(legistar_person_id=person_id).first()
        if not alder:
            continue

        existing = session.query(Vote).filter_by(legistar_vote_id=legistar_vote_id).first()
        if not existing:
            session.add(Vote(
                legistar_vote_id=legistar_vote_id,
                alder_id=alder.id,
                event_item_id=event_item.id,
                matter_id=event_item.matter_id,
                vote_value=v.get("VoteValueName"),
                voted_at=event_date,
            ))


def _poll_events_and_votes(session, since_str: str) -> None:
    events_data = client.get_events_since(since_str)
    log.info("Fetched %d events from Legistar", len(events_data))

    for event_raw in events_data:
        event = _upsert_event(session, event_raw)
        if not event:
            continue

        items_data = client.get_event_items(event.legistar_event_id)
        for item_raw in items_data:
            event_item = _upsert_event_item(session, event, item_raw)
            # Only fetch votes for agenda items that are linked to a known matter
            if event_item and event_item.matter_id:
                _upsert_votes(session, event_item, event.date)


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

        _poll_events_and_votes(session, since_str)

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
