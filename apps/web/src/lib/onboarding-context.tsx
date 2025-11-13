"use client";

import * as React from "react";

import type { FakeBusiness } from "@/lib/fake-business";
import type {
  OnboardingStepId,
  BusinessBasics,
  WebsiteConfig,
  LocationContacts,
  StaffMember,
  BrandingConfig,
  ServiceDefinition,
  ServiceCategory,
  ServiceAvailability,
  NotificationTemplate,
  PoliciesConfig,
  GiftCardConfig,
  PaymentSetupConfig,
  Channel,
  NotificationTrigger,
  FeeType,
  DayOfWeek,
  AvailabilitySlot,
  StaffAvailability
} from "@/lib/onboarding-types";

export type { OnboardingStepId } from "@/lib/onboarding-types";
export type { DayOfWeek } from "@/lib/onboarding-types";
export type { BusinessBasics } from "@/lib/onboarding-types";
export type { WebsiteConfig } from "@/lib/onboarding-types";
export type { LocationContacts } from "@/lib/onboarding-types";
export type { StaffMember } from "@/lib/onboarding-types";
export type { BrandingConfig } from "@/lib/onboarding-types";
export type { ServiceDefinition } from "@/lib/onboarding-types";
export type { ServiceCategory } from "@/lib/onboarding-types";
export type { AvailabilitySlot } from "@/lib/onboarding-types";
export type { StaffAvailability } from "@/lib/onboarding-types";
export type { ServiceAvailability } from "@/lib/onboarding-types";
export type { Channel } from "@/lib/onboarding-types";
export type { NotificationTrigger } from "@/lib/onboarding-types";
export type { NotificationTemplate } from "@/lib/onboarding-types";
export type { FeeType } from "@/lib/onboarding-types";
export type { PoliciesConfig } from "@/lib/onboarding-types";
export type { GiftCardConfig } from "@/lib/onboarding-types";
export type { PaymentSetupConfig } from "@/lib/onboarding-types";

export interface OnboardingState {
  currentStep: OnboardingStepId;
  completedSteps: OnboardingStepId[];
  onboardingCompleted: boolean;
  business: BusinessBasics;
  website: WebsiteConfig;
  location: LocationContacts;
  team: StaffMember[];
  branding: BrandingConfig;
  services: ServiceCategory[];
  availability: ServiceAvailability[];
  notifications: NotificationTemplate[];
  policies: PoliciesConfig;
  giftCards: GiftCardConfig;
  paymentSetup: PaymentSetupConfig;
  bookingUrl?: string;
}

type OnboardingAction =
  | { type: "SET_STEP"; payload: OnboardingStepId }
  | { type: "COMPLETE_STEP"; payload: OnboardingStepId }
  | { type: "SAVE_BUSINESS"; payload: BusinessBasics }
  | { type: "SAVE_WEBSITE"; payload: WebsiteConfig }
  | { type: "SAVE_LOCATION"; payload: LocationContacts }
  | { type: "SAVE_TEAM"; payload: StaffMember[] }
  | { type: "SAVE_BRANDING"; payload: BrandingConfig }
  | { type: "SAVE_SERVICES"; payload: ServiceCategory[] }
  | { type: "SAVE_AVAILABILITY"; payload: ServiceAvailability[] }
  | { type: "SAVE_NOTIFICATIONS"; payload: NotificationTemplate[] }
  | { type: "SAVE_POLICIES"; payload: PoliciesConfig }
  | { type: "SAVE_GIFT_CARDS"; payload: GiftCardConfig }
  | { type: "SAVE_PAYMENT_SETUP"; payload: PaymentSetupConfig }
  | { type: "SET_BOOKING_URL"; payload: string }
  | { type: "SET_COMPLETED"; payload: boolean }
  | { type: "RESET" };

const DEFAULT_NOTIFICATIONS: NotificationTemplate[] = [
  {
    id: "booking-created",
    name: "Booking received",
    channel: "email",
    category: "confirmation",
    trigger: "booking_created",
    subject: "We received your booking — no charge yet",
    body:
      "Hi ${customer.name}, we locked in ${service.name} on ${booking.date} at ${booking.time}. " +
      "No payment has been taken. We’ll only charge after your appointment per ${business.name} policies.",
    enabled: true
  },
  {
    id: "reminder-24h",
    name: "24 hour reminder",
    channel: "sms",
    category: "reminder",
    trigger: "reminder_24h",
    body:
      "Friendly reminder for ${service.name} on ${booking.date} at ${booking.time}. Reply C to cancel. " +
      "Policies: ${booking.url}",
    enabled: true
  },
  {
    id: "no-show-fee-charged",
    name: "No-show fee charged",
    channel: "email",
    category: "fee",
    trigger: "fee_charged",
    subject: "No-show fee processed",
    body:
      "Hi ${customer.name}, we applied the no-show fee for ${service.name} per policy. " +
      "Total charged: ${service.price}. View details: ${booking.url}",
    enabled: false
  }
];

