import {
  Bot,
  Code2,
  Cloud,
  Database,
  Eye,
  FileText,
  FolderOpen,
  HardDrive,
  History,
  Languages,
  Moon,
  PanelRight,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Server,
  Trash2,
  Wifi,
  type LucideIcon
} from "lucide-react";
import {
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  closestCenter,
  DndContext,
  MouseSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier
} from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { IconButton, SegmentedControl, SegmentedControlItem } from "@markra/ui";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  defaultMarkdownShortcuts,
  markdownShortcutFromKeyboardEvent,
  normalizeMarkdownShortcuts,
  parseMarkdownShortcut,
  type MarkdownShortcutAction
} from "@markra/editor";
import {
  defaultTitlebarActions,
  appThemeOptions,
  defaultBackupSettings,
  defaultSyncSettings,
  reorderTitlebarActions,
  type AppTheme,
  type BackupSettings as BackupSettingsValue,
  type EditorPreferences,
  type ExportSettings as ExportSettingsValue,
  type ImageUploadProvider,
  type NetworkSettings as NetworkSettingsValue,
  type PdfMarginPreset,
  type PdfPageSize,
  type SidebarLayoutMode,
  type SyncSettings as SyncSettingsValue,
  type TitlebarActionId,
  type TitlebarActionPreference,
  type WebSearchProviderId,
  type WebSearchSettings
} from "../lib/settings/app-settings";
import {
  aiQuickActionIds,
  aiQuickActionLabelKeys,
  defaultAiQuickActionPrompt,
  defaultAiQuickActionPrompts,
  type AiQuickActionId
} from "../lib/ai-actions";
import type { DesktopPlatform } from "../lib/platform";
import {
  aiTranslationLanguageName,
  clampNumber,
  supportedLanguages,
  type AppLanguage,
  type I18nKey
} from "@markra/shared";
import {
  editorContentWidthPixels,
  editorCustomContentWidthMax,
  editorCustomContentWidthMin,
  normalizeEditorContentWidthPx
} from "../lib/editor-width";
import {
  createDefaultCustomMarkdownTemplate,
  defaultMarkdownTemplates,
  markdownTemplateToSource,
  mergeMarkdownTemplates,
  updateMarkdownTemplateFromSource,
  type MarkdownTemplate
} from "../lib/templates";
import { SortableTitlebarAction } from "./SortableTitlebarAction";
import {
  SettingsButton,
  SettingsCallout,
  SettingsCheckbox,
  SettingsNumberInput,
  SettingsRow,
  SettingsSection,
  SettingsSelect,
  SettingsSwitch,
  SettingsTextarea,
  SettingsTextInput
} from "./settings/SettingsControls";
import { mergeClassNames } from "./settings/class-names";
import {
  CustomThemeCssControl,
  ThemePreviewGrid,
  themeLabelKeys
} from "./settings/ThemeSettingsControls";

type Translate = (key: I18nKey) => string;

const imageUploadProviderOptions: Array<{
  actionLabelKey: I18nKey;
  icon: LucideIcon;
  labelKey: I18nKey;
  value: ImageUploadProvider;
}> = [
  {
    actionLabelKey: "settings.editor.imageUploadProvider.useLocal",
    icon: HardDrive,
    labelKey: "settings.editor.imageUploadProvider.local",
    value: "local"
  },
  {
    actionLabelKey: "settings.editor.imageUploadProvider.useWebDav",
    icon: Cloud,
    labelKey: "settings.editor.imageUploadProvider.webdav",
    value: "webdav"
  },
  {
    actionLabelKey: "settings.editor.imageUploadProvider.usePicGo",
    icon: Server,
    labelKey: "settings.editor.imageUploadProvider.picgo",
    value: "picgo"
  },
  {
    actionLabelKey: "settings.editor.imageUploadProvider.useS3",
    icon: Database,
    labelKey: "settings.editor.imageUploadProvider.s3",
    value: "s3"
  }
];

const imageUploadProviderSettingsActionLabelKeys: Record<ImageUploadProvider, I18nKey> = {
  local: "settings.editor.imageUploadProvider.showLocalSettings",
  picgo: "settings.editor.imageUploadProvider.showPicGoSettings",
  s3: "settings.editor.imageUploadProvider.showS3Settings",
  webdav: "settings.editor.imageUploadProvider.showWebDavSettings"
};

function availableImageUploadProviderOptions(s3ImageUploadEnabled: boolean) {
  return imageUploadProviderOptions.filter((option) => option.value !== "s3" || s3ImageUploadEnabled);
}

function availableImageUploadProvider(provider: ImageUploadProvider, s3ImageUploadEnabled: boolean): ImageUploadProvider {
  return availableImageUploadProviderOptions(s3ImageUploadEnabled).some((option) => option.value === provider)
    ? provider
    : "local";
}

function imageUploadProviderGridClass(optionCount: number) {
  if (optionCount >= 4) return "grid-cols-4";
  if (optionCount === 3) return "grid-cols-3";

  return "grid-cols-2";
}

const titlebarActionOptions: Array<{
  icon: LucideIcon;
  id: TitlebarActionId;
  labelKey: I18nKey;
}> = [
  {
    icon: Bot,
    id: "aiAgent",
    labelKey: "app.toggleAiAgent"
  },
  {
    icon: Code2,
    id: "sourceMode",
    labelKey: "app.switchToSourceMode"
  },
  {
    icon: PanelRight,
    id: "splitMode",
    labelKey: "app.switchToSplitMode"
  },
  {
    icon: History,
    id: "history",
    labelKey: "app.showDocumentHistory"
  },
  {
    icon: Save,
    id: "save",
    labelKey: "app.saveMarkdown"
  },
  {
    icon: Moon,
    id: "theme",
    labelKey: "app.switchToDarkTheme"
  }
];

function titlebarActionAvailable(id: TitlebarActionId, aiEnabled: boolean) {
  return aiEnabled || id !== "aiAgent";
}

const bodyFontSizeOptions = [14, 15, 16, 17, 18, 20];
const contentWidthRatioSpanPx = editorCustomContentWidthMax - editorCustomContentWidthMin;
const contentWidthRatioMin = 0;
const contentWidthRatioMax = 100;
const titlebarActionDragThresholdPx = 4;
const exportMarginPresetOptions: PdfMarginPreset[] = ["default", "none", "narrow", "normal", "wide", "custom"];
const exportPageSizeOptions: PdfPageSize[] = ["default", "a4", "letter", "custom"];
const lineHeightOptions = [1.5, 1.65, 1.8];
const webSearchProviderOptions: WebSearchProviderId[] = ["local-bing", "searxng"];
const sidebarLayoutOptions: Array<{
  labelKey: I18nKey;
  value: SidebarLayoutMode;
}> = [
  {
    labelKey: "settings.editor.sidebarLayoutMode.stacked",
    value: "stacked"
  },
  {
    labelKey: "settings.editor.sidebarLayoutMode.tabs",
    value: "tabs"
  }
];
const markdownShortcutLabelKeys: Record<MarkdownShortcutAction, I18nKey> = {
  bold: "menu.bold",
  bulletList: "menu.bulletList",
  codeBlock: "menu.codeBlock",
  heading1: "menu.heading1",
  heading2: "menu.heading2",
  heading3: "menu.heading3",
  image: "menu.image",
  inlineCode: "menu.inlineCode",
  italic: "menu.italic",
  link: "menu.link",
  openQuickOpen: "app.quickOpen",
  orderedList: "menu.orderedList",
  paragraph: "menu.paragraph",
  quote: "menu.quote",
  strikethrough: "menu.strikethrough",
  table: "menu.table",
  toggleAiAgent: "app.toggleAiAgent",
  toggleAiCommand: "app.aiCommandDialog",
  toggleAllFolds: "editor.toggleAllFolds",
  toggleDocumentHistory: "app.documentHistory",
  toggleMarkdownFiles: "app.toggleMarkdownFiles",
  toggleReadOnlyMode: "app.toggleReadOnlyMode",
  toggleSourceMode: "app.switchToSourceMode"
};
const titlebarActionVisibleClassName =
  "aria-[pressed=true]:border-transparent aria-[pressed=true]:bg-(--bg-active) aria-[pressed=true]:text-(--text-heading) aria-[pressed=true]:opacity-100 aria-[pressed=true]:hover:bg-(--bg-active)";
const titlebarActionHiddenClassName = "text-(--text-secondary) opacity-55 hover:opacity-100";

const keyboardShortcutSections: Array<{
  labelKey: I18nKey;
  actions: MarkdownShortcutAction[];
}> = [
  {
    labelKey: "settings.editor.shortcutsGroupApp",
    actions: [
      "openQuickOpen",
      "toggleMarkdownFiles",
      "toggleDocumentHistory",
      "toggleAiAgent",
      "toggleAiCommand",
      "toggleSourceMode",
      "toggleReadOnlyMode"
    ]
  },
  {
    labelKey: "settings.categories.editor",
    actions: [
      "bold",
      "italic",
      "strikethrough",
      "inlineCode",
      "paragraph",
      "heading1",
      "heading2",
      "heading3",
      "bulletList",
      "orderedList",
      "quote",
      "codeBlock",
      "link",
      "image",
      "table",
      "toggleAllFolds"
    ]
  }
];

function keyboardShortcutActionAvailable(action: MarkdownShortcutAction, aiEnabled: boolean) {
  return aiEnabled || (action !== "toggleAiAgent" && action !== "toggleAiCommand");
}

const exportPageSizeDimensions: Record<Exclude<PdfPageSize, "custom">, { heightMm: number; widthMm: number }> = {
  a4: { heightMm: 297, widthMm: 210 },
  default: { heightMm: 297, widthMm: 210 },
  letter: { heightMm: 279, widthMm: 216 }
};

const exportMarginPresetMm: Record<Exclude<PdfMarginPreset, "custom">, number> = {
  default: 18,
  narrow: 10,
  none: 0,
  normal: 18,
  wide: 25
};

