"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import {
  CalendarCheck,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Loader2,
  Save,
  CheckCheck,
  User,
  Filter,
  History,
  Info
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

export type AttendanceStatus = "Present" | "Absent" | "Half Day";

export interface AttendanceRowState {
  status: AttendanceStatus;
  notes: string;
}

export default function EmployeeAttendancePage() {
  const { showToast } = useToast();

  // Selected date (YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Employees List
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState<boolean>(true);

  // Attendance Records mapped by employeeId: { [employeeId: string]: AttendanceRowState }
  const [attendanceState, setAttendanceState] = useState<{ [employeeId: string]: AttendanceRowState }>({});
  const [isLoadingAttendance, setIsLoadingAttendance] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | AttendanceStatus>("all");

  // 1. Subscribe to Active Employees
  useEffect(() => {
    setIsLoadingEmployees(true);
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
        setIsLoadingEmployees(false);
      },
      (error) => {
        console.error("Error loading employees:", error);
        showToast("Error loading staff directory", "error");
        setIsLoadingEmployees(false);
      }
    );

    return () => unsubscribe();
  }, [showToast]);

  // 2. Fetch or Listen to Attendance for Selected Date
  useEffect(() => {
    if (!selectedDate) return;
    setIsLoadingAttendance(true);

    const q = query(
      collection(db, "employee_attendance"),
      where("date", "==", selectedDate)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loaded: { [empId: string]: AttendanceRowState } = {};
        snapshot.docs.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.employeeId) {
            loaded[d.employeeId] = {
              status: d.status || "Present",
              notes: d.notes || "",
            };
          }
        });

        // Initialize state: For employees with existing saved records, use them.
        // For employees without records yet for this date, default to "Present".
        setAttendanceState((prev) => {
          const next = { ...loaded };
          employees.forEach((emp) => {
            if (!next[emp.id]) {
              next[emp.id] = { status: "Present", notes: "" };
            }
          });
          return next;
        });

        setIsLoadingAttendance(false);
      },
      (error) => {
        console.error("Error loading attendance for date:", error);
        setIsLoadingAttendance(false);
      }
    );

    return () => unsubscribe();
  }, [selectedDate, employees]);

  // Handle individual status change
  const handleStatusChange = (empId: string, status: AttendanceStatus) => {
    setAttendanceState((prev) => ({
      ...prev,
      [empId]: {
        ...(prev[empId] || { notes: "" }),
        status,
      },
    }));
  };

  // Handle individual notes change
  const handleNotesChange = (empId: string, notes: string) => {
    setAttendanceState((prev) => ({
      ...prev,
      [empId]: {
        ...(prev[empId] || { status: "Present" }),
        notes,
      },
    }));
  };

  // Bulk: Mark All Present
  const handleMarkAll = (status: AttendanceStatus) => {
    setAttendanceState((prev) => {
      const next = { ...prev };
      employees.forEach((emp) => {
        next[emp.id] = {
          ...(next[emp.id] || { notes: "" }),
          status,
        };
      });
      return next;
    });
    showToast(`Marked all active employees as "${status}"`, "info");
  };

  // Date Navigation Helpers
  const handleDateOffset = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split("T")[0]);
  };

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const state = attendanceState[emp.id];
      if (statusFilter !== "all" && state?.status !== statusFilter) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        emp.name.toLowerCase().includes(q) ||
        emp.employeeId.toLowerCase().includes(q) ||
        emp.phone.toLowerCase().includes(q) ||
        emp.city.toLowerCase().includes(q)
      );
    });
  }, [employees, attendanceState, statusFilter, searchQuery]);

  // Attendance Metrics for Selected Date
  const metrics = useMemo(() => {
    let presentCount = 0;
    let absentCount = 0;
    let halfDayCount = 0;

    employees.forEach((emp) => {
      const row = attendanceState[emp.id];
      if (!row || row.status === "Present") {
        presentCount++;
      } else if (row.status === "Absent") {
        absentCount++;
      } else if (row.status === "Half Day") {
        halfDayCount++;
      }
    });

    const total = employees.length;
    const effectivePresent = presentCount + halfDayCount * 0.5;
    const percent = total > 0 ? Math.round((effectivePresent / total) * 100) : 0;

    return { total, presentCount, absentCount, halfDayCount, percent };
  }, [employees, attendanceState]);

  // Save Attendance to Firestore
  const handleSaveAttendance = async () => {
    if (employees.length === 0) {
      showToast("No employees to save attendance for", "error");
      return;
    }

    setIsSaving(true);
    try {
      const savePromises = employees.map(async (emp) => {
        const row = attendanceState[emp.id] || { status: "Present", notes: "" };
        const docId = `${selectedDate}_${emp.id}`;
        const docRef = doc(db, "employee_attendance", docId);

        await setDoc(
          docRef,
          {
            date: selectedDate,
            employeeId: emp.id,
            employeeCode: emp.employeeId,
            employeeName: emp.name,
            salaryType: emp.salaryType,
            status: row.status,
            notes: (row.notes || "").trim(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      await Promise.all(savePromises);
      showToast(`Attendance for ${selectedDate} saved successfully!`, "success");
    } catch (error: any) {
      console.error("Save attendance error:", error);
      showToast("Error saving attendance: " + error.message, "error");
    } finally {
      setIsSaving(false);
    }
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
              <CalendarCheck size={18} />
            </div>
            <h1
              className="text-2xl text-[var(--color-text-primary)] tracking-tight"
              style={{ fontWeight: 500 }}
            >
              Employee Attendance
            </h1>
            <span
              className="px-2 py-0.5 text-xs rounded font-normal font-mono"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                border: "1px solid var(--color-border-base)",
                color: "var(--color-text-secondary)",
              }}
            >
              {selectedDate === todayStr ? "Today" : selectedDate}
            </span>
          </div>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            Daily attendance logger with Present, Absent, and Half-day status tracking.
          </p>
        </div>

        {/* Date Selector & Navigator */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleDateOffset(-1)}
              className="p-1.5 rounded-md border bg-white hover:bg-slate-50 transition-colors cursor-pointer"
              style={{ borderColor: "var(--color-border-base)" }}
              title="Previous Day"
            >
              <ChevronLeft size={15} />
            </button>

            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border bg-white"
              style={{ borderColor: "var(--color-border-base)" }}
            >
              <Calendar size={13} className="text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-xs font-mono font-medium text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={() => handleDateOffset(1)}
              className="p-1.5 rounded-md border bg-white hover:bg-slate-50 transition-colors cursor-pointer"
              style={{ borderColor: "var(--color-border-base)" }}
              title="Next Day"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {selectedDate !== todayStr && (
            <button
              onClick={() => setSelectedDate(todayStr)}
              className="px-2.5 py-1.5 text-xs rounded-md border bg-slate-50 text-[#348bdd] hover:bg-sky-50 border-sky-100 cursor-pointer font-medium"
            >
              Today
            </button>
          )}

          <button
            onClick={handleSaveAttendance}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-md text-white transition-opacity hover:opacity-90 font-normal shadow-xs cursor-pointer disabled:opacity-60"
            style={{ backgroundColor: "var(--color-brand-primary)" }}
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>Save Attendance</span>
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 block">
            Total Staff
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xl font-medium text-slate-900 font-mono">{metrics.total}</span>
            <Users size={16} className="text-[#348bdd]" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-emerald-100 bg-emerald-50/20 shadow-2xs">
          <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-600 block">
            Present
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xl font-medium text-emerald-700 font-mono">
              {metrics.presentCount}
            </span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-rose-100 bg-rose-50/20 shadow-2xs">
          <span className="text-[10px] font-medium uppercase tracking-wider text-rose-600 block">
            Absent
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xl font-medium text-rose-700 font-mono">
              {metrics.absentCount}
            </span>
            <XCircle size={16} className="text-rose-600" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-amber-100 bg-amber-50/20 shadow-2xs">
          <span className="text-[10px] font-medium uppercase tracking-wider text-amber-600 block">
            Half Day
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xl font-medium text-amber-700 font-mono">
              {metrics.halfDayCount}
            </span>
            <Clock size={16} className="text-amber-600" />
          </div>
        </div>
      </div>

      {/* Bulk Action & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Search Box */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border w-full sm:w-72 bg-white"
            style={{
              borderColor: "var(--color-border-base)",
            }}
          >
            <Search size={14} style={{ color: "var(--color-text-muted)" }} />
            <input
              type="text"
              placeholder="Search staff by name, code, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-transparent focus:outline-none"
              style={{ color: "var(--color-text-primary)" }}
            />
          </div>

          {/* Quick Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs px-2.5 py-1.5 rounded-md border bg-white focus:outline-none cursor-pointer"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            <option value="all">All Statuses</option>
            <option value="Present">Present Only</option>
            <option value="Absent">Absent Only</option>
            <option value="Half Day">Half Day Only</option>
          </select>

          {/* Bulk Buttons */}
          <button
            type="button"
            onClick={() => handleMarkAll("Present")}
            className="px-2.5 py-1.5 text-xs rounded-md border bg-white hover:bg-emerald-50 text-emerald-700 font-medium cursor-pointer border-emerald-200 transition-colors shadow-2xs"
          >
            All Present
          </button>
          <button
            type="button"
            onClick={() => handleMarkAll("Absent")}
            className="px-2.5 py-1.5 text-xs rounded-md border bg-white hover:bg-rose-50 text-rose-700 font-medium cursor-pointer border-rose-200 transition-colors shadow-2xs"
          >
            All Absent
          </button>
        </div>

        <div
          className="text-xs self-end sm:self-center font-normal"
          style={{ color: "var(--color-text-muted)" }}
        >
          Showing {filteredEmployees.length} of {employees.length} employees
        </div>
      </div>

      {/* Main Attendance Table (Supabase Table Editor Grid Style) */}
      <div
        className="rounded-lg border bg-white overflow-hidden shadow-xs"
        style={{ borderColor: "var(--color-border-base)" }}
      >
        {isLoadingEmployees || isLoadingAttendance ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2
              size={24}
              className="animate-spin"
              style={{ color: "var(--color-brand-primary)" }}
            />
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Loading attendance sheet...
            </span>
          </div>
        ) : filteredEmployees.length === 0 ? (
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
              No matching employees found
            </h3>
            <p className="text-xs mt-1 max-w-sm" style={{ color: "var(--color-text-muted)" }}>
              Try searching for a different name, employee ID, or change the status filter.
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
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50 w-36">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-800">employee_id</span>
                      <span className="text-[10px] font-mono text-slate-400">varchar</span>
                    </div>
                  </th>
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50 min-w-[180px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-800">staff_member</span>
                      <span className="text-[10px] font-mono text-slate-400">entity</span>
                    </div>
                  </th>
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50 min-w-[160px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-800">salary_plan</span>
                      <span className="text-[10px] font-mono text-slate-400">varchar</span>
                    </div>
                  </th>
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50 text-center w-72">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="font-medium text-slate-800">attendance_status</span>
                      <span className="text-[10px] font-mono text-slate-400">status</span>
                    </div>
                  </th>
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50 min-w-[200px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-800">shift_remarks</span>
                      <span className="text-[10px] font-mono text-slate-400">text</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredEmployees.map((emp) => {
                  const row = attendanceState[emp.id] || { status: "Present", notes: "" };
                  return (
                    <tr
                      key={emp.id}
                      className="divide-x divide-slate-200 hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Avatar */}
                      <td className="px-2 py-1.5 text-center">
                        {emp.profilePicUrl ? (
                          <img
                            src={emp.profilePicUrl}
                            alt={emp.name}
                            className="w-7 h-7 rounded-full object-cover border border-slate-200 mx-auto shadow-2xs"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center font-medium mx-auto text-[11px] font-mono">
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </td>

                      {/* ID */}
                      <td className="px-3.5 py-2 font-mono text-[11px] text-[#348bdd] font-medium">
                        {emp.employeeId || <span className="font-mono text-slate-300 italic text-[11px]">NULL</span>}
                      </td>

                      {/* Name & Phone */}
                      <td className="px-3.5 py-2">
                        <div className="font-medium text-slate-900">{emp.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {emp.phone} • {emp.city}
                        </div>
                      </td>

                      {/* Salary Plan */}
                      <td className="px-3.5 py-2 font-mono text-slate-700">
                        <span className="capitalize">{emp.salaryType}</span> (₹{emp.salaryAmount})
                        <div className="text-[10px] text-slate-400">
                          Leaves: {emp.acceptedLeaves} / mo
                        </div>
                      </td>

                      {/* Status Toggle Buttons */}
                      <td className="px-3.5 py-2 text-center">
                        <div className="inline-flex rounded-md border border-slate-200 p-0.5 bg-slate-50 gap-1 shadow-2xs">
                          {/* Present */}
                          <button
                            type="button"
                            onClick={() => handleStatusChange(emp.id, "Present")}
                            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                              row.status === "Present"
                                ? "bg-emerald-600 text-white shadow-2xs"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            }`}
                          >
                            <CheckCircle2 size={12} />
                            <span>Present</span>
                          </button>

                          {/* Absent */}
                          <button
                            type="button"
                            onClick={() => handleStatusChange(emp.id, "Absent")}
                            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                              row.status === "Absent"
                                ? "bg-rose-600 text-white shadow-2xs"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            }`}
                          >
                            <XCircle size={12} />
                            <span>Absent</span>
                          </button>

                          {/* Half Day */}
                          <button
                            type="button"
                            onClick={() => handleStatusChange(emp.id, "Half Day")}
                            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                              row.status === "Half Day"
                                ? "bg-amber-600 text-white shadow-2xs"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            }`}
                          >
                            <Clock size={12} />
                            <span>Half Day</span>
                          </button>
                        </div>
                      </td>

                      {/* Notes Input */}
                      <td className="px-3.5 py-2">
                        <input
                          type="text"
                          placeholder="Optional shift notes..."
                          value={row.notes}
                          onChange={(e) => handleNotesChange(emp.id, e.target.value)}
                          className="w-full text-xs px-2.5 py-1 rounded border bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)] border-slate-200"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
