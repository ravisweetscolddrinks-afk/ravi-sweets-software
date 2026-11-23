"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  collection,
  doc,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { usePrinter } from "@/context/PrinterContext";
import { useToast } from "@/components/ToastProvider";
import * as XLSX from "xlsx";
import {
  ShoppingBag,
  Search,
  Calendar,
  Store,
  User,
  Phone,
  Printer,
  Eye,
  CreditCard,
  Banknote,
  Smartphone,
  Split,
  Boxes,
  Loader2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  RotateCw,
  X,
  FileText,
  Download,
  FileSpreadsheet,
} from "lucide-react";

interface SaleItem {
  id: string;
  productId?: string;
  name: string;
  unit: string;
  rate: number;
  quantity: number;
  totalAmount: number;
}

interface WalkInSaleRecord {
  id: string;
  billNumber: string;
  orderNumber: string;
  storeId: string;
  storeName: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  taxableSubtotal: number;
  cgst: number;
  sgst: number;
  grandTotal: number;
  paymentMethod: string;
  splitDetails?: { cash: number; upi: number; card: number };
  paymentStatus: string;
  deliveryDate: string;
  deliveryTime: string;
  createdAt: any;
}

interface StoreOption {
  id: string;
  name: string;
  phone?: string;
  address?: string;
}

type DateFilter = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "all";
const PAGE_SIZE = 24;

