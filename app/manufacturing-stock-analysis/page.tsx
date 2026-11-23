"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
import SearchableSelect, { SelectOption } from "@/components/SearchableSelect";
import {
  LineChart,
  UtensilsCrossed,
  Boxes,
  Plus,
  Search,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Edit2,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  RotateCw,
  X,
  Check,
  Calculator,
  SlidersHorizontal,
  Sparkles,
  Clock,
  ChevronRight,
  Package,
} from "lucide-react";

// --- TYPES ---

export type RawItemUnit = "KG" | "Litre" | "Piece";
export type RecipeYieldUnit = "KG" | "Tray";
export type StockStatus = "crossed" | "reached" | "ready" | "good";

export interface StockAdjustmentEntry {
  id: string;
  date: string;
  type: "increase" | "decrease";
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
}

export interface ManufacturingItem {
  id: string;
  name: string;
  stock: number;
  unit: RawItemUnit;
  amount: number; // Cost/Rate per unit in INR
  bufferStock: number; // Buffer stock threshold
  category?: string;
  adjustmentHistory?: StockAdjustmentEntry[];
  createdAt?: any;
  updatedAt?: any;
}

export interface RecipeIngredient {
  itemId: string;
  itemName: string;
  unit: RawItemUnit;
  quantityUsed: number;
  unitCost: number;
  lineCost: number;
}

export interface ManufacturingRecipe {
  id: string;
  productId: string;
  productName: string;
  productCategory?: string;
  unit: RecipeYieldUnit; // "KG" | "Tray" (default KG)
  batchYield: number; // Output quantity (default 1)
  ingredients: RecipeIngredient[];
  totalRecipeCost: number;
  costPerUnit: number; // totalRecipeCost / batchYield
  instructions?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface CatalogProduct {
  id: string;
  name: string;
  categoryName?: string;
  amount?: number;
  unit?: string;
  imageUrl?: string;
}

// Starter raw material items if collection is empty
const SAMPLE_RAW_ITEMS: Omit<ManufacturingItem, "id">[] = [
  { name: "Pure Buffalo Ghee", stock: 12.5, unit: "KG", amount: 650, bufferStock: 25, category: "Dairy" },
  { name: "Sugar (Double Refined M30)", stock: 350, unit: "KG", amount: 44, bufferStock: 100, category: "Sweeteners" },
  { name: "Fresh Buffalo Milk", stock: 45, unit: "Litre", amount: 68, bufferStock: 40, category: "Dairy" },
  { name: "Cashews / Kaju (W240 Split)", stock: 8.0, unit: "KG", amount: 820, bufferStock: 20, category: "Dry Fruits" },
  { name: "Pistachio / Pista", stock: 3.5, unit: "KG", amount: 1400, bufferStock: 5, category: "Dry Fruits" },
  { name: "Green Cardamom / Elaichi", stock: 1.2, unit: "KG", amount: 2800, bufferStock: 1.0, category: "Spices" },
  { name: "Gram Flour / Pure Besan", stock: 85, unit: "KG", amount: 95, bufferStock: 30, category: "Flours" },
  { name: "Silver Vark / Edible Foil", stock: 150, unit: "Piece", amount: 6, bufferStock: 50, category: "Garnish" },
];

export default function ManufacturingStockAnalysisPage() {
  const { showToast } = useToast();

  // Active Tab: Stock Analysis -> Recipe -> Items
  const [activeTab, setActiveTab] = useState<"analysis" | "recipe" | "items">("analysis");

  // Collections state
  const [items, setItems] = useState<ManufacturingItem[]>([]);
  const [recipes, setRecipes] = useState<ManufacturingRecipe[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(true);

  // Search & Filters
  const [analysisSearch, setAnalysisSearch] = useState("");
  const [analysisStatusFilter, setAnalysisStatusFilter] = useState<"all" | StockStatus>("all");
  const [itemsSearch, setItemsSearch] = useState("");
  const [recipeSearch, setRecipeSearch] = useState("");

  // Modals state: Items
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedItemForAction, setSelectedItemForAction] = useState<ManufacturingItem | null>(null);

  // Item Form Fields
  const [itemNameInput, setItemNameInput] = useState("");
  const [itemStockInput, setItemStockInput] = useState<number | string>(0);
  const [itemUnitInput, setItemUnitInput] = useState<RawItemUnit>("KG");
  const [itemAmountInput, setItemAmountInput] = useState<number | string>(0);
  const [itemBufferStockInput, setItemBufferStockInput] = useState<number | string>(10);
  const [itemCategoryInput, setItemCategoryInput] = useState("");
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);

  // Stock Adjust Form Fields
  const [adjustType, setAdjustType] = useState<"increase" | "decrease">("increase");
  const [adjustQtyInput, setAdjustQtyInput] = useState<number | string>(1);
  const [adjustReasonInput, setAdjustReasonInput] = useState("");
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  // Modals state: Recipe
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [recipeProductId, setRecipeProductId] = useState("");
  const [recipeYieldUnit, setRecipeYieldUnit] = useState<RecipeYieldUnit>("KG");
  const [recipeBatchYield, setRecipeBatchYield] = useState<number | string>(1);
  const [recipeInstructions, setRecipeInstructions] = useState("");
  const [recipeIngredients, setRecipeIngredients] = useState<
    {
      itemId: string;
      quantityUsed: number | string;
    }[]
  >([]);
  const [isSubmittingRecipe, setIsSubmittingRecipe] = useState(false);

  // View Recipe Details / Simulation Modal
  const [viewingRecipe, setViewingRecipe] = useState<ManufacturingRecipe | null>(null);
  const [simBatchQuantity, setSimBatchQuantity] = useState<number | string>(10);

