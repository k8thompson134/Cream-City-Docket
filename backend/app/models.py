from datetime import datetime
from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint,
    JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


class Alder(Base):
    __tablename__ = "alders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    legistar_person_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    district: Mapped[str | None] = mapped_column(String(10))
    email: Mapped[str | None] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(50))
    photo_url: Mapped[str | None] = mapped_column(String(500))
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    sponsored_matters: Mapped[list["MatterSponsor"]] = relationship(back_populates="alder")
    votes: Mapped[list["Vote"]] = relationship(back_populates="alder")


class Committee(Base):
    __tablename__ = "committees"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    legistar_body_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    events: Mapped[list["Event"]] = relationship(back_populates="committee")


class IssueTag(Base):
    __tablename__ = "issue_tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    matters: Mapped[list["MatterTag"]] = relationship(back_populates="tag")


class Matter(Base):
    __tablename__ = "matters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    legistar_matter_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    legistar_guid: Mapped[str] = mapped_column(String(36), nullable=False)
    file_number: Mapped[str | None] = mapped_column(String(50))  # MatterFile
    title: Mapped[str] = mapped_column(Text, nullable=False)
    matter_type: Mapped[str] = mapped_column(String(100), nullable=False)   # MatterTypeName
    matter_status: Mapped[str] = mapped_column(String(100), nullable=False)  # MatterStatusName
    body_name: Mapped[str | None] = mapped_column(String(300))              # MatterBodyName
    intro_date: Mapped[datetime | None] = mapped_column(DateTime)
    agenda_date: Mapped[datetime | None] = mapped_column(DateTime)
    passed_date: Mapped[datetime | None] = mapped_column(DateTime)
    enactment_date: Mapped[datetime | None] = mapped_column(DateTime)
    enactment_number: Mapped[str | None] = mapped_column(String(50))
    # Text versioning — from /Versions endpoint
    current_text_id: Mapped[str | None] = mapped_column(String(20))    # Key from /Versions
    current_text_version: Mapped[str | None] = mapped_column(String(10))  # "0", "1", etc.
    raw_text: Mapped[str | None] = mapped_column(Text)                 # MatterTextPlain
    # LLM enrichment
    summary: Mapped[str | None] = mapped_column(Text)
    enriched_at: Mapped[datetime | None] = mapped_column(DateTime)
    last_modified_utc: Mapped[datetime | None] = mapped_column(DateTime)   # MatterLastModifiedUtc
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    sponsors: Mapped[list["MatterSponsor"]] = relationship(back_populates="matter")
    tags: Mapped[list["MatterTag"]] = relationship(back_populates="matter")
    history: Mapped[list["MatterHistory"]] = relationship(back_populates="matter")
    mayor_actions: Mapped[list["MayorAction"]] = relationship(back_populates="matter")
    event_items: Mapped[list["EventItem"]] = relationship(back_populates="matter")