export default function WalkInSalesPage() {
  const { printReceipt, maskPhoneNumber } = usePrinter();
  const { showToast } = useToast();

  // Data states
  const [sales, setSales] = useState<WalkInSaleRecord[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [businessProfile, setBusinessProfile] = useState({
    tradeName: "Ravi Sweets & Cold Drinks",
    legalName: "Ravi Sweets",
    phone: "",
    email: "",
    address: "",
    city: "Chirala",
    state: "Andhra Pradesh",
    pincode: "",
  });
  const [gstConfig, setGstConfig] = useState<{
    enabled: boolean;
    percentage: number;
    pricingType: "inclusive" | "exclusive";
    gstNumber: string;
  }>({
    enabled: true,
    percentage: 5,
    pricingType: "inclusive",
    gstNumber: "",
  });

  // Filters & Pagination
  const [selectedStoreId, setSelectedStoreId] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);

  // View modal
  const [viewingSale, setViewingSale] = useState<WalkInSaleRecord | null>(null);

  // 1. Subscribe to Walk-In Sales & Stores in Real-Time
  useEffect(() => {
    setIsLoading(true);

    const qSales = query(collection(db, "walk_in_sales"), orderBy("createdAt", "desc"));
    const unsubSales = onSnapshot(
      qSales,
      (snap) => {
        const list: WalkInSaleRecord[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<WalkInSaleRecord, "id">),
        }));
        setSales(list);
        setIsLoading(false);
      },
      (err) => {
        console.error("Sales listener error:", err);
        setIsLoading(false);
      }
    );

    const qStores = query(collection(db, "stores"), orderBy("name", "asc"));
    const unsubStores = onSnapshot(
      qStores,
      (snap) => {
        setStores(
          snap.docs.map((d) => ({
            id: d.id,
            name: d.data().name || "Store",
            phone: d.data().phone || "",
            address: d.data().address || "",
          }))
        );
      },
      (err) => console.warn("Stores error:", err)
    );

    const unsubProfile = onSnapshot(
      doc(db, "settings", "business_profile"),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setBusinessProfile((prev) => ({
            ...prev,
            tradeName: d.tradeName || prev.tradeName,
            legalName: d.legalName || prev.legalName,
            phone: d.phone || prev.phone,
            email: d.email || prev.email,
            address: d.address || prev.address,
            city: d.city || prev.city,
            state: d.state || prev.state,
            pincode: d.pincode || prev.pincode,
          }));
        }
      },
      () => {}
    );

    const unsubGst = onSnapshot(
      doc(db, "settings", "gst_settings"),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setGstConfig({
            enabled: !!d.enabled,
            percentage: Number(d.gstPercentage) || 5,
            pricingType: d.pricingType === "exclusive" ? "exclusive" : "inclusive",
            gstNumber: d.gstNumber || "",
          });
        }
      },
      () => {}
    );

    return () => {
      unsubSales();
      unsubStores();
      unsubProfile();
      unsubGst();
    };
  }, []);

  // Helper for Date Filtering
  const isDateInRange = useCallback(
    (dateStr?: string, filter?: DateFilter) => {
      if (!dateStr || filter === "all") return true;
      const todayStr = new Date().toISOString().split("T")[0];

      const getOffsetDate = (days: number) => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return d.toISOString().split("T")[0];
      };

      const now = new Date();

      switch (filter) {
        case "today":
          return dateStr === todayStr;
        case "yesterday":
          return dateStr === getOffsetDate(-1);
        case "this_week": {
          const firstDayOfWeek = new Date(now);
          firstDayOfWeek.setDate(now.getDate() - now.getDay());
          const start = firstDayOfWeek.toISOString().split("T")[0];
          return dateStr >= start && dateStr <= todayStr;
        }
        case "last_week": {
          const d = new Date(now);
          d.setDate(now.getDate() - now.getDay() - 7);
          const start = d.toISOString().split("T")[0];
          const end = getOffsetDate(-now.getDay() - 1);
          return dateStr >= start && dateStr <= end;
        }
        case "this_month": {
          const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
          return dateStr >= start;
        }
        default:
          return true;
      }
    },
    []
  );

  // Filtered Sales List
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      // Store filter
      if (selectedStoreId !== "all" && sale.storeId !== selectedStoreId) {
        return false;
      }

      // Date filter
      const dateToCheck = sale.deliveryDate || (sale.createdAt?.toDate ? sale.createdAt.toDate().toISOString().split("T")[0] : "");
      if (!isDateInRange(dateToCheck, dateFilter)) {
        return false;
      }

      // Payment filter
      if (paymentFilter !== "all" && sale.paymentMethod !== paymentFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesBill = sale.billNumber?.toLowerCase().includes(q) || sale.orderNumber?.toLowerCase().includes(q);
        const matchesCust = sale.customerName?.toLowerCase().includes(q) || sale.customerPhone?.toLowerCase().includes(q);
        const matchesStore = sale.storeName?.toLowerCase().includes(q);
        const matchesItem = sale.items?.some((i) => i.name.toLowerCase().includes(q));
        if (!matchesBill && !matchesCust && !matchesStore && !matchesItem) return false;
      }

      return true;
    });
  }, [sales, selectedStoreId, dateFilter, paymentFilter, searchQuery, isDateInRange]);

  // Paginated Sales
  const totalPages = Math.max(1, Math.ceil(filteredSales.length / PAGE_SIZE));
  const paginatedSales = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredSales.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredSales, currentPage]);

  // Revenue & Tender Metrics
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let cashTotal = 0;
    let upiTotal = 0;
    let cardTotal = 0;

    filteredSales.forEach((s) => {
      totalRevenue += s.grandTotal || 0;
      if (s.paymentMethod === "Cash") cashTotal += s.grandTotal || 0;
      else if (s.paymentMethod === "UPI") upiTotal += s.grandTotal || 0;
      else if (s.paymentMethod === "Card") cardTotal += s.grandTotal || 0;
      else if (s.paymentMethod === "Split" && s.splitDetails) {
        cashTotal += Number(s.splitDetails.cash || 0);
        upiTotal += Number(s.splitDetails.upi || 0);
        cardTotal += Number(s.splitDetails.card || 0);
      }
    });

    return {
      totalRevenue,
      billsCount: filteredSales.length,
      cashTotal,
      upiTotal,
      cardTotal,
    };
  }, [filteredSales]);

  // Helper: Resolve complete tax breakdown for any walk-in sale
  const getSaleTaxSummary = (sale: WalkInSaleRecord) => {
    const anySale = sale as any;
    let subtotal = Number(sale.subtotal) || 0;
    let discount = Number(sale.discount) || 0;
    let taxableSubtotal = Number(sale.taxableSubtotal) || 0;
    let cgst = Number(sale.cgst) || 0;
    let sgst = Number(sale.sgst) || 0;
    const grandTotal = Number(sale.grandTotal) || 0;
    let gstPct = Number(anySale.gstPercentage) || (gstConfig.enabled ? gstConfig.percentage : 0);
    const gstType = anySale.gstType || gstConfig.pricingType || "inclusive";

    if (cgst <= 0 && sgst <= 0 && gstConfig.enabled && gstConfig.percentage > 0 && grandTotal > 0) {
      gstPct = gstConfig.percentage;
      const baseNet = Number((grandTotal / (1 + gstPct / 100)).toFixed(2));
      const totalTax = Number((grandTotal - baseNet).toFixed(2));
      const halfTax = Number((totalTax / 2).toFixed(2));
      cgst = halfTax;
      sgst = Number((totalTax - halfTax).toFixed(2));
      taxableSubtotal = baseNet;
      if (discount > 0) {
        const baseDiscount = Number((discount / (1 + gstPct / 100)).toFixed(2));
        discount = baseDiscount;
        subtotal = Number((baseNet + baseDiscount).toFixed(2));
      } else {
        subtotal = baseNet;
      }
    } else if (taxableSubtotal <= 0 && subtotal > 0) {
      taxableSubtotal = Number(Math.max(0, subtotal - discount).toFixed(2));
    }

    const totalGst = Number((cgst + sgst).toFixed(2));
    const hasGst = totalGst > 0 || (gstPct > 0 && (anySale.isGstEnabled || gstConfig.enabled));
    const cgstPct =
      gstPct > 0
        ? Number((gstPct / 2).toFixed(2))
        : taxableSubtotal > 0 && cgst > 0
        ? Number(((cgst / taxableSubtotal) * 100).toFixed(2))
        : 0;
    const sgstPct =
      gstPct > 0
        ? Number((gstPct / 2).toFixed(2))
        : taxableSubtotal > 0 && sgst > 0
        ? Number(((sgst / taxableSubtotal) * 100).toFixed(2))
        : 0;
    const expectedTotal = Number((taxableSubtotal + totalGst).toFixed(2));
    const diff = Number((grandTotal - expectedTotal).toFixed(2));
    const roundOff =
      anySale.roundOff !== undefined
        ? Number(anySale.roundOff)
        : Math.abs(diff) >= 0.01 && Math.abs(diff) < 1
        ? diff
        : 0;

    return {
      subtotal,
      discount,
      taxableSubtotal,
      cgst,
      sgst,
      totalGst,
      gstPct: gstPct || Number((cgstPct + sgstPct).toFixed(2)),
      cgstPct,
      sgstPct,
      gstType,
      roundOff,
      grandTotal,
      hasGst,
    };
  };

  // Handle Reprint with Complete Business, GST & Customer Details
  const handleReprintReceipt = async (sale: WalkInSaleRecord) => {
    const tax = getSaleTaxSummary(sale);
    const anySale = sale as any;
    const storeObj = stores.find((s) => s.id === sale.storeId);
    const fullBizAddress = [
      businessProfile.address,
      businessProfile.city,
      businessProfile.state,
      businessProfile.pincode,
    ]
      .filter(Boolean)
      .join(", ");

    await printReceipt({
      orderNumber: sale.billNumber || sale.orderNumber,
      dateStr: sale.deliveryDate || new Date().toISOString().split("T")[0],
      timeStr: sale.deliveryTime || "",
      billTitle: tax.hasGst ? "TAX INVOICE" : "COUNTER BILL",
      tradeName: businessProfile.tradeName || "Ravi Sweets",
      legalName: businessProfile.legalName || "",
      storeName: "",
      storePhone: storeObj?.phone || businessProfile.phone || "",
      storeAddress: storeObj?.address || fullBizAddress || "Chirala, AP",
      storeEmail: businessProfile.email || "",
      gstNumber: anySale.gstNumber || gstConfig.gstNumber || "",
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      customerAddress: sale.customerAddress || "",
      customerGstNumber: anySale.customerGstNumber || "",
      items: sale.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        rate: i.rate,
        totalAmount: i.totalAmount,
      })),
      subtotal: tax.subtotal,
      discount: tax.discount,
      taxableSubtotal: tax.taxableSubtotal,
      cgst: tax.cgst,
      sgst: tax.sgst,
      gstPercentage: tax.gstPct,
      cgstPercentage: tax.cgstPct,
      sgstPercentage: tax.sgstPct,
      isGstEnabled: tax.hasGst,
      gstType: tax.gstType,
      roundOff: tax.roundOff,
      grandTotal: tax.grandTotal,
      receivedAmount: tax.grandTotal,
      balanceAmount: 0,
      paymentStatus: sale.paymentStatus || "Done",
      paymentMethod: sale.paymentMethod,
      splitDetails: sale.splitDetails,
    });
  };

  // Export filtered walk-in sales bills to Excel (.xlsx)
  const handleExportSalesExcel = () => {
    try {
      if (filteredSales.length === 0) {
        showToast("No walk-in sales bills available to export", "error");
        return;
      }

      // Sheet 1: Sales Bills Summary
      const summaryRows = filteredSales.map((sale, index) => {
        const tax = getSaleTaxSummary(sale);
        const dateStr = sale.deliveryDate || (sale.createdAt?.toDate ? sale.createdAt.toDate().toISOString().split("T")[0] : "");
        const timeStr = sale.deliveryTime || (sale.createdAt?.toDate ? sale.createdAt.toDate().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "");
        const itemsOverview = sale.items?.map((i) => `${i.name} (${i.quantity} ${i.unit})`).join(", ") || "";
        const totalQty = sale.items?.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0) || 0;

        return {
          "S.No": index + 1,
          "Bill No": sale.billNumber || sale.orderNumber || "",
          "Date": dateStr,
          "Time": timeStr,
          "Store Name": sale.storeName || "",
          "Customer Name": sale.customerName || "Walk-In Customer",
          "Customer Phone": sale.customerPhone || "",
          "Total Items Count": sale.items?.length || 0,
          "Total Quantity": totalQty,
          "Items Details": itemsOverview,
          "Subtotal (₹)": tax.subtotal,
          "Discount (₹)": tax.discount,
          "Taxable Value (₹)": tax.taxableSubtotal,
          "CGST (₹)": tax.cgst,
          "SGST (₹)": tax.sgst,
          "Total GST (₹)": tax.totalGst,
          "Round Off (₹)": tax.roundOff,
          "Grand Total (₹)": tax.grandTotal,
          "Payment Mode": sale.paymentMethod || "Cash",
          "Cash (₹)": sale.paymentMethod === "Cash" ? tax.grandTotal : (sale.splitDetails?.cash || 0),
          "UPI (₹)": sale.paymentMethod === "UPI" ? tax.grandTotal : (sale.splitDetails?.upi || 0),
          "Card (₹)": sale.paymentMethod === "Card" ? tax.grandTotal : (sale.splitDetails?.card || 0),
          "Payment Status": sale.paymentStatus || "Done",
        };
      });

      // Sheet 2: Item Wise Details
      const itemRows: any[] = [];
      let itemIdx = 1;
      filteredSales.forEach((sale) => {
        const dateStr = sale.deliveryDate || (sale.createdAt?.toDate ? sale.createdAt.toDate().toISOString().split("T")[0] : "");
        sale.items?.forEach((item) => {
          itemRows.push({
            "S.No": itemIdx++,
            "Bill No": sale.billNumber || sale.orderNumber || "",
            "Date": dateStr,
            "Store Name": sale.storeName || "",
            "Customer Name": sale.customerName || "Walk-In Customer",
            "Item Name": item.name || "",
            "Unit": item.unit || "",
            "Quantity": Number(item.quantity) || 0,
            "Rate (₹)": Number(item.rate) || 0,
            "Amount (₹)": Number(item.totalAmount) || 0,
            "Payment Mode": sale.paymentMethod || "Cash",
          });
        });
      });

      const workbook = XLSX.utils.book_new();

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      wsSummary["!cols"] = [
        { wch: 6 },  // S.No
        { wch: 16 }, // Bill No
        { wch: 12 }, // Date
        { wch: 10 }, // Time
        { wch: 20 }, // Store Name
        { wch: 22 }, // Customer Name
        { wch: 15 }, // Customer Phone
        { wch: 16 }, // Total Items Count
        { wch: 14 }, // Total Quantity
        { wch: 40 }, // Items Details
        { wch: 14 }, // Subtotal
        { wch: 14 }, // Discount
        { wch: 16 }, // Taxable Value
        { wch: 12 }, // CGST
        { wch: 12 }, // SGST
        { wch: 14 }, // Total GST
        { wch: 12 }, // Round Off
        { wch: 16 }, // Grand Total
        { wch: 14 }, // Payment Mode
        { wch: 12 }, // Cash
        { wch: 12 }, // UPI
        { wch: 12 }, // Card
        { wch: 14 }, // Payment Status
      ];
      XLSX.utils.book_append_sheet(workbook, wsSummary, "Bills Summary");

      if (itemRows.length > 0) {
        const wsItems = XLSX.utils.json_to_sheet(itemRows);
        wsItems["!cols"] = [
          { wch: 6 },
          { wch: 16 },
          { wch: 12 },
          { wch: 20 },
          { wch: 22 },
          { wch: 30 },
          { wch: 10 },
          { wch: 12 },
          { wch: 12 },
          { wch: 14 },
          { wch: 14 },
        ];
        XLSX.utils.book_append_sheet(workbook, wsItems, "Item Wise Details");
      }

      const dateStamp = new Date().toISOString().split("T")[0];
      const fileName = `Ravi_Sweets_WalkIn_Bills_${dateFilter}_${dateStamp}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      showToast(`Exported ${filteredSales.length} walk-in bills to Excel!`, "success");
    } catch (err: any) {
      console.error("Export sales error:", err);
      showToast("Failed to export sales: " + err.message, "error");
    }
  };

  // Export a single walk-in sale bill to Excel (.xlsx)
  const handleExportSingleBillExcel = (sale: WalkInSaleRecord) => {
    try {
      const tax = getSaleTaxSummary(sale);
      const dateStr = sale.deliveryDate || (sale.createdAt?.toDate ? sale.createdAt.toDate().toISOString().split("T")[0] : "");
      const timeStr = sale.deliveryTime || (sale.createdAt?.toDate ? sale.createdAt.toDate().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "");

      const billHeaderData = [
        { Field: "Business Name", Value: businessProfile.tradeName || "Ravi Sweets & Cold Drinks" },
        { Field: "Bill Number", Value: sale.billNumber || sale.orderNumber || "" },
        { Field: "Date & Time", Value: `${dateStr} ${timeStr}`.trim() },
        { Field: "Store", Value: sale.storeName || "" },
        { Field: "Customer Name", Value: sale.customerName || "Walk-In Customer" },
        { Field: "Customer Phone", Value: sale.customerPhone || "N/A" },
        { Field: "Payment Method", Value: sale.paymentMethod || "Cash" },
        { Field: "Payment Status", Value: sale.paymentStatus || "Done" },
        { Field: "Items Subtotal (₹)", Value: tax.subtotal },
        { Field: "Discount (₹)", Value: tax.discount },
        { Field: "Taxable Value (₹)", Value: tax.taxableSubtotal },
        { Field: "CGST (₹)", Value: tax.cgst },
        { Field: "SGST (₹)", Value: tax.sgst },
        { Field: "Total GST (₹)", Value: tax.totalGst },
        { Field: "Round Off (₹)", Value: tax.roundOff },
        { Field: "Grand Total Paid (₹)", Value: tax.grandTotal },
      ];

      const itemRows = (sale.items || []).map((item, idx) => ({
        "S.No": idx + 1,
        "Item Name": item.name,
        "Unit": item.unit,
        "Quantity": Number(item.quantity) || 0,
        "Rate (₹)": Number(item.rate) || 0,
        "Total Amount (₹)": Number(item.totalAmount) || 0,
      }));

      const workbook = XLSX.utils.book_new();

      const wsItems = XLSX.utils.json_to_sheet(itemRows);
      wsItems["!cols"] = [
        { wch: 6 },
        { wch: 32 },
        { wch: 10 },
        { wch: 12 },
        { wch: 14 },
        { wch: 16 },
      ];
      XLSX.utils.book_append_sheet(workbook, wsItems, "Purchased Items");

      const wsInfo = XLSX.utils.json_to_sheet(billHeaderData);
      wsInfo["!cols"] = [{ wch: 24 }, { wch: 36 }];
      XLSX.utils.book_append_sheet(workbook, wsInfo, "Bill Information");

      const safeBill = (sale.billNumber || sale.orderNumber || "Bill").replace(/[^a-zA-Z0-9_-]/g, "_");
      XLSX.writeFile(workbook, `Ravi_Sweets_Bill_${safeBill}.xlsx`);
      showToast(`Exported bill ${sale.billNumber || sale.orderNumber} to Excel!`, "success");
    } catch (err: any) {
      console.error("Export bill error:", err);
      showToast("Failed to export bill: " + err.message, "error");
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
              <ShoppingBag size={18} />
            </div>
            <h1
              className="text-2xl text-[var(--color-text-primary)] tracking-tight"
              style={{ fontWeight: 500 }}
            >
              Walk In Sales
            </h1>
            <span
              className="px-2 py-0.5 text-xs rounded font-normal font-mono"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                border: "1px solid var(--color-border-base)",
                color: "var(--color-text-secondary)",
              }}
            >
              {filteredSales.length} total
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            Chronological counter billing receipts, cashier tender summaries, and instant thermal reprints.
          </p>
        </div>

        {/* Revenue Metric Pills */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-blue-50/50 border-blue-200 text-blue-900 shadow-2xs">
            <TrendingUp size={14} className="text-[#348bdd]" />
            <div className="flex flex-col">
              <span className="text-[9px] text-blue-600 uppercase font-mono">Total Sales</span>
              <span className="font-semibold text-xs font-mono">
                ₹{metrics.totalRevenue.toLocaleString()} ({metrics.billsCount} bills)
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-emerald-50/60 border-emerald-200 text-emerald-800 shadow-2xs">
            <Banknote size={14} className="text-emerald-600" />
            <div className="flex flex-col">
              <span className="text-[9px] text-emerald-600 uppercase font-mono">Cash</span>
              <span className="font-semibold text-xs font-mono">
                ₹{metrics.cashTotal.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-indigo-50/60 border-indigo-200 text-indigo-800 shadow-2xs">
            <Smartphone size={14} className="text-indigo-600" />
            <div className="flex flex-col">
              <span className="text-[9px] text-indigo-600 uppercase font-mono">UPI / QR</span>
              <span className="font-semibold text-xs font-mono">
                ₹{metrics.upiTotal.toLocaleString()}
              </span>
            </div>
          </div>

          <button
            onClick={handleExportSalesExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border font-normal cursor-pointer bg-white hover:bg-slate-50 transition-colors shadow-2xs border-slate-200 text-slate-700 shrink-0"
            title="Export filtered walk-in sales bills to Excel (.xlsx)"
          >
            <Download size={14} className="text-[#348bdd]" />
            <span>Export Bills</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Store Selector */}
          <div className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg p-1">
            <Store size={13} className="text-[#348bdd] ml-1" />
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-[#348bdd] cursor-pointer shadow-2xs"
            >
              <option value="all">All Retail Stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter Pills */}
          <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-white shadow-2xs text-xs">
            {(
              [
                { id: "today", label: "Today" },
                { id: "yesterday", label: "Yesterday" },
                { id: "this_week", label: "This Week" },
                { id: "this_month", label: "This Month" },
                { id: "all", label: "All Time" },
              ] as { id: DateFilter; label: string }[]
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setDateFilter(f.id);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  dateFilter === f.id
                    ? "bg-[#348bdd] text-white shadow-2xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Payment Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#348bdd] cursor-pointer shadow-2xs"
          >
            <option value="all">All Payment Modes</option>
            <option value="Cash">Cash</option>
            <option value="UPI">UPI</option>
            <option value="Card">Card</option>
            <option value="Split">Split</option>
          </select>

          {/* Search Box */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border w-full sm:w-60 bg-white"
            style={{
              borderColor: "var(--color-border-base)",
            }}
          >
            <Search size={14} style={{ color: "var(--color-text-muted)" }} />
            <input
              type="text"
              placeholder="Search bill #, customer..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs bg-transparent focus:outline-none"
              style={{ color: "var(--color-text-primary)" }}
            />
          </div>
        </div>

        <div
          className="text-xs self-end sm:self-center font-normal"
          style={{ color: "var(--color-text-muted)" }}
        >
          Showing {paginatedSales.length} of {filteredSales.length} (Limit: 24/page)
        </div>
      </div>

      {/* Main Table / Grid List (Supabase Table Editor Grid Style) */}
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
              Loading counter sales records...
            </span>
          </div>
        ) : paginatedSales.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center p-6">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                color: "var(--color-text-muted)",
              }}
            >
              <ShoppingBag size={22} />
            </div>
            <h3
              className="text-sm text-[var(--color-text-primary)]"
              style={{ fontWeight: 500 }}
            >
              No Walk-In Bills Found
            </h3>
            <p className="text-xs mt-1 max-w-sm" style={{ color: "var(--color-text-muted)" }}>
              {searchQuery
                ? "No bills match your search keyword or selected store/date filters."
                : "No counter sales settled yet for the selected period. Settle bills in POS to see them appear live."}
            </p>
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
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50 min-w-[140px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-800">bill_number</span>
                      <span className="text-[10px] font-mono text-slate-400">varchar</span>
                    </div>
                  </th>
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50 min-w-[140px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-800">date_time</span>
                      <span className="text-[10px] font-mono text-slate-400">timestamp</span>
                    </div>
                  </th>
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50 min-w-[180px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-800">customer</span>
                      <span className="text-[10px] font-mono text-slate-400">entity</span>
                    </div>
                  </th>
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50 min-w-[140px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-800">store_outlet</span>
                      <span className="text-[10px] font-mono text-slate-400">varchar</span>
                    </div>
                  </th>
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50 min-w-[200px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-800">items</span>
                      <span className="text-[10px] font-mono text-slate-400">array</span>
                    </div>
                  </th>
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50 text-center min-w-[110px]">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="font-medium text-slate-800">payment_mode</span>
                      <span className="text-[10px] font-mono text-slate-400">status</span>
                    </div>
                  </th>
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50 text-right min-w-[120px]">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="font-medium text-slate-800">grand_total</span>
                      <span className="text-[10px] font-mono text-slate-400">numeric</span>
                    </div>
                  </th>
                  <th className="px-3 py-2 font-medium text-right bg-slate-50/50 w-28">
                    <div className="flex items-center justify-end gap-1">
                      <span className="font-medium text-slate-800">actions</span>
                      <span className="text-[10px] font-mono text-slate-400">menu</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedSales.map((sale, idx) => {
                  const maskedPhone = maskPhoneNumber(sale.customerPhone);

                  return (
                    <tr
                      key={sale.id ? `${sale.id}_${idx}` : `sale_${idx}`}
                      className="divide-x divide-slate-200 hover:bg-slate-50/70 transition-colors"
                    >
                      {/* Bill Number */}
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        <span className="text-[#348bdd]">#{sale.billNumber || sale.orderNumber}</span>
                      </td>

                      {/* Date & Time */}
                      <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px]">
                        <div>{sale.deliveryDate}</div>
                        <div className="text-[10px] text-slate-400">{sale.deliveryTime}</div>
                      </td>

                      {/* Customer */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900 text-xs">
                          {sale.customerName || "Walk-In Customer"}
                        </div>
                        {sale.customerPhone && (
                          <div className="text-[11px] font-mono text-slate-500">
                            {maskedPhone}
                          </div>
                        )}
                      </td>

                      {/* Store Outlet */}
                      <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          {sale.storeName}
                        </span>
                      </td>

                      {/* Items Summary */}
                      <td className="py-2.5 px-3 text-slate-700 text-xs max-w-xs truncate">
                        {sale.items?.map((i) => `${i.name} (${i.quantity} ${i.unit})`).join(", ") || "—"}
                      </td>

                      {/* Payment Mode */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border font-mono ${
                            sale.paymentMethod === "Cash"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : sale.paymentMethod === "UPI"
                              ? "bg-sky-50 text-sky-700 border-sky-200"
                              : sale.paymentMethod === "Card"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {sale.paymentMethod}
                        </span>
                      </td>

                      {/* Grand Total */}
                      <td className="py-2.5 px-3 text-right font-mono font-extrabold text-sm text-[#348bdd] bg-blue-50/25">
                        ₹{sale.grandTotal}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleReprintReceipt(sale)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#348bdd] hover:bg-[#2b7bc4] text-white text-[11px] font-medium transition-colors cursor-pointer shadow-2xs"
                            title="Print Thermal Receipt Slip"
                          >
                            <Printer size={12} />
                            <span>Print</span>
                          </button>
                          <button
                            onClick={() => handleExportSingleBillExcel(sale)}
                            className="p-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer shadow-2xs"
                            title="Export Bill to Excel (.xlsx)"
                          >
                            <Download size={13} className="text-[#348bdd]" />
                          </button>
                          <button
                            onClick={() => setViewingSale(sale)}
                            className="p-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer shadow-2xs"
                            title="View Full Bill Details"
                          >
                            <Eye size={13} />
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
        {!isLoading && filteredSales.length > 0 && (
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

      {/* 4. View Bill Modal */}
      {viewingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-[#348bdd] flex items-center justify-center shadow-2xs">
                  <FileText size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
                    Counter Bill Details #{viewingSale.billNumber || viewingSale.orderNumber}
                  </h2>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {viewingSale.storeName} • {viewingSale.deliveryDate} {viewingSale.deliveryTime}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingSale(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              {/* Customer Banner */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-mono uppercase">Customer</span>
                  <div className="font-semibold text-slate-900 text-xs">
                    {viewingSale.customerName || "Walk-In Customer"}
                  </div>
                </div>
                {viewingSale.customerPhone && (
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-mono uppercase">Masked Phone</span>
                    <div className="font-mono text-slate-700 font-medium">
                      {maskPhoneNumber(viewingSale.customerPhone)}
                    </div>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div>
                <div className="text-[11px] font-mono text-slate-500 uppercase mb-1.5">
                  Items Purchased ({viewingSale.items?.length || 0})
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {viewingSale.items?.map((item, i) => (
                    <div key={i} className="p-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          ₹{item.rate} / {item.unit}
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-slate-600">{item.quantity} {item.unit}</div>
                        <div className="font-bold text-slate-900">₹{item.totalAmount.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Breakdown */}
              {(() => {
                const saleTax = getSaleTaxSummary(viewingSale);
                const bizGst = (viewingSale as any).gstNumber || gstConfig.gstNumber || "";
                return (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 font-mono text-xs">
                    {bizGst && (
                      <div className="flex justify-between text-slate-500 text-[10px] pb-1 border-b border-slate-200">
                        <span>Supplier GSTIN:</span>
                        <span className="font-semibold text-slate-700">{bizGst}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-600">
                      <span>Items Subtotal:</span>
                      <span>₹{saleTax.subtotal.toFixed(2)}</span>
                    </div>
                    {saleTax.discount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Discount:</span>
                        <span>-₹{saleTax.discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-700 pt-1 border-t border-slate-200/70">
                      <span>Taxable Value:</span>
                      <span>₹{saleTax.taxableSubtotal.toFixed(2)}</span>
                    </div>
                    {saleTax.hasGst && (
                      <>
                        <div className="flex justify-between text-slate-500 text-[11px]">
                          <span>CGST ({saleTax.cgstPct}%):</span>
                          <span>₹{saleTax.cgst.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-500 text-[11px]">
                          <span>SGST ({saleTax.sgstPct}%):</span>
                          <span>₹{saleTax.sgst.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-700 text-[11px] font-medium">
                          <span>Total GST ({saleTax.gstPct}% {saleTax.gstType === "exclusive" ? "Excl." : "Incl."}):</span>
                          <span>₹{saleTax.totalGst.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    {Math.abs(saleTax.roundOff) >= 0.01 && (
                      <div className="flex justify-between text-slate-500 text-[11px]">
                        <span>Round Off:</span>
                        <span>
                          {saleTax.roundOff > 0 ? "+" : "-"}₹{Math.abs(saleTax.roundOff).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-slate-900">
                      <span>Grand Total Paid:</span>
                      <span className="text-[#348bdd]">₹{saleTax.grandTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-[11px] pt-1">
                      <span>Payment Mode:</span>
                      <span className="font-semibold text-slate-800">{viewingSale.paymentMethod}</span>
                    </div>
                    {viewingSale.paymentMethod === "Split" && viewingSale.splitDetails && (
                      <div className="text-[10px] text-slate-600 bg-white px-2 py-1 rounded border border-slate-200 flex items-center justify-between">
                        <span>Cash: ₹{viewingSale.splitDetails.cash || 0}</span>
                        <span>UPI: ₹{viewingSale.splitDetails.upi || 0}</span>
                        <span>Card: ₹{viewingSale.splitDetails.card || 0}</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleReprintReceipt(viewingSale)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#348bdd] hover:bg-[#2b7bc4] text-white text-xs font-semibold cursor-pointer shadow-2xs"
                >
                  <Printer size={13} />
                  <span>Reprint Receipt Slip</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportSingleBillExcel(viewingSale)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer shadow-2xs"
                  title="Export Bill to Excel (.xlsx)"
                >
                  <Download size={13} className="text-[#348bdd]" />
                  <span>Export Bill</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setViewingSale(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium cursor-pointer hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
