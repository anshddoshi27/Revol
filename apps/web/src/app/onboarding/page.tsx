"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Home } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/ui/helper-text";
import { useToast } from "@/components/ui/toast";

export default function OnboardingPlaceholderPage() {
  const router = useRouter();
  const toast = useToast();

  const handleGoToAdmin = () => {
    toast.pushToast({
      title: "Admin preview",
      description: "We’ll send you to the admin placeholder while we wire up onboarding.",
      intent: "info"
    });
    router.push("/app");
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
      <div className="glass-panel w-full max-w-3xl rounded-3xl border border-white/10 px-10 py-16 shadow-glow-blue">
        <Badge intent="info" className="mx-auto mb-4">
          Onboarding Preview
        </Badge>
        <h1 className="font-display text-4xl text-white">Onboarding coming soon</h1>
        <p className="mt-4 text-base text-white/70">
          We’re planning the 8-step onboarding wizard next. For now, this page confirms your
          fake session works and will hand you off to the admin shell when ready.
        </p>
        <HelperText className="mt-6 text-sm text-white/50">
          Your session state is saved in-memory, so refreshing will reset access. That’s
          expected for Phase 1.
        </HelperText>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button type="button" onClick={handleGoToAdmin} className="text-base">
            <ArrowRight className="mr-2 h-4 w-4" aria-hidden="true" />
            View admin placeholder
          </Button>
          <Link
            href="/"
            className="rounded-full px-5 py-2 text-sm font-semibold text-white/60 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            <Home className="mr-2 inline h-4 w-4" aria-hidden="true" />
            Return home
          </Link>
        </div>
      </div>
    </main>
  );
}


