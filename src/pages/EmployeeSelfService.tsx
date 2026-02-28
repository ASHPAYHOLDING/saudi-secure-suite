import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, CalendarDays, Clock, Banknote } from "lucide-react";
import { useEmployeeSelfService } from "@/hooks/useEmployeeSelfService";
import { useGranularPermissions } from "@/hooks/useGranularPermissions";
import PageLoadingSkeleton from "@/components/ui/PageLoadingSkeleton";
import EssProfileTab from "@/components/ess/EssProfileTab";
import EssLeaveTab from "@/components/ess/EssLeaveTab";
import EssAttendanceTab from "@/components/ess/EssAttendanceTab";
import EssPayslipTab from "@/components/ess/EssPayslipTab";

const EmployeeSelfService = () => {
  const [activeTab, setActiveTab] = useState("profile");
  const { can } = useGranularPermissions();
  const ess = useEmployeeSelfService();

  if (ess.employeeLoading) return <PageLoadingSkeleton />;

  if (!ess.employee) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <User size={48} className="text-muted-foreground" />
        <h2 className="text-xl font-bold text-foreground">لا يوجد ملف موظف</h2>
        <p className="text-muted-foreground text-sm">لم يتم ربط حسابك بسجل موظف بعد. تواصل مع قسم الموارد البشرية.</p>
      </div>
    );
  }

  const canLeave = can("ess.request_leave");
  const canPayslip = can("ess.view_payslip");
  const canAttendance = can("ess.view_attendance");

  const tabs = [
    { id: "profile", label: "ملفي", icon: User, visible: true },
    { id: "leave", label: "الإجازات", icon: CalendarDays, visible: canLeave },
    { id: "attendance", label: "الحضور", icon: Clock, visible: canAttendance },
    { id: "payslip", label: "كشف الراتب", icon: Banknote, visible: canPayslip },
  ].filter((t) => t.visible);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <User size={24} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">بوابة الموظف</h1>
          <p className="text-sm text-muted-foreground">
            مرحباً {ess.employee.first_name} {ess.employee.last_name}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="w-full justify-start bg-muted/50 rounded-xl p-1 gap-1">
          {tabs.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg gap-2 px-4"
            >
              <t.icon size={16} />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <EssProfileTab employee={ess.employee} />
        </TabsContent>

        {canLeave && (
          <TabsContent value="leave" className="mt-6">
            <EssLeaveTab
              leaves={ess.leaves}
              loading={ess.leavesLoading}
              leaveTypes={ess.leaveTypes}
              onSubmit={ess.submitLeave.mutateAsync}
              submitting={ess.submitLeave.isPending}
            />
          </TabsContent>
        )}

        {canAttendance && (
          <TabsContent value="attendance" className="mt-6">
            <EssAttendanceTab records={ess.attendance} loading={ess.attendanceLoading} />
          </TabsContent>
        )}

        {canPayslip && (
          <TabsContent value="payslip" className="mt-6">
            <EssPayslipTab payslips={ess.payslips} loading={ess.payslipsLoading} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default EmployeeSelfService;
