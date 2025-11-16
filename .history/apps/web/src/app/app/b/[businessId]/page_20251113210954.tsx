"use client";

import { useMemo } from "react";
import { TrendingUp, Wallet2, XCircle } from "lucide-react";

import { MoneyBoard } from "@/components/admin/bookings/money-board";
import { HelperText } from "@/components/ui/helper-text";
import { useFakeBusiness } from "@/lib/fake-business";

export default function PastBookingsPage() {
  const { workspace, performBookingAction } = useFakeBusiness();

  if (!workspace) {
    return null;
  }

  const analytics = workspace.analytics;
  const headlineMetrics = useMemo(
    () => [
      {
        label: "Captured revenue",
        value: formatCurrency(analytics.feeBreakdown.totalCapturedCents),
        description: "Includes manual capture, cancellation fees, and no-show fees.",
        icon: <TrendingUp className="h-5 w-5 text-emerald-300" aria-hidden="true" />
      },
      {
        label: "Net to business",
        value: formatCurrency(analytics.feeBreakdown.netPayoutCents),
        description: "After 1% platform fee and estimated Stripe fees.",
        icon: <Wallet2 className="h-5 w-5 text-sky-300" aria-hidden="true" />
      },
      {
        label: "No-show rate",
        value: `${analytics.noShowRatePercent}%`,
        description: "Trackable once bookings flow through the calendar.",
        icon: <XCircle className="h-5 w-5 text-amber-300" aria-hidden="true" />
      }
    ],
    [analytics]
  );

  return (
    <div className="space-y-12">
      <section>
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/40">Money board</p>
            <h1 className="mt-3 font-display text-4xl text-white">Past bookings</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/60">
              Every booking that ever happened lives here. Manual capture keeps funds untouched until
              you click Completed, No-Show, Cancel, or Refund. Each card shows the policy consent, card
              status, and fee breakdown so you can act with confidence.
            </p>
          </div>
          <div className="rounded-3xl border border-white/15 bg-white/5 px-6 py-4 text-sm text-white/70">
            <p className="font-semibold text-white">Manual capture rule</p>
            <p className="mt-1">
              Tithi never charges at booking time. Money moves only after you press one of the four
              buttons. Every action is idempotent and writes to the ledger for audit parity once the
              backend is wired.
            </p>
          </div>
        </header>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {headlineMetrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-white">Live bookings ledger</h2>
              <p className="text-sm text-white/60">
                Buttons align with Stripe Connect flows — capture the original authorization, charge
                policy fees, or issue refunds. Tithi auto-calculates the 1% platform fee and Stripe
                estimate so you always know the net payout.
              </p>
            </div>
            <HelperText className="max-w-sm text-left">
              Preview data is in-memory today. When the backend arrives these components call real
              endpoints with the same contracts.
            </HelperText>
          </div>
        </div>
        <MoneyBoard
          bookings={workspace.bookings}
          policies={workspace.policies}
          onAction={(bookingId, action) => performBookingAction(bookingId, action)}
        />
      </section>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  description
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent px-6 py-6">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white">
          {icon}
        </span>
        <div>
          <p className="text-xs uppercase tracking-wide text-white/50">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
        </div>
      </div>
      <p className="mt-4 text-xs text-white/60">{description}</p>
    </div>
  );
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}