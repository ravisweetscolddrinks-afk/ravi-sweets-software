"use client";

import React, { useState, useRef, useEffect } from "react";
import { Clock, ChevronDown, X, Check } from "lucide-react";

export interface CustomTimePickerProps {
  value?: string; // Format e.g. "11:00 AM" or "14:30"
  onChange: (time: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  align?: "left" | "right";
  clearable?: boolean;
  id?: string;
  name?: string;
  title?: string;
}

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export default function CustomTimePicker({
  value = "",
  onChange,
  placeholder = "Select time",
  disabled = false,
  className = "",
  compact = false,
  align = "left",
  clearable = true,
  id,
  name,
  title,
}: CustomTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper to parse "11:00 AM" or "14:30" into { hour12: number, minute: number, period: "AM"|"PM" }
  const parseTime = (
    str: string
  ): { hour12: number; minute: number; period: "AM" | "PM" } => {
    if (!str) {
      return { hour12: 11, minute: 0, period: "AM" };
    }
    const trimmed = str.trim().toUpperCase();
    const isPM = trimmed.includes("PM");
    const isAM = trimmed.includes("AM");

    // Remove AM/PM for numerical extraction
    const clean = trimmed.replace(/[A-Z]/g, "").trim();
    const parts = clean.split(":").map(Number);
    let h = parts[0] || 12;
    const m = parts[1] || 0;

    let period: "AM" | "PM" = "AM";
    if (isPM) {
      period = "PM";
    } else if (isAM) {
      period = "AM";
    } else if (h >= 12) {
      period = "PM";
      if (h > 12) h -= 12;
    }

    if (h === 0) h = 12;
    if (h > 12) h = h % 12;

    return { hour12: h, minute: m, period };
  };

  const currentParsed = parseTime(value);
  const [selectedHour, setSelectedHour] = useState<number>(currentParsed.hour12);
  const [selectedMinute, setSelectedMinute] = useState<number>(currentParsed.minute);
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">(currentParsed.period);

  useEffect(() => {
    if (value) {
      const p = parseTime(value);
      setSelectedHour(p.hour12);
      setSelectedMinute(p.minute);
      setSelectedPeriod(p.period);
    }
  }, [value]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const commitTime = (h: number, m: number, p: "AM" | "PM") => {
    const formattedHour = String(h).padStart(2, "0");
    const formattedMinute = String(m).padStart(2, "0");
    const formatted = `${formattedHour}:${formattedMinute} ${p}`;
    onChange(formatted);
  };

  const handleSelectHour = (h: number) => {
    setSelectedHour(h);
    commitTime(h, selectedMinute, selectedPeriod);
  };

  const handleSelectMinute = (m: number) => {
    setSelectedMinute(m);
    commitTime(selectedHour, m, selectedPeriod);
  };

  const handleTogglePeriod = (p: "AM" | "PM") => {
    setSelectedPeriod(p);
    commitTime(selectedHour, selectedMinute, p);
  };

  const handleSetNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = new Date();
    let h = now.getHours();
    const p: "AM" | "PM" = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    // Round to nearest 5 minutes
    const m = Math.round(now.getMinutes() / 5) * 5 % 60;
    setSelectedHour(h);
    setSelectedMinute(m);
    setSelectedPeriod(p);
    commitTime(h, m, p);
    setIsOpen(false);
  };

  const handlePreset = (presetStr: string) => {
    const p = parseTime(presetStr);
    setSelectedHour(p.hour12);
    setSelectedMinute(p.minute);
    setSelectedPeriod(p.period);
    onChange(presetStr);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setIsOpen(false);
  };

  const displayTime = value ? value : "";

  return (
    <div ref={containerRef} className={`relative inline-block ${compact ? "" : "w-full"}`}>
      {name && <input type="hidden" name={name} id={id} value={value} />}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        title={title || displayTime || placeholder}
        className={`flex items-center justify-between gap-1.5 transition-all outline-none cursor-pointer ${
          compact
            ? "px-2 py-1 text-xs rounded border border-slate-200 bg-white hover:border-[#348bdd] text-slate-700"
            : "w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white hover:border-slate-300 focus:border-[#348bdd] focus:ring-1 focus:ring-[#348bdd]/20 text-slate-800"
        } ${disabled ? "opacity-50 cursor-not-allowed bg-slate-50" : ""} ${className}`}
      >
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
          <Clock
            size={compact ? 12 : 14}
            className={`shrink-0 ${value ? "text-[#348bdd]" : "text-slate-400"}`}
          />
          <span className={`truncate font-mono ${!value ? "text-slate-400 font-normal font-sans" : "font-medium text-slate-800"}`}>
            {displayTime || placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {clearable && value && !disabled && (
            <span
              onClick={handleClear}
              className="p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 shrink-0"
              title="Clear time"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={13} className="text-slate-400" />
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          className={`absolute z-50 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl p-3 w-[270px] animate-in fade-in zoom-in-95 duration-100 ${
            align === "right" ? "right-0" : "left-0"
          }`}
          style={{ fontFamily: "var(--font-family-sora)" }}
        >
          {/* Header Preview & AM/PM Toggle */}
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
            <div className="flex items-baseline gap-1">
              <span className="text-base font-semibold font-mono text-slate-900">
                {String(selectedHour).padStart(2, "0")} : {String(selectedMinute).padStart(2, "0")}
              </span>
              <span className="text-xs font-semibold text-[#348bdd] font-mono ml-1">
                {selectedPeriod}
              </span>
            </div>

            {/* Segmented AM / PM switch */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => handleTogglePeriod("AM")}
                className={`px-2 py-0.5 rounded font-medium transition-all ${
                  selectedPeriod === "AM"
                    ? "bg-[#348bdd] text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => handleTogglePeriod("PM")}
                className={`px-2 py-0.5 rounded font-medium transition-all ${
                  selectedPeriod === "PM"
                    ? "bg-[#348bdd] text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                PM
              </button>
            </div>
          </div>

          {/* Hour Selection Grid */}
          <div className="mb-2.5">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1.5">
              Hour
            </div>
            <div className="grid grid-cols-6 gap-1">
              {HOURS.map((h) => {
                const isSelected = selectedHour === h;
                return (
                  <button
                    type="button"
                    key={`h-${h}`}
                    onClick={() => handleSelectHour(h)}
                    className={`py-1 text-xs rounded-md font-mono transition-all ${
                      isSelected
                        ? "bg-[#348bdd] text-white font-medium shadow-2xs hover:bg-[#2475c8]"
                        : "text-slate-700 bg-slate-50 hover:bg-sky-50 hover:text-[#1d5f9f] font-normal"
                    }`}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minute Selection Grid (5-minute intervals) */}
          <div className="mb-2.5">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1.5">
              Minute
            </div>
            <div className="grid grid-cols-6 gap-1">
              {MINUTES.map((m) => {
                const isSelected = selectedMinute === m;
                return (
                  <button
                    type="button"
                    key={`m-${m}`}
                    onClick={() => handleSelectMinute(m)}
                    className={`py-1 text-xs rounded-md font-mono transition-all ${
                      isSelected
                        ? "bg-[#348bdd] text-white font-medium shadow-2xs hover:bg-[#2475c8]"
                        : "text-slate-700 bg-slate-50 hover:bg-sky-50 hover:text-[#1d5f9f] font-normal"
                    }`}
                  >
                    {String(m).padStart(2, "0")}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Preset Buttons & Controls */}
          <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleSetNow}
                className="px-2 py-0.5 text-[11px] font-medium rounded text-[#348bdd] bg-sky-50 hover:bg-sky-100 transition-colors"
              >
                Now
              </button>
              <button
                type="button"
                onClick={() => handlePreset("10:00 AM")}
                className="px-1.5 py-0.5 text-[10px] font-medium rounded text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors font-mono"
              >
                10 AM
              </button>
              <button
                type="button"
                onClick={() => handlePreset("02:00 PM")}
                className="px-1.5 py-0.5 text-[10px] font-medium rounded text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors font-mono"
              >
                2 PM
              </button>
              <button
                type="button"
                onClick={() => handlePreset("06:00 PM")}
                className="px-1.5 py-0.5 text-[10px] font-medium rounded text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors font-mono"
              >
                6 PM
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded bg-[#348bdd] text-white hover:bg-[#2475c8] transition-colors"
              title="Confirm time"
            >
              <Check size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

