"""
Scrapes the Legistar web UI to resolve a bill's direct detail page URL.

The Legistar REST API exposes MatterId and MatterGuid, but the web UI uses
a completely separate LegislationId that has no API equivalent. The only way
to get a working LegislationDetail.aspx link is to search by file number on
the web UI and extract the URL from the results.
"""
import logging
import re

import httpx

log = logging.getLogger(__name__)

_SEARCH_URL = "https://milwaukee.legistar.com/Legislation.aspx"
_DETAIL_PATTERN = re.compile(r'LegislationDetail\.aspx\?[^"\']+', re.IGNORECASE)
_VIEWSTATE_PATTERN = re.compile(r'id="__VIEWSTATE"[^>]*value="([^"]+)"')
_VSGENERATOR_PATTERN = re.compile(r'id="__VIEWSTATEGENERATOR"[^>]*value="([^"]+)"')

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; CreamCityDocket/1.0)",
    "Accept": "text/html,application/xhtml+xml",
}


def fetch_legistar_web_url(file_number: str) -> str | None:
    """
    Search Legistar by file number and return the full LegislationDetail URL,
    or None if not found or scraping fails.
    """
    if not file_number:
        return None

    try:
        with httpx.Client(headers=_HEADERS, follow_redirects=True, timeout=15) as client:
            # Step 1: GET the search page to collect ASP.NET form tokens
            resp = client.get(_SEARCH_URL)
            resp.raise_for_status()
            html = resp.text

            vs_match = _VIEWSTATE_PATTERN.search(html)
            vsg_match = _VSGENERATOR_PATTERN.search(html)
            if not vs_match:
                log.warning("Legistar web: could not find __VIEWSTATE for file %s", file_number)
                return None

            viewstate = vs_match.group(1)
            vsgenerator = vsg_match.group(1) if vsg_match else ""

            # Step 2: POST the search form with the file number
            payload = {
                "__EVENTTARGET": "ctl00$ContentPlaceHolder1$btnSearch",
                "__EVENTARGUMENT": "",
                "__VIEWSTATE": viewstate,
                "__VIEWSTATEGENERATOR": vsgenerator,
                "ctl00$ContentPlaceHolder1$txtSearch": file_number,
                "ctl00$ContentPlaceHolder1$chkID": "on",
                "ctl00$ContentPlaceHolder1$chkText": "on",
            }
            # Carry session cookies from the GET so the POST is accepted
            result = client.post(_SEARCH_URL, data=payload, cookies=resp.cookies)
            result.raise_for_status()

            # Step 3: Extract the first LegislationDetail URL from results
            match = _DETAIL_PATTERN.search(result.text)
            if not match:
                log.debug("Legistar web: no detail URL in results for file %s", file_number)
                return None

            raw = match.group(0).replace("&amp;", "&")
            url = f"https://milwaukee.legistar.com/{raw}"
            log.debug("Legistar web URL for file %s: %s", file_number, url)
            return url

    except Exception as exc:
        log.warning("Legistar web scrape failed for file %s: %s", file_number, exc)
        return None
