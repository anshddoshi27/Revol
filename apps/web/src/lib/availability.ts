import { createAdminClient } from './db';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

export interface AvailabilitySlot {
  staff_id: string;
  staff_name: string;
  start_at: string; // ISO timestamp
  end_at: string; // ISO timestamp
}

interface AvailabilityParams {
  serviceId: string;
  date: string; // YYYY-MM-DD
  businessId: string;
  userId: string;
  businessTimezone?: string | null;
  minLeadTimeMinutes?: number | null;
  maxAdvanceDays?: number | null;
}

interface AvailabilityRule {
  staff_id: string;
  weekday: number;
  start_time: string; // HH:mm
  end_time: string; // HH:mm
}

interface Blackout {
  staff_id: string | null;
  start_at: string;
  end_at: string;
}

interface ExistingBooking {
  staff_id: string;
  start_at: string;
  end_at: string;
}

const SLOT_DURATION_MINUTES = 30; // Changed to 30-minute blocks to match calendar UI
const DEFAULT_MIN_LEAD_TIME_MINUTES = 120; // 2 hours
const DEFAULT_MAX_ADVANCE_DAYS = 60;

/**
 * Generate available time slots for a service on a specific date
 */
export async function generateAvailabilitySlots(
  params: AvailabilityParams
): Promise<AvailabilitySlot[]> {
  const { serviceId, date, businessId, userId, businessTimezone, minLeadTimeMinutes, maxAdvanceDays } = params;

  const supabase = createAdminClient();

  // Use provided business settings or fetch them if not provided
  let timezone = businessTimezone || 'America/New_York';
  let minLeadTime = minLeadTimeMinutes ?? DEFAULT_MIN_LEAD_TIME_MINUTES;
  let maxAdvance = maxAdvanceDays ?? DEFAULT_MAX_ADVANCE_DAYS;

  // If business settings not provided, fetch them from database
  if (businessTimezone === undefined || minLeadTimeMinutes === undefined || maxAdvanceDays === undefined) {
    const { data: business } = await supabase
      .from('businesses')
      .select('timezone, min_lead_time_minutes, max_advance_days')
      .eq('id', businessId)
      .single();

    if (!business) {
      throw new Error('Business not found');
    }

    timezone = business.timezone || 'America/New_York';
    
    // Use database values if not provided as params, fall back to defaults
    if (minLeadTimeMinutes === undefined) {
      minLeadTime = business.min_lead_time_minutes ?? DEFAULT_MIN_LEAD_TIME_MINUTES;
    }
    if (maxAdvanceDays === undefined) {
      maxAdvance = business.max_advance_days ?? DEFAULT_MAX_ADVANCE_DAYS;
    }
  }

  // Parse the date in the business timezone and get weekday (0-6, Sunday=0)
  // Create a date string at midnight in business timezone, convert to UTC, then back to business timezone to get correct weekday
  const targetDateStr = `${date}T00:00:00`;
  // Parse as if in business timezone, then convert to UTC Date
  const targetDateLocal = new Date(targetDateStr);
  
  // Validate input date
  if (isNaN(targetDateLocal.getTime())) {
    console.error(`[availability] Invalid date string: ${targetDateStr}`);
    return [];
  }
  
  // Validate timezone
  if (!timezone || typeof timezone !== 'string') {
    console.error(`[availability] Invalid timezone: ${timezone}`);
    return [];
  }
  
  let targetDateUTC: Date;
  try {
    targetDateUTC = fromZonedTime(targetDateLocal, timezone);
    
    // Validate converted date
    if (isNaN(targetDateUTC.getTime())) {
      console.error(`[availability] Invalid date after timezone conversion:`, {
        date,
        targetDateStr,
        timezone,
        targetDateLocal: targetDateLocal.toISOString(),
      });
      return [];
    }
  } catch (error) {
    console.error(`[availability] Error converting timezone:`, error, {
      date,
      targetDateStr,
      timezone,
    });
    return [];
  }
  
  const targetDateInTimezone = toZonedTime(targetDateUTC, timezone);
  const weekday = targetDateInTimezone.getDay(); // Get weekday in business timezone

  // Get service duration - verify service exists and get real ID
  const { data: service, error: serviceError } = await supabase
    .from('services')
    .select('id, duration_min, name')
    .eq('id', serviceId)
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .single();

  if (serviceError || !service) {
    console.error(`[availability] Service not found for ID: ${serviceId}, business: ${businessId}`, serviceError);
    
    // Debug: Check what services actually exist
    const { data: allServices } = await supabase
      .from('services')
      .select('id, name')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .limit(10);
    console.log(`[availability] Available services in database (first 10):`, allServices?.map(s => ({ id: s.id, name: s.name })));
    
    throw new Error(`Service not found: ${serviceId}`);
  }
  
  console.log(`[availability] Found service: ${service.name} (${service.id}), duration: ${service.duration_min} min`);

  // Round service duration to nearest 30-minute increment (30, 60, 90, etc.)
  const serviceDurationMinutes = service.duration_min;
  const roundedServiceDuration = Math.round(serviceDurationMinutes / 30) * 30;
  const finalServiceDuration = roundedServiceDuration < 30 ? 30 : roundedServiceDuration;
  
  console.log(`[availability] Service duration: ${serviceDurationMinutes} min, rounded to: ${finalServiceDuration} min`);

  // First, try to get staff from staff_services associations
  let staffIds: string[] = [];
  const { data: staffServices } = await supabase
    .from('staff_services')
    .select('staff_id')
    .eq('service_id', serviceId)
    .eq('business_id', businessId);

  if (staffServices && staffServices.length > 0) {
    staffIds = staffServices.map(ss => ss.staff_id);
    console.log(`[availability] Found ${staffIds.length} staff from staff_services for service ${serviceId}`);
  } else {
    // If no staff_services associations exist, get staff from availability_rules directly
    // This handles cases where staff associations weren't created during onboarding
    console.log(`[availability] No staff_services found, checking availability_rules for service ${serviceId}`);
    const { data: rulesWithStaff } = await supabase
      .from('availability_rules')
      .select('staff_id')
      .eq('business_id', businessId)
      .eq('service_id', serviceId)
      .eq('rule_type', 'weekly')
      .is('deleted_at', null);
    
    if (rulesWithStaff && rulesWithStaff.length > 0) {
      // Get unique staff IDs from rules
      const uniqueStaffIds = [...new Set(rulesWithStaff.map(r => r.staff_id))];
      staffIds = uniqueStaffIds;
      console.log(`[availability] Found ${staffIds.length} staff from availability_rules for service ${serviceId}`);
    }
  }

  if (staffIds.length === 0) {
    console.log(`[availability] No staff found for service ${serviceId}`);
    return [];
  }

  // Get staff names
  const { data: staffList } = await supabase
    .from('staff')
    .select('id, name')
    .in('id', staffIds)
    .eq('business_id', businessId)
    .eq('is_active', true)
    .is('deleted_at', null);

  if (!staffList || staffList.length === 0) {
    console.log(`[availability] No active staff found for IDs:`, staffIds);
    return [];
  }

  const staffMap = new Map(staffList.map(s => [s.id, s.name]));
  console.log(`[availability] Staff map:`, Array.from(staffMap.entries()));

  // Get availability rules for this service, staff, and weekday
  // Also filter by business_id to ensure we get the right rules
  console.log(`[availability] Querying rules for service ${serviceId}, weekday ${weekday}, staffIds:`, staffIds);
  
  let query = supabase
    .from('availability_rules')
    .select('staff_id, weekday, start_time, end_time, service_id')
    .eq('business_id', businessId)
    .eq('service_id', serviceId)
    .eq('weekday', weekday)
    .eq('rule_type', 'weekly')
    .is('deleted_at', null);
  
  // Only filter by staff_id if we have staff IDs
  if (staffIds.length > 0) {
    query = query.in('staff_id', staffIds);
  }
  
  const { data: rules, error: rulesError } = await query;

  if (rulesError) {
    console.error(`[availability] Error fetching rules for ${date}:`, rulesError);
    // Don't return early - try to continue with empty rules
  }

  if (!rules || rules.length === 0) {
    console.log(`[availability] No rules found for service ${serviceId}, date ${date}, weekday ${weekday}, staffIds:`, staffIds);
    
    // Debug: Check if there are ANY rules for this service (regardless of weekday)
    const { data: allRulesForService } = await supabase
      .from('availability_rules')
      .select('service_id, weekday, staff_id')
      .eq('business_id', businessId)
      .eq('service_id', serviceId)
      .eq('rule_type', 'weekly')
      .is('deleted_at', null);
    
    if (allRulesForService && allRulesForService.length > 0) {
      console.log(`[availability] Found ${allRulesForService.length} rules for service ${serviceId} (across all weekdays):`, allRulesForService.map(r => ({ weekday: r.weekday, staff_id: r.staff_id })));
    } else {
      console.log(`[availability] No rules found for service ${serviceId} at all. Checking all services...`);
      const { data: allRules } = await supabase
        .from('availability_rules')
        .select('service_id, weekday, staff_id')
        .eq('business_id', businessId)
        .eq('rule_type', 'weekly')
        .is('deleted_at', null)
        .limit(10);
      console.log(`[availability] Sample rules in database (first 10):`, allRules?.map(r => ({ service_id: r.service_id, weekday: r.weekday, staff_id: r.staff_id })));
    }
    
    return [];
  }

  console.log(`[availability] Found ${rules.length} rules for service ${serviceId}, date ${date}, weekday ${weekday}`);

  // Get blackouts for this date (staff-specific and global)
  const dayStart = new Date(`${date}T00:00:00Z`);
  const dayEnd = new Date(`${date}T23:59:59Z`);

  const { data: blackouts } = await supabase
    .from('blackouts')
    .select('staff_id, start_at, end_at')
    .eq('business_id', businessId)
    .lte('start_at', dayEnd.toISOString())
    .gte('end_at', dayStart.toISOString())
    .is('deleted_at', null);

  // Get existing bookings for this date and staff
  const { data: bookings } = await supabase
    .from('bookings')
    .select('staff_id, start_at, end_at')
    .eq('business_id', businessId)
    .in('staff_id', staffIds)
    .gte('start_at', dayStart.toISOString())
    .lte('start_at', dayEnd.toISOString())
    .in('status', ['pending', 'scheduled', 'held'])
    .is('deleted_at', null);

  // Helper to check if a time overlaps with blackouts
  const isInBlackout = (start: Date, end: Date, staffId: string): boolean => {
    if (!blackouts) return false;
    return blackouts.some(blackout => {
      // Global blackout (staff_id is null)
      if (!blackout.staff_id) {
        return start < new Date(blackout.end_at) && end > new Date(blackout.start_at);
      }
      // Staff-specific blackout
      if (blackout.staff_id === staffId) {
        return start < new Date(blackout.end_at) && end > new Date(blackout.start_at);
      }
      return false;
    });
  };

  // Helper to check if a time overlaps with existing bookings
  const isOverlappingBooking = (start: Date, end: Date, staffId: string): boolean => {
    if (!bookings) return false;
    return bookings.some(booking => {
      if (booking.staff_id === staffId) {
        const bookingStart = new Date(booking.start_at);
        const bookingEnd = new Date(booking.end_at);
        return start < bookingEnd && end > bookingStart;
      }
      return false;
    });
  };

  const slots: AvailabilitySlot[] = [];
  const now = new Date();
  const minStartTime = new Date(now.getTime() + minLeadTime * 60 * 1000);
  const maxAdvanceDate = new Date(now.getTime() + maxAdvance * 24 * 60 * 60 * 1000);

  // Validate targetDateUTC before logging
  const targetDateUTCStr = isNaN(targetDateUTC.getTime()) ? 'Invalid Date' : targetDateUTC.toISOString();
  
  console.log(`[availability] Slot generation params:`, {
    date,
    weekday,
    now: now.toISOString(),
    minStartTime: minStartTime.toISOString(),
    maxAdvanceDate: maxAdvanceDate.toISOString(),
    targetDateUTC: targetDateUTCStr,
    minLeadTime,
    maxAdvance,
    rulesCount: rules.length,
  });
  
  // If targetDateUTC is invalid, return early
  if (isNaN(targetDateUTC.getTime())) {
    console.error(`[availability] Invalid targetDateUTC for date ${date}, timezone ${timezone}`);
    return [];
  }

  // If the target date is too far in advance, return empty
  // Use UTC date for comparison
  const targetDateUTCForComparison = targetDateUTC;
  if (targetDateUTCForComparison > maxAdvanceDate) {
    console.log(`[availability] Target date ${targetDateUTCForComparison.toISOString()} is beyond max advance date ${maxAdvanceDate.toISOString()}`);
    return [];
  }

  let totalSlotsChecked = 0;
  let slotsFilteredByLeadTime = 0;
  let slotsFilteredByPast = 0;
  let slotsFilteredByBlackout = 0;
  let slotsFilteredByBooking = 0;

  // Process each rule
  for (const rule of rules) {
    const staffId = rule.staff_id;
    const staffName = staffMap.get(staffId);
    if (!staffName) {
      console.log(`[availability] Skipping rule - staff name not found for ${staffId}`);
      continue;
    }

    // Parse start_time and end_time (HH:mm format in business timezone)
    // Parse date components
    const [year, month, day] = date.split('-').map(Number);
    const [startHour, startMin] = rule.start_time.split(':').map(Number);
    const [endHour, endMin] = rule.end_time.split(':').map(Number);
    
    // Validate timezone
    if (!timezone || typeof timezone !== 'string') {
      console.error(`[availability] Invalid timezone:`, timezone);
      continue;
    }
    
    // Create a date string in ISO format, then parse it
    // The key: we create the date as if it's in UTC, then use fromZonedTime to treat it as business timezone
    const ruleStartStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00`;
    const ruleEndStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`;
    
    // Create Date objects - these represent the wall-clock time
    // We'll treat them as if they're in the business timezone
    const ruleStartLocal = new Date(ruleStartStr);
    const ruleEndLocal = new Date(ruleEndStr);
    
    // Validate input dates
    if (isNaN(ruleStartLocal.getTime()) || isNaN(ruleEndLocal.getTime())) {
      console.error(`[availability] Invalid date created from:`, {
        ruleStartStr,
        ruleEndStr,
        date,
        startTime: rule.start_time,
        endTime: rule.end_time,
      });
      continue;
    }
    
    // fromZonedTime: treats the input Date as representing a time in the given timezone,
    // and returns the equivalent Date in UTC
    let ruleStartUTC: Date;
    let ruleEndUTC: Date;
    
    try {
      ruleStartUTC = fromZonedTime(ruleStartLocal, timezone);
      ruleEndUTC = fromZonedTime(ruleEndLocal, timezone);
      
      // Validate the converted dates
      if (isNaN(ruleStartUTC.getTime()) || isNaN(ruleEndUTC.getTime())) {
        console.error(`[availability] Invalid date after timezone conversion:`, {
          date,
          startTime: rule.start_time,
          endTime: rule.end_time,
          timezone,
          ruleStartLocal: ruleStartLocal.toISOString(),
          ruleEndLocal: ruleEndLocal.toISOString(),
        });
        continue;
      }
    } catch (error) {
      console.error(`[availability] Error converting timezone for rule:`, error, {
        date,
        startTime: rule.start_time,
        endTime: rule.end_time,
        timezone,
      });
      continue;
    }

    console.log(`[availability] Processing rule:`, {
      staffId,
      staffName,
      startTime: rule.start_time,
      endTime: rule.end_time,
      ruleStartUTC: ruleStartUTC.toISOString(),
      ruleEndUTC: ruleEndUTC.toISOString(),
    });

    // Round the start time to the nearest 30-minute block (align to 30-minute boundaries)
    const ruleStartMinutes = ruleStartUTC.getMinutes();
    const roundedStartMinutes = Math.floor(ruleStartMinutes / 30) * 30;
    let currentStart = new Date(ruleStartUTC);
    currentStart.setMinutes(roundedStartMinutes, 0, 0); // Round to 30-minute boundary

    const ruleEndTime = new Date(ruleEndUTC);

    // Walk in 30-minute increments (working in UTC)
    while (currentStart < ruleEndTime) {
      const slotEnd = new Date(currentStart.getTime() + finalServiceDuration * 60 * 1000);
      totalSlotsChecked++;

      // Check if slot fits within rule end time
      if (slotEnd > ruleEndTime) {
        break;
      }

      // Check lead time (must be after minimum lead time from now)
      if (currentStart < minStartTime) {
        slotsFilteredByLeadTime++;
        currentStart = new Date(currentStart.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);
        continue;
      }

      // Check if slot is in the past
      if (currentStart < now) {
        slotsFilteredByPast++;
        currentStart = new Date(currentStart.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);
        continue;
      }

      // Check blackouts
      if (isInBlackout(currentStart, slotEnd, staffId)) {
        slotsFilteredByBlackout++;
        currentStart = new Date(currentStart.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);
        continue;
      }

      // Check existing bookings
      if (isOverlappingBooking(currentStart, slotEnd, staffId)) {
        slotsFilteredByBooking++;
        currentStart = new Date(currentStart.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);
        continue;
      }

      // Valid slot - ensure times are in UTC ISO format and rounded to 30-minute boundaries
      slots.push({
        staff_id: staffId,
        staff_name: staffName,
        start_at: new Date(currentStart).toISOString(),
        end_at: new Date(slotEnd).toISOString(),
      });

      // Move to next 30-minute slot
      currentStart = new Date(currentStart.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);
    }
  }

  console.log(`[availability] Slot generation summary:`, {
    totalSlotsChecked,
    slotsGenerated: slots.length,
    filteredByLeadTime: slotsFilteredByLeadTime,
    filteredByPast: slotsFilteredByPast,
    filteredByBlackout: slotsFilteredByBlackout,
    filteredByBooking: slotsFilteredByBooking,
  });

  // Sort slots by start time
  slots.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  return slots;
}


