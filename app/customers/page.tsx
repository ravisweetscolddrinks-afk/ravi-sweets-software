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
  Users,
  Phone,
  Mail,
  MapPin,
  Building,
  Eye,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  Loader2,
  RotateCw,
  UserCheck,
  User,
} from "lucide-react";

export interface CustomerItem {
  id: string;
  name: string;
  phone: string;
  city?: string;
  address?: string;
  email?: string;
  isB2b?: boolean;
  gstNumber?: string;
  createdAt?: any;
  updatedAt?: any;
}

const PAGE_SIZE = 24;

export default function CustomersPage() {
  const { showToast } = useToast();

  // State
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Drawer & Modals state
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerItem | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<CustomerItem | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<CustomerItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Form fields
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    city: "",
    address: "",
    email: "",
    isB2b: false,
    gstNumber: "",
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

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
      const allSelected = paginatedCustomers.every((c) => prev.has(c.id));
      if (allSelected) {
        return new Set();
      } else {
        return new Set(paginatedCustomers.map((c) => c.id));
      }
    });
  };

  // Manual refresh helper
  const fetchCustomersData = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "customers"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const items: CustomerItem[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<CustomerItem, "id">),
      }));
      setCustomers(items);
      setTotalCount(items.length);
    } catch (err) {
      console.error("Refresh error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Realtime Listeners for Customers
  useEffect(() => {
    setIsLoading(true);
    const custCol = collection(db, "customers");
    const q = query(custCol, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const itemsMap = new Map<string, CustomerItem>();
        snapshot.docs.forEach((docSnap) => {
          itemsMap.set(docSnap.id, {
            id: docSnap.id,
            ...(docSnap.data() as Omit<CustomerItem, "id">),
          });
        });
        const items = Array.from(itemsMap.values());
        setCustomers(items);
        setTotalCount(items.length);
        setIsLoading(false);
      },
      (err) => {
        console.error("Realtime customers error:", err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Search filtering
  const filteredCustomers = useMemo(() => {
    const seen = new Set<string>();
    const unique = customers.filter((c) => {
      if (!c.id || seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
    if (!searchQuery.trim()) return unique;
    const q = searchQuery.toLowerCase().trim();
    return unique.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q))
    );
  }, [customers, searchQuery]);

  // Paginated data (24 per page)
  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE));
  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredCustomers.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredCustomers, currentPage]);

  // Handle drawer open for Add
  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormData({
      name: "",
      phone: "",
      city: "",
      address: "",
      email: "",
      isB2b: false,
      gstNumber: "",
    });
    setFormErrors({});
    setIsDrawerOpen(true);
  };

  // Handle drawer open for Edit
  const handleOpenEdit = (customer: CustomerItem) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      city: customer.city || "",
      address: customer.address || "",
      email: customer.email || "",
      isB2b: !!customer.isB2b,
      gstNumber: customer.gstNumber || "",
    });
    setFormErrors({});
    setIsDrawerOpen(true);
  };

  // Form Validation (name & phone are mandatory, city/address/email are optional)
  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!formData.name.trim()) errors.name = "Customer Name is mandatory";
    if (!formData.phone.trim()) errors.phone = "Mobile Number is mandatory";
    if (formData.isB2b && !formData.gstNumber.trim()) {
      errors.gstNumber = "GST Number is required for B2B Customers";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save Customer (Add or Update - Optimistic in-memory update)
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        city: formData.city.trim(),
        address: formData.address.trim(),
        email: formData.email.trim(),
        isB2b: !!formData.isB2b,
        gstNumber: formData.isB2b ? formData.gstNumber.trim().toUpperCase() : "",
        updatedAt: serverTimestamp(),
      };

      if (editingCustomer) {
        // Update existing customer
        const custRef = doc(db, "customers", editingCustomer.id);
        await updateDoc(custRef, payload);

        setCustomers((prev) =>
          prev.map((c) =>
            c.id === editingCustomer.id
              ? {
                  ...c,
                  ...payload,
                }
              : c
          )
        );

        showToast(`Customer "${formData.name.trim()}" updated successfully!`, "success");
      } else {
        // Add new customer
        const custCol = collection(db, "customers");
        const docRef = await addDoc(custCol, {
          ...payload,
          createdAt: serverTimestamp(),
        });

        const newCustomer: CustomerItem = {
          id: docRef.id,
          ...payload,
          createdAt: Timestamp.now(),
        };

        setCustomers((prev) => [newCustomer, ...prev.filter((c) => c.id !== newCustomer.id)]);
        setTotalCount((prev) => prev + 1);

        showToast(`Customer "${formData.name.trim()}" added successfully!`, "success");
      }

      setIsDrawerOpen(false);
    } catch (err: any) {
      console.error("Save error:", err);
      showToast("Error saving customer: " + (err.message || "Unknown error"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Customer
  const handleConfirmDelete = async () => {
    if (!deletingCustomer) return;

    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "customers", deletingCustomer.id));

      setCustomers((prev) => prev.filter((c) => c.id !== deletingCustomer.id));
      setTotalCount((prev) => Math.max(0, prev - 1));

      showToast(`Customer "${deletingCustomer.name}" deleted successfully!`, "success");
      setDeletingCustomer(null);
    } catch (err: any) {
      console.error("Delete error:", err);
      showToast("Error deleting customer: " + (err.message || "Unknown error"), "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Format timestamp helper
  const formatDate = (timestamp?: any) => {
    if (!timestamp) return "—";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "—";
    }
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
              <Users size={18} />
            </div>
            <h1
              className="text-2xl text-[var(--color-text-primary)] tracking-tight"
              style={{ fontWeight: 500 }}
            >
              Customers
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
            Customer accounts, mobile contacts, billing addresses, and B2B GST tax profiles.
          </p>
        </div>

        {/* Actions: Refresh & Add Customer Button */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchCustomersData}
            title="Refresh list"
            disabled={isLoading}
            className="p-2 rounded-md border bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
            style={{
              borderColor: "var(--color-border-base)",
              color: "var(--color-text-secondary)",
            }}
          >
            <RotateCw size={15} className={isLoading ? "animate-spin" : ""} />
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-md text-white transition-opacity hover:opacity-90 font-normal shadow-xs cursor-pointer"
            style={{ backgroundColor: "var(--color-brand-primary)" }}
          >
            <Plus size={15} />
            <span>Add Customer</span>
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
            placeholder="Search by name, phone, city, GST..."
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
          Showing {paginatedCustomers.length} of {filteredCustomers.length} (Limit: 24/page)
        </div>
      </div>

      {/* Main Table / Grid List (Supabase Table Editor Grid Style) */}
      <div
        className="rounded-lg border bg-white overflow-hidden shadow-xs"
        style={{ borderColor: "var(--color-border-base)" }}
      >
        {isLoading && customers.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2
              size={24}
              className="animate-spin"
              style={{ color: "var(--color-brand-primary)" }}
            />
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Loading customers from database...
            </span>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center p-6">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                color: "var(--color-text-muted)",
              }}
            >
              <Users size={22} />
            </div>
            <h3
              className="text-sm text-[var(--color-text-primary)]"
              style={{ fontWeight: 500 }}
            >
              {searchQuery ? "No matching customers found" : "No customers added yet"}
            </h3>
            <p className="text-xs mt-1 max-w-sm" style={{ color: "var(--color-text-muted)" }}>
              {searchQuery
                ? "Try refining your search keyword or clearing the filter."
                : "Get started by adding your first retail or wholesale customer."}
            </p>
            {!searchQuery && (
              <button
                onClick={handleOpenAdd}
                className="mt-4 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md text-white font-normal cursor-pointer"
                style={{ backgroundColor: "var(--color-brand-primary)" }}
              >
                <Plus size={14} />
                <span>Add Customer Now</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto border-t" style={{ borderColor: "var(--color-border-base)" }}>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr
                className="border-b divide-x divide-slate-200 text-[11px] text-slate-700 select-none sticky top-0 z-10"
                style={{
                  backgroundColor: "var(--color-bg-subtle)",
                  borderColor: "var(--color-border-subtle)",
                }}
              >
                {/* Select All Checkbox */}
                <th className="px-3 py-2 text-center w-10 font-medium bg-slate-50/50">
                  <input
                    type="checkbox"
                    checked={
                      paginatedCustomers.length > 0 &&
                      paginatedCustomers.every((c) => selectedIds.has(c.id))
                    }
                    onChange={handleToggleSelectAll}
                    className="rounded border-slate-300 text-[var(--color-brand-primary)] focus:ring-0 cursor-pointer h-3.5 w-3.5"
                  />
                </th>

                {/* ID Column */}
                <th className="px-3.5 py-2 font-medium bg-slate-50/50 w-36">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-800">id</span>
                      <span className="text-[10px] font-mono text-slate-400">uuid</span>
                    </div>
                    <ChevronDown size={12} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>

                {/* Name */}
                <th className="px-3.5 py-2 font-medium bg-slate-50/50 min-w-[160px]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-800">name</span>
                      <span className="text-[10px] font-mono text-slate-400">text</span>
                    </div>
                    <ChevronDown size={12} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>

                {/* Mobile / Phone */}
                <th className="px-3.5 py-2 font-medium bg-slate-50/50 min-w-[130px]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-800">phone</span>
                      <span className="text-[10px] font-mono text-slate-400">varchar</span>
                    </div>
                    <ChevronDown size={12} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>

                {/* City */}
                <th className="px-3.5 py-2 font-medium bg-slate-50/50 min-w-[120px]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-800">city</span>
                      <span className="text-[10px] font-mono text-slate-400">varchar</span>
                    </div>
                    <ChevronDown size={12} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>

                {/* Email */}
                <th className="px-3.5 py-2 font-medium bg-slate-50/50 min-w-[160px]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-800">email</span>
                      <span className="text-[10px] font-mono text-slate-400">varchar</span>
                    </div>
                    <ChevronDown size={12} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>

                {/* Address */}
                <th className="px-3.5 py-2 font-medium bg-slate-50/50 min-w-[200px]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-800">address</span>
                      <span className="text-[10px] font-mono text-slate-400">text</span>
                    </div>
                    <ChevronDown size={12} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>

                {/* Created At */}
                <th className="px-3.5 py-2 font-medium bg-slate-50/50 w-28">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-800">created_at</span>
                      <span className="text-[10px] font-mono text-slate-400">date</span>
                    </div>
                    <ChevronDown size={12} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>

                {/* Actions Header */}
                <th className="px-3 py-2 font-medium text-right bg-slate-50/50 w-28">
                  <div className="flex items-center justify-end gap-1">
                    <span className="font-medium text-slate-800">actions</span>
                    <span className="text-[10px] font-mono text-slate-400">menu</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedCustomers.map((c) => {
                const isSelected = selectedIds.has(c.id);
                return (
                  <tr
                    key={c.id}
                    className={`divide-x divide-slate-200 transition-colors ${
                      isSelected
                        ? "bg-sky-50/60"
                        : "hover:bg-slate-50/80"
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectRow(c.id)}
                        className="rounded border-slate-300 text-[var(--color-brand-primary)] focus:ring-0 cursor-pointer h-3.5 w-3.5"
                      />
                    </td>

                    {/* ID with Arrow Button */}
                    <td className="px-3.5 py-2 font-mono text-[11px] text-slate-600">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate max-w-[90px]">{c.id}</span>
                        <button
                          onClick={() => setViewingCustomer(c)}
                          className="w-5 h-5 rounded flex items-center justify-center bg-slate-100 hover:bg-sky-50 text-slate-500 hover:text-[#348bdd] border border-slate-200/70 transition-colors cursor-pointer"
                          title="View customer specification"
                        >
                          <ArrowRight size={11} />
                        </button>
                      </div>
                    </td>

                    {/* Name */}
                    <td className="px-3.5 py-2 text-slate-900 font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 text-[11px] shrink-0 font-mono font-medium">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="truncate">{c.name}</span>
                            {c.isB2b && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-blue-50 text-[#348bdd] border border-blue-200">
                                B2B
                              </span>
                            )}
                          </div>
                          {c.gstNumber && (
                            <div className="text-[10px] font-mono text-slate-400">
                              GST: {c.gstNumber}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Mobile Phone */}
                    <td className="px-3.5 py-2 font-mono text-[11px] text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <Phone size={12} className="text-slate-400 shrink-0" />
                        <span>{c.phone}</span>
                      </div>
                    </td>

                    {/* City */}
                    <td className="px-3.5 py-2 text-slate-700 truncate max-w-[140px]">
                      {c.city ? (
                        <div className="flex items-center gap-1.5">
                          <Building size={12} className="text-slate-400 shrink-0" />
                          <span>{c.city}</span>
                        </div>
                      ) : (
                        <span className="font-mono text-slate-300 italic text-[11px]">NULL</span>
                      )}
                    </td>

                    {/* Email */}
                    <td className="px-3.5 py-2 font-mono text-[11px] text-slate-700 truncate max-w-[180px]">
                      {c.email ? (
                        <div className="flex items-center gap-1.5">
                          <Mail size={12} className="text-slate-400 shrink-0" />
                          <span>{c.email}</span>
                        </div>
                      ) : (
                        <span className="font-mono text-slate-300 italic text-[11px]">NULL</span>
                      )}
                    </td>

                    {/* Address */}
                    <td className="px-3.5 py-2 text-slate-600 truncate max-w-[220px]">
                      {c.address ? (
                        <div className="flex items-center gap-1.5">
                          <MapPin size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">{c.address}</span>
                        </div>
                      ) : (
                        <span className="font-mono text-slate-300 italic text-[11px]">NULL</span>
                      )}
                    </td>

                    {/* Created Date */}
                    <td className="px-3.5 py-2 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {formatDate(c.createdAt)}
                    </td>

                    {/* Actions: View, Edit, Delete with color-shaded icon buttons */}
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View - Sky blue */}
                        <button
                          onClick={() => setViewingCustomer(c)}
                          className="w-7 h-7 rounded-md flex items-center justify-center transition-all bg-sky-50 text-[#348bdd] hover:bg-sky-100 hover:text-[#2377c8] border border-sky-100 cursor-pointer shadow-2xs"
                          title="View customer details"
                        >
                          <Eye size={13} />
                        </button>

                        {/* Edit - Amber */}
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="w-7 h-7 rounded-md flex items-center justify-center transition-all bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 border border-amber-100 cursor-pointer shadow-2xs"
                          title="Edit customer"
                        >
                          <Edit2 size={13} />
                        </button>

                        {/* Delete - Rose */}
                        <button
                          onClick={() => setDeletingCustomer(c)}
                          className="w-7 h-7 rounded-md flex items-center justify-center transition-all bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 border border-rose-100 cursor-pointer shadow-2xs"
                          title="Delete customer"
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
        {!isLoading && filteredCustomers.length > 0 && (
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
                className="p-1.5 rounded border hover:bg-slate-50 transition-colors disabled:opacity-40 cursor-pointer"
                style={{ borderColor: "var(--color-border-base)" }}
              >
                <ChevronLeft size={15} />
              </button>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded border hover:bg-slate-50 transition-colors disabled:opacity-40 cursor-pointer"
                style={{ borderColor: "var(--color-border-base)" }}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Slide-over Offcanvas Drawer (Right) for Add / Edit */}
      <OffcanvasDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingCustomer ? "Edit Customer" : "Add New Customer"}
        subtitle={
          editingCustomer
            ? `Update contact and address details for "${editingCustomer.name}"`
            : "Fill in the customer specifications to create a new record."
        }
      >
        <form onSubmit={handleSaveCustomer} className="space-y-4">
          {/* Customer Avatar & Profile Preview Card */}
          <div className="flex items-center gap-3.5 p-3 rounded-lg border bg-slate-50/70 border-slate-200">
            <div className="w-12 h-12 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-700 font-medium text-base shadow-2xs font-mono shrink-0">
              {formData.name.trim() ? (
                formData.name.trim().charAt(0).toUpperCase()
              ) : (
                <User size={20} className="text-slate-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-slate-900 truncate">
                {formData.name.trim() || "New Customer Record"}
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                {formData.phone.trim() || "Mobile contact pending"}
              </div>
            </div>
          </div>

          <div className="border-t my-2" style={{ borderColor: "var(--color-border-subtle)" }} />

          {/* Mandatory Fields Group */}
          <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-wider font-mono text-slate-400">
              Mandatory Details
            </div>

            {/* Customer Name */}
            <div>
              <label
                className="block text-xs uppercase tracking-wider mb-1"
                style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
              >
                Customer Name <span className="text-red-500">*</span>
              </label>
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-md border bg-white focus-within:ring-1 focus-within:ring-[var(--color-brand-primary)]"
                style={{
                  borderColor: formErrors.name ? "#f87171" : "var(--color-border-base)",
                }}
              >
                <User size={14} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="e.g. Ramesh Chandra"
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

            {/* Mobile Number */}
            <div>
              <label
                className="block text-xs uppercase tracking-wider mb-1"
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
                <Phone size={14} className="text-slate-400 shrink-0" />
                <input
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => {
                    setFormData({ ...formData, phone: e.target.value });
                    if (formErrors.phone) setFormErrors({ ...formErrors, phone: "" });
                  }}
                  className="w-full text-xs bg-transparent focus:outline-none font-mono"
                  style={{ color: "var(--color-text-primary)" }}
                />
              </div>
              {formErrors.phone && (
                <p className="text-[11px] text-red-500 mt-1">{formErrors.phone}</p>
              )}
            </div>
          </div>

          <div className="border-t my-2" style={{ borderColor: "var(--color-border-subtle)" }} />

          {/* Optional Details Group */}
          <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-wider font-mono text-slate-400">
              Optional Details & Address
            </div>

            {/* City & Email Side by Side */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="block text-xs uppercase tracking-wider mb-1"
                  style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
                >
                  City <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <div
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md border bg-white focus-within:ring-1 focus-within:ring-[var(--color-brand-primary)]"
                  style={{ borderColor: "var(--color-border-base)" }}
                >
                  <Building size={14} className="text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="e.g. Chirala"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full text-xs bg-transparent focus:outline-none"
                    style={{ color: "var(--color-text-primary)" }}
                  />
                </div>
              </div>

              <div>
                <label
                  className="block text-xs uppercase tracking-wider mb-1"
                  style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
                >
                  Email <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <div
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md border bg-white focus-within:ring-1 focus-within:ring-[var(--color-brand-primary)]"
                  style={{ borderColor: "var(--color-border-base)" }}
                >
                  <Mail size={14} className="text-slate-400 shrink-0" />
                  <input
                    type="email"
                    placeholder="client@mail.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full text-xs bg-transparent focus:outline-none font-mono"
                    style={{ color: "var(--color-text-primary)" }}
                  />
                </div>
              </div>
            </div>

            {/* Address Multiline */}
            <div>
              <label
                className="block text-xs uppercase tracking-wider mb-1"
                style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
              >
                Delivery / Billing Address <span className="text-slate-400 font-normal lowercase">(optional)</span>
              </label>
              <div
                className="flex gap-2 p-2.5 rounded-md border bg-white focus-within:ring-1 focus-within:ring-[var(--color-brand-primary)]"
                style={{ borderColor: "var(--color-border-base)" }}
              >
                <MapPin size={15} className="text-slate-400 shrink-0 mt-0.5" />
                <textarea
                  rows={2}
                  placeholder="e.g. Trunk Road, Opp. Municipal High School, Chirala, AP"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full text-xs bg-transparent focus:outline-none resize-none"
                  style={{ color: "var(--color-text-primary)" }}
                />
              </div>
            </div>

            {/* B2B Customer Toggle */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-medium text-slate-800 flex items-center gap-1.5 cursor-pointer">
                    <Building size={14} className="text-[#348bdd]" />
                    <span>Is B2B Customer?</span>
                  </label>
                  <p className="text-[10px] text-slate-400">Enable for business invoices with GSTIN</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, isB2b: !p.isB2b }))}
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                    formData.isB2b ? "bg-[#348bdd]" : "bg-slate-300"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      formData.isB2b ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {formData.isB2b && (
                <div className="animate-in fade-in duration-150">
                  <label className="block text-xs uppercase tracking-wider mb-1 font-medium text-slate-700">
                    GST Number (GSTIN) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 37AAAAA0000A1Z5"
                    value={formData.gstNumber}
                    onChange={(e) => {
                      setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() });
                      if (formErrors.gstNumber) setFormErrors({ ...formErrors, gstNumber: "" });
                    }}
                    className="w-full px-3 py-2 border rounded-md text-xs font-mono uppercase bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                    style={{ borderColor: formErrors.gstNumber ? "#f87171" : "var(--color-border-base)" }}
                  />
                  {formErrors.gstNumber && (
                    <p className="text-[11px] text-red-500 mt-1">{formErrors.gstNumber}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div
            className="pt-4 border-t flex items-center justify-end gap-2.5 sticky bottom-0 bg-white"
            style={{ borderColor: "var(--color-border-subtle)" }}
          >
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsDrawerOpen(false)}
              className="px-4 py-2 text-xs rounded-md border hover:bg-slate-50 transition-colors cursor-pointer"
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
              className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-md text-white transition-opacity hover:opacity-90 disabled:opacity-50 font-normal cursor-pointer shadow-xs"
              style={{ backgroundColor: "var(--color-brand-primary)" }}
            >
              {isSubmitting && <Loader2 size={13} className="animate-spin" />}
              <span>{editingCustomer ? "Update Customer" : "Save Customer"}</span>
            </button>
          </div>
        </form>
      </OffcanvasDrawer>

      {/* 5. View Details Modal */}
      <ViewDetailsModal
        isOpen={!!viewingCustomer}
        onClose={() => setViewingCustomer(null)}
        title={viewingCustomer?.name || "Customer Details"}
        badge="CUSTOMER ACCOUNT"
        fields={[
          { label: "CUSTOMER ID", value: viewingCustomer?.id },
          { label: "FULL NAME", value: viewingCustomer?.name },
          { label: "MOBILE PHONE", value: viewingCustomer?.phone },
          { label: "CITY", value: viewingCustomer?.city || "—" },
          { label: "EMAIL", value: viewingCustomer?.email || "—" },
          { label: "ADDRESS", value: viewingCustomer?.address || "—", colSpan: 2 },
          { label: "REGISTERED ON", value: formatDate(viewingCustomer?.createdAt) },
        ]}
      />

      {/* 6. Custom Confirmation Modal for Delete */}
      <ConfirmationModal
        isOpen={!!deletingCustomer}
        title="Delete Customer Account"
        message={`Are you sure you want to delete "${deletingCustomer?.name}"? All associated CRM records will be permanently removed.`}
        confirmText="Confirm Delete"
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingCustomer(null)}
      />
    </div>
  );
}
