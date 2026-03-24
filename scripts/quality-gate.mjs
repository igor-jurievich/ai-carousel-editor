import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.QUALITY_BASE_URL || process.env.SMOKE_BASE_URL || "http://localhost:3000";
const RUNS = Number(process.env.QUALITY_RUNS || 1);
const REQUEST_TIMEOUT_MS = Number(process.env.QUALITY_TIMEOUT_MS || 80000);

const TOPICS = [
  "Почему риелторы и маркетологи спорят из-за качества заявок",
  "Как репетитору английского удерживать мотивацию учеников летом",
  "Как психологу объяснять разницу между тревогой и выгоранием",
  "Как фитнес-тренеру вернуть клиентов после паузы",
  "Как бьюти-мастеру повысить повторные записи без скидок",
  "Как онлайн-школе снизить отток учеников на втором месяце",
  "Как врачу объяснять сложные диагнозы понятным языком",
  "Как финансовому консультанту объяснить клиенту риски инвестиций",
  "Как личному бренду выделиться без агрессивных продаж",
  "Как продюсеру запусков повысить доходимость до вебинара"
];

const FORMATS = ["1:1", "4:5", "9:16"];
const THEMES = ["light", "dark", "color"];
const TOPIC_LIMIT = Number(process.env.QUALITY_TOPICS_LIMIT || TOPICS.length);
const ACTIVE_TOPICS = TOPICS.slice(0, Math.max(1, Math.min(TOPICS.length, Number.isFinite(TOPIC_LIMIT) ? TOPIC_LIMIT : TOPICS.length)));
const ACTIVE_FORMATS = parseCsvSubset(process.env.QUALITY_FORMATS, FORMATS);
const ACTIVE_THEMES = parseCsvSubset(process.env.QUALITY_THEMES, THEMES);
const FLOW_9 = ["hook", "problem", "amplify", "mistake", "consequence", "shift", "solution", "example", "cta"];

const BANNED_PHRASES = [
  "в современном мире",
  "в теме ",
  "по теме ",
  "где ломается поток",
  "разбор под ваш кейс"
];

const WEAK_TITLE_PATTERNS = [
  /^что\s+это\s+значит(\s+для\s+вас)?\??$/iu,
  /^что\s+делать\s+по\s+шагам\??$/iu,
  /^что\s+изменится,\s*если\s+оставить\s+как\s+есть\??$/iu,
  /^готов[а-яё]*\s+объединить\s+усилия\??$/iu,
  /^пора\s+работать\s+как\s+одна\s+команда\??$/iu,
  /^как\s+переформулировать\s+мысль\??$/iu
];

const ACTION_VERB_RE =
  /(?:^|[^\p{L}])(напиши|напишите|сохраните|оставьте|отправьте|ответьте|пришлите|подпишитесь|выберите)(?=$|[^\p{L}])/iu;

const FAILURE_CATEGORY_ORDER = [
  "slides_shape",
  "flow_mismatch",
  "hook_quality",
  "topic_alignment",
  "weak_title",
  "duplicate_title",
  "banned_phrase",
  "thin_bullets",
  "short_title",
  "example_quality",
  "cta_quality",
  "project_meta",
  "network",
  "other"
];

const TOPIC_STOP_WORDS = new Set([
  "как",
  "что",
  "это",
  "для",
  "про",
  "под",
  "без",
  "при",
  "где",
  "когда",
  "почему",
  "если",
  "или",
  "после",
  "над",
  "из",
  "на",
  "по"
]);

function normalize(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim();
}

function parseCsvSubset(raw, allowed) {
  if (!raw || typeof raw !== "string") {
    return allowed;
  }

  const picked = raw
    .split(",")
    .map((item) => normalize(item))
    .filter((item) => allowed.includes(item));

  return picked.length ? picked : allowed;
}

function classifyFailure(error) {
  const normalized = normalize(error).toLowerCase();

  if (normalized.includes("slides length")) {
    return "slides_shape";
  }

  if (normalized.includes("expected type")) {
    return "flow_mismatch";
  }

  if (normalized.includes("hook starts") || normalized.includes("hook is missing")) {
    return "hook_quality";
  }

  if (normalized.includes("weakly aligned")) {
    return "topic_alignment";
  }

  if (normalized.includes("weak title")) {
    return "weak_title";
  }

  if (normalized.includes("duplicate title")) {
    return "duplicate_title";
  }

  if (normalized.includes("contains banned phrase")) {
    return "banned_phrase";
  }

  if (normalized.includes("bullets are too short") || normalized.includes("has less than 2 bullets")) {
    return "thin_bullets";
  }

  if (normalized.includes("title is too short")) {
    return "short_title";
  }

  if (normalized.includes("example slide")) {
    return "example_quality";
  }

  if (normalized.includes("cta ")) {
    return "cta_quality";
  }

  if (normalized.includes("project.format mismatch") || normalized.includes("project.theme mismatch")) {
    return "project_meta";
  }

  if (normalized.startsWith("http")) {
    return "network";
  }

  return "other";
}

