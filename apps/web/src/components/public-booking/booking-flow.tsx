"use client";

import { useEffect, useMemo, useState } from "react";
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

type Step = "catalog" | "availability" | "checkout" | "confirmation";

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
  const [selectedStaffId, setSelectedStaffId] = useState<string>("any");
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
            const response = await fetch(
              `/api/public/${business.slug}/availability?service_id=${selectedService.id}&date=${dateStr}`
            );
            
            if (!response.ok) {
              console.warn(`Failed to fetch availability for ${dateStr}:`, response.status);
              continue;
            }
            
            const data = await response.json();
            console.log(`[booking-flow] Fetched availability for ${dateStr}:`, {
              slotsCount: data.slots?.length || 0,
              hasSlots: Array.isArray(data.slots),
              sampleSlot: data.slots?.[0],
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
    if (!selectedService) return {};
    const filtered =
      selectedStaffId === "any"
        ? serviceAvailability
        : serviceAvailability.filter((slot) => slot.staffId === selectedStaffId);
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
    setSelectedStaffId("any");
    setSelectedSlot(null);
    setStep("availability");
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
          code: createdBookingCode || `TITHI-${createdBookingId.slice(0, 8).toUpperCase()}`,
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

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-black via-slate-950 to-[#0b0d1a] text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(91,100,255,0.25),_transparent_60%)]" />
      {step === "confirmation" ? <ConfettiOverlay /> : null}
      <header className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-4">
            <Badge intent="info" className="w-fit">
              Manual capture — no charge at booking
            </Badge>
            <div>
              <h1 className="font-display text-4xl sm:text-5xl">
                Book {workspace.identity.business.businessName}
              </h1>
              <p className="mt-2 max-w-2xl text-base text-white/70">
                {workspace.identity.business.description ||
                  "Select a service, choose the best time, and secure your appointment. Your card is stored securely and only charged after the visit or if a policy fee applies."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {formatAddress(workspace.identity.location)}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                <Clock className="h-4 w-4" aria-hidden="true" />
                All times shown in {timezone}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Card saved securely — capture happens later
              </span>
            </div>
          </div>
          {createdBooking ? (
            <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-emerald-100 shadow-[0_0_40px_rgba(52,211,153,0.25)]">
              <p className="text-sm uppercase tracking-[0.35em] text-emerald-200/70">
                Confirmation
              </p>
              <p className="mt-2 font-display text-2xl">
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

      <main className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
        <StepIndicator currentStep={step} onReset={handleResetFlow} />

        {step === "catalog" ? (
          <CatalogStep
            catalog={workspace.catalog}
            onSelectService={handleSelectService}
            timezone={timezone}
          />
        ) : null}

        {step === "availability" && selectedService ? (
          <AvailabilityStep
            service={selectedService}
            slotsByDay={groupedSlots}
            selectedStaffId={selectedStaffId}
            setSelectedStaffId={setSelectedStaffId}
            onBack={() => setStep("catalog")}
            onSelectSlot={handleSelectSlot}
            staff={workspace.staff}
            timezone={timezone}
            supportEmail={workspace.identity.location.supportEmail}
            isLoading={isLoadingAvailability}
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
  onSelectService
}: {
  catalog: FakeBusinessWorkspace["catalog"];
  onSelectService: (serviceId: string) => void;
  timezone: string;
}) {
  return (
    <section className="space-y-12">
      {catalog.map((category) => (
        <div key={category.id} className="space-y-5">
          <header>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-white/55">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {category.name}
            </div>
            <p className="mt-3 text-base text-white/70 max-w-2xl">{category.description}</p>
          </header>
          <div className="grid gap-6 md:grid-cols-2">
            {category.services.map((service) => (
              <button
                key={service.id}
                type="button"
                onClick={() => onSelectService(service.id)}
                className="group flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-left transition hover:border-white/25 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-2xl text-white">{service.name}</h2>
                    <p className="mt-2 text-sm text-white/60">{service.description}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-white/60">
                    {formatDuration(service.durationMinutes)}
                  </span>
                </div>
                {service.instructions ? (
                  <p className="text-sm text-white/40">{service.instructions}</p>
                ) : null}
                <div className="mt-auto flex items-center justify-between text-sm">
                  <span className="text-white/60">
                    Starting at <strong className="text-white">{formatCurrency(service.priceCents)}</strong>
                  </span>
                  <span className="inline-flex items-center gap-2 text-primary group-hover:translate-x-1 transition">
                    Select <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
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
  error
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
  selectedStaffId: string;
  setSelectedStaffId: (value: string) => void;
  onBack: () => void;
  onSelectSlot: (slot: ExpandedAvailabilitySlot) => void;
  staff: FakeBusinessWorkspace["staff"];
  timezone: string;
  supportEmail?: string;
  isLoading?: boolean;
  error?: string | null;
}) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek; // Get Sunday of this week
    const sunday = new Date(today.setDate(diff));
    sunday.setHours(0, 0, 0, 0);
    return sunday;
  });

  const staffOptions = staff.filter((member) => service.staffIds.includes(member.id));
  const totalSlots = Object.values(slotsByDay).reduce((sum, entries) => sum + entries.length, 0);

  // Generate hours from 8 AM to 8 PM
  const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM to 8 PM

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

  // Group slots by day and hour, removing duplicates
  const slotsByDayAndHour = useMemo(() => {
    const grouped: Record<string, Record<number, ExpandedAvailabilitySlot[]>> = {};
    
    // Flatten all slots from all days
    const allSlots = Object.values(slotsByDay).flat();
    
    allSlots.forEach(slot => {
      const slotDate = new Date(slot.startDateTime);
      const dateKey = formatInTimeZone(slotDate, timezone, "yyyy-MM-dd");
      const hour = formatInTimeZone(slotDate, timezone, { hour: "numeric", hour12: false });
      const hourNum = parseInt(hour, 10);
      
      // Only include slots that are in the current week
      const isInCurrentWeek = weekDays.some(day => {
        const dayKey = formatInTimeZone(day, timezone, "yyyy-MM-dd");
        return dayKey === dateKey;
      });
      
      if (!isInCurrentWeek) return;
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = {};
      }
      
      if (!grouped[dateKey][hourNum]) {
        grouped[dateKey][hourNum] = [];
      }
      
      // Check for duplicates (same hour, same staff, same date)
      const isDuplicate = grouped[dateKey][hourNum].some(
        existing => existing.staffId === slot.staffId
      );
      
      if (!isDuplicate) {
        grouped[dateKey][hourNum].push(slot);
      }
    });
    
    return grouped;
  }, [slotsByDay, weekDays, timezone]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(newDate);
  };

  const monthYear = formatInTimeZone(weekDays[0], timezone, { month: "long", year: "numeric" });

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_0_60px_rgba(91,100,255,0.15)]">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">Step 2 · Choose your time</p>
          <h2 className="mt-2 font-display text-3xl text-white">{service.name}</h2>
          <p className="mt-1 text-sm text-white/60">
            {formatCurrency(service.priceCents)} · {formatDuration(service.durationMinutes)} — All slots
            shown in {timezone}
          </p>
        </div>
        <Button variant="ghost" onClick={onBack} className="inline-flex items-center gap-2 text-white/70">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to services
        </Button>
      </header>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <StaffPill
          label="I don't mind"
          active={selectedStaffId === "any"}
          onClick={() => setSelectedStaffId("any")}
        />
        {staffOptions.map((member) => (
          <StaffPill
            key={member.id}
            label={member.name}
            color={member.color}
            active={selectedStaffId === member.id}
            onClick={() => setSelectedStaffId(member.id)}
          />
        ))}
      </div>

      {isLoading ? (
        <div className="mt-10 rounded-3xl border border-white/10 bg-black/60 p-8 text-center text-white/60">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-white/40" aria-hidden="true" />
          <p className="mt-4 text-base">Loading availability...</p>
        </div>
      ) : error ? (
        <div className="mt-10 rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-center text-red-200">
          <p className="text-base">{error}</p>
        </div>
      ) : totalSlots === 0 ? (
        <div className="mt-10 rounded-3xl border border-white/10 bg-black/60 p-8 text-center text-white/60">
          <p className="text-base">No availability found in the next two weeks.</p>
          <p className="mt-2 text-sm">
            Try selecting a different staff member or contact us at{" "}
            <a href={`mailto:${supportEmail ?? "support@tithi.com"}`} className="underline">
              {supportEmail ?? "support@tithi.com"}
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
              className="text-white/70 hover:text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-white">{monthYear}</h3>
            </div>
            <Button
              variant="ghost"
              onClick={() => navigateWeek('next')}
              className="text-white/70 hover:text-white"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Calendar Grid */}
          <div className="overflow-x-auto">
            <div className="min-w-full">
              {/* Day Headers */}
              <div className="grid grid-cols-8 gap-2 border-b border-white/10 pb-2">
                <div className="text-xs font-semibold text-white/60">Time</div>
                {weekDays.map((day, idx) => (
                  <div key={idx} className="text-center">
                    <p className="text-xs font-semibold text-white/60">
                      {formatInTimeZone(day, timezone, { weekday: "short" })}
                    </p>
                    <p className="text-sm font-semibold text-white">
                      {formatInTimeZone(day, timezone, { day: "numeric" })}
                    </p>
                  </div>
                ))}
              </div>

              {/* Hour Rows */}
              <div className="mt-2 space-y-1">
                {hours.map((hour) => {
                  const hourLabel = hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
                  return (
                    <div key={hour} className="grid grid-cols-8 gap-2">
                      <div className="flex items-center text-xs text-white/60 py-2">
                        {hourLabel}
                      </div>
                      {weekDays.map((day, dayIdx) => {
                        const dateKey = formatInTimeZone(day, timezone, "yyyy-MM-dd");
                        const slotsForHour = slotsByDayAndHour[dateKey]?.[hour] || [];
                        const filteredSlots = selectedStaffId === "any"
                          ? slotsForHour
                          : slotsForHour.filter(slot => slot.staffId === selectedStaffId);

                        return (
                          <div key={dayIdx} className="py-1">
                            {filteredSlots.length > 0 ? (
                              <div className="space-y-1">
                                {filteredSlots.map((slot) => {
                                  const staffMember = staff.find(s => s.id === slot.staffId);
                                  return (
                                    <button
                                      key={slot.id}
                                      type="button"
                                      onClick={() => onSelectSlot(slot)}
                                      className="w-full rounded-lg border border-primary/40 bg-primary/20 px-2 py-1.5 text-left transition hover:border-primary/60 hover:bg-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                                      style={{
                                        borderColor: staffMember?.color ? `${staffMember.color}80` : undefined,
                                        backgroundColor: staffMember?.color ? `${staffMember.color}20` : undefined,
                                      }}
                                    >
                                      <p className="text-xs font-semibold text-white">
                                        {formatInTimeZone(new Date(slot.startDateTime), timezone, { hour: "numeric", minute: "2-digit" })}
                                      </p>
                                      <p className="text-[10px] text-white/70 mt-0.5 truncate">
                                        {slot.staffName}
                                      </p>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="h-full rounded-lg bg-white/5 border border-white/5 py-1.5">
                                <p className="text-[10px] text-white/20 text-center">—</p>
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
    business
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
    <section className="grid gap-8 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_0_60px_rgba(91,100,255,0.2)] md:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/40">Step 3 · Checkout</p>
            <h2 className="mt-2 font-display text-3xl text-white">{service.name}</h2>
            <p className="mt-1 text-sm text-white/60">
            {formatDuration(service.durationMinutes)} · {formatCurrency(listPriceCents)} — with{" "}
              {slot.staffName}
            </p>
          </div>
          <Button variant="ghost" onClick={onBack} className="inline-flex items-center gap-2 text-white/70">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Pick another slot
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Full name">
            <Input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Jordan Blake"
              autoComplete="name"
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={customerEmail}
              onChange={(event) => setCustomerEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </Field>
          <Field label="Phone">
            <Input
              type="tel"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              placeholder="+1 555 010 2030"
              autoComplete="tel"
            />
          </Field>
          <Field label="Gift card or code" helper="Optional — amount or percent off will apply immediately.">
            <div className="flex gap-2">
              <Input
                value={giftCardInput}
                onChange={(event) => setGiftCardInput(event.target.value)}
                placeholder="WELCOME120"
                className="flex-1 uppercase"
                autoCapitalize="characters"
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

        <div className="rounded-3xl border border-white/10 bg-black/60 p-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <CreditCard className="h-4 w-4" aria-hidden="true" />
            Payment method — card saved now, charged later
          </p>
          <p className="mt-1 text-xs text-white/50">
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
                      colorPrimary: '#5B64FF',
                      colorBackground: '#000000',
                      colorText: '#ffffff',
                      colorDanger: '#ef4444',
                      fontFamily: 'system-ui, sans-serif',
                      spacingUnit: '4px',
                      borderRadius: '8px',
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
                        code: createdBookingCode || `TITHI-${createdBookingId.slice(0, 8).toUpperCase()}`,
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
              <HelperText className="text-white/60">
                Click "Confirm booking" below to set up your payment method. Your card will be saved securely but not charged.
              </HelperText>
            </div>
          )}
          <HelperText className="mt-2">
            You're authorizing a card on file. Per Tithi's manual capture rules, nothing is charged until
            your appointment is completed or a policy fee applies.
          </HelperText>
        </div>

        <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-black/60 p-6">
          <div className="flex items-start gap-3">
            <input
              id="policy-consent"
              type="checkbox"
              checked={consentChecked}
              onChange={(event) => setConsentChecked(event.target.checked)}
              className="mt-1 h-5 w-5 rounded border-white/20 bg-black text-primary focus:ring-primary"
            />
            <label htmlFor="policy-consent" className="text-sm text-white/70">
              I agree to the cancellation, no-show, refund, and cash policies. My card is saved via Stripe
              for manual capture later.{" "}
              <button
                type="button"
                onClick={onOpenPolicies}
                className="text-primary underline-offset-2 hover:underline"
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
              className="inline-flex items-center justify-center gap-2 text-base"
            >
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              {setupIntentClientSecret ? 'Complete payment setup below' : 'Confirm booking — no charge today'}
            </Button>
          ) : (
            <HelperText intent="success" className="text-emerald-200">
              Payment method saved! Your booking is complete.
            </HelperText>
          )}
        </div>
      </div>

      <aside className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-black/60 p-6">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">Summary</p>
          <h3 className="mt-2 font-display text-2xl text-white">{service.name}</h3>
          <p className="mt-2 flex items-center gap-2 text-sm text-white/60">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            {formatInTimeZone(slot.startDateTime, timezone, {
              weekday: "long",
              month: "short",
              day: "numeric"
            })}
          </p>
          <p className="mt-1 flex items-center gap-2 text-sm text-white/60">
            <Clock className="h-4 w-4" aria-hidden="true" />
            {formatInTimeZone(slot.startDateTime, timezone, {
              hour: "numeric",
              minute: "2-digit"
            })}{" "}
            — {formatDuration(service.durationMinutes)}
          </p>
          <p className="mt-1 flex items-center gap-2 text-sm text-white/60">
            <Users className="h-4 w-4" aria-hidden="true" />
            {slot.staffName}
          </p>
        </div>
        <div className="border-t border-white/10 pt-4 text-sm text-white/60">
          <div className="flex items-center justify-between">
            <span>Service price</span>
            <span className="text-white">{formatCurrency(listPriceCents)}</span>
          </div>
          {giftCardState ? (
            <div className="mt-2 flex items-center justify-between text-emerald-200">
              <span>Gift card ({giftCardState.code})</span>
              <span>-{formatCurrency(giftCardState.amountCents)}</span>
            </div>
          ) : null}
          <div className="mt-4 flex items-center justify-between text-base font-semibold text-white">
            <span>Due today</span>
            <span>{formatCurrency(amountDueCents)}</span>
          </div>
          <HelperText className="mt-3">
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
  onBookAnother
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
        <div className="rounded-3xl border border-emerald-400/50 bg-black/40 p-6 text-sm text-emerald-100/80">
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
          <p className="mt-1 flex items-center gap-2">
            <Clock className="h-4 w-4" aria-hidden="true" />
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

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-emerald-400/40 bg-emerald-400/10 p-6 text-sm">
          <p className="text-emerald-200/90">What happens next</p>
          <ul className="mt-3 space-y-2 text-emerald-100/80">
            <li>Check your email and SMS for confirmation details and reminders.</li>
            <li>Reschedule or cancel at least 24h in advance to avoid policy fees.</li>
            <li>Manual capture keeps money in your control—no charges run automatically.</li>
          </ul>
        </div>
        <div className="rounded-3xl border border-emerald-400/40 bg-black/40 p-6 text-sm">
          <p className="text-emerald-200/90">Policies snapshot</p>
          <ul className="mt-3 space-y-2 text-emerald-100/80">
            <li>{policies.cancellationPolicy}</li>
            <li>{policies.noShowPolicy}</li>
            <li>{policies.refundPolicy}</li>
            <li>{policies.cashPolicy}</li>
          </ul>
        </div>
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
  timezone
}: {
  policies: FakeBusinessWorkspace["policies"];
  onClose: () => void;
  timezone: string;
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
          className="absolute right-6 top-6 text-white/60 transition hover:text-white"
          aria-label="Close policies"
        >
          ✕
        </button>
        <h2 className="font-display text-3xl text-white">Booking policies</h2>
        <p className="mt-2 text-sm text-white/60">
          All times referenced align to {timezone}. Consent is required before submitting your booking.
        </p>
        <div className="mt-6 space-y-5 text-sm leading-relaxed text-white/75">
          <PolicyBlock title="Cancellation policy" body={policies.cancellationPolicy} />
          <PolicyBlock title="Cancellation fees" body={describeFee(policies.cancellationFeeType, policies.cancellationFeeValue)} />
          <PolicyBlock title="No-show policy" body={policies.noShowPolicy} />
          <PolicyBlock title="No-show fee" body={describeFee(policies.noShowFeeType, policies.noShowFeeValue)} />
          <PolicyBlock title="Refund policy" body={policies.refundPolicy} />
          <PolicyBlock title="Cash policy" body={policies.cashPolicy} />
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

function StepIndicator({ currentStep, onReset }: { currentStep: Step; onReset: () => void }) {
  const steps: Array<{ id: Step; label: string }> = [
    { id: "catalog", label: "Service" },
    { id: "availability", label: "Time" },
    { id: "checkout", label: "Checkout" },
    { id: "confirmation", label: "Done" }
  ];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/5 px-6 py-4">
      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.35em] text-white/40">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center gap-3">
            <span
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold",
                currentStep === step.id
                  ? "border-primary bg-primary/30 text-white"
                  : "border-white/20 bg-white/10 text-white/50"
              )}
            >
              {index + 1}
            </span>
            <span className={currentStep === step.id ? "text-white" : "text-white/50"}>
              {step.label}
            </span>
            {index < steps.length - 1 ? (
              <span className="h-px w-12 bg-white/10" aria-hidden="true" />
            ) : null}
          </div>
        ))}
      </div>
      {currentStep !== "catalog" && currentStep !== "confirmation" ? (
        <Button variant="ghost" onClick={onReset} className="text-white/70">
          Start over
        </Button>
      ) : null}
    </div>
  );
}

function Field({
  label,
  helper,
  children
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm text-white/70">
      <span className="font-semibold text-white">{label}</span>
      {children}
      {helper ? <HelperText className="text-[13px] text-white/40">{helper}</HelperText> : null}
    </label>
  );
}

function StaffPill({
  label,
  color,
  active,
  onClick
}: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
        active ? "border-white/60 bg-white/15 text-white" : "border-white/10 bg-white/5 text-white/60 hover:text-white/80"
      )}
      style={active && color ? { borderColor: color, boxShadow: `0 0 25px ${color}33` } : undefined}
    >
      {label}
    </button>
  );
}

function PolicyBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.35em] text-white/40">{title}</p>
      <p className="mt-2 text-sm text-white/70 leading-relaxed">{body}</p>
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
            code: createdBookingCode || `TITHI-${createdBookingId.slice(0, 8).toUpperCase()}`,
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


