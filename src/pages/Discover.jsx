import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  addContentBookmark,
  getContentBookmarks,
  getContentItems,
  getContentTopics,
  getRecommendedContent,
  logUserEvent,
  refreshContent,
  removeContentBookmark,
} from "@/lib/backend-api";
import { useAuth } from "@/lib/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const TOPIC_THEME = {
  nutrition: { label: "Nutritie", mood: "Optimizare alimentara", chipClass: "bg-emerald-50 text-emerald-700" },
  fitness: { label: "Fitness", mood: "Performanta fizica", chipClass: "bg-sky-50 text-sky-700" },
  medical: { label: "Medical", mood: "Context clinic relevant", chipClass: "bg-rose-50 text-rose-700" },
  wellbeing: { label: "Wellbeing", mood: "Recuperare si echilibru", chipClass: "bg-amber-50 text-amber-700" },
  sleep: { label: "Somn", mood: "Somn si recuperare", chipClass: "bg-indigo-50 text-indigo-700" },
  default: { label: "Sanatate", mood: "Semnal util pentru sanatate", chipClass: "bg-slate-100 text-slate-700" },
};

const HEALTH_KEYWORDS = [
  "nutrit",
  "fitness",
  "sport",
  "sanat",
  "exercit",
  "antren",
  "medical",
  "metabol",
  "somn",
  "recuper",
  "wellbeing",
  "hidrata",
];

const DISCOVER_CACHE_KEY = "nutrifit_discover_cache_v2";

function getTheme(topic) {
  return TOPIC_THEME[topic] || TOPIC_THEME.default;
}

function hashString(value) {
  let hash = 0;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  return hash;
}

function isHealthItem(item) {
  const joined = `${item?.topic || ""} ${item?.title || ""} ${item?.summary || ""}`.toLowerCase();
  return HEALTH_KEYWORDS.some((token) => joined.includes(token));
}

function normalizeHealthFeed(rows) {
  const seen = new Set();
  const result = [];
  (rows || []).forEach((item) => {
    const key = item?.slug || item?.source_url || item?.title || "";
    if (!key || seen.has(key)) return;
    if (!isHealthItem(item)) return;
    seen.add(key);
    result.push(item);
  });
  return result;
}

