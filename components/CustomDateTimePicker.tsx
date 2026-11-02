"use client";

import React from "react";
import CustomDatePicker from "./CustomDatePicker";
import CustomTimePicker from "./CustomTimePicker";

export interface CustomDateTimePickerProps {
  dateValue?: string; // YYYY-MM-DD
  timeValue?: string; // HH:MM AM/PM
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  datePlaceholder?: string;
  timePlaceholder?: string;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  clearable?: boolean;
}

export default function CustomDateTimePicker({
  dateValue = "",
  timeValue = "",
  onDateChange,
  onTimeChange,
  datePlaceholder = "Select date",
  timePlaceholder = "Select time",
  disabled = false,
  className = "",
  compact = false,
  clearable = true,
}: CustomDateTimePickerProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 min-w-0">
        <CustomDatePicker
          value={dateValue}
          onChange={onDateChange}
          placeholder={datePlaceholder}
          disabled={disabled}
          compact={compact}
          clearable={clearable}
        />
      </div>
      <div className="w-36 shrink-0">
        <CustomTimePicker
          value={timeValue}
          onChange={onTimeChange}
          placeholder={timePlaceholder}
          disabled={disabled}
          compact={compact}
          clearable={clearable}
          align="right"
        />
      </div>
    </div>
  );
}

