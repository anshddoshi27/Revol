"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type BadgeIntent = "info" | "warning" | "success";

const intentStyles: Record<BadgeIntent, string> = {
  info: "bg-white/10 text-white/80 border-white/20",
  warning: "bg-amber-500/10 text-amber-200 border-amber-300/40",
  success: "bg-emerald-500/10 text-emerald-200 border-emerald-300/40"
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  intent?: BadgeIntent;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, intent = "info", children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
          intentStyles[intent],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);
Badge.displayName = "Badge";



