"""
Enhanced Analytics Service

This module provides comprehensive analytics and reporting functionality
including business metrics, performance analytics, and custom reporting.
"""

import uuid
import json
from datetime import datetime, timedelta, date
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass
from enum import Enum
from sqlalchemy import func, and_, or_, desc, asc, text, case, Time
from sqlalchemy.orm import joinedload

from ..extensions import db
from ..models.business import (
    Booking, Customer, Service, Resource, StaffProfile, WorkSchedule,
    BookingItem, CustomerMetrics
)
from ..models.core import Tenant
from ..models.financial import Payment, Refund


class AnalyticsPeriod(Enum):
    """Analytics time periods."""
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


class MetricType(Enum):
    """Types of metrics."""
    COUNT = "count"
    SUM = "sum"
    AVERAGE = "average"
    PERCENTAGE = "percentage"
    RATIO = "ratio"
    GROWTH_RATE = "growth_rate"


@dataclass
class MetricValue:
    """Represents a metric value."""
    value: float
    period: str
    date: date
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class AnalyticsReport:
    """Represents an analytics report."""
    report_id: str
    title: str
    period: AnalyticsPeriod
    start_date: date
    end_date: date
    metrics: Dict[str, List[MetricValue]]
    summary: Dict[str, Any]
    generated_at: datetime


