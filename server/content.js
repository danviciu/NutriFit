import { summarizeContentItemWithAI } from "./ai.js";

const RSS_FEEDS = [
  {
    name: "ScienceDaily Health",
    topic: "medical",
    url: "https://www.sciencedaily.com/rss/health_medicine.xml",
  },
  {
    name: "ScienceDaily Nutrition",
    topic: "nutrition",
    url: "https://www.sciencedaily.com/rss/health_medicine/nutrition.xml",
  },
  {
    name: "Google News Nutrition",
    topic: "nutrition",
    url: "https://news.google.com/rss/search?q=nutritie+sanatate+cercetare&hl=ro&gl=RO&ceid=RO:ro",
  },
  {
    name: "Google News Fitness",
    topic: "fitness",
    url: "https://news.google.com/rss/search?q=fitness+antrenament+sanatate&hl=ro&gl=RO&ceid=RO:ro",
  },
];

const TRANSLATION_CACHE = new Map();

function decodeHtml(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/");
}

function stripTags(value) {
  return decodeHtml(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

const HEALTH_KEYWORDS = [
  /\bhealth\b/i,
  /\bsanat(?:ate|atii|os)\b/i,
  /\bmedical\b/i,
  /\bclinic(?:al)?\b/i,
  /\bpatient(?:s)?\b/i,
  /\bnutrition(?:al)?\b/i,
  /\bnutrit(?:ie|ional)\b/i,
  /\bdiet(?:a|ary)?\b/i,
  /\baliment(?:atie|ar)?\b/i,
  /\bprotein(?:e)?\b/i,
  /\bvitamin(?:a|e)?\b/i,
  /\bfiber|fibre|fibr[ae]\b/i,
  /\bcalori(?:e|ic)\b/i,
  /\bexercise|workout|training|fitness|cardio|strength\b/i,
  /\bantrenament|miscare|efort fizic\b/i,
  /\bmuscle|masa musculara\b/i,
  /\bsleep|somn\b/i,
  /\bstress|anxiet|depress|mental\b/i,
  /\bwellbeing|stare de bine|recuperare\b/i,
  /\bcholesterol|colesterol\b/i,
  /\bblood pressure|tensiune\b/i,
  /\bglyc(?:emia|emic)|glicem/i,
  /\bdiabet(?:es)?\b/i,
  /\bheart|cardio(?:vascular)?\b/i,
  /\bobesity|obez/i,
  /\binflammation|inflamat/i,
  /\bgut|microbiom/i,
  /\bhormone|hormon/i,
];

const HEALTH_STRONG_KEYWORDS = [
  /\bexercise|workout|training|fitness|antrenament\b/i,
  /\bnutrition|nutrit(?:ie|ional)|diet|aliment(?:atie|ar)\b/i,
  /\bcholesterol|colesterol|glicem|diabet|blood pressure|tensiune\b/i,
  /\bsleep|somn|stress|stres|mental\b/i,
  /\bpatient|clinic|medical|sanatate\b/i,
];

const OFF_TOPIC_KEYWORDS = [
  /\bmetal(?:e)? rare|rare metal|rare earth\b/i,
  /\bmethane|metan\b/i,
  /\bcatalyst|catalizator|photocatal(?:yst|izator)\b/i,
  /\bsemiconductor|battery|electrolyte|fuel cell\b/i,
  /\bcombust(?:ion|ibil)|petro(?:l|chem)|reactor\b/i,
  /\bpolymer|material science|nanotube\b/i,
  /\bquantum|astrophys|galaxy|planetary\b/i,
  /\bchemistr(?:y|ie)\b/i,
];

const HARD_OFF_TOPIC_KEYWORDS = [
  /\bmetan|methane\b/i,
  /\bcatalyst|catalizator|photocatal(?:yst|izator)\b/i,
  /\bmetal\w*\s+rare|rare earth\b/i,
  /\bfuel|combustibil|combust(?:ion|ie)\b/i,
  /\bsemiconductor|battery|electrolyte\b/i,
  /\bmaterial science|polymer|nanotube\b/i,
];

const CLINICAL_CONTEXT_KEYWORDS = [
  /\bpatient|patients|pacient\b/i,
  /\bclinical|clinic|trial|studiu clinic\b/i,
  /\bdisease|boala|simptom|tratament|therapy\b/i,
  /\bdiabet|cholesterol|colesterol|glicem|tensiune|heart|cardio\b/i,
  /\bnutrit|diet|aliment|exercise|workout|antrenament|fitness\b/i,
];

const ALWAYS_BLOCK_KEYWORDS = [
  /\bmetan|methane\b/i,
  /\bcatalyst|catalizator|photocatal(?:yst|izator)\b/i,
  /\bmetal\w*\s+rare|rare earth\b/i,
];

function countPatternMatches(text, patterns) {
  let count = 0;
  for (const pattern of patterns) {
    if (pattern.test(text)) count += 1;
  }
  return count;
}

export function isHealthRelevantContentPayload(payload = {}) {
  const text = [
    payload?.title || "",
    payload?.summary || "",
    payload?.description || "",
    payload?.body_markdown || "",
    Array.isArray(payload?.tags) ? payload.tags.join(" ") : "",
    Array.isArray(payload?.categories) ? payload.categories.join(" ") : "",
  ]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return false;
  if (countPatternMatches(text, ALWAYS_BLOCK_KEYWORDS) > 0) return false;

  const positive = countPatternMatches(text, HEALTH_KEYWORDS);
  const strong = countPatternMatches(text, HEALTH_STRONG_KEYWORDS);
  const offTopic = countPatternMatches(text, OFF_TOPIC_KEYWORDS);
  const hardOffTopic = countPatternMatches(text, HARD_OFF_TOPIC_KEYWORDS);
  const clinicalContext = countPatternMatches(text, CLINICAL_CONTEXT_KEYWORDS);

  if (offTopic >= 2 && strong === 0 && positive < 4) return false;
  if (hardOffTopic >= 1 && clinicalContext === 0) return false;
  if (strong >= 1 && positive >= 2) return true;
  if (positive >= 4) return true;

  const topic = String(payload?.topic || payload?.topicSeed || "").toLowerCase();
  if (topic === "nutrition") {
    return /(nutrit|diet|aliment|protein|vitamin|fibr|calori|macronutr)/i.test(text) && offTopic === 0;
  }

  if (topic === "fitness") {
    return /(fitness|antren|workout|exercise|muscle|cardio|strength|mobilit)/i.test(text) && offTopic === 0;
  }

  if (topic === "medical" || topic === "wellbeing") {
    return /(sanat|medical|patient|clinic|sleep|somn|stress|stres|cholesterol|colesterol|glicem|diabet|heart|cardio)/i.test(text) && offTopic < 2;
  }

  return false;
}

function countWords(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function scoreRomanianText(value) {
  const text = ` ${String(value || "").toLowerCase()} `;
  const markers = [
    " si ",
    " pentru ",
    " din ",
    " despre ",
    " sanat",
    " nutrit",
    " cercetar",
    " studiu",
    " aliment",
    " antren",
    " corp",
    " recomand",
  ];

  let score = /[ăâîșşțţ]/i.test(text) ? 2 : 0;
  for (const marker of markers) {
    if (text.includes(marker)) score += 1;
  }
  return score;
}

function isProbablyRomanian(value) {
  return scoreRomanianText(value) >= 2;
}

function topicLabelRo(topic) {
  if (topic === "fitness") return "fitness";
  if (topic === "medical") return "sanatate medicala";
  if (topic === "wellbeing") return "stare de bine";
  return "nutritie";
}

function fallbackKeyPointsByTopic(topic) {
  if (topic === "fitness") {
    return [
      "Concluzia principala poate influenta nivelul de efort, recuperarea si consistenta antrenamentelor.",
      "Aplica schimbari graduale in rutina, apoi urmareste energia, somnul si aderenta saptamanala.",
      "Confirma recomandarile cu sursa originala si adapteaza-le la contextul tau medical.",
    ];
  }

  if (topic === "medical") {
    return [
      "Datele prezentate au relevanta pentru markerii de sanatate urmariti in planul personal.",
      "Discutia cu specialistul ramane necesara cand apar simptome sau valori anormale.",
      "Integreaza informatia in aplicatie doar ca suport, nu ca diagnostic.",
    ];
  }

  if (topic === "wellbeing") {
    return [
      "Articolul leaga comportamentele zilnice de energie, stres si recuperare.",
      "Schimbarile mici, repetate constant, au impact mai mare decat interventiile agresive.",
      "Monitorizeaza evolutia in dashboard si ajusteaza progresiv obiceiurile.",
    ];
  }

  return [
    "Informatiile ajuta la imbunatatirea alegerilor alimentare si a organizarii meselor.",
    "Aplicarea practica trebuie facuta gradual, in functie de obiective si toleranta personala.",
    "Verifica periodic sursele si coreleaza cu indicatorii din plan.",
  ];
}

async function translateWithGoogle(text) {
  const response = await fetch(
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ro&dt=t&q=${encodeURIComponent(text)}`
  );
  if (!response.ok) return null;

  const payload = await response.json();
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) return null;

  const translated = payload[0]
    .map((entry) => (Array.isArray(entry) ? entry[0] : ""))
    .join("")
    .replace(/\s+/g, " ")
    .trim();

  return translated || null;
}

async function translateWithMyMemory(text) {
  const response = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|ro`
  );
  if (!response.ok) return null;

  const payload = await response.json();
  const translated = String(payload?.responseData?.translatedText || "")
    .replace(/\s+/g, " ")
    .trim();

  return translated || null;
}

async function translateToRomanian(text, fallback = "") {
  const clean = stripTags(text || "");
  if (!clean) return fallback || "";
  if (isProbablyRomanian(clean)) return clean;

  if (TRANSLATION_CACHE.has(clean)) return TRANSLATION_CACHE.get(clean);

  let translated = null;

  try {
    translated = await translateWithGoogle(clean);
  } catch {
    translated = null;
  }

  if (!translated) {
    try {
      translated = await translateWithMyMemory(clean);
    } catch {
      translated = null;
    }
  }

  const finalText = translated || fallback || clean;
  const normalized = finalText.replace(/\s+/g, " ").trim();
  TRANSLATION_CACHE.set(clean, normalized);
  return normalized;
}

function ensureRomanian(value, fallback) {
  const text = String(value || "").trim();
  if (!text) return fallback;
  return isProbablyRomanian(text) ? text : fallback;
}

function cleanHeadline(value) {
  let title = stripTags(value || "").replace(/\s+/g, " ").trim();

  // Remove source suffix patterns like " - Publication Name" from aggregated feeds.
  const sourceSuffix = /\s[-|]\s[A-Z0-9][A-Za-z0-9&.'’:_/()+-]*(?:\s+[A-Z0-9][A-Za-z0-9&.'’:_/()+-]*){0,7}$/;
  if (sourceSuffix.test(title)) {
    const candidate = title.replace(sourceSuffix, "").trim();
    if (candidate.length >= 32) title = candidate;
  }

  return title;
}

function summaryFromText(text, fallback) {
  const plain = stripTags(text || "");
  const sentences = plain.split(/(?<=[.!?])\s+/).filter(Boolean);
  const joined = sentences.slice(0, 2).join(" ").trim();
  return joined || fallback;
}

function looksLowQualityRomanian(item) {
  const title = String(item?.title || "").trim();
  const summary = String(item?.summary || "").trim();
  const normalize = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

  if (!title || !summary) return true;
  if (countWords(title) < 5 || title.length < 24) return true;
  if (countWords(summary) < 14 || summary.length < 95) return true;
  if (scoreRomanianText(title) < 2 || scoreRomanianText(summary) < 2) return true;
  if (/^\w+:\s*$/.test(title)) return true;

  const normalizedTitle = normalize(title);
  const normalizedSummary = normalize(summary);
  if (normalizedTitle && normalizedSummary === normalizedTitle) return true;
  if (normalizedTitle && normalizedSummary.includes(normalizedTitle) && countWords(summary) < 24) return true;
  if (/(stirile protv|hotnews|g4media|digi24|cnn|nature|national geographic)/i.test(summary) && countWords(summary) < 24) {
    return true;
  }

  return false;
}

function textFromTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? stripTags(match[1]) : "";
}

function allTags(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const values = [];
  let match = regex.exec(xml);
  while (match) {
    const cleaned = stripTags(match[1]);
    if (cleaned) values.push(cleaned);
    match = regex.exec(xml);
  }
  return values;
}

function parseRss(xml, source) {
  const itemRegex = /<item\b[\s\S]*?<\/item>/gi;
  const items = [];
  let match = itemRegex.exec(xml);

  while (match) {
    const block = match[0];
    const title = cleanHeadline(textFromTag(block, "title"));
    const link = textFromTag(block, "link");
    const description = textFromTag(block, "description");
    const publishedAt = textFromTag(block, "pubDate");
    const guid = textFromTag(block, "guid") || link;
    const categories = allTags(block, "category");

    if (title && link) {
      items.push({
        title,
        url: link,
        description,
        publishedAt,
        guid,
        categories,
        sourceName: source.name,
        sourceFeed: source.url,
        topicSeed: source.topic,
      });
    }

    match = itemRegex.exec(xml);
  }

  return items;
}

function estimateReadMinutes(text) {
  const words = String(text || "").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 210));
}

