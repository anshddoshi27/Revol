"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

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
import { useOnboarding, type OnboardingStepId } from "@/lib/onboarding-context";
import { useFakeBusiness } from "@/lib/fake-business";
import { useFakeSession } from "@/lib/fake-session";

function sanitizeSubdomain(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

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

export default function OnboardingPage() {
  const router = useRouter();
  const toast = useToast();
  const session = useFakeSession();
  const businessStore = useFakeBusiness();
  const onboarding = useOnboarding();

  const currentIndex = useMemo(
    () => STEP_SEQUENCE.findIndex((step) => step === onboarding.currentStep),
    [onboarding.currentStep]
  );

  const previousStep = currentIndex > 0 ? STEP_SEQUENCE[currentIndex - 1] : undefined;
  const nextStep = currentIndex < STEP_SEQUENCE.length - 1 ? STEP_SEQUENCE[currentIndex + 1] : undefined;

  useEffect(() => {
    if (!session.isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (businessStore.business && onboarding.onboardingCompleted) {
      router.replace(`/app/b/${businessStore.business.slug}`);
    }
  }, [session.isAuthenticated, businessStore.business, onboarding.onboardingCompleted, router]);

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

  const handleBusinessNext = (values: Parameters<typeof onboarding.saveBusiness>[0]) => {
    onboarding.saveBusiness(values);
    onboarding.completeStep("business");
    goForward();
  };

  const handleWebsiteNext = (values: Parameters<typeof onboarding.saveWebsite>[0]) => {
    const fallback = onboarding.business.businessName || "yourbusiness";
    const fallbackSanitized = sanitizeSubdomain(fallback);
    let normalizedSubdomain = sanitizeSubdomain(values.subdomain || fallbackSanitized);
    if (normalizedSubdomain.length < 3) {
      normalizedSubdomain = fallbackSanitized.length >= 3 ? fallbackSanitized : "yourbusiness";
    }
    onboarding.saveWebsite({
      ...values,
      subdomain: normalizedSubdomain
    });
    if (values.status === "reserved") {
      const url = `https://${normalizedSubdomain}.tithi.com`;
      onboarding.setBookingUrl(url);
    }
    onboarding.completeStep("website");
    goForward();
  };

  const handleLocationNext = (values: Parameters<typeof onboarding.saveLocation>[0]) => {
    onboarding.saveLocation(values);
    onboarding.completeStep("location");
    goForward();
  };

  const handleTeamNext = (values: Parameters<typeof onboarding.saveTeam>[0]) => {
    onboarding.saveTeam(values);
    onboarding.completeStep("team");
    goForward();
  };

  const handleBrandingNext = (values: Parameters<typeof onboarding.saveBranding>[0]) => {
    onboarding.saveBranding(values);
    onboarding.completeStep("branding");
    goForward();
  };

  const handleServicesNext = (values: Parameters<typeof onboarding.saveServices>[0]) => {
    onboarding.saveServices(values);
    onboarding.completeStep("services");
    goForward();
  };

  const handleAvailabilityNext = (values: Parameters<typeof onboarding.saveAvailability>[0]) => {
    onboarding.saveAvailability(values);
    onboarding.completeStep("availability");
    goForward();
  };

  const handleNotificationsNext = (values: Parameters<typeof onboarding.saveNotifications>[0]) => {
    onboarding.saveNotifications(values);
    onboarding.completeStep("notifications");
    goForward();
  };

  const handlePoliciesNext = (values: Parameters<typeof onboarding.savePolicies>[0]) => {
    onboarding.savePolicies(values);
    onboarding.completeStep("policies");
    goForward();
  };

  const handleGiftCardsNext = (values: Parameters<typeof onboarding.saveGiftCards>[0]) => {
    onboarding.saveGiftCards(values);
    onboarding.completeStep("giftCards");
    goForward();
  };

  const handlePaymentNext = (values: Parameters<typeof onboarding.savePaymentSetup>[0]) => {
    onboarding.savePaymentSetup(values);
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

  const handleLaunch = () => {
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
      { id: "notifications", title: "Notifications", subtitle: "Templates + placeholders" },
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
          onNext={handleAvailabilityNext}
          onBack={goBack}
        />
      );
      break;
    case "notifications":
      content = (
        <NotificationsStep
          defaultValues={onboarding.notifications}
          onNext={handleNotificationsNext}
          onBack={goBack}
        />
      );
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
            `https://${sanitizeSubdomain(onboarding.website.subdomain || onboarding.business.businessName || "yourbusiness")}.tithi.com`
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

