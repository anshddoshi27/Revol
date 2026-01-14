"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { MapPin, Phone, Globe } from "lucide-react";
import { z } from "zod";

import { HelperText } from "@/components/ui/helper-text";
import { Input } from "@/components/ui/input";
import { StepActions } from "@/components/onboarding/step-actions";
import type { LocationContacts } from "@/lib/onboarding-context";

const timezoneRegex =
  /^(Africa|America|Antarctica|Arctic|Asia|Atlantic|Australia|Europe|Indian|Pacific)\/[A-Za-z0-9_\-+]+$/;

const locationSchema = z.object({
  timezone: z.string().regex(timezoneRegex, "Use a valid Olson timezone (e.g. America/New_York)."),
  phone: z
    .string()
    .min(8, "Phone number is required.")
    .regex(
      /^\+?[0-9 ()-]{7,20}$/,
      "Use an international phone format (e.g. +15550102030)."
    ),
  supportEmail: z.string().email("Enter a valid support email."),
  website: z
    .string()
    .url("Enter a valid URL, including https://")
    .optional()
    .or(z.literal("")),
  addressLine1: z.string().min(3, "Street address is required."),
  addressLine2: z.string().optional(),
  city: z.string().min(2, "City is required."),
  stateProvince: z.string().min(2, "State or province is required."),
  postalCode: z.string().min(3, "Postal code is required."),
  country: z.string().min(2, "Country is required.")
});

type LocationFormValues = z.infer<typeof locationSchema>;

interface LocationStepProps {
  defaultValues: LocationContacts;
  onNext: (values: LocationContacts) => Promise<void> | void;
  onBack: () => void;
}

const POPULAR_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Singapore",
  "Australia/Sydney"
];

