#!/usr/bin/env node

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";
const QA_BYPASS_KEY = process.env.GENERATE_QA_BYPASS_KEY || "";
const REQUEST_TIMEOUT_MS = Number(process.env.TEST_GENERATION_TIMEOUT_MS || 120000);

const TEST_CASES = [
  { topic: "Как риелтору закрывать больше сделок в 2026", mode: "sales" },
  { topic: "Почему щенок писает дома", mode: "expert" },
  { topic: "Как настроить таргет с нуля за выходные", mode: "instruction" },
  { topic: "Почему клиент уходит после первого созвона", mode: "diagnostic" },
  { topic: "Как мы подняли конверсию с 2% до 8% за месяц", mode: "case" },
  { topic: "Почему я перестал отвечать на сообщения вечером", mode: "social" }
];

function normalize(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function roleOf(slide) {
  return normalize(slide?.role || slide?.type);
}

function bodyOf(slide) {
  if (!slide || typeof slide !== "object") {
    return "";
  }

  return normalize(
    slide.body ||
      slide.subtitle ||
      slide.text ||
      (Array.isArray(slide.bullets) ? slide.bullets.join("\n") : "")
  );
}

function rawBodyOf(slide) {
  if (!slide || typeof slide !== "object") {
    return "";
  }

  const value =
    slide.body ||
    slide.subtitle ||
    slide.text ||
    (Array.isArray(slide.bullets) ? slide.bullets.join("\n") : "");

  return typeof value === "string" ? value.replace(/\r/g, "").trim() : "";
}

function titleOf(slide) {
  return normalize(slide?.title);
}

function checkCarousel(slides, mode, topic) {
  const errors = [];

  if (!Array.isArray(slides) || slides.length !== 9) {
    errors.push(`FAIL slides count: ${slides?.length ?? 0} (expected 9)`);
    return errors;
  }

  const roles = slides.map(roleOf);
  for (const role of ["hook", "problem", "shift", "solution", "example", "cta"]) {
    if (!roles.includes(role)) {
      errors.push(`FAIL missing role: ${role}`);
    }
  }

  const hook = slides.find((slide) => roleOf(slide) === "hook");
  if (hook) {
    const title = titleOf(hook);
    const hookBody = bodyOf(hook);
    const words = title.split(/\s+/).filter(Boolean).length;

    if (words > 7) {
      errors.push(`FAIL hook title too long: ${words} words — "${title}"`);
    }

    const topicWords = topic
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 4);
    if (
      hookBody &&
      topicWords.length > 0 &&
      topicWords.every((word) => hookBody.toLowerCase().includes(word))
    ) {
      errors.push(`WARN hook subtitle may be raw topic paste: "${hookBody}"`);
    }

    if (hookBody && !/[.!?]$/u.test(hookBody.trim())) {
      errors.push(`WARN hook body no end punctuation: "${hookBody}"`);
    }

    if (hookBody) {
      const bannedSubtitles = [
        "механизм и первый шаг",
        "покажем причину",
        "который можно проверить без давления",
        "разберём тему подробно",
        "дадим практический совет",
        "рассмотрим все аспекты"
      ];

      for (const banned of bannedSubtitles) {
        if (hookBody.toLowerCase().includes(banned)) {
          errors.push(`FAIL hook body is template: "${banned}"`);
        }
      }
    }
  }

  const example = slides.find((slide) => roleOf(slide) === "example");
  if (example?.before && example?.after) {
    const beforeNums = example.before.match(/\d+/g) || [];
    const afterNums = example.after.match(/\d+/g) || [];
    const duplicateNums = beforeNums.filter((number) => afterNums.includes(number));
    if (duplicateNums.length > 2) {
      errors.push(`WARN example duplicate numbers: ${duplicateNums.join(", ")}`);
    }

    const exampleTitle = titleOf(example);
    if (exampleTitle && example.before.toLowerCase().includes(exampleTitle.toLowerCase().slice(0, 15))) {
      errors.push("WARN example title duplicated in before field");
    }
  }

  const allText = slides
    .map((slide) =>
      [
        slide?.title,
        slide?.body,
        slide?.subtitle,
        slide?.text,
        Array.isArray(slide?.bullets) ? slide.bullets.join(" ") : "",
        slide?.before,
        slide?.after
      ]
        .filter(Boolean)
        .join(" ")
    )
    .join(" ")
    .toLowerCase();

  for (const phrase of [
    "в современном мире",
    "не секрет что",
    "давайте разберёмся",
    "важно понимать",
    "ключ к успеху"
  ]) {
    if (allText.includes(phrase)) {
      errors.push(`FAIL banned: "${phrase}"`);
    }
  }

  const cta = slides.find((slide) => roleOf(slide) === "cta");
  if (!cta?.title || titleOf(cta).length < 5) {
    errors.push("FAIL cta missing or empty");
  }

  if (cta) {
    const ctaText = `${titleOf(cta)} ${bodyOf(cta)}`.toLowerCase();
    const bannedCtaPhrases = [
      "подпишись",
      "следи за обновлениями",
      "оставайся с нами",
      "не пропусти",
      "подписывайся",
      "следите за"
    ];

    for (const banned of bannedCtaPhrases) {
      if (ctaText.includes(banned)) {
        errors.push(`FAIL cta contains banned phrase: "${banned}"`);
      }
    }

    const ctaTitle = titleOf(cta);
    if (ctaTitle && ctaTitle.split(" ").length < 3) {
      errors.push(`WARN cta title too short (may lack specificity): "${ctaTitle}"`);
    }
  }

  const problem = slides.find((slide) => roleOf(slide) === "problem");
  const problemBody = bodyOf(problem);
  if (problemBody) {
    const abstractPhrases = [
      "бывает что",
      "иногда случается",
      "порой возникает",
      "нередко встречается",
      "как правило",
      "в целом"
    ];

    for (const phrase of abstractPhrases) {
      if (problemBody.toLowerCase().includes(phrase)) {
        errors.push(`WARN problem slide too abstract: "${phrase}"`);
      }
    }
  }

  const solution = slides.find((slide) => roleOf(slide) === "solution");
  const solutionBody = rawBodyOf(solution);
  if (solutionBody) {
    const actionVerbs = [
      "выбери",
      "настрой",
      "добавь",
      "убери",
      "начни",
      "зафиксируй",
      "используй",
      "напиши",
      "запусти",
      "проверь",
      "составь",
      "определи",
      "сделай",
      "поставь",
      "открой",
      "установи",
      "запиши",
      "отметь",
      "протестируй",
      "измени",
      "переформулируй",
      "выдели",
      "сократи",
      "выберите",
      "настройте",
      "добавьте",
      "уберите",
      "начните",
      "зафиксируйте",
      "используйте",
      "напишите",
      "запустите",
      "проверьте",
      "составьте",
      "определите",
      "сделайте",
      "поставьте",
      "откройте",
      "установите",
      "запишите",
      "отметьте",
      "протестируйте",
      "измените",
      "переформулируйте",
      "выделите",
      "сократите",
      "выводи",
      "выводите",
      "выведите",
      "раздели",
      "разделите",
      "создай",
      "создайте",
      "перенеси",
      "перенесите",
      "перешли",
      "перешлите",
      "сохрани",
      "сохраните",
      "сверь",
      "сверьте",
      "повтори",
      "повторите",
      "хвали",
      "хвалите",
      "замени",
      "замените",
      "сформулируй",
      "сформулируйте",
      "перепиши",
      "перепишите",
      "подкрути",
      "подкрутите",
      "устрани",
      "устраните",
      "обнови",
      "обновите",
      "пересобери",
      "пересоберите",
      "собери",
      "соберите",
      "сравни",
      "сравните",
      "покажи",
      "покажите",
      "отправь",
      "отправьте",
      "попроси",
      "попросите",
      "назначь",
      "назначьте",
      "проведи",
      "проведите",
      "посчитай",
      "посчитайте",
      "пропиши",
      "пропишите",
      "объясни",
      "объясните",
      "удали",
      "удалите",
      "перенастрой",
      "перенастройте",
      "проанализируй",
      "проанализируйте"
    ];

    const lines = solutionBody.split("\n").map(normalize).filter(Boolean);
    const linesWithoutVerb = lines.filter((line) => {
      const lineWithoutStepLabel = line.replace(/^(?:шаг|день|пункт)\s*\d+(?:\s+[\p{L}-]+)?\s*[:.)—-]\s*/iu, "");
      const firstWord = lineWithoutStepLabel.trim().split(/\s+/)[0].toLowerCase().replace(/[^а-яё]/g, "");
      return firstWord.length > 0 && !actionVerbs.includes(firstWord);
    });

    if (linesWithoutVerb.length > 0) {
      errors.push(`FAIL solution line lacks action verb: "${linesWithoutVerb[0].slice(0, 60)}"`);
    }
  }

  const longTitleSlides = slides.filter((slide) => titleOf(slide).split(/\s+/).filter(Boolean).length > 8);
  for (const slide of longTitleSlides) {
    const title = titleOf(slide);
    errors.push(`WARN title too long (${title.split(/\s+/).length} words) on slide [${roleOf(slide)}]: "${title}"`);
  }

  const hookBody = bodyOf(hook);
  if (hookBody && !/[.!?]$/u.test(hookBody.trim())) {
    const tail = hookBody.slice(-20);
    if (!errors.some((error) => error.includes("hook body no end punctuation"))) {
      errors.push(`WARN hook body missing end punctuation: "${tail}"`);
    }
  }

  void mode;
  return errors;
}

