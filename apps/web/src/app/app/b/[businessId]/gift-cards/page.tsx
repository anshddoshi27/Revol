"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/ui/helper-text";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFakeBusiness } from "@/lib/fake-business";
import type { GiftCardProgramState } from "@/lib/admin-workspace";

export default function GiftCardsPage() {
  const { workspace, setGiftCards } = useFakeBusiness();
  const [program, setProgram] = useState<GiftCardProgramState>(
    workspace?.giftCards ?? DEFAULT_GIFT_CARDS
  );

  if (!workspace) {
    return null;
  }

  const handleProgramChange = (updater: (program: GiftCardProgramState) => GiftCardProgramState) => {
    setProgram((prev) => updater(prev));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setGiftCards(program);
  };

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.35em] text-white/40">Gift cards</p>
        <h1 className="font-display text-4xl text-white">Balance programs</h1>
        <p className="max-w-3xl text-sm text-white/60">
          Configure amount or percent-based gift cards, set expirations, and track ledger entries. The
          fake flow here mirrors the real Connect integration coming in backend phases.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.6fr,1fr]">
        <section className="rounded-3xl border border-white/15 bg-white/5 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Program settings</h2>
            <Button
              type="button"
              variant={program.config.enabled ? "default" : "outline"}
              onClick={() =>
                handleProgramChange((prev) => ({
                  ...prev,
                  config: { ...prev.config, enabled: !prev.config.enabled }
                }))
              }
            >
              {program.config.enabled ? "Enabled" : "Disabled"}
            </Button>
          </div>
          <div className="mt-4 space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  program.config.amountType === "amount"
                    ? "border border-primary/50 bg-primary/15 text-white"
                    : "border border-white/15 bg-white/5 text-white/70 hover:border-white/25 hover:text-white"
                }`}
                onClick={() =>
                  handleProgramChange((prev) => ({
                    ...prev,
                    config: { ...prev.config, amountType: "amount" }
                  }))
                }
              >
                Fixed amount
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  program.config.amountType === "percent"
                    ? "border border-primary/50 bg-primary/15 text-white"
                    : "border border-white/15 bg-white/5 text-white/70 hover:border-white/25 hover:text-white"
                }`}
                onClick={() =>
                  handleProgramChange((prev) => ({
                    ...prev,
                    config: { ...prev.config, amountType: "percent" }
                  }))
                }
              >
                Percent discount
              </button>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-white/50">
                {program.config.amountType === "amount" ? "Amount (USD)" : "Percent (%)"}
              </Label>
              <Input
                type="number"
                min={0}
                step={program.config.amountType === "amount" ? 5 : 1}
                className="mt-2"
                value={
                  program.config.amountType === "amount"
                    ? program.config.amountValue / 100
                    : program.config.amountValue
                }
                onChange={(event) =>
                  handleProgramChange((prev) => ({
                    ...prev,
                    config: {
                      ...prev.config,
                      amountValue:
                        prev.config.amountType === "amount"
                          ? Math.round(Number(event.target.value) * 100)
                          : Number(event.target.value)
                    }
                  }))
                }
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/70">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={program.config.expirationEnabled}
                  onChange={(event) =>
                    handleProgramChange((prev) => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        expirationEnabled: event.target.checked
                      }
                    }))
                  }
                />
                Require expiration date
              </label>
              {program.config.expirationEnabled ? (
                <div className="mt-3 flex items-center gap-2">
                  <Label>Months</Label>
                  <Input
                    type="number"
                    min={1}
                    value={program.config.expirationMonths ?? 12}
                    onChange={(event) =>
                      handleProgramChange((prev) => ({
                        ...prev,
                        config: {
                          ...prev.config,
                          expirationMonths: Number(event.target.value)
                        }
                      }))
                    }
                  />
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/70">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={program.restoreBalanceOnRefund}
                  onChange={(event) =>
                    handleProgramChange((prev) => ({
                      ...prev,
                      restoreBalanceOnRefund: event.target.checked
                    }))
                  }
                />
                Restore balance when refunds happen
              </label>
            </div>
          </div>
          <div className="mt-6 flex justify-between">
            <HelperText>
              Each issued code appears in the ledger below. Backend integration will swap in Stripe
              PaymentIntent references and hosted delivery.
            </HelperText>
            <Button type="submit">Save program</Button>
          </div>
        </section>

        <section className="rounded-3xl border border-white/15 bg-white/5 p-6">
          <h2 className="text-lg font-semibold text-white">Ledger preview</h2>
          <div className="mt-4 max-h-80 overflow-y-auto rounded-2xl border border-white/10 bg-white/5">
            <table className="min-w-full text-left text-sm text-white/70">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/40">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Delta</th>
                  <th className="px-4 py-3">Balance</th>
                  <th className="px-4 py-3">Reason</th>
                </tr>
              </thead>
              <tbody>
                {program.ledger.length ? (
                  program.ledger.map((entry) => (
                    <tr key={entry.id} className="border-b border-white/5 last:border-none">
                      <td className="px-4 py-3">{formatDate(entry.occurredAt)}</td>
                      <td className="px-4 py-3">{entry.code}</td>
                      <td className="px-4 py-3">
                        {entry.deltaCents >= 0 ? "+" : "-"}
                        {formatCurrency(Math.abs(entry.deltaCents))}
                      </td>
                      <td className="px-4 py-3">{formatCurrency(entry.balanceAfterCents)}</td>
                      <td className="px-4 py-3 capitalize">{entry.reason.replace("_", " ")}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-4 text-center text-white/50" colSpan={5}>
                      Ledger entries will appear after the first gift card is issued.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </form>
    </div>
  );
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

const DEFAULT_GIFT_CARDS: GiftCardProgramState = {
  config: {
    enabled: false,
    amountType: "amount",
    amountValue: 10000,
    expirationEnabled: false,
    generatedCodes: []
  },
  restoreBalanceOnRefund: true,
  ledger: []
};




