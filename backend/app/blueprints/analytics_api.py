"""
Analytics API Blueprint

This blueprint provides comprehensive analytics and reporting endpoints
including business metrics, performance analytics, and custom reporting.
"""

from flask import Blueprint, jsonify, request, g, Response
from flask_smorest import Api, abort
import uuid
import json
from datetime import datetime, timedelta, date

from ..middleware.error_handler import TithiError
from ..middleware.auth_middleware import require_auth, require_tenant, get_current_user
from ..services.analytics_service import (
    AnalyticsService, AnalyticsPeriod, AnalyticsReport
)


analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.route("/dashboard", methods=["GET"])
@require_auth
@require_tenant
def get_dashboard_metrics():
    """Get comprehensive dashboard metrics."""
    try:
        # Get date range
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        if not start_date_str or not end_date_str:
            # Default to last 30 days
            end_date = date.today()
            start_date = end_date - timedelta(days=30)
        else:
            start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00')).date()
            end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00')).date()
        
        tenant_id = g.tenant_id
        analytics_service = AnalyticsService()
        
        metrics = analytics_service.get_dashboard_metrics(tenant_id, start_date, end_date)
        
        return jsonify({
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "metrics": metrics
        }), 200
        
    except ValueError as e:
        raise TithiError(
            message="Invalid date format",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except Exception as e:
        raise TithiError(
            message="Failed to get dashboard metrics",
            code="TITHI_ANALYTICS_DASHBOARD_ERROR"
        )


@analytics_bp.route("/revenue", methods=["GET"])
@require_auth
@require_tenant
def get_revenue_analytics():
    """Get revenue analytics and metrics."""
    try:
        # Get parameters
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        period = request.args.get('period', 'daily')
        
        if not start_date_str or not end_date_str:
            raise TithiError(
                message="start_date and end_date are required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        # Validate period
        try:
            analytics_period = AnalyticsPeriod(period)
        except ValueError:
            raise TithiError(
                message="Invalid period. Must be one of: hourly, daily, weekly, monthly, quarterly, yearly",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00')).date()
        end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00')).date()
        
        tenant_id = g.tenant_id
        analytics_service = AnalyticsService()
        
        revenue_metrics = analytics_service.business_service.get_revenue_metrics(
            tenant_id, start_date, end_date, analytics_period
        )
        
        return jsonify({
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "granularity": period
            },
            "revenue_metrics": revenue_metrics
        }), 200
        
    except ValueError as e:
        raise TithiError(
            message="Invalid date format",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to get revenue analytics",
            code="TITHI_ANALYTICS_REVENUE_ERROR"
        )


@analytics_bp.route("/bookings", methods=["GET"])
@require_auth
@require_tenant
def get_booking_analytics():
    """Get booking analytics and metrics."""
    try:
        # Get parameters
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        period = request.args.get('period', 'daily')
        
        if not start_date_str or not end_date_str:
            raise TithiError(
                message="start_date and end_date are required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        # Validate period
        try:
            analytics_period = AnalyticsPeriod(period)
        except ValueError:
            raise TithiError(
                message="Invalid period. Must be one of: hourly, daily, weekly, monthly, quarterly, yearly",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00')).date()
        end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00')).date()
        
        tenant_id = g.tenant_id
        analytics_service = AnalyticsService()
        
        booking_metrics = analytics_service.business_service.get_booking_metrics(
            tenant_id, start_date, end_date, analytics_period
        )
        
        return jsonify({
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "granularity": period
            },
            "booking_metrics": booking_metrics
        }), 200
        
    except ValueError as e:
        raise TithiError(
            message="Invalid date format",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to get booking analytics",
            code="TITHI_ANALYTICS_BOOKING_ERROR"
        )


@analytics_bp.route("/customers", methods=["GET"])
@require_auth
@require_tenant
def get_customer_analytics():
    """Get customer analytics and metrics."""
    try:
        # Get parameters
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        if not start_date_str or not end_date_str:
            raise TithiError(
                message="start_date and end_date are required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00')).date()
        end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00')).date()
        
        tenant_id = g.tenant_id
        analytics_service = AnalyticsService()
        
        customer_metrics = analytics_service.business_service.get_customer_metrics(
            tenant_id, start_date, end_date
        )
        
        return jsonify({
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "customer_metrics": customer_metrics
        }), 200
        
    except ValueError as e:
        raise TithiError(
            message="Invalid date format",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to get customer analytics",
            code="TITHI_ANALYTICS_CUSTOMER_ERROR"
        )


@analytics_bp.route("/staff", methods=["GET"])
@require_auth
@require_tenant
def get_staff_analytics():
    """Get staff performance analytics."""
    try:
        # Get parameters
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        if not start_date_str or not end_date_str:
            raise TithiError(
                message="start_date and end_date are required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00')).date()
        end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00')).date()
        
        tenant_id = g.tenant_id
        analytics_service = AnalyticsService()
        
        staff_metrics = analytics_service.business_service.get_staff_metrics(
            tenant_id, start_date, end_date
        )
        
        return jsonify({
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "staff_metrics": staff_metrics
        }), 200
        
    except ValueError as e:
        raise TithiError(
            message="Invalid date format",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to get staff analytics",
            code="TITHI_ANALYTICS_STAFF_ERROR"
        )


@analytics_bp.route("/performance", methods=["GET"])
@require_auth
@require_tenant
def get_performance_analytics():
    """Get system performance analytics."""
    try:
        # Get parameters
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        if not start_date_str or not end_date_str:
            raise TithiError(
                message="start_date and end_date are required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00')).date()
        end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00')).date()
        
        tenant_id = g.tenant_id
        analytics_service = AnalyticsService()
        
        performance_metrics = analytics_service.performance_service.get_system_performance(
            tenant_id, start_date, end_date
        )
        
        return jsonify({
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "performance_metrics": performance_metrics
        }), 200
        
    except ValueError as e:
        raise TithiError(
            message="Invalid date format",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to get performance analytics",
            code="TITHI_ANALYTICS_PERFORMANCE_ERROR"
        )


@analytics_bp.route("/reports", methods=["POST"])
@require_auth
@require_tenant
def create_custom_report():
    """Create a custom analytics report."""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['title', 'start_date', 'end_date']
        for field in required_fields:
            if field not in data:
                raise TithiError(
                    message=f"Missing required field: {field}",
                    code="TITHI_VALIDATION_ERROR",
                    status_code=400
                )
        
        # Validate period
        period = data.get('period', 'daily')
        try:
            analytics_period = AnalyticsPeriod(period)
        except ValueError:
            raise TithiError(
                message="Invalid period. Must be one of: hourly, daily, weekly, monthly, quarterly, yearly",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        # Validate dates
        start_date = datetime.fromisoformat(data['start_date'].replace('Z', '+00:00')).date()
        end_date = datetime.fromisoformat(data['end_date'].replace('Z', '+00:00')).date()
        
        if start_date >= end_date:
            raise TithiError(
                message="start_date must be before end_date",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        tenant_id = g.tenant_id
        analytics_service = AnalyticsService()
        
        # Create report configuration
        report_config = {
            'title': data['title'],
            'period': period,
            'start_date': data['start_date'],
            'end_date': data['end_date'],
            'include_revenue': data.get('include_revenue', True),
            'include_bookings': data.get('include_bookings', True),
            'include_customers': data.get('include_customers', True),
            'include_staff': data.get('include_staff', True),
            'include_performance': data.get('include_performance', False)
        }
        
        report = analytics_service.create_custom_report(tenant_id, report_config)
        
        return jsonify({
            "report_id": report.report_id,
            "title": report.title,
            "period": report.period.value,
            "start_date": report.start_date.isoformat(),
            "end_date": report.end_date.isoformat(),
            "generated_at": report.generated_at.isoformat() + "Z",
            "summary": report.summary,
            "metrics": report.metrics
        }), 201
        
    except ValueError as e:
        raise TithiError(
            message="Invalid data format",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to create custom report",
            code="TITHI_ANALYTICS_REPORT_ERROR"
        )


@analytics_bp.route("/export", methods=["GET"])
@require_auth
@require_tenant
def export_analytics_data():
    """Export analytics data in specified format."""
    try:
        # Get parameters
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        format = request.args.get('format', 'json')
        
        if not start_date_str or not end_date_str:
            raise TithiError(
                message="start_date and end_date are required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        # Validate format
        if format not in ['json', 'csv']:
            raise TithiError(
                message="Invalid format. Must be 'json' or 'csv'",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00')).date()
        end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00')).date()
        
        tenant_id = g.tenant_id
        analytics_service = AnalyticsService()
        
        # Export data
        exported_data = analytics_service.export_analytics_data(
            tenant_id, start_date, end_date, format
        )
        
        # Set appropriate content type
        content_type = 'application/json' if format == 'json' else 'text/csv'
        filename = f"analytics_{start_date}_{end_date}.{format}"
        
        return Response(
            exported_data,
            mimetype=content_type,
            headers={
                'Content-Disposition': f'attachment; filename={filename}'
            }
        )
        
    except ValueError as e:
        raise TithiError(
            message="Invalid date format",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except TithiError:
        raise
    except Exception as e:
        raise TithiError(
            message="Failed to export analytics data",
            code="TITHI_ANALYTICS_EXPORT_ERROR"
        )


@analytics_bp.route("/periods", methods=["GET"])
@require_auth
@require_tenant
def list_analytics_periods():
    """List available analytics periods."""
    try:
        periods = [
            {"value": period.value, "label": period.value.title()}
            for period in AnalyticsPeriod
        ]
        
        return jsonify({
            "periods": periods,
            "total": len(periods)
        }), 200
        
    except Exception as e:
        raise TithiError(
            message="Failed to list analytics periods",
            code="TITHI_ANALYTICS_PERIODS_ERROR"
        )


@analytics_bp.route("/kpis", methods=["GET"])
@require_auth
@require_tenant
def get_key_performance_indicators():
    """Get key performance indicators for the tenant."""
    try:
        # Get parameters
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        if not start_date_str or not end_date_str:
            # Default to last 30 days
            end_date = date.today()
            start_date = end_date - timedelta(days=30)
        else:
            start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00')).date()
            end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00')).date()
        
        tenant_id = g.tenant_id
        analytics_service = AnalyticsService()
        
        # Get key metrics
        revenue_metrics = analytics_service.business_service.get_revenue_metrics(
            tenant_id, start_date, end_date
        )
        booking_metrics = analytics_service.business_service.get_booking_metrics(
            tenant_id, start_date, end_date
        )
        customer_metrics = analytics_service.business_service.get_customer_metrics(
            tenant_id, start_date, end_date
        )
        
        # Calculate KPIs
        kpis = {
            "revenue": {
                "total_revenue": revenue_metrics.get('total_revenue', 0),
                "revenue_growth": revenue_metrics.get('revenue_growth', 0),
                "average_booking_value": revenue_metrics.get('average_booking_value', 0)
            },
            "bookings": {
                "total_bookings": booking_metrics.get('total_bookings', 0),
                "conversion_rate": booking_metrics.get('conversion_rate', 0),
                "no_show_rate": booking_metrics.get('no_show_rate', 0),
                "cancellation_rate": booking_metrics.get('cancellation_rate', 0)
            },
            "customers": {
                "total_customers": customer_metrics.get('total_customers', 0),
                "new_customers": customer_metrics.get('new_customers', 0),
                "repeat_customers": customer_metrics.get('repeat_customers', 0),
                "customer_lifetime_value": customer_metrics.get('customer_lifetime_value', 0)
            }
        }
        
        return jsonify({
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "kpis": kpis
        }), 200
        
    except ValueError as e:
        raise TithiError(
            message="Invalid date format",
            code="TITHI_VALIDATION_ERROR",
            status_code=400
        )
    except Exception as e:
        raise TithiError(
            message="Failed to get key performance indicators",
            code="TITHI_ANALYTICS_KPIS_ERROR"
        )
