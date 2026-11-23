export type DateFilterType =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "custom"
  | "all";

export interface Caterer {
  id: string;
  name: string;
  mobile: string;
  mpin: string;
  city: string;
  address: string;
  totalOrders?: number;
  totalOrderValue?: number;
  totalCredits?: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface CateringOrderItem {
  id: string;
  productId: string;
  name: string;
  unit: string;
  rate: number;
  quantity: number;
  totalAmount: number;
  notes?: string;
  imageUrl?: string;
}

export interface CateringPaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: "Cash" | "UPI" | "Card" | "Split";
  splitDetails?: {
    cash: number;
    upi: number;
    card: number;
  };
  note?: string;
  receivedBy?: string;
}

export type CateringPaymentStatus = "Paid" | "Partial" | "Unpaid";
export type CateringOrderStatus = "Confirmed" | "In Production" | "Delivered" | "Cancelled";

export interface CateringOrder {
  id: string;
  orderNumber: string;
  catererId: string;
  catererName: string;
  catererMobile: string;
  catererCity: string;
  catererAddress: string;
  orderDate: string; // YYYY-MM-DD
  deliveryDate: string; // YYYY-MM-DD
  deliveryTime: string; // e.g. "11:00 AM"
  eventName?: string;
  venueAddress?: string;
  items: CateringOrderItem[];
  subtotal: number;
  discount: number;
  totalAmount: number;
  advanceReceived: number;
  balanceAmount: number;
  paymentStatus: CateringPaymentStatus;
  paymentMethod: "Cash" | "UPI" | "Card" | "Split";
  splitDetails?: {
    cash: number;
    upi: number;
    card: number;
  };
  paymentHistory: CateringPaymentRecord[];
  orderStatus: CateringOrderStatus;
  createdAt?: any;
  updatedAt?: any;
}

export function getTodayDateStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isDateMatchingFilter(
  dateStr: string,
  filter: DateFilterType,
  customFrom: string = "",
  customTo: string = ""
): boolean {
  if (!dateStr) return true;
  if (filter === "all") return true;

  const todayStr = getTodayDateStr();
  const now = new Date();

  const getOffsetDateStr = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  };

  switch (filter) {
    case "today":
      return dateStr === todayStr;

    case "yesterday":
      return dateStr === getOffsetDateStr(-1);

    case "this_week": {
      const d = new Date(now);
      const day = d.getDay(); // 0 is Sunday
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      d.setDate(diff);
      const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
      return dateStr >= start && dateStr <= todayStr;
    }

    case "last_week": {
      const dEnd = new Date(now);
      const day = dEnd.getDay();
      dEnd.setDate(dEnd.getDate() - (day === 0 ? 7 : day)); // Last Sunday
      const end = `${dEnd.getFullYear()}-${String(dEnd.getMonth() + 1).padStart(2, "0")}-${String(
        dEnd.getDate()
      ).padStart(2, "0")}`;

      const dStart = new Date(dEnd);
      dStart.setDate(dStart.getDate() - 6); // Last Monday
      const start = `${dStart.getFullYear()}-${String(dStart.getMonth() + 1).padStart(2, "0")}-${String(
        dStart.getDate()
      ).padStart(2, "0")}`;

      return dateStr >= start && dateStr <= end;
    }

    case "this_month": {
      const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      return dateStr >= start && dateStr <= todayStr;
    }

    case "last_month": {
      const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const start = `${year}-${String(prevMonth + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(year, prevMonth + 1, 0).getDate();
      const end = `${year}-${String(prevMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      return dateStr >= start && dateStr <= end;
    }

    case "this_year": {
      const start = `${now.getFullYear()}-01-01`;
      return dateStr >= start && dateStr <= todayStr;
    }

    case "last_year": {
      const year = now.getFullYear() - 1;
      const start = `${year}-01-01`;
      const end = `${year}-12-31`;
      return dateStr >= start && dateStr <= end;
    }

    case "custom": {
      if (!customFrom && !customTo) return true;
      if (customFrom && customTo) {
        return dateStr >= customFrom && dateStr <= customTo;
      }
      if (customFrom) return dateStr >= customFrom;
      if (customTo) return dateStr <= customTo;
      return true;
    }

    default:
      return true;
  }
}
