"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";

export type PrinterConnectionType = "usb" | "bluetooth";
export type PaperSize = "3inch" | "2inch"; // 3inch = 80mm, 2inch = 58mm

export interface PrinterSettings {
  connectionType: PrinterConnectionType;
  paperSize: PaperSize;
  autoCut: boolean;
  deviceName?: string;
  isConnected: boolean;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  unit: string;
  rate: number;
  totalAmount: number;
}

export interface ReceiptData {
  orderNumber: string;
  dateStr: string;
  timeStr: string;
  billTitle?: string;
  tradeName?: string;
  legalName?: string;
  storeName: string;
  storePhone?: string;
  storeAddress?: string;
  storeEmail?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerGstNumber?: string;
  deliveryDate?: string;
  deliveryTime?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  taxableSubtotal: number;
  cgst: number;
  sgst: number;
  cgstPercentage?: number;
  sgstPercentage?: number;
  gstPercentage?: number;
  isGstEnabled?: boolean;
  gstType?: string;
  roundOff?: number;
  grandTotal: number;
  receivedAmount?: number;
  balanceAmount?: number;
  paymentStatus?: string;
  paymentMethod: string;
  splitDetails?: { cash: number; upi: number; card: number };
  packingDescription?: string;
  gstNumber?: string;
  fssaiNumber?: string;
}

