import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import type { BrandingConfig } from '@/lib/onboarding-types';

/**
 * GET /api/business/onboarding/step-5-branding
 * 
 * Retrieves branding information
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
      .select('brand_primary_color, brand_secondary_color, logo_url')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.error('[step-5-branding] Error fetching branding:', error);
      return NextResponse.json(
        { error: 'Failed to fetch branding data' },
        { status: 500 }
      );
    }

    if (!business) {
      return NextResponse.json(
        { branding: null },
        { status: 200 }
      );
    }

    return NextResponse.json({
      branding: {
        primaryColor: business.brand_primary_color || '#5B64FF',
        secondaryColor: business.brand_secondary_color || undefined,
        logoUrl: business.logo_url || undefined,
        logoName: undefined,
        recommendedDimensions: {
          width: 960,
          height: 1280
        }
      }
    });
  } catch (error) {
    console.error('[step-5-branding] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/business/onboarding/step-5-branding
 * 
 * Updates business branding (colors and logo)
 * 
 * Body: BrandingConfig type
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

    const body: BrandingConfig = await request.json();
    const { primaryColor, logoUrl } = body;

    // Validate required fields
    if (!primaryColor) {
      return NextResponse.json(
        { error: 'primaryColor is required' },
        { status: 400 }
      );
    }

    // Basic hex color validation
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexColorRegex.test(primaryColor)) {
      return NextResponse.json(
        { error: 'primaryColor must be a valid hex color code' },
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

    // Update business with branding info
    const updateData: any = {
      brand_primary_color: primaryColor,
      updated_at: new Date().toISOString(),
    };

    if (logoUrl) {
      updateData.logo_url = logoUrl;
    }

    // If secondary color is provided in body, include it
    if (body.secondaryColor) {
      updateData.brand_secondary_color = body.secondaryColor;
    }

    const { error: updateError } = await supabase
      .from('businesses')
      .update(updateData)
      .eq('id', business.id);

    if (updateError) {
      console.error('Error updating branding:', updateError);
      return NextResponse.json(
        { error: 'Failed to update branding', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Branding information saved successfully',
    });
  } catch (error) {
    console.error('Error in step-5-branding:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

