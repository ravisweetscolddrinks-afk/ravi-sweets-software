"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  doc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import CustomDatePicker from "@/components/CustomDatePicker";
import {
  Caterer,
  CateringOrder,
  CateringPaymentRecord,
  CateringPaymentStatus,
  DateFilterType,
  isDateMatchingFilter,
  getTodayDateStr,
} from "@/types/catering";
import {
  Wallet,
  Search,
  Calendar,
  Phone,
  Clock,
  MapPin,
  CreditCard,
  Banknote,
  Smartphone,
  RotateCw,
  X,
  Check,
  Eye,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Users,
  ChevronDown,
  Building,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function CateringCreditsPage() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();

  // Data states
  const [orders, setOrders] = useState<CateringOrder[]>([]);
  const [caterers, setCaterers] = useState<Caterer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Search & Filter controls
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<DateFilterType>("all");
  const [customFrom, setCustomFrom] = useState<string>(getTodayDateStr());
  const [customTo, setCustomTo] = useState<string>(getTodayDateStr());
  const [selectedCatererFilter, setSelectedCatererFilter] = useState<string>("all");

  // Read URL query params (e.g. ?catererId=...)
  useEffect(() => {
    const filterCat = searchParams.get("catererId");
    if (filterCat) {
      setSelectedCatererFilter(filterCat);
    }
  }, [searchParams]);

  // Modals state: Settle / Collect Payment
  const [settlingOrder, setSettlingOrder] = useState<CateringOrder | null>(null);
  const [settleAmountInput, setSettleAmountInput] = useState<number | string>("");
  const [settleMethod, setSettleMethod] = useState<"Cash" | "UPI" | "Card" | "Split">("Cash");
  const [splitCash, setSplitCash] = useState<number | string>("");
  const [splitUpi, setSplitUpi] = useState<number | string>("");
  const [splitCard, setSplitCard] = useState<number | string>("");
  const [settleNote, setSettleNote] = useState<string>("");
  const [isSubmittingSettle, setIsSubmittingSettle] = useState<boolean>(false);

  // View Details Modal
  const [viewingOrder, setViewingOrder] = useState<CateringOrder | null>(null);

  // 1. Subscribe to Catering Orders
  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, "catering_orders"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: CateringOrder[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setOrders(list);
        setIsLoading(false);
      },
      (err) => {
        console.error("Error loading catering orders:", err);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // 2. Subscribe to Caterers
  useEffect(() => {
    const q = query(collection(db, "caterers"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Caterer[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setCaterers(list);
      },
      (err) => {
        console.error("Error loading caterers:", err);
      }
    );
    return () => unsubscribe();
  }, []);

  // Filter partially paid / unpaid orders with credit due
  // (Requested: "display what order are partialed paid display ther i need all order which ar partially paid need search by caterers alos. but display order.")
  const partiallyPaidOrders = useMemo(() => {
    return orders.filter((ord) => ord.balanceAmount > 0 && ord.orderStatus !== "Cancelled");
  }, [orders]);

  // Apply filters to partially paid orders
  const filteredCreditOrders = useMemo(() => {
    return partiallyPaidOrders.filter((ord) => {
      // 1. Search Query (Matches Caterer Name, Mobile, Order #, City)
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        ord.catererName.toLowerCase().includes(q) ||
        ord.catererMobile.includes(q) ||
        ord.orderNumber.toLowerCase().includes(q) ||
        (ord.catererCity && ord.catererCity.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // 2. Filter by specific caterer
      if (selectedCatererFilter !== "all" && ord.catererId !== selectedCatererFilter) {
        return false;
      }

      // 3. Date Filter (on Order Date)
      return isDateMatchingFilter(ord.orderDate, dateFilter, customFrom, customTo);
    });
  }, [partiallyPaidOrders, searchQuery, selectedCatererFilter, dateFilter, customFrom, customTo]);

  // Metrics for Top Summary Cards
  const summaryMetrics = useMemo(() => {
    let totalPendingCredit = 0;
    let totalAdvanceCollected = 0;
    const uniqueCatererIds = new Set<string>();

    partiallyPaidOrders.forEach((o) => {
      totalPendingCredit += o.balanceAmount || 0;
      totalAdvanceCollected += o.advanceReceived || 0;
      if (o.catererId) uniqueCatererIds.add(o.catererId);
    });

    return {
      totalPendingCredit,
      totalAdvanceCollected,
      totalOrdersWithCredit: partiallyPaidOrders.length,
      caterersWithDuesCount: uniqueCatererIds.size,
    };
  }, [partiallyPaidOrders]);

  // Total credit due for selected caterer
  const selectedCatererDues = useMemo(() => {
    if (selectedCatererFilter === "all") return null;
    const cat = caterers.find((c) => c.id === selectedCatererFilter);
    const catOrders = partiallyPaidOrders.filter((o) => o.catererId === selectedCatererFilter);
    const sum = catOrders.reduce((acc, o) => acc + (o.balanceAmount || 0), 0);
    return {
      caterer: cat,
      ordersCount: catOrders.length,
      totalDue: sum,
    };
  }, [selectedCatererFilter, caterers, partiallyPaidOrders]);

  // Open Settle Payment Modal
  const handleOpenSettleModal = (order: CateringOrder) => {
    setSettlingOrder(order);
    setSettleAmountInput(order.balanceAmount > 0 ? order.balanceAmount : "");
    setSettleMethod("Cash");
    setSplitCash("");
    setSplitUpi("");
    setSplitCard("");
    setSettleNote("");
  };

  // Submit Settlement / Installment Payment
  const handleSaveSettlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingOrder) return;

    const payAmt = Number(settleAmountInput);
    if (isNaN(payAmt) || payAmt <= 0) {
      showToast("Please enter a valid payment amount", "error");
      return;
    }

    if (settleMethod === "Split") {
      const splitSum =
        Number(splitCash || 0) + Number(splitUpi || 0) + Number(splitCard || 0);
      if (splitSum !== payAmt) {
        showToast(
          `Split amounts sum (₹${splitSum}) must equal payment amount (₹${payAmt})`,
          "error"
        );
        return;
      }
    }

    try {
      setIsSubmittingSettle(true);
      const newAdvance = Number((settlingOrder.advanceReceived + payAmt).toFixed(2));
      const newBalance = Math.max(0, Number((settlingOrder.totalAmount - newAdvance).toFixed(2)));
      const newStatus: CateringPaymentStatus = newBalance <= 0 ? "Paid" : "Partial";

      const newHistoryEntry: CateringPaymentRecord = {
        id: `pay_${Date.now()}`,
        date: getTodayDateStr(),
        amount: payAmt,
        method: settleMethod,
        splitDetails:
          settleMethod === "Split"
            ? {
                cash: Number(splitCash) || 0,
                upi: Number(splitUpi) || 0,
                card: Number(splitCard) || 0,
              }
            : undefined,
        note: settleNote.trim() || "Credit installment settlement",
      };

      const updatedHistory = [...(settlingOrder.paymentHistory || []), newHistoryEntry];

      await updateDoc(doc(db, "catering_orders", settlingOrder.id), {
        advanceReceived: newAdvance,
        balanceAmount: newBalance,
        paymentStatus: newStatus,
        paymentHistory: updatedHistory,
        updatedAt: serverTimestamp(),
      });

      // Update caterer document credits
      if (settlingOrder.catererId) {
        try {
          const cat = caterers.find((c) => c.id === settlingOrder.catererId);
          if (cat) {
            const updatedCredits = Math.max(0, (cat.totalCredits || 0) - payAmt);
            await updateDoc(doc(db, "caterers", cat.id), {
              totalCredits: updatedCredits,
              updatedAt: serverTimestamp(),
            });
          }
        } catch (catErr) {
          console.warn("Could not update caterer dues:", catErr);
        }
      }

      showToast(
        `Payment of ₹${payAmt.toLocaleString("en-IN")} settled for ${settlingOrder.orderNumber}!`,
        "success"
      );
      setSettlingOrder(null);
    } catch (err: any) {
      console.error(err);
      showToast("Settlement failed: " + err.message, "error");
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full space-y-6">
      {/* 1. Header (Following Design Language) */}
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
              Catering Credits
            </h1>
            <span
              className="px-2 py-0.5 text-xs rounded font-normal font-mono"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                border: "1px solid var(--color-border-base)",
                color: "var(--color-text-secondary)",
              }}
            >
              {filteredCreditOrders.length} partially paid orders
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            Track partially paid catering orders, search by caterer, monitor pending balances, and record settlements.
          </p>
        </div>

        {/* Quick Link to Orders */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/catering-orders"
            className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-md border font-normal cursor-pointer bg-white hover:bg-slate-50 transition-colors shadow-2xs text-slate-700"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            <span>All Orders</span>
            <ExternalLink size={13} className="text-slate-400" />
          </Link>
        </div>
      </div>

      {/* 2. Metric KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-lg border bg-orange-50/60 border-orange-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-orange-900 block font-medium">Total Credit Due</span>
            <AlertCircle size={14} className="text-orange-600" />
          </div>
          <span className="text-xl font-mono text-orange-700 mt-1 block" style={{ fontWeight: 500 }}>
            ₹{summaryMetrics.totalPendingCredit.toLocaleString("en-IN")}
          </span>
          <span className="text-[10px] text-orange-600 block mt-0.5 font-mono">
            Across {summaryMetrics.totalOrdersWithCredit} orders
          </span>
        </div>

        <div className="p-3.5 rounded-lg border bg-white shadow-2xs" style={{ borderColor: "var(--color-border-base)" }}>
          <span className="text-[11px] text-slate-500 block">Partially Paid Orders</span>
          <span className="text-xl font-mono text-slate-900 mt-1 block" style={{ fontWeight: 500 }}>
            {summaryMetrics.totalOrdersWithCredit}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">Pending settlement</span>
        </div>

        <div className="p-3.5 rounded-lg border bg-white shadow-2xs" style={{ borderColor: "var(--color-border-base)" }}>
          <span className="text-[11px] text-slate-500 block">Caterers with Dues</span>
          <span className="text-xl font-mono text-slate-900 mt-1 block" style={{ fontWeight: 500 }}>
            {summaryMetrics.caterersWithDuesCount}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">Partners with credit</span>
        </div>

        <div className="p-3.5 rounded-lg border bg-emerald-50/50 border-emerald-200 shadow-2xs">
          <span className="text-[11px] text-emerald-800 block">Advance Collected</span>
          <span className="text-xl font-mono text-emerald-700 mt-1 block" style={{ fontWeight: 500 }}>
            ₹{summaryMetrics.totalAdvanceCollected.toLocaleString("en-IN")}
          </span>
          <span className="text-[10px] text-emerald-600 block mt-0.5 font-mono">Collected on credit orders</span>
        </div>
      </div>

      {/* Selected Caterer Dues Banner (if filtered by specific caterer) */}
      {selectedCatererDues && (
        <div className="p-3.5 rounded-lg bg-sky-50/70 border border-sky-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white border border-sky-200 flex items-center justify-center text-[#348bdd]">
              <Users size={16} />
            </div>
            <div>
              <span className="font-medium text-slate-900 block">
                {selectedCatererDues.caterer?.name} • {selectedCatererDues.caterer?.mobile}
              </span>
              <span className="text-slate-500 font-mono text-[11px]">
                {selectedCatererDues.ordersCount} partially paid orders • {selectedCatererDues.caterer?.city || "Chirala"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] text-slate-500 block uppercase font-mono">Combined Balance Due</span>
              <span className="text-base font-mono font-medium text-orange-700">
                ₹{selectedCatererDues.totalDue.toLocaleString("en-IN")}
              </span>
            </div>
            <button
              onClick={() => setSelectedCatererFilter("all")}
              className="text-xs text-[#348bdd] hover:underline"
            >
              Clear filter
            </button>
          </div>
        </div>
      )}

      {/* 3. Date Filters & Caterer Search Toolbar */}
      <div className="bg-white p-3 md:p-4 rounded-lg border shadow-2xs space-y-3" style={{ borderColor: "var(--color-border-base)" }}>
        {/* Date Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Calendar size={12} /> Date:
          </span>
          {[
            { id: "all", label: "All Credits" },
            { id: "today", label: "Today" },
            { id: "yesterday", label: "Yesterday" },
            { id: "this_week", label: "This Week" },
            { id: "last_week", label: "Last Week" },
            { id: "this_month", label: "This Month" },
            { id: "last_month", label: "Last Month" },
            { id: "this_year", label: "This Year" },
            { id: "custom", label: "Custom Range" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setDateFilter(f.id as DateFilterType)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                dateFilter === f.id
                  ? "bg-[#348bdd] text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Custom Date Pickers */}
        {dateFilter === "custom" && (
          <div className="flex items-center gap-2 p-2 bg-sky-50/60 rounded-md border border-sky-100 text-xs text-sky-900 animate-in fade-in">
            <span className="font-medium text-xs">From:</span>
            <CustomDatePicker value={customFrom} onChange={setCustomFrom} placeholder="From date" />
            <span className="font-medium text-xs ml-2">To:</span>
            <CustomDatePicker value={customTo} onChange={setCustomTo} placeholder="To date" />
          </div>
        )}

        {/* Search by Caterer & Filter Row (Requested: "need search by caterers alos. but display order.") */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border w-full sm:w-80 bg-white"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            <Search size={14} style={{ color: "var(--color-text-muted)" }} />
            <input
              type="text"
              placeholder="Search by caterer name, phone, city, order #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-transparent focus:outline-none"
              style={{ color: "var(--color-text-primary)" }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Caterer Dropdown Filter */}
          <div className="flex items-center gap-2 self-end sm:self-auto text-xs">
            <span className="text-slate-500 font-mono">Caterer:</span>
            <select
              value={selectedCatererFilter}
              onChange={(e) => setSelectedCatererFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none"
            >
              <option value="all">All Caterers With Dues</option>
              {caterers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.mobile})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. Display Partially Paid Orders Table */}
      <div
        className="rounded-lg border bg-white overflow-hidden shadow-2xs"
        style={{ borderColor: "var(--color-border-base)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr
                className="border-b text-[11px] font-mono uppercase tracking-wider"
                style={{
                  backgroundColor: "var(--color-bg-subtle)",
                  borderColor: "var(--color-border-base)",
                  color: "var(--color-text-secondary)",
                }}
              >
                <th className="py-2.5 px-4">Order # & Date</th>
                <th className="py-2.5 px-4">Caterer & Mobile</th>
                <th className="py-2.5 px-4">Event Date</th>
                <th className="py-2.5 px-4 text-right">Total Order Value</th>
                <th className="py-2.5 px-4 text-right">Advance Paid</th>
                <th className="py-2.5 px-4 text-right">Pending Balance Credit</th>
                <th className="py-2.5 px-4 text-center w-32">Payment Progress</th>
                <th className="py-2.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <RotateCw size={20} className="animate-spin inline text-[#348bdd] mr-2" />
                    Loading catering credit orders...
                  </td>
                </tr>
              ) : filteredCreditOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-2" />
                    No partially paid orders found. All catering accounts are settled!
                  </td>
                </tr>
              ) : (
                filteredCreditOrders.map((ord) => {
                  const paidRatio =
                    ord.totalAmount > 0
                      ? Math.min(100, Math.round((ord.advanceReceived / ord.totalAmount) * 100))
                      : 0;

                  return (
                    <tr key={ord.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Order # */}
                      <td className="py-3 px-4 font-mono">
                        <span className="font-medium text-slate-900 block">{ord.orderNumber}</span>
                        <span className="text-[10px] text-slate-400">{ord.orderDate}</span>
                      </td>

                      {/* Caterer */}
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-900 block">{ord.catererName}</span>
                        <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                          <Phone size={10} className="text-slate-400" />
                          {ord.catererMobile} • {ord.catererCity || "Chirala"}
                        </span>
                      </td>

                      {/* Event Date */}
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-800 block">{ord.deliveryDate}</span>
                        <span className="text-[10px] text-slate-500 truncate block max-w-[150px]">
                          {ord.eventName || "Catering Function"}
                        </span>
                      </td>

                      {/* Total Order Value */}
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-900">
                        ₹{ord.totalAmount.toLocaleString("en-IN")}
                      </td>

                      {/* Advance Paid */}
                      <td className="py-3 px-4 text-right font-mono text-emerald-700">
                        <div>₹{ord.advanceReceived.toLocaleString("en-IN")}</div>
                        <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-emerald-50 text-emerald-800">
                          {paidRatio}% Paid
                        </span>
                      </td>

                      {/* Balance Credit Due */}
                      <td className="py-3 px-4 text-right font-mono font-medium text-orange-700">
                        <span className="px-2 py-0.5 rounded bg-orange-50 border border-orange-200 text-xs">
                          ₹{ord.balanceAmount.toLocaleString("en-IN")}
                        </span>
                      </td>

                      {/* Progress Bar */}
                      <td className="py-3 px-4 text-center">
                        <div className="w-full space-y-1">
                          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#348bdd]"
                              style={{ width: `${paidRatio}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 block">
                            {paidRatio}% collected
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenSettleModal(ord)}
                            className="px-2.5 py-1 rounded text-white text-xs font-normal shadow-2xs hover:opacity-90 transition-opacity cursor-pointer"
                            style={{ backgroundColor: "var(--color-brand-primary)" }}
                            title="Collect / Settle Balance"
                          >
                            Collect ₹
                          </button>
                          <button
                            onClick={() => setViewingOrder(ord)}
                            className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                            title="View Details"
                          >
                            <Eye size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Collect / Settle Payment Modal */}
      {settlingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white rounded-xl border shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            <div
              className="px-5 py-4 border-b flex items-center justify-between"
              style={{
                borderColor: "var(--color-border-subtle)",
                backgroundColor: "var(--color-bg-subtle)",
              }}
            >
              <div>
                <h3 className="text-sm font-medium text-slate-800">Settle Catering Credit</h3>
                <span className="text-[11px] text-slate-500 font-mono">
                  {settlingOrder.orderNumber} • {settlingOrder.catererName}
                </span>
              </div>
              <button
                onClick={() => setSettlingOrder(null)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveSettlePayment} className="p-5 space-y-4">
              <div className="p-3 rounded-lg bg-orange-50/70 border border-orange-200 flex items-center justify-between font-mono">
                <span className="text-xs text-orange-900 font-sans">Pending Balance Due:</span>
                <span className="text-base font-medium text-orange-700">
                  ₹{settlingOrder.balanceAmount.toLocaleString("en-IN")}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                  Payment Amount to Collect (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  max={settlingOrder.balanceAmount}
                  value={settleAmountInput}
                  onChange={(e) => setSettleAmountInput(e.target.value)}
                  required
                  className="w-full text-sm px-3 py-2 rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd] font-mono font-medium"
                  style={{ borderColor: "var(--color-border-base)" }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                  Payment Method
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["Cash", "UPI", "Card", "Split"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSettleMethod(m)}
                      className={`py-1.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                        settleMethod === m
                          ? "bg-[#348bdd] text-white shadow-2xs"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {settleMethod === "Split" && (
                <div className="p-3 rounded-lg bg-sky-50/60 border border-sky-100 space-y-2 text-xs font-mono">
                  <div className="flex justify-between items-center">
                    <span className="font-sans text-slate-600">Cash (₹):</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={splitCash}
                      onChange={(e) => setSplitCash(e.target.value)}
                      className="w-28 px-2 py-1 text-right text-xs rounded border border-slate-200 bg-white"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-sans text-slate-600">UPI (₹):</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={splitUpi}
                      onChange={(e) => setSplitUpi(e.target.value)}
                      className="w-28 px-2 py-1 text-right text-xs rounded border border-slate-200 bg-white"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-sans text-slate-600">Card (₹):</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={splitCard}
                      onChange={(e) => setSplitCard(e.target.value)}
                      className="w-28 px-2 py-1 text-right text-xs rounded border border-slate-200 bg-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                  Note / Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. Settle installment at kitchen office, UPI Ref..."
                  value={settleNote}
                  onChange={(e) => setSettleNote(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                  style={{ borderColor: "var(--color-border-base)" }}
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSettlingOrder(null)}
                  className="px-3.5 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer font-normal"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSettle}
                  className="px-4 py-2 text-xs text-white rounded-md shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 font-normal"
                  style={{ backgroundColor: "var(--color-brand-primary)" }}
                >
                  {isSubmittingSettle ? <RotateCw size={13} className="animate-spin" /> : <Check size={14} />}
                  <span>Save Payment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. View Order Details Modal */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white rounded-xl border shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            <div
              className="px-5 py-4 border-b flex items-center justify-between"
              style={{
                borderColor: "var(--color-border-subtle)",
                backgroundColor: "var(--color-bg-subtle)",
              }}
            >
              <div>
                <h3 className="text-sm font-medium text-slate-800">{viewingOrder.orderNumber}</h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  {viewingOrder.catererName} • {viewingOrder.orderDate}
                </span>
              </div>
              <button
                onClick={() => setViewingOrder(null)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-mono">Caterer</span>
                  <span className="font-medium text-slate-800 block">{viewingOrder.catererName}</span>
                  <span className="text-slate-500 font-mono">{viewingOrder.catererMobile}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-mono">Delivery Schedule</span>
                  <span className="font-medium text-slate-800 block">
                    {viewingOrder.deliveryDate} at {viewingOrder.deliveryTime}
                  </span>
                  <span className="text-slate-500 truncate block">{viewingOrder.eventName}</span>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <span className="text-[11px] font-medium text-slate-700 uppercase tracking-wider block mb-1.5">
                  Ordered Sweets ({viewingOrder.items?.length || 0})
                </span>
                <div className="rounded-md border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-mono text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Item</th>
                        <th className="py-2 px-3 text-right">Rate</th>
                        <th className="py-2 px-3 text-center">Qty</th>
                        <th className="py-2 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {viewingOrder.items?.map((it, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-sans text-slate-800">{it.name}</td>
                          <td className="py-2 px-3 text-right text-slate-600">₹{it.rate}</td>
                          <td className="py-2 px-3 text-center text-slate-700">
                            {it.quantity} {it.unit}
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-slate-900">₹{it.totalAmount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment History Log */}
              <div>
                <span className="text-[11px] font-medium text-slate-700 uppercase tracking-wider block mb-1.5">
                  Payment History ({viewingOrder.paymentHistory?.length || 0})
                </span>
                <div className="space-y-1">
                  {viewingOrder.paymentHistory?.map((pay, pIdx) => (
                    <div
                      key={pIdx}
                      className="p-2 rounded bg-slate-50 border border-slate-100 flex items-center justify-between text-xs font-mono"
                    >
                      <div>
                        <span className="text-slate-800 font-medium block">
                          ₹{pay.amount.toLocaleString("en-IN")} via {pay.method}
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans">{pay.note || "Payment"}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{pay.date}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Balances */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 font-mono">
                <div className="flex justify-between font-medium text-slate-900">
                  <span className="font-sans">Grand Total:</span>
                  <span>₹{viewingOrder.totalAmount?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span className="font-sans">Total Collected:</span>
                  <span>₹{viewingOrder.advanceReceived?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-medium text-orange-700 pt-1 border-t border-slate-200">
                  <span className="font-sans">Pending Balance Credit:</span>
                  <span>₹{viewingOrder.balanceAmount?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewingOrder(null)}
                className="px-4 py-1.5 text-xs rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
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
