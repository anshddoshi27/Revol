"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/ui/helper-text";
import { useFakeBusiness } from "@/lib/fake-business";
import { getSubscriptionPlanName, getSubscriptionPlanPrice } from "@/lib/subscription-utils";
import { createClientClient } from "@/lib/supabase-client";

export default function AccountPage() {
  const router = useRouter();
  const params = useParams<{ businessId: string }>();
  const {
    business,
    workspace,
    setPayment,
    updateBusiness,
    clearBusiness
  } = useFakeBusiness();

  const [realBusiness, setRealBusiness] = useState<{
    notifications_enabled: boolean | null;
    subscription_status: string | null;
    trial_ends_at: string | null;
    next_bill_at: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const supabase = createClientClient();

  // Fetch real business data to get notifications_enabled
  useEffect(() => {
    async function fetchBusiness() {
      if (!params.businessId) return;
      
      try {
        const { data, error } = await supabase
          .from('businesses')
          .select('notifications_enabled, subscription_status, trial_ends_at, next_bill_at')
          .eq('id', params.businessId)
          .single();

        if (error) {
          console.error('Error fetching business:', error);
        } else if (data) {
          console.log('[account] Loaded business plan data from database:', {
            businessId: params.businessId,
            notifications_enabled: data.notifications_enabled,
            planType: data.notifications_enabled === true ? 'Pro' : 'Basic',
            subscription_status: data.subscription_status,
          });
          setRealBusiness(data);
        }
      } catch (error) {
        console.error('Error in fetchBusiness:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchBusiness();
  }, [params.businessId, supabase]);

  if (!workspace || !business) {
    return null;
  }

  const payment = workspace.payment;
  
  // Use ONLY database value - no fallback
  // The notifications_enabled flag determines the subscription plan
  // Basic Plan: notifications_enabled = true ($14.99/month) - only available plan
  // Pro Plan: coming soon (disabled)
  const notificationsEnabled = realBusiness?.notifications_enabled === true;

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

  const cancel = async () => {
    if (!params.businessId) return;
    
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        alert("You must be logged in to cancel your subscription.");
        return;
      }

      // Call the subscription cancellation API
      const response = await fetch(`/api/business/${params.businessId}/subscription`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'cancel' }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to cancel subscription');
      }

      // Update local state
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
      
      // Refresh business data from database
      const { data: businessData } = await supabase
        .from('businesses')
        .select('subscription_status, trial_ends_at, next_bill_at')
        .eq('id', params.businessId)
        .single();
      
      if (businessData) {
        setRealBusiness(businessData);
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
      alert(error instanceof Error ? error.message : 'Failed to cancel subscription. Please try again.');
    }
  };

  const deleteBusiness = async () => {
    if (!params.businessId || deleting) return;
    
    // Confirm deletion
    const confirmed = window.confirm(
      "Are you sure you want to delete your business? This action cannot be undone and will permanently delete all your data including services, staff, bookings, customers, and all related information."
    );
    
    if (!confirmed) return;

    setDeleting(true);

    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        alert("You must be logged in to delete your business.");
        setDeleting(false);
        return;
      }

      // Call the delete API endpoint
      const response = await fetch(`/api/business/${params.businessId}/delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete business');
      }

      // Clear local state
      clearBusiness();
      
      // Sign out the user
      await supabase.auth.signOut();
      
      // Redirect to signup page
      router.replace("/signup");
    } catch (error) {
      console.error('Error deleting business:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete business. Please try again.');
      setDeleting(false);
    }
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
                <dt>Plan</dt>
                <dd className="text-white font-semibold">
                  {/* Plan is determined by notifications_enabled flag from onboarding Step 8 */}
                  {/* Basic Plan ($14.99/month): notifications_enabled = true - only available plan */}
                  {/* Pro Plan: coming soon (disabled) */}
                  {getSubscriptionPlanName(notificationsEnabled)} - ${getSubscriptionPlanPrice(notificationsEnabled).toFixed(2)}/month
                </dd>
              </div>
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
          variant="outline"
          className="mt-4 border-rose-400/60 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
          onClick={deleteBusiness}
          disabled={deleting}
        >
          {deleting ? 'Deleting...' : 'Delete business'}
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

