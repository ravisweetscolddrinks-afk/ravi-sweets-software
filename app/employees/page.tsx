"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import OffcanvasDrawer from "@/components/OffcanvasDrawer";
import ConfirmationModal from "@/components/ConfirmationModal";
import QRCode from "qrcode";
import {
  Plus,
  Search,
  Users,
  Phone,
  Mail,
  MapPin,
  Building,
  Eye,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Loader2,
  RotateCw,
  UserCheck,
  User,
  QrCode,
  DollarSign,
  Calendar,
  AlertCircle,
  Navigation,
  Upload,
  Printer,
  ShieldAlert,
  CheckCircle2,
  X,
  CreditCard,
  Briefcase
} from "lucide-react";

export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
}

export interface EmployeeItem {
  id: string; // Firestore doc ID
  employeeId: string; // Unique 8-digit numeric ID
  name: string;
  phone: string;
  email?: string;
  city: string;
  address: string;
  profilePicUrl?: string;
  salaryType: "monthly" | "daily";
  salaryAmount: number;
  acceptedLeaves: number;
  emergencyContact: EmergencyContact;
  locationCoordinates?: {
    latitude: number;
    longitude: number;
  };
  qrCodeUrl?: string;
  status: "Active" | "Inactive";
  createdAt?: any;
  updatedAt?: any;
}

const PAGE_SIZE = 24;

