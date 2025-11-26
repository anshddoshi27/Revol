import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';
import type { StaffMember } from '@/lib/onboarding-types';

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
        { error: 'Business not found. Complete step 1 first.' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { staff } = body;

    if (!Array.isArray(staff)) {
      return NextResponse.json(
        { error: 'staff must be an array' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Soft delete existing staff (set deleted_at)
    const { error: deleteError } = await supabase
      .from('staff')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .is('deleted_at', null);

    if (deleteError) {
      console.error('Error soft-deleting existing staff:', deleteError);
      // Continue anyway - this might be first time
    }

    if (staff.length === 0) {
      return NextResponse.json({
        success: true,
        staffIds: [],
        message: 'Staff list cleared',
      });
    }

    // Insert new staff members
    const staffToInsert = staff.map((member: StaffMember) => ({
      user_id: userId,
      business_id: businessId,
      id: member.id && member.id.startsWith('uuid-') ? undefined : member.id, // Let DB generate if not a real UUID
      name: member.name,
      role: member.role || null,
      color: member.color || null,
      notes: null,
      is_active: member.active !== false, // Default to true
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { data: insertedStaff, error: insertError } = await supabase
      .from('staff')
      .upsert(staffToInsert, {
        onConflict: 'id',
        ignoreDuplicates: false,
      })
      .select('id');

    if (insertError) {
      console.error('Error inserting staff:', insertError);
      return NextResponse.json(
        { error: 'Failed to save staff', details: insertError.message },
        { status: 500 }
      );
    }

    const staffIds = insertedStaff?.map(s => s.id) || [];

    return NextResponse.json({
      success: true,
      staffIds,
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


