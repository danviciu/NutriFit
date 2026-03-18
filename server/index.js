/* global process */
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mammoth from "mammoth";
import fs from "fs";
import { Buffer } from "node:buffer";
import path from "path";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import { createClient } from "@supabase/supabase-js";
import { extractLabsWithAI, generatePlanWithAI } from "./ai.js";
import { collectWeeklyContent, isHealthRelevantContentPayload } from "./content.js";
import { ensureSevenDayPlan, generateLocalPlan } from "./localPlan.js";
import {
  dailyCheckinSchema,
  notificationPreferencesSchema,
  profileSchema,
  subscriptionChangeSchema,
  userEventSchema,
} from "./schema.js";

dotenv.config({ path: "./server/.env" });
dotenv.config({ path: "./.env.local" });

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const NOTIFY_FROM_EMAIL = process.env.NOTIFY_FROM_EMAIL || "";
const AI_PLAN_REQUIRED = String(process.env.AI_PLAN_REQUIRED || "true").toLowerCase() !== "false";
const BILLING_CURRENCY = String(process.env.BILLING_CURRENCY || "RON").toUpperCase();
const PRO_MONTHLY_PRICE = Number.isFinite(Number(process.env.PRO_MONTHLY_PRICE))
  ? Math.max(1, Math.round(Number(process.env.PRO_MONTHLY_PRICE)))
  : 49;
const FREE_PLAN_MONTHLY_LIMIT = Number.isFinite(Number(process.env.FREE_PLAN_MONTHLY_LIMIT))
  ? Math.max(0, Math.round(Number(process.env.FREE_PLAN_MONTHLY_LIMIT)))
  : 2;
const PRO_PLAN_CODE = "pro_monthly";

function looksLikePlaceholder(value) {
  return !value || value.includes("your-") || value.includes("YOUR_");
}

const SUPABASE_SERVER_KEY = !looksLikePlaceholder(SUPABASE_SERVICE_ROLE_KEY)
  ? SUPABASE_SERVICE_ROLE_KEY
  : SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVER_KEY) {
  throw new Error("Missing SUPABASE_URL and a usable Supabase key (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY)");
}

if (!SUPABASE_SERVER_KEY.includes("eyJ")) {
  throw new Error("FATAL: SUPABASE_SERVER_KEY invalid (must be a valid JWT). Missing or invalid service/anon key.");
}

const supabaseServer = createClient(SUPABASE_URL, SUPABASE_SERVER_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function createUserClient(accessToken) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY || SUPABASE_SERVER_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

const app = express();

const tmpDir = path.join(process.cwd(), "server", "tmp");
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, tmpDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "6mb" }));

function isAcceptedFile(file) {
  if (!file) return false;

  const filename = (file.originalname || "").toLowerCase();
  const allowedExtension = filename.endsWith(".pdf") || filename.endsWith(".doc") || filename.endsWith(".docx");

  const allowedMime = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
  ].includes(file.mimetype);

  return allowedExtension && allowedMime;
}

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Bearer token" });
  }

  const token = authHeader.slice(7);
  const authClient = createUserClient(token);
  const { data, error } = await authClient.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({
      error: "Invalid token",
      detail:
        "JWT invalid pentru configuratia backend. Verifica server/.env: SUPABASE_URL + SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY din acelasi proiect cu frontend.",
    });
  }

  req.user = data.user;
  req.accessToken = token;
  req.sb = createUserClient(token);
  return next();
}

function sanitizeFileName(name) {
  return String(name || "file")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}

async function extractTextFromFile(file, inMemoryBuffer = null) {
  const lower = file.originalname.toLowerCase();
  const fileBuffer = Buffer.isBuffer(inMemoryBuffer) ? inMemoryBuffer : fs.readFileSync(file.path);

  if (lower.endsWith(".pdf")) {
    const parser = new PDFParse({ data: fileBuffer });
    const parsed = await parser.getText();
    await parser.destroy();

    const text = typeof parsed === "string" ? parsed : parsed?.text || "";
    return { text, sourceType: "pdf" };
  }

  if (lower.endsWith(".doc") || lower.endsWith(".docx")) {
    try {
      const parsed = await mammoth.extractRawText({ buffer: fileBuffer });
      return { text: parsed.value || "", sourceType: "docx" };
    } catch {
      // Fallback for unsupported legacy doc formats.
      return {
        // eslint-disable-next-line no-control-regex
        text: fileBuffer.toString("utf8").replace(/\u0000/g, " "),
        sourceType: "doc",
      };
    }
  }

  throw new Error("Unsupported file type");
}

