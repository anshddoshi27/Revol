BEGIN;

-- Seed dev data for local testing
-- Creates a single tenant 'salonx' with basic theme, resource, and service

-- Seed tenant
INSERT INTO public.tenants (
    id,
    slug,
    tz,
    trust_copy_json,
    is_public_directory,
    public_blurb,
    billing_json,
    created_at,
    updated_at
) VALUES (
    '01234567-89ab-cdef-0123-456789abcdef',
    'salonx',
    'America/New_York',
    '{"tagline": "Your trusted neighborhood salon", "guarantee": "100% satisfaction guaranteed"}',
    true,
    'Modern salon services with experienced professionals',
    '{"plan": "pro", "trial_days": 30}',
    now(),
    now()
) ON CONFLICT (id) DO NOTHING;

-- Seed theme for the tenant
INSERT INTO public.themes (
    tenant_id,
    brand_color,
    logo_url,
    theme_json,
    created_at,
    updated_at
) VALUES (
    '01234567-89ab-cdef-0123-456789abcdef',
    '#2563eb',
    'https://example.com/logo.png',
    '{"layout": "modern", "typography": "sans-serif", "accent_color": "#f59e0b"}',
    now(),
    now()
) ON CONFLICT (tenant_id) DO NOTHING;

-- Seed a staff resource
INSERT INTO public.resources (
    id,
    tenant_id,
    type,
    tz,
    capacity,
    metadata,
    name,
    is_active,
    created_at,
    updated_at
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    '01234567-89ab-cdef-0123-456789abcdef',
    'staff',
    'America/New_York',
    1,
    '{"specialties": ["haircuts", "styling"], "experience_years": 5}',
    'Sarah Johnson',
    true,
    now(),
    now()
) ON CONFLICT (id) DO NOTHING;

-- Seed a basic service
INSERT INTO public.services (
    id,
    tenant_id,
    slug,
    name,
    description,
    duration_min,
    price_cents,
    buffer_before_min,
    buffer_after_min,
    category,
    active,
    metadata,
    created_at,
    updated_at
) VALUES (
    '22222222-2222-2222-2222-222222222222',
    '01234567-89ab-cdef-0123-456789abcdef',
    'haircut-basic',
    'Basic Haircut',
    'Professional haircut and styling for all hair types',
    60,
    3500, -- $35.00
    15,
    15,
    'haircuts',
    true,
    '{"requires_consultation": false, "includes_wash": true}',
    now(),
    now()
) ON CONFLICT (id) DO NOTHING;

-- Link the service to the staff resource
INSERT INTO public.service_resources (
    id,
    tenant_id,
    service_id,
    resource_id,
    created_at
) VALUES (
    '33333333-3333-3333-3333-333333333333',
    '01234567-89ab-cdef-0123-456789abcdef',
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    now()
) ON CONFLICT (id) DO NOTHING;

COMMIT;
