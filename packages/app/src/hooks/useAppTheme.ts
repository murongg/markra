import { useCallback, useEffect, useState } from "react";
import {
  getStoredCustomThemeCss,
  getStoredTheme,
  normalizeCustomThemeCss,
  resolveAppAppearanceTheme,
  resolveAppEditorTheme,
  saveStoredCustomThemeCss,
  saveStoredTheme,
  type AppTheme,
  type EditorTheme,
  type ResolvedAppTheme
} from "../lib/settings/app-settings";
import {
  listenAppCustomThemeCssChanged,
  listenAppThemeChanged,
  notifyAppCustomThemeCssChanged,
  notifyAppThemeChanged
} from "../lib/settings/settings-events";

const systemDarkThemeQuery = "(prefers-color-scheme: dark)";
const customThemeStyleElementId = "markra-custom-theme-style";

function getSystemTheme(): ResolvedAppTheme {
  if (typeof window.matchMedia !== "function") return "light";

  return window.matchMedia(systemDarkThemeQuery).matches ? "dark" : "light";
}

function removeCustomThemeCss() {
  document.getElementById(customThemeStyleElementId)?.remove();
}

function applyCustomThemeCss(css: string) {
  let style = document.getElementById(customThemeStyleElementId) as HTMLStyleElement | null;

  if (!style) {
    style = document.createElement("style");
    style.id = customThemeStyleElementId;
    style.dataset.markraCustomTheme = "true";
    document.head.append(style);
  }

  style.textContent = css;
}

function applyAppTheme(theme: EditorTheme, customThemeCss: string) {
  // Keep the root attribute as the single switch for theme-scoped CSS variables.
  document.documentElement.dataset.theme = theme;

  if (theme === "custom" && customThemeCss.trim()) {
    applyCustomThemeCss(customThemeCss);
    return;
  }

  removeCustomThemeCss();
}

export function useAppTheme() {
  const [theme, setTheme] = useState<AppTheme>("system");
  const [customThemeCss, setCustomThemeCss] = useState("");
  const [systemTheme, setSystemTheme] = useState<ResolvedAppTheme>(() => getSystemTheme());
  const editorTheme = resolveAppEditorTheme(theme, systemTheme);
  const resolvedTheme = resolveAppAppearanceTheme(theme, systemTheme);

  useEffect(() => {
    let active = true;

    getStoredTheme().then((storedTheme) => {
      if (active) setTheme(storedTheme);
    }).catch(() => {});

    getStoredCustomThemeCss().then((storedCss) => {
      if (active) setCustomThemeCss(storedCss);
    }).catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia(systemDarkThemeQuery);
    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };

    setSystemTheme(mediaQuery.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  useEffect(() => {
    applyAppTheme(editorTheme, customThemeCss);
  }, [customThemeCss, editorTheme]);

  useEffect(() => {
    let active = true;
    let cleanup: (() => unknown) | null = null;

    listenAppThemeChanged((nextTheme) => {
      if (active) setTheme(nextTheme);
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

  useEffect(() => {
    let active = true;
    let cleanup: (() => unknown) | null = null;

    listenAppCustomThemeCssChanged((nextCss) => {
      if (active) setCustomThemeCss(nextCss);
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

  const selectTheme = useCallback((nextTheme: AppTheme) => {
    setTheme(nextTheme);
    saveStoredTheme(nextTheme).then(() => notifyAppThemeChanged(nextTheme)).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme = resolvedTheme === "dark" ? "light" : "dark";

    setTheme(nextTheme);
    saveStoredTheme(nextTheme).then(() => notifyAppThemeChanged(nextTheme)).catch(() => {});
  }, [resolvedTheme]);

  const updateCustomThemeCss = useCallback((nextCss: string) => {
    const normalizedCss = normalizeCustomThemeCss(nextCss);

    setCustomThemeCss(normalizedCss);
    saveStoredCustomThemeCss(normalizedCss).then(() => notifyAppCustomThemeCssChanged(normalizedCss)).catch(() => {});
  }, []);

  return {
    customThemeCss,
    editorTheme,
    resolvedTheme,
    selectTheme,
    theme,
    toggleTheme,
    updateCustomThemeCss
  };
}