function formatShortcutForPlatform(shortcut: string, platform: DesktopPlatform) {
  const parsed = parseMarkdownShortcut(shortcut);
  if (!parsed) return shortcut;

  if (platform === "macos") {
    return [
      "⌘",
      parsed.shift ? "⇧" : null,
      parsed.alt ? "⌥" : null,
      parsed.key
    ].filter((part): part is string => Boolean(part)).join("+");
  }

  return [
    "Ctrl",
    parsed.shift ? "Shift" : null,
    parsed.alt ? "Alt" : null,
    parsed.key
  ].filter((part): part is string => Boolean(part)).join("+");
}

function contentWidthRatioValue(preferences: EditorPreferences) {
  const contentWidthPx = preferences.contentWidthPx ?? editorContentWidthPixels[preferences.contentWidth];

  return Math.round(((contentWidthPx - editorCustomContentWidthMin) / contentWidthRatioSpanPx) * 100);
}

function contentWidthPxFromRatio(value: number) {
  const ratio = clampNumber(value, contentWidthRatioMin, contentWidthRatioMax);
  if (ratio === null) return null;

  return normalizeEditorContentWidthPx(Math.round(editorCustomContentWidthMin + (contentWidthRatioSpanPx * ratio) / 100));
}

function SettingsContentWidthInput({
  label,
  onUpdatePreferences,
  preferences,
  resetLabel
}: {
  label: string;
  onUpdatePreferences: (preferences: EditorPreferences) => unknown;
  preferences: EditorPreferences;
  resetLabel: string;
}) {
  const ratio = contentWidthRatioValue(preferences);
  const [draftRatio, setDraftRatio] = useState(String(ratio));

  useEffect(() => {
    setDraftRatio(String(ratio));
  }, [ratio]);

  return (
    <div className="content-width-ratio-control inline-flex h-8 items-center overflow-hidden rounded-md border border-(--border-default) bg-(--bg-primary) transition-colors duration-150 ease-out hover:bg-(--bg-hover) focus-within:ring-2 focus-within:ring-(--accent)">
      <div className="relative inline-flex h-full items-center">
        <input
          className="h-full w-18 border-0 bg-transparent py-0 pr-7 pl-3 text-[12px] leading-5 font-[560] text-(--text-heading) outline-none"
          type="text"
          aria-label={label}
          inputMode="numeric"
          min={contentWidthRatioMin}
          max={contentWidthRatioMax}
          pattern="[0-9]*"
          value={draftRatio}
          onChange={(event) => {
            const digits = event.currentTarget.value.replace(/\D/g, "");
            if (!digits) {
              setDraftRatio("");
              return;
            }

            const normalizedDigits = digits.replace(/^0+(?=\d)/, "");
            const nextRatio = Number(normalizedDigits);
            if (!Number.isFinite(nextRatio)) return;

            const nextContentWidthPx = contentWidthPxFromRatio(nextRatio);
            if (nextContentWidthPx === null) return;

            setDraftRatio(String(clampNumber(nextRatio, contentWidthRatioMin, contentWidthRatioMax) ?? ratio));
            onUpdatePreferences({
              ...preferences,
              contentWidth: "default",
              contentWidthPx: nextContentWidthPx
            });
          }}
          onBlur={() => {
            if (draftRatio) return;

            setDraftRatio(String(ratio));
          }}
        />
        <span
          className="pointer-events-none absolute right-2.5 text-[12px] leading-5 font-[560] text-(--text-secondary)"
          aria-hidden="true"
        >
          %
        </span>
      </div>
      <button
        className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center border-0 border-l border-(--border-default) bg-transparent text-(--text-secondary) transition-colors duration-150 ease-out hover:bg-(--bg-hover) hover:text-(--text-heading) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
        type="button"
        aria-label={resetLabel}
        title={resetLabel}
        onClick={() => {
          setDraftRatio(String(contentWidthRatioValue({
            ...preferences,
            contentWidth: "default",
            contentWidthPx: null
          })));
          onUpdatePreferences({
            ...preferences,
            contentWidth: "default",
            contentWidthPx: null
          });
        }}
      >
        <RotateCcw aria-hidden="true" size={13} />
      </button>
    </div>
  );
}

function exportPageSizeLabelKey(pageSize: PdfPageSize) {
  return `settings.export.pageSize.${pageSize}` as I18nKey;
}

function exportMarginPresetLabelKey(preset: PdfMarginPreset) {
  return `settings.export.margin.${preset}` as I18nKey;
}

function applyExportPageSize(settings: ExportSettingsValue, pageSize: PdfPageSize): ExportSettingsValue {
  if (pageSize === "custom") {
    return {
      ...settings,
      pdfPageSize: pageSize
    };
  }

  const dimensions = exportPageSizeDimensions[pageSize];

  return {
    ...settings,
    pdfHeightMm: dimensions.heightMm,
    pdfPageSize: pageSize,
    pdfWidthMm: dimensions.widthMm
  };
}

function applyExportMarginPreset(settings: ExportSettingsValue, preset: PdfMarginPreset): ExportSettingsValue {
  if (preset === "custom") {
    return {
      ...settings,
      pdfMarginPreset: preset
    };
  }

  return {
    ...settings,
    pdfMarginMm: exportMarginPresetMm[preset],
    pdfMarginPreset: preset
  };
}

