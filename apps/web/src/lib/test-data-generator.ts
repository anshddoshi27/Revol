/**
 * Test Data Generator for Onboarding Flow
 * 
 * Generates unique test data for each onboarding step.
 * Each time you call these functions, you get fresh, unique data.
 * 
 * This is for development/testing only - not used in production.
 */

import type {
  BusinessBasics,
  WebsiteConfig,
  LocationContacts,
  StaffMember,
  BrandingConfig,
  ServiceCategory,
  ServiceDefinition,
  ServiceAvailability,
  NotificationTemplate,
  PoliciesConfig,
  GiftCardConfig,
  DayOfWeek,
  StaffAvailability,
  AvailabilitySlot
} from "@/lib/onboarding-types";

// Generate unique identifier for each test session
const getUniqueId = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
};

// Generate unique subdomain
const getUniqueSubdomain = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `test-${random}-${timestamp}`;
};

// Generate random business names
const BUSINESS_NAMES = [
  "Studio Nova",
  "Zen Wellness Center",
  "Elite Hair Salon",
  "Serenity Spa",
  "Modern Med Spa",
  "Creative Tattoo Studio",
  "FitLife Gym",
  "Bliss Beauty Bar",
  "Urban Clinic",
  "Harmony Holistic"
];

// Generate random staff names
const FIRST_NAMES = ["Alex", "Jordan", "Sam", "Taylor", "Casey", "Morgan", "Riley", "Quinn", "Avery", "Cameron"];
const LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Wilson", "Moore"];

// Generate random service names
const SERVICE_NAMES = [
  "Haircut & Style",
  "Color Treatment",
  "Massage Therapy",
  "Facial Treatment",
  "Manicure & Pedicure",
  "Waxing Service",
  "Tattoo Consultation",
  "Personal Training",
  "Acupuncture",
  "Chiropractic Adjustment"
];

// Generate random category names
const CATEGORY_NAMES = [
  "Hair Services",
  "Color Services",
  "Spa Treatments",
  "Massage Therapy",
  "Beauty Services",
  "Wellness Services",
  "Fitness Training",
  "Medical Services",
  "Cosmetic Services",
  "Holistic Services"
];

// Random color palette (for categories, branding, etc.)
const COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B739", "#95A5A6"];

// Calendar colors for team members (auto-assigned in order)
const CALENDAR_COLORS = [
  "#FF0000", // Red (1st)
  "#0000FF", // Blue (2nd)
  "#00FF00", // Green (3rd)
  "#800080", // Purple (4th)
  "#FFFF00", // Yellow (5th)
  "#FFA500", // Orange (6th)
  "#FFFFFF", // White (7th)
  "#A52A2A", // Brown (8th)
];

/**
 * Generate test data for Signup Form
 * Each call generates unique email, name, and phone number
 * This ensures each account created is new and unique
 */
export function generateSignupData(): {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
} {
  const uniqueId = getUniqueId();
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  
  // Generate unique email using timestamp and random string
  // Use a real email provider domain that Supabase accepts
  // Gmail accepts + aliases, so test+unique@gmail.com will work
  const emailSuffix = uniqueId.replace(/[^a-z0-9]/g, '').substring(0, 8);
  const email = `test+${emailSuffix}@gmail.com`;
  
  // Generate unique phone number
  const phoneArea = Math.floor(Math.random() * 900) + 100; // 100-999
  const phoneExchange = Math.floor(Math.random() * 900) + 100; // 100-999
  const phoneNumber = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
  const phone = `+1${phoneArea}${phoneExchange}${phoneNumber}`;
  
  // Use a consistent test password that meets requirements
  const password = "Test123!@#";
  
  return {
    fullName: `${firstName} ${lastName}`,
    email: email,
    phone: phone,
    password: password,
    confirmPassword: password
  };
}

/**
 * Generate test data for Business Step
 */
export function generateBusinessData(): BusinessBasics {
  const uniqueId = getUniqueId();
  const businessName = BUSINESS_NAMES[Math.floor(Math.random() * BUSINESS_NAMES.length)];
  
  return {
    businessName: `${businessName} ${uniqueId.slice(-4)}`,
    description: `A premium ${businessName.toLowerCase()} offering top-quality services. We specialize in providing exceptional experiences for our clients with personalized attention and professional expertise.`,
    doingBusinessAs: `DBAs ${businessName} Inc.`,
    legalName: `${businessName} Inc.`,
    industry: BUSINESS_NAMES[Math.floor(Math.random() * BUSINESS_NAMES.length)]
  };
}

