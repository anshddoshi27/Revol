"use client";

import { useMemo, useState, useEffect } from "react";
import { Palette, Plus, UserCircle2, Trash2, Edit3, ImageIcon, Camera } from "lucide-react";
import Image from "next/image";

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
  imageUrl?: string;
  description?: string;
  review?: string;
  reviewerName?: string;
}

const IMAGE_ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const IMAGE_MAX_SIZE_MB = 2;

// Predefined palette of 8 distinct colors assigned automatically in order
// Max 8 team members for v1
const CALENDAR_COLORS = [
  "#FF0000", // Red (1st)
  "#0000FF", // Blue (2nd)
  "#00FF00", // Green (3rd)
  "#800080", // Purple (4th)
  "#FFFF00", // Yellow (5th)
  "#FFA500", // Orange (6th)
  "#FFFFFF", // White (7th)
  "#A52A2A", // Brown (8th)
];

const MAX_TEAM_MEMBERS = 8;

// Automatically assign color based on team member index (0-7)
const getColorForIndex = (index: number): string => {
  if (index >= 0 && index < CALENDAR_COLORS.length) {
    return CALENDAR_COLORS[index];
  }
  // Fallback (shouldn't happen with max limit)
  return CALENDAR_COLORS[0];
};

export function TeamStep({ defaultValues, onNext, onBack }: TeamStepProps) {
  const [staff, setStaff] = useState<StaffMember[]>(() => {
    // Ensure colors are assigned correctly based on position for existing members
    return defaultValues.map((member, index) => ({
      ...member,
      color: getColorForIndex(index)
    }));
  });
  const [draft, setDraft] = useState<StaffDraft>({
    name: "",
    role: "",
    color: getColorForIndex(staff.length), // Will be auto-assigned based on index
    imageUrl: "",
    description: "",
    review: "",
    reviewerName: ""
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null);

  // Update draft color when staff list changes
  useEffect(() => {
    setDraft(prev => ({
      ...prev,
      color: getColorForIndex(staff.length)
    }));
  }, [staff.length]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    };
  }, [imageObjectUrl]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageError(null);

    if (!IMAGE_ACCEPTED_TYPES.includes(file.type)) {
      setImageError("Invalid format. Please upload PNG, JPG, or WEBP.");
      event.target.value = "";
      return;
    }

    if (file.size > IMAGE_MAX_SIZE_MB * 1024 * 1024) {
      setImageError(`File too large. Max size is ${IMAGE_MAX_SIZE_MB}MB.`);
      event.target.value = "";
      return;
    }

    // Clean up previous blob URL if it exists
    if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);

    // Create a blob URL for preview (temporary, for UI)
    const objectUrl = URL.createObjectURL(file);
    setImageObjectUrl(objectUrl);
    setImagePreview(objectUrl);

    // Convert file to data URL (base64) for saving to database
    // This is what gets saved and persists across sessions
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setDraft(prev => ({ ...prev, imageUrl: dataUrl }));
    };
    reader.onerror = (error) => {
      console.error('[TeamStep] Error reading image file:', error);
      setImageError('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    if (imageObjectUrl) {
      URL.revokeObjectURL(imageObjectUrl);
      setImageObjectUrl(null);
    }
    setImagePreview(null);
    setDraft(prev => ({ ...prev, imageUrl: undefined }));
    setImageError(null);
  };
  
  const handleFillTestData = () => {
    const testData = generateTeamData(3); // Generate 3 staff members
    setStaff(testData);
    resetDraft();
  };

  const resetDraft = () => {
    // Auto-assign next available color based on current staff count
    const nextColor = getColorForIndex(staff.length);
    setDraft({ 
      name: "", 
      role: "", 
      color: nextColor,
      imageUrl: "",
      description: "",
      review: "",
      reviewerName: ""
    });
    setEditingId(null);
    setError(null);
    setImageError(null);
    if (imageObjectUrl) {
      URL.revokeObjectURL(imageObjectUrl);
      setImageObjectUrl(null);
    }
    setImagePreview(null);
  };

  const handleAddStaff = () => {
    if (!draft.name.trim()) {
      setError("Staff name is required.");
      return;
    }

    if (editingId) {
      // When editing, keep the existing color (colors are auto-assigned by index)
      const existingMember = staff.find(m => m.id === editingId);
      setStaff((prev) =>
        prev.map((member) =>
          member.id === editingId
            ? { 
                ...member, 
                name: draft.name.trim(), 
                role: draft.role?.trim(), 
                color: existingMember?.color || getColorForIndex(prev.findIndex(m => m.id === editingId)),
                imageUrl: draft.imageUrl,
                description: draft.description?.trim(),
                review: draft.review?.trim(),
                reviewerName: draft.reviewerName?.trim()
              }
            : member
        )
      );
    } else {
      // Check max limit
      if (staff.length >= MAX_TEAM_MEMBERS) {
        setError(`Maximum ${MAX_TEAM_MEMBERS} team members allowed.`);
        return;
      }

      // Auto-assign color based on current index
      const newIndex = staff.length;
      const newMember: StaffMember = {
        id: `staff_${crypto.randomUUID()}`,
        name: draft.name.trim(),
        role: draft.role?.trim(),
        color: getColorForIndex(newIndex), // Auto-assign based on position
        active: true,
        imageUrl: draft.imageUrl,
        description: draft.description?.trim(),
        review: draft.review?.trim(),
        reviewerName: draft.reviewerName?.trim()
      };
      setStaff((prev) => {
        const updated = [...prev, newMember];
        // Update draft with next available color for next staff member
        const nextIndex = updated.length;
        setDraft(prev => ({ 
          ...prev, 
          color: getColorForIndex(nextIndex), 
          name: "", 
          role: "",
          imageUrl: "",
          description: "",
          review: "",
          reviewerName: ""
        }));
        return updated;
      });
      setEditingId(null);
      setError(null);
      if (imageObjectUrl) {
        URL.revokeObjectURL(imageObjectUrl);
        setImageObjectUrl(null);
      }
      setImagePreview(null);
    }
  };

  const handleEdit = (member: StaffMember) => {
    // Keep the existing color (auto-assigned, not editable)
    setDraft({
      id: member.id,
      name: member.name,
      role: member.role,
      color: member.color, // Keep existing color, it's auto-assigned
      imageUrl: member.imageUrl,
      description: member.description,
      review: member.review,
      reviewerName: member.reviewerName
    });
    setEditingId(member.id);
    setError(null);
    setImageError(null);
    // Set preview - use data URL if available, otherwise use imageUrl
    setImagePreview(member.imageUrl || null);
    // Clean up any existing blob URL (only if it's a blob URL, not a data URL)
    if (imageObjectUrl && imageObjectUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imageObjectUrl);
      setImageObjectUrl(null);
    }
    // If member has a data URL, we don't need a blob URL for preview
    // Data URLs can be used directly for both preview and saving
    if (member.imageUrl && !member.imageUrl.startsWith('blob:')) {
      setImageObjectUrl(null);
    }
  };

  const handleDelete = (id: string) => {
    setStaff((prev) => {
      const filtered = prev.filter((member) => member.id !== id);
      // Reassign colors based on new positions to maintain sequence
      return filtered.map((member, index) => ({
        ...member,
        color: getColorForIndex(index)
      }));
    });
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
              <div
                className="h-12 w-16 rounded-2xl border border-white/10"
                style={{ backgroundColor: draft.color }}
                aria-label={`Calendar color: ${draft.color}`}
              />
              <span className="flex items-center gap-2 text-sm text-white/70">
                <Palette className="h-4 w-4" aria-hidden="true" />
                {draft.color.toUpperCase()} (Auto-assigned)
              </span>
            </div>
            <HelperText className="mt-2">
              Colors are automatically assigned in order to keep overlapping availability clear. Maximum {MAX_TEAM_MEMBERS} team members.
            </HelperText>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium text-white/80" htmlFor="team-image">
              Image (optional)
            </label>
            <div className="space-y-3">
              {imagePreview || draft.imageUrl ? (
                <div className="relative inline-block">
                  <div className="relative h-32 w-32 overflow-hidden rounded-2xl border border-white/10">
                    {(imagePreview || draft.imageUrl)?.startsWith('blob:') || (imagePreview || draft.imageUrl)?.startsWith('data:') ? (
                      <img
                        src={imagePreview || draft.imageUrl || ''}
                        alt="Staff preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (imagePreview || draft.imageUrl) ? (
                      <Image
                        src={imagePreview || draft.imageUrl || ''}
                        alt="Staff preview"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute -right-2 -top-2 rounded-full bg-rose-500 p-1.5 text-white shadow-lg transition hover:bg-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="team-image-input"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/20 bg-white/5 p-6 transition hover:border-white/30 hover:bg-white/10"
                >
                  <Camera className="mb-2 h-8 w-8 text-white/60" />
                  <span className="text-sm font-medium text-white/80">Upload image</span>
                  <span className="mt-1 text-xs text-white/60">PNG, JPG, WEBP (max {IMAGE_MAX_SIZE_MB}MB)</span>
                </label>
              )}
              <input
                id="team-image-input"
                type="file"
                accept={IMAGE_ACCEPTED_TYPES.join(",")}
                onChange={handleImageChange}
                className="hidden"
              />
              {imageError && (
                <HelperText intent="error" className="mt-1" role="alert">
                  {imageError}
                </HelperText>
              )}
            </div>
            <HelperText className="mt-2">
              Displayed in the booking flow. Recommended: square image, 400x400px or larger.
            </HelperText>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium text-white/80" htmlFor="team-description">
              Description (optional)
            </label>
            <textarea
              id="team-description"
              placeholder="Brief description of the staff member's expertise and experience..."
              value={draft.description ?? ""}
              onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
              rows={3}
              className="w-full rounded-2xl border border-white/15 bg-black/60 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-primary focus:outline-none"
            />
            <HelperText className="mt-2">
              Shown in the booking flow to help customers choose.
            </HelperText>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium text-white/80" htmlFor="team-review">
              Review (optional)
            </label>
            <textarea
              id="team-review"
              placeholder="Customer review or testimonial..."
              value={draft.review ?? ""}
              onChange={(event) => setDraft((prev) => ({ ...prev, review: event.target.value }))}
              rows={3}
              className="w-full rounded-2xl border border-white/15 bg-black/60 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-primary focus:outline-none"
            />
            <HelperText className="mt-2">
              Customer testimonial or review to display.
            </HelperText>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium text-white/80" htmlFor="team-reviewer-name">
              Reviewer Name (optional)
            </label>
            <Input
              id="team-reviewer-name"
              placeholder="John Doe"
              value={draft.reviewerName ?? ""}
              onChange={(event) => setDraft((prev) => ({ ...prev, reviewerName: event.target.value }))}
            />
            <HelperText className="mt-2">
              Name of the person who wrote the review.
            </HelperText>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleAddStaff}
            disabled={!editingId && staff.length >= MAX_TEAM_MEMBERS}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white shadow-primary/20 transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {editingId ? "Save changes" : staff.length >= MAX_TEAM_MEMBERS ? `Maximum ${MAX_TEAM_MEMBERS} members` : "Add team member"}
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
            {staff.length} / {MAX_TEAM_MEMBERS} {staff.length === 1 ? "member" : "members"}
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
        {staff.length >= MAX_TEAM_MEMBERS && (
          <p className="mt-2 text-sm text-white/60">
            Maximum {MAX_TEAM_MEMBERS} team members reached. Colors are automatically assigned: Red, Blue, Green, Purple, Yellow, Orange, White, Brown.
          </p>
        )}
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

