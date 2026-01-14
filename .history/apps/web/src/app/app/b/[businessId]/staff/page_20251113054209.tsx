"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/ui/helper-text";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFakeBusiness } from "@/lib/fake-business";
import type { StaffMember } from "@/lib/onboarding-types";

export default function StaffPage() {
  const { workspace, setStaff, setAvailability } = useFakeBusiness();
  const [draft, setDraft] = useState<Omit<StaffMember, "id">>({
    name: "",
    role: "",
    color: "#5B64FF",
    active: true
  });
  const [error, setError] = useState<string | null>(null);

  if (!workspace) {
    return null;
  }

  const handleStaffChange = (staffId: string, updater: (member: StaffMember) => StaffMember) => {
    const updatedStaff = workspace.staff.map((member) =>
      member.id === staffId ? updater(member) : member
    );
    setStaff(updatedStaff);
  };

  const handleAddStaff = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) {
      setError("Staff name is required.");
      return;
    }
    const newStaff: StaffMember = {
      ...draft,
      id: `staff_${crypto.randomUUID()}`
    };
    const updatedStaff = [...workspace.staff, newStaff];
    setStaff(updatedStaff);
    setAvailability(
      workspace.availability.map((entry) => ({
        ...entry,
        staff: entry.staff
      }))
    );
    setDraft({
      name: "",
      role: "",
      color: "#57D0FF",
      active: true
    });
    setError(null);
  };

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.35em] text-white/40">Team</p>
        <h1 className="font-display text-4xl text-white">Staff roster</h1>
        <p className="max-w-3xl text-sm text-white/60">
          Staff accounts are scheduling-only in Phase 3. They power availability lanes, booking filters,
          and analytics. Owners remain the only authenticated users for now.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {workspace.staff.map((member) => (
          <article key={member.id} className="rounded-3xl border border-white/15 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/50">Name</p>
                <Input
                  className="mt-2"
                  value={member.name}
                  onChange={(event) =>
                    handleStaffChange(member.id, (prev) => ({ ...prev, name: event.target.value }))
                  }
                />
                <Input
                  className="mt-3"
                  placeholder="Role (optional)"
                  value={member.role ?? ""}
                  onChange={(event) =>
                    handleStaffChange(member.id, (prev) => ({ ...prev, role: event.target.value }))
                  }
                />
              </div>
              <div className="flex flex-col items-center gap-3">
                <Label className="text-xs uppercase tracking-wide text-white/50">Color</Label>
                <input
                  type="color"
                  className="h-10 w-14 cursor-pointer rounded-lg border border-white/20 bg-transparent"
                  value={member.color}
                  onChange={(event) =>
                    handleStaffChange(member.id, (prev) => ({ ...prev, color: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
              <span>
                Status:{" "}
                <strong className="text-white">
                  {member.active ? "Active" : "Inactive"}
                </strong>
              </span>
              <Button
                type="button"
                variant="ghost"
                className="text-white/70 hover:text-white"
                onClick={() =>
                  handleStaffChange(member.id, (prev) => ({ ...prev, active: !prev.active }))
                }
              >
                Toggle
              </Button>
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold text-white">Add staff member</h2>
        <p className="mt-2 text-sm text-white/60">
          New staff appear in the Availability tab automatically so you can assign services and slots.
        </p>
        <form
          onSubmit={handleAddStaff}
          className="mt-6 grid gap-4 md:grid-cols-2"
        >
          <div>
            <Label className="text-xs uppercase tracking-wide text-white/50">Name</Label>
            <Input
              className="mt-2"
              value={draft.name}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="e.g., Ava Thompson"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-white/50">Role (optional)</Label>
            <Input
              className="mt-2"
              value={draft.role ?? ""}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, role: event.target.value }))
              }
              placeholder="Stylist, Therapist, etc."
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-white/50">Color</Label>
            <input
              type="color"
              className="mt-2 h-10 w-20 cursor-pointer rounded-lg border border-white/20 bg-transparent"
              value={draft.color}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, color: event.target.value }))
              }
            />
          </div>
          <div className="flex items-end justify-end">
            <Button type="submit">Add staff</Button>
          </div>
          <div className="md:col-span-2">
            {error ? (
              <HelperText intent="error">{error}</HelperText>
            ) : (
              <HelperText>
                Staff do not log in yet. They simply exist for scheduling, analytics, and future staff
                self-service tooling.
              </HelperText>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}

