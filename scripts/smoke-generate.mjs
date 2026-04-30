const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const RUNS = Number(process.env.SMOKE_RUNS || 2);
const QA_BYPASS_KEY =
  process.env.SMOKE_QA_BYPASS_KEY ||
  process.env.QUALITY_QA_BYPASS_KEY ||
  process.env.GENERATE_QA_BYPASS_KEY ||
  "";

const TOPICS = [
  "Почему заявки есть, но сделки не закрываются",
  "Как преподавателю английского удерживать мотивацию учеников",
  "Как эксперту перестать делать скучные карусели"
];

const FORMATS = ["1:1", "4:5", "9:16"];
const THEMES = ["light", "dark", "color"];
const CONTENT_MODES = (process.env.SMOKE_MODES || "sales,expert,instruction")
  .split(",")
  .map((item) => normalize(item))
  .filter(Boolean);
const FLOW_9 = ["hook", "problem", "amplify", "mistake", "consequence", "shift", "solution", "example", "cta"];
const FLOW_9_BY_MODE = {
  sales: FLOW_9,
  expert: ["hook", "problem", "amplify", "mistake", "shift", "solution", "example", "consequence", "cta"],
  instruction: ["hook", "problem", "shift", "solution", "mistake", "amplify", "example", "consequence", "cta"],
  diagnostic: ["hook", "problem", "mistake", "consequence", "amplify", "shift", "solution", "example", "cta"],
  case: ["hook", "problem", "example", "amplify", "shift", "solution", "mistake", "consequence", "cta"],
  social: ["hook", "problem", "amplify", "mistake", "shift", "solution", "example", "consequence", "cta"],
  auto: FLOW_9
};
const BANNED_PHRASES = [
  "в современном мире",
  "в теме ",
  "по теме ",
  "где ломается поток",
  "разбор под ваш кейс",
  "план, который можно внедрить сегодня",
  "разбор: до и после",
  "мини-кейс: как звучит до и после"
];
const MECHANICAL_TITLE_RE = /^к чему это вед[её]т[:\s-]*/iu;

const ACTION_VERB_RE =
  /(?:^|[^\p{L}])(напиши|напишите|сохраните|оставьте|отправьте|ответьте|пришлите|подпишитесь|выберите)(?=$|[^\p{L}])/iu;
const DIRECT_CTA_RE =
  /(?:^|[^\p{L}])(директ|дир|лс|личк|напиши\s+\p{L}|пиши\s+\p{L}|в\s+личн)(?=$|[^\p{L}])/iu;
const META_HOOK_RE =
  /(?:^|[^\p{L}])(узк[а-яё]*\s+мест[а-яё]*|результат\s+буксует|дочитыва|сохраня[а-яё]*|раскрыть\s+тему)(?=$|[^\p{L}])/iu;
const MECHANISM_CUE_RE =
  /(?:^|[^\p{L}])(потому|поэтому|из-за|когда|если|чтобы)(?=$|[^\p{L}])/iu;
const STEP_CUE_RE =
  /(?:^|[^\p{L}])(шаг|сначала|потом|затем|проверьте|сделайте|1|2|3)(?=$|[^\p{L}])/iu;

