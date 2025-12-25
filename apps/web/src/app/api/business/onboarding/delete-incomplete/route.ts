import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';

/**
 * DELETE /api/business/onboarding/delete-incomplete
 * 
 * Deletes an incomplete business (one that hasn't been finalized with subscription_status)
 * This is called when a user exits onboarding before completion
 */
export async function DELETE(request: Request) {
  console.log('[delete-incomplete] API called - DELETE /api/business/onboarding/delete-incomplete');
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('[delete-incomplete] No user ID found - unauthorized');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[delete-incomplete] User authenticated:', userId);

    let businessId = await getCurrentBusinessId();
    
    // If no business found with regular client, try with service role
    if (!businessId) {
      console.log('[delete-incomplete] No business found with regular client, trying with service role');
      const { createAdminClient } = await import('@/lib/db');
      const adminSupabase = createAdminClient();
      
      const { data: businesses, error: adminError } = await adminSupabase
        .from('businesses')
        .select('id, name, subscription_status, user_id, created_at')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      
      if (!adminError && businesses && businesses.length > 0) {
        businessId = businesses[0].id;
        console.log('[delete-incomplete] Found business with admin client:', businessId);
      } else {
        console.log('[delete-incomplete] No business found for user:', userId);
        // No business to delete, return success
        return NextResponse.json({
          success: true,
          message: 'No incomplete business found to delete'
        });
      }
    }

    let supabase = await createServerClient();

    // Get business to check if it's incomplete
    let { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, subscription_status, subdomain')
      .eq('id', businessId)
      .single();

    // If RLS error, try with service role
    if (businessError && (businessError.code === 'PGRST301' || businessError.message?.includes('No suitable key'))) {
      console.log('[delete-incomplete] RLS error on business query, using service role');
      const { createAdminClient } = await import('@/lib/db');
      supabase = createAdminClient();
      
      const { data: adminBusiness, error: adminBusinessError } = await supabase
        .from('businesses')
        .select('id, name, subscription_status, subdomain')
        .eq('id', businessId)
        .single();
      
      if (adminBusinessError || !adminBusiness) {
        console.error('[delete-incomplete] Business not found even with admin client:', adminBusinessError);
        return NextResponse.json(
          { error: 'Business not found' },
          { status: 404 }
        );
      }
      
      business = adminBusiness;
      businessError = null;
    } else if (businessError || !business) {
      console.error('[delete-incomplete] Business not found:', businessError);
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    // Only delete if business is incomplete (no subscription_status or still has temp subdomain)
    // A business is considered incomplete if:
    // 1. subscription_status is null (not finalized)
    // 2. OR subdomain starts with 'temp-' (temporary placeholder)
    const isIncomplete = !business.subscription_status || 
                         business.subdomain?.startsWith('temp-') ||
                         !business.subdomain;

    if (!isIncomplete) {
      console.log('[delete-incomplete] Business is already completed, not deleting:', {
        id: business.id,
        subscription_status: business.subscription_status,
        subdomain: business.subdomain
      });
      return NextResponse.json({
        success: false,
        message: 'Business is already completed and cannot be deleted'
      });
    }

    console.log('[delete-incomplete] Deleting incomplete business:', {
      id: business.id,
      name: business.name,
      subscription_status: business.subscription_status,
      subdomain: business.subdomain
    });

    // Soft delete the business (set deleted_at)
    let { error: deleteError } = await supabase
      .from('businesses')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', businessId);

    // If RLS error, try with service role
    if (deleteError && (deleteError.code === 'PGRST301' || deleteError.message?.includes('No suitable key'))) {
      console.log('[delete-incomplete] RLS error on delete, using service role');
      const { createAdminClient } = await import('@/lib/db');
      const adminSupabase = createAdminClient();
      
      const { error: adminDeleteError } = await adminSupabase
        .from('businesses')
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', businessId);
      
      if (adminDeleteError) {
        console.error('[delete-incomplete] Error deleting with admin client:', adminDeleteError);
        return NextResponse.json(
          { error: 'Failed to delete business', details: adminDeleteError.message },
          { status: 500 }
        );
      }
    } else if (deleteError) {
      console.error('[delete-incomplete] Error deleting business:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete business', details: deleteError.message },
        { status: 500 }
      );
    }

    console.log('[delete-incomplete] Business successfully deleted:', businessId);

    return NextResponse.json({
      success: true,
      message: 'Incomplete business deleted successfully',
      businessId
    });
  } catch (error) {
    console.error('[delete-incomplete] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}




