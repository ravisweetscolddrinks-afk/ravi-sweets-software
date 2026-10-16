import ComingSoonPage from "@/components/ComingSoonPage";

export default function PosBillingPage() {
  return (
    <ComingSoonPage
      title="POS Billing"
      category="Sales & POS"
      route="/pos"
      description="Ultra-responsive counter billing terminal designed for retail sweet outlets. Features quick barcode lookup, weight-scale digital integration, multi-mode tender settlement (Cash, UPI, Card), and automated thermal receipt printing."
      features={[
        "Sub-second billing response with offline Firestore sync",
        "Direct digital weighing scale USB/Serial bridge",
        "Dynamic GST tax calculations and HSN categorization",
        "Thermal receipt auto-printing (2-inch & 3-inch ESC/POS)",
        "Split payment handling (Cash + UPI + Credit)",
        "Instant counter cash drawer reconciliation"
      ]}
    />
  );
}
