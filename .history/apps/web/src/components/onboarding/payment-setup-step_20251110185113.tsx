"use client";

import { useMemo, useState } from "react";
import { CreditCard, Shield, RefreshCcw, PauseCircle, PlayCircle, XCircle } from "lucide-react";

import { HelperText } from "@/components/ui/helper-text";
import { StepActions } from "@/components/onboarding/step-actions";
import { PAYMENT_METHODS } from "@/components/onboarding/constants";
import type { PaymentSetupConfig } from "@/lib/onboarding-context";

interface PaymentSetupStepProps {
  defaultValues: PaymentSetupConfig;
  onNext: (values: PaymentSetupConfig) => Promise<void> | void;
  onBack: () => void;
}

export function PaymentSetupStep({ defaultValues, onNext, onBack }: PaymentSetupStepProps) {
  const [config, setConfig] = useState<PaymentSetupConfig>(defaultValues);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleConnectStep = (status: PaymentSetupConfig["connectStatus"]) => {
    setConfig((prev) => ({ ...prev, connectStatus: status }));
    if (status === "completed" && !prevDatesSet(prev => prev)) {
      const trialEndsAt = addDaysISO(7);
      const nextBillDate = addDaysISO(7);
      setConfig((prev) => ({
        ...prev,
        trialEndsAt,
        nextBillDate,
        subscriptionStatus: prev.subscriptionStatus === "canceled" ? "canceled" : "trial"
      }));
    }
  };

  const handlePaymentMethodToggle = (id: string) => {
    setConfig((prev) => {
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

  const handleSimulateConnect = async () => {
    setIsSimulating(true);
    setConfig((prev) => ({ ...prev, connectStatus: "in_progress" }));
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const trialEndsAt = addDaysISO(7);
    const nextBillDate = addDaysISO(7);
    setConfig((prev) => ({
      ...prev,
      connectStatus: "completed",
      subscriptionStatus: "trial",
      trialEndsAt,
      nextBillDate
    }));
    setIsSimulating(false);
  };

  const handleContinue = () => {
    onNext(config);
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
                onClick={handleSimulateConnect}
                disabled={isSimulating}
                className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-primary/30 transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:opacity-60"
              >
                Start Stripe Connect
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

function prevDatesSet(prev: (arg0: PaymentSetupConfig) => PaymentSetupConfig) {
  return false;
}


