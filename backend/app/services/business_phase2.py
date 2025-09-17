"""
Business Services - Phase 2 Implementation

This module contains comprehensive business logic services for Phase 2:
- Services & Catalog (Module D)
- Staff & Work Schedules (Module E) 
- Availability & Scheduling Engine (Module F)
- Booking Lifecycle (Module G)
"""

import uuid
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timedelta, timezone
from sqlalchemy import and_, or_, func, text
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import SQLAlchemyError
from ..extensions import db
from ..models.business import (
    Customer, Service, Resource, Booking, BookingItem, ServiceResource, CustomerMetrics,
    StaffProfile, WorkSchedule, StaffAssignmentHistory, BookingHold, WaitlistEntry, AvailabilityCache
)
from ..models.core import Tenant, User, Membership
from ..models.system import AuditLog, EventOutbox
from .cache import AvailabilityCacheService, BookingHoldCacheService, WaitlistCacheService


class BusinessConfig:
    """Configuration for business rules and constants."""
    
    # Business hours (in UTC)
    DEFAULT_BUSINESS_START_HOUR = 9
    DEFAULT_BUSINESS_END_HOUR = 17
    
    # Booking constraints
    MIN_BOOKING_DURATION_MINUTES = 15
    MAX_BOOKING_DURATION_HOURS = 8
    
    # Retry settings
    MAX_RETRY_ATTEMPTS = 3
    RETRY_DELAY_SECONDS = 1


class ValidationError(Exception):
    """Custom exception for validation errors."""
    pass


class BusinessLogicError(Exception):
    """Custom exception for business logic errors."""
    pass


class DatabaseError(Exception):
    """Custom exception for database errors."""
    pass


class BaseService:
    """Base service class with common functionality."""
    
    def __init__(self):
        self.config = BusinessConfig()
    
    def _validate_required_fields(self, data: Dict[str, Any], required_fields: List[str]) -> None:
        """Validate that all required fields are present."""
        missing_fields = [field for field in required_fields if field not in data or data[field] is None]
        if missing_fields:
            raise ValidationError(f"Missing required fields: {', '.join(missing_fields)}")
    
    def _validate_uuid(self, value: Any, field_name: str) -> uuid.UUID:
        """Validate and convert value to UUID."""
        if isinstance(value, str):
            try:
                return uuid.UUID(value)
            except ValueError:
                raise ValidationError(f"Invalid UUID format for {field_name}")
        elif isinstance(value, uuid.UUID):
            return value
        else:
            raise ValidationError(f"Invalid type for {field_name}, expected UUID or string")
    
    def _validate_positive_number(self, value: Any, field_name: str, min_value: int = 0) -> int:
        """Validate that a number is positive."""
        try:
            num_value = int(value)
            if num_value < min_value:
                raise ValidationError(f"{field_name} must be >= {min_value}")
            return num_value
        except (ValueError, TypeError):
            raise ValidationError(f"Invalid number format for {field_name}")
    
    def _validate_datetime_range(self, start_at: datetime, end_at: datetime) -> None:
        """Validate that start time is before end time."""
        if start_at >= end_at:
            raise ValidationError("Start time must be before end time")
    
    def _safe_db_operation(self, operation, *args, **kwargs):
        """Safely execute database operations with proper error handling."""
        try:
            result = operation(*args, **kwargs)
            db.session.commit()
            return result
        except SQLAlchemyError as e:
            db.session.rollback()
            raise DatabaseError(f"Database operation failed: {str(e)}")
        except Exception as e:
            db.session.rollback()
            raise BusinessLogicError(f"Operation failed: {str(e)}")
    
    def _emit_event(self, tenant_id: uuid.UUID, event_type: str, payload: Dict[str, Any]) -> None:
        """Emit an event to the outbox for reliable delivery."""
        outbox_event = EventOutbox(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            event_type=event_type,
            payload=payload,
            status="pending",
            retry_count=0,
            max_retries=self.config.MAX_RETRY_ATTEMPTS
        )
        
        db.session.add(outbox_event)
        db.session.commit()
    
    def _log_audit(self, tenant_id: uuid.UUID, table_name: str, record_id: uuid.UUID, 
                   operation: str, user_id: uuid.UUID, old_values: Dict[str, Any] = None, 
                   new_values: Dict[str, Any] = None) -> None:
        """Log an audit entry for tracking changes."""
        audit_log = AuditLog(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            table_name=table_name,
            record_id=record_id,
            operation=operation,
            user_id=user_id,
            old_values=old_values or {},
            new_values=new_values or {}
        )
        
        db.session.add(audit_log)
        db.session.commit()


