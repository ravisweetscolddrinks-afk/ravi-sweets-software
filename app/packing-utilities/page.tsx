"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import {
  Boxes,
  Package,
  PackageCheck,
  PackagePlus,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ArrowUpDown,
  Download,
  RotateCw,
  Loader2,
  X,
  Layers,
  History,
  TrendingDown,
  TrendingUp,
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
  Info,
  Archive,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  FileSpreadsheet,
  Check,
} from "lucide-react";

export interface PackingUtility {
  id: string;
  name: string;
  code: string;
  category: string;
  unit: string;
  currentStock: number;
  minStockAlert: number;
  unitCost: number;
  supplierName?: string;
  supplierPhone?: string;
  storageLocation?: string;
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface PackingUtilityLog {
  id: string;
  utilityId: string;
  utilityName: string;
  actionType: "inward" | "outward" | "adjustment";
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  referenceNo?: string;
  createdAt?: any;
}

const CATEGORIES = [
  "Sweet Boxes",
  "Plastic Containers & Tubs",
  "Carry Bags & Pouches",
  "Wrapping & Papers",
  "Tapes & Ribbons",
  "Trays & Inserts",
  "Disposables & Cutlery",
  "Other Utilities",
];

const UNITS = ["pcs", "rolls", "kg", "packets", "boxes", "bundles", "sheets"];

const INITIAL_SEED_DATA = [
  {
    name: "250g Classic Sweet Box",
    code: "BOX-250G",
    category: "Sweet Boxes",
    unit: "pcs",
    currentStock: 1200,
    minStockAlert: 300,
    unitCost: 4.5,
    storageLocation: "Rack A1 - Packaging Store",
    supplierName: "Chirala Box Printers",
    notes: "Food-grade 300 GSM board with Ravi Sweets logo",
  },
  {
    name: "500g Regular Sweet Box",
    code: "BOX-500G",
    category: "Sweet Boxes",
    unit: "pcs",
    currentStock: 1850,
    minStockAlert: 500,
    unitCost: 6.2,
    storageLocation: "Rack A2 - Packaging Store",
    supplierName: "Chirala Box Printers",
    notes: "Standard 500g rectangular boxes with gold lamination",
  },
  {
    name: "1kg Premium Sweet Box",
    code: "BOX-1KG",
    category: "Sweet Boxes",
    unit: "pcs",
    currentStock: 950,
    minStockAlert: 250,
    unitCost: 9.8,
    storageLocation: "Rack A3 - Packaging Store",
    supplierName: "Chirala Box Printers",
    notes: "Heavy-duty 1kg sweets box with internal moisture barrier",
  },
  {
    name: "2kg Festival / Bulk Sweet Box",
    code: "BOX-2KG",
    category: "Sweet Boxes",
    unit: "pcs",
    currentStock: 140,
    minStockAlert: 150,
    unitCost: 16.5,
    storageLocation: "Rack A4 - Packaging Store",
    supplierName: "Vijayawada Box Works",
    notes: "Double-walled corrugated luxury sweet box",
  },
  {
    name: "500ml Rasagulla / Bengali Sweet Tub",
    code: "CONT-500ML",
    category: "Plastic Containers & Tubs",
    unit: "pcs",
    currentStock: 420,
    minStockAlert: 200,
    unitCost: 5.8,
    storageLocation: "Rack B1 - Cool Store",
    supplierName: "Krishna Plastics",
    notes: "Leakproof transparent round container with airtight snap lid",
  },
  {
    name: "1000ml Sweet Tub with Lid",
    code: "CONT-1LTR",
    category: "Plastic Containers & Tubs",
    unit: "pcs",
    currentStock: 310,
    minStockAlert: 150,
    unitCost: 8.5,
    storageLocation: "Rack B2 - Cool Store",
    supplierName: "Krishna Plastics",
    notes: "Heavy plastic tub for Kala Jam, Rasamalai & Syrups",
  },
  {
    name: "Medium Printed Carry Bag",
    code: "BAG-MED",
    category: "Carry Bags & Pouches",
    unit: "pcs",
    currentStock: 2500,
    minStockAlert: 600,
    unitCost: 2.2,
    storageLocation: "Rack C1 - Bags Store",
    supplierName: "Sri Balaji Polythene",
    notes: "Holds up to 2kg sweet boxes, Ravi Sweets branding",
  },
  {
    name: "Large Printed Carry Bag",
    code: "BAG-LRG",
    category: "Carry Bags & Pouches",
    unit: "pcs",
    currentStock: 1400,
    minStockAlert: 400,
    unitCost: 3.5,
    storageLocation: "Rack C2 - Bags Store",
    supplierName: "Sri Balaji Polythene",
    notes: "Heavy gusseted bags for festival orders and catering",
  },
  {
    name: "Food Grade Butter Paper (Roll)",
    code: "PAPER-BTR",
    category: "Wrapping & Papers",
    unit: "rolls",
    currentStock: 18,
    minStockAlert: 10,
    unitCost: 140.0,
    storageLocation: "Packaging Shelf 3",
    supplierName: "Sun Paper Mills",
    notes: "40 GSM grease-resistant pure vegetable parchment paper",
  },
  {
    name: "Ravi Sweets Custom Sealing Tape",
    code: "TAPE-RS",
    category: "Tapes & Ribbons",
    unit: "rolls",
    currentStock: 35,
    minStockAlert: 15,
    unitCost: 55.0,
    storageLocation: "Packaging Shelf 2",
    supplierName: "Adhesive Products Ltd",
    notes: "2-inch printed BOPP security seal tape with store contacts",
  },
  {
    name: "Red Satin Decorative Ribbon (25m)",
    code: "RIBBON-RED",
    category: "Tapes & Ribbons",
    unit: "rolls",
    currentStock: 22,
    minStockAlert: 8,
    unitCost: 45.0,
    storageLocation: "Packaging Shelf 1",
    supplierName: "Gift Magic Enterprises",
    notes: "12mm glossy red gift ribbon for party & wedding boxes",
  },
  {
    name: "Kaju Bite 16-Cavity Blister Tray",
    code: "TRAY-16C",
    category: "Trays & Inserts",
    unit: "pcs",
    currentStock: 650,
    minStockAlert: 200,
    unitCost: 3.2,
    storageLocation: "Rack D1",
    supplierName: "Thermoform Packers",
    notes: "Golden blister separator for dry fruit bites & roll slices",
  },
];

export default function PackingUtilitiesPage() {
  const { showToast } = useToast();

  // Data State
  const [utilities, setUtilities] = useState<PackingUtility[]>([]);
  const [logs, setLogs] = useState<PackingUtilityLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "in_stock" | "out_of_stock">("all");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Modals
  const [isAddEditOpen, setIsAddEditOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<PackingUtility | null>(null);
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState<boolean>(false);
  const [adjustingItem, setAdjustingItem] = useState<PackingUtility | null>(null);
  const [isLogsDrawerOpen, setIsLogsDrawerOpen] = useState<boolean>(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<PackingUtility | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State for Add / Edit
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    category: "Sweet Boxes",
    unit: "pcs",
    currentStock: 0,
    minStockAlert: 100,
    unitCost: 0,
    supplierName: "",
    supplierPhone: "",
    storageLocation: "",
    notes: "",
  });

  // Form State for Stock Adjustment / Inward
  const [adjData, setAdjData] = useState({
    actionType: "inward" as "inward" | "outward" | "adjustment",
    quantity: 100,
    reason: "",
    referenceNo: "",
  });

  // 1. Real-time Subscription to Packing Utilities
  useEffect(() => {
    setIsLoading(true);
    const qUtilities = query(collection(db, "packing_utilities"), orderBy("name", "asc"));
    const unsubUtilities = onSnapshot(
      qUtilities,
      (snap) => {
        const list: PackingUtility[] = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || "",
          code: d.data().code || "",
          category: d.data().category || "Other Utilities",
          unit: d.data().unit || "pcs",
          currentStock: Number(d.data().currentStock) || 0,
          minStockAlert: Number(d.data().minStockAlert) || 0,
          unitCost: Number(d.data().unitCost) || 0,
          supplierName: d.data().supplierName || "",
          supplierPhone: d.data().supplierPhone || "",
          storageLocation: d.data().storageLocation || "",
          notes: d.data().notes || "",
          createdAt: d.data().createdAt,
          updatedAt: d.data().updatedAt,
        }));
        setUtilities(list);
        setIsLoading(false);
      },
      (err) => {
        console.error("Packing utilities listener error:", err);
        showToast("Error loading packing utilities: " + err.message, "error");
        setIsLoading(false);
      }
    );

