import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2, AlertTriangle, XCircle, Clock, Activity, Wrench,
  ChevronDown, ChevronUp, ExternalLink, RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; bg: string }> = {
  operational: { label: "يعمل بشكل طبيعي", color: "text-emerald-500", icon: CheckCircle2, bg: "bg-emerald-500/10" },
  degraded: { label: "أداء منخفض", color: "text-amber-500", icon: AlertTriangle, bg: "bg-amber-500/10" },
  partial_outage: { label: "عطل جزئي", color: "text-orange-500", icon: AlertTriangle, bg: "bg-orange-500/10" },
  major_outage: { label: "عطل كامل", color: "text-red-500", icon: XCircle, bg: "bg-red-500/10" },
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string }> = {
  minor: { label: "طفيف", color: "text-amber-600 bg-amber-500/10 border-amber-500/20" },
  major: { label: "كبير", color: "text-orange-600 bg-orange-500/10 border-orange-500/20" },
  critical: { label: "حرج", color: "text-red-600 bg-red-500/10 border-red-500/20" },
};

const INCIDENT_STATUS_AR: Record<string, string> = {
  investigating: "قيد التحقيق",
  identified: "تم التحديد",
  monitoring: "قيد المراقبة",
  resolved: "تم الحل",
};

const CATEGORY_AR: Record<string, string> = {
  core: "الخدمات الأساسية",
  api: "واجهات البرمجة",
  integration: "التكاملات",
};

interface Service {
  id: string;
  name: string;
  name_ar: string;
  category: string;
  is_active: boolean;
  display_order: number;
}

interface HealthCheck {
  service_id: string;
  status: string;
  response_time_ms: number | null;
  checked_at: string;
}

interface Incident {
  id: string;
  title_ar: string;
  description_ar: string | null;
  severity: string;
  status: string;
  started_at: string;
  resolved_at: string | null;
  updates: { id: string; status: string; message_ar: string | null; message: string; created_at: string }[];
}

interface UptimeDay {
  service_id: string;
  date: string;
  uptime_percent: number;
}

interface MaintenanceWindow {
  id: string;
  title_ar: string;
  description_ar: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
}

