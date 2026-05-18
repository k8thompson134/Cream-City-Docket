"""
M2 Enrichment Worker.
Fetches MatterText for unenriched bills and calls Claude Haiku for
plain-language summaries and issue-area tags.
Run directly: python -m enrichment.worker
"""
import json
import logging
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

import anthropic
from app.database import SessionLocal
from app.models import IssueTag, Matter, MatterTag
from enrichment.prompts import (
    ISSUE_TAXONOMY, SUMMARY_SYSTEM, SUMMARY_USER, TAGS_SYSTEM, TAGS_USER,
    SUBSTITUTE_SYSTEM, SUBSTITUTE_USER,
)
from poller import client as legistar

log = logging.getLogger(__name__)

# MatterTypes not worth enriching (no real legislative content)
SKIP_TYPES = {
    "Communication", "Fire and Police Communication",
    "Communication to Finance", "APPEAL", "Motion",
    "Claim", "Settlement",
}

MAX_TEXT_CHARS = 12_000  # ~3000 tokens — plenty for Haiku, keeps cost low


def _get_haiku_client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


def _call_summary(haiku: anthropic.Anthropic, title: str, matter_type: str, text: str) -> str:
    resp = haiku.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        system=SUMMARY_SYSTEM,
        messages=[{
            "role": "user",
            "content": SUMMARY_USER.format(
                matter_type=matter_type,
                title=title,
                text=text[:MAX_TEXT_CHARS],
            ),
        }],
    )
    return resp.content[0].text.strip()


def _call_tags(haiku: anthropic.Anthropic, title: str, text: str) -> list[str]:
    resp = haiku.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=100,
        system=TAGS_SYSTEM,
        messages=[{
            "role": "user",
            "content": TAGS_USER.format(
                title=title,
                text_excerpt=text[:3000],
            ),
        }],
    )
    raw = resp.content[0].text.strip()
    # Strip markdown code fences if Haiku wrapped the response
    if raw.startswith("```"):
        raw = "\n".join(
            line for line in raw.splitlines()
            if not line.startswith("```")
        ).strip()
    try:
        tags = json.loads(raw)
        return [t for t in tags if t in ISSUE_TAXONOMY] or ["Other"]
    except (json.JSONDecodeError, TypeError):
        log.warning("Bad tags response: %s", raw)
        return ["Other"]


def _ensure_tags_seeded(session) -> dict[str, IssueTag]:
    """Make sure all taxonomy tags exist in issue_tags table. Returns name→tag map."""
    existing = {t.name: t for t in session.query(IssueTag).all()}
    for name in ISSUE_TAXONOMY:
        if name not in existing:
            slug = name.lower().replace(" ", "-").replace("&", "and")
            tag = IssueTag(name=name, slug=slug)
            session.add(tag)
            existing[name] = tag
    session.flush()
    return existing


def _fetch_matter_text(matter_id: int) -> tuple[str | None, str | None, str | None]:
    """Returns (text_id, version_str, plain_text) or (None, None, None) if unavailable."""
    versions = legistar.get_matter_versions(matter_id)
    if not versions:
        return None, None, None

    latest = versions[-1]
    text_id = str(latest["Key"])
    version_str = str(latest["Value"])

    text_data = legistar.get_matter_text(matter_id, text_id)
    plain = (text_data.get("MatterTextPlain") or "").strip()
    if not plain:
        return text_id, version_str, None

    return text_id, version_str, plain


def run_enrichment(batch_size: int = 50) -> dict:
    """
    Enrich up to batch_size unenriched Matters.
    Returns counts: {processed, enriched, skipped, errors}
    """
    session = SessionLocal()
    haiku = _get_haiku_client()
    counts = {"processed": 0, "enriched": 0, "skipped": 0, "errors": 0}

    try:
        tag_map = _ensure_tags_seeded(session)
        session.commit()

        # Matters that need enrichment: never enriched, or text version changed
        candidates = (
            session.query(Matter)
            .filter(
                Matter.matter_type.notin_(SKIP_TYPES),
                Matter.summary.is_(None),
            )
            .order_by(Matter.intro_date.desc().nullslast())
            .limit(batch_size)
            .all()
        )

        log.info("Enrichment batch: %d candidates", len(candidates))

        for matter in candidates:
            counts["processed"] += 1
            legistar_id = matter.legistar_matter_id

            try:
                text_id, version_str, plain_text = _fetch_matter_text(legistar_id)

                if not plain_text:
                    log.info("No text for matter %d — skipping", legistar_id)
                    counts["skipped"] += 1
                    continue

                # Check if already enriched at this version
                if (
                    matter.enriched_at is not None
                    and matter.current_text_id == text_id
                ):
                    log.debug("Matter %d already enriched at current version", legistar_id)
                    counts["skipped"] += 1
                    continue

                log.info("Enriching matter %d: %s", legistar_id, matter.title[:60])

                summary = _call_summary(haiku, matter.title, matter.matter_type, plain_text)
                tag_names = _call_tags(haiku, matter.title, plain_text)

                # Update matter
                from datetime import datetime
                matter.summary = summary
                matter.raw_text = plain_text[:MAX_TEXT_CHARS]
                matter.current_text_id = text_id
                matter.current_text_version = version_str
                matter.enriched_at = datetime.utcnow()

                # Upsert tags
                for tag_name in tag_names:
                    tag = tag_map.get(tag_name)
                    if not tag:
                        continue
                    existing = session.query(MatterTag).filter_by(
                        matter_id=matter.id, tag_id=tag.id
                    ).first()
                    if not existing:
                        session.add(MatterTag(matter_id=matter.id, tag_id=tag.id))

                session.commit()
                counts["enriched"] += 1
                log.info("  → summary written, tags: %s", tag_names)

            except Exception as e:
                log.error("Error enriching matter %d: %s", legistar_id, e)
                session.rollback()
                counts["errors"] += 1

    finally:
        session.close()

    log.info("Enrichment complete: %s", counts)
    return counts