    // Logs listener (last 50 logs)
    const qLogs = query(collection(db, "packing_utility_logs"), orderBy("createdAt", "desc"));
    const unsubLogs = onSnapshot(
      qLogs,
      (snap) => {
        const logList: PackingUtilityLog[] = snap.docs.slice(0, 50).map((d) => ({
          id: d.id,
          utilityId: d.data().utilityId || "",
          utilityName: d.data().utilityName || "",
          actionType: d.data().actionType || "adjustment",
          quantity: Number(d.data().quantity) || 0,
          previousStock: Number(d.data().previousStock) || 0,
          newStock: Number(d.data().newStock) || 0,
          reason: d.data().reason || "",
          referenceNo: d.data().referenceNo || "",
          createdAt: d.data().createdAt,
        }));
        setLogs(logList);
      },
      (err) => {
        console.warn("Logs listener error:", err);
      }
    );

    return () => {
      unsubUtilities();
      unsubLogs();
    };
  }, []);

  // Filtered Utilities
  const filteredUtilities = useMemo(() => {
    return utilities.filter((u) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = u.name.toLowerCase().includes(q);
        const matchesCode = u.code.toLowerCase().includes(q);
        const matchesSupplier = u.supplierName?.toLowerCase().includes(q);
        const matchesLocation = u.storageLocation?.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesSupplier && !matchesLocation) {
          return false;
        }
      }

      // Category
      if (selectedCategory !== "all" && u.category !== selectedCategory) {
        return false;
      }

      // Stock Status
      if (stockFilter === "low" && u.currentStock > u.minStockAlert) return false;
      if (stockFilter === "in_stock" && u.currentStock <= 0) return false;
      if (stockFilter === "out_of_stock" && u.currentStock > 0) return false;

      return true;
    });
  }, [utilities, searchQuery, selectedCategory, stockFilter]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalItems = utilities.length;
    const lowStockItems = utilities.filter((u) => u.currentStock <= u.minStockAlert).length;
    const totalStockQty = utilities.reduce((sum, u) => sum + u.currentStock, 0);
    const totalInventoryValue = utilities.reduce((sum, u) => sum + u.currentStock * u.unitCost, 0);

    return {
      totalItems,
      lowStockItems,
      totalStockQty,
      totalInventoryValue,
    };
  }, [utilities]);

  // Seed sample utilities if collection is empty
  const handleSeedData = async () => {
    if (utilities.length > 0) {
      if (!confirm("Your utilities list is not empty. Do you still want to insert the standard sweet packaging items?")) {
        return;
      }
    }
    setIsSeeding(true);
    try {
      const batch = writeBatch(db);
      for (const item of INITIAL_SEED_DATA) {
        const newRef = doc(collection(db, "packing_utilities"));
        batch.set(newRef, {
          ...item,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      showToast("Standard sweet shop packing utilities added successfully!", "success");
    } catch (err: any) {
      console.error("Seed error:", err);
      showToast("Failed to seed utilities: " + err.message, "error");
    } finally {
      setIsSeeding(false);
    }
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      code: `PKG-${Math.floor(1000 + Math.random() * 9000)}`,
      category: "Sweet Boxes",
      unit: "pcs",
      currentStock: 0,
      minStockAlert: 100,
      unitCost: 0,
      supplierName: "",
      supplierPhone: "",
      storageLocation: "",
      notes: "",
    });
    setIsAddEditOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: PackingUtility) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      code: item.code || "",
      category: item.category || "Sweet Boxes",
      unit: item.unit || "pcs",
      currentStock: item.currentStock || 0,
      minStockAlert: item.minStockAlert || 100,
      unitCost: item.unitCost || 0,
      supplierName: item.supplierName || "",
      supplierPhone: item.supplierPhone || "",
      storageLocation: item.storageLocation || "",
      notes: item.notes || "",
    });
    setIsAddEditOpen(true);
  };

  // Save Utility Item
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast("Please enter utility item name", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        category: formData.category,
        unit: formData.unit,
        currentStock: Number(formData.currentStock) || 0,
        minStockAlert: Number(formData.minStockAlert) || 0,
        unitCost: Number(formData.unitCost) || 0,
        supplierName: formData.supplierName.trim(),
        supplierPhone: formData.supplierPhone.trim(),
        storageLocation: formData.storageLocation.trim(),
        notes: formData.notes.trim(),
        updatedAt: serverTimestamp(),
      };

      if (editingItem) {
        await updateDoc(doc(db, "packing_utilities", editingItem.id), payload);
        showToast("Utility item updated successfully", "success");
      } else {
        await addDoc(collection(db, "packing_utilities"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        showToast("New utility item created successfully", "success");
      }

      setIsAddEditOpen(false);
      setEditingItem(null);
    } catch (err: any) {
      console.error("Save error:", err);
      showToast("Failed to save utility item: " + err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Utility Item
  const handleDeleteItem = async () => {
    if (!deleteConfirmItem) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "packing_utilities", deleteConfirmItem.id));
      showToast("Packing utility deleted successfully", "success");
      setDeleteConfirmItem(null);
    } catch (err: any) {
      console.error("Delete error:", err);
      showToast("Failed to delete utility: " + err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Stock Adjustment Modal
  const handleOpenAdjustment = (item: PackingUtility, defaultType: "inward" | "outward" | "adjustment" = "inward") => {
    setAdjustingItem(item);
    setAdjData({
      actionType: defaultType,
      quantity: defaultType === "inward" ? 500 : 50,
      reason: defaultType === "inward" ? "Fresh stock arrived from supplier" : "Dispensed to packing counter",
      referenceNo: "",
    });
    setIsAdjustmentOpen(true);
  };

  // Submit Stock Adjustment / Inward
  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;

    const qty = Number(adjData.quantity);
    if (isNaN(qty) || qty <= 0) {
      showToast("Please enter a valid quantity greater than 0", "error");
      return;
    }

    const prevStock = adjustingItem.currentStock;
    let newStock = prevStock;

    if (adjData.actionType === "inward") {
      newStock = prevStock + qty;
    } else if (adjData.actionType === "outward") {
      newStock = Math.max(0, prevStock - qty);
    } else {
      // Direct adjustment / physical audit
      newStock = qty;
    }

    setIsSubmitting(true);
    try {
      // 1. Update utility document
      await updateDoc(doc(db, "packing_utilities", adjustingItem.id), {
        currentStock: newStock,
        updatedAt: serverTimestamp(),
      });

      // 2. Add log entry
      await addDoc(collection(db, "packing_utility_logs"), {
        utilityId: adjustingItem.id,
        utilityName: adjustingItem.name,
        actionType: adjData.actionType,
        quantity: qty,
        previousStock: prevStock,
        newStock: newStock,
        reason: adjData.reason.trim(),
        referenceNo: adjData.referenceNo.trim(),
        createdAt: serverTimestamp(),
      });

      showToast(
        adjData.actionType === "inward"
          ? `+${qty} ${adjustingItem.unit} added to ${adjustingItem.name} stock`
          : `Stock updated for ${adjustingItem.name} (Now: ${newStock} ${adjustingItem.unit})`,
        "success"
      );

      setIsAdjustmentOpen(false);
      setAdjustingItem(null);
    } catch (err: any) {
      console.error("Adjustment error:", err);
      showToast("Failed to update stock: " + err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Inward (+100) or Quick Outward (-10)
  const handleQuickAdjust = async (e: React.MouseEvent, item: PackingUtility, delta: number) => {
    e.stopPropagation();
    const prevStock = item.currentStock;
    const newStock = Math.max(0, prevStock + delta);

    try {
      await updateDoc(doc(db, "packing_utilities", item.id), {
        currentStock: newStock,
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "packing_utility_logs"), {
        utilityId: item.id,
        utilityName: item.name,
        actionType: delta > 0 ? "inward" : "outward",
        quantity: Math.abs(delta),
        previousStock: prevStock,
        newStock: newStock,
        reason: delta > 0 ? "Quick 1-click inward" : "Quick 1-click counter dispensing",
        createdAt: serverTimestamp(),
      });

      showToast(
        `${item.name} stock ${delta > 0 ? `+${delta}` : delta} (New: ${newStock} ${item.unit})`,
        "info"
      );
    } catch (err: any) {
      console.error("Quick adjust error:", err);
      showToast("Quick adjustment failed: " + err.message, "error");
    }
  };

  // Export to CSV / Excel
  const handleExportCSV = () => {
    if (filteredUtilities.length === 0) {
      showToast("No items to export", "info");
      return;
    }

    const headers = [
      "Item Code",
      "Item Name",
      "Category",
      "Unit",
      "Current Stock",
      "Min Stock Alert",
      "Unit Cost (INR)",
      "Stock Value (INR)",
      "Status",
      "Supplier",
      "Supplier Phone",
      "Storage Location",
      "Notes",
    ];

    const rows = filteredUtilities.map((u) => [
      `"${u.code || ""}"`,
      `"${u.name.replace(/"/g, '""')}"`,
      `"${u.category}"`,
      `"${u.unit}"`,
      u.currentStock,
      u.minStockAlert,
      u.unitCost.toFixed(2),
      (u.currentStock * u.unitCost).toFixed(2),
      `"${u.currentStock <= u.minStockAlert ? "LOW STOCK" : "NORMAL"}"`,
      `"${(u.supplierName || "").replace(/"/g, '""')}"`,
      `"${u.supplierPhone || ""}"`,
      `"${(u.storageLocation || "").replace(/"/g, '""')}"`,
      `"${(u.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Ravi_Sweets_Packing_Utilities_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("Packing Utilities CSV downloaded", "success");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 pb-16">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#348bdd]/10 border border-[#348bdd]/20 flex items-center justify-center text-[#348bdd] shrink-0">
              <Boxes size={22} className="stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">Packing Utilities</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wider bg-[#348bdd]/10 text-[#348bdd] border border-[#348bdd]/20 uppercase">
                  Materials & Boxes
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Track sweet boxes, carry bags, containers, butter papers, and packaging thresholds
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            {/* View Activity Logs */}
            <button
              type="button"
              onClick={() => setIsLogsDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors"
            >
              <History size={14} className="text-slate-500" />
              <span>Stock Logs ({logs.length})</span>
            </button>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors"
            >
              <Download size={14} className="text-slate-500" />
              <span>Export CSV</span>
            </button>

            {/* Seed Standard Items (visible if few items) */}
            {utilities.length < 5 && (
              <button
                type="button"
                onClick={handleSeedData}
                disabled={isSeeding}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold shadow-2xs transition-colors"
              >
                {isSeeding ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-amber-600" />}
                <span>Seed Standard Packaging</span>
              </button>
            )}

            {/* Add New Utility Button */}
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#348bdd] hover:bg-[#2b77bf] text-white text-xs font-semibold shadow-xs transition-all active:scale-[0.98]"
            >
              <Plus size={15} className="stroke-[2.5]" />
              <span>Add Utility Item</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 flex-1 w-full space-y-6">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Items */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Total Packaging Items</p>
              <p className="text-2xl font-bold font-mono text-slate-900 mt-1">{metrics.totalItems}</p>
              <span className="text-[11px] text-slate-400">across {CATEGORIES.length} categories</span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#348bdd] flex items-center justify-center">
              <Boxes size={20} />
            </div>
          </div>

          {/* Card 2: Low Stock Alert */}
          <div
            className={`p-4 rounded-xl border shadow-2xs flex items-center justify-between ${
              metrics.lowStockItems > 0
                ? "border-amber-200 bg-amber-50/40 text-amber-900"
                : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <div>
              <p className="text-xs font-medium text-slate-500">Low Stock Alerts</p>
              <p
                className={`text-2xl font-bold font-mono mt-1 ${
                  metrics.lowStockItems > 0 ? "text-amber-600" : "text-emerald-600"
                }`}
              >
                {metrics.lowStockItems}
              </p>
              <span className="text-[11px] text-slate-400">
                {metrics.lowStockItems > 0 ? "requires reorder from vendor" : "all items well stocked"}
              </span>
            </div>
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                metrics.lowStockItems > 0 ? "bg-amber-100 text-amber-600" : "bg-emerald-50 text-emerald-600"
              }`}
            >
              {metrics.lowStockItems > 0 ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
            </div>
          </div>

          {/* Card 3: Total Stock Units */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Total Stock Quantity</p>
              <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {metrics.totalStockQty.toLocaleString()}
              </p>
              <span className="text-[11px] text-slate-400">boxes, bags & units in store</span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Package size={20} />
            </div>
          </div>

          {/* Card 4: Estimated Valuation */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Packaging Valuation</p>
              <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                ₹{Math.round(metrics.totalInventoryValue).toLocaleString()}
              </p>
              <span className="text-[11px] text-slate-400">estimated replacement cost</span>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Archive size={20} />
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="text"
                placeholder="Search packaging by name, code (e.g. BOX-500G), supplier, rack..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#348bdd] focus:ring-1 focus:ring-[#348bdd]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Stock Status Filter Buttons */}
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-100 border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setStockFilter("all")}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  stockFilter === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All ({utilities.length})
              </button>
              <button
                type="button"
                onClick={() => setStockFilter("low")}
                className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                  stockFilter === "low"
                    ? "bg-amber-500 text-white shadow-xs font-semibold"
                    : "text-amber-700 hover:text-amber-900"
                }`}
              >
                <span>Low Stock</span>
                {metrics.lowStockItems > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      stockFilter === "low" ? "bg-white text-amber-700" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {metrics.lowStockItems}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setStockFilter("in_stock")}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  stockFilter === "in_stock"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                In Stock
              </button>
              <button
                type="button"
                onClick={() => setStockFilter("out_of_stock")}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  stockFilter === "out_of_stock"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Out of Stock
              </button>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === "table" ? "bg-white text-[#348bdd] shadow-2xs font-semibold" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Table View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === "cards" ? "bg-white text-[#348bdd] shadow-2xs font-semibold" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Card Grid
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-none border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === "all"
                  ? "bg-[#348bdd] text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Categories
            </button>
            {CATEGORIES.map((cat) => {
              const count = utilities.filter((u) => u.category === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    selectedCategory === cat
                      ? "bg-[#348bdd] text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <span>{cat}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      selectedCategory === cat ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Listing (Table / Cards) */}
        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400 bg-white rounded-xl border border-slate-200">
            <Loader2 size={32} className="animate-spin text-[#348bdd]" />
            <p className="text-xs font-medium">Loading packing utilities...</p>
          </div>
        ) : filteredUtilities.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#348bdd] flex items-center justify-center mx-auto mb-3">
              <Boxes size={28} />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No packing utilities found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              {searchQuery || selectedCategory !== "all" || stockFilter !== "all"
                ? "No items match your active filters. Try adjusting your search query or category."
                : "Get started by adding your sweet boxes, carry bags, butter paper rolls, and packaging materials."}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              {utilities.length === 0 && (
                <button
                  type="button"
                  onClick={handleSeedData}
                  disabled={isSeeding}
                  className="px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100"
                >
                  Seed Standard Packaging
                </button>
              )}
              <button
                type="button"
                onClick={handleOpenAdd}
                className="px-3.5 py-1.5 rounded-lg bg-[#348bdd] text-white text-xs font-semibold hover:bg-[#2b77bf]"
              >
                + Add First Utility
              </button>
            </div>
          </div>
        ) : viewMode === "table" ? (
          /* Table View */
          <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Utility Item & Category</th>
                    <th className="py-3 px-4 text-center">Unit</th>
                    <th className="py-3 px-4 text-right">Current Stock</th>
                    <th className="py-3 px-4 text-right">Min Alert</th>
                    <th className="py-3 px-4 text-right">Unit Cost</th>
                    <th className="py-3 px-4 text-right">Total Value</th>
                    <th className="py-3 px-4">Location / Supplier</th>
                    <th className="py-3 px-4 text-center">Quick Adjust</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                  {filteredUtilities.map((u) => {
                    const isLow = u.currentStock <= u.minStockAlert;
                    const isOut = u.currentStock <= 0;
                    return (
                      <tr
                        key={u.id}
                        className={`hover:bg-slate-50/70 transition-colors ${
                          isOut ? "bg-rose-50/20" : isLow ? "bg-amber-50/20" : ""
                        }`}
                      >
                        {/* Code */}
                        <td className="py-3 px-4 font-mono font-medium text-slate-500 whitespace-nowrap">
                          {u.code || "—"}
                        </td>

                        {/* Name & Category */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 line-clamp-1">{u.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-slate-400">{u.category}</span>
                            {u.notes && (
                              <span
                                title={u.notes}
                                className="text-[10px] text-blue-500 underline cursor-help"
                              >
                                info
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Unit */}
                        <td className="py-3 px-4 text-center font-mono text-slate-500 whitespace-nowrap uppercase text-[11px]">
                          {u.unit}
                        </td>

                        {/* Current Stock */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <span
                              className={`font-mono font-bold text-sm ${
                                isOut
                                  ? "text-rose-600"
                                  : isLow
                                  ? "text-amber-600"
                                  : "text-slate-900"
                              }`}
                            >
                              {u.currentStock.toLocaleString()}
                            </span>
                            {isLow && (
                              <span
                                title={isOut ? "Out of Stock!" : `Below threshold (${u.minStockAlert})`}
                                className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                  isOut
                                    ? "bg-rose-100 text-rose-700"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {isOut ? "EMPTY" : "LOW"}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Min Alert */}
                        <td className="py-3 px-4 text-right font-mono text-slate-400 whitespace-nowrap">
                          {u.minStockAlert.toLocaleString()}
                        </td>

                        {/* Unit Cost */}
                        <td className="py-3 px-4 text-right font-mono text-slate-600 whitespace-nowrap">
                          ₹{u.unitCost.toFixed(2)}
                        </td>

                        {/* Total Value */}
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                          ₹{Math.round(u.currentStock * u.unitCost).toLocaleString()}
                        </td>

                        {/* Location / Supplier */}
                        <td className="py-3 px-4 text-[11px]">
                          <div className="text-slate-800 font-medium truncate max-w-[160px]">
                            {u.storageLocation || "—"}
                          </div>
                          <div className="text-slate-400 truncate max-w-[160px]">
                            {u.supplierName || "No supplier logged"}
                          </div>
                        </td>

                        {/* Quick Adjust Buttons */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => handleQuickAdjust(e, u, -10)}
                              title="Dispense 10 units"
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 font-mono text-xs font-bold transition-colors"
                            >
                              -10
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleQuickAdjust(e, u, 100)}
                              title="Receive 100 units"
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 text-slate-600 font-mono text-xs font-bold transition-colors"
                            >
                              +100
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenAdjustment(u, "inward")}
                              title="Open custom stock inward / adjustment"
                              className="p-1 rounded bg-blue-50 text-[#348bdd] hover:bg-blue-100 transition-colors"
                            >
                              <SlidersHorizontal size={13} />
                            </button>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(u)}
                              title="Edit Item"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-[#348bdd] hover:border-[#348bdd] hover:bg-blue-50/30 transition-colors"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmItem(u)}
                              title="Delete Item"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50/50 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="p-3 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
              <span>Showing {filteredUtilities.length} of {utilities.length} packaging items</span>
              <div className="flex items-center gap-4 font-mono">
                <span>Total Units: <strong>{filteredUtilities.reduce((acc, i) => acc + i.currentStock, 0).toLocaleString()}</strong></span>
                <span>Valuation: <strong>₹{Math.round(filteredUtilities.reduce((acc, i) => acc + i.currentStock * i.unitCost, 0)).toLocaleString()}</strong></span>
              </div>
            </div>
          </div>
        ) : (
          /* Card Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredUtilities.map((u) => {
              const isLow = u.currentStock <= u.minStockAlert;
              const isOut = u.currentStock <= 0;
              return (
                <div
                  key={u.id}
                  className={`p-4 rounded-xl border bg-white shadow-2xs hover:shadow-md transition-all flex flex-col justify-between ${
                    isOut
                      ? "border-rose-300 ring-1 ring-rose-100"
                      : isLow
                      ? "border-amber-300 ring-1 ring-amber-100"
                      : "border-slate-200"
                  }`}
                >
                  <div>
                    {/* Header: Code & Status */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-md">
                        {u.code || "PKG"}
                      </span>
                      {isLow && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            isOut
                              ? "bg-rose-100 text-rose-700 border border-rose-200"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {isOut ? "OUT OF STOCK" : "LOW STOCK"}
                        </span>
                      )}
                    </div>

                    {/* Name */}
                    <h3 className="font-bold text-slate-900 text-sm line-clamp-1">{u.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{u.category}</p>

                    {/* Stock Metrics */}
                    <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase">Available Stock</span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span
                            className={`text-xl font-bold font-mono ${
                              isOut ? "text-rose-600" : isLow ? "text-amber-600" : "text-slate-900"
                            }`}
                          >
                            {u.currentStock.toLocaleString()}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">/{u.unit}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase">Threshold</span>
                        <p className="text-xs font-bold font-mono text-slate-600 mt-0.5">
                          {u.minStockAlert.toLocaleString()} {u.unit}
                        </p>
                      </div>
                    </div>

                    {/* Additional Metadata */}
                    <div className="mt-3 space-y-1 text-xs text-slate-500 border-t border-slate-100 pt-2">
                      <div className="flex items-center justify-between">
                        <span>Unit Cost:</span>
                        <span className="font-mono font-semibold text-slate-800">₹{u.unitCost.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Stock Valuation:</span>
                        <span className="font-mono font-semibold text-slate-900">
                          ₹{Math.round(u.currentStock * u.unitCost).toLocaleString()}
                        </span>
                      </div>
                      {u.storageLocation && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span>Rack:</span>
                          <span className="text-slate-700 font-medium truncate max-w-[140px]">
                            {u.storageLocation}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenAdjustment(u, "inward")}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-[#348bdd]/10 hover:bg-[#348bdd]/20 text-[#348bdd] text-xs font-semibold text-center transition-colors"
                    >
                      + Receive Stock
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(u)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-[#348bdd] transition-colors"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmItem(u)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* MODAL 1: Add / Edit Utility Item */}
      {isAddEditOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#348bdd]/10 text-[#348bdd] flex items-center justify-center">
                  <Boxes size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingItem ? "Edit Packaging Utility" : "Add Packaging Utility"}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Define boxes, bags, containers, wrapping paper, or seals
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddEditOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Item Name */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Item Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 500g Premium Sweet Box, Butter Paper Roll"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-[#348bdd] focus:ring-1 focus:ring-[#348bdd]"
                />
              </div>

              {/* Code & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Item Code / SKU</label>
                  <input
                    type="text"
                    placeholder="e.g. BOX-500G"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs uppercase font-mono focus:outline-hidden focus:border-[#348bdd] focus:ring-1 focus:ring-[#348bdd]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-[#348bdd] focus:ring-1 focus:ring-[#348bdd]"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Unit & Unit Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unit of Measure</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-[#348bdd] focus:ring-1 focus:ring-[#348bdd]"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unit Purchase Cost (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.unitCost}
                    onChange={(e) => setFormData({ ...formData, unitCost: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono focus:outline-hidden focus:border-[#348bdd] focus:ring-1 focus:ring-[#348bdd]"
                  />
                </div>
              </div>

              {/* Stock On Hand & Alert Threshold */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Current Stock On-Hand</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData.currentStock}
                    onChange={(e) => setFormData({ ...formData, currentStock: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold focus:outline-hidden focus:border-[#348bdd] focus:ring-1 focus:ring-[#348bdd] bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Min Stock Alert Threshold
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="100"
                    value={formData.minStockAlert}
                    onChange={(e) => setFormData({ ...formData, minStockAlert: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono focus:outline-hidden focus:border-[#348bdd] focus:ring-1 focus:ring-[#348bdd] bg-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Triggers low stock warnings</p>
                </div>
              </div>

              {/* Storage Rack / Location & Supplier */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Storage Rack / Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Rack A1, Store Room Shelf 2"
                    value={formData.storageLocation}
                    onChange={(e) => setFormData({ ...formData, storageLocation: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-[#348bdd] focus:ring-1 focus:ring-[#348bdd]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Supplier / Vendor Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Chirala Box Works"
                    value={formData.supplierName}
                    onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-[#348bdd] focus:ring-1 focus:ring-[#348bdd]"
                  />
                </div>
              </div>

              {/* Notes & Specifications */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes / Specifications</label>
                <textarea
                  rows={2}
                  placeholder="e.g. 350 GSM food-grade virgin kraft board with gold foil stamping..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-[#348bdd] focus:ring-1 focus:ring-[#348bdd]"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddEditOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-[#348bdd] hover:bg-[#2b77bf] text-white font-semibold flex items-center gap-2 shadow-xs transition-colors"
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  <span>{editingItem ? "Update Utility" : "Save Utility"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Stock Inward / Adjustment Log */}
      {isAdjustmentOpen && adjustingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <PackageCheck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Stock Inward & Adjustment</h3>
                  <p className="text-[11px] text-slate-500 font-medium">{adjustingItem.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjustmentOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitAdjustment} className="p-5 space-y-4 text-xs">
              {/* Current Status banner */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Current Stock:</span>
                <span className="font-mono font-bold text-sm text-slate-900">
                  {adjustingItem.currentStock.toLocaleString()} {adjustingItem.unit}
                </span>
              </div>

              {/* Action Type */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Action Type</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjData({ ...adjData, actionType: "inward" })}
                    className={`py-2 px-2 rounded-lg font-semibold border text-center transition-all flex flex-col items-center gap-1 ${
                      adjData.actionType === "inward"
                        ? "bg-emerald-50 border-emerald-400 text-emerald-800"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <ArrowDownRight size={16} className="text-emerald-600" />
                    <span>Inward (+)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjData({ ...adjData, actionType: "outward" })}
                    className={`py-2 px-2 rounded-lg font-semibold border text-center transition-all flex flex-col items-center gap-1 ${
                      adjData.actionType === "outward"
                        ? "bg-rose-50 border-rose-400 text-rose-800"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <ArrowUpRight size={16} className="text-rose-600" />
                    <span>Usage (-)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjData({ ...adjData, actionType: "adjustment" })}
                    className={`py-2 px-2 rounded-lg font-semibold border text-center transition-all flex flex-col items-center gap-1 ${
                      adjData.actionType === "adjustment"
                        ? "bg-blue-50 border-blue-400 text-blue-800"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <SlidersHorizontal size={16} className="text-[#348bdd]" />
                    <span>Audit (=)</span>
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {adjData.actionType === "adjustment"
                    ? "New Exact Physical Stock Quantity"
                    : "Quantity to " + (adjData.actionType === "inward" ? "Add (+)" : "Deduct (-)")}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    required
                    value={adjData.quantity}
                    onChange={(e) => setAdjData({ ...adjData, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono font-bold focus:outline-hidden focus:border-[#348bdd] focus:ring-1 focus:ring-[#348bdd]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-400">
                    {adjustingItem.unit}
                  </span>
                </div>
              </div>

              {/* Calculated Result Preview */}
              <div className="p-3 rounded-lg border border-dashed border-[#348bdd]/30 bg-blue-50/30 flex items-center justify-between text-xs">
                <span className="text-slate-600">Calculated New Stock:</span>
                <span className="font-mono font-bold text-slate-900">
                  {adjData.actionType === "inward"
                    ? (adjustingItem.currentStock + Number(adjData.quantity)).toLocaleString()
                    : adjData.actionType === "outward"
                    ? Math.max(0, adjustingItem.currentStock - Number(adjData.quantity)).toLocaleString()
                    : Number(adjData.quantity).toLocaleString()}{" "}
                  {adjustingItem.unit}
                </span>
              </div>

              {/* Reason / Note */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Received from vendor, Bulk festival dispatch, damaged"
                  value={adjData.reason}
                  onChange={(e) => setAdjData({ ...adjData, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-[#348bdd] focus:ring-1 focus:ring-[#348bdd]"
                />
              </div>

              {/* Reference / Invoice # */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Invoice / DC Reference No.</label>
                <input
                  type="text"
                  placeholder="e.g. INV-8821, DC-442"
                  value={adjData.referenceNo}
                  onChange={(e) => setAdjData({ ...adjData, referenceNo: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono uppercase focus:outline-hidden focus:border-[#348bdd] focus:ring-1 focus:ring-[#348bdd]"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustmentOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-[#348bdd] hover:bg-[#2b77bf] text-white font-semibold flex items-center gap-2 shadow-xs transition-colors"
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  <span>Save Stock Change</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER: Activity Logs */}
      {isLogsDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <History size={18} className="text-[#348bdd]" />
                <h3 className="font-bold text-sm text-slate-900">Packaging Stock Audit Logs</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLogsDrawerOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {logs.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-xs">
                  <History size={24} className="text-slate-300 mb-2" />
                  <span>No stock logs recorded yet</span>
                </div>
              ) : (
                logs.map((log) => {
                  const isInward = log.actionType === "inward";
                  const isOutward = log.actionType === "outward";
                  return (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{log.utilityName}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider font-mono ${
                            isInward
                              ? "bg-emerald-100 text-emerald-800"
                              : isOutward
                              ? "bg-rose-100 text-rose-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {isInward ? `+${log.quantity} INWARD` : isOutward ? `-${log.quantity} USED` : `SET TO ${log.newStock}`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-500 font-mono text-[11px]">
                        <span>Previous: {log.previousStock}</span>
                        <span>→</span>
                        <span>New: {log.newStock}</span>
                      </div>

                      {(log.reason || log.referenceNo) && (
                        <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-md">
                          {log.reason && <div>{log.reason}</div>}
                          {log.referenceNo && (
                            <div className="font-mono text-slate-400 text-[10px] mt-0.5">
                              Ref: {log.referenceNo}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-slate-200 p-5 space-y-4">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 size={20} />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-sm text-slate-900">Delete Utility Item?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete <strong>{deleteConfirmItem.name}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="flex-1 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                disabled={isSubmitting}
                className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-semibold text-white shadow-xs"
              >
                {isSubmitting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
