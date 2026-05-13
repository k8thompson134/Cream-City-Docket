"""
Email sender — thin wrapper around SMTP or a transactional email API.
Supports SendGrid (via API key) or raw SMTP as a fallback.

Set EMAIL_API_KEY for SendGrid, or SMTP_* vars for raw SMTP.
"""
import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

log = logging.getLogger("notifications.sender")

FROM_EMAIL = os.getenv("FROM_EMAIL", "alerts@creamcitydocket.com")
FROM_NAME = os.getenv("FROM_NAME", "Cream City Docket")


def send_email(to: str, subject: str, html_body: str) -> None:
    """Send an email. Uses SendGrid if EMAIL_API_KEY is set, else falls back to SMTP."""
    api_key = os.getenv("EMAIL_API_KEY")

    if api_key:
        _send_via_sendgrid(to, subject, html_body, api_key)
    elif os.getenv("SMTP_HOST"):
        _send_via_smtp(to, subject, html_body)
    else:
        # Dev mode — just log the email
        log.warning(
            "No email provider configured — logging email instead.\n"
            "  To: %s\n  Subject: %s\n  Body length: %d chars",
            to, subject, len(html_body),
        )


def _send_via_sendgrid(to: str, subject: str, html_body: str, api_key: str) -> None:
    """Send email via SendGrid v3 API."""
    import httpx

    response = httpx.post(
        "https://api.sendgrid.com/v3/mail/send",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "personalizations": [{"to": [{"email": to}]}],
            "from": {"email": FROM_EMAIL, "name": FROM_NAME},
            "subject": subject,
            "content": [{"type": "text/html", "value": html_body}],
        },
        timeout=15,
    )
    if response.status_code not in (200, 202):
        raise RuntimeError(
            f"SendGrid error {response.status_code}: {response.text}"
        )
    log.info("Email sent via SendGrid to %s", to)


def _send_via_smtp(to: str, subject: str, html_body: str) -> None:
    """Send email via raw SMTP (e.g. Gmail, Mailgun SMTP, etc.)."""
    host = os.environ["SMTP_HOST"]
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.environ.get("SMTP_USER", "")
    password = os.environ.get("SMTP_PASSWORD", "")

    msg = MIMEMultipart("alternative")
    msg["From"] = f"{FROM_NAME} <{FROM_EMAIL}>"
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(host, port) as server:
        server.ehlo()
        if port != 25:
            server.starttls()
        if user:
            server.login(user, password)
        server.send_message(msg)
    log.info("Email sent via SMTP to %s", to)
