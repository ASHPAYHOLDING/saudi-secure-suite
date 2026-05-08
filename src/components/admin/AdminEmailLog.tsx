import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Mail,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Clock,
  RefreshCw,
  Search,
  Inbox,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

type EmailLogRow = {
  id: string;
  message_id: string | null;
  template_name: string | null;
  recipient_email: string | null;
  status: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type RangePreset = "24h" | "7d" | "30d";

const RANGE_LABELS: Record<RangePreset, string> = {
  "24h": "آخر 24 ساعة",
  "7d": "آخر 7 أيام",
  "30d": "آخر 30 يوماً",
};

const STATUS_META: Record<
  string,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  sent: {
    label: "مُرسلة",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: CheckCircle2,
  },
  pending: {
    label: "قيد الإرسال",
    className: "bg-amber-100 text-amber-800 border-amber-200",
    icon: Clock,
  },
  dlq: {
    label: "فشل نهائي",
    className: "bg-rose-100 text-rose-800 border-rose-200",
    icon: XCircle,
  },
  failed: {
    label: "فشل",
    className: "bg-rose-100 text-rose-800 border-rose-200",
    icon: XCircle,
  },
  suppressed: {
    label: "مُعلَّقة",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
    icon: ShieldAlert,
  },
  bounced: {
    label: "مرتدة",
    className: "bg-orange-100 text-orange-800 border-orange-200",
    icon: AlertTriangle,
  },
  complained: {
    label: "شكوى",
    className: "bg-purple-100 text-purple-800 border-purple-200",
    icon: AlertTriangle,
  },
};

const TEMPLATE_LABELS: Record<string, string> = {
  auth_emails: "بريد المصادقة",
  signup: "تأكيد التسجيل",
  recovery: "استعادة كلمة المرور",
  magiclink: "رابط سحري",
  invite: "دعوة",
  email_change: "تغيير البريد",
  reauthentication: "إعادة التحقق",
};

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
    numberingSystem: "latn",
  }).format(new Date(iso));

const getRangeStart = (preset: RangePreset): Date => {
  const now = new Date();
  if (preset === "24h") return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (preset === "7d") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
};

const StatusBadge = ({ status }: { status: string | null }) => {
  const meta = STATUS_META[status ?? ""] ?? {
    label: status ?? "غير معروف",
    className: "bg-muted text-muted-foreground border-border",
    icon: Mail,
  };
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={`${meta.className} gap-1 font-medium`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
};

const StatCard = ({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Mail;
  tone: string;
}) => (
  <Card>
    <CardContent className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{label}</p>
          <p className="text-3xl font-bold tabular-nums">{value.toLocaleString("ar-SA", { numberingSystem: "latn" })}</p>
        </div>
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const PAGE_SIZE = 50;

const AdminEmailLog = () => {
  const [rows, setRows] = useState<EmailLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangePreset>("7d");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const load = async () => {
    setLoading(true);
    const since = getRangeStart(range).toISOString();
    const { data, error } = await supabase
      .from("email_send_log")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000);

    if (error) {
      toast.error("تعذّر تحميل السجل", { description: error.message });
      setRows([]);
    } else {
      setRows((data ?? []) as EmailLogRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  // Deduplicate by message_id keeping latest row
  const dedupedRows = useMemo(() => {
    const seen = new Map<string, EmailLogRow>();
    for (const r of rows) {
      const key = r.message_id ?? r.id;
      if (!seen.has(key)) seen.set(key, r);
    }
    return Array.from(seen.values());
  }, [rows]);

  const templateOptions = useMemo(() => {
    const set = new Set<string>();
    dedupedRows.forEach((r) => r.template_name && set.add(r.template_name));
    return Array.from(set).sort();
  }, [dedupedRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dedupedRows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (templateFilter !== "all" && r.template_name !== templateFilter) return false;
      if (q) {
        const hay = `${r.recipient_email ?? ""} ${r.message_id ?? ""} ${r.error_message ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [dedupedRows, statusFilter, templateFilter, search]);

  const stats = useMemo(() => {
    const s = { total: filtered.length, sent: 0, failed: 0, suppressed: 0 };
    filtered.forEach((r) => {
      if (r.status === "sent") s.sent++;
      else if (r.status === "dlq" || r.status === "failed" || r.status === "bounced") s.failed++;
      else if (r.status === "suppressed" || r.status === "complained") s.suppressed++;
    });
    return s;
  }, [filtered]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            سجل إرسال البريد
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            سجل تشغيلي لكل عمليات إرسال البريد عبر <span className="font-semibold">notify.numaxio.com</span> — للمراجعة والتدقيق.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          تحديث
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="إجمالي الرسائل" value={stats.total} icon={Inbox} tone="bg-primary/10 text-primary" />
        <StatCard label="مُرسلة بنجاح" value={stats.sent} icon={CheckCircle2} tone="bg-emerald-100 text-emerald-700" />
        <StatCard label="فاشلة" value={stats.failed} icon={XCircle} tone="bg-rose-100 text-rose-700" />
        <StatCard label="مُعلَّقة / شكاوى" value={stats.suppressed} icon={ShieldAlert} tone="bg-yellow-100 text-yellow-700" />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">الفلاتر</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Select value={range} onValueChange={(v) => setRange(v as RangePreset)}>
            <SelectTrigger>
              <SelectValue placeholder="الفترة" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RANGE_LABELS) as RangePreset[]).map((k) => (
                <SelectItem key={k} value={k}>{RANGE_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger>
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="sent">مُرسلة</SelectItem>
              <SelectItem value="pending">قيد الإرسال</SelectItem>
              <SelectItem value="dlq">فشل نهائي</SelectItem>
              <SelectItem value="failed">فشل</SelectItem>
              <SelectItem value="suppressed">مُعلَّقة</SelectItem>
              <SelectItem value="bounced">مرتدة</SelectItem>
              <SelectItem value="complained">شكوى</SelectItem>
            </SelectContent>
          </Select>

          <Select value={templateFilter} onValueChange={(v) => { setTemplateFilter(v); setPage(0); }}>
            <SelectTrigger>
              <SelectValue placeholder="نوع القالب" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأنواع</SelectItem>
              {templateOptions.map((t) => (
                <SelectItem key={t} value={t}>
                  {TEMPLATE_LABELS[t] ?? t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث (بريد، معرف، خطأ...)"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pr-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            النتائج ({filtered.length.toLocaleString("ar-SA", { numberingSystem: "latn" })})
          </CardTitle>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                السابق
              </Button>
              <span className="tabular-nums text-muted-foreground">
                {page + 1} / {totalPages}
              </span>
              <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                التالي
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : paginated.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Inbox className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>لا توجد رسائل تطابق الفلاتر الحالية.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">المستلم</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">المعرف</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">الخطأ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {TEMPLATE_LABELS[r.template_name ?? ""] ?? r.template_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-foreground" dir="ltr" style={{ textAlign: "right" }}>
                        {r.recipient_email ?? "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono" dir="ltr" style={{ textAlign: "right" }}>
                        {r.message_id ? r.message_id.slice(0, 18) + "…" : "—"}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums whitespace-nowrap">
                        {formatDate(r.created_at)}
                      </TableCell>
                      <TableCell className="text-xs text-rose-700 max-w-xs truncate">
                        {r.error_message ?? ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminEmailLog;
