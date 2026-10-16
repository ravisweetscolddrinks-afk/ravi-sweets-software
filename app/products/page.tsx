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
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import OffcanvasDrawer from "@/components/OffcanvasDrawer";
import ConfirmationModal from "@/components/ConfirmationModal";
import ViewDetailsModal from "@/components/ViewDetailsModal";
import SearchableSelect from "@/components/SearchableSelect";
import {
  Plus,
  Search,
  Package,
  Eye,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  Loader2,
  RotateCw,
  Upload,
  Image as ImageIcon,
  Star,
  FileSpreadsheet,
  X,
  Barcode,
  FolderTree,
  ExternalLink,
} from "lucide-react";

export interface ProductItem {
  id: string;
  name: string;
  categoryId?: string;
  categoryName?: string;
  barcode: string;
  shortCode: string;
  unit: "piece" | "KG" | "litre" | string;
  amount: number;
  manufacturingUnitId: string;
  manufacturingUnitName: string;
  packingUnitId: string;
  packingUnitName: string;
  imageUrl?: string;
  costPerPiece?: number | string;
  piecesPerKg?: number | string;
  kgPerTray?: number | string;
  isFavourite?: boolean;
  showInWorksheet?: boolean;
  createdAt?: any;
}

interface DropdownItem {
  id: string;
  name: string;
}

const PAGE_SIZE = 24;

const UNIT_OPTIONS = [
  { value: "piece", label: "Piece" },
  { value: "KG", label: "KG (Kilogram)" },
  { value: "litre", label: "Litre" },
];

