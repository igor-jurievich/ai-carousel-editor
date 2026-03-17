import OpenAI from "openai";
import {
  clampSlidesCount,
  DEFAULT_SLIDES_COUNT,
  MAX_SLIDES_COUNT,
  MIN_SLIDES_COUNT
} from "@/lib/slides";
import type { CarouselOutlineSlide } from "@/types/editor";

export { clampSlidesCount };

const carouselSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    slides: {
      type: "array",
      minItems: MIN_SLIDES_COUNT,
      maxItems: MAX_SLIDES_COUNT,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: {
            type: "string",
            minLength: 3
          },
          text: {
            type: "string",
            minLength: 10
          }
        },
        required: ["title", "text"]
      }
    }
  },
  required: ["slides"]
} as const;

let client: OpenAI | null = null;

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  return client;
}

export async function generateCarouselFromTopic(topic: string, requestedSlidesCount?: number) {
  const coreTopic = parseTopicBrief(topic).coreTopic || topic;
  const targetCount = clampSlidesCount(
    requestedSlidesCount ?? inferTargetSlides(topic) ?? DEFAULT_SLIDES_COUNT
  );
  const attempts: Array<{
    slides: CarouselOutlineSlide[];
    score: number;
    needsRepair: boolean;
  }> = [];
  let draftSlides: CarouselOutlineSlide[] | undefined;
  let openai: OpenAI | null = null;

  try {
    openai = getOpenAIClient();
  } catch {
    return buildDeterministicFallbackSlides(coreTopic, targetCount);
  }

  for (let attemptIndex = 0; attemptIndex < 3; attemptIndex += 1) {
    try {
      const rawSlides = await requestSlidesWithFallback(openai, topic, targetCount, draftSlides);
      const normalized = normalizeSlides(coreTopic, rawSlides, targetCount);
      const quality = assessSlidesQuality(coreTopic, normalized);

      attempts.push({
        slides: normalized,
        score: quality.score,
        needsRepair: quality.needsRepair
      });

      if (!quality.needsRepair) {
        return normalized;
      }

      draftSlides = normalized;
    } catch {
      // Try next pass and return deterministic fallback if every pass fails.
    }
  }

  const bestHealthyAttempt = attempts
    .filter((attempt) => !attempt.needsRepair)
    .sort((left, right) => right.score - left.score)[0];
  if (bestHealthyAttempt) {
    return bestHealthyAttempt.slides;
  }

  return buildDeterministicFallbackSlides(coreTopic, targetCount);
}

