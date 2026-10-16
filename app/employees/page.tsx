import ComingSoonPage from "@/components/ComingSoonPage";

export default function EmployeesPage() {
  return (
    <ComingSoonPage
      title="Employees"
      category="Human Resources"
      route="/employees"
      description="Staff directory across all stores, central kitchens, and packing facilities. Manage job roles, contact profiles, ID verification, shift rosters, and POS terminal access credentials."
      features={[
        "Complete staff profiles (Chefs, Helpers, Cashiers, Delivery Drivers, Store Managers)",
        "Role-based security permissions for POS and Admin portals",
        "Biometric device ID mapping & digital KYC records",
        "Branch transfer records and shift schedule assignments",
        "Performance evaluation and daily sales target tracking"
      ]}
    />
  );
}
