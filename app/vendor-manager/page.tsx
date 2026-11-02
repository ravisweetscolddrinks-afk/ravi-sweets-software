"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
import SearchableSelect, { SelectOption } from "@/components/SearchableSelect";
import CustomDatePicker from "@/components/CustomDatePicker";
import {
  Truck,
  Plus,
  Search,
  Phone,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Edit2,
  Trash2,
  Eye,
  ArrowRight,
  Loader2,
  RotateCw,
  ShoppingBag,
  Receipt,
  Users,
  DollarSign,
  CreditCard,
  Building,
  FileText,
  ChevronDown,
  Sparkles,
  Package,
  Layers,
  ArrowUpRight,
  Filter,
} from "lucide-react";

// ---------------------------------------------------------------------------
// TypeScript Interfaces
// ---------------------------------------------------------------------------

export interface VendorItem {
  id: string;
  name: string;
  mobile: string;
  address: string;
  email?: string;
  gstNumber?: string;
  notes?: string;
  status: "Active" | "Inactive";
  createdAt?: any;
  updatedAt?: any;
}

export interface OrderItemLine {
  name: string;
  quantity: string;
}

export interface VendorOrderItem {
  id: string;
  orderId: string; // e.g. VO-20261102-001
  vendorId: string;
  vendorName: string;
  vendorMobile: string;
  vendorAddress?: string;
  items: OrderItemLine[];
  status: "New" | "Received at store";
  orderDate: string; // YYYY-MM-DD
  deliveryDate?: string;
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface InvoiceItemLine {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  date: string;
  mode: string;
  note?: string;
}

export interface VendorInvoiceItem {
  id: string;
  invoiceNumber: string; // e.g. INV-1001
  vendorId: string;
  vendorName: string;
  vendorMobile: string;
  vendorAddress?: string;
  orderId?: string;
  items: InvoiceItemLine[];
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  paymentStatus: "Paid" | "Partial" | "Unpaid";
  paymentMode?: "Cash" | "UPI" | "Bank Transfer" | "Cheque";
  invoiceDate: string; // YYYY-MM-DD
  dueDate?: string;
  notes?: string;
  payments?: PaymentRecord[];
  createdAt?: any;
  updatedAt?: any;
}

export type ActiveTabType = "orders" | "due" | "vendors";

export type DateFilterType =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "custom"
  | "all";

// ---------------------------------------------------------------------------
// Main Component Wrapper with Suspense
// ---------------------------------------------------------------------------

export default function VendorManagerPage({
  initialTab,
}: {
  initialTab?: ActiveTabType;
}) {
  return (
    <Suspense
      fallback={
        <div className="p-8 flex items-center justify-center min-h-[400px]">
          <Loader2 className="animate-spin text-[#348bdd]" size={28} />
        </div>
      }
    >
      <VendorManagerContent initialTab={initialTab} />
    </Suspense>
  );
}

function VendorManagerContent({
  initialTab,
}: {
  initialTab?: ActiveTabType;
}) {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Tab State: tab from url ?tab=... or initialTab or "orders"
  const tabParam = searchParams.get("tab") as ActiveTabType | null;
  const [activeTab, setActiveTab] = useState<ActiveTabType>(
    initialTab || (tabParam && ["orders", "due", "vendors"].includes(tabParam) ? tabParam : "orders")
  );

  useEffect(() => {
    if (tabParam && ["orders", "due", "vendors"].includes(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tab: ActiveTabType) => {
    setActiveTab(tab);
    router.replace(`/vendor-manager?tab=${tab}`);
  };

  // -------------------------------------------------------------------------
  // Global Data State: Vendors, Vendor Orders, Vendor Invoices
  // -------------------------------------------------------------------------
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [vendorOrders, setVendorOrders] = useState<VendorOrderItem[]>([]);
  const [vendorInvoices, setVendorInvoices] = useState<VendorInvoiceItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Real-time listener for Vendors
  useEffect(() => {
    const qVendors = query(collection(db, "vendors"), orderBy("createdAt", "desc"));
    const unsubVendors = onSnapshot(
      qVendors,
      (snapshot) => {
        const list: VendorItem[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<VendorItem, "id">),
        }));
        setVendors(list);
      },
      (err) => console.warn("Realtime vendors error:", err)
    );

    // Real-time listener for Vendor Orders
    const qOrders = query(collection(db, "vendor_orders"), orderBy("createdAt", "desc"));
    const unsubOrders = onSnapshot(
      qOrders,
      (snapshot) => {
        const list: VendorOrderItem[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<VendorOrderItem, "id">),
        }));
        setVendorOrders(list);
      },
      (err) => console.warn("Realtime vendor orders error:", err)
    );

