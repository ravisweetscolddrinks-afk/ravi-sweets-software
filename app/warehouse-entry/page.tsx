"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import ConfirmationModal from "@/components/ConfirmationModal";
import CustomDatePicker from "@/components/CustomDatePicker";
import CameraModal from "@/components/CameraModal";
import { compressImageToMax60KB, uploadToImageKit } from "@/lib/imageCompression";
import {
  WarehouseEntry,
  WarehouseEntryItem,
  DateFilterType,
  getTodayDateStr,
  isDateMatchingFilter,
} from "@/types/warehouse";
import {
  Warehouse,
  Plus,
  Minus,
  Search,
  Calendar,
  Camera,
  Upload,
  Image as ImageIcon,
  Trash2,
  Eye,
  X,
  Check,
  RotateCw,
  Clock,
  Layers,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  PackageCheck,
  Boxes,
  Maximize2,
  FileText,
  AlertTriangle,
  Info,
  FolderTree,
} from "lucide-react";

interface RawMaterialItem {
  id: string;
  name: string;
  stock: number;
  unit: string;
  amount: number;
  bufferStock: number;
  category?: string;
  imageUrl?: string;
}

interface CatalogProduct {
  id: string;
  name: string;
  imageUrl: string;
  categoryName: string;
  unit: string;
  amount: number;
}

interface LocalPhotoItem {
  blob: Blob;
  sizeKB: number;
  previewUrl: string;
}

const PAGE_SIZE = 24;

