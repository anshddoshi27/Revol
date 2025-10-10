"""
SMS Service

This module provides SMS notification functionality with Twilio integration,
opt-in validation, and comprehensive error handling.

Aligned with Task 7.2 requirements and TITHI_DATABASE_COMPREHENSIVE_REPORT.md.
"""

import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from enum import Enum

from twilio.rest import Client
from twilio.base.exceptions import TwilioException
from sqlalchemy.exc import SQLAlchemyError

from ..extensions import db
from ..models.notification import Notification, NotificationChannel, NotificationStatus, NotificationPreference
from ..models.business import Customer
from ..models.audit import EventOutbox
from ..models.core import Tenant
from ..exceptions import TithiError


logger = logging.getLogger(__name__)


class SMSErrorCode(str, Enum):
    """SMS-specific error codes."""
    SMS_DELIVERY_FAILED = "TITHI_SMS_DELIVERY_FAILED"
    SMS_OPT_OUT = "TITHI_SMS_OPT_OUT"
    SMS_INVALID_PHONE = "TITHI_SMS_INVALID_PHONE"
    SMS_QUOTA_EXCEEDED = "TITHI_SMS_QUOTA_EXCEEDED"
    SMS_PROVIDER_ERROR = "TITHI_SMS_PROVIDER_ERROR"


@dataclass
class SMSRequest:
    """SMS request data structure."""
    tenant_id: uuid.UUID
    customer_id: Optional[uuid.UUID]
    phone: str
    message: str
    event_type: str = "booking_reminder"
    scheduled_at: Optional[datetime] = None
    metadata: Dict[str, Any] = None


@dataclass
class SMSResult:
    """SMS delivery result."""
    success: bool
    delivery_id: Optional[str] = None
    provider_message_id: Optional[str] = None
    error_message: Optional[str] = None
    error_code: Optional[str] = None


