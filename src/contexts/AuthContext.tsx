import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { TenantType } from "@/lib/tenant-modules";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  tenantId: string | null;
  tenantType: TenantType | null;
  profile: { full_name: string; full_name_en: string | null; email: string; phone: string | null; job_title: string | null; language: string; timezone: string } | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  tenantId: null,
  tenantType: null,
  profile: null,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantType, setTenantType] = useState<TenantType | null>(null);
  const [profile, setProfile] = useState<{ full_name: string; full_name_en: string | null; email: string; phone: string | null; job_title: string | null; language: string; timezone: string } | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Fetch profile & tenant in a deferred way to avoid deadlocks
          setTimeout(async () => {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("full_name, full_name_en, email, phone, job_title, language, timezone, tenant_id")
              .eq("id", session.user.id)
              .single();

            if (profileData) {
              setProfile({ full_name: profileData.full_name, full_name_en: profileData.full_name_en, email: profileData.email, phone: profileData.phone, job_title: profileData.job_title, language: profileData.language, timezone: profileData.timezone });
              setTenantId(profileData.tenant_id);

              // Fetch tenant type
              if (profileData.tenant_id) {
                const { data: tenantData } = await supabase
                  .from("tenants")
                  .select("tenant_type")
                  .eq("id", profileData.tenant_id)
                  .single();
                setTenantType((tenantData?.tenant_type as TenantType) ?? "company");
              }
            }
          }, 0);
        } else {
          setProfile(null);
          setTenantId(null);
          setTenantType(null);
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
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, tenantId, tenantType, profile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
