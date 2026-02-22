import UpgradeWallEnterprise, { type ComparisonRow } from "@/components/guards/UpgradeWallEnterprise";

const PAYROLL_COMPARISON: ComparisonRow[] = [
  { labelAr: "إدارة الموظفين والعقود", labelEn: "Employee & Contract Management", professional: true, enterprise: true },
  { labelAr: "الإجازات والحضور", labelEn: "Leave & Attendance", professional: true, enterprise: true },
  { labelAr: "مسيّرات الرواتب", labelEn: "Payroll Runs", professional: false, enterprise: true },
  { labelAr: "الاستقطاعات والبدلات التلقائية", labelEn: "Auto Deductions & Allowances", professional: false, enterprise: true },
  { labelAr: "تقارير الرواتب والتأمينات", labelEn: "Payroll & GOSI Reports", professional: false, enterprise: true },
];

export default function UpgradeWallPayroll() {
  return (
    <UpgradeWallEnterprise
      title="الرواتب متاحة في باقة المؤسسات"
      titleEn="Payroll is available on the Enterprise plan"
      description="أدر رواتب موظفيك بالكامل — مسيّرات تلقائية، استقطاعات، بدلات، وتقارير تأمينات اجتماعية."
      descriptionEn="Manage employee payroll end-to-end — automated runs, deductions, allowances, and GOSI reports."
      comparisonData={PAYROLL_COMPARISON}
    />
  );
}
