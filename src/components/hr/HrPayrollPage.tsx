import { useLanguage } from "@/hooks/useLanguage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Banknote, Settings, FileBarChart } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function HrPayrollPage() {
  const { currentLang } = useLanguage();
  const isAr = currentLang === "ar";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {isAr ? "مسيّرات الرواتب" : "Payroll"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isAr ? "إعداد وصرف رواتب الموظفين" : "Prepare and process employee salaries"}
        </p>
      </div>

      <Tabs defaultValue="runs" dir={isAr ? "rtl" : "ltr"}>
        <TabsList>
          <TabsTrigger value="runs" className="gap-2">
            <Banknote className="h-4 w-4" />
            {isAr ? "المسيّرات" : "Payroll Runs"}
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            {isAr ? "الإعدادات" : "Settings"}
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <FileBarChart className="h-4 w-4" />
            {isAr ? "التقارير" : "Reports"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="runs">
          <Card>
            <CardHeader>
              <CardTitle>{isAr ? "مسيّرات الرواتب" : "Payroll Runs"}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {isAr ? "لم يتم إنشاء أي مسيّرة بعد." : "No payroll runs yet."}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>{isAr ? "إعدادات الرواتب" : "Payroll Settings"}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {isAr ? "قم بتهيئة هيكل الرواتب والاستقطاعات." : "Configure salary structure and deductions."}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>{isAr ? "تقارير الرواتب" : "Payroll Reports"}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {isAr ? "عرض تقارير الرواتب والاستقطاعات." : "View payroll and deduction reports."}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