async function requestSlidesWithFallback(
  openai: OpenAI,
  topic: string,
  targetCount: number,
  draftSlides?: CarouselOutlineSlide[]
) {
  const modelCandidates = buildModelCandidates();
  let lastError: unknown = null;

  for (let index = 0; index < modelCandidates.length; index += 1) {
    const model = modelCandidates[index];

    try {
      return await requestSlides(openai, topic, model, targetCount, draftSlides);
    } catch (error) {
      lastError = error;
      const isLast = index === modelCandidates.length - 1;

      if (isLast || !isModelAvailabilityError(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to generate slides.");
}

function buildModelCandidates() {
  const configuredModel = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
  return [configuredModel, "gpt-4.1-mini"].filter(
    (value, index, list): value is string =>
      Boolean(value) && list.indexOf(value) === index
  );
}

async function requestSlides(
  openai: OpenAI,
  topic: string,
  model: string,
  targetCount: number,
  draftSlides?: CarouselOutlineSlide[]
) {
  const brief = parseTopicBrief(topic);
  const highDepthMode = isHighDepthRequested(topic);
  const isRepair = Boolean(draftSlides);

  const response = await openai.responses.create({
    model,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              "You are a senior Russian-speaking content strategist for expert-level Instagram carousels.",
              "Return only JSON that matches the schema.",
              "Write final publish-ready copy, not meta commentary.",
              "Use clear narrative progression across slides: hook -> diagnosis -> proof/logic -> practical moves -> CTA.",
              "Titles must be short, strong, specific and readable on mobile: usually 3-8 words.",
              "Body text must be concrete: examples, consequences, scripts, objections, micro-steps, numbers when relevant.",
              "Write only in natural Russian Cyrillic. Avoid accidental transliterated Latin words.",
              "Never write slide text as user brief or assignment checklist.",
              "Do not include helper labels like 'слайд 1', 'логика', 'тз', 'техническое задание'.",
              "For middle slides, prefer 2-4 meaningful short paragraphs or a concise bullet list with specifics.",
              "Avoid generic motivational filler and repeated claims.",
              "Do not output generic empty advice.",
              "Do not echo user instruction lines or technical task language verbatim.",
              "Never include lines like: 'Сделай карусель', 'Используй такую логику', 'Важно', 'пиши по-русски', numbered requirements from the brief.",
              "If the user included raw notes or bullets, convert them into polished content slides, not checklist slides.",
              `Use exactly ${targetCount} slides. This is a strict requirement.`,
              highDepthMode
                ? "High-depth mode is required: every slide should feel like expensive expert content with practical detail."
                : "Keep a practical expert tone.",
              "First slide = strong hook. Last slide = clear conclusion and CTA."
            ].join(" ")
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildUserPrompt(brief, topic, targetCount, isRepair, draftSlides)
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "carousel_script",
        schema: carouselSchema,
        strict: true
      }
    }
  });

  const raw = response.output_text;

  if (!raw) {
    throw new Error("OpenAI returned an empty response.");
  }

  const parsed = JSON.parse(raw) as { slides: CarouselOutlineSlide[] };

  if (!Array.isArray(parsed.slides) || parsed.slides.length < 1) {
    throw new Error("OpenAI returned an invalid carousel structure.");
  }

  return ensureSlidesCount(parsed.slides, brief.coreTopic || topic, targetCount);
}

function clean(value: string) {
  return value
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isModelAvailabilityError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /(model|permission|access|not found|unsupported|does not exist|unavailable)/i.test(
    error.message
  );
}

const META_PATTERNS = [
  /сделай\s+карусель/i,
  /используй\s+такую\s+логику/i,
  /^важно[:]?/i,
  /пиши\s+по-русски/i,
  /хочу\s+не\s+общие\s+советы/i,
  /заголовки\s+должны/i,
  /текст\s+на\s+слайдах\s+должен/i,
  /можно\s+использовать\s+списки/i,
  /карусель\s+должна\s+ощущаться/i
];

type ParsedBrief = {
  coreTopic: string;
  sourceIdeas: string[];
  structureHints: string[];
  qualityHints: string[];
};

const BRIEF_META_STARTERS = [
  /^сделай\b/i,
  /^хочу\b/i,
  /^используй\b/i,
  /^важно\b/i,
  /^пиши\b/i,
  /^логика\b/i,
  /^промпт\b/i
];

const STRUCTURE_HINT_STARTERS = [
  /^жестк/i,
  /^объясн/i,
  /^покаж/i,
  /^дай\b/i,
  /^добав/i,
  /^заверш/i
];

const QUALITY_HINT_STARTERS = [
  /^заголовки\b/i,
  /^текст на слайдах\b/i,
  /^можно использовать\b/i,
  /^карусель должна\b/i
];

const DIRECTIVE_HINT_STARTERS = [
  ...BRIEF_META_STARTERS,
  ...STRUCTURE_HINT_STARTERS,
  ...QUALITY_HINT_STARTERS,
  /^стиль\b/i,
  /^формат\b/i,
  /^нужн[ао]\b/i,
  /^ожидаем(ый|ая)\b/i
];

function normalizeBriefLine(value: string) {
  const withoutBullet = value.replace(/^[\-\*\u2022]\s*/, "");
  const numberedMatch = withoutBullet.match(/^\d+\s*[\).\-\:]\s*(.+)$/);
  const line = (numberedMatch?.[1] ?? withoutBullet)
    .replace(/^(тема|идея|задача|контекст|логика|промпт)\s*:\s*/i, "")
    .trim();

  return line
    .replace(/^["'«]+/, "")
    .replace(/["'»]+$/, "")
    .trim();
}

function isBriefMetaLine(line: string) {
  if (!line) {
    return true;
  }

  return BRIEF_META_STARTERS.some((pattern) => pattern.test(line));
}

function extractSourceIdeasFromTopic(topic: string) {
  return topic
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => normalizeBriefLine(line))
    .filter(Boolean)
    .filter((line) => !isBriefMetaLine(line))
    .filter((line) => !DIRECTIVE_HINT_STARTERS.some((pattern) => pattern.test(line)))
    .filter((line) => !QUALITY_HINT_STARTERS.some((pattern) => pattern.test(line)))
    .filter((line) => !/^(\d+\s*слайд(ов)?|структура|требования)\b/i.test(line))
    .slice(0, 18);
}

function removeMetaLines(value: string) {
  const lines = value
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !META_PATTERNS.some((pattern) => pattern.test(line)));

  return clean(lines.join("\n"));
}

function parseTopicBrief(topic: string): ParsedBrief {
  const rawLines = topic
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const sourceIdeas: string[] = [];
  const structureHints: string[] = [];
  const qualityHints: string[] = [];

  for (const rawLine of rawLines) {
    const normalizedLine = normalizeBriefLine(rawLine);

    if (!normalizedLine) {
      continue;
    }

    if (QUALITY_HINT_STARTERS.some((pattern) => pattern.test(normalizedLine))) {
      qualityHints.push(normalizedLine);
      continue;
    }

    if (STRUCTURE_HINT_STARTERS.some((pattern) => pattern.test(normalizedLine))) {
      structureHints.push(normalizedLine);
      continue;
    }

    if (isBriefMetaLine(normalizedLine)) {
      continue;
    }

    sourceIdeas.push(normalizedLine);
  }

  const fallbackIdeas = extractSourceIdeasFromTopic(removeMetaLines(topic));
  const safeSourceIdeas = (sourceIdeas.length ? sourceIdeas : fallbackIdeas).filter(
    (line) => !DIRECTIVE_HINT_STARTERS.some((pattern) => pattern.test(line))
  );
  const semanticSourceIdeas = safeSourceIdeas.filter(
    (line) => !DIRECTIVE_HINT_STARTERS.some((pattern) => pattern.test(line))
  );
  const fallbackTopic = clean(topic).split("\n")[0]?.trim() ?? "";
  const coreTopic =
    (semanticSourceIdeas[0] ?? safeSourceIdeas[0] ?? fallbackTopic) || "Тема карусели";

  return {
    coreTopic,
    sourceIdeas:
      semanticSourceIdeas.length > 0
        ? semanticSourceIdeas
        : safeSourceIdeas.length > 0
          ? safeSourceIdeas
          : [coreTopic],
    structureHints,
    qualityHints
  };
}

function buildUserPrompt(
  brief: ParsedBrief,
  topic: string,
  targetCount: number,
  isRepair: boolean,
  draftSlides?: CarouselOutlineSlide[]
) {
  const sourceBlock = brief.sourceIdeas.slice(0, 18).map((line) => `- ${line}`).join("\n");
  const sanitizedTopic = removeMetaLines(topic);
  const contextBlock = extractSourceIdeasFromTopic(sanitizedTopic)
    .slice(0, 14)
    .map((line) => `- ${line}`)
    .join("\n");
  const structureBlock = brief.structureHints.length
    ? brief.structureHints.map((line, index) => `${index + 1}. ${line}`).join("\n")
    : "- Выстрой структуру самостоятельно по смыслу темы.";
  const qualityBlock = brief.qualityHints.length
    ? brief.qualityHints.map((line) => `- ${line}`).join("\n")
    : "- Пиши как дорогой практикующий эксперт: конкретика, аргументы, примеры фраз.";

  if (isRepair) {
    return [
      "Контент-бриф пользователя:",
      `Тема: ${brief.coreTopic}`,
      "",
      "Смысловые вводные:",
      sourceBlock,
      "",
      "Желаемая структура:",
      structureBlock,
      "",
      "Требования к качеству:",
      qualityBlock,
      "",
      `Нужно сделать строго ${targetCount} слайдов.`,
      "",
      contextBlock
        ? ["Дополнительный контекст по теме:", contextBlock, ""].join("\n")
        : "",
      "Блоки «Желаемая структура» и «Требования к качеству» — это технические ограничения.",
      "Запрещено переносить эти формулировки в слайды дословно или частично.",
      "Черновик слабый: есть мета-фразы, слабая глубина или пустые формулировки.",
      "Перепиши полностью. Сохрани тему и логику, но сделай глубокий экспертный контент.",
      "",
      "Проблемный черновик JSON:",
      JSON.stringify({ slides: draftSlides }, null, 2),
      "",
      "Строго запрещено выносить в слайды сам бриф, требования, нумерацию задания и слова из ТЗ."
    ].join("\n");
  }

  return [
    "Контент-бриф пользователя:",
    `Тема: ${brief.coreTopic}`,
    "",
    "Смысловые вводные:",
    sourceBlock,
    "",
    "Желаемая структура:",
    structureBlock,
    "",
    "Требования к качеству:",
    qualityBlock,
    "",
    `Нужно сделать строго ${targetCount} слайдов.`,
    "",
    contextBlock
      ? ["Дополнительный контекст по теме:", contextBlock, ""].join("\n")
      : "",
    "Блоки «Желаемая структура» и «Требования к качеству» — это технические ограничения.",
    "Запрещено превращать их в отдельные слайды или копировать в текст.",
    "Сконвертируй это в полноценную экспертную карусель на русском.",
    "Не копируй служебные строки, команды пользователя и нумерацию задания как отдельные слайды.",
  ].join("\n");
}

function fallbackTitle(topic: string, index: number, total: number) {
  if (index === 0) {
    return "Главная ошибка, которая стоит денег";
  }

  if (index === total - 1) {
    return "Вывод и следующий шаг";
  }

  const middleTitles = [
    "Главная ошибка",
    "Что мешает результату",
    "Как это исправить",
    "Практический шаг",
    "Что даст результат"
  ];

  return middleTitles[(index - 1) % middleTitles.length];
}

function fallbackText(topic: string, index: number, total: number) {
  if (index === 0) {
    return `Разбираем тему «${topic}» без воды: где чаще всего ломается результат, почему стандартные решения не работают и что нужно изменить, чтобы получать прогнозируемый эффект уже в ближайших сделках и переговорах.`;
  }

  if (index === total - 1) {
    return "Соберите 1 сценарий из карусели и примените его в ближайшем созвоне или переписке. Зафиксируйте реакцию клиента, затем масштабируйте рабочий подход на весь процесс продаж. Это и будет ваш быстрый рывок без демпинга.";
  }

  const middleHints = [
    "Покажите причинно-следственную связь: какая ошибка встречается чаще всего, почему она возникает и к каким финансовым или репутационным потерям приводит на практике.",
    "Дайте один чёткий рабочий приём: что именно сказать клиенту, что показать в аргументации и как перевести разговор из цены в ценность предложения.",
    "Добавьте короткий сценарий применения: шаги, формулировки и ожидаемый результат, чтобы читатель мог внедрить подход сразу после просмотра карусели.",
    "Подкрепите мысль конкретикой: цифрой, типичным кейсом или наблюдением из реальных переговоров, чтобы текст воспринимался как опыт эксперта, а не как общий совет."
  ];

  return middleHints[(index - 1) % middleHints.length];
}

function countWords(text: string) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean).length;
}