class BusinessMetricsService:
    """Service for business metrics and KPIs."""
    
    def get_revenue_metrics(self, tenant_id: uuid.UUID, start_date: date, 
                          end_date: date, period: AnalyticsPeriod = AnalyticsPeriod.DAILY) -> Dict[str, Any]:
        """Get revenue metrics for the period."""
        try:
            # Base query for payments
            base_query = Payment.query.filter(
                and_(
                    Payment.tenant_id == tenant_id,
                    Payment.created_at >= start_date,
                    Payment.created_at <= end_date,
                    Payment.status == 'captured'
                )
            )
            
            # Total revenue
            total_revenue = base_query.with_entities(
                func.sum(Payment.amount_cents).label('total_revenue')
            ).scalar() or 0
            
            # Revenue by period
            revenue_by_period = self._group_by_period(
                base_query, Payment.created_at, Payment.amount_cents, period
            )
            
            # Revenue growth
            previous_period_revenue = self._get_previous_period_revenue(
                tenant_id, start_date, end_date, period
            )
            revenue_growth = self._calculate_growth_rate(total_revenue, previous_period_revenue)
            
            # Average booking value
            avg_booking_value = base_query.with_entities(
                func.avg(Payment.amount_cents).label('avg_booking_value')
            ).scalar() or 0
            
            # Revenue by service
            revenue_by_service = db.session.query(
                Service.name,
                func.sum(Payment.amount_cents).label('revenue')
            ).join(Booking, Service.id == Booking.service_snapshot['id'].astext.cast(uuid.UUID)) \
             .join(Payment, Payment.booking_id == Booking.id) \
             .filter(
                and_(
                    Payment.tenant_id == tenant_id,
                    Payment.created_at >= start_date,
                    Payment.created_at <= end_date,
                    Payment.status == 'captured'
                )
             ).group_by(Service.name).all()
            
            return {
                'total_revenue': total_revenue,
                'revenue_by_period': revenue_by_period,
                'revenue_growth': revenue_growth,
                'average_booking_value': avg_booking_value,
                'revenue_by_service': [
                    {'service': service, 'revenue': revenue} 
                    for service, revenue in revenue_by_service
                ]
            }
            
        except Exception as e:
            raise Exception(f"Failed to get revenue metrics: {str(e)}")
    
    def get_booking_metrics(self, tenant_id: uuid.UUID, start_date: date, 
                          end_date: date, period: AnalyticsPeriod = AnalyticsPeriod.DAILY) -> Dict[str, Any]:
        """Get booking metrics for the period."""
        try:
            # Base query for bookings
            base_query = Booking.query.filter(
                and_(
                    Booking.tenant_id == tenant_id,
                    Booking.start_at >= start_date,
                    Booking.start_at <= end_date
                )
            )
            
            # Total bookings
            total_bookings = base_query.count()
            
            # Bookings by status
            bookings_by_status = db.session.query(
                Booking.status,
                func.count(Booking.id).label('count')
            ).filter(
                and_(
                    Booking.tenant_id == tenant_id,
                    Booking.start_at >= start_date,
                    Booking.start_at <= end_date
                )
            ).group_by(Booking.status).all()
            
            # Bookings by period
            bookings_by_period = self._group_by_period(
                base_query, Booking.start_at, func.count(Booking.id), period
            )
            
            # Booking conversion rate
            confirmed_bookings = base_query.filter(Booking.status == 'confirmed').count()
            conversion_rate = (confirmed_bookings / total_bookings * 100) if total_bookings > 0 else 0
            
            # No-show rate
            no_show_bookings = base_query.filter(Booking.status == 'no_show').count()
            no_show_rate = (no_show_bookings / total_bookings * 100) if total_bookings > 0 else 0
            
            # Cancellation rate
            cancelled_bookings = base_query.filter(Booking.status == 'canceled').count()
            cancellation_rate = (cancelled_bookings / total_bookings * 100) if total_bookings > 0 else 0
            
            return {
                'total_bookings': total_bookings,
                'bookings_by_status': [
                    {'status': status, 'count': count} 
                    for status, count in bookings_by_status
                ],
                'bookings_by_period': bookings_by_period,
                'conversion_rate': conversion_rate,
                'no_show_rate': no_show_rate,
                'cancellation_rate': cancellation_rate
            }
            
        except Exception as e:
            raise Exception(f"Failed to get booking metrics: {str(e)}")
    
    def get_customer_metrics(self, tenant_id: uuid.UUID, start_date: date, 
                           end_date: date) -> Dict[str, Any]:
        """Get customer metrics for the period including churn and retention."""
        try:
            # Calculate churn cutoff date (90 days before end_date)
            churn_cutoff_date = end_date - timedelta(days=90)
            
            # Total customers (all customers created before or during period)
            total_customers = Customer.query.filter(
                and_(
                    Customer.tenant_id == tenant_id,
                    Customer.created_at <= end_date,
                    Customer.deleted_at.is_(None)
                )
            ).count()
            
            # New customers (created during the period)
            new_customers = Customer.query.filter(
                and_(
                    Customer.tenant_id == tenant_id,
                    Customer.created_at >= start_date,
                    Customer.created_at <= end_date,
                    Customer.deleted_at.is_(None)
                )
            ).count()
            
            # Returning customers (customers with bookings during period who existed before period)
            returning_customers = db.session.query(Customer.id).join(Booking, Customer.id == Booking.customer_id) \
                .filter(
                    and_(
                        Customer.tenant_id == tenant_id,
                        Customer.created_at < start_date,
                        Booking.start_at >= start_date,
                        Booking.start_at <= end_date,
                        Customer.deleted_at.is_(None)
                    )
                ).distinct().count()
            
            # Churned customers (no booking in last 90 days, but had bookings before)
            churned_customers = db.session.query(Customer.id) \
                .join(Booking, Customer.id == Booking.customer_id) \
                .filter(
                    and_(
                        Customer.tenant_id == tenant_id,
                        Customer.created_at <= churn_cutoff_date,
                        Customer.deleted_at.is_(None)
                    )
                ) \
                .group_by(Customer.id) \
                .having(
                    and_(
                        func.max(Booking.start_at) <= churn_cutoff_date,
                        func.count(Booking.id) > 0
                    )
                ).count()
            
            # Active customers (customers with bookings in last 90 days)
            active_customers = db.session.query(Customer.id) \
                .join(Booking, Customer.id == Booking.customer_id) \
                .filter(
                    and_(
                        Customer.tenant_id == tenant_id,
                        Booking.start_at > churn_cutoff_date,
                        Booking.start_at <= end_date,
                        Customer.deleted_at.is_(None)
                    )
                ).distinct().count()
            
            # Calculate churn rate
            churn_rate = 0.0
            if total_customers > 0:
                churn_rate = (churned_customers / total_customers) * 100
            
            # Calculate retention rate (active customers / total customers)
            retention_rate = 0.0
            if total_customers > 0:
                retention_rate = (active_customers / total_customers) * 100
            
            # Customer lifetime value (average spend per customer)
            customer_lifetime_value = db.session.query(
                func.avg(func.sum(Payment.amount_cents)).label('avg_clv')
            ).join(Booking, Payment.booking_id == Booking.id) \
             .join(Customer, Booking.customer_id == Customer.id) \
             .filter(
                and_(
                    Customer.tenant_id == tenant_id,
                    Payment.created_at >= start_date,
                    Payment.created_at <= end_date,
                    Payment.status == 'captured',
                    Customer.deleted_at.is_(None)
                )
             ).group_by(Customer.id).scalar() or 0
            
            # Customer acquisition cost (simplified - placeholder)
            cac = 0  # In production, this would be calculated based on marketing spend
            
            # Customer segments
            customer_segments = {
                'new_customers': new_customers,
                'returning_customers': returning_customers,
                'active_customers': active_customers,
                'churned_customers': churned_customers
            }
            
            return {
                'total_customers': total_customers,
                'customer_segments': customer_segments,
                'churn_rate': round(churn_rate, 2),
                'retention_rate': round(retention_rate, 2),
                'customer_lifetime_value': customer_lifetime_value,
                'customer_acquisition_cost': cac,
                'churn_definition': '90_days_no_booking',
                'period': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat(),
                    'churn_cutoff_date': churn_cutoff_date.isoformat()
                }
            }
            
        except Exception as e:
            raise Exception(f"Failed to get customer metrics: {str(e)}")
    
    def get_staff_metrics(self, tenant_id: uuid.UUID, start_date: date, 
                         end_date: date) -> Dict[str, Any]:
        """Get staff performance metrics including utilization, cancellations, and no-shows."""
        try:
            # Calculate available hours per staff from work schedules
            available_hours_query = db.session.query(
                StaffProfile.id,
                StaffProfile.display_name,
                func.sum(
                    func.extract('epoch', 
                        func.cast(WorkSchedule.work_hours['end_time'], Time) - 
                        func.cast(WorkSchedule.work_hours['start_time'], Time)
                    ) / 3600  # Convert seconds to hours
                ).label('available_hours')
            ).join(WorkSchedule, StaffProfile.id == WorkSchedule.staff_profile_id) \
             .filter(
                and_(
                    StaffProfile.tenant_id == tenant_id,
                    WorkSchedule.start_date <= end_date,
                    or_(
                        WorkSchedule.end_date.is_(None),
                        WorkSchedule.end_date >= start_date
                    ),
                    WorkSchedule.is_time_off == False,
                    WorkSchedule.schedule_type == 'regular'
                )
             ).group_by(StaffProfile.id, StaffProfile.display_name)
            
            available_hours_data = {
                row.id: {
                    'staff_name': row.display_name,
                    'available_hours': float(row.available_hours or 0)
                }
                for row in available_hours_query.all()
            }
            
            # Calculate booked hours per staff from bookings
            booked_hours_query = db.session.query(
                StaffProfile.id,
                StaffProfile.display_name,
                func.sum(
                    func.extract('epoch', Booking.end_at - Booking.start_at) / 3600
                ).label('booked_hours'),
                func.count(Booking.id).label('total_bookings'),
                func.sum(
                    case(
                        (Booking.status == 'canceled', 1),
                        else_=0
                    )
                ).label('cancellations'),
                func.sum(
                    case(
                        (Booking.status == 'no_show', 1),
                        else_=0
                    )
                ).label('no_shows')
            ).join(Resource, StaffProfile.resource_id == Resource.id) \
             .join(Booking, Resource.id == Booking.resource_id) \
             .filter(
                and_(
                    StaffProfile.tenant_id == tenant_id,
                    Booking.start_at >= start_date,
                    Booking.start_at <= end_date
                )
             ).group_by(StaffProfile.id, StaffProfile.display_name)
            
            booked_hours_data = {
                row.id: {
                    'staff_name': row.display_name,
                    'booked_hours': float(row.booked_hours or 0),
                    'total_bookings': int(row.total_bookings or 0),
                    'cancellations': int(row.cancellations or 0),
                    'no_shows': int(row.no_shows or 0)
                }
                for row in booked_hours_query.all()
            }
            
            # Calculate revenue per staff
            revenue_query = db.session.query(
                StaffProfile.id,
                func.sum(Payment.amount_cents).label('revenue')
            ).join(Resource, StaffProfile.resource_id == Resource.id) \
             .join(Booking, Resource.id == Booking.resource_id) \
             .join(Payment, Payment.booking_id == Booking.id) \
             .filter(
                and_(
                    StaffProfile.tenant_id == tenant_id,
                    Booking.start_at >= start_date,
                    Booking.start_at <= end_date,
                    Payment.status == 'captured'
                )
             ).group_by(StaffProfile.id)
            
            revenue_data = {
                row.id: int(row.revenue or 0)
                for row in revenue_query.all()
            }
            
            # Combine all data and calculate utilization
            staff_metrics = []
            all_staff_ids = set(available_hours_data.keys()) | set(booked_hours_data.keys())
            
            for staff_id in all_staff_ids:
                available_hours = available_hours_data.get(staff_id, {}).get('available_hours', 0)
                booked_data = booked_hours_data.get(staff_id, {})
                booked_hours = booked_data.get('booked_hours', 0)
                revenue = revenue_data.get(staff_id, 0)
                
                # Calculate utilization percentage
                if available_hours > 0:
                    utilization_percentage = min((booked_hours / available_hours) * 100, 100.0)
                else:
                    utilization_percentage = 0.0
                
                # Calculate cancellation and no-show rates
                total_bookings = booked_data.get('total_bookings', 0)
                cancellations = booked_data.get('cancellations', 0)
                no_shows = booked_data.get('no_shows', 0)
                
                cancellation_rate = (cancellations / total_bookings * 100) if total_bookings > 0 else 0.0
                no_show_rate = (no_shows / total_bookings * 100) if total_bookings > 0 else 0.0
                
                staff_name = available_hours_data.get(staff_id, {}).get('staff_name') or \
                           booked_data.get('staff_name', 'Unknown Staff')
                
                staff_metrics.append({
                    'staff_id': str(staff_id),
                    'staff_name': staff_name,
                    'available_hours': available_hours,
                    'booked_hours': booked_hours,
                    'utilization_percentage': round(utilization_percentage, 2),
                    'total_bookings': total_bookings,
                    'cancellations': cancellations,
                    'cancellation_rate': round(cancellation_rate, 2),
                    'no_shows': no_shows,
                    'no_show_rate': round(no_show_rate, 2),
                    'revenue_cents': revenue
                })
            
            # Calculate aggregate metrics
            total_available_hours = sum(data.get('available_hours', 0) for data in available_hours_data.values())
            total_booked_hours = sum(data.get('booked_hours', 0) for data in booked_hours_data.values())
            overall_utilization = (total_booked_hours / total_available_hours * 100) if total_available_hours > 0 else 0.0
            
            total_cancellations = sum(data.get('cancellations', 0) for data in booked_hours_data.values())
            total_no_shows = sum(data.get('no_shows', 0) for data in booked_hours_data.values())
            total_bookings = sum(data.get('total_bookings', 0) for data in booked_hours_data.values())
            
            overall_cancellation_rate = (total_cancellations / total_bookings * 100) if total_bookings > 0 else 0.0
            overall_no_show_rate = (total_no_shows / total_bookings * 100) if total_bookings > 0 else 0.0
            
            return {
                'staff_metrics': staff_metrics,
                'aggregate_metrics': {
                    'total_available_hours': round(total_available_hours, 2),
                    'total_booked_hours': round(total_booked_hours, 2),
                    'overall_utilization_percentage': round(overall_utilization, 2),
                    'total_bookings': total_bookings,
                    'total_cancellations': total_cancellations,
                    'overall_cancellation_rate': round(overall_cancellation_rate, 2),
                    'total_no_shows': total_no_shows,
                    'overall_no_show_rate': round(overall_no_show_rate, 2)
                }
            }
            
        except Exception as e:
            raise Exception(f"Failed to get staff metrics: {str(e)}")
    
    def _group_by_period(self, query, date_column, metric_column, period: AnalyticsPeriod) -> List[Dict[str, Any]]:
        """Group query results by time period."""
        try:
            if period == AnalyticsPeriod.HOURLY:
                group_by = func.date_trunc('hour', date_column)
            elif period == AnalyticsPeriod.DAILY:
                group_by = func.date_trunc('day', date_column)
            elif period == AnalyticsPeriod.WEEKLY:
                group_by = func.date_trunc('week', date_column)
            elif period == AnalyticsPeriod.MONTHLY:
                group_by = func.date_trunc('month', date_column)
            elif period == AnalyticsPeriod.QUARTERLY:
                group_by = func.date_trunc('quarter', date_column)
            elif period == AnalyticsPeriod.YEARLY:
                group_by = func.date_trunc('year', date_column)
            else:
                group_by = func.date_trunc('day', date_column)
            
            results = query.with_entities(
                group_by.label('period'),
                metric_column.label('value')
            ).group_by(group_by).order_by(group_by).all()
            
            return [
                {
                    'period': result.period.isoformat() if result.period else None,
                    'value': float(result.value) if result.value else 0
                }
                for result in results
            ]
            
        except Exception as e:
            return []
    
    def _get_previous_period_revenue(self, tenant_id: uuid.UUID, start_date: date, 
                                   end_date: date, period: AnalyticsPeriod) -> float:
        """Get revenue for the previous period."""
        try:
            period_days = self._get_period_days(period)
            prev_start = start_date - timedelta(days=period_days)
            prev_end = start_date - timedelta(days=1)
            
            revenue = Payment.query.filter(
                and_(
                    Payment.tenant_id == tenant_id,
                    Payment.created_at >= prev_start,
                    Payment.created_at <= prev_end,
                    Payment.status == 'captured'
                )
            ).with_entities(func.sum(Payment.amount_cents)).scalar() or 0
            
            return float(revenue)
            
        except Exception:
            return 0.0
    
    def _calculate_growth_rate(self, current: float, previous: float) -> float:
        """Calculate growth rate percentage."""
        if previous == 0:
            return 100.0 if current > 0 else 0.0
        return ((current - previous) / previous) * 100
    
    def _get_period_days(self, period: AnalyticsPeriod) -> int:
        """Get number of days for period."""
        period_days = {
            AnalyticsPeriod.HOURLY: 1,
            AnalyticsPeriod.DAILY: 1,
            AnalyticsPeriod.WEEKLY: 7,
            AnalyticsPeriod.MONTHLY: 30,
            AnalyticsPeriod.QUARTERLY: 90,
            AnalyticsPeriod.YEARLY: 365
        }
        return period_days.get(period, 1)


