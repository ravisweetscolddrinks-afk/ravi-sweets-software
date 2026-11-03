export interface QuotationItem {
  id: string;
  productId?: string;
  name: string;
  unit: string;
  rate: number;
  quantity: number;
  totalAmount: number;
  originalWeight?: number | null;
  roundOffApplied?: boolean;
  notes?: string;
}

export interface QuotationPartyDetails {
  tradeName: string;
  legalName?: string;
  address: string;
  city: string;
  state?: string;
  pincode?: string;
  phone: string;
  altPhone?: string;
  email?: string;
  gstNumber?: string;
  storeId?: string;
  storeName?: string;
}

export interface QuotationCustomerDetails {
  customerId?: string;
  customerName: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  gstNumber?: string;
}

export interface QuotationRecord {
  id: string;
  quotationNumber: string;
  quotationDate: string;
  validUntilDate: string;
  status: "Draft" | "Sent" | "Accepted" | "Expired" | "Converted to Order";
  fromDetails: QuotationPartyDetails;
  toDetails: QuotationCustomerDetails;
  items: QuotationItem[];
  subtotal: number;
  discount: number;
  taxableSubtotal: number;
  isGstEnabled: boolean;
  gstPercentage: number;
  cgst: number;
  sgst: number;
  grandTotal: number;
  termsAndConditions?: string;
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

