"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Save, Edit2, X, CalendarDays, Clock, User, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/ui/helper-text";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useFakeBusiness } from "@/lib/fake-business";
import { formatInTimeZone, zonedMinutesToDate, timeStringToMinutes } from "@/lib/timezone";
import type { FakeBooking } from "@/lib/admin-workspace";
import type { StaffMember } from "@/lib/onboarding-types";
import { buildExpandedSlots, groupSlotsByDay, type ExpandedAvailabilitySlot } from "@/lib/availability-utils";
import { createClientClient } from "@/lib/supabase-client";

// Helper function to normalize time format from HH:mm:ss to HH:mm
const normalizeTime = (time: string): string => {
  if (!time) return time;
  // If time is in HH:mm:ss format, convert to HH:mm
  if (time.includes(':') && time.split(':').length === 3) {
    return time.substring(0, 5); // Take first 5 characters (HH:mm)
  }
  return time; // Already in HH:mm format
};

// Helper function to round duration to nearest 15-minute increment (15, 30, 45, 60, 75, etc.)
const roundDurationToNearest15 = (minutes: number): number => {
  if (minutes <= 0) return 15; // Minimum is 15 minutes
  return Math.round(minutes / 15) * 15;
};

// Helper function to check if two time ranges overlap
const timeRangesOverlap = (
  start1: number, end1: number,
  start2: number, end2: number
): boolean => {
  // Two ranges overlap if start1 < end2 AND start2 < end1
  return start1 < end2 && start2 < end1;
};

// Helper function to convert time string (HH:mm) to minutes since midnight
const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

