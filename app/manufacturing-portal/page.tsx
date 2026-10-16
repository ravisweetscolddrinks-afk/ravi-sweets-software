"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ToastProvider";
import {
  Factory,
  Layers,
  ListOrdered,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ArrowRight,
  Boxes,
  RotateCw,
  Loader2,
  Calendar,
  Store,
  User,
  Phone,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Play,
  Check,
  Send,
  PackageCheck,
  Flame,
  ChefHat,
  Info,
} from "lucide-react";
import { OrderRecord, OrderItem, OrderStatus } from "@/types/order";

interface ManufacturingUnit {
  id: string;
  name: string;
}

interface ProductInfo {
  id: string;
  name: string;
  unit: string;
  imageUrl?: string;
  manufacturingUnitId?: string;
  manufacturingUnitName?: string;
  piecesPerKg?: number | string;
}

interface ConsolidatedItemBreakdown {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  storeName: string;
  deliveryDate: string;
  deliveryTime: string;
  packingDescription: string;
  lineId: string;
  quantity: number;
  unit: string;
  calculatedKg: number;
  manufacturingDescription: string;
  status: OrderStatus;
}

interface ConsolidatedGroup {
  productId: string;
  productName: string;
  imageUrl?: string;
  unit: string;
  manufacturingUnitId: string;
  manufacturingUnitName: string;
  totalQuantity: number;
  totalKg: number;
  ordersCount: number;
  items: ConsolidatedItemBreakdown[];
  statusSummary: {
    created: number;
    inProgress: number;
    completed: number;
    movedToPacking: number;
  };
}

type TabMode = "consolidated" | "order_wise";
type StatusFilter = "active" | "created" | "in_progress" | "completed" | "all";
type DateFilter = "all" | "today" | "tomorrow" | "this_week";

