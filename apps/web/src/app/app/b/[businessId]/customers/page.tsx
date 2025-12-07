"use client";

import { useMemo } from "react";

import { useFakeBusiness } from "@/lib/fake-business";

export default function CustomersPage() {
  const { workspace } = useFakeBusiness();

  if (!workspace) {
    return null;
  }

  const rows = useMemo(() => {
    const countByCustomer = workspace.bookings.reduce<Record<string, number>>((acc, booking) => {
      acc[booking.customer.id] = (acc[booking.customer.id] ?? 0) + 1;
      return acc;
    }, {});
    return workspace.customers.map((customer) => ({
      ...customer,
      bookingCount: countByCustomer[customer.id] ?? 0
    }));
  }, [workspace.customers, workspace.bookings]);

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.35em] text-white/40">Customers</p>
        <h1 className="font-display text-4xl text-white">Profiles</h1>
        <p className="max-w-3xl text-sm text-white/60">
          Every booking captures name, email, phone, and consent metadata. Future phases will introduce
          self-service portals; for now this table acts as the directory for booking searches.
        </p>
      </header>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="max-h-[28rem] overflow-y-auto rounded-2xl border border-white/10 bg-white/5">
          <table className="min-w-full text-left text-sm text-white/70">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/40">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Bookings</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-white/5 last:border-none">
                  <td className="px-4 py-3 font-semibold text-white">{row.name}</td>
                  <td className="px-4 py-3">{row.email}</td>
                  <td className="px-4 py-3">{row.phone ?? "—"}</td>
                  <td className="px-4 py-3">{row.bookingCount}</td>
                  <td className="px-4 py-3">{formatDate(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}




