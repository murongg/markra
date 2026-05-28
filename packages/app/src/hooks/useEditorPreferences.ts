import { useEffect, useState } from "react";
import {
  defaultEditorPreferences,
  getStoredEditorPreferences,
  type EditorPreferences
} from "../lib/settings/app-settings";
import { listenAppEditorPreferencesChanged } from "../lib/settings/settings-events";

export function useEditorPreferences() {
  const [preferences, setPreferences] = useState<EditorPreferences>(defaultEditorPreferences);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    let stopListening: (() => unknown) | null = null;

    getStoredEditorPreferences()
      .then((storedPreferences) => {
        if (alive) setPreferences(storedPreferences);
      })
      .catch(() => {
        if (alive) setPreferences(defaultEditorPreferences);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    listenAppEditorPreferencesChanged((nextPreferences) => {
      if (alive) setPreferences(nextPreferences);
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
    preferences
  };
}
