"use client";

import { useMemo, useState } from "react";
import { AlignLeft, Mail, MessageSquare, Smartphone, CheckCircle2, XCircle } from "lucide-react";

import { HelperText } from "@/components/ui/helper-text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StepActions } from "@/components/onboarding/step-actions";
import { TestDataButton } from "@/components/onboarding/test-data-button";
import { generateNotificationsData } from "@/lib/test-data-generator";
import { PLACEHOLDER_TOKENS } from "@/components/onboarding/constants";
import type { NotificationTemplate } from "@/lib/onboarding-context";
import { isNotificationsComingSoon } from "@/lib/feature-flags";

interface NotificationsStepProps {
  defaultValues: NotificationTemplate[];
  notificationsEnabled?: boolean;
  onNext: (values: NotificationTemplate[], notificationsEnabled: boolean) => Promise<void> | void;
  onBack: () => void;
}

// SMS disabled for v1 - only email notifications enabled
const CHANNEL_OPTIONS: Array<{ value: NotificationTemplate["channel"]; label: string; icon: JSX.Element }> =
  [
    { value: "email", label: "Email", icon: <Mail className="h-3.5 w-3.5" aria-hidden="true" /> },
    // { value: "sms", label: "SMS", icon: <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> }, // Disabled for v1
    // { value: "push", label: "Push", icon: <Smartphone className="h-3.5 w-3.5" aria-hidden="true" /> } // Disabled for v1
  ];

const TRIGGER_LABELS: Record<NotificationTemplate["trigger"], string> = {
  booking_created: "Booking created",
  booking_confirmed: "Booking confirmed",
  reminder_24h: "24-hour reminder",
  reminder_1h: "1-hour reminder",
  booking_canceled: "Booking canceled",
  booking_rescheduled: "Booking rescheduled",
  booking_completed: "Booking completed",
  fee_charged: "Fee charged",
  payment_issue: "Payment issue",
  refunded: "Refunded"
};

const CATEGORY_LABELS: Record<NotificationTemplate["category"], string> = {
  confirmation: "Confirmation",
  reminder: "Reminder",
  follow_up: "Follow up",
  cancellation: "Cancellation",
  reschedule: "Reschedule",
  completion: "Completion",
  fee: "Fee",
  payment_issue: "Payment issue",
  refund: "Refund"
};

const SAMPLE_DATA = {
  "${customer.name}": "Jordan Blake",
  "${service.name}": "Hydra Facial",
  "${service.duration}": "75 min",
  "${service.price}": "$180.00",
  "${booking.date}": "March 10, 2025",
  "${booking.time}": "3:00 PM",
  "${business.name}": "Studio Nova",
  "${booking.url}": "https://novastudio.main.tld/manage/NOV-2025-1042"
};

// Generate default empty templates for Pro Plan
function getDefaultTemplates(): NotificationTemplate[] {
  return [
    {
      id: `template-${Date.now()}-booking-created`,
      name: "Booking received",
      channel: "email",
      category: "confirmation",
      trigger: "booking_created",
      subject: "",
      body: "",
      enabled: true
    },
    {
      id: `template-${Date.now()}-booking-confirmed`,
      name: "Booking confirmed",
      channel: "email",
      category: "confirmation",
      trigger: "booking_confirmed",
      subject: "",
      body: "",
      enabled: true
    },
    {
      id: `template-${Date.now()}-reminder-24h`,
      name: "24 hour reminder",
      channel: "email",
      category: "reminder",
      trigger: "reminder_24h",
      subject: "",
      body: "",
      enabled: true
    },
    {
      id: `template-${Date.now()}-reminder-1h`,
      name: "1 hour reminder",
      channel: "email",
      category: "reminder",
      trigger: "reminder_1h",
      subject: "",
      body: "",
      enabled: true
    },
    {
      id: `template-${Date.now()}-booking-completed`,
      name: "Booking completed",
      channel: "email",
      category: "completion",
      trigger: "booking_completed",
      subject: "",
      body: "",
      enabled: true
    }
  ];
}

