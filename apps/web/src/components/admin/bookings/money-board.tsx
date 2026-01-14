"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/ui/helper-text";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import type {
  BookingActionResponse,
  FakeBooking,
  MoneyBoardAction
} from "@/lib/admin-workspace";
import type { PoliciesConfig } from "@/lib/onboarding-types";

interface MoneyBoardProps {
  bookings: FakeBooking[];
  policies: PoliciesConfig;
  onAction: (bookingId: string, action: MoneyBoardAction) => Promise<BookingActionResponse | undefined>;
}

export function MoneyBoard({ bookings, policies, onAction }: MoneyBoardProps) {
  const toast = useToast();
  const [selectedBooking, setSelectedBooking] = useState<FakeBooking | null>(null);

  const sortedBookings = useMemo(
    () =>
      [...bookings].sort((a, b) => {
        const aTime = new Date(a.startDateTime).getTime();
        const bTime = new Date(b.startDateTime).getTime();
        return bTime - aTime;
      }),
    [bookings]
  );

  const handleAction = async (bookingId: string, action: MoneyBoardAction) => {
    try {
      const result = await onAction(bookingId, action);
      if (!result) {
        // Check browser console for detailed error message from API
        toast.pushToast({
          title: "Action unavailable",
          description: "This booking cannot process that action right now. Please check the browser console for details, or ensure the booking has a completed payment setup.",
          intent: "warning"
        });
        return;
      }

      if (result.status === "requires_action") {
        toast.pushToast({
          title: "Customer action required",
          description:
            result.payLinkUrl ??
            "Send the secure pay link to the customer so they can finish authentication.",
          intent: "warning",
          actionLabel: result.payLinkUrl ? "Copy link" : undefined,
          onAction: result.payLinkUrl
            ? () => navigator.clipboard.writeText(result.payLinkUrl ?? "")
            : undefined
        });
      } else {
        toast.pushToast({
          title: "Money board updated",
          description: result.message,
          intent: "success"
        });
      }

      setSelectedBooking((current) =>
        current && current.id === result.booking.id ? result.booking : current
      );
    } catch (error) {
      console.error('Error performing booking action:', error);
      toast.pushToast({
        title: "Action failed",
        description: error instanceof Error ? error.message : "An error occurred while processing this action.",
        intent: "error"
      });
    }
  };

  if (sortedBookings.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center text-white/60">
        <p className="text-lg font-semibold text-white">No bookings yet</p>
        <p className="mt-2 text-sm text-white/50">
          As soon as customers book, every appointment will land here ready for capture, fees, or
          refunds.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-6">
        {sortedBookings.map((booking) => (
          <MoneyCard
            key={booking.id}
            booking={booking}
            policies={policies}
            onAction={handleAction}
            onInspect={() => setSelectedBooking(booking)}
          />
        ))}
      </div>
      <BookingDetailDialog booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
    </>
  );
}

