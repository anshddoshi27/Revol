"use client";

import { useEffect, useMemo } from "react";
import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { BusinessStep } from "@/components/onboarding/business-step";
import { WebsiteStep } from "@/components/onboarding/website-step";
import { LocationStep } from "@/components/onboarding/location-step";
import { TeamStep } from "@/components/onboarding/team-step";
import { BrandingStep } from "@/components/onboarding/branding-step";
import { ServicesStep } from "@/components/onboarding/services-step";
import { AvailabilityStep } from "@/components/onboarding/availability-step";
import { NotificationsStep } from "@/components/onboarding/notifications-step";
import { PoliciesStep } from "@/components/onboarding/policies-step";
import { GiftCardsStep } from "@/components/onboarding/gift-cards-step";
import { PaymentSetupStep } from "@/components/onboarding/payment-setup-step";
import { GoLiveStep } from "@/components/onboarding/go-live-step";
import { useToast } from "@/components/ui/toast";
import { useOnboarding, type OnboardingStepId, type NotificationTemplate } from "@/lib/onboarding-context";
import { useFakeBusiness } from "@/lib/fake-business";
import { useFakeSession } from "@/lib/fake-session";
import { loadOnboardingDataFromBackend } from "@/lib/load-onboarding-data";

function sanitizeSubdomain(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

import { isNotificationsEnabled } from "@/lib/feature-flags";

// Build step sequence based on feature flags
const BASE_STEPS: OnboardingStepId[] = [
  "business",
  "website",
  "location",
  "team",
  "branding",
  "services",
  "availability",
  // "notifications" - conditionally included below
  "policies",
  "giftCards",
  "paymentSetup",
  "goLive"
];

// Always include notifications step (shows "Coming Soon" when disabled)
const STEP_SEQUENCE: OnboardingStepId[] = [
      ...BASE_STEPS.slice(0, 7), // business through availability
  "notifications", // Always include - shows "Coming Soon" when disabled
      ...BASE_STEPS.slice(7), // policies through goLive
];

export default function OnboardingPage() {
  const router = useRouter();
  const toast = useToast();
  const session = useFakeSession();
  const businessStore = useFakeBusiness();
  const onboarding = useOnboarding();
  const [supabaseSession, setSupabaseSession] = React.useState<any>(null);
  const [isCheckingSession, setIsCheckingSession] = React.useState(true);
  const [businessCreated, setBusinessCreated] = React.useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = React.useState(false);

  const currentIndex = useMemo(
    () => STEP_SEQUENCE.findIndex((step) => step === onboarding.currentStep),
    [onboarding.currentStep]
  );

  const previousStep = currentIndex > 0 ? STEP_SEQUENCE[currentIndex - 1] : undefined;
  const nextStep = currentIndex < STEP_SEQUENCE.length - 1 ? STEP_SEQUENCE[currentIndex + 1] : undefined;

  // Note: Notifications step is always shown but displays "Coming Soon" when feature is disabled
  // No need to auto-skip - the step component handles the "coming soon" state

  // Helper function to create a business if one doesn't exist
  const ensureBusinessExists = async (accessToken: string) => {
    try {
      // Check if business already exists
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      };
      
      const checkResponse = await fetch('/api/business/onboarding/step-1-business', {
        method: 'GET',
        headers,
        credentials: 'include',
      });
      
      if (checkResponse.ok) {
        const businessData = await checkResponse.json();
        if (businessData.business && businessData.business.id) {
          console.log('[onboarding] Business already exists:', businessData.business.id);
          setBusinessCreated(true);
          return businessData.business.id;
        }
      }
      
      // Business doesn't exist, create a temporary one
      console.log('[onboarding] No business found, creating temporary business...');
      const createResponse = await fetch('/api/business/onboarding/step-1-business', {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          businessName: 'New Business',
          description: 'Business description will be added',
          doingBusinessAs: '',
          legalName: 'New Business',
          industry: 'Other',
        }),
      });
      
      if (createResponse.ok) {
        const result = await createResponse.json();
        console.log('[onboarding] Temporary business created:', result.businessId);
        setBusinessCreated(true);
        return result.businessId;
      } else {
        console.error('[onboarding] Failed to create business:', await createResponse.text());
      }
    } catch (error) {
      console.error('[onboarding] Error ensuring business exists:', error);
    }
    return null;
  };

  // Check Supabase session on mount (persists across redirects)
  useEffect(() => {
    const checkSupabaseSession = async () => {
      try {
        // Check if this is a new signup - if so, don't load any old data
        const urlParams = new URLSearchParams(window.location.search);
        const isNewSignup = urlParams.get('new') === 'true';
        
        const { createClientClient } = await import('@/lib/supabase-client');
        const supabase = createClientClient();
        const { data: { session: supabaseSessionData }, error } = await supabase.auth.getSession();
        
        if (supabaseSessionData && !error) {
          setSupabaseSession(supabaseSessionData);
          // Restore fake session from Supabase session if needed
          if (!session.isAuthenticated && supabaseSessionData.user) {
            session.login({
              id: supabaseSessionData.user.id,
              name: supabaseSessionData.user.user_metadata?.full_name || supabaseSessionData.user.email?.split('@')[0] || 'User',
              email: supabaseSessionData.user.email || '',
              phone: supabaseSessionData.user.user_metadata?.phone || undefined,
            });
          }
          
          // Ensure business exists (create if it doesn't)
          if (supabaseSessionData.access_token) {
            await ensureBusinessExists(supabaseSessionData.access_token);
          }
          
          // Only load business data if:
          // 1. This is NOT a new signup (new=true not present)
          // 2. AND we're returning from Stripe (account_id present)
          const accountId = urlParams.get("account_id");
          if (!isNewSignup && accountId) {
            // Load business data to ensure it's in state (only for Stripe returns)
            try {
              const headers: HeadersInit = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseSessionData.access_token}`,
              };
              
              const businessResponse = await fetch('/api/business/onboarding/step-1-business', {
                method: 'GET',
                headers,
                credentials: 'include',
              });
              
              if (businessResponse.ok) {
                const businessData = await businessResponse.json();
                if (businessData.business) {
                  onboarding.saveBusiness({
                    businessName: businessData.business.name || '',
                    description: '',
                    doingBusinessAs: businessData.business.dba_name || '',
                    legalName: businessData.business.legal_name || '',
                    industry: businessData.business.industry || '',
                  });
                }
              }
            } catch (error) {
              console.error('Error loading business data:', error);
            }
          } else if (isNewSignup) {
            console.log('[onboarding] New signup detected - skipping data load, starting fresh at step 1');
            // Ensure we start at step 1 for new signups
            onboarding.setStep("business");
          }
        }
      } catch (error) {
        console.error('Error checking Supabase session:', error);
      } finally {
        setIsCheckingSession(false);
      }
    };
    
    checkSupabaseSession();
  }, []);

  // Handle Stripe Connect return FIRST - before auth check
  // Load ALL onboarding data from backend to restore state
  // Skip this for new signups
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const accountId = urlParams.get("account_id");
    const isNewSignup = urlParams.get('new') === 'true';
    
    // Don't restore data for new signups - they should start fresh
    if (isNewSignup) {
      console.log('[onboarding] New signup detected - skipping Stripe return data restoration');
      return;
    }
    
    if (accountId) {
      console.log('[onboarding] Stripe return detected, account_id:', accountId);
      
      // Navigate to payment setup step immediately
      onboarding.setStep("paymentSetup");
      
      // Load ALL onboarding data from backend to restore complete state
      const restoreAllOnboardingData = async () => {
        try {
          const data = await loadOnboardingDataFromBackend();
          
          // Restore all the data to onboarding context
          if (data.business) {
            onboarding.saveBusiness(data.business);
          }
          if (data.website) {
            onboarding.saveWebsite(data.website);
          }
          if (data.location) {
            onboarding.saveLocation(data.location);
          }
          if (data.team) {
            onboarding.saveTeam(data.team);
          }
          if (data.branding) {
            onboarding.saveBranding(data.branding);
          }
          if (data.services) {
            onboarding.saveServices(data.services);
          }
          if (data.availability) {
            onboarding.saveAvailability(data.availability);
          }
          // Only load notifications if feature is enabled
          if (isNotificationsEnabled() && data.notifications) {
            onboarding.saveNotifications(data.notifications);
          } else if (!isNotificationsEnabled()) {
            // If feature is disabled, set notifications to empty and disabled
            onboarding.saveNotifications({ templates: [], enabled: false });
          }
          if (data.policies) {
            onboarding.savePolicies(data.policies);
          }
          if (data.giftCards) {
            onboarding.saveGiftCards(data.giftCards);
          }
          if (data.paymentSetup) {
            onboarding.savePaymentSetup(data.paymentSetup);
          }
          
          // Mark all completed steps
          const completedSteps: OnboardingStepId[] = [];
          if (data.business?.businessName) completedSteps.push('business');
          if (data.website?.subdomain) completedSteps.push('website');
          if (data.location?.street || data.location?.city) completedSteps.push('location');
          if (data.team && data.team.length > 0) completedSteps.push('team');
          if (data.branding?.primaryColor) completedSteps.push('branding');
          if (data.services && data.services.length > 0) completedSteps.push('services');
          if (data.availability && data.availability.length > 0) completedSteps.push('availability');
          if (data.notifications) completedSteps.push('notifications');
          if (data.policies) completedSteps.push('policies');
          if (data.giftCards) completedSteps.push('giftCards');
          
          completedSteps.forEach(step => {
            onboarding.completeStep(step);
          });
          
          console.log('[onboarding] All onboarding data restored from backend');
        } catch (error) {
          console.error('Error restoring onboarding data:', error);
        }
      };
      
      // Load and restore all state from backend
      restoreAllOnboardingData();
      
      // Clean up URL (remove query params) after a short delay
      setTimeout(() => {
        window.history.replaceState({}, "", window.location.pathname);
      }, 100);
    }
  }, [onboarding]);

  // Check if business is already launched and redirect to admin
  // Skip this check for new signups to ensure they start fresh
  useEffect(() => {
    const checkIfBusinessIsLaunched = async () => {
      if (isCheckingSession) return; // Wait for session check to complete
      
      // Check if this is a new signup - if so, skip the launch check
      const urlParams = new URLSearchParams(window.location.search);
      const isNewSignup = urlParams.get('new') === 'true';
      
      if (isNewSignup) {
        console.log('[onboarding] New signup - skipping business launch check, starting fresh');
        return;
      }
      
      // Check both fake session and Supabase session
      const isAuthenticated = session.isAuthenticated || (supabaseSession?.user !== null);
      
      if (!isAuthenticated) {
        router.replace("/login");
        return;
      }

      try {
        // Check if business is already launched by checking database
        const { createClientClient } = await import('@/lib/supabase-client');
        const supabase = createClientClient();
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (!currentSession?.access_token) {
          return;
        }

        // Fetch business to check if it's already launched
        const businessResponse = await fetch('/api/business/onboarding/step-1-business', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentSession.access_token}`,
          },
          credentials: 'include',
        });

        if (businessResponse.ok) {
          const businessData = await businessResponse.json();
          const business = businessData.business;
          
          // Check if business is already launched:
          // 1. Has subscription_status set (trial, active, paused, canceled) - this indicates go-live step was completed
          // 2. Has essential fields (name, subdomain, timezone, support_email)
          // Note: stripe_connect_account_id is optional - business can be launched without Stripe Connect
          // Also check that it's not a temp business (new signup with empty name)
          const isLaunched = business && 
            business.subscription_status && 
            business.subscription_status !== null &&
            business.name && 
            business.name.trim().length > 0 &&
            business.subdomain && 
            !business.subdomain.startsWith('temp-') &&
            business.timezone &&
            business.support_email;

          if (isLaunched) {
            console.log('[onboarding] Business is already launched - redirecting to admin');
            // Business is already launched - redirect to admin dashboard
            const businessId = business.id;
            router.replace(`/app/b/${businessId}`);
            return;
          }
        }

        // If business exists but not launched, continue with onboarding
        // If no business exists, onboarding will create one
      } catch (error) {
        console.error('[onboarding] Error checking if business is launched:', error);
        // On error, continue with onboarding
      }
    };

    checkIfBusinessIsLaunched();
  }, [session.isAuthenticated, supabaseSession, isCheckingSession, router]);

  // Cleanup: Delete incomplete business when user exits onboarding
  useEffect(() => {
    // Only set up cleanup if business was created and onboarding not completed
    if (!businessCreated || onboardingCompleted) {
      return;
    }

    // Check if current path is still onboarding
    const checkIfStillOnOnboarding = () => {
      return window.location.pathname === '/onboarding';
    };

    const deleteIncompleteBusiness = async () => {
      // Don't delete if we're still on the onboarding page (user might be navigating between steps)
      if (checkIfStillOnOnboarding()) {
        return;
      }

      try {
        const { createClientClient } = await import('@/lib/supabase-client');
        const supabase = createClientClient();
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (!currentSession?.access_token) {
          return;
        }

        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession.access_token}`,
        };

        const response = await fetch('/api/business/onboarding/delete-incomplete', {
          method: 'DELETE',
          headers,
          credentials: 'include',
          keepalive: true, // Important for beforeunload
        });

        if (response.ok) {
          console.log('[onboarding] Incomplete business deleted on exit');
        } else {
          console.error('[onboarding] Failed to delete incomplete business:', await response.text());
        }
      } catch (error) {
        // Ignore errors during cleanup (network might be unavailable)
        console.log('[onboarding] Cleanup error (expected if page is closing):', error);
      }
    };

    // Handle page unload (user closes tab/window, navigates away)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!onboardingCompleted && !checkIfStillOnOnboarding()) {
        // Use fetch with keepalive for reliable delivery during page unload
        // Can't use await in beforeunload handler, so use dynamic import with .then()
        import('@/lib/supabase-client').then(({ createClientClient }) => {
          return createClientClient();
        }).then(async (supabase) => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            const headers: HeadersInit = {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            };
            
            // Use fetch with keepalive for beforeunload
            fetch('/api/business/onboarding/delete-incomplete', {
              method: 'DELETE',
              headers,
              credentials: 'include',
              keepalive: true,
            }).catch(() => {
              // Ignore errors - network might be unavailable
            });
          }
        }).catch(() => {
          // Ignore errors
        });
      }
    };

    // Handle visibility change (user switches tabs, minimizes window)
    // Only delete if user has been away for a while (not just a quick tab switch)
    let visibilityTimeout: NodeJS.Timeout | null = null;
    const handleVisibilityChange = () => {
      if (document.hidden && !onboardingCompleted) {
        // Wait 10 seconds before deleting (user might come back)
        visibilityTimeout = setTimeout(() => {
          if (document.hidden && !checkIfStillOnOnboarding()) {
            deleteIncompleteBusiness();
          }
        }, 10000);
      } else {
        // User came back, cancel deletion
        if (visibilityTimeout) {
          clearTimeout(visibilityTimeout);
          visibilityTimeout = null;
        }
      }
    };
    
    // Handle popstate (browser back/forward) - only if leaving onboarding
    const handlePopState = () => {
      // Small delay to check if we're still on onboarding
      setTimeout(() => {
        if (!onboardingCompleted && !checkIfStillOnOnboarding()) {
          deleteIncompleteBusiness();
        }
      }, 100);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('popstate', handlePopState);
      if (visibilityTimeout) {
        clearTimeout(visibilityTimeout);
      }
    };
  }, [businessCreated, onboardingCompleted]);

  const navigateTo = (step: OnboardingStepId) => {
    onboarding.setStep(step);
  };

  const goForward = () => {
    if (nextStep) {
      onboarding.setStep(nextStep);
    }
  };

  const goBack = () => {
    if (previousStep) {
      onboarding.setStep(previousStep);
    }
  };

  // Helper function to make authenticated API calls
  const makeAuthenticatedRequest = async (url: string, method: string, body: any) => {
    const { createClientClient } = await import('@/lib/supabase-client');
    const supabase = createClientClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Error getting session:', sessionError);
    }
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    
    const response = await fetch(url, {
      method,
      headers,
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to save to ${url}`);
    }

    return await response.json();
  };

  const handleBusinessNext = async (values: Parameters<typeof onboarding.saveBusiness>[0]) => {
    onboarding.saveBusiness(values);
    
    try {
      const data = await makeAuthenticatedRequest('/api/business/onboarding/step-1-business', 'PUT', values);
      console.log('Business saved:', data);
      
      // Verify the save worked by checking the response
      if (!data || !data.success) {
        throw new Error('Business save did not return success');
      }
    } catch (error) {
      console.error('Error saving business:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.pushToast({
        intent: 'error',
        title: 'Error',
        description: `Failed to save business information: ${errorMessage}. Please check the console and try again.`
      });
      return;
    }
    
    onboarding.completeStep("business");
    goForward();
  };

  const handleWebsiteNext = async (values: Parameters<typeof onboarding.saveWebsite>[0]) => {
    const fallback = onboarding.business.businessName || "yourbusiness";
    const fallbackSanitized = sanitizeSubdomain(fallback);
    let normalizedSubdomain = sanitizeSubdomain(values.subdomain || fallbackSanitized);
    if (normalizedSubdomain.length < 3) {
      normalizedSubdomain = fallbackSanitized.length >= 3 ? fallbackSanitized : "yourbusiness";
    }
    const websiteData = {
      ...values,
      subdomain: normalizedSubdomain
    };
    
    onboarding.saveWebsite(websiteData);
    
    try {
      const data = await makeAuthenticatedRequest('/api/business/onboarding/step-2-website', 'PUT', websiteData);
      console.log('Website saved:', data);
    } catch (error) {
      console.error('Error saving website:', error);
      toast.pushToast({
        intent: 'error',
        title: 'Error',
        description: 'Failed to save website information. Please try again.'
      });
      return;
    }
    
    if (values.status === "reserved") {
      const url = `https://${normalizedSubdomain}.main.tld`;
      onboarding.setBookingUrl(url);
    }
    onboarding.completeStep("website");
    goForward();
  };

  const handleLocationNext = async (values: Parameters<typeof onboarding.saveLocation>[0]) => {
    onboarding.saveLocation(values);
    
    try {
      const data = await makeAuthenticatedRequest('/api/business/onboarding/step-3-location', 'PUT', values);
      console.log('Location saved:', data);
      
      // Verify the save worked
      if (!data || !data.success) {
        throw new Error('Location save did not return success');
      }
    } catch (error) {
      console.error('Error saving location:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.pushToast({
        intent: 'error',
        title: 'Error',
        description: `Failed to save location information: ${errorMessage}. Please check the console and try again.`
      });
      return;
    }
    
    onboarding.completeStep("location");
    goForward();
  };

  const handleTeamNext = async (values: Parameters<typeof onboarding.saveTeam>[0]) => {
    onboarding.saveTeam(values);
    
    try {
      // API expects { staff: StaffMember[] } not just the array
      const data = await makeAuthenticatedRequest('/api/business/onboarding/step-4-team', 'PUT', { staff: values });
      console.log('Team saved:', data);
    } catch (error) {
      console.error('Error saving team:', error);
      toast.pushToast({
        intent: 'error',
        title: 'Error',
        description: 'Failed to save team information. Please try again.'
      });
      return;
    }
    
    onboarding.completeStep("team");
    goForward();
  };

  const handleBrandingNext = async (values: Parameters<typeof onboarding.saveBranding>[0]) => {
    onboarding.saveBranding(values);
    
    try {
      const data = await makeAuthenticatedRequest('/api/business/onboarding/step-5-branding', 'PUT', values);
      console.log('Branding saved:', data);
    } catch (error) {
      console.error('Error saving branding:', error);
      toast.pushToast({
        intent: 'error',
        title: 'Error',
        description: 'Failed to save branding information. Please try again.'
      });
      return;
    }
    
    onboarding.completeStep("branding");
    goForward();
  };

  const handleServicesNext = async (values: Parameters<typeof onboarding.saveServices>[0]) => {
    onboarding.saveServices(values);
    
    try {
      // API expects { categories: ... } not just the array
      const data = await makeAuthenticatedRequest('/api/business/onboarding/step-6-services', 'PUT', { categories: values });
      console.log('Services saved:', data);
    } catch (error) {
      console.error('Error saving services:', error);
      toast.pushToast({
        intent: 'error',
        title: 'Error',
        description: 'Failed to save services information. Please try again.'
      });
      return;
    }
    
    onboarding.completeStep("services");
    goForward();
  };

  const handleAvailabilityNext = async (values: Parameters<typeof onboarding.saveAvailability>[0]) => {
    onboarding.saveAvailability(values);
    
    try {
      // API expects { availability: ... } not just the array
      const data = await makeAuthenticatedRequest('/api/business/onboarding/step-7-availability', 'PUT', { availability: values });
      console.log('Availability saved:', data);
    } catch (error) {
      console.error('Error saving availability:', error);
      toast.pushToast({
        intent: 'error',
        title: 'Error',
        description: 'Failed to save availability information. Please try again.'
      });
      return;
    }
    
    onboarding.completeStep("availability");
    goForward();
  };

  const handleNotificationsNext = async (templates: NotificationTemplate[], enabled: boolean) => {
    onboarding.saveNotifications({ templates, enabled });
    
    // Log what we're sending to ensure it's correct
    console.log('[onboarding] Sending notifications_enabled to API:', {
      enabled,
      enabledType: typeof enabled,
      planType: enabled === false ? 'Basic ($11.99/month)' : 'Pro ($21.99/month)',
      templatesCount: templates.length,
    });
    
    try {
      const data = await makeAuthenticatedRequest('/api/business/onboarding/step-8-notifications', 'PUT', {
        templates,
        notifications_enabled: enabled, // Explicitly send the boolean value
      });
      console.log('[onboarding] Notifications saved, API response:', {
        success: data.success,
        notifications_enabled: data.notifications_enabled,
        plan_type: data.plan_type,
        plan_price: data.plan_price,
      });
    } catch (error) {
      console.error('Error saving notifications:', error);
      toast.pushToast({
        intent: 'error',
        title: 'Error',
        description: 'Failed to save notifications. Please try again.'
      });
      return;
    }
    
    onboarding.completeStep("notifications");
    goForward();
  };

  const handlePoliciesNext = async (values: Parameters<typeof onboarding.savePolicies>[0]) => {
    onboarding.savePolicies(values);
    
    try {
      const data = await makeAuthenticatedRequest('/api/business/onboarding/step-9-policies', 'PUT', values);
      console.log('Policies saved:', data);
    } catch (error) {
      console.error('Error saving policies:', error);
      toast.pushToast({
        intent: 'error',
        title: 'Error',
        description: 'Failed to save policies. Please try again.'
      });
      return;
    }
    
    onboarding.completeStep("policies");
    goForward();
  };

  const handleGiftCardsNext = async (values: Parameters<typeof onboarding.saveGiftCards>[0]) => {
    onboarding.saveGiftCards(values);
    
    try {
      const data = await makeAuthenticatedRequest('/api/business/onboarding/step-10-gift-cards', 'PUT', values);
      console.log('Gift cards saved:', data);
    } catch (error) {
      console.error('Error saving gift cards:', error);
      toast.pushToast({
        intent: 'error',
        title: 'Error',
        description: 'Failed to save gift cards information. Please try again.'
      });
      return;
    }
    
    onboarding.completeStep("giftCards");
    goForward();
  };

  const handlePaymentNext = async (values: Parameters<typeof onboarding.savePaymentSetup>[0]) => {
    onboarding.savePaymentSetup(values);
    
    try {
      const data = await makeAuthenticatedRequest('/api/business/onboarding/step-11-payment-setup', 'PUT', values);
      console.log('Payment setup saved:', data);
    } catch (error) {
      console.error('Error saving payment setup:', error);
      toast.pushToast({
        intent: 'error',
        title: 'Error',
        description: 'Failed to save payment setup. Please try again.'
      });
      return;
    }
    
    onboarding.completeStep("paymentSetup");
    goForward();
  };

  const handleStartTrial = () => {
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 7);
    onboarding.savePaymentSetup({
      ...onboarding.paymentSetup,
      subscriptionStatus: "trial",
      trialEndsAt: trialEnds.toISOString(),
      nextBillDate: trialEnds.toISOString()
    });
    toast.pushToast({
      title: "Trial activated",
      description: "Billing is deferred by seven days. Cancel before the bill date to avoid charges.",
      intent: "info"
    });
  };

  const handleLaunch = async () => {
    try {
      // Call the backend API to finalize onboarding using authenticated request
      const data = await makeAuthenticatedRequest('/api/business/onboarding/complete', 'POST', {});
      
      // Mark onboarding as completed to prevent cleanup
      setOnboardingCompleted(true);
      
      onboarding.completeStep("goLive");
      onboarding.setOnboardingCompleted(true);
      const business = onboarding.generateBusinessFromState();
      businessStore.clearBusiness();
      businessStore.createBusiness(business);
      businessStore.bootstrapWorkspace({
        business: onboarding.business,
        website: onboarding.website,
        location: onboarding.location,
        branding: onboarding.branding,
        team: onboarding.team,
        categories: onboarding.services,
        availability: onboarding.availability,
        notifications: onboarding.notifications,
        policies: onboarding.policies,
        giftCards: onboarding.giftCards,
        payment: onboarding.paymentSetup
      });
      toast.pushToast({
        title: "Business launched",
        description: `${business.name} is live with manual capture enabled.`,
        intent: "success"
      });
      router.push(`/app/b/${business.slug}`);
    } catch (error) {
      console.error('Error launching business:', error);
      const errorMessage = error instanceof Error ? error.message : 'An error occurred while finalizing onboarding.';
      toast.pushToast({
        title: "Failed to launch business",
        description: errorMessage,
        intent: "error"
      });
    }
  };

  const stepsMeta = useMemo(
    () => [
      { id: "business", title: "Business", subtitle: "Identity & description" },
      { id: "website", title: "Website", subtitle: "Claim your subdomain" },
      { id: "location", title: "Location & contacts", subtitle: "Timezone + address" },
      { id: "team", title: "Team", subtitle: "Scheduling-only staff" },
      { id: "branding", title: "Branding", subtitle: "Logo + theme" },
      { id: "services", title: "Services & categories", subtitle: "Catalog structure" },
      { id: "availability", title: "Availability", subtitle: "Slots per staff" },
      // Always include notifications step (shows "Coming Soon" when disabled)
      { id: "notifications" as const, title: "Notifications", subtitle: isNotificationsEnabled() ? "Templates + placeholders" : "Coming soon" },
      { id: "policies", title: "Policies", subtitle: "Fees & legal copy" },
      { id: "giftCards", title: "Gift cards", subtitle: "Optional promos" },
      { id: "paymentSetup", title: "Payment setup", subtitle: "Stripe Connect + subscription" },
      { id: "goLive", title: "Go live", subtitle: "Launch & confetti" }
    ],
    []
  );

  let content: React.ReactNode = null;
  switch (onboarding.currentStep) {
    case "business":
      content = (
        <BusinessStep
          defaultValues={onboarding.business}
          onNext={handleBusinessNext}
        />
      );
      break;
    case "website":
      content = (
        <WebsiteStep
          defaultValues={onboarding.website}
          onNext={handleWebsiteNext}
          onBack={goBack}
        />
      );
      break;
    case "location":
      content = (
        <LocationStep
          defaultValues={onboarding.location}
          onNext={handleLocationNext}
          onBack={goBack}
        />
      );
      break;
    case "team":
      content = (
        <TeamStep
          defaultValues={onboarding.team}
          onNext={handleTeamNext}
          onBack={goBack}
        />
      );
      break;
    case "branding":
      content = (
        <BrandingStep
          defaultValues={onboarding.branding}
          business={onboarding.business}
          categories={onboarding.services}
          onNext={handleBrandingNext}
          onBack={goBack}
        />
      );
      break;
    case "services":
      content = (
        <ServicesStep
          defaultValues={onboarding.services}
          staff={onboarding.team}
          onNext={handleServicesNext}
          onBack={goBack}
        />
      );
      break;
    case "availability":
      content = (
        <AvailabilityStep
          services={onboarding.services}
          staff={onboarding.team}
          defaultValues={onboarding.availability}
          timezone={onboarding.location?.timezone || "America/New_York"}
          onNext={handleAvailabilityNext}
          onBack={goBack}
        />
      );
      break;
    case "notifications":
      // If notifications feature is disabled, show coming soon message
      if (!isNotificationsEnabled()) {
        content = (
          <div className="space-y-8">
            <header className="space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary/90">
                Step 8 · Notifications
              </span>
              <h2 className="font-display text-3xl text-white">Coming Soon</h2>
              <p className="max-w-3xl text-base text-white/70">
                Email and SMS notifications are coming soon! For now, your booking system will work perfectly without automated notifications.
              </p>
            </header>
            <div className="rounded-3xl border border-primary/30 bg-primary/10 p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary/50 bg-primary/10 mb-4">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <p className="text-lg font-semibold text-white">Notifications Feature Coming Soon</p>
              <p className="mt-2 text-sm text-white/70">
                We're working on bringing you automated email and SMS notifications. 
                Your booking system is fully functional - customers can book appointments and you can manage them in the admin.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={goBack}
                className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/10"
              >
                Back
              </button>
              <button
                onClick={async () => {
                  // Save Basic Plan (notifications disabled) and continue
                  await handleNotificationsNext([], false);
                }}
                className="rounded-full border border-primary/50 bg-primary/10 px-6 py-3 text-sm font-semibold text-white transition hover:border-primary/70 hover:bg-primary/15"
              >
                Continue
              </button>
            </div>
          </div>
        );
      } else {
        content = (
          <NotificationsStep
            defaultValues={onboarding.notifications}
            notificationsEnabled={onboarding.notificationsEnabled}
            onNext={handleNotificationsNext}
            onBack={goBack}
          />
        );
      }
      break;
    case "policies":
      content = (
        <PoliciesStep
          defaultValues={onboarding.policies}
          onNext={handlePoliciesNext}
          onBack={goBack}
        />
      );
      break;
    case "giftCards":
      content = (
        <GiftCardsStep
          defaultValues={onboarding.giftCards}
          onNext={handleGiftCardsNext}
          onBack={goBack}
        />
      );
      break;
    case "paymentSetup":
      content = (
        <PaymentSetupStep
          defaultValues={onboarding.paymentSetup}
          business={onboarding.business}
          onNext={handlePaymentNext}
          onBack={goBack}
        />
      );
      break;
    case "goLive":
      content = (
        <GoLiveStep
          business={onboarding.business}
          location={onboarding.location}
          staff={onboarding.team}
          categories={onboarding.services}
          bookingUrl={
            onboarding.bookingUrl ??
            `https://${sanitizeSubdomain(onboarding.website.subdomain || onboarding.business.businessName || "yourbusiness")}.main.tld`
          }
          previewUrl={`/public/${sanitizeSubdomain(
            onboarding.website.subdomain || onboarding.business.businessName || "yourbusiness"
          )}`}
          policies={onboarding.policies}
          payment={onboarding.paymentSetup}
          onLaunch={handleLaunch}
          onStartTrial={handleStartTrial}
          onBack={goBack}
        />
      );
      break;
    default:
      content = null;
  }

  return (
    <OnboardingShell
      steps={stepsMeta}
      currentStep={onboarding.currentStep}
      completedSteps={onboarding.completedSteps}
      onNavigate={navigateTo}
    >
      {content}
    </OnboardingShell>
  );
}

