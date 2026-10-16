"use client";

import React, { useState } from "react";
import TopNavbar from "./TopNavbar";
import Sidebar from "./Sidebar";
import { ToastProvider } from "./ToastProvider";
import { PrinterProvider } from "@/context/PrinterContext";
import PrinterModal from "./PrinterModal";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <ToastProvider>
      <PrinterProvider>
        <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--color-bg-canvas)" }}>
        {/* Top Navbar */}
        <TopNavbar
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isMobileMenuOpen={isMobileMenuOpen}
        />

        {/* Main Layout Area */}
        <div className="flex flex-1 w-full relative">
          <Sidebar
            isMobileOpen={isMobileMenuOpen}
            onCloseMobile={() => setIsMobileMenuOpen(false)}
          />

          <main className="flex-1 overflow-x-hidden min-h-[calc(100vh-3.5rem)]">
            {children}
          </main>
        </div>

        {/* Global Thermal Printer Configuration Modal */}
        <PrinterModal />
        </div>
      </PrinterProvider>
    </ToastProvider>
  );
}
