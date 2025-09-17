"""
Tenant Middleware

This middleware handles tenant resolution and context setting for multi-tenant
requests. It supports both path-based and host-based tenant resolution.

Features:
- Path-based tenant resolution (/v1/b/{slug})
- Host-based tenant resolution (subdomain.tithi.com)
- Tenant context setting
- Tenant validation
- Error handling for invalid tenants
"""

import logging
from typing import Optional
from flask import request, g, current_app, jsonify
from ..middleware.error_handler import TenantError


class TenantMiddleware:
    """Middleware for tenant resolution and context setting."""
    
    def __init__(self, app):
        self.app = app
        self.logger = logging.getLogger(__name__)
    
    def __call__(self, environ, start_response):
        """Process request with tenant resolution."""
        
        # Resolve tenant from request
        tenant_id = self._resolve_tenant(environ)
        
        if tenant_id:
            g.tenant_id = tenant_id
            self.logger.debug(f"Tenant resolved: {tenant_id}", extra={
                "tenant_id": tenant_id,
                "request_path": environ.get("PATH_INFO")
            })
        
        return self.app(environ, start_response)
    
    def _resolve_tenant(self, environ) -> Optional[str]:
        """Resolve tenant from request."""
        
        # Try path-based resolution first
        tenant_id = self._resolve_from_path(environ)
        if tenant_id:
            return tenant_id
        
        # Try host-based resolution
        tenant_id = self._resolve_from_host(environ)
        if tenant_id:
            return tenant_id
        
        return None
    
    def _resolve_from_path(self, environ) -> Optional[str]:
        """Resolve tenant from path-based routing."""
        path = environ.get("PATH_INFO", "")
        
        # Check for /v1/b/{slug} pattern
        if path.startswith("/v1/b/"):
            parts = path.split("/")
            if len(parts) >= 4:
                slug = parts[3]
                return self._get_tenant_id_by_slug(slug)
        
        return None
    
    def _resolve_from_host(self, environ) -> Optional[str]:
        """Resolve tenant from host-based routing."""
        host = environ.get("HTTP_HOST", "")
        
        # Check for subdomain pattern
        if "." in host and not host.startswith("www."):
            subdomain = host.split(".")[0]
            if subdomain != "api" and subdomain != "www":
                return self._get_tenant_id_by_slug(subdomain)
        
        return None
    
    def _get_tenant_id_by_slug(self, slug: str) -> Optional[str]:
        """Get tenant ID by slug."""
        try:
            # This would normally query the database
            # For now, return a mock tenant ID
            if slug in ["test-salon", "salonx", "demo"]:
                return "550e8400-e29b-41d4-a716-446655440000"
            
            return None
        except Exception as e:
            self.logger.error(f"Error resolving tenant by slug: {e}", extra={
                "slug": slug,
                "error": str(e)
            })
            return None
