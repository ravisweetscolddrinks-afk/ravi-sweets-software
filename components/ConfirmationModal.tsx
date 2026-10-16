"use client";

import React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDeleting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = "Delete",
  cancelText = "Cancel",
  isDeleting = false,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-xl border p-6 bg-white shadow-xl animate-in zoom-in-95 duration-200"
        style={{
          borderColor: "var(--color-border-base)",
          boxShadow: "var(--shadow-dropdown)",
        }}
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center shrink-0 text-red-600">
            <AlertTriangle size={19} />
          </div>

          <div className="flex-1">
            <h3
              className="text-base text-[var(--color-text-primary)]"
              style={{ fontWeight: 500 }}
            >
              {title}
            </h3>
            <p className="mt-1.5 text-xs text-[var(--color-text-secondary)] leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t" style={{ borderColor: "var(--color-border-subtle)" }}>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="px-3.5 py-2 text-xs rounded-md border hover:bg-slate-50 transition-colors disabled:opacity-50"
            style={{
              borderColor: "var(--color-border-base)",
              color: "var(--color-text-secondary)",
              fontWeight: 400,
            }}
          >
            {cancelText}
          </button>

          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="px-4 py-2 text-xs rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-xs"
            style={{ fontWeight: 500 }}
          >
            {isDeleting && <Loader2 size={13} className="animate-spin" />}
            <span>{isDeleting ? "Deleting..." : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
