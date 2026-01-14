"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, Clock, Layers, Trash2 } from "lucide-react";

import { HelperText } from "@/components/ui/helper-text";
import { Input } from "@/components/ui/input";
import { StepActions } from "@/components/onboarding/step-actions";
import { DAY_OPTIONS } from "@/components/onboarding/constants";
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
}

type SlotDraft = {
  day: string;
  startTime: string;
  endTime: string;
};

type ServiceAvailabilityMap = Record<
  string,
  {
    service: ServiceDefinition;
    staffMap: Record<
      string,
      {
        staff: StaffMember;
        slots: AvailabilitySlot[];
        draft: SlotDraft;
      }
    >;
  }
>;

export function AvailabilityStep({
  services,
  staff,
  defaultValues,
  onNext,
  onBack
}: AvailabilityStepProps) {
  const [availability, setAvailability] = useState<ServiceAvailabilityMap>(() =>
    createInitialMap(services, staff, defaultValues)
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAvailability((prev) => syncServices(prev, services, staff));
  }, [services, staff]);

  const handleSlotDraftChange = (
    serviceId: string,
    staffId: string,
    nextDraft: Partial<SlotDraft>
  ) => {
    setAvailability((prev) => {
      const next = structuredClone(prev);
      if (!next[serviceId]?.staffMap[staffId]) return prev;
      next[serviceId].staffMap[staffId].draft = {
        ...next[serviceId].staffMap[staffId].draft,
        ...nextDraft
      };
      return next;
    });
  };

  const handleAddSlot = (serviceId: string, staffId: string) => {
    setAvailability((prev) => {
      const next = structuredClone(prev);
      const entry = next[serviceId]?.staffMap[staffId];
      if (!entry) return prev;

      const { day, startTime, endTime } = entry.draft;
      if (!day || !startTime || !endTime) {
        setError("Select a day, start time, and end time.");
        return prev;
      }
      if (endTime <= startTime) {
        setError("End time must be after start time.");
        return prev;
      }

      setError(null);
      const slot: AvailabilitySlot = {
        id: `slot_${crypto.randomUUID()}`,
        day: day as AvailabilitySlot["day"],
        startTime,
        endTime
      };
      entry.slots.push(slot);
      entry.draft = { day: "", startTime: "", endTime: "" };
      return next;
    });
  };

  const handleRemoveSlot = (serviceId: string, staffId: string, slotId: string) => {
    setAvailability((prev) => {
      const next = structuredClone(prev);
      const entry = next[serviceId]?.staffMap[staffId];
      if (!entry) return prev;
      entry.slots = entry.slots.filter((slot) => slot.id !== slotId);
      return next;
    });
  };

  const handleContinue = () => {
    const result = mapToArray(availability);

    const servicesNeedingAvailability = result.filter(
      (service) =>
        service.staff.length > 0 &&
        service.staff.every((staffEntry) => staffEntry.slots.length === 0)
    );

    if (servicesNeedingAvailability.length) {
      setError(
        `Add at least one slot for ${
          servicesNeedingAvailability[0].serviceId
        }. Each service with staff needs availability to appear in booking.`
      );
      return;
    }

    onNext(result);
  };

  const previewData = useMemo(() => buildPreviewData(availability), [availability]);

  return (
    <div className="space-y-8" aria-labelledby="availability-step-heading">
      <header className="space-y-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary/90">
          <CalendarCheck2 className="h-4 w-4" aria-hidden="true" />
          Step 7 · Availability
        </span>
        <h2 id="availability-step-heading" className="font-display text-3xl text-white">
          Map availability service by service
        </h2>
        <p className="max-w-3xl text-base text-white/70">
          Customers will pick a service first, then see staff-specific slots. Overlapping
          schedules are supported—each staff member keeps their color so the calendar stays
          legible.
        </p>
      </header>

      <div className="space-y-6">
        {Object.values(availability).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-6 py-10 text-center text-sm text-white/60">
            Add services first to configure availability.
          </div>
        ) : (
          Object.values(availability).map((serviceEntry) => (
            <div
              key={serviceEntry.service.id}
              className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{serviceEntry.service.name}</h3>
                  <p className="text-xs text-white/60">
                    {serviceEntry.service.durationMinutes} min · $
                    {(serviceEntry.service.priceCents / 100).toFixed(2)}
                  </p>
                </div>
                <p className="text-xs text-white/60">
                  {serviceEntry.service.staffIds.length
                    ? `${serviceEntry.service.staffIds.length} staff assigned`
                    : "Assign staff in Services step to add availability."}
                </p>
              </div>

              <div className="space-y-4">
                {Object.values(serviceEntry.staffMap).length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-6 text-sm text-white/50">
                    No staff assigned yet. Head back to Services & Categories to link staff.
                  </div>
                ) : (
                  Object.values(serviceEntry.staffMap).map((staffEntry) => (
                    <div key={staffEntry.staff.id} className="rounded-2xl border border-white/10 bg-white/10 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="h-3 w-8 rounded-full"
                            style={{ backgroundColor: staffEntry.staff.color }}
                          />
                          <div>
                            <h4 className="text-sm font-semibold text-white">
                              {staffEntry.staff.name}
                            </h4>
                            <p className="text-xs text-white/50">
                              {staffEntry.slots.length}{" "}
                              {staffEntry.slots.length === 1 ? "slot" : "slots"} configured
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/60">
                            Day
                          </label>
                          <div className="relative">
                            <select
                              value={staffEntry.draft.day}
                              onChange={(event) =>
                                handleSlotDraftChange(serviceEntry.service.id, staffEntry.staff.id, {
                                  day: event.target.value
                                })
                              }
                              className="w-full appearance-none rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050F2C]"
                            >
                              <option value="">Select a day</option>
                              {DAY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-white/40">
                              ▼
                            </span>
                          </div>
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/60">
                            Start time
                          </label>
                          <Input
                            type="time"
                            value={staffEntry.draft.startTime}
                            onChange={(event) =>
                              handleSlotDraftChange(serviceEntry.service.id, staffEntry.staff.id, {
                                startTime: event.target.value
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/60">
                            End time
                          </label>
                          <Input
                            type="time"
                            value={staffEntry.draft.endTime}
                            onChange={(event) =>
                              handleSlotDraftChange(serviceEntry.service.id, staffEntry.staff.id, {
                                endTime: event.target.value
                              })
                            }
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddSlot(serviceEntry.service.id, staffEntry.staff.id)}
                        className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                      >
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        Add slot
                      </button>

                      {staffEntry.slots.length > 0 ? (
                        <ul className="mt-4 grid gap-2 text-sm text-white/80 md:grid-cols-2">
                          {staffEntry.slots.map((slot) => (
                            <li
                              key={slot.id}
                              className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/5 px-4 py-2"
                            >
                              <span className="flex items-center gap-2">
                                <span className="text-xs uppercase tracking-wide text-white/50">
                                  {slot.day.slice(0, 3)}
                                </span>
                                <span>
                                  {slot.startTime} - {slot.endTime}
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveSlot(serviceEntry.service.id, staffEntry.staff.id, slot.id)
                                }
                                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-rose-200/80 transition hover:bg-rose-500/20 hover:text-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <HelperText intent="warning" className="mt-3">
                          Add at least one slot so {staffEntry.staff.name} appears for this service.
                        </HelperText>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white/60">
          Availability preview
        </h3>
        <p className="mt-1 text-sm text-white/60">
          Slots stack by staff color so overlaps are easy to scan. Customers see local time with
          buffers respected.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-7">
          {DAY_OPTIONS.map((day) => {
            const daySlots = previewData[day.value] ?? [];
            return (
              <div
                key={day.value}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-white/60"
              >
                <p className="mb-2 font-semibold text-white">{day.label.slice(0, 3)}</p>
                <div className="space-y-2">
                  {daySlots.length ? (
                    daySlots.map((slot) => (
                      <div
                        key={slot.id}
                        className="rounded-xl px-3 py-2 text-white shadow"
                        style={{ backgroundColor: `${slot.color}22`, borderLeft: `3px solid ${slot.color}` }}
                      >
                        <p className="font-medium">{slot.staffName}</p>
                        <p>
                          {slot.serviceName} · {slot.startTime} - {slot.endTime}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-white/30">No slots</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error ? (
        <HelperText intent="error" role="alert">
          {error}
        </HelperText>
      ) : null}

      <StepActions onBack={onBack} onNext={handleContinue} />
    </div>
  );
}

function createInitialMap(
  categories: ServiceCategory[],
  staff: StaffMember[],
  defaultValues: ServiceAvailability[]
): ServiceAvailabilityMap {
  const map: ServiceAvailabilityMap = {};

  categories.forEach((category) => {
    category.services.forEach((service) => {
      map[service.id] = {
        service,
        staffMap: {}
      };
      service.staffIds.forEach((staffId) => {
        const staffMember = staff.find((member) => member.id === staffId);
        if (!staffMember) return;
        map[service.id].staffMap[staffId] = {
          staff: staffMember,
          slots: [],
          draft: { day: "", startTime: "", endTime: "" }
        };
      });
    });
  });

  defaultValues.forEach((entry) => {
    const serviceEntry = map[entry.serviceId];
    if (!serviceEntry) return;
    entry.staff.forEach((staffEntry) => {
      if (!serviceEntry.staffMap[staffEntry.staffId]) {
        const staffMember = staff.find((member) => member.id === staffEntry.staffId);
        if (!staffMember) return;
        serviceEntry.staffMap[staffEntry.staffId] = {
          staff: staffMember,
          slots: [],
          draft: { day: "", startTime: "", endTime: "" }
        };
      }
      serviceEntry.staffMap[staffEntry.staffId].slots = staffEntry.slots;
    });
  });

  return map;
}

function syncServices(
  current: ServiceAvailabilityMap,
  categories: ServiceCategory[],
  staff: StaffMember[]
): ServiceAvailabilityMap {
  const map = structuredClone(current);

  const serviceIds = new Set<string>();
  categories.forEach((category) => {
    category.services.forEach((service) => {
      serviceIds.add(service.id);
      if (!map[service.id]) {
        map[service.id] = {
          service,
          staffMap: {}
        };
      } else {
        map[service.id].service = service;
      }

      service.staffIds.forEach((staffId) => {
        if (!map[service.id].staffMap[staffId]) {
          const staffMember = staff.find((member) => member.id === staffId);
          if (!staffMember) return;
          map[service.id].staffMap[staffId] = {
            staff: staffMember,
            slots: [],
            draft: { day: "", startTime: "", endTime: "" }
          };
        } else {
          const staffMember = staff.find((member) => member.id === staffId);
          if (staffMember) {
            map[service.id].staffMap[staffId].staff = staffMember;
          }
        }
      });

      Object.keys(map[service.id].staffMap).forEach((staffId) => {
        if (!service.staffIds.includes(staffId)) {
          delete map[service.id].staffMap[staffId];
        }
      });
    });
  });

  Object.keys(map).forEach((serviceId) => {
    if (!serviceIds.has(serviceId)) {
      delete map[serviceId];
    }
  });

  return map;
}

function mapToArray(map: ServiceAvailabilityMap): ServiceAvailability[] {
  return Object.values(map).map((entry) => ({
    serviceId: entry.service.id,
    staff: Object.values(entry.staffMap).map((staffEntry) => ({
      staffId: staffEntry.staff.id,
      slots: staffEntry.slots
    }))
  }));
}

function buildPreviewData(map: ServiceAvailabilityMap) {
  const preview: Record<
    string,
    Array<{
      id: string;
      serviceName: string;
      staffName: string;
      startTime: string;
      endTime: string;
      color: string;
    }>
  > = {};

  Object.values(map).forEach((serviceEntry) => {
    Object.values(serviceEntry.staffMap).forEach((staffEntry) => {
      staffEntry.slots.forEach((slot) => {
        if (!preview[slot.day]) preview[slot.day] = [];
        preview[slot.day].push({
          id: slot.id,
          serviceName: serviceEntry.service.name,
          staffName: staffEntry.staff.name,
          startTime: slot.startTime,
          endTime: slot.endTime,
          color: staffEntry.staff.color
        });
      });
    });
  });

  Object.values(preview).forEach((slots) => {
    slots.sort((a, b) => a.startTime.localeCompare(b.startTime));
  });

  return preview;
}



