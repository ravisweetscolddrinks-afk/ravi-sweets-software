import ComingSoonPage from "@/components/ComingSoonPage";

export default function StoreStockEntryPage() {
  return (
    <ComingSoonPage
      title="Store Stock Entry"
      category="Inventory & Operations"
      route="/store-stock-entry"
      description="Stock inward workflow for retail branches. Record inward sweet trays from central kitchen, vendor dairy/dry-fruit purchase receipts, store shelf replenishment, and spoilage logs."
      features={[
        "Inward challan recording with batch verification",
        "Direct kitchen-to-store transfer receipt acknowledge",
        "Damaged / expired sweet discard entry with reason codes",
        "Real-time inventory levels update on POS billing counters",
        "Barcode scanner support for rapid carton receiving"
      ]}
    />
  );
}
