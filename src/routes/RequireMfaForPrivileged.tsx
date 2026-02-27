/**
 * RequireMfaForPrivileged
 * ───────────────────────
 * Enforces MFA (TOTP) for privileged roles (owner, admin).
 *
 * Logic:
 * 1. If user is not owner/admin → pass through (no enforcement)
 * 2. If owner/admin without a verified TOTP factor → redirect to /dashboard/settings/security
 * 3. If owner/admin with TOTP but session is AAL1 → redirect to /dashboard/settings/security
 * 4. If owner/admin with AAL2 session → pass through
 *
 * Exempt routes (to prevent redirect loops):
 *   /dashboard/settings/security, /dashboard/support/*, /dashboard/help
 */
import { useEffect, useState, type ReactNode } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import PageLoadingSkeleton from "@/components/ui/PageLoadingSkeleton";

/** Roles that require MFA */
const PRIVILEGED_ROLES = new Set(["owner", "admin"]);

/** Routes exempt from MFA enforcement (prevent redirect loops) */
const EXEMPT_PREFIXES = [
  "/dashboard/settings/security",
  "/dashboard/support",
  "/dashboard/help",
];

interface Props {
  children: ReactNode;
}

export default function RequireMfaForPrivileged({ children }: Props) {
  const { userRole, user } = useAuth();
  const location = useLocation();
  const [state, setState] = useState<"loading" | "allowed" | "blocked">("loading");

  // Check if current route is exempt
  const isExempt = EXEMPT_PREFIXES.some((prefix) =>
    location.pathname.startsWith(prefix)
  );

  useEffect(() => {
    // Non-privileged roles or no user → allow
    if (!user || !userRole || !PRIVILEGED_ROLES.has(userRole)) {
      setState("allowed");
      return;
    }

    // Exempt routes → allow (prevent loops)
    if (isExempt) {
      setState("allowed");
      return;
    }

    const checkMfa = async () => {
      try {
        const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (error) {
          // Fail-open on error to not block user
          setState("allowed");
          return;
        }

        // If nextLevel is aal1, user has no enrolled factors → block
        // If nextLevel is aal2 but currentLevel is aal1 → factor enrolled but not verified this session → block
        // If currentLevel is aal2 → fully verified → allow
        if (data.currentLevel === "aal2") {
          setState("allowed");
        } else if (data.nextLevel === "aal2") {
          // Factor exists but not verified this session
          setState("blocked");
        } else {
          // No factor enrolled at all
          setState("blocked");
        }
      } catch {
        setState("allowed"); // fail-open
      }
    };

    checkMfa();
  }, [user, userRole, isExempt, location.pathname]);

  if (state === "loading") {
    return <PageLoadingSkeleton />;
  }

  if (state === "blocked") {
    return (
      <Navigate
        to="/dashboard/settings/security"
        replace
        state={{ mfaRequired: true }}
      />
    );
  }

  return <>{children}</>;
}
