"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Gift,
  Loader2,
  MapPin,
  PartyPopper,
  ShieldCheck,
  Sparkles,
  Users
} from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/ui/helper-text";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { FakeBooking, FakeBusinessWorkspace } from "@/lib/admin-workspace";
import type { FakeBusiness, PublicBookingPayload } from "@/lib/fake-business";
import { buildExpandedSlots, groupSlotsByDay, type ExpandedAvailabilitySlot } from "@/lib/availability-utils";
import { formatInTimeZone } from "@/lib/timezone";

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

type Step = "catalog" | "staff" | "availability" | "checkout" | "confirmation";

interface PublicBookingExperienceProps {
  business: FakeBusiness;
  workspace: FakeBusinessWorkspace;
  recordBooking: (payload: PublicBookingPayload) => FakeBooking | undefined;
}

interface GiftCardState {
  code: string;
  amountCents: number;
  description: string;
}

export function PublicBookingExperience({
  business,
  workspace,
  recordBooking
}: PublicBookingExperienceProps) {
  const toast = useToast();
  const [step, setStep] = useState<Step>("catalog");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<ExpandedAvailabilitySlot | null>(null);
  const [giftCardState, setGiftCardState] = useState<GiftCardState | null>(null);
  const [giftCardInput, setGiftCardInput] = useState("");
  const [giftCardError, setGiftCardError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [setupIntentClientSecret, setSetupIntentClientSecret] = useState<string | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
  const [createdBookingCode, setCreatedBookingCode] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdBooking, setCreatedBooking] = useState<FakeBooking | null>(null);
  const [fetchedSlots, setFetchedSlots] = useState<ExpandedAvailabilitySlot[]>([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  const selectedService = useMemo(() => {
    if (!selectedServiceId) return undefined;
    for (const category of workspace.catalog) {
      const service = category.services.find((svc) => svc.id === selectedServiceId);
      if (service) {
        return {
          ...service,
          categoryName: category.name,
          categoryColor: category.color
        };
      }
    }
    return undefined;
  }, [selectedServiceId, workspace.catalog]);

  // Fetch availability from API when service is selected
  useEffect(() => {
    if (!selectedService || step !== "availability") {
      setFetchedSlots([]);
      return;
    }

    async function fetchAvailability() {
      setIsLoadingAvailability(true);
      setAvailabilityError(null);
      
      try {
        // Fetch availability for the next 14 days (2 weeks)
        const today = new Date();
        const allSlots: ExpandedAvailabilitySlot[] = [];
        const timezone = workspace.identity.location.timezone || "UTC";
        const dayFormatter = new Intl.DateTimeFormat("en-US", { 
          timeZone: timezone, 
          weekday: "long" 
        });
        
        for (let i = 0; i < 14; i++) {
          const date = new Date(today);
          date.setDate(today.getDate() + i);
          const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
          
          try {
            const url = `/api/public/${business.slug}/availability?service_id=${selectedService.id}&date=${dateStr}`;
            console.log(`[booking-flow] Fetching availability from: ${url}`);
            
            const response = await fetch(url);
            
            if (!response.ok) {
              const errorText = await response.text();
              console.warn(`[booking-flow] Failed to fetch availability for ${dateStr}:`, {
                status: response.status,
                statusText: response.statusText,
                error: errorText,
                serviceId: selectedService.id,
                date: dateStr
              });
              continue;
            }
            
            const data = await response.json();
            console.log(`[booking-flow] Fetched availability for ${dateStr} (service: ${selectedService.id}):`, {
              slotsCount: data.slots?.length || 0,
              hasSlots: Array.isArray(data.slots),
              sampleSlot: data.slots?.[0],
              fullResponse: data
            });
            
            if (data.slots && Array.isArray(data.slots)) {
              // Transform API slots to ExpandedAvailabilitySlot format
              for (const slot of data.slots) {
                const startDate = new Date(slot.start_at);
                const endDate = new Date(slot.end_at);
                const dayLabel = dayFormatter.format(startDate);
                
                // Find staff member to get color
                const staffMember = workspace.staff.find(s => s.id === slot.staff_id);
                const staffColor = staffMember?.color || "#000000";
                
                allSlots.push({
                  id: `${slot.staff_id}-${slot.start_at}`,
                  serviceId: selectedService.id,
                  staffId: slot.staff_id,
                  staffName: slot.staff_name,
                  staffColor: staffColor,
                  startDateTime: slot.start_at,
                  endDateTime: slot.end_at,
                  dayLabel: dayLabel,
                });
              }
            } else {
              console.warn(`[booking-flow] No slots array in response for ${dateStr}:`, data);
            }
          } catch (err) {
            console.error(`Error fetching availability for ${dateStr}:`, err);
          }
        }
        
        setFetchedSlots(allSlots);
      } catch (error) {
        console.error('Error fetching availability:', error);
        setAvailabilityError('Failed to load availability. Please try again.');
      } finally {
        setIsLoadingAvailability(false);
      }
    }

    fetchAvailability();
  }, [selectedService, step, business.slug, workspace.staff, workspace.identity.location.timezone]);

  const serviceAvailability = useMemo(() => {
    // Use fetched slots from API instead of workspace.availability
    return fetchedSlots;
  }, [fetchedSlots]);

  const groupedSlots = useMemo(() => {
    if (!selectedService || !selectedStaffId) return {};
    const filtered = serviceAvailability.filter((slot) => slot.staffId === selectedStaffId);
    return groupSlotsByDay(filtered, workspace.identity.location.timezone || "UTC");
  }, [
    serviceAvailability,
    selectedStaffId,
    workspace.identity.location.timezone,
    selectedService
  ]);

  const listPriceCents = selectedService?.priceCents ?? 0;
  const appliedGiftCardCents = giftCardState?.amountCents ?? 0;
  const amountDueCents = Math.max(listPriceCents - appliedGiftCardCents, 0);

  // Card is always required for all bookings (even cash) as backup for no-show fees
  // But we display the business's accepted methods from onboarding for information
  const businessAcceptedMethods = workspace.payment.acceptedMethods || [];
  const acceptedMethodsForDisplay = businessAcceptedMethods.length > 0 
    ? businessAcceptedMethods 
    : ["card"]; // Default to card if no methods specified

  const policies = workspace.policies;
  const timezone = workspace.identity.location.timezone || "UTC";

  const handleSelectService = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setSelectedStaffId(null); // Clear staff selection
    setSelectedSlot(null);
    setStep("staff"); // Go to staff selection step
    setGiftCardState(null);
    setGiftCardInput("");
    setGiftCardError(null);
  };

  const handleSelectStaff = (staffId: string) => {
    setSelectedStaffId(staffId);
    setSelectedSlot(null);
    setStep("availability"); // Go to availability step
    setGiftCardState(null);
    setGiftCardInput("");
    setGiftCardError(null);
  };

  const handleSelectSlot = (slot: ExpandedAvailabilitySlot) => {
    setSelectedSlot(slot);
    setGiftCardState(null);
    setGiftCardInput("");
    setGiftCardError(null);
    setStep("checkout");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleApplyGiftCard = () => {
    if (!selectedService) return;
    const code = giftCardInput.trim().toUpperCase();
    if (code.length === 0) {
      setGiftCardError("Enter a gift card code to apply.");
      return;
    }
    const program = workspace.giftCards;
    if (!program.config.enabled) {
      setGiftCardError("Gift cards are not enabled for this business.");
      return;
    }
    const allCodes = new Set([
      ...program.config.generatedCodes.map((entry) => entry.toUpperCase()),
      ...program.ledger.map((entry) => entry.code.toUpperCase())
    ]);
    if (!allCodes.has(code)) {
      setGiftCardError("That code is not recognized. Check the spelling and try again.");
      return;
    }
    const amountCents =
      program.config.amountType === "amount"
        ? program.config.amountValue
        : Math.round((selectedService.priceCents * program.config.amountValue) / 100);
    const appliedAmount = Math.min(amountCents, selectedService.priceCents);
    if (appliedAmount <= 0) {
      setGiftCardError("This gift card has no balance remaining.");
      return;
    }
    setGiftCardError(null);
    setGiftCardState({
      code,
      amountCents: appliedAmount,
      description:
        program.config.amountType === "amount"
          ? `${formatCurrency(appliedAmount)} applied`
          : `${program.config.amountValue}% off (${formatCurrency(appliedAmount)})`
    });
    toast.pushToast({
      title: "Gift card applied",
      description: `We deducted ${formatCurrency(appliedAmount)} from today's total.`,
      intent: "success"
    });
  };

  const handleSubmitCheckout = async () => {
    if (!selectedService || !selectedSlot) return;
    if (customerName.trim().length < 2) {
      toast.pushToast({
        title: "Add your name",
        description: "We need your first and last name to personalize notifications.",
        intent: "error"
      });
      return;
    }
    if (!isValidEmail(customerEmail)) {
      toast.pushToast({
        title: "Enter a valid email",
        description: "We use your email for confirmations and receipts.",
        intent: "error"
      });
      return;
    }
    if (!isValidPhone(customerPhone)) {
      toast.pushToast({
        title: "Phone number required",
        description: "Add a phone number so we can send reminders or reach you about changes.",
        intent: "error"
      });
      return;
    }
    if (!consentChecked) {
      toast.pushToast({
        title: "Consent required",
        description: "Review the policies and confirm you agree before booking.",
        intent: "error"
      });
      return;
    }
    
    // If payment method is already confirmed, booking is already created and we're done
    if (paymentMethodId && createdBookingId) {
      // Booking is complete, show confirmation
      if (selectedService && selectedSlot) {
        const booking: FakeBooking = {
          id: createdBookingId,
          code: createdBookingCode || `REVOL-${createdBookingId.slice(0, 8).toUpperCase()}`,
          status: 'pending',
          serviceId: selectedService.id,
          serviceName: selectedService.name,
          categoryName: selectedService.categoryName,
          durationMinutes: selectedService.durationMinutes,
          startDateTime: selectedSlot.startDateTime,
          endDateTime: selectedSlot.endDateTime,
          staff: {
            id: selectedSlot.staffId,
            name: selectedSlot.staffName,
            color: workspace.staff.find(s => s.id === selectedSlot.staffId)?.color || "#000000",
          },
          customer: {
            name: customerName.trim(),
            email: customerEmail.trim().toLowerCase(),
            phone: customerPhone.trim(),
          },
          payments: [],
          financials: {
            listPriceCents: listPriceCents,
            giftCardAmountCents: giftCardState?.amountCents || 0,
            platformFeeCents: 0,
            stripeFeeEstimateCents: 0,
            netPayoutCents: 0,
            currency: 'usd',
          },
          policyConsent: createPolicyConsent(policies),
          requiresAction: false,
        };
        setCreatedBooking(booking);
        setStep("confirmation");
      }
      return;
    }

    // Payment method must be set via Stripe Elements
    if (!paymentMethodId) {
      toast.pushToast({
        title: "Payment method required",
        description: "Please complete the payment form above. Your card will be saved securely but not charged.",
        intent: "error"
      });
      return;
    }

    // If we have paymentMethodId but no booking ID, the booking was created in useEffect
    // We just need to wait for the payment to be processed (it should already be done)
    if (paymentMethodId && !createdBookingId) {
      // This shouldn't happen, but handle it gracefully
      toast.pushToast({
        title: "Processing payment",
        description: "Please wait while we complete your booking.",
        intent: "info"
      });
      return;
    }
  };

  const handleResetFlow = () => {
    setStep("catalog");
    setSelectedServiceId(null);
    setSelectedStaffId("any");
    setSelectedSlot(null);
    setGiftCardState(null);
    setGiftCardInput("");
    setGiftCardError(null);
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setSetupIntentClientSecret(null);
    setPaymentMethodId(null);
    setCreatedBookingId(null);
    setCreatedBookingCode(null);
    setConsentChecked(false);
    setIsPolicyModalOpen(false);
    setCreatedBooking(null);
  };

  // Get branding from workspace
  const branding = workspace.identity.branding;
  const primaryColor = branding?.primaryColor || "#5B64FF";
  const secondaryColor = branding?.secondaryColor || "#1a1a2e";
  const useGradient = branding?.useGradient ?? true; // Default to true if not specified
  const logoUrl = branding?.logoUrl;
  const fontFamily = branding?.fontFamily || "Inter";
  const buttonShape = branding?.buttonShape || "rounded";
  const bookingPageDescription = branding?.bookingPageDescription || workspace.identity.business.description;
  
  // Get button radius class based on shape
  const getButtonRadius = () => {
    switch (buttonShape) {
      case 'rounded': return 'rounded-full';
      case 'slightly-rounded': return 'rounded-lg';
      case 'square': return 'rounded-none';
      default: return 'rounded-full';
    }
  };

  return (
    <div 
      className="relative min-h-screen"
      style={{ 
        color: primaryColor,
        fontFamily: `"${fontFamily}", system-ui, sans-serif`,
        background: useGradient
          ? `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor}15 50%, ${secondaryColor} 100%)`
          : secondaryColor
      }}
    >
      {/* Gradient overlay */}
      {useGradient && (
        <div 
          className="absolute inset-0 -z-10"
          style={{ background: `radial-gradient(ellipse at top right, ${primaryColor}30, transparent 70%)` }}
        />
      )}
      
      {step === "confirmation" ? <ConfettiOverlay /> : null}
      
      {/* Logo in top-right corner - positioned absolutely relative to viewport */}
      {logoUrl && (
        <div
          className="fixed top-6 right-6 sm:top-8 sm:right-8 z-30"
          style={{
            filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15))',
          }}
        >
          <div
            className="relative h-24 w-24 sm:h-28 sm:w-28 overflow-hidden transition-all hover:scale-105"
            style={{
              boxShadow: `0 8px 24px rgba(0, 0, 0, 0.2), 0 4px 12px ${primaryColor}15`,
            }}
          >
            {/* Use img for blob URLs, Image for regular URLs */}
            {logoUrl.startsWith('blob:') || logoUrl.startsWith('data:') ? (
              <img
                src={logoUrl}
                alt={`${workspace.identity.business.businessName} logo`}
                className="h-full w-full object-cover"
                onError={(e) => {
                  console.error('Failed to load logo:', logoUrl);
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ) : (
              <Image
                src={logoUrl}
                alt={`${workspace.identity.business.businessName} logo`}
                width={112}
                height={112}
                className="h-full w-full object-cover"
                unoptimized
                onError={() => console.error('Failed to load logo:', logoUrl)}
              />
            )}
          </div>
        </div>
      )}
      
      <header className="relative z-20 mx-auto max-w-5xl px-4 pt-16 pb-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="flex-1 space-y-8">
            {/* Business Name - Much Larger and More Prominent */}
            <div className="space-y-6">
              <h1 
                className="text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl md:text-7xl"
                style={{ 
                  color: primaryColor,
                  textShadow: `0 2px 20px ${primaryColor}40`,
                  letterSpacing: '-0.02em'
                }}
              >
                {workspace.identity.business.businessName}
              </h1>
              {bookingPageDescription && (
                <p className="mt-4 max-w-2xl text-lg leading-relaxed sm:text-xl" style={{ color: `${primaryColor}CC` }}>
                  {bookingPageDescription}
                </p>
              )}
            </div>
            
            {/* Informational Section - Better Spaced */}
            <div className="space-y-6">
              {/* Info Pills Above Line - Address, Timezone, Card Saved */}
              <div className="flex flex-nowrap items-center gap-3 overflow-x-auto">
                <span 
                  className="inline-flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0" 
                  style={{ 
                    borderColor: primaryColor,
                    backgroundColor: `${primaryColor}10`,
                    color: primaryColor 
                  }}
                >
                  <MapPin className="h-4 w-4 flex-shrink-0" aria-hidden="true" style={{ color: primaryColor }} />
                  <span>{formatAddress(workspace.identity.location)}</span>
                </span>
                <span 
                  className="inline-flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0" 
                  style={{ 
                    borderColor: primaryColor,
                    backgroundColor: `${primaryColor}08`,
                    color: `${primaryColor}CC` 
                  }}
                >
                  <Clock className="h-4 w-4 flex-shrink-0" aria-hidden="true" style={{ color: `${primaryColor}CC` }} />
                  <span>All times shown in {timezone}</span>
                </span>
                <span 
                  className="inline-flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0" 
                  style={{ 
                    borderColor: primaryColor,
                    backgroundColor: `${primaryColor}10`,
                    color: primaryColor 
                  }}
                >
                  <ShieldCheck className="h-4 w-4 flex-shrink-0" aria-hidden="true" style={{ color: primaryColor }} />
                  <span>Card saved securely — capture happens later</span>
                </span>
              </div>
              
              {/* Horizontal Line */}
              <div className="border-t" style={{ borderColor: primaryColor }}></div>
            </div>
          </div>
          
          {/* Confirmation Card */}
          {createdBooking ? (
            <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-emerald-100 shadow-[0_0_40px_rgba(52,211,153,0.25)]">
              <p className="text-sm uppercase tracking-[0.35em] text-emerald-200/70">
                Confirmation
              </p>
              <p className="mt-2 text-2xl font-bold">
                {selectedService?.name ?? createdBooking.serviceName}
              </p>
              <p className="mt-2 text-sm text-emerald-100/80">
                {formatInTimeZone(createdBooking.startDateTime, timezone, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit"
                })}
              </p>
              <p className="mt-3 text-sm text-emerald-100/80">
                We sent a confirmation email to {createdBooking.customer.email}. Manual capture keeps
                you in control—nothing charges unless you press a money button.
              </p>
            </div>
          ) : null}
        </div>
      </header>

      <main className="relative z-20 mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mt-8 mb-12">
          <StepIndicator currentStep={step} onReset={handleResetFlow} primaryColor={primaryColor} />
        </div>

        {step === "catalog" ? (
          <CatalogStep
            catalog={workspace.catalog}
            onSelectService={handleSelectService}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            useGradient={useGradient}
            buttonRadius={getButtonRadius()}
            fontFamily={fontFamily}
          />
        ) : null}

        {step === "staff" && selectedService ? (
          <StaffSelectionStep
            service={selectedService}
            staff={workspace.staff}
            onSelectStaff={handleSelectStaff}
            onBack={() => setStep("catalog")}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            useGradient={useGradient}
            buttonRadius={getButtonRadius()}
            fontFamily={fontFamily}
          />
        ) : null}

        {step === "availability" && selectedService && selectedStaffId ? (
          <AvailabilityStep
            service={selectedService}
            slotsByDay={groupedSlots}
            selectedStaffId={selectedStaffId}
            setSelectedStaffId={setSelectedStaffId}
            onBack={() => setStep("staff")}
            onSelectSlot={handleSelectSlot}
            staff={workspace.staff}
            timezone={timezone}
            supportEmail={workspace.identity.location.supportEmail}
            isLoading={isLoadingAvailability}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            buttonRadius={getButtonRadius()}
            fontFamily={fontFamily}
            error={availabilityError}
          />
        ) : null}

        {step === "checkout" && selectedService && selectedSlot ? (
          <CheckoutStep
            service={selectedService}
            slot={selectedSlot}
            onBack={() => setStep("availability")}
            customerName={customerName}
            setCustomerName={setCustomerName}
            customerEmail={customerEmail}
            setCustomerEmail={setCustomerEmail}
            customerPhone={customerPhone}
            setCustomerPhone={setCustomerPhone}
            setupIntentClientSecret={setupIntentClientSecret}
            setSetupIntentClientSecret={setSetupIntentClientSecret}
            paymentMethodId={paymentMethodId}
            setPaymentMethodId={setPaymentMethodId}
            createdBookingId={createdBookingId}
            setCreatedBookingId={setCreatedBookingId}
            createdBookingCode={createdBookingCode}
            setCreatedBookingCode={setCreatedBookingCode}
            workspace={workspace}
            customerName={customerName}
            customerEmail={customerEmail}
            customerPhone={customerPhone}
            listPriceCents={listPriceCents}
            giftCardState={giftCardState}
            policies={policies}
            timezone={timezone}
            selectedService={selectedService}
            selectedSlot={selectedSlot}
            setCreatedBooking={setCreatedBooking}
            setStep={setStep}
            toast={toast}
            consentChecked={consentChecked}
            setConsentChecked={setConsentChecked}
            giftCardInput={giftCardInput}
            setGiftCardInput={setGiftCardInput}
            giftCardError={giftCardError}
            giftCardState={giftCardState}
            onApplyGiftCard={handleApplyGiftCard}
            acceptedMethods={acceptedMethodsForDisplay}
            policies={policies}
            timezone={timezone}
            amountDueCents={amountDueCents}
            listPriceCents={listPriceCents}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmitCheckout}
            onOpenPolicies={() => setIsPolicyModalOpen(true)}
            business={business}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            buttonRadius={getButtonRadius()}
            fontFamily={fontFamily}
          />
        ) : null}

        {step === "confirmation" && createdBooking ? (
          <ConfirmationStep
            booking={createdBooking}
            service={selectedService}
            amountDueCents={amountDueCents}
            policies={policies}
            timezone={timezone}
            onBookAnother={handleResetFlow}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            buttonRadius={getButtonRadius()}
            fontFamily={fontFamily}
          />
        ) : null}
      </main>

      {isPolicyModalOpen ? (
        <PolicyModal
          policies={policies}
          onClose={() => setIsPolicyModalOpen(false)}
          timezone={timezone}
        />
      ) : null}
    </div>
  );
}

function CatalogStep({
  catalog,
  onSelectService,
  primaryColor,
  secondaryColor,
  useGradient,
  buttonRadius,
  fontFamily
}: {
  catalog: FakeBusinessWorkspace["catalog"];
  onSelectService: (serviceId: string) => void;
  primaryColor: string;
  secondaryColor: string;
  useGradient: boolean;
  buttonRadius: string;
  fontFamily: string;
}) {
  return (
    <section className="space-y-16">
      {catalog.map((category) => (
        <div key={category.id} className="space-y-8">
          <header className="space-y-4">
            <div 
              className="inline-flex items-center gap-2.5 rounded-full border-2 px-5 py-2 text-xs font-bold uppercase tracking-[0.35em]"
              style={{ 
                borderColor: primaryColor,
                backgroundColor: `${primaryColor}15`,
                color: primaryColor
              }}
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {category.name}
            </div>
            <p className="text-lg max-w-2xl leading-relaxed" style={{ color: `${primaryColor}CC` }}>{category.description}</p>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {category.services.map((service) => (
              <button
                key={service.id}
                type="button"
                onClick={() => onSelectService(service.id)}
                className={cn(
                  "group flex flex-col overflow-hidden border bg-white/5 text-left transition hover:bg-white/10 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                  "w-full",
                  buttonRadius === 'rounded-full' ? 'rounded-3xl' : buttonRadius === 'rounded-lg' ? 'rounded-2xl' : 'rounded-lg'
                )}
                style={{ 
                  '--tw-ring-color': primaryColor,
                  backgroundColor: `${secondaryColor}20`,
                  borderColor: primaryColor
                } as React.CSSProperties}
              >
                {/* Image Section - Top 45-50% */}
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  {service.imageUrl ? (
                    <>
                      {service.imageUrl.startsWith('blob:') || service.imageUrl.startsWith('data:') ? (
                        <img
                          src={service.imageUrl}
                          alt={service.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          onError={(e) => {
                            console.error('Failed to load service image:', service.imageUrl);
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <Image
                          src={service.imageUrl}
                          alt={service.name}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          sizes="(max-width: 768px) 100vw, 50vw"
                          unoptimized
                          onError={() => console.error('Failed to load service image:', service.imageUrl)}
                        />
                      )}
                    </>
                  ) : (
                    <div
                      className="absolute inset-0"
                      style={{
                        background: useGradient
                          ? `linear-gradient(135deg, ${secondaryColor}99, ${primaryColor}66, ${secondaryColor}99)`
                          : secondaryColor
                      }}
                    />
                  )}
                  
                  {/* Category Tag - Top Left */}
                  <div className="absolute top-3 left-3">
                    <span 
                      className="rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-sm"
                      style={{ 
                        backgroundColor: `${primaryColor}CC`,
                        color: secondaryColor
                      }}
                    >
                      {category.name}
                    </span>
                  </div>
                </div>

                {/* Content Section - Bottom 50-55% */}
                <div 
                  className="flex flex-1 flex-col p-6"
                  style={{ backgroundColor: `${secondaryColor}40` }}
                >
                  {/* Title and Description Section */}
                  <div className="mb-4 pb-4 border-b" style={{ borderColor: primaryColor }}>
                    <h2 
                      className="text-xl font-bold mb-2"
                      style={{ fontFamily: `"${fontFamily}", sans-serif`, color: primaryColor }}
                    >
                      {service.name}
                    </h2>
                    {service.description && (
                      <p className="text-sm leading-relaxed" style={{ color: `${primaryColor}B3` }}>
                        {service.description}
                      </p>
                    )}
                  </div>

                  {/* Price, Duration, and Book Button */}
                  <div className="mt-auto flex items-end justify-between gap-4 pt-4 border-t" style={{ borderColor: primaryColor }}>
                    <div className="flex flex-col gap-2">
                      <div className="text-2xl font-bold" style={{ color: primaryColor }}>
                        {formatCurrency(service.priceCents)}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm" style={{ color: `${primaryColor}99` }}>
                        <Clock className="h-4 w-4" aria-hidden="true" style={{ color: `${primaryColor}99` }} />
                        <span>{formatDuration(service.durationMinutes)}</span>
                      </div>
                    </div>
                    <span 
                      className={cn(
                        "shrink-0 px-4 py-2 text-sm font-semibold transition cursor-pointer",
                        buttonRadius === 'rounded-full' ? 'rounded-full' : buttonRadius === 'rounded-lg' ? 'rounded-lg' : 'rounded-none'
                      )}
                      style={{ 
                        backgroundColor: primaryColor,
                        color: secondaryColor
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '0.9';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                    >
                      Book
                    </span>
                  </div>

                  {/* Instructions (if present) */}
                  {service.instructions && (
                    <div className="mt-4 pt-4 border-t" style={{ borderColor: primaryColor }}>
                      <p className="text-xs leading-relaxed" style={{ color: `${primaryColor}80` }}>
                        {service.instructions}
                      </p>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function StaffSelectionStep({
  service,
  staff,
  onSelectStaff,
  onBack,
  primaryColor,
  secondaryColor,
  useGradient,
  buttonRadius,
  fontFamily
}: {
  service: {
    id: string;
    name: string;
    durationMinutes: number;
    priceCents: number;
    categoryName: string;
    staffIds: string[];
  };
  staff: FakeBusinessWorkspace["staff"];
  onSelectStaff: (staffId: string) => void;
  onBack: () => void;
  primaryColor: string;
  secondaryColor: string;
  useGradient: boolean;
  buttonRadius: string;
  fontFamily: string;
}) {
  // Filter staff to only show those assigned to this service
  const availableStaff = useMemo(() => {
    const staffArray = Array.isArray(staff) ? staff : [];
    if (!service.staffIds || service.staffIds.length === 0) {
      return staffArray;
    }
    return staffArray.filter((member) => service.staffIds.includes(member.id));
  }, [service.staffIds, staff]);

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em]" style={{ color: `${primaryColor}66` }}>Step 2 · Choose your staff</p>
          <h2 
            className="mt-2 text-3xl font-bold"
            style={{ fontFamily: `"${fontFamily}", sans-serif`, color: primaryColor }}
          >
            {service.name}
          </h2>
          <p className="mt-1 text-sm" style={{ color: `${primaryColor}99` }}>
            Select a staff member for this service
          </p>
        </div>
        <Button variant="ghost" onClick={onBack} className="inline-flex items-center gap-2" style={{ color: `${primaryColor}B3` }}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" style={{ color: `${primaryColor}B3` }} />
          Back to services
        </Button>
      </header>

      {availableStaff.length === 0 ? (
        <div 
          className={cn(
            "border p-8 text-center",
            buttonRadius === 'rounded-full' ? 'rounded-3xl' : buttonRadius === 'rounded-lg' ? 'rounded-2xl' : 'rounded-lg'
          )}
          style={{ borderColor: primaryColor, backgroundColor: `${secondaryColor}cc`, color: `${primaryColor}99` }}
        >
          <p className="text-base">No staff members available for this service. Please contact us for booking assistance.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {availableStaff.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => onSelectStaff(member.id)}
              className={cn(
                "group flex flex-col overflow-hidden border bg-white/5 text-left transition hover:bg-white/10 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                "w-full",
                buttonRadius === 'rounded-full' ? 'rounded-3xl' : buttonRadius === 'rounded-lg' ? 'rounded-2xl' : 'rounded-lg'
              )}
              style={{ 
                '--tw-ring-color': primaryColor,
                backgroundColor: `${secondaryColor}20`,
                borderColor: primaryColor
              } as React.CSSProperties}
            >
              {/* Image Section - Top 45-50% */}
              <div className="relative aspect-[4/3] w-full overflow-hidden">
                {member.imageUrl ? (
                  <>
                    {member.imageUrl.startsWith('blob:') || member.imageUrl.startsWith('data:') ? (
                      <img
                        src={member.imageUrl}
                        alt={member.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => {
                          console.error('Failed to load staff image:', member.imageUrl);
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <Image
                        src={member.imageUrl}
                        alt={member.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, 50vw"
                        unoptimized
                        onError={() => console.error('Failed to load staff image:', member.imageUrl)}
                      />
                    )}
                  </>
                ) : (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      background: useGradient
                        ? `linear-gradient(135deg, ${secondaryColor}99, ${primaryColor}66, ${secondaryColor}99)`
                        : secondaryColor
                    }}
                  >
                    <Users className="h-16 w-16" style={{ color: `${primaryColor}80` }} />
                  </div>
                )}
              </div>

              {/* Content Section - Bottom 50-55% */}
              <div 
                className="flex flex-1 flex-col p-6"
                style={{ backgroundColor: `${secondaryColor}40` }}
              >
                {/* Name and Role Section */}
                <div className="mb-4 pb-4 border-b" style={{ borderColor: primaryColor }}>
                  <h2 
                    className="text-xl font-bold mb-1"
                    style={{ fontFamily: `"${fontFamily}", sans-serif`, color: primaryColor }}
                  >
                    {member.name}
                  </h2>
                  {member.role && (
                    <p className="text-sm font-medium" style={{ color: `${primaryColor}99` }}>
                      {member.role}
                    </p>
                  )}
                </div>

                {/* Second border line before description */}
                <div className="mb-4 pb-4 border-b" style={{ borderColor: primaryColor }}></div>

                {/* Description Section */}
                {member.description && (
                  <div className="mb-4 pb-4">
                    <p className="text-sm leading-relaxed" style={{ color: `${primaryColor}B3` }}>
                      {member.description}
                    </p>
                  </div>
                )}

                {/* Review Section */}
                {member.review && (
                  <div className="mb-4 pb-4">
                    <p className="text-xs italic leading-relaxed mb-2" style={{ color: `${primaryColor}99` }}>
                      "{member.review}"
                    </p>
                    {member.reviewerName && (
                      <p className="text-xs font-semibold" style={{ color: `${primaryColor}80` }}>
                        — {member.reviewerName}
                      </p>
                    )}
                  </div>
                )}

                {/* Select Button */}
                <div className="mt-auto flex items-end justify-end pt-4 border-t" style={{ borderColor: primaryColor }}>
                  <span 
                    className={cn(
                      "shrink-0 px-4 py-2 text-sm font-semibold transition cursor-pointer",
                      buttonRadius === 'rounded-full' ? 'rounded-full' : buttonRadius === 'rounded-lg' ? 'rounded-lg' : 'rounded-none'
                    )}
                    style={{ 
                      backgroundColor: primaryColor,
                      color: secondaryColor
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '0.9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '1';
                    }}
                  >
                    Select
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function AvailabilityStep({
  service,
  slotsByDay,
  selectedStaffId,
  setSelectedStaffId,
  onBack,
  onSelectSlot,
  staff,
  timezone,
  supportEmail,
  isLoading,
  error,
  primaryColor,
  secondaryColor,
  buttonRadius,
  fontFamily
}: {
  service: {
    id: string;
    name: string;
    durationMinutes: number;
    priceCents: number;
    categoryName: string;
    staffIds: string[];
  };
  slotsByDay: Record<string, ExpandedAvailabilitySlot[]>;
  selectedStaffId: string | null;
  setSelectedStaffId: (value: string | null) => void; // Keep for compatibility but won't be used
  onBack: () => void;
  onSelectSlot: (slot: ExpandedAvailabilitySlot) => void;
  staff: FakeBusinessWorkspace["staff"];
  timezone: string;
  supportEmail?: string;
  isLoading?: boolean;
  error?: string | null;
  primaryColor: string;
  secondaryColor: string;
  buttonRadius: string;
  fontFamily: string;
}) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek; // Get Sunday of this week
    const sunday = new Date(today.setDate(diff));
    sunday.setHours(0, 0, 0, 0);
    return sunday;
  });
  const [selectedDayIndex, setSelectedDayIndex] = useState(0); // For mobile day navigation

  // Get staff options - if service has no staffIds, show all staff; otherwise filter
  const staffOptions = useMemo(() => {
    // Safety check: ensure staff is an array
    const staffArray = Array.isArray(staff) ? staff : [];
    
    console.log('[AvailabilityStep] Calculating staff options:', {
      staffCount: staffArray.length,
      serviceStaffIds: service.staffIds,
      allStaffIds: staffArray.map(s => s.id),
      staffIsArray: Array.isArray(staff),
    });
    
    if (staffArray.length === 0) {
      console.warn('[AvailabilityStep] No staff members available in workspace');
      return [];
    }
    
    if (!service.staffIds || service.staffIds.length === 0) {
      // If service has no staff assigned, show all staff
      console.log('[AvailabilityStep] Service has no staffIds, showing all staff');
      return staffArray;
    }
    
    const filtered = staffArray.filter((member) => service.staffIds.includes(member.id));
    console.log('[AvailabilityStep] Filtered staff:', {
      filteredCount: filtered.length,
      filtered: filtered.map(s => ({ id: s.id, name: s.name })),
      missingIds: service.staffIds.filter(id => !staffArray.find(s => s.id === id))
    });
    
    // If no staff match, show all staff as fallback
    if (filtered.length === 0) {
      console.log('[AvailabilityStep] No staff match service.staffIds, showing all staff as fallback');
      return staffArray;
    }
    
    return filtered;
  }, [service.staffIds, staff]);
  
  const totalSlots = Object.values(slotsByDay).reduce((sum, entries) => sum + entries.length, 0);

  // Generate hours from 8 AM to 8 PM
  const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM to 8 PM

  // Generate 30-minute time segments for each hour
  const timeSegments = useMemo(() => {
    const segments: Array<{ hour: number; minute: number }> = [];
    hours.forEach(hour => {
      segments.push({ hour, minute: 0 });
      segments.push({ hour, minute: 30 });
    });
    return segments;
  }, [hours]);

  // Generate days of the week
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      days.push(date);
    }
    return days;
  }, [currentWeekStart]);

  // Auto-navigate to the earliest week that has slots if current week has none
  useEffect(() => {
    if (Object.keys(slotsByDay).length === 0) return; // No slots yet
    
    // Find the earliest date with slots
    const allSlots = Object.values(slotsByDay).flat();
    if (allSlots.length === 0) return; // No slots at all
    
    const earliestSlot = allSlots.reduce((earliest, slot) => {
      const slotDate = new Date(slot.startDateTime);
      return slotDate < earliest ? slotDate : earliest;
    }, new Date(allSlots[0].startDateTime));
    
    // Check if current week contains any slots
    const earliestSlotDateKey = formatInTimeZone(earliestSlot, timezone, "yyyy-MM-dd");
    const currentWeekHasSlots = weekDays.some(day => {
      const dayKey = formatInTimeZone(day, timezone, "yyyy-MM-dd");
      const dayHasSlots = allSlots.some(slot => {
        const slotDate = new Date(slot.startDateTime);
        const slotDateKey = formatInTimeZone(slotDate, timezone, "yyyy-MM-dd");
        return slotDateKey === dayKey;
      });
      return dayHasSlots;
    });
    
    // If current week has no slots, navigate to the week containing the earliest slot
    if (!currentWeekHasSlots) {
      const earliestSlotDate = new Date(earliestSlot);
      earliestSlotDate.setHours(0, 0, 0, 0);
      const dayOfWeek = earliestSlotDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const targetSunday = new Date(earliestSlotDate);
      targetSunday.setDate(earliestSlotDate.getDate() - dayOfWeek); // Go back to Sunday
      targetSunday.setHours(0, 0, 0, 0);
      
      // Only update if it's different from current week
      if (targetSunday.getTime() !== currentWeekStart.getTime()) {
        setCurrentWeekStart(targetSunday);
        console.log(`[booking-flow] Auto-navigating to week starting ${targetSunday.toISOString().split('T')[0]} (earliest slot: ${earliestSlotDateKey})`);
      }
    }
  }, [slotsByDay, weekDays, currentWeekStart, timezone]);

  // Group slots by day and time segment (30-minute blocks)
  const slotsByDayAndTime = useMemo(() => {
    const grouped: Record<string, Record<string, ExpandedAvailabilitySlot[]>> = {};
    
    // Flatten all slots from all days
    // slotsByDay uses formatted date strings like "Monday, Jan 12" from groupSlotsByDay
    const allSlots = Object.values(slotsByDay).flat();
    
    console.log(`[booking-flow] Processing ${allSlots.length} total slots from slotsByDay keys:`, Object.keys(slotsByDay));
    console.log(`[booking-flow] Current week days:`, weekDays.map(d => formatInTimeZone(d, timezone, "yyyy-MM-dd")));
    
    allSlots.forEach(slot => {
      const slotDate = new Date(slot.startDateTime);
      const dateKey = formatInTimeZone(slotDate, timezone, "yyyy-MM-dd");
      const slotHour = parseInt(formatInTimeZone(slotDate, timezone, { hour: "numeric", hour12: false }), 10);
      const slotMinute = parseInt(formatInTimeZone(slotDate, timezone, { minute: "numeric" }), 10);
      
      // Only include slots that are in the current week
      const isInCurrentWeek = weekDays.some(day => {
        const dayKey = formatInTimeZone(day, timezone, "yyyy-MM-dd");
        return dayKey === dateKey;
      });
      
      if (!isInCurrentWeek) {
        return;
      }
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = {};
      }
      
      // Calculate slot start and end in minutes using actual slot times
      const slotStart = new Date(slot.startDateTime);
      const slotEnd = new Date(slot.endDateTime);
      // Use actual minutes from slot, not rounded
      const slotStartMinutes = slotHour * 60 + slotMinute;
      const slotEndMinutes = slotStartMinutes + (slotEnd.getTime() - slotStart.getTime()) / (1000 * 60);
      
      // Add this slot only to time segments it actually overlaps with
      let currentSegmentMinutes = slotStartMinutes;
      while (currentSegmentMinutes < slotEndMinutes) {
        const segmentHour = Math.floor(currentSegmentMinutes / 60);
        const segmentMinute = currentSegmentMinutes % 60;
        const roundedSegmentMinute = Math.floor(segmentMinute / 30) * 30;
        const segmentStartMinutes = segmentHour * 60 + roundedSegmentMinute;
        const segmentEndMinutes = segmentStartMinutes + 30;
        
        // Check if slot overlaps with this segment
        if (slotStartMinutes < segmentEndMinutes && slotEndMinutes > segmentStartMinutes) {
          const timeKey = `${segmentHour}:${roundedSegmentMinute.toString().padStart(2, '0')}`;
          
          if (!grouped[dateKey][timeKey]) {
            grouped[dateKey][timeKey] = [];
          }
          
          // Check for duplicates (same slot ID)
          const isDuplicate = grouped[dateKey][timeKey].some(
            existing => existing.id === slot.id
      );
      
      if (!isDuplicate) {
            grouped[dateKey][timeKey].push(slot);
          }
        }
        
        // Move to next 30-minute segment
        currentSegmentMinutes = segmentStartMinutes + 30;
        
        // Prevent infinite loop
        if (currentSegmentMinutes >= slotEndMinutes + 30) {
          break;
        }
      }
    });
    
    // Debug: Log grouped slots summary
    const totalGrouped = Object.values(grouped).reduce((sum, daySlots) => 
      sum + Object.values(daySlots).reduce((daySum, timeSlots) => daySum + timeSlots.length, 0), 0
    );
    console.log(`[booking-flow] Grouped ${totalGrouped} slots into time segments across ${Object.keys(grouped).length} days`);
    if (totalGrouped > 0) {
      console.log(`[booking-flow] Sample grouped slots:`, {
        dates: Object.keys(grouped).slice(0, 3),
        firstDateTimes: Object.keys(grouped).slice(0, 1).map(d => 
          grouped[d] ? Object.keys(grouped[d]).slice(0, 3) : []
        )
      });
    }
    
    return grouped;
  }, [slotsByDay, weekDays, timezone]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(newDate);
  };

  const monthYear = formatInTimeZone(weekDays[0], timezone, { month: "long", year: "numeric" });

  return (
    <section 
      className={cn(
        "border bg-white/5 p-8",
        buttonRadius === 'rounded-full' ? 'rounded-3xl' : buttonRadius === 'rounded-lg' ? 'rounded-2xl' : 'rounded-lg'
      )}
      style={{ borderColor: primaryColor, boxShadow: `0 0 60px ${primaryColor}20` }}
    >
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em]" style={{ color: `${primaryColor}66` }}>Step 3 · Choose your time</p>
          <h2 
            className="mt-2 text-3xl font-bold"
            style={{ fontFamily: `"${fontFamily}", sans-serif`, color: primaryColor }}
          >
            {service.name}
          </h2>
          <p className="mt-1 text-sm" style={{ color: `${primaryColor}99` }}>
            {formatCurrency(service.priceCents)} · {formatDuration(service.durationMinutes)} — All slots
            shown in {timezone}
          </p>
        </div>
        <Button variant="ghost" onClick={onBack} className="inline-flex items-center gap-2" style={{ color: `${primaryColor}B3` }}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" style={{ color: `${primaryColor}B3` }} />
          Back to staff
        </Button>
      </header>

      {/* Staff is already selected, just show calendar */}
      {isLoading ? (
        <div 
          className={cn(
            "mt-10 border p-8 text-center",
            buttonRadius === 'rounded-full' ? 'rounded-3xl' : buttonRadius === 'rounded-lg' ? 'rounded-2xl' : 'rounded-lg'
          )}
          style={{ borderColor: primaryColor }}
          style={{ backgroundColor: `${secondaryColor}cc`, color: `${primaryColor}99` }}
        >
          <Loader2 className="mx-auto h-8 w-8 animate-spin" aria-hidden="true" style={{ color: `${primaryColor}66` }} />
          <p className="mt-4 text-base">Loading availability...</p>
        </div>
      ) : error ? (
        <div className="mt-10 rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-center text-red-200">
          <p className="text-base">{error}</p>
        </div>
      ) : totalSlots === 0 ? (
        <div 
          className={cn(
            "mt-10 border p-8 text-center",
            buttonRadius === 'rounded-full' ? 'rounded-3xl' : buttonRadius === 'rounded-lg' ? 'rounded-2xl' : 'rounded-lg'
          )}
          style={{ borderColor: primaryColor }}
          style={{ backgroundColor: `${secondaryColor}cc`, color: `${primaryColor}99` }}
        >
          <p className="text-base">No availability found for this staff member in the next two weeks.</p>
          <p className="mt-2 text-sm">
            Try selecting a different staff member or contact us at{" "}
            <a href={`mailto:${supportEmail ?? "support@revol.com"}`} className="underline">
              {supportEmail ?? "support@revol.com"}
            </a>
            .
          </p>
        </div>
      ) : (
        <div className="mt-10">
          {/* Week Navigation */}
          <div className="mb-6 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => navigateWeek('prev')}
              style={{ color: `${primaryColor}B3` }}
              onMouseEnter={(e) => e.currentTarget.style.color = primaryColor}
              onMouseLeave={(e) => e.currentTarget.style.color = `${primaryColor}B3`}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="text-center">
              <h3 className="text-lg font-semibold" style={{ color: primaryColor }}>{monthYear}</h3>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigateWeek('next')}
              style={{ color: `${primaryColor}B3` }}
              onMouseEnter={(e) => e.currentTarget.style.color = primaryColor}
              onMouseLeave={(e) => e.currentTarget.style.color = `${primaryColor}B3`}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Mobile: Day Selector */}
          <div className="mb-6 md:hidden">
            <div 
              className="flex items-center gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden" 
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {weekDays.map((day, idx) => {
                const dateKey = formatInTimeZone(day, timezone, "yyyy-MM-dd");
                const daySlots = slotsByDayAndTime[dateKey] || {};
                const hasSlots = Object.values(daySlots).some(slots => 
                  slots.some(slot => slot.staffId === selectedStaffId)
                );
                const isSelected = selectedDayIndex === idx;
                
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDayIndex(idx)}
                    className={cn(
                      "flex-shrink-0 rounded-lg border px-4 py-3 text-center transition-all",
                      isSelected ? "font-semibold" : "opacity-60"
                    )}
                    style={{
                      borderColor: isSelected ? primaryColor : `${primaryColor}40`,
                      backgroundColor: isSelected ? `${primaryColor}15` : `${secondaryColor}40`,
                      color: primaryColor,
                      minWidth: '80px'
                    }}
                  >
                    <p className="text-xs" style={{ color: `${primaryColor}99` }}>
                      {formatInTimeZone(day, timezone, { weekday: "short" })}
                    </p>
                    <p className="text-base font-bold">
                      {formatInTimeZone(day, timezone, { day: "numeric" })}
                    </p>
                    {!hasSlots && (
                      <p className="mt-1 text-[10px]" style={{ color: `${primaryColor}66` }}>No slots</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desktop Calendar Grid */}
          <div className="hidden md:block overflow-x-auto">
            <div className="min-w-full">
              {/* Day Headers */}
              <div className="grid grid-cols-8 gap-2 border-b pb-3 mb-1" style={{ borderBottomColor: primaryColor }}>
                <div className="text-xs font-semibold" style={{ color: `${primaryColor}99` }}>Time</div>
                {weekDays.map((day, idx) => (
                  <div key={idx} className="text-center">
                    <p className="text-xs font-semibold" style={{ color: `${primaryColor}99` }}>
                      {formatInTimeZone(day, timezone, { weekday: "short" })}
                    </p>
                    <p className="text-sm font-semibold" style={{ color: primaryColor }}>
                      {formatInTimeZone(day, timezone, { day: "numeric" })}
                    </p>
                  </div>
                ))}
              </div>

              {/* Desktop Time Segment Rows - 30-minute blocks */}
              <div className="mt-2 space-y-0.5">
                {timeSegments.map((segment) => {
                  const timeKey = `${segment.hour}:${segment.minute.toString().padStart(2, '0')}`;
                  const timeLabel = segment.minute === 0 
                    ? (segment.hour === 12 ? "12 PM" : segment.hour > 12 ? `${segment.hour - 12} PM` : `${segment.hour} AM`)
                    : `${segment.minute}`;
                  
                  return (
                    <div key={timeKey} className="grid grid-cols-8 gap-2">
                      <div className="flex items-center text-xs py-2" style={{ color: `${primaryColor}80` }}>
                        {segment.minute === 0 ? (
                          <span className="font-medium" style={{ color: `${primaryColor}80` }}>{segment.hour === 12 ? "12 PM" : segment.hour > 12 ? `${segment.hour - 12} PM` : `${segment.hour} AM`}</span>
                        ) : (
                          <span className="text-[10px]" style={{ color: `${primaryColor}4D` }}>{segment.minute}</span>
                        )}
                      </div>
                      {weekDays.map((day, dayIdx) => {
                        const dateKey = formatInTimeZone(day, timezone, "yyyy-MM-dd");
                        const slotsForSegment = slotsByDayAndTime[dateKey]?.[timeKey] || [];
                        
                        // Filter out duplicate slots (same slot ID)
                        const uniqueSlots = slotsForSegment.filter((slot, index, self) => 
                          index === self.findIndex(s => s.id === slot.id)
                        );
                        
                        // Group slots by their exact start time - slots that start together should be rendered as one continuous block
                        const slotsByStartTime = new Map<string, typeof uniqueSlots>();
                        uniqueSlots.forEach(slot => {
                          const slotStart = new Date(slot.startDateTime);
                          const slotHour = parseInt(formatInTimeZone(slotStart, timezone, { hour: "numeric", hour12: false }), 10);
                          const slotMinute = parseInt(formatInTimeZone(slotStart, timezone, { minute: "numeric" }), 10);
                          const slotRoundedMinute = Math.floor(slotMinute / 30) * 30;
                          const startKey = `${slotHour}:${slotRoundedMinute.toString().padStart(2, '0')}`;
                          
                          if (!slotsByStartTime.has(startKey)) {
                            slotsByStartTime.set(startKey, []);
                          }
                          slotsByStartTime.get(startKey)!.push(slot);
                        });
                        
                        // Determine if this is the starting block for each slot group
                        const slotGroups = Array.from(slotsByStartTime.entries()).map(([startKey, slots]) => {
                          const [hour, minute] = startKey.split(':').map(Number);
                          const isStartingBlock = hour === segment.hour && minute === segment.minute;
                          
                          // Check if any slot in this group should appear in this segment (even if not starting)
                          const segmentStartMinutes = segment.hour * 60 + segment.minute;
                          const segmentEndMinutes = segmentStartMinutes + 30;
                          
                          const shouldAppear = isStartingBlock || slots.some(slot => {
                            const slotStart = new Date(slot.startDateTime);
                            const slotEnd = new Date(slot.endDateTime);
                            const slotStartMinutes = hour * 60 + minute;
                            const slotEndMinutes = slotStartMinutes + (slotEnd.getTime() - slotStart.getTime()) / (1000 * 60);
                            
                            // Slot appears in this segment if it overlaps
                            return slotStartMinutes < segmentEndMinutes && slotEndMinutes > segmentStartMinutes;
                          });
                          
                          return { startKey, slots, isStartingBlock, shouldAppear };
                        }).filter(({ shouldAppear }) => shouldAppear);
                        
                        // Filter by selected staff (required, so no "any" option)
                        const filteredSlotGroups = slotGroups
                          .map(group => ({
                            ...group,
                            slots: group.slots.filter(slot => slot.staffId === selectedStaffId)
                          }))
                          .filter(group => group.slots.length > 0);
                        
                        // Since only one staff member is selected, no need to split by multiple staff
                        const blockMinHeightRem = 2.5;
                        const blockPaddingRem = 0.25;
                        const firstBlockHeight = blockMinHeightRem + blockPaddingRem;

                        return (
                          <div key={dayIdx} className="relative py-0.5 min-h-[2.75rem]">
                            {filteredSlotGroups.map(({ startKey, slots: groupSlots, isStartingBlock }) => {
                              // Only one slot since we're filtering by selected staff
                              const slot = groupSlots[0];
                              if (!slot) return null;
                              
                              // Calculate how many 30-minute blocks this slot spans
                              const slotStart = new Date(slot.startDateTime);
                              const slotEnd = new Date(slot.endDateTime);
                              const slotDurationMinutes = (slotEnd.getTime() - slotStart.getTime()) / (1000 * 60);
                              const slotBlocksSpanned = Math.ceil(slotDurationMinutes / 30);
                              
                              if (isStartingBlock) {
                                  // Helper to convert hex to rgba with opacity
                                  const hexToRgba = (hex: string, alpha: number) => {
                                    const r = parseInt(hex.slice(1, 3), 16);
                                    const g = parseInt(hex.slice(3, 5), 16);
                                    const b = parseInt(hex.slice(5, 7), 16);
                                    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                                  };
                                  
                                  return (
                                    <button
                                      key={slot.id}
                                      type="button"
                                      onClick={() => onSelectSlot(slot)}
                                    className="absolute left-0 right-0 w-full flex items-center justify-center transition-all rounded-lg hover:scale-[1.02]"
                                      style={{
                                      height: `${firstBlockHeight}rem`,
                                      minHeight: `${firstBlockHeight}rem`,
                                      top: '0',
                                      zIndex: 100,
                                      position: 'absolute',
                                      borderRadius: '0.5rem',
                                      // Beautiful available slot styling with primary color
                                      border: `1.5px solid ${hexToRgba(primaryColor, 0.4)}`,
                                      backgroundColor: hexToRgba(primaryColor, 0.12),
                                      boxShadow: `0 2px 8px ${hexToRgba(primaryColor, 0.15)}, inset 0 1px 0 ${hexToRgba(primaryColor, 0.1)}`,
                                      '--tw-ring-color': primaryColor,
                                      } as React.CSSProperties}
                                      onMouseEnter={(e) => {
                                      e.currentTarget.style.borderColor = hexToRgba(primaryColor, 0.6);
                                      e.currentTarget.style.backgroundColor = hexToRgba(primaryColor, 0.2);
                                      e.currentTarget.style.boxShadow = `0 4px 12px ${hexToRgba(primaryColor, 0.25)}, inset 0 1px 0 ${hexToRgba(primaryColor, 0.15)}`;
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = hexToRgba(primaryColor, 0.4);
                                        e.currentTarget.style.backgroundColor = hexToRgba(primaryColor, 0.12);
                                        e.currentTarget.style.boxShadow = `0 2px 8px ${hexToRgba(primaryColor, 0.15)}, inset 0 1px 0 ${hexToRgba(primaryColor, 0.1)}`;
                                      }}
                                    title={`${formatInTimeZone(new Date(slot.startDateTime), timezone, { hour: "numeric", minute: "2-digit" })} - ${slot.staffName}`}
                                    >
                                    {/* Show time with beautiful styling */}
                                    <span className="text-xs font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" style={{ color: primaryColor }}>
                                        {formatInTimeZone(new Date(slot.startDateTime), timezone, { hour: "numeric", minute: "2-digit" })}
                                    </span>
                                    </button>
                                  );
                              } else {
                                // Continuation block for single staff member - also rounded to match
                                const [startHour, startMinute] = startKey.split(':').map(Number);
                                const segmentStartMinutes = segment.hour * 60 + segment.minute;
                                const segmentEndMinutes = segmentStartMinutes + 30;
                                
                                const slotStart = new Date(slot.startDateTime);
                                const slotEnd = new Date(slot.endDateTime);
                                const slotStartMinutes = startHour * 60 + startMinute;
                                const slotEndMinutes = slotStartMinutes + (slotEnd.getTime() - slotStart.getTime()) / (1000 * 60);
                                
                                // Only render continuation if slot actually overlaps with this segment
                                if (slotStartMinutes >= segmentEndMinutes || slotEndMinutes <= segmentStartMinutes) {
                                  return null;
                                }
                                
                                // Helper to convert hex to rgba with opacity
                                const hexToRgba = (hex: string, alpha: number) => {
                                  const r = parseInt(hex.slice(1, 3), 16);
                                  const g = parseInt(hex.slice(3, 5), 16);
                                  const b = parseInt(hex.slice(5, 7), 16);
                                  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                                };
                                
                                return (
                                  <div
                                    key={`${slot.id}-continuation`}
                                    className="absolute left-0 right-0 pointer-events-none rounded-lg"
                                    style={{
                                      height: `${firstBlockHeight}rem`,
                                      top: '0',
                                      zIndex: 99,
                                      position: 'absolute',
                                      // Continuation blocks - match the starting block styling
                                      borderLeft: `1.5px solid ${hexToRgba(primaryColor, 0.4)}`,
                                      borderRight: `1.5px solid ${hexToRgba(primaryColor, 0.4)}`,
                                      backgroundColor: hexToRgba(primaryColor, 0.12),
                                      boxShadow: `inset 0 1px 0 ${hexToRgba(primaryColor, 0.1)}`,
                                      borderTop: 'none',
                                      borderBottom: 'none',
                                      // Always use rounded corners to match empty slots
                                      borderRadius: '0.5rem',
                                      marginTop: '-1px',
                                    }}
                                  />
                                );
                              }
                            })}
                            
                            {/* Show empty state if no slots - subtle empty cell with rounded-lg to match slot style */}
                            {filteredSlotGroups.length === 0 && (
                              <div className="h-full rounded-lg bg-white/[0.02] border py-0.5 min-h-[2.75rem] transition-colors hover:bg-white/[0.04]" style={{ borderColor: primaryColor }}>
                                {/* Empty - no content */}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Mobile: Vertical Time Slots List */}
          <div className="md:hidden">
            {(() => {
              const selectedDay = weekDays[selectedDayIndex];
              const dateKey = formatInTimeZone(selectedDay, timezone, "yyyy-MM-dd");
              const daySlots = slotsByDayAndTime[dateKey] || {};
              
              // Collect all unique slots for this day
              const allDaySlots: ExpandedAvailabilitySlot[] = [];
              Object.values(daySlots).forEach(timeSlotArray => {
                timeSlotArray.forEach(slot => {
                  if (slot.staffId === selectedStaffId && !allDaySlots.find(s => s.id === slot.id)) {
                    allDaySlots.push(slot);
                  }
                });
              });
              
              // Sort slots by start time
              allDaySlots.sort((a, b) => 
                new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
              );

              if (allDaySlots.length === 0) {
                return (
                  <div className="rounded-lg border p-8 text-center" style={{ borderColor: `${primaryColor}40`, backgroundColor: `${secondaryColor}40` }}>
                    <p className="text-sm" style={{ color: `${primaryColor}99` }}>
                      No available slots for {formatInTimeZone(selectedDay, timezone, { weekday: "long", month: "short", day: "numeric" })}
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {allDaySlots.map((slot) => {
                    const slotStart = new Date(slot.startDateTime);
                    const slotEnd = new Date(slot.endDateTime);
                    const hexToRgba = (hex: string, alpha: number) => {
                      const r = parseInt(hex.slice(1, 3), 16);
                      const g = parseInt(hex.slice(3, 5), 16);
                      const b = parseInt(hex.slice(5, 7), 16);
                      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                    };
                    
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => onSelectSlot(slot)}
                        className="w-full rounded-lg border p-4 text-left transition-all active:scale-[0.98]"
                        style={{
                          borderColor: hexToRgba(primaryColor, 0.4),
                          backgroundColor: hexToRgba(primaryColor, 0.12),
                          boxShadow: `0 2px 8px ${hexToRgba(primaryColor, 0.15)}`,
                        }}
                        onTouchStart={(e) => {
                          e.currentTarget.style.borderColor = hexToRgba(primaryColor, 0.6);
                          e.currentTarget.style.backgroundColor = hexToRgba(primaryColor, 0.2);
                        }}
                        onTouchEnd={(e) => {
                          e.currentTarget.style.borderColor = hexToRgba(primaryColor, 0.4);
                          e.currentTarget.style.backgroundColor = hexToRgba(primaryColor, 0.12);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-lg font-bold" style={{ color: primaryColor }}>
                              {formatInTimeZone(slotStart, timezone, { hour: "numeric", minute: "2-digit" })}
                            </p>
                            <p className="mt-1 text-xs" style={{ color: `${primaryColor}99` }}>
                              {formatDuration((slotEnd.getTime() - slotStart.getTime()) / (1000 * 60))} · {slot.staffName}
                            </p>
                          </div>
                          <ChevronRight className="h-5 w-5" style={{ color: `${primaryColor}80` }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </section>
  );
}

function CheckoutStep(props: {
  service: {
    id: string;
    name: string;
    durationMinutes: number;
    priceCents: number;
    categoryName: string;
  };
  slot: ExpandedAvailabilitySlot;
  onBack: () => void;
  customerName: string;
  setCustomerName: (value: string) => void;
  customerEmail: string;
  setCustomerEmail: (value: string) => void;
  customerPhone: string;
  setCustomerPhone: (value: string) => void;
  setupIntentClientSecret: string | null;
  setSetupIntentClientSecret: (value: string | null) => void;
  paymentMethodId: string | null;
  setPaymentMethodId: (value: string | null) => void;
  createdBookingId: string | null;
  setCreatedBookingId: (value: string | null) => void;
  createdBookingCode: string | null;
  setCreatedBookingCode: (value: string | null) => void;
  workspace: FakeBusinessWorkspace;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  listPriceCents: number;
  giftCardState: GiftCardState | null;
  policies: FakeBusinessWorkspace["policies"];
  timezone: string;
  selectedService: {
    id: string;
    name: string;
    durationMinutes: number;
    priceCents: number;
    categoryName: string;
  } | undefined;
  selectedSlot: ExpandedAvailabilitySlot | null;
  setCreatedBooking: (booking: FakeBooking | null) => void;
  setStep: (step: Step) => void;
  toast: ReturnType<typeof useToast>;
  consentChecked: boolean;
  setConsentChecked: (value: boolean) => void;
  giftCardInput: string;
  setGiftCardInput: (value: string) => void;
  giftCardError: string | null;
  giftCardState: GiftCardState | null;
  onApplyGiftCard: () => void;
  acceptedMethods: string[];
  policies: FakeBusinessWorkspace["policies"];
  timezone: string;
  amountDueCents: number;
  listPriceCents: number;
  isSubmitting: boolean;
  onSubmit: () => void;
  onOpenPolicies: () => void;
  business: FakeBusiness;
  primaryColor: string;
  secondaryColor: string;
  buttonRadius: string;
  fontFamily: string;
}) {
  const {
    service,
    slot,
    onBack,
    customerName,
    setCustomerName,
    customerEmail,
    setCustomerEmail,
    customerPhone,
    setCustomerPhone,
    setupIntentClientSecret,
    setSetupIntentClientSecret,
    paymentMethodId,
    setPaymentMethodId,
    createdBookingId,
    setCreatedBookingId,
    createdBookingCode,
    setCreatedBookingCode,
    workspace,
    listPriceCents,
    giftCardState,
    policies,
    timezone,
    selectedService,
    selectedSlot,
    setCreatedBooking,
    setStep,
    toast,
    consentChecked,
    setConsentChecked,
    giftCardInput,
    setGiftCardInput,
    giftCardError,
    onApplyGiftCard,
    acceptedMethods,
    amountDueCents,
    isSubmitting,
    onSubmit,
    onOpenPolicies,
    business,
    primaryColor,
    secondaryColor,
    buttonRadius,
    fontFamily
  } = props;

  // Create SetupIntent when user has filled required fields so payment form appears immediately
  useEffect(() => {
    // Helper functions (defined later in file, but accessible here)
    const isValidEmail = (email: string) => /\S+@\S+\.\S+/.test(email);
    const isValidPhone = (phone: string) => phone.trim().length >= 7;
    
    // Only create if we don't already have one and user has entered name, email, and phone
    const hasRequiredFields = customerName.trim().length >= 2 && 
                               isValidEmail(customerEmail) && 
                               isValidPhone(customerPhone);
    
    if (!setupIntentClientSecret && selectedService && selectedSlot && hasRequiredFields) {
      // Create booking to get SetupIntent - this allows the payment form to show immediately
      const createSetupIntent = async () => {
        try {
          const apiPayload = {
            service_id: selectedService.id,
            staff_id: selectedSlot.staffId,
            start_at: selectedSlot.startDateTime,
            customer: {
              name: customerName.trim(),
              email: customerEmail.trim().toLowerCase(),
              phone: customerPhone.trim()
            },
            gift_card_code: giftCardState?.code,
          };

          const response = await fetch(`/api/public/${business.slug}/bookings`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(apiPayload),
          });

          if (!response.ok) {
            // Don't show error if booking creation fails - user hasn't clicked confirm yet
            console.error('Failed to create SetupIntent:', await response.text());
            return;
          }

          const apiResponse = await response.json();
          
          if (apiResponse.client_secret) {
            setSetupIntentClientSecret(apiResponse.client_secret);
            // Store booking IDs so we can use them when payment is confirmed
            if (apiResponse.booking_id) {
              setCreatedBookingId(apiResponse.booking_id);
            }
            if (apiResponse.booking_code) {
              setCreatedBookingCode(apiResponse.booking_code);
            }
          }
        } catch (error) {
          console.error('Error creating SetupIntent:', error);
          // Don't show error to user - they haven't tried to submit yet
        }
      };

      createSetupIntent();
    }
  }, [setupIntentClientSecret, selectedService, selectedSlot, customerName, customerEmail, customerPhone, business.slug, giftCardState, setSetupIntentClientSecret, setCreatedBookingId, setCreatedBookingCode]);

  return (
    <section 
      className={cn(
        "flex flex-col gap-6 border bg-white/5 p-4 md:grid md:grid-cols-[1.4fr_1fr] md:gap-8 md:p-8",
        buttonRadius === 'rounded-full' ? 'rounded-3xl' : buttonRadius === 'rounded-lg' ? 'rounded-2xl' : 'rounded-lg'
      )}
      style={{ borderColor: primaryColor, boxShadow: `0 0 60px ${primaryColor}25` }}
    >
      <div className="flex flex-col space-y-6 md:space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em]" style={{ color: primaryColor }}>Step 3 · Checkout</p>
            <h2 
              className="mt-2 text-2xl md:text-3xl font-bold"
              style={{ fontFamily: `"${fontFamily}", sans-serif`, color: primaryColor }}
            >
              {service.name}
            </h2>
            <p className="mt-1 text-sm" style={{ color: primaryColor }}>
            {formatDuration(service.durationMinutes)} · {formatCurrency(listPriceCents)} — with{" "}
              {slot.staffName}
            </p>
          </div>
          <Button 
            variant="ghost" 
            onClick={onBack} 
            className="inline-flex items-center gap-2 self-start md:self-auto" 
            style={{ color: primaryColor }}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm md:text-base">Pick another slot</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Full name" primaryColor={primaryColor}>
            <Input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Jordan Blake"
              autoComplete="name"
              textColor={primaryColor}
              borderColor={primaryColor}
              className="text-base md:text-sm"
            />
          </Field>
          <Field label="Email" primaryColor={primaryColor}>
            <Input
              type="email"
              value={customerEmail}
              onChange={(event) => setCustomerEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              textColor={primaryColor}
              borderColor={primaryColor}
              className="text-base md:text-sm"
            />
          </Field>
          <Field label="Phone" primaryColor={primaryColor}>
            <Input
              type="tel"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              placeholder="+1 555 010 2030"
              autoComplete="tel"
              textColor={primaryColor}
              borderColor={primaryColor}
              className="text-base md:text-sm"
            />
          </Field>
          <Field label="Gift card or code" helper="Optional — amount or percent off will apply immediately." primaryColor={primaryColor}>
            <div className="flex gap-2">
              <Input
                value={giftCardInput}
                onChange={(event) => setGiftCardInput(event.target.value)}
                placeholder="WELCOME120"
                className="flex-1 text-base md:text-sm uppercase"
                autoCapitalize="characters"
                textColor={primaryColor}
                borderColor={primaryColor}
              />
              <Button type="button" variant="outline" onClick={onApplyGiftCard}>
                Apply
              </Button>
            </div>
            {giftCardError ? (
              <HelperText intent="error" className="mt-2">
                {giftCardError}
              </HelperText>
            ) : null}
            {giftCardState ? (
              <HelperText intent="success" className="mt-2 text-emerald-200">
                <Gift className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
                {giftCardState.description} ({giftCardState.code})
              </HelperText>
            ) : null}
          </Field>
        </div>

        <div 
          className={cn(
            "border p-4 md:p-6",
            buttonRadius === 'rounded-full' ? 'rounded-3xl' : buttonRadius === 'rounded-lg' ? 'rounded-2xl' : 'rounded-lg'
          )}
          style={{ 
            borderColor: primaryColor,
            backgroundColor: `${secondaryColor}cc`,
            color: primaryColor
          }}
        >
          <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: primaryColor }}>
            <CreditCard className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span className="text-xs md:text-sm">Payment method — card saved now, charged later</span>
          </p>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: primaryColor }}>
            {acceptedMethods.length > 0 
              ? `${describeAcceptedMethods(acceptedMethods)}. ` 
              : ''}A credit card is required for all bookings. Even if you plan to pay with cash, we store a card
            in case a policy fee applies (e.g., no-show fees).
          </p>
          {setupIntentClientSecret ? (
            <div className="mt-4">
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret: setupIntentClientSecret,
                  appearance: {
                    theme: 'night',
                    variables: {
                      colorPrimary: primaryColor,
                      colorBackground: secondaryColor,
                      colorText: primaryColor,
                      colorDanger: '#ef4444',
                      fontFamily: `"${fontFamily}", system-ui, sans-serif`,
                      spacingUnit: '4px',
                      borderRadius: buttonRadius === 'rounded-full' ? '9999px' : buttonRadius === 'rounded-lg' ? '8px' : '0px',
                    },
                  },
                }}
              >
                <StripePaymentForm
                  onPaymentMethodReady={async (pmId: string) => {
                    setPaymentMethodId(pmId);
                    // Once payment method is confirmed, proceed to confirmation
                    // The booking was already created by the API
                    if (selectedService && selectedSlot && createdBookingId) {
                      const booking: FakeBooking = {
                        id: createdBookingId,
                        code: createdBookingCode || `REVOL-${createdBookingId.slice(0, 8).toUpperCase()}`,
                        status: 'pending',
                        serviceId: selectedService.id,
                        serviceName: selectedService.name,
                        categoryName: selectedService.categoryName,
                        durationMinutes: selectedService.durationMinutes,
                        startDateTime: selectedSlot.startDateTime,
                        endDateTime: selectedSlot.endDateTime,
                        staff: {
                          id: selectedSlot.staffId,
                          name: selectedSlot.staffName,
                          color: workspace.staff.find(s => s.id === selectedSlot.staffId)?.color || "#000000",
                        },
                        customer: {
                          name: customerName.trim(),
                          email: customerEmail.trim().toLowerCase(),
                          phone: customerPhone.trim(),
                        },
                        payments: [],
                        financials: {
                          listPriceCents: listPriceCents,
                          giftCardAmountCents: giftCardState?.amountCents || 0,
                          platformFeeCents: 0,
                          stripeFeeEstimateCents: 0,
                          netPayoutCents: 0,
                          currency: 'usd',
                        },
                        policyConsent: createPolicyConsent(policies),
                        requiresAction: false,
                      };
                      setCreatedBooking(booking);
                      setStep("confirmation");
                      toast.pushToast({
                        title: "Booking confirmed",
                        description: `${selectedService.name} on ${formatInTimeZone(
                          selectedSlot.startDateTime,
                          timezone,
                          { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
                        )}. No charge yet—card saved securely.`,
                        intent: "success"
                      });
                    }
                  }}
                  acceptedMethods={acceptedMethods}
                  businessSlug={business.slug}
                  bookingId={createdBookingId || ""}
                />
              </Elements>
            </div>
          ) : (
            <div className="mt-4">
              <HelperText style={{ color: primaryColor }}>
                Click "Confirm booking" below to set up your payment method. Your card will be saved securely but not charged.
              </HelperText>
            </div>
          )}
          <HelperText className="mt-2" style={{ color: primaryColor }}>
            You're authorizing a card on file. Per Revol's manual capture rules, nothing is charged until
            your appointment is completed or a policy fee applies.
          </HelperText>
        </div>

        <div 
          className={cn(
            "flex flex-col gap-4 border p-4 md:p-6",
            buttonRadius === 'rounded-full' ? 'rounded-3xl' : buttonRadius === 'rounded-lg' ? 'rounded-2xl' : 'rounded-lg'
          )}
          style={{ 
            borderColor: primaryColor,
            backgroundColor: `${secondaryColor}cc`,
            color: primaryColor
          }}
        >
          <div className="flex items-start gap-3">
            <input
              id="policy-consent"
              type="checkbox"
              checked={consentChecked}
              onChange={(event) => setConsentChecked(event.target.checked)}
              className="mt-1 h-5 w-5 flex-shrink-0 rounded focus:ring-2"
              style={{ borderColor: primaryColor }}
              style={{ 
                accentColor: primaryColor,
                backgroundColor: `${secondaryColor}80`,
                '--tw-ring-color': primaryColor,
              } as React.CSSProperties}
            />
            <label htmlFor="policy-consent" className="text-xs md:text-sm leading-relaxed" style={{ color: primaryColor }}>
              I agree to the cancellation, no-show, refund, and cash policies. My card is saved via Stripe
              for manual capture later.{" "}
              <button
                type="button"
                onClick={onOpenPolicies}
                className="underline-offset-2 hover:underline"
                style={{ color: primaryColor }}
              >
                View policies
              </button>
              .
            </label>
          </div>
          {!paymentMethodId ? (
            <Button
              size="lg"
              onClick={onSubmit}
              isLoading={isSubmitting}
              disabled={isSubmitting || !!setupIntentClientSecret}
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 text-sm md:text-base"
              style={{ backgroundColor: primaryColor }}
              onMouseEnter={(e) => {
                if (!isSubmitting && !setupIntentClientSecret) {
                  const hexToRgba = (hex: string, alpha: number) => {
                    const r = parseInt(hex.slice(1, 3), 16);
                    const g = parseInt(hex.slice(3, 5), 16);
                    const b = parseInt(hex.slice(5, 7), 16);
                    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                  };
                  e.currentTarget.style.backgroundColor = hexToRgba(primaryColor, 0.85);
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = primaryColor;
              }}
            >
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              <span className="text-sm md:text-base">{setupIntentClientSecret ? 'Complete payment setup below' : 'Confirm booking — no charge today'}</span>
            </Button>
          ) : (
            <HelperText intent="success" className="text-emerald-200">
              Payment method saved! Your booking is complete.
            </HelperText>
          )}
        </div>
      </div>

      <aside 
        className={cn(
          "order-first md:order-last flex flex-col gap-4 border p-4 md:p-6",
          buttonRadius === 'rounded-full' ? 'rounded-3xl' : buttonRadius === 'rounded-lg' ? 'rounded-2xl' : 'rounded-lg'
        )}
        style={{ 
          borderColor: primaryColor,
          backgroundColor: `${secondaryColor}cc`,
          color: primaryColor
        }}
      >
        <div>
          <p className="text-xs uppercase tracking-[0.35em]" style={{ color: primaryColor }}>Summary</p>
          <h3 
            className="mt-2 text-2xl font-bold"
            style={{ fontFamily: `"${fontFamily}", sans-serif`, color: primaryColor }}
          >
            {service.name}
          </h3>
          <p className="mt-2 flex items-center gap-2 text-sm" style={{ color: primaryColor }}>
            <CalendarDays className="h-4 w-4" aria-hidden="true" style={{ color: primaryColor }} />
            {formatInTimeZone(slot.startDateTime, timezone, {
              weekday: "long",
              month: "short",
              day: "numeric"
            })}
          </p>
          <p className="mt-1 flex items-center gap-2 text-sm" style={{ color: primaryColor }}>
            <Clock className="h-4 w-4" aria-hidden="true" style={{ color: primaryColor }} />
            {formatInTimeZone(slot.startDateTime, timezone, {
              hour: "numeric",
              minute: "2-digit"
            })}{" "}
            — {formatDuration(service.durationMinutes)}
          </p>
          <p className="mt-1 flex items-center gap-2 text-sm" style={{ color: primaryColor }}>
            <Users className="h-4 w-4" aria-hidden="true" style={{ color: primaryColor }} />
            {slot.staffName}
          </p>
        </div>
        <div className="border-t pt-4 text-sm" style={{ color: primaryColor, borderTopColor: primaryColor }}>
          <div className="flex items-center justify-between">
            <span>Service price</span>
            <span style={{ color: primaryColor }}>{formatCurrency(listPriceCents)}</span>
          </div>
          {giftCardState ? (
            <div className="mt-2 flex items-center justify-between text-emerald-200">
              <span>Gift card ({giftCardState.code})</span>
              <span>-{formatCurrency(giftCardState.amountCents)}</span>
            </div>
          ) : null}
          <div className="mt-4 flex items-center justify-between text-base font-semibold" style={{ color: primaryColor }}>
            <span>Due today</span>
            <span>{formatCurrency(amountDueCents)}</span>
          </div>
          <HelperText className="mt-3" style={{ color: primaryColor }}>
            This amount is authorized but not captured. Manual capture ensures you only charge customers
            after services are delivered or if a policy fee applies.
          </HelperText>
        </div>
      </aside>
    </section>
  );
}

function ConfirmationStep({
  booking,
  service,
  amountDueCents,
  policies,
  timezone,
  onBookAnother,
  primaryColor,
  secondaryColor,
  buttonRadius,
  fontFamily
}: {
  booking: FakeBooking;
  service?: {
    name: string;
    durationMinutes: number;
    priceCents: number;
  };
  amountDueCents: number;
  policies: FakeBusinessWorkspace["policies"];
  timezone: string;
  onBookAnother: () => void;
  primaryColor: string;
  secondaryColor: string;
  buttonRadius: string;
  fontFamily: string;
}) {
  return (
    <section className="rounded-3xl border border-emerald-400/40 bg-emerald-500/10 p-10 text-emerald-50 shadow-[0_0_80px_rgba(16,185,129,0.35)]">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-400/20 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-emerald-100">
            <PartyPopper className="h-4 w-4" aria-hidden="true" />
            Booking confirmed
          </div>
          <h2 className="mt-4 font-display text-4xl text-emerald-50">
            {service?.name ?? booking.serviceName}
          </h2>
          <p className="mt-2 text-sm text-emerald-100/80">
            We emailed {booking.customer.email} and will send reminders via SMS. Your card is saved but
            won’t be charged until the appointment is completed—or if a manual policy fee applies.
          </p>
        </div>
        <div 
          className={cn(
            "border border-emerald-400/50 p-6 text-sm text-emerald-100/80",
            buttonRadius === 'rounded-full' ? 'rounded-3xl' : buttonRadius === 'rounded-lg' ? 'rounded-2xl' : 'rounded-lg'
          )}
          style={{ backgroundColor: `${secondaryColor}80` }}
        >
          <p className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            {formatInTimeZone(booking.startDateTime, timezone, {
              weekday: "long",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit"
            })}
          </p>
          {booking.staff ? (
            <p className="mt-1 flex items-center gap-2">
              <Users className="h-4 w-4" aria-hidden="true" />
              {booking.staff.name}
            </p>
          ) : null}
          <p className="mt-1 flex items-center gap-2" style={{ color: `${primaryColor}99` }}>
            <Clock className="h-4 w-4" aria-hidden="true" style={{ color: `${primaryColor}99` }} />
            {formatDuration(service?.durationMinutes ?? booking.durationMinutes)}
          </p>
          <div className="mt-4 border-t border-emerald-400/30 pt-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Authorized</span>
              <span>{formatCurrency(service?.priceCents ?? booking.financials.listPriceCents)}</span>
            </div>
            {amountDueCents < (service?.priceCents ?? booking.financials.listPriceCents) ? (
              <div className="flex items-center justify-between text-emerald-200">
                <span>Gift card</span>
                <span>-{formatCurrency((service?.priceCents ?? booking.financials.listPriceCents) - amountDueCents)}</span>
              </div>
            ) : null}
            <div className="mt-2 flex items-center justify-between text-base font-semibold text-emerald-50">
              <span>Due after appointment</span>
              <span>{formatCurrency(amountDueCents)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 space-y-6">
        {/* What happens next - compact section */}
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/80">What happens next</p>
          <p className="mt-1.5 text-sm text-emerald-100/70">
            Check your email for confirmation details. Reschedule or cancel at least 24h in advance.
          </p>
        </div>

        {/* Policies - individual boxes */}
        {policies.cancellationPolicy || policies.noShowPolicy || policies.refundPolicy || policies.cashPolicy ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-200/90">Policies</p>
            <div className="grid gap-3 md:grid-cols-2">
              {policies.cancellationPolicy ? (
                <div 
                  className={cn(
                    "rounded-2xl border border-emerald-400/40 p-5 backdrop-blur-sm",
                    buttonRadius === 'rounded-full' ? 'rounded-3xl' : buttonRadius === 'rounded-lg' ? 'rounded-2xl' : 'rounded-xl'
                  )}
                  style={{ backgroundColor: `${secondaryColor}90` }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/90 mb-2">Cancellations</p>
                  <p className="text-sm leading-relaxed text-emerald-100/85">{policies.cancellationPolicy}</p>
                </div>
              ) : null}
              {policies.noShowPolicy ? (
                <div 
                  className={cn(
                    "rounded-2xl border border-emerald-400/40 p-5 backdrop-blur-sm",
                    buttonRadius === 'rounded-full' ? 'rounded-3xl' : buttonRadius === 'rounded-lg' ? 'rounded-2xl' : 'rounded-xl'
                  )}
                  style={{ backgroundColor: `${secondaryColor}90` }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/90 mb-2">No-show appointments</p>
                  <p className="text-sm leading-relaxed text-emerald-100/85">{policies.noShowPolicy}</p>
                </div>
              ) : null}
              {policies.refundPolicy ? (
                <div 
                  className={cn(
                    "rounded-2xl border border-emerald-400/40 p-5 backdrop-blur-sm",
                    buttonRadius === 'rounded-full' ? 'rounded-3xl' : buttonRadius === 'rounded-lg' ? 'rounded-2xl' : 'rounded-xl'
                  )}
                  style={{ backgroundColor: `${secondaryColor}90` }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/90 mb-2">Refunds</p>
                  <p className="text-sm leading-relaxed text-emerald-100/85">{policies.refundPolicy}</p>
                </div>
              ) : null}
              {policies.cashPolicy ? (
                <div 
                  className={cn(
                    "rounded-2xl border border-emerald-400/40 p-5 backdrop-blur-sm",
                    buttonRadius === 'rounded-full' ? 'rounded-3xl' : buttonRadius === 'rounded-lg' ? 'rounded-2xl' : 'rounded-xl'
                  )}
                  style={{ backgroundColor: `${secondaryColor}90` }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/90 mb-2">Payments</p>
                  <p className="text-sm leading-relaxed text-emerald-100/85">{policies.cashPolicy}</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div 
            className={cn(
              "border border-emerald-400/30 p-6 text-center",
              buttonRadius === 'rounded-full' ? 'rounded-3xl' : buttonRadius === 'rounded-lg' ? 'rounded-2xl' : 'rounded-xl'
            )}
            style={{ backgroundColor: `${secondaryColor}60` }}
          >
            <p className="text-sm text-emerald-100/60">No policies configured for this business.</p>
          </div>
        )}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <Button
          variant="outline"
          onClick={onBookAnother}
          className="inline-flex items-center gap-2 border-emerald-400/40 text-emerald-100 hover:border-emerald-300 hover:text-emerald-50"
        >
          Book another appointment
        </Button>
        <p className="text-sm text-emerald-100/70">
          Need help? Reply to the confirmation email or text us at {booking.customer.phone}.
        </p>
      </div>
    </section>
  );
}

function PolicyModal({
  policies,
  onClose,
  timezone,
  primaryColor
}: {
  policies: FakeBusinessWorkspace["policies"];
  onClose: () => void;
  timezone: string;
  primaryColor: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-8"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-white/10 p-8 backdrop-blur">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 transition"
          style={{ color: `${primaryColor}99` }}
          onMouseEnter={(e) => e.currentTarget.style.color = primaryColor}
          onMouseLeave={(e) => e.currentTarget.style.color = `${primaryColor}99`}
          aria-label="Close policies"
        >
          ✕
        </button>
        <h2 className="font-display text-3xl" style={{ color: primaryColor }}>Booking policies</h2>
        <p className="mt-2 text-sm" style={{ color: `${primaryColor}99` }}>
          All times referenced align to {timezone}. Consent is required before submitting your booking.
        </p>
        <div className="mt-6 space-y-5 text-sm leading-relaxed" style={{ color: `${primaryColor}BF` }}>
          <PolicyBlock title="Cancellation policy" body={policies.cancellationPolicy} primaryColor={primaryColor} />
          <PolicyBlock title="Cancellation fees" body={describeFee(policies.cancellationFeeType, policies.cancellationFeeValue)} primaryColor={primaryColor} />
          <PolicyBlock title="No-show policy" body={policies.noShowPolicy} primaryColor={primaryColor} />
          <PolicyBlock title="No-show fee" body={describeFee(policies.noShowFeeType, policies.noShowFeeValue)} primaryColor={primaryColor} />
          <PolicyBlock title="Refund policy" body={policies.refundPolicy} primaryColor={primaryColor} />
          <PolicyBlock title="Cash policy" body={policies.cashPolicy} primaryColor={primaryColor} />
        </div>
        <div className="mt-8 flex justify-end">
          <Button onClick={onClose} className="inline-flex items-center gap-2">
            <Check className="h-4 w-4" aria-hidden="true" />
            I understand
          </Button>
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ currentStep, onReset, primaryColor }: { currentStep: Step; onReset: () => void; primaryColor: string }) {
  const steps: Array<{ id: Step; label: string }> = [
      { id: "catalog", label: "Service" },
      { id: "staff", label: "Staff" },
    { id: "availability", label: "Time" },
    { id: "checkout", label: "Checkout" },
    { id: "confirmation", label: "Done" }
  ];
  return (
    <div className="w-full rounded-3xl border px-8 py-6" style={{ 
      borderColor: `${primaryColor}30`,
      backgroundColor: `${primaryColor}08`,
    }}>
      <div className="relative flex items-start">
        {steps.map((step, index) => {
          const isActive = currentStep === step.id;
          return (
            <div key={step.id} className="relative flex flex-1 items-start">
              <div className="flex flex-col items-center gap-1.5 w-full relative z-10">
                {/* Circular bubble with number - consistent for all steps */}
                <span
                  className={cn(
                    "relative inline-flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition-all",
                    isActive
                      ? undefined
                      : "border-white/20 bg-white/5"
                  )}
                  style={isActive ? {
                    borderColor: primaryColor,
                    backgroundColor: `${primaryColor}25`,
                    color: primaryColor,
                    boxShadow: `0 0 20px ${primaryColor}40`,
                  } : {
                    color: `${primaryColor}80`,
                  }}
                >
                  {index + 1}
                </span>
                {/* Label outside bubble - consistent for all steps */}
                <span 
                  className="text-sm uppercase tracking-[0.35em] font-semibold whitespace-nowrap"
                  style={{ color: isActive ? primaryColor : `${primaryColor}80` }}
                >
                  {step.label}
                </span>
              </div>
              {/* Connector line between steps - connects from right of text to left of next circle */}
              {index < steps.length - 1 && (
                <div 
                  className="absolute top-5 h-px z-0"
                  style={{ 
                    left: 'calc(50% + 2.5rem)',
                    width: 'calc(100% - 5rem)',
                    backgroundColor: `${primaryColor}20`
                  }} 
                  aria-hidden="true" 
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label,
  helper,
  children,
  primaryColor
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
  primaryColor: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm" style={{ color: primaryColor }}>
      <span className="font-semibold" style={{ color: primaryColor }}>{label}</span>
      {children}
      {helper ? <HelperText className="text-[13px]" style={{ color: primaryColor }}>{helper}</HelperText> : null}
    </label>
  );
}

function StaffPill({
  label,
  color,
  active,
  primaryColor,
  onClick
}: {
  label: string;
  color?: string;
  active: boolean;
  primaryColor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
        active ? "border-white/60 bg-white/15" : "border-white/10 bg-white/5 hover:border-white/20"
      )}
      style={{
        ...(active && color ? { borderColor: color, boxShadow: `0 0 25px ${color}33` } : {}),
        color: active ? primaryColor : `${primaryColor}99`
      }}
    >
      {label}
    </button>
  );
}

function PolicyBlock({ title, body, primaryColor }: { title: string; body: string; primaryColor: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.35em]" style={{ color: `${primaryColor}66` }}>{title}</p>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: `${primaryColor}B3` }}>{body}</p>
    </div>
  );
}

function ConfettiOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 150 }).map((_, index) => (
        <span
          key={index}
          className="confetti-piece"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 0.5}s`,
            backgroundColor: randomConfettiColor()
          }}
        />
      ))}
      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-10vh) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0;
          }
        }
        .confetti-piece {
          position: absolute;
          width: 6px;
          height: 12px;
          border-radius: 2px;
          opacity: 0;
          animation: confetti-fall 2.3s ease-in both;
        }
      `}</style>
    </div>
  );
}

function randomConfettiColor() {
  const palette = ["#5B64FF", "#57D0FF", "#FF9A8B", "#FFD166", "#8AFFCF", "#C4A5FF"];
  return palette[Math.floor(Math.random() * palette.length)];
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hrs} hr` : `${hrs} hr ${mins} min`;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}

function describeAcceptedMethods(methods: string[]) {
  const unique = Array.from(new Set(methods));
  const methodLabels: Record<string, string> = {
    card: "Credit & Debit Cards",
    cash: "Cash",
    wallets: "Digital Wallets (Apple Pay, Google Pay)",
    apple_pay: "Apple Pay",
    "apple-pay": "Apple Pay",
    google_pay: "Google Pay",
    "google-pay": "Google Pay",
  };
  const labels = unique.map((method) => methodLabels[method.toLowerCase()] || method.toUpperCase());
  return labels.length > 0 ? `Accepted: ${labels.join(", ")}` : "Accepted: Credit & Debit Cards";
}

function describeFee(type: "flat" | "percent", value: number) {
  if (value <= 0) return "No fee";
  return type === "percent" ? `${value}% of the service price` : formatCurrency(Math.round(value * 100));
}

function formatAddress(location: FakeBusinessWorkspace["identity"]["location"]) {
  const parts = [
    location.addressLine1,
    location.addressLine2,
    `${location.city}, ${location.stateProvince}`,
    location.country
  ].filter(Boolean);
  return parts.join(" · ");
}

function isValidEmail(email: string) {
  return /\S+@\S+\.\S+/.test(email);
}

function isValidPhone(phone: string) {
  return phone.trim().length >= 7;
}

function createPolicyConsent(policies: FakeBusinessWorkspace["policies"]) {
  const hashBase = JSON.stringify(policies);
  const hash = simpleHash(hashBase);
  return {
    hash,
    acceptedAt: new Date().toISOString(),
    ip: "203.0.113.5",
    userAgent: navigator.userAgent
  };
}

function simpleHash(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

// Stripe Payment Form Component
function StripePaymentForm({
  onPaymentMethodReady,
  acceptedMethods,
  businessSlug,
  bookingId,
  createdBookingId,
  createdBookingCode,
  workspace,
  customerName,
  customerEmail,
  customerPhone,
  listPriceCents,
  giftCardState,
  policies,
  timezone,
  selectedService,
  selectedSlot,
  setCreatedBooking,
  setStep,
  toast
}: {
  onPaymentMethodReady: (paymentMethodId: string) => void;
  acceptedMethods: string[];
  businessSlug: string;
  bookingId: string;
  createdBookingId: string | null;
  createdBookingCode: string | null;
  workspace: FakeBusinessWorkspace;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  listPriceCents: number;
  giftCardState: GiftCardState | null;
  policies: FakeBusinessWorkspace["policies"];
  timezone: string;
  selectedService: {
    id: string;
    name: string;
    durationMinutes: number;
    priceCents: number;
    categoryName: string;
  } | undefined;
  selectedSlot: ExpandedAvailabilitySlot | null;
  setCreatedBooking: (booking: FakeBooking | null) => void;
  setStep: (step: Step) => void;
  toast: ReturnType<typeof useToast>;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Confirm the SetupIntent
      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
      });

      if (confirmError) {
        setError(confirmError.message || 'Failed to save payment method');
        setIsProcessing(false);
        return;
      }

      if (setupIntent && setupIntent.payment_method) {
        const pmId = typeof setupIntent.payment_method === 'string' 
          ? setupIntent.payment_method 
          : setupIntent.payment_method.id;
        onPaymentMethodReady(pmId);
        setError(null);
        
        // Create booking object and proceed to confirmation
        if (selectedService && selectedSlot && createdBookingId) {
          const booking: FakeBooking = {
            id: createdBookingId,
            code: createdBookingCode || `REVOL-${createdBookingId.slice(0, 8).toUpperCase()}`,
            status: 'pending',
            serviceId: selectedService.id,
            serviceName: selectedService.name,
            categoryName: selectedService.categoryName,
            durationMinutes: selectedService.durationMinutes,
            startDateTime: selectedSlot.startDateTime,
            endDateTime: selectedSlot.endDateTime,
            staff: {
              id: selectedSlot.staffId,
              name: selectedSlot.staffName,
              color: workspace.staff.find(s => s.id === selectedSlot.staffId)?.color || "#000000",
            },
            customer: {
              name: customerName.trim(),
              email: customerEmail.trim().toLowerCase(),
              phone: customerPhone.trim(),
            },
            payments: [],
            financials: {
              listPriceCents: listPriceCents,
              giftCardAmountCents: giftCardState?.amountCents || 0,
              platformFeeCents: 0,
              stripeFeeEstimateCents: 0,
              netPayoutCents: 0,
              currency: 'usd',
            },
            policyConsent: createPolicyConsent(policies),
            requiresAction: false,
          };
          setCreatedBooking(booking);
          setStep("confirmation");
          toast.pushToast({
            title: "Booking confirmed",
            description: `${selectedService.name} on ${formatInTimeZone(
              selectedSlot.startDateTime,
              timezone,
              { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
            )}. No charge yet—card saved securely.`,
            intent: "success"
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  // Configure payment method types - card is ALWAYS required regardless of business settings
  // This ensures card is always available as backup for no-show fees (even for cash payments)
  const paymentMethodTypes: string[] = ['card'];

  // Map accepted methods to Stripe payment method types
  // Note: card is always included above, so we only add additional methods
  if (acceptedMethods.includes('apple_pay') || acceptedMethods.includes('apple-pay')) {
    paymentMethodTypes.push('apple_pay');
  }
  if (acceptedMethods.includes('google_pay') || acceptedMethods.includes('google-pay')) {
    paymentMethodTypes.push('google_pay');
  }
  // Also check for 'wallets' which might include both
  if (acceptedMethods.includes('wallets')) {
    if (!paymentMethodTypes.includes('apple_pay')) paymentMethodTypes.push('apple_pay');
    if (!paymentMethodTypes.includes('google_pay')) paymentMethodTypes.push('google_pay');
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <div className="space-y-4">
        <PaymentElement
          options={{
            paymentMethodTypes: paymentMethodTypes,
            // Use tabs only if we have multiple payment methods, otherwise use default layout
            ...(paymentMethodTypes.length > 1 ? { layout: 'tabs' as const } : {}),
          }}
        />
        {error && (
          <HelperText intent="error" className="text-red-400 mt-2">
            {error}
          </HelperText>
        )}
        <Button
          type="submit"
          disabled={isProcessing || !stripe}
          isLoading={isProcessing}
          className="w-full mt-4"
        >
          {isProcessing ? 'Saving payment method...' : 'Save payment method'}
        </Button>
      </div>
    </form>
  );
}


