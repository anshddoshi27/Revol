"""
CRM API Blueprint (Module K - CRM & Customer Management)

This blueprint provides comprehensive customer relationship management endpoints
following the design brief Module K specifications.

Design Brief Module K Endpoints:
- POST /v1/tenants/{tenantId}/customers — create/lookup
- GET /v1/tenants/{tenantId}/customers/{id}/history
- POST /v1/tenants/{tenantId}/customers/merge

Additional CRM Features:
- Customer segmentation
- Loyalty program management
- Customer notes and interactions
- GDPR compliance (export/delete)
- Deduplication heuristics

Features:
- Automatic customer creation at first booking
- Email/phone fuzzy matching for deduplication
- Opt-in management for marketing messages (GDPR)
- Loyalty points accrual & redemption
- Customer segmentation and analytics
- Structured error handling with Tithi error codes
- RLS enforcement for tenant isolation
- Audit logging for all customer operations
"""

from flask import Blueprint, jsonify, request, g
from flask_smorest import Api, abort
import uuid
import json
import logging
from datetime import datetime, timedelta, date
from typing import Dict, Any, Optional, List
from difflib import SequenceMatcher

from ..middleware.error_handler import TithiError
from ..middleware.auth_middleware import require_auth, require_tenant, get_current_user
from ..services.business_phase2 import CustomerService
from ..extensions import db
from ..models.business import Customer, CustomerMetrics, Booking
from ..models.core import Tenant

# Configure logging
logger = logging.getLogger(__name__)

crm_bp = Blueprint("crm", __name__)


def calculate_similarity(a: str, b: str) -> float:
    """Calculate similarity between two strings using SequenceMatcher."""
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