const initialState: OnboardingState = {
  currentStep: "business",
  completedSteps: [],
  onboardingCompleted: false,
  business: {
    businessName: "",
    description: "",
    doingBusinessAs: "",
    legalName: "",
    industry: ""
  },
  website: {
    subdomain: "",
    status: "idle"
  },
  location: {
    timezone: "",
    phone: "",
    supportEmail: "",
    website: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    stateProvince: "",
    postalCode: "",
    country: ""
  },
  team: [],
  branding: {
    primaryColor: "#5B64FF",
    logoUrl: undefined,
    logoName: undefined,
    recommendedDimensions: {
      width: 960,
      height: 1280
    }
  },
  services: [],
  availability: [],
  notifications: DEFAULT_NOTIFICATIONS,
  policies: {
    cancellationPolicy: "",
    cancellationFeeType: "percent",
    cancellationFeeValue: 0,
    noShowPolicy: "",
    noShowFeeType: "percent",
    noShowFeeValue: 0,
    refundPolicy: "",
    cashPolicy: ""
  },
  giftCards: {
    enabled: false,
    amountType: "amount",
    amountValue: 10000,
    expirationEnabled: false,
    generatedCodes: []
  },
  paymentSetup: {
    connectStatus: "not_started",
    acceptedMethods: ["card"],
    subscriptionStatus: "trial"
  },
  bookingUrl: undefined
};

function reducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStep: action.payload };
    case "COMPLETE_STEP":
      return state.completedSteps.includes(action.payload)
        ? state
        : { ...state, completedSteps: [...state.completedSteps, action.payload] };
    case "SAVE_BUSINESS":
      return { ...state, business: action.payload };
    case "SAVE_WEBSITE":
      return { ...state, website: action.payload };
    case "SAVE_LOCATION":
      return { ...state, location: action.payload };
    case "SAVE_TEAM":
      return { ...state, team: action.payload };
    case "SAVE_BRANDING":
      return { ...state, branding: action.payload };
    case "SAVE_SERVICES":
      return { ...state, services: action.payload };
    case "SAVE_AVAILABILITY":
      return { ...state, availability: action.payload };
    case "SAVE_NOTIFICATIONS":
      return { ...state, notifications: action.payload };
    case "SAVE_POLICIES":
      return { ...state, policies: action.payload };
    case "SAVE_GIFT_CARDS":
      return { ...state, giftCards: action.payload };
    case "SAVE_PAYMENT_SETUP":
      return { ...state, paymentSetup: action.payload };
    case "SET_BOOKING_URL":
      return { ...state, bookingUrl: action.payload };
    case "SET_COMPLETED":
      return { ...state, onboardingCompleted: action.payload };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

interface OnboardingContextValue extends OnboardingState {
  setStep: (step: OnboardingStepId) => void;
  completeStep: (step: OnboardingStepId) => void;
  saveBusiness: (payload: BusinessBasics) => void;
  saveWebsite: (payload: WebsiteConfig) => void;
  saveLocation: (payload: LocationContacts) => void;
  saveTeam: (payload: StaffMember[]) => void;
  saveBranding: (payload: BrandingConfig) => void;
  saveServices: (payload: ServiceCategory[]) => void;
  saveAvailability: (payload: ServiceAvailability[]) => void;
  saveNotifications: (payload: NotificationTemplate[]) => void;
  savePolicies: (payload: PoliciesConfig) => void;
  saveGiftCards: (payload: GiftCardConfig) => void;
  savePaymentSetup: (payload: PaymentSetupConfig) => void;
  setBookingUrl: (url: string) => void;
  setOnboardingCompleted: (completed: boolean) => void;
  reset: () => void;
  generateBusinessFromState: () => FakeBusiness;
}