export function LocationStep({ defaultValues, onNext, onBack }: LocationStepProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting }
  } = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues,
    mode: "onChange"
  });

  const handleContinue = (values: LocationFormValues) => {
    onNext({
      ...values,
      website: values.website || ""
    });
  };

  return (
    <form
      onSubmit={handleSubmit(handleContinue)}
      className="space-y-8"
      aria-labelledby="location-step-heading"
    >
      <header className="space-y-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary/90">
          <MapPin className="h-4 w-4" aria-hidden="true" />
          Step 3 · Location & contacts
        </span>
        <h2 id="location-step-heading" className="font-display text-3xl text-white">
          Where do customers find you?
        </h2>
        <p className="max-w-xl text-base text-white/70">
          These details power your booking header, reminders, and receipts. Timezone controls
          slot generation and policy cutoffs.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-white/80" htmlFor="location-timezone">
            Timezone
          </label>
          <input
            id="location-timezone"
            list="timezone-suggestions"
            placeholder="America/New_York"
            className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white shadow-inner placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050F2C]"
            {...register("timezone")}
            aria-describedby={
              errors.timezone?.message ? "location-timezone-error" : "location-timezone-helper"
            }
          />
          <datalist id="timezone-suggestions">
            {POPULAR_TIMEZONES.map((tz) => (
              <option key={tz} value={tz} />
            ))}
          </datalist>
          <HelperText id="location-timezone-helper" className="mt-2">
            Must match an Olson timezone. Determines how slots are displayed to customers.
          </HelperText>
          {errors.timezone?.message ? (
            <HelperText id="location-timezone-error" intent="error" className="mt-1" role="alert">
              {errors.timezone.message}
            </HelperText>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-white/80" htmlFor="location-phone">
            Phone
          </label>
          <Input
            id="location-phone"
            placeholder="+1 555 010 2030"
            {...register("phone")}
            error={errors.phone?.message}
            aria-describedby={
              errors.phone?.message ? "location-phone-error" : "location-phone-helper"
            }
          />
          <HelperText id="location-phone-helper" className="mt-2">
            Shown on the booking site header and reminders.
          </HelperText>
          {errors.phone?.message ? (
            <HelperText id="location-phone-error" intent="error" className="mt-1" role="alert">
              {errors.phone.message}
            </HelperText>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-white/80" htmlFor="location-email">
            Support email
          </label>
          <Input
            id="location-email"
            type="email"
            placeholder="hello@studionova.com"
            {...register("supportEmail")}
            error={errors.supportEmail?.message}
            aria-describedby={
              errors.supportEmail?.message ? "location-email-error" : "location-email-helper"
            }
          />
          <HelperText id="location-email-helper" className="mt-2">
            Customers reply here for reschedules or questions.
          </HelperText>
          {errors.supportEmail?.message ? (
            <HelperText id="location-email-error" intent="error" className="mt-1" role="alert">
              {errors.supportEmail.message}
            </HelperText>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-white/80" htmlFor="location-website">
            Website (optional)
          </label>
          <Input
            id="location-website"
            placeholder="https://studionova.com"
            {...register("website")}
            error={errors.website?.message}
            aria-describedby={
              errors.website?.message ? "location-website-error" : "location-website-helper"
            }
          />
          <HelperText id="location-website-helper" className="mt-2">
            Link shown in footer of your booking site.
          </HelperText>
          {errors.website?.message ? (
            <HelperText id="location-website-error" intent="error" className="mt-1" role="alert">
              {errors.website.message}
            </HelperText>
          ) : null}
        </div>

        <div className="lg:col-span-2">
          <label className="mb-2 block text-sm font-medium text-white/80" htmlFor="location-address1">
            Street address
          </label>
          <Input
            id="location-address1"
            placeholder="248 Wythe Ave"
            {...register("addressLine1")}
            error={errors.addressLine1?.message}
            aria-describedby={
              errors.addressLine1?.message ? "location-address1-error" : "location-address1-helper"
            }
          />
          <HelperText id="location-address1-helper" className="mt-2">
            Used for map links and receipts.
          </HelperText>
          {errors.addressLine1?.message ? (
            <HelperText id="location-address1-error" intent="error" className="mt-1" role="alert">
              {errors.addressLine1.message}
            </HelperText>
          ) : null}
        </div>

        <div className="lg:col-span-2">
          <Input
            id="location-address2"
            placeholder="Suite or unit (optional)"
            {...register("addressLine2")}
          />
        </div>

        <div>
          <Input
            id="location-city"
            placeholder="Brooklyn"
            {...register("city")}
            error={errors.city?.message}
            aria-describedby={
              errors.city?.message ? "location-city-error" : "location-city-helper"
            }
          />
          <HelperText id="location-city-helper" className="mt-2">
            City displayed on booking site hero.
          </HelperText>
          {errors.city?.message ? (
            <HelperText id="location-city-error" intent="error" className="mt-1" role="alert">
              {errors.city.message}
            </HelperText>
          ) : null}
        </div>

        <div>
          <Input
            id="location-state"
            placeholder="NY"
            {...register("stateProvince")}
            error={errors.stateProvince?.message}
            aria-describedby={
              errors.stateProvince?.message ? "location-state-error" : "location-state-helper"
            }
          />
          <HelperText id="location-state-helper" className="mt-2">
            State or province abbreviation works great.
          </HelperText>
          {errors.stateProvince?.message ? (
            <HelperText id="location-state-error" intent="error" className="mt-1" role="alert">
              {errors.stateProvince.message}
            </HelperText>
          ) : null}
        </div>

        <div>
          <Input
            id="location-postal"
            placeholder="11249"
            {...register("postalCode")}
            error={errors.postalCode?.message}
            aria-describedby={
              errors.postalCode?.message ? "location-postal-error" : "location-postal-helper"
            }
          />
          <HelperText id="location-postal-helper" className="mt-2">
            Used for receipts and analytics.
          </HelperText>
          {errors.postalCode?.message ? (
            <HelperText id="location-postal-error" intent="error" className="mt-1" role="alert">
              {errors.postalCode.message}
            </HelperText>
          ) : null}
        </div>

        <div>
          <Input
            id="location-country"
            placeholder="United States"
            {...register("country")}
            error={errors.country?.message}
            aria-describedby={
              errors.country?.message ? "location-country-error" : "location-country-helper"
            }
          />
          <HelperText id="location-country-helper" className="mt-2">
            Full country name preferred for international SMS formatting.
          </HelperText>
          {errors.country?.message ? (
            <HelperText id="location-country-error" intent="error" className="mt-1" role="alert">
              {errors.country.message}
            </HelperText>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/70">
        <p className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" aria-hidden="true" />
          This info feeds your booking site header, policies modal, and upcoming notifications.
        </p>
      </div>

      <StepActions
        onBack={onBack}
        onNext={handleSubmit(handleContinue)}
        isNextDisabled={!isValid}
        isSubmitting={isSubmitting}
      />
    </form>
  );
}


