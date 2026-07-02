import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { isAppLanguage } from "@markra/shared";
import { getStoredLanguage, saveStoredLanguage, type AppLanguage } from "../lib/settings/app-settings";
import { listenAppLanguageChanged, notifyAppLanguageChanged } from "../lib/settings/settings-events";

const startupLanguageParam = "startupLanguage";

function applyAppLanguage(language: AppLanguage) {
  document.documentElement.lang = language;
}

function startupLanguageFromLocation(): AppLanguage | null {
  if (typeof window === "undefined") return null;

  const language = new URLSearchParams(window.location.search).get(startupLanguageParam);

  return isAppLanguage(language) ? language : null;
}

export function useAppLanguage() {
  const startupLanguageRef = useRef<AppLanguage | null>(startupLanguageFromLocation());
  const [language, setLanguage] = useState<AppLanguage>(() => startupLanguageRef.current ?? "en");
  const [ready, setReady] = useState(() => startupLanguageRef.current !== null);
  const liveLanguageReceivedRef = useRef(false);

  useLayoutEffect(() => {
    applyAppLanguage(language);
  }, [language]);

  useEffect(() => {
    let active = true;

    getStoredLanguage().then((storedLanguage) => {
      if (!active) return;
      if (liveLanguageReceivedRef.current) {
        setReady(true);
        return;
      }

      setLanguage(storedLanguage);
      setReady(true);
    }).catch(() => {
      if (!active) return;

      if (startupLanguageRef.current === null) {
        setLanguage("en");
      }
      setReady(true);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let cleanup: (() => unknown) | null = null;

    listenAppLanguageChanged((nextLanguage) => {
      liveLanguageReceivedRef.current = true;
      setLanguage(nextLanguage);
      setReady(true);
    }).then((stopListening) => {
      if (!active) {
        stopListening();
        return;
      }

      cleanup = stopListening;
    }).catch(() => {});

    return () => {
      active = false;
      cleanup?.();
    };
  }, []);

  const selectLanguage = useCallback((nextLanguage: AppLanguage) => {
    setLanguage(nextLanguage);
    liveLanguageReceivedRef.current = true;
    setReady(true);

    saveStoredLanguage(nextLanguage)
      .then(() => notifyAppLanguageChanged(nextLanguage))
      .catch(() => {});
  }, []);

  return {
    language,
    ready,
    selectLanguage
  };
}