/**
 * Generate test data for Website Step
 */
export function generateWebsiteData(businessName?: string): WebsiteConfig {
  const subdomain = getUniqueSubdomain();
  
  return {
    subdomain: subdomain.substring(0, 63), // Ensure max length
    status: "idle" // Will be validated by the form
  };
}

/**
 * Generate test data for Location Step
 */
export function generateLocationData(): LocationContacts {
  const randomCity = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose"][
    Math.floor(Math.random() * 10)
  ];
  const states = ["NY", "CA", "IL", "TX", "AZ", "PA", "FL", "WA", "OR", "CO"];
  const state = states[Math.floor(Math.random() * states.length)];
  
  const randomNumber = Math.floor(Math.random() * 9999) + 100;
  
  return {
    timezone: "America/New_York",
    phone: `+1${randomNumber}${Math.floor(Math.random() * 9999)}${Math.floor(Math.random() * 9999)}`,
    supportEmail: `support+${getUniqueId()}@example.com`,
    website: `https://www.example${Math.floor(Math.random() * 100)}.com`,
    addressLine1: `${Math.floor(Math.random() * 9999) + 100} Main Street`,
    addressLine2: Math.random() > 0.5 ? `Suite ${Math.floor(Math.random() * 500) + 1}` : "",
    city: randomCity,
    stateProvince: state,
    postalCode: `${Math.floor(Math.random() * 90000) + 10000}`,
    country: "United States"
  };
}

/**
 * Generate test data for Team Step
 * Colors are automatically assigned based on position (1st = Red, 2nd = Blue, etc.)
 */
export function generateTeamData(count: number = 3): StaffMember[] {
  const staff: StaffMember[] = [];
  const maxCount = Math.min(count, CALENDAR_COLORS.length); // Limit to 8 members
  
  for (let i = 0; i < maxCount; i++) {
    const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    
    // Auto-assign color based on index (same as team-step component)
    const color = CALENDAR_COLORS[i];
    
    const roles = ["Stylist", "Therapist", "Trainer", "Practitioner", "Specialist", "Consultant"];
    
    staff.push({
      id: `staff-${Date.now()}-${i}`,
      name: `${firstName} ${lastName}`,
      role: roles[Math.floor(Math.random() * roles.length)],
      color: color,
      active: true
    });
  }
  
  return staff;
}

/**
 * Generate test data for Branding Step
 */
export function generateBrandingData(): BrandingConfig {
  const primaryColor = COLORS[Math.floor(Math.random() * COLORS.length)];
  const secondaryColors = ["#1a1a2e", "#0f0f1a", "#1e1e2d", "#252538", "#16161d"];
  const secondaryColor = secondaryColors[Math.floor(Math.random() * secondaryColors.length)];
  const fonts = ["Inter", "Poppins", "Playfair Display", "Montserrat", "Lora", "Roboto", "Open Sans", "Raleway", "Merriweather", "DM Sans"] as const;
  const buttonShapes = ["rounded", "slightly-rounded", "square"] as const;
  
  return {
    primaryColor: primaryColor,
    secondaryColor: secondaryColor,
    logoUrl: undefined, // Will be set if uploaded
    logoName: undefined,
    fontFamily: fonts[Math.floor(Math.random() * fonts.length)],
    buttonShape: buttonShapes[Math.floor(Math.random() * buttonShapes.length)],
    heroImageUrl: undefined, // Will be set if uploaded
    heroImageName: undefined,
    bookingPageDescription: undefined,
    recommendedDimensions: {
      width: 200,
      height: 200
    }
  };
}

/**
 * Generate test data for Services Step
 */