function LanguageSelect({
  language,
  label,
  onSelectLanguage
}: {
  language: AppLanguage;
  label: string;
  onSelectLanguage: (language: AppLanguage) => unknown;
}) {
  return (
    <div className="relative inline-flex items-center">
      <Languages aria-hidden="true" className="pointer-events-none absolute left-2.5 text-(--text-secondary)" size={13} />
      <select
        className="h-8 min-w-42 appearance-none rounded-md border border-(--border-default) bg-(--bg-primary) px-8 text-[12px] leading-5 font-[560] text-(--text-heading) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
        aria-label={label}
        value={language}
        onChange={(event) => onSelectLanguage(event.currentTarget.value as AppLanguage)}
      >
        {supportedLanguages.map((supportedLanguage) => (
          <option key={supportedLanguage.code} value={supportedLanguage.code}>
            {supportedLanguage.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ImageUploadProviderControl({
  onSelectProvider,
  provider,
  s3ImageUploadEnabled = true,
  translate
}: {
  onSelectProvider: (provider: ImageUploadProvider) => unknown;
  provider: ImageUploadProvider;
  s3ImageUploadEnabled?: boolean;
  translate: Translate;
}) {
  const options = availableImageUploadProviderOptions(s3ImageUploadEnabled);
  const visibleProvider = availableImageUploadProvider(provider, s3ImageUploadEnabled);

  return (
    <SegmentedControl className={imageUploadProviderGridClass(options.length)} label={translate("settings.editor.imageUploadProvider")}>
      {options.map((option) => {
        const Icon = option.icon;
        const active = visibleProvider === option.value;

        return (
          <SegmentedControlItem
            key={option.value}
            label={translate(option.actionLabelKey)}
            selected={active}
            onClick={() => onSelectProvider(option.value)}
          >
            <Icon aria-hidden="true" size={13} />
            {translate(option.labelKey)}
          </SegmentedControlItem>
        );
      })}
    </SegmentedControl>
  );
}

function ImageUploadProviderSettingsControl({
  onSelectProvider,
  provider,
  s3ImageUploadEnabled = true,
  translate
}: {
  onSelectProvider: (provider: ImageUploadProvider) => unknown;
  provider: ImageUploadProvider;
  s3ImageUploadEnabled?: boolean;
  translate: Translate;
}) {
  const options = availableImageUploadProviderOptions(s3ImageUploadEnabled);
  const visibleProvider = availableImageUploadProvider(provider, s3ImageUploadEnabled);

  return (
    <SegmentedControl className={imageUploadProviderGridClass(options.length)} label={translate("settings.editor.imageUploadProviderSettings")}>
      {options.map((option) => {
        const Icon = option.icon;
        const active = visibleProvider === option.value;

        return (
          <SegmentedControlItem
            key={option.value}
            label={translate(imageUploadProviderSettingsActionLabelKeys[option.value])}
            selected={active}
            onClick={() => onSelectProvider(option.value)}
          >
            <Icon aria-hidden="true" size={13} />
            {translate(option.labelKey)}
          </SegmentedControlItem>
        );
      })}
    </SegmentedControl>
  );
}

function StorageTypeControlRow({
  onUpdatePreferences,
  preferences,
  s3ImageUploadEnabled = true,
  translate
}: {
  onUpdatePreferences: (preferences: EditorPreferences) => unknown;
  preferences: EditorPreferences;
  s3ImageUploadEnabled?: boolean;
  translate: Translate;
}) {
  const imageUpload = preferences.imageUpload;
  const activeProvider = availableImageUploadProvider(imageUpload.provider, s3ImageUploadEnabled);

  return (
    <SettingsRow
      title={translate("settings.editor.imageUploadProvider")}
      description={translate("settings.editor.imageUploadProviderDescription")}
      action={
        <ImageUploadProviderControl
          provider={activeProvider}
          s3ImageUploadEnabled={s3ImageUploadEnabled}
          translate={translate}
          onSelectProvider={(provider) =>
            onUpdatePreferences({
              ...preferences,
              imageUpload: {
                ...imageUpload,
                provider
              }
            })
          }
        />
      }
    />
  );
}

function SidebarLayoutModeControl({
  onUpdatePreferences,
  preferences,
  translate
}: {
  onUpdatePreferences: (preferences: EditorPreferences) => unknown;
  preferences: EditorPreferences;
  translate: Translate;
}) {
  return (
    <SegmentedControl className="grid-cols-2" label={translate("settings.editor.sidebarLayoutMode")}>
      {sidebarLayoutOptions.map((option) => (
        <SegmentedControlItem
          key={option.value}
          label={translate(option.labelKey)}
          selected={preferences.sidebarLayoutMode === option.value}
          onClick={() =>
            onUpdatePreferences({
              ...preferences,
              sidebarLayoutMode: option.value
            })
          }
        >
          {translate(option.labelKey)}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}

function titlebarActionOption(id: TitlebarActionId) {
  return titlebarActionOptions.find((option) => option.id === id) ?? titlebarActionOptions[0]!;
}

function SettingsTitlebarActionsControl({
  aiEnabled = true,
  onUpdatePreferences,
  preferences,
  translate
}: {
  aiEnabled?: boolean;
  onUpdatePreferences: (preferences: EditorPreferences) => unknown;
  preferences: EditorPreferences;
  translate: Translate;
}) {
  const actions = useMemo(
    () => preferences.titlebarActions.filter((action) => titlebarActionAvailable(action.id, aiEnabled)),
    [aiEnabled, preferences.titlebarActions]
  );
  const hiddenActions = useMemo(
    () => preferences.titlebarActions.filter((action) => !titlebarActionAvailable(action.id, aiEnabled)),
    [aiEnabled, preferences.titlebarActions]
  );
  const draggingActionIdRef = useRef<TitlebarActionId | null>(null);
  const suppressActionClickIdsRef = useRef(new Set<TitlebarActionId>());
  const actionIds = useMemo(() => actions.map((action) => action.id), [actions]);
  const sensors = useSensors(useSensor(MouseSensor, {
    activationConstraint: {
      distance: titlebarActionDragThresholdPx
    }
  }));
  const updateActions = (titlebarActions: TitlebarActionPreference[]) => {
    onUpdatePreferences({
      ...preferences,
      titlebarActions: [...titlebarActions, ...hiddenActions]
    });
  };
  const toggleAction = (id: TitlebarActionId) => {
    updateActions(actions.map((action) =>
      action.id === id ? { ...action, visible: !action.visible } : action
    ));
  };
  const titlebarActionIdFromDndId = (id: UniqueIdentifier) => {
    const actionId = id as TitlebarActionId;

    return actions.some((action) => action.id === actionId) ? actionId : null;
  };
  const suppressActionClick = (id: TitlebarActionId) => {
    suppressActionClickIdsRef.current.add(id);
    window.setTimeout(() => {
      suppressActionClickIdsRef.current.delete(id);
    }, 0);
  };
  const handleDragStart = ({ active }: DragStartEvent) => {
    draggingActionIdRef.current = titlebarActionIdFromDndId(active.id);
  };
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const draggedId = titlebarActionIdFromDndId(active.id);
    const targetId = over ? titlebarActionIdFromDndId(over.id) : null;
    draggingActionIdRef.current = null;
    if (draggedId) suppressActionClick(draggedId);
    if (targetId) suppressActionClick(targetId);
    if (!draggedId || !targetId) return;

    updateActions(reorderTitlebarActions(actions, draggedId, targetId));
  };
  const handleDragCancel = () => {
    const draggedId = draggingActionIdRef.current;
    draggingActionIdRef.current = null;
    if (draggedId) suppressActionClick(draggedId);
  };
  const handleClick = (id: TitlebarActionId, event: ReactMouseEvent<HTMLButtonElement>) => {
    if (suppressActionClickIdsRef.current.has(id)) {
      suppressActionClickIdsRef.current.delete(id);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    toggleAction(id);
  };

  return (
    <div
      className="inline-flex items-center gap-1.5"
      role="group"
      aria-label={translate("settings.editor.titlebarActions")}
    >
      <div className="inline-flex h-8 items-center gap-1 rounded-md border border-(--border-default) bg-(--bg-primary) p-0.5">
        <DndContext
          collisionDetection={closestCenter}
          sensors={sensors}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
          onDragStart={handleDragStart}
        >
          <SortableContext items={actionIds} strategy={horizontalListSortingStrategy}>
            {actions.map((action) => {
              const option = titlebarActionOption(action.id);
              const Icon = option.icon;
              const label = translate(option.labelKey);

              return (
                <SortableTitlebarAction key={action.id} id={action.id}>
                  {(sortable) => (
                    <span
                      className={sortable.itemClassName}
                      data-titlebar-action={action.id}
                      ref={sortable.setItemRef}
                      style={sortable.itemStyle}
                    >
                      <IconButton
                        className={mergeClassNames(
                          titlebarActionVisibleClassName,
                          action.visible ? "" : titlebarActionHiddenClassName,
                          sortable.actionClassName
                        )}
                        data-visible={action.visible ? "true" : "false"}
                        label={label}
                        pressed={action.visible}
                        title={label}
                        size="icon-xs"
                        onClick={(event) => handleClick(action.id, event)}
                        {...sortable.actionAttributes}
                        {...sortable.actionListeners}
                      >
                        <Icon aria-hidden="true" size={13} />
                      </IconButton>
                    </span>
                  )}
                </SortableTitlebarAction>
              );
            })}
          </SortableContext>
        </DndContext>
      </div>
      <SettingsButton
        label={translate("settings.editor.titlebarActionsReset")}
        onClick={() => updateActions(defaultTitlebarActions
          .filter((action) => titlebarActionAvailable(action.id, aiEnabled))
          .map((action) => ({ ...action })))}
      >
        <RotateCcw aria-hidden="true" size={13} />
        {translate("settings.editor.shortcutsReset")}
      </SettingsButton>
    </div>
  );
}

function SettingsMarkdownTemplateSourceEditor({
  onUpdate,
  template,
  translate
}: {
  onUpdate: (template: MarkdownTemplate) => unknown;
  template: MarkdownTemplate;
  translate: Translate;
}) {
  const [source, setSource] = useState(() => markdownTemplateToSource(template));

  useEffect(() => {
    setSource(markdownTemplateToSource(template));
  }, [template.id]);

  const handleChange = (value: string) => {
    setSource(value);
    onUpdate(updateMarkdownTemplateFromSource(template, value));
  };

  return (
    <SettingsTextarea
      className="min-h-60 font-mono"
      label={`${translate("settings.templates.source")}: ${template.name}`}
      value={source}
      widthClassName="w-full"
      spellCheck={false}
      onChange={handleChange}
    />
  );
}

function SettingsMarkdownTemplatePreview({
  template,
  translate
}: {
  template: MarkdownTemplate;
  translate: Translate;
}) {
  return (
    <div
      className="markdown-paper settings-template-preview"
      role="region"
      aria-label={`${translate("settings.templates.preview")}: ${template.name}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {template.content}
      </ReactMarkdown>
    </div>
  );
}

export function TemplatesSettings({
  onCreateTemplate,
  onDeleteTemplate,
  onUpdateTemplate,
  preferences,
  templates,
  translate
}: {
  onCreateTemplate: (template: MarkdownTemplate) => unknown;
  onDeleteTemplate: (template: MarkdownTemplate) => unknown;
  onUpdateTemplate: (template: MarkdownTemplate) => unknown;
  preferences: EditorPreferences;
  templates: readonly MarkdownTemplate[];
  translate: Translate;
}) {
  const visibleMarkdownTemplates = useMemo(
    () => mergeMarkdownTemplates(templates),
    [templates]
  );
  const builtInTemplateIds = useMemo(() => new Set(defaultMarkdownTemplates.map((template) => template.id)), []);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    templates[0]?.id ?? visibleMarkdownTemplates[0]?.id ?? null
  );
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const selectedTemplate =
    visibleMarkdownTemplates.find((template) => template.id === selectedTemplateId) ??
    visibleMarkdownTemplates[0] ??
    null;
  const selectedTemplateEditing = selectedTemplate ? editingTemplateId === selectedTemplate.id : false;
  const selectedTemplateBuiltIn = selectedTemplate ? builtInTemplateIds.has(selectedTemplate.id) : false;

  useEffect(() => {
    const selectedTemplateExists = visibleMarkdownTemplates.some((template) => template.id === selectedTemplateId);

    if (selectedTemplateId && selectedTemplateExists) return;

    setSelectedTemplateId(visibleMarkdownTemplates[0]?.id ?? null);
  }, [visibleMarkdownTemplates, selectedTemplateId]);

  const updateSelectedTemplate = (updatedTemplate: MarkdownTemplate) => {
    setSelectedTemplateId(updatedTemplate.id);
    onUpdateTemplate(updatedTemplate);
  };
  const deleteSelectedTemplate = () => {
    if (!selectedTemplate || selectedTemplateBuiltIn) return;

    const selectedIndex = visibleMarkdownTemplates.findIndex((template) => template.id === selectedTemplate.id);
    const nextVisibleMarkdownTemplates = visibleMarkdownTemplates.filter((template) => template.id !== selectedTemplate.id);
    const nextSelectedTemplateId =
      nextVisibleMarkdownTemplates[Math.min(selectedIndex, nextVisibleMarkdownTemplates.length - 1)]?.id ?? null;

    setSelectedTemplateId(nextSelectedTemplateId);
    onDeleteTemplate(selectedTemplate);
  };
  const selectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setEditingTemplateId(null);
  };
  const toggleSelectedTemplateEditing = () => {
    if (!selectedTemplate) return;

    setEditingTemplateId(selectedTemplateEditing ? null : selectedTemplate.id);
  };
  const addTemplate = () => {
    const template = createDefaultCustomMarkdownTemplate([
      ...preferences.markdownTemplates,
      ...templates
    ]);

    setSelectedTemplateId(template.id);
    onCreateTemplate(template);
    setEditingTemplateId(template.id);
  };

  return (
    <SettingsSection label={translate("settings.sections.templates")}>
      <SettingsRow
        title={translate("settings.templates.custom")}
        description={translate("settings.templates.description")}
        action={
          <SettingsButton
            label={translate("settings.templates.add")}
            onClick={addTemplate}
          >
            <Plus aria-hidden="true" size={13} />
            {translate("settings.templates.add")}
          </SettingsButton>
        }
      />
      {visibleMarkdownTemplates.length === 0 ? (
        <div className="settings-row py-14">
          <div className="mx-auto flex max-w-64 flex-col items-center gap-2.5 text-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-(--border-default) bg-(--bg-secondary) text-(--text-secondary)">
              <FileText aria-hidden="true" size={16} />
            </span>
            <p className="m-0 text-[12px] leading-5 font-[620] text-(--text-heading)">
              {translate("settings.templates.empty")}
            </p>
          </div>
        </div>
      ) : (
        <div className="settings-row py-4">
          <div className="settings-templates-layout grid grid-cols-[200px_minmax(0,1fr)] gap-5 max-[760px]:grid-cols-1">
            <ul
              className="m-0 flex max-h-105 min-h-18 list-none flex-col gap-0.5 overflow-y-auto border-r border-(--border-default) p-0 pr-3 max-[760px]:max-h-48 max-[760px]:border-r-0 max-[760px]:border-b max-[760px]:pb-3"
              role="list"
              aria-label={translate("settings.templates.list")}
            >
              {visibleMarkdownTemplates.map((template) => {
                const selected = selectedTemplate?.id === template.id;

                return (
                  <li key={template.id} className="min-w-0">
                    <button
                      className={mergeClassNames(
                        "flex w-full min-w-0 flex-col rounded-md px-2.5 py-2 text-left transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)",
                        selected
                          ? "bg-(--bg-active) text-(--text-heading)"
                          : "text-(--text-heading) hover:bg-(--bg-hover)"
                      )}
                      type="button"
                      aria-current={selected ? "true" : "false"}
                      aria-label={template.name}
                      onClick={() => selectTemplate(template.id)}
                    >
                      <span className="block w-full truncate text-[12px] leading-5 font-[650]">{template.name}</span>
                      <span
                        className="block w-full truncate text-[11px] leading-4 font-[450] text-(--text-secondary)"
                        aria-hidden="true"
                      >
                        {template.suggestedName}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <section className="min-w-0 pl-0.5 max-[760px]:pl-0" role="region" aria-label={translate("settings.templates.editor")}>
              <div className="grid gap-3.5">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div className="min-w-0">
                    <p className="m-0 truncate text-[13px] leading-5 font-[680] text-(--text-heading)">
                      {selectedTemplate.name}
                    </p>
                    <p className="m-0 mt-0.5 truncate text-[12px] leading-4.5 text-(--text-secondary)">
                      {selectedTemplate.suggestedName}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconButton
                      className="rounded-md"
                      label={`${translate(selectedTemplateEditing ? "settings.templates.showPreview" : "settings.templates.edit")}: ${selectedTemplate.name}`}
                      onClick={toggleSelectedTemplateEditing}
                    >
                      {selectedTemplateEditing ? (
                        <Eye aria-hidden="true" size={14} />
                      ) : (
                        <Pencil aria-hidden="true" size={14} />
                      )}
                    </IconButton>
                    {selectedTemplateBuiltIn ? null : (
                      <IconButton
                        className="rounded-md"
                        label={`${translate("settings.templates.delete")}: ${selectedTemplate.name}`}
                        onClick={deleteSelectedTemplate}
                      >
                        <Trash2 aria-hidden="true" size={14} />
                      </IconButton>
                    )}
                  </div>
                </div>
                {selectedTemplateEditing ? (
                  <SettingsMarkdownTemplateSourceEditor
                    template={selectedTemplate}
                    translate={translate}
                    onUpdate={updateSelectedTemplate}
                  />
                ) : (
                  <SettingsMarkdownTemplatePreview
                    template={selectedTemplate}
                    translate={translate}
                  />
                )}
                <p className="m-0 text-[12px] leading-5 text-(--text-secondary)">
                  {translate("settings.templates.variables")}
                </p>
              </div>
            </section>
          </div>
        </div>
      )}
    </SettingsSection>
  );
}

export function GeneralSettings({
  appVersion,
  language,
  onCheckForUpdates,
  onResetWelcomeDocument,
  onSelectLanguage,
  onUpdatePreferences,
  preferences,
  translate,
  updatesEnabled = true,
  welcomeReset
}: {
  appVersion: string;
  language: AppLanguage;
  onCheckForUpdates: () => unknown;
  onResetWelcomeDocument: () => unknown;
  onSelectLanguage: (language: AppLanguage) => unknown;
  onUpdatePreferences: (preferences: EditorPreferences) => unknown;
  preferences: EditorPreferences;
  translate: Translate;
  updatesEnabled?: boolean;
  welcomeReset: boolean;
}) {
  return (
    <>
      <SettingsSection label={translate("settings.sections.language")}>
        <SettingsRow
          title={translate("settings.language.title")}
          description={translate("settings.language.description")}
          action={
            <LanguageSelect
              language={language}
              label={translate("settings.language.title")}
              onSelectLanguage={onSelectLanguage}
            />
          }
        />
      </SettingsSection>

      <SettingsSection label={translate("settings.sections.startup")}>
        <SettingsRow
          title={translate("settings.startup.restoreWorkspace")}
          description={translate("settings.startup.restoreWorkspaceDescription")}
          action={
            <SettingsSwitch
              checked={preferences.restoreWorkspaceOnStartup}
              label={translate("settings.startup.restoreWorkspace")}
              onChange={() =>
                onUpdatePreferences({
                  ...preferences,
                  restoreWorkspaceOnStartup: !preferences.restoreWorkspaceOnStartup
                })
              }
            />
          }
        />
        <SettingsRow
          title={translate("settings.welcome.title")}
          description={translate("settings.welcome.description")}
          action={
            <SettingsButton label={translate("settings.welcome.buttonLabel")} onClick={onResetWelcomeDocument}>
              <RotateCcw aria-hidden="true" size={13} />
              {translate("settings.welcome.button")}
            </SettingsButton>
          }
        />
      </SettingsSection>

      {welcomeReset ? (
        <p className="-mt-6 mb-8 text-[12px] leading-5 text-(--accent)" role="status">
          {translate("settings.welcome.status")}
        </p>
      ) : null}

      {updatesEnabled ? (
        <SettingsSection label={translate("settings.sections.updates")}>
        <SettingsRow
          title={translate("settings.update.currentVersion")}
          description={`Markra ${appVersion}`}
        />
        <SettingsRow
          title={translate("settings.update.autoCheck")}
          description={translate("settings.update.autoCheckDescription")}
          action={
            <SettingsSwitch
              checked={preferences.autoUpdateEnabled}
              label={translate("settings.update.autoCheck")}
              onChange={() =>
                onUpdatePreferences({
                  ...preferences,
                  autoUpdateEnabled: !preferences.autoUpdateEnabled
                })
              }
            />
          }
        />
        <SettingsRow
          title={translate("settings.update.title")}
          description={translate("settings.update.description")}
          action={
            <SettingsButton label={translate("settings.update.check")} onClick={onCheckForUpdates}>
              <RefreshCw aria-hidden="true" size={13} />
              {translate("settings.update.check")}
            </SettingsButton>
          }
        />
        </SettingsSection>
      ) : null}
    </>
  );
}

export function NetworkSettings({
  settings,
  translate,
  onUpdateSettings
}: {
  settings: NetworkSettingsValue;
  translate: Translate;
  onUpdateSettings: (settings: NetworkSettingsValue) => unknown;
}) {
  return (
    <>
      <SettingsSection
        label={translate("settings.sections.networkProxy")}
        intro={
          <SettingsCallout
            icon={Wifi}
            title={translate("settings.network.proxyTitle")}
            description={translate("settings.network.proxyDescription")}
          />
        }
      >
        <SettingsRow
          title={translate("settings.network.proxyEnabled")}
          description={translate("settings.network.proxyEnabledDescription")}
          action={
            <SettingsSwitch
              checked={settings.proxyEnabled}
              label={translate("settings.network.proxyEnabled")}
              onChange={() => onUpdateSettings({ ...settings, proxyEnabled: !settings.proxyEnabled })}
            />
          }
        />
        <SettingsRow
          title={translate("settings.network.proxyUrl")}
          description={translate("settings.network.proxyUrlDescription")}
          action={
            <SettingsTextInput
              label={translate("settings.network.proxyUrl")}
              value={settings.proxyUrl}
              placeholder="socks5://127.0.0.1:1080"
              widthClassName="w-72"
              onChange={(proxyUrl) => onUpdateSettings({ ...settings, proxyUrl })}
            />
          }
        />
        <SettingsRow
          title={translate("settings.network.bypassLocal")}
          description={translate("settings.network.bypassLocalDescription")}
          action={
            <SettingsCheckbox
              checked={settings.bypassLocalAddresses}
              label={translate("settings.network.bypassLocal")}
              onChange={() =>
                onUpdateSettings({
                  ...settings,
                  bypassLocalAddresses: !settings.bypassLocalAddresses
                })
              }
            />
          }
        />
      </SettingsSection>
    </>
  );
}

export function AppearanceSettings({
  customThemeCss,
  onSelectTheme,
  onUpdateCustomThemeCss,
  selectedTheme,
  translate
}: {
  customThemeCss: string;
  onSelectTheme: (theme: AppTheme) => unknown;
  onUpdateCustomThemeCss: (css: string) => unknown;
  selectedTheme: AppTheme;
  translate: Translate;
}) {
  return (
    <SettingsSection label={translate("settings.sections.theme")}>
      <SettingsRow
        title={translate("settings.theme.colorTitle")}
        description={translate("settings.theme.description")}
        action={
          <SettingsSelect
            label={translate("settings.theme.colorTitle")}
            value={selectedTheme}
            options={appThemeOptions.map((theme) => ({
              label: translate(themeLabelKeys[theme]),
              value: theme
            }))}
            onChange={(value) => onSelectTheme(value as AppTheme)}
          />
        }
      />
      <SettingsRow
        title={translate("settings.theme.previewTitle")}
        description={translate("settings.theme.previewDescription")}
        action={
          <ThemePreviewGrid
            selectedTheme={selectedTheme}
            translate={translate}
            onSelectTheme={onSelectTheme}
          />
        }
      />
      {selectedTheme === "custom" ? (
        <SettingsRow
          title={translate("settings.theme.customCssTitle")}
          description={translate("settings.theme.customCssDescription")}
          action={
            <CustomThemeCssControl
              customThemeCss={customThemeCss}
              translate={translate}
              onUpdateCustomThemeCss={onUpdateCustomThemeCss}
            />
          }
        />
      ) : null}
    </SettingsSection>
  );
}

export function StorageSettings({
  onUpdatePreferences,
  preferences,
  s3ImageUploadEnabled = true,
  translate
}: {
  onUpdatePreferences: (preferences: EditorPreferences) => unknown;
  preferences: EditorPreferences;
  s3ImageUploadEnabled?: boolean;
  translate: Translate;
}) {
  const imageUpload = preferences.imageUpload;
  const [settingsProvider, setSettingsProvider] = useState<ImageUploadProvider>(() =>
    availableImageUploadProvider(imageUpload.provider, s3ImageUploadEnabled)
  );
  const activeSettingsProvider = availableImageUploadProvider(settingsProvider, s3ImageUploadEnabled);
  useEffect(() => {
    setSettingsProvider(availableImageUploadProvider(imageUpload.provider, s3ImageUploadEnabled));
  }, [imageUpload.provider, s3ImageUploadEnabled]);

  const updateWebDavImageUpload = (patch: Partial<typeof imageUpload.webdav>) => {
    onUpdatePreferences({
      ...preferences,
      imageUpload: {
        ...imageUpload,
        webdav: {
          ...imageUpload.webdav,
          ...patch
        }
      }
    });
  };
  const updatePicGoImageUpload = (patch: Partial<typeof imageUpload.picgo>) => {
    onUpdatePreferences({
      ...preferences,
      imageUpload: {
        ...imageUpload,
        picgo: {
          ...imageUpload.picgo,
          ...patch
        }
      }
    });
  };
  const updateS3ImageUpload = (patch: Partial<typeof imageUpload.s3>) => {
    onUpdatePreferences({
      ...preferences,
      imageUpload: {
        ...imageUpload,
        s3: {
          ...imageUpload.s3,
          ...patch
        }
      }
    });
  };
  return (
    <SettingsSection label={translate("settings.categories.storage")}>
      <SettingsRow
        title={translate("settings.editor.imageUploadProviderSettings")}
        description={translate("settings.editor.imageUploadProviderStorageHint")}
        action={
          <ImageUploadProviderSettingsControl
            provider={activeSettingsProvider}
            s3ImageUploadEnabled={s3ImageUploadEnabled}
            translate={translate}
            onSelectProvider={setSettingsProvider}
          />
        }
      />
      <SettingsRow
        title={translate("settings.editor.imageUploadFileNamePattern")}
        description={translate("settings.editor.imageUploadFileNamePatternDescription")}
        action={
          <SettingsTextInput
            label={translate("settings.editor.imageUploadFileNamePattern")}
            value={imageUpload.fileNamePattern}
            placeholder="pasted-image-{timestamp}"
            widthClassName="w-64"
            onChange={(fileNamePattern) =>
              onUpdatePreferences({
                ...preferences,
                imageUpload: {
                  ...imageUpload,
                  fileNamePattern
                }
              })
            }
          />
        }
      />
      {activeSettingsProvider === "local" ? (
        <SettingsRow
          title={translate("settings.editor.clipboardImageFolder")}
          description={translate("settings.editor.clipboardImageFolderDescription")}
          action={
            <SettingsTextInput
              label={translate("settings.editor.clipboardImageFolder")}
              value={preferences.clipboardImageFolder}
              placeholder="assets"
              onChange={(value) =>
                onUpdatePreferences({
                  ...preferences,
                  clipboardImageFolder: value
                })
              }
            />
          }
        />
      ) : null}
      {activeSettingsProvider === "webdav" ? (
        <>
          <SettingsRow
            title={translate("settings.editor.webDavServerUrl")}
            description={translate("settings.editor.webDavServerUrlDescription")}
            action={
              <SettingsTextInput
                label={translate("settings.editor.webDavServerUrl")}
                value={imageUpload.webdav.serverUrl}
                placeholder="https://dav.example.com/images"
                widthClassName="w-72"
                onChange={(serverUrl) => updateWebDavImageUpload({ serverUrl })}
              />
            }
          />
          <SettingsRow
            title={translate("settings.editor.webDavUsername")}
            description={translate("settings.editor.webDavUsernameDescription")}
            action={
              <SettingsTextInput
                label={translate("settings.editor.webDavUsername")}
                value={imageUpload.webdav.username}
                widthClassName="w-56"
                onChange={(username) => updateWebDavImageUpload({ username })}
              />
            }
          />
          <SettingsRow
            title={translate("settings.editor.webDavPassword")}
            description={translate("settings.editor.webDavPasswordDescription")}
            action={
              <SettingsTextInput
                label={translate("settings.editor.webDavPassword")}
                value={imageUpload.webdav.password}
                type="password"
                widthClassName="w-56"
                onChange={(password) => updateWebDavImageUpload({ password })}
              />
            }
          />
          <SettingsRow
            title={translate("settings.editor.webDavUploadPath")}
            description={translate("settings.editor.webDavUploadPathDescription")}
            action={
              <SettingsTextInput
                label={translate("settings.editor.webDavUploadPath")}
                value={imageUpload.webdav.uploadPath}
                placeholder="notes"
                widthClassName="w-56"
                onChange={(uploadPath) => updateWebDavImageUpload({ uploadPath })}
              />
            }
          />
          <SettingsRow
            title={translate("settings.editor.webDavPublicBaseUrl")}
            description={translate("settings.editor.webDavPublicBaseUrlDescription")}
            action={
              <SettingsTextInput
                label={translate("settings.editor.webDavPublicBaseUrl")}
                value={imageUpload.webdav.publicBaseUrl}
                placeholder="https://cdn.example.com/images"
                widthClassName="w-72"
                onChange={(publicBaseUrl) => updateWebDavImageUpload({ publicBaseUrl })}
              />
            }
          />
        </>
      ) : null}
      {activeSettingsProvider === "picgo" ? (
        <>
          <SettingsRow
            title={translate("settings.editor.picGoServerUrl")}
            description={translate("settings.editor.picGoServerUrlDescription")}
            action={
              <SettingsTextInput
                label={translate("settings.editor.picGoServerUrl")}
                value={imageUpload.picgo.serverUrl}
                placeholder="http://127.0.0.1:36677/upload"
                widthClassName="w-72"
                onChange={(serverUrl) => updatePicGoImageUpload({ serverUrl })}
              />
            }
          />
          <SettingsRow
            title={translate("settings.editor.picGoSecret")}
            description={translate("settings.editor.picGoSecretDescription")}
            action={
              <SettingsTextInput
                label={translate("settings.editor.picGoSecret")}
                value={imageUpload.picgo.secret}
                type="password"
                widthClassName="w-56"
                onChange={(secret) => updatePicGoImageUpload({ secret })}
              />
            }
          />
        </>
      ) : null}
      {activeSettingsProvider === "s3" ? (
        <>
          <SettingsRow
            title={translate("settings.editor.s3EndpointUrl")}
            description={translate("settings.editor.s3EndpointUrlDescription")}
            action={
              <SettingsTextInput
                label={translate("settings.editor.s3EndpointUrl")}
                value={imageUpload.s3.endpointUrl}
                placeholder="https://s3.example.com"
                widthClassName="w-72"
                onChange={(endpointUrl) => updateS3ImageUpload({ endpointUrl })}
              />
            }
          />
          <SettingsRow
            title={translate("settings.editor.s3Region")}
            description={translate("settings.editor.s3RegionDescription")}
            action={
              <SettingsTextInput
                label={translate("settings.editor.s3Region")}
                value={imageUpload.s3.region}
                placeholder="us-east-1"
                widthClassName="w-44"
                onChange={(region) => updateS3ImageUpload({ region })}
              />
            }
          />
          <SettingsRow
            title={translate("settings.editor.s3Bucket")}
            description={translate("settings.editor.s3BucketDescription")}
            action={
              <SettingsTextInput
                label={translate("settings.editor.s3Bucket")}
                value={imageUpload.s3.bucket}
                placeholder="markra-images"
                widthClassName="w-56"
                onChange={(bucket) => updateS3ImageUpload({ bucket })}
              />
            }
          />
          <SettingsRow
            title={translate("settings.editor.s3AccessKeyId")}
            description={translate("settings.editor.s3AccessKeyIdDescription")}
            action={
              <SettingsTextInput
                label={translate("settings.editor.s3AccessKeyId")}
                value={imageUpload.s3.accessKeyId}
                widthClassName="w-56"
                onChange={(accessKeyId) => updateS3ImageUpload({ accessKeyId })}
              />
            }
          />
          <SettingsRow
            title={translate("settings.editor.s3SecretAccessKey")}
            description={translate("settings.editor.s3SecretAccessKeyDescription")}
            action={
              <SettingsTextInput
                label={translate("settings.editor.s3SecretAccessKey")}
                value={imageUpload.s3.secretAccessKey}
                type="password"
                widthClassName="w-56"
                onChange={(secretAccessKey) => updateS3ImageUpload({ secretAccessKey })}
              />
            }
          />
          <SettingsRow
            title={translate("settings.editor.s3UploadPath")}
            description={translate("settings.editor.s3UploadPathDescription")}
            action={
              <SettingsTextInput
                label={translate("settings.editor.s3UploadPath")}
                value={imageUpload.s3.uploadPath}
                placeholder="notes"
                widthClassName="w-56"
                onChange={(uploadPath) => updateS3ImageUpload({ uploadPath })}
              />
            }
          />
          <SettingsRow
            title={translate("settings.editor.s3PublicBaseUrl")}
            description={translate("settings.editor.s3PublicBaseUrlDescription")}
            action={
              <SettingsTextInput
                label={translate("settings.editor.s3PublicBaseUrl")}
                value={imageUpload.s3.publicBaseUrl}
                placeholder="https://cdn.example.com/images"
                widthClassName="w-72"
                onChange={(publicBaseUrl) => updateS3ImageUpload({ publicBaseUrl })}
              />
            }
          />
        </>
      ) : null}
    </SettingsSection>
  );
}

export function BackupSettings({
  backupRunning = false,
  onChooseTargetPath = () => {},
  onRunBackup = () => {},
  onUpdateSettings = () => {},
  settings = defaultBackupSettings,
  translate
}: {
  backupRunning?: boolean;
  onChooseTargetPath?: () => unknown;
  onRunBackup?: () => unknown;
  onUpdateSettings?: (settings: BackupSettingsValue) => unknown;
  settings?: BackupSettingsValue;
  translate: Translate;
}) {
  const lastBackupLabel = settings.lastBackupAt === null
    ? translate("settings.backup.never")
    : new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(settings.lastBackupAt));

  return (
    <SettingsSection
      label={translate("settings.categories.backup")}
      intro={
        <SettingsCallout
          title={translate("settings.backup.summaryTitle")}
          description={translate("settings.backup.summaryDescription")}
          icon={HardDrive}
        />
      }
    >
      <SettingsRow
        title={translate("settings.backup.targetPath")}
        description={translate("settings.backup.targetPathDescription")}
        action={
          <div className="flex items-center gap-2">
            <SettingsTextInput
              label={translate("settings.backup.targetPath")}
              value={settings.targetPath}
              placeholder="/Users/example/markra-backups"
              widthClassName="w-72"
              onChange={(targetPath) =>
                onUpdateSettings({
                  ...settings,
                  targetPath
                })
              }
            />
            <SettingsButton
              label={translate("settings.backup.targetPickerTitle")}
              onClick={onChooseTargetPath}
            >
              <FolderOpen aria-hidden="true" size={13} />
              {translate("settings.backup.chooseTargetPath")}
            </SettingsButton>
          </div>
        }
      />
      <SettingsRow
        title={translate("settings.backup.backupOnExit")}
        description={translate("settings.backup.backupOnExitDescription")}
        action={
          <SettingsSwitch
            checked={settings.backupOnExit}
            label={translate("settings.backup.backupOnExit")}
            onChange={() =>
              onUpdateSettings({
                ...settings,
                backupOnExit: !settings.backupOnExit
              })
            }
          />
        }
      />
      <SettingsRow
        title={translate("settings.backup.intervalMinutes")}
        description={translate("settings.backup.intervalMinutesDescription")}
        action={
          <SettingsNumberInput
            label={translate("settings.backup.intervalMinutes")}
            min={0}
            max={1440}
            unit={translate("settings.backup.intervalUnit")}
            value={settings.intervalMinutes}
            onChange={(intervalMinutes) =>
              onUpdateSettings({
                ...settings,
                intervalMinutes
              })
            }
          />
        }
      />
      <SettingsRow
        title={translate("settings.backup.lastBackup")}
        description={lastBackupLabel}
        action={
          <SettingsButton
            disabled={backupRunning}
            label={translate("settings.backup.run")}
            onClick={onRunBackup}
          >
            <RefreshCw aria-hidden="true" size={13} />
            {translate("settings.backup.run")}
          </SettingsButton>
        }
      />
    </SettingsSection>
  );
}

export function SyncSettings({
  onRunSync = () => {},
  onUpdateSettings = () => {},
  settings = defaultSyncSettings,
  syncRunning = false,
  translate
}: {
  onRunSync?: () => unknown;
  onUpdateSettings?: (settings: SyncSettingsValue) => unknown;
  settings?: SyncSettingsValue;
  syncRunning?: boolean;
  translate: Translate;
}) {
  const lastSyncLabel = settings.lastSyncAt === null
    ? translate("settings.sync.never")
    : new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(settings.lastSyncAt));

  return (
    <SettingsSection
      label={translate("settings.categories.sync")}
      intro={
        <SettingsCallout
          title={translate("settings.sync.summaryTitle")}
          description={translate("settings.sync.summaryDescription")}
          icon={Cloud}
        />
      }
    >
      <SettingsRow
        title={translate("settings.sync.enabled")}
        description={translate("settings.sync.enabledDescription")}
        action={
          <SettingsSwitch
            checked={settings.enabled}
            label={translate("settings.sync.enabled")}
            onChange={() =>
              onUpdateSettings({
                ...settings,
                enabled: !settings.enabled
              })
            }
          />
        }
      />
      <SettingsRow
        title={translate("settings.sync.provider")}
        description={translate("settings.sync.providerDescription")}
        action={
          <SettingsSelect
            label={translate("settings.sync.provider")}
            options={[{ label: "WebDAV", value: "webdav" }]}
            value={settings.provider}
            onChange={() => onUpdateSettings({ ...settings, provider: "webdav" })}
          />
        }
      />
      <SettingsRow
        title={translate("settings.sync.remotePath")}
        description={translate("settings.sync.remotePathDescription")}
        action={
          <SettingsTextInput
            label={translate("settings.sync.remotePath")}
            value={settings.remotePath}
            placeholder="markra"
            widthClassName="w-56"
            onChange={(remotePath) =>
              onUpdateSettings({
                ...settings,
                remotePath
              })
            }
          />
        }
      />
      <SettingsRow
        title={translate("settings.sync.autoSyncOnSave")}
        description={translate("settings.sync.autoSyncOnSaveDescription")}
        action={
          <SettingsSwitch
            checked={settings.autoSyncOnSave}
            label={translate("settings.sync.autoSyncOnSave")}
            onChange={() =>
              onUpdateSettings({
                ...settings,
                autoSyncOnSave: !settings.autoSyncOnSave
              })
            }
          />
        }
      />
      <SettingsRow
        title={translate("settings.sync.intervalMinutes")}
        description={translate("settings.sync.intervalMinutesDescription")}
        action={
          <SettingsNumberInput
            label={translate("settings.sync.intervalMinutes")}
            min={0}
            max={1440}
            unit={translate("settings.sync.intervalUnit")}
            value={settings.intervalMinutes}
            onChange={(intervalMinutes) =>
              onUpdateSettings({
                ...settings,
                intervalMinutes
              })
            }
          />
        }
      />
      <SettingsRow
        title={translate("settings.sync.lastSync")}
        description={lastSyncLabel}
        action={
          <SettingsButton
            disabled={syncRunning}
            label={translate("settings.sync.run")}
            onClick={onRunSync}
          >
            <RefreshCw aria-hidden="true" size={13} />
            {translate("settings.sync.run")}
          </SettingsButton>
        }
      />
    </SettingsSection>
  );
}

function ShortcutCaptureButton({
  active,
  actionLabel,
  platform,
  shortcut,
  translate,
  onStart
}: {
  active: boolean;
  actionLabel: string;
  platform: DesktopPlatform;
  shortcut: string;
  translate: Translate;
  onStart: () => unknown;
}) {
  return (
    <button
      className={`inline-flex h-8 min-w-28 items-center justify-center rounded-md border px-3 font-mono text-[12px] leading-5 font-[650] transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) ${
        active
          ? "border-(--accent) bg-(--bg-active) text-(--text-heading)"
          : "border-(--border-default) bg-(--bg-primary) text-(--text-heading) hover:bg-(--bg-hover)"
      }`}
      type="button"
      aria-label={`${actionLabel} ${translate("settings.editor.shortcutAriaSuffix")}`}
      aria-pressed={active}
      onClick={onStart}
    >
      {active ? translate("settings.editor.shortcutRecording") : formatShortcutForPlatform(shortcut, platform)}
    </button>
  );
}

export function KeyboardShortcutsSettings({
  aiEnabled = true,
  onUpdatePreferences,
  platform = "macos",
  preferences,
  translate
}: {
  aiEnabled?: boolean;
  onUpdatePreferences: (preferences: EditorPreferences) => unknown;
  platform?: DesktopPlatform;
  preferences: EditorPreferences;
  translate: Translate;
}) {
  const [activeAction, setActiveAction] = useState<MarkdownShortcutAction | null>(null);
  const shortcuts = useMemo(
    () => normalizeMarkdownShortcuts(preferences.markdownShortcuts),
    [preferences.markdownShortcuts]
  );
  const availableShortcutSections = useMemo(
    () => keyboardShortcutSections
      .map((section) => ({
        ...section,
        actions: section.actions.filter((action) => keyboardShortcutActionAvailable(action, aiEnabled))
      }))
      .filter((section) => section.actions.length > 0),
    [aiEnabled]
  );

  useEffect(() => {
    if (activeAction && !keyboardShortcutActionAvailable(activeAction, aiEnabled)) setActiveAction(null);
  }, [activeAction, aiEnabled]);

  useEffect(() => {
    if (!activeAction) return;

    const handleShortcutCapture = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setActiveAction(null);
        return;
      }

      const nextShortcut = markdownShortcutFromKeyboardEvent(event);
      if (!nextShortcut) return;

      event.preventDefault();
      event.stopPropagation();
      onUpdatePreferences({
        ...preferences,
        markdownShortcuts: normalizeMarkdownShortcuts({
          ...shortcuts,
          [activeAction]: nextShortcut
        })
      });
      setActiveAction(null);
    };

    window.addEventListener("keydown", handleShortcutCapture, true);

    return () => {
      window.removeEventListener("keydown", handleShortcutCapture, true);
    };
  }, [activeAction, onUpdatePreferences, preferences, shortcuts]);

  return (
    <SettingsSection label={translate("settings.sections.keyboardShortcuts")}>
      <SettingsRow
        title={translate("settings.editor.shortcuts")}
        description={translate("settings.editor.shortcutsDescription")}
        action={
          <SettingsButton
            label={translate("settings.editor.shortcutsResetLabel")}
            onClick={() => {
              setActiveAction(null);
              onUpdatePreferences({
                ...preferences,
                markdownShortcuts: { ...defaultMarkdownShortcuts }
              });
            }}
          >
            <RotateCcw aria-hidden="true" size={13} />
            {translate("settings.editor.shortcutsReset")}
          </SettingsButton>
        }
      />
      <div className="divide-y divide-(--border-default)">
        {availableShortcutSections.map((section) => (
          <div key={section.labelKey} className="py-4 first:pt-3 last:pb-4">
            <h4 className="m-0 mb-3 text-[12px] leading-5 font-bold tracking-normal text-(--text-secondary)">
              {translate(section.labelKey)}
            </h4>
            <div className="grid grid-cols-2 gap-x-5 gap-y-2 max-[760px]:grid-cols-1">
              {section.actions.map((action) => {
                const actionLabel = translate(markdownShortcutLabelKeys[action]);

                return (
                  <div
                    key={action}
                    className="grid min-h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
                  >
                    <span className="min-w-0 truncate text-[12px] leading-5 font-[560] text-(--text-heading)">
                      {actionLabel}
                    </span>
                    <ShortcutCaptureButton
                      active={activeAction === action}
                      actionLabel={actionLabel}
                      platform={platform}
                      shortcut={shortcuts[action]}
                      translate={translate}
                      onStart={() => setActiveAction(action)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}

function aiPromptInputLabel(actionId: AiQuickActionId, translate: Translate) {
  return `${translate(aiQuickActionLabelKeys[actionId])} ${translate("settings.ai.prompt")}`;
}

function updateAiQuickActionPrompt(
  preferences: EditorPreferences,
  actionId: AiQuickActionId,
  prompt: string
): EditorPreferences {
  return {
    ...preferences,
    aiQuickActionPrompts: {
      ...(preferences.aiQuickActionPrompts ?? defaultAiQuickActionPrompts),
      [actionId]: prompt
    }
  };
}

export function AiSettings({
  language,
  onUpdatePreferences,
  preferences,
  translate
}: {
  language: AppLanguage;
  onUpdatePreferences: (preferences: EditorPreferences) => unknown;
  preferences: EditorPreferences;
  translate: Translate;
}) {
  const quickActionPrompts = preferences.aiQuickActionPrompts ?? defaultAiQuickActionPrompts;
  const translationTargetLanguage = aiTranslationLanguageName(language);

  return (
    <>
      <SettingsSection label={translate("settings.sections.aiAssistance")}>
        <SettingsRow
          title={translate("settings.editor.aiSelectionDisplayMode.command")}
          description={translate("settings.editor.autoOpenAiOnSelectionDescription")}
          action={
            <SettingsSwitch
              checked={preferences.showAiQuickInputOnSelection}
              label={translate("settings.editor.aiSelectionDisplayMode.useCommand")}
              onChange={() =>
                onUpdatePreferences({
                  ...preferences,
                  showAiQuickInputOnSelection: !preferences.showAiQuickInputOnSelection
                })
              }
            />
          }
        />
        <SettingsRow
          title={translate("settings.editor.aiSelectionDisplayMode.toolbar")}
          description={translate("settings.editor.aiSelectionDisplayModeDescription")}
          action={
            <SettingsSwitch
              checked={preferences.showAiSelectionToolbarOnSelection}
              label={translate("settings.editor.aiSelectionDisplayMode.useToolbar")}
              onChange={() =>
                onUpdatePreferences({
                  ...preferences,
                  showAiSelectionToolbarOnSelection: !preferences.showAiSelectionToolbarOnSelection
                })
              }
            />
          }
        />
        <SettingsRow
          title={translate("settings.editor.closeAiCommandOnAgentPanelOpen")}
          description={translate("settings.editor.closeAiCommandOnAgentPanelOpenDescription")}
          action={
            <SettingsSwitch
              checked={preferences.closeAiCommandOnAgentPanelOpen}
              label={translate("settings.editor.closeAiCommandOnAgentPanelOpen")}
              onChange={() =>
                onUpdatePreferences({
                  ...preferences,
                  closeAiCommandOnAgentPanelOpen: !preferences.closeAiCommandOnAgentPanelOpen
                })
              }
            />
          }
        />
        <SettingsRow
          title={translate("settings.editor.suggestAiPanelForComplexInlinePrompts")}
          description={translate("settings.editor.suggestAiPanelForComplexInlinePromptsDescription")}
          action={
            <SettingsSwitch
              checked={preferences.suggestAiPanelForComplexInlinePrompts}
              label={translate("settings.editor.suggestAiPanelForComplexInlinePrompts")}
              onChange={() =>
                onUpdatePreferences({
                  ...preferences,
                  suggestAiPanelForComplexInlinePrompts: !preferences.suggestAiPanelForComplexInlinePrompts
                })
              }
            />
          }
        />
      </SettingsSection>

      <SettingsSection label={translate("settings.sections.aiPrompts")}>
        {aiQuickActionIds.map((actionId) => {
          const actionLabel = translate(aiQuickActionLabelKeys[actionId]);
          const defaultPrompt = defaultAiQuickActionPrompt(actionId, translationTargetLanguage);
          const inputLabel = aiPromptInputLabel(actionId, translate);
          const storedPrompt = quickActionPrompts[actionId];

          return (
            <SettingsRow
              key={actionId}
              title={actionLabel}
              description={translate("settings.ai.promptDescription")}
              action={
                <div className="flex flex-col items-end gap-2 max-[760px]:w-full">
                  <SettingsTextarea
                    label={inputLabel}
                    value={storedPrompt || defaultPrompt}
                    onChange={(prompt) => onUpdatePreferences(updateAiQuickActionPrompt(preferences, actionId, prompt))}
                  />
                  <SettingsButton
                    label={`${translate("settings.ai.promptReset")} ${inputLabel}`}
                    onClick={() =>
                      onUpdatePreferences(updateAiQuickActionPrompt(preferences, actionId, defaultAiQuickActionPrompts[actionId]))
                    }
                  >
                    <RotateCcw aria-hidden="true" size={13} />
                    {translate("settings.ai.promptReset")}
                  </SettingsButton>
                </div>
              }
            />
          );
        })}
      </SettingsSection>
    </>
  );
}

export function EditorSettings({
  aiEnabled = true,
  onUpdatePreferences,
  preferences,
  s3ImageUploadEnabled = true,
  translate
}: {
  aiEnabled?: boolean;
  onUpdatePreferences: (preferences: EditorPreferences) => unknown;
  preferences: EditorPreferences;
  s3ImageUploadEnabled?: boolean;
  translate: Translate;
}) {
  return (
    <>
      <SettingsSection label={translate("settings.sections.editing")}>
        <SettingsRow
          title={translate("settings.editor.bodyFontSize")}
          description={translate("settings.editor.bodyFontSizeDescription")}
          action={
            <SettingsSelect
              label={translate("settings.editor.bodyFontSize")}
              value={String(preferences.bodyFontSize)}
              options={bodyFontSizeOptions.map((size) => ({ label: `${size}px`, value: String(size) }))}
              onChange={(value) =>
                onUpdatePreferences({
                  ...preferences,
                  bodyFontSize: Number(value)
                })
              }
            />
          }
        />
        <SettingsRow
          title={translate("settings.editor.lineHeight")}
          description={translate("settings.editor.lineHeightDescription")}
          action={
            <SettingsSelect
              label={translate("settings.editor.lineHeight")}
              value={String(preferences.lineHeight)}
              options={lineHeightOptions.map((height) => ({ label: String(height), value: String(height) }))}
              onChange={(value) =>
                onUpdatePreferences({
                  ...preferences,
                  lineHeight: Number(value)
                })
              }
            />
          }
        />
        <SettingsRow
          title={translate("settings.editor.contentWidth")}
          description={translate("settings.editor.contentWidthDescription")}
          action={
            <SettingsContentWidthInput
              label={translate("settings.editor.contentWidth")}
              preferences={preferences}
              resetLabel={`${translate("settings.editor.contentWidth")} ${translate("settings.editor.shortcutsReset")}`}
              onUpdatePreferences={onUpdatePreferences}
            />
          }
        />
        <StorageTypeControlRow
          preferences={preferences}
          s3ImageUploadEnabled={s3ImageUploadEnabled}
          translate={translate}
          onUpdatePreferences={onUpdatePreferences}
        />
        <SettingsRow
          title={translate("settings.editor.titlebarActions")}
          description={translate("settings.editor.titlebarActionsDescription")}
          action={
            <SettingsTitlebarActionsControl
              aiEnabled={aiEnabled}
              preferences={preferences}
              translate={translate}
              onUpdatePreferences={onUpdatePreferences}
            />
          }
        />
        <SettingsRow
          title={translate("settings.editor.showDocumentTabs")}
          description={translate("settings.editor.showDocumentTabsDescription")}
          action={
            <SettingsSwitch
              checked={preferences.showDocumentTabs}
              label={translate("settings.editor.showDocumentTabs")}
              onChange={() =>
                onUpdatePreferences({
                  ...preferences,
                  showDocumentTabs: !preferences.showDocumentTabs
                })
              }
            />
          }
        />
        <SettingsRow
          title={translate("settings.editor.sidebarLayoutMode")}
          description={translate("settings.editor.sidebarLayoutModeDescription")}
          action={
            <SidebarLayoutModeControl
              preferences={preferences}
              translate={translate}
              onUpdatePreferences={onUpdatePreferences}
            />
          }
        />
        <SettingsRow
          title={translate("settings.editor.showWordCount")}
          description={translate("settings.editor.showWordCountDescription")}
          action={
            <SettingsSwitch
              checked={preferences.showWordCount}
              label={translate("settings.editor.showWordCount")}
              onChange={() =>
                onUpdatePreferences({
                  ...preferences,
                  showWordCount: !preferences.showWordCount
                })
              }
            />
          }
        />
        <SettingsRow
          title={translate("settings.editor.wrapCodeBlocks")}
          description={translate("settings.editor.wrapCodeBlocksDescription")}
          action={
            <SettingsSwitch
              checked={preferences.wrapCodeBlocks}
              label={translate("settings.editor.wrapCodeBlocks")}
              onChange={() =>
                onUpdatePreferences({
                  ...preferences,
                  wrapCodeBlocks: !preferences.wrapCodeBlocks
                })
              }
            />
          }
        />
      </SettingsSection>
      <SettingsSection label={translate("settings.sections.extendedSyntax")}>
        <SettingsRow
          title={translate("settings.editor.highlightSyntax")}
          description={translate("settings.editor.highlightSyntaxDescription")}
          action={
            <SettingsSwitch
              checked={preferences.extendedSyntax.highlight}
              label={translate("settings.editor.highlightSyntax")}
              onChange={() =>
                onUpdatePreferences({
                  ...preferences,
                  extendedSyntax: {
                    ...preferences.extendedSyntax,
                    highlight: !preferences.extendedSyntax.highlight
                  }
                })
              }
            />
          }
        />
        <SettingsRow
          title={translate("settings.editor.githubAlerts")}
          description={translate("settings.editor.githubAlertsDescription")}
          action={
            <SettingsSwitch
              checked={preferences.extendedSyntax.githubAlerts}
              label={translate("settings.editor.githubAlerts")}
              onChange={() =>
                onUpdatePreferences({
                  ...preferences,
                  extendedSyntax: {
                    ...preferences.extendedSyntax,
                    githubAlerts: !preferences.extendedSyntax.githubAlerts
                  }
                })
              }
            />
          }
        />
      </SettingsSection>
    </>
  );
}

export function ExportSettings({
  focusTarget = null,
  onDetectPandocPath,
  onFocusTargetHandled,
  onUpdateSettings,
  pandocEnabled = true,
  settings,
  translate
}: {
  focusTarget?: "pandocPath" | null;
  onDetectPandocPath?: () => unknown;
  onFocusTargetHandled?: () => unknown;
  onUpdateSettings: (settings: ExportSettingsValue) => unknown;
  pandocEnabled?: boolean;
  settings: ExportSettingsValue;
  translate: Translate;
}) {
  const pandocPathTargetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusTarget !== "pandocPath" || !pandocEnabled) return;

    const focusFrame = window.requestAnimationFrame(() => {
      const target = pandocPathTargetRef.current;
      target?.scrollIntoView?.({ block: "center" });
      target?.querySelector<HTMLInputElement>("input")?.focus();
      onFocusTargetHandled?.();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
    };
  }, [focusTarget, onFocusTargetHandled, pandocEnabled]);

  return (
    <>
      <SettingsSection label={translate("settings.sections.pdfExport")}>
        <SettingsRow
          title={translate("settings.export.pageSize")}
          description={translate("settings.export.pageSizeDescription")}
          action={
            <SettingsSelect
              label={translate("settings.export.pageSize")}
              value={settings.pdfPageSize}
              options={exportPageSizeOptions.map((pageSize) => ({
                label: translate(exportPageSizeLabelKey(pageSize)),
                value: pageSize
              }))}
              onChange={(value) => onUpdateSettings(applyExportPageSize(settings, value as PdfPageSize))}
            />
          }
        />
        <SettingsRow
          title={translate("settings.export.pageMargin")}
          description={translate("settings.export.pageMarginDescription")}
          action={
            <SettingsSelect
              label={translate("settings.export.pageMargin")}
              value={settings.pdfMarginPreset}
              options={exportMarginPresetOptions.map((preset) => ({
                label: translate(exportMarginPresetLabelKey(preset)),
                value: preset
              }))}
              onChange={(value) => onUpdateSettings(applyExportMarginPreset(settings, value as PdfMarginPreset))}
            />
          }
        />
        {settings.pdfMarginPreset === "custom" ? (
          <SettingsRow
            title={translate("settings.export.pdfMargin")}
            description={translate("settings.export.pdfMarginDescription")}
            action={
              <SettingsNumberInput
                label={translate("settings.export.pdfMargin")}
                min={0}
                max={60}
                unit={translate("settings.export.pdfMarginUnit")}
                value={settings.pdfMarginMm}
                onChange={(value) =>
                  onUpdateSettings({
                    ...settings,
                    pdfMarginMm: value,
                    pdfMarginPreset: "custom"
                  })
                }
              />
            }
          />
        ) : null}
        <SettingsRow
          title={translate("settings.export.pageDimensions")}
          description={translate("settings.export.pageDimensionsDescription")}
          action={
            <div className="inline-flex items-center gap-2">
              <SettingsNumberInput
                label={translate("settings.export.pageWidth")}
                min={50}
                max={2000}
                unit={translate("settings.export.pdfMarginUnit")}
                value={settings.pdfWidthMm}
                onChange={(value) =>
                  onUpdateSettings({
                    ...settings,
                    pdfPageSize: "custom",
                    pdfWidthMm: value
                  })
                }
              />
              <span className="text-[12px] leading-5 font-[560] text-(--text-secondary)" aria-hidden="true">x</span>
              <SettingsNumberInput
                label={translate("settings.export.pageHeight")}
                min={50}
                max={2000}
                unit={translate("settings.export.pdfMarginUnit")}
                value={settings.pdfHeightMm}
                onChange={(value) =>
                  onUpdateSettings({
                    ...settings,
                    pdfHeightMm: value,
                    pdfPageSize: "custom"
                  })
                }
              />
            </div>
          }
        />
        <SettingsRow
          title={translate("settings.export.pageBreakOnH1")}
          description={translate("settings.export.pageBreakOnH1Description")}
          action={
            <SettingsCheckbox
              checked={settings.pdfPageBreakOnH1}
              label={translate("settings.export.pageBreakOnH1")}
              onChange={() =>
                onUpdateSettings({
                  ...settings,
                  pdfPageBreakOnH1: !settings.pdfPageBreakOnH1
                })
              }
            />
          }
        />
      </SettingsSection>

      <SettingsSection label={translate("settings.sections.pdfMetadata")}>
        <SettingsRow
          title={translate("settings.export.header")}
          description={translate("settings.export.headerDescription")}
          action={
            <SettingsTextInput
              label={translate("settings.export.header")}
              value={settings.pdfHeader}
              widthClassName="w-64"
              onChange={(value) =>
                onUpdateSettings({
                  ...settings,
                  pdfHeader: value
                })
              }
            />
          }
        />
        <SettingsRow
          title={translate("settings.export.footer")}
          description={translate("settings.export.footerDescription")}
          action={
            <SettingsTextInput
              label={translate("settings.export.footer")}
              value={settings.pdfFooter}
              widthClassName="w-64"
              onChange={(value) =>
                onUpdateSettings({
                  ...settings,
                  pdfFooter: value
                })
              }
            />
          }
        />
        <SettingsRow
          title={translate("settings.export.author")}
          description={translate("settings.export.authorDescription")}
          action={
            <SettingsTextInput
              label={translate("settings.export.author")}
              value={settings.pdfAuthor}
              widthClassName="w-64"
              onChange={(value) =>
                onUpdateSettings({
                  ...settings,
                  pdfAuthor: value
                })
              }
            />
          }
        />
      </SettingsSection>

      {pandocEnabled ? (
        <SettingsSection label={translate("settings.sections.pandocExport")}>
          <div ref={pandocPathTargetRef} data-settings-target="pandocPath">
            <SettingsRow
              title={translate("settings.export.pandocPath")}
              description={translate("settings.export.pandocPathDescription")}
              action={
                <div className="inline-flex items-center gap-2 max-[760px]:w-full max-[760px]:flex-wrap">
                  <SettingsTextInput
                    label={translate("settings.export.pandocPath")}
                    value={settings.pandocPath}
                    widthClassName="w-80 max-[760px]:w-full"
                    onChange={(value) =>
                      onUpdateSettings({
                        ...settings,
                        pandocPath: value
                      })
                    }
                  />
                  <SettingsButton
                    label={translate("settings.export.detectPandocPath")}
                    onClick={() => onDetectPandocPath?.()}
                  >
                    <RefreshCw aria-hidden="true" size={13} />
                    <span>{translate("settings.export.detectPandocPath")}</span>
                  </SettingsButton>
                </div>
              }
            />
          </div>
          <SettingsRow
            title={translate("settings.export.pandocArgs")}
            description={translate("settings.export.pandocArgsDescription")}
            action={
              <SettingsTextarea
                label={translate("settings.export.pandocArgs")}
                value={settings.pandocArgs}
                widthClassName="w-80"
                spellCheck={false}
                onChange={(value) =>
                  onUpdateSettings({
                    ...settings,
                    pandocArgs: value
                  })
                }
              />
            }
          />
        </SettingsSection>
      ) : null}
    </>
  );
}

export function WebSearchSettings({
  onUpdateSettings,
  settings,
  translate
}: {
  onUpdateSettings: (settings: WebSearchSettings) => unknown;
  settings: WebSearchSettings;
  translate: Translate;
}) {
  return (
    <>
      <SettingsSection label={translate("settings.sections.webSearch")}>
        <SettingsRow
          title={translate("settings.webSearch.enable")}
          description={translate("settings.webSearch.enableDescription")}
          action={
            <SettingsSwitch
              checked={settings.enabled}
              label={translate("settings.webSearch.enable")}
              onChange={() =>
                onUpdateSettings({
                  ...settings,
                  enabled: !settings.enabled
                })
              }
            />
          }
        />
        <SettingsRow
          title={translate("settings.webSearch.provider")}
          description={translate("settings.webSearch.providerDescription")}
          action={
            <SettingsSelect
              label={translate("settings.webSearch.provider")}
              value={settings.providerId}
              options={webSearchProviderOptions.map((providerId) => ({
                label: translate(providerId === "local-bing" ? "settings.webSearch.provider.localBing" : "settings.webSearch.provider.searxng"),
                value: providerId
              }))}
              onChange={(value) =>
                onUpdateSettings({
                  ...settings,
                  providerId: value === "searxng" ? "searxng" : "local-bing"
                })
              }
            />
          }
        />
        {settings.providerId === "searxng" ? (
          <SettingsRow
            title={translate("settings.webSearch.searxngApiHost")}
            description={translate("settings.webSearch.searxngApiHostDescription")}
            action={
              <SettingsTextInput
                label={translate("settings.webSearch.searxngApiHost")}
                value={settings.searxngApiHost}
                placeholder="http://localhost:8888"
                onChange={(value) =>
                  onUpdateSettings({
                    ...settings,
                    searxngApiHost: value
                  })
                }
              />
            }
          />
        ) : null}
      </SettingsSection>

      <SettingsSection label={translate("settings.sections.webSearchLimits")}>
        <SettingsRow
          title={translate("settings.webSearch.maxResults")}
          description={translate("settings.webSearch.maxResultsDescription")}
          action={
            <SettingsTextInput
              label={translate("settings.webSearch.maxResults")}
              value={String(settings.maxResults)}
              onChange={(value) =>
                onUpdateSettings({
                  ...settings,
                  maxResults: Number(value)
                })
              }
            />
          }
        />
        <SettingsRow
          title={translate("settings.webSearch.contentMaxChars")}
          description={translate("settings.webSearch.contentMaxCharsDescription")}
          action={
            <SettingsTextInput
              label={translate("settings.webSearch.contentMaxChars")}
              value={String(settings.contentMaxChars)}
              onChange={(value) =>
                onUpdateSettings({
                  ...settings,
                  contentMaxChars: Number(value)
                })
              }
            />
          }
        />
      </SettingsSection>
    </>
  );
}
