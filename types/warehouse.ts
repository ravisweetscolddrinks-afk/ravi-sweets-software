import { DateFilterType, getTodayDateStr, isDateMatchingFilter } from "./catering";

export type { DateFilterType };
export { getTodayDateStr, isDateMatchingFilter };

export interface WarehouseEntryItem {
  itemId: string; // ID from manufacturing_items
  name: string;
  unit: string; // "KG" | "Litre" | "Piece" etc.
  quantity: number;
  currentStock?: number;
  bufferStock?: number;
  costPerUnit?: number;
}

export interface WarehouseEntry {
  id: string;
  entryNumber: string; // e.g. "WHE-20261127-001"
  date: string; // YYYY-MM-DD
  time: string; // e.g. "10:30 AM"
  notes?: string;
  items: WarehouseEntryItem[];
  photos: string[]; // ImageKit URLs
  totalQuantity: number;
  totalItemsCount: number;
  createdAt?: any;
  updatedAt?: any;
}