function pickTopicImage(item) {
  const key = item?.slug || item?.source_url || item?.title || "";
  const seed = hashString(`${item?.topic || "health"}-${key}-${item?.published_at || ""}`);
  return `https://picsum.photos/seed/discover-${seed}/1200/760`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponibila";
  return date.toLocaleDateString("ro-RO", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "moment necunoscut";
  return date.toLocaleString("ro-RO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function loadDiscoverCache() {
  try {
    const raw = localStorage.getItem(DISCOVER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.items)) return null;
    return {
      items: parsed.items,
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      syncedAt: parsed.syncedAt || "",
    };
  } catch {
    return null;
  }
}

function saveDiscoverCache(payload) {
  try {
    localStorage.setItem(DISCOVER_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Best effort only.
  }
}

function filterItems(rows, { selectedTopic, searchText, feedMode, bookmarkSlugs }) {
  const topicFilter = String(selectedTopic || "").trim();
  const searchFilter = String(searchText || "").trim().toLowerCase();

  return (rows || []).filter((item) => {
    if (topicFilter && item.topic !== topicFilter) return false;
    if (feedMode === "saved" && !bookmarkSlugs.has(item.slug)) return false;
    if (!searchFilter) return true;

    const text = `${item.title || ""} ${item.summary || ""} ${(item.tags || []).join(" ")}`.toLowerCase();
    return text.includes(searchFilter);
  });
}

export default function Discover() {
  const { accessToken, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingBookmark, setSavingBookmark] = useState("");
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [topics, setTopics] = useState([]);
  const selectedTopic = "";
  const search = "";
  const feedMode = "all";
  const [bookmarkSlugs, setBookmarkSlugs] = useState(new Set());
  const [lastSyncedAt, setLastSyncedAt] = useState("");

  const fetchBookmarks = async () => {
    if (!accessToken || !user) {
      setBookmarkSlugs(new Set());
      return;
    }
    const response = await getContentBookmarks(accessToken);
    setBookmarkSlugs(new Set((response.bookmarks || []).map((item) => item.slug).filter(Boolean)));
  };

  useEffect(() => {
    fetchBookmarks().catch(() => {});
  }, [accessToken, user]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");

    (async () => {
      try {
        const topicsResp = await getContentTopics();
        if (!mounted) return;

        const safeTopics = (topicsResp.topics || []).filter((topic) => getTheme(topic).label !== "Sanatate" || topic === "default");
        setTopics(safeTopics);

        let rawItems = [];
        if (feedMode === "recommended" && accessToken) {
          const recommendedResp = await getRecommendedContent(accessToken, { limit: 40 });
          rawItems = recommendedResp.items || [];
        } else if (feedMode === "saved" && accessToken && user) {
          const bookmarksResp = await getContentBookmarks(accessToken);
          rawItems = bookmarksResp.bookmarks || [];
        } else {
          const itemsResp = await getContentItems({ topic: selectedTopic, search, limit: 40 });
          rawItems = itemsResp.items || [];
        }

        const normalized = normalizeHealthFeed(rawItems);
        const filtered = filterItems(normalized, { selectedTopic, searchText: search, feedMode, bookmarkSlugs });

        if (!mounted) return;
        setItems(filtered);

        if (feedMode !== "saved") {
          const syncedAt = new Date().toISOString();
          setLastSyncedAt(syncedAt);
          saveDiscoverCache({ items: normalized, topics: safeTopics, syncedAt });
        }
      } catch (err) {
        if (!mounted) return;

        const cached = loadDiscoverCache();
        if (cached?.items?.length) {
          const fallbackFiltered = filterItems(cached.items, {
            selectedTopic,
            searchText: search,
            feedMode,
            bookmarkSlugs,
          });

          setItems(fallbackFiltered);
          if (cached.topics.length) setTopics(cached.topics);
          setLastSyncedAt(cached.syncedAt);
          setError(`Conexiune indisponibila. Afisez ultima versiune sincronizata (${formatDateTime(cached.syncedAt)}).`);
        } else {
          setError(err.message || "Nu am putut incarca fluxul Discover.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedTopic, search, feedMode, accessToken, user, bookmarkSlugs]);

  const featured = items[0] || null;
  const gridItems = items.slice(1, 10);
  const latestItems = items.slice(10, 16);

  const handleRefresh = async () => {
    if (!accessToken) return;
    setRefreshing(true);
    setError("");
    try {
      await refreshContent(accessToken, true);
      const itemsResp =
        feedMode === "recommended"
          ? await getRecommendedContent(accessToken, { limit: 40 })
          : await getContentItems({ topic: selectedTopic, search, limit: 40 });

      const normalized = normalizeHealthFeed(itemsResp.items || []);
      const filtered = filterItems(normalized, { selectedTopic, searchText: search, feedMode, bookmarkSlugs });
      setItems(filtered);

      const syncedAt = new Date().toISOString();
      setLastSyncedAt(syncedAt);
      saveDiscoverCache({ items: normalized, topics, syncedAt });

      await logUserEvent(accessToken, {
        eventName: "content_refresh_manual",
        page: "/discover",
        metadata: { topic: selectedTopic || "all", feedMode },
      });
    } catch (err) {
      setError(err.message || "Nu am putut actualiza continutul.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleBookmarkToggle = async (event, item) => {
    event.preventDefault();
    event.stopPropagation();
    if (!accessToken || !user || !item?.slug) return;
    const isBookmarked = bookmarkSlugs.has(item.slug);
    setSavingBookmark(item.slug);
    setError("");
    try {
      if (isBookmarked) await removeContentBookmark(accessToken, item.slug);
      else await addContentBookmark(accessToken, item.slug);

      setBookmarkSlugs((prev) => {
        const next = new Set(prev);
        if (isBookmarked) next.delete(item.slug);
        else next.add(item.slug);
        return next;
      });

      if (feedMode === "saved" && isBookmarked) {
        setItems((prev) => prev.filter((entry) => entry.slug !== item.slug));
      }
    } catch (err) {
      setError(err.message || "Nu am putut actualiza bookmark-ul.");
    } finally {
      setSavingBookmark("");
    }
  };

  const trackOpen = (item, rank) => {
    if (!accessToken) return;
    logUserEvent(accessToken, {
      eventName: "content_open",
      page: "/discover",
      metadata: { slug: item.slug, topic: item.topic, rank, feedMode },
    }).catch(() => {});
  };

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-4xl font-extrabold text-slate-900">Descopera articole health-tech</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Resurse validate stiintific despre nutritie, exercitii, antrenamente si recuperare.
        </p>
        {lastSyncedAt ? (
          <p className="mt-2 text-xs font-medium text-slate-600">Ultima sincronizare: {formatDateTime(lastSyncedAt)}</p>
        ) : null}
        {user ? (
          <div className="mt-4">
            <Button onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? "Actualizare..." : "Actualizeaza acum"}
            </Button>
          </div>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Eroare</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? <div className="glass-card rounded-[2rem] p-6 text-sm text-slate-700">Se incarca articolele...</div> : null}

      {!loading && !items.length ? (
        <div className="glass-card rounded-[2rem] p-6 text-sm text-slate-700">
          Nu am gasit articole despre sanatate pentru filtrul selectat.
        </div>
      ) : null}

      {!loading && featured ? (
        <Link to={`/discover/${featured.slug}`} className="group block cursor-pointer" onClick={() => trackOpen(featured, 1)}>
          <section className="relative h-[500px] overflow-hidden rounded-[2.5rem] shadow-2xl transition-all duration-500 hover:scale-[1.01]">
            <img
              src={pickTopicImage(featured)}
              alt={featured.title}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="hero-scrim-strong absolute inset-0" />
            <div className="absolute bottom-0 left-0 w-full p-10">
              <div className="mb-6 flex items-center gap-3">
                <span className="rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white">
                  Editor's choice
                </span>
                <span className="hero-copy-readable text-sm">{featured.read_time_min || 1} min citire</span>
              </div>
              <h2 className="hero-title-readable mb-4 max-w-4xl text-4xl font-bold leading-tight md:text-5xl">
                {featured.title}
              </h2>
              <p className="hero-copy-readable max-w-3xl text-lg">{featured.summary}</p>
            </div>
          </section>
        </Link>
      ) : null}

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {gridItems.map((item, index) => {
          const theme = getTheme(item.topic);
          const isBookmarked = bookmarkSlugs.has(item.slug);
          return (
            <Link key={item.slug} to={`/discover/${item.slug}`} className="group block" onClick={() => trackOpen(item, index + 2)}>
              <article className="glass-card overflow-hidden rounded-[2rem] transition-all duration-300 hover:shadow-xl">
                <div className="relative h-56 overflow-hidden">
                  <img
                    src={pickTopicImage(item)}
                    alt={item.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className={`absolute left-4 top-4 rounded-lg px-3 py-1 text-xs font-bold uppercase ${theme.chipClass}`}>
                    {theme.label}
                  </div>
                  {user ? (
                    <button
                      type="button"
                      className={`absolute right-4 top-4 rounded-xl p-2 text-xs font-semibold ${
                        isBookmarked ? "bg-teal-600 text-white" : "bg-white/85 text-slate-700"
                      }`}
                      onClick={(event) => handleBookmarkToggle(event, item)}
                      disabled={savingBookmark === item.slug}
                    >
                      {savingBookmark === item.slug ? "..." : isBookmarked ? "Salvat" : "Salveaza"}
                    </button>
                  ) : null}
                </div>
                <div className="p-8">
                  <div className="mb-3 text-xs font-medium text-slate-500">{item.read_time_min || 1} min citire</div>
                  <h3 className="mb-3 line-clamp-3 text-xl font-bold text-slate-900 transition-colors group-hover:text-teal-700">
                    {item.title}
                  </h3>
                  <p className="mb-6 line-clamp-3 text-sm leading-relaxed text-slate-700">{item.summary}</p>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-6">
                    <span className="text-xs text-slate-500">{formatDate(item.published_at)}</span>
                    <span className="text-sm font-bold text-teal-700">Citeste mai mult</span>
                  </div>
                </div>
              </article>
            </Link>
          );
        })}
      </div>

      {latestItems.length ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900">Ultimele noutati</h2>
          </div>
          {latestItems.map((item) => {
            const theme = getTheme(item.topic);
            return (
              <Link key={`latest-${item.slug}`} to={`/discover/${item.slug}`} className="group block" onClick={() => trackOpen(item, 20)}>
                <div className="glass-card flex items-center gap-8 rounded-3xl p-6 transition-all duration-300 hover:shadow-lg">
                  <div className="h-32 w-40 flex-shrink-0 overflow-hidden rounded-2xl">
                    <img
                      src={pickTopicImage(item)}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                  <div className="flex-grow">
                    <div className="mb-2 flex items-center gap-3">
                      <span className="text-xs font-bold uppercase text-teal-700">{theme.label}</span>
                      <span className="text-xs text-slate-500">{item.read_time_min || 1} min citire</span>
                    </div>
                    <h4 className="mb-2 text-lg font-bold text-slate-900 transition-colors group-hover:text-teal-700">
                      {item.title}
                    </h4>
                    <p className="line-clamp-2 text-sm text-slate-700">{item.summary}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

