import re
import secrets

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..database import SessionLocal
from ..models import Subscriber, SubscriberPreference


def get_client_ip(request: Request) -> str:
    # request.client.host is Railway's edge proxy, not the real client, and can
    # vary per request -- defeats per-client rate limiting entirely. slowapi
    # ships get_ipaddr() for exactly this, but its X-Forwarded-For lookup uses
    # the header name with an underscore ("X_FORWARDED_FOR"), which never
    # matches the real hyphenated HTTP header, so it silently never fires.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)


router = APIRouter()
limiter = Limiter(key_func=get_client_ip)


class SubscribeRequest(BaseModel):
    email: str
    tags: list[str] = []
    district: str | None = None
    mayor_actions: bool = False
    digest_mode: str = "daily"
    priority_tags: list[str] = []
    priority_district: bool = False


@router.post("/api/subscriptions")
@limiter.limit("5/hour")
def create_subscription(request: Request, body: SubscribeRequest):
    if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', body.email):
        raise HTTPException(status_code=422, detail="Invalid email address")
    if not body.tags and not body.district:
        raise HTTPException(status_code=422, detail="Select at least one issue area or district")
    if body.digest_mode not in ("daily", "weekly", "immediate"):
        raise HTTPException(status_code=422, detail="Invalid digest_mode")

    session = SessionLocal()
    try:
        sub = session.query(Subscriber).filter(Subscriber.email == body.email).first()
        if sub:
            session.query(SubscriberPreference).filter(
                SubscriberPreference.subscriber_id == sub.id
            ).delete()
        else:
            sub = Subscriber(email=body.email, unsubscribe_token=secrets.token_hex(32))
            session.add(sub)
            session.flush()

        sub.digest_mode = body.digest_mode
        sub.priority_tags = body.priority_tags
        sub.priority_district = body.priority_district
        sub.active = True

        for tag in body.tags:
            session.add(SubscriberPreference(
                subscriber_id=sub.id,
                preference_type="tag",
                preference_value=tag,
            ))
        if body.district:
            session.add(SubscriberPreference(
                subscriber_id=sub.id,
                preference_type="district",
                preference_value=body.district,
            ))
        if body.mayor_actions:
            session.add(SubscriberPreference(
                subscriber_id=sub.id,
                preference_type="mayor_actions",
                preference_value="true",
            ))

        session.commit()

        # Send confirmation email (best-effort — don't fail the request if it errors)
        try:
            import os
            from notifications.email import send_email
            from notifications.templates import confirmation_email
            site_url = os.getenv("SITE_URL", "https://creamcitydocket.com")
            manage_url = f"{site_url}/subscribe?token={sub.unsubscribe_token}"
            unsubscribe_url = f"{site_url}/subscribe?token={sub.unsubscribe_token}&action=unsubscribe"
            subj, html, text = confirmation_email(
                tags=body.tags,
                district=body.district,
                manage_url=manage_url,
                unsubscribe_url=unsubscribe_url,
            )
            send_email(to=sub.email, subject=subj, html=html, text=text)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error("Confirmation email failed: %s", e)

        return {"ok": True, "token": sub.unsubscribe_token}
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@router.get("/api/subscriptions/{token}")
def get_subscription(token: str):
    session = SessionLocal()
    try:
        sub = session.query(Subscriber).filter_by(unsubscribe_token=token).first()
        if not sub:
            raise HTTPException(status_code=404, detail="Subscription not found")
        return {
            "email": sub.email,
            "tags": [p.preference_value for p in sub.preferences if p.preference_type == "tag"],
            "district": next((p.preference_value for p in sub.preferences if p.preference_type == "district"), None),
            "mayor_actions": any(p.preference_type == "mayor_actions" for p in sub.preferences),
            "digest_mode": sub.digest_mode,
            "priority_tags": sub.priority_tags or [],
            "priority_district": sub.priority_district,
        }
    finally:
        session.close()


class UpdateSubscriptionRequest(BaseModel):
    tags: list[str] = []
    district: str | None = None
    mayor_actions: bool = False
    digest_mode: str = "daily"
    priority_tags: list[str] = []
    priority_district: bool = False


@router.patch("/api/subscriptions/{token}")
def update_subscription(token: str, body: UpdateSubscriptionRequest):
    if not body.tags and not body.district and not body.mayor_actions:
        raise HTTPException(status_code=422, detail="Select at least one issue area or district")
    if body.digest_mode not in ("daily", "weekly", "immediate"):
        raise HTTPException(status_code=422, detail="Invalid digest_mode")
    session = SessionLocal()
    try:
        sub = session.query(Subscriber).filter_by(unsubscribe_token=token).first()
        if not sub:
            raise HTTPException(status_code=404, detail="Subscription not found")
        sub.digest_mode = body.digest_mode
        sub.priority_tags = body.priority_tags
        sub.priority_district = body.priority_district
        session.query(SubscriberPreference).filter_by(subscriber_id=sub.id).delete()
        for tag in body.tags:
            session.add(SubscriberPreference(subscriber_id=sub.id, preference_type="tag", preference_value=tag))
        if body.district:
            session.add(SubscriberPreference(subscriber_id=sub.id, preference_type="district", preference_value=body.district))
        if body.mayor_actions:
            session.add(SubscriberPreference(subscriber_id=sub.id, preference_type="mayor_actions", preference_value="true"))
        session.commit()
        return {"ok": True}
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@router.delete("/api/subscriptions/{token}")
def delete_subscription(token: str):
    session = SessionLocal()
    try:
        sub = session.query(Subscriber).filter_by(unsubscribe_token=token).first()
        if not sub:
            raise HTTPException(status_code=404, detail="Subscription not found")
        session.query(SubscriberPreference).filter_by(subscriber_id=sub.id).delete()
        session.delete(sub)
        session.commit()
        return {"ok": True}
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