export function NotificationsStep({ defaultValues, notificationsEnabled: defaultNotificationsEnabled, onNext, onBack }: NotificationsStepProps) {
  // If coming soon, always default to Basic Plan (false) and skip template configuration
  const isComingSoon = isNotificationsComingSoon();
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(
    isComingSoon ? false : (defaultNotificationsEnabled === false ? false : null)
  );
  const [templates, setTemplates] = useState<NotificationTemplate[]>(defaultValues);
  const [expandedId, setExpandedId] = useState<string | null>(defaultValues[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ id: string; content: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleFillTestData = () => {
    const testData = generateNotificationsData();
    setTemplates(testData);
    setNotificationsEnabled(true);
    if (testData.length > 0) {
      setExpandedId(testData[0].id);
    }
    setError(null);
  };

  const handleTemplateChange = <K extends keyof NotificationTemplate>(
    templateId: string,
    key: K,
    value: NotificationTemplate[K]
  ) => {
    setTemplates((prev) =>
      prev.map((template) =>
        template.id === templateId ? { ...template, [key]: value } : template
      )
    );
  };

  const handlePlaceholderInsert = (templateId: string, token: string) => {
    setTemplates((prev) =>
      prev.map((template) =>
        template.id === templateId ? { ...template, body: `${template.body}${token}` } : template
      )
    );
  };

  const handleToggle = (templateId: string) => {
    setTemplates((prev) =>
      prev.map((template) =>
        template.id === templateId ? { ...template, enabled: !template.enabled } : template
      )
    );
  };

  const handlePreview = (template: NotificationTemplate) => {
    const content = template.body.replace(/\$\{[^}]+\}/g, (match) => {
      return SAMPLE_DATA[match as keyof typeof SAMPLE_DATA] ?? match;
    });
    setPreview({
      id: template.id,
      content
    });
  };

  const lintResults = useMemo(() => {
    return templates.reduce<Record<string, string | null>>((acc, template) => {
      const matches = template.body.match(/\$\{[^}]+\}/g) ?? [];
      const invalid = matches.filter((token) => !PLACEHOLDER_TOKENS.includes(token));
      if (invalid.length) {
        acc[template.id] = `Unknown placeholders: ${invalid.join(", ")}`;
      } else {
        acc[template.id] = null;
      }
      return acc;
    }, {});
  }, [templates]);

  const handleContinue = async () => {
    // If coming soon, always proceed with Basic Plan (no templates)
    if (isComingSoon) {
      setError(null);
      setIsSubmitting(true);
      try {
        await onNext([], false); // Basic Plan, no templates
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // If notifications enabled but not yet confirmed, require selection
    if (notificationsEnabled === null) {
      setError("Please select a subscription plan (Basic or Pro) to continue.");
      return;
    }

    // If notifications are disabled, skip validation and proceed
    if (notificationsEnabled === false) {
      setError(null);
      setIsSubmitting(true);
      try {
        await onNext([], false);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // If notifications enabled, validate templates
    const issues = Object.values(lintResults).filter(Boolean);
    if (issues.length) {
      setError("Fix placeholder errors before continuing.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onNext(templates, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8" aria-labelledby="notifications-step-heading">
      <header className="space-y-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary/90">
          <AlignLeft className="h-4 w-4" aria-hidden="true" />
          Step 8 · Notifications
        </span>
        <h2 id="notifications-step-heading" className="font-display text-3xl text-white">
          {isComingSoon
            ? "Notifications Coming Soon"
            : notificationsEnabled === null
            ? "Enable notifications and emails?"
            : "Make every message feel personal"}
        </h2>
        <p className="max-w-3xl text-base text-white/70">
          {isComingSoon
            ? "Automated email notifications are coming soon! Your booking system is fully functional without them. For now, you'll be on the Basic Plan."
            : notificationsEnabled === null
            ? "Would you like to enable email notifications for your booking flow? If enabled, you'll be able to send automated reminders, confirmations, and follow-ups to your clients."
            : "Templates support email notifications. Use placeholders to merge live booking data. We'll block unknown tokens so every send stays accurate."}
        </p>
      </header>

      {isComingSoon ? (
        <div className="space-y-4">
          {/* Coming Soon UI */}
          <div className="rounded-3xl border border-primary/30 bg-primary/10 p-8 text-center">
            <div className="space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary/50 bg-primary/10">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-white">Pro Plan - Coming Soon</h3>
                <p className="mt-2 text-lg text-primary/90">$21.99/month</p>
              </div>
              <p className="mx-auto max-w-md text-sm text-white/70">
                Automated email notifications are coming soon! 
                For now, you'll be on the Basic Plan. Your booking system is fully functional.
              </p>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => setNotificationsEnabled(false)}
                  className="inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-6 py-3 text-sm font-semibold text-white transition hover:border-primary/70 hover:bg-primary/15"
                >
                  Continue with Basic Plan ($11.99/month)
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Always show both plans - selected one highlighted, unselected greyed out */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  setNotificationsEnabled(true);
                  // Initialize templates if empty when Pro Plan is selected
                  if (templates.length === 0) {
                    const defaultTemplates = getDefaultTemplates();
                    setTemplates(defaultTemplates);
                    if (defaultTemplates.length > 0) {
                      setExpandedId(defaultTemplates[0].id);
                    }
                  }
                  setError(null);
                }}
                className={`flex w-full items-center gap-4 rounded-2xl border-2 p-6 text-left transition ${
                  notificationsEnabled === true
                    ? "border-primary/50 bg-primary/10 hover:border-primary/70 hover:bg-primary/15"
                    : "border-white/10 bg-white/5 opacity-50 hover:border-white/20 hover:bg-white/10 hover:opacity-70"
                }`}
              >
                {notificationsEnabled === true ? (
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                ) : (
                  <XCircle className="h-6 w-6 text-white/40" />
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Pro Plan</h3>
                    <span className={`text-xl font-bold ${notificationsEnabled === true ? "text-primary" : "text-white/60"}`}>
                      $21.99/month
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-white/70">
                    Send automated email notifications to clients for bookings, reminders, and updates.
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setNotificationsEnabled(false);
                  setTemplates([]); // Clear templates when switching to Basic Plan
                  setError(null);
                }}
                className={`flex w-full items-center gap-4 rounded-2xl border-2 p-6 text-left transition ${
                  notificationsEnabled === false
                    ? "border-primary/50 bg-primary/10 hover:border-primary/70 hover:bg-primary/15"
                    : "border-white/10 bg-white/5 opacity-50 hover:border-white/20 hover:bg-white/10 hover:opacity-70"
                }`}
              >
                {notificationsEnabled === false ? (
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                ) : (
                  <XCircle className="h-6 w-6 text-white/40" />
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Basic Plan</h3>
                    <span className={`text-xl font-bold ${notificationsEnabled === false ? "text-primary" : "text-white/60"}`}>
                      $11.99/month
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-white/70">
                    Clients will only see booking confirmation messages. No emails will be sent.
                  </p>
                </div>
              </button>
            </div>
          </div>
          
          {notificationsEnabled && (
            <>
        {templates.map((template) => (
          <div
            key={template.id}
            className="rounded-3xl border border-white/10 bg-white/5 p-6 transition"
          >
            <button
              type="button"
              onClick={() => setExpandedId((id) => (id === template.id ? null : template.id))}
              className="flex w-full items-center justify-between gap-4 text-left"
            >
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-white/60">
                  {CATEGORY_LABELS[template.category]}
                </p>
                <h3 className="text-lg font-semibold text-white">{template.name}</h3>
                <p className="text-xs text-white/50">{TRIGGER_LABELS[template.trigger]}</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                    template.enabled
                      ? "border border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
                      : "border border-white/15 bg-white/5 text-white/60"
                  }`}
                >
                  {CHANNEL_OPTIONS.find((option) => option.value === template.channel)?.icon}
                  {template.enabled ? "Enabled" : "Disabled"}
                </span>
                <span className="text-xs text-white/40">
                  {expandedId === template.id ? "Hide" : "Edit"}
                </span>
              </div>
            </button>

            {expandedId === template.id ? (
              <div className="mt-6 space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/60">
                      Channel
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {CHANNEL_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleTemplateChange(template.id, "channel", option.value)}
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium transition ${
                            template.channel === option.value
                              ? "border border-primary/50 bg-primary/15 text-white"
                              : "border border-white/15 bg-white/5 text-white/70 hover:border-white/25 hover:text-white"
                          }`}
                        >
                          {option.icon}
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/60">
                      Trigger
                    </label>
                    <select
                      value={template.trigger}
                      onChange={(event) =>
                        handleTemplateChange(
                          template.id,
                          "trigger",
                          event.target.value as NotificationTemplate["trigger"]
                        )
                      }
                      className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050F2C]"
                    >
                      {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {template.channel === "email" ? (
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/60">
                      Subject
                    </label>
                    <Input
                      value={template.subject ?? ""}
                      onChange={(event) =>
                        handleTemplateChange(template.id, "subject", event.target.value)
                      }
                      placeholder="Your booking is confirmed — no charge yet"
                    />
                  </div>
                ) : null}

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/60">
                    Message body
                  </label>
                  <Textarea
                    id={`template-body-${template.id}`}
                    rows={6}
                    value={template.body}
                    onChange={(event) =>
                      handleTemplateChange(template.id, "body", event.target.value)
                    }
                    error={lintResults[template.id] ?? undefined}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/60">
                    {PLACEHOLDER_TOKENS.map((token) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() => handlePlaceholderInsert(template.id, token)}
                        className="rounded-full border border-white/15 bg-white/5 px-3 py-1 font-semibold transition hover:border-primary/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                      >
                        {token}
                      </button>
                    ))}
                  </div>
                  {lintResults[template.id] ? (
                    <HelperText id={`${template.id}-error`} intent="error" className="mt-1" role="alert">
                      {lintResults[template.id]}
                    </HelperText>
                  ) : (
                    <HelperText className="mt-1">
                      Placeholders are replaced when notifications send. Preview uses sample data.
                    </HelperText>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handlePreview(template)}
                    className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-primary/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                  >
                    Preview with sample data
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggle(template.id)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                      template.enabled
                        ? "border border-emerald-400/70 bg-emerald-400/20 text-emerald-100 hover:bg-emerald-400/30"
                        : "border border-white/15 bg-white/5 text-white/70 hover:border-white/25 hover:text-white"
                    }`}
                  >
                    {template.enabled ? "Disable template" : "Enable template"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
          </>
          )}
        </div>
      )}

      {preview ? (
        <div className="rounded-3xl border border-primary/30 bg-primary/10 p-6 text-sm text-white/80">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">Preview</p>
          <pre className="mt-3 whitespace-pre-wrap text-white/90">{preview.content}</pre>
        </div>
      ) : null}

      {error ? (
        <HelperText intent="error" role="alert">
          {error}
        </HelperText>
      ) : null}

      <div className="mt-8 flex items-center justify-end gap-3">
        <TestDataButton onClick={handleFillTestData} />
      </div>

      <StepActions onBack={onBack} onNext={handleContinue} isSubmitting={isSubmitting} />
    </div>
  );
}





