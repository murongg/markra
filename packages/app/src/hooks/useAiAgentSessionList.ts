import { useCallback, useEffect, useState } from "react";
import { listStoredAiAgentSessions, type StoredAiAgentSessionSummary } from "../lib/settings/app-settings";

export function useAiAgentSessionList(workspaceKey: string | null, refreshKey: string) {
  const [sessions, setSessions] = useState<StoredAiAgentSessionSummary[]>([]);
  const [readyWorkspaceKey, setReadyWorkspaceKey] = useState<string | null | undefined>();

  const refresh = useCallback(async () => {
    try {
      setSessions(await listStoredAiAgentSessions(workspaceKey, { includeArchived: true }));
    } catch {
      setSessions([]);
    } finally {
      setReadyWorkspaceKey(workspaceKey);
    }
  }, [workspaceKey]);

  useEffect(() => {
    setReadyWorkspaceKey(undefined);
    refresh().catch(() => {});
  }, [refresh]);

  useEffect(() => {
    if (readyWorkspaceKey !== workspaceKey) return undefined;

    const timer = window.setTimeout(() => {
      refresh().catch(() => {});
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [readyWorkspaceKey, refresh, refreshKey, workspaceKey]);

  return {
    refresh,
    ready: readyWorkspaceKey === workspaceKey,
    sessions
  };
}
