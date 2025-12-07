import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import type { WebsiteConfig } from '@/lib/onboarding-types';

/**
 * GET /api/business/onboarding/step-2-website
 * 
 * Retrieves website/subdomain information
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
      .select('subdomain')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.error('[step-2-website] Error fetching website:', error);
      return NextResponse.json(
        { error: 'Failed to fetch website data' },
        { status: 500 }
      );
    }

    if (!business || !business.subdomain) {
      return NextResponse.json(
        { website: null },
        { status: 200 }
      );
    }

    return NextResponse.json({
      website: {
        subdomain: business.subdomain,
        status: 'reserved',
        customDomain: undefined,
      }
    });
  } catch (error) {
    console.error('[step-2-website] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/business/onboarding/step-2-website
 * 
 * Validates and reserves a subdomain for the business's booking site
 * 
 * Body: {
 *   subdomain: string
 *   status: "idle" | "validating" | "reserved" | "error"
 * }
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

    const body: WebsiteConfig = await request.json();
    const { subdomain, status } = body;

    // Validate subdomain format
    if (!subdomain || typeof subdomain !== 'string') {
      return NextResponse.json(
        { error: 'Subdomain is required' },
        { status: 400 }
      );
    }

    // Validate subdomain format: alphanumeric, hyphens, 3-63 chars
    const subdomainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
    if (!subdomainRegex.test(subdomain.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid subdomain format. Must be 3-63 characters, alphanumeric with hyphens only.' },
        { status: 400 }
      );
    }

    if (subdomain.length < 3 || subdomain.length > 63) {
      return NextResponse.json(
        { error: 'Subdomain must be between 3 and 63 characters' },
        { status: 400 }
      );
    }

    const normalizedSubdomain = subdomain.toLowerCase();

    const supabase = await createServerClient();

    // Get user's business
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, subdomain')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (businessError || !business) {
      return NextResponse.json(
        { error: 'Business not found. Complete step 1 first.' },
        { status: 404 }
      );
    }

    // Check if subdomain is already taken (by other businesses)
    const { data: existingSubdomain } = await supabase
      .from('businesses')
      .select('id, user_id')
      .eq('subdomain', normalizedSubdomain)
      .is('deleted_at', null)
      .single();

    if (existingSubdomain && existingSubdomain.user_id !== userId) {
      return NextResponse.json(
        { error: 'Subdomain is already taken', subdomain: normalizedSubdomain },
        { status: 409 }
      );
    }

    // Update business with subdomain
    const { data: updatedBusiness, error: updateError } = await supabase
      .from('businesses')
      .update({
        subdomain: normalizedSubdomain,
        updated_at: new Date().toISOString(),
      })
      .eq('id', business.id)
      .select('id, subdomain')
      .single();

    if (updateError) {
      console.error('Error updating subdomain:', updateError);
      return NextResponse.json(
        { error: 'Failed to update subdomain', details: updateError.message },
        { status: 500 }
      );
    }

    const bookingUrl = `https://${normalizedSubdomain}.tithi.com`;

    return NextResponse.json({
      success: true,
      subdomain: normalizedSubdomain,
      bookingUrl,
      message: 'Subdomain reserved successfully',
    });
  } catch (error) {
    console.error('Error in step-2-website:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


