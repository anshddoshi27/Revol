"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Camera, Check, ChevronDown, ImageIcon, Palette, Sparkle, Trash2, Type } from "lucide-react";

import { HelperText } from "@/components/ui/helper-text";
import { StepActions } from "@/components/onboarding/step-actions";
import { TestDataButton } from "@/components/onboarding/test-data-button";
import { generateBrandingData } from "@/lib/test-data-generator";
import type { BrandingConfig, ServiceCategory, ButtonShape, FontFamily } from "@/lib/onboarding-context";
import type { BusinessBasics } from "@/lib/onboarding-context";
import { cn } from "@/lib/utils";

interface BrandingStepProps {
  defaultValues: BrandingConfig;
  business: BusinessBasics;
  categories: ServiceCategory[];
  onNext: (values: BrandingConfig) => Promise<void> | void;
  onBack: () => void;
}

// Logo constraints - now square for top-right positioning
const LOGO_ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const LOGO_MAX_SIZE_MB = 2;
const LOGO_MIN_SIZE = 50;
const LOGO_MAX_SIZE = 400;

// Hero image constraints
const HERO_ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const HERO_MAX_SIZE_MB = 5;
const HERO_MIN_WIDTH = 800;
const HERO_MIN_HEIGHT = 300;

// Available fonts for the booking page
const AVAILABLE_FONTS: { value: FontFamily; label: string; style: string }[] = [
  { value: "Inter", label: "Inter", style: "font-sans" },
  { value: "Poppins", label: "Poppins", style: "font-sans" },
  { value: "Playfair Display", label: "Playfair Display", style: "font-serif" },
  { value: "Montserrat", label: "Montserrat", style: "font-sans" },
  { value: "Lora", label: "Lora", style: "font-serif" },
  { value: "Roboto", label: "Roboto", style: "font-sans" },
  { value: "Open Sans", label: "Open Sans", style: "font-sans" },
  { value: "Raleway", label: "Raleway", style: "font-sans" },
  { value: "Merriweather", label: "Merriweather", style: "font-serif" },
  { value: "DM Sans", label: "DM Sans", style: "font-sans" },
];

// Button shape options
const BUTTON_SHAPES: { value: ButtonShape; label: string; className: string }[] = [
  { value: "rounded", label: "Rounded", className: "rounded-full" },
  { value: "slightly-rounded", label: "Slightly Rounded", className: "rounded-lg" },
  { value: "square", label: "Square", className: "rounded-none" },
];

