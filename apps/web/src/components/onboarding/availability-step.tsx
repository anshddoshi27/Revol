"use client";

import React, { useMemo, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Save, CalendarCheck2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/ui/helper-text";
import { Label } from "@/components/ui/label";
import { StepActions } from "@/components/onboarding/step-actions";
import { TestDataButton } from "@/components/onboarding/test-data-button";
import { generateAvailabilityData } from "@/lib/test-data-generator";
import { formatInTimeZone, zonedMinutesToDate, timeStringToMinutes } from "@/lib/timezone";
import { buildExpandedSlots, groupSlotsByDay, type ExpandedAvailabilitySlot } from "@/lib/availability-utils";
import { createClientClient } from "@/lib/supabase-client";
import type {
  AvailabilitySlot,
  ServiceAvailability,
  ServiceCategory,
  ServiceDefinition,
  StaffMember
} from "@/lib/onboarding-context";

// Helper function to check if two time ranges overlap
const timeRangesOverlap = (
  start1: number, end1: number,
  start2: number, end2: number
): boolean => {
  // Two ranges overlap if start1 < end2 AND start2 < end1
  return start1 < end2 && start2 < end1;
};

interface AvailabilityStepProps {
  services: ServiceCategory[];
  staff: StaffMember[];
  defaultValues: ServiceAvailability[];
  onNext: (values: ServiceAvailability[]) => Promise<void> | void;
  onBack: () => void;
  timezone?: string; // Optional timezone prop
}

export function AvailabilityStep({
  services,
  staff,
  defaultValues,
  onNext,
  onBack,
  timezone = "America/New_York" // Default timezone
}: AvailabilityStepProps) {
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
  const [fetchedSlots, setFetchedSlots] = useState<ExpandedAvailabilitySlot[]>([]);
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);
  // Track saved availability during this onboarding session
  // Initialize from defaultValues to restore data after Stripe redirect
  const [savedAvailability, setSavedAvailability] = useState<ServiceAvailability[]>(() => {
    console.log('[AvailabilityStep] Initializing savedAvailability from defaultValues:', {
      hasDefaultValues: !!defaultValues,
      defaultValuesLength: defaultValues?.length || 0,
      defaultValues: defaultValues
    });
    // Clean defaultValues to ensure only staffId and slots are included
    if (defaultValues && Array.isArray(defaultValues) && defaultValues.length > 0) {
      return defaultValues.map((serviceAvail: any) => ({
        serviceId: serviceAvail.serviceId,
        staff: (serviceAvail.staff || []).map((staffAvail: any) => ({
          staffId: staffAvail.staffId,
          slots: staffAvail.slots || []
        }))
      }));
    }
    return [];
  });
  // Pending availability additions - slots clicked but not yet saved
  const [pendingAvailabilityAdditions, setPendingAvailabilityAdditions] = useState<Array<{
    staffId: string;
    date: Date;
    hour: number;
    minute: number;
  }>>([]);
  const [error, setError] = useState<string | null>(null);

  // Get all services for dropdown - memoize to prevent infinite loops
  const allServices = useMemo(() => 
    services.flatMap((category) =>
      category.services.map((service) => ({
        ...service,
        categoryName: category.name
      }))
    ), [services]
  );

  // Initialize savedAvailability from defaultValues when component mounts or defaultValues changes
  // This ensures data is restored after Stripe redirect
  useEffect(() => {
    if (defaultValues && Array.isArray(defaultValues) && defaultValues.length > 0) {
      // Only update if savedAvailability is empty or if defaultValues has changed
      const cleanedDefaultValues = defaultValues.map((serviceAvail: any) => ({
        serviceId: serviceAvail.serviceId,
        staff: (serviceAvail.staff || []).map((staffAvail: any) => ({
          staffId: staffAvail.staffId,
          slots: staffAvail.slots || []
        }))
      }));
      
      // Check if we need to update (avoid unnecessary updates)
      const needsUpdate = savedAvailability.length === 0 || 
        JSON.stringify(savedAvailability) !== JSON.stringify(cleanedDefaultValues);
      
      if (needsUpdate) {
        console.log('[AvailabilityStep] Updating savedAvailability from defaultValues:', {
          defaultValuesLength: defaultValues.length,
          cleanedLength: cleanedDefaultValues.length,
          services: cleanedDefaultValues.map((a: any) => a.serviceId)
        });
        setSavedAvailability(cleanedDefaultValues);
      }
    } else if (defaultValues && defaultValues.length === 0 && savedAvailability.length > 0) {
      // If defaultValues is explicitly empty, clear savedAvailability
      console.log('[AvailabilityStep] Clearing savedAvailability (defaultValues is empty)');
      setSavedAvailability([]);
    }
  }, [defaultValues]); // Only depend on defaultValues, not savedAvailability to avoid loops

  // When service changes, load saved availability for that service
  // This ensures saved slots persist when switching between services
  useEffect(() => {
    if (!selectedServiceId) {
      setFetchedSlots([]);
      return;
    }
    
    const selectedService = allServices.find(s => s.id === selectedServiceId);
    if (!selectedService) {
      setFetchedSlots([]);
      return;
    }
    
    // Check if we have saved availability for this service in state
    const serviceAvail = savedAvailability.find(
      (avail: ServiceAvailability) => avail.serviceId === selectedServiceId
    );
    
    if (serviceAvail) {
      console.log('[AvailabilityStep] Loading saved availability for service:', {
        serviceId: selectedServiceId,
        staffCount: serviceAvail.staff?.length || 0,
        totalSlots: serviceAvail.staff?.reduce((sum: number, s: any) => sum + (s.slots?.length || 0), 0) || 0
      });
      // Expand saved slots for this service
      const weekStart = new Date(currentWeekStart);
      weekStart.setHours(0, 0, 0, 0);
      
      const expandedSlots = buildExpandedSlots({
        service: selectedService,
        serviceAvailability: serviceAvail,
        staff: staff,
        timezone: timezone,
        startDate: weekStart,
        horizonDays: 14,
        includePastSlots: true
      });
      setFetchedSlots(expandedSlots);
    } else {
      // No saved availability for this service yet - start with empty calendar
      console.log('[AvailabilityStep] No saved availability for service:', selectedServiceId);
      setFetchedSlots([]);
    }
  }, [selectedServiceId, savedAvailability, allServices, staff, timezone, currentWeekStart]);

  // Group slots by day - during onboarding, we only show pending slots and saved slots from this session
  const groupedSlots = useMemo(() => {
    if (!selectedServiceId) return {};
    // Combine fetched slots (saved during this session) with any additional slots
    return groupSlotsByDay(fetchedSlots, timezone);
  }, [fetchedSlots, timezone, selectedServiceId]);

  // Generate days of the week
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      days.push(date);
    }
    return days;
  }, [currentWeekStart]);

  // Generate hours from 8 AM to 8 PM (matching booking flow)
  const hours = Array.from({ length: 13 }, (_, i) => i + 8);

  // Generate 30-minute time segments for each hour
  const timeSegments = useMemo(() => {
    const segments: Array<{ hour: number; minute: number }> = [];
    hours.forEach(hour => {
      segments.push({ hour, minute: 0 });
      segments.push({ hour, minute: 30 });
    });
    return segments;
  }, [hours]);

  // Group availability slots by day and time segment (30-minute blocks)
  const slotsByDayAndTime = useMemo(() => {
    const grouped: Record<string, Record<string, ExpandedAvailabilitySlot[]>> = {};
    
    // Flatten all slots from all days
    const allSlots = Object.values(groupedSlots).flat();
    
    // Add fetched slots
    allSlots.forEach(slot => {
      const slotDate = new Date(slot.startDateTime);
      const dateKey = formatInTimeZone(slotDate, timezone, "yyyy-MM-dd");
      const slotHour = parseInt(formatInTimeZone(slotDate, timezone, { hour: "numeric", hour12: false }), 10);
      const slotMinute = parseInt(formatInTimeZone(slotDate, timezone, { minute: "numeric" }), 10);
      const slotRoundedMinute = Math.floor(slotMinute / 30) * 30;
      
      // Only include slots that are in the current week
      const isInCurrentWeek = weekDays.some(day => {
        const dayKey = formatInTimeZone(day, timezone, "yyyy-MM-dd");
        return dayKey === dateKey;
      });
      
      if (!isInCurrentWeek) return;
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = {};
      }
      
      // Calculate slot start and end in minutes
      const slotStart = new Date(slot.startDateTime);
      const slotEnd = new Date(slot.endDateTime);
      const slotStartMinutes = slotHour * 60 + slotRoundedMinute;
      const slotEndMinutes = slotStartMinutes + (slotEnd.getTime() - slotStart.getTime()) / (1000 * 60);
      
      // Add this slot only to time segments it actually overlaps with
      // Check all possible 30-minute segments from start to end
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
          const timeKey = `${segmentHour}:${roundedMinute.toString().padStart(2, '0')}`;
          
          if (!grouped[dateKey][timeKey]) {
            grouped[dateKey][timeKey] = [];
          }
          
          // Check for duplicates
          const isDuplicate = grouped[dateKey][timeKey].some(
            existing => existing.id === slot.id
          );
        
          if (!isDuplicate) {
            grouped[dateKey][timeKey].push(slot);
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
        pendingAvailabilityAdditions.forEach((pending) => {
          const dateKey = formatInTimeZone(pending.date, timezone, "yyyy-MM-dd");
          
          // Only include if in current week
          const isInCurrentWeek = weekDays.some(day => {
            const dayKey = formatInTimeZone(day, timezone, "yyyy-MM-dd");
            return dayKey === dateKey;
          });
          
          if (!isInCurrentWeek) return;
          
          if (!grouped[dateKey]) {
            grouped[dateKey] = {};
          }
          
          // Round service duration to nearest 30-minute increment
          const roundedDuration = Math.round(selectedService.durationMinutes / 30) * 30;
          const finalDuration = roundedDuration < 30 ? 30 : roundedDuration;
          
          // Round pending minute to nearest 30-minute block
          const roundedMinute = Math.floor(pending.minute / 30) * 30;
          const startMinutes = pending.hour * 60 + roundedMinute;
          const endMinutes = startMinutes + finalDuration;
          
          // Add this pending slot only to time segments it actually overlaps with
          let currentSegmentMinutes = startMinutes;
          while (currentSegmentMinutes < endMinutes) {
            const segmentHour = Math.floor(currentSegmentMinutes / 60);
            const segmentMinute = currentSegmentMinutes % 60;
            const roundedSegmentMinute = Math.floor(segmentMinute / 30) * 30;
            const segmentStartMinutes = segmentHour * 60 + roundedSegmentMinute;
            const segmentEndMinutes = segmentStartMinutes + 30;
            
            // Check if slot overlaps with this segment
            if (startMinutes < segmentEndMinutes && endMinutes > segmentStartMinutes) {
              const timeKey = `${segmentHour}:${roundedSegmentMinute.toString().padStart(2, '0')}`;
              
              if (!grouped[dateKey][timeKey]) {
                grouped[dateKey][timeKey] = [];
              }
              
              // Check if this pending slot already exists (don't duplicate)
              const pendingId = `pending-${pending.staffId}-${dateKey}-${pending.hour}-${roundedMinute}`;
              const alreadyPending = grouped[dateKey][timeKey].some(
                existing => existing.id === pendingId
              );
              
              if (!alreadyPending) {
                // Remove any saved slot for the same time/staff (pending replaces saved)
                // Only remove from the first block (where slot starts)
                if (currentSegmentMinutes === startMinutes) {
                  grouped[dateKey][timeKey] = grouped[dateKey][timeKey].filter(
                    existing => !(existing.staffId === pending.staffId && 
                                 !existing.id?.startsWith('pending-'))
                  );
                }
                
                const staffMember = staff.find((s: StaffMember) => s.id === pending.staffId);
                const startDateTime = zonedMinutesToDate(pending.date, startMinutes, timezone);
                const endDateTime = new Date(startDateTime.getTime() + finalDuration * 60 * 1000);
                
                grouped[dateKey][timeKey].push({
                  id: pendingId,
                  serviceId: selectedServiceId,
                  staffId: pending.staffId,
                  staffName: staffMember?.name || 'Unknown',
                  staffColor: staffMember?.color || "#000000",
                  startDateTime: startDateTime.toISOString(),
                  endDateTime: endDateTime.toISOString(),
                  dayLabel: formatInTimeZone(pending.date, timezone, { weekday: "long" }),
                });
              }
            }
            
            // Move to next 30-minute segment
            currentSegmentMinutes = segmentStartMinutes + 30;
          }
        });
      }
    }
    
    return grouped;
  }, [groupedSlots, weekDays, timezone, pendingAvailabilityAdditions, selectedServiceId, allServices, staff]);

  const navigateWeek = (direction: "prev" | "next") => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
    setCurrentWeekStart(newDate);
  };

  const handleEmptySlotClick = (day: Date, hour: number, minute: number = 0) => {
    if (!selectedServiceId) {
      setError('Please select a service first');
      return;
    }
    
    const selectedService = allServices.find(s => s.id === selectedServiceId);
    if (!selectedService) {
      setError('Service not found');
      return;
    }
    
    // Get staff members assigned to this service
    const serviceStaff = staff.filter(member => {
      if (member.active === false) return false;
      return selectedService.staffIds.includes(member.id);
    });
    
    if (serviceStaff.length === 0) {
      setError('No staff members assigned to this service');
      return;
    }
    
    // Determine which staff members to add/remove availability for
    const staffToProcess = selectedStaffId !== "any" 
      ? [serviceStaff.find(m => m.id === selectedStaffId)].filter(Boolean)
      : serviceStaff;
    
    if (staffToProcess.length === 0) {
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
    
    const dateKey = formatInTimeZone(day, timezone, "yyyy-MM-dd");
    const weekdayName = formatInTimeZone(day, timezone, { weekday: "long" }).toLowerCase();
    
    // Check for conflicts for each staff member
    const validAdditions: Array<{ staffId: string; date: Date; hour: number; minute: number }> = [];
    
    staffToProcess.forEach(member => {
      // Check for conflicts with existing slots (from fetchedSlots)
      const existingSlotsForStaff = fetchedSlots.filter(slot => {
        const slotDate = new Date(slot.startDateTime);
        const slotDateKey = formatInTimeZone(slotDate, timezone, "yyyy-MM-dd");
        const slotWeekday = formatInTimeZone(slotDate, timezone, { weekday: "long" }).toLowerCase();
        return slot.staffId === member.id && 
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
        if (pending.staffId !== member.id) return false;
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
        setError(`Cannot add slot for ${member.name}: This time conflicts with an existing availability slot. The service duration (${finalDuration} minutes) would overlap with another slot.`);
        return;
      }
      
      // Check if this slot is already pending
      const alreadyPending = pendingAvailabilityAdditions.some(
        (pending) =>
          pending.staffId === member.id &&
          pending.date.toDateString() === day.toDateString() &&
          pending.hour === hour &&
          pending.minute === roundedMinute
      );
      
      if (!alreadyPending) {
        validAdditions.push({
          staffId: member.id,
          date: day,
          hour,
          minute: roundedMinute
        });
      }
    });
    
    if (validAdditions.length > 0) {
      setPendingAvailabilityAdditions((prev) => [...prev, ...validAdditions]);
      setError(null);
    } else {
      // All slots are already pending, so remove them (toggle off)
      setPendingAvailabilityAdditions((prev) =>
        prev.filter(
          (pending) => {
            const isSelectedStaff = staffToProcess.some(m => m.id === pending.staffId);
            return !(isSelectedStaff &&
              pending.date.toDateString() === day.toDateString() &&
              pending.hour === hour &&
              pending.minute === roundedMinute);
          }
        )
      );
    setError(null);
    }
  };


  const handleSaveAvailability = async (): Promise<boolean> => {
    if (!selectedServiceId || pendingAvailabilityAdditions.length === 0) return true;

    setIsSavingAvailability(true);
    setError(null);
    
    try {
      // Get auth token from Supabase client
      const supabase = createClientClient();
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      const selectedService = allServices.find(s => s.id === selectedServiceId);
      if (!selectedService) {
        throw new Error('Selected service not found');
      }

      // Use savedAvailability state (which has temporary IDs) as the base
      // This ensures consistency - we don't mix real UUIDs from API with temporary IDs
      // The API handles ID mapping when saving, but our state keeps temporary IDs
      let allAvailability: ServiceAvailability[] = [...savedAvailability];

      // Find or create service availability entry for the current service
      let serviceAvailability = allAvailability.find((avail: ServiceAvailability) => avail.serviceId === selectedServiceId);
      
      if (!serviceAvailability) {
        serviceAvailability = {
          serviceId: selectedServiceId,
          staff: []
        };
        allAvailability.push(serviceAvailability);
      }

      // Process all pending additions
      for (const pending of pendingAvailabilityAdditions) {
        const targetDate = pending.date;
        const targetHour = pending.hour;
        const targetMinute = pending.minute ?? 0; // Default to 0 if not provided
        const staffId = pending.staffId;

        // Get weekday name from the date (timezone-aware)
        // Store as lowercase to match buildExpandedSlots expectation and API format
        const weekdayName = formatInTimeZone(targetDate, timezone, { weekday: "long" });
        const weekday = weekdayName.toLowerCase();
        
        // Round minute to nearest 30-minute block
        const roundedMinute = Math.floor(targetMinute / 30) * 30;
        
        // Format time as HH:mm
        const startTime = `${String(targetHour).padStart(2, '0')}:${String(roundedMinute).padStart(2, '0')}`;
        
        // Round service duration to nearest 30-minute increment
        const roundedDuration = Math.round(selectedService.durationMinutes / 30) * 30;
        const finalDuration = roundedDuration < 30 ? 30 : roundedDuration;
        
        // Calculate end time based on rounded service duration
        const startMinutes = targetHour * 60 + roundedMinute;
        const endMinutes = startMinutes + finalDuration;
        const endHour = Math.floor(endMinutes / 60);
        const endMin = endMinutes % 60;
        const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

        // Find or create staff availability entry
        let staffAvailability = serviceAvailability.staff.find((s: any) => s.staffId === staffId);
        
        if (!staffAvailability) {
          staffAvailability = {
            staffId: staffId,
            slots: []
          };
          serviceAvailability.staff.push(staffAvailability);
        }

        // Check if this slot already exists
        const slotExists = staffAvailability.slots.some((slot: AvailabilitySlot) => 
          slot.day === weekday && slot.startTime === startTime && slot.endTime === endTime
        );

        if (!slotExists) {
          // Add the new slot
          staffAvailability.slots.push({
            id: `slot-${Date.now()}-${Math.random()}`,
            day: weekday as AvailabilitySlot["day"],
            startTime: startTime,
            endTime: endTime
          });
        }
      }

      // Save all changes to API
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

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save availability');
      }

      // Update saved availability state with the data we just saved
      // allAvailability already contains all services (merged from savedAvailability state)
      // and now has the updated slots for the current service
      // This preserves availability for all services with temporary IDs
      setSavedAvailability(allAvailability);
      
      // Expand the saved slots FIRST before clearing pending additions
      // This ensures a smooth transition from pending to saved
      const serviceAvail = allAvailability.find(
        (avail: ServiceAvailability) => avail.serviceId === selectedServiceId
      );
      
      if (selectedService && serviceAvail) {
        // Start from the beginning of the current week to show all slots in the week view
        const weekStart = new Date(currentWeekStart);
        weekStart.setHours(0, 0, 0, 0);
        
        const expandedSlots = buildExpandedSlots({
          service: selectedService,
          serviceAvailability: serviceAvail,
          staff: staff,
          timezone: timezone,
          startDate: weekStart,
          horizonDays: 14,
          includePastSlots: true // Show all slots in the current week view for onboarding
        });
        
        // Update fetchedSlots with saved slots BEFORE clearing pending
        // This ensures saved slots appear immediately
        setFetchedSlots(expandedSlots);
      } else {
        setFetchedSlots([]);
      }
      
      // Clear pending additions AFTER we've updated the saved slots
      // This ensures slots switch from "Pending" to "Saved" smoothly
      setPendingAvailabilityAdditions([]);
      
      return true; // Success
    } catch (error) {
      console.error('Error saving availability:', error);
      setError(`Failed to save availability: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false; // Failure
    } finally {
      setIsSavingAvailability(false);
    }
  };

  const handleContinue = async () => {
    setError(null);
    
    // Before continuing, save any pending availability
    if (pendingAvailabilityAdditions.length > 0 && selectedServiceId) {
      const saveSuccess = await handleSaveAvailability();
      if (!saveSuccess) {
        // Error already set by handleSaveAvailability
        return; // Don't continue if save failed
      }
    }
    
    // Convert saved availability to ServiceAvailability format
    // Use saved availability from this session, or convert pending if nothing saved yet
    let result = savedAvailability.length > 0 ? savedAvailability : [];
    
    // If we have no saved availability but have pending, convert pending
    if (result.length === 0 && pendingAvailabilityAdditions.length > 0 && selectedServiceId) {
      result = mapPendingToServiceAvailability();
    }
    
    // Validate that services with staff have at least one slot
    const servicesNeedingAvailability = result.filter(
      (service) => {
        // Check if this service has staff assigned
        const serviceDef = allServices.find(s => s.id === service.serviceId);
        if (!serviceDef || serviceDef.staffIds.length === 0) return false;
        
        // Check if all staff have slots
        return service.staff.length > 0 &&
          service.staff.every((staffEntry) => staffEntry.slots.length === 0);
      }
    );

    if (servicesNeedingAvailability.length) {
      const serviceDef = allServices.find(s => s.id === servicesNeedingAvailability[0].serviceId);
      setError(
        `Add at least one availability slot for service "${serviceDef?.name || servicesNeedingAvailability[0].serviceId}". Each service with staff needs availability to appear in booking.`
      );
      return;
    }

    await onNext(result);
  };

  const mapPendingToServiceAvailability = (): ServiceAvailability[] => {
    // This is a fallback if no current availability exists
    // Convert pending additions to ServiceAvailability format
    const result: ServiceAvailability[] = [];
    
    if (!selectedServiceId || pendingAvailabilityAdditions.length === 0) {
      return result;
    }
    
    const serviceAvailability: ServiceAvailability = {
      serviceId: selectedServiceId,
      staff: []
    };
    
    const staffMap = new Map<string, AvailabilitySlot[]>();
    
    const selectedService = allServices.find(s => s.id === selectedServiceId);
    if (!selectedService) return result;
    
    for (const pending of pendingAvailabilityAdditions) {
      const staffId = pending.staffId;
      const targetDate = pending.date;
      const targetHour = pending.hour;
      const targetMinute = pending.minute ?? 0;
      
      // Round minute to nearest 30-minute block
      const roundedMinute = Math.floor(targetMinute / 30) * 30;
      
      // Store weekday as lowercase to match buildExpandedSlots expectation and API format
      const weekdayName = formatInTimeZone(targetDate, timezone, { weekday: "long" });
      const weekday = weekdayName.toLowerCase();
      const startTime = `${String(targetHour).padStart(2, '0')}:${String(roundedMinute).padStart(2, '0')}`;
      
      // Round service duration to nearest 30-minute increment
      const roundedDuration = Math.round(selectedService.durationMinutes / 30) * 30;
      const finalDuration = roundedDuration < 30 ? 30 : roundedDuration;
      
      // Calculate end time based on rounded service duration
      const startMinutes = targetHour * 60 + roundedMinute;
      const endMinutes = startMinutes + finalDuration;
      const endHour = Math.floor(endMinutes / 60);
      const endMin = endMinutes % 60;
      const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
      
      if (!staffMap.has(staffId)) {
        staffMap.set(staffId, []);
      }
      
      const slots = staffMap.get(staffId)!;
      const slotExists = slots.some(slot => 
        slot.day === weekday && slot.startTime === startTime && slot.endTime === endTime
      );
      
      if (!slotExists) {
        slots.push({
          id: `slot-${Date.now()}-${Math.random()}`,
          day: weekday as AvailabilitySlot["day"],
          startTime: startTime,
          endTime: endTime
        });
      }
    }
    
    for (const [staffId, slots] of staffMap.entries()) {
      serviceAvailability.staff.push({ staffId, slots });
    }
    
    if (serviceAvailability.staff.length > 0) {
      result.push(serviceAvailability);
    }
    
    return result;
  };

  const handleFillTestData = async () => {
    const testData = generateAvailabilityData(services, staff);
    // Save test data via API
    try {
      const supabase = createClientClient();
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      const response = await fetch('/api/business/onboarding/step-7-availability', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
        },
        credentials: 'include',
        body: JSON.stringify({ availability: testData }),
      });

      if (response.ok) {
        setSavedAvailability(testData);
        if (selectedServiceId) {
          const serviceAvail = testData.find((avail: ServiceAvailability) => avail.serviceId === selectedServiceId);
          const selectedService = allServices.find(s => s.id === selectedServiceId);
          if (selectedService && serviceAvail) {
            const today = new Date();
            const expandedSlots = buildExpandedSlots({
              service: selectedService,
              serviceAvailability: serviceAvail,
              staff: staff,
              timezone: timezone,
              startDate: today,
              horizonDays: 14
            });
            setFetchedSlots(expandedSlots);
          }
        }
        setError(null);
      }
    } catch (error) {
      console.error('Error filling test data:', error);
      setError('Failed to load test data');
    }
  };

  const monthYear = formatInTimeZone(weekDays[0], timezone, { month: "long", year: "numeric" });
  const selectedService = allServices.find(s => s.id === selectedServiceId);

  return (
    <div className="space-y-8" aria-labelledby="availability-step-heading">
      <header className="space-y-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary/90">
          <CalendarCheck2 className="h-4 w-4" aria-hidden="true" />
          Step 7 · Availability
        </span>
        <h2 id="availability-step-heading" className="font-display text-3xl text-white">
          Set availability by clicking time slots
        </h2>
        <p className="max-w-3xl text-base text-white/70">
          Select a service and staff member, then click empty time slots to add availability. Click again to remove. Click "Save Availability" when done, then continue to the next step. This availability will be used in your booking flow.
        </p>
      </header>

      {/* Service Dropdown */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <Label className="text-white/70 mb-2 block">Filter by Service</Label>
        <select
          className="w-full rounded-2xl border border-white/15 bg-black/60 px-4 py-3 text-sm text-white focus:border-primary focus:outline-none"
          value={selectedServiceId || ""}
          onChange={(e) => {
            setSelectedServiceId(e.target.value || null);
            // Clear pending availability when changing service
            setPendingAvailabilityAdditions([]);
            setError(null);
          }}
        >
          <option value="" className="bg-black text-white">
            All Services
          </option>
          {allServices.map((service) => (
            <option key={service.id} value={service.id} className="bg-black text-white">
              {service.categoryName} - {service.name} ({service.durationMinutes} min · $
              {(service.priceCents / 100).toFixed(2)})
            </option>
          ))}
        </select>
        {selectedService && (
          <p className="mt-2 text-xs text-white/60">
            Showing availability for: <strong className="text-white">{selectedService.name}</strong>
          </p>
        )}
      </div>

      {/* Staff Selection Pills - Only show when service is selected */}
      {selectedServiceId && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <Label className="text-white/70 mb-3 block">Select Staff Member</Label>
          <div className="flex flex-wrap items-center gap-3">
            <StaffPill
              label="All Staff"
              active={selectedStaffId === "any"}
              onClick={() => {
                setSelectedStaffId("any");
                // Don't clear pending - keep all pending slots visible
              }}
            />
            {staff
              .filter(member => {
                if (member.active === false) return false;
                // Only show staff assigned to this service
                if (selectedService) {
                  return selectedService.staffIds.includes(member.id);
                }
                return true;
              })
              .map((member) => {
                return (
                  <StaffPill
                    key={member.id}
                    label={member.name}
                    color={member.color}
                    active={selectedStaffId === member.id}
                    onClick={() => {
                      // Don't clear pending - keep all pending slots visible when switching staff
                      setSelectedStaffId(member.id);
                    }}
                  />
                );
              })
            }
          </div>
          <HelperText className="mt-3 text-white/50">
            {selectedStaffId === "any" 
              ? "Select a staff member above, then click empty time slots to add availability"
              : `Adding availability for ${staff.find(s => s.id === selectedStaffId)?.name}. Click empty time slots to add availability. Click "Save" when done.`}
          </HelperText>
          {pendingAvailabilityAdditions.length > 0 && (
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  {pendingAvailabilityAdditions.length} availability slot{pendingAvailabilityAdditions.length > 1 ? 's' : ''} pending
                </p>
                <p className="text-xs text-white/60">
                  Click "Save" to apply changes to the booking system
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  onClick={() => setPendingAvailabilityAdditions([])} 
                  disabled={isSavingAvailability}
                >
                  Clear
                </Button>
                <Button 
                  onClick={handleSaveAvailability} 
                  isLoading={isSavingAvailability} 
                  disabled={isSavingAvailability}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Availability
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Week Navigation */}
      <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/5 px-6 py-4">
        <Button
          variant="ghost"
          onClick={() => navigateWeek("prev")}
          className="text-white/70 hover:text-white"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white">{monthYear}</h3>
          <p className="text-xs text-white/60">
            {formatInTimeZone(weekDays[0], timezone, { month: "short", day: "numeric" })} -{" "}
            {formatInTimeZone(weekDays[6], timezone, { month: "short", day: "numeric" })}
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => navigateWeek("next")}
          className="text-white/70 hover:text-white"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Calendar Grid - Matching Admin View Style */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_0_60px_rgba(91,100,255,0.15)]">
        {!selectedServiceId ? (
          <div className="rounded-3xl border border-white/10 bg-black/60 p-8 text-center text-white/60">
            <p className="text-base">Select a service above to add availability</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-full">
              {/* Day Headers */}
              <div className="grid grid-cols-8 gap-2 border-b border-white/10 pb-2">
                <div className="text-xs font-semibold text-white/60">Time</div>
                {weekDays.map((day, idx) => (
                  <div key={idx} className="text-center">
                    <p className="text-xs font-semibold text-white/60">
                      {formatInTimeZone(day, timezone, { weekday: "short" })}
                    </p>
                    <p className="text-sm font-semibold text-white">
                      {formatInTimeZone(day, timezone, { day: "numeric" })}
                    </p>
                  </div>
                ))}
              </div>

              {/* Time Segment Rows - 30-minute blocks */}
              <div className="mt-2 space-y-1">
                {timeSegments.map((segment) => {
                  const timeLabel = segment.minute === 0 
                    ? (segment.hour === 12 ? "12 PM" : segment.hour > 12 ? `${segment.hour - 12} PM` : `${segment.hour} AM`)
                    : `${segment.minute}`;
                  const timeKey = `${segment.hour}:${segment.minute.toString().padStart(2, '0')}`;
                  
                  return (
                    <div key={timeKey} className="grid grid-cols-8 gap-2">
                      <div className="flex items-center text-xs text-white/60 py-2">
                        {segment.minute === 0 ? (
                          <span>{segment.hour === 12 ? "12 PM" : segment.hour > 12 ? `${segment.hour - 12} PM` : `${segment.hour} AM`}</span>
                        ) : (
                          <span className="text-white/40">{segment.minute}</span>
                        )}
                      </div>
                      {weekDays.map((day, dayIdx) => {
                        const dateKey = formatInTimeZone(day, timezone, "yyyy-MM-dd");
                        const slotsForSegment = slotsByDayAndTime[dateKey]?.[timeKey] || [];
                        
                        // Filter out duplicate slots (same slot ID)
                        const uniqueSlots = slotsForSegment.filter((slot, index, self) => 
                          index === self.findIndex(s => s.id === slot.id)
                        );
                        
                        // Group slots by their exact start time - slots that start together should be rendered as one continuous block
                        const slotsByStartTime = new Map<string, typeof uniqueSlots>();
                        uniqueSlots.forEach(slot => {
                          const slotStart = new Date(slot.startDateTime);
                          const slotHour = parseInt(formatInTimeZone(slotStart, timezone, { hour: "numeric", hour12: false }), 10);
                          const slotMinute = parseInt(formatInTimeZone(slotStart, timezone, { minute: "numeric" }), 10);
                          const slotRoundedMinute = Math.floor(slotMinute / 30) * 30;
                          const startKey = `${slotHour}:${slotRoundedMinute.toString().padStart(2, '0')}`;
                          
                          if (!slotsByStartTime.has(startKey)) {
                            slotsByStartTime.set(startKey, []);
                          }
                          slotsByStartTime.get(startKey)!.push(slot);
                        });
                        
                        // Determine if this is the starting block for each slot group
                        // Also check if slots should appear in this segment as continuation blocks
                        const slotGroups = Array.from(slotsByStartTime.entries()).map(([startKey, slots]) => {
                          const [hour, minute] = startKey.split(':').map(Number);
                          const isStartingBlock = hour === segment.hour && minute === segment.minute;
                          
                          // Check if any slot in this group should appear in this segment (even if not starting)
                          const segmentStartMinutes = segment.hour * 60 + segment.minute;
                          const segmentEndMinutes = segmentStartMinutes + 30;
                          
                          const shouldAppear = isStartingBlock || slots.some(slot => {
                            const slotStart = new Date(slot.startDateTime);
                            const slotEnd = new Date(slot.endDateTime);
                            const slotStartMinutes = hour * 60 + minute;
                            const slotEndMinutes = slotStartMinutes + (slotEnd.getTime() - slotStart.getTime()) / (1000 * 60);
                            
                            // Slot appears in this segment if it overlaps
                            return slotStartMinutes < segmentEndMinutes && slotEndMinutes > segmentStartMinutes;
                          });
                          
                          return { startKey, slots, isStartingBlock, shouldAppear };
                        }).filter(({ shouldAppear }) => shouldAppear);
                        
                        // Calculate service duration for visual spanning
                        const selectedService = allServices.find(s => s.id === selectedServiceId);
                        const roundedDuration = selectedService ? Math.round(selectedService.durationMinutes / 30) * 30 : 30;
                        const finalDuration = roundedDuration < 30 ? 30 : roundedDuration;
                        const blocksSpanned = Math.ceil(finalDuration / 30);
                        const blockMinHeightRem = 3;
                        const blockPaddingRem = 0.5;
                        const firstBlockHeight = blockMinHeightRem + blockPaddingRem;
                        
                        return (
                          <div key={dayIdx} className="relative py-1 min-h-[3.5rem]">
                            {slotGroups.map(({ startKey, slots: groupSlots, isStartingBlock }, groupIdx) => {
                              const totalStaffCount = groupSlots.length;
                              const slotHeightInBlock = firstBlockHeight / totalStaffCount;
                              
                              if (isStartingBlock) {
                                // Render all staff slots for this time as horizontal sections within one continuous block
                                return (
                                  <React.Fragment key={`${startKey}-${groupIdx}`}>
                                    {groupSlots.map((slot, slotIdx) => {
                                      const staffMember = staff.find(s => s.id === slot.staffId);
                                      const isPending = slot.id && slot.id.startsWith('pending-');
                                      const isSelectedStaff = selectedStaffId !== "any" && slot.staffId === selectedStaffId;
                                      const slotTopOffset = slotIdx * slotHeightInBlock;
                                      
                                      // Calculate how many 30-minute blocks this slot spans
                                      const slotStart = new Date(slot.startDateTime);
                                      const slotEnd = new Date(slot.endDateTime);
                                      const slotDurationMinutes = (slotEnd.getTime() - slotStart.getTime()) / (1000 * 60);
                                      const slotBlocksSpanned = Math.ceil(slotDurationMinutes / 30);
                                      
                                      return (
                                        <button
                                          key={slot.id}
                                          type="button"
                                          className={`absolute left-0 right-0 w-full rounded-lg border-2 px-2.5 py-1.5 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                                            isPending
                                              ? "border-primary/80 bg-primary/25 hover:border-red-500/80 hover:bg-red-500/25"
                                              : "border-primary/60 bg-primary/15 hover:border-primary/80 hover:bg-primary/25"
                                          }`}
                                          style={{
                                            height: `${slotHeightInBlock}rem`,
                                            minHeight: `${slotHeightInBlock}rem`,
                                            top: `${slotTopOffset}rem`,
                                            zIndex: 100 + slotIdx,
                                            position: 'absolute',
                                            borderTop: slotIdx === 0 ? undefined : 'none',
                                            borderBottom: slotIdx === totalStaffCount - 1 && slotBlocksSpanned === 1 ? undefined : 'none',
                                            borderBottomLeftRadius: (slotIdx === totalStaffCount - 1 && slotBlocksSpanned === 1) ? undefined : '0',
                                            borderBottomRightRadius: (slotIdx === totalStaffCount - 1 && slotBlocksSpanned === 1) ? undefined : '0',
                                            borderTopLeftRadius: slotIdx === 0 ? undefined : '0',
                                            borderTopRightRadius: slotIdx === 0 ? undefined : '0',
                                            borderColor: staffMember?.color ? `${staffMember.color}95` : undefined,
                                            backgroundColor: staffMember?.color ? `${staffMember.color}18` : undefined,
                                          }}
                                          onClick={isPending && isSelectedStaff ? () => {
                                            const slotDateKey = formatInTimeZone(day, timezone, "yyyy-MM-dd");
                                            const slotStart = new Date(slot.startDateTime);
                                            const slotHour = parseInt(formatInTimeZone(slotStart, timezone, { hour: "numeric", hour12: false }), 10);
                                            const slotMinute = parseInt(formatInTimeZone(slotStart, timezone, { minute: "numeric" }), 10);
                                            const slotRoundedMinute = Math.floor(slotMinute / 30) * 30;
                                            setPendingAvailabilityAdditions((prev) =>
                                              prev.filter(
                                                (pending) => {
                                                  const pendingDateKey = formatInTimeZone(pending.date, timezone, "yyyy-MM-dd");
                                                  return !(pending.staffId === slot.staffId &&
                                                    pendingDateKey === slotDateKey &&
                                                    pending.hour === slotHour &&
                                                    pending.minute === slotRoundedMinute);
                                                }
                                              )
                                            );
                                          } : undefined}
                                          title={isPending && isSelectedStaff ? "Click to remove" : undefined}
                                        >
                                          <p className="text-[11px] font-bold text-white leading-tight">
                                            {slot.staffName}
                                          </p>
                                          <p className={`text-[8px] font-semibold leading-tight mt-0.5 ${isPending ? 'text-primary/90' : 'text-emerald-400/90'}`}>
                                            {isPending ? '✓ Pending' : '✓ Saved'}
                                          </p>
                                        </button>
                                      );
                                    })}
                                  </React.Fragment>
                                );
                              } else {
                                // In continuation blocks, check if slot actually overlaps with this segment
                                const [startHour, startMinute] = startKey.split(':').map(Number);
                                const segmentStartMinutes = segment.hour * 60 + segment.minute;
                                const segmentEndMinutes = segmentStartMinutes + 30;
                                
                                return (
                                  <React.Fragment key={`${startKey}-continuation-${groupIdx}`}>
                                    {groupSlots.map((slot, slotIdx) => {
                                      const slotStart = new Date(slot.startDateTime);
                                      const slotEnd = new Date(slot.endDateTime);
                                      const slotStartMinutes = startHour * 60 + startMinute;
                                      const slotEndMinutes = slotStartMinutes + (slotEnd.getTime() - slotStart.getTime()) / (1000 * 60);
                                      
                                      // Only render continuation if slot actually overlaps with this segment
                                      if (slotStartMinutes >= segmentEndMinutes || slotEndMinutes <= segmentStartMinutes) {
                                        return null;
                                      }
                                      
                                      const staffMember = staff.find(s => s.id === slot.staffId);
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
                                            marginTop: slotIdx === 0 ? '-1px' : '0',
                                          }}
                                        />
                                      );
                                    })}
                                  </React.Fragment>
                                );
                              }
                            })}
                            
                            {/* Show empty state if no slots - make it clickable to add availability */}
                            {uniqueSlots.length === 0 && (
                              <button
                                type="button"
                                onClick={() => handleEmptySlotClick(day, segment.hour, segment.minute)}
                                className="h-full w-full rounded-lg bg-white/5 border border-white/5 hover:border-primary/40 hover:bg-primary/10 py-1.5 transition cursor-pointer min-h-[3.5rem]"
                                title="Click to add availability"
                              >
                                <p className="text-[10px] text-white/20 text-center">+ Add</p>
                              </button>
                            )}
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

      {error ? (
        <HelperText intent="error" role="alert">
          {error}
        </HelperText>
      ) : null}

      <div className="mt-8 flex items-center justify-end gap-3">
        <TestDataButton onClick={handleFillTestData} />
      </div>


      <StepActions onBack={onBack} onNext={handleContinue} />
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
      className={`rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
        active 
          ? "border-white/60 bg-white/15 text-white" 
          : "border-white/10 bg-white/5 text-white/60 hover:text-white/80"
      }`}
      style={active && color ? { borderColor: color, boxShadow: `0 0 25px ${color}33` } : undefined}
    >
      {label}
    </button>
  );
}