async function getLatestProfile(client, userId) {
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getLatestLabs(client, userId) {
  const { data, error } = await client
    .from("labs_extracted")
    .select("id, extracted_json, confidence, extracted_at, document_id")
    .eq("user_id", userId)
    .order("extracted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const CONTENT_REFRESH_CHECK_MS = 6 * 60 * 60 * 1000;
const NOTIFICATION_CHECK_MS = 60 * 60 * 1000;
let contentRefreshInFlight = false;
let contentSeedCheckInFlight = false;
let lastContentSeedCheckAt = 0;
let notificationDispatchInFlight = false;

async function getLastContentRefreshRun() {
  const { data, error } = await supabaseServer
    .from("content_refresh_runs")
    .select("id, status, executed_at, items_count")
    .eq("status", "success")
    .order("executed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function logContentRefreshRun(status, itemsCount = 0, details = null) {
  const { error } = await supabaseServer.from("content_refresh_runs").insert({
    status,
    items_count: itemsCount,
    details,
    executed_at: new Date().toISOString(),
  });

  if (error) console.error("Failed to log content refresh run", error.message);
}

async function refreshWeeklyContent({ force = false } = {}) {
  if (contentRefreshInFlight) {
    return { skipped: true, reason: "in_progress" };
  }

  contentRefreshInFlight = true;
  try {
    const lastRun = await getLastContentRefreshRun();
    if (!force && lastRun?.executed_at) {
      const elapsed = Date.now() - new Date(lastRun.executed_at).getTime();
      if (elapsed < WEEK_MS) {
        return { skipped: true, reason: "fresh_content", lastRun };
      }
    }

    const entries = await collectWeeklyContent({ maxPerFeed: 6, maxItems: 24 });
    if (!entries.length) {
      await logContentRefreshRun("failed", 0, { reason: "no_entries_collected" });
      return { skipped: true, reason: "no_entries_collected" };
    }

    const { error } = await supabaseServer.from("content_items").upsert(entries, {
      onConflict: "source_url",
    });

    if (error) throw new Error(error.message);

    await logContentRefreshRun("success", entries.length, { force });
    return { ok: true, count: entries.length };
  } catch (error) {
    await logContentRefreshRun("failed", 0, { message: error.message || "refresh_failed" });
    throw error;
  } finally {
    contentRefreshInFlight = false;
  }
}

async function ensureContentSeeded() {
  const now = Date.now();
  if (contentSeedCheckInFlight || now - lastContentSeedCheckAt < 5 * 60 * 1000) return;

  contentSeedCheckInFlight = true;
  try {
    const { data, error } = await supabaseServer
      .from("content_items")
      .select("slug, title, summary, topic, tags")
      .eq("status", "published");

    if (error) throw new Error(error.message);
    const relevantCount = (data || []).filter((item) => isHealthRelevantContentPayload(item)).length;
    if (!relevantCount) await refreshWeeklyContent({ force: true });
    lastContentSeedCheckAt = now;
  } catch (error) {
    console.error("Failed to ensure content seed", error.message || error);
  } finally {
    contentSeedCheckInFlight = false;
  }
}

function toDayKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function dayKeyNDaysAgo(daysAgo) {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return toDayKey(date);
}

function computeCurrentStreak(daySet) {
  if (!daySet || !daySet.size) return 0;

  let streak = 0;
  let offset = 0;

  // Allow streak to continue from yesterday when today's check-in is missing.
  if (!daySet.has(dayKeyNDaysAgo(0)) && daySet.has(dayKeyNDaysAgo(1))) {
    offset = 1;
  }

  while (daySet.has(dayKeyNDaysAgo(offset + streak))) {
    streak += 1;
  }
  return streak;
}

function isMissingRelationError(error, relationName) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("does not exist") && message.includes(String(relationName || "").toLowerCase());
}

function getBillingPlansCatalog() {
  return [
    {
      code: "free",
      name: "Free",
      currency: BILLING_CURRENCY,
      monthlyPrice: 0,
      monthlyPlanGenerationLimit: FREE_PLAN_MONTHLY_LIMIT,
      recommended: false,
      features: [
        "Plan alimentar personalizat",
        "Acces la Discover",
        `Pana la ${FREE_PLAN_MONTHLY_LIMIT} regenerari plan/luna`,
      ],
    },
    {
      code: PRO_PLAN_CODE,
      name: "Pro lunar",
      currency: BILLING_CURRENCY,
      monthlyPrice: PRO_MONTHLY_PRICE,
      monthlyPlanGenerationLimit: null,
      recommended: true,
      features: [
        "Regenerari plan nelimitate",
        "Prioritate pe ajustari din check-in",
        "Suport extins pentru monitorizare",
      ],
    },
  ];
}

function normalizeIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function getCurrentMonthWindow(referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function isSubscriptionActive(row, referenceDate = new Date()) {
  if (!row) return false;
  const status = String(row.status || "").toLowerCase();
  if (status !== "active" && status !== "trialing") return false;

  const periodEnd = normalizeIsoOrNull(row.current_period_end);
  if (!periodEnd) return true;
  return new Date(periodEnd).getTime() > referenceDate.getTime();
}

function getEffectiveSubscriptionStatus(row, active) {
  if (!row) return "free";
  if (active) return String(row.status || "active").toLowerCase();

  const periodEnd = normalizeIsoOrNull(row.current_period_end);
  if (periodEnd && new Date(periodEnd).getTime() <= Date.now()) return "expired";
  return String(row.status || "inactive").toLowerCase();
}

async function getUserSubscriptionRow(client, userId) {
  const { data, error } = await client
    .from("user_subscriptions")
    .select(
      "user_id, plan_code, status, provider, provider_customer_id, provider_subscription_id, started_at, current_period_start, current_period_end, cancel_at_period_end, updated_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error, "user_subscriptions")) return null;
    throw new Error(error.message);
  }

  return data || null;
}

async function countGeneratedPlansInWindow(client, userId, startIso, endIso) {
  const { count, error } = await client
    .from("plans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  if (error) throw new Error(error.message);
  return Number(count || 0);
}

async function buildSubscriptionSnapshot(client, userId) {
  const now = new Date();
  const row = await getUserSubscriptionRow(client, userId);
  const active = isSubscriptionActive(row, now);
  const planCode = active ? String(row?.plan_code || PRO_PLAN_CODE) : "free";
  const monthWindow = getCurrentMonthWindow(now);

  const paidWindow = {
    startIso: normalizeIsoOrNull(row?.current_period_start) || monthWindow.startIso,
    endIso: normalizeIsoOrNull(row?.current_period_end) || monthWindow.endIso,
  };
  const usageWindow = active && planCode !== "free" ? paidWindow : monthWindow;
  const plansGenerated = await countGeneratedPlansInWindow(client, userId, usageWindow.startIso, usageWindow.endIso);
  const monthlyLimit = active && planCode !== "free" ? null : FREE_PLAN_MONTHLY_LIMIT;
  const remaining = monthlyLimit === null ? null : Math.max(0, monthlyLimit - plansGenerated);

  return {
    subscription: {
      planCode,
      status: getEffectiveSubscriptionStatus(row, active),
      isActive: active,
      cancelAtPeriodEnd: Boolean(row?.cancel_at_period_end),
      provider: row?.provider || null,
      startedAt: normalizeIsoOrNull(row?.started_at),
      currentPeriodStart: usageWindow.startIso,
      currentPeriodEnd: usageWindow.endIso,
    },
    usage: {
      plansGenerated,
      monthlyLimit,
      remaining,
      windowStart: usageWindow.startIso,
      windowEnd: usageWindow.endIso,
    },
    plans: getBillingPlansCatalog(),
  };
}

function goalTopicWeights(goal) {
  if (goal === "lose") {
    return { nutrition: 1.6, medical: 1.4, fitness: 1.1, wellbeing: 1.0 };
  }
  if (goal === "gain") {
    return { fitness: 1.6, nutrition: 1.4, medical: 1.1, wellbeing: 1.0 };
  }
  return { nutrition: 1.3, fitness: 1.2, wellbeing: 1.2, medical: 1.0 };
}

function scoreRecommendedContent(item, context) {
  const topic = item.topic || "nutrition";
  const tags = Array.isArray(item.tags) ? item.tags.map((tag) => String(tag).toLowerCase()) : [];

  let score = 0;
  score += context.topicWeights[topic] || 1;
  score += (context.recentTopicBoost[topic] || 0) * 0.7;
  score += (context.bookmarkTopicBoost[topic] || 0) * 0.9;

  if (tags.includes("weekly-refresh")) score += 0.4;
  if (topic === "medical" && context.hasLabs) score += 0.7;

  const published = new Date(item.published_at).getTime();
  if (Number.isFinite(published)) {
    const ageDays = Math.max(0, (Date.now() - published) / (24 * 60 * 60 * 1000));
    score += Math.max(0, 2 - ageDays * 0.08);
  }

  return score;
}

async function getRecentCheckins(client, userId, days = 7) {
  const safeDays = Math.min(30, Math.max(3, Number(days) || 7));
  const sinceDay = dayKeyNDaysAgo(safeDays - 1);
  const { data, error } = await client
    .from("daily_checkins")
    .select("checkin_date, weight_kg, sleep_hours, energy_level, hunger_level, workout_done")
    .eq("user_id", userId)
    .gte("checkin_date", sinceDay)
    .order("checkin_date", { ascending: true });

  if (error) throw error;
  return data || [];
}

function average(values) {
  const safe = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (!safe.length) return null;
  return safe.reduce((sum, value) => sum + value, 0) / safe.length;
}

function buildCheckinInsights(checkins, goal = "maintain") {
  const rows = Array.isArray(checkins) ? checkins : [];
  const daySet = new Set(rows.map((row) => String(row.checkin_date || "").slice(0, 10)).filter(Boolean));
  const workoutDays = rows.filter((row) => row.workout_done).length;
  const energyAvg = average(rows.map((row) => row.energy_level));
  const hungerAvg = average(rows.map((row) => row.hunger_level));
  const sleepAvg = average(rows.map((row) => row.sleep_hours));

  const weights = rows
    .map((row) => ({
      day: String(row.checkin_date || ""),
      value: Number(row.weight_kg),
    }))
    .filter((entry) => Number.isFinite(entry.value))
    .sort((left, right) => left.day.localeCompare(right.day));

  let weightDelta = null;
  if (weights.length >= 2) {
    weightDelta = Number((weights[weights.length - 1].value - weights[0].value).toFixed(2));
  }

  const streak = computeCurrentStreak(daySet);
  const adherenceRate = rows.length ? rows.length / 7 : 0;

  return {
    goal,
    count: rows.length,
    streak,
    adherenceRate,
    workoutDays,
    energyAvg,
    hungerAvg,
    sleepAvg,
    weightDelta,
  };
}

function applyCheckinAdjustments(plan, insights) {
  if (!plan || typeof plan !== "object") return plan;
  const targets = { ...(plan.targets || {}) };
  const currentKcal = Number(targets.kcal);
  if (!Number.isFinite(currentKcal)) return plan;

  let deltaKcal = 0;
  const reasons = [];

  if (insights.count >= 3) {
    if (insights.goal === "lose") {
      if (insights.weightDelta !== null && insights.weightDelta > -0.2 && insights.adherenceRate >= 0.55) {
        deltaKcal -= 120;
        reasons.push("Scadere ponderala sub asteptari, cu aderenta buna");
      }
      if ((insights.energyAvg !== null && insights.energyAvg <= 2.2) || (insights.sleepAvg !== null && insights.sleepAvg < 6)) {
        deltaKcal += 90;
        reasons.push("Energie/somn reduse, ajustare pentru sustenabilitate");
      }
    } else if (insights.goal === "gain") {
      if (insights.weightDelta !== null && insights.weightDelta < 0.15 && insights.adherenceRate >= 0.55) {
        deltaKcal += 140;
        reasons.push("Crestere ponderala sub asteptari, cu aderenta buna");
      }
      if (insights.hungerAvg !== null && insights.hungerAvg >= 4.2) {
        deltaKcal += 80;
        reasons.push("Foame crescuta in check-in");
      }
    } else {
      if (insights.weightDelta !== null && insights.weightDelta > 0.7) {
        deltaKcal -= 100;
        reasons.push("Trend de crestere in greutate pe mentinere");
      } else if (insights.weightDelta !== null && insights.weightDelta < -0.7) {
        deltaKcal += 100;
        reasons.push("Trend de scadere in greutate pe mentinere");
      }
    }
  }

  deltaKcal = Math.max(-220, Math.min(220, deltaKcal));
  if (!deltaKcal) {
    return {
      ...plan,
      autoAdjustments: {
        applied: false,
        reason: "no_adjustment",
        basedOnCheckins: insights,
      },
    };
  }

  const newKcal = Math.max(1200, Math.min(4500, Math.round(currentKcal + deltaKcal)));
  const kcalDelta = newKcal - currentKcal;
  const carbsDelta = Math.round((kcalDelta * 0.7) / 4);
  const fatDelta = Math.round((kcalDelta * 0.3) / 9);

  targets.kcal = newKcal;
  targets.carbs = Math.max(60, Math.round(Number(targets.carbs || 0) + carbsDelta));
  targets.fat = Math.max(35, Math.round(Number(targets.fat || 0) + fatDelta));
  targets.fibre = Math.max(18, Math.round((newKcal / 1000) * 14));

  const notes = Array.isArray(plan.notes) ? [...plan.notes] : [];
  notes.unshift(
    `Auto-ajustare (7 zile check-in): ${kcalDelta > 0 ? "+" : ""}${kcalDelta} kcal/zi. Motive: ${reasons.join("; ")}.`
  );

  return {
    ...plan,
    targets,
    notes,
    summary: `${plan.summary || "Plan personalizat"}. Ajustat automat cu ${kcalDelta > 0 ? "+" : ""}${kcalDelta} kcal pe baza check-in-urilor recente.`,
    autoAdjustments: {
      applied: true,
      kcalDelta,
      reasons,
      basedOnCheckins: insights,
    },
  };
}

function buildAutomatedReminders({
  latestCheckinDate = "",
  checkinInsights = null,
  plansLast14Days = 0,
  hasLabs = false,
  discoverReads7d = 0,
  adherence14d = 0,
}) {
  const reminders = [];
  const today = dayKeyNDaysAgo(0);

  if (!latestCheckinDate || latestCheckinDate !== today) {
    reminders.push({
      key: "daily_checkin",
      title: "Completeaza check-in-ul de azi",
      message: "Dureaza sub 1 minut si imbunatateste ajustarile automate ale planului.",
      severity: "high",
      actionPath: "/progress",
      actionLabel: "Deschide check-in",
    });
  }

  if (plansLast14Days === 0) {
    reminders.push({
      key: "plan_refresh",
      title: "Genereaza un plan nou",
      message: "Nu ai generat un plan in ultimele 14 zile.",
      severity: "medium",
      actionPath: "/plan",
      actionLabel: "Mergi la plan",
    });
  }

  if (!hasLabs) {
    reminders.push({
      key: "labs_upload",
      title: "Incarca analize recente",
      message: "Markerii medicali cresc precizia recomandarilor nutritionale.",
      severity: "medium",
      actionPath: "/wizard",
      actionLabel: "Upload analize",
    });
  }

  if ((checkinInsights?.energyAvg ?? 3) <= 2.3 || (checkinInsights?.sleepAvg ?? 7) < 6) {
    reminders.push({
      key: "recovery_focus",
      title: "Focus pe recuperare",
      message: "Semnalele de energie/somn sunt joase. Ajusteaza efortul si rutina de somn.",
      severity: "medium",
      actionPath: "/progress",
      actionLabel: "Vezi progres",
    });
  }

  if (discoverReads7d < 2) {
    reminders.push({
      key: "discover_read",
      title: "Exploreaza articolele recomandate",
      message: "Citeste 2 articole/saptamana pentru aderenta mai buna la plan.",
      severity: "low",
      actionPath: "/discover",
      actionLabel: "Deschide Discover",
    });
  }

  if (adherence14d < 35) {
    reminders.push({
      key: "adherence_boost",
      title: "Aderenta este scazuta",
      message: "Incepe cu obiective mici: check-in zilnic si 3 antrenamente/saptamana.",
      severity: "high",
      actionPath: "/progress",
      actionLabel: "Imbunatateste aderenta",
    });
  }

  return reminders.slice(0, 5);
}

function reminderDedupeKey(reminderKey, dayKey = dayKeyNDaysAgo(0)) {
  return `${dayKey}:${String(reminderKey || "generic")}`;
}

function currentHourInTimezone(timeZone = "Europe/Bucharest") {
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      hour12: false,
    });
    return Number(formatter.format(new Date()));
  } catch {
    return new Date().getHours();
  }
}

function isWithinQuietHours(hour, start = 22, end = 7) {
  const safeHour = Number.isFinite(hour) ? hour : 12;
  const startHour = Number.isFinite(Number(start)) ? Number(start) : 22;
  const endHour = Number.isFinite(Number(end)) ? Number(end) : 7;

  if (startHour === endHour) return false;
  if (startHour < endHour) return safeHour >= startHour && safeHour < endHour;
  return safeHour >= startHour || safeHour < endHour;
}

function currentWeekdayInTimezone(timeZone = "Europe/Bucharest") {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
    });
    const shortDay = formatter.format(new Date());
    const map = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    return map[shortDay] ?? new Date().getDay();
  } catch {
    return new Date().getDay();
  }
}

