"use client";

import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import {
  Settings as SettingsIcon,
  Building2,
  Phone,
  Mail,
  MapPin,
  ReceiptText,
  Percent,
  CheckCircle2,
  Save,
  Loader2,
  Info,
  ShieldCheck,
  Check,
  HelpCircle,
  Building,
  Sparkles
} from "lucide-react";

type SettingsTab = "profile" | "gst";

export default function SettingsPage() {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [isSavingGst, setIsSavingGst] = useState<boolean>(false);

  // Tab 1: Business Profile Form State
  const [profileData, setProfileData] = useState({
    tradeName: "",
    legalName: "",
    phone: "",
    altPhone: "",
    email: "",
    address: "",
    city: "",
    state: "Andhra Pradesh",
    pincode: "",
  });
  const [profileErrors, setProfileErrors] = useState<{ [key: string]: string }>({});

  // Tab 2: GST Form State
  const [gstData, setGstData] = useState<{
    enabled: boolean;
    gstNumber: string;
    gstPercentage: number | "";
    pricingType: "inclusive" | "exclusive";
  }>({
    enabled: false,
    gstNumber: "",
    gstPercentage: "",
    pricingType: "inclusive",
  });
  const [gstErrors, setGstErrors] = useState<{ [key: string]: string }>({});

  // Realtime listeners for settings
  useEffect(() => {
    setIsLoading(true);

    // 1. Business Profile Listener
    const profileDocRef = doc(db, "settings", "business_profile");
    const unsubProfile = onSnapshot(
      profileDocRef,
      (profileSnap) => {
        if (profileSnap.exists()) {
          const data = profileSnap.data();
          setProfileData({
            tradeName: data.tradeName || "",
            legalName: data.legalName || "",
            phone: data.phone || "",
            altPhone: data.altPhone || "",
            email: data.email || "",
            address: data.address || "",
            city: data.city || "",
            state: data.state || "Andhra Pradesh",
            pincode: data.pincode || "",
          });
        }
        setIsLoading(false);
      },
      (err) => {
        console.error("Profile realtime error:", err);
        setIsLoading(false);
      }
    );

    // 2. GST Settings Listener
    const gstDocRef = doc(db, "settings", "gst_settings");
    const unsubGst = onSnapshot(
      gstDocRef,
      (gstSnap) => {
        if (gstSnap.exists()) {
          const data = gstSnap.data();
          setGstData({
            enabled: !!data.enabled,
            gstNumber: data.gstNumber || "",
            gstPercentage: data.gstPercentage !== undefined ? data.gstPercentage : "",
            pricingType: data.pricingType === "exclusive" ? "exclusive" : "inclusive",
          });
        }
      },
      (err) => console.error("GST realtime error:", err)
    );

    return () => {
      unsubProfile();
      unsubGst();
    };
  }, []);

  // Validate Profile Form
  const validateProfile = () => {
    const errors: { [key: string]: string } = {};
    if (!profileData.tradeName.trim()) {
      errors.tradeName = "Business Trade Name is required";
    }
    if (!profileData.phone.trim()) {
      errors.phone = "Mobile Number is required";
    }
    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save Profile Form
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateProfile()) return;

    setIsSavingProfile(true);
    try {
      const profileDocRef = doc(db, "settings", "business_profile");
      await setDoc(
        profileDocRef,
        {
          ...profileData,
          tradeName: profileData.tradeName.trim(),
          phone: profileData.phone.trim(),
          email: profileData.email.trim(),
          address: profileData.address.trim(),
          city: profileData.city.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      showToast("Business Profile settings saved successfully!", "success");
    } catch (err: any) {
      console.error("Error saving profile settings:", err);
      showToast("Failed to save profile: " + (err.message || "Unknown error"), "error");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Validate GST Form
  const validateGst = () => {
    const errors: { [key: string]: string } = {};
    if (gstData.enabled) {
      if (!gstData.gstNumber.trim()) {
        errors.gstNumber = "GST Number is required when GST is enabled";
      } else if (gstData.gstNumber.trim().length !== 15) {
        errors.gstNumber = "GSTIN should be 15 alphanumeric characters";
      }

      if (gstData.gstPercentage === "" || Number(gstData.gstPercentage) < 0) {
        errors.gstPercentage = "Valid GST Percentage is required";
      }
    }
    setGstErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save GST Form
  const handleSaveGst = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateGst()) return;

    setIsSavingGst(true);
    try {
      const gstDocRef = doc(db, "settings", "gst_settings");
      await setDoc(
        gstDocRef,
        {
          enabled: gstData.enabled,
          gstNumber: gstData.enabled ? gstData.gstNumber.trim().toUpperCase() : "",
          gstPercentage:
            gstData.enabled && gstData.gstPercentage !== ""
              ? Number(gstData.gstPercentage)
              : 0,
          cgstPercentage:
            gstData.enabled && gstData.gstPercentage !== ""
              ? Number((Number(gstData.gstPercentage) / 2).toFixed(2))
              : 0,
          sgstPercentage:
            gstData.enabled && gstData.gstPercentage !== ""
              ? Number((Number(gstData.gstPercentage) / 2).toFixed(2))
              : 0,
          pricingType: gstData.pricingType,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      showToast("GST configuration saved successfully!", "success");
    } catch (err: any) {
      console.error("Error saving GST settings:", err);
      showToast("Failed to save GST settings: " + (err.message || "Unknown error"), "error");
    } finally {
      setIsSavingGst(false);
    }
  };

  // Calculate live CGST & SGST (Half & Half)
  const numericGst =
    gstData.gstPercentage !== "" && !isNaN(Number(gstData.gstPercentage))
      ? Number(gstData.gstPercentage)
      : 0;
  const halfCgst = (numericGst / 2).toFixed(2);
  const halfSgst = (numericGst / 2).toFixed(2);

  return (
    <div className="flex flex-col h-[calc(100vh-49px)] w-full overflow-hidden bg-white">
      {/* 1. Header Toolbar */}
      <div
        className="px-6 py-3.5 border-b flex flex-wrap items-center justify-between gap-4 shrink-0 bg-white"
        style={{ borderColor: "var(--color-border-subtle)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center border bg-slate-50"
            style={{
              borderColor: "var(--color-border-base)",
              color: "var(--color-brand-primary)",
            }}
          >
            <SettingsIcon size={19} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1
                className="text-base tracking-tight text-[var(--color-text-primary)]"
                style={{ fontWeight: 500 }}
              >
                Settings
              </h1>
              <span
                className="px-2 py-0.5 text-[10px] rounded uppercase tracking-wider font-mono font-normal"
                style={{
                  backgroundColor: "var(--color-brand-primary-light)",
                  color: "var(--color-brand-primary-text)",
                  border: "1px solid var(--color-brand-primary-border)",
                }}
              >
                CONFIGURATION CONSOLE
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
              Manage business legal entity profile, billing contact, and GST taxation policies
            </p>
          </div>
        </div>
      </div>

      {/* 2. Navigation Tabs (Supabase Console Style) */}
      <div
        className="px-6 border-b bg-slate-50/60 flex items-center gap-6 shrink-0"
        style={{ borderColor: "var(--color-border-subtle)" }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`py-3 text-xs flex items-center gap-2 font-medium cursor-pointer border-b-2 transition-all relative ${
            activeTab === "profile"
              ? "border-[#348bdd] text-[#348bdd]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Building2 size={15} />
          <span>Profile Details</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("gst")}
          className={`py-3 text-xs flex items-center gap-2 font-medium cursor-pointer border-b-2 transition-all relative ${
            activeTab === "gst"
              ? "border-[#348bdd] text-[#348bdd]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <ReceiptText size={15} />
          <span>GST Configuration</span>
          {gstData.enabled && (
            <span className="w-2 h-2 rounded-full bg-emerald-500" title="GST Enabled" />
          )}
        </button>
      </div>

      {/* 3. Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 bg-slate-50/30">
        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 size={24} className="animate-spin text-[#348bdd]" />
            <span className="text-xs font-mono">Loading configuration from database...</span>
          </div>
        ) : (
          <div className="w-full max-w-5xl space-y-6">
            {/* TAB 1: Business Profile */}
            {activeTab === "profile" && (
              <form onSubmit={handleSaveProfile} className="space-y-5">
                {/* Profile Overview Card */}
                <div className="bg-white rounded-xl border p-5 shadow-2xs space-y-4" style={{ borderColor: "var(--color-border-base)" }}>
                  <div className="flex items-center gap-3 pb-3 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
                    <div className="w-10 h-10 rounded-lg bg-sky-50 text-[#348bdd] border border-sky-100 flex items-center justify-center font-medium font-mono text-base">
                      {profileData.tradeName ? profileData.tradeName.charAt(0).toUpperCase() : "RS"}
                    </div>
                    <div>
                      <h2 className="text-sm font-medium text-slate-900">
                        Business Entity Information
                      </h2>
                      <p className="text-xs text-slate-400">
                        These credentials will appear on sales bills, counter POS receipts, and invoices.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 pt-1">
                    {/* Business Trade Name */}
                    <div>
                      <label
                        className="block text-xs uppercase tracking-wider mb-1"
                        style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
                      >
                        Business Trade Name <span className="text-red-500">*</span>
                      </label>
                      <div
                        className="flex items-center gap-2 px-3 py-2 rounded-md border bg-white focus-within:ring-1 focus-within:ring-[var(--color-brand-primary)]"
                        style={{
                          borderColor: profileErrors.tradeName ? "#f87171" : "var(--color-border-base)",
                        }}
                      >
                        <Building2 size={14} className="text-slate-400 shrink-0" />
                        <input
                          type="text"
                          placeholder="e.g. Ravi Sweets & Bakery"
                          value={profileData.tradeName}
                          onChange={(e) => {
                            setProfileData({ ...profileData, tradeName: e.target.value });
                            if (profileErrors.tradeName) setProfileErrors({ ...profileErrors, tradeName: "" });
                          }}
                          className="w-full text-xs bg-transparent focus:outline-none"
                          style={{ color: "var(--color-text-primary)" }}
                        />
                      </div>
                      {profileErrors.tradeName && (
                        <p className="text-[11px] text-red-500 mt-1">{profileErrors.tradeName}</p>
                      )}
                    </div>

                    {/* Mobile Number & Alternate Contact in Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          className="block text-xs uppercase tracking-wider mb-1"
                          style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
                        >
                          Primary Mobile Number <span className="text-red-500">*</span>
                        </label>
                        <div
                          className="flex items-center gap-2 px-3 py-2 rounded-md border bg-white focus-within:ring-1 focus-within:ring-[var(--color-brand-primary)]"
                          style={{
                            borderColor: profileErrors.phone ? "#f87171" : "var(--color-border-base)",
                          }}
                        >
                          <Phone size={14} className="text-slate-400 shrink-0" />
                          <input
                            type="tel"
                            placeholder="e.g. +91 98480 12345"
                            value={profileData.phone}
                            onChange={(e) => {
                              setProfileData({ ...profileData, phone: e.target.value });
                              if (profileErrors.phone) setProfileErrors({ ...profileErrors, phone: "" });
                            }}
                            className="w-full text-xs bg-transparent focus:outline-none font-mono"
                            style={{ color: "var(--color-text-primary)" }}
                          />
                        </div>
                        {profileErrors.phone && (
                          <p className="text-[11px] text-red-500 mt-1">{profileErrors.phone}</p>
                        )}
                      </div>

                      <div>
                        <label
                          className="block text-xs uppercase tracking-wider mb-1"
                          style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
                        >
                          Official Email Address
                        </label>
                        <div
                          className="flex items-center gap-2 px-3 py-2 rounded-md border bg-white focus-within:ring-1 focus-within:ring-[var(--color-brand-primary)]"
                          style={{ borderColor: "var(--color-border-base)" }}
                        >
                          <Mail size={14} className="text-slate-400 shrink-0" />
                          <input
                            type="email"
                            placeholder="e.g. contact@ravisweets.com"
                            value={profileData.email}
                            onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                            className="w-full text-xs bg-transparent focus:outline-none font-mono"
                            style={{ color: "var(--color-text-primary)" }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Address Multiline */}
                    <div>
                      <label
                        className="block text-xs uppercase tracking-wider mb-1"
                        style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
                      >
                        Business Physical Address
                      </label>
                      <div
                        className="flex gap-2 p-2.5 rounded-md border bg-white focus-within:ring-1 focus-within:ring-[var(--color-brand-primary)]"
                        style={{ borderColor: "var(--color-border-base)" }}
                      >
                        <MapPin size={15} className="text-slate-400 shrink-0 mt-0.5" />
                        <textarea
                          rows={3}
                          placeholder="e.g. Main Road, Opp. Municipal High School, Chirala"
                          value={profileData.address}
                          onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                          className="w-full text-xs bg-transparent focus:outline-none resize-none"
                          style={{ color: "var(--color-text-primary)" }}
                        />
                      </div>
                    </div>

                    {/* City, State & Pincode Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label
                          className="block text-xs uppercase tracking-wider mb-1"
                          style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
                        >
                          City / Town
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Chirala"
                          value={profileData.city}
                          onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
                          className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                          style={{
                            borderColor: "var(--color-border-base)",
                            color: "var(--color-text-primary)",
                          }}
                        />
                      </div>

                      <div>
                        <label
                          className="block text-xs uppercase tracking-wider mb-1"
                          style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
                        >
                          State
                        </label>
                        <input
                          type="text"
                          placeholder="Andhra Pradesh"
                          value={profileData.state}
                          onChange={(e) => setProfileData({ ...profileData, state: e.target.value })}
                          className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                          style={{
                            borderColor: "var(--color-border-base)",
                            color: "var(--color-text-primary)",
                          }}
                        />
                      </div>

                      <div>
                        <label
                          className="block text-xs uppercase tracking-wider mb-1"
                          style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
                        >
                          Pincode
                        </label>
                        <input
                          type="text"
                          placeholder="523155"
                          value={profileData.pincode}
                          onChange={(e) => setProfileData({ ...profileData, pincode: e.target.value })}
                          className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)] font-mono"
                          style={{
                            borderColor: "var(--color-border-base)",
                            color: "var(--color-text-primary)",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Save Profile Button */}
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="flex items-center gap-2 px-5 py-2 text-xs rounded-md text-white transition-opacity hover:opacity-90 disabled:opacity-50 font-normal shadow-xs cursor-pointer"
                    style={{ backgroundColor: "var(--color-brand-primary)" }}
                  >
                    {isSavingProfile ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    <span>{isSavingProfile ? "Saving Profile..." : "Save Profile Details"}</span>
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: GST Settings */}
            {activeTab === "gst" && (
              <form onSubmit={handleSaveGst} className="space-y-5">
                {/* Enable / Disable Toggle Card */}
                <div
                  className={`rounded-xl border p-5 shadow-2xs transition-all ${
                    gstData.enabled ? "bg-white border-slate-200" : "bg-slate-50/70 border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <ReceiptText
                          size={18}
                          className={gstData.enabled ? "text-[#348bdd]" : "text-slate-400"}
                        />
                        <h2 className="text-sm font-medium text-slate-900">
                          Goods & Services Tax (GST) Billing
                        </h2>
                      </div>
                      <p className="text-xs text-slate-500">
                        Enable GST compliance if your sweet shop or confectionery is registered under the GST law.
                      </p>
                    </div>

                    {/* Toggle Switch */}
                    <button
                      type="button"
                      onClick={() => setGstData({ ...gstData, enabled: !gstData.enabled })}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        gstData.enabled ? "bg-[#348bdd]" : "bg-slate-200"
                      }`}
                      role="switch"
                      aria-checked={gstData.enabled}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          gstData.enabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {!gstData.enabled && (
                    <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center gap-2 text-xs text-slate-400 font-mono">
                      <Info size={14} className="shrink-0" />
                      <span>GST is currently disabled. Invoices will be generated without tax separation.</span>
                    </div>
                  )}
                </div>

                {/* GST Details (Only shown when enabled) */}
                {gstData.enabled && (
                  <div className="bg-white rounded-xl border p-5 shadow-2xs space-y-5" style={{ borderColor: "var(--color-border-base)" }}>
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--color-border-subtle)" }}>
                      <div>
                        <h3 className="text-xs uppercase tracking-wider font-mono text-slate-400">
                          Tax Registration & Rates
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Configure your GSTIN and standard applicable tax percentages
                        </p>
                      </div>
                      <span
                        className="px-2 py-0.5 text-[10px] rounded uppercase tracking-wider font-mono"
                        style={{
                          backgroundColor: "var(--color-brand-primary-light)",
                          color: "var(--color-brand-primary-text)",
                          border: "1px solid var(--color-brand-primary-border)",
                        }}
                      >
                        CGST + SGST SPLIT
                      </span>
                    </div>

                    {/* GST Number */}
                    <div>
                      <label
                        className="block text-xs uppercase tracking-wider mb-1"
                        style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
                      >
                        GST Identification Number (GSTIN) <span className="text-red-500">*</span>
                      </label>
                      <div
                        className="flex items-center gap-2 px-3 py-2 rounded-md border bg-white focus-within:ring-1 focus-within:ring-[var(--color-brand-primary)]"
                        style={{
                          borderColor: gstErrors.gstNumber ? "#f87171" : "var(--color-border-base)",
                        }}
                      >
                        <ShieldCheck size={14} className="text-slate-400 shrink-0" />
                        <input
                          type="text"
                          placeholder="e.g. 37AAAAA0000A1Z5"
                          maxLength={15}
                          value={gstData.gstNumber}
                          onChange={(e) => {
                            setGstData({
                              ...gstData,
                              gstNumber: e.target.value.toUpperCase(),
                            });
                            if (gstErrors.gstNumber) setGstErrors({ ...gstErrors, gstNumber: "" });
                          }}
                          className="w-full text-xs bg-transparent focus:outline-none font-mono uppercase tracking-wider font-medium"
                          style={{ color: "var(--color-text-primary)" }}
                        />
                      </div>
                      {gstErrors.gstNumber ? (
                        <p className="text-[11px] text-red-500 mt-1">{gstErrors.gstNumber}</p>
                      ) : (
                        <p className="text-[11px] text-slate-400 mt-1 font-mono">
                          15-digit alphanumeric tax identifier for Andhra Pradesh (State Code: 37)
                        </p>
                      )}
                    </div>

                    {/* GST Percentage */}
                    <div>
                      <label
                        className="block text-xs uppercase tracking-wider mb-1"
                        style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
                      >
                        GST Percentage (%) <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-3">
                        <div
                          className="flex items-center gap-2 px-3 py-2 rounded-md border bg-white focus-within:ring-1 focus-within:ring-[var(--color-brand-primary)] max-w-[200px]"
                          style={{
                            borderColor: gstErrors.gstPercentage ? "#f87171" : "var(--color-border-base)",
                          }}
                        >
                          <Percent size={14} className="text-slate-400 shrink-0" />
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            placeholder="e.g. 5"
                            value={gstData.gstPercentage}
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                            onChange={(e) => {
                              const val = e.target.value === "" ? "" : Number(e.target.value);
                              setGstData({ ...gstData, gstPercentage: val });
                              if (gstErrors.gstPercentage) setGstErrors({ ...gstErrors, gstPercentage: "" });
                            }}
                            className="w-full text-xs bg-transparent focus:outline-none font-mono font-medium"
                            style={{ color: "var(--color-text-primary)" }}
                          />
                        </div>

                        {/* Quick Presets for Sweet Shops */}
                        <div className="flex items-center gap-1.5">
                          {[5, 12, 18].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => {
                                setGstData({ ...gstData, gstPercentage: preset });
                                if (gstErrors.gstPercentage) setGstErrors({ ...gstErrors, gstPercentage: "" });
                              }}
                              className={`px-2.5 py-1 text-xs rounded border transition-colors cursor-pointer font-mono ${
                                gstData.gstPercentage === preset
                                  ? "bg-[#348bdd] text-white border-[#348bdd]"
                                  : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              {preset}%
                            </button>
                          ))}
                        </div>
                      </div>
                      {gstErrors.gstPercentage && (
                        <p className="text-[11px] text-red-500 mt-1">{gstErrors.gstPercentage}</p>
                      )}
                    </div>

                    {/* Automatic Half CGST & Half SGST Live Calculation Cards */}
                    <div className="p-3.5 rounded-lg border bg-slate-50/70 border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <Sparkles size={14} className="text-[#348bdd]" />
                          <span>Automatic Tax Breakdown (50% CGST / 50% SGST)</span>
                        </span>
                        <span className="font-mono text-[#348bdd] font-semibold">
                          Total: {numericGst}%
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="p-2.5 rounded-md border bg-white border-slate-200">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                            Central GST (CGST - 50%)
                          </div>
                          <div className="text-base font-medium font-mono text-slate-900 mt-0.5">
                            {halfCgst}%
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Apportioned to Central Government
                          </div>
                        </div>

                        <div className="p-2.5 rounded-md border bg-white border-slate-200">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                            State GST (SGST - 50%)
                          </div>
                          <div className="text-base font-medium font-mono text-slate-900 mt-0.5">
                            {halfSgst}%
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Apportioned to State of AP
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t my-2" style={{ borderColor: "var(--color-border-subtle)" }} />

                    {/* Pricing Mode: Inclusive vs Exclusive */}
                    <div className="space-y-2">
                      <label
                        className="block text-xs uppercase tracking-wider mb-1"
                        style={{ color: "var(--color-text-secondary)", fontWeight: 500 }}
                      >
                        Pricing Policy in Bill & Counter Menu <span className="text-red-500">*</span>
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Inclusive Option */}
                        <div
                          onClick={() => setGstData({ ...gstData, pricingType: "inclusive" })}
                          className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                            gstData.pricingType === "inclusive"
                              ? "bg-sky-50/50 border-[#348bdd] shadow-2xs"
                              : "bg-white border-slate-200 hover:bg-slate-50/60"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-900">
                              Inclusive in Prices
                            </span>
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                gstData.pricingType === "inclusive"
                                  ? "border-[#348bdd] bg-[#348bdd] text-white"
                                  : "border-slate-300 bg-white"
                              }`}
                            >
                              {gstData.pricingType === "inclusive" && <Check size={10} />}
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                            Prices on shelf & counter already include GST. System auto-extracts CGST and SGST on final bill.
                          </p>
                        </div>

                        {/* Exclusive Option */}
                        <div
                          onClick={() => setGstData({ ...gstData, pricingType: "exclusive" })}
                          className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                            gstData.pricingType === "exclusive"
                              ? "bg-sky-50/50 border-[#348bdd] shadow-2xs"
                              : "bg-white border-slate-200 hover:bg-slate-50/60"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-900">
                              Exclusive of Prices
                            </span>
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                gstData.pricingType === "exclusive"
                                  ? "border-[#348bdd] bg-[#348bdd] text-white"
                                  : "border-slate-300 bg-white"
                              }`}
                            >
                              {gstData.pricingType === "exclusive" && <Check size={10} />}
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                            Item base price is displayed. GST is calculated and added on top of the bill subtotal during checkout.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Save GST Button */}
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isSavingGst}
                    className="flex items-center gap-2 px-5 py-2 text-xs rounded-md text-white transition-opacity hover:opacity-90 disabled:opacity-50 font-normal shadow-xs cursor-pointer"
                    style={{ backgroundColor: "var(--color-brand-primary)" }}
                  >
                    {isSavingGst ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    <span>{isSavingGst ? "Saving GST Settings..." : "Save GST Configuration"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
