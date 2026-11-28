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
  Truck,
  UserCog,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  ShieldCheck,
  FileText,
  Barcode,
  ClipboardList,
  UtensilsCrossed,
  ChevronDown,
  Warehouse,
  Scan,
  Archive,
  GripVertical,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export interface NavSubItem {
  name: string;
  href: string;
  aliases?: string[];
  icon: React.ElementType;
  badge?: string;
}

export interface NavItem {
  name: string;
  href?: string;
  aliases?: string[];
  icon: React.ElementType;
  badge?: string;
  category?: string;
  isAccordion?: boolean;
  children?: NavSubItem[];
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
    name: "Quotations",
    href: "/quotations",
    icon: FileText,
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
    name: "Work Sheet",
    href: "/worksheet",
    aliases: ["/work-sheet"],
    icon: ClipboardList,
    category: "Inventory & Operations",
  },
  {
    name: "Manufacturing Stock Analysis",
    href: "/manufacturing-stock-analysis",
    aliases: ["/stock-analysis", "/manufacturing-analysis"],
    icon: LineChart,
    category: "Inventory & Operations",
  },
  {
    name: "Warehouse Entry",
    href: "/warehouse-entry",
    aliases: ["/warehouse", "/warehouse-entries"],
    icon: Warehouse,
    category: "Inventory & Operations",
  },
  {
    name: "Packing Utilities",
    href: "/packing-utilities",
    aliases: ["/packing-materials", "/utilities"],
    icon: Archive,
    category: "Inventory & Operations",
  },
  {
    name: "Scan Product",
    href: "/scan-product",
    aliases: ["/scan", "/visual-search"],
    icon: Scan,
    category: "Inventory & Operations",
  },
  {
    name: "Vendor Manager",
    href: "/vendor-manager",
    aliases: ["/vendors", "/vendor-orders", "/vendor-due"],
    icon: Truck,
    category: "Inventory & Operations",
  },
  {
    name: "Buyers",
    icon: Users,
    category: "Inventory & Operations",
    isAccordion: true,
    children: [
      {
        name: "Buyers",
        href: "/caterers",
        icon: Users,
      },
      {
        name: "Buyers Orders",
        href: "/catering-orders",
        aliases: ["/catering-order"],
        icon: ClipboardList,
      },
      {
        name: "Buyers Credits",
        href: "/catering-credits",
        aliases: ["/catering-dues"],
        icon: Wallet,
      },
    ],
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
    name: "Barcode Generator",
    href: "/barcode-generator",
    aliases: ["/barcode", "/barcodes"],
    icon: Barcode,
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
    name: "Staff",
    href: "/staff",
    icon: UserCog,
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
  const { currentUser, canAccess, logout } = useAuth();
  const [openAccordions, setOpenAccordions] = React.useState<Record<string, boolean>>({
    "Buyers": true,
    "Buyers Manager": true,
    "Catering Manager": true,
  });
  const [hoveredItem, setHoveredItem] = React.useState<{
    name: string;
    category?: string;
    top: number;
    left: number;
  } | null>(null);

  // Drag and drop state for menu reordering
  const [orderedItems, setOrderedItems] = React.useState<NavItem[]>(SIDEBAR_ITEMS);
  const [draggedName, setDraggedName] = React.useState<string | null>(null);
  const [dragOverName, setDragOverName] = React.useState<string | null>(null);
  const [dropPosition, setDropPosition] = React.useState<"above" | "below" | null>(null);
  const [justDroppedName, setJustDroppedName] = React.useState<string | null>(null);
  const [isCustomOrdered, setIsCustomOrdered] = React.useState<boolean>(false);

  // Load custom lineup from localStorage on mount
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("ravi_sweets_sidebar_order_v1");
      if (saved) {
        const orderNames: string[] = JSON.parse(saved);
        if (Array.isArray(orderNames) && orderNames.length > 0) {
          const map = new Map(SIDEBAR_ITEMS.map((item) => [item.name, item]));
          const sorted: NavItem[] = [];
          for (const name of orderNames) {
            const item = map.get(name);
            if (item) {
              sorted.push(item);
              map.delete(name);
            }
          }
          // Any newly added items in code not yet in storage
          for (const remaining of map.values()) {
            sorted.push(remaining);
          }
          setOrderedItems(sorted);
          setIsCustomOrdered(true);
        }
      }
    } catch (err) {
      console.error("Failed to load sidebar order from storage", err);
    }
  }, []);

  const handleDragStart = (e: React.DragEvent, name: string) => {
    e.dataTransfer.setData("text/plain", name);
    e.dataTransfer.effectAllowed = "move";
    setDraggedName(name);
  };

  const handleDragOver = (e: React.DragEvent, targetName: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedName === targetName) {
      if (dragOverName !== null) {
        setDragOverName(null);
        setDropPosition(null);
      }
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const pos = offsetY < rect.height / 2 ? "above" : "below";
    if (dragOverName !== targetName || dropPosition !== pos) {
      setDragOverName(targetName);
      setDropPosition(pos);
    }
  };

  const handleDragLeave = (e: React.DragEvent, name: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX >= rect.right ||
      e.clientY < rect.top ||
      e.clientY >= rect.bottom
    ) {
      if (dragOverName === name) {
        setDragOverName(null);
        setDropPosition(null);
      }
    }
  };

  const handleDrop = (e: React.DragEvent, targetName: string) => {
    e.preventDefault();
    const sourceName = draggedName || e.dataTransfer.getData("text/plain");
    if (!sourceName || sourceName === targetName) {
      setDraggedName(null);
      setDragOverName(null);
      setDropPosition(null);
      return;
    }

    setOrderedItems((prev) => {
      const list = [...prev];
      const sourceIndex = list.findIndex((it) => it.name === sourceName);
      if (sourceIndex === -1) return prev;

      const [removed] = list.splice(sourceIndex, 1);
      let targetIndex = list.findIndex((it) => it.name === targetName);
      if (targetIndex === -1) {
        list.push(removed);
      } else {
        if (dropPosition === "below") {
          targetIndex += 1;
        }
        list.splice(targetIndex, 0, removed);
      }

      try {
        localStorage.setItem(
          "ravi_sweets_sidebar_order_v1",
          JSON.stringify(list.map((it) => it.name))
        );
        setIsCustomOrdered(true);
      } catch (err) {
        console.error("Failed to save sidebar order", err);
      }

      setJustDroppedName(sourceName);
      setTimeout(() => {
        setJustDroppedName((curr) => (curr === sourceName ? null : curr));
      }, 700);

      return list;
    });

    setDraggedName(null);
    setDragOverName(null);
    setDropPosition(null);
  };

  const handleDragEnd = () => {
    setDraggedName(null);
    setDragOverName(null);
    setDropPosition(null);
  };

  const handleResetOrder = () => {
    try {
      localStorage.removeItem("ravi_sweets_sidebar_order_v1");
    } catch (err) {
      console.error(err);
    }
    setOrderedItems(SIDEBAR_ITEMS);
    setIsCustomOrdered(false);
  };

  const toggleAccordion = (name: string) => {
    setOpenAccordions((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const visibleItems = React.useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === "admin") return orderedItems;

    return orderedItems.filter((item) => {
      if (item.isAccordion && item.children) {
        return item.children.some((c) => canAccess(c.href));
      }
      return item.href ? canAccess(item.href) : false;
    });
  }, [currentUser, canAccess, orderedItems]);

  const isItemActive = (item: NavItem) => {
    if (item.isAccordion && item.children) {
      return item.children.some((c) => {
        if (pathname === c.href) return true;
        if (c.aliases && c.aliases.includes(pathname)) return true;
        if (c.href !== "/" && pathname.startsWith(c.href)) return true;
        return false;
      });
    }
    if (!item.href) return false;
    if (pathname === item.href) return true;
    if (item.aliases && item.aliases.includes(pathname)) return true;
    if (item.href !== "/" && pathname.startsWith(item.href)) return true;
    return false;
  };

  const isSubItemActive = (sub: NavSubItem) => {
    if (pathname === sub.href) return true;
    if (sub.aliases && sub.aliases.includes(pathname)) return true;
    if (sub.href !== "/" && pathname.startsWith(sub.href)) return true;
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
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium tracking-wider uppercase text-slate-400">
                  Menu
                </span>
                {isCustomOrdered && (
                  <button
                    type="button"
                    onClick={handleResetOrder}
                    title="Reset to default menu order"
                    className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw size={11} />
                    <span className="text-[10px] font-normal lowercase opacity-75">reset</span>
                  </button>
                )}
              </div>
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
        <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col py-2 px-2 space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item);
            const isDragging = draggedName === item.name;
            const isOverAbove = dragOverName === item.name && dropPosition === "above";
            const isOverBelow = dragOverName === item.name && dropPosition === "below";
            const isJustDropped = justDroppedName === item.name;

            // Accordion Item (e.g. Buyers)
            if (item.isAccordion && item.children) {
              const isOpen = openAccordions[item.name] ?? false;

              return (
                <div
                  key={item.name}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, item.name)}
                  onDragOver={(e) => handleDragOver(e, item.name)}
                  onDragLeave={(e) => handleDragLeave(e, item.name)}
                  onDrop={(e) => handleDrop(e, item.name)}
                  onDragEnd={handleDragEnd}
                  className={`relative flex flex-col space-y-0.5 transition-all duration-200 ease-out ${
                    isDragging
                      ? "opacity-35 scale-[0.98] ring-2 ring-[#348bdd]/40 rounded-lg bg-sky-50/40 dark:bg-sky-950/20"
                      : "opacity-100 scale-100"
                  } ${
                    isJustDropped
                      ? "ring-2 ring-[#348bdd]/60 bg-sky-500/10 rounded-lg shadow-sm"
                      : ""
                  }`}
                >
                  {/* Glowing drop indicator line above */}
                  {isOverAbove && (
                    <div className="absolute -top-1 left-1.5 right-1.5 h-1 bg-[#348bdd] rounded-full shadow-[0_0_10px_#348bdd] z-30 pointer-events-none animate-pulse" />
                  )}
                  {/* Glowing drop indicator line below */}
                  {isOverBelow && (
                    <div className="absolute -bottom-1 left-1.5 right-1.5 h-1 bg-[#348bdd] rounded-full shadow-[0_0_10px_#348bdd] z-30 pointer-events-none animate-pulse" />
                  )}

                  <button
                    type="button"
                    draggable={false}
                    onClick={() => toggleAccordion(item.name)}
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
                      isCollapsed ? "justify-center p-2.5" : "justify-between px-2.5 py-2"
                    } rounded-md text-[13px] transition-colors duration-150 cursor-pointer w-full text-left`}
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
                        isCollapsed ? "justify-center" : "gap-1.5"
                      } min-w-0`}
                    >
                      {!isCollapsed && (
                        <div
                          className="opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity duration-150 cursor-grab active:cursor-grabbing text-slate-400 -ml-1 shrink-0"
                          title="Drag to reorder"
                        >
                          <GripVertical size={13} />
                        </div>
                      )}
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
                        <span className="truncate tracking-tight font-medium">{item.name}</span>
                      )}
                    </div>

                    {!isCollapsed && (
                      <ChevronDown
                        size={14}
                        className={`text-slate-400 transition-transform duration-200 shrink-0 ${
                          isOpen ? "rotate-0" : "-rotate-90"
                        }`}
                      />
                    )}

                    {/* Active Indicator bar when collapsed */}
                    {isCollapsed && active && (
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r"
                        style={{ backgroundColor: "var(--color-brand-primary)" }}
                      />
                    )}
                  </button>

                  {/* Accordion Sub-items */}
                  {!isCollapsed && isOpen && (
                    <div className="pl-3 pr-1 py-0.5 space-y-0.5 border-l-2 ml-4 border-slate-100">
                      {item.children.map((sub) => {
                        const SubIcon = sub.icon;
                        const subActive = isSubItemActive(sub);

                        return (
                          <Link
                            key={sub.name}
                            href={sub.href}
                            draggable={false}
                            onClick={onCloseMobile}
                            className="group flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors duration-150 cursor-pointer"
                            style={{
                              backgroundColor: subActive
                                ? "var(--color-brand-primary-light)"
                                : "transparent",
                              color: subActive
                                ? "var(--color-brand-primary-text)"
                                : "var(--color-text-secondary)",
                              fontWeight: subActive ? 500 : 400,
                            }}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <SubIcon
                                size={14}
                                className="shrink-0"
                                style={{
                                  color: subActive
                                    ? "var(--color-brand-primary)"
                                    : "var(--color-text-muted)",
                                }}
                              />
                              <span className="truncate">{sub.name}</span>
                            </div>

                            {subActive && (
                              <div
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: "var(--color-brand-primary)" }}
                              />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div
                key={item.name}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, item.name)}
                onDragOver={(e) => handleDragOver(e, item.name)}
                onDragLeave={(e) => handleDragLeave(e, item.name)}
                onDrop={(e) => handleDrop(e, item.name)}
                onDragEnd={handleDragEnd}
                className={`relative transition-all duration-200 ease-out ${
                  isDragging
                    ? "opacity-35 scale-[0.98] ring-2 ring-[#348bdd]/40 rounded-lg bg-sky-50/40 dark:bg-sky-950/20"
                    : "opacity-100 scale-100"
                } ${
                  isJustDropped
                    ? "ring-2 ring-[#348bdd]/60 bg-sky-500/10 rounded-lg shadow-sm"
                    : ""
                }`}
              >
                {/* Glowing drop indicator line above */}
                {isOverAbove && (
                  <div className="absolute -top-1 left-1.5 right-1.5 h-1 bg-[#348bdd] rounded-full shadow-[0_0_10px_#348bdd] z-30 pointer-events-none animate-pulse" />
                )}
                {/* Glowing drop indicator line below */}
                {isOverBelow && (
                  <div className="absolute -bottom-1 left-1.5 right-1.5 h-1 bg-[#348bdd] rounded-full shadow-[0_0_10px_#348bdd] z-30 pointer-events-none animate-pulse" />
                )}

                <Link
                  href={item.href || "#"}
                  draggable={false}
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
                    isCollapsed ? "justify-center p-2.5" : "justify-between px-2.5 py-2"
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
                      isCollapsed ? "justify-center" : "gap-1.5"
                    } min-w-0`}
                  >
                    {!isCollapsed && (
                      <div
                        className="opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity duration-150 cursor-grab active:cursor-grabbing text-slate-400 -ml-1 shrink-0"
                        title="Drag to reorder"
                      >
                        <GripVertical size={13} />
                      </div>
                    )}
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
              </div>
            );
          })}
        </div>

        {/* User Card & Logout in Sidebar Footer */}
        {!isCollapsed ? (
          <div className="mt-auto p-2 m-2 rounded-xl border border-slate-200 bg-slate-50/80 text-xs shrink-0 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    currentUser?.role === "admin"
                      ? "bg-sky-100 text-[#348bdd]"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {currentUser?.role === "admin" ? (
                    <ShieldCheck size={16} />
                  ) : (
                    <UserCog size={16} />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-slate-800 truncate text-[12px]">
                    {currentUser?.role === "admin"
                      ? currentUser.displayName || "Super Admin"
                      : currentUser?.name || "Staff"}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {currentUser?.role === "admin"
                      ? "Super Admin"
                      : (currentUser as any)?.roleTitle || (currentUser as any)?.mobile || "Staff"}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={logout}
                title="Sign Out"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-auto p-2 mb-2 flex flex-col items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={logout}
              title={`Sign Out (${currentUser?.role === "admin" ? "Admin" : (currentUser as any)?.name})`}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <LogOut size={16} />
            </button>
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
