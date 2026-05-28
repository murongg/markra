import {
  defaultMarkdownShortcuts,
  markdownShortcutToNativeAccelerator,
  normalizeMarkdownShortcuts,
  type MarkdownShortcutAction,
  type MarkdownShortcutMap
} from "@markra/editor";
import { t, type AppLanguage, type I18nKey } from "@markra/shared";
import type {
  AppMenuRuntime,
  NativeEditorContextMenuOptions,
  NativeMarkdownFolderFile,
  NativeMarkdownFileTreeContextMenuHandlers,
  NativeMenuHandlers,
  RuntimeCleanup
} from "@markra/app/runtime";
import type { WebRuntimeOptions } from "./types";

type WebContextMenuEntry = WebContextMenuItem | WebContextMenuSeparator | WebContextMenuSubmenu;

type WebContextMenuItem = {
  action?: () => unknown | Promise<unknown>;
  accelerator?: string;
  enabled: boolean;
  id: string;
  kind: "item";
  label: string;
};

type WebContextMenuSeparator = {
  kind: "separator";
};

type WebContextMenuSubmenu = {
  enabled: boolean;
  entries: WebContextMenuEntry[];
  id: string;
  kind: "submenu";
  label: string;
};

type BrowserEditCommand = "copy" | "cut" | "paste" | "selectAll";

const webContextMenuAttribute = "data-markra-web-context-menu";
const webContextMenuStyleId = "markra-web-context-menu-style";

function resolveDocument(options: WebRuntimeOptions): Document | null {
  return options.document ?? (typeof document === "undefined" ? null : document);
}

function menuLabel(language: AppLanguage, key: I18nKey) {
  return t(language, key);
}

function shortcutAccelerator(shortcuts: MarkdownShortcutMap | undefined, action: MarkdownShortcutAction): string | undefined {
  const shortcut = normalizeMarkdownShortcuts(shortcuts ?? defaultMarkdownShortcuts)[action];

  return markdownShortcutToNativeAccelerator(shortcut) ?? markdownShortcutToNativeAccelerator(defaultMarkdownShortcuts[action]) ?? undefined;
}

function runMenuAction(action: (() => unknown | Promise<unknown>) | undefined) {
  if (!action) return;

  Promise.resolve(action()).catch(() => {});
}

function runBrowserEditCommand(command: BrowserEditCommand) {
  const documentTarget = typeof document === "undefined" ? null : document;
  const execCommand = documentTarget
    ? (documentTarget as unknown as Record<string, unknown>)["execCommand"]
    : null;
  if (typeof execCommand === "function") {
    execCommand.call(documentTarget, command);
  }
}

function item(
  id: string,
  label: string,
  accelerator: string | undefined,
  action: (() => unknown | Promise<unknown>) | undefined,
  enabled = Boolean(action)
): WebContextMenuItem {
  return {
    action,
    accelerator,
    enabled,
    id,
    kind: "item",
    label
  };
}

function browserItem(id: string, label: string, accelerator: string, command: BrowserEditCommand) {
  return item(id, label, accelerator, () => runBrowserEditCommand(command), true);
}

function separator(): WebContextMenuSeparator {
  return { kind: "separator" };
}

function submenu(id: string, label: string, entries: WebContextMenuEntry[]): WebContextMenuSubmenu {
  const visibleEntries = collapseSeparators(entries);

  return {
    enabled: visibleEntries.some((entry) => {
      if (entry.kind === "item") return entry.enabled;
      if (entry.kind === "submenu") return entry.enabled;

      return false;
    }),
    entries: visibleEntries,
    id,
    kind: "submenu",
    label
  };
}

