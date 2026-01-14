"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/ui/helper-text";
import { useFakeBusiness } from "@/lib/fake-business";

export default function AccountPage() {
  const router = useRouter();
  const {
    business,
    workspace,
    setPayment,
    updateBusiness,
    clearBusiness
  } = useFakeBusiness();

  if (!workspace || !business) {
    return null;
  }

  const payment = workspace.payment;

  const startTrial = () => {
    const trialEnds = addDays(new Date(), 7);
    setPayment((prev) => ({
      ...prev,
      subscriptionStatus: "trial",
      trialEndsAt: trialEnds,
      nextBillDate: trialEnds,
      startedTrialAt: new Date().toISOString(),
      lastStatusChangeAt: new Date().toISOString()
    }));
    updateBusiness({
      status: "trial",
      trialEndsAt: trialEnds,
      nextBillDate: trialEnds
    });
  };

  const activate = () => {
    const nextBill = addDays(new Date(), 30);
    setPayment((prev) => ({
      ...prev,
      subscriptionStatus: "active",
      trialEndsAt: undefined,
      nextBillDate: nextBill,
      lastStatusChangeAt: new Date().toISOString()
    }));
    updateBusiness({
      status: "active",
      trialEndsAt: undefined,
      nextBillDate: nextBill
    });
  };

  const pause = () => {
    setPayment((prev) => ({
      ...prev,
      subscriptionStatus: "paused",
      lastStatusChangeAt: new Date().toISOString()
    }));
    updateBusiness({
      status: "paused"
    });
  };

  const cancel = () => {
    setPayment((prev) => ({
      ...prev,
      subscriptionStatus: "canceled",
      nextBillDate: undefined,
      lastStatusChangeAt: new Date().toISOString()
    }));
    updateBusiness({
      status: "canceled",
      nextBillDate: undefined
    });
  };

  const deleteBusiness = () => {
    clearBusiness();
    router.replace("/onboarding");
  };

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.35em] text-white/40">Account</p>
        <h1 className="font-display text-4xl text-white">Subscription controls</h1>
        <p className="max-w-3xl text-sm text-white/60">
          Owners manage their own billing lifecycle. Trial gives seven days before the first charge.
          Cancel before the bill date to avoid any card hits — the platform immediately marks the
          business inactive and schedules data retention.
        </p>
      </header>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-lg font-semibold text-white">Current status</h2>
            <dl className="mt-4 space-y-3 text-sm text-white/70">
              <div className="flex items-center justify-between">
                <dt>Status</dt>
                <dd className="capitalize text-white">{payment.subscriptionStatus}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Trial ends</dt>
                <dd>{payment.trialEndsAt ? formatDate(payment.trialEndsAt) : "—"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Next bill</dt>
                <dd>{payment.nextBillDate ? formatDate(payment.nextBillDate) : "—"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Keep site live when paused</dt>
                <dd>{payment.keepSiteLiveWhenPaused ? "Yes" : "No"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Pay link automation</dt>
                <dd>{payment.payLinkAutomationEnabled ? "Enabled" : "Disabled"}</dd>
              </div>
            </dl>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Actions</h2>
            <div className="mt-4 grid gap-3">
              <Button
                type="button"
                onClick={startTrial}
                disabled={payment.subscriptionStatus === "trial"}
              >
                Start trial (+7 days)
              </Button>
              <Button
                type="button"
                onClick={activate}
                disabled={payment.subscriptionStatus === "active"}
              >
                Activate subscription
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={pause}
                disabled={payment.subscriptionStatus !== "active"}
              >
                Pause billing
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-amber-300 hover:text-amber-200"
                onClick={cancel}
                disabled={payment.subscriptionStatus === "canceled"}
              >
                Cancel subscription
              </Button>
            </div>
            <HelperText className="mt-3">
              Cancel before the bill date to avoid any charges. The site deactivates immediately and the
              money board becomes read-only.
            </HelperText>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold text-white">Danger zone</h2>
        <p className="mt-2 text-sm text-white/60">
          Delete wipes fake data in this demo. In production we&apos;ll soft-delete first, honour
          retention, and queue archival jobs.
        </p>
        <Button
          type="button"
          variant="destructive"
          className="mt-4 bg-rose-500 text-white hover:bg-rose-400"
          onClick={deleteBusiness}
        >
          Delete business
        </Button>
      </section>
    </div>
  );
}

function addDays(date: Date, days: number): string {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy.toISOString();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

