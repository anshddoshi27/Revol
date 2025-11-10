"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error, ...props }, ref) => {
    return (
      <div className="relative">
        <input
          type={type}
          className={cn(
            "flex h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-base text-white/90 transition",
            "placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
            "disabled:cursor-not-allowed disabled:opacity-60",
            error && "border-red-400/60 focus-visible:ring-red-400",
            className
          )}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${props.id}-error` : props["aria-describedby"]}
          ref={ref}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = "Input";



