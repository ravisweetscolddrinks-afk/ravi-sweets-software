"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getCountFromServer,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import OffcanvasDrawer from "@/components/OffcanvasDrawer";
import ConfirmationModal from "@/components/ConfirmationModal";
import ViewDetailsModal from "@/components/ViewDetailsModal";
import {
  Plus,
  Search,
  Store,
  Phone,
  MapPin,
  Eye,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  Loader2,
  RotateCw,
  Building2,
  Calendar
} from "lucide-react";

export interface StoreItem {
  id: string;
  name: string;
  phone: string;
  address: string;
  createdAt?: any;
}

const PAGE_SIZE = 24;

export default function StoresPage() {
  const { showToast } = useToast();

  // State
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Toggle select individual row
  const handleToggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle select all on current page
  const handleToggleSelectAll = () => {
    setSelectedIds((prev) => {
      const allSelected = paginatedStores.every((s) => prev.has(s.id));
      if (allSelected) {
        return new Set();
      } else {
        return new Set(paginatedStores.map((s) => s.id));
      }
    });
  };

  // Drawer & Modals state
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [editingStore, setEditingStore] = useState<StoreItem | null>(null);
  const [viewingStore, setViewingStore] = useState<StoreItem | null>(null);
  const [deletingStore, setDeletingStore] = useState<StoreItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Form fields
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Manual refresh helper
  const fetchStoresData = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "stores"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const items: StoreItem[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<StoreItem, "id">),
      }));
      setStores(items);
      setTotalCount(items.length);
    } catch (err) {
      console.error("Refresh stores error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Realtime Listeners for Stores
  useEffect(() => {
    setIsLoading(true);
    const storesCol = collection(db, "stores");
    const q = query(storesCol, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const itemsMap = new Map<string, StoreItem>();
        snapshot.docs.forEach((docSnap) => {
          itemsMap.set(docSnap.id, {
            id: docSnap.id,
            ...(docSnap.data() as Omit<StoreItem, "id">),
          });
        });
        const items = Array.from(itemsMap.values());
        setStores(items);
        setTotalCount(items.length);
        setIsLoading(false);
      },
      (err) => {
        console.error("Realtime stores error:", err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Search filtering
  const filteredStores = useMemo(() => {
    const seen = new Set<string>();
    const unique = stores.filter((s) => {
      if (!s.id || seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
    if (!searchQuery.trim()) return unique;
    const q = searchQuery.toLowerCase().trim();
    return unique.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q)
    );
  }, [stores, searchQuery]);

  // Paginated data (24 per page)
  const totalPages = Math.max(1, Math.ceil(filteredStores.length / PAGE_SIZE));
  const paginatedStores = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredStores.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredStores, currentPage]);

  // Handle drawer open for Add
  const handleOpenAdd = () => {
    setEditingStore(null);
    setFormData({ name: "", phone: "", address: "" });
    setFormErrors({});
    setIsDrawerOpen(true);
  };

  // Handle drawer open for Edit
  const handleOpenEdit = (store: StoreItem) => {
    setEditingStore(store);
    setFormData({
      name: store.name,
      phone: store.phone,
      address: store.address,
    });
    setFormErrors({});
    setIsDrawerOpen(true);
  };

  // Form Validation
  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!formData.name.trim()) errors.name = "Store Name is required";
    if (!formData.phone.trim()) errors.phone = "Mobile Number is required";
    if (!formData.address.trim()) errors.address = "Address is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save Store (Add or Update)
  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      if (editingStore) {
        // Update existing store
        const storeRef = doc(db, "stores", editingStore.id);
        await updateDoc(storeRef, {
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          updatedAt: serverTimestamp(),
        });

        setStores((prev) =>
          prev.map((s) =>
            s.id === editingStore.id
              ? {
                  ...s,
                  name: formData.name.trim(),
                  phone: formData.phone.trim(),
                  address: formData.address.trim(),
                }
              : s
          )
        );

        showToast(`Store "${formData.name.trim()}" updated successfully!`, "success");
      } else {
        // Add new store
        const storesCol = collection(db, "stores");
        const docRef = await addDoc(storesCol, {
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const newStore: StoreItem = {
          id: docRef.id,
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          createdAt: Timestamp.now(),
        };

        setStores((prev) => [newStore, ...prev.filter((s) => s.id !== newStore.id)]);
        setTotalCount((prev) => prev + 1);

        showToast(`Store "${formData.name.trim()}" added successfully!`, "success");
      }

      setIsDrawerOpen(false);
    } catch (err: any) {
      console.error("Save error:", err);
      showToast("Error saving store: " + (err.message || "Unknown error"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Store
  const handleConfirmDelete = async () => {
    if (!deletingStore) return;

    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "stores", deletingStore.id));

      setStores((prev) => prev.filter((s) => s.id !== deletingStore.id));
      setTotalCount((prev) => Math.max(0, prev - 1));

      showToast(`Store "${deletingStore.name}" deleted successfully`, "info");
      setDeletingStore(null);
    } catch (err: any) {
      console.error("Delete error:", err);
      showToast("Error deleting store: " + (err.message || "Unknown error"), "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (ts: any) => {
    if (!ts) return "Just now";
    if (ts.toDate) {
      return ts.toDate().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
    return "Recently";
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
        <div>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                backgroundColor: "var(--color-brand-primary-light)",
                color: "var(--color-brand-primary)",
              }}
            >
              <Store size={18} />
            </div>
            <h1
              className="text-2xl text-[var(--color-text-primary)] tracking-tight"
              style={{ fontWeight: 500 }}
            >
              Stores
            </h1>
            <span
              className="px-2 py-0.5 text-xs rounded font-normal font-mono"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                border: "1px solid var(--color-border-base)",
                color: "var(--color-text-secondary)",
              }}
            >
              {totalCount} total
            </span>
          </div>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            Manage retail outlets, branch contact numbers, and store physical addresses.
          </p>
        </div>

        {/* Actions: Refresh & Add Store Button */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchStoresData}
            title="Refresh list"
            disabled={isLoading}
            className="p-2 rounded-md border bg-white hover:bg-slate-50 transition-colors disabled:opacity-50"
            style={{
              borderColor: "var(--color-border-base)",
              color: "var(--color-text-secondary)",
            }}
          >
            <RotateCw size={15} className={isLoading ? "animate-spin" : ""} />
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-md text-white transition-opacity hover:opacity-90 font-normal shadow-xs"
            style={{ backgroundColor: "var(--color-brand-primary)" }}
          >
            <Plus size={15} />
            <span>Add Store</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-md border w-full sm:w-80 bg-white"
          style={{
            borderColor: "var(--color-border-base)",
          }}
        >
          <Search size={14} style={{ color: "var(--color-text-muted)" }} />
          <input
            type="text"
            placeholder="Search by store name, phone or address..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full text-xs bg-transparent focus:outline-none"
            style={{ color: "var(--color-text-primary)" }}
          />
        </div>

        <div className="text-xs self-end sm:self-center" style={{ color: "var(--color-text-muted)" }}>
          Showing {paginatedStores.length} of {filteredStores.length} (Limit: 24/page)
        </div>
      </div>

      {/* Main Table / Grid List */}
      <div
        className="rounded-lg border bg-white overflow-hidden shadow-xs"
        style={{ borderColor: "var(--color-border-base)" }}
      >
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2
              size={24}
              className="animate-spin"
              style={{ color: "var(--color-brand-primary)" }}
            />
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Loading stores from Firestore...
            </span>
          </div>
        ) : paginatedStores.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center p-6">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                color: "var(--color-text-muted)",
              }}
            >
              <Store size={22} />
            </div>
            <h3
              className="text-sm text-[var(--color-text-primary)]"
              style={{ fontWeight: 500 }}
            >
              {searchQuery ? "No matching stores found" : "No stores added yet"}
            </h3>
            <p className="text-xs mt-1 max-w-sm" style={{ color: "var(--color-text-muted)" }}>
              {searchQuery
                ? "Try adjusting your search query or clear the filter."
                : "Get started by adding your first store branch using the 'Add Store' button."}
            </p>
            {!searchQuery && (
              <button
                onClick={handleOpenAdd}
                className="mt-4 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md text-white font-normal"
                style={{ backgroundColor: "var(--color-brand-primary)" }}
              >
                <Plus size={14} />
                <span>Add Store Now</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto border-t" style={{ borderColor: "var(--color-border-base)" }}>
            <table className="w-full text-left text-xs border-collapse">
              <thead
                className="border-b select-none sticky top-0 z-10"
                style={{
                  backgroundColor: "var(--color-bg-surface)",
                  borderColor: "var(--color-border-base)",
                  color: "var(--color-text-secondary)",
                }}
              >
                <tr className="divide-x divide-slate-200 text-[11px]">
                  {/* Select All Checkbox */}
                  <th className="w-10 px-3 py-2 text-center bg-slate-50/50">
                    <input
                      type="checkbox"
                      checked={
                        paginatedStores.length > 0 &&
                        paginatedStores.every((s) => selectedIds.has(s.id))
                      }
                      onChange={handleToggleSelectAll}
                      className="rounded border-slate-300 text-[var(--color-brand-primary)] focus:ring-0 cursor-pointer h-3.5 w-3.5"
                    />
                  </th>

                  {/* ID Column */}
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800">id</span>
                        <span className="text-[10px] font-mono text-slate-400">uuid</span>
                      </div>
                      <ChevronDown size={12} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>

                  {/* Store Name Column */}
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800">store_name</span>
                        <span className="text-[10px] font-mono text-slate-400">text</span>
                      </div>
                      <ChevronDown size={12} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>

                  {/* Phone Column */}
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800">phone</span>
                        <span className="text-[10px] font-mono text-slate-400">varchar</span>
                      </div>
                      <ChevronDown size={12} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>

                  {/* Address Column */}
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800">address</span>
                        <span className="text-[10px] font-mono text-slate-400">text</span>
                      </div>
                      <ChevronDown size={12} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>

                  {/* Created At Column */}
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800">created_at</span>
                        <span className="text-[10px] font-mono text-slate-400">timestamp</span>
                      </div>
                      <ChevronDown size={12} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>

                  {/* Actions Column */}
                  <th className="px-3 py-2 font-medium text-right bg-slate-50/50 w-28">
                    <div className="flex items-center justify-end gap-1">
                      <span className="font-medium text-slate-800">actions</span>
                      <span className="text-[10px] font-mono text-slate-400">menu</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedStores.map((store) => {
                  const isSelected = selectedIds.has(store.id);
                  return (
                    <tr
                      key={store.id}
                      className={`divide-x divide-slate-200 transition-colors ${
                        isSelected
                          ? "bg-sky-50/60"
                          : "hover:bg-slate-50/80"
                      }`}
                    >
                      {/* Row Checkbox */}
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectRow(store.id)}
                          className="rounded border-slate-300 text-[var(--color-brand-primary)] focus:ring-0 cursor-pointer h-3.5 w-3.5"
                        />
                      </td>

                      {/* ID with Arrow Button */}
                      <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-600">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate max-w-[130px]">{store.id}</span>
                          <button
                            onClick={() => setViewingStore(store)}
                            className="w-5 h-5 rounded flex items-center justify-center bg-slate-100 hover:bg-sky-50 text-slate-500 hover:text-[#348bdd] border border-slate-200/70 transition-colors cursor-pointer"
                            title="View store details"
                          >
                            <ArrowRight size={11} />
                          </button>
                        </div>
                      </td>

                      {/* Store Name */}
                      <td className="px-3.5 py-2.5 text-slate-900 font-normal">
                        {store.name || <span className="font-mono text-slate-300 italic text-[11px]">NULL</span>}
                      </td>

                      {/* Phone Number */}
                      <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-700">
                        {store.phone || <span className="font-mono text-slate-300 italic text-[11px]">NULL</span>}
                      </td>

                      {/* Address */}
                      <td className="px-3.5 py-2.5 max-w-xs text-slate-700">
                        {store.address ? (
                          <span className="truncate block" title={store.address}>
                            {store.address}
                          </span>
                        ) : (
                          <span className="font-mono text-slate-300 italic text-[11px]">NULL</span>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {formatDate(store.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View - Primary Blue Shade */}
                          <button
                            onClick={() => setViewingStore(store)}
                            className="w-7 h-7 rounded-md flex items-center justify-center transition-all bg-sky-50 text-[#348bdd] hover:bg-sky-100 hover:text-[#2377c8] border border-sky-100 cursor-pointer shadow-2xs"
                            title="View store details"
                          >
                            <Eye size={13} />
                          </button>

                          {/* Edit - Amber/Gold Shade */}
                          <button
                            onClick={() => handleOpenEdit(store)}
                            className="w-7 h-7 rounded-md flex items-center justify-center transition-all bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 border border-amber-100 cursor-pointer shadow-2xs"
                            title="Edit store"
                          >
                            <Edit2 size={13} />
                          </button>

                          {/* Delete - Rose/Red Shade */}
                          <button
                            onClick={() => setDeletingStore(store)}
                            className="w-7 h-7 rounded-md flex items-center justify-center transition-all bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 border border-rose-100 cursor-pointer shadow-2xs"
                            title="Delete store"
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
        )}

        {/* Pagination Bar */}
        {!isLoading && filteredStores.length > 0 && (
          <div
            className="flex items-center justify-between px-4 py-3 border-t bg-white"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Page {currentPage} of {totalPages}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded border hover:bg-slate-50 transition-colors disabled:opacity-40"
                style={{ borderColor: "var(--color-border-base)" }}
              >
                <ChevronLeft size={15} />
              </button>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded border hover:bg-slate-50 transition-colors disabled:opacity-40"
                style={{ borderColor: "var(--color-border-base)" }}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Offcanvas Drawer on the Right for Add / Edit Store */}
      <OffcanvasDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingStore ? "Edit Store" : "Add New Store"}
        subtitle={
          editingStore
            ? `Update details for "${editingStore.name}"`
            : "Enter store branch details to create a new record."
        }
      >
        <form onSubmit={handleSaveStore} className="space-y-4">
          {/* Store Name Field */}
          <div>
            <label
              className="block text-xs uppercase tracking-wider mb-1.5"
              style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
            >
              Store Name <span className="text-red-500">*</span>
            </label>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-md border bg-white focus-within:ring-1 focus-within:ring-[var(--color-brand-primary)]"
              style={{
                borderColor: formErrors.name ? "#f87171" : "var(--color-border-base)",
              }}
            >
              <Store size={15} style={{ color: "var(--color-text-muted)" }} />
              <input
                type="text"
                placeholder="e.g. Chirala Main Branch"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (formErrors.name) setFormErrors({ ...formErrors, name: "" });
                }}
                className="w-full text-xs bg-transparent focus:outline-none"
                style={{ color: "var(--color-text-primary)" }}
              />
            </div>
            {formErrors.name && (
              <p className="text-[11px] text-red-500 mt-1">{formErrors.name}</p>
            )}
          </div>

          {/* Mobile Number Field */}
          <div>
            <label
              className="block text-xs uppercase tracking-wider mb-1.5"
              style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
            >
              Mobile Number <span className="text-red-500">*</span>
            </label>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-md border bg-white focus-within:ring-1 focus-within:ring-[var(--color-brand-primary)]"
              style={{
                borderColor: formErrors.phone ? "#f87171" : "var(--color-border-base)",
              }}
            >
              <Phone size={15} style={{ color: "var(--color-text-muted)" }} />
              <input
                type="tel"
                placeholder="e.g. +91 98480 12345"
                value={formData.phone}
                onChange={(e) => {
                  setFormData({ ...formData, phone: e.target.value });
                  if (formErrors.phone) setFormErrors({ ...formErrors, phone: "" });
                }}
                className="w-full text-xs bg-transparent focus:outline-none"
                style={{ color: "var(--color-text-primary)" }}
              />
            </div>
            {formErrors.phone && (
              <p className="text-[11px] text-red-500 mt-1">{formErrors.phone}</p>
            )}
          </div>

          {/* Address Field */}
          <div>
            <label
              className="block text-xs uppercase tracking-wider mb-1.5"
              style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
            >
              Store Address <span className="text-red-500">*</span>
            </label>
            <div
              className="flex items-start gap-2 px-3 py-2 rounded-md border bg-white focus-within:ring-1 focus-within:ring-[var(--color-brand-primary)]"
              style={{
                borderColor: formErrors.address ? "#f87171" : "var(--color-border-base)",
              }}
            >
              <MapPin size={15} className="mt-1 shrink-0" style={{ color: "var(--color-text-muted)" }} />
              <textarea
                rows={3}
                placeholder="e.g. Door No. 12-4-5, Gandhi Road, Chirala, Andhra Pradesh - 523155"
                value={formData.address}
                onChange={(e) => {
                  setFormData({ ...formData, address: e.target.value });
                  if (formErrors.address) setFormErrors({ ...formErrors, address: "" });
                }}
                className="w-full text-xs bg-transparent focus:outline-none resize-none"
                style={{ color: "var(--color-text-primary)" }}
              />
            </div>
            {formErrors.address && (
              <p className="text-[11px] text-red-500 mt-1">{formErrors.address}</p>
            )}
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t flex items-center justify-end gap-2.5" style={{ borderColor: "var(--color-border-subtle)" }}>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsDrawerOpen(false)}
              className="px-4 py-2 text-xs rounded-md border hover:bg-slate-50 transition-colors"
              style={{
                borderColor: "var(--color-border-base)",
                color: "var(--color-text-secondary)",
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-md text-white transition-opacity hover:opacity-90 disabled:opacity-50 font-normal"
              style={{ backgroundColor: "var(--color-brand-primary)" }}
            >
              {isSubmitting && <Loader2 size={13} className="animate-spin" />}
              <span>{editingStore ? "Update Store" : "Save Store"}</span>
            </button>
          </div>
        </form>
      </OffcanvasDrawer>

      {/* View Store Details Modal */}
      <ViewDetailsModal
        isOpen={!!viewingStore}
        onClose={() => setViewingStore(null)}
        title={viewingStore?.name || "Store Details"}
        badge="STORE OUTLET"
        fields={[
          { label: "STORE ID", value: viewingStore?.id },
          { label: "NAME", value: viewingStore?.name },
          { label: "MOBILE NUMBER", value: viewingStore?.phone },
          { label: "ADDRESS", value: viewingStore?.address },
          { label: "CREATED ON", value: formatDate(viewingStore?.createdAt) },
          { label: "STATUS", value: "Active Operational" },
        ]}
      />

      {/* Custom Confirmation Modal for Delete */}
      <ConfirmationModal
        isOpen={!!deletingStore}
        title="Delete Store"
        message={`Are you sure you want to delete "${deletingStore?.name}"? All associated counter records and data for this store will be permanently removed.`}
        confirmText="Delete Store"
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingStore(null)}
      />
    </div>
  );
}
