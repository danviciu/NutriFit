import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getContentItems,
  dismissNotification,
  dismissReminder,
  getNotificationStats,
  getNotifications,
  getPlans,
  getProfile,
  getProgressSummary,
  getRecommendedContent,
  getReminders,
  logUserEvent,
} from "@/lib/backend-api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";

const reminderTone = {
  high: "border-l-rose-400 bg-rose-50/80",
  medium: "border-l-amber-400 bg-amber-50/80",
  low: "border-l-emerald-400 bg-emerald-50/80",
};

const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatInt(value) {
  if (!Number.isFinite(Number(value))) return "-";
  return Math.round(Number(value)).toLocaleString("ro-RO");
}

function deriveBmrTdee(profile) {
  if (!profile) return { bmr: null, tdee: null };

  const sex = profile.sex || "";
  const weight = toNumber(profile.weight_kg ?? profile.weightKg);
  const height = toNumber(profile.height_cm ?? profile.heightCm);
  const age = toNumber(profile.age);
  const activity = profile.activity_level ?? profile.activityLevel ?? "moderate";

  if (!sex || !weight || !height || !age) return { bmr: null, tdee: null };

  const bmrRaw =
    sex === "male"
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;
  const bmr = Math.round(bmrRaw);
  const tdee = Math.round(bmr * (ACTIVITY_FACTORS[activity] || ACTIVITY_FACTORS.moderate));

  return { bmr, tdee };
}

function mapReminder(entry) {
  return {
    key: entry.key || entry.id,
    id: entry.id,
    title: entry.title,
    message: entry.message,
    severity: entry.severity,
    actionPath: entry.actionPath || "/notifications",
    actionLabel: entry.actionLabel || "Deschide",
  };
}

function hashString(value) {
  let hash = 0;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  return hash;
}

function pickTopicImage(item) {
  const key = item?.slug || item?.source_url || item?.title || "";
  const seed = hashString(`${item?.topic || "health"}-${key}-${item?.published_at || ""}`);
  return `https://picsum.photos/seed/home-discover-${seed}/1200/760`;
}

function topicLabel(topic) {
  const map = {
    nutrition: "Nutritie",
    fitness: "Fitness",
    medical: "Medical",
    wellbeing: "Wellbeing",
    sleep: "Somn",
  };
  return map[String(topic || "").toLowerCase()] || "Sanatate";
}

