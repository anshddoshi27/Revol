"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/ui/helper-text";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFakeBusiness } from "@/lib/fake-business";
import type {
  AvailabilitySlot,
  ServiceAvailability,
  ServiceCategory,
  StaffMember
} from "@/lib/onboarding-types";

const DAYS: Array<{ value: AvailabilitySlot["day"]; label: string }> = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" }
];

export default function CalendarPage() {
  const {
    workspace,
    setAvailability,
    copyAvailabilityTemplate,
    pasteAvailabilityTemplate,
    clearAvailabilityClipboard
  } = useFakeBusiness();

  const services = useMemo(() => flattenServices(workspace.catalog), [workspace.catalog]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(services[0]?.id ?? "");

  const staffById = useMemo(() => {
    const map = new Map<string, StaffMember>();
    workspace.staff.forEach((member) => map.set(member.id, member));
    return map;
  }, [workspace.staff]);

  const serviceAvailability = useMemo(() => {
    if (!selectedServiceId) return undefined;
    const existing = workspace.availability.find(
      (entry) => entry.serviceId === selectedServiceId
    );
    if (existing) {
      return existing;
    }
    const service = services.find((svc) => svc.id === selectedServiceId);
    if (!service) return undefined;
    return {
      serviceId: selectedServiceId,
      staff: service.staffIds.map((staffId) => ({
        staffId,
        slots: []
      }))
    };
  }, [workspace.availability, selectedServiceId, services]);

  if (!selectedServiceId || !serviceAvailability) {
    return (
      <div className="space-y-6">
        <HeaderBlock />
        <div className="rounded-3xl border border-white/10 bg-black/80 p-6 text-center text-white/60">
          Configure services in the Catalog tab to begin defining availability.
        </div>
      </div>
    );
  }

  const selectedService = services.find((svc) => svc.id === selectedServiceId);

  const handleAvailabilityChange = (updater: (entry: ServiceAvailability) => ServiceAvailability) => {
    const updatedEntry = updater(serviceAvailability);
    const nextAvailability = workspace.availability.some(
      (entry) => entry.serviceId === updatedEntry.serviceId
    )
      ? workspace.availability.map((entry) =>
          entry.serviceId === updatedEntry.serviceId ? updatedEntry : entry
        )
      : [...workspace.availability, updatedEntry];
    setAvailability(nextAvailability);
  };

  const availabilityClipboard = workspace.availabilityClipboard;

  return (
    <div className="space-y-10">
      <HeaderBlock />

      <section className="rounded-3xl border border-white/10 bg-black/80 p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-white/40">Service selection</p>
            <h2 className="mt-2 text-lg font-semibold text-white">
              {selectedService?.name ?? "Choose a service"}
            </h2>
            <p className="mt-1 text-sm text-white/60">
              Each service inherits availability from onboarding. Adjust staff time blocks here and
              preview in the Calendar tab. Copy &amp; paste speeds up multi-service templates.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
              value={selectedServiceId}
              onChange={(event) => setSelectedServiceId(event.target.value)}
            >
              {services.map((service) => (
                <option key={service.id} value={service.id} className="bg-[#050F2C] text-white">
                  {service.name}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => copyAvailabilityTemplate(`template_${selectedServiceId}`)}
              >
                Copy template
              </Button>
              <Button
                type="button"
                onClick={() => pasteAvailabilityTemplate(selectedServiceId)}
                disabled={!availabilityClipboard}
              >
                Paste template
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={clearAvailabilityClipboard}
                disabled={!availabilityClipboard}
              >
                Clear clipboard
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4 text-xs md:text-sm">
        {serviceAvailability.staff.map((assignment) => {
          const staff = staffById.get(assignment.staffId);
          if (!staff) return null;
          return (
            <StaffAvailabilityCard
              key={assignment.staffId}
              staff={staff}
              slots={assignment.slots}
              onAddSlot={(slot) =>
                handleAvailabilityChange((entry) => ({
                  ...entry,
                  staff: entry.staff.map((existing) =>
                    existing.staffId === assignment.staffId
                      ? { ...existing, slots: [...existing.slots, slot] }
                      : existing
                  )
                }))
              }
              onRemoveSlot={(slotId) =>
                handleAvailabilityChange((entry) => ({
                  ...entry,
                  staff: entry.staff.map((existing) =>
                    existing.staffId === assignment.staffId
                      ? { ...existing, slots: existing.slots.filter((slot) => slot.id !== slotId) }
                      : existing
                  )
                }))
              }
            />
          );
        })}
      </section>
    </div>
  );
}

function HeaderBlock() {
  return (
    <header className="space-y-4">
      <p className="text-xs uppercase tracking-[0.35em] text-white/40">Scheduling</p>
      <h1 className="font-display text-4xl text-white">Calendar controls</h1>
      <p className="max-w-3xl text-sm text-white/60">
        Availability powers both the public booking grid and the admin calendar lanes. Set per-staff
        weekly templates, copy the patterns you love, and keep every service in lockstep. DST-safe,
        timezone aware, and ready for the booking engine once the backend snaps on.
      </p>
    </header>
  );
}

function StaffAvailabilityCard({
  staff,
  slots,
  onAddSlot,
  onRemoveSlot
}: {
  staff: StaffMember;
  slots: AvailabilitySlot[];
  onAddSlot: (slot: AvailabilitySlot) => void;
  onRemoveSlot: (slotId: string) => void;
}) {
  const [newSlot, setNewSlot] = useState<AvailabilitySlot>({
    id: "",
    day: "monday",
    startTime: "09:00",
    endTime: "17:00"
  });
  const [error, setError] = useState<string | null>(null);

  const sortedSlots = [...slots].sort(sortSlots);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (newSlot.startTime >= newSlot.endTime) {
      setError("Start time must be before end time.");
      return;
    }
    onAddSlot({
      ...newSlot,
      id: `slot_${crypto.randomUUID()}`
    });
    setNewSlot((prev) => ({ ...prev, startTime: "09:00", endTime: "17:00" }));
    setError(null);
  };

  return (
    <article className="rounded-3xl border border-white/10 bg-black/80 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-white/50 md:text-xs">
            Staff member
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: staff.color }}
              aria-hidden="true"
            />
            <h3 className="text-base font-semibold text-white md:text-lg">{staff.name}</h3>
          </div>
          <p className="text-[11px] text-white/50 md:text-xs">
            {staff.role ?? "Scheduling only"}
          </p>
        </div>
        <div className="rounded-full border border-white/15 bg-black/60 px-3 py-1 text-[11px] text-white/60">
          {slots.length} slot{slots.length === 1 ? "" : "s"} configured
        </div>
      </header>

      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3 md:text-sm">
        {sortedSlots.length ? (
          sortedSlots.map((slot) => (
            <div
              key={slot.id}
              className="rounded-2xl border border-white/10 bg-black/70 px-3 py-3 text-white/70"
            >
              <p className="text-[10px] uppercase tracking-wide text-white/40 md:text-xs">
                {DAYS.find((day) => day.value === slot.day)?.label ?? slot.day}
              </p>
              <p className="mt-2 text-sm font-semibold text-white md:text-base">
                {slot.startTime} – {slot.endTime}
              </p>
              <Button
                type="button"
                variant="ghost"
                className="mt-3 w-full justify-center text-white/60 hover:text-white"
                onClick={() => onRemoveSlot(slot.id)}
              >
                Remove
              </Button>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-white/15 bg-black/60 px-4 py-6 text-center text-white/50">
            No slots yet — add a day/time block below.
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-black/70 p-4 sm:grid-cols-4"
      >
        <div className="sm:col-span-1">
          <Label className="text-[10px] uppercase tracking-wide text-white/50 md:text-xs">
            Day
          </Label>
          <select
            className="mt-2 w-full rounded-2xl border border-white/15 bg-[#050F2C]/60 px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
            value={newSlot.day}
            onChange={(event) =>
              setNewSlot((slot) => ({ ...slot, day: event.target.value as AvailabilitySlot["day"] }))
            }
          >
            {DAYS.map((day) => (
              <option key={day.value} value={day.value} className="bg-[#050F2C] text-white">
                {day.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-white/50 md:text-xs">
            Start
          </Label>
          <Input
            type="time"
            className="mt-2"
            value={newSlot.startTime}
            onChange={(event) =>
              setNewSlot((slot) => ({ ...slot, startTime: event.target.value }))
            }
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-white/50 md:text-xs">
            End
          </Label>
          <Input
            type="time"
            className="mt-2"
            value={newSlot.endTime}
            onChange={(event) =>
              setNewSlot((slot) => ({ ...slot, endTime: event.target.value }))
            }
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full">
            Add slot
          </Button>
        </div>
        {error ? (
          <div className="sm:col-span-4">
            <HelperText intent="error">{error}</HelperText>
          </div>
        ) : null}
      </form>
    </article>
  );
}

function flattenServices(catalog: ServiceCategory[]) {
  return catalog.flatMap((category) =>
    category.services.map((service) => ({
      ...service,
      categoryColor: category.color,
      categoryName: category.name
    }))
  );
}

function sortSlots(a: AvailabilitySlot, b: AvailabilitySlot) {
  const dayOrder = DAYS.findIndex((day) => day.value === a.day) - DAYS.findIndex((day) => day.value === b.day);
  if (dayOrder !== 0) return dayOrder;
  return a.startTime.localeCompare(b.startTime);
}