interface LiveBusinessSettings {
  tradeName: string;
  legalName: string;
  phone: string;
  altPhone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

interface LiveGstSettings {
  enabled: boolean;
  gstNumber: string;
  gstPercentage: number;
  pricingType: "inclusive" | "exclusive";
}

function enrichReceiptData(
  raw: ReceiptData,
  biz: LiveBusinessSettings,
  gst: LiveGstSettings
): ReceiptData & {
  resolvedCgstPct: number;
  resolvedSgstPct: number;
  resolvedGstPct: number;
  resolvedTotalGst: number;
  resolvedRoundOff: number;
  hasGst: boolean;
} {
  const fullBizAddress = [biz.address, biz.city, biz.state, biz.pincode]
    .filter(Boolean)
    .join(", ");

  const tradeName = raw.tradeName || biz.tradeName || "RAVI SWEETS";
  const legalName = raw.legalName || biz.legalName || "";
  const storeAddress = raw.storeAddress || fullBizAddress || "Chirala, Andhra Pradesh";
  const storePhone = raw.storePhone || biz.phone || "";
  const storeEmail = raw.storeEmail || biz.email || "";
  const gstNumber = raw.gstNumber || gst.gstNumber || "";

  let subtotal = Number(raw.subtotal) || 0;
  let discount = Number(raw.discount) || 0;
  let taxableSubtotal = Number(raw.taxableSubtotal) || 0;
  let cgst = Number(raw.cgst) || 0;
  let sgst = Number(raw.sgst) || 0;
  const grandTotal = Number(raw.grandTotal) || 0;

  let resolvedGstPct =
    raw.gstPercentage !== undefined && Number(raw.gstPercentage) > 0
      ? Number(raw.gstPercentage)
      : gst.enabled && gst.gstPercentage > 0
      ? gst.gstPercentage
      : 0;

  // If caller passed 0 GST, but GST is enabled in Settings (and caller didn't explicitly disable GST),
  // calculate inclusive breakdown so grandTotal stays unchanged and every GST value appears on the bill.
  const gstAllowed = raw.isGstEnabled !== false;
  if (cgst <= 0 && sgst <= 0 && gstAllowed && resolvedGstPct > 0 && grandTotal > 0) {
    const baseNet = Number((grandTotal / (1 + resolvedGstPct / 100)).toFixed(2));
    const totalTax = Number((grandTotal - baseNet).toFixed(2));
    const halfTax = Number((totalTax / 2).toFixed(2));
    cgst = halfTax;
    sgst = Number((totalTax - halfTax).toFixed(2));
    taxableSubtotal = baseNet;
    if (discount > 0) {
      const baseDiscount = Number((discount / (1 + resolvedGstPct / 100)).toFixed(2));
      discount = baseDiscount;
      subtotal = Number((baseNet + baseDiscount).toFixed(2));
    } else {
      subtotal = baseNet;
    }
  } else {
    if (taxableSubtotal <= 0 && subtotal > 0) {
      taxableSubtotal = Number(Math.max(0, subtotal - discount).toFixed(2));
    }
  }

  const resolvedTotalGst = Number((cgst + sgst).toFixed(2));
  const hasGst = resolvedTotalGst > 0 || (gstAllowed && resolvedGstPct > 0);

  let resolvedCgstPct =
    raw.cgstPercentage !== undefined && raw.cgstPercentage > 0
      ? Number(raw.cgstPercentage)
      : resolvedGstPct > 0
      ? Number((resolvedGstPct / 2).toFixed(2))
      : taxableSubtotal > 0 && cgst > 0
      ? Number(((cgst / taxableSubtotal) * 100).toFixed(2))
      : 0;

  let resolvedSgstPct =
    raw.sgstPercentage !== undefined && raw.sgstPercentage > 0
      ? Number(raw.sgstPercentage)
      : resolvedGstPct > 0
      ? Number((resolvedGstPct / 2).toFixed(2))
      : taxableSubtotal > 0 && sgst > 0
      ? Number(((sgst / taxableSubtotal) * 100).toFixed(2))
      : 0;

  if (resolvedGstPct === 0 && (resolvedCgstPct > 0 || resolvedSgstPct > 0)) {
    resolvedGstPct = Number((resolvedCgstPct + resolvedSgstPct).toFixed(2));
  }

  const expectedTotal = Number((taxableSubtotal + resolvedTotalGst).toFixed(2));
  const computedDiff = Number((grandTotal - expectedTotal).toFixed(2));
  const resolvedRoundOff =
    raw.roundOff !== undefined
      ? Number(raw.roundOff)
      : Math.abs(computedDiff) >= 0.01 && Math.abs(computedDiff) < 1
      ? computedDiff
      : 0;

  return {
    ...raw,
    tradeName,
    legalName,
    storeAddress,
    storePhone,
    storeEmail,
    gstNumber,
    gstType: raw.gstType || gst.pricingType || "inclusive",
    subtotal,
    discount,
    taxableSubtotal,
    cgst,
    sgst,
    gstPercentage: resolvedGstPct,
    cgstPercentage: resolvedCgstPct,
    sgstPercentage: resolvedSgstPct,
    grandTotal,
    resolvedCgstPct,
    resolvedSgstPct,
    resolvedGstPct,
    resolvedTotalGst,
    resolvedRoundOff,
    hasGst,
  };
}

interface PrinterContextType {
  settings: PrinterSettings;
  updateSettings: (newSettings: Partial<PrinterSettings>) => void;
  isConnectModalOpen: boolean;
  setIsConnectModalOpen: (open: boolean) => void;
  connectPrinter: (type: PrinterConnectionType, size: PaperSize, autoCut: boolean) => Promise<boolean>;
  disconnectPrinter: () => void;
  printReceipt: (data: ReceiptData) => Promise<boolean>;
  maskPhoneNumber: (phone?: string) => string;
}

const defaultSettings: PrinterSettings = {
  connectionType: "usb",
  paperSize: "3inch",
  autoCut: true,
  deviceName: "",
  isConnected: false,
};

// Build ESC/POS binary buffer for direct USB / Bluetooth thermal printers
function buildEscPosBuffer(
  data: ReturnType<typeof enrichReceiptData>,
  paperSize: PaperSize,
  autoCut: boolean,
  maskedPhone: string
): Uint8Array {
  const bytes: number[] = [];
  const push = (...b: number[]) => bytes.push(...b);
  const pushStr = (str: string) => {
    const enc = new TextEncoder().encode(str);
    for (let i = 0; i < enc.length; i++) bytes.push(enc[i]);
  };
  const pushLine = (str: string = "") => pushStr(str + "\n");

  const charWidth = paperSize === "2inch" ? 32 : 48;
  const divider = "-".repeat(charWidth);
  const doubleDivider = "=".repeat(charWidth);

  const padRow = (lbl: string, val: string) => {
    const spaces = Math.max(1, charWidth - lbl.length - val.length);
    return lbl + " ".repeat(spaces) + val;
  };

  // 1. Initialize Printer (ESC @)
  push(0x1b, 0x40);

  // 2. Header (Center Aligned)
  push(0x1b, 0x61, 0x01); // Center
  push(0x1b, 0x21, 0x30); // Double height + double width for main title
  pushLine((data.tradeName || "RAVI SWEETS").toUpperCase());
  push(0x1b, 0x21, 0x00); // Normal size
  push(0x1b, 0x45, 0x01); // Bold ON
  pushLine("SWEETS, BAKERY & COLD DRINKS");
  push(0x1b, 0x45, 0x00); // Bold OFF
  if (data.storeName) pushLine(data.storeName);
  if (data.storeAddress) pushLine(data.storeAddress);
  if (data.storePhone) pushLine("Ph: " + data.storePhone);
  if (data.storeEmail) pushLine("Email: " + data.storeEmail);
  if (data.gstNumber) {
    push(0x1b, 0x45, 0x01);
    pushLine("GSTIN: " + data.gstNumber);
    push(0x1b, 0x45, 0x00);
  }
  pushLine(divider);
  push(0x1b, 0x45, 0x01);
  pushLine(data.billTitle || (data.hasGst ? "TAX INVOICE" : "BILL RECEIPT"));
  push(0x1b, 0x45, 0x00);
  pushLine(divider);

  // 3. Bill Meta (Left Aligned)
  push(0x1b, 0x61, 0x00); // Left align
  pushLine(`Bill #: ${data.orderNumber}`);
  pushLine(`Date  : ${data.dateStr}  ${data.timeStr}`);
  if (data.deliveryDate && data.deliveryDate !== data.dateStr) {
    pushLine(`Deliv : ${data.deliveryDate} ${data.deliveryTime || ""}`.trim());
  }
  if (data.customerName && data.customerName !== "Walk-In Customer") {
    pushLine(`Cust  : ${data.customerName}`);
    if (data.customerPhone) pushLine(`Phone : ${maskedPhone}`);
    if (data.customerAddress) pushLine(`Addr  : ${data.customerAddress}`);
    if (data.customerGstNumber) pushLine(`C-GST : ${data.customerGstNumber}`);
  } else {
    pushLine(`Type  : Walk-In Counter Takeaway`);
  }

  pushLine(divider);

  // 4. Line Items Table
  if (paperSize === "2inch") {
    // 32 Columns compact layout
    push(0x1b, 0x45, 0x01);
    pushLine(padRow("ITEM / QTY x RATE", "AMOUNT"));
    push(0x1b, 0x45, 0x00);
    pushLine(divider);
    for (const item of data.items) {
      pushLine(item.name);
      const qtyRateStr = `${item.quantity} ${item.unit} x Rs.${Number(item.rate).toFixed(2)}`;
      const amtStr = `Rs.${Number(item.totalAmount).toFixed(2)}`;
      pushLine(padRow(qtyRateStr, amtStr));
    }
  } else {
    // 48 Columns standard layout
    // Name (20) | Qty (9) | Rate (8) | Amt (11)
    push(0x1b, 0x45, 0x01);
    pushLine("ITEM".padEnd(20, " ") + "QTY".padStart(9, " ") + "RATE".padStart(8, " ") + "AMOUNT".padStart(11, " "));
    push(0x1b, 0x45, 0x00);
    pushLine(divider);
    for (const item of data.items) {
      const name = item.name.length > 20 ? item.name.slice(0, 18) + ".." : item.name.padEnd(20, " ");
      const qty = `${item.quantity} ${item.unit}`.padStart(9, " ");
      const rate = `@${Number(item.rate).toFixed(0)}`.padStart(8, " ");
      const amt = `Rs.${Number(item.totalAmount).toFixed(2)}`.padStart(11, " ");
      pushLine(`${name}${qty}${rate}${amt}`);
    }
  }

  pushLine(divider);
  pushLine(padRow("Total Items:", `${data.items.length}`));
  pushLine(divider);

  // 5. Complete Totals & Tax Breakdown
  pushLine(padRow("Items Subtotal:", `Rs.${data.subtotal.toFixed(2)}`));
  if (data.discount > 0) {
    pushLine(padRow("Discount:", `-Rs.${data.discount.toFixed(2)}`));
  }
  pushLine(padRow("Taxable Value:", `Rs.${data.taxableSubtotal.toFixed(2)}`));

  if (data.hasGst || data.cgst > 0 || data.sgst > 0) {
    pushLine(padRow(`CGST (${data.resolvedCgstPct}%):`, `Rs.${data.cgst.toFixed(2)}`));
    pushLine(padRow(`SGST (${data.resolvedSgstPct}%):`, `Rs.${data.sgst.toFixed(2)}`));
    pushLine(padRow(`Total GST (${data.resolvedGstPct}%):`, `Rs.${data.resolvedTotalGst.toFixed(2)}`));
    if (data.gstType) {
      const modeLabel = data.gstType === "exclusive" ? "Exclusive of Price" : "Inclusive in Price";
      pushLine(padRow("GST Mode:", modeLabel));
    }
  }

  if (Math.abs(data.resolvedRoundOff) >= 0.01) {
    const sign = data.resolvedRoundOff > 0 ? "+" : "-";
    pushLine(padRow("Round Off:", `${sign}Rs.${Math.abs(data.resolvedRoundOff).toFixed(2)}`));
  }

  pushLine(divider);
  push(0x1b, 0x45, 0x01); // Bold ON
  push(0x1b, 0x21, 0x10); // Double height
  pushLine(padRow("GRAND TOTAL:", `Rs.${data.grandTotal.toFixed(2)}`));
  push(0x1b, 0x21, 0x00); // Normal text
  push(0x1b, 0x45, 0x00); // Bold OFF
  pushLine(divider);

  // 6. Payment Info
  pushLine(padRow("Payment Mode:", data.paymentMethod));
  if (data.paymentMethod === "Split" && data.splitDetails) {
    pushLine(`  Cash: Rs.${data.splitDetails.cash} | UPI: Rs.${data.splitDetails.upi} | Card: Rs.${data.splitDetails.card}`);
  }
  if (data.paymentStatus) {
    pushLine(padRow("Payment Status:", data.paymentStatus));
  }
  if (data.receivedAmount !== undefined) {
    pushLine(padRow("Amount Paid:", `Rs.${Number(data.receivedAmount).toFixed(2)}`));
  }
  if (data.balanceAmount !== undefined && Number(data.balanceAmount) > 0) {
    push(0x1b, 0x45, 0x01);
    pushLine(padRow("Balance Due:", `Rs.${Number(data.balanceAmount).toFixed(2)}`));
    push(0x1b, 0x45, 0x00);
  } else if (data.balanceAmount !== undefined && Number(data.balanceAmount) < 0) {
    pushLine(padRow("Change Return:", `Rs.${Math.abs(Number(data.balanceAmount)).toFixed(2)}`));
  }
  if (data.packingDescription) {
    pushLine(`Note: ${data.packingDescription}`);
  }

  // 7. Footer
  push(0x1b, 0x61, 0x01); // Center
  pushLine(doubleDivider);
  pushLine("Thank You! Visit Again");
  pushLine("Pure Ghee Sweets & Savouries Since 1984");
  if (data.fssaiNumber) pushLine(`FSSAI Lic: ${data.fssaiNumber}`);

  // 8. Feed 5 lines for tear-off
  push(0x1b, 0x64, 0x05);

  // 9. Hardware Auto-Cut
  if (autoCut) {
    push(0x1d, 0x56, 0x41, 0x00); // Full cut
  }

  return new Uint8Array(bytes);
}

const PrinterContext = createContext<PrinterContextType | undefined>(undefined);

export function PrinterProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<PrinterSettings>(defaultSettings);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [activeReceipt, setActiveReceipt] = useState<ReturnType<typeof enrichReceiptData> | null>(null);

