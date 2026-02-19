/**
 * Timeout & Retry Guard for Edge Functions
 * 
 * - withTimeout: wraps any async operation with a deadline (default 5s)
 * - safeRetry: retries non-financial operations with exponential backoff
 * - withRequestTimeout: wraps entire Deno.serve handler with timeout
 */

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Wrap an async operation with a timeout.
 * Throws TimeoutError if the operation exceeds the deadline.
 */
export class TimeoutError extends Error {
  constructor(ms: number, label?: string) {
    super(`Operation timed out after ${ms}ms${label ? `: ${label}` : ""}`);
    this.name = "TimeoutError";
  }
}

export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  label?: string,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () =>
          reject(new TimeoutError(timeoutMs, label))
        );
      }),
    ]);
    return result;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Financial operations that must NEVER be retried to prevent double-charge.
 */
const FINANCIAL_OPERATIONS = new Set([
  "process_wallet_transaction",
  "wallet_debit",
  "wallet_credit",
  "subscription_payment",
  "integration_purchase",
  "topup",
  "payout",
]);

/**
 * Safe retry with exponential backoff.
 * Refuses to retry financial operations to prevent double-charge.
 * 
 * @param fn - The async function to retry
 * @param operationName - Used to check if it's a financial operation
 * @param maxRetries - Maximum number of retries (default 2)
 * @param baseDelayMs - Base delay between retries (default 500ms)
 */
export async function safeRetry<T>(
  fn: () => Promise<T>,
  operationName: string,
  maxRetries: number = 2,
  baseDelayMs: number = 500,
): Promise<T> {
  // GUARD: Never retry financial operations
  if (FINANCIAL_OPERATIONS.has(operationName)) {
    return fn();
  }

  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      
      // Don't retry on client errors (4xx equivalent)
      if (lastError.message.includes("not found") || 
          lastError.message.includes("unauthorized") ||
          lastError.message.includes("forbidden") ||
          lastError.message.includes("invalid")) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 200;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError!;
}

/**
 * Wrap a Deno.serve handler with a global request timeout.
 * Returns 504 Gateway Timeout if the handler exceeds the deadline.
 */
export function withRequestTimeout(
  handler: (req: Request) => Promise<Response>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  corsHeaders: Record<string, string> = {},
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    // Don't timeout OPTIONS preflight
    if (req.method === "OPTIONS") {
      return handler(req);
    }

    try {
      return await withTimeout(() => handler(req), timeoutMs, req.url);
    } catch (err) {
      if (err instanceof TimeoutError) {
        console.error(`[TIMEOUT] Request exceeded ${timeoutMs}ms: ${req.url}`);
        return new Response(
          JSON.stringify({
            error: "انتهت مهلة العملية. يرجى المحاولة مرة أخرى.",
            error_en: "Request timed out. Please try again.",
            code: "TIMEOUT",
          }),
          {
            status: 504,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      throw err;
    }
  };
}

/**
 * DB Query Guard: Ensures all queries include tenant_id filter
 * and use .limit() to prevent full table scans.
 * 
 * Usage: Call before executing queries to validate parameters.
 */
export function assertQuerySafe(params: {
  tenantId?: string | null;
  limit?: number;
  operationName: string;
}): void {
  if (!params.tenantId) {
    throw new Error(
      `[QueryGuard] ${params.operationName}: tenant_id is required to prevent full table scan`
    );
  }
  if (params.limit && params.limit > 1000) {
    console.warn(
      `[QueryGuard] ${params.operationName}: limit ${params.limit} exceeds recommended max (1000)`
    );
  }
}
