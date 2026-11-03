"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import { usePrinter } from "@/context/PrinterContext";
import CustomDatePicker from "@/components/CustomDatePicker";
import SearchableSelect, { SelectOption } from "@/components/SearchableSelect";
import ConfirmationModal from "@/components/ConfirmationModal";
import {
  QuotationRecord,
  QuotationItem,
  QuotationPartyDetails,
  QuotationCustomerDetails,
} from "@/types/quotation";
import { RoundoffRule, findMatchingRoundoffRule } from "@/types/roundoff";
import {
  FileText,
  Plus,
  Search,
  RotateCw,
  Printer,
  Share2,
  Trash2,
  Edit2,
  Eye,
  X,
  Check,
  Calendar,
  Building2,
  User,
  Phone,
  MapPin,
  Mail,
  Scale,
  Minus,
  Loader2,
  Sparkles,
  ArrowRight,
  ChevronDown,
  CheckCircle2,
  DollarSign,
  Boxes,
  Percent,
  Receipt,
  Store,
  MessageSquare,
  Clock,
  ExternalLink,
} from "lucide-react";

type DateFilterPreset =
  | "all"
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";

interface CatalogProduct {
  id: string;
  name: string;
  unit: string;
  amount: number;
  imageUrl?: string;
  categoryName?: string;
}

interface StoreItem {
  id: string;
  name: string;
  phone?: string;
  address?: string;
}

interface CustomerItem {
  id: string;
  name: string;
  phone: string;
  address?: string;
  city?: string;
  gstNumber?: string;
}

