import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getContentBySlug, getContentItems, logUserEvent } from "@/lib/backend-api";
import { useAuth } from "@/lib/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const TOPIC_THEME = {
  nutrition: { label: "Nutritie", accent: "bg-emerald-400 text-teal-900" },
  fitness: { label: "Fitness", accent: "bg-sky-300 text-slate-900" },
  medical: { label: "Medical", accent: "bg-rose-300 text-rose-900" },
  wellbeing: { label: "Wellbeing", accent: "bg-amber-200 text-amber-900" },
  sleep: { label: "Somn", accent: "bg-indigo-200 text-indigo-900" },
  default: { label: "Sanatate", accent: "bg-slate-200 text-slate-900" },
};

function getTheme(topic) {
  return TOPIC_THEME[topic] || TOPIC_THEME.default;
}

function hashString(value) {
  let hash = 0;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickTopicImage(item) {
  const key = item?.slug || item?.source_url || item?.title || "";
  const seed = hashString(`${item?.topic || "health"}-${key}`);
  return `https://picsum.photos/seed/article-${seed}/1600/900`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponibila";
  return date.toLocaleDateString("ro-RO", { year: "numeric", month: "short", day: "numeric" });
}

function splitSentences(text) {
  return String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function extractKeyIdeas(item) {
  const ideas = [];
  const summarySentences = splitSentences(item?.summary).slice(0, 2);
  ideas.push(...summarySentences);

  const bodyLines = String(item?.body_markdown || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const bulletIdeas = bodyLines
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean)
    .slice(0, 3);
  ideas.push(...bulletIdeas);

  if (item?.source_name) {
    ideas.push(`Concluziile provin din sursa: ${item.source_name}.`);
  }

  return Array.from(new Set(ideas)).slice(0, 4);
}

function getSourceHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function renderInlineLinks(text, keyPrefix = "inline-link") {
  const source = String(text || "");
  const regex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const parts = [];
  let lastIndex = 0;
  let match = regex.exec(source);
  let index = 0;

  while (match) {
    const [full, label, url] = match;
    const start = match.index;

    if (start > lastIndex) {
      parts.push(source.slice(lastIndex, start));
    }

    parts.push(
      <a
        key={`${keyPrefix}-${index}`}
        href={url}
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-teal-800 underline decoration-2 underline-offset-4 hover:text-teal-900"
      >
        {label}
      </a>,
    );

    lastIndex = start + full.length;
    index += 1;
    match = regex.exec(source);
  }

  if (lastIndex < source.length) {
    parts.push(source.slice(lastIndex));
  }

  return parts.length ? parts : source;
}

function renderMarkdownBlocks(markdownText) {
  const lines = String(markdownText || "").split(/\r?\n/);
  const blocks = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;

    if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={`h-${index}`} className="mb-5 mt-10 text-3xl font-extrabold leading-tight text-[#0a2035]">
          {line.slice(3)}
        </h2>,
      );
      continue;
    }

    if (line.startsWith("- ")) {
      const listItems = [line.slice(2)];
      let cursor = index + 1;
      while (cursor < lines.length && lines[cursor].trim().startsWith("- ")) {
        listItems.push(lines[cursor].trim().slice(2));
        cursor += 1;
      }

      blocks.push(
        <ul
          key={`ul-${index}`}
          className="mb-8 space-y-3 rounded-3xl border border-teal-200 bg-white p-6 shadow-[0_8px_18px_rgba(15,23,42,0.08)]"
        >
          {listItems.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`} className="flex items-start gap-3 text-base leading-relaxed text-[#13263d]">
              <span className="mt-1 text-teal-600">&#9679;</span>
              <span>{renderInlineLinks(item, `list-link-${index}-${itemIndex}`)}</span>
            </li>
          ))}
        </ul>,
      );

      index = cursor - 1;
      continue;
    }

    blocks.push(
      <p key={`p-${index}`} className="mb-6 text-lg leading-9 text-[#13263d]">
        {renderInlineLinks(line, `p-link-${index}`)}
      </p>,
    );
  }

  return blocks;
}

export default function DiscoverArticle() {
  const { slug } = useParams();
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [item, setItem] = useState(null);
  const [related, setRelated] = useState([]);

  useEffect(() => {
    if (!slug) return;
    let mounted = true;

    (async () => {
      try {
        const response = await getContentBySlug(slug);
        if (!mounted) return;

        const currentItem = response.item || null;
        setItem(currentItem);

        if (currentItem?.topic) {
          const relatedResp = await getContentItems({ topic: currentItem.topic, limit: 6 });
          if (!mounted) return;
          setRelated((relatedResp.items || []).filter((entry) => entry.slug !== currentItem.slug).slice(0, 3));
        }
      } catch (err) {
        if (!mounted) return;
        setError(err.message || "Nu am putut incarca articolul.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!accessToken || !item) return;
    logUserEvent(accessToken, {
      eventName: "content_read",
      page: `/discover/${item.slug}`,
      metadata: { topic: item.topic, source: item.source_name },
    }).catch(() => {});
  }, [accessToken, item]);

  useEffect(() => {
    if (!item?.slug) return;
    try {
      localStorage.setItem(
        "nutrifit_last_article",
        JSON.stringify({
          slug: item.slug,
          title: item.title,
          topic: item.topic || "",
          read_time_min: item.read_time_min || 1,
          updated_at: item.updated_at || item.published_at || "",
        }),
      );
    } catch {
      // Non-blocking cache write.
    }
  }, [item]);

  const body = useMemo(() => renderMarkdownBlocks(item?.body_markdown), [item?.body_markdown]);
  const keyIdeas = useMemo(() => extractKeyIdeas(item), [item]);
  const theme = getTheme(item?.topic);
  const coverImage = pickTopicImage(item);
  const sourceHost = useMemo(() => getSourceHost(item?.source_url), [item?.source_url]);

  return (
    <div className="-mt-2 min-h-screen pb-8">
      {error ? (
        <div className="mx-auto mt-6 w-full max-w-6xl px-4">
          <Alert variant="destructive">
            <AlertTitle>Eroare</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      {loading ? (
        <div className="mx-auto mt-6 w-full max-w-6xl rounded-3xl border border-white/80 bg-white p-6 text-sm text-[#172437]">
          Se incarca articolul...
        </div>
      ) : null}

      {!loading && item ? (
        <>
          <section className="mx-auto w-full max-w-6xl px-4">
            <div className="relative mt-4 h-[54vh] min-h-[430px] overflow-hidden rounded-[2rem] border border-white/50 shadow-[0_16px_40px_rgba(15,23,42,0.22)]">
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${coverImage})` }} />
              <div className="hero-scrim-strong absolute inset-0" />
              <div className="absolute bottom-0 left-0 w-full p-6 md:p-10">
                <div className="max-w-4xl rounded-3xl bg-slate-900/36 p-5 backdrop-blur-[3px] md:p-8">
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <span className={`rounded-full px-4 py-1.5 text-sm font-bold uppercase tracking-wider ${theme.accent}`}>{theme.label}</span>
                    <span className="hero-copy-readable text-sm">{item.read_time_min || 1} min citire</span>
                  </div>
                  <h1 className="hero-title-readable max-w-4xl text-3xl font-extrabold leading-tight md:text-5xl">{item.title}</h1>
                  <p className="hero-copy-readable mt-4 max-w-3xl text-base leading-relaxed md:text-xl">{item.summary}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-4 py-12 lg:grid-cols-12">
            <div className="space-y-8 lg:col-span-8">
              <div className="rounded-3xl border border-teal-200 bg-white p-7 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">Rezumat rapid</p>
                    <h3 className="mt-2 text-2xl font-extrabold text-[#0a2035]">Idei principale</h3>
                  </div>
                  {item.source_url ? (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-teal-300 bg-teal-50 px-4 py-2 text-sm font-bold text-teal-800 underline decoration-2 underline-offset-4 hover:bg-teal-100"
                    >
                      Citeste sursa originala
                    </a>
                  ) : null}
                </div>

                <ul className="mt-6 space-y-3">
                  {keyIdeas.map((idea, index) => (
                    <li key={`${idea}-${index}`} className="flex items-start gap-3 text-base leading-relaxed text-[#10253d]">
                      <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-teal-600" />
                      <span>{idea}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <article className="rounded-3xl border border-white/80 bg-white p-7 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">{body}</article>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-300 pt-6">
                <div className="space-y-1 text-sm font-medium text-[#1f2e40]">
                  <p>
                    Publicat: {formatDate(item.published_at)} | Actualizat: {formatDate(item.updated_at)}
                  </p>
                  {item.source_url ? (
                    <p>
                      Sursa originala:{" "}
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-teal-800 underline decoration-2 underline-offset-4 hover:text-teal-900"
                      >
                        {item.source_name || sourceHost || item.source_url}
                      </a>
                    </p>
                  ) : null}
                </div>
                <Link to="/discover" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#0f172a]">
                  Inapoi
                </Link>
              </div>
            </div>

            <aside className="space-y-6 lg:col-span-4">
              <div className="rounded-[2rem] border border-teal-800/30 bg-gradient-to-br from-teal-900 to-teal-700 p-7 text-white shadow-xl">
                <h4 className="text-lg font-bold text-white">Cum folosesti informatia</h4>
                <p className="mt-2 text-sm leading-relaxed text-white/95">
                  Compara ideile de mai sus cu planul tau curent si introdu modificarile treptat, apoi urmareste efectele in check-in-uri.
                </p>
                <div className="mt-5 rounded-2xl border border-white/28 bg-white/12 p-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-white">Regula practica</span>
                  <p className="mt-2 text-sm text-white/95">Nu schimba simultan multe obiceiuri; aplica 1-2 ajustari pe saptamana.</p>
                </div>
              </div>

              <div className="rounded-3xl border border-white/80 bg-white p-6 shadow-[0_8px_24px_rgba(13,148,136,0.08)]">
                <h5 className="text-xs font-bold uppercase tracking-widest text-[#334155]">Context rapid</h5>
                <div className="mt-4 space-y-3 text-sm font-medium text-[#0f172a]">
                  <p>
                    <strong>Sursa:</strong> {item.source_name || "Necunoscut"}
                  </p>
                  <p>
                    <strong>Topic:</strong> {theme.label}
                  </p>
                  <p>
                    <strong>Durata:</strong> {item.read_time_min || 1} min
                  </p>
                  {item.source_url ? (
                    <p>
                      <strong>Link:</strong>{" "}
                      <a href={item.source_url} target="_blank" rel="noreferrer" className="font-bold text-teal-700 hover:underline">
                        {sourceHost || "sursa originala"}
                      </a>
                    </p>
                  ) : null}
                </div>
              </div>
            </aside>
          </section>

          {related.length ? (
            <section className="border-t border-slate-200 bg-slate-100/80 py-16">
              <div className="mx-auto max-w-6xl px-4">
                <div className="mb-8 flex items-end justify-between">
                  <div>
                    <h2 className="text-3xl font-extrabold text-teal-900">Articole similare</h2>
                    <p className="text-[#1f2e40]">Continua sa inveti despre sanatatea ta</p>
                  </div>
                  <Link to="/discover" className="font-bold text-teal-700 hover:underline">
                    Vezi catalogul
                  </Link>
                </div>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                  {related.map((entry) => (
                    <Link key={entry.slug} to={`/discover/${entry.slug}`} className="group block cursor-pointer">
                      <div className="relative mb-6 h-56 overflow-hidden rounded-3xl">
                        <img
                          src={pickTopicImage(entry)}
                          alt={entry.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                      <h3 className="mb-2 text-xl font-bold text-[#0b1726] transition-colors group-hover:text-teal-700">{entry.title}</h3>
                      <p className="line-clamp-2 text-sm text-[#1f2e40]">{entry.summary}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
