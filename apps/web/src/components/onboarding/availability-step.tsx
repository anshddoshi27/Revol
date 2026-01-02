"use client";

import { useMemo, useState, useEffect } from "react";
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
  const [savedAvailability, setSavedAvailability] = useState<ServiceAvailability[]>([]);
  // Pending availability additions - slots clicked but not yet saved
  const [pendingAvailabilityAdditions, setPendingAvailabilityAdditions] = useState<Array<{
    staffId: string;
    date: Date;
    hour: number;
  }>>([]);
  const [error, setError] = useState<string | null>(null);

  // Get all services for dropdown
  const allServices = services.flatMap((category) =>
    category.services.map((service) => ({
      ...service,
      categoryName: category.name
    }))
  );

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

  // Group availability slots by day and hour (including pending additions)
  const slotsByDayAndHour = useMemo(() => {
    const grouped: Record<string, Record<number, ExpandedAvailabilitySlot[]>> = {};
    
    // Flatten all slots from all days
    const allSlots = Object.values(groupedSlots).flat();
    
    // Add fetched slots
    allSlots.forEach(slot => {
      const slotDate = new Date(slot.startDateTime);
      const dateKey = formatInTimeZone(slotDate, timezone, "yyyy-MM-dd");
      const hour = formatInTimeZone(slotDate, timezone, { hour: "numeric", hour12: false });
      const hourNum = parseInt(hour, 10);
      
      // Only include slots that are in the current week
      const isInCurrentWeek = weekDays.some(day => {
        const dayKey = formatInTimeZone(day, timezone, "yyyy-MM-dd");
        return dayKey === dateKey;
      });
      
      if (!isInCurrentWeek) return;
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = {};
      }
      
      if (!grouped[dateKey][hourNum]) {
        grouped[dateKey][hourNum] = [];
      }
      
      // Check for duplicates (same hour, same staff, same date)
      const isDuplicate = grouped[dateKey][hourNum].some(
        existing => existing.staffId === slot.staffId && existing.startDateTime === slot.startDateTime
      );
      
      if (!isDuplicate) {
        grouped[dateKey][hourNum].push(slot);
      }
    });
    
    // Add pending availability additions as visual slots
    if (selectedServiceId) {
      const selectedService = allServices.find(s => s.id === selectedServiceId);
      if (selectedService) {
        pendingAvailabilityAdditions.forEach((pending) => {
          const dateKey = formatInTimeZone(pending.date, timezone, "yyyy-MM-dd");
          const hourNum = pending.hour;
          
          // Only include if in current week
          const isInCurrentWeek = weekDays.some(day => {
            const dayKey = formatInTimeZone(day, timezone, "yyyy-MM-dd");
            return dayKey === dateKey;
          });
          
          if (!isInCurrentWeek) return;
          
          if (!grouped[dateKey]) {
            grouped[dateKey] = {};
          }
          
          if (!grouped[dateKey][hourNum]) {
            grouped[dateKey][hourNum] = [];
          }
          
          // Check if this pending slot already exists as pending (don't duplicate)
          const alreadyPending = grouped[dateKey][hourNum].some(
            existing => existing.staffId === pending.staffId && 
            existing.id && existing.id.startsWith('pending-')
          );
          
          if (!alreadyPending) {
            // Remove any saved slot for the same time/staff (pending replaces saved)
            grouped[dateKey][hourNum] = grouped[dateKey][hourNum].filter(
              existing => !(existing.staffId === pending.staffId && !existing.id?.startsWith('pending-'))
            );
            
            const staffMember = staff.find((s: StaffMember) => s.id === pending.staffId);
            const startDateTime = zonedMinutesToDate(pending.date, pending.hour * 60, timezone);
            const endDateTime = new Date(startDateTime.getTime() + selectedService.durationMinutes * 60 * 1000);
            
            grouped[dateKey][hourNum].push({
              id: `pending-${pending.staffId}-${dateKey}-${hourNum}`,
              serviceId: selectedServiceId,
              staffId: pending.staffId,
              staffName: staffMember?.name || 'Unknown',
              staffColor: staffMember?.color || "#000000",
              startDateTime: startDateTime.toISOString(),
              endDateTime: endDateTime.toISOString(),
              dayLabel: formatInTimeZone(pending.date, timezone, { weekday: "long" }),
            });
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

  const handleEmptySlotClick = (day: Date, hour: number) => {
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
    
    // Check if ALL selected staff already have this slot pending
    const allPending = staffToProcess.every(member => 
      pendingAvailabilityAdditions.some(
        (pending) =>
          pending.staffId === member.id &&
          pending.date.toDateString() === day.toDateString() &&
          pending.hour === hour
      )
    );
    
    if (allPending) {
      // Remove for all selected staff (toggle off)
      setPendingAvailabilityAdditions((prev) =>
        prev.filter(
          (pending) => {
            const isSelectedStaff = staffToProcess.some(m => m.id === pending.staffId);
            return !(isSelectedStaff &&
              pending.date.toDateString() === day.toDateString() &&
              pending.hour === hour);
          }
        )
      );
    } else {
      // Add for all selected staff (or just the one selected)
      const newAdditions = staffToProcess
        .filter(member => {
          // Only add if not already pending
          return !pendingAvailabilityAdditions.some(
            (pending) =>
              pending.staffId === member.id &&
              pending.date.toDateString() === day.toDateString() &&
              pending.hour === hour
          );
        })
        .map(member => ({
          staffId: member.id,
          date: day,
          hour
        }));
      
      if (newAdditions.length > 0) {
        setPendingAvailabilityAdditions((prev) => [...prev, ...newAdditions]);
      }
    }
    
    setError(null);
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
        const staffId = pending.staffId;

        // Get weekday name from the date (timezone-aware)
        // Store as lowercase to match buildExpandedSlots expectation and API format
        const weekdayName = formatInTimeZone(targetDate, timezone, { weekday: "long" });
        const weekday = weekdayName.toLowerCase();
        
        // Format time as HH:mm
        const startTime = `${String(targetHour).padStart(2, '0')}:00`;
        
        // Calculate end time based on service duration
        const startMinutes = targetHour * 60;
        const endMinutes = startMinutes + selectedService.durationMinutes;
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
      
      // Store weekday as lowercase to match buildExpandedSlots expectation and API format
      const weekdayName = formatInTimeZone(targetDate, timezone, { weekday: "long" });
      const weekday = weekdayName.toLowerCase();
      const startTime = `${String(targetHour).padStart(2, '0')}:00`;
      const startMinutes = targetHour * 60;
      const endMinutes = startMinutes + selectedService.durationMinutes;
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
          className="w-full rounded-2xl border border-white/15 bg-[#050F2C]/60 px-4 py-3 text-sm text-white focus:border-primary focus:outline-none"
          value={selectedServiceId || ""}
          onChange={(e) => {
            setSelectedServiceId(e.target.value || null);
            // Clear pending availability when changing service
            setPendingAvailabilityAdditions([]);
            setError(null);
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

              {/* Hour Rows */}
              <div className="mt-2 space-y-1">
                {hours.map((hour) => {
                  const hourLabel = hour === 12 ? "12 PM" : hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
                  return (
                    <div key={hour} className="grid grid-cols-8 gap-2">
                      <div className="flex items-center text-xs text-white/60 py-2">
                        {hourLabel}
                      </div>
                      {weekDays.map((day, dayIdx) => {
                        const dateKey = formatInTimeZone(day, timezone, "yyyy-MM-dd");
                        const slotsForHour = slotsByDayAndHour[dateKey]?.[hour] || [];

                        return (
                          <div key={dayIdx} className="py-1">
                            <div className="space-y-1">
                              {/* Show available slots */}
                              {slotsForHour.map((slot) => {
                                const staffMember = staff.find(s => s.id === slot.staffId);
                                const isPending = slot.id && slot.id.startsWith('pending-');
                                const isSelectedStaff = selectedStaffId !== "any" && slot.staffId === selectedStaffId;
                                
                                return (
                                  <button
                                    key={slot.id}
                                    type="button"
                                    onClick={isPending && isSelectedStaff ? () => {
                                      // Remove pending slot on click
                                      const slotDateKey = formatInTimeZone(day, timezone, "yyyy-MM-dd");
                                      setPendingAvailabilityAdditions((prev) =>
                                        prev.filter(
                                          (pending) => {
                                            const pendingDateKey = formatInTimeZone(pending.date, timezone, "yyyy-MM-dd");
                                            return !(pending.staffId === slot.staffId &&
                                              pendingDateKey === slotDateKey &&
                                              pending.hour === hour);
                                          }
                                        )
                                      );
                                    } : undefined}
                                    className={`w-full rounded-lg border px-2 py-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
                                      isPending
                                        ? "border-primary/60 bg-primary/20 hover:border-red-500/60 hover:bg-red-500/20"
                                        : "border-primary/40 bg-primary/20 hover:border-primary/60 hover:bg-primary/30"
                                    }`}
                                    style={{
                                      borderColor: staffMember?.color ? `${staffMember.color}80` : undefined,
                                      backgroundColor: staffMember?.color ? `${staffMember.color}20` : undefined,
                                    }}
                                    title={isPending && isSelectedStaff ? "Click to remove" : undefined}
                                  >
                                    <p className="text-xs font-semibold text-white">
                                      {formatInTimeZone(new Date(slot.startDateTime), timezone, { hour: "numeric", minute: "2-digit" })}
                                    </p>
                                    <p className="text-[10px] text-white/70 mt-0.5 truncate">
                                      {slot.staffName}
                                    </p>
                                    <p className={`text-[10px] mt-0.5 truncate ${isPending ? "text-primary/90 font-semibold" : "text-emerald-400/90 font-semibold"}`}>
                                      {isPending ? "✓ Pending" : "✓ Saved"}
                                    </p>
                                  </button>
                                );
                              })}
                              
                              {/* Show empty state if no slots - make it clickable to add availability */}
                              {slotsForHour.length === 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleEmptySlotClick(day, hour)}
                                  className="h-full w-full rounded-lg bg-white/5 border border-white/5 hover:border-primary/40 hover:bg-primary/10 py-1.5 transition cursor-pointer"
                                  title="Click to add availability"
                                >
                                  <p className="text-[10px] text-white/20 text-center">+ Add</p>
                                </button>
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
