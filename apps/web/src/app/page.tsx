"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { LandingHero } from "@/components/landing/hero";
import { isCustomerDomain } from "@/lib/domain-utils";

/**
 * Root landing page - only shown on app domain (revol.app)
 * Customer domains (*.main.tld) are handled by middleware and routed to /tenant
 */
export default function LandingPage() {
  const router = useRouter();

  // Redirect customer domains to tenant page (handled by middleware, but double-check on client)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (isCustomerDomain(hostname)) {
        router.replace('/tenant');
      }
    }
  }, [router]);
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-black text-white">
      <header className="absolute left-1/2 top-6 z-20 w-full max-w-6xl -translate-x-1/2 px-6 lg:px-12">
        <nav className="flex items-center justify-between rounded-full border border-white/15 bg-black/70 px-6 py-4 backdrop-blur">
          <Link
            href="/"
            className="font-display text-2xl text-white transition hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            Revol
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm font-medium text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-glow-blue transition hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              Join Revol Now
            </Link>
          </div>
        </nav>
      </header>

      <LandingHero />

      <footer className="relative z-10 mx-auto mb-12 mt-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 rounded-3xl border border-white/10 bg-black/70 px-6 py-6 text-xs text-white/60 backdrop-blur sm:flex-row">
        <span>© {new Date().getFullYear()} Revol Corporation. All rights reserved.</span>
        <div className="flex items-center gap-4">
          <Link
            href="#"
            className="transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            Terms
          </Link>
          <Link
            href="#"
            className="transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            Privacy
          </Link>
        </div>
      </footer>
    </main>
  );
}

