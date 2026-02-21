import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type JobType =
  | "report:generate"
  | "email:bulk"
  | "inventory:recalculate"
  | "pdf:generate"
  | "export:excel"
  | "integration:sync"
  | "webhook:process";

export interface JobStatus {
  id: string;
  status: string;
  result?: any;
  error_message?: string;
}

export const useJobQueue = () => {
  const { tenantId, user } = useAuth();
  const [dispatching, setDispatching] = useState(false);
  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const dispatch = useCallback(
    async (
      type: JobType,
      payload: Record<string, unknown> = {},
      options?: { scheduledAt?: Date; maxAttempts?: number }
    ): Promise<string | null> => {
      if (!tenantId) {
        toast.error("لا يمكن إنشاء مهمة بدون منشأة");
        return null;
      }
      setDispatching(true);
      try {
        const { data, error } = await supabase
          .from("background_jobs" as any)
          .insert({
            tenant_id: tenantId,
            type,
            payload: { ...payload, tenant_id: tenantId },
            created_by: user?.id || null,
            scheduled_at: options?.scheduledAt?.toISOString() || new Date().toISOString(),
            max_attempts: options?.maxAttempts || 3,
          } as any)
          .select("id")
          .single();

        if (error) throw error;

        // Trigger the worker immediately (fire-and-forget)
        supabase.functions.invoke("job-worker").catch(() => {});

        toast.success("تم إرسال المهمة للمعالجة في الخلفية");
        return (data as any)?.id || null;
      } catch (err: any) {
        toast.error(`فشل إرسال المهمة: ${err.message}`);
        return null;
      } finally {
        setDispatching(false);
      }
    },
    [tenantId, user]
  );

  const getJobStatus = useCallback(
    async (jobId: string): Promise<JobStatus | null> => {
      const { data } = await supabase
        .from("background_jobs" as any)
        .select("id, status, result, error_message")
        .eq("id", jobId)
        .single();
      return data as unknown as JobStatus | null;
    },
    []
  );

  /**
   * Poll a job until it reaches a terminal state (completed/failed).
   * Returns a promise that resolves with the final job status.
   */
  const pollUntilDone = useCallback(
    (jobId: string, intervalMs = 2000, maxPolls = 60): Promise<JobStatus> => {
      return new Promise((resolve, reject) => {
        let polls = 0;
        const timer = setInterval(async () => {
          polls++;
          try {
            const status = await getJobStatus(jobId);
            if (!status) {
              clearInterval(timer);
              pollTimers.current.delete(jobId);
              reject(new Error("Job not found"));
              return;
            }
            if (status.status === "completed" || status.status === "failed") {
              clearInterval(timer);
              pollTimers.current.delete(jobId);
              resolve(status);
              return;
            }
            if (polls >= maxPolls) {
              clearInterval(timer);
              pollTimers.current.delete(jobId);
              reject(new Error("Polling timeout"));
            }
          } catch (err) {
            clearInterval(timer);
            pollTimers.current.delete(jobId);
            reject(err);
          }
        }, intervalMs);
        pollTimers.current.set(jobId, timer);
      });
    },
    [getJobStatus]
  );

  const listJobs = useCallback(
    async (limit = 20) => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("background_jobs" as any)
        .select("id, type, status, attempts, created_at, completed_at, error_message")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(limit);
      return (data as any[]) || [];
    },
    [tenantId]
  );

  return { dispatch, getJobStatus, pollUntilDone, listJobs, dispatching };
};
