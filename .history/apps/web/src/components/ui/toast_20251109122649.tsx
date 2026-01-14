"use client";

import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

type ToastIntent = "info" | "success" | "error";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  intent?: ToastIntent;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  pushToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const pushToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, intent: "info", duration: 4000, ...toast }]);
  }, []);

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  React.useEffect(() => {
    if (toasts.length === 0) return;

    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        dismissToast(toast.id);
      }, toast.duration)
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [toasts, dismissToast]);

  const value = React.useMemo(
    () => ({
      toasts,
      pushToast,
      dismissToast
    }),
    [toasts, pushToast, dismissToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-6 right-6 flex w-full max-w-sm flex-col gap-3 md:bottom-8 md:right-8"
        aria-live="assertive"
        role="status"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const intentStyles: Record<ToastIntent, string> = {
    info: "border-white/20 text-white/90",
    success: "border-emerald-300/50 text-emerald-100",
    error: "border-rose-400/60 text-rose-100"
  };

  return (
    <div
      className={cn(
        "pointer-events-auto glass-panel relative flex w-full flex-col gap-1 rounded-2xl border px-5 py-4 shadow-xl transition",
        intentStyles[toast.intent ?? "info"]
      )}
    >
      <button
        className="absolute right-3 top-3 rounded-full p-1 text-white/50 transition hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>

      {toast.title ? (
        <p className="pr-6 text-sm font-semibold uppercase tracking-wide text-white/80">
          {toast.title}
        </p>
      ) : null}
      {toast.description ? (
        <p className="pr-6 text-sm text-white/70">{toast.description}</p>
      ) : null}
    </div>
  );
}