function weekTokenInTimezone(timeZone = "Europe/Bucharest") {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .format(new Date())
      .split("-")
      .map((value) => Number(value));

    const [year, month, day] = parts;
    const date = new Date(Date.UTC(year, month - 1, day));
    const start = new Date(Date.UTC(year, 0, 1));
    const dayOfYear = Math.floor((date - start) / (24 * 60 * 60 * 1000)) + 1;
    const week = Math.ceil((dayOfYear + start.getUTCDay()) / 7);
    return `${year}-W${String(week).padStart(2, "0")}`;
  } catch {
    const now = new Date();
    return `${now.getUTCFullYear()}-W${Math.ceil(now.getUTCDate() / 7)}`;
  }
}

async function notificationExistsByDedupe(userId, dedupeKey) {
  const { count, error } = await supabaseServer
    .from("user_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("dedupe_key", dedupeKey);

  if (error) throw new Error(error.message);
  return (count || 0) > 0;
}

async function createWeeklyDigestNotification(userId, digestPayload, dedupeKey) {
  const row = {
    user_id: userId,
    kind: "digest",
    title: digestPayload.title,
    message: digestPayload.message,
    action_path: "/discover",
    severity: "low",
    channel: "in_app",
    status: "unread",
    dedupe_key: dedupeKey,
    meta: {
      digest: true,
      week: digestPayload.weekToken,
      actionLabel: "Deschide Discover",
      generatedAt: new Date().toISOString(),
    },
  };

  const { data, error } = await supabaseServer
    .from("user_notifications")
    .upsert(row, { onConflict: "user_id,dedupe_key" })
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.id || null;
}

function buildWeeklyDigestSummary(context, weekToken) {
  const streak = Number(context?.checkinInsights?.streak || 0);
  const adherence = Number(context?.adherence14d || 0);
  const reads = Number(context?.discoverReads7d || 0);
  const plans = Number(context?.plansLast14Days || 0);

  let highlight = "Mentine ritmul actual.";
  if (adherence < 35) highlight = "Focalizeaza-te pe check-in zilnic si 3 antrenamente/saptamana.";
  else if (streak >= 5) highlight = "Streak excelent: continua executia consecventa.";

  return {
    weekToken,
    title: `Digest saptamanal NutriFit (${weekToken})`,
    message: `Aderenta: ${adherence}% | Streak: ${streak} zile | Citiri Discover: ${reads} | Planuri 14 zile: ${plans}. ${highlight}`,
    metrics: {
      adherence,
      streak,
      reads,
      plans,
      highlight,
    },
  };
}

async function fetchWeeklyDigestArticles(goal = "maintain") {
  const preferredTopicsByGoal = {
    lose: ["nutrition", "medical", "fitness"],
    gain: ["fitness", "nutrition", "wellbeing"],
    maintain: ["nutrition", "wellbeing", "fitness"],
  };

  const preferredTopics = preferredTopicsByGoal[goal] || preferredTopicsByGoal.maintain;
  const { data, error } = await supabaseServer
    .from("content_items")
    .select("title, slug, topic, summary, source_name, published_at")
    .eq("status", "published")
    .in("topic", preferredTopics)
    .order("published_at", { ascending: false })
    .limit(3);

  if (error) throw new Error(error.message);
  return data || [];
}

async function sendEmailNotification({ to, subject, html }) {
  if (!RESEND_API_KEY || !NOTIFY_FROM_EMAIL || !to) {
    return { skipped: true, reason: "missing_email_config" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: NOTIFY_FROM_EMAIL,
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Email send failed: ${response.status} ${payload}`);
  }

  return { ok: true };
}

async function createUserNotifications(userId, reminders) {
  const dayKey = dayKeyNDaysAgo(0);
  const rows = (reminders || []).map((reminder) => ({
    user_id: userId,
    kind: "reminder",
    title: reminder.title,
    message: reminder.message,
    action_path: reminder.actionPath || "/",
    severity: reminder.severity || "low",
    channel: "in_app",
    status: "unread",
    dedupe_key: reminderDedupeKey(reminder.key, dayKey),
    meta: {
      reminderKey: reminder.key,
      actionLabel: reminder.actionLabel || "Deschide",
      generatedAt: new Date().toISOString(),
    },
  }));

  if (!rows.length) return { inserted: 0 };

  const { data, error } = await supabaseServer
    .from("user_notifications")
    .upsert(rows, { onConflict: "user_id,dedupe_key" })
    .select("id, severity, title, message, action_path, meta");

  if (error) throw new Error(error.message);
  return { inserted: rows.length, notifications: data || [] };
}

async function fetchReminderContextForUser(userId) {
  const [profileResp, latestCheckinResp, checkins, plansResp, labsResp, readsResp] = await Promise.all([
    supabaseServer.from("profiles").select("goal").eq("user_id", userId).maybeSingle(),
    supabaseServer
      .from("daily_checkins")
      .select("checkin_date")
      .eq("user_id", userId)
      .order("checkin_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getRecentCheckins(supabaseServer, userId, 7),
    supabaseServer.from("plans").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()),
    supabaseServer.from("labs_extracted").select("id").eq("user_id", userId).order("extracted_at", { ascending: false }).limit(1).maybeSingle(),
    supabaseServer
      .from("user_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("event_name", ["content_open", "content_read"])
      .gte("occurred_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  if (profileResp.error) throw new Error(profileResp.error.message);
  if (latestCheckinResp.error) throw new Error(latestCheckinResp.error.message);
  if (plansResp.error) throw new Error(plansResp.error.message);
  if (labsResp.error) throw new Error(labsResp.error.message);
  if (readsResp.error) throw new Error(readsResp.error.message);

  const insights = buildCheckinInsights(checkins, profileResp.data?.goal || "maintain");
  const adherence14d = Math.round(((insights.count || 0) / 7) * 50 + Math.min(insights.streak || 0, 7) * 7);

  return {
    goal: profileResp.data?.goal || "maintain",
    latestCheckinDate: latestCheckinResp.data?.checkin_date || "",
    checkinInsights: insights,
    plansLast14Days: plansResp.count || 0,
    hasLabs: Boolean(labsResp.data?.id),
    discoverReads7d: readsResp.count || 0,
    adherence14d,
  };
}

async function dispatchAutomatedNotifications({ forUserId = "" } = {}) {
  if (notificationDispatchInFlight) return { skipped: true, reason: "in_progress" };
  notificationDispatchInFlight = true;

  try {
    let userIds = [];
    if (forUserId) {
      userIds = [forUserId];
    } else {
      const activeSince = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabaseServer
        .from("user_events")
        .select("user_id")
        .gte("occurred_at", activeSince)
        .order("occurred_at", { ascending: false })
        .limit(600);

      if (error) throw new Error(error.message);
      userIds = Array.from(new Set((data || []).map((row) => row.user_id).filter(Boolean))).slice(0, 120);
    }

    let generated = 0;
    let emailed = 0;
    let digestGenerated = 0;
    let digestEmailed = 0;

    for (const userId of userIds) {
      try {
        const context = await fetchReminderContextForUser(userId);
        const reminders = buildAutomatedReminders(context);
        if (reminders.length) {
          const generatedResp = await createUserNotifications(userId, reminders);
          generated += generatedResp.inserted || 0;
        }

        const { data: preference, error: prefError } = await supabaseServer
          .from("notification_preferences")
          .select("email, email_enabled, timezone, quiet_hours_start, quiet_hours_end, weekly_digest_enabled, weekly_digest_day, weekly_digest_hour")
          .eq("user_id", userId)
          .maybeSingle();
        if (prefError) throw new Error(prefError.message);

        const shouldEmail = Boolean(preference?.email_enabled && preference?.email);
        const localTimezone = preference?.timezone || "Europe/Bucharest";
        const localHour = currentHourInTimezone(localTimezone);
        const localWeekday = currentWeekdayInTimezone(localTimezone);
        const inQuietHours = isWithinQuietHours(localHour, preference?.quiet_hours_start, preference?.quiet_hours_end);

        if (shouldEmail && !inQuietHours && reminders.length) {
          const highPriority = reminders.filter((reminder) => reminder.severity === "high");
          if (highPriority.length) {
            const html = [
              `<h2>NutriFit - reminders importante</h2>`,
              `<p>Ai ${highPriority.length} reminder-e prioritare:</p>`,
              `<ul>`,
              ...highPriority.map((item) => `<li><strong>${item.title}</strong>: ${item.message}</li>`),
              `</ul>`,
              `<p>Deschide aplicatia: <a href="http://localhost:5173/">NutriFit</a></p>`,
            ].join("");

            await sendEmailNotification({
              to: preference.email,
              subject: "NutriFit reminders prioritare",
              html,
            });
            emailed += 1;
          }
        }

        const digestEnabled = preference?.weekly_digest_enabled === false ? false : true;
        const digestDay = Number.isFinite(Number(preference?.weekly_digest_day)) ? Number(preference.weekly_digest_day) : 1;
        const digestHour = Number.isFinite(Number(preference?.weekly_digest_hour)) ? Number(preference.weekly_digest_hour) : 9;
        const shouldRunDigestNow = digestEnabled && localWeekday === digestDay && localHour === digestHour;

        if (shouldRunDigestNow) {
          const weekToken = weekTokenInTimezone(localTimezone);
          const digestDedupe = `${weekToken}:weekly_digest`;
          const alreadyExists = await notificationExistsByDedupe(userId, digestDedupe);

          if (!alreadyExists) {
            const digestPayload = buildWeeklyDigestSummary(context, weekToken);
            await createWeeklyDigestNotification(userId, digestPayload, digestDedupe);
            digestGenerated += 1;

            if (shouldEmail && !inQuietHours) {
              const articles = await fetchWeeklyDigestArticles(context.goal || "maintain");
              const articlesHtml = (articles || [])
                .map(
                  (item) =>
                    `<li><strong>${item.title}</strong> (${item.topic || "general"}) - ${item.source_name || "sursa"} </li>`
                )
                .join("");

              const digestHtml = [
                `<h2>${digestPayload.title}</h2>`,
                `<p>${digestPayload.message}</p>`,
                `<p>Recomandari editoriale:</p>`,
                `<ul>${articlesHtml || "<li>Nu exista articole noi in acest moment.</li>"}</ul>`,
                `<p>Deschide aplicatia: <a href="http://localhost:5173/">NutriFit</a></p>`,
              ].join("");

              await sendEmailNotification({
                to: preference.email,
                subject: digestPayload.title,
                html: digestHtml,
              });
              digestEmailed += 1;
            }
          }
        }
      } catch (error) {
        console.error(`Notification dispatch failed for user ${userId}`, error.message || error);
      }
    }

    return { ok: true, users: userIds.length, generated, emailed, digestGenerated, digestEmailed };
  } finally {
    notificationDispatchInFlight = false;
  }
}

function mapNotificationRow(row) {
  const meta = row?.meta && typeof row.meta === "object" ? row.meta : {};
  return {
    id: row.id,
    kind: row.kind || "reminder",
    title: row.title || "Reminder",
    message: row.message || "",
    actionPath: row.action_path || "/",
    severity: row.severity || "low",
    channel: row.channel || "in_app",
    status: row.status || "unread",
    createdAt: row.created_at || null,
    readAt: row.read_at || null,
    dismissedAt: row.dismissed_at || null,
    key: meta.reminderKey || row.dedupe_key || row.id,
    actionLabel: meta.actionLabel || "Deschide",
    meta,
  };
}

function mapNotificationPreferencesRow(row, fallbackEmail = "") {
  const safeEmail = row?.email || fallbackEmail || "";
  return {
    email: safeEmail,
    emailEnabled: Boolean(row?.email_enabled),
    pushEnabled: row?.push_enabled === false ? false : true,
    timezone: row?.timezone || "Europe/Bucharest",
    quietHoursStart: Number.isFinite(Number(row?.quiet_hours_start)) ? Number(row.quiet_hours_start) : 22,
    quietHoursEnd: Number.isFinite(Number(row?.quiet_hours_end)) ? Number(row.quiet_hours_end) : 7,
    weeklyDigestEnabled: Boolean(row?.weekly_digest_enabled),
    weeklyDigestDay: Number.isFinite(Number(row?.weekly_digest_day)) ? Number(row.weekly_digest_day) : 1,
    weeklyDigestHour: Number.isFinite(Number(row?.weekly_digest_hour)) ? Number(row.weekly_digest_hour) : 9,
  };
}

function toClampedHour(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(23, Math.max(0, Math.round(parsed)));
}

function normalizeNotificationPreferences(payload, user) {
  const defaults = {
    email: user?.email || "",
    emailEnabled: false,
    pushEnabled: true,
    timezone: "Europe/Bucharest",
    quietHoursStart: 22,
    quietHoursEnd: 7,
    weeklyDigestEnabled: true,
    weeklyDigestDay: 1,
    weeklyDigestHour: 9,
  };

  const input = payload || {};
  return {
    user_id: user.id,
    email: typeof input.email === "string" ? input.email.trim() || null : defaults.email || null,
    email_enabled: typeof input.emailEnabled === "boolean" ? input.emailEnabled : defaults.emailEnabled,
    push_enabled: typeof input.pushEnabled === "boolean" ? input.pushEnabled : defaults.pushEnabled,
    timezone: typeof input.timezone === "string" && input.timezone.trim() ? input.timezone.trim() : defaults.timezone,
    quiet_hours_start: toClampedHour(input.quietHoursStart, defaults.quietHoursStart),
    quiet_hours_end: toClampedHour(input.quietHoursEnd, defaults.quietHoursEnd),
    weekly_digest_enabled:
      typeof input.weeklyDigestEnabled === "boolean" ? input.weeklyDigestEnabled : defaults.weeklyDigestEnabled,
    weekly_digest_day: toClampedHour(input.weeklyDigestDay, defaults.weeklyDigestDay) % 7,
    weekly_digest_hour: toClampedHour(input.weeklyDigestHour, defaults.weeklyDigestHour),
    updated_at: new Date().toISOString(),
  };
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "nutrifit-server" });
});

app.get("/billing/plans", (_req, res) => {
  res.json({ plans: getBillingPlansCatalog() });
});

app.get("/me/subscription", requireAuth, async (req, res, next) => {
  try {
    const snapshot = await buildSubscriptionSnapshot(req.sb, req.user.id);
    res.json(snapshot);
  } catch (error) {
    next(error);
  }
});

app.post("/me/subscription/activate", requireAuth, async (req, res, next) => {
  try {
    const payload = subscriptionChangeSchema.parse(req.body || {});
    const planCode = payload.planCode || PRO_PLAN_CODE;
    if (planCode !== PRO_PLAN_CODE) {
      return res.status(400).json({ error: "Plan invalid", code: "INVALID_PLAN_CODE" });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const periodEndIso = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const existing = await getUserSubscriptionRow(req.sb, req.user.id);
    const startedAt = normalizeIsoOrNull(existing?.started_at) || nowIso;

    const { error } = await req.sb.from("user_subscriptions").upsert(
      {
        user_id: req.user.id,
        plan_code: planCode,
        status: "active",
        provider: "manual",
        started_at: startedAt,
        current_period_start: nowIso,
        current_period_end: periodEndIso,
        cancel_at_period_end: false,
        updated_at: nowIso,
      },
      { onConflict: "user_id" },
    );

    if (error) {
      if (isMissingRelationError(error, "user_subscriptions")) {
        return res
          .status(503)
          .json({ error: "Schema billing lipseste. Ruleaza server/supabase.sql.", code: "SUBSCRIPTION_SCHEMA_MISSING" });
      }
      throw new Error(error.message);
    }

    await req.sb
      .from("user_events")
      .insert({
        user_id: req.user.id,
        event_name: "subscription_activated",
        page: "/plan",
        metadata: {
          planCode,
          provider: "manual",
          periodEnd: periodEndIso,
        },
        occurred_at: nowIso,
      })
      .then(() => {})
      .catch(() => {});

    const snapshot = await buildSubscriptionSnapshot(req.sb, req.user.id);
    res.json({ ok: true, ...snapshot });
  } catch (error) {
    next(error);
  }
});

app.post("/me/subscription/cancel", requireAuth, async (req, res, next) => {
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await req.sb
      .from("user_subscriptions")
      .update({
        cancel_at_period_end: true,
        updated_at: nowIso,
      })
      .eq("user_id", req.user.id)
      .in("status", ["active", "trialing"])
      .select("user_id")
      .maybeSingle();

    if (error) {
      if (isMissingRelationError(error, "user_subscriptions")) {
        return res
          .status(503)
          .json({ error: "Schema billing lipseste. Ruleaza server/supabase.sql.", code: "SUBSCRIPTION_SCHEMA_MISSING" });
      }
      throw new Error(error.message);
    }

    if (!data?.user_id) {
      return res.status(400).json({ error: "Nu exista abonament activ pentru anulare.", code: "NO_ACTIVE_SUBSCRIPTION" });
    }

    const snapshot = await buildSubscriptionSnapshot(req.sb, req.user.id);
    res.json({ ok: true, ...snapshot });
  } catch (error) {
    next(error);
  }
});

app.post("/me/subscription/reactivate", requireAuth, async (req, res, next) => {
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await req.sb
      .from("user_subscriptions")
      .update({
        cancel_at_period_end: false,
        updated_at: nowIso,
      })
      .eq("user_id", req.user.id)
      .in("status", ["active", "trialing"])
      .select("user_id")
      .maybeSingle();

    if (error) {
      if (isMissingRelationError(error, "user_subscriptions")) {
        return res
          .status(503)
          .json({ error: "Schema billing lipseste. Ruleaza server/supabase.sql.", code: "SUBSCRIPTION_SCHEMA_MISSING" });
      }
      throw new Error(error.message);
    }

    if (!data?.user_id) {
      return res
        .status(400)
        .json({ error: "Nu exista abonament activ care poate fi reactivat.", code: "NO_ACTIVE_SUBSCRIPTION" });
    }

    const snapshot = await buildSubscriptionSnapshot(req.sb, req.user.id);
    res.json({ ok: true, ...snapshot });
  } catch (error) {
    next(error);
  }
});

app.post("/suggest", requireAuth, async (req, res) => {
  const profile = req.body?.profileDraft || {};
  const goal = profile.goal === "lose" ? "deficit controlat" : profile.goal === "gain" ? "surplus moderat" : "echilibru caloric";
  const suggestion = `Sugestie rapida: mentine ${goal}, prioritizeaza proteina la fiecare masa si monitorizeaza hidratarea.`;
  res.json({ suggestion });
});

app.post("/auth/webhook", (_req, res) => {
  res.json({ ok: true, message: "auth webhook placeholder" });
});

app.post("/upload-labs", requireAuth, upload.single("file"), async (req, res, next) => {
  try {
    const file = req.file;

    if (!isAcceptedFile(file)) {
      return res.status(400).json({ error: "File must be .pdf, .doc, or .docx" });
    }

    const fileName = sanitizeFileName(file.originalname);
    const storagePath = `${req.user.id}/${Date.now()}_${fileName}`;
    const fileBuffer = fs.readFileSync(file.path);

    const storageUpload = await req.sb.storage.from("labs").upload(storagePath, fileBuffer, {
      contentType: file.mimetype || "application/octet-stream",
      upsert: false,
    });

    if (storageUpload.error) {
      throw new Error(storageUpload.error.message);
    }

    const { data: documentRow, error: docError } = await req.sb
      .from("labs_documents")
      .insert({
        user_id: req.user.id,
        filename: fileName,
        mime: file.mimetype,
        storage_path: storagePath,
      })
      .select("id, user_id, filename, mime, storage_path, uploaded_at")
      .single();

    if (docError) {
      throw new Error(docError.message);
    }

    const { text, sourceType } = await extractTextFromFile(file, fileBuffer);
    const extraction = await extractLabsWithAI(text, sourceType);

    const { data: extractedRow, error: extError } = await req.sb
      .from("labs_extracted")
      .insert({
        user_id: req.user.id,
        document_id: documentRow.id,
        extracted_json: extraction.extracted,
        confidence: extraction.confidence,
      })
      .select("id, user_id, document_id, extracted_json, confidence, extracted_at")
      .single();

    if (extError) {
      throw new Error(extError.message);
    }

    return res.json({
      ok: true,
      document: documentRow,
      extracted: extractedRow,
    });
  } catch (error) {
    next(error);
  } finally {
    try {
      if (req.file?.path) fs.unlinkSync(req.file.path);
    } catch (e) {
      console.error("Could not delete tmp file", e);
    }
  }
});

app.get("/me/profile", requireAuth, async (req, res, next) => {
  try {
    const profile = await getLatestProfile(req.sb, req.user.id);
    res.json({ profile });
  } catch (error) {
    next(error);
  }
});

app.get("/me/labs/latest", requireAuth, async (req, res, next) => {
  try {
    const labs = await getLatestLabs(req.sb, req.user.id);
    res.json({ labs });
  } catch (error) {
    next(error);
  }
});

app.post("/me/events", requireAuth, async (req, res, next) => {
  try {
    const payload = userEventSchema.parse(req.body || {});
    const { error } = await req.sb.from("user_events").insert({
      user_id: req.user.id,
      event_name: payload.eventName,
      page: payload.page || null,
      metadata: payload.metadata || {},
      occurred_at: payload.occurredAt || new Date().toISOString(),
    });

    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/me/checkins", requireAuth, async (req, res, next) => {
  try {
    const payload = dailyCheckinSchema.parse(req.body || {});
    const checkinDate = payload.checkinDate || toDayKey(new Date());

    const upsertRow = {
      user_id: req.user.id,
      checkin_date: checkinDate,
      weight_kg: payload.weightKg ?? null,
      sleep_hours: payload.sleepHours ?? null,
      energy_level: payload.energyLevel ?? null,
      hunger_level: payload.hungerLevel ?? null,
      workout_done: payload.workoutDone ?? false,
      notes: payload.notes ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await req.sb
      .from("daily_checkins")
      .upsert(upsertRow, { onConflict: "user_id,checkin_date" })
      .select("id, checkin_date, weight_kg, sleep_hours, energy_level, hunger_level, workout_done, notes, updated_at")
      .single();

    if (error) throw new Error(error.message);

    await req.sb.from("user_events").insert({
      user_id: req.user.id,
      event_name: "daily_checkin_submit",
      page: "/progress",
      metadata: {
        checkinDate,
        hasWeight: payload.weightKg !== undefined,
        workoutDone: Boolean(payload.workoutDone),
      },
      occurred_at: new Date().toISOString(),
    });

    res.json({ ok: true, checkin: data });
  } catch (error) {
    next(error);
  }
});

app.get("/me/checkins", requireAuth, async (req, res, next) => {
  try {
    const daysRaw = Number(req.query?.days || 30);
    const days = Number.isFinite(daysRaw) ? Math.min(120, Math.max(7, Math.round(daysRaw))) : 30;
    const sinceDay = dayKeyNDaysAgo(days - 1);

    const { data, error } = await req.sb
      .from("daily_checkins")
      .select("id, checkin_date, weight_kg, sleep_hours, energy_level, hunger_level, workout_done, notes, created_at, updated_at")
      .eq("user_id", req.user.id)
      .gte("checkin_date", sinceDay)
      .order("checkin_date", { ascending: false });

    if (error) throw new Error(error.message);
    res.json({ checkins: data || [] });
  } catch (error) {
    next(error);
  }
});

app.get("/me/progress/summary", requireAuth, async (req, res, next) => {
  try {
    const daysRaw = Number(req.query?.days || 30);
    const days = Number.isFinite(daysRaw) ? Math.min(90, Math.max(7, Math.round(daysRaw))) : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [eventsResp, plansResp, labsResp, checkinsResp] = await Promise.all([
      req.sb
        .from("user_events")
        .select("event_name, page, occurred_at")
        .eq("user_id", req.user.id)
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: true }),
      req.sb.from("plans").select("id", { count: "exact", head: true }).eq("user_id", req.user.id).gte("created_at", since),
      req.sb.from("labs_extracted").select("id", { count: "exact", head: true }).eq("user_id", req.user.id).gte("extracted_at", since),
      req.sb
        .from("daily_checkins")
        .select("checkin_date, workout_done, weight_kg, sleep_hours, energy_level, hunger_level")
        .eq("user_id", req.user.id)
        .gte("checkin_date", since.slice(0, 10))
        .order("checkin_date", { ascending: true }),
    ]);

    if (eventsResp.error) throw new Error(eventsResp.error.message);
    if (plansResp.error) throw new Error(plansResp.error.message);
    if (labsResp.error) throw new Error(labsResp.error.message);
    if (checkinsResp.error) throw new Error(checkinsResp.error.message);

    const events = eventsResp.data || [];
    const checkins = checkinsResp.data || [];
    const actionCounts = {};
    const pageCounts = {};
    const dayCounts = {};
    const activeDaySet = new Set();
    const checkinDaySet = new Set();
    const checkinByDay = {};
    let workoutsDone = 0;

    for (const event of events) {
      const eventName = event.event_name || "unknown";
      actionCounts[eventName] = (actionCounts[eventName] || 0) + 1;

      if (event.page) pageCounts[event.page] = (pageCounts[event.page] || 0) + 1;

      const dayKey = String(event.occurred_at || "").slice(0, 10);
      if (dayKey) {
        dayCounts[dayKey] = (dayCounts[dayKey] || 0) + 1;
        activeDaySet.add(dayKey);
      }
    }

    for (const entry of checkins) {
      const dayKey = String(entry.checkin_date || "").slice(0, 10);
      if (!dayKey) continue;
      checkinDaySet.add(dayKey);
      checkinByDay[dayKey] = entry;
      if (entry.workout_done) workoutsDone += 1;
    }

    const dailyActivity = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dayKey = date.toISOString().slice(0, 10);
      dailyActivity.push({
        day: dayKey,
        events: dayCounts[dayKey] || 0,
        checkin: checkinDaySet.has(dayKey),
        workoutDone: Boolean(checkinByDay[dayKey]?.workout_done),
      });
    }

    const eventsCount = events.length;
    const activeDays = activeDaySet.size;
    const planCount = plansResp.count || 0;
    const labsCount = labsResp.count || 0;
    const checkinsCount = checkinDaySet.size;
    const checkinStreak = computeCurrentStreak(checkinDaySet);
    const engagementScore = Math.min(
      100,
      Math.round((activeDays / days) * 45 + Math.min(eventsCount, 200) * 0.2 + Math.min(planCount * 8 + labsCount * 12, 40))
    );
    const adherenceScore = Math.min(
      100,
      Math.round(
        (activeDays / days) * 25 +
        (checkinsCount / days) * 35 +
        Math.min(checkinStreak * 2, 18) +
        Math.min(workoutsDone * 2, 14) +
        Math.min(planCount * 4 + labsCount * 6, 18)
      )
    );

    const topActions = Object.entries(actionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    const topPages = Object.entries(pageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([page, count]) => ({ page, count }));

    res.json({
      summary: {
        daysWindow: days,
        eventsCount,
        activeDays,
        planCount,
        labsCount,
        engagementScore,
        adherenceScore,
        checkinsCount,
        checkinStreak,
        workoutsDone,
      },
      topActions,
      topPages,
      dailyActivity,
      latestCheckin: checkins[checkins.length - 1] || null,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/me/content/bookmarks", requireAuth, async (req, res, next) => {
  try {
    const { data: bookmarks, error: bookmarksError } = await req.sb
      .from("content_bookmarks")
      .select("content_id, created_at")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (bookmarksError) throw new Error(bookmarksError.message);

    const contentIds = (bookmarks || []).map((entry) => entry.content_id).filter(Boolean);
    if (!contentIds.length) return res.json({ bookmarks: [] });

    const { data: contentRows, error: contentError } = await supabaseServer
      .from("content_items")
      .select("id, slug, title, summary, topic, source_name, source_url, published_at, updated_at, read_time_min, tags")
      .in("id", contentIds)
      .eq("status", "published");

    if (contentError) throw new Error(contentError.message);

    const byId = new Map((contentRows || []).map((item) => [item.id, item]));
    const rows = (bookmarks || [])
      .map((entry) => ({
        ...(byId.get(entry.content_id) || {}),
        bookmarked_at: entry.created_at,
      }))
      .filter((entry) => entry.slug)
      .filter((entry) => isHealthRelevantContentPayload(entry));

    res.json({ bookmarks: rows });
  } catch (error) {
    next(error);
  }
});

app.post("/me/content/bookmarks/:slug", requireAuth, async (req, res, next) => {
  try {
    const slug = String(req.params.slug || "").trim();
    if (!slug) return res.status(400).json({ error: "Missing slug" });

    const { data: contentRow, error: contentError } = await supabaseServer
      .from("content_items")
      .select("id, slug, topic")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (contentError) throw new Error(contentError.message);
    if (!contentRow) return res.status(404).json({ error: "Content not found" });

    const { data: bookmarkRow, error: bookmarkError } = await req.sb
      .from("content_bookmarks")
      .upsert(
        {
          user_id: req.user.id,
          content_id: contentRow.id,
        },
        { onConflict: "user_id,content_id" }
      )
      .select("content_id, created_at")
      .single();

    if (bookmarkError) throw new Error(bookmarkError.message);

    await req.sb.from("user_events").insert({
      user_id: req.user.id,
      event_name: "content_bookmark_add",
      page: "/discover",
      metadata: {
        slug: contentRow.slug,
        topic: contentRow.topic,
      },
      occurred_at: new Date().toISOString(),
    });

    res.json({ ok: true, bookmark: bookmarkRow });
  } catch (error) {
    next(error);
  }
});

app.delete("/me/content/bookmarks/:slug", requireAuth, async (req, res, next) => {
  try {
    const slug = String(req.params.slug || "").trim();
    if (!slug) return res.status(400).json({ error: "Missing slug" });

    const { data: contentRow, error: contentError } = await supabaseServer
      .from("content_items")
      .select("id, slug, topic")
      .eq("slug", slug)
      .maybeSingle();

    if (contentError) throw new Error(contentError.message);
    if (!contentRow) return res.json({ ok: true, removed: false });

    const { error: deleteError } = await req.sb
      .from("content_bookmarks")
      .delete()
      .eq("user_id", req.user.id)
      .eq("content_id", contentRow.id);

    if (deleteError) throw new Error(deleteError.message);

    await req.sb.from("user_events").insert({
      user_id: req.user.id,
      event_name: "content_bookmark_remove",
      page: "/discover",
      metadata: {
        slug: contentRow.slug,
        topic: contentRow.topic,
      },
      occurred_at: new Date().toISOString(),
    });

    res.json({ ok: true, removed: true });
  } catch (error) {
    next(error);
  }
});

app.get("/me/content/recommended", requireAuth, async (req, res, next) => {
  try {
    await ensureContentSeeded();

    const limitRaw = Number(req.query?.limit || 12);
    const limit = Number.isFinite(limitRaw) ? Math.min(24, Math.max(4, Math.round(limitRaw))) : 12;

    const [profileResp, historyResp, bookmarksResp, contentResp, latestLabs] = await Promise.all([
      req.sb.from("profiles").select("goal").eq("user_id", req.user.id).maybeSingle(),
      req.sb
        .from("user_events")
        .select("metadata, event_name")
        .eq("user_id", req.user.id)
        .in("event_name", ["content_open", "content_read", "content_bookmark_add"])
        .order("occurred_at", { ascending: false })
        .limit(120),
      req.sb.from("content_bookmarks").select("content_id").eq("user_id", req.user.id),
      supabaseServer
        .from("content_items")
        .select("id, slug, title, summary, topic, source_name, source_url, published_at, updated_at, read_time_min, tags")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(80),
      req.sb.from("labs_extracted").select("id").eq("user_id", req.user.id).order("extracted_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (profileResp.error) throw new Error(profileResp.error.message);
    if (historyResp.error) throw new Error(historyResp.error.message);
    if (bookmarksResp.error) throw new Error(bookmarksResp.error.message);
    if (contentResp.error) throw new Error(contentResp.error.message);
    if (latestLabs.error) throw new Error(latestLabs.error.message);

    const filteredContentItems = (contentResp.data || []).filter((item) => isHealthRelevantContentPayload(item));
    const bookmarkedIds = new Set((bookmarksResp.data || []).map((row) => row.content_id));
    const bookmarkedItems = filteredContentItems.filter((item) => bookmarkedIds.has(item.id));

    const recentTopicBoost = {};
    for (const event of historyResp.data || []) {
      const topic = event?.metadata?.topic;
      if (!topic) continue;
      recentTopicBoost[topic] = (recentTopicBoost[topic] || 0) + 1;
    }

    const bookmarkTopicBoost = {};
    for (const item of bookmarkedItems) {
      const topic = item.topic || "nutrition";
      bookmarkTopicBoost[topic] = (bookmarkTopicBoost[topic] || 0) + 1;
    }

    const topicWeights = goalTopicWeights(profileResp.data?.goal || "maintain");
    const context = {
      topicWeights,
      recentTopicBoost,
      bookmarkTopicBoost,
      hasLabs: Boolean(latestLabs.data?.id),
    };

    const scored = filteredContentItems
      .map((item) => ({
        ...item,
        score: scoreRecommendedContent(item, context),
        bookmarked: bookmarkedIds.has(item.id),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map(({ id, score, ...item }) => item);

    res.json({
      items: scored,
      signals: {
        goal: profileResp.data?.goal || "maintain",
        hasLabs: context.hasLabs,
        recentTopics: recentTopicBoost,
        bookmarkTopics: bookmarkTopicBoost,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/me/notifications", requireAuth, async (req, res, next) => {
  try {
    const status = String(req.query?.status || "unread").trim().toLowerCase();
    const limitRaw = Number(req.query?.limit || 40);
    const limit = Number.isFinite(limitRaw) ? Math.min(120, Math.max(1, Math.round(limitRaw))) : 40;

    let query = req.sb
      .from("user_notifications")
      .select("id, kind, title, message, action_path, severity, channel, status, dedupe_key, meta, created_at, read_at, dismissed_at")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status === "unread") {
      query = query.eq("status", "unread");
    } else if (status === "read") {
      query = query.eq("status", "read");
    } else if (status === "dismissed") {
      query = query.eq("status", "dismissed");
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    res.json({ notifications: (data || []).map(mapNotificationRow) });
  } catch (error) {
    next(error);
  }
});

app.get("/me/notifications/stats", requireAuth, async (req, res, next) => {
  try {
    const { count, error } = await req.sb
      .from("user_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", req.user.id)
      .eq("status", "unread");

    if (error) throw new Error(error.message);
    res.json({ unreadCount: count || 0 });
  } catch (error) {
    next(error);
  }
});

app.post("/me/notifications/:id/read", requireAuth, async (req, res, next) => {
  try {
    const notificationId = String(req.params.id || "").trim();
    if (!notificationId) return res.status(400).json({ error: "Missing notification id" });

    const updatePayload = {
      status: "read",
      read_at: new Date().toISOString(),
    };

    const { data, error } = await req.sb
      .from("user_notifications")
      .update(updatePayload)
      .eq("id", notificationId)
      .eq("user_id", req.user.id)
      .neq("status", "dismissed")
      .select("id, kind, title, message, action_path, severity, channel, status, dedupe_key, meta, created_at, read_at, dismissed_at")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return res.status(404).json({ error: "Notification not found" });

    res.json({ ok: true, notification: mapNotificationRow(data) });
  } catch (error) {
    next(error);
  }
});

app.post("/me/notifications/:id/dismiss", requireAuth, async (req, res, next) => {
  try {
    const notificationId = String(req.params.id || "").trim();
    if (!notificationId) return res.status(400).json({ error: "Missing notification id" });

    const updatePayload = {
      status: "dismissed",
      dismissed_at: new Date().toISOString(),
      read_at: new Date().toISOString(),
    };

    const { data, error } = await req.sb
      .from("user_notifications")
      .update(updatePayload)
      .eq("id", notificationId)
      .eq("user_id", req.user.id)
      .select("id, kind, title, message, action_path, severity, channel, status, dedupe_key, meta, created_at, read_at, dismissed_at")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return res.status(404).json({ error: "Notification not found" });

    await req.sb.from("user_events").insert({
      user_id: req.user.id,
      event_name: "notification_dismiss",
      page: "/notifications",
      metadata: {
        notificationId: data.id,
        dedupeKey: data.dedupe_key || null,
      },
      occurred_at: new Date().toISOString(),
    });

    res.json({ ok: true, notification: mapNotificationRow(data) });
  } catch (error) {
    next(error);
  }
});

app.post("/me/notifications/mark-all-read", requireAuth, async (req, res, next) => {
  try {
    const nowIso = new Date().toISOString();
    const { error } = await req.sb
      .from("user_notifications")
      .update({ status: "read", read_at: nowIso })
      .eq("user_id", req.user.id)
      .eq("status", "unread");

    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/me/notifications/preferences", requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await req.sb
      .from("notification_preferences")
      .select(
        "email, email_enabled, push_enabled, timezone, quiet_hours_start, quiet_hours_end, weekly_digest_enabled, weekly_digest_day, weekly_digest_hour"
      )
      .eq("user_id", req.user.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    res.json({ preferences: mapNotificationPreferencesRow(data, req.user.email || "") });
  } catch (error) {
    next(error);
  }
});

app.post("/me/notifications/preferences", requireAuth, async (req, res, next) => {
  try {
    const payload = notificationPreferencesSchema.parse(req.body || {});
    const row = normalizeNotificationPreferences(payload, req.user);

    const { data, error } = await req.sb
      .from("notification_preferences")
      .upsert(row, { onConflict: "user_id" })
      .select(
        "email, email_enabled, push_enabled, timezone, quiet_hours_start, quiet_hours_end, weekly_digest_enabled, weekly_digest_day, weekly_digest_hour"
      )
      .single();

    if (error) throw new Error(error.message);
    res.json({ ok: true, preferences: mapNotificationPreferencesRow(data, req.user.email || "") });
  } catch (error) {
    next(error);
  }
});

app.post("/me/notifications/dispatch", requireAuth, async (req, res, next) => {
  try {
    const result = await dispatchAutomatedNotifications({ forUserId: req.user.id });
    res.json({ ok: true, result });
  } catch (error) {
    next(error);
  }
});

app.get("/me/reminders", requireAuth, async (req, res, next) => {
  try {
    const { data: storedNotifications, error: notificationsError } = await req.sb
      .from("user_notifications")
      .select("id, kind, title, message, action_path, severity, channel, status, dedupe_key, meta, created_at, read_at, dismissed_at")
      .eq("user_id", req.user.id)
      .eq("status", "unread")
      .order("created_at", { ascending: false })
      .limit(5);

    if (notificationsError) throw new Error(notificationsError.message);
    if ((storedNotifications || []).length) {
      const reminders = storedNotifications.map(mapNotificationRow).map((row) => ({
        key: row.key || row.id,
        id: row.id,
        title: row.title,
        message: row.message,
        severity: row.severity,
        actionPath: row.actionPath,
        actionLabel: row.actionLabel,
        createdAt: row.createdAt,
      }));

      return res.json({
        reminders,
        signals: {
          source: "stored_notifications",
          unread: reminders.length,
        },
      });
    }

    const [profileResp, latestCheckinResp, checkinsResp, plansResp, labsResp, readsResp] = await Promise.all([
      req.sb.from("profiles").select("goal").eq("user_id", req.user.id).maybeSingle(),
      req.sb
        .from("daily_checkins")
        .select("checkin_date")
        .eq("user_id", req.user.id)
        .order("checkin_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      getRecentCheckins(req.sb, req.user.id, 7),
      req.sb.from("plans").select("id", { count: "exact", head: true }).eq("user_id", req.user.id).gte("created_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()),
      req.sb.from("labs_extracted").select("id").eq("user_id", req.user.id).order("extracted_at", { ascending: false }).limit(1).maybeSingle(),
      req.sb
        .from("user_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", req.user.id)
        .in("event_name", ["content_open", "content_read"])
        .gte("occurred_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    if (profileResp.error) throw new Error(profileResp.error.message);
    if (latestCheckinResp.error) throw new Error(latestCheckinResp.error.message);
    if (plansResp.error) throw new Error(plansResp.error.message);
    if (labsResp.error) throw new Error(labsResp.error.message);
    if (readsResp.error) throw new Error(readsResp.error.message);

    const insights = buildCheckinInsights(checkinsResp, profileResp.data?.goal || "maintain");
    const adherence14d = Math.round(((insights.count || 0) / 7) * 50 + Math.min(insights.streak || 0, 7) * 7);

    const reminders = buildAutomatedReminders({
      latestCheckinDate: latestCheckinResp.data?.checkin_date || "",
      checkinInsights: insights,
      plansLast14Days: plansResp.count || 0,
      hasLabs: Boolean(labsResp.data?.id),
      discoverReads7d: readsResp.count || 0,
      adherence14d,
    });

    res.json({
      reminders,
      signals: {
        checkinStreak: insights.streak,
        adherenceEstimate: adherence14d,
        discoverReads7d: readsResp.count || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post("/me/reminders/:key/dismiss", requireAuth, async (req, res, next) => {
  try {
    const key = String(req.params.key || "").trim();
    if (!key) return res.status(400).json({ error: "Missing reminder key" });

    const nowIso = new Date().toISOString();
    const { error: dismissError } = await req.sb
      .from("user_notifications")
      .update({ status: "dismissed", dismissed_at: nowIso, read_at: nowIso })
      .eq("user_id", req.user.id)
      .or(`id.eq.${key},dedupe_key.eq.${key}`);
    if (dismissError) throw new Error(dismissError.message);

    const { error } = await req.sb.from("user_events").insert({
      user_id: req.user.id,
      event_name: "reminder_dismiss",
      page: "/",
      metadata: {
        reminderKey: key,
      },
      occurred_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/content", async (req, res, next) => {
  try {
    await ensureContentSeeded();

    const limitRaw = Number(req.query?.limit || 20);
    const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.round(limitRaw))) : 20;
    const topic = String(req.query?.topic || "").trim();
    const search = String(req.query?.search || "").trim().toLowerCase();

    let query = supabaseServer
      .from("content_items")
      .select("slug, title, summary, topic, source_name, source_url, published_at, updated_at, read_time_min, tags")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limit);

    if (topic) query = query.eq("topic", topic);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = (data || []).filter((item) => {
      if (!isHealthRelevantContentPayload(item)) return false;
      if (!search) return true;
      const text = `${item.title || ""} ${item.summary || ""} ${(item.tags || []).join(" ")}`.toLowerCase();
      return text.includes(search);
    });

    res.json({ items: rows });
  } catch (error) {
    next(error);
  }
});

app.get("/content/topics", async (_req, res, next) => {
  try {
    await ensureContentSeeded();

    const { data, error } = await supabaseServer
      .from("content_items")
      .select("topic, title, summary, tags")
      .eq("status", "published")
      .order("topic", { ascending: true });

    if (error) throw new Error(error.message);

    const topics = Array.from(
      new Set((data || []).filter((entry) => isHealthRelevantContentPayload(entry)).map((entry) => entry.topic).filter(Boolean))
    );
    res.json({ topics });
  } catch (error) {
    next(error);
  }
});

app.get("/content/:slug", async (req, res, next) => {
  try {
    await ensureContentSeeded();

    const slug = String(req.params.slug || "").trim();
    if (!slug) return res.status(400).json({ error: "Missing slug" });

    const { data, error } = await supabaseServer
      .from("content_items")
      .select("id, slug, title, summary, body_markdown, topic, source_name, source_url, published_at, updated_at, read_time_min, tags, view_count")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return res.status(404).json({ error: "Content not found" });
    if (!isHealthRelevantContentPayload(data)) return res.status(404).json({ error: "Content not found" });

    const currentViews = Number.isFinite(Number(data.view_count)) ? Number(data.view_count) : 0;
    await supabaseServer
      .from("content_items")
      .update({ view_count: currentViews + 1 })
      .eq("id", data.id);

    res.json({ item: data });
  } catch (error) {
    next(error);
  }
});

app.post("/content/refresh", requireAuth, async (req, res, next) => {
  try {
    const force = Boolean(req.body?.force);
    const result = await refreshWeeklyContent({ force });
    res.json({ ok: true, result });
  } catch (error) {
    next(error);
  }
});

app.post("/me/profile", requireAuth, async (req, res, next) => {
  try {
    const payload = profileSchema.parse(req.body || {});

    const profileData = {
      user_id: req.user.id,
      sex: payload.sex,
      age: payload.age,
      height_cm: payload.heightCm,
      weight_kg: payload.weightKg,
      goal: payload.goal,
      activity_level: payload.activityLevel,
      dietary_prefs: payload.dietaryPrefs,
      allergies: payload.allergies,
      lifestyle: payload.lifestyle,
      labs_text: payload.labsText,
      labs_file_name: payload.labsFileName,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await req.sb
      .from("profiles")
      .upsert(profileData, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return res.json({ ok: true, profile: data });
  } catch (error) {
    next(error);
  }
});

app.post("/generate-plan", requireAuth, async (req, res) => {
  try {
    const profile = (await getLatestProfile(req.sb, req.user.id)) || req.body?.profile;

    if (!profile) {
      return res.status(400).json({ error: "No profile available" });
    }

    const subscriptionSnapshot = await buildSubscriptionSnapshot(req.sb, req.user.id);
    const reachedMonthlyLimit =
      subscriptionSnapshot.usage.monthlyLimit !== null &&
      subscriptionSnapshot.usage.plansGenerated >= subscriptionSnapshot.usage.monthlyLimit;
    if (reachedMonthlyLimit) {
      return res.status(402).json({
        error: "Ai atins limita lunara pentru planul Free. Activeaza Pro lunar pentru regenerari nelimitate.",
        code: "SUBSCRIPTION_REQUIRED",
        ...subscriptionSnapshot,
      });
    }

    const latestLabs = await getLatestLabs(req.sb, req.user.id);
    const labsSnapshot = latestLabs?.extracted_json || null;
    const recentCheckins = await getRecentCheckins(req.sb, req.user.id, 7);
    const checkinInsights = buildCheckinInsights(recentCheckins, profile?.goal);

    const aiPlan = await generatePlanWithAI(profile, labsSnapshot);
    if (!aiPlan && AI_PLAN_REQUIRED) {
      return res.status(503).json({
        error:
          "Generarea AI este obligatorie dar indisponibila. Configureaza un provider AI valid (BASE44_API_URL extern, GOOGLE_API_KEY sau OPENAI_API_KEY).",
      });
    }

    const basePlan = aiPlan
      ? ensureSevenDayPlan(aiPlan, profile, labsSnapshot)
      : generateLocalPlan(profile, labsSnapshot);
    const plan = applyCheckinAdjustments(basePlan, checkinInsights);
    plan.meta = {
      ...(plan.meta || {}),
      generationSource: aiPlan ? "ai" : "local-fallback",
      aiRequired: AI_PLAN_REQUIRED,
      generatedAt: new Date().toISOString(),
    };

    const { data: planRow, error } = await req.sb
      .from("plans")
      .insert({
        user_id: req.user.id,
        profile_snapshot: profile,
        labs_snapshot: labsSnapshot,
        plan_json: plan,
      })
      .select("id, user_id, profile_snapshot, labs_snapshot, plan_json, created_at")
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ ok: true, plan: planRow });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Plan generation failed" });
  }
});

app.get("/me/plans", requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await req.sb
      .from("plans")
      .select("id, created_at, plan_json")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    return res.json({ plans: data || [] });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Could not fetch plans" });
  }
});

app.get("/me/plans/:id", requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await req.sb
      .from("plans")
      .select("id, user_id, profile_snapshot, labs_snapshot, plan_json, created_at")
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .single();

    if (error) return res.status(404).json({ error: "Plan not found" });

    return res.json({ plan: data });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Could not fetch plan" });
  }
});

app.use((err, req, res, next) => {
  console.error("Global Error Handler:");
  console.error(err);
  if (err.name === 'ZodError') {
    return res.status(400).json({ error: "Date invalide", details: err.errors });
  }
  const genericMessage = "A aparut o eroare interna la procesarea cererii.";
  const isDev = process.env.NODE_ENV !== "production";
  res.status(500).json({ error: isDev ? (err?.message || genericMessage) : genericMessage });
});

function scheduleContentRefreshes() {
  const safeRefresh = async (force = false) => {
    try {
      await refreshWeeklyContent({ force });
    } catch (error) {
      console.error("Scheduled content refresh failed", error.message || error);
    }
  };

  ensureContentSeeded().catch((error) => {
    console.error("Initial content seed check failed", error.message || error);
  });
  safeRefresh(false);
  setInterval(() => safeRefresh(false), CONTENT_REFRESH_CHECK_MS);
}

function scheduleNotificationDispatches() {
  const safeDispatch = async () => {
    try {
      const result = await dispatchAutomatedNotifications();
      if (result?.generated) {
        console.log(`Notification dispatch generated ${result.generated} entries for ${result.users} users`);
      }
    } catch (error) {
      console.error("Scheduled notification dispatch failed", error.message || error);
    }
  };

  safeDispatch();
  setInterval(() => safeDispatch(), NOTIFICATION_CHECK_MS);
}

app.listen(PORT, HOST, () => {
  console.log(`NutriFit backend running on http://${HOST}:${PORT}`);
  scheduleContentRefreshes();
  scheduleNotificationDispatches();
});

// Patch to prevent premature event loop exit (code 0) caused by side-effects in some dependencies.
setInterval(() => { }, 1000 * 60 * 60);
