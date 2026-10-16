import ComingSoonPage from "@/components/ComingSoonPage";

export default function ManufacturingPortalPage() {
  return (
    <ComingSoonPage
      title="Manufacturing Portal"
      category="Portals"
      route="/manufacturing-portal"
      description="Dedicated factory tablet interface for sweet master chefs and supervisors. Displays live production orders, recipe ingredient ratios, batch timers, quality check approvals, and tray handover logs."
      features={[
        "Touchscreen-optimized kitchen station display (KDS)",
        "Step-by-step master recipe formulations & temperature gauges",
        "Batch status advancement (Raw Prep -> Cooking -> Cooling -> Quality Check)",
        "Daily target completion progress bars and alerts",
        "Immediate dispatch notification to packing units"
      ]}
    />
  );
}
