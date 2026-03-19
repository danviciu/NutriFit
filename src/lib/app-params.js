export const STORAGE_KEYS = {
  userProfile: "app:userProfile",
  lastPlan: "app:lastPlan",
};

export const APP_NAME = "NutriFit AI v2";

const DEFAULT_LOCAL_API_URL = "http://localhost:8787";
const MODE = String(import.meta.env.MODE || "development").toLowerCase();
const APP_ENV = String(import.meta.env.VITE_APP_ENV || MODE).toLowerCase();

function normalizeUrl(url) {
  return String(url || "")
    .trim()
    .replace(/\/+$/, "");
}

function isNativePlatform() {
  if (typeof window === "undefined") return false;
  const capacitor = window.Capacitor;
  if (!capacitor) return false;
  if (typeof capacitor.isNativePlatform === "function") {
    return Boolean(capacitor.isNativePlatform());
  }
  return true;
}

function isAndroidRuntime() {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent || "");
}

function resolveConfiguredUrlByEnv() {
  const generic = normalizeUrl(import.meta.env.VITE_API_URL || "");

  const byEnv = {
    development: normalizeUrl(
      import.meta.env.VITE_API_URL_DEV ||
      import.meta.env.VITE_BASE44_API_URL ||
      DEFAULT_LOCAL_API_URL,
    ),
    staging: normalizeUrl(
      import.meta.env.VITE_API_URL_STAGING ||
      import.meta.env.VITE_BASE44_API_URL_STAGING ||
      generic,
    ),
    production: normalizeUrl(
      import.meta.env.VITE_API_URL_PROD ||
      import.meta.env.VITE_BASE44_API_URL_PROD ||
      generic,
    ),
  };

  const configured = byEnv[APP_ENV] || byEnv[MODE] || "";
  if (configured) return configured;

  // In production/staging, missing env means "same-origin API" (no localhost leak).
  if (APP_ENV === "production" || APP_ENV === "staging" || MODE === "production" || MODE === "staging") {
    return "";
  }

  // Development keeps localhost fallback.
  return DEFAULT_LOCAL_API_URL;
}

function resolveApiBaseUrl() {
  const configured = resolveConfiguredUrlByEnv();
  if (!configured) return "";

  // Explicit override for Android native builds (emulator/device).
  const nativeAndroidOverride = normalizeUrl(
    import.meta.env.VITE_API_URL_ANDROID || import.meta.env.VITE_BASE44_API_URL_ANDROID || "",
  );
  if (isNativePlatform() && isAndroidRuntime() && nativeAndroidOverride) {
    return nativeAndroidOverride;
  }

  // Android emulator cannot reach host localhost directly.
  if (isNativePlatform() && isAndroidRuntime()) {
    try {
      const parsed = new URL(configured);
      if (["localhost", "127.0.0.1", "0.0.0.0"].includes(parsed.hostname)) {
        parsed.hostname = "10.0.2.2";
      }
      return normalizeUrl(parsed.toString());
    } catch {
      return configured;
    }
  }

  return configured;
}

export const API_BASE_URL = resolveApiBaseUrl();

export const WIZARD_STEPS = [
  "Profil Fizic",
  "Obiective",
  "Preferinte",
  "Analize",
];

