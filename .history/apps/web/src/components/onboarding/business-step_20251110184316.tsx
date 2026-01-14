"use client";

import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Building2, Sparkles } from "lucide-react";
import { z } from "zod";

import { HelperText } from "@/components/ui/helper-text";
import { Input } from "@/components/ui/input";
import { StepActions } from "@/components/onboarding/step-actions";
import type { BusinessBasics } from "@/lib/onboarding-context";

const businessSchema = z.object({
  businessName: z.string().min(2, "Business name must be at least 2 characters."),
  description: z
    .string()
    .min(10, "Add a brief description (at least 10 characters).")
    .max(240, "Keep the description under 240 characters."),
  doingBusinessAs: z
    .string()
    .min(2, "DBA must be at least 2 characters.")
    .max(80, "Keep DBA under 80 characters."),
  legalName: z.string().min(2, "Legal name is required."),
  industry: z.string().min(2, "Select or enter an industry.")
});

export type BusinessFormValues = z.infer<typeof businessSchema>;

interface BusinessStepProps {
  defaultValues: BusinessBasics;
  onNext: (values: BusinessFormValues) => Promise<void> | void;
  onBack?: () => void;
}

const INDUSTRY_SUGGESTIONS = [
  "Salon",
  "Spa",
  "Med Spa",
  "Clinic",
  "Studio",
  "Fitness",
  "Tattoo",
  "Wellness"
];

export function BusinessStep({ defaultValues, onNext, onBack }: BusinessStepProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
    watch
  } = useForm<BusinessFormValues>({
    resolver: zodResolver(businessSchema),
    mode: "onChange",
    defaultValues
  });

  const remainingCharacters = useMemo(() => {
    const description = watch("description") ?? "";
    return 240 - description.length;
  }, [watch]);

  return (
    <form
      onSubmit={handleSubmit(onNext)}
      className="space-y-8"
      aria-labelledby="business-step-heading"
    >
      <header className="space-y-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary/90">
          <Building2 className="h-4 w-4" aria-hidden="true" />
          Step 1 · Business basics
        </span>
        <h2 id="business-step-heading" className="font-display text-3xl text-white">
          Tell us about your business
        </h2>
        <p className="max-w-xl text-base text-white/70">
          This is the identity bookers will see on your booking site and in notifications.
          We’ll use the legal name for billing and Stripe onboarding.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-white/80" htmlFor="business-name">
            Business name
          </label>
          <Input
            id="business-name"
            placeholder="Studio Nova"
            {...register("businessName")}
            error={errors.businessName?.message}
            aria-describedby={
              errors.businessName?.message ? "business-name-error" : "business-name-helper"
            }
          />
          <HelperText id="business-name-helper" className="mt-2">
            Appears on your booking site header and notifications.
          </HelperText>
          {errors.businessName?.message ? (
            <HelperText id="business-name-error" intent="error" className="mt-1" role="alert">
              {errors.businessName.message}
            </HelperText>
          ) : null}
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-white/80" htmlFor="business-desc">
            Description
          </label>
          <textarea
            id="business-desc"
            rows={3}
            className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white shadow-inner placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050F2C]"
            placeholder="Modern aesthetics studio specializing in skin, hair, and relaxation treatments."
            {...register("description")}
            aria-describedby={
              errors.description?.message ? "business-desc-error" : "business-desc-helper"
            }
          />
          <div className="mt-2 flex items-center justify-between">
            <HelperText id="business-desc-helper">
              Summarize what makes your business unique. Shown on the booking page.
            </HelperText>
            <span className="text-xs text-white/40">{remainingCharacters} characters left</span>
          </div>
          {errors.description?.message ? (
            <HelperText id="business-desc-error" intent="error" className="mt-1" role="alert">
              {errors.description.message}
            </HelperText>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-white/80" htmlFor="business-dba">
            DBA
          </label>
          <Input
            id="business-dba"
            placeholder="Studio Nova"
            {...register("doingBusinessAs")}
            error={errors.doingBusinessAs?.message}
            aria-describedby={
              errors.doingBusinessAs?.message ? "business-dba-error" : "business-dba-helper"
            }
          />
          <HelperText id="business-dba-helper" className="mt-2">
            Doing business as — used for receipts.
          </HelperText>
          {errors.doingBusinessAs?.message ? (
            <HelperText id="business-dba-error" intent="error" className="mt-1" role="alert">
              {errors.doingBusinessAs.message}
            </HelperText>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-white/80" htmlFor="business-legal">
            Legal business name
          </label>
          <Input
            id="business-legal"
            placeholder="Studio Nova LLC"
            {...register("legalName")}
            error={errors.legalName?.message}
            aria-describedby={
              errors.legalName?.message ? "business-legal-error" : "business-legal-helper"
            }
          />
          <HelperText id="business-legal-helper" className="mt-2">
            Matches your paperwork for Stripe and billing.
          </HelperText>
          {errors.legalName?.message ? (
            <HelperText id="business-legal-error" intent="error" className="mt-1" role="alert">
              {errors.legalName.message}
            </HelperText>
          ) : null}
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-white/80" htmlFor="business-industry">
            Industry
          </label>
          <input
            id="business-industry"
            list="industry-suggestions"
            placeholder="Select or type"
            className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white shadow-inner placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050F2C]"
            {...register("industry")}
            aria-describedby={
              errors.industry?.message ? "business-industry-error" : "business-industry-helper"
            }
          />
          <datalist id="industry-suggestions">
            {INDUSTRY_SUGGESTIONS.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
          <HelperText id="business-industry-helper" className="mt-2">
            Helps tailor future templates and analytics.
          </HelperText>
          {errors.industry?.message ? (
            <HelperText
              id="business-industry-error"
              intent="error"
              className="mt-1"
              role="alert"
            >
              {errors.industry.message}
            </HelperText>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
        <div className="flex items-start gap-3 text-sm text-white/70">
          <Sparkles className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
          <p>
            Once onboarding is complete we’ll create your business workspace and link it to
            this owner account. Owners can add more team members for scheduling but only you
            can sign in.
          </p>
        </div>
      </div>

      <StepActions
        onBack={onBack}
        onNext={handleSubmit(onNext)}
        isNextDisabled={!isValid}
        isSubmitting={isSubmitting}
        showBack={Boolean(onBack)}
      />
    </form>
  );
}


