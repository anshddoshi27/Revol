"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, ShieldAlert } from "lucide-react";

import { PublicBookingExperience } from "@/components/public-booking/booking-flow";
import { Button } from "@/components/ui/button";

interface PublicBookingPageProps {
  params: {
    slug: string;
  };
}

interface BusinessData {
  id: string;
  name: string;
  description?: string;
  subdomain: string;
  timezone: string;
  subscription_status: string;
  // Branding fields
  brand_primary_color?: string;
  brand_secondary_color?: string;
  use_gradient?: boolean;
  logo_url?: string;
  brand_font_family?: string;
  brand_button_shape?: string;
  hero_image_url?: string;
  booking_page_description?: string;
  // Contact/location
  support_email?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

interface CatalogData {
  business: BusinessData;
  categories: any[];
  staff: any[];
  acceptedPaymentMethods?: string[];
  policies?: {
    cancellationPolicy: string;
    cancellationFeeType: 'flat' | 'percent';
    cancellationFeeValue: number;
    noShowPolicy: string;
    noShowFeeType: 'flat' | 'percent';
    noShowFeeValue: number;
    refundPolicy: string;
    cashPolicy: string;
  };
}

export default function PublicBookingPage({ params }: PublicBookingPageProps) {
  const slug = (params.slug || "").toLowerCase();
  const [catalogData, setCatalogData] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBusinessData() {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch with cache-busting timestamp to ensure we get the latest branding config
        const timestamp = new Date().getTime();
        const response = await fetch(`/api/public/${slug}/catalog?t=${timestamp}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          }
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('not_found');
          } else {
            setError('server_error');
          }
          return;
        }
        
        const data = await response.json();
        setCatalogData(data);
      } catch (err) {
        console.error('Error loading business data:', err);
        setError('server_error');
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      loadBusinessData();
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4 text-white/60">
          <Loader2 className="h-10 w-10 animate-spin text-white/80" aria-hidden="true" />
          <p className="text-sm uppercase tracking-[0.35em] text-white/40">Preparing booking site</p>
        </div>
      </div>
    );
  }

  if (error === 'not_found' || !catalogData) {
    return (
      <StatusScreen
        icon={<AlertCircle className="h-10 w-10 text-white/70" aria-hidden="true" />}
        title="Booking page not found"
        description="We couldn't find a live booking site for this link. Double-check the URL or ask the business owner to publish their site."
      />
    );
  }

  if (error === 'server_error') {
    return (
      <StatusScreen
        icon={<AlertCircle className="h-10 w-10 text-white/70" aria-hidden="true" />}
        title="Unable to load booking site"
        description="There was an error loading the booking site. Please try again later."
      />
    );
  }

  if (catalogData.business.subscription_status === "canceled") {
    return (
      <StatusScreen
        icon={<ShieldAlert className="h-10 w-10 text-white/70" aria-hidden="true" />}
        title={`${catalogData.business.name} is offline`}
        description="This business paused or canceled their subscription, so the booking site is temporarily unavailable."
      />
    );
  }

  // Transform catalog data to match what PublicBookingExperience expects
  const business = {
    id: catalogData.business.id,
    name: catalogData.business.name,
    slug: catalogData.business.subdomain,
    bookingUrl: `/${catalogData.business.subdomain}`,
    previewUrl: `/${catalogData.business.subdomain}`,
    status: catalogData.business.subscription_status as "trial" | "active" | "paused" | "canceled",
    createdAt: new Date().toISOString(),
  };

  // Transform categories to match ServiceCategory format
  const transformedCategories = catalogData.categories.map((cat: any) => ({
    id: cat.id,
    name: cat.name,
    description: cat.description || undefined,
    color: cat.color || "#000000",
    services: (cat.services || []).map((svc: any) => ({
      id: svc.id,
      name: svc.name,
      description: svc.description || undefined,
      // API returns duration_min, not duration_minutes
      durationMinutes: svc.duration_min || svc.duration_minutes || 60,
      priceCents: svc.price_cents || 0,
      instructions: svc.pre_appointment_instructions || undefined,
      staffIds: svc.staffIds || [],
      imageUrl: svc.image_url || undefined,
    })),
  }));

  // Transform staff to match StaffMember format - include all new fields
  const transformedStaff = catalogData.staff.map((s: any) => ({
    id: s.id,
    name: s.name,
    role: s.role || undefined,
    color: s.color || "#000000",
    active: true,
    imageUrl: s.imageUrl || undefined,
    description: s.description || undefined,
    review: s.review || undefined,
    reviewerName: s.reviewerName || undefined,
  }));

  const workspace = {
    identity: {
      business: {
        businessName: catalogData.business.name,
        description: catalogData.business.description || "",
        doingBusinessAs: catalogData.business.name,
        legalName: catalogData.business.name,
        industry: "",
      },
      location: {
        timezone: catalogData.business.timezone,
        phone: catalogData.business.phone || "",
        supportEmail: catalogData.business.support_email || "",
        website: undefined,
        addressLine1: catalogData.business.street || "",
        addressLine2: undefined,
        city: catalogData.business.city || "",
        stateProvince: catalogData.business.state || "",
        postalCode: catalogData.business.postal_code || "",
        country: catalogData.business.country || "",
      },
      branding: {
        primaryColor: catalogData.business.brand_primary_color || "#5B64FF",
        secondaryColor: catalogData.business.brand_secondary_color || "#1a1a2e",
        useGradient: catalogData.business.use_gradient ?? true,
        logoUrl: catalogData.business.logo_url,
        logoName: undefined,
        fontFamily: (catalogData.business.brand_font_family || "Inter") as any,
        buttonShape: (catalogData.business.brand_button_shape || "rounded") as any,
        heroImageUrl: catalogData.business.hero_image_url,
        heroImageName: undefined,
        bookingPageDescription: catalogData.business.booking_page_description,
        recommendedDimensions: {
          width: 200,
          height: 200,
        },
      },
      website: {
        subdomain: catalogData.business.subdomain,
        status: "reserved" as const,
      },
    },
    staff: transformedStaff,
    catalog: transformedCategories,
    availability: [],
    availabilityTemplates: [],
    notifications: [],
    policies: catalogData.policies || {
      cancellationPolicy: "",
      cancellationFeeType: "flat" as const,
      cancellationFeeValue: 0,
      noShowPolicy: "",
      noShowFeeType: "flat" as const,
      noShowFeeValue: 0,
      refundPolicy: "",
      cashPolicy: "",
    },
    giftCards: {
      config: {
        enabled: false,
        amountType: "amount" as const,
        amountValue: 0,
        expirationEnabled: false,
        expirationMonths: undefined,
        generatedCodes: [],
      },
      restoreBalanceOnRefund: false,
      ledger: [],
    },
    payment: {
      connectStatus: "not_started" as const,
      acceptedMethods: (catalogData.acceptedPaymentMethods && catalogData.acceptedPaymentMethods.length > 0) 
        ? catalogData.acceptedPaymentMethods as ("card" | "apple_pay" | "google_pay" | "cash")[]
        : ["card"], // Default to card if not specified
      subscriptionStatus: catalogData.business.subscription_status as "trial" | "active" | "paused" | "canceled",
      keepSiteLiveWhenPaused: false,
      payLinkAutomationEnabled: false,
    },
    bookings: [],
    customers: [],
    analytics: {
      revenueByMonth: [],
      bookingsByStatus: [],
      staffUtilization: [],
      feeBreakdown: {
        totalCapturedCents: 0,
        platformFeeCents: 0,
        stripeFeeCents: 0,
        netPayoutCents: 0,
      },
      noShowRatePercent: 0,
    },
  };

  const recordPublicBooking = async (payload: any) => {
    try {
      // Transform payload to match API expectations
      const apiPayload = {
        service_id: payload.serviceId,
        staff_id: payload.staffId,
        start_at: payload.startDateTime, // API expects start_at
        customer: payload.customer,
        gift_card_code: payload.giftCard?.code,
      };

      const response = await fetch(`/api/public/${slug}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create booking');
      }

      const apiResponse = await response.json();
      
      // Validate dates before using them
      const startDateTime = payload.startDateTime;
      const endDateTime = payload.endDateTime;
      
      if (!startDateTime || !endDateTime) {
        throw new Error('Missing start or end date time in booking response');
      }
      
      // Validate dates are valid
      const startDate = new Date(startDateTime);
      const endDate = new Date(endDateTime);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Invalid date values in booking');
      }
      
      // Transform API response to match FakeBooking format expected by frontend
      return {
        id: apiResponse.booking_id,
        code: apiResponse.booking_code || `REVOL-${apiResponse.booking_id?.slice(0, 8).toUpperCase()}`,
        status: 'pending',
        serviceId: payload.serviceId,
        serviceName: '', // Will be set by frontend from selectedService
        categoryName: '', // Will be set by frontend
        durationMinutes: 0, // Will be set by frontend
        startDateTime: startDateTime,
        endDateTime: endDateTime,
        staff: null, // Will be set by frontend
        customer: {
          name: payload.customer.name,
          email: payload.customer.email,
          phone: payload.customer.phone || '',
        },
        payments: [],
        financials: {
          listPriceCents: 0,
          giftCardAmountCents: payload.giftCard?.amountCents || 0,
          platformFeeCents: 0,
          stripeFeeEstimateCents: 0,
          netPayoutCents: 0,
          currency: 'usd',
        },
        policyConsent: payload.consent || {
          hash: '',
          acceptedAt: new Date().toISOString(),
          ip: '',
          userAgent: '',
        },
        requiresAction: false,
      };
    } catch (error) {
      console.error('Error creating booking:', error);
      throw error;
    }
  };

  return (
    <PublicBookingExperience
      business={business}
      workspace={workspace}
      recordBooking={recordPublicBooking}
    />
  );
}

function StatusScreen({
  icon,
  title,
  description
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black via-slate-950 to-black px-6 text-white">
      <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-10 text-center backdrop-blur">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
          {icon}
        </div>
        <h1 className="mt-6 font-display text-3xl">{title}</h1>
        <p className="mt-3 text-sm text-white/60">{description}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button asChild variant="outline" className="border-white/20 text-white/70 hover:text-white">
            <Link href="/">Return to Revol</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}


