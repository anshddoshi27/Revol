"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Camera, Palette, Sparkle, Trash2 } from "lucide-react";

import { HelperText } from "@/components/ui/helper-text";
import { StepActions } from "@/components/onboarding/step-actions";
import { TestDataButton } from "@/components/onboarding/test-data-button";
import { generateBrandingData } from "@/lib/test-data-generator";
import type { BrandingConfig, ServiceCategory } from "@/lib/onboarding-context";
import type { BusinessBasics } from "@/lib/onboarding-context";

interface BrandingStepProps {
  defaultValues: BrandingConfig;
  business: BusinessBasics;
  categories: ServiceCategory[];
  onNext: (values: BrandingConfig) => Promise<void> | void;
  onBack: () => void;
}

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_SIZE_MB = 4;
const TARGET_RATIO = 3 / 4; // portrait-first for mobile preview
const RATIO_TOLERANCE = 0.2;

export function BrandingStep({
  defaultValues,
  business,
  categories,
  onNext,
  onBack
}: BrandingStepProps) {
  const [logoPreview, setLogoPreview] = useState<string | undefined>(defaultValues.logoUrl);
  const [logoName, setLogoName] = useState<string | undefined>(defaultValues.logoName);
  const [primaryColor, setPrimaryColor] = useState(defaultValues.primaryColor);
  const [ratioWarning, setRatioWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Upload PNG, JPG, WEBP, or SVG files.");
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Keep the logo under ${MAX_SIZE_MB}MB.`);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const ratio = img.width / img.height;
      if (Math.abs(ratio - TARGET_RATIO) > RATIO_TOLERANCE) {
        setRatioWarning(
          "For the best phone preview, aim for a portrait logo around 960 × 1280px or similar ratio."
        );
      } else {
        setRatioWarning(null);
      }
      setLogoPreview(objectUrl);
      setLogoName(file.name);
      setError(null);
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  };

  const handleRemoveLogo = () => {
    setLogoPreview(undefined);
    setLogoName(undefined);
    setRatioWarning(null);
  };
  
  const handleFillTestData = () => {
    const testData = generateBrandingData();
    setPrimaryColor(testData.primaryColor);
    // Note: Logo would need to be uploaded separately
  };

  const handleContinue = () => {
    onNext({
      primaryColor,
      logoUrl: logoPreview,
      logoName,
      recommendedDimensions: defaultValues.recommendedDimensions
    });
  };

  useEffect(() => {
    if (!logoPreview) {
      setRatioWarning(null);
    }
  }, [logoPreview]);

  const previewCategories = useMemo(() => {
    if (!categories.length) {
      return [
        {
          id: "sample-1",
          name: "Featured",
          color: primaryColor,
          services: [
            {
              id: "sample-service-1",
              name: "Signature Cut",
              durationMinutes: 60,
              priceCents: 12000
            },
            {
              id: "sample-service-2",
              name: "Hydra Facial",
              durationMinutes: 75,
              priceCents: 18000
            }
          ]
        }
      ];
    }

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color || primaryColor,
      services: category.services.length
        ? category.services
        : [
            {
              id: `${category.id}-placeholder`,
              name: "Add services to this category",
              durationMinutes: 0,
              priceCents: 0
            }
          ]
    }));
  }, [categories, primaryColor]);

  return (
    <div className="space-y-8" aria-labelledby="branding-step-heading">
      <header className="space-y-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary/90">
          <Palette className="h-4 w-4" aria-hidden="true" />
          Step 5 · Branding
        </span>
        <h2 id="branding-step-heading" className="font-display text-3xl text-white">
          Set the vibe for your booking page
        </h2>
        <p className="max-w-xl text-base text-white/70">
          Upload a portrait-friendly logo and choose a theme color. This preview mirrors what
          customers see on phone-first layouts, then gracefully scales to desktop.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[360px,1fr]">
        <div className="space-y-6">
          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-white/80">Logo</legend>
            <label
              htmlFor="branding-logo"
              className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-white/20 bg-white/5 px-6 py-10 text-center text-sm text-white/60 transition hover:border-primary/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              <Camera className="mb-3 h-6 w-6 text-primary" aria-hidden="true" />
              {logoPreview ? (
                <>
                  <span className="text-white">{logoName}</span>
                  <span>Tap to replace</span>
                </>
              ) : (
                <>
                  <span className="text-white">Upload logo (PNG, JPG, WEBP, SVG)</span>
                  <span>Portrait 960 × 1280px works best</span>
                </>
              )}
              <input
                id="branding-logo"
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                className="sr-only"
                onChange={handleFileChange}
              />
            </label>
            <HelperText className="mt-2">
              Prioritize mobile clarity. We’ll keep sharp rendering for larger screens too.
            </HelperText>
            {error ? (
              <HelperText intent="error" className="mt-1" role="alert">
                {error}
              </HelperText>
            ) : null}
            {ratioWarning ? (
              <HelperText intent="warning" className="mt-1">
                {ratioWarning}
              </HelperText>
            ) : null}
            {logoPreview ? (
              <button
                type="button"
                onClick={handleRemoveLogo}
                className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-white/70 transition hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Remove logo
              </button>
            ) : null}
          </fieldset>

          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-white/80">Theme color</legend>
            <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(event) => setPrimaryColor(event.target.value)}
                className="h-14 w-16 cursor-pointer rounded-2xl border border-white/10 bg-transparent"
                aria-label="Select primary theme color"
              />
              <div>
                <p className="font-semibold text-white">{primaryColor.toUpperCase()}</p>
                <p className="text-xs text-white/60">
                  Applied to buttons, badges, and slot accents across booking flows.
                </p>
              </div>
            </div>
          </fieldset>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 lg:p-8">
          <div className="mx-auto w-full max-w-sm rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-lg shadow-black/40">
            <div className="flex flex-col items-center gap-4">
              <div
                className="relative h-32 w-32 overflow-hidden rounded-3xl border border-white/10 bg-white/10"
                style={{ boxShadow: `0 12px 24px -12px ${primaryColor}55` }}
              >
                {logoPreview ? (
                  <Image
                    src={logoPreview}
                    alt="Logo preview"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-xs text-white/40">
                    <Sparkle className="mb-2 h-4 w-4 text-white/40" aria-hidden="true" />
                    Your logo
                  </div>
                )}
              </div>
              <div className="text-center">
                <h3 className="font-display text-2xl text-white">{business.businessName || "Your business name"}</h3>
                <p className="mt-2 text-sm text-white/60">
                  {business.description || "Add a short description in Business basics to showcase what you do."}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {previewCategories.map((category) => (
                <div key={category.id}>
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="text-xs font-semibold uppercase tracking-wide text-white/60">
                      {category.name}
                    </span>
                  </div>
                  <div className="grid gap-3">
                    {category.services.map((service) => (
                      <div
                        key={service.id}
                        className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3"
                        style={{ borderColor: `${primaryColor}33` }}
                      >
                        <div className="flex items-center justify-between text-sm text-white/90">
                          <span className="font-medium">{service.name}</span>
                          <span className="text-white/60">
                            {service.durationMinutes
                              ? `${service.durationMinutes} min`
                              : "Configure services"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-white/50">
                          {service.priceCents
                            ? `$${(service.priceCents / 100).toFixed(2)}`
                            : "Add pricing in Services & Categories"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-end gap-3">
        <TestDataButton onClick={handleFillTestData} />
      </div>

      <StepActions onBack={onBack} onNext={handleContinue} />
    </div>
  );
}


