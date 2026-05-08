"""
Thin wrapper around the Resend REST API using httpx.
No SDK dependency — Resend's API is simple enough to call directly.
"""
import logging
import os
import httpx

log = logging.getLogger(__name__)

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "alerts@creamcitydocket.com")
RESEND_URL = "https://api.resend.com/emails"


def send_email(*, to: str, subject: str, html: str, text: str) -> bool:
    if not RESEND_API_KEY:
        log.warning("RESEND_API_KEY not set — email not sent to %s", to)
        return False
    try:
        r = httpx.post(
            RESEND_URL,
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={"from": FROM_EMAIL, "to": to, "subject": subject, "html": html, "text": text},
            timeout=10,
        )
        r.raise_for_status()
        log.info("Email sent to %s — subject: %s", to, subject)
        return True
    except Exception as e:
        log.error("Failed to send email to %s: %s", to, e)
        return False
