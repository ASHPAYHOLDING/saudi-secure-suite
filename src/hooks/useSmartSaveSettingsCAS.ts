/**
 * useSmartSaveSettingsCAS
 *
 * Enterprise-grade smart-save hook for tenant_settings with:
 *  - Debounced auto-save
 *  - Dirty-field tracking (only patches changed keys)
 *  - Atomic compare-and-swap (CAS) via Postgres RPC
 *  - Automatic 3-way merge on conflict
 *  - Realtime remote-change detection
 *  - Max 2 automatic retries after conflict
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// ─── Public types ──────────────────────────────────────────────────────────────

export type SaveStatus = "idle" | "saving" | "saved" | "unsaved" | "conflict";

export interface ConflictEntry {
  key: string;
  localValue: unknown;
  remoteValue: unknown;
}

export interface RemoteBanner {
  remoteConfig: Record<string, unknown>;
  remoteVersion: number;
  remoteUpdatedAt: string;
}

export interface SmartSaveCAS<T extends Record<string, unknown>> {
  draft: T;
  status: SaveStatus;
  isDirty: boolean;
  conflicts: ConflictEntry[];
  remoteBanner: RemoteBanner | null;
  /** Update one or more fields in the draft */
  setField: (key: keyof T, value: unknown) => void;
  setFields: (patch: Partial<T>) => void;
  /** Manually trigger a save now */
  saveNow: () => Promise<void>;
  /** Resolve a conflict — keep "local" or "remote" */
  resolveConflict: (key: string, choice: "local" | "remote") => void;
  /** After resolving all conflicts, retry the save */
  resolveAndSave: () => Promise<void>;
  /** Discard local edits, reset to remote */
  discardDraft: () => void;
  /** Dismiss the remote-change banner without doing anything */
  dismissBanner: () => void;
  /** Open conflict modal from the banner */
  reviewRemoteChanges: () => void;
}

interface CASOptions<T extends Record<string, unknown>> {
  tenantId: string | null;
  initialConfig: T;
  initialVersion?: number;
  debounceMs?: number;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function pick<T extends Record<string, unknown>>(obj: T, keys: string[]): Partial<T> {
  return Object.fromEntries(keys.filter(k => k in obj).map(k => [k, obj[k]])) as Partial<T>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSmartSaveSettingsCAS<T extends Record<string, unknown>>(
  options: CASOptions<T>
): SmartSaveCAS<T> {
  const { tenantId, initialConfig, initialVersion = 1, debounceMs = 1200 } = options;

  // Baseline = what we loaded from server
  const baseConfigRef = useRef<T>(initialConfig);
  const baseVersionRef = useRef<number>(initialVersion);

  const [draft, setDraft] = useState<T>(initialConfig);
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [conflicts, setConflicts] = useState<ConflictEntry[]>([]);
  const [remoteBanner, setRemoteBanner] = useState<RemoteBanner | null>(null);

  // Retry counter — max 2 automatic retries after conflict
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 2;

  // Debounce timer
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);

  // ── Sync initial values when the parent loads data ──────────────────────────
  useEffect(() => {
    baseConfigRef.current = initialConfig;
    baseVersionRef.current = initialVersion;
    setDraft(initialConfig);
    setDirtyKeys(new Set());
    setStatus("idle");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialConfig), initialVersion]);