function isWeakBodyText(text: string, isMiddleSlide: boolean) {
  if (!text.trim()) {
    return true;
  }

  const words = countWords(text);
  if (isMiddleSlide) {
    return text.length < 120 || words < 20;
  }

  return text.length < 48 || words < 10;
}

function sanitizeOutlineSlide(
  rawSlide: Partial<CarouselOutlineSlide> | undefined,
  topic: string,
  index: number,
  total: number
): CarouselOutlineSlide {
  const rawTitle = removeMetaLines(String(rawSlide?.title ?? ""));
  const rawText = removeMetaLines(String(rawSlide?.text ?? ""));
  const title = normalizeTitle(rawTitle, topic, index, total);
  const normalizedBody = normalizeBody(rawText, title);
  const isMiddleSlide = index > 0 && index < total - 1;
  const text = isWeakBodyText(normalizedBody, isMiddleSlide)
    ? fallbackText(topic, index, total)
    : normalizedBody;

  return {
    title,
    text
  };
}

function ensureSlidesCount(
  slides: CarouselOutlineSlide[],
  topic: string,
  targetCount: number
) {
  const cleaned = slides
    .map((slide) => ({
      title: clean(String(slide?.title ?? "")),
      text: clean(String(slide?.text ?? ""))
    }))
    .filter((slide) => slide.title || slide.text);
  const exact = cleaned.slice(0, targetCount);

  while (exact.length < targetCount) {
    const index = exact.length;
    exact.push({
      title: fallbackTitle(topic, index, targetCount),
      text: fallbackText(topic, index, targetCount)
    });
  }

  return exact.map((slide, index) => sanitizeOutlineSlide(slide, topic, index, targetCount));
}