function normalizeTopic(article) {
  const text = `${article.title} ${article.description} ${(article.categories || []).join(" ")}`.toLowerCase();

  if (/(sleep|stress|mental|mind|anxiety|depress)/.test(text)) return "wellbeing";
  if (/(run|workout|training|exercise|cardio|strength|muscle|fitness)/.test(text)) return "fitness";
  if (/(cholesterol|glucose|insulin|blood|metabolic|diabetes|cardio|heart|clinic|medical)/.test(text)) return "medical";
  if (/(protein|diet|nutrition|food|meal|vitamin|minerals|fiber)/.test(text)) return "nutrition";

  return article.topicSeed || "nutrition";
}

function buildSlug(title, url) {
  const base = String(title || "articol")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 64) || "articol";

  let hash = 0;
  for (const ch of String(url || "")) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  const suffix = hash.toString(36).slice(0, 6) || "item";
  return `${base}-${suffix}`;
}

function toIsoDate(value) {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function fallbackSummary(article) {
  const plain = stripTags(article.description || "");
  const compact = plain || article.title;

  const sentences = compact.split(/(?<=[.!?])\s+/).filter(Boolean);
  const first = sentences.slice(0, 2).join(" ");

  const summaryText = first || `Articol relevant despre ${normalizeTopic(article)} publicat de ${article.sourceName}.`;

  const keyPoints = [
    "Context: informatii noi din surse publice de sanatate.",
    "Aplicabilitate: monitorizeaza impactul asupra alimentatiei si rutinei sportive.",
    "Actiune: verifica sursa originala pentru date complete si recomandari oficiale.",
  ];

  const practical =
    "Foloseste concluziile pentru a ajusta progresiv obiceiurile zilnice, apoi reevalueaza indicatorii din dashboard.";

  return {
    summaryText,
    keyPoints,
    practical,
    aiModel: "fallback-local",
  };
}

function parseAiSummary(summaryText, article) {
  const text = String(summaryText || "").replace(/\s+/g, " ").trim();
  const chunks = text.split(/(?<=[.!?])\s+/).filter(Boolean);

  const lead = chunks.slice(0, 3).join(" ") || fallbackSummary(article).summaryText;
  const keyPoints = [
    chunks[3] || "Urmareste datele relevante mentionate in articol si compara cu evolutia personala.",
    chunks[4] || "Aplica schimbarile gradual in planul alimentar si in rutina de miscare.",
    chunks[5] || "Valideaza periodic informatiile cu sursa originala si cu recomandarea medicului.",
  ];

  const practical =
    chunks[6] ||
    "Recomandarile se pot transforma in obiective concrete in aplicatie: aport caloric, aderenta si monitorizare saptamanala.";

  return { lead, keyPoints, practical };
}

async function enrichArticle(article) {
  const topic = normalizeTopic(article);
  const aiResult = await summarizeContentItemWithAI({
    title: article.title,
    source: article.sourceName,
    topic,
    description: article.description,
    url: article.url,
    publishedAt: article.publishedAt,
  });

  const parsed = aiResult?.summaryText ? parseAiSummary(aiResult.summaryText, article) : null;
  const fallback = fallbackSummary(article);
  const fallbackKeyPoints = fallbackKeyPointsByTopic(topic);

  const translatedTitle = await translateToRomanian(
    article.title,
    `Noutate din ${topicLabelRo(topic)} publicata de ${article.sourceName}`
  );
  const translatedLead = await translateToRomanian(
    parsed?.lead || fallback.summaryText,
    `Articol relevant despre ${topicLabelRo(topic)} publicat de ${article.sourceName}.`
  );

  const translatedPractical = await translateToRomanian(
    parsed?.practical || fallback.practical,
    "Foloseste informatia pentru ajustari graduale in alimentatie, miscare si recuperare."
  );

  const keyPoints = parsed?.keyPoints || fallback.keyPoints || [];
  const translatedKeyPoints = [];
  for (let index = 0; index < Math.max(3, keyPoints.length); index += 1) {
    const candidate = keyPoints[index] || fallbackKeyPoints[index] || fallbackKeyPoints[0];
    const translated = await translateToRomanian(candidate, fallbackKeyPoints[index] || fallbackKeyPoints[0]);
    translatedKeyPoints.push(ensureRomanian(translated, fallbackKeyPoints[index] || fallbackKeyPoints[0]));
  }

  const lead = ensureRomanian(
    translatedLead,
    `Articol relevant despre ${topicLabelRo(topic)} publicat de ${article.sourceName}.`
  );
  const leadFromDescription = summaryFromText(
    await translateToRomanian(
      article.description,
      `Articol relevant despre ${topicLabelRo(topic)} publicat de ${article.sourceName}.`
    ),
    lead
  );
  const normalizedLead =
    countWords(lead) >= 12 && lead.length >= 90
      ? lead
      : ensureRomanian(leadFromDescription, lead);

  const practical = ensureRomanian(
    translatedPractical,
    "Foloseste informatia pentru ajustari graduale in alimentatie, miscare si recuperare."
  );
  const titleRo = cleanHeadline(ensureRomanian(
    translatedTitle,
    `Noutate din ${topicLabelRo(topic)} publicata de ${article.sourceName}`
  ));

  const bodyMarkdown = [
    `## Ce este relevant`,
    normalizedLead,
    "",
    `## Idei cheie`,
    ...translatedKeyPoints.map((point) => `- ${point}`),
    "",
    `## Cum aplici in practica`,
    practical,
    "",
    `## Sursa`,
    `- Sursa: ${article.sourceName}`,
    `- ${article.url}`,
  ].join("\n");

  const readMinutes = estimateReadMinutes(`${normalizedLead} ${translatedKeyPoints.join(" ")} ${practical}`);

  return {
    slug: buildSlug(article.title, article.url),
    title: titleRo,
    summary: normalizedLead,
    body_markdown: bodyMarkdown,
    source_url: article.url,
    source_name: article.sourceName,
    source_feed: article.sourceFeed,
    topic,
    tags: [topic, "weekly-refresh", article.sourceName.toLowerCase().replace(/\s+/g, "-")],
    published_at: toIsoDate(article.publishedAt),
    updated_at: new Date().toISOString(),
    read_time_min: readMinutes,
    status: "published",
    ai_metadata: {
      model: aiResult?.model || fallback.aiModel,
      translation: "google-or-mymemory",
      refreshed_at: new Date().toISOString(),
    },
  };
}

async function fetchFeed(source) {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": "NutriFitContentBot/1.0 (+https://nutrifit.local)",
      Accept: "application/rss+xml, application/xml, text/xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Feed ${source.name} failed with status ${response.status}`);
  }

  const xml = await response.text();
  return parseRss(xml, source);
}

export async function collectWeeklyContent({ maxPerFeed = 6, maxItems = 20 } = {}) {
  const settled = await Promise.allSettled(RSS_FEEDS.map((feed) => fetchFeed(feed)));
  const all = [];

  settled.forEach((result) => {
    if (result.status === "fulfilled") {
      const deduped = result.value
        .filter((item) => item.title && item.url)
        .filter((item) =>
          isHealthRelevantContentPayload({
            title: item.title,
            description: item.description,
            categories: item.categories,
            topicSeed: item.topicSeed,
          })
        )
        .slice(0, maxPerFeed);
      all.push(...deduped);
    }
  });

  const uniqueMap = new Map();
  for (const item of all) {
    if (!uniqueMap.has(item.url)) uniqueMap.set(item.url, item);
  }

  const unique = Array.from(uniqueMap.values())
    .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime())
    .slice(0, maxItems);
  const relevantUnique = unique.filter((article) =>
    isHealthRelevantContentPayload({
      title: article.title,
      description: article.description,
      categories: article.categories,
      topicSeed: article.topicSeed,
    })
  );

  const enriched = [];
  for (const article of relevantUnique) {
    // Sequential enrichment keeps external AI usage controlled and predictable.
    const item = await enrichArticle(article);
    if (!looksLowQualityRomanian(item) && isHealthRelevantContentPayload(item)) {
      enriched.push(item);
    }
  }

  if (!enriched.length) {
    // As an emergency fallback, return minimally polished items instead of empty feed.
    for (const article of relevantUnique.slice(0, Math.min(8, relevantUnique.length))) {
      const topic = normalizeTopic(article);
      const fallbackLead = summaryFromText(
        await translateToRomanian(
          article.description,
          `Articol relevant despre ${topicLabelRo(topic)} publicat de ${article.sourceName}.`
        ),
        `Articol relevant despre ${topicLabelRo(topic)} publicat de ${article.sourceName}.`
      );

      enriched.push({
        slug: buildSlug(article.title, article.url),
        title: cleanHeadline(
          await translateToRomanian(article.title, `Noutate din ${topicLabelRo(topic)} publicata de ${article.sourceName}`)
        ),
        summary: fallbackLead,
        body_markdown: [
          "## Ce este relevant",
          fallbackLead,
          "",
          "## Idei cheie",
          "- Datele prezentate provin din sursa originala mentionata mai jos.",
          "- Informatiile sunt utile pentru orientare practica in nutritie si stil de viata.",
          "- Verifica recomandarile cu specialistul cand exista afectiuni medicale.",
          "",
          "## Cum aplici in practica",
          "Aplicarea trebuie facuta gradual, cu monitorizare saptamanala in dashboard.",
          "",
          "## Sursa",
          `- Sursa: ${article.sourceName}`,
          `- ${article.url}`,
        ].join("\n"),
        source_url: article.url,
        source_name: article.sourceName,
        source_feed: article.sourceFeed,
        topic,
        tags: [topic, "weekly-refresh", article.sourceName.toLowerCase().replace(/\s+/g, "-")],
        published_at: toIsoDate(article.publishedAt),
        updated_at: new Date().toISOString(),
        read_time_min: estimateReadMinutes(fallbackLead),
        status: "published",
        ai_metadata: {
          model: "fallback-local",
          translation: "google-or-mymemory",
          refreshed_at: new Date().toISOString(),
        },
      });
    }
  }

  return enriched.filter((item) => isHealthRelevantContentPayload(item));
}
