"use client";

import { useState } from "react";
import { Gift, Sparkles, Calendar, Hash } from "lucide-react";

import { HelperText } from "@/components/ui/helper-text";
import { Input } from "@/components/ui/input";
import { StepActions } from "@/components/onboarding/step-actions";
import type { GiftCardConfig } from "@/lib/onboarding-context";

interface GiftCardsStepProps {
  defaultValues: GiftCardConfig;
  onNext: (values: GiftCardConfig) => Promise<void> | void;
  onBack: () => void;
}

export function GiftCardsStep({ defaultValues, onNext, onBack }: GiftCardsStepProps) {
  const [config, setConfig] = useState<GiftCardConfig>(defaultValues);

  const handleToggle = () => {
    setConfig((prev) => ({ ...prev, enabled: !prev.enabled }));
  };

  const handleAmountType = (value: "amount" | "percent") => {
    setConfig((prev) => ({ ...prev, amountType: value }));
  };

  const handleGenerateCode = () => {
    const code = createGiftCode();
    setConfig((prev) => ({
      ...prev,
      generatedCodes: [code, ...prev.generatedCodes].slice(0, 5)
    }));
  };

  const handleContinue = () => {
    onNext(config);
  };

  return (
    <div className="space-y-8" aria-labelledby="giftcards-step-heading">
      <header className="space-y-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary/90">
          <Gift className="h-4 w-4" aria-hidden="true" />
          Step 10 · Gift cards (optional)
        </span>
        <h2 id="giftcards-step-heading" className="font-display text-3xl text-white">
          Offer prepaid experiences
        </h2>
        <p className="max-w-3xl text-base text-white/70">
          Enable gift cards to sell packages or run promos. Amount discounts subtract a fixed
          value from charges; percent discounts apply to the booking total before fees.
        </p>
      </header>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-1 h-4 w-4 text-primary" aria-hidden="true" />
            <div>
              <h3 className="text-lg font-semibold text-white">
                {config.enabled ? "Gift cards enabled" : "Gift cards disabled"}
              </h3>
              <p className="text-xs text-white/60">
                {config.enabled
                  ? "Customers can redeem codes at checkout. Balances update when charges occur."
                  : "Toggle on to create codes during onboarding or later in admin."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggle}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              config.enabled
                ? "border border-emerald-400/80 bg-emerald-400/20 text-emerald-100 hover:bg-emerald-400/30"
                : "border border-white/15 bg-white/5 text-white/70 hover:border-white/25 hover:text-white"
            }`}
          >
            {config.enabled ? "Disable" : "Enable"}
          </button>
        </div>
      </div>

      {config.enabled ? (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-sm font-semibold text-white">Discount type</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleAmountType("amount")}
                  className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                    config.amountType === "amount"
                      ? "border border-primary/50 bg-primary/15 text-white"
                      : "border border-white/15 bg-white/5 text-white/70 hover:border-white/25 hover:text-white"
                  }`}
                >
                  Amount
                </button>
                <button
                  type="button"
                  onClick={() => handleAmountType("percent")}
                  className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                    config.amountType === "percent"
                      ? "border border-primary/50 bg-primary/15 text-white"
                      : "border border-white/15 bg-white/5 text-white/70 hover:border-white/25 hover:text-white"
                  }`}
                >
                  Percent
                </button>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/60">
                  {config.amountType === "amount" ? "Amount (USD)" : "Percent"}
                </label>
                <Input
                  type="number"
                  min={0}
                  max={config.amountType === "percent" ? 100 : undefined}
                  step={config.amountType === "percent" ? 1 : 1}
                  value={config.amountValue}
                  onChange={(event) =>
                    setConfig((prev) => ({ ...prev, amountValue: Number(event.target.value) }))
                  }
                />
                <HelperText className="mt-2">
                  {config.amountType === "amount"
                    ? "Balance deducts only when money buttons capture a charge."
                    : "Percent discounts apply before fees and gift balance tracking."}
                </HelperText>
              </div>
            </div>

            <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-6">
              <p className="text-sm font-semibold text-white">Expiration</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setConfig((prev) => ({ ...prev, expirationEnabled: !prev.expirationEnabled }))
                  }
                  className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                    config.expirationEnabled
                      ? "border border-primary/50 bg-primary/15 text-white"
                      : "border border-white/15 bg-white/5 text-white/70 hover:border-white/25 hover:text-white"
                  }`}
                >
                  {config.expirationEnabled ? "Set to never expire" : "Set expiration"}
                </button>
                {config.expirationEnabled ? (
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                    Expires after
                    <Input
                      type="number"
                      min={1}
                      value={config.expirationMonths ?? 12}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          expirationMonths: Number(event.target.value)
                        }))
                      }
                      className="w-20"
                    />
                    months
                  </div>
                ) : null}
              </div>
              <HelperText className="mt-2">
                You can adjust expiration per code later. Leave off to follow local regulations.
              </HelperText>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Hash className="h-4 w-4 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-white">Generate sample codes</p>
                  <p className="text-xs text-white/60">
                    Codes use uppercase letters and numbers. Customers enter them at checkout.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleGenerateCode}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                Generate code
              </button>
            </div>
            {config.generatedCodes.length ? (
              <ul className="mt-4 flex flex-wrap gap-3 text-sm text-white/80">
                {config.generatedCodes.map((code) => (
                  <li
                    key={code}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1 font-semibold"
                  >
                    {code}
                  </li>
                ))}
              </ul>
            ) : (
              <HelperText className="mt-3">
                Generate codes now or later in admin—either way balances sync to the ledger.
              </HelperText>
            )}
          </div>
        </div>
      ) : null}

      <StepActions onBack={onBack} onNext={handleContinue} />
    </div>
  );
}

function createGiftCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (i === 3) code += "-";
  }
  return code;
}





