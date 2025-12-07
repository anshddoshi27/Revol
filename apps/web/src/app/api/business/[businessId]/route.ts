import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';

/**
 * GET /api/business/[businessId]
 * 
 * Fetches all business data for the admin view
 */
export async function GET(
  request: Request,
  { params }: { params: { businessId: string } }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { businessId } = params;
    const supabase = await createServerClient();

    // Fetch business
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (businessError || !business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    // Fetch services
    const { data: services, error: servicesError } = await supabase
      .from('services')
      .select('id, category_id, name, description, duration_min, price_cents, pre_appointment_instructions, created_at')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    // Fetch staff-service associations
    const { data: staffServices, error: staffServicesError } = await supabase
      .from('staff_services')
      .select('service_id, staff_id')
      .eq('business_id', businessId);

    // Fetch service categories
    const { data: categories, error: categoriesError } = await supabase
      .from('service_categories')
      .select('*')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    // Fetch staff
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('*')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    // Fetch availability rules
    const { data: availability, error: availabilityError } = await supabase
      .from('availability_rules')
      .select('id, service_id, staff_id, weekday, start_time, end_time')
      .eq('business_id', businessId)
      .order('weekday', { ascending: true });

    // Fetch policies
    const { data: policies, error: policiesError } = await supabase
      .from('business_policies')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .maybeSingle();

    // Fetch notification templates
    const { data: notifications, error: notificationsError } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    // Fetch gift card settings
    const { data: giftCards, error: giftCardsError } = await supabase
      .from('gift_card_programs')
      .select('*')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .maybeSingle();

    // Build staff ID map for services
    const staffServiceMap: Record<string, string[]> = {};
    (staffServices || []).forEach((ss: any) => {
      if (!staffServiceMap[ss.service_id]) {
        staffServiceMap[ss.service_id] = [];
      }
      staffServiceMap[ss.service_id].push(ss.staff_id);
    });

    // Extract location data from business record
    const location = {
      timezone: business.timezone || 'America/New_York',
      phone: business.phone || '',
      supportEmail: business.support_email || '',
      website: business.website_url || '',
      addressLine1: business.street || '',
      addressLine2: '',
      city: business.city || '',
      stateProvince: business.state || '',
      postalCode: business.postal_code || '',
      country: business.country || '',
    };

    // Extract branding data from business record
    const branding = {
      primaryColor: business.brand_primary_color || '#5B64FF',
      secondaryColor: business.brand_secondary_color || undefined,
      logoUrl: business.logo_url || undefined,
      logoName: undefined,
      recommendedDimensions: { width: 960, height: 1280 },
    };

    // Extract website config
    const website = {
      subdomain: business.subdomain || '',
      status: 'reserved' as const,
      customDomain: undefined,
    };

    return NextResponse.json({
      business,
      services: services || [],
      categories: categories || [],
      staff: staff || [],
      availability: availability || [],
      policies: policies || null,
      notifications: notifications || [],
      giftCards: giftCards || null,
      location, // Include location data
      branding, // Include branding data
      website, // Include website config
      staffServiceMap, // Include the map for frontend transformation
      errors: {
        services: servicesError?.message,
        categories: categoriesError?.message,
        staff: staffError?.message,
        availability: availabilityError?.message,
        policies: policiesError?.message,
        notifications: notificationsError?.message,
        giftCards: giftCardsError?.message,
      }
    });
  } catch (error) {
    console.error('Error fetching business data:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

