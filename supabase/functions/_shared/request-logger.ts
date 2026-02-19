/**
 * Structured Request Logger for Edge Functions
 * Logs to edge_request_logs table with correlation ID propagation.
 *
 * Usage:
 *   import { RequestLogger } from "../_shared/request-logger.ts";
 *   const logger = new RequestLogger(req, supabaseAdmin, "secure-rpc");
 *   logger.setUser(userId, tenantId);
 *   logger.setAction("apply_subscription_discount");
 *   // ... do work ...
 *   await logger.flush(200);          // or logger.flush(500, "error msg")
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export class RequestLogger {
  readonly correlationId: string;
  private startMs: number;
  private functionName: string;
  private action: string | null = null;
  private userId: string | null = null;
  private tenantId: string | null = null;
  private ip: string;
  private method: string;
  private supabaseAdmin: ReturnType<typeof createClient>;
  private metadata: Record<string, unknown> = {};

  constructor(
    req: Request,
    supabaseAdmin: ReturnType<typeof createClient>,
    functionName: string,
  ) {
    // Prefer correlation ID from frontend header, else generate one
    this.correlationId =
      req.headers.get("x-correlation-id") || crypto.randomUUID();
    this.startMs = Date.now();
    this.functionName = functionName;
    this.method = req.method;
    this.ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    this.supabaseAdmin = supabaseAdmin;
  }

  setUser(userId?: string, tenantId?: string) {
    if (userId) this.userId = userId;
    if (tenantId) this.tenantId = tenantId;
  }

  setAction(action: string) {
    this.action = action;
  }

  addMetadata(key: string, value: unknown) {
    this.metadata[key] = value;
  }

  /** Fire-and-forget flush to edge_request_logs */
  async flush(statusCode: number, errorMessage?: string) {
    const durationMs = Date.now() - this.startMs;

    // Console structured log (always)
    console.log(
      JSON.stringify({
        correlation_id: this.correlationId,
        function: this.functionName,
        action: this.action,
        user_id: this.userId,
        tenant_id: this.tenantId,
        status: statusCode,
        duration_ms: durationMs,
        ip: this.ip,
      }),
    );

    // DB log (fire-and-forget)
    try {
      await this.supabaseAdmin.from("edge_request_logs").insert({
        correlation_id: this.correlationId,
        function_name: this.functionName,
        action: this.action,
        user_id: this.userId,
        tenant_id: this.tenantId,
        ip_address: this.ip,
        method: this.method,
        status_code: statusCode,
        duration_ms: durationMs,
        error_message: errorMessage?.slice(0, 2000) || null,
        metadata: Object.keys(this.metadata).length > 0 ? this.metadata : null,
      });
    } catch (e) {
      console.error("[RequestLogger] DB write failed:", e);
    }
  }

  /** Return correlation ID as response header */
  responseHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return {
      ...extra,
      "x-correlation-id": this.correlationId,
    };
  }
}
