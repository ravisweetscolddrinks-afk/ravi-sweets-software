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
import * as XLSX from "xlsx";
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
  ChevronDown,
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
  Briefcase,
  FileSpreadsheet,
  Download,
  FileUp,
  FileText
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

export interface ParsedEmployeeRow {
  name: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  salaryType: "monthly" | "daily";
  salaryAmount: number;
  acceptedLeaves: number;
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
  latitude: number | null;
  longitude: number | null;
  status: "Active" | "Inactive";
  isValid: boolean;
  validationError?: string;
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

  // Bulk Upload State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState<boolean>(false);
  const [parsedEmployees, setParsedEmployees] = useState<ParsedEmployeeRow[]>([]);
  const [isBulkUploading, setIsBulkUploading] = useState<boolean>(false);
  const [bulkProgress, setBulkProgress] = useState<{
    current: number;
    total: number;
    currentName: string;
  }>({ current: 0, total: 0, currentName: "" });
  const [bulkFileName, setBulkFileName] = useState<string>("");

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

  // Download Sample Excel Template with Dummy Data (50 complete employee records)
  const handleDownloadSampleExcel = () => {
    try {
      const sampleData = [
        {
          "Name*": "Ramesh Babu",
          "Mobile Number*": "9848011221",
          "Email": "ramesh.babu@ravisweets.com",
          "City": "Chirala",
          "Address": "Main Road, Near Clock Tower",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 18000,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Lakshmi",
          "Emergency Contact Relation": "Spouse",
          "Emergency Contact Mobile": "9848055441",
          "Latitude": 15.82461,
          "Longitude": 80.35211,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Suresh Kumar",
          "Mobile Number*": "9848011222",
          "Email": "suresh.kumar@ravisweets.com",
          "City": "Chirala",
          "Address": "Bapatla Road, Opp Bus Stand",
          "Salary Type (monthly/daily)*": "daily",
          "Salary Amount*": 650,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Venkat",
          "Emergency Contact Relation": "Brother",
          "Emergency Contact Mobile": "9848055442",
          "Latitude": 15.826,
          "Longitude": 80.353,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Kavitha Rao",
          "Mobile Number*": "9848011223",
          "Email": "kavitha.rao@ravisweets.com",
          "City": "Chirala",
          "Address": "Perala Bazar, 2nd Lane",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 16500,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Narayana",
          "Emergency Contact Relation": "Father",
          "Emergency Contact Mobile": "9848055443",
          "Latitude": 15.821,
          "Longitude": 80.351,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Venkateswara Rao",
          "Mobile Number*": "9848011224",
          "Email": "venkatesh.rao@ravisweets.com",
          "City": "Vetapalem",
          "Address": "Gandhi Road, Beside Post Office",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 22000,
          "Accepted Leaves": 3,
          "Emergency Contact Name": "Padmavati",
          "Emergency Contact Relation": "Spouse",
          "Emergency Contact Mobile": "9848055444",
          "Latitude": 15.783,
          "Longitude": 80.316,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Naga Raju",
          "Mobile Number*": "9848011225",
          "Email": "naga.raju@ravisweets.com",
          "City": "Chirala",
          "Address": "Railway Feeder Road",
          "Salary Type (monthly/daily)*": "daily",
          "Salary Amount*": 700,
          "Accepted Leaves": 1,
          "Emergency Contact Name": "Durga",
          "Emergency Contact Relation": "Spouse",
          "Emergency Contact Mobile": "9848055445",
          "Latitude": 15.8285,
          "Longitude": 80.3542,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Anusha Reddy",
          "Mobile Number*": "9848011226",
          "Email": "anusha.reddy@ravisweets.com",
          "City": "Bapatla",
          "Address": "GBC Road, Near RTC Complex",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 19500,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Srinivas Reddy",
          "Emergency Contact Relation": "Father",
          "Emergency Contact Mobile": "9848055446",
          "Latitude": 15.9042,
          "Longitude": 80.4678,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Siva Krishna",
          "Mobile Number*": "9848011227",
          "Email": "siva.krishna@ravisweets.com",
          "City": "Chirala",
          "Address": "Lawyerpet 3rd Cross",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 24000,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Sailaja",
          "Emergency Contact Relation": "Spouse",
          "Emergency Contact Mobile": "9848055447",
          "Latitude": 15.8231,
          "Longitude": 80.3498,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Prasad Varma",
          "Mobile Number*": "9848011228",
          "Email": "prasad.varma@ravisweets.com",
          "City": "Chirala",
          "Address": "Vadarevu Road Junction",
          "Salary Type (monthly/daily)*": "daily",
          "Salary Amount*": 600,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Subba Rao",
          "Emergency Contact Relation": "Father",
          "Emergency Contact Mobile": "9848055448",
          "Latitude": 15.8192,
          "Longitude": 80.3584,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Lakshmi Narayana",
          "Mobile Number*": "9848011229",
          "Email": "lakshmi.narayana@ravisweets.com",
          "City": "Karamchedu",
          "Address": "Market Street, Ward 4",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 21000,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Saraswathi",
          "Emergency Contact Relation": "Spouse",
          "Emergency Contact Mobile": "9848055449",
          "Latitude": 15.892,
          "Longitude": 80.264,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Sandhya Rani",
          "Mobile Number*": "9848011230",
          "Email": "sandhya.rani@ravisweets.com",
          "City": "Chirala",
          "Address": "Ramnagar Colony",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 17000,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Mohan Rao",
          "Emergency Contact Relation": "Brother",
          "Emergency Contact Mobile": "9848055450",
          "Latitude": 15.8271,
          "Longitude": 80.3482,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Satyanarayana",
          "Mobile Number*": "9848011231",
          "Email": "satyanarayana@ravisweets.com",
          "City": "Vetapalem",
          "Address": "Pandillapalli Road",
          "Salary Type (monthly/daily)*": "daily",
          "Salary Amount*": 750,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Parvathi",
          "Emergency Contact Relation": "Spouse",
          "Emergency Contact Mobile": "9848055451",
          "Latitude": 15.779,
          "Longitude": 80.312,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Ravi Teja",
          "Mobile Number*": "9848011232",
          "Email": "ravi.teja@ravisweets.com",
          "City": "Chirala",
          "Address": "Kothapet High School Road",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 25000,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Bhavani",
          "Emergency Contact Relation": "Mother",
          "Emergency Contact Mobile": "9848055452",
          "Latitude": 15.831,
          "Longitude": 80.355,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Madhuri Devi",
          "Mobile Number*": "9848011233",
          "Email": "madhuri.devi@ravisweets.com",
          "City": "Chirala",
          "Address": "Gandhi Nagar, 1st Line",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 16000,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Koteswara Rao",
          "Emergency Contact Relation": "Spouse",
          "Emergency Contact Mobile": "9848055453",
          "Latitude": 15.8224,
          "Longitude": 80.3529,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Gopi Chand",
          "Mobile Number*": "9848011234",
          "Email": "gopi.chand@ravisweets.com",
          "City": "Bapatla",
          "Address": "Car Shed Road",
          "Salary Type (monthly/daily)*": "daily",
          "Salary Amount*": 650,
          "Accepted Leaves": 1,
          "Emergency Contact Name": "Ramaiah",
          "Emergency Contact Relation": "Father",
          "Emergency Contact Mobile": "9848055454",
          "Latitude": 15.908,
          "Longitude": 80.462,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Swathi Priya",
          "Mobile Number*": "9848011235",
          "Email": "swathi.priya@ravisweets.com",
          "City": "Chirala",
          "Address": "Santhapet Vegetable Market",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 18500,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Rajesh",
          "Emergency Contact Relation": "Spouse",
          "Emergency Contact Mobile": "9848055455",
          "Latitude": 15.8249,
          "Longitude": 80.3501,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Krishna Murthy",
          "Mobile Number*": "9848011236",
          "Email": "krishna.murthy@ravisweets.com",
          "City": "Chirala",
          "Address": "Ipurupalem Centre",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 20000,
          "Accepted Leaves": 3,
          "Emergency Contact Name": "Uma",
          "Emergency Contact Relation": "Spouse",
          "Emergency Contact Mobile": "9848055456",
          "Latitude": 15.839,
          "Longitude": 80.362,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Balakrishna",
          "Mobile Number*": "9848011237",
          "Email": "balakrishna@ravisweets.com",
          "City": "Vetapalem",
          "Address": "Station Road, Beside SBI",
          "Salary Type (monthly/daily)*": "daily",
          "Salary Amount*": 700,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Ramanamma",
          "Emergency Contact Relation": "Mother",
          "Emergency Contact Mobile": "9848055457",
          "Latitude": 15.7812,
          "Longitude": 80.318,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Divya Bharathi",
          "Mobile Number*": "9848011238",
          "Email": "divya.bharathi@ravisweets.com",
          "City": "Chirala",
          "Address": "Perala Handloom Colony",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 17500,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Chandrasekhar",
          "Emergency Contact Relation": "Brother",
          "Emergency Contact Mobile": "9848055458",
          "Latitude": 15.818,
          "Longitude": 80.347,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Mallikarjuna Rao",
          "Mobile Number*": "9848011239",
          "Email": "malli.rao@ravisweets.com",
          "City": "Chirala",
          "Address": "Trunk Road, Opp City Centre",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 26000,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Sirisha",
          "Emergency Contact Relation": "Spouse",
          "Emergency Contact Mobile": "9848055459",
          "Latitude": 15.8258,
          "Longitude": 80.3512,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Jagadeesh Babu",
          "Mobile Number*": "9848011240",
          "Email": "jagadeesh.babu@ravisweets.com",
          "City": "Chirala",
          "Address": "Vankayala Thota",
          "Salary Type (monthly/daily)*": "daily",
          "Salary Amount*": 620,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Govindamma",
          "Emergency Contact Relation": "Mother",
          "Emergency Contact Mobile": "9848055460",
          "Latitude": 15.829,
          "Longitude": 80.357,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Haritha Kumari",
          "Mobile Number*": "9848011241",
          "Email": "haritha.kumari@ravisweets.com",
          "City": "Chirala",
          "Address": "Municipal Colony",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 16500,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Prasad",
          "Emergency Contact Relation": "Spouse",
          "Emergency Contact Mobile": "9848055461",
          "Latitude": 15.8215,
          "Longitude": 80.354,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Chaitanya Varma",
          "Mobile Number*": "9848011242",
          "Email": "chaitanya.varma@ravisweets.com",
          "City": "Bapatla",
          "Address": "College Road, Near Baptist Church",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 23000,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Anuradha",
          "Emergency Contact Relation": "Mother",
          "Emergency Contact Mobile": "9848055462",
          "Latitude": 15.901,
          "Longitude": 80.471,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Subrahmanyam",
          "Mobile Number*": "9848011243",
          "Email": "subrahmanyam@ravisweets.com",
          "City": "Chirala",
          "Address": "Brahmin Street, Agraharam",
          "Salary Type (monthly/daily)*": "daily",
          "Salary Amount*": 800,
          "Accepted Leaves": 1,
          "Emergency Contact Name": "Sarada",
          "Emergency Contact Relation": "Spouse",
          "Emergency Contact Mobile": "9848055463",
          "Latitude": 15.824,
          "Longitude": 80.349,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Geetha Madhuri",
          "Mobile Number*": "9848011244",
          "Email": "geetha.madhuri@ravisweets.com",
          "City": "Chirala",
          "Address": "Weavers Colony, Perala",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 17000,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Veeraiah",
          "Emergency Contact Relation": "Father",
          "Emergency Contact Mobile": "9848055464",
          "Latitude": 15.8175,
          "Longitude": 80.346,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Srinivasa Rao",
          "Mobile Number*": "9848011245",
          "Email": "srinivasa.rao@ravisweets.com",
          "City": "Chirala",
          "Address": "Old Guntur Road",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 27000,
          "Accepted Leaves": 3,
          "Emergency Contact Name": "Radhika",
          "Emergency Contact Relation": "Spouse",
          "Emergency Contact Mobile": "9848055465",
          "Latitude": 15.834,
          "Longitude": 80.358,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Rajesh Khanna",
          "Mobile Number*": "9848011246",
          "Email": "rajesh.khanna@ravisweets.com",
          "City": "Chirala",
          "Address": "Fisherman Colony, Vodarevu",
          "Salary Type (monthly/daily)*": "daily",
          "Salary Amount*": 650,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Mary",
          "Emergency Contact Relation": "Spouse",
          "Emergency Contact Mobile": "9848055466",
          "Latitude": 15.798,
          "Longitude": 80.375,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Sravani Devi",
          "Mobile Number*": "9848011247",
          "Email": "sravani.devi@ravisweets.com",
          "City": "Chirala",
          "Address": "Nehru Nagar, Near Park",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 18000,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Sudhakar",
          "Emergency Contact Relation": "Brother",
          "Emergency Contact Mobile": "9848055467",
          "Latitude": 15.8265,
          "Longitude": 80.3495,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Tirumala Rao",
          "Mobile Number*": "9848011248",
          "Email": "tirumala.rao@ravisweets.com",
          "City": "Karamchedu",
          "Address": "Daggubati Street",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 20500,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Lalitha",
          "Emergency Contact Relation": "Spouse",
          "Emergency Contact Mobile": "9848055468",
          "Latitude": 15.894,
          "Longitude": 80.261,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Kishore Babu",
          "Mobile Number*": "9848011249",
          "Email": "kishore.babu@ravisweets.com",
          "City": "Chirala",
          "Address": "Chirala Railway Colony",
          "Salary Type (monthly/daily)*": "daily",
          "Salary Amount*": 680,
          "Accepted Leaves": 1,
          "Emergency Contact Name": "Appa Rao",
          "Emergency Contact Relation": "Father",
          "Emergency Contact Mobile": "9848055469",
          "Latitude": 15.8278,
          "Longitude": 80.3548,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Bhanu Prakash",
          "Mobile Number*": "9848011250",
          "Email": "bhanu.prakash@ravisweets.com",
          "City": "Bapatla",
          "Address": "Old Bus Stand Area",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 22500,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Gayathri",
          "Emergency Contact Relation": "Spouse",
          "Emergency Contact Mobile": "9848055470",
          "Latitude": 15.906,
          "Longitude": 80.465,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Prasanna Lakshmi",
          "Mobile Number*": "9848011251",
          "Email": "prasanna.lakshmi@ravisweets.com",
          "City": "Chirala",
          "Address": "Tilak Road, Beside Hero Showroom",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 19000,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Sridhar",
          "Emergency Contact Relation": "Spouse",
          "Emergency Contact Mobile": "9848055471",
          "Latitude": 15.8252,
          "Longitude": 80.3518,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Pavan Kalyan",
          "Mobile Number*": "9848011252",
          "Email": "pavan.kalyan@ravisweets.com",
          "City": "Chirala",
          "Address": "Subhash Nagar",
          "Salary Type (monthly/daily)*": "daily",
          "Salary Amount*": 700,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Venkatesh",
          "Emergency Contact Relation": "Brother",
          "Emergency Contact Mobile": "9848055472",
          "Latitude": 15.8235,
          "Longitude": 80.356,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Renuka Devi",
          "Mobile Number*": "9848011253",
          "Email": "renuka.devi@ravisweets.com",
          "City": "Vetapalem",
          "Address": "Bazar Centre, Vetapalem",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 16000,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Nageswara Rao",
          "Emergency Contact Relation": "Father",
          "Emergency Contact Mobile": "9848055473",
          "Latitude": 15.7825,
          "Longitude": 80.315,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Ashok Vardhan",
          "Mobile Number*": "9848011254",
          "Email": "ashok.vardhan@ravisweets.com",
          "City": "Chirala",
          "Address": "Clock Tower Bazar Lane",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 24500,
          "Accepted Leaves": 3,
          "Emergency Contact Name": "Sandhya",
          "Emergency Contact Relation": "Spouse",
          "Emergency Contact Mobile": "9848055474",
          "Latitude": 15.8247,
          "Longitude": 80.3522,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Ramakrishna",
          "Mobile Number*": "9848011255",
          "Email": "ramakrishna@ravisweets.com",
          "City": "Chirala",
          "Address": "NTR Statue Junction",
          "Salary Type (monthly/daily)*": "daily",
          "Salary Amount*": 660,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Janaki",
          "Emergency Contact Relation": "Spouse",
          "Emergency Contact Mobile": "9848055475",
          "Latitude": 15.825,
          "Longitude": 80.3535,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Meenakshi Sundaram",
          "Mobile Number*": "9848011256",
          "Email": "meenakshi@ravisweets.com",
          "City": "Chirala",
          "Address": "Shirdi Sai Baba Temple Road",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 21500,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Natarajan",
          "Emergency Contact Relation": "Father",
          "Emergency Contact Mobile": "9848055476",
          "Latitude": 15.8268,
          "Longitude": 80.3508,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Naresh Kumar",
          "Mobile Number*": "9848011257",
          "Email": "naresh.kumar@ravisweets.com",
          "City": "Bapatla",
          "Address": "Surla Bazar",
          "Salary Type (monthly/daily)*": "daily",
          "Salary Amount*": 720,
          "Accepted Leaves": 1,
          "Emergency Contact Name": "Padmaja",
          "Emergency Contact Relation": "Spouse",
          "Emergency Contact Mobile": "9848055477",
          "Latitude": 15.903,
          "Longitude": 80.469,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Sailaja Rani",
          "Mobile Number*": "9848011258",
          "Email": "sailaja.rani@ravisweets.com",
          "City": "Chirala",
          "Address": "Teachers Colony",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 17500,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Sivaji",
          "Emergency Contact Relation": "Brother",
          "Emergency Contact Mobile": "9848055478",
          "Latitude": 15.8282,
          "Longitude": 80.3475,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Upendra Varma",
          "Mobile Number*": "9848011259",
          "Email": "upendra.varma@ravisweets.com",
          "City": "Chirala",
          "Address": "Chirala Autonagar",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 28000,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Suseela",
          "Emergency Contact Relation": "Spouse",
          "Emergency Contact Mobile": "9848055479",
          "Latitude": 15.836,
          "Longitude": 80.36,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Manikanta",
          "Mobile Number*": "9848011260",
          "Email": "manikanta@ravisweets.com",
          "City": "Chirala",
          "Address": "Kothapet, Lane 5",
          "Salary Type (monthly/daily)*": "daily",
          "Salary Amount*": 640,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Shankar",
          "Emergency Contact Relation": "Father",
          "Emergency Contact Mobile": "9848055480",
          "Latitude": 15.8305,
          "Longitude": 80.354,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Sunitha Bai",
          "Mobile Number*": "9848011261",
          "Email": "sunitha.bai@ravisweets.com",
          "City": "Vetapalem",
          "Address": "Rallapalli Street",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 18000,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Prakash",
          "Emergency Contact Relation": "Spouse",
          "Emergency Contact Mobile": "9848055481",
          "Latitude": 15.78,
          "Longitude": 80.317,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Veeranjaneyulu",
          "Mobile Number*": "9848011262",
          "Email": "veeranjaneyulu@ravisweets.com",
          "City": "Chirala",
          "Address": "Ramachandrapuram",
          "Salary Type (monthly/daily)*": "daily",
          "Salary Amount*": 750,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Anjamma",
          "Emergency Contact Relation": "Mother",
          "Emergency Contact Mobile": "9848055482",
          "Latitude": 15.822,
          "Longitude": 80.345,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Lavanya Kumari",
          "Mobile Number*": "9848011263",
          "Email": "lavanya.kumari@ravisweets.com",
          "City": "Chirala",
          "Address": "Church Road, Opp St. Ann's",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 19000,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Kishore",
          "Emergency Contact Relation": "Brother",
          "Emergency Contact Mobile": "9848055483",
          "Latitude": 15.8262,
          "Longitude": 80.3525,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Chandrasekhar",
          "Mobile Number*": "9848011264",
          "Email": "chandrasekhar@ravisweets.com",
          "City": "Bapatla",
          "Address": "Station Road, Bapatla",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 23500,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Hema",
          "Emergency Contact Relation": "Spouse",
          "Emergency Contact Mobile": "9848055484",
          "Latitude": 15.905,
          "Longitude": 80.464,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Durga Prasad",
          "Mobile Number*": "9848011265",
          "Email": "durga.prasad@ravisweets.com",
          "City": "Chirala",
          "Address": "Vadarevu Beach Road",
          "Salary Type (monthly/daily)*": "daily",
          "Salary Amount*": 600,
          "Accepted Leaves": 1,
          "Emergency Contact Name": "Kannaiah",
          "Emergency Contact Relation": "Father",
          "Emergency Contact Mobile": "9848055485",
          "Latitude": 15.805,
          "Longitude": 80.37,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Vani Sree",
          "Mobile Number*": "9848011266",
          "Email": "vani.sree@ravisweets.com",
          "City": "Chirala",
          "Address": "Guptha Market Street",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 17000,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Madhav",
          "Emergency Contact Relation": "Spouse",
          "Emergency Contact Mobile": "9848055486",
          "Latitude": 15.8242,
          "Longitude": 80.3515,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Koteswara Rao",
          "Mobile Number*": "9848011267",
          "Email": "koteswara.rao@ravisweets.com",
          "City": "Karamchedu",
          "Address": "Gram Panchayat Road",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 25000,
          "Accepted Leaves": 3,
          "Emergency Contact Name": "Kamala",
          "Emergency Contact Relation": "Spouse",
          "Emergency Contact Mobile": "9848055487",
          "Latitude": 15.891,
          "Longitude": 80.265,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Rohith Varma",
          "Mobile Number*": "9848011268",
          "Email": "rohith.varma@ravisweets.com",
          "City": "Chirala",
          "Address": "Perala High School Road",
          "Salary Type (monthly/daily)*": "daily",
          "Salary Amount*": 700,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Jagannath",
          "Emergency Contact Relation": "Father",
          "Emergency Contact Mobile": "9848055488",
          "Latitude": 15.819,
          "Longitude": 80.348,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Yamini Devi",
          "Mobile Number*": "9848011269",
          "Email": "yamini.devi@ravisweets.com",
          "City": "Chirala",
          "Address": "RTC Colony, Chirala",
          "Salary Type (monthly/daily)*": "monthly",
          "Salary Amount*": 18500,
          "Accepted Leaves": 2,
          "Emergency Contact Name": "Balaji",
          "Emergency Contact Relation": "Brother",
          "Emergency Contact Mobile": "9848055489",
          "Latitude": 15.8275,
          "Longitude": 80.3555,
          "Status (Active/Inactive)": "Active",
        },
        {
          "Name*": "Hemanth Kumar",
          "Mobile Number*": "9848011270",
          "Email": "hemanth.kumar@ravisweets.com",
          "City": "Chirala",
          "Address": "Railway Goods Shed Road",
          "Salary Type (monthly/daily)*": "daily",
          "Salary Amount*": 680,
          "Accepted Leaves": 1,
          "Emergency Contact Name": "Sowmya",
          "Emergency Contact Relation": "Spouse",
          "Emergency Contact Mobile": "9848055490",
          "Latitude": 15.8292,
          "Longitude": 80.3538,
          "Status (Active/Inactive)": "Active",
        },
      ];

      const worksheet = XLSX.utils.json_to_sheet(sampleData);
      worksheet["!cols"] = [
        { wch: 18 },
        { wch: 16 },
        { wch: 24 },
        { wch: 12 },
        { wch: 28 },
        { wch: 28 },
        { wch: 16 },
        { wch: 16 },
        { wch: 22 },
        { wch: 24 },
        { wch: 24 },
        { wch: 12 },
        { wch: 12 },
        { wch: 22 },
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Employees Template");
      XLSX.writeFile(workbook, "Ravi_Sweets_Employees_Template.xlsx");
      showToast("Downloaded sample Excel template with dummy data!", "success");
    } catch (err: any) {
      console.error("Error creating template:", err);
      showToast("Could not generate Excel template: " + err.message, "error");
    }
  };

  // Handle Excel/CSV file selection and parsing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawRows: any[] = XLSX.utils.sheet_to_json(ws);

        if (!rawRows || rawRows.length === 0) {
          showToast("The uploaded Excel file has no records", "error");
          setParsedEmployees([]);
          return;
        }

        const parsed: ParsedEmployeeRow[] = rawRows.map((row) => {
          const getVal = (patterns: string[], exclude: string[] = []) => {
            // Priority 1: Exact match on sanitized key
            for (const key of Object.keys(row)) {
              const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
              if (exclude.some((ex) => cleanKey.includes(ex))) continue;
              for (const p of patterns) {
                if (cleanKey === p) return String(row[key] ?? "").trim();
              }
            }
            // Priority 2: Substring match where cleanKey contains pattern
            for (const key of Object.keys(row)) {
              const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
              if (exclude.some((ex) => cleanKey.includes(ex))) continue;
              for (const p of patterns) {
                if (cleanKey.includes(p)) return String(row[key] ?? "").trim();
              }
            }
            return "";
          };

          const name = getVal(
            ["name", "fullname", "staffname", "employeename"],
            ["emergency", "kin", "guardian", "relative", "spouse", "father"]
          );

          let phone = getVal(
            ["mobilenumber", "mobile", "phonenumber", "phone", "contactnumber", "contact", "cell"],
            ["emergency", "kin", "guardian", "relative"]
          );
          const cleanPhoneDigits = phone.replace(/[^0-9]/g, "");
          if (cleanPhoneDigits.length === 12 && cleanPhoneDigits.startsWith("91")) {
            phone = cleanPhoneDigits.slice(2);
          } else if (cleanPhoneDigits.length >= 10) {
            phone = cleanPhoneDigits.slice(-10);
          } else if (cleanPhoneDigits.length > 0) {
            phone = cleanPhoneDigits;
          }

          const email = getVal(["email", "emailid", "mail"], ["emergency"]);
          const city = getVal(["city", "town", "village", "district"]) || "Chirala";
          const address = getVal(["address", "street", "loc", "locationaddress"]);

          const rawSalaryType = getVal(
            ["salarytype", "paytype", "paymenttype", "wageperiod", "frequency"],
            ["amount", "wage", "rate", "sum"]
          );
          const salaryType: "monthly" | "daily" =
            rawSalaryType.toLowerCase().includes("day") ||
            rawSalaryType.toLowerCase().includes("daily")
              ? "daily"
              : "monthly";

          // Salary Amount - exclude 'type', 'mode', 'period' so it never matches 'Salary Type'
          const rawSalary = getVal(
            ["salaryamount", "amount", "salary", "wage", "rate", "payamount"],
            ["type", "mode", "frequency", "period"]
          );
          const cleanSalaryStr = rawSalary.replace(/[^0-9.]/g, "");
          const salaryAmount = cleanSalaryStr ? Number(cleanSalaryStr) || 0 : 0;

          const rawLeaves = getVal(["acceptedleaves", "leave", "leaves", "allowedleaves"]);
          const cleanLeavesStr = rawLeaves.replace(/[^0-9]/g, "");
          const acceptedLeaves = cleanLeavesStr !== "" ? Number(cleanLeavesStr) || 0 : 2;

          const emergencyContactName = getVal(
            ["emergencycontactname", "emergencyname", "kinname", "emergencycontact"],
            ["relation", "phone", "mobile", "cell", "number"]
          );
          const emergencyContactRelation = getVal([
            "emergencycontactrelation",
            "emergencyrelation",
            "relation",
            "kinrelation",
          ]);
          let emergencyContactPhone = getVal([
            "emergencycontactmobile",
            "emergencycontactphone",
            "emergencymobile",
            "emergencyphone",
            "kinmobile",
            "kinphone",
          ]);
          const cleanEmerPhone = emergencyContactPhone.replace(/[^0-9]/g, "");
          if (cleanEmerPhone.length === 12 && cleanEmerPhone.startsWith("91")) {
            emergencyContactPhone = cleanEmerPhone.slice(2);
          } else if (cleanEmerPhone.length >= 10) {
            emergencyContactPhone = cleanEmerPhone.slice(-10);
          } else if (cleanEmerPhone.length > 0) {
            emergencyContactPhone = cleanEmerPhone;
          }

          const rawLat = getVal(["latitude", "lat"]);
          const rawLng = getVal(["longitude", "lng", "lon"]);
          const latitude = rawLat && !isNaN(Number(rawLat)) ? Number(rawLat) : null;
          const longitude = rawLng && !isNaN(Number(rawLng)) ? Number(rawLng) : null;

          const rawStatus = getVal(["status", "employeestatus"]);
          const status: "Active" | "Inactive" = rawStatus.toLowerCase().includes("inact")
            ? "Inactive"
            : "Active";

          const isValid = !!(name && phone && salaryAmount > 0);
          let validationError = "";
          if (!name) validationError = "Name required";
          else if (!phone) validationError = "Mobile required";
          else if (salaryAmount <= 0) validationError = "Salary > 0 required";

          return {
            name,
            phone,
            email,
            city,
            address,
            salaryType,
            salaryAmount,
            acceptedLeaves,
            emergencyContactName,
            emergencyContactRelation,
            emergencyContactPhone,
            latitude,
            longitude,
            status,
            isValid,
            validationError,
          };
        });

        setParsedEmployees(parsed);
        const validCount = parsed.filter((r) => r.isValid).length;
        showToast(`Loaded ${parsed.length} rows (${validCount} valid)`, "info");
      } catch (err: any) {
        console.error("Excel parse error:", err);
        showToast("Failed to parse file: " + err.message, "error");
      }
    };
    reader.readAsBinaryString(file);
  };

  // Start Bulk Upload: Generate QR code -> upload to ImageKit -> save to Firestore
  const handleStartBulkUpload = async () => {
    const validRows = parsedEmployees.filter((r) => r.isValid);
    if (validRows.length === 0) {
      showToast("No valid employee rows to import", "error");
      return;
    }

    setIsBulkUploading(true);
    setBulkProgress({ current: 0, total: validRows.length, currentName: "" });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      setBulkProgress({
        current: i + 1,
        total: validRows.length,
        currentName: row.name,
      });

      try {
        // 1. Generate unique 8-digit numeric Employee ID
        const empCode = generateUnique8DigitId();

        // 2. Generate QR code
        let qrCodeDataUrl = "";
        try {
          qrCodeDataUrl = await QRCode.toDataURL(empCode, {
            width: 360,
            margin: 1,
            color: {
              dark: "#0f172a",
              light: "#ffffff",
            },
          });
        } catch (qrErr) {
          console.warn("QR code generation error for " + empCode, qrErr);
        }

        // 3. Upload QR code to ImageKit
        let finalQrUrl = qrCodeDataUrl;
        if (qrCodeDataUrl) {
          try {
            finalQrUrl = await uploadToImageKit({
              base64: qrCodeDataUrl,
              fileName: `emp-qr-${empCode}.png`,
              folder: "/employees/qrcodes",
            });
          } catch (uploadErr) {
            console.warn(`ImageKit QR upload failed for ${empCode}, using fallback:`, uploadErr);
          }
        }

        // 4. Coordinates
        const locationCoordinates =
          row.latitude !== null && row.longitude !== null
            ? { latitude: row.latitude, longitude: row.longitude }
            : null;

        // 5. Add to Firestore employees collection
        await addDoc(collection(db, "employees"), {
          employeeId: empCode,
          name: row.name,
          phone: row.phone,
          email: row.email,
          city: row.city,
          address: row.address,
          profilePicUrl: "", // As specified, no profile URL in bulk import
          salaryType: row.salaryType,
          salaryAmount: row.salaryAmount,
          acceptedLeaves: row.acceptedLeaves,
          emergencyContact: {
            name: row.emergencyContactName,
            relation: row.emergencyContactRelation,
            phone: row.emergencyContactPhone,
          },
          locationCoordinates,
          qrCodeUrl: finalQrUrl,
          status: row.status,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        successCount++;
      } catch (err: any) {
        console.error(`Error importing row for ${row.name}:`, err);
        failCount++;
      }
    }

    setIsBulkUploading(false);
    showToast(
      `Bulk upload finished! Imported ${successCount} employee${
        successCount === 1 ? "" : "s"
      } with ImageKit QR badges.${failCount > 0 ? ` (${failCount} failed)` : ""}`,
      failCount > 0 ? "error" : "success"
    );

    setParsedEmployees([]);
    setBulkFileName("");
    setIsBulkModalOpen(false);
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
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b"
        style={{ borderColor: "var(--color-border-subtle)" }}
      >
        <div>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                backgroundColor: "var(--color-brand-primary-light)",
                color: "var(--color-brand-primary)",
              }}
            >
              <Users size={18} />
            </div>
            <h1
              className="text-2xl text-[var(--color-text-primary)] tracking-tight"
              style={{ fontWeight: 500 }}
            >
              Employees
            </h1>
            <span
              className="px-2 py-0.5 text-xs rounded font-normal font-mono"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                border: "1px solid var(--color-border-base)",
                color: "var(--color-text-secondary)",
              }}
            >
              {totalCount} total
            </span>
          </div>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--color-text-muted)" }}
          >
            Manage staff profiles, salary plans, leave quotas, emergency contacts, and ImageKit QR badges.
          </p>
        </div>

        {/* Actions: Bulk Upload & Add Employee */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setParsedEmployees([]);
              setBulkFileName("");
              setIsBulkModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-md border bg-white hover:bg-slate-50 transition-colors font-medium shadow-xs cursor-pointer"
            style={{
              borderColor: "var(--color-border-base)",
              color: "var(--color-text-primary)",
            }}
          >
            <FileSpreadsheet size={15} className="text-emerald-600" />
            <span>Bulk Upload</span>
          </button>

          <button
            onClick={handleOpenCreateDrawer}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs rounded-md text-white transition-opacity hover:opacity-90 font-normal shadow-xs cursor-pointer"
            style={{ backgroundColor: "var(--color-brand-primary)" }}
          >
            <Plus size={15} />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border w-full sm:w-80 bg-white"
            style={{
              borderColor: "var(--color-border-base)",
            }}
          >
            <Search size={14} style={{ color: "var(--color-text-muted)" }} />
            <input
              type="text"
              placeholder="Search by name, ID, phone, city..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs bg-transparent focus:outline-none"
              style={{ color: "var(--color-text-primary)" }}
            />
          </div>

          {/* Salary Filter */}
          <select
            value={salaryFilter}
            onChange={(e) => {
              setSalaryFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="text-xs px-2.5 py-1.5 rounded-md border bg-white focus:outline-none cursor-pointer"
            style={{ borderColor: "var(--color-border-base)", color: "var(--color-text-primary)" }}
          >
            <option value="all">All Salaries</option>
            <option value="monthly">Monthly Staff</option>
            <option value="daily">Daily Wage</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="text-xs px-2.5 py-1.5 rounded-md border bg-white focus:outline-none cursor-pointer"
            style={{ borderColor: "var(--color-border-base)", color: "var(--color-text-primary)" }}
          >
            <option value="all">All Status</option>
            <option value="Active">Active Only</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div
          className="text-xs self-end sm:self-center"
          style={{ color: "var(--color-text-muted)" }}
        >
          Showing {paginatedEmployees.length} of {filteredEmployees.length} (Limit: 24/page)
        </div>
      </div>

      {/* Main Table / Grid List (Supabase Table Editor Grid Style) */}
      <div
        className="rounded-lg border bg-white overflow-hidden shadow-xs"
        style={{ borderColor: "var(--color-border-base)" }}
      >
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2
              size={24}
              className="animate-spin"
              style={{ color: "var(--color-brand-primary)" }}
            />
            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Loading employees from database...
            </span>
          </div>
        ) : paginatedEmployees.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center p-6">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                color: "var(--color-text-muted)",
              }}
            >
              <Users size={22} />
            </div>
            <h3
              className="text-sm text-[var(--color-text-primary)]"
              style={{ fontWeight: 500 }}
            >
              {searchQuery ? "No matching employees found" : "No employees added yet"}
            </h3>
            <p className="text-xs mt-1 max-w-sm" style={{ color: "var(--color-text-muted)" }}>
              {searchQuery
                ? "Try searching for a different term or clear the filter."
                : "Get started by adding your first employee or using bulk upload."}
            </p>
            {!searchQuery && (
              <button
                onClick={handleOpenCreateDrawer}
                className="mt-4 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md text-white font-normal cursor-pointer"
                style={{ backgroundColor: "var(--color-brand-primary)" }}
              >
                <Plus size={14} />
                <span>Add Employee Now</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto border-t" style={{ borderColor: "var(--color-border-base)" }}>
            <table className="w-full text-left text-xs border-collapse">
              <thead
                className="border-b select-none sticky top-0 z-10"
                style={{
                  backgroundColor: "var(--color-bg-surface)",
                  borderColor: "var(--color-border-base)",
                  color: "var(--color-text-secondary)",
                }}
              >
                <tr className="divide-x divide-slate-200 text-[11px]">
                  {/* Photo */}
                  <th className="px-3 py-2 font-medium bg-slate-50/50 w-12 text-center">
                    <span className="font-medium text-slate-800">photo</span>
                  </th>

                  {/* Employee ID */}
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800">employee_id</span>
                        <span className="text-[10px] font-mono text-slate-400">varchar</span>
                      </div>
                      <ChevronDown size={12} className="text-slate-400" />
                    </div>
                  </th>

                  {/* Name */}
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50 min-w-[150px]">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800">name</span>
                        <span className="text-[10px] font-mono text-slate-400">text</span>
                      </div>
                      <ChevronDown size={12} className="text-slate-400" />
                    </div>
                  </th>

                  {/* Phone */}
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800">phone</span>
                        <span className="text-[10px] font-mono text-slate-400">varchar</span>
                      </div>
                      <ChevronDown size={12} className="text-slate-400" />
                    </div>
                  </th>

                  {/* City */}
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800">city</span>
                        <span className="text-[10px] font-mono text-slate-400">text</span>
                      </div>
                      <ChevronDown size={12} className="text-slate-400" />
                    </div>
                  </th>

                  {/* Salary Plan */}
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="font-medium text-slate-800">salary</span>
                      <span className="text-[10px] font-mono text-slate-400">numeric</span>
                    </div>
                  </th>

                  {/* Leaves */}
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="font-medium text-slate-800">leaves</span>
                      <span className="text-[10px] font-mono text-slate-400">int</span>
                    </div>
                  </th>

                  {/* Emergency Contact */}
                  <th className="px-3.5 py-2 font-medium bg-slate-50/50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-800">emergency_contact</span>
                        <span className="text-[10px] font-mono text-slate-400">json</span>
                      </div>
                      <ChevronDown size={12} className="text-slate-400" />
                    </div>
                  </th>

                  {/* Status */}
                  <th className="px-3 py-2 font-medium bg-slate-50/50 text-center w-20">
                    <span className="font-medium text-slate-800">status</span>
                  </th>

                  {/* Actions */}
                  <th className="px-3 py-2 font-medium text-right bg-slate-50/50 w-36">
                    <div className="flex items-center justify-end gap-1">
                      <span className="font-medium text-slate-800">actions</span>
                      <span className="text-[10px] font-mono text-slate-400">menu</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedEmployees.map((emp) => (
                  <tr
                    key={emp.id}
                    className="divide-x divide-slate-200 transition-colors hover:bg-slate-50/80"
                  >
                    {/* Photo */}
                    <td className="px-2 py-1.5 text-center">
                      {emp.profilePicUrl ? (
                        <img
                          src={emp.profilePicUrl}
                          alt={emp.name}
                          className="w-7 h-7 rounded-full object-cover border border-slate-200 mx-auto shadow-2xs"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center text-[11px] font-medium mx-auto shadow-2xs">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </td>

                    {/* Employee ID with Arrow Button */}
                    <td className="px-3.5 py-2 font-mono text-[11px] text-slate-700">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[#348bdd]">{emp.employeeId}</span>
                        <button
                          onClick={() => setViewingEmployee(emp)}
                          className="w-5 h-5 rounded flex items-center justify-center bg-slate-100 hover:bg-sky-50 text-slate-500 hover:text-[#348bdd] border border-slate-200/70 transition-colors cursor-pointer"
                          title="View employee profile"
                        >
                          <ArrowRight size={11} />
                        </button>
                      </div>
                    </td>

                    {/* Name */}
                    <td className="px-3.5 py-2 text-slate-900 font-medium">
                      {emp.name}
                    </td>

                    {/* Phone */}
                    <td className="px-3.5 py-2 font-mono text-[11px] text-slate-700">
                      {emp.phone || <span className="font-mono text-slate-300 italic text-[11px]">NULL</span>}
                    </td>

                    {/* City */}
                    <td className="px-3.5 py-2 text-slate-700">
                      {emp.city ? (
                        <span>{emp.city}</span>
                      ) : (
                        <span className="font-mono text-slate-300 italic text-[11px]">NULL</span>
                      )}
                    </td>

                    {/* Salary Plan */}
                    <td className="px-3.5 py-2 text-right font-mono text-slate-900 font-medium">
                      ₹{emp.salaryAmount.toLocaleString("en-IN")}{" "}
                      <span className="text-[10px] text-slate-400 font-normal">/{emp.salaryType}</span>
                    </td>

                    {/* Leaves */}
                    <td className="px-3.5 py-2 text-center font-mono text-[11px] text-slate-700">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[10px]">
                        {emp.acceptedLeaves} d/mo
                      </span>
                    </td>

                    {/* Emergency Contact */}
                    <td className="px-3.5 py-2 text-slate-700 text-[11px]">
                      {emp.emergencyContact?.name ? (
                        <div>
                          <span className="font-medium text-slate-800">{emp.emergencyContact.name}</span>
                          <span className="text-slate-400 font-normal ml-1">({emp.emergencyContact.relation || "Contact"})</span>
                          <span className="block font-mono text-[10px] text-slate-400">{emp.emergencyContact.phone}</span>
                        </div>
                      ) : (
                        <span className="font-mono text-slate-300 italic text-[11px]">NULL</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2 text-center whitespace-nowrap">
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
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* ID Card / QR - Indigo */}
                        <button
                          onClick={() => setIdCardEmployee(emp)}
                          className="w-7 h-7 rounded-md flex items-center justify-center transition-all bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 border border-indigo-100 cursor-pointer shadow-2xs"
                          title="Print Staff ID Card & QR"
                        >
                          <QrCode size={13} />
                        </button>

                        {/* View - Primary Blue */}
                        <button
                          onClick={() => setViewingEmployee(emp)}
                          className="w-7 h-7 rounded-md flex items-center justify-center transition-all bg-sky-50 text-[#348bdd] hover:bg-sky-100 hover:text-[#2377c8] border border-sky-100 cursor-pointer shadow-2xs"
                          title="View profile details"
                        >
                          <Eye size={13} />
                        </button>

                        {/* Edit - Amber */}
                        <button
                          onClick={() => handleOpenEditDrawer(emp)}
                          className="w-7 h-7 rounded-md flex items-center justify-center transition-all bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700 border border-amber-100 cursor-pointer shadow-2xs"
                          title="Edit employee"
                        >
                          <Edit2 size={13} />
                        </button>

                        {/* Delete - Rose */}
                        <button
                          onClick={() => setDeletingEmployee(emp)}
                          className="w-7 h-7 rounded-md flex items-center justify-center transition-all bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 border border-rose-100 cursor-pointer shadow-2xs"
                          title="Delete employee"
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

        {/* Pagination Bar */}
        {!isLoading && filteredEmployees.length > 0 && (
          <div
            className="flex items-center justify-between px-4 py-3 border-t bg-white"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Page {currentPage} of {totalPages}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded border hover:bg-slate-50 transition-colors disabled:opacity-40 cursor-pointer"
                style={{ borderColor: "var(--color-border-base)" }}
              >
                <ChevronLeft size={15} />
              </button>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded border hover:bg-slate-50 transition-colors disabled:opacity-40 cursor-pointer"
                style={{ borderColor: "var(--color-border-base)" }}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
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
          BULK UPLOAD MODAL
         ========================================================================= */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900">Bulk Upload Employees</h3>
                  <p className="text-[11px] text-slate-500">
                    Import staff spreadsheet. QR codes are automatically generated & uploaded to ImageKit.
                  </p>
                </div>
              </div>
              <button
                disabled={isBulkUploading}
                onClick={() => {
                  if (!isBulkUploading) setIsBulkModalOpen(false);
                }}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Step 1: Download Sample Excel Template */}
              <div className="p-4 rounded-xl border bg-slate-50/70 border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-slate-800 flex items-center gap-1.5">
                    <Download size={14} className="text-emerald-600" />
                    Step 1: Download Sample Template
                  </span>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Pre-filled with 50 complete dummy employee records (Name, Mobile, Email, City, Address, Salary Type, Salary Amount, Accepted Leaves, Emergency Contact & GPS). Neither profile photo URL nor QR code URL is needed in the spreadsheet.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSampleExcel}
                  className="px-3 py-1.5 text-xs rounded-lg border bg-white text-emerald-700 hover:bg-emerald-50 border-emerald-200 shadow-2xs font-medium flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
                >
                  <FileSpreadsheet size={13} />
                  <span>Download Sample Excel (50 Records)</span>
                </button>
              </div>

              {/* Step 2: Select File */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-800 flex items-center gap-1.5">
                  <FileUp size={14} className="text-[#348bdd]" />
                  Step 2: Choose Excel or CSV Spreadsheet
                </label>
                <div className="relative border-2 border-dashed rounded-xl p-5 border-slate-200 hover:border-[#348bdd] bg-slate-50/40 text-center transition-colors">
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    disabled={isBulkUploading}
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <div className="w-10 h-10 rounded-full bg-white shadow-2xs border border-slate-200 flex items-center justify-center text-slate-400">
                      <Upload size={18} className="text-[#348bdd]" />
                    </div>
                    {bulkFileName ? (
                      <div>
                        <span className="text-xs font-medium text-slate-800 font-mono block">
                          {bulkFileName}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Click to select a different file
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-xs font-medium text-slate-700 block">
                          Click to browse or drop Excel file (.xlsx, .xls, .csv)
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Supports multiple rows with auto-detected columns
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 3: Parsed Data Preview */}
              {parsedEmployees.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-800">
                      Step 3: Preview Data ({parsedEmployees.length} rows found)
                    </span>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                        ✓ {parsedEmployees.filter((r) => r.isValid).length} Valid
                      </span>
                      {parsedEmployees.filter((r) => !r.isValid).length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                          ⚠ {parsedEmployees.filter((r) => !r.isValid).length} Issues
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border rounded-xl overflow-hidden border-slate-200/80 max-h-56 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium sticky top-0">
                        <tr>
                          <th className="py-2 px-3 text-[10px] uppercase tracking-wider">Status</th>
                          <th className="py-2 px-3 text-[10px] uppercase tracking-wider">Name</th>
                          <th className="py-2 px-3 text-[10px] uppercase tracking-wider">Mobile</th>
                          <th className="py-2 px-3 text-[10px] uppercase tracking-wider">City</th>
                          <th className="py-2 px-3 text-[10px] uppercase tracking-wider">Salary</th>
                          <th className="py-2 px-3 text-[10px] uppercase tracking-wider">Emergency</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedEmployees.map((row, idx) => (
                          <tr key={idx} className={row.isValid ? "hover:bg-slate-50/50" : "bg-rose-50/30"}>
                            <td className="py-2 px-3 whitespace-nowrap">
                              {row.isValid ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  <CheckCircle2 size={10} /> Valid
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200"
                                  title={row.validationError}
                                >
                                  <AlertCircle size={10} /> {row.validationError}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-medium text-slate-800">{row.name || "—"}</td>
                            <td className="py-2 px-3 font-mono text-slate-600 text-[11px]">{row.phone || "—"}</td>
                            <td className="py-2 px-3 text-slate-500">{row.city || "—"}</td>
                            <td className="py-2 px-3 font-mono text-slate-700">
                              ₹{row.salaryAmount} / <span className="capitalize">{row.salaryType}</span>
                            </td>
                            <td className="py-2 px-3 text-slate-500 text-[11px]">
                              {row.emergencyContactName
                                ? `${row.emergencyContactName} (${row.emergencyContactRelation || "Contact"})`
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Progress indicator during bulk upload */}
              {isBulkUploading && (
                <div className="p-4 rounded-xl border bg-sky-50/60 border-sky-200 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs text-sky-900 font-medium">
                    <span className="flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin text-[#348bdd]" />
                      Generating QR & Uploading to ImageKit: {bulkProgress.currentName}
                    </span>
                    <span className="font-mono">
                      {bulkProgress.current} / {bulkProgress.total} (
                      {Math.round((bulkProgress.current / Math.max(1, bulkProgress.total)) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-sky-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-[#348bdd] h-full transition-all duration-300 rounded-full"
                      style={{
                        width: `${Math.round(
                          (bulkProgress.current / Math.max(1, bulkProgress.total)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-sky-600">
                    Generating 8-digit badge code, creating QR, uploading to ImageKit CDN, and saving to Firestore...
                  </p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isBulkUploading}
                onClick={() => setIsBulkModalOpen(false)}
                className="px-4 py-2 text-xs rounded-lg border bg-white text-slate-700 hover:bg-slate-50 font-medium cursor-pointer border-slate-200 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBulkUploading || parsedEmployees.filter((r) => r.isValid).length === 0}
                onClick={handleStartBulkUpload}
                className="px-5 py-2 text-xs rounded-lg text-white font-medium cursor-pointer shadow-sm flex items-center gap-2 disabled:opacity-40"
                style={{ backgroundColor: "var(--color-brand-primary)" }}
              >
                {isBulkUploading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Processing {bulkProgress.current}/{bulkProgress.total}...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet size={14} />
                    <span>
                      Import {parsedEmployees.filter((r) => r.isValid).length} Employees
                    </span>
                  </>
                )}
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
