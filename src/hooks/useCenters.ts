import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface CenterOption { id: string; name: string; code: string | null; }

export const useCenters = () => {
  const { tenantId } = useAuth();
  const [costCenters, setCostCenters] = useState<CenterOption[]>([]);
  const [profitCenters, setProfitCenters] = useState<CenterOption[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    Promise.all([
      supabase.from("cost_centers" as any).select("id, name, code").eq("tenant_id", tenantId).eq("is_active", true).order("code"),
      supabase.from("profit_centers" as any).select("id, name, code").eq("tenant_id", tenantId).eq("is_active", true).order("code"),
    ]).then(([cc, pc]) => {
      setCostCenters((cc.data as any[]) || []);
      setProfitCenters((pc.data as any[]) || []);
    });
  }, [tenantId]);

  return { costCenters, profitCenters };
};
