"""
Analytics API Blueprint

This blueprint provides comprehensive API endpoints for business analytics,
reporting, and performance tracking across all business metrics.
"""

from flask import Blueprint, jsonify, request, g
from flask_smorest import Api, abort
import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, Any

from ..middleware.error_handler import TithiError
from ..middleware.auth_middleware import require_auth, require_tenant, get_current_user
from ..services.analytics_service import AnalyticsService
from ..extensions import db

logger = logging.getLogger(__name__)

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.route("/analytics/dashboard", methods=["GET"])
@require_auth
@require_tenant
def get_dashboard_overview():
    """
    Get comprehensive dashboard overview with key metrics.
    
    Query Parameters:
        - start_date: Start date for analytics (ISO format, default: 30 days ago)
        - end_date: End date for analytics (ISO format, default: today)
    
    Returns:
        Dashboard overview with:
        - revenue: Revenue metrics and trends
        - bookings: Booking metrics and conversion rates
        - customers: Customer metrics and retention
        - staff: Staff performance metrics
        - services: Service performance metrics
    """
    try:
        # Get date range from query parameters
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)  # Default to last 30 days
        
        if 'start_date' in request.args:
            start_date = datetime.fromisoformat(request.args['start_date'])
        if 'end_date' in request.args:
            end_date = datetime.fromisoformat(request.args['end_date'])
        
        analytics_service = AnalyticsService()
        data = analytics_service.get_dashboard_overview(
            tenant_id=g.tenant_id,
            date_range={
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat()
            }
        )
        
        return jsonify({
            "success": True,
            "data": data
        }), 200
        
    except TithiError as e:
        return jsonify({
            "success": False,
            "error": {
                "message": e.message,
                "code": e.code
            }
        }), e.status_code
    except Exception as e:
        logger.error(f"Failed to get dashboard overview: {str(e)}")
        return jsonify({
            "success": False,
            "error": {
                "message": "Internal server error",
                "code": "TITHI_INTERNAL_ERROR"
            }
        }), 500


@analytics_bp.route("/analytics/revenue", methods=["GET"])
@require_auth
@require_tenant
def get_revenue_analytics():
    """
    Get comprehensive revenue analytics.
    
    Query Parameters:
        - start_date: Start date for analytics (ISO format, default: 30 days ago)
        - end_date: End date for analytics (ISO format, default: today)
    
    Returns:
        Revenue analytics including:
        - total_revenue_cents: Total revenue in cents
        - revenue_by_payment_method: Revenue breakdown by payment method
        - revenue_by_service: Revenue breakdown by service
        - revenue_by_staff: Revenue breakdown by staff member
        - daily_revenue_trend: Daily revenue trend data
    """
    try:
        # Get date range from query parameters
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)  # Default to last 30 days
        
        if 'start_date' in request.args:
            start_date = datetime.fromisoformat(request.args['start_date'])
        if 'end_date' in request.args:
            end_date = datetime.fromisoformat(request.args['end_date'])
        
        analytics_service = AnalyticsService()
        data = analytics_service.get_revenue_analytics(
            tenant_id=g.tenant_id,
            date_range={
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat()
            }
        )
        
        return jsonify({
            "success": True,
            "data": data
        }), 200
        
    except TithiError as e:
        return jsonify({
            "success": False,
            "error": {
                "message": e.message,
                "code": e.code
            }
        }), e.status_code
    except Exception as e:
        logger.error(f"Failed to get revenue analytics: {str(e)}")
        return jsonify({
            "success": False,
            "error": {
                "message": "Internal server error",
                "code": "TITHI_INTERNAL_ERROR"
            }
        }), 500


