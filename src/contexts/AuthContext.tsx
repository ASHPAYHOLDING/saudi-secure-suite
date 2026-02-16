import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  tenantId: string | null;
  profile: { full_name: string; email: string } | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  tenantId: null,
  profile: null,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ full_name: string; email: string } | null>(null);

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
              .select("full_name, email, tenant_id")
              .eq("id", session.user.id)
              .single();

            if (profileData) {
              setProfile({ full_name: profileData.full_name, email: profileData.email });
              setTenantId(profileData.tenant_id);
            }
          }, 0);
        } else {
          setProfile(null);
          setTenantId(null);
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
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, tenantId, profile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
