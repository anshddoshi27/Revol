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
  console.log('[onboarding-complete] API called - POST /api/business/onboarding/complete');
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('[onboarding-complete] No user ID found - authentication failed');
      return NextResponse.json(
        { error: 'Unauthorized - Please log in and try again. Session may have expired.' },
        { status: 401 }
      );
    }
    
    console.log('[onboarding-complete] User authenticated:', userId);

    let businessId = await getCurrentBusinessId();
    
    // If no business found, try with service role to find any business for this user
    if (!businessId) {
      console.log('[onboarding-complete] No business found with regular client, trying with service role');
      const { createAdminClient } = await import('@/lib/db');
      const adminSupabase = createAdminClient();
      
      const { data: businesses, error: adminError } = await adminSupabase
        .from('businesses')
        .select('id, name, user_id, created_at')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      
      if (!adminError && businesses && businesses.length > 0) {
        businessId = businesses[0].id;
        console.log('[onboarding-complete] Found business with admin client:', businessId, businesses[0].name);
        console.log('[onboarding-complete] Total businesses found for user:', businesses.length);
      } else {
        console.error('[onboarding-complete] No business found even with admin client for user:', userId);
        
        // Get all businesses for debugging
        const { data: allBusinesses } = await adminSupabase
          .from('businesses')
          .select('id, name, user_id, created_at')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(10);
        
        console.error('[onboarding-complete] DIAGNOSTIC - All businesses in database:', allBusinesses);
        console.error('[onboarding-complete] Current user ID:', userId);
        console.error('[onboarding-complete] User ID type:', typeof userId);
        
        return NextResponse.json(
          { 
            error: 'Business not found. Please complete step 1 (Business Information) first and ensure it saves successfully.',
            details: `No business found for user ${userId}. Please go back to step 1 and click "Save & continue".`,
            diagnostic: {
              userId,
              businessesFound: allBusinesses?.length || 0,
              allBusinessUserIds: allBusinesses?.map(b => b.user_id) || []
            }
          },
          { status: 404 }
        );
      }
    } else {
      console.log('[onboarding-complete] Business ID found:', businessId);
    }

    let supabase = await createServerClient();

    // Get business and verify required fields
    let { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    // If RLS error, try with service role
    if (businessError && (businessError.code === 'PGRST301' || businessError.message?.includes('No suitable key'))) {
      console.log('[onboarding-complete] RLS error on business query, using service role');
      const { createAdminClient } = await import('@/lib/db');
      supabase = createAdminClient();
      
      const { data: adminBusiness, error: adminBusinessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();
      
      if (adminBusinessError || !adminBusiness) {
        console.error('[onboarding-complete] Business not found even with admin client:', adminBusinessError);
        return NextResponse.json(
          { error: 'Business not found' },
          { status: 404 }
        );
      }
      
      business = adminBusiness;
      businessError = null;
    } else if (businessError || !business) {
      console.error('[onboarding-complete] Business not found:', businessError);
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    console.log('[onboarding-complete] Business found:', {
      id: business.id,
      name: business.name || '(EMPTY)',
      subdomain: business.subdomain || '(EMPTY)',
      timezone: business.timezone || '(EMPTY)',
      support_email: business.support_email || '(EMPTY)',
      stripe_connect_account_id: business.stripe_connect_account_id ? 'present' : 'missing',
      subscription_status: business.subscription_status,
      notifications_enabled: business.notifications_enabled,
      stripe_subscription_id: business.stripe_subscription_id ? 'present' : 'missing',
    });

    // Verify required onboarding data is present
    const missingFields: string[] = [];

    if (!business.name || business.name.trim().length === 0) {
      missingFields.push('business name');
      console.error('[onboarding-complete] Business name is missing or empty:', business.name);
    }
    if (!business.subdomain || business.subdomain.trim().length === 0 || business.subdomain.startsWith('temp-')) {
      missingFields.push('subdomain');
      console.error('[onboarding-complete] Subdomain is missing or temporary:', business.subdomain);
    }
    if (!business.timezone || business.timezone.trim().length === 0) {
      missingFields.push('timezone');
      console.error('[onboarding-complete] Timezone is missing or empty:', business.timezone);
    }
    if (!business.support_email || business.support_email.trim().length === 0) {
      missingFields.push('support email');
      console.error('[onboarding-complete] Support email is missing or empty:', business.support_email);
    }
    if (!business.stripe_connect_account_id) {
      missingFields.push('Stripe Connect account');
      console.error('[onboarding-complete] Stripe Connect account ID is missing');
    }

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Check for minimum required data (with RLS fallback)
    let { count: serviceCount, error: serviceError } = await supabase
      .from('services')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .is('deleted_at', null);

    if (serviceError && (serviceError.code === 'PGRST301' || serviceError.message?.includes('No suitable key'))) {
      const { createAdminClient } = await import('@/lib/db');
      const adminSupabase = createAdminClient();
      const { count: adminServiceCount } = await adminSupabase
        .from('services')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .is('deleted_at', null);
      serviceCount = adminServiceCount;
    }

    if (!serviceCount || serviceCount === 0) {
      console.warn('[onboarding-complete] No services found for business:', businessId);
      return NextResponse.json(
        { error: 'At least one service is required' },
        { status: 400 }
      );
    }

    let { count: staffCount, error: staffError } = await supabase
      .from('staff')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .is('deleted_at', null);

    if (staffError && (staffError.code === 'PGRST301' || staffError.message?.includes('No suitable key'))) {
      const { createAdminClient } = await import('@/lib/db');
      const adminSupabase = createAdminClient();
      const { count: adminStaffCount } = await adminSupabase
        .from('staff')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .is('deleted_at', null);
      staffCount = adminStaffCount;
    }

    if (!staffCount || staffCount === 0) {
      console.warn('[onboarding-complete] No staff found for business:', businessId);
      return NextResponse.json(
        { error: 'At least one staff member is required' },
        { status: 400 }
      );
    }

    let { count: availabilityCount, error: availabilityError } = await supabase
      .from('availability_rules')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId);

    if (availabilityError && (availabilityError.code === 'PGRST301' || availabilityError.message?.includes('No suitable key'))) {
      const { createAdminClient } = await import('@/lib/db');
      const adminSupabase = createAdminClient();
      const { count: adminAvailabilityCount } = await adminSupabase
        .from('availability_rules')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId);
      availabilityCount = adminAvailabilityCount;
    }

    if (!availabilityCount || availabilityCount === 0) {
      console.warn('[onboarding-complete] No availability rules found for business:', businessId);
      return NextResponse.json(
        { error: 'Availability rules are required' },
        { status: 400 }
      );
    }

    let { count: policyCount, error: policyError } = await supabase
      .from('business_policies')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('is_active', true);

    if (policyError && (policyError.code === 'PGRST301' || policyError.message?.includes('No suitable key'))) {
      const { createAdminClient } = await import('@/lib/db');
      const adminSupabase = createAdminClient();
      const { count: adminPolicyCount } = await adminSupabase
        .from('business_policies')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('is_active', true);
      policyCount = adminPolicyCount;
    }

    if (!policyCount || policyCount === 0) {
      console.warn('[onboarding-complete] No policies found for business:', businessId);
      return NextResponse.json(
        { error: 'Business policies are required' },
        { status: 400 }
      );
    }

    console.log('[onboarding-complete] Validation passed:', {
      services: serviceCount,
      staff: staffCount,
      availability: availabilityCount,
      policies: policyCount,
    });

    // All checks passed - mark business as active
    // Ensure subscription_status is set (default to 'trial' if missing)
    // If payment setup was completed, subscription_status should already be set
    const subscriptionStatus = business.subscription_status || 'trial';
    
    console.log('[onboarding-complete] Finalizing onboarding with subscription status:', subscriptionStatus);
    console.log('[onboarding-complete] Plan type:', business.notifications_enabled ? 'Pro ($21.99/month)' : 'Basic ($11.99/month)');
    
    // Update business to ensure subscription_status is set and mark as ready
    let { error: updateError } = await supabase
      .from('businesses')
      .update({
        subscription_status: subscriptionStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', businessId);

    // If RLS error, try with service role
    if (updateError && (updateError.code === 'PGRST301' || updateError.message?.includes('No suitable key'))) {
      console.log('[onboarding-complete] RLS error on update, using service role');
      const { createAdminClient } = await import('@/lib/db');
      const adminSupabase = createAdminClient();
      
      const { error: adminUpdateError } = await adminSupabase
        .from('businesses')
        .update({
          subscription_status: subscriptionStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', businessId);
      
      if (adminUpdateError) {
        console.error('[onboarding-complete] Error updating with admin client:', adminUpdateError);
        return NextResponse.json(
          { error: 'Failed to update business status', details: adminUpdateError.message },
          { status: 500 }
        );
      }
    } else if (updateError) {
      console.error('[onboarding-complete] Error updating subscription_status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update business status', details: updateError.message },
        { status: 500 }
      );
    }

    console.log('[onboarding-complete] Business successfully finalized:', {
      businessId: business.id,
      subscriptionStatus,
      planType: business.notifications_enabled ? 'Pro' : 'Basic',
    });

    const bookingUrl = `https://${business.subdomain}.main.tld`;

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