const StatusPage = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [latestChecks, setLatestChecks] = useState<Record<string, HealthCheck>>({});
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [uptimeData, setUptimeData] = useState<Record<string, UptimeDay[]>>({});
  const [maintenance, setMaintenance] = useState<MaintenanceWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);

    const [servicesRes, checksRes, incidentsRes, updatesRes, uptimeRes, maintenanceRes] = await Promise.all([
      supabase.from("platform_services").select("*").eq("is_active", true).order("display_order"),
      supabase.from("health_checks").select("*").order("checked_at", { ascending: false }).limit(50),
      supabase.from("platform_incidents").select("*").order("started_at", { ascending: false }).limit(20),
      supabase.from("incident_updates").select("*").order("created_at", { ascending: true }),
      supabase.from("uptime_daily").select("*").gte("date", new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)).order("date", { ascending: true }),
      supabase.from("maintenance_windows").select("*").gte("ends_at", new Date().toISOString()).order("starts_at"),
    ]);

    setServices((servicesRes.data as any[]) || []);

    // Latest check per service
    const checksMap: Record<string, HealthCheck> = {};
    for (const check of (checksRes.data as any[]) || []) {
      if (!checksMap[check.service_id]) checksMap[check.service_id] = check;
    }
    setLatestChecks(checksMap);

    // Incidents with updates
    const updatesMap: Record<string, any[]> = {};
    for (const u of (updatesRes.data as any[]) || []) {
      if (!updatesMap[u.incident_id]) updatesMap[u.incident_id] = [];
      updatesMap[u.incident_id].push(u);
    }
    setIncidents(
      ((incidentsRes.data as any[]) || []).map((inc) => ({
        ...inc,
        updates: updatesMap[inc.id] || [],
      }))
    );

    // Uptime grouped by service
    const uptimeMap: Record<string, UptimeDay[]> = {};
    for (const u of (uptimeRes.data as any[]) || []) {
      if (!uptimeMap[u.service_id]) uptimeMap[u.service_id] = [];
      uptimeMap[u.service_id].push(u);
    }
    setUptimeData(uptimeMap);

    setMaintenance((maintenanceRes.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const overallStatus = () => {
    const statuses = Object.values(latestChecks).map((c) => c.status);
    if (statuses.includes("major_outage")) return "major_outage";
    if (statuses.includes("partial_outage")) return "partial_outage";
    if (statuses.includes("degraded")) return "degraded";
    return "operational";
  };

  const overall = overallStatus();
  const overallConfig = STATUS_CONFIG[overall] || STATUS_CONFIG.operational;
  const OverallIcon = overallConfig.icon;

  const grouped = services.reduce<Record<string, Service[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  const activeIncidents = incidents.filter((i) => i.status !== "resolved");
  const resolvedIncidents = incidents.filter((i) => i.status === "resolved").slice(0, 10);

  const getServiceUptime90 = (serviceId: string): string => {
    const days = uptimeData[serviceId];
    if (!days || days.length === 0) return "100.00";
    const avg = days.reduce((sum, d) => sum + Number(d.uptime_percent), 0) / days.length;
    return avg.toFixed(2);
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Navbar />

      {/* Hero */}
      <section className="relative gradient-hero pt-32 pb-16 overflow-hidden">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`inline-flex items-center gap-3 rounded-2xl ${overallConfig.bg} border border-white/10 px-8 py-4 mb-6`}
          >
            <OverallIcon className={`h-8 w-8 ${overallConfig.color}`} />
            <span className={`text-xl font-bold ${overallConfig.color}`}>{overallConfig.label}</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-5xl font-bold text-white mb-3"
          >
            حالة المنصة
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-white/50 text-sm"
          >
            آخر تحديث: {new Date().toLocaleString("ar-SA")}
          </motion.p>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-4">
            <Button variant="ghost" size="sm" className="text-white/60 hover:text-white gap-2" onClick={fetchAll}>
              <RefreshCw className="h-3.5 w-3.5" />
              تحديث
            </Button>
          </motion.div>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-4xl -mt-8 relative z-10 space-y-8 pb-20">
        {/* Upcoming Maintenance */}
        {maintenance.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-bold text-blue-600">صيانة مجدولة</h3>
            </div>
            {maintenance.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm py-2 border-b border-blue-500/10 last:border-0">
                <span className="text-foreground font-medium">{m.title_ar}</span>
                <span className="text-muted-foreground text-xs font-mono" dir="ltr">
                  {new Date(m.starts_at).toLocaleDateString("ar-SA")} — {new Date(m.starts_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </motion.div>
        )}

        {/* Active Incidents */}
        {activeIncidents.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              حوادث نشطة
            </h2>
            <div className="space-y-3">
              {activeIncidents.map((inc) => (
                <IncidentCard
                  key={inc.id}
                  incident={inc}
                  expanded={expandedIncident === inc.id}
                  onToggle={() => setExpandedIncident(expandedIncident === inc.id ? null : inc.id)}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Service Status */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          {Object.entries(grouped).map(([category, categoryServices]) => (
            <div key={category} className="mb-6">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {CATEGORY_AR[category] || category}
              </h3>
              <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
                {categoryServices.map((service) => {
                  const check = latestChecks[service.id];
                  const status = check?.status || "operational";
                  const config = STATUS_CONFIG[status] || STATUS_CONFIG.operational;
                  const Icon = config.icon;
                  const uptime = getServiceUptime90(service.id);

                  return (
                    <div key={service.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <Icon className={`h-4 w-4 ${config.color}`} />
                        <span className="text-sm font-medium text-foreground">{service.name_ar}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        {/* Mini uptime bar (last 90 days) */}
                        <div className="hidden md:flex items-center gap-[2px]" title={`${uptime}% خلال 90 يوم`}>
                          {(uptimeData[service.id] || []).slice(-30).map((d, i) => (
                            <div
                              key={i}
                              className={`w-1 h-4 rounded-sm ${
                                Number(d.uptime_percent) >= 99.5 ? "bg-emerald-500" :
                                Number(d.uptime_percent) >= 95 ? "bg-amber-500" : "bg-red-500"
                              }`}
                            />
                          ))}
                          {(uptimeData[service.id] || []).length === 0 && (
                            Array.from({ length: 30 }).map((_, i) => (
                              <div key={i} className="w-1 h-4 rounded-sm bg-emerald-500/30" />
                            ))
                          )}
                        </div>
                        <span className="text-xs font-mono text-muted-foreground w-16 text-left" dir="ltr">
                          {uptime}%
                        </span>
                        <Badge variant="outline" className={`text-[10px] ${config.color} border-current/20`}>
                          {config.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Resolved Incidents History */}
        {resolvedIncidents.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              سجل الحوادث
            </h2>
            <div className="space-y-3">
              {resolvedIncidents.map((inc) => (
                <IncidentCard
                  key={inc.id}
                  incident={inc}
                  expanded={expandedIncident === inc.id}
                  onToggle={() => setExpandedIncident(expandedIncident === inc.id ? null : inc.id)}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Overall uptime summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-accent/20 bg-accent/5 p-6 text-center"
        >
          <Activity className="h-8 w-8 text-accent mx-auto mb-3" />
          <h3 className="text-xl font-bold text-foreground mb-1">99.9% SLA مضمون</h3>
          <p className="text-sm text-muted-foreground">
            نلتزم بتوفر المنصة بنسبة 99.9% شهرياً مع تعويضات واضحة
          </p>
          <a
            href="/sla"
            className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline mt-3"
          >
            عرض اتفاقية الخدمة
            <ExternalLink className="h-3 w-3" />
          </a>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
};

// ── Incident Card ──
const IncidentCard = ({
  incident,
  expanded,
  onToggle,
}: {
  incident: Incident;
  expanded: boolean;
  onToggle: () => void;
}) => {
  const sevConfig = SEVERITY_CONFIG[incident.severity] || SEVERITY_CONFIG.minor;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors text-right"
      >
        <div className="flex items-center gap-3 flex-1">
          <Badge variant="outline" className={`text-[10px] ${sevConfig.color}`}>
            {sevConfig.label}
          </Badge>
          <span className="text-sm font-medium text-foreground">{incident.title_ar}</span>
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            {INCIDENT_STATUS_AR[incident.status] || incident.status}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-mono" dir="ltr">
            {new Date(incident.started_at).toLocaleDateString("ar-SA")}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="border-t border-border px-5 py-4"
        >
          {incident.description_ar && (
            <p className="text-sm text-muted-foreground mb-4">{incident.description_ar}</p>
          )}
          {incident.updates.length > 0 && (
            <div className="space-y-3">
              {incident.updates.map((update) => (
                <div key={update.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-accent mt-1.5" />
                    <div className="flex-1 w-px bg-border" />
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[9px]">
                        {INCIDENT_STATUS_AR[update.status] || update.status}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-mono" dir="ltr">
                        {new Date(update.created_at).toLocaleString("ar-SA")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{update.message_ar || update.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {incident.resolved_at && (
            <p className="text-xs text-emerald-600 mt-2">
              ✓ تم الحل في {new Date(incident.resolved_at).toLocaleString("ar-SA")}
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default StatusPage;