export function generateServicesData(staff: StaffMember[] = []): ServiceCategory[] {
  const categories: ServiceCategory[] = [];
  const numCategories = Math.floor(Math.random() * 3) + 2; // 2-4 categories
  const usedColors = new Set<string>();
  
  for (let i = 0; i < numCategories; i++) {
    const categoryName = CATEGORY_NAMES[Math.floor(Math.random() * CATEGORY_NAMES.length)];
    
    // Pick an unused color
    let categoryColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    while (usedColors.has(categoryColor) && usedColors.size < COLORS.length) {
      categoryColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    }
    usedColors.add(categoryColor);
    
    const numServices = Math.floor(Math.random() * 3) + 2; // 2-4 services per category
    const services: ServiceDefinition[] = [];
    
    for (let j = 0; j < numServices; j++) {
      const serviceName = SERVICE_NAMES[Math.floor(Math.random() * SERVICE_NAMES.length)];
      const durations = [30, 45, 60, 90, 120];
      const duration = durations[Math.floor(Math.random() * durations.length)];
      const prices = [5000, 7500, 10000, 15000, 20000, 25000]; // $50-$250
      const price = prices[Math.floor(Math.random() * prices.length)];
      
      // Assign random staff (at least one)
      const numStaff = Math.floor(Math.random() * Math.min(staff.length, 3)) + 1;
      const assignedStaff = staff.slice(0, Math.min(numStaff, staff.length)).map(s => s.id);
      
      services.push({
        id: `service-${Date.now()}-${i}-${j}`,
        name: `${serviceName} ${j + 1}`,
        description: `Professional ${serviceName.toLowerCase()} service with personalized attention. Includes consultation and follow-up.`,
        durationMinutes: duration,
        priceCents: price,
        instructions: `Please arrive 10 minutes early. Bring any relevant documents or previous records if applicable.`,
        staffIds: assignedStaff.length > 0 ? assignedStaff : (staff.length > 0 ? [staff[0].id] : [])
      });
    }
    
    categories.push({
      id: `category-${Date.now()}-${i}`,
      name: categoryName,
      description: `All ${categoryName.toLowerCase()} offerings`,
      color: categoryColor,
      services: services
    });
  }
  
  return categories;
}

/**
 * Generate test data for Availability Step
 * Returns slots in the format expected by the availability step component
 * 
 * IMPORTANT: Ensures the same person (staff member) never has overlapping slots
 * across different services. Different people can have overlapping slots, which is fine.
 */
export function generateAvailabilityData(
  services: ServiceCategory[],
  staff: StaffMember[]
): ServiceAvailability[] {
  const availability: ServiceAvailability[] = [];
  
  // Step 1: Build a map of staff member -> services they're assigned to
  const staffToServices = new Map<string, Array<{ serviceId: string; category: ServiceCategory; service: ServiceDefinition }>>();
  
  for (const category of services) {
    for (const service of category.services) {
      for (const staffId of service.staffIds) {
        if (!staffToServices.has(staffId)) {
          staffToServices.set(staffId, []);
        }
        staffToServices.get(staffId)!.push({ serviceId: service.id, category, service });
      }
    }
  }
  
  // Step 2: For each staff member, generate non-overlapping time slots across all their services
  // Track slots already assigned to each staff member to prevent overlaps
  const staffSlotTracker = new Map<string, Set<string>>(); // staffId -> Set of "day:startTime:endTime"
  
  // Step 3: Generate availability entries for each service
  for (const category of services) {
    for (const service of category.services) {
      const staffAvailabilityList: StaffAvailability[] = [];
      
      for (const staffId of service.staffIds) {
        const staffMember = staff.find(s => s.id === staffId);
        if (!staffMember) continue;
        
        // Get or create slot tracker for this staff member
        if (!staffSlotTracker.has(staffId)) {
          staffSlotTracker.set(staffId, new Set());
        }
        const slotTracker = staffSlotTracker.get(staffId)!;
        
        // Get all services this staff member is assigned to
        const staffServices = staffToServices.get(staffId) || [];
        const serviceIndex = staffServices.findIndex(s => s.serviceId === service.id);
        const totalServicesForStaff = staffServices.length;
        
        // Generate slots that don't overlap with slots already assigned to this staff
        // for other services. We'll divide the day into time windows and assign
        // different windows to different services.
        const slots: AvailabilitySlot[] = [];
        const weekdays: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];
        
        // Time windows we can use (9am-12pm, 12pm-5pm, or entire day 9am-5pm)
        const timeWindows: Array<{ start: string; end: string }> = [
          { start: "09:00", end: "17:00" }, // Full day (default if only one service)
          { start: "09:00", end: "12:00" }, // Morning window
          { start: "13:00", end: "17:00" }, // Afternoon window
        ];
        
        weekdays.forEach(day => {
          // Determine which time window to use for this service
          let timeWindow: { start: string; end: string };
          
          if (totalServicesForStaff === 1) {
            // Only one service - use full day
            timeWindow = timeWindows[0];
          } else {
            // Multiple services - assign different time windows
            // Cycle through available windows to distribute them
            const windowIndex = serviceIndex % (timeWindows.length - 1) + 1; // Skip full day (index 0) when multiple services
            timeWindow = timeWindows[windowIndex];
          }
          
          // Create a unique key for this slot
          const slotKey = `${day}:${timeWindow.start}:${timeWindow.end}`;
          
          // Only create this slot if the staff member doesn't already have a slot
          // at this exact time for another service
          if (!slotTracker.has(slotKey)) {
            slots.push({
              id: `slot-${Date.now()}-${staffId}-${service.id}-${day}`,
              day: day,
              startTime: timeWindow.start,
              endTime: timeWindow.end
            });
            
            // Mark this time slot as used for this staff member
            slotTracker.add(slotKey);
          }
        });
        
        if (slots.length > 0) {
          staffAvailabilityList.push({
            staffId: staffId,
            slots: slots
          });
        }
      }
      
      if (staffAvailabilityList.length > 0) {
        availability.push({
          serviceId: service.id,
          staff: staffAvailabilityList
        });
      }
    }
  }
  
  return availability;
}

