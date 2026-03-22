import OpenAI from "openai";
import { clampSlidesCount } from "@/lib/slides";
import type { CarouselOutlineSlide, CarouselSlideRole } from "@/types/editor";

type GenerationOptions = {
  niche?: string;
  audience?: string;
};

type CarouselGenerationResult = {
  slides: CarouselOutlineSlide[];
};

const CANONICAL_FLOW: CarouselSlideRole[] = [
  "hook",
  "problem",
  "amplify",
  "mistake",
  "consequence",
  "shift",
  "solution",
  "example",
  "cta"
];

const FLOW_BY_COUNT: Record<number, CarouselSlideRole[]> = {
  8: ["hook", "problem", "mistake", "consequence", "shift", "solution", "example", "cta"],
  9: [...CANONICAL_FLOW],
  10: [
    "hook",
    "problem",
    "amplify",
    "mistake",
    "consequence",
    "shift",
    "solution",
    "solution",
    "example",
    "cta"
  ]
};

const DEFAULT_MODEL_CANDIDATES = [
  "gpt-5.3",
  "gpt-5.3-mini",
  "gpt-4.1-mini",
  "gpt-4.1",
  "gpt-4o-mini"
] as const;

function resolveModelCandidates() {
  return [
    process.env.OPENAI_GENERATION_MODEL?.trim(),
    process.env.OPENAI_MODEL?.trim(),
    ...DEFAULT_MODEL_CANDIDATES
  ]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, list) => list.indexOf(value) === index);
}

let client: OpenAI | null = null;

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return client;
}

export async function generateCarouselFromTopic(
  topic: string,
  requestedSlidesCount?: number,
  options?: GenerationOptions
): Promise<CarouselGenerationResult> {
  const cleanedTopic = normalizeText(topic, 240) || "Новая карусель";
  const targetCount = resolveSlidesCount(requestedSlidesCount);
  const expectedFlow = resolveExpectedFlow(targetCount);

  try {
    const openai = getOpenAIClient();
    const models = resolveModelCandidates();
    let lastError: unknown = null;

    for (const model of models) {
      try {
        const response = await openai.responses.create({
          model,
          input: [
            {
              role: "system",
              content: [
                {
                  type: "input_text",
                  text: [
                    "You generate only text and semantic slide structure for social carousels.",
                    "Never generate design, layout, style, colors, fonts, positions, image prompts or coordinates.",
                    "Return strict JSON only.",
                    "Write concise, conversational, high-signal Russian copy without fluff.",
                    "Keep each slide self-contained and readable on a mobile card.",
                    "Keep text short: title up to ~7 words, subtitle up to ~14 words, bullets up to ~7 words.",
                    "Start from the provided topic. Avoid generic opener like «Одна ошибка…» unless user requested it.",
                    "Hook title must be topic-specific and must not start with «ошибка», «одна ошибка», «главная ошибка».",
                    "Avoid repeated words and broken compounds.",
                    "Do not invent extra fields or extra slide types."
                  ].join(" ")
                }
              ]
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: buildUserPrompt(cleanedTopic, expectedFlow, options)
                }
              ]
            }
          ],
          text: {
            format: {
              type: "json_schema",
              name: "carousel_text_structure",
              strict: true,
              schema: buildResponseSchema(expectedFlow.length)
            }
          }
        });

        const raw = response.output_text?.trim();

        if (!raw) {
          throw new Error("OpenAI returned empty output.");
        }

        const parsed = JSON.parse(raw) as { slides?: unknown[] };
        const normalizedSlides = normalizeSlides(parsed.slides, expectedFlow, cleanedTopic);
        const constrainedSlides = enforceTopicAndHookIntegrity(
          normalizedSlides,
          expectedFlow,
          cleanedTopic
        );
        const topicRelevantSlides = isOutlineTopicRelevant(constrainedSlides, cleanedTopic)
          ? constrainedSlides
          : buildFallbackSlides(cleanedTopic, expectedFlow);

        if (topicRelevantSlides !== normalizedSlides) {
          console.warn("Generated outline was not topic-aligned. Using deterministic fallback slides.");
        }

        return {
          slides: topicRelevantSlides
        };
      } catch (error) {
        lastError = error;

        if (!canRetryWithAnotherModel(error)) {
          throw error;
        }

        console.warn(`Model "${model}" failed for generation. Trying next candidate.`);
      }
    }

    throw lastError ?? new Error("OpenAI generation failed for all model candidates.");
  } catch (error) {
    console.error("AI generation failed. Falling back to deterministic slides:", error);

    return {
      slides: buildFallbackSlides(cleanedTopic, expectedFlow)
    };
  }
}

