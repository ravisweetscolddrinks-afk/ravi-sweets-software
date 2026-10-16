"use client";

import React from "react";
import GenericUnitManager from "@/components/GenericUnitManager";
import { FolderTree } from "lucide-react";

export default function ProductCategoriesPage() {
  return (
    <GenericUnitManager
      collectionName="product_categories"
      pageTitle="ProductCategories"
      unitLabel="Category Name"
      placeholderName="e.g. Traditional Telugu Sweets, Pure Ghee Specials..."
      descriptionText="Organize sweet items, savories, and gift collections into categories for POS display and catalog management."
      icon={FolderTree}
      badgeLabel="PRODUCT CATEGORY"
    />
  );
}
