"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Copy,
  Check,
  ChevronDown,
  Database,
  Cpu,
  GitBranch,
  FolderGit2,
  HardDrive,
  Archive,
  Receipt,
  ShoppingCart,
  Factory,
  Boxes,
  ArrowDownToLine,
  UserCheck,
  Share2,
  History,
  Activity,
  Layers
} from "lucide-react";

export default function DashboardOverview() {
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText("https://ravi-sweets-live.firebaseapp.com");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Project Title & Live URL Bar */}
      <div>
        <h1
          className="text-2xl text-[var(--color-text-primary)] tracking-tight"
          style={{ fontWeight: 500 }}
        >
          Ravi Sweets Chirala
        </h1>

        <div className="flex items-center gap-2 mt-2">
          <span
            className="text-xs font-mono px-2.5 py-1 rounded border"
            style={{
              backgroundColor: "var(--color-bg-subtle)",
              borderColor: "var(--color-border-base)",
              color: "var(--color-text-secondary)",
            }}
          >
            https://ravi-sweets-live.firebaseapp.com
          </span>

          <button
            onClick={handleCopyUrl}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border hover:bg-[var(--color-bg-hover)] transition-colors"
            style={{
              borderColor: "var(--color-border-base)",
              color: "var(--color-text-muted)",
              backgroundColor: "var(--color-bg-surface)",
            }}
          >
            {copied ? <Check size={12} style={{ color: "var(--color-brand-primary)" }} /> : <Copy size={12} />}
            <span>{copied ? "Copied" : "Copy"}</span>
            <ChevronDown size={11} />
          </button>
        </div>
      </div>

      {/* Main Top Section: 2x3 Metric Grid + Infrastructure Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: 2x3 Metric Cards Grid (Matching Screenshot) */}
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Card 1: STATUS */}
          <div
            className="p-4 rounded-lg border flex items-center gap-3.5"
            style={{
              backgroundColor: "var(--color-bg-surface)",
              borderColor: "var(--color-border-base)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{
                backgroundColor: "var(--color-brand-emerald-light)",
                color: "var(--color-brand-emerald)",
              }}
            >
              <div className="grid grid-cols-3 gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--color-brand-primary)" }} />
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--color-brand-primary)" }} />
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--color-brand-primary)" }} />
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--color-brand-primary)" }} />
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--color-brand-primary)" }} />
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--color-brand-primary)" }} />
              </div>
            </div>
            <div>
              <div
                className="text-[10px] tracking-wider uppercase"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                STATUS
              </div>
              <div
                className="text-sm text-[var(--color-text-primary)]"
                style={{ fontWeight: 500 }}
              >
                Healthy
              </div>
            </div>
          </div>

          {/* Card 2: COMPUTE SIZE */}
          <div
            className="p-4 rounded-lg border flex items-center gap-3.5"
            style={{
              backgroundColor: "var(--color-bg-surface)",
              borderColor: "var(--color-border-base)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                borderColor: "var(--color-border-subtle)",
                color: "var(--color-text-secondary)",
              }}
            >
              <Cpu size={18} />
            </div>
            <div>
              <div
                className="text-[10px] tracking-wider uppercase"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                COMPUTE SIZE
              </div>
              <div className="mt-0.5">
                <span
                  className="px-1.5 py-0.5 text-[10px] rounded border font-mono tracking-wider"
                  style={{
                    backgroundColor: "var(--color-bg-subtle)",
                    borderColor: "var(--color-border-base)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  NANO
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: GITHUB / REPO */}
          <div
            className="p-4 rounded-lg border flex items-center gap-3.5"
            style={{
              backgroundColor: "var(--color-bg-surface)",
              borderColor: "var(--color-border-base)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                borderColor: "var(--color-border-subtle)",
                color: "var(--color-text-secondary)",
              }}
            >
              <FolderGit2 size={18} />
            </div>
            <div className="min-w-0">
              <div
                className="text-[10px] tracking-wider uppercase"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                PROJECT REPO
              </div>
              <div
                className="text-xs truncate text-[var(--color-text-primary)]"
                style={{ fontWeight: 500 }}
              >
                ravi-sweets-software
              </div>
            </div>
          </div>

          {/* Card 4: RECENT BRANCH */}
          <div
            className="p-4 rounded-lg border flex items-center gap-3.5"
            style={{
              backgroundColor: "var(--color-bg-surface)",
              borderColor: "var(--color-border-base)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                borderColor: "var(--color-border-subtle)",
                color: "var(--color-text-secondary)",
              }}
            >
              <GitBranch size={18} />
            </div>
            <div>
              <div
                className="text-[10px] tracking-wider uppercase"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                RECENT BRANCH
              </div>
              <div
                className="text-xs text-[var(--color-text-primary)]"
                style={{ fontWeight: 500 }}
              >
                main (live)
              </div>
            </div>
          </div>

          {/* Card 5: LAST MIGRATION */}
          <div
            className="p-4 rounded-lg border flex items-center gap-3.5"
            style={{
              backgroundColor: "var(--color-bg-surface)",
              borderColor: "var(--color-border-base)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                borderColor: "var(--color-border-subtle)",
                color: "var(--color-text-secondary)",
              }}
            >
              <HardDrive size={18} />
            </div>
            <div>
              <div
                className="text-[10px] tracking-wider uppercase"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                LAST MIGRATION
              </div>
              <div
                className="text-xs text-[var(--color-text-primary)]"
                style={{ fontWeight: 500 }}
              >
                Firestore Initialized
              </div>
            </div>
          </div>

          {/* Card 6: LAST BACKUP */}
          <div
            className="p-4 rounded-lg border flex items-center gap-3.5"
            style={{
              backgroundColor: "var(--color-bg-surface)",
              borderColor: "var(--color-border-base)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                borderColor: "var(--color-border-subtle)",
                color: "var(--color-text-secondary)",
              }}
            >
              <Archive size={18} />
            </div>
            <div>
              <div
                className="text-[10px] tracking-wider uppercase"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                LAST BACKUP
              </div>
              <div
                className="text-xs text-[var(--color-text-primary)]"
                style={{ fontWeight: 500 }}
              >
                Automated Daily
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Primary Database Canvas with Dot Grid (Exact Supabase Visual) */}
        <div
          className="lg:col-span-7 rounded-xl border p-6 flex flex-col justify-between min-h-[290px] supabase-dot-grid relative"
          style={{
            borderColor: "var(--color-border-base)",
          }}
        >
          {/* Top Right Controls (Diagram & History Icons) */}
          <div className="flex justify-end gap-1.5">
            <button
              title="Topology view"
              className="p-1.5 rounded bg-white/90 border hover:bg-white transition-colors"
              style={{
                borderColor: "var(--color-border-base)",
                color: "var(--color-text-muted)",
              }}
            >
              <Share2 size={13} />
            </button>
            <button
              title="Latency history"
              className="p-1.5 rounded bg-white/90 border hover:bg-white transition-colors"
              style={{
                borderColor: "var(--color-border-base)",
                color: "var(--color-text-muted)",
              }}
            >
              <History size={13} />
            </button>
          </div>

          {/* Center Primary Database Node Card */}
          <div className="flex items-center justify-center my-auto py-2">
            <div
              className="w-full max-w-sm bg-white rounded-lg border p-4 shadow-sm"
              style={{
                borderColor: "var(--color-border-base)",
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-md flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: "var(--color-brand-emerald)" }}
                  >
                    <Database size={17} />
                  </div>
                  <div>
                    <div
                      className="text-xs text-[var(--color-text-primary)]"
                      style={{ fontWeight: 500 }}
                    >
                      Primary Database
                    </div>
                    <div
                      className="text-[11px]"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      asia-south1 (Mumbai)
                    </div>
                    <div
                      className="text-[10px] font-mono"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      ravi-sweets-live &bull; t3.nano
                    </div>
                  </div>
                </div>

                <div className="text-right text-xs">
                  <span className="text-[14px]">🇮🇳</span>
                </div>
              </div>

              {/* Status Bar below */}
              <div
                className="flex items-center justify-between mt-3 pt-2.5 border-t text-[11px]"
                style={{
                  borderColor: "var(--color-border-subtle)",
                  color: "var(--color-text-muted)",
                }}
              >
                <span>CPU 2%</span>
                <span>&bull;</span>
                <span>Disk 15%</span>
                <span>&bull;</span>
                <span>RAM 53%</span>
                <span>&bull;</span>
                <span>8/100 conns</span>
              </div>
            </div>
          </div>

          {/* Bottom subtle indicator */}
          <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
            <span className="flex items-center gap-1.5 font-mono">
              <span className="w-2 h-2 rounded-full inline-block animate-pulse" style={{ backgroundColor: "var(--color-brand-primary)" }} />
              Realtime Synced
            </span>
            <span>Firestore Cluster #01</span>
          </div>
        </div>
      </div>

      {/* Bottom Section: "Get connected" (Matching the 6 cards in Screenshot) */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-2">
          <div className="grid grid-cols-2 gap-0.5" style={{ color: "var(--color-text-muted)" }}>
            <span className="w-1 h-1 rounded-xs bg-slate-400" />
            <span className="w-1 h-1 rounded-xs bg-slate-400" />
            <span className="w-1 h-1 rounded-xs bg-slate-400" />
            <span className="w-1 h-1 rounded-xs bg-slate-400" />
          </div>
          <h2
            className="text-base text-[var(--color-text-primary)] tracking-tight"
            style={{ fontWeight: 500 }}
          >
            Get connected
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: POS Billing */}
          <Link
            href="/pos"
            className="p-4 rounded-lg border bg-white flex flex-col items-center text-center justify-between transition-all hover:border-[var(--color-brand-emerald)] hover:shadow-sm group"
            style={{
              borderColor: "var(--color-border-base)",
              boxShadow: "var(--shadow-subtle)",
            }}
          >
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center mb-3 transition-colors group-hover:bg-[var(--color-brand-emerald-light)]"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                color: "var(--color-text-secondary)",
              }}
            >
              <Receipt size={17} />
            </div>
            <div
              className="text-xs text-[var(--color-text-primary)]"
              style={{ fontWeight: 500 }}
            >
              POS Billing
            </div>
            <div
              className="text-[10px] mt-1"
              style={{ color: "var(--color-text-muted)" }}
            >
              Counter checkout
            </div>
          </Link>

          {/* Card 2: Orders */}
          <Link
            href="/orders"
            className="p-4 rounded-lg border bg-white flex flex-col items-center text-center justify-between transition-all hover:border-[var(--color-brand-emerald)] hover:shadow-sm group"
            style={{
              borderColor: "var(--color-border-base)",
              boxShadow: "var(--shadow-subtle)",
            }}
          >
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center mb-3 transition-colors group-hover:bg-[var(--color-brand-emerald-light)]"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                color: "var(--color-text-secondary)",
              }}
            >
              <ShoppingCart size={17} />
            </div>
            <div
              className="text-xs text-[var(--color-text-primary)]"
              style={{ fontWeight: 500 }}
            >
              Orders
            </div>
            <div
              className="text-[10px] mt-1"
              style={{ color: "var(--color-text-muted)" }}
            >
              Track client orders
            </div>
          </Link>

          {/* Card 3: Manufacturing */}
          <Link
            href="/manufacturing-portal"
            className="p-4 rounded-lg border bg-white flex flex-col items-center text-center justify-between transition-all hover:border-[var(--color-brand-emerald)] hover:shadow-sm group"
            style={{
              borderColor: "var(--color-border-base)",
              boxShadow: "var(--shadow-subtle)",
            }}
          >
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center mb-3 transition-colors group-hover:bg-[var(--color-brand-emerald-light)]"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                color: "var(--color-text-secondary)",
              }}
            >
              <Factory size={17} />
            </div>
            <div
              className="text-xs text-[var(--color-text-primary)]"
              style={{ fontWeight: 500 }}
            >
              Manufacturing
            </div>
            <div
              className="text-[10px] mt-1"
              style={{ color: "var(--color-text-muted)" }}
            >
              Batch production
            </div>
          </Link>

          {/* Card 4: Packing Units */}
          <Link
            href="/packing-units"
            className="p-4 rounded-lg border bg-white flex flex-col items-center text-center justify-between transition-all hover:border-[var(--color-brand-emerald)] hover:shadow-sm group"
            style={{
              borderColor: "var(--color-border-base)",
              boxShadow: "var(--shadow-subtle)",
            }}
          >
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center mb-3 transition-colors group-hover:bg-[var(--color-brand-emerald-light)]"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                color: "var(--color-text-secondary)",
              }}
            >
              <Boxes size={17} />
            </div>
            <div
              className="text-xs text-[var(--color-text-primary)]"
              style={{ fontWeight: 500 }}
            >
              Packing Units
            </div>
            <div
              className="text-[10px] mt-1"
              style={{ color: "var(--color-text-muted)" }}
            >
              Sweet boxes dispatch
            </div>
          </Link>

          {/* Card 5: Stock Entry */}
          <Link
            href="/store-stock-entry"
            className="p-4 rounded-lg border bg-white flex flex-col items-center text-center justify-between transition-all hover:border-[var(--color-brand-emerald)] hover:shadow-sm group"
            style={{
              borderColor: "var(--color-border-base)",
              boxShadow: "var(--shadow-subtle)",
            }}
          >
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center mb-3 transition-colors group-hover:bg-[var(--color-brand-emerald-light)]"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                color: "var(--color-text-secondary)",
              }}
            >
              <ArrowDownToLine size={17} />
            </div>
            <div
              className="text-xs text-[var(--color-text-primary)]"
              style={{ fontWeight: 500 }}
            >
              Stock Entry
            </div>
            <div
              className="text-[10px] mt-1"
              style={{ color: "var(--color-text-muted)" }}
            >
              Inventory inward
            </div>
          </Link>

          {/* Card 6: Staff & Attendance */}
          <Link
            href="/employee-attendance"
            className="p-4 rounded-lg border bg-white flex flex-col items-center text-center justify-between transition-all hover:border-[var(--color-brand-emerald)] hover:shadow-sm group"
            style={{
              borderColor: "var(--color-border-base)",
              boxShadow: "var(--shadow-subtle)",
            }}
          >
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center mb-3 transition-colors group-hover:bg-[var(--color-brand-emerald-light)]"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                color: "var(--color-text-secondary)",
              }}
            >
              <UserCheck size={17} />
            </div>
            <div
              className="text-xs text-[var(--color-text-primary)]"
              style={{ fontWeight: 500 }}
            >
              Staff & HR
            </div>
            <div
              className="text-[10px] mt-1"
              style={{ color: "var(--color-text-muted)" }}
            >
              Attendance & Payroll
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
