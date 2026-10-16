"use client";

import React, { useState } from "react";
import { usePrinter, PrinterConnectionType, PaperSize } from "@/context/PrinterContext";
import {
  Printer,
  Usb,
  Bluetooth,
  Scissors,
  CheckCircle2,
  X,
  Loader2,
  AlertCircle,
  FileText,
  Unplug,
} from "lucide-react";

export default function PrinterModal() {
  const {
    settings,
    isConnectModalOpen,
    setIsConnectModalOpen,
    connectPrinter,
    disconnectPrinter,
    printReceipt,
  } = usePrinter();

  const [connectionType, setConnectionType] = useState<PrinterConnectionType>(
    settings.connectionType === "bluetooth" ? "bluetooth" : "usb"
  );
  const [paperSize, setPaperSize] = useState<PaperSize>(
    settings.paperSize || "3inch"
  );
  const [autoCut, setAutoCut] = useState<boolean>(settings.autoCut ?? true);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  if (!isConnectModalOpen) return null;

  const handleConnect = async () => {
    setIsConnecting(true);
    const success = await connectPrinter(connectionType, paperSize, autoCut);
    setIsConnecting(false);
    if (success) {
      setIsConnectModalOpen(false);
    }
  };

  const handleTestPrint = async () => {
    await printReceipt({
      orderNumber: "TEST-001",
      dateStr: new Date().toISOString().split("T")[0],
      timeStr: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      storeName: "Ravi Sweets - Chirala Main Store",
      storePhone: "+91 98480 12345",
      storeAddress: "Station Road, Chirala, AP - 523155",
      customerName: "Siva Krishna",
      customerPhone: "9876543210",
      items: [
        {
          name: "Special Ghee Motichoor Laddu",
          quantity: 1,
          unit: "KG",
          rate: 560,
          totalAmount: 560,
        },
        {
          name: "Cashew Kaju Katli (Silver Foil)",
          quantity: 0.5,
          unit: "KG",
          rate: 1100,
          totalAmount: 550,
        },
        {
          name: "Traditional Sweet Badusha",
          quantity: 4,
          unit: "piece",
          rate: 25,
          totalAmount: 100,
        },
      ],
      subtotal: 1210,
      discount: 10,
      taxableSubtotal: 1200,
      cgst: 30,
      sgst: 30,
      grandTotal: 1260,
      paymentMethod: "UPI",
      gstNumber: "37AAAAA0000A1Z5",
      fssaiNumber: "10123000000001",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-[#348bdd] flex items-center justify-center shadow-2xs">
              <Printer size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
                Thermal Printer Configuration
              </h2>
              <p className="text-[11px] text-slate-500 font-mono">
                ESC/POS receipts • WebUSB • Web Bluetooth • Auto-Cut
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsConnectModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Current Connection Status Badge */}
        <div className="px-6 py-2.5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                settings.isConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
              }`}
            />
            <span className="text-slate-600 font-medium">Status:</span>
            <span className="font-mono text-slate-800 font-semibold">
              {settings.isConnected ? settings.deviceName : "Not Connected"}
            </span>
          </div>
          {settings.isConnected && (
            <button
              onClick={disconnectPrinter}
              className="text-rose-600 hover:text-rose-700 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
            >
              <Unplug size={12} />
              <span>Disconnect</span>
            </button>
          )}
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 text-xs">
          {/* 1. Connection Mode Selector (Only WebUSB and Web Bluetooth) */}
          <div>
            <label className="block text-[11px] font-mono font-medium text-slate-500 uppercase tracking-wide mb-2">
              Select Connection Interface
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {/* WebUSB */}
              <button
                type="button"
                onClick={() => setConnectionType("usb")}
                className={`p-3.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  connectionType === "usb"
                    ? "border-[#348bdd] bg-blue-50/50 text-[#348bdd] shadow-xs ring-1 ring-[#348bdd]"
                    : "border-slate-200 hover:border-slate-300 text-slate-600"
                }`}
              >
                <Usb size={20} />
                <span className="font-semibold text-xs">WebUSB</span>
                <span className="text-[10px] text-slate-400 text-center font-mono">
                  USB Cable Connection
                </span>
              </button>

              {/* Web Bluetooth */}
              <button
                type="button"
                onClick={() => setConnectionType("bluetooth")}
                className={`p-3.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  connectionType === "bluetooth"
                    ? "border-[#348bdd] bg-blue-50/50 text-[#348bdd] shadow-xs ring-1 ring-[#348bdd]"
                    : "border-slate-200 hover:border-slate-300 text-slate-600"
                }`}
              >
                <Bluetooth size={20} />
                <span className="font-semibold text-xs">Web Bluetooth</span>
                <span className="text-[10px] text-slate-400 text-center font-mono">
                  Wireless Bluetooth
                </span>
              </button>
            </div>
          </div>

          {/* 2. Paper Roll Width */}
          <div>
            <label className="block text-[11px] font-mono font-medium text-slate-500 uppercase tracking-wide mb-2">
              Receipt Paper Width
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPaperSize("3inch")}
                className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                  paperSize === "3inch"
                    ? "border-[#348bdd] bg-blue-50/50 text-[#348bdd] shadow-xs ring-1 ring-[#348bdd]"
                    : "border-slate-200 hover:border-slate-300 text-slate-700"
                }`}
              >
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-xs">3 Inch (80mm)</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Standard Counter Slip (~48 chars)
                  </span>
                </div>
                {paperSize === "3inch" && <CheckCircle2 size={16} />}
              </button>

              <button
                type="button"
                onClick={() => setPaperSize("2inch")}
                className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                  paperSize === "2inch"
                    ? "border-[#348bdd] bg-blue-50/50 text-[#348bdd] shadow-xs ring-1 ring-[#348bdd]"
                    : "border-slate-200 hover:border-slate-300 text-slate-700"
                }`}
              >
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-xs">2 Inch (58mm)</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Compact Mobile Slip (~32 chars)
                  </span>
                </div>
                {paperSize === "2inch" && <CheckCircle2 size={16} />}
              </button>
            </div>
          </div>

          {/* 3. Auto-Cut Toggle */}
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Scissors size={16} className="text-slate-500" />
              <div>
                <div className="font-medium text-slate-800 text-xs">Auto Cut Paper</div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Triggers hardware guillotine cutter after bill printing
                </div>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoCut}
                onChange={(e) => setAutoCut(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#348bdd]"></div>
            </label>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestPrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors shadow-2xs cursor-pointer"
          >
            <FileText size={13} />
            <span>Test Print</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsConnectModalOpen(false)}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConnect}
              disabled={isConnecting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#348bdd] hover:bg-[#2b7bc4] text-white text-xs font-medium transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            >
              {isConnecting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <span>Connect & Save</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