export default function CalendarPage() {
  const { workspace, updateWorkspace } = useFakeBusiness();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek;
    const sunday = new Date(today.setDate(diff));
    sunday.setHours(0, 0, 0, 0);
    return sunday;
  });
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("any"); // "any" means show all staff
  const [editingBooking, setEditingBooking] = useState<FakeBooking | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fetchedSlots, setFetchedSlots] = useState<ExpandedAvailabilitySlot[]>([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [addingAvailability, setAddingAvailability] = useState<{
    date: Date;
    hour: number;
    minute: number;
  } | null>(null);
  const [currentAvailability, setCurrentAvailability] = useState<any[]>([]);
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);
  // Pending availability additions - slots clicked but not yet saved
  const [pendingAvailabilityAdditions, setPendingAvailabilityAdditions] = useState<Array<{
    staffId: string;
    date: Date;
    hour: number;
    minute: number;
  }>>([]);
  // Pending availability deletions - existing slots clicked to remove
  // Note: Deletions are scoped to the selectedServiceId - they only affect the currently selected service
  const [pendingAvailabilityDeletions, setPendingAvailabilityDeletions] = useState<Array<{
    staffId: string;
    date: Date;
    hour: number;
    minute?: number;
    slotId: string;
    serviceId?: string; // Optional: track which service this deletion is for (for safety)
    // Direct slot matching fields (for more reliable matching)
    day?: string; // weekday name (lowercase)
    startTime?: string; // Actual startTime from slot (HH:mm)
    endTime?: string; // Actual endTime from slot (HH:mm)
  }>>([]);
  // Selected slots for deletion - tracks which slots the user has selected to delete
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());

  if (!workspace) {
    return null;
  }

  const timezone = workspace.identity.location.timezone || "UTC";
  const bookings = workspace.bookings || [];

  // Get all services for dropdown - memoized
  const allServices = useMemo(() => 
    workspace.catalog.flatMap((category) =>
      category.services.map((service) => ({
        ...service,
        categoryName: category.name
      }))
    ), [workspace.catalog]
  );

  // Memoize stable values to prevent infinite loops
  const businessSlug = useMemo(() => workspace.identity.website.subdomain, [workspace.identity.website.subdomain]);
  const staffArray = useMemo(() => workspace.staff || [], [workspace.staff]);
  
  // Ref to track if we're currently fetching to prevent duplicate requests
  const isFetchingRef = useRef(false);
  // Ref to track fetched slots for checking after save
  const fetchedSlotsRef = useRef<ExpandedAvailabilitySlot[]>([]);

  // Generate slots from availability rules for admin view (no lead time filtering)
  const generateSlotsFromRules = useCallback((rules: Array<{staffId: string; day: string; startTime: string; endTime: string}>, weekDays: Date[], serviceDurationMinutes: number): ExpandedAvailabilitySlot[] => {
    const slots: ExpandedAvailabilitySlot[] = [];
    const dayFormatter = new Intl.DateTimeFormat("en-US", { 
      timeZone: timezone, 
      weekday: "long" 
    });
    
    // Map weekday names to numbers (Sunday = 0)
    const weekdayMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    
    // Process each day in the week view
    weekDays.forEach((day) => {
      const weekdayNum = day.getDay();
      
      // Find rules that match this weekday
      rules.forEach((rule) => {
        const ruleDayLower = rule.day.toLowerCase();
        const ruleWeekdayNum = weekdayMap[ruleDayLower];
        if (ruleWeekdayNum !== undefined && ruleWeekdayNum === weekdayNum) {
          // Parse start and end times
          const [startHour, startMin] = rule.startTime.split(':').map(Number);
          const [endHour, endMin] = rule.endTime.split(':').map(Number);
          
          const startMinutes = startHour * 60 + startMin;
          const endMinutes = endHour * 60 + endMin;
          
          // Round start time to nearest 30-minute block (0 or 30)
          const roundedStartMinute = Math.floor(startMin / 30) * 30;
          const roundedStartMinutes = startHour * 60 + roundedStartMinute;
          
          // Round service duration to nearest 30-minute increment (30, 60, 90, etc.)
          const roundedDuration = Math.round(serviceDurationMinutes / 30) * 30;
          const finalDuration = roundedDuration < 30 ? 30 : roundedDuration;
          
          // Generate 30-minute slots within this rule's time range
          // Use rounded duration to ensure slots align to 30-minute blocks
          let currentMinutes = roundedStartMinutes;
          while (currentMinutes + finalDuration <= endMinutes) {
            const slotStartDateTime = zonedMinutesToDate(day, currentMinutes, timezone);
            const slotEndDateTime = new Date(slotStartDateTime.getTime() + finalDuration * 60 * 1000);
            
            const staffMember = staffArray.find(s => s.id === rule.staffId);
            
            slots.push({
              id: `rule-${rule.staffId}-${rule.day}-${rule.startTime}-${currentMinutes}-${formatInTimeZone(day, timezone, "yyyy-MM-dd")}`,
              serviceId: selectedServiceId || '',
              staffId: rule.staffId,
              staffName: staffMember?.name || 'Unknown',
              staffColor: staffMember?.color || "#000000",
              startDateTime: slotStartDateTime.toISOString(),
              endDateTime: slotEndDateTime.toISOString(),
              dayLabel: dayFormatter.format(slotStartDateTime),
            });
            
            // Move to next 30-minute slot
            currentMinutes += 30;
          }
        }
      });
    });
    
    return slots;
  }, [timezone, staffArray, selectedServiceId]);

  // Fetch current availability rules when service is selected (for editing)
  // Only fetch once when service changes, not on every render
  const fetchCurrentAvailability = useCallback(async () => {
    if (!selectedServiceId) {
      setCurrentAvailability([]);
      return;
    }

    try {
      // Get auth token from Supabase client
      const supabase = createClientClient();
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      const response = await fetch('/api/business/onboarding/step-7-availability', {
        headers: {
          ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
        },
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        if (data.availability && Array.isArray(data.availability)) {
          // Filter to only the selected service
          const serviceAvailability = data.availability.find(
            (avail: any) => avail.serviceId === selectedServiceId
          );
          setCurrentAvailability(serviceAvailability ? [serviceAvailability] : []);
        }
      }
    } catch (error) {
      console.error('Error fetching current availability:', error);
    }
  }, [selectedServiceId]);

  useEffect(() => {
    fetchCurrentAvailability();
  }, [fetchCurrentAvailability]);

  // Fetch availability when service is selected - memoized callback to prevent infinite loops
  const fetchAvailability = useCallback(async () => {
    if (!selectedServiceId || !businessSlug) {
      setFetchedSlots([]);
      if (!selectedServiceId) {
        setIsLoadingAvailability(false);
      } else if (!businessSlug) {
        setAvailabilityError("Business subdomain not found");
        setIsLoadingAvailability(false);
      }
      return;
    }

    // Prevent duplicate concurrent fetches
    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    setIsLoadingAvailability(true);
    setAvailabilityError(null);
    
    try {
      // Fetch availability starting from the beginning of the current week view
      // This ensures we get slots for all days in the visible week, even if some are in the past
      const allSlots: ExpandedAvailabilitySlot[] = [];
      const dayFormatter = new Intl.DateTimeFormat("en-US", { 
        timeZone: timezone, 
        weekday: "long" 
      });
      
      // Start from the beginning of the current week (Sunday)
      const fetchStartDate = new Date(currentWeekStart);
      
      // Fetch 14 days starting from the week start (covers current week + next week)
      const daysToFetch = 14;
      
      console.log('[calendar] Fetching availability:', {
        weekStart: formatInTimeZone(fetchStartDate, timezone, "yyyy-MM-dd"),
        daysToFetch: daysToFetch
      });
      
      // Fetch all dates in parallel for better performance
      const datePromises = [];
      for (let i = 0; i < daysToFetch; i++) {
        const date = new Date(fetchStartDate);
        date.setDate(fetchStartDate.getDate() + i);
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Use unique timestamp for each date to ensure fresh data
        // Add extra randomness to ensure cache-busting works
        const cacheBuster = Date.now() + i + Math.random() * 1000; // Unique timestamp per date with randomness
        datePromises.push(
          fetch(
            `/api/public/${businessSlug}/availability?service_id=${selectedServiceId}&date=${dateStr}&_t=${cacheBuster}&_r=${Math.random()}`,
            {
              credentials: 'include',
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'X-Request-ID': `${Date.now()}-${i}-${Math.random()}`, // Additional cache-busting header
              },
            }
          ).then(async (response) => {
            if (!response.ok) {
              console.warn(`Failed to fetch availability for ${dateStr}:`, response.status);
              return null;
            }
            
            const data = await response.json();
            return { dateStr, data };
          }).catch((err) => {
            console.error(`Error fetching availability for ${dateStr}:`, err);
            return null;
          })
        );
      }
      
      const results = await Promise.all(datePromises);
      
      // Process all results
      results.forEach((result) => {
        if (!result || !result.data) return;
        
        const { dateStr, data } = result;
        if (data.slots && Array.isArray(data.slots)) {
          console.log(`[calendar] Fetched ${data.slots.length} slots for ${dateStr}`);
          // Transform API slots to ExpandedAvailabilitySlot format
          for (const slot of data.slots) {
            const startDate = new Date(slot.start_at);
            const dayLabel = dayFormatter.format(startDate);
            
            // Find staff member to get color
            const staffMember = staffArray.find(s => s.id === slot.staff_id);
            const staffColor = staffMember?.color || "#000000";
            
            // Debug: Log slots for Tuesday 8:00
            const slotHour = formatInTimeZone(startDate, timezone, { hour: "numeric", hour12: false });
            const slotMinute = formatInTimeZone(startDate, timezone, { minute: "numeric" });
            if (dateStr === '2026-01-05' && slotHour === '8' && slotMinute === '0') {
              console.log(`[calendar] DEBUG: Fetched Tuesday 8:00 slot:`, {
                staffId: slot.staff_id,
                staffName: slot.staff_name,
                start_at: slot.start_at,
                end_at: slot.end_at,
                dateStr,
                slotHour,
                slotMinute
              });
            }
            
            allSlots.push({
              id: `${slot.staff_id}-${slot.start_at}`,
              serviceId: selectedServiceId,
              staffId: slot.staff_id,
              staffName: slot.staff_name,
              staffColor: staffColor,
              startDateTime: slot.start_at,
              endDateTime: slot.end_at,
              dayLabel: dayLabel,
            });
          }
        } else {
          console.log(`[calendar] No slots found for ${dateStr}`);
        }
      });
      
      console.log(`[calendar] Fetched ${allSlots.length} slots total`);
      console.log('[calendar] Sample of fetched slots:', allSlots.slice(0, 5).map(s => ({
        staffId: s.staffId,
        staffName: s.staffName,
        startDateTime: s.startDateTime,
        dayLabel: s.dayLabel
      })));
      fetchedSlotsRef.current = allSlots; // Update ref for use in save function
      setFetchedSlots(allSlots);
    } catch (error) {
      console.error('Error fetching availability:', error);
      setAvailabilityError('Failed to load availability. Please try again.');
    } finally {
      setIsLoadingAvailability(false);
      isFetchingRef.current = false;
    }
  }, [selectedServiceId, businessSlug, timezone, staffArray, currentWeekStart]);

  // Fetch availability when service or business slug changes
  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  // Generate days of the week - must be defined before adminSlotsFromRules
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      days.push(date);
    }
    return days;
  }, [currentWeekStart]);

  // Generate slots from availability rules for admin view (shows all saved rules, no filtering)
  const adminSlotsFromRules = useMemo(() => {
    if (!selectedServiceId || currentAvailability.length === 0) return [];
    
    const selectedService = allServices.find(s => s.id === selectedServiceId);
    if (!selectedService) return [];
    
    const serviceAvailability = currentAvailability[0];
    if (!serviceAvailability || !serviceAvailability.staff) return [];
    
    // Flatten all rules from all staff
    const allRules: Array<{staffId: string; day: string; startTime: string; endTime: string}> = [];
    serviceAvailability.staff.forEach((staff: any) => {
      if (staff.slots && Array.isArray(staff.slots)) {
        staff.slots.forEach((slot: any) => {
          allRules.push({
            staffId: staff.staffId,
            day: slot.day,
            startTime: normalizeTime(slot.startTime),
            endTime: normalizeTime(slot.endTime),
          });
        });
      }
    });
    
    return generateSlotsFromRules(allRules, weekDays, selectedService.durationMinutes);
  }, [currentAvailability, selectedServiceId, weekDays, allServices, generateSlotsFromRules]);

  // Merge admin slots (from rules) with public API slots (filtered)
  // Admin slots take precedence - they show all saved rules regardless of filtering
  const mergedSlots = useMemo(() => {
    // Use admin slots as the primary source (they show all saved rules)
    // Public API slots are filtered by lead time, so we use admin slots for admin view
    const adminSlotIds = new Set(adminSlotsFromRules.map(s => s.id));
    
    // Combine admin slots with any public API slots that aren't already covered
    const combined = [...adminSlotsFromRules];
    fetchedSlots.forEach(slot => {
      // Only add public API slot if we don't have an admin slot for the same time/staff
      const hasAdminSlot = adminSlotsFromRules.some(adminSlot => 
        adminSlot.staffId === slot.staffId &&
        Math.abs(new Date(adminSlot.startDateTime).getTime() - new Date(slot.startDateTime).getTime()) < 60000 // Within 1 minute
      );
      if (!hasAdminSlot) {
        combined.push(slot);
      }
    });
    
    return combined;
  }, [adminSlotsFromRules, fetchedSlots]);

  // Group slots by day
  const groupedSlots = useMemo(() => {
    if (!selectedServiceId) return {};
    const grouped = groupSlotsByDay(mergedSlots, timezone);
    console.log('[calendar] Grouped slots by day:', {
      totalSlots: mergedSlots.length,
      adminSlots: adminSlotsFromRules.length,
      publicApiSlots: fetchedSlots.length,
      daysWithSlots: Object.keys(grouped).length,
      slotsPerDay: Object.entries(grouped).map(([day, slots]) => ({ day, count: slots.length }))
    });
    return grouped;
  }, [mergedSlots, timezone, selectedServiceId, adminSlotsFromRules, fetchedSlots]);


  // Generate 30-minute time segments from 8 AM to 8 PM
  const timeSegments = useMemo(() => {
    const segments: Array<{ hour: number; minute: number; label: string }> = [];
    for (let hour = 8; hour <= 20; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const minuteStr = minute === 0 ? '00' : minute.toString();
        segments.push({
          hour,
          minute,
          label: minute === 0 ? `${displayHour} ${ampm}` : `${displayHour}:${minuteStr} ${ampm}`
        });
      }
    }
    return segments;
  }, []);

  // Group bookings by day and time segment (hour:minute)
  const bookingsByDayAndTime = useMemo(() => {
    const grouped: Record<string, Record<string, FakeBooking[]>> = {};

    bookings.forEach((booking) => {
      // Filter by selected service if one is selected
      if (selectedServiceId && booking.serviceId !== selectedServiceId) {
        return;
      }

      const bookingDate = new Date(booking.startDateTime);
      const dateKey = formatInTimeZone(bookingDate, timezone, "yyyy-MM-dd");
      const hour = formatInTimeZone(bookingDate, timezone, { hour: "numeric", hour12: false });
      const minute = formatInTimeZone(bookingDate, timezone, { minute: "numeric" });
      const hourNum = parseInt(hour, 10);
      const minuteNum = parseInt(minute, 10);
      // Round to nearest 30-minute segment (0 or 30)
      const roundedMinute = Math.floor(minuteNum / 30) * 30;
      const timeKey = `${hourNum}:${roundedMinute.toString().padStart(2, '0')}`;

      // Only include bookings that are in the current week
      const isInCurrentWeek = weekDays.some((day) => {
        const dayKey = formatInTimeZone(day, timezone, "yyyy-MM-dd");
        return dayKey === dateKey;
      });

      if (!isInCurrentWeek) return;

      if (!grouped[dateKey]) {
        grouped[dateKey] = {};
      }

      if (!grouped[dateKey][timeKey]) {
        grouped[dateKey][timeKey] = [];
      }

      grouped[dateKey][timeKey].push(booking);
    });

    return grouped;
  }, [bookings, weekDays, timezone, selectedServiceId]);

  // Group availability slots by day and time segment (hour:minute)
  const slotsByDayAndTime = useMemo(() => {
    const grouped: Record<string, Record<string, ExpandedAvailabilitySlot[]>> = {};
    
    // Flatten all slots from all days
    const allSlots = Object.values(groupedSlots).flat();
    
    // Add fetched slots (but exclude pending deletions)
    allSlots.forEach(slot => {
      const slotDate = new Date(slot.startDateTime);
      const slotEndDate = new Date(slot.endDateTime);
      const dateKey = formatInTimeZone(slotDate, timezone, "yyyy-MM-dd");
      
      // Only include slots that are in the current week
      const isInCurrentWeek = weekDays.some(day => {
        const dayKey = formatInTimeZone(day, timezone, "yyyy-MM-dd");
        return dayKey === dateKey;
      });
      
      if (!isInCurrentWeek) return;
      
      // Check if this slot is marked for deletion
      const isPendingDeletion = pendingAvailabilityDeletions.some(deletion => {
        const deletionDateKey = formatInTimeZone(deletion.date, timezone, "yyyy-MM-dd");
        // Check if deletion matches this slot by date, hour, and staff
        const slotStartDate = new Date(slot.startDateTime);
        const slotStartHour = parseInt(formatInTimeZone(slotStartDate, timezone, { hour: "numeric", hour12: false }), 10);
        const slotStartMinute = parseInt(formatInTimeZone(slotStartDate, timezone, { minute: "numeric" }), 10);
        const slotRoundedMinute = Math.floor(slotStartMinute / 30) * 30;
        return deletion.staffId === slot.staffId &&
               deletionDateKey === dateKey &&
               deletion.hour === slotStartHour &&
               (deletion.minute === undefined || deletion.minute === slotRoundedMinute);
      });
      
      // Skip slots that are pending deletion
      if (isPendingDeletion) return;
      
      // Calculate slot start and end times in minutes
      const slotStartMinutes = formatInTimeZone(slotDate, timezone, { hour: "numeric", hour12: false }) * 60 + 
                                parseInt(formatInTimeZone(slotDate, timezone, { minute: "numeric" }), 10);
      const slotEndMinutes = formatInTimeZone(slotEndDate, timezone, { hour: "numeric", hour12: false }) * 60 + 
                             parseInt(formatInTimeZone(slotEndDate, timezone, { minute: "numeric" }), 10);
      
      // Round start time to nearest 30-minute block (0 or 30)
      const startHour = formatInTimeZone(slotDate, timezone, { hour: "numeric", hour12: false });
      const startMinute = parseInt(formatInTimeZone(slotDate, timezone, { minute: "numeric" }), 10);
      const startHourNum = parseInt(startHour, 10);
      const startMinuteNum = startMinute;
      const startRoundedMinute = Math.floor(startMinuteNum / 30) * 30;
      const timeKey = `${startHourNum}:${startRoundedMinute.toString().padStart(2, '0')}`;
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = {};
      }
      
      // Add this slot only to time segments it actually overlaps with
      let currentSegmentMinutes = slotStartMinutes;
      while (currentSegmentMinutes < slotEndMinutes) {
        const segmentHour = Math.floor(currentSegmentMinutes / 60);
        const segmentMinute = currentSegmentMinutes % 60;
        const roundedMinute = Math.floor(segmentMinute / 30) * 30;
        const segmentStartMinutes = segmentHour * 60 + roundedMinute;
        const segmentEndMinutes = segmentStartMinutes + 30;
        
        // Check if slot overlaps with this segment
        // Slot overlaps if: slotStart < segmentEnd AND slotEnd > segmentStart
        if (slotStartMinutes < segmentEndMinutes && slotEndMinutes > segmentStartMinutes) {
          const blockTimeKey = `${segmentHour}:${roundedMinute.toString().padStart(2, '0')}`;
          
          if (!grouped[dateKey][blockTimeKey]) {
            grouped[dateKey][blockTimeKey] = [];
          }
          
          // Check for duplicates (same slot ID)
          const isDuplicate = grouped[dateKey][blockTimeKey].some(
            existing => existing.id === slot.id
      );
      
      if (!isDuplicate) {
            grouped[dateKey][blockTimeKey].push(slot);
          }
        }
        
        // Move to next 30-minute segment
        currentSegmentMinutes = segmentStartMinutes + 30;
      }
    });
    
    // Add pending availability additions as visual slots
    if (selectedServiceId) {
      const selectedService = allServices.find(s => s.id === selectedServiceId);
      if (selectedService) {
        // Round service duration to nearest 30-minute increment (30, 60, 90, etc.)
        const serviceDuration = Math.round(selectedService.durationMinutes / 30) * 30;
        const finalServiceDuration = serviceDuration < 30 ? 30 : serviceDuration;
        
        // Group pending additions by date and hour to calculate proper time slots
        const pendingByTimeSlot: Record<string, Record<string, Array<{staffId: string; date: Date; hour: number}>>> = {};
        
        pendingAvailabilityAdditions.forEach((pending) => {
          const dateKey = formatInTimeZone(pending.date, timezone, "yyyy-MM-dd");
          // Group by hour block for calculating positions (all slots in same hour share positions)
          const timeKey = `${pending.hour}:00`;
          
          if (!pendingByTimeSlot[dateKey]) {
            pendingByTimeSlot[dateKey] = {};
          }
          if (!pendingByTimeSlot[dateKey][timeKey]) {
            pendingByTimeSlot[dateKey][timeKey] = [];
          }
          pendingByTimeSlot[dateKey][timeKey].push(pending);
        });
        
        // Process each time slot group to calculate proper start times
        Object.entries(pendingByTimeSlot).forEach(([dateKey, timeSlots]) => {
          // Only include if in current week
          const isInCurrentWeek = weekDays.some(day => {
            const dayKey = formatInTimeZone(day, timezone, "yyyy-MM-dd");
            return dayKey === dateKey;
          });
          
          if (!isInCurrentWeek) return;
          
          Object.entries(timeSlots).forEach(([timeKey, pendingList]) => {
            if (!grouped[dateKey]) {
              grouped[dateKey] = {};
            }
            
            // Get the base hour from the clicked time (e.g., 8:00 -> hour 8)
            const baseHour = parseInt(timeKey.split(':')[0], 10);
            
            // Get ALL existing slots in this hour block (8:00, 8:15, 8:30, 8:45) to calculate positions
            // This ensures slots are split correctly even if they span multiple 15-min segments
            const allSlotsInHourBlock: Array<{staffId: string; startDateTime: string}> = [];
            Object.keys(grouped[dateKey]).forEach(existingTimeKey => {
              const existingHour = parseInt(existingTimeKey.split(':')[0], 10);
              if (existingHour === baseHour) {
                grouped[dateKey][existingTimeKey].forEach((slot: ExpandedAvailabilitySlot) => {
                  // Exclude pending deletions and already-processed pending additions
                  const isPendingDeletion = pendingAvailabilityDeletions.some(del => {
                    const delDateKey = formatInTimeZone(del.date, timezone, "yyyy-MM-dd");
                    return del.staffId === slot.staffId && delDateKey === dateKey && del.hour === baseHour;
                  });
                  if (!isPendingDeletion && !slot.id?.startsWith('pending-')) {
                    allSlotsInHourBlock.push({
                      staffId: slot.staffId,
                      startDateTime: slot.startDateTime
                    });
                  }
                });
              }
            });
            
            // Combine existing and pending, sort by staffId for consistent ordering
            const allStaffForSlot = [
              ...allSlotsInHourBlock.map(s => s.staffId),
              ...pendingList.map(p => p.staffId)
            ];
            const uniqueStaffIds = Array.from(new Set(allStaffForSlot));
            uniqueStaffIds.sort(); // Sort for consistent ordering
            
            // Process each pending addition with calculated start time
            // Sort pending list by the clicked minute first, then by staffId for consistent ordering
            const sortedPendingList = [...pendingList].sort((a, b) => {
              if (a.minute !== b.minute) return a.minute - b.minute;
              return a.staffId.localeCompare(b.staffId);
            });
            
            // Group pending list by the exact clicked time (hour + minute) so staff clicking same segment share it
            const pendingByExactTime: Record<string, Array<{staffId: string; date: Date; hour: number; minute: number}>> = {};
            sortedPendingList.forEach((pending) => {
              const exactTimeKey = `${pending.hour}:${pending.minute.toString().padStart(2, '0')}`;
              if (!pendingByExactTime[exactTimeKey]) {
                pendingByExactTime[exactTimeKey] = [];
              }
              pendingByExactTime[exactTimeKey].push(pending);
            });
            
            // Process each exact time group separately
            Object.entries(pendingByExactTime).forEach(([exactTimeKey, exactTimePendingList]) => {
              // All staff clicking this exact time segment use the same start time
              // They will be displayed in the same slot and split proportionally
              const [exactHour, exactMinute] = exactTimeKey.split(':').map(Number);
              const clickedTimeMinutes = exactHour * 60 + exactMinute;
              const startDateTime = zonedMinutesToDate(exactTimePendingList[0].date, clickedTimeMinutes, timezone);
              
            // Round the clicked time to nearest 30-minute block (0 or 30)
            const clickedRoundedMinute = Math.floor(exactMinute / 30) * 30;
            const roundedStartMinutes = exactHour * 60 + clickedRoundedMinute;
            const roundedStartDateTime = zonedMinutesToDate(exactTimePendingList[0].date, roundedStartMinutes, timezone);
            
            // Calculate end time in minutes
            const endMinutes = roundedStartMinutes + finalServiceDuration;
            
            // Add all staff from this exact time group to all 30-minute blocks the slot spans
              exactTimePendingList.forEach((pending) => {
                const staffMember = staffArray.find((s: StaffMember) => s.id === pending.staffId);
              const endDateTime = new Date(roundedStartDateTime.getTime() + finalServiceDuration * 60 * 1000);
              
              // Create the slot object
              const pendingSlot = {
                    id: `pending-${pending.staffId}-${dateKey}-${pending.hour}-${pending.minute}`,
                    serviceId: selectedServiceId,
                    staffId: pending.staffId,
                    staffName: staffMember?.name || 'Unknown',
                    staffColor: staffMember?.color || "#000000",
                startDateTime: roundedStartDateTime.toISOString(),
                    endDateTime: endDateTime.toISOString(),
                    dayLabel: formatInTimeZone(pending.date, timezone, { weekday: "long" }),
              };
              
              // Add this slot only to time segments it actually overlaps with
              let currentSegmentMinutes = roundedStartMinutes;
              while (currentSegmentMinutes < endMinutes) {
                const segmentHour = Math.floor(currentSegmentMinutes / 60);
                const segmentMinute = currentSegmentMinutes % 60;
                const roundedMinute = Math.floor(segmentMinute / 30) * 30;
                const segmentStartMinutes = segmentHour * 60 + roundedMinute;
                const segmentEndMinutes = segmentStartMinutes + 30;
                
                // Check if slot overlaps with this segment
                if (roundedStartMinutes < segmentEndMinutes && endMinutes > segmentStartMinutes) {
                  const timeKey = `${segmentHour}:${roundedMinute.toString().padStart(2, '0')}`;
                  
                  if (!grouped[dateKey][timeKey]) {
                    grouped[dateKey][timeKey] = [];
                  }
                  
                  // Check if this pending slot already exists in this block (don't duplicate)
                  const alreadyExists = grouped[dateKey][timeKey].some(
                    existing => existing.staffId === pending.staffId && 
                    existing.id && existing.id.startsWith('pending-') &&
                    existing.id === pendingSlot.id
                  );
                  
                  if (!alreadyExists) {
                    grouped[dateKey][timeKey].push(pendingSlot);
                  }
                }
                
                // Move to next 30-minute segment
                currentSegmentMinutes = segmentStartMinutes + 30;
                }
              });
            });
          });
        });
      }
    }
    
    // Debug: Log grouped slots for Tuesday 8:00
    if (grouped['2026-01-05']?.['8:00']) {
      console.log(`[calendar] DEBUG: Tuesday 8:00 grouped slots (final):`, grouped['2026-01-05']['8:00'].map(s => ({
        staffId: s.staffId,
        staffName: s.staffName,
        startDateTime: s.startDateTime,
        id: s.id
      })));
    }
    
    return grouped;
  }, [groupedSlots, weekDays, timezone, pendingAvailabilityAdditions, pendingAvailabilityDeletions, selectedServiceId, allServices, staffArray]);

  const navigateWeek = (direction: "prev" | "next") => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
    setCurrentWeekStart(newDate);
    setEditingBooking(null);
    setUnsavedChanges(false);
  };

  const handleEditBooking = (booking: FakeBooking) => {
    setEditingBooking({ ...booking });
    setUnsavedChanges(false);
  };

  const handleUpdateEditingBooking = (updates: Partial<FakeBooking>) => {
    if (!editingBooking) return;
    setEditingBooking({ ...editingBooking, ...updates });
    setUnsavedChanges(true);
  };

  const handleSaveChanges = async () => {
    if (!editingBooking || !workspace) return;

    setIsSaving(true);
    try {
      const isNewBooking = editingBooking.id.startsWith('temp-');
      
      if (isNewBooking) {
        // Create new booking via public booking API
        // Use memoized businessSlug
        if (!businessSlug) {
          throw new Error('Business subdomain not found');
        }

        const response = await fetch(`/api/public/${businessSlug}/bookings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            service_id: editingBooking.serviceId,
            staff_id: editingBooking.staff?.id || null,
            start_at: editingBooking.startDateTime,
            customer: {
              name: editingBooking.customer.name || 'Admin Created',
              email: editingBooking.customer.email || 'admin@example.com',
              phone: editingBooking.customer.phone || '',
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to create booking');
        }

        const apiResponse = await response.json();
        
        // Add the new booking to workspace
        const newBooking: FakeBooking = {
          ...editingBooking,
          id: apiResponse.booking_id,
          code: apiResponse.booking_code || `REVOL-${apiResponse.booking_id.slice(0, 8).toUpperCase()}`,
        };

        updateWorkspace((w) => ({
          ...w,
          bookings: [...w.bookings, newBooking]
        }));
      } else {
        // For existing bookings, we'll update locally for now
        // In a production app, you'd want a PATCH endpoint
        updateWorkspace((w) => {
          const updatedBookings = w.bookings.map((b) =>
            b.id === editingBooking.id ? editingBooking : b
          );
          return { ...w, bookings: updatedBookings };
        });
      }

      setUnsavedChanges(false);
      setEditingBooking(null);
    } catch (error) {
      console.error("Failed to save booking:", error);
      alert(`Failed to save booking: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSlotClick = (slot: ExpandedAvailabilitySlot) => {
    // Create a new booking for this slot
    const selectedService = allServices.find(s => s.id === selectedServiceId);
    if (!selectedService) return;

    const newBooking: FakeBooking = {
      id: `temp-${Date.now()}`,
      code: `TEMP-${Date.now()}`,
      status: 'pending',
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      categoryName: selectedService.categoryName || '',
      durationMinutes: selectedService.durationMinutes,
      startDateTime: slot.startDateTime,
      endDateTime: slot.endDateTime,
      staff: {
        id: slot.staffId,
        name: slot.staffName,
        color: slot.staffColor,
      },
      customer: {
        name: '',
        email: '',
        phone: '',
      },
      payments: [],
      financials: {
        listPriceCents: selectedService.priceCents,
        giftCardAmountCents: 0,
        platformFeeCents: 0,
        stripeFeeEstimateCents: 0,
        netPayoutCents: 0,
        currency: 'usd',
      },
      policyConsent: {
        hash: '',
        acceptedAt: new Date().toISOString(),
        ip: '',
        userAgent: '',
      },
      requiresAction: false,
    };

    setEditingBooking(newBooking);
    setUnsavedChanges(true);
  };

  const handleEmptySlotClick = (day: Date, hour: number, minute: number = 0) => {
    console.log('[calendar] handleEmptySlotClick called:', {
      day: day.toISOString(),
      hour,
      minute,
      selectedServiceId,
      selectedStaffId,
      currentPendingCount: pendingAvailabilityAdditions.length
    });
    
    if (!selectedServiceId) {
      alert('Please select a service first');
      return;
    }
    
    // If a specific staff member is selected, add to pending directly
    if (selectedStaffId !== "any") {
      // Check if this slot is already pending
      const alreadyPending = pendingAvailabilityAdditions.some(
        (pending) =>
          pending.staffId === selectedStaffId &&
          pending.date.toDateString() === day.toDateString() &&
          pending.hour === hour &&
          pending.minute === minute
      );
      
      console.log('[calendar] Slot click - alreadyPending:', alreadyPending);
      
      if (alreadyPending) {
        // Remove it if clicking again (toggle)
        setPendingAvailabilityAdditions((prev) => {
          const filtered = prev.filter(
            (pending) =>
              !(pending.staffId === selectedStaffId &&
                pending.date.toDateString() === day.toDateString() &&
                pending.hour === hour &&
                pending.minute === minute)
        );
          console.log('[calendar] Removed from pending, new count:', filtered.length);
          return filtered;
        });
      } else {
        // Check for conflicts before adding to pending
        const selectedService = allServices.find(s => s.id === selectedServiceId);
        if (!selectedService) {
          alert('Service not found');
          return;
        }
        
        // Round clicked time to nearest 30-minute block (0 or 30)
        const roundedMinute = Math.floor(minute / 30) * 30;
        const roundedClickedMinutes = hour * 60 + roundedMinute;
        
        // Round service duration to nearest 30-minute increment (30, 60, 90, etc.)
        const roundedDuration = Math.round(selectedService.durationMinutes / 30) * 30;
        const finalDuration = roundedDuration < 30 ? 30 : roundedDuration;
        
        // Calculate the time range for the new slot (using rounded times)
        const newSlotStartMinutes = roundedClickedMinutes;
        const newSlotEndMinutes = roundedClickedMinutes + finalDuration;
        
        // Check for conflicts with existing slots (from fetchedSlots)
        const weekdayName = formatInTimeZone(day, timezone, { weekday: "long" }).toLowerCase();
        const dateKey = formatInTimeZone(day, timezone, "yyyy-MM-dd");
        
        // Get all existing slots for this staff member on this weekday
        const existingSlotsForStaff = fetchedSlots.filter(slot => {
          const slotDate = new Date(slot.startDateTime);
          const slotDateKey = formatInTimeZone(slotDate, timezone, "yyyy-MM-dd");
          const slotWeekday = formatInTimeZone(slotDate, timezone, { weekday: "long" }).toLowerCase();
          return slot.staffId === selectedStaffId && 
                 slotDateKey === dateKey && 
                 slotWeekday === weekdayName;
        });
        
        // Check if new slot overlaps with any existing slot
        const hasConflict = existingSlotsForStaff.some(slot => {
          const slotStart = new Date(slot.startDateTime);
          const slotEnd = new Date(slot.endDateTime);
          const slotStartMinutes = formatInTimeZone(slotStart, timezone, { hour: "numeric", hour12: false }) * 60 + 
                                   parseInt(formatInTimeZone(slotStart, timezone, { minute: "numeric" }), 10);
          const slotEndMinutes = formatInTimeZone(slotEnd, timezone, { hour: "numeric", hour12: false }) * 60 + 
                                 parseInt(formatInTimeZone(slotEnd, timezone, { minute: "numeric" }), 10);
          
          return timeRangesOverlap(newSlotStartMinutes, newSlotEndMinutes, slotStartMinutes, slotEndMinutes);
        });
        
        // Also check for conflicts with other pending additions for the same staff
        const hasPendingConflict = pendingAvailabilityAdditions.some(pending => {
          if (pending.staffId !== selectedStaffId) return false;
          if (formatInTimeZone(pending.date, timezone, "yyyy-MM-dd") !== dateKey) return false;
          
          // Round pending slot times to 30-minute blocks
          const pendingRoundedMinute = Math.floor(pending.minute / 30) * 30;
          const pendingStartMinutes = pending.hour * 60 + pendingRoundedMinute;
          const pendingRoundedDuration = Math.round(selectedService.durationMinutes / 30) * 30;
          const pendingFinalDuration = pendingRoundedDuration < 30 ? 30 : pendingRoundedDuration;
          const pendingEndMinutes = pendingStartMinutes + pendingFinalDuration;
          
          return timeRangesOverlap(newSlotStartMinutes, newSlotEndMinutes, pendingStartMinutes, pendingEndMinutes);
        });
        
        if (hasConflict || hasPendingConflict) {
          const conflictType = hasConflict ? 'existing availability slot' : 'pending slot';
          alert(`Cannot add slot: This time conflicts with an ${conflictType} for this staff member. The service duration (${finalDuration} minutes) would overlap with another slot.`);
          console.warn(`[calendar] ⚠️ Conflict detected when adding pending slot: ${hour}:${minute.toString().padStart(2, '0')} (rounded to ${hour}:${roundedMinute.toString().padStart(2, '0')}) for staff ${selectedStaffId}`);
          return;
        }
        
        // Add to pending with rounded minute - this ensures slots align to 30-minute blocks
        setPendingAvailabilityAdditions((prev) => {
          const newPending = [
          ...prev,
          { staffId: selectedStaffId, date: day, hour, minute: roundedMinute }
          ];
          console.log('[calendar] Added to pending:', {
            staffId: selectedStaffId,
            date: day.toISOString(),
            hour,
            originalMinute: minute,
            roundedMinute: roundedMinute,
            finalDuration,
            newPendingCount: newPending.length,
            allPending: newPending
          });
          return newPending;
        });
      }
    } else {
      // If "any" is selected, show modal to pick staff
      console.log('[calendar] Opening staff selection modal');
      setAddingAvailability({ date: day, hour, minute: 0 });
    }
  };

  const handleAddAvailabilityForStaff = (staffId: string, date?: Date, hour?: number, minute?: number) => {
    if (!selectedServiceId) return;
    
    // Use provided date/hour/minute or from addingAvailability state
    const targetDate = date || addingAvailability?.date;
    const targetHour = hour !== undefined ? hour : addingAvailability?.hour;
    const targetMinute = minute !== undefined ? minute : (addingAvailability?.minute ?? 0);
    
    if (!targetDate || targetHour === undefined) return;

    // Check if this slot is already pending
    const alreadyPending = pendingAvailabilityAdditions.some(
      (pending) =>
        pending.staffId === staffId &&
        pending.date.toDateString() === targetDate.toDateString() &&
        pending.hour === targetHour &&
        pending.minute === targetMinute
    );
    
    if (alreadyPending) {
      // Remove it if clicking again (toggle)
      setPendingAvailabilityAdditions((prev) =>
        prev.filter(
          (pending) =>
            !(pending.staffId === staffId &&
              pending.date.toDateString() === targetDate.toDateString() &&
              pending.hour === targetHour &&
              pending.minute === targetMinute)
        )
      );
    } else {
      // Add to pending - multiple staff can share the same slot, they will split naturally
      setPendingAvailabilityAdditions((prev) => [
        ...prev,
        { staffId, date: targetDate, hour: targetHour, minute: targetMinute }
      ]);
    }

    // Close modal if it was open
    if (addingAvailability) {
      setAddingAvailability(null);
    }
  };

  const handleSaveAvailability = async () => {
    console.log('[calendar] ===== SAVE AVAILABILITY CALLED =====');
    console.log('[calendar] Save check:', {
      selectedServiceId,
      pendingAdditionsCount: pendingAvailabilityAdditions.length,
      pendingDeletionsCount: pendingAvailabilityDeletions.length
    });
    
    if (!selectedServiceId) {
      alert('Please select a service first');
      console.log('[calendar] ❌ No service selected - EXITING');
      return;
    }

    if (pendingAvailabilityAdditions.length === 0 && pendingAvailabilityDeletions.length === 0) {
      alert('No changes to save. Add or remove availability slots first.');
      console.log('[calendar] ❌ No pending changes - EXITING');
      return;
    }

    console.log('[calendar] ✅ Proceeding with save:', {
      additions: pendingAvailabilityAdditions.length,
      deletions: pendingAvailabilityDeletions.length,
      serviceId: selectedServiceId
    });

    setIsSavingAvailability(true);
    try {
      // Get auth token from Supabase client
      const supabase = createClientClient();
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      // Get current availability for ALL services (API replaces everything)
      console.log('[calendar] Fetching current availability...');
      const response = await fetch('/api/business/onboarding/step-7-availability', {
        headers: {
          ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
        },
        credentials: 'include',
      });
      
      let allAvailability: any[] = [];
      if (response.ok) {
        const data = await response.json();
        allAvailability = data.availability || [];
        console.log('[calendar] Fetched availability for', allAvailability.length, 'services');
        
        // Normalize all slot times from HH:mm:ss to HH:mm
        allAvailability = allAvailability.map((svc: any) => ({
          ...svc,
          staff: svc.staff.map((staff: any) => ({
            ...staff,
            slots: staff.slots.map((slot: any) => ({
              ...slot,
              startTime: normalizeTime(slot.startTime),
              endTime: normalizeTime(slot.endTime)
            }))
          }))
        }));
        console.log('[calendar] Normalized time formats to HH:mm');
      } else {
        console.error('[calendar] Failed to fetch current availability:', response.status, response.statusText);
      }

      const selectedService = allServices.find(s => s.id === selectedServiceId);
      if (!selectedService) {
        console.error('[calendar] Selected service not found:', selectedServiceId);
        return;
      }

      // Find or create service availability entry
      let serviceAvailability = allAvailability.find((avail: any) => avail.serviceId === selectedServiceId);
      
      if (!serviceAvailability) {
        console.log('[calendar] Creating new service availability entry');
        serviceAvailability = {
          serviceId: selectedServiceId,
          staff: []
        };
        allAvailability.push(serviceAvailability);
      }

      // First, process deletions - remove slots that match pending deletions
      // IMPORTANT: Only process deletions for the selected service
      // Filter deletions to only include those for the current selectedServiceId (if serviceId is present)
      const deletionsForThisService = pendingAvailabilityDeletions.filter(deletion => 
        !deletion.serviceId || deletion.serviceId === selectedServiceId
      );
      
      console.log('[calendar] Processing', deletionsForThisService.length, 'deletions for service:', selectedServiceId);
      console.log('[calendar] Filtered out', pendingAvailabilityDeletions.length - deletionsForThisService.length, 'deletions for other services');
      
      for (const deletion of deletionsForThisService) {
        const staffId = deletion.staffId;

        // Use direct matching fields if available (from clear all), otherwise calculate from hour/minute
        let weekday: string;
        let startTime: string;
        let endTime: string;
        
        if (deletion.day && deletion.startTime && deletion.endTime) {
          // Direct matching - use the actual values from the slot
          weekday = deletion.day;
          startTime = deletion.startTime;
          endTime = deletion.endTime;
          console.log(`[calendar] Using direct matching for deletion: ${weekday} ${startTime}-${endTime}`);
        } else {
          // Legacy matching - calculate from hour/minute (for backward compatibility)
          const targetDate = deletion.date;
          const targetHour = deletion.hour;
          
          // Get weekday name from the date (timezone-aware) - use lowercase to match API format
          const weekdayName = formatInTimeZone(targetDate, timezone, { weekday: "long" });
          weekday = weekdayName.toLowerCase(); // API returns lowercase day names
          
          // Format time as HH:mm - round to 30-minute block (0 or 30)
          const targetMinute = deletion.minute !== undefined ? Math.floor(deletion.minute / 30) * 30 : 0;
          startTime = `${String(targetHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')}`;
          
          // Round service duration to nearest 30-minute increment (30, 60, 90, etc.)
          const roundedDuration = Math.round(selectedService.durationMinutes / 30) * 30;
          const finalDuration = roundedDuration < 30 ? 30 : roundedDuration;
          
          // Calculate end time based on rounded service duration
          const startMinutes = targetHour * 60 + targetMinute;
          const endMinutes = startMinutes + finalDuration;
          const endHour = Math.floor(endMinutes / 60);
          const endMin = endMinutes % 60;
          endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
        }

        // Find staff availability entry within the selected service's availability only
        const staffAvailability = serviceAvailability.staff.find((s: any) => s.staffId === staffId);
        
        if (staffAvailability) {
          const beforeCount = staffAvailability.slots.length;
          // Remove matching slots (normalize times for comparison - they might be in HH:mm:ss format)
          staffAvailability.slots = staffAvailability.slots.filter((slot: any) => {
            const slotStartTime = normalizeTime(slot.startTime);
            const slotEndTime = normalizeTime(slot.endTime);
            const slotDay = slot.day.toLowerCase();
            
            // Match by day, startTime, and endTime
            const matches = slotDay === weekday && 
                           slotStartTime === startTime && 
                           slotEndTime === endTime;
            
            if (matches) {
              console.log(`[calendar] Matched slot for deletion: ${slotDay} ${slotStartTime}-${slotEndTime}`);
            }
            
            return !matches;
          });
          const afterCount = staffAvailability.slots.length;
          const deletedCount = beforeCount - afterCount;
          console.log(`[calendar] Deleted ${deletedCount} slot(s) for service ${selectedServiceId}, staff ${staffId}: ${weekday} ${startTime}-${endTime}, slots: ${beforeCount} -> ${afterCount}`);
          
          // Remove staff entry if no slots left
          if (staffAvailability.slots.length === 0) {
            serviceAvailability.staff = serviceAvailability.staff.filter((s: any) => s.staffId !== staffId);
            console.log(`[calendar] Removed staff entry (no slots left): ${staffId}`);
          }
        } else {
          console.warn(`[calendar] Staff availability not found for deletion in service ${selectedServiceId}: ${staffId}`);
        }
      }

      // Then, process additions - add new slots
      console.log('[calendar] ===== PROCESSING ADDITIONS =====');
      console.log('[calendar] Processing', pendingAvailabilityAdditions.length, 'additions');
      
      // Group pending additions by date and hour to calculate proper time slots when multiple staff share a slot
      const pendingByTimeSlot: Record<string, Record<string, Array<{staffId: string; date: Date; hour: number; minute: number}>>> = {};
      
      pendingAvailabilityAdditions.forEach((pending) => {
        const dateKey = formatInTimeZone(pending.date, timezone, "yyyy-MM-dd");
        // Group by hour block for calculating positions (all slots in same hour share positions)
        const timeKey = `${pending.hour}:00`;
        
        if (!pendingByTimeSlot[dateKey]) {
          pendingByTimeSlot[dateKey] = {};
        }
        if (!pendingByTimeSlot[dateKey][timeKey]) {
          pendingByTimeSlot[dateKey][timeKey] = [];
        }
        pendingByTimeSlot[dateKey][timeKey].push(pending);
      });
      
      // Process each time slot group
      Object.entries(pendingByTimeSlot).forEach(([dateKey, timeSlots]) => {
        Object.entries(timeSlots).forEach(([timeKey, pendingList]) => {
          const baseHour = parseInt(timeKey.split(':')[0], 10);
          
          // Get existing slots at this time for this service to determine positions
          // Need to get the weekday from the actual date, not today
          const firstPending = pendingList[0];
          const weekdayName = formatInTimeZone(firstPending.date, timezone, { weekday: "long" }).toLowerCase();
          
          const existingSlotsAtTime: Array<{staffId: string; startTime: string}> = [];
          serviceAvailability.staff.forEach((staff: any) => {
            staff.slots.forEach((slot: any) => {
              const slotStartHour = parseInt(slot.startTime.split(':')[0], 10);
              // Check if slot is in the same hour block (base hour)
              if (slot.day === weekdayName && slotStartHour === baseHour) {
                existingSlotsAtTime.push({
                  staffId: staff.staffId,
                  startTime: slot.startTime
                });
              }
            });
          });
          
          // Combine existing and pending staff IDs, sort for consistent ordering
          const allStaffIds = [
            ...existingSlotsAtTime.map(s => s.staffId),
            ...pendingList.map(p => p.staffId)
          ];
          const uniqueStaffIds = Array.from(new Set(allStaffIds));
          uniqueStaffIds.sort();
          
          // Group pending additions by exact clicked time (hour + minute)
          // Staff clicking the same exact time segment should share the same start time
          const pendingByExactTime: Record<string, Array<{staffId: string; date: Date; hour: number; minute: number}>> = {};
          pendingList.forEach((pending) => {
            const exactTimeKey = `${pending.hour}:${pending.minute.toString().padStart(2, '0')}`;
            if (!pendingByExactTime[exactTimeKey]) {
              pendingByExactTime[exactTimeKey] = [];
            }
            pendingByExactTime[exactTimeKey].push(pending);
          });
          
          // Process each exact time group - all staff at same clicked time use the same start time
          Object.entries(pendingByExactTime).forEach(([exactTimeKey, exactTimePendingList]) => {
            const [exactHour, exactMinute] = exactTimeKey.split(':').map(Number);
            // Round clicked time to nearest 30-minute block (0 or 30)
            const clickedRoundedMinute = Math.floor(exactMinute / 30) * 30;
            const clickedTimeMinutes = exactHour * 60 + clickedRoundedMinute;
            
            // All staff clicking this exact time segment use the same start time (rounded to 30-min block)
            const startMinutes = clickedTimeMinutes;
            const startHour = Math.floor(startMinutes / 60);
            const startMin = startMinutes % 60;
            const startTime = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
            
            // Round service duration to nearest 30-minute increment (30, 60, 90, etc.)
            const roundedDuration = Math.round(selectedService.durationMinutes / 30) * 30;
            // Minimum duration is 30 minutes
            const finalDuration = roundedDuration < 30 ? 30 : roundedDuration;
            
            // Calculate end time based on rounded service duration
            const endMinutes = startMinutes + finalDuration;
            const endHour = Math.floor(endMinutes / 60);
            const endMin = endMinutes % 60;
            const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
            
            // Process all staff in this exact time group
            exactTimePendingList.forEach((pending) => {
              const targetDate = pending.date;
              const staffId = pending.staffId;

              // Get weekday name from the date (timezone-aware) - use lowercase to match API format
              const weekdayName = formatInTimeZone(targetDate, timezone, { weekday: "long" });
              const weekday = weekdayName.toLowerCase(); // API expects lowercase day names
              
              // Get the actual date string in the business timezone
              const dateInTimezone = formatInTimeZone(targetDate, timezone, "yyyy-MM-dd");
              
              console.log('[calendar] Processing addition:', {
                staffId,
                clickedHour: exactHour,
                clickedMinute: exactMinute,
                roundedTo30Min: clickedRoundedMinute,
                originalDuration: selectedService.durationMinutes,
                roundedDuration: finalDuration,
                startTime,
                endTime,
                dateInTimezone,
                weekday,
                timezone,
                totalStaffInExactTime: exactTimePendingList.length
              });

              // Find or create staff availability entry
              let staffAvailability = serviceAvailability.staff.find((s: any) => s.staffId === staffId);
              
              if (!staffAvailability) {
                console.log(`[calendar] Creating new staff availability entry: ${staffId}`);
                staffAvailability = {
                  staffId: staffId,
                  slots: []
                };
                serviceAvailability.staff.push(staffAvailability);
              } else {
                console.log(`[calendar] Found existing staff availability entry with ${staffAvailability.slots.length} slots`);
              }

              // Check for conflicts with existing slots for the same staff member
              // A conflict occurs if the new slot overlaps with any existing slot for the same staff
              const newSlotStartMinutes = timeToMinutes(startTime);
              const newSlotEndMinutes = timeToMinutes(endTime);
              
              const hasConflict = staffAvailability.slots.some((existingSlot: any) => {
                // Only check slots on the same weekday
                if (existingSlot.day !== weekday) return false;
                
                const existingStartMinutes = timeToMinutes(normalizeTime(existingSlot.startTime));
                const existingEndMinutes = timeToMinutes(normalizeTime(existingSlot.endTime));
                
                // Check if time ranges overlap
                const overlaps = timeRangesOverlap(
                  newSlotStartMinutes, newSlotEndMinutes,
                  existingStartMinutes, existingEndMinutes
                );
                
                if (overlaps) {
                  console.warn(`[calendar] ⚠️ Conflict detected: New slot ${startTime}-${endTime} overlaps with existing slot ${existingSlot.startTime}-${existingSlot.endTime} for staff ${staffId}`);
                }
                
                return overlaps;
              });
              
              if (hasConflict) {
                console.error(`[calendar] ❌ Cannot add slot: ${weekday} ${startTime}-${endTime} for staff ${staffId} - conflicts with existing slot`);
                alert(`Cannot add slot: This time conflicts with an existing availability slot for this staff member. The service duration (${finalDuration} minutes) would overlap with another slot.`);
                return; // Skip adding this slot
              }

              // Add the slot if no conflicts
                const newSlot = {
                  id: `slot-${Date.now()}-${Math.random()}`,
                  day: weekday,
                  startTime: startTime,
                  endTime: endTime
                };
                staffAvailability.slots.push(newSlot);
              console.log(`[calendar] ✅ Added slot: ${weekday} ${startTime}-${endTime} (${finalDuration} min) for staff ${staffId}`, newSlot);
            });
          });
        });
      });
      
      console.log('[calendar] ===== FINISHED PROCESSING ADDITIONS =====');
      console.log('[calendar] Service availability after additions:', JSON.stringify(serviceAvailability, null, 2));

      // Remove service entry if no staff left
      if (serviceAvailability.staff.length === 0) {
        allAvailability = allAvailability.filter((avail: any) => avail.serviceId !== selectedServiceId);
        console.log('[calendar] Removed service entry (no staff left)');
      }

      // Count total slots to save
      const totalSlots = allAvailability.reduce((sum, svc) => 
        sum + svc.staff.reduce((staffSum: number, staff: any) => staffSum + staff.slots.length, 0), 0
      );
      
      // Log detailed info about what we're saving
      const selectedServiceSlots = serviceAvailability.staff.reduce((sum: number, staff: any) => sum + staff.slots.length, 0);
      console.log('[calendar] Saving availability:', {
        services: allAvailability.length,
        totalSlots: totalSlots,
        selectedServiceSlots: selectedServiceSlots,
        selectedServiceId: selectedServiceId,
        availabilityData: JSON.stringify(allAvailability, null, 2)
      });
      
      // Log each slot being saved for the selected service
      serviceAvailability.staff.forEach((staff: any) => {
        staff.slots.forEach((slot: any) => {
          console.log(`[calendar] Saving slot: ${slot.day} ${slot.startTime}-${slot.endTime} for staff ${staff.staffId}`);
        });
      });

      // Validate data before sending
      for (const svc of allAvailability) {
        if (!svc.serviceId) {
          throw new Error('Invalid availability data: missing serviceId');
        }
        if (!Array.isArray(svc.staff)) {
          throw new Error('Invalid availability data: staff must be an array');
        }
        for (const staff of svc.staff) {
          if (!staff.staffId) {
            throw new Error('Invalid availability data: missing staffId');
          }
          if (!Array.isArray(staff.slots)) {
            throw new Error('Invalid availability data: slots must be an array');
          }
          for (const slot of staff.slots) {
            if (!slot.day || !slot.startTime || !slot.endTime) {
              throw new Error(`Invalid slot data: missing day/startTime/endTime: ${JSON.stringify(slot)}`);
            }
            // Normalize time format (convert HH:mm:ss to HH:mm if needed)
            slot.startTime = normalizeTime(slot.startTime);
            slot.endTime = normalizeTime(slot.endTime);
            
            // Validate time format (HH:mm)
            const timeRegex = /^\d{2}:\d{2}$/;
            if (!timeRegex.test(slot.startTime) || !timeRegex.test(slot.endTime)) {
              throw new Error(`Invalid time format: ${slot.startTime} or ${slot.endTime} (expected HH:mm)`);
            }
          }
        }
      }

      // Save all changes to API
      console.log('[calendar] Sending PUT request to /api/business/onboarding/step-7-availability');
      const saveResponse = await fetch('/api/business/onboarding/step-7-availability', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
        },
        credentials: 'include',
        body: JSON.stringify({
          availability: allAvailability
        }),
      });

      console.log('[calendar] Save response status:', saveResponse.status, saveResponse.statusText);

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json().catch(() => ({}));
        console.error('[calendar] Save failed:', errorData);
        throw new Error(errorData.error || `Failed to save availability: ${saveResponse.status} ${saveResponse.statusText}`);
      }

      const saveResult = await saveResponse.json();
      console.log('[calendar] Save successful:', saveResult);

      // Store pending additions before clearing - we'll check if they appear after refetch
      const savedPendingAdditions = [...pendingAvailabilityAdditions];
      
      // Small delay to ensure database transaction has committed
      console.log('[calendar] Waiting for database to commit...');
      await new Promise(resolve => setTimeout(resolve, 1500)); // Increased delay to ensure DB commit
      
      // Reset fetch ref to allow refetch
      isFetchingRef.current = false;
      
      // Force refetch by resetting the ref and calling fetchAvailability
      console.log('[calendar] Refetching availability...');
      setIsLoadingAvailability(true); // Show loading state
      
      // Clear existing slots to force fresh render
      setFetchedSlots([]);
      
      // Refetch availability - this will update fetchedSlots state
      // Use a fresh fetch with updated cache-busting
      console.log('[calendar] Starting fetchAvailability...');
      await fetchAvailability();
      
      // Wait a bit more to ensure state has updated
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Log fetched slots count after fetch
      console.log('[calendar] After fetchAvailability, checking fetchedSlots state...');
      
      // Also refetch current availability rules - this will generate admin slots from rules
      // Add cache-busting to ensure we get fresh data from database
      console.log('[calendar] Refetching availability rules from database...');
      const rulesResponse = await fetch('/api/business/onboarding/step-7-availability?' + new URLSearchParams({
        _t: Date.now().toString(),
        _r: Math.random().toString()
      }), {
        headers: {
          ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        credentials: 'include',
        cache: 'no-store',
      });
      
      if (rulesResponse.ok) {
        const rulesData = await rulesResponse.json();
        if (rulesData.availability && Array.isArray(rulesData.availability)) {
          const serviceAvailability = rulesData.availability.find(
            (avail: any) => avail.serviceId === selectedServiceId
          );
          // Update currentAvailability - this will trigger adminSlotsFromRules to recalculate
          setCurrentAvailability(serviceAvailability ? [serviceAvailability] : []);
          console.log('[calendar] ✅ Availability rules refetched successfully:', {
            totalServices: rulesData.availability.length,
            selectedServiceRules: serviceAvailability ? serviceAvailability.staff?.reduce((sum: number, s: any) => sum + (s.slots?.length || 0), 0) : 0,
            hasServiceAvailability: !!serviceAvailability
          });
        } else {
          console.warn('[calendar] ⚠️ No availability data in response');
          setCurrentAvailability([]);
        }
      } else {
        console.warn('[calendar] ⚠️ Failed to refetch availability rules, using cached fetchCurrentAvailability');
        await fetchCurrentAvailability();
      }
      
      console.log('[calendar] Availability refetched successfully');
      
      // Wait a moment for state to settle before clearing
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Clear all pending additions and deletions FIRST - this will hide the pending banner immediately
      console.log('[calendar] Clearing pending changes - slots are now saved and will appear from rules');
      setPendingAvailabilityAdditions([]);
      setPendingAvailabilityDeletions([]);
      
      // Clear selected slots - user's selection is no longer needed
      setSelectedSlots(new Set());
      
      // Set loading to false after everything is cleared
      setIsLoadingAvailability(false);
      
      // Force a re-render by updating fetchedSlots
      // This ensures the UI reflects the updated availability (with deletions applied)
      setFetchedSlots(prev => {
        console.log('[calendar] Force re-render with', prev.length, 'slots');
        if (prev.length === 0) {
          console.log('[calendar] ✅ No slots remaining after deletion - this is expected if all were deleted');
        } else {
          console.log('[calendar] ✅ Successfully found', prev.length, 'slots after refetch');
        }
        return [...prev];
      });
      
      // Force a state update to ensure React re-renders with cleared pending state
      // This ensures the pending banner disappears
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('[calendar] ✅ All state cleared and UI reset after successful save');
    } catch (error) {
      console.error('[calendar] Error saving availability:', error);
      alert(`Failed to save availability: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSavingAvailability(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingBooking(null);
    setUnsavedChanges(false);
  };

  // Toggle slot selection - used when clicking on filled slots
  const handleToggleSlotSelection = (slot: ExpandedAvailabilitySlot, day: Date, segment: { hour: number; minute: number }) => {
    if (!selectedServiceId) return;
    
    // Only allow selection of saved slots (not pending additions)
    if (slot.id.startsWith('pending-')) return;
    
    setSelectedSlots(prev => {
      const newSet = new Set(prev);
      if (newSet.has(slot.id)) {
        newSet.delete(slot.id);
      } else {
        newSet.add(slot.id);
      }
      return newSet;
    });
  };

  // Delete selected slots - adds them to pending deletions
  const handleDeleteSelectedSlots = () => {
    if (!selectedServiceId || selectedSlots.size === 0) return;
    
    console.log('[calendar] Deleting selected slots:', {
      selectedSlotsCount: selectedSlots.size,
      selectedSlotIds: Array.from(selectedSlots),
      mergedSlotsCount: mergedSlots.length,
      fetchedSlotsCount: fetchedSlots.length,
      adminSlotsCount: adminSlotsFromRules.length
    });
    
    const selectedService = allServices.find(s => s.id === selectedServiceId);
    if (!selectedService) return;
    
    const deletionsToAdd: Array<{
      staffId: string;
      date: Date;
      hour: number;
      minute?: number;
      slotId: string;
      serviceId: string;
      day?: string;
      startTime?: string;
      endTime?: string;
    }> = [];
    
    // Find all selected slots in mergedSlots (which includes both adminSlotsFromRules and fetchedSlots)
    // This is what's actually displayed in the calendar
    mergedSlots.forEach(slot => {
      if (selectedSlots.has(slot.id) && slot.serviceId === selectedServiceId && !slot.id.startsWith('pending-')) {
        console.log('[calendar] Processing selected slot for deletion:', {
          slotId: slot.id,
          staffId: slot.staffId,
          startDateTime: slot.startDateTime,
          isFromRules: slot.id.startsWith('rule-')
        });
        const slotDate = new Date(slot.startDateTime);
        const slotHour = parseInt(formatInTimeZone(slotDate, timezone, { hour: "numeric", hour12: false }), 10);
        const slotMinute = parseInt(formatInTimeZone(slotDate, timezone, { minute: "numeric" }), 10);
        const slotRoundedMinute = Math.floor(slotMinute / 30) * 30;
        const weekdayName = formatInTimeZone(slotDate, timezone, { weekday: "long" }).toLowerCase();
        
        // Try to get actual startTime and endTime from currentAvailability
        const serviceAvailability = currentAvailability.find((avail: any) => avail.serviceId === selectedServiceId);
        let normalizedStartTime: string | undefined;
        let normalizedEndTime: string | undefined;
        
        // If slot ID starts with "rule-", try to parse the rule information from the ID
        // Format: rule-${staffId}-${day}-${startTime}-${currentMinutes}-${date}
        if (slot.id.startsWith('rule-')) {
          const ruleParts = slot.id.split('-');
          if (ruleParts.length >= 4) {
            // Extract day and startTime from the rule ID
            const ruleDay = ruleParts[2]; // e.g., "tuesday"
            const ruleStartTime = ruleParts[3]; // e.g., "08:00"
            
            // Find the matching rule in currentAvailability
            if (serviceAvailability) {
              const staffEntry = serviceAvailability.staff.find((s: any) => s.staffId === slot.staffId);
              if (staffEntry && staffEntry.slots) {
                const matchingSlot = staffEntry.slots.find((s: any) => {
                  return s.day.toLowerCase() === ruleDay.toLowerCase() && 
                         normalizeTime(s.startTime) === normalizeTime(ruleStartTime);
                });
                
                if (matchingSlot) {
                  normalizedStartTime = normalizeTime(matchingSlot.startTime);
                  normalizedEndTime = normalizeTime(matchingSlot.endTime);
                  console.log('[calendar] Found matching rule slot in currentAvailability:', {
                    day: ruleDay,
                    startTime: normalizedStartTime,
                    endTime: normalizedEndTime
                  });
                }
              }
            }
          }
        }
        
        // If we still don't have the times, try to find by day and time matching
        if (!normalizedStartTime || !normalizedEndTime) {
          if (serviceAvailability) {
            const staffEntry = serviceAvailability.staff.find((s: any) => s.staffId === slot.staffId);
            if (staffEntry && staffEntry.slots) {
              // Find matching slot by day and approximate time
              // Match by day and hour (within 30-minute tolerance)
              const matchingSlot = staffEntry.slots.find((s: any) => {
                const slotDay = s.day.toLowerCase();
                const [slotStartHour, slotStartMin] = s.startTime.split(':').map(Number);
                const slotStartRoundedMin = Math.floor(slotStartMin / 30) * 30;
                return slotDay === weekdayName && 
                       slotStartHour === slotHour && 
                       slotStartRoundedMin === slotRoundedMinute;
              });
              
              if (matchingSlot) {
                normalizedStartTime = normalizeTime(matchingSlot.startTime);
                normalizedEndTime = normalizeTime(matchingSlot.endTime);
                console.log('[calendar] Found matching slot in currentAvailability by time match:', {
                  day: weekdayName,
                  startTime: normalizedStartTime,
                  endTime: normalizedEndTime
                });
              } else {
                console.warn('[calendar] Could not find matching slot in currentAvailability for:', {
                  slotId: slot.id,
                  day: weekdayName,
                  hour: slotHour,
                  minute: slotRoundedMinute
                });
              }
            }
          }
        }
        
        // If we still couldn't find the exact match, calculate from the slot's datetime
        if (!normalizedStartTime || !normalizedEndTime) {
          normalizedStartTime = `${String(slotHour).padStart(2, '0')}:${String(slotRoundedMinute).padStart(2, '0')}`;
          const slotEnd = new Date(slot.endDateTime);
          const endHour = parseInt(formatInTimeZone(slotEnd, timezone, { hour: "numeric", hour12: false }), 10);
          const endMinute = parseInt(formatInTimeZone(slotEnd, timezone, { minute: "numeric" }), 10);
          const endRoundedMinute = Math.floor(endMinute / 30) * 30;
          normalizedEndTime = `${String(endHour).padStart(2, '0')}:${String(endRoundedMinute).padStart(2, '0')}`;
          console.log('[calendar] Calculated times from slot datetime:', {
            startTime: normalizedStartTime,
            endTime: normalizedEndTime
          });
        }
        
        deletionsToAdd.push({
          staffId: slot.staffId,
          date: slotDate,
          hour: slotHour,
          minute: slotRoundedMinute,
          slotId: slot.id,
          serviceId: selectedServiceId,
          day: weekdayName,
          startTime: normalizedStartTime,
          endTime: normalizedEndTime
        });
      }
    });
    
    if (deletionsToAdd.length === 0) {
      console.warn('[calendar] No deletions to add - selected slots may not be valid');
      console.warn('[calendar] Debug info:', {
        selectedSlots: Array.from(selectedSlots),
        mergedSlotsIds: mergedSlots.map(s => s.id).slice(0, 10), // First 10 for debugging
        selectedServiceId,
        mergedSlotsCount: mergedSlots.length
      });
      
      // Try to find why slots aren't matching
      Array.from(selectedSlots).forEach(selectedId => {
        const foundInMerged = mergedSlots.find(s => s.id === selectedId);
        const foundInFetched = fetchedSlots.find(s => s.id === selectedId);
        const foundInAdmin = adminSlotsFromRules.find(s => s.id === selectedId);
        console.warn(`[calendar] Slot ${selectedId}:`, {
          foundInMerged: !!foundInMerged,
          foundInFetched: !!foundInFetched,
          foundInAdmin: !!foundInAdmin,
          slotServiceId: foundInMerged?.serviceId,
          matchesSelectedService: foundInMerged?.serviceId === selectedServiceId
        });
      });
      
      return;
    }
    
    // Add to pending deletions (merge with existing)
    setPendingAvailabilityDeletions(prev => {
      const existingIds = new Set(prev.map(d => d.slotId));
      const newDeletions = deletionsToAdd.filter(d => !existingIds.has(d.slotId));
      return [...prev, ...newDeletions];
    });
    
    // Clear selection
    setSelectedSlots(new Set());
    
    console.log('[calendar] Added', deletionsToAdd.length, 'selected slots to pending deletions');
  };

  const handleClearAllAvailability = () => {
    if (!selectedServiceId) return;
    
    // IMPORTANT: This function ONLY clears availability for the selected service
    // It does NOT affect other services' availability
    
    // Get all existing slots for the selected service from currentAvailability (database rules)
    const allSlotsToDelete: Array<{
      staffId: string;
      date: Date;
      hour: number;
      minute?: number;
      slotId: string;
      serviceId: string;
      // Direct slot matching fields (for more reliable matching)
      day?: string; // weekday name (lowercase)
      startTime?: string; // Actual startTime from slot (HH:mm)
      endTime?: string; // Actual endTime from slot (HH:mm)
    }> = [];
    
    // Find the service availability in currentAvailability - ONLY for the selected service
    const serviceAvailability = currentAvailability.find(
      (avail: any) => avail.serviceId === selectedServiceId
    );
    
    if (!serviceAvailability) {
      console.log('[calendar] No availability found for service:', selectedServiceId);
      return;
    }
    
    if (serviceAvailability && serviceAvailability.staff) {
      // Process each staff member's slots for THIS service only
      serviceAvailability.staff.forEach((staffEntry: any) => {
        if (staffEntry.slots && Array.isArray(staffEntry.slots)) {
          staffEntry.slots.forEach((slot: any) => {
            // Validate slot has required fields
            if (!slot.day || !slot.startTime || !slot.endTime) {
              console.warn('[calendar] Skipping invalid slot:', slot);
              return;
            }
            
            // Get a representative date for this weekday
            // Map weekday name to a date in the current week
            const weekdayMap: Record<string, number> = {
              sunday: 0,
              monday: 1,
              tuesday: 2,
              wednesday: 3,
              thursday: 4,
              friday: 5,
              saturday: 6,
            };
            
            const weekdayNum = weekdayMap[slot.day.toLowerCase()];
            if (weekdayNum === undefined) {
              console.warn('[calendar] Invalid weekday in slot:', slot.day);
              return;
            }
            
            // Get the date for this weekday in the current week
            const weekDayDate = new Date(currentWeekStart);
            weekDayDate.setDate(currentWeekStart.getDate() + weekdayNum);
            
            // Parse start time to get hour and minute - use ACTUAL values from slot
            const timeParts = slot.startTime.split(':');
            if (timeParts.length < 2) {
              console.warn('[calendar] Invalid startTime format:', slot.startTime);
              return;
            }
            
            const [startHour, startMin] = timeParts.map(Number);
            
            // Normalize the slot times (in case they're in HH:mm:ss format)
            const normalizedStartTime = normalizeTime(slot.startTime);
            const normalizedEndTime = normalizeTime(slot.endTime);
            
            // Validate normalized times
            if (!normalizedStartTime || !normalizedEndTime) {
              console.warn('[calendar] Failed to normalize times:', { startTime: slot.startTime, endTime: slot.endTime });
              return;
            }
            
            // Create a unique slot ID for this deletion
            const slotId = `clear-${selectedServiceId}-${staffEntry.staffId}-${slot.day.toLowerCase()}-${normalizedStartTime}-${normalizedEndTime}`;
            
            allSlotsToDelete.push({
              staffId: staffEntry.staffId,
              date: weekDayDate,
              hour: startHour,
              minute: startMin, // Store actual minute from slot
              slotId: slotId,
              serviceId: selectedServiceId, // Explicitly track which service this deletion is for
              day: slot.day.toLowerCase(), // Store actual day for direct matching
              startTime: normalizedStartTime, // Store actual startTime for direct matching
              endTime: normalizedEndTime // Store actual endTime for direct matching
            });
          });
        }
      });
    } else {
      console.warn('[calendar] Service availability has no staff entries or is invalid');
    }
    
    // Remove any duplicates (same slotId)
    const uniqueDeletions = Array.from(
      new Map(allSlotsToDelete.map(del => [del.slotId, del])).values()
    );
    
    console.log('[calendar] Clearing availability for service:', selectedServiceId);
    console.log('[calendar] Found', uniqueDeletions.length, 'unique slots to delete');
    console.log('[calendar] Service availability before clear:', {
      staffCount: serviceAvailability.staff?.length || 0,
      totalSlots: serviceAvailability.staff?.reduce((sum: number, s: any) => sum + (s.slots?.length || 0), 0) || 0
    });
    
    // Add all slots to pending deletions (replace existing)
    // These deletions will only affect the selected service when saved
    setPendingAvailabilityDeletions(uniqueDeletions);
    
    // Clear any pending additions for this service
    setPendingAvailabilityAdditions([]);
    
    // Log what will be deleted
    if (uniqueDeletions.length > 0) {
      console.log('[calendar] Slots to be deleted:', uniqueDeletions.map(d => 
        `${d.day} ${d.startTime}-${d.endTime} (staff: ${d.staffId})`
      ));
    } else {
      console.warn('[calendar] ⚠️ No slots found to delete! This might indicate an issue.');
    }
  };

  const monthYear = formatInTimeZone(weekDays[0], timezone, { month: "long", year: "numeric" });
  const selectedService = allServices.find(s => s.id === selectedServiceId);
  
  // Count existing slots for the selected service
  const existingSlotsCount = useMemo(() => {
    if (!selectedServiceId) return 0;
    return fetchedSlots.filter(slot => slot.serviceId === selectedServiceId).length;
  }, [fetchedSlots, selectedServiceId]);

    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.35em] text-white/40">Scheduling</p>
          <h1 className="font-display text-3xl text-white">Calendar</h1>
          <p className="max-w-3xl text-xs text-white/60 leading-relaxed">
            View and edit all bookings in a week view. Select a service and staff member, then click empty time slots to add availability. Click existing availability slots to delete them (when staff is selected) or create bookings. Click existing bookings to edit them.
          </p>
        </header>

        {/* Service Dropdown */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-white/80 block font-semibold text-xs">Filter by Service</Label>
            {selectedServiceId && existingSlotsCount > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearAllAvailability}
                disabled={isSavingAvailability}
                className="h-7 px-3 text-[10px] border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/60"
              >
                <X className="mr-1.5 h-3 w-3" />
                Clear Availability
              </Button>
            )}
          </div>
          <select
            className="w-full rounded-xl border-2 border-white/15 bg-[#050F2C]/70 px-4 py-2.5 text-xs font-medium text-white focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all duration-200 shadow-sm hover:border-white/25"
          value={selectedServiceId || ""}
          onChange={(e) => {
            setSelectedServiceId(e.target.value || null);
            setEditingBooking(null);
            setUnsavedChanges(false);
            // Clear pending availability when changing service
            setPendingAvailabilityAdditions([]);
            setPendingAvailabilityDeletions([]);
            // Clear selected slots when changing service
            setSelectedSlots(new Set());
          }}
        >
          <option value="" className="bg-[#050F2C] text-white">
            All Services
          </option>
          {allServices.map((service) => (
            <option key={service.id} value={service.id} className="bg-[#050F2C] text-white">
              {service.categoryName} - {service.name} ({service.durationMinutes} min · $
              {(service.priceCents / 100).toFixed(2)})
            </option>
          ))}
        </select>
          {selectedService && (
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[10px] text-white/70 font-medium">
                Showing availability for: <strong className="text-white font-semibold">{selectedService.name}</strong>
              </p>
              {existingSlotsCount > 0 && (
                <p className="text-[10px] text-white/50 font-medium">
                  {existingSlotsCount} slot{existingSlotsCount !== 1 ? 's' : ''} scheduled
                </p>
              )}
            </div>
          )}
      </div>

      {/* Save Button - Only show when there are unsaved changes */}
      {unsavedChanges && editingBooking && (
        <div className="flex items-center justify-between rounded-3xl border border-primary/40 bg-primary/10 px-6 py-4">
          <div>
            <p className="text-sm font-semibold text-white">You have unsaved changes</p>
            <p className="text-xs text-white/60">
              {editingBooking.id.startsWith('temp-') ? 'Creating new booking' : `Editing: ${editingBooking.serviceName} · ${editingBooking.customer.name || 'New booking'}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={handleCancelEdit} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveChanges} isLoading={isSaving} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </div>
      )}

      {/* Staff Selection Pills - Only show when service is selected */}
      {selectedServiceId && (
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-4 shadow-sm">
          <Label className="text-white/80 mb-3 block font-semibold text-xs">Select Staff Member</Label>
          <div className="flex flex-wrap items-center gap-2">
            <StaffPill
              label="All Staff"
              active={selectedStaffId === "any"}
              onClick={() => {
                setSelectedStaffId("any");
                // Clear pending when switching to "any"
                setPendingAvailabilityAdditions([]);
                setPendingAvailabilityDeletions([]);
              }}
            />
            {staffArray
              .filter(member => member.active)
              .map((member) => (
                <StaffPill
                  key={member.id}
                  label={member.name}
                  color={member.color}
                  active={selectedStaffId === member.id}
                  onClick={() => {
                    // Don't clear pending when switching - user might want to save for multiple staff
                    setSelectedStaffId(member.id);
                  }}
                />
              ))}
          </div>
          <HelperText className="mt-3 text-[10px] text-white/60 font-medium leading-relaxed">
            {selectedStaffId === "any" 
              ? "Click filled slots (colored) to select them, then click Delete to remove. Or select a staff member to manage availability."
              : `Managing availability for ${staffArray.find(s => s.id === selectedStaffId)?.name}. Click empty time slots to add availability, or click existing slots to delete them. Click "Save" when done.`}
          </HelperText>
          {/* Delete button for selected slots - only show when "any" staff is selected and slots are selected */}
          {selectedStaffId === "any" && selectedSlots.size > 0 && (
            <div className="mt-4 flex items-center justify-between rounded-xl border-2 border-red-500/50 bg-gradient-to-r from-red-500/15 to-red-500/10 px-4 py-3 shadow-lg shadow-red-500/10">
              <div>
                <p className="text-xs font-bold text-white">
                  {selectedSlots.size} slot{selectedSlots.size > 1 ? 's' : ''} selected
                </p>
                <p className="text-[10px] text-white/70 mt-0.5 font-medium">
                  Click "Delete Selected" to mark these slots for deletion, then "Save" to apply
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  onClick={() => setSelectedSlots(new Set())} 
                  disabled={isSavingAvailability}
                  className="hover:bg-white/10 rounded-xl text-xs h-8 px-3"
                >
                  Clear Selection
                </Button>
                <Button 
                  type="button"
                  onClick={handleDeleteSelectedSlots}
                  disabled={isSavingAvailability}
                  className="rounded-xl shadow-md hover:shadow-lg transition-all duration-200 text-xs h-8 px-4 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 hover:text-red-100"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete Selected
                </Button>
              </div>
            </div>
          )}
          {(pendingAvailabilityAdditions.length > 0 || pendingAvailabilityDeletions.length > 0) && (
            <div className={`mt-4 flex items-center justify-between rounded-xl border-2 px-4 py-3 shadow-lg ${
              pendingAvailabilityDeletions.length > 0 && pendingAvailabilityAdditions.length === 0
                ? 'border-red-500/50 bg-gradient-to-r from-red-500/15 to-red-500/10'
                : 'border-primary/50 bg-gradient-to-r from-primary/15 to-primary/10'
            }`}>
              <div>
                <p className="text-xs font-bold text-white">
                  {pendingAvailabilityAdditions.length > 0 && `${pendingAvailabilityAdditions.length} addition${pendingAvailabilityAdditions.length > 1 ? 's' : ''}`}
                  {pendingAvailabilityAdditions.length > 0 && pendingAvailabilityDeletions.length > 0 && ' • '}
                  {pendingAvailabilityDeletions.length > 0 && `${pendingAvailabilityDeletions.length} deletion${pendingAvailabilityDeletions.length > 1 ? 's' : ''}`}
                  {' '}pending
                </p>
                <p className="text-[10px] text-white/70 mt-0.5 font-medium">
                  {pendingAvailabilityDeletions.length > 0 && pendingAvailabilityAdditions.length === 0
                    ? 'Click "Delete" to apply deletions to the booking system'
                    : 'Click "Save" to apply changes to the booking system'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setPendingAvailabilityAdditions([]);
                    setPendingAvailabilityDeletions([]);
                  }} 
                  disabled={isSavingAvailability}
                  className="hover:bg-white/10 rounded-xl text-xs h-8 px-3"
                >
                  Clear
                </Button>
                <Button 
                  type="button"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('[calendar] Save button clicked!');
                    await handleSaveAvailability();
                  }} 
                  isLoading={isSavingAvailability} 
                  disabled={isSavingAvailability}
                  className={`rounded-xl shadow-md hover:shadow-lg transition-all duration-200 text-xs h-8 px-4 ${
                    pendingAvailabilityDeletions.length > 0 && pendingAvailabilityAdditions.length === 0
                      ? 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 hover:text-red-100'
                      : ''
                  }`}
                >
                  {pendingAvailabilityDeletions.length > 0 && pendingAvailabilityAdditions.length === 0 ? (
                    <>
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Delete Availability
                    </>
                  ) : (
                    <>
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                      Save Availability
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Week Navigation */}
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-gradient-to-r from-white/5 to-white/[0.02] px-6 py-3 shadow-sm">
        <Button
          variant="ghost"
          onClick={() => navigateWeek("prev")}
          className="text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <h3 className="text-base font-bold text-white tracking-tight">{monthYear}</h3>
          <p className="text-[10px] text-white/60 mt-0.5 font-medium">
            {formatInTimeZone(weekDays[0], timezone, { month: "short", day: "numeric" })} -{" "}
            {formatInTimeZone(weekDays[6], timezone, { month: "short", day: "numeric" })}
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => navigateWeek("next")}
          className="text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar Grid - Matching Booking Flow Style */}
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-white/[0.02] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_60px_rgba(91,100,255,0.12)] backdrop-blur-sm">
        {isLoadingAvailability ? (
          <div className="rounded-3xl border border-white/10 bg-black/60 p-8 text-center text-white/60">
            <p className="text-base">Loading availability...</p>
          </div>
        ) : availabilityError ? (
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-center text-red-200">
            <p className="text-base">{availabilityError}</p>
          </div>
        ) : !selectedServiceId ? (
          <div className="rounded-3xl border border-white/10 bg-black/60 p-8 text-center text-white/60">
            <p className="text-base">Select a service above to view availability and bookings</p>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-visible">
            <div className="min-w-full relative" style={{ overflow: 'visible' }}>
              {/* Day Headers */}
              <div className="grid grid-cols-8 gap-3 border-b border-white/15 pb-3 mb-2">
                <div className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Time</div>
                {weekDays.map((day, idx) => {
                  const isToday = formatInTimeZone(day, timezone, "yyyy-MM-dd") === formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");
                  return (
                    <div key={idx} className={`text-center rounded-lg py-1.5 transition-colors ${isToday ? 'bg-primary/10 border border-primary/30' : ''}`}>
                      <p className="text-[9px] font-semibold text-white/60 uppercase tracking-wider mb-1">
                      {formatInTimeZone(day, timezone, { weekday: "short" })}
                    </p>
                      <p className={`text-sm font-bold ${isToday ? 'text-primary' : 'text-white'}`}>
                      {formatInTimeZone(day, timezone, { day: "numeric" })}
                    </p>
                  </div>
                  );
                })}
              </div>

              {/* Time Segment Rows */}
              <div className="mt-0.5 relative" style={{ overflow: 'visible' }}>
                {timeSegments.map((segment, segmentIdx) => {
                  const showHourLabel = segment.minute === 0;
                  return (
                    <div key={`${segment.hour}-${segment.minute}`} className={`grid grid-cols-8 gap-3 ${showHourLabel ? 'border-t border-white/12 pt-2 mt-1' : 'border-b border-white/[0.03]'} last:border-0`} style={{ position: 'relative' }}>
                      <div className="flex items-center py-1.5 px-3">
                        {showHourLabel ? (
                          <span className="text-xs font-bold text-white/90 tracking-tight">{segment.label}</span>
                        ) : (
                          <span className="text-[8px] text-white/25 font-mono tracking-wider">{segment.minute}</span>
                        )}
                      </div>
                      {weekDays.map((day, dayIdx) => {
                        const dateKey = formatInTimeZone(day, timezone, "yyyy-MM-dd");
                        const timeKey = `${segment.hour}:${segment.minute.toString().padStart(2, '0')}`;
                        const bookingsForTime = bookingsByDayAndTime[dateKey]?.[timeKey] || [];
                        const slotsForTime = slotsByDayAndTime[dateKey]?.[timeKey] || [];

                        return (
                          <div key={dayIdx} className="py-1" style={{ position: 'relative', minHeight: '3rem' }}>
                            <div className="h-full min-h-[3rem] flex flex-col gap-1.5" style={{ position: 'relative' }}>
                              {/* Show existing bookings first */}
                              {bookingsForTime.map((booking) => {
                                const staffMember = staffArray.find(
                                  (s) => s.id === booking.staff?.id
                                );
                                const isEditing = editingBooking?.id === booking.id;

                                return (
                                  <button
                                    key={booking.id}
                                    type="button"
                                    onClick={() => handleEditBooking(booking)}
                                    className={`w-full rounded-lg border-2 px-2.5 py-1.5 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                                      isEditing
                                        ? "border-primary bg-primary/30 ring-2 ring-primary/50 shadow-xl shadow-primary/30"
                                        : "border-primary/60 bg-primary/20 hover:border-primary/80 hover:bg-primary/30 hover:shadow-lg hover:scale-[1.02]"
                                    }`}
                                    style={{
                                      borderColor: staffMember?.color
                                        ? `${staffMember.color}95`
                                        : undefined,
                                      backgroundColor: staffMember?.color
                                        ? `${staffMember.color}18`
                                        : undefined,
                                      boxShadow: staffMember?.color && !isEditing
                                        ? `0 4px 12px ${staffMember.color}20, 0 2px 4px ${staffMember.color}10`
                                        : undefined
                                    }}
                                  >
                                    <p className="text-[10px] font-bold text-white leading-tight mb-1">
                                      {formatInTimeZone(
                                        new Date(booking.startDateTime),
                                        timezone,
                                        { hour: "numeric", minute: "2-digit" }
                                      )}
                                    </p>
                                    <p className="text-[10px] text-white/90 truncate font-semibold leading-tight">
                                      {booking.serviceName}
                                    </p>
                                    <p className="text-[9px] text-white/70 mt-0.5 truncate leading-tight">
                                      {booking.customer.name || 'Unnamed'}
                                    </p>
                                    {booking.staff && (
                                      <p className="text-[8px] text-white/55 mt-0.5 truncate leading-tight">
                                        {booking.staff.name}
                                      </p>
                                    )}
                                  </button>
                                );
                              })}
                              
                              {/* Show available slots (only if no bookings at this time) */}
                              {bookingsForTime.length === 0 && slotsForTime.length > 0 && (() => {
                                // Show slots that either START here OR are part of a multi-block slot that started earlier
                                const service = allServices.find(s => s.id === selectedServiceId);
                                const roundedDuration = service ? Math.round(service.durationMinutes / 30) * 30 : 30;
                                const finalDuration = roundedDuration < 30 ? 30 : roundedDuration;
                                const blocksSpanned = Math.ceil(finalDuration / 30);
                                
                                // Get all slots that should appear in this block
                                const segmentStartMinutes = segment.hour * 60 + segment.minute;
                                const segmentEndMinutes = segmentStartMinutes + 30;
                                
                                const slotsForThisBlock = slotsForTime.filter(slot => {
                                  const slotStart = new Date(slot.startDateTime);
                                  const slotEnd = new Date(slot.endDateTime);
                                  const slotHour = parseInt(formatInTimeZone(slotStart, timezone, { hour: "numeric", hour12: false }), 10);
                                  const slotMinute = parseInt(formatInTimeZone(slotStart, timezone, { minute: "numeric" }), 10);
                                  const slotRoundedMinute = Math.floor(slotMinute / 30) * 30;
                                  const slotStartMinutes = slotHour * 60 + slotRoundedMinute;
                                  const slotEndMinutes = slotStartMinutes + (slotEnd.getTime() - slotStart.getTime()) / (1000 * 60);
                                  
                                  // Slot appears in this segment if it overlaps
                                  return slotStartMinutes < segmentEndMinutes && slotEndMinutes > segmentStartMinutes;
                                });
                                
                                if (slotsForThisBlock.length === 0) return null;
                                
                                // Filter out duplicate slots (same slot ID)
                                const uniqueSlots = slotsForThisBlock.filter((slot, index, self) => 
                                  index === self.findIndex(s => s.id === slot.id)
                                );
                                
                                // Group slots by their exact start time - slots that start together should be rendered as one continuous block
                                const slotsByStartTime = new Map<string, typeof uniqueSlots>();
                                uniqueSlots.forEach(slot => {
                                  const slotStart = new Date(slot.startDateTime);
                                  const slotHour = parseInt(formatInTimeZone(slotStart, timezone, { hour: "numeric", hour12: false }), 10);
                                  const slotMinute = parseInt(formatInTimeZone(slotStart, timezone, { minute: "numeric" }), 10);
                                  const slotRoundedMinute = Math.floor(slotMinute / 30) * 30;
                                  const startKey = `${slotHour}:${slotRoundedMinute}`;
                                  
                                  if (!slotsByStartTime.has(startKey)) {
                                    slotsByStartTime.set(startKey, []);
                                  }
                                  slotsByStartTime.get(startKey)!.push(slot);
                                });
                                
                                // Determine if this is the starting block for each slot group
                                const slotGroups = Array.from(slotsByStartTime.entries()).map(([startKey, slots]) => {
                                  const [hour, minute] = startKey.split(':').map(Number);
                                  const isStartingBlock = hour === segment.hour && minute === segment.minute;
                                  return { startKey, slots, isStartingBlock };
                                });
                                
                                return (
                                  <>
                                    {slotGroups.map(({ startKey, slots: groupSlots, isStartingBlock }) => {
                                      const totalStaffCount = groupSlots.length;
                                      const blockMinHeightRem = 3; // min-h-[3rem]
                                      const blockPaddingRem = 0.5; // py-1
                                      const firstBlockHeight = blockMinHeightRem + blockPaddingRem; // 3.5rem
                                      
                                      if (isStartingBlock) {
                                        // Render all staff slots for this time as horizontal sections within one continuous block
                                        // Each staff member gets an equal share of the height
                                        const slotHeightInFirstBlock = firstBlockHeight / totalStaffCount;
                                        
                                        return (
                                          <>
                                            {groupSlots.map((slot, slotIdx) => {
                                      const staffMember = staffArray.find(s => s.id === slot.staffId);
                                      const isPending = slot.id && slot.id.startsWith('pending-');
                                      const isSelectedStaff = selectedStaffId !== "any" && slot.staffId === selectedStaffId;
                                      const dateKey = formatInTimeZone(day, timezone, "yyyy-MM-dd");
                                      const isPendingDeletion = pendingAvailabilityDeletions.some(deletion => {
                                        const deletionDateKey = formatInTimeZone(deletion.date, timezone, "yyyy-MM-dd");
                                        return deletion.staffId === slot.staffId &&
                                               deletionDateKey === dateKey &&
                                                   deletion.hour === segment.hour;
                                      });
                                      const isSelected = selectedSlots.has(slot.id);
                                              const slotTopOffset = slotIdx * slotHeightInFirstBlock;
                                              
                                              // Calculate how many 30-minute blocks this slot spans
                                              const blocksSpanned = Math.ceil(finalDuration / 30);
                                      
                                      return (
                                        <button
                                          key={slot.id}
                                          type="button"
                                                  className="absolute left-0 right-0"
                                          style={{
                                                    height: `${slotHeightInFirstBlock}rem`,
                                                    minHeight: `${slotHeightInFirstBlock}rem`,
                                                    top: `${slotTopOffset}rem`,
                                                    zIndex: 100 + slotIdx,
                                                    position: 'absolute',
                                                    borderTop: slotIdx === 0 ? undefined : 'none', // Remove top border except for first
                                                    borderBottom: slotIdx === totalStaffCount - 1 && blocksSpanned === 1 ? undefined : 'none', // Remove bottom border if spanning multiple blocks or not last
                                                    borderBottomLeftRadius: (slotIdx === totalStaffCount - 1 && blocksSpanned === 1) ? undefined : '0',
                                                    borderBottomRightRadius: (slotIdx === totalStaffCount - 1 && blocksSpanned === 1) ? undefined : '0',
                                                    borderTopLeftRadius: slotIdx === 0 ? undefined : '0',
                                                    borderTopRightRadius: slotIdx === 0 ? undefined : '0',
                                          }}
                                    onClick={isPending && isSelectedStaff ? () => {
                                      const slotDateKey = formatInTimeZone(day, timezone, "yyyy-MM-dd");
                                      setPendingAvailabilityAdditions((prev) =>
                                        prev.filter(
                                          (pending) => {
                                            const pendingDateKey = formatInTimeZone(pending.date, timezone, "yyyy-MM-dd");
                                            return !(pending.staffId === slot.staffId &&
                                              pendingDateKey === slotDateKey &&
                                                  pending.hour === segment.hour &&
                                                  pending.minute === segment.minute);
                                          }
                                        )
                                      );
                                    } : isPendingDeletion ? () => {
                                      const slotDateKey = formatInTimeZone(day, timezone, "yyyy-MM-dd");
                                      setPendingAvailabilityDeletions((prev) =>
                                        prev.filter(
                                          (deletion) => {
                                            const deletionDateKey = formatInTimeZone(deletion.date, timezone, "yyyy-MM-dd");
                                            return !(deletion.staffId === slot.staffId &&
                                              deletionDateKey === slotDateKey &&
                                                  deletion.hour === segment.hour);
                                          }
                                        )
                                      );
                                    } : selectedStaffId !== "any" ? () => {
                                      // A specific staff member is selected - handle availability management
                                      const slotDateKey = formatInTimeZone(day, timezone, "yyyy-MM-dd");
                                      
                                      // Get the slot's time to check if it matches this segment
                                      const slotHour = formatInTimeZone(new Date(slot.startDateTime), timezone, { hour: "numeric", hour12: false });
                                      const slotMinute = formatInTimeZone(new Date(slot.startDateTime), timezone, { minute: "numeric" });
                                      const slotHourNum = parseInt(slotHour, 10);
                                      const slotMinuteNum = parseInt(slotMinute, 10);
                                      const slotRoundedMinute = Math.floor(slotMinuteNum / 30) * 30;
                                      
                                      // Check if clicking on the selected staff's own slot at this exact time segment
                                      const isOwnSlot = slot.staffId === selectedStaffId && 
                                                        slotHourNum === segment.hour && 
                                                        slotRoundedMinute === segment.minute;
                                      
                                      // Check if there's a pending addition for selected staff at this exact time segment
                                      const hasPendingAddition = pendingAvailabilityAdditions.some(
                                        (pending) => {
                                          const pendingDateKey = formatInTimeZone(pending.date, timezone, "yyyy-MM-dd");
                                          return pending.staffId === selectedStaffId &&
                                                 pendingDateKey === slotDateKey &&
                                                 pending.hour === segment.hour &&
                                                 pending.minute === segment.minute;
                                        }
                                      );
                                      
                                      if (isOwnSlot) {
                                        // Clicking on own slot - toggle deletion
                                        setPendingAvailabilityDeletions((prev) => {
                                          const alreadyPending = prev.some(deletion => {
                                            const deletionDateKey = formatInTimeZone(deletion.date, timezone, "yyyy-MM-dd");
                                            return deletion.staffId === selectedStaffId &&
                                                   deletionDateKey === slotDateKey &&
                                                   deletion.hour === segment.hour &&
                                                   deletion.slotId === slot.id;
                                          });
                                          
                                          if (alreadyPending) {
                                            // Remove from deletions
                                            return prev.filter(deletion => {
                                              const deletionDateKey = formatInTimeZone(deletion.date, timezone, "yyyy-MM-dd");
                                              return !(deletion.staffId === selectedStaffId &&
                                                       deletionDateKey === slotDateKey &&
                                                       deletion.hour === segment.hour &&
                                                       deletion.slotId === slot.id);
                                            });
                                          } else {
                                            // Add to deletions
                                            return [...prev, {
                                              staffId: selectedStaffId,
                                              date: day,
                                              hour: segment.hour,
                                              slotId: slot.id
                                            }];
                                          }
                                        });
                                      } else if (hasPendingAddition) {
                                        // Selected staff has a pending addition at this time - remove it (toggle)
                                        setPendingAvailabilityAdditions((prev) =>
                                          prev.filter(
                                            (pending) => {
                                              const pendingDateKey = formatInTimeZone(pending.date, timezone, "yyyy-MM-dd");
                                              return !(pending.staffId === selectedStaffId &&
                                                       pendingDateKey === slotDateKey &&
                                                       pending.hour === segment.hour &&
                                                       pending.minute === segment.minute);
                                            }
                                          )
                                        );
                                      } else {
                                        // Clicking on ANY slot (with any staff member or empty) - add selected staff to split it
                                        // Multiple staff can share the same slot, they will split naturally
                                        handleEmptySlotClick(day, segment.hour, segment.minute);
                                      }
                                    } : () => {
                                      // "any" staff selected - if it's a filled slot (not pending), toggle selection
                                      // Otherwise, create a booking
                                      if (!isPending) {
                                        handleToggleSlotSelection(slot, day, segment);
                                      } else {
                                        handleSlotClick(slot);
                                      }
                                    }}
                                        className={`w-full flex-1 min-h-[1.75rem] rounded-lg border-2 px-2.5 py-1.5 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                                      isPending
                                            ? "border-primary/80 bg-primary/25 hover:border-red-500/80 hover:bg-red-500/25 hover:shadow-lg hover:scale-[1.02]"
                                        : isPendingDeletion
                                            ? "border-red-500/80 bg-red-500/20 hover:border-red-400/90 hover:bg-red-500/30 opacity-75"
                                        : isSelected
                                            ? "border-yellow-400/90 bg-yellow-400/25 ring-2 ring-yellow-400/50 shadow-lg shadow-yellow-400/20 hover:border-yellow-300/90 hover:bg-yellow-400/30"
                                            : "border-primary/60 bg-primary/15 hover:border-primary/80 hover:bg-primary/25 hover:shadow-lg hover:scale-[1.02]"
                                    }`}
                                    style={{
                                          borderColor: staffMember?.color 
                                            ? `${staffMember.color}95` 
                                            : undefined,
                                          backgroundColor: staffMember?.color 
                                            ? `${staffMember.color}18` 
                                            : undefined,
                                          boxShadow: staffMember?.color && !isPending && !isPendingDeletion
                                            ? `0 4px 12px ${staffMember.color}25, 0 2px 4px ${staffMember.color}15`
                                            : undefined
                                    }}
                                    title={
                                      isPending && isSelectedStaff 
                                        ? "Click to remove" 
                                        : isPendingDeletion
                                        ? "Click to cancel deletion"
                                        : isSelected
                                        ? "Selected - click to deselect"
                                        : selectedStaffId === "any" && !isPending
                                        ? "Click to select for deletion"
                                        : (selectedStaffId !== "any" && slot.staffId === selectedStaffId)
                                        ? "Click to delete availability"
                                        : "Click to create booking"
                                    }
                                  >
                                        <p className="text-[11px] font-bold text-white leading-tight">
                                      {slot.staffName}
                                    </p>
                                        {(isPending || isPendingDeletion) && (
                                          <p className={`text-[8px] font-semibold leading-tight mt-0.5 ${isPending ? 'text-primary/90' : 'text-red-300/90'}`}>
                                            {isPending ? '✓ Pending' : '✗ Deleting'}
                                    </p>
                                        )}
                                  </button>
                                      );
                                    })}
                                          </>
                                        );
                                      } else {
                                        // In continuation blocks, render horizontal sections for each staff member
                                        const slotHeightInBlock = firstBlockHeight / totalStaffCount;
                                        
                                        return (
                                          <>
                                            {groupSlots.map((slot, slotIdx) => {
                                              const staffMember = staffArray.find(s => s.id === slot.staffId);
                                              const slotTopOffset = slotIdx * slotHeightInBlock;
                                              
                                              return (
                                                <div
                                                  key={`${slot.id}-continuation`}
                                                  className="absolute left-0 right-0 pointer-events-none"
                                                  style={{
                                                    height: `${slotHeightInBlock}rem`,
                                                    top: `${slotTopOffset}rem`,
                                                    zIndex: 99 + slotIdx,
                                                    position: 'absolute',
                                                    borderLeft: staffMember?.color ? `2px solid ${staffMember.color}95` : '2px solid rgba(59, 130, 246, 0.6)',
                                                    borderRight: staffMember?.color ? `2px solid ${staffMember.color}95` : '2px solid rgba(59, 130, 246, 0.6)',
                                                    backgroundColor: staffMember?.color ? `${staffMember.color}18` : 'rgba(59, 130, 246, 0.15)',
                                                    borderTop: 'none',
                                                    borderBottom: slotIdx === totalStaffCount - 1 ? 'none' : 'none',
                                                    borderRadius: '0',
                                                    marginTop: slotIdx === 0 ? '-1px' : '0', // Overlap first section to eliminate gaps
                                                  }}
                                                />
                                              );
                                            })}
                                          </>
                                        );
                                      }
                                    })}
                                  </>
                                );
                              })()}

                              {/* Show empty state if no bookings or slots */}
                              {bookingsForTime.length === 0 && slotsForTime.length === 0 && (
                                selectedStaffId === "any" ? (
                                  <div className="h-full w-full rounded-lg border border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-transparent" />
                                ) : (
                                  <button
                                    type="button"
                                      onClick={() => handleEmptySlotClick(day, segment.hour, segment.minute)}
                                    className="h-full w-full rounded-lg border-2 border-dashed border-white/[0.12] bg-gradient-to-br from-white/[0.03] to-transparent hover:border-primary/40 hover:bg-primary/8 hover:border-solid transition-all duration-300 cursor-pointer group"
                                    title="Click to add availability"
                                  >
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                      <p className="text-[9px] text-primary/60 font-medium text-center mt-0.5">+ Add</p>
                                    </div>
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Booking Modal */}
      {editingBooking && (
        <BookingEditModal
          booking={editingBooking}
          workspace={workspace}
          onUpdate={handleUpdateEditingBooking}
          onSave={handleSaveChanges}
          onCancel={handleCancelEdit}
          isSaving={isSaving}
          timezone={timezone}
        />
      )}

      {/* Add Availability Modal */}
      {addingAvailability && (
        <AddAvailabilityModal
          date={addingAvailability.date}
          hour={addingAvailability.hour}
          service={selectedService}
          staff={staffArray}
          onSelectStaff={handleAddAvailabilityForStaff}
          onCancel={() => setAddingAvailability(null)}
          isSaving={isSavingAvailability}
          timezone={timezone}
        />
      )}

    </div>
  );
}

function BookingEditModal({
  booking,
  workspace,
  onUpdate,
  onSave,
  onCancel,
  isSaving,
  timezone
}: {
  booking: FakeBooking;
  workspace: any;
  onUpdate: (updates: Partial<FakeBooking>) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  timezone: string;
}) {
  const [localDate, setLocalDate] = useState(() => {
    const date = new Date(booking.startDateTime);
    return formatInTimeZone(date, timezone, "yyyy-MM-dd");
  });
  const [localTime, setLocalTime] = useState(() => {
    const date = new Date(booking.startDateTime);
    return formatInTimeZone(date, timezone, "HH:mm");
  });

  const staffArray = useMemo(() => workspace.staff || [], [workspace.staff]);
  const allServices = useMemo(() => 
    workspace.catalog.flatMap((category: any) =>
      category.services.map((service: any) => ({
        ...service,
        categoryName: category.name
      }))
    ), [workspace.catalog]
  );

  const handleDateChange = (newDate: string) => {
    setLocalDate(newDate);
    updateBookingDateTime(newDate, localTime);
  };

  const handleTimeChange = (newTime: string) => {
    setLocalTime(newTime);
    updateBookingDateTime(localDate, newTime);
  };

  const updateBookingDateTime = (dateStr: string, timeStr: string) => {
    // Parse the date string (YYYY-MM-DD) and time string (HH:mm)
    const [year, month, day] = dateStr.split("-").map(Number);
    const [hours, minutes] = timeStr.split(":").map(Number);

    // Create a date object in the local timezone
    const localDateObj = new Date(year, month - 1, day, hours, minutes);

    // Convert to UTC using the timezone utility
    const minutesFromMidnight = timeStringToMinutes(timeStr);
    const dateOnly = new Date(year, month - 1, day);
    const utcDateTime = zonedMinutesToDate(dateOnly, minutesFromMidnight, timezone);

    const duration = booking.durationMinutes;
    const endDateTime = new Date(utcDateTime.getTime() + duration * 60 * 1000);

    onUpdate({
      startDateTime: utcDateTime.toISOString(),
      endDateTime: endDateTime.toISOString()
    });
  };

  const handleStaffChange = (staffId: string) => {
    const staff = staffArray.find((s: StaffMember) => s.id === staffId);
    onUpdate({
      staff: staff
        ? {
            id: staff.id,
            name: staff.name,
            color: staff.color
          }
        : null
    });
  };

  const handleServiceChange = (serviceId: string) => {
    // Find the service in the catalog
    for (const category of workspace.catalog) {
      const service = category.services.find((s: any) => s.id === serviceId);
      if (service) {
        const duration = service.durationMinutes;
        const startDateTime = new Date(booking.startDateTime);
        const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);

        onUpdate({
          serviceId: service.id,
          serviceName: service.name,
          categoryName: category.name,
          durationMinutes: duration,
          endDateTime: endDateTime.toISOString()
        });
        break;
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-8">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-black/90 p-8 shadow-[0_60px_160px_rgba(4,12,35,0.7)]">
        <button
          type="button"
          className="absolute right-6 top-6 rounded-full border border-white/20 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:text-white"
          onClick={onCancel}
        >
          <X className="h-4 w-4" />
        </button>

        <header className="space-y-2 pr-16">
          <div className="flex items-center gap-3">
            {!booking.id.startsWith('temp-') && (
              <>
                <Badge variant="outline" className="border-white/20 text-white/70">
                  {booking.code}
                </Badge>
                <StatusBadge status={booking.status} />
              </>
            )}
          </div>
          <h2 className="font-display text-3xl text-white">
            {booking.id.startsWith('temp-') ? 'Create New Booking' : 'Edit Booking'}
          </h2>
          <p className="text-sm text-white/60">
            {booking.id.startsWith('temp-') 
              ? 'Fill in the booking details. The booking will be created when you save.'
              : 'Update the booking details. Changes will be reflected in the booking flow when saved.'}
          </p>
      </header>

        <div className="mt-8 space-y-6">
          {/* Customer Info - Editable for new bookings */}
          <div className="rounded-2xl border border-white/10 bg-black/70 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/50 mb-4">
              Customer
            </h3>
            {booking.id.startsWith('temp-') ? (
              <div className="space-y-3">
                <div>
                  <Label className="text-white/70 mb-2 block">Name</Label>
                  <Input
                    value={booking.customer.name}
                    onChange={(e) => onUpdate({ customer: { ...booking.customer, name: e.target.value } })}
                    placeholder="Customer name"
                    className="bg-[#050F2C]/60 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white/70 mb-2 block">Email</Label>
                  <Input
                    type="email"
                    value={booking.customer.email}
                    onChange={(e) => onUpdate({ customer: { ...booking.customer, email: e.target.value } })}
                    placeholder="customer@example.com"
                    className="bg-[#050F2C]/60 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white/70 mb-2 block">Phone</Label>
                  <Input
                    type="tel"
                    value={booking.customer.phone}
                    onChange={(e) => onUpdate({ customer: { ...booking.customer, phone: e.target.value } })}
                    placeholder="+1 555 010 2030"
                    className="bg-[#050F2C]/60 text-white"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label className="text-white/70">Name</Label>
                  <p className="text-white">{booking.customer.name}</p>
                </div>
                <div>
                  <Label className="text-white/70">Email</Label>
                  <p className="text-white">{booking.customer.email}</p>
                </div>
                {booking.customer.phone && (
                  <div>
                    <Label className="text-white/70">Phone</Label>
                    <p className="text-white">{booking.customer.phone}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Service Selection */}
          <div>
            <Label className="text-white/70 mb-2 block">Service</Label>
            <select
              className="w-full rounded-2xl border border-white/15 bg-[#050F2C]/60 px-4 py-3 text-sm text-white focus:border-primary focus:outline-none"
              value={booking.serviceId}
              onChange={(e) => handleServiceChange(e.target.value)}
            >
              {allServices.map((service: any) => (
                <option key={service.id} value={service.id} className="bg-[#050F2C] text-white">
                  {service.name} ({service.durationMinutes} min · $
                  {(service.priceCents / 100).toFixed(2)})
                </option>
              ))}
            </select>
      </div>

          {/* Staff Selection */}
          <div>
            <Label className="text-white/70 mb-2 block">Staff Member</Label>
          <select
              className="w-full rounded-2xl border border-white/15 bg-[#050F2C]/60 px-4 py-3 text-sm text-white focus:border-primary focus:outline-none"
              value={booking.staff?.id || ""}
              onChange={(e) => handleStaffChange(e.target.value)}
            >
              <option value="" className="bg-[#050F2C] text-white">
                Unassigned
              </option>
              {staffArray.map((staff: StaffMember) => (
                <option key={staff.id} value={staff.id} className="bg-[#050F2C] text-white">
                  {staff.name}
              </option>
            ))}
          </select>
        </div>

          {/* Date and Time */}
          <div className="grid gap-4 md:grid-cols-2">
        <div>
              <Label className="text-white/70 mb-2 block">Date</Label>
          <Input
                type="date"
                value={localDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="bg-[#050F2C]/60 text-white"
          />
        </div>
        <div>
              <Label className="text-white/70 mb-2 block">Time</Label>
          <Input
            type="time"
                value={localTime}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="bg-[#050F2C]/60 text-white"
              />
            </div>
          </div>

          {/* Duration Display */}
          <div className="rounded-2xl border border-white/10 bg-black/70 p-4">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Clock className="h-4 w-4" />
              <span>Duration: {booking.durationMinutes} minutes</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm text-white/70">
              <CalendarDays className="h-4 w-4" />
              <span>
                {formatInTimeZone(booking.startDateTime, timezone, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit"
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={onSave} isLoading={isSaving} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>
          </div>
  );
}

function StaffPill({
  label,
  color,
  active,
  onClick
}: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border-2 px-4 py-2 text-xs font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
        active 
          ? "border-white/70 bg-white/20 text-white shadow-md hover:shadow-lg hover:scale-105" 
          : "border-white/15 bg-white/5 text-white/70 hover:text-white/90 hover:border-white/25 hover:bg-white/10"
      }`}
      style={active && color ? { 
        borderColor: `${color}90`, 
        backgroundColor: `${color}20`,
        boxShadow: `0 4px 12px ${color}30, 0 2px 4px ${color}15` 
      } : undefined}
    >
      {label}
    </button>
  );
}

function AddAvailabilityModal({
  date,
  hour,
  service,
  staff,
  onSelectStaff,
  onCancel,
  isSaving,
  timezone
}: {
  date: Date;
  hour: number;
  service: { id: string; name: string; durationMinutes: number; categoryName?: string } | undefined;
  staff: StaffMember[];
  onSelectStaff: (staffId: string) => void;
  onCancel: () => void;
  isSaving: boolean;
  timezone: string;
}) {
  if (!service) return null;

  // Calculate end time
  const startMinutes = hour * 60;
  const endMinutes = startMinutes + service.durationMinutes;
  const endHour = Math.floor(endMinutes / 60);
  const endMin = endMinutes % 60;
  const startTimeStr = `${String(hour).padStart(2, '0')}:00`;
  const endTimeStr = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

  // Get staff assigned to this service (if available)
  const serviceStaff = staff.filter(member => {
    // In a real implementation, you'd check staff_services table
    // For now, show all staff
    return member.active;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-8">
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-black/90 p-8 shadow-[0_60px_160px_rgba(4,12,35,0.7)]">
        <button
          type="button"
          className="absolute right-6 top-6 rounded-full border border-white/20 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:text-white"
          onClick={onCancel}
          disabled={isSaving}
        >
          <X className="h-4 w-4" />
        </button>

        <header className="space-y-2 pr-16">
          <h2 className="font-display text-3xl text-white">Add Availability</h2>
          <p className="text-sm text-white/60">
            Select a staff member to add availability for this time slot.
          </p>
        </header>

        <div className="mt-8 space-y-6">
          {/* Service Info */}
          <div className="rounded-2xl border border-white/10 bg-black/70 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/50 mb-4">
              Service
            </h3>
            <div className="space-y-2">
              <p className="text-white font-semibold">{service.name}</p>
              <p className="text-sm text-white/70">{service.durationMinutes} minutes</p>
            </div>
          </div>

          {/* Time Slot Info */}
          <div className="rounded-2xl border border-white/10 bg-black/70 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/50 mb-4">
              Time Slot
            </h3>
            <div className="space-y-2">
              <p className="text-white">
                {formatInTimeZone(date, timezone, {
                  weekday: "long",
                  month: "short",
                  day: "numeric"
                })}
              </p>
              <p className="text-white">
                {startTimeStr} - {endTimeStr}
              </p>
            </div>
          </div>

          {/* Staff Selection */}
          <div>
            <Label className="text-white/70 mb-2 block">Select Staff Member</Label>
            <div className="space-y-2">
              {serviceStaff.length === 0 ? (
                <p className="text-sm text-white/60">No staff members available</p>
              ) : (
                serviceStaff.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => onSelectStaff(member.id)}
                    disabled={isSaving}
                    className="w-full rounded-2xl border border-white/15 bg-[#050F2C]/60 px-4 py-3 text-left transition hover:border-primary hover:bg-primary/10 focus:border-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      borderColor: member.color ? `${member.color}80` : undefined,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {member.color && (
                        <div
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: member.color }}
                        />
                      )}
                      <div>
                        <p className="text-sm font-semibold text-white">{member.name}</p>
                        {member.role && (
                          <p className="text-xs text-white/60">{member.role}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: FakeBooking["status"] }) {
  const map: Record<FakeBooking["status"], { label: string; tone: string }> = {
    pending: { label: "Pending", tone: "border-amber-300/40 bg-amber-300/20 text-amber-100" },
    authorized: { label: "Authorized", tone: "border-sky-400/40 bg-sky-400/20 text-sky-100" },
    completed: { label: "Completed", tone: "border-emerald-400/40 bg-emerald-400/20 text-emerald-100" },
    captured: { label: "Captured", tone: "border-emerald-400/40 bg-emerald-400/20 text-emerald-100" },
    no_show: { label: "No-show", tone: "border-rose-400/40 bg-rose-400/15 text-rose-100" },
    canceled: { label: "Cancelled", tone: "border-orange-400/40 bg-orange-400/15 text-orange-100" },
    refunded: { label: "Refunded", tone: "border-indigo-400/40 bg-indigo-400/20 text-indigo-100" },
    disputed: { label: "Disputed", tone: "border-red-400/40 bg-red-400/15 text-red-100" },
    requires_action: {
      label: "Action required",
      tone: "border-fuchsia-400/40 bg-fuchsia-400/20 text-fuchsia-100"
    },
    expired: { label: "Expired", tone: "border-slate-400/40 bg-slate-400/20 text-slate-100" }
  };
  const entry = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${entry.tone}`}
    >
      {entry.label}
    </span>
  );
}
