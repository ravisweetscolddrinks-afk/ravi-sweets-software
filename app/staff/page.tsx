"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import OffcanvasDrawer from "@/components/OffcanvasDrawer";
import ConfirmationModal from "@/components/ConfirmationModal";
import ViewDetailsModal, { FieldItem } from "@/components/ViewDetailsModal";
import {
  UserCog,
  Plus,
  Search,
  Phone,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Edit2,
  Trash2,
  Loader2,
  RotateCw,
  Sparkles,
  Users,
  UserCheck,
  ShieldAlert,
  X,
  BadgeCheck,
  ShieldCheck,
  Factory,
  Boxes,
  LayoutDashboard,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Store,
  ArrowDownToLine,
  LineChart,
  Truck,
  Cpu,
  PackageCheck,
  Package,
  FolderTree,
  Wallet,
  CalendarCheck,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// TypeScript Interfaces
// ---------------------------------------------------------------------------

export interface StaffItem {
  id: string;
  name: string;
  mobile: string;
  mpin: string;
  role?: string;
  status: "Active" | "Inactive";
  // Access Control & Permissions
  accessibleMenus?: string[];
  manufacturingUnitIds?: string[];
  packingUnitIds?: string[];
  createdAt?: any;
  updatedAt?: any;
}

export interface MenuItemOption {
  id: string; // href identifier
  name: string; // human readable name
  category: string;
}

export interface UnitOption {
  id: string;
  name: string;
}

// All application menus that can be assigned to staff
export const AVAILABLE_MENUS: MenuItemOption[] = [
  // Sales & POS
  { id: "/pos", name: "POS Billing", category: "Sales & POS" },
  { id: "/walk-in-sales", name: "Walk In Sales", category: "Sales & POS" },
  { id: "/orders", name: "Orders", category: "Sales & POS" },
  { id: "/quotations", name: "Quotations", category: "Sales & POS" },

  // Portals
  { id: "/manufacturing-portal", name: "Manufacturing Portal", category: "Portals" },
  { id: "/packing-portal", name: "Packing Portal", category: "Portals" },

  // Inventory & Operations
  { id: "/store-stock-entry", name: "Store Stock Entry", category: "Inventory & Operations" },
  { id: "/manufacturing-stock-analysis", name: "Manufacturing Stock Analysis", category: "Inventory & Operations" },
  { id: "/vendor-manager", name: "Vendor Manager", category: "Inventory & Operations" },

  // Outlets & Units
  { id: "/stores", name: "Stores", category: "Outlets & Units" },
  { id: "/manufacturing-units", name: "Manufacturing Units", category: "Outlets & Units" },
  { id: "/packing-units", name: "Packing Units", category: "Outlets & Units" },

  // Catalog & CRM
  { id: "/customers", name: "Customers", category: "Catalog & CRM" },
  { id: "/products", name: "Products", category: "Catalog & CRM" },
  { id: "/product-categories", name: "Product Categories", category: "Catalog & CRM" },

  // Human Resources
  { id: "/staff", name: "Staff Management", category: "Human Resources" },
  { id: "/employees", name: "Employees", category: "Human Resources" },
  { id: "/payroll", name: "Payroll", category: "Human Resources" },
  { id: "/employee-attendance", name: "Employee Attendance", category: "Human Resources" },

  // Overview
  { id: "/", name: "Dashboard", category: "Overview" },
];

const DEFAULT_ROLES = [
  "Cashier / POS",
  "Counter Sales",
  "Store Associate",
  "Supervisor / Manager",
  "Packing Staff",
  "Kitchen / Chef",
];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function StaffPage() {
  const { showToast } = useToast();

  // State
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dynamic Units for multi-select
  const [manufacturingUnits, setManufacturingUnits] = useState<UnitOption[]>([]);
  const [packingUnits, setPackingUnits] = useState<UnitOption[]>([]);

  // Revealing MPIN state: Set of staff IDs whose MPIN is currently visible
  const [visibleMpins, setVisibleMpins] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Drawer & Modals State
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [editingStaff, setEditingStaff] = useState<StaffItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [deletingStaff, setDeletingStaff] = useState<StaffItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [viewingDetails, setViewingDetails] = useState<{
    title: string;
    badge?: string;
    fields: FieldItem[];
  } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    mpin: "",
    role: "Counter Sales",
    status: "Active" as "Active" | "Inactive",
    accessibleMenus: [] as string[],
    manufacturingUnitIds: [] as string[],
    packingUnitIds: [] as string[],
  });
  const [isFormMpinVisible, setIsFormMpinVisible] = useState<boolean>(true);
  const [menuSearchFilter, setMenuSearchFilter] = useState<string>("");

  // Real-time listener for Staff
  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, "staff"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: StaffItem[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<StaffItem, "id">),
        }));
        setStaffList(list);
        setIsLoading(false);
      },
      (err) => {
        console.error("Realtime staff error:", err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Real-time listener for Manufacturing & Packing Units
  useEffect(() => {
    // 1. Manufacturing Units
    const unsubMfg = onSnapshot(
      query(collection(db, "manufacturing_units"), orderBy("name", "asc")),
      (snap) => {
        setManufacturingUnits(
          snap.docs.map((d) => ({
            id: d.id,
            name: (d.data().name as string) || "Unnamed Mfg Unit",
          }))
        );
      },
      (err) => console.warn("Realtime mfg units error:", err)
    );

    // 2. Packing Units
    const unsubPack = onSnapshot(
      query(collection(db, "packing_units"), orderBy("name", "asc")),
      (snap) => {
        setPackingUnits(
          snap.docs.map((d) => ({
            id: d.id,
            name: (d.data().name as string) || "Unnamed Packing Unit",
          }))
        );
      },
      (err) => console.warn("Realtime pack units error:", err)
    );

    return () => {
      unsubMfg();
      unsubPack();
    };
  }, []);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((staff) => {
      // Status filter
      if (statusFilter !== "all" && staff.status !== statusFilter) {
        return false;
      }

      // Search query (name, mobile, or role)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (staff.name || "").toLowerCase().includes(q);
        const matchMobile = (staff.mobile || "").toLowerCase().includes(q);
        const matchRole = (staff.role || "").toLowerCase().includes(q);
        if (!matchName && !matchMobile && !matchRole) return false;
      }

      return true;
    });
  }, [staffList, searchQuery, statusFilter]);

  // Summary counts
  const stats = useMemo(() => {
    const total = staffList.length;
    const active = staffList.filter((s) => s.status === "Active").length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [staffList]);

  // Toggle MPIN visibility in table
  const handleToggleMpinVisibility = (id: string) => {
    setVisibleMpins((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Copy MPIN to clipboard
  const handleCopyMpin = (id: string, mpin: string) => {
    if (!mpin) return;
    navigator.clipboard.writeText(mpin);
    setCopiedId(id);
    showToast("MPIN copied to clipboard!", "success");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Generate a random 4-digit numeric MPIN
  const generateRandomMpin = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  // Open Drawer in Create mode
  const handleOpenAddStaff = () => {
    setEditingStaff(null);
    setFormData({
      name: "",
      mobile: "",
      mpin: generateRandomMpin(),
      role: "Counter Sales",
      status: "Active",
      accessibleMenus: ["/pos", "/walk-in-sales", "/orders"], // default sales menu access
      manufacturingUnitIds: [],
      packingUnitIds: [],
    });
    setIsFormMpinVisible(true);
    setMenuSearchFilter("");
    setIsDrawerOpen(true);
  };

  // Open Drawer in Edit mode
  const handleOpenEditStaff = (staff: StaffItem) => {
    setEditingStaff(staff);
    setFormData({
      name: staff.name,
      mobile: staff.mobile,
      mpin: staff.mpin,
      role: staff.role || "Counter Sales",
      status: staff.status || "Active",
      accessibleMenus: staff.accessibleMenus || [],
      manufacturingUnitIds: staff.manufacturingUnitIds || [],
      packingUnitIds: staff.packingUnitIds || [],
    });
    setIsFormMpinVisible(false);
    setMenuSearchFilter("");
    setIsDrawerOpen(true);
  };

  // Menu selection handlers
  const handleToggleMenu = (menuId: string) => {
    setFormData((prev) => {
      const current = prev.accessibleMenus || [];
      const next = current.includes(menuId)
        ? current.filter((m) => m !== menuId)
        : [...current, menuId];
      return { ...prev, accessibleMenus: next };
    });
  };

  const handleSelectAllMenus = () => {
    setFormData((prev) => ({
      ...prev,
      accessibleMenus: AVAILABLE_MENUS.map((m) => m.id),
    }));
  };

  const handleClearAllMenus = () => {
    setFormData((prev) => ({
      ...prev,
      accessibleMenus: [],
    }));
  };

  // Preset role menu selector
  const handleApplyPreset = (preset: "pos" | "kitchen" | "packing" | "all") => {
    if (preset === "pos") {
      setFormData((prev) => ({
        ...prev,
        accessibleMenus: ["/pos", "/walk-in-sales", "/orders"],
      }));
    } else if (preset === "kitchen") {
      setFormData((prev) => ({
        ...prev,
        accessibleMenus: ["/manufacturing-portal", "/manufacturing-stock-analysis"],
        // auto-select all mfg units if not selected
        manufacturingUnitIds:
          prev.manufacturingUnitIds.length > 0
            ? prev.manufacturingUnitIds
            : manufacturingUnits.map((u) => u.id),
      }));
    } else if (preset === "packing") {
      setFormData((prev) => ({
        ...prev,
        accessibleMenus: ["/packing-portal"],
        // auto-select all pack units if not selected
        packingUnitIds:
          prev.packingUnitIds.length > 0
            ? prev.packingUnitIds
            : packingUnits.map((u) => u.id),
      }));
    } else if (preset === "all") {
      setFormData((prev) => ({
        ...prev,
        accessibleMenus: AVAILABLE_MENUS.map((m) => m.id),
        manufacturingUnitIds: manufacturingUnits.map((u) => u.id),
        packingUnitIds: packingUnits.map((u) => u.id),
      }));
    }
  };

  // Manufacturing Unit selection handlers
  const handleToggleMfgUnit = (unitId: string) => {
    setFormData((prev) => {
      const current = prev.manufacturingUnitIds || [];
      const next = current.includes(unitId)
        ? current.filter((id) => id !== unitId)
        : [...current, unitId];
      return { ...prev, manufacturingUnitIds: next };
    });
  };

  const handleSelectAllMfgUnits = () => {
    setFormData((prev) => ({
      ...prev,
      manufacturingUnitIds: manufacturingUnits.map((u) => u.id),
    }));
  };

  const handleClearAllMfgUnits = () => {
    setFormData((prev) => ({
      ...prev,
      manufacturingUnitIds: [],
    }));
  };

  // Packing Unit selection handlers
  const handleTogglePackUnit = (unitId: string) => {
    setFormData((prev) => {
      const current = prev.packingUnitIds || [];
      const next = current.includes(unitId)
        ? current.filter((id) => id !== unitId)
        : [...current, unitId];
      return { ...prev, packingUnitIds: next };
    });
  };

  const handleSelectAllPackUnits = () => {
    setFormData((prev) => ({
      ...prev,
      packingUnitIds: packingUnits.map((u) => u.id),
    }));
  };

  const handleClearAllPackUnits = () => {
    setFormData((prev) => ({
      ...prev,
      packingUnitIds: [],
    }));
  };

  // Save Staff (Add or Edit)
  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showToast("Staff Name is mandatory", "error");
      return;
    }

    const cleanMobile = formData.mobile.replace(/[^0-9]/g, "");
    if (!cleanMobile) {
      showToast("Mobile Number is mandatory", "error");
      return;
    }

    const cleanMpin = formData.mpin.trim();
    if (!cleanMpin) {
      showToast("MPIN is mandatory", "error");
      return;
    }

    if (cleanMpin.length < 4) {
      showToast("MPIN must be at least 4 digits", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        mobile: cleanMobile,
        mpin: cleanMpin,
        role: formData.role.trim() || "Staff",
        status: formData.status,
        accessibleMenus: formData.accessibleMenus || [],
        manufacturingUnitIds: formData.manufacturingUnitIds || [],
        packingUnitIds: formData.packingUnitIds || [],
        updatedAt: serverTimestamp(),
      };

      if (editingStaff) {
        // Update existing staff
        await updateDoc(doc(db, "staff", editingStaff.id), payload);
        showToast(`Staff "${payload.name}" updated successfully!`, "success");
      } else {
        // Add new staff
        await addDoc(collection(db, "staff"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        showToast(`Staff "${payload.name}" created with portal permissions!`, "success");
      }

      setIsDrawerOpen(false);
    } catch (err: any) {
      console.error("Save staff error:", err);
      showToast("Error saving staff: " + (err.message || "Unknown error"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick toggle active / inactive status
  const handleToggleStatus = async (staff: StaffItem) => {
    const nextStatus = staff.status === "Active" ? "Inactive" : "Active";
    try {
      await updateDoc(doc(db, "staff", staff.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      showToast(`Staff "${staff.name}" marked as ${nextStatus}`, "info");
    } catch (err: any) {
      showToast("Failed to update status: " + err.message, "error");
    }
  };

  // Delete staff confirmation
  const handleConfirmDelete = async () => {
    if (!deletingStaff) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "staff", deletingStaff.id));
      showToast(`Staff "${deletingStaff.name}" deleted successfully`, "info");
      setDeletingStaff(null);
    } catch (err: any) {
      showToast("Error deleting staff: " + err.message, "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Load sample staff members for immediate testing
  const handleSeedSampleStaff = async () => {
    try {
      showToast("Adding sample staff members...", "info");
      const mfgAll = manufacturingUnits.map((u) => u.id);
      const packAll = packingUnits.map((u) => u.id);

      const samples = [
        {
          name: "Ramesh Babu",
          mobile: "9848011223",
          mpin: "1234",
          role: "Cashier / POS",
          status: "Active",
          accessibleMenus: ["/pos", "/walk-in-sales", "/orders"],
          manufacturingUnitIds: [],
          packingUnitIds: [],
        },
        {
          name: "Sita Kumari",
          mobile: "9848022334",
          mpin: "4567",
          role: "Packing Staff",
          status: "Active",
          accessibleMenus: ["/packing-portal"],
          manufacturingUnitIds: [],
          packingUnitIds: packAll.slice(0, 2),
        },
        {
          name: "Venkata Rao",
          mobile: "9848033445",
          mpin: "7890",
          role: "Supervisor / Manager",
          status: "Active",
          accessibleMenus: AVAILABLE_MENUS.map((m) => m.id),
          manufacturingUnitIds: mfgAll,
          packingUnitIds: packAll,
        },
      ];

      for (const item of samples) {
        await addDoc(collection(db, "staff"), {
          ...item,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      showToast("3 sample staff members loaded with permissions!", "success");
    } catch (e: any) {
      showToast("Failed to seed: " + e.message, "error");
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

  // Helper map for unit names
  const mfgUnitNameMap = useMemo(() => {
    const map = new Map<string, string>();
    manufacturingUnits.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [manufacturingUnits]);

  const packUnitNameMap = useMemo(() => {
    const map = new Map<string, string>();
    packingUnits.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [packingUnits]);

  // Grouped available menus for clean categorized layout
  const groupedMenus = useMemo(() => {
    const groups: { [cat: string]: MenuItemOption[] } = {};
    AVAILABLE_MENUS.forEach((menu) => {
      if (menuSearchFilter.trim()) {
        const q = menuSearchFilter.toLowerCase();
        if (!menu.name.toLowerCase().includes(q) && !menu.category.toLowerCase().includes(q)) {
          return;
        }
      }
      if (!groups[menu.category]) {
        groups[menu.category] = [];
      }
      groups[menu.category].push(menu);
    });
    return groups;
  }, [menuSearchFilter]);

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
      {/* ===================================================================== */}
      {/* 1. Header & Actions                                                   */}
      {/* ===================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#348bdd] to-indigo-500 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
            <UserCog size={22} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Staff Management
            </h1>
            <p className="text-xs text-slate-500">
              Manage staff profiles, security MPINs, application menu access, and portal unit permissions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {staffList.length === 0 && (
            <button
              onClick={handleSeedSampleStaff}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Add sample staff members to test"
            >
              <Sparkles size={13} />
              <span>Load Sample Staff</span>
            </button>
          )}

          <button
            onClick={handleOpenAddStaff}
            className="px-4 py-2 text-xs font-medium rounded-lg text-white shadow-sm flex items-center gap-1.5 cursor-pointer transition-all hover:opacity-95"
            style={{ backgroundColor: "var(--color-brand-primary)" }}
          >
            <Plus size={15} />
            <span>Add Staff</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. Quick Stats Cards                                                  */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Users size={13} className="text-slate-400" />
            <span>Total Staff</span>
          </div>
          <div className="text-xl md:text-2xl font-bold text-slate-900 font-mono">
            {stats.total}
          </div>
          <p className="text-[10px] text-slate-400">Registered staff members</p>
        </div>

        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 shadow-2xs space-y-1">
          <div className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
            <UserCheck size={13} className="text-emerald-500" />
            <span>Active Staff</span>
          </div>
          <div className="text-xl md:text-2xl font-bold text-emerald-700 font-mono">
            {stats.active}
          </div>
          <p className="text-[10px] text-emerald-600 font-medium">Authorized for portal access</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldAlert size={13} className="text-slate-400" />
            <span>Inactive</span>
          </div>
          <div className="text-xl md:text-2xl font-bold text-slate-600 font-mono">
            {stats.inactive}
          </div>
          <p className="text-[10px] text-slate-400">Suspended or revoked</p>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. Search & Filters                                                   */}
      {/* ===================================================================== */}
      <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search staff by name, mobile number, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] transition-all text-slate-800 placeholder-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
            {[
              { id: "all", label: "All" },
              { id: "Active", label: "Active" },
              { id: "Inactive", label: "Inactive" },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setStatusFilter(s.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                  statusFilter === s.id
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-500 font-medium whitespace-nowrap pl-2 border-l border-slate-200">
            {filteredStaff.length} staff
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. Staff List Table                                                   */}
      {/* ===================================================================== */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium select-none">
              <tr>
                <th className="py-2.5 px-3.5 text-[10px] uppercase tracking-wider">Staff Name</th>
                <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider">Mobile Number</th>
                <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider">Security MPIN</th>
                <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider">Role</th>
                <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider">Access Permissions</th>
                <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider text-center">Status</th>
                <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider">Added On</th>
                <th className="py-2.5 px-3.5 text-[10px] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 size={24} className="animate-spin mx-auto text-[#348bdd] mb-2" />
                    <span className="text-xs">Loading staff records...</span>
                  </td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <UserCog size={30} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-medium text-slate-600">No staff members found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Click &quot;Add Staff&quot; above to configure staff access and security MPIN
                    </p>
                  </td>
                </tr>
              ) : (
                filteredStaff.map((staff) => {
                  const isMpinVisible = visibleMpins.has(staff.id);
                  const isCopied = copiedId === staff.id;
                  const menuCount = staff.accessibleMenus?.length || 0;
                  const mfgCount = staff.manufacturingUnitIds?.length || 0;
                  const packCount = staff.packingUnitIds?.length || 0;

                  return (
                    <tr key={staff.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Staff Name with Initial Avatar */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-100 to-indigo-100 text-[#348bdd] font-bold flex items-center justify-center text-xs shrink-0 border border-sky-200/60 shadow-2xs">
                            {(staff.name || "S").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 block text-xs">
                              {staff.name}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Mobile Number */}
                      <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-700">
                        <a
                          href={`tel:${staff.mobile}`}
                          className="inline-flex items-center gap-1.5 hover:text-[#348bdd] hover:underline"
                        >
                          <Phone size={11} className="text-slate-400" />
                          <span>{staff.mobile}</span>
                        </a>
                      </td>

                      {/* Security MPIN (Show/Hide Toggle & Copy) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-800">
                          <KeyRound size={11} className="text-slate-400 shrink-0" />
                          <span className="font-mono text-xs font-bold tracking-wider">
                            {isMpinVisible ? staff.mpin : "••••"}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleMpinVisibility(staff.id)}
                            className="p-0.5 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer ml-1"
                            title={isMpinVisible ? "Hide MPIN" : "Reveal MPIN"}
                          >
                            {isMpinVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyMpin(staff.id, staff.mpin)}
                            className="p-0.5 text-slate-400 hover:text-[#348bdd] rounded transition-colors cursor-pointer"
                            title="Copy MPIN"
                          >
                            {isCopied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          </button>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200">
                          {staff.role || "Staff"}
                        </span>
                      </td>

                      {/* Access & Permissions Badges */}
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {/* Menus count */}
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-50 text-[#348bdd] font-medium text-[10px] border border-sky-200">
                            <ShieldCheck size={10} />
                            <span>{menuCount} Menus</span>
                          </span>

                          {/* Mfg units count */}
                          {mfgCount > 0 && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium text-[10px] border border-amber-200"
                              title={staff.manufacturingUnitIds
                                ?.map((id) => mfgUnitNameMap.get(id) || id)
                                .join(", ")}
                            >
                              <Factory size={10} />
                              <span>{mfgCount} Mfg Unit{mfgCount === 1 ? "" : "s"}</span>
                            </span>
                          )}

                          {/* Packing units count */}
                          {packCount > 0 && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-medium text-[10px] border border-purple-200"
                              title={staff.packingUnitIds
                                ?.map((id) => packUnitNameMap.get(id) || id)
                                .join(", ")}
                            >
                              <Boxes size={10} />
                              <span>{packCount} Pack Unit{packCount === 1 ? "" : "s"}</span>
                            </span>
                          )}

                          {menuCount === 0 && mfgCount === 0 && packCount === 0 && (
                            <span className="text-slate-400 text-[10px] italic">No permissions</span>
                          )}
                        </div>
                      </td>

                      {/* Status & Quick Toggle */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(staff)}
                          title="Click to toggle status"
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium border transition-transform active:scale-95 cursor-pointer ${
                            staff.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              staff.status === "Active" ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                          <span>{staff.status}</span>
                        </button>
                      </td>

                      {/* Created On */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {formatDate(staff.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Details */}
                          <button
                            onClick={() =>
                              setViewingDetails({
                                title: `Staff Details: ${staff.name}`,
                                badge: staff.status,
                                fields: [
                                  { label: "STAFF NAME", value: staff.name },
                                  { label: "MOBILE NUMBER", value: staff.mobile },
                                  {
                                    label: "SECURITY MPIN",
                                    value: (
                                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                        {staff.mpin}
                                      </span>
                                    ),
                                  },
                                  { label: "ROLE / DESIGNATION", value: staff.role || "Staff" },
                                  { label: "LOGIN STATUS", value: staff.status },
                                  { label: "ADDED ON", value: formatDate(staff.createdAt) },
                                  {
                                    label: "ACCESSIBLE APP MENUS",
                                    colSpan: 2,
                                    value:
                                      staff.accessibleMenus && staff.accessibleMenus.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5">
                                          {staff.accessibleMenus.map((menuId) => {
                                            const menu = AVAILABLE_MENUS.find((m) => m.id === menuId);
                                            return (
                                              <span
                                                key={menuId}
                                                className="px-2 py-1 rounded bg-sky-50 text-sky-800 border border-sky-200 text-xs font-medium"
                                              >
                                                {menu?.name || menuId}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <span className="text-slate-400 italic">No menu access granted</span>
                                      ),
                                  },
                                  {
                                    label: "MANUFACTURING PORTAL UNITS ACCESS",
                                    colSpan: 2,
                                    value:
                                      staff.manufacturingUnitIds && staff.manufacturingUnitIds.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5">
                                          {staff.manufacturingUnitIds.map((id) => (
                                            <span
                                              key={id}
                                              className="px-2 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 text-xs font-medium flex items-center gap-1"
                                            >
                                              <Factory size={11} />
                                              <span>{mfgUnitNameMap.get(id) || id}</span>
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-slate-400 italic">No manufacturing units assigned</span>
                                      ),
                                  },
                                  {
                                    label: "PACKING PORTAL UNITS ACCESS",
                                    colSpan: 2,
                                    value:
                                      staff.packingUnitIds && staff.packingUnitIds.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5">
                                          {staff.packingUnitIds.map((id) => (
                                            <span
                                              key={id}
                                              className="px-2 py-1 rounded bg-purple-50 text-purple-800 border border-purple-200 text-xs font-medium flex items-center gap-1"
                                            >
                                              <Boxes size={11} />
                                              <span>{packUnitNameMap.get(id) || id}</span>
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-slate-400 italic">No packing units assigned</span>
                                      ),
                                  },
                                ],
                              })
                            }
                            className="w-7 h-7 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer transition-colors"
                            title="View staff details & permissions"
                          >
                            <Eye size={12} />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => handleOpenEditStaff(staff)}
                            className="w-7 h-7 rounded flex items-center justify-center bg-slate-100 hover:bg-sky-50 hover:text-[#348bdd] text-slate-600 cursor-pointer transition-colors"
                            title="Edit staff & permissions"
                          >
                            <Edit2 size={12} />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setDeletingStaff(staff)}
                            className="w-7 h-7 rounded flex items-center justify-center bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 cursor-pointer transition-colors"
                            title="Delete staff"
                          >
                            <Trash2 size={12} />
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
      </div>

      {/* ===================================================================== */}
      {/* DRAWER: ADD / EDIT STAFF WITH PERMISSIONS (WIDTH: max-w-xl)           */}
      {/* ===================================================================== */}
      <OffcanvasDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        width="max-w-xl"
        title={editingStaff ? `Edit Staff: ${editingStaff.name}` : "Add New Staff"}
        subtitle="Configure staff profile, security MPIN, menu access, and portal units permissions"
      >
        <form onSubmit={handleSaveStaff} className="space-y-5 p-5">
          {/* Section 1: Staff Credentials */}
          <div className="space-y-3 pb-4 border-b border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <UserCog size={14} className="text-[#348bdd]" />
              <span>1. Basic Staff Credentials</span>
            </h3>

            {/* Staff Name */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Staff Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Babu"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] text-slate-800"
              />
            </div>

            {/* Mobile & MPIN */}
            <div className="grid grid-cols-2 gap-3">
              {/* Mobile Number */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone
                    size={13}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="10-digit number"
                    value={formData.mobile}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      setFormData({ ...formData, mobile: val });
                    }}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] font-mono text-slate-800"
                  />
                </div>
              </div>

              {/* Security MPIN */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">
                    MPIN <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, mpin: generateRandomMpin() })}
                    className="text-[10px] text-[#348bdd] hover:underline font-medium cursor-pointer"
                  >
                    Auto Generate
                  </button>
                </div>
                <div className="relative">
                  <KeyRound
                    size={13}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type={isFormMpinVisible ? "text" : "password"}
                    required
                    maxLength={6}
                    placeholder="4-6 digit PIN"
                    value={formData.mpin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      setFormData({ ...formData, mpin: val });
                    }}
                    className="w-full pl-9 pr-8 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] font-mono tracking-widest text-slate-900 font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setIsFormMpinVisible(!isFormMpinVisible)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    title={isFormMpinVisible ? "Hide PIN" : "Show PIN"}
                  >
                    {isFormMpinVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Role & Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Role / Department
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] text-slate-800 bg-white"
                >
                  {DEFAULT_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Account Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as "Active" | "Inactive",
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] text-slate-800 bg-white font-medium"
                >
                  <option value="Active">Active (Can Login)</option>
                  <option value="Inactive">Inactive (Suspended)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Application Menu Access (Multi-select) */}
          <div className="space-y-3 pb-4 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-[#348bdd]" />
                  <span>2. Application Menus Access</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Select which sidebar navigation menus this staff member can view
                </p>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleApplyPreset("pos")}
                  className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded cursor-pointer"
                  title="Only POS, Walk-in, Orders"
                >
                  POS
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset("kitchen")}
                  className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded cursor-pointer"
                  title="Manufacturing Portal & Stock"
                >
                  Kitchen
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset("packing")}
                  className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded cursor-pointer"
                  title="Packing Portal"
                >
                  Packing
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset("all")}
                  className="px-2 py-0.5 text-[10px] font-medium bg-sky-50 text-[#348bdd] border border-sky-200 hover:bg-sky-100 rounded cursor-pointer"
                  title="Grant All Menus"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={handleClearAllMenus}
                  className="px-2 py-0.5 text-[10px] font-medium text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Menu Search Filter */}
            <div className="relative">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Filter menus..."
                value={menuSearchFilter}
                onChange={(e) => setMenuSearchFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800"
              />
            </div>

            {/* Categorized Multi-Select Grid */}
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 max-h-56 overflow-y-auto space-y-3">
              {Object.keys(groupedMenus).map((category) => (
                <div key={category} className="space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {category}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {groupedMenus[category].map((menu) => {
                      const isSelected = formData.accessibleMenus.includes(menu.id);
                      return (
                        <button
                          key={menu.id}
                          type="button"
                          onClick={() => handleToggleMenu(menu.id)}
                          className={`flex items-center gap-2 p-2 rounded-lg text-left text-xs transition-all border cursor-pointer ${
                            isSelected
                              ? "bg-white border-[#348bdd] shadow-2xs text-[#348bdd] font-semibold"
                              : "bg-white/80 border-slate-200 hover:border-slate-300 text-slate-700"
                          }`}
                        >
                          {isSelected ? (
                            <CheckSquare size={14} className="text-[#348bdd] shrink-0" />
                          ) : (
                            <Square size={14} className="text-slate-300 shrink-0" />
                          )}
                          <span className="truncate">{menu.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-500">
              <span>
                Selected: <strong>{formData.accessibleMenus.length}</strong> of{" "}
                {AVAILABLE_MENUS.length} menus
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllMenus}
                  className="text-[#348bdd] hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleClearAllMenus}
                  className="text-slate-400 hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Manufacturing Units Access (Multi-select) */}
          <div className="space-y-3 pb-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Factory size={14} className="text-amber-600" />
                  <span>3. Manufacturing Portal Units Access</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Select which manufacturing kitchen units this staff member can access
                </p>
              </div>

              <div className="flex items-center gap-2 text-[10px]">
                <button
                  type="button"
                  onClick={handleSelectAllMfgUnits}
                  className="text-[#348bdd] hover:underline font-medium cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={handleClearAllMfgUnits}
                  className="text-slate-400 hover:underline cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {manufacturingUnits.length === 0 ? (
              <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200 text-xs text-amber-800">
                No manufacturing units found in database yet. Add units in &quot;Manufacturing Units&quot; page.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50 max-h-40 overflow-y-auto">
                {manufacturingUnits.map((unit) => {
                  const isChecked = formData.manufacturingUnitIds.includes(unit.id);
                  return (
                    <button
                      key={unit.id}
                      type="button"
                      onClick={() => handleToggleMfgUnit(unit.id)}
                      className={`flex items-center gap-2 p-2 rounded-lg text-left text-xs transition-all border cursor-pointer ${
                        isChecked
                          ? "bg-amber-50/80 border-amber-300 text-amber-900 font-semibold shadow-2xs"
                          : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare size={14} className="text-amber-600 shrink-0" />
                      ) : (
                        <Square size={14} className="text-slate-300 shrink-0" />
                      )}
                      <span className="truncate">{unit.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="text-[11px] text-slate-500">
              Selected: <strong>{formData.manufacturingUnitIds.length}</strong> of{" "}
              {manufacturingUnits.length} manufacturing units
            </div>
          </div>

          {/* Section 4: Packing Units Access (Multi-select) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Boxes size={14} className="text-purple-600" />
                  <span>4. Packing Portal Units Access</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Select which packing units this staff member can access to pack orders
                </p>
              </div>

              <div className="flex items-center gap-2 text-[10px]">
                <button
                  type="button"
                  onClick={handleSelectAllPackUnits}
                  className="text-[#348bdd] hover:underline font-medium cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={handleClearAllPackUnits}
                  className="text-slate-400 hover:underline cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {packingUnits.length === 0 ? (
              <div className="p-3 bg-purple-50/50 rounded-lg border border-purple-200 text-xs text-purple-800">
                No packing units found in database yet. Add units in &quot;Packing Units&quot; page.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50 max-h-40 overflow-y-auto">
                {packingUnits.map((unit) => {
                  const isChecked = formData.packingUnitIds.includes(unit.id);
                  return (
                    <button
                      key={unit.id}
                      type="button"
                      onClick={() => handleTogglePackUnit(unit.id)}
                      className={`flex items-center gap-2 p-2 rounded-lg text-left text-xs transition-all border cursor-pointer ${
                        isChecked
                          ? "bg-purple-50/80 border-purple-300 text-purple-900 font-semibold shadow-2xs"
                          : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare size={14} className="text-purple-600 shrink-0" />
                      ) : (
                        <Square size={14} className="text-slate-300 shrink-0" />
                      )}
                      <span className="truncate">{unit.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="text-[11px] text-slate-500">
              Selected: <strong>{formData.packingUnitIds.length}</strong> of{" "}
              {packingUnits.length} packing units
            </div>
          </div>

          {/* Drawer Actions */}
          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsDrawerOpen(false)}
              className="px-4 py-2 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs rounded-lg text-white font-medium cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              style={{ backgroundColor: "var(--color-brand-primary)" }}
            >
              {isSubmitting && <Loader2 size={13} className="animate-spin" />}
              <span>{editingStaff ? "Update Staff" : "Save Details"}</span>
            </button>
          </div>
        </form>
      </OffcanvasDrawer>

      {/* ===================================================================== */}
      {/* VIEW DETAILS MODAL                                                    */}
      {/* ===================================================================== */}
      {viewingDetails && (
        <ViewDetailsModal
          isOpen={!!viewingDetails}
          onClose={() => setViewingDetails(null)}
          title={viewingDetails.title}
          badge={viewingDetails.badge}
          fields={viewingDetails.fields}
        />
      )}

      {/* ===================================================================== */}
      {/* DELETE CONFIRMATION MODAL                                             */}
      {/* ===================================================================== */}
      {deletingStaff && (
        <ConfirmationModal
          isOpen={!!deletingStaff}
          title="Delete Staff Member"
          message={`Are you sure you want to delete staff "${deletingStaff?.name}"? They will no longer be able to log in with their MPIN.`}
          confirmText="Confirm Delete"
          isDeleting={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingStaff(null)}
        />
      )}
    </div>
  );
}
