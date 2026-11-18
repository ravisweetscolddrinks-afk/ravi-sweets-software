"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import {
  encodeCode128B,
  buildTsplBuffer,
  BarcodeLabelPrintItem,
  LabelSpec,
} from "@/lib/code128";
import {
  Barcode,
  Search,
  Printer,
  Plus,
  Trash2,
  X,
  Scale,
  Package,
  Usb,
  CheckCircle2,
  SlidersHorizontal,
  Layers,
  Loader2,
  RotateCcw,
  Sparkles,
  Check,
  AlertCircle,
} from "lucide-react";

interface CatalogProduct {
  id: string;
  name: string;
  categoryName?: string;
  barcode: string;
  shortCode: string;
  unit: string;
  amount: number;
  imageUrl?: string;
}

interface LabelPreset {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
  columns: 1 | 2;
  gapMm: number;
  colGapMm: number;
}

const LABEL_PRESETS: LabelPreset[] = [
  { id: "50x25_1up", label: '50 × 25 mm (2" × 1" • 1-Up)', widthMm: 50, heightMm: 25, columns: 1, gapMm: 3, colGapMm: 0 },
  { id: "50x25_2up", label: '50 × 25 mm (2" × 1" • 2-Up Roll)', widthMm: 50, heightMm: 25, columns: 2, gapMm: 3, colGapMm: 2 },
  { id: "38x25_1up", label: '38 × 25 mm (1.5" × 1" • 1-Up)', widthMm: 38, heightMm: 25, columns: 1, gapMm: 3, colGapMm: 0 },
  { id: "38x25_2up", label: '38 × 25 mm (1.5" × 1" • 2-Up Roll)', widthMm: 38, heightMm: 25, columns: 2, gapMm: 3, colGapMm: 2 },
  { id: "50x38_1up", label: '50 × 38 mm (2" × 1.5" • 1-Up)', widthMm: 50, heightMm: 38, columns: 1, gapMm: 3, colGapMm: 0 },
  { id: "50x50_1up", label: '50 × 50 mm (2" × 2" • 1-Up)', widthMm: 50, heightMm: 50, columns: 1, gapMm: 3, colGapMm: 0 },
  { id: "custom", label: "Custom Label Size (mm)", widthMm: 50, heightMm: 25, columns: 1, gapMm: 3, colGapMm: 2 },
];

const HEADER_BRAND_TITLE = "RAVI SWEETS AND COOL DRINKS";

const GRAM_PRESETS = [100, 250, 500, 750, 1000, 2000];
const PIECE_PRESETS = [1, 2, 4, 6, 10, 12];
const COPY_PRESETS = [1, 2, 5, 10, 20, 50];

interface QueuedBarcodeJob extends BarcodeLabelPrintItem {
  id: string;
  productId: string;
  unit: string;
  rate: number;
  isWeight: boolean;
}

