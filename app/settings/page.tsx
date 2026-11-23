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
  Sparkles,
  Printer,
  FileText,
  Image as ImageIcon,
  PenTool,
  Upload,
  X,
  Trash2,
  QrCode,
  Eye,
  Landmark,
  Sliders,
  FileCheck,
} from "lucide-react";
import {
  ThermalBillSettings,
  defaultThermalBillSettings,
  A4InvoiceSettings,
  defaultA4InvoiceSettings,
} from "@/types/settings";

type SettingsTab = "profile" | "gst" | "bill" | "invoice";

export default function SettingsPage() {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [isSavingGst, setIsSavingGst] = useState<boolean>(false);
  const [isSavingBill, setIsSavingBill] = useState<boolean>(false);
  const [isSavingInvoice, setIsSavingInvoice] = useState<boolean>(false);

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

  // Tab 3: Bill Settings (Thermal)
  const [billSettings, setBillSettings] = useState<ThermalBillSettings>(defaultThermalBillSettings);

  // Tab 4: Invoice Settings (A4)
  const [invoiceSettings, setInvoiceSettings] = useState<A4InvoiceSettings>(defaultA4InvoiceSettings);

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

    // 3. Bill Settings Listener
    const billDocRef = doc(db, "settings", "bill_settings");
    const unsubBill = onSnapshot(
      billDocRef,
      (billSnap) => {
        if (billSnap.exists()) {
          setBillSettings({
            ...defaultThermalBillSettings,
            ...(billSnap.data() as Partial<ThermalBillSettings>),
          });
        }
      },
      (err) => console.error("Bill settings realtime error:", err)
    );

    // 4. Invoice Settings Listener
    const invoiceDocRef = doc(db, "settings", "invoice_settings");
    const unsubInvoice = onSnapshot(
      invoiceDocRef,
      (invSnap) => {
        if (invSnap.exists()) {
          setInvoiceSettings({
            ...defaultA4InvoiceSettings,
            ...(invSnap.data() as Partial<A4InvoiceSettings>),
          });
        }
      },
      (err) => console.error("Invoice settings realtime error:", err)
    );

    return () => {
      unsubProfile();
      unsubGst();
      unsubBill();
      unsubInvoice();
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

  // Save Bill Settings (Thermal)
  const handleSaveBillSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBill(true);
    try {
      const billDocRef = doc(db, "settings", "bill_settings");
      await setDoc(
        billDocRef,
        {
          ...billSettings,
          headerTitle: billSettings.headerTitle.trim(),
          tagline: billSettings.tagline.trim(),
          footerMessage1: billSettings.footerMessage1.trim(),
          footerMessage2: billSettings.footerMessage2.trim(),
          fssaiNumber: billSettings.fssaiNumber.trim(),
          upiId: billSettings.upiId.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      showToast("Thermal Bill header & footer settings saved!", "success");
    } catch (err: any) {
      console.error("Error saving bill settings:", err);
      showToast("Failed to save bill settings: " + (err.message || "Unknown error"), "error");
    } finally {
      setIsSavingBill(false);
    }
  };

  // Save Invoice Settings (A4)
  const handleSaveInvoiceSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingInvoice(true);
    try {
      const invDocRef = doc(db, "settings", "invoice_settings");
      await setDoc(
        invDocRef,
        {
          ...invoiceSettings,
          invoiceTitle: invoiceSettings.invoiceTitle.trim(),
          invoicePrefix: invoiceSettings.invoicePrefix.trim(),
          signatoryName: invoiceSettings.signatoryName.trim(),
          signatoryCompany: invoiceSettings.signatoryCompany.trim(),
          panNumber: invoiceSettings.panNumber.trim().toUpperCase(),
          fssaiNumber: invoiceSettings.fssaiNumber.trim(),
          bankName: invoiceSettings.bankName.trim(),
          accountName: invoiceSettings.accountName.trim(),
          accountNumber: invoiceSettings.accountNumber.trim(),
          ifscCode: invoiceSettings.ifscCode.trim().toUpperCase(),
          branch: invoiceSettings.branch.trim(),
          upiId: invoiceSettings.upiId.trim(),
          termsAndConditions: invoiceSettings.termsAndConditions.trim(),
          footerNote: invoiceSettings.footerNote.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      showToast("A4 Invoice template settings saved successfully!", "success");
    } catch (err: any) {
      console.error("Error saving invoice settings:", err);
      showToast("Failed to save invoice settings: " + (err.message || "Unknown error"), "error");
    } finally {
      setIsSavingInvoice(false);
    }
  };

  // Handle Logo & Signature image selection
  const handleImageFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "logoUrl" | "signatureUrl"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast("Image file size should be less than 2MB", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setInvoiceSettings((prev) => ({
        ...prev,
        [field]: result,
      }));
      showToast(`${field === "logoUrl" ? "Logo" : "Signature"} image selected!`, "success");
    };
    reader.readAsDataURL(file);
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
        className="px-6 border-b bg-slate-50/60 flex items-center gap-6 shrink-0 overflow-x-auto"
        style={{ borderColor: "var(--color-border-subtle)" }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`py-3 text-xs flex items-center gap-2 font-medium cursor-pointer border-b-2 transition-all relative shrink-0 ${
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
          className={`py-3 text-xs flex items-center gap-2 font-medium cursor-pointer border-b-2 transition-all relative shrink-0 ${
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

        <button
          type="button"
          onClick={() => setActiveTab("bill")}
          className={`py-3 text-xs flex items-center gap-2 font-medium cursor-pointer border-b-2 transition-all relative shrink-0 ${
            activeTab === "bill"
              ? "border-[#348bdd] text-[#348bdd]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Printer size={15} />
          <span>Thermal Bill Settings</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("invoice")}
          className={`py-3 text-xs flex items-center gap-2 font-medium cursor-pointer border-b-2 transition-all relative shrink-0 ${
            activeTab === "invoice"
              ? "border-[#348bdd] text-[#348bdd]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText size={15} />
          <span>A4 Invoice Settings</span>
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

            {/* TAB 3: Thermal Bill Settings */}
            {activeTab === "bill" && (
              <form onSubmit={handleSaveBillSettings} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Configuration Controls */}
                  <div className="lg:col-span-7 space-y-5">
                    {/* Card 1: Bill Header Controls */}
                    <div
                      className="p-5 rounded-xl border bg-white shadow-2xs space-y-4"
                      style={{ borderColor: "var(--color-border-base)" }}
                    >
                      <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--color-border-subtle)" }}>
                        <div>
                          <h3 className="text-sm text-slate-800 flex items-center gap-2" style={{ fontWeight: 500 }}>
                            <Printer size={16} className="text-[#348bdd]" />
                            <span>Thermal Bill Header Configuration</span>
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Customize exactly what is printed at the top of your POS counter receipts
                          </p>
                        </div>
                      </div>

                      {/* Custom Header Title Override */}
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                          Header Title Override (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder={`Leave empty to use profile trade name: "${profileData.tradeName || "RAVI SWEETS"}"`}
                          value={billSettings.headerTitle}
                          onChange={(e) => setBillSettings({ ...billSettings, headerTitle: e.target.value })}
                          className="w-full text-xs px-3 py-2 rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd] bg-white text-slate-800"
                          style={{ borderColor: "var(--color-border-base)" }}
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                          Controls the single primary name on the thermal receipt slip.
                        </p>
                      </div>

                      {/* Tagline / Subtitle Toggle & Input */}
                      <div className="p-3 rounded-lg border bg-slate-50/60 space-y-2" style={{ borderColor: "var(--color-border-subtle)" }}>
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-slate-800 flex items-center gap-1.5 cursor-pointer">
                            <span>Print Header Subtitle / Tagline</span>
                          </label>
                          <input
                            type="checkbox"
                            checked={billSettings.showTagline}
                            onChange={(e) => setBillSettings({ ...billSettings, showTagline: e.target.checked })}
                            className="w-4 h-4 rounded text-[#348bdd] focus:ring-[#348bdd] cursor-pointer"
                          />
                        </div>
                        {billSettings.showTagline && (
                          <input
                            type="text"
                            placeholder="e.g. SWEETS, BAKERY & COLD DRINKS"
                            value={billSettings.tagline}
                            onChange={(e) => setBillSettings({ ...billSettings, tagline: e.target.value })}
                            className="w-full text-xs px-3 py-1.5 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                            style={{ borderColor: "var(--color-border-base)" }}
                          />
                        )}
                      </div>

                      {/* Header Field Toggles Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {/* Address */}
                        <label className="flex items-center justify-between p-2.5 rounded-lg border bg-white cursor-pointer hover:bg-slate-50 transition-colors" style={{ borderColor: "var(--color-border-subtle)" }}>
                          <span className="text-xs text-slate-700">Print Store Address</span>
                          <input
                            type="checkbox"
                            checked={billSettings.showAddress}
                            onChange={(e) => setBillSettings({ ...billSettings, showAddress: e.target.checked })}
                            className="w-4 h-4 rounded text-[#348bdd] focus:ring-[#348bdd]"
                          />
                        </label>

                        {/* Phone */}
                        <label className="flex items-center justify-between p-2.5 rounded-lg border bg-white cursor-pointer hover:bg-slate-50 transition-colors" style={{ borderColor: "var(--color-border-subtle)" }}>
                          <span className="text-xs text-slate-700">Print Store Phone</span>
                          <input
                            type="checkbox"
                            checked={billSettings.showPhone}
                            onChange={(e) => setBillSettings({ ...billSettings, showPhone: e.target.checked })}
                            className="w-4 h-4 rounded text-[#348bdd] focus:ring-[#348bdd]"
                          />
                        </label>

                        {/* Email */}
                        <label className="flex items-center justify-between p-2.5 rounded-lg border bg-white cursor-pointer hover:bg-slate-50 transition-colors" style={{ borderColor: "var(--color-border-subtle)" }}>
                          <span className="text-xs text-slate-700">Print Store Email</span>
                          <input
                            type="checkbox"
                            checked={billSettings.showEmail}
                            onChange={(e) => setBillSettings({ ...billSettings, showEmail: e.target.checked })}
                            className="w-4 h-4 rounded text-[#348bdd] focus:ring-[#348bdd]"
                          />
                        </label>

                        {/* GSTIN */}
                        <label className="flex items-center justify-between p-2.5 rounded-lg border bg-white cursor-pointer hover:bg-slate-50 transition-colors" style={{ borderColor: "var(--color-border-subtle)" }}>
                          <span className="text-xs text-slate-700">Print GSTIN Number</span>
                          <input
                            type="checkbox"
                            checked={billSettings.showGstin}
                            onChange={(e) => setBillSettings({ ...billSettings, showGstin: e.target.checked })}
                            className="w-4 h-4 rounded text-[#348bdd] focus:ring-[#348bdd]"
                          />
                        </label>

                        {/* Date & Time */}
                        <label className="flex items-center justify-between p-2.5 rounded-lg border bg-white cursor-pointer hover:bg-slate-50 transition-colors" style={{ borderColor: "var(--color-border-subtle)" }}>
                          <span className="text-xs text-slate-700">Print Date & Time</span>
                          <input
                            type="checkbox"
                            checked={billSettings.showDateAndTime}
                            onChange={(e) => setBillSettings({ ...billSettings, showDateAndTime: e.target.checked })}
                            className="w-4 h-4 rounded text-[#348bdd] focus:ring-[#348bdd]"
                          />
                        </label>

                        {/* Cashier Name */}
                        <label className="flex items-center justify-between p-2.5 rounded-lg border bg-white cursor-pointer hover:bg-slate-50 transition-colors" style={{ borderColor: "var(--color-border-subtle)" }}>
                          <span className="text-xs text-slate-700">Print Counter / Cashier</span>
                          <input
                            type="checkbox"
                            checked={billSettings.showCashierName}
                            onChange={(e) => setBillSettings({ ...billSettings, showCashierName: e.target.checked })}
                            className="w-4 h-4 rounded text-[#348bdd] focus:ring-[#348bdd]"
                          />
                        </label>

                        {/* Customer Details */}
                        <label className="flex items-center justify-between p-2.5 rounded-lg border bg-white cursor-pointer hover:bg-slate-50 transition-colors sm:col-span-2" style={{ borderColor: "var(--color-border-subtle)" }}>
                          <span className="text-xs text-slate-700">Print Customer Details (Name & Phone)</span>
                          <input
                            type="checkbox"
                            checked={billSettings.showCustomerDetails}
                            onChange={(e) => setBillSettings({ ...billSettings, showCustomerDetails: e.target.checked })}
                            className="w-4 h-4 rounded text-[#348bdd] focus:ring-[#348bdd]"
                          />
                        </label>
                      </div>

                      {/* FSSAI Toggle & Input */}
                      <div className="p-3 rounded-lg border bg-slate-50/60 space-y-2" style={{ borderColor: "var(--color-border-subtle)" }}>
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-slate-800 flex items-center gap-1.5 cursor-pointer">
                            <span>Print FSSAI License Number</span>
                          </label>
                          <input
                            type="checkbox"
                            checked={billSettings.showFssai}
                            onChange={(e) => setBillSettings({ ...billSettings, showFssai: e.target.checked })}
                            className="w-4 h-4 rounded text-[#348bdd] focus:ring-[#348bdd] cursor-pointer"
                          />
                        </div>
                        {billSettings.showFssai && (
                          <input
                            type="text"
                            placeholder="Enter 14-digit FSSAI number (e.g. 10119024000123)"
                            value={billSettings.fssaiNumber}
                            onChange={(e) => setBillSettings({ ...billSettings, fssaiNumber: e.target.value })}
                            className="w-full text-xs px-3 py-1.5 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd] font-mono"
                            style={{ borderColor: "var(--color-border-base)" }}
                          />
                        )}
                      </div>
                    </div>

                    {/* Card 2: Bill Footer Controls */}
                    <div
                      className="p-5 rounded-xl border bg-white shadow-2xs space-y-4"
                      style={{ borderColor: "var(--color-border-base)" }}
                    >
                      <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--color-border-subtle)" }}>
                        <div>
                          <h3 className="text-sm text-slate-800 flex items-center gap-2" style={{ fontWeight: 500 }}>
                            <FileText size={16} className="text-[#348bdd]" />
                            <span>Thermal Bill Footer Configuration</span>
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Greetings, customer policies, and UPI payment text printed at the bottom
                          </p>
                        </div>
                      </div>

                      {/* Footer Message 1 (Greeting) */}
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                          Greeting / Thank You Message
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Thank you for visiting Ravi Sweets! Have a sweet day!"
                          value={billSettings.footerMessage1}
                          onChange={(e) => setBillSettings({ ...billSettings, footerMessage1: e.target.value })}
                          className="w-full text-xs px-3 py-2 rounded-md border focus:outline-none focus:ring-1 focus:ring-[#348bdd] bg-white"
                          style={{ borderColor: "var(--color-border-base)" }}
                        />
                      </div>

                      {/* Footer Message 2 (Terms & Conditions) */}
                      <div className="p-3 rounded-lg border bg-slate-50/60 space-y-2" style={{ borderColor: "var(--color-border-subtle)" }}>
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-slate-800 flex items-center gap-1.5 cursor-pointer">
                            <span>Print Store Return / Sales Policy</span>
                          </label>
                          <input
                            type="checkbox"
                            checked={billSettings.showTerms}
                            onChange={(e) => setBillSettings({ ...billSettings, showTerms: e.target.checked })}
                            className="w-4 h-4 rounded text-[#348bdd] focus:ring-[#348bdd] cursor-pointer"
                          />
                        </div>
                        {billSettings.showTerms && (
                          <input
                            type="text"
                            placeholder="e.g. Goods once sold cannot be returned."
                            value={billSettings.footerMessage2}
                            onChange={(e) => setBillSettings({ ...billSettings, footerMessage2: e.target.value })}
                            className="w-full text-xs px-3 py-1.5 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                            style={{ borderColor: "var(--color-border-base)" }}
                          />
                        )}
                      </div>

                      {/* UPI QR / Payment ID */}
                      <div className="p-3 rounded-lg border bg-slate-50/60 space-y-2" style={{ borderColor: "var(--color-border-subtle)" }}>
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-slate-800 flex items-center gap-1.5 cursor-pointer">
                            <QrCode size={14} className="text-[#348bdd]" />
                            <span>Print UPI ID in Footer</span>
                          </label>
                          <input
                            type="checkbox"
                            checked={billSettings.showUpiQr}
                            onChange={(e) => setBillSettings({ ...billSettings, showUpiQr: e.target.checked })}
                            className="w-4 h-4 rounded text-[#348bdd] focus:ring-[#348bdd] cursor-pointer"
                          />
                        </div>
                        {billSettings.showUpiQr && (
                          <input
                            type="text"
                            placeholder="e.g. ravisweets@upi or 9848012345@paytm"
                            value={billSettings.upiId}
                            onChange={(e) => setBillSettings({ ...billSettings, upiId: e.target.value })}
                            className="w-full text-xs px-3 py-1.5 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd] font-mono"
                            style={{ borderColor: "var(--color-border-base)" }}
                          />
                        )}
                      </div>

                      {/* Paper Size & Hardware Auto-Cut */}
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                            Paper Width
                          </label>
                          <select
                            value={billSettings.paperSize}
                            onChange={(e) => setBillSettings({ ...billSettings, paperSize: e.target.value as "2inch" | "3inch" })}
                            className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd] cursor-pointer"
                            style={{ borderColor: "var(--color-border-base)" }}
                          >
                            <option value="3inch">3 Inch (80mm standard)</option>
                            <option value="2inch">2 Inch (58mm compact)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                            Hardware Guillotine Cutter
                          </label>
                          <label className="flex items-center justify-between p-2 rounded-md border bg-white cursor-pointer h-[34px]" style={{ borderColor: "var(--color-border-base)" }}>
                            <span className="text-xs text-slate-700">Auto-Cut Paper</span>
                            <input
                              type="checkbox"
                              checked={billSettings.autoCut}
                              onChange={(e) => setBillSettings({ ...billSettings, autoCut: e.target.checked })}
                              className="w-4 h-4 rounded text-[#348bdd] focus:ring-[#348bdd]"
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={isSavingBill}
                        className="flex items-center gap-2 px-5 py-2.5 text-xs rounded-md text-white transition-opacity hover:opacity-90 disabled:opacity-50 font-normal shadow-xs cursor-pointer"
                        style={{ backgroundColor: "var(--color-brand-primary)" }}
                      >
                        {isSavingBill ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        <span>{isSavingBill ? "Saving Bill Settings..." : "Save Bill Settings"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Live Thermal Bill Preview */}
                  <div className="lg:col-span-5 sticky top-4 space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                        <Eye size={14} className="text-[#348bdd]" />
                        <span>Live Thermal Bill Preview</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {billSettings.paperSize === "2inch" ? "58mm Roll" : "80mm Roll"}
                      </span>
                    </div>

                    <div
                      className="p-4 rounded-xl border bg-white shadow-md text-black font-mono leading-tight mx-auto transition-all"
                      style={{
                        maxWidth: billSettings.paperSize === "2inch" ? "260px" : "340px",
                        fontSize: billSettings.paperSize === "2inch" ? "10px" : "11px",
                        borderColor: "var(--color-border-base)",
                      }}
                    >
                      {/* Thermal Header */}
                      <div className="text-center space-y-1">
                        <div className="text-sm font-bold uppercase tracking-wide">
                          {billSettings.headerTitle.trim() || profileData.tradeName || "RAVI SWEETS"}
                        </div>
                        {billSettings.showTagline && billSettings.tagline && (
                          <div className="text-[10px] font-semibold">{billSettings.tagline}</div>
                        )}
                        {billSettings.showAddress && (
                          <div className="text-[9px] text-slate-700">
                            {profileData.address || "Main Road"}, {profileData.city || "Chirala"}
                          </div>
                        )}
                        {billSettings.showPhone && profileData.phone && (
                          <div className="text-[9px] text-slate-700">Ph: {profileData.phone}</div>
                        )}
                        {billSettings.showEmail && profileData.email && (
                          <div className="text-[9px] text-slate-700">Email: {profileData.email}</div>
                        )}
                        {billSettings.showGstin && gstData.gstNumber && (
                          <div className="text-[9px] font-bold">GSTIN: {gstData.gstNumber}</div>
                        )}
                        {billSettings.showFssai && billSettings.fssaiNumber && (
                          <div className="text-[9px]">FSSAI: {billSettings.fssaiNumber}</div>
                        )}
                      </div>

                      <div className="border-t border-dashed border-black my-2" />
                      <div className="text-center font-bold text-[10px]">
                        {gstData.enabled ? "TAX INVOICE" : "BILL RECEIPT"}
                      </div>
                      <div className="border-t border-dashed border-black my-2" />

                      {/* Meta */}
                      <div className="text-[9.5px] space-y-0.5">
                        <div className="flex justify-between">
                          <span>Bill #: RS-202611-1042</span>
                          <span>Walk-In</span>
                        </div>
                        {billSettings.showDateAndTime && (
                          <div className="flex justify-between text-[9px]">
                            <span>Date: 23-Nov-2026</span>
                            <span>11:30 AM</span>
                          </div>
                        )}
                        {billSettings.showCashierName && (
                          <div className="text-[9px] text-slate-600">Counter: Main POS Register</div>
                        )}
                        {billSettings.showCustomerDetails && (
                          <div className="text-[9px] text-slate-700 border-t border-dotted border-slate-300 pt-0.5 mt-0.5">
                            Customer: Venkata Rao (+91 98480 12345)
                          </div>
                        )}
                      </div>

                      <div className="border-t border-dashed border-black my-2" />

                      {/* Sample Items */}
                      <table className="w-full text-[9px] border-collapse">
                        <thead>
                          <tr className="border-b border-black">
                            <th className="text-left pb-1">Item</th>
                            <th className="text-center pb-1">Qty</th>
                            <th className="text-right pb-1">Rate</th>
                            <th className="text-right pb-1">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-dotted divide-slate-200">
                          <tr>
                            <td className="py-1">Motichoor Laddu (Pure Ghee)</td>
                            <td className="text-center">1 KG</td>
                            <td className="text-right">560</td>
                            <td className="text-right font-medium">560.00</td>
                          </tr>
                          <tr>
                            <td className="py-1">Kaju Katli (Silver Foil)</td>
                            <td className="text-center">0.5 KG</td>
                            <td className="text-right">1100</td>
                            <td className="text-right font-medium">550.00</td>
                          </tr>
                        </tbody>
                      </table>

                      <div className="border-t border-dashed border-black my-2" />

                      {/* Financials */}
                      <div className="text-[9.5px] space-y-0.5">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>₹1,110.00</span>
                        </div>
                        {gstData.enabled && (
                          <>
                            <div className="flex justify-between text-[9px]">
                              <span>CGST (2.5%):</span>
                              <span>₹26.43</span>
                            </div>
                            <div className="flex justify-between text-[9px]">
                              <span>SGST (2.5%):</span>
                              <span>₹26.43</span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between font-bold text-xs pt-1 border-t border-black">
                          <span>GRAND TOTAL:</span>
                          <span>₹1,110.00</span>
                        </div>
                        <div className="flex justify-between text-[9px] pt-0.5">
                          <span>Paid Mode:</span>
                          <span>UPI (Google Pay)</span>
                        </div>
                      </div>

                      <div className="border-t-2 border-black my-2" />

                      {/* Thermal Footer */}
                      <div className="text-center text-[9px] space-y-0.5">
                        {billSettings.footerMessage1 && (
                          <div className="font-medium">{billSettings.footerMessage1}</div>
                        )}
                        {billSettings.showTerms && billSettings.footerMessage2 && (
                          <div className="text-[8px] text-slate-600">{billSettings.footerMessage2}</div>
                        )}
                        {billSettings.showUpiQr && billSettings.upiId && (
                          <div className="text-[8.5px] font-bold text-black mt-1">
                            Pay via UPI: {billSettings.upiId}
                          </div>
                        )}
                        {!billSettings.footerMessage1 && !billSettings.footerMessage2 && (
                          <div>Thank You! Visit Again</div>
                        )}
                      </div>

                      {billSettings.autoCut && (
                        <div className="text-center text-[8px] text-slate-400 mt-3 pt-1 border-t border-dotted border-slate-300">
                          - - - - - [ HARDWARE CUT ] - - - - -
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </form>
            )}

            {/* TAB 4: A4 Invoice Settings */}
            {activeTab === "invoice" && (
              <form onSubmit={handleSaveInvoiceSettings} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Configuration Controls */}
                  <div className="lg:col-span-7 space-y-5">
                    {/* Card 1: Logo & Signature Images */}
                    <div
                      className="p-5 rounded-xl border bg-white shadow-2xs space-y-4"
                      style={{ borderColor: "var(--color-border-base)" }}
                    >
                      <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--color-border-subtle)" }}>
                        <div>
                          <h3 className="text-sm text-slate-800 flex items-center gap-2" style={{ fontWeight: 500 }}>
                            <ImageIcon size={16} className="text-[#348bdd]" />
                            <span>Logo & Signature Images</span>
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Upload your company logo and authorized signatory signature image for A4 tax invoices
                          </p>
                        </div>
                      </div>

                      {/* Two Columns: Logo & Signature File Pickers */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* 1. Logo Picker */}
                        <div className="p-3.5 rounded-lg border bg-slate-50/60 space-y-2.5" style={{ borderColor: "var(--color-border-subtle)" }}>
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-slate-800 flex items-center gap-1.5">
                              <span>Company Logo</span>
                            </label>
                            <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={invoiceSettings.showLogo}
                                onChange={(e) => setInvoiceSettings({ ...invoiceSettings, showLogo: e.target.checked })}
                                className="w-3.5 h-3.5 rounded text-[#348bdd]"
                              />
                              <span>Show on Bill</span>
                            </label>
                          </div>

                          {invoiceSettings.logoUrl ? (
                            <div className="relative group rounded-md border border-slate-200 bg-white p-2 flex flex-col items-center justify-center min-h-[90px]">
                              <img
                                src={invoiceSettings.logoUrl}
                                alt="Logo Preview"
                                className="max-h-16 max-w-full object-contain"
                              />
                              <button
                                type="button"
                                onClick={() => setInvoiceSettings({ ...invoiceSettings, logoUrl: "" })}
                                className="absolute top-1 right-1 p-1 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors shadow-2xs cursor-pointer"
                                title="Remove Logo"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ) : (
                            <div className="rounded-md border border-dashed border-slate-300 bg-white p-3 flex flex-col items-center justify-center min-h-[90px] text-center">
                              <ImageIcon size={22} className="text-slate-300 mb-1" />
                              <span className="text-[11px] text-slate-400">No logo chosen</span>
                            </div>
                          )}

                          <label className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer shadow-2xs transition-colors">
                            <Upload size={13} className="text-[#348bdd]" />
                            <span>Choose Logo Image</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleImageFileChange(e, "logoUrl")}
                              className="hidden"
                            />
                          </label>
                        </div>

                        {/* 2. Signature Picker */}
                        <div className="p-3.5 rounded-lg border bg-slate-50/60 space-y-2.5" style={{ borderColor: "var(--color-border-subtle)" }}>
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-slate-800 flex items-center gap-1.5">
                              <PenTool size={13} className="text-[#348bdd]" />
                              <span>Authorized Signature</span>
                            </label>
                            <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={invoiceSettings.showSignature}
                                onChange={(e) => setInvoiceSettings({ ...invoiceSettings, showSignature: e.target.checked })}
                                className="w-3.5 h-3.5 rounded text-[#348bdd]"
                              />
                              <span>Show on Bill</span>
                            </label>
                          </div>

                          {invoiceSettings.signatureUrl ? (
                            <div className="relative group rounded-md border border-slate-200 bg-white p-2 flex flex-col items-center justify-center min-h-[90px]">
                              <img
                                src={invoiceSettings.signatureUrl}
                                alt="Signature Preview"
                                className="max-h-16 max-w-full object-contain"
                              />
                              <button
                                type="button"
                                onClick={() => setInvoiceSettings({ ...invoiceSettings, signatureUrl: "" })}
                                className="absolute top-1 right-1 p-1 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors shadow-2xs cursor-pointer"
                                title="Remove Signature"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ) : (
                            <div className="rounded-md border border-dashed border-slate-300 bg-white p-3 flex flex-col items-center justify-center min-h-[90px] text-center">
                              <PenTool size={22} className="text-slate-300 mb-1" />
                              <span className="text-[11px] text-slate-400">No signature chosen</span>
                            </div>
                          )}

                          <label className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer shadow-2xs transition-colors">
                            <Upload size={13} className="text-[#348bdd]" />
                            <span>Choose Signature Image</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleImageFileChange(e, "signatureUrl")}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>

                      {/* Signatory Text Fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                            Signatory Designation
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Authorized Signatory / Managing Partner"
                            value={invoiceSettings.signatoryName}
                            onChange={(e) => setInvoiceSettings({ ...invoiceSettings, signatoryName: e.target.value })}
                            className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                            style={{ borderColor: "var(--color-border-base)" }}
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                            Signatory Company Line
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. For Ravi Sweets & Cold Drinks"
                            value={invoiceSettings.signatoryCompany}
                            onChange={(e) => setInvoiceSettings({ ...invoiceSettings, signatoryCompany: e.target.value })}
                            className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                            style={{ borderColor: "var(--color-border-base)" }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Invoice Metadata & Taxes */}
                    <div
                      className="p-5 rounded-xl border bg-white shadow-2xs space-y-4"
                      style={{ borderColor: "var(--color-border-base)" }}
                    >
                      <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--color-border-subtle)" }}>
                        <div>
                          <h3 className="text-sm text-slate-800 flex items-center gap-2" style={{ fontWeight: 500 }}>
                            <FileText size={16} className="text-[#348bdd]" />
                            <span>Invoice Metadata & Tax Details</span>
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Header titles, invoice numbering prefix, and tax identification numbers
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                            Invoice Title Heading
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. TAX INVOICE or BILL OF SUPPLY"
                            value={invoiceSettings.invoiceTitle}
                            onChange={(e) => setInvoiceSettings({ ...invoiceSettings, invoiceTitle: e.target.value })}
                            className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd] font-medium"
                            style={{ borderColor: "var(--color-border-base)" }}
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                            Invoice Number Prefix
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. RS-INV- or ORD-"
                            value={invoiceSettings.invoicePrefix}
                            onChange={(e) => setInvoiceSettings({ ...invoiceSettings, invoicePrefix: e.target.value })}
                            className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd] font-mono"
                            style={{ borderColor: "var(--color-border-base)" }}
                          />
                        </div>
                      </div>

                      {/* PAN & FSSAI inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="p-3 rounded-lg border bg-slate-50/60 space-y-2" style={{ borderColor: "var(--color-border-subtle)" }}>
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-slate-800 flex items-center gap-1.5 cursor-pointer">
                              <span>Show PAN Number</span>
                            </label>
                            <input
                              type="checkbox"
                              checked={invoiceSettings.showPan}
                              onChange={(e) => setInvoiceSettings({ ...invoiceSettings, showPan: e.target.checked })}
                              className="w-4 h-4 rounded text-[#348bdd]"
                            />
                          </div>
                          {invoiceSettings.showPan && (
                            <input
                              type="text"
                              placeholder="10-digit PAN (e.g. ABCDE1234F)"
                              value={invoiceSettings.panNumber}
                              onChange={(e) => setInvoiceSettings({ ...invoiceSettings, panNumber: e.target.value.toUpperCase() })}
                              className="w-full text-xs px-3 py-1.5 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd] font-mono"
                              style={{ borderColor: "var(--color-border-base)" }}
                            />
                          )}
                        </div>

                        <div className="p-3 rounded-lg border bg-slate-50/60 space-y-2" style={{ borderColor: "var(--color-border-subtle)" }}>
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-slate-800 flex items-center gap-1.5 cursor-pointer">
                              <span>Show FSSAI License</span>
                            </label>
                            <input
                              type="checkbox"
                              checked={invoiceSettings.showFssai}
                              onChange={(e) => setInvoiceSettings({ ...invoiceSettings, showFssai: e.target.checked })}
                              className="w-4 h-4 rounded text-[#348bdd]"
                            />
                          </div>
                          {invoiceSettings.showFssai && (
                            <input
                              type="text"
                              placeholder="14-digit FSSAI (e.g. 10119024000123)"
                              value={invoiceSettings.fssaiNumber}
                              onChange={(e) => setInvoiceSettings({ ...invoiceSettings, fssaiNumber: e.target.value })}
                              className="w-full text-xs px-3 py-1.5 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd] font-mono"
                              style={{ borderColor: "var(--color-border-base)" }}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card 3: Bank Remittance Details */}
                    <div
                      className="p-5 rounded-xl border bg-white shadow-2xs space-y-4"
                      style={{ borderColor: "var(--color-border-base)" }}
                    >
                      <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--color-border-subtle)" }}>
                        <div>
                          <h3 className="text-sm text-slate-800 flex items-center gap-2" style={{ fontWeight: 500 }}>
                            <Landmark size={16} className="text-[#348bdd]" />
                            <span>Bank Account Details for Payment</span>
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Bank instructions printed directly on invoices so buyers can transfer funds via NEFT/RTGS/UPI
                          </p>
                        </div>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={invoiceSettings.showBankDetails}
                            onChange={(e) => setInvoiceSettings({ ...invoiceSettings, showBankDetails: e.target.checked })}
                            className="w-4 h-4 rounded text-[#348bdd]"
                          />
                          <span>Show on Invoice</span>
                        </label>
                      </div>

                      {invoiceSettings.showBankDetails && (
                        <div className="space-y-3 pt-1">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                                Bank Name
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. State Bank of India"
                                value={invoiceSettings.bankName}
                                onChange={(e) => setInvoiceSettings({ ...invoiceSettings, bankName: e.target.value })}
                                className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                                style={{ borderColor: "var(--color-border-base)" }}
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                                Account Beneficiary Name
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Ravi Sweets"
                                value={invoiceSettings.accountName}
                                onChange={(e) => setInvoiceSettings({ ...invoiceSettings, accountName: e.target.value })}
                                className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                                style={{ borderColor: "var(--color-border-base)" }}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                                Account Number
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. 123456789012"
                                value={invoiceSettings.accountNumber}
                                onChange={(e) => setInvoiceSettings({ ...invoiceSettings, accountNumber: e.target.value })}
                                className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd] font-mono"
                                style={{ borderColor: "var(--color-border-base)" }}
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                                IFSC Code
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. SBIN0000823"
                                value={invoiceSettings.ifscCode}
                                onChange={(e) => setInvoiceSettings({ ...invoiceSettings, ifscCode: e.target.value.toUpperCase() })}
                                className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd] font-mono"
                                style={{ borderColor: "var(--color-border-base)" }}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                                Bank Branch
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Station Road Branch, Chirala"
                                value={invoiceSettings.branch}
                                onChange={(e) => setInvoiceSettings({ ...invoiceSettings, branch: e.target.value })}
                                className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                                style={{ borderColor: "var(--color-border-base)" }}
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                                UPI VPA / QR ID
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. ravisweets@sbi"
                                value={invoiceSettings.upiId}
                                onChange={(e) => setInvoiceSettings({ ...invoiceSettings, upiId: e.target.value })}
                                className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd] font-mono"
                                style={{ borderColor: "var(--color-border-base)" }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card 4: Terms & Footer Declaration */}
                    <div
                      className="p-5 rounded-xl border bg-white shadow-2xs space-y-4"
                      style={{ borderColor: "var(--color-border-base)" }}
                    >
                      <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--color-border-subtle)" }}>
                        <div>
                          <h3 className="text-sm text-slate-800 flex items-center gap-2" style={{ fontWeight: 500 }}>
                            <FileCheck size={16} className="text-[#348bdd]" />
                            <span>Terms & Conditions and Notes</span>
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Printed at the bottom-left of every generated A4 tax invoice
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                          Terms & Conditions (One per line)
                        </label>
                        <textarea
                          rows={4}
                          placeholder="1. Goods once sold will not be returned.\n2. Payment due within 7 days."
                          value={invoiceSettings.termsAndConditions}
                          onChange={(e) => setInvoiceSettings({ ...invoiceSettings, termsAndConditions: e.target.value })}
                          className="w-full text-xs p-3 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd] leading-relaxed font-sans"
                          style={{ borderColor: "var(--color-border-base)" }}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wider mb-1">
                          Invoice Bottom Note / Declaration
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. This is a computer generated invoice and requires no physical signature."
                          value={invoiceSettings.footerNote}
                          onChange={(e) => setInvoiceSettings({ ...invoiceSettings, footerNote: e.target.value })}
                          className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                          style={{ borderColor: "var(--color-border-base)" }}
                        />
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={isSavingInvoice}
                        className="flex items-center gap-2 px-5 py-2.5 text-xs rounded-md text-white transition-opacity hover:opacity-90 disabled:opacity-50 font-normal shadow-xs cursor-pointer"
                        style={{ backgroundColor: "var(--color-brand-primary)" }}
                      >
                        {isSavingInvoice ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        <span>{isSavingInvoice ? "Saving Invoice Settings..." : "Save A4 Invoice Settings"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Live A4 Invoice Sheet Preview */}
                  <div className="lg:col-span-5 sticky top-4 space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                        <Eye size={14} className="text-[#348bdd]" />
                        <span>Live A4 Invoice Sheet Preview</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">Standard A4 Sheet</span>
                    </div>

                    <div
                      className="p-5 rounded-lg border bg-white shadow-md text-slate-900 text-[10px] leading-tight space-y-3.5 mx-auto transition-all"
                      style={{ borderColor: "var(--color-border-base)" }}
                    >
                      {/* Invoice Sheet Header: Logo & Company Name */}
                      <div className="flex items-start justify-between gap-3 border-b-2 border-slate-900 pb-3">
                        <div className="space-y-0.5">
                          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                            {profileData.tradeName || "RAVI SWEETS & COLD DRINKS"}
                          </h4>
                          <p className="text-[9px] text-slate-500">
                            {profileData.address || "Main Road"}, {profileData.city || "Chirala"}, {profileData.state}
                          </p>
                          <p className="text-[9px] text-slate-600 font-mono">
                            Ph: {profileData.phone || "+91 94402 61276"} | Email: {profileData.email || "info@ravisweets.com"}
                          </p>
                          {gstData.gstNumber && (
                            <p className="text-[9.5px] font-bold text-slate-900 font-mono">
                              GSTIN: {gstData.gstNumber}
                            </p>
                          )}
                          {invoiceSettings.showPan && invoiceSettings.panNumber && (
                            <p className="text-[9px] text-slate-700 font-mono">PAN: {invoiceSettings.panNumber}</p>
                          )}
                          {invoiceSettings.showFssai && invoiceSettings.fssaiNumber && (
                            <p className="text-[9px] text-slate-700 font-mono">FSSAI: {invoiceSettings.fssaiNumber}</p>
                          )}
                        </div>

                        {invoiceSettings.showLogo && invoiceSettings.logoUrl && (
                          <div className="shrink-0 max-w-[90px] max-h-[60px] p-1 border border-slate-200 rounded bg-white">
                            <img
                              src={invoiceSettings.logoUrl}
                              alt="Logo"
                              className="max-h-12 max-w-full object-contain"
                            />
                          </div>
                        )}
                      </div>

                      {/* Invoice Title & Meta */}
                      <div className="flex items-center justify-between py-1 bg-slate-50 px-2 rounded border border-slate-200 font-mono text-[9px]">
                        <div>
                          <strong>{invoiceSettings.invoiceTitle || "TAX INVOICE"}</strong>
                        </div>
                        <div className="text-right">
                          <span>Invoice #: <strong>{invoiceSettings.invoicePrefix || "RS-INV-"}1084</strong></span>
                          <span className="ml-2 text-slate-400">|</span>
                          <span className="ml-2">Date: <strong>23-Nov-2026</strong></span>
                        </div>
                      </div>

                      {/* Billed To */}
                      <div className="p-2 rounded bg-slate-50/50 border border-slate-100 text-[9px]">
                        <span className="text-slate-400 block text-[8px] uppercase tracking-wider">Billed To (Buyer)</span>
                        <div className="font-bold text-slate-800">Sri Krishna Caterers & Events</div>
                        <div className="text-slate-500">Kothapeta Road, Chirala, AP - 523155</div>
                        <div className="font-mono text-slate-600">Ph: +91 98480 99887 | GSTIN: 37AAACS1234D1Z5</div>
                      </div>

                      {/* Sample Table */}
                      <table className="w-full text-[9px] border-collapse border border-slate-200">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                            <th className="p-1 text-left">#</th>
                            <th className="p-1 text-left">Item Description</th>
                            <th className="p-1 text-center">Unit</th>
                            <th className="p-1 text-center">Qty</th>
                            <th className="p-1 text-right">Rate</th>
                            <th className="p-1 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          <tr>
                            <td className="p-1 font-mono">1</td>
                            <td className="p-1 font-medium">Special Pure Ghee Motichoor Laddu</td>
                            <td className="p-1 text-center font-mono">Tray</td>
                            <td className="p-1 text-center font-mono">10</td>
                            <td className="p-1 text-right font-mono">1,400.00</td>
                            <td className="p-1 text-right font-mono font-medium">14,000.00</td>
                          </tr>
                          <tr>
                            <td className="p-1 font-mono">2</td>
                            <td className="p-1 font-medium">Cashew Kaju Katli (Diamond Cut)</td>
                            <td className="p-1 text-center font-mono">KG</td>
                            <td className="p-1 text-center font-mono">5</td>
                            <td className="p-1 text-right font-mono">1,100.00</td>
                            <td className="p-1 text-right font-mono font-medium">5,500.00</td>
                          </tr>
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 font-bold border-t border-slate-300">
                            <td colSpan={5} className="p-1 text-right">Grand Total:</td>
                            <td className="p-1 text-right font-mono">₹19,500.00</td>
                          </tr>
                        </tfoot>
                      </table>

                      {/* Bank Details & Terms & Signature */}
                      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-200">
                        {/* Bank Details & Terms */}
                        <div className="space-y-2 text-[8.5px]">
                          {invoiceSettings.showBankDetails && (
                            <div className="p-2 rounded border border-blue-200 bg-blue-50/50 space-y-0.5">
                              <span className="font-bold text-[#348bdd] block text-[9px]">Bank Remittance Details:</span>
                              <div>Bank: <strong>{invoiceSettings.bankName || "State Bank of India"}</strong></div>
                              <div>A/C Name: <strong>{invoiceSettings.accountName || profileData.tradeName}</strong></div>
                              <div>A/C No: <strong className="font-mono">{invoiceSettings.accountNumber || "123456789012"}</strong></div>
                              <div>IFSC: <strong className="font-mono">{invoiceSettings.ifscCode || "SBIN0000823"}</strong></div>
                              {invoiceSettings.branch && <div>Branch: {invoiceSettings.branch}</div>}
                              {invoiceSettings.upiId && <div>UPI: <strong className="font-mono">{invoiceSettings.upiId}</strong></div>}
                            </div>
                          )}

                          {invoiceSettings.termsAndConditions && (
                            <div className="text-[8px] text-slate-500 leading-snug">
                              <strong className="text-slate-700 block mb-0.5">Terms & Conditions:</strong>
                              <div className="whitespace-pre-line">{invoiceSettings.termsAndConditions}</div>
                            </div>
                          )}
                        </div>

                        {/* Authorized Signature Card */}
                        <div className="flex flex-col justify-between items-end text-right text-[8.5px] pl-2">
                          <div className="font-medium text-slate-800">
                            {invoiceSettings.signatoryCompany || `For ${profileData.tradeName || "Ravi Sweets"}`}
                          </div>

                          {invoiceSettings.showSignature && invoiceSettings.signatureUrl ? (
                            <div className="my-1 border border-slate-200 rounded p-1 bg-white">
                              <img
                                src={invoiceSettings.signatureUrl}
                                alt="Signature"
                                className="max-h-12 max-w-[120px] object-contain"
                              />
                            </div>
                          ) : (
                            <div className="h-10 w-24 border-b border-dashed border-slate-300 my-1" />
                          )}

                          <div className="font-bold text-slate-900 border-t border-slate-300 pt-1 w-28 text-center">
                            {invoiceSettings.signatoryName || "Authorized Signatory"}
                          </div>
                        </div>
                      </div>

                      {/* Footer Note */}
                      {invoiceSettings.footerNote && (
                        <div className="text-center text-[7.5px] text-slate-400 pt-1 border-t border-slate-100">
                          {invoiceSettings.footerNote}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
