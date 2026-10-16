import ComingSoonPage from "@/components/ComingSoonPage";

export default function PayrollPage() {
  return (
    <ComingSoonPage
      title="Payroll"
      category="Human Resources"
      route="/payroll"
      description="Automated salary generation, monthly advance salary deductions, daily overtime calculations, festival bonus distributions, and digital payslip issuance for all staff members."
      features={[
        "Automated salary calculation based on verified attendance logs",
        "Advance salary & loan deduction management",
        "Overtime hours multiplier for festival high-demand seasons",
        "Festival sweet bonus allowances and incentives",
        "Bank direct-deposit statement generation and payslip PDF export"
      ]}
    />
  );
}
