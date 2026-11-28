"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import { UtilityItem, UtilityType } from "@/types/utility";
import {
  Boxes,
  Sparkles,
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  X,
  Package,
  Tag,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";

const DEFAULT_SEEDS: Array<Omit<UtilityItem, "id">> = [
  // Boxes
  {
    name: "250g Regular Sweet Box",
    type: "box",
    price: 5.0,
    description: "Standard 250g food-grade paper board box",
    unit: "pcs",
    isActive: true,
  },
  {
    name: "500g Classic Sweet Box",
    type: "box",
    price: 8.0,
    description: "500g traditional gold-border sweet box",
    unit: "pcs",
    isActive: true,
  },
  {
    name: "1kg Premium Sweet Box",
    type: "box",
    price: 14.0,
    description: "Heavy 1kg luxury sweets box with moisture barrier",
    unit: "pcs",
    isActive: true,
  },
  {
    name: "2kg Bulk / Catering Box",
    type: "box",
    price: 26.0,
    description: "Corrugated strong 2kg handle box",
    unit: "pcs",
    isActive: true,
  },
  {
    name: "Dry Fruit Luxury Gift Box",
    type: "box",
    price: 45.0,
    description: "4-compartment velvet-finish gift box",
    unit: "pcs",
    isActive: true,
  },
  // Stickers
  {
    name: "Ravi Sweets Gold Logo Sticker",
    type: "sticker",
    price: 2.0,
    description: "Round 2-inch metallic gold brand seal",
    unit: "pcs",
    isActive: true,
  },
  {
    name: "Pure Ghee Preparation Seal",
    type: "sticker",
    price: 1.5,
    description: "Green pure ghee certified safety sticker",
    unit: "pcs",
    isActive: true,
  },
  {
    name: "Special Occasion / Festive Sticker",
    type: "sticker",
    price: 3.0,
    description: "Festival greetings & ribbon seal sticker",
    unit: "pcs",
    isActive: true,
  },
];

export default function UtilitiesPage() {
  const { showToast } = useToast();

  // Active category tab in the sidebar: "box" or "sticker"
  const [activeTab, setActiveTab] = useState<UtilityType>("box");

  // Data state
  const [items, setItems] = useState<UtilityItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<UtilityItem | null>(null);
  const [itemName, setItemName] = useState<string>("");
  const [itemPrice, setItemPrice] = useState<string>("");
  const [itemDescription, setItemDescription] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Delete Confirmation Modal State
  const [deletingItem, setDeletingItem] = useState<UtilityItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Seeding state
  const [isSeeding, setIsSeeding] = useState<boolean>(false);

  // Real-time Firestore Listener
  useEffect(() => {
    const colRef = collection(db, "utilities_items");
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const loaded: UtilityItem[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            name: data.name || "",
            type: (data.type === "sticker" ? "sticker" : "box") as UtilityType,
            price: Number(data.price) || 0,
            description: data.description || "",
            unit: data.unit || "pcs",
            isActive: data.isActive !== undefined ? data.isActive : true,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };
        });
        setItems(loaded);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching utilities:", error);
        showToast("Failed to load utilities", "error");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [showToast]);

  // Seed default data if completely empty
  const handleSeedDefaults = async () => {
    setIsSeeding(true);
    try {
      const batch = writeBatch(db);
      for (const seed of DEFAULT_SEEDS) {
        const docRef = doc(collection(db, "utilities_items"));
        batch.set(docRef, {
          ...seed,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      showToast("Loaded default Boxes and Stickers successfully!", "success");
    } catch (err) {
      console.error("Seeding error:", err);
      showToast("Failed to seed defaults", "error");
    } finally {
      setIsSeeding(false);
    }
  };

  // Filter items by active tab and search query
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => item.type === activeTab)
      .filter((item) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          item.name.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, activeTab, searchQuery]);

  // Counts
  const boxCount = useMemo(() => items.filter((i) => i.type === "box").length, [items]);
  const stickerCount = useMemo(() => items.filter((i) => i.type === "sticker").length, [items]);

  // Open modal for add or edit
  const handleOpenAdd = () => {
    setEditingItem(null);
    setItemName("");
    setItemPrice("");
    setItemDescription("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: UtilityItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemPrice(String(item.price));
    setItemDescription(item.description || "");
    setIsModalOpen(true);
  };

  // Save handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = itemName.trim();
    if (!trimmedName) {
      showToast("Please enter a valid item name", "error");
      return;
    }

    const priceNum = Number(itemPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      showToast("Please enter a valid non-negative price", "error");
      return;
    }

    setIsSaving(true);
    try {
      if (editingItem) {
        // Update existing
        await updateDoc(doc(db, "utilities_items", editingItem.id), {
          name: trimmedName,
          price: priceNum,
          description: itemDescription.trim(),
          updatedAt: serverTimestamp(),
        });
        showToast(`${activeTab === "box" ? "Box" : "Sticker"} updated successfully`, "success");
      } else {
        // Create new
        await addDoc(collection(db, "utilities_items"), {
          name: trimmedName,
          type: activeTab,
          price: priceNum,
          description: itemDescription.trim(),
          unit: "pcs",
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast(`New ${activeTab === "box" ? "Box" : "Sticker"} added successfully`, "success");
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error("Save error:", err);
      showToast("Failed to save item", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete handler
  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "utilities_items", deletingItem.id));
      showToast(`${deletingItem.name} removed successfully`, "success");
      setDeletingItem(null);
    } catch (err) {
      console.error("Delete error:", err);
      showToast("Failed to delete item", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50/50">
      {/* Top Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-7xl mx-auto w-full">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                Inventory & Operations
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-xs font-medium text-[#348bdd]">Utilities</span>
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight mt-0.5">
              Utilities
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage packaging boxes and custom stickers used in orders and billing attachments.
            </p>
          </div>

          {/* Quick Counter Summary */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/80">
              <Boxes size={15} className="text-[#348bdd]" />
              <div className="text-xs">
                <span className="text-slate-500">Boxes: </span>
                <span className="font-semibold text-slate-800">{boxCount}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/80">
              <Sparkles size={15} className="text-amber-500" />
              <div className="text-xs">
                <span className="text-slate-500">Stickers: </span>
                <span className="font-semibold text-slate-800">{stickerCount}</span>
              </div>
            </div>

            {items.length === 0 && !loading && (
              <button
                type="button"
                onClick={handleSeedDefaults}
                disabled={isSeeding}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-50 text-[#348bdd] border border-[#348bdd]/30 hover:bg-sky-100 transition-colors cursor-pointer"
              >
                {isSeeding ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                <span>Load Starter Defaults</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex flex-col md:flex-row gap-6">
        {/* Left Sub-Sidebar */}
        <aside className="w-full md:w-64 shrink-0 flex flex-col gap-1">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Utility Types
          </div>

          {/* Boxes Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("box")}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
              activeTab === "box"
                ? "bg-white border-[#348bdd] text-[#348bdd] shadow-xs ring-1 ring-[#348bdd]/20"
                : "bg-white/70 border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  activeTab === "box"
                    ? "bg-sky-50 text-[#348bdd]"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                <Boxes size={18} />
              </div>
              <div>
                <div className="text-xs font-semibold">Boxes</div>
                <div className="text-[11px] text-slate-400">Sweet & gift packaging</div>
              </div>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium ${
                activeTab === "box"
                  ? "bg-sky-100 text-[#348bdd]"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {boxCount}
            </span>
          </button>

          {/* Stickers Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("sticker")}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl border text-left transition-all duration-150 cursor-pointer mt-1 ${
              activeTab === "sticker"
                ? "bg-white border-amber-500 text-amber-700 shadow-xs ring-1 ring-amber-500/20"
                : "bg-white/70 border-slate-200 text-slate-600 hover:bg-white hover:text-slate-900"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  activeTab === "sticker"
                    ? "bg-amber-50 text-amber-600"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                <Sparkles size={18} />
              </div>
              <div>
                <div className="text-xs font-semibold">Stickers</div>
                <div className="text-[11px] text-slate-400">Logo, seals & greetings</div>
              </div>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium ${
                activeTab === "sticker"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {stickerCount}
            </span>
          </button>

          {/* Helper Card */}
          <div className="mt-4 p-3 rounded-xl border border-slate-200/80 bg-white/60 text-slate-500 text-xs">
            <div className="font-medium text-slate-700 mb-1 flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-[#348bdd]" />
              <span>Orders & POS Ready</span>
            </div>
            Items added here will automatically appear in the <strong>Additional Attachments</strong> accordion on Create Order and POS Billing.
          </div>
        </aside>

        {/* Right Main Content */}
        <main className="flex-1 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          {/* Main Action Bar */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  activeTab === "box"
                    ? "bg-sky-50 text-[#348bdd]"
                    : "bg-amber-50 text-amber-600"
                }`}
              >
                {activeTab === "box" ? <Boxes size={18} /> : <Sparkles size={18} />}
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  {activeTab === "box" ? "Boxes List" : "Stickers List"}
                </h2>
                <p className="text-[11px] text-slate-400">
                  {filteredItems.length} {activeTab === "box" ? "boxes" : "stickers"} configured
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Search Bar */}
              <div className="relative w-full sm:w-60">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder={`Search ${activeTab === "box" ? "boxes" : "stickers"}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#348bdd] focus:border-[#348bdd]"
                />
              </div>

              {/* Add Button */}
              <button
                type="button"
                onClick={handleOpenAdd}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#348bdd] hover:bg-[#2c77be] transition-colors shadow-2xs cursor-pointer shrink-0"
              >
                <Plus size={14} />
                <span>Add {activeTab === "box" ? "Box" : "Sticker"}</span>
              </button>
            </div>
          </div>

          {/* Items Content */}
          <div className="p-4 sm:p-5 flex-1 overflow-y-auto">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 size={24} className="animate-spin text-[#348bdd]" />
                <span className="text-xs">Loading utilities...</span>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                  {activeTab === "box" ? <Boxes size={22} /> : <Sparkles size={22} />}
                </div>
                <h3 className="text-xs font-semibold text-slate-700">
                  No {activeTab === "box" ? "boxes" : "stickers"} found
                </h3>
                <p className="text-[11px] text-slate-400 max-w-sm mt-1 mb-4">
                  {searchQuery
                    ? "Try adjusting your search query."
                    : `Get started by adding your first ${activeTab === "box" ? "packaging box" : "custom sticker"} with price.`}
                </p>
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[#348bdd] hover:bg-[#2c77be] transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add {activeTab === "box" ? "Box" : "Sticker"}</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-[#348bdd]/40 bg-white hover:shadow-xs transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top Row: Icon + Type Badge + Price */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <div
                            className={`w-6 h-6 rounded-md flex items-center justify-center text-xs ${
                              item.type === "box"
                                ? "bg-sky-50 text-[#348bdd]"
                                : "bg-amber-50 text-amber-600"
                            }`}
                          >
                            {item.type === "box" ? <Package size={13} /> : <Tag size={13} />}
                          </div>
                          <span
                            className={`text-[10px] font-mono uppercase font-semibold px-1.5 py-0.5 rounded ${
                              item.type === "box"
                                ? "bg-sky-50 text-[#348bdd]"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {item.type}
                          </span>
                        </div>

                        {/* Price Badge */}
                        <div className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-mono font-bold text-xs border border-emerald-200/60">
                          ₹{item.price.toFixed(2)}
                        </div>
                      </div>

                      {/* Name */}
                      <h4 className="text-xs font-semibold text-slate-800 leading-snug">
                        {item.name}
                      </h4>

                      {/* Description if any */}
                      {item.description ? (
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                          {item.description}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-300 italic mt-1">
                          No extra notes
                        </p>
                      )}
                    </div>

                    {/* Bottom Row: Actions */}
                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        title="Edit Item"
                        className="p-1 rounded-md text-slate-400 hover:text-[#348bdd] hover:bg-sky-50 transition-colors cursor-pointer"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingItem(item)}
                        title="Delete Item"
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    activeTab === "box"
                      ? "bg-sky-50 text-[#348bdd]"
                      : "bg-amber-50 text-amber-600"
                  }`}
                >
                  {activeTab === "box" ? <Boxes size={15} /> : <Sparkles size={15} />}
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  {editingItem ? `Edit ${activeTab === "box" ? "Box" : "Sticker"}` : `Add New ${activeTab === "box" ? "Box" : "Sticker"}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {activeTab === "box" ? "Box Name" : "Sticker Name"}{" "}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    activeTab === "box"
                      ? "e.g., 500g Classic Sweet Box"
                      : "e.g., Ravi Sweets Gold Logo Sticker"
                  }
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#348bdd] focus:border-[#348bdd]"
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Price per piece (₹) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={itemPrice}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    onChange={(e) => setItemPrice(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#348bdd] focus:border-[#348bdd]"
                  />
                </div>
              </div>

              {/* Description / Size Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description / Specification <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder={
                    activeTab === "box"
                      ? "e.g., Food-grade paper board with gold foil border"
                      : "e.g., Round 2-inch adhesive waterproof seal"
                  }
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#348bdd] focus:border-[#348bdd]"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#348bdd] hover:bg-[#2c77be] rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  {isSaving && <Loader2 size={13} className="animate-spin" />}
                  <span>{editingItem ? "Update Item" : "Save Item"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Delete Utility Item?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Are you sure you want to delete <strong>{deletingItem.name}</strong>?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                {isDeleting && <Loader2 size={13} className="animate-spin" />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
