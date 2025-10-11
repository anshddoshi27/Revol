"""
Idempotency Service for Tithi Backend

This service provides idempotency functionality for critical endpoints.

Phase: 11 - Cross-Cutting Utilities (Module N)
Task: 11.4 - Idempotency Keys
"""

import hashlib
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple
from flask import request, g

from ..extensions import db
from ..models.idempotency import IdempotencyKey

logger = logging.getLogger(__name__)


class IdempotencyService:
    """
    Service for managing idempotency keys and cached responses.
    
    This service provides:
    1. Idempotency key validation and lookup
    2. Response caching and retrieval
    3. Expiration management
    4. Statistics and monitoring
    """
    
    # Default expiration time for idempotency keys (24 hours)
    DEFAULT_EXPIRATION_HOURS = 24
    
    # Maximum key length
    MAX_KEY_LENGTH = 255
    
    @staticmethod
    def validate_idempotency_key(key: str) -> bool:
        """
        Validate idempotency key format.
        
        Args:
            key: The idempotency key to validate
            
        Returns:
            bool: True if valid, False otherwise
        """
        if not key or len(key) < 1 or len(key) > IdempotencyService.MAX_KEY_LENGTH:
            return False
        
        # Allow UUIDs, alphanumeric strings, and common patterns
        import re
        uuid_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        alphanumeric_pattern = r'^[a-zA-Z0-9_-]+$'
        
        return bool(re.match(uuid_pattern, key, re.IGNORECASE) or 
                   re.match(alphanumeric_pattern, key))
    
    @staticmethod
    def generate_key_hash(key: str) -> str:
        """
        Generate SHA-256 hash of idempotency key.
        
        Args:
            key: The idempotency key
            
        Returns:
            str: SHA-256 hash of the key
        """
        return hashlib.sha256(key.encode('utf-8')).hexdigest()
    
    @staticmethod
    def generate_request_hash(request_data: Any) -> str:
        """
        Generate SHA-256 hash of request data for validation.
        
        Args:
            request_data: The request data to hash
            
        Returns:
            str: SHA-256 hash of the request data
        """
        try:
            if isinstance(request_data, dict):
                data_str = json.dumps(request_data, sort_keys=True)
            else:
                data_str = str(request_data)
            
            return hashlib.sha256(data_str.encode('utf-8')).hexdigest()
        except Exception as e:
            logger.warning(f"Failed to generate request hash: {e}")
            return hashlib.sha256(str(request_data).encode('utf-8')).hexdigest()
    
    @staticmethod
    def get_cached_response(
        tenant_id: str,
        idempotency_key: str,
        endpoint: str,
        method: str,
        request_data: Any
    ) -> Optional[Dict[str, Any]]:
        """
        Get cached response for idempotency key.
        
        Args:
            tenant_id: The tenant ID
            idempotency_key: The idempotency key
            endpoint: The endpoint
            method: The HTTP method
            request_data: The request data
            
        Returns:
            Optional[Dict]: Cached response if found, None otherwise
        """
        try:
            key_hash = IdempotencyService.generate_key_hash(idempotency_key)
            request_hash = IdempotencyService.generate_request_hash(request_data)
            
            cached_key = IdempotencyKey.find_valid_by_key(
                tenant_id=tenant_id,
                key_hash=key_hash,
                endpoint=endpoint,
                method=method,
                request_hash=request_hash
            )
            
            if cached_key:
                logger.info(
                    "IDEMPOTENCY_KEY_USED",
                    extra={
                        'idempotency_key': idempotency_key[:8] + '...',  # Truncated for security
                        'endpoint': endpoint,
                        'tenant_id': tenant_id,
                        'user_id': getattr(g, 'current_user_id', None),
                        'cached_status': cached_key.response_status
                    }
                )
                
                return cached_key.get_cached_response()
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get cached response: {e}")
            return None
    
    @staticmethod
    def store_response(
        tenant_id: str,
        idempotency_key: str,
        endpoint: str,
        method: str,
        request_data: Any,
        response_status: int,
        response_body: Dict[str, Any],
        response_headers: Dict[str, str],
        expiration_hours: int = None
    ) -> str:
        """
        Store response for idempotency key.
        
        Args:
            tenant_id: The tenant ID
            idempotency_key: The idempotency key
            endpoint: The endpoint
            method: The HTTP method
            request_data: The request data
            response_status: The response status code
            response_body: The response body
            response_headers: The response headers
            expiration_hours: Hours until expiration (default: 24)
            
        Returns:
            str: The ID of the stored idempotency key
        """
        try:
            key_hash = IdempotencyService.generate_key_hash(idempotency_key)
            request_hash = IdempotencyService.generate_request_hash(request_data)
            
            # Calculate expiration time
            expires_at = datetime.utcnow() + timedelta(
                hours=expiration_hours or IdempotencyService.DEFAULT_EXPIRATION_HOURS
            )
            
            # Create or update idempotency key record
            idempotency_record = IdempotencyKey(
                tenant_id=tenant_id,
                key_hash=key_hash,
                original_key=idempotency_key,
                endpoint=endpoint,
                method=method,
                request_hash=request_hash,
                response_status=response_status,
                response_body=response_body,
                response_headers=response_headers,
                expires_at=expires_at
            )
            
            db.session.add(idempotency_record)
            db.session.commit()
            
            logger.info(
                "IDEMPOTENCY_KEY_STORED",
                extra={
                    'idempotency_key': idempotency_key[:8] + '...',  # Truncated for security
                    'endpoint': endpoint,
                    'tenant_id': tenant_id,
                    'user_id': getattr(g, 'current_user_id', None),
                    'response_status': response_status,
                    'expires_at': expires_at.isoformat()
                }
            )
            
            return str(idempotency_record.id)
            
        except Exception as e:
            logger.error(f"Failed to store idempotency response: {e}")
            db.session.rollback()
            raise Exception("Failed to store idempotency response")
    
    @staticmethod
    def cleanup_expired_keys() -> int:
        """
        Clean up expired idempotency keys.
        
        Returns:
            int: Number of keys cleaned up
        """
        try:
            expired_count = IdempotencyKey.cleanup_expired()
            
            logger.info(f"Cleaned up {expired_count} expired idempotency keys")
            return expired_count
            
        except Exception as e:
            logger.error(f"Failed to cleanup expired idempotency keys: {e}")
            return 0
    
    @staticmethod
    def get_tenant_stats(tenant_id: str) -> Dict[str, Any]:
        """
        Get idempotency key statistics for a tenant.
        
        Args:
            tenant_id: The tenant ID
            
        Returns:
            Dict: Statistics about idempotency keys
        """
        try:
            return IdempotencyKey.get_stats_for_tenant(tenant_id)
        except Exception as e:
            logger.error(f"Failed to get tenant stats: {e}")
            return {
                'total_keys': 0,
                'active_keys': 0,
                'expired_keys': 0
            }
    
    @staticmethod
    def extend_key_expiration(
        tenant_id: str,
        idempotency_key: str,
        endpoint: str,
        method: str,
        request_data: Any,
        hours: int = 24
    ) -> bool:
        """
        Extend the expiration time of an idempotency key.
        
        Args:
            tenant_id: The tenant ID
            idempotency_key: The idempotency key
            endpoint: The endpoint
            method: The HTTP method
            request_data: The request data
            hours: Hours to extend
            
        Returns:
            bool: True if extended, False otherwise
        """
        try:
            key_hash = IdempotencyService.generate_key_hash(idempotency_key)
            request_hash = IdempotencyService.generate_request_hash(request_data)
            
            cached_key = IdempotencyKey.find_by_key(
                tenant_id=tenant_id,
                key_hash=key_hash,
                endpoint=endpoint,
                method=method,
                request_hash=request_hash
            )
            
            if cached_key:
                cached_key.extend_expiration(hours)
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Failed to extend key expiration: {e}")
            return False
    
    @staticmethod
    def validate_endpoint_requires_idempotency(endpoint: str, method: str) -> bool:
        """
        Check if an endpoint requires idempotency.
        
        Args:
            endpoint: The endpoint
            method: The HTTP method
            
        Returns:
            bool: True if idempotency is required, False otherwise
        """
        critical_endpoints = {
            'POST /api/bookings',
            'POST /api/payments/intent',
            'POST /api/payments/confirm',
            'POST /api/payments/refund',
            'POST /api/payments/setup-intent',
            'POST /api/payments/capture-no-show',
            'POST /api/availability/hold',
            'POST /api/availability/release'
        }
        
        endpoint_key = f"{method} {endpoint}"
        return endpoint_key in critical_endpoints
