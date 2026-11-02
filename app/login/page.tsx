"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { usePWA } from "@/context/PWAContext";
import {
  ShieldCheck,
  UserCog,
  Lock,
  Mail,
  Phone,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Smartphone,
} from "lucide-react";

type LoginType = "admin" | "staff";

export default function LoginPage() {
  const router = useRouter();
  const { loginAdmin, loginStaff, getDefaultHomePath } = useAuth();
  const { isInstallable, isInstalled, installApp } = usePWA();

  const [activeTab, setActiveTab] = useState<LoginType>("admin");

  // Admin form state
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Staff form state
  const [staffMobile, setStaffMobile] = useState("");
  const [staffMpin, setStaffMpin] = useState("");
  const [showStaffMpin, setShowStaffMpin] = useState(false);

  // Status state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [installSuccess, setInstallSuccess] = useState(false);

  // Handle Admin Submit
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!adminUsername.trim()) {
      setErrorMessage("Please enter your Admin username or email.");
      return;
    }
    if (!adminPassword) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setIsSubmitting(true);
    try {
      await loginAdmin(adminUsername, adminPassword);
      router.replace("/");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to log in as Super Admin.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Staff Submit
  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanMobile = staffMobile.replace(/\D/g, "");
    if (cleanMobile.length !== 10) {
      setErrorMessage("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!staffMpin.trim()) {
      setErrorMessage("Please enter your MPIN.");
      return;
    }

    setIsSubmitting(true);
    try {
      const staffUser = await loginStaff(cleanMobile, staffMpin);
      const destination =
        staffUser.accessibleMenus && staffUser.accessibleMenus.length > 0
          ? staffUser.accessibleMenus[0]
          : "/pos";
      router.replace(destination);
    } catch (err: any) {
      setErrorMessage(err.message || "Staff login failed. Check your mobile and MPIN.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInstallClick = async () => {
    const success = await installApp();
    if (success) {
      setInstallSuccess(true);
      setTimeout(() => setInstallSuccess(false), 4000);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-[var(--color-bg-canvas)] supabase-dot-grid px-4 py-8">
      {/* Top Brand Bar */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 shadow-2xs p-1 flex items-center justify-center">
            <img src="/logo.png" alt="Ravi Sweets" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-sm font-medium text-slate-800 leading-none">Ravi Sweets</h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-wider">CHIRALA</p>
          </div>
        </div>

        {/* PWA Install Button in Header if Installable */}
        {isInstallable && !isInstalled && (
          <button
            type="button"
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-slate-200 hover:border-[#348bdd] text-slate-700 hover:text-[#348bdd] shadow-2xs transition-all cursor-pointer"
          >
            <Download size={13} className="text-[#348bdd]" />
            <span>Install App</span>
          </button>
        )}

        {isInstalled && (
          <span className="flex items-center gap-1 text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-medium">
            <CheckCircle2 size={12} />
            <span>App Installed</span>
          </span>
        )}
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md mx-auto my-auto animate-in fade-in slide-in-from-bottom-3 duration-300">
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden">
          {/* Card Header with Brand Logo */}
          <div className="pt-8 pb-5 px-6 text-center border-b border-slate-100 bg-gradient-to-b from-sky-50/50 to-white">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-white border border-slate-200 shadow-md p-2 flex items-center justify-center mb-3">
              <img
                src="/logo.png"
                alt="Ravi Sweets Chirala"
                className="w-full h-full object-contain"
              />
            </div>
            <h2 className="text-base font-medium text-slate-900 tracking-tight">
              Management Console
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Secure access for Super Admin & Certified Staff
            </p>
          </div>

          {/* Login Type Segmented Tabs */}
          <div className="p-4 pb-0">
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80 text-xs">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("admin");
                  setErrorMessage(null);
                }}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-medium transition-all cursor-pointer ${
                  activeTab === "admin"
                    ? "bg-white text-slate-900 shadow-2xs border border-slate-200/60 font-medium"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ShieldCheck
                  size={15}
                  className={activeTab === "admin" ? "text-[#348bdd]" : "text-slate-400"}
                />
                <span>Super Admin</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("staff");
                  setErrorMessage(null);
                }}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-medium transition-all cursor-pointer ${
                  activeTab === "staff"
                    ? "bg-white text-slate-900 shadow-2xs border border-slate-200/60 font-medium"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <UserCog
                  size={15}
                  className={activeTab === "staff" ? "text-[#348bdd]" : "text-slate-400"}
                />
                <span>Staff Login</span>
              </button>
            </div>
          </div>

          {/* Form Area */}
          <div className="p-6 pt-4">
            {/* Error Message Alert */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
                <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* TAB 1: ADMIN LOGIN (Firebase Auth Email & Password) */}
            {activeTab === "admin" && (
              <form onSubmit={handleAdminSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Username / Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail size={15} />
                    </div>
                    <input
                      type="text"
                      required
                      autoComplete="username"
                      placeholder="e.g. admin or admin@ravisweets.com"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white hover:border-slate-300 focus:border-[#348bdd] focus:ring-1 focus:ring-[#348bdd]/20 outline-none text-slate-900 transition-all font-sans"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock size={15} />
                    </div>
                    <input
                      type={showAdminPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      placeholder="Enter super admin password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 text-xs rounded-xl border border-slate-200 bg-white hover:border-slate-300 focus:border-[#348bdd] focus:ring-1 focus:ring-[#348bdd]/20 outline-none text-slate-900 transition-all font-sans"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showAdminPassword ? "Hide password" : "Show password"}
                    >
                      {showAdminPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 py-2.5 px-4 rounded-xl bg-[#348bdd] hover:bg-[#2475c8] text-white text-xs font-medium flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In as Super Admin</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* TAB 2: STAFF LOGIN (Mobile Number & MPIN) */}
            {activeTab === "staff" && (
              <form onSubmit={handleStaffSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Mobile Number
                  </label>
                  <div className="relative flex">
                    <span className="inline-flex items-center px-3 text-xs text-slate-500 bg-slate-50 border border-r-0 border-slate-200 rounded-l-xl font-mono select-none">
                      +91
                    </span>
                    <input
                      type="text"
                      required
                      maxLength={10}
                      inputMode="numeric"
                      placeholder="10-digit mobile number"
                      value={staffMobile}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "");
                        setStaffMobile(digits.slice(0, 10));
                      }}
                      className="w-full px-3 py-2.5 text-xs rounded-r-xl border border-slate-200 bg-white hover:border-slate-300 focus:border-[#348bdd] focus:ring-1 focus:ring-[#348bdd]/20 outline-none text-slate-900 transition-all font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Staff MPIN
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <KeyRound size={15} />
                    </div>
                    <input
                      type={showStaffMpin ? "text" : "password"}
                      required
                      inputMode="numeric"
                      maxLength={8}
                      placeholder="Enter 4-6 digit MPIN"
                      value={staffMpin}
                      onChange={(e) => setStaffMpin(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 text-xs rounded-xl border border-slate-200 bg-white hover:border-slate-300 focus:border-[#348bdd] focus:ring-1 focus:ring-[#348bdd]/20 outline-none text-slate-900 transition-all font-mono tracking-widest"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStaffMpin(!showStaffMpin)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showStaffMpin ? "Hide MPIN" : "Show MPIN"}
                    >
                      {showStaffMpin ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Your MPIN was assigned by Admin in the Staff Manager.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Verifying Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Verify & Enter Software</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Install PWA Prompt Banner on Login Screen */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-[#348bdd] shrink-0">
                    <Smartphone size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-800 truncate">
                      Ravi Sweets PWA App
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      Install on Desktop, Phone or Tablet
                    </div>
                  </div>
                </div>

                {isInstalled ? (
                  <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 shrink-0 flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    <span>Installed</span>
                  </span>
                ) : isInstallable ? (
                  <button
                    type="button"
                    onClick={handleInstallClick}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#348bdd] hover:bg-[#2475c8] text-white shadow-2xs transition-all shrink-0 cursor-pointer flex items-center gap-1"
                  >
                    <Download size={12} />
                    <span>Install</span>
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                    Auto-Updates On
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-4 text-center text-[11px] text-slate-400">
          Ravi Sweets Chirala &bull; All Rights Reserved
        </div>
      </div>

      <div />
    </div>
  );
}

