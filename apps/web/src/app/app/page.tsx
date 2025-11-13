"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useFakeBusiness } from "@/lib/fake-business";

export default function AdminRedirectPage() {
  const router = useRouter();
  const { business } = useFakeBusiness();

  useEffect(() => {
    if (business) {
      router.replace(`/app/b/${business.slug}`);
    } else {
      router.replace("/onboarding");
    }
  }, [business, router]);

  return null;
}


