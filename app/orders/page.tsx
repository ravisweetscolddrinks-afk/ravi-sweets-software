"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  getCountFromServer,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import { usePrinter } from "@/context/PrinterContext";
import SearchableSelect from "@/components/SearchableSelect";
import ConfirmationModal from "@/components/ConfirmationModal";
import {
  Plus,
  Search,
  ShoppingCart,
  Calendar,
  Clock,
  Store,
  User,
  Users,
  Phone,
  MapPin,
  Mail,
  Building,
  CreditCard,
  Banknote,
  QrCode,
  Layers,
  Trash2,
  Edit2,
  Eye,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  Loader2,
  RotateCw,
  Sparkles,
  Percent,
  Receipt,
  Package,
  PackageCheck,
  Truck,
  CheckCircle2,
  Clock3,
  Factory,
  Boxes,
  Minus,
  Info,
  DollarSign,
  Printer,
  Wallet,
  History,
  FileText,
  Building2
} from "lucide-react";

// --- TYPES ---
export type OrderStatus =
  | "Created"
  | "Manufacturing In Progress"
  | "Manufacturing Completed"
  | "Moved to Packing"
  | "Received at Packing"
  | "Packing In Progress"
  | "Packing Completed"
  | "Moved to Store"
  | "Received at Store"
  | "Delivered";

export type PaymentStatus = "Unpaid" | "Partial" | "Done";

export type PaymentMethod = "Cash" | "UPI" | "Card" | "Split";

export interface OrderItem {
  id: string; // unique line ID
  productId: string;
  name: string;
  unit: string;
  rate: number;
  quantity: number; // piece count or KG/litre fraction
  totalAmount: number;
  manufacturingDescription?: string;
  imageUrl?: string;
  manufacturingUnitId?: string;
  manufacturingUnitName?: string;
  packingUnitId?: string;
  packingUnitName?: string;
  piecesPerKg?: number | string;
  status?: OrderStatus;
}

export interface SplitPaymentDetail {
  cash: number;
  upi: number;
  card: number;
}

export interface PaymentInstallment {
  id: string;
  amount: number;
  paymentMethod: PaymentMethod;
  date: string;
  note?: string;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  customerGstNumber?: string;
  isB2b?: boolean;
  storeId: string;
  storeName: string;
  deliveryDate: string; // YYYY-MM-DD
  deliveryTime: string; // HH:MM AM/PM
  packingDescription: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  taxableSubtotal: number;
  isGstEnabled: boolean;
  gstPercentage: number;
  cgst: number;
  sgst: number;
  gstType: "inclusive" | "exclusive";
  grandTotal: number;
  receivedAmount: number;
  balanceAmount: number;
  paymentMethod: PaymentMethod;
  splitDetails?: SplitPaymentDetail;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  paymentHistory?: PaymentInstallment[];
  createdAt?: any;
  updatedAt?: any;
}

export interface CustomerOption {
  id: string;
  name: string;
  phone: string;
  city?: string;
  address?: string;
  email?: string;
  isB2b?: boolean;
  gstNumber?: string;
}

export interface StoreOption {
  id: string;
  name: string;
  phone: string;
  address: string;
}

export interface ProductCatalogItem {
  id: string;
  name: string;
  unit: string;
  amount: number;
  imageUrl?: string;
  categoryName?: string;
  barcode?: string;
  shortCode?: string;
  manufacturingUnitId?: string;
  manufacturingUnitName?: string;
  packingUnitId?: string;
  packingUnitName?: string;
  piecesPerKg?: number | string;
}

type DateFilterType =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "custom";

const PAGE_SIZE = 24;

const ORDER_STATUS_LIST: OrderStatus[] = [
  "Created",
  "Manufacturing In Progress",
  "Manufacturing Completed",
  "Moved to Packing",
  "Received at Packing",
  "Packing In Progress",
  "Packing Completed",
  "Moved to Store",
  "Received at Store",
  "Delivered",
];

