"""
Outbox Worker Tasks

Celery tasks to process ready events from events_outbox with retry/backoff.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import uuid

from ..extensions import celery, db
from ..models.audit import EventOutbox


def emit_event(
    tenant_id: uuid.UUID,
    event_code: str,
    payload: Optional[Dict[str, Any]] = None,
    ready_at: Optional[datetime] = None,
    max_attempts: int = 3
) -> EventOutbox:
    """Emit an event to the outbox for asynchronous processing."""
    event = EventOutbox(
        tenant_id=tenant_id,
        event_code=event_code,
        payload=payload or {},
        ready_at=ready_at or datetime.utcnow(),
        max_attempts=max_attempts,
        status="ready"
    )
    db.session.add(event)
    db.session.commit()
    return event


def _send_email_via_provider(event: EventOutbox) -> bool:
    payload: Dict[str, Any] = event.payload or {}
    return not payload.get("force_fail", False)


def _post_webhook(event: EventOutbox) -> bool:
    payload: Dict[str, Any] = event.payload or {}
    return not payload.get("force_fail", False)


def _record_analytics_event(event: EventOutbox) -> bool:
    payload: Dict[str, Any] = event.payload or {}
    return not payload.get("force_fail", False)


def _process_single_event(event: EventOutbox) -> bool:
    code = event.event_code or ""
    if code.startswith("NOTIFY_"):
        return _send_email_via_provider(event)
    if code.startswith("WEBHOOK_"):
        return _post_webhook(event)
    if code.startswith("ANALYTICS_"):
        return _record_analytics_event(event)
    # Unknown codes succeed by default to avoid infinite retries in dev
    return True


@celery.task(name="app.jobs.outbox_worker.process_ready_outbox_events")
def process_ready_outbox_events(batch_limit: int = 100) -> int:
    """Process ready events with retry/backoff. Returns processed count."""
    now = datetime.utcnow()
    events = (
        EventOutbox.query
        .filter(
            EventOutbox.status == "ready",
            EventOutbox.attempts < EventOutbox.max_attempts,
            EventOutbox.ready_at <= now,
        )
        .order_by(EventOutbox.ready_at.asc())
        .limit(batch_limit)
        .all()
    )

    processed = 0
    for event in events:
        try:
            success = _process_single_event(event)
            if success:
                event.status = "delivered"
                event.delivered_at = datetime.utcnow()
                celery.app.logger.info(
                    "EVENT_PROCESSED",
                    extra={
                        "tenant_id": str(event.tenant_id),
                        "event_code": event.event_code,
                        "event_id": str(event.id),
                        "attempts": event.attempts,
                    },
                )
            else:
                event.attempts += 1
                event.last_attempt_at = datetime.utcnow()
                if event.attempts >= (event.max_attempts or 3):
                    event.status = "failed"
                    event.failed_at = datetime.utcnow()
                else:
                    # simple linear backoff 1 minute per attempt
                    backoff_seconds = 60
                    event.ready_at = datetime.utcnow() + timedelta(seconds=backoff_seconds)
                celery.app.logger.warning(
                    "EVENT_FAILED",
                    extra={
                        "tenant_id": str(event.tenant_id),
                        "event_code": event.event_code,
                        "event_id": str(event.id),
                        "attempts": event.attempts,
                    },
                )
            db.session.add(event)
            processed += 1
        except Exception as exc:  # pragma: no cover - defensive
            event.attempts += 1
            event.last_attempt_at = datetime.utcnow()
            event.error_message = str(exc)
            if event.attempts >= (event.max_attempts or 3):
                event.status = "failed"
                event.failed_at = datetime.utcnow()
            else:
                event.ready_at = datetime.utcnow() + timedelta(seconds=60)
            db.session.add(event)
        finally:
            db.session.commit()

    return processed


