"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { ShieldAlert, ArrowRight, Loader2, LogOut } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { currentUser, isAuthenticated, isLoading, canAccess, getDefaultHomePath, logout } =
    useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Route protection redirect checks
  useEffect(() => {
    if (isLoading || !mounted) return;

    if (!isAuthenticated) {
      if (pathname !== "/login") {
        router.replace("/login");
      }
    } else {
      if (pathname === "/login") {
        router.replace(getDefaultHomePath());
      }
    }
  }, [isAuthenticated, isLoading, pathname, mounted, router, getDefaultHomePath]);

  // Loading State
  if (isLoading || !mounted) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#fcfcfd]">
        <div className="flex flex-col items-center p-8 max-w-sm text-center animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-md flex items-center justify-center p-2 mb-4">
            <img
              src="/logo.png"
              alt="Ravi Sweets Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex items-center gap-2 text-slate-700 font-medium text-sm mb-1">
            <Loader2 size={16} className="animate-spin text-[#348bdd]" />
            <span>Verifying session security...</span>
          </div>
          <p className="text-xs text-slate-400">Ravi Sweets Chirala Console</p>
        </div>
      </div>
    );
  }

  // Not authenticated & on login page -> allow rendering login
  if (!isAuthenticated) {
    if (pathname === "/login") {
      return <>{children}</>;
    }
    // Still redirecting to /login
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#fcfcfd]">
        <Loader2 size={24} className="animate-spin text-[#348bdd]" />
      </div>
    );
  }

  // Authenticated & on login page -> wait for redirect
  if (pathname === "/login") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#fcfcfd]">
        <Loader2 size={24} className="animate-spin text-[#348bdd]" />
      </div>
    );
  }

  // Authenticated: verify route permissions
  const hasAccess = canAccess(pathname);

  if (!hasAccess) {
    // 403 Forbidden Access Screen
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4 bg-[#fcfcfd]">
        <div className="w-full max-w-md bg-white border border-rose-200/80 rounded-2xl p-6 shadow-sm text-center">
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-4 text-rose-500">
            <ShieldAlert size={26} />
          </div>

          <h2 className="text-lg font-medium text-slate-900 mb-1">
            Access Restricted
          </h2>

          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Your staff account is not authorized to access <span className="font-mono font-medium text-slate-700 bg-slate-100 px-1 py-0.5 rounded">{pathname}</span>.
            Please contact Super Admin to assign this menu to your role.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2 border-t border-slate-100">
            <button
              onClick={() => router.replace(getDefaultHomePath())}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#348bdd] hover:bg-[#2475c8] text-white text-xs font-medium transition-all shadow-sm cursor-pointer"
            >
              <span>Go to My Workspace</span>
              <ArrowRight size={14} />
            </button>

            <button
              onClick={logout}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-all cursor-pointer"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

