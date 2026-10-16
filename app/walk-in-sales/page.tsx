import ComingSoonPage from "@/components/ComingSoonPage";

export default function WalkInSalesPage() {
  return (
    <ComingSoonPage
      title="Walk In Sales"
      category="Sales & POS"
      route="/walk-in-sales"
      description="Live tracking and immediate overview of over-the-counter customer traffic, hot items, rush-hour peak sales volume, and instantaneous cashier settlement summaries."
      features={[
        "Hourly walk-in revenue velocity tracking",
        "Fast-moving sweet and bakery items leaderboard",
        "Cashier shift closing and balance declaration",
        "Token generation for busy festive rush periods",
        "Discount approval workflows for store managers"
      ]}
    />
  );
}
