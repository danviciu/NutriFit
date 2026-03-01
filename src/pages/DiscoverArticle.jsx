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

function renderMarkdownBlocks(markdownText) {
  const lines = String(markdownText || "").split(/\r?\n/);
  const blocks = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;

    if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={`h-${index}`} className="mb-5 mt-10 text-3xl font-bold italic text-[#0b1726]">
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
          className="mb-8 space-y-3 rounded-3xl border border-teal-100 bg-white/95 p-6 shadow-[0_6px_16px_rgba(15,23,42,0.08)]"
        >
          {listItems.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`} className="flex items-start gap-3 text-base text-[#0f172a]">
              <span className="mt-1 text-teal-600">-</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>,
      );

      index = cursor - 1;
      continue;
    }

    blocks.push(
      <p key={`p-${index}`} className="mb-6 text-lg leading-relaxed text-[#0f172a]">
        {line}
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
  const theme = getTheme(item?.topic);
  const coverImage = pickTopicImage(item);

  return (
    <div className="-mx-4 -mt-6 md:-mx-6">
      <div className="min-h-screen">
        {error ? (
          <div className="mx-4 mt-6 md:mx-6">
            <Alert variant="destructive">
              <AlertTitle>Eroare</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        {loading ? (
          <div className="mx-4 mt-6 rounded-3xl border border-white/80 bg-white/95 p-6 text-sm text-[#172437] md:mx-6">
            Se incarca articolul...
          </div>
        ) : null}

        {!loading && item ? (
          <>
            <div className="relative h-[60vh] min-h-[500px] overflow-hidden">
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${coverImage})` }} />
              <div className="hero-scrim-strong absolute inset-0" />
              <div className="absolute bottom-0 left-0 w-full p-10 lg:p-20">
                <div className="mx-auto max-w-6xl">
                  <div className="max-w-5xl rounded-[2rem] bg-slate-900/24 p-6 backdrop-blur-[2px] md:p-8">
                    <div className="mb-5 flex items-center gap-3">
                      <span className={`rounded-full px-4 py-1.5 text-sm font-bold uppercase tracking-wider ${theme.accent}`}>
                        {theme.label}
                      </span>
                      <span className="hero-copy-readable text-sm">{item.read_time_min || 1} min citire</span>
                    </div>
                    <h1 className="hero-title-readable max-w-4xl text-4xl font-extrabold leading-tight md:text-5xl lg:text-6xl">
                      {item.title}
                    </h1>
                    <p className="hero-copy-readable mt-5 max-w-3xl text-lg leading-relaxed md:text-xl">{item.summary}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mx-auto grid max-w-7xl grid-cols-1 gap-16 px-6 py-16 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <div className="mb-12 rounded-3xl border-l-4 border-l-teal-500 bg-white/95 p-8 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                  <h3 className="mb-6 text-2xl font-bold text-[#0b1726]">Idei principale</h3>
                  <ul className="space-y-4">
                    <li className="text-base text-[#0f172a]">Informatiile sunt sintetizate din surse reale si verificate.</li>
                    <li className="text-base text-[#0f172a]">Recomandarile trebuie adaptate la contextul tau medical.</li>
                    <li className="text-base text-[#0f172a]">Monitorizeaza progresul in pagina Progress pentru decizii mai bune.</li>
                  </ul>
                </div>

                <article className="text-[#0f172a]">{body}</article>

                <div className="mt-16 flex items-center justify-between border-t border-slate-300 pt-8">
                  <div className="text-sm text-[#1f2e40]">
                    Publicat: {formatDate(item.published_at)} | Actualizat: {formatDate(item.updated_at)}
                  </div>
                  <div className="flex items-center gap-3">
                    <Link to="/discover" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#0f172a]">
                      Inapoi
                    </Link>
                    {item.source_url ? (
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-teal-300 bg-teal-100 px-4 py-2 text-sm font-semibold text-teal-800"
                      >
                        Sursa originala
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="space-y-8 lg:col-span-4">
                <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-teal-900 to-teal-700 p-8 text-white shadow-xl">
                  <div className="relative">
                    <h4 className="text-lg font-bold">Nutri Insights</h4>
                    <p className="mt-1 text-xs uppercase tracking-widest text-teal-200">AI Summary</p>
                    <p className="mt-6 text-sm leading-relaxed text-teal-50/95">
                      "Integreaza recomandarile gradual si urmareste efectele in check-in-urile zilnice."
                    </p>
                    <div className="mt-6 rounded-2xl border border-white/10 bg-white/10 p-4">
                      <span className="mb-1 block text-xs font-bold text-teal-300">RECOMANDARE</span>
                      <p className="text-sm font-medium">Adauga recomandarea in planul tau daca este compatibila medical.</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/80 bg-white/95 p-6 shadow-[0_8px_24px_rgba(13,148,136,0.08)]">
                  <h5 className="text-xs font-bold uppercase tracking-widest text-[#334155]">Context rapid</h5>
                  <div className="mt-4 space-y-3 text-sm text-[#0f172a]">
                    <p>
                      <strong>Sursa:</strong> {item.source_name || "Necunoscut"}
                    </p>
                    <p>
                      <strong>Topic:</strong> {theme.label}
                    </p>
                    <p>
                      <strong>Durata:</strong> {item.read_time_min || 1} min
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {related.length ? (
              <section className="border-t border-slate-200 bg-slate-100/80 py-20">
                <div className="mx-auto max-w-7xl px-6">
                  <div className="mb-10 flex items-end justify-between">
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
                        <div className="relative mb-6 h-64 overflow-hidden rounded-3xl">
                          <img
                            src={pickTopicImage(entry)}
                            alt={entry.title}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        </div>
                        <h3 className="mb-2 text-xl font-bold text-[#0b1726] transition-colors group-hover:text-teal-700">
                          {entry.title}
                        </h3>
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
    </div>
  );
}
