"""
Models Package

This package contains all database models for the Tithi backend.
"""

from .core import Tenant, User, Membership
from .business import (
    Customer, Service, Resource, Booking, CustomerMetrics, ServiceResource, BookingItem,
    StaffProfile, WorkSchedule, StaffAssignmentHistory, BookingHold, WaitlistEntry, AvailabilityCache
)
from .system import Theme, Branding
from .financial import Payment, Invoice, Refund
from .analytics import Event, Metric
from .crm import CustomerNote, CustomerSegment, LoyaltyAccount, LoyaltyTransaction, CustomerSegmentMembership

__all__ = [
    'Tenant', 'User', 'Membership',
    'Customer', 'Service', 'Resource', 'Booking', 'CustomerMetrics', 'ServiceResource', 'BookingItem',
    'StaffProfile', 'WorkSchedule', 'StaffAssignmentHistory', 'BookingHold', 'WaitlistEntry', 'AvailabilityCache',
    'Theme', 'Branding',
    'Payment', 'Invoice', 'Refund',
    'Event', 'Metric',
    'CustomerNote', 'CustomerSegment', 'LoyaltyAccount', 'LoyaltyTransaction', 'CustomerSegmentMembership'
]
