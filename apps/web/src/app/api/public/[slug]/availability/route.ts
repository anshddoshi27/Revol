import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db';
import { generateAvailabilitySlots } from '@/lib/availability';

/**
 * GET /api/public/{slug}/availability?service_id={id}&date=YYYY-MM-DD
 * 
 * Returns available time slots for a service on a specific date
 * No authentication required - this is a public endpoint
 */
export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('service_id');
    const date = searchParams.get('date');

    if (!slug) {
      return NextResponse.json(
        { error: 'Subdomain is required' },
        { status: 400 }
      );
    }

    if (!serviceId) {
      return NextResponse.json(
        { error: 'service_id query parameter is required' },
        { status: 400 }
      );
    }

    if (!date) {
      return NextResponse.json(
        { error: 'date query parameter is required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get business by subdomain (only active or trial businesses are accessible)
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, user_id, timezone, min_lead_time_minutes, max_advance_days')
      .eq('subdomain', slug.toLowerCase())
      .in('subscription_status', ['active', 'trial'])
      .is('deleted_at', null)
      .single();

    if (businessError) {
      console.error('Business query error:', businessError);
      return NextResponse.json(
        { error: 'Business not found', details: businessError.message },
        { status: 404 }
      );
    }

    if (!business) {
      console.error('Business not found for subdomain:', slug);
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    // Generate availability slots
    const slots = await generateAvailabilitySlots({
      serviceId,
      date,
      businessId: business.id,
      userId: business.user_id,
      businessTimezone: business.timezone,
      minLeadTimeMinutes: business.min_lead_time_minutes,
      maxAdvanceDays: business.max_advance_days,
    });

    return NextResponse.json({
      slots,
      service_id: serviceId,
      date,
    });
  } catch (error) {
    console.error('Error in public availability:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


