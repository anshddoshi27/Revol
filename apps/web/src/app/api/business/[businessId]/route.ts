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

    // Fetch gift cards - use gift_cards table (not gift_card_programs)
    // The onboarding step-10-gift-cards route saves to gift_cards table
    const { data: giftCardsData, error: giftCardsError } = await supabase
      .from('gift_cards')
      .select('code, discount_type, initial_amount_cents, percent_off, expires_at, is_active')
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    // Transform gift cards data to match expected format
    let giftCards = null;
    if (giftCardsData && giftCardsData.length > 0) {
      const firstCard = giftCardsData[0];
      const amountType = firstCard.discount_type === 'percent' ? 'percent' : 'amount';
      const amountValue = amountType === 'amount' 
        ? (firstCard.initial_amount_cents || 0) / 100
        : (firstCard.percent_off || 0);
      const expirationEnabled = giftCardsData.some(card => card.expires_at !== null);
      
      giftCards = {
        enabled: true,
        amount_type: amountType,
        amount_value: amountValue,
        expiration_enabled: expirationEnabled,
        generated_codes: giftCardsData.map(card => card.code),
      };
    }

    // Fetch bookings with related data
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id,
        status,
        start_at,
        end_at,
        duration_min,
        price_cents,
        final_price_cents,
        service_id,
        staff_id,
        customer_id,
        gift_card_id,
        gift_card_amount_applied_cents,
        payment_status,
        last_money_action,
        created_at,
        updated_at,
        services:service_id (
          id,
          name,
          category_id
        ),
        staff:staff_id (
          id,
          name,
          color
        ),
        customers:customer_id (
          id,
          name,
          email,
          phone,
          created_at
        )
      `)
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('start_at', { ascending: false });

    if (bookingsError) {
      console.error('[business-api] Error fetching bookings:', bookingsError);
    } else {
      console.log(`[business-api] Fetched ${bookings?.length || 0} bookings for business ${businessId}`);
    }

    // Fetch booking payments
    const bookingIds = (bookings || []).map((b: any) => b.id);
    const { data: bookingPayments, error: paymentsError } = bookingIds.length > 0
      ? await supabase
          .from('booking_payments')
          .select('*')
          .in('booking_id', bookingIds)
          .is('deleted_at', null)
          .order('created_at', { ascending: true })
      : { data: [], error: null };

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
      bookings: bookings || [],
      bookingPayments: bookingPayments || [],
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
        bookings: bookingsError?.message,
        payments: paymentsError?.message,
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

