import { t, type AppLanguage } from "@markra/shared";

type ImagePreviewProps = {
  alt: string;
  language?: AppLanguage;
  src: string;
};

export function ImagePreview({ alt, language = "en", src }: ImagePreviewProps) {
  return (
    <section
      className="image-preview flex h-full min-h-0 items-center justify-center overflow-auto bg-(--bg-primary) px-8 py-14"
      aria-label={t(language, "app.imagePreview")}
    >
      <img
        className="max-h-full max-w-full select-none object-contain"
        alt={alt}
        draggable={false}
        src={src}
      />
    </section>
  );
}
