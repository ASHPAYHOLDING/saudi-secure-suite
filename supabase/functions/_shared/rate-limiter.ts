/**
 * Rate Limiter Middleware for Edge Functions
 * Uses sliding window + block with Postgres-backed atomic checks.
 * 
 * Usage:
 *   import { checkRateLimit, RATE_LIMITS } from "../_shared/rate-limiter.ts";
 *   const blocked = await checkRateLimit(req, supabase, "auth", corsHeaders);
 *   if (blocked) return blocked;
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Rate Limit Configurations ───
export const RATE_LIMITS: Record<string, { maxRequests: number; windowSeconds: number; blockSeconds: number }> = {
  "auth":                  { maxRequests: 5,  windowSeconds: 60,  blockSeconds: 900 },
  "wallet":                { maxRequests: 10, windowSeconds: 60,  blockSeconds: 900 },
  "subscription_upgrade":  { maxRequests: 5,  windowSeconds: 60,  blockSeconds: 900 },
  "subscription_cancel":   { maxRequests: 5,  windowSeconds: 60,  blockSeconds: 900 },
  "invoice_send":          { maxRequests: 10, windowSeconds: 60,  blockSeconds: 900 },
  "webhook":               { maxRequests: 60, windowSeconds: 60,  blockSeconds: 900 },
  "invite":                { maxRequests: 10, windowSeconds: 60,  blockSeconds: 900 },
  "ai_chat":               { maxRequests: 10, windowSeconds: 60,  blockSeconds: 900 },
  "nl_query":              { maxRequests: 15, windowSeconds: 60,  blockSeconds: 900 },
  "ocr":                   { maxRequests: 10, windowSeconds: 60,  blockSeconds: 900 },
  "paylink":               { maxRequests: 15, windowSeconds: 60,  blockSeconds: 900 },
  "paid_gateway":          { maxRequests: 15, windowSeconds: 60,  blockSeconds: 900 },
  "zatca":                 { maxRequests: 15, windowSeconds: 60,  blockSeconds: 900 },
  "email":                 { maxRequests: 20, windowSeconds: 60,  blockSeconds: 900 },
  "general":               { maxRequests: 30, windowSeconds: 60,  blockSeconds: 900 },
};

/**
 * Extract a stable key from the request for rate limiting.
 * Uses IP + optional user_id + optional tenant_id.
 */
function buildRateLimitKey(req: Request, category: string, userId?: string, tenantId?: string): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || req.headers.get("cf-connecting-ip")
    || "unknown";
  
  const parts = [`rl:${category}:ip:${ip}`];
  if (userId) parts.push(`uid:${userId}`);
  if (tenantId) parts.push(`tid:${tenantId}`);
  return parts.join(":");
}

/**
 * Check rate limit and return a 429 Response if blocked, or null if allowed.
 * This function is safe to call even if the DB is unavailable (fails open).
 */
export async function checkRateLimit(
  req: Request,
  supabaseAdmin: ReturnType<typeof createClient>,
  category: string,
  corsHeaders: Record<string, string>,
  userId?: string,
  tenantId?: string,
): Promise<Response | null> {
  try {
    const config = RATE_LIMITS[category] || RATE_LIMITS["general"];
    const key = buildRateLimitKey(req, category, userId, tenantId);

    const { data, error } = await supabaseAdmin.rpc("check_rate_limit", {
      p_key: key,
      p_max_requests: config.maxRequests,
      p_window_seconds: config.windowSeconds,
      p_block_seconds: config.blockSeconds,
    });

    if (error) {
      // Fail open: if DB is unavailable, allow the request
      console.error("Rate limit check failed:", error.message);
      return null;
    }

    const result = data as { allowed: boolean; remaining: number; blocked: boolean; retry_after: number };

    if (!result.allowed) {
      // Log the block attempt in audit_logs (fire-and-forget, no sensitive data)
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      supabaseAdmin.from("audit_logs").insert({
        tenant_id: tenantId || "00000000-0000-0000-0000-000000000000",
        user_id: userId || "00000000-0000-0000-0000-000000000000",
        action: "rate_limit_blocked",
        entity_type: "rate_limit",
        entity_id: category,
        entity_label: `${category} rate limit exceeded`,
        changes: {
          ip_address: ip,
          category,
          blocked: result.blocked,
          retry_after: result.retry_after,
        },
      }).then(() => {}).catch(() => {}); // Fire-and-forget

      return new Response(
        JSON.stringify({
          error: "تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة بعد قليل.",
          error_en: "Rate limit exceeded. Please try again later.",
          code: "RATE_LIMITED",
          retry_after: result.retry_after,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(result.retry_after),
          },
        }
      );
    }

    return null; // Allowed
  } catch (err) {
    // Fail open on unexpected errors
    console.error("Rate limiter unexpected error:", err);
    return null;
  }
}
