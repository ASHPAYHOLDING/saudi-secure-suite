import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Tracks page_view events for usage analytics.
 * Only records: tenant_id, user_id, route, category. No PII or payloads.
 */
export const usePageTracking = () => {
  const location = useLocation();
  const { user, tenantId } = useAuth();
  const lastTracked = useRef<string>("");

  useEffect(() => {
    const route = location.pathname;
    // Deduplicate same route
    if (!user?.id || lastTracked.current === route) return;
    lastTracked.current = route;

    // Derive category from route prefix
    let category = "other";
    if (route.startsWith("/admin")) category = "admin";
    else if (route.startsWith("/dashboard")) category = "dashboard";
    else if (route.startsWith("/debug")) category = "debug";
    else if (route === "/" || route.startsWith("/auth")) category = "public";

    // Fire-and-forget via SECURITY DEFINER RPC
    supabase.rpc("track_usage_event" as any, {
      p_tenant_id: tenantId || null,
      p_user_id: user.id,
      p_event_type: "page_view",
      p_route: route,
      p_category: category,
      p_metadata: {},
    }).then(() => {});
  }, [location.pathname, user?.id, tenantId]);
};