  // Live Firestore Business Profile & GST Settings for complete bills everywhere
  const [bizSettings, setBizSettings] = useState<LiveBusinessSettings>({
    tradeName: "Ravi Sweets & Cold Drinks",
    legalName: "Ravi Sweets",
    phone: "",
    altPhone: "",
    email: "",
    address: "",
    city: "Chirala",
    state: "Andhra Pradesh",
    pincode: "",
  });
  const [gstSettings, setGstSettings] = useState<LiveGstSettings>({
    enabled: true,
    gstNumber: "",
    gstPercentage: 5,
    pricingType: "inclusive",
  });

  useEffect(() => {
    const unsubBiz = onSnapshot(
      doc(db, "settings", "business_profile"),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setBizSettings((prev) => ({
            ...prev,
            tradeName: d.tradeName || prev.tradeName,
            legalName: d.legalName || prev.legalName,
            phone: d.phone || prev.phone,
            altPhone: d.altPhone || prev.altPhone,
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
          setGstSettings({
            enabled: !!d.enabled,
            gstNumber: d.gstNumber || "",
            gstPercentage: Number(d.gstPercentage) || 0,
            pricingType: d.pricingType === "exclusive" ? "exclusive" : "inclusive",
          });
        }
      },
      () => {}
    );

    return () => {
      unsubBiz();
      unsubGst();
    };
  }, []);

  // Store active hardware handles in refs to avoid re-renders
  const usbDeviceRef = useRef<any>(null);
  const bluetoothCharRef = useRef<any>(null);

  // Helper to find OUT endpoint and claim interface
  const setupUsbDevice = async (device: any) => {
    if (!device.opened) {
      await device.open();
    }
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }
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
    } catch (e) {
      // might already be claimed
    }
    return { ifaceNum, outEp };
  };

  // Load saved printer configuration & Auto-reconnect WebUSB if previously paired
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ravi_sweets_printer_config");
      if (saved) {
        const parsed = JSON.parse(saved);
        const connectionType: PrinterConnectionType =
          parsed.connectionType === "bluetooth" ? "bluetooth" : "usb";
        setSettings((prev) => ({
          ...prev,
          ...parsed,
          connectionType,
          isConnected: parsed.isConnected ?? false,
          deviceName: parsed.isConnected ? parsed.deviceName || "Thermal Printer" : "",
        }));

        // If saved as USB, check for authorized device
        if (connectionType === "usb" && typeof window !== "undefined" && "usb" in navigator) {
          (navigator as any).usb.getDevices().then(async (devices: any[]) => {
            if (devices.length > 0 && !usbDeviceRef.current) {
              try {
                const dev = devices[0];
                await setupUsbDevice(dev);
                usbDeviceRef.current = dev;
                setSettings((prev) => ({
                  ...prev,
                  isConnected: true,
                  deviceName: dev.productName || "USB Thermal Printer",
                }));
              } catch (usbAutoErr) {
                console.warn("Auto-reconnect to USB printer failed:", usbAutoErr);
              }
            }
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.warn("Failed to read printer settings:", e);
    }
  }, []);

  // Save settings
  const updateSettings = useCallback((newSettings: Partial<PrinterSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(
          "ravi_sweets_printer_config",
          JSON.stringify({
            connectionType: updated.connectionType,
            paperSize: updated.paperSize,
            autoCut: updated.autoCut,
            deviceName: updated.deviceName,
            isConnected: updated.isConnected,
          })
        );
      } catch (e) {
        console.warn("Failed to write printer settings:", e);
      }
      return updated;
    });
  }, []);

  // Mask phone number: 9876543210 -> 98765****0
  const maskPhoneNumber = useCallback((phone?: string): string => {
    if (!phone) return "—";
    const clean = phone.trim().replace(/\s+/g, "");
    if (clean.length < 5) return clean;
    const len = clean.length;
    const start = clean.slice(0, Math.min(3, Math.floor(len / 3)));
    const end = clean.slice(-2);
    const maskedLen = Math.max(2, len - start.length - end.length);
    return `${start}${"*".repeat(maskedLen)}${end}`;
  }, []);

  // Connect printer handler (Only WebUSB and Web Bluetooth)
  const connectPrinter = useCallback(
    async (
      type: PrinterConnectionType,
      size: PaperSize,
      autoCut: boolean
    ): Promise<boolean> => {
      try {
        if (type === "usb") {
          if (!("usb" in navigator)) {
            showToast("WebUSB is not supported in this browser. Please use Chrome or Edge.", "error");
            return false;
          }

          // Request USB thermal printer device
          const device = await (navigator as any).usb.requestDevice({ filters: [] });
          await setupUsbDevice(device);
          usbDeviceRef.current = device;
          const devName = device.productName || "USB Thermal Printer";
          updateSettings({
            connectionType: "usb",
            paperSize: size,
            autoCut,
            deviceName: devName,
            isConnected: true,
          });
          showToast(`Direct WebUSB connected to ${devName}!`, "success");
          return true;
        } else if (type === "bluetooth") {
          if (!("bluetooth" in navigator)) {
            showToast("Web Bluetooth is not supported in this browser. Please use Chrome or Edge.", "error");
            return false;
          }

          // Request Bluetooth device with printer service
          const device = await (navigator as any).bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [
              "000018f0-0000-1000-8000-00805f9b34fb",
              "0000ff00-0000-1000-8000-00805f9b34fb",
              "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
              "49535343-fe7d-4ae5-8fa9-9fafd205e455",
            ],
          });

          const server = await device.gatt?.connect();
          const services = await server.getPrimaryServices();
          let writeChar: any = null;
          for (const s of services) {
            const chars = await s.getCharacteristics();
            for (const c of chars) {
              if (c.properties.write || c.properties.writeWithoutResponse) {
                writeChar = c;
                break;
              }
            }
            if (writeChar) break;
          }

          if (writeChar) {
            bluetoothCharRef.current = writeChar;
          }

          const devName = device.name || "Bluetooth Thermal Printer";
          updateSettings({
            connectionType: "bluetooth",
            paperSize: size,
            autoCut,
            deviceName: devName,
            isConnected: true,
          });
          showToast(`Direct Bluetooth connected to ${devName}!`, "success");
          return true;
        }

        return false;
      } catch (err: any) {
        if (err.name !== "NotFoundError") {
          console.error("Printer connection error:", err);
          showToast("Connection error: " + err.message, "error");
        }
        return false;
      }
    },
    [showToast, updateSettings]
  );

  const disconnectPrinter = useCallback(() => {
    if (usbDeviceRef.current && usbDeviceRef.current.opened) {
      try {
        usbDeviceRef.current.close();
      } catch (e) {}
    }
    usbDeviceRef.current = null;
    bluetoothCharRef.current = null;
    updateSettings({ isConnected: false, deviceName: "" });
    showToast("Thermal printer disconnected", "info");
  }, [updateSettings, showToast]);

  // Execute print job (Strictly Direct WebUSB or Web Bluetooth)
  const printReceipt = useCallback(
    async (data: ReceiptData): Promise<boolean> => {
      if (!settings.isConnected) {
        showToast("No thermal printer connected. Please click Connect to pair your printer.", "error");
        setIsConnectModalOpen(true);
        return false;
      }

      const enriched = enrichReceiptData(data, bizSettings, gstSettings);
      const maskedPhone = maskPhoneNumber(enriched.customerPhone);

      // 1. Direct WebUSB Transmission
      if (settings.connectionType === "usb") {
        let device = usbDeviceRef.current;
        if (!device && typeof window !== "undefined" && "usb" in navigator) {
          try {
            const devices = await (navigator as any).usb.getDevices();
            if (devices.length > 0) {
              device = devices[0];
              usbDeviceRef.current = device;
            }
          } catch (e) {}
        }

        if (!device) {
          showToast("USB printer not detected. Please reconnect your printer.", "error");
          setIsConnectModalOpen(true);
          return false;
        }

        try {
          const { outEp } = await setupUsbDevice(device);
          const rawBuffer = buildEscPosBuffer(enriched, settings.paperSize, settings.autoCut, maskedPhone);
          const result = await device.transferOut(outEp, rawBuffer);
          if (result.status === "ok") {
            showToast("Printed successfully via USB!", "success");
            return true;
          } else {
            showToast("USB transfer status: " + result.status, "error");
            return false;
          }
        } catch (usbErr: any) {
          console.error("Direct USB transfer failed:", usbErr);
          showToast("USB print error: " + (usbErr.message || "Failed to communicate with printer"), "error");
          return false;
        }
      }

      // 2. Direct Web Bluetooth Transmission
      if (settings.connectionType === "bluetooth") {
        if (!bluetoothCharRef.current) {
          showToast("Bluetooth printer not connected. Please reconnect your printer.", "error");
          setIsConnectModalOpen(true);
          return false;
        }

        try {
          const char = bluetoothCharRef.current;
          const rawBuffer = buildEscPosBuffer(enriched, settings.paperSize, settings.autoCut, maskedPhone);
          const CHUNK = 128;
          for (let i = 0; i < rawBuffer.length; i += CHUNK) {
            const chunk = rawBuffer.slice(i, i + CHUNK);
            await char.writeValue(chunk);
          }
          showToast("Printed successfully via Bluetooth!", "success");
          return true;
        } catch (btErr: any) {
          console.error("Direct Bluetooth write failed:", btErr);
          showToast("Bluetooth print error: " + (btErr.message || "Failed to communicate with printer"), "error");
          return false;
        }
      }

      return false;
    },
    [settings, bizSettings, gstSettings, maskPhoneNumber, showToast, setIsConnectModalOpen]
  );

  return (
    <PrinterContext.Provider
      value={{
        settings,
        updateSettings,
        isConnectModalOpen,
        setIsConnectModalOpen,
        connectPrinter,
        disconnectPrinter,
        printReceipt,
        maskPhoneNumber,
      }}
    >
      {children}

      {/* Dedicated Thermal Receipt Container for System Print Dialog */}
      {activeReceipt && (
        <div
          id="thermal-receipt-root"
          style={{
            width: settings.paperSize === "2inch" ? "58mm" : "80mm",
            margin: "0 auto",
            padding: "2mm 3mm",
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: settings.paperSize === "2inch" ? "10px" : "11px",
            lineHeight: 1.25,
            color: "#000",
            backgroundColor: "#fff",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "15px", fontWeight: "bold", letterSpacing: "0.5px" }}>
              {(activeReceipt.tradeName || "RAVI SWEETS").toUpperCase()}
            </div>
            <div style={{ fontSize: "9.5px", fontWeight: "bold" }}>
              SWEETS, BAKERY & COLD DRINKS
            </div>
            <div style={{ fontSize: "9px" }}>{activeReceipt.storeName || "Chirala Main Store"}</div>
            {activeReceipt.storeAddress && (
              <div style={{ fontSize: "8px" }}>{activeReceipt.storeAddress}</div>
            )}
            {activeReceipt.storePhone && (
              <div style={{ fontSize: "8px" }}>Ph: {activeReceipt.storePhone}</div>
            )}
            {activeReceipt.storeEmail && (
              <div style={{ fontSize: "8px" }}>Email: {activeReceipt.storeEmail}</div>
            )}
            {activeReceipt.gstNumber && (
              <div style={{ fontSize: "8.5px", fontWeight: "bold" }}>GSTIN: {activeReceipt.gstNumber}</div>
            )}
            <div style={{ fontSize: "9.5px", fontWeight: "bold", marginTop: "2px" }}>
              {activeReceipt.billTitle || (activeReceipt.hasGst ? "TAX INVOICE" : "BILL RECEIPT")}
            </div>
          </div>

          <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

          <table style={{ width: "100%", fontSize: "9.5px", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ textAlign: "left" }}>
                  <strong>Bill #:</strong> {activeReceipt.orderNumber}
                </td>
                <td style={{ textAlign: "right" }}>
                  {activeReceipt.dateStr} {activeReceipt.timeStr}
                </td>
              </tr>
              {activeReceipt.deliveryDate && activeReceipt.deliveryDate !== activeReceipt.dateStr && (
                <tr>
                  <td colSpan={2} style={{ textAlign: "left" }}>
                    <strong>Delivery:</strong> {activeReceipt.deliveryDate} {activeReceipt.deliveryTime || ""}
                  </td>
                </tr>
              )}
              {activeReceipt.customerName && activeReceipt.customerName !== "Walk-In Customer" ? (
                <>
                  <tr>
                    <td style={{ textAlign: "left" }}>
                      <strong>Cust:</strong> {activeReceipt.customerName}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <strong>Ph:</strong> {maskPhoneNumber(activeReceipt.customerPhone)}
                    </td>
                  </tr>
                  {activeReceipt.customerAddress && (
                    <tr>
                      <td colSpan={2} style={{ textAlign: "left", fontSize: "8.5px" }}>
                        <strong>Addr:</strong> {activeReceipt.customerAddress}
                      </td>
                    </tr>
                  )}
                  {activeReceipt.customerGstNumber && (
                    <tr>
                      <td colSpan={2} style={{ textAlign: "left", fontSize: "8.5px" }}>
                        <strong>Cust GSTIN:</strong> {activeReceipt.customerGstNumber}
                      </td>
                    </tr>
                  )}
                </>
              ) : (
                <tr>
                  <td colSpan={2} style={{ textAlign: "left" }}>
                    <strong>Type:</strong> Walk-In Counter Sale
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

          <table style={{ width: "100%", fontSize: "9.5px", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px dashed #000", textTransform: "uppercase" }}>
                <th style={{ textAlign: "left", paddingBottom: "2px" }}>Item</th>
                <th style={{ textAlign: "right", paddingBottom: "2px" }}>Qty</th>
                <th style={{ textAlign: "right", paddingBottom: "2px" }}>Rate</th>
                <th style={{ textAlign: "right", paddingBottom: "2px" }}>Amt</th>
              </tr>
            </thead>
            <tbody>
              {activeReceipt.items.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ textAlign: "left", padding: "2px 0", fontWeight: 500 }}>
                    {item.name}
                  </td>
                  <td style={{ textAlign: "right", padding: "2px 0", whiteSpace: "nowrap" }}>
                    {item.quantity} {item.unit}
                  </td>
                  <td style={{ textAlign: "right", padding: "2px 0", whiteSpace: "nowrap" }}>
                    ₹{Number(item.rate).toFixed(2)}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "2px 0",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    ₹{Number(item.totalAmount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

          <table style={{ width: "100%", fontSize: "10px", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ textAlign: "left" }}>Items Subtotal:</td>
                <td style={{ textAlign: "right" }}>₹{activeReceipt.subtotal.toFixed(2)}</td>
              </tr>
              {activeReceipt.discount > 0 && (
                <tr>
                  <td style={{ textAlign: "left" }}>Discount:</td>
                  <td style={{ textAlign: "right" }}>-₹{activeReceipt.discount.toFixed(2)}</td>
                </tr>
              )}
              <tr>
                <td style={{ textAlign: "left" }}>Taxable Value:</td>
                <td style={{ textAlign: "right" }}>₹{activeReceipt.taxableSubtotal.toFixed(2)}</td>
              </tr>
              {(activeReceipt.hasGst || activeReceipt.cgst > 0 || activeReceipt.sgst > 0) && (
                <>
                  <tr>
                    <td style={{ textAlign: "left" }}>
                      CGST ({activeReceipt.resolvedCgstPct}%):
                    </td>
                    <td style={{ textAlign: "right" }}>₹{activeReceipt.cgst.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style={{ textAlign: "left" }}>
                      SGST ({activeReceipt.resolvedSgstPct}%):
                    </td>
                    <td style={{ textAlign: "right" }}>₹{activeReceipt.sgst.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style={{ textAlign: "left", fontWeight: 600 }}>
                      Total GST ({activeReceipt.resolvedGstPct}%):
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>
                      ₹{activeReceipt.resolvedTotalGst.toFixed(2)}
                    </td>
                  </tr>
                </>
              )}
              {Math.abs(activeReceipt.resolvedRoundOff) >= 0.01 && (
                <tr>
                  <td style={{ textAlign: "left" }}>Round Off:</td>
                  <td style={{ textAlign: "right" }}>
                    {activeReceipt.resolvedRoundOff > 0 ? "+" : "-"}₹{Math.abs(activeReceipt.resolvedRoundOff).toFixed(2)}
                  </td>
                </tr>
              )}
              <tr style={{ fontSize: "12px", fontWeight: "bold", borderTop: "1px solid #000" }}>
                <td style={{ textAlign: "left", paddingTop: "3px" }}>GRAND TOTAL:</td>
                <td style={{ textAlign: "right", paddingTop: "3px" }}>
                  ₹{activeReceipt.grandTotal.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

          <div style={{ fontSize: "9.5px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Payment Mode:</span>
              <strong>{activeReceipt.paymentMethod}</strong>
            </div>
            {activeReceipt.paymentMethod === "Split" && activeReceipt.splitDetails && (
              <div style={{ fontSize: "9px", color: "#555", textAlign: "right", marginTop: "2px" }}>
                (Cash: ₹{activeReceipt.splitDetails.cash} | UPI: ₹{activeReceipt.splitDetails.upi} | Card: ₹{activeReceipt.splitDetails.card})
              </div>
            )}
            {activeReceipt.paymentStatus && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Payment Status:</span>
                <strong>{activeReceipt.paymentStatus}</strong>
              </div>
            )}
            {activeReceipt.receivedAmount !== undefined && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Amount Paid:</span>
                <span>₹{Number(activeReceipt.receivedAmount).toFixed(2)}</span>
              </div>
            )}
            {activeReceipt.balanceAmount !== undefined && Number(activeReceipt.balanceAmount) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
                <span>Balance Due:</span>
                <span>₹{Number(activeReceipt.balanceAmount).toFixed(2)}</span>
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px double #000", margin: "4px 0" }} />

          <div style={{ textAlign: "center", fontSize: "9px", marginTop: "3px" }}>
            <div>Thank You! Visit Again</div>
            <div style={{ fontSize: "8px", color: "#444", marginTop: "1px" }}>
              Quality Sweets & Ghee Specialties Since 1984
            </div>
            {activeReceipt.fssaiNumber && (
              <div style={{ fontSize: "7.5px" }}>FSSAI Lic No: {activeReceipt.fssaiNumber}</div>
            )}
          </div>
          {settings.autoCut && (
            <div
              style={{
                marginTop: "8mm",
                textAlign: "center",
                fontSize: "8px",
                color: "#777",
              }}
            >
              --- CUT HERE ---
            </div>
          )}
        </div>
      )}
    </PrinterContext.Provider>
  );
}


export function usePrinter() {
  const ctx = useContext(PrinterContext);
  if (!ctx) {
    throw new Error("usePrinter must be used within a PrinterProvider");
  }
  return ctx;
}