function normalizeSlides(topic: string, slides: CarouselOutlineSlide[], targetCount: number) {
  const exact = ensureSlidesCount(slides, topic, targetCount);

  return exact.map((slide, index) => {
    const cleanedTitle = removeMetaLines(slide.title || "");
    const cleanedText = removeMetaLines(slide.text || "");
    const title = normalizeTitle(cleanedTitle, topic, index, exact.length);
    const text = normalizeBody(cleanedText, title);
    const isMiddleSlide = index > 0 && index < exact.length - 1;
    const hasSubstance =
      !isWeakBodyText(text, isMiddleSlide) ||
      (text.length >= 42 && /[:;\n\u2192\-•]|\d+[%xх]?|\b(пример|шаг|фраз|ошиб|выгод|прибыл)\b/i.test(text));

    return {
      title,
      text: hasSubstance ? text : fallbackText(topic, index, exact.length)
    };
  });
}

function normalizeTitle(rawTitle: string, topic: string, index: number, total: number) {
  if (!rawTitle) {
    return fallbackTitle(topic, index, total);
  }

  const withoutLeadingList = rawTitle.replace(/^\s*\d+[\)\.]?\s*/, "").trim();
  const firstLine = withoutLeadingList.split("\n")[0] || withoutLeadingList;
  const compact = firstLine.replace(/\s+/g, " ").trim();

  if (compact.length <= 76) {
    return capitalizeTitle(compact);
  }

  const byPunctuation = compact.match(/^(.{18,76}?)[\.\!\?\:\-]/);
  if (byPunctuation?.[1]) {
    return capitalizeTitle(byPunctuation[1].trim());
  }

  return capitalizeTitle(`${compact.slice(0, 73).trimEnd()}…`);
}

