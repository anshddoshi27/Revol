import { Hero } from "@/components/landing/hero";
import { SiteFooter } from "@/components/layout/site-footer";
import { TopNav } from "@/components/layout/top-nav";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <TopNav />
      <div className="relative flex min-h-screen flex-col">
        <Hero />
        <section
          id="join"
          className="container relative z-10 mb-24 mt-auto max-w-4xl overflow-hidden rounded-3xl border border-white/5 bg-white/5 p-10 text-center shadow-2xl backdrop-blur"
        >
          <h2 className="font-display text-3xl font-semibold text-white">
            Ready to rebuild your booking flow?
          </h2>
          <p className="mt-4 text-white/70">
            Join the waitlist to get early access to Tithi. We’ll reach out with
            onboarding instructions as soon as your spot opens.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-surface/80 p-6 text-left">
              <p className="text-sm uppercase tracking-wide text-white/50">
                Coming Soon
              </p>
              <p className="mt-2 text-lg font-medium text-white">
                Owner onboarding preview
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-surface/80 p-6 text-left">
              <p className="text-sm uppercase tracking-wide text-white/50">
                Available Now
              </p>
              <p className="mt-2 text-lg font-medium text-white">
                Product walkthrough & sandbox
              </p>
            </div>
          </div>
        </section>
        <SiteFooter />
      </div>
    </main>
  );
}

