# Migration 0020: Versioned Themes with Publish/Rollback

## Overview

This migration introduces versioned themes with publish/rollback functionality while maintaining backward compatibility for existing consumers. Tenants can now save multiple theme versions they like, publish one, and roll back later.

## Key Features

### 1. Versioned Theme Storage
- **Append-friendly design**: Themes are never deleted, only archived
- **Version numbering**: Sequential integer versions per tenant
- **Status management**: `draft`, `published`, `archived` states
- **ETag support**: For HTTP 304 caching and optimistic concurrency

### 2. Publish/Rollback Workflow
- **One published per tenant**: Enforced by unique constraint
- **Automatic unpublishing**: Publishing a theme automatically archives others
- **Version rollback**: Roll back to any previous version
- **Safe operations**: All operations maintain data integrity

### 3. Backward Compatibility
- **`themes_current` view**: Returns currently published theme per tenant
- **Legacy data migration**: Existing themes become version 1 published
- **No breaking changes**: Existing "read current theme" paths continue working

## Database Schema

### Table: `tenant_themes`
```sql
CREATE TABLE public.tenant_themes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    version integer NOT NULL,
    status text NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
    label text NULL,  -- human-friendly name ("Spring 2026")
    tokens jsonb NOT NULL DEFAULT '{}'::jsonb,
    etag text NOT NULL,
    created_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
```

### Key Constraints
- **Unique `(tenant_id, version)`**: Each version per tenant is unique
- **Unique `(tenant_id)` where `status='published'`**: At most one published per tenant
- **Version positive**: `version > 0`
- **ETag not empty**: `etag != ''`

### Indexes
- `tenant_themes_tenant_id_idx`: Efficient tenant lookups
- `tenant_themes_status_idx`: Status-based queries
- `tenant_themes_created_by_idx`: User creation tracking

## Security Model

### RLS Policies
- **SELECT**: Members can read themes for their tenants
- **INSERT**: Only owners/admins can create themes
- **UPDATE**: Only owners/admins can modify themes (including status changes)
- **DELETE**: Denied (append-only design)

### Helper Functions
- **`get_next_theme_version(tenant_id)`**: Returns next available version number
- **`publish_theme(theme_id)`**: Publishes theme, automatically unpublishes others
- **`rollback_theme(tenant_id, version)`**: Rolls back to specific version

## Data Migration

### Legacy Theme Migration
- **Automatic backfill**: Runs during migration execution
- **Safe re-runs**: Checks existence before creating version 1
- **Data preservation**: Copies `brand_color`, `logo_url`, `theme_json` to `tokens`
- **Stable ETags**: Generated from tenant slug and timestamp

### Migration Process
```sql
-- For each tenant with legacy theme:
-- 1. Check if version 1 already exists
-- 2. Create version 1 with status='published'
-- 3. Copy legacy data to tokens JSONB
-- 4. Generate stable ETag
```

## Compatibility View

### View: `themes_current`
```sql
CREATE VIEW public.themes_current AS
SELECT 
    tt.tenant_id,
    tt.id as theme_id,
    tt.version,
    tt.status,
    tt.label,
    tt.tokens,
    tt.etag,
    tt.created_by,
    tt.created_at,
    tt.updated_at
FROM public.tenant_themes tt
WHERE tt.status = 'published';
```

**Purpose**: Maintains 1:1 read behavior for existing consumers
**Usage**: Replace `SELECT * FROM themes` with `SELECT * FROM themes_current`

## Audit Integration

### Audit Triggers
- **`tenant_themes_audit_aiud`**: Logs all INSERT/UPDATE/DELETE operations
- **`tenant_themes_touch_updated_at`**: Maintains `updated_at` timestamps

### Audit Coverage
- Theme creation and modification
- Status changes (publish/rollback)
- Version management
- User attribution

## Testing

### Test File: `0020_versioned_themes_validation.sql`
Comprehensive validation covering:

1. **Table Structure**: Column existence, types, constraints, indexes
2. **Business Logic**: Draft → publish → enforce one published per tenant
3. **RLS Policies**: Cross-tenant access denied, owner/admin permissions
4. **Compatibility View**: Returns published version (or NULL)
5. **Data Migration**: Legacy theme data preservation
6. **Helper Functions**: Version management, publish/rollback
7. **Audit Integration**: Trigger existence and functionality

### Running Tests
```bash
# Run validation tests (no extensions required)
psql -d your_database -f infra/supabase/tests/0020_versioned_themes_validation.sql

# Alternative: Use the simple test runner
psql -d your_database -f infra/supabase/tests/run_0020_validation.sql
```

## Usage Examples

### Creating a New Theme Version
```sql
-- Get next version number
SELECT public.get_next_theme_version('tenant-uuid');

-- Insert new draft theme
INSERT INTO tenant_themes (tenant_id, version, status, label, tokens, etag)
VALUES (
    'tenant-uuid',
    (SELECT public.get_next_theme_version('tenant-uuid')),
    'draft',
    'Summer 2026 Theme',
    '{"primary_color": "#ff6b35", "layout": "modern"}',
    'etag-' || extract(epoch from now())::text
);
```

### Publishing a Theme
```sql
-- Publish theme (automatically unpublishes others)
SELECT public.publish_theme('theme-uuid');
```

### Rolling Back to Previous Version
```sql
-- Roll back to version 2
SELECT public.rollback_theme('tenant-uuid', 2);
```

### Reading Current Theme (Compatibility)
```sql
-- Old way (still works)
SELECT * FROM themes WHERE tenant_id = 'tenant-uuid';

-- New way (recommended)
SELECT * FROM themes_current WHERE tenant_id = 'tenant-uuid';
```

## Backend Integration

### API Endpoints
- **GET** `/v1/tenants/{id}/themes` → List all theme versions
- **GET** `/v1/tenants/{id}/themes/current` → Get published theme (compatibility)
- **POST** `/v1/tenants/{id}/themes` → Create new theme version
- **PATCH** `/v1/tenants/{id}/themes/{themeId}/publish` → Publish theme
- **POST** `/v1/tenants/{id}/themes/{version}/rollback` → Roll back to version

### ETag Support
- **HTTP 304**: Use `etag` field for conditional requests
- **Optimistic Concurrency**: Include ETag in update requests
- **Cache Invalidation**: ETag changes when theme is modified

## Migration Safety

### Rollback Plan
- **Reversible**: Can drop `tenant_themes` table and restore `themes` if needed
- **Data preservation**: Legacy themes remain intact during migration
- **No downtime**: Migration is additive, doesn't modify existing tables

### Compatibility Guarantees
- **Existing queries**: Continue working via `themes_current` view
- **API contracts**: No breaking changes to current theme endpoints
- **Data integrity**: All existing theme data preserved and accessible

## Performance Considerations

### Index Strategy
- **Composite indexes**: Support common query patterns
- **Partial unique**: Efficient constraint enforcement
- **Status filtering**: Quick published theme lookups

### Query Optimization
- **View materialization**: Consider for high-traffic scenarios
- **ETag caching**: Leverage for HTTP 304 responses
- **Version history**: Paginate for tenants with many versions

## Future Enhancements

### Potential Features
- **Theme templates**: Pre-built theme starting points
- **A/B testing**: Multiple published themes for experimentation
- **Theme inheritance**: Base themes with tenant customizations
- **Bulk operations**: Mass theme updates across tenants

### Schema Evolution
- **Soft delete**: Add `deleted_at` for theme cleanup
- **Theme categories**: Organize themes by purpose/season
- **Approval workflows**: Multi-stage theme publishing process
- **Theme analytics**: Usage tracking and performance metrics
