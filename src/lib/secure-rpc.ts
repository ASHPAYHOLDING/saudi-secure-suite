import { supabase } from "@/integrations/supabase/client";

/**
 * Calls a protected database function via the secure-rpc Edge Function.
 * This replaces direct supabase.rpc() calls for WRITE functions
 * that have been revoked from the authenticated role.
 */
export async function secureRpc<T = any>(
  fn: string,
  params: Record<string, any> = {}
): Promise<{ data: T | null; error: { message: string; code?: string } | null }> {
  const { data: result, error } = await supabase.functions.invoke("secure-rpc", {
    body: { fn, params },
  });

  if (error) {
    return { data: null, error: { message: error.message } };
  }

  // The edge function returns { data } or { error }
  if (result?.error) {
    return { data: null, error: { message: result.error, code: result.code } };
  }

  return { data: result?.data ?? null, error: null };
}
