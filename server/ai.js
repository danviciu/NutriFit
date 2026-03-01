/* global process */
import dotenv from "dotenv";

dotenv.config({ path: "./server/.env" });

const API_KEY = process.env.BASE44_API_KEY;
const API_URL = process.env.BASE44_API_URL || "http://localhost:8787";
const SELF_PORT = process.env.PORT || "8787";
const PANEL_KEYS = ["cbc", "metabolic", "lipids", "thyroid", "inflammation", "other"];

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

export async function generatePlanWithAI(profile, labs) {
  const payload = { profile, labs, locale: "ro" };
  const result = await callAi("/generate-plan", payload);

  if (!result || typeof result !== "object") return null;

  const plan = result.plan || result;
  if (!plan || typeof plan !== "object") return null;

  return plan;
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
