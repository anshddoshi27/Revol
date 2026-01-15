import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import type { BrandingConfig, ButtonShape, FontFamily } from '@/lib/onboarding-types';

// Force dynamic rendering since this route uses cookies
export const dynamic = 'force-dynamic';

// Valid font families
const VALID_FONTS: FontFamily[] = [
  'Inter',
  'Poppins',
  'Playfair Display',
  'Montserrat',
  'Lora',
  'Roboto',
  'Open Sans',
  'Raleway',
  'Merriweather',
  'DM Sans',
];

// Valid button shapes
const VALID_BUTTON_SHAPES: ButtonShape[] = ['rounded', 'slightly-rounded', 'square'];

/**
 * GET /api/business/onboarding/step-5-branding
 * 
 * Retrieves branding information including colors, logo, font, button shape, hero image, and description
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
      .select(`
        brand_primary_color,
        brand_secondary_color,
        use_gradient,
        logo_url,
        brand_font_family,
        brand_button_shape,
        hero_image_url,
        booking_page_description
      `)
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

    const branding: BrandingConfig = {
      primaryColor: business.brand_primary_color || '#5B64FF',
      secondaryColor: business.brand_secondary_color || '#1a1a2e',
      useGradient: business.use_gradient ?? true,
      logoUrl: business.logo_url || undefined,
      logoName: undefined,
      fontFamily: (business.brand_font_family as FontFamily) || 'Inter',
      buttonShape: (business.brand_button_shape as ButtonShape) || 'rounded',
      heroImageUrl: business.hero_image_url || undefined,
      heroImageName: undefined,
      bookingPageDescription: business.booking_page_description || undefined,
      recommendedDimensions: {
        width: 200,
        height: 200
      }
    };

    return NextResponse.json({ branding });
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
 * Updates business branding (colors, logo, font, button shape, hero image, description)
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
    const { 
      primaryColor, 
      secondaryColor,
      useGradient,
      logoUrl,
      fontFamily,
      buttonShape,
      heroImageUrl,
      bookingPageDescription
    } = body;

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

    if (secondaryColor && !hexColorRegex.test(secondaryColor)) {
      return NextResponse.json(
        { error: 'secondaryColor must be a valid hex color code' },
        { status: 400 }
      );
    }

    // Validate font family if provided
    if (fontFamily && !VALID_FONTS.includes(fontFamily)) {
      return NextResponse.json(
        { error: `fontFamily must be one of: ${VALID_FONTS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate button shape if provided
    if (buttonShape && !VALID_BUTTON_SHAPES.includes(buttonShape)) {
      return NextResponse.json(
        { error: `buttonShape must be one of: ${VALID_BUTTON_SHAPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate description length if provided
    if (bookingPageDescription && bookingPageDescription.length > 500) {
      return NextResponse.json(
        { error: 'bookingPageDescription must be 500 characters or less' },
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

    // Build update object
    const updateData: Record<string, any> = {
      brand_primary_color: primaryColor,
      updated_at: new Date().toISOString(),
    };

    // Add optional fields if provided
    if (secondaryColor) {
      updateData.brand_secondary_color = secondaryColor;
    }

    // Always save useGradient (even if false) to ensure it's persisted
    // This ensures the preference is saved correctly whether true or false
    if (useGradient !== undefined) {
      updateData.use_gradient = useGradient;
    } else {
      // Default to true if not provided (backwards compatibility)
      updateData.use_gradient = true;
    }

    if (logoUrl !== undefined) {
      updateData.logo_url = logoUrl || null;
    }

    if (fontFamily) {
      updateData.brand_font_family = fontFamily;
    }

    if (buttonShape) {
      updateData.brand_button_shape = buttonShape;
    }

    if (heroImageUrl !== undefined) {
      updateData.hero_image_url = heroImageUrl || null;
    }

    if (bookingPageDescription !== undefined) {
      updateData.booking_page_description = bookingPageDescription || null;
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
