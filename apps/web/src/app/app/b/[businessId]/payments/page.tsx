"use client";

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { useFakeBusiness } from "@/lib/fake-business";

type PaymentRow = {
  id: string;
  bookingCode: string;
  type: string;
  amountCents: number;
  status: string;
  occurredAt: string;
};

export default function PaymentsPage() {
  const { workspace } = useFakeBusiness();
  const [query, setQuery] = useState("");

  if (!workspace) {
    return null;
  }

  const rows = useMemo<PaymentRow[]>(() => {
    return workspace.bookings.flatMap((booking) =>
      booking.payments.map((payment) => ({
        id: payment.id,
        bookingCode: booking.code,
        type: payment.type.replace("_", " "),
        amountCents: payment.amountCents,
        status: payment.status.replace("_", " "),
        occurredAt: payment.occurredAt
      }))
    );
  }, [workspace.bookings]);

  const filtered = rows.filter((row) =>
    row.bookingCode.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.35em] text-white/40">Ledger</p>
        <h1 className="font-display text-4xl text-white">Payments &amp; fees</h1>
        <p className="max-w-3xl text-sm text-white/60">
          All manual captures, authorization records, policy fees, and refunds live here. Stripe IDs
          will join once the backend is wired. Use the search box to filter by booking code.
        </p>
      </header>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Input
            className="w-full max-w-xs"
            placeholder="Search booking code"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="rounded-full border border-white/15 bg-white/5 px-4 py-1 text-xs text-white/60">
            {filtered.length} entries
          </div>
        </div>

        <div className="mt-6 max-h-[28rem] overflow-y-auto rounded-2xl border border-white/10 bg-white/5">
          <table className="min-w-full text-left text-sm text-white/70">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/40">
              <tr>
                <th className="px-4 py-3">Booking</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Occurred</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-white/5 last:border-none">
                  <td className="px-4 py-3 font-semibold text-white">{row.bookingCode}</td>
                  <td className="px-4 py-3 capitalize">{row.type}</td>
                  <td className="px-4 py-3 capitalize">{row.status}</td>
                  <td className="px-4 py-3">{formatCurrency(row.amountCents)}</td>
                  <td className="px-4 py-3">{formatDate(row.occurredAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
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
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}




