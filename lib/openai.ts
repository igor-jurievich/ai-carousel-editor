import OpenAI from "openai";
import { clampSlidesCount } from "@/lib/slides";
import type {
  CarouselOutlineSlide,
  CarouselPostCaption,
  CarouselSlideRole
} from "@/types/editor";

type GenerationOptions = {
  niche?: string;
  audience?: string;
  tone?: string;
  goal?: string;
};

type CaptionGenerationInput = {
  topic: string;
  slides: CarouselOutlineSlide[];
  niche?: string;
  audience?: string;
  tone?: string;
  goal?: string;
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
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4o-mini"
] as const;

function resolveModelCandidates() {
  return [
    process.env.OPENAI_GENERATION_MODEL?.trim(),
    ...DEFAULT_MODEL_CANDIDATES,
    process.env.OPENAI_MODEL?.trim()
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
          temperature: 0.9,
          max_output_tokens: 2600,
          input: [
            {
              role: "system",
              content: [
                {
                  type: "input_text",
                  text: [
                    "You are a senior Russian social carousel copywriter.",
                    "You generate only text and semantic slide structure for social carousels.",
                    "Never generate design, layout, style, colors, fonts, positions, image prompts or coordinates.",
                    "Return strict JSON only.",
                    "Write concise, conversational, high-signal Russian copy without fluff and without robotic phrasing.",
                    "Adapt voice to topic and audience. Keep it native for Instagram/Telegram style content.",
                    "Keep each slide self-contained and readable on a mobile card.",
                    "Keep text short: title up to ~10 words, subtitle up to ~18 words, bullets up to ~14 words.",
                    "Start from the provided topic. Do not default to sales/real-estate language if topic is different.",
                    "If topic is educational/health/lifestyle/psychology etc, keep vocabulary in that domain.",
                    "Avoid generic opener like «Одна ошибка…» unless the topic explicitly asks for mistakes.",
                    "Hook title must be topic-specific and must not start with «ошибка», «одна ошибка», «главная ошибка».",
                    "Never use «ошибка» / «главная ошибка» / «одна ошибка» as the default first frame.",
                    "Avoid boilerplate phrases like «в теме ...», «где ломается поток», «что это стоит в теме».",
                    "Do not force the words «кейс», «разбор», «поток», «лиды» unless the topic needs them.",
                    "Avoid repeated words, broken compounds and malformed line fragments.",
                    "No clichés and no mechanical template substitutions.",
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
        const repairedSlides = repairTopicCoverage(constrainedSlides, expectedFlow, cleanedTopic);
        const topicRelevantSlides = isOutlineTopicRelevant(repairedSlides, cleanedTopic)
          ? repairedSlides
          : buildFallbackSlides(cleanedTopic, expectedFlow);

        if (topicRelevantSlides !== repairedSlides) {
          console.warn("Generated outline was strongly off-topic. Using deterministic fallback slides.");
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

export async function generateCaptionFromCarousel(
  input: CaptionGenerationInput
): Promise<CarouselPostCaption> {
  const topic = normalizeText(input.topic, 220) || "вашей теме";
  const slides = Array.isArray(input.slides) ? input.slides.slice(0, 10) : [];
  const fallback = buildCaptionFallback(topic, slides, input.goal);

  if (!slides.length) {
    return fallback;
  }

  try {
    const openai = getOpenAIClient();
    const models = resolveModelCandidates();
    let lastError: unknown = null;

    for (const model of models) {
      try {
        const response = await openai.responses.create({
          model,
          temperature: 0.85,
          max_output_tokens: 1600,
          input: [
            {
              role: "system",
              content: [
                {
                  type: "input_text",
                  text: [
                    "You are a senior Russian Instagram copywriter.",
                    "Write a post caption based on a finished carousel.",
                    "Do not repeat slide lines verbatim. Expand meaning and keep it lively.",
                    "Output strict JSON only.",
                    "Tone: social-native, concrete, no office language, no robotic templates.",
                    "Avoid clichés like «в современном мире» and other boilerplate.",
                    "Do not mention slides by number. Keep smooth narrative flow."
                  ].join(" ")
                }
              ]
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: buildCaptionPrompt({
                    topic,
                    slides,
                    niche: input.niche,
                    audience: input.audience,
                    tone: input.tone,
                    goal: input.goal
                  })
                }
              ]
            }
          ],
          text: {
            format: {
              type: "json_schema",
              name: "carousel_caption",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  text: { type: "string", maxLength: 1800 },
                  cta: { type: "string", maxLength: 220 },
                  hashtags: {
                    type: "array",
                    minItems: 3,
                    maxItems: 8,
                    items: { type: "string", maxLength: 40 }
                  }
                },
                required: ["text", "cta", "hashtags"]
              }
            }
          }
        });

        const raw = response.output_text?.trim();
        if (!raw) {
          throw new Error("OpenAI returned empty caption output.");
        }

        const parsed = JSON.parse(raw) as {
          text?: unknown;
          cta?: unknown;
          hashtags?: unknown;
        };

        return normalizeCaption(parsed, fallback);
      } catch (error) {
        lastError = error;

        if (!canRetryWithAnotherModel(error)) {
          throw error;
        }

        console.warn(`Model "${model}" failed for caption generation. Trying next candidate.`);
      }
    }

    throw lastError ?? new Error("Caption generation failed for all model candidates.");
  } catch (error) {
    console.error("Caption generation failed. Using deterministic fallback:", error);
    return fallback;
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
  const tone = normalizeText(options?.tone ?? "", 40);
  const goal = normalizeText(options?.goal ?? "", 48);

  return [
    `Topic: ${topic}`,
    niche ? `Niche: ${niche}` : "",
    audience ? `Audience: ${audience}` : "",
    tone ? `Tone preference: ${tone}` : "",
    goal ? `Goal: ${goal}` : "",
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
    "Tone: vivid, social-native, high signal, no bureaucratic wording.",
    "Each slide should carry a strong standalone idea with natural spoken Russian.",
    "Bullets must be short: 1 sentence each, 2-4 bullets, no long clauses.",
    "Keep wording topic-specific. Avoid universal sales jargon if topic is not sales-related.",
    "Avoid stale templates like «в теме ...», «одна ошибка ...», «где ломается поток ...».",
    "Avoid title collisions and duplicated words inside one line.",
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

function buildCaptionPrompt(input: CaptionGenerationInput) {
  const niche = normalizeText(input.niche ?? "", 120);
  const audience = normalizeText(input.audience ?? "", 160);
  const tone = normalizeText(input.tone ?? "", 40);
  const goal = normalizeText(input.goal ?? "", 48);
  const slideDigest = input.slides
    .map((slide, index) => {
      if (slide.type === "hook" || slide.type === "cta") {
        return `${index + 1}. ${slide.type}: ${slide.title} — ${slide.subtitle}`;
      }
      if (slide.type === "problem" || slide.type === "amplify") {
        return `${index + 1}. ${slide.type}: ${slide.title} | ${slide.bullets.join(" | ")}`;
      }
      if (slide.type === "solution") {
        return `${index + 1}. solution: ${slide.bullets.join(" | ")}`;
      }
      if (slide.type === "mistake" || slide.type === "shift") {
        return `${index + 1}. ${slide.type}: ${slide.title}`;
      }
      if (slide.type === "consequence") {
        return `${index + 1}. consequence: ${slide.bullets.join(" | ")}`;
      }
      return `${index + 1}. example: ${slide.before} => ${slide.after}`;
    })
    .join("\n");

  return [
    `Topic: ${input.topic}`,
    niche ? `Niche: ${niche}` : "",
    audience ? `Audience: ${audience}` : "",
    tone ? `Tone: ${tone}` : "",
    goal ? `Goal: ${goal}` : "",
    "Carousel summary:",
    slideDigest,
    "Requirements:",
    "- text: 900-1500 chars, coherent post caption in Russian.",
    "- include one practical mini-example or mini-story.",
    "- avoid repeating slide text line-by-line.",
    "- keep high readability and social tone.",
    "- cta: one clear next action in 1 sentence.",
    "- hashtags: 4-8 relevant hashtags."
  ]
    .filter(Boolean)
    .join("\n");
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
    if (role === "hook") {
      const safeSubtitle =
        "subtitle" in current && typeof current.subtitle === "string" && current.subtitle.trim()
          ? sanitizeCopyText(normalizeText(current.subtitle, 138), 132)
          : "";
      const hookCopy = [normalizedTitle, safeSubtitle].filter(Boolean).join(" ");
      const hookTopicMismatch = !isCopyTopicAligned(hookCopy, topic);

      if (!normalizedTitle || hasGenericMistakeLead || hookTopicMismatch) {
        return {
          ...current,
          title: buildHookFallbackTitle(topic),
          subtitle: safeSubtitle || buildHookFallbackSubtitle(topic)
        };
      }
    }

    if (hasGenericMistakeLead) {
      if ("title" in fallback && typeof fallback.title === "string") {
        return {
          ...current,
          title: fallback.title
        };
      }

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

function repairTopicCoverage(
  slides: CarouselOutlineSlide[],
  expectedFlow: CarouselSlideRole[],
  topic: string
) {
  const topicStems = buildTopicStemSet(topic);
  if (topicStems.size === 0) {
    return slides;
  }

  const topicMatches = slides.map((slide) =>
    slide ? hasTopicStemMatch(collectSlideCopy(slide), topicStems) : false
  );
  const hookIndex = expectedFlow.findIndex((role) => role === "hook");
  const resolvedHookIndex = hookIndex >= 0 ? hookIndex : 0;
  const hasHookTopic = topicMatches[resolvedHookIndex] ?? false;
  const hasSupportingTopic = topicMatches.some((match, index) => match && index !== resolvedHookIndex);

  if (hasHookTopic && hasSupportingTopic) {
    return slides;
  }

  const patchedSlides = slides.map((slide) => ({ ...slide })) as CarouselOutlineSlide[];
  const hook = patchedSlides[resolvedHookIndex];

  if (hook && !hasHookTopic && hook.type === "hook") {
    const safeSubtitle =
      typeof hook.subtitle === "string" ? sanitizeCopyText(normalizeText(hook.subtitle, 138), 132) : "";
    hook.title = buildHookFallbackTitle(topic);
    hook.subtitle = safeSubtitle || buildHookFallbackSubtitle(topic);
  }

  if (hasSupportingTopic) {
    return patchedSlides;
  }

  const topicAnchor = buildTopicAnchorLabel(topic);

  for (let index = 0; index < expectedFlow.length; index += 1) {
    if (index === resolvedHookIndex) {
      continue;
    }

    const slide = patchedSlides[index];
    if (!slide || topicMatches[index]) {
      continue;
    }

    if ("title" in slide && typeof slide.title === "string" && slide.title.trim()) {
      slide.title = addTopicAnchorToTitle(slide.title, topicAnchor);
      return patchedSlides;
    }

    if ("bullets" in slide && Array.isArray(slide.bullets) && slide.bullets.length > 0) {
      const [first, ...rest] = slide.bullets;
      const normalizedFirst = sanitizeCopyText(normalizeText(first, 90), 86);
      slide.bullets = [`${normalizedFirst} (${topicAnchor})`, ...rest]
        .map((item) => sanitizeCopyText(normalizeText(item, 90), 86))
        .filter(Boolean);
      return patchedSlides;
    }
  }

  return patchedSlides;
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
      rawTitle &&
      !startsWithGenericMistakeLead(rawTitle) &&
      !hasLegacyTemplatePhrase(rawTitle)
        ? rawTitle
        : "";
    return {
      type: "hook",
      title: normalizedTitle || buildHookFallbackTitle(topic),
      subtitle:
        sanitizeCopyText(normalizeText(safe.subtitle, 138), 132) || buildHookFallbackSubtitle(topic)
    };
  }

  if (expectedType === "problem") {
    const rawTitle = sanitizeTitleValue(safe.title, 80);
    return {
      type: "problem",
      title:
        (rawTitle && !startsWithGenericMistakeLead(rawTitle) && !hasLegacyTemplatePhrase(rawTitle)
          ? rawTitle
          : "") || trimToWordBoundary(`Почему контент про ${topicFocus} быстро пролистывают`, 80),
      bullets: normalizeBullets(safe.bullets, [
        "Формулировка звучит слишком общей и не цепляет с первых строк.",
        "Тема есть, но человеку непонятно, какую пользу он получит дальше.",
        "Сильная мысль теряется в длинных фразах и лишних пояснениях."
      ])
    };
  }

  if (expectedType === "amplify") {
    const rawTitle = sanitizeTitleValue(safe.title, 80);
    return {
      type: "amplify",
      title:
        (rawTitle && !startsWithGenericMistakeLead(rawTitle) && !hasLegacyTemplatePhrase(rawTitle)
          ? rawTitle
          : "") || trimToWordBoundary("Дальше эффект накапливается и просадка становится заметной", 80),
      bullets: normalizeBullets(safe.bullets, [
        "Просмотры есть, но сохранений и пересылок почти не появляется.",
        "Часть аудитории не доходит до сути и теряет интерес по дороге.",
        "На контент уходит время, а результат остается неровным."
      ])
    };
  }

  if (expectedType === "mistake") {
    const rawTitle = sanitizeTitleValue(safe.title, 92);
    return {
      type: "mistake",
      title:
        (rawTitle && !hasLegacyTemplatePhrase(rawTitle) ? rawTitle : "") ||
        trimToWordBoundary(`Ложная установка про ${topicFocus}, которая режет результат`, 92)
    };
  }

  if (expectedType === "consequence") {
    return {
      type: "consequence",
      bullets: normalizeBullets(safe.bullets, [
        "Аудитория листает дальше, не доходя до главного.",
        "Экспертность считывается слабее, чем могла бы.",
        "Контент есть, а системного эффекта по отклику нет."
      ])
    };
  }

  if (expectedType === "shift") {
    const rawTitle = sanitizeTitleValue(safe.title, 92);
    return {
      type: "shift",
      title:
        (rawTitle && !startsWithGenericMistakeLead(rawTitle) && !hasLegacyTemplatePhrase(rawTitle)
          ? rawTitle
          : "") ||
        trimToWordBoundary(`Сдвиг: меньше шума, больше конкретики про ${topicFocus}`, 92)
    };
  }

  if (expectedType === "solution") {
    return {
      type: "solution",
      bullets: normalizeBullets(safe.bullets, [
        "Держите одну мысль на слайд, чтобы взгляд не распадался.",
        "Подкрепляйте тезис фактом, мини-примером или короткой цифрой.",
        "В конце оставляйте простой следующий шаг без лишнего давления."
      ])
    };
  }

  if (expectedType === "example") {
    return {
      type: "example",
      before:
        sanitizeCopyText(normalizeText(safe.before, 128), 122) ||
        `До: «${topicFocus} важен, мы делаем это качественно»`,
      after:
        sanitizeCopyText(normalizeText(safe.after, 128), 122) ||
        `После: «Внедрили 3 шага и получили заметный рост отклика по ${topicFocus}»`
    };
  }

  const ctaTitle = sanitizeTitleValue(safe.title, 84);
  return {
    type: "cta",
    title: ctaTitle || trimToWordBoundary("Хотите адаптацию под свою тему?", 84),
    subtitle:
      sanitizeCopyText(normalizeText(safe.subtitle, 138), 132) ||
      "Напишите в директ «КАРУСЕЛЬ» — соберу сильную структуру под ваш контент."
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
  const cleanTopic = normalizeText(topic, 96)
    .replace(/[.?!…]+$/u, "")
    .trim();

  if (!cleanTopic) {
    return "Идея, которая усиливает ваш контент";
  }

  if (/^(как|почему|когда|зачем|что)\b/iu.test(cleanTopic)) {
    return trimToWordBoundary(cleanTopic, 72);
  }

  const topicFocus = buildTopicFocus(cleanTopic);
  const variants = [
    `Как усилить ${topicFocus} так, чтобы дочитывали до конца`,
    `Что в ${topicFocus} реально цепляет с первого экрана`,
    `Сильный вход в ${topicFocus}: фраза, которая удерживает внимание`,
    `Где в ${topicFocus} лежит быстрый рычаг роста отклика`
  ];
  return trimToWordBoundary(pickVariantByTopic(topicFocus, variants), 72);
}

function buildHookFallbackSubtitle(topic: string) {
  const topicFocus = buildTopicFocus(topic);
  const variants = [
    `Покажу короткую структуру по ${topicFocus} без воды и штампов.`,
    "Только практичные формулировки, которые можно применить сразу после чтения.",
    "Соберем живую карусельную логику: крючок, напряжение, решение и CTA."
  ];

  return trimToWordBoundary(pickVariantByTopic(topicFocus, variants), 132);
}

function pickVariantByTopic(topic: string, variants: string[]) {
  const seed = Array.from(topic).reduce((acc, char) => {
    const code = char.codePointAt(0) ?? 0;
    return (acc * 33 + code) % 1_000_003;
  }, 7);

  return variants[Math.abs(seed) % variants.length] ?? variants[0] ?? "";
}

function buildTopicFocus(topic: string) {
  const cleaned = normalizeText(topic, 84)
    .replace(/^как\s+/iu, "")
    .replace(/[.?!…]+$/u, "")
    .trim();

  if (!cleaned) {
    return "вашей теме";
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

  for (const word of words) {
    const normalizedWord = normalizeWordTokens(word)[0] ?? "";
    if (normalizedWord && normalizedWord === previousNormalized) {
      continue;
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

function hasLegacyTemplatePhrase(value: string) {
  return /\b(в\s+теме|где\s+ломается\s+поток|где\s+теряется\s+внимание|что\s+это\s+стоит\s+в\s+теме|разбор\s+под\s+ваш\s+кейс)\b/iu.test(
    value
  );
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

function topicStem(token: string) {
  return token.slice(0, Math.min(6, token.length));
}

function buildTopicStemSet(topic: string) {
  return new Set(
    normalizeWordTokens(normalizeText(topic, 180))
      .filter((token) => token.length >= 3 && !TOPIC_STOP_WORDS.has(token))
      .map((token) => topicStem(token))
  );
}

function collectSlideCopy(slide: CarouselOutlineSlide) {
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

  return normalizeText(parts.join(" "), 420);
}

function hasTopicStemMatch(copy: string, topicStems: Set<string>) {
  if (topicStems.size === 0) {
    return true;
  }

  const copyTokens = normalizeWordTokens(copy).filter(
    (token) => token.length >= 4 && !TOPIC_STOP_WORDS.has(token)
  );
  if (copyTokens.length === 0) {
    return false;
  }

  return copyTokens.some((token) => {
    const stem = topicStem(token);
    if (topicStems.has(stem)) {
      return true;
    }

    for (const topicToken of topicStems) {
      if (stem.startsWith(topicToken) || topicToken.startsWith(stem)) {
        return true;
      }
    }

    return false;
  });
}

function isCopyTopicAligned(copy: string, topic: string) {
  return hasTopicStemMatch(copy, buildTopicStemSet(topic));
}

function isOutlineTopicRelevant(slides: CarouselOutlineSlide[], topic: string) {
  const hook = slides.find((slide) => slide.type === "hook");
  const hookTitle = hook?.title?.trim() ?? "";
  const hookLooksBad = !hookTitle || startsWithGenericMistakeLead(hookTitle);
  const repeatedGenericMistakes = slides.filter((slide) => {
    if (!("title" in slide) || !slide.title) {
      return false;
    }
    return startsWithGenericMistakeLead(slide.title);
  }).length;

  if (hookLooksBad || repeatedGenericMistakes > 1) {
    return false;
  }

  const topicStems = buildTopicStemSet(topic);
  if (topicStems.size === 0) {
    return true;
  }
  const slideHasTopic = (slide: CarouselOutlineSlide) => hasTopicStemMatch(collectSlideCopy(slide), topicStems);
  const slidesWithTopic = slides.reduce((count, slide) => (slideHasTopic(slide) ? count + 1 : count), 0);

  if (slidesWithTopic === 0) {
    return false;
  }

  const hookText = [hook?.title ?? "", hook?.subtitle ?? ""].join(" ").trim();
  if (!hookText) {
    return false;
  }

  if (hasTopicStemMatch(hookText, topicStems)) {
    return true;
  }

  return slidesWithTopic >= 2;
}

function buildTopicAnchorLabel(topic: string) {
  const focus = buildTopicFocus(topic).replace(/^как\s+/iu, "").trim();
  return trimToWordBoundary(focus || "вашу тему", 34);
}

function addTopicAnchorToTitle(title: string, topicAnchor: string) {
  const normalizedTitle = sanitizeTitleValue(title, 90);
  if (!normalizedTitle) {
    return `Про ${topicAnchor}`;
  }

  const alreadyAnchored = new RegExp(`\\b${escapeRegExp(topicAnchor)}\\b`, "iu").test(normalizedTitle);
  if (alreadyAnchored) {
    return normalizedTitle;
  }

  return trimToWordBoundary(`${normalizedTitle} — про ${topicAnchor}`, 90);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function trimToWordBoundary(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value.trim();
  }

  const sliced = value.slice(0, maxLength).trimEnd();
  const lastSpace = sliced.lastIndexOf(" ");
  return (lastSpace > Math.floor(maxLength * 0.55) ? sliced.slice(0, lastSpace) : sliced).trim();
}

function normalizeCaption(
  raw: { text?: unknown; cta?: unknown; hashtags?: unknown },
  fallback: CarouselPostCaption
): CarouselPostCaption {
  const text = sanitizeCopyText(normalizeText(raw.text, 1800), 1750) || fallback.text;
  const cta = sanitizeCopyText(normalizeText(raw.cta, 220), 210) || fallback.cta;
  const hashtags = normalizeHashtags(raw.hashtags);

  return {
    text,
    cta,
    hashtags: hashtags.length ? hashtags : fallback.hashtags
  };
}

function normalizeHashtags(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  const seen = new Set<string>();
  const hashtags: string[] = [];

  for (const item of value) {
    const normalized = normalizeText(item, 40)
      .replace(/\s+/g, "")
      .replace(/^#+/g, "")
      .replace(/[^\p{L}\p{N}_-]+/gu, "")
      .toLowerCase();

    if (!normalized) {
      continue;
    }

    const tag = `#${normalized}`;
    if (seen.has(tag)) {
      continue;
    }

    seen.add(tag);
    hashtags.push(tag);

    if (hashtags.length >= 8) {
      break;
    }
  }

  return hashtags;
}

function buildCaptionFallback(topic: string, slides: CarouselOutlineSlide[], goal?: string): CarouselPostCaption {
  const hook = slides.find((slide) => slide.type === "hook");
  const solution = slides.find((slide) => slide.type === "solution");
  const firstIdea = hook?.title || buildHookFallbackTitle(topic);
  const solutionLine =
    solution && "bullets" in solution && solution.bullets.length
      ? solution.bullets[0]
      : "Разбейте тему на короткие, самостоятельные мысли — так дочитывают чаще.";
  const cta = buildGoalAwareCta(goal);

  const text = trimToWordBoundary(
    [
      `${firstIdea}.`,
      `Главная мысль этой карусели: ${solutionLine}`,
      "Сфокусируйтесь на одной проблеме аудитории и разверните её через контраст: было -> стало.",
      "Так текст звучит живо, не теряет ритм и даёт человеку понятный следующий шаг."
    ].join(" "),
    1700
  );

  return {
    text,
    cta,
    hashtags: buildFallbackHashtags(topic)
  };
}

function buildGoalAwareCta(goal?: string) {
  const normalizedGoal = normalizeText(goal, 40).toLowerCase();

  if (normalizedGoal.includes("заяв")) {
    return "Если хотите такую же структуру под свой продукт, напишите в директ «КАРУСЕЛЬ».";
  }

  if (normalizedGoal.includes("подпис")) {
    return "Если было полезно, сохраните пост и подпишитесь — продолжу разборы в этом формате.";
  }

  return "Сохраните карусель как шпаргалку и напишите «ПЛАН», если нужен разбор под вашу тему.";
}

function buildFallbackHashtags(topic: string) {
  const base = normalizeWordTokens(topic)
    .filter((token) => token.length >= 4 && !TOPIC_STOP_WORDS.has(token))
    .slice(0, 3)
    .map((token) => `#${token}`);

  const defaults = ["#контент", "#карусель", "#маркетинг", "#instagram"];
  const unique = new Set<string>();
  const result: string[] = [];

  for (const item of [...base, ...defaults]) {
    const normalized = item.startsWith("#") ? item : `#${item}`;
    if (unique.has(normalized)) {
      continue;
    }
    unique.add(normalized);
    result.push(normalized);
    if (result.length >= 6) {
      break;
    }
  }

  return result;
}

function canRetryWithAnotherModel(error: unknown) {
  if (error instanceof SyntaxError) {
    return true;
  }

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

  if (status === 404) {
    return true;
  }

  if (status === 400) {
    return /\bmodel\b|does not exist|unknown model|unsupported model|not found|unsupported parameter|unknown parameter|invalid value|invalid_request|json|schema|temperature|max_output_tokens/i.test(
      message
    );
  }

  if (status === null && /empty output|json|schema|unexpected token/i.test(message)) {
    return true;
  }

  return false;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}
