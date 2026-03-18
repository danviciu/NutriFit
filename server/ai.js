/* global process */
import dotenv from "dotenv";

dotenv.config({ path: "./server/.env" });

const API_KEY = process.env.BASE44_API_KEY;
const API_URL = process.env.BASE44_API_URL || "http://localhost:8787";
const SELF_PORT = process.env.PORT || "8787";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_PLAN_MODEL = process.env.OPENAI_PLAN_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 45000);
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";
const GOOGLE_PLAN_MODEL = process.env.GOOGLE_PLAN_MODEL || process.env.GEMINI_PLAN_MODEL || "gemini-2.5-flash";
const GOOGLE_TIMEOUT_MS = Number(process.env.GOOGLE_TIMEOUT_MS || OPENAI_TIMEOUT_MS || 45000);
const PANEL_KEYS = ["cbc", "metabolic", "lipids", "thyroid", "inflammation", "other"];
const OPENAI_PLAN_TEXT_FORMAT = {
  type: "json_schema",
  name: "nutrition_plan_v1",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["weeklyPlan", "targets", "summary", "notes", "fitness", "shoppingList", "disclaimer"],
    properties: {
      weeklyPlan: {
        type: "array",
        minItems: 7,
        maxItems: 7,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["day", "meals"],
          properties: {
            day: { type: "string" },
            meals: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["slot", "foods"],
                properties: {
                  slot: { type: "string" },
                  foods: {
                    type: "array",
                    minItems: 1,
                    items: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
      targets: {
        type: "object",
        additionalProperties: false,
        required: ["kcal", "protein", "carbs", "fat", "fibre"],
        properties: {
          kcal: { type: "number" },
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" },
          fibre: { type: "number" },
        },
      },
      summary: { type: "string" },
      notes: {
        type: "array",
        items: { type: "string" },
      },
      fitness: {
        type: "array",
        items: { type: "string" },
      },
      shoppingList: {
        type: "array",
        items: { type: "string" },
      },
      disclaimer: { type: "string" },
    },
  },
};
const GOOGLE_PLAN_RESPONSE_JSON_SCHEMA = OPENAI_PLAN_TEXT_FORMAT.schema;

function pointsToSelf() {
  return API_URL === `http://localhost:${SELF_PORT}` || API_URL === `http://127.0.0.1:${SELF_PORT}`;
}

function stripDiacritics(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeText(value) {
  return stripDiacritics(value)
    .toLowerCase()
    .split("\0")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const RELEVANT_MARKERS = [
  {
    id: "glucose",
    panel: "metabolic",
    name: "Glucose",
    aliases: ["glucose", "glicemie", "glucoza"],
    unit: "mg/dL",
    range: "70-99",
    unitHints: [
      { regex: /\bmmol\s*\/\s*l\b/i, unit: "mmol/L" },
      { regex: /\bmg\s*\/\s*dl\b/i, unit: "mg/dL" },
    ],
  },
  {
    id: "hba1c",
    panel: "metabolic",
    name: "HbA1c",
    aliases: ["hba1c", "hemoglobina glicata", "glycated hemoglobin"],
    unit: "%",
    range: "4.0-5.6",
    unitHints: [{ regex: /%/i, unit: "%" }],
  },
  {
    id: "insulin",
    panel: "metabolic",
    name: "Insulin",
    aliases: ["insulin", "insulina"],
    unit: "uIU/mL",
    range: "2.0-25.0",
    unitHints: [
      { regex: /\buiu\s*\/\s*ml\b/i, unit: "uIU/mL" },
      { regex: /\bmu\s*\/\s*l\b/i, unit: "uIU/mL" },
    ],
  },
  {
    id: "creatinine",
    panel: "metabolic",
    name: "Creatinine",
    aliases: ["creatinine", "creatinina"],
    unit: "mg/dL",
    range: "0.6-1.3",
    unitHints: [
      { regex: /\bumol\s*\/\s*l\b/i, unit: "umol/L" },
      { regex: /\bmol\s*\/\s*l\b/i, unit: "umol/L" },
      { regex: /\bmg\s*\/\s*dl\b/i, unit: "mg/dL" },
    ],
  },
  {
    id: "urea",
    panel: "metabolic",
    name: "Urea",
    aliases: ["urea", "uree", "bun"],
    unit: "mg/dL",
    range: "15-45",
    unitHints: [
      { regex: /\bmmol\s*\/\s*l\b/i, unit: "mmol/L" },
      { regex: /\bmg\s*\/\s*dl\b/i, unit: "mg/dL" },
    ],
  },
  {
    id: "uric_acid",
    panel: "metabolic",
    name: "Uric acid",
    aliases: ["uric acid", "acid uric"],
    unit: "mg/dL",
    range: "3.5-7.2",
    unitHints: [
      { regex: /\bumol\s*\/\s*l\b/i, unit: "umol/L" },
      { regex: /\bmg\s*\/\s*dl\b/i, unit: "mg/dL" },
    ],
  },
  {
    id: "egfr",
    panel: "metabolic",
    name: "eGFR",
    aliases: ["egfr", "gfr", "filtrare glomerulara", "rfg"],
    unit: "mL/min/1.73m2",
    range: ">=90",
    unitHints: [{ regex: /\bml\s*\/\s*min\b/i, unit: "mL/min/1.73m2" }],
  },
  {
    id: "alt",
    panel: "metabolic",
    name: "ALT (TGP)",
    aliases: ["alt", "tgp", "alat"],
    unit: "U/L",
    range: "<45",
    unitHints: [{ regex: /\bu\s*\/\s*l\b/i, unit: "U/L" }],
  },
  {
    id: "ast",
    panel: "metabolic",
    name: "AST (TGO)",
    aliases: ["ast", "tgo", "asat"],
    unit: "U/L",
    range: "<40",
    unitHints: [{ regex: /\bu\s*\/\s*l\b/i, unit: "U/L" }],
  },
  {
    id: "ggt",
    panel: "metabolic",
    name: "GGT",
    aliases: ["ggt", "gama gt", "gamma gt"],
    unit: "U/L",
    range: "<55",
    unitHints: [{ regex: /\bu\s*\/\s*l\b/i, unit: "U/L" }],
  },
  {
    id: "vitamin_d",
    panel: "metabolic",
    name: "Vitamin D (25-OH)",
    aliases: ["vitamin d", "vitamina d", "25-oh", "25oh", "25 oh"],
    unit: "ng/mL",
    range: "30-100",
    unitHints: [
      { regex: /\bnmol\s*\/\s*l\b/i, unit: "nmol/L" },
      { regex: /\bng\s*\/\s*ml\b/i, unit: "ng/mL" },
    ],
  },
  {
    id: "vitamin_b12",
    panel: "metabolic",
    name: "Vitamin B12",
    aliases: ["vitamin b12", "vitamina b12", "cobalamina"],
    unit: "pg/mL",
    range: "200-900",
    unitHints: [
      { regex: /\bpg\s*\/\s*ml\b/i, unit: "pg/mL" },
      { regex: /\bpmol\s*\/\s*l\b/i, unit: "pmol/L" },
    ],
  },
  {
    id: "ferritin",
    panel: "metabolic",
    name: "Ferritin",
    aliases: ["ferritin", "feritina"],
    unit: "ng/mL",
    range: "30-300",
    unitHints: [
      { regex: /\bng\s*\/\s*ml\b/i, unit: "ng/mL" },
      { regex: /\bug\s*\/\s*l\b/i, unit: "ng/mL" },
    ],
  },
  {
    id: "iron",
    panel: "metabolic",
    name: "Serum iron",
    aliases: ["serum iron", "iron", "fier seric", "fier"],
    unit: "ug/dL",
    range: "60-170",
    unitHints: [
      { regex: /\bumol\s*\/\s*l\b/i, unit: "umol/L" },
      { regex: /\bug\s*\/\s*dl\b/i, unit: "ug/dL" },
    ],
  },
  {
    id: "chol_total",
    panel: "lipids",
    name: "Cholesterol total",
    aliases: ["cholesterol total", "colesterol total", "total cholesterol"],
    unit: "mg/dL",
    range: "<200",
    unitHints: [
      { regex: /\bmmol\s*\/\s*l\b/i, unit: "mmol/L" },
      { regex: /\bmg\s*\/\s*dl\b/i, unit: "mg/dL" },
    ],
  },
  {
    id: "ldl",
    panel: "lipids",
    name: "LDL cholesterol",
    aliases: ["ldl cholesterol", "colesterol ldl", "ldl-c", "ldl"],
    unit: "mg/dL",
    range: "<130",
    unitHints: [
      { regex: /\bmmol\s*\/\s*l\b/i, unit: "mmol/L" },
      { regex: /\bmg\s*\/\s*dl\b/i, unit: "mg/dL" },
    ],
  },
  {
    id: "hdl",
    panel: "lipids",
    name: "HDL cholesterol",
    aliases: ["hdl cholesterol", "colesterol hdl", "hdl-c", "hdl"],
    unit: "mg/dL",
    range: ">=40",
    unitHints: [
      { regex: /\bmmol\s*\/\s*l\b/i, unit: "mmol/L" },
      { regex: /\bmg\s*\/\s*dl\b/i, unit: "mg/dL" },
    ],
  },
  {
    id: "triglycerides",
    panel: "lipids",
    name: "Triglycerides",
    aliases: ["triglycerides", "trigliceride"],
    unit: "mg/dL",
    range: "<150",
    unitHints: [
      { regex: /\bmmol\s*\/\s*l\b/i, unit: "mmol/L" },
      { regex: /\bmg\s*\/\s*dl\b/i, unit: "mg/dL" },
    ],
  },
  {
    id: "tsh",
    panel: "thyroid",
    name: "TSH",
    aliases: ["tsh", "thyroid stimulating hormone"],
    unit: "uIU/mL",
    range: "0.4-4.0",
    unitHints: [
      { regex: /\buiu\s*\/\s*ml\b/i, unit: "uIU/mL" },
      { regex: /\bmui\s*\/\s*l\b/i, unit: "uIU/mL" },
      { regex: /\bmu\s*\/\s*l\b/i, unit: "uIU/mL" },
    ],
  },
  {
    id: "ft4",
    panel: "thyroid",
    name: "Free T4",
    aliases: ["free t4", "ft4", "freet4", "tiroxina libera"],
    unit: "ng/dL",
    range: "0.8-1.8",
    unitHints: [
      { regex: /\bpmol\s*\/\s*l\b/i, unit: "pmol/L" },
      { regex: /\bng\s*\/\s*dl\b/i, unit: "ng/dL" },
    ],
  },
  {
    id: "hemoglobin",
    panel: "cbc",
    name: "Hemoglobin",
    aliases: ["hemoglobin", "hemoglobina", "hgb"],
    unit: "g/dL",
    range: "12.0-17.0",
    unitHints: [
      { regex: /\bg\s*\/\s*l\b/i, unit: "g/L" },
      { regex: /\bg\s*\/\s*dl\b/i, unit: "g/dL" },
    ],
  },
  {
    id: "hematocrit",
    panel: "cbc",
    name: "Hematocrit",
    aliases: ["hematocrit", "hct"],
    unit: "%",
    range: "36-52",
    unitHints: [{ regex: /%/i, unit: "%" }],
  },
  {
    id: "crp",
    panel: "inflammation",
    name: "CRP",
    aliases: ["crp", "c reactive protein", "proteina c reactiva"],
    unit: "mg/L",
    range: "<5",
    unitHints: [
      { regex: /\bmg\s*\/\s*l\b/i, unit: "mg/L" },
      { regex: /\bmg\s*\/\s*dl\b/i, unit: "mg/dL" },
    ],
  },
];

const MARKERS = RELEVANT_MARKERS.map((marker) => {
  const aliasPattern = marker.aliases
    .map((alias) => {
      const normalizedAlias = normalizeText(alias);
      const escapedAlias = escapeRegex(normalizedAlias);
      if (/^[a-z0-9]/.test(normalizedAlias) && /[a-z0-9]$/.test(normalizedAlias)) {
        return `\\b${escapedAlias}\\b`;
      }

      return escapedAlias;
    })
    .join("|");

  return {
    ...marker,
    aliasRegex: new RegExp(aliasPattern, "i"),
    aliasExactRegex: new RegExp(aliasPattern, "i"),
  };
});

function emptyPanels() {
  return PANEL_KEYS.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {});
}

function toNumber(raw) {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;

  const cleaned = raw.replace(/\s+/g, "").replace(/,/g, ".");
  const parsed = Number(cleaned.replace(/^[<>]=?/, ""));

  return Number.isFinite(parsed) ? parsed : null;
}

function extractNumberTokens(segment) {
  const tokens = [];
  const regex = /(?:[<>]=?\s*)?-?\d+(?:[.,]\d+)?/g;
  let match = regex.exec(segment);

  while (match) {
    const raw = match[0];
    const value = toNumber(raw);

    if (value !== null) {
      tokens.push({
        raw,
        value,
        start: match.index,
        end: match.index + raw.length,
        operator: raw.trim().match(/^[<>]=?/)?.[0] || null,
      });
    }

    match = regex.exec(segment);
  }

  return tokens;
}

function hasRangeBetween(segment, leftToken, rightToken) {
  if (!leftToken || !rightToken) return false;

  const between = segment.slice(leftToken.end, rightToken.start);
  return /[-–]/.test(between);
}

function pickValueToken(tokens, segment, preferTrailing = false) {
  if (!tokens.length) return null;
  if (tokens.length === 1) return tokens[0];

  if (tokens.length >= 3) {
    if (hasRangeBetween(segment, tokens[0], tokens[1])) return tokens[2];
    if (hasRangeBetween(segment, tokens[1], tokens[2])) return tokens[0];
  }

  if (tokens.length === 2 && hasRangeBetween(segment, tokens[0], tokens[1])) {
    return null;
  }

  return preferTrailing ? tokens[tokens.length - 1] : tokens[0];
}

function detectUnit(line, marker) {
  const hints = Array.isArray(marker.unitHints) ? marker.unitHints : [];
  const hint = hints.find((item) => item.regex.test(line));

  return hint?.unit || marker.unit || null;
}

function normalizeMarkerValue(marker, value, detectedUnit) {
  if (!Number.isFinite(value)) {
    return { value: null, unit: marker.unit, converted: false };
  }

  switch (marker.id) {
    case "glucose":
      if (detectedUnit === "mmol/L") return { value: Number((value * 18).toFixed(2)), unit: "mg/dL", converted: true };
      return { value, unit: "mg/dL", converted: false };
    case "chol_total":
    case "ldl":
    case "hdl":
      if (detectedUnit === "mmol/L") return { value: Number((value * 38.67).toFixed(2)), unit: "mg/dL", converted: true };
      return { value, unit: "mg/dL", converted: false };
    case "triglycerides":
      if (detectedUnit === "mmol/L") return { value: Number((value * 88.57).toFixed(2)), unit: "mg/dL", converted: true };
      return { value, unit: "mg/dL", converted: false };
    case "creatinine":
      if (detectedUnit === "umol/L") return { value: Number((value / 88.4).toFixed(3)), unit: "mg/dL", converted: true };
      return { value, unit: "mg/dL", converted: false };
    case "urea":
      if (detectedUnit === "mmol/L") return { value: Number((value * 6.006).toFixed(2)), unit: "mg/dL", converted: true };
      return { value, unit: "mg/dL", converted: false };
    case "uric_acid":
      if (detectedUnit === "umol/L") return { value: Number((value / 59.48).toFixed(3)), unit: "mg/dL", converted: true };
      return { value, unit: "mg/dL", converted: false };
    case "vitamin_d":
      if (detectedUnit === "nmol/L") return { value: Number((value / 2.496).toFixed(2)), unit: "ng/mL", converted: true };
      return { value, unit: "ng/mL", converted: false };
    case "hemoglobin":
      if (detectedUnit === "g/L") return { value: Number((value / 10).toFixed(2)), unit: "g/dL", converted: true };
      return { value, unit: "g/dL", converted: false };
    default:
      return { value, unit: marker.unit || detectedUnit || null, converted: false };
  }
}

function parseRange(rangeValue) {
  const text = normalizeText(rangeValue);
  if (!text) return null;

  const span = text.match(/(-?\d+(?:[.,]\d+)?)\s*[-–]\s*(-?\d+(?:[.,]\d+)?)/);
  if (span) {
    const low = toNumber(span[1]);
    const high = toNumber(span[2]);
    if (low !== null && high !== null) return { type: "between", low, high };
  }

  const under = text.match(/^(?:<|<=)\s*(-?\d+(?:[.,]\d+)?)/);
  if (under) {
    const high = toNumber(under[1]);
    if (high !== null) return { type: "max", high };
  }

  const over = text.match(/^(?:>|>=)\s*(-?\d+(?:[.,]\d+)?)/);
  if (over) {
    const low = toNumber(over[1]);
    if (low !== null) return { type: "min", low };
  }

  return null;
}

function evaluateFlag(value, rangeValue, operator) {
  if (!Number.isFinite(value)) return "unknown";

  if (operator?.startsWith("<")) return "low";
  if (operator?.startsWith(">")) return "high";

  const parsed = parseRange(rangeValue);
  if (!parsed) return "unknown";

  if (parsed.type === "between") {
    if (value < parsed.low) return "low";
    if (value > parsed.high) return "high";
    return "normal";
  }

  if (parsed.type === "max") return value <= parsed.high ? "normal" : "high";
  if (parsed.type === "min") return value >= parsed.low ? "normal" : "low";

  return "unknown";
}

function extractRangeFromLine(line) {
  const normalized = normalizeText(line);

  const span = normalized.match(/(-?\d+(?:[.,]\d+)?)\s*[-–]\s*(-?\d+(?:[.,]\d+)?)/);
  if (span) {
    return `${span[1].replace(",", ".")}-${span[2].replace(",", ".")}`;
  }

  const under = normalized.match(/(?:^|\s)(<|<=)\s*(-?\d+(?:[.,]\d+)?)/);
  if (under) return `${under[1]}${under[2].replace(",", ".")}`;

  const over = normalized.match(/(?:^|\s)(>|>=)\s*(-?\d+(?:[.,]\d+)?)/);
  if (over) return `${over[1]}${over[2].replace(",", ".")}`;

  return null;
}

function splitCandidateLines(text) {
  const raw = String(text || "").split("\0").join(" ").replace(/\r/g, "\n");

  let lines = raw
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (lines.length < 3) {
    lines = raw
      .split(/(?<=[\da-zA-Z])\s{2,}(?=[a-zA-Z])/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);
  }

  if (!lines.length) return [];

  return lines.map((original) => ({
    original,
    normalized: normalizeText(original),
  }));
}

function markerCandidateScore(marker, line, normalizedValue, detectedUnit) {
  let score = 0;

  if (Number.isFinite(normalizedValue.value)) score += 3;
  if (detectedUnit) score += 2;
  if (marker.aliasExactRegex.test(line.normalized)) score += 2;
  if ((line.normalized || "").length <= 140) score += 1;

  return score;
}

function findCandidateForMarker(lines, marker) {
  let best = null;

  lines.forEach((line) => {
    const aliasIndex = line.normalized.search(marker.aliasRegex);
    if (aliasIndex === -1) return;

    const aliasMatch = line.normalized.match(marker.aliasRegex);
    const aliasEnd = aliasIndex + (aliasMatch?.[0]?.length || 0);

    const afterSegment = line.normalized.slice(aliasEnd, aliasEnd + 90);
    const afterTokens = extractNumberTokens(afterSegment);
    let valueToken = pickValueToken(afterTokens, afterSegment, false);

    if (!valueToken) {
      const beforeSegment = line.normalized.slice(Math.max(0, aliasIndex - 60), aliasIndex);
      const beforeTokens = extractNumberTokens(beforeSegment);
      valueToken = pickValueToken(beforeTokens, beforeSegment, true);
    }

    if (!valueToken) return;

    const detectedUnit = detectUnit(line.normalized, marker);
    const normalizedValue = normalizeMarkerValue(marker, valueToken.value, detectedUnit);
    const extractedRange = extractRangeFromLine(line.normalized);
    const range = normalizedValue.converted ? marker.range || extractedRange || null : extractedRange || marker.range || null;
    const flag = evaluateFlag(normalizedValue.value, range, valueToken.operator);
    const score = markerCandidateScore(marker, line, normalizedValue, detectedUnit);

    const candidate = {
      marker,
      name: marker.name,
      value: normalizedValue.value,
      unit: normalizedValue.unit || marker.unit || null,
      range,
      flag,
      _score: score,
    };

    if (!best || candidate._score > best._score) {
      best = candidate;
    }
  });

  return best;
}

function confidenceLevelByCount(count) {
  if (count >= 10) return "high";
  if (count >= 5) return "medium";
  return "low";
}

function buildExtractionFromCandidates(candidates, sourceType, method, notes = [], warnings = [], rawConfidence = null, sourceMeta = null) {
  const panels = emptyPanels();
  const selectedMarkerIds = [];

  MARKERS.forEach((marker) => {
    const candidate = candidates.get(marker.id);
    if (!candidate || candidate.value === null) return;

    panels[marker.panel].push({
      name: candidate.name,
      value: candidate.value,
      unit: candidate.unit,
      range: candidate.range || marker.range || null,
      flag: candidate.flag || "unknown",
    });

    selectedMarkerIds.push(marker.id);
  });

  const extractedFields = selectedMarkerIds.length;
  const overall = confidenceLevelByCount(extractedFields);

  if (MARKERS.length !== extractedFields) {
    warnings.push(`Au fost identificate ${extractedFields}/${MARKERS.length} valori relevante pentru planul alimentar.`);
  }

  if (extractedFields === 0) {
    warnings.push("Nu s-au detectat valori utile pentru personalizarea planului alimentar.");
  }

  return {
    extracted: {
      source: {
        type: sourceType,
        detectedDate: sourceMeta?.detectedDate || null,
        labName: sourceMeta?.labName || null,
      },
      panels,
      notes,
      warnings,
    },
    confidence: {
      method,
      overall,
      extractedFields,
      raw: rawConfidence,
    },
  };
}

function fallbackExtractLabs(text, sourceType = "unknown") {
  const lines = splitCandidateLines(text);
  const candidates = new Map();

  MARKERS.forEach((marker) => {
    const candidate = findCandidateForMarker(lines, marker);
    if (candidate) candidates.set(marker.id, candidate);
  });

  return buildExtractionFromCandidates(
    candidates,
    sourceType,
    "heuristic-v2",
    ["Au fost pastrati doar markerii relevanti pentru compunerea planului alimentar."],
    ["Incredere redusa. Verifica manual valorile inainte de utilizare clinica."]
  );
}

async function callAi(path, payload) {
  if (pointsToSelf()) return null;
  if (!API_URL) return null;

  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        api_key: API_KEY || "",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function normalizeAiPanelsToEntries(rawPanels) {
  const entries = [];

  Object.values(rawPanels || {}).forEach((panelValue) => {
    if (Array.isArray(panelValue)) {
      panelValue.forEach((entry) => entries.push(entry));
      return;
    }

    if (panelValue && typeof panelValue === "object") {
      Object.entries(panelValue).forEach(([name, value]) => {
        if (value && typeof value === "object") {
          entries.push({ name, ...value });
        } else {
          entries.push({ name, value });
        }
      });
    }
  });

  return entries;
}

function normalizeAiLabs(data, sourceType) {
  const extracted = data?.extracted || data?.labs || data;
  if (!extracted || typeof extracted !== "object") return null;

  const entries = normalizeAiPanelsToEntries(extracted.panels || {});
  const candidates = new Map();

  entries.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;

    const rawName = String(entry.name || entry.parameter || entry.test || entry.marker || entry.analyte || "").trim();
    if (!rawName) return;

    const normalizedName = normalizeText(rawName);
    const marker = MARKERS.find((item) => item.aliasExactRegex.test(normalizedName) || item.aliasRegex.test(normalizedName));
    if (!marker) return;

    const rawValue = toNumber(String(entry.value ?? entry.result ?? entry.numericValue ?? ""));
    if (rawValue === null) return;

    const rawUnit = String(entry.unit || "").trim();
    const detectedUnit = detectUnit(normalizeText(rawUnit), marker) || rawUnit || marker.unit;
    const normalizedValue = normalizeMarkerValue(marker, rawValue, detectedUnit);

    const aiRange = typeof entry.range === "string" && entry.range.trim() ? entry.range.trim() : null;
    const rangeText = normalizedValue.converted ? marker.range || aiRange || null : aiRange || marker.range || null;
    const flag = String(entry.flag || evaluateFlag(normalizedValue.value, rangeText, null) || "unknown");

    const candidate = {
      marker,
      name: marker.name,
      value: normalizedValue.value,
      unit: normalizedValue.unit || marker.unit || null,
      range: rangeText,
      flag,
      _score: 5 + (rawUnit ? 1 : 0) + (rangeText ? 1 : 0),
    };

    const previous = candidates.get(marker.id);
    if (!previous || candidate._score > previous._score) {
      candidates.set(marker.id, candidate);
    }
  });

  const notes = Array.isArray(extracted.notes) ? [...extracted.notes] : [];
  notes.push("Din raport au fost pastrate doar valorile relevante pentru planul alimentar.");

  const warnings = Array.isArray(extracted.warnings) ? [...extracted.warnings] : [];

  return buildExtractionFromCandidates(
    candidates,
    sourceType,
    "ai",
    notes,
    warnings,
    data?.confidence || null,
    extracted?.source || null
  );
}

function chooseBestExtraction(candidates) {
  if (!Array.isArray(candidates) || !candidates.length) return null;

  const sorted = [...candidates].sort((left, right) => {
    const leftCount = Number(left?.confidence?.extractedFields || 0);
    const rightCount = Number(right?.confidence?.extractedFields || 0);
    if (leftCount !== rightCount) return rightCount - leftCount;

    const leftIsAi = left?.confidence?.method === "ai";
    const rightIsAi = right?.confidence?.method === "ai";
    if (leftIsAi !== rightIsAi) return leftIsAi ? -1 : 1;

    return 0;
  });

  return sorted[0];
}

export async function extractLabsWithAI(text, sourceType = "unknown") {
  const payload = {
    text,
    locale: "ro",
    schema: "labs-v2-relevant-markers",
  };

  const candidates = [];

  const direct = await callAi("/extract-labs", payload);
  const normalizedDirect = normalizeAiLabs(direct, sourceType);
  if (normalizedDirect) candidates.push(normalizedDirect);

  const suggest = await callAi("/suggest", payload);
  const normalizedSuggest = normalizeAiLabs(suggest, sourceType);
  if (normalizedSuggest) candidates.push(normalizedSuggest);

  candidates.push(fallbackExtractLabs(text, sourceType));

  return chooseBestExtraction(candidates);
}

function hasValidWeeklyPlan(plan) {
  return Boolean(plan && typeof plan === "object" && Array.isArray(plan.weeklyPlan) && plan.weeklyPlan.length >= 7);
}

const DEFAULT_RO_DAY_NAMES = ["Luni", "Marti", "Miercuri", "Joi", "Vineri", "Sambata", "Duminica"];
const PLAN_TEMPERATURE = Number(process.env.AI_PLAN_TEMPERATURE || 0.2);
const PLAN_MAX_OUTPUT_TOKENS = Number(process.env.AI_PLAN_MAX_OUTPUT_TOKENS || 2600);
const MAX_PLAN_REPAIR_ATTEMPTS = Math.max(0, Number(process.env.AI_PLAN_REPAIR_ATTEMPTS || 2));
const FOOD_QUANTITY_REGEX = /\b\d+(?:[.,]\d+)?\s*(g|gr|gram|grame|ml|buc|bucata|bucati|felie|felii|lingura|linguri|lingurita|lingurite)\b/i;
const FOOD_GRAMS_REGEX = /\b(\d+(?:[.,]\d+)?)\s*(g|gr|gram|grame)\b/i;
const MAX_DAY_MENU_REPEATS = 2;
const GENERIC_RESTRICTION_TERMS = new Set([
  "none",
  "nimic",
  "fara",
  "fara restrictii",
  "nu",
  "n/a",
  "na",
  "-",
  "niciuna",
  "niciuna cunoscuta",
  "none known",
]);

function normalizeMealList(rawMeals) {
  if (Array.isArray(rawMeals)) {
    return rawMeals
      .map((meal, index) => {
        const fallbackSlot = `Masa ${index + 1}`;
        const foods = Array.isArray(meal?.foods)
          ? meal.foods
          : Array.isArray(meal?.items)
            ? meal.items
            : [];
        return {
          slot: String(meal?.slot || meal?.name || fallbackSlot),
          foods: foods.map((item) => String(item || "").trim()).filter(Boolean),
        };
      })
      .filter((meal) => meal.foods.length);
  }

  if (rawMeals && typeof rawMeals === "object") {
    return Object.entries(rawMeals)
      .map(([key, meal]) => {
        const foods = Array.isArray(meal?.foods)
          ? meal.foods
          : Array.isArray(meal?.items)
            ? meal.items
            : [];
        return {
          slot: String(meal?.slot || key),
          foods: foods.map((item) => String(item || "").trim()).filter(Boolean),
        };
      })
      .filter((meal) => meal.foods.length);
  }

  return [];
}

function normalizeWeeklyPlan(rawWeeklyPlan) {
  if (Array.isArray(rawWeeklyPlan)) {
    return rawWeeklyPlan
      .map((dayEntry, index) => ({
        day: String(dayEntry?.day || dayEntry?.name || DEFAULT_RO_DAY_NAMES[index] || `Ziua ${index + 1}`),
        meals: normalizeMealList(dayEntry?.meals),
      }))
      .filter((entry) => entry.meals.length);
  }

  if (rawWeeklyPlan && typeof rawWeeklyPlan === "object") {
    const entries = Object.entries(rawWeeklyPlan);
    return entries
      .map(([key, dayEntry], index) => ({
        day: String(dayEntry?.day || dayEntry?.name || key || DEFAULT_RO_DAY_NAMES[index] || `Ziua ${index + 1}`),
        meals: normalizeMealList(dayEntry?.meals || dayEntry),
      }))
      .filter((entry) => entry.meals.length);
  }

  return [];
}

function normalizeAiPlanShape(plan) {
  if (!plan || typeof plan !== "object") return null;

  const normalizedWeeklyPlan = normalizeWeeklyPlan(plan.weeklyPlan);
  if (normalizedWeeklyPlan.length < 7) return null;

  const targetsInput = plan.targets && typeof plan.targets === "object" ? plan.targets : {};
  const targets = {
    kcal: toNumber(targetsInput.kcal),
    protein: toNumber(targetsInput.protein),
    carbs: toNumber(targetsInput.carbs),
    fat: toNumber(targetsInput.fat),
    fibre: toNumber(targetsInput.fibre),
  };
  const notes = Array.isArray(plan.notes)
    ? plan.notes.map((note) => String(note || "").trim()).filter(Boolean)
    : [];
  const fitness = Array.isArray(plan.fitness)
    ? plan.fitness.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const shoppingList = Array.isArray(plan.shoppingList)
    ? plan.shoppingList
        .map((item) => {
          if (item && typeof item === "object") {
            const name = String(item.item || item.name || "").trim();
            const quantity = String(item.quantity || item.amount || "").trim();
            if (name && quantity) return `${name} - ${quantity}`;
            if (name) return name;
            if (quantity) return quantity;
            return null;
          }
          const text = String(item || "").trim();
          return text || null;
        })
        .filter(Boolean)
    : [];
  const summary = String(plan.summary || "").trim();
  const disclaimer = String(plan.disclaimer || "").trim();

  return {
    ...plan,
    weeklyPlan: normalizedWeeklyPlan,
    targets,
    notes,
    fitness,
    shoppingList,
    summary,
    disclaimer,
  };
}

function safeJsonParse(rawText) {
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function extractJsonCandidate(rawText) {
  const text = String(rawText || "").trim();
  if (!text) return null;

  const direct = safeJsonParse(text);
  if (direct) return direct;

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  return safeJsonParse(text.slice(start, end + 1));
}

function extractResponsesParsedObject(payload) {
  const outputItems = Array.isArray(payload?.output) ? payload.output : [];

  for (const outputItem of outputItems) {
    const contentItems = Array.isArray(outputItem?.content) ? outputItem.content : [];
    for (const contentItem of contentItems) {
      if (contentItem?.parsed && typeof contentItem.parsed === "object") {
        return contentItem.parsed;
      }
      if (contentItem?.json && typeof contentItem.json === "object") {
        return contentItem.json;
      }
    }
  }

  return null;
}

function extractResponsesOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const outputItems = Array.isArray(payload?.output) ? payload.output : [];
  const chunks = [];

  outputItems.forEach((outputItem) => {
    const contentItems = Array.isArray(outputItem?.content) ? outputItem.content : [];
    contentItems.forEach((contentItem) => {
      if (contentItem?.type === "output_text" && typeof contentItem?.text === "string" && contentItem.text.trim()) {
        chunks.push(contentItem.text.trim());
      }
    });
  });

  return chunks.join("\n").trim();
}

function hasLabsSnapshot(labs) {
  if (!labs) return false;
  if (typeof labs === "string") return Boolean(labs.trim());
  if (Array.isArray(labs)) return labs.length > 0;
  if (typeof labs !== "object") return false;

  const panels = labs?.panels;
  if (panels && typeof panels === "object") {
    return Object.values(panels).some((value) => Array.isArray(value) && value.length > 0);
  }

  return Object.keys(labs).length > 0;
}

function inferMissingPlanInputs(profile, labs) {
  const missing = [];
  const profileObj = profile && typeof profile === "object" ? profile : {};

  const fields = [
    { keys: ["sex"], label: "sex" },
    { keys: ["age"], label: "age" },
    { keys: ["height_cm", "heightCm"], label: "inaltime" },
    { keys: ["weight_kg", "weightKg"], label: "greutate" },
    { keys: ["goal"], label: "obiectiv" },
    { keys: ["activity_level", "activityLevel"], label: "nivel activitate" },
  ];

  fields.forEach(({ keys, label }) => {
    const value = keys.map((key) => profileObj?.[key]).find((item) => item !== undefined && item !== null && item !== "");
    if (value === undefined || value === null || value === "") missing.push(label);
  });

  const hasPrefs = Boolean(String(profileObj?.dietary_prefs || profileObj?.dietaryPrefs || "").trim());
  if (!hasPrefs) missing.push("preferinte alimentare");

  const hasAllergies = Boolean(String(profileObj?.allergies || "").trim());
  if (!hasAllergies) missing.push("alergii/intolerante");

  if (!hasLabsSnapshot(labs)) missing.push("analize de laborator");

  return Array.from(new Set(missing));
}

function appendMissingInfoNotes(plan, missingInputs) {
  const normalizedPlan = normalizeAiPlanShape(plan);
  if (!normalizedPlan) return null;

  const notes = Array.isArray(normalizedPlan.notes) ? [...normalizedPlan.notes] : [];
  (missingInputs || []).forEach((field) => {
    const note = `Lipsa: ${field}. S-a aplicat o presupunere conservatoare.`;
    if (!notes.some((existing) => normalizeText(existing) === normalizeText(note))) {
      notes.push(note);
    }
  });

  return {
    ...normalizedPlan,
    notes,
  };
}

function extractRestrictionTerms(profile) {
  const profileObj = profile && typeof profile === "object" ? profile : {};
  const raw = [profileObj?.allergies, profileObj?.dietary_prefs, profileObj?.dietaryPrefs]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const terms = [];

  raw.forEach((entry) => {
    const segments = entry
      .split(/[,;\n|/]+/)
      .map((segment) => normalizeText(segment))
      .map((segment) => segment.replace(/^fara\s+/, "").replace(/^intoleranta la\s+/, "").trim())
      .filter((segment) => segment.length >= 3 && !GENERIC_RESTRICTION_TERMS.has(segment));
    terms.push(...segments);
  });

  return Array.from(new Set(terms));
}

function foodHasExplicitQuantity(food) {
  const text = String(food || "").trim();
  if (!text) return false;
  if (FOOD_QUANTITY_REGEX.test(text)) return true;
  return /\b\d+(?:[.,]\d+)?\b/.test(text);
}

function extractFoodGrams(food) {
  const match = String(food || "").match(FOOD_GRAMS_REGEX);
  if (!match) return null;
  return toNumber(match[1]);
}

function validateMacroConsistency(targets) {
  const kcal = toNumber(targets?.kcal);
  const protein = toNumber(targets?.protein);
  const carbs = toNumber(targets?.carbs);
  const fat = toNumber(targets?.fat);
  const fibre = toNumber(targets?.fibre);
  const errors = [];

  const missingTargets = [
    ["kcal", kcal],
    ["protein", protein],
    ["carbs", carbs],
    ["fat", fat],
    ["fibre", fibre],
  ]
    .filter(([, value]) => value === null)
    .map(([name]) => name);
  if (missingTargets.length > 0) {
    errors.push(`Targets lipsa sau invalide: ${missingTargets.join(", ")}.`);
    return errors;
  }

  if (kcal <= 0 || protein <= 0 || carbs <= 0 || fat <= 0 || fibre < 0) {
    errors.push("Targets trebuie sa fie valori pozitive (fibre poate fi 0).");
    return errors;
  }

  const expectedKcal = protein * 4 + carbs * 4 + fat * 9;
  const maxDeviation = Math.max(120, kcal * 0.1);
  const deviation = Math.abs(kcal - expectedKcal);
  if (deviation > maxDeviation) {
    errors.push(
      `Inconsistenta macro/kcal: kcal=${Math.round(kcal)}, calcul macro=${Math.round(expectedKcal)} (abatere ${Math.round(deviation)}).`
    );
  }

  return errors;
}

function validatePlanQuality(plan, profile, labs) {
  const normalizedPlan = normalizeAiPlanShape(plan);
  if (!normalizedPlan) return ["Plan invalid: weeklyPlan lipsa sau incomplet."];

  const errors = [];
  const weeklyPlan = normalizedPlan.weeklyPlan.slice(0, 7);

  weeklyPlan.forEach((day, dayIndex) => {
    const dayLabel = String(day?.day || `Ziua ${dayIndex + 1}`);
    if (!Array.isArray(day?.meals)) {
      errors.push(`${dayLabel}: meals lipsa.`);
      return;
    }

    if (day.meals.length < 3 || day.meals.length > 5) {
      errors.push(`${dayLabel}: numar mese invalid (${day.meals.length}). Sunt permise 3-5 mese/zi.`);
    }

    day.meals.forEach((meal, mealIndex) => {
      const slot = String(meal?.slot || `Masa ${mealIndex + 1}`);
      const foods = Array.isArray(meal?.foods) ? meal.foods : [];

      if (!foods.length) {
        errors.push(`${dayLabel} / ${slot}: foods lipsa.`);
        return;
      }

      foods.forEach((food) => {
        const text = String(food || "").trim();
        if (!text) return;

        if (!foodHasExplicitQuantity(text)) {
          errors.push(`${dayLabel} / ${slot}: aliment fara cantitate explicita -> "${text}".`);
        }

        const grams = extractFoodGrams(text);
        if (grams !== null && (grams < 10 || grams > 700)) {
          errors.push(`${dayLabel} / ${slot}: cantitate improbabila (${grams}g) -> "${text}".`);
        }
      });
    });
  });

  const bySignature = new Map();
  weeklyPlan.forEach((day) => {
    const signature = day.meals
      .map((meal) => {
        const foods = (meal.foods || []).map((food) => normalizeText(food)).join("|");
        return `${normalizeText(meal.slot)}:${foods}`;
      })
      .join("||");
    const current = bySignature.get(signature) || 0;
    bySignature.set(signature, current + 1);
  });
  bySignature.forEach((count) => {
    if (count > MAX_DAY_MENU_REPEATS) {
      errors.push(`Meniu repetat identic in ${count} zile. Maxim permis: ${MAX_DAY_MENU_REPEATS}.`);
    }
  });

  errors.push(...validateMacroConsistency(normalizedPlan.targets || {}));

  if (!normalizedPlan.summary || normalizedPlan.summary.length < 40) {
    errors.push("Summary prea scurt sau lipsa (minim 40 caractere).");
  }

  if (!normalizedPlan.disclaimer || normalizedPlan.disclaimer.length < 20) {
    errors.push("Disclaimer lipsa sau prea scurt.");
  }

  const restrictions = extractRestrictionTerms(profile);
  if (restrictions.length > 0) {
    weeklyPlan.forEach((day) => {
      day.meals.forEach((meal) => {
        meal.foods.forEach((food) => {
          const normalizedFood = normalizeText(food);
          restrictions.forEach((term) => {
            if (term && normalizedFood.includes(term)) {
              errors.push(`Restrictie incalcata (${term}) in alimentul "${food}".`);
            }
          });
        });
      });
    });
  }

  const missingInputs = inferMissingPlanInputs(profile, labs);
  const notesNormalized = new Set((normalizedPlan.notes || []).map((note) => normalizeText(note)));
  missingInputs.forEach((field) => {
    const expectedPrefix = normalizeText(`Lipsa: ${field}`);
    const hasMissingNote = Array.from(notesNormalized).some((note) => note.startsWith(expectedPrefix));
    if (!hasMissingNote) {
      errors.push(`Lipseste nota obligatorie pentru campul necompletat: ${field}.`);
    }
  });

  return Array.from(new Set(errors)).slice(0, 25);
}

function buildPlanPromptContext(profile, labs) {
  const missingInputs = inferMissingPlanInputs(profile, labs);
  return {
    systemPrompt:
      "Esti nutritionist sportiv clinician. Generezi EXCLUSIV pe baza datelor primite. Nu inventa analize, diagnostice, alergii, preferinte, alimente sau restrictii. Daca lipsesc informatii, mentioneaza explicit in notes cu prefixul 'Lipsa:' si aplica presupuneri conservatoare. Returneaza DOAR JSON valid conform schemei.",
    userPayload: {
      profile,
      labs,
      locale: "ro",
      missingInputs,
      constraints: [
        "Raspunsul trebuie sa fie obiect JSON valid.",
        "weeklyPlan are exact 7 zile.",
        "Fiecare zi are 3-5 mese.",
        "Fiecare aliment trebuie sa aiba cantitate explicita (g/ml/buc).",
        "Respecta strict alergiile/intolerantele si preferintele alimentare din profil.",
        "Nu repeta acelasi meniu identic mai mult de 2 zile.",
        "Include targets (kcal, protein, carbs, fat, fibre).",
        "Consistenta calorica: kcal ~ 4*protein + 4*carbs + 9*fat (abatere max 10%).",
        "Include summary, notes, fitness, shoppingList, disclaimer.",
        "Nu include markdown, explicatii in afara JSON-ului sau campuri in plus.",
      ],
    },
  };
}

function buildPlanRepairPromptContext(profile, labs, invalidPlan, validationErrors) {
  const missingInputs = inferMissingPlanInputs(profile, labs);
  return {
    systemPrompt:
      "Esti nutritionist sportiv clinician. Corectezi un plan alimentar JSON invalid. Nu inventa date noi; foloseste exclusiv informatiile din profile/labs/plan si corecteaza minimul necesar. Returneaza doar JSON valid conform schemei.",
    userPayload: {
      locale: "ro",
      profile,
      labs,
      missingInputs,
      invalidPlan,
      validationErrors,
      instructions: [
        "Pastreaza structura JSON si corecteaza doar erorile raportate.",
        "Fiecare zi trebuie sa aiba 3-5 mese.",
        "Fiecare aliment trebuie sa includa cantitate explicita.",
        "Respecta strict alergiile/intolerantele.",
        "Asigura consistenta targets kcal/macros.",
        "Nu adauga explicatii in afara JSON-ului.",
      ],
    },
  };
}

function extractGoogleOutputText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";

  return parts
    .map((part) => (typeof part?.text === "string" ? part.text.trim() : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function callGoogleForPlan(profile, labs) {
  if (!GOOGLE_API_KEY) return null;

  const { systemPrompt, userPayload } = buildPlanPromptContext(profile, labs);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT_MS);
  const model = encodeURIComponent(GOOGLE_PLAN_MODEL);
  const key = encodeURIComponent(GOOGLE_API_KEY);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: JSON.stringify(userPayload) }],
          },
        ],
        generationConfig: {
          temperature: PLAN_TEMPERATURE,
          responseMimeType: "application/json",
          responseJsonSchema: GOOGLE_PLAN_RESPONSE_JSON_SCHEMA,
        },
      }),
    });

    if (!response.ok) return null;

    const payload = await response.json();
    const content = extractGoogleOutputText(payload);
    const parsed = extractJsonCandidate(content);
    if (!parsed || typeof parsed !== "object") return null;

    const plan = normalizeAiPlanShape(parsed.plan || parsed);
    if (!hasValidWeeklyPlan(plan)) return null;

    return plan;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function callGoogleRepairForPlan(profile, labs, invalidPlan, validationErrors) {
  if (!GOOGLE_API_KEY) return null;

  const { systemPrompt, userPayload } = buildPlanRepairPromptContext(profile, labs, invalidPlan, validationErrors);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT_MS);
  const model = encodeURIComponent(GOOGLE_PLAN_MODEL);
  const key = encodeURIComponent(GOOGLE_API_KEY);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: JSON.stringify(userPayload) }],
          },
        ],
        generationConfig: {
          temperature: PLAN_TEMPERATURE,
          responseMimeType: "application/json",
          responseJsonSchema: GOOGLE_PLAN_RESPONSE_JSON_SCHEMA,
        },
      }),
    });

    if (!response.ok) return null;

    const payload = await response.json();
    const content = extractGoogleOutputText(payload);
    const parsed = extractJsonCandidate(content);
    if (!parsed || typeof parsed !== "object") return null;

    const plan = normalizeAiPlanShape(parsed.plan || parsed);
    if (!hasValidWeeklyPlan(plan)) return null;

    return plan;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAiResponsesApi(systemPrompt, userPayload, signal) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_PLAN_MODEL,
      temperature: PLAN_TEMPERATURE,
      max_output_tokens: PLAN_MAX_OUTPUT_TOKENS,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: JSON.stringify(userPayload) }],
        },
      ],
      text: {
        format: OPENAI_PLAN_TEXT_FORMAT,
      },
    }),
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function callOpenAiChatCompletionsApi(systemPrompt, userPayload, signal) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_PLAN_MODEL,
      temperature: PLAN_TEMPERATURE,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
    }),
  });

  if (!response.ok) return null;

  const payload = await response.json();
  return payload?.choices?.[0]?.message?.content || "";
}

