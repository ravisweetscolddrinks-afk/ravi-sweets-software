"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDocs,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import ConfirmationModal from "@/components/ConfirmationModal";
import SearchableSelect, { SelectOption } from "@/components/SearchableSelect";
import { RoundoffRule } from "@/types/roundoff";
import {
  Scale,
  Plus,
  Sparkles,
  Search,
  RotateCw,
  Edit2,
  Trash2,
  Store,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  ArrowRight,
  Info,
  Check,
  X,
  Loader2,
} from "lucide-react";

interface StoreOption {
  id: string;
  name: string;
  phone?: string;
  address?: string;
}

export default function RoundoffLogicTab() {
  const { showToast } = useToast();

  // State
  const [rules, setRules] = useState<RoundoffRule[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>("all");

  // Modal State for Add / Edit Rule
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<RoundoffRule | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form Data
  const [formData, setFormData] = useState({
    fromWeight: "" as number | "",
    toWeight: "" as number | "",
    roundOffValue: "" as number | "",
    storeId: "all",
    notes: "",
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Delete State
  const [deletingRule, setDeletingRule] = useState<RoundoffRule | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Apply to All Products State
  const [isApplyingToAll, setIsApplyingToAll] = useState<boolean>(false);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState<boolean>(false);

  // Interactive Live Tester in Tab
  const [testWeightInput, setTestWeightInput] = useState<string>("0.995");

  // 1. Realtime Listeners for Rules and Stores
  useEffect(() => {
    setIsLoading(true);

    // Roundoff Rules Listener
    const rulesQuery = query(collection(db, "roundoff_rules"), orderBy("fromWeight", "asc"));
    const unsubRules = onSnapshot(
      rulesQuery,
      (snapshot) => {
        const list: RoundoffRule[] = [];
        snapshot.docs.forEach((d) => {
          list.push({
            id: d.id,
            ...(d.data() as Omit<RoundoffRule, "id">),
          });
        });
        setRules(list);
        setIsLoading(false);
      },
      (err) => {
        console.error("Rules fetch error:", err);
        showToast("Error loading roundoff rules", "error");
        setIsLoading(false);
      }
    );

    // Stores Listener
    const storesQuery = query(collection(db, "stores"), orderBy("name", "asc"));
    const unsubStores = onSnapshot(
      storesQuery,
      (snapshot) => {
        const list: StoreOption[] = [];
        snapshot.docs.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            name: data.name || "Unnamed Store",
            phone: data.phone || "",
            address: data.address || "",
          });
        });
        setStores(list);
      },
      (err) => {
        console.error("Stores fetch error:", err);
      }
    );

    return () => {
      unsubRules();
      unsubStores();
    };
  }, [showToast]);

  // Store options for SearchableSelect
  const storeSelectOptions: SelectOption[] = useMemo(() => {
    const list: SelectOption[] = [
      {
        value: "all",
        label: "🌐 All Stores (Global Rule)",
        sublabel: "Applies to every store & billing counter",
      },
    ];
    stores.forEach((s) => {
      list.push({
        value: s.id,
        label: s.name,
        sublabel: s.address ? `📍 ${s.address}` : undefined,
      });
    });
    return list;
  }, [stores]);

  // Filtered Rules
  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      if (selectedStoreFilter !== "all") {
        if (r.storeId !== "all" && r.storeId !== selectedStoreFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNotes = (r.notes || "").toLowerCase().includes(q);
        const matchStore = (r.storeName || "").toLowerCase().includes(q);
        const matchWeight =
          String(r.fromWeight).includes(q) ||
          String(r.toWeight).includes(q) ||
          String(r.roundOffValue).includes(q);
        if (!matchNotes && !matchStore && !matchWeight) return false;
      }
      return true;
    });
  }, [rules, selectedStoreFilter, searchQuery]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingRule(null);
    setFormData({
      fromWeight: "",
      toWeight: "",
      roundOffValue: "",
      storeId: "all",
      notes: "",
      isActive: true,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (rule: RoundoffRule) => {
    setEditingRule(rule);
    setFormData({
      fromWeight: rule.fromWeight,
      toWeight: rule.toWeight,
      roundOffValue: rule.roundOffValue,
      storeId: rule.storeId || "all",
      notes: rule.notes || "",
      isActive: rule.isActive ?? true,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Toggle Active status in 1 click
  const handleToggleActive = async (rule: RoundoffRule) => {
    try {
      await updateDoc(doc(db, "roundoff_rules", rule.id), {
        isActive: !rule.isActive,
        updatedAt: serverTimestamp(),
      });
      showToast(
        `Rule (${rule.fromWeight} - ${rule.toWeight} KG) ${
          !rule.isActive ? "activated" : "deactivated"
        }`,
        "info"
      );
    } catch (e: any) {
      showToast("Error updating status: " + e.message, "error");
    }
  };

  // Validate Form
  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    const from = Number(formData.fromWeight);
    const to = Number(formData.toWeight);
    const round = Number(formData.roundOffValue);

    if (formData.fromWeight === "" || isNaN(from) || from <= 0) {
      errors.fromWeight = "Please enter a valid From Weight > 0";
    }
    if (formData.toWeight === "" || isNaN(to) || to <= 0) {
      errors.toWeight = "Please enter a valid To Weight > 0";
    } else if (from > 0 && to <= from) {
      errors.toWeight = "To Weight must be strictly greater than From Weight";
    }
    if (formData.roundOffValue === "" || isNaN(round) || round <= 0) {
      errors.roundOffValue = "Please enter a valid Roundoff Value > 0";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save Rule
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const selectedStoreObj = stores.find((s) => s.id === formData.storeId);
      const storeName = formData.storeId === "all" ? "All Stores" : selectedStoreObj?.name || "Selected Store";

      const payload = {
        fromWeight: Number(formData.fromWeight),
        toWeight: Number(formData.toWeight),
        roundOffValue: Number(formData.roundOffValue),
        storeId: formData.storeId,
        storeName: storeName,
        notes: (formData.notes || "").trim(),
        isActive: formData.isActive,
        updatedAt: serverTimestamp(),
      };

      if (editingRule) {
        await updateDoc(doc(db, "roundoff_rules", editingRule.id), payload);
        showToast("Roundoff logic rule updated successfully!", "success");
      } else {
        await addDoc(collection(db, "roundoff_rules"), {
          ...payload,
          appliedToAllProducts: true,
          createdAt: serverTimestamp(),
        });
        showToast("New roundoff logic rule created successfully!", "success");
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Save rule error:", err);
      showToast("Error saving rule: " + err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Rule
  const handleDeleteRule = async () => {
    if (!deletingRule) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "roundoff_rules", deletingRule.id));
      showToast("Roundoff rule deleted", "success");
      setDeletingRule(null);
    } catch (err: any) {
      showToast("Failed to delete rule: " + err.message, "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Load Recommended Sweet Shop Presets
  const handleLoadPresets = async () => {
    try {
      const presets = [
        { fromWeight: 0.095, toWeight: 0.105, roundOffValue: 0.1, notes: "100g Standard Sweet Pack" },
        { fromWeight: 0.235, toWeight: 0.265, roundOffValue: 0.25, notes: "1/4 KG (250g) Standard Sweet Box" },
        { fromWeight: 0.485, toWeight: 0.515, roundOffValue: 0.5, notes: "1/2 KG (500g) Standard Sweet Box" },
        { fromWeight: 0.98, toWeight: 1.02, roundOffValue: 1.0, notes: "1 KG Standard Box Roundoff" },
        { fromWeight: 1.48, toWeight: 1.52, roundOffValue: 1.5, notes: "1.5 KG Gift Pack Roundoff" },
        { fromWeight: 1.98, toWeight: 2.02, roundOffValue: 2.0, notes: "2 KG Sweet Box Roundoff" },
      ];

      for (const p of presets) {
        await addDoc(collection(db, "roundoff_rules"), {
          ...p,
          storeId: "all",
          storeName: "All Stores",
          isActive: true,
          appliedToAllProducts: true,
          createdAt: serverTimestamp(),
        });
      }
      showToast("Loaded 6 recommended sweet shop roundoff presets!", "success");
    } catch (e: any) {
      showToast("Error loading presets: " + e.message, "error");
    }
  };

  // Apply to All Products Action
  const handleApplyToAllProducts = async () => {
    setIsApplyingToAll(true);
    try {
      // 1. Fetch all products from collection
      const prodSnapshot = await getDocs(collection(db, "products"));
      let updatedCount = 0;

      // Firestore batches max 500 operations per batch
      const batches = [writeBatch(db)];
      let currentBatchIdx = 0;
      let opCount = 0;

      prodSnapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const unitLower = (data.unit || "").toLowerCase().trim();
        const isWeight =
          unitLower === "kg" ||
          unitLower.includes("kilo") ||
          unitLower === "litre" ||
          unitLower === "liter" ||
          unitLower === "ltr";

        if (isWeight) {
          const docRef = doc(db, "products", docSnap.id);
          batches[currentBatchIdx].update(docRef, {
            hasRoundOff: true,
            roundoffEnabled: true,
            updatedAt: serverTimestamp(),
          });
          updatedCount++;
          opCount++;

          if (opCount === 450) {
            batches.push(writeBatch(db));
            currentBatchIdx++;
            opCount = 0;
          }
        }
      });

      // 2. Commit all batches
      for (const b of batches) {
        await b.commit();
      }

      // 3. Mark all active roundoff rules as applied
      for (const r of rules) {
        if (r.isActive) {
          await updateDoc(doc(db, "roundoff_rules", r.id), {
            appliedToAllProducts: true,
            updatedAt: serverTimestamp(),
          });
        }
      }

      showToast(
        `Successfully applied roundoff weight logic to ${updatedCount} weight/KG products!`,
        "success"
      );
      setIsApplyModalOpen(false);
    } catch (err: any) {
      console.error("Apply to all error:", err);
      showToast("Error applying to products: " + err.message, "error");
    } finally {
      setIsApplyingToAll(false);
    }
  };

  // Tester calculation: see which rule matches test input
  const testMatch = useMemo(() => {
    const val = parseFloat(testWeightInput);
    if (isNaN(val) || val <= 0) return null;
    for (const r of rules) {
      if (!r.isActive) continue;
      const min = Math.min(r.fromWeight, r.toWeight);
      const max = Math.max(r.fromWeight, r.toWeight);
      if (val >= min - 0.0001 && val <= max + 0.0001) {
        return r;
      }
    }
    return null;
  }, [rules, testWeightInput]);

  return (
    <div className="space-y-6">
      {/* ===================================================================== */}
      {/* 1. Header Toolbar with "Apply to All Products" & "Add Roundoff Logic"   */}
      {/* ===================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-blue-50/80 via-sky-50/40 to-white border border-blue-100 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#348bdd] text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Scale size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Weight Roundoff Logic</span>
                <span className="px-2 py-0.5 text-[11px] rounded-full bg-blue-100 text-blue-800 font-mono font-medium">
                  {rules.length} {rules.length === 1 ? "rule" : "rules"}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically round off sweet scale weights to standard billing weights during Billing & POS checkout.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          {rules.length === 0 && (
            <button
              type="button"
              onClick={handleLoadPresets}
              className="px-3 py-2 text-xs font-medium rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
              title="Add standard 250g, 500g, 1KG roundoff presets"
            >
              <RotateCw size={13} className="text-blue-600" />
              <span>Load Sweet Presets</span>
            </button>
          )}

          {/* "Apply to All Products" Button */}
          <button
            type="button"
            onClick={() => setIsApplyModalOpen(true)}
            className="px-3.5 py-2 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
            title="Apply roundoff tolerance logic to all KG / weight-based products in inventory"
          >
            <Sparkles size={14} />
            <span>Apply to All Products</span>
          </button>

          {/* "Add Roundoff Logic" Button */}
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-3.5 py-2 text-xs font-medium rounded-lg text-white transition-opacity hover:opacity-90 shadow-sm flex items-center gap-1.5 cursor-pointer"
            style={{ backgroundColor: "var(--color-brand-primary)" }}
          >
            <Plus size={15} />
            <span>Add Roundoff Logic</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. Interactive Tester & Summary Banner                                */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Interactive Live Tester Card */}
        <div className="md:col-span-2 p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 font-mono">
              <Scale size={14} className="text-[#348bdd]" />
              Live Roundoff Tester (Billing & POS Simulator)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Test scale weight</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-48">
              <label className="text-[10px] text-slate-400 font-mono block mb-1">Scale Weight (KG)</label>
              <input
                type="number"
                step="0.001"
                value={testWeightInput}
                onChange={(e) => setTestWeightInput(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="e.g. 0.995"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#348bdd] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            <div className="hidden sm:flex text-slate-400 pt-4">
              <ArrowRight size={16} />
            </div>

            <div className="w-full flex-1 pt-1">
              {testMatch ? (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-semibold">Rule Matched: </span>
                      <span>
                        {testMatch.fromWeight} - {testMatch.toWeight} KG ({testMatch.storeName})
                      </span>
                    </div>
                  </div>
                  <div className="font-mono text-xs font-bold bg-white px-2.5 py-1 rounded border border-emerald-300 text-emerald-700 shrink-0">
                    Billed as: {testMatch.roundOffValue} KG
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 text-xs flex items-center gap-2">
                  <Info size={14} className="text-slate-400 shrink-0" />
                  <span>
                    No rule matched for {testWeightInput || "0"} KG. Standard actual weight will be billed.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Info & Stats Card */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
          <div className="text-xs font-semibold text-slate-800 font-mono flex items-center gap-1.5">
            <Info size={14} className="text-blue-600" />
            <span>How Roundoff Works</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            When counter staff place a box on the weighing scale, if the sweet weight falls between{" "}
            <strong>From</strong> and <strong>To</strong>, the bill uses the exact{" "}
            <strong>Roundoff Value</strong>, saving manual adjustments.
          </p>
          <div className="pt-1 flex items-center gap-2 text-[11px] font-mono text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Active rules: {rules.filter((r) => r.isActive).length} of {rules.length}</span>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. Filter & Search Bar                                                */}
      {/* ===================================================================== */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 w-full sm:w-80 bg-white shadow-2xs">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search weight, note, or store..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-transparent focus:outline-none text-slate-800 placeholder-slate-400"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Store Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-medium text-slate-500 shrink-0">Store Scope:</span>
          <select
            value={selectedStoreFilter}
            onChange={(e) => setSelectedStoreFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#348bdd] shadow-2xs"
          >
            <option value="all">All Stores</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. Roundoff Rules Table                                               */}
      {/* ===================================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center">
            <Loader2 size={24} className="animate-spin text-[#348bdd] mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-mono">Loading roundoff logic rules...</p>
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Scale size={24} />
            </div>
            <h3 className="text-sm font-semibold text-slate-800 mb-1">No Roundoff Rules Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              {rules.length === 0
                ? "Configure weight tolerance rules so sweet scales automatically round to 250g, 500g, or 1 KG."
                : "No rules match your search or store filter."}
            </p>
            {rules.length === 0 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadPresets}
                  className="px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                >
                  Load Sweet Shop Presets
                </button>
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="px-3.5 py-2 text-xs font-medium rounded-lg text-white transition-opacity hover:opacity-90 shadow-2xs cursor-pointer"
                  style={{ backgroundColor: "var(--color-brand-primary)" }}
                >
                  <Plus size={14} className="inline mr-1" />
                  Add First Rule
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-mono text-slate-600 uppercase">
                  <th className="py-3 px-4 font-semibold">Weight Range (From ➔ To)</th>
                  <th className="py-3 px-4 font-semibold text-center">Tolerance Span</th>
                  <th className="py-3 px-4 font-semibold">Billed Roundoff Value</th>
                  <th className="py-3 px-4 font-semibold">Store Scope</th>
                  <th className="py-3 px-4 font-semibold">Note / Label</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRules.map((rule) => {
                  const spanGrams = Number(((rule.toWeight - rule.fromWeight) * 1000).toFixed(1));
                  return (
                    <tr
                      key={rule.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        !rule.isActive ? "opacity-60 bg-slate-50/30" : ""
                      }`}
                    >
                      {/* Weight Range */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {rule.fromWeight} KG
                          </span>
                          <ArrowRight size={13} className="text-slate-400" />
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {rule.toWeight} KG
                          </span>
                        </div>
                      </td>

                      {/* Tolerance Span */}
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono text-[11px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                          ±{spanGrams}g window
                        </span>
                      </td>

                      {/* Billed Roundoff Value */}
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-[#348bdd] font-mono font-bold text-xs">
                          <Scale size={13} />
                          <span>{rule.roundOffValue} KG</span>
                        </div>
                      </td>

                      {/* Store Scope */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                            rule.storeId === "all"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          <Store size={11} />
                          <span>{rule.storeName || "All Stores"}</span>
                        </span>
                      </td>

                      {/* Notes / Description */}
                      <td className="py-3 px-4 text-slate-600 text-xs">
                        {rule.notes ? (
                          <span>{rule.notes}</span>
                        ) : (
                          <span className="text-slate-400 italic">No notes</span>
                        )}
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(rule)}
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-all cursor-pointer border ${
                            rule.isActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                          }`}
                        >
                          {rule.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(rule)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                            title="Edit rule"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingRule(rule)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                            title="Delete rule"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 5. Add / Edit Rule Modal                                              */}
      {/* ===================================================================== */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4 animate-in fade-in duration-150"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#348bdd] flex items-center justify-center">
                  <Scale size={16} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">
                    {editingRule ? "Edit Roundoff Logic" : "Add Roundoff Logic"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Define scale weight range and the corresponding rounded-off value.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveRule} className="p-5 space-y-4">
              {/* Range Inputs: From Weight & To Weight */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    From Weight (KG) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    placeholder="e.g. 0.980"
                    value={formData.fromWeight}
                    onChange={(e) => {
                      const v = e.target.value === "" ? "" : Number(e.target.value);
                      setFormData((prev) => ({ ...prev, fromWeight: v }));
                    }}
                    onWheel={(e) => e.currentTarget.blur()}
                    className={`w-full px-3 py-2 border rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#348bdd] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                      formErrors.fromWeight ? "border-red-400 bg-red-50/30" : "border-slate-200"
                    }`}
                  />
                  {formErrors.fromWeight && (
                    <span className="text-[11px] text-red-600 block mt-1">{formErrors.fromWeight}</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    To Weight (KG) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    placeholder="e.g. 1.020"
                    value={formData.toWeight}
                    onChange={(e) => {
                      const v = e.target.value === "" ? "" : Number(e.target.value);
                      setFormData((prev) => ({ ...prev, toWeight: v }));
                    }}
                    onWheel={(e) => e.currentTarget.blur()}
                    className={`w-full px-3 py-2 border rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#348bdd] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                      formErrors.toWeight ? "border-red-400 bg-red-50/30" : "border-slate-200"
                    }`}
                  />
                  {formErrors.toWeight && (
                    <span className="text-[11px] text-red-600 block mt-1">{formErrors.toWeight}</span>
                  )}
                </div>
              </div>

              {/* Roundoff Value Input */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Roundoff Value (Billed Weight in KG) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    placeholder="e.g. 1.000"
                    value={formData.roundOffValue}
                    onChange={(e) => {
                      const v = e.target.value === "" ? "" : Number(e.target.value);
                      setFormData((prev) => ({ ...prev, roundOffValue: v }));
                    }}
                    onWheel={(e) => e.currentTarget.blur()}
                    className={`w-full px-3 py-2 border rounded-lg text-xs font-mono font-bold text-[#348bdd] focus:outline-none focus:ring-1 focus:ring-[#348bdd] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                      formErrors.roundOffValue ? "border-red-400 bg-red-50/30" : "border-slate-200"
                    }`}
                  />
                </div>
                {formErrors.roundOffValue ? (
                  <span className="text-[11px] text-red-600 block mt-1">{formErrors.roundOffValue}</span>
                ) : (
                  <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                    Any weight between {formData.fromWeight || "From"} and {formData.toWeight || "To"} will be billed as this weight.
                  </span>
                )}
              </div>

              {/* Store Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Select Store Scope <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  options={storeSelectOptions}
                  value={formData.storeId}
                  onChange={(val) => setFormData((prev) => ({ ...prev, storeId: val }))}
                  placeholder="Select store..."
                />
              </div>

              {/* Notes / Description */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Note / Label <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Standard 1 KG Sweet Box tolerance"
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#348bdd]"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-xs font-medium text-slate-800 block">Rule Status</span>
                  <span className="text-[11px] text-slate-500">
                    Enable or disable this roundoff rule immediately
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#348bdd]"></div>
                </label>
              </div>

              {/* Real-time Preview Pill */}
              {formData.fromWeight && formData.toWeight && formData.roundOffValue && (
                <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200 text-blue-900 text-xs flex items-center gap-2">
                  <Scale size={15} className="text-[#348bdd] shrink-0" />
                  <span>
                    <strong>Rule Preview:</strong> Weights from <strong>{formData.fromWeight} KG</strong> to{" "}
                    <strong>{formData.toWeight} KG</strong> will automatically bill as{" "}
                    <strong>{formData.roundOffValue} KG</strong>.
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg text-white text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  style={{ backgroundColor: "var(--color-brand-primary)" }}
                >
                  {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  <span>{editingRule ? "Update Rule" : "Create Rule"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. "Apply to All Products" Confirmation Modal                         */}
      {/* ===================================================================== */}
      {isApplyModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4 animate-in fade-in duration-150"
          onClick={() => !isApplyingToAll && setIsApplyModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 p-6 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">
                  Apply Roundoff Logic to All Products
                </h3>
                <p className="text-xs text-slate-500">
                  Enable weight roundoff rules across all weight/KG items
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This action will scan your entire product inventory and mark all <strong>KG / Weight</strong> based
              sweets and products with roundoff capability.
            </p>

            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs space-y-1">
              <span className="font-semibold block">What happens next:</span>
              <ul className="list-disc list-inside text-[11px] text-emerald-900/90 space-y-0.5">
                <li>All active rules ({rules.filter((r) => r.isActive).length} configured) will apply during checkout.</li>
                <li>In Billing and POS, weights inside defined ranges will round off seamlessly.</li>
                <li>Pieces / box items remain unaffected.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isApplyingToAll}
                onClick={() => setIsApplyModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isApplyingToAll}
                onClick={handleApplyToAllProducts}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isApplyingToAll ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Applying to Products...</span>
                  </>
                ) : (
                  <>
                    <Check size={13} />
                    <span>Confirm & Apply</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 7. Delete Confirmation Modal                                          */}
      {/* ===================================================================== */}
      <ConfirmationModal
        isOpen={!!deletingRule}
        onCancel={() => setDeletingRule(null)}
        onConfirm={handleDeleteRule}
        title="Delete Roundoff Rule"
        message={
          deletingRule
            ? `Are you sure you want to delete the roundoff rule for ${deletingRule.fromWeight} - ${deletingRule.toWeight} KG ➔ ${deletingRule.roundOffValue} KG?`
            : ""
        }
        confirmText="Delete Rule"
        isDeleting={isDeleting}
      />
    </div>
  );
}
