"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientClient } from "@/lib/supabase-client";

export default function AdminRedirectPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkBusiness() {
      try {
        const supabase = createClientClient();
        
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          // Not authenticated - redirect to login
          router.replace("/login");
          return;
        }

        // Fetch user's business
        const { data: business, error: businessError } = await supabase
          .from('businesses')
          .select('id, subdomain, name')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .maybeSingle();

        if (businessError) {
          console.error('Error fetching business:', businessError);
          router.replace("/onboarding");
          return;
        }

    if (business) {
          // Business exists - redirect to admin
          router.replace(`/app/b/${business.id}`);
    } else {
          // No business - redirect to onboarding
      router.replace("/onboarding");
    }
      } catch (error) {
        console.error('Error in admin redirect:', error);
        router.replace("/login");
      } finally {
        setIsLoading(false);
      }
    }

    checkBusiness();
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  return null;
}