async function callOpenAiRepairForPlan(profile, labs, invalidPlan, validationErrors) {
  if (!OPENAI_API_KEY) return null;

  const { systemPrompt, userPayload } = buildPlanRepairPromptContext(profile, labs, invalidPlan, validationErrors);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const responsesPayload = await callOpenAiResponsesApi(systemPrompt, userPayload, controller.signal);
    const responseParsed = extractResponsesParsedObject(responsesPayload);
    const responseText = extractResponsesOutputText(responsesPayload);
    const parsedFromResponses = responseParsed || extractJsonCandidate(responseText);
    if (parsedFromResponses && typeof parsedFromResponses === "object") {
      const repaired = normalizeAiPlanShape(parsedFromResponses.plan || parsedFromResponses);
      if (hasValidWeeklyPlan(repaired)) return repaired;
    }

    const legacyContent = await callOpenAiChatCompletionsApi(systemPrompt, userPayload, controller.signal);
    const parsed = extractJsonCandidate(legacyContent);
    if (!parsed || typeof parsed !== "object") return null;

    const repaired = normalizeAiPlanShape(parsed.plan || parsed);
    if (!hasValidWeeklyPlan(repaired)) return null;

    return repaired;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAiForPlan(profile, labs) {
  if (!OPENAI_API_KEY) return null;
  const { systemPrompt, userPayload } = buildPlanPromptContext(profile, labs);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const responsesPayload = await callOpenAiResponsesApi(systemPrompt, userPayload, controller.signal);
    const responseParsed = extractResponsesParsedObject(responsesPayload);
    const responseText = extractResponsesOutputText(responsesPayload);
    const parsedFromResponses = responseParsed || extractJsonCandidate(responseText);
    if (parsedFromResponses && typeof parsedFromResponses === "object") {
      const responsesPlan = normalizeAiPlanShape(parsedFromResponses.plan || parsedFromResponses);
      if (hasValidWeeklyPlan(responsesPlan)) {
        return responsesPlan;
      }
    }

    const legacyContent = await callOpenAiChatCompletionsApi(systemPrompt, userPayload, controller.signal);
    const parsed = extractJsonCandidate(legacyContent);
    if (!parsed || typeof parsed !== "object") return null;

    const plan = normalizeAiPlanShape(parsed.plan || parsed);
    if (!hasValidWeeklyPlan(plan)) return null;

    return plan;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function getRepairProviderOrder(preferredProvider = "base44") {
  const normalized = String(preferredProvider || "base44").toLowerCase();
  const order = [];

  if (normalized === "google") {
    order.push("google", "openai");
  } else if (normalized === "openai") {
    order.push("openai", "google");
  } else {
    order.push("google", "openai");
  }

  return order.filter((provider, index) => order.indexOf(provider) === index);
}

async function repairPlanCandidate(plan, profile, labs, validationErrors, preferredProvider = "base44") {
  let currentPlan = normalizeAiPlanShape(plan);
  if (!currentPlan) return null;

  let errors = Array.isArray(validationErrors) ? [...validationErrors] : validatePlanQuality(currentPlan, profile, labs);
  if (!errors.length) return currentPlan;

  const order = getRepairProviderOrder(preferredProvider);

  for (let attempt = 0; attempt < MAX_PLAN_REPAIR_ATTEMPTS; attempt += 1) {
    let repaired = null;

    for (const provider of order) {
      if (provider === "google") {
        repaired = await callGoogleRepairForPlan(profile, labs, currentPlan, errors);
      } else if (provider === "openai") {
        repaired = await callOpenAiRepairForPlan(profile, labs, currentPlan, errors);
      }

      if (repaired) break;
    }

    if (!repaired) return null;

    currentPlan = normalizeAiPlanShape(repaired);
    if (!currentPlan) return null;

    const missingInputs = inferMissingPlanInputs(profile, labs);
    currentPlan = appendMissingInfoNotes(currentPlan, missingInputs);
    if (!currentPlan) return null;

    errors = validatePlanQuality(currentPlan, profile, labs);
    if (!errors.length) return currentPlan;
  }

  return null;
}

async function finalizePlanCandidate(candidatePlan, profile, labs, source = "base44") {
  const normalized = normalizeAiPlanShape(candidatePlan);
  if (!normalized) return null;

  const missingInputs = inferMissingPlanInputs(profile, labs);
  const enriched = appendMissingInfoNotes(normalized, missingInputs);
  if (!enriched) return null;

  const errors = validatePlanQuality(enriched, profile, labs);
  if (!errors.length) return enriched;

  return repairPlanCandidate(enriched, profile, labs, errors, source);
}

export async function generatePlanWithAI(profile, labs) {
  const payload = { profile, labs, locale: "ro" };
  const result = await callAi("/generate-plan", payload);
  const base44Plan = await finalizePlanCandidate(result?.plan || result, profile, labs, "base44");
  if (base44Plan) return base44Plan;

  const googleRawPlan = await callGoogleForPlan(profile, labs);
  const googlePlan = await finalizePlanCandidate(googleRawPlan, profile, labs, "google");
  if (googlePlan) return googlePlan;

  const openAiRawPlan = await callOpenAiForPlan(profile, labs);
  const openAiPlan = await finalizePlanCandidate(openAiRawPlan, profile, labs, "openai");
  if (openAiPlan) return openAiPlan;

  return null;
}

export async function summarizeContentItemWithAI(article) {
  const prompt = {
    locale: "ro",
    type: "content-refresh-summary",
    article,
    instructions: [
      "Genereaza un titlu scurt in romana daca cel existent este in alta limba.",
      "Genereaza un rezumat factual in 3-4 propozitii.",
      "Genereaza 3 idei cheie in bullet points.",
      "Evidentiaza aplicabilitatea practica pentru nutritie/fitness in 2 propozitii.",
      "Nu inventa date care nu sunt in articol.",
    ],
  };

  const direct = await callAi("/suggest", prompt);
  const suggestion = direct?.suggestion || direct?.summary || null;
  if (!suggestion) return null;

  return {
    summaryText: String(suggestion),
    model: "base44-suggest",
  };
}