const OnboardingContext = React.createContext<OnboardingContextValue | undefined>(
  undefined
);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, initialState);

  const setStep = React.useCallback((step: OnboardingStepId) => {
    dispatch({ type: "SET_STEP", payload: step });
  }, []);

  const completeStep = React.useCallback((step: OnboardingStepId) => {
    dispatch({ type: "COMPLETE_STEP", payload: step });
  }, []);

  const saveBusiness = React.useCallback((payload: BusinessBasics) => {
    dispatch({ type: "SAVE_BUSINESS", payload });
  }, []);

  const saveWebsite = React.useCallback((payload: WebsiteConfig) => {
    dispatch({ type: "SAVE_WEBSITE", payload });
  }, []);

  const saveLocation = React.useCallback((payload: LocationContacts) => {
    dispatch({ type: "SAVE_LOCATION", payload });
  }, []);

  const saveTeam = React.useCallback((payload: StaffMember[]) => {
    dispatch({ type: "SAVE_TEAM", payload });
  }, []);

  const saveBranding = React.useCallback((payload: BrandingConfig) => {
    dispatch({ type: "SAVE_BRANDING", payload });
  }, []);

  const saveServices = React.useCallback((payload: ServiceCategory[]) => {
    dispatch({ type: "SAVE_SERVICES", payload });
  }, []);

  const saveAvailability = React.useCallback((payload: ServiceAvailability[]) => {
    dispatch({ type: "SAVE_AVAILABILITY", payload });
  }, []);

  const saveNotifications = React.useCallback((payload: NotificationTemplate[]) => {
    dispatch({ type: "SAVE_NOTIFICATIONS", payload });
  }, []);

  const savePolicies = React.useCallback((payload: PoliciesConfig) => {
    dispatch({ type: "SAVE_POLICIES", payload });
  }, []);

  const saveGiftCards = React.useCallback((payload: GiftCardConfig) => {
    dispatch({ type: "SAVE_GIFT_CARDS", payload });
  }, []);

  const savePaymentSetup = React.useCallback((payload: PaymentSetupConfig) => {
    dispatch({ type: "SAVE_PAYMENT_SETUP", payload });
  }, []);

  const setBookingUrl = React.useCallback((url: string) => {
    dispatch({ type: "SET_BOOKING_URL", payload: url });
  }, []);

  const setOnboardingCompleted = React.useCallback((completed: boolean) => {
    dispatch({ type: "SET_COMPLETED", payload: completed });
  }, []);

  const reset = React.useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  const generateBusinessFromState = React.useCallback((): FakeBusiness => {
    const { business, website, paymentSetup } = state;
    const id = `biz_${crypto.randomUUID()}`;
    const fallbackSlug = createSubdomainFromName(business.businessName);
    const slug = normalizeSubdomain(website.subdomain, fallbackSlug);
    const bookingUrl = `https://${slug}.tithi.com`;
    const previewUrl = `/public/${slug}`;
    return {
      id,
      name: business.businessName,
      slug,
      bookingUrl,
      previewUrl,
      status: paymentSetup.subscriptionStatus,
      createdAt: new Date().toISOString(),
      trialEndsAt: paymentSetup.trialEndsAt,
      nextBillDate: paymentSetup.nextBillDate
    };
  }, [state]);

  const value = React.useMemo(
    () => ({
      ...state,
      setStep,
      completeStep,
      saveBusiness,
      saveWebsite,
      saveLocation,
      saveTeam,
      saveBranding,
      saveServices,
      saveAvailability,
      saveNotifications,
      savePolicies,
      saveGiftCards,
      savePaymentSetup,
      setBookingUrl,
      setOnboardingCompleted,
      reset,
      generateBusinessFromState
    }),
    [
      state,
      setStep,
      completeStep,
      saveBusiness,
      saveWebsite,
      saveLocation,
      saveTeam,
      saveBranding,
      saveServices,
      saveAvailability,
      saveNotifications,
      savePolicies,
      saveGiftCards,
      savePaymentSetup,
      setBookingUrl,
      setOnboardingCompleted,
      reset,
      generateBusinessFromState
    ]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = React.useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
}

function normalizeSubdomain(input: string, fallback: string): string {
  const candidate = slugifySubdomain(input);
  if (candidate.length >= 3) return candidate;
  const fallbackSlug = slugifySubdomain(fallback);
  return fallbackSlug.length >= 3 ? fallbackSlug : "yourbusiness";
}

function createSubdomainFromName(name: string): string {
  return slugifySubdomain(name);
}

function slugifySubdomain(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}




