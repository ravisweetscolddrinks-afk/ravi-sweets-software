export type OrderStatus =
  | "Created"
  | "Manufacturing In Progress"
  | "Manufacturing Completed"
  | "Moved to Packing"
  | "Received at Packing"
  | "Packing In Progress"
  | "Packing Completed"
  | "Moved to Store"
  | "Received at Store"
  | "Delivered";

export type PaymentStatus = "Unpaid" | "Partial" | "Done";

export type PaymentMethod = "Cash" | "UPI" | "Card" | "Split";

export interface OrderItem {
  id: string; // unique line ID
  productId: string;
  name: string;
  unit: string;
  rate: number;
  quantity: number; // piece count or KG/litre fraction
  totalAmount: number;
  manufacturingDescription?: string;
  imageUrl?: string;
  manufacturingUnitId?: string;
  manufacturingUnitName?: string;
  packingUnitId?: string;
  packingUnitName?: string;
  piecesPerKg?: number | string;
  status?: OrderStatus;
}

export interface SplitPaymentDetail {
  cash: number;
  upi: number;
  card: number;
}

export interface PaymentInstallment {
  id: string;
  amount: number;
  paymentMethod: PaymentMethod;
  date: string;
  note?: string;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  storeId: string;
  storeName: string;
  deliveryDate: string; // YYYY-MM-DD
  deliveryTime: string; // HH:MM AM/PM
  packingDescription: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  taxableSubtotal: number;
  isGstEnabled: boolean;
  gstPercentage: number;
  cgst: number;
  sgst: number;
  gstType: "inclusive" | "exclusive";
  grandTotal: number;
  receivedAmount: number;
  balanceAmount: number;
  paymentMethod: PaymentMethod;
  splitDetails?: SplitPaymentDetail;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  paymentHistory?: PaymentInstallment[];
  createdAt?: any;
  updatedAt?: any;
}
