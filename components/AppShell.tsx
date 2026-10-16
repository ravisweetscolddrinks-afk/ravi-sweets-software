"use client";

import React, { useState } from "react";
import TopNavbar from "./TopNavbar";
import Sidebar from "./Sidebar";
import { ToastProvider } from "./ToastProvider";
import { PrinterProvider } from "@/context/PrinterContext";
import PrinterModal from "./PrinterModal";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("ravi_sweets_sidebar_collapsed");
      if (saved !== null) {
        setIsSidebarCollapsed(saved === "true");
      }
    } catch {
      // ignore potential localStorage errors
    }
  }, []);

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("ravi_sweets_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  return (
    <ToastProvider>
      <PrinterProvider>
        <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--color-bg-canvas)" }}>
        {/* Top Navbar */}
        <TopNavbar
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          isMobileMenuOpen={isMobileMenuOpen}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebarCollapse={handleToggleSidebarCollapse}
        />

        {/* Main Layout Area */}
        <div className="flex flex-1 w-full relative">
          <Sidebar
            isMobileOpen={isMobileMenuOpen}
            onCloseMobile={() => setIsMobileMenuOpen(false)}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={handleToggleSidebarCollapse}
          />

          <main className="flex-1 min-w-0 w-full overflow-x-hidden min-h-[calc(100vh-3.5rem)] transition-all duration-200">
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