function buildFailureSummary(failures) {
  const summary = {};

  for (const failure of failures) {
    for (const error of failure.errors) {
      const category = classifyFailure(error);
      summary[category] = (summary[category] || 0) + 1;
    }
  }

  return summary;
}

function countWords(value) {
  return normalize(value)
    .split(/[^\p{L}\p{N}-]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2).length;
}

function slideText(slide) {
  return [
    normalize(slide?.title),
    normalize(slide?.subtitle),
    ...(Array.isArray(slide?.bullets) ? slide.bullets.map((item) => normalize(item)) : []),
    normalize(slide?.before),
    normalize(slide?.after)
  ]
    .filter(Boolean)
    .join(" ");
}

function topicAnchors(topic) {
  return normalize(topic)
    .toLowerCase()
    .split(/[^\p{L}\p{N}-]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !TOPIC_STOP_WORDS.has(token))
    .slice(0, 4);
}

function lexemes(value) {
  return normalize(value)
    .toLowerCase()
    .split(/[^\p{L}\p{N}-]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);
}

function hasTopicAnchor(text, anchors) {
  if (!anchors.length) {
    return true;
  }
  const textTokens = lexemes(text);
  return anchors.some((anchor) => {
    const short = anchor.slice(0, 4);
    return textTokens.some((token) => token.startsWith(short) || short.startsWith(token.slice(0, 4)));
  });
}

function validateSlides(slides, topic) {
  const errors = [];

  if (!Array.isArray(slides) || slides.length !== 9) {
    errors.push("slides length is not 9");
    return errors;
  }

  const anchors = topicAnchors(topic);
  const titleFingerprints = new Set();

  for (let i = 0; i < FLOW_9.length; i += 1) {
    const expectedType = FLOW_9[i];
    const slide = slides[i];
    if (!slide || slide.type !== expectedType) {
      errors.push(`slide ${i + 1}: expected type ${expectedType}, got ${slide?.type ?? "none"}`);
      continue;
    }

    const text = slideText(slide).toLowerCase();
    for (const phrase of BANNED_PHRASES) {
      if (text.includes(phrase)) {
        errors.push(`slide ${i + 1}: contains banned phrase "${phrase}"`);
      }
    }

    if ("title" in slide && typeof slide.title === "string" && normalize(slide.title)) {
      const cleanTitle = normalize(slide.title);
      if (WEAK_TITLE_PATTERNS.some((pattern) => pattern.test(cleanTitle))) {
        errors.push(`slide ${i + 1}: weak title "${cleanTitle}"`);
      }
      const fingerprint = cleanTitle.toLowerCase();
      if (titleFingerprints.has(fingerprint)) {
        errors.push(`slide ${i + 1}: duplicate title "${cleanTitle}"`);
      } else {
        titleFingerprints.add(fingerprint);
      }
    }

    if (expectedType === "hook") {
      const title = normalize(slide.title).toLowerCase();
      const subtitle = normalize(slide.subtitle);
      if (!title || !subtitle) {
        errors.push("hook is missing title or subtitle");
      }
      if (/^(одна\s+)?(главная\s+)?ошибка/.test(title)) {
        errors.push("hook starts with generic 'ошибка'");
      }
      const hookBlock = [slide.title, slide.subtitle].filter(Boolean).join(" ");
      if (!hasTopicAnchor(hookBlock, anchors)) {
        errors.push("hook is weakly aligned with topic");
      }
      continue;
    }

    if (
      expectedType === "problem" ||
      expectedType === "amplify" ||
      expectedType === "consequence" ||
      expectedType === "solution"
    ) {
      const bullets = Array.isArray(slide.bullets)
        ? slide.bullets.map((item) => normalize(item)).filter(Boolean)
        : [];
      if (bullets.length < 2) {
        errors.push(`slide ${i + 1} (${expectedType}) has less than 2 bullets`);
        continue;
      }

      const denseBullets = bullets.filter((item) => countWords(item) >= 5);
      if (!denseBullets.length) {
        errors.push(`slide ${i + 1} (${expectedType}) bullets are too short`);
      }
      continue;
    }

    if (expectedType === "mistake" || expectedType === "shift") {
      const title = normalize(slide.title);
      if (countWords(title) < 4) {
        errors.push(`slide ${i + 1} (${expectedType}) title is too short`);
      }
      continue;
    }

    if (expectedType === "example") {
      const before = normalize(slide.before);
      const after = normalize(slide.after);
      if (!before || !after) {
        errors.push("example slide is missing before/after");
      } else if (countWords(before) < 4 || countWords(after) < 4) {
        errors.push("example slide before/after is too weak");
      }
      continue;
    }

    if (expectedType === "cta") {
      const title = normalize(slide.title);
      const subtitle = normalize(slide.subtitle);
      if (!title || !subtitle) {
        errors.push("cta is missing title or subtitle");
      } else if (!ACTION_VERB_RE.test(subtitle)) {
        errors.push("cta subtitle does not contain a clear action");
      }
    }
  }

  return errors;
}

