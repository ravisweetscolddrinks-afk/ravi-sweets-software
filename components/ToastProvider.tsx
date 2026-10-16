"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      removeToast(id);
    }, 3500);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast notifications container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg border shadow-lg transition-all duration-300 animate-in slide-in-from-bottom-3"
            style={{
              backgroundColor: "var(--color-bg-surface)",
              borderColor:
                toast.type === "success"
                  ? "var(--color-brand-primary-border)"
                  : toast.type === "error"
                  ? "#fca5a5"
                  : "var(--color-border-base)",
              boxShadow: "var(--shadow-dropdown)",
            }}
          >
            {toast.type === "success" && (
              <CheckCircle2
                size={17}
                className="shrink-0 mt-0.5"
                style={{ color: "var(--color-brand-primary)" }}
              />
            )}
            {toast.type === "error" && (
              <AlertCircle size={17} className="text-red-500 shrink-0 mt-0.5" />
            )}
            {toast.type === "info" && (
              <Info
                size={17}
                className="shrink-0 mt-0.5"
                style={{ color: "var(--color-brand-primary)" }}
              />
            )}

            <div className="flex-1 text-xs text-[var(--color-text-primary)] leading-relaxed font-normal">
              {toast.message}
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
