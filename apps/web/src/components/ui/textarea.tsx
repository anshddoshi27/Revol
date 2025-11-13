"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, rows = 4, ...props }, ref) => {
    return (
      <div className="relative">
        <textarea
          ref={ref}
          className={cn(
            "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white/90 transition",
            "placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
            "disabled:cursor-not-allowed disabled:opacity-60",
            error && "border-red-400/60 focus-visible:ring-red-400",
            className
          )}
          rows={rows}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${props.id}-error` : props["aria-describedby"]}
          {...props}
        />
      </div>
    );
  }
);
Textarea.displayName = "Textarea";




