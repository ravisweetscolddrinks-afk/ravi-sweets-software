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
  Minus,
  RotateCcw,
  FolderTree,
  AlertCircle,
  LayoutGrid,
  List,
  Sparkles,
  Maximize2,
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
type EntryViewMode = "sheet" | "table";

export type StatementSectionKey =
  | "KAJU_ITEMS"
  | "REGULAR_ITEMS"
  | "KOVA_ITEMS"
  | "SWEETS"
  | "BENGALI_ITEMS"
  | "BAKLAVAS_ITEMS"
  | "HOT_ITEMS"
  | "OTHER_ITEMS";

export interface StatementSectionDef {
  key: StatementSectionKey;
  title: string;
  column: 1 | 2 | 3;
}

// Visual 3-Column Categorized Sections matching the physical Daily Stock Statement form
export const STATEMENT_SECTIONS: StatementSectionDef[] = [
  // Column 1
  { key: "KAJU_ITEMS", title: "KAJU ITEMS", column: 1 },
  { key: "REGULAR_ITEMS", title: "REGULAR ITEMS", column: 1 },
  // Column 2
  { key: "KOVA_ITEMS", title: "KOVA ITEMS", column: 2 },
  { key: "SWEETS", title: "SWEETS", column: 2 },
  // Column 3
  { key: "BENGALI_ITEMS", title: "BENGALI ITEMS", column: 3 },
  { key: "BAKLAVAS_ITEMS", title: "BAKLAVA'S ITEMS", column: 3 },
  { key: "HOT_ITEMS", title: "HOT ITEMS", column: 3 },
  { key: "OTHER_ITEMS", title: "OTHER ITEMS", column: 3 },
];