/**
 * Generate test data for Notifications Step
 */
export function generateNotificationsData(): NotificationTemplate[] {
  return [
    {
      id: "booking-created",
      name: "Booking received",
      channel: "email",
      category: "confirmation",
      trigger: "booking_created",
      subject: "We received your booking — no charge yet",
      body: "Hi ${customer.name}, we locked in ${service.name} on ${booking.date} at ${booking.time}. No payment has been taken. We'll only charge after your appointment per ${business.name} policies.",
      enabled: true
    },
    {
      id: "reminder-24h",
      name: "24 hour reminder",
      channel: "sms",
      category: "reminder",
      trigger: "reminder_24h",
      body: "Friendly reminder for ${service.name} on ${booking.date} at ${booking.time}. Reply C to cancel. Policies: ${booking.url}",
      enabled: true
    },
    {
      id: "reminder-1h",
      name: "1 hour reminder",
      channel: "sms",
      category: "reminder",
      trigger: "reminder_1h",
      body: "See you soon! ${service.name} starts in 1 hour at ${booking.time}.",
      enabled: true
    },
    {
      id: "booking-completed",
      name: "Booking completed receipt",
      channel: "email",
      category: "completion",
      trigger: "booking_completed",
      subject: "Receipt for ${service.name}",
      body: "Thank you for visiting ${business.name}! Your ${service.name} on ${booking.date} has been completed. Total charged: ${service.price}.",
      enabled: true
    },
    {
      id: "no-show-fee",
      name: "No-show fee charged",
      channel: "email",
      category: "fee",
      trigger: "fee_charged",
      subject: "No-show fee processed",
      body: "Hi ${customer.name}, we applied the no-show fee for ${service.name} per policy. Total charged: ${service.price}. View details: ${booking.url}",
      enabled: false
    }
  ];
}

/**
 * Generate test data for Policies Step
 */
export function generatePoliciesData(): PoliciesConfig {
  return {
    cancellationPolicy: "Cancellations must be made at least 24 hours in advance to receive a full refund. Cancellations made less than 24 hours before the appointment will incur a 50% cancellation fee.",
    cancellationFeeType: "percent",
    cancellationFeeValue: 50,
    noShowPolicy: "No-show appointments will be charged a 50% no-show fee based on the service price. Repeated no-shows may result in requiring a deposit for future bookings.",
    noShowFeeType: "percent",
    noShowFeeValue: 50,
    refundPolicy: "Refunds are available within 48 hours of service completion. Refund requests after 48 hours will be reviewed on a case-by-case basis.",
    cashPolicy: "We accept cash payments, but payment must be completed at the time of service. For cash payments, please bring exact change when possible."
  };
}

/**
 * Generate test data for Gift Cards Step
 */
export function generateGiftCardsData(): GiftCardConfig {
  return {
    enabled: true,
    amountType: "amount", // or "percent"
    amountValue: 25, // percentage if amountType is "percent", or cents if "amount"
    expirationEnabled: true,
    expirationMonths: 12,
    generatedCodes: []
  };
}

/**
 * Generate test data for Payment Setup Step
 */
export function generatePaymentSetupData(): any {
  return {
    subscriptionStatus: "trial",
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    nextBillDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };
}

