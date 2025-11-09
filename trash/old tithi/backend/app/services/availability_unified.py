"""
Unified Availability Service

This service provides a single source of truth for availability management using StaffAvailability
as the canonical model, with proper slot generation and booking validation.
"""

import uuid
from datetime import datetime, date, time, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from ..extensions import db
from ..models.business import StaffAvailability, StaffProfile, Booking, BookingHold, Service
from ..models.availability import AvailabilityRule
from .base import BaseService


class UnifiedAvailabilityService(BaseService):
    """Unified availability service using StaffAvailability as canonical source."""
    
    def __init__(self):
        super().__init__()
        self.default_slot_duration = 30  # minutes
        self.default_buffer_minutes = 15  # buffer between bookings
    
    def get_available_slots(self, tenant_id: uuid.UUID, service_id: uuid.UUID, 
                           staff_id: Optional[uuid.UUID], start_date: datetime, 
                           end_date: datetime) -> List[Dict[str, Any]]:
        """
        Get available time slots for a service and optional staff member.
        
        Args:
            tenant_id: Tenant identifier
            service_id: Service identifier
            staff_id: Optional staff member identifier
            start_date: Start of date range
            end_date: End of date range
            
        Returns:
            List of available time slots
        """
        # Get service details
        service = Service.query.filter_by(
            tenant_id=tenant_id,
            id=service_id,
            deleted_at=None
        ).first()
        
        if not service:
            raise ValueError("Service not found")
        
        # Get staff members assigned to this service
        if staff_id:
            staff_members = [StaffProfile.query.filter_by(
                tenant_id=tenant_id,
                id=staff_id,
                is_active=True
            ).first()]
            if not staff_members[0]:
                raise ValueError("Staff member not found")
        else:
            # Get all staff assigned to this service
            staff_members = StaffProfile.query.filter(
                and_(
                    StaffProfile.tenant_id == tenant_id,
                    StaffProfile.is_active == True,
                    StaffProfile.services.any(Service.id == service_id)
                )
            ).all()
        
        if not staff_members:
            return []
        
        # Generate slots for each staff member
        all_slots = []
        for staff in staff_members:
            staff_slots = self._generate_staff_slots(
                tenant_id, staff, service, start_date, end_date
            )
            all_slots.extend(staff_slots)
        
        # Remove duplicates and sort
        unique_slots = self._deduplicate_slots(all_slots)
        return sorted(unique_slots, key=lambda x: x['start_at'])
    
    def _generate_staff_slots(self, tenant_id: uuid.UUID, staff: StaffProfile, 
                             service: Service, start_date: datetime, 
                             end_date: datetime) -> List[Dict[str, Any]]:
        """Generate slots for a specific staff member."""
        slots = []
        
        # Get staff availability
        availability_records = StaffAvailability.query.filter_by(
            tenant_id=tenant_id,
            staff_profile_id=staff.id,
            is_active=True
        ).all()
        
        if not availability_records:
            return []
        
        # Generate slots for each day in range
        current_date = start_date.date()
        end_date_only = end_date.date()
        
        while current_date <= end_date_only:
            weekday = current_date.isoweekday()  # 1=Monday, 7=Sunday
            
            # Find availability for this weekday
            availability = next(
                (av for av in availability_records if av.weekday == weekday), 
                None
            )
            
            if availability:
                day_slots = self._create_day_slots(
                    current_date, 
                    availability.start_time, 
                    availability.end_time,
                    service,
                    staff
                )
                slots.extend(day_slots)
            
            current_date += timedelta(days=1)
        
        return slots
    
    def _create_day_slots(self, date: date, start_time: time, end_time: time, 
                          service: Service, staff: StaffProfile) -> List[Dict[str, Any]]:
        """Create time slots for a specific day."""
        slots = []
        
        # Convert to datetime objects
        start_datetime = datetime.combine(date, start_time)
        end_datetime = datetime.combine(date, end_time)
        
        # Calculate slot duration (service duration + buffer)
        slot_duration = timedelta(minutes=service.duration_min + self.default_buffer_minutes)
        
        current_slot = start_datetime
        
        while current_slot + timedelta(minutes=service.duration_min) <= end_datetime:
            slot_end = current_slot + timedelta(minutes=service.duration_min)
            
            # Check if this slot is available
            if self._is_slot_available(staff.tenant_id, staff.resource_id, current_slot, slot_end):
                slots.append({
                    "start_at": current_slot.isoformat(),
                    "end_at": slot_end.isoformat(),
                    "date": date.isoformat(),
                    "weekday": date.isoweekday(),
                    "staff_id": str(staff.id),
                    "staff_name": staff.name,
                    "service_id": str(service.id),
                    "service_name": service.name,
                    "duration_minutes": service.duration_min,
                    "price_cents": service.price_cents
                })
            
            # Move to next slot
            current_slot += timedelta(minutes=self.default_slot_duration)
        
        return slots
    
    def _is_slot_available(self, tenant_id: uuid.UUID, resource_id: uuid.UUID, 
                           start_at: datetime, end_at: datetime) -> bool:
        """Check if a time slot is available (no conflicts)."""
        # Check for existing bookings
        existing_booking = Booking.query.filter(
            and_(
                Booking.tenant_id == tenant_id,
                Booking.resource_id == resource_id,
                Booking.status.in_(['pending', 'confirmed', 'checked_in']),
                or_(
                    and_(Booking.start_at < end_at, Booking.end_at > start_at)
                )
            )
        ).first()
        
        if existing_booking:
            return False
        
        # Check for active holds
        active_hold = BookingHold.query.filter(
            and_(
                BookingHold.tenant_id == tenant_id,
                BookingHold.resource_id == resource_id,
                BookingHold.hold_until > datetime.now(),
                or_(
                    and_(BookingHold.start_at < end_at, BookingHold.end_at > start_at)
                )
            )
        ).first()
        
        if active_hold:
            return False
        
        return True
    
    def _deduplicate_slots(self, slots: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate slots based on start_at time."""
        seen = set()
        unique_slots = []
        
        for slot in slots:
            key = (slot['start_at'], slot['end_at'])
            if key not in seen:
                seen.add(key)
                unique_slots.append(slot)
        
        return unique_slots
    
    def validate_booking_availability(self, tenant_id: uuid.UUID, service_id: uuid.UUID, 
                                    staff_id: uuid.UUID, start_at: datetime, 
                                    end_at: datetime) -> bool:
        """
        Validate that a booking time is within staff availability.
        
        Args:
            tenant_id: Tenant identifier
            service_id: Service identifier  
            staff_id: Staff member identifier
            start_at: Booking start time
            end_at: Booking end time
            
        Returns:
            True if booking is within availability, False otherwise
        """
        # Get staff profile
        staff = StaffProfile.query.filter_by(
            tenant_id=tenant_id,
            id=staff_id,
            is_active=True
        ).first()
        
        if not staff:
            return False
        
        # Get staff availability for the booking day
        weekday = start_at.isoweekday()
        availability = StaffAvailability.query.filter_by(
            tenant_id=tenant_id,
            staff_profile_id=staff_id,
            weekday=weekday,
            is_active=True
        ).first()
        
        if not availability:
            return False
        
        # Check if booking time falls within availability window
        booking_date = start_at.date()
        availability_start = datetime.combine(booking_date, availability.start_time)
        availability_end = datetime.combine(booking_date, availability.end_time)
        
        # Booking must be completely within availability window
        if start_at < availability_start or end_at > availability_end:
            return False
        
        # Check for conflicts
        return self._is_slot_available(tenant_id, staff.resource_id, start_at, end_at)
    
    def is_booking_enabled(self, tenant_id: uuid.UUID) -> bool:
        """
        Check if booking is enabled for a tenant (has services with staff availability).
        
        Args:
            tenant_id: Tenant identifier
            
        Returns:
            True if booking is enabled, False otherwise
        """
        # Check if tenant has any services with staff availability
        services_with_availability = db.session.query(Service).join(
            StaffProfile, Service.staff_assignments
        ).join(
            StaffAvailability, StaffProfile.id == StaffAvailability.staff_profile_id
        ).filter(
            and_(
                Service.tenant_id == tenant_id,
                Service.deleted_at.is_(None),
                Service.active == True,
                StaffAvailability.is_active == True,
                StaffProfile.is_active == True
            )
        ).first()
        
        return services_with_availability is not None
    
    def get_booking_enabled_status(self, tenant_id: uuid.UUID) -> Dict[str, Any]:
        """
        Get detailed booking enabled status for a tenant.
        
        Args:
            tenant_id: Tenant identifier
            
        Returns:
            Dictionary with booking status and details
        """
        # Count services with staff availability
        services_count = db.session.query(Service).join(
            StaffProfile, Service.staff_assignments
        ).join(
            StaffAvailability, StaffProfile.id == StaffAvailability.staff_profile_id
        ).filter(
            and_(
                Service.tenant_id == tenant_id,
                Service.deleted_at.is_(None),
                Service.active == True,
                StaffAvailability.is_active == True,
                StaffProfile.is_active == True
            )
        ).count()
        
        # Count staff with availability
        staff_count = db.session.query(StaffProfile).join(
            StaffAvailability, StaffProfile.id == StaffAvailability.staff_profile_id
        ).filter(
            and_(
                StaffProfile.tenant_id == tenant_id,
                StaffProfile.is_active == True,
                StaffAvailability.is_active == True
            )
        ).count()
        
        return {
            "booking_enabled": services_count > 0,
            "services_with_availability": services_count,
            "staff_with_availability": staff_count,
            "message": "Booking enabled" if services_count > 0 else "No staff availability configured"
        }