function resolveSlidesCount(value?: number | null) {
  const normalized = clampSlidesCount(value);
  return Math.max(8, Math.min(10, normalized));
}

function resolveExpectedFlow(targetCount: number) {
  const flow = FLOW_BY_COUNT[targetCount];
  if (flow?.length) {
    return flow;
  }

  return CANONICAL_FLOW;
}

function buildUserPrompt(topic: string, flow: CarouselSlideRole[], options?: GenerationOptions) {
  const niche = normalizeText(options?.niche ?? "", 120);
  const audience = normalizeText(options?.audience ?? "", 160);

  return [
    `Topic: ${topic}`,
    niche ? `Niche: ${niche}` : "",
    audience ? `Audience: ${audience}` : "",
    `Slides count: ${flow.length}`,
    `Required flow (strict order): ${flow.join(" -> ")}`,
    "Field rules by type:",
    "- hook: title, subtitle",
    "- problem: title, bullets[]",
    "- amplify: title, bullets[]",
    "- mistake: title",
    "- consequence: bullets[]",
    "- shift: title",
    "- solution: bullets[]",
    "- example: before, after",
    "- cta: title, subtitle",
    "Schema note: each slide object must include all fields: type, title, subtitle, bullets, before, after.",
    "For fields that are not used by the current type, return empty string \"\" or empty array [].",
    "Bullets must be short: 1 sentence each, 2-4 bullets, no long clauses.",
    "Avoid long clauses and nested lists.",
    "No markdown, no emojis, no extra commentary."
  ]
    .filter(Boolean)
    .join("\n");
}

function buildResponseSchema(slidesCount: number) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      slides: {
        type: "array",
        minItems: slidesCount,
        maxItems: slidesCount,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            type: {
              type: "string",
              enum: ["hook", "problem", "amplify", "mistake", "consequence", "shift", "solution", "example", "cta"]
            },
            title: { type: ["string", "null"], maxLength: 120 },
            subtitle: { type: ["string", "null"], maxLength: 180 },
            bullets: {
              type: ["array", "null"],
              minItems: 0,
              maxItems: 4,
              items: { type: "string", maxLength: 120 }
            },
            before: { type: ["string", "null"], maxLength: 160 },
            after: { type: ["string", "null"], maxLength: 160 }
          },
          required: ["type", "title", "subtitle", "bullets", "before", "after"]
        }
      }
    },
    required: ["slides"]
  };
}

function normalizeSlides(
  rawSlides: unknown,
  expectedFlow: CarouselSlideRole[],
  topic: string
): CarouselOutlineSlide[] {
  const source = Array.isArray(rawSlides) ? rawSlides : [];
  const usedIndexes = new Set<number>();

  return expectedFlow.map((expectedType, index) => {
    const candidateIndex = pickCandidateIndex(source, expectedType, index, usedIndexes);
    if (candidateIndex >= 0) {
      usedIndexes.add(candidateIndex);
    }
    const candidate = candidateIndex >= 0 ? source[candidateIndex] : null;

    return normalizeSlideByType(expectedType, candidate, topic, index);
  });
}

