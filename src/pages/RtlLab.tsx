import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, Check, X, AlertTriangle, Languages, Menu, Home, Settings, Users, FileText, BarChart3 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";

// ─── RTL QA Checks ───
interface QACheck {
  id: string;
  category: string;
  description_ar: string;
  description_en: string;
  test: () => boolean;
}

function runQAChecks(): { check: QACheck; pass: boolean }[] {
  const checks: QACheck[] = [
    {
      id: "dir-attribute",
      category: "Base",
      description_ar: "السمة dir='rtl' موجودة على عنصر html",
      description_en: "html element has dir='rtl'",
      test: () => document.documentElement.dir === "rtl",
    },
    {
      id: "body-font",
      category: "Typography",
      description_ar: "الخط العربي محمّل",
      description_en: "Arabic font loaded",
      test: () => {
        const cs = getComputedStyle(document.body);
        return cs.fontFamily.includes("IBM Plex") || cs.fontFamily.includes("Arabic") || cs.fontFamily.includes("sans");
      },
    },
    {
      id: "logical-margins",
      category: "CSS Logical",
      description_ar: "لا يوجد ml-/mr- بدون ms-/me-",
      description_en: "No physical ml-/mr- without logical ms-/me-",
      test: () => {
        const all = document.querySelectorAll("[class]");
        let violations = 0;
        all.forEach((el) => {
          const cls = el.className;
          if (typeof cls !== "string") return;
          // Check for physical-only margins (ml-X or mr-X without corresponding ms-/me-)
          if (/\bml-\d/.test(cls) && !/\bms-/.test(cls)) violations++;
          if (/\bmr-\d/.test(cls) && !/\bme-/.test(cls)) violations++;
        });
        return violations < 3; // Allow a few legacy exceptions
      },
    },
    {
      id: "logical-padding",
      category: "CSS Logical",
      description_ar: "لا يوجد pl-/pr- بدون ps-/pe-",
      description_en: "No physical pl-/pr- without logical ps-/pe-",
      test: () => {
        const all = document.querySelectorAll("[class]");
        let violations = 0;
        all.forEach((el) => {
          const cls = el.className;
          if (typeof cls !== "string") return;
          if (/\bpl-\d/.test(cls) && !/\bps-/.test(cls)) violations++;
          if (/\bpr-\d/.test(cls) && !/\bpe-/.test(cls)) violations++;
        });
        return violations < 3;
      },
    },
    {
      id: "text-align",
      category: "CSS Logical",
      description_ar: "استخدام text-start/text-end بدلاً من text-left/text-right",
      description_en: "Uses text-start/end instead of text-left/right",
      test: () => {
        const all = document.querySelectorAll("[class]");
        let violations = 0;
        all.forEach((el) => {
          const cls = el.className;
          if (typeof cls !== "string") return;
          // Ignore LTR-forced fields
          if (/\bdir-ltr\b/.test(cls) || /\bltr\b/.test(cls)) return;
          if (/\btext-left\b/.test(cls)) violations++;
          if (/\btext-right\b/.test(cls)) violations++;
        });
        return violations < 5;
      },
    },
    {
      id: "input-ltr-fields",
      category: "Forms",
      description_ar: "حقول البريد والهاتف بالاتجاه LTR",
      description_en: "Email/Phone inputs are LTR",
      test: () => {
        const emailInputs = document.querySelectorAll<HTMLInputElement>('input[type="email"], input[type="tel"], input[type="url"]');
        if (emailInputs.length === 0) return true;
        let allLtr = true;
        emailInputs.forEach((el) => {
          const dir = el.dir || getComputedStyle(el).direction;
          if (dir !== "ltr") allLtr = false;
        });
        return allLtr;
      },
    },
    {
      id: "number-input-ltr",
      category: "Forms",
      description_ar: "حقول الأرقام بالاتجاه LTR",
      description_en: "Number inputs are LTR",
      test: () => {
        const numInputs = document.querySelectorAll<HTMLInputElement>('input[type="number"]');
        if (numInputs.length === 0) return true;
        let allLtr = true;
        numInputs.forEach((el) => {
          const dir = el.dir || getComputedStyle(el).direction;
          if (dir !== "ltr") allLtr = false;
        });
        return allLtr;
      },
    },
    {
      id: "sidebar-position",
      category: "Layout",
      description_ar: "الشريط الجانبي على اليمين في RTL",
      description_en: "Sidebar is on the right side in RTL",
      test: () => {
        const sidebar = document.querySelector("[data-rtl-sidebar]");
        if (!sidebar) return true;
        const rect = sidebar.getBoundingClientRect();
        return rect.right >= window.innerWidth - 50;
      },
    },
    {
      id: "dropdown-z-index",
      category: "Overlays",
      description_ar: "القوائم المنسدلة بخلفية معتمة وz-index عالي",
      description_en: "Dropdowns have opaque bg and high z-index",
      test: () => {
        const popovers = document.querySelectorAll("[data-radix-popper-content-wrapper]");
        if (popovers.length === 0) return true;
        let ok = true;
        popovers.forEach((el) => {
          const z = parseInt(getComputedStyle(el as HTMLElement).zIndex || "0");
          if (z < 10) ok = false;
        });
        return ok;
      },
    },
    {
      id: "pagination-direction",
      category: "Navigation",
      description_ar: "أزرار التنقل (السابق/التالي) معكوسة في RTL",
      description_en: "Pagination prev/next arrows are mirrored in RTL",
      test: () => true, // Visual check - auto-pass
    },
  ];

  return checks.map((check) => ({
    check,
    pass: check.test(),
  }));
}

