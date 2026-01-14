import Link from "next/link";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/ui/helper-text";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
      <div className="glass-panel w-full max-w-lg rounded-3xl border border-white/10 px-8 py-14 shadow-glow-blue">
        <Compass className="mx-auto h-10 w-10 text-white/60" aria-hidden="true" />
        <h1 className="mt-6 font-display text-4xl text-white">Page not found</h1>
        <p className="mt-3 text-base text-white/60">
          We couldn’t find that route. It may be part of a future onboarding step or a typo in
          the URL.
        </p>
        <HelperText className="mt-5 text-sm text-white/50">
          Tip: keep the landing, login, and sign-up pages bookmarked during Phase 1 QA.
        </HelperText>
        <Button asChild className="mt-8">
          <Link href="/">Return to landing</Link>
        </Button>
      </div>
    </main>
  );
}




