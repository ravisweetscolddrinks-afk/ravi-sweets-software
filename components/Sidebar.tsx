"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Store,
  Factory,
  Boxes,
  ArrowDownToLine,
  LineChart,
  Cpu,
  PackageCheck,
  Users,
  Package,
  FolderTree,
  UserCheck,
  Wallet,
  CalendarCheck,
} from "lucide-react";

export interface NavItem {
  name: string;
  href: string;
  aliases?: string[];
  icon: React.ElementType;
  badge?: string;
  category?: string;
}

export const SIDEBAR_ITEMS: NavItem[] = [
  {
    name: "Dashboard",
    href: "/",
    aliases: ["/dashboard"],
    icon: LayoutDashboard,
    category: "Overview",
  },
  {
    name: "POS Billing",
    href: "/pos",
    icon: Receipt,
    category: "Sales & POS",
  },
  {
    name: "Walk In Sales",
    href: "/walk-in-sales",
    icon: ShoppingBag,
    category: "Sales & POS",
  },
  {
    name: "Orders",
    href: "/orders",
    aliases: ["/order"],
    icon: ShoppingCart,
    category: "Sales & POS",
  },
  {
    name: "Stores",
    href: "/stores",
    icon: Store,
    category: "Outlets & Units",
  },
  {
    name: "Manufacturing Units",
    href: "/manufacturing-units",
    icon: Factory,
    category: "Outlets & Units",
  },
  {
    name: "Packing Units",
    href: "/packing-units",
    icon: Boxes,
    category: "Outlets & Units",
  },
  {
    name: "Store Stock Entry",
    href: "/store-stock-entry",
    icon: ArrowDownToLine,
    category: "Inventory & Operations",
  },
  {
    name: "Manufacturing Stock Analysis",
    href: "/manufacturing-stock-analysis",
    icon: LineChart,
    category: "Inventory & Operations",
  },
  {
    name: "Manufacturing Portal",
    href: "/manufacturing-portal",
    icon: Cpu,
    category: "Portals",
  },
  {
    name: "Packing Portal",
    href: "/packing-portal",
    icon: PackageCheck,
    category: "Portals",
  },
  {
    name: "Customers",
    href: "/customers",
    icon: Users,
    category: "Catalog & CRM",
  },
  {
    name: "Products",
    href: "/products",
    icon: Package,
    category: "Catalog & CRM",
  },
  {
    name: "ProductCategories",
    href: "/product-categories",
    icon: FolderTree,
    category: "Catalog & CRM",
  },
  {
    name: "Employees",
    href: "/employees",
    icon: UserCheck,
    category: "Human Resources",
  },
  {
    name: "Payroll",
    href: "/payroll",
    icon: Wallet,
    category: "Human Resources",
  },
  {
    name: "Employee Attendence",
    href: "/employee-attendance",
    aliases: ["/employee-attendence"],
    icon: CalendarCheck,
    category: "Human Resources",
  },
];

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ isMobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();

  const isItemActive = (item: NavItem) => {
    if (pathname === item.href) return true;
    if (item.aliases && item.aliases.includes(pathname)) return true;
    if (item.href !== "/" && pathname.startsWith(item.href)) return true;
    return false;
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:sticky top-14 z-40 h-[calc(100vh-3.5rem)] w-64 lg:w-72 flex flex-col shrink-0 border-r transition-transform duration-200 ease-in-out md:translate-x-0 overflow-y-auto ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          backgroundColor: "var(--color-bg-sidebar)",
          borderColor: "var(--color-border-base)",
        }}
      >
        <div className="flex flex-col py-3 px-2.5 space-y-1">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item);

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onCloseMobile}
                className="group flex items-center justify-between px-3 py-2.5 rounded-md text-[13.5px] transition-colors duration-150 relative"
                style={{
                  backgroundColor: active
                    ? "var(--color-bg-active)"
                    : "transparent",
                  color: active
                    ? "var(--color-text-primary)"
                    : "var(--color-text-secondary)",
                  fontWeight: active ? 500 : 400,
                  border: active
                    ? "1px solid var(--color-border-base)"
                    : "1px solid transparent",
                    margin: 0
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    size={17}
                    className="shrink-0 transition-colors"
                    style={{
                      color: active
                        ? "var(--color-brand-primary)"
                        : "var(--color-text-muted)",
                    }}
                  />
                  <span className="truncate tracking-tight">{item.name}</span>
                </div>

                {active && (
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: "var(--color-brand-primary)" }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Footer info in sidebar */}
        <div
          className="mt-auto p-3 m-2 rounded-lg border text-[11px]"
          style={{
            backgroundColor: "var(--color-bg-subtle)",
            borderColor: "var(--color-border-subtle)",
            color: "var(--color-text-muted)",
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] tracking-wider uppercase">System</span>
            <span
              className="text-[10px] px-1 py-0.2 rounded"
              style={{
                backgroundColor: "var(--color-brand-primary-light)",
                color: "var(--color-brand-primary-text)",
              }}
            >
              v1.0.0
            </span>
          </div>
          <div
            className="truncate font-normal"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Ravi Sweets Live Console
          </div>
        </div>
      </aside>
    </>
  );
}