  // ── Core CAS save ────────────────────────────────────────────────────────────
  const performSave = useCallback(
    async (patchKeys: string[], expectedVersion: number, currentDraft: T): Promise<void> => {
      if (!tenantId || patchKeys.length === 0) return;
      if (isSavingRef.current) return;
      isSavingRef.current = true;
      setStatus("saving");

      const patch = pick(currentDraft, patchKeys);

      const { data: raw, error } = await supabase.rpc(
        "update_tenant_settings_cas" as any,
        {
          p_tenant_id: tenantId,
          p_patch: patch,
          p_expected_version: expectedVersion,
        }
      );

      isSavingRef.current = false;

      if (error) {
        console.error("[CAS] RPC error:", error);
        setStatus("unsaved");
        return;
      }

      const result = raw as any;

      if (result?.ok === true) {
        // ── Success ──────────────────────────────────────────────────────────
        const newConfig = result.new_config as T;
        const newVersion = result.new_version as number;
        baseConfigRef.current = newConfig;
        baseVersionRef.current = newVersion;
        // Preserve draft (user may still be typing), just clear dirty keys we just saved
        setDraft(prev => ({ ...prev, ...newConfig }));
        setDirtyKeys(prev => {
          const next = new Set(prev);
          patchKeys.forEach(k => next.delete(k));
          return next;
        });
        setStatus("saved");
        retryCountRef.current = 0;
        setConflicts([]);
        return;
      }

      if (result?.error === "conflict") {
        // ── Conflict ─────────────────────────────────────────────────────────
        const remoteConfig = result.current_config as T;
        const remoteVersion = result.current_version as number;
        const remoteUpdatedAt = result.updated_at as string;

        // 3-way merge
        const base = baseConfigRef.current;
        const realConflicts: ConflictEntry[] = [];
        const autoMerged: Partial<T> = {};

        for (const key of patchKeys) {
          const localVal = currentDraft[key];
          const remoteVal = (remoteConfig as any)[key];
          const baseVal = (base as any)[key];

          if (JSON.stringify(remoteVal) === JSON.stringify(baseVal)) {
            // Remote didn't change this key — keep local value (safe)
            autoMerged[key as keyof T] = localVal as T[keyof T];
          } else if (JSON.stringify(localVal) === JSON.stringify(remoteVal)) {
            // Both chose same value — clear dirty
            // no conflict
          } else {
            // Real conflict
            realConflicts.push({ key, localValue: localVal, remoteValue: remoteVal });
          }
        }

        // Apply remote values for keys we didn't touch
        const allRemoteKeys = Object.keys(remoteConfig);
        for (const key of allRemoteKeys) {
          if (!patchKeys.includes(key)) {
            autoMerged[key as keyof T] = (remoteConfig as any)[key];
          }
        }

        // Update draft with auto-merged values
        setDraft(prev => ({ ...prev, ...autoMerged }));

        if (realConflicts.length === 0 && retryCountRef.current < MAX_RETRIES) {
          // No real conflicts — update base & retry
          retryCountRef.current += 1;
          baseConfigRef.current = remoteConfig;
          baseVersionRef.current = remoteVersion;
          const remainingDirty = patchKeys.filter(k => !allRemoteKeys.includes(k) || true);
          await performSave(remainingDirty, remoteVersion, { ...currentDraft, ...autoMerged });
        } else {
          // Show conflict modal
          setConflicts(realConflicts);
          setStatus("conflict");
          // Store remote so user can see it
          setRemoteBanner({
            remoteConfig: remoteConfig as Record<string, unknown>,
            remoteVersion,
            remoteUpdatedAt,
          });
        }
        return;
      }

      setStatus("unsaved");
    },
    [tenantId]
  );

