import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';
import type { StaffMember } from '@/lib/onboarding-types';

/**
 * GET /api/business/onboarding/step-4-team
 * 
 * Retrieves staff members
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

    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      return NextResponse.json(
        { staff: [] },
        { status: 200 }
      );
    }

    const supabase = await createServerClient();
    const { data: staff, error } = await supabase
      .from('staff')
      .select('id, name, role, color, is_active, image_url, description, review, reviewer_name')
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[step-4-team] Error fetching staff:', error);
      return NextResponse.json(
        { error: 'Failed to fetch staff data' },
        { status: 500 }
      );
    }

    const staffMembers: StaffMember[] = (staff || []).map(s => ({
      id: s.id,
      name: s.name,
      role: s.role || '',
      color: s.color || undefined,
      active: s.is_active !== false,
      imageUrl: s.image_url || undefined,
      description: s.description || undefined,
      review: s.review || undefined,
      reviewerName: s.reviewer_name || undefined,
    }));

    return NextResponse.json({
      staff: staffMembers
    });
  } catch (error) {
    console.error('[step-4-team] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/business/onboarding/step-4-team
 * 
 * Updates staff members for the business
 * 
 * Body: {
 *   staff: StaffMember[]
 * }
 */
export async function PUT(request: Request) {
  console.log('[step-4-team] API called - PUT /api/business/onboarding/step-4-team');
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('[step-4-team] No user ID found - unauthorized');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    console.log('[step-4-team] User authenticated:', userId);

    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      console.error('[step-4-team] Business not found for user:', userId);
      return NextResponse.json(
        { error: 'Business not found. Complete step 1 first.' },
        { status: 404 }
      );
    }
    console.log('[step-4-team] Business ID:', businessId);

    const body = await request.json();
    const { staff } = body;

    if (!Array.isArray(staff)) {
      console.error('[step-4-team] Invalid request body - staff is not an array');
      return NextResponse.json(
        { error: 'staff must be an array' },
        { status: 400 }
      );
    }

    console.log('[step-4-team] Saving staff members:', staff.length);
    
    let supabase = await createServerClient();

    // Soft delete existing staff (set deleted_at)
    let { error: deleteError } = await supabase
      .from('staff')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .is('deleted_at', null);

    // If RLS error, use service role as fallback
    if (deleteError && (deleteError.code === 'PGRST301' || deleteError.message?.includes('No suitable key'))) {
      console.log('[step-4-team] RLS error on delete, using service role');
      const { createAdminClient } = await import('@/lib/db');
      supabase = createAdminClient();
      
      const { error: adminDeleteError } = await supabase
        .from('staff')
        .update({ deleted_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('business_id', businessId)
        .is('deleted_at', null);
      
      if (adminDeleteError) {
        console.error('[step-4-team] Error soft-deleting with admin client:', adminDeleteError);
        // Continue anyway - this might be first time
      }
    } else if (deleteError) {
      console.error('[step-4-team] Error soft-deleting existing staff:', deleteError);
      // Continue anyway - this might be first time
    }

    if (staff.length === 0) {
      return NextResponse.json({
        success: true,
        staffIds: [],
        message: 'Staff list cleared',
      });
    }

    // Helper function to check if a string is a valid UUID
    const isValidUUID = (str: string): boolean => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    // Insert new staff members
    const staffToInsert = staff.map((member: StaffMember) => {
      // Only include id if it's a valid UUID, otherwise let DB generate it
      const staffData: any = {
        user_id: userId,
        business_id: businessId,
        name: member.name,
        role: member.role || null,
        color: member.color || null,
        notes: null,
        is_active: member.active !== false, // Default to true
        image_url: member.imageUrl || null,
        description: member.description || null,
        review: member.review || null,
        reviewer_name: member.reviewerName || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      // Only include id if it's a valid UUID (from database), not a temporary frontend ID
      if (member.id && isValidUUID(member.id)) {
        staffData.id = member.id;
      }
      // If member.id exists but is not a valid UUID (like "staff-xxx"), omit it and let DB generate
      
      return staffData;
    });

    console.log('[step-4-team] Inserting staff members:', staffToInsert.map(s => ({ name: s.name, hasId: !!s.id })));
    
    let { data: insertedStaff, error: insertError } = await supabase
      .from('staff')
      .upsert(staffToInsert, {
        onConflict: 'id',
        ignoreDuplicates: false,
      })
      .select('id, name, role, color, is_active, image_url, description, review, reviewer_name');

    // If RLS error, try with service role
    if (insertError && (insertError.code === 'PGRST301' || insertError.message?.includes('No suitable key'))) {
      console.log('[step-4-team] RLS error on insert, using service role');
      const { createAdminClient } = await import('@/lib/db');
      const adminSupabase = createAdminClient();
      
      const { data: adminInserted, error: adminInsertError } = await adminSupabase
        .from('staff')
        .upsert(staffToInsert, {
          onConflict: 'id',
          ignoreDuplicates: false,
        })
        .select('id, name, role, color, is_active, image_url, description, review, reviewer_name');
      
      if (adminInsertError) {
        console.error('[step-4-team] Error inserting with admin client:', adminInsertError);
        return NextResponse.json(
          { error: 'Failed to save staff', details: adminInsertError.message },
          { status: 500 }
        );
      }
      
      insertedStaff = adminInserted;
    } else if (insertError) {
      console.error('[step-4-team] Error inserting staff:', insertError);
      return NextResponse.json(
        { error: 'Failed to save staff', details: insertError.message },
        { status: 500 }
      );
    }

    const staffIds = insertedStaff?.map(s => s.id) || [];
    
    // Map database records to StaffMember format for frontend
    const staffMembers: StaffMember[] = (insertedStaff || []).map(s => ({
      id: s.id,
      name: s.name,
      role: s.role || '',
      color: s.color || undefined,
      active: s.is_active !== false,
      imageUrl: s.image_url || undefined,
      description: s.description || undefined,
      review: s.review || undefined,
      reviewerName: s.reviewer_name || undefined,
    }));
    
    console.log('[step-4-team] Successfully saved staff:', staffIds.length, 'members');
    console.log('[step-4-team] Returning staff with real database IDs:', staffMembers.map(s => ({ id: s.id, name: s.name })));

    return NextResponse.json({
      success: true,
      staffIds,
      staff: staffMembers, // Return full staff objects with real database IDs
      message: `Saved ${staffIds.length} staff member(s)`,
    });
  } catch (error) {
    console.error('Error in step-4-team:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


