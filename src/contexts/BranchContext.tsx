import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Branch {
  id: string;
  tenant_id: string;
  name: string;
  name_en: string | null;
  code: string | null;
  address_city: string | null;
  address_street: string | null;
  address_zip: string | null;
  phone: string | null;
  email: string | null;
  manager_id: string | null;
  is_active: boolean;
  is_main: boolean;
  created_at: string;
  updated_at: string;
}

interface BranchContextValue {
  branches: Branch[];
  activeBranchId: string | null;
  activeBranch: Branch | null;
  setActiveBranchId: (id: string | null) => void;
  isAdmin: boolean;
  loading: boolean;
  refetch: () => void;
}

const BranchContext = createContext<BranchContextValue>({
  branches: [],
  activeBranchId: null,
  activeBranch: null,
  setActiveBranchId: () => {},
  isAdmin: false,
  loading: true,
  refetch: () => {},
});

export const useBranch = () => useContext(BranchContext);

export const BranchProvider = ({ children }: { children: ReactNode }) => {
  const { tenantId, user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchBranches = async () => {
    if (!tenantId) return;

    const { data } = await supabase
      .from("branches")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("is_main", { ascending: false });

    if (data) {
      setBranches(data as Branch[]);
      // Default to "all branches" for admins, main branch for others
      if (!activeBranchId && data.length > 0) {
        const mainBranch = data.find((b: any) => b.is_main);
        if (isAdmin) {
          setActiveBranchId(null); // null = all branches (consolidated)
        } else {
          setActiveBranchId(mainBranch?.id || data[0].id);
        }
      }
    }
    setLoading(false);
  };

  // Check if user is admin/owner
  useEffect(() => {
    if (!tenantId || !user) return;
    supabase
      .from("tenant_members")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        const adminRoles = ["owner", "admin"];
        setIsAdmin(adminRoles.includes(data?.role || ""));
      });
  }, [tenantId, user]);

  useEffect(() => {
    fetchBranches();
  }, [tenantId, isAdmin]);

  // Realtime subscription
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel("branches-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "branches", filter: `tenant_id=eq.${tenantId}` }, () => fetchBranches())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  const activeBranch = activeBranchId ? branches.find((b) => b.id === activeBranchId) || null : null;

  return (
    <BranchContext.Provider value={{ branches, activeBranchId, activeBranch, setActiveBranchId, isAdmin, loading, refetch: fetchBranches }}>
      {children}
    </BranchContext.Provider>
  );
};