export default function OrdersPage() {
  const { showToast } = useToast();
  const { printReceipt } = usePrinter();

  // --- List View States ---
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Date Filter State (default to "today")
  const [currentDateStr, setCurrentDateStr] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<DateFilterType>("today");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  // Reference Data for Dropdowns & Product Catalog
  const [customersList, setCustomersList] = useState<CustomerOption[]>([]);
  const [storesList, setStoresList] = useState<StoreOption[]>([]);
  const [productsList, setProductsList] = useState<ProductCatalogItem[]>([]);
  const [productCatalogSearch, setProductCatalogSearch] = useState<string>("");
  const [gstConfig, setGstConfig] = useState<{
    enabled: boolean;
    percentage: number;
    pricingType: "inclusive" | "exclusive";
  }>({
    enabled: false,
    percentage: 5,
    pricingType: "inclusive",
  });

  const [businessProfile, setBusinessProfile] = useState<{
    tradeName: string;
    legalName: string;
    phone: string;
    altPhone: string;
    email: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    gstNumber: string;
  }>({
    tradeName: "Ravi Sweets & Cold Drinks",
    legalName: "Ravi Sweets",
    phone: "+91 94402 61276",
    altPhone: "",
    email: "contact@ravisweets.com",
    address: "Main Road, Chirala",
    city: "Chirala",
    state: "Andhra Pradesh",
    pincode: "523155",
    gstNumber: "",
  });

  // --- Full Screen Modal (Add / Edit) States ---
  const [isOrderModalOpen, setIsOrderModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "view">("create");
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Dedicated View Order Details Modal State
  const [viewingOrder, setViewingOrder] = useState<OrderRecord | null>(null);

  // A4 Tax Invoice Modal State & Print on Creation Prompt State
  const [a4InvoiceOrder, setA4InvoiceOrder] = useState<OrderRecord | null>(null);
  const [createdOrderForPrint, setCreatedOrderForPrint] = useState<OrderRecord | null>(null);

  // Dedicated Payment Management Modal State
  const [paymentManagingOrder, setPaymentManagingOrder] = useState<OrderRecord | null>(null);
  const [installmentAmount, setInstallmentAmount] = useState<number | "">("");
  const [installmentMethod, setInstallmentMethod] = useState<PaymentMethod>("Cash");
  const [installmentNote, setInstallmentNote] = useState<string>("");
  const [isAddingInstallment, setIsAddingInstallment] = useState<boolean>(false);

  // Quick Customer Creation Sub-Modal State
  const [isQuickCustomerOpen, setIsQuickCustomerOpen] = useState<boolean>(false);
  const [quickCustomerForm, setQuickCustomerForm] = useState({
    name: "",
    phone: "",
    city: "",
    email: "",
    address: "",
    isB2b: false,
    gstNumber: "",
  });
  const [quickCustomerError, setQuickCustomerError] = useState<string>("");

  // Weight / Volume Item Customization Sub-Modal State
  const [weightModalProduct, setWeightModalProduct] = useState<ProductCatalogItem | null>(null);
  const [editingWeightLineId, setEditingWeightLineId] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState<number | "">("");
  const [amountInput, setAmountInput] = useState<number | "">("");
  const [mfgDescInput, setMfgDescInput] = useState<string>("");

  // --- Order Builder Form State ---
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [deliveryDate, setDeliveryDate] = useState<string>("");
  const [deliveryTime, setDeliveryTime] = useState<string>("11:00 AM");
  const [packingDescription, setPackingDescription] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number | "">("");
  const [receivedAmount, setReceivedAmount] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [splitDetails, setSplitDetails] = useState<SplitPaymentDetail>({
    cash: 0,
    upi: 0,
    card: 0,
  });
  const [orderStatus, setOrderStatus] = useState<OrderStatus>("Created");
  const [formValidationErrors, setFormValidationErrors] = useState<{ [key: string]: string }>({});

  // Delete state
  const [deletingOrder, setDeletingOrder] = useState<OrderRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Manual refresh helper
  const fetchOrdersData = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const itemsMap = new Map<string, OrderRecord>();
      snapshot.docs.forEach((docSnap) => {
        itemsMap.set(docSnap.id, {
          id: docSnap.id,
          ...(docSnap.data() as Omit<OrderRecord, "id">),
        });
      });
      const items = Array.from(itemsMap.values());
      setOrders(items);
      setTotalCount(items.length);
    } catch (err) {
      console.error("Refresh error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // --- 1. Realtime Listeners for Orders & Reference Data ---
  useEffect(() => {
    setIsLoading(true);

    // Realtime Orders Listener
    const ordersCol = collection(db, "orders");
    const ordersQuery = query(ordersCol, orderBy("createdAt", "desc"));
    const unsubOrders = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const itemsMap = new Map<string, OrderRecord>();
        snapshot.docs.forEach((docSnap) => {
          itemsMap.set(docSnap.id, {
            id: docSnap.id,
            ...(docSnap.data() as Omit<OrderRecord, "id">),
          });
        });
        const items = Array.from(itemsMap.values());
        setOrders(items);
        setTotalCount(items.length);
        setIsLoading(false);
      },
      (err) => {
        console.error("Realtime orders error:", err);
        setIsLoading(false);
      }
    );

    // Realtime Business Profile Listener
    const unsubProfile = onSnapshot(
      doc(db, "settings", "business_profile"),
      (profileSnap) => {
        if (profileSnap.exists()) {
          const data = profileSnap.data();
          setBusinessProfile((prev) => ({
            ...prev,
            tradeName: data.tradeName || prev.tradeName,
            legalName: data.legalName || prev.legalName,
            phone: data.phone || prev.phone,
            altPhone: data.altPhone || prev.altPhone,
            email: data.email || prev.email,
            address: data.address || prev.address,
            city: data.city || prev.city,
            state: data.state || prev.state,
            pincode: data.pincode || prev.pincode,
          }));
        }
      },
      (err) => console.warn("Realtime profile error:", err)
    );

    // Realtime GST Settings Listener
    const unsubGst = onSnapshot(
      doc(db, "settings", "gst_settings"),
      (gstSnap) => {
        if (gstSnap.exists()) {
          const d = gstSnap.data();
          setGstConfig({
            enabled: !!d.enabled,
            percentage: d.gstPercentage || 5,
            pricingType: d.pricingType === "exclusive" ? "exclusive" : "inclusive",
          });
          if (d.gstNumber) {
            setBusinessProfile((prev) => ({
              ...prev,
              gstNumber: d.gstNumber,
            }));
          }
        }
      },
      (err) => console.warn("Realtime GST error:", err)
    );

    // Realtime Customers Listener
    const unsubCustomers = onSnapshot(
      query(collection(db, "customers"), orderBy("name", "asc")),
      (custSnap) => {
        const cMap = new Map<string, CustomerOption>();
        custSnap.docs.forEach((d) => {
          cMap.set(d.id, {
            id: d.id,
            ...(d.data() as Omit<CustomerOption, "id">),
          });
        });
        setCustomersList(Array.from(cMap.values()));
      },
      (err) => console.warn("Realtime customers error:", err)
    );

    // Realtime Stores Listener
    const unsubStores = onSnapshot(
      query(collection(db, "stores"), orderBy("name", "asc")),
      (storeSnap) => {
        const sMap = new Map<string, StoreOption>();
        storeSnap.docs.forEach((d) => {
          sMap.set(d.id, {
            id: d.id,
            ...(d.data() as Omit<StoreOption, "id">),
          });
        });
        setStoresList(Array.from(sMap.values()));
      },
      (err) => console.warn("Realtime stores error:", err)
    );

    // Realtime Products Listener
    const unsubProducts = onSnapshot(
      query(collection(db, "products"), orderBy("name", "asc")),
      (prodSnap) => {
        const pMap = new Map<string, ProductCatalogItem>();
        prodSnap.docs.forEach((d) => {
          const data = d.data();
          pMap.set(d.id, {
            id: d.id,
            name: data.name || "",
            unit: data.unit || "piece",
            amount: Number(data.amount) || 0,
            imageUrl: data.imageUrl || "",
            categoryName: data.categoryName || "",
            barcode: data.barcode || "",
            shortCode: data.shortCode || "",
            manufacturingUnitId: data.manufacturingUnitId || "",
            manufacturingUnitName: data.manufacturingUnitName || "",
            packingUnitId: data.packingUnitId || "",
            packingUnitName: data.packingUnitName || "",
            piecesPerKg: data.piecesPerKg || "",
          });
        });
        setProductsList(Array.from(pMap.values()));
      },
      (err) => console.warn("Realtime products error:", err)
    );

    const today = new Date().toISOString().split("T")[0];
    setCurrentDateStr(today);
    setCustomStartDate(today);
    setCustomEndDate(today);
    setDeliveryDate(today);

    // Clean up all subscriptions on unmount
    return () => {
      unsubOrders();
      unsubProfile();
      unsubGst();
      unsubCustomers();
      unsubStores();
      unsubProducts();
    };
  }, []);

  // --- 3. Date Filter Computations ---
  const isDateInRange = useCallback(
    (orderDateStr?: string, filter?: DateFilterType) => {
      if (!orderDateStr || !currentDateStr) return true;
      const todayStr = currentDateStr;

      // Helper for days offset
      const getOffsetDate = (days: number) => {
        const d = new Date(todayStr);
        d.setDate(d.getDate() + days);
        return d.toISOString().split("T")[0];
      };

      const now = new Date(todayStr);

    switch (filter) {
      case "today":
        return orderDateStr === todayStr;
      case "yesterday":
        return orderDateStr === getOffsetDate(-1);
      case "this_week": {
        const firstDayOfWeek = new Date(now);
        firstDayOfWeek.setDate(now.getDate() - now.getDay());
        const start = firstDayOfWeek.toISOString().split("T")[0];
        return orderDateStr >= start && orderDateStr <= todayStr;
      }
      case "last_week": {
        const d = new Date(now);
        d.setDate(now.getDate() - now.getDay() - 7);
        const start = d.toISOString().split("T")[0];
        const end = getOffsetDate(-now.getDay() - 1);
        return orderDateStr >= start && orderDateStr <= end;
      }
      case "this_month": {
        const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        return orderDateStr >= start;
      }
      case "last_month": {
        const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const start = `${year}-${String(prevMonth + 1).padStart(2, "0")}-01`;
        const end = `${year}-${String(prevMonth + 1).padStart(2, "0")}-31`;
        return orderDateStr >= start && orderDateStr <= end;
      }
      case "custom":
        return orderDateStr >= customStartDate && orderDateStr <= customEndDate;
      default:
        return true;
    }
  }, [currentDateStr, customStartDate, customEndDate]);

  // Filtered Orders (Deduplicated by ID)
  const filteredOrders = useMemo(() => {
    const seenIds = new Set<string>();
    return orders.filter((o) => {
      if (!o.id || seenIds.has(o.id)) return false;
      seenIds.add(o.id);

      // Exclude Walk-In POS counter billing (should display only in Walk-in Sales)
      if (
        o.packingDescription?.toLowerCase().includes("walk-in pos") ||
        (o as any).source === "walk_in_pos" ||
        (o as any).isWalkInPos ||
        o.orderNumber?.startsWith("POS-")
      ) {
        return false;
      }

      // Date filter check
      const dateToCheck = o.deliveryDate || (o.createdAt?.toDate ? o.createdAt.toDate().toISOString().split("T")[0] : "");
      const matchesDate = isDateInRange(dateToCheck, dateFilter);
      if (!matchesDate) return false;

      // Search filter check
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q) ||
        o.storeName.toLowerCase().includes(q) ||
        o.orderStatus.toLowerCase().includes(q) ||
        o.paymentStatus.toLowerCase().includes(q)
      );
    });
  }, [orders, dateFilter, customStartDate, customEndDate, searchQuery]);

  // Paginated Orders (24 items)
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredOrders.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredOrders, currentPage]);

  // --- 4. Live Calculations (Subtotal, GST, Grand Total, Balance) ---
  const rawItemsTotal = useMemo(() => {
    return selectedItems.reduce((acc, item) => acc + item.totalAmount, 0);
  }, [selectedItems]);

  const numDiscount = discountAmount === "" ? 0 : Number(discountAmount);
  const effectiveItemsTotal = Math.max(0, rawItemsTotal - numDiscount);

  const calculatedFinancials = useMemo(() => {
    let cgst = 0;
    let sgst = 0;
    let grandTotal = effectiveItemsTotal;
    let displaySubtotal = rawItemsTotal;
    let displayDiscount = numDiscount;
    let taxableSubtotal = effectiveItemsTotal;

    if (gstConfig.enabled && gstConfig.percentage > 0) {
      if (gstConfig.pricingType === "inclusive") {
        // INCLUSIVE GST: Prices ALREADY include GST -> Breakdown is required!
        grandTotal = effectiveItemsTotal;

        const baseSubtotal = Number((rawItemsTotal / (1 + gstConfig.percentage / 100)).toFixed(2));
        const baseDiscount = numDiscount > 0 ? Number((numDiscount / (1 + gstConfig.percentage / 100)).toFixed(2)) : 0;
        taxableSubtotal = Number((baseSubtotal - baseDiscount).toFixed(2));

        const totalTax = Number((grandTotal - taxableSubtotal).toFixed(2));
        const halfTax = Number((totalTax / 2).toFixed(2));
        cgst = halfTax;
        sgst = Number((totalTax - halfTax).toFixed(2));

        displaySubtotal = baseSubtotal;
        displayDiscount = baseDiscount;
      } else {
        // EXCLUSIVE GST: Prices DO NOT include GST -> Breakdown is NOT required (added on top)!
        taxableSubtotal = effectiveItemsTotal;
        const halfRate = gstConfig.percentage / 2;
        cgst = Number(((taxableSubtotal * halfRate) / 100).toFixed(2));
        sgst = Number(((taxableSubtotal * halfRate) / 100).toFixed(2));
        grandTotal = Number((taxableSubtotal + cgst + sgst).toFixed(2));

        displaySubtotal = rawItemsTotal;
        displayDiscount = numDiscount;
      }
    }

    const numReceived =
      paymentMethod === "Split"
        ? (splitDetails.cash || 0) + (splitDetails.upi || 0) + (splitDetails.card || 0)
        : receivedAmount === ""
        ? 0
        : Number(receivedAmount);

    const balanceDue = Number((grandTotal - numReceived).toFixed(2));

    let paymentStatus: PaymentStatus = "Unpaid";
    if (numReceived <= 0) paymentStatus = "Unpaid";
    else if (numReceived >= grandTotal) paymentStatus = "Done";
    else paymentStatus = "Partial";

    return {
      rawItemsTotal,
      displaySubtotal,
      numDiscount,
      displayDiscount,
      taxableSubtotal,
      cgst,
      sgst,
      grandTotal,
      numReceived,
      balanceDue,
      paymentStatus,
    };
  }, [
    rawItemsTotal,
    effectiveItemsTotal,
    gstConfig,
    receivedAmount,
    paymentMethod,
    splitDetails,
    numDiscount,
  ]);

  // Keep receivedAmount in sync when split details update
  useEffect(() => {
    if (paymentMethod === "Split") {
      const sum =
        Number(splitDetails.cash || 0) +
        Number(splitDetails.upi || 0) +
        Number(splitDetails.card || 0);
      setReceivedAmount(sum);
    }
  }, [splitDetails, paymentMethod]);

  // --- 5. Catalog Item Click Handler ---
  const handleCatalogItemClick = (product: ProductCatalogItem) => {
    if (modalMode === "view") return;

    const unitLower = product.unit.toLowerCase().trim();
    const isWeightOrLitre =
      unitLower === "kg" ||
      unitLower.includes("kilo") ||
      unitLower === "litre" ||
      unitLower === "liter" ||
      unitLower === "ltr";

    if (isWeightOrLitre) {
      // Open weight modal for custom KG/Litre input
      setEditingWeightLineId(null);
      setWeightModalProduct(product);
      setWeightInput(1); // default 1 KG
      setAmountInput(product.amount); // 1 * rate
      setMfgDescInput("");
    } else {
      // Piece item: increment if exists, else add new
      setSelectedItems((prev) => {
        const existingIdx = prev.findIndex((i) => i.productId === product.id);
        if (existingIdx !== -1) {
          return prev.map((item, idx) =>
            idx === existingIdx
              ? {
                  ...item,
                  quantity: item.quantity + 1,
                  totalAmount: Number(((item.quantity + 1) * item.rate).toFixed(2)),
                }
              : item
          );
        } else {
          const newItem: OrderItem = {
            id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            productId: product.id,
            name: product.name || "",
            unit: product.unit || "piece",
            rate: Number(product.amount) || 0,
            quantity: 1,
            totalAmount: Number(product.amount) || 0,
            manufacturingDescription: "",
            imageUrl: product.imageUrl || "",
          };
          return [...prev, newItem];
        }
      });
    }
  };

  // Open weight modal to edit an existing weight line item
  const handleOpenEditWeightModal = (item: OrderItem) => {
    if (modalMode === "view") return;
    const prod: ProductCatalogItem = {
      id: item.productId,
      name: item.name,
      amount: item.rate,
      unit: item.unit,
      imageUrl: item.imageUrl,
      categoryName: "",
    };
    setEditingWeightLineId(item.id);
    setWeightModalProduct(prod);
    setWeightInput(item.quantity);
    setAmountInput(item.totalAmount);
    setMfgDescInput(item.manufacturingDescription || "");
  };

  // Add or Update Weight / Litre item in selected items list
  const handleConfirmWeightItem = () => {
    if (!weightModalProduct || weightInput === "" || Number(weightInput) <= 0) return;

    const weightVal = Number(weightInput);
    const calculatedLineTotal = Number(
      (weightVal * weightModalProduct.amount).toFixed(2)
    );

    if (editingWeightLineId) {
      // Update existing selected weight item
      setSelectedItems((prev) =>
        prev.map((i) =>
          i.id === editingWeightLineId
            ? {
                ...i,
                quantity: weightVal,
                totalAmount: calculatedLineTotal,
                manufacturingDescription: mfgDescInput.trim() || "",
              }
            : i
        )
      );
    } else {
      // Add as a new item in selected items
      const newItem: OrderItem = {
        id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        productId: weightModalProduct.id,
        name: weightModalProduct.name || "",
        unit: weightModalProduct.unit || "KG",
        rate: Number(weightModalProduct.amount) || 0,
        quantity: weightVal,
        totalAmount: calculatedLineTotal,
        manufacturingDescription: mfgDescInput.trim() || "",
        imageUrl: weightModalProduct.imageUrl || "",
      };

      setSelectedItems((prev) => [...prev, newItem]);
    }

    setWeightModalProduct(null);
    setEditingWeightLineId(null);
  };

  // Update piece item quantity in right panel
  const handleUpdateItemQuantity = (lineId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(lineId);
      return;
    }
    setSelectedItems((prev) =>
      prev.map((i) =>
        i.id === lineId
          ? {
              ...i,
              quantity: newQty,
              totalAmount: Number((newQty * i.rate).toFixed(2)),
            }
          : i
      )
    );
  };

  // Remove item from selected items
  const handleRemoveItem = (lineId: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.id !== lineId));
  };

  // Filtered product catalog for modal
  const filteredCatalog = useMemo(() => {
    if (!productCatalogSearch.trim()) return productsList;
    const q = productCatalogSearch.toLowerCase().trim();
    return productsList.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.shortCode && p.shortCode.toLowerCase().includes(q))
    );
  }, [productsList, productCatalogSearch]);

  // Quick Customer Creation
  const handleSaveQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustomerForm.name.trim() || !quickCustomerForm.phone.trim()) {
      setQuickCustomerError("Customer Name and Mobile Number are required");
      return;
    }

    if (quickCustomerForm.isB2b && !quickCustomerForm.gstNumber.trim()) {
      setQuickCustomerError("GSTIN / GST Number is required for B2B Customers");
      return;
    }

    try {
      const colRef = collection(db, "customers");
      const docRef = await addDoc(colRef, {
        name: quickCustomerForm.name.trim(),
        phone: quickCustomerForm.phone.trim(),
        city: quickCustomerForm.city.trim(),
        email: quickCustomerForm.email.trim(),
        address: quickCustomerForm.address.trim(),
        isB2b: !!quickCustomerForm.isB2b,
        gstNumber: quickCustomerForm.isB2b ? quickCustomerForm.gstNumber.trim().toUpperCase() : "",
        createdAt: serverTimestamp(),
      });

      const created: CustomerOption = {
        id: docRef.id,
        name: quickCustomerForm.name.trim(),
        phone: quickCustomerForm.phone.trim(),
        city: quickCustomerForm.city.trim(),
        email: quickCustomerForm.email.trim(),
        address: quickCustomerForm.address.trim(),
        isB2b: !!quickCustomerForm.isB2b,
        gstNumber: quickCustomerForm.isB2b ? quickCustomerForm.gstNumber.trim().toUpperCase() : "",
      };

      setCustomersList((prev) => [created, ...prev]);
      setSelectedCustomerId(docRef.id);
      setIsQuickCustomerOpen(false);
      setQuickCustomerForm({ name: "", phone: "", city: "", email: "", address: "", isB2b: false, gstNumber: "" });
      setQuickCustomerError("");
      showToast(`Customer "${created.name}" created and selected!`, "success");
    } catch (err: any) {
      showToast("Error creating customer: " + err.message, "error");
    }
  };

  // Open modal in Create mode
  const handleOpenCreateModal = () => {
    setModalMode("create");
    setEditingOrderId(null);
    setEditingWeightLineId(null);
    setSelectedCustomerId("");
    setSelectedStoreId(storesList[0]?.id || "");
    setDeliveryDate(new Date().toISOString().split("T")[0]);
    setDeliveryTime("11:00 AM");
    setPackingDescription("");
    setSelectedItems([]);
    setDiscountAmount("");
    setReceivedAmount("");
    setPaymentMethod("Cash");
    setSplitDetails({ cash: 0, upi: 0, card: 0 });
    setOrderStatus("Created");
    setFormValidationErrors({});
    setIsOrderModalOpen(true);
  };

  // Open modal in View mode (Opens dedicated clean order display)
  const handleOpenViewModal = (order: OrderRecord) => {
    setViewingOrder(order);
  };

  // Open modal in Payment Management mode
  const handleOpenPaymentModal = (order: OrderRecord) => {
    setPaymentManagingOrder(order);
    setInstallmentAmount(order.balanceAmount > 0 ? order.balanceAmount : "");
    setInstallmentMethod("Cash");
    setInstallmentNote("");
  };

  // Record an installment payment
  const handleAddInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentManagingOrder) return;
    const numAmt = Number(installmentAmount);
    if (!numAmt || numAmt <= 0) {
      showToast("Please enter a valid installment amount", "error");
      return;
    }

    setIsAddingInstallment(true);
    try {
      const existingHistory: PaymentInstallment[] =
        paymentManagingOrder.paymentHistory && paymentManagingOrder.paymentHistory.length > 0
          ? [...paymentManagingOrder.paymentHistory]
          : paymentManagingOrder.receivedAmount > 0
          ? [
              {
                id: `inst_init_${Date.now()}`,
                amount: paymentManagingOrder.receivedAmount,
                paymentMethod: paymentManagingOrder.paymentMethod || "Cash",
                date: paymentManagingOrder.createdAt?.toDate
                  ? paymentManagingOrder.createdAt.toDate().toISOString()
                  : new Date().toISOString(),
                note: "Initial Advance / Booking Payment",
              },
            ]
          : [];

      const newInstallment: PaymentInstallment = {
        id: `inst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        amount: numAmt,
        paymentMethod: installmentMethod,
        date: new Date().toISOString(),
        note: installmentNote.trim() || `Installment payment via ${installmentMethod}`,
      };

      const updatedHistory = [...existingHistory, newInstallment];
      const newReceived = Number((paymentManagingOrder.receivedAmount + numAmt).toFixed(2));
      const newBalance = Number(Math.max(0, paymentManagingOrder.grandTotal - newReceived).toFixed(2));

      let newStatus: PaymentStatus = "Unpaid";
      if (newReceived >= paymentManagingOrder.grandTotal) {
        newStatus = "Done";
      } else if (newReceived > 0) {
        newStatus = "Partial";
      }

      const payload = {
        paymentHistory: updatedHistory,
        receivedAmount: newReceived,
        balanceAmount: newBalance,
        paymentStatus: newStatus,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "orders", paymentManagingOrder.id), payload);

      const updatedOrder: OrderRecord = {
        ...paymentManagingOrder,
        paymentHistory: updatedHistory,
        receivedAmount: newReceived,
        balanceAmount: newBalance,
        paymentStatus: newStatus,
      };

      setOrders((prev) =>
        prev.map((o) => (o.id === paymentManagingOrder.id ? updatedOrder : o))
      );

      setPaymentManagingOrder(updatedOrder);
      if (viewingOrder && viewingOrder.id === paymentManagingOrder.id) {
        setViewingOrder(updatedOrder);
      }

      setInstallmentAmount(newBalance > 0 ? newBalance : "");
      setInstallmentNote("");
      showToast(`Payment of ₹${numAmt.toFixed(2)} recorded successfully!`, "success");
    } catch (err: any) {
      console.error("Add installment error:", err);
      showToast("Error recording installment: " + err.message, "error");
    } finally {
      setIsAddingInstallment(false);
    }
  };

  // Open modal in Edit mode
  const handleOpenEditModal = (order: OrderRecord) => {
    setModalMode("edit");
    setEditingOrderId(order.id);
    setEditingWeightLineId(null);
    setSelectedCustomerId(order.customerId);
    setSelectedStoreId(order.storeId);
    setDeliveryDate(order.deliveryDate);
    setDeliveryTime(order.deliveryTime);
    setPackingDescription(order.packingDescription || "");
    setSelectedItems(order.items || []);
    setDiscountAmount(order.discount || "");
    setReceivedAmount(order.receivedAmount || "");
    setPaymentMethod(order.paymentMethod || "Cash");
    setSplitDetails(order.splitDetails || { cash: 0, upi: 0, card: 0 });
    setOrderStatus(order.orderStatus);
    setFormValidationErrors({});
    setIsOrderModalOpen(true);
  };

  // Validate Order Form
  const validateOrderForm = () => {
    const errors: { [key: string]: string } = {};
    if (!selectedCustomerId) errors.customer = "Please select or add a customer";
    if (!selectedStoreId) errors.store = "Please select a store";
    if (!deliveryDate) errors.deliveryDate = "Delivery date is required";
    if (selectedItems.length === 0) errors.items = "Please select at least one item";
    setFormValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save Order (Create or Update - Optimistic in-memory update)
  const handleSaveOrder = async () => {
    if (!validateOrderForm()) {
      showToast("Please fill in all required order specifications", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const cust = customersList.find((c) => c.id === selectedCustomerId);
      const store = storesList.find((s) => s.id === selectedStoreId);

      // Generate full numeric order number: YYMMDDHHMMSS (Year, Month, Date, Hours, Minutes, Seconds)
      const generateNumericOrderNumber = () => {
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        const hh = String(now.getHours()).padStart(2, "0");
        const min = String(now.getMinutes()).padStart(2, "0");
        const ss = String(now.getSeconds()).padStart(2, "0");
        let candidate = `${yy}${mm}${dd}${hh}${min}${ss}`;
        const existingNumbers = new Set(orders.map((o) => o.orderNumber));
        if (existingNumbers.has(candidate)) {
          const ms = String(now.getMilliseconds()).padStart(3, "0").slice(0, 2);
          candidate = `${yy}${mm}${dd}${hh}${min}${ms}`;
        }
        return candidate;
      };

      const generatedNumber =
        editingOrderId && orders.find((o) => o.id === editingOrderId)?.orderNumber
          ? orders.find((o) => o.id === editingOrderId)!.orderNumber
          : generateNumericOrderNumber();

      const sanitizedItems = selectedItems.map((item) => {
        const prod = productsList.find((p) => p.id === item.productId);
        return {
          id: item.id || `line_${Date.now()}`,
          productId: item.productId || "",
          name: item.name || "",
          unit: item.unit || "piece",
          rate: Number(item.rate) || 0,
          quantity: Number(item.quantity) || 0,
          totalAmount: Number(item.totalAmount) || 0,
          manufacturingDescription: item.manufacturingDescription || "",
          imageUrl: item.imageUrl || "",
          manufacturingUnitId: item.manufacturingUnitId || prod?.manufacturingUnitId || "",
          manufacturingUnitName: item.manufacturingUnitName || prod?.manufacturingUnitName || "",
          packingUnitId: item.packingUnitId || prod?.packingUnitId || "",
          packingUnitName: item.packingUnitName || prod?.packingUnitName || "",
          piecesPerKg: item.piecesPerKg || prod?.piecesPerKg || "",
          status: item.status || "Created",
        };
      });

      const rawOrderPayload: any = {
        orderNumber: generatedNumber,
        customerId: selectedCustomerId || "",
        customerName: cust?.name || "Walk-In Customer",
        customerPhone: cust?.phone || "",
        customerAddress: cust?.address || "",
        customerGstNumber: cust?.gstNumber || "",
        isB2b: !!cust?.isB2b,
        storeId: selectedStoreId || "",
        storeName: store?.name || "Main Chirala Store",
        deliveryDate: deliveryDate || "",
        deliveryTime: deliveryTime || "11:00 AM",
        packingDescription: (packingDescription || "").trim(),
        items: sanitizedItems,
        subtotal: calculatedFinancials.displaySubtotal || 0,
        discount: calculatedFinancials.displayDiscount || 0,
        taxableSubtotal: calculatedFinancials.taxableSubtotal || 0,
        isGstEnabled: !!gstConfig.enabled,
        gstPercentage: gstConfig.percentage || 0,
        cgst: calculatedFinancials.cgst || 0,
        sgst: calculatedFinancials.sgst || 0,
        gstType: gstConfig.pricingType || "inclusive",
        grandTotal: calculatedFinancials.grandTotal || 0,
        receivedAmount: calculatedFinancials.numReceived || 0,
        balanceAmount: calculatedFinancials.balanceDue || 0,
        paymentMethod: paymentMethod || "Cash",
        splitDetails:
          paymentMethod === "Split"
            ? {
                cash: Number(splitDetails?.cash) || 0,
                upi: Number(splitDetails?.upi) || 0,
                card: Number(splitDetails?.card) || 0,
              }
            : null,
        paymentStatus: calculatedFinancials.paymentStatus || "Unpaid",
        orderStatus: orderStatus || "Created",
        paymentHistory:
          editingOrderId && orders.find((o) => o.id === editingOrderId)?.paymentHistory
            ? orders.find((o) => o.id === editingOrderId)!.paymentHistory
            : calculatedFinancials.numReceived > 0
            ? [
                {
                  id: `inst_init_${Date.now()}`,
                  amount: calculatedFinancials.numReceived,
                  paymentMethod: paymentMethod || "Cash",
                  date: new Date().toISOString(),
                  note: "Initial Advance / Booking Payment",
                },
              ]
            : [],
        updatedAt: serverTimestamp(),
      };

      // Safeguard against any undefined fields in Firestore writes
      const sanitizeForFirestore = (obj: any): any => {
        if (obj === undefined) return null;
        if (obj === null) return null;
        if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
        if (typeof obj === "object") {
          if (
            obj instanceof Timestamp ||
            obj instanceof Date ||
            obj?._methodName ||
            obj?.constructor?.name === "FieldValue"
          ) {
            return obj;
          }
          const clean: Record<string, any> = {};
          for (const [key, val] of Object.entries(obj)) {
            clean[key] = val === undefined ? null : sanitizeForFirestore(val);
          }
          return clean;
        }
        return obj;
      };

      const orderPayload = sanitizeForFirestore(rawOrderPayload);

      if (editingOrderId) {
        // Update Order
        const orderRef = doc(db, "orders", editingOrderId);
        await updateDoc(orderRef, orderPayload);

        setOrders((prev) =>
          prev.map((o) =>
            o.id === editingOrderId
              ? {
                  ...o,
                  ...orderPayload,
                }
              : o
          )
        );

        showToast(`Order "${generatedNumber}" updated successfully!`, "success");
        setIsOrderModalOpen(false);
      } else {
        // Create Order
        const colRef = collection(db, "orders");
        const docRef = await addDoc(colRef, {
          ...orderPayload,
          createdAt: serverTimestamp(),
        });

        const createdOrder: OrderRecord = {
          id: docRef.id,
          ...orderPayload,
        };

        setIsOrderModalOpen(false);
        setCreatedOrderForPrint(createdOrder);
        showToast(`Order "${generatedNumber}" created successfully!`, "success");
      }
    } catch (err: any) {
      console.error("Save order error:", err);
      showToast("Error saving order: " + (err.message || "Unknown error"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for thermal print
  const handlePrintThermal = (order: OrderRecord) => {
    printReceipt({
      orderNumber: order.orderNumber,
      dateStr: order.deliveryDate || new Date().toISOString().split("T")[0],
      timeStr: order.deliveryTime || "",
      storeName: order.storeName,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      items: order.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        rate: i.rate,
        totalAmount: i.totalAmount,
      })),
      subtotal: order.subtotal,
      discount: order.discount,
      taxableSubtotal: order.taxableSubtotal,
      cgst: order.cgst,
      sgst: order.sgst,
      grandTotal: order.grandTotal,
      paymentMethod: order.paymentMethod,
      splitDetails: order.splitDetails,
    });
  };

  // Helper for opening A4 Tax Invoice modal
  const handleOpenA4Invoice = (order: OrderRecord) => {
    setA4InvoiceOrder(order);
  };

  // Delete Order
  const handleConfirmDeleteOrder = async () => {
    if (!deletingOrder) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "orders", deletingOrder.id));
      setOrders((prev) => prev.filter((o) => o.id !== deletingOrder.id));
      setTotalCount((prev) => Math.max(0, prev - 1));
      showToast(`Order "${deletingOrder.orderNumber}" deleted successfully!`, "success");
      setDeletingOrder(null);
    } catch (err: any) {
      showToast("Error deleting order: " + err.message, "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Helpers for Status Badges
  const getOrderStatusBadgeClass = (status: OrderStatus) => {
    switch (status) {
      case "Created":
        return "bg-sky-50 text-[#348bdd] border-sky-200";
      case "Manufacturing In Progress":
        return "bg-amber-50 text-amber-600 border-amber-200";
      case "Manufacturing Completed":
        return "bg-purple-50 text-purple-600 border-purple-200";
      case "Moved to Packing":
      case "Received at Packing":
      case "Packing In Progress":
        return "bg-indigo-50 text-indigo-600 border-indigo-200";
      case "Packing Completed":
        return "bg-cyan-50 text-cyan-700 border-cyan-200";
      case "Moved to Store":
      case "Received at Store":
        return "bg-orange-50 text-orange-600 border-orange-200";
      case "Delivered":
        return "bg-emerald-50 text-emerald-600 border-emerald-200";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  const getPaymentStatusBadgeClass = (status: PaymentStatus) => {
    switch (status) {
      case "Done":
        return "bg-emerald-50 text-emerald-600 border-emerald-200";
      case "Partial":
        return "bg-amber-50 text-amber-600 border-amber-200";
      case "Unpaid":
        return "bg-rose-50 text-rose-600 border-rose-200";
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
              <ShoppingCart size={18} />
            </div>
            <h1
              className="text-2xl text-[var(--color-text-primary)] tracking-tight"
              style={{ fontWeight: 500 }}
            >
              Orders
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
            Advance party bookings, sweet manufacturing workflows, delivery schedules, and tax invoicing.
          </p>
        </div>

        {/* Actions: Refresh & Add Order Button */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchOrdersData}
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
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-md text-white transition-opacity hover:opacity-90 font-normal shadow-xs cursor-pointer"
            style={{ backgroundColor: "var(--color-brand-primary)" }}
          >
            <Plus size={15} />
            <span>Add Order</span>
          </button>
        </div>
      </div>

      {/* Search and Date Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Search Box */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border w-full sm:w-72 bg-white"
            style={{
              borderColor: "var(--color-border-base)",
            }}
          >
            <Search size={14} style={{ color: "var(--color-text-muted)" }} />
            <input
              type="text"
              placeholder="Search order #, customer, store..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs bg-transparent focus:outline-none"
              style={{ color: "var(--color-text-primary)" }}
            />
          </div>

          {/* Date Filter Buttons */}
          <div className="flex items-center gap-1 border rounded-md p-0.5 bg-white shadow-2xs" style={{ borderColor: "var(--color-border-base)" }}>
            {(
              [
                { id: "today", label: "Today" },
                { id: "yesterday", label: "Yesterday" },
                { id: "this_week", label: "This Week" },
                { id: "last_week", label: "Last Week" },
                { id: "this_month", label: "This Month" },
                { id: "all", label: "All Time" },
                { id: "custom", label: "Custom" },
              ] as { id: DateFilterType; label: string }[]
            ).map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => {
                  setDateFilter(filter.id);
                  setCurrentPage(1);
                }}
                className={`px-2 py-1 text-[11px] rounded transition-colors cursor-pointer font-medium ${
                  dateFilter === filter.id
                    ? "bg-[#348bdd] text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          {dateFilter === "custom" && (
            <div className="flex items-center gap-1.5 text-xs">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2 py-1 border rounded-md text-xs bg-white text-slate-700"
                style={{ borderColor: "var(--color-border-base)" }}
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2 py-1 border rounded-md text-xs bg-white text-slate-700"
                style={{ borderColor: "var(--color-border-base)" }}
              />
            </div>
          )}
        </div>

        <div
          className="text-xs self-end sm:self-center font-normal"
          style={{ color: "var(--color-text-muted)" }}
        >
          Showing {paginatedOrders.length} of {filteredOrders.length} (Limit: 24/page)
        </div>
      </div>

      {/* Main Table / Grid List (Supabase Table Editor Grid Style) */}
      <div
        className="rounded-lg border bg-white overflow-hidden shadow-xs"
        style={{ borderColor: "var(--color-border-base)" }}
      >
        {isLoading && orders.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2
              size={24}
              className="animate-spin"
              style={{ color: "var(--color-brand-primary)" }}
            />
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Loading orders from database...
            </span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center p-6">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                color: "var(--color-text-muted)",
              }}
            >
              <ShoppingCart size={22} />
            </div>
            <h3
              className="text-sm text-[var(--color-text-primary)]"
              style={{ fontWeight: 500 }}
            >
              No orders found
            </h3>
            <p className="text-xs mt-1 max-w-sm" style={{ color: "var(--color-text-muted)" }}>
              {searchQuery
                ? "No orders match your search keyword or selected date range."
                : `No orders found for the selected period. Click 'Add Order' to create an order.`}
            </p>
            {!searchQuery && (
              <button
                onClick={handleOpenCreateModal}
                className="mt-4 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md text-white font-normal cursor-pointer"
                style={{ backgroundColor: "var(--color-brand-primary)" }}
              >
                <Plus size={14} />
                <span>Add Order Now</span>
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
                <th className="px-3 py-2 text-center w-10 font-medium bg-slate-50/50">
                  <input
                    type="checkbox"
                    checked={
                      paginatedOrders.length > 0 &&
                      paginatedOrders.every((o) => selectedIds.has(o.id))
                    }
                    onChange={() => {
                      if (paginatedOrders.every((o) => selectedIds.has(o.id))) {
                        setSelectedIds(new Set());
                      } else {
                        setSelectedIds(new Set(paginatedOrders.map((o) => o.id)));
                      }
                    }}
                    className="rounded border-slate-300 text-[var(--color-brand-primary)] focus:ring-0 cursor-pointer h-3.5 w-3.5"
                  />
                </th>

                {/* Order ID */}
                <th className="px-3.5 py-2 font-medium bg-slate-50/50 min-w-[130px]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-slate-800">order_number</span>
                    <span className="text-[10px] font-mono text-slate-400">varchar</span>
                  </div>
                </th>

                {/* Customer */}
                <th className="px-3.5 py-2 font-medium bg-slate-50/50 min-w-[160px]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-slate-800">customer</span>
                    <span className="text-[10px] font-mono text-slate-400">entity</span>
                  </div>
                </th>

                {/* Store */}
                <th className="px-3.5 py-2 font-medium bg-slate-50/50 min-w-[120px]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-slate-800">store</span>
                    <span className="text-[10px] font-mono text-slate-400">varchar</span>
                  </div>
                </th>

                {/* Delivery Date & Time */}
                <th className="px-3.5 py-2 font-medium bg-slate-50/50 min-w-[140px]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-slate-800">delivery_schedule</span>
                    <span className="text-[10px] font-mono text-slate-400">timestamp</span>
                  </div>
                </th>

                {/* Items Summary */}
                <th className="px-3.5 py-2 font-medium bg-slate-50/50 min-w-[130px]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-slate-800">items</span>
                    <span className="text-[10px] font-mono text-slate-400">array</span>
                  </div>
                </th>

                {/* Grand Total */}
                <th className="px-3.5 py-2 font-medium bg-slate-50/50 text-right min-w-[100px]">
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="font-medium text-slate-800">grand_total</span>
                    <span className="text-[10px] font-mono text-slate-400">inr</span>
                  </div>
                </th>

                {/* Order Status */}
                <th className="px-3.5 py-2 font-medium bg-slate-50/50 min-w-[160px]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-slate-800">order_status</span>
                    <span className="text-[10px] font-mono text-slate-400">enum</span>
                  </div>
                </th>

                {/* Payment Status */}
                <th className="px-3.5 py-2 font-medium bg-slate-50/50 min-w-[120px]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-slate-800">payment</span>
                    <span className="text-[10px] font-mono text-slate-400">status</span>
                  </div>
                </th>

                {/* Actions */}
                <th className="px-3 py-2 font-medium text-right bg-slate-50/50 w-28">
                  <div className="flex items-center justify-end gap-1">
                    <span className="font-medium text-slate-800">actions</span>
                    <span className="text-[10px] font-mono text-slate-400">menu</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedOrders.map((o, idx) => {
                const isSelected = selectedIds.has(o.id);
                return (
                  <tr
                    key={o.id ? `${o.id}_${idx}` : `order_${idx}`}
                    className={`divide-x divide-slate-200 transition-colors ${
                      isSelected ? "bg-sky-50/60" : "hover:bg-slate-50/80"
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(o.id)) next.delete(o.id);
                            else next.add(o.id);
                            return next;
                          });
                        }}
                        className="rounded border-slate-300 text-[var(--color-brand-primary)] focus:ring-0 cursor-pointer h-3.5 w-3.5"
                      />
                    </td>

                    {/* Order Number with Inspect Link */}
                    <td className="px-3.5 py-2 font-mono text-[11px] text-slate-800 font-medium">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[#348bdd]">{o.orderNumber}</span>
                        <button
                          onClick={() => handleOpenViewModal(o)}
                          className="w-5 h-5 rounded flex items-center justify-center bg-slate-100 hover:bg-sky-50 text-slate-500 hover:text-[#348bdd] border border-slate-200/70 transition-colors cursor-pointer"
                          title="View order specification"
                        >
                          <ArrowRight size={11} />
                        </button>
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="px-3.5 py-2 text-slate-900">
                      <div className="font-medium text-xs truncate max-w-[160px]">
                        {o.customerName}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {o.customerPhone || "—"}
                      </div>
                    </td>

                    {/* Store */}
                    <td className="px-3.5 py-2 text-slate-700 truncate max-w-[130px]">
                      {o.storeName}
                    </td>

                    {/* Delivery Date & Time */}
                    <td className="px-3.5 py-2 text-slate-800 font-mono text-[11px]">
                      <div>{o.deliveryDate}</div>
                      <div className="text-[10px] text-slate-400">{o.deliveryTime}</div>
                    </td>

                    {/* Items Summary */}
                    <td className="px-3.5 py-2 text-slate-600 text-[11px]">
                      <span className="font-medium text-slate-800">
                        {o.items?.length || 0} items
                      </span>
                      <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                        {o.items?.map((i) => i.name).join(", ") || "—"}
                      </div>
                    </td>

                    {/* Grand Total */}
                    <td className="px-3.5 py-2 text-right font-mono font-medium text-slate-900 text-xs">
                      ₹{Number(o.grandTotal).toFixed(2)}
                    </td>

                    {/* Order Status Badge */}
                    <td className="px-3.5 py-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${getOrderStatusBadgeClass(
                          o.orderStatus
                        )}`}
                      >
                        {o.orderStatus}
                      </span>
                    </td>

                    {/* Payment Status Badge */}
                    <td className="px-3.5 py-2">
                      <div className="space-y-0.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${getPaymentStatusBadgeClass(
                            o.paymentStatus
                          )}`}
                        >
                          {o.paymentStatus}
                        </span>
                        {o.balanceAmount > 0 && (
                          <div className="text-[10px] font-mono text-rose-500">
                            Due: ₹{o.balanceAmount.toFixed(0)}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Actions: View, Thermal Print, A4, Payment, Edit, Delete */}
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Thermal Print */}
                        <button
                          onClick={() => handlePrintThermal(o)}
                          className="w-7 h-7 rounded-md flex items-center justify-center transition-all bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 cursor-pointer shadow-2xs"
                          title="Print Thermal Receipt"
                        >
                          <Printer size={13} />
                        </button>

                        {/* A4 Tax Invoice */}
                        <button
                          onClick={() => handleOpenA4Invoice(o)}
                          className="w-7 h-7 rounded-md flex items-center justify-center transition-all bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 border border-indigo-100 cursor-pointer shadow-2xs"
                          title="Print A4 Tax Invoice"
                        >
                          <FileText size={13} />
                        </button>

                        {/* View - Sky blue */}
                        <button
                          onClick={() => handleOpenViewModal(o)}
                          className="w-7 h-7 rounded-md flex items-center justify-center transition-all bg-sky-50 text-[#348bdd] hover:bg-sky-100 hover:text-[#2377c8] border border-sky-100 cursor-pointer shadow-2xs"
                          title="View order specifications"
                        >
                          <Eye size={13} />
                        </button>

                        {/* Payment Management - Emerald */}
                        <button
                          onClick={() => handleOpenPaymentModal(o)}
                          className="w-7 h-7 rounded-md flex items-center justify-center transition-all bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 border border-emerald-100 cursor-pointer shadow-2xs"
                          title="Manage Payments & Installments"
                        >
                          <CreditCard size={13} />
                        </button>

                        {/* Edit - Amber */}
                        <button
                          onClick={() => handleOpenEditModal(o)}
                          className="w-7 h-7 rounded-md flex items-center justify-center transition-all bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 border border-amber-100 cursor-pointer shadow-2xs"
                          title="Edit order"
                        >
                          <Edit2 size={13} />
                        </button>

                        {/* Delete - Rose */}
                        <button
                          onClick={() => setDeletingOrder(o)}
                          className="w-7 h-7 rounded-md flex items-center justify-center transition-all bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 border border-rose-100 cursor-pointer shadow-2xs"
                          title="Delete order"
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
        {!isLoading && filteredOrders.length > 0 && (
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

      {/* =========================================================================
          4. FULL SCREEN MODAL: CREATE / EDIT / VIEW ORDER
         ========================================================================= */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden animate-in fade-in duration-150">
          {/* Modal Header */}
          <div
            className="px-6 py-3 border-b flex items-center justify-between gap-4 shrink-0 bg-white"
            style={{ borderColor: "var(--color-border-subtle)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center border bg-slate-50 text-[#348bdd]"
                style={{ borderColor: "var(--color-border-base)" }}
              >
                <ShoppingCart size={17} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2
                    className="text-sm font-medium text-[var(--color-text-primary)]"
                  >
                    {modalMode === "create"
                      ? "Create Advance Customer Order"
                      : modalMode === "edit"
                      ? `Edit Order #${orders.find((o) => o.id === editingOrderId)?.orderNumber || ""}`
                      : `Order Specification #${orders.find((o) => o.id === editingOrderId)?.orderNumber || ""}`}
                  </h2>
                  <span
                    className={`px-2 py-0.5 text-[10px] rounded uppercase tracking-wider font-mono border ${getOrderStatusBadgeClass(
                      orderStatus
                    )}`}
                  >
                    {orderStatus}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {modalMode === "view"
                    ? "Read-only view of order specifications, items breakdown, and payment status."
                    : "Add sweets, configure weights, schedule packing, and record advance payment."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Order Status Selector in Modal (Editable in create/edit) */}
              {modalMode !== "view" && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400 text-[11px] font-mono">STATUS:</span>
                  <select
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value as OrderStatus)}
                    className="text-xs px-2.5 py-1 rounded-md border bg-slate-50 text-slate-800 font-medium focus:outline-none cursor-pointer"
                    style={{ borderColor: "var(--color-border-base)" }}
                  >
                    {ORDER_STATUS_LIST.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsOrderModalOpen(false)}
                className="p-1.5 rounded-md hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Close modal (Esc)"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Modal Body: Flex Layout with Left Catalog & Right Compact Checkout Panel */}
          <div className="flex-1 overflow-hidden flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-200 bg-slate-50/30">
            {/* -------------------------------------------------------------
                LEFT SIDE: Customer, Store, Delivery & Items Catalog (Expands)
               ------------------------------------------------------------- */}
            <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-white">
              {/* Top Section: Customer, Store, Delivery Date/Time, Packing Note */}
              <div
                className="p-4 border-b space-y-3 shrink-0 bg-slate-50/40"
                style={{ borderColor: "var(--color-border-subtle)" }}
              >
                {/* Row 1: Customer Selection & Quick Add */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      className="text-xs uppercase tracking-wider font-medium text-slate-600"
                    >
                      Customer <span className="text-red-500">*</span>
                    </label>
                    {modalMode !== "view" && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuickCustomerError("");
                          setIsQuickCustomerOpen(true);
                        }}
                        className="text-[11px] text-[#348bdd] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                      >
                        <Plus size={12} />
                        <span>Add New Customer</span>
                      </button>
                    )}
                  </div>

                  <SearchableSelect
                    options={customersList.map((c) => ({
                      value: c.id,
                      label: c.name,
                      sublabel: c.phone ? `+91 ${c.phone}${c.city ? ` • ${c.city}` : ""}` : undefined,
                    }))}
                    value={selectedCustomerId}
                    onChange={(val) => {
                      setSelectedCustomerId(val);
                      if (formValidationErrors.customer) {
                        setFormValidationErrors({ ...formValidationErrors, customer: "" });
                      }
                    }}
                    placeholder="Choose Customer from CRM Directory..."
                    error={formValidationErrors.customer}
                    disabled={modalMode === "view"}
                  />
                </div>

                {/* Row 2: Store, Delivery Date, Delivery Time */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Store */}
                  <div>
                    <label className="block text-xs uppercase tracking-wider mb-1 font-medium text-slate-600">
                      Store <span className="text-red-500">*</span>
                    </label>
                    <SearchableSelect
                      options={storesList.map((s) => ({
                        value: s.id,
                        label: s.name,
                        sublabel: s.address,
                      }))}
                      value={selectedStoreId}
                      onChange={(val) => {
                        setSelectedStoreId(val);
                        if (formValidationErrors.store) {
                          setFormValidationErrors({ ...formValidationErrors, store: "" });
                        }
                      }}
                      placeholder="Select Store..."
                      error={formValidationErrors.store}
                      disabled={modalMode === "view"}
                    />
                  </div>

                  {/* Delivery Date */}
                  <div>
                    <label className="block text-xs uppercase tracking-wider mb-1 font-medium text-slate-600">
                      Delivery Date <span className="text-red-500">*</span>
                    </label>
                    <div
                      className="flex items-center gap-1.5 px-3 py-2 rounded-md border bg-white focus-within:ring-1 focus-within:ring-[var(--color-brand-primary)]"
                      style={{ borderColor: "var(--color-border-base)" }}
                    >
                      <Calendar size={14} className="text-slate-400 shrink-0" />
                      <input
                        type="date"
                        value={deliveryDate}
                        disabled={modalMode === "view"}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        className="w-full text-xs bg-transparent focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Delivery Time */}
                  <div>
                    <label className="block text-xs uppercase tracking-wider mb-1 font-medium text-slate-600">
                      Delivery Time
                    </label>
                    <div
                      className="flex items-center gap-1.5 px-3 py-2 rounded-md border bg-white focus-within:ring-1 focus-within:ring-[var(--color-brand-primary)]"
                      style={{ borderColor: "var(--color-border-base)" }}
                    >
                      <Clock size={14} className="text-slate-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="e.g. 11:00 AM"
                        value={deliveryTime}
                        disabled={modalMode === "view"}
                        onChange={(e) => setDeliveryTime(e.target.value)}
                        className="w-full text-xs bg-transparent focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 3: Packing Description */}
                <div>
                  <label className="block text-xs uppercase tracking-wider mb-1 font-medium text-slate-600">
                    Packing Description & Instructions <span className="text-slate-400 font-normal lowercase">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Pack into 1/2 KG gift boxes with golden ribbon and customized family tag"
                    value={packingDescription}
                    disabled={modalMode === "view"}
                    onChange={(e) => setPackingDescription(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                    style={{ borderColor: "var(--color-border-base)" }}
                  />
                </div>
              </div>

              {/* Items Catalog Search & Selection */}
              <div className="flex-1 flex flex-col overflow-hidden p-4">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider font-mono font-medium text-slate-700">
                      Select Sweets & Products
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      (Click sweet to add; weight items prompt for KG)
                    </span>
                  </div>

                  {/* Search inside catalog */}
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border bg-slate-50 focus-within:bg-white focus-within:ring-1 focus-within:ring-[var(--color-brand-primary)]"
                    style={{ borderColor: "var(--color-border-base)", width: "220px" }}
                  >
                    <Search size={12} className="text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Filter sweets..."
                      value={productCatalogSearch}
                      onChange={(e) => setProductCatalogSearch(e.target.value)}
                      className="w-full text-xs bg-transparent focus:outline-none"
                    />
                  </div>
                </div>

                {formValidationErrors.items && (
                  <p className="text-[11px] text-red-500 mb-2">
                    {formValidationErrors.items}
                  </p>
                )}

                {/* Products Grid - E-commerce Product Tile Layout (Compact & Non-stretching) */}
                <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5 pr-1 pb-4 content-start items-start">
                  {filteredCatalog.map((prod, pIdx) => {
                    const isWeight =
                      prod.unit.toLowerCase() === "kg" ||
                      prod.unit.toLowerCase().includes("kilo") ||
                      prod.unit.toLowerCase().includes("litre") ||
                      prod.unit.toLowerCase().includes("liter");

                    const inCartCount = selectedItems
                      .filter((i) => i.productId === prod.id)
                      .reduce((acc, i) => acc + i.quantity, 0);

                    return (
                      <div
                        key={prod.id ? `${prod.id}_${pIdx}` : `prod_${pIdx}`}
                        onClick={() => handleCatalogItemClick(prod)}
                        className={`rounded-xl border p-2.5 flex flex-col transition-all cursor-pointer select-none group relative bg-white hover:border-[#348bdd] hover:shadow-md ${
                          inCartCount > 0
                            ? "border-[#348bdd] ring-1 ring-[#348bdd] bg-sky-50/15"
                            : "border-slate-200 shadow-2xs"
                        }`}
                      >
                        {/* Selected quantity badge */}
                        {inCartCount > 0 && (
                          <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 rounded-full bg-[#348bdd] text-white text-[9px] font-mono font-medium shadow-xs">
                            {isWeight ? `${inCartCount} ${prod.unit}` : `x${inCartCount}`}
                          </div>
                        )}

                        {/* 1. Image on top */}
                        <div className="w-full h-28 sm:h-32 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center p-2 relative group-hover:bg-white transition-colors shrink-0">
                          <img
                            src={prod.imageUrl || "/logo.png"}
                            alt={prod.name}
                            className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-105"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/logo.png";
                            }}
                          />
                        </div>

                        {/* 2. Below Image: Product Name & Category */}
                        <div className="pt-2">
                          <div className="text-xs font-medium text-slate-800 line-clamp-2 leading-snug group-hover:text-[#348bdd]">
                            {prod.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                            {prod.categoryName || "General"}
                          </div>
                        </div>

                        {/* 3. Below Name: Price & Unit */}
                        <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between">
                          <div className="flex items-baseline gap-1">
                            <span className="font-mono text-sm font-semibold text-slate-900">
                              ₹{prod.amount}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                              /{prod.unit}
                            </span>
                          </div>

                          <span className="px-1.5 py-0.5 rounded bg-slate-100 group-hover:bg-sky-50 group-hover:text-[#348bdd] text-slate-600 font-mono text-[10px] font-medium transition-colors">
                            {isWeight ? "Weight" : "Piece"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* -------------------------------------------------------------
                RIGHT SIDE: Compact Order Cart, Bill Breakdown & Payment
               ------------------------------------------------------------- */}
            <div className="w-full lg:w-[360px] xl:w-[390px] shrink-0 flex flex-col h-full overflow-hidden bg-white">
              {/* Header: Selected Items Count & Clear */}
              <div
                className="px-4 py-2.5 border-b bg-slate-50 flex items-center justify-between shrink-0"
                style={{ borderColor: "var(--color-border-subtle)" }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-800">
                    Selected Items ({selectedItems.length})
                  </span>
                  {gstConfig.enabled && (
                    <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      GST {gstConfig.percentage}% ({gstConfig.pricingType})
                    </span>
                  )}
                </div>

                {modalMode !== "view" && selectedItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedItems([])}
                    className="text-[11px] text-rose-500 hover:text-rose-700 cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Selected Items Scrollable List */}
              <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
                {selectedItems.length === 0 ? (
                  <div className="h-44 flex flex-col items-center justify-center text-slate-400 gap-1.5">
                    <Boxes size={24} className="text-slate-300 stroke-[1.5]" />
                    <span className="text-xs">No items selected yet</span>
                    <span className="text-[11px] text-slate-400">
                      Click sweets from the left catalogue to add
                    </span>
                  </div>
                ) : (
                  selectedItems.map((item, idx) => {
                    const isPiece =
                      item.unit.toLowerCase() === "piece" ||
                      item.unit.toLowerCase() === "pcs" ||
                      item.unit.toLowerCase() === "box";

                    return (
                      <div key={item.id ? `${item.id}_${idx}` : `item_${idx}`} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-slate-900 truncate">
                              {item.name}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              ₹{item.rate} / {item.unit}
                            </div>
                          </div>

                          {/* Quantity control or weight display */}
                          <div className="flex items-center gap-2">
                            {isPiece && modalMode !== "view" ? (
                              <div className="flex items-center border rounded bg-white shadow-2xs" style={{ borderColor: "var(--color-border-base)" }}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateItemQuantity(item.id, item.quantity - 1)
                                  }
                                  className="p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"
                                >
                                  <Minus size={11} />
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    handleUpdateItemQuantity(
                                      item.id,
                                      Math.max(1, Number(e.target.value))
                                    )
                                  }
                                  className="w-10 text-center text-xs font-mono bg-transparent focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateItemQuantity(item.id, item.quantity + 1)
                                  }
                                  className="p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"
                                >
                                  <Plus size={11} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-mono font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                  {item.quantity} {item.unit}
                                </span>
                                {modalMode !== "view" && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditWeightModal(item)}
                                    className="p-1 rounded text-slate-400 hover:text-[#348bdd] hover:bg-sky-50 transition-colors cursor-pointer"
                                    title="Edit weight & notes"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Line Subtotal */}
                            <span className="font-mono text-xs font-medium text-slate-900 w-16 text-right">
                              ₹{item.totalAmount.toFixed(2)}
                            </span>

                            {/* Remove button */}
                            {modalMode !== "view" && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                className="text-slate-300 hover:text-rose-500 p-0.5 cursor-pointer"
                                title="Remove item"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Manufacturing Instruction note if any */}
                        {item.manufacturingDescription && (
                          <div className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60 flex items-center gap-1 font-mono">
                            <Factory size={11} />
                            <span>Kitchen note: {item.manufacturingDescription}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Financials, GST & Payment Collection */}
              <div
                className="p-4 border-t bg-slate-50/70 space-y-3 shrink-0"
                style={{ borderColor: "var(--color-border-subtle)" }}
              >
                {/* Discount & Subtotal summary */}
                <div className="space-y-1.5 text-xs">
                  {/* Subtotal */}
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono font-medium text-slate-800">
                      ₹{calculatedFinancials.displaySubtotal.toFixed(2)}
                    </span>
                  </div>

                  {/* Discount input */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 flex items-center gap-1">
                      <Percent size={12} className="text-slate-400" />
                      <span>Discount (₹):</span>
                    </span>
                    <div className="w-24">
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        disabled={modalMode === "view"}
                        value={discountAmount}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        onChange={(e) =>
                          setDiscountAmount(e.target.value === "" ? "" : Number(e.target.value))
                        }
                        className="w-full text-right text-xs px-2 py-0.5 rounded border bg-white focus:outline-none font-mono"
                        style={{ borderColor: "var(--color-border-base)" }}
                      />
                    </div>
                  </div>

                  {calculatedFinancials.numDiscount > 0 && (
                    <div className="flex items-center justify-between text-emerald-600 text-[11px]">
                      <span>Discount Applied:</span>
                      <span className="font-mono font-medium">
                        -₹{calculatedFinancials.displayDiscount.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {/* GST Breakdown (if enabled) */}
                  {gstConfig.enabled && (calculatedFinancials.cgst > 0 || calculatedFinancials.sgst > 0) && (
                    <div className="space-y-1 pt-1 border-t border-slate-200 text-slate-600 font-mono text-[11px]">
                      <div className="flex justify-between">
                        <span>CGST ({gstConfig.percentage / 2}%):</span>
                        <span className="font-medium text-slate-800">₹{calculatedFinancials.cgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SGST ({gstConfig.percentage / 2}%):</span>
                        <span className="font-medium text-slate-800">₹{calculatedFinancials.sgst.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* Grand Total */}
                  <div className="flex items-center justify-between text-sm font-medium text-slate-900 pt-1 border-t border-slate-200">
                    <span>Grand Total:</span>
                    <span className="font-mono text-base text-[#348bdd]">
                      ₹{calculatedFinancials.grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Payment Collection: Method & Received Amount */}
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] uppercase tracking-wider font-medium text-slate-600">
                      Payment Mode
                    </label>

                    {/* Method Radio Pills: Cash, UPI, Card, Split */}
                    <div className="flex items-center gap-1">
                      {(["Cash", "UPI", "Card", "Split"] as PaymentMethod[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          disabled={modalMode === "view"}
                          onClick={() => setPaymentMethod(mode)}
                          className={`px-2 py-0.5 text-[11px] rounded transition-colors cursor-pointer font-medium ${
                            paymentMethod === mode
                              ? "bg-[#348bdd] text-white"
                              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* If Split is selected: Ask for cash, upi, card breakdown */}
                  {paymentMethod === "Split" ? (
                    <div className="p-2.5 rounded-md border bg-white border-slate-200 space-y-1.5 text-xs">
                      <div className="text-[11px] text-slate-500 font-medium">
                        Enter amount received per mode:
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-400">Cash:</span>
                          <input
                            type="number"
                            min="0"
                            disabled={modalMode === "view"}
                            value={splitDetails.cash || ""}
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                            onChange={(e) =>
                              setSplitDetails({
                                ...splitDetails,
                                cash: Number(e.target.value) || 0,
                              })
                            }
                            className="w-full text-xs p-1 rounded border font-mono"
                            style={{ borderColor: "var(--color-border-base)" }}
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400">UPI:</span>
                          <input
                            type="number"
                            min="0"
                            disabled={modalMode === "view"}
                            value={splitDetails.upi || ""}
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                            onChange={(e) =>
                              setSplitDetails({
                                ...splitDetails,
                                upi: Number(e.target.value) || 0,
                              })
                            }
                            className="w-full text-xs p-1 rounded border font-mono"
                            style={{ borderColor: "var(--color-border-base)" }}
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400">Card:</span>
                          <input
                            type="number"
                            min="0"
                            disabled={modalMode === "view"}
                            value={splitDetails.card || ""}
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                            onChange={(e) =>
                              setSplitDetails({
                                ...splitDetails,
                                card: Number(e.target.value) || 0,
                              })
                            }
                            className="w-full text-xs p-1 rounded border font-mono"
                            style={{ borderColor: "var(--color-border-base)" }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Standard Single Mode Received Input */
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-600">Amount Received:</span>
                        {/* Quick fill buttons */}
                        {modalMode !== "view" && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setReceivedAmount(calculatedFinancials.grandTotal)}
                              className="text-[10px] text-[#348bdd] hover:underline font-mono"
                            >
                              [Full: ₹{calculatedFinancials.grandTotal.toFixed(0)}]
                            </button>
                            <button
                              type="button"
                              onClick={() => setReceivedAmount(0)}
                              className="text-[10px] text-slate-400 hover:underline font-mono"
                            >
                              [Nil: ₹0]
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="w-32">
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          disabled={modalMode === "view"}
                          value={receivedAmount}
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          onChange={(e) =>
                            setReceivedAmount(e.target.value === "" ? "" : Number(e.target.value))
                          }
                          className="w-full text-right text-xs px-2.5 py-1 rounded border bg-white focus:outline-none font-mono font-medium"
                          style={{ borderColor: "var(--color-border-base)" }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Payment Status & Balance Display */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-[11px]">Payment Status:</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getPaymentStatusBadgeClass(
                          calculatedFinancials.paymentStatus
                        )}`}
                      >
                        {calculatedFinancials.paymentStatus}
                      </span>
                    </div>

                    <div className="font-mono text-xs">
                      {calculatedFinancials.balanceDue > 0 ? (
                        <span className="text-rose-600 font-medium">
                          Balance Due: ₹{calculatedFinancials.balanceDue.toFixed(2)}
                        </span>
                      ) : calculatedFinancials.balanceDue < 0 ? (
                        <span className="text-emerald-600 font-medium">
                          Change Return: ₹{Math.abs(calculatedFinancials.balanceDue).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-medium">Paid in Full ✓</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Save Order CTA Button */}
                <div className="pt-2">
                  {modalMode === "view" ? (
                    <button
                      type="button"
                      onClick={() => setIsOrderModalOpen(false)}
                      className="w-full py-2.5 text-xs rounded-md border bg-white hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
                      style={{ borderColor: "var(--color-border-base)" }}
                    >
                      Close Order View
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleSaveOrder}
                      className="w-full py-2.5 text-xs rounded-md text-white transition-opacity hover:opacity-90 disabled:opacity-50 font-medium cursor-pointer shadow-xs flex items-center justify-center gap-2"
                      style={{ backgroundColor: "var(--color-brand-primary)" }}
                    >
                      {isSubmitting ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={15} />
                      )}
                      <span>
                        {modalMode === "create" ? "Save & Create Order" : "Update Order"}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          5. SUB-MODAL: WEIGHT / LITRE ITEM CUSTOMIZATION
         ========================================================================= */}
      {weightModalProduct && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-md rounded-xl border bg-white shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
              <div className="flex items-center gap-2.5">
                <img
                  src={weightModalProduct.imageUrl || "/logo.png"}
                  alt={weightModalProduct.name}
                  className="w-8 h-8 rounded object-contain border border-slate-200 bg-white p-0.5"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/logo.png";
                  }}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-medium text-slate-900">
                      {weightModalProduct.name}
                    </h3>
                    {editingWeightLineId && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">
                        Editing Item
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Rate: ₹{weightModalProduct.amount} per {weightModalProduct.unit}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setWeightModalProduct(null);
                  setEditingWeightLineId(null);
                }}
                className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Weight / Litre Input */}
              <div>
                <label className="block text-xs uppercase tracking-wider mb-1 font-medium text-slate-600">
                  How many {weightModalProduct.unit}? <span className="text-red-500">*</span>
                </label>
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-md border bg-white focus-within:ring-1 focus-within:ring-[var(--color-brand-primary)]"
                  style={{ borderColor: "var(--color-border-base)" }}
                >
                  <input
                    type="number"
                    step="0.05"
                    min="0.05"
                    placeholder="Enter weight or volume"
                    value={weightInput}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    onChange={(e) => {
                      const w = e.target.value === "" ? "" : Number(e.target.value);
                      setWeightInput(w);
                      if (w !== "") {
                        setAmountInput(Number((w * weightModalProduct.amount).toFixed(2)));
                      } else {
                        setAmountInput("");
                      }
                    }}
                    className="w-full text-xs bg-transparent focus:outline-none font-mono font-medium"
                  />
                  <span className="text-xs font-mono text-slate-400 uppercase">
                    {weightModalProduct.unit}
                  </span>
                </div>
              </div>

              {/* Quick Weight Suggestions */}
              <div>
                <span className="text-[11px] text-slate-500 mb-1.5 block">
                  Quick Weight Suggestions:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "1/4 KG", val: 0.25 },
                    { label: "1/2 KG", val: 0.5 },
                    { label: "3/4 KG", val: 0.75 },
                    { label: "1 KG", val: 1.0 },
                    { label: "1.5 KG", val: 1.5 },
                    { label: "2 KG", val: 2.0 },
                    { label: "5 KG", val: 5.0 },
                  ].map((sug) => (
                    <button
                      key={sug.label}
                      type="button"
                      onClick={() => {
                        setWeightInput(sug.val);
                        setAmountInput(
                          Number((sug.val * weightModalProduct.amount).toFixed(2))
                        );
                      }}
                      className={`px-2 py-1 text-xs rounded border transition-colors cursor-pointer font-mono ${
                        weightInput === sug.val
                          ? "bg-[#348bdd] text-white border-[#348bdd]"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {sug.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Field (Bidirectional Calculation) */}
              <div>
                <label className="block text-xs uppercase tracking-wider mb-1 font-medium text-slate-600">
                  Total Amount (₹)
                </label>
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-md border bg-white focus-within:ring-1 focus-within:ring-[var(--color-brand-primary)]"
                  style={{ borderColor: "var(--color-border-base)" }}
                >
                  <span className="text-slate-400 font-mono text-xs">₹</span>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="Auto amount or type to auto-calculate weight"
                    value={amountInput}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    onChange={(e) => {
                      const amt = e.target.value === "" ? "" : Number(e.target.value);
                      setAmountInput(amt);
                      if (amt !== "" && weightModalProduct.amount > 0) {
                        setWeightInput(
                          Number((amt / weightModalProduct.amount).toFixed(3))
                        );
                      } else {
                        setWeightInput("");
                      }
                    }}
                    className="w-full text-xs bg-transparent focus:outline-none font-mono font-medium"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">
                  Typing amount will automatically calculate the equivalent {weightModalProduct.unit}.
                </p>
              </div>

              {/* Manufacturing Description (Kitchen Notes) */}
              <div>
                <label className="block text-xs uppercase tracking-wider mb-1 font-medium text-slate-600">
                  Manufacturing Description <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Less ghee, extra roasted, silver foil packing, fresh morning batch"
                  value={mfgDescInput}
                  onChange={(e) => setMfgDescInput(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)] resize-none"
                  style={{ borderColor: "var(--color-border-base)" }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t bg-slate-50 flex items-center justify-end gap-2" style={{ borderColor: "var(--color-border-subtle)" }}>
              <button
                type="button"
                onClick={() => {
                  setWeightModalProduct(null);
                  setEditingWeightLineId(null);
                }}
                className="px-3 py-1.5 text-xs rounded border bg-white hover:bg-slate-50 text-slate-600 cursor-pointer"
                style={{ borderColor: "var(--color-border-base)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={weightInput === "" || Number(weightInput) <= 0}
                onClick={handleConfirmWeightItem}
                className="px-4 py-1.5 text-xs rounded text-white font-medium cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50 shadow-xs"
                style={{ backgroundColor: "var(--color-brand-primary)" }}
              >
                {editingWeightLineId ? "Update Weight Item" : "Add to Selected Items"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          6. SUB-MODAL: QUICK ADD CUSTOMER
         ========================================================================= */}
      {isQuickCustomerOpen && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-md rounded-xl border bg-white shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
              <div className="flex items-center gap-2">
                <User size={16} className="text-[#348bdd]" />
                <h3 className="text-xs font-medium text-slate-900">
                  Quick Add Customer
                </h3>
              </div>
              <button
                onClick={() => setIsQuickCustomerOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveQuickCustomer} className="p-5 space-y-3">
              {quickCustomerError && (
                <p className="text-[11px] text-red-500">{quickCustomerError}</p>
              )}

              {/* Customer Name */}
              <div>
                <label className="block text-xs uppercase tracking-wider mb-1 font-medium text-slate-600">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Venkatesh Rao"
                  value={quickCustomerForm.name}
                  onChange={(e) =>
                    setQuickCustomerForm({ ...quickCustomerForm, name: e.target.value })
                  }
                  className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                  style={{ borderColor: "var(--color-border-base)" }}
                />
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-xs uppercase tracking-wider mb-1 font-medium text-slate-600">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="e.g. +91 98480 12345"
                  value={quickCustomerForm.phone}
                  onChange={(e) =>
                    setQuickCustomerForm({ ...quickCustomerForm, phone: e.target.value })
                  }
                  className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none font-mono focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                  style={{ borderColor: "var(--color-border-base)" }}
                />
              </div>

              {/* City & Email */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs uppercase tracking-wider mb-1 font-medium text-slate-600">
                    City
                  </label>
                  <input
                    type="text"
                    placeholder="Chirala"
                    value={quickCustomerForm.city}
                    onChange={(e) =>
                      setQuickCustomerForm({ ...quickCustomerForm, city: e.target.value })
                    }
                    className="w-full text-xs px-2.5 py-1.5 rounded-md border bg-white focus:outline-none"
                    style={{ borderColor: "var(--color-border-base)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider mb-1 font-medium text-slate-600">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="client@mail.com"
                    value={quickCustomerForm.email}
                    onChange={(e) =>
                      setQuickCustomerForm({ ...quickCustomerForm, email: e.target.value })
                    }
                    className="w-full text-xs px-2.5 py-1.5 rounded-md border bg-white focus:outline-none font-mono"
                    style={{ borderColor: "var(--color-border-base)" }}
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs uppercase tracking-wider mb-1 font-medium text-slate-600">
                  Address
                </label>
                <textarea
                  rows={2}
                  placeholder="Street / Delivery landmark..."
                  value={quickCustomerForm.address}
                  onChange={(e) =>
                    setQuickCustomerForm({ ...quickCustomerForm, address: e.target.value })
                  }
                  className="w-full text-xs p-2 rounded-md border bg-white focus:outline-none resize-none"
                  style={{ borderColor: "var(--color-border-base)" }}
                />
              </div>

              {/* B2B Customer Toggle */}
              <div
                className="p-3 rounded-lg border flex flex-col gap-2.5 transition-all"
                style={{
                  backgroundColor: quickCustomerForm.isB2b ? "var(--color-brand-primary-light, #f0f7ff)" : "var(--color-bg-subtle, #f8fafc)",
                  borderColor: quickCustomerForm.isB2b ? "var(--color-brand-primary, #348bdd)" : "var(--color-border-subtle, #e2e8f0)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2
                      size={15}
                      className={quickCustomerForm.isB2b ? "text-[#348bdd]" : "text-slate-400"}
                    />
                    <div>
                      <span className="text-xs font-medium text-slate-800 block">
                        Is B2B Customer?
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Enable for wholesale, commercial & GST tax invoice
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setQuickCustomerForm((prev) => ({
                        ...prev,
                        isB2b: !prev.isB2b,
                      }))
                    }
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      quickCustomerForm.isB2b ? "bg-[#348bdd]" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        quickCustomerForm.isB2b ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {quickCustomerForm.isB2b && (
                  <div className="pt-2 border-t border-blue-100">
                    <label className="block text-[11px] uppercase tracking-wider mb-1 font-medium text-slate-700">
                      GSTIN / GST Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={15}
                      placeholder="e.g. 37AAAAA0000A1Z5"
                      value={quickCustomerForm.gstNumber}
                      onChange={(e) =>
                        setQuickCustomerForm((prev) => ({
                          ...prev,
                          gstNumber: e.target.value.toUpperCase(),
                        }))
                      }
                      className="w-full text-xs px-2.5 py-1.5 rounded-md border bg-white focus:outline-none font-mono uppercase font-medium focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                      style={{ borderColor: "var(--color-border-base)" }}
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuickCustomerOpen(false)}
                  className="px-3 py-1.5 text-xs rounded border bg-white text-slate-600 cursor-pointer"
                  style={{ borderColor: "var(--color-border-base)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs rounded text-white font-medium cursor-pointer shadow-xs"
                  style={{ backgroundColor: "var(--color-brand-primary)" }}
                >
                  Save & Select
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          7. CONFIRMATION MODAL: DELETE ORDER
         ========================================================================= */}
      <ConfirmationModal
        isOpen={!!deletingOrder}
        title="Delete Order Record"
        message={`Are you sure you want to delete order "${deletingOrder?.orderNumber}" for ${deletingOrder?.customerName}? This will remove all associated billing logs.`}
        confirmText="Confirm Delete"
        isDeleting={isDeleting}
        onConfirm={handleConfirmDeleteOrder}
        onCancel={() => setDeletingOrder(null)}
      />

      {/* =========================================================================
          8. DEDICATED VIEW ORDER DETAILS MODAL
         ========================================================================= */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
          <div
            className="w-full max-w-4xl max-h-[92vh] bg-white rounded-xl shadow-2xl border flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            {/* Header */}
            <div
              className="px-6 py-4 border-b flex items-center justify-between gap-3 shrink-0 bg-slate-50/70"
              style={{ borderColor: "var(--color-border-subtle)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center border bg-white text-[#348bdd] shadow-2xs"
                  style={{ borderColor: "var(--color-border-base)" }}
                >
                  <Receipt size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-semibold text-slate-900">
                      Order #{viewingOrder.orderNumber}
                    </h2>
                    <span
                      className={`px-2 py-0.5 text-[10px] rounded uppercase tracking-wider font-mono border ${getOrderStatusBadgeClass(
                        viewingOrder.orderStatus
                      )}`}
                    >
                      {viewingOrder.orderStatus}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] rounded uppercase tracking-wider font-mono border ${getPaymentStatusBadgeClass(
                        viewingOrder.paymentStatus
                      )}`}
                    >
                      {viewingOrder.paymentStatus}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {viewingOrder.createdAt?.toDate
                      ? `Created on ${viewingOrder.createdAt.toDate().toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`
                      : `Delivery on ${viewingOrder.deliveryDate}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenPaymentModal(viewingOrder)}
                  className="px-3 py-1.5 text-xs rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-medium cursor-pointer flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <CreditCard size={13} />
                  <span>Manage Payments</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingOrder(null)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 3 Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Customer */}
                <div
                  className="p-3.5 rounded-lg border bg-slate-50/50 space-y-1.5"
                  style={{ borderColor: "var(--color-border-subtle)" }}
                >
                  <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <User size={12} className="text-[#348bdd]" />
                    <span>Customer Details</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-900">
                    {viewingOrder.customerName}
                  </div>
                  <div className="text-[11px] font-mono text-slate-600 flex items-center gap-1">
                    <Phone size={11} className="text-slate-400" />
                    <span>{viewingOrder.customerPhone || "No phone"}</span>
                  </div>
                  {viewingOrder.customerAddress && (
                    <div className="text-[11px] text-slate-500 flex items-start gap-1">
                      <MapPin size={11} className="text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{viewingOrder.customerAddress}</span>
                    </div>
                  )}
                </div>

                {/* Delivery & Store */}
                <div
                  className="p-3.5 rounded-lg border bg-slate-50/50 space-y-1.5"
                  style={{ borderColor: "var(--color-border-subtle)" }}
                >
                  <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Store size={12} className="text-[#348bdd]" />
                    <span>Store & Delivery</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-900">
                    {viewingOrder.storeName}
                  </div>
                  <div className="text-[11px] font-mono text-slate-700 flex items-center gap-1">
                    <Calendar size={11} className="text-slate-400" />
                    <span>Date: {viewingOrder.deliveryDate}</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-700 flex items-center gap-1">
                    <Clock size={11} className="text-slate-400" />
                    <span>Time: {viewingOrder.deliveryTime}</span>
                  </div>
                </div>

                {/* Financial Status Summary */}
                <div
                  className="p-3.5 rounded-lg border bg-slate-50/50 space-y-1.5"
                  style={{ borderColor: "var(--color-border-subtle)" }}
                >
                  <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Banknote size={12} className="text-emerald-600" />
                    <span>Payment Overview</span>
                  </div>
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="text-slate-500">Grand Total:</span>
                    <span className="font-mono font-semibold text-slate-900">
                      ₹{viewingOrder.grandTotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline text-xs">
                    <span className="text-slate-500">Paid Amount:</span>
                    <span className="font-mono font-semibold text-emerald-600">
                      ₹{viewingOrder.receivedAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline text-xs border-t pt-1" style={{ borderColor: "var(--color-border-subtle)" }}>
                    <span className="text-slate-700 font-medium">Balance Due:</span>
                    <span className={`font-mono font-bold ${viewingOrder.balanceAmount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      ₹{viewingOrder.balanceAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Packing description if present */}
              {viewingOrder.packingDescription && (
                <div
                  className="p-3 rounded-lg border bg-amber-50/40 text-xs flex items-start gap-2.5"
                  style={{ borderColor: "rgba(245, 158, 11, 0.25)" }}
                >
                  <Package size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-amber-900 block mb-0.5">Packing Description:</span>
                    <p className="text-amber-800 text-[11px] leading-relaxed font-mono">
                      {viewingOrder.packingDescription}
                    </p>
                  </div>
                </div>
              )}

              {/* Ordered Items Table */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 font-mono flex items-center gap-1.5">
                  <Boxes size={13} className="text-[#348bdd]" />
                  <span>Ordered Sweets & Items ({viewingOrder.items.length})</span>
                </h3>
                <div
                  className="rounded-lg border overflow-hidden bg-white shadow-2xs"
                  style={{ borderColor: "var(--color-border-base)" }}
                >
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 border-b text-slate-500 font-medium font-mono text-[11px]" style={{ borderColor: "var(--color-border-subtle)" }}>
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3">Item Name</th>
                        <th className="py-2.5 px-3 text-right">Unit Rate</th>
                        <th className="py-2.5 px-3 text-center">Qty / Weight</th>
                        <th className="py-2.5 px-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewingOrder.items.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-7 h-7 rounded object-contain border border-slate-100 bg-white"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = "/logo.png";
                                  }}
                                />
                              ) : null}
                              <div>
                                <div className="font-medium text-slate-900">{item.name}</div>
                                {item.manufacturingDescription && (
                                  <div className="text-[10px] text-amber-700 font-mono mt-0.5">
                                    Note: {item.manufacturingDescription}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            ₹{item.rate.toFixed(2)} / {item.unit}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                              {item.quantity} {item.unit}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-900">
                            ₹{item.totalAmount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Section: Payment History (Left) and Bill Breakdown (Right) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: Payment Installment History */}
                <div
                  className="p-4 rounded-lg border bg-white space-y-3"
                  style={{ borderColor: "var(--color-border-subtle)" }}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-800 font-mono flex items-center gap-1.5 uppercase tracking-wider">
                      <History size={13} className="text-emerald-600" />
                      <span>Payment History</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleOpenPaymentModal(viewingOrder)}
                      className="text-[11px] font-medium text-[#348bdd] hover:underline cursor-pointer"
                    >
                      + Add Installment
                    </button>
                  </div>

                  {(() => {
                    const history =
                      viewingOrder.paymentHistory && viewingOrder.paymentHistory.length > 0
                        ? viewingOrder.paymentHistory
                        : viewingOrder.receivedAmount > 0
                        ? [
                            {
                              id: "inst_init",
                              amount: viewingOrder.receivedAmount,
                              paymentMethod: viewingOrder.paymentMethod,
                              date: viewingOrder.createdAt?.toDate
                                ? viewingOrder.createdAt.toDate().toISOString()
                                : viewingOrder.deliveryDate,
                              note: "Initial Advance / Booking Payment",
                            },
                          ]
                        : [];

                    if (history.length === 0) {
                      return (
                        <div className="py-4 text-center text-slate-400 text-xs font-mono">
                          No payments recorded yet (Unpaid).
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        {history.map((inst, hIdx) => (
                          <div
                            key={inst.id || hIdx}
                            className="p-2.5 rounded-md border bg-slate-50/60 flex items-center justify-between text-xs"
                            style={{ borderColor: "var(--color-border-subtle)" }}
                          >
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-900 font-mono">
                                  ₹{inst.amount.toFixed(2)}
                                </span>
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-white border border-slate-200 text-slate-600">
                                  {inst.paymentMethod}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {new Date(inst.date).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                                {inst.note && ` • ${inst.note}`}
                              </div>
                            </div>
                            <span className="text-[10px] text-emerald-600 font-mono font-medium">
                              Paid ✓
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Right: Detailed Bill Summary */}
                <div
                  className="p-4 rounded-lg border bg-slate-50/60 space-y-2 text-xs font-mono"
                  style={{ borderColor: "var(--color-border-subtle)" }}
                >
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span>₹{viewingOrder.subtotal.toFixed(2)}</span>
                  </div>

                  {viewingOrder.discount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount:</span>
                      <span>-₹{viewingOrder.discount.toFixed(2)}</span>
                    </div>
                  )}

                  {viewingOrder.isGstEnabled && viewingOrder.gstPercentage > 0 && (
                    <div className="space-y-1 pt-1 border-t border-slate-200/70 text-slate-600">
                      <div className="flex justify-between text-[11px]">
                        <span>CGST ({viewingOrder.gstPercentage / 2}%):</span>
                        <span>₹{viewingOrder.cgst.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span>SGST ({viewingOrder.gstPercentage / 2}%):</span>
                        <span>₹{viewingOrder.sgst.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  <div
                    className="flex justify-between text-sm font-semibold text-slate-900 pt-2 border-t font-mono"
                    style={{ borderColor: "var(--color-border-base)" }}
                  >
                    <span>Grand Total:</span>
                    <span className="text-base text-[var(--color-brand-primary)]">
                      ₹{viewingOrder.grandTotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between text-emerald-600 pt-1 font-medium">
                    <span>Total Paid So Far:</span>
                    <span>₹{viewingOrder.receivedAmount.toFixed(2)}</span>
                  </div>

                  <div
                    className={`flex justify-between pt-1 border-t font-semibold ${
                      viewingOrder.balanceAmount > 0 ? "text-rose-600" : "text-emerald-600"
                    }`}
                    style={{ borderColor: "var(--color-border-subtle)" }}
                  >
                    <span>
                      {viewingOrder.balanceAmount > 0
                        ? "Balance Due:"
                        : viewingOrder.balanceAmount < 0
                        ? "Change Return:"
                        : "Balance Status:"}
                    </span>
                    <span>
                      {viewingOrder.balanceAmount > 0
                        ? `₹${viewingOrder.balanceAmount.toFixed(2)}`
                        : viewingOrder.balanceAmount < 0
                        ? `₹${Math.abs(viewingOrder.balanceAmount).toFixed(2)}`
                        : "Fully Paid ✓"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              className="px-6 py-3 border-t bg-slate-50 flex items-center justify-between shrink-0"
              style={{ borderColor: "var(--color-border-subtle)" }}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintThermal(viewingOrder)}
                  className="px-3 py-1.5 text-xs rounded border bg-white hover:bg-slate-50 text-slate-700 font-medium cursor-pointer flex items-center gap-1.5 transition-colors shadow-2xs"
                  style={{ borderColor: "var(--color-border-base)" }}
                >
                  <Printer size={13} />
                  <span>Thermal Slip</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenA4Invoice(viewingOrder)}
                  className="px-3 py-1.5 text-xs rounded border bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium cursor-pointer flex items-center gap-1.5 transition-colors shadow-2xs border-indigo-200"
                >
                  <FileText size={13} />
                  <span>A4 Tax Invoice</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenPaymentModal(viewingOrder)}
                  className="px-3.5 py-1.5 text-xs rounded text-white font-medium cursor-pointer shadow-2xs flex items-center gap-1.5 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--color-brand-primary)" }}
                >
                  <CreditCard size={13} />
                  <span>Add Payment Installment</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingOrder(null)}
                  className="px-4 py-1.5 text-xs rounded border bg-white hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
                  style={{ borderColor: "var(--color-border-base)" }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          9. PAYMENT MANAGEMENT & INSTALLMENT MODAL
         ========================================================================= */}
      {paymentManagingOrder && (
        <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg bg-white rounded-xl shadow-2xl border flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            {/* Header */}
            <div
              className="px-5 py-3.5 border-b flex items-center justify-between shrink-0 bg-slate-50/70"
              style={{ borderColor: "var(--color-border-subtle)" }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center border bg-white text-emerald-600 shadow-2xs"
                  style={{ borderColor: "var(--color-border-base)" }}
                >
                  <Wallet size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-900">
                    Manage Order Payments
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono">
                    #{paymentManagingOrder.orderNumber} • {paymentManagingOrder.customerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentManagingOrder(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-4 max-h-[75vh]">
              {/* Financial Status Cards */}
              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="p-2.5 rounded-lg border bg-slate-50 border-slate-200/80">
                  <div className="text-[10px] text-slate-400 uppercase">Grand Total</div>
                  <div className="text-xs font-bold text-slate-900 mt-0.5">
                    ₹{paymentManagingOrder.grandTotal.toFixed(2)}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg border bg-emerald-50/60 border-emerald-200/70">
                  <div className="text-[10px] text-emerald-600 uppercase">Total Paid</div>
                  <div className="text-xs font-bold text-emerald-700 mt-0.5">
                    ₹{paymentManagingOrder.receivedAmount.toFixed(2)}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg border bg-rose-50/60 border-rose-200/70">
                  <div className="text-[10px] text-rose-600 uppercase">Balance Due</div>
                  <div className={`text-xs font-bold mt-0.5 ${paymentManagingOrder.balanceAmount > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                    ₹{paymentManagingOrder.balanceAmount.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Add Installment Form (Only if balance > 0) */}
              {paymentManagingOrder.balanceAmount > 0 ? (
                <form
                  onSubmit={handleAddInstallment}
                  className="p-3.5 rounded-lg border bg-slate-50/50 space-y-3"
                  style={{ borderColor: "var(--color-border-subtle)" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 font-mono uppercase tracking-wider">
                      Add New Installment
                    </span>
                    <button
                      type="button"
                      onClick={() => setInstallmentAmount(paymentManagingOrder.balanceAmount)}
                      className="text-[10px] font-mono text-[#348bdd] hover:underline cursor-pointer"
                    >
                      Fill Full Balance (₹{paymentManagingOrder.balanceAmount.toFixed(2)})
                    </button>
                  </div>

                  {/* Installment Amount Input */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Amount (₹) <span className="text-rose-500">*</span>
                    </label>
                    <div
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-white focus-within:ring-1 focus-within:ring-[var(--color-brand-primary)]"
                      style={{ borderColor: "var(--color-border-base)" }}
                    >
                      <span className="text-slate-400 font-mono text-xs">₹</span>
                      <input
                        type="number"
                        min="1"
                        max={paymentManagingOrder.balanceAmount + 1000}
                        step="any"
                        placeholder="Enter amount"
                        value={installmentAmount}
                        onChange={(e) =>
                          setInstallmentAmount(e.target.value === "" ? "" : Number(e.target.value))
                        }
                        className="w-full text-xs font-mono font-medium bg-transparent focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  {/* Payment Mode Pills */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Payment Mode <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["Cash", "UPI", "Card"] as PaymentMethod[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setInstallmentMethod(mode)}
                          className={`py-1.5 text-xs rounded border font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            installmentMethod === mode
                              ? "bg-[#348bdd] text-white border-[#348bdd] shadow-2xs"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {mode === "Cash" && <Banknote size={12} />}
                          {mode === "UPI" && <QrCode size={12} />}
                          {mode === "Card" && <CreditCard size={12} />}
                          <span>{mode}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Note / Reference */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Transaction Note / Reference <span className="text-slate-400 font-normal lowercase">(optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. GPay ref 839210 / counter payment 2"
                      value={installmentNote}
                      onChange={(e) => setInstallmentNote(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                      style={{ borderColor: "var(--color-border-base)" }}
                    />
                  </div>

                  {/* Record Payment Button */}
                  <button
                    type="submit"
                    disabled={isAddingInstallment || !installmentAmount || Number(installmentAmount) <= 0}
                    className="w-full py-2 text-xs rounded-md text-white font-medium cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 shadow-2xs"
                    style={{ backgroundColor: "var(--color-brand-primary)" }}
                  >
                    {isAddingInstallment ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                    <span>Record Installment Payment</span>
                  </button>
                </form>
              ) : (
                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/70 text-emerald-800 text-xs flex items-center gap-2 font-mono">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>This order is fully paid. No balance payment is due.</span>
                </div>
              )}

              {/* Installment History Timeline */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <History size={12} className="text-emerald-600" />
                    <span>Transaction History</span>
                  </span>
                  <span className="text-slate-400 text-[10px]">
                    {paymentManagingOrder.paymentHistory?.length || (paymentManagingOrder.receivedAmount > 0 ? 1 : 0)} record(s)
                  </span>
                </div>

                {(() => {
                  const history =
                    paymentManagingOrder.paymentHistory && paymentManagingOrder.paymentHistory.length > 0
                      ? paymentManagingOrder.paymentHistory
                      : paymentManagingOrder.receivedAmount > 0
                      ? [
                          {
                            id: "inst_init",
                            amount: paymentManagingOrder.receivedAmount,
                            paymentMethod: paymentManagingOrder.paymentMethod,
                            date: paymentManagingOrder.createdAt?.toDate
                              ? paymentManagingOrder.createdAt.toDate().toISOString()
                              : paymentManagingOrder.deliveryDate,
                            note: "Initial Advance / Booking Payment",
                          },
                        ]
                      : [];

                  if (history.length === 0) {
                    return (
                      <div className="py-4 text-center text-slate-400 text-xs font-mono">
                        No payments recorded yet.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-1.5">
                      {history.map((inst, hIdx) => (
                        <div
                          key={inst.id || hIdx}
                          className="p-2.5 rounded-md border bg-slate-50/50 flex items-center justify-between text-xs"
                          style={{ borderColor: "var(--color-border-subtle)" }}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold font-mono text-slate-900">
                                ₹{inst.amount.toFixed(2)}
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-white border border-slate-200 text-slate-600">
                                {inst.paymentMethod}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {new Date(inst.date).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {inst.note && ` • ${inst.note}`}
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-600 font-medium">
                            Paid ✓
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Footer */}
            <div
              className="px-5 py-3 border-t bg-slate-50 flex items-center justify-end shrink-0"
              style={{ borderColor: "var(--color-border-subtle)" }}
            >
              <button
                type="button"
                onClick={() => setPaymentManagingOrder(null)}
                className="px-4 py-1.5 text-xs rounded border bg-white hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
                style={{ borderColor: "var(--color-border-base)" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          8. POST ORDER CREATION PRINT PROMPT MODAL
         ========================================================================= */}
      {createdOrderForPrint && (
        <div className="fixed inset-0 z-70 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-md rounded-xl border bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 border border-emerald-100 shadow-2xs">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="text-sm font-medium text-slate-900">
                Order Created Successfully!
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Order <span className="font-mono font-medium text-[#348bdd]">#{createdOrderForPrint.orderNumber}</span> for <span className="font-medium text-slate-800">{createdOrderForPrint.customerName}</span> has been booked.
              </p>
              <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs font-mono flex items-center justify-between">
                <span className="text-slate-600">Grand Total:</span>
                <span className="text-sm font-medium text-[#348bdd]">₹{createdOrderForPrint.grandTotal.toFixed(2)}</span>
              </div>

              <div className="mt-5 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handlePrintThermal(createdOrderForPrint)}
                    className="w-full py-2 px-3 rounded-lg border bg-slate-50 hover:bg-slate-100 text-slate-800 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-slate-200 shadow-2xs"
                  >
                    <Printer size={14} className="text-slate-600" />
                    <span>Thermal Slip</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const order = createdOrderForPrint;
                      setCreatedOrderForPrint(null);
                      setA4InvoiceOrder(order);
                    }}
                    className="w-full py-2 px-3 rounded-lg border bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-indigo-200 shadow-2xs"
                  >
                    <FileText size={14} className="text-indigo-600" />
                    <span>A4 Tax Invoice</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setCreatedOrderForPrint(null)}
                  className="w-full py-2 px-3 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-50 font-medium text-xs transition-colors cursor-pointer"
                >
                  Close & Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          9. A4 TAX INVOICE PRINT MODAL
         ========================================================================= */}
      {a4InvoiceOrder && (
        <div className="fixed inset-0 z-80 bg-black/60 backdrop-blur-xs flex flex-col items-center overflow-y-auto p-4 sm:p-6 print:p-0 print:bg-white print:static animate-in fade-in duration-150">
          {/* Print Action Toolbar (Hidden during browser printing) */}
          <div className="w-full max-w-[210mm] mb-4 bg-white/95 backdrop-blur-md rounded-xl p-3 border shadow-lg flex items-center justify-between gap-3 shrink-0 print:hidden border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                <FileText size={16} />
              </div>
              <div>
                <h4 className="text-xs font-medium text-slate-900">
                  A4 Tax Invoice Preview
                </h4>
                <p className="text-[11px] font-mono text-slate-500">
                  Order #{a4InvoiceOrder.orderNumber} • {a4InvoiceOrder.customerName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 text-xs rounded-lg text-white font-medium cursor-pointer shadow-sm flex items-center gap-1.5 transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--color-brand-primary)" }}
              >
                <Printer size={14} />
                <span>Print A4 Invoice</span>
              </button>

              <button
                type="button"
                onClick={() => setA4InvoiceOrder(null)}
                className="px-3.5 py-2 text-xs rounded-lg border bg-white hover:bg-slate-50 text-slate-700 font-medium cursor-pointer border-slate-200 shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>

          {/* Embedded Print Scoped Style */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body * {
                visibility: hidden !important;
              }
              #a4-invoice-sheet, #a4-invoice-sheet * {
                visibility: visible !important;
              }
              #a4-invoice-sheet {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                min-height: auto !important;
                margin: 0 !important;
                padding: 8mm !important;
                box-shadow: none !important;
                border: none !important;
                background: #ffffff !important;
              }
              @page {
                size: A4 portrait;
                margin: 8mm;
              }
            }
          `}} />

          {/* A4 Invoice Paper Sheet */}
          <div
            id="a4-invoice-sheet"
            className="w-full max-w-[210mm] min-h-[297mm] bg-white text-slate-900 p-8 sm:p-10 shadow-2xl rounded-sm print:shadow-none print:p-0 print:max-w-none print:w-full border border-slate-200 flex flex-col justify-between"
          >
            <div>
              {/* Header: Company Details & Invoice Metadata */}
              <div className="pb-6 border-b-2 border-slate-900 flex justify-between items-start gap-6">
                <div>
                  <h1 className="text-xl font-medium tracking-tight text-slate-900 uppercase">
                    {businessProfile.tradeName || "Ravi Sweets & Cold Drinks"}
                  </h1>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {businessProfile.legalName || "Ravi Sweets"} • Pure Ghee Sweets, Bakery & Savouries
                  </p>
                  <p className="text-xs text-slate-600 mt-1 max-w-sm">
                    {businessProfile.address || "Main Road"}, {businessProfile.city || "Chirala"}, {businessProfile.state || "Andhra Pradesh"} - {businessProfile.pincode || "523155"}
                  </p>
                  <div className="text-xs text-slate-700 font-mono mt-1.5 space-y-0.5">
                    <div>Phone: <span className="text-slate-900">{businessProfile.phone || "+91 94402 61276"}</span> {businessProfile.altPhone && ` / ${businessProfile.altPhone}`}</div>
                    <div>Email: <span className="text-slate-900">{businessProfile.email || "contact@ravisweets.com"}</span></div>
                    <div>GSTIN: <span className="font-medium text-slate-900">{businessProfile.gstNumber || "37AAAAA0000A1Z5"}</span></div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-medium uppercase tracking-wider rounded-xs">
                    Tax Invoice
                  </div>
                  <div className="mt-3 text-xs font-mono space-y-1">
                    <div>
                      <span className="text-slate-500">Invoice No: </span>
                      <span className="font-medium text-slate-900">{a4InvoiceOrder.orderNumber}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Invoice Date: </span>
                      <span className="text-slate-900">{a4InvoiceOrder.deliveryDate || new Date().toISOString().split("T")[0]}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Delivery Time: </span>
                      <span className="text-slate-900">{a4InvoiceOrder.deliveryTime || "11:00 AM"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Store / Branch: </span>
                      <span className="text-slate-900">{a4InvoiceOrder.storeName || "Main Chirala Store"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bill From and Bill To Grid */}
              <div className="grid grid-cols-2 gap-6 py-5 border-b border-slate-300">
                {/* Bill From */}
                <div className="p-3.5 rounded bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
                    Bill From (Supplier)
                  </span>
                  <div className="text-xs space-y-0.5 text-slate-800">
                    <div className="font-medium text-slate-900">{businessProfile.tradeName || "Ravi Sweets & Cold Drinks"}</div>
                    <div className="text-slate-600">{businessProfile.address || "Main Road, Chirala"}</div>
                    <div className="text-slate-600">{businessProfile.city || "Chirala"}, {businessProfile.state || "Andhra Pradesh"} - {businessProfile.pincode || "523155"}</div>
                    <div className="font-mono text-[11px] pt-1">
                      <span className="text-slate-500">GSTIN: </span>
                      <span className="font-medium text-slate-900">{businessProfile.gstNumber || "37AAAAA0000A1Z5"}</span>
                    </div>
                    <div className="font-mono text-[11px]">
                      <span className="text-slate-500">State: </span>
                      <span>Andhra Pradesh (Code: 37)</span>
                    </div>
                  </div>
                </div>

                {/* Bill To */}
                <div className="p-3.5 rounded bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 block mb-1.5">
                    Bill To (Recipient / Customer)
                  </span>
                  <div className="text-xs space-y-0.5 text-slate-800">
                    <div className="font-medium text-slate-900">{a4InvoiceOrder.customerName}</div>
                    <div className="font-mono text-[11px] text-slate-700">Phone: {a4InvoiceOrder.customerPhone || "—"}</div>
                    <div className="text-slate-600">{a4InvoiceOrder.customerAddress || "Walk-In Customer / Counter"}</div>
                    <div className="font-mono text-[11px] pt-1">
                      <span className="text-slate-500">Customer Type: </span>
                      <span className="font-medium text-slate-900">
                        {a4InvoiceOrder.isB2b ? "B2B Commercial / Wholesale" : "Retail Consumer"}
                      </span>
                    </div>
                    <div className="font-mono text-[11px]">
                      <span className="text-slate-500">GSTIN: </span>
                      <span className="font-medium text-slate-900">
                        {a4InvoiceOrder.customerGstNumber || (a4InvoiceOrder.isB2b ? "Pending" : "Unregistered Consumer")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="py-5">
                <table className="w-full text-left text-xs border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-medium">
                      <th className="py-2.5 px-3 w-10 text-center border-r border-slate-300">#</th>
                      <th className="py-2.5 px-3 border-r border-slate-300">Item Description</th>
                      <th className="py-2.5 px-3 w-20 text-center border-r border-slate-300">Unit</th>
                      <th className="py-2.5 px-3 w-24 text-right border-r border-slate-300">Rate (₹)</th>
                      <th className="py-2.5 px-3 w-24 text-right border-r border-slate-300">Qty / Wt</th>
                      <th className="py-2.5 px-3 w-28 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {a4InvoiceOrder.items.map((item, idx) => (
                      <tr key={item.id || idx} className="text-slate-800">
                        <td className="py-2.5 px-3 text-center border-r border-slate-200 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200">
                          <div className="font-medium text-slate-900">{item.name}</div>
                          {item.manufacturingDescription && (
                            <div className="text-[10px] text-slate-500 mt-0.5 italic">
                              Note: {item.manufacturingDescription}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center border-r border-slate-200 font-mono uppercase text-[11px] text-slate-600">
                          {item.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-200 font-mono text-[11px]">
                          ₹{Number(item.rate).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right border-r border-slate-200 font-mono text-[11px]">
                          {item.unit.toLowerCase() === "kg"
                            ? `${item.quantity} KG`
                            : `${item.quantity} ${item.unit}`}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-900">
                          ₹{Number(item.totalAmount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Order Summary Breakdown Grid */}
              <div className="grid grid-cols-2 gap-6 pt-2 pb-6 border-b border-slate-300">
                {/* Left: Amount in Words, Payment Mode, Special Instructions */}
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1">
                    <span className="text-[10px] uppercase font-medium tracking-wider text-slate-500 block">
                      Amount in Words
                    </span>
                    <p className="font-medium text-slate-900 italic text-xs">
                      {(() => {
                        const num = a4InvoiceOrder.grandTotal;
                        if (!num || isNaN(num) || num <= 0) return "Zero Rupees Only";
                        const a = ["", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ", "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "];
                        const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
                        const formatSection = (n: number): string => {
                          let str = "";
                          if (n > 99) { str += a[Math.floor(n / 100)] + "Hundred "; n %= 100; }
                          if (n > 19) { str += b[Math.floor(n / 10)] + " " + a[n % 10]; } else if (n > 0) { str += a[n]; }
                          return str;
                        };
                        const integerPart = Math.floor(num);
                        let res = "";
                        const crore = Math.floor(integerPart / 10000000);
                        const lakh = Math.floor((integerPart % 10000000) / 100000);
                        const thousand = Math.floor((integerPart % 100000) / 1000);
                        const rem = integerPart % 1000;
                        if (crore > 0) res += formatSection(crore) + "Crore ";
                        if (lakh > 0) res += formatSection(lakh) + "Lakh ";
                        if (thousand > 0) res += formatSection(thousand) + "Thousand ";
                        if (rem > 0) res += formatSection(rem);
                        return (res.trim() || "Zero") + " Rupees Only";
                      })()}
                    </p>
                  </div>

                  <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1 text-xs">
                    <span className="text-[10px] uppercase font-medium tracking-wider text-slate-500 block">
                      Payment Details
                    </span>
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-slate-600">Payment Mode:</span>
                      <span className="font-medium text-slate-900">{a4InvoiceOrder.paymentMethod}</span>
                    </div>
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-slate-600">Payment Status:</span>
                      <span className="font-medium text-slate-900">{a4InvoiceOrder.paymentStatus}</span>
                    </div>
                    {a4InvoiceOrder.packingDescription && (
                      <div className="pt-1.5 border-t border-slate-200 text-slate-600 text-[11px]">
                        <span className="font-medium text-slate-700">Packing Notes: </span>
                        {a4InvoiceOrder.packingDescription}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Calculations Table */}
                <div className="space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between py-1 text-slate-700">
                    <span>Items Subtotal:</span>
                    <span>₹{Number(a4InvoiceOrder.subtotal).toFixed(2)}</span>
                  </div>

                  {a4InvoiceOrder.discount > 0 && (
                    <div className="flex justify-between py-1 text-emerald-700">
                      <span>Discount:</span>
                      <span>-₹{Number(a4InvoiceOrder.discount).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-1 text-slate-700 border-t border-slate-200">
                    <span>Taxable Value:</span>
                    <span>₹{Number(a4InvoiceOrder.taxableSubtotal).toFixed(2)}</span>
                  </div>

                  {a4InvoiceOrder.isGstEnabled && a4InvoiceOrder.gstPercentage > 0 && (
                    <>
                      <div className="flex justify-between py-1 text-slate-600 text-[11px]">
                        <span>CGST ({a4InvoiceOrder.gstPercentage / 2}%):</span>
                        <span>₹{Number(a4InvoiceOrder.cgst).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-1 text-slate-600 text-[11px]">
                        <span>SGST ({a4InvoiceOrder.gstPercentage / 2}%):</span>
                        <span>₹{Number(a4InvoiceOrder.sgst).toFixed(2)}</span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between py-2 border-t-2 border-b-2 border-slate-900 text-sm font-medium text-slate-900 bg-slate-50 px-2 rounded-xs">
                    <span>Grand Total:</span>
                    <span>₹{Number(a4InvoiceOrder.grandTotal).toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between py-1 text-emerald-700">
                    <span>Amount Paid:</span>
                    <span>₹{Number(a4InvoiceOrder.receivedAmount).toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between py-1 text-rose-700 font-medium border-t border-slate-200">
                    <span>Balance Due:</span>
                    <span>₹{Number(a4InvoiceOrder.balanceAmount).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Terms and Conditions */}
              <div className="pt-4 text-[10px] text-slate-600 space-y-1">
                <span className="font-medium text-slate-800 uppercase tracking-wider block mb-1">
                  Terms & Conditions:
                </span>
                <ol className="list-decimal pl-4 space-y-0.5 text-slate-500">
                  <li>Goods once sold will not be taken back or exchanged.</li>
                  <li>Milk sweets, dairy items, and fresh cakes should be refrigerated and consumed within 24 hours.</li>
                  <li>Advance paid for custom, party, or bulk festival orders is non-refundable once production starts.</li>
                  <li>Subject to Chirala jurisdiction only.</li>
                </ol>
              </div>
            </div>

            {/* Bottom Signatures */}
            <div className="pt-10 border-t border-slate-300 flex justify-between items-end text-xs text-slate-700">
              <div className="text-center w-48">
                <div className="border-t border-slate-400 pt-1.5 font-medium text-slate-800">
                  Customer Signature
                </div>
              </div>

              <div className="text-center w-56">
                <div className="text-[11px] text-slate-500 mb-6">
                  For {businessProfile.tradeName || "Ravi Sweets & Cold Drinks"}
                </div>
                <div className="border-t border-slate-400 pt-1.5 font-medium text-slate-800">
                  Authorized Signatory
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
