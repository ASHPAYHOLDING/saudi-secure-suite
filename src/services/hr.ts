/** HR Domain Service */
import { secureRpc } from "@/lib/secure-rpc";
import type { ServiceResult } from "./types";

export const HrService = {
  /** Invite a team member (emits domain event) */
  async inviteMember(
    tenantId: string,
    email: string,
    role = "viewer",
    invitedBy?: string,
  ): Promise<ServiceResult<string>> {
    const { data, error } = await secureRpc("hr_invite_member", {
      p_tenant_id: tenantId,
      p_email: email,
      p_role: role,
      p_invited_by: invitedBy ?? null,
    });
    return { data: data as string | null, error: error?.message ?? null };
  },
};
