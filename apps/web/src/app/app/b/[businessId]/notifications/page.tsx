"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/ui/helper-text";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClientClient } from "@/lib/supabase-client";
import { isNotificationsEnabled } from "@/lib/feature-flags";

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

interface NotificationTemplate {
  id: string;
  name: string;
  channel: 'email' | 'sms';
  category: string;
  trigger: string;
  subject?: string | null;
  body: string;
  enabled: boolean;
}

export default function NotificationsPage() {
  const params = useParams<{ businessId: string }>();
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [previewTemplate, setPreviewTemplate] = useState<NotificationTemplate | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const supabase = createClientClient();
  const saveTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  // Fetch notifications_enabled and templates from database
  useEffect(() => {
    async function fetchData() {
      if (!params.businessId) return;
      
      try {
        // Fetch notifications_enabled
        const { data: businessData, error: businessError } = await supabase
          .from('businesses')
          .select('notifications_enabled')
          .eq('id', params.businessId)
          .single();

        if (!businessError && businessData) {
          setNotificationsEnabled(businessData.notifications_enabled ?? false);
        } else {
          setNotificationsEnabled(false);
        }

        // Fetch templates directly from Supabase (more reliable than API route)
        const { data: templatesData, error: templatesError } = await supabase
          .from('notification_templates')
          .select('*')
          .eq('business_id', params.businessId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (templatesError) {
          console.error('Error fetching templates:', templatesError);
          // Fallback: try API route with credentials
          try {
            const response = await fetch(`/api/admin/notifications/templates`, {
              credentials: 'include',
            });
            if (response.ok) {
              const data = await response.json();
              // Filter out SMS templates - only show email templates for v1
              const mappedTemplates: NotificationTemplate[] = (data.templates || [])
                .filter((t: any) => t.channel === 'email') // Only show email templates
                .map((t: any) => ({
                  id: t.id,
                  name: t.name,
                  channel: t.channel,
                  category: t.category,
                  trigger: t.trigger,
                  subject: t.subject,
                  body: t.body_markdown || t.body || '',
                  enabled: t.is_enabled !== false,
                }));
              setTemplates(mappedTemplates);
            } else {
              console.error('Failed to fetch templates from API:', await response.text());
            }
          } catch (apiError) {
            console.error('Error fetching templates from API:', apiError);
          }
        } else {
          // Filter out SMS templates - only show email templates for v1
          // Map database format to component format
          const mappedTemplates: NotificationTemplate[] = (templatesData || [])
            .filter((t: any) => t.channel === 'email') // Only show email templates
            .map((t: any) => ({
              id: t.id,
              name: t.name,
              channel: t.channel,
              category: t.category,
              trigger: t.trigger,
              subject: t.subject,
              body: t.body_markdown || t.body || '',
              enabled: t.is_enabled !== false,
            }));
          setTemplates(mappedTemplates);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setNotificationsEnabled(false);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [params.businessId, supabase]);

  // Update template locally (immediate UI update)
  const updateTemplateLocal = (templateId: string, updater: (template: NotificationTemplate) => NotificationTemplate) => {
    setTemplates(prevTemplates => 
      prevTemplates.map(template => 
        template.id === templateId ? updater(template) : template
      )
    );
  };

  // Save template to database (debounced for text inputs, immediate for toggles)
  const saveTemplate = async (templateId: string, immediate = false) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    // Clear existing timeout for this template
    if (saveTimeouts.current[templateId]) {
      clearTimeout(saveTimeouts.current[templateId]);
      delete saveTimeouts.current[templateId];
    }

    const performSave = async () => {
      setSaving(prev => ({ ...prev, [templateId]: true }));

      try {
        console.log(`[notifications] Saving template ${templateId}`);
        
        // Update directly via Supabase client (uses user's session from cookies)
        const { data: updatedData, error: updateError } = await supabase
          .from('notification_templates')
          .update({
            name: template.name,
            channel: template.channel,
            category: template.category,
            trigger: template.trigger,
            subject: template.subject,
            body_markdown: template.body,
            is_enabled: template.enabled,
            updated_at: new Date().toISOString(),
          })
          .eq('id', templateId)
          .eq('business_id', params.businessId)
          .select()
          .single();

        if (updateError) {
          console.error('[notifications] Error updating template via Supabase:', updateError);
          alert(`Failed to save template: ${updateError.message || 'Unknown error'}. Please try again.`);
        } else {
          console.log('[notifications] Template saved successfully via Supabase', updatedData);
          // Update state with server response to ensure consistency
          if (updatedData) {
            setTemplates(prevTemplates => 
              prevTemplates.map(t => 
                t.id === templateId 
                  ? { ...t, enabled: updatedData.is_enabled !== false }
                  : t
              )
            );
          }
        }
      } catch (error) {
        console.error('[notifications] Error saving template:', error);
        alert(`Failed to save template: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
      } finally {
        setSaving(prev => ({ ...prev, [templateId]: false }));
      }
    };

    if (immediate) {
      // For toggles, save immediately
      await performSave();
    } else {
      // For text inputs, debounce by 1 second
      saveTimeouts.current[templateId] = setTimeout(performSave, 1000);
    }
  };

  // Combined function for updating template (used by inputs)
  const updateTemplate = (templateId: string, updater: (template: NotificationTemplate) => NotificationTemplate) => {
    updateTemplateLocal(templateId, updater);
    saveTemplate(templateId, false); // Debounced save
  };

  // Combined function for toggling enabled state (immediate save)
  const toggleTemplateEnabled = (templateId: string) => {
    updateTemplateLocal(templateId, (prev) => ({ ...prev, enabled: !prev.enabled }));
    saveTemplate(templateId, true); // Immediate save
  };

  if (loading) {
    return (
      <div className="space-y-10">
        <header className="space-y-4">
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">Messaging</p>
          <h1 className="font-display text-4xl text-white">Notifications</h1>
        </header>
        <div className="rounded-3xl border border-white/15 bg-black/80 p-8 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-white/60" />
          <p className="mt-4 text-sm text-white/60">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if notifications feature is disabled globally
  const notificationsFeatureEnabled = isNotificationsEnabled();
  
  if (!notificationsFeatureEnabled) {
    return (
      <div className="space-y-10">
        <header className="space-y-4">
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">Messaging</p>
          <h1 className="font-display text-4xl text-white">Notifications</h1>
        </header>
        <div className="rounded-3xl border border-primary/30 bg-primary/10 p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary/50 bg-primary/10 mb-4">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <p className="text-lg font-semibold text-white">Coming Soon</p>
          <p className="mt-2 text-sm text-white/70">
            Email notifications are coming soon! Your booking system is fully functional without them.
          </p>
          <p className="mt-4 text-sm text-white/60">
            Customers can book appointments and you can manage them in the admin. Automated notifications will be available in a future update.
          </p>
        </div>
      </div>
    );
  }

  // Check if notifications are enabled for this business (Basic Plan = false, Pro Plan = true)
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
            Your account is on the Basic Plan ($11.99/month). Email notifications are not included.
          </p>
          <p className="mt-4 text-sm text-white/60">
            Only booking confirmation messages are shown to clients. To enable automated email notifications, 
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

  // Pro Plan - show templates
  if (templates.length === 0) {
    return (
      <div className="space-y-10">
        <header className="space-y-4">
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">Messaging</p>
          <h1 className="font-display text-4xl text-white">Notifications</h1>
          <p className="max-w-3xl text-sm text-white/60">
            Email templates merge these placeholders at send time. Customize copy and preview with sample booking data.
          </p>
        </header>
        <div className="rounded-3xl border border-white/15 bg-black/80 p-8 text-center">
          <p className="text-lg font-semibold text-white">No Notification Templates</p>
          <p className="mt-2 text-sm text-white/70">
            You haven't created any notification templates yet. Templates are created during onboarding.
          </p>
          <p className="mt-4 text-sm text-white/60">
            To create templates, go back to the onboarding flow or contact support.
          </p>
        </div>
      </div>
    );
  }

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
        {templates.map((template) => (
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
                disabled={saving[template.id]}
                onClick={() => toggleTemplateEnabled(template.id)}
              >
                {saving[template.id] ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  template.enabled ? "Enabled" : "Disabled"
                )}
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
              <Button 
                type="button" 
                variant="ghost" 
                disabled={saving[template.id]}
                onClick={() => setPreviewTemplate(template)}
              >
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
    .replaceAll("${booking.url}", "https://novastudio.main.tld/booking/preview");

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