function createWebEditorContextMenuItems(
  handlers: NativeMenuHandlers,
  language: AppLanguage = "en",
  options: { aiCommandsAvailable?: boolean; markdownShortcuts?: MarkdownShortcutMap } = {}
): WebContextMenuEntry[] {
  const label = (key: I18nKey) => menuLabel(language, key);
  const formatItems: WebContextMenuEntry[] = [
    item("markra:web-context:bold", label("menu.bold"), shortcutAccelerator(options.markdownShortcuts, "bold"), handlers.formatBold),
    item("markra:web-context:italic", label("menu.italic"), shortcutAccelerator(options.markdownShortcuts, "italic"), handlers.formatItalic),
    item(
      "markra:web-context:strikethrough",
      label("menu.strikethrough"),
      shortcutAccelerator(options.markdownShortcuts, "strikethrough"),
      handlers.formatStrikethrough
    ),
    item(
      "markra:web-context:inline-code",
      label("menu.inlineCode"),
      shortcutAccelerator(options.markdownShortcuts, "inlineCode"),
      handlers.formatInlineCode
    ),
    separator(),
    item("markra:web-context:paragraph", label("menu.paragraph"), shortcutAccelerator(options.markdownShortcuts, "paragraph"), handlers.formatParagraph),
    item("markra:web-context:heading-1", label("menu.heading1"), shortcutAccelerator(options.markdownShortcuts, "heading1"), handlers.formatHeading1),
    item("markra:web-context:heading-2", label("menu.heading2"), shortcutAccelerator(options.markdownShortcuts, "heading2"), handlers.formatHeading2),
    item("markra:web-context:heading-3", label("menu.heading3"), shortcutAccelerator(options.markdownShortcuts, "heading3"), handlers.formatHeading3),
    separator(),
    item("markra:web-context:bullet-list", label("menu.bulletList"), shortcutAccelerator(options.markdownShortcuts, "bulletList"), handlers.formatBulletList),
    item("markra:web-context:ordered-list", label("menu.orderedList"), shortcutAccelerator(options.markdownShortcuts, "orderedList"), handlers.formatOrderedList),
    item("markra:web-context:quote", label("menu.quote"), shortcutAccelerator(options.markdownShortcuts, "quote"), handlers.formatQuote),
    item("markra:web-context:code-block", label("menu.codeBlock"), shortcutAccelerator(options.markdownShortcuts, "codeBlock"), handlers.formatCodeBlock)
  ];
  const exportMenu = submenu("markra:web-context:export", label("menu.export"), [
    item("markra:web-context:export-pdf", label("menu.exportPdf"), "CmdOrCtrl+P", handlers.exportPdf),
    item("markra:web-context:export-html", label("menu.exportHtml"), "CmdOrCtrl+Shift+E", handlers.exportHtml),
    item("markra:web-context:export-docx", label("menu.exportDocx"), undefined, handlers.exportDocx),
    item("markra:web-context:export-epub", label("menu.exportEpub"), undefined, handlers.exportEpub),
    item("markra:web-context:export-latex", label("menu.exportLatex"), undefined, handlers.exportLatex)
  ]);
  const entries: WebContextMenuEntry[] = [
    browserItem("markra:web-context:cut", label("menu.cut"), "CmdOrCtrl+X", "cut"),
    browserItem("markra:web-context:copy", label("menu.copy"), "CmdOrCtrl+C", "copy"),
    browserItem("markra:web-context:paste", label("menu.paste"), "CmdOrCtrl+V", "paste"),
    browserItem("markra:web-context:select-all", label("menu.selectAll"), "CmdOrCtrl+A", "selectAll"),
    separator(),
    submenu("markra:web-context:format", label("menu.format"), formatItems),
    separator(),
    item("markra:web-context:link", label("menu.link"), shortcutAccelerator(options.markdownShortcuts, "link"), handlers.insertLink),
    item("markra:web-context:image", label("menu.image"), shortcutAccelerator(options.markdownShortcuts, "image"), handlers.insertImage),
    item("markra:web-context:table", label("menu.table"), shortcutAccelerator(options.markdownShortcuts, "table"), handlers.insertTable)
  ];

  if (exportMenu.enabled) {
    entries.push(separator(), exportMenu);
  }

  if (options.aiCommandsAvailable) {
    entries.push(
      separator(),
      submenu("markra:web-context:ai", label("app.aiToolkit"), [
        item("markra:web-context:ai-polish", label("app.aiPolish"), undefined, handlers.aiPolish),
        item("markra:web-context:ai-rewrite", label("app.aiRewrite"), undefined, handlers.aiRewrite),
        item("markra:web-context:ai-continue-writing", label("app.aiContinueWriting"), undefined, handlers.aiContinueWriting),
        item("markra:web-context:ai-summarize", label("app.aiSummarize"), undefined, handlers.aiSummarize),
        item("markra:web-context:ai-translate", label("app.aiTranslate"), undefined, handlers.aiTranslate)
      ])
    );
  }

  return collapseSeparators(entries);
}

