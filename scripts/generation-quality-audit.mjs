import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.GENERATION_AUDIT_BASE_URL || process.env.QUALITY_BASE_URL || "http://localhost:3000";
const REQUEST_TIMEOUT_MS = Number(process.env.GENERATION_AUDIT_TIMEOUT_MS || 120000);
const QA_BYPASS_KEY =
  process.env.GENERATION_AUDIT_QA_BYPASS_KEY ||
  process.env.QUALITY_QA_BYPASS_KEY ||
  process.env.SMOKE_QA_BYPASS_KEY ||
  process.env.GENERATE_QA_BYPASS_KEY ||
  "";
const OUTPUT_PATH = path.resolve(
  process.cwd(),
  process.env.GENERATION_AUDIT_OUTPUT_PATH || "test-results/generation-quality-audit-latest.json"
);

const CASES = [
  { contentMode: "sales", topic: "5 ошибок в рекламе недвижимости которые сжигают бюджет" },
  { contentMode: "sales", topic: "Почему клиенты уходят после первого визита и не возвращаются" },
  { contentMode: "expert", topic: "Почему щенок продолжает писать дома даже после прогулок" },
  { contentMode: "expert", topic: "3 привычки которые мешают похудеть даже при правильном питании" },
  { contentMode: "instruction", topic: "Как приучить щенка к туалету пошагово" },
  { contentMode: "instruction", topic: "Как подготовить квартиру к продаже за выходные" },
  { contentMode: "diagnostic", topic: "Почему реклама не приносит заявки хотя бюджет растёт" },
  { contentMode: "case", topic: "Как риелтор продал квартиру за 14 дней вместо 6 месяцев" },
  { contentMode: "social", topic: "Как я перестал бояться продавать в сторис" }
];

const FLOW_9_BY_MODE = {
  sales: ["hook", "problem", "amplify", "mistake", "consequence", "shift", "solution", "example", "cta"],
  expert: ["hook", "problem", "amplify", "mistake", "shift", "solution", "example", "consequence", "cta"],
  instruction: ["hook", "problem", "shift", "solution", "mistake", "amplify", "example", "consequence", "cta"],
  diagnostic: ["hook", "problem", "mistake", "consequence", "amplify", "shift", "solution", "example", "cta"],
  case: ["hook", "problem", "example", "amplify", "shift", "solution", "mistake", "consequence", "cta"],
  social: ["hook", "problem", "amplify", "mistake", "shift", "solution", "example", "consequence", "cta"]
};

const META_HOOK_RE = /дочитыва|сохраня|узкое место|результат буксует|раскрыть тему|в теме|по теме/iu;
const DIRECT_CTA_RE = /директ|дир|лс|личк|напиши\s+\p{L}|пиши\s+\p{L}/iu;
const ACTION_RE = /напиши|напишите|сохраните|выберите|проверьте|сделайте|примените|попробуйте|начните|ответьте|отправьте/iu;
const GENERIC_RE = /в современном мире|важно понимать|качественн|эффективн|уникальн|индивидуальн|давайте|сменили подход|результат стал стабильным|одно конкретное действие|рабочий шаг 7 дней/iu;
const BROKEN_TAIL_RE =
  /(?:[,;:—–-]|\b(?:и|а|но|или|что|чтобы|потому|когда|где|как|если|по|в|на|для|с|к|от|из|за|без|при|хотя|даже|первых|пробные|тестовые|целевые|уберите|замените|добавьте|сделайте|проверьте|заменяет))\s*$/iu;

