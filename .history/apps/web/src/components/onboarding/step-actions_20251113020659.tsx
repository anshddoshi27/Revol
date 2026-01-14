"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";

interface StepActionsProps {
  onBack?: () => void;
  onNext: () => void | Promise<void>;
  nextLabel?: string;
  isNextDisabled?: boolean;
  isSubmitting?: boolean;
  showBack?: boolean;
  finish?: boolean;
}

export function StepActions({
  onBack,
  onNext,
  nextLabel = "Save & continue",
  isNextDisabled,
  isSubmitting,
  showBack = true,
  finish = false
}: StepActionsProps) {
  return (
    <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
      <div>{/* spacer */}</div>
      <div className="flex items-center gap-3">
        {showBack ? (
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="text-white"
            disabled={isSubmitting}
          >
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Back
          </Button>
        ) : null}
        <Button
          type="button"
          onClick={onNext}
          disabled={isNextDisabled || isSubmitting}
          isLoading={isSubmitting}
          className="text-base"
        >
          <span className="flex items-center gap-2">
            {finish ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
            {finish ? "Launch business" : nextLabel}
            {!finish ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
          </span>
        </Button>
      </div>
    </div>
  );
}



