"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Globe2, LinkIcon, ShieldAlert } from "lucide-react";
import { z } from "zod";

import { HelperText } from "@/components/ui/helper-text";
import { Input } from "@/components/ui/input";
import { StepActions } from "@/components/onboarding/step-actions";
import { RESERVED_SUBDOMAINS } from "@/components/onboarding/constants";
import type { WebsiteConfig } from "@/lib/onboarding-context";

const subdomainRegex = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/;

const websiteSchema = z.object({
  subdomain: z
    .string()
    .min(3, "Subdomain must be at least 3 characters.")
    .max(63, "Subdomain must be under 63 characters.")
    .regex(subdomainRegex, "Use lowercase letters, numbers, and hyphens (no leading/trailing hyphen).")
});

type WebsiteFormValues = z.infer<typeof websiteSchema>;

interface WebsiteStepProps {
  defaultValues: WebsiteConfig;
  onNext: (values: WebsiteConfig) => Promise<void> | void;
  onBack: () => void;
}

const reservedSet = new Set(RESERVED_SUBDOMAINS);

export function WebsiteStep({ defaultValues, onNext, onBack }: WebsiteStepProps) {
  const [status, setStatus] = useState<WebsiteConfig["status"]>(
    defaultValues.status ?? "idle"
  );
  const [message, setMessage] = useState<string | undefined>(defaultValues.message);
  const [isChecking, setIsChecking] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isValid }
  } = useForm<WebsiteFormValues>({
    resolver: zodResolver(websiteSchema),
    defaultValues,
    mode: "onChange"
  });

  const subdomain = watch("subdomain");

  useEffect(() => {
    if (!subdomain || !websiteSchema.shape.subdomain.safeParse(subdomain).success) {
      setStatus("idle");
      setMessage(undefined);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      if (controller.signal.aborted) return;
      setIsChecking(true);
      // simulate API validation + reservation
      const normalized = subdomain.toLowerCase();

      if (reservedSet.has(normalized)) {
        setStatus("error");
        setMessage("This subdomain is reserved. Try another option.");
      } else {
        setStatus("reserved");
        setMessage(`Great! ${normalized}.tithi.com is available and held for the next session.`);
      }
      setIsChecking(false);
    }, 650);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [subdomain]);

  const bookingPreview = useMemo(() => {
    if (!subdomain) return "https://yourbusiness.tithi.com";
    return `https://${subdomain.toLowerCase()}.tithi.com`;
  }, [subdomain]);

  const handleContinue = (values: WebsiteFormValues) => {
    const payload: WebsiteConfig = {
      subdomain: values.subdomain.toLowerCase(),
      status,
      message
    };
    onNext(payload);
  };

  const helperCopy =
    status === "reserved"
      ? message
      : "Choose the URL customers will visit. We’ll provision the subdomain when you go live.";

  return (
    <form
      onSubmit={handleSubmit(handleContinue)}
      className="space-y-8"
      aria-labelledby="website-step-heading"
    >
      <header className="space-y-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary/90">
          <Globe2 className="h-4 w-4" aria-hidden="true" />
          Step 2 · Booking website
        </span>
        <h2 id="website-step-heading" className="font-display text-3xl text-white">
          Claim your booking URL
        </h2>
        <p className="max-w-xl text-base text-white/70">
          Customers will book at your own branded subdomain. We’ll block off reserved or
          disallowed words automatically.
        </p>
      </header>

      <div className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-white/80" htmlFor="website-subdomain">
            Subdomain
          </label>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex-1">
              <Input
                id="website-subdomain"
                placeholder="novastudio"
                {...register("subdomain")}
                error={errors.subdomain?.message ?? (status === "error" ? message : undefined)}
                aria-describedby={
                  errors.subdomain?.message || status === "error"
                    ? "website-subdomain-error"
                    : "website-subdomain-helper"
                }
              />
            </div>
            <span className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
              .tithi.com
            </span>
          </div>
          <HelperText
            id="website-subdomain-helper"
            className="mt-2"
            intent={status === "reserved" ? "success" : undefined}
          >
            {helperCopy}
          </HelperText>
          {errors.subdomain?.message || status === "error" ? (
            <HelperText id="website-subdomain-error" intent="error" className="mt-1" role="alert">
              {errors.subdomain?.message ?? message}
            </HelperText>
          ) : null}
          {status === "reserved" ? (
            <HelperText intent="success" className="mt-1">
              We’ll hold this slug for you during onboarding. It becomes live at Go Live.
            </HelperText>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
          <div className="flex flex-col gap-3 text-sm text-white/70 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-primary" aria-hidden="true" />
              Preview:
              <span className="font-medium text-white">{bookingPreview}</span>
            </p>
            <p className="text-xs text-white/50">
              You can change this until Go Live. After launch, contact support to reissue.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
            <p>
              Avoid restricted terms like “admin” or “support.” Subdomains must start and end
              with a letter or number and can only include lowercase characters and hyphens.
            </p>
          </div>
        </div>
      </div>

      <StepActions
        onBack={onBack}
        onNext={handleSubmit(handleContinue)}
        isNextDisabled={!isValid || status !== "reserved" || isChecking}
        isSubmitting={isSubmitting || isChecking}
      />
    </form>
  );
}



