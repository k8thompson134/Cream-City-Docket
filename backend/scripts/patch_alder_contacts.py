"""
Patches contact info and canonical names for all 15 alders.
Source: city.milwaukee.gov/CommonCouncil/Council-Members

Run from backend/ with venv active:
    python -m scripts.patch_alder_contacts
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.database import SessionLocal
from app.models import Alder

# legistar_person_id → (canonical name, phone, email)
CONTACT_PATCHES: dict[int, tuple[str, str, str]] = {
    3694: ('ALD. ANDREA M. PRATT',      '414-286-2228', 'aide1@milwaukee.gov'),
    3646: ('ALD. MARK CHAMBERS JR.',    '414-286-3787', 'Aide2@milwaukee.gov'),
    3906: ('ALD. ALEX BROWER',          '414-286-3447', 'Alex.Brower@milwaukee.gov'),
    1661: ('ALD. ROBERT BAUMAN',        '414-286-3774', 'rjbauma@milwaukee.gov'),
    3693: ('ALD. LAMONT WESTMORELAND',  '414-286-3870', 'lamont.westmoreland@milwaukee.gov'),
    2109: ('ALD. MILELE A. COGGS',      '414-286-2221', 'mcoggs@milwaukee.gov'),
    3803: ('ALD. DIANDRE JACKSON',      '414-286-2863', 'DiAndre.Jackson@milwaukee.gov'),
    3381: ('ALD. JOCASTA ZAMARRIPA',    '414-286-3533', 'JoCasta.Zamarripa@milwaukee.gov'),
    3695: ('ALD. LARRESA TAYLOR',       '414-286-2221', 'Larresa.Taylor@milwaukee.gov'),
    3804: ('ALD. SHARLEN P. MOORE',     '414-286-3763', 'Sharlen.Moore@milwaukee.gov'),
    3805: ('ALD. PETER BURGELIS',       '414-286-3768', 'Peter.Burgelis@milwaukee.gov'),
    2462: ('ALD. JOSE G. PEREZ',        '414-286-2861', 'JPerez@milwaukee.gov'),
    3209: ('ALD. SCOTT SPIKER',         '414-286-8537', 'scott.spiker@milwaukee.gov'),
    3380: ('ALD. MARINA DIMITRIJEVIC',  '414-286-3769', 'Marina@milwaukee.gov'),
    2748: ('ALD. RUSSELL W. STAMPER',   '414-286-2221', 'russell.stamper@milwaukee.gov'),
}


def run() -> None:
    session = SessionLocal()
    try:
        for person_id, (name, phone, email) in CONTACT_PATCHES.items():
            alder = session.query(Alder).filter_by(legistar_person_id=person_id).first()
            if not alder:
                print(f"  person_id={person_id} not found — skipping")
                continue
            alder.name = name
            alder.phone = phone
            alder.email = email
            print(f"  D{alder.district}: {name}  {phone}  {email}")
        session.commit()
        print("\nDone.")
    except Exception as e:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    run()
