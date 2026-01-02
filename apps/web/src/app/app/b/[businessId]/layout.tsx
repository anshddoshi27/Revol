"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useParams } from "next/navigation";
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  BookOpenCheck,
  CalendarRange,
  CreditCard,
  Gift,
  Layers3,
  LayoutDashboard,
  LifeBuoy,
  Settings2,
  UsersRound
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFakeBusiness } from "@/lib/fake-business";
import { createClientClient } from "@/lib/supabase-client";
import { deriveCustomersFromBookings, recomputeAnalytics, type FakeBooking, type FakeCustomer, type FakePayment } from "@/lib/admin-workspace";
import type { ServiceCategory, StaffMember } from "@/lib/onboarding-types";
// Removed DEV_WORKSPACE_SEED import - we use ONLY user data, no seed data
import type { User } from "@supabase/supabase-js";
import { isNotificationsEnabled } from "@/lib/feature-flags";

const NAV_ITEMS = [
  {
    label: "Past bookings",
    segment: "",
    icon: <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
  },
  {
    label: "Calendar",
    segment: "calendar",
    icon: <CalendarRange className="h-4 w-4" aria-hidden="true" />
  },
  {
    label: "Analytics",
    segment: "analytics",
    icon: <BarChart3 className="h-4 w-4" aria-hidden="true" />
  },
  {
    label: "Catalog",
    segment: "catalog",
    icon: <Layers3 className="h-4 w-4" aria-hidden="true" />
  },
  {
    label: "Staff",
    segment: "staff",
    icon: <UsersRound className="h-4 w-4" aria-hidden="true" />
  },
  {
    label: "Availability",
    segment: "availability",
    icon: <Activity className="h-4 w-4" aria-hidden="true" />
  },
  {
    label: "Notifications",
    segment: "notifications",
    icon: <LifeBuoy className="h-4 w-4" aria-hidden="true" />
  },
  {
    label: "Policies",
    segment: "policies",
    icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
  },
  {
    label: "Gift cards",
    segment: "gift-cards",
    icon: <Gift className="h-4 w-4" aria-hidden="true" />
  },
  {
    label: "Payments",
    segment: "payments",
    icon: <CreditCard className="h-4 w-4" aria-hidden="true" />
  },
  {
    label: "Customers",
    segment: "customers",
    icon: <BadgeDollarSign className="h-4 w-4" aria-hidden="true" />
  },
  {
    label: "Account",
    segment: "account",
    icon: <Settings2 className="h-4 w-4" aria-hidden="true" />
  }
] as const;

