"""
Enrich all active alders with AI-generated focus summaries.

Calls Claude Haiku once per alder to produce a 2-sentence plain-English
description of their legislative priorities, derived from their sponsored
bills and tag distribution.

Run from the backend directory:
    python -m scripts.enrich_alders
    python -m scripts.enrich_alders --force   # re-enrich already-enriched alders
"""
import argparse
import logging
import os
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

import anthropic
from datetime import datetime
from sqlalchemy.orm import joinedload

from app.database import SessionLocal
from app.models import Alder, IssueTag, Matter, MatterSponsor, MatterTag

log = logging.getLogger(__name__)

FOCUS_SYSTEM = """You summarize a Milwaukee Common Council alder's legislative record for residents.
Write clearly at an 8th grade reading level. Be factual and neutral — no opinion or advocacy.
Write exactly 2 sentences. Plain prose only — no markdown, no lists, no headers.
Focus on what issues they most actively legislate on and who they tend to advocate for.
Do not start with the alder's name — vary your openings (e.g. "Their legislation...", "Much of the work...", "The bulk of...").
Never invent specifics not supported by the data provided."""

FOCUS_USER = """Summarize this Milwaukee alder's legislative priorities based on their record.

Name: {name}
District: {district}
In office since: {since}
Total sponsored bills: {total_bills}

Issue areas (bills per tag, most active first):
{tag_breakdown}

Recent bill titles (up to 10 most recent):
{bill_titles}

Write 2 sentences describing their legislative focus and the communities or issues they most advocate for."""


def _format_name(raw: str) -> str:
    return raw.replace('ALD. ', '').lower().replace(' ii', ' II').replace(' iii', ' III')


def _call_focus_summary(client: anthropic.Anthropic, alder: Alder, bills: list) -> str:
    tag_counts: Counter = Counter()
    for bill in bills:
        for mt in bill.tags:
            if mt.tag:
                tag_counts[mt.tag.name] += 1

    tag_breakdown = '\n'.join(
        f'  - {tag}: {count} bill{"s" if count != 1 else ""}'
        for tag, count in tag_counts.most_common()
        if tag != 'Other'
    ) or '  (no tagged bills yet)'

    recent_titles = '\n'.join(
        f'  - {b.title[:120]}' for b in bills[:10]
    ) or '  (no sponsored bills on record)'

    since = alder.office_records[0].start_date.year if alder.office_records else 'unknown'

    resp = client.messages.create(
        model='claude-haiku-4-5-20251001',
        max_tokens=200,
        system=FOCUS_SYSTEM,
        messages=[{
            'role': 'user',
            'content': FOCUS_USER.format(
                name=_format_name(alder.name),
                district=alder.district or 'unknown',
                since=since,
                total_bills=len(bills),
                tag_breakdown=tag_breakdown,
                bill_titles=recent_titles,
            ),
        }],
    )
    return resp.content[0].text.strip()


def run(force: bool = False) -> None:
    session = SessionLocal()
    client = anthropic.Anthropic(api_key=os.environ['ANTHROPIC_API_KEY'])

    try:
        alders = (
            session.query(Alder)
            .options(
                joinedload(Alder.sponsored_matters)
                    .joinedload(MatterSponsor.matter)
                    .joinedload(Matter.tags)
                    .joinedload(MatterTag.tag),
                joinedload(Alder.office_records),
            )
            .filter(Alder.active == True, Alder.district.isnot(None))  # noqa: E712
            .order_by(Alder.district)
            .all()
        )

        log.info('Found %d active alders', len(alders))

        for alder in alders:
            if not force and alder.focus_summary:
                log.info('Skipping %s — already enriched', alder.name)
                continue

            bills = [
                ms.matter for ms in alder.sponsored_matters
                if ms.matter and ms.matter.matter_type not in {
                    'Communication', 'Motion', 'Claim', 'Settlement',
                }
            ]
            # Sort by intro_date descending, most recent first
            bills.sort(key=lambda m: m.intro_date or datetime.min, reverse=True)

            log.info('Enriching %s (District %s, %d bills)…', alder.name, alder.district, len(bills))

            try:
                summary = _call_focus_summary(client, alder, bills)
                alder.focus_summary = summary
                alder.ai_enriched_at = datetime.utcnow()
                session.commit()
                log.info('  → %s', summary[:100])
            except Exception as e:
                log.error('  Error: %s', e)
                session.rollback()

    finally:
        session.close()


if __name__ == '__main__':
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s %(levelname)s — %(message)s',
        datefmt='%H:%M:%S',
    )
    parser = argparse.ArgumentParser()
    parser.add_argument('--force', action='store_true', help='Re-enrich already-enriched alders')
    args = parser.parse_args()
    run(force=args.force)
