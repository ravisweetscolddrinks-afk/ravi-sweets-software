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
  Boxes,
  Layers,
  ListOrdered,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ArrowRight,
  RotateCw,
  Loader2,
  Calendar,
  Store,
  User,
  Phone,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Play,
  Check,
  Send,
  PackageCheck,
  Truck,
  Printer,
  Info,
  Gift,
} from "lucide-react";
import { OrderRecord, OrderItem, OrderStatus } from "@/types/order";

interface PackingUnit {
  id: string;
  name: string;
}

interface ProductInfo {
  id: string;
  name: string;
  unit: string;
  imageUrl?: string;
  packingUnitId?: string;
  packingUnitName?: string;
  piecesPerKg?: number | string;
}

interface ConsolidatedPackingBreakdown {
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

interface ConsolidatedPackingGroup {
  productId: string;
  productName: string;
  imageUrl?: string;
  unit: string;
  packingUnitId: string;
  packingUnitName: string;
  totalQuantity: number;
  totalKg: number;
  ordersCount: number;
  items: ConsolidatedPackingBreakdown[];
  statusSummary: {
    movedToPacking: number;
    receivedAtPacking: number;
    packingInProgress: number;
    packingCompleted: number;
    movedToStore: number;
  };
}

type TabMode = "consolidated" | "order_wise";
type PackingStatusFilter =
  | "active"
  | "moved_to_packing"
  | "received"
  | "in_progress"
  | "completed"
  | "all";
type DateFilter = "all" | "today" | "tomorrow" | "this_week";

export default function PackingPortalPage() {
  const { showToast } = useToast();

  // Data states
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [units, setUnits] = useState<PackingUnit[]>([]);
  const [productsMap, setProductsMap] = useState<Map<string, ProductInfo>>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // Filters
  const [selectedUnitId, setSelectedUnitId] = useState<string>("all");
  const [selectedTab, setSelectedTab] = useState<TabMode>("consolidated");
  const [statusFilter, setStatusFilter] = useState<PackingStatusFilter>("active");
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  // 1. Real-time Subscription to Orders, Packing Units, and Products
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

    // Packing Units Listener
    const unitsCol = collection(db, "packing_units");
    const qUnits = query(unitsCol, orderBy("name", "asc"));
    const unsubUnits = onSnapshot(
      qUnits,
      (snapshot) => {
        const uList: PackingUnit[] = [];
        snapshot.docs.forEach((d) => {
          uList.push({ id: d.id, name: d.data().name || "Unit" });
        });
        setUnits(uList);
      },
      (err) => console.warn("Packing units listener error:", err)
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
            packingUnitId: data.packingUnitId || "",
            packingUnitName: data.packingUnitName || "",
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

  // Helper: Normalize item packing unit assignment
  const getItemPackingUnit = useCallback(
    (item: OrderItem): { id: string; name: string } => {
      if (item.packingUnitId) {
        return {
          id: item.packingUnitId,
          name: item.packingUnitName || "Main Packing Unit",
        };
      }
      const prod = productsMap.get(item.productId);
      if (prod?.packingUnitId) {
        return {
          id: prod.packingUnitId,
          name: prod.packingUnitName || "Packing Station",
        };
      }
      return { id: "unassigned", name: "Main Packing Unit" };
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
      const prod = productsMap.get(item.productId);
      const ppk = Number(item.piecesPerKg || prod?.piecesPerKg || 0);
      if (ppk > 0) {
        return Number((qty / ppk).toFixed(2));
      }
      return 0;
    },
    [productsMap]
  );

  // --- 2. Filtered Orders for Packing ---
  // In packing portal, orders/items must have reached "Moved to Packing" or later
  const relevantOrders = useMemo(() => {
    return orders.filter((order) => {
      if (!order.items || order.items.length === 0) return false;
      if (!matchesDateFilter(order.deliveryDate)) return false;

      // Search filter check
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesOrder =
          order.orderNumber.toLowerCase().includes(q) ||
          order.customerName.toLowerCase().includes(q) ||
          order.storeName.toLowerCase().includes(q) ||
          (order.packingDescription && order.packingDescription.toLowerCase().includes(q));
        const matchesAnyItem = order.items.some((i) =>
          i.name.toLowerCase().includes(q)
        );
        if (!matchesOrder && !matchesAnyItem) return false;
      }

      // Check if at least one item or the order has arrived at packing
      const hasReachedPacking = order.items.some((i) => {
        const st = i.status || order.orderStatus;
        return (
          st === "Moved to Packing" ||
          st === "Received at Packing" ||
          st === "Packing In Progress" ||
          st === "Packing Completed" ||
          st === "Moved to Store" ||
          st === "Delivered"
        );
      });

      return hasReachedPacking;
    });
  }, [orders, matchesDateFilter, searchQuery]);

  // --- 3. Consolidated Item-Wise Groups for Packing ---
  const consolidatedGroups: ConsolidatedPackingGroup[] = useMemo(() => {
    const groupMap = new Map<string, ConsolidatedPackingGroup>();

    relevantOrders.forEach((order) => {
      order.items.forEach((item) => {
        const pkgUnit = getItemPackingUnit(item);

        // Unit filter check
        if (selectedUnitId !== "all" && pkgUnit.id !== selectedUnitId) {
          return;
        }

        const effectiveStatus: OrderStatus = item.status || order.orderStatus || "Created";

        // Must be in packing phase
        const isPackingPhase =
          effectiveStatus === "Moved to Packing" ||
          effectiveStatus === "Received at Packing" ||
          effectiveStatus === "Packing In Progress" ||
          effectiveStatus === "Packing Completed" ||
          effectiveStatus === "Moved to Store" ||
          effectiveStatus === "Delivered";

        if (!isPackingPhase) return;

        // Status filter check
        if (statusFilter === "active") {
          if (effectiveStatus === "Moved to Store" || effectiveStatus === "Delivered") return;
        } else if (statusFilter === "moved_to_packing") {
          if (effectiveStatus !== "Moved to Packing") return;
        } else if (statusFilter === "received") {
          if (effectiveStatus !== "Received at Packing") return;
        } else if (statusFilter === "in_progress") {
          if (effectiveStatus !== "Packing In Progress") return;
        } else if (statusFilter === "completed") {
          if (effectiveStatus !== "Packing Completed") return;
        }

        const itemKg = calculateItemKg(item);
        const groupKey = `${item.productId || item.name}_${pkgUnit.id}`;

        const breakdownEntry: ConsolidatedPackingBreakdown = {
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

          if (effectiveStatus === "Moved to Packing") g.statusSummary.movedToPacking += 1;
          else if (effectiveStatus === "Received at Packing") g.statusSummary.receivedAtPacking += 1;
          else if (effectiveStatus === "Packing In Progress") g.statusSummary.packingInProgress += 1;
          else if (effectiveStatus === "Packing Completed") g.statusSummary.packingCompleted += 1;
          else g.statusSummary.movedToStore += 1;
        } else {
          const prod = productsMap.get(item.productId);
          groupMap.set(groupKey, {
            productId: item.productId || item.name,
            productName: item.name,
            imageUrl: item.imageUrl || prod?.imageUrl || "",
            unit: item.unit,
            packingUnitId: pkgUnit.id,
            packingUnitName: pkgUnit.name,
            totalQuantity: item.quantity,
            totalKg: itemKg,
            ordersCount: 1,
            items: [breakdownEntry],
            statusSummary: {
              movedToPacking: effectiveStatus === "Moved to Packing" ? 1 : 0,
              receivedAtPacking: effectiveStatus === "Received at Packing" ? 1 : 0,
              packingInProgress: effectiveStatus === "Packing In Progress" ? 1 : 0,
              packingCompleted: effectiveStatus === "Packing Completed" ? 1 : 0,
              movedToStore:
                effectiveStatus === "Moved to Store" || effectiveStatus === "Delivered" ? 1 : 0,
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
    getItemPackingUnit,
    calculateItemKg,
    productsMap,
  ]);

  // Overall Packing Metrics
  const metrics = useMemo(() => {
    let totalKgToPack = 0;
    let pendingArrival = 0;
    let receivedCount = 0;
    let inProgressCount = 0;
    let completedCount = 0;

    consolidatedGroups.forEach((g) => {
      totalKgToPack += g.totalKg;
      pendingArrival += g.statusSummary.movedToPacking;
      receivedCount += g.statusSummary.receivedAtPacking;
      inProgressCount += g.statusSummary.packingInProgress;
      completedCount += g.statusSummary.packingCompleted;
    });

    return {
      totalKgToPack: Number(totalKgToPack.toFixed(2)),
      pendingArrival,
      receivedCount,
      inProgressCount,
      completedCount,
    };
  }, [consolidatedGroups]);

  // Toggle expanded accordion
  const toggleExpand = (productId: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  // Expand / Collapse all
  const handleToggleAllAccordions = () => {
    if (expandedProducts.size > 0) {
      setExpandedProducts(new Set());
    } else {
      setExpandedProducts(new Set(consolidatedGroups.map((g) => g.productId)));
    }
  };

  // --- 4. Firestore Status Advancements ---

  // Helper: Compute overall order status based on item statuses
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

  // Advance single item status in packing
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
    group: ConsolidatedPackingGroup,
    targetStatus: OrderStatus
  ) => {
    const bulkKey = `bulk_pack_${group.productId}_${targetStatus}`;
    setIsUpdating(bulkKey);
    try {
      const orderUpdatesMap = new Map<string, string[]>();
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

  // Advance Whole Order at once in packing
  const handleUpdateWholeOrder = async (
    orderId: string,
    targetStatus: OrderStatus
  ) => {
    setIsUpdating(`order_pack_${orderId}_${targetStatus}`);
    try {
      const targetOrder = orders.find((o) => o.id === orderId);
      if (!targetOrder) throw new Error("Order not found");

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
        `Order #${targetOrder.orderNumber} advanced entirely to "${targetStatus}"!`,
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
            className="w-10 h-10 rounded-xl flex items-center justify-center border bg-indigo-50/80 text-indigo-600 shadow-2xs"
            style={{ borderColor: "var(--color-border-base)" }}
          >
            <Boxes size={22} className="stroke-[1.8]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1
                className="text-base tracking-tight text-slate-900"
                style={{ fontWeight: 500 }}
              >
                Packing Portal
              </h1>
              <span className="px-2 py-0.5 text-[10px] rounded bg-indigo-100/70 text-indigo-700 font-mono font-medium border border-indigo-200 uppercase tracking-wide">
                PACKAGING & DISPATCH STATION
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Receive finished sweets from kitchens, pack custom gift boxes according to customer specifications, and dispatch to stores
            </p>
          </div>
        </div>

        {/* Live Metrics Pills */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-slate-50/80 border-slate-200 shadow-2xs">
            <Gift size={14} className="text-indigo-500" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase font-mono">Total Volume</span>
              <span className="font-semibold text-slate-800 text-xs font-mono">
                {metrics.totalKgToPack} KG
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-amber-50/60 border-amber-200 text-amber-800 shadow-2xs">
            <Clock size={14} className="text-amber-600" />
            <div className="flex flex-col">
              <span className="text-[10px] text-amber-600 uppercase font-mono">Arriving from Factory</span>
              <span className="font-semibold text-xs font-mono">
                {metrics.pendingArrival} items
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-sky-50/60 border-sky-200 text-sky-800 shadow-2xs">
            <Play size={14} className="text-sky-600" />
            <div className="flex flex-col">
              <span className="text-[10px] text-sky-600 uppercase font-mono">In Packing</span>
              <span className="font-semibold text-xs font-mono">
                {metrics.inProgressCount} items
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-emerald-50/60 border-emerald-200 text-emerald-800 shadow-2xs">
            <PackageCheck size={14} className="text-emerald-600" />
            <div className="flex flex-col">
              <span className="text-[10px] text-emerald-600 uppercase font-mono">Packed & Ready</span>
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
        {/* Left: Packing Unit Selector + Tab Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Packing Unit Selector */}
          <div className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg p-1">
            <span className="text-[11px] font-medium text-slate-500 px-1 flex items-center gap-1">
              <Boxes size={13} className="text-indigo-500" />
              Station:
            </span>
            <select
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              className="bg-white border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer shadow-2xs"
            >
              <option value="all">All Packing Units</option>
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
              <Layers size={13} className={selectedTab === "consolidated" ? "text-indigo-600" : ""} />
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
              <ListOrdered size={13} className={selectedTab === "order_wise" ? "text-indigo-600" : ""} />
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
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Packing Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PackingStatusFilter)}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer shadow-2xs"
          >
            <option value="active">Active Packing Queue</option>
            <option value="moved_to_packing">Arriving from Factory</option>
            <option value="received">Received at Station</option>
            <option value="in_progress">Packing In Progress</option>
            <option value="completed">Packing Completed</option>
            <option value="all">All Statuses (Incl. Dispatched)</option>
          </select>

          {/* Search Box */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white shadow-2xs w-48 sm:w-56 focus-within:ring-1 focus-within:ring-indigo-400">
            <Search size={13} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search sweet, order #, instructions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-transparent focus:outline-none text-slate-800"
            />
          </div>

          {selectedTab === "consolidated" && consolidatedGroups.length > 0 && (
            <button
              onClick={handleToggleAllAccordions}
              className="px-2.5 py-1 text-[11px] rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer shadow-2xs"
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
            <Loader2 size={26} className="animate-spin text-indigo-500" />
            <span className="text-xs font-mono">Syncing packing station queue...</span>
          </div>
        ) : selectedTab === "consolidated" ? (
          // ================= VIEW A: CONSOLIDATED (ITEM-WISE) =================
          consolidatedGroups.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200 p-8">
              <PackageCheck size={32} className="text-emerald-400 stroke-[1.5]" />
              <span className="text-sm font-medium text-slate-700">Packing Queue Clear</span>
              <span className="text-xs text-slate-400 text-center max-w-sm">
                No sweet batches currently waiting to be packaged for {dateFilter === "today" ? "today" : "the selected filters"}. Sweets completed in the Manufacturing Portal will arrive here live.
              </span>
            </div>
          ) : (
            <div className="space-y-3.5 max-w-6xl mx-auto">
              {consolidatedGroups.map((group) => {
                const isExpanded = expandedProducts.has(group.productId);
                const hasIncoming = group.items.some(
                  (i) => i.status === "Moved to Packing"
                );
                const hasReceived = group.items.some(
                  (i) => i.status === "Received at Packing"
                );
                const hasInProgress = group.items.some(
                  (i) => i.status === "Packing In Progress"
                );
                const hasCompleted = group.items.some(
                  (i) => i.status === "Packing Completed"
                );

                return (
                  <div
                    key={`${group.productId}_${group.packingUnitId}`}
                    className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all hover:border-slate-300"
                  >
                    {/* Consolidated Packing Card Header */}
                    <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
                      {/* Left: Product Info & Station */}
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
                            <span className="px-2 py-0.5 text-[10px] rounded-full bg-indigo-50 text-indigo-700 font-mono border border-indigo-200">
                              {group.packingUnitName}
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

                      {/* Center: Total Volume to Pack */}
                      <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl shadow-2xs">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">
                            Total Volume To Pack
                          </span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-xl font-bold font-mono text-indigo-600">
                              {group.totalKg > 0
                                ? `${group.totalKg.toFixed(2)} KG`
                                : `${group.totalQuantity} ${group.unit}`}
                            </span>
                            {group.unit.toLowerCase() === "piece" && group.totalKg > 0 && (
                              <span className="text-xs text-slate-500 font-mono">
                                ({group.totalQuantity} pcs)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status Breakdown Indicator */}
                        <div className="hidden sm:flex flex-col gap-1 border-l border-slate-200 pl-3">
                          <div className="flex items-center gap-2 text-[11px]">
                            {group.statusSummary.movedToPacking > 0 && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-mono text-[10px]">
                                {group.statusSummary.movedToPacking} arriving
                              </span>
                            )}
                            {group.statusSummary.receivedAtPacking > 0 && (
                              <span className="px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 font-mono text-[10px]">
                                {group.statusSummary.receivedAtPacking} at station
                              </span>
                            )}
                            {group.statusSummary.packingInProgress > 0 && (
                              <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 font-mono text-[10px]">
                                {group.statusSummary.packingInProgress} packing
                              </span>
                            )}
                            {group.statusSummary.packingCompleted > 0 && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px]">
                                {group.statusSummary.packingCompleted} packed
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Bulk Action Group Buttons & Accordion Toggle */}
                      <div className="flex items-center gap-2">
                        {/* Receive All */}
                        {hasIncoming && (
                          <button
                            onClick={() =>
                              handleBulkUpdateGroupStatus(
                                group,
                                "Received at Packing"
                              )
                            }
                            disabled={isUpdating !== null}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                            title="Acknowledge receipt of incoming batches at packing station"
                          >
                            <Check size={13} />
                            <span>Receive All ({group.statusSummary.movedToPacking})</span>
                          </button>
                        )}

                        {/* Start Packing All */}
                        {(hasIncoming || hasReceived) && (
                          <button
                            onClick={() =>
                              handleBulkUpdateGroupStatus(
                                group,
                                "Packing In Progress"
                              )
                            }
                            disabled={isUpdating !== null}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                            title="Start packing into gift boxes and trays"
                          >
                            <Play size={13} />
                            <span>Start Packing All</span>
                          </button>
                        )}

                        {/* Complete All Packing */}
                        {hasInProgress && (
                          <button
                            onClick={() =>
                              handleBulkUpdateGroupStatus(
                                group,
                                "Packing Completed"
                              )
                            }
                            disabled={isUpdating !== null}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                            title="Mark all packaged boxes as finished"
                          >
                            <PackageCheck size={13} />
                            <span>Complete All ({group.statusSummary.packingInProgress})</span>
                          </button>
                        )}

                        {/* Dispatch All to Store */}
                        {hasCompleted && (
                          <button
                            onClick={() =>
                              handleBulkUpdateGroupStatus(
                                group,
                                "Moved to Store"
                              )
                            }
                            disabled={isUpdating !== null}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                            title="Dispatch packaged boxes to outlet store"
                          >
                            <Truck size={13} />
                            <span>Dispatch All ({group.statusSummary.packingCompleted})</span>
                          </button>
                        )}

                        {/* Accordion Expand/Collapse */}
                        <button
                          onClick={() => toggleExpand(group.productId)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors text-xs font-medium cursor-pointer shadow-2xs ml-1"
                        >
                          <span>Orders & Packing Notes</span>
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
                          <span>Advance individual box packaging below</span>
                        </div>

                        {group.items.map((breakdown) => {
                          const isItemUpdating =
                            isUpdating ===
                              `${breakdown.orderId}_${breakdown.lineId}_Received at Packing` ||
                            isUpdating ===
                              `${breakdown.orderId}_${breakdown.lineId}_Packing In Progress` ||
                            isUpdating ===
                              `${breakdown.orderId}_${breakdown.lineId}_Packing Completed` ||
                            isUpdating ===
                              `${breakdown.orderId}_${breakdown.lineId}_Moved to Store`;

                          return (
                            <div
                              key={`${breakdown.orderId}_${breakdown.lineId}`}
                              className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                            >
                              {/* Order & Customer Details */}
                              <div className="flex items-center gap-3 min-w-[300px]">
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
                                    <span className="flex items-center gap-1 text-indigo-600 font-medium">
                                      <Calendar size={11} />
                                      {breakdown.deliveryDate} at {breakdown.deliveryTime}
                                    </span>
                                  </div>

                                  {/* Packing description & custom instructions */}
                                  {breakdown.packingDescription && (
                                    <div className="mt-1 flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-50 text-indigo-900 border border-indigo-200 text-[11px]">
                                      <Gift size={11} className="text-indigo-600 shrink-0" />
                                      <span>
                                        <strong>Packing Note:</strong> {breakdown.packingDescription}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Quantity to Pack */}
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
                                    breakdown.status === "Moved to Packing"
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : breakdown.status === "Received at Packing"
                                      ? "bg-sky-50 text-sky-700 border-sky-200"
                                      : breakdown.status === "Packing In Progress"
                                      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                      : breakdown.status === "Packing Completed"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : "bg-slate-100 text-slate-700 border-slate-200"
                                  }`}
                                >
                                  {breakdown.status}
                                </span>
                              </div>

                              {/* Individual Action Buttons */}
                              <div className="flex items-center gap-2">
                                {breakdown.status === "Moved to Packing" && (
                                  <button
                                    onClick={() =>
                                      handleUpdateItemStatus(
                                        breakdown.orderId,
                                        breakdown.lineId,
                                        "Received at Packing",
                                        group.productName
                                      )
                                    }
                                    disabled={isItemUpdating}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-medium transition-colors cursor-pointer shadow-2xs"
                                  >
                                    <Check size={11} />
                                    <span>Acknowledge Receipt</span>
                                  </button>
                                )}

                                {(breakdown.status === "Moved to Packing" ||
                                  breakdown.status === "Received at Packing") && (
                                  <button
                                    onClick={() =>
                                      handleUpdateItemStatus(
                                        breakdown.orderId,
                                        breakdown.lineId,
                                        "Packing In Progress",
                                        group.productName
                                      )
                                    }
                                    disabled={isItemUpdating}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-medium transition-colors cursor-pointer shadow-2xs"
                                  >
                                    <Play size={11} />
                                    <span>Start Packing</span>
                                  </button>
                                )}

                                {breakdown.status === "Packing In Progress" && (
                                  <button
                                    onClick={() =>
                                      handleUpdateItemStatus(
                                        breakdown.orderId,
                                        breakdown.lineId,
                                        "Packing Completed",
                                        group.productName
                                      )
                                    }
                                    disabled={isItemUpdating}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium transition-colors cursor-pointer shadow-2xs"
                                  >
                                    <PackageCheck size={11} />
                                    <span>Packing Done</span>
                                  </button>
                                )}

                                {breakdown.status === "Packing Completed" && (
                                  <button
                                    onClick={() =>
                                      handleUpdateItemStatus(
                                        breakdown.orderId,
                                        breakdown.lineId,
                                        "Moved to Store",
                                        group.productName
                                      )
                                    }
                                    disabled={isItemUpdating}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-medium transition-colors cursor-pointer shadow-2xs"
                                  >
                                    <Truck size={11} />
                                    <span>Dispatch</span>
                                  </button>
                                )}

                                {breakdown.status === "Moved to Store" && (
                                  <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-mono font-medium">
                                    <CheckCircle2 size={13} />
                                    Dispatched to Store
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
              <PackageCheck size={32} className="text-emerald-400 stroke-[1.5]" />
              <span className="text-sm font-medium text-slate-700">No Orders in Packing Queue</span>
              <span className="text-xs text-slate-400">
                No orders match your current filters.
              </span>
            </div>
          ) : (
            <div className="space-y-4 max-w-6xl mx-auto">
              {relevantOrders.map((order) => {
                // Filter items for selected packing unit
                const assignedItems = order.items.filter((item) => {
                  const pkgUnit = getItemPackingUnit(item);
                  if (selectedUnitId !== "all" && pkgUnit.id !== selectedUnitId) {
                    return false;
                  }
                  return true;
                });

                if (assignedItems.length === 0) return null;

                const isWholeOrderUpdating =
                  isUpdating?.startsWith(`order_pack_${order.id}`) || false;

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
                            <span className="text-indigo-600 font-medium">
                              Delivery: {order.deliveryDate} at {order.deliveryTime}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Whole Order Actions */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${
                            order.orderStatus === "Moved to Packing"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : order.orderStatus === "Received at Packing"
                              ? "bg-sky-50 text-sky-700 border-sky-200"
                              : order.orderStatus === "Packing In Progress"
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : order.orderStatus === "Packing Completed"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {order.orderStatus}
                        </span>

                        {/* Whole order buttons */}
                        {order.orderStatus === "Moved to Packing" && (
                          <button
                            onClick={() =>
                              handleUpdateWholeOrder(
                                order.id,
                                "Received at Packing"
                              )
                            }
                            disabled={isWholeOrderUpdating}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                          >
                            <Check size={12} />
                            <span>Acknowledge Receipt</span>
                          </button>
                        )}

                        {(order.orderStatus === "Moved to Packing" ||
                          order.orderStatus === "Received at Packing") && (
                          <button
                            onClick={() =>
                              handleUpdateWholeOrder(
                                order.id,
                                "Packing In Progress"
                              )
                            }
                            disabled={isWholeOrderUpdating}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                          >
                            <Play size={12} />
                            <span>Start Packing Order</span>
                          </button>
                        )}

                        {order.orderStatus === "Packing In Progress" && (
                          <button
                            onClick={() =>
                              handleUpdateWholeOrder(
                                order.id,
                                "Packing Completed"
                              )
                            }
                            disabled={isWholeOrderUpdating}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                          >
                            <PackageCheck size={12} />
                            <span>Complete Packing</span>
                          </button>
                        )}

                        {order.orderStatus === "Packing Completed" && (
                          <button
                            onClick={() =>
                              handleUpdateWholeOrder(
                                order.id,
                                "Moved to Store"
                              )
                            }
                            disabled={isWholeOrderUpdating}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                          >
                            <Truck size={12} />
                            <span>Dispatch to Store</span>
                          </button>
                        )}

                        {/* Print packing slip */}
                        <button
                          onClick={() => window.print()}
                          className="p-1.5 text-slate-500 hover:text-slate-800 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-2xs"
                          title="Print Box Packaging Slip"
                        >
                          <Printer size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Packing Specification Highlight */}
                    {order.packingDescription && (
                      <div className="px-5 py-2 bg-indigo-50/50 border-b border-indigo-100 flex items-center gap-2 text-xs text-indigo-900 font-mono">
                        <Gift size={13} className="text-indigo-600 shrink-0" />
                        <span>
                          <strong>Packaging Note:</strong> {order.packingDescription}
                        </span>
                      </div>
                    )}

                    {/* Order Items Table */}
                    <div className="p-4 overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-[11px] text-slate-500 uppercase font-mono">
                            <th className="py-2 px-3">Item Name</th>
                            <th className="py-2 px-3">Packing Station</th>
                            <th className="py-2 px-3 text-right">Quantity</th>
                            <th className="py-2 px-3">Kitchen Recipe Note</th>
                            <th className="py-2 px-3 text-center">Status</th>
                            <th className="py-2 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {assignedItems.map((item) => {
                            const pkgUnit = getItemPackingUnit(item);
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
                                    {pkgUnit.name}
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
                                  {item.manufacturingDescription || <span className="text-slate-400">—</span>}
                                </td>

                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                      itemStatus === "Moved to Packing"
                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                        : itemStatus === "Received at Packing"
                                        ? "bg-sky-50 text-sky-700 border-sky-200"
                                        : itemStatus === "Packing In Progress"
                                        ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                        : itemStatus === "Packing Completed"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-slate-100 text-slate-700 border-slate-200"
                                    }`}
                                  >
                                    {itemStatus}
                                  </span>
                                </td>

                                <td className="py-2.5 px-3 text-right">
                                  {itemStatus === "Moved to Packing" && (
                                    <button
                                      onClick={() =>
                                        handleUpdateItemStatus(
                                          order.id,
                                          item.id,
                                          "Received at Packing",
                                          item.name
                                        )
                                      }
                                      className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-medium cursor-pointer transition-colors shadow-2xs"
                                    >
                                      Acknowledge
                                    </button>
                                  )}
                                  {(itemStatus === "Moved to Packing" ||
                                    itemStatus === "Received at Packing") && (
                                    <button
                                      onClick={() =>
                                        handleUpdateItemStatus(
                                          order.id,
                                          item.id,
                                          "Packing In Progress",
                                          item.name
                                        )
                                      }
                                      className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-medium cursor-pointer transition-colors shadow-2xs ml-1"
                                    >
                                      Pack
                                    </button>
                                  )}
                                  {itemStatus === "Packing In Progress" && (
                                    <button
                                      onClick={() =>
                                        handleUpdateItemStatus(
                                          order.id,
                                          item.id,
                                          "Packing Completed",
                                          item.name
                                        )
                                      }
                                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium cursor-pointer transition-colors shadow-2xs"
                                    >
                                      Done
                                    </button>
                                  )}
                                  {itemStatus === "Packing Completed" && (
                                    <button
                                      onClick={() =>
                                        handleUpdateItemStatus(
                                          order.id,
                                          item.id,
                                          "Moved to Store",
                                          item.name
                                        )
                                      }
                                      className="px-2.5 py-1 rounded bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-medium cursor-pointer transition-colors shadow-2xs"
                                    >
                                      Dispatch
                                    </button>
                                  )}
                                  {itemStatus === "Moved to Store" && (
                                    <span className="text-[11px] text-emerald-600 font-mono font-medium">
                                      Dispatched
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