    // Real-time listener for Vendor Invoices
    const qInvoices = query(collection(db, "vendor_invoices"), orderBy("createdAt", "desc"));
    const unsubInvoices = onSnapshot(
      qInvoices,
      (snapshot) => {
        const list: VendorInvoiceItem[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<VendorInvoiceItem, "id">),
        }));
        setVendorInvoices(list);
        setIsLoading(false);
      },
      (err) => {
        console.warn("Realtime vendor invoices error:", err);
        setIsLoading(false);
      }
    );

    return () => {
      unsubVendors();
      unsubOrders();
      unsubInvoices();
    };
  }, []);

  // Today string helper (YYYY-MM-DD)
  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  };

  // -------------------------------------------------------------------------
  // Date Filtering Engine (Defaults to "today")
  // -------------------------------------------------------------------------
  const [orderDateFilter, setOrderDateFilter] = useState<DateFilterType>("today");
  const [orderCustomFrom, setOrderCustomFrom] = useState<string>(getTodayStr());
  const [orderCustomTo, setOrderCustomTo] = useState<string>(getTodayStr());
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("all");

  const [dueSearchQuery, setDueSearchQuery] = useState<string>("");
  const [dueStatusFilter, setDueStatusFilter] = useState<string>("all");
  const [dueVendorFilter, setDueVendorFilter] = useState<string>("all");

  const [vendorSearchQuery, setVendorSearchQuery] = useState<string>("");

  // Generic Date Checker
  const isDateInFilter = (dateStr: string, filter: DateFilterType, customFrom: string, customTo: string) => {
    if (!dateStr) return true;
    if (filter === "all") return true;

    const todayStr = getTodayStr();
    const now = new Date();

    const getOffsetDateStr = (days: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() + days);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
    };

    switch (filter) {
      case "today":
        return dateStr === todayStr;

      case "yesterday":
        return dateStr === getOffsetDateStr(-1);

      case "this_week": {
        const d = new Date(now);
        const day = d.getDay(); // 0 is Sunday
        d.setDate(d.getDate() - day);
        const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
          d.getDate()
        ).padStart(2, "0")}`;
        return dateStr >= start && dateStr <= todayStr;
      }

      case "last_week": {
        const dEnd = new Date(now);
        dEnd.setDate(dEnd.getDate() - dEnd.getDay() - 1);
        const end = `${dEnd.getFullYear()}-${String(dEnd.getMonth() + 1).padStart(2, "0")}-${String(
          dEnd.getDate()
        ).padStart(2, "0")}`;

        const dStart = new Date(dEnd);
        dStart.setDate(dStart.getDate() - 6);
        const start = `${dStart.getFullYear()}-${String(dStart.getMonth() + 1).padStart(2, "0")}-${String(
          dStart.getDate()
        ).padStart(2, "0")}`;

        return dateStr >= start && dateStr <= end;
      }

      case "this_month": {
        const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        return dateStr >= start && dateStr <= todayStr;
      }

      case "last_month": {
        const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const start = `${year}-${String(prevMonth + 1).padStart(2, "0")}-01`;
        const lastDay = new Date(year, prevMonth + 1, 0).getDate();
        const end = `${year}-${String(prevMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        return dateStr >= start && dateStr <= end;
      }

      case "this_year": {
        const start = `${now.getFullYear()}-01-01`;
        return dateStr >= start && dateStr <= todayStr;
      }

      case "last_year": {
        const year = now.getFullYear() - 1;
        const start = `${year}-01-01`;
        const end = `${year}-12-31`;
        return dateStr >= start && dateStr <= end;
      }

      case "custom":
        return dateStr >= customFrom && dateStr <= customTo;

      default:
        return true;
    }
  };

  // -------------------------------------------------------------------------
  // Filtering & Search
  // -------------------------------------------------------------------------

  // 1. Filtered Vendor Orders
  const filteredOrders = useMemo(() => {
    return vendorOrders.filter((order) => {
      // Date filter
      if (!isDateInFilter(order.orderDate, orderDateFilter, orderCustomFrom, orderCustomTo)) {
        return false;
      }

      // Status filter
      if (orderStatusFilter !== "all" && order.status !== orderStatusFilter) {
        return false;
      }

      // Search Query: Vendor Name, Mobile, or Order ID
      if (orderSearchQuery.trim()) {
        const q = orderSearchQuery.toLowerCase().trim();
        const matchName = (order.vendorName || "").toLowerCase().includes(q);
        const matchMobile = (order.vendorMobile || "").toLowerCase().includes(q);
        const matchId = (order.orderId || "").toLowerCase().includes(q);
        const matchItems = order.items?.some((i) => (i.name || "").toLowerCase().includes(q));
        if (!matchName && !matchMobile && !matchId && !matchItems) return false;
      }

      return true;
    });
  }, [vendorOrders, orderDateFilter, orderCustomFrom, orderCustomTo, orderStatusFilter, orderSearchQuery]);

  // 2. Filtered Vendor Invoices (Dues)
  const filteredInvoices = useMemo(() => {
    return vendorInvoices.filter((inv) => {
      // Status filter
      if (dueStatusFilter === "pending") {
        if (inv.paymentStatus === "Paid") return false;
      } else if (dueStatusFilter !== "all" && inv.paymentStatus !== dueStatusFilter) {
        return false;
      }

      // Vendor filter
      if (dueVendorFilter !== "all" && inv.vendorId !== dueVendorFilter) {
        return false;
      }

      // Search Query: Vendor Name, Mobile, Invoice Number, or Item Name
      if (dueSearchQuery.trim()) {
        const q = dueSearchQuery.toLowerCase().trim();
        const matchName = (inv.vendorName || "").toLowerCase().includes(q);
        const matchMobile = (inv.vendorMobile || "").toLowerCase().includes(q);
        const matchInvNo = (inv.invoiceNumber || "").toLowerCase().includes(q);
        const matchItems = inv.items?.some((i) => (i.name || "").toLowerCase().includes(q));
        if (!matchName && !matchMobile && !matchInvNo && !matchItems) return false;
      }

      return true;
    });
  }, [vendorInvoices, dueStatusFilter, dueVendorFilter, dueSearchQuery]);

  // 3. Filtered Vendors List
  const filteredVendors = useMemo(() => {
    if (!vendorSearchQuery.trim()) return vendors;
    const q = vendorSearchQuery.toLowerCase().trim();
    return vendors.filter(
      (v) =>
        (v.name || "").toLowerCase().includes(q) ||
        (v.mobile || "").toLowerCase().includes(q) ||
        (v.address || "").toLowerCase().includes(q) ||
        (v.email || "").toLowerCase().includes(q)
    );
  }, [vendors, vendorSearchQuery]);

  // Calculate Vendor Due summary numbers
  const dueSummary = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let pendingCount = 0;

    vendorInvoices.forEach((inv) => {
      const invTotal = Number(inv.totalAmount) || 0;
      const invPaid = Number(inv.paidAmount) || 0;
      const invPending = Math.max(0, invTotal - invPaid);

      totalInvoiced += invTotal;
      totalPaid += invPaid;
      totalPending += invPending;

      if (invPending > 0) {
        pendingCount++;
      }
    });

    return {
      totalInvoiced,
      totalPaid,
      totalPending,
      pendingCount,
    };
  }, [vendorInvoices]);

  // Map of total pending due per vendor
  const vendorPendingMap = useMemo(() => {
    const map = new Map<string, number>();
    vendorInvoices.forEach((inv) => {
      const due = Math.max(0, (Number(inv.totalAmount) || 0) - (Number(inv.paidAmount) || 0));
      map.set(inv.vendorId, (map.get(inv.vendorId) || 0) + due);
    });
    return map;
  }, [vendorInvoices]);

  // Map of total orders per vendor
  const vendorOrdersCountMap = useMemo(() => {
    const map = new Map<string, number>();
    vendorOrders.forEach((o) => {
      map.set(o.vendorId, (map.get(o.vendorId) || 0) + 1);
    });
    return map;
  }, [vendorOrders]);

  // -------------------------------------------------------------------------
  // Modals & Drawers State
  // -------------------------------------------------------------------------

  // 1. Vendor Modal / Drawer
  const [isVendorDrawerOpen, setIsVendorDrawerOpen] = useState<boolean>(false);
  const [editingVendor, setEditingVendor] = useState<VendorItem | null>(null);
  const [vendorFormData, setVendorFormData] = useState({
    name: "",
    mobile: "",
    address: "",
    email: "",
    gstNumber: "",
    notes: "",
  });

  // 2. Order Modal / Drawer
  const [isOrderDrawerOpen, setIsOrderDrawerOpen] = useState<boolean>(false);
  const [editingOrder, setEditingOrder] = useState<VendorOrderItem | null>(null);
  const [orderFormData, setOrderFormData] = useState({
    vendorId: "",
    orderDate: getTodayStr(),
    deliveryDate: "",
    status: "New" as "New" | "Received at store",
    notes: "",
  });
  const [orderItemsList, setOrderItemsList] = useState<OrderItemLine[]>([
    { name: "", quantity: "" },
  ]);

  // 3. Invoice / Due Modal / Drawer
  const [isInvoiceDrawerOpen, setIsInvoiceDrawerOpen] = useState<boolean>(false);
  const [editingInvoice, setEditingInvoice] = useState<VendorInvoiceItem | null>(null);
  const [invoiceFormData, setInvoiceFormData] = useState({
    vendorId: "",
    orderId: "",
    invoiceNumber: "",
    invoiceDate: getTodayStr(),
    dueDate: "",
    paidAmount: 0,
    paymentMode: "Cash" as "Cash" | "UPI" | "Bank Transfer" | "Cheque",
    notes: "",
  });
  const [invoiceItemsList, setInvoiceItemsList] = useState<InvoiceItemLine[]>([
    { name: "", quantity: 1, price: 0, total: 0 },
  ]);

  // 4. Quick Record Payment Modal
  const [payingInvoice, setPayingInvoice] = useState<VendorInvoiceItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<"Cash" | "UPI" | "Bank Transfer" | "Cheque">("Cash");
  const [paymentDate, setPaymentDate] = useState<string>(getTodayStr());
  const [paymentNote, setPaymentNote] = useState<string>("");

  // 5. Delete & View Modals
  const [deletingTarget, setDeletingTarget] = useState<{
    type: "vendor" | "order" | "invoice";
    item: any;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [viewingDetails, setViewingDetails] = useState<{
    title: string;
    badge?: string;
    fields: FieldItem[];
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // -------------------------------------------------------------------------
  // Handlers: Vendor Operations
  // -------------------------------------------------------------------------
  const handleOpenAddVendor = (prefillName?: string) => {
    setEditingVendor(null);
    setVendorFormData({
      name: prefillName || "",
      mobile: "",
      address: "",
      email: "",
      gstNumber: "",
      notes: "",
    });
    setIsVendorDrawerOpen(true);
  };

  const handleOpenEditVendor = (v: VendorItem) => {
    setEditingVendor(v);
    setVendorFormData({
      name: v.name,
      mobile: v.mobile,
      address: v.address,
      email: v.email || "",
      gstNumber: v.gstNumber || "",
      notes: v.notes || "",
    });
    setIsVendorDrawerOpen(true);
  };

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorFormData.name.trim()) {
      showToast("Vendor Name is required", "error");
      return;
    }
    if (!vendorFormData.mobile.trim()) {
      showToast("Mobile Number is required", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: vendorFormData.name.trim(),
        mobile: vendorFormData.mobile.trim(),
        address: vendorFormData.address.trim(),
        email: vendorFormData.email.trim(),
        gstNumber: vendorFormData.gstNumber.trim(),
        notes: vendorFormData.notes.trim(),
        status: "Active",
        updatedAt: serverTimestamp(),
      };

      if (editingVendor) {
        await updateDoc(doc(db, "vendors", editingVendor.id), payload);
        showToast(`Vendor "${payload.name}" updated successfully!`, "success");
      } else {
        await addDoc(collection(db, "vendors"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        showToast(`Vendor "${payload.name}" added successfully!`, "success");
      }

      setIsVendorDrawerOpen(false);
    } catch (err: any) {
      console.error("Save vendor error:", err);
      showToast("Error saving vendor: " + err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers: Order Operations
  // -------------------------------------------------------------------------
  const handleOpenAddOrder = (prefillVendorId?: string) => {
    setEditingOrder(null);
    setOrderFormData({
      vendorId: prefillVendorId || (vendors[0]?.id || ""),
      orderDate: getTodayStr(),
      deliveryDate: "",
      status: "New",
      notes: "",
    });
    setOrderItemsList([{ name: "", quantity: "" }]);
    setIsOrderDrawerOpen(true);
  };

  const handleOpenEditOrder = (o: VendorOrderItem) => {
    setEditingOrder(o);
    setOrderFormData({
      vendorId: o.vendorId,
      orderDate: o.orderDate || getTodayStr(),
      deliveryDate: o.deliveryDate || "",
      status: o.status,
      notes: o.notes || "",
    });
    setOrderItemsList(o.items && o.items.length > 0 ? [...o.items] : [{ name: "", quantity: "" }]);
    setIsOrderDrawerOpen(true);
  };

  const handleAddOrderItemLine = () => {
    setOrderItemsList((prev) => [...prev, { name: "", quantity: "" }]);
  };

  const handleRemoveOrderItemLine = (index: number) => {
    setOrderItemsList((prev) => {
      if (prev.length <= 1) return [{ name: "", quantity: "" }];
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleUpdateOrderItemLine = (index: number, field: "name" | "quantity", val: string) => {
    setOrderItemsList((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderFormData.vendorId) {
      showToast("Please select a Vendor", "error");
      return;
    }

    const cleanedItems = orderItemsList.filter((i) => i.name.trim() !== "");
    if (cleanedItems.length === 0) {
      showToast("Please add at least one item with a name", "error");
      return;
    }

    const selectedVendor = vendors.find((v) => v.id === orderFormData.vendorId);
    if (!selectedVendor) {
      showToast("Selected vendor not found", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      // Auto-generate order ID if new: e.g. VO-20261102-001
      const orderCount = vendorOrders.length + 1;
      const dateCode = (orderFormData.orderDate || getTodayStr()).replace(/-/g, "");
      const generatedOrderId = `VO-${dateCode}-${String(orderCount).padStart(3, "0")}`;

      const payload = {
        orderId: editingOrder?.orderId || generatedOrderId,
        vendorId: selectedVendor.id,
        vendorName: selectedVendor.name,
        vendorMobile: selectedVendor.mobile,
        vendorAddress: selectedVendor.address,
        items: cleanedItems,
        status: orderFormData.status,
        orderDate: orderFormData.orderDate || getTodayStr(),
        deliveryDate: orderFormData.deliveryDate || "",
        notes: orderFormData.notes.trim(),
        updatedAt: serverTimestamp(),
      };

      if (editingOrder) {
        await updateDoc(doc(db, "vendor_orders", editingOrder.id), payload);
        showToast(`Vendor Order ${payload.orderId} updated!`, "success");
      } else {
        await addDoc(collection(db, "vendor_orders"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        showToast(`Vendor Order ${payload.orderId} created successfully!`, "success");
      }

      setIsOrderDrawerOpen(false);
    } catch (err: any) {
      console.error("Save order error:", err);
      showToast("Error saving order: " + err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick toggle order status between "New" and "Received at store"
  const handleToggleOrderStatus = async (order: VendorOrderItem) => {
    const nextStatus = order.status === "New" ? "Received at store" : "New";
    try {
      await updateDoc(doc(db, "vendor_orders", order.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      showToast(`Order ${order.orderId} status changed to "${nextStatus}"`, "info");
    } catch (err: any) {
      showToast("Failed to update status: " + err.message, "error");
    }
  };

  // -------------------------------------------------------------------------
  // Handlers: Invoice / Vendor Due Operations
  // -------------------------------------------------------------------------
  const handleOpenAddInvoice = (prefillVendorId?: string, prefillOrder?: VendorOrderItem) => {
    setEditingInvoice(null);
    const vId = prefillVendorId || prefillOrder?.vendorId || (vendors[0]?.id || "");
    const dateCode = getTodayStr().replace(/-/g, "");
    const invCount = vendorInvoices.length + 1;
    const defaultInvNumber = `INV-${dateCode}-${String(invCount).padStart(3, "0")}`;

    setInvoiceFormData({
      vendorId: vId,
      orderId: prefillOrder?.orderId || "",
      invoiceNumber: defaultInvNumber,
      invoiceDate: getTodayStr(),
      dueDate: "",
      paidAmount: 0,
      paymentMode: "Cash",
      notes: prefillOrder ? `Bill for Order ${prefillOrder.orderId}` : "",
    });

    if (prefillOrder && prefillOrder.items && prefillOrder.items.length > 0) {
      setInvoiceItemsList(
        prefillOrder.items.map((i) => {
          const numQty = parseFloat(String(i.quantity).replace(/[^0-9.]/g, "")) || 1;
          return {
            name: i.name,
            quantity: numQty,
            price: 0,
            total: 0,
          };
        })
      );
    } else {
      setInvoiceItemsList([{ name: "", quantity: 1, price: 0, total: 0 }]);
    }

    setIsInvoiceDrawerOpen(true);
  };

  const handleOpenEditInvoice = (inv: VendorInvoiceItem) => {
    setEditingInvoice(inv);
    setInvoiceFormData({
      vendorId: inv.vendorId,
      orderId: inv.orderId || "",
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate || getTodayStr(),
      dueDate: inv.dueDate || "",
      paidAmount: inv.paidAmount,
      paymentMode: inv.paymentMode || "Cash",
      notes: inv.notes || "",
    });
    setInvoiceItemsList(inv.items && inv.items.length > 0 ? [...inv.items] : [{ name: "", quantity: 1, price: 0, total: 0 }]);
    setIsInvoiceDrawerOpen(true);
  };

  const handleAddInvoiceItemLine = () => {
    setInvoiceItemsList((prev) => [...prev, { name: "", quantity: 1, price: 0, total: 0 }]);
  };

  const handleRemoveInvoiceItemLine = (index: number) => {
    setInvoiceItemsList((prev) => {
      if (prev.length <= 1) return [{ name: "", quantity: 1, price: 0, total: 0 }];
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleUpdateInvoiceItemLine = (
    index: number,
    field: "name" | "quantity" | "price",
    val: string | number
  ) => {
    setInvoiceItemsList((prev) => {
      const copy = [...prev];
      const item = { ...copy[index] };

      if (field === "name") {
        item.name = String(val);
      } else if (field === "quantity") {
        item.quantity = Math.max(0, Number(val) || 0);
        item.total = item.quantity * item.price;
      } else if (field === "price") {
        item.price = Math.max(0, Number(val) || 0);
        item.total = item.quantity * item.price;
      }

      copy[index] = item;
      return copy;
    });
  };

  // Computed Invoice Total & Pending Amount
  const currentInvoiceTotal = useMemo(() => {
    return invoiceItemsList.reduce((sum, item) => sum + (item.total || 0), 0);
  }, [invoiceItemsList]);

  const currentInvoicePending = useMemo(() => {
    const paid = Number(invoiceFormData.paidAmount) || 0;
    return Math.max(0, currentInvoiceTotal - paid);
  }, [currentInvoiceTotal, invoiceFormData.paidAmount]);

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceFormData.vendorId) {
      showToast("Please select a Vendor", "error");
      return;
    }

    const cleanedItems = invoiceItemsList.filter((i) => i.name.trim() !== "");
    if (cleanedItems.length === 0) {
      showToast("Please add at least one line item", "error");
      return;
    }

    const selectedVendor = vendors.find((v) => v.id === invoiceFormData.vendorId);
    if (!selectedVendor) {
      showToast("Selected vendor not found", "error");
      return;
    }

    const total = currentInvoiceTotal;
    const paid = Math.min(total, Math.max(0, Number(invoiceFormData.paidAmount) || 0));
    const pending = Math.max(0, total - paid);

    let paymentStatus: "Paid" | "Partial" | "Unpaid" = "Unpaid";
    if (paid >= total && total > 0) {
      paymentStatus = "Paid";
    } else if (paid > 0) {
      paymentStatus = "Partial";
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<VendorInvoiceItem> = {
        invoiceNumber: invoiceFormData.invoiceNumber.trim() || `INV-${Date.now()}`,
        vendorId: selectedVendor.id,
        vendorName: selectedVendor.name,
        vendorMobile: selectedVendor.mobile,
        vendorAddress: selectedVendor.address,
        orderId: invoiceFormData.orderId || "",
        items: cleanedItems,
        totalAmount: total,
        paidAmount: paid,
        pendingAmount: pending,
        paymentStatus,
        paymentMode: invoiceFormData.paymentMode,
        invoiceDate: invoiceFormData.invoiceDate || getTodayStr(),
        dueDate: invoiceFormData.dueDate || "",
        notes: invoiceFormData.notes.trim(),
        updatedAt: serverTimestamp(),
      };

      if (editingInvoice) {
        await updateDoc(doc(db, "vendor_invoices", editingInvoice.id), payload);
        showToast(`Vendor Invoice ${payload.invoiceNumber} updated!`, "success");
      } else {
        await addDoc(collection(db, "vendor_invoices"), {
          ...payload,
          payments:
            paid > 0
              ? [
                  {
                    id: String(Date.now()),
                    amount: paid,
                    date: invoiceFormData.invoiceDate || getTodayStr(),
                    mode: invoiceFormData.paymentMode,
                    note: "Initial payment on bill creation",
                  },
                ]
              : [],
          createdAt: serverTimestamp(),
        });
        showToast(`Vendor Invoice ${payload.invoiceNumber} created!`, "success");
      }

      setIsInvoiceDrawerOpen(false);
    } catch (err: any) {
      console.error("Save invoice error:", err);
      showToast("Error saving invoice: " + err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Record Payment
  const handleOpenRecordPayment = (inv: VendorInvoiceItem) => {
    setPayingInvoice(inv);
    setPaymentAmount(inv.pendingAmount);
    setPaymentMode("Cash");
    setPaymentDate(getTodayStr());
    setPaymentNote("");
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice) return;
    if (paymentAmount <= 0) {
      showToast("Please enter a valid payment amount > 0", "error");
      return;
    }

    const newPaidTotal = (payingInvoice.paidAmount || 0) + paymentAmount;
    const newPending = Math.max(0, (payingInvoice.totalAmount || 0) - newPaidTotal);
    const newStatus: "Paid" | "Partial" | "Unpaid" =
      newPending <= 0 ? "Paid" : "Partial";

    const newPaymentRecord: PaymentRecord = {
      id: String(Date.now()),
      amount: paymentAmount,
      date: paymentDate || getTodayStr(),
      mode: paymentMode,
      note: paymentNote.trim(),
    };

    setIsSubmitting(true);
    try {
      const existingPayments = payingInvoice.payments || [];
      await updateDoc(doc(db, "vendor_invoices", payingInvoice.id), {
        paidAmount: newPaidTotal,
        pendingAmount: newPending,
        paymentStatus: newStatus,
        payments: [...existingPayments, newPaymentRecord],
        updatedAt: serverTimestamp(),
      });

      showToast(
        `Recorded payment of ₹${paymentAmount.toLocaleString("en-IN")} for ${
          payingInvoice.invoiceNumber
        }!`,
        "success"
      );
      setPayingInvoice(null);
    } catch (err: any) {
      showToast("Failed to record payment: " + err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers: Confirm Deletes
  // -------------------------------------------------------------------------
  const handleConfirmDelete = async () => {
    if (!deletingTarget) return;
    setIsDeleting(true);
    try {
      if (deletingTarget.type === "vendor") {
        await deleteDoc(doc(db, "vendors", deletingTarget.item.id));
        showToast(`Vendor "${deletingTarget.item.name}" deleted`, "info");
      } else if (deletingTarget.type === "order") {
        await deleteDoc(doc(db, "vendor_orders", deletingTarget.item.id));
        showToast(`Order "${deletingTarget.item.orderId}" deleted`, "info");
      } else if (deletingTarget.type === "invoice") {
        await deleteDoc(doc(db, "vendor_invoices", deletingTarget.item.id));
        showToast(`Invoice "${deletingTarget.item.invoiceNumber}" deleted`, "info");
      }
      setDeletingTarget(null);
    } catch (err: any) {
      showToast("Error deleting: " + err.message, "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Quick Seed Sample Data if collections are empty
  const handleSeedSampleData = async () => {
    try {
      showToast("Adding sample vendors & orders...", "info");

      // 1. Vendor
      const vDoc = await addDoc(collection(db, "vendors"), {
        name: "Sri Venkateswara Dairy & Ghee",
        mobile: "9848012345",
        address: "Station Road, Chirala, AP - 523155",
        email: "svdairy@gmail.com",
        status: "Active",
        createdAt: serverTimestamp(),
      });

      // 2. Order
      await addDoc(collection(db, "vendor_orders"), {
        orderId: `VO-${getTodayStr().replace(/-/g, "")}-001`,
        vendorId: vDoc.id,
        vendorName: "Sri Venkateswara Dairy & Ghee",
        vendorMobile: "9848012345",
        vendorAddress: "Station Road, Chirala, AP - 523155",
        items: [
          { name: "Pure Cow Ghee", quantity: "50 KG" },
          { name: "Fresh Buffalo Milk", quantity: "100 Litres" },
        ],
        status: "New",
        orderDate: getTodayStr(),
        createdAt: serverTimestamp(),
      });

      // 3. Invoice / Due
      await addDoc(collection(db, "vendor_invoices"), {
        invoiceNumber: `INV-${getTodayStr().replace(/-/g, "")}-001`,
        vendorId: vDoc.id,
        vendorName: "Sri Venkateswara Dairy & Ghee",
        vendorMobile: "9848012345",
        vendorAddress: "Station Road, Chirala, AP - 523155",
        items: [
          { name: "Pure Cow Ghee", quantity: 50, price: 600, total: 30000 },
          { name: "Fresh Buffalo Milk", quantity: 100, price: 65, total: 6500 },
        ],
        totalAmount: 36500,
        paidAmount: 20000,
        pendingAmount: 16500,
        paymentStatus: "Partial",
        paymentMode: "UPI",
        invoiceDate: getTodayStr(),
        payments: [
          {
            id: String(Date.now()),
            amount: 20000,
            date: getTodayStr(),
            mode: "UPI",
            note: "Advance payment",
          },
        ],
        createdAt: serverTimestamp(),
      });

      showToast("Sample vendor, order, and invoice loaded successfully!", "success");
    } catch (e: any) {
      showToast("Failed to seed: " + e.message, "error");
    }
  };

  // Vendor options for SearchableSelect
  const vendorSelectOptions: SelectOption[] = useMemo(() => {
    return vendors.map((v) => ({
      value: v.id,
      label: v.name,
      sublabel: `📞 ${v.mobile} • ${v.address || "Chirala"}`,
    }));
  }, [vendors]);

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
      {/* ===================================================================== */}
      {/* 1. Header & Navigation Tabs                                           */}
      {/* ===================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#348bdd] to-sky-400 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
            <Truck size={22} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              Vendor Manager
            </h1>
            <p className="text-xs text-slate-500">
              Procurement, purchase orders, vendor invoices, and outstanding dues tracking
            </p>
          </div>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="flex items-center gap-2">
          {vendors.length === 0 && (
            <button
              onClick={handleSeedSampleData}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Add sample vendors and orders to test"
            >
              <Sparkles size={13} />
              <span>Load Sample Data</span>
            </button>
          )}

          {activeTab === "orders" && (
            <button
              onClick={() => handleOpenAddOrder()}
              className="px-4 py-2 text-xs font-medium rounded-lg text-white shadow-sm flex items-center gap-1.5 cursor-pointer transition-all hover:opacity-95"
              style={{ backgroundColor: "var(--color-brand-primary)" }}
            >
              <Plus size={15} />
              <span>Add Order</span>
            </button>
          )}

          {activeTab === "due" && (
            <button
              onClick={() => handleOpenAddInvoice()}
              className="px-4 py-2 text-xs font-medium rounded-lg text-white shadow-sm flex items-center gap-1.5 cursor-pointer transition-all hover:opacity-95"
              style={{ backgroundColor: "var(--color-brand-primary)" }}
            >
              <Plus size={15} />
              <span>Add Vendor Invoice</span>
            </button>
          )}

          {activeTab === "vendors" && (
            <button
              onClick={() => handleOpenAddVendor()}
              className="px-4 py-2 text-xs font-medium rounded-lg text-white shadow-sm flex items-center gap-1.5 cursor-pointer transition-all hover:opacity-95"
              style={{ backgroundColor: "var(--color-brand-primary)" }}
            >
              <Plus size={15} />
              <span>Add Vendor</span>
            </button>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. Main Tabs Bar (Orders | Vendor Due | Vendors)                       */}
      {/* ===================================================================== */}
      <div className="flex items-center gap-2 border-b border-slate-200/80">
        <button
          onClick={() => handleTabChange("orders")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === "orders"
              ? "border-[#348bdd] text-[#348bdd] bg-sky-50/50"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <ShoppingBag size={16} />
          <span>Vendor Orders</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === "orders"
                ? "bg-[#348bdd] text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {vendorOrders.length}
          </span>
        </button>

        <button
          onClick={() => handleTabChange("due")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === "due"
              ? "border-[#348bdd] text-[#348bdd] bg-sky-50/50"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Receipt size={16} />
          <span>Vendor Due</span>
          {dueSummary.totalPending > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-rose-500 text-white font-semibold">
              ₹{Math.round(dueSummary.totalPending).toLocaleString("en-IN")}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange("vendors")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === "vendors"
              ? "border-[#348bdd] text-[#348bdd] bg-sky-50/50"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Users size={16} />
          <span>Vendors</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === "vendors"
                ? "bg-[#348bdd] text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {vendors.length}
          </span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: VENDOR ORDERS                                                  */}
      {/* ===================================================================== */}
      {activeTab === "orders" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Date Filter & Search Controls */}
          <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            {/* Row 1: Date Filter Pills (User request: today, yesterday, this week, last week, this month, last month, this year, last year, custom) */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
              <div className="flex items-center gap-1.5 text-xs">
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
                  { id: "custom", label: "Custom Date" },
                  { id: "all", label: "All" },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setOrderDateFilter(f.id as DateFilterType)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                      orderDateFilter === f.id
                        ? "bg-[#348bdd] text-white shadow-2xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Pickers (Shown if "custom" is selected) */}
            {orderDateFilter === "custom" && (
              <div className="flex items-center gap-2 p-2 bg-sky-50/60 rounded-lg border border-sky-100 text-xs text-sky-900 animate-in fade-in">
                <span className="font-medium text-xs">From:</span>
                <CustomDatePicker
                  value={orderCustomFrom}
                  onChange={setOrderCustomFrom}
                  compact
                  placeholder="From date"
                />
                <span className="font-medium text-xs ml-1">To:</span>
                <CustomDatePicker
                  value={orderCustomTo}
                  onChange={setOrderCustomTo}
                  compact
                  placeholder="To date"
                />
              </div>
            )}

            {/* Row 2: Search & Status Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-100">
              {/* Search Bar: Vendor Name, Mobile, Order ID */}
              <div className="relative flex-1 max-w-md">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Search by vendor name, mobile, or order ID..."
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] transition-all text-slate-800 placeholder-slate-400"
                />
                {orderSearchQuery && (
                  <button
                    onClick={() => setOrderSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Status Filter: All | New | Received at store */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mr-1">
                  Status:
                </span>
                {[
                  { id: "all", label: "All Orders" },
                  { id: "New", label: "New" },
                  { id: "Received at store", label: "Received at store" },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setOrderStatusFilter(s.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                      orderStatusFilter === s.id
                        ? "bg-slate-800 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium select-none">
                  <tr>
                    <th className="py-2.5 px-3.5 text-[10px] uppercase tracking-wider">Order ID</th>
                    <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider">Date</th>
                    <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider">Vendor Details</th>
                    <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider">Items Ordered</th>
                    <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider text-center">Status</th>
                    <th className="py-2.5 px-3.5 text-[10px] uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <ShoppingBag size={28} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-xs font-medium text-slate-600">No vendor orders found</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Try changing the date filter, search query, or click &quot;Add Order&quot;
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      const isNew = order.status === "New";
                      return (
                        <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Order ID */}
                          <td className="py-3 px-3.5 whitespace-nowrap font-mono text-[11px] font-semibold text-[#348bdd]">
                            {order.orderId}
                          </td>

                          {/* Date */}
                          <td className="py-3 px-3 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                            {order.orderDate}
                          </td>

                          {/* Vendor Details */}
                          <td className="py-3 px-3">
                            <div className="font-medium text-slate-800">{order.vendorName}</div>
                            <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                              <Phone size={10} className="text-slate-400" />
                              <span>{order.vendorMobile}</span>
                            </div>
                          </td>

                          {/* Items Ordered */}
                          <td className="py-3 px-3 max-w-xs">
                            <div className="flex flex-wrap gap-1">
                              {order.items?.map((it, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200"
                                >
                                  <span>{it.name}</span>
                                  {it.quantity && (
                                    <span className="text-[#348bdd] font-mono">({it.quantity})</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* Status & Quick Toggle */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleToggleOrderStatus(order)}
                              title="Click to toggle status"
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-transform active:scale-95 cursor-pointer ${
                                isNew
                                  ? "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              }`}
                            >
                              {isNew ? (
                                <>
                                  <Sparkles size={11} className="text-sky-500" />
                                  <span>New</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 size={11} className="text-emerald-500" />
                                  <span>Received at store</span>
                                </>
                              )}
                            </button>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Create Due Bill / Invoice */}
                              <button
                                onClick={() => handleOpenAddInvoice(order.vendorId, order)}
                                className="px-2 py-1 text-[11px] rounded bg-sky-50 hover:bg-sky-100 text-[#348bdd] border border-sky-200 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                                title="Generate Due Bill from this order"
                              >
                                <Receipt size={11} />
                                <span>Bill</span>
                              </button>

                              {/* View Details */}
                              <button
                                onClick={() =>
                                  setViewingDetails({
                                    title: `Vendor Order Details: ${order.orderId}`,
                                    badge: order.status,
                                    fields: [
                                      { label: "ORDER ID", value: order.orderId },
                                      { label: "ORDER DATE", value: order.orderDate },
                                      { label: "VENDOR NAME", value: order.vendorName },
                                      { label: "VENDOR MOBILE", value: order.vendorMobile },
                                      { label: "VENDOR ADDRESS", value: order.vendorAddress || "—", colSpan: 2 },
                                      { label: "STATUS", value: order.status },
                                      {
                                        label: "ITEMS ORDERED",
                                        colSpan: 2,
                                        value: (
                                          <div className="space-y-1">
                                            {order.items?.map((it, idx) => (
                                              <div
                                                key={idx}
                                                className="flex justify-between items-center text-xs p-1.5 rounded bg-slate-50 border border-slate-200"
                                              >
                                                <span className="font-medium text-slate-800">{it.name}</span>
                                                <span className="font-mono text-slate-600">{it.quantity || "—"}</span>
                                              </div>
                                            ))}
                                          </div>
                                        ),
                                      },
                                      { label: "NOTES", value: order.notes || "—", colSpan: 2 },
                                    ],
                                  })
                                }
                                className="w-7 h-7 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer transition-colors"
                                title="View details"
                              >
                                <Eye size={12} />
                              </button>

                              {/* Edit */}
                              <button
                                onClick={() => handleOpenEditOrder(order)}
                                className="w-7 h-7 rounded flex items-center justify-center bg-slate-100 hover:bg-sky-50 hover:text-[#348bdd] text-slate-600 cursor-pointer transition-colors"
                                title="Edit order"
                              >
                                <Edit2 size={12} />
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => setDeletingTarget({ type: "order", item: order })}
                                className="w-7 h-7 rounded flex items-center justify-center bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 cursor-pointer transition-colors"
                                title="Delete order"
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
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: VENDOR DUE                                                     */}
      {/* ===================================================================== */}
      {activeTab === "due" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt size={13} className="text-slate-400" />
                <span>Total Bills</span>
              </div>
              <div className="text-xl font-bold text-slate-800 font-mono">
                {vendorInvoices.length}
              </div>
              <p className="text-[10px] text-slate-400">Recorded vendor invoices</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign size={13} className="text-slate-400" />
                <span>Total Invoiced</span>
              </div>
              <div className="text-xl font-bold text-slate-800 font-mono">
                ₹{Math.round(dueSummary.totalInvoiced).toLocaleString("en-IN")}
              </div>
              <p className="text-[10px] text-slate-400">Total bill amount</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
              <div className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-500" />
                <span>Total Paid</span>
              </div>
              <div className="text-xl font-bold text-emerald-600 font-mono">
                ₹{Math.round(dueSummary.totalPaid).toLocaleString("en-IN")}
              </div>
              <p className="text-[10px] text-slate-400">Payments cleared to vendors</p>
            </div>

            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 shadow-2xs space-y-1">
              <div className="text-[11px] font-medium text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle size={13} className="text-rose-500" />
                <span>Pending Due</span>
              </div>
              <div className="text-xl font-bold text-rose-600 font-mono">
                ₹{Math.round(dueSummary.totalPending).toLocaleString("en-IN")}
              </div>
              <p className="text-[10px] text-rose-500 font-medium">
                {dueSummary.pendingCount} bill{dueSummary.pendingCount === 1 ? "" : "s"} outstanding
              </p>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search by vendor, mobile, invoice number, or item..."
                value={dueSearchQuery}
                onChange={(e) => setDueSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] transition-all text-slate-800 placeholder-slate-400"
              />
              {dueSearchQuery && (
                <button
                  onClick={() => setDueSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filter by Vendor */}
              <select
                value={dueVendorFilter}
                onChange={(e) => setDueVendorFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs outline-none cursor-pointer"
              >
                <option value="all">All Vendors ({vendors.length})</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>

              {/* Filter by Due Status */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                {[
                  { id: "all", label: "All" },
                  { id: "pending", label: "Pending Dues" },
                  { id: "Paid", label: "Fully Paid" },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setDueStatusFilter(s.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                      dueStatusFilter === s.id
                        ? "bg-white text-slate-800 shadow-2xs font-semibold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Invoices & Dues Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium select-none">
                  <tr>
                    <th className="py-2.5 px-3.5 text-[10px] uppercase tracking-wider">Invoice / Date</th>
                    <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider">Vendor</th>
                    <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider">Items Breakdown</th>
                    <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider text-right">Total Bill</th>
                    <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider text-right">Paid Amount</th>
                    <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider text-right">Pending Due</th>
                    <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider text-center">Status</th>
                    <th className="py-2.5 px-3.5 text-[10px] uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <Receipt size={28} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-xs font-medium text-slate-600">No vendor invoices or dues found</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Click &quot;Add Vendor Invoice&quot; to log a purchase bill, payment, and due amount
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => {
                      const isFullyPaid = inv.pendingAmount <= 0;
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Invoice No & Date */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className="font-mono text-[11px] font-semibold text-slate-800 block">
                              {inv.invoiceNumber}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono block">
                              {inv.invoiceDate}
                            </span>
                          </td>

                          {/* Vendor */}
                          <td className="py-3 px-3">
                            <div className="font-medium text-slate-800">{inv.vendorName}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{inv.vendorMobile}</div>
                          </td>

                          {/* Items Breakdown */}
                          <td className="py-3 px-3 max-w-xs">
                            <div className="space-y-0.5">
                              {inv.items?.map((it, idx) => (
                                <div key={idx} className="text-[11px] text-slate-700 truncate">
                                  <span className="font-medium">{it.name}</span>:{" "}
                                  <span className="text-slate-500 font-mono">
                                    {it.quantity} × ₹{it.price} = ₹{it.total}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>

                          {/* Total Bill */}
                          <td className="py-3 px-3 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">
                            ₹{Number(inv.totalAmount || 0).toLocaleString("en-IN")}
                          </td>

                          {/* Paid Amount */}
                          <td className="py-3 px-3 text-right font-mono font-medium text-emerald-600 whitespace-nowrap">
                            ₹{Number(inv.paidAmount || 0).toLocaleString("en-IN")}
                          </td>

                          {/* Pending Due */}
                          <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                            {inv.pendingAmount > 0 ? (
                              <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-bold border border-rose-200 text-xs">
                                ₹{Number(inv.pendingAmount).toLocaleString("en-IN")}
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-medium text-xs">₹0 (Cleared)</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                inv.paymentStatus === "Paid"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : inv.paymentStatus === "Partial"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                              }`}
                            >
                              {inv.paymentStatus}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Quick Record Payment if pending */}
                              {inv.pendingAmount > 0 && (
                                <button
                                  onClick={() => handleOpenRecordPayment(inv)}
                                  className="px-2 py-1 text-[11px] rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                                  title="Record payment"
                                >
                                  <CreditCard size={11} />
                                  <span>Pay Due</span>
                                </button>
                              )}

                              {/* View Invoice */}
                              <button
                                onClick={() =>
                                  setViewingDetails({
                                    title: `Vendor Invoice: ${inv.invoiceNumber}`,
                                    badge: inv.paymentStatus,
                                    fields: [
                                      { label: "INVOICE NUMBER", value: inv.invoiceNumber },
                                      { label: "INVOICE DATE", value: inv.invoiceDate },
                                      { label: "VENDOR NAME", value: inv.vendorName },
                                      { label: "VENDOR MOBILE", value: inv.vendorMobile },
                                      { label: "TOTAL INVOICE AMOUNT", value: `₹${inv.totalAmount.toLocaleString("en-IN")}` },
                                      { label: "HOW MUCH WE PAID", value: `₹${inv.paidAmount.toLocaleString("en-IN")}` },
                                      {
                                        label: "HOW MUCH IS PENDING",
                                        value: (
                                          <span className="font-bold text-rose-600">
                                            ₹{inv.pendingAmount.toLocaleString("en-IN")}
                                          </span>
                                        ),
                                      },
                                      { label: "PAYMENT STATUS", value: inv.paymentStatus },
                                      { label: "PRIMARY PAYMENT MODE", value: inv.paymentMode || "—" },
                                      {
                                        label: "ITEMS LIST (QUANTITY & PRICE)",
                                        colSpan: 2,
                                        value: (
                                          <div className="space-y-1">
                                            {inv.items?.map((it, idx) => (
                                              <div
                                                key={idx}
                                                className="flex justify-between items-center text-xs p-1.5 rounded bg-slate-50 border border-slate-200"
                                              >
                                                <span className="font-medium text-slate-800">{it.name}</span>
                                                <span className="font-mono text-slate-600">
                                                  {it.quantity} × ₹{it.price} = ₹{it.total}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        ),
                                      },
                                      {
                                        label: "PAYMENT HISTORY",
                                        colSpan: 2,
                                        value:
                                          inv.payments && inv.payments.length > 0 ? (
                                            <div className="space-y-1">
                                              {inv.payments.map((p, idx) => (
                                                <div
                                                  key={idx}
                                                  className="flex justify-between items-center text-xs p-1.5 rounded bg-emerald-50/50 border border-emerald-100"
                                                >
                                                  <span>
                                                    Paid <strong>₹{p.amount.toLocaleString("en-IN")}</strong> via {p.mode} on {p.date}
                                                  </span>
                                                  <span className="text-slate-400 text-[10px]">{p.note}</span>
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            "No payment history recorded yet."
                                          ),
                                      },
                                      { label: "NOTES", value: inv.notes || "—", colSpan: 2 },
                                    ],
                                  })
                                }
                                className="w-7 h-7 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer transition-colors"
                                title="View details"
                              >
                                <Eye size={12} />
                              </button>

                              {/* Edit */}
                              <button
                                onClick={() => handleOpenEditInvoice(inv)}
                                className="w-7 h-7 rounded flex items-center justify-center bg-slate-100 hover:bg-sky-50 hover:text-[#348bdd] text-slate-600 cursor-pointer transition-colors"
                                title="Edit invoice"
                              >
                                <Edit2 size={12} />
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => setDeletingTarget({ type: "invoice", item: inv })}
                                className="w-7 h-7 rounded flex items-center justify-center bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 cursor-pointer transition-colors"
                                title="Delete invoice"
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
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: VENDORS                                                        */}
      {/* ===================================================================== */}
      {activeTab === "vendors" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Search bar & count */}
          <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search vendors by name, mobile, address..."
                value={vendorSearchQuery}
                onChange={(e) => setVendorSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] transition-all text-slate-800 placeholder-slate-400"
              />
              {vendorSearchQuery && (
                <button
                  onClick={() => setVendorSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Showing {filteredVendors.length} of {vendors.length} vendors
            </div>
          </div>

          {/* Vendors List Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium select-none">
                  <tr>
                    <th className="py-2.5 px-3.5 text-[10px] uppercase tracking-wider">Vendor Name</th>
                    <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider">Mobile Number</th>
                    <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider">Address</th>
                    <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider text-center">Orders</th>
                    <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider text-right">Outstanding Due</th>
                    <th className="py-2.5 px-3.5 text-[10px] uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredVendors.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Users size={28} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-xs font-medium text-slate-600">No vendors found</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Click &quot;Add Vendor&quot; above to create a new vendor profile
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredVendors.map((vendor) => {
                      const due = vendorPendingMap.get(vendor.id) || 0;
                      const orderCount = vendorOrdersCountMap.get(vendor.id) || 0;

                      return (
                        <tr key={vendor.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Name & Avatar */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-slate-100 text-[#348bdd] font-bold flex items-center justify-center text-xs shrink-0 border border-slate-200">
                                {(vendor.name || "V").charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-medium text-slate-900 block">{vendor.name}</span>
                                {vendor.email && (
                                  <span className="text-[11px] text-slate-400 block">{vendor.email}</span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Mobile */}
                          <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-700">
                            <a
                              href={`tel:${vendor.mobile}`}
                              className="inline-flex items-center gap-1 hover:text-[#348bdd] hover:underline"
                            >
                              <Phone size={11} className="text-slate-400" />
                              <span>{vendor.mobile}</span>
                            </a>
                          </td>

                          {/* Address */}
                          <td className="py-3 px-3 text-slate-600 max-w-xs truncate">
                            <div className="flex items-center gap-1">
                              <MapPin size={11} className="text-slate-400 shrink-0" />
                              <span className="truncate">{vendor.address || "—"}</span>
                            </div>
                          </td>

                          {/* Total Orders */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <button
                              onClick={() => {
                                setOrderSearchQuery(vendor.name);
                                setOrderDateFilter("all");
                                setActiveTab("orders");
                              }}
                              className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-mono hover:bg-slate-200 cursor-pointer"
                              title="Click to view orders"
                            >
                              {orderCount} order{orderCount === 1 ? "" : "s"}
                            </button>
                          </td>

                          {/* Outstanding Due */}
                          <td className="py-3 px-3 text-right whitespace-nowrap font-mono">
                            {due > 0 ? (
                              <button
                                onClick={() => {
                                  setDueVendorFilter(vendor.id);
                                  setActiveTab("due");
                                }}
                                className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-bold border border-rose-200 text-xs hover:bg-rose-100 cursor-pointer"
                                title="Click to view dues"
                              >
                                ₹{Math.round(due).toLocaleString("en-IN")}
                              </button>
                            ) : (
                              <span className="text-emerald-600 font-medium text-xs">No Dues</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Create Order */}
                              <button
                                onClick={() => handleOpenAddOrder(vendor.id)}
                                className="px-2 py-1 text-[11px] rounded bg-sky-50 hover:bg-sky-100 text-[#348bdd] border border-sky-200 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                                title="Create Purchase Order for this vendor"
                              >
                                <ShoppingBag size={11} />
                                <span>Order</span>
                              </button>

                              {/* Create Due Bill */}
                              <button
                                onClick={() => handleOpenAddInvoice(vendor.id)}
                                className="px-2 py-1 text-[11px] rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                                title="Add bill/due for this vendor"
                              >
                                <Receipt size={11} />
                                <span>Bill</span>
                              </button>

                              {/* View Details */}
                              <button
                                onClick={() =>
                                  setViewingDetails({
                                    title: `Vendor Profile: ${vendor.name}`,
                                    badge: vendor.status,
                                    fields: [
                                      { label: "VENDOR NAME", value: vendor.name },
                                      { label: "MOBILE NUMBER", value: vendor.mobile },
                                      { label: "EMAIL", value: vendor.email || "—" },
                                      { label: "GST NUMBER", value: vendor.gstNumber || "—" },
                                      { label: "ADDRESS", value: vendor.address, colSpan: 2 },
                                      {
                                        label: "TOTAL ORDERS",
                                        value: `${orderCount} Orders Placed`,
                                      },
                                      {
                                        label: "TOTAL OUTSTANDING DUE",
                                        value: (
                                          <span className="font-bold text-rose-600">
                                            ₹{Math.round(due).toLocaleString("en-IN")}
                                          </span>
                                        ),
                                      },
                                      { label: "NOTES", value: vendor.notes || "—", colSpan: 2 },
                                    ],
                                  })
                                }
                                className="w-7 h-7 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer transition-colors"
                                title="View details"
                              >
                                <Eye size={12} />
                              </button>

                              {/* Edit */}
                              <button
                                onClick={() => handleOpenEditVendor(vendor)}
                                className="w-7 h-7 rounded flex items-center justify-center bg-slate-100 hover:bg-sky-50 hover:text-[#348bdd] text-slate-600 cursor-pointer transition-colors"
                                title="Edit vendor"
                              >
                                <Edit2 size={12} />
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => setDeletingTarget({ type: "vendor", item: vendor })}
                                className="w-7 h-7 rounded flex items-center justify-center bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 cursor-pointer transition-colors"
                                title="Delete vendor"
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
        </div>
      )}

      {/* ===================================================================== */}
      {/* DRAWER 1: ADD / EDIT VENDOR                                           */}
      {/* ===================================================================== */}
      <OffcanvasDrawer
        isOpen={isVendorDrawerOpen}
        onClose={() => setIsVendorDrawerOpen(false)}
        title={editingVendor ? "Edit Vendor Details" : "Add New Vendor"}
        subtitle="Manage supplier profiles, contact information, and address details"
      >
        <form onSubmit={handleSaveVendor} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Vendor Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Sri Lakshmi Sugar Depot"
              value={vendorFormData.name}
              onChange={(e) => setVendorFormData({ ...vendorFormData, name: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Mobile Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="tel"
              required
              placeholder="e.g. 9848012345"
              value={vendorFormData.mobile}
              onChange={(e) => setVendorFormData({ ...vendorFormData, mobile: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] font-mono text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Address <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Shop #12, Market Yard, Chirala, AP"
              value={vendorFormData.address}
              onChange={(e) => setVendorFormData({ ...vendorFormData, address: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] text-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Email Address (Optional)
              </label>
              <input
                type="email"
                placeholder="vendor@example.com"
                value={vendorFormData.email}
                onChange={(e) => setVendorFormData({ ...vendorFormData, email: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                GST / Tax ID (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 37AAAAA0000A1Z5"
                value={vendorFormData.gstNumber}
                onChange={(e) => setVendorFormData({ ...vendorFormData, gstNumber: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] font-mono text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Notes / Remarks (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Preferred delivery in morning hours"
              value={vendorFormData.notes}
              onChange={(e) => setVendorFormData({ ...vendorFormData, notes: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] text-slate-800"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsVendorDrawerOpen(false)}
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
              <span>{editingVendor ? "Update Vendor" : "Save Vendor"}</span>
            </button>
          </div>
        </form>
      </OffcanvasDrawer>

      {/* ===================================================================== */}
      {/* DRAWER 2: ADD / EDIT VENDOR ORDER                                     */}
      {/* ===================================================================== */}
      <OffcanvasDrawer
        isOpen={isOrderDrawerOpen}
        onClose={() => setIsOrderDrawerOpen(false)}
        title={editingOrder ? `Edit Order: ${editingOrder.orderId}` : "Create Vendor Order"}
        subtitle="Select vendor and add items with quantity to generate a purchase order"
      >
        <form onSubmit={handleSaveOrder} className="space-y-4">
          {/* Select Vendor */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-700">
                Select Vendor <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => handleOpenAddVendor()}
                className="text-[11px] text-[#348bdd] hover:underline font-medium cursor-pointer"
              >
                + New Vendor
              </button>
            </div>
            <SearchableSelect
              options={vendorSelectOptions}
              value={orderFormData.vendorId}
              onChange={(val) => setOrderFormData({ ...orderFormData, vendorId: val })}
              placeholder="Search & select a vendor..."
            />
          </div>

          {/* Dates & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Order Date</label>
              <CustomDatePicker
                value={orderFormData.orderDate}
                onChange={(d) => setOrderFormData({ ...orderFormData, orderDate: d })}
                placeholder="Select order date"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Order Status <span className="text-rose-500">*</span>
              </label>
              <select
                value={orderFormData.status}
                onChange={(e) =>
                  setOrderFormData({
                    ...orderFormData,
                    status: e.target.value as "New" | "Received at store",
                  })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] text-slate-800 font-medium"
              >
                <option value="New">New</option>
                <option value="Received at store">Received at store</option>
              </select>
            </div>
          </div>

          {/* Items Section (Dynamic Add Item Rows) */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Package size={13} className="text-[#348bdd]" />
                <span>Order Items List</span>
              </label>
              <button
                type="button"
                onClick={handleAddOrderItemLine}
                className="px-2 py-1 text-[11px] font-medium text-[#348bdd] bg-sky-50 hover:bg-sky-100 rounded border border-sky-200 transition-colors cursor-pointer"
              >
                + Add Item
              </button>
            </div>

            <div className="space-y-2 border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 max-h-60 overflow-y-auto">
              {orderItemsList.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Item name (e.g. Sugar M30, Milk, Ghee...)"
                      value={item.name}
                      onChange={(e) => handleUpdateOrderItemLine(idx, "name", e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] text-slate-800"
                    />
                  </div>
                  <div className="w-28">
                    <input
                      type="text"
                      placeholder="Qty (e.g. 50 KG)"
                      value={item.quantity}
                      onChange={(e) => handleUpdateOrderItemLine(idx, "quantity", e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] font-mono text-slate-800"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveOrderItemLine(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                    title="Remove item"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Order Notes / Delivery Instructions (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Please deliver by 10 AM at chirala main store"
              value={orderFormData.notes}
              onChange={(e) => setOrderFormData({ ...orderFormData, notes: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] text-slate-800"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsOrderDrawerOpen(false)}
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
              <span>{editingOrder ? "Update Order" : "Save Order"}</span>
            </button>
          </div>
        </form>
      </OffcanvasDrawer>

      {/* ===================================================================== */}
      {/* DRAWER 3: ADD / EDIT VENDOR INVOICE & DUE                             */}
      {/* ===================================================================== */}
      <OffcanvasDrawer
        isOpen={isInvoiceDrawerOpen}
        onClose={() => setIsInvoiceDrawerOpen(false)}
        title={editingInvoice ? `Edit Invoice: ${editingInvoice.invoiceNumber}` : "Add Vendor Invoice & Due"}
        subtitle="Log vendor bill items, quantity, rate, amount paid, and remaining pending balance"
      >
        <form onSubmit={handleSaveInvoice} className="space-y-4">
          {/* Select Vendor */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-700">
                Select Vendor <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => handleOpenAddVendor()}
                className="text-[11px] text-[#348bdd] hover:underline font-medium cursor-pointer"
              >
                + New Vendor
              </button>
            </div>
            <SearchableSelect
              options={vendorSelectOptions}
              value={invoiceFormData.vendorId}
              onChange={(val) => setInvoiceFormData({ ...invoiceFormData, vendorId: val })}
              placeholder="Search & select a vendor..."
            />
          </div>

          {/* Invoice Number & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Invoice / Bill Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. INV-8921"
                value={invoiceFormData.invoiceNumber}
                onChange={(e) =>
                  setInvoiceFormData({ ...invoiceFormData, invoiceNumber: e.target.value })
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Invoice Date</label>
              <CustomDatePicker
                value={invoiceFormData.invoiceDate}
                onChange={(d) =>
                  setInvoiceFormData({ ...invoiceFormData, invoiceDate: d })
                }
                placeholder="Select invoice date"
              />
            </div>
          </div>

          {/* Items Section: Name, Quantity, Price, Total */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Receipt size={13} className="text-[#348bdd]" />
                <span>Invoice Items (Quantity &amp; Rate)</span>
              </label>
              <button
                type="button"
                onClick={handleAddInvoiceItemLine}
                className="px-2 py-1 text-[11px] font-medium text-[#348bdd] bg-sky-50 hover:bg-sky-100 rounded border border-sky-200 transition-colors cursor-pointer"
              >
                + Add Item
              </button>
            </div>

            <div className="space-y-2 border border-slate-200 rounded-xl p-2.5 bg-slate-50/50 max-h-60 overflow-y-auto">
              {invoiceItemsList.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Item name (e.g. Sugar, Milk, Ghee...)"
                      value={item.name}
                      onChange={(e) => handleUpdateInvoiceItemLine(idx, "name", e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] text-slate-800"
                    />
                  </div>
                  <div className="w-16">
                    <input
                      type="number"
                      min={0}
                      placeholder="Qty"
                      value={item.quantity || ""}
                      onChange={(e) => handleUpdateInvoiceItemLine(idx, "quantity", e.target.value)}
                      className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] font-mono text-center text-slate-800"
                    />
                  </div>
                  <div className="w-20">
                    <input
                      type="number"
                      min={0}
                      placeholder="Rate ₹"
                      value={item.price || ""}
                      onChange={(e) => handleUpdateInvoiceItemLine(idx, "price", e.target.value)}
                      className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] font-mono text-right text-slate-800"
                    />
                  </div>
                  <div className="w-20 text-right font-mono text-xs font-semibold text-slate-700">
                    ₹{item.total.toLocaleString("en-IN")}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveInvoiceItemLine(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                    title="Remove item"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Subtotal Display */}
            <div className="flex justify-between items-center px-3 py-2 bg-slate-100 rounded-lg mt-2 text-xs">
              <span className="font-semibold text-slate-700">Total Invoice Amount:</span>
              <span className="font-bold font-mono text-slate-900 text-sm">
                ₹{currentInvoiceTotal.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* Payment Section: How much we paid & How much is pending */}
          <div className="p-3 bg-gradient-to-br from-slate-50 to-sky-50/40 rounded-xl border border-sky-100 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign size={13} className="text-[#348bdd]" />
              <span>Payment Details</span>
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  How Much We Paid (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  max={currentInvoiceTotal}
                  value={invoiceFormData.paidAmount === 0 ? "" : invoiceFormData.paidAmount}
                  placeholder="0"
                  onChange={(e) =>
                    setInvoiceFormData({
                      ...invoiceFormData,
                      paidAmount: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-emerald-500 font-mono font-semibold text-emerald-600 bg-white"
                />
                <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() =>
                      setInvoiceFormData({
                        ...invoiceFormData,
                        paidAmount: currentInvoiceTotal,
                      })
                    }
                    className="text-[#348bdd] hover:underline font-medium cursor-pointer"
                  >
                    Paid Full (100%)
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() =>
                      setInvoiceFormData({
                        ...invoiceFormData,
                        paidAmount: 0,
                      })
                    }
                    className="text-slate-500 hover:underline cursor-pointer"
                  >
                    Unpaid (₹0)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  How Much is Pending (₹)
                </label>
                <div
                  className={`w-full px-3 py-2 text-xs border rounded-lg font-mono font-bold flex items-center justify-between ${
                    currentInvoicePending > 0
                      ? "bg-rose-50 border-rose-200 text-rose-700"
                      : "bg-emerald-50 border-emerald-200 text-emerald-700"
                  }`}
                >
                  <span>Pending:</span>
                  <span className="text-sm">
                    ₹{currentInvoicePending.toLocaleString("en-IN")}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  {currentInvoicePending > 0 ? "Outstanding vendor balance" : "Fully cleared"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Payment Mode
                </label>
                <select
                  value={invoiceFormData.paymentMode}
                  onChange={(e) =>
                    setInvoiceFormData({
                      ...invoiceFormData,
                      paymentMode: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] text-slate-800 bg-white"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI / GPay / PhonePe</option>
                  <option value="Bank Transfer">Bank Transfer / NEFT</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Payment Status
                </label>
                <div className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white font-medium text-slate-700 flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      currentInvoicePending <= 0
                        ? "bg-emerald-500"
                        : Number(invoiceFormData.paidAmount) > 0
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    }`}
                  />
                  <span>
                    {currentInvoicePending <= 0
                      ? "Paid"
                      : Number(invoiceFormData.paidAmount) > 0
                      ? "Partial"
                      : "Unpaid"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Bill Notes / Remarks (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. GST invoice received with batch #3302"
              value={invoiceFormData.notes}
              onChange={(e) => setInvoiceFormData({ ...invoiceFormData, notes: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] text-slate-800"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsInvoiceDrawerOpen(false)}
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
              <span>{editingInvoice ? "Update Invoice" : "Save Invoice"}</span>
            </button>
          </div>
        </form>
      </OffcanvasDrawer>

      {/* ===================================================================== */}
      {/* MODAL: QUICK RECORD PAYMENT                                           */}
      {/* ===================================================================== */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Record Vendor Payment</h3>
                <p className="text-[11px] text-slate-500">
                  Invoice: {payingInvoice.invoiceNumber} • {payingInvoice.vendorName}
                </p>
              </div>
              <button
                onClick={() => setPayingInvoice(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-3 text-xs">
              {/* Due Summary */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                <div>
                  <span className="text-[11px] text-slate-500 block">Total Invoiced:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    ₹{payingInvoice.totalAmount.toLocaleString("en-IN")}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-emerald-600 block">Already Paid:</span>
                  <span className="font-mono font-semibold text-emerald-600">
                    ₹{payingInvoice.paidAmount.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-rose-600 block font-medium">Remaining Due:</span>
                  <span className="font-mono font-bold text-rose-600 text-sm">
                    ₹{payingInvoice.pendingAmount.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Payment Amount to Record (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={payingInvoice.pendingAmount}
                  value={paymentAmount || ""}
                  onChange={(e) => setPaymentAmount(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-emerald-500 font-mono font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] text-slate-800"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Payment Date
                  </label>
                  <CustomDatePicker
                    value={paymentDate}
                    onChange={setPaymentDate}
                    placeholder="Select payment date"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Note / Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR #9821829 or Cash received by driver"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#348bdd] text-slate-800"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setPayingInvoice(null)}
                  className="px-4 py-2 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || paymentAmount <= 0}
                  className="px-5 py-2 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 size={13} className="animate-spin" />}
                  <span>Confirm Payment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* GENERIC VIEW DETAILS MODAL                                            */}
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
      {/* CONFIRMATION MODAL FOR DELETIONS                                      */}
      {/* ===================================================================== */}
      {deletingTarget && (
        <ConfirmationModal
          isOpen={!!deletingTarget}
          title={`Delete ${
            deletingTarget.type === "vendor"
              ? "Vendor"
              : deletingTarget.type === "order"
              ? "Order"
              : "Invoice"
          }`}
          message={`Are you sure you want to delete this ${deletingTarget.type}? This action cannot be undone.`}
          confirmText="Confirm Delete"
          isDeleting={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingTarget(null)}
        />
      )}
    </div>
  );
}

