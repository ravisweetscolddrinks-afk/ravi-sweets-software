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
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50/50">
      {/* Top Header */}
      <div
        className="px-6 py-4 bg-white border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{ borderColor: "var(--color-border-subtle)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center border bg-slate-50 text-[#348bdd]"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            <CalendarCheck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-medium text-slate-900">Employee Attendance</h1>
              <span className="px-2 py-0.5 text-[11px] rounded-full font-mono bg-sky-50 text-[#348bdd] border border-sky-100">
                {selectedDate === todayStr ? "Today" : selectedDate}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Daily attendance logger with Present, Absent, and Half-day status tracking
            </p>
          </div>
        </div>

        {/* Date Selector & Navigator */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDateOffset(-1)}
            className="p-2 rounded-lg border bg-white hover:bg-slate-50 text-slate-700 cursor-pointer border-slate-200 shadow-2xs transition-colors"
            title="Previous Day"
          >
            <ChevronLeft size={15} />
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-white border-slate-200 shadow-2xs">
            <Calendar size={14} className="text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-mono font-medium text-slate-900 bg-transparent focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={() => handleDateOffset(1)}
            className="p-2 rounded-lg border bg-white hover:bg-slate-50 text-slate-700 cursor-pointer border-slate-200 shadow-2xs transition-colors"
            title="Next Day"
          >
            <ChevronRight size={15} />
          </button>

          {selectedDate !== todayStr && (
            <button
              onClick={() => setSelectedDate(todayStr)}
              className="px-2.5 py-1.5 text-xs rounded-lg border bg-slate-50 text-[#348bdd] hover:bg-sky-50 border-sky-100 cursor-pointer font-medium shadow-2xs"
            >
              Today
            </button>
          )}

          <button
            onClick={handleSaveAttendance}
            disabled={isSaving}
            className="px-4 py-2 text-xs rounded-lg text-white font-medium cursor-pointer shadow-sm flex items-center gap-1.5 transition-opacity hover:opacity-90 disabled:opacity-60 ml-2"
            style={{ backgroundColor: "var(--color-brand-primary)" }}
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>Save Attendance</span>
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
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
      <div className="px-6 pb-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search staff by name, code, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
            style={{ borderColor: "var(--color-border-base)" }}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Quick Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs px-2.5 py-1.5 rounded-lg border bg-white focus:outline-none cursor-pointer"
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
            className="px-2.5 py-1.5 text-xs rounded-lg border bg-white hover:bg-emerald-50 text-emerald-700 font-medium cursor-pointer border-emerald-200 transition-colors shadow-2xs"
          >
            All Present
          </button>
          <button
            type="button"
            onClick={() => handleMarkAll("Absent")}
            className="px-2.5 py-1.5 text-xs rounded-lg border bg-white hover:bg-rose-50 text-rose-700 font-medium cursor-pointer border-rose-200 transition-colors shadow-2xs"
          >
            All Absent
          </button>
        </div>
      </div>

      {/* Main Attendance Table */}
      <div className="flex-1 px-6 pb-12">
        <div
          className="bg-white rounded-xl border overflow-hidden shadow-2xs"
          style={{ borderColor: "var(--color-border-subtle)" }}
        >
          {isLoadingEmployees || isLoadingAttendance ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 size={24} className="animate-spin text-[#348bdd]" />
              <span className="text-xs">Loading attendance sheet...</span>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              No matching employees found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b text-slate-600 font-medium border-slate-200/80">
                    <th className="py-3 px-4 w-12 text-center">Avatar</th>
                    <th className="py-3 px-4 w-32">Employee ID</th>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Salary Plan</th>
                    <th className="py-3 px-4 text-center w-72">Attendance Status</th>
                    <th className="py-3 px-4">Notes / Shift Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map((emp) => {
                    const row = attendanceState[emp.id] || { status: "Present", notes: "" };
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Avatar */}
                        <td className="py-2.5 px-4 text-center">
                          {emp.profilePicUrl ? (
                            <img
                              src={emp.profilePicUrl}
                              alt={emp.name}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 mx-auto shadow-2xs"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center font-medium mx-auto">
                              {emp.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </td>

                        {/* ID */}
                        <td className="py-2.5 px-4 font-mono text-[11px] text-[#348bdd] font-medium">
                          {emp.employeeId}
                        </td>

                        {/* Name & Phone */}
                        <td className="py-2.5 px-4">
                          <div className="font-medium text-slate-900">{emp.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            {emp.phone} • {emp.city}
                          </div>
                        </td>

                        {/* Salary Plan */}
                        <td className="py-2.5 px-4 font-mono text-slate-600">
                          <span className="capitalize">{emp.salaryType}</span> (₹{emp.salaryAmount})
                          <div className="text-[10px] text-slate-400">
                            Leaves: {emp.acceptedLeaves} / mo
                          </div>
                        </td>

                        {/* Status Toggle Buttons */}
                        <td className="py-2.5 px-4 text-center">
                          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 gap-1 shadow-2xs">
                            {/* Present */}
                            <button
                              type="button"
                              onClick={() => handleStatusChange(emp.id, "Present")}
                              className={`px-3 py-1.5 rounded-md font-medium text-xs flex items-center gap-1 transition-all cursor-pointer ${
                                row.status === "Present"
                                  ? "bg-emerald-600 text-white shadow-2xs"
                                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                              }`}
                            >
                              <CheckCircle2 size={13} />
                              <span>Present</span>
                            </button>

                            {/* Absent */}
                            <button
                              type="button"
                              onClick={() => handleStatusChange(emp.id, "Absent")}
                              className={`px-3 py-1.5 rounded-md font-medium text-xs flex items-center gap-1 transition-all cursor-pointer ${
                                row.status === "Absent"
                                  ? "bg-rose-600 text-white shadow-2xs"
                                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                              }`}
                            >
                              <XCircle size={13} />
                              <span>Absent</span>
                            </button>

                            {/* Half Day */}
                            <button
                              type="button"
                              onClick={() => handleStatusChange(emp.id, "Half Day")}
                              className={`px-3 py-1.5 rounded-md font-medium text-xs flex items-center gap-1 transition-all cursor-pointer ${
                                row.status === "Half Day"
                                  ? "bg-amber-600 text-white shadow-2xs"
                                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                              }`}
                            >
                              <Clock size={13} />
                              <span>Half Day</span>
                            </button>
                          </div>
                        </td>

                        {/* Notes Input */}
                        <td className="py-2.5 px-4">
                          <input
                            type="text"
                            placeholder="Optional shift notes..."
                            value={row.notes}
                            onChange={(e) => handleNotesChange(emp.id, e.target.value)}
                            className="w-full text-xs px-2.5 py-1 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)] border-slate-200"
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
    </div>
  );
}
