"""
Timezone Service

This module provides comprehensive timezone handling for the Tithi platform.
All timestamps are stored in UTC and converted to tenant timezone at display/API layer.
"""

import pytz
import logging
from datetime import datetime, timezone as dt_timezone
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from ..models.core import Tenant
from ..extensions import db
from ..exceptions import TithiError

logger = logging.getLogger(__name__)


class TimezoneService:
    """Service for handling timezone conversions and tenant timezone management."""
    
    # Common timezone mappings for user-friendly names
    COMMON_TIMEZONES = {
        'EST': 'America/New_York',
        'PST': 'America/Los_Angeles', 
        'CST': 'America/Chicago',
        'MST': 'America/Denver',
        'UTC': 'UTC',
        'GMT': 'Europe/London',
        'CET': 'Europe/Paris',
        'JST': 'Asia/Tokyo',
        'AEST': 'Australia/Sydney',
        'IST': 'Asia/Kolkata'
    }
    
    def __init__(self):
        """Initialize the timezone service."""
        self.logger = logger
    
    def get_tenant_timezone(self, tenant_id: str) -> pytz.BaseTzInfo:
        """
        Get the timezone for a specific tenant.
        
        Args:
            tenant_id: The tenant UUID
            
        Returns:
            pytz timezone object
            
        Raises:
            TithiError: If tenant not found or invalid timezone
        """
        try:
            tenant = Tenant.query.filter_by(id=tenant_id).first()
            if not tenant:
                raise TithiError(
                    message="Tenant not found",
                    code="TITHI_TENANT_NOT_FOUND",
                    status_code=404
                )
            
            timezone_str = tenant.tz or 'UTC'
            return self._parse_timezone(timezone_str)
            
        except Exception as e:
            self.logger.error(f"Failed to get tenant timezone: {str(e)}")
            raise TithiError(
                message="Failed to get tenant timezone",
                code="TITHI_TIMEZONE_INVALID",
                status_code=400
            )
    
    def convert_to_tenant_timezone(self, utc_datetime: datetime, tenant_id: str) -> datetime:
        """
        Convert UTC datetime to tenant timezone.
        
        Args:
            utc_datetime: UTC datetime object
            tenant_id: The tenant UUID
            
        Returns:
            Datetime in tenant timezone
            
        Raises:
            TithiError: If conversion fails
        """
        try:
            if utc_datetime.tzinfo is None:
                # Assume UTC if no timezone info
                utc_datetime = utc_datetime.replace(tzinfo=dt_timezone.utc)
            elif utc_datetime.tzinfo != dt_timezone.utc:
                # Convert to UTC first
                utc_datetime = utc_datetime.astimezone(dt_timezone.utc)
            
            tenant_tz = self.get_tenant_timezone(tenant_id)
            tenant_datetime = utc_datetime.astimezone(tenant_tz)
            
            # Emit observability hook
            self._emit_timezone_conversion_hook(tenant_id, 'UTC_TO_TENANT', utc_datetime, tenant_datetime)
            
            return tenant_datetime
            
        except Exception as e:
            self.logger.error(f"Failed to convert to tenant timezone: {str(e)}")
            raise TithiError(
                message="Failed to convert to tenant timezone",
                code="TITHI_TIMEZONE_INVALID",
                status_code=400
            )
    
    def convert_to_utc(self, tenant_datetime: datetime, tenant_id: str) -> datetime:
        """
        Convert tenant timezone datetime to UTC.
        
        Args:
            tenant_datetime: Datetime in tenant timezone
            tenant_id: The tenant UUID
            
        Returns:
            UTC datetime object
            
        Raises:
            TithiError: If conversion fails
        """
        try:
            tenant_tz = self.get_tenant_timezone(tenant_id)
            
            # If datetime is naive, assume it's in tenant timezone
            if tenant_datetime.tzinfo is None:
                tenant_datetime = tenant_tz.localize(tenant_datetime)
            else:
                # Convert to tenant timezone first, then to UTC
                tenant_datetime = tenant_datetime.astimezone(tenant_tz)
            
            utc_datetime = tenant_datetime.astimezone(dt_timezone.utc)
            
            # Emit observability hook
            self._emit_timezone_conversion_hook(tenant_id, 'TENANT_TO_UTC', tenant_datetime, utc_datetime)
            
            return utc_datetime
            
        except Exception as e:
            self.logger.error(f"Failed to convert to UTC: {str(e)}")
            raise TithiError(
                message="Failed to convert to UTC",
                code="TITHI_TIMEZONE_INVALID",
                status_code=400
            )
    
    def update_tenant_timezone(self, tenant_id: str, timezone_str: str) -> Dict[str, Any]:
        """
        Update tenant timezone setting.
        
        Args:
            tenant_id: The tenant UUID
            timezone_str: New timezone string
            
        Returns:
            Updated tenant timezone info
            
        Raises:
            TithiError: If timezone is invalid or update fails
        """
        try:
            # Validate timezone
            self._parse_timezone(timezone_str)
            
            tenant = Tenant.query.filter_by(id=tenant_id).first()
            if not tenant:
                raise TithiError(
                    message="Tenant not found",
                    code="TITHI_TENANT_NOT_FOUND",
                    status_code=404
                )
            
            old_timezone = tenant.tz
            tenant.tz = timezone_str
            db.session.commit()
            
            self.logger.info(f"Updated tenant {tenant_id} timezone from {old_timezone} to {timezone_str}")
            
            return {
                'tenant_id': tenant_id,
                'old_timezone': old_timezone,
                'new_timezone': timezone_str,
                'updated_at': datetime.utcnow().isoformat() + 'Z'
            }
            
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Failed to update tenant timezone: {str(e)}")
            raise TithiError(
                message="Failed to update tenant timezone",
                code="TITHI_TIMEZONE_INVALID",
                status_code=400
            )
    
    def get_available_timezones(self) -> List[Dict[str, str]]:
        """
        Get list of available timezones.
        
        Returns:
            List of timezone dictionaries with name and display name
        """
        timezones = []
        
        # Add common timezones first
        for display_name, tz_name in self.COMMON_TIMEZONES.items():
            timezones.append({
                'name': tz_name,
                'display_name': f"{display_name} ({tz_name})"
            })
        
        # Add all pytz timezones
        for tz_name in pytz.all_timezones:
            if tz_name not in self.COMMON_TIMEZONES.values():
                timezones.append({
                    'name': tz_name,
                    'display_name': tz_name
                })
        
        return sorted(timezones, key=lambda x: x['display_name'])
    
    def validate_timezone(self, timezone_str: str) -> Dict[str, Any]:
        """
        Validate a timezone string.
        
        Args:
            timezone_str: Timezone string to validate
            
        Returns:
            Validation result with timezone info
            
        Raises:
            TithiError: If timezone is invalid
        """
        try:
            tz = self._parse_timezone(timezone_str)
            
            # Get current time in this timezone
            now_utc = datetime.now(dt_timezone.utc)
            now_tz = now_utc.astimezone(tz)
            
            return {
                'valid': True,
                'timezone': timezone_str,
                'utc_offset': now_tz.strftime('%z'),
                'dst_active': now_tz.dst() != dt_timezone.utc.localize(datetime(1970, 1, 1)).dst(),
                'current_time': now_tz.strftime('%Y-%m-%d %H:%M:%S %Z'),
                'utc_time': now_utc.strftime('%Y-%m-%d %H:%M:%S UTC')
            }
            
        except Exception as e:
            raise TithiError(
                message=f"Invalid timezone: {timezone_str}",
                code="TITHI_TIMEZONE_INVALID",
                status_code=400
            )
    
    def _parse_timezone(self, timezone_str: str) -> pytz.BaseTzInfo:
        """
        Parse timezone string to pytz timezone object.
        
        Args:
            timezone_str: Timezone string
            
        Returns:
            pytz timezone object
            
        Raises:
            ValueError: If timezone is invalid
        """
        # Check if it's a common timezone alias
        if timezone_str.upper() in self.COMMON_TIMEZONES:
            timezone_str = self.COMMON_TIMEZONES[timezone_str.upper()]
        
        # Handle UTC specially
        if timezone_str.upper() == 'UTC':
            return pytz.UTC
        
        # Try to get the timezone
        try:
            return pytz.timezone(timezone_str)
        except pytz.UnknownTimeZoneError:
            raise ValueError(f"Unknown timezone: {timezone_str}")
    
    def _emit_timezone_conversion_hook(self, tenant_id: str, conversion_type: str, 
                                     from_datetime: datetime, to_datetime: datetime) -> None:
        """
        Emit observability hook for timezone conversion.
        
        Args:
            tenant_id: The tenant UUID
            conversion_type: Type of conversion (UTC_TO_TENANT or TENANT_TO_UTC)
            from_datetime: Source datetime
            to_datetime: Target datetime
        """
        try:
            self.logger.info(
                f"TIMEZONE_CONVERTED: tenant_id={tenant_id}, "
                f"conversion_type={conversion_type}, "
                f"from={from_datetime.isoformat()}, "
                f"to={to_datetime.isoformat()}"
            )
        except Exception as e:
            self.logger.error(f"Failed to emit timezone conversion hook: {str(e)}")


# Global timezone service instance
timezone_service = TimezoneService()