class SMSService:
    """Service for sending SMS notifications via Twilio."""
    
    def __init__(self):
        self.twilio_client = None
        self._initialize_twilio()
    
    def _initialize_twilio(self):
        """Initialize Twilio client."""
        try:
            from flask import current_app
            account_sid = current_app.config.get('TWILIO_ACCOUNT_SID')
            auth_token = current_app.config.get('TWILIO_AUTH_TOKEN')
            
            if account_sid and auth_token:
                self.twilio_client = Client(account_sid, auth_token)
                logger.info("Twilio client initialized successfully")
            else:
                logger.warning("Twilio credentials not configured")
        except Exception as e:
            logger.error(f"Failed to initialize Twilio client: {str(e)}")
    
    def send_sms(self, request: SMSRequest) -> SMSResult:
        """
        Send SMS notification with opt-in validation.
        
        Args:
            request: SMS request data
            
        Returns:
            SMSResult with delivery status
        """
        try:
            # Validate opt-in status
            if not self._validate_sms_opt_in(request.tenant_id, request.customer_id):
                return SMSResult(
                    success=False,
                    error_message="Customer has opted out of SMS notifications",
                    error_code=SMSErrorCode.SMS_OPT_OUT
                )
            
            # Validate phone number format
            if not self._validate_phone_number(request.phone):
                return SMSResult(
                    success=False,
                    error_message="Invalid phone number format",
                    error_code=SMSErrorCode.SMS_INVALID_PHONE
                )
            
            # Create notification record
            notification = self._create_notification_record(request)
            
            # Send SMS via Twilio
            if self.twilio_client:
                result = self._send_via_twilio(request, notification)
            else:
                # Development mode - simulate SMS sending
                result = self._simulate_sms_sending(request, notification)
            
            # Update notification status
            self._update_notification_status(notification, result)
            
            # Emit observability event
            self._emit_sms_event(request, result)
            
            return result
            
        except Exception as e:
            logger.error(f"SMS sending failed: {str(e)}")
            return SMSResult(
                success=False,
                error_message=f"SMS delivery failed: {str(e)}",
                error_code=SMSErrorCode.SMS_DELIVERY_FAILED
            )
    
    def _validate_sms_opt_in(self, tenant_id: uuid.UUID, customer_id: Optional[uuid.UUID]) -> bool:
        """
        Validate SMS opt-in status for customer.
        
        Args:
            tenant_id: Tenant ID
            customer_id: Customer ID (optional for non-customer SMS)
            
        Returns:
            True if SMS is allowed, False otherwise
        """
        try:
            if not customer_id:
                # For non-customer SMS (system notifications), allow by default
                return True
            
            # Check customer preferences
            customer = db.session.query(Customer).filter(
                Customer.id == customer_id,
                Customer.tenant_id == tenant_id
            ).first()
            
            if not customer:
                logger.warning(f"Customer {customer_id} not found for SMS opt-in check")
                return False
            
            # Check notification preferences
            preference = db.session.query(NotificationPreference).filter(
                NotificationPreference.tenant_id == tenant_id,
                NotificationPreference.user_type == 'customer',
                NotificationPreference.user_id == customer_id
            ).first()
            
            if preference:
                # Use explicit preferences
                return preference.sms_enabled
            else:
                # Default to customer's marketing opt-in for SMS
                return customer.marketing_opt_in
            
        except Exception as e:
            logger.error(f"Error validating SMS opt-in: {str(e)}")
            return False
    
    def _validate_phone_number(self, phone: str) -> bool:
        """
        Validate phone number format.
        
        Args:
            phone: Phone number to validate
            
        Returns:
            True if valid, False otherwise
        """
        # Basic validation - should start with + and contain only digits
        if not phone or not phone.startswith('+'):
            return False
        
        # Remove + and check if remaining characters are digits
        digits = phone[1:]
        return digits.isdigit() and len(digits) >= 10
    
    def _create_notification_record(self, request: SMSRequest) -> Notification:
        """
        Create notification record in database.
        
        Args:
            request: SMS request data
            
        Returns:
            Created notification record
        """
        notification = Notification(
            tenant_id=request.tenant_id,
            channel=NotificationChannel.SMS,
            recipient_type='customer',
            recipient_id=request.customer_id,
            recipient_phone=request.phone,
            content=request.message,
            status=NotificationStatus.PENDING,
            provider='twilio',
            scheduled_at=request.scheduled_at,
            metadata_json=request.metadata or {}
        )
        
        db.session.add(notification)
        db.session.commit()
        
        return notification
    
    def _send_via_twilio(self, request: SMSRequest, notification: Notification) -> SMSResult:
        """
        Send SMS via Twilio API.
        
        Args:
            request: SMS request data
            notification: Notification record
            
        Returns:
            SMSResult with delivery status
        """
        try:
            from flask import current_app
            from_number = current_app.config.get('TWILIO_PHONE_NUMBER')
            
            if not from_number:
                raise ValueError("Twilio phone number not configured")
            
            # Send SMS with retry logic (2x retries as per requirements)
            max_retries = 2
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    message = self.twilio_client.messages.create(
                        body=request.message,
                        from_=from_number,
                        to=request.phone
                    )
                    
                    return SMSResult(
                        success=True,
                        delivery_id=str(notification.id),
                        provider_message_id=message.sid
                    )
                    
                except TwilioException as e:
                    last_exception = e
                    if attempt < max_retries:
                        logger.warning(f"Twilio attempt {attempt + 1} failed, retrying: {str(e)}")
                        continue
                    else:
                        raise e
            
        except Exception as e:
            logger.error(f"Twilio SMS sending failed: {str(e)}")
            return SMSResult(
                success=False,
                error_message=f"Twilio error: {str(e)}",
                error_code=SMSErrorCode.SMS_PROVIDER_ERROR
            )
    
    def _simulate_sms_sending(self, request: SMSRequest, notification: Notification) -> SMSResult:
        """
        Simulate SMS sending for development/testing.
        
        Args:
            request: SMS request data
            notification: Notification record
            
        Returns:
            SMSResult with simulated delivery status
        """
        logger.info(f"SIMULATED SMS to {request.phone}: {request.message}")
        
        return SMSResult(
            success=True,
            delivery_id=str(notification.id),
            provider_message_id=f"sim_{uuid.uuid4().hex[:8]}"
        )
    
    def _update_notification_status(self, notification: Notification, result: SMSResult):
        """
        Update notification status based on delivery result.
        
        Args:
            notification: Notification record
            result: SMS delivery result
        """
        try:
            if result.success:
                notification.status = NotificationStatus.SENT
                notification.sent_at = datetime.utcnow()
                notification.provider_message_id = result.provider_message_id
            else:
                notification.status = NotificationStatus.FAILED
                notification.failed_at = datetime.utcnow()
                notification.failure_reason = result.error_message
            
            db.session.commit()
            
        except Exception as e:
            logger.error(f"Failed to update notification status: {str(e)}")
            db.session.rollback()
    
    def _emit_sms_event(self, request: SMSRequest, result: SMSResult):
        """
        Emit SMS event to outbox for observability.
        
        Args:
            request: SMS request data
            result: SMS delivery result
        """
        try:
            event_code = "SMS_SENT" if result.success else "SMS_FAILED"
            
            event = EventOutbox(
                tenant_id=request.tenant_id,
                event_code=event_code,
                payload={
                    "customer_id": str(request.customer_id) if request.customer_id else None,
                    "phone": request.phone,
                    "message_length": len(request.message),
                    "event_type": request.event_type,
                    "delivery_id": result.delivery_id,
                    "provider_message_id": result.provider_message_id,
                    "error_message": result.error_message,
                    "error_code": result.error_code
                }
            )
            
            db.session.add(event)
            db.session.commit()
            
        except Exception as e:
            logger.error(f"Failed to emit SMS event: {str(e)}")
            db.session.rollback()
    
    def send_booking_reminder(self, tenant_id: uuid.UUID, customer_id: uuid.UUID, 
                            phone: str, booking_details: Dict[str, Any]) -> SMSResult:
        """
        Send booking reminder SMS.
        
        Args:
            tenant_id: Tenant ID
            customer_id: Customer ID
            phone: Customer phone number
            booking_details: Booking information
            
        Returns:
            SMSResult with delivery status
        """
        message = self._format_booking_reminder_message(booking_details)
        
        request = SMSRequest(
            tenant_id=tenant_id,
            customer_id=customer_id,
            phone=phone,
            message=message,
            event_type="booking_reminder",
            metadata=booking_details
        )
        
        return self.send_sms(request)
    
    def send_cancellation_notification(self, tenant_id: uuid.UUID, customer_id: uuid.UUID,
                                     phone: str, booking_details: Dict[str, Any]) -> SMSResult:
        """
        Send booking cancellation SMS.
        
        Args:
            tenant_id: Tenant ID
            customer_id: Customer ID
            phone: Customer phone number
            booking_details: Booking information
            
        Returns:
            SMSResult with delivery status
        """
        message = self._format_cancellation_message(booking_details)
        
        request = SMSRequest(
            tenant_id=tenant_id,
            customer_id=customer_id,
            phone=phone,
            message=message,
            event_type="booking_cancellation",
            metadata=booking_details
        )
        
        return self.send_sms(request)
    
    def send_promotion_sms(self, tenant_id: uuid.UUID, customer_id: uuid.UUID,
                          phone: str, promotion_details: Dict[str, Any]) -> SMSResult:
        """
        Send promotion SMS (requires explicit opt-in).
        
        Args:
            tenant_id: Tenant ID
            customer_id: Customer ID
            phone: Customer phone number
            promotion_details: Promotion information
            
        Returns:
            SMSResult with delivery status
        """
        message = self._format_promotion_message(promotion_details)
        
        request = SMSRequest(
            tenant_id=tenant_id,
            customer_id=customer_id,
            phone=phone,
            message=message,
            event_type="promotion",
            metadata=promotion_details
        )
        
        return self.send_sms(request)
    
    def _format_booking_reminder_message(self, booking_details: Dict[str, Any]) -> str:
        """Format booking reminder message."""
        service_name = booking_details.get('service_name', 'your appointment')
        start_time = booking_details.get('start_time', 'your scheduled time')
        business_name = booking_details.get('business_name', 'us')
        
        return f"Reminder: You have an appointment for {service_name} at {start_time} with {business_name}. Reply STOP to opt out."
    
    def _format_cancellation_message(self, booking_details: Dict[str, Any]) -> str:
        """Format cancellation message."""
        service_name = booking_details.get('service_name', 'your appointment')
        business_name = booking_details.get('business_name', 'us')
        
        return f"Your appointment for {service_name} with {business_name} has been cancelled. Reply STOP to opt out."
    
    def _format_promotion_message(self, promotion_details: Dict[str, Any]) -> str:
        """Format promotion message."""
        title = promotion_details.get('title', 'Special offer')
        description = promotion_details.get('description', '')
        business_name = promotion_details.get('business_name', 'us')
        
        message = f"{business_name}: {title}"
        if description:
            message += f" - {description}"
        message += " Reply STOP to opt out."
        
        return message
    
    def get_sms_delivery_status(self, delivery_id: str) -> Optional[Dict[str, Any]]:
        """
        Get SMS delivery status.
        
        Args:
            delivery_id: Delivery ID
            
        Returns:
            Delivery status information
        """
        try:
            notification = db.session.query(Notification).filter(
                Notification.id == delivery_id
            ).first()
            
            if not notification:
                return None
            
            return {
                "delivery_id": delivery_id,
                "status": notification.status.value,
                "sent_at": notification.sent_at.isoformat() if notification.sent_at else None,
                "failed_at": notification.failed_at.isoformat() if notification.failed_at else None,
                "provider_message_id": notification.provider_message_id,
                "failure_reason": notification.failure_reason
            }
            
        except Exception as e:
            logger.error(f"Failed to get SMS delivery status: {str(e)}")
            return None