async function runTest(testCase) {
  const { topic, mode } = testCase;
  console.log(`\n▶ Testing [${mode}]: "${topic}"`);

  const headers = { "Content-Type": "application/json" };
  if (QA_BYPASS_KEY) {
    headers["x-qa-generate-key"] = QA_BYPASS_KEY;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        topic,
        contentMode: mode,
        slidesCount: 9,
        withImages: false,
        bypassKey: QA_BYPASS_KEY
      }),
      signal: controller.signal
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  ✗ Network error: ${message}`);
    return { mode, topic, passed: false, errors: [`Network: ${message}`] };
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const text = await res.text();
    console.log(`  ✗ HTTP ${res.status}: ${text.slice(0, 120)}`);
    return { mode, topic, passed: false, errors: [`HTTP ${res.status}`] };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    console.log("  ✗ Invalid JSON response");
    return { mode, topic, passed: false, errors: ["Invalid JSON"] };
  }

  const slides = data?.slides || data?.data?.slides || [];
  const errors = checkCarousel(slides, mode, topic);

  if (errors.length === 0) {
    console.log("  ✓ PASS — all checks ok");
  } else {
    for (const error of errors) {
      console.log(`  ${error.startsWith("WARN") ? "⚠" : "✗"} ${error}`);
    }
  }

  return {
    mode,
    topic,
    passed: errors.filter((error) => error.startsWith("FAIL")).length === 0,
    errors
  };
}

async function main() {
  console.log("═══════════════════════════════════");
  console.log("  pastello.io — Generation Tests");
  console.log(`  Target: ${BASE_URL}`);
  console.log("═══════════════════════════════════");

  const results = [];
  for (const testCase of TEST_CASES) {
    results.push(await runTest(testCase));
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log("\n═══════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════");

  const passed = results.filter((result) => result.passed).length;
  console.log(`  ${passed}/${results.length} passed`);

  for (const result of results) {
    const icon = result.passed ? "✓" : "✗";
    const warnings = result.errors.filter((error) => error.startsWith("WARN")).length;
    console.log(`  ${icon} [${result.mode}] ${result.topic}${warnings ? ` (${warnings} warnings)` : ""}`);
  }

  if (passed < results.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
