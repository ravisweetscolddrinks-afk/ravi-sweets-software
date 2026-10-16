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
  PanelLeftClose,
  PanelLeftOpen,
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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({
  isMobileOpen,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const [hoveredItem, setHoveredItem] = React.useState<{
    name: string;
    category?: string;
    top: number;
    left: number;
  } | null>(null);

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
        className={`fixed md:sticky top-14 z-40 h-[calc(100vh-3.5rem)] flex flex-col shrink-0 border-r transition-[width,transform] duration-200 ease-in-out md:translate-x-0 ${
          isCollapsed ? "w-16" : "w-56 lg:w-60"
        } ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{
          backgroundColor: "var(--color-bg-sidebar)",
          borderColor: "var(--color-border-base)",
        }}
      >
        {/* Top Sidebar Collapse Toggle Bar */}
        <div
          className="flex items-center justify-between px-3 py-2 border-b shrink-0 min-h-[38px]"
          style={{ borderColor: "var(--color-border-subtle)" }}
        >
          {!isCollapsed ? (
            <>
              <span className="text-[11px] font-medium tracking-wider uppercase text-slate-400">
                Menu
              </span>
              {onToggleCollapse && (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                  className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  <PanelLeftClose size={15} />
                </button>
              )}
            </>
          ) : (
            onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Expand sidebar"
                aria-label="Expand sidebar"
                className="mx-auto p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <PanelLeftOpen size={15} />
              </button>
            )
          )}
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col py-2 px-2 space-y-0.5">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item);

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onCloseMobile}
                onMouseEnter={(e) => {
                  if (isCollapsed) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredItem({
                      name: item.name,
                      category: item.category,
                      top: rect.top + rect.height / 2,
                      left: rect.right + 10,
                    });
                  }
                }}
                onMouseLeave={() => setHoveredItem(null)}
                className={`group relative flex items-center ${
                  isCollapsed ? "justify-center p-2.5" : "justify-between px-3 py-2"
                } rounded-md text-[13px] transition-colors duration-150`}
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
                  margin: 0,
                }}
              >
                <div
                  className={`flex items-center ${
                    isCollapsed ? "justify-center" : "gap-2.5"
                  } min-w-0`}
                >
                  <Icon
                    size={17}
                    className="shrink-0 transition-colors"
                    style={{
                      color: active
                        ? "var(--color-brand-primary)"
                        : "var(--color-text-muted)",
                    }}
                  />
                  {!isCollapsed && (
                    <span className="truncate tracking-tight">{item.name}</span>
                  )}
                </div>

                {!isCollapsed && active && (
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: "var(--color-brand-primary)" }}
                  />
                )}

                {/* Active Indicator bar when collapsed */}
                {isCollapsed && active && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r"
                    style={{ backgroundColor: "var(--color-brand-primary)" }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Footer info in sidebar */}
        {!isCollapsed ? (
          <div
            className="mt-auto p-2.5 m-2 rounded-lg border text-[11px] shrink-0"
            style={{
              backgroundColor: "var(--color-bg-subtle)",
              borderColor: "var(--color-border-subtle)",
              color: "var(--color-text-muted)",
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] tracking-wider uppercase">System</span>
              <span
                className="text-[10px] px-1 py-0.2 rounded font-medium"
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
        ) : (
          <div
            className="mt-auto p-2.5 mb-2 flex justify-center text-[10px] text-slate-400 shrink-0"
            title="Ravi Sweets v1.0.0 (Live)"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        )}
      </aside>

      {/* Floating Popover Tooltip when Sidebar is Collapsed */}
      {isCollapsed && hoveredItem && (
        <div
          className="fixed z-50 pointer-events-none px-3 py-1.5 rounded-md bg-slate-900 text-white shadow-2xl whitespace-nowrap flex items-center animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: `${hoveredItem.top}px`,
            left: `${hoveredItem.left}px`,
            transform: "translateY(-50%)",
          }}
        >
          <div className="flex flex-col">
            <span className="font-medium text-[12.5px] leading-snug">
              {hoveredItem.name}
            </span>
            {hoveredItem.category && (
              <span className="text-[10px] text-slate-400 font-normal leading-tight">
                {hoveredItem.category}
              </span>
            )}
          </div>
          {/* Tooltip pointer triangle */}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
        </div>
      )}
    </>
  );
}