function createWebMarkdownFileTreeContextMenuItems(
  handlers: NativeMarkdownFileTreeContextMenuHandlers,
  language: AppLanguage = "en",
  file?: NativeMarkdownFolderFile
): WebContextMenuEntry[] {
  const label = (key: I18nKey) => menuLabel(language, key);
  const fileIsFolder = file?.kind === "folder";
  const fileIsAsset = file?.kind === "asset";
  const templateItems = handlers.createFileFromTemplates?.map((template) =>
    item(`markra:web-file-tree:new-from-template:${template.id}`, template.name, undefined, template.create)
  ) ?? [];
  const entries: WebContextMenuEntry[] = [
    item("markra:web-file-tree:new", label("app.newMarkdownFile"), undefined, handlers.createFile),
    ...(templateItems.length > 0
      ? [submenu("markra:web-file-tree:new-from-template", label("app.newMarkdownFileFromTemplate"), templateItems)]
      : []),
    item("markra:web-file-tree:new-folder", label("app.newMarkdownFolder"), undefined, handlers.createFolder)
  ];

  if (!file) return collapseSeparators(entries);

  if (fileIsFolder) {
    entries.push(
      separator(),
      item("markra:web-file-tree:delete", label("app.deleteMarkdownFolder"), undefined, () => handlers.deleteFile?.(file), Boolean(handlers.deleteFile))
    );

    return collapseSeparators(entries);
  }

  entries.push(separator());
  if (!fileIsAsset && handlers.openFileToSide) {
    const canOpenFileToSide = handlers.canOpenFileToSide?.(file) ?? true;
    entries.push(
      item(
        "markra:web-file-tree:open-to-side",
        label("app.openDocumentToSide"),
        undefined,
        canOpenFileToSide ? () => handlers.openFileToSide?.(file) : undefined,
        canOpenFileToSide
      )
    );
  }
  if (!fileIsAsset && handlers.saveFileAsTemplate) {
    entries.push(
      item(
        "markra:web-file-tree:save-as-template",
        label("app.saveMarkdownFileAsTemplate"),
        undefined,
        () => handlers.saveFileAsTemplate?.(file)
      )
    );
  }
  entries.push(
    item("markra:web-file-tree:rename", label("app.renameMarkdownFile"), undefined, () => handlers.renameFile?.(file), Boolean(handlers.renameFile)),
    item("markra:web-file-tree:delete", label("app.deleteMarkdownFile"), undefined, () => handlers.deleteFile?.(file), Boolean(handlers.deleteFile))
  );

  return collapseSeparators(entries);
}

function collapseSeparators(entries: WebContextMenuEntry[]) {
  const collapsed: WebContextMenuEntry[] = [];

  entries.forEach((entry) => {
    if (entry.kind === "separator" && (collapsed.length === 0 || collapsed.at(-1)?.kind === "separator")) return;
    if (entry.kind === "submenu") {
      const submenuEntry = submenu(entry.id, entry.label, entry.entries);
      if (submenuEntry.entries.length === 0) return;

      collapsed.push(submenuEntry);
      return;
    }
    collapsed.push(entry);
  });

  if (collapsed.at(-1)?.kind === "separator") {
    collapsed.pop();
  }

  return collapsed;
}