export default function EmployeesPage() {
  const { showToast } = useToast();

  // State
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [salaryFilter, setSalaryFilter] = useState<"all" | "monthly" | "daily">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Drawer / Form state
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);

  // Form Fields
  const [formName, setFormName] = useState<string>("");
  const [formPhone, setFormPhone] = useState<string>("");
  const [formEmail, setFormEmail] = useState<string>("");
  const [formCity, setFormCity] = useState<string>("");
  const [formAddress, setFormAddress] = useState<string>("");
  const [formSalaryType, setFormSalaryType] = useState<"monthly" | "daily">("monthly");
  const [formSalaryAmount, setFormSalaryAmount] = useState<number | "">("");
  const [formAcceptedLeaves, setFormAcceptedLeaves] = useState<number | "">(2);
  const [formEmergencyName, setFormEmergencyName] = useState<string>("");
  const [formEmergencyRelation, setFormEmergencyRelation] = useState<string>("");
  const [formEmergencyPhone, setFormEmergencyPhone] = useState<string>("");
  const [formLat, setFormLat] = useState<string>("");
  const [formLng, setFormLng] = useState<string>("");
  const [formStatus, setFormStatus] = useState<"Active" | "Inactive">("Active");

  // Profile picture upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);

  // Modals
  const [viewingEmployee, setViewingEmployee] = useState<EmployeeItem | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<EmployeeItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [idCardEmployee, setIdCardEmployee] = useState<EmployeeItem | null>(null);

  // 1. Real-time Subscription to Employees
  useEffect(() => {
    setIsLoading(true);
    const colRef = collection(db, "employees");
    const q = query(colRef, orderBy("name", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const itemsMap = new Map<string, EmployeeItem>();
        snapshot.docs.forEach((d) => {
          const data = d.data();
          itemsMap.set(d.id, {
            id: d.id,
            employeeId: data.employeeId || "",
            name: data.name || "",
            phone: data.phone || "",
            email: data.email || "",
            city: data.city || "",
            address: data.address || "",
            profilePicUrl: data.profilePicUrl || "",
            salaryType: data.salaryType || "monthly",
            salaryAmount: Number(data.salaryAmount) || 0,
            acceptedLeaves: data.acceptedLeaves !== undefined ? Number(data.acceptedLeaves) : 2,
            emergencyContact: {
              name: data.emergencyContact?.name || "",
              relation: data.emergencyContact?.relation || "",
              phone: data.emergencyContact?.phone || "",
            },
            locationCoordinates: data.locationCoordinates || undefined,
            qrCodeUrl: data.qrCodeUrl || "",
            status: data.status || "Active",
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        });

        const items = Array.from(itemsMap.values());
        setEmployees(items);
        setTotalCount(items.length);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error fetching employees:", error);
        showToast("Error loading employees", "error");
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [showToast]);

  // Filtered & Paginated Employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // Salary filter
      if (salaryFilter !== "all" && emp.salaryType !== salaryFilter) return false;

      // Status filter
      if (statusFilter !== "all" && emp.status !== statusFilter) return false;

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        emp.name.toLowerCase().includes(q) ||
        emp.employeeId.toLowerCase().includes(q) ||
        emp.phone.toLowerCase().includes(q) ||
        emp.city.toLowerCase().includes(q) ||
        (emp.email && emp.email.toLowerCase().includes(q))
      );
    });
  }, [employees, searchQuery, salaryFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredEmployees.slice(start, start + PAGE_SIZE);
  }, [filteredEmployees, currentPage]);

  // Quick stats
  const stats = useMemo(() => {
    const total = employees.length;
    const monthlyCount = employees.filter((e) => e.salaryType === "monthly").length;
    const dailyCount = employees.filter((e) => e.salaryType === "daily").length;
    const activeCount = employees.filter((e) => e.status === "Active").length;
    return { total, monthlyCount, dailyCount, activeCount };
  }, [employees]);

  // Helper: Generate unique 8-digit numeric employee ID
  const generateUnique8DigitId = useCallback(() => {
    const existing = new Set(employees.map((e) => e.employeeId));
    let candidate = "";
    let attempts = 0;
    while (attempts < 1000) {
      // 8-digit integer between 10000000 and 99999999
      const num = Math.floor(10000000 + Math.random() * 90000000);
      candidate = String(num);
      if (!existing.has(candidate)) {
        return candidate;
      }
      attempts++;
    }
    return String(Date.now()).slice(-8);
  }, [employees]);

  // Geolocation detection helper
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      showToast("Geolocation is not supported by your browser", "error");
      return;
    }
    showToast("Detecting GPS coordinates...", "info");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormLat(pos.coords.latitude.toFixed(6));
        setFormLng(pos.coords.longitude.toFixed(6));
        showToast("GPS coordinates detected successfully!", "success");
      },
      (err) => {
        console.warn("Geolocation error:", err);
        showToast("Could not retrieve GPS location: " + err.message, "error");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Image selection handler
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("Image size must be less than 5MB", "error");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // Upload file or base64 to ImageKit via `/api/upload`
  const uploadToImageKit = async (options: {
    file?: File;
    base64?: string;
    fileName?: string;
    folder?: string;
  }): Promise<string> => {
    const formData = new FormData();
    if (options.file) formData.append("file", options.file);
    if (options.base64) formData.append("base64", options.base64);
    if (options.fileName) formData.append("fileName", options.fileName);
    if (options.folder) formData.append("folder", options.folder);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Failed to upload image to ImageKit");
    }
    const data = await res.json();
    return data.url;
  };

  // Open Drawer in Create mode
  const handleOpenCreateDrawer = () => {
    setEditingEmployeeId(null);
    setFormName("");
    setFormPhone("");
    setFormEmail("");
    setFormCity("Chirala");
    setFormAddress("");
    setFormSalaryType("monthly");
    setFormSalaryAmount("");
    setFormAcceptedLeaves(2);
    setFormEmergencyName("");
    setFormEmergencyRelation("");
    setFormEmergencyPhone("");
    setFormLat("");
    setFormLng("");
    setFormStatus("Active");
    setImageFile(null);
    setImagePreview("");
    setIsDrawerOpen(true);
  };

  // Open Drawer in Edit mode
  const handleOpenEditDrawer = (emp: EmployeeItem) => {
    setEditingEmployeeId(emp.id);
    setFormName(emp.name);
    setFormPhone(emp.phone);
    setFormEmail(emp.email || "");
    setFormCity(emp.city || "");
    setFormAddress(emp.address || "");
    setFormSalaryType(emp.salaryType);
    setFormSalaryAmount(emp.salaryAmount);
    setFormAcceptedLeaves(emp.acceptedLeaves);
    setFormEmergencyName(emp.emergencyContact.name);
    setFormEmergencyRelation(emp.emergencyContact.relation);
    setFormEmergencyPhone(emp.emergencyContact.phone);
    setFormLat(emp.locationCoordinates?.latitude ? String(emp.locationCoordinates.latitude) : "");
    setFormLng(emp.locationCoordinates?.longitude ? String(emp.locationCoordinates.longitude) : "");
    setFormStatus(emp.status);
    setImageFile(null);
    setImagePreview(emp.profilePicUrl || "");
    setIsDrawerOpen(true);
  };

  // Save / Submit Employee Form
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      showToast("Employee Name is required", "error");
      return;
    }
    if (!formPhone.trim()) {
      showToast("Mobile Number is required", "error");
      return;
    }
    if (formSalaryAmount === "" || Number(formSalaryAmount) <= 0) {
      showToast("Please enter a valid salary amount", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Upload profile image to ImageKit if a new file is chosen
      let finalPicUrl = imagePreview || "";
      if (imageFile) {
        setIsUploadingImage(true);
        try {
          showToast("Uploading profile photo to ImageKit...", "info");
          finalPicUrl = await uploadToImageKit({
            file: imageFile,
            fileName: `emp-${Date.now()}-${imageFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`,
            folder: "/employees/profiles",
          });
        } catch (imgErr: any) {
          console.error("Profile photo upload warning:", imgErr);
          showToast("Photo upload warning: " + imgErr.message, "error");
        } finally {
          setIsUploadingImage(false);
        }
      }

      // 2. Determine or generate 8-digit Employee ID
      let finalEmpCode = "";
      let existingEmp: EmployeeItem | undefined;
      if (editingEmployeeId) {
        existingEmp = employees.find((e) => e.id === editingEmployeeId);
        finalEmpCode = existingEmp?.employeeId || generateUnique8DigitId();
      } else {
        finalEmpCode = generateUnique8DigitId();
      }

      // 3. Generate QR code & Upload to ImageKit
      let finalQrCodeUrl = existingEmp?.qrCodeUrl || "";

      // Generate the fresh QR code data URL for this employee ID
      let qrCodeDataUrl = "";
      try {
        qrCodeDataUrl = await QRCode.toDataURL(finalEmpCode, {
          width: 360,
          margin: 1,
          color: {
            dark: "#0f172a",
            light: "#ffffff",
          },
        });
      } catch (qrErr) {
        console.warn("QR code generation error:", qrErr);
      }

      // Upload QR code to ImageKit if new employee or if existing QR code is not yet on ImageKit
      const alreadyOnImageKit = finalQrCodeUrl && finalQrCodeUrl.includes("imagekit.io");
      if (qrCodeDataUrl && (!alreadyOnImageKit || !editingEmployeeId)) {
        try {
          showToast("Uploading QR code to ImageKit...", "info");
          finalQrCodeUrl = await uploadToImageKit({
            base64: qrCodeDataUrl,
            fileName: `emp-qr-${finalEmpCode}.png`,
            folder: "/employees/qrcodes",
          });
        } catch (qrUploadErr: any) {
          console.error("QR Code ImageKit upload error:", qrUploadErr);
          // Fallback to generated data URL if upload failed
          if (!finalQrCodeUrl) {
            finalQrCodeUrl = qrCodeDataUrl;
          }
        }
      }

      // 4. Coordinates
      let locationCoordinates: { latitude: number; longitude: number } | null = null;
      if (formLat && formLng && !isNaN(Number(formLat)) && !isNaN(Number(formLng))) {
        locationCoordinates = {
          latitude: Number(formLat),
          longitude: Number(formLng),
        };
      }

      const payload: any = {
        employeeId: finalEmpCode,
        name: formName.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim(),
        city: formCity.trim(),
        address: formAddress.trim(),
        profilePicUrl: finalPicUrl || "",
        salaryType: formSalaryType,
        salaryAmount: Number(formSalaryAmount),
        acceptedLeaves: formAcceptedLeaves === "" ? 0 : Number(formAcceptedLeaves),
        emergencyContact: {
          name: formEmergencyName.trim(),
          relation: formEmergencyRelation.trim(),
          phone: formEmergencyPhone.trim(),
        },
        locationCoordinates: locationCoordinates,
        qrCodeUrl: finalQrCodeUrl || qrCodeDataUrl,
        status: formStatus,
        updatedAt: serverTimestamp(),
      };

      if (editingEmployeeId) {
        // Update existing employee
        const docRef = doc(db, "employees", editingEmployeeId);
        await updateDoc(docRef, payload);
        showToast(`Employee "${formName}" updated successfully!`, "success");
      } else {
        // Create new employee
        const colRef = collection(db, "employees");
        await addDoc(colRef, {
          ...payload,
          createdAt: serverTimestamp(),
        });
        showToast(`Employee "${formName}" added with ID ${finalEmpCode}!`, "success");
      }

      setIsDrawerOpen(false);
    } catch (err: any) {
      console.error("Save employee error:", err);
      showToast("Error saving employee: " + (err.message || "Unknown error"), "error");
    } finally {
      setIsSubmitting(false);
      setIsUploadingImage(false);
    }
  };

  // Delete Employee Confirmation
  const handleConfirmDelete = async () => {
    if (!deletingEmployee) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "employees", deletingEmployee.id));
      showToast(`Employee "${deletingEmployee.name}" deleted`, "success");
      setDeletingEmployee(null);
    } catch (err: any) {
      showToast("Error deleting employee: " + err.message, "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50/50">
      {/* Top Header */}
      <div
        className="px-6 py-4 bg-white border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{ borderColor: "var(--color-border-subtle)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center border bg-slate-50 text-[#348bdd]"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            <UserCheck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-medium text-slate-900">Employees Directory</h1>
              <span className="px-2 py-0.5 text-[11px] rounded-full font-mono bg-sky-50 text-[#348bdd] border border-sky-100">
                {totalCount} Total
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Staff management, 8-digit unique QR badge generation, salary rates & emergency records
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenCreateDrawer}
            className="px-4 py-2 text-xs rounded-lg text-white font-medium cursor-pointer shadow-sm flex items-center gap-1.5 transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--color-brand-primary)" }}
          >
            <Plus size={15} />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 block">
            Total Staff
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xl font-medium text-slate-900 font-mono">{stats.total}</span>
            <Users size={16} className="text-[#348bdd]" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 block">
            Monthly Salaried
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xl font-medium text-slate-900 font-mono">{stats.monthlyCount}</span>
            <Calendar size={16} className="text-emerald-600" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 block">
            Daily Wage Staff
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xl font-medium text-slate-900 font-mono">{stats.dailyCount}</span>
            <DollarSign size={16} className="text-amber-600" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 block">
            Active Staff
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xl font-medium text-slate-900 font-mono">{stats.activeCount}</span>
            <CheckCircle2 size={16} className="text-sky-600" />
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="px-6 pb-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, ID, phone, city..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
            style={{ borderColor: "var(--color-border-base)" }}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Salary Type Filter */}
          <select
            value={salaryFilter}
            onChange={(e) => {
              setSalaryFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="text-xs px-2.5 py-1.5 rounded-lg border bg-white focus:outline-none cursor-pointer"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            <option value="all">All Salary Types</option>
            <option value="monthly">Monthly Salary</option>
            <option value="daily">Daily Wage</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="text-xs px-2.5 py-1.5 rounded-lg border bg-white focus:outline-none cursor-pointer"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            <option value="all">All Status</option>
            <option value="Active">Active Only</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Main Table / Directory List */}
      <div className="flex-1 px-6 pb-6">
        <div
          className="bg-white rounded-xl border overflow-hidden shadow-2xs"
          style={{ borderColor: "var(--color-border-subtle)" }}
        >
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 size={24} className="animate-spin text-[#348bdd]" />
              <span className="text-xs">Loading employees directory...</span>
            </div>
          ) : paginatedEmployees.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center px-4">
              <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-3">
                <Users size={20} />
              </div>
              <h3 className="text-sm font-medium text-slate-800">No employees found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                {searchQuery || salaryFilter !== "all" || statusFilter !== "all"
                  ? "Try clearing filters or search terms."
                  : "Get started by adding your first confectionery or kitchen staff member."}
              </p>
              <button
                onClick={handleOpenCreateDrawer}
                className="mt-4 px-3.5 py-1.5 text-xs rounded-lg text-white font-medium cursor-pointer"
                style={{ backgroundColor: "var(--color-brand-primary)" }}
              >
                + Add Employee
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b text-slate-600 font-medium border-slate-200/80">
                    <th className="py-3 px-4 w-12 text-center">Avatar</th>
                    <th className="py-3 px-4">Employee ID</th>
                    <th className="py-3 px-4">Name & Contact</th>
                    <th className="py-3 px-4">City / Location</th>
                    <th className="py-3 px-4">Salary Plan</th>
                    <th className="py-3 px-4">Accepted Leaves</th>
                    <th className="py-3 px-4">Emergency Contact</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Avatar */}
                      <td className="py-2.5 px-4 text-center">
                        {emp.profilePicUrl ? (
                          <img
                            src={emp.profilePicUrl}
                            alt={emp.name}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200 mx-auto shadow-2xs"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center font-medium mx-auto">
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </td>

                      {/* Employee ID & QR badge */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#348bdd] font-medium">
                          <span>{emp.employeeId}</span>
                          <button
                            onClick={() => setIdCardEmployee(emp)}
                            className="p-1 rounded hover:bg-sky-50 text-slate-400 hover:text-[#348bdd] cursor-pointer"
                            title="View / Print QR ID Card"
                          >
                            <QrCode size={13} />
                          </button>
                        </div>
                      </td>

                      {/* Name & Contact */}
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-900">{emp.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {emp.phone}
                        </div>
                      </td>

                      {/* City / Location */}
                      <td className="py-2.5 px-4 text-slate-600">
                        <div>{emp.city || "—"}</div>
                        {emp.locationCoordinates && (
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-0.5 mt-0.5">
                            <Navigation size={10} className="text-[#348bdd]" />
                            <span>
                              {emp.locationCoordinates.latitude.toFixed(2)}, {emp.locationCoordinates.longitude.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Salary Plan */}
                      <td className="py-2.5 px-4 font-mono">
                        <div className="font-medium text-slate-900">
                          ₹{emp.salaryAmount.toLocaleString("en-IN")}
                        </div>
                        <span className="text-[10px] text-slate-500 capitalize">
                          per {emp.salaryType === "monthly" ? "month" : "day"}
                        </span>
                      </td>

                      {/* Accepted Leaves */}
                      <td className="py-2.5 px-4 font-mono text-slate-700">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-slate-100 border border-slate-200">
                          {emp.acceptedLeaves} days / mo
                        </span>
                      </td>

                      {/* Emergency Contact */}
                      <td className="py-2.5 px-4 text-[11px] text-slate-600">
                        {emp.emergencyContact?.name ? (
                          <div>
                            <div className="font-medium text-slate-800">
                              {emp.emergencyContact.name}{" "}
                              <span className="text-slate-400 font-normal">
                                ({emp.emergencyContact.relation || "Contact"})
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {emp.emergencyContact.phone}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not set</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            emp.status === "Active"
                              ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }`}
                        >
                          {emp.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* QR / ID Card */}
                          <button
                            onClick={() => setIdCardEmployee(emp)}
                            className="w-7 h-7 rounded-md flex items-center justify-center transition-all bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100 cursor-pointer shadow-2xs"
                            title="Print Staff ID Card"
                          >
                            <QrCode size={13} />
                          </button>

                          {/* View details */}
                          <button
                            onClick={() => setViewingEmployee(emp)}
                            className="w-7 h-7 rounded-md flex items-center justify-center transition-all bg-sky-50 text-[#348bdd] hover:bg-sky-100 border border-sky-100 cursor-pointer shadow-2xs"
                            title="View Details"
                          >
                            <Eye size={13} />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => handleOpenEditDrawer(emp)}
                            className="w-7 h-7 rounded-md flex items-center justify-center transition-all bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-100 cursor-pointer shadow-2xs"
                            title="Edit Employee"
                          >
                            <Edit2 size={13} />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setDeletingEmployee(emp)}
                            className="w-7 h-7 rounded-md flex items-center justify-center transition-all bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 cursor-pointer shadow-2xs"
                            title="Delete Employee"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t bg-slate-50/50 flex items-center justify-between text-xs text-slate-500 border-slate-200/80">
              <span>
                Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
                {Math.min(currentPage * PAGE_SIZE, filteredEmployees.length)} of{" "}
                {filteredEmployees.length} employees
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded border bg-white disabled:opacity-40 cursor-pointer border-slate-200"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="font-mono px-2">
                  {currentPage} / {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 rounded border bg-white disabled:opacity-40 cursor-pointer border-slate-200"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          ADD / EDIT EMPLOYEE OFFCANVAS DRAWER
         ========================================================================= */}
      <OffcanvasDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingEmployeeId ? "Edit Staff Member" : "Add New Employee"}
        subtitle="Manage employee profile, salary rate, leave quota, emergency contact & GPS location"
      >
        <form onSubmit={handleSaveEmployee} className="space-y-4">
          {/* Profile Picture Upload Section */}
          <div className="p-4 rounded-xl border bg-slate-50/60 border-slate-200/80">
            <label className="block text-xs uppercase tracking-wider mb-2 font-medium text-slate-700">
              Employee Profile Picture
            </label>
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 rounded-full border-2 border-slate-200 bg-white overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User size={28} className="text-slate-300" />
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  id="profilePicInput"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <label
                  htmlFor="profilePicInput"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border bg-white text-slate-700 hover:bg-slate-50 cursor-pointer border-slate-200 shadow-2xs font-medium transition-colors"
                >
                  <Upload size={13} />
                  <span>{imagePreview ? "Change Photo" : "Upload Photo"}</span>
                </label>
                <p className="text-[10px] text-slate-400 mt-1">
                  Uploads automatically to ImageKit (JPG, PNG up to 5MB)
                </p>
              </div>
            </div>
          </div>

          {/* Full Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wider mb-1 font-medium text-slate-700">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Ramesh Babu"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                style={{ borderColor: "var(--color-border-base)" }}
                required
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider mb-1 font-medium text-slate-700">
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                placeholder="e.g. 98480 12345"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none font-mono focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                style={{ borderColor: "var(--color-border-base)" }}
                required
              />
            </div>
          </div>

          {/* Email & City */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wider mb-1 font-medium text-slate-700">
                Email Address
              </label>
              <input
                type="email"
                placeholder="e.g. ramesh@ravisweets.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none font-mono focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                style={{ borderColor: "var(--color-border-base)" }}
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider mb-1 font-medium text-slate-700">
                City / Town
              </label>
              <input
                type="text"
                placeholder="e.g. Chirala"
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                style={{ borderColor: "var(--color-border-base)" }}
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs uppercase tracking-wider mb-1 font-medium text-slate-700">
              Residential Address
            </label>
            <textarea
              rows={2}
              placeholder="Door No, Street Name, Landmark..."
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              className="w-full text-xs p-2.5 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)] resize-none"
              style={{ borderColor: "var(--color-border-base)" }}
            />
          </div>

          {/* Salary Plan & Amount */}
          <div className="p-3.5 rounded-xl border bg-slate-50/60 border-slate-200/80 space-y-3">
            <span className="text-xs uppercase tracking-wider font-medium text-slate-800 block">
              Salary Structure & Leaves
            </span>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormSalaryType("monthly")}
                className={`py-2 px-3 text-xs rounded-lg border font-medium cursor-pointer transition-colors ${
                  formSalaryType === "monthly"
                    ? "bg-[#348bdd] text-white border-[#348bdd] shadow-2xs"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Monthly Salary
              </button>
              <button
                type="button"
                onClick={() => setFormSalaryType("daily")}
                className={`py-2 px-3 text-xs rounded-lg border font-medium cursor-pointer transition-colors ${
                  formSalaryType === "daily"
                    ? "bg-[#348bdd] text-white border-[#348bdd] shadow-2xs"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Daily Wage
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider mb-1 font-medium text-slate-600">
                  {formSalaryType === "monthly" ? "Monthly Amount (₹)" : "Daily Wage (₹)"} <span className="text-red-500">*</span>
                </label>
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border bg-white focus-within:ring-1 focus-within:ring-[var(--color-brand-primary)]"
                  style={{ borderColor: "var(--color-border-base)" }}
                >
                  <span className="text-slate-400 font-mono text-xs">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 18000"
                    value={formSalaryAmount}
                    onChange={(e) =>
                      setFormSalaryAmount(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="w-full text-xs bg-transparent focus:outline-none font-mono font-medium"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider mb-1 font-medium text-slate-600">
                  Accepted Leaves / Month
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 2"
                  value={formAcceptedLeaves}
                  onChange={(e) =>
                    setFormAcceptedLeaves(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="w-full text-xs px-3 py-1.5 rounded-md border bg-white focus:outline-none font-mono font-medium focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                  style={{ borderColor: "var(--color-border-base)" }}
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500">
              Accepted leaves protect from salary deductions. Excess absences will be deducted as Loss of Pay.
            </p>
          </div>

          {/* Emergency Contact */}
          <div className="p-3.5 rounded-xl border bg-slate-50/60 border-slate-200/80 space-y-3">
            <span className="text-xs uppercase tracking-wider font-medium text-slate-800 block">
              Emergency Contact Information
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] uppercase tracking-wider mb-1 font-medium text-slate-600">
                  Contact Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lakshmi"
                  value={formEmergencyName}
                  onChange={(e) => setFormEmergencyName(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                  style={{ borderColor: "var(--color-border-base)" }}
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider mb-1 font-medium text-slate-600">
                  Relation
                </label>
                <input
                  type="text"
                  placeholder="e.g. Spouse / Brother"
                  value={formEmergencyRelation}
                  onChange={(e) => setFormEmergencyRelation(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                  style={{ borderColor: "var(--color-border-base)" }}
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider mb-1 font-medium text-slate-600">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 98480 54321"
                  value={formEmergencyPhone}
                  onChange={(e) => setFormEmergencyPhone(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-md border bg-white focus:outline-none font-mono focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                  style={{ borderColor: "var(--color-border-base)" }}
                />
              </div>
            </div>
          </div>

          {/* Location Coordinates */}
          <div className="p-3.5 rounded-xl border bg-slate-50/60 border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-medium text-slate-800">
                Location Coordinates (GPS)
              </span>
              <button
                type="button"
                onClick={handleDetectLocation}
                className="text-[11px] text-[#348bdd] hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <Navigation size={12} />
                <span>Detect My Location</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Latitude</label>
                <input
                  type="text"
                  placeholder="e.g. 15.824610"
                  value={formLat}
                  onChange={(e) => setFormLat(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-md border bg-white focus:outline-none font-mono"
                  style={{ borderColor: "var(--color-border-base)" }}
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Longitude</label>
                <input
                  type="text"
                  placeholder="e.g. 80.352110"
                  value={formLng}
                  onChange={(e) => setFormLng(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-md border bg-white focus:outline-none font-mono"
                  style={{ borderColor: "var(--color-border-base)" }}
                />
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs uppercase tracking-wider mb-1 font-medium text-slate-700">
              Employment Status
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="empStatus"
                  value="Active"
                  checked={formStatus === "Active"}
                  onChange={() => setFormStatus("Active")}
                  className="text-[#348bdd]"
                />
                <span>Active</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="empStatus"
                  value="Inactive"
                  checked={formStatus === "Inactive"}
                  onChange={() => setFormStatus("Inactive")}
                  className="text-[#348bdd]"
                />
                <span>Inactive</span>
              </label>
            </div>
          </div>

          {/* Submit Actions */}
          <div
            className="pt-4 border-t flex items-center justify-end gap-2.5 sticky bottom-0 bg-white"
            style={{ borderColor: "var(--color-border-subtle)" }}
          >
            <button
              type="button"
              disabled={isSubmitting || isUploadingImage}
              onClick={() => setIsDrawerOpen(false)}
              className="px-4 py-2 text-xs rounded-md border hover:bg-slate-50 transition-colors cursor-pointer"
              style={{
                borderColor: "var(--color-border-base)",
                color: "var(--color-text-secondary)",
                fontWeight: 500,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploadingImage}
              className="px-4 py-2 text-xs rounded-md text-white transition-opacity disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              style={{
                backgroundColor: "var(--color-brand-primary)",
                fontWeight: 500,
              }}
            >
              {(isSubmitting || isUploadingImage) && (
                <Loader2 size={13} className="animate-spin" />
              )}
              <span>
                {editingEmployeeId ? "Update Employee" : "Save & Generate QR"}
              </span>
            </button>
          </div>
        </form>
      </OffcanvasDrawer>

      {/* =========================================================================
          STAFF QR ID CARD MODAL
         ========================================================================= */}
      {idCardEmployee && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            {/* Card Header */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono tracking-wider uppercase text-sky-400 block">
                  Ravi Sweets Chirala
                </span>
                <h4 className="text-xs font-medium tracking-tight">Staff Identity Card</h4>
              </div>
              <button
                onClick={() => setIdCardEmployee(null)}
                className="p-1 rounded-full text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Printable ID Card Body */}
            <div id="staff-id-card-sheet" className="p-6 text-center space-y-4 bg-white">
              <div className="relative mx-auto w-24 h-24 rounded-full border-4 border-slate-100 overflow-hidden shadow-sm bg-slate-50 flex items-center justify-center">
                {idCardEmployee.profilePicUrl ? (
                  <img
                    src={idCardEmployee.profilePicUrl}
                    alt={idCardEmployee.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User size={40} className="text-slate-300" />
                )}
              </div>

              <div>
                <h3 className="text-base font-medium text-slate-900">{idCardEmployee.name}</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  ID: <span className="text-[#348bdd] font-medium">{idCardEmployee.employeeId}</span>
                </p>
                <p className="text-[11px] text-slate-400 capitalize mt-0.5">
                  {idCardEmployee.salaryType} Staff • {idCardEmployee.city || "Chirala"}
                </p>
              </div>

              {/* Scannable QR Code */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 inline-block mx-auto">
                {idCardEmployee.qrCodeUrl ? (
                  <img
                    src={idCardEmployee.qrCodeUrl}
                    alt={`QR Code for ${idCardEmployee.employeeId}`}
                    className="w-40 h-40 object-contain mx-auto"
                  />
                ) : (
                  <div className="w-40 h-40 flex items-center justify-center text-slate-400 text-xs">
                    No QR code
                  </div>
                )}
                <span className="text-[10px] font-mono text-slate-500 mt-1 block">
                  Scan for Attendance & Verification
                </span>
              </div>

              {/* Emergency Info on Card */}
              {idCardEmployee.emergencyContact?.phone && (
                <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-100">
                  <span>Emergency: </span>
                  <span className="font-mono text-slate-800 font-medium">
                    {idCardEmployee.emergencyContact.phone}
                  </span>{" "}
                  ({idCardEmployee.emergencyContact.name})
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-1.5 text-xs rounded-lg text-white font-medium cursor-pointer shadow-xs flex items-center gap-1.5"
                style={{ backgroundColor: "var(--color-brand-primary)" }}
              >
                <Printer size={13} />
                <span>Print ID Card</span>
              </button>
              <button
                type="button"
                onClick={() => setIdCardEmployee(null)}
                className="px-3.5 py-1.5 text-xs rounded-lg border bg-white text-slate-700 hover:bg-slate-50 font-medium cursor-pointer border-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW EMPLOYEE DETAILS MODAL
         ========================================================================= */}
      {viewingEmployee && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 border-b flex items-center justify-between border-slate-200">
              <div className="flex items-center gap-2">
                <User size={16} className="text-[#348bdd]" />
                <h3 className="text-xs font-medium text-slate-900">Employee Profile Details</h3>
              </div>
              <button
                onClick={() => setViewingEmployee(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs overflow-y-auto max-h-[70vh]">
              <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                <div className="w-16 h-16 rounded-full overflow-hidden border border-slate-200 shrink-0 bg-slate-50 flex items-center justify-center">
                  {viewingEmployee.profilePicUrl ? (
                    <img
                      src={viewingEmployee.profilePicUrl}
                      alt={viewingEmployee.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User size={30} className="text-slate-300" />
                  )}
                </div>
                <div>
                  <h4 className="text-base font-medium text-slate-900">{viewingEmployee.name}</h4>
                  <div className="font-mono text-xs text-[#348bdd]">
                    ID: {viewingEmployee.employeeId}
                  </div>
                  <div className="text-slate-500 mt-0.5">{viewingEmployee.phone}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
                  <span className="text-[10px] text-slate-400 uppercase font-medium">Salary Plan</span>
                  <div className="font-mono font-medium text-slate-900 text-sm mt-0.5">
                    ₹{viewingEmployee.salaryAmount.toLocaleString("en-IN")}{" "}
                    <span className="text-xs font-normal text-slate-500">
                      / {viewingEmployee.salaryType}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
                  <span className="text-[10px] text-slate-400 uppercase font-medium">Accepted Leaves</span>
                  <div className="font-mono font-medium text-slate-900 text-sm mt-0.5">
                    {viewingEmployee.acceptedLeaves} days / month
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Email:</span>
                  <span className="font-mono text-slate-800">{viewingEmployee.email || "—"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">City / Location:</span>
                  <span className="text-slate-800">{viewingEmployee.city || "—"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Address:</span>
                  <span className="text-slate-800 max-w-xs text-right">{viewingEmployee.address || "—"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Emergency Contact:</span>
                  <span className="text-slate-800 font-mono">
                    {viewingEmployee.emergencyContact?.name
                      ? `${viewingEmployee.emergencyContact.name} (${viewingEmployee.emergencyContact.relation || "Contact"}) - ${viewingEmployee.emergencyContact.phone}`
                      : "—"}
                  </span>
                </div>
                {viewingEmployee.locationCoordinates && (
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">GPS Coordinates:</span>
                    <span className="font-mono text-slate-800">
                      {viewingEmployee.locationCoordinates.latitude}, {viewingEmployee.locationCoordinates.longitude}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const emp = viewingEmployee;
                  setViewingEmployee(null);
                  setIdCardEmployee(emp);
                }}
                className="px-3.5 py-1.5 text-xs rounded-lg border bg-indigo-50 text-indigo-700 border-indigo-200 font-medium cursor-pointer"
              >
                View Staff ID Card
              </button>
              <button
                type="button"
                onClick={() => setViewingEmployee(null)}
                className="px-4 py-1.5 text-xs rounded-lg border bg-white text-slate-700 font-medium cursor-pointer border-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DELETE CONFIRMATION MODAL
         ========================================================================= */}
      <ConfirmationModal
        isOpen={!!deletingEmployee}
        title="Delete Employee Record"
        message={`Are you sure you want to delete "${deletingEmployee?.name}" (ID: ${deletingEmployee?.employeeId})? This action cannot be undone.`}
        confirmText="Confirm Delete"
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingEmployee(null)}
      />
    </div>
  );
}
