"use client";

import React from "react";
import { X, Copy, Check, ExternalLink } from "lucide-react";

export interface FieldItem {
  label: string;
  value: React.ReactNode;
  colSpan?: 1 | 2;
}

interface ViewDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  badge?: string;
  image?: string | null;
  fields: FieldItem[];
}

export default function ViewDetailsModal({
  isOpen,
  onClose,
  title,
  badge,
  image,
  fields,
}: ViewDetailsModalProps) {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  if (!isOpen) return null;

  const handleCopy = (val: string, idx: number) => {
    navigator.clipboard.writeText(val);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-xl border bg-white shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]"
        style={{
          borderColor: "var(--color-border-base)",
          boxShadow: "var(--shadow-dropdown)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: "var(--color-border-subtle)" }}
        >
          <div className="flex items-center gap-2.5">
            <h3
              className="text-base text-[var(--color-text-primary)]"
              style={{ fontWeight: 500 }}
            >
              {title}
            </h3>
            {badge && (
              <span
                className="px-2 py-0.5 text-[10px] rounded uppercase tracking-wider font-normal"
                style={{
                  backgroundColor: "var(--color-brand-primary-light)",
                  color: "var(--color-brand-primary-text)",
                  border: "1px solid var(--color-brand-primary-border)",
                }}
              >
                {badge}
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        {/* Content Details (Scrollable) */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Optional Image Showcase */}
          {image && (
            <div className="flex items-center gap-4 p-3.5 rounded-lg border bg-slate-50/70 border-slate-200">
              <div className="relative w-18 h-18 rounded-lg overflow-hidden border border-slate-200 bg-white shrink-0 shadow-2xs">
                <img
                  src={image}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  PRODUCT PHOTO
                </div>
                <div className="text-xs text-slate-900 font-medium truncate mt-0.5">
                  {title}
                </div>
                <div className="mt-2">
                  <a
                    href={image}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded bg-white hover:bg-slate-100 border border-slate-200 text-[#348bdd] transition-colors cursor-pointer font-medium shadow-2xs"
                  >
                    <span>View Full Size</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {fields.map((f, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg border bg-slate-50/60 flex flex-col justify-between ${
                  f.colSpan === 2 ? "sm:col-span-2" : ""
                }`}
                style={{ borderColor: "var(--color-border-subtle)" }}
              >
                <div
                  className="text-[10px] uppercase tracking-wider mb-1 font-mono"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  {f.label}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-[var(--color-text-primary)] break-words font-normal w-full">
                    {f.value || "—"}
                  </div>
                  {typeof f.value === "string" && f.value.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleCopy(f.value as string, i)}
                      className="text-slate-400 hover:text-slate-600 p-1 shrink-0 cursor-pointer"
                      title="Copy value"
                    >
                      {copiedIndex === i ? (
                        <Check size={12} style={{ color: "var(--color-brand-primary)" }} />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-3 border-t bg-slate-50 flex justify-end shrink-0"
          style={{ borderColor: "var(--color-border-subtle)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs rounded-md border hover:bg-white transition-colors cursor-pointer"
            style={{
              borderColor: "var(--color-border-base)",
              color: "var(--color-text-secondary)",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

