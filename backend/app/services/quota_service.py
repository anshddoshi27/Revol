"""
Quota Service: enforce quotas via usage_counters with transactional increments.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from sqlalchemy import and_, or_, func, text
from sqlalchemy.exc import SQLAlchemyError

from ..extensions import db
from ..middleware.error_handler import TithiError
from ..models.system import EventOutbox
import logging


class QuotaService:
    """Service for enforcing tenant quotas with concurrency safety."""

    def _current_period_start(self, period_type: str) -> datetime:
        now = datetime.now(timezone.utc)
        if period_type == 'daily':
            return now.replace(hour=0, minute=0, second=0, microsecond=0)
        if period_type == 'monthly':
            return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        # default to hourly
        return now.replace(minute=0, second=0, microsecond=0)

    def check_and_increment(self, tenant_id: uuid.UUID, code: str, increment: int = 1) -> None:
        """Check quota and increment usage atomically. Raises on exceed."""
        # Fetch active quota definition
        quota_row = db.session.execute(text(
            """
            SELECT code, limit_value, period_type
            FROM quotas
            WHERE tenant_id = :tenant_id AND code = :code AND is_active = true
            LIMIT 1
            """
        ), {"tenant_id": str(tenant_id), "code": code}).mappings().first()

        if not quota_row:
            return

        period_start = self._current_period_start(quota_row["period_type"]).isoformat()

        # Begin transaction
        with db.session.begin_nested():
            # Lock the counter row if exists
            existing = db.session.execute(text(
                """
                SELECT count
                FROM usage_counters
                WHERE tenant_id = :tenant_id AND code = :code AND period_start = :period_start
                FOR UPDATE
                """
            ), {"tenant_id": str(tenant_id), "code": code, "period_start": period_start}).mappings().first()

            if not existing:
                # Insert new row with initial count after checking limit
                if increment > quota_row["limit_value"]:
                    # Emit outbox event for exceeded quota
                    db.session.add(EventOutbox(
                        tenant_id=tenant_id,
                        event_code="QUOTA_EXCEEDED",
                        payload={"code": code, "attempt_increment": increment},
                        status="ready",
                    ))
                    logging.getLogger(__name__).warning("QUOTA_EXCEEDED", extra={"tenant_id": str(tenant_id), "code": code})
                    raise TithiError(code="TITHI_QUOTA_EXCEEDED", message=f"Quota exceeded for {code}", status_code=403)
                db.session.execute(text(
                    """
                    INSERT INTO usage_counters(tenant_id, code, period_start, count, updated_at)
                    VALUES (:tenant_id, :code, :period_start, :count, now())
                    """
                ), {"tenant_id": str(tenant_id), "code": code, "period_start": period_start, "count": increment})
            else:
                current_count = existing["count"]
                if current_count + increment > quota_row["limit_value"]:
                    db.session.add(EventOutbox(
                        tenant_id=tenant_id,
                        event_code="QUOTA_EXCEEDED",
                        payload={"code": code, "current": current_count, "attempt_increment": increment},
                        status="ready",
                    ))
                    logging.getLogger(__name__).warning("QUOTA_EXCEEDED", extra={"tenant_id": str(tenant_id), "code": code})
                    raise TithiError(code="TITHI_QUOTA_EXCEEDED", message=f"Quota exceeded for {code}", status_code=403)
                db.session.execute(text(
                    """
                    UPDATE usage_counters
                    SET count = count + :inc, updated_at = now()
                    WHERE tenant_id = :tenant_id AND code = :code AND period_start = :period_start
                    """
                ), {"tenant_id": str(tenant_id), "code": code, "period_start": period_start, "inc": increment})

    def get_usage(self, tenant_id: uuid.UUID, code: str) -> Optional[Tuple[int, int]]:
        """Return (count, limit) for current period if quota exists, else None."""
        quota_row = db.session.execute(text(
            """
            SELECT limit_value, period_type
            FROM quotas
            WHERE tenant_id = :tenant_id AND code = :code AND is_active = true
            LIMIT 1
            """
        ), {"tenant_id": str(tenant_id), "code": code}).mappings().first()

        if not quota_row:
            return None

        period_start = self._current_period_start(quota_row["period_type"]).isoformat()
        usage_row = db.session.execute(text(
            """
            SELECT count FROM usage_counters
            WHERE tenant_id = :tenant_id AND code = :code AND period_start = :period_start
            """
        ), {"tenant_id": str(tenant_id), "code": code, "period_start": period_start}).mappings().first()

        return (usage_row["count"] if usage_row else 0, quota_row["limit_value"])


