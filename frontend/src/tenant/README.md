# Tenant Module

This module provides multi-tenant routing and context management for the Tithi frontend application.

## Overview

The tenant module supports both path-based (`/v1/b/{slug}`) and subdomain routing, providing tenant context resolution and route protection.

## Features

- **Tenant Resolution**: Automatic resolution from URL path or subdomain
- **Context Management**: React context provider with memoized resolution
- **Route Guards**: Authentication and tenant-based route protection
- **Performance**: Zero extra renders with memoized slug resolution
- **Observability**: Telemetry events for tenant resolution tracking

## Usage

### Basic Setup

```tsx
import { TenantProvider, ProtectedRoute, PublicRoute } from '@/tenant';

function App() {
  return (
    <TenantProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth/*" element={<AuthRoutes />} />
          <Route 
            path="/v1/b/:slug/*" 
            element={
              <PublicRoute>
                <BookingRoutes />
              </PublicRoute>
            } 
          />
          <Route 
            path="/admin/*" 
            element={
              <ProtectedRoute requireAuth requireTenant>
                <AdminRoutes />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </Router>
    </TenantProvider>
  );
}
```

### Using Tenant Context

```tsx
import { useTenantSlug, useTenantContext, useTenantResolved } from '@/tenant';

function MyComponent() {
  const slug = useTenantSlug();
  const context = useTenantContext();
  const isResolved = useTenantResolved();

  if (!isResolved) {
    return <div>Loading...</div>;
  }

  return <div>Current tenant: {slug}</div>;
}
```

### Route Guards

```tsx
import { AuthGuard, TenantGuard, ProtectedRoute } from '@/tenant';

// Authentication only
<AuthGuard requireAuth>
  <AdminContent />
</AuthGuard>

// Tenant context only
<TenantGuard requireTenant>
  <TenantContent />
</TenantGuard>

// Both authentication and tenant context
<ProtectedRoute requireAuth requireTenant>
  <ProtectedContent />
</ProtectedRoute>
```

## API Reference

### Hooks

- `useTenantSlug()`: Returns current tenant slug or null
- `useTenantContext()`: Returns full tenant context object
- `useTenantResolved()`: Returns boolean indicating if tenant is resolved

### Components

- `TenantProvider`: Context provider for tenant state
- `AuthGuard`: Route guard for authentication
- `TenantGuard`: Route guard for tenant context
- `ProtectedRoute`: Combined authentication and tenant guard
- `PublicRoute`: Public route wrapper

### Utilities

- `getTenantSlug()`: Get tenant slug from current location
- `requireTenantSlug()`: Require tenant slug, throw if not found
- `resolveTenantFromLocation()`: Resolve tenant from browser location
- `clearTenantCache()`: Clear tenant resolution cache

## Route Patterns

### Public Booking Routes
- Pattern: `/v1/b/{slug}/*`
- Example: `/v1/b/acme-salon/services`
- Requires: Tenant context only

### Admin Routes
- Pattern: `/admin/*`
- Example: `/admin/dashboard`
- Requires: Authentication + Tenant context

### Auth Routes
- Pattern: `/auth/*`
- Example: `/auth/sign-up`
- Requires: None

### Landing Routes
- Pattern: `/`
- Example: `/`
- Requires: None

## Tenant Resolution

### Path-based Routing
```
https://tithi.com/v1/b/acme-salon
```
- Extracts `acme-salon` from the URL path
- Source: `'path'`

### Subdomain Routing
```
https://acme-salon.tithi.com
```
- Extracts `acme-salon` from the subdomain
- Source: `'subdomain'`

## Observability

The module emits the following telemetry events:

- `routing.tenant_resolved`: When tenant is successfully resolved
- `routing.guard_blocked`: When route guard blocks access
- `routing.guard_passed`: When route guard allows access

## Error Handling

### Missing Tenant
- **Error**: "Tenant slug not found in URL or subdomain"
- **Context**: When `requireTenantSlug()` is called but no tenant is resolved
- **Resolution**: Ensure URL follows correct pattern or subdomain is configured

### Invalid Tenant
- **Error**: "Business not found"
- **Context**: When tenant slug exists but tenant is not found in backend
- **Resolution**: Verify tenant exists and is active

### Unauthorized Access
- **Error**: "Access denied"
- **Context**: When accessing protected routes without authentication
- **Resolution**: User must authenticate before accessing admin routes

## Performance Considerations

- **Memoization**: Tenant resolution is memoized to prevent extra renders
- **Cache Management**: Cache is cleared when location changes
- **Lazy Loading**: Route guards only check when required

## Testing

Run tests with:
```bash
npm test -- tenant
```

Test coverage includes:
- Unit tests for utilities and context
- Integration tests for route guards
- E2E tests for tenant resolution
- Performance tests for memoization

## Security

- **Tenant Isolation**: Strict provider boundaries prevent cross-tenant state bleed
- **Route Protection**: Authentication and tenant guards prevent unauthorized access
- **Context Validation**: All tenant context is validated before use
