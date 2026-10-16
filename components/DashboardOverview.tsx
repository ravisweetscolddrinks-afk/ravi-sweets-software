"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Banknote,
  CreditCard,
  QrCode,
  Receipt,
  Calendar,
  RotateCw,
  ShoppingBag,
  ShoppingCart,
  ArrowUpRight,
  PieChart,
  BarChart3,
  Activity,
  Percent,
  Store,
  Clock,
  Sparkles,
  Filter,
  Layers,
  ChevronDown,
  Check,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  PackageCheck,
  Building,
} from "lucide-react";

// --- TYPES ---
export type DatePreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "custom";

interface PaymentBreakdown {
  total: number;
  cash: number;
  card: number;
  upi: number;
  gst: number;
  cgst: number;
  sgst: number;
  count: number;
}

interface TimelinePoint {
  dateKey: string;
  label: string;
  walkInRevenue: number;
  orderRevenue: number;
  totalRevenue: number;
  cumulativeRevenue: number;
}

export default function DashboardOverview() {
  // 1. Data States
  const [walkInSales, setWalkInSales] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 2. Date Filtering State
  const [datePreset, setDatePreset] = useState<DatePreset>("today");

  // Format Date to YYYY-MM-DD
  const formatDateISO = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const todayStr = useMemo(() => formatDateISO(new Date()), []);

  const [customStartDate, setCustomStartDate] = useState<string>(todayStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  // Calculate [startDate, endDate] based on preset
  const { startDate, endDate, dateRangeLabel } = useMemo(() => {
    const now = new Date();
    let s = todayStr;
    let e = todayStr;
    let label = "Today";

    switch (datePreset) {
      case "today": {
        s = todayStr;
        e = todayStr;
        label = "Today";
        break;
      }
      case "yesterday": {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        s = formatDateISO(y);
        e = s;
        label = "Yesterday";
        break;
      }
      case "this_week": {
        const dayOfWeek = now.getDay(); // 0 is Sunday
        const start = new Date(now);
        start.setDate(now.getDate() - dayOfWeek);
        s = formatDateISO(start);
        e = todayStr;
        label = "This Week";
        break;
      }
      case "last_week": {
        const dayOfWeek = now.getDay();
        const start = new Date(now);
        start.setDate(now.getDate() - dayOfWeek - 7);
        const end = new Date(now);
        end.setDate(now.getDate() - dayOfWeek - 1);
        s = formatDateISO(start);
        e = formatDateISO(end);
        label = "Last Week";
        break;
      }
      case "this_month": {
        s = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        e = todayStr;
        label = "This Month";
        break;
      }
      case "last_month": {
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        s = formatDateISO(prevMonth);
        e = formatDateISO(lastDayPrevMonth);
        label = "Last Month";
        break;
      }
      case "custom": {
        s = customStartDate || todayStr;
        e = customEndDate || todayStr;
        label = "Custom Range";
        break;
      }
    }

    return { startDate: s, endDate: e, dateRangeLabel: label };
  }, [datePreset, customStartDate, customEndDate, todayStr]);

  // 3. Real-Time Listeners for Walk-In Sales & Orders
  useEffect(() => {
    setIsLoading(true);

    const unsubWalkIn = onSnapshot(
      query(collection(db, "walk_in_sales"), orderBy("createdAt", "desc")),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setWalkInSales(list);
      },
      (err) => console.warn("Walk-in sales listener error:", err)
    );

    const unsubOrders = onSnapshot(
      query(collection(db, "orders"), orderBy("createdAt", "desc")),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setOrders(list);
        setIsLoading(false);
      },
      (err) => {
        console.warn("Orders listener error:", err);
        setIsLoading(false);
      }
    );

    return () => {
      unsubWalkIn();
      unsubOrders();
    };
  }, []);

  // Helper to extract clean YYYY-MM-DD from record
  const getRecordDate = useCallback((item: any): string => {
    if (item.createdAt) {
      if (typeof item.createdAt.toDate === "function") {
        return formatDateISO(item.createdAt.toDate());
      }
      if (item.createdAt instanceof Date) {
        return formatDateISO(item.createdAt);
      }
      if (typeof item.createdAt === "string" && item.createdAt.length >= 10) {
        return item.createdAt.slice(0, 10);
      }
    }
    if (item.deliveryDate && typeof item.deliveryDate === "string") {
      return item.deliveryDate.slice(0, 10);
    }
    return todayStr;
  }, [todayStr]);

  // Helper to parse payment details
  const parsePayment = (item: any) => {
    const rawTotal = Number(
      item.receivedAmount !== undefined ? item.receivedAmount : item.grandTotal
    ) || 0;
    const method = String(item.paymentMethod || "Cash").toLowerCase();

    let cash = 0;
    let card = 0;
    let upi = 0;

    if (method.includes("split")) {
      const s = item.splitDetails || {};
      cash = Number(s.cash) || 0;
      card = Number(s.card) || 0;
      upi = Number(s.upi) || 0;
      if (cash === 0 && card === 0 && upi === 0) {
        cash = rawTotal;
      }
    } else if (method.includes("card")) {
      card = rawTotal;
    } else if (
      method.includes("upi") ||
      method.includes("online") ||
      method.includes("qr") ||
      method.includes("gpay") ||
      method.includes("phonepe")
    ) {
      upi = rawTotal;
    } else {
      cash = rawTotal;
    }

    const cgst = Number(item.cgst) || 0;
    const sgst = Number(item.sgst) || 0;
    const gst = cgst + sgst;

    return { total: rawTotal, cash, card, upi, gst, cgst, sgst };
  };

  // 4. Filter Records by Selected Date Range
  const filteredWalkInSales = useMemo(() => {
    return walkInSales.filter((s) => {
      const d = getRecordDate(s);
      return d >= startDate && d <= endDate;
    });
  }, [walkInSales, startDate, endDate, getRecordDate]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const d = getRecordDate(o);
      return d >= startDate && d <= endDate;
    });
  }, [orders, startDate, endDate, getRecordDate]);

  // 5. Aggregate Analytics
  // (a) Walk-In Sales Analytics
  const walkInAnalytics: PaymentBreakdown = useMemo(() => {
    let total = 0,
      cash = 0,
      card = 0,
      upi = 0,
      gst = 0,
      cgst = 0,
      sgst = 0;

    filteredWalkInSales.forEach((s) => {
      const p = parsePayment(s);
      total += p.total;
      cash += p.cash;
      card += p.card;
      upi += p.upi;
      gst += p.gst;
      cgst += p.cgst;
      sgst += p.sgst;
    });

    return {
      total,
      cash,
      card,
      upi,
      gst,
      cgst,
      sgst,
      count: filteredWalkInSales.length,
    };
  }, [filteredWalkInSales]);

  // (b) Orders Analytics
  const orderAnalytics: PaymentBreakdown & { pendingBalance: number } = useMemo(() => {
    let total = 0,
      cash = 0,
      card = 0,
      upi = 0,
      gst = 0,
      cgst = 0,
      sgst = 0,
      pendingBalance = 0;

    filteredOrders.forEach((o) => {
      const p = parsePayment(o);
      total += p.total;
      cash += p.cash;
      card += p.card;
      upi += p.upi;
      gst += p.gst;
      cgst += p.cgst;
      sgst += p.sgst;

      const grand = Number(o.grandTotal) || 0;
      const rec = Number(o.receivedAmount !== undefined ? o.receivedAmount : grand) || 0;
      if (grand > rec) {
        pendingBalance += grand - rec;
      }
    });

    return {
      total,
      cash,
      card,
      upi,
      gst,
      cgst,
      sgst,
      count: filteredOrders.length,
      pendingBalance,
    };
  }, [filteredOrders]);

  // (c) Combined Executive Overview (Walk-In Sales + Orders)
  const combinedAnalytics = useMemo(() => {
    const total = walkInAnalytics.total + orderAnalytics.total;
    const cash = walkInAnalytics.cash + orderAnalytics.cash;
    const card = walkInAnalytics.card + orderAnalytics.card;
    const upi = walkInAnalytics.upi + orderAnalytics.upi;
    const gst = walkInAnalytics.gst + orderAnalytics.gst;
    const cgst = walkInAnalytics.cgst + orderAnalytics.cgst;
    const sgst = walkInAnalytics.sgst + orderAnalytics.sgst;
    const count = walkInAnalytics.count + orderAnalytics.count;

    const cashPercent = total > 0 ? Math.round((cash / total) * 100) : 0;
    const cardPercent = total > 0 ? Math.round((card / total) * 100) : 0;
    const upiPercent = total > 0 ? Math.round((upi / total) * 100) : 0;

    const walkInShare = total > 0 ? Math.round((walkInAnalytics.total / total) * 100) : 50;
    const orderShare = total > 0 ? Math.round((orderAnalytics.total / total) * 100) : 50;

    return {
      total,
      cash,
      card,
      upi,
      gst,
      cgst,
      sgst,
      count,
      cashPercent,
      cardPercent,
      upiPercent,
      walkInShare,
      orderShare,
    };
  }, [walkInAnalytics, orderAnalytics]);

  // 6. Build Timeline Data Points for Visual Graphs (Bar, Curve, Area)
  const timelineData: TimelinePoint[] = useMemo(() => {
    const map = new Map<string, { walkIn: number; order: number }>();

    // Generate list of days between startDate and endDate
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.min(60, Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1));

    for (let i = 0; i < diffDays; i++) {
      const cur = new Date(start);
      cur.setDate(start.getDate() + i);
      const key = formatDateISO(cur);
      map.set(key, { walkIn: 0, order: 0 });
    }

    filteredWalkInSales.forEach((s) => {
      const d = getRecordDate(s);
      if (map.has(d)) {
        const item = map.get(d)!;
        item.walkIn += Number(s.grandTotal) || 0;
      }
    });

    filteredOrders.forEach((o) => {
      const d = getRecordDate(o);
      if (map.has(d)) {
        const item = map.get(d)!;
        item.order += Number(o.receivedAmount !== undefined ? o.receivedAmount : o.grandTotal) || 0;
      }
    });

    let cum = 0;
    const points: TimelinePoint[] = [];

    Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([dateKey, val]) => {
        const dObj = new Date(dateKey);
        const dayLabel = dObj.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        });

        const dayTotal = val.walkIn + val.order;
        cum += dayTotal;

        points.push({
          dateKey,
          label: dayLabel,
          walkInRevenue: val.walkIn,
          orderRevenue: val.order,
          totalRevenue: dayTotal,
          cumulativeRevenue: cum,
        });
      });

    return points;
  }, [startDate, endDate, filteredWalkInSales, filteredOrders, getRecordDate]);

  // Chart Scaling & Dimensions
  const maxDayRevenue = useMemo(() => {
    const maxVal = Math.max(1000, ...timelineData.map((p) => Math.max(p.walkInRevenue, p.orderRevenue, p.totalRevenue)));
    return maxVal;
  }, [timelineData]);

  const maxCumulativeRevenue = useMemo(() => {
    const last = timelineData[timelineData.length - 1];
    return Math.max(1000, last?.cumulativeRevenue || 1000);
  }, [timelineData]);

  // Helper for Bézier smoothing on SVG paths
  const generateSmoothSvgPath = (points: { x: number; y: number }[]): string => {
    if (points.length === 0) return "";
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const controlX = (current.x + next.x) / 2;
      path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
    }
    return path;
  };

  // Hover state for interactive chart tooltip
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full space-y-7">
      {/* =========================================================================
          TOP HEADER: TITLE, BRAND STATUS & REFRESH
         ========================================================================= */}
      <div
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b"
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
              <BarChart3 size={18} />
            </div>
            <h1
              className="text-2xl text-[var(--color-text-primary)] tracking-tight"
              style={{ fontWeight: 500 }}
            >
              Executive Sales Dashboard
            </h1>
            <span
              className="px-2 py-0.5 text-xs rounded font-normal font-mono"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                border: "1px solid var(--color-border-base)",
                color: "var(--color-text-secondary)",
              }}
            >
              {dateRangeLabel} ({startDate} → {endDate})
            </span>
          </div>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            Live business performance across Walk-in Point-of-Sale (POS) and Catering / Bulk Orders.
          </p>
        </div>

        {/* Quick Date Presets & Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Pill Selector */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            {(
              [
                { id: "today", label: "Today" },
                { id: "yesterday", label: "Yesterday" },
                { id: "this_week", label: "This Week" },
                { id: "last_week", label: "Last Week" },
                { id: "this_month", label: "This Month" },
                { id: "last_month", label: "Last Month" },
                { id: "custom", label: "Custom" },
              ] as { id: DatePreset; label: string }[]
            ).map((p) => {
              const isActive = datePreset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setDatePreset(p.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                    isActive
                      ? "bg-white text-slate-900 shadow-2xs font-medium"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Custom Date Range Picker */}
          {datePreset === "custom" && (
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs text-xs animate-in fade-in">
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">From</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-xs font-mono font-medium text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              />
              <span className="text-slate-300">→</span>
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">To</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-xs font-mono font-medium text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              />
            </div>
          )}

          {/* Refresh Data Indicator */}
          <div
            className="p-2 rounded-lg border bg-white border-slate-200 shadow-2xs text-slate-600"
            title="Realtime Firestore Sync Active"
          >
            <RotateCw size={14} className={isLoading ? "animate-spin text-[#348bdd]" : "text-emerald-600"} />
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 1: COMBINED REVENUE & PAYMENT MODE KPI CARDS (HERO CARDS)
         ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-slate-900 tracking-tight">
              Combined Revenue & Collections (Walk-in + Orders)
            </h2>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-50 text-[#348bdd] border border-sky-200 font-medium">
              Total {combinedAnalytics.count} Transactions
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Total Revenue */}
          <div className="p-4 rounded-xl border bg-white border-slate-200/90 shadow-2xs space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-medium uppercase tracking-wider">Total Revenue</span>
              <div className="w-7 h-7 rounded-lg bg-sky-50 text-[#348bdd] flex items-center justify-center border border-sky-100">
                <DollarSign size={14} />
              </div>
            </div>
            <div>
              <div className="text-xl font-medium font-mono text-slate-900">
                ₹{combinedAnalytics.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center justify-between mt-1">
                <span>Walk-in: ₹{walkInAnalytics.total.toLocaleString("en-IN")}</span>
                <span>Orders: ₹{orderAnalytics.total.toLocaleString("en-IN")}</span>
              </div>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex">
              <div
                className="bg-[#348bdd] h-full transition-all duration-500"
                style={{ width: `${combinedAnalytics.walkInShare}%` }}
                title={`Walk-in: ${combinedAnalytics.walkInShare}%`}
              />
              <div
                className="bg-amber-500 h-full transition-all duration-500"
                style={{ width: `${combinedAnalytics.orderShare}%` }}
                title={`Orders: ${combinedAnalytics.orderShare}%`}
              />
            </div>
          </div>

          {/* Card 2: Cash Collected */}
          <div className="p-4 rounded-xl border bg-white border-slate-200/90 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-700">Cash Collected</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <Banknote size={14} />
              </div>
            </div>
            <div>
              <div className="text-xl font-medium font-mono text-emerald-700">
                ₹{combinedAnalytics.cash.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center justify-between mt-1">
                <span className="font-mono">{combinedAnalytics.cashPercent}% of total</span>
                <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded font-medium">Physical Cash</span>
              </div>
            </div>
            <div className="w-full bg-emerald-50 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
                style={{ width: `${combinedAnalytics.cashPercent}%` }}
              />
            </div>
          </div>

          {/* Card 3: Card Collected */}
          <div className="p-4 rounded-xl border bg-white border-slate-200/90 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-medium uppercase tracking-wider text-blue-700">Card Collected</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                <CreditCard size={14} />
              </div>
            </div>
            <div>
              <div className="text-xl font-medium font-mono text-blue-700">
                ₹{combinedAnalytics.card.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center justify-between mt-1">
                <span className="font-mono">{combinedAnalytics.cardPercent}% of total</span>
                <span className="text-[10px] text-blue-600 bg-blue-50 px-1 py-0.2 rounded font-medium">POS Terminal</span>
              </div>
            </div>
            <div className="w-full bg-blue-50 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all duration-500 rounded-full"
                style={{ width: `${combinedAnalytics.cardPercent}%` }}
              />
            </div>
          </div>

          {/* Card 4: UPI Collected */}
          <div className="p-4 rounded-xl border bg-white border-slate-200/90 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-medium uppercase tracking-wider text-purple-700">UPI / QR Collected</span>
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
                <QrCode size={14} />
              </div>
            </div>
            <div>
              <div className="text-xl font-medium font-mono text-purple-700">
                ₹{combinedAnalytics.upi.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center justify-between mt-1">
                <span className="font-mono">{combinedAnalytics.upiPercent}% of total</span>
                <span className="text-[10px] text-purple-600 bg-purple-50 px-1 py-0.2 rounded font-medium">Instant Digital</span>
              </div>
            </div>
            <div className="w-full bg-purple-50 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-purple-500 h-full transition-all duration-500 rounded-full"
                style={{ width: `${combinedAnalytics.upiPercent}%` }}
              />
            </div>
          </div>

          {/* Card 5: GST Collected */}
          <div className="p-4 rounded-xl border bg-white border-slate-200/90 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-medium uppercase tracking-wider text-amber-700">GST Collected</span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                <Receipt size={14} />
              </div>
            </div>
            <div>
              <div className="text-xl font-medium font-mono text-amber-700">
                ₹{combinedAnalytics.gst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center justify-between mt-1">
                <span>CGST: ₹{combinedAnalytics.cgst.toLocaleString("en-IN")}</span>
                <span>SGST: ₹{combinedAnalytics.sgst.toLocaleString("en-IN")}</span>
              </div>
            </div>
            <div className="w-full bg-amber-50 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full transition-all duration-500 rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    combinedAnalytics.total > 0
                      ? Math.round((combinedAnalytics.gst / combinedAnalytics.total) * 100 * 5)
                      : 0
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: DEDICATED SEPARATE ANALYTICS FOR WALK-IN SALES & ORDERS
         ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-slate-900 tracking-tight">
            Channel Deep-Dive: Walk-In Sales vs Catering & Bulk Orders
          </h2>
          <span className="text-xs text-slate-400">
            Isolated financial metrics per channel
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Channel A: Walk-In Sales Card */}
          <div className="p-5 rounded-2xl border bg-white border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-50 text-[#348bdd] flex items-center justify-center border border-sky-100">
                  <ShoppingBag size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900">Walk-In Sales Analytics</h3>
                  <p className="text-[11px] text-slate-500">Counter POS billing and takeaway transactions</p>
                </div>
              </div>
              <Link
                href="/walk-in-sales"
                className="px-2.5 py-1 text-[11px] rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium inline-flex items-center gap-1 transition-colors"
              >
                <span>View Sales</span>
                <ChevronRight size={12} />
              </Link>
            </div>

            {/* Total Highlight */}
            <div className="p-4 rounded-xl bg-sky-50/50 border border-sky-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-sky-700 uppercase font-medium tracking-wider block">
                  Total Walk-In Revenue
                </span>
                <span className="text-2xl font-medium font-mono text-slate-900 mt-0.5 block">
                  ₹{walkInAnalytics.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block">Total Invoices</span>
                <span className="text-lg font-medium font-mono text-[#348bdd] block">
                  {walkInAnalytics.count} Bills
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Avg ₹
                  {walkInAnalytics.count > 0
                    ? Math.round(walkInAnalytics.total / walkInAnalytics.count)
                    : 0}
                  /bill
                </span>
              </div>
            </div>

            {/* Sub-metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
              <div className="p-2.5 rounded-lg border border-emerald-100 bg-emerald-50/20">
                <span className="text-[10px] text-emerald-700 font-sans block">Cash</span>
                <span className="text-sm font-medium text-emerald-800 mt-0.5 block">
                  ₹{walkInAnalytics.cash.toLocaleString("en-IN")}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {walkInAnalytics.total > 0
                    ? Math.round((walkInAnalytics.cash / walkInAnalytics.total) * 100)
                    : 0}
                  % share
                </span>
              </div>

              <div className="p-2.5 rounded-lg border border-blue-100 bg-blue-50/20">
                <span className="text-[10px] text-blue-700 font-sans block">Card</span>
                <span className="text-sm font-medium text-blue-800 mt-0.5 block">
                  ₹{walkInAnalytics.card.toLocaleString("en-IN")}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {walkInAnalytics.total > 0
                    ? Math.round((walkInAnalytics.card / walkInAnalytics.total) * 100)
                    : 0}
                  % share
                </span>
              </div>

              <div className="p-2.5 rounded-lg border border-purple-100 bg-purple-50/20">
                <span className="text-[10px] text-purple-700 font-sans block">UPI / QR</span>
                <span className="text-sm font-medium text-purple-800 mt-0.5 block">
                  ₹{walkInAnalytics.upi.toLocaleString("en-IN")}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {walkInAnalytics.total > 0
                    ? Math.round((walkInAnalytics.upi / walkInAnalytics.total) * 100)
                    : 0}
                  % share
                </span>
              </div>

              <div className="p-2.5 rounded-lg border border-amber-100 bg-amber-50/20">
                <span className="text-[10px] text-amber-700 font-sans block">GST Collected</span>
                <span className="text-sm font-medium text-amber-800 mt-0.5 block">
                  ₹{walkInAnalytics.gst.toLocaleString("en-IN")}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  ₹{walkInAnalytics.cgst.toLocaleString("en-IN")} C + S
                </span>
              </div>
            </div>
          </div>

          {/* Channel B: Orders Analytics Card */}
          <div className="p-5 rounded-2xl border bg-white border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                  <ShoppingCart size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900">Orders Analytics</h3>
                  <p className="text-[11px] text-slate-500">Catering, weddings, bulk festive boxes & delivery orders</p>
                </div>
              </div>
              <Link
                href="/orders"
                className="px-2.5 py-1 text-[11px] rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium inline-flex items-center gap-1 transition-colors"
              >
                <span>View Orders</span>
                <ChevronRight size={12} />
              </Link>
            </div>

            {/* Total Highlight */}
            <div className="p-4 rounded-xl bg-amber-50/40 border border-amber-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-amber-800 uppercase font-medium tracking-wider block">
                  Total Orders Revenue
                </span>
                <span className="text-2xl font-medium font-mono text-slate-900 mt-0.5 block">
                  ₹{orderAnalytics.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block">Orders Booked</span>
                <span className="text-lg font-medium font-mono text-amber-700 block">
                  {orderAnalytics.count} Orders
                </span>
                {orderAnalytics.pendingBalance > 0 && (
                  <span className="text-[10px] text-rose-600 font-mono block">
                    Unpaid Balance: ₹{orderAnalytics.pendingBalance.toLocaleString("en-IN")}
                  </span>
                )}
              </div>
            </div>

            {/* Sub-metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
              <div className="p-2.5 rounded-lg border border-emerald-100 bg-emerald-50/20">
                <span className="text-[10px] text-emerald-700 font-sans block">Cash</span>
                <span className="text-sm font-medium text-emerald-800 mt-0.5 block">
                  ₹{orderAnalytics.cash.toLocaleString("en-IN")}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {orderAnalytics.total > 0
                    ? Math.round((orderAnalytics.cash / orderAnalytics.total) * 100)
                    : 0}
                  % share
                </span>
              </div>

              <div className="p-2.5 rounded-lg border border-blue-100 bg-blue-50/20">
                <span className="text-[10px] text-blue-700 font-sans block">Card</span>
                <span className="text-sm font-medium text-blue-800 mt-0.5 block">
                  ₹{orderAnalytics.card.toLocaleString("en-IN")}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {orderAnalytics.total > 0
                    ? Math.round((orderAnalytics.card / orderAnalytics.total) * 100)
                    : 0}
                  % share
                </span>
              </div>

              <div className="p-2.5 rounded-lg border border-purple-100 bg-purple-50/20">
                <span className="text-[10px] text-purple-700 font-sans block">UPI / Online</span>
                <span className="text-sm font-medium text-purple-800 mt-0.5 block">
                  ₹{orderAnalytics.upi.toLocaleString("en-IN")}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {orderAnalytics.total > 0
                    ? Math.round((orderAnalytics.upi / orderAnalytics.total) * 100)
                    : 0}
                  % share
                </span>
              </div>

              <div className="p-2.5 rounded-lg border border-amber-100 bg-amber-50/20">
                <span className="text-[10px] text-amber-700 font-sans block">GST Collected</span>
                <span className="text-sm font-medium text-amber-800 mt-0.5 block">
                  ₹{orderAnalytics.gst.toLocaleString("en-IN")}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  ₹{orderAnalytics.cgst.toLocaleString("en-IN")} C + S
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 3: GRAPHICAL REPRESENTATIONS (BAR, PIE, AREA, CURVE, PROGRESS)
         ========================================================================= */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-slate-900 tracking-tight">
              Interactive Visual Analytics & Performance Charts
            </h2>
            <p className="text-xs text-slate-500">
              Comparative bar graphs, payment mode donut charts, area progression, and smooth trend curves.
            </p>
          </div>
        </div>

        {/* ROW 1: Bar Graph (Daily Comparison) + Pie / Donut Chart (Payment Split) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* 1. BAR GRAPH: Walk-in vs Orders Comparison */}
          <div className="lg:col-span-8 p-5 rounded-2xl border bg-white border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-medium text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 size={14} className="text-[#348bdd]" />
                  <span>Revenue Timeline Bar Graph</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Daily revenue comparison: Walk-in Sales (Blue) vs Orders (Amber)
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#348bdd]" />
                  <span className="text-slate-600 text-[11px]">Walk-in Sales</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
                  <span className="text-slate-600 text-[11px]">Orders</span>
                </div>
              </div>
            </div>

            {/* Interactive SVG Bar Graph */}
            <div className="relative pt-4 pb-2">
              {timelineData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-xs text-slate-400">
                  No transaction records found for the selected date range.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[500px] h-52 flex items-end gap-3 px-2 border-b border-slate-200 pb-1">
                    {timelineData.map((point, idx) => {
                      const walkInHeight =
                        maxDayRevenue > 0
                          ? Math.round((point.walkInRevenue / maxDayRevenue) * 160)
                          : 0;
                      const orderHeight =
                        maxDayRevenue > 0
                          ? Math.round((point.orderRevenue / maxDayRevenue) * 160)
                          : 0;
                      const isHovered = hoveredPointIndex === idx;

                      return (
                        <div
                          key={point.dateKey}
                          className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                          onMouseEnter={() => setHoveredPointIndex(idx)}
                          onMouseLeave={() => setHoveredPointIndex(null)}
                        >
                          {/* Tooltip on hover */}
                          {isHovered && (
                            <div className="absolute -top-16 z-20 bg-slate-900 text-white text-[10px] rounded-lg p-2 shadow-lg whitespace-nowrap pointer-events-none font-mono">
                              <div className="font-sans font-medium text-slate-200 border-b border-slate-700 pb-1 mb-1">
                                {point.dateKey}
                              </div>
                              <div className="text-sky-300">Walk-in: ₹{point.walkInRevenue.toLocaleString("en-IN")}</div>
                              <div className="text-amber-300">Orders: ₹{point.orderRevenue.toLocaleString("en-IN")}</div>
                              <div className="text-white font-medium pt-0.5 border-t border-slate-800">
                                Total: ₹{point.totalRevenue.toLocaleString("en-IN")}
                              </div>
                            </div>
                          )}

                          {/* Bars Pair */}
                          <div className="w-full flex items-end justify-center gap-1 h-44">
                            {/* Walk-in Bar */}
                            <div
                              className="w-1/2 max-w-[16px] bg-[#348bdd] hover:bg-[#2563eb] rounded-t transition-all duration-300"
                              style={{ height: `${Math.max(3, walkInHeight)}px` }}
                              title={`Walk-in: ₹${point.walkInRevenue}`}
                            />
                            {/* Order Bar */}
                            <div
                              className="w-1/2 max-w-[16px] bg-amber-500 hover:bg-amber-600 rounded-t transition-all duration-300"
                              style={{ height: `${Math.max(3, orderHeight)}px` }}
                              title={`Orders: ₹${point.orderRevenue}`}
                            />
                          </div>

                          {/* X-axis Label */}
                          <span className="text-[10px] font-mono text-slate-500 truncate max-w-[40px] mt-1.5 block">
                            {point.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. PIE / DONUT CHART: Payment Modes Split */}
          <div className="lg:col-span-4 p-5 rounded-2xl border bg-white border-slate-200/90 shadow-2xs space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-medium text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <PieChart size={14} className="text-emerald-600" />
                <span>Payment Mode Donut Chart</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Distribution across Cash, Cards, and UPI
              </p>
            </div>

            {/* Circular Donut Diagram */}
            <div className="flex flex-col items-center justify-center my-auto py-2">
              <div className="relative w-40 h-40 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  {/* Background Track */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="#f1f5f9"
                    strokeWidth="12"
                  />
                  {/* Segment 1: Cash (Emerald) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="#10b981"
                    strokeWidth="12"
                    strokeDasharray={`${(combinedAnalytics.cashPercent / 100) * 238.76} 238.76`}
                    strokeDashoffset="0"
                    className="transition-all duration-700"
                  />
                  {/* Segment 2: Card (Blue) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="#3b82f6"
                    strokeWidth="12"
                    strokeDasharray={`${(combinedAnalytics.cardPercent / 100) * 238.76} 238.76`}
                    strokeDashoffset={`-${(combinedAnalytics.cashPercent / 100) * 238.76}`}
                    className="transition-all duration-700"
                  />
                  {/* Segment 3: UPI (Purple) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="#8b5cf6"
                    strokeWidth="12"
                    strokeDasharray={`${(combinedAnalytics.upiPercent / 100) * 238.76} 238.76`}
                    strokeDashoffset={`-${((combinedAnalytics.cashPercent + combinedAnalytics.cardPercent) / 100) * 238.76}`}
                    className="transition-all duration-700"
                  />
                </svg>

                {/* Center Label */}
                <div className="absolute text-center">
                  <span className="text-[10px] text-slate-400 font-sans block uppercase tracking-wider">Collections</span>
                  <span className="text-sm font-medium font-mono text-slate-900 block">
                    ₹{Math.round(combinedAnalytics.total / 1000)}k
                  </span>
                </div>
              </div>
            </div>

            {/* Legend & Breakdown */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-700 font-sans">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Cash
                </span>
                <span className="font-medium text-slate-900">
                  ₹{combinedAnalytics.cash.toLocaleString("en-IN")} ({combinedAnalytics.cashPercent}%)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-700 font-sans">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  Card
                </span>
                <span className="font-medium text-slate-900">
                  ₹{combinedAnalytics.card.toLocaleString("en-IN")} ({combinedAnalytics.cardPercent}%)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-700 font-sans">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  UPI / QR
                </span>
                <span className="font-medium text-slate-900">
                  ₹{combinedAnalytics.upi.toLocaleString("en-IN")} ({combinedAnalytics.upiPercent}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 2: Smooth Curve Graph (Bézier Spline) & Area Graph (Cumulative Growth) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 3. CURVE GRAPH: Continuous Trend Comparison */}
          <div className="p-5 rounded-2xl border bg-white border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-medium text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity size={14} className="text-[#348bdd]" />
                  <span>Smooth Curve Graph (Sales Trend Line)</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Continuous Bézier spline of Walk-in vs Orders across the date filter
                </p>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="px-2 py-0.5 rounded bg-sky-50 text-[#348bdd] border border-sky-100 font-medium">
                  Walk-in (Blue)
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100 font-medium">
                  Orders (Amber)
                </span>
              </div>
            </div>

            {/* SVG Curve Plot */}
            <div className="w-full h-52 relative pt-2">
              {timelineData.length < 2 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Select a wider date range (e.g. This Week, This Month) to view continuous curve splines.
                </div>
              ) : (
                <svg className="w-full h-full overflow-visible" viewBox="0 0 500 180" preserveAspectRatio="none">
                  {/* Subtle Gridlines */}
                  <line x1="0" y1="40" x2="500" y2="40" stroke="#f1f5f9" strokeDasharray="3 3" />
                  <line x1="0" y1="90" x2="500" y2="90" stroke="#f1f5f9" strokeDasharray="3 3" />
                  <line x1="0" y1="140" x2="500" y2="140" stroke="#f1f5f9" strokeDasharray="3 3" />

                  {/* Walk-in Curve */}
                  {(() => {
                    const step = 500 / Math.max(1, timelineData.length - 1);
                    const coords = timelineData.map((p, i) => ({
                      x: i * step,
                      y: 160 - (p.walkInRevenue / maxDayRevenue) * 140,
                    }));
                    return (
                      <>
                        <path
                          d={generateSmoothSvgPath(coords)}
                          fill="none"
                          stroke="#348bdd"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                        {coords.map((c, i) => (
                          <circle
                            key={`w-${i}`}
                            cx={c.x}
                            cy={c.y}
                            r="3"
                            fill="#ffffff"
                            stroke="#348bdd"
                            strokeWidth="2"
                          />
                        ))}
                      </>
                    );
                  })()}

                  {/* Orders Curve */}
                  {(() => {
                    const step = 500 / Math.max(1, timelineData.length - 1);
                    const coords = timelineData.map((p, i) => ({
                      x: i * step,
                      y: 160 - (p.orderRevenue / maxDayRevenue) * 140,
                    }));
                    return (
                      <>
                        <path
                          d={generateSmoothSvgPath(coords)}
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                        {coords.map((c, i) => (
                          <circle
                            key={`o-${i}`}
                            cx={c.x}
                            cy={c.y}
                            r="3"
                            fill="#ffffff"
                            stroke="#f59e0b"
                            strokeWidth="2"
                          />
                        ))}
                      </>
                    );
                  })()}
                </svg>
              )}
            </div>

            {/* X-axis indicators */}
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-100">
              <span>{timelineData[0]?.label || "Start"}</span>
              <span>
                Peak: ₹{maxDayRevenue.toLocaleString("en-IN")}
              </span>
              <span>{timelineData[timelineData.length - 1]?.label || "End"}</span>
            </div>
          </div>

          {/* 4. AREA GRAPH: Cumulative Revenue Growth */}
          <div className="p-5 rounded-2xl border bg-white border-slate-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-medium text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-emerald-600" />
                  <span>Cumulative Revenue Area Graph</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Total revenue progression over time with smooth area gradient fill
                </p>
              </div>

              <div className="text-right font-mono">
                <span className="text-[10px] text-slate-400 block uppercase">Final Total</span>
                <span className="text-sm font-medium text-emerald-700 block">
                  ₹{combinedAnalytics.total.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* SVG Area Plot */}
            <div className="w-full h-52 relative pt-2">
              {timelineData.length < 2 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Select a wider date range to view cumulative revenue progression.
                </div>
              ) : (
                <svg className="w-full h-full overflow-visible" viewBox="0 0 500 180" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                      <stop offset="85%" stopColor="#10b981" stopOpacity="0.04" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Subtle Gridlines */}
                  <line x1="0" y1="40" x2="500" y2="40" stroke="#f1f5f9" strokeDasharray="3 3" />
                  <line x1="0" y1="90" x2="500" y2="90" stroke="#f1f5f9" strokeDasharray="3 3" />
                  <line x1="0" y1="140" x2="500" y2="140" stroke="#f1f5f9" strokeDasharray="3 3" />

                  {(() => {
                    const step = 500 / Math.max(1, timelineData.length - 1);
                    const coords = timelineData.map((p, i) => ({
                      x: i * step,
                      y: 160 - (p.cumulativeRevenue / maxCumulativeRevenue) * 140,
                    }));

                    const linePath = generateSmoothSvgPath(coords);
                    const firstX = coords[0].x;
                    const lastX = coords[coords.length - 1].x;
                    const closedAreaPath = `${linePath} L ${lastX} 170 L ${firstX} 170 Z`;

                    return (
                      <>
                        <path d={closedAreaPath} fill="url(#areaGradient)" />
                        <path
                          d={linePath}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                        {coords.map((c, i) => (
                          <circle
                            key={`a-${i}`}
                            cx={c.x}
                            cy={c.y}
                            r="3"
                            fill="#ffffff"
                            stroke="#10b981"
                            strokeWidth="2"
                          />
                        ))}
                      </>
                    );
                  })()}
                </svg>
              )}
            </div>

            {/* X-axis indicators */}
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-100">
              <span>{timelineData[0]?.label || "Start"}</span>
              <span className="text-emerald-700 font-medium">Progressive Inflow</span>
              <span>{timelineData[timelineData.length - 1]?.label || "End"}</span>
            </div>
          </div>
        </div>

        {/* ROW 3: PROGRESS BARS & GAUGES */}
        <div className="p-5 rounded-2xl border bg-white border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-medium text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Percent size={14} className="text-purple-600" />
                <span>Performance & Payment Distribution Progress</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Multi-metric progress bars comparing cash vs digital collections, channel splits, and tax contributions
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            {/* Progress 1: Payment Method Segmented Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-700 font-medium">Payment Mode Share</span>
                <span className="font-mono text-slate-500 text-[11px]">
                  {combinedAnalytics.cashPercent}% Cash • {combinedAnalytics.cardPercent}% Card • {combinedAnalytics.upiPercent}% UPI
                </span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex shadow-inner">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${combinedAnalytics.cashPercent}%` }}
                  title={`Cash: ${combinedAnalytics.cashPercent}%`}
                />
                <div
                  className="bg-blue-500 h-full transition-all duration-500"
                  style={{ width: `${combinedAnalytics.cardPercent}%` }}
                  title={`Card: ${combinedAnalytics.cardPercent}%`}
                />
                <div
                  className="bg-purple-500 h-full transition-all duration-500"
                  style={{ width: `${combinedAnalytics.upiPercent}%` }}
                  title={`UPI: ${combinedAnalytics.upiPercent}%`}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Cash (₹{combinedAnalytics.cash.toLocaleString("en-IN")})
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Card (₹{combinedAnalytics.card.toLocaleString("en-IN")})
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  UPI (₹{combinedAnalytics.upi.toLocaleString("en-IN")})
                </span>
              </div>
            </div>

            {/* Progress 2: Channel Contribution Split */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-700 font-medium">Channel Split</span>
                <span className="font-mono text-slate-500 text-[11px]">
                  {combinedAnalytics.walkInShare}% Walk-in vs {combinedAnalytics.orderShare}% Orders
                </span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex shadow-inner">
                <div
                  className="bg-[#348bdd] h-full transition-all duration-500"
                  style={{ width: `${combinedAnalytics.walkInShare}%` }}
                  title={`Walk-in: ${combinedAnalytics.walkInShare}%`}
                />
                <div
                  className="bg-amber-500 h-full transition-all duration-500"
                  style={{ width: `${combinedAnalytics.orderShare}%` }}
                  title={`Orders: ${combinedAnalytics.orderShare}%`}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#348bdd]" />
                  Walk-in (₹{walkInAnalytics.total.toLocaleString("en-IN")})
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Orders (₹{orderAnalytics.total.toLocaleString("en-IN")})
                </span>
              </div>
            </div>

            {/* Progress 3: GST Compliance Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-700 font-medium">GST Proportion of Invoiced Sales</span>
                <span className="font-mono text-amber-700 text-[11px]">
                  ₹{combinedAnalytics.gst.toLocaleString("en-IN")} Total Tax
                </span>
              </div>
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex shadow-inner">
                <div
                  className="bg-amber-500 h-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      combinedAnalytics.total > 0
                        ? Math.round((combinedAnalytics.gst / combinedAnalytics.total) * 100 * 5)
                        : 0
                    )}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>CGST: ₹{combinedAnalytics.cgst.toLocaleString("en-IN")}</span>
                <span>SGST: ₹{combinedAnalytics.sgst.toLocaleString("en-IN")}</span>
                <span className="text-slate-400">Net Taxable Base Included</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 4: QUICK ACCESS FOOTER WITH AUDIT SUMMARY
         ========================================================================= */}
      <div className="p-4 rounded-xl border bg-slate-50/70 border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-600" />
          <span>
            Connected to Live Firestore Database • Realtime updates enabled for Walk-In POS & Orders
          </span>
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px]">
          <Link href="/walk-in-sales" className="text-[#348bdd] hover:underline flex items-center gap-1">
            <span>Walk-in Invoices ({walkInSales.length})</span>
            <ExternalLink size={11} />
          </Link>
          <span className="text-slate-300">•</span>
          <Link href="/orders" className="text-[#348bdd] hover:underline flex items-center gap-1">
            <span>Orders Directory ({orders.length})</span>
            <ExternalLink size={11} />
          </Link>
        </div>
      </div>
    </div>
  );
}
