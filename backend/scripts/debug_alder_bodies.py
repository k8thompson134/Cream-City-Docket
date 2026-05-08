"""
Prints all Legistar OfficeRecord body names for each alder in the DB.
Helps figure out what body name format Milwaukee uses for aldermanic districts.

Run from backend/ with venv active:
    python -m scripts.debug_alder_bodies
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.database import SessionLocal
from app.models import Alder
from poller import client

session = SessionLocal()
alders = session.query(Alder).order_by(Alder.name).all()
session.close()

for alder in alders:
    records = client.get_person_office_records(alder.legistar_person_id)
    print(f"\n{alder.name} (person_id={alder.legistar_person_id})")
    if not records:
        print("  (no office records)")
    for r in records:
        print(f"  [{r.get('OfficeRecordStartDate','?')[:10]} – {(r.get('OfficeRecordEndDate') or 'present')[:10]}]  {r.get('OfficeRecordBodyName')}")
