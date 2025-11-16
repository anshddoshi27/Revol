"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/ui/helper-text";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFakeBusiness } from "@/lib/fake-business";
import type { PoliciesConfig } from "@/lib/onboarding-types";

export default function PoliciesPage() {
  const { workspace, setPolicies } = useFakeBusiness();
  const [draft, setDraft] = useState<PoliciesConfig>(workspace?.policies ?? DEFAULT_POLICIES);
  const [error, setError] = useState<string | null>(null);

  if (!workspace) {
    return null;
  }

  const handleFeeChange = (
    key: "cancellation" | "noShow",
    type: "flat" | "percent" | undefined,
    value: number | undefined
  ) => {
    setDraft((prev) => ({
      ...prev,
      ...(type
        ? {
            [`${key}FeeType`]: type
          }
        : {}),
      ...(typeof value === "number"
        ? {
            [`${key}FeeValue`]: value
          }
        : {})
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (draft.cancellationFeeType === "percent" && draft.cancellationFeeValue > 100) {
      setError("Cancellation percent fee cannot exceed 100%.");
      return;
    }
    if (draft.noShowFeeType === "percent" && draft.noShowFeeValue > 100) {
      setError("No-show percent fee cannot exceed 100%.");
      return;
    }
    setPolicies(draft);
    setError(null);
  };

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.35em] text-white/40">Policies</p>
        <h1 className="font-display text-4xl text-white">Fee &amp; consent rules</h1>
        <p className="max-w-3xl text-sm text-white/60">
          These policies surface in the checkout modal, receipts, and reminders. We snapshot the exact
          text, fee configuration, and consent metadata on each booking.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="grid gap-4 text-sm lg:grid-cols-2">
        <PolicyEditor
          title="Cancellation policy"
          description="Displayed in the checkout modal and confirmation message."
          value={draft.cancellationPolicy}
          onChange={(value) => setDraft((prev) => ({ ...prev, cancellationPolicy: value }))}
        />
        <PolicyEditor
          title="No-show policy"
          description="Explain how no-shows are handled and if fees apply."
          value={draft.noShowPolicy}
          onChange={(value) => setDraft((prev) => ({ ...prev, noShowPolicy: value }))}
        />
        <PolicyEditor
          title="Refund policy"
          description="Let customers know how refunds or credits are processed."
          value={draft.refundPolicy}
          onChange={(value) => setDraft((prev) => ({ ...prev, refundPolicy: value }))}
        />
        <PolicyEditor
          title="Cash policy"
          description="Tell customers whether cash is accepted or if card-on-file is required."
          value={draft.cashPolicy}
          onChange={(value) => setDraft((prev) => ({ ...prev, cashPolicy: value }))}
        />

        <div className="rounded-3xl border border-white/15 bg-black/80 p-4">
          <h2 className="text-base font-semibold text-white md:text-lg">Cancellation fee</h2>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-white/40 md:text-xs">
            Applies when the Cancel button fires after the configured window
          </p>
          <FeeConfigurator
            type={draft.cancellationFeeType}
            value={draft.cancellationFeeValue}
            onTypeChange={(type) => handleFeeChange("cancellation", type, undefined)}
            onValueChange={(value) => handleFeeChange("cancellation", undefined, value)}
          />
        </div>

        <div className="rounded-3xl border border-white/15 bg-black/80 p-4">
          <h2 className="text-base font-semibold text-white md:text-lg">No-show fee</h2>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-white/40 md:text-xs">
            Applied via the No-Show button from the money board
          </p>
          <FeeConfigurator
            type={draft.noShowFeeType}
            value={draft.noShowFeeValue}
            onTypeChange={(type) => handleFeeChange("noShow", type, undefined)}
            onValueChange={(value) => handleFeeChange("noShow", undefined, value)}
          />
        </div>

        <div className="lg:col-span-2 flex items-center justify-between rounded-3xl border border-white/15 bg-black/80 px-4 py-3">
          <div>
            {error ? (
              <HelperText intent="error">{error}</HelperText>
            ) : (
              <HelperText className="text-xs">
                Customers must consent to these policies before booking. We store the hash, timestamp,
                IP, and user agent alongside each booking in the money board.
              </HelperText>
            )}
          </div>
          <Button type="submit">Save policies</Button>
        </div>
      </form>

      <section className="rounded-3xl border border-white/15 bg-black/80 p-4 text-sm text-white/70">
        <h2 className="text-base font-semibold text-white md:text-lg">Checkout preview</h2>
        <div className="mt-4 max-h-72 space-y-4 overflow-y-auto rounded-2xl border border-white/10 bg-black/70 p-4">
          <PolicyPreview title="Cancellation" body={draft.cancellationPolicy} fee={formatFee(draft.cancellationFeeType, draft.cancellationFeeValue)} />
          <PolicyPreview title="No-show" body={draft.noShowPolicy} fee={formatFee(draft.noShowFeeType, draft.noShowFeeValue)} />
          <PolicyPreview title="Refund" body={draft.refundPolicy} />
          <PolicyPreview title="Cash" body={draft.cashPolicy} />
        </div>
      </section>
    </div>
  );
}

function PolicyEditor({
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
    <div className="rounded-3xl border border-white/15 bg-black/80 p-4">
      <h2 className="text-base font-semibold text-white md:text-lg">{title}</h2>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-white/40 md:text-xs">{description}</p>
      <Textarea
        rows={8}
        className="mt-4"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Write your policy copy..."
      />
    </div>
  );
}

function FeeConfigurator({
  type,
  value,
  onTypeChange,
  onValueChange
}: {
  type: "flat" | "percent";
  value: number;
  onTypeChange: (type: "flat" | "percent") => void;
  onValueChange: (value: number) => void;
}) {
  return (
    <div className="mt-4 space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
            type === "flat"
              ? "border border-primary/50 bg-primary/15 text-white"
              : "border border-white/15 bg-black/60 text-white/70 hover:border-white/25 hover:text-white"
          }`}
          onClick={() => onTypeChange("flat")}
        >
          Flat USD
        </button>
        <button
          type="button"
          className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
            type === "percent"
              ? "border border-primary/50 bg-primary/15 text-white"
              : "border border-white/15 bg-black/60 text-white/70 hover:border-white/25 hover:text-white"
          }`}
          onClick={() => onTypeChange("percent")}
        >
          Percent
        </button>
      </div>
      <Input
        type="number"
        min={0}
        max={type === "percent" ? 100 : undefined}
        step={type === "percent" ? 1 : 1}
        value={value}
        onChange={(event) => onValueChange(Number(event.target.value))}
      />
      <HelperText className="text-xs">
        {type === "flat"
          ? "Charged as a fixed fee when the corresponding money button is pressed."
          : "Percentage applied to the service price at the time of charge."}
      </HelperText>
    </div>
  );
}

function PolicyPreview({
  title,
  body,
  fee
}: {
  title: string;
  body: string;
  fee?: string;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-2 whitespace-pre-line">{body || "Policy text not provided yet."}</p>
      {fee ? <p className="mt-2 text-xs text-white/40">Fee: {fee}</p> : null}
    </section>
  );
}

function formatFee(type: PoliciesConfig["noShowFeeType"], value: number) {
  if (!value) return "0 fee";
  return type === "percent" ? `${value}%` : `$${value.toFixed(2)}`;
}

const DEFAULT_POLICIES: PoliciesConfig = {
  cancellationPolicy: "",
  cancellationFeeType: "percent",
  cancellationFeeValue: 0,
  noShowPolicy: "",
  noShowFeeType: "percent",
  noShowFeeValue: 0,
  refundPolicy: "",
  cashPolicy: ""
};