export default function Home() {
  const { user, accessToken } = useAuth();
  const [reminders, setReminders] = useState([]);
  const [dismissBusy, setDismissBusy] = useState("");
  const [recommendedItems, setRecommendedItems] = useState([]);
  const [lastReadArticle, setLastReadArticle] = useState(null);
  const [monitoring, setMonitoring] = useState({
    loading: false,
    summary: null,
    bmr: null,
    tdee: null,
    kcalTarget: null,
    kcalUsed: null,
    unreadCount: 0,
  });

  useEffect(() => {
    if (!user || !accessToken) {
      setReminders([]);
      return;
    }

    let mounted = true;

    getNotifications(accessToken, { status: "unread", limit: 6 })
      .then(async (response) => {
        if (!mounted) return;
        const rows = response.notifications || [];
        if (rows.length) {
          setReminders(rows.map(mapReminder));
          return;
        }

        const remindersResp = await getReminders(accessToken);
        if (!mounted) return;
        setReminders((remindersResp.reminders || []).map(mapReminder));
      })
      .catch(() => {
        if (!mounted) return;
        setReminders([]);
      });

    return () => {
      mounted = false;
    };
  }, [user, accessToken]);

  useEffect(() => {
    let mounted = true;

    const readCached = () => {
      try {
        const raw = localStorage.getItem("nutrifit_last_article");
        if (!raw) return null;
        return JSON.parse(raw);
      } catch {
        return null;
      }
    };

    setLastReadArticle(readCached());

    const loadRecommended = async () => {
      try {
        let rows = [];
        if (user && accessToken) {
          const resp = await getRecommendedContent(accessToken, { limit: 8 });
          rows = resp?.items || [];
        } else {
          const resp = await getContentItems({ limit: 8 });
          rows = resp?.items || [];
        }
        if (!mounted) return;
        setRecommendedItems(rows.filter((item) => item?.slug && item?.title).slice(0, 6));
      } catch {
        if (!mounted) return;
        setRecommendedItems([]);
      }
    };

    loadRecommended();

    return () => {
      mounted = false;
    };
  }, [user, accessToken]);

  useEffect(() => {
    if (!user || !accessToken) {
      setMonitoring({
        loading: false,
        summary: null,
        bmr: null,
        tdee: null,
        kcalTarget: null,
        kcalUsed: null,
        unreadCount: 0,
      });
      return;
    }

    let mounted = true;
    setMonitoring((prev) => ({ ...prev, loading: true }));

    Promise.all([
      getProgressSummary(accessToken, 7),
      getProfile(accessToken),
      getPlans(accessToken),
      getNotificationStats(accessToken),
    ])
      .then(([summaryResp, profileResp, plansResp, statsResp]) => {
        if (!mounted) return;

        const summary = summaryResp?.summary || null;
        const { bmr, tdee } = deriveBmrTdee(profileResp?.profile || null);
        const plans = Array.isArray(plansResp?.plans) ? plansResp.plans : [];
        const latestPlan = plans[0]?.plan_json || {};
        const planKcal = toNumber(latestPlan?.targets?.kcal);
        const adherence = clamp(Number(summary?.adherenceScore || 0), 0, 100);
        const kcalUsed = planKcal ? Math.round((planKcal * adherence) / 100) : null;

        setMonitoring({
          loading: false,
          summary,
          bmr,
          tdee,
          kcalTarget: planKcal,
          kcalUsed,
          unreadCount: Number(statsResp?.unreadCount || 0),
        });
      })
      .catch(() => {
        if (!mounted) return;
        setMonitoring((prev) => ({ ...prev, loading: false }));
      });

    return () => {
      mounted = false;
    };
  }, [user, accessToken]);

  const onDismissReminder = async (reminder) => {
    const key = reminder?.key || reminder?.id;
    const notificationId = reminder?.id || "";
    if (!accessToken || !key) return;
    setDismissBusy(key);

    try {
      if (notificationId) await dismissNotification(accessToken, notificationId);
      else await dismissReminder(accessToken, key);
      setReminders((prev) => prev.filter((item) => item.key !== key));
      window.dispatchEvent(new Event("nutrifit:notifications-changed"));
    } finally {
      setDismissBusy("");
    }
  };

  const summary = monitoring.summary;
  const adherenceScore = user ? clamp(Number(summary?.adherenceScore || 0), 0, 100) : 75;
  const checkinStreak = user ? Number(summary?.checkinStreak || 0) : 2;
  const workoutsDone = user ? Number(summary?.workoutsDone || 0) : 2;
  const bmrValue = user ? monitoring.bmr : 1840;
  const tdeeValue = user ? monitoring.tdee : 2450;
  const calorieTarget = user ? monitoring.kcalTarget : 2200;
  const calorieUsed = user ? monitoring.kcalUsed : 1650;
  const caloriePercent = calorieTarget ? clamp(Math.round((Number(calorieUsed || 0) / Number(calorieTarget)) * 100), 0, 100) : 0;
  const bmrPercent = bmrValue ? clamp(Math.round(((bmrValue - 1200) / 1200) * 100), 15, 95) : 65;
  const latestCheckinDate = summary?.latestCheckin?.checkin_date || "";
  const checkinDoneToday = latestCheckinDate === todayKey();

  const checklistRows = useMemo(() => {
    const defaults = user
      ? [
          {
            key: "checkin-today",
            title: "Check-in zilnic",
            subtitle: checkinDoneToday ? "Finalizat azi" : "Lipseste check-in-ul de azi",
            done: checkinDoneToday,
            severity: checkinDoneToday ? "low" : "high",
          },
          {
            key: "workout-week",
            title: "Antrenamente in ultimele 7 zile",
            subtitle: `${workoutsDone} finalizate`,
            done: workoutsDone >= 3,
            severity: workoutsDone >= 3 ? "low" : "medium",
          },
          {
            key: "plan-current",
            title: "Plan alimentar activ",
            subtitle: calorieTarget ? `${formatInt(calorieTarget)} kcal/zi` : "Genereaza primul plan",
            done: Boolean(calorieTarget),
            severity: calorieTarget ? "low" : "medium",
          },
        ]
      : [
          {
            key: "water",
            title: "Bea 500ml apa (dimineata)",
            subtitle: "Finalizat la 08:30",
            done: true,
          },
          {
            key: "workout",
            title: "Antrenament de forta (Lower Body)",
            subtitle: "Finalizat la 10:15",
            done: true,
          },
        ];

    const dynamic = reminders.slice(0, 3).map((item) => ({
      key: item.key,
      title: item.title,
      subtitle: item.message || "Recomandare AI",
      done: false,
      reminder: item,
      severity: item.severity,
    }));

    return [...defaults, ...dynamic].slice(0, 5);
  }, [reminders, user, checkinDoneToday, workoutsDone, calorieTarget]);

  const visibleRecommended = recommendedItems.slice(0, 2);

  const trackRecommendedClick = (item, rank, source = "home") => {
    if (!accessToken || !item?.slug) return;
    logUserEvent(accessToken, {
      eventName: "content_open",
      page: "/",
      metadata: {
        slug: item.slug,
        topic: item.topic || "",
        rank,
        source,
      },
    }).catch(() => {});
  };

  return (
    <div className="space-y-10 pb-8">
      <section className="relative grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
        <div className="z-10 lg:col-span-7">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/60 px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Analiza AI live: Optimizare metabolica
          </div>

          <h1 className="hero-heading hero-title mb-6 text-5xl leading-tight text-teal-900 md:text-6xl lg:text-7xl">
            Evolutia ta <br />
            <span className="text-teal-600 italic">incepe cu datele.</span>
          </h1>
          <p className="mb-10 max-w-xl text-lg leading-relaxed text-slate-700">
            NutriFit proceseaza profilul tau, check-in-urile si analizele de sange pentru recomandari zilnice clare.
          </p>
          <div className="flex flex-wrap gap-4">
            {user ? (
              <>
                <Link to="/plan">
                  <Button className="h-auto rounded-2xl px-8 py-4 text-sm font-bold">Vezi planul de azi</Button>
                </Link>
                <Link to="/wizard">
                  <Button variant="outline" className="h-auto rounded-2xl px-8 py-4 text-sm font-bold">
                    Incarca analize noi
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/signup">
                  <Button className="h-auto rounded-2xl px-8 py-4 text-sm font-bold">Incepe gratuit</Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline" className="h-auto rounded-2xl px-8 py-4 text-sm font-bold">
                    Login
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="relative lg:col-span-5">
          <div className="ai-companion-float relative z-20 flex justify-center">
            <div className="group relative flex h-72 w-72 items-center justify-center overflow-hidden rounded-[4rem] bg-gradient-to-br from-teal-500 to-teal-900 shadow-2xl">
              <div className="absolute inset-0 opacity-20">
                <svg className="h-full w-full" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="30" fill="none" stroke="white" strokeWidth="0.5" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="white" strokeWidth="0.2" />
                  <path d="M20,50 Q50,20 80,50" fill="none" stroke="white" strokeWidth="0.5" />
                </svg>
              </div>
              <div className="text-center text-white">
                <div className="mb-2 text-7xl font-extrabold opacity-90">AI</div>
                <div className="text-sm font-bold uppercase tracking-[0.2em] opacity-70">Nutri AI</div>
              </div>
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-300/30 blur-3xl" />
              <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-teal-500/20 blur-3xl" />
            </div>
          </div>
          <div className="absolute left-1/2 top-1/2 -z-10 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-500/10 blur-[100px]" />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="glass-card rounded-[2.5rem] p-8">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-600">Metabolism bazal (BMR)</p>
              <h3 className="text-3xl font-extrabold text-teal-900">
                {formatInt(bmrValue)} <span className="text-sm font-normal text-slate-600">kcal</span>
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-xs font-bold text-teal-700">BMR</div>
          </div>
          <div className="mt-6 flex items-end gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-teal-500" style={{ width: `${bmrPercent}%` }} />
            </div>
            <span className="text-[10px] font-bold text-slate-600">{user ? "Din profil" : "Normal"}</span>
          </div>
        </div>

        <div className="glass-card rounded-[2.5rem] border-2 border-teal-200/60 p-8">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-600">Consum zilnic (TDEE)</p>
              <h3 className="text-3xl font-extrabold text-teal-900">
                {formatInt(tdeeValue)} <span className="text-sm font-normal text-slate-600">kcal</span>
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-100 text-xs font-bold text-teal-700">TDEE</div>
          </div>
          <div className="mt-6 flex items-center gap-1 text-sm font-bold text-emerald-700">
            {user ? `Streak check-in: ${checkinStreak} zile` : "+12% fata de sapt. trecuta"}
          </div>
        </div>

        <div className="glass-card flex items-center gap-6 rounded-[2.5rem] p-8">
          <div className="relative h-24 w-24 flex-shrink-0">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-slate-100" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="transparent"
                stroke="currentColor"
                strokeWidth="8"
                strokeDasharray="263.89"
                strokeDashoffset={263.89 - (263.89 * caloriePercent) / 100}
                className="text-teal-500 ring-chart"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-teal-900">{caloriePercent}%</div>
          </div>
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-600">Obiectiv calorii</p>
            <h3 className="text-2xl font-extrabold text-teal-900">
              {formatInt(calorieUsed)} / {formatInt(calorieTarget)}
            </h3>
            <p className="text-sm text-slate-700">
              {calorieTarget && calorieUsed !== null
                ? `Ramas: ${formatInt(Math.max(Number(calorieTarget) - Number(calorieUsed), 0))} kcal`
                : "Aderenta saptamanala"}
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-12 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-teal-900">Checklist zilnic</h2>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-teal-700">
              {checklistRows.filter((item) => item.done).length} DIN 5
            </span>
          </div>

          <div className="space-y-4">
            {checklistRows.map((item) => (
              <div
                key={item.key}
                className={`glass-card flex items-center gap-4 rounded-2xl border-l-4 p-5 ${
                  item.done ? "border-l-teal-500" : reminderTone[item.severity] || "border-l-slate-200 bg-white/70"
                }`}
              >
                <div
                  className={`h-6 w-6 rounded-md border-2 ${
                    item.done ? "border-teal-500 bg-teal-500" : "border-slate-400 bg-transparent"
                  }`}
                />
                <div className="flex-1">
                  <h4 className={`text-sm font-bold text-teal-900 ${item.done ? "line-through opacity-50" : ""}`}>
                    {item.title}
                  </h4>
                  <p className="text-[10px] font-medium text-slate-600">{item.subtitle}</p>
                </div>
                {item.reminder ? (
                  <button
                    type="button"
                    className="rounded-xl border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700"
                    onClick={() => onDismissReminder(item.reminder)}
                    disabled={dismissBusy === item.key}
                  >
                    {dismissBusy === item.key ? "..." : "Dismiss"}
                  </button>
                ) : null}
              </div>
            ))}

            <Link
              to="/notifications"
              className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-transparent p-5 text-sm font-bold text-slate-600 transition-all hover:border-teal-500 hover:text-teal-700"
            >
              + Deschide centrul de notificari
            </Link>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-teal-900">Recomandat pentru tine</h2>
            <Link to="/discover" className="text-sm font-bold text-teal-700 hover:underline">
              Vezi tot
            </Link>
          </div>
          {lastReadArticle?.slug ? (
            <Link
              to={`/discover/${lastReadArticle.slug}`}
              className="mb-6 block rounded-2xl border border-teal-200 bg-teal-50/70 p-4"
              onClick={() => trackRecommendedClick(lastReadArticle, 0, "continue_reading")}
            >
              <p className="text-xs font-bold uppercase tracking-widest text-teal-700">Continua lectura</p>
              <p className="mt-1 line-clamp-2 text-base font-bold text-slate-900">{lastReadArticle.title}</p>
            </Link>
          ) : null}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {(visibleRecommended.length ? visibleRecommended : []).map((card, index) => (
              <Link
                key={card.slug}
                to={`/discover/${card.slug}`}
                className="glass-card group block cursor-pointer rounded-[2rem] p-3"
                onClick={() => trackRecommendedClick(card, index + 1)}
              >
                <div className="relative mb-4 aspect-[16/10] overflow-hidden rounded-[2rem] shadow-lg">
                  <img
                    src={pickTopicImage(card)}
                    alt={card.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-6">
                    <span className="rounded-full border border-white/30 bg-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur-md">
                      {topicLabel(card.topic)}
                    </span>
                  </div>
                </div>
                <h3 className="mb-2 px-1 text-3xl font-bold leading-snug text-slate-900 transition-colors group-hover:text-teal-700">
                  {card.title}
                </h3>
                <div className="px-1 pb-1 text-sm font-semibold text-slate-800">{card.read_time_min || 1} min</div>
              </Link>
            ))}
            {!visibleRecommended.length ? (
              <div className="glass-card rounded-[2rem] p-6 text-sm font-medium text-slate-700">
                Nu sunt recomandari disponibile acum. Deschide Discover pentru ultimele articole.
              </div>
            ) : null}
          </div>

          <div className="mt-10 rounded-[2.5rem] border border-teal-300/70 bg-gradient-to-r from-teal-200 to-emerald-200 p-8 text-slate-900 shadow-[0_16px_36px_rgba(15,118,110,0.2)]">
            <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
              <div>
                <h4 className="mb-2 text-xl font-bold">Scorul tau de aderenta: {adherenceScore}%</h4>
                <p className="max-w-sm text-base text-slate-800">
                  {user
                    ? `${monitoring.unreadCount} notificari active, ${checkinStreak} zile streak si ${summary?.eventsCount || 0} interactiuni in ultimele 7 zile.`
                    : "Activeaza contul ca sa vezi scorul de monitorizare in timp real."}
                </p>
              </div>
              <Link to="/plan">
                <Button
                  variant="outline"
                  className="h-auto rounded-xl border-teal-400 bg-white/95 px-6 py-3 text-base font-extrabold text-teal-900 hover:bg-white"
                >
                  Vezi planul personalizat
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {monitoring.loading ? <div className="text-sm font-medium text-slate-700">Se actualizeaza monitorizarea...</div> : null}
    </div>
  );
}