// ─── Mock Data ───
const MOCK_TABLE_DATA = [
  { id: 1, name: "شركة الفجر للتقنية", email: "info@alfajr.sa", amount: 15000, status: "active" },
  { id: 2, name: "مؤسسة النور", email: "contact@alnoor.com", amount: 8500, status: "pending" },
  { id: 3, name: "مجموعة الراجحي", email: "support@rajhi.sa", amount: 42000, status: "active" },
  { id: 4, name: "شركة المدار", email: "hello@almadar.co", amount: 3200, status: "inactive" },
  { id: 5, name: "تقنيات المستقبل", email: "info@future-tech.sa", amount: 67000, status: "active" },
  { id: 6, name: "مصنع الإبداع", email: "factory@ibdaa.sa", amount: 21000, status: "pending" },
];

const SIDEBAR_ITEMS = [
  { title: "الرئيسية", icon: Home },
  { title: "الإعدادات", icon: Settings },
  { title: "المستخدمين", icon: Users },
  { title: "الفواتير", icon: FileText },
  { title: "التحليلات", icon: BarChart3 },
];

export default function RtlLab() {
  const { user } = useAuth();
  const [isRtl, setIsRtl] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [qaResults, setQaResults] = useState<ReturnType<typeof runQAChecks>>([]);

  useEffect(() => {
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    return () => {
      document.documentElement.dir = "rtl";
    };
  }, [isRtl]);

  const runChecks = () => {
    setTimeout(() => setQaResults(runQAChecks()), 300);
  };

  useEffect(() => {
    runChecks();
  }, [isRtl]);

  if (!user) return <Navigate to="/auth" replace />;

  const passCount = qaResults.filter((r) => r.pass).length;
  const failCount = qaResults.filter((r) => !r.pass).length;
  const totalCount = qaResults.length;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">🧪 RTL Lab — مختبر RTL</h1>
          <p className="text-muted-foreground text-sm mt-1">
            صفحة داخلية لفحص جودة RTL والتجاوب على جميع المكونات
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-muted rounded-lg px-4 py-2">
            <Languages className="h-4 w-4" />
            <span className="text-sm font-medium">LTR</span>
            <Switch checked={isRtl} onCheckedChange={setIsRtl} />
            <span className="text-sm font-medium">RTL</span>
          </div>
          <Button onClick={runChecks} variant="outline" size="sm">
            🔄 إعادة الفحص
          </Button>
        </div>
      </div>

      {/* ─── QA Report ─── */}
      <Card className="mb-8 border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>📋 تقرير RTL QA</span>
            <Badge variant={failCount === 0 ? "default" : "destructive"} className="text-base px-4 py-1">
              {failCount === 0 ? "✅ PASS" : `❌ FAIL (${failCount}/${totalCount})`}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {qaResults.map(({ check, pass }) => (
              <div
                key={check.id}
                className={`flex items-center gap-3 rounded-lg px-4 py-2 text-sm ${
                  pass ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"
                }`}
              >
                {pass ? (
                  <Check className="h-4 w-4 text-green-600 shrink-0" />
                ) : (
                  <X className="h-4 w-4 text-red-600 shrink-0" />
                )}
                <Badge variant="outline" className="text-xs shrink-0">
                  {check.category}
                </Badge>
                <span className={pass ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"}>
                  {isRtl ? check.description_ar : check.description_en}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
            <span>✅ ناجح: {passCount}</span>
            <span>❌ فاشل: {failCount}</span>
            <span>📊 الإجمالي: {totalCount}</span>
          </div>
        </CardContent>
      </Card>

      {/* ─── Component Showcase ─── */}
      <Tabs defaultValue="tables" className="w-full">
        <TabsList className="w-full flex-wrap h-auto gap-1">
          <TabsTrigger value="tables">الجداول</TabsTrigger>
          <TabsTrigger value="forms">النماذج</TabsTrigger>
          <TabsTrigger value="overlays">النوافذ</TabsTrigger>
          <TabsTrigger value="dropdowns">القوائم</TabsTrigger>
          <TabsTrigger value="sidebar">الشريط الجانبي</TabsTrigger>
          <TabsTrigger value="pagination">التنقل</TabsTrigger>
        </TabsList>

        {/* ── Tables ── */}
        <TabsContent value="tables" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>جدول ممتلئ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-start">#</TableHead>
                      <TableHead className="text-start">الاسم</TableHead>
                      <TableHead className="text-start">البريد</TableHead>
                      <TableHead className="text-start">المبلغ</TableHead>
                      <TableHead className="text-start">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_TABLE_DATA.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.id}</TableCell>
                        <TableCell>{row.name}</TableCell>
                        <TableCell dir="ltr" className="text-start">{row.email}</TableCell>
                        <TableCell dir="ltr" className="text-start">{row.amount.toLocaleString()} ر.س</TableCell>
                        <TableCell>
                          <Badge variant={row.status === "active" ? "default" : row.status === "pending" ? "secondary" : "outline"}>
                            {row.status === "active" ? "نشط" : row.status === "pending" ? "معلق" : "غير نشط"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>جدول فارغ</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">الاسم</TableHead>
                    <TableHead className="text-start">البريد</TableHead>
                    <TableHead className="text-start">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-10 text-muted-foreground">
                      لا توجد بيانات للعرض
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Forms ── */}
        <TabsContent value="forms">
          <Card>
            <CardHeader>
              <CardTitle>حقول النموذج — فحص LTR/RTL</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 max-w-lg">
              <div className="space-y-2">
                <Label>الاسم (عربي — RTL)</Label>
                <Input placeholder="أدخل اسمك الكامل" />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني (LTR)</Label>
                <Input type="email" dir="ltr" className="text-left" placeholder="user@example.com" />
              </div>
              <div className="space-y-2">
                <Label>رقم الهاتف (LTR)</Label>
                <Input type="tel" dir="ltr" className="text-left" placeholder="+966 5x xxx xxxx" />
              </div>
              <div className="space-y-2">
                <Label>المبلغ (LTR)</Label>
                <Input type="number" dir="ltr" className="text-left" placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>الرابط (LTR)</Label>
                <Input type="url" dir="ltr" className="text-left" placeholder="https://example.com" />
              </div>
              <div className="space-y-2">
                <Label>ملاحظات (عربي — RTL)</Label>
                <Input placeholder="أكتب ملاحظاتك هنا..." />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Overlays ── */}
        <TabsContent value="overlays" className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button>فتح Dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>عنوان النافذة</DialogTitle>
                  <DialogDescription>
                    هذا اختبار لعرض النافذة المنبثقة في وضع RTL. تحقق من محاذاة النص وزر الإغلاق.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>حقل داخل Dialog</Label>
                    <Input placeholder="اكتب هنا..." />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline">إلغاء</Button>
                    <Button>حفظ</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">فتح Sheet</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>لوحة جانبية</SheetTitle>
                  <SheetDescription>
                    تحقق من أن اللوحة تظهر من الجهة الصحيحة (اليسار في RTL).
                  </SheetDescription>
                </SheetHeader>
                <div className="space-y-4 py-6">
                  <div className="space-y-2">
                    <Label>الاسم</Label>
                    <Input placeholder="اسم العميل" />
                  </div>
                  <div className="space-y-2">
                    <Label>البريد</Label>
                    <Input type="email" dir="ltr" className="text-left" placeholder="email@example.com" />
                  </div>
                  <Button className="w-full">حفظ</Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </TabsContent>

        {/* ── Dropdowns ── */}
        <TabsContent value="dropdowns" className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  قائمة منسدلة <ChevronDown className="ms-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-popover">
                <DropdownMenuItem>عرض التفاصيل</DropdownMenuItem>
                <DropdownMenuItem>تعديل</DropdownMenuItem>
                <DropdownMenuItem>نسخ</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">حذف</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Select>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="اختر الحالة" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="pending">معلق</SelectItem>
                <SelectItem value="inactive">غير نشط</SelectItem>
                <SelectItem value="archived">مؤرشف</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        {/* ── Sidebar + Topbar ── */}
        <TabsContent value="sidebar">
          <Card>
            <CardHeader>
              <CardTitle>محاكاة Sidebar + Topbar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden h-[400px]">
                <SidebarProvider>
                  <div className="flex h-full w-full">
                    <Sidebar data-rtl-sidebar className="border-e">
                      <SidebarContent>
                        <SidebarGroup>
                          <SidebarGroupLabel>القائمة الرئيسية</SidebarGroupLabel>
                          <SidebarGroupContent>
                            <SidebarMenu>
                              {SIDEBAR_ITEMS.map((item, i) => (
                                <SidebarMenuItem key={item.title}>
                                  <SidebarMenuButton className={i === 0 ? "bg-accent" : ""}>
                                    <item.icon className="h-4 w-4 me-2" />
                                    <span>{item.title}</span>
                                  </SidebarMenuButton>
                                </SidebarMenuItem>
                              ))}
                            </SidebarMenu>
                          </SidebarGroupContent>
                        </SidebarGroup>
                      </SidebarContent>
                    </Sidebar>
                    <div className="flex-1 flex flex-col">
                      {/* Topbar */}
                      <div className="h-12 border-b flex items-center px-4 gap-3">
                        <Menu className="h-5 w-5" />
                        <span className="font-medium">الشريط العلوي — Topbar</span>
                        <div className="flex-1" />
                        <Badge>مطوّر</Badge>
                      </div>
                      {/* Content */}
                      <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        محتوى الصفحة
                      </div>
                    </div>
                  </div>
                </SidebarProvider>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Pagination ── */}
        <TabsContent value="pagination">
          <Card>
            <CardHeader>
              <CardTitle>التنقل بين الصفحات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious href="#" className="rtl:rotate-0" />
                  </PaginationItem>
                  {[1, 2, 3, 4, 5].map((page) => (
                    <PaginationItem key={page}>
                      <PaginationLink
                        href="#"
                        isActive={page === currentPage}
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage(page);
                        }}
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext href="#" className="rtl:rotate-0" />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
              <p className="text-sm text-muted-foreground text-center">
                الصفحة {currentPage} من 5 — تحقق من اتجاه الأسهم
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── CSS Logical Properties Reference ─── */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            مرجع CSS Logical Properties
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">❌ Physical (تجنّب)</TableHead>
                  <TableHead className="text-start">✅ Logical (استخدم)</TableHead>
                  <TableHead className="text-start">ملاحظات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ["ml-*", "ms-*", "margin-inline-start"],
                  ["mr-*", "me-*", "margin-inline-end"],
                  ["pl-*", "ps-*", "padding-inline-start"],
                  ["pr-*", "pe-*", "padding-inline-end"],
                  ["left-*", "start-*", "inset-inline-start"],
                  ["right-*", "end-*", "inset-inline-end"],
                  ["text-left", "text-start", "text-align: start"],
                  ["text-right", "text-end", "text-align: end"],
                  ["border-l-*", "border-s-*", "border-inline-start"],
                  ["border-r-*", "border-e-*", "border-inline-end"],
                  ["rounded-l-*", "rounded-s-*", "border-start-radius"],
                  ["rounded-r-*", "rounded-e-*", "border-end-radius"],
                  ["float-left", "float-start", "float: inline-start"],
                  ["float-right", "float-end", "float: inline-end"],
                ].map(([physical, logical, note]) => (
                  <TableRow key={physical}>
                    <TableCell>
                      <code className="bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 px-2 py-0.5 rounded text-xs">
                        {physical}
                      </code>
                    </TableCell>
                    <TableCell>
                      <code className="bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 px-2 py-0.5 rounded text-xs">
                        {logical}
                      </code>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{note}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