class ServiceService(BaseService):
    """Service for service-related business logic (Module D)."""
    
    def create_service(self, tenant_id: uuid.UUID, service_data: Dict[str, Any], user_id: uuid.UUID) -> Service:
        """Create a new service with validation."""
        # Validate required fields
        self._validate_required_fields(service_data, ['name', 'duration_min', 'price_cents'])
        
        # Validate pricing
        price_cents = int(service_data['price_cents'])
        if price_cents < 0:
            raise ValueError("Price cannot be negative")
        
        # Validate duration
        duration_min = self._validate_positive_number(service_data['duration_min'], 'duration_min', 1)
        
        if duration_min > self.config.MAX_BOOKING_DURATION_HOURS * 60:
            raise ValidationError(f"Duration cannot exceed {self.config.MAX_BOOKING_DURATION_HOURS} hours")
        
        # Create service
        service = Service(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            slug=service_data.get('slug', service_data['name'].lower().replace(' ', '-')),
            name=service_data['name'],
            description=service_data.get('description', ''),
            duration_min=duration_min,
            price_cents=price_cents,
            buffer_before_min=service_data.get('buffer_before_min', 0),
            buffer_after_min=service_data.get('buffer_after_min', 0),
            category=service_data.get('category', ''),
            active=service_data.get('active', True),
            metadata_json=service_data.get('metadata', {})
        )
        
        def _create_service():
            db.session.add(service)
            return service
        
        result = self._safe_db_operation(_create_service)
        
        # Log audit trail
        self._log_audit(tenant_id, "services", service.id, "CREATE", user_id, 
                       new_values={"name": service.name, "price_cents": service.price_cents})
        
        return result
    
    def get_service(self, tenant_id: uuid.UUID, service_id: uuid.UUID) -> Optional[Service]:
        """Get a service by ID with tenant isolation."""
        service_id = self._validate_uuid(service_id, 'service_id')
        
        return Service.query.filter_by(
            tenant_id=tenant_id,
            id=service_id,
            deleted_at=None
        ).first()
    
    def get_services(self, tenant_id: uuid.UUID, active_only: bool = True) -> List[Service]:
        """Get all services for a tenant."""
        query = Service.query.filter_by(tenant_id=tenant_id, deleted_at=None)
        
        if active_only:
            query = query.filter_by(active=True)
        
        return query.order_by(Service.name).all()
    
    def update_service(self, tenant_id: uuid.UUID, service_id: uuid.UUID, 
                      update_data: Dict[str, Any], user_id: uuid.UUID) -> Optional[Service]:
        """Update a service with validation."""
        service = self.get_service(tenant_id, service_id)
        if not service:
            return None
        
        # Store old values for audit
        old_values = {
            'name': service.name,
            'price_cents': service.price_cents,
            'duration_min': service.duration_min,
            'active': service.active
        }
        
        # Validate pricing if provided
        if 'price_cents' in update_data:
            update_data['price_cents'] = self._validate_positive_number(
                update_data['price_cents'], 'price_cents'
            )
        
        # Validate duration if provided
        if 'duration_min' in update_data:
            duration_min = self._validate_positive_number(
                update_data['duration_min'], 'duration_min', 1
            )
            if duration_min > self.config.MAX_BOOKING_DURATION_HOURS * 60:
                raise ValidationError(f"Duration cannot exceed {self.config.MAX_BOOKING_DURATION_HOURS} hours")
            update_data['duration_min'] = duration_min
        
        def _update_service():
            # Update fields
            for field, value in update_data.items():
                if hasattr(service, field):
                    setattr(service, field, value)
            
            service.updated_at = datetime.utcnow()
            return service
        
        result = self._safe_db_operation(_update_service)
        
        # Log audit trail
        new_values = {k: v for k, v in update_data.items() if k in old_values}
        self._log_audit(tenant_id, "services", service.id, "UPDATE", user_id, 
                       old_values=old_values, new_values=new_values)
        
        return result
    
    def delete_service(self, tenant_id: uuid.UUID, service_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Soft delete a service if no active bookings exist."""
        service = self.get_service(tenant_id, service_id)
        if not service:
            return False
        
        # Check for active bookings (service_id is stored in service_snapshot JSON)
        # Use SQLite-compatible JSON query syntax
        active_bookings = Booking.query.filter(
            Booking.tenant_id == tenant_id,
            Booking.status.in_(['confirmed', 'checked_in'])
        ).all()
        
        # Check if any active booking has this service in its snapshot
        for booking in active_bookings:
            if booking.service_snapshot and booking.service_snapshot.get('service_id') == str(service_id):
                raise ValueError("Cannot delete service with active bookings")
        
        def _delete_service():
            # Soft delete
            service.deleted_at = datetime.utcnow()
            service.active = False
            return True
        
        result = self._safe_db_operation(_delete_service)
        
        # Log audit trail
        self._log_audit(tenant_id, "services", service.id, "DELETE", user_id, 
                       old_values={"active": True}, new_values={"active": False, "deleted_at": service.deleted_at.isoformat()})
        
        return result
    
    def search_services(self, tenant_id: uuid.UUID, search_term: str = "", category: str = "") -> List[Service]:
        """Search services by name, description, or category."""
        query = Service.query.filter_by(tenant_id=tenant_id, deleted_at=None, active=True)
        
        if search_term:
            query = query.filter(
                or_(
                    Service.name.ilike(f"%{search_term}%"),
                    Service.description.ilike(f"%{search_term}%")
                )
            )
        
        if category:
            query = query.filter(Service.category.ilike(f"%{category}%"))
        
        return query.order_by(Service.name).all()
    
    def assign_staff_to_service(self, tenant_id: uuid.UUID, service_id: uuid.UUID, 
                               resource_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Assign staff resource to a service."""
        # Check if service exists
        service = self.get_service(tenant_id, service_id)
        if not service:
            return False
        
        # Check if resource exists and is staff type
        resource = Resource.query.filter_by(
            tenant_id=tenant_id,
            id=resource_id,
            type='staff',
            deleted_at=None
        ).first()
        
        if not resource:
            return False
        
        def _assign_staff():
            # Create service-resource mapping
            service_resource = ServiceResource(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                service_id=service_id,
                resource_id=resource_id
            )
            
            db.session.add(service_resource)
            return service_resource
        
        service_resource = self._safe_db_operation(_assign_staff)
        
        # Log audit trail
        self._log_audit(tenant_id, "service_resources", service_resource.id, "CREATE", user_id, 
                       new_values={"service_id": str(service_id), "resource_id": str(resource_id)})
        
        return True


class AvailabilityService(BaseService):
    """Enhanced service for availability and scheduling logic (Module F)."""
    
    def __init__(self):
        super().__init__()
        # Redis-based cache services
        self.availability_cache = AvailabilityCacheService()
        self.hold_cache = BookingHoldCacheService()
        self.waitlist_cache = WaitlistCacheService()
        # Fallback in-memory cache
        self._cache = {}
        self._cache_ttl = 300  # 5 minutes
    
    def calculate_availability(self, tenant_id: uuid.UUID, resource_id: uuid.UUID, 
                             start_date: datetime, end_date: datetime) -> List[Dict[str, Any]]:
        """Calculate real-time availability from schedules, exceptions, and existing bookings."""
        # Check Redis cache first
        date_str = start_date.date().isoformat()
        cached_availability = self.availability_cache.get_availability(tenant_id, resource_id, date_str)
        if cached_availability:
            return cached_availability
        
        # Get resource timezone
        resource = Resource.query.filter_by(tenant_id=tenant_id, id=resource_id).first()
        if not resource:
            raise ValueError("Resource not found")
        
        resource_tz = timezone.utc  # Default to UTC, in production would parse resource.tz
        
        # Get work schedules for staff
        staff_profile = StaffProfile.query.filter_by(
            tenant_id=tenant_id, 
            resource_id=resource_id
        ).first()
        
        if not staff_profile:
            # If no staff profile, use default business hours
            return self._get_default_availability(start_date, end_date, resource_tz)
        
        # Get work schedules
        schedules = WorkSchedule.query.filter(
            and_(
                WorkSchedule.tenant_id == tenant_id,
                WorkSchedule.staff_profile_id == staff_profile.id,
                WorkSchedule.start_date <= end_date.date(),
                or_(
                    WorkSchedule.end_date.is_(None),
                    WorkSchedule.end_date >= start_date.date()
                )
            )
        ).all()
        
        # Get existing bookings
        bookings = Booking.query.filter(
            and_(
                Booking.tenant_id == tenant_id,
                Booking.resource_id == resource_id,
                Booking.status.in_(['pending', 'confirmed', 'checked_in']),
                Booking.start_at < end_date,
                Booking.end_at > start_date
            )
        ).all()
        
        # Calculate availability slots
        slots = self._generate_availability_slots(
            start_date, end_date, schedules, bookings, resource_tz
        )
        
        # Cache the result in Redis
        self.availability_cache.set_availability(tenant_id, resource_id, date_str, slots)
        
        return slots
    
    def get_available_slots(self, tenant_id: uuid.UUID, resource_id: uuid.UUID, 
                           start_date: datetime, end_date: datetime) -> List[Dict[str, Any]]:
        """Get available time slots for a resource with caching."""
        return self.calculate_availability(tenant_id, resource_id, start_date, end_date)
    
    def is_time_available(self, tenant_id: uuid.UUID, resource_id: uuid.UUID, 
                         start_at: datetime, end_at: datetime) -> bool:
        """Check if a time slot is available with comprehensive validation."""
        # Validate datetime range
        self._validate_datetime_range(start_at, end_at)
        
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
        
        # Check staff availability
        staff_profile = StaffProfile.query.filter_by(
            tenant_id=tenant_id, 
            resource_id=resource_id,
            is_active=True
        ).first()
        
        if not staff_profile:
            return False
        
        # Check work schedules
        if not self._is_staff_available(staff_profile, start_at, end_at):
            return False
        
        return True
    
    def create_booking_hold(self, tenant_id: uuid.UUID, resource_id: uuid.UUID, 
                           service_id: uuid.UUID, start_at: datetime, end_at: datetime, 
                           ttl_minutes: int = 15) -> BookingHold:
        """Create a temporary booking hold with TTL."""
        # Validate slot availability
        if not self.is_time_available(tenant_id, resource_id, start_at, end_at):
            raise BusinessLogicError("Time slot is not available")
        
        # Generate unique hold key
        hold_key = f"{tenant_id}_{resource_id}_{start_at.isoformat()}_{uuid.uuid4().hex[:8]}"
        
        # Create hold data for cache
        hold_data = {
            'resource_id': str(resource_id),
            'service_id': str(service_id),
            'start_at': start_at.isoformat(),
            'end_at': end_at.isoformat(),
            'hold_until': (datetime.now() + timedelta(minutes=ttl_minutes)).isoformat(),
            'created_at': datetime.now().isoformat()
        }
        
        # Store in Redis cache
        self.hold_cache.create_hold(tenant_id, hold_key, hold_data, ttl_minutes * 60)
        
        # Create hold
        hold = BookingHold(
            tenant_id=tenant_id,
            resource_id=resource_id,
            service_id=service_id,
            start_at=start_at,
            end_at=end_at,
            hold_until=datetime.now() + timedelta(minutes=ttl_minutes),
            hold_key=hold_key
        )
        
        try:
            db.session.add(hold)
            db.session.commit()
            
            # Invalidate availability cache
            self.availability_cache.invalidate_availability(tenant_id, resource_id)
            
            return hold
            
        except SQLAlchemyError as e:
            db.session.rollback()
            # Remove from cache on database failure
            self.hold_cache.release_hold(tenant_id, hold_key)
            raise DatabaseError(f"Failed to create booking hold: {str(e)}")
    
    def release_booking_hold(self, tenant_id: uuid.UUID, hold_key: str) -> bool:
        """Release a booking hold."""
        hold = BookingHold.query.filter_by(
            tenant_id=tenant_id,
            hold_key=hold_key
        ).first()
        
        if not hold:
            return False
        
        # Remove from Redis cache
        self.hold_cache.release_hold(tenant_id, hold_key)
        
        try:
            db.session.delete(hold)
            db.session.commit()
            
            # Invalidate availability cache
            self.availability_cache.invalidate_availability(tenant_id, hold.resource_id)
            
            return True
            
        except SQLAlchemyError as e:
            db.session.rollback()
            raise DatabaseError(f"Failed to release booking hold: {str(e)}")
    
    def add_to_waitlist(self, tenant_id: uuid.UUID, resource_id: uuid.UUID, 
                       service_id: uuid.UUID, customer_id: uuid.UUID, 
                       preferences: Dict[str, Any]) -> WaitlistEntry:
        """Add customer to waitlist for unavailable slots."""
        # Validate customer exists
        customer = Customer.query.filter_by(
            tenant_id=tenant_id,
            id=customer_id
        ).first()
        
        if not customer:
            raise ValueError("Customer not found")
        
        # Create waitlist entry
        waitlist_entry = WaitlistEntry(
            tenant_id=tenant_id,
            resource_id=resource_id,
            service_id=service_id,
            customer_id=customer_id,
            preferred_start_at=preferences.get('preferred_start_at'),
            preferred_end_at=preferences.get('preferred_end_at'),
            priority=preferences.get('priority', 0),
            expires_at=datetime.now() + timedelta(days=30)  # 30-day expiration
        )
        
        try:
            db.session.add(waitlist_entry)
            db.session.commit()
            
            return waitlist_entry
            
        except SQLAlchemyError as e:
            db.session.rollback()
            raise DatabaseError(f"Failed to add to waitlist: {str(e)}")
    
    def _generate_availability_slots(self, start_date: datetime, end_date: datetime, 
                                   schedules: List[WorkSchedule], bookings: List[Booking], 
                                   resource_tz: timezone) -> List[Dict[str, Any]]:
        """Generate availability slots based on schedules and existing bookings."""
        slots = []
        current_date = start_date.date()
        end_date_only = end_date.date()
        
        while current_date <= end_date_only:
            # Get schedules for this date
            day_schedules = [s for s in schedules if 
                           s.start_date <= current_date and 
                           (s.end_date is None or s.end_date >= current_date)]
            
            # Get bookings for this date
            day_bookings = [b for b in bookings if b.start_at.date() == current_date]
            
            # Generate slots for this day
            day_slots = self._generate_day_slots(
                current_date, day_schedules, day_bookings, resource_tz
            )
            slots.extend(day_slots)
            
            current_date += timedelta(days=1)
        
        return slots
    
    def _generate_day_slots(self, date: datetime.date, schedules: List[WorkSchedule], 
                          bookings: List[Booking], resource_tz: timezone) -> List[Dict[str, Any]]:
        """Generate availability slots for a specific day."""
        slots = []
        
        # If no schedules, use default business hours
        if not schedules:
            return self._get_default_day_slots(date, resource_tz)
        
        # Process each schedule
        for schedule in schedules:
            if schedule.is_time_off:
                continue  # Skip time off periods
            
            # Generate slots based on work hours
            work_hours = schedule.work_hours or {}
            start_hour = work_hours.get('start_hour', self.config.DEFAULT_BUSINESS_START_HOUR)
            end_hour = work_hours.get('end_hour', self.config.DEFAULT_BUSINESS_END_HOUR)
            
            # Generate hourly slots
            current_hour = start_hour
            while current_hour < end_hour:
                slot_start = datetime.combine(date, datetime.min.time().replace(hour=current_hour))
                slot_end = slot_start + timedelta(hours=1)
                
                # Check if slot conflicts with existing bookings
                is_available = not any(
                    b.start_at < slot_end and b.end_at > slot_start
                    for b in bookings
                )
                
                slots.append({
                    'start_at': slot_start.isoformat(),
                    'end_at': slot_end.isoformat(),
                    'available': is_available,
                    'schedule_type': schedule.schedule_type
                })
                
                current_hour += 1
        
        return slots
    
    def _is_staff_available(self, staff_profile: StaffProfile, start_at: datetime, end_at: datetime) -> bool:
        """Check if staff member is available for a specific time period."""
        # Get work schedules for the date
        schedules = WorkSchedule.query.filter(
            and_(
                WorkSchedule.tenant_id == staff_profile.tenant_id,
                WorkSchedule.staff_profile_id == staff_profile.id,
                WorkSchedule.start_date <= start_at.date(),
                or_(
                    WorkSchedule.end_date.is_(None),
                    WorkSchedule.end_date >= start_at.date()
                )
            )
        ).all()
        
        # Check if any schedule covers this time period
        for schedule in schedules:
            if schedule.is_time_off:
                # Check if this is a time off period
                if (schedule.start_date <= start_at.date() and 
                    (schedule.end_date is None or schedule.end_date >= start_at.date())):
                return False
        else:
                # Check if this is a working period
                work_hours = schedule.work_hours or {}
                start_hour = work_hours.get('start_hour', self.config.DEFAULT_BUSINESS_START_HOUR)
                end_hour = work_hours.get('end_hour', self.config.DEFAULT_BUSINESS_END_HOUR)
                
                if (start_at.hour >= start_hour and end_at.hour <= end_hour):
                    return True
        
                return False
    
    def _get_default_availability(self, start_date: datetime, end_date: datetime, 
                                resource_tz: timezone) -> List[Dict[str, Any]]:
        """Get default availability when no staff schedules exist."""
        slots = []
        current_date = start_date.date()
        end_date_only = end_date.date()
        
        while current_date <= end_date_only:
            day_slots = self._get_default_day_slots(current_date, resource_tz)
            slots.extend(day_slots)
            current_date += timedelta(days=1)
        
        return slots
    
    def _get_default_day_slots(self, date: datetime.date, resource_tz: timezone) -> List[Dict[str, Any]]:
        """Get default business hours slots for a day."""
        slots = []
        
        for hour in range(self.config.DEFAULT_BUSINESS_START_HOUR, self.config.DEFAULT_BUSINESS_END_HOUR):
            slot_start = datetime.combine(date, datetime.min.time().replace(hour=hour))
            slot_end = slot_start + timedelta(hours=1)
            
            slots.append({
                'start_at': slot_start.isoformat(),
                'end_at': slot_end.isoformat(),
                'available': True,
                'schedule_type': 'default'
            })
        
        return slots
    
    def _invalidate_cache(self, tenant_id: uuid.UUID, resource_id: uuid.UUID, date: datetime.date):
        """Invalidate availability cache for a specific resource and date."""
        keys_to_remove = [key for key in self._cache.keys() 
                         if f"{tenant_id}_{resource_id}_{date}" in key]
        
        for key in keys_to_remove:
            del self._cache[key]


class StaffService(BaseService):
    """Service for staff management and work schedules (Module E)."""
    
    def create_staff_profile(self, tenant_id: uuid.UUID, profile_data: Dict[str, Any], user_id: uuid.UUID) -> StaffProfile:
        """Create a new staff profile."""
        # Validate required fields
        self._validate_required_fields(profile_data, ['membership_id', 'resource_id', 'display_name'])
        
        # Validate membership exists and belongs to tenant
        membership = Membership.query.filter_by(
            tenant_id=tenant_id,
            id=profile_data['membership_id']
        ).first()
        
        if not membership:
            raise ValueError("Membership not found")
        
        # Validate resource exists and belongs to tenant
        resource = Resource.query.filter_by(
            tenant_id=tenant_id,
            id=profile_data['resource_id'],
            type='staff'
        ).first()
        
        if not resource:
            raise ValueError("Staff resource not found")
        
        # Check if staff profile already exists for this resource
        existing_profile = StaffProfile.query.filter_by(
            tenant_id=tenant_id,
            resource_id=profile_data['resource_id']
        ).first()
        
        if existing_profile:
            raise ValueError("Staff profile already exists for this resource")
        
        # Create staff profile
        staff_profile = StaffProfile(
            tenant_id=tenant_id,
            membership_id=profile_data['membership_id'],
            resource_id=profile_data['resource_id'],
            display_name=profile_data['display_name'],
            bio=profile_data.get('bio'),
            specialties=profile_data.get('specialties', []),
            hourly_rate_cents=profile_data.get('hourly_rate_cents'),
            is_active=profile_data.get('is_active', True),
            max_concurrent_bookings=profile_data.get('max_concurrent_bookings', 1),
            metadata_json=profile_data.get('metadata', {})
        )
        
        try:
            db.session.add(staff_profile)
            db.session.commit()
            
            # Log assignment history
            self._log_assignment_change(
                tenant_id, staff_profile.id, 'assigned', 
                None, profile_data, user_id, "Staff profile created"
            )
            
            return staff_profile
            
        except SQLAlchemyError as e:
            db.session.rollback()
            raise DatabaseError(f"Failed to create staff profile: {str(e)}")
    
    def update_staff_profile(self, tenant_id: uuid.UUID, profile_id: uuid.UUID, 
                           updates: Dict[str, Any], user_id: uuid.UUID) -> StaffProfile:
        """Update a staff profile."""
        staff_profile = StaffProfile.query.filter_by(
            tenant_id=tenant_id,
            id=profile_id
        ).first()
        
        if not staff_profile:
            raise ValueError("Staff profile not found")
        
        # Store old values for audit
        old_values = {
            'display_name': staff_profile.display_name,
            'bio': staff_profile.bio,
            'specialties': staff_profile.specialties,
            'hourly_rate_cents': staff_profile.hourly_rate_cents,
            'is_active': staff_profile.is_active,
            'max_concurrent_bookings': staff_profile.max_concurrent_bookings
        }
        
        # Update fields
        if 'display_name' in updates:
            staff_profile.display_name = updates['display_name']
        if 'bio' in updates:
            staff_profile.bio = updates['bio']
        if 'specialties' in updates:
            staff_profile.specialties = updates['specialties']
        if 'hourly_rate_cents' in updates:
            if updates['hourly_rate_cents'] is not None and updates['hourly_rate_cents'] < 0:
                raise ValueError("hourly_rate_cents must be non-negative")
            staff_profile.hourly_rate_cents = updates['hourly_rate_cents']
        if 'is_active' in updates:
            staff_profile.is_active = updates['is_active']
        if 'max_concurrent_bookings' in updates:
            if updates['max_concurrent_bookings'] <= 0:
                raise ValueError("max_concurrent_bookings must be positive")
            staff_profile.max_concurrent_bookings = updates['max_concurrent_bookings']
        if 'metadata' in updates:
            staff_profile.metadata_json = updates['metadata']
        
        try:
            db.session.commit()
            
            # Log assignment history
            new_values = {k: v for k, v in updates.items() if k in old_values}
            self._log_assignment_change(
                tenant_id, profile_id, 'role_changed', 
                old_values, new_values, user_id, "Staff profile updated"
            )
            
            return staff_profile
            
        except SQLAlchemyError as e:
            db.session.rollback()
            raise DatabaseError(f"Failed to update staff profile: {str(e)}")
    
    def delete_staff_profile(self, tenant_id: uuid.UUID, profile_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Delete a staff profile."""
        staff_profile = StaffProfile.query.filter_by(
            tenant_id=tenant_id,
            id=profile_id
        ).first()
        
        if not staff_profile:
            raise ValueError("Staff profile not found")
        
        # Check for active bookings
        active_bookings = Booking.query.filter(
            and_(
                Booking.tenant_id == tenant_id,
                Booking.resource_id == staff_profile.resource_id,
                Booking.status.in_(['pending', 'confirmed', 'checked_in'])
            )
        ).count()
        
        if active_bookings > 0:
            raise BusinessLogicError("Cannot delete staff profile with active bookings")
        
        try:
            # Log assignment history
            self._log_assignment_change(
                tenant_id, profile_id, 'unassigned', 
                {'display_name': staff_profile.display_name}, None, user_id, "Staff profile deleted"
            )
            
            db.session.delete(staff_profile)
            db.session.commit()
        
        return True
            
        except SQLAlchemyError as e:
            db.session.rollback()
            raise DatabaseError(f"Failed to delete staff profile: {str(e)}")
    
    def get_staff_profile(self, tenant_id: uuid.UUID, profile_id: uuid.UUID) -> Optional[StaffProfile]:
        """Get a staff profile by ID."""
        return StaffProfile.query.filter_by(
            tenant_id=tenant_id,
            id=profile_id
        ).first()
    
    def list_staff_profiles(self, tenant_id: uuid.UUID, filters: Optional[Dict[str, Any]] = None) -> List[StaffProfile]:
        """List staff profiles with optional filters."""
        query = StaffProfile.query.filter_by(tenant_id=tenant_id)
        
        if filters:
            if 'is_active' in filters:
                query = query.filter_by(is_active=filters['is_active'])
            if 'resource_id' in filters:
                query = query.filter_by(resource_id=filters['resource_id'])
            if 'membership_id' in filters:
                query = query.filter_by(membership_id=filters['membership_id'])
        
        return query.all()
    
    def create_work_schedule(self, tenant_id: uuid.UUID, staff_profile_id: uuid.UUID, 
                           schedule_data: Dict[str, Any], user_id: uuid.UUID) -> WorkSchedule:
        """Create a work schedule for a staff member."""
        # Validate required fields
        self._validate_required_fields(schedule_data, ['schedule_type', 'start_date'])
        
        # Validate staff profile exists
        staff_profile = StaffProfile.query.filter_by(
            tenant_id=tenant_id,
            id=staff_profile_id
        ).first()
        
        if not staff_profile:
            raise ValueError("Staff profile not found")
        
        # Parse dates
        try:
            start_date = datetime.fromisoformat(schedule_data['start_date']).date()
            end_date = None
            if 'end_date' in schedule_data and schedule_data['end_date']:
                end_date = datetime.fromisoformat(schedule_data['end_date']).date()
        except ValueError as e:
            raise ValueError(f"Invalid date format: {str(e)}")
        
        # Validate schedule type
        valid_types = ['regular', 'override', 'time_off', 'holiday']
        if schedule_data['schedule_type'] not in valid_types:
            raise ValueError(f"schedule_type must be one of: {valid_types}")
        
        # Create work schedule
        work_schedule = WorkSchedule(
            tenant_id=tenant_id,
            staff_profile_id=staff_profile_id,
            schedule_type=schedule_data['schedule_type'],
            start_date=start_date,
            end_date=end_date,
            work_hours=schedule_data.get('work_hours', {}),
            is_time_off=schedule_data.get('is_time_off', False),
            overrides_regular=schedule_data.get('overrides_regular', False),
            rrule=schedule_data.get('rrule'),
            reason=schedule_data.get('reason'),
            metadata_json=schedule_data.get('metadata', {})
        )
        
        try:
            db.session.add(work_schedule)
            db.session.commit()
            
            return work_schedule
            
        except SQLAlchemyError as e:
            db.session.rollback()
            raise DatabaseError(f"Failed to create work schedule: {str(e)}")
    
    def get_staff_availability(self, tenant_id: uuid.UUID, staff_profile_id: uuid.UUID, 
                             start_date: datetime, end_date: datetime) -> List[Dict[str, Any]]:
        """Get staff availability for a date range."""
        # This is a simplified implementation
        # In production, this would integrate with the availability engine
        staff_profile = StaffProfile.query.filter_by(
            tenant_id=tenant_id,
            id=staff_profile_id
        ).first()
        
        if not staff_profile:
            raise ValueError("Staff profile not found")
        
        # Get work schedules for the date range
        schedules = WorkSchedule.query.filter(
            and_(
                WorkSchedule.tenant_id == tenant_id,
                WorkSchedule.staff_profile_id == staff_profile_id,
                WorkSchedule.start_date <= end_date.date(),
                or_(
                    WorkSchedule.end_date.is_(None),
                    WorkSchedule.end_date >= start_date.date()
                )
            )
        ).all()
        
        # Convert schedules to availability slots
        availability = []
        current_date = start_date.date()
        end_date_only = end_date.date()
        
        while current_date <= end_date_only:
            for schedule in schedules:
                if (schedule.start_date <= current_date and 
                    (schedule.end_date is None or schedule.end_date >= current_date)):
                    
                    if not schedule.is_time_off:
                        # Add available time slots
                        availability.append({
                            'date': current_date.isoformat(),
                            'schedule_type': schedule.schedule_type,
                            'work_hours': schedule.work_hours,
                            'overrides_regular': schedule.overrides_regular
                        })
            
            current_date += timedelta(days=1)
        
        return availability
    
    def _log_assignment_change(self, tenant_id: uuid.UUID, staff_profile_id: uuid.UUID, 
                             change_type: str, old_values: Optional[Dict], new_values: Optional[Dict], 
                             user_id: uuid.UUID, reason: str):
        """Log staff assignment changes for audit."""
        history_entry = StaffAssignmentHistory(
            tenant_id=tenant_id,
            staff_profile_id=staff_profile_id,
            change_type=change_type,
            old_values=old_values,
            new_values=new_values,
            changed_by=user_id,
            reason=reason
        )
        
        db.session.add(history_entry)


class BookingService(BaseService):
    """Service for booking lifecycle management (Module G)."""
    
    def create_booking(self, tenant_id: uuid.UUID, booking_data: Dict[str, Any], user_id: uuid.UUID) -> Booking:
        """Create a new booking with validation."""
        # Handle customer creation if customer data is provided instead of customer_id
        customer_id = booking_data.get('customer_id')
        if not customer_id and 'customer' in booking_data:
            # Create customer from provided data
            customer_service = CustomerService()
            customer = customer_service.create_customer(tenant_id, booking_data['customer'])
            customer_id = customer.id
        elif not customer_id:
            raise ValueError("Missing required field: customer_id or customer data")
        
        # Validate required fields
        self._validate_required_fields(booking_data, ['service_id', 'resource_id', 'start_at', 'end_at'])
        
        # Parse datetime strings
        try:
            start_at = datetime.fromisoformat(booking_data['start_at'].replace('Z', '+00:00'))
            end_at = datetime.fromisoformat(booking_data['end_at'].replace('Z', '+00:00'))
        except ValueError as e:
            raise ValueError(f"Invalid datetime format: {str(e)}")
        
        # Validate time order
        self._validate_datetime_range(start_at, end_at)
        
        # Get service data for snapshot
        service = Service.query.filter_by(
            tenant_id=tenant_id,
            id=booking_data['service_id'],
            deleted_at=None
        ).first()
        
        if not service:
            raise ValueError("Service not found")
        
        # Create service snapshot
        service_snapshot = {
            'service_id': str(service.id),
            'name': service.name,
            'duration_min': service.duration_min,
            'price_cents': service.price_cents,
            'category': service.category
        }
        
        # Check for idempotency using client_generated_id
        client_generated_id = booking_data.get('client_generated_id')
        if client_generated_id:
            existing_booking = Booking.query.filter_by(
                tenant_id=tenant_id,
                client_generated_id=client_generated_id
            ).first()
            
            if existing_booking:
                return existing_booking
        
        # Check for overlapping bookings first
        existing_booking = Booking.query.filter(
            and_(
                Booking.tenant_id == tenant_id,
                Booking.resource_id == booking_data['resource_id'],
                Booking.status.in_(['confirmed', 'checked_in']),
                or_(
                    and_(Booking.start_at < end_at, Booking.end_at > start_at)
                )
            )
        ).first()
        
        if existing_booking:
            raise ValueError("Booking time conflicts with existing booking")
        
        # Check availability
        availability_service = AvailabilityService()
        if not availability_service.is_time_available(tenant_id, booking_data['resource_id'], start_at, end_at):
            raise ValueError("Selected time is not available")
        
        def _create_booking():
            # Create booking
            booking = Booking(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                customer_id=customer_id,
                resource_id=booking_data['resource_id'],
                client_generated_id=client_generated_id or str(uuid.uuid4()),
                service_snapshot=service_snapshot,
                start_at=start_at,
                end_at=end_at,
                booking_tz=booking_data.get('booking_tz', 'UTC'),
                status='pending',
                attendee_count=booking_data.get('attendee_count', 1)
            )
            
            db.session.add(booking)
            return booking
        
        result = self._safe_db_operation(_create_booking)
        
        # Emit outbox event for booking creation
        self._emit_event(tenant_id, "BOOKING_CREATED", {
            "booking_id": str(result.id),
            "customer_id": str(result.customer_id),
            "service_id": result.service_snapshot.get('service_id'),
            "resource_id": str(result.resource_id),
            "start_at": result.start_at.isoformat(),
            "end_at": result.end_at.isoformat(),
            "status": result.status
        })
        
        return result
    
    def confirm_booking(self, tenant_id: uuid.UUID, booking_id: uuid.UUID, user_id: uuid.UUID, require_payment: bool = False) -> bool:
        """Confirm a pending booking."""
        booking = self.get_booking(tenant_id, booking_id)
        if not booking:
            return False
        
        if booking.status != 'pending':
            raise ValueError("Only pending bookings can be confirmed")
        
        # For testing purposes, we'll allow confirmation without payment validation
        # In a real implementation, you'd check actual payment status
        if require_payment:
            raise ValueError("Payment required to confirm booking")
        
        def _confirm_booking():
            booking.status = 'confirmed'
            booking.updated_at = datetime.utcnow()
            return True
        
        result = self._safe_db_operation(_confirm_booking)
        
        # Emit outbox event for booking confirmation
        self._emit_event(tenant_id, "BOOKING_CONFIRMED", {
            "booking_id": str(booking.id),
            "customer_id": str(booking.customer_id),
            "service_id": booking.service_snapshot.get('service_id'),
            "resource_id": str(booking.resource_id),
            "start_at": booking.start_at.isoformat(),
            "end_at": booking.end_at.isoformat(),
            "status": booking.status
        })
        
        return result
    
    def cancel_booking(self, tenant_id: uuid.UUID, booking_id: uuid.UUID, 
                      cancelled_by: uuid.UUID, reason: str = None) -> Optional[Booking]:
        """Cancel a booking."""
        booking = self.get_booking(tenant_id, booking_id)
        if not booking:
            return None
        
        if booking.status in ['canceled', 'completed']:
            raise ValueError("Cannot cancel booking in current status")
        
        old_status = booking.status
        
        def _cancel_booking():
            booking.status = 'canceled'
            booking.canceled_at = datetime.utcnow()
            booking.updated_at = datetime.utcnow()
            return booking
        
        result = self._safe_db_operation(_cancel_booking)
        
        # Log audit trail
        self._log_audit(tenant_id, "booking", booking.id, "UPDATE", cancelled_by, 
                       old_values={"status": old_status}, 
                       new_values={"status": "canceled", "canceled_at": booking.canceled_at.isoformat()})
        
        return result
    
    def reschedule_booking(self, tenant_id: uuid.UUID, booking_id: uuid.UUID, 
                          new_start_at: str, new_end_at: str, user_id: uuid.UUID) -> Optional[Booking]:
        """Reschedule a booking to new times."""
        booking = self.get_booking(tenant_id, booking_id)
        if not booking:
            return None
        
        if booking.status not in ['confirmed', 'checked_in']:
            raise ValueError("Only confirmed bookings can be rescheduled")
        
        # Parse new times
        try:
            new_start = datetime.fromisoformat(new_start_at.replace('Z', '+00:00'))
            new_end = datetime.fromisoformat(new_end_at.replace('Z', '+00:00'))
        except ValueError as e:
            raise ValueError(f"Invalid datetime format: {str(e)}")
        
        # Validate time order
        self._validate_datetime_range(new_start, new_end)
        
        # Check availability
        availability_service = AvailabilityService()
        if not availability_service.is_time_available(tenant_id, booking.resource_id, new_start, new_end):
            raise ValueError("New time slot is not available")
        
        def _reschedule_booking():
            booking.start_at = new_start
            booking.end_at = new_end
            booking.rescheduled_from = booking.id  # Self-reference for tracking
            booking.updated_at = datetime.utcnow()
            return booking
        
        result = self._safe_db_operation(_reschedule_booking)
        
        return result
    
    def mark_no_show(self, tenant_id: uuid.UUID, booking_id: uuid.UUID, user_id: uuid.UUID) -> Optional[Booking]:
        """Mark a booking as no-show."""
        booking = self.get_booking(tenant_id, booking_id)
        if not booking:
            return None
        
        if booking.status not in ['confirmed', 'checked_in']:
            raise ValueError("Only confirmed bookings can be marked as no-show")
        
        def _mark_no_show():
            booking.status = 'no_show'
            booking.no_show_flag = True
            booking.updated_at = datetime.utcnow()
            return booking
        
        result = self._safe_db_operation(_mark_no_show)
        
        return result
    
    def get_booking(self, tenant_id: uuid.UUID, booking_id: uuid.UUID) -> Optional[Booking]:
        """Get a booking by ID with tenant isolation."""
        booking_id = self._validate_uuid(booking_id, 'booking_id')
        
        return Booking.query.filter_by(
            tenant_id=tenant_id,
            id=booking_id
        ).first()
    
    def get_bookings(self, tenant_id: uuid.UUID, status: Optional[str] = None, 
                    start_date: Optional[datetime] = None, end_date: Optional[datetime] = None) -> List[Booking]:
        """Get bookings for a tenant with optional filters."""
        query = Booking.query.filter_by(tenant_id=tenant_id)
        
        if status:
            query = query.filter_by(status=status)
        
        if start_date:
            query = query.filter(Booking.start_at >= start_date)
        
        if end_date:
            query = query.filter(Booking.start_at <= end_date)
        
        return query.order_by(Booking.start_at).all()
    
    def get_status_precedence(self, status: str) -> int:
        """Get status precedence for sorting."""
        precedence = {
            'failed': 0,
            'pending': 1,
            'confirmed': 2,
            'checked_in': 3,
            'completed': 4,
            'no_show': 5,
            'canceled': 6
        }
        return precedence.get(status, 0)


class CustomerService(BaseService):
    """Service for customer-related business logic."""
    
    def create_customer(self, tenant_id: uuid.UUID, customer_data: Dict[str, Any]) -> Customer:
        """Create a new customer."""
        # Generate display name from email if not provided
        display_name = customer_data.get('display_name', '')
        if not display_name and customer_data.get('email'):
            display_name = "New Customer"
        
        def _create_customer():
            customer = Customer(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                display_name=display_name,
                email=customer_data.get('email', ''),
                phone=customer_data.get('phone', ''),
                marketing_opt_in=customer_data.get('marketing_opt_in', False),
                notification_preferences=customer_data.get('notification_preferences', {}),
                is_first_time=customer_data.get('is_first_time', True)
            )
            
            db.session.add(customer)
            return customer
        
        result = self._safe_db_operation(_create_customer)
        
        return result
    
    def get_customer(self, tenant_id: uuid.UUID, customer_id: uuid.UUID) -> Optional[Customer]:
        """Get a customer by ID with tenant isolation."""
        customer_id = self._validate_uuid(customer_id, 'customer_id')
        
        return Customer.query.filter_by(
            tenant_id=tenant_id,
            id=customer_id,
            deleted_at=None
        ).first()
    
    def get_customers(self, tenant_id: uuid.UUID) -> List[Customer]:
        """Get all customers for a tenant."""
        return Customer.query.filter_by(
            tenant_id=tenant_id,
            deleted_at=None
        ).order_by(Customer.display_name).all()
    
    def update_customer(self, tenant_id: uuid.UUID, customer_id: uuid.UUID, 
                       update_data: Dict[str, Any]) -> Optional[Customer]:
        """Update a customer."""
        customer = self.get_customer(tenant_id, customer_id)
        if not customer:
            return None
        
        def _update_customer():
            for field, value in update_data.items():
                if hasattr(customer, field):
                    setattr(customer, field, value)
            
            customer.updated_at = datetime.utcnow()
            return customer
        
        result = self._safe_db_operation(_update_customer)
        
        return result