export default function QuotationsPage() {
  const { showToast } = useToast();
  const { printReceipt, setIsConnectModalOpen } = usePrinter();

  // 1. Data States
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [roundoffRules, setRoundoffRules] = useState<RoundoffRule[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Business Profile & GST Settings
  const [businessProfile, setBusinessProfile] = useState<QuotationPartyDetails>({
    tradeName: "Ravi Sweets & Cold Drinks",
    legalName: "Ravi Sweets",
    phone: "+91 98480 12345",
    altPhone: "",
    email: "contact@ravisweets.com",
    address: "Station Road, Main Market",
    city: "Chirala",
    state: "Andhra Pradesh",
    pincode: "523155",
    gstNumber: "37AAAAA0000A1Z5",
  });

  const [gstConfig, setGstConfig] = useState<{
    enabled: boolean;
    percentage: number;
    pricingType: "inclusive" | "exclusive";
  }>({
    enabled: true,
    percentage: 5,
    pricingType: "inclusive",
  });

  // 2. Filter & Search States
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<DateFilterPreset>("all");
  const [customFromDate, setCustomFromDate] = useState<string>("");
  const [customToDate, setCustomToDate] = useState<string>("");

  // 3. Create / Edit Quotation Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form Fields
  const [quotationNumber, setQuotationNumber] = useState<string>("");
  const [quotationDate, setQuotationDate] = useState<string>("");
  const [validUntilDate, setValidUntilDate] = useState<string>("");
  const [status, setStatus] = useState<QuotationRecord["status"]>("Sent");

  // From Details Form
  const [fromDetails, setFromDetails] = useState<QuotationPartyDetails>({ ...businessProfile });
  const [showEditFrom, setShowEditFrom] = useState<boolean>(false);

  // To Details Form (Customer)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [toDetails, setToDetails] = useState<QuotationCustomerDetails>({
    customerId: "",
    customerName: "",
    phone: "",
    address: "",
    city: "",
    gstNumber: "",
  });

  // Items in Quotation
  const [selectedItems, setSelectedItems] = useState<QuotationItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number | string>(0);
  const [isGstEnabled, setIsGstEnabled] = useState<boolean>(true);
  const [gstPercentage, setGstPercentage] = useState<number>(5);
  const [termsAndConditions, setTermsAndConditions] = useState<string>(
    "1. Quotation prices are valid for 15 days from the date of issue.\n2. 50% advance required upon final order booking.\n3. Custom gift boxes and sweet packing styles as per customer specification.\n4. Delivery schedules subject to production confirmation."
  );
  const [notes, setNotes] = useState<string>("");

  // Catalog Browser inside Modal
  const [catalogSearch, setCatalogSearch] = useState<string>("");

  // Custom / Manual Item Add Inputs
  const [showManualItemRow, setShowManualItemRow] = useState<boolean>(false);
  const [manualItemName, setManualItemName] = useState<string>("");
  const [manualItemUnit, setManualItemUnit] = useState<string>("KG");
  const [manualItemRate, setManualItemRate] = useState<number | string>("");
  const [manualItemQty, setManualItemQty] = useState<number | string>(1);

  // Weight Modal State
  const [isWeightModalOpen, setIsWeightModalOpen] = useState<boolean>(false);
  const [weightModalProduct, setWeightModalProduct] = useState<CatalogProduct | null>(null);
  const [weightInput, setWeightInput] = useState<number | string>(1);
  const [amountInput, setAmountInput] = useState<number | string>("");

  // 4. View Details Modal & Print State
  const [viewingQuotation, setViewingQuotation] = useState<QuotationRecord | null>(null);
  const [printingQuotation, setPrintingQuotation] = useState<QuotationRecord | null>(null);

  // 5. Delete Confirmation Modal
  const [deletingQuotation, setDeletingQuotation] = useState<QuotationRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Listen for afterprint to reset printingQuotation
  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintingQuotation(null);
    };
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  // Today Helper
  const getTodayStr = () => new Date().toISOString().split("T")[0];

  // =========================================================================
  // Realtime Listeners (Quotations, Settings, Products, Customers, Stores, Rules)
  // =========================================================================
  useEffect(() => {
    setIsLoading(true);

    // Quotations
    const qCol = collection(db, "quotations");
    const qQuery = query(qCol, orderBy("createdAt", "desc"));
    const unsubQuotations = onSnapshot(
      qQuery,
      (snapshot) => {
        const list: QuotationRecord[] = [];
        snapshot.docs.forEach((docSnap) => {
          list.push({
            id: docSnap.id,
            ...(docSnap.data() as Omit<QuotationRecord, "id">),
          });
        });
        setQuotations(list);
        setIsLoading(false);
      },
      (err) => {
        console.error("Quotations error:", err);
        setIsLoading(false);
      }
    );

    // Business Profile
    const unsubProfile = onSnapshot(doc(db, "settings", "business_profile"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
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
          gstNumber: data.gstNumber || prev.gstNumber,
        }));
      }
    });

    // GST Settings
    const unsubGst = onSnapshot(doc(db, "settings", "gst_settings"), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const conf = {
          enabled: d.enabled !== false,
          percentage: d.gstPercentage || 5,
          pricingType: d.pricingType === "exclusive" ? ("exclusive" as const) : ("inclusive" as const),
        };
        setGstConfig(conf);
        setIsGstEnabled(conf.enabled);
        setGstPercentage(conf.percentage);
      }
    });

    // Products
    const unsubProducts = onSnapshot(
      query(collection(db, "products"), orderBy("name", "asc")),
      (snap) => {
        const list: CatalogProduct[] = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || "",
          unit: d.data().unit || "piece",
          amount: Number(d.data().amount) || 0,
          imageUrl: d.data().imageUrl || "",
          categoryName: d.data().categoryName || "",
        }));
        setProducts(list);
      }
    );

    // Customers
    const unsubCustomers = onSnapshot(
      query(collection(db, "customers"), orderBy("name", "asc")),
      (snap) => {
        const list: CustomerItem[] = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || "",
          phone: d.data().phone || "",
          address: d.data().address || "",
          city: d.data().city || "",
          gstNumber: d.data().gstNumber || "",
        }));
        setCustomers(list);
      }
    );

    // Stores
    const unsubStores = onSnapshot(
      query(collection(db, "stores"), orderBy("name", "asc")),
      (snap) => {
        const list: StoreItem[] = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || "",
          phone: d.data().phone,
          address: d.data().address,
        }));
        setStores(list);
      }
    );

    // Roundoff Rules
    const unsubRules = onSnapshot(collection(db, "roundoff_rules"), (snap) => {
      const list: RoundoffRule[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<RoundoffRule, "id">),
      }));
      setRoundoffRules(list);
    });

    return () => {
      unsubQuotations();
      unsubProfile();
      unsubGst();
      unsubProducts();
      unsubCustomers();
      unsubStores();
      unsubRules();
    };
  }, []);

  // Customer options for SearchableSelect
  const customerSelectOptions: SelectOption[] = useMemo(() => {
    return customers.map((c) => ({
      value: c.id,
      label: c.name,
      sublabel: `📞 ${c.phone}${c.gstNumber ? ` • GSTIN: ${c.gstNumber}` : ""}${c.city ? ` • ${c.city}` : ""}`,
    }));
  }, [customers]);

  // When customer is selected from dropdown, prefill To Details
  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const found = customers.find((c) => c.id === customerId);
    if (found) {
      setToDetails({
        customerId: found.id,
        customerName: found.name,
        phone: found.phone || "",
        address: found.address || "",
        city: found.city || "",
        gstNumber: found.gstNumber || "",
      });
    }
  };

  // Helper: check if product is weight-based (KG/litre)
  const isWeightProduct = (unit: string) => {
    const u = (unit || "").toLowerCase().trim();
    return (
      u === "kg" ||
      u.includes("kilo") ||
      u === "litre" ||
      u === "liter" ||
      u === "ltr"
    );
  };

  // Helper: Auto-generate Quotation Number: QT-YYMMDD-001
  const generateQuotationNumber = () => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const prefix = `QT-${yy}${mm}${dd}-`;

    const count = quotations.filter((q) => q.quotationNumber?.startsWith(prefix)).length + 1;
    return `${prefix}${String(count).padStart(3, "0")}`;
  };

  // Helper: Format valid until date (+15 days default)
  const getDefaultValidUntilDate = (fromDateStr: string) => {
    const d = new Date(fromDateStr || new Date());
    d.setDate(d.getDate() + 15);
    return d.toISOString().split("T")[0];
  };

  // =========================================================================
  // Product Click Handler in Modal: piece adds directly; weight opens Weight Modal
  // =========================================================================
  const handleCatalogItemClick = (product: CatalogProduct) => {
    if (isWeightProduct(product.unit)) {
      setWeightModalProduct(product);
      setWeightInput(1);
      setAmountInput(product.amount);
      setIsWeightModalOpen(true);
    } else {
      // Piece based: increment if exists, else add new
      setSelectedItems((prev) => {
        const idx = prev.findIndex((i) => i.productId === product.id);
        if (idx !== -1) {
          const updated = [...prev];
          const newQty = updated[idx].quantity + 1;
          updated[idx] = {
            ...updated[idx],
            quantity: newQty,
            totalAmount: Number((newQty * updated[idx].rate).toFixed(2)),
          };
          return updated;
        } else {
          const item: QuotationItem = {
            id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            productId: product.id,
            name: product.name,
            unit: product.unit || "piece",
            rate: product.amount,
            quantity: 1,
            totalAmount: product.amount,
          };
          return [...prev, item];
        }
      });
      showToast(`Added ${product.name} (1 ${product.unit})`, "success");
    }
  };

  // Confirm Weight Item from Weight Modal
  const handleConfirmWeightItem = () => {
    if (!weightModalProduct || Number(weightInput) <= 0) return;

    const rawWeight = Number(weightInput);
    const matchingRule = findMatchingRoundoffRule(
      roundoffRules,
      rawWeight,
      fromDetails.storeId || "all"
    );
    const effectiveWeight = matchingRule ? matchingRule.roundOffValue : rawWeight;
    const lineAmt = Number((effectiveWeight * weightModalProduct.amount).toFixed(2));

    const item: QuotationItem = {
      id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      productId: weightModalProduct.id,
      name: weightModalProduct.name,
      unit: weightModalProduct.unit || "KG",
      rate: weightModalProduct.amount,
      quantity: effectiveWeight,
      originalWeight: matchingRule ? rawWeight : null,
      roundOffApplied: !!matchingRule,
      totalAmount: lineAmt,
    };

    setSelectedItems((prev) => [...prev, item]);

    if (matchingRule) {
      showToast(
        `Applied roundoff weight ${effectiveWeight} KG for ${weightModalProduct.name} (scale: ${rawWeight} KG)`,
        "info"
      );
    } else {
      showToast(`Added ${weightModalProduct.name} (${effectiveWeight} ${weightModalProduct.unit})`, "success");
    }

    setIsWeightModalOpen(false);
    setWeightModalProduct(null);
  };

  // Add Manual Custom Item
  const handleAddManualItem = () => {
    if (!manualItemName.trim() || Number(manualItemRate) <= 0 || Number(manualItemQty) <= 0) {
      showToast("Please enter valid item name, quantity, and rate", "error");
      return;
    }

    const qty = Number(manualItemQty);
    const rate = Number(manualItemRate);
    const totalAmount = Number((qty * rate).toFixed(2));

    const newItem: QuotationItem = {
      id: `line_manual_${Date.now()}`,
      name: manualItemName.trim(),
      unit: manualItemUnit.trim() || "piece",
      rate,
      quantity: qty,
      totalAmount,
    };

    setSelectedItems((prev) => [...prev, newItem]);
    setManualItemName("");
    setManualItemRate("");
    setManualItemQty(1);
    setShowManualItemRow(false);
    showToast(`Added custom item "${newItem.name}"`, "success");
  };

  // Update item quantity in quotation list
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

  // Remove item
  const handleRemoveItem = (lineId: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.id !== lineId));
  };

  // =========================================================================
  // Financial Computations (Subtotal, Discount, Taxable, GST, Grand Total)
  // =========================================================================
  const financials = useMemo(() => {
    const subtotal = selectedItems.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
    const discount = Math.min(subtotal, Math.max(0, Number(discountAmount) || 0));
    const taxableSubtotal = Math.max(0, subtotal - discount);

    let cgst = 0;
    let sgst = 0;
    let grandTotal = taxableSubtotal;

    if (isGstEnabled && gstPercentage > 0) {
      // Pricing type: inclusive vs exclusive
      if (gstConfig.pricingType === "exclusive") {
        const gstTotal = (taxableSubtotal * gstPercentage) / 100;
        cgst = Number((gstTotal / 2).toFixed(2));
        sgst = Number((gstTotal / 2).toFixed(2));
        grandTotal = Number((taxableSubtotal + gstTotal).toFixed(2));
      } else {
        // Inclusive
        const gstTotal = taxableSubtotal - taxableSubtotal / (1 + gstPercentage / 100);
        cgst = Number((gstTotal / 2).toFixed(2));
        sgst = Number((gstTotal / 2).toFixed(2));
        grandTotal = Number(taxableSubtotal.toFixed(2));
      }
    }

    return {
      subtotal: Number(subtotal.toFixed(2)),
      discount: Number(discount.toFixed(2)),
      taxableSubtotal: Number(taxableSubtotal.toFixed(2)),
      cgst,
      sgst,
      grandTotal: Math.round(grandTotal),
    };
  }, [selectedItems, discountAmount, isGstEnabled, gstPercentage, gstConfig.pricingType]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    const today = getTodayStr();
    setFormMode("create");
    setEditingId(null);
    setQuotationNumber(generateQuotationNumber());
    setQuotationDate(today);
    setValidUntilDate(getDefaultValidUntilDate(today));
    setStatus("Sent");
    setFromDetails({ ...businessProfile });
    setSelectedCustomerId("");
    setToDetails({
      customerId: "",
      customerName: "",
      phone: "",
      address: "",
      city: "",
      gstNumber: "",
    });
    setSelectedItems([]);
    setDiscountAmount(0);
    setIsGstEnabled(gstConfig.enabled);
    setGstPercentage(gstConfig.percentage);
    setNotes("");
    setShowEditFrom(false);
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (q: QuotationRecord) => {
    setFormMode("edit");
    setEditingId(q.id);
    setQuotationNumber(q.quotationNumber);
    setQuotationDate(q.quotationDate);
    setValidUntilDate(q.validUntilDate);
    setStatus(q.status);
    setFromDetails(q.fromDetails || { ...businessProfile });
    setSelectedCustomerId(q.toDetails.customerId || "");
    setToDetails({ ...q.toDetails });
    setSelectedItems(q.items || []);
    setDiscountAmount(q.discount || 0);
    setIsGstEnabled(!!q.isGstEnabled);
    setGstPercentage(q.gstPercentage || 5);
    setTermsAndConditions(q.termsAndConditions || "");
    setNotes(q.notes || "");
    setShowEditFrom(false);
    setIsFormModalOpen(true);
  };

  // Save Quotation (Create or Update)
  const handleSaveQuotation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!toDetails.customerName.trim()) {
      showToast("Customer Name is required in To Details", "error");
      return;
    }
    if (selectedItems.length === 0) {
      showToast("Please add at least one item to the quotation", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const sanitizedItems: QuotationItem[] = selectedItems.map((item, idx) => ({
        id: item.id || `line_${Date.now()}_${idx}`,
        productId: item.productId || "",
        name: item.name || "",
        unit: item.unit || "piece",
        rate: Number(item.rate) || 0,
        quantity: Number(item.quantity) || 0,
        totalAmount: Number(item.totalAmount) || 0,
        originalWeight: typeof item.originalWeight === "number" ? item.originalWeight : null,
        roundOffApplied: Boolean(item.roundOffApplied),
        notes: item.notes || "",
      }));

      const sanitizedFrom: QuotationPartyDetails = {
        tradeName: fromDetails.tradeName || businessProfile.tradeName || "Ravi Sweets & Cold Drinks",
        legalName: fromDetails.legalName || businessProfile.legalName || "",
        phone: fromDetails.phone || businessProfile.phone || "",
        altPhone: fromDetails.altPhone || businessProfile.altPhone || "",
        email: fromDetails.email || businessProfile.email || "",
        address: fromDetails.address || businessProfile.address || "",
        city: fromDetails.city || businessProfile.city || "Chirala",
        state: fromDetails.state || businessProfile.state || "Andhra Pradesh",
        pincode: fromDetails.pincode || businessProfile.pincode || "523155",
        gstNumber: fromDetails.gstNumber || businessProfile.gstNumber || "",
        storeId: fromDetails.storeId || "",
        storeName: fromDetails.storeName || "",
      };

      const sanitizedTo: QuotationCustomerDetails = {
        customerId: toDetails.customerId || "",
        customerName: (toDetails.customerName || "").trim(),
        phone: (toDetails.phone || "").trim(),
        email: (toDetails.email || "").trim(),
        address: (toDetails.address || "").trim(),
        city: (toDetails.city || "").trim(),
        gstNumber: (toDetails.gstNumber || "").trim().toUpperCase(),
      };

      const payload = {
        quotationNumber: quotationNumber.trim() || generateQuotationNumber(),
        quotationDate: quotationDate || getTodayStr(),
        validUntilDate: validUntilDate || getDefaultValidUntilDate(quotationDate),
        status,
        fromDetails: sanitizedFrom,
        toDetails: sanitizedTo,
        items: sanitizedItems,
        subtotal: financials.subtotal || 0,
        discount: financials.discount || 0,
        taxableSubtotal: financials.taxableSubtotal || 0,
        isGstEnabled: Boolean(isGstEnabled),
        gstPercentage: isGstEnabled ? (Number(gstPercentage) || 0) : 0,
        cgst: financials.cgst || 0,
        sgst: financials.sgst || 0,
        grandTotal: financials.grandTotal || 0,
        termsAndConditions: (termsAndConditions || "").trim(),
        notes: (notes || "").trim(),
        updatedAt: serverTimestamp(),
      };

      if (formMode === "edit" && editingId) {
        await updateDoc(doc(db, "quotations", editingId), payload as any);
        showToast(`Quotation #${payload.quotationNumber} updated successfully!`, "success");
      } else {
        const docRef = await addDoc(collection(db, "quotations"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        showToast(`Quotation #${payload.quotationNumber} created successfully!`, "success");
      }

      setIsFormModalOpen(false);
    } catch (err: any) {
      console.error("Save quotation error:", err);
      showToast("Error saving quotation: " + err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Quotation
  const handleDeleteQuotation = async () => {
    if (!deletingQuotation) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "quotations", deletingQuotation.id));
      showToast(`Quotation #${deletingQuotation.quotationNumber} deleted`, "success");
      setDeletingQuotation(null);
    } catch (err: any) {
      showToast("Error deleting quotation: " + err.message, "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // =========================================================================
  // WhatsApp Sharing Logic
  // =========================================================================
  const formatWhatsAppPhone = (phone: string): string => {
    const digits = (phone || "").replace(/\D/g, "");
    if (digits.length === 10) return "91" + digits;
    if (digits.length === 11 && digits.startsWith("0")) return "91" + digits.slice(1);
    if (digits.length === 12 && digits.startsWith("91")) return digits;
    return digits;
  };

  const handleSendWhatsApp = (q: QuotationRecord) => {
    const lines: string[] = [];
    lines.push(`*QUOTATION - ${q.fromDetails.tradeName.toUpperCase()}*`);
    lines.push(`────────────────────────`);
    lines.push(`*Quotation No:* #${q.quotationNumber}`);
    lines.push(`*Date:* ${q.quotationDate}`);
    if (q.validUntilDate) {
      lines.push(`*Valid Until:* ${q.validUntilDate}`);
    }
    lines.push(``);
    lines.push(`*To (Customer Details):*`);
    lines.push(`👤 *Name:* ${q.toDetails.customerName}`);
    if (q.toDetails.phone) lines.push(`📞 *Phone:* ${q.toDetails.phone}`);
    if (q.toDetails.address) lines.push(`📍 *Address:* ${q.toDetails.address}`);
    if (q.toDetails.gstNumber) lines.push(`🏢 *GSTIN:* ${q.toDetails.gstNumber}`);
    lines.push(``);
    lines.push(`*Estimated Items:*`);
    q.items.forEach((item, idx) => {
      const qtyStr = `${item.quantity} ${item.unit}`;
      lines.push(`${idx + 1}. *${item.name}* - ${qtyStr} @ ₹${item.rate} = ₹${item.totalAmount.toFixed(2)}`);
    });
    lines.push(``);
    lines.push(`────────────────────────`);
    lines.push(`*Subtotal:* ₹${q.subtotal.toFixed(2)}`);
    if (q.discount > 0) {
      lines.push(`*Discount:* -₹${q.discount.toFixed(2)}`);
    }
    if (q.isGstEnabled && (q.cgst > 0 || q.sgst > 0)) {
      lines.push(`*CGST (${q.gstPercentage / 2}%):* ₹${q.cgst.toFixed(2)}`);
      lines.push(`*SGST (${q.gstPercentage / 2}%):* ₹${q.sgst.toFixed(2)}`);
    }
    lines.push(`*Grand Total: ₹${q.grandTotal.toFixed(2)}*`);
    lines.push(`────────────────────────`);
    if (q.termsAndConditions) {
      lines.push(`*Terms & Conditions:*`);
      lines.push(q.termsAndConditions);
      lines.push(``);
    }
    lines.push(`Thank you for choosing *${q.fromDetails.tradeName}*!`);
    if (q.fromDetails.phone) lines.push(`📞 Call: ${q.fromDetails.phone}`);
    if (q.fromDetails.address) lines.push(`📍 Visit: ${q.fromDetails.address}, ${q.fromDetails.city}`);

    const text = lines.join("\n");
    const cleanPhone = formatWhatsAppPhone(q.toDetails.phone);
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(url, "_blank");
  };

  // =========================================================================
  // Thermal Print Handler (usePrinter)
  // =========================================================================
  const handleThermalPrint = async (q: QuotationRecord) => {
    try {
      await printReceipt({
        orderNumber: `QT-${q.quotationNumber}`,
        dateStr: q.quotationDate,
        timeStr: "Quote Estimate",
        storeName: q.fromDetails.tradeName || "Ravi Sweets Chirala",
        storePhone: q.fromDetails.phone || "",
        storeAddress: q.fromDetails.address || "Station Road, Chirala",
        customerName: q.toDetails.customerName,
        customerPhone: q.toDetails.phone,
        items: q.items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          rate: i.rate,
          totalAmount: i.totalAmount,
        })),
        subtotal: q.subtotal,
        discount: q.discount,
        taxableSubtotal: q.taxableSubtotal,
        cgst: q.cgst,
        sgst: q.sgst,
        gstPercentage: q.isGstEnabled ? q.gstPercentage : undefined,
        cgstPercentage: q.isGstEnabled ? q.gstPercentage / 2 : undefined,
        sgstPercentage: q.isGstEnabled ? q.gstPercentage / 2 : undefined,
        grandTotal: q.grandTotal,
        paymentMethod: "QUOTATION ESTIMATE",
        gstNumber: q.fromDetails.gstNumber,
      });
      showToast(`Sent quotation #${q.quotationNumber} to thermal printer`, "success");
    } catch (err: any) {
      console.warn("Thermal print error:", err);
      showToast("Thermal printer error: " + err.message, "error");
      setIsConnectModalOpen(true);
    }
  };

  // =========================================================================
  // A4 Print Handler (Triggers native print with clean printable overlay)
  // =========================================================================
  const handleA4Print = (q: QuotationRecord) => {
    setPrintingQuotation(q);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // =========================================================================
  // Date Filtering Computation
  // =========================================================================
  const filteredQuotations = useMemo(() => {
    const today = getTodayStr();

    return quotations.filter((q) => {
      const qDate = q.quotationDate || "";

      // 1. Date Filter
      if (dateFilter === "today") {
        if (qDate !== today) return false;
      } else if (dateFilter === "yesterday") {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const yest = d.toISOString().split("T")[0];
        if (qDate !== yest) return false;
      } else if (dateFilter === "this_week") {
        const now = new Date();
        const firstDay = new Date(now.setDate(now.getDate() - now.getDay()));
        const start = firstDay.toISOString().split("T")[0];
        if (qDate < start || qDate > today) return false;
      } else if (dateFilter === "last_week") {
        const now = new Date();
        const d = new Date(now.setDate(now.getDate() - now.getDay() - 7));
        const start = d.toISOString().split("T")[0];
        const endD = new Date(d);
        endD.setDate(endD.getDate() + 6);
        const end = endD.toISOString().split("T")[0];
        if (qDate < start || qDate > end) return false;
      } else if (dateFilter === "this_month") {
        const now = new Date();
        const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        if (qDate < start) return false;
      } else if (dateFilter === "last_month") {
        const now = new Date();
        const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const start = `${year}-${String(prevMonth + 1).padStart(2, "0")}-01`;
        const end = `${year}-${String(prevMonth + 1).padStart(2, "0")}-31`;
        if (qDate < start || qDate > end) return false;
      } else if (dateFilter === "this_year") {
        const year = new Date().getFullYear();
        if (!qDate.startsWith(String(year))) return false;
      } else if (dateFilter === "custom") {
        if (customFromDate && qDate < customFromDate) return false;
        if (customToDate && qDate > customToDate) return false;
      }

      // 2. Search Query
      if (searchQuery.trim()) {
        const term = searchQuery.toLowerCase().trim();
        const matchNumber = (q.quotationNumber || "").toLowerCase().includes(term);
        const matchCustomer = (q.toDetails.customerName || "").toLowerCase().includes(term);
        const matchPhone = (q.toDetails.phone || "").toLowerCase().includes(term);
        const matchGst = (q.toDetails.gstNumber || "").toLowerCase().includes(term);
        const matchItems = q.items?.some((i) => (i.name || "").toLowerCase().includes(term));
        if (!matchNumber && !matchCustomer && !matchPhone && !matchGst && !matchItems) return false;
      }

      return true;
    });
  }, [quotations, dateFilter, customFromDate, customToDate, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const totalCount = quotations.length;
    const totalValue = quotations.reduce((sum, q) => sum + (q.grandTotal || 0), 0);
    const activeCount = quotations.filter((q) => q.status === "Sent" || q.status === "Draft").length;
    return { totalCount, totalValue, activeCount };
  }, [quotations]);

  // Filtered Products for Modal Picker
  const filteredCatalog = useMemo(() => {
    if (!catalogSearch.trim()) return products;
    const q = catalogSearch.toLowerCase().trim();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(q))
    );
  }, [products, catalogSearch]);

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
      <div className="no-print space-y-6">
        {/* ===================================================================== */}
        {/* 1. Header Toolbar with Stats & Add Button                             */}
        {/* ===================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#348bdd] text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <FileText size={20} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Quotations</span>
                <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-[#348bdd] border border-blue-200 font-mono font-medium">
                  {quotations.length} total
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Generate professional commercial quotes, party catering estimates, and price proposals.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2 text-xs font-medium rounded-lg text-white shadow-sm flex items-center gap-1.5 cursor-pointer transition-all hover:opacity-95"
            style={{ backgroundColor: "var(--color-brand-primary)" }}
          >
            <Plus size={16} />
            <span>Add Quotation</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. Summary KPI Cards                                                  */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Total Quotations</span>
            <FileText size={15} className="text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">{stats.totalCount}</div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">Issued commercial proposals</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Total Value Estimated</span>
            <DollarSign size={15} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600">
            ₹{stats.totalValue.toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">Across all active estimates</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Active / Sent</span>
            <Clock size={15} className="text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600">{stats.activeCount}</div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono">Pending customer confirmation</div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. Search & Date Filter Bar                                           */}
      {/* ===================================================================== */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 w-full lg:w-96 bg-white">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search quotation #, customer, mobile, item, GSTIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-transparent focus:outline-none text-slate-800 placeholder-slate-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Date Filter Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 shrink-0">Date Filter:</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilterPreset)}
              className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="last_week">Last Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_year">This Year</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range Picker (Rendered only when "custom" is selected) */}
        {dateFilter === "custom" && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">From:</span>
              <CustomDatePicker
                value={customFromDate}
                onChange={(d) => setCustomFromDate(d)}
                placeholder="From date"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">To:</span>
              <CustomDatePicker
                value={customToDate}
                onChange={(d) => setCustomToDate(d)}
                placeholder="To date"
              />
            </div>
            {(customFromDate || customToDate) && (
              <button
                type="button"
                onClick={() => {
                  setCustomFromDate("");
                  setCustomToDate("");
                }}
                className="text-xs text-blue-600 hover:underline cursor-pointer"
              >
                Clear range
              </button>
            )}
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 4. Quotations Table                                                   */}
      {/* ===================================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center">
            <Loader2 size={24} className="animate-spin text-[#348bdd] mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-mono">Loading quotations list...</p>
          </div>
        ) : filteredQuotations.length === 0 ? (
          <div className="py-20 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <FileText size={24} />
            </div>
            <h3 className="text-sm font-semibold text-slate-800 mb-1">No Quotations Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              {quotations.length === 0
                ? "Create your first sweet or catering price proposal with customer details, items, and tax."
                : "No quotations matched your search or date filter."}
            </p>
            {quotations.length === 0 && (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="px-4 py-2 text-xs font-medium rounded-lg text-white shadow-2xs cursor-pointer"
                style={{ backgroundColor: "var(--color-brand-primary)" }}
              >
                <Plus size={14} className="inline mr-1" />
                Create First Quotation
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-mono text-slate-600 uppercase">
                  <th className="py-3 px-4 font-semibold">Quote # / Date</th>
                  <th className="py-3 px-4 font-semibold">Customer (To)</th>
                  <th className="py-3 px-4 font-semibold">Items Breakdown</th>
                  <th className="py-3 px-4 font-semibold text-right">Grand Total</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotations.map((q) => {
                  return (
                    <tr key={q.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Quote Number & Dates */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-block">
                          #{q.quotationNumber}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                          <Calendar size={11} className="text-slate-400" />
                          <span>{q.quotationDate}</span>
                          {q.validUntilDate && (
                            <span className="text-[10px] text-slate-400">
                              (Valid: {q.validUntilDate})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Customer / Client Details */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <User size={13} className="text-slate-400" />
                          <span>{q.toDetails.customerName}</span>
                        </div>
                        {q.toDetails.phone && (
                          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                            <Phone size={10} className="text-slate-400" />
                            <span>{q.toDetails.phone}</span>
                          </div>
                        )}
                        {q.toDetails.gstNumber && (
                          <div className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 font-mono inline-block mt-1">
                            GSTIN: {q.toDetails.gstNumber}
                          </div>
                        )}
                      </td>

                      {/* Items Summary */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="text-xs text-slate-800 font-medium truncate">
                          {q.items?.map((i) => `${i.name} (${i.quantity} ${i.unit})`).join(", ")}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {q.items?.length} {q.items?.length === 1 ? "item" : "items"}
                        </div>
                      </td>

                      {/* Grand Total */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-mono font-bold text-sm text-slate-900">
                          ₹{q.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </div>
                        {q.isGstEnabled && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            Incl. {q.gstPercentage}% GST
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            q.status === "Accepted"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : q.status === "Sent"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : q.status === "Converted to Order"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {q.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* WhatsApp */}
                          <button
                            type="button"
                            onClick={() => handleSendWhatsApp(q)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded border border-slate-200 hover:border-emerald-300 transition-colors shadow-2xs cursor-pointer"
                            title="Share via WhatsApp"
                          >
                            <MessageSquare size={13} />
                          </button>

                          {/* A4 Print */}
                          <button
                            type="button"
                            onClick={() => handleA4Print(q)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded border border-slate-200 hover:border-indigo-300 transition-colors shadow-2xs cursor-pointer"
                            title="Print A4 Tax Estimate"
                          >
                            <FileText size={13} />
                          </button>

                          {/* Thermal Print */}
                          <button
                            type="button"
                            onClick={() => handleThermalPrint(q)}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                            title="Thermal Print Slip"
                          >
                            <Printer size={13} />
                          </button>

                          {/* View */}
                          <button
                            type="button"
                            onClick={() => setViewingQuotation(q)}
                            className="p-1.5 text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                            title="View Full Details"
                          >
                            <Eye size={13} />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(q)}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                            title="Edit Quotation"
                          >
                            <Edit2 size={13} />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => setDeletingQuotation(q)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                            title="Delete Quotation"
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
      </div>
      </div>

      {/* ===================================================================== */}
      {/* 5. Create / Edit Quotation Modal                                      */}
      {/* ===================================================================== */}
      {isFormModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
          onClick={() => setIsFormModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#348bdd] flex items-center justify-center">
                  <FileText size={16} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">
                    {formMode === "edit" ? "Edit Quotation" : "Create New Quotation"}
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">#{quotationNumber}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Form Scrollable Body */}
            <form onSubmit={handleSaveQuotation} className="p-5 overflow-y-auto flex-1 space-y-5 text-xs">
              {/* Top Row: Quotation Date, Valid Until Date & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    Quotation Date <span className="text-red-500">*</span>
                  </label>
                  <CustomDatePicker
                    value={quotationDate}
                    onChange={(d) => {
                      setQuotationDate(d);
                      if (!validUntilDate) setValidUntilDate(getDefaultValidUntilDate(d));
                    }}
                    placeholder="Quotation Date"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    Valid Until Date <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <CustomDatePicker
                    value={validUntilDate}
                    onChange={(d) => setValidUntilDate(d)}
                    placeholder="Expiry Date"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    Quotation Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Sent">Sent to Customer</option>
                    <option value="Accepted">Accepted by Customer</option>
                    <option value="Converted to Order">Converted to Order</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>
              </div>

              {/* Two Column Section: FROM Details vs TO Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. FROM Details (Seller / Settings) */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider">
                      <Building2 size={13} className="text-[#348bdd]" />
                      From Details (From Settings)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowEditFrom(!showEditFrom)}
                      className="text-[11px] text-blue-600 hover:underline cursor-pointer"
                    >
                      {showEditFrom ? "Done Editing" : "Customise"}
                    </button>
                  </div>

                  {showEditFrom ? (
                    <div className="space-y-2 pt-1 animate-in fade-in duration-100">
                      <div>
                        <label className="text-[10px] text-slate-500 font-mono block">Trade Name</label>
                        <input
                          type="text"
                          value={fromDetails.tradeName}
                          onChange={(e) =>
                            setFromDetails((prev) => ({ ...prev, tradeName: e.target.value }))
                          }
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500 font-mono block">Phone</label>
                          <input
                            type="text"
                            value={fromDetails.phone}
                            onChange={(e) =>
                              setFromDetails((prev) => ({ ...prev, phone: e.target.value }))
                            }
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 font-mono block">GSTIN</label>
                          <input
                            type="text"
                            value={fromDetails.gstNumber || ""}
                            onChange={(e) =>
                              setFromDetails((prev) => ({ ...prev, gstNumber: e.target.value }))
                            }
                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-mono block">Address</label>
                        <input
                          type="text"
                          value={fromDetails.address}
                          onChange={(e) =>
                            setFromDetails((prev) => ({ ...prev, address: e.target.value }))
                          }
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1 text-[11px] text-slate-600">
                      <div className="font-semibold text-slate-900">{fromDetails.tradeName}</div>
                      <div className="flex items-center gap-1 text-slate-500">
                        <MapPin size={11} className="shrink-0" />
                        <span>
                          {fromDetails.address}, {fromDetails.city} - {fromDetails.pincode}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-500">
                        <Phone size={11} className="shrink-0" />
                        <span>{fromDetails.phone}</span>
                      </div>
                      {fromDetails.gstNumber && (
                        <div className="text-[10px] font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 inline-block">
                          GSTIN: {fromDetails.gstNumber}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. TO Details (Customer & GSTIN) */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-semibold text-slate-800 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider">
                      <User size={13} className="text-emerald-600" />
                      To Details (Customer Details)
                    </span>
                    <span className="text-[10px] text-slate-400">Select or enter new</span>
                  </div>

                  {/* Customer Quick Select from Existing */}
                  <div>
                    <label className="text-[10px] text-slate-500 font-mono block mb-1">
                      Quick Pick Customer (Optional)
                    </label>
                    <SearchableSelect
                      options={customerSelectOptions}
                      value={selectedCustomerId}
                      onChange={handleSelectCustomer}
                      placeholder="Search existing customer..."
                    />
                  </div>

                  {/* Manual Inputs for Customer */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono block">
                        Customer / Firm Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Sreekanth Garu"
                        value={toDetails.customerName}
                        onChange={(e) =>
                          setToDetails((prev) => ({ ...prev, customerName: e.target.value }))
                        }
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono block">
                        Mobile Number
                      </label>
                      <input
                        type="tel"
                        placeholder="e.g. 9848012345"
                        value={toDetails.phone}
                        onChange={(e) =>
                          setToDetails((prev) => ({ ...prev, phone: e.target.value }))
                        }
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono block">
                        Customer GST Number (GSTIN)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 37ABCDE1234F1Z5"
                        value={toDetails.gstNumber || ""}
                        onChange={(e) =>
                          setToDetails((prev) => ({ ...prev, gstNumber: e.target.value.toUpperCase() }))
                        }
                        className="w-full px-2.5 py-1.5 border border-purple-200 bg-purple-50/30 rounded text-xs font-mono uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono block">
                        City / Location
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Chirala"
                        value={toDetails.city || ""}
                        onChange={(e) =>
                          setToDetails((prev) => ({ ...prev, city: e.target.value }))
                        }
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 font-mono block">
                      Delivery / Billing Address
                    </label>
                    <input
                      type="text"
                      placeholder="Street, Landmark, City..."
                      value={toDetails.address || ""}
                      onChange={(e) =>
                        setToDetails((prev) => ({ ...prev, address: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Items Section: Catalog Quick Add & Selected Items Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 font-mono text-xs flex items-center gap-1.5 uppercase tracking-wider">
                    <Boxes size={14} className="text-[#348bdd]" />
                    Estimated Items ({selectedItems.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowManualItemRow(!showManualItemRow)}
                      className="text-xs text-[#348bdd] hover:underline font-medium cursor-pointer"
                    >
                      {showManualItemRow ? "Cancel Custom Item" : "+ Add Custom Item"}
                    </button>
                  </div>
                </div>

                {/* Catalog Quick Click Picker */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-slate-700">
                      Click any catalog sweet/product to add (Weight items prompt weight modal):
                    </span>
                    <div className="relative w-48">
                      <Search size={12} className="absolute left-2.5 top-2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Filter sweets..."
                        value={catalogSearch}
                        onChange={(e) => setCatalogSearch(e.target.value)}
                        className="w-full pl-7 pr-2.5 py-1 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-white rounded-lg border border-slate-200">
                    {filteredCatalog.slice(0, 30).map((p) => {
                      const isWeight = isWeightProduct(p.unit);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleCatalogItemClick(p)}
                          className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
                            isWeight
                              ? "bg-amber-50/70 border-amber-200 text-amber-900 hover:bg-amber-100"
                              : "bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100"
                          }`}
                        >
                          {isWeight && <Scale size={11} className="text-amber-600" />}
                          <span>{p.name}</span>
                          <span className="font-mono text-[10px] text-slate-400">
                            (₹{p.amount}/{p.unit})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Manual Item Row */}
                {showManualItemRow && (
                  <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50 flex flex-wrap items-end gap-2 animate-in fade-in duration-150">
                    <div className="flex-1 min-w-[150px]">
                      <label className="text-[10px] font-mono text-slate-500 block mb-1">Item Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Special Dry Fruit Box"
                        value={manualItemName}
                        onChange={(e) => setManualItemName(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded bg-white text-xs"
                      />
                    </div>
                    <div className="w-24">
                      <label className="text-[10px] font-mono text-slate-500 block mb-1">Unit</label>
                      <input
                        type="text"
                        placeholder="KG / Piece"
                        value={manualItemUnit}
                        onChange={(e) => setManualItemUnit(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded bg-white text-xs font-mono"
                      />
                    </div>
                    <div className="w-24">
                      <label className="text-[10px] font-mono text-slate-500 block mb-1">Rate (₹)</label>
                      <input
                        type="number"
                        placeholder="Rate"
                        value={manualItemRate}
                        onChange={(e) => setManualItemRate(e.target.value)}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded bg-white text-xs font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <div className="w-24">
                      <label className="text-[10px] font-mono text-slate-500 block mb-1">Qty</label>
                      <input
                        type="number"
                        placeholder="Qty"
                        value={manualItemQty}
                        onChange={(e) => setManualItemQty(e.target.value)}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded bg-white text-xs font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddManualItem}
                      className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs cursor-pointer shadow-2xs"
                    >
                      Add Line
                    </button>
                  </div>
                )}

                {/* Selected Items Table */}
                <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
                  {selectedItems.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No items added yet. Click sweets from the catalog above or add custom lines.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-mono text-slate-600 uppercase">
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Item Description</th>
                          <th className="py-2.5 px-3">Unit</th>
                          <th className="py-2.5 px-3 text-right">Rate</th>
                          <th className="py-2.5 px-3 text-center">Quantity</th>
                          <th className="py-2.5 px-3 text-right">Total (₹)</th>
                          <th className="py-2.5 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedItems.map((item, idx) => {
                          const isWeight = isWeightProduct(item.unit);
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                              <td className="py-2.5 px-3 font-medium text-slate-900">
                                <div>{item.name}</div>
                                {item.roundOffApplied && (
                                  <span className="text-[10px] text-blue-600 font-mono">
                                    ⚖️ Roundoff from {item.originalWeight} KG
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-500 uppercase">{item.unit}</td>
                              <td className="py-2.5 px-3 font-mono text-right text-slate-800">
                                ₹{item.rate.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {!isWeight ? (
                                  <div className="inline-flex items-center border border-slate-200 rounded bg-white">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateItemQuantity(item.id, item.quantity - 1)}
                                      className="p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"
                                    >
                                      <Minus size={11} />
                                    </button>
                                    <span className="w-8 text-center font-mono font-bold text-xs">
                                      {item.quantity}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateItemQuantity(item.id, item.quantity + 1)}
                                      className="p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"
                                    >
                                      <Plus size={11} />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                    {item.quantity} {item.unit}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-right text-slate-900">
                                ₹{item.totalAmount.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                                  title="Remove item"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Financials & Terms Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Terms and Conditions / Notes */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-700 block mb-1">
                      Terms & Conditions (Printed on Quote)
                    </label>
                    <textarea
                      rows={3}
                      value={termsAndConditions}
                      onChange={(e) => setTermsAndConditions(e.target.value)}
                      placeholder="Validity, advance, delivery guidelines..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-700 block mb-1">
                      Internal Notes <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Wedding party order discussion on phone"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                    />
                  </div>
                </div>

                {/* Calculation Box */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5 font-mono">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-slate-900">₹{financials.subtotal.toFixed(2)}</span>
                  </div>

                  {/* Discount */}
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="flex items-center gap-1 font-sans">
                      <Percent size={12} className="text-amber-500" />
                      Discount (₹):
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-24 text-right px-2 py-0.5 border border-slate-200 rounded bg-white text-xs font-mono font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Taxable Amount:</span>
                    <span className="font-semibold text-slate-900">₹{financials.taxableSubtotal.toFixed(2)}</span>
                  </div>

                  {/* GST Toggle */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                    <label className="flex items-center gap-2 cursor-pointer font-sans">
                      <input
                        type="checkbox"
                        checked={isGstEnabled}
                        onChange={(e) => setIsGstEnabled(e.target.checked)}
                        className="rounded border-slate-300 text-[#348bdd] focus:ring-0 cursor-pointer"
                      />
                      <span className="text-slate-700">Apply GST ({gstPercentage}%):</span>
                    </label>

                    {isGstEnabled && (
                      <span className="font-semibold text-slate-900">
                        ₹{(financials.cgst + financials.sgst).toFixed(2)}
                      </span>
                    )}
                  </div>

                  {isGstEnabled && (
                    <div className="text-[10px] text-slate-500 flex justify-between pl-5">
                      <span>CGST ({(gstPercentage / 2).toFixed(1)}%): ₹{financials.cgst.toFixed(2)}</span>
                      <span>SGST ({(gstPercentage / 2).toFixed(1)}%): ₹{financials.sgst.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Grand Total */}
                  <div className="flex items-center justify-between pt-2 border-t-2 border-slate-300 text-sm font-bold text-slate-900">
                    <span className="font-sans">Grand Total:</span>
                    <span className="text-base text-[#348bdd]">
                      ₹{financials.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Footer Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg text-white text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  style={{ backgroundColor: "var(--color-brand-primary)" }}
                >
                  {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
                  <span>{formMode === "edit" ? "Update Quotation" : "Save Quotation"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. Weight Modal (with Presets & Live Roundoff Indicator)              */}
      {/* ===================================================================== */}
      {isWeightModalOpen && weightModalProduct && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">
                  {weightModalProduct.name}
                </h3>
                <span className="text-[11px] font-mono text-slate-500">
                  Rate: ₹{weightModalProduct.amount} / {weightModalProduct.unit}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsWeightModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Weight Presets */}
            <div>
              <div className="text-[10px] font-mono text-slate-400 uppercase mb-1.5">
                Quick Weight Suggestions
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[0.25, 0.5, 1, 2].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => {
                      setWeightInput(w);
                      setAmountInput(Number((w * weightModalProduct.amount).toFixed(2)));
                    }}
                    className={`py-1.5 rounded-lg border font-mono text-xs font-semibold cursor-pointer ${
                      Number(weightInput) === w
                        ? "border-[#348bdd] bg-blue-50 text-[#348bdd]"
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    {w < 1 ? `${w * 1000}g` : `${w} KG`}
                  </button>
                ))}
              </div>
            </div>

            {/* Weight Input */}
            <div>
              <label className="block text-[11px] font-mono font-medium text-slate-700 mb-1">
                Weight in {weightModalProduct.unit}
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                value={weightInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setWeightInput(val);
                  if (val !== "" && Number(val) > 0) {
                    setAmountInput(Number((Number(val) * weightModalProduct.amount).toFixed(2)));
                  }
                }}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[#348bdd] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            {/* Live Roundoff Indicator */}
            {(() => {
              const rule = findMatchingRoundoffRule(
                roundoffRules,
                Number(weightInput),
                fromDetails.storeId || "all"
              );
              if (!rule) return null;
              return (
                <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-950 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-150">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Scale size={14} className="text-[#348bdd] shrink-0" />
                    <span>
                      Roundoff ({rule.fromWeight} - {rule.toWeight} KG):
                    </span>
                  </div>
                  <span className="font-mono font-bold text-xs bg-white px-2 py-0.5 rounded border border-blue-300 text-[#348bdd]">
                    ➔ {rule.roundOffValue} KG
                  </span>
                </div>
              );
            })()}

            {/* Amount Input (Bidirectional) */}
            <div>
              <label className="block text-[11px] font-mono font-medium text-slate-700 mb-1">
                Total Line Amount (₹)
              </label>
              <input
                type="number"
                step="any"
                min="1"
                value={amountInput}
                onChange={(e) => {
                  const amt = e.target.value;
                  setAmountInput(amt);
                  if (amt !== "" && Number(amt) > 0) {
                    setWeightInput(Number((Number(amt) / weightModalProduct.amount).toFixed(3)));
                  }
                }}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[#348bdd] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsWeightModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmWeightItem}
                className="px-4 py-1.5 rounded-lg bg-[#348bdd] hover:bg-[#2c78bf] text-white text-xs font-medium cursor-pointer shadow-2xs"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 7. View Quotation Modal                                               */}
      {/* ===================================================================== */}
      {viewingQuotation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4 animate-in fade-in duration-150"
          onClick={() => setViewingQuotation(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-[#348bdd]" />
                <h3 className="font-semibold text-slate-900 text-sm">
                  Quotation #{viewingQuotation.quotationNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingQuotation(null)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Parties Card */}
              <div className="grid grid-cols-2 gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">
                    From (Seller)
                  </span>
                  <div className="font-bold text-slate-900">{viewingQuotation.fromDetails.tradeName}</div>
                  <div className="text-slate-600 mt-0.5">{viewingQuotation.fromDetails.address}</div>
                  <div className="text-slate-600">{viewingQuotation.fromDetails.phone}</div>
                  {viewingQuotation.fromDetails.gstNumber && (
                    <div className="text-[10px] font-mono text-purple-700 mt-1">
                      GSTIN: {viewingQuotation.fromDetails.gstNumber}
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">
                    To (Customer)
                  </span>
                  <div className="font-bold text-slate-900">{viewingQuotation.toDetails.customerName}</div>
                  {viewingQuotation.toDetails.phone && (
                    <div className="text-slate-600 mt-0.5">{viewingQuotation.toDetails.phone}</div>
                  )}
                  {viewingQuotation.toDetails.address && (
                    <div className="text-slate-600">{viewingQuotation.toDetails.address}</div>
                  )}
                  {viewingQuotation.toDetails.gstNumber && (
                    <div className="text-[10px] font-mono text-purple-700 mt-1 font-semibold">
                      GSTIN: {viewingQuotation.toDetails.gstNumber}
                    </div>
                  )}
                </div>
              </div>

              {/* Items List */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-mono text-slate-600 uppercase">
                      <th className="py-2 px-3">Item</th>
                      <th className="py-2 px-3 text-right">Rate</th>
                      <th className="py-2 px-3 text-center">Qty</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {viewingQuotation.items.map((i, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-sans font-medium text-slate-900">
                          {i.name}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600">₹{i.rate.toFixed(2)}</td>
                        <td className="py-2 px-3 text-center text-slate-800">
                          {i.quantity} {i.unit}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          ₹{i.totalAmount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financials Breakdown */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 font-mono">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>₹{viewingQuotation.subtotal.toFixed(2)}</span>
                </div>
                {viewingQuotation.discount > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>Discount:</span>
                    <span>-₹{viewingQuotation.discount.toFixed(2)}</span>
                  </div>
                )}
                {viewingQuotation.isGstEnabled && (
                  <div className="flex justify-between text-slate-600">
                    <span>GST ({viewingQuotation.gstPercentage}%):</span>
                    <span>₹{(viewingQuotation.cgst + viewingQuotation.sgst).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                  <span>Grand Total:</span>
                  <span className="text-[#348bdd]">
                    ₹{viewingQuotation.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Terms */}
              {viewingQuotation.termsAndConditions && (
                <div className="p-3 rounded-lg bg-slate-50 text-[11px] text-slate-600 whitespace-pre-line leading-relaxed">
                  <span className="font-semibold block mb-1 font-mono text-slate-700 uppercase">
                    Terms & Conditions:
                  </span>
                  {viewingQuotation.termsAndConditions}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSendWhatsApp(viewingQuotation)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <MessageSquare size={13} />
                  <span>Send WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleA4Print(viewingQuotation)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <FileText size={13} />
                  <span>A4 Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThermalPrint(viewingQuotation)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Printer size={13} />
                  <span>Thermal Print</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setViewingQuotation(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 8. Dedicated A4 Printable Layout (Hidden on Screen, Active on Print)  */}
      {/* ===================================================================== */}
      {printingQuotation && (
        <>
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 0 !important;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body * {
                visibility: hidden !important;
              }
              #printable-quotation-a4,
              #printable-quotation-a4 * {
                visibility: visible !important;
              }
              #printable-quotation-a4 {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                min-height: auto !important;
                margin: 0 !important;
                padding: 12mm 15mm !important;
                box-shadow: none !important;
                border: none !important;
                background: #ffffff !important;
                box-sizing: border-box !important;
              }
            }
          `}} />
          <div id="printable-quotation-a4" className="hidden print:block bg-white text-black font-sans">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
            <div className="flex items-center gap-4">
              <img
                src="/logo.png"
                alt="Logo"
                className="w-16 h-16 object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
                  {printingQuotation.fromDetails.tradeName}
                </h1>
                <p className="text-xs text-slate-600">
                  {printingQuotation.fromDetails.address}, {printingQuotation.fromDetails.city} - {printingQuotation.fromDetails.pincode}
                </p>
                <p className="text-xs text-slate-600">
                  Phone: {printingQuotation.fromDetails.phone} | Email: {printingQuotation.fromDetails.email || "info@ravisweets.com"}
                </p>
                {printingQuotation.fromDetails.gstNumber && (
                  <p className="text-xs font-mono font-bold text-slate-800">
                    GSTIN: {printingQuotation.fromDetails.gstNumber}
                  </p>
                )}
              </div>
            </div>

            <div className="text-right">
              <span className="text-lg font-bold uppercase tracking-wider text-[#348bdd] border border-[#348bdd] px-3 py-1 rounded inline-block">
                QUOTATION
              </span>
              <div className="text-xs font-mono mt-2">
                <div><strong>Quote #:</strong> {printingQuotation.quotationNumber}</div>
                <div><strong>Date:</strong> {printingQuotation.quotationDate}</div>
                {printingQuotation.validUntilDate && (
                  <div><strong>Valid Until:</strong> {printingQuotation.validUntilDate}</div>
                )}
              </div>
            </div>
          </div>

          {/* Party Details */}
          <div className="grid grid-cols-2 gap-6 my-5 text-xs">
            <div className="p-3 border border-slate-300 rounded-lg">
              <span className="font-bold uppercase text-[10px] text-slate-500 block mb-1">
                QUOTATION FOR (CLIENT / CUSTOMER):
              </span>
              <div className="font-bold text-sm text-slate-900">{printingQuotation.toDetails.customerName}</div>
              {printingQuotation.toDetails.phone && <div>Phone: {printingQuotation.toDetails.phone}</div>}
              {printingQuotation.toDetails.address && <div>Address: {printingQuotation.toDetails.address}</div>}
              {printingQuotation.toDetails.city && <div>City: {printingQuotation.toDetails.city}</div>}
              {printingQuotation.toDetails.gstNumber && (
                <div className="font-mono font-bold text-slate-900 mt-1">
                  Customer GSTIN: {printingQuotation.toDetails.gstNumber}
                </div>
              )}
            </div>

            <div className="p-3 border border-slate-300 rounded-lg bg-slate-50">
              <span className="font-bold uppercase text-[10px] text-slate-500 block mb-1">
                ESTIMATE SUMMARY:
              </span>
              <div className="space-y-1">
                <div><strong>Proposal Status:</strong> {printingQuotation.status}</div>
                <div><strong>Total Items:</strong> {printingQuotation.items.length} items</div>
                <div><strong>Prepared By:</strong> {printingQuotation.fromDetails.tradeName} Counter</div>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <table className="w-full text-xs text-left border-collapse border border-slate-300 my-4">
            <thead>
              <tr className="bg-slate-100 font-bold border-b border-slate-300 uppercase text-[10px]">
                <th className="p-2 border-r border-slate-300 w-8 text-center">#</th>
                <th className="p-2 border-r border-slate-300">Item Description</th>
                <th className="p-2 border-r border-slate-300 w-16 text-center">Unit</th>
                <th className="p-2 border-r border-slate-300 w-24 text-right">Rate (₹)</th>
                <th className="p-2 border-r border-slate-300 w-20 text-center">Quantity</th>
                <th className="p-2 text-right w-28">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {printingQuotation.items.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-200">
                  <td className="p-2 border-r border-slate-300 text-center font-mono">{idx + 1}</td>
                  <td className="p-2 border-r border-slate-300 font-medium">{item.name}</td>
                  <td className="p-2 border-r border-slate-300 text-center uppercase font-mono">{item.unit}</td>
                  <td className="p-2 border-r border-slate-300 text-right font-mono">₹{item.rate.toFixed(2)}</td>
                  <td className="p-2 border-r border-slate-300 text-center font-mono font-bold">{item.quantity}</td>
                  <td className="p-2 text-right font-mono font-bold">₹{item.totalAmount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals & Signatures */}
          <div className="grid grid-cols-2 gap-6 my-4 text-xs">
            {/* Terms and conditions */}
            <div>
              {printingQuotation.termsAndConditions && (
                <div className="p-3 border border-slate-200 rounded text-[11px] leading-relaxed">
                  <span className="font-bold block mb-1 uppercase font-mono text-[10px]">
                    Terms & Conditions:
                  </span>
                  <div className="whitespace-pre-line text-slate-700">
                    {printingQuotation.termsAndConditions}
                  </div>
                </div>
              )}
            </div>

            {/* Calculations */}
            <div className="space-y-1.5 font-mono text-xs border border-slate-300 p-3 rounded bg-slate-50">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{printingQuotation.subtotal.toFixed(2)}</span>
              </div>
              {printingQuotation.discount > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>Discount:</span>
                  <span>-₹{printingQuotation.discount.toFixed(2)}</span>
                </div>
              )}
              {printingQuotation.isGstEnabled && (
                <>
                  <div className="flex justify-between">
                    <span>Taxable Subtotal:</span>
                    <span>₹{printingQuotation.taxableSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CGST ({(printingQuotation.gstPercentage / 2).toFixed(1)}%):</span>
                    <span>₹{printingQuotation.cgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SGST ({(printingQuotation.gstPercentage / 2).toFixed(1)}%):</span>
                    <span>₹{printingQuotation.sgst.toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-bold text-sm pt-2 border-t border-slate-300 text-slate-900">
                <span>Grand Total:</span>
                <span>₹{printingQuotation.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Bottom Authorization */}
          <div className="flex items-end justify-between pt-12 text-xs">
            <div className="text-[10px] text-slate-400">
              This is a computer-generated quotation estimate.
            </div>
            <div className="text-center font-mono">
              <div className="font-bold">For {printingQuotation.fromDetails.tradeName}</div>
              <div className="mt-8 border-t border-slate-400 pt-1 text-[10px]">Authorized Signatory</div>
            </div>
          </div>
        </div>
      </>
    )}

      {/* ===================================================================== */}
      {/* 9. Delete Confirmation Modal                                          */}
      {/* ===================================================================== */}
      <ConfirmationModal
        isOpen={!!deletingQuotation}
        onCancel={() => setDeletingQuotation(null)}
        onConfirm={handleDeleteQuotation}
        title="Delete Quotation"
        message={
          deletingQuotation
            ? `Are you sure you want to delete quotation #${deletingQuotation.quotationNumber} for "${deletingQuotation.toDetails.customerName}"? This action cannot be undone.`
            : ""
        }
        confirmText="Delete Quotation"
        isDeleting={isDeleting}
      />
    </div>
  );
}
