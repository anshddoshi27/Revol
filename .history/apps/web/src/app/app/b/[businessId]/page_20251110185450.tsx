"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarCheck2,
  ClipboardList,
  CreditCard,
  Link as LinkIcon,
  LogOut,
  ShieldCheck,
  Sparkles
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/ui/helper-text";
import { useFakeBusiness } from "@/lib/fake-business";
import { useOnboarding } from "@/lib/onboarding-context";
import { useFakeSession } from "@/lib/fake-session";

export default function AdminBusinessPage() {
  const params = useParams<{ businessId: string }>();
  const router = useRouter();
  const { business } = useFakeBusiness();
  const onboarding = useOnboarding();
  const session = useFakeSession();

  useEffect(() => {
    if (!business) {
      router.replace("/onboarding");
      return;
    }
    if (business.slug !== params.businessId) {
      router.replace(`/app/b/${business.slug}`);
    }
  }, [business, params.businessId, router]);

  if (!business) {
    return null;
  }

  const serviceCount = onboarding.services.reduce(
    (count, category) => count + category.services.length,
    0
  );

  const bookingUrl = onboarding.bookingUrl ?? business.bookingUrl;

  const handleSignOut = () => {
    session.logout();
    router.replace("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050F2C] via-[#071433] to-[#0B1D45] pb-20">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#050F2C]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-white/60 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              tithi.com
            </button>
            <div>
              <p className="text-xs uppercase tracking-wide text-white/50">Tithi Admin</p>
              <h1 className="font-display text-lg text-white">{business.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/60">
              Business switcher coming soon · one business per owner today
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleSignOut}
              className="text-white"
            >
              <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-6 pt-10">
        <section className="grid gap-6 md:grid-cols-[2fr,1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">Overview</h2>
                <p className="mt-1 text-sm text-white/60">
                  Manual capture by design. Money only moves when you press the buttons.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => window.open(bookingUrl, "_blank")}
                className="text-white"
              >
                <LinkIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                View booking page
              </Button>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <OverviewCard
                icon={<Building2 className="h-5 w-5 text-primary" aria-hidden="true" />}
                label="Location & contact"
                value={`${onboarding.location.city || "City"}, ${onboarding.location.stateProvince || "State"}`}
              />
              <OverviewCard
                icon={<CalendarCheck2 className="h-5 w-5 text-primary" aria-hidden="true" />}
                label="Services configured"
                value={`${serviceCount} services`}
              />
              <OverviewCard
                icon={<CreditCard className="h-5 w-5 text-primary" aria-hidden="true" />}
                label="Subscription state"
                value={formatSubscription(onboarding.paymentSetup)}
              />
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
              <p className="font-semibold text-white">Next steps</p>
              <ul className="mt-3 space-y-2 list-disc pl-5">
                <li>Money board coming soon — Completed, No-Show, Cancel, Refund buttons live here.</li>
                <li>Revisit onboarding tabs from the left navigation to tweak configuration.</li>
                <li>Export booking data and gift card ledgers once backend endpoints snap on.</li>
              </ul>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 h-4 w-4 text-primary" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-white">Policies snapshot</p>
                  <p className="mt-1 text-xs text-white/50">
                    Customers consented to these terms during checkout.
                  </p>
                  <ul className="mt-3 space-y-2 text-xs">
                    <li>{formatPolicySummary(onboarding.policies)}</li>
                    <li>Refund policy: {onboarding.policies.refundPolicy ? "Configured" : "Pending"}</li>
                    <li>Cash policy: {onboarding.policies.cashPolicy ? "Configured" : "Pending"}</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
              <div className="flex items-start gap-3">
                <ClipboardList className="mt-1 h-4 w-4 text-primary" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-white">Gift cards</p>
                  <p className="mt-1 text-xs text-white/50">
                    {onboarding.giftCards.enabled
                      ? `Enabled • ${onboarding.giftCards.amountType === "amount" ? `$${(onboarding.giftCards.amountValue / 100).toFixed(2)} amount` : `${onboarding.giftCards.amountValue}% discount`}`
                      : "Disabled"}
                  </p>
                  <HelperText className="mt-3">
                    Manage gift codes and ledgers once payment endpoints are wired.
                  </HelperText>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            <div>
              <h2 className="text-xl font-semibold text-white">What’s shipping next</h2>
              <p className="text-sm text-white/60">
                We’re polishing the money board, analytics, and booking exports. Fake data powers the
                surface now so backend can snap on without rework.
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-3 text-sm text-white/70">
            <div>
              <p className="font-semibold text-white">Past bookings</p>
              <p className="mt-2">
                Booking cards will show customer info, policy consent, and the four money buttons.
              </p>
            </div>
            <div>
              <p className="font-semibold text-white">Payments timeline</p>
              <p className="mt-2">
                Manual capture remains default. Platform fee 1% applies on capture, no-show, cancel.
              </p>
            </div>
            <div>
              <p className="font-semibold text-white">Notifications</p>
              <p className="mt-2">
                Templates you configured sync to backend triggers once hook jobs connect.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function OverviewCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
          {icon}
        </span>
        <div>
          <p className="text-xs uppercase tracking-wide text-white/50">{label}</p>
          <p className="text-sm font-semibold text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function formatSubscription(config: ReturnType<typeof useOnboarding>["paymentSetup"]) {
  switch (config.subscriptionStatus) {
    case "trial":
      return config.trialEndsAt
        ? `Trial until ${new Date(config.trialEndsAt).toLocaleDateString()}`
        : "Trial active";
    case "active":
      return config.nextBillDate
        ? `Active · next bill ${new Date(config.nextBillDate).toLocaleDateString()}`
        : "Active";
    case "paused":
      return "Paused · billing suspended";
    case "canceled":
      return "Canceled · subdomain queued for archive";
    default:
      return "Status pending";
  }
}

function formatPolicySummary(policies: ReturnType<typeof useOnboarding>["policies"]) {
  const cancel = policies.cancellationFeeValue
    ? `${policies.cancellationFeeType === "percent" ? `${policies.cancellationFeeValue}%` : `$${policies.cancellationFeeValue.toFixed(2)}`} cancel fee`
    : "Cancel free";
  const noShow = policies.noShowFeeValue
    ? `${policies.noShowFeeType === "percent" ? `${policies.noShowFeeValue}%` : `$${policies.noShowFeeValue.toFixed(2)}`} no-show fee`
    : "No-show free";
  return `${cancel} · ${noShow}`;
}


