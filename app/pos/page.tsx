"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import { usePrinter } from "@/context/PrinterContext";
import {
  Receipt,
  Barcode,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  User,
  Store,
  CreditCard,
  Banknote,
  Smartphone,
  Split,
  Printer,
  FileText,
  Clock,
  Boxes,
  Loader2,
  X,
  Edit2,
  Check,
  AlertCircle,
  FolderOpen,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface ProductCatalogItem {
  id: string;
  name: string;
  unit: string;
  amount: number;
  imageUrl?: string;
  categoryName?: string;
  barcode?: string;
  shortCode?: string;
  piecesPerKg?: number | string;
  kgPerTray?: number | string;
}

interface PosCartLine {
  lineId: string;
  productId: string;
  name: string;
  unit: string;
  rate: number;
  quantity: number;
  totalAmount: number;
  imageUrl?: string;
  piecesPerKg?: number | string;
  kgPerTray?: number | string;
}

interface CustomerOption {
  id: string;
  name: string;
  phone: string;
  city?: string;
  email?: string;
  address?: string;
}

interface StoreOption {
  id: string;
  name: string;
  phone?: string;
  address?: string;
}

interface DraftedBill {
  id: string;
  billNumber: string;
  storeId: string;
  storeName: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  items: PosCartLine[];
  discount: number;
  paymentMethod: string;
  totalAmount: number;
  createdAt: any;
}

type PaymentMode = "Cash" | "UPI" | "Card" | "Split";

export default function PosBillingPage() {
  const { showToast } = useToast();
  const { printReceipt, settings, setIsConnectModalOpen } = usePrinter();

  // Reference data
  const [products, setProducts] = useState<ProductCatalogItem[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [draftedBills, setDraftedBills] = useState<DraftedBill[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [gstConfig, setGstConfig] = useState<{ enabled: boolean; percentage: number; pricingType: "inclusive" | "exclusive" }>({
    enabled: true,
    percentage: 5,
    pricingType: "inclusive",
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Cart State
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [cart, setCart] = useState<PosCartLine[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [discountAmount, setDiscountAmount] = useState<number | string>("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("Cash");
  const [splitAmounts, setSplitAmounts] = useState<{ cash: number; upi: number; card: number }>({
    cash: 0,
    upi: 0,
    card: 0,
  });

  // Filter & Search
  const [searchBarcode, setSearchBarcode] = useState<string>("");
  const [productSearch, setProductSearch] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Modals
  const [isDraftsModalOpen, setIsDraftsModalOpen] = useState<boolean>(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState<boolean>(false);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState<boolean>(false);
  const [isWeightModalOpen, setIsWeightModalOpen] = useState<boolean>(false);
  const [weightModalProduct, setWeightModalProduct] = useState<ProductCatalogItem | null>(null);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState<number | string>(1);
  const [amountInput, setAmountInput] = useState<number | string>("");

  // Customer Form
  const [customerForm, setCustomerForm] = useState({
    name: "",
    phone: "",
    city: "",
    email: "",
    address: "",
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // 1. Real-Time Subscriptions
  useEffect(() => {
    setIsLoading(true);

    // Products
    const unsubProducts = onSnapshot(
      query(collection(db, "products"), orderBy("name", "asc")),
      (snap) => {
        const list: ProductCatalogItem[] = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || "",
          unit: d.data().unit || "piece",
          amount: Number(d.data().amount) || 0,
          imageUrl: d.data().imageUrl || "",
          categoryName: d.data().categoryName || "Sweets",
          barcode: d.data().barcode || "",
          shortCode: d.data().shortCode || "",
          piecesPerKg: d.data().piecesPerKg || "",
          kgPerTray: d.data().kgPerTray || "",
        }));
        setProducts(list);
        setIsLoading(false);
      },
      (err) => {
        console.error("Products error:", err);
        setIsLoading(false);
      }
    );

    // Stores
    const unsubStores = onSnapshot(
      query(collection(db, "stores"), orderBy("name", "asc")),
      (snap) => {
        const list: StoreOption[] = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || "Store",
          phone: d.data().phone,
          address: d.data().address,
        }));
        setStores(list);
        if (list.length > 0 && !selectedStoreId) {
          setSelectedStoreId(list[0].id);
        }
      },
      (err) => console.warn("Stores error:", err)
    );

    // Customers
    const unsubCustomers = onSnapshot(
      query(collection(db, "customers"), orderBy("name", "asc")),
      (snap) => {
        const list: CustomerOption[] = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || "Customer",
          phone: d.data().phone || "",
          city: d.data().city || "",
          email: d.data().email || "",
          address: d.data().address || "",
        }));
        setCustomers(list);
      },
      (err) => console.warn("Customers error:", err)
    );

    // Drafted Bills
    const unsubDrafts = onSnapshot(
      query(collection(db, "drafted_bills"), orderBy("createdAt", "desc")),
      (snap) => {
        const list: DraftedBill[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<DraftedBill, "id">),
        }));
        setDraftedBills(list);
      },
      (err) => console.warn("Drafts error:", err)
    );

    // GST Settings
    const unsubGst = onSnapshot(
      doc(db, "settings", "gst_settings"),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setGstConfig({
            enabled: !!d.enabled,
            percentage: d.gstPercentage || 5,
            pricingType: d.pricingType === "exclusive" ? "exclusive" : "inclusive",
          });
        }
      },
      (err) => console.warn("GST error:", err)
    );

    return () => {
      unsubProducts();
      unsubStores();
      unsubCustomers();
      unsubDrafts();
      unsubGst();
    };
  }, [selectedStoreId]);

  // Current Store
  const currentStore = useMemo(() => {
    return stores.find((s) => s.id === selectedStoreId) || stores[0];
  }, [stores, selectedStoreId]);

  // Current Customer
  const currentCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.categoryName) set.add(p.categoryName);
    });
    return Array.from(set);
  }, [products]);

  // Filtered Catalog
  const filteredCatalog = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== "all" && p.categoryName !== selectedCategory) {
        return false;
      }
      if (productSearch.trim()) {
        const q = productSearch.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesBarcode = p.barcode && p.barcode.toLowerCase().includes(q);
        const matchesShort = p.shortCode && p.shortCode.toLowerCase().includes(q);
        if (!matchesName && !matchesBarcode && !matchesShort) return false;
      }
      return true;
    });
  }, [products, selectedCategory, productSearch]);

  // Calculations
  const rawSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.totalAmount, 0);
  }, [cart]);

  const discountNum = discountAmount === "" ? 0 : Number(discountAmount);
  const effectiveSubtotal = Math.max(0, rawSubtotal - discountNum);

  const financials = useMemo(() => {
    let cgst = 0;
    let sgst = 0;
    let grandTotal = effectiveSubtotal;
    let displaySubtotal = rawSubtotal;
    let displayDiscount = discountNum;
    let taxableSubtotal = effectiveSubtotal;

    if (gstConfig.enabled && gstConfig.percentage > 0) {
      if (gstConfig.pricingType === "inclusive") {
        // INCLUSIVE GST: Prices ALREADY include GST -> Breakdown is required!
        // Grand Total remains the net payable amount (not added additionally)
        grandTotal = effectiveSubtotal;

        // Break down subtotal and discount without GST:
        const baseSubtotal = Number((rawSubtotal / (1 + gstConfig.percentage / 100)).toFixed(2));
        const baseDiscount = discountNum > 0 ? Number((discountNum / (1 + gstConfig.percentage / 100)).toFixed(2)) : 0;
        taxableSubtotal = Number((baseSubtotal - baseDiscount).toFixed(2));

        // Tax component broken down from inclusive price:
        const totalTax = Number((grandTotal - taxableSubtotal).toFixed(2));
        const halfTax = Number((totalTax / 2).toFixed(2));
        cgst = halfTax;
        sgst = Number((totalTax - halfTax).toFixed(2));

        displaySubtotal = baseSubtotal;
        displayDiscount = baseDiscount;
      } else {
        // EXCLUSIVE GST: Prices DO NOT include GST -> Breakdown is NOT required (added on top)!
        taxableSubtotal = effectiveSubtotal;
        const halfRate = gstConfig.percentage / 2;
        cgst = Number(((taxableSubtotal * halfRate) / 100).toFixed(2));
        sgst = Number(((taxableSubtotal * halfRate) / 100).toFixed(2));
        grandTotal = Number((taxableSubtotal + cgst + sgst).toFixed(2));

        displaySubtotal = rawSubtotal;
        displayDiscount = discountNum;
      }
    }

    return {
      rawSubtotal,
      displaySubtotal,
      discount: discountNum,
      displayDiscount,
      taxableSubtotal,
      cgst,
      sgst,
      grandTotal: Math.round(grandTotal),
      exactGrandTotal: grandTotal,
    };
  }, [rawSubtotal, effectiveSubtotal, discountNum, gstConfig]);

  // --- 2. Item Click / Add Logic ---

  // Check if product is weight/litre based
  const isWeightProduct = (unit: string) => {
    const u = unit.toLowerCase().trim();
    return (
      u === "kg" ||
      u.includes("kilo") ||
      u === "litre" ||
      u === "liter" ||
      u === "ltr"
    );
  };

  // Click on catalog item
  const handleCatalogItemClick = (product: ProductCatalogItem) => {
    if (isWeightProduct(product.unit)) {
      // Open weight modal for custom KG/Litre input
      setEditingLineId(null);
      setWeightModalProduct(product);
      setWeightInput(1);
      setAmountInput(product.amount);
      setIsWeightModalOpen(true);
    } else {
      // Piece / Box / Tray item: increment existing or add new
      setCart((prev) => {
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
          const newLine: PosCartLine = {
            lineId: `pos_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            productId: product.id,
            name: product.name,
            unit: product.unit || "piece",
            rate: product.amount,
            quantity: 1,
            totalAmount: product.amount,
            imageUrl: product.imageUrl,
            piecesPerKg: product.piecesPerKg,
            kgPerTray: product.kgPerTray,
          };
          return [...prev, newLine];
        }
      });
    }
  };

  // Barcode scanner auto-submit handler
  const handleBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchBarcode.trim()) return;

    const term = searchBarcode.trim().toLowerCase();
    const matched = products.find(
      (p) =>
        (p.barcode && p.barcode.toLowerCase() === term) ||
        (p.shortCode && p.shortCode.toLowerCase() === term)
    );

    if (matched) {
      handleCatalogItemClick(matched);
      setSearchBarcode("");
    } else {
      showToast(`No product matched barcode "${searchBarcode}"`, "error");
    }
  };

  // Confirm weight modal
  const handleConfirmWeightItem = () => {
    if (!weightModalProduct || Number(weightInput) <= 0) return;

    const qty = Number(weightInput);
    const lineAmt = Number((qty * weightModalProduct.amount).toFixed(2));

    if (editingLineId) {
      // Editing existing line
      setCart((prev) =>
        prev.map((i) =>
          i.lineId === editingLineId
            ? { ...i, quantity: qty, totalAmount: lineAmt }
            : i
        )
      );
    } else {
      // Add as NEW line item (even if same sweet, as requested: "if same weight item added again it shoul add like a new item")
      const newLine: PosCartLine = {
        lineId: `pos_wt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        productId: weightModalProduct.id,
        name: weightModalProduct.name,
        unit: weightModalProduct.unit || "KG",
        rate: weightModalProduct.amount,
        quantity: qty,
        totalAmount: lineAmt,
        imageUrl: weightModalProduct.imageUrl,
        piecesPerKg: weightModalProduct.piecesPerKg,
        kgPerTray: weightModalProduct.kgPerTray,
      };
      setCart((prev) => [...prev, newLine]);
    }

    setIsWeightModalOpen(false);
    setWeightModalProduct(null);
    setEditingLineId(null);
  };

  // Update piece item quantity
  const handleUpdateQuantity = (lineId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveLine(lineId);
      return;
    }
    setCart((prev) =>
      prev.map((i) =>
        i.lineId === lineId
          ? {
              ...i,
              quantity: newQty,
              totalAmount: Number((newQty * i.rate).toFixed(2)),
            }
          : i
      )
    );
  };

  // Open edit for weight item
  const handleOpenEditWeight = (line: PosCartLine) => {
    const prod = products.find((p) => p.id === line.productId) || {
      id: line.productId,
      name: line.name,
      amount: line.rate,
      unit: line.unit,
      imageUrl: line.imageUrl,
    };
    setEditingLineId(line.lineId);
    setWeightModalProduct(prod);
    setWeightInput(line.quantity);
    setAmountInput(line.totalAmount);
    setIsWeightModalOpen(true);
  };

  const handleRemoveLine = (lineId: string) => {
    setCart((prev) => prev.filter((i) => i.lineId !== lineId));
  };

  // Clear entire cart
  const handleClearCart = () => {
    setCart([]);
    setActiveDraftId(null);
    setSelectedCustomerId("");
    setDiscountAmount("");
    setPaymentMode("Cash");
  };

  // Generate numeric bill number: YYMMDDHHMMSS
  const generateNumericBillNumber = () => {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return `${yy}${mm}${dd}${hh}${min}${ss}`;
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

  // --- 3. Draft The Bill ---
  const handleDraftBill = async () => {
    if (cart.length === 0) {
      showToast("Cannot draft an empty bill", "error");
      return;
    }

    try {
      const billNumber = generateNumericBillNumber();
      const draftData = {
        billNumber,
        storeId: selectedStoreId,
        storeName: currentStore?.name || "Main Chirala Store",
        customerId: selectedCustomerId || "",
        customerName: currentCustomer?.name || "Walk-In Customer",
        customerPhone: currentCustomer?.phone || "",
        items: cart,
        discount: financials.discount,
        paymentMethod: paymentMode,
        splitDetails:
          paymentMode === "Split"
            ? {
                cash: Number(splitAmounts.cash) || 0,
                upi: Number(splitAmounts.upi) || 0,
                card: Number(splitAmounts.card) || 0,
              }
            : null,
        totalAmount: financials.grandTotal,
        createdAt: serverTimestamp(),
      };

      const cleanDraftData = sanitizeForFirestore(draftData);

      if (activeDraftId) {
        // Update existing draft
        await setDoc(doc(db, "drafted_bills", activeDraftId), cleanDraftData, { merge: true });
        showToast(`Drafted bill #${billNumber} updated!`, "success");
      } else {
        // Create new draft
        await addDoc(collection(db, "drafted_bills"), cleanDraftData);
        showToast(`Bill #${billNumber} saved to Drafts!`, "success");
      }

      handleClearCart();
    } catch (err: any) {
      showToast("Error drafting bill: " + err.message, "error");
    }
  };

  // Load a drafted bill into active register
  const handleLoadDraft = (draft: DraftedBill) => {
    setActiveDraftId(draft.id);
    setSelectedStoreId(draft.storeId || selectedStoreId);
    setSelectedCustomerId(draft.customerId || "");
    setCart(draft.items || []);
    setDiscountAmount(draft.discount || "");
    setPaymentMode((draft.paymentMethod as PaymentMode) || "Cash");
    setIsDraftsModalOpen(false);
    showToast(`Loaded Draft #${draft.billNumber}`, "info");
  };

  // Delete a drafted bill
  const handleDeleteDraft = async (e: React.MouseEvent, draftId: string) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, "drafted_bills", draftId));
      if (activeDraftId === draftId) {
        setActiveDraftId(null);
      }
      showToast("Drafted bill deleted", "info");
    } catch (err: any) {
      showToast("Error deleting draft: " + err.message, "error");
    }
  };

  // --- 4. Settle The Bill ---
  const handleSettleBill = async () => {
    if (cart.length === 0) {
      showToast("Please add items to cart before settling", "error");
      return;
    }

    if (paymentMode === "Split") {
      const splitSum = Number(splitAmounts.cash || 0) + Number(splitAmounts.upi || 0) + Number(splitAmounts.card || 0);
      if (splitSum !== financials.grandTotal) {
        setIsSplitModalOpen(true);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const billNumber = generateNumericBillNumber();
      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      const saleRecord = {
        billNumber,
        orderNumber: billNumber,
        storeId: selectedStoreId,
        storeName: currentStore?.name || "Main Chirala Store",
        customerId: selectedCustomerId || "",
        customerName: currentCustomer?.name || "Walk-In Customer",
        customerPhone: currentCustomer?.phone || "",
        customerAddress: currentCustomer?.address || "",
        items: cart.map((i) => ({
          id: i.lineId,
          productId: i.productId,
          name: i.name,
          unit: i.unit,
          rate: i.rate,
          quantity: i.quantity,
          totalAmount: i.totalAmount,
          imageUrl: i.imageUrl || "",
          status: "Delivered",
        })),
        subtotal: financials.displaySubtotal,
        discount: financials.displayDiscount,
        taxableSubtotal: financials.taxableSubtotal,
        cgst: financials.cgst,
        sgst: financials.sgst,
        isGstEnabled: gstConfig.enabled,
        gstPercentage: gstConfig.percentage,
        gstType: gstConfig.pricingType,
        grandTotal: financials.grandTotal,
        receivedAmount: financials.grandTotal,
        balanceAmount: 0,
        paymentMethod: paymentMode,
        splitDetails:
          paymentMode === "Split"
            ? {
                cash: Number(splitAmounts.cash) || 0,
                upi: Number(splitAmounts.upi) || 0,
                card: Number(splitAmounts.card) || 0,
              }
            : null,
        paymentHistory: [
          {
            id: `inst_${Date.now()}`,
            amount: financials.grandTotal,
            paymentMethod: paymentMode,
            date: new Date().toISOString(),
            note: "POS Counter Full Payment",
          },
        ],
        paymentStatus: "Done",
        orderStatus: "Delivered",
        deliveryDate: dateStr,
        deliveryTime: timeStr,
        packingDescription: "Walk-In POS Immediate Counter Takeaway",
        createdAt: serverTimestamp(),
      };

      const cleanSaleRecord = sanitizeForFirestore(saleRecord);

      // 1. Save to walk_in_sales collection
      await addDoc(collection(db, "walk_in_sales"), cleanSaleRecord);

      // 2. Also save to orders collection with "Delivered" status so unified reports remain consistent
      await addDoc(collection(db, "orders"), cleanSaleRecord);

      // 3. Deduct stock from store_inventory for each item sold in this store
      for (const item of cart) {
        try {
          const invKey = `${selectedStoreId}_${item.productId}`;
          const invRef = doc(db, "store_inventory", invKey);
          const invSnap = await getDoc(invRef);

          if (invSnap.exists()) {
            const currentQty = invSnap.data().quantity || 0;
            const newQty = Math.max(0, currentQty - item.quantity);

            // Calculate KG
            let newKg = newQty;
            const u = item.unit.toLowerCase();
            if (u === "piece" && Number(item.piecesPerKg) > 0) {
              newKg = Number((newQty / Number(item.piecesPerKg)).toFixed(2));
            } else if (u === "tray" && Number(item.kgPerTray) > 0) {
              newKg = Number((newQty * Number(item.kgPerTray)).toFixed(2));
            }

            await updateDoc(invRef, {
              quantity: newQty,
              calculatedKg: newKg,
              lastUpdated: serverTimestamp(),
              lastNote: `Sold ${item.quantity} ${item.unit} via POS Bill #${billNumber}`,
            });
          }
        } catch (stockErr) {
          console.warn(`Failed to deduct stock for ${item.name}:`, stockErr);
        }
      }

      // 4. If settled from a draft, delete the draft
      if (activeDraftId) {
        await deleteDoc(doc(db, "drafted_bills", activeDraftId));
      }

      showToast(`Bill #${billNumber} settled successfully!`, "success");

      // 5. Trigger thermal receipt print with masked customer phone number
      await printReceipt({
        orderNumber: billNumber,
        dateStr,
        timeStr,
        storeName: currentStore?.name || "Ravi Sweets - Chirala Main Store",
        storePhone: currentStore?.phone || "+91 98480 12345",
        storeAddress: currentStore?.address || "Station Road, Chirala, AP",
        customerName: currentCustomer?.name || "Walk-In Customer",
        customerPhone: currentCustomer?.phone || "",
        items: cart.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          rate: i.rate,
          totalAmount: i.totalAmount,
        })),
        subtotal: financials.displaySubtotal,
        discount: financials.displayDiscount,
        taxableSubtotal: financials.taxableSubtotal,
        cgst: financials.cgst,
        sgst: financials.sgst,
        grandTotal: financials.grandTotal,
        paymentMethod: paymentMode,
        splitDetails:
          paymentMode === "Split"
            ? {
                cash: Number(splitAmounts.cash) || 0,
                upi: Number(splitAmounts.upi) || 0,
                card: Number(splitAmounts.card) || 0,
              }
            : undefined,
      });

      // Reset cart
      handleClearCart();
    } catch (err: any) {
      console.error("Settle bill error:", err);
      showToast("Error settling bill: " + err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 5. Quick Add Customer ---
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerForm.name.trim() || !customerForm.phone.trim()) {
      showToast("Customer Name and Phone Number are required", "error");
      return;
    }

    try {
      const docRef = await addDoc(collection(db, "customers"), {
        name: customerForm.name.trim(),
        phone: customerForm.phone.trim(),
        city: customerForm.city.trim(),
        email: customerForm.email.trim(),
        address: customerForm.address.trim(),
        createdAt: serverTimestamp(),
      });

      setSelectedCustomerId(docRef.id);
      setIsAddCustomerOpen(false);
      setCustomerForm({ name: "", phone: "", city: "", email: "", address: "" });
      showToast(`Customer "${customerForm.name}" created and selected!`, "success");
    } catch (err: any) {
      showToast("Error adding customer: " + err.message, "error");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-49px)] w-full overflow-hidden bg-slate-50/50">
      {/* 1. Header Toolbar */}
      <div
        className="px-6 py-2.5 border-b bg-white flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-2xs"
        style={{ borderColor: "var(--color-border-subtle)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center border bg-blue-50/80 text-[#348bdd] shadow-2xs"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            <Receipt size={20} className="stroke-[1.8]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-slate-900 tracking-tight">
                POS Billing
              </h1>
              <span className="px-2 py-0.5 text-[10px] rounded bg-blue-50 text-[#348bdd] font-mono font-medium border border-blue-200 uppercase">
                COUNTER REGISTER
              </span>
              {activeDraftId && (
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-mono flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Editing Draft
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              High-speed retail counter billing, barcode scanner, thermal printing, and live stock deduction
            </p>
          </div>
        </div>

        {/* Store Selector, Drafts Button, Printer Status */}
        <div className="flex items-center gap-2.5 text-xs">
          {/* Store Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1">
            <Store size={13} className="text-[#348bdd] ml-1" />
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-[#348bdd] cursor-pointer shadow-2xs"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Drafted Bills Pill / Button */}
          <button
            onClick={() => setIsDraftsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors shadow-2xs cursor-pointer"
          >
            <FolderOpen size={14} className="text-amber-500" />
            <span>Drafted Bills</span>
            <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-mono text-[10px] font-medium">
              {draftedBills.length}
            </span>
          </button>

          {/* Printer Config Shortcut */}
          <button
            onClick={() => setIsConnectModalOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors shadow-2xs cursor-pointer ${
              settings.isConnected
                ? "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Printer size={13} className={settings.isConnected ? "text-emerald-600" : "text-slate-400"} />
            <span>{settings.isConnected ? `${settings.paperSize === "3inch" ? "80mm" : "58mm"} Ready` : "Setup Printer"}</span>
          </button>
        </div>
      </div>

      {/* 2. Main Two-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Barcode Scanner & Product Catalog */}
        <div className="flex-1 flex flex-col border-r border-slate-200 overflow-hidden bg-slate-50/30">
          {/* Barcode & Search Controls */}
          <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            {/* Barcode Scanner Input */}
            <form onSubmit={handleBarcodeScan} className="flex-1 min-w-[260px]">
              <div className="relative flex items-center">
                <Barcode size={16} className="absolute left-3 text-slate-400 pointer-events-none" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="Scan sweet barcode or enter short code..."
                  value={searchBarcode}
                  onChange={(e) => setSearchBarcode(e.target.value)}
                  className="w-full pl-9 pr-20 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd] font-mono"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 px-2.5 py-1 rounded-lg bg-[#348bdd] hover:bg-[#2b7bc4] text-white text-[11px] font-medium transition-colors cursor-pointer"
                >
                  Lookup
                </button>
              </div>
            </form>

            {/* Product Name Search Input */}
            <div className="relative w-56 flex items-center">
              <Search size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search sweet name..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto shrink-0">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                selectedCategory === "all"
                  ? "bg-[#348bdd] text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              All Sweets ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                  selectedCategory === cat
                    ? "bg-[#348bdd] text-white shadow-2xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Product Cards Grid */}
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 content-start">
            {isLoading ? (
              <div className="col-span-full h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 size={24} className="animate-spin text-[#348bdd]" />
                <span className="text-xs font-mono">Loading counter sweets...</span>
              </div>
            ) : filteredCatalog.length === 0 ? (
              <div className="col-span-full h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Boxes size={32} className="text-slate-300 stroke-[1.5]" />
                <span className="text-sm font-medium text-slate-700">No sweets found</span>
                <span className="text-xs text-slate-400">Try adjusting your search or category filter.</span>
              </div>
            ) : (
              filteredCatalog.map((prod) => {
                const inCart = cart.filter((i) => i.productId === prod.id);
                const totalInCart = inCart.reduce((acc, i) => acc + i.quantity, 0);

                return (
                  <div
                    key={prod.id}
                    onClick={() => handleCatalogItemClick(prod)}
                    className={`rounded-xl border p-2.5 flex flex-col transition-all cursor-pointer select-none group relative bg-white hover:border-[#348bdd] hover:shadow-md ${
                      totalInCart > 0
                        ? "border-[#348bdd] ring-1 ring-[#348bdd] bg-blue-50/15"
                        : "border-slate-200 shadow-2xs"
                    }`}
                  >
                    {totalInCart > 0 && (
                      <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 rounded-full bg-[#348bdd] text-white text-[9px] font-mono font-bold shadow-xs">
                        {totalInCart} in bill
                      </div>
                    )}

                    {/* Image */}
                    <div className="w-full aspect-square rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden mb-2 group-hover:scale-[1.02] transition-transform">
                      {prod.imageUrl ? (
                        <img
                          src={prod.imageUrl}
                          alt={prod.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Boxes size={24} className="text-slate-300" />
                      )}
                    </div>

                    {/* Sweet Details */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div className="font-semibold text-slate-900 text-xs line-clamp-1 leading-tight group-hover:text-[#348bdd]">
                        {prod.name}
                      </div>

                      <div className="mt-1 flex items-baseline justify-between pt-1 border-t border-slate-100">
                        <span className="text-xs font-bold text-slate-900 font-mono">
                          ₹{prod.amount}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          /{prod.unit}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Cart Register & Tender Settlement */}
        <div className="w-96 lg:w-[420px] bg-white flex flex-col shrink-0 shadow-lg border-l border-slate-200">
          {/* Customer Selection Banner (Optional) */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
            <div className="flex-1 flex items-center gap-2">
              <User size={15} className="text-slate-500 shrink-0" />
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-[#348bdd] cursor-pointer"
              >
                <option value="">Walk-In Customer (Default)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setIsAddCustomerOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium flex items-center gap-1 cursor-pointer shadow-2xs shrink-0"
              title="Add New Customer"
            >
              <Plus size={12} />
              <span>New</span>
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-3 divide-y divide-slate-100">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 p-6">
                <ShoppingCart size={32} className="text-slate-300 stroke-[1.5]" />
                <span className="text-xs font-medium text-slate-700">Counter Register Empty</span>
                <span className="text-[11px] text-slate-400 text-center">
                  Scan sweet barcode or click items from left catalog to add
                </span>
              </div>
            ) : (
              cart.map((line) => {
                const isWeight = isWeightProduct(line.unit);

                return (
                  <div key={line.lineId} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                    {/* Item Name & Rate */}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs text-slate-900 truncate">
                        {line.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        ₹{line.rate} / {line.unit}
                      </div>
                    </div>

                    {/* Quantity Adjustment Controls */}
                    <div className="flex items-center gap-2">
                      {isWeight ? (
                        <button
                          onClick={() => handleOpenEditWeight(line)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded border border-slate-200 bg-slate-50 hover:bg-blue-50 text-xs font-mono font-medium text-slate-800 cursor-pointer shadow-2xs"
                          title="Click to edit weight or amount"
                        >
                          <span>{line.quantity} {line.unit}</span>
                          <Edit2 size={11} className="text-slate-400" />
                        </button>
                      ) : (
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50 shadow-2xs">
                          <button
                            onClick={() => handleUpdateQuantity(line.lineId, line.quantity - 1)}
                            className="p-1 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                          >
                            <Minus size={11} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(e) => handleUpdateQuantity(line.lineId, Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-9 text-center text-xs font-mono font-semibold bg-white border-x border-slate-200 focus:outline-none"
                          />
                          <button
                            onClick={() => handleUpdateQuantity(line.lineId, line.quantity + 1)}
                            className="p-1 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                      )}

                      {/* Total Line Amount */}
                      <div className="w-16 text-right font-mono font-bold text-xs text-slate-900">
                        ₹{line.totalAmount.toFixed(2)}
                      </div>

                      {/* Remove Line */}
                      <button
                        onClick={() => handleRemoveLine(line.lineId)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Cart Financial Summary & Payment */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/80 space-y-3 shrink-0">
            {/* Summary Breakdown: Subtotal -> Discount (if any) -> CGST -> SGST -> Grand Total */}
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono font-medium text-slate-800">
                  ₹{financials.displaySubtotal.toFixed(2)}
                </span>
              </div>

              {/* Discount Input */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-600">Discount (₹):</span>
                <input
                  type="number"
                  min="0"
                  placeholder="0.00"
                  value={discountAmount}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  className="w-24 px-2 py-0.5 text-right border border-slate-200 rounded text-xs font-mono bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                />
              </div>

              {financials.discount > 0 && (
                <div className="flex items-center justify-between text-emerald-600 text-[11px]">
                  <span>Discount Applied:</span>
                  <span className="font-mono font-medium">
                    -₹{financials.displayDiscount.toFixed(2)}
                  </span>
                </div>
              )}

              {/* GST Breakdown (if enabled) */}
              {gstConfig.enabled && (financials.cgst > 0 || financials.sgst > 0) && (
                <div className="pt-1.5 border-t border-slate-200/60 text-[11px] font-mono text-slate-600 space-y-1">
                  <div className="flex justify-between">
                    <span>CGST ({gstConfig.percentage / 2}%):</span>
                    <span className="font-medium text-slate-800">₹{financials.cgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SGST ({gstConfig.percentage / 2}%):</span>
                    <span className="font-medium text-slate-800">₹{financials.sgst.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Grand Total */}
              <div className="pt-2 border-t border-slate-200 flex items-baseline justify-between text-slate-900">
                <span className="font-medium text-xs text-slate-700">Grand Total:</span>
                <span
                  className="font-mono font-medium text-xl"
                  style={{ color: "var(--color-brand-primary)" }}
                >
                  ₹{financials.grandTotal}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <div className="text-[10px] font-mono font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                Payment Method
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(["Cash", "UPI", "Card", "Split"] as PaymentMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setPaymentMode(mode);
                      if (mode === "Split") {
                        setIsSplitModalOpen(true);
                      }
                    }}
                    className={`py-1.5 rounded-md border text-xs font-medium transition-colors cursor-pointer flex flex-col items-center gap-1 ${
                      paymentMode === mode
                        ? "border-[#348bdd] bg-blue-50/70 text-[#348bdd] shadow-2xs"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {mode === "Cash" && <Banknote size={14} />}
                    {mode === "UPI" && <Smartphone size={14} />}
                    {mode === "Card" && <CreditCard size={14} />}
                    {mode === "Split" && <Split size={14} />}
                    <span>{mode}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons: Draft & Settle */}
            <div className="grid grid-cols-5 gap-2 pt-2 border-t border-slate-200/80">
              <button
                type="button"
                onClick={handleDraftBill}
                disabled={cart.length === 0}
                className="col-span-2 py-2.5 px-3 rounded-md border bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
                style={{
                  borderColor: "var(--color-border-base)",
                  color: "var(--color-text-secondary)",
                }}
              >
                <FolderOpen size={14} className="text-amber-500" />
                <span>Draft Bill</span>
              </button>

              <button
                type="button"
                onClick={handleSettleBill}
                disabled={isSubmitting || cart.length === 0}
                className="col-span-3 py-2.5 px-3 rounded-md text-white transition-all hover:brightness-105 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs cursor-pointer shadow-xs flex items-center justify-center gap-2"
                style={{ backgroundColor: "var(--color-brand-primary)" }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Settling...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Settle Bill</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Weight / Litre Modal */}
      {isWeightModalOpen && weightModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
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
                onClick={() => setIsWeightModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Weight Presets */}
            <div>
              <div className="text-[10px] font-mono text-slate-400 uppercase mb-1.5">
                Quick Weight Presets
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
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
              />
            </div>

            {/* Amount Input (Auto-calculated or reverse updates weight) */}
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
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
              />
            </div>

            {/* Confirm Button */}
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
                className="px-4 py-1.5 rounded-lg bg-[#348bdd] hover:bg-[#2b7bc4] text-white text-xs font-semibold cursor-pointer shadow-2xs"
              >
                {editingLineId ? "Update Weight" : "Add to Bill"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Split Tender Modal */}
      {isSplitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-slate-200 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">
                  Split Payment Breakdown
                </h3>
                <span className="text-[11px] font-mono text-slate-500">
                  Total Due: ₹{financials.grandTotal}
                </span>
              </div>
              <button
                onClick={() => setIsSplitModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-mono text-slate-600 mb-1">
                  Cash Amount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={splitAmounts.cash || ""}
                  onChange={(e) =>
                    setSplitAmounts((prev) => ({ ...prev, cash: Number(e.target.value) || 0 }))
                  }
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-600 mb-1">
                  UPI / QR Amount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={splitAmounts.upi || ""}
                  onChange={(e) =>
                    setSplitAmounts((prev) => ({ ...prev, upi: Number(e.target.value) || 0 }))
                  }
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-600 mb-1">
                  Card / POS Machine Amount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={splitAmounts.card || ""}
                  onChange={(e) =>
                    setSplitAmounts((prev) => ({ ...prev, card: Number(e.target.value) || 0 }))
                  }
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono"
                />
              </div>

              {/* Balance Helper */}
              {(() => {
                const totalEntered =
                  Number(splitAmounts.cash || 0) +
                  Number(splitAmounts.upi || 0) +
                  Number(splitAmounts.card || 0);
                const remaining = financials.grandTotal - totalEntered;

                return (
                  <div
                    className={`p-2.5 rounded-lg border font-mono text-xs flex justify-between ${
                      remaining === 0
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-amber-50 border-amber-200 text-amber-800"
                    }`}
                  >
                    <span>{remaining === 0 ? "Exact Match" : "Balance Due:"}</span>
                    <span className="font-bold">₹{remaining}</span>
                  </div>
                );
              })()}
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsSplitModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-[#348bdd] hover:bg-[#2b7bc4] text-white text-xs font-medium cursor-pointer shadow-2xs"
              >
                Confirm Split
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Drafted Bills Drawer / Modal */}
      {isDraftsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-2xs">
                  <FolderOpen size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
                    Drafted Bills
                  </h2>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Select a drafted bill to resume and settle, or delete
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDraftsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 max-h-96 overflow-y-auto divide-y divide-slate-100">
              {draftedBills.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-slate-400 gap-1.5">
                  <FolderOpen size={28} className="text-slate-300 stroke-[1.5]" />
                  <span className="text-xs font-medium text-slate-700">No Drafted Bills</span>
                  <span className="text-[11px] text-slate-400">
                    Use "Draft Bill" on counter bills to save them here for later.
                  </span>
                </div>
              ) : (
                draftedBills.map((draft) => (
                  <div
                    key={draft.id}
                    onClick={() => handleLoadDraft(draft)}
                    className="py-3 px-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-xs text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                          #{draft.billNumber}
                        </span>
                        <span className="text-xs font-medium text-slate-800">
                          {draft.customerName || "Walk-In"}
                        </span>
                        {draft.customerPhone && (
                          <span className="text-[11px] font-mono text-slate-400">
                            • {draft.customerPhone}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-1">
                        {draft.items?.length || 0} items • {draft.storeName}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right font-mono font-medium text-sm text-[#348bdd]">
                        ₹{draft.totalAmount}
                      </div>

                      <button
                        onClick={(e) => handleDeleteDraft(e, draft.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete this draft"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. Add Customer Quick Modal */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
                Quick Add Customer
              </h2>
              <button
                onClick={() => setIsAddCustomerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-mono font-medium text-slate-700 uppercase mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Siva Krishna"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  required
                  autoFocus
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono font-medium text-slate-700 uppercase mb-1">
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-mono font-medium text-slate-700 uppercase mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chirala"
                    value={customerForm.city}
                    onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono font-medium text-slate-700 uppercase mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="Optional"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-medium text-slate-700 uppercase mb-1">
                  Address
                </label>
                <textarea
                  rows={2}
                  placeholder="Street address..."
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#348bdd] hover:bg-[#2b7bc4] text-white text-xs font-medium cursor-pointer shadow-2xs"
                >
                  Save & Select
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
