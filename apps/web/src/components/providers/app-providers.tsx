"use client";

import * as React from "react";

import { ToastProvider } from "@/components/ui/toast";
import { FakeSessionProvider } from "@/lib/fake-session";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <FakeSessionProvider>
      <ToastProvider>{children}</ToastProvider>
    </FakeSessionProvider>
  );
}



