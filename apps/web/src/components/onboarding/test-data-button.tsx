"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Test Data Button Component
 * 
 * Shows a "Fill with Test Data" button that populates the form with unique test data.
 * Only visible in development mode.
 */
interface TestDataButtonProps {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
}

export function TestDataButton({ onClick, label = "Fill with Test Data", disabled }: TestDataButtonProps) {
  // Only show in development
  // Check both server and client-side ways to detect dev mode
  const isDevelopment = 
    typeof process !== "undefined" && process.env.NODE_ENV === "development" ||
    typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  
  if (!isDevelopment) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className="group relative border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary/80 hover:text-primary transition-colors"
    >
      <Sparkles className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}