export function getProductStatementSection(product: {
  name: string;
  categoryName?: string;
}): StatementSectionKey {
  const cat = (product.categoryName || "").toLowerCase().trim();
  const name = (product.name || "").toLowerCase().trim();

  // 1. KAJU ITEMS
  if (
    cat.includes("kaju") ||
    name.includes("kaju") ||
    name.includes("badam roll") ||
    name.includes("badam chikki") ||
    name.includes("badam rakhi") ||
    name.includes("karjur") ||
    name.includes("khajoor") ||
    name.includes("chikki") ||
    name.includes("orange bullet")
  ) {
    return "KAJU_ITEMS";
  }

  // 2. KOVA ITEMS
  if (
    cat.includes("kova") ||
    name.includes("kova") ||
    name.includes("barfy") ||
    name.includes("agra pan")
  ) {
    return "KOVA_ITEMS";
  }

  // 3. HOT ITEMS (Namkeen / Savories)
  if (
    cat.includes("namkeen") ||
    cat.includes("hot") ||
    name.includes("pakodi") ||
    name.includes("pakoda") ||
    name.includes("mixture") ||
    name.includes("chekkalu") ||
    name.includes("ribbon") ||
    name.includes("chekodi") ||
    name.includes("pappu") ||
    name.includes("boondi") ||
    name.includes("poosa") ||
    name.includes("chenagalu") ||
    name.includes("batany") ||
    name.includes("samosa") ||
    name.includes("chips") ||
    name.includes("biscuits")
  ) {
    return "HOT_ITEMS";
  }

  // 4. BENGALI ITEMS (Juicy items)
  if (
    cat.includes("juicy") ||
    cat.includes("bengali") ||
    name.includes("bengali") ||
    name.includes("rasagulla") ||
    name.includes("jam") ||
    name.includes("rasamalai") ||
    name.includes("cheesecake")
  ) {
    return "BENGALI_ITEMS";
  }

  // 5. BAKLAVA'S ITEMS
  if (
    cat.includes("chocolate") ||
    cat.includes("baklava") ||
    name.includes("baklava") ||
    name.includes("baklawa") ||
    name.includes("kunafa")
  ) {
    return "BAKLAVAS_ITEMS";
  }

  // 6. SWEETS (Home foods, Marriage Sara, Traditional)
  if (
    cat.includes("home") ||
    cat.includes("marriage") ||
    cat.includes("sara") ||
    name.includes("junnu") ||
    name.includes("soam") ||
    name.includes("patisa") ||
    name.includes("sunnundalu") ||
    name.includes("sunnudalu") ||
    name.includes("ariselu") ||
    name.includes("kajj") ||
    name.includes("muddalu") ||
    name.includes("bobbatlu") ||
    name.includes("chilakalu") ||
    name.includes("dimma") ||
    name.includes("putha") ||
    name.includes("burelu") ||
    name.includes("gavvalu") ||
    name.includes("vennundalu")
  ) {
    return "SWEETS";
  }

  // 7. REGULAR ITEMS
  if (
    cat.includes("regular") ||
    name.includes("laddu") ||
    name.includes("badusha") ||
    name.includes("mysore") ||
    name.includes("mysure") ||
    name.includes("halwa") ||
    name.includes("kaja") ||
    name.includes("papidi") ||
    name.includes("papadi") ||
    name.includes("jangri")
  ) {
    return "REGULAR_ITEMS";
  }

  return "OTHER_ITEMS";
}

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

  // View Mode inside Create/Edit: "sheet" (3-column Daily Statement) or "table" (tabular list)
  const [entryViewMode, setEntryViewMode] = useState<EntryViewMode>("sheet");

  // Data States
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [worksheets, setWorksheets] = useState<WorksheetRecord[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);
  const [isLoadingWorksheets, setIsLoadingWorksheets] = useState<boolean>(true);

  const [businessProfile, setBusinessProfile] = useState({
    tradeName: "Ravi Sweets & Cool Drinks",
    legalName: "Ravi Sweets",
    phone: "",
    altPhone: "",
    email: "",
    address: "Shop No. 16, MSR Complex",
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

  // Filters & Search
  const [itemSearch, setItemSearch] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [productScope, setProductScope] = useState<"all" | "worksheet" | "selected">("all");

  // Saved Worksheets List Filters
  const [listSearch, setListSearch] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<DateFilterMode>("all");
  const [customStartDate, setCustomStartDate] = useState<string>(getTodayStr());
  const [customEndDate, setCustomEndDate] = useState<string>(getTodayStr());

  // Modals & Printing States
  const [viewingWorksheet, setViewingWorksheet] = useState<WorksheetRecord | null>(null);
  const [printingA4Worksheet, setPrintingA4Worksheet] = useState<WorksheetRecord | null>(null);
  const [printingDailyStatement, setPrintingDailyStatement] = useState<{
    worksheetNumber: string;
    date: string;
    note: string;
    items: WorksheetSavedItem[];
    isBlank?: boolean;
  } | null>(null);
  const [deletingWorksheet, setDeletingWorksheet] = useState<WorksheetRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Fullscreen Edit Modal for Saved Worksheets
  const [editingFullscreenWorksheet, setEditingFullscreenWorksheet] = useState<WorksheetRecord | null>(null);
  const [fsDate, setFsDate] = useState<string>(getTodayStr());
  const [fsNote, setFsNote] = useState<string>("");
  const [fsSearch, setFsSearch] = useState<string>("");
  const [fsScope, setFsScope] = useState<StatementSectionKey | "all">("all");
  const [fsOnlySelected, setFsOnlySelected] = useState<boolean>(false);
  const [fsDrafts, setFsDrafts] = useState<Record<string, RowDraft>>({});
  const [isFsSaving, setIsFsSaving] = useState<boolean>(false);

  // Cleanup print layout after print dialog closes
  useEffect(() => {
    const onAfterPrint = () => {
      setPrintingA4Worksheet(null);
      setPrintingDailyStatement(null);
    };
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

  // Realtime Firestore Listeners
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

  // Total calculated weight
  const totalSelectedKg = useMemo(
    () =>
      Number(
        selectedEntries.reduce((acc, item) => acc + (Number(item.calculatedKg) || 0), 0).toFixed(2)
      ),
    [selectedEntries]
  );

  // Incomplete rows count
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

  // Filtered product rows
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

  // Group displayed products into Statement Sections
  const sectionedProducts = useMemo(() => {
    const map: Record<StatementSectionKey, CatalogProduct[]> = {
      KAJU_ITEMS: [],
      REGULAR_ITEMS: [],
      KOVA_ITEMS: [],
      SWEETS: [],
      BENGALI_ITEMS: [],
      BAKLAVAS_ITEMS: [],
      HOT_ITEMS: [],
      OTHER_ITEMS: [],
    };

    displayedProducts.forEach((p) => {
      const sec = getProductStatementSection(p);
      map[sec].push(p);
    });

    return map;
  }, [displayedProducts]);

  // Group all products into sections for Print Daily Stock Statement
  const allSectionedProducts = useMemo(() => {
    const map: Record<StatementSectionKey, CatalogProduct[]> = {
      KAJU_ITEMS: [],
      REGULAR_ITEMS: [],
      KOVA_ITEMS: [],
      SWEETS: [],
      BENGALI_ITEMS: [],
      BAKLAVAS_ITEMS: [],
      HOT_ITEMS: [],
      OTHER_ITEMS: [],
    };

    products.forEach((p) => {
      const sec = getProductStatementSection(p);
      map[sec].push(p);
    });

    return map;
  }, [products]);

  // Sectioned items for Print Daily Stock Statement
  // When not a blank form, ONLY SELECTED ITEMS WITH QUANTITY > 0 ARE INCLUDED
  const printSectionedProducts = useMemo(() => {
    if (!printingDailyStatement) return allSectionedProducts;
    if (printingDailyStatement.isBlank) return allSectionedProducts;

    const savedMap = new Map<string, WorksheetSavedItem>();
    (printingDailyStatement.items || []).forEach((item) => {
      if (Number(item.quantity) > 0) {
        savedMap.set(item.productId, item);
      }
    });

    const map: Record<StatementSectionKey, CatalogProduct[]> = {
      KAJU_ITEMS: [],
      REGULAR_ITEMS: [],
      KOVA_ITEMS: [],
      SWEETS: [],
      BENGALI_ITEMS: [],
      BAKLAVAS_ITEMS: [],
      HOT_ITEMS: [],
      OTHER_ITEMS: [],
    };

    products.forEach((p) => {
      if (savedMap.has(p.id)) {
        const sec = getProductStatementSection(p);
        map[sec].push(p);
      }
    });

    // Also include any items that were saved in the worksheet but might not match products
    (printingDailyStatement.items || []).forEach((item) => {
      if (Number(item.quantity) > 0 && !products.some((p) => p.id === item.productId)) {
        const dummy: CatalogProduct = {
          id: item.productId,
          name: item.productName,
          categoryName: "Other",
          shortCode: "",
          barcode: "",
          unit: item.unit,
          kgPerTray: 2.5,
          piecesPerKg: 0,
          showInWorksheet: true,
        };
        const sec = getProductStatementSection(dummy);
        map[sec].push(dummy);
      }
    });

    return map;
  }, [printingDailyStatement, allSectionedProducts, products]);

  // Fullscreen edit entries & totals
  const fsSelectedEntries = useMemo(() => {
    const list: WorksheetSavedItem[] = [];
    products.forEach((p) => {
      const draft = fsDrafts[p.id];
      const qNum = Number(draft?.quantity) || 0;
      if (qNum > 0) {
        const selectedUnit: WorksheetUnit = (draft?.unit as WorksheetUnit) || "Tray";
        const calcKg = calculateRowKg(selectedUnit, qNum, p);
        list.push({
          productId: p.id,
          productName: p.name,
          categoryName: p.categoryName || "Other",
          unit: selectedUnit,
          quantity: qNum,
          calculatedKg: calcKg,
        });
      }
    });
    return list;
  }, [products, fsDrafts]);

  const fsTotalKg = useMemo(() => {
    return Number(fsSelectedEntries.reduce((acc, curr) => acc + curr.calculatedKg, 0).toFixed(2));
  }, [fsSelectedEntries]);

  const fsFilteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (fsOnlySelected) {
        const d = fsDrafts[p.id];
        if (!d || Number(d.quantity) <= 0) return false;
      }
      if (fsScope !== "all") {
        const sec = getProductStatementSection(p);
        if (sec !== fsScope) return false;
      }
      if (fsSearch.trim()) {
        const q = fsSearch.toLowerCase().trim();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.categoryName && p.categoryName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [products, fsOnlySelected, fsScope, fsSearch, fsDrafts]);

  // Row interaction handlers
  const handleSelectUnit = (productId: string, unit: WorksheetUnit) => {
    setRowDrafts((prev) => {
      const current = prev[productId] || { unit: "Tray", quantity: "1" };
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

  const handleIncrement = (productId: string) => {
    setRowDrafts((prev) => {
      const current = prev[productId] || { unit: "Tray", quantity: "0" };
      const currentQty = Number(current.quantity) || 0;
      const nextQty = currentQty + 1;
      return {
        ...prev,
        [productId]: {
          unit: current.unit || "Tray",
          quantity: String(nextQty),
        },
      };
    });
  };

  const handleDecrement = (productId: string) => {
    setRowDrafts((prev) => {
      const current = prev[productId] || { unit: "Tray", quantity: "0" };
      const currentQty = Number(current.quantity) || 0;
      const nextQty = Math.max(0, currentQty - 1);
      return {
        ...prev,
        [productId]: {
          unit: nextQty > 0 ? current.unit || "Tray" : "",
          quantity: nextQty > 0 ? String(nextQty) : "",
        },
      };
    });
  };

  const handleCardClick = (productId: string) => {
    setRowDrafts((prev) => {
      const current = prev[productId] || { unit: "Tray", quantity: "0" };
      const currentQty = Number(current.quantity) || 0;
      if (currentQty === 0 || !current.unit) {
        return {
          ...prev,
          [productId]: {
            unit: "Tray",
            quantity: "1",
          },
        };
      }
      return {
        ...prev,
        [productId]: {
          unit: current.unit || "Tray",
          quantity: String(currentQty + 1),
        },
      };
    });
  };

  const handleCycleUnit = (productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRowDrafts((prev) => {
      const current = prev[productId] || { unit: "Tray", quantity: "1" };
      const unitOrder: WorksheetUnit[] = ["Tray", "KG", "Piece", "Litre"];
      const currentIdx = unitOrder.indexOf((current.unit as WorksheetUnit) || "Tray");
      const nextUnit = unitOrder[(currentIdx + 1) % unitOrder.length];
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
    setCategoryFilter("all");
  };

  // Save Work Sheet to Firestore
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

  // Open saved worksheet in Fullscreen Modal ("edit should be in fullscreen modal")
  const handleOpenFullscreenEdit = (ws: WorksheetRecord) => {
    setEditingFullscreenWorksheet(ws);
    setFsDate(ws.date || getTodayStr());
    setFsNote(ws.note || "");
    setFsSearch("");
    setFsScope("all");
    setFsOnlySelected(false);

    const drafts: Record<string, RowDraft> = {};
    (ws.items || []).forEach((item) => {
      drafts[item.productId] = {
        unit: item.unit,
        quantity: String(item.quantity),
      };
    });
    setFsDrafts(drafts);
    showToast(`Editing Work Sheet #${ws.worksheetNumber} in fullscreen`, "info");
  };

  const handleEditWorksheet = (ws: WorksheetRecord) => {
    handleOpenFullscreenEdit(ws);
  };

  // Fullscreen Modal Handlers
  const handleFsSelectUnit = (productId: string, unit: WorksheetUnit) => {
    setFsDrafts((prev) => {
      const current = prev[productId] || { unit: "Tray", quantity: "1" };
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

  const handleFsQuantityChange = (productId: string, rawVal: string) => {
    setFsDrafts((prev) => {
      const current = prev[productId] || { unit: "Tray", quantity: "" };
      return {
        ...prev,
        [productId]: {
          ...current,
          quantity: rawVal,
        },
      };
    });
  };

  const handleFsIncrement = (productId: string) => {
    setFsDrafts((prev) => {
      const current = prev[productId] || { unit: "Tray", quantity: "0" };
      const currentNum = Number(current.quantity) || 0;
      return {
        ...prev,
        [productId]: {
          ...current,
          quantity: String(currentNum + 1),
        },
      };
    });
  };

  const handleFsDecrement = (productId: string) => {
    setFsDrafts((prev) => {
      const current = prev[productId] || { unit: "Tray", quantity: "0" };
      const currentNum = Number(current.quantity) || 0;
      const nextNum = Math.max(0, currentNum - 1);
      return {
        ...prev,
        [productId]: {
          ...current,
          quantity: nextNum > 0 ? String(nextNum) : "",
        },
      };
    });
  };

  // Save changes from Fullscreen Edit Modal
  const handleSaveFullscreenEdit = async () => {
    if (!editingFullscreenWorksheet) return;

    if (fsSelectedEntries.length === 0) {
      showToast("Cannot save an empty work sheet. Please enter at least 1 item quantity.", "error");
      return;
    }

    setIsFsSaving(true);
    try {
      await updateDoc(doc(db, "worksheets", editingFullscreenWorksheet.id), {
        date: fsDate,
        note: fsNote.trim(),
        items: fsSelectedEntries,
        totalCalculatedKg: fsTotalKg,
        totalItemsCount: fsSelectedEntries.length,
        updatedAt: serverTimestamp(),
      });

      showToast(`Work Sheet #${editingFullscreenWorksheet.worksheetNumber} updated successfully!`, "success");
      setEditingFullscreenWorksheet(null);
    } catch (err: any) {
      console.error("Error saving fullscreen edit:", err);
      showToast("Failed to update work sheet: " + err.message, "error");
    } finally {
      setIsFsSaving(false);
    }
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

  // Thermal Print Handler
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

  // Standard A4 Print Handler
  const handleA4Print = (ws: WorksheetRecord) => {
    setPrintingA4Worksheet(ws);
    setTimeout(() => {
      window.print();
    }, 180);
  };

  // Daily Stock Statement 3-Column A4 Print Handler (from image)
  const handlePrintDailyStatement = (
    target?: WorksheetRecord | null,
    isBlank: boolean = false
  ) => {
    if (isBlank) {
      setPrintingDailyStatement({
        worksheetNumber: "BLANK-FORM",
        date: "",
        note: "",
        items: [],
        isBlank: true,
      });
    } else if (target) {
      setPrintingDailyStatement({
        worksheetNumber: target.worksheetNumber,
        date: target.date,
        note: target.note || "",
        items: target.items || [],
        isBlank: false,
      });
    } else {
      // Print current draft
      setPrintingDailyStatement({
        worksheetNumber: editingWorksheetNumber || "DRAFT",
        date: worksheetDate,
        note: worksheetNote,
        items: selectedEntries,
        isBlank: false,
      });
    }

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

  // Helper render for single card row in the 3-column Sheet view
  const renderSheetItemRow = (prod: CatalogProduct) => {
    const draft = rowDrafts[prod.id] || { unit: "Tray", quantity: "1" };
    const qtyNum = Number(draft.quantity) || 0;
    const isRowActive = Boolean(draft.unit && qtyNum > 0);
    const isMissingUnit = Boolean(!draft.unit && qtyNum > 0);
    const calcKg = calculateRowKg(draft.unit, qtyNum, prod);

    return (
      <div
        key={prod.id}
        onClick={() => handleCardClick(prod.id)}
        className={`px-3 py-2 border-b border-slate-200 flex items-center justify-between gap-2 transition-all cursor-pointer select-none group ${
          isRowActive
            ? "bg-blue-50/60 hover:bg-blue-50/90 border-l-4 border-l-[#348bdd]"
            : isMissingUnit
            ? "bg-amber-50/60 border-l-4 border-l-amber-400"
            : "hover:bg-slate-50/80 text-slate-700 border-l-4 border-l-transparent"
        }`}
      >
        {/* Left: Product Name, Tray Rate & Live Weight */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="font-semibold text-xs text-slate-900 truncate" title={prod.name}>
            {prod.name}
          </div>
          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
            {prod.kgPerTray > 0 ? (
              <span>{prod.kgPerTray} kg/tray</span>
            ) : prod.piecesPerKg > 0 ? (
              <span>{prod.piecesPerKg} pcs/kg</span>
            ) : null}
            {isRowActive && calcKg > 0 && (
              <span className="text-[#348bdd] font-semibold">
                • {calcKg.toFixed(2)} KG
              </span>
            )}
          </div>
        </div>

        {/* Right: Plus, Minus & Quantity Input Stepper */}
        <div
          className="flex items-center gap-1.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Subtle Unit Badge: Tray / KG / Pcs - clicking it cycles unit if needed */}
          <button
            type="button"
            onClick={(e) => handleCycleUnit(prod.id, e)}
            className="px-1.5 py-1 text-[10px] font-mono font-medium rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
            title="Click to change unit (Tray / KG / Piece / Litre)"
          >
            {draft.unit || "Tray"}
          </button>

          {/* Stepper with Minus (-), Input, and Plus (+) */}
          <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => handleDecrement(prod.id)}
              disabled={qtyNum <= 0}
              className="w-7 h-7 flex items-center justify-center bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Decrease quantity (-1)"
            >
              <Minus size={13} />
            </button>

            <input
              type="number"
              min="0"
              step="any"
              value={draft.quantity}
              onWheel={(e) => e.currentTarget.blur()}
              onChange={(e) => handleQuantityChange(prod.id, e.target.value)}
              placeholder="0"
              className="w-12 h-7 text-center text-xs font-mono font-bold bg-white text-slate-900 border-x border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
            />

            <button
              type="button"
              onClick={() => handleIncrement(prod.id)}
              className="w-7 h-7 flex items-center justify-center bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-[#348bdd] hover:bg-blue-50 transition-colors cursor-pointer font-bold"
              title="Increase quantity (+1)"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Helper render for single section block in the 3-column Sheet view
  const renderSectionBlock = (sectionKey: StatementSectionKey) => {
    const sectionDef = STATEMENT_SECTIONS.find((s) => s.key === sectionKey);
    const items = sectionedProducts[sectionKey] || [];
    if (!sectionDef || items.length === 0) return null;

    const activeCount = items.filter((p) => {
      const d = rowDrafts[p.id];
      return d && d.unit && Number(d.quantity) > 0;
    }).length;

    return (
      <div key={sectionKey} className="border-b border-slate-300 last:border-b-0">
        {/* Section Header */}
        <div className="bg-slate-100/90 px-3 py-1.5 border-y border-slate-300 flex items-center justify-between">
          <span className="font-bold text-xs uppercase tracking-wide text-slate-900">
            {sectionDef.title}
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            {activeCount}/{items.length} active
          </span>
        </div>

        {/* Items List */}
        <div className="divide-y divide-slate-100">
          {items.map((prod) => renderSheetItemRow(prod))}
        </div>
      </div>
    );
  };

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
              Work Sheet Entry
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
            Daily Stock Statement entry formatted in categorized 3-column sheet layout with quick unit & quantity inputs, real-time KG calculations, and A4 statement printing.
          </p>
        </div>

        {/* Top Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === "create" && (
            <>
              <button
                type="button"
                onClick={() => handlePrintDailyStatement(null, false)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium cursor-pointer shadow-2xs"
                title="Print Daily Stock Statement (A4 formatted like paper pad)"
              >
                <Printer size={13} className="text-[#348bdd]" />
                <span>Print Statement</span>
              </button>

              <button
                type="button"
                onClick={() => handlePrintDailyStatement(null, true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[11px] cursor-pointer shadow-2xs"
                title="Print Blank Daily Stock Statement pad sheet for pen & paper writing"
              >
                <FileText size={13} className="text-slate-500" />
                <span>Print Blank Pad</span>
              </button>
            </>
          )}

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
      <div className="flex items-center justify-between border-b border-slate-200 no-print">
        <div className="flex items-center gap-2">
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
            <span>{editingWorksheetId ? `Edit #${editingWorksheetNumber}` : "Work Sheet Entry"}</span>
            {selectedEntries.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-blue-100 text-[#348bdd]">
                {selectedEntries.length} items ({totalSelectedKg.toFixed(1)} KG)
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

        {/* View Switcher inside Create tab (Statement Sheet vs Table List) */}
        {activeTab === "create" && (
          <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setEntryViewMode("sheet")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-all ${
                entryViewMode === "sheet"
                  ? "bg-white text-[#348bdd] shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <LayoutGrid size={13} />
              <span>Statement Sheet View</span>
            </button>
            <button
              type="button"
              onClick={() => setEntryViewMode("table")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-all ${
                entryViewMode === "table"
                  ? "bg-white text-[#348bdd] shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <List size={13} />
              <span>Table List View</span>
            </button>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* TAB 1: CREATE / EDIT WORK SHEET (DAILY STOCK STATEMENT FORMAT)       */}
      {/* =================================================================== */}
      {activeTab === "create" && (
        <div className="space-y-4 no-print">
          {/* Top Control Bar: Date, Shift/Note, Selection Stats & Save */}
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
                  placeholder="e.g. Morning Batch, Festival Prep, Shift A..."
                  value={worksheetNote}
                  onChange={(e) => setWorksheetNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                />
              </div>
            </div>

            {/* Live Stats + Save Button */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="px-3.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono flex items-center gap-3">
                <div>
                  <span className="text-slate-400">Items: </span>
                  <span className="font-semibold text-slate-900">{selectedEntries.length}</span>
                </div>
                <div className="h-3.5 w-px bg-slate-200" />
                <div>
                  <span className="text-slate-400">Total KG: </span>
                  <span className="font-semibold text-[#348bdd]">{totalSelectedKg.toFixed(2)} KG</span>
                </div>
              </div>

              {(selectedEntries.length > 0 || editingWorksheetId) && (
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw size={13} />
                  <span>{editingWorksheetId ? "Cancel Edit" : "Reset All"}</span>
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

          {/* Filter & Scope Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 bg-white w-full sm:w-72">
                <Search size={14} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search sweet name across sections..."
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

              {/* Category dropdown */}
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

            {/* Scope Toggle & Quick Select Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
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

          {/* =============================================================== */}
          {/* VIEW 1: DAILY STATEMENT SHEET VIEW (3-COLUMN PHYSICAL LAYOUT)   */}
          {/* =============================================================== */}
          {entryViewMode === "sheet" && (
            <div className="border border-slate-300 rounded-xl bg-white overflow-hidden shadow-2xs">
              {/* Sheet Header styled like physical Daily Stock Statement */}
              <div className="bg-slate-50 border-b border-slate-300 px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between text-center sm:text-left gap-3">
                <div>
                  <div className="text-[11px] font-mono tracking-widest text-slate-500 uppercase font-bold">
                    DAILY STOCK STATMENT
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight uppercase">
                    {businessProfile.tradeName || "RAVI SWEETS & COOL DRINKS"}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {businessProfile.address}, {businessProfile.city}.
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-300">
                  <span className="text-xs font-mono font-bold text-slate-700">Dt.</span>
                  <span className="text-xs font-mono font-medium text-slate-900">
                    {formatDisplayDate(worksheetDate)}
                  </span>
                </div>
              </div>

              {isLoadingProducts ? (
                <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 size={24} className="animate-spin text-[#348bdd]" />
                  <span className="text-xs">Loading daily stock sheet...</span>
                </div>
              ) : (
                /* 3 Columns Grid matching physical sheet */
                <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-300">
                  {/* ================= COLUMN 1 ================= */}
                  <div className="flex flex-col">
                    {renderSectionBlock("KAJU_ITEMS")}
                    {renderSectionBlock("REGULAR_ITEMS")}

                    {/* Lined extra blank space matching the photo */}
                    <div className="p-3 bg-slate-50/40 border-t border-slate-200 flex-1 min-h-[90px]">
                      <div className="text-[10px] font-mono uppercase text-slate-400 mb-2">
                        Extra Custom Items
                      </div>
                      <div className="space-y-2">
                        <div className="border-b border-dashed border-slate-300 h-5" />
                        <div className="border-b border-dashed border-slate-300 h-5" />
                        <div className="border-b border-dashed border-slate-300 h-5" />
                      </div>
                    </div>
                  </div>

                  {/* ================= COLUMN 2 ================= */}
                  <div className="flex flex-col">
                    {renderSectionBlock("KOVA_ITEMS")}
                    {renderSectionBlock("SWEETS")}

                    {/* Daily Note Section matching the photo's Daily Note : */}
                    <div className="p-3.5 border-t border-slate-300 bg-slate-50/60 flex-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-800">
                          Daily Note :
                        </label>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Printed on statement
                        </span>
                      </div>
                      <textarea
                        rows={6}
                        value={worksheetNote}
                        onChange={(e) => setWorksheetNote(e.target.value)}
                        placeholder="Write special orders, shift instructions, milk notes, festival planning..."
                        className="w-full p-2.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(transparent, transparent 23px, #e2e8f0 24px)",
                          lineHeight: "24px",
                        }}
                      />
                    </div>
                  </div>

                  {/* ================= COLUMN 3 ================= */}
                  <div className="flex flex-col">
                    {renderSectionBlock("BENGALI_ITEMS")}
                    {renderSectionBlock("BAKLAVAS_ITEMS")}
                    {renderSectionBlock("HOT_ITEMS")}
                    {renderSectionBlock("OTHER_ITEMS")}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =============================================================== */}
          {/* VIEW 2: STANDARD TABULAR LIST VIEW                              */}
          {/* =============================================================== */}
          {entryViewMode === "table" && (
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
                            <td className="py-2.5 px-4 text-center font-mono text-[11px] text-slate-400">
                              {isRowActive ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#348bdd] text-white">
                                  <Check size={11} />
                                </span>
                              ) : (
                                idx + 1
                              )}
                            </td>

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
          )}
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
                  Create a new work sheet to track production items and print Daily Statement or Thermal receipts.
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
                              onClick={() => handlePrintDailyStatement(ws, false)}
                              title="Print Daily Stock Statement (3-Column Layout)"
                              className="px-2.5 py-1.5 rounded border border-blue-200 bg-blue-50 hover:bg-blue-100 text-[#348bdd] text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                            >
                              <FileText size={12} />
                              <span>Statement</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleThermalPrint(ws)}
                              title="Thermal Print"
                              className="px-2.5 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Printer size={12} />
                              <span>Thermal</span>
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
                  Total Items: <strong>{viewingWorksheet.items?.length || 0}</strong>
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
                  onClick={() => handlePrintDailyStatement(viewingWorksheet, false)}
                  className="px-3 py-1.5 rounded-lg text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                  style={{ backgroundColor: "var(--color-brand-primary)" }}
                >
                  <FileText size={13} />
                  <span>Print Statement</span>
                </button>
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
                  onClick={() => {
                    const target = viewingWorksheet;
                    setViewingWorksheet(null);
                    handleOpenFullscreenEdit(target);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit2 size={13} />
                  <span>Edit Fullscreen</span>
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
      {/* 3-COLUMN DAILY STOCK STATEMENT A4 PRINT LAYOUT (EXACT REPLICA)      */}
      {/* =================================================================== */}
      {printingDailyStatement && (
        <>
          <style
            dangerouslySetInnerHTML={{
              __html: `
                @media print {
                  @page {
                    size: A4 portrait;
                    margin: 6mm 8mm !important;
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
                  #printable-daily-stock-statement,
                  #printable-daily-stock-statement * {
                    visibility: visible !important;
                  }
                  #printable-daily-stock-statement {
                    display: block !important;
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    box-sizing: border-box !important;
                    background: #ffffff !important;
                    font-family: Arial, sans-serif !important;
                    color: #000000 !important;
                  }
                }
              `,
            }}
          />
          <div
            id="printable-daily-stock-statement"
            className="hidden print:block bg-white text-black text-[11px]"
          >
            <div className="border border-black p-2">
              {/* Top Title Banner */}
              <div className="text-center pb-2 mb-2 border-b border-black relative">
                <div className="text-xs font-bold tracking-widest uppercase">
                  DAILY STOCK STATMENT
                </div>
                <h1 className="text-xl font-black uppercase tracking-tight leading-tight">
                  {businessProfile.tradeName || "RAVI SWEETS & COOL DRINKS"}
                </h1>
                <p className="text-[11px] font-semibold">
                  {businessProfile.address}, {businessProfile.city}.
                </p>
                <div className="absolute right-1 top-2 text-xs font-bold font-mono">
                  Dt. {printingDailyStatement.isBlank ? "...................." : formatDisplayDate(printingDailyStatement.date)}
                </div>
              </div>

              {/* 3 Columns Boxed Grid */}
              <div className="grid grid-cols-3 border border-black divide-x divide-black">
                {/* ================= PRINT COLUMN 1 ================= */}
                <div className="divide-y divide-black flex flex-col justify-between">
                  <div>
                    {/* KAJU ITEMS */}
                    {(printSectionedProducts.KAJU_ITEMS.length > 0 || printingDailyStatement.isBlank) && (
                      <div>
                        <div className="bg-slate-200/80 font-black px-2 py-1 uppercase text-[11px] border-b border-black">
                          KAJU ITEMS
                        </div>
                        <div>
                          {printSectionedProducts.KAJU_ITEMS.map((item) => {
                            const saved = printingDailyStatement.items.find(
                              (i) => i.productId === item.id
                            );
                            return (
                              <div
                                key={item.id}
                                className="px-2 py-0.5 border-b border-black/40 flex items-center justify-between text-[10px] leading-tight"
                              >
                                <span className="font-semibold">{item.name}</span>
                                <span className="font-mono font-bold">
                                  {printingDailyStatement.isBlank
                                    ? ""
                                    : saved
                                    ? `${saved.quantity} ${saved.unit}`
                                    : ""}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* REGULAR ITEMS */}
                    {(printSectionedProducts.REGULAR_ITEMS.length > 0 || printingDailyStatement.isBlank) && (
                      <div>
                        <div className="bg-slate-200/80 font-black px-2 py-1 uppercase text-[11px] border-y border-black">
                          REGULAR ITEMS
                        </div>
                        <div>
                          {printSectionedProducts.REGULAR_ITEMS.map((item) => {
                            const saved = printingDailyStatement.items.find(
                              (i) => i.productId === item.id
                            );
                            return (
                              <div
                                key={item.id}
                                className="px-2 py-0.5 border-b border-black/40 flex items-center justify-between text-[10px] leading-tight"
                              >
                                <span className="font-semibold">{item.name}</span>
                                <span className="font-mono font-bold">
                                  {printingDailyStatement.isBlank
                                    ? ""
                                    : saved
                                    ? `${saved.quantity} ${saved.unit}`
                                    : ""}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Blank lined area at bottom of Column 1 (shown on blank template) */}
                  {printingDailyStatement.isBlank && (
                    <div className="p-2 border-t border-black min-h-[90px] space-y-3">
                      <div className="border-b border-black border-dashed h-3" />
                      <div className="border-b border-black border-dashed h-3" />
                      <div className="border-b border-black border-dashed h-3" />
                      <div className="border-b border-black border-dashed h-3" />
                    </div>
                  )}
                </div>

                {/* ================= PRINT COLUMN 2 ================= */}
                <div className="divide-y divide-black flex flex-col justify-between">
                  <div>
                    {/* KOVA ITEMS */}
                    {(printSectionedProducts.KOVA_ITEMS.length > 0 || printingDailyStatement.isBlank) && (
                      <div>
                        <div className="bg-slate-200/80 font-black px-2 py-1 uppercase text-[11px] border-b border-black">
                          KOVA ITEMS
                        </div>
                        <div>
                          {printSectionedProducts.KOVA_ITEMS.map((item) => {
                            const saved = printingDailyStatement.items.find(
                              (i) => i.productId === item.id
                            );
                            return (
                              <div
                                key={item.id}
                                className="px-2 py-0.5 border-b border-black/40 flex items-center justify-between text-[10px] leading-tight"
                              >
                                <span className="font-semibold">{item.name}</span>
                                <span className="font-mono font-bold">
                                  {printingDailyStatement.isBlank
                                    ? ""
                                    : saved
                                    ? `${saved.quantity} ${saved.unit}`
                                    : ""}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* SWEETS */}
                    {(printSectionedProducts.SWEETS.length > 0 || printingDailyStatement.isBlank) && (
                      <div>
                        <div className="bg-slate-200/80 font-black px-2 py-1 uppercase text-[11px] border-y border-black">
                          SWEETS
                        </div>
                        <div>
                          {printSectionedProducts.SWEETS.map((item) => {
                            const saved = printingDailyStatement.items.find(
                              (i) => i.productId === item.id
                            );
                            return (
                              <div
                                key={item.id}
                                className="px-2 py-0.5 border-b border-black/40 flex items-center justify-between text-[10px] leading-tight"
                              >
                                <span className="font-semibold">{item.name}</span>
                                <span className="font-mono font-bold">
                                  {printingDailyStatement.isBlank
                                    ? ""
                                    : saved
                                    ? `${saved.quantity} ${saved.unit}`
                                    : ""}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Daily Note Area */}
                  <div className="p-2 border-t border-black min-h-[140px]">
                    <div className="font-black uppercase text-[11px] mb-1">Daily Note :</div>
                    {printingDailyStatement.note && !printingDailyStatement.isBlank ? (
                      <div className="text-[10px] font-mono whitespace-pre-wrap leading-relaxed">
                        {printingDailyStatement.note}
                      </div>
                    ) : (
                      <div className="space-y-4 pt-1">
                        <div className="border-b border-black border-dashed h-4" />
                        <div className="border-b border-black border-dashed h-4" />
                        <div className="border-b border-black border-dashed h-4" />
                        <div className="border-b border-black border-dashed h-4" />
                      </div>
                    )}
                  </div>
                </div>

                {/* ================= PRINT COLUMN 3 ================= */}
                <div className="divide-y divide-black">
                  {/* BENGALI ITEMS */}
                  {(printSectionedProducts.BENGALI_ITEMS.length > 0 || printingDailyStatement.isBlank) && (
                    <div>
                      <div className="bg-slate-200/80 font-black px-2 py-1 uppercase text-[11px] border-b border-black">
                        BENGALI ITEMS
                      </div>
                      <div>
                        {printSectionedProducts.BENGALI_ITEMS.map((item) => {
                          const saved = printingDailyStatement.items.find(
                            (i) => i.productId === item.id
                          );
                          return (
                            <div
                              key={item.id}
                              className="px-2 py-0.5 border-b border-black/40 flex items-center justify-between text-[10px] leading-tight"
                            >
                              <span className="font-semibold">{item.name}</span>
                              <span className="font-mono font-bold">
                                {printingDailyStatement.isBlank
                                  ? ""
                                  : saved
                                  ? `${saved.quantity} ${saved.unit}`
                                  : ""}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* BAKLAVA'S ITEMS */}
                  {(printSectionedProducts.BAKLAVAS_ITEMS.length > 0 || printingDailyStatement.isBlank) && (
                    <div>
                      <div className="bg-slate-200/80 font-black px-2 py-1 uppercase text-[11px] border-y border-black">
                        BAKLAVA&apos;S ITEMS
                      </div>
                      <div>
                        {printSectionedProducts.BAKLAVAS_ITEMS.map((item) => {
                          const saved = printingDailyStatement.items.find(
                            (i) => i.productId === item.id
                          );
                          return (
                            <div
                              key={item.id}
                              className="px-2 py-0.5 border-b border-black/40 flex items-center justify-between text-[10px] leading-tight"
                            >
                              <span className="font-semibold">{item.name}</span>
                              <span className="font-mono font-bold">
                                {printingDailyStatement.isBlank
                                  ? ""
                                  : saved
                                  ? `${saved.quantity} ${saved.unit}`
                                  : ""}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* HOT ITEMS */}
                  {(printSectionedProducts.HOT_ITEMS.length > 0 || printingDailyStatement.isBlank) && (
                    <div>
                      <div className="bg-slate-200/80 font-black px-2 py-1 uppercase text-[11px] border-y border-black">
                        HOT ITEMS
                      </div>
                      <div>
                        {printSectionedProducts.HOT_ITEMS.map((item) => {
                          const saved = printingDailyStatement.items.find(
                            (i) => i.productId === item.id
                          );
                          return (
                            <div
                              key={item.id}
                              className="px-2 py-0.5 border-b border-black/40 flex items-center justify-between text-[10px] leading-tight"
                            >
                              <span className="font-semibold">{item.name}</span>
                              <span className="font-mono font-bold">
                                {printingDailyStatement.isBlank
                                  ? ""
                                  : saved
                                  ? `${saved.quantity} ${saved.unit}`
                                  : ""}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* OTHER ITEMS */}
                  {(printSectionedProducts.OTHER_ITEMS.length > 0 || printingDailyStatement.isBlank) && (
                    <div>
                      <div className="bg-slate-200/80 font-black px-2 py-1 uppercase text-[11px] border-y border-black">
                        OTHER ITEMS
                      </div>
                      <div>
                        {printSectionedProducts.OTHER_ITEMS.map((item) => {
                          const saved = printingDailyStatement.items.find(
                            (i) => i.productId === item.id
                          );
                          return (
                            <div
                              key={item.id}
                              className="px-2 py-0.5 border-b border-black/40 flex items-center justify-between text-[10px] leading-tight"
                            >
                              <span className="font-semibold">{item.name}</span>
                              <span className="font-mono font-bold">
                                {printingDailyStatement.isBlank
                                  ? ""
                                  : saved
                                  ? `${saved.quantity} ${saved.unit}`
                                  : ""}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* =================================================================== */}
      {/* FULLSCREEN EDIT MODAL FOR SAVED WORKSHEET                          */}
      {/* =================================================================== */}
      {editingFullscreenWorksheet && (
        <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col font-sans text-slate-800 animate-in fade-in duration-150">
          {/* Header Bar */}
          <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-2xs">
            <div className="px-4 sm:px-6 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              {/* Left: Title & Badge */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditingFullscreenWorksheet(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Close Fullscreen Editor"
                >
                  <X size={20} />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">
                      Edit Work Sheet #{editingFullscreenWorksheet.worksheetNumber}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wider bg-[#348bdd]/10 text-[#348bdd] border border-[#348bdd]/20 uppercase">
                      Fullscreen Mode
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Modify product quantities, switch measurement units, and update notes
                  </p>
                </div>
              </div>

              {/* Center: Date Picker */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600 uppercase font-mono">Date:</span>
                <div className="w-44">
                  <CustomDatePicker
                    value={fsDate}
                    onChange={(d) => setFsDate(d)}
                    placeholder="Worksheet Date"
                  />
                </div>
              </div>

              {/* Right: Metrics & Actions */}
              <div className="flex items-center gap-2.5">
                <div className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono text-slate-700">
                  <span className="font-bold text-slate-900">{fsSelectedEntries.length}</span> items •{" "}
                  <span className="font-bold text-[#348bdd]">{fsTotalKg} KG</span>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingFullscreenWorksheet(null)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveFullscreenEdit}
                  disabled={isFsSaving || fsSelectedEntries.length === 0}
                  className="px-4 py-2 rounded-xl bg-[#348bdd] hover:bg-[#2b7bc4] active:scale-[0.98] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isFsSaving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} className="stroke-[2.5]" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Filter Sub-Bar */}
            <div className="px-4 sm:px-6 py-2.5 bg-slate-50/80 border-t border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search sweets in worksheet..."
                  value={fsSearch}
                  onChange={(e) => setFsSearch(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                />
                {fsSearch && (
                  <button
                    type="button"
                    onClick={() => setFsSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Scope filter pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setFsScope("all")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                    fsScope === "all"
                      ? "bg-[#348bdd] text-white shadow-2xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  All Categories
                </button>
                {(
                  [
                    "KAJU_ITEMS",
                    "REGULAR_ITEMS",
                    "KOVA_ITEMS",
                    "SWEETS",
                    "BENGALI_ITEMS",
                    "BAKLAVAS_ITEMS",
                    "HOT_ITEMS",
                  ] as StatementSectionKey[]
                ).map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setFsScope(sec)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                      fsScope === sec
                        ? "bg-[#348bdd] text-white shadow-2xs"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {STATEMENT_SECTIONS.find((s) => s.key === sec)?.title || sec}
                  </button>
                ))}
              </div>

              {/* Only Selected Filter Toggle */}
              <label className="inline-flex items-center gap-2 cursor-pointer select-none shrink-0 font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={fsOnlySelected}
                  onChange={(e) => setFsOnlySelected(e.target.checked)}
                  className="rounded border-slate-300 text-[#348bdd] focus:ring-0 cursor-pointer h-4 w-4"
                />
                <span>Only Selected ({fsSelectedEntries.length})</span>
              </label>
            </div>
          </header>

          {/* Main Fullscreen Scroll Area */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {fsFilteredProducts.length === 0 ? (
              <div className="py-20 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                <ClipboardList size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No sweets match the filters</p>
                <p className="text-xs text-slate-400 mt-1">Try clearing search or unchecking &quot;Only Selected&quot;</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {fsFilteredProducts.map((p) => {
                  const draft = fsDrafts[p.id];
                  const qNum = Number(draft?.quantity) || 0;
                  const isSelected = qNum > 0;
                  const currentUnit: WorksheetUnit = (draft?.unit as WorksheetUnit) || "Tray";
                  const calcKg = calculateRowKg(currentUnit, qNum, p);

                  return (
                    <div
                      key={p.id}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between bg-white ${
                        isSelected
                          ? "border-[#348bdd] ring-1 ring-blue-100 shadow-xs"
                          : "border-slate-200 hover:border-slate-300 shadow-2xs"
                      }`}
                    >
                      {/* Name & Category */}
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-xs text-slate-900 line-clamp-1 leading-snug">
                            {p.name}
                          </h4>
                          {isSelected && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-[#348bdd] font-mono text-[10px] font-bold shrink-0">
                              ~{calcKg} KG
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {p.categoryName || "General"}
                        </p>

                        {/* Unit selector pills */}
                        <div className="flex items-center gap-1 mt-2.5">
                          {ALL_UNITS.map((u) => (
                            <button
                              key={u}
                              type="button"
                              onClick={() => handleFsSelectUnit(p.id, u)}
                              className={`flex-1 py-1 rounded-md text-[10px] font-bold font-mono transition-colors cursor-pointer text-center ${
                                currentUnit === u
                                  ? "bg-[#348bdd] text-white shadow-2xs"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                            >
                              {u}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Stepper with minus, input, plus */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleFsDecrement(p.id)}
                          className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 flex items-center justify-center transition-all cursor-pointer font-bold shrink-0"
                          title="Decrease"
                        >
                          <Minus size={13} />
                        </button>

                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0"
                          value={draft?.quantity || ""}
                          onChange={(e) => handleFsQuantityChange(p.id, e.target.value)}
                          className="flex-1 min-w-0 h-8 text-center text-xs font-mono font-bold border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                        />

                        <button
                          type="button"
                          onClick={() => handleFsIncrement(p.id)}
                          className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 flex items-center justify-center transition-all cursor-pointer font-bold shrink-0"
                          title="Increase"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Daily Note in Fullscreen */}
            <div className="mt-6 p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Daily Note / Remarks
              </label>
              <textarea
                rows={3}
                placeholder="Write any production remarks, party balance notes, or special instructions..."
                value={fsNote}
                onChange={(e) => setFsNote(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
              />
            </div>
          </main>

          {/* Sticky Footer */}
          <footer className="sticky bottom-0 z-30 bg-white border-t border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-4 text-xs font-mono">
              <span>
                Selected Sweets: <strong className="text-slate-900">{fsSelectedEntries.length}</strong>
              </span>
              <span>
                Total Production Weight: <strong className="text-[#348bdd] text-sm">{fsTotalKg} KG</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditingFullscreenWorksheet(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveFullscreenEdit}
                disabled={isFsSaving || fsSelectedEntries.length === 0}
                className="px-5 py-2 rounded-xl bg-[#348bdd] hover:bg-[#2b7bc4] active:scale-[0.98] text-white text-xs font-semibold flex items-center gap-2 shadow-xs disabled:opacity-50 transition-all cursor-pointer"
              >
                {isFsSaving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} className="stroke-[2.5]" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </footer>
        </div>
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