function enforceTopicAndHookIntegrity(
  slides: CarouselOutlineSlide[],
  expectedFlow: CarouselSlideRole[],
  topic: string
) {
  return expectedFlow.map((role, index) => {
    const current = slides[index];
    const fallback = normalizeSlideByType(role, null, topic, index);

    if (!current) {
      return fallback;
    }

    const normalizedTitle =
      "title" in current && typeof current.title === "string"
        ? sanitizeTitleValue(current.title, 96)
        : "";
    const hasGenericMistakeLead =
      role !== "mistake" && normalizedTitle ? startsWithGenericMistakeLead(normalizedTitle) : false;
    const hasTopicMismatch =
      role === "hook" && normalizedTitle ? !isTopicAligned(normalizedTitle, topic) : false;

    if (role === "hook" && (!normalizedTitle || hasGenericMistakeLead || hasTopicMismatch)) {
      return {
        ...current,
        title: buildHookFallbackTitle(topic),
        subtitle:
          "subtitle" in current && typeof current.subtitle === "string" && current.subtitle.trim()
            ? sanitizeCopyText(normalizeText(current.subtitle, 138), 132) ||
              "Коротко разберём, что мешает заявкам и какие шаги дают рост."
            : "Коротко разберём, что мешает заявкам и какие шаги дают рост."
      };
    }

    if (hasGenericMistakeLead) {
      return {
        ...current,
        ...(fallback as CarouselOutlineSlide)
      };
    }

    if ("title" in current && normalizedTitle) {
      return {
        ...current,
        title: normalizedTitle
      };
    }

    return current;
  });
}

function pickCandidateIndex(
  source: unknown[],
  expectedType: CarouselSlideRole,
  preferredIndex: number,
  usedIndexes: Set<number>
) {
  const preferred = source[preferredIndex];
  if (
    preferred &&
    typeof preferred === "object" &&
    !Array.isArray(preferred) &&
    !usedIndexes.has(preferredIndex)
  ) {
    const preferredType = (preferred as { type?: unknown }).type;
    if (preferredType === expectedType) {
      return preferredIndex;
    }

    // Backward compatibility for legacy payloads without `type`.
    if (typeof preferredType !== "string") {
      return preferredIndex;
    }
  }

  for (let index = 0; index < source.length; index += 1) {
    if (usedIndexes.has(index)) {
      continue;
    }

    const item = source[index];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    if ((item as { type?: unknown }).type === expectedType) {
      return index;
    }
  }

  for (let index = 0; index < source.length; index += 1) {
    if (usedIndexes.has(index)) {
      continue;
    }

    const item = source[index];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    if (typeof (item as { type?: unknown }).type !== "string") {
      return index;
    }
  }

  return -1;
}

