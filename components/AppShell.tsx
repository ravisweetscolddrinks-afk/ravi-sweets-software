"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import TopNavbar from "./TopNavbar";
import Sidebar from "./Sidebar";
import { ToastProvider } from "./ToastProvider";
import { PrinterProvider } from "@/context/PrinterContext";
import { AuthProvider } from "@/context/AuthContext";
import { PWAProvider } from "@/context/PWAContext";
import AuthGuard from "./AuthGuard";
import PrinterModal from "./PrinterModal";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const isLoginPage = pathname === "/login";

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

  // Prevent mouse wheel from incrementing or decrementing number inputs app-wide
  React.useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const activeEl = document.activeElement;
      const target = e.target;
      if (
        (target instanceof HTMLInputElement && target.type === "number") ||
        (activeEl instanceof HTMLInputElement && activeEl.type === "number")
      ) {
        if (target instanceof HTMLInputElement && target.type === "number") {
          e.preventDefault();
          target.blur();
        } else if (activeEl instanceof HTMLInputElement && activeEl.type === "number") {
          activeEl.blur();
        }
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", handleWheel);
    };
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
    <PWAProvider>
      <AuthProvider>
        <ToastProvider>
          <PrinterProvider>
            <AuthGuard>
              {isLoginPage ? (
                <main className="min-h-screen w-full">
                  {children}
                </main>
              ) : (
                <div
                  className="min-h-screen flex flex-col"
                  style={{ backgroundColor: "var(--color-bg-canvas)" }}
                >
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
              )}
            </AuthGuard>
          </PrinterProvider>
        </ToastProvider>
      </AuthProvider>
    </PWAProvider>
  );
}
