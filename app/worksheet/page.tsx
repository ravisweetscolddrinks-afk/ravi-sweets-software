"use client";

import React, { useState, useEffect, useMemo } from "react";
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
import { usePrinter } from "@/context/PrinterContext";
import CustomDatePicker from "@/components/CustomDatePicker";
import ConfirmationModal from "@/components/ConfirmationModal";
import {
  ClipboardList,
  Search,
  Printer,
  FileText,
  Save,
  Check,
  X,
  Eye,
  Edit2,
  Trash2,
  Loader2,
  Calendar,
  Scale,
  Plus,
  RotateCcw,
  FolderTree,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

type WorksheetUnit = "KG" | "Tray" | "Piece" | "Litre";
const ALL_UNITS: WorksheetUnit[] = ["KG", "Tray", "Piece", "Litre"];

interface CatalogProduct {
  id: string;
  name: string;
  categoryName: string;
  shortCode: string;
  barcode: string;
  unit: string;
  kgPerTray: number;
  piecesPerKg: number;
  showInWorksheet: boolean;
}

interface RowDraft {
  unit: WorksheetUnit | "";
  quantity: string;
}

export interface WorksheetSavedItem {
  productId: string;
  productName: string;
  categoryName: string;
  unit: WorksheetUnit;
  quantity: number;
  calculatedKg: number;
  kgPerTray?: number;
  piecesPerKg?: number;
}

export interface WorksheetRecord {
  id: string;
  worksheetNumber: string;
  date: string; // YYYY-MM-DD
  note?: string;
  items: WorksheetSavedItem[];
  totalItems: number;
  totalCalculatedKg: number;
  createdAt?: any;
  updatedAt?: any;
}

type DateFilterMode = "today" | "yesterday" | "this_week" | "this_month" | "all" | "custom";

function getTodayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function formatDisplayDate(dateStr: string) {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function calculateRowKg(
  unit: WorksheetUnit | "",
  qty: number,
  product: { kgPerTray?: number; piecesPerKg?: number }
): number {
  if (!unit || !qty || qty <= 0) return 0;
  if (unit === "KG" || unit === "Litre") {
    return Number(qty.toFixed(2));
  }
  if (unit === "Tray") {
    const kpt = Number(product.kgPerTray) > 0 ? Number(product.kgPerTray) : 2.5;
    return Number((qty * kpt).toFixed(2));
  }
  if (unit === "Piece") {
    const ppk = Number(product.piecesPerKg) || 0;
    if (ppk > 0) {
      return Number((qty / ppk).toFixed(2));
    }
    return 0;
  }
  return 0;
}

function createDefaultRowDrafts(productList: CatalogProduct[]): Record<string, RowDraft> {
  const drafts: Record<string, RowDraft> = {};
  productList.forEach((p) => {
    drafts[p.id] = {
      unit: "Tray",
      quantity: "1",
    };
  });
  return drafts;
}

export default function WorkSheetPage() {
  const { showToast } = useToast();
  const { printWorksheet } = usePrinter();

  // Main Tabs: Create/Edit Work Sheet vs Saved Work Sheets List
  const [activeTab, setActiveTab] = useState<"create" | "list">("create");

  // Data States
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [worksheets, setWorksheets] = useState<WorksheetRecord[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);
  const [isLoadingWorksheets, setIsLoadingWorksheets] = useState<boolean>(true);

  const [businessProfile, setBusinessProfile] = useState({
    tradeName: "Ravi Sweets & Cold Drinks",
    legalName: "Ravi Sweets",
    phone: "",
    altPhone: "",
    email: "",
    address: "",
    city: "Chirala",
    state: "Andhra Pradesh",
    pincode: "",
    gstNumber: "",
  });

  // Create / Edit Form State
  const [editingWorksheetId, setEditingWorksheetId] = useState<string | null>(null);
  const [editingWorksheetNumber, setEditingWorksheetNumber] = useState<string>("");
  const [worksheetDate, setWorksheetDate] = useState<string>(getTodayStr());
  const [worksheetNote, setWorksheetNote] = useState<string>("");
  const [rowDrafts, setRowDrafts] = useState<Record<string, RowDraft>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Create Form Filters
  const [itemSearch, setItemSearch] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [productScope, setProductScope] = useState<"all" | "worksheet" | "selected">("all");
  const [hasAutoCheckedScope, setHasAutoCheckedScope] = useState<boolean>(false);

  // Saved Worksheets List Filters
  const [listSearch, setListSearch] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<DateFilterMode>("all");
  const [customStartDate, setCustomStartDate] = useState<string>(getTodayStr());
  const [customEndDate, setCustomEndDate] = useState<string>(getTodayStr());

  // Modals & Printing
  const [viewingWorksheet, setViewingWorksheet] = useState<WorksheetRecord | null>(null);
  const [printingA4Worksheet, setPrintingA4Worksheet] = useState<WorksheetRecord | null>(null);
  const [deletingWorksheet, setDeletingWorksheet] = useState<WorksheetRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Listen to afterprint to unmount A4 printable layout cleanly
  useEffect(() => {
    const onAfterPrint = () => {
      setPrintingA4Worksheet(null);
    };
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

  // Realtime Firestore Listeners (Products, Worksheets, Business Profile, GST Settings)
  useEffect(() => {
    setIsLoadingProducts(true);
    setIsLoadingWorksheets(true);

    const unsubProducts = onSnapshot(
      query(collection(db, "products"), orderBy("name", "asc")),
      (snap) => {
        const list: CatalogProduct[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || "",
            categoryName: data.categoryName || "General",
            shortCode: String(data.shortCode || ""),
            barcode: String(data.barcode || ""),
            unit: data.unit || "KG",
            kgPerTray: Number(data.kgPerTray) || 0,
            piecesPerKg: Number(data.piecesPerKg) || 0,
            showInWorksheet: !!data.showInWorksheet,
          };
        });
        setProducts(list);
        setRowDrafts((prev) => {
          if (Object.keys(prev).length > 0) return prev;
          return createDefaultRowDrafts(list);
        });
        setIsLoadingProducts(false);
      },
      (err) => {
        console.error("Products listener error:", err);
        setIsLoadingProducts(false);
      }
    );

    const unsubWorksheets = onSnapshot(
      query(collection(db, "worksheets"), orderBy("createdAt", "desc")),
      (snap) => {
        const list: WorksheetRecord[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<WorksheetRecord, "id">),
        }));
        setWorksheets(list);
        setIsLoadingWorksheets(false);
      },
      (err) => {
        console.error("Worksheets listener error:", err);
        setIsLoadingWorksheets(false);
      }
    );

    const unsubBiz = onSnapshot(
      doc(db, "settings", "business_profile"),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setBusinessProfile((prev) => ({
            ...prev,
            tradeName: d.tradeName || prev.tradeName,
            legalName: d.legalName || prev.legalName,
            phone: d.phone || prev.phone,
            altPhone: d.altPhone || prev.altPhone,
            email: d.email || prev.email,
            address: d.address || prev.address,
            city: d.city || prev.city,
            state: d.state || prev.state,
            pincode: d.pincode || prev.pincode,
          }));
        }
      },
      () => {}
    );

    const unsubGst = onSnapshot(
      doc(db, "settings", "gst_settings"),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          if (d.gstNumber) {
            setBusinessProfile((prev) => ({ ...prev, gstNumber: d.gstNumber }));
          }
        }
      },
      () => {}
    );

    return () => {
      unsubProducts();
      unsubWorksheets();
      unsubBiz();
      unsubGst();
    };
  }, []);

  // Keep product scope as "all" by default so all products with 1 Tray are displayed and selected

  const worksheetFlaggedCount = useMemo(
    () => products.filter((p) => p.showInWorksheet).length,
    [products]
  );

  // Distinct categories for filter dropdown
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.categoryName) set.add(p.categoryName);
    });
    return Array.from(set).sort();
  }, [products]);

  // Compute all currently valid selected items (unit chosen AND quantity > 0)
  const selectedEntries = useMemo(() => {
    const result: WorksheetSavedItem[] = [];
    for (const prod of products) {
      const draft = rowDrafts[prod.id];
      if (!draft) continue;
      const qty = Number(draft.quantity);
      if (draft.unit && qty > 0) {
        const calcKg = calculateRowKg(draft.unit, qty, prod);
        result.push({
          productId: prod.id,
          productName: prod.name,
          categoryName: prod.categoryName || "General",
          unit: draft.unit,
          quantity: qty,
          calculatedKg: calcKg,
          kgPerTray: prod.kgPerTray || 2.5,
          piecesPerKg: prod.piecesPerKg || 0,
        });
      }
    }
    return result;
  }, [products, rowDrafts]);

  // Detect any rows where quantity > 0 was typed but no unit was selected yet
  const incompleteRowsCount = useMemo(() => {
    let count = 0;
    for (const prod of products) {
      const draft = rowDrafts[prod.id];
      if (draft && Number(draft.quantity) > 0 && !draft.unit) {
        count++;
      }
    }
    return count;
  }, [products, rowDrafts]);

  const totalSelectedKg = useMemo(
    () =>
      Number(
        selectedEntries.reduce((acc, item) => acc + (Number(item.calculatedKg) || 0), 0).toFixed(2)
      ),
    [selectedEntries]
  );

  // Filtered product rows for the Create/Edit Work Sheet table
  const displayedProducts = useMemo(() => {
    return products.filter((p) => {
      if (productScope === "worksheet" && !p.showInWorksheet) return false;
      if (productScope === "selected") {
        const d = rowDrafts[p.id];
        if (!d || !d.unit || Number(d.quantity) <= 0) return false;
      }
      if (categoryFilter !== "all" && p.categoryName !== categoryFilter) return false;
      if (itemSearch.trim()) {
        const q = itemSearch.toLowerCase().trim();
        const match =
          p.name.toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q) ||
          p.shortCode.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [products, productScope, rowDrafts, categoryFilter, itemSearch]);

  // Row interaction handlers — by default Tray & 1 are selected for all products
  const handleSelectUnit = (productId: string, unit: WorksheetUnit) => {
    setRowDrafts((prev) => {
      const current = prev[productId] || { unit: "Tray", quantity: "1" };
      // Clicking the already-selected unit toggles it off (deselects)
      const nextUnit = current.unit === unit ? "" : unit;
      return {
        ...prev,
        [productId]: {
          ...current,
          unit: nextUnit,
        },
      };
    });
  };

  const handleQuantityChange = (productId: string, val: string) => {
    setRowDrafts((prev) => {
      const current = prev[productId] || { unit: "Tray", quantity: "1" };
      return {
        ...prev,
        [productId]: {
          ...current,
          quantity: val,
        },
      };
    });
  };

  const handleClearRow = (productId: string) => {
    setRowDrafts((prev) => ({
      ...prev,
      [productId]: { unit: "", quantity: "" },
    }));
  };

  const handleResetForm = () => {
    setEditingWorksheetId(null);
    setEditingWorksheetNumber("");
    setWorksheetDate(getTodayStr());
    setWorksheetNote("");
    setRowDrafts(createDefaultRowDrafts(products));
    setProductScope("all");
    setItemSearch("");
  };

  // Save Work Sheet to Firestore (stores ONLY selected items)
  const handleSaveWorksheet = async () => {
    if (!worksheetDate) {
      showToast("Please select a date for the work sheet", "error");
      return;
    }

    if (incompleteRowsCount > 0) {
      showToast(
        `${incompleteRowsCount} item${incompleteRowsCount > 1 ? "s have" : " has"} quantity entered without a unit selected. Please select a unit or clear the quantity.`,
        "error"
      );
      return;
    }

    if (selectedEntries.length === 0) {
      showToast("Please select a unit and enter quantity for at least one item", "error");
      return;
    }

    setIsSaving(true);
    try {
      const dateCompact = worksheetDate.replace(/-/g, "");
      const suffix = String(Date.now()).slice(-4);
      const wsNumber = editingWorksheetId
        ? editingWorksheetNumber
        : `WS-${dateCompact}-${suffix}`;

      const payload = {
        worksheetNumber: wsNumber,
        date: worksheetDate,
        note: worksheetNote.trim(),
        items: selectedEntries,
        totalItems: selectedEntries.length,
        totalCalculatedKg: totalSelectedKg,
        updatedAt: serverTimestamp(),
      };

      if (editingWorksheetId) {
        await updateDoc(doc(db, "worksheets", editingWorksheetId), payload);
        showToast(`Work Sheet #${wsNumber} updated with ${selectedEntries.length} items!`, "success");
      } else {
        await addDoc(collection(db, "worksheets"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        showToast(`Work Sheet #${wsNumber} saved with ${selectedEntries.length} items!`, "success");
      }

      handleResetForm();
      setActiveTab("list");
    } catch (err: any) {
      console.error("Save worksheet error:", err);
      showToast("Failed to save work sheet: " + (err?.message || "Unknown error"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Load saved worksheet into Create/Edit form
  const handleEditWorksheet = (ws: WorksheetRecord) => {
    setEditingWorksheetId(ws.id);
    setEditingWorksheetNumber(ws.worksheetNumber);
    setWorksheetDate(ws.date || getTodayStr());
    setWorksheetNote(ws.note || "");

    const drafts: Record<string, RowDraft> = {};
    (ws.items || []).forEach((item) => {
      drafts[item.productId] = {
        unit: item.unit,
        quantity: String(item.quantity),
      };
    });
    setRowDrafts(drafts);
    setProductScope("all");
    setActiveTab("create");
    showToast(`Editing Work Sheet #${ws.worksheetNumber}`, "info");
  };

  // Delete saved worksheet
  const handleConfirmDelete = async () => {
    if (!deletingWorksheet) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "worksheets", deletingWorksheet.id));
      showToast(`Deleted Work Sheet #${deletingWorksheet.worksheetNumber}`, "info");
      setDeletingWorksheet(null);
    } catch (err: any) {
      showToast("Error deleting work sheet: " + (err?.message || "Unknown error"), "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Thermal Print Handler (Business Details -> Date -> ONLY Selected Items)
  const handleThermalPrint = async (ws: WorksheetRecord) => {
    const fullAddress = [
      businessProfile.address,
      businessProfile.city,
      businessProfile.state,
      businessProfile.pincode,
    ]
      .filter(Boolean)
      .join(", ");

    await printWorksheet({
      worksheetNumber: ws.worksheetNumber,
      date: formatDisplayDate(ws.date),
      note: ws.note || "",
      tradeName: businessProfile.tradeName,
      legalName: businessProfile.legalName,
      address: fullAddress,
      phone: businessProfile.phone,
      email: businessProfile.email,
      gstNumber: businessProfile.gstNumber,
      items: (ws.items || []).map((i) => ({
        productName: i.productName,
        unit: i.unit,
        quantity: i.quantity,
        calculatedKg: Number(i.calculatedKg) || 0,
      })),
      totalCalculatedKg: Number(ws.totalCalculatedKg) || 0,
    });
  };

  // A4 Print Handler (Business Details -> Date -> ONLY Selected Items)
  const handleA4Print = (ws: WorksheetRecord) => {
    setPrintingA4Worksheet(ws);
    setTimeout(() => {
      window.print();
    }, 180);
  };

  // Filtered Saved Worksheets List
  const filteredWorksheets = useMemo(() => {
    const today = getTodayStr();
    const now = new Date();

    const getOffsetDate = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
    };

    return worksheets.filter((ws) => {
      const dStr = ws.date || "";

      if (dateFilter === "today" && dStr !== today) return false;
      if (dateFilter === "yesterday" && dStr !== getOffsetDate(-1)) return false;
      if (dateFilter === "this_week") {
        const firstDay = new Date(now);
        firstDay.setDate(now.getDate() - now.getDay());
        const start = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(firstDay.getDate()).padStart(2, "0")}`;
        if (dStr < start || dStr > today) return false;
      }
      if (dateFilter === "this_month") {
        const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        if (dStr < start) return false;
      }
      if (dateFilter === "custom") {
        if (customStartDate && dStr < customStartDate) return false;
        if (customEndDate && dStr > customEndDate) return false;
      }

      if (listSearch.trim()) {
        const q = listSearch.toLowerCase().trim();
        const matchNum = (ws.worksheetNumber || "").toLowerCase().includes(q);
        const matchNote = (ws.note || "").toLowerCase().includes(q);
        const matchDate = dStr.includes(q);
        const matchItem = (ws.items || []).some((i) =>
          i.productName.toLowerCase().includes(q)
        );
        if (!matchNum && !matchNote && !matchDate && !matchItem) return false;
      }

      return true;
    });
  }, [worksheets, dateFilter, customStartDate, customEndDate, listSearch]);

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full space-y-5">
      {/* 1. Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b no-print"
        style={{ borderColor: "var(--color-border-subtle)" }}
      >
        <div>
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{
                backgroundColor: "var(--color-brand-primary-light)",
                color: "var(--color-brand-primary)",
              }}
            >
              <ClipboardList size={19} />
            </div>
            <h1
              className="text-2xl text-[var(--color-text-primary)] tracking-tight"
              style={{ fontWeight: 500 }}
            >
              Work Sheet
            </h1>
            <span
              className="px-2 py-0.5 text-xs rounded font-normal font-mono"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                border: "1px solid var(--color-border-base)",
                color: "var(--color-text-secondary)",
              }}
            >
              {worksheets.length} saved
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            Select date, choose unit & quantity for required items (with automatic Tray-to-KG calculation), save, and print only selected items on Thermal or A4.
          </p>
        </div>

        {/* Quick Tab Switch / New Work Sheet */}
        <div className="flex items-center gap-2">
          {activeTab === "list" && (
            <button
              type="button"
              onClick={() => {
                handleResetForm();
                setActiveTab("create");
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-md text-white font-medium cursor-pointer shadow-xs hover:opacity-95"
              style={{ backgroundColor: "var(--color-brand-primary)" }}
            >
              <Plus size={14} />
              <span>New Work Sheet</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 no-print">
        <button
          type="button"
          onClick={() => setActiveTab("create")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === "create"
              ? "border-[#348bdd] text-[#348bdd]"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          <Plus size={15} />
          <span>{editingWorksheetId ? `Edit #${editingWorksheetNumber}` : "Create Work Sheet"}</span>
          {selectedEntries.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-blue-100 text-[#348bdd]">
              {selectedEntries.length} selected
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("list")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === "list"
              ? "border-[#348bdd] text-[#348bdd]"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          <ClipboardList size={15} />
          <span>Saved Work Sheets</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
              activeTab === "list"
                ? "bg-blue-100 text-[#348bdd]"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {worksheets.length}
          </span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: CREATE / EDIT WORK SHEET                                     */}
      {/* =================================================================== */}
      {activeTab === "create" && (
        <div className="space-y-4 no-print">
          {/* Date + Note + Save Bar */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 max-w-2xl">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Work Sheet Date <span className="text-rose-500">*</span>
                </label>
                <CustomDatePicker
                  value={worksheetDate}
                  onChange={setWorksheetDate}
                  placeholder="Select worksheet date"
                  clearable={false}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Shift / Note <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Morning Batch, Festival Prep..."
                  value={worksheetNote}
                  onChange={(e) => setWorksheetNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                />
              </div>
            </div>

            {/* Live Selection Summary & Save Button */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono flex items-center gap-3">
                <div>
                  <span className="text-slate-400">Items: </span>
                  <span className="font-medium text-slate-900">{selectedEntries.length}</span>
                </div>
                <div className="h-3.5 w-px bg-slate-200" />
                <div>
                  <span className="text-slate-400">Total KG: </span>
                  <span className="font-medium text-[#348bdd]">{totalSelectedKg.toFixed(2)} KG</span>
                </div>
              </div>

              {(selectedEntries.length > 0 || editingWorksheetId) && (
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw size={13} />
                  <span>{editingWorksheetId ? "Cancel Edit" : "Clear All"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSaveWorksheet}
                disabled={isSaving || selectedEntries.length === 0}
                className="px-4 py-2 text-xs rounded-lg text-white font-medium flex items-center gap-1.5 cursor-pointer hover:opacity-95 disabled:opacity-50 shadow-xs"
                style={{ backgroundColor: "var(--color-brand-primary)" }}
              >
                {isSaving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                <span>
                  {editingWorksheetId ? "Update Work Sheet" : "Save Work Sheet"}
                </span>
              </button>
            </div>
          </div>

          {incompleteRowsCount > 0 && (
            <div className="px-3.5 py-2.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>
                <strong>{incompleteRowsCount}</strong> item{incompleteRowsCount > 1 ? "s have" : " has"} a quantity entered without a unit selected. Select a unit pill to include them.
              </span>
            </div>
          )}

          {/* Filter Bar for Items List */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Search items */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 bg-white w-full sm:w-72">
                <Search size={14} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search item name or code..."
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="w-full text-xs bg-transparent focus:outline-none"
                />
                {itemSearch && (
                  <button
                    type="button"
                    onClick={() => setItemSearch("")}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Category filter */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 bg-white">
                <FolderTree size={13} className="text-[#348bdd] shrink-0" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="text-xs bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Scope Toggle Pills */}
            <div className="flex items-center gap-1.5">
              {worksheetFlaggedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setProductScope("worksheet")}
                  className={`px-2.5 py-1.5 rounded-md text-xs border cursor-pointer transition-colors ${
                    productScope === "worksheet"
                      ? "border-[#348bdd] bg-blue-50 text-[#348bdd] font-medium"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Worksheet Items ({worksheetFlaggedCount})
                </button>
              )}
              <button
                type="button"
                onClick={() => setProductScope("all")}
                className={`px-2.5 py-1.5 rounded-md text-xs border cursor-pointer transition-colors ${
                  productScope === "all"
                    ? "border-[#348bdd] bg-blue-50 text-[#348bdd] font-medium"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                All Products ({products.length})
              </button>
              <button
                type="button"
                onClick={() => setProductScope("selected")}
                className={`px-2.5 py-1.5 rounded-md text-xs border cursor-pointer transition-colors ${
                  productScope === "selected"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-medium"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Selected Only ({selectedEntries.length})
              </button>

              <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

              <button
                type="button"
                onClick={() => setRowDrafts(createDefaultRowDrafts(products))}
                className="px-2.5 py-1.5 rounded-md text-xs border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer shadow-2xs font-medium"
                title="Select all products with 1 Tray by default"
              >
                Select All (1 Tray)
              </button>

              <button
                type="button"
                onClick={() => {
                  const emptyDrafts: Record<string, RowDraft> = {};
                  products.forEach((p) => {
                    emptyDrafts[p.id] = { unit: "", quantity: "" };
                  });
                  setRowDrafts(emptyDrafts);
                }}
                className="px-2.5 py-1.5 rounded-md text-xs border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 cursor-pointer shadow-2xs"
                title="Clear all selections"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Items Worksheet Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            {isLoadingProducts ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 size={22} className="animate-spin text-[#348bdd]" />
                <span className="text-xs">Loading items...</span>
              </div>
            ) : displayedProducts.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                No items match the current filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-mono uppercase text-slate-500">
                      <th className="py-2.5 px-4 w-10 text-center">#</th>
                      <th className="py-2.5 px-4">Item Name</th>
                      <th className="py-2.5 px-4">Select Unit (Tray by default)</th>
                      <th className="py-2.5 px-4 w-36">Quantity</th>
                      <th className="py-2.5 px-4 w-44 text-right">Calculated KG</th>
                      <th className="py-2.5 px-3 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedProducts.map((prod, idx) => {
                      const draft = rowDrafts[prod.id] || { unit: "Tray", quantity: "1" };
                      const qtyNum = Number(draft.quantity) || 0;
                      const isRowActive = Boolean(draft.unit && qtyNum > 0);
                      const isMissingUnit = Boolean(!draft.unit && qtyNum > 0);
                      const calcKg = calculateRowKg(draft.unit, qtyNum, prod);
                      const trayRate = prod.kgPerTray > 0 ? prod.kgPerTray : 2.5;

                      return (
                        <tr
                          key={prod.id}
                          className={`transition-colors ${
                            isRowActive
                              ? "bg-blue-50/35"
                              : isMissingUnit
                              ? "bg-amber-50/40"
                              : "hover:bg-slate-50/60"
                          }`}
                        >
                          {/* # */}
                          <td className="py-2.5 px-4 text-center font-mono text-[11px] text-slate-400">
                            {isRowActive ? (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#348bdd] text-white">
                                <Check size={11} />
                              </span>
                            ) : (
                              idx + 1
                            )}
                          </td>

                          {/* Item Name (Left) */}
                          <td className="py-2.5 px-4">
                            <div className="font-medium text-slate-900">{prod.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono flex flex-wrap items-center gap-2 mt-0.5">
                              <span>{prod.categoryName}</span>
                              {prod.kgPerTray > 0 && (
                                <span className="text-slate-500">• {prod.kgPerTray} KG/Tray</span>
                              )}
                              {prod.piecesPerKg > 0 && (
                                <span className="text-slate-500">• {prod.piecesPerKg} Pcs/KG</span>
                              )}
                            </div>
                          </td>

                          {/* Units — Display all units, none selected by default */}
                          <td className="py-2.5 px-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {ALL_UNITS.map((u) => {
                                const isChosen = draft.unit === u;
                                return (
                                  <button
                                    key={u}
                                    type="button"
                                    onClick={() => handleSelectUnit(prod.id, u)}
                                    className={`px-2.5 py-1 rounded-md border text-[11px] font-mono transition-all cursor-pointer ${
                                      isChosen
                                        ? "border-[#348bdd] bg-[#348bdd] text-white font-medium shadow-2xs"
                                        : isMissingUnit
                                        ? "border-amber-300 bg-white text-slate-700 hover:border-[#348bdd]"
                                        : "border-slate-200 bg-white text-slate-600 hover:border-[#348bdd] hover:text-[#348bdd]"
                                    }`}
                                  >
                                    {u}
                                  </button>
                                );
                              })}
                            </div>
                            {isMissingUnit && (
                              <div className="text-[10px] text-amber-700 mt-1">
                                Please select a unit
                              </div>
                            )}
                          </td>

                          {/* Quantity Input */}
                          <td className="py-2.5 px-4">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="Qty"
                              value={draft.quantity}
                              onWheel={(e) => e.currentTarget.blur()}
                              onChange={(e) => handleQuantityChange(prod.id, e.target.value)}
                              className="w-28 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                            />
                          </td>

                          {/* Live Calculated KG (especially for Tray) */}
                          <td className="py-2.5 px-4 text-right font-mono">
                            {isRowActive ? (
                              <div className="inline-flex flex-col items-end">
                                {draft.unit === "Tray" ? (
                                  <>
                                    <span className="px-2 py-0.5 rounded bg-blue-100/80 text-[#348bdd] font-medium text-xs flex items-center gap-1">
                                      <Scale size={11} />
                                      <span>{calcKg.toFixed(2)} KG</span>
                                    </span>
                                    <span className="text-[10px] text-slate-400 mt-0.5">
                                      {qtyNum} × {trayRate} kg/tray
                                    </span>
                                  </>
                                ) : draft.unit === "KG" ? (
                                  <span className="text-slate-900 font-medium">
                                    {calcKg.toFixed(2)} KG
                                  </span>
                                ) : draft.unit === "Litre" ? (
                                  <span className="text-slate-900 font-medium">
                                    {qtyNum.toFixed(2)} Ltr
                                  </span>
                                ) : calcKg > 0 ? (
                                  <>
                                    <span className="text-slate-900 font-medium">
                                      {calcKg.toFixed(2)} KG
                                    </span>
                                    <span className="text-[10px] text-slate-400 mt-0.5">
                                      {qtyNum} pcs ÷ {prod.piecesPerKg}/kg
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-slate-700">{qtyNum} pcs</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>

                          {/* Clear Row */}
                          <td className="py-2.5 px-3 text-center">
                            {(draft.unit || draft.quantity) && (
                              <button
                                type="button"
                                onClick={() => handleClearRow(prod.id)}
                                title="Clear item"
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                              >
                                <X size={13} />
                              </button>
                            )}
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
      )}

      {/* =================================================================== */}
      {/* TAB 2: SAVED WORK SHEETS LIST (WITH THERMAL & A4 PRINT)             */}
      {/* =================================================================== */}
      {activeTab === "list" && (
        <div className="space-y-4 no-print">
          {/* Filters Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "today", label: "Today" },
                  { id: "yesterday", label: "Yesterday" },
                  { id: "this_week", label: "This Week" },
                  { id: "this_month", label: "This Month" },
                  { id: "custom", label: "Custom Date" },
                ] as { id: DateFilterMode; label: string }[]
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setDateFilter(f.id)}
                  className={`px-3 py-1.5 rounded-md text-xs border cursor-pointer transition-colors ${
                    dateFilter === f.id
                      ? "border-[#348bdd] bg-[#348bdd] text-white font-medium"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {dateFilter === "custom" && (
                <div className="flex items-center gap-2">
                  <CustomDatePicker
                    value={customStartDate}
                    onChange={setCustomStartDate}
                    compact
                    clearable={false}
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <CustomDatePicker
                    value={customEndDate}
                    onChange={setCustomEndDate}
                    compact
                    clearable={false}
                  />
                </div>
              )}

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 bg-white w-full sm:w-64">
                <Search size={13} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search worksheet #, item, note..."
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  className="w-full text-xs bg-transparent focus:outline-none"
                />
                {listSearch && (
                  <button
                    type="button"
                    onClick={() => setListSearch("")}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Saved Worksheets Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            {isLoadingWorksheets ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 size={22} className="animate-spin text-[#348bdd]" />
                <span className="text-xs">Loading saved work sheets...</span>
              </div>
            ) : filteredWorksheets.length === 0 ? (
              <div className="py-16 text-center space-y-2 px-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <ClipboardList size={20} />
                </div>
                <p className="text-xs font-medium text-slate-700">No work sheets found</p>
                <p className="text-[11px] text-slate-400">
                  Create a new work sheet to track production items and print Thermal or A4 sheets.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-mono uppercase text-slate-500">
                      <th className="py-2.5 px-4">Work Sheet #</th>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Selected Items</th>
                      <th className="py-2.5 px-4 text-right">Total KG</th>
                      <th className="py-2.5 px-4 text-right">Print & Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredWorksheets.map((ws) => (
                      <tr key={ws.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono">
                          <div className="font-medium text-slate-900">{ws.worksheetNumber}</div>
                          {ws.note && (
                            <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                              {ws.note}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar size={12} className="text-[#348bdd]" />
                            <span>{formatDisplayDate(ws.date)}</span>
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-[#348bdd] font-mono text-[10px] font-medium">
                              {ws.items?.length || 0} items
                            </span>
                            {(ws.items || []).slice(0, 3).map((item, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]"
                              >
                                {item.productName}: {item.quantity} {item.unit}
                              </span>
                            ))}
                            {(ws.items?.length || 0) > 3 && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                +{(ws.items?.length || 0) - 3} more
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                          {Number(ws.totalCalculatedKg || 0).toFixed(2)} KG
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingWorksheet(ws)}
                              title="View Work Sheet"
                              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer"
                            >
                              <Eye size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleThermalPrint(ws)}
                              title="Thermal Print (Selected Items Only)"
                              className="px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Printer size={12} />
                              <span>Thermal</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleA4Print(ws)}
                              title="A4 Print (Selected Items Only)"
                              className="px-2.5 py-1.5 rounded border border-blue-200 bg-blue-50 hover:bg-blue-100 text-[#348bdd] text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                            >
                              <FileText size={12} />
                              <span>A4 Print</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleEditWorksheet(ws)}
                              title="Edit Work Sheet"
                              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer"
                            >
                              <Edit2 size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeletingWorksheet(ws)}
                              title="Delete Work Sheet"
                              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
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

      {/* =================================================================== */}
      {/* VIEW WORK SHEET MODAL                                               */}
      {/* =================================================================== */}
      {viewingWorksheet && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4 no-print"
          onClick={() => setViewingWorksheet(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[88vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-slate-900">
                  Work Sheet #{viewingWorksheet.worksheetNumber}
                </h3>
                <p className="text-[11px] font-mono text-slate-500">
                  Date: {formatDisplayDate(viewingWorksheet.date)}
                  {viewingWorksheet.note ? ` • ${viewingWorksheet.note}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingWorksheet(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3">
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-mono text-[10px] uppercase text-slate-500">
                      <th className="py-2 px-3 w-8 text-center">#</th>
                      <th className="py-2 px-3">Item Name</th>
                      <th className="py-2 px-3 text-center">Unit</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3 text-right">Calc KG</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(viewingWorksheet.items || []).map((item, i) => (
                      <tr key={i}>
                        <td className="py-2 px-3 text-center font-mono text-slate-400">{i + 1}</td>
                        <td className="py-2 px-3 font-medium text-slate-900">{item.productName}</td>
                        <td className="py-2 px-3 text-center font-mono text-slate-600">{item.unit}</td>
                        <td className="py-2 px-3 text-right font-mono font-medium text-slate-900">
                          {item.quantity}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-[#348bdd] font-medium">
                          {item.calculatedKg > 0 ? `${Number(item.calculatedKg).toFixed(2)} KG` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-600">
                  Total Selected Items: <strong>{viewingWorksheet.items?.length || 0}</strong>
                </span>
                <span className="text-[#348bdd] font-medium">
                  Total KG: {Number(viewingWorksheet.totalCalculatedKg || 0).toFixed(2)} KG
                </span>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleThermalPrint(viewingWorksheet)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer size={13} />
                  <span>Thermal Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleA4Print(viewingWorksheet)}
                  className="px-3 py-1.5 rounded-lg text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                  style={{ backgroundColor: "var(--color-brand-primary)" }}
                >
                  <FileText size={13} />
                  <span>A4 Print</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setViewingWorksheet(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* DEDICATED A4 PRINTABLE WORK SHEET (BUSINESS DETAILS -> DATE -> ONLY */}
      {/* SELECTED ITEMS, ZERO BROWSER HEADERS/FOOTERS)                       */}
      {/* =================================================================== */}
      {printingA4Worksheet && (
        <>
          <style
            dangerouslySetInnerHTML={{
              __html: `
                @media print {
                  @page {
                    size: A4 portrait;
                    margin: 0 !important;
                  }
                  html, body {
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #ffffff !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                  }
                  body * {
                    visibility: hidden !important;
                  }
                  #printable-worksheet-a4,
                  #printable-worksheet-a4 * {
                    visibility: visible !important;
                  }
                  #printable-worksheet-a4 {
                    display: block !important;
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    margin: 0 !important;
                    padding: 12mm 15mm !important;
                    box-sizing: border-box !important;
                    background: #ffffff !important;
                  }
                }
              `,
            }}
          />
          <div id="printable-worksheet-a4" className="hidden print:block bg-white text-slate-900">
            {/* Business Details Header */}
            <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <img
                  src="/logo.png"
                  alt="Logo"
                  className="w-14 h-14 object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
                <div>
                  <h1 className="text-xl font-bold uppercase tracking-tight text-slate-900">
                    {businessProfile.tradeName || "Ravi Sweets & Cold Drinks"}
                  </h1>
                  <p className="text-xs text-slate-600">
                    {[
                      businessProfile.address,
                      businessProfile.city,
                      businessProfile.state,
                      businessProfile.pincode,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  <p className="text-xs text-slate-600 font-mono">
                    {businessProfile.phone && `Phone: ${businessProfile.phone}`}
                    {businessProfile.email && ` | Email: ${businessProfile.email}`}
                  </p>
                  {businessProfile.gstNumber && (
                    <p className="text-xs font-mono font-semibold text-slate-800">
                      GSTIN: {businessProfile.gstNumber}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-bold uppercase tracking-wider rounded-xs">
                  WORK SHEET
                </div>
                <div className="text-xs font-mono mt-2 space-y-0.5">
                  <div>
                    <span className="text-slate-500">Ref #: </span>
                    <strong>{printingA4Worksheet.worksheetNumber}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Date Bar Below Business Details */}
            <div className="my-4 p-3 rounded border border-slate-300 bg-slate-50 flex items-center justify-between text-xs font-mono">
              <div>
                <span className="text-slate-500 uppercase">Date: </span>
                <strong className="text-sm text-slate-900">
                  {formatDisplayDate(printingA4Worksheet.date)}
                </strong>
              </div>
              {printingA4Worksheet.note && (
                <div>
                  <span className="text-slate-500 uppercase">Note: </span>
                  <strong className="text-slate-900">{printingA4Worksheet.note}</strong>
                </div>
              )}
              <div>
                <span className="text-slate-500 uppercase">Items: </span>
                <strong className="text-slate-900">{printingA4Worksheet.items?.length || 0}</strong>
              </div>
            </div>

            {/* ONLY Selected Items Table */}
            <table className="w-full text-left text-xs border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 font-mono uppercase text-[10px] text-slate-800">
                  <th className="py-2.5 px-3 border-r border-slate-300 w-10 text-center">#</th>
                  <th className="py-2.5 px-3 border-r border-slate-300">Item Name</th>
                  <th className="py-2.5 px-3 border-r border-slate-300 w-24 text-center">Unit</th>
                  <th className="py-2.5 px-3 border-r border-slate-300 w-28 text-right">Quantity</th>
                  <th className="py-2.5 px-3 w-32 text-right">Calculated KG</th>
                </tr>
              </thead>
              <tbody>
                {(printingA4Worksheet.items || []).map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-200 font-medium text-slate-900">
                      {item.productName}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono">
                      {item.unit}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono font-semibold">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                      {item.calculatedKg > 0 ? `${Number(item.calculatedKg).toFixed(2)} KG` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-900 font-mono font-bold text-xs">
                  <td colSpan={3} className="py-2.5 px-3 border-r border-slate-300">
                    Total Selected Items: {printingA4Worksheet.items?.length || 0}
                  </td>
                  <td className="py-2.5 px-3 border-r border-slate-300 text-right">
                    Total Weight:
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {Number(printingA4Worksheet.totalCalculatedKg || 0).toFixed(2)} KG
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Signature Footer */}
            <div className="pt-14 flex items-end justify-between text-xs text-slate-700">
              <div className="text-center w-44">
                <div className="border-t border-slate-400 pt-1">Prepared By</div>
              </div>
              <div className="text-center w-44">
                <div className="border-t border-slate-400 pt-1">Verified By</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deletingWorksheet}
        onCancel={() => setDeletingWorksheet(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Work Sheet"
        message={
          deletingWorksheet
            ? `Are you sure you want to delete Work Sheet #${deletingWorksheet.worksheetNumber} (${formatDisplayDate(
                deletingWorksheet.date
              )})? This cannot be undone.`
            : ""
        }
        confirmText="Delete Work Sheet"
        isDeleting={isDeleting}
      />
    </div>
  );
}