function normalizeSlideByType(
  expectedType: CarouselSlideRole,
  rawSlide: unknown,
  topic: string,
  index: number
): CarouselOutlineSlide {
  const safe = toRecord(rawSlide);
  const topicFocus = buildTopicFocus(topic);

  if (expectedType === "hook") {
    const rawTitle = sanitizeTitleValue(safe.title, 84);
    const normalizedTitle =
      rawTitle && !startsWithGenericMistakeLead(rawTitle) && isTopicAligned(rawTitle, topic)
        ? rawTitle
        : "";
    return {
      type: "hook",
      title: normalizedTitle || buildHookFallbackTitle(topic),
      subtitle:
        sanitizeCopyText(normalizeText(safe.subtitle, 138), 132) ||
        "Коротко разберём, что мешает заявкам и какие шаги дают рост."
    };
  }

  if (expectedType === "problem") {
    const rawTitle = sanitizeTitleValue(safe.title, 80);
    return {
      type: "problem",
      title:
        (rawTitle && isTopicAligned(rawTitle, topic) ? rawTitle : "") ||
        `Где ломается поток в теме «${topicFocus}»`,
      bullets: normalizeBullets(safe.bullets, [
        "Пишете много, но человек не видит прямую выгоду.",
        "Сообщение выглядит как «ещё одно объявление».",
        "Клиент сравнивает только цену, а не результат."
      ])
    };
  }

  if (expectedType === "amplify") {
    const rawTitle = sanitizeTitleValue(safe.title, 80);
    return {
      type: "amplify",
      title:
        (rawTitle && isTopicAligned(rawTitle, topic) ? rawTitle : "") ||
        `Что это стоит в теме «${topicFocus}»`,
      bullets: normalizeBullets(safe.bullets, [
        "Уходят горячие лиды, пока вы «дожимаете» холодных.",
        "Бюджет на продвижение растет, а конверсия почти стоит.",
        "Каждая неделя без корректной подачи усиливает просадку."
      ])
    };
  }

  if (expectedType === "mistake") {
    const rawTitle = sanitizeTitleValue(safe.title, 92);
    return {
      type: "mistake",
      title:
        (rawTitle && isTopicAligned(rawTitle, topic) ? rawTitle : "") ||
        `Ключевой разрыв в теме «${topicFocus}»`
    };
  }

  if (expectedType === "consequence") {
    return {
      type: "consequence",
      bullets: normalizeBullets(safe.bullets, [
        "Торг начинается с первой минуты.",
        "Ваша экспертиза обесценивается в глазах клиента.",
        "Сделки закрываются дольше и дороже по усилиям."
      ])
    };
  }

  if (expectedType === "shift") {
    const rawTitle = sanitizeTitleValue(safe.title, 92);
    return {
      type: "shift",
      title:
        (rawTitle && isTopicAligned(rawTitle, topic) ? rawTitle : "") ||
        `Сдвиг по теме «${topicFocus}»: сначала выгода, потом цена`
    };
  }

  if (expectedType === "solution") {
    return {
      type: "solution",
      bullets: normalizeBullets(safe.bullets, [
        "Одна фраза про измеримую выгоду в первом экране.",
        "2-3 факта вместо общих обещаний.",
        "Четкий следующий шаг: что сделать клиенту прямо сейчас."
      ])
    };
  }

  if (expectedType === "example") {
    return {
      type: "example",
      before: sanitizeCopyText(normalizeText(safe.before, 128), 122) || "До: «Мы работаем лучше всех»",
      after:
        sanitizeCopyText(normalizeText(safe.after, 128), 122) ||
        "После: «За 30 дней закрыли 12 сделок на 14% выше средней цены района»"
    };
  }

  const ctaTitle = sanitizeTitleValue(safe.title, 84);
  return {
    type: "cta",
    title: ctaTitle || "Нужен такой же разбор под ваш кейс?",
    subtitle:
      sanitizeCopyText(normalizeText(safe.subtitle, 138), 132) ||
      "Напишите в директ «КАРУСЕЛЬ» и получите готовую структуру из 9 слайдов."
  };
}

function buildFallbackSlides(topic: string, flow: CarouselSlideRole[]): CarouselOutlineSlide[] {
  return flow.map((type, index) => normalizeSlideByType(type, null, topic, index));
}

function normalizeBullets(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const dedupe = new Set<string>();
  const cleaned: string[] = [];

  for (const item of value) {
    const normalized = sanitizeCopyText(normalizeText(item, 90), 86);
    if (!normalized) {
      continue;
    }

    const fingerprint = normalizeWordTokens(normalized).join(" ");
    if (!fingerprint || dedupe.has(fingerprint)) {
      continue;
    }

    dedupe.add(fingerprint);
    cleaned.push(normalized);

    if (cleaned.length >= 4) {
      break;
    }
  }

  return cleaned.length ? cleaned : fallback;
}

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  return normalized.slice(0, maxLength);
}

function buildHookFallbackTitle(topic: string) {
  const cleanTopic = normalizeText(topic, 84);

  if (!cleanTopic) {
    return "Как усилить входящий поток заявок";
  }

  if (/^(как|почему|когда|зачем|что)\b/iu.test(cleanTopic)) {
    return trimToWordBoundary(cleanTopic, 72);
  }

  return trimToWordBoundary(`Разбор темы: ${buildTopicFocus(cleanTopic)}`, 72);
}

