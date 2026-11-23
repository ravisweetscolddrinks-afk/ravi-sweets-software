"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import ConfirmationModal from "@/components/ConfirmationModal";
import CustomDatePicker from "@/components/CustomDatePicker";
import CustomTimePicker from "@/components/CustomTimePicker";
import {
  Caterer,
  CateringOrder,
  CateringOrderItem,
  CateringPaymentRecord,
  CateringPaymentStatus,
  CateringOrderStatus,
  DateFilterType,
  isDateMatchingFilter,
  getTodayDateStr,
} from "@/types/catering";
import {
  ClipboardList,
  Plus,
  Search,
  Calendar,
  Phone,
  Clock,
  MapPin,
  Building,
  CreditCard,
  Banknote,
  Smartphone,
  Split,
  ChevronDown,
  RotateCw,
  X,
  Check,
  Eye,
  Trash2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  ShoppingBag,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Package,
  Layers,
  Users,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface CatalogProduct {
  id: string;
  name: string;
  categoryName?: string;
  amount: number;
  unit: string;
  imageUrl?: string;
}

export default function CateringOrdersPage() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();

  // Data states
  const [orders, setOrders] = useState<CateringOrder[]>([]);
  const [caterers, setCaterers] = useState<Caterer[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Search & Filter controls (Default today as requested)
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<DateFilterType>("today");
  const [customFrom, setCustomFrom] = useState<string>(getTodayDateStr());
  const [customTo, setCustomTo] = useState<string>(getTodayDateStr());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [selectedCatererFilter, setSelectedCatererFilter] = useState<string>("all");

  // Read URL query params (e.g. ?catererId=... or ?createFor=...)
  useEffect(() => {
    const filterCat = searchParams.get("catererId");
    if (filterCat) {
      setSelectedCatererFilter(filterCat);
      setDateFilter("all");
    }
  }, [searchParams]);

  // Full-Screen Create Order Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [orderDate, setOrderDate] = useState<string>(getTodayDateStr());
  const [deliveryDate, setDeliveryDate] = useState<string>(getTodayDateStr());
  const [deliveryTime, setDeliveryTime] = useState<string>("11:00 AM");
  const [eventName, setEventName] = useState<string>("");
  const [venueAddress, setVenueAddress] = useState<string>("");

  // Caterer Selection inside Modal (with dropdown search by name or mobile only)
  const [selectedCatererId, setSelectedCatererId] = useState<string>("");
  const [catererDropdownSearch, setCatererDropdownSearch] = useState<string>("");
  const [isCatererDropdownOpen, setIsCatererDropdownOpen] = useState<boolean>(false);
  const catererDropdownRef = useRef<HTMLDivElement>(null);

  // Items selection inside Modal
  const [selectedItems, setSelectedItems] = useState<CateringOrderItem[]>([]);
  const [itemSearchQuery, setItemSearchQuery] = useState<string>("");
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>("all");

  // Financials & Advance Payment inside Modal
  const [discountAmount, setDiscountAmount] = useState<number | string>("");
  const [advanceAmount, setAdvanceAmount] = useState<number | string>("");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "UPI" | "Card" | "Split">("Cash");
  const [splitCash, setSplitCash] = useState<number | string>("");
  const [splitUpi, setSplitUpi] = useState<number | string>("");
  const [splitCard, setSplitCard] = useState<number | string>("");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);

  // View Details Modal
  const [viewingOrder, setViewingOrder] = useState<CateringOrder | null>(null);

  // Collect Payment Modal
  const [paymentModalOrder, setPaymentModalOrder] = useState<CateringOrder | null>(null);
  const [collectAmountInput, setCollectAmountInput] = useState<number | string>("");
  const [collectMethod, setCollectMethod] = useState<"Cash" | "UPI" | "Card" | "Split">("Cash");
  const [collectSplitCash, setCollectSplitCash] = useState<number | string>("");
  const [collectSplitUpi, setCollectSplitUpi] = useState<number | string>("");
  const [collectSplitCard, setCollectSplitCard] = useState<number | string>("");
  const [collectNote, setCollectNote] = useState<string>("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);

  // Delete Confirmation
  const [deletingOrder, setDeletingOrder] = useState<CateringOrder | null>(null);

  // 1. Subscribe to Catering Orders
  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, "catering_orders"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: CateringOrder[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setOrders(list);
        setIsLoading(false);
      },
      (err) => {
        console.error("Error loading catering orders:", err);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // 2. Subscribe to Caterers
  useEffect(() => {
    const q = query(collection(db, "caterers"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Caterer[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setCaterers(list);
      },
      (err) => {
        console.error("Error loading caterers:", err);
      }
    );
    return () => unsubscribe();
  }, []);

  // 3. Subscribe to Products
  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: CatalogProduct[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || "Product",
            categoryName: data.categoryName || data.category || "General",
            amount: Number(data.amount) || 0,
            unit: data.unit || "KG",
            imageUrl: data.imageUrl || "",
          };
        });
        setProducts(list);
      },
      (err) => {
        console.error("Error loading products:", err);
      }
    );
    return () => unsubscribe();
  }, []);

  // Check URL if asked to create for a specific caterer
  useEffect(() => {
    const createFor = searchParams.get("createFor");
    if (createFor && caterers.length > 0) {
      handleOpenCreateModal(createFor);
    }
  }, [searchParams, caterers]);

  // Close caterer dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (catererDropdownRef.current && !catererDropdownRef.current.contains(event.target as Node)) {
        setIsCatererDropdownOpen(false);
      }
    }
    if (isCatererDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isCatererDropdownOpen]);

  // Categories list
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.categoryName) set.add(p.categoryName);
    });
    return Array.from(set).sort();
  }, [products]);

  // Filtered products for catalog inside modal
  const filteredCatalogProducts = useMemo(() => {
    return products.filter((p) => {
      const q = itemSearchQuery.toLowerCase().trim();
      const matchesSearch = !q || p.name.toLowerCase().includes(q);
      const matchesCat =
        selectedCategoryTab === "all" ? true : p.categoryName === selectedCategoryTab;
      return matchesSearch && matchesCat;
    });
  }, [products, itemSearchQuery, selectedCategoryTab]);

  // Filtered Caterers in dropdown (Requested: "fetch only by using name or mobiel umber i need search bar in dropdown")
  const dropdownFilteredCaterers = useMemo(() => {
    const q = catererDropdownSearch.toLowerCase().trim();
    if (!q) return caterers;
    return caterers.filter((c) => {
      return c.name.toLowerCase().includes(q) || c.mobile.includes(q);
    });
  }, [caterers, catererDropdownSearch]);

  const selectedCaterer = useMemo(() => {
    return caterers.find((c) => c.id === selectedCatererId) || null;
  }, [caterers, selectedCatererId]);

  // Calculated Order Financials
  const orderFinancials = useMemo(() => {
    const subtotal = Number(
      selectedItems.reduce((acc, item) => acc + item.totalAmount, 0).toFixed(2)
    );
    const discNum = Number(discountAmount) || 0;
    const totalAmount = Math.max(0, Number((subtotal - discNum).toFixed(2)));
    const advanceNum = Number(advanceAmount) || 0;
    const balanceAmount = Math.max(0, Number((totalAmount - advanceNum).toFixed(2)));

    let paymentStatus: CateringPaymentStatus = "Unpaid";
    if (totalAmount > 0) {
      if (balanceAmount <= 0) {
        paymentStatus = "Paid";
      } else if (advanceNum > 0) {
        paymentStatus = "Partial";
      } else {
        paymentStatus = "Unpaid";
      }
    }

    // Split sum calculation
    const splitSum = Number(
      (Number(splitCash || 0) + Number(splitUpi || 0) + Number(splitCard || 0)).toFixed(2)
    );
    const isSplitValid = paymentMethod === "Split" ? splitSum === advanceNum : true;

    return {
      subtotal,
      discount: discNum,
      totalAmount,
      advanceReceived: advanceNum,
      balanceAmount,
      paymentStatus,
      splitSum,
      isSplitValid,
    };
  }, [selectedItems, discountAmount, advanceAmount, paymentMethod, splitCash, splitUpi, splitCard]);

  // Filter Catering Orders for main list view
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      // 1. Search Query
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        ord.orderNumber.toLowerCase().includes(q) ||
        ord.catererName.toLowerCase().includes(q) ||
        ord.catererMobile.includes(q) ||
        (ord.eventName && ord.eventName.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // 2. Caterer filter
      if (selectedCatererFilter !== "all" && ord.catererId !== selectedCatererFilter) {
        return false;
      }

      // 3. Status filter
      if (statusFilter !== "all" && ord.orderStatus !== statusFilter) {
        return false;
      }

      // 4. Payment filter
      if (paymentFilter !== "all" && ord.paymentStatus !== paymentFilter) {
        return false;
      }

      // 5. Date filter (Order Date)
      return isDateMatchingFilter(ord.orderDate, dateFilter, customFrom, customTo);
    });
  }, [
    orders,
    searchQuery,
    selectedCatererFilter,
    statusFilter,
    paymentFilter,
    dateFilter,
    customFrom,
    customTo,
  ]);

  // Summary Metrics for top cards
  const summaryMetrics = useMemo(() => {
    let totalAmt = 0;
    let totalAdv = 0;
    let totalBal = 0;
    let partialCount = 0;

    orders.forEach((o) => {
      totalAmt += o.totalAmount || 0;
      totalAdv += o.advanceReceived || 0;
      totalBal += o.balanceAmount || 0;
      if (o.paymentStatus === "Partial" || o.balanceAmount > 0) {
        partialCount++;
      }
    });

    return {
      totalOrders: orders.length,
      totalAmt,
      totalAdv,
      totalBal,
      partialCount,
    };
  }, [orders]);

  // Open Full Screen Create Order Modal
  const handleOpenCreateModal = (preselectCatererId?: string) => {
    setOrderDate(getTodayDateStr());
    setDeliveryDate(getTodayDateStr());
    setDeliveryTime("11:00 AM");
    setEventName("");
    setVenueAddress("");
    setSelectedCatererId(preselectCatererId || (caterers[0]?.id || ""));
    setCatererDropdownSearch("");
    setIsCatererDropdownOpen(false);
    setSelectedItems([]);
    setItemSearchQuery("");
    setSelectedCategoryTab("all");
    setDiscountAmount("");
    setAdvanceAmount("");
    setPaymentMethod("Cash");
    setSplitCash("");
    setSplitUpi("");
    setSplitCard("");
    setIsCreateModalOpen(true);
  };

  // Add Item to Order
  const handleAddItemToOrder = (product: CatalogProduct) => {
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
        const newItem: CateringOrderItem = {
          id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          productId: product.id,
          name: product.name,
          unit: product.unit || "KG",
          rate: product.amount,
          quantity: 1,
          totalAmount: product.amount,
          imageUrl: product.imageUrl,
        };
        return [...prev, newItem];
      }
    });
    setItemSearchQuery(""); // Clear search on selection as requested
  };

  // Update item quantity
  const handleUpdateItemQuantity = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      setSelectedItems((prev) => prev.filter((i) => i.id !== itemId));
      return;
    }
    setSelectedItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              quantity: newQty,
              totalAmount: Number((newQty * i.rate).toFixed(2)),
            }
          : i
      )
    );
  };

  // Save Catering Order
  const handleSaveCateringOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCaterer) {
      showToast("Please select a caterer", "error");
      return;
    }
    if (selectedItems.length === 0) {
      showToast("Please add at least one sweet/product to the order", "error");
      return;
    }

    if (paymentMethod === "Split" && Number(advanceAmount) > 0 && !orderFinancials.isSplitValid) {
      showToast(
        `Split sum (₹${orderFinancials.splitSum}) does not match Advance Received (₹${orderFinancials.advanceReceived})`,
        "error"
      );
      return;
    }

    try {
      setIsSubmittingOrder(true);
      const now = new Date();
      const dateCode = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
        now.getDate()
      ).padStart(2, "0")}`;
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `CO-${dateCode}-${randomSuffix}`;

      // Build payment record if advance > 0
      const initialPayments: CateringPaymentRecord[] = [];
      if (orderFinancials.advanceReceived > 0) {
        initialPayments.push({
          id: `pay_${Date.now()}`,
          date: orderDate,
          amount: orderFinancials.advanceReceived,
          method: paymentMethod,
          splitDetails:
            paymentMethod === "Split"
              ? {
                  cash: Number(splitCash) || 0,
                  upi: Number(splitUpi) || 0,
                  card: Number(splitCard) || 0,
                }
              : undefined,
          note: "Advance received at order creation",
        });
      }

      const orderPayload: Omit<CateringOrder, "id"> = {
        orderNumber,
        catererId: selectedCaterer.id,
        catererName: selectedCaterer.name,
        catererMobile: selectedCaterer.mobile,
        catererCity: selectedCaterer.city || "",
        catererAddress: selectedCaterer.address || "",
        orderDate,
        deliveryDate,
        deliveryTime,
        eventName: eventName.trim() || "Buyer Function",
        venueAddress: venueAddress.trim() || selectedCaterer.address || "",
        items: selectedItems,
        subtotal: orderFinancials.subtotal,
        discount: orderFinancials.discount,
        totalAmount: orderFinancials.totalAmount,
        advanceReceived: orderFinancials.advanceReceived,
        balanceAmount: orderFinancials.balanceAmount,
        paymentStatus: orderFinancials.paymentStatus,
        paymentMethod,
        splitDetails:
          paymentMethod === "Split"
            ? {
                cash: Number(splitCash) || 0,
                upi: Number(splitUpi) || 0,
                card: Number(splitCard) || 0,
              }
            : undefined,
        paymentHistory: initialPayments,
        orderStatus: "Confirmed",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, "catering_orders"), orderPayload);

      // Update Caterer total stats
      try {
        const catRef = doc(db, "caterers", selectedCaterer.id);
        await updateDoc(catRef, {
          totalOrders: (selectedCaterer.totalOrders || 0) + 1,
          totalOrderValue: (selectedCaterer.totalOrderValue || 0) + orderFinancials.totalAmount,
          totalCredits: (selectedCaterer.totalCredits || 0) + orderFinancials.balanceAmount,
          updatedAt: serverTimestamp(),
        });
      } catch (catErr) {
        console.warn("Could not update caterer summary stats:", catErr);
      }

      showToast(`Buyer Order ${orderNumber} created successfully!`, "success");
      setIsCreateModalOpen(false);
    } catch (err: any) {
      console.error(err);
      showToast("Failed to create order: " + err.message, "error");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Open Collect Payment Modal
  const handleOpenPaymentModal = (order: CateringOrder) => {
    setPaymentModalOrder(order);
    setCollectAmountInput(order.balanceAmount > 0 ? order.balanceAmount : "");
    setCollectMethod("Cash");
    setCollectSplitCash("");
    setCollectSplitUpi("");
    setCollectSplitCard("");
    setCollectNote("");
  };

  // Submit Additional / Settlement Payment
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalOrder) return;

    const payAmt = Number(collectAmountInput);
    if (isNaN(payAmt) || payAmt <= 0) {
      showToast("Please enter a valid payment amount", "error");
      return;
    }

    if (collectMethod === "Split") {
      const splitSum =
        Number(collectSplitCash || 0) +
        Number(collectSplitUpi || 0) +
        Number(collectSplitCard || 0);
      if (splitSum !== payAmt) {
        showToast(`Split amounts sum (₹${splitSum}) must equal payment amount (₹${payAmt})`, "error");
        return;
      }
    }

    try {
      setIsSubmittingPayment(true);
      const newAdvance = Number((paymentModalOrder.advanceReceived + payAmt).toFixed(2));
      const newBalance = Math.max(0, Number((paymentModalOrder.totalAmount - newAdvance).toFixed(2)));
      const newStatus: CateringPaymentStatus = newBalance <= 0 ? "Paid" : "Partial";

      const newHistoryEntry: CateringPaymentRecord = {
        id: `pay_${Date.now()}`,
        date: getTodayDateStr(),
        amount: payAmt,
        method: collectMethod,
        splitDetails:
          collectMethod === "Split"
            ? {
                cash: Number(collectSplitCash) || 0,
                upi: Number(collectSplitUpi) || 0,
                card: Number(collectSplitCard) || 0,
              }
            : undefined,
        note: collectNote.trim() || "Installment payment",
      };

      const updatedHistory = [...(paymentModalOrder.paymentHistory || []), newHistoryEntry];

      await updateDoc(doc(db, "catering_orders", paymentModalOrder.id), {
        advanceReceived: newAdvance,
        balanceAmount: newBalance,
        paymentStatus: newStatus,
        paymentHistory: updatedHistory,
        updatedAt: serverTimestamp(),
      });

      showToast(`Payment of ₹${payAmt.toLocaleString("en-IN")} recorded!`, "success");
      setPaymentModalOrder(null);
    } catch (err: any) {
      console.error(err);
      showToast("Failed to record payment: " + err.message, "error");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Delete Order
  const handleDeleteOrder = async () => {
    if (!deletingOrder) return;
    try {
      await deleteDoc(doc(db, "catering_orders", deletingOrder.id));
      showToast(`Order ${deletingOrder.orderNumber} deleted`, "success");
      setDeletingOrder(null);
    } catch (err: any) {
      console.error(err);
      showToast("Failed to delete order: " + err.message, "error");
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full space-y-6">
      {/* 1. Header (Following Design Language) */}
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
              <ClipboardList size={18} />
            </div>
            <h1
              className="text-2xl text-[var(--color-text-primary)] tracking-tight"
              style={{ fontWeight: 500 }}
            >
              Buyers Orders
            </h1>
            <span
              className="px-2 py-0.5 text-xs rounded font-normal font-mono"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                border: "1px solid var(--color-border-base)",
                color: "var(--color-text-secondary)",
              }}
            >
              {filteredOrders.length} orders
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            Book bulk sweet buyer orders, assign buyers, schedule delivery dates, and track advance payments.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleOpenCreateModal()}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-md text-white transition-opacity hover:opacity-90 font-normal shadow-xs cursor-pointer"
            style={{ backgroundColor: "var(--color-brand-primary)" }}
          >
            <Plus size={15} />
            <span>Create Buyer Order</span>
          </button>
        </div>
      </div>

      {/* 2. Metric KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-lg border bg-white shadow-2xs" style={{ borderColor: "var(--color-border-base)" }}>
          <span className="text-[11px] text-slate-500 block">Total Orders</span>
          <span className="text-xl font-mono text-slate-900 mt-1 block" style={{ fontWeight: 500 }}>
            {summaryMetrics.totalOrders}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">All-time buyers</span>
        </div>

        <div className="p-3.5 rounded-lg border bg-white shadow-2xs" style={{ borderColor: "var(--color-border-base)" }}>
          <span className="text-[11px] text-slate-500 block">Total Order Value</span>
          <span className="text-xl font-mono text-slate-900 mt-1 block" style={{ fontWeight: 500 }}>
            ₹{summaryMetrics.totalAmt.toLocaleString("en-IN")}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">Cumulative billing</span>
        </div>

        <div className="p-3.5 rounded-lg border bg-emerald-50/50 border-emerald-200 shadow-2xs">
          <span className="text-[11px] text-emerald-800 block">Advance Received</span>
          <span className="text-xl font-mono text-emerald-700 mt-1 block" style={{ fontWeight: 500 }}>
            ₹{summaryMetrics.totalAdv.toLocaleString("en-IN")}
          </span>
          <span className="text-[10px] text-emerald-600 block mt-0.5 font-mono">Collected upfront</span>
        </div>

        <Link
          href="/catering-credits"
          className="p-3.5 rounded-lg border bg-orange-50/50 border-orange-200 shadow-2xs hover:bg-orange-100/60 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-orange-800 block font-medium">Pending Credits</span>
            <ExternalLink size={12} className="text-orange-600" />
          </div>
          <span className="text-xl font-mono text-orange-700 mt-1 block" style={{ fontWeight: 500 }}>
            ₹{summaryMetrics.totalBal.toLocaleString("en-IN")}
          </span>
          <span className="text-[10px] text-orange-600 block mt-0.5 font-mono">
            {summaryMetrics.partialCount} orders partially paid
          </span>
        </Link>
      </div>

      {/* 3. Date Filters & Search Toolbar */}
      <div className="bg-white p-3 md:p-4 rounded-lg border shadow-2xs space-y-3" style={{ borderColor: "var(--color-border-base)" }}>
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
            { id: "all", label: "All" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setDateFilter(f.id as DateFilterType)}
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

        {/* Custom Date Inputs */}
        {dateFilter === "custom" && (
          <div className="flex items-center gap-2 p-2 bg-sky-50/60 rounded-md border border-sky-100 text-xs text-sky-900 animate-in fade-in">
            <span className="font-medium text-xs">From:</span>
            <CustomDatePicker value={customFrom} onChange={setCustomFrom} placeholder="From date" />
            <span className="font-medium text-xs ml-2">To:</span>
            <CustomDatePicker value={customTo} onChange={setCustomTo} placeholder="To date" />
          </div>
        )}

        {/* Filters & Search Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border w-full sm:w-72 bg-white"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            <Search size={14} style={{ color: "var(--color-text-muted)" }} />
            <input
              type="text"
              placeholder="Search order #, caterer, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-transparent focus:outline-none"
              style={{ color: "var(--color-text-primary)" }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600">
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Caterer Filter */}
            <select
              value={selectedCatererFilter}
              onChange={(e) => setSelectedCatererFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none"
            >
              <option value="all">All Buyers</option>
              {caterers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.mobile})
                </option>
              ))}
            </select>

            {/* Payment Status Filter */}
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none"
            >
              <option value="all">All Payments</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
              <option value="Unpaid">Unpaid</option>
            </select>

            {/* Order Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="Confirmed">Confirmed</option>
              <option value="In Production">In Production</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Orders Table Display */}
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
                <th className="py-2.5 px-4">Order # & Date</th>
                <th className="py-2.5 px-4">Caterer & Mobile</th>
                <th className="py-2.5 px-4">Delivery Event</th>
                <th className="py-2.5 px-4 text-center">Items</th>
                <th className="py-2.5 px-4 text-right">Total Amount</th>
                <th className="py-2.5 px-4 text-right">Advance Paid</th>
                <th className="py-2.5 px-4 text-right">Balance Due</th>
                <th className="py-2.5 px-4 text-center">Payment Status</th>
                <th className="py-2.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <RotateCw size={20} className="animate-spin inline text-[#348bdd] mr-2" />
                    Loading buyer orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    No buyer orders match the current filter.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Order # */}
                    <td className="py-3 px-4 font-mono">
                      <span className="font-medium text-slate-900 block">{ord.orderNumber}</span>
                      <span className="text-[10px] text-slate-400">{ord.orderDate}</span>
                    </td>

                    {/* Caterer */}
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-900 block">{ord.catererName}</span>
                      <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                        <Phone size={10} className="text-slate-400" />
                        {ord.catererMobile} • {ord.catererCity || "Chirala"}
                      </span>
                    </td>

                    {/* Delivery Event */}
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800 block truncate max-w-[170px]">
                        {ord.eventName || "Buyer Function"}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                        <Clock size={10} className="text-slate-400" />
                        {ord.deliveryDate} at {ord.deliveryTime}
                      </span>
                    </td>

                    {/* Items Count */}
                    <td className="py-3 px-4 text-center font-mono">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                        {ord.items?.length || 0} Sweets
                      </span>
                    </td>

                    {/* Total Amount */}
                    <td className="py-3 px-4 text-right font-mono font-medium text-slate-900">
                      ₹{ord.totalAmount.toLocaleString("en-IN")}
                    </td>

                    {/* Advance Paid */}
                    <td className="py-3 px-4 text-right font-mono text-emerald-700">
                      <div>₹{ord.advanceReceived.toLocaleString("en-IN")}</div>
                      <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-emerald-50 text-emerald-800">
                        {ord.paymentMethod}
                      </span>
                    </td>

                    {/* Balance Due */}
                    <td className="py-3 px-4 text-right font-mono">
                      {ord.balanceAmount > 0 ? (
                        <span className="text-red-600 font-medium">
                          ₹{ord.balanceAmount.toLocaleString("en-IN")}
                        </span>
                      ) : (
                        <span className="text-emerald-600">₹0.00</span>
                      )}
                    </td>

                    {/* Payment Status */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          ord.paymentStatus === "Paid"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : ord.paymentStatus === "Partial"
                            ? "bg-orange-50 text-orange-800 border-orange-200"
                            : "bg-red-50 text-red-800 border-red-200"
                        }`}
                      >
                        {ord.paymentStatus}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setViewingOrder(ord)}
                          className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                          title="View Order Details"
                        >
                          <Eye size={13} />
                        </button>

                        {ord.balanceAmount > 0 && (
                          <button
                            onClick={() => handleOpenPaymentModal(ord)}
                            className="px-2 py-1 rounded bg-orange-50 text-orange-700 hover:bg-orange-600 hover:text-white text-[11px] font-normal transition-colors"
                            title="Collect Payment / Settle Balance"
                          >
                            Collect ₹
                          </button>
                        )}

                        <button
                          onClick={() => setDeletingOrder(ord)}
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          title="Delete Order"
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
      </div>

      {/* =================================================================== */}
      {/* 5. FULL-SCREEN CREATE ORDER MODAL (Requested: "open a full screen modal") */}
      {/* =================================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden animate-in fade-in duration-150">
          {/* Modal Top Bar */}
          <div
            className="px-6 py-3.5 border-b flex items-center justify-between shrink-0"
            style={{
              borderColor: "var(--color-border-subtle)",
              backgroundColor: "var(--color-bg-subtle)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                style={{ backgroundColor: "var(--color-brand-primary)" }}
              >
                <ClipboardList size={18} />
              </div>
              <div>
                <h2 className="text-base font-medium text-slate-900">Create Buyer Order</h2>
                <span className="text-xs text-slate-500 font-mono">
                  Bulk order booking & advance payment management
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Full Screen Form Body (2-Column Layout) */}
          <form onSubmit={handleSaveCateringOrder} className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Left 65%: Caterer Selection + Event Details + Sweets Selection */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5 border-r border-slate-200">
              {/* Row 1: Select Caterer (Dropdown with Name or Mobile Search only) */}
              <div className="space-y-1.5" ref={catererDropdownRef}>
                <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider">
                  Select Caterer <span className="text-rose-500">*</span>
                  <span className="text-slate-400 lowercase font-normal ml-1">
                    (search dropdown by name or mobile number only)
                  </span>
                </label>

                {/* Custom Caterer Dropdown Trigger */}
                <div className="relative">
                  <div
                    onClick={() => setIsCatererDropdownOpen(!isCatererDropdownOpen)}
                    className="p-3 rounded-md border bg-white flex items-center justify-between cursor-pointer hover:border-[#348bdd] transition-colors"
                    style={{ borderColor: "var(--color-border-base)" }}
                  >
                    {selectedCaterer ? (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-sky-50 text-[#348bdd] flex items-center justify-center">
                          <Users size={16} />
                        </div>
                        <div>
                          <span className="text-xs font-medium text-slate-900 block">{selectedCaterer.name}</span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {selectedCaterer.mobile} • {selectedCaterer.city || "Chirala"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Click to select buyer...</span>
                    )}

                    <ChevronDown size={16} className="text-slate-400 shrink-0" />
                  </div>

                  {/* Dropdown Menu with Search input inside */}
                  {isCatererDropdownOpen && (
                    <div
                      className="absolute left-0 right-0 top-full mt-1 z-30 bg-white rounded-lg border shadow-xl p-2 space-y-2 animate-in fade-in"
                      style={{ borderColor: "var(--color-border-base)" }}
                    >
                      {/* Search Input Filter Only by Name or Mobile */}
                      <div
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-slate-50"
                        style={{ borderColor: "var(--color-border-base)" }}
                      >
                        <Search size={13} className="text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search buyer by name or mobile..."
                          value={catererDropdownSearch}
                          onChange={(e) => setCatererDropdownSearch(e.target.value)}
                          autoFocus
                          className="w-full text-xs bg-transparent focus:outline-none"
                        />
                      </div>

                      {/* Dropdown Options List */}
                      <div className="max-h-52 overflow-y-auto space-y-1">
                        {dropdownFilteredCaterers.length === 0 ? (
                          <div className="py-4 text-center text-xs text-slate-400">
                            No buyers found matching &quot;{catererDropdownSearch}&quot;
                          </div>
                        ) : (
                          dropdownFilteredCaterers.map((cat) => (
                            <div
                              key={cat.id}
                              onClick={() => {
                                setSelectedCatererId(cat.id);
                                setIsCatererDropdownOpen(false);
                              }}
                              className={`p-2 rounded-md text-xs cursor-pointer flex items-center justify-between transition-colors ${
                                selectedCatererId === cat.id
                                  ? "bg-blue-50 text-[#348bdd]"
                                  : "hover:bg-slate-50 text-slate-800"
                              }`}
                            >
                              <div>
                                <span className="font-medium block">{cat.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {cat.mobile} • {cat.city || "Chirala"}
                                </span>
                              </div>
                              {selectedCatererId === cat.id && <Check size={14} className="text-[#348bdd]" />}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: Date & Delivery Timing Selection */}
              <div className="p-3.5 rounded-lg border bg-slate-50/50 space-y-3" style={{ borderColor: "var(--color-border-base)" }}>
                <span className="text-[11px] font-medium text-slate-700 uppercase tracking-wider block">
                  Event & Delivery Schedule
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Order Booking Date
                    </label>
                    <CustomDatePicker value={orderDate} onChange={setOrderDate} placeholder="Booking Date" />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Delivery / Function Date <span className="text-rose-500">*</span>
                    </label>
                    <CustomDatePicker value={deliveryDate} onChange={setDeliveryDate} placeholder="Delivery Date" />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Delivery Time
                    </label>
                    <CustomTimePicker value={deliveryTime} onChange={setDeliveryTime} placeholder="11:00 AM" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Function / Event Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Wedding Reception, Birthday, Temple Mahotsavam"
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd] bg-white"
                      style={{ borderColor: "var(--color-border-base)" }}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Venue / Delivery Address
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Function Hall, Gandhi Road, Chirala"
                      value={venueAddress}
                      onChange={(e) => setVenueAddress(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd] bg-white"
                      style={{ borderColor: "var(--color-border-base)" }}
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Select Sweets & Products (Requested: "display list of items on slect the items") */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-[11px] font-medium text-slate-700 uppercase tracking-wider block">
                    Select Sweets & Products <span className="text-rose-500">*</span>
                  </label>

                  {/* Search inside sweets list */}
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-white w-full sm:w-64"
                    style={{ borderColor: "var(--color-border-base)" }}
                  >
                    <Search size={13} className="text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search sweets by name..."
                      value={itemSearchQuery}
                      onChange={(e) => setItemSearchQuery(e.target.value)}
                      className="w-full text-xs bg-transparent focus:outline-none"
                    />
                    {itemSearchQuery && (
                      <button onClick={() => setItemSearchQuery("")} className="text-slate-400">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Category tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryTab("all")}
                    className={`px-2.5 py-1 rounded-md text-xs transition-colors shrink-0 ${
                      selectedCategoryTab === "all"
                        ? "bg-[#348bdd] text-white font-medium"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    All Sweets ({products.length})
                  </button>
                  {categoriesList.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategoryTab(cat)}
                      className={`px-2.5 py-1 rounded-md text-xs transition-colors shrink-0 ${
                        selectedCategoryTab === cat
                          ? "bg-[#348bdd] text-white font-medium"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Products Grid to click & add */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1 border rounded-lg bg-slate-50/40" style={{ borderColor: "var(--color-border-base)" }}>
                  {filteredCatalogProducts.map((prod) => {
                    const inCartCount = selectedItems.find((i) => i.productId === prod.id)?.quantity || 0;
                    return (
                      <div
                        key={prod.id}
                        onClick={() => handleAddItemToOrder(prod)}
                        className={`p-2.5 rounded-lg border bg-white cursor-pointer transition-all hover:border-[#348bdd] select-none flex flex-col justify-between ${
                          inCartCount > 0 ? "border-[#348bdd] ring-1 ring-[#348bdd] bg-blue-50/20" : "border-slate-200"
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start gap-1">
                            <span className="text-xs font-medium text-slate-900 line-clamp-1">{prod.name}</span>
                            {inCartCount > 0 && (
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-medium bg-[#348bdd] text-white shrink-0">
                                {inCartCount}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {prod.categoryName || "Sweet"}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs font-mono">
                          <span className="text-[#348bdd] font-medium">₹{prod.amount}</span>
                          <span className="text-[10px] text-slate-400">/{prod.unit}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Items Table */}
                <div className="space-y-1.5 pt-2">
                  <span className="text-xs font-medium text-slate-800 uppercase tracking-wider block">
                    Added Order Items ({selectedItems.length})
                  </span>

                  {selectedItems.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 border border-dashed rounded-lg">
                      No sweets added yet. Click on sweets above to add to this buyer order.
                    </div>
                  ) : (
                    <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-[10px] font-mono uppercase text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">Item</th>
                            <th className="py-2 px-3 text-right">Rate</th>
                            <th className="py-2 px-3 text-center w-36">Quantity ({selectedItems[0]?.unit || "KG"})</th>
                            <th className="py-2 px-3 text-right">Total</th>
                            <th className="py-2 px-3 text-center w-12"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedItems.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3 font-medium text-slate-900">{item.name}</td>
                              <td className="py-2 px-3 text-right font-mono text-slate-600">₹{item.rate}</td>
                              <td className="py-2 px-3 text-center">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateItemQuantity(item.id, item.quantity - 1)}
                                    className="w-6 h-6 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    step="any"
                                    min="0.1"
                                    value={item.quantity}
                                    onChange={(e) =>
                                      handleUpdateItemQuantity(item.id, parseFloat(e.target.value) || 0)
                                    }
                                    className="w-14 text-center text-xs py-1 rounded border border-slate-200 font-mono font-medium"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateItemQuantity(item.id, item.quantity + 1)}
                                    className="w-6 h-6 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-medium text-slate-900">
                                ₹{item.totalAmount}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateItemQuantity(item.id, 0)}
                                  className="text-slate-400 hover:text-red-500 cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right 35%: Financials & Advance Payment Management */}
            <div className="w-full lg:w-96 bg-slate-50/60 p-5 md:p-6 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-4">
                <span className="text-xs font-medium text-slate-800 uppercase tracking-wider block pb-2 border-b border-slate-200">
                  Billing & Advance Collection
                </span>

                {/* Subtotal & Discount */}
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Order Subtotal:</span>
                    <span className="font-mono font-medium text-slate-900">
                      ₹{orderFinancials.subtotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-slate-600">
                    <span>Discount (₹):</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                      className="w-24 px-2 py-1 text-right text-xs rounded border border-slate-200 bg-white font-mono"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-900">Total Order Amount:</span>
                    <span className="text-base font-mono font-medium text-[#348bdd]">
                      ₹{orderFinancials.totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Advance Received Section (Requested: "advance received amunt atr ight sde if recided then how from from UPI Cash Card Split if split ask for how much it recived in which method.") */}
                <div
                  className="p-3.5 rounded-lg border bg-white space-y-3"
                  style={{ borderColor: "var(--color-border-base)" }}
                >
                  <label className="block text-[11px] font-medium text-slate-700 uppercase tracking-wider">
                    Advance Received Amount (₹)
                  </label>

                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-slate-400 text-xs font-mono">₹</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max={orderFinancials.totalAmount}
                      placeholder="0.00"
                      value={advanceAmount}
                      onChange={(e) => setAdvanceAmount(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 text-sm rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd] font-mono font-medium bg-white"
                      style={{ borderColor: "var(--color-border-base)" }}
                    />
                  </div>

                  {/* Payment Method Selector (if advance > 0) */}
                  {Number(advanceAmount) > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100 animate-in fade-in">
                      <label className="block text-[11px] font-medium text-slate-600">
                        Received Through:
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(["Cash", "UPI", "Card", "Split"] as const).map((method) => (
                          <button
                            key={method}
                            type="button"
                            onClick={() => setPaymentMethod(method)}
                            className={`py-1.5 rounded text-xs font-medium cursor-pointer transition-colors text-center ${
                              paymentMethod === method
                                ? "bg-[#348bdd] text-white shadow-2xs"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                          >
                            {method}
                          </button>
                        ))}
                      </div>

                      {/* Split Method Details (Requested: "if split ask for how much it recived in which method") */}
                      {paymentMethod === "Split" && (
                        <div className="p-3 rounded-lg bg-sky-50/60 border border-sky-100 space-y-2 text-xs animate-in fade-in">
                          <span className="text-[10px] font-medium uppercase tracking-wider text-sky-900 block">
                            Specify Split Amounts:
                          </span>

                          <div className="space-y-1.5 font-mono">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-600 text-[11px] flex items-center gap-1">
                                <Banknote size={12} /> Cash:
                              </span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                placeholder="0"
                                value={splitCash}
                                onChange={(e) => setSplitCash(e.target.value)}
                                className="w-28 px-2 py-1 text-right text-xs rounded border border-slate-200 bg-white"
                              />
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-600 text-[11px] flex items-center gap-1">
                                <Smartphone size={12} /> UPI:
                              </span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                placeholder="0"
                                value={splitUpi}
                                onChange={(e) => setSplitUpi(e.target.value)}
                                className="w-28 px-2 py-1 text-right text-xs rounded border border-slate-200 bg-white"
                              />
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-600 text-[11px] flex items-center gap-1">
                                <CreditCard size={12} /> Card:
                              </span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                placeholder="0"
                                value={splitCard}
                                onChange={(e) => setSplitCard(e.target.value)}
                                className="w-28 px-2 py-1 text-right text-xs rounded border border-slate-200 bg-white"
                              />
                            </div>
                          </div>

                          {/* Split validation status */}
                          <div className="pt-1 flex items-center justify-between text-[11px] font-mono">
                            <span className="text-slate-500">Split Total:</span>
                            <span
                              className={`font-medium ${
                                orderFinancials.isSplitValid ? "text-emerald-700" : "text-rose-600"
                              }`}
                            >
                              ₹{orderFinancials.splitSum} / ₹{orderFinancials.advanceReceived}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Balance / Remaining Credit Display */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-600">Remaining Balance:</span>
                    <span
                      className={`font-mono font-medium text-sm ${
                        orderFinancials.balanceAmount > 0 ? "text-orange-700" : "text-emerald-700"
                      }`}
                    >
                      ₹{orderFinancials.balanceAmount.toFixed(2)}
                    </span>
                  </div>

                  {orderFinancials.balanceAmount > 0 && (
                    <div className="p-2 rounded bg-amber-50 text-[10px] text-amber-800 border border-amber-200 flex items-center gap-1.5">
                      <AlertTriangle size={13} className="shrink-0 text-amber-600" />
                      <span>Balance will be automatically tracked in Buyers Credits for settlement.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-2 text-xs rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer font-normal text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOrder || selectedItems.length === 0}
                  className="flex-1 py-2 text-xs rounded-md text-white shadow-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 font-normal"
                  style={{ backgroundColor: "var(--color-brand-primary)" }}
                >
                  {isSubmittingOrder ? <RotateCw size={13} className="animate-spin" /> : <Check size={14} />}
                  <span>Save Order</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* 6. View Order Details Modal */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white rounded-xl border shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            <div
              className="px-5 py-4 border-b flex items-center justify-between"
              style={{
                borderColor: "var(--color-border-subtle)",
                backgroundColor: "var(--color-bg-subtle)",
              }}
            >
              <div>
                <h3 className="text-sm font-medium text-slate-800">{viewingOrder.orderNumber}</h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  {viewingOrder.catererName} • {viewingOrder.orderDate}
                </span>
              </div>
              <button
                onClick={() => setViewingOrder(null)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Event & Caterer Details */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-mono">Caterer</span>
                  <span className="font-medium text-slate-800 block">{viewingOrder.catererName}</span>
                  <span className="text-slate-500 font-mono">{viewingOrder.catererMobile}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-mono">Delivery Schedule</span>
                  <span className="font-medium text-slate-800 block">
                    {viewingOrder.deliveryDate} at {viewingOrder.deliveryTime}
                  </span>
                  <span className="text-slate-500 truncate block">{viewingOrder.eventName}</span>
                </div>
              </div>

              {/* Items List */}
              <div>
                <span className="text-[11px] font-medium text-slate-700 uppercase tracking-wider block mb-1.5">
                  Ordered Sweets ({viewingOrder.items?.length || 0})
                </span>
                <div className="rounded-md border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-mono text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Item</th>
                        <th className="py-2 px-3 text-right">Rate</th>
                        <th className="py-2 px-3 text-center">Qty</th>
                        <th className="py-2 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {viewingOrder.items?.map((it, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-sans text-slate-800">{it.name}</td>
                          <td className="py-2 px-3 text-right text-slate-600">₹{it.rate}</td>
                          <td className="py-2 px-3 text-center text-slate-700">
                            {it.quantity} {it.unit}
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-slate-900">₹{it.totalAmount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 font-mono">
                <div className="flex justify-between text-slate-600">
                  <span className="font-sans">Subtotal:</span>
                  <span>₹{viewingOrder.subtotal?.toFixed(2)}</span>
                </div>
                {viewingOrder.discount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span className="font-sans">Discount:</span>
                    <span>-₹{viewingOrder.discount?.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-medium text-slate-900 pt-1 border-t border-slate-200">
                  <span className="font-sans">Grand Total:</span>
                  <span className="text-[#348bdd]">₹{viewingOrder.totalAmount?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span className="font-sans">Advance Collected:</span>
                  <span>₹{viewingOrder.advanceReceived?.toFixed(2)} ({viewingOrder.paymentMethod})</span>
                </div>
                <div className="flex justify-between font-medium text-orange-700 pt-1 border-t border-slate-200">
                  <span className="font-sans">Balance Credit Due:</span>
                  <span>₹{viewingOrder.balanceAmount?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewingOrder(null)}
                className="px-4 py-1.5 text-xs rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Quick Collect Payment Modal */}
      {paymentModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white rounded-xl border shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            <div
              className="px-5 py-4 border-b flex items-center justify-between"
              style={{
                borderColor: "var(--color-border-subtle)",
                backgroundColor: "var(--color-bg-subtle)",
              }}
            >
              <div>
                <h3 className="text-sm font-medium text-slate-800">Collect Payment</h3>
                <span className="text-[11px] text-slate-500 font-mono">
                  {paymentModalOrder.orderNumber} • {paymentModalOrder.catererName}
                </span>
              </div>
              <button
                onClick={() => setPaymentModalOrder(null)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="p-5 space-y-4">
              <div className="p-3 rounded-lg bg-orange-50/70 border border-orange-200 flex items-center justify-between font-mono">
                <span className="text-xs text-orange-900 font-sans">Remaining Balance Due:</span>
                <span className="text-base font-medium text-orange-700">
                  ₹{paymentModalOrder.balanceAmount.toLocaleString("en-IN")}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                  Payment Amount to Collect (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  max={paymentModalOrder.balanceAmount}
                  value={collectAmountInput}
                  onChange={(e) => setCollectAmountInput(e.target.value)}
                  required
                  className="w-full text-sm px-3 py-2 rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd] font-mono font-medium"
                  style={{ borderColor: "var(--color-border-base)" }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                  Payment Method
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["Cash", "UPI", "Card", "Split"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setCollectMethod(m)}
                      className={`py-1.5 rounded text-xs font-medium cursor-pointer transition-colors ${
                        collectMethod === m
                          ? "bg-[#348bdd] text-white shadow-2xs"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {collectMethod === "Split" && (
                <div className="p-3 rounded-lg bg-sky-50/60 border border-sky-100 space-y-2 text-xs font-mono">
                  <div className="flex justify-between items-center">
                    <span className="font-sans text-slate-600">Cash (₹):</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={collectSplitCash}
                      onChange={(e) => setCollectSplitCash(e.target.value)}
                      className="w-28 px-2 py-1 text-right text-xs rounded border border-slate-200 bg-white"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-sans text-slate-600">UPI (₹):</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={collectSplitUpi}
                      onChange={(e) => setCollectSplitUpi(e.target.value)}
                      className="w-28 px-2 py-1 text-right text-xs rounded border border-slate-200 bg-white"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-sans text-slate-600">Card (₹):</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={collectSplitCard}
                      onChange={(e) => setCollectSplitCard(e.target.value)}
                      className="w-28 px-2 py-1 text-right text-xs rounded border border-slate-200 bg-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                  Note / Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cash handed at factory, UPI Ref #..."
                  value={collectNote}
                  onChange={(e) => setCollectNote(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                  style={{ borderColor: "var(--color-border-base)" }}
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalOrder(null)}
                  className="px-3.5 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer font-normal"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="px-4 py-2 text-xs text-white rounded-md shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 font-normal"
                  style={{ backgroundColor: "var(--color-brand-primary)" }}
                >
                  {isSubmittingPayment ? <RotateCw size={13} className="animate-spin" /> : <Check size={14} />}
                  <span>Record Payment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(deletingOrder)}
        title="Delete Order"
        message={`Are you sure you want to delete buyer order "${deletingOrder?.orderNumber}"?`}
        confirmText="Delete"
        onConfirm={handleDeleteOrder}
        onCancel={() => setDeletingOrder(null)}
      />
    </div>
  );
}
