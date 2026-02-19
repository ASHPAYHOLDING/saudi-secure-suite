import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { secureRpc } from "@/lib/secure-rpc";
import { useQueryClient } from "@tanstack/react-query";
import { ENTITLEMENTS_CACHE_KEY, fetchEntitlementsBulk } from "@/contexts/EntitlementsContext";
import type { User, Session } from "@supabase/supabase-js";
import type { TenantType } from "@/lib/tenant-modules";
import type { AppRole } from "@/lib/roles";

export interface TenantInfo {
  id: string;
  name: string;
  nameEn: string | null;
  logoUrl: string | null;
  role: AppRole;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  tenantId: string | null;
  tenantType: TenantType | null;
  userRole: AppRole | null;
  profile: { full_name: string; full_name_en: string | null; email: string; phone: string | null; job_title: string | null; language: string; timezone: string } | null;
  /** All tenants the current user belongs to */
  userTenants: TenantInfo[];
  /** Switch to a different tenant without logging out */
  switchTenant: (tenantId: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  tenantId: null,
  tenantType: null,
  userRole: null,
  profile: null,
  userTenants: [],
  switchTenant: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantType, setTenantType] = useState<TenantType | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<{ full_name: string; full_name_en: string | null; email: string; phone: string | null; job_title: string | null; language: string; timezone: string } | null>(null);
  const [userTenants, setUserTenants] = useState<TenantInfo[]>([]);

  // Load tenant-specific data (type + role)
  const loadTenantData = useCallback(async (tid: string, userId: string) => {
    const [tenantRes, memberRes] = await Promise.all([
      supabase.from("tenants").select("tenant_type").eq("id", tid).single(),
      supabase.from("tenant_members").select("role").eq("tenant_id", tid).eq("user_id", userId).single(),
    ]);
    setTenantType((tenantRes.data?.tenant_type as TenantType) ?? "company");
    setUserRole((memberRes.data?.role as AppRole) ?? null);
  }, []);

  // Load all tenants the user belongs to
  const loadUserTenants = useCallback(async (userId: string) => {
    const { data: memberships } = await supabase
      .from("tenant_members")
      .select("tenant_id, role, tenants:tenant_id(id, name, name_en, logo_url)")
      .eq("user_id", userId);

    if (memberships) {
      const tenants: TenantInfo[] = memberships
        .filter((m: any) => m.tenants)
        .map((m: any) => ({
          id: m.tenants.id,
          name: m.tenants.name,
          nameEn: m.tenants.name_en,
          logoUrl: m.tenants.logo_url,
          role: m.role as AppRole,
        }));
      setUserTenants(tenants);
    }
  }, []);

  // Switch tenant
  const switchTenant = useCallback(async (newTenantId: string) => {
    if (!user || newTenantId === tenantId) return;

    // Verify user has access
    const target = userTenants.find((t) => t.id === newTenantId);
    if (!target) return;

    setTenantId(newTenantId);
    setUserRole(target.role);

    // Update profile.tenant_id so the rest of the app picks up
    await supabase.from("profiles").update({ tenant_id: newTenantId }).eq("id", user.id);

    // Load tenant type
    const { data: tenantData } = await supabase.from("tenants").select("tenant_type").eq("id", newTenantId).single();
    setTenantType((tenantData?.tenant_type as TenantType) ?? "company");
  }, [user, tenantId, userTenants]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(async () => {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("full_name, full_name_en, email, phone, job_title, language, timezone, tenant_id")
              .eq("id", session.user.id)
              .single();

            if (profileData) {
              setProfile({ full_name: profileData.full_name, full_name_en: profileData.full_name_en, email: profileData.email, phone: profileData.phone, job_title: profileData.job_title, language: profileData.language, timezone: profileData.timezone });
              setTenantId(profileData.tenant_id);

              // Prefetch entitlements immediately so dashboard renders fast
              if (profileData.tenant_id) {
                queryClient.prefetchQuery({
                  queryKey: [ENTITLEMENTS_CACHE_KEY, profileData.tenant_id, 0],
                  queryFn: () => fetchEntitlementsBulk(profileData.tenant_id!),
                  staleTime: 5 * 60 * 1000,
                });
              }

              // Load all user tenants + current tenant data
              await loadUserTenants(session.user.id);
              if (profileData.tenant_id) {
                await loadTenantData(profileData.tenant_id, session.user.id);
                // Run subscription integrity check on login (fire-and-forget)
                secureRpc("check_subscription_integrity", { _tenant_id: profileData.tenant_id }).then(({ data, error }) => {
                  if (data && (data as any).fixes_count > 0) {
                    console.warn("[Integrity] Auto-corrected", (data as any).fixes_count, "issues");
                  }
                });
              }
            }
          }, 0);
        } else {
          setProfile(null);
          setTenantId(null);
          setTenantType(null);
          setUserRole(null);
          setUserTenants([]);
        }

        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setTenantId(null);
    setTenantType(null);
    setUserRole(null);
    setProfile(null);
    setUserTenants([]);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, tenantId, tenantType, userRole, profile, userTenants, switchTenant, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
