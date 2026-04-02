const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const RUNS = Number(process.env.SMOKE_RUNS || 2);

const TOPICS = [
  "Почему заявки есть, но сделки не закрываются",
  "Как преподавателю английского удерживать мотивацию учеников",
  "Как эксперту перестать делать скучные карусели"
];

const FORMATS = ["1:1", "4:5", "9:16"];
const THEMES = ["light", "dark", "color"];
const FLOW_9 = ["hook", "problem", "amplify", "mistake", "consequence", "shift", "solution", "example", "cta"];
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

function validateSlides(slides) {
  const errors = [];
  if (!Array.isArray(slides) || slides.length !== 9) {
    errors.push("slides length is not 9");
    return errors;
  }

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
    }
  }

  return errors;
}

async function runCase({ topic, format, theme, runIndex }) {
  const response = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic,
      slidesCount: 9,
      format,
      theme,
      promptVariant: "B"
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

  errors.push(...validateSlides(payload.slides));

  return {
    errors,
    payload: {
      hook: payload?.slides?.[0]?.title ?? "",
      cta: payload?.slides?.[8]?.title ?? "",
      runIndex,
      topic,
      format,
      theme
    }
  };
}

async function main() {
  const failures = [];
  const samples = [];
  const total = TOPICS.length * FORMATS.length * THEMES.length * RUNS;
  let done = 0;

  for (let runIndex = 1; runIndex <= RUNS; runIndex += 1) {
    for (const topic of TOPICS) {
      for (const format of FORMATS) {
        for (const theme of THEMES) {
          done += 1;
          process.stdout.write(`\n[${done}/${total}] ${runIndex} | ${format} | ${theme} | ${topic}\n`);
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
              errors: [message]
            });
            process.stdout.write(`  FAIL: ${message}\n`);
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
        `  [run ${sample.runIndex}] ${sample.format}/${sample.theme} | ${sample.topic}\n`
      );
      process.stdout.write(`    hook: ${sample.hook}\n`);
      process.stdout.write(`    cta:  ${sample.cta}\n`);
    }
  }

  if (failures.length > 0) {
    process.stdout.write("\nfailures:\n");
    for (const failure of failures.slice(0, 20)) {
      process.stdout.write(
        `  run ${failure.runIndex} | ${failure.format}/${failure.theme} | ${failure.topic}\n`
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
