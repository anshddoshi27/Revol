"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  textColor?: string;
  borderColor?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error, textColor, borderColor, style, ...props }, ref) => {
    return (
      <div className="relative">
        <input
          type={type}
          className={cn(
            "flex h-12 w-full rounded-xl border bg-white/5 px-4 text-base transition",
            borderColor ? "" : "border-white/10",
            textColor ? "" : "text-white/90",
            "placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
            "disabled:cursor-not-allowed disabled:opacity-60",
            error && "border-red-400/60 focus-visible:ring-red-400",
            className
          )}
          style={{
            ...(textColor ? { color: textColor } : {}),
            ...(borderColor ? { borderColor: borderColor } : {}),
            ...style,
          }}
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




