"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import {
  Wallet,
  Calendar,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  FileText,
  Sliders,
  DollarSign,
  TrendingDown,
  Gift,
  HelpCircle,
  Eye,
  Loader2,
  ChevronLeft,
  ChevronRight,
  User,
  Save,
  RotateCw,
  Sparkles,
  ShieldCheck,
  Building
} from "lucide-react";

export interface EmployeeItem {
  id: string;
  employeeId: string;
  name: string;
  phone: string;
  city: string;
  profilePicUrl?: string;
  salaryType: "monthly" | "daily";
  salaryAmount: number;
  acceptedLeaves: number;
  status: "Active" | "Inactive";
}

export interface AttendanceRecord {
  id: string;
  date: string;
  employeeId: string;
  status: "Present" | "Absent" | "Half Day";
}

export interface PayrollSettings {
  daysCount: number; // e.g. 30 or 31
  isBonusEnabled: boolean;
  bonusDaysCount: number; // number of days given as bonus
}

export interface EmployeePayrollRow {
  employee: EmployeeItem;
  perDayAmount: number;
  daysPresent: number;
  daysAbsent: number;
  acceptedLeaves: number;
  lossOfPayDays: number;
  lossOfPayDeduction: number;
  isEligibleForBonus: boolean;
  bonusDays: number;
  bonusAmount: number;
  grossSalary: number;
  netSalary: number;
}

