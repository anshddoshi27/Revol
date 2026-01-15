import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';

// Force dynamic rendering since this route uses headers and cookies
export const dynamic = 'force-dynamic';

/**
 * GET /api/debug/business-data
 * 
 * Diagnostic endpoint to check what data is actually saved in the database
 */
export async function GET(request: Request) {
  try {
    // Try multiple methods to get user ID
    let userId = await getCurrentUserId();
    
    // If that fails, try direct Supabase client
    if (!userId) {
      try {
        const supabase = await createServerClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (user && !userError) {
          userId = user.id;
          console.log('[debug/business-data] Got user ID from direct Supabase client:', userId);
        }
      } catch (error) {
        console.error('[debug/business-data] Error getting user from Supabase:', error);
      }
    }
    
    if (!userId) {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'Could not get user ID. Make sure you are logged in.',
          hint: 'Try logging out and back in, or check if your session is valid.'
        },
        { status: 401 }
      );
    }

    console.log('[debug/business-data] User ID:', userId);
    
    // Try to get business ID
    let businessId = await getCurrentBusinessId();
    
    // If that fails, try to find any business for this user
    if (!businessId) {
      try {
        const supabase = await createServerClient();
        const { data: business, error: businessError } = await supabase
          .from('businesses')
          .select('id')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .maybeSingle();
        
        if (businessError && (businessError.code === 'PGRST301' || businessError.message?.includes('No suitable key'))) {
          const { createAdminClient } = await import('@/lib/db');
          const adminSupabase = createAdminClient();
          const { data: adminBusiness } = await adminSupabase
            .from('businesses')
            .select('id')
            .eq('user_id', userId)
            .is('deleted_at', null)
            .maybeSingle();
          businessId = adminBusiness?.id || null;
        } else if (business) {
          businessId = business.id;
        }
      } catch (error) {
        console.error('[debug/business-data] Error finding business:', error);
      }
    }
    
    if (!businessId) {
      return NextResponse.json(
        { 
          error: 'No business found',
          userId,
          message: 'No business found for this user. Complete step 1 of onboarding first.'
        },
        { status: 404 }
      );
    }
    
    console.log('[debug/business-data] Business ID:', businessId);

    const supabase = await createServerClient();
    
    // Try with regular client first
    let { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    // If RLS error, try with service role
    if (businessError && (businessError.code === 'PGRST301' || businessError.message?.includes('No suitable key'))) {
      const { createAdminClient } = await import('@/lib/db');
      const adminSupabase = createAdminClient();
      const { data: adminBusiness } = await adminSupabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();
      business = adminBusiness;
    }

    if (!business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      businessId,
      userId,
      business: {
        id: business.id,
        name: business.name || '(empty)',
        subdomain: business.subdomain || '(empty)',
        timezone: business.timezone || '(empty)',
        support_email: business.support_email || '(empty)',
        stripe_connect_account_id: business.stripe_connect_account_id || '(empty)',
        phone: business.phone || '(empty)',
        street: business.street || '(empty)',
        city: business.city || '(empty)',
        state: business.state || '(empty)',
        postal_code: business.postal_code || '(empty)',
        country: business.country || '(empty)',
      },
      validation: {
        hasName: !!business.name && business.name.trim().length > 0,
        hasSubdomain: !!business.subdomain && business.subdomain.trim().length > 0 && !business.subdomain.startsWith('temp-'),
        hasTimezone: !!business.timezone && business.timezone.trim().length > 0,
        hasSupportEmail: !!business.support_email && business.support_email.trim().length > 0,
        hasStripeConnect: !!business.stripe_connect_account_id,
      },
      missingFields: [
        (!business.name || business.name.trim().length === 0) && 'business name',
        (!business.subdomain || business.subdomain.startsWith('temp-')) && 'subdomain',
        (!business.timezone || business.timezone.trim().length === 0) && 'timezone',
        (!business.support_email || business.support_email.trim().length === 0) && 'support email',
        (!business.stripe_connect_account_id) && 'Stripe Connect account',
      ].filter(Boolean),
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