@analytics_bp.route("/analytics/customers", methods=["GET"])
@require_auth
@require_tenant
def get_customer_analytics():
    """
    Get comprehensive customer analytics.
    
    Query Parameters:
        - start_date: Start date for analytics (ISO format, default: 30 days ago)
        - end_date: End date for analytics (ISO format, default: today)
    
    Returns:
        Customer analytics including:
        - new_customers: Number of new customers
        - returning_customers: Number of returning customers
        - customer_lifetime_value_cents: Average customer lifetime value
        - retention_rate_percent: Customer retention rate
        - top_customers: Top customers by revenue
    """
    try:
        # Get date range from query parameters
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)  # Default to last 30 days
        
        if 'start_date' in request.args:
            start_date = datetime.fromisoformat(request.args['start_date'])
        if 'end_date' in request.args:
            end_date = datetime.fromisoformat(request.args['end_date'])
        
        analytics_service = AnalyticsService()
        data = analytics_service.get_customer_analytics(
            tenant_id=g.tenant_id,
            date_range={
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat()
            }
        )
        
        return jsonify({
            "success": True,
            "data": data
        }), 200
        
    except TithiError as e:
        return jsonify({
            "success": False,
            "error": {
                "message": e.message,
                "code": e.code
            }
        }), e.status_code
    except Exception as e:
        logger.error(f"Failed to get customer analytics: {str(e)}")
        return jsonify({
            "success": False,
            "error": {
                "message": "Internal server error",
                "code": "TITHI_INTERNAL_ERROR"
            }
        }), 500


@analytics_bp.route("/analytics/bookings", methods=["GET"])
@require_auth
@require_tenant
def get_booking_analytics():
    """
    Get comprehensive booking analytics.
    
    Query Parameters:
        - start_date: Start date for analytics (ISO format, default: 30 days ago)
        - end_date: End date for analytics (ISO format, default: today)
    
    Returns:
        Booking analytics including:
        - total_bookings: Total number of bookings
        - booking_status_breakdown: Breakdown by booking status
        - cancellation_rate_percent: Booking cancellation rate
        - no_show_rate_percent: No-show rate
        - peak_booking_hours: Peak booking hours
    """
    try:
        # Get date range from query parameters
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)  # Default to last 30 days
        
        if 'start_date' in request.args:
            start_date = datetime.fromisoformat(request.args['start_date'])
        if 'end_date' in request.args:
            end_date = datetime.fromisoformat(request.args['end_date'])
        
        analytics_service = AnalyticsService()
        data = analytics_service.get_booking_analytics(
            tenant_id=g.tenant_id,
            date_range={
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat()
            }
        )
        
        return jsonify({
            "success": True,
            "data": data
        }), 200
        
    except TithiError as e:
        return jsonify({
            "success": False,
            "error": {
                "message": e.message,
                "code": e.code
            }
        }), e.status_code
    except Exception as e:
        logger.error(f"Failed to get booking analytics: {str(e)}")
        return jsonify({
            "success": False,
            "error": {
                "message": "Internal server error",
                "code": "TITHI_INTERNAL_ERROR"
            }
        }), 500


@analytics_bp.route("/analytics/staff", methods=["GET"])
@require_auth
@require_tenant
def get_staff_performance():
    """
    Get staff performance analytics.
    
    Query Parameters:
        - start_date: Start date for analytics (ISO format, default: 30 days ago)
        - end_date: End date for analytics (ISO format, default: today)
    
    Returns:
        Staff performance analytics including:
        - staff_performance: Individual staff performance metrics
        - staff_utilization: Staff utilization rates
    """
    try:
        # Get date range from query parameters
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)  # Default to last 30 days
        
        if 'start_date' in request.args:
            start_date = datetime.fromisoformat(request.args['start_date'])
        if 'end_date' in request.args:
            end_date = datetime.fromisoformat(request.args['end_date'])
        
        analytics_service = AnalyticsService()
        data = analytics_service.get_staff_performance(
            tenant_id=g.tenant_id,
            date_range={
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat()
            }
        )
        
        return jsonify({
            "success": True,
            "data": data
        }), 200
        
    except TithiError as e:
        return jsonify({
            "success": False,
            "error": {
                "message": e.message,
                "code": e.code
            }
        }), e.status_code
    except Exception as e:
        logger.error(f"Failed to get staff performance: {str(e)}")
        return jsonify({
            "success": False,
            "error": {
                "message": "Internal server error",
                "code": "TITHI_INTERNAL_ERROR"
            }
        }), 500