export default function PayrollPage() {
  const { showToast } = useToast();

  // Active Tab: "overview" (Employee Payroll List) or "calculation" (Salary Calculation & Rules)
  const [activeTab, setActiveTab] = useState<"overview" | "calculation">("overview");

  // Selected Month & Year (defaults to current month)
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth()); // 0-indexed (0=Jan, 9=Oct)

  // Reference & Loaded Data
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Payroll Calculation Settings
  const [payrollSettings, setPayrollSettings] = useState<PayrollSettings>({
    daysCount: 30, // 30 or 31
    isBonusEnabled: false,
    bonusDaysCount: 2,
  });

  // Selected Employee for Payslip Modal
  const [payslipRow, setPayslipRow] = useState<EmployeePayrollRow | null>(null);

  // Month Names
  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Number of actual days in the selected month
  const actualDaysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  // 1. Subscribe to Employees
  useEffect(() => {
    const colRef = collection(db, "employees");
    const q = query(colRef, orderBy("name", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: EmployeeItem[] = [];
        snapshot.docs.forEach((d) => {
          const data = d.data();
          if (data.status !== "Inactive") {
            list.push({
              id: d.id,
              employeeId: data.employeeId || "",
              name: data.name || "",
              phone: data.phone || "",
              city: data.city || "",
              profilePicUrl: data.profilePicUrl || "",
              salaryType: data.salaryType || "monthly",
              salaryAmount: Number(data.salaryAmount) || 0,
              acceptedLeaves: Number(data.acceptedLeaves) || 2,
              status: data.status || "Active",
            });
          }
        });
        setEmployees(list);
      },
      (err) => console.error("Error loading employees for payroll:", err)
    );

    return () => unsubscribe();
  }, []);

  // 2. Load Payroll Settings from Firestore
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "payroll_settings"));
        if (snap.exists()) {
          const d = snap.data();
          setPayrollSettings({
            daysCount: Number(d.daysCount) || actualDaysInMonth || 30,
            isBonusEnabled: !!d.isBonusEnabled,
            bonusDaysCount: Number(d.bonusDaysCount) || 2,
          });
        } else {
          setPayrollSettings((prev) => ({
            ...prev,
            daysCount: actualDaysInMonth,
          }));
        }
      } catch (err) {
        console.warn("Error fetching payroll settings:", err);
      }
    };
    fetchSettings();
  }, [actualDaysInMonth]);

  // 3. Fetch Monthly Attendance Records for the Selected Month
  const fetchMonthAttendance = useCallback(async () => {
    setIsLoading(true);
    try {
      const monthPadded = String(selectedMonth + 1).padStart(2, "0");
      const startDate = `${selectedYear}-${monthPadded}-01`;
      const endDate = `${selectedYear}-${monthPadded}-${String(actualDaysInMonth).padStart(2, "0")}`;

      const q = query(
        collection(db, "employee_attendance"),
        where("date", ">=", startDate),
        where("date", "<=", endDate)
      );

      const snapshot = await getDocs(q);
      const list: AttendanceRecord[] = [];
      snapshot.docs.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          date: data.date,
          employeeId: data.employeeId,
          status: data.status,
        });
      });
      setAttendanceRecords(list);
    } catch (err) {
      console.error("Error loading attendance for payroll:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonth, actualDaysInMonth]);

  useEffect(() => {
    fetchMonthAttendance();
  }, [fetchMonthAttendance]);

  // 4. Live Payroll Computations for each Employee
  const payrollRows: EmployeePayrollRow[] = useMemo(() => {
    const daysDivisor = Math.max(1, payrollSettings.daysCount || 30);

    return employees.map((emp) => {
      // Filter attendance records for this employee in the selected month
      const empLogs = attendanceRecords.filter((r) => r.employeeId === emp.id);

      let presentCount = 0;
      let absentCount = 0;
      let halfDayCount = 0;

      empLogs.forEach((log) => {
        if (log.status === "Present") presentCount++;
        else if (log.status === "Absent") absentCount++;
        else if (log.status === "Half Day") halfDayCount++;
      });

      // Half day counts as 0.5 present and 0.5 absent
      const daysPresent = presentCount + halfDayCount * 0.5;
      const daysAbsent = absentCount + halfDayCount * 0.5;

      // Per Day Amount
      let perDayAmount = 0;
      if (emp.salaryType === "monthly") {
        perDayAmount = Number((emp.salaryAmount / daysDivisor).toFixed(2));
      } else {
        perDayAmount = emp.salaryAmount;
      }

      // Loss of Pay (LOP) Calculation:
      // "if no of absent are more then accepted leaves then loss of pay menad if absents are 4 but acepted leaves are 2 then loos of pay is 2 only"
      const acceptedLeaves = emp.acceptedLeaves || 0;
      const lossOfPayDays = Math.max(0, daysAbsent - acceptedLeaves);
      const lossOfPayDeduction = Number((lossOfPayDays * perDayAmount).toFixed(2));

      // Bonus Calculation:
      // "if all days are prent then bounys count days wiull add to the salary."
      // Eligible if bonus is enabled AND employee has zero absent days (meaning 100% attendance during recorded days)
      const isEligibleForBonus =
        payrollSettings.isBonusEnabled &&
        daysAbsent === 0 &&
        daysPresent > 0 &&
        daysPresent >= Math.min(20, daysDivisor - 4); // ensure active worker

      const bonusDays = isEligibleForBonus ? Number(payrollSettings.bonusDaysCount || 0) : 0;
      const bonusAmount = Number((bonusDays * perDayAmount).toFixed(2));

      // Gross & Net Salary
      let grossSalary = 0;
      let netSalary = 0;

      if (emp.salaryType === "monthly") {
        grossSalary = emp.salaryAmount;
        netSalary = Math.max(0, Number((grossSalary - lossOfPayDeduction + bonusAmount).toFixed(2)));
      } else {
        grossSalary = Number((daysPresent * perDayAmount).toFixed(2));
        netSalary = Math.max(0, Number((grossSalary + bonusAmount).toFixed(2)));
      }

      return {
        employee: emp,
        perDayAmount,
        daysPresent,
        daysAbsent,
        acceptedLeaves,
        lossOfPayDays,
        lossOfPayDeduction,
        isEligibleForBonus,
        bonusDays,
        bonusAmount,
        grossSalary,
        netSalary,
      };
    });
  }, [employees, attendanceRecords, payrollSettings]);

  // Filtered rows for overview
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return payrollRows;
    const q = searchQuery.toLowerCase().trim();
    return payrollRows.filter(
      (r) =>
        r.employee.name.toLowerCase().includes(q) ||
        r.employee.employeeId.toLowerCase().includes(q) ||
        r.employee.phone.toLowerCase().includes(q) ||
        r.employee.city.toLowerCase().includes(q)
    );
  }, [payrollRows, searchQuery]);

  // Overall Metrics
  const summaryMetrics = useMemo(() => {
    const totalStaff = payrollRows.length;
    const totalGross = payrollRows.reduce((acc, r) => acc + r.grossSalary, 0);
    const totalDeductions = payrollRows.reduce((acc, r) => acc + r.lossOfPayDeduction, 0);
    const totalBonus = payrollRows.reduce((acc, r) => acc + r.bonusAmount, 0);
    const totalNet = payrollRows.reduce((acc, r) => acc + r.netSalary, 0);
    return { totalStaff, totalGross, totalDeductions, totalBonus, totalNet };
  }, [payrollRows]);

  // Save Settings to Firestore
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await setDoc(
        doc(db, "settings", "payroll_settings"),
        {
          daysCount: Number(payrollSettings.daysCount),
          isBonusEnabled: !!payrollSettings.isBonusEnabled,
          bonusDaysCount: Number(payrollSettings.bonusDaysCount),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      showToast("Payroll calculation settings saved successfully!", "success");
    } catch (err: any) {
      showToast("Error saving payroll settings: " + err.message, "error");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Convert number to words in Indian Rupees
  const numberToWords = (num: number): string => {
    if (!num || isNaN(num) || num <= 0) return "Zero Rupees Only";
    const a = ["", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ", "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "];
    const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    const formatSection = (n: number): string => {
      let str = "";
      if (n > 99) { str += a[Math.floor(n / 100)] + "Hundred "; n %= 100; }
      if (n > 19) { str += b[Math.floor(n / 10)] + " " + a[n % 10]; } else if (n > 0) { str += a[n]; }
      return str;
    };
    const integerPart = Math.floor(num);
    let res = "";
    const crore = Math.floor(integerPart / 10000000);
    const lakh = Math.floor((integerPart % 10000000) / 100000);
    const thousand = Math.floor((integerPart % 100000) / 1000);
    const rem = integerPart % 1000;
    if (crore > 0) res += formatSection(crore) + "Crore ";
    if (lakh > 0) res += formatSection(lakh) + "Lakh ";
    if (thousand > 0) res += formatSection(thousand) + "Thousand ";
    if (rem > 0) res += formatSection(rem);
    return (res.trim() || "Zero") + " Rupees Only";
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b"
        style={{ borderColor: "var(--color-border-subtle)" }}
      >
        <div>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                backgroundColor: "var(--color-brand-primary-light)",
                color: "var(--color-brand-primary)",
              }}
            >
              <Wallet size={18} />
            </div>
            <h1
              className="text-2xl text-[var(--color-text-primary)] tracking-tight"
              style={{ fontWeight: 500 }}
            >
              Staff Payroll
            </h1>
            <span
              className="px-2 py-0.5 text-xs rounded font-normal font-mono"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                border: "1px solid var(--color-border-base)",
                color: "var(--color-text-secondary)",
              }}
            >
              {MONTH_NAMES[selectedMonth]} {selectedYear}
            </span>
          </div>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            Automated salary computation, loss of pay deductions, full-attendance bonus, and digital payslips.
          </p>
        </div>

        {/* Month Selector & Controls */}
        <div className="flex items-center gap-2">
          {/* Month Dropdown */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="text-xs px-3 py-1.5 rounded-md border bg-white focus:outline-none cursor-pointer font-medium text-slate-800 border-slate-200 shadow-2xs"
          >
            {MONTH_NAMES.map((m, idx) => (
              <option key={m} value={idx}>
                {m}
              </option>
            ))}
          </select>

          {/* Year Dropdown */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-xs px-2.5 py-1.5 rounded-md border bg-white focus:outline-none cursor-pointer font-mono font-medium text-slate-800 border-slate-200 shadow-2xs"
          >
            {[2025, 2026, 2027, 2028].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          {/* Refresh Attendance Data */}
          <button
            onClick={fetchMonthAttendance}
            className="p-2 rounded-md border bg-white hover:bg-slate-50 text-slate-600 cursor-pointer border-slate-200 shadow-2xs transition-colors"
            title="Refresh Attendance & Payroll"
          >
            <RotateCw size={14} className={isLoading ? "animate-spin text-[#348bdd]" : ""} />
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`pb-3 text-xs font-medium border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "overview"
                ? "border-[#348bdd] text-[#348bdd]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Users size={15} />
            <span>Employee Payroll List</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-mono">
              {employees.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("calculation")}
            className={`pb-3 text-xs font-medium border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "calculation"
                ? "border-[#348bdd] text-[#348bdd]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Sliders size={15} />
            <span>Salary Calculation & Rules</span>
            {payrollSettings.isBonusEnabled && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200 font-mono flex items-center gap-0.5">
                <Sparkles size={10} />
                <span>Bonus ON</span>
              </span>
            )}
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: EMPLOYEE PAYROLL LIST (OVERVIEW)
         ========================================================================= */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Metrics Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 block">
                Total Gross Payroll
              </span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xl font-medium text-slate-900 font-mono">
                  ₹{summaryMetrics.totalGross.toLocaleString("en-IN")}
                </span>
                <DollarSign size={16} className="text-slate-400" />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-rose-100 bg-rose-50/20 shadow-2xs">
              <span className="text-[10px] font-medium uppercase tracking-wider text-rose-600 block">
                Loss of Pay Deductions
              </span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xl font-medium text-rose-700 font-mono">
                  -₹{summaryMetrics.totalDeductions.toLocaleString("en-IN")}
                </span>
                <TrendingDown size={16} className="text-rose-500" />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-emerald-100 bg-emerald-50/20 shadow-2xs">
              <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-600 block">
                Bonus Distributed
              </span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xl font-medium text-emerald-700 font-mono">
                  +₹{summaryMetrics.totalBonus.toLocaleString("en-IN")}
                </span>
                <Gift size={16} className="text-emerald-500" />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-blue-100 bg-sky-50/30 shadow-2xs">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[#348bdd] block">
                Net Payable Amount
              </span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xl font-medium text-[#2377c8] font-mono">
                  ₹{summaryMetrics.totalNet.toLocaleString("en-IN")}
                </span>
                <CheckCircle2 size={16} className="text-[#348bdd]" />
              </div>
            </div>
          </div>

          {/* Search bar & Counts */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border w-full sm:w-80 bg-white"
              style={{
                borderColor: "var(--color-border-base)",
              }}
            >
              <Search size={14} style={{ color: "var(--color-text-muted)" }} />
              <input
                type="text"
                placeholder="Search staff by name, ID, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-transparent focus:outline-none"
                style={{ color: "var(--color-text-primary)" }}
              />
            </div>

            <div
              className="text-xs self-end sm:self-center font-normal"
              style={{ color: "var(--color-text-muted)" }}
            >
              Showing {filteredRows.length} of {payrollRows.length} employees
            </div>
          </div>

          {/* Payroll Table (Supabase Table Editor Grid Style) */}
          <div
            className="rounded-lg border bg-white overflow-hidden shadow-xs"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            {isLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <Loader2
                  size={24}
                  className="animate-spin"
                  style={{ color: "var(--color-brand-primary)" }}
                />
                <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Computing staff payroll...
                </span>
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center p-6">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                  style={{
                    backgroundColor: "var(--color-bg-subtle)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  <Users size={22} />
                </div>
                <h3
                  className="text-sm text-[var(--color-text-primary)]"
                  style={{ fontWeight: 500 }}
                >
                  No employees found
                </h3>
                <p className="text-xs mt-1 max-w-sm" style={{ color: "var(--color-text-muted)" }}>
                  No active employee payroll records match your search keyword for this month.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border-t" style={{ borderColor: "var(--color-border-base)" }}>
                <table className="w-full text-left text-xs border-collapse">
                  <thead
                    className="border-b select-none sticky top-0 z-10"
                    style={{
                      backgroundColor: "var(--color-bg-surface)",
                      borderColor: "var(--color-border-base)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    <tr className="divide-x divide-slate-200 text-[11px]">
                      <th className="px-3 py-2 font-medium bg-slate-50/50 w-12 text-center">
                        <span className="font-medium text-slate-800">avatar</span>
                      </th>
                      <th className="px-3.5 py-2 font-medium bg-slate-50/50 w-32">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-800">employee_id</span>
                          <span className="text-[10px] font-mono text-slate-400">varchar</span>
                        </div>
                      </th>
                      <th className="px-3.5 py-2 font-medium bg-slate-50/50 min-w-[160px]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-800">staff_member</span>
                          <span className="text-[10px] font-mono text-slate-400">entity</span>
                        </div>
                      </th>
                      <th className="px-3.5 py-2 font-medium bg-slate-50/50 min-w-[130px]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-800">base_rate</span>
                          <span className="text-[10px] font-mono text-slate-400">numeric</span>
                        </div>
                      </th>
                      <th className="px-3.5 py-2 font-medium bg-slate-50/50 text-center min-w-[100px]">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="font-medium text-slate-800">present</span>
                          <span className="text-[10px] font-mono text-slate-400">days</span>
                        </div>
                      </th>
                      <th className="px-3.5 py-2 font-medium bg-slate-50/50 text-center min-w-[100px]">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="font-medium text-slate-800">absent</span>
                          <span className="text-[10px] font-mono text-slate-400">days</span>
                        </div>
                      </th>
                      <th className="px-3.5 py-2 font-medium bg-slate-50/50 text-center min-w-[100px]">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="font-medium text-slate-800">accepted</span>
                          <span className="text-[10px] font-mono text-slate-400">days</span>
                        </div>
                      </th>
                      <th className="px-3.5 py-2 font-medium bg-slate-50/50 text-center min-w-[130px]">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="font-medium text-rose-700">lop_deduction</span>
                          <span className="text-[10px] font-mono text-slate-400">numeric</span>
                        </div>
                      </th>
                      {payrollSettings.isBonusEnabled && (
                        <th className="px-3.5 py-2 font-medium bg-slate-50/50 text-center min-w-[130px]">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="font-medium text-emerald-700">bonus_added</span>
                            <span className="text-[10px] font-mono text-slate-400">numeric</span>
                          </div>
                        </th>
                      )}
                      <th className="px-3.5 py-2 font-medium bg-slate-50/50 text-right min-w-[140px]">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="font-medium text-slate-800">net_salary</span>
                          <span className="text-[10px] font-mono text-slate-400">numeric</span>
                        </div>
                      </th>
                      <th className="px-3 py-2 font-medium text-right bg-slate-50/50 w-28">
                        <div className="flex items-center justify-end gap-1">
                          <span className="font-medium text-slate-800">actions</span>
                          <span className="text-[10px] font-mono text-slate-400">menu</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredRows.map((r) => (
                      <tr
                        key={r.employee.id}
                        className="divide-x divide-slate-200 hover:bg-slate-50/80 transition-colors"
                      >
                        {/* Avatar */}
                        <td className="px-2 py-1.5 text-center">
                          {r.employee.profilePicUrl ? (
                            <img
                              src={r.employee.profilePicUrl}
                              alt={r.employee.name}
                              className="w-7 h-7 rounded-full object-cover border border-slate-200 mx-auto shadow-2xs"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center font-medium mx-auto text-[11px] font-mono">
                              {r.employee.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </td>

                        {/* ID */}
                        <td className="px-3.5 py-2 font-mono text-[11px] text-[#348bdd] font-medium">
                          {r.employee.employeeId || <span className="font-mono text-slate-300 italic text-[11px]">NULL</span>}
                        </td>

                        {/* Name & Contact */}
                        <td className="px-3.5 py-2">
                          <div className="font-medium text-slate-900">{r.employee.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {r.employee.phone}
                          </div>
                        </td>

                        {/* Base Rate */}
                        <td className="px-3.5 py-2 font-mono">
                          <div className="font-medium text-slate-900">
                            ₹{r.employee.salaryAmount.toLocaleString("en-IN")}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            (₹{r.perDayAmount}/day)
                          </div>
                        </td>

                        {/* Present Days */}
                        <td className="px-3.5 py-2 text-center font-mono">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                            {r.daysPresent} d
                          </span>
                        </td>

                        {/* Absent Days */}
                        <td className="px-3.5 py-2 text-center font-mono">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                              r.daysAbsent > 0
                                ? "bg-rose-50 text-rose-700 border border-rose-100"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {r.daysAbsent} d
                          </span>
                        </td>

                        {/* Accepted Leaves */}
                        <td className="px-3.5 py-2 text-center font-mono text-slate-600">
                          {r.acceptedLeaves} d
                        </td>

                        {/* Loss of Pay */}
                        <td className="px-3.5 py-2 text-center font-mono">
                          {r.lossOfPayDays > 0 ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                              {r.lossOfPayDays} d (-₹{r.lossOfPayDeduction.toFixed(0)})
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">0 d (Covered)</span>
                          )}
                        </td>

                        {/* Bonus Added */}
                        {payrollSettings.isBonusEnabled && (
                          <td className="px-3.5 py-2 text-center font-mono">
                            {r.bonusDays > 0 ? (
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                +{r.bonusDays} d (+₹{r.bonusAmount.toFixed(0)})
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>
                        )}

                        {/* Net Payable Salary */}
                        <td className="px-3.5 py-2 text-right font-mono font-medium text-xs text-slate-900">
                          ₹{r.netSalary.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>

                        {/* Actions: View Payslip */}
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setPayslipRow(r)}
                            className="px-2.5 py-1 text-xs rounded-md border bg-white hover:bg-slate-50 text-slate-700 font-medium cursor-pointer border-slate-200 shadow-2xs flex items-center gap-1 transition-colors ml-auto"
                          >
                            <FileText size={12} className="text-[#348bdd]" />
                            <span>Payslip</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: SALARY CALCULATION & RULES CONFIGURATION
         ========================================================================= */}
      {activeTab === "calculation" && (
        <div className="flex-1 px-6 py-6 max-w-4xl">
          <form onSubmit={handleSaveSettings} className="space-y-6">
            {/* Days Count Setting */}
            <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-sky-50 text-[#348bdd] flex items-center justify-center border border-sky-100 shrink-0">
                  <Calendar size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900">
                    Days Count for Per-Day Salary Calculation
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Specifies the divisor used to compute daily wages from monthly salaries (e.g. 30 or 31).
                  </p>
                </div>
              </div>

              <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 30 Days */}
                <button
                  type="button"
                  onClick={() => setPayrollSettings((prev) => ({ ...prev, daysCount: 30 }))}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                    payrollSettings.daysCount === 30
                      ? "border-[#348bdd] bg-sky-50/40 text-slate-900 ring-1 ring-[#348bdd]"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-base font-medium font-mono block">30 Days</span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Standard commercial calculation
                  </span>
                </button>

                {/* 31 Days */}
                <button
                  type="button"
                  onClick={() => setPayrollSettings((prev) => ({ ...prev, daysCount: 31 }))}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                    payrollSettings.daysCount === 31
                      ? "border-[#348bdd] bg-sky-50/40 text-slate-900 ring-1 ring-[#348bdd]"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-base font-medium font-mono block">31 Days</span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Full calendar month divisor
                  </span>
                </button>

                {/* Custom Input */}
                <div className="p-3 rounded-lg border border-slate-200 bg-white">
                  <span className="text-[11px] text-slate-500 block mb-1 font-medium uppercase tracking-wider">
                    Custom Divisor
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={payrollSettings.daysCount}
                    onChange={(e) =>
                      setPayrollSettings((prev) => ({
                        ...prev,
                        daysCount: Number(e.target.value) || 30,
                      }))
                    }
                    className="w-full text-sm font-mono font-medium px-2.5 py-1 rounded border bg-slate-50 border-slate-200 focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-1 font-mono">
                <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                  <HelpCircle size={13} className="text-[#348bdd]" />
                  <span>Formula Applied:</span>
                </div>
                <p>
                  Per Day Salary = <span className="text-slate-900">Monthly Salary ÷ {payrollSettings.daysCount}</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  Example: ₹18,000 ÷ {payrollSettings.daysCount} = ₹{(18000 / payrollSettings.daysCount).toFixed(2)} per day
                </p>
              </div>
            </div>

            {/* Loss of Pay (LOP) Rule Card */}
            <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shrink-0">
                  <TrendingDown size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900">
                    Loss of Pay (LOP) Rule Configuration
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Accepted leaves protect employees from salary deduction. Absences exceeding accepted leaves are deducted automatically.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-rose-50/40 border border-rose-100 text-xs text-slate-700 space-y-1.5">
                <div className="font-medium text-rose-800">Rule Logic:</div>
                <p>
                  If an employee is absent for <span className="font-medium text-slate-900">4 days</span>, and has{" "}
                  <span className="font-medium text-slate-900">2 accepted leaves</span>:
                </p>
                <div className="p-2 rounded bg-white border border-rose-200/70 font-mono text-xs text-rose-700">
                  Loss of Pay (LOP) Days = 4 Absents − 2 Accepted Leaves = 2 Days Deducted
                </div>
                <p className="text-[11px] text-slate-500">
                  Deduction Amount = Loss of Pay Days × Per Day Amount. (Half days count as 0.5 absences).
                </p>
              </div>
            </div>

            {/* Attendance Bonus Toggle & Setting */}
            <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
                    <Gift size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-900">
                      100% Full Attendance Bonus
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Rewards staff who have zero absent days during the month.
                    </p>
                  </div>
                </div>

                {/* Toggle */}
                <button
                  type="button"
                  onClick={() =>
                    setPayrollSettings((prev) => ({
                      ...prev,
                      isBonusEnabled: !prev.isBonusEnabled,
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    payrollSettings.isBonusEnabled ? "bg-[#348bdd]" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      payrollSettings.isBonusEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {payrollSettings.isBonusEnabled && (
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div>
                    <label className="block text-xs uppercase tracking-wider mb-1 font-medium text-slate-700">
                      Bonus Days Count (Number of Days Credited)
                    </label>
                    <div className="flex items-center gap-2 max-w-xs">
                      <input
                        type="number"
                        min="1"
                        max="15"
                        step="1"
                        value={payrollSettings.bonusDaysCount}
                        onChange={(e) =>
                          setPayrollSettings((prev) => ({
                            ...prev,
                            bonusDaysCount: Number(e.target.value) || 1,
                          }))
                        }
                        className="w-full text-xs px-3 py-2 rounded-lg border bg-white focus:outline-none font-mono font-medium focus:ring-1 focus:ring-[var(--color-brand-primary)] border-slate-200"
                      />
                      <span className="text-xs text-slate-500 font-mono">days</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-emerald-50/50 border border-emerald-100 text-xs text-emerald-900 space-y-1">
                    <div className="font-medium flex items-center gap-1.5">
                      <Sparkles size={13} className="text-emerald-600" />
                      <span>Bonus Rule Activated:</span>
                    </div>
                    <p className="text-[11px] text-emerald-700">
                      Employees with <span className="font-semibold">0 absent days</span> and full attendance will have{" "}
                      <span className="font-semibold font-mono">{payrollSettings.bonusDaysCount} days</span> worth of salary added to their net pay.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-5 py-2.5 text-xs rounded-lg text-white font-medium cursor-pointer shadow-sm flex items-center gap-1.5 transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: "var(--color-brand-primary)" }}
              >
                {isSavingSettings ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Save Payroll Settings</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          PRINTABLE DIGITAL PAYSLIP MODAL
         ========================================================================= */}
      {payslipRow && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono tracking-wider uppercase text-sky-400 block">
                  Ravi Sweets & Cold Drinks Chirala
                </span>
                <h3 className="text-sm font-medium">Monthly Salary Payslip</h3>
              </div>
              <div className="text-right font-mono text-xs text-slate-300">
                {MONTH_NAMES[selectedMonth]} {selectedYear}
              </div>
            </div>

            {/* Payslip Body (Printable) */}
            <div id="staff-payslip-sheet" className="p-6 space-y-4 text-xs bg-white text-slate-900">
              {/* Employee Summary Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-slate-900">{payslipRow.employee.name}</h4>
                  <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                    Employee ID: <span className="text-[#348bdd] font-medium">{payslipRow.employee.employeeId}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 capitalize">
                    {payslipRow.employee.salaryType} Staff • {payslipRow.employee.city}
                  </div>
                </div>

                <div className="text-right font-mono">
                  <span className="text-[10px] text-slate-400 uppercase block">Daily Rate</span>
                  <span className="text-xs font-medium text-slate-800">₹{payslipRow.perDayAmount} / d</span>
                </div>
              </div>

              {/* Attendance Breakdown */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-lg border border-emerald-100 bg-emerald-50/30">
                  <span className="text-[10px] text-emerald-600 block">Days Present</span>
                  <span className="text-sm font-medium font-mono text-emerald-800 mt-0.5 block">
                    {payslipRow.daysPresent} d
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border border-rose-100 bg-rose-50/30">
                  <span className="text-[10px] text-rose-600 block">Days Absent</span>
                  <span className="text-sm font-medium font-mono text-rose-800 mt-0.5 block">
                    {payslipRow.daysAbsent} d
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                  <span className="text-[10px] text-slate-500 block">Accepted Leaves</span>
                  <span className="text-sm font-medium font-mono text-slate-800 mt-0.5 block">
                    {payslipRow.acceptedLeaves} d
                  </span>
                </div>
              </div>

              {/* Earnings & Deductions Breakdown Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 font-medium text-slate-700">
                    <tr>
                      <th className="py-2 px-3">Description</th>
                      <th className="py-2 px-3 text-right">Calculation</th>
                      <th className="py-2 px-3 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {/* Base Gross */}
                    <tr>
                      <td className="py-2 px-3 font-sans">
                        Base Salary ({payslipRow.employee.salaryType})
                      </td>
                      <td className="py-2 px-3 text-right text-slate-500">
                        {payslipRow.employee.salaryType === "monthly" ? "Contracted Rate" : `${payslipRow.daysPresent} d × ₹${payslipRow.perDayAmount}`}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-800">
                        ₹{payslipRow.grossSalary.toFixed(2)}
                      </td>
                    </tr>

                    {/* Loss of Pay */}
                    {payslipRow.lossOfPayDays > 0 ? (
                      <tr className="text-rose-600 bg-rose-50/20">
                        <td className="py-2 px-3 font-sans">
                          Loss of Pay (LOP) Deduction
                        </td>
                        <td className="py-2 px-3 text-right text-xs">
                          {payslipRow.lossOfPayDays} d × ₹{payslipRow.perDayAmount}
                        </td>
                        <td className="py-2 px-3 text-right font-medium">
                          -₹{payslipRow.lossOfPayDeduction.toFixed(2)}
                        </td>
                      </tr>
                    ) : (
                      <tr className="text-slate-400">
                        <td className="py-2 px-3 font-sans">Loss of Pay Deduction</td>
                        <td className="py-2 px-3 text-right text-xs">Absences ≤ Leaves</td>
                        <td className="py-2 px-3 text-right">₹0.00</td>
                      </tr>
                    )}

                    {/* Bonus */}
                    {payslipRow.bonusDays > 0 && (
                      <tr className="text-emerald-700 bg-emerald-50/20">
                        <td className="py-2 px-3 font-sans">
                          100% Attendance Bonus
                        </td>
                        <td className="py-2 px-3 text-right text-xs">
                          +{payslipRow.bonusDays} d × ₹{payslipRow.perDayAmount}
                        </td>
                        <td className="py-2 px-3 text-right font-medium">
                          +₹{payslipRow.bonusAmount.toFixed(2)}
                        </td>
                      </tr>
                    )}

                    {/* Net Total */}
                    <tr className="bg-slate-50 text-slate-900 font-medium text-sm border-t-2 border-slate-300">
                      <td className="py-2.5 px-3 font-sans">Net Salary Payable</td>
                      <td className="py-2.5 px-3 text-right font-normal text-xs text-slate-500 font-sans">
                        Final Transfer
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#348bdd]">
                        ₹{payslipRow.netSalary.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Amount in Words */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase font-medium block">
                  Amount in Words
                </span>
                <p className="font-medium text-slate-900 text-xs italic mt-0.5">
                  {numberToWords(payslipRow.netSalary)}
                </p>
              </div>

              {/* Signatures */}
              <div className="pt-8 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
                <div>Employee Signature</div>
                <div>Authorized Signatory (Ravi Sweets)</div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-1.5 text-xs rounded-lg text-white font-medium cursor-pointer shadow-xs flex items-center gap-1.5"
                style={{ backgroundColor: "var(--color-brand-primary)" }}
              >
                <Printer size={13} />
                <span>Print Payslip</span>
              </button>
              <button
                type="button"
                onClick={() => setPayslipRow(null)}
                className="px-3.5 py-1.5 text-xs rounded-lg border bg-white text-slate-700 hover:bg-slate-50 font-medium cursor-pointer border-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