function readAiCommandsAvailable(options: NativeEditorContextMenuOptions) {
  try {
    return Boolean(options.getAiCommandsAvailable?.());
  } catch {
    return false;
  }
}

function ensureContextMenuStyle(documentTarget: Document) {
  if (documentTarget.getElementById(webContextMenuStyleId)) return;

  const style = documentTarget.createElement("style");
  style.id = webContextMenuStyleId;
  style.textContent = `
    .markra-web-context-menu,
    .markra-web-context-menu-submenu {
      position: fixed;
      z-index: 2147483647;
      min-width: 216px;
      max-width: min(280px, calc(100vw - 16px));
      padding: 5px;
      border: 1px solid var(--border-default, rgb(238 238 238));
      border-radius: 8px;
      background: var(--bg-primary, rgb(250 250 250));
      color: var(--text-primary, rgb(51 51 51));
      box-shadow: 0 14px 36px color-mix(in srgb, var(--shadow-color, rgb(31 35 44)) 16%, transparent);
      font: 520 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      outline: none;
      user-select: none;
    }

    .markra-web-context-menu-submenu-shell {
      position: relative;
    }

    .markra-web-context-menu-submenu {
      position: absolute;
      top: -5px;
      left: calc(100% - 4px);
      display: none;
      max-width: min(280px, calc(100vw - 16px));
    }

    .markra-web-context-menu-submenu-shell[data-submenu-align="left"] > .markra-web-context-menu-submenu {
      right: calc(100% - 4px);
      left: auto;
    }

    .markra-web-context-menu-submenu-shell:hover > .markra-web-context-menu-submenu,
    .markra-web-context-menu-submenu-shell:focus-within > .markra-web-context-menu-submenu {
      display: block;
    }

    .markra-web-context-menu-item {
      display: flex;
      width: 100%;
      height: 28px;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      padding: 0 8px;
      color: var(--text-primary, rgb(51 51 51));
      font: inherit;
      text-align: left;
    }

    .markra-web-context-menu-item:not(:disabled) {
      cursor: pointer;
    }

    .markra-web-context-menu-item:not(:disabled):hover,
    .markra-web-context-menu-item:not(:disabled):focus-visible {
      background: var(--bg-hover, rgb(245 245 245));
      color: var(--text-heading, rgb(51 51 51));
      outline: none;
    }

    .markra-web-context-menu-item:disabled {
      opacity: 0.42;
    }

    .markra-web-context-menu-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .markra-web-context-menu-accelerator {
      flex: none;
      color: var(--text-tertiary, rgb(153 153 153));
      font-size: 12px;
      font-weight: 520;
    }

    .markra-web-context-menu-arrow {
      flex: none;
      color: var(--text-tertiary, rgb(153 153 153));
      font-size: 13px;
      font-weight: 620;
    }

    .markra-web-context-menu-separator {
      height: 1px;
      margin: 5px 4px;
      background: var(--border-default, rgb(238 238 238));
    }
  `;
  documentTarget.head.append(style);
}

function formatAccelerator(accelerator: string | undefined) {
  return accelerator?.replace(/CmdOrCtrl/gu, "Cmd/Ctrl");
}

