"use client";

import * as React from "react";

import type { FakeBusiness } from "@/lib/fake-business";

export type OnboardingStepId =
  | "business"
  | "website"
  | "location"
  | "team"
  | "branding"
  | "services"
  | "availability"
  | "notifications"
  | "policies"
  | "giftCards"
  | "paymentSetup"
  | "goLive";

export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface BusinessBasics {
  businessName: string;
  description: string;
  doingBusinessAs: string;
  legalName: string;
  industry: string;
}

export interface WebsiteConfig {
  subdomain: string;
  status: "idle" | "validating" | "reserved" | "error";
  message?: string;
}

export interface LocationContacts {
  timezone: string;
  phone: string;
  supportEmail: string;
  website?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role?: string;
  color: string;
  active: boolean;
}

export interface BrandingConfig {
  primaryColor: string;
  logoUrl?: string;
  logoName?: string;
  recommendedDimensions: {
    width: number;
    height: number;
  };
}

export interface ServiceDefinition {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  priceCents: number;
  instructions?: string;
  staffIds: string[];
}

export interface ServiceCategory {
  id: string;
  name: string;
  description?: string;
  color: string;
  services: ServiceDefinition[];
}

export interface AvailabilitySlot {
  id: string;
  day: DayOfWeek;
  startTime: string; // HH:mm
  endTime: string;
}

export interface StaffAvailability {
  staffId: string;
  slots: AvailabilitySlot[];
}

export interface ServiceAvailability {
  serviceId: string;
  staff: StaffAvailability[];
}

export type Channel = "email" | "sms" | "push";

export type NotificationTrigger =
  | "booking_created"
  | "booking_confirmed"
  | "reminder_24h"
  | "reminder_1h"
  | "booking_canceled"
  | "booking_rescheduled"
  | "booking_completed"
  | "fee_charged"
  | "payment_issue"
  | "refunded";

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: Channel;
  category:
    | "confirmation"
    | "reminder"
    | "follow_up"
    | "cancellation"
    | "reschedule"
    | "completion"
    | "fee"
    | "payment_issue"
    | "refund";
  trigger: NotificationTrigger;
  subject?: string;
  body: string;
  enabled: boolean;
}

export type FeeType = "flat" | "percent";

export interface PoliciesConfig {
  cancellationPolicy: string;
  cancellationFeeType: FeeType;
  cancellationFeeValue: number;
  noShowPolicy: string;
  noShowFeeType: FeeType;
  noShowFeeValue: number;
  refundPolicy: string;
  cashPolicy: string;
}

export interface GiftCardConfig {
  enabled: boolean;
  amountType: "amount" | "percent";
  amountValue: number;
  expirationEnabled: boolean;
  expirationMonths?: number;
  generatedCodes: string[];
}

export interface PaymentSetupConfig {
  connectStatus: "not_started" | "in_progress" | "completed";
  acceptedMethods: string[];
  subscriptionStatus: "trial" | "active" | "paused" | "canceled";
  trialEndsAt?: string;
  nextBillDate?: string;
}

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
    const bookingUrl = `https://${website.subdomain}.tithi.com`;
    return {
      id,
      name: business.businessName,
      slug: website.subdomain,
      bookingUrl,
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