// Vector Code 128B SVG component — renders ultra-sharp bars for thermal barcode printers
function Code128Svg({
  value,
  height = 42,
  className = "",
}: {
  value: string;
  height?: number;
  className?: string;
}) {
  const encoded = useMemo(() => encodeCode128B(value, 8), [value]);

  if (!encoded.bars.length || encoded.totalModules === 0) {
    return (
      <div className="text-[10px] font-mono text-rose-500 py-2 text-center">
        Invalid barcode value
      </div>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${encoded.totalModules} ${height}`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      className={className}
      style={{ display: "block", width: "100%", height: `${height}px` }}
      aria-label={`Barcode ${value}`}
    >
      <rect x="0" y="0" width={encoded.totalModules} height={height} fill="#ffffff" />
      {encoded.bars.map((bar, idx) => (
        <rect
          key={idx}
          x={bar.x}
          y={0}
          width={bar.width}
          height={height}
          fill="#000000"
        />
      ))}
    </svg>
  );
}

// Single physical sticker layout (used in both live preview and actual print output)
function BarcodeStickerCard({
  item,
  widthMm,
  heightMm,
  isPrint = false,
}: {
  item: BarcodeLabelPrintItem;
  widthMm: number;
  heightMm: number;
  isPrint?: boolean;
}) {
  const isCompact = heightMm <= 26 || widthMm <= 40;
  const barHeightPx = isCompact ? (isPrint ? 24 : 38) : isPrint ? 36 : 48;

  return (
    <div
      style={{
        width: isPrint ? `${widthMm}mm` : "100%",
        height: isPrint ? `${heightMm}mm` : "auto",
        minHeight: isPrint ? `${heightMm}mm` : "150px",
        padding: isPrint ? (isCompact ? "1mm 1.5mm" : "1.8mm 2.2mm") : "14px 16px",
        boxSizing: "border-box",
        backgroundColor: "#ffffff",
        color: "#000000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        overflow: "hidden",
        textAlign: "center",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      {/* 1. Brand Header: RAVI SWEETS AND COOL DRINKS */}
      <div
        style={{
          fontSize: isPrint ? (isCompact ? "6.2pt" : "7.5pt") : "11px",
          fontWeight: 700,
          letterSpacing: "0.3px",
          lineHeight: 1.1,
          textTransform: "uppercase",
          width: "100%",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {item.headerText || HEADER_BRAND_TITLE}
      </div>

      {/* 2. Product Name + Weight/Qty */}
      <div
        style={{
          fontSize: isPrint ? (isCompact ? "6pt" : "7.5pt") : "12px",
          fontWeight: 600,
          lineHeight: 1.15,
          width: "100%",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          marginTop: isPrint ? "0.3mm" : "3px",
        }}
      >
        {item.productName} ({item.packText})
      </div>

      {/* 3. Scannable Code 128B Barcode + Code Text */}
      <div style={{ width: "96%", margin: isPrint ? "0.5mm 0" : "6px 0" }}>
        <Code128Svg value={item.barcodeValue} height={barHeightPx} />
        <div
          style={{
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: isPrint ? (isCompact ? "6pt" : "7.5pt") : "11px",
            fontWeight: 700,
            letterSpacing: "0.8px",
            lineHeight: 1.1,
            marginTop: isPrint ? "0.3mm" : "3px",
          }}
        >
          {item.barcodeValue}
        </div>
      </div>

      {/* 4. Amount Below Barcode */}
      <div
        style={{
          fontSize: isPrint ? (isCompact ? "7.5pt" : "9.5pt") : "15px",
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: "0.2px",
        }}
      >
        Amount: ₹{Number(item.amount).toFixed(2)}
      </div>
    </div>
  );
}

export default function BarcodeGeneratorPage() {
  const { showToast } = useToast();

  // Products catalog state (lazy-fetched ONLY on search — zero reads on initial load)
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const hasFetchedProductsRef = useRef<boolean>(false);

  // Selected Item & Input State
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [gramsInput, setGramsInput] = useState<string>("250");
  const [qtyInput, setQtyInput] = useState<string>("1");
  const [copiesInput, setCopiesInput] = useState<string>("1");
  const [customAmountOverride, setCustomAmountOverride] = useState<string>("");
  const [headerText, setHeaderText] = useState<string>(HEADER_BRAND_TITLE);

  // Batch Print Queue
  const [printQueue, setPrintQueue] = useState<QueuedBarcodeJob[]>([]);
  const [activePrintItems, setActivePrintItems] = useState<BarcodeLabelPrintItem[] | null>(null);

  // Barcode Printer Configuration
  const [selectedPresetId, setSelectedPresetId] = useState<string>("50x25_1up");
  const [labelSpec, setLabelSpec] = useState<LabelSpec>({
    widthMm: 50,
    heightMm: 25,
    columns: 1,
    gapMm: 3,
    colGapMm: 2,
    dpi: 203,
  });
  const [printMode, setPrintMode] = useState<"driver" | "usb_tspl">("driver");
  const [isUsbConnected, setIsUsbConnected] = useState<boolean>(false);
  const [usbPrinterName, setUsbPrinterName] = useState<string>("");
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [showPrinterSettings, setShowPrinterSettings] = useState<boolean>(false);

  const usbDeviceRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if product is weight/litre based (same rule as POS Billing)
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

  // Load saved barcode printer settings
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ravi_sweets_barcode_printer_spec");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.presetId) setSelectedPresetId(parsed.presetId);
        if (parsed.spec) setLabelSpec((prev) => ({ ...prev, ...parsed.spec }));
        if (parsed.printMode === "usb_tspl" || parsed.printMode === "driver") {
          setPrintMode(parsed.printMode);
        }
      }
    } catch {}
  }, []);

  // Persist barcode printer settings
  useEffect(() => {
    try {
      localStorage.setItem(
        "ravi_sweets_barcode_printer_spec",
        JSON.stringify({ presetId: selectedPresetId, spec: labelSpec, printMode })
      );
    } catch {}
  }, [selectedPresetId, labelSpec, printMode]);

  // Listen to afterprint to clean up print DOM
  useEffect(() => {
    const onAfterPrint = () => {
      setActivePrintItems(null);
      setIsPrinting(false);
    };
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

  // Fetch products from Firestore ONLY when the user searches (never on initial page load)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setIsLoading(false);
      return;
    }

    if (hasFetchedProductsRef.current) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const snap = await getDocs(query(collection(db, "products"), orderBy("name", "asc")));
        if (cancelled) return;
        const list: CatalogProduct[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || "",
            categoryName: data.categoryName || "",
            barcode: String(data.barcode || "").trim(),
            shortCode: String(data.shortCode || "").trim(),
            unit: data.unit || "KG",
            amount: Number(data.amount) || 0,
            imageUrl: data.imageUrl || "",
          };
        });
        hasFetchedProductsRef.current = true;
        setProducts(list);
      } catch (err: any) {
        console.error("Products search fetch error:", err);
        showToast("Error searching products: " + (err?.message || "Unknown error"), "error");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, showToast]);

  // Filtered products — ONLY display items when search query is non-empty
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
    return products.filter((p) => {
      const matchName = p.name.toLowerCase().includes(q);
      const matchBarcode = p.barcode.toLowerCase().includes(q);
      const matchShort = p.shortCode.toLowerCase().includes(q);
      const matchCat = (p.categoryName || "").toLowerCase().includes(q);
      return matchName || matchBarcode || matchShort || matchCat;
    });
  }, [products, searchQuery]);

  // Handle selecting a product
  const handleSelectProduct = (product: CatalogProduct) => {
    setSelectedProduct(product);
    setSearchQuery("");
    setCustomAmountOverride("");
    if (isWeightProduct(product.unit)) {
      setGramsInput("250");
    } else {
      setQtyInput("1");
    }
    setCopiesInput("1");
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 60);
  };

  // Compute live barcode data for the currently selected product
  const generatedLabel = useMemo(() => {
    if (!selectedProduct) return null;

    const isWeight = isWeightProduct(selectedProduct.unit);
    const baseCode =
      selectedProduct.barcode ||
      selectedProduct.shortCode ||
      selectedProduct.id.slice(0, 8).toUpperCase();

    if (isWeight) {
      const grams = Math.max(0, Number(gramsInput) || 0);
      if (grams <= 0) return null;

      // Format grams part so POS scanner (app/pos/page.tsx) always parses it as grams:
      // POS divides by 1000 when qtyPart starts with '0' or num >= 10.
      const gramsToken = grams < 10 ? String(grams).padStart(4, "0") : String(grams);
      const barcodeValue = `${baseCode}*${gramsToken}`;
      const kgValue = Number((grams / 1000).toFixed(3));
      const calculatedAmount = Number((kgValue * selectedProduct.amount).toFixed(2));
      const finalAmount =
        customAmountOverride !== "" && !isNaN(Number(customAmountOverride))
          ? Number(customAmountOverride)
          : calculatedAmount;

      const unitLower = selectedProduct.unit.toLowerCase();
      const isLitre = unitLower.includes("lit") || unitLower === "ltr";
      const packText = isLitre
        ? grams >= 1000 && grams % 1000 === 0
          ? `${grams / 1000} Ltr`
          : `${grams} ml`
        : grams >= 1000 && grams % 1000 === 0
        ? `${grams / 1000} KG`
        : `${grams}g`;

      return {
        isWeight: true,
        baseCode,
        barcodeValue,
        packText,
        kgValue,
        calculatedAmount,
        finalAmount,
        copies: Math.max(1, Math.min(500, parseInt(copiesInput, 10) || 1)),
        posPreview: `${selectedProduct.name} (${kgValue} ${selectedProduct.unit}) → ₹${calculatedAmount.toFixed(2)}`,
      };
    } else {
      const qty = Math.max(0, parseInt(qtyInput, 10) || 0);
      if (qty <= 0) return null;

      const barcodeValue = `${baseCode}*${qty}`;
      const calculatedAmount = Number((qty * selectedProduct.amount).toFixed(2));
      const finalAmount =
        customAmountOverride !== "" && !isNaN(Number(customAmountOverride))
          ? Number(customAmountOverride)
          : calculatedAmount;

      const unitName = selectedProduct.unit || "pcs";
      const packText = `${qty} ${qty === 1 ? unitName : unitName.toLowerCase() === "piece" ? "pcs" : unitName}`;

      return {
        isWeight: false,
        baseCode,
        barcodeValue,
        packText,
        kgValue: qty,
        calculatedAmount,
        finalAmount,
        copies: Math.max(1, Math.min(500, parseInt(copiesInput, 10) || 1)),
        posPreview: `${qty} × ${selectedProduct.name} → ₹${calculatedAmount.toFixed(2)}`,
      };
    }
  }, [selectedProduct, gramsInput, qtyInput, copiesInput, customAmountOverride]);

  // Preset change handler
  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    const found = LABEL_PRESETS.find((p) => p.id === presetId);
    if (found && presetId !== "custom") {
      setLabelSpec((prev) => ({
        ...prev,
        widthMm: found.widthMm,
        heightMm: found.heightMm,
        columns: found.columns,
        gapMm: found.gapMm,
        colGapMm: found.colGapMm,
      }));
    }
  };

  // Connect Direct USB Barcode Printer (WebUSB TSPL)
  const handleConnectUsbBarcodePrinter = async () => {
    try {
      if (typeof window === "undefined" || !("usb" in navigator)) {
        showToast("WebUSB is not supported in this browser. Use Chrome or Edge, or use System Barcode Printer mode.", "error");
        return;
      }

      const device = await (navigator as any).usb.requestDevice({ filters: [] });
      if (!device.opened) await device.open();
      if (device.configuration === null) await device.selectConfiguration(1);

      let ifaceNum = 0;
      for (const iface of device.configuration?.interfaces || []) {
        for (const alt of iface.alternates || []) {
          const ep = alt.endpoints?.find((e: any) => e.direction === "out");
          if (ep) {
            ifaceNum = iface.interfaceNumber;
            break;
          }
        }
      }
      try {
        await device.claimInterface(ifaceNum);
      } catch {}

      usbDeviceRef.current = device;
      const name = device.productName || "USB Barcode Printer";
      setUsbPrinterName(name);
      setIsUsbConnected(true);
      setPrintMode("usb_tspl");
      showToast(`Connected to ${name} (Direct USB TSPL)`, "success");
    } catch (err: any) {
      if (err?.name !== "NotFoundError") {
        console.error("USB barcode printer connect error:", err);
        showToast("Failed to connect USB barcode printer: " + (err?.message || "Unknown error"), "error");
      }
    }
  };

  // Send raw TSPL commands to connected USB barcode printer
  const printViaUsbTspl = async (items: BarcodeLabelPrintItem[]) => {
    let device = usbDeviceRef.current;
    if (!device && typeof window !== "undefined" && "usb" in navigator) {
      try {
        const devices = await (navigator as any).usb.getDevices();
        if (devices.length > 0) {
          device = devices[0];
          usbDeviceRef.current = device;
        }
      } catch {}
    }

    if (!device) {
      showToast("No USB barcode printer connected. Click 'Connect USB Printer' or switch to System Barcode Printer.", "error");
      setShowPrinterSettings(true);
      return;
    }

    setIsPrinting(true);
    try {
      if (!device.opened) await device.open();
      if (device.configuration === null) await device.selectConfiguration(1);
      let ifaceNum = 0;
      let outEp = 1;
      for (const iface of device.configuration?.interfaces || []) {
        for (const alt of iface.alternates || []) {
          const ep = alt.endpoints?.find((e: any) => e.direction === "out");
          if (ep) {
            ifaceNum = iface.interfaceNumber;
            outEp = ep.endpointNumber;
            break;
          }
        }
      }
      try {
        await device.claimInterface(ifaceNum);
      } catch {}

      const tsplBuffer = buildTsplBuffer(items, labelSpec);
      const result = await device.transferOut(outEp, tsplBuffer);
      if (result.status === "ok") {
        const totalLabels = items.reduce((acc, i) => acc + i.copies, 0);
        showToast(`Sent ${totalLabels} barcode sticker${totalLabels > 1 ? "s" : ""} to USB Barcode Printer!`, "success");
      } else {
        showToast("USB printer transfer status: " + result.status, "error");
      }
    } catch (err: any) {
      console.error("USB TSPL print error:", err);
      showToast("USB barcode print error: " + (err?.message || "Transfer failed"), "error");
    } finally {
      setIsPrinting(false);
    }
  };

  // Trigger print via System Barcode Printer Driver (browser print with exact mm @page)
  const printViaSystemDriver = (items: BarcodeLabelPrintItem[]) => {
    setIsPrinting(true);
    setActivePrintItems(items);
    setTimeout(() => {
      window.print();
    }, 180);
  };

  // Print Current Item Immediately
  const handlePrintCurrentItem = async () => {
    if (!selectedProduct || !generatedLabel) {
      showToast("Please select a product and enter valid grams / quantity", "error");
      return;
    }

    const labelJob: BarcodeLabelPrintItem = {
      headerText: headerText.trim() || HEADER_BRAND_TITLE,
      productName: selectedProduct.name,
      packText: generatedLabel.packText,
      barcodeValue: generatedLabel.barcodeValue,
      amount: generatedLabel.finalAmount,
      copies: generatedLabel.copies,
    };

    if (printMode === "usb_tspl") {
      await printViaUsbTspl([labelJob]);
    } else {
      printViaSystemDriver([labelJob]);
    }
  };

  // Add Current Item to Batch Print Queue
  const handleAddToQueue = () => {
    if (!selectedProduct || !generatedLabel) {
      showToast("Please select a product and enter valid grams / quantity", "error");
      return;
    }

    const newJob: QueuedBarcodeJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      productId: selectedProduct.id,
      headerText: headerText.trim() || HEADER_BRAND_TITLE,
      productName: selectedProduct.name,
      packText: generatedLabel.packText,
      barcodeValue: generatedLabel.barcodeValue,
      amount: generatedLabel.finalAmount,
      copies: generatedLabel.copies,
      unit: selectedProduct.unit,
      rate: selectedProduct.amount,
      isWeight: generatedLabel.isWeight,
    };

    setPrintQueue((prev) => [...prev, newJob]);
    showToast(`Added ${newJob.copies} × ${newJob.productName} (${newJob.packText}) to print queue`, "success");
  };

  // Print Entire Batch Queue
  const handlePrintBatchQueue = async () => {
    if (printQueue.length === 0) {
      showToast("Print queue is empty", "error");
      return;
    }

    if (printMode === "usb_tspl") {
      await printViaUsbTspl(printQueue);
    } else {
      printViaSystemDriver(printQueue);
    }
  };

  // Expand active print items into sticker rows (1-up or 2-up)
  const expandedPrintRows = useMemo(() => {
    if (!activePrintItems || activePrintItems.length === 0) return [];
    const flat: BarcodeLabelPrintItem[] = [];
    for (const item of activePrintItems) {
      const count = Math.max(1, Math.min(500, Math.floor(item.copies || 1)));
      for (let i = 0; i < count; i++) {
        flat.push(item);
      }
    }
    const rows: BarcodeLabelPrintItem[][] = [];
    for (let i = 0; i < flat.length; i += labelSpec.columns) {
      rows.push(flat.slice(i, i + labelSpec.columns));
    }
    return rows;
  }, [activePrintItems, labelSpec.columns]);

  const totalQueueStickers = useMemo(
    () => printQueue.reduce((acc, j) => acc + j.copies, 0),
    [printQueue]
  );

  const totalRollWidthMm =
    labelSpec.columns === 2
      ? labelSpec.widthMm * 2 + labelSpec.colGapMm
      : labelSpec.widthMm;

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full space-y-5">
      {/* 1. Header Toolbar */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b no-print"
        style={{ borderColor: "var(--color-border-subtle)" }}
      >
        <div>
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{
                backgroundColor: "var(--color-brand-primary-light)",
                color: "var(--color-brand-primary)",
              }}
            >
              <Barcode size={19} />
            </div>
            <h1
              className="text-2xl text-[var(--color-text-primary)] tracking-tight"
              style={{ fontWeight: 500 }}
            >
              Barcode Generator
            </h1>
            <span
              className="px-2 py-0.5 text-xs rounded font-normal font-mono"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                border: "1px solid var(--color-border-base)",
                color: "var(--color-text-secondary)",
              }}
            >
              Code 128 • POS Ready
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            Select an item, enter grams (for weight items) or quantity (for piece items), choose number of stickers, and print directly to your barcode printer.
          </p>
        </div>

        {/* Barcode Printer Mode & Settings Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPrinterSettings((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-md border transition-colors cursor-pointer ${
              showPrinterSettings
                ? "border-[#348bdd] bg-blue-50 text-[#348bdd]"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <SlidersHorizontal size={14} />
            <span>
              Label: {labelSpec.widthMm}×{labelSpec.heightMm}mm ({labelSpec.columns}-Up)
            </span>
          </button>

          {printMode === "usb_tspl" && (
            <button
              type="button"
              onClick={handleConnectUsbBarcodePrinter}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-md border transition-colors cursor-pointer ${
                isUsbConnected
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
              }`}
            >
              <Usb size={14} />
              <span>{isUsbConnected ? usbPrinterName : "Connect USB Printer"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Barcode Printer & Label Size Configuration Bar */}
      {showPrinterSettings && (
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs no-print animate-in fade-in duration-150">
          {/* Print Method */}
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1.5">
              Barcode Printer Mode
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setPrintMode("driver")}
                className={`py-1.5 px-2 rounded-md border text-xs font-medium cursor-pointer transition-colors ${
                  printMode === "driver"
                    ? "border-[#348bdd] bg-[#348bdd] text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Barcode Driver
              </button>
              <button
                type="button"
                onClick={() => setPrintMode("usb_tspl")}
                className={`py-1.5 px-2 rounded-md border text-xs font-medium cursor-pointer transition-colors ${
                  printMode === "usb_tspl"
                    ? "border-[#348bdd] bg-[#348bdd] text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Direct USB (TSPL)
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {printMode === "driver"
                ? "Works with any installed TSC / TVS / Zebra / Xprinter driver."
                : "Sends raw TSPL label commands directly over WebUSB."}
            </p>
          </div>

          {/* Label Roll Size Preset */}
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1.5">
              Sticker Roll Size Preset
            </label>
            <select
              value={selectedPresetId}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd] cursor-pointer"
            >
              {LABEL_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] text-slate-500">Layout:</span>
              <button
                type="button"
                onClick={() => setLabelSpec((prev) => ({ ...prev, columns: 1 }))}
                className={`px-2 py-0.5 text-[10px] rounded border cursor-pointer ${
                  labelSpec.columns === 1
                    ? "border-[#348bdd] bg-blue-50 text-[#348bdd] font-medium"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                1-Up (1/row)
              </button>
              <button
                type="button"
                onClick={() => setLabelSpec((prev) => ({ ...prev, columns: 2 }))}
                className={`px-2 py-0.5 text-[10px] rounded border cursor-pointer ${
                  labelSpec.columns === 2
                    ? "border-[#348bdd] bg-blue-50 text-[#348bdd] font-medium"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                2-Up (2/row)
              </button>
            </div>
          </div>

          {/* Dimensions in mm */}
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1.5">
              Sticker Width × Height (mm)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-400">Width (mm)</span>
                <input
                  type="number"
                  min="20"
                  max="120"
                  value={labelSpec.widthMm}
                  onWheel={(e) => e.currentTarget.blur()}
                  onChange={(e) => {
                    setSelectedPresetId("custom");
                    setLabelSpec((prev) => ({
                      ...prev,
                      widthMm: Math.max(20, Number(e.target.value) || 50),
                    }));
                  }}
                  className="w-full px-2 py-1 text-xs font-mono rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400">Height (mm)</span>
                <input
                  type="number"
                  min="15"
                  max="100"
                  value={labelSpec.heightMm}
                  onWheel={(e) => e.currentTarget.blur()}
                  onChange={(e) => {
                    setSelectedPresetId("custom");
                    setLabelSpec((prev) => ({
                      ...prev,
                      heightMm: Math.max(15, Number(e.target.value) || 25),
                    }));
                  }}
                  className="w-full px-2 py-1 text-xs font-mono rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                />
              </div>
            </div>
          </div>

          {/* Label Header Text */}
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1.5">
              Top Shop Name on Sticker
            </label>
            <input
              type="text"
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
            />
            {printMode === "usb_tspl" && (
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-slate-500">Printer DPI:</span>
                <div className="flex gap-1">
                  {([203, 300] as const).map((dpi) => (
                    <button
                      key={dpi}
                      type="button"
                      onClick={() => setLabelSpec((prev) => ({ ...prev, dpi }))}
                      className={`px-2 py-0.5 text-[10px] font-mono rounded border cursor-pointer ${
                        labelSpec.dpi === dpi
                          ? "border-[#348bdd] bg-blue-50 text-[#348bdd] font-medium"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      {dpi} DPI
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Main Split Workspace: Left Product Catalog | Right Barcode Configurator & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start no-print">
        {/* LEFT PANE: Search & Choose Item (7 cols) */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs flex flex-col">
          <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/40">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Package size={15} className="text-[#348bdd]" />
                <h2 className="text-sm font-medium text-slate-900">
                  1. Search & Choose Item
                </h2>
                {searchQuery.trim() && !isLoading && (
                  <span className="text-[11px] font-mono text-slate-400">
                    ({filteredProducts.length} found)
                  </span>
                )}
              </div>
            </div>

            {/* Full-width Search Input */}
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white w-full focus-within:border-[#348bdd] focus-within:ring-2 focus-within:ring-[#348bdd]/15 transition-all">
              <Search size={15} className="text-[#348bdd] shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Type item name, barcode, or short code to search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs sm:text-sm bg-transparent focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="p-0.5 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Search Results Area */}
          <div className="p-3.5 max-h-[calc(100vh-280px)] min-h-[380px] overflow-y-auto">
            {!searchQuery.trim() ? (
              <div className="py-20 flex flex-col items-center justify-center text-center gap-2.5 px-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-[#348bdd] flex items-center justify-center">
                  <Search size={20} />
                </div>
                <div className="text-xs font-medium text-slate-700">
                  Search to find an item
                </div>
                <p className="text-[11px] text-slate-400 max-w-xs">
                  Start typing a product name, barcode number, or short code above. Items are loaded only when you search.
                </p>
              </div>
            ) : isLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 size={22} className="animate-spin text-[#348bdd]" />
                <span className="text-xs">Searching products...</span>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-20 text-center text-slate-400 text-xs">
                No products matched &ldquo;{searchQuery.trim()}&rdquo;.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredProducts.map((prod) => {
                  const isWeight = isWeightProduct(prod.unit);
                  const isSelected = selectedProduct?.id === prod.id;
                  const codeDisplay = prod.barcode || prod.shortCode || "—";

                  return (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => handleSelectProduct(prod)}
                      className={`text-left rounded-xl border p-2.5 flex flex-col transition-all cursor-pointer relative ${
                        isSelected
                          ? "border-[#348bdd] ring-2 ring-[#348bdd]/20 bg-sky-50/40 shadow-xs"
                          : "border-slate-200 bg-white hover:border-[#348bdd] hover:shadow-xs"
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#348bdd] text-white flex items-center justify-center shadow-2xs">
                          <Check size={11} />
                        </div>
                      )}

                      <div className="w-full h-24 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center p-1.5 mb-2">
                        <img
                          src={prod.imageUrl || "/logo.png"}
                          alt={prod.name}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/logo.png";
                          }}
                        />
                      </div>

                      <div className="text-xs font-medium text-slate-900 line-clamp-2 leading-snug">
                        {prod.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                        Code: {codeDisplay}
                      </div>

                      <div className="pt-2 mt-auto border-t border-slate-100 flex items-center justify-between gap-1 mt-2">
                        <span className="font-mono text-xs font-medium text-slate-900">
                          ₹{prod.amount}
                          <span className="text-[10px] text-slate-400 font-normal">/{prod.unit}</span>
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-medium ${
                            isWeight
                              ? "bg-blue-50 text-[#348bdd]"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {isWeight ? "Weight" : "Piece"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE: Grams/Qty + Copies + Live Barcode Preview + Print (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-[#348bdd]" />
                <h2 className="text-sm font-medium text-slate-900">
                  2. Generate & Print Barcode
                </h2>
              </div>
              {selectedProduct && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProduct(null);
                    setCustomAmountOverride("");
                  }}
                  className="text-[11px] text-slate-400 hover:text-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={11} />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {!selectedProduct ? (
              <div className="p-10 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Barcode size={22} />
                </div>
                <p className="text-xs font-medium text-slate-700">No Item Selected</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Click any sweet or product from the list on the left to enter grams or quantity and generate its scannable barcode sticker.
                </p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {/* Selected Product Banner */}
                <div className="p-3 rounded-lg border border-blue-100 bg-blue-50/40 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-900 truncate">
                      {selectedProduct.name}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                      Base Barcode:{" "}
                      <span className="text-slate-800 font-medium">
                        {selectedProduct.barcode || selectedProduct.shortCode || selectedProduct.id.slice(0, 8)}
                      </span>{" "}
                      • ₹{selectedProduct.amount} / {selectedProduct.unit}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white border border-blue-200 text-[#348bdd] shrink-0">
                    {isWeightProduct(selectedProduct.unit) ? "Weight Item" : "Piece Item"}
                  </span>
                </div>

                {/* Weight (Grams) OR Piece (Quantity) Input */}
                {isWeightProduct(selectedProduct.unit) ? (
                  <div className="space-y-2">
                    <label className="flex items-center justify-between text-xs font-medium text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <Scale size={13} className="text-[#348bdd]" />
                        <span>
                          Enter Weight in{" "}
                          {selectedProduct.unit.toLowerCase().includes("lit") ||
                          selectedProduct.unit.toLowerCase() === "ltr"
                            ? "Millilitres (ml)"
                            : "Grams (g)"}
                        </span>
                      </span>
                      {Number(gramsInput) > 0 && (
                        <span className="text-[11px] font-mono text-[#348bdd]">
                          = {(Number(gramsInput) / 1000).toFixed(3)} {selectedProduct.unit}
                        </span>
                      )}
                    </label>

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                      {GRAM_PRESETS.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => {
                            setGramsInput(String(g));
                            setCustomAmountOverride("");
                          }}
                          className={`py-1.5 rounded-md border text-[11px] font-mono cursor-pointer transition-colors ${
                            Number(gramsInput) === g
                              ? "border-[#348bdd] bg-blue-50 text-[#348bdd] font-medium"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {g >= 1000 ? `${g / 1000}KG` : `${g}g`}
                        </button>
                      ))}
                    </div>

                    <input
                      ref={inputRef}
                      type="number"
                      min="1"
                      step="1"
                      placeholder="e.g. 250 for 250g, 500 for 500g, 1000 for 1KG"
                      value={gramsInput}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) => {
                        setGramsInput(e.target.value);
                        setCustomAmountOverride("");
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="flex items-center justify-between text-xs font-medium text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <Package size={13} className="text-[#348bdd]" />
                        <span>Enter Pack Quantity ({selectedProduct.unit})</span>
                      </span>
                    </label>

                    <div className="grid grid-cols-6 gap-1.5">
                      {PIECE_PRESETS.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => {
                            setQtyInput(String(q));
                            setCustomAmountOverride("");
                          }}
                          className={`py-1.5 rounded-md border text-[11px] font-mono cursor-pointer transition-colors ${
                            Number(qtyInput) === q
                              ? "border-[#348bdd] bg-blue-50 text-[#348bdd] font-medium"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>

                    <input
                      ref={inputRef}
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Enter quantity in pack (e.g. 1, 2, 6)"
                      value={qtyInput}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) => {
                        setQtyInput(e.target.value);
                        setCustomAmountOverride("");
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                    />
                  </div>
                )}

                {/* Number of Stickers / Pieces to Print + Optional Amount Override */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-700">
                      Number of Stickers (Copies)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="500"
                      step="1"
                      value={copiesInput}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) => setCopiesInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                    />
                    <div className="flex flex-wrap gap-1">
                      {COPY_PRESETS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCopiesInput(String(c))}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono border cursor-pointer ${
                            Number(copiesInput) === c
                              ? "border-[#348bdd] bg-blue-50 text-[#348bdd] font-medium"
                              : "border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-700">
                      Amount on Sticker (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder={
                        generatedLabel
                          ? generatedLabel.calculatedAmount.toFixed(2)
                          : "0.00"
                      }
                      value={
                        customAmountOverride !== ""
                          ? customAmountOverride
                          : generatedLabel
                          ? String(generatedLabel.calculatedAmount)
                          : ""
                      }
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) => setCustomAmountOverride(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                    />
                    <div className="text-[10px] text-slate-400">
                      Auto-calculated from item rate
                    </div>
                  </div>
                </div>

                {/* Live Sticker Preview */}
                {generatedLabel && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-medium text-slate-700">
                        Live Barcode Sticker Preview ({labelSpec.widthMm}×{labelSpec.heightMm}mm)
                      </span>
                      <span className="font-mono text-[#348bdd]">
                        {generatedLabel.barcodeValue}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-100/80 border border-dashed border-slate-300 flex items-center justify-center">
                      <div className="w-full max-w-[260px] rounded-md border border-slate-300 bg-white shadow-sm overflow-hidden">
                        <BarcodeStickerCard
                          item={{
                            headerText: headerText.trim() || HEADER_BRAND_TITLE,
                            productName: selectedProduct.name,
                            packText: generatedLabel.packText,
                            barcodeValue: generatedLabel.barcodeValue,
                            amount: generatedLabel.finalAmount,
                            copies: generatedLabel.copies,
                          }}
                          widthMm={labelSpec.widthMm}
                          heightMm={labelSpec.heightMm}
                          isPrint={false}
                        />
                      </div>
                    </div>

                    {/* POS Scan Compatibility Verification Badge */}
                    <div className="px-3 py-2 rounded-lg bg-emerald-50/70 border border-emerald-200/70 text-[11px] text-emerald-800 flex items-center gap-2 font-mono">
                      <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                      <span className="truncate">
                        POS Scan: <strong>{generatedLabel.posPreview}</strong>
                      </span>
                    </div>

                    {!selectedProduct.barcode && !selectedProduct.shortCode && (
                      <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-center gap-2">
                        <AlertCircle size={13} className="shrink-0" />
                        <span>
                          This product has no barcode set; using Product ID prefix ({generatedLabel.baseCode}).
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons: Print Now + Add to Batch Queue */}
                <div className="grid grid-cols-5 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleAddToQueue}
                    disabled={!generatedLabel}
                    className="col-span-2 py-2.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Plus size={14} />
                    <span>Add to Queue</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintCurrentItem}
                    disabled={!generatedLabel || isPrinting}
                    className="col-span-3 py-2.5 px-3 rounded-lg text-white text-xs font-medium flex items-center justify-center gap-2 cursor-pointer hover:opacity-95 disabled:opacity-50 shadow-xs"
                    style={{ backgroundColor: "var(--color-brand-primary)" }}
                  >
                    {isPrinting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Printer size={14} />
                    )}
                    <span>
                      Print {generatedLabel ? `${generatedLabel.copies} ` : ""}Sticker
                      {generatedLabel && generatedLabel.copies > 1 ? "s" : ""}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Batch Print Queue Card */}
          {printQueue.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers size={14} className="text-[#348bdd]" />
                  <h3 className="text-xs font-medium text-slate-900">
                    Batch Print Queue ({printQueue.length} items • {totalQueueStickers} stickers)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPrintQueue([])}
                  className="text-[11px] text-rose-600 hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              </div>

              <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {printQueue.map((job) => (
                  <div
                    key={job.id}
                    className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">
                        {job.productName}{" "}
                        <span className="text-slate-500 font-normal">({job.packText})</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        {job.barcodeValue} • ₹{job.amount.toFixed(2)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-[#348bdd] font-mono text-[11px]">
                        ×{job.copies}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setPrintQueue((prev) => prev.filter((j) => j.id !== job.id))
                        }
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 border-t border-slate-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={handlePrintBatchQueue}
                  disabled={isPrinting}
                  className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Printer size={14} />
                  <span>Print Entire Queue ({totalQueueStickers} Stickers)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Dedicated Barcode Printer Print Sheet (Hidden on Screen, Exact Label Roll Size on Print) */}
      {activePrintItems && expandedPrintRows.length > 0 && (
        <>
          <style
            dangerouslySetInnerHTML={{
              __html: `
                @media print {
                  @page {
                    size: ${totalRollWidthMm}mm ${labelSpec.heightMm}mm;
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
                  #barcode-label-print-root,
                  #barcode-label-print-root * {
                    visibility: visible !important;
                  }
                  #barcode-label-print-root {
                    display: block !important;
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: ${totalRollWidthMm}mm !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #ffffff !important;
                  }
                  .barcode-print-row {
                    display: flex !important;
                    flex-direction: row !important;
                    width: ${totalRollWidthMm}mm !important;
                    height: ${labelSpec.heightMm}mm !important;
                    gap: ${labelSpec.columns === 2 ? labelSpec.colGapMm : 0}mm !important;
                    page-break-after: always !important;
                    break-after: page !important;
                    overflow: hidden !important;
                  }
                  .barcode-print-row:last-child {
                    page-break-after: auto !important;
                    break-after: auto !important;
                  }
                }
              `,
            }}
          />
          <div id="barcode-label-print-root" className="hidden print:block">
            {expandedPrintRows.map((row, rowIdx) => (
              <div key={rowIdx} className="barcode-print-row">
                {row.map((sticker, colIdx) => (
                  <BarcodeStickerCard
                    key={`${rowIdx}_${colIdx}`}
                    item={sticker}
                    widthMm={labelSpec.widthMm}
                    heightMm={labelSpec.heightMm}
                    isPrint={true}
                  />
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

