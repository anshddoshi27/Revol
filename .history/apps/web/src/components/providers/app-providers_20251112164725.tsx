"use client";

import * as React from "react";

import { ToastProvider } from "@/components/ui/toast";
import { FakeSessionProvider } from "@/lib/fake-session";
import { FakeBusinessProvider } from "@/lib/fake-business";
import { OnboardingProvider } from "@/lib/onboarding-context";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <FakeSessionProvider>
      <FakeBusinessProvider>
        <OnboardingProvider>
          <ToastProvider>{children}</ToastProvider>
        </OnboardingProvider>
      </FakeBusinessProvider>
    </FakeSessionProvider>
  );
}



