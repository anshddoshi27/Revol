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

const SLOT_DURATION_MINUTES = 15;
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
  const targetDateUTC = fromZonedTime(targetDateLocal, timezone);
  const targetDateInTimezone = toZonedTime(targetDateUTC, timezone);
  const weekday = targetDateInTimezone.getDay(); // Get weekday in business timezone

  // Get service duration
  const { data: service } = await supabase
    .from('services')
    .select('duration_min')
    .eq('id', serviceId)
    .single();

  if (!service) {
    throw new Error('Service not found');
  }

  const serviceDurationMinutes = service.duration_min;

  // Get all staff that can perform this service
  const { data: staffServices } = await supabase
    .from('staff_services')
    .select('staff_id')
    .eq('service_id', serviceId)
    .eq('business_id', businessId);

  if (!staffServices || staffServices.length === 0) {
    return [];
  }

  const staffIds = staffServices.map(ss => ss.staff_id);

  // Get staff names
  const { data: staffList } = await supabase
    .from('staff')
    .select('id, name')
    .in('id', staffIds)
    .eq('is_active', true)
    .is('deleted_at', null);

  if (!staffList || staffList.length === 0) {
    return [];
  }

  const staffMap = new Map(staffList.map(s => [s.id, s.name]));

  // Get availability rules for this service, staff, and weekday
  const { data: rules } = await supabase
    .from('availability_rules')
    .select('staff_id, weekday, start_time, end_time')
    .eq('service_id', serviceId)
    .in('staff_id', staffIds)
    .eq('weekday', weekday)
    .eq('rule_type', 'weekly')
    .is('deleted_at', null);

  if (!rules || rules.length === 0) {
    return [];
  }

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

  // If the target date is too far in advance, return empty
  // Use UTC date for comparison
  const targetDateUTCForComparison = targetDateUTC;
  if (targetDateUTCForComparison > maxAdvanceDate) {
    return [];
  }

  // Process each rule
  for (const rule of rules) {
    const staffId = rule.staff_id;
    const staffName = staffMap.get(staffId);
    if (!staffName) continue;

    // Parse start_time and end_time (HH:mm format in business timezone)
    // Create date strings as if they're in business timezone, then convert to UTC
    const ruleStartStr = `${date}T${rule.start_time}:00`;
    const ruleEndStr = `${date}T${rule.end_time}:00`;
    
    // fromZonedTime creates a UTC Date from a local Date in the specified timezone
    // This properly handles timezone conversion (e.g., "2025-01-15T09:00:00" in "America/New_York" → UTC)
    const ruleStartLocal = new Date(ruleStartStr);
    const ruleEndLocal = new Date(ruleEndStr);
    const ruleStartUTC = fromZonedTime(ruleStartLocal, timezone);
    const ruleEndUTC = fromZonedTime(ruleEndLocal, timezone);

    // Walk in 15-minute increments (working in UTC)
    let currentStart = new Date(ruleStartUTC);
    const ruleEndTime = new Date(ruleEndUTC);

    while (currentStart < ruleEndTime) {
      const slotEnd = new Date(currentStart.getTime() + serviceDurationMinutes * 60 * 1000);

      // Check if slot fits within rule end time
      if (slotEnd > ruleEndTime) {
        break;
      }

      // Check lead time (must be after minimum lead time from now)
      if (currentStart < minStartTime) {
        currentStart = new Date(currentStart.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);
        continue;
      }

      // Check if slot is in the past
      if (currentStart < now) {
        currentStart = new Date(currentStart.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);
        continue;
      }

      // Check blackouts
      if (isInBlackout(currentStart, slotEnd, staffId)) {
        currentStart = new Date(currentStart.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);
        continue;
      }

      // Check existing bookings
      if (isOverlappingBooking(currentStart, slotEnd, staffId)) {
        currentStart = new Date(currentStart.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);
        continue;
      }

      // Valid slot - ensure times are in UTC ISO format
      slots.push({
        staff_id: staffId,
        staff_name: staffName,
        start_at: new Date(currentStart).toISOString(),
        end_at: new Date(slotEnd).toISOString(),
      });

      // Move to next 15-minute slot
      currentStart = new Date(currentStart.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);
    }
  }

  // Sort slots by start time
  slots.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  return slots;
}


