"use client";

import { useMemo, useState, useEffect } from "react";
import { CreditCard, Shield, RefreshCcw, PauseCircle, PlayCircle, XCircle, Loader2 } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

import { HelperText } from "@/components/ui/helper-text";
import { StepActions } from "@/components/onboarding/step-actions";
import { PAYMENT_METHODS } from "@/components/onboarding/constants";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClientClient } from "@/lib/supabase-client";
import type { PaymentSetupConfig } from "@/lib/onboarding-context";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
);

interface PaymentSetupStepProps {
  defaultValues: PaymentSetupConfig;
  business?: { businessName?: string; industry?: string };
  onNext: (values: PaymentSetupConfig) => Promise<void> | void;
  onBack: () => void;
}

export function PaymentSetupStep({ defaultValues, business, onNext, onBack }: PaymentSetupStepProps) {
  const [config, setConfig] = useState<PaymentSetupConfig>(defaultValues);
  const [isSimulating, setIsSimulating] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoadingSetupIntent, setIsLoadingSetupIntent] = useState(false);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const toast = useToast();

  const handleConnectStep = (status: PaymentSetupConfig["connectStatus"]) => {
    setConfig((prev) => {
      const next: PaymentSetupConfig = { ...prev, connectStatus: status };
      if (status === "completed") {
        const trialEndsAt = prev.trialEndsAt ?? addDaysISO(7);
        const nextBillDate = prev.nextBillDate ?? addDaysISO(7);
        next.trialEndsAt = trialEndsAt;
        next.nextBillDate = nextBillDate;
        if (prev.subscriptionStatus !== "canceled") {
          next.subscriptionStatus = prev.subscriptionStatus === "active" ? "active" : "trial";
        }
      }
      return next;
    });
  };

  const handlePaymentMethodToggle = (id: string) => {
    setConfig((prev) => {
      if (id === "card") {
        return prev;
      }
      const exists = prev.acceptedMethods.includes(id);
      return {
        ...prev,
        acceptedMethods: exists
          ? prev.acceptedMethods.filter((method) => method !== id)
          : [...prev.acceptedMethods, id]
      };
    });
  };

  const handleSubscriptionTransition = (status: PaymentSetupConfig["subscriptionStatus"]) => {
    const next: PaymentSetupConfig = {
      ...config,
      subscriptionStatus: status
    };

    if (status === "trial" && !config.trialEndsAt) {
      next.trialEndsAt = addDaysISO(7);
      next.nextBillDate = addDaysISO(7);
    }
    if (status === "active") {
      next.trialEndsAt = undefined;
      next.nextBillDate = addDaysISO(30);
    }
    if (status === "paused") {
      next.nextBillDate = undefined;
    }
    if (status === "canceled") {
      next.nextBillDate = undefined;
    }

    setConfig(next);
  };

  // Check for Stripe Connect return (when user comes back from onboarding)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const accountId = urlParams.get("account_id");
    if (accountId && config.connectStatus !== "completed") {
      // User returned from Stripe Connect onboarding
      console.log('[PaymentSetupStep] Detected Stripe return with account_id:', accountId);
      handleConnectReturn(accountId);
    }
  }, [config.connectStatus]);

  // Load SetupIntent when Stripe Connect is completed
  useEffect(() => {
    if (config.connectStatus === "completed" && !clientSecret && !isLoadingSetupIntent) {
      loadSetupIntent();
    }
  }, [config.connectStatus, clientSecret, isLoadingSetupIntent]);

  const handleConnectReturn = async (accountId: string) => {
    try {
      // Get session token for authentication
      const supabase = createClientClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch("/api/business/onboarding/step-11-payment-setup", {
        method: "PUT",
        headers,
        credentials: "include", // Include cookies for authentication
        body: JSON.stringify({
          connectAccountId: accountId,
          connectStatus: "in_progress",
          acceptedMethods: config.acceptedMethods,
          subscriptionStatus: config.subscriptionStatus,
          businessName: business?.businessName,
          industry: business?.industry,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to verify Stripe Connect account");
      }

      const data = await response.json();
      if (data.success) {
        setConfig((prev) => ({
          ...prev,
          connectStatus: "completed",
          subscriptionStatus: "trial",
          trialEndsAt: addDaysISO(7),
          nextBillDate: addDaysISO(7),
        }));
        // Clean up URL
        window.history.replaceState({}, "", window.location.pathname);
      }
    } catch (error) {
      console.error("Error handling Connect return:", error);
      toast.pushToast({
        title: "Error",
        description: "Failed to verify Stripe Connect account. Please try again.",
        intent: "error",
      });
    }
  };

  const loadSetupIntent = async () => {
    setIsLoadingSetupIntent(true);
    try {
      const response = await fetch("/api/business/onboarding/setup-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error("Failed to create setup intent");
      }
      const data = await response.json();
      setClientSecret(data.clientSecret);
    } catch (error) {
      console.error("Error loading setup intent:", error);
      toast.pushToast({
        title: "Error",
        description: "Failed to load payment form. Please refresh and try again.",
        intent: "error",
      });
    } finally {
      setIsLoadingSetupIntent(false);
    }
  };

  const handleStartConnect = async () => {
    setIsSimulating(true);
    try {
      // Get session token for authentication
      const supabase = createClientClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      
      // Call backend to create Connect account and get Account Link
      // Include business data in case business doesn't exist yet
      const response = await fetch("/api/business/onboarding/step-11-payment-setup", {
        method: "PUT",
        headers,
        credentials: "include", // Include cookies for authentication
        body: JSON.stringify({
          connectStatus: "not_started",
          acceptedMethods: config.acceptedMethods,
          subscriptionStatus: config.subscriptionStatus,
          businessName: business?.businessName,
          industry: business?.industry,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start Stripe Connect");
      }

      const data = await response.json();
      
      if (data.accountLinkUrl) {
        // Redirect to Stripe Connect onboarding
        window.location.href = data.accountLinkUrl;
        return;
      }

      // If account already exists and is verified, mark as completed
      if (data.success && data.connectAccountId) {
        setConfig((prev) => ({
          ...prev,
          connectStatus: "completed",
          subscriptionStatus: "trial",
          trialEndsAt: addDaysISO(7),
          nextBillDate: addDaysISO(7),
        }));
      } else {
        setConfig((prev) => ({ ...prev, connectStatus: "in_progress" }));
      }
    } catch (error) {
      console.error("Error starting Stripe Connect:", error);
      toast.pushToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start Stripe Connect",
        intent: "error",
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleContinue = async () => {
    // If Stripe Connect is completed but no payment method collected yet, don't proceed
    if (config.connectStatus === "completed" && !paymentMethodId && clientSecret) {
      toast.pushToast({
        title: "Payment method required",
        description: "Please add your credit card to continue with subscription setup.",
        intent: "error",
      });
      return;
    }
    
    // Include payment method ID and business data when calling onNext
    const valuesToSave = {
      ...config,
      paymentMethodId: paymentMethodId || undefined,
    };
    
    // Also save to backend with business data
    try {
      // Get session token for authentication
      const supabase = createClientClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch("/api/business/onboarding/step-11-payment-setup", {
        method: "PUT",
        headers,
        credentials: "include", // Include cookies for authentication
        body: JSON.stringify({
          ...valuesToSave,
          businessName: business?.businessName,
          industry: business?.industry,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save payment setup");
      }
    } catch (error) {
      console.error("Error saving payment setup:", error);
      toast.pushToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save payment setup",
        intent: "error",
      });
      return;
    }
    
    onNext(valuesToSave);
  };

  const statusCopy = useMemo(() => getStatusCopy(config), [config]);

  return (
    <div className="space-y-8" aria-labelledby="payment-setup-step-heading">
      <header className="space-y-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary/90">
          <CreditCard className="h-4 w-4" aria-hidden="true" />
          Step 11 · Payment setup
        </span>
        <h2 id="payment-setup-step-heading" className="font-display text-3xl text-white">
          Get paid with Stripe Connect
        </h2>
        <p className="max-w-3xl text-base text-white/70">
          Stripe Express accounts power manual capture, no-show fees, and your $11.99/mo
          subscription. We’ll only charge customers when you click the money buttons in admin.
        </p>
      </header>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Shield className="mt-1 h-4 w-4 text-primary" aria-hidden="true" />
            <div>
              <h3 className="text-lg font-semibold text-white">Stripe Connect status</h3>
              <p className="text-xs text-white/60">{statusCopy.connect}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {config.connectStatus === "not_started" ? (
              <button
                type="button"
                onClick={handleStartConnect}
                disabled={isSimulating}
                className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-primary/30 transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:opacity-60"
              >
                {isSimulating ? (
                  <>
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  "Start Stripe Connect"
                )}
              </button>
            ) : null}
            {config.connectStatus === "in_progress" ? (
              <button
                type="button"
                onClick={() => handleConnectStep("completed")}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                Mark as completed
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <p className="text-sm font-semibold text-white">Accepted payment methods</p>
        <p className="text-xs text-white/60">
          Cards stay required. Toggle additional options you plan to support after launch.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method.id}
              type="button"
              onClick={() => handlePaymentMethodToggle(method.id)}
              className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                config.acceptedMethods.includes(method.id)
                  ? "border border-primary/50 bg-primary/15 text-white"
                  : "border border-white/15 bg-white/5 text-white/70 hover:border-white/25 hover:text-white"
              }`}
            >
              {method.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <p className="text-sm font-semibold text-white">Subscription status</p>
        <p className="text-xs text-white/60">
          Owners can adjust these controls later in Account. Default flow: 7-day trial, then active
          billing monthly. Pausing stops billing; canceling archives the subdomain.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <StatusButton
            icon={<PlayCircle className="h-4 w-4" aria-hidden="true" />}
            label="Trial"
            active={config.subscriptionStatus === "trial"}
            onClick={() => handleSubscriptionTransition("trial")}
          />
          <StatusButton
            icon={<RefreshCcw className="h-4 w-4" aria-hidden="true" />}
            label="Active"
            active={config.subscriptionStatus === "active"}
            onClick={() => handleSubscriptionTransition("active")}
          />
          <StatusButton
            icon={<PauseCircle className="h-4 w-4" aria-hidden="true" />}
            label="Paused"
            active={config.subscriptionStatus === "paused"}
            onClick={() => handleSubscriptionTransition("paused")}
          />
          <StatusButton
            icon={<XCircle className="h-4 w-4" aria-hidden="true" />}
            label="Canceled"
            active={config.subscriptionStatus === "canceled"}
            onClick={() => handleSubscriptionTransition("canceled")}
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm text-white/70">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-white/50">Trial ends</p>
            <p className="mt-1 font-semibold text-white">
              {config.trialEndsAt ? formatDate(config.trialEndsAt) : "—"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-white/50">Next bill date</p>
            <p className="mt-1 font-semibold text-white">
              {config.nextBillDate ? formatDate(config.nextBillDate) : "—"}
            </p>
          </div>
        </div>
      </div>

      {config.connectStatus === "completed" && clientSecret ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">Subscription payment method</h3>
            <p className="text-xs text-white/60 mt-1">
              Add your credit card to start your subscription. You won't be charged until your 7-day trial ends.
            </p>
          </div>
          {stripePromise && clientSecret ? (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CardCollectionForm
                onPaymentMethodSaved={(pmId) => {
                  setPaymentMethodId(pmId);
                  setConfig((prev) => ({ ...prev, paymentMethodId: pmId }));
                  toast.pushToast({
                    title: "Card saved",
                    description: "Your payment method has been securely saved.",
                    intent: "success",
                  });
                }}
              />
            </Elements>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-xs text-white/60">
        <p>
          Stripe fees are deducted automatically. Tithi takes a 1% platform fee on capture,
          no-show, and cancellation charges. Manual capture remains the default—money only moves
          when you click the buttons in admin.
        </p>
      </div>

      <StepActions onBack={onBack} onNext={handleContinue} />
    </div>
  );
}

function StatusButton({
  icon,
  label,
  active,
  onClick
}: {
  icon: JSX.Element;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
        active
          ? "border border-primary/50 bg-primary/15 text-white"
          : "border border-white/15 bg-white/5 text-white/70 hover:border-white/25 hover:text-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function addDaysISO(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function formatDate(isoString: string) {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function getStatusCopy(config: PaymentSetupConfig) {
  switch (config.connectStatus) {
    case "not_started":
      return {
        connect: "Start Connect onboarding to link payouts and verify your business."
      };
    case "in_progress":
      return {
        connect: "Finish Stripe Express onboarding to start accepting payments."
      };
    case "completed":
      return {
        connect:
          config.subscriptionStatus === "trial"
            ? "Stripe account connected. Trial is active and billing starts after 7 days."
            : "Stripe account connected. Subscription controls are ready in Account."
      };
    default:
      return { connect: "" };
  }
}

function CardCollectionForm({ onPaymentMethodSaved }: { onPaymentMethodSaved: (paymentMethodId: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message || "Failed to submit payment form");
        setIsSubmitting(false);
        return;
      }

      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/onboarding`,
        },
        redirect: "if_required",
      });

      if (confirmError) {
        setError(confirmError.message || "Failed to save payment method");
        setIsSubmitting(false);
        return;
      }

      if (setupIntent && setupIntent.payment_method) {
        const pmId = typeof setupIntent.payment_method === "string" 
          ? setupIntent.payment_method 
          : setupIntent.payment_method.id;
        onPaymentMethodSaved(pmId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-black/60 p-4">
        <PaymentElement
          options={{
            layout: "tabs",
          }}
        />
      </div>
      {error && (
        <HelperText intent="error" role="alert">
          {error}
        </HelperText>
      )}
      <Button
        type="submit"
        disabled={!stripe || isSubmitting}
        className="w-full"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving card...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            Save payment method
          </>
        )}
      </Button>
      <HelperText className="text-xs">
        Your card will be saved securely. You won't be charged until your trial ends.
      </HelperText>
    </form>
  );
}


