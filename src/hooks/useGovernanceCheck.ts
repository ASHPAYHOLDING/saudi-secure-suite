/**
 * useGovernanceCheck — Client-side hook to call the governance policy check
 * via secure-rpc before sensitive operations.
 */
import { secureRpc } from "@/lib/secure-rpc";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";

interface GovernanceCheckParams {
  entityType: string;
  entityId?: string;
  action: string;
  amount?: number;
  metadata?: Record<string, any>;
}

interface GovernanceCheckResult {
  allowed: boolean;
  violations: Array<{
    policy_name: string;
    policy_type: string;
    reason: string;
    [key: string]: any;
  }>;
}

export function useGovernanceCheck() {
  const { user, tenantId } = useAuth();
  const { isRTL } = useLanguage();

  const checkPolicy = async (params: GovernanceCheckParams): Promise<GovernanceCheckResult> => {
    if (!tenantId || !user?.id) {
      return { allowed: true, violations: [] };
    }

    try {
      const { data, error } = await secureRpc<GovernanceCheckResult>("check_governance_policy", {
        p_tenant_id: tenantId,
        p_user_id: user.id,
        p_entity_type: params.entityType,
        p_entity_id: params.entityId || null,
        p_action: params.action,
        p_amount: params.amount || null,
        p_metadata: params.metadata || {},
      });

      if (error) {
        console.error("Governance check error:", error);
        // Fail-open: allow if governance check itself fails
        return { allowed: true, violations: [] };
      }

      if (data && !data.allowed) {
        const firstViolation = data.violations[0];
        toast.error(
          isRTL
            ? `⛔ انتهاك سياسة: ${firstViolation?.policy_name || "سياسة الحوكمة"}`
            : `⛔ Policy violation: ${firstViolation?.policy_name || "Governance policy"}`,
          {
            description: firstViolation?.reason,
            duration: 6000,
          }
        );
        return data;
      }

      return data || { allowed: true, violations: [] };
    } catch (err) {
      console.error("Governance check failed:", err);
      return { allowed: true, violations: [] };
    }
  };

  return { checkPolicy };
}
