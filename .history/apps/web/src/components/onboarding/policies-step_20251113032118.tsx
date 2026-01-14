"use client";

import { useState } from "react";
import { ShieldCheck, Scale, ScrollText } from "lucide-react";

import { HelperText } from "@/components/ui/helper-text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StepActions } from "@/components/onboarding/step-actions";
import type { PoliciesConfig } from "@/lib/onboarding-context";

interface PoliciesStepProps {
  defaultValues: PoliciesConfig;
  onNext: (values: PoliciesConfig) => Promise<void> | void;
  onBack: () => void;
}

export function PoliciesStep({ defaultValues, onNext, onBack }: PoliciesStepProps) {
  const [policies, setPolicies] = useState<PoliciesConfig>(defaultValues);
  const [error, setError] = useState<string | null>(null);

  const handleChange = <K extends keyof PoliciesConfig>(key: K, value: PoliciesConfig[K]) => {
    setPolicies((prev) => ({ ...prev, [key]: value }));
  };

  const handleFeeTypeChange = (key: "noShowFeeType" | "cancellationFeeType", value: "flat" | "percent") => {
    handleChange(key, value);
  };

  const handleContinue = () => {
    if (policies.noShowFeeType === "percent" && policies.noShowFeeValue > 100) {
      setError("No-show percentage cannot exceed 100%.");
      return;
    }
    if (policies.cancellationFeeType === "percent" && policies.cancellationFeeValue > 100) {
      setError("Cancellation percentage cannot exceed 100%.");
      return;
    }
    setError(null);
    onNext(policies);
  };

  return (
    <div className="space-y-8" aria-labelledby="policies-step-heading">
      <header className="space-y-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary/90">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Step 9 · Policies
        </span>
        <h2 id="policies-step-heading" className="font-display text-3xl text-white">
          Set expectations upfront
        </h2>
        <p className="max-w-3xl text-base text-white/70">
          These policies show in a scrollable modal at checkout. Customers must consent before
          completing booking. We’ll snapshot the copy plus fee values to protect you in disputes.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <PolicyCard
          title="Cancellation policy"
          description="Explain when customers can cancel for free, what happens within the penalty window, and how to contact you."
          value={policies.cancellationPolicy}
          onChange={(value) => handleChange("cancellationPolicy", value)}
        />
        <PolicyCard
          title="No-show policy"
          description="Clarify what counts as a no-show, grace periods, and how fees are applied."
          value={policies.noShowPolicy}
          onChange={(value) => handleChange("noShowPolicy", value)}
        />
        <PolicyCard
          title="Refund policy"
          description="Outline when refunds are offered, processing timelines, and whether gift card balances are restored."
          value={policies.refundPolicy}
          onChange={(value) => handleChange("refundPolicy", value)}
        />
        <PolicyCard
          title="Cash policy"
          description="Let customers know if cash is accepted or if card-on-file is required."
          value={policies.cashPolicy}
          onChange={(value) => handleChange("cashPolicy", value)}
        />
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center gap-3 text-sm font-semibold text-white">
          <Scale className="h-4 w-4 text-primary" aria-hidden="true" />
          Configure fees
        </div>
        <p className="mt-1 text-xs text-white/60">
          Fees power the money buttons later. Enter 0 if you want to mark status without charging.
        </p>

        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <FeeField
            label="No-show fee"
            type={policies.noShowFeeType}
            value={policies.noShowFeeValue}
            onTypeChange={(type) => handleFeeTypeChange("noShowFeeType", type)}
            onValueChange={(value) => handleChange("noShowFeeValue", value)}
          />
          <FeeField
            label="Cancellation fee"
            type={policies.cancellationFeeType}
            value={policies.cancellationFeeValue}
            onTypeChange={(type) => handleFeeTypeChange("cancellationFeeType", type)}
            onValueChange={(value) => handleChange("cancellationFeeValue", value)}
          />
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
          Checkout preview
        </p>
        <div className="mt-4 max-h-64 space-y-4 overflow-y-auto rounded-2xl border border-white/15 bg-white/5 p-5 text-sm text-white/80">
          <section>
            <h3 className="font-semibold text-white">Cancellation policy</h3>
            <p className="mt-2 whitespace-pre-line text-white/70">
              {policies.cancellationPolicy || "Add your cancellation policy copy."}
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-white">No-show policy</h3>
            <p className="mt-2 whitespace-pre-line text-white/70">
              {policies.noShowPolicy || "Add your no-show policy copy."}
            </p>
            <p className="mt-2 text-xs text-white/50">
              Fee:{" "}
              {formatFee(policies.noShowFeeType, policies.noShowFeeValue) ||
                "Policy configured once fee is set."}
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-white">Refund policy</h3>
            <p className="mt-2 whitespace-pre-line text-white/70">
              {policies.refundPolicy || "Share how you handle refunds or credits."}
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-white">Cash policy</h3>
            <p className="mt-2 whitespace-pre-line text-white/70">
              {policies.cashPolicy || "Explain if cash is accepted or card is required to book."}
            </p>
          </section>
        </div>
        <p className="mt-3 text-xs text-white/50">
          Customers must check a consent box referencing these policies. We store consent timestamp,
          IP, user agent, and a hash of each policy.
        </p>
      </div>

      {error ? (
        <HelperText intent="error" role="alert">
          {error}
        </HelperText>
      ) : null}

      <StepActions onBack={onBack} onNext={handleContinue} />
    </div>
  );
}

function PolicyCard({
  title,
  description,
  value,
  onChange
}: {
  title: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-start gap-3">
        <ScrollText className="mt-1 h-4 w-4 text-primary" aria-hidden="true" />
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="text-xs text-white/60">{description}</p>
          </div>
          <Textarea
            rows={6}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Write your policy copy..."
          />
        </div>
      </div>
    </div>
  );
}

function FeeField({
  label,
  type,
  value,
  onTypeChange,
  onValueChange
}: {
  label: string;
  type: "flat" | "percent";
  value: number;
  onTypeChange: (type: "flat" | "percent") => void;
  onValueChange: (value: number) => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-sm font-semibold text-white">{label}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onTypeChange("flat")}
          className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
            type === "flat"
              ? "border border-primary/50 bg-primary/15 text-white"
              : "border border-white/15 bg-white/5 text-white/70 hover:border-white/25 hover:text-white"
          }`}
        >
          Flat fee
        </button>
        <button
          type="button"
          onClick={() => onTypeChange("percent")}
          className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
            type === "percent"
              ? "border border-primary/50 bg-primary/15 text-white"
              : "border border-white/15 bg-white/5 text-white/70 hover:border-white/25 hover:text-white"
          }`}
        >
          Percent
        </button>
      </div>
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/60">
          {type === "flat" ? "Amount (USD)" : "Percentage (%)"}
        </label>
        <Input
          type="number"
          min={0}
          max={type === "percent" ? 100 : undefined}
          step={type === "percent" ? 1 : 1}
          value={value}
          onChange={(event) => onValueChange(Number(event.target.value))}
        />
        <HelperText className="mt-2">
          {type === "flat"
            ? "Charged as a fixed fee when the money button is pressed."
            : "Percent applied to the service price at the time of charge."}
        </HelperText>
      </div>
    </div>
  );
}

function formatFee(type: "flat" | "percent", value: number) {
  if (!value) return type === "percent" ? "0%" : "$0.00";
  return type === "percent" ? `${value}%` : `$${value.toFixed(2)}`;
}




