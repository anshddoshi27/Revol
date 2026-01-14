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
  notificationsEnabled: boolean;
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
  | { type: "SAVE_NOTIFICATIONS"; payload: { templates: NotificationTemplate[]; enabled: boolean } }
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
    secondaryColor: "#1a1a2e",
    logoUrl: undefined,
    logoName: undefined,
    fontFamily: "Inter",
    buttonShape: "rounded",
    heroImageUrl: undefined,
    heroImageName: undefined,
    bookingPageDescription: undefined,
    recommendedDimensions: {
      width: 200,
      height: 200
    }
  },
  services: [],
  availability: [],
  notifications: DEFAULT_NOTIFICATIONS,
  notificationsEnabled: true,
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
      const newState = { ...state, availability: action.payload };
      console.log('[OnboardingReducer] SAVE_AVAILABILITY action:', {
        payloadLength: action.payload?.length || 0,
        payloadServices: action.payload?.map((a: any) => a.serviceId) || [],
        payloadData: JSON.stringify(action.payload, null, 2),
        newStateAvailabilityLength: newState.availability?.length || 0,
        previousStateAvailabilityLength: state.availability?.length || 0
      });
      return newState;
    case "SAVE_NOTIFICATIONS":
      return { ...state, notifications: action.payload.templates, notificationsEnabled: action.payload.enabled };
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
  saveNotifications: (payload: { templates: NotificationTemplate[]; enabled: boolean }) => void;
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
  // Start with initialState to avoid hydration mismatch
  // Then load from database on client side only
  const [state, dispatch] = React.useReducer(reducer, initialState);
  const [isHydrated, setIsHydrated] = React.useState(false);
  
  // Load from database on client side only (after mount)
  // For new signups, always start at step 1 regardless of database state
  // Only load data when user is actually on the onboarding page
  React.useEffect(() => {
    if (typeof window !== 'undefined' && !isHydrated) {
      const loadStateFromDatabase = async () => {
        try {
          // Only load onboarding data if user is on the onboarding page
          // Don't load data on signup, login, or other pages
          const currentPath = window.location.pathname;
          if (currentPath !== '/onboarding') {
            console.log('[OnboardingProvider] Not on onboarding page, skipping data load:', currentPath);
            dispatch({ type: "SET_STEP", payload: "business" });
            setIsHydrated(true);
            return;
          }
          
          // Check URL parameter first - if new=true, this is a fresh signup, start at step 1
          const urlParams = new URLSearchParams(window.location.search);
          const isNewSignup = urlParams.get('new') === 'true';
          const accountId = urlParams.get("account_id");
          const isStripeReturn = !!accountId;
          
          if (isNewSignup) {
            console.log('[OnboardingProvider] New signup detected from URL parameter - starting fresh at step 1');
            dispatch({ type: "SET_STEP", payload: "business" });
            // Clean up URL parameter
            window.history.replaceState({}, "", window.location.pathname);
            setIsHydrated(true);
            return;
          }

          const { createClientClient } = await import('./supabase-client');
          const supabase = createClientClient();
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session?.access_token) {
            // No session - just mark as hydrated with initial state (step 1)
            console.log('[OnboardingProvider] No session - starting fresh at step 1');
            dispatch({ type: "SET_STEP", payload: "business" });
            setIsHydrated(true);
            return;
          }

          // Check if business has a valid name - if not, this is a new signup, start at step 1
          const { loadOnboardingDataFromBackend } = await import('./load-onboarding-data');
          const data = await loadOnboardingDataFromBackend();
          
          // Helper function to validate business data is actually complete (not just empty/default)
          const isValidBusiness = (business: any) => {
            return business && business.businessName && business.businessName.trim().length > 0;
          };
          
          // If business has no valid name, this is a NEW signup - start completely fresh at step 1
          if (!isValidBusiness(data.business)) {
            console.log('[OnboardingProvider] New signup detected (no valid business name) - starting fresh at step 1');
            dispatch({ type: "SET_STEP", payload: "business" });
            setIsHydrated(true);
            return;
          }
          
          // Helper function to validate website data is actually complete
          const isValidWebsite = (website: any) => {
            return website && website.subdomain && website.subdomain.trim().length > 0 && !website.subdomain.startsWith('temp-');
          };
          
          // Helper function to validate location data is actually complete
          const isValidLocation = (location: any) => {
            return location && (location.street?.trim() || location.city?.trim()) && location.timezone && location.timezone.trim().length > 0;
          };
          
          // This is a RETURNING user - restore their progress from database
          if (data.business && isValidBusiness(data.business)) {
            dispatch({ type: "SAVE_BUSINESS", payload: data.business });
          }
          
          if (data.website && isValidWebsite(data.website)) {
            dispatch({ type: "SAVE_WEBSITE", payload: data.website });
          }
          
          if (data.location && isValidLocation(data.location)) {
            dispatch({ type: "SAVE_LOCATION", payload: data.location });
          }
          
          if (data.team && data.team.length > 0) {
            dispatch({ type: "SAVE_TEAM", payload: data.team });
          }
          
          if (data.branding && data.branding.primaryColor && data.branding.primaryColor.trim().length > 0) {
            dispatch({ type: "SAVE_BRANDING", payload: data.branding });
          }
          
          if (data.services && data.services.length > 0) {
            dispatch({ type: "SAVE_SERVICES", payload: data.services });
          }
          
          // Always save availability data if it exists (even if empty array)
          // This ensures availability state is properly restored
          if (data.availability !== undefined) {
            // Clean the availability data to ensure it only contains staffId and slots
            const cleanAvailability = Array.isArray(data.availability) 
              ? data.availability.map((serviceAvail: any) => ({
                  serviceId: serviceAvail.serviceId,
                  staff: (serviceAvail.staff || []).map((staffAvail: any) => ({
                    staffId: staffAvail.staffId,
                    slots: staffAvail.slots || []
                  }))
                }))
              : [];
            
            // Calculate statistics for detailed logging
            const totalStaffEntries = cleanAvailability.reduce((sum: number, a: any) => sum + (a.staff?.length || 0), 0);
            const totalSlots = cleanAvailability.reduce((sum: number, a: any) => 
              sum + (a.staff?.reduce((staffSum: number, st: any) => staffSum + (st.slots?.length || 0), 0) || 0), 0
            );
            
            dispatch({ type: "SAVE_AVAILABILITY", payload: cleanAvailability });
            console.log('[OnboardingProvider] ✅ Saved availability to context:', {
              count: cleanAvailability.length,
              services: cleanAvailability.map((a: any) => a.serviceId),
              totalStaffEntries: totalStaffEntries,
              totalSlots: totalSlots,
              hasData: cleanAvailability.length > 0 && totalSlots > 0,
              rawData: JSON.stringify(data.availability, null, 2),
              cleanedData: JSON.stringify(cleanAvailability, null, 2)
            });
          } else {
            console.warn('[OnboardingProvider] ⚠️ No availability data in loaded data (undefined)');
          }
          
          if (data.notifications) {
            dispatch({ type: "SAVE_NOTIFICATIONS", payload: data.notifications });
          }
          
          if (data.policies) {
            dispatch({ type: "SAVE_POLICIES", payload: data.policies });
          }
          
          if (data.giftCards) {
            dispatch({ type: "SAVE_GIFT_CARDS", payload: data.giftCards });
          }
          
          if (data.paymentSetup) {
            dispatch({ type: "SAVE_PAYMENT_SETUP", payload: data.paymentSetup });
          }
          
          // Check if this is a Stripe return (has account_id in URL)
          
          if (isStripeReturn) {
            console.log('[OnboardingProvider] Stripe return detected (account_id:', accountId, ') - handling step navigation');
            // Mark steps as completed
            const completedSteps: OnboardingStepId[] = [];
            if (isValidBusiness(data.business)) completedSteps.push('business');
            if (isValidWebsite(data.website)) completedSteps.push('website');
            if (isValidLocation(data.location)) completedSteps.push('location');
            if (data.team && data.team.length > 0) completedSteps.push('team');
            if (data.branding?.primaryColor && data.branding.primaryColor.trim().length > 0) completedSteps.push('branding');
            if (data.services && data.services.length > 0) completedSteps.push('services');
            // Check availability - it must be an array with at least one service that has staff with slots
            const hasValidAvailability = data.availability && 
              Array.isArray(data.availability) && 
              data.availability.length > 0 &&
              data.availability.some((serviceAvail: any) => 
                serviceAvail.staff && 
                Array.isArray(serviceAvail.staff) && 
                serviceAvail.staff.length > 0 &&
                serviceAvail.staff.some((staffAvail: any) => 
                  staffAvail.slots && 
                  Array.isArray(staffAvail.slots) && 
                  staffAvail.slots.length > 0
                )
              );
            if (hasValidAvailability) {
              completedSteps.push('availability');
              console.log('[OnboardingProvider] Availability step is completed');
            } else {
              console.log('[OnboardingProvider] Availability step is NOT completed:', {
                hasAvailability: !!data.availability,
                isArray: Array.isArray(data.availability),
                length: data.availability?.length || 0
              });
            }
            if (data.notifications) completedSteps.push('notifications');
            if (data.policies && (data.policies.cancellationPolicy?.trim() || data.policies.noShowPolicy?.trim())) completedSteps.push('policies');
            if (data.giftCards) completedSteps.push('giftCards');
            
            // Check payment setup status - this is critical for Stripe returns
            const isPaymentCompleted = data.paymentSetup && 
              (data.paymentSetup.connectStatus === "completed" || data.paymentSetup.connectStatus === "in_progress");
            
            if (isPaymentCompleted) {
              completedSteps.push('paymentSetup');
              console.log('[OnboardingProvider] Payment setup completed (connectStatus:', data.paymentSetup.connectStatus, ') - going to goLive');
              // If payment is completed, ALWAYS go to goLive (page.tsx will also handle this, but ensure it here too)
              dispatch({ type: "SET_STEP", payload: "goLive" });
            } else {
              // Payment not completed yet - go to paymentSetup step
              console.log('[OnboardingProvider] Payment setup not completed yet - going to paymentSetup step');
              dispatch({ type: "SET_STEP", payload: "paymentSetup" });
            }
            
            completedSteps.forEach(step => {
              dispatch({ type: "COMPLETE_STEP", payload: step });
            });
            
            console.log('[OnboardingProvider] Stripe return - marked steps as completed:', completedSteps, 'navigated to:', isPaymentCompleted ? 'goLive' : 'paymentSetup');
            return; // Exit early - don't run the normal step detection logic
          }
          
          // Determine current step based on VALID completed steps only (for returning users)
          const completedSteps: OnboardingStepId[] = [];
          if (isValidBusiness(data.business)) completedSteps.push('business');
          if (isValidWebsite(data.website)) completedSteps.push('website');
          if (isValidLocation(data.location)) completedSteps.push('location');
          if (data.team && data.team.length > 0) completedSteps.push('team');
          if (data.branding?.primaryColor && data.branding.primaryColor.trim().length > 0) completedSteps.push('branding');
          if (data.services && data.services.length > 0) completedSteps.push('services');
          if (data.availability && data.availability.length > 0) completedSteps.push('availability');
          if (data.notifications) completedSteps.push('notifications');
          if (data.policies && (data.policies.cancellationPolicy?.trim() || data.policies.noShowPolicy?.trim())) completedSteps.push('policies');
          if (data.giftCards) completedSteps.push('giftCards');
          
          // IMPORTANT: Check payment setup status FIRST
          // If payment setup is completed, ALWAYS go to goLive regardless of other incomplete steps
          const isPaymentSetupCompleted = data.paymentSetup && 
            (data.paymentSetup.connectStatus === "completed" || data.paymentSetup.connectStatus === "in_progress");
          
          if (isPaymentSetupCompleted) {
            completedSteps.push('paymentSetup');
            console.log('[OnboardingProvider] Payment setup is completed - going directly to goLive (ignoring other incomplete steps)');
            dispatch({ type: "SET_STEP", payload: "goLive" });
            console.log('[OnboardingProvider] Returning user - loaded from database, completed steps:', completedSteps, 'starting at: goLive');
            return; // Exit early - don't check for other incomplete steps
          }
          
          // Payment setup not completed yet - check for other incomplete steps
          if (data.paymentSetup && data.paymentSetup.connectStatus !== "not_started") {
            completedSteps.push('paymentSetup');
          }
          
          // Set current step to the first incomplete step
          const STEP_SEQUENCE: OnboardingStepId[] = [
            "business",
            "website",
            "location",
            "team",
            "branding",
            "services",
            "availability",
            "notifications",
            "policies",
            "giftCards",
            "paymentSetup",
            "goLive"
          ];
          
          const firstIncomplete = STEP_SEQUENCE.find(step => !completedSteps.includes(step));
          if (firstIncomplete) {
            console.log('[OnboardingProvider] Setting step to first incomplete:', firstIncomplete);
            dispatch({ type: "SET_STEP", payload: firstIncomplete });
          } else if (completedSteps.length > 0) {
            // All steps completed, go to goLive
            console.log('[OnboardingProvider] All steps completed, going to goLive');
            dispatch({ type: "SET_STEP", payload: "goLive" });
          } else {
            // Fallback: start at step 1
            console.log('[OnboardingProvider] No completed steps, starting at business');
            dispatch({ type: "SET_STEP", payload: "business" });
          }
          
          console.log('[OnboardingProvider] Returning user - loaded from database, completed steps:', completedSteps, 'starting at:', firstIncomplete || 'goLive');
        } catch (error) {
          console.error('[OnboardingProvider] Error loading onboarding state from database:', error);
          // On error, start fresh at step 1
          dispatch({ type: "SET_STEP", payload: "business" });
        } finally {
          setIsHydrated(true);
        }
      };
      
      loadStateFromDatabase();
    }
  }, [isHydrated]);

  const setStep = React.useCallback((step: OnboardingStepId) => {
    console.log('[OnboardingContext] setStep called with:', step);
    console.log('[OnboardingContext] Current step before setStep:', state.currentStep);
    dispatch({ type: "SET_STEP", payload: step });
    // Log after dispatch (will be updated on next render)
    setTimeout(() => {
      console.log('[OnboardingContext] Step should now be:', step);
    }, 0);
  }, [state.currentStep]);

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

  const saveNotifications = React.useCallback((payload: { templates: NotificationTemplate[]; enabled: boolean }) => {
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
    const bookingUrl = `https://${slug}.main.tld`;
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
    () => {
      // Log when availability changes in the memoized value
      if (state.availability && state.availability.length > 0) {
        console.log('[OnboardingProvider] Memoized value includes availability:', {
          length: state.availability.length,
          services: state.availability.map((a: any) => a.serviceId),
          totalSlots: state.availability.reduce((sum: number, a: any) => 
            sum + (a.staff?.reduce((staffSum: number, st: any) => staffSum + (st.slots?.length || 0), 0) || 0), 0
          )
        });
      }
      
      return {
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
      };
    },
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
  
  // Log state changes for debugging
  React.useEffect(() => {
    console.log('[OnboardingProvider] State changed - availability:', {
      length: state.availability?.length || 0,
      services: state.availability?.map((a: any) => a.serviceId) || [],
      currentStep: state.currentStep,
      completedSteps: state.completedSteps
    });
  }, [state.availability, state.currentStep]);

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