function buildTopicFocus(topic: string) {
  const cleaned = normalizeText(topic, 84)
    .replace(/^как\s+/iu, "")
    .replace(/[.?!…]+$/u, "")
    .trim();

  if (!cleaned) {
    return "этой теме";
  }

  if (cleaned.length <= 52) {
    return cleaned;
  }

  const sliced = cleaned.slice(0, 52).trimEnd();
  const lastSpace = sliced.lastIndexOf(" ");
  return (lastSpace > 26 ? sliced.slice(0, lastSpace) : sliced).trimEnd();
}

function sanitizeCopyText(value: string, maxLength: number) {
  if (!value) {
    return "";
  }

  const noDoubleSpaces = value
    .replace(/\s+([.,!?;:])/gu, "$1")
    .replace(/([«„])\s+/gu, "$1")
    .replace(/\s+([»”])/gu, "$1")
    .replace(/\s+/gu, " ")
    .trim();

  if (!noDoubleSpaces) {
    return "";
  }

  const words = noDoubleSpaces.split(" ");
  const compactWords: string[] = [];
  let previousNormalized = "";
  const seenContentWords = new Set<string>();

  for (const word of words) {
    const normalizedWord = normalizeWordTokens(word)[0] ?? "";
    if (normalizedWord && normalizedWord === previousNormalized) {
      continue;
    }
    const shouldDedupeGlobal = normalizedWord.length >= 5 && !TOPIC_STOP_WORDS.has(normalizedWord);
    if (shouldDedupeGlobal && seenContentWords.has(normalizedWord)) {
      continue;
    }

    if (shouldDedupeGlobal) {
      seenContentWords.add(normalizedWord);
    }

    compactWords.push(word);
    previousNormalized = normalizedWord || previousNormalized;
  }

  const cleaned = compactWords.join(" ").trim();
  if (!cleaned) {
    return "";
  }

  return trimToWordBoundary(cleaned, maxLength);
}

