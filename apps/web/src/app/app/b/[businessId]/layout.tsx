"use client";

import { useEffect, useMemo, useState } from "react";
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
import { createClientClient } from "@/lib/supabase-client";
import type { User } from "@supabase/supabase-js";

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
  const { business: fakeBusiness, workspace, loadSeedBusiness } = useFakeBusiness();
  
  const [user, setUser] = useState<User | null>(null);
  const [realBusiness, setRealBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const supabase = createClientClient();

  // Check authentication and fetch business
  useEffect(() => {
    let cancelled = false;

    // Don't run if we're already redirecting
    if (isRedirecting) {
      return;
    }

    async function checkAuth() {
      try {
        console.log('Checking authentication...');
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
        
        if (cancelled) return;

        if (authError) {
          console.error('Auth error:', authError);
          setError(`Authentication error: ${authError.message}`);
          router.replace("/login");
          return;
        }

        if (!currentUser) {
          console.log('No authenticated user, redirecting to login');
          router.replace("/login");
          return;
        }

        console.log('User authenticated:', currentUser.email);
        setUser(currentUser);

        // Check if businessId is a UUID or subdomain
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.businessId);
        
        // Fetch business from database
        console.log('Fetching business:', params.businessId, isUUID ? '(UUID)' : '(subdomain)');
        
        let businessQuery = supabase
          .from('businesses')
          .select('id, name, subdomain, user_id')
          .eq('user_id', currentUser.id)
          .is('deleted_at', null);
        
        // Query by ID if UUID, otherwise by subdomain
        if (isUUID) {
          businessQuery = businessQuery.eq('id', params.businessId);
        } else {
          businessQuery = businessQuery.eq('subdomain', params.businessId);
        }
        
        const { data: businessData, error: businessError } = await businessQuery.maybeSingle();

        if (cancelled) return;

        if (businessError) {
          console.error('Error fetching business:', businessError);
          setError(`Business query error: ${businessError.message}`);
          // Don't redirect immediately - let user see the error
          setLoading(false);
          return;
        }

        if (!businessData) {
          console.log('Business not found for user:', currentUser.id, 'businessId:', params.businessId);
          // Try to find any business for this user
          const { data: anyBusiness } = await supabase
            .from('businesses')
            .select('id, name, subdomain, user_id')
            .eq('user_id', currentUser.id)
            .is('deleted_at', null)
            .maybeSingle();
          
          if (anyBusiness) {
            console.log('Found different business, redirecting:', anyBusiness.id);
            router.replace(`/app/b/${anyBusiness.id}`);
            return;
          }
          
          console.log('No business found, redirecting to onboarding');
          router.replace("/onboarding");
          return;
        }

        console.log('Business found:', businessData.name);
        setRealBusiness(businessData);
        
        // If URL uses subdomain but we have UUID, redirect to UUID
        // Only redirect if we're actually using a subdomain (not UUID)
        if (!isUUID && businessData.id !== params.businessId) {
          // Prevent redirect loops - check if we're already on the correct path
          const currentPath = pathname || '';
          const expectedPath = currentPath.replace(`/app/b/${params.businessId}`, `/app/b/${businessData.id}`);
          
          // Only redirect if we're not already on the correct path
          if (currentPath !== expectedPath && !isRedirecting) {
            setIsRedirecting(true);
            // Split path: /app/b/novastudio/calendar -> ['', 'app', 'b', 'novastudio', 'calendar']
            const pathParts = currentPath.split('/');
            // Get everything after /app/b/{businessId} (skip first 4 parts: '', 'app', 'b', 'novastudio')
            const pathAfterBusiness = pathParts.slice(4).filter(Boolean).join('/');
            const redirectPath = pathAfterBusiness 
              ? `/app/b/${businessData.id}/${pathAfterBusiness}` 
              : `/app/b/${businessData.id}`;
            console.log('Redirecting from subdomain to UUID:', {
              from: currentPath,
              to: redirectPath,
              pathAfterBusiness,
              pathParts
            });
            // Use window.location for a hard redirect to avoid React Router issues
            window.location.href = redirectPath;
            return;
          }
        }
        
        // Load fake workspace data if not already loaded
        // This is temporary until we migrate all pages to use real data
        if (!fakeBusiness || !workspace) {
          console.log('Loading seed business data...');
          try {
            // Load default seed data - this matches what the seed script creates
            const seedResult = loadSeedBusiness();
            if (seedResult) {
              console.log('Seed business loaded:', seedResult.business.name);
            }
          } catch (seedError) {
            console.warn('Failed to load seed business:', seedError);
            // Continue anyway - pages might work without it
          }
        }
        
        setLoading(false);
      } catch (error) {
        if (cancelled) return;
        console.error('Auth check error:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
        setLoading(false);
      }
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [params.businessId, router, supabase, isRedirecting]);

  // Use fake business for now (until we migrate all pages to use real data)
  const business = fakeBusiness;

  const activeSegment = useMemo(() => {
    if (!pathname) return "";
    const segments = pathname.split("/");
    return segments[segments.length - 1] === params.businessId ? "" : segments.at(-1) ?? "";
  }, [pathname, params.businessId]);

  // Filter nav items based on business settings
  // Hide notifications page if notifications are not enabled
  // Note: In production, this should come from the database businesses table
  const visibleNavItems = useMemo(() => {
    // For now, we'll assume notifications are enabled if workspace exists
    // In production, check business.notifications_enabled from database
    const notificationsEnabled = true; // TODO: Get from business data
    return NAV_ITEMS.filter(item => {
      if (item.segment === "notifications" && !notificationsEnabled) {
        return false;
      }
      return true;
    });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="space-y-4 text-center text-white/60">
          <p className="text-sm uppercase tracking-[0.35em] text-white/40">Tithi Admin</p>
          <p className="font-display text-2xl text-white">Preparing your workspace…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="space-y-4 text-center text-white/60">
          <p className="text-sm uppercase tracking-[0.35em] text-white/40">Tithi Admin</p>
          <p className="font-display text-2xl text-white">Error loading business</p>
          <p className="text-sm text-rose-400">{error}</p>
          <Button onClick={() => router.push("/login")} variant="outline" className="mt-4">
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  if (!user || !realBusiness) {
    return null; // Will redirect via useEffect
  }

  // For now, use fake business/workspace until we migrate all pages
  // But don't block rendering if fake data isn't available
  if (!business || !workspace) {
    // Still render the layout with real business data
    // The pages will need to be updated to use real data
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="space-y-4 text-center text-white/60">
          <p className="text-sm uppercase tracking-[0.35em] text-white/40">Tithi Admin</p>
          <p className="font-display text-2xl text-white">Loading workspace data…</p>
          <p className="text-sm text-white/40">Business: {realBusiness.name}</p>
        </div>
      </div>
    );
  }

  const displayBookingUrl =
    workspace.identity.website.subdomain.length > 0
      ? `https://${workspace.identity.website.subdomain}.tithi.com`
      : business.bookingUrl;
  const previewUrl = business.previewUrl ?? `/public/${business.slug}`;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
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
            {visibleNavItems.map((item) => {
              const isActive = activeSegment === item.segment;
              // Use realBusiness.id (UUID) for navigation, not business.slug (subdomain)
              const businessIdForNav = realBusiness?.id || business?.slug || params.businessId;
              const href =
                item.segment.length > 0
                  ? `/app/b/${businessIdForNav}/${item.segment}`
                  : `/app/b/${businessIdForNav}`;
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
                aria-label={`Open booking page (${displayBookingUrl})`}
                title={displayBookingUrl}
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