export default function ProductsPage() {
  const { showToast } = useToast();

  // State
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dynamic dropdown collections
  const [categories, setCategories] = useState<DropdownItem[]>([]);
  const [manufacturingUnits, setManufacturingUnits] = useState<DropdownItem[]>([]);
  const [packingUnits, setPackingUnits] = useState<DropdownItem[]>([]);

  // Drawer & Modals state
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [viewingProduct, setViewingProduct] = useState<ProductItem | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ProductItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Form fields - NO preselected default values
  const [formData, setFormData] = useState({
    name: "",
    categoryId: "",
    barcode: "",
    shortCode: "",
    unit: "" as "piece" | "KG" | "litre" | "",
    amount: "" as number | "",
    manufacturingUnitId: "",
    packingUnitId: "",
    costPerPiece: "" as number | string,
    piecesPerKg: "" as number | string,
    kgPerTray: "" as number | string,
    isFavourite: false,
    showInWorksheet: false,
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Fetch dropdown options for Categories, Manufacturing Units & Packing Units
  const fetchDropdownOptions = useCallback(async () => {
    try {
      const [catSnap, mfgSnap, packSnap] = await Promise.all([
        getDocs(query(collection(db, "product_categories"), orderBy("name", "asc"))),
        getDocs(query(collection(db, "manufacturing_units"), orderBy("name", "asc"))),
        getDocs(query(collection(db, "packing_units"), orderBy("name", "asc"))),
      ]);

      setCategories(
        catSnap.docs.map((d) => ({
          id: d.id,
          name: (d.data().name as string) || "Unnamed Category",
        }))
      );
      setManufacturingUnits(
        mfgSnap.docs.map((d) => ({
          id: d.id,
          name: (d.data().name as string) || "Unnamed Unit",
        }))
      );
      setPackingUnits(
        packSnap.docs.map((d) => ({
          id: d.id,
          name: (d.data().name as string) || "Unnamed Unit",
        }))
      );
    } catch (err) {
      console.warn("Could not fetch unit dropdowns:", err);
    }
  }, []);

  // Fetch count and products from Firestore
  const fetchProductsData = useCallback(async () => {
    setIsLoading(true);
    try {
      const prodCol = collection(db, "products");

      // Count using getCountFromServer
      try {
        const countSnapshot = await getCountFromServer(prodCol);
        setTotalCount(countSnapshot.data().count);
      } catch (countErr) {
        console.warn("Count query fallback:", countErr);
      }

      // Fetch products
      const q = query(prodCol, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);

      const items: ProductItem[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<ProductItem, "id">),
      }));

      setProducts(items);
      setTotalCount((prev) => (prev > 0 ? prev : items.length));
    } catch (err: any) {
      console.error("Failed to fetch products:", err);
      showToast("Unable to load products: " + (err.message || "Unknown error"), "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchProductsData();
    fetchDropdownOptions();
  }, [fetchProductsData, fetchDropdownOptions]);

  // Search filtering
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase().trim();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.shortCode.toLowerCase().includes(q) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(q)) ||
        (p.manufacturingUnitName && p.manufacturingUnitName.toLowerCase().includes(q)) ||
        (p.packingUnitName && p.packingUnitName.toLowerCase().includes(q))
    );
  }, [products, searchQuery]);

  // Paginated data (24 per page)
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredProducts.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredProducts, currentPage]);

  // Row selection handlers
  const handleToggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    setSelectedIds((prev) => {
      const allSelected = paginatedProducts.every((p) => prev.has(p.id));
      if (allSelected) {
        return new Set();
      } else {
        return new Set(paginatedProducts.map((p) => p.id));
      }
    });
  };

  // Open drawer for Add - NO preselected defaults!
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      name: "",
      categoryId: "",
      barcode: "",
      shortCode: "",
      unit: "",
      amount: "",
      manufacturingUnitId: "",
      packingUnitId: "",
      costPerPiece: "",
      piecesPerKg: "",
      kgPerTray: "",
      isFavourite: false,
      showInWorksheet: false,
    });
    setImageFile(null);
    setImagePreview("");
    setFormErrors({});
    setIsDrawerOpen(true);
  };

  // Open drawer for Edit
  const handleOpenEdit = (p: ProductItem) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      categoryId: p.categoryId || "",
      barcode: p.barcode,
      shortCode: p.shortCode,
      unit: (p.unit as any) || "",
      amount: p.amount,
      manufacturingUnitId: p.manufacturingUnitId || "",
      packingUnitId: p.packingUnitId || "",
      costPerPiece: p.costPerPiece ?? "",
      piecesPerKg: p.piecesPerKg ?? "",
      kgPerTray: p.kgPerTray ?? "",
      isFavourite: !!p.isFavourite,
      showInWorksheet: !!p.showInWorksheet,
    });
    setImageFile(null);
    setImagePreview(p.imageUrl || "");
    setFormErrors({});
    setIsDrawerOpen(true);
  };

  // Image file change
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // Form Validation
  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!formData.name.trim()) errors.name = "Product Name is mandatory";
    if (!formData.categoryId) errors.categoryId = "Category selection is mandatory";
    if (!formData.barcode.trim()) errors.barcode = "Barcode is mandatory";
    if (!formData.shortCode.trim()) errors.shortCode = "Short Code is mandatory";
    if (!formData.unit) errors.unit = "Unit selection is mandatory";
    if (formData.amount === "" || Number(formData.amount) <= 0) {
      errors.amount = "Valid amount is mandatory";
    }
    if (!formData.manufacturingUnitId) {
      errors.manufacturingUnitId = "Manufacturing Unit is mandatory";
    }
    if (!formData.packingUnitId) {
      errors.packingUnitId = "Packing Unit is mandatory";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Upload image to ImageKit via API route
  const uploadToImageKit = async (file: File): Promise<string> => {
    const uploadData = new FormData();
    uploadData.append("file", file);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: uploadData,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || "ImageKit upload failed");
    }

    const data = await res.json();
    return data.url;
  };

  // Save Product (Add or Edit)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      let finalImageUrl = editingProduct?.imageUrl || "";

      // If user selected a new image file, upload to ImageKit
      if (imageFile) {
        showToast("Uploading image to ImageKit...", "info");
        try {
          finalImageUrl = await uploadToImageKit(imageFile);
        } catch (uploadErr: any) {
          console.error("Image upload error:", uploadErr);
          showToast("Failed to upload image: " + uploadErr.message, "error");
          setIsSubmitting(false);
          return;
        }
      }

      // Resolve names from IDs
      const catName =
        categories.find((c) => c.id === formData.categoryId)?.name || "General Category";
      const mfgName =
        manufacturingUnits.find((m) => m.id === formData.manufacturingUnitId)?.name ||
        "Default Manufacturing Unit";
      const packName =
        packingUnits.find((p) => p.id === formData.packingUnitId)?.name ||
        "Default Packing Unit";

      const productPayload = {
        name: formData.name.trim(),
        categoryId: formData.categoryId,
        categoryName: catName,
        barcode: formData.barcode.trim(),
        shortCode: formData.shortCode.trim(),
        unit: formData.unit,
        amount: Number(formData.amount),
        manufacturingUnitId: formData.manufacturingUnitId,
        manufacturingUnitName: mfgName,
        packingUnitId: formData.packingUnitId,
        packingUnitName: packName,
        imageUrl: finalImageUrl,
        costPerPiece: formData.costPerPiece !== "" ? Number(formData.costPerPiece) : "",
        piecesPerKg: formData.piecesPerKg !== "" ? Number(formData.piecesPerKg) : "",
        kgPerTray: formData.kgPerTray !== "" ? Number(formData.kgPerTray) : "",
        isFavourite: formData.isFavourite,
        showInWorksheet: formData.showInWorksheet,
        updatedAt: serverTimestamp(),
      };

      if (editingProduct) {
        // Update product
        const prodRef = doc(db, "products", editingProduct.id);
        await updateDoc(prodRef, productPayload);

        setProducts((prev) =>
          prev.map((p) =>
            p.id === editingProduct.id
              ? {
                  ...p,
                  ...productPayload,
                }
              : p
          )
        );

        showToast(`Product "${formData.name.trim()}" updated successfully!`, "success");
      } else {
        // Add new product
        const prodCol = collection(db, "products");
        const docRef = await addDoc(prodCol, {
          ...productPayload,
          createdAt: serverTimestamp(),
        });

        const newProduct: ProductItem = {
          id: docRef.id,
          ...productPayload,
          createdAt: Timestamp.now(),
        };

        setProducts((prev) => [newProduct, ...prev]);
        setTotalCount((prev) => prev + 1);

        showToast(`Product "${formData.name.trim()}" saved successfully!`, "success");
      }

      setIsDrawerOpen(false);
    } catch (err: any) {
      console.error("Save product error:", err);
      showToast("Error saving product: " + (err.message || "Unknown error"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Product
  const handleConfirmDelete = async () => {
    if (!deletingProduct) return;

    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "products", deletingProduct.id));

      setProducts((prev) => prev.filter((p) => p.id !== deletingProduct.id));
      setTotalCount((prev) => Math.max(0, prev - 1));

      showToast(`Product "${deletingProduct.name}" deleted successfully`, "info");
      setDeletingProduct(null);
    } catch (err: any) {
      console.error("Delete error:", err);
      showToast("Error deleting product: " + (err.message || "Unknown error"), "error");
    } finally {
      setIsDeleting(false);
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

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
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
              <Package size={18} />
            </div>
            <h1
              className="text-2xl text-[var(--color-text-primary)] tracking-tight"
              style={{ fontWeight: 500 }}
            >
              Products
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
            Manage inventory catalogue, selling prices, barcodes, units, and manufacturing mappings.
          </p>
        </div>

        {/* Actions: Refresh & Add Product Button */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchProductsData}
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
            <span>Add Product</span>
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
            placeholder="Search by name, barcode, code, category..."
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
          Showing {paginatedProducts.length} of {filteredProducts.length} (Limit: 24/page)
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
              Loading products from Firestore...
            </span>
          </div>
        ) : paginatedProducts.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center p-6">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                color: "var(--color-text-muted)",
              }}
            >
              <Package size={22} />
            </div>
            <h3
              className="text-sm text-[var(--color-text-primary)]"
              style={{ fontWeight: 500 }}
            >
              {searchQuery ? "No matching products found" : "No products added yet"}
            </h3>
            <p className="text-xs mt-1 max-w-sm" style={{ color: "var(--color-text-muted)" }}>
              {searchQuery
                ? "Try searching for a different term or clear the filter."
                : "Get started by adding your first sweet or snack product."}
            </p>
            {!searchQuery && (
              <button
                onClick={handleOpenAdd}
                className="mt-4 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md text-white font-normal cursor-pointer"
                style={{ backgroundColor: "var(--color-brand-primary)" }}
              >
                <Plus size={14} />
                <span>Add Product Now</span>
              </button>
            )}
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
                  {/* Select All Checkbox */}
                  <th className="w-10 px-3 py-2 text-center bg-slate-50/50">
                    <input
                      type="checkbox"
                      checked={
                        paginatedProducts.length > 0 &&
                        paginatedProducts.every((p) => selectedIds.has(p.id))
                      }
                      onChange={handleToggleSelectAll}
                      className="rounded border-slate-300 text-[var(--color-brand-primary)] focus:ring-0 cursor-pointer h-3.5 w-3.5"
                    />
                  </th>

                  {/* ID */}
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800">id</span>
                        <span className="text-[10px] font-mono text-slate-400">uuid</span>
                      </div>
                      <ChevronDown size={12} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>

                  {/* Image */}
                  <th className="px-3 py-2 font-medium bg-slate-50/50 w-12 text-center">
                    <span className="font-medium text-slate-800">image</span>
                  </th>

                  {/* Name */}
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50 min-w-[150px]">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800">name</span>
                        <span className="text-[10px] font-mono text-slate-400">text</span>
                      </div>
                      <ChevronDown size={12} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>

                  {/* Category */}
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800">category</span>
                        <span className="text-[10px] font-mono text-slate-400">text</span>
                      </div>
                      <ChevronDown size={12} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>

                  {/* Barcode */}
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800">barcode</span>
                        <span className="text-[10px] font-mono text-slate-400">varchar</span>
                      </div>
                      <ChevronDown size={12} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>

                  {/* Short Code */}
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800">short_code</span>
                        <span className="text-[10px] font-mono text-slate-400">varchar</span>
                      </div>
                      <ChevronDown size={12} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>

                  {/* Unit */}
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800">unit</span>
                        <span className="text-[10px] font-mono text-slate-400">varchar</span>
                      </div>
                      <ChevronDown size={12} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>

                  {/* Amount / Price */}
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="font-medium text-slate-800">amount</span>
                      <span className="text-[10px] font-mono text-slate-400">numeric</span>
                    </div>
                  </th>

                  {/* Manufacturing Unit */}
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800">mfg_unit</span>
                        <span className="text-[10px] font-mono text-slate-400">text</span>
                      </div>
                      <ChevronDown size={12} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>

                  {/* Packing Unit */}
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800">packing_unit</span>
                        <span className="text-[10px] font-mono text-slate-400">text</span>
                      </div>
                      <ChevronDown size={12} className="text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>

                  {/* Flags (Favourite / Worksheet) */}
                  <th className="px-3 py-2 font-medium bg-slate-50/50 text-center w-16">
                    <span className="font-medium text-slate-800">flags</span>
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
                {paginatedProducts.map((p) => {
                  const isSelected = selectedIds.has(p.id);
                  return (
                    <tr
                      key={p.id}
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
                          onChange={() => handleToggleSelectRow(p.id)}
                          className="rounded border-slate-300 text-[var(--color-brand-primary)] focus:ring-0 cursor-pointer h-3.5 w-3.5"
                        />
                      </td>

                      {/* ID with Arrow Button */}
                      <td className="px-3.5 py-2 font-mono text-[11px] text-slate-600">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate max-w-[100px]">{p.id}</span>
                          <button
                            onClick={() => setViewingProduct(p)}
                            className="w-5 h-5 rounded flex items-center justify-center bg-slate-100 hover:bg-sky-50 text-slate-500 hover:text-[#348bdd] border border-slate-200/70 transition-colors cursor-pointer"
                            title="View product details"
                          >
                            <ArrowRight size={11} />
                          </button>
                        </div>
                      </td>

                      {/* Image Thumbnail */}
                      <td className="px-2 py-1.5 text-center">
                        <img
                          src={p.imageUrl || "/logo.png"}
                          alt={p.name}
                          className="w-7 h-7 rounded object-contain border border-slate-200 mx-auto bg-white p-0.5 shadow-2xs"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/logo.png";
                          }}
                        />
                      </td>

                      {/* Name */}
                      <td className="px-3.5 py-2 text-slate-900 font-medium">
                        {p.name}
                      </td>

                      {/* Category */}
                      <td className="px-3.5 py-2 text-slate-700 truncate max-w-[120px]">
                        {p.categoryName || <span className="font-mono text-slate-300 italic text-[11px]">NULL</span>}
                      </td>

                      {/* Barcode */}
                      <td className="px-3.5 py-2 font-mono text-[11px] text-slate-700">
                        {p.barcode || <span className="font-mono text-slate-300 italic text-[11px]">NULL</span>}
                      </td>

                      {/* Short Code */}
                      <td className="px-3.5 py-2 font-mono text-[11px] text-slate-700">
                        {p.shortCode || <span className="font-mono text-slate-300 italic text-[11px]">NULL</span>}
                      </td>

                      {/* Unit */}
                      <td className="px-3.5 py-2 text-slate-700 font-mono text-[11px]">
                        {p.unit ? (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[10px]">
                            {p.unit}
                          </span>
                        ) : (
                          <span className="font-mono text-slate-300 italic text-[11px]">NULL</span>
                        )}
                      </td>

                      {/* Amount / Price */}
                      <td className="px-3.5 py-2 text-right font-mono text-slate-900 font-medium">
                        ₹{Number(p.amount).toFixed(2)}
                      </td>

                      {/* Manufacturing Unit */}
                      <td className="px-3.5 py-2 text-slate-700 truncate max-w-[120px]">
                        {p.manufacturingUnitName || <span className="font-mono text-slate-300 italic text-[11px]">NULL</span>}
                      </td>

                      {/* Packing Unit */}
                      <td className="px-3.5 py-2 text-slate-700 truncate max-w-[120px]">
                        {p.packingUnitName || <span className="font-mono text-slate-300 italic text-[11px]">NULL</span>}
                      </td>

                      {/* Flags (Favourite / Worksheet) */}
                      <td className="px-2 py-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {p.isFavourite && (
                            <span title="Favourite" className="text-amber-500">
                              <Star size={13} fill="currentColor" />
                            </span>
                          )}
                          {p.showInWorksheet && (
                            <span title="In Worksheet" className="text-emerald-600">
                              <FileSpreadsheet size={13} />
                            </span>
                          )}
                          {!p.isFavourite && !p.showInWorksheet && (
                            <span className="text-slate-300 font-mono text-[10px]">—</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View - Primary Blue */}
                          <button
                            onClick={() => setViewingProduct(p)}
                            className="w-7 h-7 rounded-md flex items-center justify-center transition-all bg-sky-50 text-[#348bdd] hover:bg-sky-100 hover:text-[#2377c8] border border-sky-100 cursor-pointer shadow-2xs"
                            title="View details"
                          >
                            <Eye size={13} />
                          </button>

                          {/* Edit - Amber */}
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="w-7 h-7 rounded-md flex items-center justify-center transition-all bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 border border-amber-100 cursor-pointer shadow-2xs"
                            title="Edit"
                          >
                            <Edit2 size={13} />
                          </button>

                          {/* Delete - Rose */}
                          <button
                            onClick={() => setDeletingProduct(p)}
                            className="w-7 h-7 rounded-md flex items-center justify-center transition-all bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 border border-rose-100 cursor-pointer shadow-2xs"
                            title="Delete"
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
        {!isLoading && filteredProducts.length > 0 && (
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

      {/* Offcanvas Drawer for Add / Edit Product */}
      <OffcanvasDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingProduct ? "Edit Product" : "Add New Product"}
        subtitle={
          editingProduct
            ? `Update details for "${editingProduct.name}"`
            : "Fill in the product specifications to create a new record."
        }
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          {/* Product Image (Optional) */}
          <div>
            <label
              className="block text-xs uppercase tracking-wider mb-1.5"
              style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
            >
              Product Image <span className="text-slate-400 font-normal lowercase">(optional)</span>
            </label>

            <div className="flex items-center gap-3">
              {imagePreview ? (
                <div className="relative w-16 h-16 rounded-lg border border-slate-200 overflow-hidden shrink-0 group">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview("");
                    }}
                    className="absolute top-1 right-1 p-0.5 bg-black/60 rounded-full text-white hover:bg-red-600 transition-colors cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <label className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 hover:border-[var(--color-brand-primary)] bg-slate-50/70 flex flex-col items-center justify-center cursor-pointer transition-colors shrink-0">
                  <Upload size={16} className="text-slate-400" />
                  <span className="text-[9px] text-slate-400 mt-0.5">Upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}

              <div className="text-[11px] text-slate-500 leading-snug">
                Supported formats: JPG, PNG, WebP. Automatically hosted and optimized on ImageKit CDN upon saving.
              </div>
            </div>
          </div>

          <div className="border-t my-2" style={{ borderColor: "var(--color-border-subtle)" }} />

          {/* Mandatory Fields Group */}
          <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-wider font-mono text-slate-400">
              Mandatory Details
            </div>

            {/* Name */}
            <div>
              <label
                className="block text-xs uppercase tracking-wider mb-1"
                style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
              >
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Kaju Katli (Special Pure Ghee)"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (formErrors.name) setFormErrors({ ...formErrors, name: "" });
                }}
                className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                style={{
                  borderColor: formErrors.name ? "#f87171" : "var(--color-border-base)",
                  color: "var(--color-text-primary)",
                }}
              />
              {formErrors.name && (
                <p className="text-[11px] text-red-500 mt-1">{formErrors.name}</p>
              )}
            </div>

            {/* Category Dropdown (Searchable, No preselected default) */}
            <div>
              <label
                className="block text-xs uppercase tracking-wider mb-1"
                style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
              >
                Category <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={categories.map((c) => ({
                  value: c.id,
                  label: c.name,
                }))}
                value={formData.categoryId}
                onChange={(val) => {
                  setFormData({ ...formData, categoryId: val });
                  if (formErrors.categoryId) setFormErrors({ ...formErrors, categoryId: "" });
                }}
                placeholder="Select Category..."
                error={formErrors.categoryId}
              />
            </div>

            {/* Barcode & Short Code */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="block text-xs uppercase tracking-wider mb-1"
                  style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
                >
                  Barcode <span className="text-red-500">*</span>
                </label>
                <div
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md border bg-white focus-within:ring-1 focus-within:ring-[var(--color-brand-primary)]"
                  style={{
                    borderColor: formErrors.barcode ? "#f87171" : "var(--color-border-base)",
                  }}
                >
                  <Barcode size={14} className="text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="89012345678"
                    value={formData.barcode}
                    onChange={(e) => {
                      setFormData({ ...formData, barcode: e.target.value });
                      if (formErrors.barcode) setFormErrors({ ...formErrors, barcode: "" });
                    }}
                    className="w-full text-xs bg-transparent focus:outline-none font-mono"
                    style={{ color: "var(--color-text-primary)" }}
                  />
                </div>
                {formErrors.barcode && (
                  <p className="text-[11px] text-red-500 mt-1">{formErrors.barcode}</p>
                )}
              </div>

              <div>
                <label
                  className="block text-xs uppercase tracking-wider mb-1"
                  style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
                >
                  Short Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="KK-01"
                  value={formData.shortCode}
                  onChange={(e) => {
                    setFormData({ ...formData, shortCode: e.target.value.toUpperCase() });
                    if (formErrors.shortCode) setFormErrors({ ...formErrors, shortCode: "" });
                  }}
                  className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)] font-mono"
                  style={{
                    borderColor: formErrors.shortCode ? "#f87171" : "var(--color-border-base)",
                    color: "var(--color-text-primary)",
                  }}
                />
                {formErrors.shortCode && (
                  <p className="text-[11px] text-red-500 mt-1">{formErrors.shortCode}</p>
                )}
              </div>
            </div>

            {/* Unit & Amount */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="block text-xs uppercase tracking-wider mb-1"
                  style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
                >
                  Unit <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  options={UNIT_OPTIONS}
                  value={formData.unit}
                  onChange={(val) => {
                    setFormData({ ...formData, unit: val as any });
                    if (formErrors.unit) setFormErrors({ ...formErrors, unit: "" });
                  }}
                  placeholder="Select Unit..."
                  error={formErrors.unit}
                />
              </div>

              <div>
                <label
                  className="block text-xs uppercase tracking-wider mb-1"
                  style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
                >
                  Amount (₹) <span className="text-red-500">*</span>
                </label>
                <div
                  className="flex items-center gap-1 px-3 py-2 rounded-md border bg-white focus-within:ring-1 focus-within:ring-[var(--color-brand-primary)]"
                  style={{
                    borderColor: formErrors.amount ? "#f87171" : "var(--color-border-base)",
                  }}
                >
                  <span className="text-slate-400 text-xs">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Enter amount"
                    value={formData.amount}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        amount: e.target.value === "" ? "" : Number(e.target.value),
                      });
                      if (formErrors.amount) setFormErrors({ ...formErrors, amount: "" });
                    }}
                    className="w-full text-xs bg-transparent focus:outline-none font-mono"
                    style={{ color: "var(--color-text-primary)" }}
                  />
                </div>
                {formErrors.amount && (
                  <p className="text-[11px] text-red-500 mt-1">{formErrors.amount}</p>
                )}
              </div>
            </div>

            {/* Manufacturing Unit & Packing Unit Dropdowns */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="block text-xs uppercase tracking-wider mb-1"
                  style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
                >
                  Manufacturing Unit <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  options={manufacturingUnits.map((m) => ({
                    value: m.id,
                    label: m.name,
                  }))}
                  value={formData.manufacturingUnitId}
                  onChange={(val) => {
                    setFormData({ ...formData, manufacturingUnitId: val });
                    if (formErrors.manufacturingUnitId) {
                      setFormErrors({ ...formErrors, manufacturingUnitId: "" });
                    }
                  }}
                  placeholder="Select Manufacturing Unit..."
                  error={formErrors.manufacturingUnitId}
                />
              </div>

              <div>
                <label
                  className="block text-xs uppercase tracking-wider mb-1"
                  style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
                >
                  Packing Unit <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  options={packingUnits.map((p) => ({
                    value: p.id,
                    label: p.name,
                  }))}
                  value={formData.packingUnitId}
                  onChange={(val) => {
                    setFormData({ ...formData, packingUnitId: val });
                    if (formErrors.packingUnitId) {
                      setFormErrors({ ...formErrors, packingUnitId: "" });
                    }
                  }}
                  placeholder="Select Packing Unit..."
                  error={formErrors.packingUnitId}
                />
              </div>
            </div>
          </div>

          <div className="border-t my-3" style={{ borderColor: "var(--color-border-subtle)" }} />

          {/* Optional Production & Batch Metrics */}
          <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-wider font-mono text-slate-400">
              Batch & Cost Metrics (Optional)
            </div>

            {/* Cost of one piece */}
            <div>
              <label
                className="block text-xs uppercase tracking-wider mb-1"
                style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
              >
                Cost of one piece (₹)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="Enter cost per piece"
                value={formData.costPerPiece}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    costPerPiece: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
                className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)] font-mono"
                style={{
                  borderColor: "var(--color-border-base)",
                  color: "var(--color-text-primary)",
                }}
              />
            </div>

            {/* Pieces for KG & KG for one Tray */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="block text-xs uppercase tracking-wider mb-1"
                  style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
                >
                  Pieces for KG
                </label>
                <input
                  type="number"
                  placeholder="Enter pieces count"
                  value={formData.piecesPerKg}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      piecesPerKg: e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                  className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)] font-mono"
                  style={{
                    borderColor: "var(--color-border-base)",
                    color: "var(--color-text-primary)",
                  }}
                />
              </div>

              <div>
                <label
                  className="block text-xs uppercase tracking-wider mb-1"
                  style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
                >
                  KG for one Tray
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Enter KG capacity"
                  value={formData.kgPerTray}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      kgPerTray: e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                  className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)] font-mono"
                  style={{
                    borderColor: "var(--color-border-base)",
                    color: "var(--color-text-primary)",
                  }}
                />
              </div>
            </div>

            {/* Add to Favourite & Show in Worksheet Checkboxes */}
            <div className="pt-2 space-y-2">
              <label className="flex items-center gap-2.5 p-2 rounded-md border bg-slate-50/60 hover:bg-slate-50 cursor-pointer transition-colors" style={{ borderColor: "var(--color-border-base)" }}>
                <input
                  type="checkbox"
                  checked={formData.isFavourite}
                  onChange={(e) =>
                    setFormData({ ...formData, isFavourite: e.target.checked })
                  }
                  className="rounded border-slate-300 text-[var(--color-brand-primary)] focus:ring-0 cursor-pointer h-4 w-4"
                />
                <div>
                  <div className="text-xs text-[var(--color-text-primary)]" style={{ fontWeight: 500 }}>
                    Add to favourite
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Quickly accessible on POS counter fast-pick menu
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2 rounded-md border bg-slate-50/60 hover:bg-slate-50 cursor-pointer transition-colors" style={{ borderColor: "var(--color-border-base)" }}>
                <input
                  type="checkbox"
                  checked={formData.showInWorksheet}
                  onChange={(e) =>
                    setFormData({ ...formData, showInWorksheet: e.target.checked })
                  }
                  className="rounded border-slate-300 text-[var(--color-brand-primary)] focus:ring-0 cursor-pointer h-4 w-4"
                />
                <div>
                  <div className="text-xs text-[var(--color-text-primary)]" style={{ fontWeight: 500 }}>
                    Show in Worksheet
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Display item in daily manufacturing production worksheets
                  </div>
                </div>
              </label>
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
              <span>{editingProduct ? "Update Product" : "Save Product"}</span>
            </button>
          </div>
        </form>
      </OffcanvasDrawer>

      {/* View Product Details Modal */}
      <ViewDetailsModal
        isOpen={!!viewingProduct}
        onClose={() => setViewingProduct(null)}
        title={viewingProduct?.name || "Product Details"}
        badge="PRODUCT SPECIFICATION"
        image={viewingProduct?.imageUrl || "/logo.png"}
        fields={[
          { label: "PRODUCT ID", value: viewingProduct?.id },
          { label: "NAME", value: viewingProduct?.name },
          { label: "CATEGORY", value: viewingProduct?.categoryName || "—" },
          { label: "BARCODE", value: viewingProduct?.barcode },
          { label: "SHORT CODE", value: viewingProduct?.shortCode },
          { label: "UNIT", value: viewingProduct?.unit },
          { label: "SELLING PRICE", value: viewingProduct ? `₹${Number(viewingProduct.amount).toFixed(2)}` : "" },
          { label: "MANUFACTURING UNIT", value: viewingProduct?.manufacturingUnitName },
          { label: "PACKING UNIT", value: viewingProduct?.packingUnitName },
          { label: "COST OF ONE PIECE", value: viewingProduct?.costPerPiece ? `₹${viewingProduct.costPerPiece}` : "—" },
          { label: "PIECES PER KG", value: viewingProduct?.piecesPerKg ? `${viewingProduct.piecesPerKg} pcs` : "—" },
          { label: "KG PER TRAY", value: viewingProduct?.kgPerTray ? `${viewingProduct.kgPerTray} KG` : "—" },
          { label: "FAVOURITE", value: viewingProduct?.isFavourite ? "Yes (Pinned)" : "No" },
          { label: "IN WORKSHEET", value: viewingProduct?.showInWorksheet ? "Yes (Active)" : "No" },
          {
            label: "PRODUCT IMAGE",
            colSpan: 2,
            value: (
              <div className="flex items-center gap-3">
                <img
                  src={viewingProduct?.imageUrl || "/logo.png"}
                  alt={viewingProduct?.name || "Product"}
                  className="w-12 h-12 rounded-lg object-contain border border-slate-200 bg-white p-0.5 shadow-2xs"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/logo.png";
                  }}
                />
                <div className="space-y-0.5">
                  <div className="text-xs text-slate-800 font-medium">
                    {viewingProduct?.imageUrl ? "Hosted on ImageKit" : "Default Brand Logo (logo.png)"}
                  </div>
                  <a
                    href={viewingProduct?.imageUrl || "/logo.png"}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#348bdd] hover:underline inline-flex items-center gap-1 font-mono"
                  >
                    <span>View full size</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            ),
          },
          { label: "CREATED ON", value: formatDate(viewingProduct?.createdAt) },
        ]}
      />

      {/* Custom Confirmation Modal for Delete */}
      <ConfirmationModal
        isOpen={!!deletingProduct}
        title="Delete Product"
        message={`Are you sure you want to delete "${deletingProduct?.name}"? This action cannot be undone.`}
        confirmText="Confirm Delete"
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingProduct(null)}
      />
    </div>
  );
}
