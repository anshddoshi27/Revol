import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/db';
import { generateAvailabilitySlots } from '@/lib/availability';
import { resolveTenantSlug } from '@/lib/tenant-resolution';
import { addCorsHeaders, handleOptions } from '@/lib/cors';

/**
 * GET /api/public/{slug}/availability?service_id={id}&date=YYYY-MM-DD
 * 
 * Returns available time slots for a service on a specific date
 * No authentication required - this is a public endpoint
 * 
 * Supports both:
 * - Subdomain-based: {businessname}.main.tld → resolves from Host header
 * - Path-based: /api/public/{slug}/availability → resolves from URL parameter
 */
export async function OPTIONS(request: NextRequest) {
  return handleOptions(request) || new NextResponse(null, { status: 200 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    // Resolve tenant slug from Host header or URL parameter
    const tenantSlug = resolveTenantSlug(request, params.slug);
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('service_id');
    const date = searchParams.get('date');

    if (!tenantSlug) {
      const response = NextResponse.json(
        { error: 'Subdomain is required' },
        { status: 400 }
      );
      return addCorsHeaders(response, request);
    }

    if (!serviceId) {
      const response = NextResponse.json(
        { error: 'service_id query parameter is required' },
        { status: 400 }
      );
      return addCorsHeaders(response, request);
    }

    if (!date) {
      const response = NextResponse.json(
        { error: 'date query parameter is required (YYYY-MM-DD)' },
        { status: 400 }
      );
      return addCorsHeaders(response, request);
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      const response = NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
      return addCorsHeaders(response, request);
    }

    const supabase = createAdminClient();

    // Get business by subdomain (only active or trial businesses are accessible)
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, user_id, timezone, min_lead_time_minutes, max_advance_days')
      .eq('subdomain', tenantSlug)
      .in('subscription_status', ['active', 'trial'])
      .is('deleted_at', null)
      .single();

    if (businessError) {
      console.error('Business query error:', businessError);
      const response = NextResponse.json(
        { error: 'Business not found', details: businessError.message },
        { status: 404 }
      );
      return addCorsHeaders(response, request);
    }

    if (!business) {
      console.error('Business not found for subdomain:', tenantSlug);
      const response = NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
      return addCorsHeaders(response, request);
    }

    // Generate availability slots
    console.log(`[public-availability] Generating slots for service ${serviceId}, date ${date}, business ${business.id}`);
    const slots = await generateAvailabilitySlots({
      serviceId,
      date,
      businessId: business.id,
      userId: business.user_id,
      businessTimezone: business.timezone,
      minLeadTimeMinutes: business.min_lead_time_minutes,
      maxAdvanceDays: business.max_advance_days,
    });

    console.log(`[public-availability] Generated ${slots.length} slots for service ${serviceId}, date ${date}`);

    const response = NextResponse.json({
      slots,
      service_id: serviceId,
      date,
    });
    return addCorsHeaders(response, request);
  } catch (error) {
    console.error('Error in public availability:', error);
    const response = NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
    return addCorsHeaders(response, request);
  }
}


