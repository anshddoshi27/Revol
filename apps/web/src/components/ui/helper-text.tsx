"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface HelperTextProps
  extends React.HTMLAttributes<HTMLParagraphElement> {
  intent?: "default" | "error" | "success";
}

export const HelperText = React.forwardRef<HTMLParagraphElement, HelperTextProps>(
  ({ className, children, intent = "default", ...props }, ref) => {
    const intentClass =
      intent === "error"
        ? "text-red-300"
        : intent === "success"
          ? "text-emerald-300"
          : "text-white/60";

    return (
      <p
        ref={ref}
        className={cn("text-xs leading-relaxed", intentClass, className)}
        {...props}
      >
        {children}
      </p>
    );
  }
);
HelperText.displayName = "HelperText";



