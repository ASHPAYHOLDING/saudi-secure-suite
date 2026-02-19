/**
 * Global fetch timer + request deduplication for Supabase calls.
 * Wraps any async call with timing, logging, hard timeout, and dedup.
 */

export interface CallRecord {
  name: string;
  duration: number;
  status: "ok" | "error" | "timeout";
  timestamp: number;
  error?: string;
}

const MAX_RECORDS = 50;
const callLog: CallRecord[] = [];
const inFlight = new Map<string, Promise<any>>();

/** Hard timeout (ms) — abort any RPC exceeding this */
const HARD_TIMEOUT = 8000;

export function getCallLog(): readonly CallRecord[] {
  return callLog;
}

export function getCallCount(): number {
  return callLog.length;
}

function addRecord(record: CallRecord) {
  callLog.unshift(record);
  if (callLog.length > MAX_RECORDS) callLog.pop();
}

/**
 * Wrap a Supabase call with timing, deduplication, and hard timeout.
 *
 * @param name  - human label for logging (e.g. "profiles.select")
 * @param fn    - the async function to execute
 * @param dedup - optional key for deduplication; same key reuses in-flight promise
 */
export async function timedCall<T>(
  name: string,
  fn: () => Promise<T>,
  dedup?: string
): Promise<T> {
  // Dedup: reuse in-flight promise for same key
  if (dedup && inFlight.has(dedup)) {
    return inFlight.get(dedup)! as Promise<T>;
  }

  const start = performance.now();

  const execute = async (): Promise<T> => {
    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`TIMEOUT: ${name} exceeded ${HARD_TIMEOUT}ms`)), HARD_TIMEOUT)
        ),
      ]);

      const duration = Math.round(performance.now() - start);
      addRecord({ name, duration, status: "ok", timestamp: Date.now() });

      if (duration > 3000) {
        console.warn(`[perf] Slow call: ${name} took ${duration}ms`);
      }

      return result;
    } catch (err: any) {
      const duration = Math.round(performance.now() - start);
      const isTimeout = err?.message?.startsWith("TIMEOUT:");
      addRecord({
        name,
        duration,
        status: isTimeout ? "timeout" : "error",
        timestamp: Date.now(),
        error: err?.message,
      });
      console.error(`[perf] ${isTimeout ? "Timeout" : "Error"}: ${name} (${duration}ms)`, err);
      throw err;
    } finally {
      if (dedup) inFlight.delete(dedup);
    }
  };

  const promise = execute();
  if (dedup) inFlight.set(dedup, promise);
  return promise;
}
