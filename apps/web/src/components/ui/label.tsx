"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  helper?: string;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, helper, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          "flex flex-col text-sm font-medium text-white/80 gap-1",
          className
        )}
        {...props}
      >
        <span>{children}</span>
        {helper ? (
          <span className="text-xs font-normal text-white/50">{helper}</span>
        ) : null}
      </label>
    );
  }
);
Label.displayName = "Label";


