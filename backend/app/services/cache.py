"""
Cache Service

This module provides caching functionality using Redis for availability calculations,
booking holds, and other performance-critical operations.

Features:
- Availability caching with TTL
- Distributed locking for concurrent operations
- Cache invalidation strategies
- Fallback to in-memory cache when Redis unavailable
"""

import json
import uuid
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union
from threading import Lock

from app.extensions import get_redis
from app.models.system import TithiError


class CacheService:
    """Service for managing Redis-based caching operations."""
    
    def __init__(self):
        """Initialize cache service."""
        self.redis_client = get_redis()
        self._memory_cache = {}
        self._memory_cache_lock = Lock()
        self._memory_cache_ttl = {}
    
    def _get_cache_key(self, prefix: str, *args) -> str:
        """Generate cache key from prefix and arguments."""
        key_parts = [prefix] + [str(arg) for arg in args]
        return ":".join(key_parts)
    
    def _is_memory_cache_valid(self, key: str, ttl_seconds: int) -> bool:
        """Check if memory cache entry is still valid."""
        if key not in self._memory_cache_ttl:
            return False
        
        return time.time() - self._memory_cache_ttl[key] < ttl_seconds
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get value from cache (Redis or memory fallback)."""
        # Try Redis first
        if self.redis_client:
            try:
                value = self.redis_client.get(key)
                if value is not None:
                    return json.loads(value)
            except Exception:
                pass  # Fall back to memory cache
        
        # Fall back to memory cache
        with self._memory_cache_lock:
            if key in self._memory_cache and self._is_memory_cache_valid(key, 300):  # 5 min default TTL
                return self._memory_cache[key]
        
        return default
    
    def set(self, key: str, value: Any, ttl_seconds: int = 300) -> bool:
        """Set value in cache (Redis and memory fallback)."""
        success = False
        
        # Try Redis first
        if self.redis_client:
            try:
                serialized_value = json.dumps(value, default=str)
                self.redis_client.setex(key, ttl_seconds, serialized_value)
                success = True
            except Exception:
                pass  # Fall back to memory cache
        
        # Always update memory cache as fallback
        with self._memory_cache_lock:
            self._memory_cache[key] = value
            self._memory_cache_ttl[key] = time.time()
        
        return success
    
    def delete(self, key: str) -> bool:
        """Delete value from cache."""
        success = False
        
        # Try Redis first
        if self.redis_client:
            try:
                self.redis_client.delete(key)
                success = True
            except Exception:
                pass
        
        # Remove from memory cache
        with self._memory_cache_lock:
            self._memory_cache.pop(key, None)
            self._memory_cache_ttl.pop(key, None)
        
        return success
    
    def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern."""
        deleted_count = 0
        
        # Try Redis first
        if self.redis_client:
            try:
                keys = self.redis_client.keys(pattern)
                if keys:
                    deleted_count = self.redis_client.delete(*keys)
            except Exception:
                pass
        
        # Remove from memory cache (exact match only)
        with self._memory_cache_lock:
            keys_to_remove = [k for k in self._memory_cache.keys() if k == pattern]
            for key in keys_to_remove:
                self._memory_cache.pop(key, None)
                self._memory_cache_ttl.pop(key, None)
                deleted_count += 1
        
        return deleted_count
    
    def acquire_lock(self, lock_key: str, ttl_seconds: int = 30) -> Optional[str]:
        """Acquire distributed lock."""
        lock_value = str(uuid.uuid4())
        
        # Try Redis first
        if self.redis_client:
            try:
                if self.redis_client.set(lock_key, lock_value, nx=True, ex=ttl_seconds):
                    return lock_value
            except Exception:
                pass
        
        # Fall back to memory-based locking (not truly distributed)
        with self._memory_cache_lock:
            if lock_key not in self._memory_cache:
                self._memory_cache[lock_key] = lock_value
                self._memory_cache_ttl[lock_key] = time.time()
                return lock_value
        
        return None
    
    def release_lock(self, lock_key: str, lock_value: str) -> bool:
        """Release distributed lock."""
        # Try Redis first
        if self.redis_client:
            try:
                # Use Lua script to ensure atomic check-and-delete
                lua_script = """
                if redis.call("get", KEYS[1]) == ARGV[1] then
                    return redis.call("del", KEYS[1])
                else
                    return 0
                end
                """
                result = self.redis_client.eval(lua_script, 1, lock_key, lock_value)
                return result == 1
            except Exception:
                pass
        
        # Fall back to memory cache
        with self._memory_cache_lock:
            if self._memory_cache.get(lock_key) == lock_value:
                self._memory_cache.pop(lock_key, None)
                self._memory_cache_ttl.pop(lock_key, None)
                return True
        
        return False


class AvailabilityCacheService(CacheService):
    """Specialized cache service for availability calculations."""
    
    def __init__(self):
        """Initialize availability cache service."""
        super().__init__()
        self.cache_prefix = "tithi:availability"
        self.default_ttl = 300  # 5 minutes
    
    def get_availability(self, tenant_id: uuid.UUID, resource_id: uuid.UUID, date: str) -> Optional[Dict]:
        """Get cached availability for resource on specific date."""
        key = self._get_cache_key(
            self.cache_prefix, 
            str(tenant_id), 
            str(resource_id), 
            date
        )
        return self.get(key)
    
    def set_availability(self, tenant_id: uuid.UUID, resource_id: uuid.UUID, 
                        date: str, availability_data: Dict, ttl_seconds: int = None) -> bool:
        """Cache availability data for resource on specific date."""
        key = self._get_cache_key(
            self.cache_prefix, 
            str(tenant_id), 
            str(resource_id), 
            date
        )
        ttl = ttl_seconds or self.default_ttl
        return self.set(key, availability_data, ttl)
    
    def invalidate_availability(self, tenant_id: uuid.UUID, resource_id: uuid.UUID, 
                               date: str = None) -> int:
        """Invalidate availability cache for resource."""
        if date:
            # Invalidate specific date
            key = self._get_cache_key(
                self.cache_prefix, 
                str(tenant_id), 
                str(resource_id), 
                date
            )
            return 1 if self.delete(key) else 0
        else:
            # Invalidate all dates for resource
            pattern = self._get_cache_key(
                self.cache_prefix, 
                str(tenant_id), 
                str(resource_id), 
                "*"
            )
            return self.delete_pattern(pattern)
    
    def invalidate_tenant_availability(self, tenant_id: uuid.UUID) -> int:
        """Invalidate all availability cache for tenant."""
        pattern = self._get_cache_key(self.cache_prefix, str(tenant_id), "*")
        return self.delete_pattern(pattern)


