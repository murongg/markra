import { t, type AppLanguage } from "@markra/shared";

type QuietStatusProps = {
  dirty: boolean;
  language?: AppLanguage;
  readOnly?: boolean;
  showWordCount?: boolean;
  wordCount: number;
};

export function QuietStatus({ dirty, language = "en", readOnly = false, showWordCount = true, wordCount }: QuietStatusProps) {
  const label = (key: Parameters<typeof t>[1]) => t(language, key);

  return (
    <footer
      className="quiet-status pointer-events-none absolute right-4.5 bottom-3 flex justify-end gap-2.5 text-[12px] leading-5 text-(--text-secondary) opacity-[0.68]"
      aria-label={label("app.documentStatus")}
    >
      {showWordCount ? (
        <span>
          {wordCount} {label("app.words")}
        </span>
      ) : null}
      {readOnly ? <span>{label("app.readOnly")}</span> : null}
      <span>{dirty ? label("app.unsaved") : label("app.saved")}</span>
    </footer>
  );
}
