"""
Email templates for Cream City Docket alerts.
Each function returns (subject, html, text) tuples.
"""
import os

SITE_URL = os.getenv("SITE_URL", "https://creamcitydocket.com")

_TRIGGER_LABELS = {
    "introduced":        ("New legislation", "A new bill matching your interests was introduced."),
    "hearing_scheduled": ("Hearing scheduled", "A bill matching your interests has a committee hearing coming up."),
    "council_vote":      ("Council vote upcoming", "A bill matching your interests is headed to a full council vote."),
    "mayor_signed":      ("Mayor signed", "A bill matching your interests was signed by the mayor."),
    "mayor_vetoed":      ("Mayor vetoed", "A bill matching your interests was vetoed by the mayor."),
}


def _base_html(body: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0f2f5; margin: 0; padding: 24px 16px; }}
  .card {{ background: #fff; max-width: 560px; margin: 0 auto; border-radius: 8px; overflow: hidden; border: 1px solid #d0d6e0; }}
  .header {{ background: #12284B; padding: 20px 28px; }}
  .header a {{ color: #FFC52F; font-size: 15px; font-weight: 700; text-decoration: none; letter-spacing: 0.03em; }}
  .body {{ padding: 28px; color: #1a1a1a; font-size: 15px; line-height: 1.6; }}
  .footer {{ padding: 16px 28px; background: #f5f7fb; border-top: 1px solid #e4e9f2; font-size: 12px; color: #888; }}
  .footer a {{ color: #12284B; }}
  h2 {{ font-size: 18px; color: #12284B; margin: 0 0 12px; }}
  .tag {{ display: inline-block; background: #fff8e7; border: 1px solid #e8a800; color: #12284B; font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 3px; margin: 2px 4px 2px 0; text-transform: uppercase; letter-spacing: 0.04em; }}
  .meta {{ font-size: 13px; color: #555; margin: 12px 0; }}
  .meta strong {{ color: #1a1a1a; }}
  .summary {{ background: #f5f7fb; border-left: 4px solid #FFC52F; padding: 12px 16px; margin: 16px 0; font-size: 14px; line-height: 1.6; color: #333; }}
  .btn {{ display: inline-block; background: #12284B; color: #FFC52F !important; text-decoration: none; padding: 10px 20px; border-radius: 4px; font-weight: 700; font-size: 14px; margin-top: 8px; }}
  .divider {{ border: none; border-top: 1px solid #e4e9f2; margin: 20px 0; }}
  .event-box {{ background: #fff8e7; border: 1px solid #e8a800; border-radius: 4px; padding: 10px 14px; margin: 12px 0; font-size: 14px; color: #1a1a1a; }}
  .event-box strong {{ color: #12284B; }}
</style>
</head>
<body><div class="card">{body}</div></body>
</html>"""


def confirmation_email(
    *,
    tags: list[str],
    district: str | None,
    manage_url: str,
    unsubscribe_url: str,
) -> tuple[str, str, str]:
    subject = "You're subscribed to Cream City Docket alerts"

    tag_chips = " ".join(f'<span class="tag">{t}</span>' for t in tags) if tags else "<em>None selected</em>"

    html = _base_html(f"""
      <div class="header"><a href="{SITE_URL}">Cream City Docket</a></div>
      <div class="body">
        <h2>You're in.</h2>
        <p>You'll get an email when Milwaukee legislation matching your preferences is introduced, scheduled for a committee hearing, or voted on by the full council.</p>
        <hr class="divider">
        <p><strong>Your alert preferences:</strong></p>
        {f'<p>{tag_chips}</p>' if tags else ''}
        {f'<p>District: <strong>{district}</strong></p>' if district else ''}
        <hr class="divider">
        <a href="{manage_url}" class="btn">Manage preferences →</a>
      </div>
      <div class="footer">
        <a href="{unsubscribe_url}">Unsubscribe</a> &nbsp;·&nbsp;
        <a href="{SITE_URL}">creamcitydocket.com</a><br>
        Milwaukee civic alerts — free, no account required.
      </div>
    """)

    text = f"""You're subscribed to Cream City Docket alerts.

You'll get an email when Milwaukee legislation matching your preferences is introduced, scheduled for a hearing, or voted on.

Your preferences:
{chr(10).join(f'- {t}' for t in tags)}
{f'- District: {district}' if district else ''}

Manage preferences: {manage_url}
Unsubscribe: {unsubscribe_url}

creamcitydocket.com"""

    return subject, html, text


def alert_email(
    *,
    trigger_event: str,
    matter_title: str,
    matter_summary: str | None,
    matter_type: str,
    matter_status: str,
    intro_date: str | None,
    agenda_date: str | None,
    mayor_action_date: str | None,
    tags: list[str],
    sponsors: list[str],
    file_number: str | None,
    trigger_reason: str,
    manage_url: str,
    unsubscribe_url: str,
) -> tuple[str, str, str]:
    label, headline = _TRIGGER_LABELS.get(
        trigger_event,
        ("Milwaukee legislation update", "A bill matching your interests was updated."),
    )
    tag_label = tags[0] if tags else "Milwaukee legislation"
    title_snippet = matter_title[:60] + ("…" if len(matter_title) > 60 else "")
    subject = f"{label}: {title_snippet}"

    tag_chips = "".join(f'<span class="tag">{t}</span>' for t in tags)
    summary_block = f'<div class="summary">{matter_summary}</div>' if matter_summary else ""
    sponsor_text = ", ".join(sponsors) if sponsors else "—"
    file_text = f"File #{file_number}" if file_number else ""

    # Trigger-specific callout block
    event_block = ""
    if trigger_event == "hearing_scheduled" and agenda_date:
        event_block = f'<div class="event-box"><strong>Hearing date:</strong> {agenda_date}</div>'
    elif trigger_event == "council_vote":
        event_block = f'<div class="event-box"><strong>Status:</strong> {matter_status}</div>'
    elif trigger_event == "mayor_signed" and mayor_action_date:
        event_block = f'<div class="event-box"><strong>Signed:</strong> {mayor_action_date}</div>'
    elif trigger_event == "mayor_vetoed" and mayor_action_date:
        event_block = f'<div class="event-box"><strong>Vetoed:</strong> {mayor_action_date}</div>'

    html = _base_html(f"""
      <div class="header"><a href="{SITE_URL}">Cream City Docket</a></div>
      <div class="body">
        <p style="font-size:12px;color:#FFC52F;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.1em;background:#12284B;display:inline-block;padding:3px 8px;border-radius:3px;">{label}</p>
        <p style="font-size:12px;color:#888;margin:4px 0 12px;">{matter_type} &nbsp;·&nbsp; {matter_status}</p>
        <h2>{matter_title}</h2>
        {tag_chips}
        {event_block}
        {summary_block}
        <div class="meta">
          <strong>Sponsor:</strong> {sponsor_text}<br>
          {f'<strong>Introduced:</strong> {intro_date}<br>' if intro_date else ''}
          {f'<strong>File:</strong> {file_text}' if file_text else ''}
        </div>
        <a href="https://milwaukee.legistar.com/Legislation.aspx" class="btn">Search Legistar {f'— File #{file_number}' if file_number else ''} ↗</a>
        <hr class="divider">
        <p style="font-size:13px;color:#555;">You received this because you subscribed to <strong>{trigger_reason}</strong> alerts on Cream City Docket.</p>
      </div>
      <div class="footer">
        <a href="{manage_url}">Manage preferences</a> &nbsp;·&nbsp;
        <a href="{unsubscribe_url}">Unsubscribe</a> &nbsp;·&nbsp;
        <a href="{SITE_URL}">creamcitydocket.com</a>
      </div>
    """)

    extra_lines = []
    if trigger_event == "hearing_scheduled" and agenda_date:
        extra_lines.append(f"Hearing date: {agenda_date}")
    elif trigger_event == "mayor_signed" and mayor_action_date:
        extra_lines.append(f"Signed: {mayor_action_date}")
    elif trigger_event == "mayor_vetoed" and mayor_action_date:
        extra_lines.append(f"Vetoed: {mayor_action_date}")

    text = f"""{label.upper()}
{matter_type} · {matter_status}

{matter_title}

{chr(10).join(extra_lines)}
{matter_summary or ''}

Sponsor: {sponsor_text}
{f'Introduced: {intro_date}' if intro_date else ''}
{f'File: {file_text}' if file_text else ''}

Search Legistar: https://milwaukee.legistar.com/Legislation.aspx

You received this because you subscribed to {trigger_reason} alerts.

Manage preferences: {manage_url}
Unsubscribe: {unsubscribe_url}

creamcitydocket.com"""

    return subject, html, text
