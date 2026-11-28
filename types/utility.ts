export type UtilityType = "box" | "sticker";

export interface UtilityItem {
  id: string;
  name: string;
  type: UtilityType;
  price: number;
  description?: string;
  unit?: string;
  isActive?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface AdditionalAttachment {
  id: string;
  utilityId?: string;
  type: UtilityType;
  name: string;
  quantity: number;
  rate: number;
  totalAmount: number;
}
