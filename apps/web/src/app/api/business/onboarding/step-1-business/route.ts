import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import type { BusinessBasics } from '@/lib/onboarding-types';

// Force dynamic rendering since this route uses cookies
export const dynamic = 'force-dynamic';

/**
 * GET /api/business/onboarding/step-1-business
 * 
 * Retrieves business basic information
 */
export async function GET(request: Request) {
  console.log('[step-1-business] API called - GET /api/business/onboarding/step-1-business');
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
      .select('id, name, dba_name, legal_name, industry')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.error('[step-1-business] Error fetching business:', error);
      return NextResponse.json(
        { error: 'Failed to fetch business data' },
        { status: 500 }
      );
    }

    if (!business) {
      return NextResponse.json(
        { business: null },
        { status: 200 }
      );
    }

    return NextResponse.json({
      business: {
        id: business.id,
        name: business.name,
        dba_name: business.dba_name,
        legal_name: business.legal_name,
        industry: business.industry,
      }
    });
  } catch (error) {
    console.error('[step-1-business] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
  console.log('[step-1-business] API called - PUT /api/business/onboarding/step-1-business');
  try {
    // Get authenticated user
    console.log('[step-1-business] Getting current user ID...');
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('[step-1-business] No user ID found - unauthorized');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    console.log('[step-1-business] User authenticated:', userId);

    // Parse request body
    const body: BusinessBasics = await request.json();
    const { businessName, doingBusinessAs, legalName, industry } = body;
    // Note: description is not stored in businesses table, it's only in local state

    // Validate required fields
    if (!businessName || !industry) {
      return NextResponse.json(
        { error: 'Missing required fields: businessName, industry' },
        { status: 400 }
      );
    }

    console.log('[step-1-business] Creating/updating business for user:', userId);
    
    let supabase = await createServerClient();

    // Check if business already exists for this user
    let { data: existingBusiness, error: checkError } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();
    
    // If RLS error, use service role as fallback
    if (checkError && (checkError.code === 'PGRST301' || checkError.message?.includes('No suitable key'))) {
      console.log('[step-1-business] RLS error, using service role for business lookup');
      const { createAdminClient } = await import('@/lib/db');
      supabase = createAdminClient();
      
      const { data: adminCheck, error: adminCheckError } = await supabase
        .from('businesses')
        .select('id')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .maybeSingle();
      
      if (adminCheckError) {
        console.error('[step-1-business] Error with admin client:', adminCheckError);
        return NextResponse.json(
          { error: 'Failed to check existing business', details: adminCheckError.message },
          { status: 500 }
        );
      }
      
      existingBusiness = adminCheck;
    } else if (checkError) {
      console.error('[step-1-business] Error checking existing business:', checkError);
      return NextResponse.json(
        { error: 'Failed to check existing business', details: checkError.message },
        { status: 500 }
      );
    }

    let businessId: string;

    if (existingBusiness) {
      console.log('[step-1-business] Updating existing business:', existingBusiness.id);
      // Update existing business
      const { data, error } = await supabase
        .from('businesses')
        .update({
          name: businessName,
          dba_name: doingBusinessAs || null,
          legal_name: legalName || null,
          industry: industry,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingBusiness.id)
        .select('id')
        .single();

      if (error) {
        console.error('[step-1-business] Error updating business:', error);
        // Try with service role if RLS error
        if (error.code === 'PGRST301' || error.message?.includes('No suitable key')) {
          const { createAdminClient } = await import('@/lib/db');
          const adminSupabase = createAdminClient();
          const { data: adminData, error: adminError } = await adminSupabase
            .from('businesses')
            .update({
              name: businessName,
              dba_name: doingBusinessAs || null,
              legal_name: legalName || null,
              industry: industry,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingBusiness.id)
            .select('id')
            .single();
          
          if (adminError) {
            console.error('[step-1-business] Error updating with admin client:', adminError);
            return NextResponse.json(
              { error: 'Failed to update business', details: adminError.message },
              { status: 500 }
            );
          }
          businessId = adminData.id;
        } else {
          return NextResponse.json(
            { error: 'Failed to update business', details: error.message },
            { status: 500 }
          );
        }
      } else {
        businessId = data.id;
        
        // Verify the update worked
        const { data: verifyBusiness } = await supabase
          .from('businesses')
          .select('name, industry')
          .eq('id', businessId)
          .single();
        
        console.log('[step-1-business] Update verified:', {
          name: verifyBusiness?.name,
          industry: verifyBusiness?.industry,
        });
      }
    } else {
      console.log('[step-1-business] Creating new business for user:', userId);
      console.log('[step-1-business] Business data:', {
        user_id: userId,
        name: businessName,
        dba_name: doingBusinessAs || null,
        legal_name: legalName || null,
        industry: industry,
      });
      // Create new business (draft - will be finalized on "Go Live")
      // Note: subdomain and timezone will be set in later steps
      const { data, error } = await supabase
        .from('businesses')
        .insert({
          user_id: userId,
          name: businessName,
          dba_name: doingBusinessAs || null,
          legal_name: legalName || null,
          industry: industry,
          subdomain: `temp-${Date.now()}`, // Temporary, will be updated in step 2
          timezone: 'America/New_York', // Default, will be updated in step 3
        })
        .select('id')
        .single();

      if (error) {
        console.error('[step-1-business] Error creating business:', error);
        // Try with service role if RLS error
        if (error.code === 'PGRST301' || error.message?.includes('No suitable key')) {
          console.log('[step-1-business] RLS error, using service role to create business');
          const { createAdminClient } = await import('@/lib/db');
          const adminSupabase = createAdminClient();
          const { data: adminData, error: adminError } = await adminSupabase
            .from('businesses')
            .insert({
              user_id: userId,
              name: businessName,
              dba_name: doingBusinessAs || null,
              legal_name: legalName || null,
              industry: industry,
              subdomain: `temp-${Date.now()}`,
              timezone: 'America/New_York',
            })
            .select('id')
            .single();
          
          if (adminError) {
            console.error('[step-1-business] Error creating with admin client:', adminError);
            return NextResponse.json(
              { error: 'Failed to create business', details: adminError.message },
              { status: 500 }
            );
          }
          console.log('[step-1-business] Business created with admin client:', adminData.id);
          console.log('[step-1-business] Verifying business was created for user:', userId);
          
          // Verify the business was created with correct user_id
          const { data: verifyBusiness, error: verifyError } = await adminSupabase
            .from('businesses')
            .select('id, name, user_id')
            .eq('id', adminData.id)
            .single();
          
          if (verifyBusiness) {
            console.log('[step-1-business] Verification - Business details:', {
              id: verifyBusiness.id,
              name: verifyBusiness.name,
              user_id: verifyBusiness.user_id,
              matches_current_user: verifyBusiness.user_id === userId,
            });
          } else {
            console.error('[step-1-business] Could not verify business creation:', verifyError);
          }
          
          businessId = adminData.id;
        } else {
          return NextResponse.json(
            { error: 'Failed to create business', details: error.message },
            { status: 500 }
          );
        }
      } else {
        console.log('[step-1-business] Business created successfully:', data.id);
        console.log('[step-1-business] Verifying business was created for user:', userId);
        
        // Verify the business was created with correct user_id
        const { data: verifyBusiness, error: verifyError } = await supabase
          .from('businesses')
          .select('id, name, user_id')
          .eq('id', data.id)
          .single();
        
        if (verifyBusiness) {
          console.log('[step-1-business] Verification - Business details:', {
            id: verifyBusiness.id,
            name: verifyBusiness.name,
            user_id: verifyBusiness.user_id,
            matches_current_user: verifyBusiness.user_id === userId,
          });
        } else {
          console.error('[step-1-business] Could not verify business creation:', verifyError);
          // Try with admin client for verification
          const { createAdminClient } = await import('@/lib/db');
          const adminSupabase = createAdminClient();
          const { data: adminVerify } = await adminSupabase
            .from('businesses')
            .select('id, name, user_id')
            .eq('id', data.id)
            .single();
          if (adminVerify) {
            console.log('[step-1-business] Admin verification - Business details:', {
              id: adminVerify.id,
              name: adminVerify.name,
              user_id: adminVerify.user_id,
              matches_current_user: adminVerify.user_id === userId,
            });
          }
        }
        
        businessId = data.id;
      }
    }

    // Final verification - make sure the business exists and belongs to this user
    const { createAdminClient } = await import('@/lib/db');
    const adminSupabase = createAdminClient();
    const { data: finalVerify, error: finalVerifyError } = await adminSupabase
      .from('businesses')
      .select('id, name, user_id')
      .eq('id', businessId)
      .single();
    
    if (finalVerify) {
      console.log('[step-1-business] FINAL VERIFICATION - Business exists:', {
        id: finalVerify.id,
        name: finalVerify.name,
        user_id: finalVerify.user_id,
        current_user_id: userId,
        matches: finalVerify.user_id === userId,
      });
      
      if (finalVerify.user_id !== userId) {
        console.error('[step-1-business] ERROR: Business user_id does not match current user!');
        console.error('[step-1-business] Business user_id:', finalVerify.user_id);
        console.error('[step-1-business] Current user_id:', userId);
      }
    } else {
      console.error('[step-1-business] ERROR: Could not verify business after creation!', finalVerifyError);
    }

    return NextResponse.json({
      success: true,
      businessId,
      message: 'Business information saved successfully',
      verification: finalVerify ? {
        id: finalVerify.id,
        name: finalVerify.name,
        user_id: finalVerify.user_id,
        matches_current_user: finalVerify.user_id === userId,
      } : null,
    });
  } catch (error) {
    console.error('Error in step-1-business:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}