class PerformanceAnalyticsService:
    """Service for performance analytics."""
    
    def get_system_performance(self, tenant_id: uuid.UUID, start_date: date, 
                             end_date: date) -> Dict[str, Any]:
        """Get system performance metrics."""
        try:
            # API response times (simplified - in production, use actual metrics)
            avg_response_time = 150  # milliseconds
            p95_response_time = 300
            p99_response_time = 500
            
            # Database performance
            db_query_count = self._get_db_query_count(tenant_id, start_date, end_date)
            avg_query_time = 50  # milliseconds
            
            # Error rates
            error_rate = self._get_error_rate(tenant_id, start_date, end_date)
            
            # Uptime
            uptime_percentage = 99.9  # Simplified
            
            return {
                'api_performance': {
                    'avg_response_time_ms': avg_response_time,
                    'p95_response_time_ms': p95_response_time,
                    'p99_response_time_ms': p99_response_time
                },
                'database_performance': {
                    'query_count': db_query_count,
                    'avg_query_time_ms': avg_query_time
                },
                'reliability': {
                    'error_rate_percentage': error_rate,
                    'uptime_percentage': uptime_percentage
                }
            }
            
        except Exception as e:
            raise Exception(f"Failed to get system performance: {str(e)}")
    
    def get_booking_performance(self, tenant_id: uuid.UUID, start_date: date, 
                              end_date: date) -> Dict[str, Any]:
        """Get booking system performance metrics."""
        try:
            # Booking processing time
            avg_booking_time = 2.5  # seconds
            
            # Availability calculation time
            avg_availability_time = 0.8  # seconds
            
            # Payment processing time
            avg_payment_time = 3.2  # seconds
            
            # Success rates
            booking_success_rate = 98.5
            payment_success_rate = 97.8
            
            return {
                'processing_times': {
                    'avg_booking_time_seconds': avg_booking_time,
                    'avg_availability_time_seconds': avg_availability_time,
                    'avg_payment_time_seconds': avg_payment_time
                },
                'success_rates': {
                    'booking_success_rate_percentage': booking_success_rate,
                    'payment_success_rate_percentage': payment_success_rate
                }
            }
            
        except Exception as e:
            raise Exception(f"Failed to get booking performance: {str(e)}")
    
    def _get_db_query_count(self, tenant_id: uuid.UUID, start_date: date, end_date: date) -> int:
        """Get database query count (simplified)."""
        # In production, this would query actual query logs
        return 1000
    
    def _get_error_rate(self, tenant_id: uuid.UUID, start_date: date, end_date: date) -> float:
        """Get error rate percentage (simplified)."""
        # In production, this would query error logs
        return 0.1


