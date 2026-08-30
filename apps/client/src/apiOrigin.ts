const DEVELOPMENT_API_URL = 'http://localhost:8787';
const ANDROID_EMULATOR_API_URL = 'http://10.0.2.2:8787';

interface ApiRuntime {
  location?: { origin?: string };
  localStorage?: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
  };
  platinumDesktop?: { isDesktop?: boolean };
}

function trustedDesktopOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]';
    return loopback && (url.protocol === 'http:' || url.protocol === 'https:') ? url.origin : null;
  } catch {
    return null;
  }
}

export function desktopApiOrigin(platform: string, runtime?: ApiRuntime) {
  if (platform !== 'web' || runtime?.platinumDesktop?.isDesktop !== true) return null;
  return trustedDesktopOrigin(runtime.location?.origin);
}

export function resolveApiUrl(platform: string, storedApiUrl?: string | null, runtime?: ApiRuntime) {
  const origin = desktopApiOrigin(platform, runtime);
  if (origin) return origin;
  const stored = storedApiUrl?.trim().replace(/\/$/, '');
  if (stored) return stored;
  return platform === 'android' ? ANDROID_EMULATOR_API_URL : DEVELOPMENT_API_URL;
}

export function loadWebApiUrl(storageKey: string, runtime?: ApiRuntime) {
  return resolveApiUrl('web', runtime?.localStorage?.getItem(storageKey), runtime);
}

export function saveWebApiUrl(storageKey: string, value: string, runtime?: ApiRuntime) {
  const origin = desktopApiOrigin('web', runtime);
  if (origin) return origin;
  const clean = value.trim().replace(/\/$/, '');
  runtime?.localStorage?.setItem(storageKey, clean);
  return clean;
}
