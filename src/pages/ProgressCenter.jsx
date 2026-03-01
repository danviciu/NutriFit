import { useEffect, useMemo, useState } from "react";
import { getDailyCheckins, getProgressSummary, logUserEvent, upsertDailyCheckin } from "@/lib/backend-api";
import { useAuth } from "@/lib/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

function todaysDate() {
  return new Date().toISOString().slice(0, 10);
}

function StatCard({ title, value, hint, accent }) {
  return (
    <div className={`glass-card rounded-3xl border-b-4 p-6 ${accent}`}>
      <div className="text-2xl font-extrabold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{title}</div>
      {hint ? <div className="mt-2 text-xs font-medium text-slate-500">{hint}</div> : null}
    </div>
  );
}

export default function ProgressCenter() {
  const { accessToken } = useAuth();
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingCheckin, setSavingCheckin] = useState(false);
  const [payload, setPayload] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [checkinForm, setCheckinForm] = useState({
    checkinDate: todaysDate(),
    weightKg: "",
    sleepHours: "",
    energyLevel: "3",
    hungerLevel: "3",
    workoutDone: "false",
    notes: "",
  });

  useEffect(() => {
    if (!accessToken) return;
    let mounted = true;

    Promise.all([getProgressSummary(accessToken, days), getDailyCheckins(accessToken, days)])
      .then(([summaryResp, checkinsResp]) => {
        if (!mounted) return;
        setError("");
        setPayload(summaryResp);
        const rows = checkinsResp.checkins || [];
        setCheckins(rows);

        const latest = rows[0];
        if (latest) {
          setCheckinForm((prev) => ({
            ...prev,
            checkinDate: latest.checkin_date || prev.checkinDate,
            weightKg: latest.weight_kg ?? "",
            sleepHours: latest.sleep_hours ?? "",
            energyLevel: String(latest.energy_level ?? 3),
            hungerLevel: String(latest.hunger_level ?? 3),
            workoutDone: latest.workout_done ? "true" : "false",
            notes: latest.notes || "",
          }));
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || "Nu am putut incarca datele de progres.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [accessToken, days]);

  useEffect(() => {
    if (!accessToken) return;
    logUserEvent(accessToken, {
      eventName: "progress_dashboard_open",
      page: "/progress",
      metadata: { days },
    }).catch(() => {});
  }, [accessToken, days]);

  const maxDailyEvents = useMemo(() => {
    const series = payload?.dailyActivity || [];
    return series.reduce((max, point) => Math.max(max, point.events || 0), 1);
  }, [payload?.dailyActivity]);

  const summary = payload?.summary;
  const topActions = payload?.topActions || [];
  const latestCheckin = payload?.latestCheckin || checkins[0] || null;

  const handleCheckinChange = (field, value) => setCheckinForm((prev) => ({ ...prev, [field]: value }));

  const submitCheckin = async () => {
    if (!accessToken) return;
    setSavingCheckin(true);
    setError("");

    try {
      await upsertDailyCheckin(accessToken, {
        checkinDate: checkinForm.checkinDate || todaysDate(),
        weightKg: checkinForm.weightKg === "" ? undefined : Number(checkinForm.weightKg),
        sleepHours: checkinForm.sleepHours === "" ? undefined : Number(checkinForm.sleepHours),
        energyLevel: Number(checkinForm.energyLevel || 3),
        hungerLevel: Number(checkinForm.hungerLevel || 3),
        workoutDone: checkinForm.workoutDone === "true",
        notes: checkinForm.notes || "",
      });

      const [summaryResp, checkinsResp] = await Promise.all([
        getProgressSummary(accessToken, days),
        getDailyCheckins(accessToken, days),
      ]);
      setPayload(summaryResp);
      setCheckins(checkinsResp.checkins || []);
    } catch (err) {
      setError(err.message || "Nu am putut salva check-in-ul.");
    } finally {
      setSavingCheckin(false);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <header className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Centru de progres si statistici</h1>
          <p className="mt-2 text-lg text-slate-500">Evolutia ta personalizata pe baza check-in-urilor si activitatii.</p>
        </div>
        <div className="glass-card min-w-[220px] rounded-2xl p-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">Interval raport</p>
          <Select
            value={String(days)}
            onChange={(event) => {
              setLoading(true);
              setError("");
              setDays(Number(event.target.value));
            }}
          >
            <option value="7">Ultimele 7 zile</option>
            <option value="30">Ultimele 30 zile</option>
            <option value="60">Ultimele 60 zile</option>
            <option value="90">Ultimele 90 zile</option>
          </Select>
        </div>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Eroare</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? <div className="glass-card rounded-3xl p-6 text-sm text-slate-600">Se incarca datele de monitorizare...</div> : null}

      {!loading && summary ? (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard title="Aderenta" value={`${summary.adherenceScore || 0}%`} accent="border-b-emerald-400" />
            <StatCard title="Streak check-in" value={summary.checkinStreak || 0} accent="border-b-indigo-400" />
            <StatCard title="Check-in-uri" value={summary.checkinsCount || 0} accent="border-b-amber-400" />
            <StatCard title="Planuri generate" value={summary.planCount || 0} accent="border-b-rose-400" />
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="glass-card rounded-[2.5rem] p-10 text-center lg:col-span-4">
              <h3 className="mb-8 text-xl font-bold text-slate-800">Scor aderenta saptamanal</h3>
              <div className="relative mx-auto flex h-64 w-64 items-center justify-center">
                <svg className="h-full w-full -rotate-90">
                  <circle cx="128" cy="128" r="110" fill="transparent" stroke="currentColor" strokeWidth="12" className="text-slate-100" />
                  <circle
                    cx="128"
                    cy="128"
                    r="110"
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeDasharray="691"
                    strokeDashoffset={691 - Math.round((summary.adherenceScore || 0) * 6.91)}
                    className="text-emerald-500"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-6xl font-black text-slate-900">
                    {summary.adherenceScore || 0}
                    <span className="text-3xl text-emerald-500">%</span>
                  </span>
                  <span className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">Excelent</span>
                </div>
              </div>
              <div className="mt-10 grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                  <span className="block text-xl font-black text-emerald-600">{summary.checkinStreak || 0}</span>
                  <span className="text-xs font-semibold uppercase text-slate-500">Zile streak</span>
                </div>
                <div className="rounded-2xl border border-teal-100 bg-teal-50/50 p-4">
                  <span className="block text-xl font-black text-teal-600">{summary.eventsCount || 0}</span>
                  <span className="text-xs font-semibold uppercase text-slate-500">Evenimente</span>
                </div>
              </div>
            </div>

            <div className="space-y-8 lg:col-span-8">
              <div className="glass-card rounded-[2.5rem] p-8">
                <div className="mb-8 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">Trend activitate</h3>
                    <p className="text-sm text-slate-500">Ultimele {summary.daysWindow} zile</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {(payload.dailyActivity || []).map((point) => {
                    const width = Math.round(((point.events || 0) / maxDailyEvents) * 100);
                    const day = point.day.slice(5);
                    return (
                      <div key={point.day} className="grid grid-cols-[56px_1fr_52px] items-center gap-2 text-xs">
                        <span className="text-slate-500">{day}</span>
                        <div className="chart-track">
                          <div className="chart-fill" style={{ width: `${Math.max(point.events ? 8 : 2, width)}%` }} />
                        </div>
                        <span className="text-right font-semibold text-slate-800">
                          {point.events}
                          {point.checkin ? " | C" : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <StatCard title="Antrenamente" value={summary.workoutsDone || 0} hint="in perioada" accent="border-b-emerald-400" />
                <StatCard title="Foame medie" value={`${latestCheckin?.hunger_level ?? "-"} / 5`} accent="border-b-amber-400" />
                <StatCard title="Energie medie" value={`${latestCheckin?.energy_level ?? "-"} / 5`} accent="border-b-indigo-400" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="glass-card rounded-[2.5rem] p-8 lg:col-span-7">
              <h3 className="mb-6 text-xl font-bold text-slate-800">Check-in zilnic</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  type="date"
                  value={checkinForm.checkinDate}
                  onChange={(event) => handleCheckinChange("checkinDate", event.target.value)}
                />
                <Input
                  type="number"
                  step="0.1"
                  value={checkinForm.weightKg}
                  onChange={(event) => handleCheckinChange("weightKg", event.target.value)}
                  placeholder="Greutate (kg)"
                />
                <Input
                  type="number"
                  step="0.1"
                  value={checkinForm.sleepHours}
                  onChange={(event) => handleCheckinChange("sleepHours", event.target.value)}
                  placeholder="Somn (ore)"
                />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Select value={checkinForm.energyLevel} onChange={(event) => handleCheckinChange("energyLevel", event.target.value)}>
                  <option value="1">Energie 1</option>
                  <option value="2">Energie 2</option>
                  <option value="3">Energie 3</option>
                  <option value="4">Energie 4</option>
                  <option value="5">Energie 5</option>
                </Select>
                <Select value={checkinForm.hungerLevel} onChange={(event) => handleCheckinChange("hungerLevel", event.target.value)}>
                  <option value="1">Foame 1</option>
                  <option value="2">Foame 2</option>
                  <option value="3">Foame 3</option>
                  <option value="4">Foame 4</option>
                  <option value="5">Foame 5</option>
                </Select>
                <Select value={checkinForm.workoutDone} onChange={(event) => handleCheckinChange("workoutDone", event.target.value)}>
                  <option value="false">Fara antrenament</option>
                  <option value="true">Antrenament facut</option>
                </Select>
              </div>
              <Textarea
                className="mt-3"
                value={checkinForm.notes}
                onChange={(event) => handleCheckinChange("notes", event.target.value)}
                placeholder="Observatii check-in..."
              />
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-slate-500">Ultimul check-in: {latestCheckin?.checkin_date || "inca nu exista"}</p>
                <Button onClick={submitCheckin} disabled={savingCheckin}>
                  {savingCheckin ? "Se salveaza..." : "Salveaza check-in"}
                </Button>
              </div>
            </div>

            <div className="glass-card rounded-[2.5rem] p-8 lg:col-span-5">
              <h3 className="mb-6 text-xl font-bold text-slate-800">Top actiuni utilizator</h3>
              <div className="space-y-3">
                {!topActions.length ? <p className="text-sm text-slate-500">Nu exista actiuni inregistrate inca.</p> : null}
                {topActions.map((entry) => (
                  <div key={entry.name} className="rounded-2xl border border-teal-100 bg-white p-4">
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-400">{entry.name}</div>
                    <div className="mt-2 text-2xl font-extrabold text-slate-900">{entry.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
