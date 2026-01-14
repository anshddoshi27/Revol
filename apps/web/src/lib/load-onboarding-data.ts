/**
 * Load all onboarding data from the backend
 * Used when returning from external redirects (like Stripe Connect)
 */

import { createClientClient } from './supabase-client';
import type { 
  BusinessBasics, 
  WebsiteConfig, 
  LocationContacts, 
  StaffMember,
  BrandingConfig,
  ServiceCategory,
  ServiceAvailability,
  NotificationTemplate,
  PoliciesConfig,
  GiftCardConfig,
  PaymentSetupConfig
} from './onboarding-types';

interface OnboardingData {
  business?: BusinessBasics;
  website?: WebsiteConfig;
  location?: LocationContacts;
  team?: StaffMember[];
  branding?: BrandingConfig;
  services?: ServiceCategory[];
  availability?: ServiceAvailability[];
  notifications?: { templates: NotificationTemplate[]; enabled: boolean };
  policies?: PoliciesConfig;
  giftCards?: GiftCardConfig;
  paymentSetup?: PaymentSetupConfig;
  currentStep?: string;
}

export async function loadOnboardingDataFromBackend(): Promise<OnboardingData> {
  try {
    const supabase = createClientClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      console.warn('No session found, cannot load onboarding data');
      return {};
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    };

    const data: OnboardingData = {};

    // Load business data
    try {
      const businessResponse = await fetch('/api/business/onboarding/step-1-business', {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      if (businessResponse.ok) {
        const businessData = await businessResponse.json();
        if (businessData.business) {
          // Only include business data if it has a valid name (not empty or just whitespace)
          // This ensures new signups with empty business records don't skip to later steps
          const businessName = businessData.business.name?.trim() || '';
          if (businessName.length > 0) {
            data.business = {
              businessName: businessName,
              description: businessData.business.description || '',
              doingBusinessAs: businessData.business.dba_name || '',
              legalName: businessData.business.legal_name || '',
              industry: businessData.business.industry || '',
            };
          }
        }
      }
    } catch (error) {
      console.error('Error loading business data:', error);
    }

    // Load website data
    try {
      const websiteResponse = await fetch('/api/business/onboarding/step-2-website', {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      if (websiteResponse.ok) {
        const websiteData = await websiteResponse.json();
        if (websiteData.website) {
          const subdomain = websiteData.website.subdomain?.trim() || '';
          // Only include website data if it has a valid subdomain (not empty and not a temp subdomain)
          // Temp subdomains are created during signup and should be replaced in step 2
          if (subdomain.length > 0 && !subdomain.startsWith('temp-')) {
            data.website = {
              subdomain: subdomain,
              status: websiteData.website.status || 'reserved',
              customDomain: websiteData.website.custom_domain || undefined,
            };
          }
        }
      }
    } catch (error) {
      console.error('Error loading website data:', error);
    }

    // Load location data
    try {
      const locationResponse = await fetch('/api/business/onboarding/step-3-location', {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      if (locationResponse.ok) {
        const locationData = await locationResponse.json();
        if (locationData.location) {
          data.location = {
            timezone: locationData.location.timezone || '',
            phone: locationData.location.phone || '',
            supportEmail: locationData.location.supportEmail || '',
            website: locationData.location.website || '',
            addressLine1: locationData.location.addressLine1 || '',
            addressLine2: locationData.location.addressLine2 || '',
            city: locationData.location.city || '',
            stateProvince: locationData.location.stateProvince || '',
            postalCode: locationData.location.postalCode || '',
            country: locationData.location.country || '',
          };
        }
      }
    } catch (error) {
      console.error('Error loading location data:', error);
    }

    // Load team data
    try {
      const teamResponse = await fetch('/api/business/onboarding/step-4-team', {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      if (teamResponse.ok) {
        const teamData = await teamResponse.json();
        if (teamData.staff && Array.isArray(teamData.staff)) {
          data.team = teamData.staff;
        }
      }
    } catch (error) {
      console.error('Error loading team data:', error);
    }

    // Load branding data
    try {
      const brandingResponse = await fetch('/api/business/onboarding/step-5-branding', {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      if (brandingResponse.ok) {
        const brandingData = await brandingResponse.json();
        if (brandingData.branding) {
          data.branding = {
            primaryColor: brandingData.branding.primaryColor || '#5B64FF',
            secondaryColor: brandingData.branding.secondaryColor || '#1a1a2e',
            logoUrl: brandingData.branding.logoUrl || undefined,
            logoName: brandingData.branding.logoName || undefined,
            fontFamily: brandingData.branding.fontFamily || 'Inter',
            buttonShape: brandingData.branding.buttonShape || 'rounded',
            heroImageUrl: brandingData.branding.heroImageUrl || undefined,
            heroImageName: brandingData.branding.heroImageName || undefined,
            bookingPageDescription: brandingData.branding.bookingPageDescription || undefined,
            recommendedDimensions: brandingData.branding.recommendedDimensions || {
              width: 200,
              height: 200
            },
          };
        }
      }
    } catch (error) {
      console.error('Error loading branding data:', error);
    }

    // Load services data
    try {
      const servicesResponse = await fetch('/api/business/onboarding/step-6-services', {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      if (servicesResponse.ok) {
        const servicesData = await servicesResponse.json();
        if (servicesData.services && Array.isArray(servicesData.services)) {
          data.services = servicesData.services;
        }
      }
    } catch (error) {
      console.error('Error loading services data:', error);
    }

    // Load availability data
    try {
      console.log('[loadOnboardingData] Fetching availability data from API...');
      const availabilityResponse = await fetch('/api/business/onboarding/step-7-availability', {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      
      console.log('[loadOnboardingData] Availability API response status:', availabilityResponse.status);
      
      if (availabilityResponse.ok) {
        const availabilityData = await availabilityResponse.json();
        console.log('[loadOnboardingData] Availability API response data:', {
          hasAvailability: !!availabilityData.availability,
          isArray: Array.isArray(availabilityData.availability),
          length: availabilityData.availability?.length || 0,
          rawData: JSON.stringify(availabilityData, null, 2)
        });
        
        if (availabilityData.availability && Array.isArray(availabilityData.availability)) {
          // Log raw data first
          console.log('[loadOnboardingData] Raw API response:', {
            length: availabilityData.availability.length,
            rawData: JSON.stringify(availabilityData.availability, null, 2).substring(0, 2000)
          });
          
          // Clean the availability data to ensure it only contains staffId and slots (not full staff objects)
          data.availability = availabilityData.availability.map((serviceAvail: any) => ({
            serviceId: serviceAvail.serviceId,
            staff: (serviceAvail.staff || []).map((staffAvail: any) => ({
              staffId: staffAvail.staffId,
              slots: staffAvail.slots || []
            }))
          }));
          
          // Calculate detailed statistics
          const totalStaffEntries = data.availability.reduce((sum: number, a: any) => sum + (a.staff?.length || 0), 0);
          const totalSlots = data.availability.reduce((sum: number, a: any) => 
            sum + (a.staff?.reduce((staffSum: number, st: any) => staffSum + (st.slots?.length || 0), 0) || 0), 0
          );
          
          console.log('[loadOnboardingData] ✅ Loaded availability data:', {
            count: data.availability.length,
            services: data.availability.map((a: any) => a.serviceId),
            totalStaffEntries: totalStaffEntries,
            totalSlots: totalSlots,
            servicesDetail: data.availability.map((a: any) => ({
              serviceId: a.serviceId,
              staffCount: a.staff?.length || 0,
              slotsCount: a.staff?.reduce((sum: number, st: any) => sum + (st.slots?.length || 0), 0) || 0
            })),
            fullData: JSON.stringify(data.availability, null, 2)
          });
        } else {
          console.warn('[loadOnboardingData] ⚠️ No availability data in response (not an array or missing):', {
            availabilityData: availabilityData,
            hasAvailability: !!availabilityData.availability,
            type: typeof availabilityData.availability
          });
          // Set empty array to ensure data structure is consistent
          data.availability = [];
        }
      } else {
        const errorText = await availabilityResponse.text().catch(() => 'Unable to read error');
        console.warn('[loadOnboardingData] ⚠️ Availability API returned error:', {
          status: availabilityResponse.status,
          statusText: availabilityResponse.statusText,
          error: errorText
        });
        // Set empty array on error to ensure data structure is consistent
        data.availability = [];
      }
    } catch (error) {
      console.error('[loadOnboardingData] ❌ Error loading availability data:', error);
      // Set empty array on error to ensure data structure is consistent
      data.availability = [];
    }

    // Load notifications data
    try {
      const notificationsResponse = await fetch('/api/business/onboarding/step-8-notifications', {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      if (notificationsResponse.ok) {
        const notificationsData = await notificationsResponse.json();
        data.notifications = {
          templates: notificationsData.templates || [],
          enabled: notificationsData.notificationsEnabled !== false,
        };
      }
    } catch (error) {
      console.error('Error loading notifications data:', error);
    }

    // Load policies data
    try {
      const policiesResponse = await fetch('/api/business/onboarding/step-9-policies', {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      if (policiesResponse.ok) {
        const policiesData = await policiesResponse.json();
        if (policiesData.policies) {
          data.policies = policiesData.policies;
        }
      }
    } catch (error) {
      console.error('Error loading policies data:', error);
    }

    // Load gift cards data
    try {
      const giftCardsResponse = await fetch('/api/business/onboarding/step-10-gift-cards', {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      if (giftCardsResponse.ok) {
        const giftCardsData = await giftCardsResponse.json();
        if (giftCardsData.giftCards) {
          data.giftCards = giftCardsData.giftCards;
        }
      }
    } catch (error) {
      console.error('Error loading gift cards data:', error);
    }

    // Load payment setup data
    try {
      const paymentResponse = await fetch('/api/business/onboarding/step-11-payment-setup', {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      if (paymentResponse.ok) {
        const paymentData = await paymentResponse.json();
        if (paymentData.paymentSetup) {
          data.paymentSetup = paymentData.paymentSetup;
        }
      }
    } catch (error) {
      console.error('Error loading payment setup data:', error);
    }

    return data;
  } catch (error) {
    console.error('Error loading onboarding data from backend:', error);
    return {};
  }
}

