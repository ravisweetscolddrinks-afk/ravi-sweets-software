export interface RoundoffRule {
  id: string;
  fromWeight: number; // e.g. 0.980 (KG)
  toWeight: number;   // e.g. 1.020 (KG)
  roundOffValue: number; // e.g. 1.000 (KG) - the rounded weight applied
  storeId: string;    // "all" or specific store ID
  storeName: string;  // "All Stores" or specific store name
  isActive: boolean;
  appliedToAllProducts?: boolean;
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

/**
 * Finds a matching active roundoff rule for the given weight and store
 */
export function findMatchingRoundoffRule(
  rules: RoundoffRule[],
  weight: number,
  storeId?: string
): RoundoffRule | null {
  if (!rules || rules.length === 0 || !weight || weight <= 0) return null;

  for (const rule of rules) {
    if (!rule.isActive) continue;

    // Check store matching: "all" matches any store, otherwise must match storeId
    if (rule.storeId && rule.storeId !== "all" && storeId && rule.storeId !== storeId) {
      continue;
    }

    const minWeight = Math.min(rule.fromWeight, rule.toWeight);
    const maxWeight = Math.max(rule.fromWeight, rule.toWeight);

    // Check range tolerance [fromWeight, toWeight] (using standard floating tolerance of 0.0001)
    if (weight >= minWeight - 0.0001 && weight <= maxWeight + 0.0001) {
      return rule;
    }
  }

  return null;
}

