/**
 * MFA (TOTP) Helpers
 * ─────────────────
 * Wraps Supabase Auth MFA API with clean, typed helpers.
 * All functions are async and return Supabase's native response shapes.
 *
 * Flow:
 *   enrollTotp() → QR + secret + factorId
 *   challengeFactor(factorId) → challengeId
 *   verifyChallenge(factorId, challengeId, code) → session elevated to AAL2
 *   unenrollFactor(factorId) → factor removed
 *   hasVerifiedTotp() → boolean (has at least one verified TOTP factor)
 *   isSessionAal2() → boolean (current session is AAL2)
 */

import { supabase } from "@/integrations/supabase/client";

/** List all MFA factors for the current user */
export const listFactors = () => supabase.auth.mfa.listFactors();

/** Enroll a new TOTP factor */
export const enrollTotp = (friendlyName = "تطبيق المصادقة") =>
  supabase.auth.mfa.enroll({ factorType: "totp", friendlyName });

/** Create a challenge for a given factor */
export const challengeFactor = (factorId: string) =>
  supabase.auth.mfa.challenge({ factorId });

/** Verify a challenge with a 6-digit TOTP code */
export const verifyChallenge = (factorId: string, challengeId: string, code: string) =>
  supabase.auth.mfa.verify({ factorId, challengeId, code });

/** Remove (unenroll) a TOTP factor */
export const unenrollFactor = (factorId: string) =>
  supabase.auth.mfa.unenroll({ factorId });

/** Check if user has at least one verified TOTP factor */
export const hasVerifiedTotp = async (): Promise<boolean> => {
  const { data, error } = await listFactors();
  if (error || !data) return false;
  return data.totp.some((f) => f.status === "verified");
};

/**
 * Check if the current session has AAL2 (i.e. MFA was verified this session).
 * Returns true if current AAL is aal2, false otherwise.
 */
export const isSessionAal2 = async (): Promise<boolean> => {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  return data.currentLevel === "aal2";
};

/**
 * Combined check: user has verified MFA factor AND session is AAL2.
 * Use this to determine if user has "completed" MFA for this session.
 */
export const hasVerifiedMfaSession = async (): Promise<boolean> => {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  // If nextLevel is aal2, user has a factor enrolled.
  // If currentLevel is aal2, user has verified this session.
  return data.currentLevel === "aal2";
};
