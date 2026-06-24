import { getStoredNetworkSettings, type NetworkSettings } from "@markra/app/settings";

export type NativeNetworkSettings = NetworkSettings;

export async function networkSettingsForNativeRequest(): Promise<NativeNetworkSettings | undefined> {
  try {
    const settings = await getStoredNetworkSettings();
    if (!settings.proxyEnabled || !settings.proxyUrl.trim()) return undefined;

    return settings;
  } catch {
    return undefined;
  }
}
