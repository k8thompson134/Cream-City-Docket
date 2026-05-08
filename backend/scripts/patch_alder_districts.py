"""
Patches district numbers for all 15 alders.
Source: city.milwaukee.gov/CommonCouncil/Council-Members (May 2026)

Run from backend/ with venv active:
    python -m scripts.patch_alder_districts
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.database import SessionLocal
from app.models import Alder

# legistar_person_id → district number
DISTRICT_PATCHES: dict[int, str] = {
    3694: '1',   # A. Pratt
    3646: '2',   # Chambers Jr.
    3906: '3',   # Brower
    1661: '4',   # Bauman
    3693: '5',   # Westmoreland
    2109: '6',   # Coggs
    3803: '7',   # Jackson
    3381: '8',   # Zamarripa
    3695: '9',   # Taylor
    3804: '10',  # Moore
    3805: '11',  # Burgelis
    2462: '12',  # Perez
    3209: '13',  # Spiker
    3380: '14',  # Dimitrijevic
    2748: '15',  # Stamper
}


def run() -> None:
    session = SessionLocal()
    try:
        for person_id, district in DISTRICT_PATCHES.items():
            alder = session.query(Alder).filter_by(legistar_person_id=person_id).first()
            if not alder:
                print(f"  person_id={person_id} not found — skipping")
                continue
            alder.district = district
            print(f"  District {district}: {alder.name}")
        session.commit()
        print("\nDone.")
    except Exception as e:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    run()