@analytics_bp.route("/analytics/events", methods=["POST"])
@require_auth
@require_tenant
def track_event():
    """
    Track a business event for analytics.
    
    Request Body:
        - event_type: Type of event (e.g., 'booking', 'customer', 'revenue')
        - event_name: Name of event (e.g., 'booking_created', 'customer_registered')
        - user_id: Optional user ID
        - customer_id: Optional customer ID
        - booking_id: Optional booking ID
        - service_id: Optional service ID
        - metadata: Additional event metadata
        - ip_address: Optional IP address
        - user_agent: Optional user agent
    
    Returns:
        Event tracking confirmation
    """
    try:
        data = request.get_json()
        
        if not data:
            raise TithiError(
                message="Request body is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        required_fields = ['event_type', 'event_name']
        for field in required_fields:
            if field not in data:
                raise TithiError(
                    message=f"Missing required field: {field}",
                    code="TITHI_VALIDATION_ERROR",
                    status_code=400
                )
        
        analytics_service = AnalyticsService()
        analytics_service.track_event(
            tenant_id=g.tenant_id,
            event_data=data
        )
        
        return jsonify({
            "success": True,
            "message": "Event tracked successfully"
        }), 200
        
    except TithiError as e:
        return jsonify({
            "success": False,
            "error": {
                "message": e.message,
                "code": e.code
            }
        }), e.status_code
    except Exception as e:
        logger.error(f"Failed to track event: {str(e)}")
        return jsonify({
            "success": False,
            "error": {
                "message": "Internal server error",
                "code": "TITHI_INTERNAL_ERROR"
            }
        }), 500


@analytics_bp.route("/analytics/export", methods=["GET"])
@require_auth
@require_tenant
def export_analytics():
    """
    Export analytics data in various formats.
    
    Query Parameters:
        - format: Export format (csv, json, xlsx)
        - data_type: Type of data to export (revenue, bookings, customers, staff)
        - start_date: Start date for export (ISO format)
        - end_date: End date for export (ISO format)
    
    Returns:
        Exported analytics data in requested format
    """
    try:
        export_format = request.args.get('format', 'json')
        data_type = request.args.get('data_type', 'all')
        
        # Get date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)
        
        if 'start_date' in request.args:
            start_date = datetime.fromisoformat(request.args['start_date'])
        if 'end_date' in request.args:
            end_date = datetime.fromisoformat(request.args['end_date'])
        
        analytics_service = AnalyticsService()
        
        # Get data based on type
        if data_type == 'revenue':
            data = analytics_service.get_revenue_analytics(
                tenant_id=g.tenant_id,
                date_range={
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat()
                }
            )
        elif data_type == 'bookings':
            data = analytics_service.get_booking_analytics(
                tenant_id=g.tenant_id,
                date_range={
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat()
                }
            )
        elif data_type == 'customers':
            data = analytics_service.get_customer_analytics(
                tenant_id=g.tenant_id,
                date_range={
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat()
                }
            )
        elif data_type == 'staff':
            data = analytics_service.get_staff_performance(
                tenant_id=g.tenant_id,
                date_range={
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat()
                }
            )
        else:  # all
            data = analytics_service.get_dashboard_overview(
                tenant_id=g.tenant_id,
                date_range={
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat()
                }
            )
        
        # For now, return JSON format
        # In a real implementation, you would generate CSV/Excel files
        return jsonify({
            "success": True,
            "data": data,
            "export_info": {
                "format": export_format,
                "data_type": data_type,
                "date_range": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat()
                },
                "exported_at": datetime.utcnow().isoformat()
            }
        }), 200
        
    except TithiError as e:
        return jsonify({
            "success": False,
            "error": {
                "message": e.message,
                "code": e.code
            }
        }), e.status_code
    except Exception as e:
        logger.error(f"Failed to export analytics: {str(e)}")
        return jsonify({
            "success": False,
            "error": {
                "message": "Internal server error",
                "code": "TITHI_INTERNAL_ERROR"
            }
        }), 500