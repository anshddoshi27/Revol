"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useParams } from "next/navigation";
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  BookOpenCheck,
  CalendarRange,
  CreditCard,
  Gift,
  Layers3,
  LayoutDashboard,
  LifeBuoy,
  Settings2,
  UsersRound
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFakeBusiness } from "@/lib/fake-business";
import { useFakeSession } from "@/lib/fake-session";

const NAV_ITEMS = [
  {
    label: "Past bookings",
    segment: "",
    icon: <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
  },
  {
    label: "Calendar",
    segment: "calendar",
    icon: <CalendarRange className="h-4 w-4" aria-hidden="true" />
  },
  {
    label: "Analytics",
    segment: "analytics",
    icon: <BarChart3 className="h-4 w-4" aria-hidden="true" />
  },
  {
    label: "Catalog",
    segment: "catalog",
    icon: <Layers3 className="h-4 w-4" aria-hidden="true" />
  },
  {
    label: "Staff",
    segment: "staff",
    icon: <UsersRound className="h-4 w-4" aria-hidden="true" />
  },
  {
    label: "Availability",
    segment: "availability",
    icon: <Activity className="h-4 w-4" aria-hidden="true" />
  },
  {
    label: "Notifications",
    segment: "notifications",
    icon: <LifeBuoy className="h-4 w-4" aria-hidden="true" />
  },
  {
    label: "Policies",
    segment: "policies",
    icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
  },
  {
    label: "Gift cards",
    segment: "gift-cards",
    icon: <Gift className="h-4 w-4" aria-hidden="true" />
  },
  {
    label: "Payments",
    segment: "payments",
    icon: <CreditCard className="h-4 w-4" aria-hidden="true" />
  },
  {
    label: "Customers",
    segment: "customers",
    icon: <BadgeDollarSign className="h-4 w-4" aria-hidden="true" />
  },
  {
    label: "Account",
    segment: "account",
    icon: <Settings2 className="h-4 w-4" aria-hidden="true" />
  }
] as const;

export default function AdminBusinessLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const params = useParams<{ businessId: string }>();
  const pathname = usePathname();
  const session = useFakeSession();
  const { business, workspace } = useFakeBusiness();

  useEffect(() => {
    if (!session.isAuthenticated) {
      router.replace("/login");
    }
  }, [session.isAuthenticated, router]);

  useEffect(() => {
    if (!business) {
      router.replace("/onboarding");
      return;
    }
    if (business.slug !== params.businessId) {
      router.replace(`/app/b/${business.slug}`);
    }
  }, [business, params.businessId, router]);

  const activeSegment = useMemo(() => {
    if (!pathname) return "";
    const segments = pathname.split("/");
    return segments[segments.length - 1] === params.businessId ? "" : segments.at(-1) ?? "";
  }, [pathname, params.businessId]);

  if (!business || !workspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="space-y-4 text-center text-white/60">
          <p className="text-sm uppercase tracking-[0.35em] text-white/40">Tithi Admin</p>
          <p className="font-display text-2xl text-white">Preparing your workspace…</p>
        </div>
      </div>
    );
  }

  const displayBookingUrl =
    workspace.identity.website.subdomain.length > 0
      ? `https://${workspace.identity.website.subdomain}.tithi.com`
      : business.bookingUrl;
  const previewUrl = business.previewUrl ?? `/public/${business.slug}`;

  const handleSignOut = () => {
    session.logout();
    router.replace("/");
  };

  return (
    <div className="flex min-h-screen bg-black text-white">
      <aside className="hidden min-w-[260px] border-r border-white/10 bg-black/80 backdrop-blur lg:flex lg:flex-col">
        <header className="border-b border-white/10 px-6 py-6">
          <p className="text-xs uppercase tracking-[0.3em] text-white/40">Tithi Admin</p>
          <h1 className="mt-2 font-display text-xl text-white">{workspace.identity.business.businessName}</h1>
          <p className="mt-2 text-xs text-white/50">
            Manual capture only. Money moves when you press the buttons.
          </p>
        </header>
        <nav className="flex-1 overflow-y-auto px-4 py-6">
          <ul className="space-y-2">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSegment === item.segment;
              const href =
                item.segment.length > 0
                  ? `/app/b/${business.slug}/${item.segment}`
                  : `/app/b/${business.slug}`;
              return (
                <li key={item.segment}>
                  <Link
                    href={href}
                    className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                      isActive
                        ? "bg-primary/20 text-white shadow-[0_0_0_1px_rgba(91,100,255,0.35)]"
                        : "text-white/60 hover:bg-black/60 hover:text-white"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-xl border ${
                        isActive ? "border-primary/40 bg-primary/15 text-white" : "border-white/10 bg-black/60 text-white/60 group-hover:text-white"
                      }`}
                    >
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <footer className="border-t border-white/10 px-6 py-5">
          <div className="rounded-2xl border border-white/10 bg-black/70 px-4 py-4 text-xs text-white/60">
            <p className="font-semibold text-white">Business switcher</p>
            <p className="mt-1">Single business per owner in Phase 3. More coming soon.</p>
          </div>
        </footer>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-black/80 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-4 sm:px-8">
            <div className="flex items-center gap-4">
              <div className="lg:hidden">
                <p className="text-xs uppercase tracking-[0.3em] text-white/40">Tithi Admin</p>
                <h1 className="font-display text-lg text-white">
                  {workspace.identity.business.businessName}
                </h1>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => window.open(previewUrl, "_blank")}
                className="hidden items-center gap-2 rounded-full border border-white/15 bg-black/60 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/25 hover:text-white lg:inline-flex"
              >
                Open booking page
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-xs text-white/60 sm:flex">
                <span
                  className={`h-2 w-2 rounded-full ${
                    business.status === "canceled"
                      ? "bg-rose-400"
                      : business.status === "paused"
                      ? "bg-amber-300"
                      : "bg-emerald-400"
                  }`}
                  aria-hidden="true"
                />
                {business.status.charAt(0).toUpperCase() + business.status.slice(1)}
              </div>
              <Button type="button" variant="outline" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pb-16 pt-8 sm:px-8">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

