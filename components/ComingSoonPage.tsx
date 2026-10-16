"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Copy,
  Check,
  ArrowRight,
  Clock,
  ShieldCheck,
  Database,
  Layers,
  ChevronRight,
  Terminal,
  Activity
} from "lucide-react";

interface ComingSoonPageProps {
  title: string;
  category: string;
  route: string;
  description: string;
  features?: string[];
}

export default function ComingSoonPage({
  title,
  category,
  route,
  description,
  features = [
    "Real-time Firebase Firestore synchronisation",
    "Optimized for high-speed counter transactions",
    "Multi-tier role based access control",
    "Offline-first transactional local cache",
  ],
}: ComingSoonPageProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(route);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full space-y-6">
      {/* Breadcrumb path */}
      <div
        className="flex items-center gap-1.5 text-xs"
        style={{ color: "var(--color-text-muted)" }}
      >
        <Link
          href="/"
          className="hover:text-[var(--color-text-primary)] transition-colors"
        >
          Console
        </Link>
        <ChevronRight size={12} />
        <span>{category}</span>
        <ChevronRight size={12} />
        <span style={{ color: "var(--color-text-primary)" }}>{title}</span>
      </div>

      {/* Main Header & URL section (Supabase style) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
        <div>
          <div className="flex items-center gap-2.5">
            <h1
              className="text-2xl text-[var(--color-text-primary)] tracking-tight"
              style={{ fontWeight: 500 }}
            >
              {title}
            </h1>
            <span
              className="px-2 py-0.5 text-[10px] uppercase tracking-wider rounded font-normal"
              style={{
                backgroundColor: "var(--color-accent-amber-bg)",
                border: "1px solid var(--color-accent-amber-border)",
                color: "var(--color-accent-amber-text)",
              }}
            >
              COMING SOON
            </span>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <code
              className="text-xs px-2 py-1 rounded border font-mono"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                borderColor: "var(--color-border-base)",
                color: "var(--color-text-secondary)",
              }}
            >
              {route}
            </code>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-[var(--color-bg-hover)] transition-colors"
              style={{
                borderColor: "var(--color-border-base)",
                color: "var(--color-text-muted)",
              }}
              title="Copy page route"
            >
              {copied ? <Check size={12} style={{ color: "var(--color-brand-primary)" }} /> : <Copy size={12} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border hover:bg-[var(--color-bg-hover)] transition-colors"
            style={{
              borderColor: "var(--color-border-base)",
              color: "var(--color-text-secondary)",
            }}
          >
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </div>

      {/* 2-Column Section (Status Metrics + Technical Blueprint Canvas) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Technical Metric Cards */}
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            className="p-4 rounded-lg border flex flex-col justify-between"
            style={{
              backgroundColor: "var(--color-bg-surface)",
              borderColor: "var(--color-border-base)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] tracking-wider uppercase" style={{ color: "var(--color-text-tertiary)" }}>
                MODULE STATUS
              </span>
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            </div>
            <div className="text-base text-[var(--color-text-primary)]" style={{ fontWeight: 500 }}>
              In Development
            </div>
          </div>

          <div
            className="p-4 rounded-lg border flex flex-col justify-between"
            style={{
              backgroundColor: "var(--color-bg-surface)",
              borderColor: "var(--color-border-base)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] tracking-wider uppercase" style={{ color: "var(--color-text-tertiary)" }}>
                SYNC ENGINE
              </span>
              <Database size={13} style={{ color: "var(--color-brand-emerald)" }} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base text-[var(--color-text-primary)]" style={{ fontWeight: 500 }}>
                Firestore Live
              </span>
            </div>
          </div>

          <div
            className="p-4 rounded-lg border flex flex-col justify-between"
            style={{
              backgroundColor: "var(--color-bg-surface)",
              borderColor: "var(--color-border-base)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] tracking-wider uppercase" style={{ color: "var(--color-text-tertiary)" }}>
                CATEGORY
              </span>
              <Layers size={13} style={{ color: "var(--color-text-muted)" }} />
            </div>
            <div className="text-sm truncate text-[var(--color-text-primary)]" style={{ fontWeight: 500 }}>
              {category}
            </div>
          </div>

          <div
            className="p-4 rounded-lg border flex flex-col justify-between"
            style={{
              backgroundColor: "var(--color-bg-surface)",
              borderColor: "var(--color-border-base)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] tracking-wider uppercase" style={{ color: "var(--color-text-tertiary)" }}>
                SECURITY ACCESS
              </span>
              <ShieldCheck size={13} style={{ color: "var(--color-brand-emerald)" }} />
            </div>
            <div className="text-sm text-[var(--color-text-primary)]" style={{ fontWeight: 500 }}>
              Role Protected
            </div>
          </div>

          {/* Module description card */}
          <div
            className="sm:col-span-2 p-4 rounded-lg border space-y-2"
            style={{
              backgroundColor: "var(--color-bg-surface)",
              borderColor: "var(--color-border-base)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div className="text-[10px] tracking-wider uppercase" style={{ color: "var(--color-text-tertiary)" }}>
              MODULE DESCRIPTION
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
              {description}
            </p>
          </div>
        </div>

        {/* Right Side: Supabase Dot-Grid Visualizer Canvas */}
        <div
          className="lg:col-span-7 rounded-xl border p-6 flex flex-col justify-between min-h-[300px] supabase-dot-grid relative overflow-hidden"
          style={{
            borderColor: "var(--color-border-base)",
          }}
        >
          {/* Subtle top right node controls */}
          <div className="flex justify-end gap-1.5 mb-6">
            <span
              className="p-1.5 rounded bg-white/90 border text-xs"
              style={{ borderColor: "var(--color-border-base)", color: "var(--color-text-muted)" }}
            >
              <Activity size={13} />
            </span>
            <span
              className="p-1.5 rounded bg-white/90 border text-xs"
              style={{ borderColor: "var(--color-border-base)", color: "var(--color-text-muted)" }}
            >
              <Terminal size={13} />
            </span>
          </div>

          {/* Center Blueprint Card */}
          <div className="flex items-center justify-center my-auto">
            <div
              className="w-full max-w-md bg-white rounded-lg border p-4 shadow-sm space-y-3"
              style={{
                borderColor: "var(--color-border-base)",
              }}
            >
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--color-border-subtle)" }}>
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center text-white"
                    style={{ backgroundColor: "var(--color-brand-emerald)" }}
                  >
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <div className="text-xs text-[var(--color-text-primary)]" style={{ fontWeight: 500 }}>
                      {title} Engine
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                      ravi-sweets-live.firebaseapp.com
                    </div>
                  </div>
                </div>

                <span
                  className="px-2 py-0.5 text-[10px] rounded"
                  style={{
                    backgroundColor: "var(--color-brand-emerald-light)",
                    color: "var(--color-brand-emerald-text)",
                  }}
                >
                  LIVE READY
                </span>
              </div>

              {/* Progress & Architecture Status */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                  <span>Architecture & UI Spec</span>
                  <span style={{ color: "var(--color-brand-emerald)" }}>Configured</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: "85%",
                      backgroundColor: "var(--color-brand-emerald)",
                    }}
                  />
                </div>
              </div>

              <div
                className="flex items-center justify-between pt-2 border-t text-[10px] font-mono"
                style={{
                  borderColor: "var(--color-border-subtle)",
                  color: "var(--color-text-tertiary)",
                }}
              >
                <span>SCHEMA: SYNCED</span>
                <span>LATENCY: ~12ms</span>
                <span>AUTH: FIREBASE</span>
              </div>
            </div>
          </div>

          {/* Bottom status watermark */}
          <div className="text-[11px] text-right font-mono" style={{ color: "var(--color-text-tertiary)" }}>
            Ravi Sweets Chirala &bull; Modular Software Architecture
          </div>
        </div>
      </div>

      {/* Planned Feature Capabilities */}
      <div className="space-y-3 pt-2">
        <h2 className="text-sm uppercase tracking-wider text-[var(--color-text-muted)] text-[11px]" style={{ fontWeight: 500 }}>
          Planned Module Features
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {features.map((feature, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-lg border bg-white flex items-start gap-2.5 transition-colors hover:border-[var(--color-border-hover)]"
              style={{
                borderColor: "var(--color-border-base)",
                boxShadow: "var(--shadow-subtle)",
              }}
            >
              <div
                className="w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  backgroundColor: "var(--color-brand-emerald-light)",
                  color: "var(--color-brand-emerald)",
                }}
              >
                <Check size={12} />
              </div>
              <span className="text-xs leading-snug" style={{ color: "var(--color-text-secondary)" }}>
                {feature}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
