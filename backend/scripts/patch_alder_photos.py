"""
Patches photo_url for all 15 alders.
Source: city.milwaukee.gov/ImageLibrary/Groups/ccCouncil/Images3/Headshots/

Pattern confirmed: AndreaPrattHeadshot.jpg
If a URL 404s in the browser, check the alder's district page on city.milwaukee.gov
and update the URL here, then re-run.

Run from backend/ with venv active:
    python -m scripts.patch_alder_photos
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.database import SessionLocal
from app.models import Alder

BASE = "https://city.milwaukee.gov/ImageLibrary/Groups/ccCouncil/Images3/Headshots"

# legistar_person_id → photo filename
PHOTO_PATCHES: dict[int, str] = {
    3694: "AndreaPrattHeadshot.jpg",
    3646: "MarkChambersHeadshotWEB.jpg",
    3906: "Brower-headshot-WEB.jpg",
    1661: "city-2020-Bauman.jpg",
    3693: "city-2025-Westmoreland.jpg",
    2109: "city-2020-Coggs.jpg",
    3803: "Jackson-Headshot-WEB.jpg",
    3381: "city-2020-Zamarripa.jpg",
    3695: "LaressaTaylorHeadshot.jpeg",
    3804: "Moore-Headshot-WEB.jpg",
    3805: "Burgelis-Headshot-WEB.jpg",
    2462: "city-2020-Perez.jpg",
    3209: "city-2020-Spiker.jpg",
    3380: "city-2020-Dimitrijevic.jpg",
    2748: "city-2020-Stamper.jpg",
}


def run() -> None:
    session = SessionLocal()
    try:
        for person_id, filename in PHOTO_PATCHES.items():
            alder = session.query(Alder).filter_by(legistar_person_id=person_id).first()
            if not alder:
                print(f"  person_id={person_id} not found — skipping")
                continue
            alder.photo_url = f"{BASE}/{filename}"
            print(f"  D{alder.district}: {alder.name} → {filename}")
        session.commit()
        print("\nDone. Verify any broken images in the browser and update filenames above.")
    except Exception as e:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    run()
