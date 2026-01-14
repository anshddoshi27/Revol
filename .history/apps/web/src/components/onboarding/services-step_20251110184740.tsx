"use client";

import { useMemo, useState } from "react";
import { Plus, Folder, ScissorsSquare, Trash2, Edit3, Users } from "lucide-react";

import { HelperText } from "@/components/ui/helper-text";
import { Input } from "@/components/ui/input";
import { StepActions } from "@/components/onboarding/step-actions";
import type { ServiceCategory, ServiceDefinition, StaffMember } from "@/lib/onboarding-context";

interface ServicesStepProps {
  defaultValues: ServiceCategory[];
  staff: StaffMember[];
  onNext: (values: ServiceCategory[]) => Promise<void> | void;
  onBack: () => void;
}

interface CategoryDraft {
  id?: string;
  name: string;
  description: string;
  color: string;
}

interface ServiceDraft {
  id?: string;
  name: string;
  description: string;
  durationMinutes: number | "";
  price: string;
  instructions: string;
  staffIds: string[];
}

const defaultCategoryDraft: CategoryDraft = {
  name: "",
  description: "",
  color: "#5B64FF"
};

const defaultServiceDraft: ServiceDraft = {
  name: "",
  description: "",
  durationMinutes: "",
  price: "",
  instructions: "",
  staffIds: []
};

