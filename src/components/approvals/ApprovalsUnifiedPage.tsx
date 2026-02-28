import { useState } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/dashboard/PageHeader";
import { GitBranch } from "lucide-react";
import ApprovalWorkflowsPage from "./ApprovalWorkflowsPage";
import MyApprovalsPage from "./MyApprovalsPage";
import HrApprovalsPage from "@/components/hr/HrApprovalsPage";

const TAB_SUBTITLES: Record<string, { ar: string; en: string }> = {
  all: {
    ar: "إدارة سلاسل الموافقات وطلبات الاعتماد لكل المستندات المالية",
    en: "Manage approval workflows and requests for all financial documents",
  },
  mine: {
    ar: "المستندات التي تحتاج موافقتك الشخصية",
    en: "Documents that need your personal approval",
  },
  hr: {
    ar: "اعتماد ومراجعة طلبات الإجازات والموارد البشرية",
    en: "Review and approve leave and HR requests",
  },
};

const ApprovalsUnifiedPage = () => {
  const { isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState("all");

  const subtitle = TAB_SUBTITLES[activeTab];

  return (
    <div className="p-4 sm:p-6 space-y-5" dir={isRTL ? "rtl" : "ltr"}>
      <PageHeader
        title={isRTL ? "الموافقات" : "Approvals"}
        description={isRTL ? subtitle.ar : subtitle.en}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} dir={isRTL ? "rtl" : "ltr"}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="all" className="gap-1.5">
            <GitBranch className="h-3.5 w-3.5" />
            {isRTL ? "الكل" : "All"}
          </TabsTrigger>
          <TabsTrigger value="mine">
            {isRTL ? "موافقاتي" : "My Approvals"}
          </TabsTrigger>
          <TabsTrigger value="hr">
            {isRTL ? "الموارد البشرية" : "HR"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <ApprovalWorkflowsPage embedded />
        </TabsContent>

        <TabsContent value="mine" className="mt-4">
          <MyApprovalsPage embedded />
        </TabsContent>

        <TabsContent value="hr" className="mt-4">
          <HrApprovalsPage embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ApprovalsUnifiedPage;
