import { API_BASE_URL } from "@/lib/app-params";
import { supabase } from "@/lib/supabase";

let runtimeApiBaseUrl = API_BASE_URL;

function isAndroidRuntime() {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent || "");
}

function buildApiBaseCandidates(baseUrl) {
  const normalized = String(baseUrl || "").replace(/\/+$/, "");
  const candidates = [normalized];

  if (!isAndroidRuntime()) return candidates;

  try {
    const parsed = new URL(normalized);
    const portSuffix = parsed.port ? `:${parsed.port}` : "";
    const protocol = parsed.protocol || "http:";

    if (parsed.hostname === "10.0.2.2") {
      candidates.push(`${protocol}//localhost${portSuffix}`);
      candidates.push(`${protocol}//127.0.0.1${portSuffix}`);
    } else if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      candidates.push(`${protocol}//10.0.2.2${portSuffix}`);
    }
  } catch {
    // Keep the original URL only.
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

async function getFreshToken(fallbackToken = null) {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || fallbackToken || null;
}

async function doFetch(path, token, options = {}) {
  const candidates = buildApiBaseCandidates(runtimeApiBaseUrl);
  const errors = [];

  for (const base of candidates) {
    const url = `${base}${path}`;
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      runtimeApiBaseUrl = base;
      return response;
    } catch (error) {
      errors.push(`${base}: ${error?.message || "network_error"}`);
    }
  }

  throw new Error(`Nu s-a putut contacta API-ul (${runtimeApiBaseUrl}). Detalii: ${errors.join(" | ")}`);
}

async function request(path, token, options = {}) {
  let authToken = await getFreshToken(token);
  let response = await doFetch(path, authToken, options);

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.status === 401) {
    authToken = await getFreshToken(null);
    if (authToken && authToken !== token) {
      response = await doFetch(path, authToken, options);
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
    }
  }

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed: ${response.status}`);
  }

  return payload;
}

export function getProfile(token) {
  return request("/me/profile", token);
}

export function upsertProfile(token, profile) {
  return request("/me/profile", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
}

export function uploadLabs(token, file) {
  const formData = new FormData();
  formData.append("file", file);

  return request("/upload-labs", token, {
    method: "POST",
    body: formData,
  });
}

export function generatePlan(token) {
  return request("/generate-plan", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export function getPlans(token) {
  return request("/me/plans", token);
}

export function getPlanById(token, id) {
  return request(`/me/plans/${id}`, token);
}

export function getLatestLabs(token) {
  return request("/me/labs/latest", token);
}

export function logUserEvent(token, payload) {
  return request("/me/events", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
}

export function getProgressSummary(token, days = 30) {
  const safeDays = Number.isFinite(Number(days)) ? Number(days) : 30;
  return request(`/me/progress/summary?days=${encodeURIComponent(safeDays)}`, token);
}

export function upsertDailyCheckin(token, payload) {
  return request("/me/checkins", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
}

export function getDailyCheckins(token, days = 30) {
  const safeDays = Number.isFinite(Number(days)) ? Number(days) : 30;
  return request(`/me/checkins?days=${encodeURIComponent(safeDays)}`, token);
}

export function getContentItems({ limit = 20, topic = "", search = "" } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (topic) params.set("topic", topic);
  if (search) params.set("search", search);
  const query = params.toString();
  return request(`/content${query ? `?${query}` : ""}`, null);
}

export function getRecommendedContent(token, { limit = 12 } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  const query = params.toString();
  return request(`/me/content/recommended${query ? `?${query}` : ""}`, token);
}

export function getContentBookmarks(token) {
  return request("/me/content/bookmarks", token);
}

export function addContentBookmark(token, slug) {
  return request(`/me/content/bookmarks/${encodeURIComponent(slug)}`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export function removeContentBookmark(token, slug) {
  return request(`/me/content/bookmarks/${encodeURIComponent(slug)}`, token, {
    method: "DELETE",
  });
}

export function getReminders(token) {
  return request("/me/reminders", token);
}

export function dismissReminder(token, key) {
  return request(`/me/reminders/${encodeURIComponent(key)}/dismiss`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export function getNotifications(token, { status = "unread", limit = 40 } = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (limit) params.set("limit", String(limit));
  const query = params.toString();
  return request(`/me/notifications${query ? `?${query}` : ""}`, token);
}

export function getNotificationStats(token) {
  return request("/me/notifications/stats", token);
}

export function markNotificationRead(token, notificationId) {
  return request(`/me/notifications/${encodeURIComponent(notificationId)}/read`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export function dismissNotification(token, notificationId) {
  return request(`/me/notifications/${encodeURIComponent(notificationId)}/dismiss`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export function markAllNotificationsRead(token) {
  return request("/me/notifications/mark-all-read", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export function getNotificationPreferences(token) {
  return request("/me/notifications/preferences", token);
}

export function upsertNotificationPreferences(token, payload) {
  return request("/me/notifications/preferences", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
}

export function dispatchNotifications(token) {
  return request("/me/notifications/dispatch", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export function getContentTopics() {
  return request("/content/topics", null);
}

export function getContentBySlug(slug) {
  return request(`/content/${encodeURIComponent(slug)}`, null);
}

export function refreshContent(token, force = false) {
  return request("/content/refresh", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force }),
  });
}

