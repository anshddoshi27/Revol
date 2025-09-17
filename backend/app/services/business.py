"""
Business Services

This module contains business logic services for customers, services, and bookings.
Phase 2 implementation is imported from business_phase2.py
"""

from typing import Dict, Any, Optional
from ..extensions import db
from ..models.business import Customer, Service, Resource, Booking

# Import Phase 2 services
from .business_phase2 import ServiceService, BookingService, AvailabilityService, CustomerService

# Re-export for backward compatibility
__all__ = ['ServiceService', 'BookingService', 'AvailabilityService', 'CustomerService']
