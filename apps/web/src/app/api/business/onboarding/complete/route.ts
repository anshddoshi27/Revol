import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';

/**
 * POST /api/business/onboarding/complete
 * 
 * Finalizes onboarding and marks business as active/ready to go live
 * 
 * This endpoint verifies all required data is present before going live
 */
export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      return NextResponse.json(
        { error: 'Business not found. Complete step 1 first.' },
        { status: 404 }
      );
    }

    const supabase = await createServerClient();

    // Get business and verify required fields
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    // Verify required onboarding data is present
    const missingFields: string[] = [];

    if (!business.name) missingFields.push('business name');
    if (!business.subdomain) missingFields.push('subdomain');
    if (!business.timezone) missingFields.push('timezone');
    if (!business.support_email) missingFields.push('support email');
    if (!business.stripe_connect_account_id) missingFields.push('Stripe Connect account');

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Check for minimum required data
    const { count: serviceCount } = await supabase
      .from('services')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .is('deleted_at', null);

    if (!serviceCount || serviceCount === 0) {
      return NextResponse.json(
        { error: 'At least one service is required' },
        { status: 400 }
      );
    }

    const { count: staffCount } = await supabase
      .from('staff')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .is('deleted_at', null);

    if (!staffCount || staffCount === 0) {
      return NextResponse.json(
        { error: 'At least one staff member is required' },
        { status: 400 }
      );
    }

    const { count: availabilityCount } = await supabase
      .from('availability_rules')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId);

    if (!availabilityCount || availabilityCount === 0) {
      return NextResponse.json(
        { error: 'Availability rules are required' },
        { status: 400 }
      );
    }

    const { count: policyCount } = await supabase
      .from('business_policies')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('is_active', true);

    if (!policyCount || policyCount === 0) {
      return NextResponse.json(
        { error: 'Business policies are required' },
        { status: 400 }
      );
    }

    // All checks passed - mark business as active
    // Ensure subscription_status is set (default to 'trial' if missing)
    const subscriptionStatus = business.subscription_status || 'trial';
    
    // Update business to ensure subscription_status is set
    const { error: updateError } = await supabase
      .from('businesses')
      .update({
        subscription_status: subscriptionStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', businessId);

    if (updateError) {
      console.error('Error updating subscription_status:', updateError);
      // Continue anyway - the status might already be set
    }

    const bookingUrl = `https://${business.subdomain}.tithi.com`;

    return NextResponse.json({
      success: true,
      businessId: business.id,
      bookingUrl,
      subscriptionStatus,
      message: 'Business is now live!',
    });
  } catch (error) {
    console.error('Error in onboarding complete:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


