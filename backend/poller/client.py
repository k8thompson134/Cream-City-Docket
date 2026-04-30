"""
Thin httpx wrapper for the Milwaukee Legistar Web API.
All methods return raw dicts/lists — no DB logic here.
"""
import logging
import time
import httpx

BASE = "https://webapi.legistar.com/v1/milwaukee"
log = logging.getLogger(__name__)


def _get(endpoint: str, params: dict | None = None, retries: int = 3) -> list | dict:
    url = f"{BASE}{endpoint}"
    for attempt in range(retries):
        try:
            r = httpx.get(url, params=params, timeout=15)
            r.raise_for_status()
            return r.json()
        except httpx.HTTPStatusError as e:
            log.warning("HTTP %s for %s (attempt %d)", e.response.status_code, url, attempt + 1)
            if attempt == retries - 1:
                raise
            time.sleep(2 ** attempt)
        except httpx.RequestError as e:
            log.warning("Request error for %s: %s (attempt %d)", url, e, attempt + 1)
            if attempt == retries - 1:
                raise
            time.sleep(2 ** attempt)
    return []


def _paginate(endpoint: str, base_params: dict | None = None, page_size: int = 200) -> list:
    params = dict(base_params or {})
    params["$top"] = page_size
    results = []
    skip = 0
    while True:
        params["$skip"] = skip
        batch = _get(endpoint, params)
        if not isinstance(batch, list) or not batch:
            break
        results.extend(batch)
        if len(batch) < page_size:
            break
        skip += page_size
    return results


def get_matters_since(since_utc_str: str) -> list:
    """All matters modified at or after since_utc_str (ISO format, no tz suffix)."""
    return _paginate("/Matters", {
        "$filter": f"MatterLastModifiedUtc ge datetime'{since_utc_str}'",
        "$orderby": "MatterLastModifiedUtc asc",
    })


def get_all_matters(top: int = 1000) -> list:
    """Bootstrap: pull a large batch of recent matters ordered by ID."""
    return _paginate("/Matters", {"$orderby": "MatterId desc"}, page_size=200)


def get_matter_sponsors(matter_id: int) -> list:
    return _get(f"/Matters/{matter_id}/Sponsors") or []


def get_matter_histories(matter_id: int) -> list:
    return _get(f"/Matters/{matter_id}/Histories") or []


def get_matter_versions(matter_id: int) -> list:
    """Returns [{Key: textId, Value: versionNum}, ...]"""
    return _get(f"/Matters/{matter_id}/Versions") or []


def get_matter_text(matter_id: int, text_id: str) -> dict:
    return _get(f"/Matters/{matter_id}/Texts/{text_id}") or {}


def get_person(person_id: int) -> dict:
    return _get(f"/Persons/{person_id}") or {}


def get_person_office_records(person_id: int) -> list:
    return _get(f"/Persons/{person_id}/OfficeRecords") or []


def get_bodies() -> list:
    return _paginate("/Bodies")


def get_events_since(since_utc_str: str) -> list:
    return _paginate("/Events", {
        "$filter": f"EventLastModifiedUtc ge datetime'{since_utc_str}'",
        "$orderby": "EventLastModifiedUtc asc",
    })


def get_event_items(event_id: int) -> list:
    return _get(f"/Events/{event_id}/EventItems") or []
