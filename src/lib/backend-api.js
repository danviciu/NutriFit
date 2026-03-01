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

function errorLikelyConnectivity(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("nu s-a putut contacta api-ul") ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network error")
  );
}

const CONTENT_SELECT =
  "id, slug, title, summary, body_markdown, topic, source_name, source_url, published_at, updated_at, read_time_min, tags, status";

function mapContentRow(row) {
  return {
    id: row?.id,
    slug: row?.slug,
    title: row?.title || "",
    summary: row?.summary || "",
    body_markdown: row?.body_markdown || "",
    topic: row?.topic || "nutrition",
    source_name: row?.source_name || "",
    source_url: row?.source_url || "",
    published_at: row?.published_at || "",
    updated_at: row?.updated_at || "",
    read_time_min: row?.read_time_min || 1,
    tags: Array.isArray(row?.tags) ? row.tags : [],
  };
}

function contentMatchesSearch(row, search) {
  const needle = String(search || "").trim().toLowerCase();
  if (!needle) return true;
  const text = `${row?.title || ""} ${row?.summary || ""} ${(row?.tags || []).join(" ")}`.toLowerCase();
  return text.includes(needle);
}

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const userId = data?.user?.id;
  if (!userId) throw new Error("User not authenticated");
  return userId;
}

async function getContentItemsFromSupabase({ limit = 20, topic = "", search = "" } = {}) {
  let query = supabase
    .from("content_items")
    .select(CONTENT_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(Number(limit) || 20);

  if (topic) query = query.eq("topic", topic);

  const { data, error } = await query;
  if (error) throw error;

  const items = (data || []).map(mapContentRow).filter((row) => contentMatchesSearch(row, search));
  return { items };
}

async function getContentTopicsFromSupabase() {
  const { data, error } = await supabase
    .from("content_items")
    .select("topic")
    .eq("status", "published")
    .order("topic", { ascending: true });

  if (error) throw error;
  const topics = Array.from(new Set((data || []).map((row) => row.topic).filter(Boolean)));
  return { topics };
}

async function getContentBySlugFromSupabase(slug) {
  const { data, error } = await supabase
    .from("content_items")
    .select(CONTENT_SELECT)
    .eq("slug", String(slug || ""))
    .eq("status", "published")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Content not found");
  return { item: mapContentRow(data) };
}

async function getBookmarksFromSupabase() {
  const userId = await getCurrentUserId();
  const { data: bookmarkRows, error: bookmarkError } = await supabase
    .from("content_bookmarks")
    .select("content_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (bookmarkError) throw bookmarkError;

  const contentIds = (bookmarkRows || []).map((row) => row.content_id).filter(Boolean);
  if (!contentIds.length) return { bookmarks: [] };

  const { data: contentRows, error: contentError } = await supabase
    .from("content_items")
    .select(CONTENT_SELECT)
    .in("id", contentIds)
    .eq("status", "published");

  if (contentError) throw contentError;
  const byId = new Map((contentRows || []).map((row) => [row.id, row]));

  const bookmarks = (bookmarkRows || [])
    .map((entry) => {
      const item = byId.get(entry.content_id);
      if (!item) return null;
      return {
        ...mapContentRow(item),
        bookmarked_at: entry.created_at,
      };
    })
    .filter(Boolean);

  return { bookmarks };
}

async function addBookmarkFromSupabase(slug) {
  const userId = await getCurrentUserId();
  const { data: item, error: itemError } = await supabase
    .from("content_items")
    .select("id, slug")
    .eq("slug", String(slug || ""))
    .eq("status", "published")
    .maybeSingle();

  if (itemError) throw itemError;
  if (!item?.id) throw new Error("Content not found");

  const { error } = await supabase.from("content_bookmarks").upsert(
    {
      user_id: userId,
      content_id: item.id,
    },
    { onConflict: "user_id,content_id" },
  );
  if (error) throw error;
  return { ok: true, bookmark: { slug: item.slug } };
}

async function removeBookmarkFromSupabase(slug) {
  const userId = await getCurrentUserId();
  const { data: item, error: itemError } = await supabase
    .from("content_items")
    .select("id, slug")
    .eq("slug", String(slug || ""))
    .eq("status", "published")
    .maybeSingle();

  if (itemError) throw itemError;
  if (!item?.id) return { ok: true };

  const { error } = await supabase
    .from("content_bookmarks")
    .delete()
    .eq("user_id", userId)
    .eq("content_id", item.id);

  if (error) throw error;
  return { ok: true };
}

async function getRecommendedContentFromSupabase({ limit = 12 } = {}) {
  const safeLimit = Number(limit) || 12;
  const [contentResp, bookmarksResp] = await Promise.all([
    getContentItemsFromSupabase({ limit: Math.max(safeLimit * 3, 30) }),
    getBookmarksFromSupabase().catch(() => ({ bookmarks: [] })),
  ]);

  const items = contentResp.items || [];
  const bookmarkTopicBoost = {};
  (bookmarksResp.bookmarks || []).forEach((item) => {
    const topic = item.topic || "nutrition";
    bookmarkTopicBoost[topic] = (bookmarkTopicBoost[topic] || 0) + 1;
  });

  const now = Date.now();
  const scored = items
    .map((item) => {
      const topic = item.topic || "nutrition";
      const publishedMs = new Date(item.published_at || "").getTime();
      const ageDays = Number.isFinite(publishedMs) ? Math.max(0, (now - publishedMs) / (24 * 60 * 60 * 1000)) : 30;
      const recencyScore = Math.max(0, 3 - ageDays * 0.08);
      const topicBoost = bookmarkTopicBoost[topic] || 0;
      return {
        ...item,
        __score: recencyScore + topicBoost * 1.2,
      };
    })
    .sort((a, b) => b.__score - a.__score)
    .slice(0, safeLimit)
    .map(({ __score, ...item }) => item);

  return { items: scored };
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
  return request(`/content${query ? `?${query}` : ""}`, null).catch((error) => {
    if (!errorLikelyConnectivity(error)) throw error;
    return getContentItemsFromSupabase({ limit, topic, search });
  });
}

export function getRecommendedContent(token, { limit = 12 } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  const query = params.toString();
  return request(`/me/content/recommended${query ? `?${query}` : ""}`, token).catch((error) => {
    if (!errorLikelyConnectivity(error)) throw error;
    return getRecommendedContentFromSupabase({ limit });
  });
}

export function getContentBookmarks(token) {
  return request("/me/content/bookmarks", token).catch((error) => {
    if (!errorLikelyConnectivity(error)) throw error;
    return getBookmarksFromSupabase();
  });
}

export function addContentBookmark(token, slug) {
  return request(`/me/content/bookmarks/${encodeURIComponent(slug)}`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }).catch((error) => {
    if (!errorLikelyConnectivity(error)) throw error;
    return addBookmarkFromSupabase(slug);
  });
}

export function removeContentBookmark(token, slug) {
  return request(`/me/content/bookmarks/${encodeURIComponent(slug)}`, token, {
    method: "DELETE",
  }).catch((error) => {
    if (!errorLikelyConnectivity(error)) throw error;
    return removeBookmarkFromSupabase(slug);
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
  return request("/content/topics", null).catch((error) => {
    if (!errorLikelyConnectivity(error)) throw error;
    return getContentTopicsFromSupabase();
  });
}

export function getContentBySlug(slug) {
  return request(`/content/${encodeURIComponent(slug)}`, null).catch((error) => {
    if (!errorLikelyConnectivity(error)) throw error;
    return getContentBySlugFromSupabase(slug);
  });
}

export function refreshContent(token, force = false) {
  return request("/content/refresh", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force }),
  });
}

