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
} from "lucide-react";

interface RawMaterialItem {
  id: string;
  name: string;
  stock: number;
  unit: string;
  amount: number;
  bufferStock: number;
  category?: string;
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
  const [isLoadingEntries, setIsLoadingEntries] = useState<boolean>(true);
  const [isLoadingItems, setIsLoadingItems] = useState<boolean>(true);

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
    setSelectedItems([]);
    setAttachedPhotos([]);
    setUploadProgressMsg("");
    setIsAddModalOpen(true);
  };

  // Toggle item selection (multiple or single)
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
        const itemDocRef = doc(db, "manufacturing_items", item.itemId);

        // Fetch latest current stock to ensure precision
        const rawItemFound = rawItems.find((r) => r.id === item.itemId);
        const currentStock = rawItemFound ? Number(rawItemFound.stock) || 0 : Number(item.currentStock) || 0;
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
          5. ADD WAREHOUSE ENTRY MODAL
         ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white rounded-xl border shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            {/* Modal Header */}
            <div
              className="px-5 py-4 border-b flex items-center justify-between shrink-0"
              style={{
                borderColor: "var(--color-border-subtle)",
                backgroundColor: "var(--color-bg-subtle)",
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                  style={{ backgroundColor: "var(--color-brand-primary)" }}
                >
                  <Warehouse size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-800">Add Warehouse Entry</h3>
                  <span className="text-[11px] text-slate-500">
                    Quantities will be automatically deducted from Manufacturing Stock Analysis
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => !isSubmitting && setIsAddModalOpen(false)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveWarehouseEntry} className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Row 1: Date & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                    Entry Date <span className="text-rose-500">*</span>
                  </label>
                  <CustomDatePicker
                    value={entryDate}
                    onChange={(val) => setEntryDate(val || getTodayDateStr())}
                    placeholder="Entry date"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">Preselected to today's date</span>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                    Notes / Purpose <span className="text-slate-400 font-normal lowercase">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dispatched to kitchen / retail outlet"
                    value={entryNotes}
                    onChange={(e) => setEntryNotes(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd] bg-white"
                    style={{ borderColor: "var(--color-border-base)" }}
                  />
                </div>
              </div>

              {/* Row 2: Select Items from Manufacturing Stock */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="block text-[11px] font-medium text-slate-700 uppercase tracking-wider">
                    Select Items to Deduct ({selectedItems.length} selected){" "}
                    <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative w-full sm:w-64">
                    <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search manufacturing items..."
                      value={itemSearchTerm}
                      onChange={(e) => setItemSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd] bg-slate-50"
                      style={{ borderColor: "var(--color-border-base)" }}
                    />
                  </div>
                </div>

                {/* Items Selection Grid (Click to toggle item) */}
                <div className="border border-slate-200 rounded-lg p-2 max-h-40 overflow-y-auto bg-slate-50/50 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {isLoadingItems ? (
                    <div className="col-span-full py-6 text-center text-xs text-slate-400">
                      <RotateCw size={14} className="animate-spin inline mr-1 text-[#348bdd]" />
                      Loading stock items...
                    </div>
                  ) : filteredRawItems.length === 0 ? (
                    <div className="col-span-full py-6 text-center text-xs text-slate-400">
                      No matching manufacturing items found.
                    </div>
                  ) : (
                    filteredRawItems.map((item) => {
                      const isSelected = selectedItems.some((i) => i.itemId === item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleToggleItemSelection(item)}
                          className={`p-2 rounded-md border text-left cursor-pointer transition-all flex items-center justify-between gap-2 ${
                            isSelected
                              ? "bg-blue-50/90 border-[#348bdd] text-blue-900 shadow-2xs"
                              : "bg-white border-slate-200 hover:border-slate-300 text-slate-800"
                          }`}
                        >
                          <div className="truncate flex-1">
                            <span className="text-xs font-medium block truncate">{item.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Stock: {item.stock} {item.unit}
                            </span>
                          </div>
                          <div
                            className={`w-4 h-4 rounded shrink-0 flex items-center justify-center border text-[10px] ${
                              isSelected
                                ? "bg-[#348bdd] text-white border-[#348bdd]"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {isSelected && <Check size={11} />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Row 3: Quantities for Selected Items */}
              {selectedItems.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-medium text-slate-700 uppercase tracking-wider">
                    Enter Deduction Quantities
                  </div>
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-mono uppercase text-slate-500">
                        <tr>
                          <th className="py-2 px-3">Item Name</th>
                          <th className="py-2 px-3 text-center">Available Stock</th>
                          <th className="py-2 px-3 text-center w-36">Deduct Quantity</th>
                          <th className="py-2 px-3 text-center">Remaining Stock</th>
                          <th className="py-2 px-3 text-center w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedItems.map((selItem) => {
                          const current = Number(selItem.currentStock) || 0;
                          const deduct = Number(selItem.quantity) || 0;
                          const rem = Math.max(0, Number((current - deduct).toFixed(3)));
                          const isExceeding = deduct > current;

                          return (
                            <tr key={selItem.itemId} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3 font-medium text-slate-800">
                                {selItem.name}
                              </td>
                              <td className="py-2 px-3 text-center font-mono text-slate-600">
                                {current} {selItem.unit}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <input
                                    type="number"
                                    min="0.001"
                                    step="any"
                                    value={selItem.quantity}
                                    onChange={(e) =>
                                      handleItemQuantityChange(selItem.itemId, Number(e.target.value))
                                    }
                                    className="w-20 px-2 py-1 text-xs border rounded text-center font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#348bdd] border-slate-300 bg-white"
                                  />
                                  <span className="text-[11px] text-slate-500 font-mono">
                                    {selItem.unit}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2 px-3 text-center font-mono">
                                <span
                                  className={`font-semibold ${
                                    isExceeding ? "text-amber-600" : "text-emerald-700"
                                  }`}
                                >
                                  {rem} {selItem.unit}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSelectedItem(selItem.itemId)}
                                  className="text-slate-400 hover:text-red-500 p-1 cursor-pointer"
                                  title="Remove item"
                                >
                                  <X size={13} />
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

              {/* Row 4: Photos (Camera Capture & File Upload - Auto-compressed to <60KB) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 uppercase tracking-wider">
                      Warehouse Photos Proof ({attachedPhotos.length})
                    </label>
                    <span className="text-[10px] text-slate-500">
                      Photos will be compressed to strictly under 60KB before upload to ImageKit.
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Take Picture button (Opens Front/Back Camera Viewfinder) */}
                    <button
                      type="button"
                      onClick={() => setIsCameraOpen(true)}
                      className="px-2.5 py-1.5 rounded-md bg-[#348bdd] hover:bg-[#2877c3] text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                      title="Take photo using camera (front or back)"
                    >
                      <Camera size={13} />
                      <span>Take Photo</span>
                    </button>

                    {/* Choose from files */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                      title="Choose images from gallery/device"
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

                {/* Photos Preview Thumbnails */}
                {attachedPhotos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50">
                    {attachedPhotos.map((photo, pIdx) => (
                      <div
                        key={pIdx}
                        className="relative rounded-lg overflow-hidden border border-slate-200 bg-white group aspect-square flex flex-col justify-between shadow-2xs"
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
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity cursor-pointer shadow"
                          title="Remove photo"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border border-dashed border-slate-300 text-center text-xs text-slate-400 bg-slate-50/50">
                    <ImageIcon size={20} className="mx-auto text-slate-300 mb-1" />
                    No photos attached yet. Click <strong>Take Photo</strong> to capture with camera or{" "}
                    <strong>Choose Files</strong> from your device.
                  </div>
                )}
              </div>

              {/* Progress message during upload */}
              {uploadProgressMsg && (
                <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-center gap-2">
                  <RotateCw size={14} className="animate-spin text-[#348bdd]" />
                  <span>{uploadProgressMsg}</span>
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer font-normal"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || selectedItems.length === 0}
                  className="px-5 py-2 text-xs text-white rounded-md shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 font-normal"
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
            </form>
          </div>
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
                    <div key={idx} className="p-2.5 flex items-center justify-between">
                      <span className="font-medium text-slate-800">{it.name}</span>
                      <span className="font-mono font-semibold text-[#348bdd]">
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