export default function AdminBusinessLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const params = useParams<{ businessId: string }>();
  const pathname = usePathname();
  const { business: fakeBusiness, workspace, loadSeedBusiness, createBusiness, bootstrapWorkspace, clearBusiness, updateWorkspace } = useFakeBusiness();
  
  const [user, setUser] = useState<User | null>(null);
  const [realBusiness, setRealBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const supabase = createClientClient();

  // Function to refresh bookings only (for auto-refresh polling)
  const refreshBookingsOnly = async () => {
    if (!realBusiness?.id || !user || !workspace) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch(`/api/business/${realBusiness.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
      });

      if (response.ok) {
        const apiData = await response.json();
        const bookings = apiData.bookings || [];
        const bookingPayments = apiData.bookingPayments || [];
        const catalog = workspace?.catalog || [];
        const staff = workspace?.staff || [];

        // Always update, even if bookings array is empty
        const transformedBookings = transformBookingsFromAPI(
          bookings,
          bookingPayments,
          catalog,
          staff
        );

        // Update workspace with fresh bookings
        updateWorkspace((existing) => {
          const updatedCustomers = deriveCustomersFromBookings(transformedBookings);
          const updatedAnalytics = recomputeAnalytics(transformedBookings);
          
          console.log('[layout] Auto-refreshed bookings:', {
            bookingsCount: transformedBookings.length,
            customersCount: updatedCustomers.length,
          });
          
          return {
            ...existing,
            bookings: transformedBookings,
            customers: updatedCustomers,
            analytics: updatedAnalytics,
          };
        });
      }
    } catch (error) {
      console.error('[layout] Error refreshing bookings:', error);
    }
  };

  // Function to load business data (extracted for reuse) - NOT USED, kept for reference
  const loadBusinessData_UNUSED = async (businessData: any, currentUser: User) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No session token');
      }

      const response = await fetch(`/api/business/${businessData.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
      });

      if (response.ok) {
        const apiData = await response.json();
        console.log('[layout] Real business data loaded from database:', {
          business: apiData.business?.name,
          businessId: apiData.business?.id,
          services: apiData.services?.length || 0,
          bookings: apiData.bookings?.length || 0,
          staff: apiData.staff?.length || 0,
        });

        // Transform and populate workspace (same logic as before)
        if (!apiData.business) {
          console.error('[layout] No business data in API response:', apiData);
          throw new Error('Business data not found in API response');
        }

        if (apiData.business) {
          // Create business object
          const transformedBusiness = {
            id: apiData.business.id,
            name: apiData.business.name,
            slug: apiData.business.subdomain || apiData.business.id,
            bookingUrl: `https://${apiData.business.subdomain}.main.tld`,
            previewUrl: `/public/${apiData.business.subdomain}`,
            status: (apiData.business.subscription_status as "trial" | "active" | "paused" | "canceled") || "trial",
            createdAt: apiData.business.created_at,
            trialEndsAt: apiData.business.trial_ends_at,
            nextBillDate: apiData.business.next_bill_at,
          };

          // Transform services into catalog format
          const categoriesMap = new Map();
          if (apiData.categories && apiData.categories.length > 0) {
            apiData.categories.forEach((cat: any) => {
              categoriesMap.set(cat.id, {
                id: cat.id,
                name: cat.name,
                description: cat.description || '',
                color: cat.color || '#5B64FF',
                services: [],
              });
            });
          }

          // Group services by category
          (apiData.services || []).forEach((service: any) => {
            const categoryId = service.category_id || 'uncategorized';
            if (!categoriesMap.has(categoryId)) {
              categoriesMap.set(categoryId, {
                id: categoryId,
                name: 'Uncategorized',
                description: '',
                color: '#5B64FF',
                services: [],
              });
            }
            const staffIds = apiData.staffServiceMap?.[service.id] || [];
            categoriesMap.get(categoryId).services.push({
              id: service.id,
              name: service.name,
              description: service.description || '',
              durationMin: service.duration_min || 60,
              priceCents: service.price_cents || 0,
              staffIds: staffIds,
            });
          });

          const catalog = Array.from(categoriesMap.values());

          // Transform staff
          const staff = (apiData.staff || []).map((s: any) => ({
            id: s.id,
            name: s.name,
            email: s.email || '',
            phone: s.phone || '',
            color: s.color || '#5B64FF',
            role: s.role || 'staff',
          }));

          // Transform bookings
          const bookings: FakeBooking[] = (apiData.bookings || []).map((b: any) => ({
            id: b.id,
            serviceId: b.service_id,
            staffId: b.staff_id,
            customerId: b.customer_id,
            startAt: b.start_at,
            endAt: b.end_at,
            status: b.status || 'confirmed',
            priceCents: b.price_cents || 0,
            finalPriceCents: b.final_price_cents || b.price_cents || 0,
            createdAt: b.created_at,
          }));

          // Transform customers
          const customers: FakeCustomer[] = (apiData.customers || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone || '',
            createdAt: c.created_at,
          }));

          // Transform payments
          const payments: FakePayment[] = (apiData.bookingPayments || []).map((p: any) => ({
            id: p.id,
            bookingId: p.booking_id,
            amountCents: p.amount_cents || 0,
            moneyAction: p.money_action || 'charge',
            createdAt: p.created_at,
          }));

          // Update workspace with fresh data
          updateWorkspace((existing) => ({
            ...existing,
            business: transformedBusiness,
            catalog,
            staff,
            bookings,
            customers,
            payments,
            availability: apiData.availability || [],
            policies: apiData.policies || null,
            giftCards: apiData.giftCards || [],
            notificationTemplates: (apiData.notifications || []).map((nt: any) => ({
              id: nt.id || `notif_${Date.now()}`,
              name: nt.name || '',
              channel: (nt.channel || 'email') as 'email' | 'sms',
              category: nt.category || 'confirmation',
              trigger: nt.trigger || 'booking_created',
              subject: nt.subject || '',
              body: nt.body_markdown || nt.body || '',
              enabled: nt.is_enabled !== false,
            })),
          }));

          setLoading(false);
          setError(null);
        }
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to load business data: ${response.status} ${errorText}`);
      }
    } catch (error: any) {
      console.error('[layout] Error loading business data:', error);
      const errorMessage = error?.message || 'Unknown error';
      setError(`Error loading business data: ${errorMessage}. Please try refreshing the page.`);
      setLoading(false);
    }
  };

  // Check authentication and fetch business
  useEffect(() => {
    let cancelled = false;

    // Don't run if we're already redirecting
    if (isRedirecting) {
      return;
    }

    async function checkAuth() {
      try {
        console.log('Checking authentication...');
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
        
        if (cancelled) return;

        if (authError) {
          console.error('Auth error:', authError);
          setError(`Authentication error: ${authError.message}`);
          router.replace("/login");
          return;
        }

        if (!currentUser) {
          console.log('No authenticated user, redirecting to login');
          router.replace("/login");
          return;
        }

        console.log('User authenticated:', currentUser.email);
        setUser(currentUser);

        // Check if businessId is a UUID or subdomain
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.businessId);
        
        // Fetch business from database
        console.log('Fetching business:', params.businessId, isUUID ? '(UUID)' : '(subdomain)');
        
        let businessQuery = supabase
          .from('businesses')
          .select('id, name, subdomain, user_id')
          .eq('user_id', currentUser.id)
          .is('deleted_at', null);
        
        // Query by ID if UUID, otherwise by subdomain
        if (isUUID) {
          businessQuery = businessQuery.eq('id', params.businessId);
        } else {
          businessQuery = businessQuery.eq('subdomain', params.businessId);
        }
        
        const { data: businessData, error: businessError } = await businessQuery.maybeSingle();

        if (cancelled) return;

        if (businessError) {
          console.error('Error fetching business:', businessError);
          setError(`Business query error: ${businessError.message}`);
          // Don't redirect immediately - let user see the error
          setLoading(false);
          return;
        }

        if (!businessData) {
          console.log('Business not found for user:', currentUser.id, 'businessId:', params.businessId);
          // Try to find any business for this user
          const { data: anyBusiness } = await supabase
            .from('businesses')
            .select('id, name, subdomain, user_id')
            .eq('user_id', currentUser.id)
            .is('deleted_at', null)
            .maybeSingle();
          
          if (anyBusiness) {
            console.log('Found different business, redirecting:', anyBusiness.id);
            router.replace(`/app/b/${anyBusiness.id}`);
            return;
          }
          
          console.log('No business found, redirecting to onboarding');
          router.replace("/onboarding");
          return;
        }

        console.log('Business found:', businessData.name);
        setRealBusiness(businessData);
        
        // If URL uses subdomain but we have UUID, redirect to UUID
        // Only redirect if we're actually using a subdomain (not UUID)
        if (!isUUID && businessData.id !== params.businessId) {
          // Prevent redirect loops - check if we're already on the correct path
          const currentPath = pathname || '';
          const expectedPath = currentPath.replace(`/app/b/${params.businessId}`, `/app/b/${businessData.id}`);
          
          // Only redirect if we're not already on the correct path
          if (currentPath !== expectedPath && !isRedirecting) {
            setIsRedirecting(true);
            // Split path: /app/b/novastudio/calendar -> ['', 'app', 'b', 'novastudio', 'calendar']
            const pathParts = currentPath.split('/');
            // Get everything after /app/b/{businessId} (skip first 4 parts: '', 'app', 'b', 'novastudio')
            const pathAfterBusiness = pathParts.slice(4).filter(Boolean).join('/');
            const redirectPath = pathAfterBusiness 
              ? `/app/b/${businessData.id}/${pathAfterBusiness}` 
              : `/app/b/${businessData.id}`;
            console.log('Redirecting from subdomain to UUID:', {
              from: currentPath,
              to: redirectPath,
              pathAfterBusiness,
              pathParts
            });
            // Use window.location for a hard redirect to avoid React Router issues
            window.location.href = redirectPath;
            return;
          }
        }
        
        // Load real business data from API and populate workspace
        console.log('Loading real business data from API...');
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) {
            throw new Error('No session token');
          }

          const response = await fetch(`/api/business/${businessData.id}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            credentials: 'include',
          });

          if (response.ok) {
            const apiData = await response.json();
            console.log('[layout] Real business data loaded from database:', {
              business: apiData.business?.name,
              businessId: apiData.business?.id,
              services: apiData.services?.length || 0,
              serviceNames: apiData.services?.map((s: any) => s.name) || [],
              staff: apiData.staff?.length || 0,
              staffNames: apiData.staff?.map((s: any) => s.name) || [],
              availability: apiData.availability?.length || 0,
              categoriesCount: apiData.categories?.length || 0,
              categoryNames: apiData.categories?.map((c: any) => c.name) || [],
              notificationsCount: apiData.notifications?.length || 0,
              hasPolicies: !!apiData.policies,
              hasGiftCards: !!apiData.giftCards,
              notificationsEnabled: apiData.business?.notifications_enabled,
              planType: apiData.business?.notifications_enabled === true ? 'Pro' : 'Basic',
              subscriptionStatus: apiData.business?.subscription_status,
              rawNotificationsEnabled: apiData.business?.notifications_enabled,
            });

            // Transform and populate fake business context with real data
            // Allow empty arrays for services and staff - they're valid
            if (!apiData.business) {
              console.error('[layout] No business data in API response:', apiData);
              throw new Error('Business data not found in API response');
            }

            if (apiData.business) {
              // Create business object
              const transformedBusiness = {
                id: apiData.business.id,
                name: apiData.business.name,
                slug: apiData.business.subdomain || apiData.business.id,
                bookingUrl: `https://${apiData.business.subdomain}.main.tld`,
                previewUrl: `/public/${apiData.business.subdomain}`,
                status: (apiData.business.subscription_status as "trial" | "active" | "paused" | "canceled") || "trial",
                createdAt: apiData.business.created_at,
                trialEndsAt: apiData.business.trial_ends_at,
                nextBillDate: apiData.business.next_bill_at,
              };

              // Transform services into catalog format - USING ONLY DATABASE DATA
              console.log('[layout] Transforming services from database:', {
                rawServicesCount: apiData.services?.length || 0,
                rawServices: apiData.services?.map((s: any) => ({ id: s.id, name: s.name, category_id: s.category_id })) || [],
                rawCategoriesCount: apiData.categories?.length || 0,
                rawCategories: apiData.categories?.map((c: any) => ({ id: c.id, name: c.name })) || [],
              });
              
              const categoriesMap = new Map();
              if (apiData.categories && apiData.categories.length > 0) {
                apiData.categories.forEach((cat: any) => {
                  categoriesMap.set(cat.id, {
                    id: cat.id,
                    name: cat.name, // Use database name, no defaults
                    description: cat.description || '',
                    color: cat.color || '#5B64FF',
                    services: [],
                  });
                });
              }

              // Group services by category - ONLY FROM DATABASE
              (apiData.services || []).forEach((service: any) => {
                const categoryId = service.category_id || 'uncategorized';
                if (!categoriesMap.has(categoryId)) {
                  categoriesMap.set(categoryId, {
                    id: categoryId,
                    name: 'Uncategorized',
                    description: '',
                    color: '#5B64FF',
                    services: [],
                  });
                }
                // Get staff IDs from the map
                const staffIds = apiData.staffServiceMap?.[service.id] || [];
                categoriesMap.get(categoryId).services.push({
                  id: service.id,
                  name: service.name, // Use database name, no defaults
                  description: service.description || '',
                  durationMinutes: service.duration_min || service.duration_minutes || 60,
                  priceCents: service.price_cents || 0,
                  instructions: service.pre_appointment_instructions || service.instructions || '',
                  staffIds: staffIds,
                });
              });

              const catalog = Array.from(categoriesMap.values());
              
              console.log('[layout] Transformed catalog from database:', {
                catalogCount: catalog.length,
                totalServices: catalog.reduce((sum, cat) => sum + cat.services.length, 0),
                servicesByCategory: catalog.map(cat => ({
                  category: cat.name,
                  services: cat.services.map(s => s.name)
                })),
              });

              // Transform staff (handle empty staff array)
              const staff = (apiData.staff || []).map((s: any) => ({
                id: s.id,
                name: s.name,
                role: s.role || '',
                color: s.color || '#5B64FF',
                active: s.active !== false,
              }));

              // Transform availability (handle empty availability array)
              // Map weekday numbers (0-6) to day name strings
              const WEEKDAY_TO_DAY: Record<number, string> = {
                0: 'sunday',
                1: 'monday',
                2: 'tuesday',
                3: 'wednesday',
                4: 'thursday',
                5: 'friday',
                6: 'saturday',
              };
              
              const availabilityMap = new Map();
              (apiData.availability || []).forEach((rule: any) => {
                const serviceId = rule.service_id;
                const staffId = rule.staff_id;
                if (!availabilityMap.has(serviceId)) {
                  availabilityMap.set(serviceId, {
                    serviceId: serviceId,
                    staff: [],
                  });
                }
                const entry = availabilityMap.get(serviceId);
                let staffEntry = entry.staff.find((s: any) => s.staffId === staffId);
                if (!staffEntry) {
                  staffEntry = { staffId: staffId, slots: [] };
                  entry.staff.push(staffEntry);
                }
                
                // Convert weekday number (0-6) to day name string
                // weekday is typically a number: 0=sunday, 1=monday, etc.
                const weekdayNum = rule.weekday ?? rule.day_of_week ?? rule.day;
                let dayString = 'monday'; // Default
                
                if (typeof weekdayNum === 'number' && weekdayNum >= 0 && weekdayNum <= 6) {
                  dayString = WEEKDAY_TO_DAY[weekdayNum] || 'monday';
                } else if (typeof weekdayNum === 'string') {
                  dayString = weekdayNum.toLowerCase();
                } else if (weekdayNum != null) {
                  // Try to convert to number first, then to day name
                  const num = Number(weekdayNum);
                  if (!isNaN(num) && num >= 0 && num <= 6) {
                    dayString = WEEKDAY_TO_DAY[num] || 'monday';
                  }
                }
                
                staffEntry.slots.push({
                  id: rule.id || `slot_${dayString}_${staffId}`,
                  day: dayString,
                  startTime: rule.start_time || rule.startTime || '09:00',
                  endTime: rule.end_time || rule.endTime || '17:00',
                });
              });
              const availability = Array.from(availabilityMap.values());

              // Bootstrap workspace with real data
              // Create proper BusinessBasics object from API data
              // businessName should come from the business name field, not industry
              const businessBasics = {
                businessName: apiData.business.name || '', // Use business name, not industry
                description: apiData.business.description || '',
                doingBusinessAs: apiData.business.dba_name || apiData.business.name || '',
                legalName: apiData.business.legal_name || apiData.business.name || '',
                industry: apiData.business.industry || '',
              };

              // Create workspace from ONLY user's actual data from database - NO seed data, NO separate API calls
              // All data comes from the business API response
              
              // Transform notification templates from database format
              const notificationTemplates = (apiData.notifications || []).map((nt: any) => ({
                id: nt.id || `notif_${Date.now()}`,
                name: nt.name || '',
                channel: (nt.channel || 'email') as 'email' | 'sms',
                category: nt.category || 'confirmation',
                trigger: nt.trigger || 'booking_created',
                subject: nt.subject || '', // email only
                body: nt.body_markdown || nt.body || '', // Use body_markdown from database
                enabled: nt.is_enabled !== false, // Use is_enabled from database
              }));

              // Transform gift card config from API format
              const giftCardConfig = apiData.giftCards ? {
                enabled: apiData.giftCards.enabled || false,
                amountType: (apiData.giftCards.amount_type || 'amount') as 'amount' | 'percent',
                amountValue: apiData.giftCards.amount_value || 10000,
                expirationEnabled: apiData.giftCards.expiration_enabled || false,
                generatedCodes: apiData.giftCards.generated_codes || [],
              } : {
                enabled: false,
                amountType: 'amount' as const,
                amountValue: 10000,
                expirationEnabled: false,
                generatedCodes: [],
              };

              // Build workspace input from ONLY user's actual data from database
              // Use ONLY the data that was entered during onboarding - no defaults, no seed data
              const seedInput = {
                business: businessBasics,
                website: apiData.website || {
                  subdomain: apiData.business.subdomain || '',
                  status: 'reserved' as const,
                  customDomain: undefined,
                },
                location: apiData.location || {
                  timezone: apiData.business.timezone || '',
                  phone: apiData.business.phone || '',
                  supportEmail: apiData.business.support_email || '',
                  website: apiData.business.website_url || '',
                  addressLine1: apiData.business.street || '',
                  addressLine2: '',
                  city: apiData.business.city || '',
                  stateProvince: apiData.business.state || '',
                  postalCode: apiData.business.postal_code || '',
                  country: apiData.business.country || '',
                },
                branding: apiData.branding || {
                  primaryColor: apiData.business.brand_primary_color || '',
                  secondaryColor: apiData.business.brand_secondary_color || undefined,
                  logoUrl: apiData.business.logo_url || undefined,
                  logoName: undefined,
                  recommendedDimensions: { width: 960, height: 1280 },
                },
                team: staff || [],
                categories: catalog || [],
                availability: availability || [],
                notifications: notificationTemplates,
                policies: apiData.policies ? {
                  // Map database field names to frontend format
                  // Database uses: cancellation_policy_text, cancel_fee_type, cancel_fee_amount_cents, cancel_fee_percent
                  cancellationPolicy: apiData.policies.cancellation_policy_text || '',
                  cancellationFeeType: (apiData.policies.cancel_fee_type === 'flat' ? 'amount' : 'percent') as 'amount' | 'percent',
                  cancellationFeeValue: apiData.policies.cancel_fee_type === 'flat' 
                    ? ((apiData.policies.cancel_fee_amount_cents || 0) / 100)
                    : (apiData.policies.cancel_fee_percent || 0),
                  noShowPolicy: apiData.policies.no_show_policy_text || '',
                  noShowFeeType: (apiData.policies.no_show_fee_type === 'flat' ? 'amount' : 'percent') as 'amount' | 'percent',
                  noShowFeeValue: apiData.policies.no_show_fee_type === 'flat'
                    ? ((apiData.policies.no_show_fee_amount_cents || 0) / 100)
                    : (apiData.policies.no_show_fee_percent || 0),
                  refundPolicy: apiData.policies.refund_policy_text || '',
                  cashPolicy: apiData.policies.cash_policy_text || '',
                } : {
                  cancellationPolicy: '',
                  cancellationFeeType: 'percent' as const,
                  cancellationFeeValue: 0,
                  noShowPolicy: '',
                  noShowFeeType: 'percent' as const,
                  noShowFeeValue: 0,
                  refundPolicy: '',
                  cashPolicy: '',
                },
                giftCards: giftCardConfig,
                payment: {
                  connectStatus: (apiData.business.stripe_connect_account_id ? 'active' : 'not_started') as const,
                  acceptedMethods: ['card'] as const,
                  subscriptionStatus: (apiData.business.subscription_status || 'trial') as const,
                  trialEndsAt: apiData.business.trial_ends_at,
                  nextBillDate: apiData.business.next_bill_at,
                },
              };

              try {
                // Log all services being used to verify they're from database
                const allServices = seedInput.categories.flatMap(cat => cat.services);
                console.log('[layout] Creating workspace with user data from database:', {
                  businessName: seedInput.business.businessName,
                  staffCount: seedInput.team.length,
                  staffNames: seedInput.team.map(s => s.name),
                  categoriesCount: seedInput.categories.length,
                  categoryNames: seedInput.categories.map(c => c.name),
                  servicesCount: allServices.length,
                  serviceNames: allServices.map(s => s.name), // Log actual service names
                  availabilityCount: seedInput.availability.length,
                  notificationsCount: seedInput.notifications.length,
                  hasPolicies: !!seedInput.policies,
                  hasGiftCards: seedInput.giftCards.enabled,
                  notificationsEnabled: apiData.business?.notifications_enabled,
                  planType: apiData.business?.notifications_enabled === true ? 'Pro' : 'Basic',
                  location: seedInput.location.city || 'Not set',
                  branding: seedInput.branding.primaryColor,
                  bookingsCount: apiData.bookings?.length || 0,
                });
                
                // Create business first
                createBusiness(transformedBusiness);
                
                // Then bootstrap workspace
                const workspaceResult = bootstrapWorkspace(seedInput);
                if (workspaceResult) {
                  console.log('[layout] Workspace populated with real data:', workspaceResult.identity.business.businessName);
                  
                  // Transform and add bookings from database
                  console.log('[layout] Bookings from API:', {
                    bookingsCount: apiData.bookings?.length || 0,
                    bookingPaymentsCount: apiData.bookingPayments?.length || 0,
                    sampleBooking: apiData.bookings?.[0] ? {
                      id: apiData.bookings[0].id,
                      status: apiData.bookings[0].status,
                      start_at: apiData.bookings[0].start_at,
                      service_id: apiData.bookings[0].service_id,
                    } : null,
                  });
                  
                  if (apiData.bookings && apiData.bookings.length > 0) {
                    const transformedBookings = transformBookingsFromAPI(
                      apiData.bookings,
                      apiData.bookingPayments || [],
                      catalog,
                      staff
                    );
                    
                    console.log('[layout] Transformed bookings:', {
                      count: transformedBookings.length,
                      sample: transformedBookings[0] ? {
                        id: transformedBookings[0].id,
                        code: transformedBookings[0].code,
                        serviceName: transformedBookings[0].serviceName,
                        startDateTime: transformedBookings[0].startDateTime,
                      } : null,
                    });
                    
                    // Update workspace with bookings, customers, and analytics
                    updateWorkspace((existing) => {
                      const updatedBookings = transformedBookings;
                      const updatedCustomers = deriveCustomersFromBookings(updatedBookings);
                      const updatedAnalytics = recomputeAnalytics(updatedBookings);
                      
                      console.log('[layout] Updated workspace with bookings:', {
                        bookingsCount: updatedBookings.length,
                        customersCount: updatedCustomers.length,
                        analyticsBookingsByStatus: updatedAnalytics.bookingsByStatus,
                      });
                      
                      return {
                        ...existing,
                        bookings: updatedBookings,
                        customers: updatedCustomers,
                        analytics: updatedAnalytics,
                      };
                    });
                  } else {
                    console.log('[layout] No bookings found in API response');
                  }
                  
                  // Set loading to false after workspace is successfully created
                  setLoading(false);
                  setError(null);
                } else {
                  console.warn('[layout] Workspace creation returned undefined');
                  throw new Error('Workspace creation returned undefined');
                }
              } catch (workspaceError) {
                console.error('[layout] Error creating workspace:', workspaceError);
                console.error('[layout] Workspace error stack:', workspaceError instanceof Error ? workspaceError.stack : 'No stack');
                throw new Error(`Failed to create workspace: ${workspaceError instanceof Error ? workspaceError.message : 'Unknown error'}`);
              }
            } else {
              console.error('[layout] Missing required business data:', {
                hasBusiness: !!apiData.business,
                hasServices: !!apiData.services,
                hasStaff: !!apiData.staff,
              });
              throw new Error('Missing required business data to create workspace');
            }
          } else {
            console.error('Failed to load real business data from API');
            setError('Failed to load business data. Please try refreshing the page.');
            setLoading(false);
            return;
          }
        } catch (apiError) {
          console.error('[layout] Error loading real business data:', apiError);
          const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown error';
          console.error('[layout] Error details:', {
            message: errorMessage,
            stack: apiError instanceof Error ? apiError.stack : undefined,
            businessId: params.businessId,
          });
          setError(`Error loading business data: ${errorMessage}. Please try refreshing the page.`);
          setLoading(false);
          return;
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Auth check error:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
        setLoading(false);
      }
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [params.businessId, router, supabase, isRedirecting]);

  // Use fake business for now (until we migrate all pages to use real data)
  const business = fakeBusiness;

  const activeSegment = useMemo(() => {
    if (!pathname) return "";
    const segments = pathname.split("/");
    return segments[segments.length - 1] === params.businessId ? "" : segments.at(-1) ?? "";
  }, [pathname, params.businessId]);

  // Filter nav items based on business settings
  // Hide notifications page if notifications are not enabled (Basic Plan)
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);
  
  // Fetch notifications_enabled from database
  useEffect(() => {
    async function fetchNotificationsEnabled() {
      if (!realBusiness?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('businesses')
          .select('notifications_enabled')
          .eq('id', realBusiness.id)
          .single();

        if (!error && data) {
          setNotificationsEnabled(data.notifications_enabled ?? false);
        }
      } catch (error) {
        console.error('Error fetching notifications_enabled:', error);
      }
    }

    if (realBusiness?.id) {
      fetchNotificationsEnabled();
    }
  }, [realBusiness?.id, supabase]);

  // Auto-refresh bookings data (polling every 15 seconds and on window focus)
  useEffect(() => {
    if (!realBusiness?.id || !user || !workspace) return;

    let intervalId: NodeJS.Timeout | null = null;

    const refreshBookings = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const response = await fetch(`/api/business/${realBusiness.id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          credentials: 'include',
        });

        if (response.ok) {
          const apiData = await response.json();
          const bookings = apiData.bookings || [];
          const bookingPayments = apiData.bookingPayments || [];
          const catalog = workspace?.catalog || [];
          const staff = workspace?.staff || [];

          // Always update, even if bookings array is empty
          const transformedBookings = transformBookingsFromAPI(
            bookings,
            bookingPayments,
            catalog,
            staff
          );

          // Update workspace with fresh bookings
          updateWorkspace((existing) => {
            const updatedCustomers = deriveCustomersFromBookings(transformedBookings);
            const updatedAnalytics = recomputeAnalytics(transformedBookings);
            
            console.log('[layout] Auto-refreshed bookings:', {
              bookingsCount: transformedBookings.length,
              customersCount: updatedCustomers.length,
            });
            
            return {
              ...existing,
              bookings: transformedBookings,
              customers: updatedCustomers,
              analytics: updatedAnalytics,
            };
          });
        }
      } catch (error) {
        console.error('[layout] Error refreshing bookings:', error);
      }
    };

    // Poll every 15 seconds for new bookings
    intervalId = setInterval(() => {
      console.log('[layout] Auto-refreshing bookings...');
      refreshBookingsOnly();
    }, 15000);

    // Also refresh when window regains focus
    const handleFocus = () => {
      console.log('[layout] Window focused, refreshing bookings...');
      refreshBookingsOnly();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      window.removeEventListener('focus', handleFocus);
    };
  }, [realBusiness?.id, user, workspace, supabase, updateWorkspace]);

  const visibleNavItems = useMemo(() => {
    // Always show notifications page (it will show "Coming Soon" when disabled)
    // Only hide if Basic Plan AND feature is enabled (Pro Plan users see it)
    const notificationsFeatureEnabled = isNotificationsEnabled();
    
    return NAV_ITEMS.filter(item => {
      if (item.segment === "notifications") {
        // If feature is disabled, always show (will display "Coming Soon")
        if (!notificationsFeatureEnabled) {
          return true; // Show page with "Coming Soon" message
        }
        // If feature is enabled, hide for Basic Plan users only
        if (notificationsEnabled === false) {
          return false; // Hide for Basic Plan when feature is enabled
        }
      }
      return true;
    });
  }, [notificationsEnabled]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="space-y-4 text-center text-white/60">
          <p className="text-sm uppercase tracking-[0.35em] text-white/40">Revol Admin</p>
          <p className="font-display text-2xl text-white">Preparing your workspace…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="space-y-4 text-center text-white/60">
          <p className="text-sm uppercase tracking-[0.35em] text-white/40">Revol Admin</p>
          <p className="font-display text-2xl text-white">Error loading business</p>
          <p className="text-sm text-rose-400">{error}</p>
          <Button onClick={() => router.push("/login")} variant="outline" className="mt-4">
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  if (!user || !realBusiness) {
    return null; // Will redirect via useEffect
  }

  // For now, use fake business/workspace until we migrate all pages
  // But don't block rendering if fake data isn't available
  if (!business || !workspace) {
    // Still render the layout with real business data
    // The pages will need to be updated to use real data
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="space-y-4 text-center text-white/60">
          <p className="text-sm uppercase tracking-[0.35em] text-white/40">Revol Admin</p>
          <p className="font-display text-2xl text-white">Loading workspace data…</p>
          <p className="text-sm text-white/40">Business: {realBusiness.name}</p>
        </div>
      </div>
    );
  }

  const displayBookingUrl =
    workspace.identity.website.subdomain.length > 0
      ? `https://${workspace.identity.website.subdomain}.main.tld`
      : business.bookingUrl;
  const previewUrl = business.previewUrl ?? `/public/${business.slug}`;

  const handleSignOut = async () => {
    // Clear in-memory business state to prevent data leakage between users
    clearBusiness();
    // No localStorage to clear - all data is in database
    await supabase.auth.signOut();
    router.replace("/");
  };

  return (
    <div className="flex min-h-screen bg-black text-white">
      <aside className="hidden min-w-[260px] border-r border-white/10 bg-black/80 backdrop-blur lg:flex lg:flex-col">
        <header className="border-b border-white/10 px-6 py-6">
          <p className="text-xs uppercase tracking-[0.3em] text-white/40">Revol Admin</p>
          <h1 className="mt-2 font-display text-xl text-white">{workspace.identity.business.businessName}</h1>
          <p className="mt-2 text-xs text-white/50">
            Manual capture only. Money moves when you press the buttons.
          </p>
        </header>
        <nav className="flex-1 overflow-y-auto px-4 py-6">
          <ul className="space-y-2">
            {visibleNavItems.map((item) => {
              const isActive = activeSegment === item.segment;
              // Use realBusiness.id (UUID) for navigation, not business.slug (subdomain)
              const businessIdForNav = realBusiness?.id || business?.slug || params.businessId;
              const href =
                item.segment.length > 0
                  ? `/app/b/${businessIdForNav}/${item.segment}`
                  : `/app/b/${businessIdForNav}`;
              return (
                <li key={item.segment}>
                  <Link
                    href={href}
                    className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                      isActive
                        ? "bg-primary/20 text-white shadow-[0_0_0_1px_rgba(91,100,255,0.35)]"
                        : "text-white/60 hover:bg-black/60 hover:text-white"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-xl border ${
                        isActive ? "border-primary/40 bg-primary/15 text-white" : "border-white/10 bg-black/60 text-white/60 group-hover:text-white"
                      }`}
                    >
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <footer className="border-t border-white/10 px-6 py-5">
          <div className="rounded-2xl border border-white/10 bg-black/70 px-4 py-4 text-xs text-white/60">
            <p className="font-semibold text-white">Business switcher</p>
            <p className="mt-1">Single business per owner in Phase 3. More coming soon.</p>
          </div>
        </footer>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-black/80 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-4 sm:px-8">
            <div className="flex items-center gap-4">
              <div className="lg:hidden">
                <p className="text-xs uppercase tracking-[0.3em] text-white/40">Revol Admin</p>
                <h1 className="font-display text-lg text-white">
                  {workspace.identity.business.businessName}
                </h1>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => window.open(previewUrl, "_blank")}
                aria-label={`Open booking page (${displayBookingUrl})`}
                title={displayBookingUrl}
                className="hidden items-center gap-2 rounded-full border border-white/15 bg-black/60 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/25 hover:text-white lg:inline-flex"
              >
                Open booking page
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-xs text-white/60 sm:flex">
                <span
                  className={`h-2 w-2 rounded-full ${
                    business.status === "canceled"
                      ? "bg-rose-400"
                      : business.status === "paused"
                      ? "bg-amber-300"
                      : "bg-emerald-400"
                  }`}
                  aria-hidden="true"
                />
                {business.status.charAt(0).toUpperCase() + business.status.slice(1)}
              </div>
              <Button type="button" variant="outline" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pb-16 pt-8 sm:px-8">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

// Transform bookings from API format to FakeBooking format
function transformBookingsFromAPI(
  apiBookings: any[],
  apiPayments: any[],
  catalog: ServiceCategory[],
  staff: StaffMember[]
): FakeBooking[] {
  const paymentsByBookingId = new Map<string, any[]>();
  apiPayments.forEach((payment: any) => {
    if (!paymentsByBookingId.has(payment.booking_id)) {
      paymentsByBookingId.set(payment.booking_id, []);
    }
    paymentsByBookingId.get(payment.booking_id)!.push(payment);
  });

  return apiBookings.map((booking: any) => {
    // Find service and category
    const service = catalog
      .flatMap(cat => cat.services)
      .find(svc => svc.id === booking.service_id);
    
    const category = catalog.find(cat => 
      cat.services.some(svc => svc.id === booking.service_id)
    );

    // Find staff
    const staffMember = staff.find(s => s.id === booking.staff_id);

    // Transform customer
    const customer: FakeCustomer = booking.customers ? {
      id: booking.customers.id,
      name: booking.customers.name,
      email: booking.customers.email,
      phone: booking.customers.phone || undefined,
      createdAt: booking.customers.created_at,
    } : {
      id: booking.customer_id || 'unknown',
      name: 'Unknown Customer',
      email: '',
      createdAt: booking.created_at,
    };

    // Transform payments
    const bookingPayments = paymentsByBookingId.get(booking.id) || [];
    const payments: FakePayment[] = bookingPayments.map((payment: any) => {
      let type: FakePayment['type'] = 'authorization';
      if (payment.money_action === 'capture') type = 'capture';
      else if (payment.money_action === 'no_show_fee') type = 'no_show_fee';
      else if (payment.money_action === 'cancel_fee') type = 'cancel_fee';
      else if (payment.money_action === 'refund') type = 'refund';

      let status: FakePayment['status'] = 'authorized';
      if (payment.status === 'card_saved' || payment.status === 'authorized') status = 'authorized';
      else if (payment.status === 'captured') status = 'captured';
      else if (payment.status === 'refunded') status = 'refunded';
      else if (payment.status === 'failed') status = 'failed';
      else if (payment.status === 'requires_action') status = 'requires_action';

      return {
        id: payment.id,
        bookingId: booking.id,
        type,
        amountCents: payment.amount_cents || 0,
        status,
        occurredAt: payment.created_at || booking.created_at,
        notes: payment.notes || undefined,
      };
    });

    // Calculate financials
    const listPriceCents = booking.price_cents || 0;
    const giftCardAmountCents = booking.gift_card_amount_applied_cents || 0;
    const capturedPayments = payments.filter(p => p.status === 'captured');
    const capturedAmount = capturedPayments.reduce((sum, p) => sum + p.amountCents, 0);
    const platformFeeCents = Math.round(capturedAmount * 0.01);
    const stripeFeeEstimateCents = capturedAmount > 0 ? Math.round(capturedAmount * 0.029) + 30 : 0;
    const netPayoutCents = Math.max(capturedAmount - platformFeeCents - stripeFeeEstimateCents, 0);

    // Generate booking code
    const bookingCode = `REVOL-${booking.id.slice(0, 8).toUpperCase()}`;

    // Determine booking status
    let status: FakeBooking['status'] = 'pending';
    if (booking.status === 'pending') status = 'pending';
    else if (booking.status === 'scheduled') status = 'pending';
    else if (booking.status === 'completed') status = 'completed';
    else if (booking.status === 'canceled') status = 'canceled';
    else if (booking.status === 'no_show') status = 'no_show';
    else if (booking.payment_status === 'requires_action') status = 'requires_action';

    return {
      id: booking.id,
      code: bookingCode,
      status,
      serviceId: booking.service_id,
      serviceName: service?.name || 'Unknown Service',
      categoryName: category?.name || 'Uncategorized',
      durationMinutes: booking.duration_min || 60,
      startDateTime: booking.start_at,
      endDateTime: booking.end_at,
      staff: staffMember ? {
        id: staffMember.id,
        name: staffMember.name,
        color: staffMember.color,
      } : null,
      customer,
      payments,
      financials: {
        listPriceCents,
        giftCardAmountCents,
        platformFeeCents,
        stripeFeeEstimateCents,
        netPayoutCents,
        currency: 'usd',
      },
      policyConsent: {
        hash: '',
        acceptedAt: booking.created_at,
        ip: '',
        userAgent: '',
      },
      requiresAction: booking.payment_status === 'requires_action',
      notes: undefined,
    };
  });
}

