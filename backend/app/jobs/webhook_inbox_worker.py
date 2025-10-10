"""
Webhook Inbox Worker

Celery task to idempotently process webhook events from webhook_events_inbox.
"""

from datetime import datetime

from ..extensions import celery, db
from ..models.audit import WebhookEventInbox


@celery.task(name="app.jobs.webhook_inbox_worker.process_webhook_event")
def process_webhook_event(provider: str, event_id: str) -> bool:
    """Process a webhook event if not already processed. Idempotent."""
    inbox = WebhookEventInbox.query.filter_by(provider=provider, id=event_id).first()
    if inbox is None:
        # Nothing to process
        return False

    if inbox.processed_at is not None:
        return True

    payload = inbox.payload or {}

    # In dev/test we skip signature validation here; endpoint handles it.
    event_type = payload.get("type")

    # Minimal branching; real implementation would delegate to services
    if event_type == "payment_intent.succeeded":
        pass
    elif event_type == "payment_intent.payment_failed":
        pass
    elif event_type == "setup_intent.succeeded":
        pass

    inbox.processed_at = datetime.utcnow()
    db.session.add(inbox)
    db.session.commit()
    return True


