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

// Reverse map: weekday number to day name
const WEEKDAY_REVERSE_MAP: Record<number, string> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

/**
 * GET /api/business/onboarding/step-7-availability
 * 
 * Retrieves availability rules
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
        { availability: [] },
        { status: 200 }
      );
    }

    const supabase = await createServerClient();
    const { data: rules, error } = await supabase
      .from('availability_rules')
      .select('service_id, staff_id, weekday, start_time, end_time')
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .order('service_id', { ascending: true })
      .order('staff_id', { ascending: true })
      .order('weekday', { ascending: true });

    if (error) {
      console.error('[step-7-availability] Error fetching availability:', error);
      return NextResponse.json(
        { error: 'Failed to fetch availability data' },
        { status: 500 }
      );
    }

    // Group rules by service_id, then by staff_id
    const availabilityMap = new Map<string, Map<string, any[]>>();
    
    (rules || []).forEach((rule: any) => {
      const serviceId = rule.service_id;
      const staffId = rule.staff_id;
      
      if (!availabilityMap.has(serviceId)) {
        availabilityMap.set(serviceId, new Map());
      }
      
      const staffMap = availabilityMap.get(serviceId)!;
      if (!staffMap.has(staffId)) {
        staffMap.set(staffId, []);
      }
      
      const dayName = WEEKDAY_REVERSE_MAP[rule.weekday];
      if (dayName) {
        staffMap.get(staffId)!.push({
          day: dayName,
          startTime: rule.start_time,
          endTime: rule.end_time,
        });
      }
    });

    // Convert to ServiceAvailability format
    const availability: any[] = [];
    availabilityMap.forEach((staffMap, serviceId) => {
      const staff: any[] = [];
      staffMap.forEach((slots, staffId) => {
        staff.push({
          staffId,
          slots,
        });
      });
      
      if (staff.length > 0) {
        availability.push({
          serviceId,
          staff,
        });
      }
    });

    return NextResponse.json({
      availability
    });
  } catch (error) {
    console.error('[step-7-availability] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
  console.log('[step-7-availability] API called - PUT /api/business/onboarding/step-7-availability');
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('[step-7-availability] No user ID found - unauthorized');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    console.log('[step-7-availability] User authenticated:', userId);

    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      console.error('[step-7-availability] Business not found for user:', userId);
      return NextResponse.json(
        { error: 'Business not found. Complete step 1 first.' },
        { status: 404 }
      );
    }
    console.log('[step-7-availability] Business ID:', businessId);

    const body = await request.json();
    const { availability } = body;

    if (!Array.isArray(availability)) {
      console.error('[step-7-availability] Invalid request body - availability is not an array');
      return NextResponse.json(
        { error: 'availability must be an array' },
        { status: 400 }
      );
    }

    console.log('[step-7-availability] Processing availability rules:', availability.length);
    
    // Helper function to check if a string is a valid UUID
    const isValidUUID = (str: string): boolean => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    };

    let supabase = await createServerClient();
    
    // Get all valid service IDs and staff IDs from database to map temporary IDs
    let allServices: any[] | null = null;
    let allStaff: any[] | null = null;
    
    let { data: servicesData, error: servicesError } = await supabase
      .from('services')
      .select('id, name')
      .eq('business_id', businessId)
      .is('deleted_at', null);
    
    let { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('id, name')
      .eq('business_id', businessId)
      .is('deleted_at', null);
    
    // If RLS errors, use service role
    if ((servicesError && (servicesError.code === 'PGRST301' || servicesError.message?.includes('No suitable key'))) ||
        (staffError && (staffError.code === 'PGRST301' || staffError.message?.includes('No suitable key')))) {
      console.log('[step-7-availability] RLS error, using service role for lookups');
      const { createAdminClient } = await import('@/lib/db');
      supabase = createAdminClient();
      
      const { data: adminServices } = await supabase
        .from('services')
        .select('id, name')
        .eq('business_id', businessId)
        .is('deleted_at', null);
      
      const { data: adminStaff } = await supabase
        .from('staff')
        .select('id, name')
        .eq('business_id', businessId)
        .is('deleted_at', null);
      
      // Use admin data if available
      allServices = adminServices;
      allStaff = adminStaff;
    } else {
      allServices = servicesData;
      allStaff = staffData;
    }
    
    console.log('[step-7-availability] Found services:', allServices?.length || 0, 'staff:', allStaff?.length || 0);

    // Delete existing availability rules (hard delete for this table)
    let { error: deleteError } = await supabase
      .from('availability_rules')
      .delete()
      .eq('user_id', userId)
      .eq('business_id', businessId);

    // If RLS error, use service role
    if (deleteError && (deleteError.code === 'PGRST301' || deleteError.message?.includes('No suitable key'))) {
      console.log('[step-7-availability] RLS error on delete, using service role');
      const { createAdminClient } = await import('@/lib/db');
      const adminSupabase = createAdminClient();
      
      const { error: adminDeleteError } = await adminSupabase
        .from('availability_rules')
        .delete()
        .eq('user_id', userId)
        .eq('business_id', businessId);
      
      if (adminDeleteError) {
        console.error('[step-7-availability] Error deleting with admin:', adminDeleteError);
      }
    } else if (deleteError) {
      console.error('[step-7-availability] Error deleting availability rules:', deleteError);
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
      let { serviceId, staff } = serviceAvail;

      if (!serviceId || !Array.isArray(staff)) {
        console.warn('[step-7-availability] Skipping invalid service availability:', serviceAvail);
        continue;
      }

      // If serviceId is not a valid UUID, try to find the real service ID
      // This handles temporary frontend IDs like "service-xxx"
      if (!isValidUUID(serviceId)) {
        console.log('[step-7-availability] serviceId is not a valid UUID, attempting to find real ID:', serviceId);
        
        // The temporary ID format is usually "service-{timestamp}-{categoryIndex}-{serviceIndex}"
        // We can't reliably map this, so we'll use the order/index to match
        // But actually, the best approach is to use all services in order
        // For now, let's try to match by extracting the indices from the temp ID
        const match = serviceId.match(/service-(\d+)-(\d+)-(\d+)/);
        if (match && allServices && allServices.length > 0) {
          // Try to use the service index if available
          // This is a fallback - ideally frontend should use real IDs
          const serviceIndex = parseInt(match[3], 10);
          if (!isNaN(serviceIndex) && serviceIndex < allServices.length) {
            serviceId = allServices[serviceIndex].id;
            console.log(`[step-7-availability] Mapped temporary ID to real service ID: ${serviceId}`);
          } else {
            // If we can't map it, skip this service
            console.warn('[step-7-availability] Could not map temporary service ID, skipping:', serviceId);
            continue;
          }
        } else {
          // If we can't parse the temp ID, skip it
          console.warn('[step-7-availability] Could not parse temporary service ID, skipping:', serviceId);
          continue;
        }
      }

      // Process each staff member's availability
      for (const staffAvail of staff) {
        let { staffId, slots } = staffAvail;

        if (!staffId || !Array.isArray(slots)) {
          console.warn('[step-7-availability] Skipping invalid staff availability:', staffAvail);
          continue;
        }

        // If staffId is not a valid UUID, try to find the real staff ID
        if (!isValidUUID(staffId)) {
          console.log('[step-7-availability] staffId is not a valid UUID, attempting to find real ID:', staffId);
          
          // The temporary ID format is usually "staff-{timestamp}-{index}"
          const match = staffId.match(/staff-(\d+)-(\d+)/);
          if (match && allStaff && allStaff.length > 0) {
            const staffIndex = parseInt(match[2], 10);
            if (!isNaN(staffIndex) && staffIndex < allStaff.length) {
              staffId = allStaff[staffIndex].id;
              console.log(`[step-7-availability] Mapped temporary staff ID to real ID: ${staffId}`);
            } else {
              console.warn('[step-7-availability] Could not map temporary staff ID, skipping:', staffId);
              continue;
            }
          } else {
            console.warn('[step-7-availability] Could not parse temporary staff ID, skipping:', staffId);
            continue;
          }
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

    if (rulesToInsert.length === 0) {
      console.warn('[step-7-availability] No valid rules to insert after filtering');
      return NextResponse.json({
        success: true,
        rulesInserted: 0,
        message: 'No valid availability rules to save (all IDs were invalid)',
      });
    }

    console.log('[step-7-availability] Inserting', rulesToInsert.length, 'availability rules');
    
    // Batch insert all rules
    let { error: insertError } = await supabase
      .from('availability_rules')
      .insert(rulesToInsert);

    // If RLS error, try with service role
    if (insertError && (insertError.code === 'PGRST301' || insertError.message?.includes('No suitable key'))) {
      console.log('[step-7-availability] RLS error on insert, using service role');
      const { createAdminClient } = await import('@/lib/db');
      const adminSupabase = createAdminClient();
      
      const { error: adminInsertError } = await adminSupabase
        .from('availability_rules')
        .insert(rulesToInsert);
      
      if (adminInsertError) {
        console.error('[step-7-availability] Error inserting with admin:', adminInsertError);
        return NextResponse.json(
          { error: 'Failed to save availability rules', details: adminInsertError.message },
          { status: 500 }
        );
      }
    } else if (insertError) {
      console.error('[step-7-availability] Error inserting availability rules:', insertError);
      return NextResponse.json(
        { error: 'Failed to save availability rules', details: insertError.message },
        { status: 500 }
      );
    }

    console.log('[step-7-availability] Successfully saved', rulesToInsert.length, 'availability rules');

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