function normalizeWordTokens(value: string) {
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function startsWithGenericMistakeLead(value: string) {
  const normalizedLead = value
    .replace(/^[\s"'`«»“”„(){}\[\].,;:!?—–-]+/gu, "")
    .replace(/\s+/gu, " ")
    .trim();

  if (!normalizedLead) {
    return false;
  }

  return /^(одн[а-яё]*\s+)?(типичн[а-яё]*\s+)?(главн[а-яё]*\s+)?ошиб[а-яё]*/iu.test(normalizedLead);
}

function sanitizeTitleValue(value: unknown, maxLength: number) {
  const rawTitle = sanitizeCopyText(normalizeText(value, maxLength + 20), maxLength);
  if (!rawTitle) {
    return "";
  }

  const words = rawTitle.split(" ").filter(Boolean);
  if (words.length <= 2) {
    return rawTitle;
  }

  const seen = new Set<string>();
  const compactWords: string[] = [];

  for (const word of words) {
    const token = normalizeWordTokens(word)[0] ?? "";
    const shouldDeduplicate = token.length >= 4 && !TOPIC_STOP_WORDS.has(token);

    if (shouldDeduplicate && seen.has(token)) {
      continue;
    }

    if (shouldDeduplicate) {
      seen.add(token);
    }

    compactWords.push(word);
  }

  return sanitizeCopyText(compactWords.join(" "), maxLength);
}

const TOPIC_STOP_WORDS = new Set([
  "как",
  "что",
  "это",
  "или",
  "для",
  "про",
  "под",
  "без",
  "при",
  "где",
  "надо",
  "нужно",
  "тема",
  "теме",
  "почему",
  "когда",
  "чтобы",
  "если",
  "так",
  "еще",
  "ещё"
]);

function isTopicAligned(copy: string, topic: string) {
  const topicTokens = normalizeWordTokens(buildTopicFocus(topic)).filter(
    (token) => token.length >= 4 && !TOPIC_STOP_WORDS.has(token)
  );

  if (topicTokens.length === 0) {
    return true;
  }

  const copyTokens = new Set(
    normalizeWordTokens(copy).filter((token) => token.length >= 4 && !TOPIC_STOP_WORDS.has(token))
  );

  if (copyTokens.size === 0) {
    return false;
  }

  for (const token of topicTokens) {
    if (copyTokens.has(token)) {
      return true;
    }
  }

  return false;
}

function isOutlineTopicRelevant(slides: CarouselOutlineSlide[], topic: string) {
  const topicTokens = normalizeWordTokens(buildTopicFocus(topic)).filter(
    (token) => token.length >= 4 && !TOPIC_STOP_WORDS.has(token)
  );

  if (topicTokens.length === 0) {
    return true;
  }

  const topicTokenSet = new Set(topicTokens);
  const minSlidesWithTopic = Math.max(4, Math.ceil(slides.length * 0.45));

  const slideHasTopic = (slide: CarouselOutlineSlide) => {
    const parts: string[] = [];

    if ("title" in slide && slide.title) {
      parts.push(slide.title);
    }
    if ("subtitle" in slide && slide.subtitle) {
      parts.push(slide.subtitle);
    }
    if ("before" in slide && slide.before) {
      parts.push(slide.before);
    }
    if ("after" in slide && slide.after) {
      parts.push(slide.after);
    }
    if ("bullets" in slide && Array.isArray(slide.bullets)) {
      parts.push(...slide.bullets);
    }

    const merged = sanitizeCopyText(parts.join(" "), 420);
    if (!merged) {
      return false;
    }

    return normalizeWordTokens(merged).some((token) => topicTokenSet.has(token));
  };

  const slidesWithTopic = slides.reduce(
    (count, slide) => (slideHasTopic(slide) ? count + 1 : count),
    0
  );

  const supportingSlideTypes: CarouselSlideRole[] = [
    "problem",
    "amplify",
    "mistake",
    "shift",
    "solution",
    "cta"
  ];
  const supportingSlidesWithTopic = slides.reduce((count, slide) => {
    if (!supportingSlideTypes.includes(slide.type)) {
      return count;
    }
    return slideHasTopic(slide) ? count + 1 : count;
  }, 0);

  const hook = slides.find((slide) => slide.type === "hook");
  const hookTitle = hook?.title?.trim() ?? "";
  const hookLooksBad = !hookTitle || startsWithGenericMistakeLead(hookTitle) || !isTopicAligned(hookTitle, topic);
  const repeatedGenericMistakes = slides.filter((slide) => {
    if (!("title" in slide) || !slide.title) {
      return false;
    }
    return startsWithGenericMistakeLead(slide.title);
  }).length;

  return (
    !hookLooksBad &&
    slidesWithTopic >= minSlidesWithTopic &&
    supportingSlidesWithTopic >= 2 &&
    repeatedGenericMistakes <= 1
  );
}

function trimToWordBoundary(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value.trim();
  }

  const sliced = value.slice(0, maxLength).trimEnd();
  const lastSpace = sliced.lastIndexOf(" ");
  return (lastSpace > Math.floor(maxLength * 0.55) ? sliced.slice(0, lastSpace) : sliced).trim();
}

function canRetryWithAnotherModel(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const status = typeof (error as { status?: unknown }).status === "number"
    ? (error as { status?: number }).status
    : null;
  const message =
    error instanceof Error
      ? error.message
      : typeof (error as { message?: unknown }).message === "string"
        ? String((error as { message?: unknown }).message)
        : "";

  if (status !== 400 && status !== 404) {
    return false;
  }

  return /\bmodel\b|does not exist|unknown model|unsupported model|not found/i.test(message);
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}
