import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import type { LocationContacts } from '@/lib/onboarding-types';

/**
 * GET /api/business/onboarding/step-3-location
 * 
 * Retrieves location and contact information
 */
export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createServerClient();
    const { data: business, error } = await supabase
      .from('businesses')
      .select('timezone, phone, support_email, website_url, street, city, state, postal_code, country')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.error('[step-3-location] Error fetching location:', error);
      return NextResponse.json(
        { error: 'Failed to fetch location data' },
        { status: 500 }
      );
    }

    if (!business) {
      return NextResponse.json(
        { location: null },
        { status: 200 }
      );
    }

    return NextResponse.json({
      location: {
        timezone: business.timezone || '',
        phone: business.phone || '',
        supportEmail: business.support_email || '',
        website: business.website_url || '',
        addressLine1: business.street || '',
        addressLine2: '',
        city: business.city || '',
        stateProvince: business.state || '',
        postalCode: business.postal_code || '',
        country: business.country || '',
      }
    });
  } catch (error) {
    console.error('[step-3-location] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/business/onboarding/step-3-location
 * 
 * Updates business location and contact information
 * 
 * Body: LocationContacts type
 */
export async function PUT(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: LocationContacts = await request.json();
    const {
      timezone,
      phone,
      supportEmail,
      website,
      addressLine1,
      addressLine2,
      city,
      stateProvince,
      postalCode,
      country,
    } = body;

    // Validate required fields
    if (!timezone || !phone || !supportEmail || !addressLine1 || !city || !stateProvince || !postalCode || !country) {
      return NextResponse.json(
        { error: 'Missing required fields: timezone, phone, supportEmail, addressLine1, city, stateProvince, postalCode, country' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(supportEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format for supportEmail' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Get user's business
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (businessError || !business) {
      return NextResponse.json(
        { error: 'Business not found. Complete step 1 first.' },
        { status: 404 }
      );
    }

    // Update business with location and contact info
    const { error: updateError } = await supabase
      .from('businesses')
      .update({
        timezone,
        phone,
        support_email: supportEmail,
        website_url: website || null,
        street: addressLine1,
        city,
        state: stateProvince,
        postal_code: postalCode,
        country,
        updated_at: new Date().toISOString(),
      })
      .eq('id', business.id);

    if (updateError) {
      console.error('[step-3-location] Error updating location:', updateError);
      
      // Try with service role if RLS error
      if (updateError.code === 'PGRST301' || updateError.message?.includes('No suitable key')) {
        console.log('[step-3-location] RLS error, trying with service role');
        const { createAdminClient } = await import('@/lib/db');
        const adminSupabase = createAdminClient();
        
        const { error: adminUpdateError } = await adminSupabase
          .from('businesses')
          .update({
            timezone,
            phone,
            support_email: supportEmail,
            website_url: website || null,
            street: addressLine1,
            city,
            state: stateProvince,
            postal_code: postalCode,
            country,
            updated_at: new Date().toISOString(),
          })
          .eq('id', business.id);
        
        if (adminUpdateError) {
          console.error('[step-3-location] Error updating with admin client:', adminUpdateError);
          return NextResponse.json(
            { error: 'Failed to update location', details: adminUpdateError.message },
            { status: 500 }
          );
        }
        
        // Verify the update worked
        const { data: verifyBusiness } = await adminSupabase
          .from('businesses')
          .select('support_email, timezone, phone')
          .eq('id', business.id)
          .single();
        
        console.log('[step-3-location] Update verified:', {
          support_email: verifyBusiness?.support_email,
          timezone: verifyBusiness?.timezone,
          phone: verifyBusiness?.phone,
        });
      } else {
        return NextResponse.json(
          { error: 'Failed to update location', details: updateError.message },
          { status: 500 }
        );
      }
    } else {
      // Verify the update worked
      const { data: verifyBusiness } = await supabase
        .from('businesses')
        .select('support_email, timezone, phone')
        .eq('id', business.id)
        .single();
      
      console.log('[step-3-location] Update successful:', {
        support_email: verifyBusiness?.support_email,
        timezone: verifyBusiness?.timezone,
        phone: verifyBusiness?.phone,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Location and contact information saved successfully',
    });
  } catch (error) {
    console.error('Error in step-3-location:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


