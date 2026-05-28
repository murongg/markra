import type { ReactNode } from "react";
import { toast, type ExternalToast } from "sonner";

export type AppToastStatus = "error" | "loading" | "success";
export type AppToastAction = ExternalToast["action"];

export const defaultAppToastId = "app-toast";

export function showAppToast({
  action,
  duration,
  id = defaultAppToastId,
  message,
  status
}: {
  action?: AppToastAction;
  duration?: ExternalToast["duration"];
  id?: string;
  message: ReactNode;
  status: AppToastStatus;
}) {
  const options: ExternalToast = {
    ...(action ? { action } : {}),
    duration: duration ?? (status === "success" ? 4500 : Infinity),
    id
  };

  if (status === "error") {
    toast.error(message, options);
    return;
  }

  if (status === "loading") {
    toast.loading(message, options);
    return;
  }

  toast.success(message, options);
}

export function dismissAppToast(id = defaultAppToastId) {
  toast.dismiss(id);
}