class MatterSponsor(Base):
    __tablename__ = "matter_sponsors"
    __table_args__ = (UniqueConstraint("matter_id", "alder_id", "matter_version"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    matter_id: Mapped[int] = mapped_column(ForeignKey("matters.id"), nullable=False)
    alder_id: Mapped[int] = mapped_column(ForeignKey("alders.id"), nullable=False)
    matter_version: Mapped[str] = mapped_column(String(10), nullable=False)  # MatterSponsorMatterVersion
    sequence: Mapped[int] = mapped_column(Integer, default=0)

    matter: Mapped["Matter"] = relationship(back_populates="sponsors")
    alder: Mapped["Alder"] = relationship(back_populates="sponsored_matters")


class MatterTag(Base):
    __tablename__ = "matter_tags"
    __table_args__ = (UniqueConstraint("matter_id", "tag_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    matter_id: Mapped[int] = mapped_column(ForeignKey("matters.id"), nullable=False)
    tag_id: Mapped[int] = mapped_column(ForeignKey("issue_tags.id"), nullable=False)

    matter: Mapped["Matter"] = relationship(back_populates="tags")
    tag: Mapped["IssueTag"] = relationship(back_populates="matters")


class MatterHistory(Base):
    __tablename__ = "matter_history"
    __table_args__ = (UniqueConstraint("matter_id", "action_name", "action_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    matter_id: Mapped[int] = mapped_column(ForeignKey("matters.id"), nullable=False)
    action_name: Mapped[str] = mapped_column(String(200), nullable=False)   # e.g. PASSED, SIGNED
    action_date: Mapped[datetime | None] = mapped_column(DateTime)
    result: Mapped[str | None] = mapped_column(String(50))                  # Pass / Fail / None
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    matter: Mapped["Matter"] = relationship(back_populates="history")


class MayorAction(Base):
    __tablename__ = "mayor_actions"
    __table_args__ = (UniqueConstraint("matter_id", "action_type"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    matter_id: Mapped[int] = mapped_column(ForeignKey("matters.id"), nullable=False)
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)   # signed / vetoed / lapsed / published
    action_date: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    matter: Mapped["Matter"] = relationship(back_populates="mayor_actions")


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    legistar_event_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    committee_id: Mapped[int | None] = mapped_column(ForeignKey("committees.id"))
    body_name: Mapped[str | None] = mapped_column(String(300))
    date: Mapped[datetime | None] = mapped_column(DateTime)
    location: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    committee: Mapped["Committee | None"] = relationship(back_populates="events")
    items: Mapped[list["EventItem"]] = relationship(back_populates="event")


class EventItem(Base):
    __tablename__ = "event_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    legistar_event_item_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), nullable=False)
    matter_id: Mapped[int | None] = mapped_column(ForeignKey("matters.id"))
    action_name: Mapped[str | None] = mapped_column(String(200))
    passed_flag: Mapped[str | None] = mapped_column(String(50))            # Pass / Fail
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    event: Mapped["Event"] = relationship(back_populates="items")
    matter: Mapped["Matter | None"] = relationship(back_populates="event_items")
    votes: Mapped[list["Vote"]] = relationship(back_populates="event_item")


class Vote(Base):
    __tablename__ = "votes"
    __table_args__ = (UniqueConstraint("alder_id", "event_item_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    legistar_vote_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    alder_id: Mapped[int] = mapped_column(ForeignKey("alders.id"), nullable=False)
    event_item_id: Mapped[int] = mapped_column(ForeignKey("event_items.id"), nullable=False)
    matter_id: Mapped[int | None] = mapped_column(ForeignKey("matters.id"))   # denormalized for fast lookup
    vote_value: Mapped[str | None] = mapped_column(String(50))                # Yea / Nay / Abstain
    voted_at: Mapped[datetime | None] = mapped_column(DateTime)

    alder: Mapped["Alder"] = relationship(back_populates="votes")
    event_item: Mapped["EventItem"] = relationship(back_populates="votes")
    matter: Mapped["Matter | None"] = relationship(foreign_keys=[matter_id])


class Subscriber(Base):
    __tablename__ = "subscribers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(300), unique=True, nullable=False)
    unsubscribe_token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    # "immediate" = one email per matching matter (original behavior)
    # "daily"     = one digest email per day (default — prevents flood)
    # "weekly"    = one digest email per week
    digest_mode: Mapped[str] = mapped_column(String(20), default="daily", nullable=False)
    # JSON list of tag names / matter types that always send immediately
    # regardless of digest_mode, e.g. ["Budget and Finance", "Housing"]
    priority_tags: Mapped[list | None] = mapped_column(JSON, default=list)
    # Whether to also get priority alerts for the subscriber's own district
    priority_district: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    preferences: Mapped[list["SubscriberPreference"]] = relationship(back_populates="subscriber", cascade="all, delete-orphan")
    alert_log: Mapped[list["AlertLog"]] = relationship(back_populates="subscriber", cascade="all, delete-orphan")
    queued_notifications: Mapped[list["NotificationQueue"]] = relationship(back_populates="subscriber", cascade="all, delete-orphan")


class SubscriberPreference(Base):
    __tablename__ = "subscriber_preferences"
    __table_args__ = (UniqueConstraint("subscriber_id", "preference_type", "preference_value"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subscriber_id: Mapped[int] = mapped_column(ForeignKey("subscribers.id"), nullable=False)
    preference_type: Mapped[str] = mapped_column(String(20), nullable=False)   # "tag" or "district"
    preference_value: Mapped[str] = mapped_column(String(100), nullable=False)

    subscriber: Mapped["Subscriber"] = relationship(back_populates="preferences")


class NotificationQueue(Base):
    """Staging table for alerts that haven't been sent yet.
    The digest worker drains this table on schedule.
    Priority items are sent immediately and skip the queue."""
    __tablename__ = "notification_queue"
    __table_args__ = (UniqueConstraint("subscriber_id", "matter_id", "trigger_event"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subscriber_id: Mapped[int] = mapped_column(ForeignKey("subscribers.id"), nullable=False)
    matter_id: Mapped[int] = mapped_column(ForeignKey("matters.id"), nullable=False)
    trigger_event: Mapped[str] = mapped_column(String(100), nullable=False)
    is_priority: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    subscriber: Mapped["Subscriber"] = relationship(back_populates="queued_notifications")
    matter: Mapped["Matter"] = relationship()


class AlertLog(Base):
    __tablename__ = "alert_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subscriber_id: Mapped[int] = mapped_column(ForeignKey("subscribers.id"), nullable=False)
    matter_id: Mapped[int] = mapped_column(ForeignKey("matters.id"), nullable=False)
    trigger_event: Mapped[str] = mapped_column(String(100), nullable=False)   # e.g. "introduced", "hearing_scheduled"
    # "immediate" for priority sends, "digest" for batched sends
    delivery_type: Mapped[str] = mapped_column(String(20), default="digest", nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    subscriber: Mapped["Subscriber"] = relationship(back_populates="alert_log")


class PollLog(Base):
    __tablename__ = "poll_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    polled_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    matters_fetched: Mapped[int] = mapped_column(Integer, default=0)
    matters_upserted: Mapped[int] = mapped_column(Integer, default=0)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text)
