"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { X, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/ui/helper-text";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { createClientClient } from "@/lib/supabase-client";
import type { ServiceCategory, ServiceDefinition, StaffMember } from "@/lib/onboarding-types";

export default function CatalogPage() {
  const [catalog, setCatalog] = useState<ServiceCategory[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const toast = useToast();

  // Fetch data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const supabase = createClientClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.pushToast({
          intent: "error",
          title: "Authentication Error",
          description: "Please log in to view services and categories."
        });
        return;
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      };

      // Fetch services and categories
      const servicesResponse = await fetch('/api/business/onboarding/step-6-services', {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      if (!servicesResponse.ok) {
        throw new Error('Failed to load services');
      }

      const servicesData = await servicesResponse.json();
      setCatalog(servicesData.services || []);

      // Fetch staff
      const staffResponse = await fetch('/api/business/onboarding/step-4-team', {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      if (!staffResponse.ok) {
        throw new Error('Failed to load staff');
      }

      const staffData = await staffResponse.json();
      setStaff(staffData.staff || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.pushToast({
        intent: "error",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load services and categories."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (categoryId: string, updater: (category: ServiceCategory) => ServiceCategory) => {
    const nextCatalog = catalog.map((category) =>
      category.id === categoryId ? updater(category) : category
    );
    setCatalog(nextCatalog);
    setHasChanges(true);
  };

  const handleAddService = (categoryId: string, service: ServiceDefinition) => {
    const updatedCatalog = catalog.map((category) =>
      category.id === categoryId
        ? { ...category, services: [...category.services, service] }
        : category
    );
    setCatalog(updatedCatalog);
    setHasChanges(true);
  };

  const handleRemoveService = (categoryId: string, serviceId: string) => {
    const updatedCatalog = catalog.map((category) =>
      category.id === categoryId
        ? {
            ...category,
            services: category.services.filter((svc) => svc.id !== serviceId)
          }
        : category
    );
    setCatalog(updatedCatalog);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const supabase = createClientClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.pushToast({
          intent: "error",
          title: "Authentication Error",
          description: "Please log in to save changes."
        });
        return;
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      };

      const response = await fetch('/api/business/onboarding/step-6-services', {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({ categories: catalog }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save changes');
      }

      const data = await response.json();
      
      toast.pushToast({
        intent: "success",
        title: "Saved",
        description: data.message || "Services and categories saved successfully."
      });

      setHasChanges(false);
      
      // Reload data to ensure we have the latest from the database
      await loadData();
    } catch (error) {
      console.error('Error saving:', error);
      toast.pushToast({
        intent: "error",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save changes. Please try again."
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-10">
        <header className="space-y-4">
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">Catalog</p>
          <h1 className="font-display text-4xl text-white">Services &amp; categories</h1>
        </header>
        <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-12 text-center text-white/50">
          Loading services and categories...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.35em] text-white/40">Catalog</p>
            <h1 className="font-display text-4xl text-white">Services &amp; categories</h1>
            <p className="max-w-3xl text-sm text-white/60">
              Keep your catalog tight and structured: every service belongs to a category, carries a brand
              tint, and maps to staff availability. Edits here flow to onboarding mirrors, public booking,
              and future inventory exports.
            </p>
            {hasChanges && !saving && (
              <p className="text-sm text-amber-400/80">
                You have unsaved changes. Click "Save Changes" to update your services and categories.
              </p>
            )}
          </div>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="shrink-0"
            variant={hasChanges ? "default" : "outline"}
          >
            {saving ? "Saving..." : hasChanges ? "Save Changes" : "No Changes"}
          </Button>
        </div>
      </header>

      <div className="space-y-8">
        {catalog.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            staff={staff}
            onCategoryChange={(updater) => handleCategoryChange(category.id, updater)}
            onAddService={(service) => handleAddService(category.id, service)}
            onRemoveService={(serviceId) => handleRemoveService(category.id, serviceId)}
          />
        ))}
        {catalog.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-12 text-center text-white/50">
            Start by adding categories and services during onboarding. Once real data exists, the admin
            mirrors every field here for post-launch edits.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CategoryCard({
  category,
  staff,
  onCategoryChange,
  onAddService,
  onRemoveService
}: {
  category: ServiceCategory;
  staff: StaffMember[];
  onCategoryChange: (updater: (category: ServiceCategory) => ServiceCategory) => void;
  onAddService: (service: ServiceDefinition) => void;
  onRemoveService: (serviceId: string) => void;
}) {
  const [serviceDraft, setServiceDraft] = useState<ServiceDefinition>({
    id: "",
    name: "",
    description: "",
    durationMinutes: 60,
    priceCents: 12000,
    instructions: "",
    staffIds: staff.map((member) => member.id),
    imageUrl: undefined
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!serviceDraft.name.trim()) {
      setError("Service name is required.");
      return;
    }
    if (serviceDraft.durationMinutes <= 0) {
      setError("Duration must be greater than zero.");
      return;
    }
    const newService: ServiceDefinition = {
      ...serviceDraft,
      id: `svc_${crypto.randomUUID()}`,
      priceCents: Math.round(serviceDraft.priceCents),
      durationMinutes: Math.round(serviceDraft.durationMinutes)
    };
    onAddService(newService);
    setServiceDraft({
      id: "",
      name: "",
      description: "",
      durationMinutes: 60,
      priceCents: 12000,
      instructions: "",
      staffIds: staff.map((member) => member.id),
      imageUrl: undefined
    });
    setError(null);
  };

  return (
    <article className="rounded-3xl border border-white/15 bg-black/80 p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-wide text-white/50 md:text-xs">
            Category name
          </Label>
          <Input
            value={category.name}
            onChange={(event) =>
              onCategoryChange((prev) => ({
                ...prev,
                name: event.target.value
              }))
            }
          />
          <Textarea
            rows={2}
            className="mt-2"
            placeholder="Describe the services in this category"
            value={category.description ?? ""}
            onChange={(event) =>
              onCategoryChange((prev) => ({
                ...prev,
                description: event.target.value
              }))
            }
          />
        </div>
        <div className="flex flex-col items-start gap-2">
          <Label className="text-[10px] uppercase tracking-wide text-white/50 md:text-xs">
            Accent color
          </Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={category.color}
              onChange={(event) =>
                onCategoryChange((prev) => ({
                  ...prev,
                  color: event.target.value
                }))
              }
              className="h-10 w-20 cursor-pointer rounded-lg border border-white/20 bg-transparent"
            />
            <span className="text-xs text-white/60">{category.color}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-black/70">
        <table className="min-w-full text-left text-xs text-white/70 md:text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/40">
            <tr>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {category.services.map((service) => (
              <tr key={service.id} className="border-b border-white/5 last:border-none">
                <td className="px-4 py-3">
                  <Input
                    value={service.name}
                    onChange={(event) =>
                      onCategoryChange((prev) => ({
                        ...prev,
                        services: prev.services.map((entry) =>
                          entry.id === service.id ? { ...entry, name: event.target.value } : entry
                        )
                      }))
                    }
                  />
                  <Textarea
                    rows={2}
                    className="mt-2"
                    placeholder="Optional description"
                    value={service.description ?? ""}
                    onChange={(event) =>
                      onCategoryChange((prev) => ({
                        ...prev,
                        services: prev.services.map((entry) =>
                          entry.id === service.id
                            ? { ...entry, description: event.target.value }
                            : entry
                        )
                      }))
                    }
                  />
                  <Textarea
                    rows={2}
                    className="mt-2"
                    placeholder="Pre-appointment instructions (optional)"
                    value={service.instructions ?? ""}
                    onChange={(event) =>
                      onCategoryChange((prev) => ({
                        ...prev,
                        services: prev.services.map((entry) =>
                          entry.id === service.id
                            ? { ...entry, instructions: event.target.value }
                            : entry
                        )
                      }))
                    }
                  />
                </td>
                <td className="px-4 py-3">
                  <ServiceImageUpload
                    imageUrl={service.imageUrl}
                    onImageChange={(imageUrl) =>
                      onCategoryChange((prev) => ({
                        ...prev,
                        services: prev.services.map((entry) =>
                          entry.id === service.id ? { ...entry, imageUrl } : entry
                        )
                      }))
                    }
                    onImageRemove={() =>
                      onCategoryChange((prev) => ({
                        ...prev,
                        services: prev.services.map((entry) =>
                          entry.id === service.id ? { ...entry, imageUrl: undefined } : entry
                        )
                      }))
                    }
                  />
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="number"
                    min={15}
                    step={5}
                    value={service.durationMinutes}
                    onChange={(event) =>
                      onCategoryChange((prev) => ({
                        ...prev,
                        services: prev.services.map((entry) =>
                          entry.id === service.id ? { ...entry, durationMinutes: Number(event.target.value) } : entry
                        )
                      }))
                    }
                  />
                  <p className="mt-1 text-[11px] text-white/40">minutes</p>
                </td>
                <td className="px-4 py-3">
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={service.priceCents / 100}
                    onChange={(event) =>
                      onCategoryChange((prev) => ({
                        ...prev,
                        services: prev.services.map((entry) =>
                          entry.id === service.id ? { ...entry, priceCents: Math.round(Number(event.target.value) * 100) } : entry
                        )
                      }))
                    }
                  />
                  <p className="mt-1 text-[11px] text-white/40">USD</p>
                </td>
                <td className="px-4 py-3">
                  <div className="max-h-32 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/60 p-3 text-[11px] text-white/70">
                    {staff.length === 0 ? (
                      <p className="text-white/40">No staff members available</p>
                    ) : (
                      staff.map((member) => (
                        <label key={member.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={service.staffIds.includes(member.id)}
                            onChange={(event) =>
                              onCategoryChange((prev) => ({
                                ...prev,
                                services: prev.services.map((entry) =>
                                  entry.id === service.id
                                    ? {
                                        ...entry,
                                        staffIds: event.target.checked
                                          ? [...new Set([...entry.staffIds, member.id])]
                                          : entry.staffIds.filter((id) => id !== member.id)
                                      }
                                    : entry
                                )
                              }))
                            }
                          />
                          {member.name}
                        </label>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-white/60 hover:text-white"
                    onClick={() => onRemoveService(service.id)}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-black/70 p-4 lg:grid-cols-4"
      >
        <div className="lg:col-span-2">
          <Label className="text-[10px] uppercase tracking-wide text-white/50 md:text-xs">
            Service name
          </Label>
          <Input
            className="mt-2"
            value={serviceDraft.name}
            onChange={(event) =>
              setServiceDraft((draft) => ({ ...draft, name: event.target.value }))
            }
            placeholder="e.g., Signature Cut"
          />
          <Textarea
            rows={2}
            className="mt-3"
            placeholder="Optional description"
            value={serviceDraft.description ?? ""}
            onChange={(event) =>
              setServiceDraft((draft) => ({ ...draft, description: event.target.value }))
            }
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-white/50 md:text-xs">
            Duration (min)
          </Label>
          <Input
            type="number"
            min={15}
            step={5}
            className="mt-2"
            value={serviceDraft.durationMinutes}
            onChange={(event) =>
              setServiceDraft((draft) => ({
                ...draft,
                durationMinutes: Number(event.target.value)
              }))
            }
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-white/50 md:text-xs">
            Price (USD)
          </Label>
          <Input
            type="number"
            min={0}
            step={5}
            className="mt-2"
            value={serviceDraft.priceCents / 100}
            onChange={(event) =>
              setServiceDraft((draft) => ({
                ...draft,
                priceCents: Math.round(Number(event.target.value) * 100)
              }))
            }
          />
        </div>
        <div className="lg:col-span-4">
          <Label className="text-[10px] uppercase tracking-wide text-white/50 md:text-xs">
            Service Image (optional)
          </Label>
          <ServiceImageUpload
            imageUrl={serviceDraft.imageUrl}
            onImageChange={(imageUrl) =>
              setServiceDraft((draft) => ({ ...draft, imageUrl }))
            }
            onImageRemove={() =>
              setServiceDraft((draft) => ({ ...draft, imageUrl: undefined }))
            }
          />
        </div>
        <div className="lg:col-span-4">
          <Label className="text-[10px] uppercase tracking-wide text-white/50 md:text-xs">
            Instructions (optional)
          </Label>
          <Textarea
            rows={2}
            className="mt-2"
            value={serviceDraft.instructions ?? ""}
            placeholder="e.g., Arrive 10 minutes early; bring inspiration photos."
            onChange={(event) =>
              setServiceDraft((draft) => ({ ...draft, instructions: event.target.value }))
            }
          />
        </div>
        <div className="lg:col-span-4">
          <Label className="text-[10px] uppercase tracking-wide text-white/50 md:text-xs">
            Assign staff
          </Label>
          <div className="mt-2 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-black/60 p-3 text-[11px] text-white/70 md:gap-3 md:p-4 md:text-xs">
            {staff.map((member) => (
              <label key={member.id} className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={serviceDraft.staffIds.includes(member.id)}
                  onChange={(event) =>
                    setServiceDraft((draft) => ({
                      ...draft,
                      staffIds: event.target.checked
                        ? [...new Set([...draft.staffIds, member.id])]
                        : draft.staffIds.filter((id) => id !== member.id)
                    }))
                  }
                />
                <span>{member.name}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="lg:col-span-4 flex items-center justify-between">
          <div>
            {error ? (
              <HelperText intent="error" role="alert">
                {error}
              </HelperText>
            ) : (
              <HelperText className="text-xs">
                Services inherit staff assignment for availability. You can fine-tune slots in the
                Availability tab.
              </HelperText>
            )}
          </div>
          <Button type="submit">Add service</Button>
        </div>
      </form>
    </article>
  );
}

function ServiceImageUpload({
  imageUrl,
  onImageChange,
  onImageRemove
}: {
  imageUrl?: string;
  onImageChange: (imageUrl: string) => void;
  onImageRemove: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | undefined>(imageUrl);

  useEffect(() => {
    setPreview(imageUrl);
  }, [imageUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image file size must be less than 5MB');
      return;
    }

    // Convert file to data URL (base64) so it can be saved to the database
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      onImageChange(dataUrl);
    };
    reader.onerror = () => {
      alert('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    setPreview(undefined);
    onImageRemove();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      {preview ? (
        <div className="relative">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-black/60">
            {preview.startsWith('blob:') || preview.startsWith('data:') ? (
              <img
                src={preview}
                alt="Service preview"
                className="h-full w-full object-cover"
                onError={() => setPreview(undefined)}
              />
            ) : (
              <Image
                src={preview}
                alt="Service preview"
                fill
                className="object-cover"
                sizes="200px"
                unoptimized
                onError={() => setPreview(undefined)}
              />
            )}
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-black/80 text-white hover:bg-black"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-black/40 py-3 text-sm text-white/60 hover:border-white/40 hover:bg-black/60 hover:text-white/80"
        >
          <Upload className="h-4 w-4" />
          <span>Upload image</span>
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