export default function WarehouseEntryPage() {
  const { showToast } = useToast();

  // 1. Data states
  const [entries, setEntries] = useState<WarehouseEntry[]>([]);
  const [rawItems, setRawItems] = useState<RawMaterialItem[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState<boolean>(true);
  const [isLoadingItems, setIsLoadingItems] = useState<boolean>(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);

  // 2. Filters & Search (Default date filter is "today" as requested)
  const [dateFilter, setDateFilter] = useState<DateFilterType>("today");
  const [customFrom, setCustomFrom] = useState<string>(getTodayDateStr());
  const [customTo, setCustomTo] = useState<string>(getTodayDateStr());
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);

  // 3. Add Entry Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [entryDate, setEntryDate] = useState<string>(getTodayDateStr());
  const [entryNotes, setEntryNotes] = useState<string>("");
  const [itemSearchTerm, setItemSearchTerm] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedItems, setSelectedItems] = useState<WarehouseEntryItem[]>([]);
  const [attachedPhotos, setAttachedPhotos] = useState<LocalPhotoItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState<string>("");

  // 4. Camera Modal State
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);

  // 5. Viewing Entry & Image Lightbox Modals
  const [viewingEntry, setViewingEntry] = useState<WarehouseEntry | null>(null);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  // 6. Delete Entry Confirmation
  const [deletingEntry, setDeletingEntry] = useState<WarehouseEntry | null>(null);
  const [restoreStockOnDelete, setRestoreStockOnDelete] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // --- Real-time Listeners ---

  // Subscribe to warehouse_entries
  useEffect(() => {
    setIsLoadingEntries(true);
    const q = query(collection(db, "warehouse_entries"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: WarehouseEntry[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setEntries(list);
        setIsLoadingEntries(false);
      },
      (err) => {
        console.error("Error loading warehouse entries:", err);
        setIsLoadingEntries(false);
      }
    );
    return () => unsub();
  }, []);

  // Subscribe to manufacturing_items (for stock deduction and item selection)
  useEffect(() => {
    setIsLoadingItems(true);
    const q = query(collection(db, "manufacturing_items"), orderBy("name", "asc"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: RawMaterialItem[] = snapshot.docs.map((d) => ({
          id: d.id,
          name: d.data().name || "Item",
          stock: Number(d.data().stock) || 0,
          unit: d.data().unit || "KG",
          amount: Number(d.data().amount) || 0,
          bufferStock: Number(d.data().bufferStock) || 0,
          category: d.data().category || "Raw Material",
          imageUrl: d.data().imageUrl || "",
        }));
        setRawItems(list);
        setIsLoadingItems(false);
      },
      (err) => {
        console.error("Error loading manufacturing items:", err);
        setIsLoadingItems(false);
      }
    );
    return () => unsub();
  }, []);

  // Subscribe to products catalog (for visual product card picker with images)
  useEffect(() => {
    setIsLoadingProducts(true);
    const q = query(collection(db, "products"), orderBy("name", "asc"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: CatalogProduct[] = snapshot.docs.map((d) => ({
          id: d.id,
          name: d.data().name || "Product",
          imageUrl: d.data().imageUrl || "/logo.png",
          categoryName: d.data().categoryName || "General",
          unit: d.data().unit || "KG",
          amount: Number(d.data().amount) || 0,
        }));
        setProducts(list);
        setIsLoadingProducts(false);
      },
      (err) => {
        console.error("Error loading products:", err);
        setIsLoadingProducts(false);
      }
    );
    return () => unsub();
  }, []);

  // Distinct manufacturing item categories for filter pills
  const productCategories = useMemo(() => {
    const set = new Set<string>();
    rawItems.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set).sort();
  }, [rawItems]);

  // Filtered Manufacturing Stock Items for Card Type UI ("image below name thats it")
  const displayedCardProducts = useMemo(() => {
    return rawItems.filter((item) => {
      if (selectedCategory !== "all" && item.category !== selectedCategory) {
        return false;
      }
      if (itemSearchTerm.trim()) {
        const q = itemSearchTerm.toLowerCase().trim();
        return (
          item.name.toLowerCase().includes(q) ||
          (item.category && item.category.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [rawItems, selectedCategory, itemSearchTerm]);

  // --- Filtering & Pagination ---

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // Date filter
      if (!isDateMatchingFilter(entry.date, dateFilter, customFrom, customTo)) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchEntryNum = entry.entryNumber?.toLowerCase().includes(q);
        const matchNotes = entry.notes?.toLowerCase().includes(q);
        const matchItems = entry.items?.some((i) => i.name.toLowerCase().includes(q));
        if (!matchEntryNum && !matchNotes && !matchItems) {
          return false;
        }
      }

      return true;
    });
  }, [entries, dateFilter, customFrom, customTo, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredEntries.slice(start, start + PAGE_SIZE);
  }, [filteredEntries, currentPage]);

  // Overall statistics for metric KPI cards
  const stats = useMemo(() => {
    const todayStr = getTodayDateStr();
    let totalQty = 0;
    let totalPhotos = 0;
    let todayCount = 0;

    filteredEntries.forEach((e) => {
      totalQty += e.totalQuantity || 0;
      totalPhotos += e.photos?.length || 0;
      if (e.date === todayStr) todayCount++;
    });

    return {
      entriesCount: filteredEntries.length,
      totalQty,
      totalPhotos,
      todayCount,
    };
  }, [filteredEntries]);

  // Filtered raw items for modal picker
  const filteredRawItems = useMemo(() => {
    if (!itemSearchTerm.trim()) return rawItems;
    const q = itemSearchTerm.toLowerCase().trim();
    return rawItems.filter(
      (item) => item.name.toLowerCase().includes(q) || item.category?.toLowerCase().includes(q)
    );
  }, [rawItems, itemSearchTerm]);

  // --- Add Entry Handlers ---

  const handleOpenAddModal = () => {
    setEntryDate(getTodayDateStr());
    setEntryNotes("");
    setItemSearchTerm("");
    setSelectedCategory("all");
    setSelectedItems([]);
    setAttachedPhotos([]);
    setUploadProgressMsg("");
    setIsAddModalOpen(true);
  };

  // Toggle manufacturing stock item selection from card UI ("image below name thats it")
  const handleToggleProductSelection = (item: RawMaterialItem) => {
    const currentStock = Number(item.stock) || 0;

    setSelectedItems((prev) => {
      const exists = prev.find((i) => i.itemId === item.id);
      if (exists) {
        return prev.filter((i) => i.itemId !== item.id);
      } else {
        return [
          ...prev,
          {
            itemId: item.id,
            name: item.name,
            imageUrl: item.imageUrl || "/logo.png",
            unit: item.unit || "KG",
            quantity: 1, // default quantity
            currentStock,
            bufferStock: item.bufferStock || 0,
            costPerUnit: item.amount || 0,
          },
        ];
      }
    });
  };

  // Toggle raw material item selection
  const handleToggleItemSelection = (item: RawMaterialItem) => {
    setSelectedItems((prev) => {
      const exists = prev.find((i) => i.itemId === item.id);
      if (exists) {
        return prev.filter((i) => i.itemId !== item.id);
      } else {
        return [
          ...prev,
          {
            itemId: item.id,
            name: item.name,
            unit: item.unit,
            imageUrl: "/logo.png",
            quantity: 1, // default quantity
            currentStock: item.stock,
            bufferStock: item.bufferStock,
            costPerUnit: item.amount,
          },
        ];
      }
    });
  };

  // Update quantity of selected item
  const handleItemQuantityChange = (itemId: string, newQty: number) => {
    setSelectedItems((prev) =>
      prev.map((item) =>
        item.itemId === itemId ? { ...item, quantity: Math.max(0.001, Number(newQty) || 0) } : item
      )
    );
  };

  // Remove single selected item
  const handleRemoveSelectedItem = (itemId: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.itemId !== itemId));
  };

  // Handle Photo captured from CameraModal
  const handleCameraCapture = (blob: Blob, sizeKB: number, previewUrl: string) => {
    setAttachedPhotos((prev) => [...prev, { blob, sizeKB, previewUrl }]);
    showToast(`Photo captured and compressed to ${sizeKB} KB (under 60KB limit)`, "success");
  };

  // Handle Photos selected from file input
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      showToast("Compressing chosen photos to strictly under 60KB...", "info");
      const compressedList: LocalPhotoItem[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const { blob, sizeKB } = await compressImageToMax60KB(file, 60 * 1024);
        const previewUrl = URL.createObjectURL(blob);
        compressedList.push({ blob, sizeKB, previewUrl });
      }

      setAttachedPhotos((prev) => [...prev, ...compressedList]);
      showToast(`Added ${compressedList.length} photo(s) compressed to under 60KB!`, "success");
    } catch (err: any) {
      console.error("Error compressing files:", err);
      showToast("Error compressing images: " + err.message, "error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Remove attached photo
  const handleRemovePhoto = (index: number) => {
    setAttachedPhotos((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Save Warehouse Entry and Deduct from Manufacturing Stock
  const handleSaveWarehouseEntry = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedItems.length === 0) {
      showToast("Please select at least one item for the warehouse entry", "error");
      return;
    }

    for (const item of selectedItems) {
      if (!item.quantity || item.quantity <= 0) {
        showToast(`Please enter a valid quantity for "${item.name}"`, "error");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const dateCompact = entryDate.replace(/-/g, "");
      const entryNumber = `WHE-${dateCompact}-${String(Math.floor(100 + Math.random() * 900))}`;

      // 1. Upload compressed images to ImageKit
      const uploadedPhotoUrls: string[] = [];
      if (attachedPhotos.length > 0) {
        for (let i = 0; i < attachedPhotos.length; i++) {
          setUploadProgressMsg(`Uploading photo ${i + 1} of ${attachedPhotos.length} to ImageKit...`);
          const photo = attachedPhotos[i];
          const url = await uploadToImageKit(photo.blob, `whe-${dateCompact}`);
          uploadedPhotoUrls.push(url);
        }
      }

      // 2. Main requirement: DEDUCT QUANTITY FROM MANUFACTURING STOCK ANALYSIS ITEMS
      setUploadProgressMsg("Deducting stock from Manufacturing Stock Analysis...");
      for (const item of selectedItems) {
        // Find matching manufacturing item by ID or by name
        let rawItemFound = rawItems.find((r) => r.id === item.itemId);
        if (!rawItemFound) {
          rawItemFound = rawItems.find(
            (r) => r.name.toLowerCase().trim() === item.name.toLowerCase().trim()
          );
        }

        if (rawItemFound) {
          const itemDocRef = doc(db, "manufacturing_items", rawItemFound.id);
          const currentStock = Number(rawItemFound.stock) || 0;
          const newStock = Math.max(0, Number((currentStock - item.quantity).toFixed(3)));

          const adjustmentRecord = {
            id: `adj_whe_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            date: new Date().toISOString(),
            type: "decrease",
            quantity: item.quantity,
            previousStock: currentStock,
            newStock,
            reason: `Warehouse Entry #${entryNumber}${entryNotes ? ` (${entryNotes})` : ""}`,
          };

          // Update manufacturing item in Firestore
          await updateDoc(itemDocRef, {
            stock: newStock,
            adjustmentHistory: [adjustmentRecord],
            updatedAt: serverTimestamp(),
          });
        }
      }

      // 3. Save Warehouse Entry document
      setUploadProgressMsg("Saving warehouse entry record...");
      const totalQuantity = selectedItems.reduce((acc, curr) => acc + curr.quantity, 0);

      const entryPayload: Omit<WarehouseEntry, "id"> = {
        entryNumber,
        date: entryDate,
        time: timeStr,
        notes: entryNotes.trim(),
        items: selectedItems,
        photos: uploadedPhotoUrls,
        totalQuantity: Number(totalQuantity.toFixed(3)),
        totalItemsCount: selectedItems.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, "warehouse_entries"), entryPayload);

      showToast(
        `Warehouse Entry ${entryNumber} saved! Deducted ${selectedItems.length} item(s) from manufacturing stock.`,
        "success"
      );
      setIsAddModalOpen(false);
    } catch (err: any) {
      console.error("Error saving warehouse entry:", err);
      showToast("Failed to save warehouse entry: " + err.message, "error");
    } finally {
      setIsSubmitting(false);
      setUploadProgressMsg("");
    }
  };

  // Delete Entry (with optional stock restoration)
  const handleConfirmDeleteEntry = async () => {
    if (!deletingEntry) return;

    try {
      if (restoreStockOnDelete && deletingEntry.items) {
        for (const item of deletingEntry.items) {
          try {
            const rawItemFound = rawItems.find((r) => r.id === item.itemId);
            if (rawItemFound) {
              const currentStock = Number(rawItemFound.stock) || 0;
              const newStock = Number((currentStock + item.quantity).toFixed(3));
              const adjustmentRecord = {
                id: `adj_rev_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                date: new Date().toISOString(),
                type: "increase",
                quantity: item.quantity,
                previousStock: currentStock,
                newStock,
                reason: `Reversal of deleted Warehouse Entry #${deletingEntry.entryNumber}`,
              };
              await updateDoc(doc(db, "manufacturing_items", item.itemId), {
                stock: newStock,
                adjustmentHistory: [adjustmentRecord],
                updatedAt: serverTimestamp(),
              });
            }
          } catch (itemErr) {
            console.warn("Could not restore stock for item:", item.name, itemErr);
          }
        }
      }

      await deleteDoc(doc(db, "warehouse_entries", deletingEntry.id));
      showToast(
        `Warehouse entry "${deletingEntry.entryNumber}" deleted${
          restoreStockOnDelete ? " and manufacturing stock restored" : ""
        }.`,
        "success"
      );
      setDeletingEntry(null);
    } catch (err: any) {
      console.error("Error deleting entry:", err);
      showToast("Failed to delete warehouse entry: " + err.message, "error");
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full space-y-6">
      {/* 1. Header (Following Design System) */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b"
        style={{ borderColor: "var(--color-border-subtle)" }}
      >
        <div>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white"
              style={{ backgroundColor: "var(--color-brand-primary)" }}
            >
              <Warehouse size={18} />
            </div>
            <h1
              className="text-2xl text-[var(--color-text-primary)] tracking-tight"
              style={{ fontWeight: 500 }}
            >
              Warehouse Entry
            </h1>
            <span
              className="px-2 py-0.5 text-xs rounded font-normal font-mono"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                border: "1px solid var(--color-border-base)",
                color: "var(--color-text-secondary)",
              }}
            >
              {filteredEntries.length} entries
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            Log warehouse dispatches, attach photo proof, and automatically deduct quantities from
            Manufacturing Stock Analysis.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-md text-white transition-opacity hover:opacity-90 font-normal shadow-xs cursor-pointer"
            style={{ backgroundColor: "var(--color-brand-primary)" }}
          >
            <Plus size={15} />
            <span>Add Entry</span>
          </button>
        </div>
      </div>

      {/* 2. Date Filter Pills & Search Controls (Default "Today" as requested) */}
      <div
        className="bg-white p-3 md:p-4 rounded-lg border shadow-2xs space-y-3"
        style={{ borderColor: "var(--color-border-base)" }}
      >
        {/* Date Filter Pills */}
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
            { id: "all", label: "All Time" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setDateFilter(f.id as DateFilterType);
                setCurrentPage(1);
              }}
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

        {/* Custom Range Picker */}
        {dateFilter === "custom" && (
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
            <span className="text-xs text-slate-500">From:</span>
            <CustomDatePicker value={customFrom} onChange={setCustomFrom} compact />
            <span className="text-xs text-slate-500">To:</span>
            <CustomDatePicker value={customTo} onChange={setCustomTo} compact />
          </div>
        )}

        {/* Search Bar & Count */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-100">
          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by entry #, item name, notes..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd] bg-slate-50/50"
              style={{ borderColor: "var(--color-border-base)" }}
            />
          </div>

          <div className="text-xs text-slate-500 font-mono">
            Showing {paginatedEntries.length} of {filteredEntries.length} entries
          </div>
        </div>
      </div>

      {/* 3. Metric KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          className="p-3.5 rounded-lg border bg-white shadow-2xs"
          style={{ borderColor: "var(--color-border-base)" }}
        >
          <span className="text-[11px] text-slate-500 block">Total Entries</span>
          <span className="text-xl font-mono text-slate-900 mt-1 block" style={{ fontWeight: 500 }}>
            {stats.entriesCount}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">Matching period</span>
        </div>

        <div
          className="p-3.5 rounded-lg border bg-white shadow-2xs"
          style={{ borderColor: "var(--color-border-base)" }}
        >
          <span className="text-[11px] text-slate-500 block">Total Items Dispatched</span>
          <span className="text-xl font-mono text-slate-900 mt-1 block" style={{ fontWeight: 500 }}>
            {stats.totalQty}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">Cumulative quantity</span>
        </div>

        <div className="p-3.5 rounded-lg border bg-blue-50/50 border-blue-200 shadow-2xs">
          <span className="text-[11px] text-blue-800 block">Attached Photos</span>
          <span className="text-xl font-mono text-[#348bdd] mt-1 block" style={{ fontWeight: 500 }}>
            {stats.totalPhotos}
          </span>
          <span className="text-[10px] text-blue-600 block mt-0.5 font-mono">Compressed proof &lt;60KB</span>
        </div>

        <div className="p-3.5 rounded-lg border bg-emerald-50/50 border-emerald-200 shadow-2xs">
          <span className="text-[11px] text-emerald-800 block">Today's Entries</span>
          <span className="text-xl font-mono text-emerald-700 mt-1 block" style={{ fontWeight: 500 }}>
            {stats.todayCount}
          </span>
          <span className="text-[10px] text-emerald-600 block mt-0.5 font-mono">Logged today</span>
        </div>
      </div>

      {/* 4. Entries Table */}
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
                <th className="py-2.5 px-4">Entry # & Date</th>
                <th className="py-2.5 px-4">Items & Quantities (Deducted)</th>
                <th className="py-2.5 px-4 text-center">Total Quantity</th>
                <th className="py-2.5 px-4">Photos (&lt;60KB)</th>
                <th className="py-2.5 px-4">Notes / Purpose</th>
                <th className="py-2.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingEntries ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <RotateCw size={20} className="animate-spin inline text-[#348bdd] mr-2" />
                    Loading warehouse entries...
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <Boxes size={28} className="mx-auto text-slate-300 mb-2" />
                    No warehouse entries found for the selected date filter.
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Entry Number & Date */}
                    <td className="py-3 px-4 font-mono">
                      <span className="font-medium text-slate-900 block">{entry.entryNumber}</span>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Calendar size={10} className="text-slate-400" />
                        {entry.date} {entry.time && `at ${entry.time}`}
                      </span>
                    </td>

                    {/* Items and Quantities */}
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5 max-w-md">
                        {entry.items?.map((it, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50/80 text-blue-900 border border-blue-200 text-[11px]"
                          >
                            <span className="font-medium">{it.name}:</span>
                            <span className="font-mono font-semibold text-[#348bdd]">
                              {it.quantity} {it.unit}
                            </span>
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Total Quantity */}
                    <td className="py-3 px-4 text-center font-mono font-semibold text-slate-900">
                      {entry.totalQuantity}
                    </td>

                    {/* Photos Thumbnail Strip */}
                    <td className="py-3 px-4">
                      {entry.photos && entry.photos.length > 0 ? (
                        <div className="flex items-center gap-1.5">
                          {entry.photos.slice(0, 3).map((photoUrl, pIdx) => (
                            <button
                              key={pIdx}
                              type="button"
                              onClick={() => setLightboxImageUrl(photoUrl)}
                              className="w-9 h-9 rounded-md border border-slate-200 overflow-hidden shrink-0 cursor-pointer hover:opacity-80 transition-opacity bg-slate-100 group relative"
                              title="Click to zoom photo"
                            >
                              <img
                                src={photoUrl}
                                alt={`Warehouse ${pIdx}`}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                <Maximize2 size={10} />
                              </div>
                            </button>
                          ))}
                          {entry.photos.length > 3 && (
                            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-1 rounded">
                              +{entry.photos.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No photos</span>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                      {entry.notes || "—"}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setViewingEntry(entry)}
                          className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                          title="View Details"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => setDeletingEntry(entry)}
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          title="Delete Entry"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div
            className="px-4 py-3 border-t flex items-center justify-between text-xs"
            style={{
              borderColor: "var(--color-border-subtle)",
              backgroundColor: "var(--color-bg-subtle)",
            }}
          >
            <span className="text-slate-500 font-mono">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
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

      {/* =========================================================================
          5. ADD WAREHOUSE ENTRY FULLSCREEN MODAL
         ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 w-screen h-screen overflow-hidden animate-in fade-in duration-150">
          {/* Modal Header */}
          <div
            className="px-6 py-3.5 border-b flex items-center justify-between shrink-0 bg-white"
            style={{ borderColor: "var(--color-border-subtle)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: "var(--color-brand-primary)" }}
              >
                <Warehouse size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-900">Add Warehouse Entry</h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-[#348bdd] border border-blue-200">
                    Fullscreen Mode
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Select products, enter quantities, attach proof photos, and automatically deduct stock from manufacturing.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => !isSubmitting && setIsAddModalOpen(false)}
              className="w-9 h-9 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
              title="Close (Esc)"
            >
              <X size={20} />
            </button>
          </div>

          {/* Modal Form Body */}
          <form
            onSubmit={handleSaveWarehouseEntry}
            className="flex-1 flex flex-col overflow-hidden bg-slate-50/50"
          >
            {/* Top Config & Filters Bar */}
            <div className="bg-white border-b border-slate-200 px-6 py-3 shrink-0 space-y-3">
              {/* Row 1: Date & Purpose Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                    Entry Date <span className="text-rose-500">*</span>
                  </label>
                  <CustomDatePicker
                    value={entryDate}
                    onChange={(val) => setEntryDate(val || getTodayDateStr())}
                    placeholder="Entry date"
                    clearable={false}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                    Notes / Purpose <span className="text-slate-400 font-normal lowercase">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dispatched to retail counter / outlet replenishment"
                    value={entryNotes}
                    onChange={(e) => setEntryNotes(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd] bg-white"
                    style={{ borderColor: "var(--color-border-base)" }}
                  />
                </div>
              </div>

              {/* Row 2: Search & Category Filter Pills */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <div className="relative w-full sm:w-72">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search product name..."
                    value={itemSearchTerm}
                    onChange={(e) => setItemSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd] bg-slate-50/70"
                    style={{ borderColor: "var(--color-border-base)" }}
                  />
                  {itemSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setItemSearchTerm("")}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("all")}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                      selectedCategory === "all"
                        ? "bg-[#348bdd] text-white shadow-2xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    All ({products.length})
                  </button>
                  {productCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                        selectedCategory === cat
                          ? "bg-[#348bdd] text-white shadow-2xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Middle Main Scroll Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Manufacturing Stock Cards Grid: "card type Ui image below name thats it" */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                    <Boxes size={14} className="text-[#348bdd]" />
                    <span>Select Manufacturing Stock Items ({selectedItems.length} selected)</span>
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Showing {displayedCardProducts.length} manufacturing items • Click card to select
                  </span>
                </div>

                {isLoadingItems ? (
                  <div className="py-20 text-center text-slate-400">
                    <RotateCw size={24} className="animate-spin inline mr-2 text-[#348bdd]" />
                    Loading manufacturing stock items...
                  </div>
                ) : displayedCardProducts.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
                    No manufacturing stock items match the filter.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 max-h-[46vh] overflow-y-auto p-2.5 border border-slate-200 rounded-xl bg-white shadow-2xs">
                    {displayedCardProducts.map((prod) => {
                      const isSelected = selectedItems.some((i) => i.itemId === prod.id);
                      return (
                        <div
                          key={prod.id}
                          onClick={() => handleToggleProductSelection(prod)}
                          className={`group relative rounded-xl border-2 transition-all cursor-pointer overflow-hidden flex flex-col bg-white select-none ${
                            isSelected
                              ? "border-[#348bdd] ring-2 ring-blue-200 bg-blue-50/25 shadow-xs"
                              : "border-slate-200 hover:border-slate-300 hover:shadow-2xs"
                          }`}
                        >
                          {/* Image */}
                          <div className="aspect-square w-full bg-slate-100 overflow-hidden relative">
                            <img
                              src={prod.imageUrl || "/logo.png"}
                              alt={prod.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "/logo.png";
                              }}
                            />
                            {isSelected && (
                              <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-[#348bdd] text-white flex items-center justify-center shadow-md">
                                <Check size={13} />
                              </div>
                            )}
                            {/* Stock badge */}
                            <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-white font-mono text-[9px] backdrop-blur-xs">
                              {prod.stock} {prod.unit}
                            </div>
                          </div>

                          {/* Name below image - "image below name thats it" */}
                          <div className="p-2 text-center flex-1 flex flex-col justify-center bg-white border-t border-slate-100">
                            <span className="text-xs font-semibold text-slate-800 line-clamp-2 leading-tight">
                              {prod.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                              {prod.category || "Stock Item"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected Products Quantities Table */}
              {selectedItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                      <PackageCheck size={14} className="text-emerald-600" />
                      <span>Enter Deduction Quantities ({selectedItems.length})</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setSelectedItems([])}
                      className="text-[11px] text-rose-600 hover:underline cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-mono uppercase text-slate-500">
                        <tr>
                          <th className="py-2.5 px-4 w-12 text-center">#</th>
                          <th className="py-2.5 px-4">Manufacturing Item</th>
                          <th className="py-2.5 px-4 text-center">Manufacturing Stock</th>
                          <th className="py-2.5 px-4 text-center w-48">Deduct Quantity</th>
                          <th className="py-2.5 px-4 text-center">Remaining Stock</th>
                          <th className="py-2.5 px-4 text-center w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedItems.map((selItem, sIdx) => {
                          const current = Number(selItem.currentStock) || 0;
                          const deduct = Number(selItem.quantity) || 0;
                          const rem = Math.max(0, Number((current - deduct).toFixed(3)));
                          const isExceeding = deduct > current && current > 0;

                          return (
                            <tr key={selItem.itemId} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-4 text-center font-mono text-slate-400">
                                {sIdx + 1}
                              </td>

                              <td className="py-2.5 px-4">
                                <div className="flex items-center gap-2.5">
                                  <img
                                    src={selItem.imageUrl || "/logo.png"}
                                    alt={selItem.name}
                                    className="w-9 h-9 rounded-md object-cover border border-slate-200 shrink-0"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = "/logo.png";
                                    }}
                                  />
                                  <div>
                                    <div className="font-semibold text-slate-900">{selItem.name}</div>
                                    <div className="text-[10px] text-slate-400 font-mono">
                                      Unit: {selItem.unit}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-2.5 px-4 text-center font-mono text-slate-600">
                                {current > 0 ? `${current} ${selItem.unit}` : "—"}
                              </td>

                              <td className="py-2.5 px-4 text-center">
                                <div className="inline-flex items-center border border-slate-300 rounded-md overflow-hidden bg-white shadow-2xs">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleItemQuantityChange(
                                        selItem.itemId,
                                        Math.max(1, (Number(selItem.quantity) || 1) - 1)
                                      )
                                    }
                                    className="w-7 h-7 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-600 cursor-pointer"
                                  >
                                    <Minus size={12} />
                                  </button>
                                  <input
                                    type="number"
                                    min="0.001"
                                    step="any"
                                    value={selItem.quantity}
                                    onChange={(e) =>
                                      handleItemQuantityChange(
                                        selItem.itemId,
                                        Number(e.target.value)
                                      )
                                    }
                                    className="w-16 h-7 text-center font-mono font-bold text-xs border-x border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleItemQuantityChange(
                                        selItem.itemId,
                                        (Number(selItem.quantity) || 0) + 1
                                      )
                                    }
                                    className="w-7 h-7 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-[#348bdd] font-bold cursor-pointer"
                                  >
                                    <Plus size={12} />
                                  </button>
                                </div>
                              </td>

                              <td className="py-2.5 px-4 text-center font-mono">
                                {current > 0 ? (
                                  <span
                                    className={`font-semibold ${
                                      isExceeding ? "text-amber-600" : "text-emerald-700"
                                    }`}
                                  >
                                    {rem} {selItem.unit}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Untracked</span>
                                )}
                              </td>

                              <td className="py-2.5 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSelectedItem(selItem.itemId)}
                                  className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                                  title="Remove product"
                                >
                                  <X size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Warehouse Photos Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                      <Camera size={14} className="text-[#348bdd]" />
                      <span>Warehouse Photos Proof ({attachedPhotos.length})</span>
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Images are automatically compressed to &lt;60KB before uploading to ImageKit.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCameraOpen(true)}
                      className="px-3 py-1.5 rounded-md bg-[#348bdd] hover:bg-[#2877c3] text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                    >
                      <Camera size={13} />
                      <span>Take Photo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                    >
                      <Upload size={13} className="text-slate-500" />
                      <span>Choose Files</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                </div>

                {attachedPhotos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
                    {attachedPhotos.map((photo, pIdx) => (
                      <div
                        key={pIdx}
                        className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50 group aspect-square flex flex-col justify-between shadow-2xs"
                      >
                        <img
                          src={photo.previewUrl}
                          alt={`Proof ${pIdx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-mono">
                          {photo.sizeKB} KB
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(pIdx)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center opacity-85 hover:opacity-100 transition-opacity cursor-pointer shadow"
                          title="Remove photo"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-400 bg-white">
                    <ImageIcon size={22} className="mx-auto text-slate-300 mb-1" />
                    No photos attached yet. Click <strong>Take Photo</strong> or <strong>Choose Files</strong> to attach proof.
                  </div>
                )}
              </div>
            </div>

            {/* Fullscreen Sticky Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 shadow-sm">
              <div className="flex items-center gap-4 text-xs font-mono">
                <div>
                  <span className="text-slate-400">Selected Products: </span>
                  <span className="font-semibold text-slate-900">{selectedItems.length}</span>
                </div>
                <div className="h-3.5 w-px bg-slate-200" />
                <div>
                  <span className="text-slate-400">Total Deduction Qty: </span>
                  <span className="font-semibold text-[#348bdd]">
                    {selectedItems.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0).toFixed(2)}
                  </span>
                </div>
                {uploadProgressMsg && (
                  <>
                    <div className="h-3.5 w-px bg-slate-200" />
                    <div className="flex items-center gap-1.5 text-blue-700 animate-pulse font-sans">
                      <RotateCw size={12} className="animate-spin" />
                      <span>{uploadProgressMsg}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || selectedItems.length === 0}
                  className="px-5 py-2 text-xs text-white rounded-md shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 font-medium hover:opacity-95"
                  style={{ backgroundColor: "var(--color-brand-primary)" }}
                >
                  {isSubmitting ? (
                    <>
                      <RotateCw size={13} className="animate-spin" />
                      <span>Saving & Deducting Stock...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Save Warehouse Entry</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          6. VIEW ENTRY DETAILS MODAL
         ========================================================================= */}
      {viewingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white rounded-xl border shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            <div
              className="px-5 py-4 border-b flex items-center justify-between"
              style={{
                borderColor: "var(--color-border-subtle)",
                backgroundColor: "var(--color-bg-subtle)",
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center text-white"
                  style={{ backgroundColor: "var(--color-brand-primary)" }}
                >
                  <Warehouse size={15} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-800">
                    Warehouse Entry {viewingEntry.entryNumber}
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {viewingEntry.date} {viewingEntry.time && `at ${viewingEntry.time}`}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setViewingEntry(null)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {viewingEntry.notes && (
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                  <span className="font-semibold text-slate-900 block mb-0.5">Notes:</span>
                  {viewingEntry.notes}
                </div>
              )}

              <div>
                <span className="text-[11px] font-medium text-slate-700 uppercase tracking-wider block mb-1.5">
                  Dispatched Items ({viewingEntry.items?.length || 0})
                </span>
                <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                  {viewingEntry.items?.map((it, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={it.imageUrl || "/logo.png"}
                          alt={it.name}
                          className="w-7 h-7 rounded object-cover border border-slate-200 shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/logo.png";
                          }}
                        />
                        <span className="font-medium text-slate-800 truncate">{it.name}</span>
                      </div>
                      <span className="font-mono font-semibold text-[#348bdd] shrink-0">
                        {it.quantity} {it.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {viewingEntry.photos && viewingEntry.photos.length > 0 && (
                <div>
                  <span className="text-[11px] font-medium text-slate-700 uppercase tracking-wider block mb-1.5">
                    Attached Photo Proof ({viewingEntry.photos.length})
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {viewingEntry.photos.map((url, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => setLightboxImageUrl(url)}
                        className="aspect-square rounded-lg border border-slate-200 overflow-hidden cursor-pointer hover:opacity-85 transition-opacity"
                      >
                        <img src={url} alt={`Proof ${pIdx}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/70 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingEntry(null)}
                className="px-3.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          7. IMAGE LIGHTBOX / ZOOM MODAL
         ========================================================================= */}
      {lightboxImageUrl && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxImageUrl(null)}
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150 cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setLightboxImageUrl(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white p-1 cursor-pointer"
            >
              <X size={22} />
            </button>
            <img
              src={lightboxImageUrl}
              alt="Enlarged Warehouse Proof"
              className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* =========================================================================
          8. LIVE CAMERA MODAL (Front & Back Camera with <60KB compression)
         ========================================================================= */}
      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />

      {/* =========================================================================
          9. DELETE CONFIRMATION MODAL
         ========================================================================= */}
      {deletingEntry && (
        <ConfirmationModal
          isOpen={Boolean(deletingEntry)}
          title="Delete Warehouse Entry"
          message={`Are you sure you want to delete warehouse entry "${deletingEntry.entryNumber}"? This will reverse the record.${
            restoreStockOnDelete ? " The deducted stock will be returned to Manufacturing Stock Analysis." : ""
          }`}
          confirmText="Delete Entry"
          onConfirm={handleConfirmDeleteEntry}
          onCancel={() => setDeletingEntry(null)}
        />
      )}
    </div>
  );
}