  // Confirmation modal for deletions
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    type: "item" | "recipe";
    id: string;
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: "item",
    id: "",
    title: "",
    message: "",
  });

  // --- FIRESTORE SUBSCRIPTIONS ---

  // 1. Subscribe to manufacturing_items
  useEffect(() => {
    setIsLoadingItems(true);
    const q = query(collection(db, "manufacturing_items"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loaded: ManufacturingItem[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as any),
        }));
        setItems(loaded);
        setIsLoadingItems(false);
      },
      (err) => {
        console.error("Error loading manufacturing items:", err);
        setIsLoadingItems(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // 2. Subscribe to manufacturing_recipes
  useEffect(() => {
    setIsLoadingRecipes(true);
    const q = query(collection(db, "manufacturing_recipes"), orderBy("productName", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loaded: ManufacturingRecipe[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as any),
        }));
        setRecipes(loaded);
        setIsLoadingRecipes(false);
      },
      (err) => {
        console.error("Error loading recipes:", err);
        setIsLoadingRecipes(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // 3. Load catalog products (orderable sweets & items)
  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const prods: CatalogProduct[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || "Unnamed Product",
            categoryName: data.categoryName || data.category || "General",
            amount: data.amount || 0,
            unit: data.unit || "KG",
            imageUrl: data.imageUrl || "",
          };
        });
        setCatalogProducts(prods);
      },
      (err) => {
        console.error("Error loading catalog products:", err);
      }
    );
    return () => unsubscribe();
  }, []);

  // --- SEED SAMPLE DATA (HELPFUL QUICK-START) ---
  const handleSeedSampleItems = async () => {
    try {
      for (const sample of SAMPLE_RAW_ITEMS) {
        await addDoc(collection(db, "manufacturing_items"), {
          ...sample,
          adjustmentHistory: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      showToast("Seeded standard sweet manufacturing ingredients!", "success");
    } catch (err: any) {
      console.error(err);
      showToast("Error seeding ingredients: " + err.message, "error");
    }
  };

  // --- ITEM STATUS HELPER ---
  const getItemStatus = useCallback((item: ManufacturingItem): StockStatus => {
    const { stock, bufferStock } = item;
    if (bufferStock <= 0) {
      return stock <= 0 ? "crossed" : "good";
    }
    if (stock < bufferStock || stock <= 0) {
      return "crossed";
    }
    if (stock <= bufferStock * 1.15) {
      return "reached";
    }
    if (stock <= bufferStock * 1.6) {
      return "ready";
    }
    return "good";
  }, []);

  // --- ITEM STATS & SECTION ARRAYS ---
  const analyzedItems = useMemo(() => {
    return items.map((item) => {
      const status = getItemStatus(item);
      const ratio = item.bufferStock > 0 ? (item.stock / item.bufferStock) * 100 : 100;
      const totalValue = Number((item.stock * item.amount).toFixed(2));
      const deficitOrSurplus = Number((item.stock - item.bufferStock).toFixed(2));
      return {
        ...item,
        status,
        ratio,
        totalValue,
        deficitOrSurplus,
      };
    });
  }, [items, getItemStatus]);

  // Filtered for Stock Analysis tab
  const filteredAnalysisItems = useMemo(() => {
    return analyzedItems.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(analysisSearch.toLowerCase().trim()) ||
        (item.category && item.category.toLowerCase().includes(analysisSearch.toLowerCase().trim()));
      const matchesFilter =
        analysisStatusFilter === "all" ? true : item.status === analysisStatusFilter;
      return matchesSearch && matchesFilter;
    });
  }, [analyzedItems, analysisSearch, analysisStatusFilter]);

  // Section-wise arrays for Analysis tab
  const crossedItems = useMemo(
    () => filteredAnalysisItems.filter((i) => i.status === "crossed"),
    [filteredAnalysisItems]
  );
  const reachedItems = useMemo(
    () => filteredAnalysisItems.filter((i) => i.status === "reached"),
    [filteredAnalysisItems]
  );
  const readyItems = useMemo(
    () => filteredAnalysisItems.filter((i) => i.status === "ready"),
    [filteredAnalysisItems]
  );
  const goodItems = useMemo(
    () => filteredAnalysisItems.filter((i) => i.status === "good"),
    [filteredAnalysisItems]
  );

  // Overall Metrics
  const summaryMetrics = useMemo(() => {
    let totalVal = 0;
    let crossedCount = 0;
    let reachedCount = 0;
    let readyCount = 0;
    let goodCount = 0;

    analyzedItems.forEach((i) => {
      totalVal += i.totalValue;
      if (i.status === "crossed") crossedCount++;
      else if (i.status === "reached") reachedCount++;
      else if (i.status === "ready") readyCount++;
      else if (i.status === "good") goodCount++;
    });

    return {
      totalItems: items.length,
      totalVal,
      crossedCount,
      reachedCount,
      readyCount,
      goodCount,
    };
  }, [analyzedItems, items.length]);

  // --- ITEM CRUD HANDLERS ---

  const handleOpenAddItem = () => {
    setItemNameInput("");
    setItemStockInput(0);
    setItemUnitInput("KG"); // Default KG as requested
    setItemAmountInput("");
    setItemBufferStockInput(10);
    setItemCategoryInput("");
    setIsAddItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = itemNameInput.trim();
    if (!name) {
      showToast("Please enter the item name", "error");
      return;
    }
    const stock = Number(itemStockInput) || 0;
    const amount = Number(itemAmountInput) || 0;
    const bufferStock = Number(itemBufferStockInput) || 0;

    if (amount <= 0) {
      showToast("Please enter a valid amount / cost per unit", "error");
      return;
    }

    try {
      setIsSubmittingItem(true);
      const payload: Omit<ManufacturingItem, "id"> = {
        name,
        stock,
        unit: itemUnitInput,
        amount,
        bufferStock,
        category: itemCategoryInput.trim() || "Raw Material",
        adjustmentHistory: [
          {
            id: `adj_${Date.now()}`,
            date: new Date().toISOString(),
            type: "increase",
            quantity: stock,
            previousStock: 0,
            newStock: stock,
            reason: "Initial stock entry",
          },
        ],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, "manufacturing_items"), payload);
      showToast(`Added raw material "${name}" successfully`, "success");
      setIsAddItemModalOpen(false);
    } catch (err: any) {
      console.error(err);
      showToast("Failed to add item: " + err.message, "error");
    } finally {
      setIsSubmittingItem(false);
    }
  };

  const handleOpenEditItem = (item: ManufacturingItem) => {
    setSelectedItemForAction(item);
    setItemNameInput(item.name);
    setItemStockInput(item.stock);
    setItemUnitInput(item.unit || "KG");
    setItemAmountInput(item.amount);
    setItemBufferStockInput(item.bufferStock ?? 10);
    setItemCategoryInput(item.category || "");
    setIsEditItemModalOpen(true);
  };

  const handleUpdateItemDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForAction) return;

    const name = itemNameInput.trim();
    if (!name) {
      showToast("Item name is required", "error");
      return;
    }
    const amount = Number(itemAmountInput) || 0;
    const bufferStock = Number(itemBufferStockInput) || 0;

    try {
      setIsSubmittingItem(true);
      await updateDoc(doc(db, "manufacturing_items", selectedItemForAction.id), {
        name,
        unit: itemUnitInput,
        amount,
        bufferStock,
        category: itemCategoryInput.trim() || "Raw Material",
        updatedAt: serverTimestamp(),
      });
      showToast(`Updated "${name}" details successfully`, "success");
      setIsEditItemModalOpen(false);
      setSelectedItemForAction(null);
    } catch (err: any) {
      console.error(err);
      showToast("Failed to update item: " + err.message, "error");
    } finally {
      setIsSubmittingItem(false);
    }
  };

  const handleOpenAdjustModal = (item: ManufacturingItem, defaultType: "increase" | "decrease" = "increase") => {
    setSelectedItemForAction(item);
    setAdjustType(defaultType);
    setAdjustQtyInput(1);
    setAdjustReasonInput("");
    setIsAdjustModalOpen(true);
  };

  const handleConfirmStockAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForAction) return;

    const delta = Number(adjustQtyInput);
    if (isNaN(delta) || delta <= 0) {
      showToast("Please enter a valid adjustment quantity", "error");
      return;
    }

    const prevStock = Number(selectedItemForAction.stock) || 0;
    let newStock = prevStock;

    if (adjustType === "increase") {
      newStock = Number((prevStock + delta).toFixed(3));
    } else {
      if (prevStock - delta < 0) {
        showToast("Cannot decrease stock below 0", "error");
        return;
      }
      newStock = Number((prevStock - delta).toFixed(3));
    }

    const newHistoryEntry: StockAdjustmentEntry = {
      id: `adj_${Date.now()}`,
      date: new Date().toISOString(),
      type: adjustType,
      quantity: delta,
      previousStock: prevStock,
      newStock,
      reason: adjustReasonInput.trim() || (adjustType === "increase" ? "Stock replenishment" : "Stock consumption"),
    };

    try {
      setIsSubmittingAdjust(true);
      const existingHistory = selectedItemForAction.adjustmentHistory || [];
      const updatedHistory = [newHistoryEntry, ...existingHistory].slice(0, 50);

      await updateDoc(doc(db, "manufacturing_items", selectedItemForAction.id), {
        stock: newStock,
        adjustmentHistory: updatedHistory,
        updatedAt: serverTimestamp(),
      });

      showToast(
        `Stock adjusted for ${selectedItemForAction.name}: ${prevStock} → ${newStock} ${selectedItemForAction.unit}`,
        "success"
      );
      setIsAdjustModalOpen(false);
      setSelectedItemForAction(null);
    } catch (err: any) {
      console.error(err);
      showToast("Adjustment failed: " + err.message, "error");
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteConfirmation.id) return;
    try {
      await deleteDoc(doc(db, "manufacturing_items", deleteConfirmation.id));
      showToast("Item deleted successfully", "success");
    } catch (err: any) {
      console.error(err);
      showToast("Failed to delete item: " + err.message, "error");
    } finally {
      setDeleteConfirmation((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // --- RECIPE CRUD HANDLERS ---

  const handleOpenAddRecipe = () => {
    setEditingRecipeId(null);
    setRecipeProductId(catalogProducts[0]?.id || "");
    setRecipeYieldUnit("KG"); // Default KG as requested
    setRecipeBatchYield(1);
    setRecipeInstructions("");
    if (items.length > 0) {
      setRecipeIngredients([{ itemId: items[0].id, quantityUsed: 1 }]);
    } else {
      setRecipeIngredients([]);
    }
    setIsRecipeModalOpen(true);
  };

  const handleOpenEditRecipe = (recipe: ManufacturingRecipe) => {
    setEditingRecipeId(recipe.id);
    setRecipeProductId(recipe.productId);
    setRecipeYieldUnit(recipe.unit || "KG");
    setRecipeBatchYield(recipe.batchYield || 1);
    setRecipeInstructions(recipe.instructions || "");
    setRecipeIngredients(
      recipe.ingredients.map((ing) => ({
        itemId: ing.itemId,
        quantityUsed: ing.quantityUsed,
      }))
    );
    setIsRecipeModalOpen(true);
  };

  const handleAddIngredientRow = () => {
    if (items.length === 0) {
      showToast("Please add items in the Items tab first", "error");
      return;
    }
    const unusedItem = items.find((it) => !recipeIngredients.some((r) => r.itemId === it.id)) || items[0];
    setRecipeIngredients((prev) => [...prev, { itemId: unusedItem.id, quantityUsed: 1 }]);
  };

  const handleRemoveIngredientRow = (idx: number) => {
    setRecipeIngredients((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateIngredientRow = (idx: number, field: "itemId" | "quantityUsed", val: any) => {
    setRecipeIngredients((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: val } : row))
    );
  };

  const computedRecipeInModal = useMemo(() => {
    let totalCost = 0;
    const computedIngredients: RecipeIngredient[] = [];

    recipeIngredients.forEach((row) => {
      const it = items.find((item) => item.id === row.itemId);
      if (it) {
        const qty = Number(row.quantityUsed) || 0;
        const lineCost = Number((qty * it.amount).toFixed(2));
        totalCost += lineCost;
        computedIngredients.push({
          itemId: it.id,
          itemName: it.name,
          unit: it.unit,
          quantityUsed: qty,
          unitCost: it.amount,
          lineCost,
        });
      }
    });

    const batchYieldNum = Number(recipeBatchYield) > 0 ? Number(recipeBatchYield) : 1;
    const costPerUnit = Number((totalCost / batchYieldNum).toFixed(2));

    return {
      ingredients: computedIngredients,
      totalCost: Number(totalCost.toFixed(2)),
      costPerUnit,
    };
  }, [recipeIngredients, items, recipeBatchYield]);

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeProductId) {
      showToast("Please select a target orderable product", "error");
      return;
    }

    const matchedProduct = catalogProducts.find((p) => p.id === recipeProductId);
    if (!matchedProduct) {
      showToast("Selected product not found", "error");
      return;
    }

    if (computedRecipeInModal.ingredients.length === 0) {
      showToast("Please add at least one ingredient to the recipe", "error");
      return;
    }

    const batchYieldNum = Number(recipeBatchYield);
    if (isNaN(batchYieldNum) || batchYieldNum <= 0) {
      showToast("Batch yield must be greater than 0", "error");
      return;
    }

    try {
      setIsSubmittingRecipe(true);

      const payload: Omit<ManufacturingRecipe, "id"> = {
        productId: matchedProduct.id,
        productName: matchedProduct.name,
        productCategory: matchedProduct.categoryName || "Sweets",
        unit: recipeYieldUnit,
        batchYield: batchYieldNum,
        ingredients: computedRecipeInModal.ingredients,
        totalRecipeCost: computedRecipeInModal.totalCost,
        costPerUnit: computedRecipeInModal.costPerUnit,
        instructions: recipeInstructions.trim(),
        updatedAt: serverTimestamp(),
      };

      if (editingRecipeId) {
        await updateDoc(doc(db, "manufacturing_recipes", editingRecipeId), payload);
        showToast(`Updated recipe for "${matchedProduct.name}"`, "success");
      } else {
        await addDoc(collection(db, "manufacturing_recipes"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        showToast(`Created new recipe for "${matchedProduct.name}"`, "success");
      }

      setIsRecipeModalOpen(false);
    } catch (err: any) {
      console.error(err);
      showToast("Failed to save recipe: " + err.message, "error");
    } finally {
      setIsSubmittingRecipe(false);
    }
  };

  const handleDeleteRecipe = async () => {
    if (!deleteConfirmation.id) return;
    try {
      await deleteDoc(doc(db, "manufacturing_recipes", deleteConfirmation.id));
      showToast("Recipe deleted successfully", "success");
    } catch (err: any) {
      console.error(err);
      showToast("Failed to delete recipe: " + err.message, "error");
    } finally {
      setDeleteConfirmation((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const productSelectOptions: SelectOption[] = useMemo(() => {
    return catalogProducts.map((p) => ({
      value: p.id,
      label: p.name,
      sublabel: `${p.categoryName || "General"} • ₹${p.amount || 0}/${p.unit || "KG"}`,
    }));
  }, [catalogProducts]);

  const filteredRecipes = useMemo(() => {
    return recipes.filter((r) => {
      const q = recipeSearch.toLowerCase().trim();
      if (!q) return true;
      return (
        r.productName.toLowerCase().includes(q) ||
        (r.productCategory && r.productCategory.toLowerCase().includes(q)) ||
        r.ingredients.some((ing) => ing.itemName.toLowerCase().includes(q))
      );
    });
  }, [recipes, recipeSearch]);

  const filteredItemsList = useMemo(() => {
    return items.filter((it) => {
      const q = itemsSearch.toLowerCase().trim();
      if (!q) return true;
      return (
        it.name.toLowerCase().includes(q) ||
        (it.category && it.category.toLowerCase().includes(q)) ||
        it.unit.toLowerCase().includes(q)
      );
    });
  }, [items, itemsSearch]);

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full space-y-6">
      {/* 1. Top Header Matching Application Design Language */}
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
              <LineChart size={18} />
            </div>
            <h1
              className="text-2xl text-[var(--color-text-primary)] tracking-tight"
              style={{ fontWeight: 500 }}
            >
              Manufacturing Stock Analysis
            </h1>
            <span
              className="px-2 py-0.5 text-xs rounded font-normal font-mono"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                border: "1px solid var(--color-border-base)",
                color: "var(--color-text-secondary)",
              }}
            >
              {items.length} items
            </span>
          </div>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            Track raw ingredient stock buffer thresholds, sweet recipes yield, and batch simulation analysis.
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2.5">
          {activeTab === "items" && (
            <button
              onClick={handleOpenAddItem}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-md text-white transition-opacity hover:opacity-90 font-normal shadow-xs cursor-pointer"
              style={{ backgroundColor: "var(--color-brand-primary)" }}
            >
              <Plus size={15} />
              <span>Add Item</span>
            </button>
          )}

          {activeTab === "recipe" && (
            <button
              onClick={handleOpenAddRecipe}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-md text-white transition-opacity hover:opacity-90 font-normal shadow-xs cursor-pointer"
              style={{ backgroundColor: "var(--color-brand-primary)" }}
            >
              <Plus size={15} />
              <span>Add Recipe</span>
            </button>
          )}

          {activeTab === "analysis" && items.length === 0 && !isLoadingItems && (
            <button
              onClick={handleSeedSampleItems}
              className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-md border font-normal cursor-pointer bg-white hover:bg-slate-50 transition-colors shadow-2xs text-slate-700"
              style={{ borderColor: "var(--color-border-base)" }}
            >
              <Sparkles size={14} className="text-[#348bdd]" />
              <span>Load Starter Ingredients</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Navigation Tabs (Underline Tab Language) */}
      <div
        className="flex items-center gap-2 border-b"
        style={{ borderColor: "var(--color-border-base)" }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("analysis")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === "analysis"
              ? "border-[#348bdd] text-[#348bdd]"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          <LineChart size={15} />
          <span>Stock Analysis</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
              activeTab === "analysis" ? "bg-blue-100 text-[#348bdd]" : "bg-slate-100 text-slate-600"
            }`}
          >
            {items.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("recipe")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === "recipe"
              ? "border-[#348bdd] text-[#348bdd]"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          <UtensilsCrossed size={15} />
          <span>Recipe</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
              activeTab === "recipe" ? "bg-blue-100 text-[#348bdd]" : "bg-slate-100 text-slate-600"
            }`}
          >
            {recipes.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("items")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === "items"
              ? "border-[#348bdd] text-[#348bdd]"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          <Boxes size={15} />
          <span>Items</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
              activeTab === "items" ? "bg-blue-100 text-[#348bdd]" : "bg-slate-100 text-slate-600"
            }`}
          >
            {items.length}
          </span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: STOCK ANALYSIS (Section-wise Display)              */}
      {/* ========================================================= */}
      {activeTab === "analysis" && (
        <div className="space-y-6">
          {/* Metric Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div
              className="p-3.5 rounded-lg border bg-white shadow-2xs"
              style={{ borderColor: "var(--color-border-base)" }}
            >
              <span className="text-[11px] text-slate-500 block">Total Raw Materials</span>
              <span className="text-xl font-mono text-slate-900 mt-1 block" style={{ fontWeight: 500 }}>
                {summaryMetrics.totalItems}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">Ingredients in stock</span>
            </div>

            <div
              onClick={() => setAnalysisStatusFilter(analysisStatusFilter === "crossed" ? "all" : "crossed")}
              className={`p-3.5 rounded-lg border transition-all cursor-pointer shadow-2xs ${
                analysisStatusFilter === "crossed"
                  ? "bg-red-500 text-white border-red-600 shadow-xs"
                  : "bg-red-50/60 border-red-200 text-red-900 hover:bg-red-100/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-medium ${
                    analysisStatusFilter === "crossed" ? "text-white" : "text-red-700"
                  }`}
                >
                  Crossed Buffer
                </span>
                <AlertCircle size={14} className={analysisStatusFilter === "crossed" ? "text-white" : "text-red-600"} />
              </div>
              <span className="text-xl font-mono block mt-1" style={{ fontWeight: 500 }}>
                {summaryMetrics.crossedCount}
              </span>
              <span
                className={`text-[10px] block mt-0.5 ${
                  analysisStatusFilter === "crossed" ? "text-white/80" : "text-red-600"
                }`}
              >
                Critical Deficit
              </span>
            </div>

            <div
              onClick={() => setAnalysisStatusFilter(analysisStatusFilter === "reached" ? "all" : "reached")}
              className={`p-3.5 rounded-lg border transition-all cursor-pointer shadow-2xs ${
                analysisStatusFilter === "reached"
                  ? "bg-orange-500 text-white border-orange-600 shadow-xs"
                  : "bg-orange-50/60 border-orange-200 text-orange-900 hover:bg-orange-100/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-medium ${
                    analysisStatusFilter === "reached" ? "text-white" : "text-orange-700"
                  }`}
                >
                  Reached Buffer
                </span>
                <AlertTriangle
                  size={14}
                  className={analysisStatusFilter === "reached" ? "text-white" : "text-orange-600"}
                />
              </div>
              <span className="text-xl font-mono block mt-1" style={{ fontWeight: 500 }}>
                {summaryMetrics.reachedCount}
              </span>
              <span
                className={`text-[10px] block mt-0.5 ${
                  analysisStatusFilter === "reached" ? "text-white/80" : "text-orange-600"
                }`}
              >
                Reorder Threshold
              </span>
            </div>

            <div
              onClick={() => setAnalysisStatusFilter(analysisStatusFilter === "ready" ? "all" : "ready")}
              className={`p-3.5 rounded-lg border transition-all cursor-pointer shadow-2xs ${
                analysisStatusFilter === "ready"
                  ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                  : "bg-amber-50/60 border-amber-200 text-amber-900 hover:bg-amber-100/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-medium ${
                    analysisStatusFilter === "ready" ? "text-white" : "text-amber-800"
                  }`}
                >
                  Ready to Buffer
                </span>
                <Clock size={14} className={analysisStatusFilter === "ready" ? "text-white" : "text-amber-600"} />
              </div>
              <span className="text-xl font-mono block mt-1" style={{ fontWeight: 500 }}>
                {summaryMetrics.readyCount}
              </span>
              <span
                className={`text-[10px] block mt-0.5 ${
                  analysisStatusFilter === "ready" ? "text-white/80" : "text-amber-700"
                }`}
              >
                Watchlist
              </span>
            </div>

            <div
              onClick={() => setAnalysisStatusFilter(analysisStatusFilter === "good" ? "all" : "good")}
              className={`p-3.5 rounded-lg border transition-all cursor-pointer shadow-2xs ${
                analysisStatusFilter === "good"
                  ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                  : "bg-emerald-50/60 border-emerald-200 text-emerald-900 hover:bg-emerald-100/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-medium ${
                    analysisStatusFilter === "good" ? "text-white" : "text-emerald-800"
                  }`}
                >
                  Good Quantity
                </span>
                <CheckCircle2
                  size={14}
                  className={analysisStatusFilter === "good" ? "text-white" : "text-emerald-600"}
                />
              </div>
              <span className="text-xl font-mono block mt-1" style={{ fontWeight: 500 }}>
                {summaryMetrics.goodCount}
              </span>
              <span
                className={`text-[10px] block mt-0.5 ${
                  analysisStatusFilter === "good" ? "text-white/80" : "text-emerald-700"
                }`}
              >
                Healthy Stock
              </span>
            </div>

            <div
              className="p-3.5 rounded-lg border bg-white shadow-2xs"
              style={{ borderColor: "var(--color-border-base)" }}
            >
              <span className="text-[11px] text-slate-500 block">Stock Asset Value</span>
              <span className="text-xl font-mono text-[#348bdd] mt-1 block" style={{ fontWeight: 500 }}>
                ₹{summaryMetrics.totalVal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">Total valuation</span>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border w-full sm:w-80 bg-white"
              style={{ borderColor: "var(--color-border-base)" }}
            >
              <Search size={14} style={{ color: "var(--color-text-muted)" }} />
              <input
                type="text"
                placeholder="Search raw material name, category..."
                value={analysisSearch}
                onChange={(e) => setAnalysisSearch(e.target.value)}
                className="w-full text-xs bg-transparent focus:outline-none"
                style={{ color: "var(--color-text-primary)" }}
              />
              {analysisSearch && (
                <button
                  onClick={() => setAnalysisSearch("")}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs w-full sm:w-auto">
              <button
                onClick={() => setAnalysisStatusFilter("all")}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer shrink-0 text-xs ${
                  analysisStatusFilter === "all"
                    ? "bg-[#348bdd] text-white font-medium"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                All ({items.length})
              </button>
              <button
                onClick={() => setAnalysisStatusFilter("crossed")}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer shrink-0 text-xs ${
                  analysisStatusFilter === "crossed"
                    ? "bg-red-600 text-white font-medium"
                    : "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                }`}
              >
                Crossed ({summaryMetrics.crossedCount})
              </button>
              <button
                onClick={() => setAnalysisStatusFilter("reached")}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer shrink-0 text-xs ${
                  analysisStatusFilter === "reached"
                    ? "bg-orange-600 text-white font-medium"
                    : "border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                }`}
              >
                Reached ({summaryMetrics.reachedCount})
              </button>
              <button
                onClick={() => setAnalysisStatusFilter("ready")}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer shrink-0 text-xs ${
                  analysisStatusFilter === "ready"
                    ? "bg-amber-600 text-white font-medium"
                    : "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                }`}
              >
                Ready ({summaryMetrics.readyCount})
              </button>
              <button
                onClick={() => setAnalysisStatusFilter("good")}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer shrink-0 text-xs ${
                  analysisStatusFilter === "good"
                    ? "bg-emerald-700 text-white font-medium"
                    : "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                }`}
              >
                Good ({summaryMetrics.goodCount})
              </button>
            </div>
          </div>

          {/* Section-Wise Display */}
          {isLoadingItems ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <RotateCw size={22} className="animate-spin text-[#348bdd]" />
              <span className="text-xs text-slate-400">Loading stock buffer analysis...</span>
            </div>
          ) : items.length === 0 ? (
            <div
              className="py-16 text-center rounded-lg border border-dashed bg-white p-6 max-w-lg mx-auto"
              style={{ borderColor: "var(--color-border-base)" }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3"
                style={{
                  backgroundColor: "var(--color-brand-primary-light)",
                  color: "var(--color-brand-primary)",
                }}
              >
                <Boxes size={20} />
              </div>
              <h3 className="text-sm font-medium text-slate-800 mb-1">No Raw Material Items Found</h3>
              <p className="text-xs text-slate-500 mb-4">
                Add your sweet manufacturing ingredients in the Items tab or load starter items.
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={handleSeedSampleItems}
                  className="px-3.5 py-2 text-xs rounded-md text-white font-normal cursor-pointer shadow-xs"
                  style={{ backgroundColor: "var(--color-brand-primary)" }}
                >
                  Load Starter Ingredients
                </button>
                <button
                  onClick={() => {
                    setActiveTab("items");
                    handleOpenAddItem();
                  }}
                  className="px-3 py-2 text-xs rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-normal cursor-pointer"
                >
                  + Add Item
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* SECTION 1: CROSSED BUFFER STOCK */}
              {(analysisStatusFilter === "all" || analysisStatusFilter === "crossed") && (
                <div
                  className="rounded-lg border bg-white overflow-hidden shadow-2xs"
                  style={{ borderColor: "var(--color-border-base)" }}
                >
                  <div className="bg-red-50/70 px-4 py-2.5 border-b border-red-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-red-600 text-white flex items-center justify-center">
                        <AlertCircle size={14} />
                      </div>
                      <div>
                        <h2 className="text-xs font-semibold text-red-900 flex items-center gap-2">
                          Crossed Buffer Stock
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-red-600 text-white">
                            {crossedItems.length}
                          </span>
                        </h2>
                      </div>
                    </div>
                    <span className="text-[11px] text-red-700 font-mono">Critical Deficit • Reorder Immediately</span>
                  </div>

                  <div className="p-4">
                    {crossedItems.length === 0 ? (
                      <div className="py-4 text-center text-xs text-slate-400 font-mono">
                        ✓ No items have crossed buffer limit.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {crossedItems.map((item) => (
                          <StockItemCard
                            key={item.id}
                            item={item}
                            statusColor="red"
                            onAdjust={() => handleOpenAdjustModal(item, "increase")}
                            onEdit={() => handleOpenEditItem(item)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION 2: REACHED BUFFER STOCK */}
              {(analysisStatusFilter === "all" || analysisStatusFilter === "reached") && (
                <div
                  className="rounded-lg border bg-white overflow-hidden shadow-2xs"
                  style={{ borderColor: "var(--color-border-base)" }}
                >
                  <div className="bg-orange-50/70 px-4 py-2.5 border-b border-orange-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-orange-600 text-white flex items-center justify-center">
                        <AlertTriangle size={14} />
                      </div>
                      <div>
                        <h2 className="text-xs font-semibold text-orange-950 flex items-center gap-2">
                          Reached Buffer Stock
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-orange-600 text-white">
                            {reachedItems.length}
                          </span>
                        </h2>
                      </div>
                    </div>
                    <span className="text-[11px] text-orange-800 font-mono">At Buffer Limit • Prepare Purchase Order</span>
                  </div>

                  <div className="p-4">
                    {reachedItems.length === 0 ? (
                      <div className="py-4 text-center text-xs text-slate-400 font-mono">
                        No items currently at buffer limit.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {reachedItems.map((item) => (
                          <StockItemCard
                            key={item.id}
                            item={item}
                            statusColor="orange"
                            onAdjust={() => handleOpenAdjustModal(item, "increase")}
                            onEdit={() => handleOpenEditItem(item)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION 3: READY TO BUFFER STOCK */}
              {(analysisStatusFilter === "all" || analysisStatusFilter === "ready") && (
                <div
                  className="rounded-lg border bg-white overflow-hidden shadow-2xs"
                  style={{ borderColor: "var(--color-border-base)" }}
                >
                  <div className="bg-amber-50/70 px-4 py-2.5 border-b border-amber-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-amber-600 text-white flex items-center justify-center">
                        <Clock size={14} />
                      </div>
                      <div>
                        <h2 className="text-xs font-semibold text-amber-950 flex items-center gap-2">
                          Ready to Buffer Stock
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-600 text-white">
                            {readyItems.length}
                          </span>
                        </h2>
                      </div>
                    </div>
                    <span className="text-[11px] text-amber-800 font-mono">Approaching Buffer • Watchlist</span>
                  </div>

                  <div className="p-4">
                    {readyItems.length === 0 ? (
                      <div className="py-4 text-center text-xs text-slate-400 font-mono">
                        No items approaching buffer zone.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {readyItems.map((item) => (
                          <StockItemCard
                            key={item.id}
                            item={item}
                            statusColor="amber"
                            onAdjust={() => handleOpenAdjustModal(item, "increase")}
                            onEdit={() => handleOpenEditItem(item)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION 4: GOOD QUANTITY */}
              {(analysisStatusFilter === "all" || analysisStatusFilter === "good") && (
                <div
                  className="rounded-lg border bg-white overflow-hidden shadow-2xs"
                  style={{ borderColor: "var(--color-border-base)" }}
                >
                  <div className="bg-emerald-50/70 px-4 py-2.5 border-b border-emerald-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-emerald-600 text-white flex items-center justify-center">
                        <CheckCircle2 size={14} />
                      </div>
                      <div>
                        <h2 className="text-xs font-semibold text-emerald-950 flex items-center gap-2">
                          Good Quantity Stock
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-600 text-white">
                            {goodItems.length}
                          </span>
                        </h2>
                      </div>
                    </div>
                    <span className="text-[11px] text-emerald-800 font-mono">Healthy Surplus Level</span>
                  </div>

                  <div className="p-4">
                    {goodItems.length === 0 ? (
                      <div className="py-4 text-center text-xs text-slate-400 font-mono">
                        No items in healthy quantity.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {goodItems.map((item) => (
                          <StockItemCard
                            key={item.id}
                            item={item}
                            statusColor="emerald"
                            onAdjust={() => handleOpenAdjustModal(item, "increase")}
                            onEdit={() => handleOpenEditItem(item)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: RECIPE (Sweet Product Recipes & Ratios)           */}
      {/* ========================================================= */}
      {activeTab === "recipe" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border w-full sm:w-80 bg-white"
              style={{ borderColor: "var(--color-border-base)" }}
            >
              <Search size={14} style={{ color: "var(--color-text-muted)" }} />
              <input
                type="text"
                placeholder="Search recipes by sweet or ingredient..."
                value={recipeSearch}
                onChange={(e) => setRecipeSearch(e.target.value)}
                className="w-full text-xs bg-transparent focus:outline-none"
                style={{ color: "var(--color-text-primary)" }}
              />
              {recipeSearch && (
                <button
                  onClick={() => setRecipeSearch("")}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <button
              onClick={handleOpenAddRecipe}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-md text-white transition-opacity hover:opacity-90 font-normal shadow-xs cursor-pointer self-end sm:self-auto"
              style={{ backgroundColor: "var(--color-brand-primary)" }}
            >
              <Plus size={15} />
              <span>Create Recipe</span>
            </button>
          </div>

          {/* Recipes Grid */}
          {isLoadingRecipes ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <RotateCw size={22} className="animate-spin text-[#348bdd]" />
              <span className="text-xs text-slate-400">Loading manufacturing recipes...</span>
            </div>
          ) : filteredRecipes.length === 0 ? (
            <div
              className="py-16 text-center rounded-lg border border-dashed bg-white p-6 max-w-lg mx-auto"
              style={{ borderColor: "var(--color-border-base)" }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3"
                style={{
                  backgroundColor: "var(--color-brand-primary-light)",
                  color: "var(--color-brand-primary)",
                }}
              >
                <UtensilsCrossed size={20} />
              </div>
              <h3 className="text-sm font-medium text-slate-800 mb-1">No Recipes Defined</h3>
              <p className="text-xs text-slate-500 mb-4">
                Create your first manufacturing recipe linking orderable sweets to raw ingredients.
              </p>
              <button
                onClick={handleOpenAddRecipe}
                className="px-3.5 py-2 text-xs rounded-md text-white font-normal cursor-pointer shadow-xs"
                style={{ backgroundColor: "var(--color-brand-primary)" }}
              >
                + Add Recipe
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRecipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className="rounded-lg border bg-white p-4 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-all"
                  style={{ borderColor: "var(--color-border-base)" }}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <span className="text-[10px] uppercase font-mono text-[#348bdd] block">
                          {recipe.productCategory || "Sweet Recipe"}
                        </span>
                        <h3 className="text-sm font-medium text-slate-900">{recipe.productName}</h3>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-700 shrink-0">
                        Yield: {recipe.batchYield} {recipe.unit}
                      </span>
                    </div>

                    {/* Cost Summary */}
                    <div className="p-2 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-between mb-3 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Total Batch Cost</span>
                        <span className="font-mono font-medium text-slate-800">
                          ₹{recipe.totalRecipeCost.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block">Cost / {recipe.unit}</span>
                        <span className="font-mono font-medium text-[#348bdd]">
                          ₹{recipe.costPerUnit.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>

                    {/* Ingredients List */}
                    <div className="space-y-1 mb-3">
                      <span className="text-[10px] font-mono uppercase text-slate-400 block tracking-wider">
                        Ingredients Used ({recipe.ingredients?.length || 0})
                      </span>
                      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                        {recipe.ingredients?.map((ing, idx) => (
                          <div
                            key={idx}
                            className="text-xs flex items-center justify-between py-1 px-2 rounded bg-slate-50 border border-slate-100/80"
                          >
                            <span className="text-slate-700 truncate max-w-[150px]">{ing.itemName}</span>
                            <div className="flex items-center gap-2 font-mono shrink-0">
                              <span className="text-slate-600">
                                {ing.quantityUsed} {ing.unit}
                              </span>
                              <span className="text-slate-400 text-[11px]">₹{ing.lineCost}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {recipe.instructions && (
                      <p className="text-[11px] text-slate-500 italic line-clamp-2 mb-3 bg-amber-50/50 p-2 rounded border border-amber-100">
                        {recipe.instructions}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-2">
                    <button
                      onClick={() => {
                        setViewingRecipe(recipe);
                        setSimBatchQuantity(recipe.batchYield * 5);
                      }}
                      className="px-2 py-1 rounded text-xs font-normal text-[#348bdd] hover:bg-blue-50 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Calculator size={13} />
                      <span>Simulate Batch</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditRecipe(recipe)}
                        className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                        title="Edit Recipe"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() =>
                          setDeleteConfirmation({
                            isOpen: true,
                            type: "recipe",
                            id: recipe.id,
                            title: "Delete Recipe",
                            message: `Are you sure you want to delete the recipe for "${recipe.productName}"?`,
                          })
                        }
                        className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                        title="Delete Recipe"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: ITEMS (Raw Materials & Stock Adjustments)          */}
      {/* ========================================================= */}
      {activeTab === "items" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border w-full sm:w-80 bg-white"
              style={{ borderColor: "var(--color-border-base)" }}
            >
              <Search size={14} style={{ color: "var(--color-text-muted)" }} />
              <input
                type="text"
                placeholder="Search raw material name, category..."
                value={itemsSearch}
                onChange={(e) => setItemsSearch(e.target.value)}
                className="w-full text-xs bg-transparent focus:outline-none"
                style={{ color: "var(--color-text-primary)" }}
              />
              {itemsSearch && (
                <button
                  onClick={() => setItemsSearch("")}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              {items.length === 0 && !isLoadingItems && (
                <button
                  onClick={handleSeedSampleItems}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-md border font-normal cursor-pointer bg-white hover:bg-slate-50 transition-colors shadow-2xs text-slate-700"
                  style={{ borderColor: "var(--color-border-base)" }}
                >
                  <Sparkles size={14} className="text-[#348bdd]" />
                  <span>Seed Samples</span>
                </button>
              )}

              <button
                onClick={handleOpenAddItem}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-md text-white transition-opacity hover:opacity-90 font-normal shadow-xs cursor-pointer"
                style={{ backgroundColor: "var(--color-brand-primary)" }}
              >
                <Plus size={15} />
                <span>Add Item</span>
              </button>
            </div>
          </div>

          {/* Items Table */}
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
                    <th className="py-2.5 px-4">Item Name & Category</th>
                    <th className="py-2.5 px-4 text-right">Current Stock</th>
                    <th className="py-2.5 px-4 text-center">Unit</th>
                    <th className="py-2.5 px-4 text-right">Buffer Stock</th>
                    <th className="py-2.5 px-4 text-right">Unit Rate</th>
                    <th className="py-2.5 px-4 text-right">Asset Value</th>
                    <th className="py-2.5 px-4 text-center">Stock Health</th>
                    <th className="py-2.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingItems ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-slate-400">
                        <RotateCw size={20} className="animate-spin inline text-[#348bdd] mr-2" />
                        Loading inventory items...
                      </td>
                    </tr>
                  ) : filteredItemsList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-slate-400">
                        No raw material items found.
                      </td>
                    </tr>
                  ) : (
                    filteredItemsList.map((item) => {
                      const status = getItemStatus(item);
                      const totalVal = (item.stock * item.amount).toFixed(2);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-medium text-slate-900 block">{item.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {item.category || "Raw Material"}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-medium text-slate-900">
                            {item.stock.toFixed(2)}{" "}
                            <span className="text-xs font-normal text-slate-500">{item.unit}</span>
                          </td>

                          <td className="py-3 px-4 text-center font-mono">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                              {item.unit}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right font-mono text-slate-600">
                            {item.bufferStock} {item.unit}
                          </td>

                          <td className="py-3 px-4 text-right font-mono text-slate-700">
                            ₹{item.amount.toLocaleString("en-IN")}{" "}
                            <span className="text-[10px] text-slate-400">/{item.unit}</span>
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-medium text-[#348bdd]">
                            ₹{Number(totalVal).toLocaleString("en-IN")}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <StockStatusBadge status={status} />
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenAdjustModal(item)}
                                className="px-2 py-1 rounded bg-blue-50 text-[#348bdd] hover:bg-[#348bdd] hover:text-white text-[11px] font-normal flex items-center gap-1 transition-colors cursor-pointer"
                                title="Adjust Stock (+ / -)"
                              >
                                <SlidersHorizontal size={11} />
                                <span>Adjust</span>
                              </button>
                              <button
                                onClick={() => handleOpenEditItem(item)}
                                className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                                title="Edit Item Details"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() =>
                                  setDeleteConfirmation({
                                    isOpen: true,
                                    type: "item",
                                    id: item.id,
                                    title: "Delete Item",
                                    message: `Are you sure you want to delete raw material "${item.name}"?`,
                                  })
                                }
                                className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                                title="Delete Item"
                              >
                                <Trash2 size={13} />
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

      {/* ========================================================= */}
      {/* MODAL: ADD RAW MATERIAL ITEM                             */}
      {/* ========================================================= */}
      {isAddItemModalOpen && (
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
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center"
                  style={{
                    backgroundColor: "var(--color-brand-primary-light)",
                    color: "var(--color-brand-primary)",
                  }}
                >
                  <Plus size={16} />
                </div>
                <h3 className="text-sm font-medium text-slate-800">Add Raw Material Item</h3>
              </div>
              <button
                onClick={() => setIsAddItemModalOpen(false)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                  Item Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Pure Buffalo Ghee, Sugar M30, Cashews"
                  value={itemNameInput}
                  onChange={(e) => setItemNameInput(e.target.value)}
                  required
                  className="w-full text-xs px-3 py-2 rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd] bg-white"
                  style={{ borderColor: "var(--color-border-base)" }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1.5">
                  Stock Unit <span className="text-slate-400 font-normal lowercase">(default: KG)</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["KG", "Litre", "Piece"] as RawItemUnit[]).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setItemUnitInput(u)}
                      className={`py-2 px-3 rounded-md text-xs font-mono font-medium transition-all cursor-pointer text-center ${
                        itemUnitInput === u
                          ? "bg-[#348bdd] text-white shadow-2xs"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                    Initial Stock ({itemUnitInput})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0"
                    value={itemStockInput}
                    onChange={(e) => setItemStockInput(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd] font-mono bg-white"
                    style={{ borderColor: "var(--color-border-base)" }}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                    Buffer Stock ({itemUnitInput}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="10"
                    value={itemBufferStockInput}
                    onChange={(e) => setItemBufferStockInput(e.target.value)}
                    required
                    className="w-full text-xs px-3 py-2 rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd] font-mono bg-white"
                    style={{ borderColor: "var(--color-border-base)" }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                  Amount / Cost per {itemUnitInput} (₹) <span className="text-rose-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-slate-400 text-xs font-mono">₹</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 650"
                    value={itemAmountInput}
                    onChange={(e) => setItemAmountInput(e.target.value)}
                    required
                    className="w-full pl-7 pr-3 py-2 text-xs rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd] font-mono bg-white"
                    style={{ borderColor: "var(--color-border-base)" }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                  Category <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dairy, Sweeteners, Dry Fruits"
                  value={itemCategoryInput}
                  onChange={(e) => setItemCategoryInput(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd] bg-white"
                  style={{ borderColor: "var(--color-border-base)" }}
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddItemModalOpen(false)}
                  className="px-3.5 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer font-normal"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingItem}
                  className="px-4 py-2 text-xs text-white rounded-md shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 font-normal"
                  style={{ backgroundColor: "var(--color-brand-primary)" }}
                >
                  {isSubmittingItem ? <RotateCw size={13} className="animate-spin" /> : <Check size={14} />}
                  <span>Save Item</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: EDIT ITEM DETAILS                                 */}
      {/* ========================================================= */}
      {isEditItemModalOpen && selectedItemForAction && (
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
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center"
                  style={{
                    backgroundColor: "var(--color-brand-primary-light)",
                    color: "var(--color-brand-primary)",
                  }}
                >
                  <Edit2 size={15} />
                </div>
                <h3 className="text-sm font-medium text-slate-800">Edit Item Details</h3>
              </div>
              <button
                onClick={() => setIsEditItemModalOpen(false)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleUpdateItemDetails} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  value={itemNameInput}
                  onChange={(e) => setItemNameInput(e.target.value)}
                  required
                  className="w-full text-xs px-3 py-2 rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                  style={{ borderColor: "var(--color-border-base)" }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1.5">
                  Unit
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["KG", "Litre", "Piece"] as RawItemUnit[]).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setItemUnitInput(u)}
                      className={`py-1.5 px-3 rounded-md text-xs font-mono font-medium transition-all cursor-pointer ${
                        itemUnitInput === u
                          ? "bg-[#348bdd] text-white shadow-2xs"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                    Buffer Stock ({itemUnitInput})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={itemBufferStockInput}
                    onChange={(e) => setItemBufferStockInput(e.target.value)}
                    required
                    className="w-full text-xs px-3 py-2 rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd] font-mono"
                    style={{ borderColor: "var(--color-border-base)" }}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                    Amount (₹/{itemUnitInput})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={itemAmountInput}
                    onChange={(e) => setItemAmountInput(e.target.value)}
                    required
                    className="w-full text-xs px-3 py-2 rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd] font-mono"
                    style={{ borderColor: "var(--color-border-base)" }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={itemCategoryInput}
                  onChange={(e) => setItemCategoryInput(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                  style={{ borderColor: "var(--color-border-base)" }}
                />
              </div>

              {/* Direct Stock Adjust Link */}
              <div
                className="p-3 rounded-md border flex items-center justify-between"
                style={{
                  backgroundColor: "var(--color-bg-subtle)",
                  borderColor: "var(--color-border-base)",
                }}
              >
                <div>
                  <span className="text-[10px] text-slate-500 block">Current Stock</span>
                  <span className="text-xs font-mono font-medium text-slate-800">
                    {selectedItemForAction.stock} {selectedItemForAction.unit}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditItemModalOpen(false);
                    handleOpenAdjustModal(selectedItemForAction);
                  }}
                  className="px-2.5 py-1 rounded text-white text-[11px] font-normal flex items-center gap-1 cursor-pointer shadow-2xs"
                  style={{ backgroundColor: "var(--color-brand-primary)" }}
                >
                  <SlidersHorizontal size={11} />
                  <span>Adjust Stock (+ / -)</span>
                </button>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditItemModalOpen(false)}
                  className="px-3.5 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer font-normal"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingItem}
                  className="px-4 py-2 text-xs text-white rounded-md shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 font-normal"
                  style={{ backgroundColor: "var(--color-brand-primary)" }}
                >
                  {isSubmittingItem ? <RotateCw size={13} className="animate-spin" /> : <Check size={14} />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: STOCK ADJUST (Increase or Decrease)                */}
      {/* ========================================================= */}
      {isAdjustModalOpen && selectedItemForAction && (
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
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center"
                  style={{
                    backgroundColor: "var(--color-brand-primary-light)",
                    color: "var(--color-brand-primary)",
                  }}
                >
                  <SlidersHorizontal size={15} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-800">Adjust Stock</h3>
                  <p className="text-[11px] text-slate-500">{selectedItemForAction.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleConfirmStockAdjust} className="p-5 space-y-4">
              <div
                className="p-3 rounded-md border flex items-center justify-between"
                style={{
                  backgroundColor: "var(--color-bg-subtle)",
                  borderColor: "var(--color-border-base)",
                }}
              >
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-mono tracking-wider">
                    Current Stock in Hand
                  </span>
                  <span className="text-base font-mono font-medium text-slate-900">
                    {selectedItemForAction.stock.toFixed(2)} {selectedItemForAction.unit}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block uppercase font-mono tracking-wider">
                    Buffer Threshold
                  </span>
                  <span className="text-xs font-mono font-normal text-slate-600">
                    {selectedItemForAction.bufferStock} {selectedItemForAction.unit}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1.5">
                  Adjustment Action
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType("increase")}
                    className={`py-2 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      adjustType === "increase"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                    }`}
                  >
                    <ArrowUpRight size={15} />
                    <span>Increase (+)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustType("decrease")}
                    className={`py-2 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      adjustType === "decrease"
                        ? "bg-red-600 text-white shadow-xs"
                        : "bg-red-50 text-red-800 border border-red-200 hover:bg-red-100"
                    }`}
                  >
                    <ArrowDownRight size={15} />
                    <span>Decrease (-)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                  Quantity to {adjustType === "increase" ? "Add" : "Deduct"} ({selectedItemForAction.unit}){" "}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  placeholder="e.g. 5"
                  value={adjustQtyInput}
                  onChange={(e) => setAdjustQtyInput(e.target.value)}
                  required
                  className="w-full text-xs px-3 py-2 rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd] font-mono text-sm"
                  style={{ borderColor: "var(--color-border-base)" }}
                />
              </div>

              <div
                className="p-3 rounded-md border flex items-center justify-between"
                style={{
                  backgroundColor: "var(--color-brand-primary-light)",
                  borderColor: "var(--color-brand-primary-border)",
                }}
              >
                <span className="text-xs text-slate-700">New Resulting Stock:</span>
                <span className="text-sm font-mono font-medium text-[#1d5f9f]">
                  {(
                    selectedItemForAction.stock +
                    (adjustType === "increase" ? Number(adjustQtyInput) || 0 : -(Number(adjustQtyInput) || 0))
                  ).toFixed(2)}{" "}
                  {selectedItemForAction.unit}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                  Reason / Reference Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Vendor procurement delivery, kitchen batch consumption, spillage..."
                  value={adjustReasonInput}
                  onChange={(e) => setAdjustReasonInput(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                  style={{ borderColor: "var(--color-border-base)" }}
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-3.5 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer font-normal"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdjust}
                  className="px-4 py-2 text-xs text-white rounded-md shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 font-normal"
                  style={{ backgroundColor: "var(--color-brand-primary)" }}
                >
                  {isSubmittingAdjust ? <RotateCw size={13} className="animate-spin" /> : <Check size={14} />}
                  <span>Save Stock Adjustment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD / EDIT RECIPE                                  */}
      {/* ========================================================= */}
      {isRecipeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white rounded-xl border shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            <div
              className="px-5 py-4 border-b flex items-center justify-between shrink-0"
              style={{
                borderColor: "var(--color-border-subtle)",
                backgroundColor: "var(--color-bg-subtle)",
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center"
                  style={{
                    backgroundColor: "var(--color-brand-primary-light)",
                    color: "var(--color-brand-primary)",
                  }}
                >
                  <UtensilsCrossed size={16} />
                </div>
                <h3 className="text-sm font-medium text-slate-800">
                  {editingRecipeId ? "Edit Sweet Recipe" : "Create Sweet Recipe"}
                </h3>
              </div>
              <button
                onClick={() => setIsRecipeModalOpen(false)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveRecipe} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                  Select Orderable Product (Search by Name) <span className="text-rose-500">*</span>
                </label>
                <SearchableSelect
                  options={productSelectOptions}
                  value={recipeProductId}
                  onChange={(val) => setRecipeProductId(val)}
                  placeholder="Search sweet product name..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1.5">
                    Recipe Output Unit <span className="text-slate-400 font-normal lowercase">(default: KG)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["KG", "Tray"] as RecipeYieldUnit[]).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setRecipeYieldUnit(u)}
                        className={`py-1.5 px-3 rounded-md text-xs font-mono font-medium transition-all cursor-pointer text-center ${
                          recipeYieldUnit === u
                            ? "bg-[#348bdd] text-white shadow-2xs"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                    Batch Output Yield ({recipeYieldUnit}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    placeholder="1"
                    value={recipeBatchYield}
                    onChange={(e) => setRecipeBatchYield(e.target.value)}
                    required
                    className="w-full text-xs px-3 py-1.5 rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd] font-mono"
                    style={{ borderColor: "var(--color-border-base)" }}
                  />
                </div>
              </div>

              {/* Ingredients List */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-xs font-medium text-slate-800 uppercase tracking-wider block">
                      Recipe Ingredients
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Select raw material items and specify how much is used in this batch
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddIngredientRow}
                    className="px-2.5 py-1 rounded text-[#348bdd] hover:bg-blue-50 text-xs font-normal flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus size={13} />
                    <span>Add Item</span>
                  </button>
                </div>

                {recipeIngredients.length === 0 ? (
                  <div className="p-6 text-center rounded-md border border-dashed border-slate-200 text-xs text-slate-400">
                    No ingredients added yet. Click "+ Add Item" to add raw materials to this recipe.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {recipeIngredients.map((row, idx) => {
                      const selectedItem = items.find((it) => it.id === row.itemId);
                      const unitCost = selectedItem ? selectedItem.amount : 0;
                      const unit = selectedItem ? selectedItem.unit : "KG";
                      const lineCost = selectedItem ? Number((Number(row.quantityUsed || 0) * unitCost).toFixed(2)) : 0;

                      return (
                        <div
                          key={idx}
                          className="p-2 rounded-md border border-slate-200 bg-slate-50/50 flex flex-wrap items-center gap-2"
                        >
                          <div className="flex-1 min-w-[180px]">
                            <select
                              value={row.itemId}
                              onChange={(e) => handleUpdateIngredientRow(idx, "itemId", e.target.value)}
                              className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                            >
                              {items.map((it) => (
                                <option key={it.id} value={it.id}>
                                  {it.name} ({it.unit}) - ₹{it.amount}/{it.unit}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="w-28 flex items-center gap-1">
                            <input
                              type="number"
                              step="any"
                              min="0.001"
                              placeholder="Qty"
                              value={row.quantityUsed}
                              onChange={(e) => handleUpdateIngredientRow(idx, "quantityUsed", e.target.value)}
                              required
                              className="w-full text-xs px-2 py-1.5 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd] font-mono text-right"
                            />
                            <span className="text-[11px] font-mono text-slate-500 shrink-0">{unit}</span>
                          </div>

                          <div className="w-20 text-right font-mono text-xs font-medium text-slate-700">
                            ₹{lineCost}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveIngredientRow(idx)}
                            className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 cursor-pointer"
                            title="Remove Ingredient"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Total Recipe Summary */}
              <div
                className="p-3 rounded-md border flex items-center justify-between"
                style={{
                  backgroundColor: "var(--color-bg-subtle)",
                  borderColor: "var(--color-border-base)",
                }}
              >
                <div>
                  <span className="text-[10px] text-slate-500 block">Total Recipe Cost</span>
                  <span className="text-base font-mono font-medium text-slate-900">
                    ₹{computedRecipeInModal.totalCost.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Cost / {recipeYieldUnit}</span>
                  <span className="text-base font-mono font-medium text-[#348bdd]">
                    ₹{computedRecipeInModal.costPerUnit.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                  Preparation Instructions / Batch Notes <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Sugar syrup string consistency, ghee roasting temperature, cooling duration..."
                  value={recipeInstructions}
                  onChange={(e) => setRecipeInstructions(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                  style={{ borderColor: "var(--color-border-base)" }}
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRecipeModalOpen(false)}
                  className="px-3.5 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer font-normal"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRecipe}
                  className="px-4 py-2 text-xs text-white rounded-md shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 font-normal"
                  style={{ backgroundColor: "var(--color-brand-primary)" }}
                >
                  {isSubmittingRecipe ? <RotateCw size={13} className="animate-spin" /> : <Check size={14} />}
                  <span>{editingRecipeId ? "Update Recipe" : "Save Recipe"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: BATCH SIMULATION / CALCULATOR                      */}
      {/* ========================================================= */}
      {viewingRecipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white rounded-xl border shadow-xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            <div
              className="px-5 py-4 border-b flex items-center justify-between"
              style={{
                borderColor: "var(--color-border-subtle)",
                backgroundColor: "var(--color-bg-subtle)",
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-md flex items-center justify-center"
                  style={{
                    backgroundColor: "var(--color-brand-primary-light)",
                    color: "var(--color-brand-primary)",
                  }}
                >
                  <Calculator size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-800">Production Batch Simulator</h3>
                  <p className="text-[11px] text-slate-500">{viewingRecipe.productName}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingRecipe(null)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div
                className="p-3 rounded-md border flex items-center justify-between gap-4"
                style={{
                  backgroundColor: "var(--color-brand-primary-light)",
                  borderColor: "var(--color-brand-primary-border)",
                }}
              >
                <div>
                  <span className="text-[10px] text-slate-600 uppercase font-mono tracking-wider block">
                    Planned Production Batch
                  </span>
                  <span className="text-xs text-slate-600">Enter output to calculate ingredient requirements</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="any"
                    min="1"
                    value={simBatchQuantity}
                    onChange={(e) => setSimBatchQuantity(e.target.value)}
                    className="w-24 text-xs px-2.5 py-1.5 rounded border border-slate-300 bg-white font-mono font-medium text-right"
                  />
                  <span className="text-xs font-mono font-medium text-slate-700">{viewingRecipe.unit}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-mono uppercase text-slate-500 font-medium tracking-wider block">
                  Required Raw Materials vs Current Stock
                </span>

                <div className="rounded-md border border-slate-200 overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-[10px] font-mono uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Ingredient</th>
                        <th className="py-2 px-3 text-right">Required</th>
                        <th className="py-2 px-3 text-right">In Stock</th>
                        <th className="py-2 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {viewingRecipe.ingredients.map((ing, idx) => {
                        const mult = Number(simBatchQuantity) / (viewingRecipe.batchYield || 1);
                        const requiredQty = Number((ing.quantityUsed * mult).toFixed(3));
                        const liveItem = items.find((it) => it.id === ing.itemId);
                        const inStock = liveItem ? liveItem.stock : 0;
                        const isSufficient = inStock >= requiredQty;

                        return (
                          <tr key={idx} className={!isSufficient ? "bg-red-50/40" : ""}>
                            <td className="py-2 px-3 font-sans font-medium text-slate-800">{ing.itemName}</td>
                            <td className="py-2 px-3 text-right font-medium text-slate-900">
                              {requiredQty} {ing.unit}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-600">
                              {inStock.toFixed(2)} {ing.unit}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {isSufficient ? (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-medium">
                                  ✓ Sufficient
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-red-100 text-red-800 font-medium">
                                  Shortage ({(requiredQty - inStock).toFixed(2)})
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div
                className="p-3 rounded-md border flex items-center justify-between text-xs"
                style={{
                  backgroundColor: "var(--color-bg-subtle)",
                  borderColor: "var(--color-border-base)",
                }}
              >
                <span className="text-slate-600">Total Raw Material Cost for Batch:</span>
                <span className="text-sm font-mono font-medium text-[#348bdd]">
                  ₹
                  {(
                    viewingRecipe.costPerUnit * (Number(simBatchQuantity) || 0)
                  ).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setViewingRecipe(null)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer font-normal"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        title={deleteConfirmation.title}
        message={deleteConfirmation.message}
        confirmText="Delete"
        onConfirm={deleteConfirmation.type === "item" ? handleDeleteItem : handleDeleteRecipe}
        onCancel={() => setDeleteConfirmation((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

// --- SUB-COMPONENTS ---

function StockItemCard({
  item,
  statusColor,
  onAdjust,
  onEdit,
}: {
  item: ManufacturingItem & { ratio: number; deficitOrSurplus: number };
  statusColor: "red" | "orange" | "amber" | "emerald";
  onAdjust: () => void;
  onEdit: () => void;
}) {
  const colorMap = {
    red: {
      badge: "bg-red-50 text-red-700 border-red-200",
      bar: "bg-red-500",
      text: "text-red-700",
    },
    orange: {
      badge: "bg-orange-50 text-orange-700 border-orange-200",
      bar: "bg-orange-500",
      text: "text-orange-700",
    },
    amber: {
      badge: "bg-amber-50 text-amber-800 border-amber-200",
      bar: "bg-amber-500",
      text: "text-amber-800",
    },
    emerald: {
      badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
      bar: "bg-emerald-500",
      text: "text-emerald-700",
    },
  }[statusColor];

  return (
    <div
      className="rounded-lg border bg-white p-3.5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
      style={{ borderColor: "var(--color-border-base)" }}
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <h4 className="text-xs font-medium text-slate-900 leading-snug">{item.name}</h4>
            <span className="text-[10px] text-slate-400 font-mono">
              {item.category || "Raw Material"} • ₹{item.amount}/{item.unit}
            </span>
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${colorMap.badge}`}>
            {statusColor === "red"
              ? "Deficit"
              : statusColor === "orange"
              ? "At Buffer"
              : statusColor === "amber"
              ? "Watchlist"
              : "Healthy"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 p-2 rounded bg-slate-50 border border-slate-100 text-xs mb-2">
          <div>
            <span className="text-[9px] uppercase font-mono text-slate-400 block">Current Stock</span>
            <span className="font-mono font-medium text-slate-900">
              {item.stock.toFixed(2)}{" "}
              <span className="text-[10px] font-normal text-slate-500">{item.unit}</span>
            </span>
          </div>
          <div className="text-right">
            <span className="text-[9px] uppercase font-mono text-slate-400 block">Buffer Threshold</span>
            <span className="font-mono text-slate-600">
              {item.bufferStock}{" "}
              <span className="text-[10px] font-normal text-slate-400">{item.unit}</span>
            </span>
          </div>
        </div>

        <div className="space-y-1 mb-2">
          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span>Stock Health: {item.ratio.toFixed(0)}%</span>
            <span className={colorMap.text}>
              {item.deficitOrSurplus < 0
                ? `Deficit: ${item.deficitOrSurplus} ${item.unit}`
                : `Margin: +${item.deficitOrSurplus} ${item.unit}`}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full ${colorMap.bar}`}
              style={{ width: `${Math.min(100, Math.max(5, item.ratio))}%` }}
            />
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 mt-1">
        <span className="text-[10px] font-mono text-slate-400">
          Valuation: ₹{(item.stock * item.amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onAdjust}
            className="px-2 py-0.5 rounded bg-blue-50 text-[#348bdd] hover:bg-[#348bdd] hover:text-white text-[11px] font-normal transition-colors cursor-pointer"
          >
            Adjust Stock
          </button>
          <button
            onClick={onEdit}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            title="Edit Details"
          >
            <Edit2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

function StockStatusBadge({ status }: { status: StockStatus }) {
  const config = {
    crossed: {
      bg: "bg-red-50 text-red-700 border-red-200",
      label: "Crossed Buffer",
      icon: AlertCircle,
    },
    reached: {
      bg: "bg-orange-50 text-orange-700 border-orange-200",
      label: "Reached Buffer",
      icon: AlertTriangle,
    },
    ready: {
      bg: "bg-amber-50 text-amber-800 border-amber-200",
      label: "Ready to Buffer",
      icon: Clock,
    },
    good: {
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
      label: "Good Quantity",
      icon: CheckCircle2,
    },
  }[status];

  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${config.bg}`}
    >
      <Icon size={11} />
      <span>{config.label}</span>
    </span>
  );
}
