/**
 * Shared webhook security utilities:
 * - HMAC signature verification
 * - Timestamp replay protection (5-minute window)
 * - Idempotency (dedupe via webhook_events table)
 * - Audit logging (no secrets)
 */

export async function verifyWebhookSignature(
  req: Request,
  body: string,
  secret: string
): Promise<{ valid: boolean; reason?: string }> {
  const signature = req.headers.get("x-webhook-signature") || req.headers.get("x-signature");
  const timestamp = req.headers.get("x-webhook-timestamp") || req.headers.get("x-timestamp");

  if (!signature) {
    return { valid: false, reason: "Missing signature header" };
  }

  if (!timestamp) {
    return { valid: false, reason: "Missing timestamp header" };
  }

  // Replay protection: 5-minute window
  const tsMs = parseInt(timestamp, 10);
  if (isNaN(tsMs)) {
    return { valid: false, reason: "Invalid timestamp format" };
  }

  const now = Date.now();
  const diff = Math.abs(now - tsMs);
  const FIVE_MINUTES = 5 * 60 * 1000;
  if (diff > FIVE_MINUTES) {
    return { valid: false, reason: `Timestamp expired: ${diff}ms drift (max ${FIVE_MINUTES}ms)` };
  }

  // HMAC-SHA256 verification
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const payload = `${timestamp}.${body}`;
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const expectedSig = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (signature !== expectedSig) {
    return { valid: false, reason: "Invalid signature" };
  }

  return { valid: true };
}

/**
 * Check idempotency: returns true if event was already processed.
 * If new, inserts a record and returns false.
 */
export async function checkIdempotency(
  supabase: any,
  provider: string,
  eventId: string,
  tenantId: string | null,
  payload: any
): Promise<{ duplicate: boolean; existingStatus?: string }> {
  // Try insert; unique constraint will reject duplicates
  const { data, error } = await supabase
    .from("webhook_events")
    .insert({
      provider,
      event_id: eventId,
      tenant_id: tenantId,
      payload: sanitizePayload(payload),
      status: "processing",
    })
    .select("id, status")
    .single();

  if (error) {
    // Check if it's a unique violation (duplicate)
    if (error.code === "23505") {
      // Fetch existing
      const { data: existing } = await supabase
        .from("webhook_events")
        .select("status")
        .eq("provider", provider)
        .eq("event_id", eventId)
        .single();
      return { duplicate: true, existingStatus: existing?.status };
    }
    console.error("webhook_events insert error:", error);
    // Don't block processing on logging errors
  }

  return { duplicate: false };
}

/**
 * Mark webhook event as completed with provider response
 */
export async function markWebhookCompleted(
  supabase: any,
  provider: string,
  eventId: string,
  status: string,
  providerResponse: any
) {
  await supabase
    .from("webhook_events")
    .update({
      status,
      provider_response: sanitizePayload(providerResponse),
      processed_at: new Date().toISOString(),
    })
    .eq("provider", provider)
    .eq("event_id", eventId);
}

/**
 * Log webhook event to audit_logs (no secrets)
 */
export async function logWebhookAudit(
  supabase: any,
  tenantId: string | null,
  action: string,
  details: Record<string, any>
) {
  try {
    await supabase.from("audit_logs").insert({
      tenant_id: tenantId || "00000000-0000-0000-0000-000000000000",
      user_id: "00000000-0000-0000-0000-000000000000",
      action,
      entity_type: "webhook",
      entity_label: details.provider || "unknown",
      entity_id: details.event_id || null,
      changes: sanitizePayload(details),
    });
  } catch (e) {
    console.error("Webhook audit log error:", e);
  }
}

/**
 * Remove sensitive fields from payload before storing
 */
function sanitizePayload(payload: any): any {
  if (!payload || typeof payload !== "object") return payload;
  const sanitized = { ...payload };
  const sensitiveKeys = [
    "secretKey", "secret_key", "apiKey", "api_key", "password",
    "token", "id_token", "access_token", "authorization", "private_key",
  ];
  for (const key of sensitiveKeys) {
    if (key in sanitized) {
      sanitized[key] = "***REDACTED***";
    }
  }
  return sanitized;
}