  // ── Debounced auto-save trigger ───────────────────────────────────────────────
  const scheduleAutoSave = useCallback(
    (keys: Set<string>, currentDraft: T) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        const dirtyArr = Array.from(keys);
        if (dirtyArr.length > 0 && !isSavingRef.current) {
          performSave(dirtyArr, baseVersionRef.current, currentDraft);
        }
      }, debounceMs);
    },
    [performSave, debounceMs]
  );

  // ── Public: setField / setFields ─────────────────────────────────────────────
  const setField = useCallback(
    (key: keyof T, value: unknown) => {
      setDraft(prev => {
        const next = { ...prev, [key]: value };
        setDirtyKeys(prevKeys => {
          const newKeys = new Set(prevKeys);
          newKeys.add(String(key));
          setStatus("unsaved");
          scheduleAutoSave(newKeys, next);
          return newKeys;
        });
        return next;
      });
    },
    [scheduleAutoSave]
  );

  const setFields = useCallback(
    (patch: Partial<T>) => {
      setDraft(prev => {
        const next = { ...prev, ...patch };
        setDirtyKeys(prevKeys => {
          const newKeys = new Set(prevKeys);
          Object.keys(patch).forEach(k => newKeys.add(k));
          setStatus("unsaved");
          scheduleAutoSave(newKeys, next);
          return newKeys;
        });
        return next;
      });
    },
    [scheduleAutoSave]
  );

  // ── Public: saveNow ──────────────────────────────────────────────────────────
  const saveNow = useCallback(async () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const keys = Array.from(dirtyKeys);
    if (keys.length === 0) return;
    await performSave(keys, baseVersionRef.current, draft);
  }, [dirtyKeys, draft, performSave]);

  // ── Public: resolveConflict ──────────────────────────────────────────────────
  const resolveConflict = useCallback((key: string, choice: "local" | "remote") => {
    setConflicts(prev => {
      const entry = prev.find(c => c.key === key);
      if (!entry) return prev;
      if (choice === "remote") {
        setDraft(d => ({ ...d, [key]: entry.remoteValue }));
        setDirtyKeys(k => { const n = new Set(k); n.delete(key); return n; });
      }
      // "local": keep draft as-is
      return prev.filter(c => c.key !== key);
    });
  }, []);

  // ── Public: resolveAndSave ────────────────────────────────────────────────────
  const resolveAndSave = useCallback(async () => {
    if (!remoteBanner) return;
    baseConfigRef.current = remoteBanner.remoteConfig as T;
    baseVersionRef.current = remoteBanner.remoteVersion;
    retryCountRef.current = 0;
    setConflicts([]);
    setStatus("unsaved");
    const keys = Array.from(dirtyKeys);
    await performSave(keys, remoteBanner.remoteVersion, draft);
  }, [remoteBanner, dirtyKeys, draft, performSave]);

  // ── Public: discardDraft ─────────────────────────────────────────────────────
  const discardDraft = useCallback(() => {
    if (!remoteBanner) return;
    const remote = remoteBanner.remoteConfig as T;
    baseConfigRef.current = remote;
    baseVersionRef.current = remoteBanner.remoteVersion;
    setDraft(remote);
    setDirtyKeys(new Set());
    setConflicts([]);
    setRemoteBanner(null);
    setStatus("idle");
    retryCountRef.current = 0;
  }, [remoteBanner]);

  const dismissBanner = useCallback(() => setRemoteBanner(null), []);

  const reviewRemoteChanges = useCallback(() => {
    if (!remoteBanner) return;
    // Build conflicts from banner
    const rc = remoteBanner.remoteConfig as T;
    const base = baseConfigRef.current;
    const gen: ConflictEntry[] = Array.from(dirtyKeys)
      .filter(k => JSON.stringify((rc as any)[k]) !== JSON.stringify((base as any)[k]))
      .map(k => ({ key: k, localValue: draft[k], remoteValue: (rc as any)[k] }));
    setConflicts(gen);
    setStatus("conflict");
  }, [remoteBanner, dirtyKeys, draft]);

  // ── Realtime subscription ────────────────────────────────────────────────────
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`cas-settings-${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tenant_settings",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload: any) => {
          const newRow = payload.new;
          if (!newRow) return;
          const remoteVersion: number = newRow.version ?? 1;
          const remoteConfig: T = newRow.branding_config ?? {};
          const remoteUpdatedAt: string = newRow.updated_at ?? new Date().toISOString();

          // Already on this version (our own write) — ignore
          if (remoteVersion === baseVersionRef.current) return;

          if (dirtyKeys.size === 0) {
            // Not dirty — apply silently
            baseConfigRef.current = remoteConfig;
            baseVersionRef.current = remoteVersion;
            setDraft(remoteConfig);
            setStatus("idle");
          } else {
            // Dirty — show banner
            setRemoteBanner({ remoteConfig: remoteConfig as Record<string, unknown>, remoteVersion, remoteUpdatedAt });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, dirtyKeys.size]);

  // ── Cleanup ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  return {
    draft,
    status,
    isDirty: dirtyKeys.size > 0,
    conflicts,
    remoteBanner,
    setField,
    setFields,
    saveNow,
    resolveConflict,
    resolveAndSave,
    discardDraft,
    dismissBanner,
    reviewRemoteChanges,
  };
}
