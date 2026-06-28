import { useEffect, useMemo, useRef, useState } from "react";
import {
  defaultAcpAgentSettings,
  getStoredAcpAgentSettings,
  type AcpAgentSettings
} from "../lib/settings/app-settings";
import { listenAppAcpAgentSettingsChanged } from "../lib/settings/settings-events";

export function useAcpAgentSettings() {
  const [settings, setSettings] = useState<AcpAgentSettings>(defaultAcpAgentSettings);
  const [loading, setLoading] = useState(true);
  const liveSettingsReceivedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    let stopListening: (() => unknown) | null = null;

    getStoredAcpAgentSettings()
      .then((storedSettings) => {
        if (alive && !liveSettingsReceivedRef.current) setSettings(storedSettings);
      })
      .catch(() => {
        if (alive && !liveSettingsReceivedRef.current) setSettings(defaultAcpAgentSettings);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    listenAppAcpAgentSettingsChanged((nextSettings) => {
      if (!alive) return;

      liveSettingsReceivedRef.current = true;
      setSettings(nextSettings);
      setLoading(false);
    }).then((cleanup) => {
      if (!alive) {
        cleanup();
        return;
      }

      stopListening = cleanup;
    });

    return () => {
      alive = false;
      stopListening?.();
    };
  }, []);

  return useMemo(() => {
    const configured = settings.enabled && Boolean(settings.command.trim());

    return {
      configured,
      displayName: acpAgentDisplayName(settings),
      loading,
      settings
    };
  }, [loading, settings]);
}

function acpAgentDisplayName(settings: AcpAgentSettings) {
  const command = settings.command.trim();
  const args = settings.args.trim();
  const commandLine = `${command} ${args}`.trim();

  if (commandLine.includes("@agentclientprotocol/codex-acp") || commandLine.includes("codex-acp")) {
    return "Codex ACP";
  }

  const executable = command.split(/[\\/]/).filter(Boolean).at(-1);
  return executable || "ACP agent";
}
