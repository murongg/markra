import { useEffect, useState } from "react";
import {
  defaultWebSearchSettings,
  getStoredWebSearchSettings,
  type WebSearchSettings
} from "../lib/settings/app-settings";
import { listenAppWebSearchSettingsChanged } from "../lib/settings/settings-events";

export function useWebSearchSettings() {
  const [settings, setSettings] = useState<WebSearchSettings>(defaultWebSearchSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    let stopListening: (() => unknown) | null = null;

    getStoredWebSearchSettings()
      .then((storedSettings) => {
        if (alive) setSettings(storedSettings);
      })
      .catch(() => {
        if (alive) setSettings(defaultWebSearchSettings);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    listenAppWebSearchSettingsChanged((nextSettings) => {
      if (!alive) return;

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

  return {
    loading,
    settings
  };
}
