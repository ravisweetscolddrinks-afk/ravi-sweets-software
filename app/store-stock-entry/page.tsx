"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import {
  ArrowDownToLine,
  Store,
  Search,
  Filter,
  Plus,
  Boxes,
  Loader2,
  AlertTriangle,
  RotateCw,
  Scale,
  Sparkles,
  TrendingDown,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  Info,
  X,
  Pencil,
} from "lucide-react";

interface StoreOption {
  id: string;
  name: string;
  phone?: string;
  address?: string;
}

interface ProductItem {
  id: string;
  name: string;
  unit: string; // "piece" | "KG" | "litre" | "Tray" | string
  amount: number;
  imageUrl?: string;
  categoryName?: string;
  barcode?: string;
  shortCode?: string;
  piecesPerKg?: number | string;
  kgPerTray?: number | string;
}

interface InventoryRecord {
  id: string; // `${storeId}_${productId}`
  storeId: string;
  productId: string;
  productName: string;
  quantity: number; // in product's native unit
  calculatedKg: number;
  unit: string;
  lastUpdated?: any;
  lastNote?: string;
}

export default function StoreStockEntryPage() {
  const { showToast } = useToast();

  // Reference data
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [inventoryMap, setInventoryMap] = useState<Map<string, InventoryRecord>>(new Map());
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [stockStatusFilter, setStockStatusFilter] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");

  // Adjustment Modal State
  const [adjustingProduct, setAdjustingProduct] = useState<ProductItem | null>(null);
  const [adjustType, setAdjustType] = useState<"inward" | "set" | "spoilage">("inward");
  const [adjustQuantity, setAdjustQuantity] = useState<number | string>("");
  const [adjustNote, setAdjustNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Direct Inline Stock Entry State per product row
  const [rowInputs, setRowInputs] = useState<
    Record<string, { quantity: string; unit: string; mode: "inward" | "set" }>
  >({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isSavingAll, setIsSavingAll] = useState<boolean>(false);

  // 1. Subscribe to Stores, Products, and Inventory in Real-Time
  useEffect(() => {
    setIsLoading(true);

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
      (err) => console.warn("Stores listener error:", err)
    );

    // Products
    const unsubProducts = onSnapshot(
      query(collection(db, "products"), orderBy("name", "asc")),
      (snap) => {
        const pList: ProductItem[] = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || "",
          unit: d.data().unit || "piece",
          amount: Number(d.data().amount) || 0,
          imageUrl: d.data().imageUrl || "",
          categoryName: d.data().categoryName || "General",
          barcode: d.data().barcode || "",
          shortCode: d.data().shortCode || "",
          piecesPerKg: d.data().piecesPerKg || "",
          kgPerTray: d.data().kgPerTray || "",
        }));
        setProducts(pList);
        setIsLoading(false);
      },
      (err) => {
        console.error("Products listener error:", err);
        setIsLoading(false);
      }
    );

    // Store Inventory (live)
    const unsubInventory = onSnapshot(
      collection(db, "store_inventory"),
      (snap) => {
        const map = new Map<string, InventoryRecord>();
        snap.docs.forEach((d) => {
          map.set(d.id, {
            id: d.id,
            ...(d.data() as Omit<InventoryRecord, "id">),
          });
        });
        setInventoryMap(map);
      },
      (err) => console.warn("Inventory listener error:", err)
    );

    return () => {
      unsubStores();
      unsubProducts();
      unsubInventory();
    };
  }, [selectedStoreId]);

  // Selected Store Object
  const currentStore = useMemo(() => {
    return stores.find((s) => s.id === selectedStoreId) || stores[0];
  }, [stores, selectedStoreId]);

  // Helper: Calculate KG from unit quantity
  const calculateKg = useCallback(
    (product: ProductItem, qty: number): number => {
      if (qty <= 0) return 0;
      const u = product.unit.toLowerCase().trim();

      if (u === "kg" || u.includes("kilo") || u === "litre" || u === "liter" || u === "ltr") {
        return qty;
      }
      if (u === "tray" || u.includes("tray")) {
        const kpt = Number(product.kgPerTray) || 2.5; // default 2.5 KG per sweet tray if unconfigured
        return Number((qty * kpt).toFixed(2));
      }
      // Piece: use piecesPerKg
      const ppk = Number(product.piecesPerKg) || 0;
      if (ppk > 0) {
        return Number((qty / ppk).toFixed(2));
      }
      return 0;
    },
    []
  );

  // Available Categories for Filter Tab
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.categoryName) set.add(p.categoryName);
    });
    return Array.from(set);
  }, [products]);

  // Filtered Product Rows with calculated store stock
  const stockRows = useMemo(() => {
    if (!selectedStoreId) return [];

    return products
      .filter((p) => {
        // Category filter
        if (categoryFilter !== "all" && p.categoryName !== categoryFilter) {
          return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesName = p.name.toLowerCase().includes(q);
          const matchesBarcode = p.barcode && p.barcode.toLowerCase().includes(q);
          const matchesShortCode = p.shortCode && p.shortCode.toLowerCase().includes(q);
          if (!matchesName && !matchesBarcode && !matchesShortCode) {
            return false;
          }
        }

        // Stock status filter
        const invKey = `${selectedStoreId}_${p.id}`;
        const inv = inventoryMap.get(invKey);
        const currentQty = inv?.quantity || 0;
        const currentKg = inv?.calculatedKg || calculateKg(p, currentQty);

        if (stockStatusFilter === "in_stock" && currentQty <= 0) return false;
        if (stockStatusFilter === "low_stock" && (currentKg <= 0 || currentKg > 5)) return false;
        if (stockStatusFilter === "out_of_stock" && currentQty > 0) return false;

        return true;
      })
      .map((p) => {
        const invKey = `${selectedStoreId}_${p.id}`;
        const inv = inventoryMap.get(invKey);
        const currentQty = inv?.quantity || 0;
        const calculatedKg = inv?.calculatedKg ?? calculateKg(p, currentQty);

        return {
          product: p,
          currentQty,
          calculatedKg: Number(calculatedKg.toFixed(2)),
          lastUpdated: inv?.lastUpdated,
          lastNote: inv?.lastNote,
        };
      });
  }, [
    products,
    selectedStoreId,
    inventoryMap,
    categoryFilter,
    searchQuery,
    stockStatusFilter,
    calculateKg,
  ]);

  // Overall Store Inventory Summary Metrics
  const summaryMetrics = useMemo(() => {
    let totalStockKg = 0;
    let totalStockPcs = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    products.forEach((p) => {
      const invKey = `${selectedStoreId}_${p.id}`;
      const inv = inventoryMap.get(invKey);
      const qty = inv?.quantity || 0;
      const kg = inv?.calculatedKg ?? calculateKg(p, qty);

      totalStockKg += kg;
      if (p.unit.toLowerCase() === "piece") totalStockPcs += qty;
      if (qty <= 0) outOfStockCount += 1;
      else if (kg < 5) lowStockCount += 1;
    });

    return {
      totalStockKg: Number(totalStockKg.toFixed(2)),
      totalStockPcs,
      lowStockCount,
      outOfStockCount,
    };
  }, [products, selectedStoreId, inventoryMap, calculateKg]);

  // Helper: Retrieve row input with fallback defaults
  const getRowInput = useCallback(
    (product: ProductItem) => {
      const existing = rowInputs[product.id];
      if (existing) return existing;
      const defaultUnit = product.unit.toLowerCase() === "piece" ? "piece" : product.unit || "KG";
      return {
        quantity: "",
        unit: defaultUnit,
        mode: "inward" as "inward" | "set",
      };
    },
    [rowInputs]
  );

  const handleRowInputChange = useCallback(
    (productId: string, field: "quantity" | "unit" | "mode", value: string, defaultUnit: string) => {
      setRowInputs((prev) => {
        const current = prev[productId] || { quantity: "", unit: defaultUnit, mode: "inward" };
        return {
          ...prev,
          [productId]: {
            ...current,
            [field]: value,
          },
        };
      });
    },
    []
  );

  // Helper: Convert any input quantity + unit into equivalent KG
  const convertInputToKg = useCallback(
    (product: ProductItem, qty: number, unit: string): number => {
      if (qty <= 0 || isNaN(qty)) return 0;
      const u = unit.toLowerCase().trim();

      if (u === "kg" || u.includes("kilo") || u === "litre" || u === "liter" || u === "ltr") {
        return qty;
      }
      if (u === "tray" || u.includes("tray")) {
        const kpt = Number(product.kgPerTray) || 2.5; // default 2.5 KG per tray
        return Number((qty * kpt).toFixed(2));
      }
      if (u === "piece" || u === "pieces" || u === "pcs") {
        const ppk = Number(product.piecesPerKg) || 20; // default 20 pcs per KG
        return Number((qty / ppk).toFixed(2));
      }
      return qty;
    },
    []
  );

  // Helper: Convert from input unit quantity to product's native unit quantity
  const convertToNativeUnit = useCallback(
    (product: ProductItem, qty: number, unit: string): number => {
      const nativeU = product.unit.toLowerCase().trim();
      const inputU = unit.toLowerCase().trim();

      if (nativeU === inputU) return qty;

      const kg = convertInputToKg(product, qty, unit);

      if (nativeU === "kg" || nativeU.includes("kilo") || nativeU === "litre" || nativeU === "liter" || nativeU === "ltr") {
        return kg;
      }
      if (nativeU === "tray" || nativeU.includes("tray")) {
        const kpt = Number(product.kgPerTray) || 2.5;
        return Number((kg / kpt).toFixed(2));
      }
      if (nativeU === "piece" || nativeU === "pieces" || nativeU === "pcs") {
        const ppk = Number(product.piecesPerKg) || 20;
        return Math.round(kg * ppk);
      }
      return kg;
    },
    [convertInputToKg]
  );

  // Direct Row Save Handler
  const handleSaveRowStock = async (product: ProductItem) => {
    if (!selectedStoreId) {
      showToast("Please select a store first", "error");
      return;
    }
    const input = getRowInput(product);
    const numQty = Number(input.quantity);
    if (isNaN(numQty) || numQty <= 0) {
      showToast(`Please enter a valid quantity for ${product.name}`, "error");
      return;
    }

    setSavingId(product.id);
    try {
      const invDocId = `${selectedStoreId}_${product.id}`;
      const existingInv = inventoryMap.get(invDocId);
      const currentNativeQty = existingInv?.quantity || 0;

      const incomingNativeQty = convertToNativeUnit(product, numQty, input.unit);
      const incomingKg = convertInputToKg(product, numQty, input.unit);

      let newNativeQty = 0;
      if (input.mode === "inward") {
        newNativeQty = currentNativeQty + incomingNativeQty;
      } else {
        newNativeQty = incomingNativeQty;
      }

      const newCalculatedKg = calculateKg(product, newNativeQty);

      await setDoc(
        doc(db, "store_inventory", invDocId),
        {
          storeId: selectedStoreId,
          storeName: currentStore?.name || "Store",
          productId: product.id,
          productName: product.name,
          quantity: newNativeQty,
          calculatedKg: newCalculatedKg,
          unit: product.unit,
          lastUpdated: serverTimestamp(),
          lastNote: `${input.mode === "inward" ? "+ Inward" : "Count Set"}: ${numQty} ${input.unit} (~${incomingKg} KG)`,
        },
        { merge: true }
      );

      // Reset the row's quantity input
      setRowInputs((prev) => ({
        ...prev,
        [product.id]: {
          ...input,
          quantity: "",
        },
      }));

      showToast(
        `✓ ${product.name}: Added ${numQty} ${input.unit} (~${incomingKg} KG). Stock now: ${newNativeQty} ${product.unit} (${newCalculatedKg} KG)`,
        "success"
      );
    } catch (err: any) {
      console.error("Save stock error:", err);
      showToast("Error updating stock: " + err.message, "error");
    } finally {
      setSavingId(null);
    }
  };

  // Bulk Save All Entered Stock
  const enteredItemsCount = useMemo(() => {
    return Object.values(rowInputs).filter((r) => Number(r.quantity) > 0).length;
  }, [rowInputs]);

  const handleSaveAllEnteredStock = async () => {
    if (!selectedStoreId) return;
    setIsSavingAll(true);
    try {
      let savedCount = 0;
      for (const product of products) {
        const input = rowInputs[product.id];
        const numQty = Number(input?.quantity);
        if (numQty > 0) {
          const invDocId = `${selectedStoreId}_${product.id}`;
          const existingInv = inventoryMap.get(invDocId);
          const currentNativeQty = existingInv?.quantity || 0;

          const incomingNativeQty = convertToNativeUnit(product, numQty, input.unit);
          const incomingKg = convertInputToKg(product, numQty, input.unit);

          let newNativeQty = 0;
          if (input.mode === "inward") {
            newNativeQty = currentNativeQty + incomingNativeQty;
          } else {
            newNativeQty = incomingNativeQty;
          }

          const newCalculatedKg = calculateKg(product, newNativeQty);

          await setDoc(
            doc(db, "store_inventory", invDocId),
            {
              storeId: selectedStoreId,
              storeName: currentStore?.name || "Store",
              productId: product.id,
              productName: product.name,
              quantity: newNativeQty,
              calculatedKg: newCalculatedKg,
              unit: product.unit,
              lastUpdated: serverTimestamp(),
              lastNote: `Bulk ${input.mode === "inward" ? "+ Inward" : "Count Set"}: ${numQty} ${input.unit} (~${incomingKg} KG)`,
            },
            { merge: true }
          );
          savedCount++;
        }
      }
      setRowInputs({});
      showToast(`✓ Saved stock entries for ${savedCount} products!`, "success");
    } catch (err: any) {
      console.error("Bulk save error:", err);
      showToast("Error saving stock entries: " + err.message, "error");
    } finally {
      setIsSavingAll(false);
    }
  };

  // Open adjustment modal
  const handleOpenAdjustment = (product: ProductItem, defaultType: "inward" | "set" = "inward") => {
    setAdjustingProduct(product);
    setAdjustType(defaultType);
    setAdjustQuantity("");
    setAdjustNote(defaultType === "inward" ? "Kitchen Sweet Inward Transfer" : "Store Counter Count Adjustment");
  };

  // Submit Stock Inward / Adjustment to Firestore
  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct || !selectedStoreId) return;

    const numQty = Number(adjustQuantity);
    if (isNaN(numQty) || numQty < 0) {
      showToast("Please enter a valid quantity", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const invDocId = `${selectedStoreId}_${adjustingProduct.id}`;
      const existingInv = inventoryMap.get(invDocId);
      const currentQty = existingInv?.quantity || 0;

      let newQty = 0;
      if (adjustType === "inward") {
        newQty = currentQty + numQty;
      } else if (adjustType === "spoilage") {
        newQty = Math.max(0, currentQty - numQty);
      } else {
        // "set" (exact count)
        newQty = numQty;
      }

      const newCalculatedKg = calculateKg(adjustingProduct, newQty);

      await setDoc(
        doc(db, "store_inventory", invDocId),
        {
          storeId: selectedStoreId,
          storeName: currentStore?.name || "Store",
          productId: adjustingProduct.id,
          productName: adjustingProduct.name,
          quantity: newQty,
          calculatedKg: newCalculatedKg,
          unit: adjustingProduct.unit,
          lastUpdated: serverTimestamp(),
          lastNote: adjustNote.trim() || `${adjustType} of ${numQty} ${adjustingProduct.unit}`,
        },
        { merge: true }
      );

      showToast(
        `Updated stock for "${adjustingProduct.name}": now ${newQty} ${adjustingProduct.unit} (~${newCalculatedKg} KG)`,
        "success"
      );
      setAdjustingProduct(null);
    } catch (err: any) {
      console.error("Save stock error:", err);
      showToast("Error updating stock: " + err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-49px)] w-full overflow-hidden bg-slate-50/50">
      {/* 1. Header & Live Store Selector Bar */}
      <div
        className="px-6 py-3 border-b bg-white flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xs"
        style={{ borderColor: "var(--color-border-subtle)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center border bg-blue-50/80 text-[#348bdd] shadow-2xs"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            <ArrowDownToLine size={22} className="stroke-[1.8]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1
                className="text-base tracking-tight text-slate-900"
                style={{ fontWeight: 500 }}
              >
                Store Stock Entry
              </h1>
              <span className="px-2 py-0.5 text-[10px] rounded bg-blue-50 text-[#348bdd] font-mono font-medium border border-blue-200 uppercase tracking-wide">
                RETAIL OUTLET INVENTORY
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Store-wise available stock: piece/tray/litre to KG conversion, inward receipts, and live POS deductions
            </p>
          </div>
        </div>

        {/* Store Selector & Metrics */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Outlet Selector Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1">
            <span className="text-[11px] font-medium text-slate-500 px-1 flex items-center gap-1">
              <Store size={13} className="text-[#348bdd]" />
              Store:
            </span>
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="bg-white border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-[#348bdd] cursor-pointer shadow-2xs"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Metric Pills */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-blue-50/50 border-blue-200 text-blue-900 shadow-2xs">
            <Scale size={14} className="text-[#348bdd]" />
            <div className="flex flex-col">
              <span className="text-[9px] text-blue-600 uppercase font-mono">Total Store Stock</span>
              <span className="font-semibold text-xs font-mono">
                {summaryMetrics.totalStockKg} KG
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-amber-50/60 border-amber-200 text-amber-800 shadow-2xs">
            <AlertTriangle size={14} className="text-amber-600" />
            <div className="flex flex-col">
              <span className="text-[9px] text-amber-600 uppercase font-mono">Low Stock (&lt;5 KG)</span>
              <span className="font-semibold text-xs font-mono">
                {summaryMetrics.lowStockCount} items
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Controls Toolbar: Category Tabs, Stock Status, Search Bar */}
      <div
        className="px-6 py-2.5 border-b bg-white flex flex-wrap items-center justify-between gap-3 shrink-0"
        style={{ borderColor: "var(--color-border-subtle)" }}
      >
        {/* Left: Category Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-xl pb-0.5">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer shrink-0 ${
              categoryFilter === "all"
                ? "bg-[#348bdd] text-white shadow-2xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            All Categories ({products.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer shrink-0 ${
                categoryFilter === cat
                  ? "bg-[#348bdd] text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Right: Stock Status & Search */}
        <div className="flex items-center gap-2.5 text-xs">
          {enteredItemsCount > 0 && (
            <button
              type="button"
              disabled={isSavingAll}
              onClick={handleSaveAllEnteredStock}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#348bdd] hover:bg-[#277ecf] text-white text-xs font-medium transition-colors shadow-2xs cursor-pointer shrink-0 disabled:opacity-50"
            >
              {isSavingAll ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={13} />
                  <span>Save All ({enteredItemsCount})</span>
                </>
              )}
            </button>
          )}

          <select
            value={stockStatusFilter}
            onChange={(e) => setStockStatusFilter(e.target.value as any)}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#348bdd] cursor-pointer shadow-2xs"
          >
            <option value="all">All Stock Statuses</option>
            <option value="in_stock">In Stock (&gt; 0)</option>
            <option value="low_stock">Low Stock (&lt; 5 KG)</option>
            <option value="out_of_stock">Out of Stock (0)</option>
          </select>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white shadow-2xs w-56 focus-within:ring-1 focus-within:ring-[#348bdd]">
            <Search size={13} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search product, barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-transparent focus:outline-none text-slate-800"
            />
          </div>
        </div>
      </div>

      {/* 3. Main Product Stock Table */}
      <div className="flex-1 overflow-auto bg-white p-4 sm:p-6">
        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 size={26} className="animate-spin text-[#348bdd]" />
            <span className="text-xs font-mono">Loading store inventory...</span>
          </div>
        ) : stockRows.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200 p-8">
            <Boxes size={32} className="text-slate-300 stroke-[1.5]" />
            <span className="text-sm font-medium text-slate-700">No Products Found</span>
            <span className="text-xs text-slate-400">
              No products match your current category or search filters.
            </span>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b divide-x divide-slate-200 bg-slate-50 text-[11px] text-slate-600 uppercase font-mono sticky top-0 z-10">
                  <th className="py-2.5 px-3 min-w-[220px]">Product Name</th>
                  <th className="py-2.5 px-3 min-w-[280px] bg-sky-50/50 text-[#1d5f9f]">
                    Enter Stock (Qty & Unit)
                  </th>
                  <th className="py-2.5 px-3 text-center min-w-[130px] bg-blue-50/25 text-[#348bdd]">
                    Calculated Inflow (KG)
                  </th>
                  <th className="py-2.5 px-3 text-right min-w-[140px]">
                    Available Stock
                  </th>
                  <th className="py-2.5 px-3 min-w-[110px]">Category</th>
                  <th className="py-2.5 px-3 text-center min-w-[140px]">Conversion Ratio</th>
                  <th className="py-2.5 px-3 text-center min-w-[100px]">Status</th>
                  <th className="py-2.5 px-3 text-center min-w-[70px]">Options</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {stockRows.map(({ product, currentQty, calculatedKg, lastNote }, idx) => {
                  const isOutOfStock = currentQty <= 0;
                  const isLowStock = !isOutOfStock && calculatedKg < 5;
                  const rowInput = getRowInput(product);
                  const enteredNum = Number(rowInput.quantity) || 0;
                  const enteredKg = convertInputToKg(product, enteredNum, rowInput.unit);

                  return (
                    <tr
                      key={`${product.id}_${idx}`}
                      className="divide-x divide-slate-200 hover:bg-slate-50/70 transition-colors"
                    >
                      {/* 1. Product Name & Image */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Boxes size={18} className="text-slate-300" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900 text-xs">
                              {product.name}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              ₹{product.amount} / {product.unit}
                              {product.barcode && ` • ${product.barcode}`}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Direct Stock Entry (Input & Unit selector right next to Product Name) */}
                      <td className="py-2 px-3 bg-sky-50/15">
                        <div className="flex items-center gap-1.5">
                          {/* Mode Toggle (+ Inward vs = Set) */}
                          <button
                            type="button"
                            onClick={() =>
                              handleRowInputChange(
                                product.id,
                                "mode",
                                rowInput.mode === "inward" ? "set" : "inward",
                                product.unit
                              )
                            }
                            className={`px-1.5 py-1 rounded text-[10px] font-mono font-medium transition-colors cursor-pointer border shrink-0 ${
                              rowInput.mode === "inward"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                            }`}
                            title={
                              rowInput.mode === "inward"
                                ? "Mode: + Inward (Adds to current stock). Click to switch to = Set Count."
                                : "Mode: = Set Exact Count (Overrides stock). Click to switch to + Inward."
                            }
                          >
                            {rowInput.mode === "inward" ? "+ Inward" : "= Set"}
                          </button>

                          {/* Numeric Quantity Input */}
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0"
                            value={rowInput.quantity}
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                            onChange={(e) =>
                              handleRowInputChange(product.id, "quantity", e.target.value, product.unit)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleSaveRowStock(product);
                              }
                            }}
                            className="w-16 px-2 py-1 text-xs border border-slate-200 rounded-md bg-white font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#348bdd] text-right shadow-2xs"
                          />

                          {/* Unit Selector Dropdown (Allows selecting Tray, piece, KG, litre) */}
                          <select
                            value={rowInput.unit}
                            onChange={(e) =>
                              handleRowInputChange(product.id, "unit", e.target.value, product.unit)
                            }
                            className="px-1.5 py-1 text-xs border border-slate-200 rounded-md bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#348bdd] cursor-pointer shadow-2xs"
                          >
                            <option value="KG">KG</option>
                            <option value="Tray">Tray</option>
                            <option value="piece">piece</option>
                            <option value="litre">litre</option>
                          </select>

                          {/* Save Button */}
                          <button
                            type="button"
                            disabled={!rowInput.quantity || Number(rowInput.quantity) <= 0 || savingId === product.id}
                            onClick={() => handleSaveRowStock(product)}
                            className="px-2.5 py-1 rounded-md text-white font-medium text-xs cursor-pointer shadow-2xs flex items-center gap-1 transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-105 active:scale-[0.98] shrink-0"
                            style={{ backgroundColor: "var(--color-brand-primary)" }}
                            title="Save stock entry directly (or press Enter)"
                          >
                            {savingId === product.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <>
                                <Plus size={12} />
                                <span>Save</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* 3. Calculated Inflow in KG (Live computation) */}
                      <td className="py-2.5 px-3 text-center bg-blue-50/10">
                        {enteredKg > 0 ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-[#348bdd] font-mono font-medium text-xs shadow-2xs">
                            <span>=</span>
                            <span>{enteredKg.toFixed(2)} KG</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-mono text-xs">—</span>
                        )}
                      </td>

                      {/* 4. Current Available Stock in Store */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="font-mono font-medium text-slate-900 text-xs">
                          {currentQty} <span className="text-[11px] font-normal text-slate-500">{product.unit}</span>
                        </div>
                        <div className="font-mono font-medium text-[11px] text-[#348bdd] mt-0.5">
                          ~{calculatedKg.toFixed(2)} KG
                        </div>
                      </td>

                      {/* 5. Category */}
                      <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          {product.categoryName}
                        </span>
                      </td>

                      {/* 6. Conversion Ratio */}
                      <td className="py-2.5 px-3 text-center font-mono text-slate-500 text-[11px]">
                        {product.unit.toLowerCase() === "piece" && product.piecesPerKg ? (
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            {product.piecesPerKg} pcs = 1 KG
                          </span>
                        ) : product.unit.toLowerCase() === "tray" ? (
                          <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                            1 tray = {product.kgPerTray || 2.5} KG
                          </span>
                        ) : product.unit.toLowerCase() === "kg" || product.unit.toLowerCase() === "litre" ? (
                          <span className="text-slate-400">1:1 Direct Unit</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* 7. Stock Status Badge */}
                      <td className="py-2.5 px-3 text-center">
                        {isOutOfStock ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            Out of Stock
                          </span>
                        ) : isLowStock ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            Low Stock
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            In Stock
                          </span>
                        )}
                      </td>

                      {/* 8. Options (Pencil / Spoilage Modal) */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleOpenAdjustment(product, "set")}
                          className="p-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer shadow-2xs"
                          title="Record detailed adjustment or spoilage"
                        >
                          <Pencil size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Stock Adjustment / Inward Modal */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-[#348bdd] flex items-center justify-center shadow-2xs">
                  <ArrowDownToLine size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
                    Stock Entry / Adjustment
                  </h2>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {currentStore?.name} • {adjustingProduct.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAdjustingProduct(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitAdjustment} className="p-6 space-y-4 text-xs">
              {/* Product Info Banner */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900 text-xs">
                    {adjustingProduct.name}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">
                    Unit: {adjustingProduct.unit}
                    {adjustingProduct.piecesPerKg ? ` (${adjustingProduct.piecesPerKg} pcs/kg)` : ""}
                    {adjustingProduct.kgPerTray ? ` (${adjustingProduct.kgPerTray} kg/tray)` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 font-mono uppercase">Current Stock</div>
                  <div className="font-bold text-slate-900 font-mono text-sm">
                    {inventoryMap.get(`${selectedStoreId}_${adjustingProduct.id}`)?.quantity || 0} {adjustingProduct.unit}
                  </div>
                </div>
              </div>

              {/* Adjustment Mode Selector */}
              <div>
                <label className="block text-[11px] font-mono font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                  Entry Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustType("inward");
                      setAdjustNote("Kitchen Sweet Inward Transfer");
                    }}
                    className={`p-2 rounded-lg border text-center font-medium transition-all cursor-pointer ${
                      adjustType === "inward"
                        ? "border-[#348bdd] bg-blue-50 text-[#348bdd] ring-1 ring-[#348bdd]"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    + Inward
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustType("set");
                      setAdjustNote("Physical Stock Count Verification");
                    }}
                    className={`p-2 rounded-lg border text-center font-medium transition-all cursor-pointer ${
                      adjustType === "set"
                        ? "border-[#348bdd] bg-blue-50 text-[#348bdd] ring-1 ring-[#348bdd]"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    = Set Exact
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustType("spoilage");
                      setAdjustNote("Spoilage / Expired / Damaged Sweet Discard");
                    }}
                    className={`p-2 rounded-lg border text-center font-medium transition-all cursor-pointer ${
                      adjustType === "spoilage"
                        ? "border-rose-300 bg-rose-50 text-rose-700 ring-1 ring-rose-400"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    - Spoilage
                  </button>
                </div>
              </div>

              {/* Quantity Input in Product Unit */}
              <div>
                <label className="block text-[11px] font-mono font-medium text-slate-700 uppercase tracking-wide mb-1">
                  Quantity ({adjustingProduct.unit}) *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder={`Enter ${adjustingProduct.unit} count`}
                    value={adjustQuantity}
                    onChange={(e) => setAdjustQuantity(e.target.value)}
                    required
                    autoFocus
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                  />
                  <span className="px-3 py-2 rounded-lg bg-slate-100 border border-slate-200 font-mono font-medium text-slate-600">
                    {adjustingProduct.unit}
                  </span>
                </div>

                {/* Live KG preview */}
                {adjustQuantity !== "" && Number(adjustQuantity) > 0 && (
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#348bdd] font-mono bg-blue-50/60 p-2 rounded-lg border border-blue-100">
                    <span>Equivalent Weight:</span>
                    <span className="font-bold">
                      ~{calculateKg(adjustingProduct, Number(adjustQuantity))} KG
                    </span>
                  </div>
                )}
              </div>

              {/* Entry Reason / Note */}
              <div>
                <label className="block text-[11px] font-mono font-medium text-slate-700 uppercase tracking-wide mb-1">
                  Batch / Transfer Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Inward from Bengali Sweets Kitchen #1"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || adjustQuantity === ""}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#348bdd] hover:bg-[#2b7bc4] text-white text-xs font-medium cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Stock Entry</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
