"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Zap,
  Box,
  GitBranch,
  Search,
  HelpCircle,
  Lightbulb,
  Bell,
  Code2,
  Check,
  ExternalLink,
  ChevronDown,
  Menu,
  X,
  Settings as SettingsIcon,
} from "lucide-react";

interface TopNavbarProps {
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export default function TopNavbar({ onToggleMobileMenu, isMobileMenuOpen }: TopNavbarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyProject = () => {
    navigator.clipboard.writeText("https://ravi-sweets-live.firebaseapp.com");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header
      className="sticky top-0 z-40 w-full h-14 flex items-center justify-between px-4 border-b select-none"
      style={{
        backgroundColor: "var(--color-bg-topbar)",
        borderColor: "var(--color-border-base)",
      }}
    >
      {/* Left side: Breadcrumb & Connection */}
      <div className="flex items-center gap-2.5 overflow-x-auto py-1 scrollbar-none text-xs">
        {/* Mobile menu trigger */}
        <button
          onClick={onToggleMobileMenu}
          aria-label="Toggle menu"
          className="md:hidden p-1.5 rounded hover:bg-[var(--color-bg-hover)] transition-colors"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        {/* Brand Icon */}
        <Link
          href="/"
          className="flex items-center justify-center w-7 h-7 rounded-md transition-transform hover:scale-105 shrink-0"
          style={{
            backgroundColor: "var(--color-brand-emerald-light)",
            border: "1px solid var(--color-brand-emerald-border)",
            color: "var(--color-brand-emerald)",
          }}
        >
          <Zap size={15} fill="currentColor" />
        </Link>

        <span style={{ color: "var(--color-border-hover)" }}>/</span>

        {/* Organization with Badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className="font-normal"
            style={{ color: "var(--color-text-primary)" }}
          >
            Ravi Sweets
          </span>
          <span
            className="px-1.5 py-0.5 text-[10px] rounded tracking-wider"
            style={{
              backgroundColor: "var(--color-bg-subtle)",
              border: "1px solid var(--color-border-base)",
              color: "var(--color-text-muted)",
            }}
          >
            CHIRALA
          </span>
        </div>

        <span style={{ color: "var(--color-border-hover)" }}>/</span>

        {/* Project Selector */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Box size={14} style={{ color: "var(--color-text-muted)" }} />
          <span
            className="font-normal"
            style={{ color: "var(--color-text-primary)" }}
          >
            ravi-sweets-software
          </span>
        </div>

        <span style={{ color: "var(--color-border-hover)" }}>/</span>

        {/* Branch & Status */}
        {/* <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <GitBranch size={13} style={{ color: "var(--color-text-muted)" }} />
          <span style={{ color: "var(--color-text-secondary)" }}>main</span>
          <span
            className="px-1.5 py-0.2 text-[9px] uppercase tracking-wider rounded font-normal"
            style={{
              backgroundColor: "var(--color-accent-amber-bg)",
              border: "1px solid var(--color-accent-amber-border)",
              color: "var(--color-accent-amber-text)",
            }}
          >
            PRODUCTION
          </span>
        </div> */}

        {/* Connect Action Button */}
        <button
          onClick={handleCopyProject}
          title="Live Firebase Service: Click to copy live endpoint"
          className="ml-1 hidden md:flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-full text-white transition-opacity hover:opacity-90 shrink-0 font-normal"
          style={{
            backgroundColor: "var(--color-brand-primary)",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-200 animate-pulse" />
          <span>{copied ? "Copied Endpoint!" : "Connect"}</span>
          {copied ? <Check size={12} /> : <ExternalLink size={11} />}
        </button>
      </div>

      {/* Right side: Tools, Search, User */}
      <div className="flex items-center gap-2.5 shrink-0 text-xs">
        {/* Settings Shortcut Link */}
        <Link
          href="/settings"
          className="p-1.5 rounded-md hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-800 border border-transparent hover:border-slate-200 cursor-pointer flex items-center gap-1.5"
          title="Settings (Profile & GST)"
        >
          <SettingsIcon size={16} />
          <span className="hidden sm:inline text-xs font-normal text-slate-600">Settings</span>
        </Link>

        {/* User Profile Avatar */}
        <Link
          href="/settings"
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-normal cursor-pointer border hover:ring-2 hover:ring-[var(--color-brand-primary)] transition-all"
          style={{
            backgroundColor: "var(--color-bg-hover)",
            borderColor: "var(--color-border-base)",
            color: "var(--color-text-primary)",
          }}
          title="Ravi Sweets Profile & Settings"
        >
          RS
        </Link>
      </div>
    </header>
  );
}
