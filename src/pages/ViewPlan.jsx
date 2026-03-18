import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  activateSubscription,
  cancelSubscription,
  generatePlan,
  getBillingPlans,
  getLatestLabs,
  getMySubscription,
  getPlanById,
  getPlans,
  getProfile,
  logUserEvent,
  reactivateSubscription,
} from "@/lib/backend-api";
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

const DEFAULT_DAY_NAMES = ["Luni", "Marti", "Miercuri", "Joi", "Vineri", "Sambata", "Duminica"];

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringifyValue(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (Array.isArray(value)) {
    return value
      .map((item) => stringifyValue(item))
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${stringifyValue(item)}`)
      .filter((item) => !item.endsWith(": "))
      .join(", ");
  }

  return "";
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => stringifyValue(item)).filter(Boolean);
}

function normalizeMeals(rawMeals) {
  if (Array.isArray(rawMeals)) {
    return rawMeals
      .map((meal, index) => ({
        slot: String(meal?.slot || meal?.name || `Masa ${index + 1}`),
        foods: Array.isArray(meal?.foods)
          ? meal.foods.map((item) => String(item || "").trim()).filter(Boolean)
          : [],
      }))
      .filter((meal) => meal.foods.length > 0);
  }

  if (rawMeals && typeof rawMeals === "object") {
    return Object.entries(rawMeals)
      .map(([key, meal]) => ({
        slot: String(meal?.slot || key || "Masa"),
        foods: Array.isArray(meal?.foods)
          ? meal.foods.map((item) => String(item || "").trim()).filter(Boolean)
          : [],
      }))
      .filter((meal) => meal.foods.length > 0);
  }

  return [];
}

function normalizeWeeklyPlan(rawWeeklyPlan) {
  if (Array.isArray(rawWeeklyPlan)) {
    return rawWeeklyPlan
      .map((day, index) => ({
        day: String(day?.day || day?.name || DEFAULT_DAY_NAMES[index] || `Ziua ${index + 1}`),
        meals: normalizeMeals(day?.meals),
      }))
      .filter((day) => day.meals.length > 0);
  }

  if (rawWeeklyPlan && typeof rawWeeklyPlan === "object") {
    return Object.entries(rawWeeklyPlan)
      .map(([key, day], index) => ({
        day: String(day?.day || day?.name || key || DEFAULT_DAY_NAMES[index] || `Ziua ${index + 1}`),
        meals: normalizeMeals(day?.meals || day),
      }))
      .filter((day) => day.meals.length > 0);
  }

  return [];
}

function hasUsefulQuantity(value) {
  const text = stringifyValue(value).trim();
  if (!text) return false;
  const normalized = text.toLowerCase();
  return normalized !== "-" && normalized !== "n/a" && normalized !== "necunoscut";
}

const QUANTITY_UNIT_PATTERN =
  "(kg|g|gr|gram|grame|ml|l|buc|bucata|bucati|felie|felii|lingura|linguri|lingurita|lingurite|cana|cani|pumn|pumni)";
const QUANTITY_PREFIX_REGEX = new RegExp(
  `^(\\d+(?:[.,]\\d+)?(?:\\s*-\\s*\\d+(?:[.,]\\d+)?)?|\\d+\\/\\d+)\\s*${QUANTITY_UNIT_PATTERN}\\b(?:\\s+de)?\\s*(.+)$`,
  "i",
);
const QUANTITY_SUFFIX_REGEX = new RegExp(
  `^(.+?)\\s*(\\d+(?:[.,]\\d+)?(?:\\s*-\\s*\\d+(?:[.,]\\d+)?)?|\\d+\\/\\d+)\\s*${QUANTITY_UNIT_PATTERN}\\b$`,
  "i",
);
const UNIT_ALIASES = {
  kg: "g",
  g: "g",
  gr: "g",
  gram: "g",
  grame: "g",
  l: "ml",
  ml: "ml",
  buc: "buc",
  bucata: "buc",
  bucati: "buc",
  felie: "felie",
  felii: "felie",
  lingura: "lingura",
  linguri: "lingura",
  lingurita: "lingurita",
  lingurite: "lingurita",
  cana: "cana",
  cani: "cana",
  pumn: "pumn",
  pumni: "pumn",
};

function stripDiacriticsText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseQuantityToken(raw) {
  const token = String(raw || "").trim().replace(/\s+/g, "");
  if (!token) return null;

  if (/^\d+\/\d+$/.test(token)) {
    const [left, right] = token.split("/").map((part) => Number(part));
    if (!right) return null;
    return left / right;
  }

  if (token.includes("-")) {
    const values = token
      .split("-")
      .map((part) => Number(part.replace(",", ".")))
      .filter((value) => Number.isFinite(value));
    if (!values.length) return null;
    return Math.max(...values);
  }

  const numeric = Number(token.replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeQuantityUnit(rawUnit) {
  const normalized = stripDiacriticsText(String(rawUnit || "").toLowerCase());
  const canonical = UNIT_ALIASES[normalized] || normalized || "buc";
  if (normalized === "kg") return { unit: canonical, multiplier: 1000 };
  if (normalized === "l") return { unit: canonical, multiplier: 1000 };
  return { unit: canonical, multiplier: 1 };
}

function normalizeIngredientLabel(raw) {
  return String(raw || "")
    .replace(/^\[\s*\]\s*/g, "")
    .replace(/^[\-\*\s]+/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+si\s*$/i, "")
    .trim();
}

function splitFoodSegments(rawText) {
  const text = String(rawText || "");
  const result = [];
  let current = "";
  let depth = 0;

  for (const char of text) {
    if (char === "(") depth += 1;
    if (char === ")" && depth > 0) depth -= 1;

    if ((char === "," || char === ";" || char === "\n") && depth === 0) {
      const segment = current.trim();
      if (segment) result.push(segment);
      current = "";
      continue;
    }

    current += char;
  }

  const tail = current.trim();
  if (tail) result.push(tail);
  return result;
}

function parseSegmentWithQuantity(segment) {
  const normalized = normalizeIngredientLabel(segment);
  if (!normalized) return null;

  const normalizedForParsing = stripDiacriticsText(normalized);

  const parenthesesMatch = normalizedForParsing.match(/^(.*)\(([^)]*)\)(.*)$/);
  if (parenthesesMatch) {
    const before = normalizeIngredientLabel(parenthesesMatch[1]);
    const inside = normalizeIngredientLabel(parenthesesMatch[2]);
    const after = normalizeIngredientLabel(parenthesesMatch[3]);
    const composedName = normalizeIngredientLabel(`${before} ${after}`);
    const insideMatch = inside.match(QUANTITY_PREFIX_REGEX) || inside.match(QUANTITY_SUFFIX_REGEX);
    if (insideMatch && composedName) {
      const quantityRaw = insideMatch[1] && insideMatch[2] ? insideMatch[1] : insideMatch[2];
      const unitRaw = insideMatch[2] && insideMatch[3] ? insideMatch[2] : insideMatch[3];
      const quantity = parseQuantityToken(quantityRaw);
      if (quantity !== null) {
        const { unit, multiplier } = normalizeQuantityUnit(unitRaw);
        return { item: composedName, quantity: quantity * multiplier, unit };
      }
    }
  }

  const prefixMatch = normalizedForParsing.match(QUANTITY_PREFIX_REGEX);
  if (prefixMatch) {
    const quantity = parseQuantityToken(prefixMatch[1]);
    if (quantity !== null) {
      const { unit, multiplier } = normalizeQuantityUnit(prefixMatch[2]);
      return { item: normalizeIngredientLabel(prefixMatch[3]), quantity: quantity * multiplier, unit };
    }
  }

  const suffixMatch = normalizedForParsing.match(QUANTITY_SUFFIX_REGEX);
  if (suffixMatch) {
    const quantity = parseQuantityToken(suffixMatch[2]);
    if (quantity !== null) {
      const { unit, multiplier } = normalizeQuantityUnit(suffixMatch[3]);
      return { item: normalizeIngredientLabel(suffixMatch[1]), quantity: quantity * multiplier, unit };
    }
  }

  const onePrefixMatch = normalizedForParsing.match(/^(un|o)\s+(pumn|felie|lingura|lingurita|cana|ou|oua)\b(?:\s+de)?\s*(.*)$/i);
  if (onePrefixMatch) {
    const rawUnit = onePrefixMatch[2];
    const unit = /ou|oua/i.test(rawUnit) ? "buc" : normalizeQuantityUnit(rawUnit).unit;
    const rest = normalizeIngredientLabel(onePrefixMatch[3]);
    const item = rest || (/ou|oua/i.test(rawUnit) ? "oua" : rawUnit);
    return { item, quantity: 1, unit };
  }

  const plainNumericPrefix = normalizedForParsing.match(/^(\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?|\d+\/\d+)\s+(.+)$/i);
  if (plainNumericPrefix) {
    const quantity = parseQuantityToken(plainNumericPrefix[1]);
    if (quantity !== null) {
      return { item: normalizeIngredientLabel(plainNumericPrefix[2]), quantity, unit: "buc" };
    }
  }

  return null;
}

function formatQuantityValue(value) {
  if (!Number.isFinite(value)) return "1";
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 0.001) return String(Math.round(rounded));
  return String(rounded).replace(/\.0+$/, "");
}

function formatQuantityLabel(quantity, unit) {
  const value = formatQuantityValue(quantity);
  if (unit === "g" || unit === "ml") return `${value} ${unit}`;
  if (unit === "buc") return `${value} buc`;
  if (unit === "felie") return `${value} ${Number(value) === 1 ? "felie" : "felii"}`;
  if (unit === "lingura") return `${value} ${Number(value) === 1 ? "lingura" : "linguri"}`;
  if (unit === "lingurita") return `${value} ${Number(value) === 1 ? "lingurita" : "lingurite"}`;
  if (unit === "cana") return `${value} ${Number(value) === 1 ? "cana" : "cani"}`;
  if (unit === "pumn") return `${value} ${Number(value) === 1 ? "pumn" : "pumni"}`;
  return `${value} ${unit || "buc"}`.trim();
}

function normalizeShoppingItem(rawItem) {
  if (rawItem && typeof rawItem === "object") {
    const item = stringifyValue(rawItem.item || rawItem.name || rawItem.product || rawItem.label || "");
    if (!item) return null;
    return {
      item,
      quantity: stringifyValue(rawItem.quantity || rawItem.amount || rawItem.qty || rawItem.portions || ""),
    };
  }

  const label = normalizeIngredientLabel(stringifyValue(rawItem));
  if (!label) return null;
  if (/^cantitate\s*:/i.test(label)) return null;
  const splitMatch = label.match(/^(.+?)\s*[-:]\s*(.+)$/);
  if (splitMatch) {
    return {
      item: normalizeIngredientLabel(splitMatch[1]),
      quantity: normalizeIngredientLabel(splitMatch[2]),
    };
  }
  return { item: label, quantity: "" };
}
function buildShoppingListFromWeeklyPlan(weeklyPlan) {
  const counter = new Map();

  const addEntry = (rawName, quantity, unit) => {
    const item = normalizeIngredientLabel(rawName);
    if (!item) return;
    const key = `${stripDiacriticsText(item).toLowerCase()}|${unit}`;
    const existing = counter.get(key);
    if (existing) {
      existing.quantity += quantity;
      return;
    }
    counter.set(key, { item, quantity, unit });
  };

  (weeklyPlan || []).forEach((day) => {
    (day.meals || []).forEach((meal) => {
      (meal.foods || []).forEach((foodEntry) => {
        splitFoodSegments(foodEntry).forEach((segment) => {
          const parsed = parseSegmentWithQuantity(segment);
          if (parsed && parsed.item) {
            addEntry(parsed.item, parsed.quantity, parsed.unit || "buc");
            return;
          }

          const fallbackItem = normalizeIngredientLabel(segment);
          if (!fallbackItem) return;
          addEntry(fallbackItem, 1, "portie");
        });
      });
    });
  });

  return Array.from(counter.values())
    .sort((left, right) => left.item.localeCompare(right.item, "ro", { sensitivity: "base" }))
    .map((entry) => ({
      item: entry.item,
      quantity: entry.unit === "portie" ? `${formatQuantityValue(entry.quantity)} portii` : formatQuantityLabel(entry.quantity, entry.unit),
    }));
}

function normalizePlan(rawPlan) {
  if (!rawPlan || typeof rawPlan !== "object") return null;

  const weeklyPlan = normalizeWeeklyPlan(rawPlan.weeklyPlan);
  const targets = rawPlan.targets && typeof rawPlan.targets === "object" ? rawPlan.targets : {};
  const notes = normalizeStringArray(rawPlan.notes);
  const fitness = normalizeStringArray(rawPlan.fitness);
  const parsedShoppingList = Array.isArray(rawPlan.shoppingList)
    ? rawPlan.shoppingList.map((item) => normalizeShoppingItem(item)).filter(Boolean)
    : [];
  const derivedShoppingList = buildShoppingListFromWeeklyPlan(weeklyPlan);
  const shoppingList = derivedShoppingList.length
    ? derivedShoppingList
    : parsedShoppingList.map((entry) => ({
      item: entry.item,
      quantity: hasUsefulQuantity(entry.quantity) ? entry.quantity : "1 buc",
    }));

  const summaryText = stringifyValue(rawPlan.summary);

  return {
    ...rawPlan,
    weeklyPlan,
    targets,
    notes,
    fitness,
    shoppingList,
    summary: summaryText || "Plan nutritional personalizat.",
  };
}

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
  const [subscriptionSnapshot, setSubscriptionSnapshot] = useState(null);
  const [billingPlans, setBillingPlans] = useState([]);
  const [subscriptionBusy, setSubscriptionBusy] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    let mounted = true;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const [profileResp, plansResp, labsResp, subscriptionResp, billingResp] = await Promise.all([
          getProfile(accessToken),
          getPlans(accessToken),
          getLatestLabs(accessToken),
          getMySubscription(accessToken).catch(() => null),
          getBillingPlans().catch(() => ({ plans: [] })),
        ]);
        if (!mounted) return;

        setProfile(profileResp.profile || null);
        setLatestLabsRecord(labsResp?.labs || null);
        if (subscriptionResp) setSubscriptionSnapshot(subscriptionResp);
        if (Array.isArray(billingResp?.plans)) setBillingPlans(billingResp.plans);

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
      const subscriptionResp = await getMySubscription(accessToken).catch(() => null);
      if (subscriptionResp) {
        setSubscriptionSnapshot(subscriptionResp);
        if (Array.isArray(subscriptionResp.plans)) setBillingPlans(subscriptionResp.plans);
      }
      logUserEvent(accessToken, {
        eventName: "plan_regenerated",
        page: "/plan",
        metadata: { hasLabsSnapshot: Boolean(response.plan?.labs_snapshot) },
      }).catch(() => {});
    } catch (err) {
      if (err?.code === "SUBSCRIPTION_REQUIRED" && err?.payload) {
        setSubscriptionSnapshot({
          subscription: err.payload.subscription || null,
          usage: err.payload.usage || null,
          plans: Array.isArray(err.payload.plans) ? err.payload.plans : [],
        });
        if (Array.isArray(err.payload.plans)) setBillingPlans(err.payload.plans);
      }
      setError(err.message || "Nu s-a putut regenera planul");
      logUserEvent(accessToken, {
        eventName: "plan_regenerate_failed",
        page: "/plan",
        metadata: { message: err.message || "unknown_error", code: err?.code || "" },
      }).catch(() => {});
    } finally {
      setRegenerating(false);
    }
  };

  const handleActivateSubscription = async () => {
    if (!accessToken) return;
    setSubscriptionBusy("activate");
    setError("");
    try {
      const response = await activateSubscription(accessToken, "pro_monthly");
      setSubscriptionSnapshot(response);
      if (Array.isArray(response?.plans)) setBillingPlans(response.plans);
    } catch (err) {
      setError(err.message || "Nu s-a putut activa abonamentul.");
    } finally {
      setSubscriptionBusy("");
    }
  };

  const handleCancelSubscription = async () => {
    if (!accessToken) return;
    setSubscriptionBusy("cancel");
    setError("");
    try {
      const response = await cancelSubscription(accessToken);
      setSubscriptionSnapshot(response);
      if (Array.isArray(response?.plans)) setBillingPlans(response.plans);
    } catch (err) {
      setError(err.message || "Nu s-a putut anula abonamentul.");
    } finally {
      setSubscriptionBusy("");
    }
  };

  const handleReactivateSubscription = async () => {
    if (!accessToken) return;
    setSubscriptionBusy("reactivate");
    setError("");
    try {
      const response = await reactivateSubscription(accessToken);
      setSubscriptionSnapshot(response);
      if (Array.isArray(response?.plans)) setBillingPlans(response.plans);
    } catch (err) {
      setError(err.message || "Nu s-a putut reactiva abonamentul.");
    } finally {
      setSubscriptionBusy("");
    }
  };

  const plan = planRecord?.plan_json || null;
  const labsSnapshotFromPlan = planRecord?.labs_snapshot || null;
  const latestLabsSnapshot = latestLabsRecord?.extracted_json || null;
  const labsSnapshot = labsSnapshotFromPlan || latestLabsSnapshot || null;
  const normalizedPlan = useMemo(() => normalizePlan(plan), [plan]);

  useEffect(() => {
    if (!accessToken) return;
    logUserEvent(accessToken, {
      eventName: "plan_page_state",
      page: "/plan",
      metadata: { hasPlan: Boolean(planRecord?.id), hasLabsSnapshot: Boolean(labsSnapshot) },
    }).catch(() => {});
  }, [accessToken, planRecord?.id, labsSnapshot]);

  const macroProgress = useMemo(() => {
    if (!normalizedPlan?.targets) return { protein: 0, carbs: 0, fat: 0, fibre: 0 };

    const protein = toFiniteNumber(normalizedPlan.targets.protein) || 0;
    const carbs = toFiniteNumber(normalizedPlan.targets.carbs) || 0;
    const fat = toFiniteNumber(normalizedPlan.targets.fat) || 0;
    const fibre = toFiniteNumber(normalizedPlan.targets.fibre) || 0;

    return {
      protein: Math.min(100, Math.round((protein / 220) * 100)),
      carbs: Math.min(100, Math.round((carbs / 360) * 100)),
      fat: Math.min(100, Math.round((fat / 130) * 100)),
      fibre: Math.min(100, Math.round((fibre / 50) * 100)),
    };
  }, [normalizedPlan]);

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
  const orbitDegree = Math.round(((macroProgress.protein || 0) / 100) * 360);
  const targets = normalizedPlan?.targets || {};
  const canExportPlan = Boolean(normalizedPlan?.weeklyPlan?.length);
  const subscriptionData = subscriptionSnapshot?.subscription || null;
  const usageData = subscriptionSnapshot?.usage || null;
  const availablePlans =
    Array.isArray(subscriptionSnapshot?.plans) && subscriptionSnapshot.plans.length
      ? subscriptionSnapshot.plans
      : billingPlans;
  const proPlan = availablePlans.find((item) => item.code === "pro_monthly") || null;
  const isProActive = Boolean(subscriptionData?.isActive && subscriptionData?.planCode !== "free");
  const periodEndDate = subscriptionData?.currentPeriodEnd ? new Date(subscriptionData.currentPeriodEnd) : null;
  const periodEndLabel =
    periodEndDate && !Number.isNaN(periodEndDate.getTime()) ? periodEndDate.toLocaleDateString("ro-RO") : "-";

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
            {normalizedPlan && canExportPlan ? (
              <Suspense fallback={<Button variant="secondary" disabled>Pregatire PDF...</Button>}>
                <PlanExportButton profile={profile} plan={normalizedPlan} />
              </Suspense>
            ) : null}
          </div>
        </CardHeader>
      </Card>

      <Card className="neo-border rounded-3xl">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Abonament</CardTitle>
            <p className="mt-1 text-sm text-slate-600">
              {isProActive ? "Pro lunar activ" : "Plan Free activ"}
            </p>
          </div>
          <span className="badge-pill">{isProActive ? "Pro lunar" : "Free"}</span>
        </CardHeader>
        <CardContent className="space-y-3">
          {usageData ? (
            usageData.monthlyLimit === null ? (
              <p className="text-sm text-slate-700">
                Planuri generate in perioada curenta: <span className="font-semibold text-slate-900">{usageData.plansGenerated}</span>
              </p>
            ) : (
              <p className="text-sm text-slate-700">
                Utilizare luna curenta:{" "}
                <span className="font-semibold text-slate-900">
                  {usageData.plansGenerated}/{usageData.monthlyLimit}
                </span>{" "}
                (ramase {usageData.remaining}).
              </p>
            )
          ) : (
            <p className="text-sm text-slate-700">Nu am putut incarca statusul abonamentului.</p>
          )}

          {isProActive ? (
            <p className="text-sm text-slate-600">
              Perioada curenta se incheie la {periodEndLabel}.
              {subscriptionData?.cancelAtPeriodEnd ? " Abonamentul este setat sa se opreasca la finalul perioadei." : ""}
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              Pentru regenerari nelimitate, activeaza Pro lunar
              {proPlan?.monthlyPrice ? ` (${proPlan.monthlyPrice} ${proPlan.currency}/luna)` : ""}.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {!isProActive ? (
              <Button onClick={handleActivateSubscription} disabled={subscriptionBusy === "activate"}>
                {subscriptionBusy === "activate"
                  ? "Se activeaza..."
                  : `Activeaza Pro lunar${proPlan?.monthlyPrice ? ` (${proPlan.monthlyPrice} ${proPlan.currency}/luna)` : ""}`}
              </Button>
            ) : subscriptionData?.cancelAtPeriodEnd ? (
              <Button variant="outline" onClick={handleReactivateSubscription} disabled={subscriptionBusy === "reactivate"}>
                {subscriptionBusy === "reactivate" ? "Se reactiveaza..." : "Reactiveaza abonamentul"}
              </Button>
            ) : (
              <Button variant="outline" onClick={handleCancelSubscription} disabled={subscriptionBusy === "cancel"}>
                {subscriptionBusy === "cancel" ? "Se proceseaza..." : "Anuleaza la finalul perioadei"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Eroare</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!normalizedPlan ? (
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
                <KpiCard title="BMR" value={toFiniteNumber(targets.bmr) ?? "-"} note="Energie de baza" />
                <KpiCard title="TDEE" value={toFiniteNumber(targets.tdee) ?? "-"} note="Consum total" />
                <KpiCard
                  title="Tinta calorica"
                  value={toFiniteNumber(targets.kcal) ? `${toFiniteNumber(targets.kcal)} kcal` : "-"}
                  note="Obiectiv zilnic"
                />
                <KpiCard title="Greutate" value={toFiniteNumber(weight) ? `${weight} kg` : "-"} note="Snapshot profil" />
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
                    <p className="text-xl font-semibold text-slate-900">{macroProgress.protein || 0}%</p>
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
              <MacroRow
                label="Proteine"
                value={toFiniteNumber(targets.protein) ?? 0}
                unit=" g"
                progress={macroProgress.protein}
                tone="chart-fill"
              />
              <MacroRow
                label="Carbohidrati"
                value={toFiniteNumber(targets.carbs) ?? 0}
                unit=" g"
                progress={macroProgress.carbs}
                tone="chart-fill-alt"
              />
              <MacroRow
                label="Grasimi"
                value={toFiniteNumber(targets.fat) ?? 0}
                unit=" g"
                progress={macroProgress.fat}
                tone="chart-fill-warm"
              />
              <MacroRow
                label="Fibre"
                value={toFiniteNumber(targets.fibre) ?? 0}
                unit=" g"
                progress={macroProgress.fibre}
                tone="chart-fill"
              />
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
              <SummarySection plan={normalizedPlan} />
            </TabsContent>
            <TabsContent value="labs">
              <LabsSection labs={labsSnapshot} />
            </TabsContent>
            <TabsContent value="nutrition">
              <NutritionSection weeklyPlan={normalizedPlan.weeklyPlan} />
            </TabsContent>
            <TabsContent value="fitness">
              <FitnessSection fitness={normalizedPlan.fitness} />
            </TabsContent>
            <TabsContent value="shopping">
              <ShoppingSection shoppingList={normalizedPlan.shoppingList} />
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
