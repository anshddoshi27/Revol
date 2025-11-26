import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import type { BusinessBasics } from '@/lib/onboarding-types';

/**
 * PUT /api/business/onboarding/step-1-business
 * 
 * Saves business basic information (step 1 of onboarding)
 * 
 * Body: {
 *   businessName: string
 *   description: string
 *   doingBusinessAs: string
 *   legalName: string
 *   industry: string
 * }
 */
export async function PUT(request: Request) {
  try {
    // Get authenticated user
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: BusinessBasics = await request.json();
    const { businessName, description, doingBusinessAs, legalName, industry } = body;

    // Validate required fields
    if (!businessName || !industry) {
      return NextResponse.json(
        { error: 'Missing required fields: businessName, industry' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Check if business already exists for this user
    const { data: existingBusiness } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    let businessId: string;

    if (existingBusiness) {
      // Update existing business
      const { data, error } = await supabase
        .from('businesses')
        .update({
          name: businessName,
          description: description || null,
          dba_name: doingBusinessAs || null,
          legal_name: legalName || null,
          industry: industry,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingBusiness.id)
        .select('id')
        .single();

      if (error) {
        console.error('Error updating business:', error);
        return NextResponse.json(
          { error: 'Failed to update business', details: error.message },
          { status: 500 }
        );
      }

      businessId = data.id;
    } else {
      // Create new business (draft - will be finalized on "Go Live")
      // Note: subdomain and timezone will be set in later steps
      const { data, error } = await supabase
        .from('businesses')
        .insert({
          user_id: userId,
          name: businessName,
          description: description || null,
          dba_name: doingBusinessAs || null,
          legal_name: legalName || null,
          industry: industry,
          subdomain: `temp-${Date.now()}`, // Temporary, will be updated in step 2
          timezone: 'America/New_York', // Default, will be updated in step 3
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating business:', error);
        return NextResponse.json(
          { error: 'Failed to create business', details: error.message },
          { status: 500 }
        );
      }

      businessId = data.id;
    }

    return NextResponse.json({
      success: true,
      businessId,
      message: 'Business information saved successfully',
    });
  } catch (error) {
    console.error('Error in step-1-business:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}



