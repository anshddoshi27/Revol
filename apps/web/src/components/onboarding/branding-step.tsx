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
const TARGET_RATIO = 3 / 4; // portrait-first for mobile preview (width/height)
const RATIO_TOLERANCE = 0.2; // Maximum deviation from target ratio
const MIN_WIDTH = 200; // Minimum width in pixels
const MIN_HEIGHT = 200; // Minimum height in pixels

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
  const [objectUrlRef, setObjectUrlRef] = useState<string | null>(null);

  // Clean up object URLs on unmount or when logo changes
  useEffect(() => {
    return () => {
      if (objectUrlRef) {
        URL.revokeObjectURL(objectUrlRef);
      }
    };
  }, [objectUrlRef]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Clear previous errors
    setError(null);
    setRatioWarning(null);

    // Validate file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Invalid file format. Please upload PNG, JPG, WEBP, or SVG files only.");
      event.target.value = ""; // Reset input
      return;
    }

    // Validate file size
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File size too large. Please keep the logo under ${MAX_SIZE_MB}MB.`);
      event.target.value = ""; // Reset input
      return;
    }

    // Clean up previous object URL if exists
    if (objectUrlRef) {
      URL.revokeObjectURL(objectUrlRef);
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    
    img.onload = () => {
      // Validate minimum dimensions
      if (img.width < MIN_WIDTH || img.height < MIN_HEIGHT) {
        const errorMsg = `Image too small. Minimum dimensions are ${MIN_WIDTH} × ${MIN_HEIGHT}px. Your image is ${img.width} × ${img.height}px.`;
        setError(errorMsg);
        setRatioWarning(null);
        URL.revokeObjectURL(objectUrl);
        event.target.value = ""; // Reset input
        return;
      }

      const ratio = img.width / img.height;
      const ratioDiff = Math.abs(ratio - TARGET_RATIO);
      
      // Reject images that are too far from the target ratio (portrait orientation)
      // Portrait means height > width, so ratio should be < 1
      if (ratio >= 1) {
        const errorMsg = `Invalid orientation. Logo must be portrait-oriented (height greater than width). Your image is ${img.width} × ${img.height}px (landscape or square). Please use a portrait image with approximately 3:4 ratio (like 960 × 1280px).`;
        setError(errorMsg);
        setRatioWarning(null);
        URL.revokeObjectURL(objectUrl);
        event.target.value = ""; // Reset input
        return;
      }

      // Reject if ratio is too far from target (more than tolerance)
      if (ratioDiff > RATIO_TOLERANCE) {
        const errorMsg = `Invalid dimensions. Logo must be portrait-oriented with approximately 3:4 ratio (like 960 × 1280px). Your image is ${img.width} × ${img.height}px (${ratio.toFixed(2)}:1 ratio).`;
        setError(errorMsg);
        setRatioWarning(null);
        URL.revokeObjectURL(objectUrl);
        event.target.value = ""; // Reset input
        return;
      }

      // If ratio is close but not perfect, show warning but accept
      if (ratioDiff > 0.1) {
        setRatioWarning(
          "For the best phone preview, aim for a portrait logo around 960 × 1280px or similar ratio."
        );
      } else {
        setRatioWarning(null);
      }

      // All validations passed - set preview with the object URL
      setLogoPreview(objectUrl);
      setLogoName(file.name);
      setObjectUrlRef(objectUrl);
      setError(null);
    };

    img.onerror = () => {
      setError("Failed to load image. Please try a different file.");
      URL.revokeObjectURL(objectUrl);
      event.target.value = ""; // Reset input
    };

    img.src = objectUrl;
  };

  const handleRemoveLogo = () => {
    // Clean up object URL if it exists
    if (objectUrlRef) {
      URL.revokeObjectURL(objectUrlRef);
      setObjectUrlRef(null);
    }
    setLogoPreview(undefined);
    setLogoName(undefined);
    setRatioWarning(null);
    setError(null);
    // Reset file input
    const fileInput = document.getElementById("branding-logo") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
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

  // Preview should show only business name, logo, and color - no services
  // This matches exactly what the booking page header will look like

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
          {/* Preview matches the booking page header exactly - just business name, logo, and color */}
          <div className="mx-auto w-full max-w-sm rounded-3xl border border-white/10 bg-gradient-to-br from-black via-slate-950 to-[#0b0d1a] p-8 shadow-lg shadow-black/40">
            {/* Background gradient with brand color accent */}
            <div 
              className="absolute inset-0 -z-10 rounded-3xl opacity-25"
              style={{ background: `radial-gradient(circle at top, ${primaryColor}40, transparent 60%)` }}
            />
            
            <div className="relative flex flex-col items-center gap-6">
              {/* Logo preview */}
              <div
                className="relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-3xl border border-white/10 bg-white/10"
                style={{ boxShadow: `0 12px 24px -12px ${primaryColor}55` }}
              >
                {logoPreview ? (
                  <Image
                    src={logoPreview}
                    alt={`${business.businessName || "Business"} logo preview`}
                    fill
                    className="object-contain p-2"
                    unoptimized
                    priority
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-xs text-white/40">
                    <Sparkle className="mb-2 h-4 w-4 text-white/40" aria-hidden="true" />
                    Logo preview
                  </div>
                )}
              </div>
              
              {/* Business name and description */}
              <div className="text-center space-y-2">
                <h3 className="font-display text-2xl text-white">
                  {business.businessName || "Your business name"}
                </h3>
                <p className="text-sm text-white/60 max-w-xs">
                  {business.description || "booking app for local businesses"}
                </p>
              </div>
              
              {/* Color accent indicator */}
              <div className="mt-2 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: primaryColor }}
                />
                <span className="text-xs font-semibold uppercase tracking-wide text-white/60">
                  Theme color
                </span>
              </div>
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


