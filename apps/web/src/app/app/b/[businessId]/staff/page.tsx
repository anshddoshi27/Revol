"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/ui/helper-text";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFakeBusiness } from "@/lib/fake-business";
import { createClientClient } from "@/lib/supabase-client";
import type { StaffMember } from "@/lib/onboarding-types";

export default function StaffPage() {
  const params = useParams();
  const router = useRouter();
  const businessId = params.businessId as string;
  const { workspace, setStaff, setAvailability } = useFakeBusiness();
  const [draft, setDraft] = useState<Omit<StaffMember, "id">>({
    name: "",
    role: "",
    color: "#5B64FF",
    active: true,
    imageUrl: undefined,
    description: undefined,
    review: undefined,
    reviewerName: undefined
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savingStaffId, setSavingStaffId] = useState<string | null>(null);
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});
  const [localStaffChanges, setLocalStaffChanges] = useState<Record<string, StaffMember>>({});

  if (!workspace) {
    return null;
  }

  // Load staff from database on mount
  useEffect(() => {
    const loadStaffFromDatabase = async () => {
      try {
        const supabase = createClientClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          console.error('[StaffPage] No session found');
          return;
        }

        const response = await fetch('/api/business/onboarding/step-4-team', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          if (data.staff && Array.isArray(data.staff)) {
            console.log('[StaffPage] Loaded staff from database:', data.staff.length);
            setStaff(data.staff);
            // Set image previews for existing staff (both data URLs and regular URLs)
            const previews: Record<string, string> = {};
            data.staff.forEach((member: StaffMember) => {
              if (member.imageUrl) {
                previews[member.id] = member.imageUrl;
              }
            });
            setImagePreviews(previews);
            // Clear any local changes since we just loaded fresh data
            setLocalStaffChanges({});
          }
        }
      } catch (error) {
        console.error('[StaffPage] Error loading staff:', error);
      }
    };

    loadStaffFromDatabase();
  }, [businessId, setStaff]);

  const handleStaffChange = useCallback((staffId: string, updater: (member: StaffMember) => StaffMember) => {
    const updatedMember = updater(workspace.staff.find(m => m.id === staffId) || workspace.staff[0]);
    
    // Update local state immediately for UI responsiveness
    const updatedStaff = workspace.staff.map((member) =>
      member.id === staffId ? updatedMember : member
    );
    setStaff(updatedStaff);
    
    // Track that this staff member has unsaved changes
    setLocalStaffChanges((prev) => ({
      ...prev,
      [staffId]: updatedMember
    }));
  }, [workspace.staff, setStaff]);

  const saveStaffToDatabase = async (staffToSave: StaffMember[]) => {
    try {
      setIsSaving(true);
      const supabase = createClientClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        console.error('[StaffPage] No session found for save');
        setError('Not authenticated');
        return;
      }

      const response = await fetch('/api/business/onboarding/step-4-team', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ staff: staffToSave }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save staff');
      }

      const data = await response.json();
      console.log('[StaffPage] Staff saved to database successfully');
      
      // Update context with real database IDs if returned
      if (data.staff && Array.isArray(data.staff) && data.staff.length > 0) {
        console.log('[StaffPage] Updating staff with saved data:', {
          count: data.staff.length,
          staffWithImages: data.staff.filter((s: StaffMember) => s.imageUrl).map((s: StaffMember) => ({ id: s.id, name: s.name, hasImage: !!s.imageUrl }))
        });
        setStaff(data.staff);
        // Update image previews from saved data to ensure they persist
        const newPreviews: Record<string, string> = {};
        data.staff.forEach((member: StaffMember) => {
          if (member.imageUrl) {
            newPreviews[member.id] = member.imageUrl;
            console.log('[StaffPage] Restored image preview for staff:', {
              staffId: member.id,
              name: member.name,
              hasImageUrl: !!member.imageUrl,
              imageUrlType: member.imageUrl?.substring(0, 20) + '...'
            });
          }
        });
        setImagePreviews((prev) => ({ ...prev, ...newPreviews }));
        // Clear local changes for saved staff
        setLocalStaffChanges({});
      } else {
        console.warn('[StaffPage] API did not return staff array after save');
      }
      
      setError(null);
    } catch (error) {
      console.error('[StaffPage] Error saving staff:', error);
      setError(error instanceof Error ? error.message : 'Failed to save staff');
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveStaff = async (staffId: string) => {
    try {
      setSavingStaffId(staffId);
      const currentStaff = workspace.staff;
      await saveStaffToDatabase(currentStaff);
      
      // Reload staff from database to ensure we have the latest data
      const supabase = createClientClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.access_token) {
        const response = await fetch('/api/business/onboarding/step-4-team', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          if (data.staff && Array.isArray(data.staff)) {
            console.log('[StaffPage] Reloaded staff after save:', data.staff.length);
            setStaff(data.staff);
            // Update image previews
            const previews: Record<string, string> = {};
            data.staff.forEach((member: StaffMember) => {
              if (member.imageUrl) {
                previews[member.id] = member.imageUrl;
              }
            });
            setImagePreviews(previews);
            setLocalStaffChanges({});
          }
        }
      }
    } catch (error) {
      // Error already handled in saveStaffToDatabase
    } finally {
      setSavingStaffId(null);
    }
  };

  const handleRemoveStaff = async (staffId: string) => {
    if (!confirm(`Are you sure you want to remove ${workspace.staff.find(s => s.id === staffId)?.name || 'this staff member'}?`)) {
      return;
    }

    try {
      setIsSaving(true);
      const updatedStaff = workspace.staff.filter(member => member.id !== staffId);
      setStaff(updatedStaff);
      
      // Save to database
      await saveStaffToDatabase(updatedStaff);
      
      // Clear local changes for removed staff
      setLocalStaffChanges((prev) => {
        const newChanges = { ...prev };
        delete newChanges[staffId];
        return newChanges;
      });
      
      // Clear image preview
      setImagePreviews((prev) => {
        const newPreviews = { ...prev };
        delete newPreviews[staffId];
        return newPreviews;
      });
    } catch (error) {
      console.error('[StaffPage] Error removing staff:', error);
      setError(error instanceof Error ? error.message : 'Failed to remove staff');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageChange = (staffId: string, file: File | null) => {
    if (!file) {
      // Remove image
      handleStaffChange(staffId, (prev) => {
        const updated = { ...prev, imageUrl: undefined };
        const newPreviews = { ...imagePreviews };
        delete newPreviews[staffId];
        setImagePreviews(newPreviews);
        return updated;
      });
      return;
    }

    // Create preview and save as data URL
    const reader = new FileReader();
    reader.onloadend = () => {
      const imageUrl = reader.result as string;
      console.log('[StaffPage] Image loaded, setting preview and updating staff:', {
        staffId,
        imageUrlLength: imageUrl.length,
        imageUrlPreview: imageUrl.substring(0, 50) + '...'
      });
      // Set preview immediately for UI feedback
      setImagePreviews((prev) => ({ ...prev, [staffId]: imageUrl }));
      // Update staff member with image URL
      handleStaffChange(staffId, (prev) => {
        const updated = { ...prev, imageUrl };
        console.log('[StaffPage] Updated staff member with imageUrl:', {
          staffId,
          hasImageUrl: !!updated.imageUrl,
          imageUrlLength: updated.imageUrl?.length || 0
        });
        return updated;
      });
    };
    reader.onerror = (error) => {
      console.error('[StaffPage] Error reading image file:', error);
      setError('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleAddStaff = async (event: React.FormEvent) => {
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
    
    // Save to database
    await saveStaffToDatabase(updatedStaff);
    
    setDraft({
      name: "",
      role: "",
      color: "#57D0FF",
      active: true,
      imageUrl: undefined,
      description: undefined,
      review: undefined,
      reviewerName: undefined
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
          <article key={member.id} className="rounded-3xl border border-white/15 bg-white/5 p-6 space-y-4">
            {/* Image Upload */}
            <div>
              <Label className="text-xs uppercase tracking-wide text-white/50 mb-2 block">Image</Label>
              <div className="flex items-center gap-3">
                {(imagePreviews[member.id] || member.imageUrl) && (
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-white/20">
                    {(imagePreviews[member.id] || member.imageUrl)?.startsWith('blob:') || 
                     (imagePreviews[member.id] || member.imageUrl)?.startsWith('data:') ? (
                      <img
                        src={imagePreviews[member.id] || member.imageUrl}
                        alt={member.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          console.error('Failed to load staff image:', imagePreviews[member.id] || member.imageUrl);
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <Image
                        src={imagePreviews[member.id] || member.imageUrl || ''}
                        alt={member.name}
                        fill
                        className="object-cover"
                        unoptimized
                        onError={() => console.error('Failed to load staff image:', imagePreviews[member.id] || member.imageUrl)}
                      />
                    )}
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="text-sm text-white/70 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-white hover:file:bg-primary/30"
                  onChange={(e) => handleImageChange(member.id, e.target.files?.[0] || null)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex-1">
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
              <div className="flex flex-col items-center gap-3 ml-4">
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

            {/* Description */}
            <div>
              <Label className="text-xs uppercase tracking-wide text-white/50 mb-2 block">Description</Label>
              <textarea
                className="w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-primary focus:outline-none resize-none"
                rows={3}
                placeholder="Brief description of the staff member..."
                value={member.description ?? ""}
                onChange={(event) =>
                  handleStaffChange(member.id, (prev) => ({ ...prev, description: event.target.value || undefined }))
                }
              />
            </div>

            {/* Review */}
            <div>
              <Label className="text-xs uppercase tracking-wide text-white/50 mb-2 block">Review</Label>
              <textarea
                className="w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-primary focus:outline-none resize-none"
                rows={3}
                placeholder="Customer review or testimonial..."
                value={member.review ?? ""}
                onChange={(event) =>
                  handleStaffChange(member.id, (prev) => ({ ...prev, review: event.target.value || undefined }))
                }
              />
            </div>

            {/* Reviewer Name */}
            <div>
              <Label className="text-xs uppercase tracking-wide text-white/50 mb-2 block">Reviewer Name</Label>
              <Input
                placeholder="Name of reviewer (optional)"
                value={member.reviewerName ?? ""}
                onChange={(event) =>
                  handleStaffChange(member.id, (prev) => ({ ...prev, reviewerName: event.target.value || undefined }))
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
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
            
            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleRemoveStaff(member.id)}
                disabled={isSaving || savingStaffId === member.id}
                className="text-red-400 border-red-400/30 hover:bg-red-400/10 hover:border-red-400/50"
              >
                Remove
              </Button>
              <Button
                type="button"
                onClick={() => handleSaveStaff(member.id)}
                disabled={isSaving || savingStaffId === member.id || !localStaffChanges[member.id]}
                className="flex-1"
              >
                {savingStaffId === member.id ? "Saving..." : "Save Changes"}
              </Button>
            </div>
            
            {localStaffChanges[member.id] && savingStaffId !== member.id && (
              <HelperText className="text-yellow-400/80 text-xs">You have unsaved changes</HelperText>
            )}
            {savingStaffId === member.id && (
              <HelperText className="text-primary/80 text-xs">Saving...</HelperText>
            )}
            {error && savingStaffId === member.id && (
              <HelperText intent="error" className="text-xs">{error}</HelperText>
            )}
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
          <div>
            <Label className="text-xs uppercase tracking-wide text-white/50">Image</Label>
            <input
              type="file"
              accept="image/*"
              className="mt-2 text-sm text-white/70 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-white hover:file:bg-primary/30"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setDraft((prev) => ({ ...prev, imageUrl: reader.result as string }));
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs uppercase tracking-wide text-white/50 mb-2 block">Description</Label>
            <textarea
              className="w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-primary focus:outline-none resize-none"
              rows={3}
              placeholder="Brief description of the staff member..."
              value={draft.description ?? ""}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, description: event.target.value || undefined }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs uppercase tracking-wide text-white/50 mb-2 block">Review</Label>
            <textarea
              className="w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-primary focus:outline-none resize-none"
              rows={3}
              placeholder="Customer review or testimonial..."
              value={draft.review ?? ""}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, review: event.target.value || undefined }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs uppercase tracking-wide text-white/50 mb-2 block">Reviewer Name</Label>
            <Input
              placeholder="Name of reviewer (optional)"
              value={draft.reviewerName ?? ""}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, reviewerName: event.target.value || undefined }))
              }
            />
          </div>
          <div className="flex items-end justify-end md:col-span-2">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Adding..." : "Add staff"}
            </Button>
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