class CustomReportService:
    """Service for custom analytics reports."""
    
    def create_custom_report(self, tenant_id: uuid.UUID, report_config: Dict[str, Any]) -> AnalyticsReport:
        """Create a custom analytics report."""
        try:
            report_id = str(uuid.uuid4())
            title = report_config.get('title', 'Custom Report')
            period = AnalyticsPeriod(report_config.get('period', 'daily'))
            start_date = datetime.fromisoformat(report_config['start_date']).date()
            end_date = datetime.fromisoformat(report_config['end_date']).date()
            
            # Get metrics based on configuration
            metrics = {}
            business_service = BusinessMetricsService()
            performance_service = PerformanceAnalyticsService()
            
            if report_config.get('include_revenue', False):
                metrics['revenue'] = business_service.get_revenue_metrics(
                    tenant_id, start_date, end_date, period
                )
            
            if report_config.get('include_bookings', False):
                metrics['bookings'] = business_service.get_booking_metrics(
                    tenant_id, start_date, end_date, period
                )
            
            if report_config.get('include_customers', False):
                metrics['customers'] = business_service.get_customer_metrics(
                    tenant_id, start_date, end_date
                )
            
            if report_config.get('include_staff', False):
                metrics['staff'] = business_service.get_staff_metrics(
                    tenant_id, start_date, end_date
                )
            
            if report_config.get('include_performance', False):
                metrics['performance'] = performance_service.get_system_performance(
                    tenant_id, start_date, end_date
                )
            
            # Generate summary
            summary = self._generate_report_summary(metrics)
            
            return AnalyticsReport(
                report_id=report_id,
                title=title,
                period=period,
                start_date=start_date,
                end_date=end_date,
                metrics=metrics,
                summary=summary,
                generated_at=datetime.utcnow()
            )
            
        except Exception as e:
            raise Exception(f"Failed to create custom report: {str(e)}")
    
    def _generate_report_summary(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Generate report summary."""
        summary = {
            'total_metrics': len(metrics),
            'key_insights': [],
            'recommendations': []
        }
        
        # Add key insights based on metrics
        if 'revenue' in metrics:
            revenue_data = metrics['revenue']
            if revenue_data.get('revenue_growth', 0) > 0:
                summary['key_insights'].append(
                    f"Revenue grew by {revenue_data['revenue_growth']:.1f}%"
                )
        
        if 'bookings' in metrics:
            booking_data = metrics['bookings']
            if booking_data.get('conversion_rate', 0) > 80:
                summary['key_insights'].append(
                    f"High conversion rate: {booking_data['conversion_rate']:.1f}%"
                )
        
        # Add recommendations
        if 'bookings' in metrics:
            booking_data = metrics['bookings']
            if booking_data.get('no_show_rate', 0) > 10:
                summary['recommendations'].append(
                    "Consider implementing reminder notifications to reduce no-show rate"
                )
        
        return summary


class AnalyticsService:
    """Main analytics service orchestrating all analytics functionality."""
    
    def __init__(self):
        self.business_service = BusinessMetricsService()
        self.performance_service = PerformanceAnalyticsService()
        self.report_service = CustomReportService()
    
    def get_dashboard_metrics(self, tenant_id: uuid.UUID, start_date: date, 
                            end_date: date) -> Dict[str, Any]:
        """Get comprehensive dashboard metrics."""
        try:
            return {
                'revenue': self.business_service.get_revenue_metrics(tenant_id, start_date, end_date),
                'bookings': self.business_service.get_booking_metrics(tenant_id, start_date, end_date),
                'customers': self.business_service.get_customer_metrics(tenant_id, start_date, end_date),
                'staff': self.business_service.get_staff_metrics(tenant_id, start_date, end_date),
                'performance': self.performance_service.get_system_performance(tenant_id, start_date, end_date)
            }
        except Exception as e:
            raise Exception(f"Failed to get dashboard metrics: {str(e)}")
    
    def create_custom_report(self, tenant_id: uuid.UUID, report_config: Dict[str, Any]) -> AnalyticsReport:
        """Create a custom analytics report."""
        return self.report_service.create_custom_report(tenant_id, report_config)
    
    def get_admin_dashboard_data(self, tenant_id: uuid.UUID, start_date: date, 
                                end_date: date) -> Dict[str, Any]:
        """Get admin dashboard data."""
        try:
            # Rollback any existing failed transaction
            db.session.rollback()
            
            return {
                'revenue': self.business_service.get_revenue_metrics(tenant_id, start_date, end_date),
                'bookings': self.business_service.get_booking_metrics(tenant_id, start_date, end_date),
                'customers': self.business_service.get_customer_metrics(tenant_id, start_date, end_date),
                'staff': self.business_service.get_staff_metrics(tenant_id, start_date, end_date),
                'performance': self.performance_service.get_system_performance(tenant_id, start_date, end_date)
            }
        except Exception as e:
            # Rollback on error
            db.session.rollback()
            raise Exception(f"Failed to get admin dashboard data: {str(e)}")
    
    def export_analytics_data(self, tenant_id: uuid.UUID, start_date: date, 
                            end_date: date, format: str = 'json') -> str:
        """Export analytics data in specified format."""
        try:
            metrics = self.get_dashboard_metrics(tenant_id, start_date, end_date)
            
            if format.lower() == 'json':
                return json.dumps(metrics, default=str, indent=2)
            elif format.lower() == 'csv':
                # Convert to CSV format (simplified)
                return self._convert_to_csv(metrics)
            else:
                raise Exception(f"Unsupported export format: {format}")
                
        except Exception as e:
            raise Exception(f"Failed to export analytics data: {str(e)}")
    
    def _convert_to_csv(self, metrics: Dict[str, Any]) -> str:
        """Convert metrics to CSV format (simplified)."""
        # This is a simplified implementation
        # In production, use a proper CSV library
        csv_lines = []
        csv_lines.append("Metric,Value")
        
        for category, data in metrics.items():
            if isinstance(data, dict):
                for key, value in data.items():
                    csv_lines.append(f"{category}_{key},{value}")
        
        return "\n".join(csv_lines)
