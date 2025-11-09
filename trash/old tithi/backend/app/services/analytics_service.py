"""
Comprehensive Analytics Service

This service provides comprehensive analytics and reporting for all business metrics,
customer behavior, revenue tracking, and performance analytics.
"""

import uuid
import logging
from datetime import datetime, timedelta, date
from typing import Dict, Any, List, Optional, Tuple
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, desc, asc
from sqlalchemy.sql import text

from ..extensions import db
from ..models.core import Tenant
from ..models.business import Customer, Service, Booking
from ..models.team import TeamMember
from ..models.analytics import (
    BusinessMetric, CustomerAnalytics, ServiceAnalytics, StaffAnalytics, 
    RevenueAnalytics, Event, Metric
)
from ..models.financial import Payment
from ..middleware.error_handler import TithiError

logger = logging.getLogger(__name__)


class AnalyticsService:
    """Service for comprehensive business analytics and reporting."""
    
    def __init__(self):
        self.db = db
    
    def get_dashboard_overview(self, tenant_id: str, date_range: Dict[str, str]) -> Dict[str, Any]:
        """
        Get comprehensive dashboard overview with key metrics.
        
        Args:
            tenant_id: Tenant ID
            date_range: Dictionary with 'start_date' and 'end_date'
        
        Returns:
            Dashboard overview data
        """
        try:
            start_date = datetime.fromisoformat(date_range['start_date'])
            end_date = datetime.fromisoformat(date_range['end_date'])
            
            # Revenue metrics
            revenue_metrics = self._calculate_revenue_metrics(tenant_id, start_date, end_date)
            
            # Booking metrics
            booking_metrics = self._calculate_booking_metrics(tenant_id, start_date, end_date)
            
            # Customer metrics
            customer_metrics = self._calculate_customer_metrics(tenant_id, start_date, end_date)
            
            # Staff performance
            staff_metrics = self._calculate_staff_metrics(tenant_id, start_date, end_date)
            
            # Service performance
            service_metrics = self._calculate_service_metrics(tenant_id, start_date, end_date)
            
            return {
                'revenue': revenue_metrics,
                'bookings': booking_metrics,
                'customers': customer_metrics,
                'staff': staff_metrics,
                'services': service_metrics,
                'date_range': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat()
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get dashboard overview: {str(e)}")
            raise TithiError(
                message="Failed to get dashboard overview",
                code="TITHI_ANALYTICS_ERROR"
            )
    
    def get_revenue_analytics(self, tenant_id: str, date_range: Dict[str, str]) -> Dict[str, Any]:
        """
        Get comprehensive revenue analytics.
        
        Args:
            tenant_id: Tenant ID
            date_range: Dictionary with 'start_date' and 'end_date'
        
        Returns:
            Revenue analytics data
        """
        try:
            start_date = datetime.fromisoformat(date_range['start_date'])
            end_date = datetime.fromisoformat(date_range['end_date'])
            
            # Total revenue
            total_revenue = self.db.session.query(
                func.sum(Booking.total_amount_cents)
            ).filter(
                and_(
                    Booking.tenant_id == tenant_id,
                    Booking.status == 'confirmed',
                    Booking.start_at >= start_date,
                    Booking.start_at <= end_date
                )
            ).scalar() or 0
            
            # Revenue by payment method
            revenue_by_payment = self.db.session.query(
                Payment.payment_method,
                func.sum(Booking.total_amount_cents)
            ).join(Booking, Payment.booking_id == Booking.id).filter(
                and_(
                    Booking.tenant_id == tenant_id,
                    Booking.status == 'confirmed',
                    Booking.start_at >= start_date,
                    Booking.start_at <= end_date
                )
            ).group_by(Payment.payment_method).all()
            
            # Revenue by service
            revenue_by_service = self.db.session.query(
                Service.name,
                func.sum(Booking.total_amount_cents)
            ).join(Booking, Service.id == Booking.resource_id).filter(
                and_(
                    Booking.tenant_id == tenant_id,
                    Booking.status == 'confirmed',
                    Booking.start_at >= start_date,
                    Booking.start_at <= end_date
                )
            ).group_by(Service.name).all()
            
            # Revenue by staff member
            revenue_by_staff = self.db.session.query(
                TeamMember.name,
                func.sum(Booking.total_amount_cents)
            ).join(Booking, TeamMember.id == Booking.resource_id).filter(
                and_(
                    Booking.tenant_id == tenant_id,
                    Booking.status == 'confirmed',
                    Booking.start_at >= start_date,
                    Booking.start_at <= end_date
                )
            ).group_by(TeamMember.name).all()
            
            # Daily revenue trend
            daily_revenue = self.db.session.query(
                func.date(Booking.start_at).label('date'),
                func.sum(Booking.total_amount_cents).label('revenue')
            ).filter(
                and_(
                    Booking.tenant_id == tenant_id,
                    Booking.status == 'confirmed',
                    Booking.start_at >= start_date,
                    Booking.start_at <= end_date
                )
            ).group_by(func.date(Booking.start_at)).order_by('date').all()
            
            return {
                'total_revenue_cents': total_revenue,
                'revenue_by_payment_method': [
                    {'method': method, 'amount_cents': amount} 
                    for method, amount in revenue_by_payment
                ],
                'revenue_by_service': [
                    {'service_name': name, 'amount_cents': amount} 
                    for name, amount in revenue_by_service
                ],
                'revenue_by_staff': [
                    {'staff_name': name, 'amount_cents': amount} 
                    for name, amount in revenue_by_staff
                ],
                'daily_revenue_trend': [
                    {'date': str(date), 'revenue_cents': revenue} 
                    for date, revenue in daily_revenue
                ]
            }
            
        except Exception as e:
            logger.error(f"Failed to get revenue analytics: {str(e)}")
            raise TithiError(
                message="Failed to get revenue analytics",
                code="TITHI_REVENUE_ANALYTICS_ERROR"
            )
    
    def get_customer_analytics(self, tenant_id: str, date_range: Dict[str, str]) -> Dict[str, Any]:
        """
        Get comprehensive customer analytics.
        
        Args:
            tenant_id: Tenant ID
            date_range: Dictionary with 'start_date' and 'end_date'
        
        Returns:
            Customer analytics data
        """
        try:
            start_date = datetime.fromisoformat(date_range['start_date'])
            end_date = datetime.fromisoformat(date_range['end_date'])
            
            # New vs returning customers
            new_customers = self.db.session.query(Customer).filter(
                and_(
                    Customer.tenant_id == tenant_id,
                    Customer.created_at >= start_date,
                    Customer.created_at <= end_date
                )
            ).count()
            
            returning_customers = self.db.session.query(Customer).filter(
                and_(
                    Customer.tenant_id == tenant_id,
                    Customer.customer_first_booking_at < start_date
                )
            ).count()
            
            # Customer lifetime value
            customer_lifetime_value = self.db.session.query(
                func.avg(Booking.total_amount_cents)
            ).join(Customer, Booking.customer_id == Customer.id).filter(
                and_(
                    Booking.tenant_id == tenant_id,
                    Booking.status == 'confirmed'
                )
            ).scalar() or 0
            
            # Customer retention rate
            total_customers = self.db.session.query(Customer).filter(
                Customer.tenant_id == tenant_id
            ).count()
            
            active_customers = self.db.session.query(Customer).filter(
                and_(
                    Customer.tenant_id == tenant_id,
                    Customer.customer_first_booking_at >= start_date
                )
            ).count()
            
            retention_rate = (active_customers / total_customers * 100) if total_customers > 0 else 0
            
            # Top customers by revenue
            top_customers = self.db.session.query(
                Customer.display_name,
                func.sum(Booking.total_amount_cents).label('total_spent')
            ).join(Booking, Customer.id == Booking.customer_id).filter(
                and_(
                    Booking.tenant_id == tenant_id,
                    Booking.status == 'confirmed',
                    Booking.start_at >= start_date,
                    Booking.start_at <= end_date
                )
            ).group_by(Customer.id, Customer.display_name).order_by(desc('total_spent')).limit(10).all()
            
            return {
                'new_customers': new_customers,
                'returning_customers': returning_customers,
                'customer_lifetime_value_cents': int(customer_lifetime_value),
                'retention_rate_percent': round(retention_rate, 2),
                'top_customers': [
                    {'name': name, 'total_spent_cents': spent} 
                    for name, spent in top_customers
                ]
            }
            
        except Exception as e:
            logger.error(f"Failed to get customer analytics: {str(e)}")
            raise TithiError(
                message="Failed to get customer analytics",
                code="TITHI_CUSTOMER_ANALYTICS_ERROR"
            )
    
    def get_booking_analytics(self, tenant_id: str, date_range: Dict[str, str]) -> Dict[str, Any]:
        """
        Get comprehensive booking analytics.
        
        Args:
            tenant_id: Tenant ID
            date_range: Dictionary with 'start_date' and 'end_date'
        
        Returns:
            Booking analytics data
        """
        try:
            start_date = datetime.fromisoformat(date_range['start_date'])
            end_date = datetime.fromisoformat(date_range['end_date'])
            
            # Total bookings
            total_bookings = self.db.session.query(Booking).filter(
                and_(
                    Booking.tenant_id == tenant_id,
                    Booking.start_at >= start_date,
                    Booking.start_at <= end_date
                )
            ).count()
            
            # Booking status breakdown
            booking_status = self.db.session.query(
                Booking.status,
                func.count(Booking.id)
            ).filter(
                and_(
                    Booking.tenant_id == tenant_id,
                    Booking.start_at >= start_date,
                    Booking.start_at <= end_date
                )
            ).group_by(Booking.status).all()
            
            # Cancellation rate
            cancelled_bookings = self.db.session.query(Booking).filter(
                and_(
                    Booking.tenant_id == tenant_id,
                    Booking.status == 'cancelled',
                    Booking.start_at >= start_date,
                    Booking.start_at <= end_date
                )
            ).count()
            
            cancellation_rate = (cancelled_bookings / total_bookings * 100) if total_bookings > 0 else 0
            
            # No-show rate
            no_show_bookings = self.db.session.query(Booking).filter(
                and_(
                    Booking.tenant_id == tenant_id,
                    Booking.status == 'no_show',
                    Booking.start_at >= start_date,
                    Booking.start_at <= end_date
                )
            ).count()
            
            no_show_rate = (no_show_bookings / total_bookings * 100) if total_bookings > 0 else 0
            
            # Peak booking hours
            peak_hours = self.db.session.query(
                func.extract('hour', Booking.start_at).label('hour'),
                func.count(Booking.id).label('booking_count')
            ).filter(
                and_(
                    Booking.tenant_id == tenant_id,
                    Booking.start_at >= start_date,
                    Booking.start_at <= end_date
                )
            ).group_by(func.extract('hour', Booking.start_at)).order_by(desc('booking_count')).limit(5).all()
            
            return {
                'total_bookings': total_bookings,
                'booking_status_breakdown': [
                    {'status': status, 'count': count} 
                    for status, count in booking_status
                ],
                'cancellation_rate_percent': round(cancellation_rate, 2),
                'no_show_rate_percent': round(no_show_rate, 2),
                'peak_booking_hours': [
                    {'hour': int(hour), 'booking_count': count} 
                    for hour, count in peak_hours
                ]
            }
            
        except Exception as e:
            logger.error(f"Failed to get booking analytics: {str(e)}")
            raise TithiError(
                message="Failed to get booking analytics",
                code="TITHI_BOOKING_ANALYTICS_ERROR"
            )
    
    def get_staff_performance(self, tenant_id: str, date_range: Dict[str, str]) -> Dict[str, Any]:
        """
        Get staff performance analytics.
        
        Args:
            tenant_id: Tenant ID
            date_range: Dictionary with 'start_date' and 'end_date'
        
        Returns:
            Staff performance data
        """
        try:
            start_date = datetime.fromisoformat(date_range['start_date'])
            end_date = datetime.fromisoformat(date_range['end_date'])
            
            # Staff performance metrics
            staff_performance = self.db.session.query(
                TeamMember.name,
                func.count(Booking.id).label('total_bookings'),
                func.sum(Booking.total_amount_cents).label('total_revenue'),
                func.avg(Booking.total_amount_cents).label('avg_booking_value')
            ).join(Booking, TeamMember.id == Booking.resource_id).filter(
                and_(
                    Booking.tenant_id == tenant_id,
                    Booking.status == 'confirmed',
                    Booking.start_at >= start_date,
                    Booking.start_at <= end_date
                )
            ).group_by(TeamMember.id, TeamMember.name).all()
            
            # Staff utilization (booked hours vs available hours)
            staff_utilization = []
            for staff in self.db.session.query(TeamMember).filter(
                TeamMember.tenant_id == tenant_id
            ).all():
                # Calculate booked hours
                booked_hours = self.db.session.query(
                    func.sum(Booking.total_amount_cents)  # This should be duration, not amount
                ).filter(
                    and_(
                        Booking.tenant_id == tenant_id,
                        Booking.resource_id == staff.id,
                        Booking.status == 'confirmed',
                        Booking.start_at >= start_date,
                        Booking.start_at <= end_date
                    )
                ).scalar() or 0
                
                # Calculate available hours (simplified)
                available_hours = 40 * 4  # 40 hours per week for 4 weeks
                utilization_rate = (booked_hours / available_hours * 100) if available_hours > 0 else 0
                
                staff_utilization.append({
                    'staff_name': staff.name,
                    'booked_hours': booked_hours,
                    'available_hours': available_hours,
                    'utilization_rate_percent': round(utilization_rate, 2)
                })
            
            return {
                'staff_performance': [
                    {
                        'staff_name': name,
                        'total_bookings': bookings,
                        'total_revenue_cents': int(revenue or 0),
                        'avg_booking_value_cents': int(avg_value or 0)
                    }
                    for name, bookings, revenue, avg_value in staff_performance
                ],
                'staff_utilization': staff_utilization
            }
            
        except Exception as e:
            logger.error(f"Failed to get staff performance: {str(e)}")
            raise TithiError(
                message="Failed to get staff performance",
                code="TITHI_STAFF_ANALYTICS_ERROR"
            )
    
    def track_event(self, tenant_id: str, event_data: Dict[str, Any]) -> None:
        """
        Track a business event for analytics.
        
        Args:
            tenant_id: Tenant ID
            event_data: Event information
                - event_type: Type of event
                - event_name: Name of event
                - user_id: Optional user ID
                - customer_id: Optional customer ID
                - booking_id: Optional booking ID
                - service_id: Optional service ID
                - metadata: Additional event metadata
        """
        try:
            event = Event(
                tenant_id=tenant_id,
                event_type=event_data['event_type'],
                event_name=event_data['event_name'],
                user_id=event_data.get('user_id'),
                customer_id=event_data.get('customer_id'),
                booking_id=event_data.get('booking_id'),
                service_id=event_data.get('service_id'),
                metadata=event_data.get('metadata', {}),
                ip_address=event_data.get('ip_address'),
                user_agent=event_data.get('user_agent')
            )
            
            self.db.session.add(event)
            self.db.session.commit()
            
            logger.info(f"Event tracked: {event_data['event_name']}", extra={
                'tenant_id': tenant_id,
                'event_type': event_data['event_type']
            })
            
        except Exception as e:
            self.db.session.rollback()
            logger.error(f"Failed to track event: {str(e)}")
            raise TithiError(
                message="Failed to track event",
                code="TITHI_EVENT_TRACKING_ERROR"
            )
    
    def _calculate_revenue_metrics(self, tenant_id: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Calculate revenue metrics for the date range."""
        total_revenue = self.db.session.query(
            func.sum(Booking.total_amount_cents)
        ).filter(
            and_(
                Booking.tenant_id == tenant_id,
                Booking.status == 'confirmed',
                Booking.start_at >= start_date,
                Booking.start_at <= end_date
            )
        ).scalar() or 0
        
        # Previous period comparison
        period_days = (end_date - start_date).days
        prev_start = start_date - timedelta(days=period_days)
        prev_end = start_date
        
        prev_revenue = self.db.session.query(
            func.sum(Booking.total_amount_cents)
        ).filter(
            and_(
                Booking.tenant_id == tenant_id,
                Booking.status == 'confirmed',
                Booking.start_at >= prev_start,
                Booking.start_at <= prev_end
            )
        ).scalar() or 0
        
        revenue_growth = ((total_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0
        
        return {
            'total_revenue_cents': total_revenue,
            'revenue_growth_percent': round(revenue_growth, 2),
            'avg_daily_revenue_cents': int(total_revenue / period_days) if period_days > 0 else 0
        }
    
    def _calculate_booking_metrics(self, tenant_id: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Calculate booking metrics for the date range."""
        total_bookings = self.db.session.query(Booking).filter(
            and_(
                Booking.tenant_id == tenant_id,
                Booking.start_at >= start_date,
                Booking.start_at <= end_date
            )
        ).count()
        
        confirmed_bookings = self.db.session.query(Booking).filter(
            and_(
                Booking.tenant_id == tenant_id,
                Booking.status == 'confirmed',
                Booking.start_at >= start_date,
                Booking.start_at <= end_date
            )
        ).count()
        
        conversion_rate = (confirmed_bookings / total_bookings * 100) if total_bookings > 0 else 0
        
        return {
            'total_bookings': total_bookings,
            'confirmed_bookings': confirmed_bookings,
            'conversion_rate_percent': round(conversion_rate, 2)
        }
    
    def _calculate_customer_metrics(self, tenant_id: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Calculate customer metrics for the date range."""
        new_customers = self.db.session.query(Customer).filter(
            and_(
                Customer.tenant_id == tenant_id,
                Customer.created_at >= start_date,
                Customer.created_at <= end_date
            )
        ).count()
        
        total_customers = self.db.session.query(Customer).filter(
            Customer.tenant_id == tenant_id
        ).count()
        
        return {
            'new_customers': new_customers,
            'total_customers': total_customers
        }
    
    def _calculate_staff_metrics(self, tenant_id: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Calculate staff metrics for the date range."""
        active_staff = self.db.session.query(TeamMember).filter(
            and_(
                TeamMember.tenant_id == tenant_id,
                TeamMember.is_active == True
            )
        ).count()
        
        return {
            'active_staff_count': active_staff
        }
    
    def _calculate_service_metrics(self, tenant_id: str, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Calculate service metrics for the date range."""
        active_services = self.db.session.query(Service).filter(
            and_(
                Service.tenant_id == tenant_id,
                Service.active == True
            )
        ).count()
        
        return {
            'active_services_count': active_services
        }