"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/components/ToastProvider";

export type PrinterConnectionType = "browser" | "usb" | "bluetooth";
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
  storeName: string;
  storePhone?: string;
  storeAddress?: string;
  customerName?: string;
  customerPhone?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  taxableSubtotal: number;
  cgst: number;
  sgst: number;
  grandTotal: number;
  paymentMethod: string;
  splitDetails?: { cash: number; upi: number; card: number };
  gstNumber?: string;
  fssaiNumber?: string;
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
  connectionType: "browser",
  paperSize: "3inch",
  autoCut: true,
  deviceName: "System Thermal Printer",
  isConnected: false,
};

// Build ESC/POS binary buffer for direct USB / Bluetooth thermal printers
function buildEscPosBuffer(
  data: ReceiptData,
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

  // 1. Initialize Printer (ESC @)
  push(0x1b, 0x40);

  // 2. Header (Center Aligned)
  push(0x1b, 0x61, 0x01); // Center
  push(0x1b, 0x21, 0x30); // Double height + double width for main title
  pushLine("RAVI SWEETS");
  push(0x1b, 0x21, 0x00); // Normal size
  push(0x1b, 0x45, 0x01); // Bold ON
  pushLine("SWEETS, BAKERY & COLD DRINKS");
  push(0x1b, 0x45, 0x00); // Bold OFF
  pushLine(data.storeName || "Chirala Main Store");
  if (data.storeAddress) pushLine(data.storeAddress);
  if (data.storePhone) pushLine("Ph: " + data.storePhone);
  if (data.gstNumber) pushLine("GSTIN: " + data.gstNumber);

  pushLine(divider);

  // 3. Bill Meta (Left Aligned)
  push(0x1b, 0x61, 0x00); // Left align
  pushLine(`Bill #: ${data.orderNumber}`);
  pushLine(`Date  : ${data.dateStr}  ${data.timeStr}`);
  if (data.customerName && data.customerName !== "Walk-In Customer") {
    pushLine(`Cust  : ${data.customerName}`);
    pushLine(`Phone : ${maskedPhone}`);
  } else {
    pushLine(`Type  : Walk-In Counter Takeaway`);
  }

  pushLine(divider);

  // 4. Line Items Table
  if (paperSize === "2inch") {
    // 32 Columns compact layout
    for (const item of data.items) {
      pushLine(item.name);
      const qtyStr = `${item.quantity} ${item.unit}`;
      const amtStr = `Rs.${item.totalAmount.toFixed(2)}`;
      const spaces = Math.max(1, charWidth - qtyStr.length - amtStr.length);
      pushLine(qtyStr + " ".repeat(spaces) + amtStr);
    }
  } else {
    // 48 Columns standard layout
    // Name (22) | Qty (8) | Rate (7) | Amt (11)
    for (const item of data.items) {
      const name = item.name.length > 22 ? item.name.slice(0, 20) + ".." : item.name.padEnd(22, " ");
      const qty = `${item.quantity} ${item.unit}`.padStart(8, " ");
      const rate = `@${item.rate}`.padStart(7, " ");
      const amt = `Rs.${item.totalAmount.toFixed(2)}`.padStart(11, " ");
      pushLine(`${name}${qty}${rate}${amt}`);
    }
  }

  pushLine(divider);

  // 5. Totals
  const padTotal = (lbl: string, val: string) => {
    const spaces = Math.max(1, charWidth - lbl.length - val.length);
    return lbl + " ".repeat(spaces) + val;
  };

  pushLine(padTotal("Subtotal:", `Rs.${data.subtotal.toFixed(2)}`));
  if (data.discount > 0) {
    pushLine(padTotal("Discount:", `-Rs.${data.discount.toFixed(2)}`));
  }
  if (data.cgst > 0) {
    pushLine(padTotal("CGST:", `Rs.${data.cgst.toFixed(2)}`));
  }
  if (data.sgst > 0) {
    pushLine(padTotal("SGST:", `Rs.${data.sgst.toFixed(2)}`));
  }

  push(0x1b, 0x45, 0x01); // Bold ON
  push(0x1b, 0x21, 0x10); // Double height
  pushLine(padTotal("TOTAL DUE:", `Rs.${data.grandTotal.toFixed(2)}`));
  push(0x1b, 0x21, 0x00); // Normal text
  push(0x1b, 0x45, 0x00); // Bold OFF

  pushLine(divider);

  // 6. Payment info
  pushLine(`Payment Mode: ${data.paymentMethod}`);
  if (data.paymentMethod === "Split" && data.splitDetails) {
    pushLine(`  Cash: Rs.${data.splitDetails.cash} | UPI: Rs.${data.splitDetails.upi} | Card: Rs.${data.splitDetails.card}`);
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
  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);

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
        setSettings((prev) => ({
          ...prev,
          ...parsed,
          isConnected: parsed.isConnected ?? false,
        }));

        // If saved as USB, check for authorized device
        if (parsed.connectionType === "usb" && typeof window !== "undefined" && "usb" in navigator) {
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

  // Connect printer handler
  const connectPrinter = useCallback(
    async (
      type: PrinterConnectionType,
      size: PaperSize,
      autoCut: boolean
    ): Promise<boolean> => {
      try {
        if (type === "usb") {
          if (!("usb" in navigator)) {
            showToast("WebUSB not supported in this browser. Switched to system thermal driver.", "info");
            updateSettings({ connectionType: "browser", paperSize: size, autoCut, isConnected: true, deviceName: "System Thermal Driver" });
            return true;
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
            showToast("Web Bluetooth not supported in this browser. Switched to system thermal driver.", "info");
            updateSettings({ connectionType: "browser", paperSize: size, autoCut, isConnected: true, deviceName: "System Thermal Driver" });
            return true;
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
        } else {
          // Standard browser / OS print
          updateSettings({
            connectionType: "browser",
            paperSize: size,
            autoCut,
            deviceName: "System Thermal Driver",
            isConnected: true,
          });
          showToast(`Thermal printer set to ${size === "3inch" ? "80mm / 3\"" : "58mm / 2\""}!`, "success");
          return true;
        }
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
    updateSettings({ isConnected: false, deviceName: "Disconnected" });
    showToast("Thermal printer disconnected", "info");
  }, [updateSettings, showToast]);

  // Execute print job
  const printReceipt = useCallback(
    async (data: ReceiptData): Promise<boolean> => {
      const maskedPhone = maskPhoneNumber(data.customerPhone);

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

        if (device) {
          try {
            const { outEp } = await setupUsbDevice(device);
            const rawBuffer = buildEscPosBuffer(data, settings.paperSize, settings.autoCut, maskedPhone);
            const result = await device.transferOut(outEp, rawBuffer);
            if (result.status === "ok") {
              showToast("Sent directly to USB thermal printer!", "success");
              return true;
            }
          } catch (usbErr: any) {
            console.warn("Direct USB transfer failed, falling back to system print:", usbErr);
          }
        }
      }

      // 2. Direct Web Bluetooth Transmission
      if (settings.connectionType === "bluetooth" && bluetoothCharRef.current) {
        try {
          const char = bluetoothCharRef.current;
          const rawBuffer = buildEscPosBuffer(data, settings.paperSize, settings.autoCut, maskedPhone);
          const CHUNK = 128;
          for (let i = 0; i < rawBuffer.length; i += CHUNK) {
            const chunk = rawBuffer.slice(i, i + CHUNK);
            await char.writeValue(chunk);
          }
          showToast("Sent directly to Bluetooth thermal printer!", "success");
          return true;
        } catch (btErr: any) {
          console.warn("Direct Bluetooth write failed, falling back to system print:", btErr);
        }
      }

      // 3. Infallible In-Page Slip Print Engine (Works with all Windows USB Thermal Drivers, POS-80, POS-58, etc.)
      try {
        setActiveReceipt(data);
        // Wait a frame for React to render the printable receipt into DOM
        setTimeout(() => {
          window.focus();
          window.print();
        }, 120);
        return true;
      } catch (err: any) {
        console.error("Print receipt error:", err);
        showToast("Error triggering print: " + err.message, "error");
        return false;
      }
    },
    [settings, maskPhoneNumber, showToast]
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
              RAVI SWEETS
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
            {activeReceipt.gstNumber && (
              <div style={{ fontSize: "8px" }}>GSTIN: {activeReceipt.gstNumber}</div>
            )}
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
              {activeReceipt.customerName && activeReceipt.customerName !== "Walk-In Customer" ? (
                <tr>
                  <td style={{ textAlign: "left" }}>
                    <strong>Cust:</strong> {activeReceipt.customerName}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <strong>Ph:</strong> {maskPhoneNumber(activeReceipt.customerPhone)}
                  </td>
                </tr>
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
                    ₹{item.rate}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      padding: "2px 0",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    ₹{item.totalAmount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

          <table style={{ width: "100%", fontSize: "10px", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ textAlign: "left" }}>Subtotal:</td>
                <td style={{ textAlign: "right" }}>₹{activeReceipt.subtotal.toFixed(2)}</td>
              </tr>
              {activeReceipt.discount > 0 && (
                <tr>
                  <td style={{ textAlign: "left" }}>Discount:</td>
                  <td style={{ textAlign: "right" }}>-₹{activeReceipt.discount.toFixed(2)}</td>
                </tr>
              )}
              {(activeReceipt.cgst > 0 || activeReceipt.sgst > 0) && (
                <>
                  <tr>
                    <td style={{ textAlign: "left" }}>CGST:</td>
                    <td style={{ textAlign: "right" }}>₹{activeReceipt.cgst.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style={{ textAlign: "left" }}>SGST:</td>
                    <td style={{ textAlign: "right" }}>₹{activeReceipt.sgst.toFixed(2)}</td>
                  </tr>
                </>
              )}
              <tr style={{ fontSize: "12px", fontWeight: "bold", borderTop: "1px solid #000" }}>
                <td style={{ textAlign: "left", paddingTop: "3px" }}>TOTAL AMOUNT:</td>
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
