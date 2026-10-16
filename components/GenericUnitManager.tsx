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
  Eye,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  Loader2,
  RotateCw,
  Tag,
  AlignLeft
} from "lucide-react";

export interface UnitItem {
  id: string;
  name: string;
  description?: string;
  createdAt?: any;
}

interface GenericUnitManagerProps {
  collectionName: string;
  pageTitle: string;
  unitLabel: string; // e.g. "Category Name" or "Unit Name"
  placeholderName: string; // e.g. "e.g. Pure Ghee Sweets"
  descriptionText: string;
  icon: React.ElementType;
  badgeLabel: string;
}

const PAGE_SIZE = 24;

export default function GenericUnitManager({
  collectionName,
  pageTitle,
  unitLabel,
  placeholderName,
  descriptionText,
  icon: PageIcon,
  badgeLabel,
}: GenericUnitManagerProps) {
  const { showToast } = useToast();

  // State
  const [items, setItems] = useState<UnitItem[]>([]);
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
      const allSelected = paginatedItems.every((item) => prev.has(item.id));
      if (allSelected) {
        return new Set();
      } else {
        return new Set(paginatedItems.map((item) => item.id));
      }
    });
  };

  // Drawer & Modals state
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<UnitItem | null>(null);
  const [viewingItem, setViewingItem] = useState<UnitItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<UnitItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Form fields
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [nameError, setNameError] = useState<string>("");

  // Manual refresh helper
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, collectionName), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const records: UnitItem[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<UnitItem, "id">),
      }));
      setItems(records);
      setTotalCount(records.length);
    } catch (err) {
      console.error(`Refresh error for ${collectionName}:`, err);
    } finally {
      setIsLoading(false);
    }
  }, [collectionName]);

  // Realtime Listeners for items
  useEffect(() => {
    setIsLoading(true);
    const colRef = collection(db, collectionName);
    const q = query(colRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const itemsMap = new Map<string, UnitItem>();
        snapshot.docs.forEach((docSnap) => {
          itemsMap.set(docSnap.id, {
            id: docSnap.id,
            ...(docSnap.data() as Omit<UnitItem, "id">),
          });
        });
        const records = Array.from(itemsMap.values());
        setItems(records);
        setTotalCount(records.length);
        setIsLoading(false);
      },
      (err) => {
        console.error(`Realtime error for ${collectionName}:`, err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName]);

  // Search filter
  const filteredItems = useMemo(() => {
    const seen = new Set<string>();
    const unique = items.filter((item) => {
      if (!item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    if (!searchQuery.trim()) return unique;
    const q = searchQuery.toLowerCase().trim();
    return unique.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  // Paginated items (24 per page)
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredItems.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredItems, currentPage]);

  // Open Drawer for Add
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({ name: "", description: "" });
    setNameError("");
    setIsDrawerOpen(true);
  };

  // Open Drawer for Edit
  const handleOpenEdit = (item: UnitItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || "",
    });
    setNameError("");
    setIsDrawerOpen(true);
  };

  // Save Item (Add or Update)
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setNameError(`${unitLabel} is required`);
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingItem) {
        // Update existing record
        const itemRef = doc(db, collectionName, editingItem.id);
        await updateDoc(itemRef, {
          name: formData.name.trim(),
          description: formData.description.trim(),
          updatedAt: serverTimestamp(),
        });

        setItems((prev) =>
          prev.map((i) =>
            i.id === editingItem.id
              ? {
                  ...i,
                  name: formData.name.trim(),
                  description: formData.description.trim(),
                }
              : i
          )
        );

        showToast(`"${formData.name.trim()}" updated successfully!`, "success");
      } else {
        // Create new record
        const colRef = collection(db, collectionName);
        const docRef = await addDoc(colRef, {
          name: formData.name.trim(),
          description: formData.description.trim(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const newItem: UnitItem = {
          id: docRef.id,
          name: formData.name.trim(),
          description: formData.description.trim(),
          createdAt: Timestamp.now(),
        };

        setItems((prev) => [newItem, ...prev.filter((i) => i.id !== newItem.id)]);
        setTotalCount((prev) => prev + 1);

        showToast(`"${formData.name.trim()}" created successfully!`, "success");
      }

      setIsDrawerOpen(false);
    } catch (err: any) {
      console.error("Save error:", err);
      showToast(`Error saving: ${err.message || "Unknown error"}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Item
  const handleConfirmDelete = async () => {
    if (!deletingItem) return;

    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, collectionName, deletingItem.id));

      setItems((prev) => prev.filter((i) => i.id !== deletingItem.id));
      setTotalCount((prev) => Math.max(0, prev - 1));

      showToast(`"${deletingItem.name}" deleted successfully`, "info");
      setDeletingItem(null);
    } catch (err: any) {
      console.error("Delete error:", err);
      showToast(`Error deleting: ${err.message || "Unknown error"}`, "error");
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
    <div className="p-4 md:p-6 lg:p-8 w-full space-y-6">
      {/* Top Header */}
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
              <PageIcon size={18} />
            </div>
            <h1
              className="text-2xl text-[var(--color-text-primary)] tracking-tight"
              style={{ fontWeight: 500 }}
            >
              {pageTitle}
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
            {descriptionText}
          </p>
        </div>

        {/* Actions: Refresh & Add Button */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
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
            <span>Add {unitLabel}</span>
          </button>
        </div>
      </div>

      {/* Search and Pagination Toolbar */}
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
            placeholder={`Search ${pageTitle.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full text-xs bg-transparent focus:outline-none"
            style={{ color: "var(--color-text-primary)" }}
          />
        </div>

        <div
          className="text-xs self-end sm:self-center"
          style={{ color: "var(--color-text-muted)" }}
        >
          Showing {paginatedItems.length} of {filteredItems.length} (Limit: 24/page)
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
              Loading from Firestore...
            </span>
          </div>
        ) : paginatedItems.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center p-6">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                color: "var(--color-text-muted)",
              }}
            >
              <PageIcon size={22} />
            </div>
            <h3
              className="text-sm text-[var(--color-text-primary)]"
              style={{ fontWeight: 500 }}
            >
              {searchQuery ? `No matching ${pageTitle.toLowerCase()} found` : `No ${pageTitle.toLowerCase()} added yet`}
            </h3>
            <p
              className="text-xs mt-1 max-w-sm"
              style={{ color: "var(--color-text-muted)" }}
            >
              {searchQuery
                ? "Try searching for another term or clear the filter."
                : `Click 'Add ${unitLabel}' to create your first entry.`}
            </p>
            {!searchQuery && (
              <button
                onClick={handleOpenAdd}
                className="mt-4 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md text-white font-normal"
                style={{ backgroundColor: "var(--color-brand-primary)" }}
              >
                <Plus size={14} />
                <span>Add Now</span>
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
                        paginatedItems.length > 0 &&
                        paginatedItems.every((item) => selectedIds.has(item.id))
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

                  {/* Name Column */}
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800">
                          {unitLabel.toLowerCase().replace(/\s+/g, "_")}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">text</span>
                      </div>
                      <ChevronDown size={12} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>

                  {/* Description Column */}
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800">description</span>
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
                {paginatedItems.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <tr
                      key={item.id}
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
                          onChange={() => handleToggleSelectRow(item.id)}
                          className="rounded border-slate-300 text-[var(--color-brand-primary)] focus:ring-0 cursor-pointer h-3.5 w-3.5"
                        />
                      </td>

                      {/* ID with Arrow Button */}
                      <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-600">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate max-w-[130px]">{item.id}</span>
                          <button
                            onClick={() => setViewingItem(item)}
                            className="w-5 h-5 rounded flex items-center justify-center bg-slate-100 hover:bg-sky-50 text-slate-500 hover:text-[#348bdd] border border-slate-200/70 transition-colors cursor-pointer"
                            title="View details"
                          >
                            <ArrowRight size={11} />
                          </button>
                        </div>
                      </td>

                      {/* Item Name */}
                      <td className="px-3.5 py-2.5 text-slate-900 font-normal">
                        {item.name || <span className="font-mono text-slate-300 italic text-[11px]">NULL</span>}
                      </td>

                      {/* Description */}
                      <td className="px-3.5 py-2.5 max-w-sm text-slate-700">
                        {item.description ? (
                          <span className="truncate block" title={item.description}>
                            {item.description}
                          </span>
                        ) : (
                          <span className="font-mono text-slate-300 italic text-[11px]">NULL</span>
                        )}
                      </td>

                      {/* Created At */}
                      <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {formatDate(item.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View - Primary Blue Shade */}
                          <button
                            onClick={() => setViewingItem(item)}
                            className="w-7 h-7 rounded-md flex items-center justify-center transition-all bg-sky-50 text-[#348bdd] hover:bg-sky-100 hover:text-[#2377c8] border border-sky-100 cursor-pointer shadow-2xs"
                            title="View details"
                          >
                            <Eye size={13} />
                          </button>

                          {/* Edit - Amber/Gold Shade */}
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="w-7 h-7 rounded-md flex items-center justify-center transition-all bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 border border-amber-100 cursor-pointer shadow-2xs"
                            title="Edit"
                          >
                            <Edit2 size={13} />
                          </button>

                          {/* Delete - Rose/Red Shade */}
                          <button
                            onClick={() => setDeletingItem(item)}
                            className="w-7 h-7 rounded-md flex items-center justify-center transition-all bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 border border-rose-100 cursor-pointer shadow-2xs"
                            title="Delete"
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

        {/* Pagination Controls */}
        {!isLoading && filteredItems.length > 0 && (
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

      {/* Right Offcanvas Drawer for Add / Edit */}
      <OffcanvasDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingItem ? `Edit ${unitLabel}` : `Add New ${unitLabel}`}
        subtitle={
          editingItem
            ? `Update information for "${editingItem.name}"`
            : `Enter the ${unitLabel.toLowerCase()} to save in your live database.`
        }
      >
        <form onSubmit={handleSaveItem} className="space-y-4">
          {/* Name Field */}
          <div>
            <label
              className="block text-xs uppercase tracking-wider mb-1.5"
              style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
            >
              {unitLabel} <span className="text-red-500">*</span>
            </label>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-md border bg-white focus-within:ring-1 focus-within:ring-[var(--color-brand-primary)]"
              style={{
                borderColor: nameError ? "#f87171" : "var(--color-border-base)",
              }}
            >
              <Tag size={15} style={{ color: "var(--color-text-muted)" }} />
              <input
                type="text"
                placeholder={placeholderName}
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (nameError) setNameError("");
                }}
                className="w-full text-xs bg-transparent focus:outline-none"
                style={{ color: "var(--color-text-primary)" }}
              />
            </div>
            {nameError && (
              <p className="text-[11px] text-red-500 mt-1">{nameError}</p>
            )}
          </div>

          {/* Description / Notes Field */}
          <div>
            <label
              className="block text-xs uppercase tracking-wider mb-1.5"
              style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
            >
              Description / Notes (Optional)
            </label>
            <div
              className="flex items-start gap-2 px-3 py-2 rounded-md border bg-white focus-within:ring-1 focus-within:ring-[var(--color-brand-primary)]"
              style={{
                borderColor: "var(--color-border-base)",
              }}
            >
              <AlignLeft
                size={15}
                className="mt-1 shrink-0"
                style={{ color: "var(--color-text-muted)" }}
              />
              <textarea
                rows={3}
                placeholder="Optional notes or details..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full text-xs bg-transparent focus:outline-none resize-none"
                style={{ color: "var(--color-text-primary)" }}
              />
            </div>
          </div>

          {/* Actions */}
          <div
            className="pt-4 border-t flex items-center justify-end gap-2.5"
            style={{ borderColor: "var(--color-border-subtle)" }}
          >
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
              <span>{editingItem ? "Update Details" : "Save Details"}</span>
            </button>
          </div>
        </form>
      </OffcanvasDrawer>

      {/* View Item Details Modal */}
      <ViewDetailsModal
        isOpen={!!viewingItem}
        onClose={() => setViewingItem(null)}
        title={viewingItem?.name || "Record Details"}
        badge={badgeLabel}
        fields={[
          { label: "RECORD ID", value: viewingItem?.id },
          { label: "NAME", value: viewingItem?.name },
          { label: "DESCRIPTION", value: viewingItem?.description || "No description provided" },
          { label: "CREATED ON", value: formatDate(viewingItem?.createdAt) },
          { label: "STATUS", value: "Active Operational" },
        ]}
      />

      {/* Custom Confirmation Modal for Delete */}
      <ConfirmationModal
        isOpen={!!deletingItem}
        title={`Delete ${unitLabel}`}
        message={`Are you sure you want to delete "${deletingItem?.name}"? This action is permanent and cannot be undone.`}
        confirmText="Confirm Delete"
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingItem(null)}
      />
    </div>
  );
}
