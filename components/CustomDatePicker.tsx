"use client";

import React, { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";

export interface CustomDatePickerProps {
  value?: string; // Format: "YYYY-MM-DD"
  onChange: (date: string) => void;
  placeholder?: string;
  disabled?: boolean;
  min?: string; // Format: "YYYY-MM-DD"
  max?: string; // Format: "YYYY-MM-DD"
  className?: string;
  compact?: boolean;
  align?: "left" | "right";
  clearable?: boolean;
  id?: string;
  name?: string;
  required?: boolean;
  title?: string;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SHORT_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function CustomDatePicker({
  value = "",
  onChange,
  placeholder = "Select date",
  disabled = false,
  min,
  max,
  className = "",
  compact = false,
  align = "left",
  clearable = true,
  id,
  name,
  required = false,
  title,
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current value or fallback to today
  const parseDate = (str: string): { year: number; month: number; day: number } | null => {
    if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
    const parts = str.split("-").map(Number);
    return { year: parts[0], month: parts[1] - 1, day: parts[2] };
  };

  const parsed = parseDate(value);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;

  // View state for the calendar month navigation
  const [viewYear, setViewYear] = useState<number>(parsed ? parsed.year : today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(parsed ? parsed.month : today.getMonth());

  // Sync view when opened or when value changes
  useEffect(() => {
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
  }, [value]);

  // Click outside listener to close dropdown
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

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const formatted = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onChange(formatted);
    setIsOpen(false);
  };

  const handleSetToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(todayStr);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setIsOpen(false);
  };

  const handleSetYesterday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yestStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, "0")}-${String(
      yest.getDate()
    ).padStart(2, "0")}`;
    onChange(yestStr);
    setViewYear(yest.getFullYear());
    setViewMonth(yest.getMonth());
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setIsOpen(false);
  };

  // Build calendar matrix
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  // Format display text for input trigger
  const formatDisplay = (val: string) => {
    if (!val) return "";
    const p = parseDate(val);
    if (!p) return val;
    const d = new Date(p.year, p.month, p.day);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const isDateDisabled = (year: number, month: number, day: number) => {
    const curStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (min && curStr < min) return true;
    if (max && curStr > max) return true;
    return false;
  };

  // Years range: current year - 15 to current year + 10
  const currentYear = today.getFullYear();
  const yearsList: number[] = [];
  for (let y = currentYear - 15; y <= currentYear + 10; y++) {
    yearsList.push(y);
  }

  return (
    <div ref={containerRef} className={`relative inline-block ${compact ? "" : "w-full"}`}>
      {/* Hidden input to support standard HTML form submission if needed */}
      {name && <input type="hidden" name={name} id={id} value={value} required={required} />}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        title={title || (value ? formatDisplay(value) : placeholder)}
        className={`flex items-center justify-between gap-1.5 transition-all outline-none cursor-pointer ${
          compact
            ? "px-2 py-1 text-xs rounded border border-slate-200 bg-white hover:border-[#348bdd] text-slate-700"
            : "w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white hover:border-slate-300 focus:border-[#348bdd] focus:ring-1 focus:ring-[#348bdd]/20 text-slate-800"
        } ${disabled ? "opacity-50 cursor-not-allowed bg-slate-50" : ""} ${className}`}
      >
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
          <CalendarIcon
            size={compact ? 12 : 14}
            className={`shrink-0 ${value ? "text-[#348bdd]" : "text-slate-400"}`}
          />
          <span className={`truncate ${!value ? "text-slate-400 font-normal" : "font-medium text-slate-800"}`}>
            {value ? formatDisplay(value) : placeholder}
          </span>
        </div>

        {clearable && value && !disabled && (
          <span
            onClick={handleClear}
            className="p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 shrink-0 ml-1"
            title="Clear date"
          >
            <X size={12} />
          </span>
        )}
      </button>

      {/* Dropdown Calendar Popover */}
      {isOpen && (
        <div
          className={`absolute z-50 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl p-3 w-[280px] animate-in fade-in zoom-in-95 duration-100 ${
            align === "right" ? "right-0" : "left-0"
          }`}
          style={{ fontFamily: "var(--font-family-sora)" }}
        >
          {/* Header: Month & Year select + Navigation arrows */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <div className="flex items-center gap-1">
              {/* Month selector */}
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 outline-none focus:border-[#348bdd] cursor-pointer"
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m.slice(0, 3)}
                  </option>
                ))}
              </select>

              {/* Year selector */}
              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 outline-none focus:border-[#348bdd] cursor-pointer"
              >
                {yearsList.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                title="Previous month"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                title="Next month"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {SHORT_DAYS.map((day) => (
              <span key={day} className="text-[10px] font-medium text-slate-400 py-0.5">
                {day}
              </span>
            ))}
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Prev month tail days */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => {
              const prevDay = prevMonthDays - firstDayOfWeek + i + 1;
              return (
                <div
                  key={`prev-${i}`}
                  className="h-7 w-7 mx-auto flex items-center justify-center text-[11px] text-slate-300 font-normal select-none"
                >
                  {prevDay}
                </div>
              );
            })}

            {/* Current month days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const isSelected = value === dateKey;
              const isToday = todayStr === dateKey;
              const disabledDay = isDateDisabled(viewYear, viewMonth, day);

              return (
                <button
                  type="button"
                  key={`day-${day}`}
                  disabled={disabledDay}
                  onClick={() => !disabledDay && handleSelectDay(day)}
                  className={`h-7 w-7 mx-auto flex items-center justify-center text-xs rounded-lg transition-all ${
                    disabledDay
                      ? "text-slate-200 cursor-not-allowed"
                      : isSelected
                      ? "bg-[#348bdd] text-white font-medium shadow-sm hover:bg-[#2475c8]"
                      : isToday
                      ? "border border-[#348bdd] text-[#348bdd] font-medium hover:bg-sky-50"
                      : "text-slate-700 hover:bg-slate-100 font-normal"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Bottom Quick Preset Controls */}
          <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSetToday}
                className="px-2 py-0.5 text-[11px] font-medium rounded text-[#348bdd] bg-sky-50 hover:bg-sky-100 transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleSetYesterday}
                className="px-2 py-0.5 text-[11px] font-medium rounded text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Yesterday
              </button>
            </div>

            {clearable && value && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] text-slate-400 hover:text-rose-600 transition-colors font-medium"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