function normalize(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function words(value) {
  return normalize(value)
    .split(/[^\p{L}\p{N}-]+/u)
    .filter((token) => token.length >= 2).length;
}

function slideText(slide) {
  return [
    slide?.title,
    slide?.subtitle,
    slide?.body,
    ...(Array.isArray(slide?.bullets) ? slide.bullets : []),
    slide?.before,
    slide?.after
  ]
    .map(normalize)
    .filter(Boolean)
    .join(" ");
}

function ctaType(slide) {
  const text = slideText(slide).toLowerCase();
  if (DIRECT_CTA_RE.test(text) || /заявк|куп|закаж|консультац/.test(text)) {
    return "direct";
  }
  if (/выберите|проверьте|сделайте|примените|начните|попробуйте/.test(text)) {
    return "apply";
  }
  if (/ответьте|поделитесь|вспомните/.test(text)) {
    return "reflection";
  }
  return "soft";
}

function hasBrokenCopy(slides) {
  return slides.some((slide) => {
    const fields = [
      slide?.title,
      slide?.subtitle,
      slide?.body,
      ...(Array.isArray(slide?.bullets) ? slide.bullets : []),
      slide?.before,
      slide?.after
    ];
    return fields.some((field) => {
      const text = normalize(field);
      return text && (text.includes("...") || text.includes("…") || BROKEN_TAIL_RE.test(text));
    });
  });
}

function hasTopicAnchor(topic, slide) {
  const copy = slideText(slide).toLowerCase();
  const anchors = normalize(topic)
    .toLowerCase()
    .split(/[^\p{L}\p{N}-]+/u)
    .filter((token) => token.length >= 4 && !["почему", "которые", "после", "даже", "правильном", "питании", "пошагово"].includes(token))
    .slice(0, 5);

  return anchors.length === 0 || anchors.some((anchor) => copy.includes(anchor.slice(0, 5)));
}

function scoreCase(item, payload) {
  const slides = Array.isArray(payload?.slides) ? payload.slides : [];
  const expectedFlow = FLOW_9_BY_MODE[item.contentMode];
  const flow = slides.map((slide) => slide?.type);
  const hook = slides[0] || {};
  const cta = slides[slides.length - 1] || {};
  const ctaKind = ctaType(cta);
  const allText = slides.map(slideText).join(" ");
  const issues = [];

  const scores = {
    clarity: hasTopicAnchor(item.topic, hook) && words(hook.title) >= 3 ? 5 : 3,
    mode: expectedFlow?.every((role, index) => flow[index] === role) ? 5 : 2,
    hook: META_HOOK_RE.test(slideText(hook)) || words(hook.title) > 6 || words(hook.title) < 3 ? 2 : 5,
    body: GENERIC_RE.test(allText) || hasBrokenCopy(slides) ? 2 : /\d/u.test(allText) ? 5 : 4,
    tone: item.contentMode !== "sales" && /стыдно|ты делаешь неправильно|дом превращается|срочно|немедленно/iu.test(allText) ? 2 : 5,
    cta:
      !ACTION_RE.test(slideText(cta)) ||
      hasBrokenCopy([cta]) ||
      (item.contentMode !== "sales" && ctaKind === "direct") ||
      (slideText(cta).match(ACTION_RE) ?? []).length > 1
        ? 2
        : 5,
    arrows: /→/u.test(allText) ? 1 : 5,
    titles: slides.every((slide) => !slide?.title || words(slide.title) <= 6) ? 5 : 2,
    structure: slides.length === 9 && expectedFlow?.every((role, index) => flow[index] === role) ? 5 : 2,
    publish: 5
  };

  if (scores.clarity < 4) issues.push("first slide topic unclear");
  if (scores.hook < 4) issues.push("weak/meta hook");
  if (scores.body < 4) issues.push("generic or broken body");
  if (scores.cta < 4) issues.push("bad CTA");
  if (scores.titles < 4) issues.push("long title");
  if (scores.structure < 4) issues.push("wrong structure");

  if (payload?.generationSource !== "model") {
    issues.push("fallback source");
  }

  scores.publish = issues.length ? Math.max(1, 5 - issues.length) : 5;

  const average =
    Object.values(scores).reduce((sum, value) => sum + value, 0) / Object.keys(scores).length;

  return {
    firstSlide: normalize(hook.title),
    cta: normalize(cta.subtitle || cta.title),
    ctaType: ctaKind,
    scores,
    average: Number(average.toFixed(2)),
    issues
  };
}

async function runCase(item, index) {
  const headers = { "Content-Type": "application/json" };
  if (QA_BYPASS_KEY) {
    headers["x-qa-generate-key"] = QA_BYPASS_KEY;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        topic: item.topic,
        slidesCount: 9,
        format: "4:5",
        theme: "light",
        promptVariant: "B",
        contentMode: item.contentMode
      }),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) {
      return {
        ...item,
        ok: false,
        httpStatus: response.status,
        error: payload?.error || `HTTP ${response.status}`
      };
    }

    const audit = scoreCase(item, payload);
    return {
      ...item,
      ok: audit.average >= 4.5 && audit.scores.publish >= 4 && payload.generationSource === "model",
      source: payload.generationSource,
      profile: payload.generationProfile,
      audit,
      slides: payload.slides
    };
  } finally {
    clearTimeout(timeoutId);
    process.stdout.write(`[${index + 1}/${CASES.length}] ${item.contentMode} | ${item.topic}\n`);
  }
}

async function main() {
  const results = [];
  for (let index = 0; index < CASES.length; index += 1) {
    results.push(await runCase(CASES[index], index));
  }

  const averages = results.map((result) => result.audit?.average).filter((value) => Number.isFinite(value));
  const overallAverage =
    averages.length > 0
      ? Number((averages.reduce((sum, value) => sum + value, 0) / averages.length).toFixed(2))
      : 0;
  const failed = results.filter((result) => !result.ok);
  const report = {
    createdAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    cases: results.length,
    failed: failed.length,
    overallAverage,
    results
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(report, null, 2), "utf8");

  process.stdout.write("\n--- Generation Quality Audit ---\n");
  process.stdout.write(`report: ${OUTPUT_PATH}\n`);
  process.stdout.write(`overallAverage: ${overallAverage}/5\n`);
  process.stdout.write(`failed: ${failed.length}/${results.length}\n`);
  for (const result of results) {
    process.stdout.write(
      `${result.ok ? "OK" : "FAIL"} | ${result.contentMode} | ${result.audit?.average ?? "n/a"} | ${result.audit?.firstSlide ?? ""}\n`
    );
    if (result.audit?.issues?.length) {
      process.stdout.write(`  issues: ${result.audit.issues.join("; ")}\n`);
    }
  }

  if (failed.length > 0 || overallAverage < 4.5) {
    process.exitCode = 1;
  }
}

void main();
