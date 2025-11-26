"use client";

import { useMemo, useState } from "react";
import { Palette, Plus, UserCircle2, Trash2, Edit3 } from "lucide-react";

import { HelperText } from "@/components/ui/helper-text";
import { Input } from "@/components/ui/input";
import { StepActions } from "@/components/onboarding/step-actions";
import { TestDataButton } from "@/components/onboarding/test-data-button";
import { generateTeamData } from "@/lib/test-data-generator";
import type { StaffMember } from "@/lib/onboarding-context";

interface TeamStepProps {
  defaultValues: StaffMember[];
  onNext: (values: StaffMember[]) => Promise<void> | void;
  onBack: () => void;
}

interface StaffDraft {
  id?: string;
  name: string;
  role?: string;
  color: string;
}

const generateColor = () => {
  const palette = ["#5B64FF", "#57D0FF", "#FF9A8B", "#FFD166", "#8AFFCF", "#C4A5FF"];
  return palette[Math.floor(Math.random() * palette.length)];
};

export function TeamStep({ defaultValues, onNext, onBack }: TeamStepProps) {
  const [staff, setStaff] = useState<StaffMember[]>(defaultValues);
  const [draft, setDraft] = useState<StaffDraft>({
    name: "",
    role: "",
    color: generateColor()
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const handleFillTestData = () => {
    const testData = generateTeamData(3); // Generate 3 staff members
    setStaff(testData);
    resetDraft();
  };

  const resetDraft = () => {
    setDraft({ name: "", role: "", color: generateColor() });
    setEditingId(null);
    setError(null);
  };

  const handleAddStaff = () => {
    if (!draft.name.trim()) {
      setError("Staff name is required.");
      return;
    }

    if (editingId) {
      setStaff((prev) =>
        prev.map((member) =>
          member.id === editingId
            ? { ...member, name: draft.name.trim(), role: draft.role?.trim(), color: draft.color }
            : member
        )
      );
    } else {
      const newMember: StaffMember = {
        id: `staff_${crypto.randomUUID()}`,
        name: draft.name.trim(),
        role: draft.role?.trim(),
        color: draft.color,
        active: true
      };
      setStaff((prev) => [...prev, newMember]);
    }

    resetDraft();
  };

  const handleEdit = (member: StaffMember) => {
    setDraft({
      id: member.id,
      name: member.name,
      role: member.role,
      color: member.color
    });
    setEditingId(member.id);
    setError(null);
  };

  const handleDelete = (id: string) => {
    setStaff((prev) => prev.filter((member) => member.id !== id));
    if (editingId === id) {
      resetDraft();
    }
  };

  const handleContinue = () => {
    onNext(staff);
  };

  const availabilityNote = useMemo(() => {
    if (staff.length === 0) return "Add at least one team member to map availability later.";
    if (staff.length === 1)
      return `${staff[0].name} will appear in the calendar. Add more staff now or anytime in admin.`;
    return "Each staff member gets their own color in availability so overlaps stay clear.";
  }, [staff]);

  return (
    <div className="space-y-8" aria-labelledby="team-step-heading">
      <header className="space-y-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary/90">
          <UserCircle2 className="h-4 w-4" aria-hidden="true" />
          Step 4 · Team (scheduling only)
        </span>
        <h2 id="team-step-heading" className="font-display text-3xl text-white">
          Who can perform services?
        </h2>
        <p className="max-w-xl text-base text-white/70">
          Staff profiles power availability and filters. They don’t get logins—owners stay in
          control. You can edit or add more later.
        </p>
      </header>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h3 className="text-lg font-semibold text-white">
          {editingId ? "Update team member" : "Add a team member"}
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium text-white/80" htmlFor="team-name">
              Name
            </label>
            <Input
              id="team-name"
              placeholder="Ava Thompson"
              value={draft.name}
              onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
              aria-describedby={error ? "team-name-error" : "team-name-helper"}
            />
            <HelperText id="team-name-helper" className="mt-2">
              Displayed in the booking flow and admin calendar.
            </HelperText>
            {error ? (
              <HelperText id="team-name-error" intent="error" className="mt-1" role="alert">
                {error}
              </HelperText>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/80" htmlFor="team-role">
              Role (optional)
            </label>
            <Input
              id="team-role"
              placeholder="Lead stylist"
              value={draft.role ?? ""}
              onChange={(event) => setDraft((prev) => ({ ...prev, role: event.target.value }))}
            />
            <HelperText className="mt-2">
              For internal labels and upcoming permissions.
            </HelperText>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/80" htmlFor="team-color">
              Calendar color
            </label>
            <div className="flex items-center gap-3">
              <input
                id="team-color"
                type="color"
                value={draft.color}
                onChange={(event) => setDraft((prev) => ({ ...prev, color: event.target.value }))}
                className="h-12 w-16 cursor-pointer rounded-2xl border border-white/10 bg-transparent"
              />
              <span className="flex items-center gap-2 text-sm text-white/70">
                <Palette className="h-4 w-4" aria-hidden="true" />
                {draft.color.toUpperCase()}
              </span>
            </div>
            <HelperText className="mt-2">
              Assign distinct colors to keep overlapping availability clear.
            </HelperText>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleAddStaff}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white shadow-primary/20 transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {editingId ? "Save changes" : "Add team member"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={resetDraft}
              className="text-sm font-medium text-white/70 transition hover:text-white"
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Team members</h3>
          <span className="text-sm text-white/60">
            {staff.length} {staff.length === 1 ? "member" : "members"}
          </span>
        </div>

        {staff.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-6 py-10 text-center text-sm text-white/60">
            Add your first team member above. Staff are required to map availability and let
            customers pick who they want to see.
          </div>
        ) : (
          <ul className="space-y-3">
            {staff.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <div className="flex items-center gap-4">
                  <span
                    className="h-10 w-10 rounded-full border border-white/20"
                    style={{ backgroundColor: member.color }}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-semibold text-white">{member.name}</p>
                    <p className="text-xs text-white/60">{member.role || "No role specified"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(member)}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                  >
                    <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(member.id)}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-rose-200/80 transition hover:bg-rose-500/20 hover:text-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
        <p className="text-sm text-white/70">{availabilityNote}</p>
      </div>

      <div className="mt-8 flex items-center justify-end gap-3">
        <TestDataButton onClick={handleFillTestData} />
      </div>

      <StepActions
        onBack={onBack}
        onNext={handleContinue}
        isNextDisabled={staff.length === 0}
      />
    </div>
  );
}

