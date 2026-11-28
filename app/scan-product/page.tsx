"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  searchSimilarProducts,
  MatchedProduct,
} from "@/lib/searchSimilarProducts";
import { generateAllProductEmbeddings } from "@/lib/generateProductEmbeddings";
import {
  Scan,
  Camera,
  SwitchCamera,
  Upload,
  Sparkles,
  RotateCw,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Store,
  Layers,
  ArrowRight,
  RefreshCw,
  Sliders,
  Check,
  Package,
  History,
  X,
  Boxes,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface StoreOption {
  id: string;
  name: string;
  phone?: string;
  address?: string;
}

interface ProductItem {
  id: string;
  name: string;
  unit: string; // "piece" | "KG" | "litre" | "Tray"
  amount: number;
  imageUrl?: string;
  categoryName?: string;
  barcode?: string;
  shortCode?: string;
  piecesPerKg?: number | string;
  kgPerTray?: number | string;
  imageEmbedding?: number[];
  [key: string]: any;
}

interface InventoryRecord {
  id: string;
  storeId: string;
  productId: string;
  productName: string;
  quantity: number;
  calculatedKg: number;
  unit: string;
  lastUpdated?: any;
  lastNote?: string;
}

interface RecentStockAddLog {
  id: string;
  productName: string;
  productId: string;
  inputQty: number;
  inputUnit: string;
  calculatedKg: number;
  storeName: string;
  time: string;
}

export default function ScanProductPage() {
  const { showToast } = useToast();

  // 1. Data States
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [inventoryMap, setInventoryMap] = useState<Map<string, InventoryRecord>>(new Map());
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);

  // 2. Camera & Scanner States
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isCameraActive, setIsCameraActive] = useState<boolean>(true);
  const [isCameraLoading, setIsCameraLoading] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedPreviewUrl, setScannedPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisStatus, setAnalysisStatus] = useState<string>("");

  // 3. Matched Results State
  const [matchedProducts, setMatchedProducts] = useState<MatchedProduct[]>([]);
  const [hasScannedOnce, setHasScannedOnce] = useState<boolean>(false);

  // 4. Per-Product Stock Input State (Quantity & Unit)
  const [stockInputs, setStockInputs] = useState<
    Record<string, { quantity: string; unit: "KG" | "Tray" | "litre" | "piece" }>
  >({});
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [recentLogs, setRecentLogs] = useState<RecentStockAddLog[]>([]);

  // 5. Embedding Generation / Sync Modal State
  const [isSyncingEmbeddings, setIsSyncingEmbeddings] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<{ done: number; total: number; current?: string }>({
    done: 0,
    total: 0,
  });
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // --- Real-Time Subscriptions ---
  useEffect(() => {
    setIsLoadingData(true);

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

    // Catalog Products
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
          imageEmbedding: d.data().imageEmbedding,
        }));
        setProducts(pList);
        setIsLoadingData(false);
      },
      (err) => {
        console.error("Products error:", err);
        setIsLoadingData(false);
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
      (err) => console.warn("Inventory error:", err)
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

  // Products with and without embeddings count
  const embeddingStats = useMemo(() => {
    const withImages = products.filter((p) => Boolean(p.imageUrl));
    const withEmbeddings = withImages.filter(
      (p) => Array.isArray(p.imageEmbedding) && p.imageEmbedding.length > 0
    );
    return {
      total: products.length,
      withImages: withImages.length,
      withEmbeddings: withEmbeddings.length,
      missingEmbeddings: withImages.length - withEmbeddings.length,
    };
  }, [products]);

  // --- Camera Management ---

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCameraStream = useCallback(
    async (mode: "environment" | "user") => {
      setIsCameraLoading(true);
      setCameraError(null);
      stopCameraStream();

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera API is not supported in this browser environment");
        }

        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch {
          // Fallback to any default video device
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setIsCameraLoading(false);
      } catch (err: any) {
        console.error("Camera access error:", err);
        setIsCameraLoading(false);
        setCameraError(
          err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
            ? "Camera permission denied. Please allow camera permissions or upload an image."
            : err.message || "Failed to start camera"
        );
      }
    },
    [stopCameraStream]
  );

  useEffect(() => {
    if (isCameraActive) {
      startCameraStream(facingMode);
    } else {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [isCameraActive, facingMode, startCameraStream, stopCameraStream]);

  // Toggle front/back camera
  const handleToggleCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // --- Visual AI Scanning ---

  const handleScanFromVideo = async () => {
    if (!videoRef.current || isAnalyzing) return;

    try {
      setIsAnalyzing(true);
      setAnalysisStatus("Capturing frame and running MobileNet AI...");

      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context failed");

      if (facingMode === "user") {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Create preview URL
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setScannedPreviewUrl(dataUrl);

      // Search similar products via MobileNet embeddings
      const matches = await searchSimilarProducts(canvas, 6, products);

      setMatchedProducts(matches);
      setHasScannedOnce(true);

      if (matches.length > 0) {
        showToast(
          `Found ${matches.length} matching product(s)! Best match: ${matches[0].name} (${matches[0].similarity}%)`,
          "success"
        );
      } else {
        showToast("No products matched. Ensure products have AI embeddings generated.", "info");
      }
    } catch (err: any) {
      console.error("Scanning error:", err);
      showToast("Scan failed: " + err.message, "error");
    } finally {
      setIsAnalyzing(false);
      setAnalysisStatus("");
    }
  };

  // Handle uploaded file scan
  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsAnalyzing(true);
      setAnalysisStatus("Processing uploaded image with MobileNet...");

      const previewUrl = URL.createObjectURL(file);
      setScannedPreviewUrl(previewUrl);

      const img = new Image();
      img.src = previewUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load uploaded image"));
      });

      const matches = await searchSimilarProducts(img, 6, products);
      setMatchedProducts(matches);
      setHasScannedOnce(true);

      if (matches.length > 0) {
        showToast(
          `Identified ${matches.length} matching sweet(s)! Top match: ${matches[0].name} (${matches[0].similarity}%)`,
          "success"
        );
      } else {
        showToast("No product embeddings matched this image.", "info");
      }
    } catch (err: any) {
      console.error("File scan error:", err);
      showToast("Failed to process image: " + err.message, "error");
    } finally {
      setIsAnalyzing(false);
      setAnalysisStatus("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // --- Helper Calculations for Stock Unit Conversion ---

  const convertInputToKg = useCallback((product: ProductItem, qty: number, unit: string): number => {
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
  }, []);

  const convertToNativeUnit = useCallback(
    (product: ProductItem, qty: number, unit: string): number => {
      const nativeU = (product.unit || "piece").toLowerCase().trim();
      const inputU = unit.toLowerCase().trim();

      if (nativeU === inputU) return qty;

      const kg = convertInputToKg(product, qty, unit);

      if (
        nativeU === "kg" ||
        nativeU.includes("kilo") ||
        nativeU === "litre" ||
        nativeU === "liter" ||
        nativeU === "ltr"
      ) {
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

  const calculateKg = useCallback((product: ProductItem, nativeQty: number): number => {
    const u = (product.unit || "piece").toLowerCase().trim();
    if (u === "kg" || u.includes("kilo") || u === "litre" || u === "liter" || u === "ltr") {
      return nativeQty;
    }
    if (u === "tray" || u.includes("tray")) {
      const kpt = Number(product.kgPerTray) || 2.5;
      return Number((nativeQty * kpt).toFixed(2));
    }
    if (u === "piece" || u === "pieces" || u === "pcs") {
      const ppk = Number(product.piecesPerKg) || 20;
      return Number((nativeQty / ppk).toFixed(2));
    }
    return nativeQty;
  }, []);

  // Retrieve input state for a matched product
  const getProductInput = (product: ProductItem) => {
    const existing = stockInputs[product.id];
    if (existing) return existing;
    return {
      quantity: "1",
      unit: "Tray" as "KG" | "Tray" | "litre" | "piece",
    };
  };

  const handleStockInputChange = (
    productId: string,
    field: "quantity" | "unit",
    value: any
  ) => {
    setStockInputs((prev) => {
      const current = prev[productId] || { quantity: "1", unit: "Tray" };
      return {
        ...prev,
        [productId]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  // --- Add Stock to Store Stock Analysis (store_inventory) ---

  const handleAddStockToProduct = async (product: MatchedProduct) => {
    if (!selectedStoreId) {
      showToast("Please choose a retail store first", "error");
      return;
    }

    const input = getProductInput(product);
    const numQty = Number(input.quantity);
    if (isNaN(numQty) || numQty <= 0) {
      showToast("Please enter a valid stock quantity", "error");
      return;
    }

    setSavingProductId(product.id);

    try {
      const invDocId = `${selectedStoreId}_${product.id}`;
      const existingInv = inventoryMap.get(invDocId);
      const currentNativeQty = existingInv?.quantity || 0;

      const incomingNativeQty = convertToNativeUnit(product, numQty, input.unit);
      const incomingKg = convertInputToKg(product, numQty, input.unit);

      const newNativeQty = currentNativeQty + incomingNativeQty;
      const newCalculatedKg = calculateKg(product, newNativeQty);

      // Save to store_inventory (Store Stock Analysis)
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
          lastNote: `AI Scan Inward: +${numQty} ${input.unit} (~${incomingKg} KG)`,
        },
        { merge: true }
      );

      // Log in recent additions
      const newLog: RecentStockAddLog = {
        id: `scan_${Date.now()}`,
        productName: product.name,
        productId: product.id,
        inputQty: numQty,
        inputUnit: input.unit,
        calculatedKg: incomingKg,
        storeName: currentStore?.name || "Store",
        time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      };
      setRecentLogs((prev) => [newLog, ...prev].slice(0, 8));

      // Reset input back to 1
      setStockInputs((prev) => ({
        ...prev,
        [product.id]: {
          quantity: "1",
          unit: input.unit,
        },
      }));

      showToast(
        `✓ ${product.name}: Added ${numQty} ${input.unit} (~${incomingKg} KG) to ${currentStore?.name || "Store Stock"}!`,
        "success"
      );
    } catch (err: any) {
      console.error("Error updating store stock:", err);
      showToast("Failed to add stock: " + err.message, "error");
    } finally {
      setSavingProductId(null);
    }
  };

  // --- Background Product Embeddings Sync ---

  const handleStartGenerateEmbeddings = async (force: boolean = false) => {
    try {
      setIsSyncingEmbeddings(true);
      setSyncProgress({ done: 0, total: products.length });

      const result = await generateAllProductEmbeddings((done, total, current) => {
        setSyncProgress({ done, total, current });
      }, force);

      showToast(
        `AI embeddings sync complete! Processed ${result.done} products (${result.updatedCount} newly embedded).`,
        "success"
      );
      setIsSyncModalOpen(false);
    } catch (err: any) {
      console.error("Sync embeddings error:", err);
      showToast("Embeddings generation error: " + err.message, "error");
    } finally {
      setIsSyncingEmbeddings(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full space-y-6">
      {/* 1. Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b"
        style={{ borderColor: "var(--color-border-subtle)" }}
      >
        <div>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white"
              style={{ backgroundColor: "var(--color-brand-primary)" }}
            >
              <Scan size={18} />
            </div>
            <h1
              className="text-2xl text-[var(--color-text-primary)] tracking-tight"
              style={{ fontWeight: 500 }}
            >
              Scan Product
            </h1>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-mono">
              <Sparkles size={11} className="text-[#348bdd]" />
              MobileNet AI
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            Scan sweets and snacks with live camera. TensorFlow.js recognizes the product from catalog
            images and allows you to instantly add stock in KG, Tray, Litre, or Piece.
          </p>
        </div>

        {/* Store Selector & AI Sync Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Store Selector */}
          <div className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg p-1">
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

          {/* Sync Embeddings Modal Trigger */}
          <button
            type="button"
            onClick={() => setIsSyncModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border font-normal cursor-pointer bg-white hover:bg-slate-50 transition-colors shadow-2xs border-slate-200 text-slate-700"
            title="Generate or update AI embeddings for products"
          >
            <Sparkles size={13} className="text-[#348bdd]" />
            <span>
              {embeddingStats.missingEmbeddings > 0
                ? `Sync AI (${embeddingStats.missingEmbeddings} unindexed)`
                : "AI Index (100% Ready)"}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Notice if some products are not indexed yet */}
      {embeddingStats.missingEmbeddings > 0 && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-600 shrink-0" />
            <span>
              <strong>{embeddingStats.missingEmbeddings} products</strong> don't have MobileNet visual
              embeddings yet. Generate them once so the AI can recognize all your sweets.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsSyncModalOpen(true)}
            className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium shrink-0 cursor-pointer transition-colors shadow-2xs"
          >
            Generate Embeddings Now
          </button>
        </div>
      )}

      {/* 3. Main Scanner & Results Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (5 Cols): Live Scanner Viewport */}
        <div className="lg:col-span-5 space-y-4">
          <div
            className="bg-white rounded-xl border overflow-hidden shadow-2xs"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            {/* Viewfinder Header */}
            <div className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-medium tracking-tight">Live AI Scanner</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  ({facingMode === "environment" ? "Rear Camera" : "Front Camera"})
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleToggleCamera}
                  disabled={isCameraLoading || isAnalyzing}
                  className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Switch camera (front/back)"
                >
                  <SwitchCamera size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => setIsCameraActive((prev) => !prev)}
                  className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title={isCameraActive ? "Pause camera" : "Resume camera"}
                >
                  <Camera size={14} />
                </button>
              </div>
            </div>

            {/* Video Viewport */}
            <div className="relative aspect-4/3 bg-black flex items-center justify-center overflow-hidden">
              {isCameraActive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transition-transform duration-200 ${
                    facingMode === "user" ? "scale-x-[-1]" : ""
                  }`}
                />
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs">
                  <Camera size={32} className="mx-auto text-slate-600 mb-2" />
                  Camera paused. Click resume or upload an image.
                </div>
              )}

              {/* Laser Scanning Line Animation */}
              {isCameraActive && !isCameraLoading && !cameraError && (
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-center items-center">
                  <div className="w-4/5 h-4/5 border-2 border-dashed border-white/40 rounded-xl relative overflow-hidden">
                    <div className="absolute left-0 right-0 h-0.5 bg-[#348bdd] shadow-[0_0_12px_#348bdd] animate-[pulse_1.5s_ease-in-out_infinite]" />
                  </div>
                </div>
              )}

              {/* Loading Spinner */}
              {isCameraLoading && (
                <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-2 text-white">
                  <RotateCw size={24} className="animate-spin text-[#348bdd]" />
                  <span className="text-xs">Starting camera...</span>
                </div>
              )}

              {/* Camera Error */}
              {cameraError && (
                <div className="absolute inset-0 bg-black/90 p-6 flex flex-col items-center justify-center text-center gap-3 text-white">
                  <AlertTriangle size={28} className="text-rose-500" />
                  <p className="text-xs text-slate-300 max-w-xs">{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => startCameraStream(facingMode)}
                    className="px-3 py-1.5 rounded-lg bg-[#348bdd] text-white text-xs font-medium cursor-pointer"
                  >
                    Retry Camera
                  </button>
                </div>
              )}

              {/* Analyzing Overlay */}
              {isAnalyzing && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-white z-20">
                  <RotateCw size={28} className="animate-spin text-[#348bdd]" />
                  <span className="text-xs font-medium">{analysisStatus || "Analyzing image..."}</span>
                </div>
              )}
            </div>

            {/* Shutter & Controls Bar */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isAnalyzing}
                className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-medium cursor-pointer shadow-2xs transition-colors"
                title="Upload image from gallery/device"
              >
                <Upload size={14} className="text-slate-500" />
                <span>Upload Pic</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileScan}
                className="hidden"
              />

              <button
                type="button"
                onClick={handleScanFromVideo}
                disabled={!isCameraActive || isCameraLoading || isAnalyzing}
                className="flex-1 py-2.5 px-4 rounded-lg bg-[#348bdd] hover:bg-[#2877c3] text-white text-xs font-semibold cursor-pointer shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                <Scan size={15} />
                <span>Scan Product Now</span>
              </button>
            </div>
          </div>

          {/* Last Scanned Snapshot Preview */}
          {scannedPreviewUrl && (
            <div
              className="p-3 rounded-lg border bg-white shadow-2xs flex items-center gap-3"
              style={{ borderColor: "var(--color-border-base)" }}
            >
              <div className="w-14 h-14 rounded-md border border-slate-200 overflow-hidden shrink-0 bg-slate-100">
                <img
                  src={scannedPreviewUrl}
                  alt="Scanned frame"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0 text-xs">
                <span className="font-medium text-slate-900 block truncate">Scanned Image Snapshot</span>
                <span className="text-[11px] text-slate-500">
                  {matchedProducts.length > 0
                    ? `Matched with ${matchedProducts.length} catalog items`
                    : "No matching products found"}
                </span>
              </div>
            </div>
          )}

          {/* Recent Scanned Stock Additions */}
          {recentLogs.length > 0 && (
            <div
              className="p-3.5 rounded-lg border bg-white shadow-2xs space-y-2.5"
              style={{ borderColor: "var(--color-border-base)" }}
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-800">
                <History size={14} className="text-[#348bdd]" />
                <span>Recently Added Stock Today</span>
              </div>
              <div className="space-y-1.5 text-xs">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2 rounded bg-slate-50 border border-slate-100 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-medium text-slate-900 block">{log.productName}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        +{log.inputQty} {log.inputUnit} (~{log.calculatedKg} KG) • {log.time}
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-mono">
                      ✓ Added
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (7 Cols): Matched Products List with KG, Tray, Litre, Piece Stock Addition */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base text-slate-900" style={{ fontWeight: 500 }}>
                Matched Products
              </h2>
              <span className="text-xs text-slate-500">
                Select unit (KG, Tray, Litre, Piece) and click <strong>Add Stock</strong> to update{" "}
                <strong>{currentStore?.name || "Store Stock"}</strong>.
              </span>
            </div>

            {hasScannedOnce && (
              <span className="px-2 py-0.5 text-xs rounded bg-blue-50 text-blue-800 border border-blue-200 font-mono">
                {matchedProducts.length} candidate(s)
              </span>
            )}
          </div>

          {/* Empty State before first scan */}
          {!hasScannedOnce && (
            <div
              className="p-12 text-center rounded-xl border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center gap-3 text-slate-500"
            >
              <div className="w-12 h-12 rounded-full bg-blue-50 text-[#348bdd] flex items-center justify-center">
                <Scan size={24} />
              </div>
              <h3 className="text-sm font-medium text-slate-800">No Product Scanned Yet</h3>
              <p className="text-xs max-w-sm text-slate-500">
                Position your camera in front of a sweet, tray, or box, and click{" "}
                <strong>Scan Product Now</strong>. Matching items will appear here with direct stock addition.
              </p>
            </div>
          )}

          {/* Scanned but 0 matches */}
          {hasScannedOnce && matchedProducts.length === 0 && (
            <div className="p-8 text-center rounded-xl border border-slate-200 bg-white space-y-3">
              <Boxes size={28} className="mx-auto text-slate-400" />
              <h3 className="text-sm font-medium text-slate-800">No Similar Products Recognized</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                The AI couldn't match this image with high confidence. Ensure the sweet is clearly visible, or
                make sure AI embeddings are synced for all products.
              </p>
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-[#348bdd] text-white text-xs font-medium cursor-pointer"
              >
                Check Product AI Embeddings
              </button>
            </div>
          )}

          {/* Matched Product Cards */}
          {matchedProducts.map((product, idx) => {
            const input = getProductInput(product);
            const invKey = `${selectedStoreId}_${product.id}`;
            const existingInv = inventoryMap.get(invKey);
            const currentNativeQty = existingInv?.quantity || 0;
            const currentCalculatedKg = existingInv?.calculatedKg ?? calculateKg(product, currentNativeQty);

            const numQty = Number(input.quantity) || 1;
            const previewKg = convertInputToKg(product, numQty, input.unit);
            const isTopMatch = idx === 0 && product.similarity >= 65;

            return (
              <div
                key={product.id}
                className={`p-4 rounded-xl border transition-all bg-white shadow-2xs space-y-3 ${
                  isTopMatch
                    ? "border-[#348bdd] ring-1 ring-[#348bdd]/30"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {/* Product Header Row */}
                <div className="flex items-start gap-3.5">
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-lg border border-slate-200 overflow-hidden shrink-0 bg-slate-50">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <Package size={20} />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">{product.name}</h3>
                      {isTopMatch && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                          ★ Best Match
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {product.categoryName || "Sweets"}
                      </span>
                      <span>Rate: ₹{product.amount} / {product.unit}</span>
                      {product.barcode && (
                        <span className="font-mono text-slate-400">Barcode: {product.barcode}</span>
                      )}
                    </div>

                    {/* Store Stock Badge */}
                    <div className="mt-1.5 text-xs text-slate-700 flex items-center gap-1.5 font-mono">
                      <Store size={12} className="text-slate-400" />
                      <span>
                        Current Stock in {currentStore?.name || "Store"}:{" "}
                        <strong className="text-slate-900">{currentNativeQty} {product.unit}</strong>{" "}
                        (~{currentCalculatedKg} KG)
                      </span>
                    </div>
                  </div>

                  {/* Similarity Badge */}
                  <div className="text-right shrink-0">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-mono font-semibold border ${
                        product.similarity >= 75
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : product.similarity >= 55
                          ? "bg-sky-50 text-sky-700 border-sky-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {product.similarity}% Match
                    </span>
                  </div>
                </div>

                {/* Stock Addition Bar: Unit (KG, Tray, Litre, Piece), Quantity Input & Add Button */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Unit Selector: KG, Tray, Litre, Piece */}
                    <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mr-1">
                      Unit:
                    </span>
                    {(["KG", "Tray", "litre", "piece"] as const).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => handleStockInputChange(product.id, "unit", u)}
                        className={`px-2.5 py-1 text-xs rounded font-medium cursor-pointer transition-colors ${
                          input.unit === u
                            ? "bg-[#348bdd] text-white shadow-2xs"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {u === "litre" ? "Litre" : u === "piece" ? "Piece" : u}
                      </button>
                    ))}

                    {/* Quantity Input */}
                    <div className="flex items-center gap-1 ml-2">
                      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                        Qty:
                      </span>
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        value={input.quantity}
                        onChange={(e) =>
                          handleStockInputChange(product.id, "quantity", e.target.value)
                        }
                        className="w-16 px-2 py-1 text-xs border rounded text-center font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#348bdd] border-slate-300 bg-white"
                      />
                      <span className="text-xs text-slate-500 font-mono">
                        (~{previewKg} KG)
                      </span>
                    </div>
                  </div>

                  {/* Add Stock Button */}
                  <button
                    type="button"
                    onClick={() => handleAddStockToProduct(product)}
                    disabled={savingProductId === product.id}
                    className="px-4 py-2 text-xs rounded-md text-white font-medium shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90 disabled:opacity-50 shrink-0"
                    style={{ backgroundColor: "var(--color-brand-primary)" }}
                  >
                    {savingProductId === product.id ? (
                      <>
                        <RotateCw size={13} className="animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <>
                        <Plus size={14} />
                        <span>Add Stock</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Quick link to Store Stock Entry */}
          <div className="pt-2 flex justify-end">
            <Link
              href="/store-stock-entry"
              className="text-xs text-[#348bdd] hover:underline flex items-center gap-1"
            >
              <span>Open Store Stock Entry page</span>
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      </div>

      {/* =========================================================================
          4. SYNC PRODUCT AI EMBEDDINGS MODAL
         ========================================================================= */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white rounded-xl border shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
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
                  className="w-7 h-7 rounded-md flex items-center justify-center text-white"
                  style={{ backgroundColor: "var(--color-brand-primary)" }}
                >
                  <Sparkles size={15} />
                </div>
                <h3 className="text-sm font-medium text-slate-800">
                  MobileNet AI Product Indexing
                </h3>
              </div>
              <button
                type="button"
                disabled={isSyncingEmbeddings}
                onClick={() => setIsSyncModalOpen(false)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600">
                To enable instant visual recognition, MobileNet extracts 1,024-dimensional feature
                embeddings from your catalog product images and saves them in Firestore.
              </p>

              {/* Stats Box */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Products:</span>
                  <span className="font-semibold text-slate-900">{embeddingStats.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Products with Images:</span>
                  <span className="font-semibold text-slate-900">{embeddingStats.withImages}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Already AI Indexed:</span>
                  <span className="font-semibold text-emerald-700">{embeddingStats.withEmbeddings}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pending Embeddings:</span>
                  <span
                    className={`font-semibold ${
                      embeddingStats.missingEmbeddings > 0 ? "text-amber-600" : "text-emerald-700"
                    }`}
                  >
                    {embeddingStats.missingEmbeddings}
                  </span>
                </div>
              </div>

              {/* Progress Bar during generation */}
              {isSyncingEmbeddings && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-mono text-slate-600">
                    <span>
                      Processing: {syncProgress.current || "Loading images..."}
                    </span>
                    <span>
                      {syncProgress.done} / {syncProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                    <div
                      className="bg-[#348bdd] h-full transition-all duration-150"
                      style={{
                        width: `${
                          syncProgress.total > 0
                            ? Math.round((syncProgress.done / syncProgress.total) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={isSyncingEmbeddings}
                  onClick={() => handleStartGenerateEmbeddings(false)}
                  className="w-full py-2.5 px-4 text-xs text-white rounded-md font-medium cursor-pointer shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ backgroundColor: "var(--color-brand-primary)" }}
                >
                  {isSyncingEmbeddings ? (
                    <>
                      <RotateCw size={14} className="animate-spin" />
                      <span>Generating AI Embeddings...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      <span>
                        {embeddingStats.missingEmbeddings > 0
                          ? `Generate Embeddings (${embeddingStats.missingEmbeddings} items)`
                          : "Verify & Complete Index"}
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isSyncingEmbeddings}
                  onClick={() => handleStartGenerateEmbeddings(true)}
                  className="w-full py-2 text-[11px] text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded border border-slate-200 cursor-pointer"
                >
                  Force Re-generate All Product Embeddings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