function normalizeBody(rawBody: string, title: string) {
  let body = clean(rawBody);

  if (!body) {
    return body;
  }

  if (body === title) {
    return "";
  }

  body = body
    .replace(/\bklientu\b/gi, "клиенту")
    .replace(/\bklient\b/gi, "клиент")
    .replace(/\bagentstvu\b/gi, "агентству");

  return body;
}

function pickSeedLine(lines: string[], index: number, fallback: string) {
  if (!lines.length) {
    return fallback;
  }

  return lines[index % lines.length];
}

function deriveTitleFromSeed(seed: string, topic: string, index: number, total: number) {
  const normalized = clean(seed)
    .replace(/^(миф\/факт|ошибка|подборка|инструкция|лайфхак)\s*:\s*/i, "")
    .replace(/^[\-\*\u2022]\s*/, "");

  if (!normalized) {
    return fallbackTitle(topic, index, total);
  }

  const firstSentence = normalized.split(/[.!?;\n]/)[0]?.trim() ?? "";
  return normalizeTitle(firstSentence, topic, index, total);
}

function expandSeedToBody(seed: string, topic: string, index: number, total: number) {
  const cleaned = clean(seed).replace(/^[\-\*\u2022]\s*/, "");

  if (!cleaned) {
    return fallbackText(topic, index, total);
  }

  if (index === 0) {
    return `Триггер из практики: «${cleaned}». Клиент слышит это почти в каждом диалоге, поэтому важно сразу перехватить рамку разговора и перевести фокус с цены на измеримую выгоду и риски бездействия.`;
  }

  if (index === total - 1) {
    return `Зафиксируйте главный тезис: ${cleaned}. Затем выберите одну фразу из карусели и протестируйте её в ближайшем диалоге. Практика на реальных контактах быстро покажет, где ваша аргументация усиливает чек и конверсию.`;
  }

  return [
    cleaned,
    "Как применять на практике:",
    "→ Назовите клиенту конкретный риск потерь, если он ориентируется только на низкую цену.",
    "→ Подкрепите позицию цифрой, кейсом или коротким сценарием из вашего опыта.",
    "→ Завершите шагом, который переводит разговор к решению, а не к торгу."
  ].join("\n");
}

