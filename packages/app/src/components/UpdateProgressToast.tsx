type UpdateProgressToastProps = {
  message: string;
  progress: number | null;
};

function normalizeProgress(progress: number | null) {
  if (progress === null) return null;

  return Math.max(0, Math.min(100, progress));
}

export function UpdateProgressToast({ message, progress }: UpdateProgressToastProps) {
  const normalizedProgress = normalizeProgress(progress);

  return (
    <div className="app-update-progress-toast flex w-60 max-w-full flex-col gap-1.5 whitespace-normal">
      <span className="truncate">{message}</span>
      <div
        aria-label={message}
        aria-valuemax={100}
        aria-valuemin={0}
        {...(normalizedProgress === null ? {} : { "aria-valuenow": normalizedProgress })}
        className="app-update-progress-bar h-1.5 w-full overflow-hidden rounded-full bg-(--bg-secondary)"
        role="progressbar"
      >
        <div
          className={`app-update-progress-bar-value h-full rounded-full bg-(--accent) transition-[width] duration-200 ease-out ${
            normalizedProgress === null ? "w-1/3 animate-pulse" : ""
          }`}
          style={normalizedProgress === null ? undefined : { width: `${normalizedProgress}%` }}
        />
      </div>
    </div>
  );
}
