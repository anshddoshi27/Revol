"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink, PartyPopper } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/ui/helper-text";
import { StepActions } from "@/components/onboarding/step-actions";
import type {
  BusinessBasics,
  LocationContacts,
  PoliciesConfig,
  ServiceCategory,
  StaffMember
} from "@/lib/onboarding-context";

interface GoLiveStepProps {
  business: BusinessBasics;
  location: LocationContacts;
  staff: StaffMember[];
  categories: ServiceCategory[];
  bookingUrl: string;
  policies: PoliciesConfig;
  onLaunch: () => void;
  onBack: () => void;
}

const CONFETTI_PIECES = Array.from({ length: 120 }, (_, index) => index);

export function GoLiveStep({
  business,
  location,
  staff,
  categories,
  bookingUrl,
  policies,
  onLaunch,
  onBack
}: GoLiveStepProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    setShowConfetti(true);
    return () => setShowConfetti(false);
  }, []);

  const summary = useMemo(
    () => ({
      staffCount: staff.length,
      serviceCount: categories.reduce((count, category) => count + category.services.length, 0),
      policySummary: formatPolicySummary(policies)
    }),
    [staff, categories, policies]
  );

  return (
    <div className="relative space-y-10" aria-labelledby="go-live-step-heading">
      {showConfetti ? <ConfettiOverlay /> : null}

      <header className="space-y-4 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/50 bg-emerald-400/20 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-100">
          <PartyPopper className="h-4 w-4" aria-hidden="true" />
          Step 12 · Go live
        </span>
        <h2 id="go-live-step-heading" className="font-display text-4xl text-white">
          {business.businessName || "Your business"} is live!
        </h2>
        <p className="mx-auto max-w-2xl text-base text-white/70">
          You’re ready to accept bookings. Share your booking link, finish admin polish, and control
          payments from the money board.
        </p>
      </header>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
          Booking URL
        </p>
        <p className="mt-3 select-all text-xl font-semibold text-white">{bookingUrl}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={bookingUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 transition hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            Open booking page
          </Link>
          <Button
            type="button"
            onClick={onLaunch}
            className="inline-flex items-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Go to admin
          </Button>
        </div>
        <HelperText className="mt-3">
          You can edit any onboarding section later. Multi-business support is coming, but for now
          each owner manages one business and subscription.
        </HelperText>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <SummaryCard title="Team ready" value={`${summary.staffCount} members`} />
        <SummaryCard title="Services live" value={`${summary.serviceCount} services`} />
        <SummaryCard title="Policies" value={summary.policySummary} />
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
        <p className="font-semibold text-white">What happens next</p>
        <ul className="mt-3 space-y-2 list-disc pl-5 text-left text-white/60">
          <li>Admin past bookings unlock money buttons for manual capture, no-show, cancel, refund.</li>
          <li>
            Customers see your branding, services by category, and policies modal before consent. Card
            is saved but never charged until you decide.
          </li>
          <li>
            Stripe handles payouts via Connect. Subscription is {configStatusLabel(summary)} — manage it
            anytime in Account.
          </li>
        </ul>
      </div>

      <StepActions onBack={onBack} onNext={onLaunch} nextLabel="Launch admin" finish />
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/50">{title}</p>
      <p className="mt-3 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function formatPolicySummary(policies: PoliciesConfig) {
  const parts: string[] = [];
  if (policies.cancellationFeeValue) {
    parts.push(`Cancel ${formatFee(policies.cancellationFeeType, policies.cancellationFeeValue)}`);
  } else {
    parts.push("Cancel 0 fee");
  }
  if (policies.noShowFeeValue) {
    parts.push(`No-show ${formatFee(policies.noShowFeeType, policies.noShowFeeValue)}`);
  } else {
    parts.push("No-show 0 fee");
  }
  return parts.join(" · ");
}

function formatFee(type: PoliciesConfig["noShowFeeType"], value: number) {
  return type === "percent" ? `${value}%` : `$${value.toFixed(2)}`;
}

function configStatusLabel(summary: { staffCount: number; serviceCount: number; policySummary: string }) {
  return summary.staffCount > 0 ? "ready" : "in setup";
}

function ConfettiOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {CONFETTI_PIECES.map((piece) => (
        <span
          key={piece}
          className="absolute h-2 w-1 rounded-sm opacity-0 confetti-piece"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 0.5}s`,
            backgroundColor: randomConfettiColor()
          }}
        />
      ))}
      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-10vh) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0;
          }
        }
        .confetti-piece {
          animation: confetti-fall 1.8s ease-in both;
        }
      `}</style>
    </div>
  );
}

function randomConfettiColor() {
  const palette = ["#5B64FF", "#57D0FF", "#FF9A8B", "#FFD166", "#8AFFCF", "#C4A5FF"];
  return palette[Math.floor(Math.random() * palette.length)];
}


