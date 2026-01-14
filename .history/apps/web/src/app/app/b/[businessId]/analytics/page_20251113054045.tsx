"use client";

import { useMemo } from "react";

import { useFakeBusiness } from "@/lib/fake-business";

const STATUS_COLORS: Record<string, string> = {
  captured: "#5B64FF",
  authorized: "#57D0FF",
  pending: "#8AFFCF",
  canceled: "#FF9A8B",
  no_show: "#FFD166",
  refunded: "#C4A5FF",
  requires_action: "#FF6FB5",
  completed: "#5B64FF"
};

export default function AnalyticsPage() {
  const { workspace } = useFakeBusiness();

  if (!workspace) {
    return null;
  }

  const analytics = workspace.analytics;

  const lineSeries = useMemo(() => {
    const points = analytics.revenueByMonth.map((entry, index) => ({
      x: index,
      captured: entry.capturedCents / 100,
      noShow: entry.noShowFeeCents / 100,
      refunded: entry.refundedCents / 100,
      label: entry.month
    }));
    return points;
  }, [analytics.revenueByMonth]);

  const donutSeries = useMemo(() => {
    const total = analytics.bookingsByStatus.reduce((sum, entry) => sum + entry.count, 0) || 1;
    return analytics.bookingsByStatus.map((entry) => ({
      ...entry,
      percentage: Math.round((entry.count / total) * 100)
    }));
  }, [analytics.bookingsByStatus]);

  return (
    <div className="space-y-12">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.35em] text-white/40">Insights</p>
        <h1 className="font-display text-4xl text-white">Analytics overview</h1>
        <p className="max-w-3xl text-sm text-white/60">
          Stripe-ready metrics give owners clarity on revenue, manual captures, policy fees, and
          customer behavior. This dashboard is wired to the fake data today, and will plug directly into
          the real API responses once they land.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        <MetricCard
          label="Captured revenue (30d)"
          value={formatCurrency(analytics.feeBreakdown.totalCapturedCents)}
          helper="Manual captures + policy fees"
        />
        <MetricCard
          label="Platform fee earned"
          value={formatCurrency(analytics.feeBreakdown.platformFeeCents)}
          helper="1% on every completed charge"
        />
        <MetricCard
          label="Net payout to business"
          value={formatCurrency(analytics.feeBreakdown.netPayoutCents)}
          helper="What hits the tenant's Connect account"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <header className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Monthly revenue streams</h2>
              <p className="text-xs uppercase tracking-wide text-white/40">
                Manual capture vs policy fees vs refunds
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-white/60">
              <LegendDot color="#5B64FF" label="Captured" />
              <LegendDot color="#57D0FF" label="No-show fee" />
              <LegendDot color="#FF9A8B" label="Refunded" />
            </div>
          </header>
          <div className="mt-6 h-64 w-full rounded-2xl border border-white/10 bg-[#060F28]/80 p-4">
            <svg viewBox="0 0 400 160" className="h-full w-full">
              <GridLines />
              <Polyline series={lineSeries} accessor="captured" color="#5B64FF" />
              <Polyline series={lineSeries} accessor="noShow" color="#57D0FF" />
              <Polyline series={lineSeries} accessor="refunded" color="#FF9A8B" />
              {lineSeries.map((point, index) => (
                <text
                  key={point.label}
                  x={(index / Math.max(lineSeries.length - 1, 1)) * 360 + 20}
                  y={150}
                  textAnchor="middle"
                  className="fill-white/50 text-[10px]"
                >
                  {point.label}
                </text>
              ))}
            </svg>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold text-white">Booking mix</h2>
          <p className="text-xs uppercase tracking-wide text-white/40">Status distribution</p>
          <DonutChart data={donutSeries} />
          <ul className="mt-6 space-y-2 text-sm text-white/70">
            {donutSeries.map((entry) => (
              <li key={entry.status} className="flex items-center justify-between">
                <span className="flex items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: STATUS_COLORS[entry.status] ?? "#5B64FF" }}
                  />
                  <span className="capitalize">{entry.status.replace("_", " ")}</span>
                </span>
                <span>{entry.percentage}%</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.3fr,1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold text-white">Staff utilization</h2>
          <p className="text-xs uppercase tracking-wide text-white/40">Based on booked minutes</p>
          <div className="mt-6 space-y-4">
            {analytics.staffUtilization.map((staff) => (
              <div key={staff.staffId}>
                <div className="flex items-center justify-between text-sm text-white/70">
                  <span>{staff.staffName}</span>
                  <span>{staff.utilizationPercent}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary/80 to-sky-400/80"
                    style={{ width: `${staff.utilizationPercent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold text-white">Fee breakdown</h2>
          <p className="text-xs uppercase tracking-wide text-white/40">Last 30 days</p>
          <dl className="mt-6 space-y-3 text-sm text-white/70">
            <div className="flex items-center justify-between">
              <dt>Captured</dt>
              <dd>{formatCurrency(analytics.feeBreakdown.totalCapturedCents)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Platform fee (1%)</dt>
              <dd>{formatCurrency(analytics.feeBreakdown.platformFeeCents)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Stripe fees est.</dt>
              <dd>{formatCurrency(analytics.feeBreakdown.stripeFeeCents)}</dd>
            </div>
            <div className="flex items-center justify-between text-base font-semibold text-white">
              <dt>Net payout</dt>
              <dd>{formatCurrency(analytics.feeBreakdown.netPayoutCents)}</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent px-6 py-6">
      <p className="text-xs uppercase tracking-wide text-white/50">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-xs text-white/60">{helper}</p>
    </div>
  );
}

function GridLines() {
  const lines = new Array(4).fill(null);
  return (
    <>
      <rect x="20" y="10" width="360" height="140" fill="transparent" stroke="rgba(255,255,255,0.08)" />
      {lines.map((_, index) => (
        <line
          key={`grid-${index}`}
          x1="20"
          x2="380"
          y1={10 + (index + 1) * 28}
          y2={10 + (index + 1) * 28}
          stroke="rgba(255,255,255,0.05)"
        />
      ))}
    </>
  );
}

function Polyline({
  series,
  accessor,
  color
}: {
  series: Array<{ x: number; captured: number; noShow: number; refunded: number; label: string }>;
  accessor: "captured" | "noShow" | "refunded";
  color: string;
}) {
  if (series.length === 0) return null;
  const max = Math.max(
    ...series.map((point) => Math.max(point.captured, point.noShow, point.refunded)),
    1
  );
  const points = series
    .map((point, index) => {
      const x = (index / Math.max(series.length - 1, 1)) * 360 + 20;
      const y = 150 - (point[accessor] / max) * 120;
      return `${x},${y}`;
    })
    .join(" ");
  return <polyline points={points} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />;
}

function DonutChart({
  data
}: {
  data: Array<{ status: string; count: number; percentage: number }>;
}) {
  const gradient = data
    .reduce<{ start: number; segments: string[] }>(
      (acc, entry) => {
        const end = acc.start + entry.percentage;
        acc.segments.push(
          `${STATUS_COLORS[entry.status] ?? "#5B64FF"} ${acc.start}% ${end}%`
        );
        acc.start = end;
        return acc;
      },
      { start: 0, segments: [] }
    )
    .segments.join(", ");

  return (
    <div className="mt-6 flex items-center justify-center">
      <div
        className="flex h-44 w-44 items-center justify-center rounded-full border border-white/10 bg-[#060F28]"
        style={{
          background: `conic-gradient(${gradient})`
        }}
      >
        <div className="flex h-28 w-28 items-center justify-center rounded-full border border-white/10 bg-[#050F2C]">
          <span className="text-xs text-white/50">100%</span>
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </span>
  );
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(cents / 100);
}

