"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, ShieldAlert } from "lucide-react";

import { PublicBookingExperience } from "@/components/public-booking/booking-flow";
import { Button } from "@/components/ui/button";
import { useFakeBusiness } from "@/lib/fake-business";

interface PublicBookingPageProps {
  params: {
    slug: string;
  };
}

export default function PublicBookingPage({ params }: PublicBookingPageProps) {
  const slug = (params.slug || "").toLowerCase();
  const { business, workspace, loadSeedBusiness, recordPublicBooking } = useFakeBusiness();
  const [attemptedSeed, setAttemptedSeed] = useState(false);

  useEffect(() => {
    if (!business && slug === "novastudio" && !attemptedSeed) {
      loadSeedBusiness();
      setAttemptedSeed(true);
    }
  }, [business, slug, attemptedSeed, loadSeedBusiness]);

  if (!business || !workspace || business.slug !== slug) {
    if (business && business.slug !== slug) {
      return (
        <StatusScreen
          icon={<AlertCircle className="h-10 w-10 text-white/70" aria-hidden="true" />}
          title="Booking page not found"
          description="We couldn’t find a live booking site for this link. Double-check the URL or ask the business owner to publish their site."
        />
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4 text-white/60">
          <Loader2 className="h-10 w-10 animate-spin text-white/80" aria-hidden="true" />
          <p className="text-sm uppercase tracking-[0.35em] text-white/40">Preparing booking site</p>
        </div>
      </div>
    );
  }

  if (business.status === "canceled") {
    return (
      <StatusScreen
        icon={<ShieldAlert className="h-10 w-10 text-white/70" aria-hidden="true" />}
        title={`${business.name} is offline`}
        description="This business paused or canceled their subscription, so the booking site is temporarily unavailable."
      />
    );
  }

  return (
    <PublicBookingExperience
      business={business}
      workspace={workspace}
      recordBooking={recordPublicBooking}
    />
  );
}

function StatusScreen({
  icon,
  title,
  description
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black via-slate-950 to-black px-6 text-white">
      <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-10 text-center backdrop-blur">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
          {icon}
        </div>
        <h1 className="mt-6 font-display text-3xl">{title}</h1>
        <p className="mt-3 text-sm text-white/60">{description}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button asChild variant="outline" className="border-white/20 text-white/70 hover:text-white">
            <Link href="/">Return to Tithi</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}


