"use client";

import React from "react";
import GenericUnitManager from "@/components/GenericUnitManager";
import { Boxes } from "lucide-react";

export default function PackingUnitsPage() {
  return (
    <GenericUnitManager
      collectionName="packing_units"
      pageTitle="Packing Units"
      unitLabel="Unit Name"
      placeholderName="e.g. Festive Gift Box Line A, Vacuum Packing Unit #2..."
      descriptionText="Manage sweet packaging stations, festive gift box lines, and store dispatch packing points."
      icon={Boxes}
      badgeLabel="PACKING UNIT"
    />
  );
}
