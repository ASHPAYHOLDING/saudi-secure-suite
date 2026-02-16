import { useEffect, useState } from "react";
import { Building2, Users, CreditCard, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  totalCompanies: number;
  activeSubscriptions: number;
  totalUsers: number;
  trialSubscriptions: number;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalCompanies: 0,
    activeSubscriptions: 0,
    totalUsers: 0,
    trialSubscriptions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [tenantsRes, subsRes, profilesRes, trialRes] = await Promise.all([
          supabase.from("tenants").select("id", { count: "exact", head: true }),
          supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "trial"),
        ]);
        setStats({
          totalCompanies: tenantsRes.count ?? 0,
          activeSubscriptions: subsRes.count ?? 0,
          totalUsers: profilesRes.count ?? 0,
          trialSubscriptions: trialRes.count ?? 0,
        });
      } catch (err) {
        console.error("Error fetching admin stats:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const cards = [
    { title: "إجمالي الشركات", value: stats.totalCompanies, icon: Building2, color: "text-accent" },
    { title: "الاشتراكات النشطة", value: stats.activeSubscriptions, icon: CreditCard, color: "text-emerald-500" },
    { title: "المستخدمين", value: stats.totalUsers, icon: Users, color: "text-blue-500" },
    { title: "الفترات التجريبية", value: stats.trialSubscriptions, icon: TrendingUp, color: "text-amber-500" },
  ];

  return (
    <div className="p-6" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">لوحة تحكم المنصة</h1>
        <p className="text-sm text-muted-foreground">نظرة عامة على إحصائيات نيوماكسيو</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-8 w-16 animate-pulse rounded bg-muted" />
              ) : (
                <div className="text-3xl font-bold text-foreground">{card.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