function positionContextMenu(menu: HTMLElement, event: MouseEvent) {
  const margin = 8;
  const width = menu.offsetWidth || 216;
  const height = menu.offsetHeight || 320;
  const viewportWidth = menu.ownerDocument.defaultView?.innerWidth ?? 1024;
  const viewportHeight = menu.ownerDocument.defaultView?.innerHeight ?? 768;
  const left = Math.max(margin, Math.min(event.clientX, viewportWidth - width - margin));
  const top = Math.max(margin, Math.min(event.clientY, viewportHeight - height - margin));

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function alignContextSubmenus(menu: HTMLElement) {
  const viewportWidth = menu.ownerDocument.defaultView?.innerWidth ?? 1024;
  const rootRect = menu.getBoundingClientRect();
  const submenuWidth = 216;

  menu.querySelectorAll<HTMLElement>(".markra-web-context-menu-submenu-shell").forEach((shell) => {
    if (rootRect.right + submenuWidth > viewportWidth - 8) {
      shell.dataset.submenuAlign = "left";
      return;
    }

    delete shell.dataset.submenuAlign;
  });
}

function currentContextMenuMouseEvent(documentTarget: Document) {
  const currentEvent = (documentTarget.defaultView as (Window & { event?: Event }) | null)?.event;
  if (currentEvent instanceof MouseEvent) return currentEvent;

  return new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: 8,
    clientY: 8
  });
}

function createContextMenuItem(documentTarget: Document, entry: WebContextMenuItem, closeMenu: () => unknown) {
  const button = documentTarget.createElement("button");
  button.className = "markra-web-context-menu-item";
  button.type = "button";
  button.role = "menuitem";
  button.disabled = !entry.enabled;
  button.dataset.menuItemId = entry.id;

  const label = documentTarget.createElement("span");
  label.className = "markra-web-context-menu-label";
  label.textContent = entry.label;
  button.append(label);

  const accelerator = formatAccelerator(entry.accelerator);
  if (accelerator) {
    const shortcut = documentTarget.createElement("span");
    shortcut.className = "markra-web-context-menu-accelerator";
    shortcut.textContent = accelerator;
    button.append(shortcut);
  }

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
  });
  button.addEventListener("click", () => {
    if (!entry.enabled) return;
    runMenuAction(entry.action);
    closeMenu();
  });

  return button;
}

function appendContextMenuEntries(
  documentTarget: Document,
  container: HTMLElement,
  entries: WebContextMenuEntry[],
  closeMenu: () => unknown
) {
  entries.forEach((entry) => {
    if (entry.kind === "separator") {
      const separatorElement = documentTarget.createElement("div");
      separatorElement.className = "markra-web-context-menu-separator";
      separatorElement.role = "separator";
      container.append(separatorElement);
      return;
    }

    if (entry.kind === "submenu") {
      container.append(createContextSubmenu(documentTarget, entry, closeMenu));
      return;
    }

    container.append(createContextMenuItem(documentTarget, entry, closeMenu));
  });
}

function createContextSubmenu(documentTarget: Document, entry: WebContextMenuSubmenu, closeMenu: () => unknown) {
  const shell = documentTarget.createElement("div");
  shell.className = "markra-web-context-menu-submenu-shell";

  const button = documentTarget.createElement("button");
  button.className = "markra-web-context-menu-item";
  button.type = "button";
  button.role = "menuitem";
  button.disabled = !entry.enabled;
  button.dataset.menuItemId = entry.id;
  button.setAttribute("aria-haspopup", "menu");

  const label = documentTarget.createElement("span");
  label.className = "markra-web-context-menu-label";
  label.textContent = entry.label;
  button.append(label);

  const arrow = documentTarget.createElement("span");
  arrow.className = "markra-web-context-menu-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = ">";
  button.append(arrow);

  const submenuElement = documentTarget.createElement("div");
  submenuElement.className = "markra-web-context-menu-submenu";
  submenuElement.dataset.menuSubmenuId = entry.id;
  submenuElement.role = "menu";
  appendContextMenuEntries(documentTarget, submenuElement, entry.entries, closeMenu);

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
  });
  button.addEventListener("click", (event) => {
    event.preventDefault();
    button.focus({ preventScroll: true });
  });

  shell.append(button, submenuElement);

  return shell;
}

