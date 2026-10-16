"use client";

import React from "react";
import GenericUnitManager from "@/components/GenericUnitManager";
import { Factory } from "lucide-react";

export default function ManufacturingUnitsPage() {
  return (
    <GenericUnitManager
      collectionName="manufacturing_units"
      pageTitle="Manufacturing Units"
      unitLabel="Unit Name"
      placeholderName="e.g. Bengali Sweets Kitchen #1, Ghee Unit Chirala..."
      descriptionText="Manage central factory production units, sweet kitchens, and batch cooking departments."
      icon={Factory}
      badgeLabel="MANUFACTURING UNIT"
    />
  );
}
