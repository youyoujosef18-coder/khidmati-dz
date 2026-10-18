"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastItem = { id: number; message: string; tone: "success" | "error" | "info" };
const ToastCtx = createContext<(message: string, tone?: ToastItem["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((message: string, tone: ToastItem["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s.slice(-2), { id, message, tone }]);
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), tone === "error" ? 7000 : 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {items.map((i) => (
          <div
            key={i.id}
            role={i.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border bg-surface px-4 py-3 text-sm shadow-overlay animate-slide-up",
              i.tone === "error" ? "border-error/30" : "border-border",
            )}
          >
            {i.tone === "error" ? (
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-error" aria-hidden />
            ) : (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
            )}
            <p className="flex-1 text-text">{i.message}</p>
            <button
              type="button"
              className="-m-1 rounded p-1 text-muted hover:bg-ink/5"
              onClick={() => setItems((s) => s.filter((x) => x.id !== i.id))}
              aria-label="×"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