function normalize(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim();
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

function hasBrokenTail(value) {
  const text = normalize(value);
  if (!text) {
    return false;
  }
  if (text.includes("...") || text.includes("…")) {
    return true;
  }
  return /[:—–-]\s*$/u.test(text);
}

function validateSlides(slides, mode, generationProfile) {
  const errors = [];
  if (!Array.isArray(slides) || slides.length !== 9) {
    errors.push("slides length is not 9");
    return errors;
  }

  const expectedFlow = FLOW_9_BY_MODE[mode] || FLOW_9;
  for (let i = 0; i < expectedFlow.length; i += 1) {
    const expectedType = expectedFlow[i];
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

    const title = normalize(slide.title);
    if (title && (title.includes("...") || title.includes("…"))) {
      errors.push(`slide ${i + 1}: title contains ellipsis`);
    }
    if (title && hasBrokenTail(title)) {
      errors.push(`slide ${i + 1}: title looks truncated or unfinished`);
    }
    if (title && MECHANICAL_TITLE_RE.test(title)) {
      errors.push(`slide ${i + 1}: title uses mechanical template "К чему это ведет"`);
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
      if (mode !== "sales" && META_HOOK_RE.test(`${title} ${subtitle}`)) {
        errors.push("non-sales hook contains meta-hook language");
      }
      continue;
    }

    if (expectedType === "problem" || expectedType === "amplify" || expectedType === "consequence" || expectedType === "solution") {
      const bullets = Array.isArray(slide.bullets) ? slide.bullets.map((item) => normalize(item)).filter(Boolean) : [];
      if (bullets.length < 2) {
        errors.push(`slide ${i + 1} (${expectedType}) has less than 2 bullets`);
      }
      for (const bullet of bullets) {
        if (bullet.includes("...") || bullet.includes("…")) {
          errors.push(`slide ${i + 1} (${expectedType}) has bullet with ellipsis`);
          break;
        }
        if (hasBrokenTail(bullet)) {
          errors.push(`slide ${i + 1} (${expectedType}) has unfinished bullet`);
          break;
        }
      }
      continue;
    }

    if (expectedType === "mistake" || expectedType === "shift") {
      if (normalize(slide.title).length < 12) {
        errors.push(`slide ${i + 1} (${expectedType}) title is too short`);
      }
      continue;
    }

    if (expectedType === "example") {
      if (!normalize(slide.before) || !normalize(slide.after)) {
        errors.push("example slide is missing before/after");
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
      if (mode !== "sales" && DIRECT_CTA_RE.test(`${title} ${subtitle}`)) {
        errors.push("non-sales cta is direct-response");
      }
    }
  }

  if (mode === "instruction") {
    const solution = slides.find((slide) => slide?.type === "solution");
    const solutionCopy =
      solution && Array.isArray(solution.bullets) ? solution.bullets.join(" ") : "";
    if (!STEP_CUE_RE.test(solutionCopy)) {
      errors.push("instruction solution missing step cue");
    }
  }

  if (mode === "expert") {
    const shift = slides.find((slide) => slide?.type === "shift");
    if (!MECHANISM_CUE_RE.test(normalize(shift?.body))) {
      errors.push("expert shift missing mechanism cue");
    }
  }

  if (generationProfile && mode !== "auto") {
    const effective = normalize(generationProfile.modeEffective);
    if (effective && effective !== mode) {
      errors.push(`mode profile mismatch: requested ${mode}, got ${effective}`);
    }
  }

  return errors;
}

async function runCase({ topic, format, theme, mode, runIndex }) {
  const headers = { "Content-Type": "application/json" };
  if (QA_BYPASS_KEY) {
    headers["x-qa-generate-key"] = QA_BYPASS_KEY;
  }

  const response = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      topic,
      slidesCount: 9,
      format,
      theme,
      promptVariant: "B",
      contentMode: mode
    })
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const errors = [];
  if (!response.ok || !payload) {
    errors.push(`http ${response.status}`);
    return { errors, payload };
  }

  if (payload?.project?.format !== format) {
    errors.push(`project.format mismatch: expected ${format}, got ${payload?.project?.format ?? "none"}`);
  }

  if (payload?.project?.theme !== theme) {
    errors.push(`project.theme mismatch: expected ${theme}, got ${payload?.project?.theme ?? "none"}`);
  }

  errors.push(...validateSlides(payload.slides, mode, payload?.generationProfile));

  return {
    errors,
    payload: {
      hook: payload?.slides?.[0]?.title ?? "",
      cta: payload?.slides?.[8]?.title ?? "",
      runIndex,
      topic,
      format,
      theme,
      mode
    }
  };
}

async function main() {
  const failures = [];
  const samples = [];
  const total = TOPICS.length * FORMATS.length * THEMES.length * CONTENT_MODES.length * RUNS;
  let done = 0;

  for (let runIndex = 1; runIndex <= RUNS; runIndex += 1) {
    for (const mode of CONTENT_MODES) {
      for (const topic of TOPICS) {
        for (const format of FORMATS) {
          for (const theme of THEMES) {
            done += 1;
            process.stdout.write(`\n[${done}/${total}] ${runIndex} | ${mode} | ${format} | ${theme} | ${topic}\n`);
            try {
              const result = await runCase({ topic, format, theme, mode, runIndex });
              if (result.errors.length > 0) {
                failures.push({
                  runIndex,
                  topic,
                  format,
                  theme,
                  mode,
                  errors: result.errors
                });
                process.stdout.write(`  FAIL: ${result.errors.join("; ")}\n`);
              } else {
                if (samples.length < 6) {
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
                mode,
                errors: [message]
              });
              process.stdout.write(`  FAIL: ${message}\n`);
            }
          }
        }
      }
    }
  }

  process.stdout.write("\n--- Smoke summary ---\n");
  process.stdout.write(`base: ${BASE_URL}\n`);
  process.stdout.write(`cases: ${total}\n`);
  process.stdout.write(`failed: ${failures.length}\n`);

  if (samples.length > 0) {
    process.stdout.write("samples:\n");
    for (const sample of samples) {
      process.stdout.write(
        `  [run ${sample.runIndex}] ${sample.mode} | ${sample.format}/${sample.theme} | ${sample.topic}\n`
      );
      process.stdout.write(`    hook: ${sample.hook}\n`);
      process.stdout.write(`    cta:  ${sample.cta}\n`);
    }
  }

  if (failures.length > 0) {
    process.stdout.write("\nfailures:\n");
    for (const failure of failures.slice(0, 20)) {
      process.stdout.write(
        `  run ${failure.runIndex} | ${failure.mode} | ${failure.format}/${failure.theme} | ${failure.topic}\n`
      );
      for (const error of failure.errors) {
        process.stdout.write(`    - ${error}\n`);
      }
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write("All smoke checks passed.\n");
}

void main();
