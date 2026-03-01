import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { generatePlan, getLatestLabs, getPlanById, getPlans, getProfile, logUserEvent } from "@/lib/backend-api";
import { useAuth } from "@/lib/AuthContext";
import FitnessSection from "@/components/plan/FitnessSection";
import LabsSection from "@/components/plan/LabsSection";
import NutritionSection from "@/components/plan/NutritionSection";
import PlanBadges from "@/components/plan/PlanBadges";
import ShoppingSection from "@/components/plan/ShoppingSection";
import SummarySection from "@/components/plan/SummarySection";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PlanExportButton = lazy(() => import("@/components/plan/PlanExportButton"));

function KpiCard({ title, value, note }) {
  return (
    <div className="kpi-tile">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-600">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {note ? <p className="mt-1 text-xs text-slate-600">{note}</p> : null}
    </div>
  );
}

function MacroRow({ label, value, unit, progress, tone }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-700">{label}</span>
        <span className="font-medium text-slate-900">
          {value}
          {unit}
        </span>
      </div>
      <div className="chart-track">
        <div className={tone} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export default function ViewPlan() {
  const { accessToken } = useAuth();
  const [profile, setProfile] = useState(null);
  const [planRecord, setPlanRecord] = useState(null);
  const [latestLabsRecord, setLatestLabsRecord] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let mounted = true;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const [profileResp, plansResp, labsResp] = await Promise.all([
          getProfile(accessToken),
          getPlans(accessToken),
          getLatestLabs(accessToken),
        ]);
        if (!mounted) return;

        setProfile(profileResp.profile || null);
        setLatestLabsRecord(labsResp?.labs || null);

        const latest = plansResp.plans?.[0];
        if (latest) {
          const latestPlan = await getPlanById(accessToken, latest.id);
          if (!mounted) return;
          setPlanRecord(latestPlan.plan || null);
        }
      } catch (err) {
        if (!mounted) return;
        setError(err.message || "Nu am putut incarca datele");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [accessToken]);

  const handleRegenerate = async () => {
    if (!accessToken) return;
    setRegenerating(true);
    setError("");

    try {
      const response = await generatePlan(accessToken);
      setPlanRecord(response.plan || null);
      if (response.plan?.profile_snapshot) setProfile(response.plan.profile_snapshot);
      if (response.plan?.labs_snapshot) setLatestLabsRecord({ extracted_json: response.plan.labs_snapshot });
      logUserEvent(accessToken, {
        eventName: "plan_regenerated",
        page: "/plan",
        metadata: { hasLabsSnapshot: Boolean(response.plan?.labs_snapshot) },
      }).catch(() => {});
    } catch (err) {
      setError(err.message || "Nu s-a putut regenera planul");
      logUserEvent(accessToken, {
        eventName: "plan_regenerate_failed",
        page: "/plan",
        metadata: { message: err.message || "unknown_error" },
      }).catch(() => {});
    } finally {
      setRegenerating(false);
    }
  };

  const plan = planRecord?.plan_json || null;
  const labsSnapshotFromPlan = planRecord?.labs_snapshot || null;
  const latestLabsSnapshot = latestLabsRecord?.extracted_json || null;
  const labsSnapshot = labsSnapshotFromPlan || latestLabsSnapshot || null;

  useEffect(() => {
    if (!accessToken) return;
    logUserEvent(accessToken, {
      eventName: "plan_page_state",
      page: "/plan",
      metadata: { hasPlan: Boolean(planRecord?.id), hasLabsSnapshot: Boolean(labsSnapshot) },
    }).catch(() => {});
  }, [accessToken, planRecord?.id, labsSnapshot]);

  const macroProgress = useMemo(() => {
    if (!plan?.targets) return null;
    return {
      protein: Math.min(100, Math.round((plan.targets.protein / 220) * 100)),
      carbs: Math.min(100, Math.round((plan.targets.carbs / 360) * 100)),
      fat: Math.min(100, Math.round((plan.targets.fat / 130) * 100)),
      fibre: Math.min(100, Math.round((plan.targets.fibre / 50) * 100)),
    };
  }, [plan]);

  if (loading) return <div className="surface-card rounded-2xl border border-white/70 p-6">Se incarca datele...</div>;

  if (!profile) {
    return (
      <Card className="neo-border rounded-3xl">
        <CardHeader>
          <CardTitle>Profil lipsa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">Completeaza profilul in wizard pentru a putea genera planul.</p>
          <Link to="/wizard">
            <Button>Deschide Wizard</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const weight = profile.weight_kg || profile.weightKg;
  const orbitDegree = Math.round(((macroProgress?.protein || 0) / 100) * 360);

  return (
    <div className="space-y-6">
      <Card className="gradient-loop overflow-hidden border-white/70">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Plan workspace</p>
            <CardTitle className="mt-1 text-3xl">Planul tau personalizat</CardTitle>
            <p className="mt-2 text-sm text-slate-700">
              {planRecord?.created_at ? `Ultima generare: ${new Date(planRecord.created_at).toLocaleString()}` : "Inca nu exista plan"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/wizard">
              <Button variant="outline" className="border-emerald-200 bg-white/90">Editeaza profil</Button>
            </Link>
            <Button onClick={handleRegenerate} disabled={regenerating}>
              {regenerating ? "Se regenereaza..." : "Regeneraza"}
            </Button>
            {plan ? (
              <Suspense fallback={<Button variant="secondary" disabled>Pregatire PDF...</Button>}>
                <PlanExportButton profile={profile} plan={plan} />
              </Suspense>
            ) : null}
          </div>
        </CardHeader>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Eroare</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!plan ? (
        <Card className="neo-border rounded-3xl">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600">Nu exista plan generat pentru acest utilizator.</p>
            <Button className="mt-3" onClick={handleRegenerate} disabled={regenerating}>
              {regenerating ? "Se genereaza..." : "Genereaza primul plan"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <PlanBadges hasLabs={Boolean(labsSnapshot)} />

          {!labsSnapshotFromPlan && latestLabsSnapshot ? (
            <Alert>
              <AlertTitle>Analize disponibile</AlertTitle>
              <AlertDescription>
                Analizele sunt incarcate, dar planul curent a fost generat inainte de upload. Apasa "Regeneraza" pentru integrare.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <Card className="neo-border rounded-3xl">
              <CardHeader>
                <CardTitle>KPI metabolici</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <KpiCard title="BMR" value={plan.targets.bmr} note="Energie de baza" />
                <KpiCard title="TDEE" value={plan.targets.tdee} note="Consum total" />
                <KpiCard title="Tinta calorica" value={`${plan.targets.kcal} kcal`} note="Obiectiv zilnic" />
                <KpiCard title="Greutate" value={`${weight} kg`} note="Snapshot profil" />
              </CardContent>
            </Card>

            <Card className="neo-border rounded-3xl">
              <CardHeader>
                <CardTitle>Protein focus</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-3">
                <div className="plan-orbit" style={{ "--orbit-degree": `${orbitDegree}deg` }}>
                  <div className="plan-orbit-label">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Proteine</p>
                    <p className="text-xl font-semibold text-slate-900">{macroProgress?.protein || 0}%</p>
                  </div>
                </div>
                <p className="text-center text-xs text-slate-600">
                  Gradul de acoperire al proteinei raportat la plafonul de referinta.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="neo-border rounded-3xl">
            <CardHeader>
              <CardTitle>Macronutrienti zilnici</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <MacroRow label="Proteine" value={plan.targets.protein} unit=" g" progress={macroProgress.protein} tone="chart-fill" />
              <MacroRow label="Carbohidrati" value={plan.targets.carbs} unit=" g" progress={macroProgress.carbs} tone="chart-fill-alt" />
              <MacroRow label="Grasimi" value={plan.targets.fat} unit=" g" progress={macroProgress.fat} tone="chart-fill-warm" />
              <MacroRow label="Fibre" value={plan.targets.fibre} unit=" g" progress={macroProgress.fibre} tone="chart-fill" />
            </CardContent>
          </Card>

          <Tabs defaultValue="summary">
            <TabsList>
              <TabsTrigger value="summary">Rezumat</TabsTrigger>
              <TabsTrigger value="labs">Analize</TabsTrigger>
              <TabsTrigger value="nutrition">Alimentatie</TabsTrigger>
              <TabsTrigger value="fitness">Fitness</TabsTrigger>
              <TabsTrigger value="shopping">Cumparaturi</TabsTrigger>
            </TabsList>

            <TabsContent value="summary">
              <SummarySection plan={plan} />
            </TabsContent>
            <TabsContent value="labs">
              <LabsSection labs={labsSnapshot} />
            </TabsContent>
            <TabsContent value="nutrition">
              <NutritionSection weeklyPlan={plan.weeklyPlan} />
            </TabsContent>
            <TabsContent value="fitness">
              <FitnessSection fitness={plan.fitness} />
            </TabsContent>
            <TabsContent value="shopping">
              <ShoppingSection shoppingList={plan.shoppingList} />
            </TabsContent>
          </Tabs>

          <Card className="neo-border rounded-3xl">
            <CardContent className="pt-6 text-sm text-slate-700">
              Acest plan este informativ si nu inlocuieste consultul medical/nutritionist.
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