@crm_bp.route("/customers", methods=["GET"])
@require_auth
@require_tenant
def list_customers():
    """List customers with filtering and pagination."""
    try:
        tenant_id = g.tenant_id
        customer_service = CustomerService()
        
        # Get query parameters
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        search = request.args.get('search', '')
        segment = request.args.get('segment', '')
        is_first_time = request.args.get('is_first_time')
        marketing_opt_in = request.args.get('marketing_opt_in')
        
        # Build filters
        filters = {}
        if search:
            filters['search'] = search
        if segment:
            filters['segment'] = segment
        if is_first_time is not None:
            filters['is_first_time'] = is_first_time.lower() == 'true'
        if marketing_opt_in is not None:
            filters['marketing_opt_in'] = marketing_opt_in.lower() == 'true'
        
        # Get customers with pagination
        customers, total = customer_service.list_customers(
            tenant_id, page=page, per_page=per_page, filters=filters
        )
        
        # Format response
        customer_list = []
        for customer in customers:
            customer_data = {
                "id": str(customer.id),
                "display_name": customer.display_name,
                "email": customer.email,
                "phone": customer.phone,
                "marketing_opt_in": customer.marketing_opt_in,
                "is_first_time": customer.is_first_time,
                "first_booking_at": customer.customer_first_booking_at.isoformat() + "Z" if customer.customer_first_booking_at else None,
                "created_at": customer.created_at.isoformat() + "Z",
                "updated_at": customer.updated_at.isoformat() + "Z"
            }
            
            # Add customer metrics if available
            if hasattr(customer, 'metrics') and customer.metrics:
                customer_data["metrics"] = {
                    "total_bookings": customer.metrics.total_bookings_count,
                    "total_spend_cents": customer.metrics.total_spend_cents,
                    "last_booking_at": customer.metrics.last_booking_at.isoformat() + "Z" if customer.metrics.last_booking_at else None
                }
            
            customer_list.append(customer_data)
        
        return jsonify({
            "customers": customer_list,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": (total + per_page - 1) // per_page
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to list customers: {str(e)}")
        raise TithiError(
            message="Failed to list customers",
            code="TITHI_CRM_LIST_ERROR"
        )


@crm_bp.route("/customers", methods=["POST"])
@require_auth
@require_tenant
def create_customer():
    """Create customer with duplicate validation (Task 8.1)."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        customer_service = CustomerService()
        
        # Validate required fields (Task 8.1: Input: {name, email, phone})
        if not data.get('email') and not data.get('phone'):
            raise TithiError(
                message="Either email or phone is required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        # Create customer data (Task 8.1 requirements)
        customer_data = {
            'display_name': data.get('display_name', data.get('name', '')),
            'email': data.get('email'),
            'phone': data.get('phone'),
            'marketing_opt_in': data.get('marketing_opt_in', False),
            'notification_preferences': data.get('notification_preferences', {}),
            'is_first_time': True
        }
        
        # Create customer (will raise TITHI_CUSTOMER_DUPLICATE if duplicate email/phone)
        customer = customer_service.create_customer(tenant_id, customer_data)
        
        # Return customer_id as required by Task 8.1
        return jsonify({
            "customer_id": str(customer.id),
            "customer": {
                "id": str(customer.id),
                "display_name": customer.display_name,
                "email": customer.email,
                "phone": customer.phone,
                "marketing_opt_in": customer.marketing_opt_in,
                "is_first_time": customer.is_first_time,
                "created_at": customer.created_at.isoformat() + "Z",
                "updated_at": customer.updated_at.isoformat() + "Z"
            }
        }), 201
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to create customer: {str(e)}")
        raise TithiError(
            message="Failed to create customer",
            code="TITHI_CRM_CREATE_ERROR"
        )


@crm_bp.route("/customers/<customer_id>", methods=["GET"])
@require_auth
@require_tenant
def get_customer(customer_id: str):
    """Get customer profile with booking history (Task 8.1 requirement)."""
    try:
        tenant_id = g.tenant_id
        customer_service = CustomerService()
        
        # Get customer profile with history (Task 8.1: Testing: Profile retrieved with booking history)
        profile_data = customer_service.get_customer_profile_with_history(tenant_id, customer_id)
        if not profile_data:
            raise TithiError(
                message="Customer not found",
                code="TITHI_CRM_CUSTOMER_NOT_FOUND",
                status_code=404
            )
        
        return jsonify(profile_data), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to get customer: {str(e)}")
        raise TithiError(
            message="Failed to get customer",
            code="TITHI_CRM_GET_ERROR"
        )


@crm_bp.route("/customers/<customer_id>", methods=["PUT"])
@require_auth
@require_tenant
def update_customer(customer_id: str):
    """Update customer information."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        customer_service = CustomerService()
        
        # Get customer
        customer = customer_service.get_customer(tenant_id, customer_id)
        if not customer:
            raise TithiError(
                message="Customer not found",
                code="TITHI_CRM_CUSTOMER_NOT_FOUND",
                status_code=404
            )
        
        # Update customer
        update_data = {}
        if 'display_name' in data:
            update_data['display_name'] = data['display_name']
        if 'email' in data:
            update_data['email'] = data['email']
        if 'phone' in data:
            update_data['phone'] = data['phone']
        if 'marketing_opt_in' in data:
            update_data['marketing_opt_in'] = data['marketing_opt_in']
        if 'notification_preferences' in data:
            update_data['notification_preferences'] = data['notification_preferences']
        
        updated_customer = customer_service.update_customer(tenant_id, customer_id, update_data)
        
        # Log customer update
        logger.info(f"CUSTOMER_UPDATED: tenant_id={tenant_id}, customer_id={customer_id}")
        
        return jsonify({
            "customer": {
                "id": str(updated_customer.id),
                "display_name": updated_customer.display_name,
                "email": updated_customer.email,
                "phone": updated_customer.phone,
                "marketing_opt_in": updated_customer.marketing_opt_in,
                "is_first_time": updated_customer.is_first_time,
                "created_at": updated_customer.created_at.isoformat() + "Z",
                "updated_at": updated_customer.updated_at.isoformat() + "Z"
            }
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to update customer: {str(e)}")
        raise TithiError(
            message="Failed to update customer",
            code="TITHI_CRM_UPDATE_ERROR"
        )


@crm_bp.route("/customers/merge", methods=["POST"])
@require_auth
@require_tenant
def merge_customers():
    """Merge duplicate customers preserving history."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        customer_service = CustomerService()
        
        # Validate required fields
        if not data.get('primary_customer_id') or not data.get('duplicate_customer_id'):
            raise TithiError(
                message="primary_customer_id and duplicate_customer_id are required",
                code="TITHI_VALIDATION_ERROR",
                status_code=400
            )
        
        primary_id = data['primary_customer_id']
        duplicate_id = data['duplicate_customer_id']
        
        # Merge customers
        merged_customer = customer_service.merge_customers(tenant_id, primary_id, duplicate_id)
        
        # Log customer merge
        logger.info(f"CUSTOMER_MERGED: tenant_id={tenant_id}, primary_id={primary_id}, duplicate_id={duplicate_id}")
        
        return jsonify({
            "message": "Customers merged successfully",
            "primary_customer": {
                "id": str(merged_customer.id),
                "display_name": merged_customer.display_name,
                "email": merged_customer.email,
                "phone": merged_customer.phone
            }
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to merge customers: {str(e)}")
        raise TithiError(
            message="Failed to merge customers",
            code="TITHI_CRM_MERGE_ERROR"
        )


@crm_bp.route("/customers/duplicates", methods=["GET"])
@require_auth
@require_tenant
def find_duplicate_customers():
    """Find potential duplicate customers using fuzzy matching."""
    try:
        tenant_id = g.tenant_id
        customer_service = CustomerService()
        
        # Get all customers
        customers = customer_service.list_customers(tenant_id, page=1, per_page=1000)[0]
        
        # Find duplicates using fuzzy matching
        duplicates = []
        processed = set()
        
        for i, customer1 in enumerate(customers):
            if customer1.id in processed:
                continue
                
            customer_duplicates = [customer1]
            
            for j, customer2 in enumerate(customers[i+1:], i+1):
                if customer2.id in processed:
                    continue
                
                # Check for duplicates
                is_duplicate = False
                similarity_score = 0.0
                
                # Email similarity
                if customer1.email and customer2.email:
                    email_similarity = calculate_similarity(customer1.email, customer2.email)
                    if email_similarity > 0.8:
                        is_duplicate = True
                        similarity_score = max(similarity_score, email_similarity)
                
                # Phone similarity
                if customer1.phone and customer2.phone:
                    phone_similarity = calculate_similarity(customer1.phone, customer2.phone)
                    if phone_similarity > 0.8:
                        is_duplicate = True
                        similarity_score = max(similarity_score, phone_similarity)
                
                # Name similarity
                if customer1.display_name and customer2.display_name:
                    name_similarity = calculate_similarity(customer1.display_name, customer2.display_name)
                    if name_similarity > 0.9:
                        is_duplicate = True
                        similarity_score = max(similarity_score, name_similarity)
                
                if is_duplicate:
                    customer_duplicates.append(customer2)
                    processed.add(customer2.id)
            
            if len(customer_duplicates) > 1:
                duplicates.append({
                    "customers": [{
                        "id": str(c.id),
                        "display_name": c.display_name,
                        "email": c.email,
                        "phone": c.phone,
                        "created_at": c.created_at.isoformat() + "Z"
                    } for c in customer_duplicates],
                    "similarity_score": similarity_score
                })
                processed.add(customer1.id)
        
        return jsonify({
            "duplicates": duplicates,
            "total_groups": len(duplicates)
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to find duplicate customers: {str(e)}")
        raise TithiError(
            message="Failed to find duplicate customers",
            code="TITHI_CRM_DUPLICATES_ERROR"
        )


@crm_bp.route("/customers/<customer_id>/notes", methods=["GET"])
@require_auth
@require_tenant
def get_customer_notes(customer_id: str):
    """Get customer notes and interactions."""
    try:
        tenant_id = g.tenant_id
        customer_service = CustomerService()
        
        # Get customer notes
        notes = customer_service.get_customer_notes(tenant_id, customer_id)
        
        return jsonify({
            "notes": [{
                "id": str(note.id),
                "content": note.content,
                "created_by": str(note.created_by),
                "created_at": note.created_at.isoformat() + "Z"
            } for note in notes]
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to get customer notes: {str(e)}")
        raise TithiError(
            message="Failed to get customer notes",
            code="TITHI_CRM_NOTES_ERROR"
        )


@crm_bp.route("/customers/<customer_id>/notes", methods=["POST"])
@require_auth
@require_tenant
def add_customer_note(customer_id: str):
    """Add a note to customer record."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        current_user = get_current_user()
        customer_service = CustomerService()
        
        # Validate note content (Task 8.3: Validation: Empty notes rejected)
        content = data.get('content', '').strip()
        if not content:
            raise TithiError(
                message="Note content is required and cannot be empty",
                code="TITHI_NOTE_INVALID",
                status_code=422
            )
        
        # Add note
        note = customer_service.add_customer_note(
            tenant_id, customer_id, content, current_user.id
        )
        
        # Emit NOTE_ADDED observability hook (Task 8.3 requirement)
        logger.info(f"NOTE_ADDED: tenant_id={tenant_id}, customer_id={customer_id}, note_id={note['id']}, created_by={current_user.id}")
        
        return jsonify({
            "note_id": note['id'],  # Task 8.3: Output: note_id
            "note": {
                "id": note['id'],
                "content": note['content'],
                "created_by": note['created_by'],
                "created_at": note['created_at']
            }
        }), 201
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to add customer note: {str(e)}")
        raise TithiError(
            message="Failed to add customer note",
            code="TITHI_CRM_NOTE_ADD_ERROR"
        )


@crm_bp.route("/customers/segments", methods=["GET"])
@require_auth
@require_tenant
def get_customer_segments():
    """Get customer segments with dynamic filtering (Task 8.2)."""
    try:
        tenant_id = g.tenant_id
        customer_service = CustomerService()
        
        # Get query parameters for segmentation criteria
        criteria = {}
        
        # Frequency criteria
        min_bookings = request.args.get('min_bookings')
        max_bookings = request.args.get('max_bookings')
        if min_bookings:
            criteria['min_bookings'] = int(min_bookings)
        if max_bookings:
            criteria['max_bookings'] = int(max_bookings)
        
        # Recency criteria
        days_since_last_booking = request.args.get('days_since_last_booking')
        if days_since_last_booking:
            criteria['days_since_last_booking'] = int(days_since_last_booking)
        
        # Spend criteria
        min_spend_cents = request.args.get('min_spend_cents')
        max_spend_cents = request.args.get('max_spend_cents')
        if min_spend_cents:
            criteria['min_spend_cents'] = int(min_spend_cents)
        if max_spend_cents:
            criteria['max_spend_cents'] = int(max_spend_cents)
        
        # Customer status criteria
        is_first_time = request.args.get('is_first_time')
        if is_first_time is not None:
            criteria['is_first_time'] = is_first_time.lower() == 'true'
        
        marketing_opt_in = request.args.get('marketing_opt_in')
        if marketing_opt_in is not None:
            criteria['marketing_opt_in'] = marketing_opt_in.lower() == 'true'
        
        # Pagination
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        
        # Get segmented customers
        customers, total = customer_service.get_customers_by_segment(
            tenant_id, criteria, page=page, per_page=per_page
        )
        
        # Emit SEGMENT_CREATED observability hook (Task 8.2 requirement)
        customer_service._emit_event(tenant_id, "SEGMENT_CREATED", {
            "criteria": criteria,
            "customer_count": total,
            "page": page,
            "per_page": per_page
        })
        
        # Format response
        customer_list = []
        for customer in customers:
            customer_data = {
                "id": str(customer.id),
                "display_name": customer.display_name,
                "email": customer.email,
                "phone": customer.phone,
                "marketing_opt_in": customer.marketing_opt_in,
                "is_first_time": customer.is_first_time,
                "first_booking_at": customer.customer_first_booking_at.isoformat() + "Z" if customer.customer_first_booking_at else None,
                "created_at": customer.created_at.isoformat() + "Z",
                "updated_at": customer.updated_at.isoformat() + "Z"
            }
            
            # Add customer metrics if available
            if hasattr(customer, 'metrics') and customer.metrics:
                customer_data["metrics"] = {
                    "total_bookings": customer.metrics.total_bookings_count,
                    "total_spend_cents": customer.metrics.total_spend_cents,
                    "last_booking_at": customer.metrics.last_booking_at.isoformat() + "Z" if customer.metrics.last_booking_at else None
                }
            
            customer_list.append(customer_data)
        
        return jsonify({
            "customers": customer_list,
            "criteria": criteria,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": (total + per_page - 1) // per_page
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to get customer segments: {str(e)}")
        raise TithiError(
            message="Failed to get customer segments",
            code="TITHI_CRM_SEGMENTS_ERROR"
        )


@crm_bp.route("/customers/segments", methods=["POST"])
@require_auth
@require_tenant
def create_customer_segment():
    """Create a customer segment with criteria (Task 8.2)."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        customer_service = CustomerService()
        
        # Validate required fields
        if not data.get('criteria'):
            raise TithiError(
                message="Segment criteria are required",
                code="TITHI_SEGMENT_INVALID_CRITERIA",
                status_code=422
            )
        
        criteria = data['criteria']
        
        # Validate criteria format (Task 8.2: Error Model Enforcement)
        if not isinstance(criteria, dict):
            raise TithiError(
                message="Criteria must be a valid object",
                code="TITHI_SEGMENT_INVALID_CRITERIA",
                status_code=422
            )
        
        # Validate criteria values
        valid_criteria = ['min_bookings', 'max_bookings', 'days_since_last_booking', 
                         'min_spend_cents', 'max_spend_cents', 'is_first_time', 'marketing_opt_in']
        
        for key, value in criteria.items():
            if key not in valid_criteria:
                raise TithiError(
                    message=f"Invalid criteria key: {key}",
                    code="TITHI_SEGMENT_INVALID_CRITERIA",
                    status_code=422
                )
            
            # Validate numeric criteria
            if key in ['min_bookings', 'max_bookings', 'days_since_last_booking', 'min_spend_cents', 'max_spend_cents']:
                if not isinstance(value, int) or value < 0:
                    raise TithiError(
                        message=f"Invalid value for {key}: must be a non-negative integer",
                        code="TITHI_SEGMENT_INVALID_CRITERIA",
                        status_code=422
                    )
            
            # Validate boolean criteria
            if key in ['is_first_time', 'marketing_opt_in']:
                if not isinstance(value, bool):
                    raise TithiError(
                        message=f"Invalid value for {key}: must be a boolean",
                        code="TITHI_SEGMENT_INVALID_CRITERIA",
                        status_code=422
                    )
        
        # Get pagination parameters
        page = int(data.get('page', 1))
        per_page = int(data.get('per_page', 20))
        
        # Get segmented customers
        customers, total = customer_service.get_customers_by_segment(
            tenant_id, criteria, page=page, per_page=per_page
        )
        
        # Emit SEGMENT_CREATED observability hook (Task 8.2 requirement)
        customer_service._emit_event(tenant_id, "SEGMENT_CREATED", {
            "criteria": criteria,
            "customer_count": total,
            "page": page,
            "per_page": per_page
        })
        
        # Format response
        customer_list = []
        for customer in customers:
            customer_data = {
                "id": str(customer.id),
                "display_name": customer.display_name,
                "email": customer.email,
                "phone": customer.phone,
                "marketing_opt_in": customer.marketing_opt_in,
                "is_first_time": customer.is_first_time,
                "first_booking_at": customer.customer_first_booking_at.isoformat() + "Z" if customer.customer_first_booking_at else None,
                "created_at": customer.created_at.isoformat() + "Z",
                "updated_at": customer.updated_at.isoformat() + "Z"
            }
            
            # Add customer metrics if available
            if hasattr(customer, 'metrics') and customer.metrics:
                customer_data["metrics"] = {
                    "total_bookings": customer.metrics.total_bookings_count,
                    "total_spend_cents": customer.metrics.total_spend_cents,
                    "last_booking_at": customer.metrics.last_booking_at.isoformat() + "Z" if customer.metrics.last_booking_at else None
                }
            
            customer_list.append(customer_data)
        
        return jsonify({
            "customers": customer_list,
            "criteria": criteria,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": (total + per_page - 1) // per_page
            }
        }), 200
        
    except TithiError:
        raise
    except Exception as e:
        logger.error(f"Failed to create customer segment: {str(e)}")
        raise TithiError(
            message="Failed to create customer segment",
            code="TITHI_CRM_SEGMENT_CREATE_ERROR"
        )


@crm_bp.route("/customers/export", methods=["POST"])
@require_auth
@require_tenant
def export_customer_data():
    """Export customer data for GDPR compliance."""
    try:
        data = request.get_json()
        tenant_id = g.tenant_id
        customer_service = CustomerService()
        
        # Get export parameters
        customer_ids = data.get('customer_ids', [])
        format = data.get('format', 'json')
        
        # Export data
        export_data = customer_service.export_customer_data(tenant_id, customer_ids, format)
        
        return jsonify({
            "export_data": export_data,
            "format": format,
            "exported_at": datetime.utcnow().isoformat() + "Z"
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to export customer data: {str(e)}")
        raise TithiError(
            message="Failed to export customer data",
            code="TITHI_CRM_EXPORT_ERROR"
        )


@crm_bp.route("/customers/<customer_id>/delete", methods=["DELETE"])
@require_auth
@require_tenant
def delete_customer_data():
    """Delete customer data for GDPR compliance."""
    try:
        customer_id = request.view_args['customer_id']
        tenant_id = g.tenant_id
        customer_service = CustomerService()
        
        # Delete customer data
        customer_service.delete_customer_data(tenant_id, customer_id)
        
        # Log GDPR deletion
        logger.info(f"GDPR_DELETE: tenant_id={tenant_id}, customer_id={customer_id}")
        
        return jsonify({
            "message": "Customer data deleted successfully",
            "deleted_at": datetime.utcnow().isoformat() + "Z"
        }), 200
        
    except Exception as e:
        logger.error(f"Failed to delete customer data: {str(e)}")
        raise TithiError(
            message="Failed to delete customer data",
            code="TITHI_CRM_DELETE_ERROR"
        )
