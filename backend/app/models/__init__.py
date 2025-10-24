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
from .financial import Payment, Invoice, Refund, PaymentMethod, TenantBilling, PromotionUsage
from .analytics import Event, Metric, BusinessMetric, CustomerAnalytics, ServiceAnalytics, StaffAnalytics, RevenueAnalytics, DashboardWidget
from .crm import CustomerNote, CustomerSegment, LoyaltyAccount, LoyaltyTransaction, CustomerSegmentMembership
from .automation import Automation, AutomationExecution, AutomationStatus, AutomationTrigger, AutomationAction
from .idempotency import IdempotencyKey
from .availability import AvailabilityRule, AvailabilityException
from .promotions import Coupon, GiftCard, Referral, CouponUsage, GiftCardTransaction
from .notification import NotificationTemplate, Notification, NotificationPreference, NotificationLog, NotificationQueue, NotificationPlaceholder
from .notification_enhanced import (
    NotificationTemplateEnhanced, NotificationPlaceholder, NotificationQueueEnhanced, 
    NotificationAutomation, NotificationAnalytics
)
from .team import TeamMember, TeamMemberAvailability, TeamMemberService, ServiceCategory, BusinessPolicy
from .onboarding import (
    OnboardingProgress, OnboardingChecklist, BusinessBranding, GiftCardTemplate
)
from .booking_flow import (
    BookingSession, ServiceDisplay, AvailabilitySlot, CustomerBookingProfile,
    BookingFlowAnalytics, BookingFlowConfiguration
)
from .usage import UsageCounter, Quota
from .audit import AuditLog, EventOutbox, WebhookEventInbox
from .oauth import OAuthProvider

__all__ = [
    # Core models
    'Tenant', 'User', 'Membership',
    
    # Business models
    'Customer', 'Service', 'Resource', 'Booking', 'CustomerMetrics', 'ServiceResource', 'BookingItem',
    'StaffProfile', 'WorkSchedule', 'StaffAssignmentHistory', 'BookingHold', 'WaitlistEntry', 'AvailabilityCache',
    
    # System models
    'Theme', 'Branding',
    
    # Financial models
    'Payment', 'Invoice', 'Refund', 'PaymentMethod', 'TenantBilling', 'PromotionUsage',
    
    # Analytics models
    'Event', 'Metric', 'BusinessMetric', 'CustomerAnalytics', 'ServiceAnalytics', 'StaffAnalytics', 'RevenueAnalytics', 'DashboardWidget',
    
    # CRM models
    'CustomerNote', 'CustomerSegment', 'LoyaltyAccount', 'LoyaltyTransaction', 'CustomerSegmentMembership',
    
    # Automation models
    'Automation', 'AutomationExecution', 'AutomationStatus', 'AutomationTrigger', 'AutomationAction',
    
    # Idempotency models
    'IdempotencyKey',
    
    # Availability models
    'AvailabilityRule', 'AvailabilityException',
    
    # Promotion models
    'Coupon', 'GiftCard', 'Referral', 'CouponUsage', 'GiftCardTransaction',
    
    # Notification models
    'NotificationTemplate', 'Notification', 'NotificationPreference', 'NotificationLog', 'NotificationQueue', 'NotificationPlaceholder',
    
    # Enhanced notification models
    'NotificationTemplateEnhanced', 'NotificationQueueEnhanced', 'NotificationAutomation', 'NotificationAnalytics',
    
    # Team models
    'TeamMember', 'TeamMemberAvailability', 'TeamMemberService', 'ServiceCategory', 'BusinessPolicy',
    
    # Onboarding models
    'OnboardingProgress', 'OnboardingChecklist', 'BusinessBranding', 'GiftCardTemplate',
    
    # Booking flow models
    'BookingSession', 'ServiceDisplay', 'AvailabilitySlot', 'CustomerBookingProfile', 'BookingFlowAnalytics', 'BookingFlowConfiguration',
    
    # Usage models
    'UsageCounter', 'Quota',
    
    # Audit models
    'AuditLog', 'EventOutbox', 'WebhookEventInbox',
    
    # OAuth models
    'OAuthProvider'
]
