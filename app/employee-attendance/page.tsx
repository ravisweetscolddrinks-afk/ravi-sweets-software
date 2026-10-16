import ComingSoonPage from "@/components/ComingSoonPage";

export default function EmployeeAttendancePage() {
  return (
    <ComingSoonPage
      title="Employee Attendence"
      category="Human Resources"
      route="/employee-attendance"
      description="Biometric fingerprint and face-recognition attendance sync, shift clock-in / clock-out times, leaves and overtime approval workflows, and monthly attendance percentage records."
      features={[
        "Real-time biometric attendance device sync via cloud API",
        "Shift clock-in / clock-out time tracking with grace periods",
        "Leave applications and manager approval dashboard",
        "Overtime hours automated computation",
        "Monthly attendance ledger directly connected to Payroll module"
      ]}
    />
  );
}
