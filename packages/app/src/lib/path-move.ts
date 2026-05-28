export function normalizeMovedPath(path: string) {
  return path.replace(/\\/gu, "/").replace(/\/+$/u, "");
}

function nativePathSeparator(path: string) {
  return path.includes("\\") && !path.includes("/") ? "\\" : "/";
}

export function replaceMovedPath(path: string, previousPath: string, nextPath: string) {
  const normalizedPath = normalizeMovedPath(path);
  const normalizedPreviousPath = normalizeMovedPath(previousPath);

  if (normalizedPath === normalizedPreviousPath) return nextPath;
  if (!normalizedPath.startsWith(`${normalizedPreviousPath}/`)) return path;

  const separator = nativePathSeparator(nextPath);
  const suffix = normalizedPath.slice(normalizedPreviousPath.length + 1).split("/").join(separator);
  return `${nextPath.replace(/[\\/]+$/u, "")}${separator}${suffix}`;
}