async function runCase({ topic, format, theme, runIndex }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  let payload = null;

  try {
    response = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        slidesCount: 9,
        format,
        theme,
        promptVariant: "B"
      }),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const errors = [];
  if (!response.ok || !payload) {
    errors.push(`http ${response.status}`);
    return { errors, payload: null };
  }

  if (payload?.project?.format !== format) {
    errors.push(`project.format mismatch: expected ${format}, got ${payload?.project?.format ?? "none"}`);
  }

  if (payload?.project?.theme !== theme) {
    errors.push(`project.theme mismatch: expected ${theme}, got ${payload?.project?.theme ?? "none"}`);
  }

  errors.push(...validateSlides(payload.slides, topic));

  return {
    errors,
    payload: {
      runIndex,
      topic,
      format,
      theme,
      hook: payload?.slides?.[0]?.title ?? "",
      problem: payload?.slides?.[1]?.title ?? "",
      cta: payload?.slides?.[8]?.title ?? ""
    }
  };
}

async function main() {
  const failures = [];
  const samples = [];
  const total = ACTIVE_TOPICS.length * ACTIVE_FORMATS.length * ACTIVE_THEMES.length * RUNS;
  let done = 0;

  for (let runIndex = 1; runIndex <= RUNS; runIndex += 1) {
    for (const topic of ACTIVE_TOPICS) {
      for (const format of ACTIVE_FORMATS) {
        for (const theme of ACTIVE_THEMES) {
          done += 1;
          process.stdout.write(`\n[${done}/${total}] run ${runIndex} | ${format}/${theme} | ${topic}\n`);
          try {
            const result = await runCase({ topic, format, theme, runIndex });
            if (result.errors.length > 0) {
              failures.push({
                runIndex,
                topic,
                format,
                theme,
                errors: result.errors
              });
              process.stdout.write(`  FAIL: ${result.errors.join("; ")}\n`);
            } else {
              if (samples.length < 10 && result.payload) {
                samples.push(result.payload);
              }
              process.stdout.write("  OK\n");
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            failures.push({
              runIndex,
              topic,
              format,
              theme,
              errors: [message]
            });
            process.stdout.write(`  FAIL: ${message}\n`);
          }
        }
      }
    }
  }

  const report = {
    createdAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    runs: RUNS,
    cases: total,
    topics: ACTIVE_TOPICS.length,
    formats: ACTIVE_FORMATS,
    themes: ACTIVE_THEMES,
    failed: failures.length,
    failureSummary: buildFailureSummary(failures),
    samples,
    failures
  };

  const outputDir = path.resolve(process.cwd(), "test-results");
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "quality-gate-latest.json");
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");

  process.stdout.write("\n--- Quality gate summary ---\n");
  process.stdout.write(`base: ${BASE_URL}\n`);
  process.stdout.write(`cases: ${total}\n`);
  process.stdout.write(`failed: ${failures.length}\n`);
  if (Object.keys(report.failureSummary).length > 0) {
    process.stdout.write("failure summary:\n");
    for (const key of FAILURE_CATEGORY_ORDER) {
      if (!report.failureSummary[key]) {
        continue;
      }
      process.stdout.write(`  ${key}: ${report.failureSummary[key]}\n`);
    }
    for (const [key, value] of Object.entries(report.failureSummary)) {
      if (FAILURE_CATEGORY_ORDER.includes(key)) {
        continue;
      }
      process.stdout.write(`  ${key}: ${value}\n`);
    }
  }
  process.stdout.write(`report: ${outputPath}\n`);

  if (samples.length > 0) {
    process.stdout.write("samples:\n");
    for (const sample of samples.slice(0, 6)) {
      process.stdout.write(
        `  [run ${sample.runIndex}] ${sample.format}/${sample.theme} | ${sample.topic}\n`
      );
      process.stdout.write(`    hook: ${sample.hook}\n`);
      process.stdout.write(`    problem: ${sample.problem}\n`);
      process.stdout.write(`    cta: ${sample.cta}\n`);
    }
  }

  if (failures.length > 0) {
    process.exitCode = 1;
    return;
  }

  process.stdout.write("Quality gate passed.\n");
}

void main();
