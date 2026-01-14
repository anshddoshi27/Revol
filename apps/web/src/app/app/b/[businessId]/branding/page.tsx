"use client";

import { useEffect, useState } from "react";
import NextImage from "next/image";
import { Camera, Check, ChevronDown, ImageIcon, Loader2, Palette, Sparkle, Trash2, Type } from "lucide-react";
import { useParams } from "next/navigation";
import { createClientClient } from "@/lib/supabase-client";

import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/ui/helper-text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFakeBusiness } from "@/lib/fake-business";
import type { BrandingConfig, ButtonShape, FontFamily } from "@/lib/onboarding-context";
import { cn } from "@/lib/utils";

// Logo constraints
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

export default function BrandingPage() {
  const params = useParams<{ businessId: string }>();
  const { workspace, setIdentity } = useFakeBusiness();
  const supabase = createClientClient();

  const branding = workspace?.identity.branding || {
    primaryColor: "#5B64FF",
    secondaryColor: "#1a1a2e",
    useGradient: true,
    fontFamily: "Inter" as FontFamily,
    buttonShape: "rounded" as ButtonShape,
    logoUrl: undefined,
    logoName: undefined,
    heroImageUrl: undefined,
    heroImageName: undefined,
    bookingPageDescription: undefined,
    recommendedDimensions: { width: 960, height: 1280 },
  };

  // Colors
  const [primaryColor, setPrimaryColor] = useState(branding.primaryColor || "#5B64FF");
  const [secondaryColor, setSecondaryColor] = useState(branding.secondaryColor || "#1a1a2e");
  const [useGradient, setUseGradient] = useState(branding.useGradient ?? true);

  // Logo
  const [logoPreview, setLogoPreview] = useState<string | undefined>(branding.logoUrl);
  const [logoName, setLogoName] = useState<string | undefined>(branding.logoName);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoObjectUrl, setLogoObjectUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Typography
  const [fontFamily, setFontFamily] = useState<FontFamily>(branding.fontFamily || "Inter");
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false);

  // Button shape
  const [buttonShape, setButtonShape] = useState<ButtonShape>(branding.buttonShape || "rounded");

  // Hero image
  const [heroPreview, setHeroPreview] = useState<string | undefined>(branding.heroImageUrl);
  const [heroName, setHeroName] = useState<string | undefined>(branding.heroImageName);
  const [heroError, setHeroError] = useState<string | null>(null);
  const [heroObjectUrl, setHeroObjectUrl] = useState<string | null>(null);
  const [heroFile, setHeroFile] = useState<File | null>(null);

  // Booking page description
  const [bookingDescription, setBookingDescription] = useState(branding.bookingPageDescription || "");

  // Loading and error states
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load Google Fonts for preview
  useEffect(() => {
    const fontName = fontFamily.replace(/\s+/g, "+");
    const fontUrl = `https://fonts.googleapis.com/css2?family=${fontName}:wght@400;500;600;700&display=swap`;

    // Check if this font is already loaded
    const existingLink = document.querySelector(`link[href="${fontUrl}"]`);
    if (existingLink) return;

    // Add preconnect for faster font loading
    const preconnect1 = document.createElement('link');
    preconnect1.rel = 'preconnect';
    preconnect1.href = 'https://fonts.googleapis.com';
    document.head.appendChild(preconnect1);

    const preconnect2 = document.createElement('link');
    preconnect2.rel = 'preconnect';
    preconnect2.href = 'https://fonts.gstatic.com';
    preconnect2.crossOrigin = 'anonymous';
    document.head.appendChild(preconnect2);

    // Add font link
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = fontUrl;
    document.head.appendChild(link);

    return () => {
      // Cleanup preconnect links on unmount
      if (preconnect1.parentNode) preconnect1.parentNode.removeChild(preconnect1);
      if (preconnect2.parentNode) preconnect2.parentNode.removeChild(preconnect2);
    };
  }, [fontFamily]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
      if (heroObjectUrl) URL.revokeObjectURL(heroObjectUrl);
    };
  }, [logoObjectUrl, heroObjectUrl]);

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLogoError(null);
    setLogoFile(file);

    // Validate file type
    if (!LOGO_ACCEPTED_TYPES.includes(file.type)) {
      setLogoError(`Invalid file type. Accepted: ${LOGO_ACCEPTED_TYPES.join(", ")}`);
      return;
    }

    // Validate file size
    if (file.size > LOGO_MAX_SIZE_MB * 1024 * 1024) {
      setLogoError(`File too large. Maximum size: ${LOGO_MAX_SIZE_MB}MB`);
      return;
    }

    // Validate dimensions (for images)
    if (file.type.startsWith("image/") && !file.type.includes("svg")) {
      const img = new window.Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;

        // Check if square (allow 20% tolerance)
        const ratio = width / height;
        if (ratio < 0.8 || ratio > 1.2) {
          setLogoError("Logo must be square (aspect ratio between 0.8 and 1.2)");
          URL.revokeObjectURL(objectUrl);
          return;
        }

        // Check size constraints
        if (width < LOGO_MIN_SIZE || height < LOGO_MIN_SIZE) {
          setLogoError(`Logo too small. Minimum size: ${LOGO_MIN_SIZE}x${LOGO_MIN_SIZE}px`);
          URL.revokeObjectURL(objectUrl);
          return;
        }
        if (width > LOGO_MAX_SIZE || height > LOGO_MAX_SIZE) {
          setLogoError(`Logo too large. Maximum size: ${LOGO_MAX_SIZE}x${LOGO_MAX_SIZE}px`);
          URL.revokeObjectURL(objectUrl);
          return;
        }

        setLogoPreview(objectUrl);
        setLogoName(file.name);
        setLogoObjectUrl(objectUrl);
      };
      img.onerror = () => {
        setLogoError("Failed to load image");
        URL.revokeObjectURL(objectUrl);
      };
      img.src = objectUrl;
    } else {
      // SVG or other files
      const objectUrl = URL.createObjectURL(file);
      setLogoPreview(objectUrl);
      setLogoName(file.name);
      setLogoObjectUrl(objectUrl);
    }
  };

  const handleLogoRemove = () => {
    if (logoObjectUrl) {
      URL.revokeObjectURL(logoObjectUrl);
    }
    setLogoPreview(undefined);
    setLogoName(undefined);
    setLogoFile(null);
    setLogoObjectUrl(null);
    setLogoError(null);
  };

  const handleHeroUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setHeroError(null);
    setHeroFile(file);

    // Validate file type
    if (!HERO_ACCEPTED_TYPES.includes(file.type)) {
      setHeroError(`Invalid file type. Accepted: ${HERO_ACCEPTED_TYPES.join(", ")}`);
      return;
    }

    // Validate file size
    if (file.size > HERO_MAX_SIZE_MB * 1024 * 1024) {
      setHeroError(`File too large. Maximum size: ${HERO_MAX_SIZE_MB}MB`);
      return;
    }

    // Validate dimensions
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;

      if (width < HERO_MIN_WIDTH || height < HERO_MIN_HEIGHT) {
        setHeroError(`Image too small. Minimum size: ${HERO_MIN_WIDTH}x${HERO_MIN_HEIGHT}px`);
        URL.revokeObjectURL(objectUrl);
        return;
      }

      setHeroPreview(objectUrl);
      setHeroName(file.name);
      setHeroObjectUrl(objectUrl);
    };
    img.onerror = () => {
      setHeroError("Failed to load image");
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  };

  const handleHeroRemove = () => {
    if (heroObjectUrl) {
      URL.revokeObjectURL(heroObjectUrl);
    }
    setHeroPreview(undefined);
    setHeroName(undefined);
    setHeroFile(null);
    setHeroObjectUrl(null);
    setHeroError(null);
  };

  const getButtonClass = () => {
    switch (buttonShape) {
      case "rounded":
        return "rounded-full";
      case "slightly-rounded":
        return "rounded-lg";
      case "square":
        return "rounded-none";
      default:
        return "rounded-full";
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      // Upload logo if changed
      let logoUrl = logoPreview;
      if (logoFile) {
        // In a real app, you'd upload to storage (Supabase Storage, S3, etc.)
        // For now, we'll use the object URL (in production, upload to storage first)
        logoUrl = logoPreview || undefined;
      }

      // Upload hero image if changed
      let heroImageUrl = heroPreview;
      if (heroFile) {
        // In a real app, you'd upload to storage
        heroImageUrl = heroPreview || undefined;
      }

      // Prepare branding config
      const brandingConfig: BrandingConfig = {
        primaryColor,
        secondaryColor,
        useGradient,
        fontFamily,
        buttonShape,
        logoUrl,
        logoName,
        heroImageUrl: undefined,
        heroImageName: undefined,
        bookingPageDescription: bookingDescription.trim() || undefined,
        recommendedDimensions: branding.recommendedDimensions,
      };

      // Save to backend
      const response = await fetch(`/api/business/onboarding/step-5-branding`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify(brandingConfig),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to save branding: ${response.status}`);
      }

      // Fetch fresh branding data from API to ensure we have the latest from database
      const getResponse = await fetch(`/api/business/onboarding/step-5-branding`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
      });

      if (getResponse.ok) {
        const getData = await getResponse.json();
        if (getData.branding) {
          // Update local workspace state with fresh data from database
          setIdentity((existing) => ({
            ...existing,
            branding: getData.branding,
          }));
        }
      } else {
        // Fallback: use the config we just saved if fetch fails
        setIdentity((existing) => ({
          ...existing,
          branding: brandingConfig,
        }));
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving branding:", error);
      setSaveError(error instanceof Error ? error.message : "Failed to save branding");
    } finally {
      setIsSaving(false);
    }
  };

  if (!workspace) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-white/60">
          <Loader2 className="h-8 w-8 animate-spin text-white/80" aria-hidden="true" />
          <p className="text-sm uppercase tracking-[0.35em] text-white/40">Loading branding settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.35em] text-white/40">Branding</p>
        <h1 className="font-display text-4xl text-white">Customize your booking page</h1>
        <p className="max-w-3xl text-sm text-white/60">
          Update your branding settings. Changes will be reflected immediately on your public booking page.
        </p>
      </header>

      <form onSubmit={handleSave} className="grid gap-8 lg:grid-cols-2">
        {/* Left Column: Controls */}
        <div className="space-y-6">
          {/* Primary Color */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-white">Primary Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-12 w-20 cursor-pointer rounded-lg border border-white/20 bg-black/60"
              />
              <Input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#5B64FF"
                className="flex-1 uppercase"
                maxLength={7}
              />
            </div>
            <HelperText className="text-xs">Used for buttons, accents, and highlights</HelperText>
          </div>

          {/* Secondary Color */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-white">Secondary Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="h-12 w-20 cursor-pointer rounded-lg border border-white/20 bg-black/60"
              />
              <Input
                type="text"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                placeholder="#1a1a2e"
                className="flex-1 uppercase"
                maxLength={7}
              />
            </div>
            <HelperText className="text-xs">Used for backgrounds and card sections</HelperText>
            <HelperText className="text-xs text-amber-200/80">
              For best results, use black (#000000) or white (#FFFFFF) as your secondary color to ensure optimal readability and visual appeal.
            </HelperText>
          </div>

          {/* Gradient Toggle */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-white">Use Gradient Background</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUseGradient(true)}
                className={cn(
                  "flex-1 rounded-lg border px-4 py-3 text-sm font-semibold transition",
                  useGradient
                    ? "border-primary/50 bg-primary/15 text-white"
                    : "border-white/15 bg-black/60 text-white/70 hover:border-white/25 hover:text-white"
                )}
              >
                Yes, use gradients
              </button>
              <button
                type="button"
                onClick={() => setUseGradient(false)}
                className={cn(
                  "flex-1 rounded-lg border px-4 py-3 text-sm font-semibold transition",
                  !useGradient
                    ? "border-primary/50 bg-primary/15 text-white"
                    : "border-white/15 bg-black/60 text-white/70 hover:border-white/25 hover:text-white"
                )}
              >
                No, solid colors
              </button>
            </div>
            <HelperText className="text-xs">
              {useGradient 
                ? "Background will use smooth gradients between your colors" 
                : "Background will use solid colors for a clean, minimal look"}
            </HelperText>
          </div>

          {/* Font Family */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-white">Font Family</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setFontDropdownOpen(!fontDropdownOpen)}
                className="flex w-full items-center justify-between rounded-lg border border-white/15 bg-black/60 px-4 py-3 text-sm text-white hover:border-white/25"
              >
                <span style={{ fontFamily: `"${fontFamily}", sans-serif` }}>{fontFamily}</span>
                <ChevronDown className={cn("h-4 w-4 transition", fontDropdownOpen && "rotate-180")} />
              </button>
              {fontDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setFontDropdownOpen(false)}
                  />
                  <div className="absolute z-20 mt-2 max-h-60 w-full overflow-auto rounded-lg border border-white/15 bg-black/90 shadow-xl">
                    {AVAILABLE_FONTS.map((font) => (
                      <button
                        key={font.value}
                        type="button"
                        onClick={() => {
                          setFontFamily(font.value);
                          setFontDropdownOpen(false);
                        }}
                        className="flex w-full items-center justify-between px-4 py-3 text-sm text-white hover:bg-white/10"
                        style={{ fontFamily: `"${font.value}", sans-serif` }}
                      >
                        <span>{font.label}</span>
                        {fontFamily === font.value && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <HelperText className="text-xs">Font used throughout the booking page</HelperText>
          </div>

          {/* Button Shape */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-white">Button Shape</label>
            <div className="flex gap-2">
              {BUTTON_SHAPES.map((shape) => (
                <button
                  key={shape.value}
                  type="button"
                  onClick={() => setButtonShape(shape.value)}
                  className={cn(
                    "flex-1 rounded-lg border px-4 py-3 text-sm font-semibold transition",
                    buttonShape === shape.value
                      ? "border-primary/50 bg-primary/15 text-white"
                      : "border-white/15 bg-black/60 text-white/70 hover:border-white/25 hover:text-white"
                  )}
                >
                  <span className={shape.className}>Sample</span>
                </button>
              ))}
            </div>
          </div>

          {/* Logo Upload */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-white">Logo</label>
            {logoPreview ? (
              <div className="space-y-3">
                <div className="relative h-24 w-24 overflow-hidden">
                  {logoPreview.startsWith('blob:') || logoPreview.startsWith('data:') ? (
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <NextImage
                      src={logoPreview}
                      alt="Logo preview"
                      width={96}
                      height={96}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLogoRemove}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove logo
                  </Button>
                  <span className="text-xs text-white/60">{logoName}</span>
                </div>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-white/20 bg-black/60 p-8 text-center transition hover:border-primary/50">
                <Camera className="h-8 w-8 text-white/40" />
                <div>
                  <span className="text-sm font-semibold text-white">Upload logo</span>
                  <p className="mt-1 text-xs text-white/60">
                    Square image, {LOGO_MIN_SIZE}-{LOGO_MAX_SIZE}px, max {LOGO_MAX_SIZE_MB}MB
                  </p>
                </div>
                <input
                  type="file"
                  accept={LOGO_ACCEPTED_TYPES.join(",")}
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
            )}
            {logoError && <HelperText intent="error">{logoError}</HelperText>}
          </div>

          {/* Hero Image Upload - Coming Soon */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-white">Hero Image</label>
            <div className="flex cursor-not-allowed flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-white/10 bg-black/30 p-8 text-center opacity-50">
              <ImageIcon className="h-8 w-8 text-white/30" />
              <div>
                <span className="text-sm font-semibold text-white/50">Hero Image</span>
                <p className="mt-1 text-xs font-semibold text-primary/70">Coming Soon</p>
              </div>
            </div>
            <HelperText className="text-xs text-white/40">
              Hero image feature will be available in a future update.
            </HelperText>
          </div>

          {/* Booking Page Description */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-white">Booking Page Description</label>
            <Textarea
              value={bookingDescription}
              onChange={(e) => setBookingDescription(e.target.value)}
              placeholder="Add a description that appears under your business name..."
              rows={4}
              maxLength={300}
            />
            <div className="flex items-center justify-between">
              <HelperText className="text-xs">Optional description shown under business name</HelperText>
              <span className="text-xs text-white/40">
                ({bookingDescription.length}/300)
              </span>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between rounded-lg border border-white/15 bg-black/60 px-4 py-3">
            <div>
              {saveError ? (
                <HelperText intent="error">{saveError}</HelperText>
              ) : saveSuccess ? (
                <HelperText intent="success" className="text-emerald-200">
                  Branding saved successfully!
                </HelperText>
              ) : (
                <HelperText className="text-xs">
                  Changes will be reflected on your booking page immediately after saving.
                </HelperText>
              )}
            </div>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save branding"
              )}
            </Button>
          </div>
        </div>

        {/* Right Column: Preview */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Preview</h2>
            <div
              className="relative overflow-hidden rounded-3xl border border-white/10 shadow-lg shadow-black/40"
              style={{
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
                      {workspace.identity.business.businessName}
                    </h3>
                    {bookingDescription && (
                      <p
                        className="mt-2 max-w-sm text-sm opacity-70"
                        style={{
                          fontFamily: `"${fontFamily}", sans-serif`,
                          color: "#ffffff"
                        }}
                      >
                        {bookingDescription}
                      </p>
                    )}
                  </div>

                  {/* Logo in top right */}
                  {logoPreview && (
                    <div
                      className="h-14 w-14 flex-shrink-0 overflow-hidden ml-4"
                      style={{ boxShadow: `0 4px 12px ${primaryColor}30` }}
                    >
                      {logoPreview.startsWith('blob:') || logoPreview.startsWith('data:') ? (
                        <img
                          src={logoPreview}
                          alt="Business logo"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <NextImage
                          src={logoPreview}
                          alt="Business logo"
                          width={56}
                          height={56}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      )}
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
          </div>
        </div>
      </form>
    </div>
  );
}