class BookingHoldCacheService(CacheService):
    """Specialized cache service for booking holds."""
    
    def __init__(self):
        """Initialize booking hold cache service."""
        super().__init__()
        self.hold_prefix = "tithi:hold"
        self.default_ttl = 900  # 15 minutes
    
    def create_hold(self, tenant_id: uuid.UUID, hold_key: str, hold_data: Dict, 
                   ttl_seconds: int = None) -> bool:
        """Create booking hold in cache."""
        key = self._get_cache_key(self.hold_prefix, str(tenant_id), hold_key)
        ttl = ttl_seconds or self.default_ttl
        return self.set(key, hold_data, ttl)
    
    def get_hold(self, tenant_id: uuid.UUID, hold_key: str) -> Optional[Dict]:
        """Get booking hold from cache."""
        key = self._get_cache_key(self.hold_prefix, str(tenant_id), hold_key)
        return self.get(key)
    
    def release_hold(self, tenant_id: uuid.UUID, hold_key: str) -> bool:
        """Release booking hold from cache."""
        key = self._get_cache_key(self.hold_prefix, str(tenant_id), hold_key)
        return self.delete(key)
    
    def extend_hold(self, tenant_id: uuid.UUID, hold_key: str, additional_seconds: int) -> bool:
        """Extend booking hold TTL."""
        hold_data = self.get_hold(tenant_id, hold_key)
        if not hold_data:
            return False
        
        # Update expiry time
        hold_data['expires_at'] = (datetime.now() + timedelta(seconds=additional_seconds)).isoformat()
        
        key = self._get_cache_key(self.hold_prefix, str(tenant_id), hold_key)
        return self.set(key, hold_data, additional_seconds)
    
    def cleanup_expired_holds(self, tenant_id: uuid.UUID) -> int:
        """Clean up expired holds for tenant."""
        pattern = self._get_cache_key(self.hold_prefix, str(tenant_id), "*")
        return self.delete_pattern(pattern)


class WaitlistCacheService(CacheService):
    """Specialized cache service for waitlist management."""
    
    def __init__(self):
        """Initialize waitlist cache service."""
        super().__init__()
        self.waitlist_prefix = "tithi:waitlist"
        self.notification_prefix = "tithi:waitlist:notification"
        self.default_ttl = 3600  # 1 hour
    
    def add_to_waitlist_cache(self, tenant_id: uuid.UUID, resource_id: uuid.UUID, 
                            waitlist_data: Dict) -> bool:
        """Add waitlist entry to cache."""
        key = self._get_cache_key(
            self.waitlist_prefix, 
            str(tenant_id), 
            str(resource_id)
        )
        
        # Get existing waitlist
        waitlist = self.get(key, [])
        waitlist.append(waitlist_data)
        
        # Sort by priority and created_at
        waitlist.sort(key=lambda x: (-x.get('priority', 0), x.get('created_at', '')))
        
        return self.set(key, waitlist, self.default_ttl)
    
    def get_waitlist(self, tenant_id: uuid.UUID, resource_id: uuid.UUID) -> List[Dict]:
        """Get waitlist for resource."""
        key = self._get_cache_key(
            self.waitlist_prefix, 
            str(tenant_id), 
            str(resource_id)
        )
        return self.get(key, [])
    
    def remove_from_waitlist_cache(self, tenant_id: uuid.UUID, resource_id: uuid.UUID, 
                                 customer_id: uuid.UUID) -> bool:
        """Remove customer from waitlist cache."""
        key = self._get_cache_key(
            self.waitlist_prefix, 
            str(tenant_id), 
            str(resource_id)
        )
        
        waitlist = self.get(key, [])
        original_length = len(waitlist)
        
        # Remove customer
        waitlist = [entry for entry in waitlist if entry.get('customer_id') != str(customer_id)]
        
        if len(waitlist) != original_length:
            return self.set(key, waitlist, self.default_ttl)
        
        return False
    
    def set_notification_sent(self, tenant_id: uuid.UUID, resource_id: uuid.UUID, 
                             customer_id: uuid.UUID, ttl_seconds: int = None) -> bool:
        """Mark notification as sent for customer."""
        key = self._get_cache_key(
            self.notification_prefix, 
            str(tenant_id), 
            str(resource_id), 
            str(customer_id)
        )
        ttl = ttl_seconds or self.default_ttl
        return self.set(key, {'notified_at': datetime.now().isoformat()}, ttl)
    
    def is_notification_sent(self, tenant_id: uuid.UUID, resource_id: uuid.UUID, 
                           customer_id: uuid.UUID) -> bool:
        """Check if notification was already sent."""
        key = self._get_cache_key(
            self.notification_prefix, 
            str(tenant_id), 
            str(resource_id), 
            str(customer_id)
        )
        return self.get(key) is not None