function buildDeterministicFallbackSlides(topic: string, targetCount: number) {
  const brief = parseTopicBrief(topic);
  const seeds = brief.sourceIdeas
    .map((line) => clean(line))
    .filter(Boolean);
  const slides: CarouselOutlineSlide[] = [];

  for (let index = 0; index < targetCount; index += 1) {
    const seed = pickSeedLine(
      seeds,
      index,
      [brief.coreTopic, topic, "экспертный контент"].filter(Boolean).join(" ")
    );
    const title = deriveTitleFromSeed(seed, brief.coreTopic || topic, index, targetCount);
    const text = expandSeedToBody(seed, brief.coreTopic || topic, index, targetCount);
    slides.push({
      title,
      text
    });
  }

  return normalizeSlides(brief.coreTopic || topic, slides, targetCount);
}

function capitalizeTitle(value: string) {
  if (!value) {
    return value;
  }

  const [first, ...rest] = Array.from(value);
  return `${first.toLocaleUpperCase("ru-RU")}${rest.join("")}`;
}

function inferTargetSlides(topic: string) {
  const numbered = (topic.match(/(^|\n)\s*\d+\s*[\)\.]/g) ?? []).length;
  if (numbered >= 5 && numbered <= 12) {
    return numbered;
  }

  const markerCount = [
    /миф\/факт/i,
    /ошибка/i,
    /подборка/i,
    /инструкция/i,
    /лайфхак/i
  ].reduce((count, marker) => count + (marker.test(topic) ? 1 : 0), 0);

  if (markerCount >= 4) {
    return DEFAULT_SLIDES_COUNT;
  }

  return null;
}

function isHighDepthRequested(topic: string) {
  return /(глубок|конкретик|дорогого эксперта|без воды|сильн(ый|ую)|не шаблон)/i.test(topic);
}

function hasMetaEcho(text: string) {
  const normalized = text.toLowerCase();
  return META_PATTERNS.some((pattern) => pattern.test(normalized));
}

