"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/ui/helper-text";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFakeBusiness } from "@/lib/fake-business";
import { createClientClient } from "@/lib/supabase-client";
import type { NotificationTemplate } from "@/lib/onboarding-types";

const PLACEHOLDERS = [
  "${customer.name}",
  "${service.name}",
  "${service.duration}",
  "${service.price}",
  "${staff.name}",
  "${booking.date}",
  "${booking.time}",
  "${business.name}",
  "${booking.url}"
];

export default function NotificationsPage() {
  const { workspace, setNotifications } = useFakeBusiness();
  const [previewTemplate, setPreviewTemplate] = useState<NotificationTemplate | null>(null);
  const params = useParams<{ businessId: string }>();
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClientClient();

  // Fetch notifications_enabled from database
  useEffect(() => {
    async function fetchNotificationsEnabled() {
      if (!params.businessId) return;
      
      try {
        const { data, error } = await supabase
          .from('businesses')
          .select('notifications_enabled')
          .eq('id', params.businessId)
          .single();

        if (!error && data) {
          setNotificationsEnabled(data.notifications_enabled ?? false);
        } else {
          setNotificationsEnabled(false);
        }
      } catch (error) {
        console.error('Error fetching notifications_enabled:', error);
        setNotificationsEnabled(false);
      } finally {
        setLoading(false);
      }
    }

    fetchNotificationsEnabled();
  }, [params.businessId, supabase]);

  if (loading) {
    return (
      <div className="space-y-10">
        <header className="space-y-4">
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">Messaging</p>
          <h1 className="font-display text-4xl text-white">Notifications</h1>
        </header>
        <div className="rounded-3xl border border-white/15 bg-black/80 p-8 text-center">
          <p className="text-sm text-white/60">Loading...</p>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return null;
  }

  // Check if notifications are enabled (Basic Plan = false, Pro Plan = true)
  if (!notificationsEnabled) {
    return (
      <div className="space-y-10">
        <header className="space-y-4">
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">Messaging</p>
          <h1 className="font-display text-4xl text-white">Notifications</h1>
        </header>
        <div className="rounded-3xl border border-amber-400/30 bg-amber-400/10 p-8 text-center">
          <p className="text-lg font-semibold text-white">Basic Plan - Notifications Not Available</p>
          <p className="mt-2 text-sm text-white/70">
            Your account is on the Basic Plan ($11.99/month). SMS and email notifications are not included.
          </p>
          <p className="mt-4 text-sm text-white/60">
            Only booking confirmation messages are shown to clients. To enable automated SMS and email notifications, 
            reminders, and follow-ups, upgrade to the Pro Plan ($21.99/month).
          </p>
          <div className="mt-6">
            <a
              href={`/app/b/${params.businessId}/account`}
              className="inline-flex items-center rounded-full border border-primary/50 bg-primary/10 px-6 py-3 text-sm font-semibold text-white transition hover:border-primary/70 hover:bg-primary/15"
            >
              View Account Settings
            </a>
          </div>
        </div>
      </div>
    );
  }

  const updateTemplate = (templateId: string, updater: (template: NotificationTemplate) => NotificationTemplate) => {
    const nextTemplates = workspace.notifications.map((template) =>
      template.id === templateId ? updater(template) : template
    );
    setNotifications(nextTemplates);
  };

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.35em] text-white/40">Messaging</p>
        <h1 className="font-display text-4xl text-white">Notifications</h1>
        <p className="max-w-3xl text-sm text-white/60">
          Email and SMS templates merge these placeholders at send time. Toggle channels, customize copy,
          and preview with sample booking data.
        </p>
      </header>

      <div className="grid gap-4 text-sm lg:grid-cols-2">
        {workspace.notifications.map((template) => (
          <article key={template.id} className="rounded-3xl border border-white/15 bg-black/80 p-4">
            <header className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-white/50 md:text-xs">
                  {template.channel}
                </p>
                <h2 className="text-base font-semibold text-white md:text-lg">{template.name}</h2>
                <p className="text-[11px] text-white/40">
                  Trigger: {template.trigger.replace("_", " ")} · {template.category}
                </p>
              </div>
              <Button
                type="button"
                variant={template.enabled ? "default" : "outline"}
                onClick={() =>
                  updateTemplate(template.id, (prev) => ({ ...prev, enabled: !prev.enabled }))
                }
              >
                {template.enabled ? "Enabled" : "Disabled"}
              </Button>
            </header>

            {template.channel === "email" ? (
              <div className="mt-3">
                <Label className="text-[10px] uppercase tracking-wide text-white/50 md:text-xs">
                  Subject
                </Label>
                <Input
                  className="mt-2"
                  value={template.subject ?? ""}
                  onChange={(event) =>
                    updateTemplate(template.id, (prev) => ({ ...prev, subject: event.target.value }))
                  }
                />
              </div>
            ) : null}

            <div className="mt-4">
              <Label className="text-[10px] uppercase tracking-wide text-white/50 md:text-xs">
                Message
              </Label>
              <Textarea
                rows={6}
                className="mt-2"
                value={template.body}
                onChange={(event) =>
                  updateTemplate(template.id, (prev) => ({ ...prev, body: event.target.value }))
                }
              />
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/60 md:text-xs">
                {PLACEHOLDERS.map((placeholder) => (
                  <button
                    key={`${template.id}-${placeholder}`}
                    type="button"
                    className="rounded-full border border-white/15 bg-black/60 px-3 py-1 transition hover:border-white/30 hover:text-white"
                    onClick={() =>
                      updateTemplate(template.id, (prev) => ({
                        ...prev,
                        body: `${prev.body}${prev.body.endsWith(" ") || prev.body.length === 0 ? "" : " "}${placeholder}`
                      }))
                    }
                  >
                    {placeholder}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <HelperText className="text-xs">
                Unknown placeholders will be rejected. Toggle status to control per-template delivery.
              </HelperText>
              <Button type="button" variant="ghost" onClick={() => setPreviewTemplate(template)}>
                Preview
              </Button>
            </div>
          </article>
        ))}
      </div>

      <NotificationPreview template={previewTemplate} onClose={() => setPreviewTemplate(null)} />
    </div>
  );
}

function NotificationPreview({
  template,
  onClose
}: {
  template: NotificationTemplate | null;
  onClose: () => void;
}) {
  if (!template) return null;
  const previewBody = template.body
    .replaceAll("${customer.name}", "Jordan Blake")
    .replaceAll("${service.name}", "Signature Cut")
    .replaceAll("${service.duration}", "60 minutes")
    .replaceAll("${service.price}", "$120.00")
    .replaceAll("${staff.name}", "Ava Thompson")
    .replaceAll("${booking.date}", "Mar 18, 2025")
    .replaceAll("${booking.time}", "2:00 PM")
    .replaceAll("${business.name}", "Studio Nova")
    .replaceAll("${booking.url}", "https://novastudio.tithi.com/booking/preview");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur">
      <div className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-black px-6 py-8 text-white shadow-[0_60px_160px_rgba(4,12,35,0.7)]">
        <button
          type="button"
          className="absolute right-6 top-6 rounded-full border border-white/20 bg-black/60 px-3 py-1 text-xs uppercase tracking-wide text-white/60 transition hover:text-white"
          onClick={onClose}
        >
          Close
        </button>
        <h3 className="text-lg font-semibold text-white">{template.name}</h3>
        <p className="mt-1 text-xs uppercase tracking-wide text-white/40">
          {template.channel.toUpperCase()} · {template.trigger.replace("_", " ")}
        </p>
        {template.subject ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/70 px-4 py-3 text-sm text-white/80">
            <span className="text-xs uppercase tracking-wide text-white/40">Subject</span>
            <p className="mt-1 text-white">{template.subject}</p>
          </div>
        ) : null}
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/70 px-4 py-4 text-sm text-white/80">
          <span className="text-xs uppercase tracking-wide text-white/40">Body</span>
          <p className="mt-2 whitespace-pre-line">{previewBody}</p>
        </div>
      </div>
    </div>
  );
}

