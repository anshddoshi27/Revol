"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Save, Edit2, X, CalendarDays, Clock, User, Plus } from "lucide-react";

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
  }>>([]);

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
      // Fetch availability for the next 14 days (2 weeks)
      const today = new Date();
      const allSlots: ExpandedAvailabilitySlot[] = [];
      const dayFormatter = new Intl.DateTimeFormat("en-US", { 
        timeZone: timezone, 
        weekday: "long" 
      });
      
      // Fetch all dates in parallel for better performance
      const datePromises = [];
      for (let i = 0; i < 14; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        
        datePromises.push(
          fetch(
            `/api/public/${businessSlug}/availability?service_id=${selectedServiceId}&date=${dateStr}`,
            {
              credentials: 'include',
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
          // Transform API slots to ExpandedAvailabilitySlot format
          for (const slot of data.slots) {
            const startDate = new Date(slot.start_at);
            const dayLabel = dayFormatter.format(startDate);
            
            // Find staff member to get color
            const staffMember = staffArray.find(s => s.id === slot.staff_id);
            const staffColor = staffMember?.color || "#000000";
            
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
        }
      });
      
      setFetchedSlots(allSlots);
    } catch (error) {
      console.error('Error fetching availability:', error);
      setAvailabilityError('Failed to load availability. Please try again.');
    } finally {
      setIsLoadingAvailability(false);
      isFetchingRef.current = false;
    }
  }, [selectedServiceId, businessSlug, timezone, staffArray]);

  // Fetch availability when service or business slug changes
  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  // Group slots by day
  const groupedSlots = useMemo(() => {
    if (!selectedServiceId) return {};
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

  // Group bookings by day and hour
  const bookingsByDayAndHour = useMemo(() => {
    const grouped: Record<string, Record<number, FakeBooking[]>> = {};

    bookings.forEach((booking) => {
      // Filter by selected service if one is selected
      if (selectedServiceId && booking.serviceId !== selectedServiceId) {
        return;
      }

      const bookingDate = new Date(booking.startDateTime);
      const dateKey = formatInTimeZone(bookingDate, timezone, "yyyy-MM-dd");
      const hour = formatInTimeZone(bookingDate, timezone, { hour: "numeric", hour12: false });
      const hourNum = parseInt(hour, 10);

      // Only include bookings that are in the current week
      const isInCurrentWeek = weekDays.some((day) => {
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

      grouped[dateKey][hourNum].push(booking);
    });

    return grouped;
  }, [bookings, weekDays, timezone, selectedServiceId]);

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
          
          // Check if this pending slot already exists (don't duplicate)
          const alreadyExists = grouped[dateKey][hourNum].some(
            existing => existing.staffId === pending.staffId && 
            existing.id && existing.id.startsWith('pending-')
          );
          
          if (!alreadyExists) {
            const staffMember = staffArray.find((s: StaffMember) => s.id === pending.staffId);
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
  }, [groupedSlots, weekDays, timezone, pendingAvailabilityAdditions, selectedServiceId, allServices, staffArray]);

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

  const handleEmptySlotClick = (day: Date, hour: number) => {
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
          pending.hour === hour
      );
      
      if (alreadyPending) {
        // Remove it if clicking again (toggle)
        setPendingAvailabilityAdditions((prev) =>
          prev.filter(
            (pending) =>
              !(pending.staffId === selectedStaffId &&
                pending.date.toDateString() === day.toDateString() &&
                pending.hour === hour)
          )
        );
      } else {
        // Add to pending
        setPendingAvailabilityAdditions((prev) => [
          ...prev,
          { staffId: selectedStaffId, date: day, hour }
        ]);
      }
    } else {
      // If "any" is selected, show modal to pick staff
      setAddingAvailability({ date: day, hour, minute: 0 });
    }
  };

  const handleAddAvailabilityForStaff = (staffId: string, date?: Date, hour?: number) => {
    if (!selectedServiceId) return;
    
    // Use provided date/hour or from addingAvailability state
    const targetDate = date || addingAvailability?.date;
    const targetHour = hour !== undefined ? hour : addingAvailability?.hour;
    
    if (!targetDate || targetHour === undefined) return;

    // Check if this slot is already pending
    const alreadyPending = pendingAvailabilityAdditions.some(
      (pending) =>
        pending.staffId === staffId &&
        pending.date.toDateString() === targetDate.toDateString() &&
        pending.hour === targetHour
    );
    
    if (alreadyPending) {
      // Remove it if clicking again (toggle)
      setPendingAvailabilityAdditions((prev) =>
        prev.filter(
          (pending) =>
            !(pending.staffId === staffId &&
              pending.date.toDateString() === targetDate.toDateString() &&
              pending.hour === targetHour)
        )
      );
    } else {
      // Add to pending
      setPendingAvailabilityAdditions((prev) => [
        ...prev,
        { staffId, date: targetDate, hour: targetHour }
      ]);
    }

    // Close modal if it was open
    if (addingAvailability) {
      setAddingAvailability(null);
    }
  };

  const handleSaveAvailability = async () => {
    if (!selectedServiceId || pendingAvailabilityAdditions.length === 0) return;

    setIsSavingAvailability(true);
    try {
      // Get auth token from Supabase client
      const supabase = createClientClient();
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      // Get current availability
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
      }

      const selectedService = allServices.find(s => s.id === selectedServiceId);
      if (!selectedService) return;

      // Find or create service availability entry
      let serviceAvailability = allAvailability.find((avail: any) => avail.serviceId === selectedServiceId);
      
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
        const weekdayName = formatInTimeZone(targetDate, timezone, { weekday: "long" });
        const weekday = weekdayName.charAt(0).toUpperCase() + weekdayName.slice(1).toLowerCase();
        
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
        const slotExists = staffAvailability.slots.some((slot: any) => 
          slot.day === weekday && slot.startTime === startTime && slot.endTime === endTime
        );

        if (!slotExists) {
          // Add the new slot
          staffAvailability.slots.push({
            id: `slot-${Date.now()}-${Math.random()}`,
            day: weekday,
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
        throw new Error('Failed to save availability');
      }

      // Clear pending additions
      setPendingAvailabilityAdditions([]);
      
      // Refetch availability for the next 14 days
      if (businessSlug) {
        const today = new Date();
        const allSlots: ExpandedAvailabilitySlot[] = [];
        const dayFormatter = new Intl.DateTimeFormat("en-US", { 
          timeZone: timezone, 
          weekday: "long" 
        });
        
        for (let i = 0; i < 14; i++) {
          const fetchDate = new Date(today);
          fetchDate.setDate(today.getDate() + i);
          const dateStr = fetchDate.toISOString().split('T')[0];
          
          try {
            const fetchResponse = await fetch(
              `/api/public/${businessSlug}/availability?service_id=${selectedServiceId}&date=${dateStr}`,
              {
                credentials: 'include',
              }
            );
            
            if (fetchResponse.ok) {
              const fetchData = await fetchResponse.json();
              
              if (fetchData.slots && Array.isArray(fetchData.slots)) {
                for (const slot of fetchData.slots) {
                  const startDate = new Date(slot.start_at);
                  const dayLabel = dayFormatter.format(startDate);
                  
                  const staffMember = staffArray.find(s => s.id === slot.staff_id);
                  const staffColor = staffMember?.color || "#000000";
                  
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
              }
            }
          } catch (err) {
            console.error(`Error refetching availability for ${dateStr}:`, err);
          }
        }
        
        setFetchedSlots(allSlots);
      }
    } catch (error) {
      console.error('Error saving availability:', error);
      alert(`Failed to save availability: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSavingAvailability(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingBooking(null);
    setUnsavedChanges(false);
  };

  const monthYear = formatInTimeZone(weekDays[0], timezone, { month: "long", year: "numeric" });
  const selectedService = allServices.find(s => s.id === selectedServiceId);

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.35em] text-white/40">Scheduling</p>
        <h1 className="font-display text-4xl text-white">Calendar</h1>
        <p className="max-w-3xl text-sm text-white/60">
          View and edit all bookings in a week view. Select a service and staff member, then click empty time slots to add availability. Click existing availability slots to create bookings or click existing bookings to edit them.
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
            setEditingBooking(null);
            setUnsavedChanges(false);
            // Clear pending availability when changing service
            setPendingAvailabilityAdditions([]);
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
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <Label className="text-white/70 mb-3 block">Select Staff Member</Label>
          <div className="flex flex-wrap items-center gap-3">
            <StaffPill
              label="All Staff"
              active={selectedStaffId === "any"}
              onClick={() => {
                setSelectedStaffId("any");
                // Clear pending when switching to "any"
                setPendingAvailabilityAdditions([]);
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
                    // Clear pending for other staff when switching
                    setPendingAvailabilityAdditions((prev) => 
                      prev.filter(p => p.staffId === member.id)
                    );
                    setSelectedStaffId(member.id);
                  }}
                />
              ))}
          </div>
          <HelperText className="mt-3 text-white/50">
            {selectedStaffId === "any" 
              ? "Select a staff member above, then click empty time slots to add availability"
              : `Adding availability for ${staffArray.find(s => s.id === selectedStaffId)?.name}. Click empty time slots to add availability. Click "Save" when done.`}
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

      {/* Calendar Grid - Matching Booking Flow Style */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_0_60px_rgba(91,100,255,0.15)]">
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
                        const bookingsForHour = bookingsByDayAndHour[dateKey]?.[hour] || [];
                        const slotsForHour = slotsByDayAndHour[dateKey]?.[hour] || [];

                        return (
                          <div key={dayIdx} className="py-1">
                            <div className="space-y-1">
                              {/* Show existing bookings first */}
                              {bookingsForHour.map((booking) => {
                                const staffMember = staffArray.find(
                                  (s) => s.id === booking.staff?.id
                                );
                                const isEditing = editingBooking?.id === booking.id;

                                return (
                                  <button
                                    key={booking.id}
                                    type="button"
                                    onClick={() => handleEditBooking(booking)}
                                    className={`w-full rounded-lg border px-2 py-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
                                      isEditing
                                        ? "border-primary bg-primary/30 ring-2 ring-primary/50"
                                        : "border-primary/40 bg-primary/20 hover:border-primary/60 hover:bg-primary/30"
                                    }`}
                                    style={{
                                      borderColor: staffMember?.color
                                        ? `${staffMember.color}80`
                                        : undefined,
                                      backgroundColor: staffMember?.color
                                        ? `${staffMember.color}20`
                                        : undefined
                                    }}
                                  >
                                    <p className="text-xs font-semibold text-white">
                                      {formatInTimeZone(
                                        new Date(booking.startDateTime),
                                        timezone,
                                        { hour: "numeric", minute: "2-digit" }
                                      )}
                                    </p>
                                    <p className="text-[10px] text-white/70 mt-0.5 truncate">
                                      {booking.serviceName}
                                    </p>
                                    <p className="text-[10px] text-white/60 mt-0.5 truncate">
                                      {booking.customer.name || 'Unnamed'}
                                    </p>
                                    {booking.staff && (
                                      <p className="text-[10px] text-white/50 mt-0.5 truncate">
                                        {booking.staff.name}
                                      </p>
                                    )}
                                  </button>
                                );
                              })}
                              
                              {/* Show available slots (only if no bookings at this time) */}
                              {bookingsForHour.length === 0 && slotsForHour.map((slot) => {
                                const staffMember = staffArray.find(s => s.id === slot.staffId);
                                const isPending = slot.id && slot.id.startsWith('pending-');
                                const isSelectedStaff = selectedStaffId !== "any" && slot.staffId === selectedStaffId;
                                
                                return (
                                  <button
                                    key={slot.id}
                                    type="button"
                                    onClick={isPending && isSelectedStaff ? () => {
                                      // Remove pending slot on click - parse slot.id to get dateKey and hour
                                      // slot.id format: pending-{staffId}-{dateKey}-{hour}
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
                                    } : () => handleSlotClick(slot)}
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
                                    <p className={`text-[10px] mt-0.5 truncate ${isPending ? "text-primary/90 font-semibold" : "text-white/50"}`}>
                                      {isPending ? "✓ Pending" : "Available"}
                                    </p>
                                  </button>
                                );
                              })}
                              
                              {/* Show empty state if no bookings or slots - make it clickable to add availability */}
                              {bookingsForHour.length === 0 && slotsForHour.length === 0 && (() => {
                                // Only allow clicking if a specific staff member is selected
                                if (selectedStaffId === "any") {
                                  return (
                                    <div className="h-full w-full rounded-lg bg-white/5 border border-white/5 py-1.5">
                                      <p className="text-[10px] text-white/20 text-center">+ Add</p>
                                    </div>
                                  );
                                }

                                return (
                                  <button
                                    type="button"
                                    onClick={() => handleEmptySlotClick(day, hour)}
                                    className="h-full w-full rounded-lg bg-white/5 border border-white/5 hover:border-primary/40 hover:bg-primary/10 py-1.5 transition cursor-pointer"
                                    title="Click to add availability"
                                  >
                                    <p className="text-[10px] text-white/20 text-center">+ Add</p>
                                  </button>
                                );
                              })()}
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


  const allServices = workspace.catalog.flatMap((category: any) =>
    category.services.map((service: any) => ({
      ...service,
      categoryName: category.name
    }))
  );

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
