import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import type { LocationContacts } from '@/lib/onboarding-types';

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
      console.error('Error updating location:', updateError);
      return NextResponse.json(
        { error: 'Failed to update location', details: updateError.message },
        { status: 500 }
      );
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


