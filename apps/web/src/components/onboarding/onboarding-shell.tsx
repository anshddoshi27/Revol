"use client";

import * as React from "react";
import { CheckCircle2, Circle } from "lucide-react";
import clsx from "clsx";

import { Badge } from "@/components/ui/badge";
import { HelperText } from "@/components/ui/helper-text";
import type { OnboardingStepId } from "@/lib/onboarding-context";

interface StepMeta {
  id: OnboardingStepId;
  title: string;
  subtitle: string;
}

interface OnboardingShellProps {
  steps: StepMeta[];
  currentStep: OnboardingStepId;
  completedSteps: OnboardingStepId[];
  onNavigate: (step: OnboardingStepId) => void;
  children: React.ReactNode;
}

export function OnboardingShell({
  steps,
  currentStep,
  completedSteps,
  onNavigate,
  children
}: OnboardingShellProps) {
  const [mounted, setMounted] = React.useState(false);
  
  // Avoid hydration mismatch by only calculating progress on client
  React.useEffect(() => {
    setMounted(true);
  }, []);
  
  const currentIndex = steps.findIndex((step) => step.id === currentStep);
  const progressPercent = mounted ? Math.round(((currentIndex + 1) / steps.length) * 100) : 0;

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#020817] via-[#050F2C] to-[#0B1D45] pb-24">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(91,100,255,0.25),_transparent_65%)]" />
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 pt-24 lg:flex-row lg:gap-14 lg:px-12">
        <aside className="lg:w-72">
          <Badge intent="info" className="mb-4">
            Onboarding · {progressPercent}% complete
          </Badge>
          <h1 className="font-display text-4xl text-white">Let’s set up your business</h1>
          <HelperText className="mt-2 max-w-sm text-sm text-white/60">
            Progress autosaves. You can revisit any step before going live. Nothing charges
            customers until the money buttons in admin.
          </HelperText>

          <nav
            className="mt-10 space-y-2 rounded-3xl border border-white/10 bg-white/5/40 p-2 backdrop-blur-xl"
            aria-label="Onboarding steps"
          >
            {steps.map((step, index) => {
              const isCompleted = completedSteps.includes(step.id);
              const isActive = step.id === currentStep;
              const disabled = !isActive && index > currentIndex + 1;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    if (!disabled) {
                      onNavigate(step.id);
                    }
                  }}
                  className={clsx(
                    "group flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                    isActive
                      ? "bg-white/15 text-white shadow-lg shadow-primary/20"
                      : "text-white/65 hover:bg-white/10",
                    disabled && "cursor-not-allowed opacity-60"
                  )}
                  aria-current={isActive ? "step" : undefined}
                  disabled={disabled}
                >
                  <span className="mt-1 text-primary">
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Circle className="h-5 w-5" aria-hidden="true" />
                    )}
                  </span>
                  <span>
                    <span className="block font-semibold">{step.title}</span>
                    <span className="mt-0.5 block text-xs text-white/55">{step.subtitle}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="flex-1">
          <div className="glass-panel relative rounded-3xl border border-white/10 p-8 shadow-glow-blue lg:p-10">
            <div
              className="absolute inset-x-10 top-0 h-1 rounded-b-full bg-gradient-to-r from-primary via-primary/60 to-primary/90"
              style={{ width: `${progressPercent}%` }}
              aria-hidden="true"
            />
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}





