import ComingSoonPage from "@/components/ComingSoonPage";

export default function PackingPortalPage() {
  return (
    <ComingSoonPage
      title="Packing Portal"
      category="Portals"
      route="/packing-portal"
      description="Station screen for packaging teams. Scan incoming finished sweet trays, pack into custom gift boxes, apply batch labels and seal dates, and dispatch finished cartons to store vehicles."
      features={[
        "Packing station queue with box size presets (250g, 500g, 1kg, 2kg)",
        "Barcode label generator with manufacture & best-before dates",
        "Vehicle dispatch manifest generation and driver signoff",
        "Cold room storage bin assignment",
        "Quality assurance seal checklist prior to transport"
      ]}
    />
  );
}
