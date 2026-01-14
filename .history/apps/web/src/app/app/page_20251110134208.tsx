"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/ui/helper-text";
import { useToast } from "@/components/ui/toast";
import { useFakeSession } from "@/lib/fake-session";

export default function AdminPlaceholderPage() {
  const session = useFakeSession();
  const toast = useToast();
  const router = useRouter();

  const handleLogout = () => {
    session.logout();
    toast.pushToast({
      title: "Signed out",
      description: "Come back soon to keep building your business workspace.",
      intent: "info"
    });
    router.push("/");
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
      <div className="glass-panel w-full max-w-3xl rounded-3xl border border-white/10 px-10 py-16 shadow-glow-blue">
        <Badge intent="info" className="mx-auto mb-4">
          Admin Preview
        </Badge>
        <h1 className="font-display text-4xl text-white">
          Admin coming soon
        </h1>
        <p className="mt-4 text-base text-white/70">
          We’re focusing on the onboarding experience first. The full admin workspace will
          unlock in Phase 2 with dashboards, booking controls, and payment history.
        </p>
        <HelperText className="mt-6 text-sm text-white/50">
          Need to revisit onboarding? Head there below or return to the landing page.
        </HelperText>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/onboarding"
            className="rounded-full border border-white/10 px-5 py-2 text-sm font-semibold text-white/80 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            Continue onboarding
          </Link>
          <Link
            href="/"
            className="rounded-full px-5 py-2 text-sm font-semibold text-white/60 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            Return home
          </Link>
          <Button
            type="button"
            variant="outline"
            onClick={handleLogout}
            className="text-white"
          >
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </div>
    </main>
  );
}



