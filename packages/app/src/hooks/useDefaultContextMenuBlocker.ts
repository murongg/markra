import { useEffect } from "react";

export function shouldBlockDefaultContextMenu() {
  return import.meta.env.PROD;
}

export function useDefaultContextMenuBlocker(enabled = shouldBlockDefaultContextMenu()) {
  useEffect(() => {
    if (!enabled) return;

    const blockDefaultContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    document.addEventListener("contextmenu", blockDefaultContextMenu, { capture: true });

    return () => {
      document.removeEventListener("contextmenu", blockDefaultContextMenu, { capture: true });
    };
  }, [enabled]);
}
