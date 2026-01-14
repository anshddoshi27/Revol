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
  imageUrl?: string;
  description?: string;
  review?: string;
  reviewerName?: string;
}

export type ButtonShape = 'rounded' | 'slightly-rounded' | 'square';

export type FontFamily = 
  | 'Inter'
  | 'Poppins'
  | 'Playfair Display'
  | 'Montserrat'
  | 'Lora'
  | 'Roboto'
  | 'Open Sans'
  | 'Raleway'
  | 'Merriweather'
  | 'DM Sans';

export interface BrandingConfig {
  // Colors
  primaryColor: string;
  secondaryColor: string;
  useGradient?: boolean; // Whether to use gradients or solid colors
  
  // Logo (small square, top-right of booking page)
  logoUrl?: string;
  logoName?: string;
  
  // Typography
  fontFamily: FontFamily;
  
  // Button styling
  buttonShape: ButtonShape;
  
  // Hero image (optional header background or side image)
  heroImageUrl?: string;
  heroImageName?: string;
  
  // Business description for booking page (under title)
  bookingPageDescription?: string;
  
  // Deprecated but kept for compatibility
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
  imageUrl?: string;
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
  paymentMethodId?: string; // Stripe payment method ID for subscription
}




