"""
Fix District 8: deactivate old alder "Donovan" and ensure Zamarripa is correct.

The former D8 alder (email rdonov@milwaukee.gov) was left active in the DB
with district=8, displacing Jocasta Zamarripa (legistar_person_id=3381).

Run from backend/ with venv active:
    python -m scripts.fix_district8
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.database import SessionLocal
from app.models import Alder


def run() -> None:
    session = SessionLocal()
    try:
        # Deactivate old D8 alder(s) — anyone with district=8 who is NOT Zamarripa
        old_d8 = (
            session.query(Alder)
            .filter(Alder.district == '8', Alder.legistar_person_id != 3381)
            .all()
        )
        for a in old_d8:
            print(f"  Deactivating: {a.name}  (person_id={a.legistar_person_id}  email={a.email})")
            a.active = False
            a.district = None

        # Ensure Zamarripa is active and correctly set
        zamarripa = session.query(Alder).filter_by(legistar_person_id=3381).first()
        if not zamarripa:
            print("  ERROR: Zamarripa (person_id=3381) not found in DB!")
            session.rollback()
            return

        zamarripa.active = True
        zamarripa.district = '8'
        zamarripa.name = 'ALD. JOCASTA ZAMARRIPA'
        zamarripa.phone = '414-286-3533'
        zamarripa.email = 'JoCasta.Zamarripa@milwaukee.gov'
        print(f"  Confirmed active: {zamarripa.name}  district={zamarripa.district}  email={zamarripa.email}")

        session.commit()
        print("\nDone.")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    run()