export default function ManufacturingPortalPage() {
  const { showToast } = useToast();

  // Data states
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [units, setUnits] = useState<ManufacturingUnit[]>([]);
  const [productsMap, setProductsMap] = useState<Map<string, ProductInfo>>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // Filters
  const [selectedUnitId, setSelectedUnitId] = useState<string>("all");
  const [selectedTab, setSelectedTab] = useState<TabMode>("consolidated");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  // 1. Real-time Subscription to Orders, Manufacturing Units, and Products
  useEffect(() => {
    setIsLoading(true);

    // Orders Listener
    const ordersCol = collection(db, "orders");
    const qOrders = query(ordersCol, orderBy("createdAt", "desc"));
    const unsubOrders = onSnapshot(
      qOrders,
      (snapshot) => {
        const list: OrderRecord[] = [];
        snapshot.docs.forEach((docSnap) => {
          list.push({
            id: docSnap.id,
            ...(docSnap.data() as Omit<OrderRecord, "id">),
          });
        });
        setOrders(list);
        setIsLoading(false);
      },
      (err) => {
        console.error("Orders listener error:", err);
        setIsLoading(false);
      }
    );

    // Manufacturing Units Listener
    const unitsCol = collection(db, "manufacturing_units");
    const qUnits = query(unitsCol, orderBy("name", "asc"));
    const unsubUnits = onSnapshot(
      qUnits,
      (snapshot) => {
        const uList: ManufacturingUnit[] = [];
        snapshot.docs.forEach((d) => {
          uList.push({ id: d.id, name: d.data().name || "Unit" });
        });
        setUnits(uList);
      },
      (err) => console.warn("Units listener error:", err)
    );

    // Products Listener (for unit mapping and piecesPerKg fallback)
    const prodsCol = collection(db, "products");
    const unsubProds = onSnapshot(
      prodsCol,
      (snapshot) => {
        const pMap = new Map<string, ProductInfo>();
        snapshot.docs.forEach((d) => {
          const data = d.data();
          pMap.set(d.id, {
            id: d.id,
            name: data.name || "",
            unit: data.unit || "piece",
            imageUrl: data.imageUrl || "",
            manufacturingUnitId: data.manufacturingUnitId || "",
            manufacturingUnitName: data.manufacturingUnitName || "",
            piecesPerKg: data.piecesPerKg || "",
          });
        });
        setProductsMap(pMap);
      },
      (err) => console.warn("Products listener error:", err)
    );

    return () => {
      unsubOrders();
      unsubUnits();
      unsubProds();
    };
  }, []);

  // Helper: Date filter check
  const matchesDateFilter = useCallback(
    (deliveryDateStr?: string) => {
      if (dateFilter === "all" || !deliveryDateStr) return true;
      const today = new Date().toISOString().split("T")[0];
      const tomorrowDate = new Date();
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const tomorrow = tomorrowDate.toISOString().split("T")[0];

      if (dateFilter === "today") return deliveryDateStr === today;
      if (dateFilter === "tomorrow") return deliveryDateStr === tomorrow;
      if (dateFilter === "this_week") {
        const now = new Date();
        const firstDayOfWeek = new Date(now);
        firstDayOfWeek.setDate(now.getDate() - now.getDay());
        const start = firstDayOfWeek.toISOString().split("T")[0];
        const nextWeek = new Date(now);
        nextWeek.setDate(now.getDate() + 7);
        const end = nextWeek.toISOString().split("T")[0];
        return deliveryDateStr >= start && deliveryDateStr <= end;
      }
      return true;
    },
    [dateFilter]
  );

  // Helper: Normalize item unit assignment
  const getItemManufacturingUnit = useCallback(
    (item: OrderItem): { id: string; name: string } => {
      if (item.manufacturingUnitId) {
        return {
          id: item.manufacturingUnitId,
          name: item.manufacturingUnitName || "Assigned Kitchen",
        };
      }
      const prod = productsMap.get(item.productId);
      if (prod?.manufacturingUnitId) {
        return {
          id: prod.manufacturingUnitId,
          name: prod.manufacturingUnitName || "Kitchen Unit",
        };
      }
      return { id: "unassigned", name: "General Kitchen" };
    },
    [productsMap]
  );

  // Helper: Calculate item weight in KG
  const calculateItemKg = useCallback(
    (item: OrderItem): number => {
      const u = item.unit.toLowerCase().trim();
      const qty = Number(item.quantity) || 0;
      if (u === "kg" || u.includes("kilo") || u === "litre" || u === "liter" || u === "ltr") {
        return qty;
      }
      // If piece, try piecesPerKg
      const prod = productsMap.get(item.productId);
      const ppk = Number(item.piecesPerKg || prod?.piecesPerKg || 0);
      if (ppk > 0) {
        return Number((qty / ppk).toFixed(2));
      }
      return 0;
    },
    [productsMap]
  );

  // --- 2. Filtered Orders & Segregated Items ---
  const relevantOrders = useMemo(() => {
    return orders.filter((order) => {
      if (!order.items || order.items.length === 0) return false;
      // Date filter check
      if (!matchesDateFilter(order.deliveryDate)) return false;
      // Search filter check
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesOrder =
          order.orderNumber.toLowerCase().includes(q) ||
          order.customerName.toLowerCase().includes(q) ||
          order.storeName.toLowerCase().includes(q);
        const matchesAnyItem = order.items.some((i) =>
          i.name.toLowerCase().includes(q)
        );
        if (!matchesOrder && !matchesAnyItem) return false;
      }
      return true;
    });
  }, [orders, matchesDateFilter, searchQuery]);

  // --- 3. Consolidated Item-Wise Groups ---
  const consolidatedGroups: ConsolidatedGroup[] = useMemo(() => {
    const groupMap = new Map<string, ConsolidatedGroup>();

    relevantOrders.forEach((order) => {
      order.items.forEach((item) => {
        const mfgUnit = getItemManufacturingUnit(item);

        // Unit filter check
        if (selectedUnitId !== "all" && mfgUnit.id !== selectedUnitId) {
          return;
        }

        const effectiveStatus: OrderStatus = item.status || order.orderStatus || "Created";

        // Status filter check for manufacturing portal
        if (statusFilter === "active") {
          // Show items that are not yet moved to packing or finished
          if (
            effectiveStatus === "Moved to Packing" ||
            effectiveStatus === "Packing In Progress" ||
            effectiveStatus === "Packing Completed" ||
            effectiveStatus === "Moved to Store" ||
            effectiveStatus === "Delivered"
          ) {
            return;
          }
        } else if (statusFilter === "created") {
          if (effectiveStatus !== "Created") return;
        } else if (statusFilter === "in_progress") {
          if (effectiveStatus !== "Manufacturing In Progress") return;
        } else if (statusFilter === "completed") {
          if (effectiveStatus !== "Manufacturing Completed") return;
        }

        const itemKg = calculateItemKg(item);
        const groupKey = `${item.productId || item.name}_${mfgUnit.id}`;

        const breakdownEntry: ConsolidatedItemBreakdown = {
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          storeName: order.storeName,
          deliveryDate: order.deliveryDate,
          deliveryTime: order.deliveryTime,
          packingDescription: order.packingDescription,
          lineId: item.id,
          quantity: item.quantity,
          unit: item.unit,
          calculatedKg: itemKg,
          manufacturingDescription: item.manufacturingDescription || "",
          status: effectiveStatus,
        };

        if (groupMap.has(groupKey)) {
          const g = groupMap.get(groupKey)!;
          g.totalQuantity += item.quantity;
          g.totalKg += itemKg;
          g.ordersCount += 1;
          g.items.push(breakdownEntry);

          if (effectiveStatus === "Created") g.statusSummary.created += 1;
          else if (effectiveStatus === "Manufacturing In Progress") g.statusSummary.inProgress += 1;
          else if (effectiveStatus === "Manufacturing Completed") g.statusSummary.completed += 1;
          else g.statusSummary.movedToPacking += 1;
        } else {
          const prod = productsMap.get(item.productId);
          groupMap.set(groupKey, {
            productId: item.productId || item.name,
            productName: item.name,
            imageUrl: item.imageUrl || prod?.imageUrl || "",
            unit: item.unit,
            manufacturingUnitId: mfgUnit.id,
            manufacturingUnitName: mfgUnit.name,
            totalQuantity: item.quantity,
            totalKg: itemKg,
            ordersCount: 1,
            items: [breakdownEntry],
            statusSummary: {
              created: effectiveStatus === "Created" ? 1 : 0,
              inProgress: effectiveStatus === "Manufacturing In Progress" ? 1 : 0,
              completed: effectiveStatus === "Manufacturing Completed" ? 1 : 0,
              movedToPacking:
                effectiveStatus === "Moved to Packing" ||
                effectiveStatus === "Packing Completed"
                  ? 1
                  : 0,
            },
          });
        }
      });
    });

    return Array.from(groupMap.values()).sort((a, b) => b.totalKg - a.totalKg);
  }, [
    relevantOrders,
    selectedUnitId,
    statusFilter,
    getItemManufacturingUnit,
    calculateItemKg,
    productsMap,
  ]);

  // Overall Production Metrics
  const metrics = useMemo(() => {
    let totalActiveKg = 0;
    let totalActivePcs = 0;
    let createdCount = 0;
    let inProgressCount = 0;
    let completedCount = 0;

    consolidatedGroups.forEach((g) => {
      totalActiveKg += g.totalKg;
      if (g.unit.toLowerCase() === "piece" || g.unit.toLowerCase() === "box") {
        totalActivePcs += g.totalQuantity;
      }
      createdCount += g.statusSummary.created;
      inProgressCount += g.statusSummary.inProgress;
      completedCount += g.statusSummary.completed;
    });

    return {
      totalActiveKg: Number(totalActiveKg.toFixed(2)),
      totalActivePcs,
      createdCount,
      inProgressCount,
      completedCount,
    };
  }, [consolidatedGroups]);

  // Toggle expanded accordion for item breakdown
  const toggleExpand = (productId: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  // Expand all / Collapse all
  const handleToggleAllAccordions = () => {
    if (expandedProducts.size > 0) {
      setExpandedProducts(new Set());
    } else {
      setExpandedProducts(new Set(consolidatedGroups.map((g) => g.productId)));
    }
  };

  // --- 4. Firestore Status Advancements ---

  // Helper to recompute overall order status based on item statuses
  const computeOverallOrderStatus = (items: OrderItem[]): OrderStatus => {
    if (items.length === 0) return "Created";
    const statuses = items.map((i) => i.status || "Created");

    if (statuses.every((s) => s === "Delivered")) return "Delivered";
    if (statuses.every((s) => s === "Received at Store" || s === "Delivered")) return "Received at Store";
    if (statuses.every((s) => s === "Moved to Store" || s === "Received at Store" || s === "Delivered")) return "Moved to Store";
    if (statuses.every((s) => s === "Packing Completed")) return "Packing Completed";
    if (statuses.some((s) => s === "Packing In Progress")) return "Packing In Progress";
    if (statuses.some((s) => s === "Received at Packing")) return "Received at Packing";
    if (statuses.every((s) => s === "Moved to Packing" || s === "Received at Packing" || s === "Packing In Progress" || s === "Packing Completed")) return "Moved to Packing";
    if (statuses.every((s) => s === "Manufacturing Completed" || s === "Moved to Packing")) return "Manufacturing Completed";
    if (statuses.some((s) => s === "Manufacturing In Progress")) return "Manufacturing In Progress";
    return "Created";
  };

  // Advance single item status
  const handleUpdateItemStatus = async (
    orderId: string,
    lineId: string,
    targetStatus: OrderStatus,
    sweetName?: string
  ) => {
    const actionKey = `${orderId}_${lineId}_${targetStatus}`;
    setIsUpdating(actionKey);
    try {
      const targetOrder = orders.find((o) => o.id === orderId);
      if (!targetOrder) throw new Error("Order not found");

      const updatedItems = targetOrder.items.map((item) =>
        item.id === lineId ? { ...item, status: targetStatus } : item
      );

      const newOrderStatus = computeOverallOrderStatus(updatedItems);

      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        items: updatedItems,
        orderStatus: newOrderStatus,
        updatedAt: serverTimestamp(),
      });

      showToast(
        `${sweetName || "Item"} updated to "${targetStatus}"!`,
        "success"
      );
    } catch (err: any) {
      console.error("Update item status error:", err);
      showToast("Error updating status: " + err.message, "error");
    } finally {
      setIsUpdating(null);
    }
  };

  // Bulk advance all order-lines in a consolidated sweet group
  const handleBulkUpdateGroupStatus = async (
    group: ConsolidatedGroup,
    targetStatus: OrderStatus
  ) => {
    const bulkKey = `bulk_${group.productId}_${targetStatus}`;
    setIsUpdating(bulkKey);
    try {
      // Group items by orderId to perform 1 write per order
      const orderUpdatesMap = new Map<string, string[]>(); // orderId -> lineIds
      group.items.forEach((item) => {
        if (item.status !== targetStatus) {
          const lines = orderUpdatesMap.get(item.orderId) || [];
          lines.push(item.lineId);
          orderUpdatesMap.set(item.orderId, lines);
        }
      });

      const promises = Array.from(orderUpdatesMap.entries()).map(
        async ([orderId, lineIds]) => {
          const targetOrder = orders.find((o) => o.id === orderId);
          if (!targetOrder) return;
          const lineIdSet = new Set(lineIds);
          const updatedItems = targetOrder.items.map((i) =>
            lineIdSet.has(i.id) ? { ...i, status: targetStatus } : i
          );
          const newOrderStatus = computeOverallOrderStatus(updatedItems);
          const orderRef = doc(db, "orders", orderId);
          return updateDoc(orderRef, {
            items: updatedItems,
            orderStatus: newOrderStatus,
            updatedAt: serverTimestamp(),
          });
        }
      );

      await Promise.all(promises);
      showToast(
        `All ${group.items.length} orders for "${group.productName}" advanced to "${targetStatus}"!`,
        "success"
      );
    } catch (err: any) {
      showToast("Error in bulk update: " + err.message, "error");
    } finally {
      setIsUpdating(null);
    }
  };

  // Advance Whole Order at once
  const handleUpdateWholeOrder = async (
    orderId: string,
    targetStatus: OrderStatus
  ) => {
    setIsUpdating(`order_${orderId}_${targetStatus}`);
    try {
      const targetOrder = orders.find((o) => o.id === orderId);
      if (!targetOrder) throw new Error("Order not found");

      // Update all items in this order to targetStatus
      const updatedItems = targetOrder.items.map((i) => ({
        ...i,
        status: targetStatus,
      }));

      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        items: updatedItems,
        orderStatus: targetStatus,
        updatedAt: serverTimestamp(),
      });

      showToast(
        `Order #${targetOrder.orderNumber} moved entirely to "${targetStatus}"!`,
        "success"
      );
    } catch (err: any) {
      showToast("Error updating whole order: " + err.message, "error");
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-49px)] w-full overflow-hidden bg-slate-50/50">
      {/* 1. Header & Live Metric Bar */}
      <div
        className="px-6 py-3 border-b bg-white flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xs"
        style={{ borderColor: "var(--color-border-subtle)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center border bg-orange-50/80 text-orange-600 shadow-2xs"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            <Factory size={22} className="stroke-[1.8]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1
                className="text-base tracking-tight text-slate-900"
                style={{ fontWeight: 500 }}
              >
                Manufacturing Portal
              </h1>
              <span className="px-2 py-0.5 text-[10px] rounded bg-orange-100/70 text-orange-700 font-mono font-medium border border-orange-200 uppercase tracking-wide">
                KITCHEN DISPLAY (KDS)
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live factory kitchen queue: consolidate batch KGs, track sweet preparation, and dispatch to packing
            </p>
          </div>
        </div>

        {/* Live Metrics Pills */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-slate-50/80 border-slate-200 shadow-2xs">
            <Flame size={14} className="text-orange-500" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase font-mono">Total KGs Needed</span>
              <span className="font-semibold text-slate-800 text-xs font-mono">
                {metrics.totalActiveKg} KG
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-sky-50/60 border-sky-200 text-sky-800 shadow-2xs">
            <Clock size={14} className="text-sky-600" />
            <div className="flex flex-col">
              <span className="text-[10px] text-sky-600 uppercase font-mono">In Progress</span>
              <span className="font-semibold text-xs font-mono">
                {metrics.inProgressCount} items
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-emerald-50/60 border-emerald-200 text-emerald-800 shadow-2xs">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <div className="flex flex-col">
              <span className="text-[10px] text-emerald-600 uppercase font-mono">Ready to Move</span>
              <span className="font-semibold text-xs font-mono">
                {metrics.completedCount} items
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Interactive Control Bar: Unit Selector, View Mode, Filters, Search */}
      <div
        className="px-6 py-2.5 border-b bg-white flex flex-wrap items-center justify-between gap-3 shrink-0"
        style={{ borderColor: "var(--color-border-subtle)" }}
      >
        {/* Left: Manufacturing Unit Selector + Tab Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Manufacturing Unit Selector */}
          <div className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg p-1">
            <span className="text-[11px] font-medium text-slate-500 px-1 flex items-center gap-1">
              <ChefHat size={13} className="text-orange-500" />
              Kitchen:
            </span>
            <select
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              className="bg-white border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-orange-400 cursor-pointer shadow-2xs"
            >
              <option value="all">All Manufacturing Units</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle: Consolidated vs Order-Wise */}
          <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-100 shadow-2xs text-xs">
            <button
              onClick={() => setSelectedTab("consolidated")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all font-medium cursor-pointer ${
                selectedTab === "consolidated"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers size={13} className={selectedTab === "consolidated" ? "text-orange-600" : ""} />
              <span>Consolidated (Item-Wise)</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 font-mono">
                {consolidatedGroups.length}
              </span>
            </button>
            <button
              onClick={() => setSelectedTab("order_wise")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all font-medium cursor-pointer ${
                selectedTab === "order_wise"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ListOrdered size={13} className={selectedTab === "order_wise" ? "text-orange-600" : ""} />
              <span>Order-Wise</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 font-mono">
                {relevantOrders.length}
              </span>
            </button>
          </div>
        </div>

        {/* Right: Date Filter, Status Filter & Search */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Date Filter Pills */}
          <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-white shadow-2xs">
            {(
              [
                { id: "today", label: "Today" },
                { id: "tomorrow", label: "Tomorrow" },
                { id: "this_week", label: "This Week" },
                { id: "all", label: "All Dates" },
              ] as { id: DateFilter; label: string }[]
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setDateFilter(f.id)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  dateFilter === f.id
                    ? "bg-orange-500 text-white shadow-2xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-orange-400 cursor-pointer shadow-2xs"
          >
            <option value="active">Active Production Queue</option>
            <option value="created">To Make (Created)</option>
            <option value="in_progress">Manufacturing In Progress</option>
            <option value="completed">Manufacturing Completed</option>
            <option value="all">All Statuses (Incl. Moved to Packing)</option>
          </select>

          {/* Search Box */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white shadow-2xs w-48 sm:w-56 focus-within:ring-1 focus-within:ring-orange-400">
            <Search size={13} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search sweet, order #, store..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-transparent focus:outline-none text-slate-800"
            />
          </div>

          {selectedTab === "consolidated" && consolidatedGroups.length > 0 && (
            <button
              onClick={handleToggleAllAccordions}
              className="px-2.5 py-1 text-[11px] rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer shadow-2xs"
              title="Expand or collapse all order breakdowns"
            >
              {expandedProducts.size > 0 ? "Collapse All" : "Expand All"}
            </button>
          )}
        </div>
      </div>

      {/* 3. Main Workspace Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 size={26} className="animate-spin text-orange-500" />
            <span className="text-xs font-mono">Syncing kitchen production queue...</span>
          </div>
        ) : selectedTab === "consolidated" ? (
          // ================= VIEW A: CONSOLIDATED (ITEM-WISE) =================
          consolidatedGroups.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200 p-8">
              <CheckCircle2 size={32} className="text-emerald-400 stroke-[1.5]" />
              <span className="text-sm font-medium text-slate-700">All Kitchen Tasks Cleared</span>
              <span className="text-xs text-slate-400 text-center max-w-sm">
                No sweet batches pending for {dateFilter === "today" ? "today's delivery schedule" : "the selected filters"}. New orders created in the Orders page will appear here live.
              </span>
            </div>
          ) : (
            <div className="space-y-3.5 w-full">
              {consolidatedGroups.map((group) => {
                const isExpanded = expandedProducts.has(group.productId);
                const hasPendingInGroup = group.items.some(
                  (i) => i.status === "Created"
                );
                const hasInProgressInGroup = group.items.some(
                  (i) => i.status === "Manufacturing In Progress"
                );
                const hasCompletedInGroup = group.items.some(
                  (i) => i.status === "Manufacturing Completed"
                );

                return (
                  <div
                    key={`${group.productId}_${group.manufacturingUnitId}`}
                    className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all hover:border-slate-300"
                  >
                    {/* Consolidated Sweet Card Header */}
                    <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
                      {/* Left: Product Info & Unit */}
                      <div className="flex items-center gap-3.5 min-w-[260px]">
                        <div className="w-13 h-13 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                          {group.imageUrl ? (
                            <img
                              src={group.imageUrl}
                              alt={group.productName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Boxes size={22} className="text-slate-300" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                              {group.productName}
                            </h3>
                            <span className="px-2 py-0.5 text-[10px] rounded-full bg-orange-50 text-orange-700 font-mono border border-orange-200">
                              {group.manufacturingUnitName}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-mono">
                            <span>
                              {group.ordersCount} {group.ordersCount === 1 ? "order" : "orders"}
                            </span>
                            <span>•</span>
                            <span className="text-slate-400">
                              {group.items.map((i) => `#${i.orderNumber.slice(-6)}`).join(", ")}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Center: Consolidated Batch Preparation Volume */}
                      <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl shadow-2xs">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">
                            Batch Volume To Prepare
                          </span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-xl font-bold font-mono text-orange-600">
                              {group.totalKg > 0
                                ? `${group.totalKg.toFixed(2)} KG`
                                : `${group.totalQuantity} ${group.unit}`}
                            </span>
                            {group.unit.toLowerCase() === "piece" && group.totalKg > 0 && (
                              <span className="text-xs text-slate-500 font-mono">
                                ({group.totalQuantity} pieces)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status Breakdown Indicator */}
                        <div className="hidden sm:flex flex-col gap-1 border-l border-slate-200 pl-3">
                          <div className="flex items-center gap-2 text-[11px]">
                            {group.statusSummary.created > 0 && (
                              <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-mono text-[10px]">
                                {group.statusSummary.created} to make
                              </span>
                            )}
                            {group.statusSummary.inProgress > 0 && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-mono text-[10px]">
                                {group.statusSummary.inProgress} cooking
                              </span>
                            )}
                            {group.statusSummary.completed > 0 && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px]">
                                {group.statusSummary.completed} ready
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Bulk Action Group Buttons & Accordion Toggle */}
                      <div className="flex items-center gap-2">
                        {/* Start All */}
                        {hasPendingInGroup && (
                          <button
                            onClick={() =>
                              handleBulkUpdateGroupStatus(
                                group,
                                "Manufacturing In Progress"
                              )
                            }
                            disabled={isUpdating !== null}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                            title="Start cooking for all orders requiring this sweet"
                          >
                            <Play size={13} />
                            <span>Start All ({group.statusSummary.created})</span>
                          </button>
                        )}

                        {/* Complete All */}
                        {hasInProgressInGroup && (
                          <button
                            onClick={() =>
                              handleBulkUpdateGroupStatus(
                                group,
                                "Manufacturing Completed"
                              )
                            }
                            disabled={isUpdating !== null}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                            title="Mark manufacturing complete for all in-progress batches"
                          >
                            <Check size={13} />
                            <span>Mark Completed ({group.statusSummary.inProgress})</span>
                          </button>
                        )}

                        {/* Move All to Packing */}
                        {hasCompletedInGroup && (
                          <button
                            onClick={() =>
                              handleBulkUpdateGroupStatus(
                                group,
                                "Moved to Packing"
                              )
                            }
                            disabled={isUpdating !== null}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                            title="Move finished sweets to Packing Station"
                          >
                            <Send size={13} />
                            <span>Move to Packing ({group.statusSummary.completed})</span>
                          </button>
                        )}

                        {/* Accordion Expand/Collapse */}
                        <button
                          onClick={() => toggleExpand(group.productId)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors text-xs font-medium cursor-pointer shadow-2xs ml-1"
                        >
                          <span>Order Breakdown</span>
                          {isExpanded ? (
                            <ChevronDown size={14} className="text-slate-400" />
                          ) : (
                            <ChevronRight size={14} className="text-slate-400" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Order Breakdown Sub-List Accordion */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/70 p-4 divide-y divide-slate-200/60">
                        <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider pb-2 flex items-center justify-between">
                          <span>Specific Customer Orders for {group.productName}:</span>
                          <span>Advance individual order batches below</span>
                        </div>

                        {group.items.map((breakdown) => {
                          const isItemUpdating =
                            isUpdating ===
                              `${breakdown.orderId}_${breakdown.lineId}_Manufacturing In Progress` ||
                            isUpdating ===
                              `${breakdown.orderId}_${breakdown.lineId}_Manufacturing Completed` ||
                            isUpdating ===
                              `${breakdown.orderId}_${breakdown.lineId}_Moved to Packing`;

                          return (
                            <div
                              key={`${breakdown.orderId}_${breakdown.lineId}`}
                              className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                            >
                              {/* Order & Customer Details */}
                              <div className="flex items-center gap-3 min-w-[280px]">
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                                      #{breakdown.orderNumber}
                                    </span>
                                    <span className="font-medium text-slate-800">
                                      {breakdown.customerName}
                                    </span>
                                    {breakdown.customerPhone && (
                                      <span className="text-[11px] font-mono text-slate-400">
                                        ({breakdown.customerPhone})
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 font-mono">
                                    <span className="flex items-center gap-1">
                                      <Store size={11} className="text-slate-400" />
                                      {breakdown.storeName}
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1 text-orange-600 font-medium">
                                      <Calendar size={11} />
                                      {breakdown.deliveryDate} at {breakdown.deliveryTime}
                                    </span>
                                  </div>

                                  {/* Kitchen instructions note */}
                                  {breakdown.manufacturingDescription && (
                                    <div className="mt-1 flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[11px]">
                                      <Info size={11} className="text-amber-600 shrink-0" />
                                      <span>
                                        <strong>Chef Note:</strong> {breakdown.manufacturingDescription}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Quantity Needed */}
                              <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-slate-200 font-mono">
                                <span className="text-xs font-bold text-slate-900">
                                  {breakdown.quantity} {breakdown.unit}
                                </span>
                                {breakdown.calculatedKg > 0 &&
                                  breakdown.unit.toLowerCase() !== "kg" && (
                                    <span className="text-[11px] text-slate-500">
                                      (~{breakdown.calculatedKg} KG)
                                    </span>
                                  )}
                              </div>

                              {/* Current Status Badge */}
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                    breakdown.status === "Manufacturing In Progress"
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : breakdown.status === "Manufacturing Completed"
                                      ? "bg-purple-50 text-purple-700 border-purple-200"
                                      : breakdown.status === "Moved to Packing"
                                      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                      : "bg-slate-100 text-slate-700 border-slate-200"
                                  }`}
                                >
                                  {breakdown.status}
                                </span>
                              </div>

                              {/* Item Action Buttons */}
                              <div className="flex items-center gap-2">
                                {breakdown.status === "Created" && (
                                  <button
                                    onClick={() =>
                                      handleUpdateItemStatus(
                                        breakdown.orderId,
                                        breakdown.lineId,
                                        "Manufacturing In Progress",
                                        group.productName
                                      )
                                    }
                                    disabled={isItemUpdating}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-medium transition-colors cursor-pointer shadow-2xs"
                                  >
                                    <Play size={11} />
                                    <span>Start Making</span>
                                  </button>
                                )}

                                {breakdown.status === "Manufacturing In Progress" && (
                                  <button
                                    onClick={() =>
                                      handleUpdateItemStatus(
                                        breakdown.orderId,
                                        breakdown.lineId,
                                        "Manufacturing Completed",
                                        group.productName
                                      )
                                    }
                                    disabled={isItemUpdating}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium transition-colors cursor-pointer shadow-2xs"
                                  >
                                    <Check size={11} />
                                    <span>Mark Completed</span>
                                  </button>
                                )}

                                {breakdown.status === "Manufacturing Completed" && (
                                  <button
                                    onClick={() =>
                                      handleUpdateItemStatus(
                                        breakdown.orderId,
                                        breakdown.lineId,
                                        "Moved to Packing",
                                        group.productName
                                      )
                                    }
                                    disabled={isItemUpdating}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-medium transition-colors cursor-pointer shadow-2xs"
                                  >
                                    <Send size={11} />
                                    <span>Move to Packing</span>
                                  </button>
                                )}

                                {breakdown.status === "Moved to Packing" && (
                                  <span className="text-[11px] text-indigo-600 flex items-center gap-1 font-mono font-medium">
                                    <CheckCircle2 size={13} />
                                    Sent to Packing Unit
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          // ================= VIEW B: ORDER-WISE =================
          relevantOrders.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200 p-8">
              <CheckCircle2 size={32} className="text-emerald-400 stroke-[1.5]" />
              <span className="text-sm font-medium text-slate-700">No Orders in Queue</span>
              <span className="text-xs text-slate-400">
                No orders match your current filters.
              </span>
            </div>
          ) : (
            <div className="space-y-4 w-full">
              {relevantOrders.map((order) => {
                // Filter items for selected manufacturing unit
                const assignedItems = order.items.filter((item) => {
                  const mfgUnit = getItemManufacturingUnit(item);
                  if (selectedUnitId !== "all" && mfgUnit.id !== selectedUnitId) {
                    return false;
                  }
                  return true;
                });

                if (assignedItems.length === 0) return null;

                const isWholeOrderUpdating =
                  isUpdating?.startsWith(`order_${order.id}`) || false;

                const isAllCompleted = assignedItems.every(
                  (i) => i.status === "Manufacturing Completed"
                );
                const isAllMoved = assignedItems.every(
                  (i) => i.status === "Moved to Packing"
                );

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden"
                  >
                    {/* Order Header */}
                    <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-sm text-slate-900 bg-white px-2.5 py-1 rounded border border-slate-200 shadow-2xs">
                          #{order.orderNumber}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800 text-xs">
                              {order.customerName}
                            </span>
                            {order.customerPhone && (
                              <span className="text-[11px] font-mono text-slate-400">
                                • {order.customerPhone}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Store size={11} className="text-slate-400" />
                              {order.storeName}
                            </span>
                            <span>•</span>
                            <span className="text-orange-600 font-medium">
                              Delivery: {order.deliveryDate} at {order.deliveryTime}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Whole Order Actions */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${
                            order.orderStatus === "Manufacturing In Progress"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : order.orderStatus === "Manufacturing Completed"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : order.orderStatus === "Moved to Packing"
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {order.orderStatus}
                        </span>

                        {/* Whole order buttons */}
                        {order.orderStatus === "Created" && (
                          <button
                            onClick={() =>
                              handleUpdateWholeOrder(
                                order.id,
                                "Manufacturing In Progress"
                              )
                            }
                            disabled={isWholeOrderUpdating}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                          >
                            <Play size={12} />
                            <span>Start Whole Order</span>
                          </button>
                        )}

                        {order.orderStatus === "Manufacturing In Progress" && (
                          <button
                            onClick={() =>
                              handleUpdateWholeOrder(
                                order.id,
                                "Manufacturing Completed"
                              )
                            }
                            disabled={isWholeOrderUpdating}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                          >
                            <Check size={12} />
                            <span>Complete Whole Order</span>
                          </button>
                        )}

                        {order.orderStatus === "Manufacturing Completed" && (
                          <button
                            onClick={() =>
                              handleUpdateWholeOrder(
                                order.id,
                                "Moved to Packing"
                              )
                            }
                            disabled={isWholeOrderUpdating}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                          >
                            <Send size={12} />
                            <span>Move Whole Order to Packing</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Order Items Table */}
                    <div className="p-4 overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-[11px] text-slate-500 uppercase font-mono">
                            <th className="py-2 px-3">Item Name</th>
                            <th className="py-2 px-3">Kitchen Unit</th>
                            <th className="py-2 px-3 text-right">Quantity</th>
                            <th className="py-2 px-3">Chef / Recipe Note</th>
                            <th className="py-2 px-3 text-center">Status</th>
                            <th className="py-2 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {assignedItems.map((item) => {
                            const mfgUnit = getItemManufacturingUnit(item);
                            const itemStatus = item.status || order.orderStatus || "Created";
                            const itemKg = calculateItemKg(item);

                            return (
                              <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="py-2.5 px-3 font-medium text-slate-900 flex items-center gap-2">
                                  {item.imageUrl && (
                                    <img
                                      src={item.imageUrl}
                                      alt={item.name}
                                      className="w-7 h-7 rounded object-cover border border-slate-200 shrink-0"
                                    />
                                  )}
                                  <span>{item.name}</span>
                                </td>

                                <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px]">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                                    {mfgUnit.name}
                                  </span>
                                </td>

                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                                  {item.quantity} {item.unit}
                                  {itemKg > 0 && item.unit.toLowerCase() !== "kg" && (
                                    <span className="block text-[10px] text-slate-400 font-normal">
                                      ~{itemKg} KG
                                    </span>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                                  {item.manufacturingDescription ? (
                                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 font-mono">
                                      {item.manufacturingDescription}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                      itemStatus === "Manufacturing In Progress"
                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                        : itemStatus === "Manufacturing Completed"
                                        ? "bg-purple-50 text-purple-700 border-purple-200"
                                        : itemStatus === "Moved to Packing"
                                        ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                        : "bg-slate-100 text-slate-700 border-slate-200"
                                    }`}
                                  >
                                    {itemStatus}
                                  </span>
                                </td>

                                <td className="py-2.5 px-3 text-right">
                                  {itemStatus === "Created" && (
                                    <button
                                      onClick={() =>
                                        handleUpdateItemStatus(
                                          order.id,
                                          item.id,
                                          "Manufacturing In Progress",
                                          item.name
                                        )
                                      }
                                      className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-medium cursor-pointer transition-colors shadow-2xs"
                                    >
                                      Start
                                    </button>
                                  )}
                                  {itemStatus === "Manufacturing In Progress" && (
                                    <button
                                      onClick={() =>
                                        handleUpdateItemStatus(
                                          order.id,
                                          item.id,
                                          "Manufacturing Completed",
                                          item.name
                                        )
                                      }
                                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium cursor-pointer transition-colors shadow-2xs"
                                    >
                                      Done
                                    </button>
                                  )}
                                  {itemStatus === "Manufacturing Completed" && (
                                    <button
                                      onClick={() =>
                                        handleUpdateItemStatus(
                                          order.id,
                                          item.id,
                                          "Moved to Packing",
                                          item.name
                                        )
                                      }
                                      className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-medium cursor-pointer transition-colors shadow-2xs"
                                    >
                                      Move to Packing
                                    </button>
                                  )}
                                  {itemStatus === "Moved to Packing" && (
                                    <span className="text-[11px] text-indigo-600 font-mono font-medium">
                                      At Packing
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
