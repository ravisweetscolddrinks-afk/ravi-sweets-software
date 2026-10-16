"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { usePrinter } from "@/context/PrinterContext";
import {
  ShoppingBag,
  Search,
  Calendar,
  Store,
  User,
  Phone,
  Printer,
  Eye,
  CreditCard,
  Banknote,
  Smartphone,
  Split,
  Boxes,
  Loader2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  RotateCw,
  X,
  FileText,
} from "lucide-react";

interface SaleItem {
  id: string;
  productId?: string;
  name: string;
  unit: string;
  rate: number;
  quantity: number;
  totalAmount: number;
}

interface WalkInSaleRecord {
  id: string;
  billNumber: string;
  orderNumber: string;
  storeId: string;
  storeName: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  taxableSubtotal: number;
  cgst: number;
  sgst: number;
  grandTotal: number;
  paymentMethod: string;
  splitDetails?: { cash: number; upi: number; card: number };
  paymentStatus: string;
  deliveryDate: string;
  deliveryTime: string;
  createdAt: any;
}

interface StoreOption {
  id: string;
  name: string;
}

type DateFilter = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "all";
const PAGE_SIZE = 24;

export default function WalkInSalesPage() {
  const { printReceipt, maskPhoneNumber } = usePrinter();

  // Data states
  const [sales, setSales] = useState<WalkInSaleRecord[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters & Pagination
  const [selectedStoreId, setSelectedStoreId] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);

  // View modal
  const [viewingSale, setViewingSale] = useState<WalkInSaleRecord | null>(null);

  // 1. Subscribe to Walk-In Sales & Stores in Real-Time
  useEffect(() => {
    setIsLoading(true);

    const qSales = query(collection(db, "walk_in_sales"), orderBy("createdAt", "desc"));
    const unsubSales = onSnapshot(
      qSales,
      (snap) => {
        const list: WalkInSaleRecord[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<WalkInSaleRecord, "id">),
        }));
        setSales(list);
        setIsLoading(false);
      },
      (err) => {
        console.error("Sales listener error:", err);
        setIsLoading(false);
      }
    );

    const qStores = query(collection(db, "stores"), orderBy("name", "asc"));
    const unsubStores = onSnapshot(
      qStores,
      (snap) => {
        setStores(snap.docs.map((d) => ({ id: d.id, name: d.data().name || "Store" })));
      },
      (err) => console.warn("Stores error:", err)
    );

    return () => {
      unsubSales();
      unsubStores();
    };
  }, []);

  // Helper for Date Filtering
  const isDateInRange = useCallback(
    (dateStr?: string, filter?: DateFilter) => {
      if (!dateStr || filter === "all") return true;
      const todayStr = new Date().toISOString().split("T")[0];

      const getOffsetDate = (days: number) => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return d.toISOString().split("T")[0];
      };

      const now = new Date();

      switch (filter) {
        case "today":
          return dateStr === todayStr;
        case "yesterday":
          return dateStr === getOffsetDate(-1);
        case "this_week": {
          const firstDayOfWeek = new Date(now);
          firstDayOfWeek.setDate(now.getDate() - now.getDay());
          const start = firstDayOfWeek.toISOString().split("T")[0];
          return dateStr >= start && dateStr <= todayStr;
        }
        case "last_week": {
          const d = new Date(now);
          d.setDate(now.getDate() - now.getDay() - 7);
          const start = d.toISOString().split("T")[0];
          const end = getOffsetDate(-now.getDay() - 1);
          return dateStr >= start && dateStr <= end;
        }
        case "this_month": {
          const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
          return dateStr >= start;
        }
        default:
          return true;
      }
    },
    []
  );

  // Filtered Sales List
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      // Store filter
      if (selectedStoreId !== "all" && sale.storeId !== selectedStoreId) {
        return false;
      }

      // Date filter
      const dateToCheck = sale.deliveryDate || (sale.createdAt?.toDate ? sale.createdAt.toDate().toISOString().split("T")[0] : "");
      if (!isDateInRange(dateToCheck, dateFilter)) {
        return false;
      }

      // Payment filter
      if (paymentFilter !== "all" && sale.paymentMethod !== paymentFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesBill = sale.billNumber?.toLowerCase().includes(q) || sale.orderNumber?.toLowerCase().includes(q);
        const matchesCust = sale.customerName?.toLowerCase().includes(q) || sale.customerPhone?.toLowerCase().includes(q);
        const matchesStore = sale.storeName?.toLowerCase().includes(q);
        const matchesItem = sale.items?.some((i) => i.name.toLowerCase().includes(q));
        if (!matchesBill && !matchesCust && !matchesStore && !matchesItem) return false;
      }

      return true;
    });
  }, [sales, selectedStoreId, dateFilter, paymentFilter, searchQuery, isDateInRange]);

  // Paginated Sales
  const totalPages = Math.max(1, Math.ceil(filteredSales.length / PAGE_SIZE));
  const paginatedSales = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredSales.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredSales, currentPage]);

  // Revenue & Tender Metrics
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let cashTotal = 0;
    let upiTotal = 0;
    let cardTotal = 0;

    filteredSales.forEach((s) => {
      totalRevenue += s.grandTotal || 0;
      if (s.paymentMethod === "Cash") cashTotal += s.grandTotal || 0;
      else if (s.paymentMethod === "UPI") upiTotal += s.grandTotal || 0;
      else if (s.paymentMethod === "Card") cardTotal += s.grandTotal || 0;
      else if (s.paymentMethod === "Split" && s.splitDetails) {
        cashTotal += Number(s.splitDetails.cash || 0);
        upiTotal += Number(s.splitDetails.upi || 0);
        cardTotal += Number(s.splitDetails.card || 0);
      }
    });

    return {
      totalRevenue,
      billsCount: filteredSales.length,
      cashTotal,
      upiTotal,
      cardTotal,
    };
  }, [filteredSales]);

  // Handle Reprint
  const handleReprintReceipt = async (sale: WalkInSaleRecord) => {
    await printReceipt({
      orderNumber: sale.billNumber || sale.orderNumber,
      dateStr: sale.deliveryDate || new Date().toISOString().split("T")[0],
      timeStr: sale.deliveryTime || "",
      storeName: sale.storeName,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      items: sale.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        rate: i.rate,
        totalAmount: i.totalAmount,
      })),
      subtotal: sale.subtotal,
      discount: sale.discount,
      taxableSubtotal: sale.taxableSubtotal,
      cgst: sale.cgst,
      sgst: sale.sgst,
      grandTotal: sale.grandTotal,
      paymentMethod: sale.paymentMethod,
      splitDetails: sale.splitDetails,
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-49px)] w-full overflow-hidden bg-slate-50/50">
      {/* 1. Header Toolbar */}
      <div
        className="px-6 py-3 border-b bg-white flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xs"
        style={{ borderColor: "var(--color-border-subtle)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center border bg-blue-50/80 text-[#348bdd] shadow-2xs"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            <ShoppingBag size={22} className="stroke-[1.8]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1
                className="text-base tracking-tight text-slate-900"
                style={{ fontWeight: 500 }}
              >
                Walk In Sales
              </h1>
              <span className="px-2 py-0.5 text-[10px] rounded bg-blue-50 text-[#348bdd] font-mono font-medium border border-blue-200 uppercase">
                SETTLED COUNTER BILLS
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Chronological log of counter billing receipts, cashier tender summaries, and instant thermal reprints
            </p>
          </div>
        </div>

        {/* Revenue Metric Pills */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-blue-50/50 border-blue-200 text-blue-900 shadow-2xs">
            <TrendingUp size={14} className="text-[#348bdd]" />
            <div className="flex flex-col">
              <span className="text-[9px] text-blue-600 uppercase font-mono">Total Sales Volume</span>
              <span className="font-semibold text-xs font-mono">
                ₹{metrics.totalRevenue.toLocaleString()} ({metrics.billsCount} bills)
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-emerald-50/60 border-emerald-200 text-emerald-800 shadow-2xs">
            <Banknote size={14} className="text-emerald-600" />
            <div className="flex flex-col">
              <span className="text-[9px] text-emerald-600 uppercase font-mono">Cash Collected</span>
              <span className="font-semibold text-xs font-mono">
                ₹{metrics.cashTotal.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-indigo-50/60 border-indigo-200 text-indigo-800 shadow-2xs">
            <Smartphone size={14} className="text-indigo-600" />
            <div className="flex flex-col">
              <span className="text-[9px] text-indigo-600 uppercase font-mono">UPI / QR Collected</span>
              <span className="font-semibold text-xs font-mono">
                ₹{metrics.upiTotal.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Controls Toolbar: Store Selector, Date Filter, Payment Filter, Search */}
      <div
        className="px-6 py-2.5 border-b bg-white flex flex-wrap items-center justify-between gap-3 shrink-0"
        style={{ borderColor: "var(--color-border-subtle)" }}
      >
        {/* Left: Store Selector & Date Pills */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg p-1">
            <Store size={13} className="text-[#348bdd] ml-1" />
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-[#348bdd] cursor-pointer shadow-2xs"
            >
              <option value="all">All Retail Stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter Pills */}
          <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-white shadow-2xs text-xs">
            {(
              [
                { id: "today", label: "Today" },
                { id: "yesterday", label: "Yesterday" },
                { id: "this_week", label: "This Week" },
                { id: "this_month", label: "This Month" },
                { id: "all", label: "All Time" },
              ] as { id: DateFilter; label: string }[]
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setDateFilter(f.id);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  dateFilter === f.id
                    ? "bg-[#348bdd] text-white shadow-2xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Payment Mode Filter & Search Bar */}
        <div className="flex items-center gap-2.5 text-xs">
          <select
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#348bdd] cursor-pointer shadow-2xs"
          >
            <option value="all">All Payment Modes</option>
            <option value="Cash">Cash</option>
            <option value="UPI">UPI</option>
            <option value="Card">Card</option>
            <option value="Split">Split</option>
          </select>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white shadow-2xs w-56 focus-within:ring-1 focus-within:ring-[#348bdd]">
            <Search size={13} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search bill #, customer..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs bg-transparent focus:outline-none text-slate-800"
            />
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500 pl-1">
            <span>
              {currentPage} / {totalPages}
            </span>
            <div className="flex items-center border border-slate-200 rounded-md overflow-hidden bg-white shadow-2xs ml-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 hover:bg-slate-100 disabled:opacity-30 cursor-pointer border-r border-slate-200"
              >
                <ChevronLeft size={13} />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Bills Table View */}
      <div className="flex-1 overflow-auto bg-white p-4 sm:p-6">
        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 size={26} className="animate-spin text-[#348bdd]" />
            <span className="text-xs font-mono">Loading counter sales records...</span>
          </div>
        ) : paginatedSales.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200 p-8">
            <ShoppingBag size={32} className="text-slate-300 stroke-[1.5]" />
            <span className="text-sm font-medium text-slate-700">No Walk-In Bills Found</span>
            <span className="text-xs text-slate-400">
              No bills match your current filters. Settle bills in POS to see them appear live.
            </span>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b divide-x divide-slate-200 bg-slate-50 text-[11px] text-slate-600 uppercase font-mono sticky top-0 z-10">
                  <th className="py-2.5 px-3 min-w-[140px]">Bill Number</th>
                  <th className="py-2.5 px-3 min-w-[140px]">Date & Time</th>
                  <th className="py-2.5 px-3 min-w-[180px]">Customer</th>
                  <th className="py-2.5 px-3 min-w-[140px]">Store Outlet</th>
                  <th className="py-2.5 px-3 min-w-[200px]">Items Summary</th>
                  <th className="py-2.5 px-3 text-center min-w-[110px]">Payment Mode</th>
                  <th className="py-2.5 px-3 text-right min-w-[120px] bg-blue-50/50 text-[#348bdd]">
                    Grand Total
                  </th>
                  <th className="py-2.5 px-3 text-right min-w-[110px]">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedSales.map((sale, idx) => {
                  const maskedPhone = maskPhoneNumber(sale.customerPhone);

                  return (
                    <tr
                      key={sale.id ? `${sale.id}_${idx}` : `sale_${idx}`}
                      className="divide-x divide-slate-200 hover:bg-slate-50/70 transition-colors"
                    >
                      {/* Bill Number */}
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        <span className="text-[#348bdd]">#{sale.billNumber || sale.orderNumber}</span>
                      </td>

                      {/* Date & Time */}
                      <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px]">
                        <div>{sale.deliveryDate}</div>
                        <div className="text-[10px] text-slate-400">{sale.deliveryTime}</div>
                      </td>

                      {/* Customer */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900 text-xs">
                          {sale.customerName || "Walk-In Customer"}
                        </div>
                        {sale.customerPhone && (
                          <div className="text-[11px] font-mono text-slate-500">
                            {maskedPhone}
                          </div>
                        )}
                      </td>

                      {/* Store Outlet */}
                      <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          {sale.storeName}
                        </span>
                      </td>

                      {/* Items Summary */}
                      <td className="py-2.5 px-3 text-slate-700 text-xs max-w-xs truncate">
                        {sale.items?.map((i) => `${i.name} (${i.quantity} ${i.unit})`).join(", ") || "—"}
                      </td>

                      {/* Payment Mode */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border font-mono ${
                            sale.paymentMethod === "Cash"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : sale.paymentMethod === "UPI"
                              ? "bg-sky-50 text-sky-700 border-sky-200"
                              : sale.paymentMethod === "Card"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {sale.paymentMethod}
                        </span>
                      </td>

                      {/* Grand Total */}
                      <td className="py-2.5 px-3 text-right font-mono font-extrabold text-sm text-[#348bdd] bg-blue-50/25">
                        ₹{sale.grandTotal}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleReprintReceipt(sale)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#348bdd] hover:bg-[#2b7bc4] text-white text-[11px] font-medium transition-colors cursor-pointer shadow-2xs"
                            title="Print Thermal Receipt Slip"
                          >
                            <Printer size={12} />
                            <span>Print</span>
                          </button>
                          <button
                            onClick={() => setViewingSale(sale)}
                            className="p-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer shadow-2xs"
                            title="View Full Bill Details"
                          >
                            <Eye size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. View Bill Modal */}
      {viewingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-[#348bdd] flex items-center justify-center shadow-2xs">
                  <FileText size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
                    Counter Bill Details #{viewingSale.billNumber || viewingSale.orderNumber}
                  </h2>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {viewingSale.storeName} • {viewingSale.deliveryDate} {viewingSale.deliveryTime}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingSale(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              {/* Customer Banner */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-mono uppercase">Customer</span>
                  <div className="font-semibold text-slate-900 text-xs">
                    {viewingSale.customerName || "Walk-In Customer"}
                  </div>
                </div>
                {viewingSale.customerPhone && (
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-mono uppercase">Masked Phone</span>
                    <div className="font-mono text-slate-700 font-medium">
                      {maskPhoneNumber(viewingSale.customerPhone)}
                    </div>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div>
                <div className="text-[11px] font-mono text-slate-500 uppercase mb-1.5">
                  Items Purchased ({viewingSale.items?.length || 0})
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {viewingSale.items?.map((item, i) => (
                    <div key={i} className="p-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          ₹{item.rate} / {item.unit}
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-slate-600">{item.quantity} {item.unit}</div>
                        <div className="font-bold text-slate-900">₹{item.totalAmount.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 font-mono text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>₹{viewingSale.subtotal.toFixed(2)}</span>
                </div>
                {viewingSale.discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount:</span>
                    <span>-₹{viewingSale.discount.toFixed(2)}</span>
                  </div>
                )}
                {viewingSale.cgst > 0 && (
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>CGST:</span>
                    <span>₹{viewingSale.cgst.toFixed(2)}</span>
                  </div>
                )}
                {viewingSale.sgst > 0 && (
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>SGST:</span>
                    <span>₹{viewingSale.sgst.toFixed(2)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-slate-900">
                  <span>Grand Total Paid:</span>
                  <span className="text-[#348bdd]">₹{viewingSale.grandTotal}</span>
                </div>
                <div className="flex justify-between text-slate-500 text-[11px] pt-1">
                  <span>Payment Mode:</span>
                  <span className="font-semibold text-slate-800">{viewingSale.paymentMethod}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleReprintReceipt(viewingSale)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#348bdd] hover:bg-[#2b7bc4] text-white text-xs font-semibold cursor-pointer shadow-2xs"
              >
                <Printer size={13} />
                <span>Reprint Receipt Slip</span>
              </button>

              <button
                type="button"
                onClick={() => setViewingSale(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium cursor-pointer hover:bg-slate-100"
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