function MoneyCard({
  booking,
  onAction,
  onInspect,
  policies
}: {
  booking: FakeBooking;
  onAction: (bookingId: string, action: MoneyBoardAction) => void;
  onInspect: () => void;
  policies: PoliciesConfig;
}) {
  const actions = [
    {
      label: "Completed",
      action: "complete" as const,
      intent: "primary" as const
    },
    {
      label: "No-show",
      action: "no_show" as const,
      intent: "outline" as const
    },
    {
      label: "Cancelled",
      action: "cancel" as const,
      intent: "outline" as const
    },
    {
      label: "Refund",
      action: "refund" as const,
      intent: "ghost" as const
    }
  ];

  const noShowLabel =
    policies.noShowFeeValue > 0
      ? policies.noShowFeeType === "percent"
        ? `${policies.noShowFeeValue}% fee`
        : `$${policies.noShowFeeValue.toFixed(2)} fee`
      : "0 fee";
  const cancelLabel =
    policies.cancellationFeeValue > 0
      ? policies.cancellationFeeType === "percent"
        ? `${policies.cancellationFeeValue}% fee`
        : `$${policies.cancellationFeeValue.toFixed(2)} fee`
      : "0 fee";

  return (
    <article className="rounded-3xl border border-white/10 bg-black/80 p-4 text-xs shadow-[0_30px_90px_rgba(4,12,35,0.6)] transition hover:border-primary/40 hover:shadow-[0_40px_120px_rgba(34,102,255,0.35)] md:text-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <StatusBadge status={booking.status} />
            <Badge variant="outline" className="border-white/20 text-white/70">
              {booking.code}
            </Badge>
            <span className="text-xs text-white/50">
              {formatDateTime(booking.startDateTime)} · {booking.durationMinutes} min
            </span>
          </div>
          <div>
            <p className="text-lg font-semibold text-white">{booking.serviceName}</p>
            <p className="text-xs uppercase tracking-wide text-white/50">{booking.categoryName}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((item) => (
            <Button
              key={item.label}
              type="button"
              variant={item.intent === "primary" ? "default" : item.intent}
              onClick={() => onAction(booking.id, item.action)}
              disabled={
                item.action === "refund" &&
                !booking.payments.some(
                  (payment) => payment.status === "captured" && payment.type !== "authorization"
                )
              }
            >
              {item.label}
            </Button>
          ))}
        </div>
      </header>

      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoBlock
            title="Customer"
            lines={[
              booking.customer.name,
              booking.customer.email,
              booking.customer.phone ?? "Phone not provided"
            ]}
          />
          <InfoBlock
            title="Staff"
            lines={[
              booking.staff ? booking.staff.name : "Unassigned",
              booking.staff ? `Color ${booking.staff.color}` : "Team selection pending"
            ]}
          />
          <InfoBlock
            title="Policy consent"
            lines={[
              `Hash ${booking.policyConsent.hash.slice(0, 10)}…`,
              `Captured ${formatDateTime(booking.policyConsent.acceptedAt)}`,
              booking.policyConsent.ip
            ]}
          />
          <InfoBlock
            title="Fee rules"
            lines={[
              `No-show: ${noShowLabel}`,
              `Cancel: ${cancelLabel}`,
              policies.refundPolicy ? "Refund policy configured" : "Refund policy not set"
            ]}
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/70 p-4">
          <h4 className="text-sm font-semibold text-white">Payment breakdown</h4>
          <dl className="mt-3 space-y-2 text-white/70">
            <div className="flex items-center justify-between">
              <dt>List price</dt>
              <dd>{formatCurrency(booking.financials.listPriceCents)}</dd>
            </div>
            {booking.financials.giftCardAmountCents > 0 ? (
              <div className="flex items-center justify-between text-emerald-300/80">
                <dt>Gift card applied</dt>
                <dd>-{formatCurrency(booking.financials.giftCardAmountCents)}</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <dt>Platform fee (1%)</dt>
              <dd>{formatCurrency(booking.financials.platformFeeCents)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Stripe fee est.</dt>
              <dd>{formatCurrency(booking.financials.stripeFeeEstimateCents)}</dd>
            </div>
            <div className="flex items-center justify-between text-sm font-semibold text-white md:text-base">
              <dt>Net to business</dt>
              <dd>{formatCurrency(booking.financials.netPayoutCents)}</dd>
            </div>
          </dl>
          <HelperText className="mt-3 text-xs">
            Manual capture keeps you in control — charges only happen when these buttons fire.
          </HelperText>
          <Button
            type="button"
            variant="ghost"
            className="mt-3 w-full justify-center text-white"
            onClick={onInspect}
          >
            View full booking
          </Button>
        </div>
      </div>
    </article>
  );
}

function BookingDetailDialog({
  booking,
  onClose
}: {
  booking: FakeBooking | null;
  onClose: () => void;
}) {
  if (!booking) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur">
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/10 bg-black px-8 py-10 shadow-[0_60px_160px_rgba(4,12,35,0.7)]">
        <button
          type="button"
          className="absolute right-6 top-6 rounded-full border border-white/20 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:text-white"
          onClick={onClose}
        >
          Close
        </button>
        <header className="space-y-2 pr-16">
          <div className="flex items-center gap-3">
            <StatusBadge status={booking.status} />
            <span className="text-sm text-white/60">{booking.code}</span>
          </div>
          <h2 className="font-display text-3xl text-white">{booking.serviceName}</h2>
          <p className="text-sm text-white/60">
            {formatDateTime(booking.startDateTime)} · {booking.durationMinutes} minutes with{" "}
            {booking.staff ? booking.staff.name : "Unassigned staff"}
          </p>
        </header>

        <section className="mt-10 space-y-8">
          <DetailGrid
            title="Customer & appointment"
            items={[
              { label: "Customer", value: booking.customer.name },
              { label: "Email", value: booking.customer.email },
              { label: "Phone", value: booking.customer.phone ?? "Not provided" },
              { label: "Policy hash", value: booking.policyConsent.hash },
              { label: "Consent timestamp", value: formatDateTime(booking.policyConsent.acceptedAt) },
              { label: "IP / UA", value: `${booking.policyConsent.ip} / ${booking.policyConsent.userAgent}` }
            ]}
          />
          <DetailGrid
            title="Payment ledger"
            items={booking.payments.map((payment) => ({
              label: `${titleCase(payment.type.replace("_", " "))}`,
              value: `${formatCurrency(payment.amountCents)} · ${formatDateTime(payment.occurredAt)}`
            }))}
          />
          <DetailGrid
            title="Financial summary"
            items={[
              { label: "List price", value: formatCurrency(booking.financials.listPriceCents) },
              {
                label: "Gift card applied",
                value: booking.financials.giftCardAmountCents
                  ? `-${formatCurrency(booking.financials.giftCardAmountCents)}`
                  : "None"
              },
              { label: "Net payout", value: formatCurrency(booking.financials.netPayoutCents) }
            ]}
          />
          {booking.notes ? (
            <div className="rounded-2xl border border-white/10 bg-black/70 p-4 text-white/70">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-white">Notes</h3>
              <p className="mt-2 text-sm">{booking.notes}</p>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function InfoBlock({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/70 p-3 text-xs text-white/70 md:text-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50 md:text-xs">
        {title}
      </p>
      <ul className="mt-2 space-y-1">
        {lines.map((line, index) => (
          <li key={`${title}-${index}`} className="truncate">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DetailGrid({
  title,
  items
}: {
  title: string;
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50 md:text-sm">
        {title}
      </h3>
      <dl className="mt-2 grid gap-3 text-xs sm:grid-cols-2 md:text-sm">
        {items.map((item) => (
          <div
            key={`${title}-${item.label}`}
            className="rounded-2xl border border-white/10 bg-black/70 px-3 py-3 text-white/70"
          >
            <dt className="text-[10px] uppercase tracking-wide text-white/40 md:text-xs">
              {item.label}
            </dt>
            <dd className="mt-1 text-xs text-white md:text-sm">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function StatusBadge({ status }: { status: FakeBooking["status"] }) {
  const map: Record<string, { label: string; tone: string }> = {
    pending: { label: "Pending", tone: "border-amber-300/40 bg-amber-300/20 text-amber-100" },
    authorized: { label: "Authorized", tone: "border-sky-400/40 bg-sky-400/20 text-sky-100" },
    completed: { label: "Completed", tone: "border-emerald-400/40 bg-emerald-400/20 text-emerald-100" },
    captured: { label: "Captured", tone: "border-emerald-400/40 bg-emerald-400/20 text-emerald-100" },
    no_show: { label: "No-show", tone: "border-rose-400/40 bg-rose-400/15 text-rose-100" },
    canceled: { label: "Cancelled", tone: "border-orange-400/40 bg-orange-400/15 text-orange-100" },
    cancelled: { label: "Cancelled", tone: "border-orange-400/40 bg-orange-400/15 text-orange-100" }, // British spelling from database
    refunded: { label: "Refunded", tone: "border-indigo-400/40 bg-indigo-400/20 text-indigo-100" },
    disputed: { label: "Disputed", tone: "border-red-400/40 bg-red-400/15 text-red-100" },
    requires_action: {
      label: "Action required",
      tone: "border-fuchsia-400/40 bg-fuchsia-400/20 text-fuchsia-100"
    },
    expired: { label: "Expired", tone: "border-slate-400/40 bg-slate-400/20 text-slate-100" }
  };
  const entry = map[status] || { label: status || "Unknown", tone: "border-slate-400/40 bg-slate-400/20 text-slate-100" };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${entry.tone}`}
    >
      {entry.label}
    </span>
  );
}

function formatCurrency(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency
  }).format(cents / 100);
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function titleCase(value: string) {
  return value.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
}

