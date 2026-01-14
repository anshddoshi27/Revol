import type {
  ServiceAvailability,
  ServiceCategory,
  StaffAvailability,
  StaffMember
} from "@/lib/onboarding-types";
import { formatInTimeZone, timeStringToMinutes, zonedMinutesToDate } from "@/lib/timezone";

export interface ExpandedAvailabilitySlot {
  id: string;
  serviceId: string;
  staffId: string;
  staffName: string;
  staffColor: string;
  startDateTime: string;
  endDateTime: string;
  dayLabel: string;
}

interface BuildSlotsParams {
  service: ServiceCategory["services"][number];
  serviceAvailability: ServiceAvailability | undefined;
  staff: StaffMember[];
  timezone: string;
  startDate: Date;
  horizonDays?: number;
  includePastSlots?: boolean; // If true, show slots even if they're in the past (useful for onboarding)
}

export function buildExpandedSlots({
  service,
  serviceAvailability,
  staff,
  timezone,
  startDate,
  horizonDays = 14,
  includePastSlots = false
}: BuildSlotsParams): ExpandedAvailabilitySlot[] {
  if (!serviceAvailability) {
    return [];
  }

  const slots: ExpandedAvailabilitySlot[] = [];
  const dayFormatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long" });
  const now = new Date();

  for (let dayOffset = 0; dayOffset < horizonDays; dayOffset += 1) {
    const currentDate = addDays(startDate, dayOffset);
    const dayKey = dayFormatter.format(currentDate).toLowerCase() as StaffAvailability["slots"][number]["day"];

    for (const assignment of serviceAvailability.staff) {
      const staffMember = staff.find((member) => member.id === assignment.staffId);
      if (!staffMember) continue;

      for (const slot of assignment.slots) {
        if (slot.day !== dayKey) continue;
        const startMinutes = timeStringToMinutes(slot.startTime);
        const endMinutes = timeStringToMinutes(slot.endTime);
        const duration = service.durationMinutes;

        for (
          let pointerMinutes = startMinutes;
          pointerMinutes + duration <= endMinutes;
          pointerMinutes += duration
        ) {
          const slotStart = zonedMinutesToDate(currentDate, pointerMinutes, timezone);
          const slotEnd = zonedMinutesToDate(currentDate, pointerMinutes + duration, timezone);
          // Only filter out past slots if includePastSlots is false
          if (!includePastSlots && slotStart <= now) continue;

          slots.push({
            id: `${service.id}_${staffMember.id}_${slotStart.toISOString()}`,
            serviceId: service.id,
            staffId: staffMember.id,
            staffName: staffMember.name,
            staffColor: staffMember.color,
            startDateTime: slotStart.toISOString(),
            endDateTime: slotEnd.toISOString(),
            dayLabel: formatInTimeZone(slotStart.toISOString(), timezone, {
              weekday: "short",
              month: "short",
              day: "numeric"
            })
          });
        }
      }
    }
  }

  slots.sort((a, b) => (a.startDateTime > b.startDateTime ? 1 : -1));
  return slots;
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}


export function groupSlotsByDay(slots: ExpandedAvailabilitySlot[], timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "short",
    day: "numeric"
  });
  return slots.reduce<Record<string, ExpandedAvailabilitySlot[]>>((acc, slot) => {
    const key = formatter.format(new Date(slot.startDateTime));
    if (!acc[key]) acc[key] = [];
    acc[key].push(slot);
    return acc;
  }, {});
}