function assessSlidesQuality(topic: string, slides: CarouselOutlineSlide[]) {
  if (!slides.length) {
    return { needsRepair: true, score: -100 };
  }

  const highDepthMode = isHighDepthRequested(topic);
  const sourceLines = topic
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.length >= 12);

  let metaEchoCount = 0;
  let shortBodies = 0;
  let thinBodies = 0;
  let weakMiddleBodies = 0;
  let latinLeakCount = 0;
  let actionableSlides = 0;
  let emptyBodies = 0;
  const uniqueTitles = new Set<string>();

  for (let index = 0; index < slides.length; index += 1) {
    const slide = slides[index];
    const title = clean(slide.title || "");
    const text = clean(slide.text || "");
    const merged = `${title}\n${text}`;

    if (hasMetaEcho(merged)) {
      metaEchoCount += 1;
    }

    if (text.length < 36) {
      shortBodies += 1;
    }

    if (!text.trim()) {
      emptyBodies += 1;
    }

    if (text.length < (highDepthMode ? 140 : 90)) {
      thinBodies += 1;
    }

    const isMiddleSlide = index > 0 && index < slides.length - 1;
    if (isWeakBodyText(text, isMiddleSlide)) {
      if (isMiddleSlide) {
        weakMiddleBodies += 1;
      } else {
        shortBodies += 1;
      }
    }

    const hasActionableMarker = /[:;\n\u2192\-•]|\d+[%xх]|\d+\s*(дней|шаг|пример|фраз|ошиб|выгод|прибыл|комис)/i.test(
      text
    );
    if (hasActionableMarker) {
      actionableSlides += 1;
    }

    if (title.length < 8 || title.length > 90) {
      metaEchoCount += 1;
    }

    const latinWords = merged.match(/\b[a-z]{4,}\b/gi) ?? [];
    const hasSuspiciousLatinWord = latinWords.some(
      (word) => !["cta", "instagram", "reels", "stories"].includes(word.toLowerCase())
    );
    if (hasSuspiciousLatinWord) {
      latinLeakCount += 1;
    }

    uniqueTitles.add(title.toLowerCase());

    const mirroredLine = sourceLines.find(
      (line) => line.length > 18 && merged.toLowerCase().includes(line)
    );
    if (mirroredLine && /(сделай карусель|используй такую логику|важно|пиши по-русски)/i.test(mirroredLine)) {
      metaEchoCount += 1;
    }

    if (isMiddleSlide && !text) {
      metaEchoCount += 1;
    }
  }

  const duplicatedTitles = uniqueTitles.size < Math.max(3, Math.round(slides.length * 0.7));
  const tooManyShortBodies = shortBodies > Math.ceil(slides.length * 0.45);
  const tooManyThinBodies = thinBodies > Math.ceil(slides.length * (highDepthMode ? 0.35 : 0.55));
  const hasWeakMiddleBodies = weakMiddleBodies > 0;
  const weakActionability = actionableSlides < Math.max(2, Math.ceil(slides.length * (highDepthMode ? 0.55 : 0.35)));
  const hasTooMuchMeta = metaEchoCount > 0;
  const hasLatinLeak = latinLeakCount > 0;
  const hasEmptyBodies = emptyBodies > 0;
  const score =
    actionableSlides * 6 -
    metaEchoCount * 10 -
    shortBodies * 5 -
    thinBodies * 4 -
    weakMiddleBodies * 11 -
    emptyBodies * 16 -
    latinLeakCount * 7 -
    (duplicatedTitles ? 8 : 0);

  return {
    needsRepair:
      hasTooMuchMeta ||
      tooManyShortBodies ||
      tooManyThinBodies ||
      hasEmptyBodies ||
      hasWeakMiddleBodies ||
      duplicatedTitles ||
      weakActionability ||
      hasLatinLeak,
    score
  };
}
