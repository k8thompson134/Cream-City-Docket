"""
Re-syncs all alders in the database using the Legistar Bodies endpoint.

Strategy:
  1. Fetch all Legistar Bodies, filter for district bodies (name contains a number + "district").
  2. For each district body, fetch its OfficeRecords to find the active alder.
  3. Update that alder's district number, name, email, phone in the DB.

Run from backend/ with venv active:
    python -m scripts.resync_alders
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.database import SessionLocal
from app.models import Alder
from poller import client


def extract_number(text: str) -> str | None:
    m = re.search(r'\b(\d+)\b', text)
    return m.group(1) if m else None


def resync_from_bodies() -> None:
    session = SessionLocal()
    try:
        print("Fetching all Legistar Bodies...")
        bodies = client.get_bodies()
        print(f"  {len(bodies)} bodies total")

        district_bodies = [
            b for b in bodies
            if "district" in (b.get("BodyName") or "").lower()
            and extract_number(b.get("BodyName") or "")
        ]
        print(f"  {len(district_bodies)} district bodies found\n")

        updated = 0
        for body in sorted(district_bodies, key=lambda b: int(extract_number(b["BodyName"]) or 0)):
            body_id = body["BodyId"]
            body_name = body.get("BodyName", "")
            district_num = extract_number(body_name)
            print(f"District {district_num} — body: '{body_name}' (id={body_id})")

            records = client.get_body_office_records(body_id)

            active = [r for r in records if r.get("OfficeRecordEndDate") is None
                      or r.get("OfficeRecordEndDate", "") > "2026"]
            if not active:
                active = records  # fall back to all if filtering gives nothing

            if not active:
                print("  (no office records found)\n")
                continue

            rec = active[0]
            person_id = rec.get("OfficeRecordPersonId")
            if not person_id:
                print("  (no PersonId in office record)\n")
                continue

            alder = session.query(Alder).filter_by(legistar_person_id=person_id).first()
            if not alder:
                print(f"  person_id={person_id} not in DB — skipping\n")
                continue

            person_data = client.get_person(person_id)
            alder.district = district_num
            alder.name = person_data.get("PersonFullName") or alder.name
            alder.email = person_data.get("PersonEmail") or alder.email
            alder.phone = person_data.get("PersonPhone") or alder.phone
            alder.photo_url = (
                person_data.get("PersonPhotoURL")
                or person_data.get("PersonPhotoUrl")
                or alder.photo_url
            )
            print(f"  → {alder.name}  email={alder.email}  phone={alder.phone}\n")
            updated += 1

        session.commit()
        print(f"Done. Updated {updated} alders.")
    except Exception as e:
        session.rollback()
        print(f"\nError: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    resync_from_bodies()
