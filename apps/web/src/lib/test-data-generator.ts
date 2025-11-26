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

// Random color palette
const COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B739", "#95A5A6"];

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
 */
export function generateTeamData(count: number = 3): StaffMember[] {
  const staff: StaffMember[] = [];
  const usedColors = new Set<string>();
  
  for (let i = 0; i < count; i++) {
    const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    
    // Pick an unused color
    let color = COLORS[Math.floor(Math.random() * COLORS.length)];
    while (usedColors.has(color) && usedColors.size < COLORS.length) {
      color = COLORS[Math.floor(Math.random() * COLORS.length)];
    }
    usedColors.add(color);
    
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
  
  return {
    primaryColor: primaryColor,
    logoUrl: undefined, // Will be set if uploaded
    recommendedDimensions: {
      width: 960,
      height: 1280
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
 */
export function generateAvailabilityData(
  services: ServiceCategory[],
  staff: StaffMember[]
): ServiceAvailability[] {
  const availability: ServiceAvailability[] = [];
  
  // Generate availability for each service
  for (const category of services) {
    for (const service of category.services) {
      // Create availability for each staff assigned to this service
      const staffAvailabilityList: StaffAvailability[] = [];
      
      for (const staffId of service.staffIds) {
        const staffMember = staff.find(s => s.id === staffId);
        if (!staffMember) continue;
        
        // Generate weekly availability slots (Mon-Fri, 9am-5pm)
        const slots: AvailabilitySlot[] = [];
        
        // Monday through Friday
        const weekdays: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];
        
        weekdays.forEach(day => {
          slots.push({
            id: `slot-${Date.now()}-${staffId}-${day}`,
            day: day,
            startTime: "09:00",
            endTime: "17:00"
          });
        });
        
        staffAvailabilityList.push({
          staffId: staffId,
          slots: slots
        });
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