export function ServicesStep({ defaultValues, staff, onNext, onBack }: ServicesStepProps) {
  const [categories, setCategories] = useState<ServiceCategory[]>(defaultValues);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>(defaultCategoryDraft);
  const [serviceDraft, setServiceDraft] = useState<Record<string, ServiceDraft>>({});
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetCategoryDraft = () => {
    setCategoryDraft({ ...defaultCategoryDraft, color: randomColor() });
    setEditingCategoryId(null);
    setError(null);
  };

  const resetServiceDraft = (categoryId: string) => {
    setServiceDraft((prev) => ({
      ...prev,
      [categoryId]: { ...defaultServiceDraft, staffIds: [] }
    }));
    setEditingServiceId(null);
    setError(null);
  };

  const ensureServiceDraft = (categoryId: string) => {
    if (!serviceDraft[categoryId]) {
      setServiceDraft((prev) => ({
        ...prev,
        [categoryId]: { ...defaultServiceDraft, staffIds: [] }
      }));
    }
  };

  const handleAddOrUpdateCategory = () => {
    if (!categoryDraft.name.trim()) {
      setError("Category name is required.");
      return;
    }

    if (editingCategoryId) {
      setCategories((prev) =>
        prev.map((category) =>
          category.id === editingCategoryId
            ? {
                ...category,
                name: categoryDraft.name.trim(),
                description: categoryDraft.description.trim(),
                color: categoryDraft.color
              }
            : category
        )
      );
    } else {
      const newCategory: ServiceCategory = {
        id: `cat_${crypto.randomUUID()}`,
        name: categoryDraft.name.trim(),
        description: categoryDraft.description.trim(),
        color: categoryDraft.color,
        services: []
      };
      setCategories((prev) => [...prev, newCategory]);
      ensureServiceDraft(newCategory.id);
    }

    resetCategoryDraft();
  };

  const handleEditCategory = (category: ServiceCategory) => {
    setCategoryDraft({
      id: category.id,
      name: category.name,
      description: category.description ?? "",
      color: category.color
    });
    setEditingCategoryId(category.id);
    setError(null);
  };

  const handleDeleteCategory = (categoryId: string) => {
    setCategories((prev) => prev.filter((category) => category.id !== categoryId));
    setServiceDraft((prev) => {
      const updated = { ...prev };
      delete updated[categoryId];
      return updated;
    });
    if (editingCategoryId === categoryId) {
      resetCategoryDraft();
    }
    if (editingServiceId && editingServiceId.startsWith(categoryId)) {
      setEditingServiceId(null);
    }
  };

  const handleServiceCheckbox = (categoryId: string, staffId: string) => {
    ensureServiceDraft(categoryId);
    setServiceDraft((prev) => {
      const current = prev[categoryId] ?? { ...defaultServiceDraft, staffIds: [] };
      const exists = current.staffIds.includes(staffId);
      return {
        ...prev,
        [categoryId]: {
          ...current,
          staffIds: exists
            ? current.staffIds.filter((id) => id !== staffId)
            : [...current.staffIds, staffId]
        }
      };
    });
  };

  const handleAddOrUpdateService = (categoryId: string) => {
    const draft = serviceDraft[categoryId];
    if (!draft || !draft.name.trim()) {
      setError("Service name is required.");
      return;
    }
    if (!draft.durationMinutes || draft.durationMinutes <= 0) {
      setError("Duration must be a positive number of minutes.");
      return;
    }
    if (!draft.price || Number.parseFloat(draft.price) < 0) {
      setError("Enter a price of zero or greater.");
      return;
    }

    const priceCents = Math.round(Number.parseFloat(draft.price) * 100);
    const normalized: ServiceDefinition = {
      id: draft.id ?? `svc_${crypto.randomUUID()}`,
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      durationMinutes: Number(draft.durationMinutes),
      priceCents,
      instructions: draft.instructions.trim() || undefined,
      staffIds: draft.staffIds
    };

    setCategories((prev) =>
      prev.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              services: draft.id
                ? category.services.map((service) =>
                    service.id === draft.id ? normalized : service
                  )
                : [...category.services, normalized]
            }
          : category
      )
    );

    resetServiceDraft(categoryId);
  };

  const handleEditService = (categoryId: string, service: ServiceDefinition) => {
    setServiceDraft((prev) => ({
      ...prev,
      [categoryId]: {
        id: service.id,
        name: service.name,
        description: service.description ?? "",
        durationMinutes: service.durationMinutes,
        price: (service.priceCents / 100).toFixed(2),
        instructions: service.instructions ?? "",
        staffIds: service.staffIds ?? []
      }
    }));
    setEditingServiceId(`${categoryId}:${service.id}`);
    setError(null);
  };

  const handleDeleteService = (categoryId: string, serviceId: string) => {
    setCategories((prev) =>
      prev.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              services: category.services.filter((service) => service.id !== serviceId)
            }
          : category
      )
    );
    if (editingServiceId === `${categoryId}:${serviceId}`) {
      resetServiceDraft(categoryId);
    }
  };

  const handleContinue = () => {
    if (!categories.length) {
      setError("Add at least one category with services before continuing.");
      return;
    }
    const hasService = categories.some((category) => category.services.length > 0);
    if (!hasService) {
      setError("Add at least one service within a category.");
      return;
    }
    onNext(categories);
  };

  const summaryCopy = useMemo(() => {
    if (!categories.length) return "No categories yet. Customers browse by category.";
    const serviceCount = categories.reduce((count, category) => count + category.services.length, 0);
    return `${categories.length} ${categories.length === 1 ? "category" : "categories"} · ${serviceCount} ${
      serviceCount === 1 ? "service" : "services"
    } configured`;
  }, [categories]);

  return (
    <div className="space-y-8" aria-labelledby="services-step-heading">
      <header className="space-y-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary/90">
          <Folder className="h-4 w-4" aria-hidden="true" />
          Step 6 · Services & categories
        </span>
        <h2 id="services-step-heading" className="font-display text-3xl text-white">
          Build your catalog
        </h2>
        <p className="max-w-3xl text-base text-white/70">
          Categories organize your offerings. Services live within categories and define price,
          duration, and instructions. Assign staff who can perform each service to unlock
          availability later.
        </p>
      </header>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h3 className="text-lg font-semibold text-white">
          {editingCategoryId ? "Update category" : "Add a category"}
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium text-white/80" htmlFor="category-name">
              Category name
            </label>
            <Input
              id="category-name"
              placeholder="Hair"
              value={categoryDraft.name}
              onChange={(event) =>
                setCategoryDraft((prev) => ({ ...prev, name: event.target.value }))
              }
              aria-describedby={error ? "category-name-error" : "category-name-helper"}
            />
            <HelperText id="category-name-helper" className="mt-2">
              Appears as a heading and filter on the booking page.
            </HelperText>
            {error && !editingServiceId && (
              <HelperText id="category-name-error" intent="error" className="mt-1" role="alert">
                {error}
              </HelperText>
            )}
          </div>

          <div className="sm:col-span-2">
            <label
              className="mb-2 block text-sm font-medium text-white/80"
              htmlFor="category-description"
            >
              Description (optional)
            </label>
            <textarea
              id="category-description"
              rows={2}
              className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white shadow-inner placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050F2C]"
              placeholder="Highlight what makes this category special."
              value={categoryDraft.description}
              onChange={(event) =>
                setCategoryDraft((prev) => ({ ...prev, description: event.target.value }))
              }
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/80" htmlFor="category-color">
              Category accent color
            </label>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <input
                id="category-color"
                type="color"
                value={categoryDraft.color}
                onChange={(event) =>
                  setCategoryDraft((prev) => ({ ...prev, color: event.target.value }))
                }
                className="h-12 w-16 cursor-pointer rounded-2xl border border-white/10 bg-transparent"
              />
              <span className="text-sm text-white/70">{categoryDraft.color.toUpperCase()}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleAddOrUpdateCategory}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white shadow-primary/20 transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {editingCategoryId ? "Save category" : "Create category"}
          </button>
          {editingCategoryId ? (
            <button
              type="button"
              onClick={resetCategoryDraft}
              className="text-sm font-medium text-white/70 transition hover:text-white"
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-6">
        {categories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-6 py-10 text-center text-sm text-white/60">
            Create your first category to start adding services.
          </div>
        ) : (
          categories.map((category) => {
            const draft = serviceDraft[category.id] ?? defaultServiceDraft;
            const isEditing = editingServiceId?.startsWith(`${category.id}:`);

            return (
              <div key={category.id} className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-6 rounded-full"
                        style={{ backgroundColor: category.color }}
                        aria-hidden="true"
                      />
                      <h3 className="text-lg font-semibold text-white">{category.name}</h3>
                    </div>
                    <p className="text-xs text-white/60">
                      {category.description || "No description yet. Add one to give customers context."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditCategory(category)}
                      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                    >
                      <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(category.id)}
                      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-rose-200/80 transition hover:bg-rose-500/20 hover:text-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Remove
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
                  <h4 className="text-sm font-semibold text-white">
                    {isEditing ? "Update service" : "Add a service"}
                  </h4>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="lg:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-white/80" htmlFor={`service-name-${category.id}`}>
                        Service name
                      </label>
                      <Input
                        id={`service-name-${category.id}`}
                        placeholder="Signature Cut"
                        value={draft.name}
                        onChange={(event) =>
                          setServiceDraft((prev) => ({
                            ...prev,
                            [category.id]: {
                              ...(prev[category.id] ?? defaultServiceDraft),
                              name: event.target.value
                            }
                          }))
                        }
                        aria-describedby={
                          error && editingServiceId ? `service-name-error-${category.id}` : undefined
                        }
                      />
                      {error && editingServiceId ? (
                        <HelperText
                          id={`service-name-error-${category.id}`}
                          intent="error"
                          className="mt-1"
                          role="alert"
                        >
                          {error}
                        </HelperText>
                      ) : null}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/80" htmlFor={`service-duration-${category.id}`}>
                        Duration (minutes)
                      </label>
                      <Input
                        id={`service-duration-${category.id}`}
                        type="number"
                        min={5}
                        step={5}
                        placeholder="60"
                        value={draft.durationMinutes}
                        onChange={(event) =>
                          setServiceDraft((prev) => ({
                            ...prev,
                            [category.id]: {
                              ...(prev[category.id] ?? defaultServiceDraft),
                              durationMinutes: Number(event.target.value)
                            }
                          }))
                        }
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/80" htmlFor={`service-price-${category.id}`}>
                        Price (USD)
                      </label>
                      <Input
                        id={`service-price-${category.id}`}
                        placeholder="120.00"
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft.price}
                        onChange={(event) =>
                          setServiceDraft((prev) => ({
                            ...prev,
                            [category.id]: {
                              ...(prev[category.id] ?? defaultServiceDraft),
                              price: event.target.value
                            }
                          }))
                        }
                      />
                    </div>

                    <div className="lg:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-white/80" htmlFor={`service-description-${category.id}`}>
                        Description (optional)
                      </label>
                      <textarea
                        id={`service-description-${category.id}`}
                        rows={2}
                        className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white shadow-inner placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050F2C]"
                        placeholder="Customers see this when picking a service."
                        value={draft.description}
                        onChange={(event) =>
                          setServiceDraft((prev) => ({
                            ...prev,
                            [category.id]: {
                              ...(prev[category.id] ?? defaultServiceDraft),
                              description: event.target.value
                            }
                          }))
                        }
                      />
                    </div>

                    <div className="lg:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-white/80" htmlFor={`service-instructions-${category.id}`}>
                        Pre-appointment instructions (optional)
                      </label>
                      <textarea
                        id={`service-instructions-${category.id}`}
                        rows={2}
                        className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white shadow-inner placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050F2C]"
                        placeholder="Share tips or expectations before customers arrive."
                        value={draft.instructions}
                        onChange={(event) =>
                          setServiceDraft((prev) => ({
                            ...prev,
                            [category.id]: {
                              ...(prev[category.id] ?? defaultServiceDraft),
                              instructions: event.target.value
                            }
                          }))
                        }
                      />
                    </div>

                    <div className="lg:col-span-2">
                      <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/60">
                        <Users className="h-3.5 w-3.5" aria-hidden="true" />
                        Staff who can perform this service
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {staff.length === 0 ? (
                          <HelperText intent="warning">
                            Add team members first to assign availability later.
                          </HelperText>
                        ) : (
                          staff.map((member) => {
                            const checked = draft.staffIds?.includes(member.id);
                            return (
                              <label
                                key={member.id}
                                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/70 transition hover:border-white/25 hover:text-white"
                              >
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-white/20 bg-transparent accent-primary"
                                  checked={checked}
                                  onChange={() => handleServiceCheckbox(category.id, member.id)}
                                />
                                <span>{member.name}</span>
                              </label>
                            );
                          })
                        )}
                      </div>
                      <HelperText className="mt-2">
                        Assign at least one staff member to surface slots in the availability step.
                      </HelperText>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleAddOrUpdateService(category.id)}
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                    >
                      <ScissorsSquare className="h-3.5 w-3.5" aria-hidden="true" />
                      {isEditing ? "Save service" : "Add service"}
                    </button>
                    {isEditing ? (
                      <button
                        type="button"
                        onClick={() => resetServiceDraft(category.id)}
                        className="text-xs font-medium text-white/70 transition hover:text-white"
                      >
                        Cancel edit
                      </button>
                    ) : null}
                  </div>
                </div>

                {category.services.length > 0 ? (
                  <ul className="grid gap-3 lg:grid-cols-2">
                    {category.services.map((service) => (
                      <li
                        key={service.id}
                        className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/10 p-4"
                      >
                        <div>
                          <h4 className="text-base font-semibold text-white">{service.name}</h4>
                          <p className="text-xs text-white/60">
                            {service.description || "No description yet."}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-white/70">
                          <span>{service.durationMinutes} min</span>
                          <span>${(service.priceCents / 100).toFixed(2)}</span>
                        </div>
                        <div>
                          <p className="text-xs text-white/50">
                            {service.instructions || "No instructions provided."}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
                          {service.staffIds.length ? (
                            service.staffIds.map((id) => {
                              const member = staff.find((person) => person.id === id);
                              return (
                                <span
                                  key={id}
                                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1"
                                >
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: member?.color ?? "#ffffff" }}
                                  />
                                  {member?.name ?? "Staff removed"}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-amber-200">Assign staff to unlock availability.</span>
                          )}
                        </div>
                        <div className="mt-auto flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditService(category.id, service)}
                            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                          >
                            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteService(category.id, service.id)}
                            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-rose-200/80 transition hover:bg-rose-500/20 hover:text-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-6 text-sm text-white/50">
                    No services yet. Add at least one to make this category visible.
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/70">
        <p>{summaryCopy}</p>
      </div>

      <StepActions onBack={onBack} onNext={handleContinue} isNextDisabled={!categories.length} />
    </div>
  );
}

function randomColor() {
  const palette = ["#5B64FF", "#57D0FF", "#FF9A8B", "#FFD166", "#8AFFCF", "#C4A5FF"];
  return palette[Math.floor(Math.random() * palette.length)];
}


