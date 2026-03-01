import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  dispatchNotifications,
  dismissNotification,
  getNotificationPreferences,
  getNotifications,
  logUserEvent,
  markAllNotificationsRead,
  markNotificationRead,
  upsertNotificationPreferences,
} from "@/lib/backend-api";
import { useAuth } from "@/lib/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const toneClassBySeverity = {
  high: "border-l-rose-400 bg-rose-50/80",
  medium: "border-l-amber-400 bg-amber-50/80",
  low: "border-l-teal-400 bg-teal-50/80",
};

const statusLabel = {
  unread: "Noi",
  read: "Citite",
  dismissed: "Inchise",
};

const defaultPrefs = {
  email: "",
  emailEnabled: false,
  pushEnabled: true,
  timezone: "Europe/Bucharest",
  quietHoursStart: 22,
  quietHoursEnd: 7,
  weeklyDigestEnabled: true,
  weeklyDigestDay: 1,
  weeklyDigestHour: 9,
};

const weekDays = [
  { value: 0, label: "Duminica" },
  { value: 1, label: "Luni" },
  { value: 2, label: "Marti" },
  { value: 3, label: "Miercuri" },
  { value: 4, label: "Joi" },
  { value: 5, label: "Vineri" },
  { value: 6, label: "Sambata" },
];

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ro-RO", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function NotificationsCenter() {
  const { accessToken, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [actionBusyId, setActionBusyId] = useState("");
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("unread");
  const [notifications, setNotifications] = useState([]);
  const [preferences, setPreferences] = useState(defaultPrefs);

  const unreadCount = useMemo(() => notifications.filter((item) => item.status === "unread").length, [notifications]);

  const loadData = async (filterStatus) => {
    if (!accessToken) return;
    const [notificationsResp, preferencesResp] = await Promise.all([
      getNotifications(accessToken, { status: filterStatus, limit: 60 }),
      getNotificationPreferences(accessToken),
    ]);
    setNotifications(notificationsResp.notifications || []);
    setPreferences({
      ...defaultPrefs,
      ...(preferencesResp.preferences || {}),
      email: preferencesResp.preferences?.email || user?.email || "",
    });
  };

  useEffect(() => {
    if (!accessToken) return;
    let mounted = true;
    setLoading(true);
    setError("");

    loadData(statusFilter)
      .then(async () => {
        if (!mounted) return;
        await logUserEvent(accessToken, {
          eventName: "notifications_center_open",
          page: "/notifications",
          metadata: { filter: statusFilter },
        });
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || "Nu am putut incarca notificarile.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [accessToken, statusFilter, user?.email]);

  const reload = async (filterStatus = statusFilter) => {
    setError("");
    await loadData(filterStatus);
  };

  const runDispatch = async () => {
    if (!accessToken) return;
    setRefreshing(true);
    setError("");
    try {
      await dispatchNotifications(accessToken);
      await reload("unread");
      setStatusFilter("unread");
      window.dispatchEvent(new Event("nutrifit:notifications-changed"));
    } catch (err) {
      setError(err.message || "Nu am putut genera notificarile automate.");
    } finally {
      setRefreshing(false);
    }
  };

  const onMarkRead = async (notificationId) => {
    if (!accessToken || !notificationId) return;
    setActionBusyId(notificationId);
    try {
      await markNotificationRead(accessToken, notificationId);
      await reload();
      window.dispatchEvent(new Event("nutrifit:notifications-changed"));
    } catch (err) {
      setError(err.message || "Nu am putut marca notificarea ca citita.");
    } finally {
      setActionBusyId("");
    }
  };

  const onDismiss = async (notificationId) => {
    if (!accessToken || !notificationId) return;
    setActionBusyId(notificationId);
    try {
      await dismissNotification(accessToken, notificationId);
      await reload();
      window.dispatchEvent(new Event("nutrifit:notifications-changed"));
    } catch (err) {
      setError(err.message || "Nu am putut inchide notificarea.");
    } finally {
      setActionBusyId("");
    }
  };

  const onMarkAllRead = async () => {
    if (!accessToken) return;
    setRefreshing(true);
    try {
      await markAllNotificationsRead(accessToken);
      await reload();
      window.dispatchEvent(new Event("nutrifit:notifications-changed"));
    } catch (err) {
      setError(err.message || "Nu am putut marca notificarile ca citite.");
    } finally {
      setRefreshing(false);
    }
  };

  const onSavePreferences = async () => {
    if (!accessToken) return;
    setSavingPrefs(true);
    setError("");
    try {
      const payload = {
        email: preferences.email || "",
        emailEnabled: Boolean(preferences.emailEnabled),
        pushEnabled: Boolean(preferences.pushEnabled),
        timezone: preferences.timezone || "Europe/Bucharest",
        quietHoursStart: Number(preferences.quietHoursStart),
        quietHoursEnd: Number(preferences.quietHoursEnd),
        weeklyDigestEnabled: Boolean(preferences.weeklyDigestEnabled),
        weeklyDigestDay: Number(preferences.weeklyDigestDay),
        weeklyDigestHour: Number(preferences.weeklyDigestHour),
      };
      const response = await upsertNotificationPreferences(accessToken, payload);
      setPreferences((prev) => ({ ...prev, ...(response.preferences || {}) }));
    } catch (err) {
      setError(err.message || "Nu am putut salva preferintele.");
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Centru de notificari si setari</h1>
        <p className="mt-2 text-slate-500">
          Ramaneti la curent cu obiectivele de sanatate si configurati modul de livrare.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-semibold text-slate-800">Mesaje receptionate</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onMarkAllRead} disabled={refreshing}>
                Marcheaza tot citit
              </Button>
              <Button onClick={runDispatch} disabled={refreshing}>
                {refreshing ? "Se proceseaza..." : "Genereaza"}
              </Button>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="unread">Doar necitite</option>
                <option value="read">Doar citite</option>
                <option value="dismissed">Doar inchise</option>
                <option value="all">Toate</option>
              </Select>
              <Button variant="outline" onClick={() => reload()} disabled={loading || refreshing}>
                Refresh
              </Button>
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Eroare</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {loading ? <div className="glass-card rounded-2xl p-5 text-sm text-slate-600">Se incarca notificarile...</div> : null}

          {!loading && !notifications.length ? (
            <div className="glass-card rounded-2xl p-5 text-sm text-slate-600">Inbox gol pentru filtrul selectat.</div>
          ) : null}

          <div className="space-y-4">
            {notifications.map((item) => (
              <article
                key={item.id}
                className={`glass-card group flex gap-4 rounded-2xl border-l-4 p-4 transition-all hover:bg-white/90 ${toneClassBySeverity[item.severity] || toneClassBySeverity.low}`}
              >
                <div className="flex-grow">
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold text-slate-800">{item.title}</h4>
                    <span className="text-[10px] font-medium text-slate-400">{formatTime(item.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.message}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link to={item.actionPath || "/"}>
                      <Button size="sm">{item.actionLabel || "Deschide"}</Button>
                    </Link>
                    {item.status === "unread" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onMarkRead(item.id)}
                        disabled={actionBusyId === item.id}
                      >
                        {actionBusyId === item.id ? "..." : "Marcheaza citit"}
                      </Button>
                    ) : null}
                    {item.status !== "dismissed" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDismiss(item.id)}
                        disabled={actionBusyId === item.id}
                      >
                        {actionBusyId === item.id ? "..." : "Inchide"}
                      </Button>
                    ) : null}
                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase text-slate-500">
                      {statusLabel[item.status] || item.status}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="glass-card sticky top-24 rounded-3xl p-8">
            <h2 className="mb-8 text-lg font-bold text-slate-800">Preferinte notificari</h2>
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Canale</p>
                <Input
                  type="email"
                  value={preferences.email || ""}
                  onChange={(event) => setPreferences((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="email@exemplu.ro"
                />
                <Select
                  value={preferences.emailEnabled ? "true" : "false"}
                  onChange={(event) => setPreferences((prev) => ({ ...prev, emailEnabled: event.target.value === "true" }))}
                >
                  <option value="true">Email activat</option>
                  <option value="false">Email dezactivat</option>
                </Select>
                <Select
                  value={preferences.pushEnabled ? "true" : "false"}
                  onChange={(event) => setPreferences((prev) => ({ ...prev, pushEnabled: event.target.value === "true" }))}
                >
                  <option value="true">Push activat</option>
                  <option value="false">Push dezactivat</option>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Liniste si focus</p>
                <Select
                  value={preferences.timezone || "Europe/Bucharest"}
                  onChange={(event) => setPreferences((prev) => ({ ...prev, timezone: event.target.value }))}
                >
                  <option value="Europe/Bucharest">Europe/Bucharest</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="America/Chicago">America/Chicago</option>
                  <option value="America/Los_Angeles">America/Los_Angeles</option>
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={String(preferences.quietHoursStart ?? 22)}
                    onChange={(event) => setPreferences((prev) => ({ ...prev, quietHoursStart: Number(event.target.value) }))}
                  >
                    {Array.from({ length: 24 }).map((_, hour) => (
                      <option key={`start-${hour}`} value={hour}>{`${hour}:00`}</option>
                    ))}
                  </Select>
                  <Select
                    value={String(preferences.quietHoursEnd ?? 7)}
                    onChange={(event) => setPreferences((prev) => ({ ...prev, quietHoursEnd: Number(event.target.value) }))}
                  >
                    {Array.from({ length: 24 }).map((_, hour) => (
                      <option key={`end-${hour}`} value={hour}>{`${hour}:00`}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Digest saptamanal</p>
                <Select
                  value={preferences.weeklyDigestEnabled ? "true" : "false"}
                  onChange={(event) =>
                    setPreferences((prev) => ({ ...prev, weeklyDigestEnabled: event.target.value === "true" }))
                  }
                >
                  <option value="true">Digest activat</option>
                  <option value="false">Digest dezactivat</option>
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={String(preferences.weeklyDigestDay ?? 1)}
                    onChange={(event) => setPreferences((prev) => ({ ...prev, weeklyDigestDay: Number(event.target.value) }))}
                  >
                    {weekDays.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={String(preferences.weeklyDigestHour ?? 9)}
                    onChange={(event) =>
                      setPreferences((prev) => ({ ...prev, weeklyDigestHour: Number(event.target.value) }))
                    }
                  >
                    {Array.from({ length: 24 }).map((_, hour) => (
                      <option key={`digest-${hour}`} value={hour}>{`${hour}:00`}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <Button className="w-full" onClick={onSavePreferences} disabled={savingPrefs}>
                {savingPrefs ? "Se salveaza..." : "Salveaza preferintele"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-4 text-sm text-slate-600">
        Necitite in lista curenta: <strong>{unreadCount}</strong>
      </div>
    </div>
  );
}
