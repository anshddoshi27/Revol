import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';
import { getCurrentUserId, getCurrentBusinessId } from '@/lib/auth';
import type { ServiceAvailability } from '@/lib/onboarding-types';

// Map day names to weekday numbers (Sunday = 0)
const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * PUT /api/business/onboarding/step-7-availability
 * 
 * Updates availability rules for services and staff
 * 
 * Body: {
 *   availability: ServiceAvailability[]
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
    const { availability } = body;

    if (!Array.isArray(availability)) {
      return NextResponse.json(
        { error: 'availability must be an array' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Delete existing availability rules (hard delete for this table)
    const { error: deleteError } = await supabase
      .from('availability_rules')
      .delete()
      .eq('user_id', userId)
      .eq('business_id', businessId);

    if (deleteError) {
      console.error('Error deleting availability rules:', deleteError);
      // Continue anyway
    }

    if (availability.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Availability cleared',
      });
    }

    const rulesToInsert: any[] = [];

    // Process each service availability
    for (const serviceAvail of availability) {
      const { serviceId, staff } = serviceAvail;

      if (!serviceId || !Array.isArray(staff)) {
        console.warn('Skipping invalid service availability:', serviceAvail);
        continue;
      }

      // Process each staff member's availability
      for (const staffAvail of staff) {
        const { staffId, slots } = staffAvail;

        if (!staffId || !Array.isArray(slots)) {
          console.warn('Skipping invalid staff availability:', staffAvail);
          continue;
        }

        // Process each time slot
        for (const slot of slots) {
          const { day, startTime, endTime } = slot;

          if (!day || !startTime || !endTime) {
            console.warn('Skipping invalid slot:', slot);
            continue;
          }

          const weekday = WEEKDAY_MAP[day.toLowerCase()];
          if (weekday === undefined) {
            console.warn(`Invalid day name: ${day}`);
            continue;
          }

          // Insert availability rule
          rulesToInsert.push({
            user_id: userId,
            business_id: businessId,
            staff_id: staffId,
            service_id: serviceId,
            rule_type: 'weekly',
            weekday,
            start_time: startTime, // Expected format: HH:mm
            end_time: endTime, // Expected format: HH:mm
            capacity: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    if (rulesToInsert.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No valid availability rules to save',
      });
    }

    // Batch insert all rules
    const { error: insertError } = await supabase
      .from('availability_rules')
      .insert(rulesToInsert);

    if (insertError) {
      console.error('Error inserting availability rules:', insertError);
      return NextResponse.json(
        { error: 'Failed to save availability rules', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      rulesInserted: rulesToInsert.length,
      message: `Saved ${rulesToInsert.length} availability rule(s)`,
    });
  } catch (error) {
    console.error('Error in step-7-availability:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

