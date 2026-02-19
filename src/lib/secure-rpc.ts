import { supabase } from "@/integrations/supabase/client";

/**
 * Generate a correlation ID for end-to-end request tracing.
 * Format: "fe-<uuid>" to distinguish frontend-originated IDs.
 */
export function generateCorrelationId(): string {
  return `fe-${crypto.randomUUID()}`;
}

/**
 * Calls a protected database function via the secure-rpc Edge Function.
 * This replaces direct supabase.rpc() calls for WRITE functions
 * that have been revoked from the authenticated role.
 *
 * Automatically attaches a correlation ID for end-to-end tracing.
 */
export async function secureRpc<T = any>(
  fn: string,
  params: Record<string, any> = {},
  correlationId?: string,
): Promise<{ data: T | null; error: { message: string; code?: string } | null; correlationId: string }> {
  const cid = correlationId || generateCorrelationId();

  const { data: result, error } = await supabase.functions.invoke("secure-rpc", {
    body: { fn, params },
    headers: { "x-correlation-id": cid },
  });

  if (error) {
    return { data: null, error: { message: error.message }, correlationId: cid };
  }

  // The edge function returns { data } or { error }
  if (result?.error) {
    return { data: null, error: { message: result.error, code: result.code }, correlationId: cid };
  }

  return { data: result?.data ?? null, error: null, correlationId: cid };
}