function showWebContextMenu(documentTarget: Document, event: MouseEvent, entries: WebContextMenuEntry[]) {
  ensureContextMenuStyle(documentTarget);
  documentTarget.querySelector(`[${webContextMenuAttribute}]`)?.remove();

  const menu = documentTarget.createElement("div");
  menu.className = "markra-web-context-menu";
  menu.setAttribute(webContextMenuAttribute, "true");
  menu.role = "menu";
  menu.tabIndex = -1;

  let closed = false;
  const closeMenu = () => {
    if (closed) return;

    closed = true;
    documentTarget.removeEventListener("pointerdown", handleDocumentPointerDown, true);
    documentTarget.removeEventListener("keydown", handleDocumentKeyDown, true);
    documentTarget.defaultView?.removeEventListener("resize", closeMenu);
    documentTarget.defaultView?.removeEventListener("scroll", closeMenu, true);
    menu.remove();
  };
  const handleDocumentPointerDown = (pointerEvent: PointerEvent) => {
    const target = pointerEvent.target instanceof Node ? pointerEvent.target : null;
    if (target && menu.contains(target)) return;

    closeMenu();
  };
  const handleDocumentKeyDown = (keyboardEvent: KeyboardEvent) => {
    if (keyboardEvent.key === "Escape") {
      keyboardEvent.preventDefault();
      closeMenu();
    }
  };

  appendContextMenuEntries(documentTarget, menu, entries, closeMenu);

  documentTarget.body.append(menu);
  positionContextMenu(menu, event);
  alignContextSubmenus(menu);
  menu.focus({ preventScroll: true });
  documentTarget.addEventListener("pointerdown", handleDocumentPointerDown, true);
  documentTarget.addEventListener("keydown", handleDocumentKeyDown, true);
  documentTarget.defaultView?.addEventListener("resize", closeMenu);
  documentTarget.defaultView?.addEventListener("scroll", closeMenu, true);

  return closeMenu;
}

export function createWebMenuRuntime(
  defaultMenuRuntime: AppMenuRuntime,
  options: WebRuntimeOptions
): AppMenuRuntime {
  return {
    ...defaultMenuRuntime,
    createEditorContextMenuItems: (handlers, language, menuOptions) =>
      createWebEditorContextMenuItems(handlers, language, menuOptions),
    createMarkdownFileTreeContextMenuItems: (handlers, language, file) =>
      createWebMarkdownFileTreeContextMenuItems(handlers, language, file),
    installEditorContextMenu: async (target, handlers, language = "en", menuOptions = {}) => {
      let closeCurrentMenu: (() => unknown) | null = null;
      const handleContextMenu = (event: Event) => {
        const documentTarget = resolveDocument(options);
        const mouseEvent = event instanceof MouseEvent ? event : null;
        const element = event.target instanceof Element ? event.target : null;
        if (!documentTarget || !mouseEvent || !element?.closest(".markdown-paper")) return;

        event.preventDefault();
        event.stopPropagation();
        closeCurrentMenu?.();
        closeCurrentMenu = showWebContextMenu(
          documentTarget,
          mouseEvent,
          createWebEditorContextMenuItems(handlers, language, {
            aiCommandsAvailable: readAiCommandsAvailable(menuOptions),
            markdownShortcuts: menuOptions.markdownShortcuts
          })
        );
      };

      target.addEventListener("contextmenu", handleContextMenu);

      return () => {
        target.removeEventListener("contextmenu", handleContextMenu);
        closeCurrentMenu?.();
      };
    },
    showMarkdownFileTreeContextMenu: async (
      handlers: NativeMarkdownFileTreeContextMenuHandlers,
      language?: AppLanguage,
      file?: NativeMarkdownFolderFile
    ) => {
      const documentTarget = resolveDocument(options);
      if (!documentTarget) return;

      showWebContextMenu(
        documentTarget,
        currentContextMenuMouseEvent(documentTarget),
        createWebMarkdownFileTreeContextMenuItems(handlers, language, file)
      );
    }
  };
}
