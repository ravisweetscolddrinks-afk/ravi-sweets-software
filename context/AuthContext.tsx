"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type AuthRole = "admin" | "staff";

export interface AdminUser {
  role: "admin";
  uid: string;
  email: string;
  displayName: string;
}

export interface StaffUser {
  role: "staff";
  id: string; // Firestore document ID
  name: string;
  mobile: string;
  roleTitle: string;
  accessibleMenus: string[];
  manufacturingUnitIds?: string[];
  packingUnitIds?: string[];
}

export type CurrentUser = AdminUser | StaffUser | null;

interface AuthContextType {
  currentUser: CurrentUser;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginAdmin: (emailOrUsername: string, password: string) => Promise<void>;
  loginStaff: (mobile: string, mpin: string) => Promise<StaffUser>;
  logout: () => Promise<void>;
  canAccess: (pathname: string) => boolean;
  getDefaultHomePath: () => string;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  isAuthenticated: false,
  isLoading: true,
  loginAdmin: async () => {},
  loginStaff: async () => ({} as StaffUser),
  logout: async () => {},
  canAccess: () => false,
  getDefaultHomePath: () => "/login",
});

const STAFF_SESSION_KEY = "ravi_sweets_staff_session";
const AUTH_ROLE_KEY = "ravi_sweets_auth_role";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize Auth state on mount
  useEffect(() => {
    let isMounted = true;

    // Check if a staff session exists in localStorage
    const savedStaffSession = localStorage.getItem(STAFF_SESSION_KEY);
    const savedRole = localStorage.getItem(AUTH_ROLE_KEY);

    if (savedRole === "staff" && savedStaffSession) {
      try {
        const parsedStaff: StaffUser = JSON.parse(savedStaffSession);
        if (parsedStaff && parsedStaff.role === "staff" && parsedStaff.id) {
          if (isMounted) {
            setCurrentUser(parsedStaff);
            setIsLoading(false);
          }
          return;
        }
      } catch (err) {
        console.warn("Failed to parse staff session:", err);
        localStorage.removeItem(STAFF_SESSION_KEY);
        localStorage.removeItem(AUTH_ROLE_KEY);
      }
    }

    // Listen to Firebase Auth state for Super Admin
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (!isMounted) return;

      if (firebaseUser) {
        // Admin user authenticated via Firebase Auth
        const admin: AdminUser = {
          role: "admin",
          uid: firebaseUser.uid,
          email: firebaseUser.email || "admin@ravisweets.com",
          displayName: firebaseUser.displayName || "Super Admin",
        };
        localStorage.setItem(AUTH_ROLE_KEY, "admin");
        localStorage.removeItem(STAFF_SESSION_KEY);
        setCurrentUser(admin);
      } else {
        // No Firebase Auth user. If not already loaded as staff, set null
        const currentStaff = localStorage.getItem(STAFF_SESSION_KEY);
        if (!currentStaff) {
          setCurrentUser(null);
        }
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Admin Login via Firebase Auth Email & Password
  const loginAdmin = useCallback(async (emailOrUsername: string, password: string) => {
    setIsLoading(true);
    try {
      let email = emailOrUsername.trim();
      // If user provided a username without '@', append '@ravisweets.com'
      if (!email.includes("@")) {
        email = `${email}@ravisweets.com`;
      }

      const cred = await signInWithEmailAndPassword(auth, email, password);
      const admin: AdminUser = {
        role: "admin",
        uid: cred.user.uid,
        email: cred.user.email || email,
        displayName: cred.user.displayName || "Super Admin",
      };

      localStorage.setItem(AUTH_ROLE_KEY, "admin");
      localStorage.removeItem(STAFF_SESSION_KEY);
      setCurrentUser(admin);
    } catch (err: any) {
      console.error("Admin login error:", err);
      let errorMsg = "Failed to sign in as Admin.";
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        errorMsg = "Invalid Admin username/email or password.";
      } else if (err.code === "auth/invalid-email") {
        errorMsg = "Please enter a valid email address.";
      } else if (err.code === "auth/too-many-requests") {
        errorMsg = "Too many failed attempts. Please wait a moment and try again.";
      } else if (err.message) {
        errorMsg = err.message;
      }
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Staff Login via Mobile Number & MPIN from Firestore `staff` collection
  const loginStaff = useCallback(async (mobile: string, mpin: string): Promise<StaffUser> => {
    setIsLoading(true);
    try {
      const cleanMobile = mobile.replace(/\D/g, "");
      const cleanMpin = mpin.trim();

      if (cleanMobile.length < 10) {
        throw new Error("Please enter a valid 10-digit mobile number.");
      }
      if (!cleanMpin) {
        throw new Error("Please enter your MPIN.");
      }

      // Query staff collection
      const q = query(
        collection(db, "staff"),
        where("mobile", "==", cleanMobile)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        throw new Error("No staff member found with this mobile number. Please contact Admin.");
      }

      const docSnap = snapshot.docs[0];
      const data = docSnap.data();

      // Check account status
      if (data.status && data.status === "Inactive") {
        throw new Error("Your staff account is currently marked Inactive. Please contact Admin.");
      }

      // Verify MPIN
      if (String(data.mpin).trim() !== cleanMpin) {
        throw new Error("Incorrect MPIN. Please try again.");
      }

      // Build verified staff session
      const staffUser: StaffUser = {
        role: "staff",
        id: docSnap.id,
        name: data.name || "Staff Member",
        mobile: data.mobile || cleanMobile,
        roleTitle: data.role || "Staff",
        accessibleMenus: Array.isArray(data.accessibleMenus) && data.accessibleMenus.length > 0
          ? data.accessibleMenus
          : ["/pos"], // Default fallback to POS if not configured
        manufacturingUnitIds: data.manufacturingUnitIds || [],
        packingUnitIds: data.packingUnitIds || [],
      };

      // Persist in localStorage
      localStorage.setItem(AUTH_ROLE_KEY, "staff");
      localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(staffUser));

      // Sign out any lingering Firebase Auth session to prevent role conflict
      try {
        await signOut(auth);
      } catch {}

      setCurrentUser(staffUser);
      return staffUser;
    } catch (err: any) {
      console.error("Staff login error:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sign out from current session
  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      localStorage.removeItem(STAFF_SESSION_KEY);
      localStorage.removeItem(AUTH_ROLE_KEY);
      setCurrentUser(null);
      await signOut(auth);
    } catch (err) {
      console.warn("Logout error:", err);
    } finally {
      setIsLoading(false);
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  }, []);

  // Check if current user is authorized to access a given URL path
  const canAccess = useCallback(
    (pathname: string): boolean => {
      if (!currentUser) return false;

      // Super Admin has full unrestricted access to all routes
      if (currentUser.role === "admin") return true;

      // Staff user: only permitted menus
      const staff = currentUser as StaffUser;
      if (!staff.accessibleMenus || staff.accessibleMenus.length === 0) {
        return false;
      }

      const cleanPath = pathname.split("?")[0].replace(/\/+$/, "") || "/";

      // Allow access to settings if profile viewing, or if specifically permitted
      if (cleanPath === "/login") return true;

      // Map common route aliases
      const routeAliases: Record<string, string> = {
        "/dashboard": "/",
        "/vendors": "/vendor-manager",
        "/vendor-orders": "/vendor-manager",
        "/vendor-due": "/vendor-manager",
        "/order": "/orders",
        "/employee-attendence": "/employee-attendance",
      };

      const normalizedPath = routeAliases[cleanPath] || cleanPath;

      return staff.accessibleMenus.some((menu) => {
        const cleanMenu = menu.replace(/\/+$/, "") || "/";
        if (cleanMenu === "/") {
          return normalizedPath === "/";
        }
        return (
          normalizedPath === cleanMenu ||
          normalizedPath.startsWith(cleanMenu + "/")
        );
      });
    },
    [currentUser]
  );

  // Get primary landing page for currently logged in user
  const getDefaultHomePath = useCallback((): string => {
    if (!currentUser) return "/login";
    if (currentUser.role === "admin") return "/";

    const staff = currentUser as StaffUser;
    if (staff.accessibleMenus && staff.accessibleMenus.length > 0) {
      return staff.accessibleMenus[0];
    }
    return "/pos";
  }, [currentUser]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isLoading,
        loginAdmin,
        loginStaff,
        logout,
        canAccess,
        getDefaultHomePath,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

