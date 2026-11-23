"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import ConfirmationModal from "@/components/ConfirmationModal";
import CustomDatePicker from "@/components/CustomDatePicker";
import {
  Caterer,
  CateringOrder,
  DateFilterType,
  isDateMatchingFilter,
  getTodayDateStr,
} from "@/types/catering";
import {
  Users,
  Plus,
  Search,
  Calendar,
  Phone,
  MapPin,
  Lock,
  Edit2,
  Trash2,
  RotateCw,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ShoppingBag,
  ExternalLink,
  Building,
} from "lucide-react";
import Link from "next/link";

const PAGE_SIZE = 24;

export default function CaterersPage() {
  const { showToast } = useToast();

  // Data states
  const [caterers, setCaterers] = useState<Caterer[]>([]);
  const [orders, setOrders] = useState<CateringOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Search & Date Filter States (default "today" as requested)
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<DateFilterType>("today");
  const [customFrom, setCustomFrom] = useState<string>(getTodayDateStr());
  const [customTo, setCustomTo] = useState<string>(getTodayDateStr());
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modal states: Add / Edit Caterer
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCatererId, setEditingCatererId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState<string>("");
  const [mobileInput, setMobileInput] = useState<string>("");
  const [mpinInput, setMpinInput] = useState<string>("");
  const [cityInput, setCityInput] = useState<string>("");
  const [addressInput, setAddressInput] = useState<string>("");
  const [showMpin, setShowMpin] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Confirmation Modal
  const [deletingCaterer, setDeletingCaterer] = useState<Caterer | null>(null);

  // 1. Subscribe to Caterers collection
  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, "caterers"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Caterer[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setCaterers(list);
        setIsLoading(false);
      },
      (err) => {
        console.error("Error loading caterers:", err);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // 2. Subscribe to Catering Orders to compute live order counts
  useEffect(() => {
    const q = query(collection(db, "catering_orders"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: CateringOrder[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setOrders(list);
      },
      (err) => {
        console.error("Error loading catering orders:", err);
      }
    );
    return () => unsubscribe();
  }, []);

  // Compute order counts per caterer
  const orderCountMap = useMemo(() => {
    const map = new Map<string, { count: number; totalAmount: number; pendingCredit: number }>();
    orders.forEach((ord) => {
      if (!ord.catererId) return;
      const current = map.get(ord.catererId) || { count: 0, totalAmount: 0, pendingCredit: 0 };
      map.set(ord.catererId, {
        count: current.count + 1,
        totalAmount: current.totalAmount + (ord.totalAmount || 0),
        pendingCredit: current.pendingCredit + (ord.balanceAmount || 0),
      });
    });
    return map;
  }, [orders]);

  // Format created date helper
  const getCatererCreatedDateStr = useCallback((caterer: Caterer): string => {
    if (caterer.createdAt?.toDate) {
      const d = caterer.createdAt.toDate();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
    }
    return getTodayDateStr();
  }, []);

  // Filter Caterers by search and date range
  const filteredCaterers = useMemo(() => {
    return caterers.filter((cat) => {
      // 1. Search Query
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        cat.name.toLowerCase().includes(q) ||
        cat.mobile.includes(q) ||
        (cat.city && cat.city.toLowerCase().includes(q)) ||
        (cat.address && cat.address.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // 2. Date Filter
      const createdDateStr = getCatererCreatedDateStr(cat);
      return isDateMatchingFilter(createdDateStr, dateFilter, customFrom, customTo);
    });
  }, [caterers, searchQuery, dateFilter, customFrom, customTo, getCatererCreatedDateStr]);

  // Pagination (24 per page as requested: "limit of 24 for each page")
  const totalPages = Math.ceil(filteredCaterers.length / PAGE_SIZE) || 1;
  const paginatedCaterers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredCaterers.slice(start, start + PAGE_SIZE);
  }, [filteredCaterers, currentPage]);

  // Reset page when search or date filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, dateFilter, customFrom, customTo]);

  // Open modal in Add mode
  const handleOpenAdd = () => {
    setEditingCatererId(null);
    setNameInput("");
    setMobileInput("");
    setMpinInput("");
    setCityInput("Chirala");
    setAddressInput("");
    setShowMpin(false);
    setIsModalOpen(true);
  };

  // Open modal in Edit mode
  const handleOpenEdit = (caterer: Caterer) => {
    setEditingCatererId(caterer.id);
    setNameInput(caterer.name);
    setMobileInput(caterer.mobile);
    setMpinInput(caterer.mpin || "");
    setCityInput(caterer.city || "");
    setAddressInput(caterer.address || "");
    setShowMpin(false);
    setIsModalOpen(true);
  };

  // Save Caterer Details
  const handleSaveCaterer = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = nameInput.trim();
    const mobile = mobileInput.trim();
    const mpin = mpinInput.trim();
    const city = cityInput.trim();
    const address = addressInput.trim();

    if (!name) {
      showToast("Caterer Name is required", "error");
      return;
    }
    if (!mobile || mobile.length < 10) {
      showToast("Valid 10-digit mobile number is required", "error");
      return;
    }
    if (!mpin) {
      showToast("MPIN is required", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        name,
        mobile,
        mpin,
        city,
        address,
        updatedAt: serverTimestamp(),
      };

      if (editingCatererId) {
        await updateDoc(doc(db, "caterers", editingCatererId), payload);
        showToast(`Buyer "${name}" updated successfully`, "success");
      } else {
        await addDoc(collection(db, "caterers"), {
          ...payload,
          totalOrders: 0,
          totalCredits: 0,
          createdAt: serverTimestamp(),
        });
        showToast(`Buyer "${name}" added successfully`, "success");
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      showToast("Error saving buyer: " + err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Caterer
  const handleDeleteCaterer = async () => {
    if (!deletingCaterer) return;
    try {
      await deleteDoc(doc(db, "caterers", deletingCaterer.id));
      showToast(`Buyer "${deletingCaterer.name}" deleted successfully`, "success");
      setDeletingCaterer(null);
    } catch (err: any) {
      console.error(err);
      showToast("Failed to delete buyer: " + err.message, "error");
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
              <Users size={18} />
            </div>
            <h1
              className="text-2xl text-[var(--color-text-primary)] tracking-tight"
              style={{ fontWeight: 500 }}
            >
              Buyers
            </h1>
            <span
              className="px-2 py-0.5 text-xs rounded font-normal font-mono"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                border: "1px solid var(--color-border-base)",
                color: "var(--color-text-secondary)",
              }}
            >
              {filteredCaterers.length} total
            </span>
          </div>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            Manage buyer profiles, contact phone numbers, MPINs, delivery cities, and buyer order history.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-md text-white transition-opacity hover:opacity-90 font-normal shadow-xs cursor-pointer"
            style={{ backgroundColor: "var(--color-brand-primary)" }}
          >
            <Plus size={15} />
            <span>Add Buyer</span>
          </button>
        </div>
      </div>

      {/* 2. Date Filters & Search Controls */}
      <div className="bg-white p-3 md:p-4 rounded-lg border shadow-2xs space-y-3" style={{ borderColor: "var(--color-border-base)" }}>
        {/* Date Filter Pills (Requested: today, yesterday, this week, last week, this month, last month, this year, last year, custom range. Default today!) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Calendar size={12} /> Date:
          </span>
          {[
            { id: "today", label: "Today" },
            { id: "yesterday", label: "Yesterday" },
            { id: "this_week", label: "This Week" },
            { id: "last_week", label: "Last Week" },
            { id: "this_month", label: "This Month" },
            { id: "last_month", label: "Last Month" },
            { id: "this_year", label: "This Year" },
            { id: "last_year", label: "Last Year" },
            { id: "custom", label: "Custom Range" },
            { id: "all", label: "All" },
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

        {/* Custom Date Pickers (Shown when "custom" is selected) */}
        {dateFilter === "custom" && (
          <div className="flex items-center gap-2 p-2 bg-sky-50/60 rounded-md border border-sky-100 text-xs text-sky-900 animate-in fade-in">
            <span className="font-medium text-xs">From:</span>
            <CustomDatePicker value={customFrom} onChange={setCustomFrom} placeholder="From date" />
            <span className="font-medium text-xs ml-2">To:</span>
            <CustomDatePicker value={customTo} onChange={setCustomTo} placeholder="To date" />
          </div>
        )}

        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border w-full sm:w-80 bg-white"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            <Search size={14} style={{ color: "var(--color-text-muted)" }} />
            <input
              type="text"
              placeholder="Search by buyer name, mobile, city, address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-transparent focus:outline-none"
              style={{ color: "var(--color-text-primary)" }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 self-end sm:self-auto font-mono">
            Showing {paginatedCaterers.length} of {filteredCaterers.length} (Limit: 24/page)
          </div>
        </div>
      </div>

      {/* 3. Caterers Table Display */}
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
                <th className="py-2.5 px-4">Buyer Name</th>
                <th className="py-2.5 px-4">Mobile Number</th>
                <th className="py-2.5 px-4 text-center">MPIN</th>
                <th className="py-2.5 px-4">City</th>
                <th className="py-2.5 px-4">Address</th>
                <th className="py-2.5 px-4 text-center">Total Orders</th>
                <th className="py-2.5 px-4 text-right">Pending Credits</th>
                <th className="py-2.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <RotateCw size={20} className="animate-spin inline text-[#348bdd] mr-2" />
                    Loading buyers...
                  </td>
                </tr>
              ) : paginatedCaterers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    No buyers found for the selected filter.
                  </td>
                </tr>
              ) : (
                paginatedCaterers.map((cat) => {
                  const orderStats = orderCountMap.get(cat.id) || {
                    count: cat.totalOrders || 0,
                    totalAmount: cat.totalOrderValue || 0,
                    pendingCredit: cat.totalCredits || 0,
                  };

                  return (
                    <tr key={cat.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name */}
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-900 block">{cat.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: {cat.id.substring(0, 8)}
                        </span>
                      </td>

                      {/* Mobile */}
                      <td className="py-3 px-4 font-mono">
                        <a
                          href={`tel:${cat.mobile}`}
                          className="text-[#348bdd] hover:underline flex items-center gap-1"
                        >
                          <Phone size={11} className="text-slate-400" />
                          <span>{cat.mobile}</span>
                        </a>
                      </td>

                      {/* MPIN */}
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold tracking-widest text-[11px]">
                          {cat.mpin || "••••"}
                        </span>
                      </td>

                      {/* City */}
                      <td className="py-3 px-4 text-slate-700">
                        <span className="flex items-center gap-1">
                          <Building size={11} className="text-slate-400" />
                          <span>{cat.city || "—"}</span>
                        </span>
                      </td>

                      {/* Address */}
                      <td className="py-3 px-4 text-slate-600 max-w-[200px] truncate" title={cat.address}>
                        {cat.address || "—"}
                      </td>

                      {/* Total Orders Count (Requested: "using count didplay count of that orders") */}
                      <td className="py-3 px-4 text-center">
                        <Link
                          href={`/catering-orders?catererId=${cat.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-blue-50 text-[#348bdd] hover:bg-blue-100 transition-colors"
                          title="View caterer orders"
                        >
                          <ShoppingBag size={11} />
                          <span>{orderStats.count} Orders</span>
                        </Link>
                      </td>

                      {/* Pending Credits */}
                      <td className="py-3 px-4 text-right font-mono">
                        {orderStats.pendingCredit > 0 ? (
                          <Link
                            href={`/catering-credits?catererId=${cat.id}`}
                            className="font-medium text-red-600 hover:underline"
                            title="View pending credits"
                          >
                            ₹{orderStats.pendingCredit.toLocaleString("en-IN")}
                          </Link>
                        ) : (
                          <span className="text-emerald-600 font-medium">₹0.00</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/catering-orders?createFor=${cat.id}`}
                            className="px-2 py-1 rounded bg-blue-50 text-[#348bdd] hover:bg-[#348bdd] hover:text-white text-[11px] font-normal transition-colors"
                            title="Create Buyer Order"
                          >
                            + Order
                          </Link>
                          <button
                            onClick={() => handleOpenEdit(cat)}
                            className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                            title="Edit Buyer"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => setDeletingCaterer(cat)}
                            className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                            title="Delete Buyer"
                          >
                            <Trash2 size={13} />
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

        {/* Pagination Bar (24 per page limit) */}
        {totalPages > 1 && (
          <div
            className="px-4 py-3 border-t flex items-center justify-between text-xs"
            style={{
              borderColor: "var(--color-border-subtle)",
              backgroundColor: "var(--color-bg-subtle)",
            }}
          >
            <span className="text-slate-500 font-mono">
              Page {currentPage} of {totalPages} ({filteredCaterers.length} caterers)
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNum = idx + 1;
                if (
                  pageNum === 1 ||
                  pageNum === totalPages ||
                  (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-7 h-7 rounded text-xs font-mono font-medium cursor-pointer ${
                        currentPage === pageNum
                          ? "bg-[#348bdd] text-white shadow-2xs"
                          : "border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                }
                if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                  return <span key={pageNum} className="text-slate-400 px-1">...</span>;
                }
                return null;
              })}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Modal: Add / Edit Caterer */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white rounded-xl border shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            {/* Modal Header */}
            <div
              className="px-5 py-4 border-b flex items-center justify-between"
              style={{
                borderColor: "var(--color-border-subtle)",
                backgroundColor: "var(--color-bg-subtle)",
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center"
                  style={{
                    backgroundColor: "var(--color-brand-primary-light)",
                    color: "var(--color-brand-primary)",
                  }}
                >
                  <Users size={16} />
                </div>
                <h3 className="text-sm font-medium text-slate-800">
                  {editingCatererId ? "Edit Buyer" : "Add Buyer"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveCaterer} className="p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                  Buyer Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sri Srinivasa Caterers, Venkata Rao"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  required
                  className="w-full text-xs px-3 py-2 rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd] bg-white"
                  style={{ borderColor: "var(--color-border-base)" }}
                />
              </div>

              {/* Mobile Number & MPIN */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                    Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <Phone size={13} className="absolute left-3 text-slate-400" />
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="9848012345"
                      value={mobileInput}
                      onChange={(e) => setMobileInput(e.target.value.replace(/\D/g, ""))}
                      required
                      className="w-full pl-8 pr-3 py-2 text-xs rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd] font-mono bg-white"
                      style={{ borderColor: "var(--color-border-base)" }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                    MPIN <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <Lock size={13} className="absolute left-3 text-slate-400" />
                    <input
                      type={showMpin ? "text" : "password"}
                      maxLength={6}
                      placeholder="4 or 6 digits"
                      value={mpinInput}
                      onChange={(e) => setMpinInput(e.target.value)}
                      required
                      className="w-full pl-8 pr-8 py-2 text-xs rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd] font-mono tracking-widest bg-white"
                      style={{ borderColor: "var(--color-border-base)" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowMpin(!showMpin)}
                      className="absolute right-2 text-slate-400 hover:text-slate-600"
                    >
                      {showMpin ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* City */}
              <div>
                <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                  City / Town <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chirala, Bapatla, Ongole, Guntur"
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  required
                  className="w-full text-xs px-3 py-2 rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd] bg-white"
                  style={{ borderColor: "var(--color-border-base)" }}
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                  Address & Landmark <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Main Road, Near Clock Tower, Chirala"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd] bg-white"
                  style={{ borderColor: "var(--color-border-base)" }}
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer font-normal"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs text-white rounded-md shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 font-normal"
                  style={{ backgroundColor: "var(--color-brand-primary)" }}
                >
                  {isSubmitting ? <RotateCw size={13} className="animate-spin" /> : <Check size={14} />}
                  <span>{editingCatererId ? "Save Changes" : "Save Buyer"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(deletingCaterer)}
        title="Delete Buyer"
        message={`Are you sure you want to delete buyer "${deletingCaterer?.name}"?`}
        confirmText="Delete"
        onConfirm={handleDeleteCaterer}
        onCancel={() => setDeletingCaterer(null)}
      />
    </div>
  );
}