export function BrandingStep({
  defaultValues,
  business,
  categories,
  onNext,
  onBack
}: BrandingStepProps) {
  // Colors
  const [primaryColor, setPrimaryColor] = useState(defaultValues.primaryColor || "#5B64FF");
  const [secondaryColor, setSecondaryColor] = useState(defaultValues.secondaryColor || "#1a1a2e");
  const [useGradient, setUseGradient] = useState(defaultValues.useGradient ?? true);
  
  // Logo (small square)
  const [logoPreview, setLogoPreview] = useState<string | undefined>(defaultValues.logoUrl);
  const [logoName, setLogoName] = useState<string | undefined>(defaultValues.logoName);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoObjectUrl, setLogoObjectUrl] = useState<string | null>(null);
  
  // Typography
  const [fontFamily, setFontFamily] = useState<FontFamily>(defaultValues.fontFamily || "Inter");
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false);
  
  // Button shape
  const [buttonShape, setButtonShape] = useState<ButtonShape>(defaultValues.buttonShape || "rounded");
  
  // Hero image
  const [heroPreview, setHeroPreview] = useState<string | undefined>(defaultValues.heroImageUrl);
  const [heroName, setHeroName] = useState<string | undefined>(defaultValues.heroImageName);
  const [heroError, setHeroError] = useState<string | null>(null);
  const [heroObjectUrl, setHeroObjectUrl] = useState<string | null>(null);
  
  // Booking page description
  const [bookingDescription, setBookingDescription] = useState(defaultValues.bookingPageDescription || "");

  // Load Google Fonts for preview
  useEffect(() => {
    // Check if fonts are already loaded
    const existingLink = document.querySelector('link[href*="fonts.googleapis.com/css2?family"]');
    if (existingLink) return;

    // Add preconnect links for faster font loading
    const preconnect1 = document.createElement('link');
    preconnect1.rel = 'preconnect';
    preconnect1.href = 'https://fonts.googleapis.com';
    document.head.appendChild(preconnect1);

    const preconnect2 = document.createElement('link');
    preconnect2.rel = 'preconnect';
    preconnect2.href = 'https://fonts.gstatic.com';
    preconnect2.crossOrigin = 'anonymous';
    document.head.appendChild(preconnect2);

    // Load all fonts
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Montserrat:wght@400;500;600;700&family=Lora:wght@400;500;600;700&family=Roboto:wght@400;500;600;700&family=Open+Sans:wght@400;500;600;700&family=Raleway:wght@400;500;600;700&family=Merriweather:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    return () => {
      // Cleanup on unmount (optional - fonts can stay loaded)
    };
  }, []);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
      if (heroObjectUrl) URL.revokeObjectURL(heroObjectUrl);
    };
  }, [logoObjectUrl, heroObjectUrl]);

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLogoError(null);

    if (!LOGO_ACCEPTED_TYPES.includes(file.type)) {
      setLogoError("Invalid format. Please upload PNG, JPG, WEBP, or SVG.");
      event.target.value = "";
      return;
    }

    if (file.size > LOGO_MAX_SIZE_MB * 1024 * 1024) {
      setLogoError(`File too large. Max size is ${LOGO_MAX_SIZE_MB}MB.`);
      event.target.value = "";
      return;
    }

    if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);

    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    
    img.onload = () => {
      // Check if approximately square (allow 20% variance)
      const ratio = img.width / img.height;
      if (ratio < 0.8 || ratio > 1.2) {
        setLogoError(`Logo should be square. Your image is ${img.width}×${img.height}px. Try a square image (e.g., 200×200px).`);
        URL.revokeObjectURL(objectUrl);
        event.target.value = "";
        return;
      }

      if (img.width < LOGO_MIN_SIZE || img.height < LOGO_MIN_SIZE) {
        setLogoError(`Image too small. Min size is ${LOGO_MIN_SIZE}×${LOGO_MIN_SIZE}px.`);
        URL.revokeObjectURL(objectUrl);
        event.target.value = "";
        return;
      }

      if (img.width > LOGO_MAX_SIZE || img.height > LOGO_MAX_SIZE) {
        // Just warn but allow
        console.warn(`Logo is larger than recommended (${LOGO_MAX_SIZE}×${LOGO_MAX_SIZE}px)`);
      }

      setLogoPreview(objectUrl);
      setLogoName(file.name);
      setLogoObjectUrl(objectUrl);
      setLogoError(null);
    };

    img.onerror = () => {
      setLogoError("Failed to load image. Try a different file.");
      URL.revokeObjectURL(objectUrl);
      event.target.value = "";
    };

    img.src = objectUrl;
  };

  const handleRemoveLogo = () => {
    if (logoObjectUrl) {
      URL.revokeObjectURL(logoObjectUrl);
      setLogoObjectUrl(null);
    }
    setLogoPreview(undefined);
    setLogoName(undefined);
    setLogoError(null);
    const input = document.getElementById("branding-logo") as HTMLInputElement;
    if (input) input.value = "";
  };

  const handleHeroChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setHeroError(null);

    if (!HERO_ACCEPTED_TYPES.includes(file.type)) {
      setHeroError("Invalid format. Please upload PNG, JPG, or WEBP.");
      event.target.value = "";
      return;
    }

    if (file.size > HERO_MAX_SIZE_MB * 1024 * 1024) {
      setHeroError(`File too large. Max size is ${HERO_MAX_SIZE_MB}MB.`);
      event.target.value = "";
      return;
    }

    if (heroObjectUrl) URL.revokeObjectURL(heroObjectUrl);

    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    
    img.onload = () => {
      if (img.width < HERO_MIN_WIDTH || img.height < HERO_MIN_HEIGHT) {
        setHeroError(`Image too small. Min size is ${HERO_MIN_WIDTH}×${HERO_MIN_HEIGHT}px. Yours is ${img.width}×${img.height}px.`);
        URL.revokeObjectURL(objectUrl);
        event.target.value = "";
        return;
      }

      setHeroPreview(objectUrl);
      setHeroName(file.name);
      setHeroObjectUrl(objectUrl);
      setHeroError(null);
    };

    img.onerror = () => {
      setHeroError("Failed to load image. Try a different file.");
      URL.revokeObjectURL(objectUrl);
      event.target.value = "";
    };

    img.src = objectUrl;
  };

  const handleRemoveHero = () => {
    if (heroObjectUrl) {
      URL.revokeObjectURL(heroObjectUrl);
      setHeroObjectUrl(null);
    }
    setHeroPreview(undefined);
    setHeroName(undefined);
    setHeroError(null);
    const input = document.getElementById("branding-hero") as HTMLInputElement;
    if (input) input.value = "";
  };
  
  const handleFillTestData = () => {
    const testData = generateBrandingData();
    setPrimaryColor(testData.primaryColor);
    setSecondaryColor("#1a1a2e");
  };

  const handleContinue = () => {
    onNext({
      primaryColor,
      secondaryColor,
      useGradient,
      logoUrl: logoPreview,
      logoName,
      fontFamily,
      buttonShape,
      heroImageUrl: undefined,
      heroImageName: undefined,
      bookingPageDescription: bookingDescription.trim() || undefined,
      recommendedDimensions: { width: 200, height: 200 }
    });
  };

  // Get the button radius class based on selected shape
  const getButtonClass = () => {
    const shape = BUTTON_SHAPES.find(s => s.value === buttonShape);
    return shape?.className || "rounded-full";
  };

  return (
    <div className="space-y-8" aria-labelledby="branding-step-heading">
      <header className="space-y-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary/90">
          <Palette className="h-4 w-4" aria-hidden="true" />
          Step 5 · Branding
        </span>
        <h2 id="branding-step-heading" className="font-display text-3xl text-white">
          Design your booking page experience
        </h2>
        <p className="max-w-xl text-base text-white/70">
          Customize colors, fonts, and imagery to match your brand. Your customers will see these styles when booking appointments.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[400px,1fr]">
        {/* Controls Column */}
        <div className="space-y-8">
          
          {/* Colors Section */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/60">
              <Palette className="h-4 w-4" />
              Colors
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <fieldset>
                <legend className="mb-2 block text-sm font-medium text-white/80">Primary Color</legend>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                    aria-label="Select primary color"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{primaryColor.toUpperCase()}</p>
                    <p className="text-[10px] text-white/50">Buttons & accents</p>
                  </div>
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 block text-sm font-medium text-white/80">Secondary Color</legend>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                    aria-label="Select secondary color"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{secondaryColor.toUpperCase()}</p>
                    <p className="text-[10px] text-white/50">Backgrounds & text</p>
                  </div>
                </div>
                <HelperText className="mt-2 text-xs text-amber-200/80">
                  For best results, use black (#000000) or white (#FFFFFF) as your secondary color to ensure optimal readability and visual appeal.
                </HelperText>
              </fieldset>
            </div>

            {/* Gradient Toggle */}
            <fieldset>
              <legend className="mb-2 block text-sm font-medium text-white/80">Use Gradient Background</legend>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setUseGradient(true)}
                  className={cn(
                    "flex-1 rounded-2xl border px-4 py-3 text-sm font-medium transition",
                    useGradient
                      ? "border-primary bg-primary/20 text-white"
                      : "border-white/10 bg-white/5 text-white/60 hover:text-white"
                  )}
                >
                  Yes, use gradients
                </button>
                <button
                  type="button"
                  onClick={() => setUseGradient(false)}
                  className={cn(
                    "flex-1 rounded-2xl border px-4 py-3 text-sm font-medium transition",
                    !useGradient
                      ? "border-primary bg-primary/20 text-white"
                      : "border-white/10 bg-white/5 text-white/60 hover:text-white"
                  )}
                >
                  No, solid colors
                </button>
              </div>
              <HelperText className="mt-2 text-xs">
                {useGradient 
                  ? "Background will use smooth gradients between your colors" 
                  : "Background will use solid colors for a clean, minimal look"}
              </HelperText>
            </fieldset>
          </section>

          {/* Logo Section */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/60">
              <Camera className="h-4 w-4" />
              Logo
            </h3>
            
            <fieldset>
              <legend className="sr-only">Upload logo</legend>
              <label
                htmlFor="branding-logo"
                className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-6 text-center text-sm text-white/60 transition hover:border-primary/60 hover:text-white"
              >
                <Camera className="mb-2 h-5 w-5 text-primary" aria-hidden="true" />
                {logoPreview ? (
                  <>
                    <span className="text-white">{logoName}</span>
                    <span className="text-xs">Tap to replace</span>
                  </>
                ) : (
                  <>
                    <span className="text-white">Upload square logo</span>
                    <span className="text-xs">200×200px recommended, max 2MB</span>
                  </>
                )}
                <input
                  id="branding-logo"
                  type="file"
                  accept={LOGO_ACCEPTED_TYPES.join(",")}
                  className="sr-only"
                  onChange={handleLogoChange}
                />
              </label>
              <HelperText className="mt-2 text-xs">
                Displayed in the top-right of your booking page.
              </HelperText>
              {logoError && (
                <HelperText intent="error" className="mt-1" role="alert">
                  {logoError}
                </HelperText>
              )}
              {logoPreview && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-white/70 transition hover:text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Remove logo
                </button>
              )}
            </fieldset>
          </section>

          {/* Typography Section */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/60">
              <Type className="h-4 w-4" />
              Typography
            </h3>
            
            <fieldset>
              <legend className="mb-2 block text-sm font-medium text-white/80">Font Family</legend>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setFontDropdownOpen(!fontDropdownOpen)}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:border-white/25"
                >
                  <span 
                    className="text-base text-white"
                    style={{ fontFamily: `"${fontFamily}", sans-serif` }}
                  >
                    {fontFamily}
                  </span>
                  <ChevronDown className={cn("h-4 w-4 text-white/60 transition", fontDropdownOpen && "rotate-180")} />
                </button>
                
                {fontDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 py-2 shadow-xl">
                    {AVAILABLE_FONTS.map((font) => (
                      <button
                        key={font.value}
                        type="button"
                        onClick={() => {
                          setFontFamily(font.value);
                          setFontDropdownOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/10",
                          fontFamily === font.value && "bg-primary/20"
                        )}
                      >
                        <span 
                          className="text-base text-white"
                          style={{ fontFamily: `"${font.value}", ${font.style === "font-serif" ? "serif" : "sans-serif"}` }}
                        >
                          {font.label}
                        </span>
                        {fontFamily === font.value && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <HelperText className="mt-2 text-xs">
                Applied to titles, descriptions, and service names.
              </HelperText>
            </fieldset>
          </section>

          {/* Button Shape Section */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/60">
              Button Style
            </h3>
            
            <fieldset>
              <legend className="sr-only">Button shape</legend>
              <div className="flex gap-3">
                {BUTTON_SHAPES.map((shape) => (
                  <button
                    key={shape.value}
                    type="button"
                    onClick={() => setButtonShape(shape.value)}
                    className={cn(
                      "flex-1 border px-4 py-3 text-sm font-medium transition",
                      shape.className,
                      buttonShape === shape.value
                        ? "border-primary bg-primary/20 text-white"
                        : "border-white/10 bg-white/5 text-white/60 hover:text-white"
                    )}
                  >
                    {shape.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </section>

          {/* Hero Image Section - Coming Soon */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/60">
              <ImageIcon className="h-4 w-4" />
              Hero Image
            </h3>
            
            <fieldset disabled>
              <legend className="sr-only">Hero image coming soon</legend>
              <div className="flex cursor-not-allowed flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/40 opacity-50">
                <ImageIcon className="mb-2 h-5 w-5 text-white/30" aria-hidden="true" />
                <span className="text-white/50">Hero Image</span>
                <span className="mt-1 text-xs font-semibold text-primary/70">Coming Soon</span>
              </div>
              <HelperText className="mt-2 text-xs text-white/40">
                Hero image feature will be available in a future update.
              </HelperText>
            </fieldset>
          </section>

          {/* Booking Description Section */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/60">
              Booking Page Description
            </h3>
            
            <fieldset>
              <legend className="mb-2 block text-sm font-medium text-white/80">Description (Optional)</legend>
              <textarea
                value={bookingDescription}
                onChange={(e) => setBookingDescription(e.target.value)}
                placeholder="Welcome to our booking page! Select a service and find a time that works for you."
                rows={3}
                maxLength={300}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <HelperText className="mt-2 text-xs">
                Displayed under your business name. Max 300 characters. ({bookingDescription.length}/300)
              </HelperText>
            </fieldset>
          </section>
        </div>

        {/* Preview Column */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 lg:p-8">
          <p className="mb-4 text-xs uppercase tracking-wide text-white/40">Live Preview</p>
          
          {/* Preview Container - Simulating booking page */}
          <div 
            className="relative overflow-hidden rounded-3xl border border-white/10 shadow-lg shadow-black/40"
            style={{ 
              fontFamily: `"${fontFamily}", system-ui, -apple-system, sans-serif`,
              background: useGradient 
                ? `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor}20 50%, ${secondaryColor} 100%)` 
                : secondaryColor
            }}
          >
            {/* Gradient overlay */}
            {useGradient && (
              <div 
                className="absolute inset-0 h-40 opacity-50"
                style={{ background: `radial-gradient(circle at top right, ${primaryColor}40, transparent 70%)` }}
              />
            )}

            <div className="relative p-6">
              {/* Header with logo */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 
                    className="text-2xl font-bold"
                    style={{ 
                      fontFamily: `"${fontFamily}", sans-serif`,
                      color: primaryColor 
                    }}
                  >
                    {business.businessName || "Your Business Name"}
                  </h3>
                  {(bookingDescription || business.description) && (
                    <p 
                      className="mt-2 max-w-sm text-sm opacity-70"
                      style={{ 
                        fontFamily: `"${fontFamily}", sans-serif`,
                        color: "#ffffff"
                      }}
                    >
                      {bookingDescription || business.description}
                    </p>
                  )}
                </div>
                
                {/* Logo in top right */}
                {logoPreview && (
                  <div
                    className="h-14 w-14 flex-shrink-0 overflow-hidden ml-4"
                    style={{ boxShadow: `0 4px 12px ${primaryColor}30` }}
                  >
                    <Image
                      src={logoPreview}
                      alt="Business logo"
                      width={56}
                      height={56}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  </div>
                )}
              </div>

              {/* Sample service card */}
              <div className="mt-6 space-y-3">
                <p 
                  className="text-xs uppercase tracking-wide opacity-50"
                  style={{ fontFamily: `"${fontFamily}", sans-serif`, color: "#ffffff" }}
                >
                  Sample Service
                </p>
                <div 
                  className="rounded-2xl border border-white/10 p-4"
                  style={{ backgroundColor: `${primaryColor}10` }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p 
                        className="font-semibold"
                        style={{ fontFamily: `"${fontFamily}", sans-serif`, color: "#ffffff" }}
                      >
                        Haircut & Style
                      </p>
                      <p 
                        className="text-sm opacity-60"
                        style={{ fontFamily: `"${fontFamily}", sans-serif`, color: "#ffffff" }}
                      >
                        45 min · $65
                      </p>
                    </div>
                    <button
                      type="button"
                      className={cn(
                        "px-4 py-2 text-sm font-semibold text-white transition",
                        getButtonClass()
                      )}
                      style={{ backgroundColor: primaryColor }}
                    >
                      Book Now
                    </button>
                  </div>
                </div>
              </div>

              {/* Color accent bar */}
              <div className="mt-6 flex items-center gap-3">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: primaryColor }}
                />
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: secondaryColor }}
                />
                <span 
                  className="text-xs text-white/50"
                  style={{ fontFamily: `"${fontFamily}", sans-serif` }}
                >
                  Theme colors
                </span>
              </div>
            </div>
          </div>

          {/* Device responsiveness note */}
          <div className="mt-4 rounded-2xl border border-white/5 bg-white/5 p-4">
            <p className="text-xs text-white/50">
              <Sparkle className="mr-2 inline h-3 w-3" />
              This preview shows how your booking page will look. The actual page adapts beautifully to mobile, tablet, and desktop screens.
            </p>
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
