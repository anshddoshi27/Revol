"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/ui/helper-text";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFakeBusiness } from "@/lib/fake-business";
import type { ServiceCategory, ServiceDefinition, StaffMember } from "@/lib/onboarding-types";

export default function CatalogPage() {
  const { workspace, setCatalog, setAvailability } = useFakeBusiness();

  if (!workspace) {
    return null;
  }

  const handleCategoryChange = (categoryId: string, updater: (category: ServiceCategory) => ServiceCategory) => {
    const nextCatalog = workspace.catalog.map((category) =>
      category.id === categoryId ? updater(category) : category
    );
    setCatalog(nextCatalog);
  };

  const handleAddService = (categoryId: string, service: ServiceDefinition) => {
    const updatedCatalog = workspace.catalog.map((category) =>
      category.id === categoryId
        ? { ...category, services: [...category.services, service] }
        : category
    );
    setCatalog(updatedCatalog);
    setAvailability([
      ...workspace.availability,
      {
        serviceId: service.id,
        staff: service.staffIds.map((staffId) => ({
          staffId,
          slots: []
        }))
      }
    ]);
  };

  const handleRemoveService = (categoryId: string, serviceId: string) => {
    const updatedCatalog = workspace.catalog.map((category) =>
      category.id === categoryId
        ? {
            ...category,
            services: category.services.filter((svc) => svc.id !== serviceId)
          }
        : category
    );
    setCatalog(updatedCatalog);
    setAvailability(workspace.availability.filter((entry) => entry.serviceId !== serviceId));
  };

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.35em] text-white/40">Catalog</p>
        <h1 className="font-display text-4xl text-white">Services &amp; categories</h1>
        <p className="max-w-3xl text-sm text-white/60">
          Keep your catalog tight and structured: every service belongs to a category, carries a brand
          tint, and maps to staff availability. Edits here flow to onboarding mirrors, public booking,
          and future inventory exports.
        </p>
      </header>

      <div className="space-y-8">
        {workspace.catalog.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            staff={workspace.staff}
            onCategoryChange={(updater) => handleCategoryChange(category.id, updater)}
            onAddService={(service) => handleAddService(category.id, service)}
            onRemoveService={(serviceId) => handleRemoveService(category.id, serviceId)}
          />
        ))}
        {workspace.catalog.length === 0 ? (
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
    staffIds: staff.map((member) => member.id)
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
      staffIds: staff.map((member) => member.id)
    });
    setError(null);
  };

  return (
    <article className="rounded-3xl border border-white/15 bg-white/5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-white/50">Category name</Label>
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
          <Label className="text-xs uppercase tracking-wide text-white/50">Accent color</Label>
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

      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-[#060F28]/50">
        <table className="min-w-full text-left text-sm text-white/70">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/40">
            <tr>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Staff</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {category.services.map((service) => (
              <tr key={service.id} className="border-b border-white/5 last:border-none">
                <td className="px-4 py-4">
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
                    className="mt-3"
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
                </td>
                <td className="px-4 py-4">
                  <Input
                    type="number"
                    min={15}
                    step={5}
                    value={service.durationMinutes}
                    onChange={(event) =>
                      onCategoryChange((prev) => ({
                        ...prev,
                        services: prev.services.map((entry) =>
                          entry.id === service.id
                            ? { ...entry, durationMinutes: Number(event.target.value) }
                            : entry
                        )
                      }))
                    }
                  />
                  <p className="mt-2 text-xs text-white/40">minutes</p>
                </td>
                <td className="px-4 py-4">
                  <Input
                    type="number"
                    min={0}
                    step={5}
                    value={service.priceCents / 100}
                    onChange={(event) =>
                      onCategoryChange((prev) => ({
                        ...prev,
                        services: prev.services.map((entry) =>
                          entry.id === service.id
                            ? { ...entry, priceCents: Math.round(Number(event.target.value) * 100) }
                            : entry
                        )
                      }))
                    }
                  />
                  <p className="mt-2 text-xs text-white/40">USD</p>
                </td>
                <td className="px-4 py-4">
                  <div className="max-h-32 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
                    {staff
                      .filter((member) => service.staffIds.includes(member.id))
                      .map((member) => (
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
                      ))}
                  </div>
                </td>
                <td className="px-4 py-4 text-right">
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
        className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 lg:grid-cols-4"
      >
        <div className="lg:col-span-2">
          <Label className="text-xs uppercase tracking-wide text-white/50">Service name</Label>
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
          <Label className="text-xs uppercase tracking-wide text-white/50">Duration (min)</Label>
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
          <Label className="text-xs uppercase tracking-wide text-white/50">Price (USD)</Label>
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
          <Label className="text-xs uppercase tracking-wide text-white/50">Instructions (optional)</Label>
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
          <Label className="text-xs uppercase tracking-wide text-white/50">Assign staff</Label>
          <div className="mt-2 flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/70">
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
              <HelperText>
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

