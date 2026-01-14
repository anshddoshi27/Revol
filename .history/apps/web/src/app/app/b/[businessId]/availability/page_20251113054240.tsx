"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFakeBusiness } from "@/lib/fake-business";

export default function AvailabilityTemplatesPage() {
  const {
    workspace,
    copyAvailabilityTemplate,
    pasteAvailabilityTemplate,
    clearAvailabilityClipboard,
    updateWorkspace
  } = useFakeBusiness();
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState<string>("");

  if (!workspace) {
    return null;
  }

  const handleRename = (templateId: string) => {
    setEditingTemplateId(templateId);
    const template = workspace.availabilityTemplates.find((entry) => entry.id === templateId);
    setLabelDraft(template?.label ?? "");
  };

  const commitRename = () => {
    if (!editingTemplateId) return;
    updateWorkspace((existing) => ({
      ...existing,
      availabilityTemplates: existing.availabilityTemplates.map((template) =>
        template.id === editingTemplateId ? { ...template, label: labelDraft } : template
      )
    }));
    setEditingTemplateId(null);
    setLabelDraft("");
  };

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.35em] text-white/40">Templates</p>
        <h1 className="font-display text-4xl text-white">Availability library</h1>
        <p className="max-w-3xl text-sm text-white/60">
          Templates mirror the onboarding wizard. Use them to rapidly configure services with identical
          hours, copy between services, and keep staff schedules in sync.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {workspace.availabilityTemplates.map((template) => (
          <article key={template.id} className="rounded-3xl border border-white/15 bg-white/5 p-6">
            <header className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/50">
                  {template.serviceName}
                </p>
                {editingTemplateId === template.id ? (
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      value={labelDraft}
                      onChange={(event) => setLabelDraft(event.target.value)}
                      autoFocus
                    />
                    <Button type="button" size="sm" onClick={commitRename}>
                      Save
                    </Button>
                  </div>
                ) : (
                  <h2 className="mt-1 text-lg font-semibold text-white">{template.label}</h2>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleRename(template.id)}
                >
                  Rename
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => copyAvailabilityTemplate(template.id)}
                >
                  Copy
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => pasteAvailabilityTemplate(template.serviceId)}
                >
                  Paste to service
                </Button>
              </div>
            </header>

            <div className="mt-4 space-y-4 text-sm text-white/70">
              {template.staffAssignments.map((assignment) => (
                <div key={assignment.staffId} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/40">
                    {assignment.staffName}
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {assignment.slots.length ? (
                      assignment.slots.map((slot) => (
                        <li
                          key={slot.id}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs"
                        >
                          {slot.day.slice(0, 3)} · {slot.startTime} – {slot.endTime}
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-white/40">No slots defined</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
        <p>
          Clipboard status:{" "}
          {workspace.availabilityClipboard ? (
            <span className="text-white">
              {workspace.availabilityClipboard.label} ({workspace.availabilityClipboard.serviceName})
            </span>
          ) : (
            "Empty"
          )}
        </p>
        <Button
          type="button"
          variant="ghost"
          className="mt-3"
          onClick={clearAvailabilityClipboard}
          disabled={!workspace.availabilityClipboard}
        >
          Clear clipboard
        </Button>
      </div>
    </div>
  );
}