def run_retag_others(batch_size: int = 100) -> dict:
    """
    Re-tag bills whose only tag is 'Other', using the improved prompt and stored raw_text.
    Does not re-fetch from Legistar or regenerate summaries.
    """
    session = SessionLocal()
    haiku = _get_haiku_client()
    counts = {"processed": 0, "retagged": 0, "skipped": 0, "errors": 0}

    try:
        tag_map = _ensure_tags_seeded(session)
        session.commit()

        other_tag = session.query(IssueTag).filter_by(name="Other").first()
        if not other_tag:
            log.info("No 'Other' tag found — nothing to retag")
            return counts

        # Bills with exactly the "Other" tag and stored raw_text
        candidates = (
            session.query(Matter)
            .join(Matter.tags)
            .filter(
                Matter.summary.isnot(None),
                Matter.raw_text.isnot(None),
                MatterTag.tag_id == other_tag.id,
            )
            .filter(~Matter.tags.any(MatterTag.tag_id != other_tag.id))
            .limit(batch_size)
            .all()
        )

        log.info("Retag batch: %d Other-only candidates", len(candidates))

        for matter in candidates:
            counts["processed"] += 1
            try:
                tag_names = _call_tags(haiku, matter.title, matter.raw_text)

                session.query(MatterTag).filter_by(matter_id=matter.id).delete()
                for tag_name in tag_names:
                    tag = tag_map.get(tag_name)
                    if tag:
                        session.add(MatterTag(matter_id=matter.id, tag_id=tag.id))

                session.commit()
                counts["retagged"] += 1
                log.info("  %d → %s", matter.legistar_matter_id, tag_names)

            except Exception as e:
                log.error("Error retagging matter %d: %s", matter.legistar_matter_id, e)
                session.rollback()
                counts["errors"] += 1

    finally:
        session.close()

    log.info("Retag complete: %s", counts)
    return counts


def run_substitute_enrichment(batch_size: int = 20) -> dict:
    """
    For bills with a SUBSTITUTE history entry introduced in the last 12 months,
    fetch both text versions from Legistar and generate a plain-English diff summary.
    """
    from datetime import datetime, timedelta
    from app.models import MatterHistory

    session = SessionLocal()
    haiku = _get_haiku_client()
    counts = {"processed": 0, "enriched": 0, "skipped": 0, "errors": 0}

    cutoff = datetime.utcnow() - timedelta(days=365)

    try:
        # Bills with a SUBSTITUTE history entry, no substitute_summary yet, introduced < 12 months ago
        candidates = (
            session.query(Matter)
            .join(Matter.history)
            .filter(
                MatterHistory.action_name.ilike('%substitute%'),
                Matter.substitute_summary.is_(None),
                Matter.intro_date >= cutoff,
                Matter.raw_text.isnot(None),
            )
            .distinct()
            .order_by(Matter.intro_date.desc())
            .limit(batch_size)
            .all()
        )

        log.info("Substitute diff batch: %d candidates", len(candidates))

        for matter in candidates:
            counts["processed"] += 1
            legistar_id = matter.legistar_matter_id
            try:
                versions = legistar.get_matter_versions(legistar_id)
                if len(versions) < 2:
                    log.info("Matter %d has only %d version(s) — skipping", legistar_id, len(versions))
                    matter.substitute_summary = ""  # mark as checked so we don't retry
                    session.commit()
                    counts["skipped"] += 1
                    continue

                # versions are ordered oldest→newest; take second-to-last as original
                original_version = versions[-2]
                original_text_id = str(original_version["Key"])

                # Skip if we already processed this version pair
                if matter.pre_substitute_text_id == original_text_id:
                    counts["skipped"] += 1
                    continue

                original_data = legistar.get_matter_text(legistar_id, original_text_id)
                original_text = (original_data.get("MatterTextPlain") or "").strip()

                if not original_text:
                    log.info("Matter %d: no original text for version %s — skipping", legistar_id, original_text_id)
                    counts["skipped"] += 1
                    continue

                # Current text is already stored in raw_text
                substitute_text = matter.raw_text or ""

                log.info("Diffing matter %d: %s", legistar_id, matter.title[:60])

                resp = haiku.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=300,
                    system=SUBSTITUTE_SYSTEM,
                    messages=[{
                        "role": "user",
                        "content": SUBSTITUTE_USER.format(
                            matter_type=matter.matter_type,
                            title=matter.title,
                            original_text=original_text[:6000],
                            substitute_text=substitute_text[:6000],
                        ),
                    }],
                )

                matter.substitute_summary = resp.content[0].text.strip()
                matter.pre_substitute_text_id = original_text_id
                session.commit()
                counts["enriched"] += 1
                log.info("  → diff written")

            except Exception as e:
                log.error("Error on matter %d: %s", legistar_id, e)
                session.rollback()
                counts["errors"] += 1

    finally:
        session.close()

    log.info("Substitute enrichment complete: %s", counts)
    return counts


if __name__ == "__main__":
    import sys
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s — %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    if len(sys.argv) > 1 and sys.argv[1] == "retag":
        run_retag_others(batch_size=200)
    elif len(sys.argv) > 1 and sys.argv[1] == "substitute":
        run_substitute_enrichment(batch_size=20)
    else:
        run_enrichment(batch_size=50)
