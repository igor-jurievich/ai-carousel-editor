import OpenAI from "openai";
import { clampSlidesCount } from "@/lib/slides";
import {
  CONTENT_MODE_LIST,
  DEFAULT_MODEL_CANDIDATES,
  FALLBACK_TITLES,
  FLOW_BY_COUNT,
  MODE_ROLE_PLANS_BY_COUNT,
  MODE_SLIDE_COUNT_RANGES,
  MODE_SLIDE_PLANS,
  type CarouselFallbackReason,
  type CarouselGenerationMeta,
  type CarouselGenerationSource,
  type GenerationOptions,
  type ModeDecision,
  type PromptVariant
} from "@/lib/generation/constants";
import type {
  CarouselOutlineSlide,
  CarouselPostCaption,
  CarouselSlideRole,
  ContentMode,
  ContentModeInput
} from "@/types/editor";

export type { PromptVariant, GenerationOptions } from "@/lib/generation/constants";

/**
 * Чистый движок генерации каруселей.
 *
 * Заменяет прежний lib/openai.ts (7372 строки эвристик repair/polish/rescue и
 * топик-специфичных хаков). Принципы:
 *  1. Структуру гарантирует ПЛАН РОЛЕЙ + strict JSON schema — не пост-ремонт.
 *  2. Текст модели не переписывается кодом; только trim и ограничение длины.
 *  3. Пустое поле добирается нейтральной заготовкой ТОЛЬКО для этой роли.
 *  4. Один ретрай на модель → следующая модель → детерминированный фолбэк.
 */

const DEFAULT_REQUEST_TIMEOUT_MS = 82_000;
const CAROUSEL_MAX_OUTPUT_TOKENS = 8_000; // запас под reasoning-токены gpt-5.x
const CAPTION_MAX_OUTPUT_TOKENS = 3_000;
const TITLE_MAX = 84;
const SUBTITLE_MAX = 150;
const BODY_MAX = 330;
const BULLET_MAX = 96;
const EXAMPLE_MAX = 122;

export type CarouselGenerationProfile = {
  modeDetected: ContentMode;
  modeEffective: ContentMode;
  modeSource: "auto" | "manual";
  modeConfidence: number;
  flowTemplate: string;
  ctaType: "direct" | "soft";
  firstSlideRepairs: number;
  toneViolations: number;
  modeValidationPassed: boolean;
  modeValidationErrors: string[];
  modeReasonCodes: string[];
  fallbackUsed: boolean;
};

export type CarouselGenerationResult = {
  slides: CarouselOutlineSlide[];
  caption: string;
  promptVariant: PromptVariant;
  generationSource: CarouselGenerationSource;
  generationMeta: CarouselGenerationMeta;
  generationProfile: CarouselGenerationProfile;
  fallbackReason?: CarouselFallbackReason;
};

type ModelSlide = {
  role?: unknown;
  title?: unknown;
  body?: unknown;
  bullets?: unknown;
  before?: unknown;
  after?: unknown;
  cta_text?: unknown;
};

let openAiClient: OpenAI | null = null;

function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing.");
  }
  if (!openAiClient) {
    openAiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openAiClient;
}

function resolveModelCandidates(): string[] {
  return [
    process.env.OPENAI_GENERATION_MODEL?.trim(),
    process.env.OPENAI_MODEL?.trim(),
    ...DEFAULT_MODEL_CANDIDATES
  ]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, list) => list.indexOf(value) === index)
    .slice(0, 3);
}

// ---------------------------------------------------------------------------
// Режим контента: явный выбор пользователя или простая детекция по теме.
// ---------------------------------------------------------------------------

const MODE_HINTS: Array<{ mode: ContentMode; pattern: RegExp }> = [
  { mode: "sales", pattern: /(прода|заявк|запис|клиент|купи|скидк|консультаци|лид|воронк)/iu },
  { mode: "instruction", pattern: /(как\s|пошагов|инструкци|чек-?лист|план\b|шаг(?:и|ов)?\b|настро)/iu },
  { mode: "case", pattern: /(кейс|до\s*\/?\s*после|результат\s+за|вырос|увеличил)/iu },
  { mode: "diagnostic", pattern: /(ошибк|почему\s+не|не\s+работает|провал|сливает|теря)/iu },
  { mode: "social", pattern: /(истори|личн\w*\s+опыт|будни|честно|призна)/iu }
];

function detectMode(topic: string, override?: ContentModeInput): ModeDecision {
  if (override && override !== "auto" && CONTENT_MODE_LIST.includes(override)) {
    return {
      modeDetected: override,
      modeEffective: override,
      modeSource: "manual",
      confidence: 0.95,
      reasonCodes: ["manual_override"]
    };
  }

  for (const hint of MODE_HINTS) {
    if (hint.pattern.test(topic)) {
      return {
        modeDetected: hint.mode,
        modeEffective: hint.mode,
        modeSource: "auto",
        confidence: 0.6,
        reasonCodes: [`auto_${hint.mode}`]
      };
    }
  }

  return {
    modeDetected: "expert",
    modeEffective: "expert",
    modeSource: "auto",
    confidence: 0.5,
    reasonCodes: ["auto_default_expert"]
  };
}

function resolveSlidesCount(mode: ContentMode, requested?: number | null) {
  if (typeof requested === "number" && Number.isFinite(requested)) {
    return clampSlidesCount(requested);
  }
  return MODE_SLIDE_COUNT_RANGES[mode]?.defaultCount ?? 8;
}

function resolveRolePlan(mode: ContentMode, count: number): CarouselSlideRole[] {
  const byMode = MODE_ROLE_PLANS_BY_COUNT[mode]?.[count];
  if (Array.isArray(byMode) && byMode.length === count) {
    return byMode;
  }
  // Полный 9-шаговый план режима (порядок ролей у режимов различается).
  const modePlan = MODE_SLIDE_PLANS[mode]?.map((step) => step.role);
  if (Array.isArray(modePlan) && modePlan.length === count) {
    return modePlan;
  }
  const byCount = FLOW_BY_COUNT[count];
  if (Array.isArray(byCount) && byCount.length === count) {
    return byCount;
  }
  return FLOW_BY_COUNT[8];
}

function roleIntent(mode: ContentMode, role: CarouselSlideRole) {
  return MODE_SLIDE_PLANS[mode]?.find((step) => step.role === role)?.intent ?? "";
}

// ---------------------------------------------------------------------------
// Промпты и схема ответа.
// ---------------------------------------------------------------------------

function buildSystemPrompt(mode: ContentMode) {
  const ctaRule =
    mode === "sales"
      ? "CTA: подзаголовок НАЧИНАЕТСЯ с глагола: «Напишите…», «Отправьте…», «Оставьте…» — и даёт понятную выгоду (например: «Напишите слово РАЗБОР — получите план под вашу ситуацию»)."
      : "CTA: подзаголовок НАЧИНАЕТСЯ с одного из глаголов: «Сохраните…», «Выберите…», «Примените…», «Проверьте…». Мягко, без давления и «пишите в директ».";

  const modeRule =
    mode === "expert"
      ? "- Слайд shift обязан объяснять МЕХАНИЗМ и содержать слово «потому что», «поэтому» или «из-за» (например: «Клиенты возвращаются, потому что…»)."
      : mode === "instruction"
        ? "- Буллеты solution — пронумерованные шаги: «Шаг 1: …», «Шаг 2: …», каждый с конкретным действием."
        : mode === "social"
          ? "- Hook обязан прямо называть тему/героя ситуации, чтобы читатель узнал себя без контекста."
          : "";

  return [
    "Ты — сильный русскоязычный копирайтер социальных сетей.",
    "Пишешь текст карусели: цепко, конкретно, без воды и канцелярита.",
    "ЖЁСТКИЕ ТРЕБОВАНИЯ К ПЛОТНОСТИ ТЕКСТА:",
    "- Заголовок КАЖДОГО слайда: 4-6 слов, НИКОГДА не короче 4 слов. Особенно mistake и shift.",
    "- Каждый bullet: 6-12 слов (45-90 символов), начинается с глагола или наблюдаемого факта. Никаких обрубков из 2-3 слов.",
    "- example: «до» и «после» по 6-12 слов, каждый с цифрой или конкретным фактом.",
    "- Подзаголовки hook/cta: 8-16 слов, законченная мысль.",
    "ПРАВИЛА СОДЕРЖАНИЯ:",
    "- Первый слайд (hook) цепляет болью, фактом, цифрой или интригой и содержит ключевые слова темы. Запрещено начинать с «Сегодня», «Я расскажу», «В этой карусели», «Привет».",
    "- Не используй слова: Instagram, карусель, слайд, пост, свайп, пользователь.",
    "- Одна мысль на слайд. Никаких повторов одной мысли разными словами.",
    `- ${ctaRule}`,
    modeRule,
    "Отвечай строго JSON по схеме."
  ]
    .filter(Boolean)
    .join("\n");
}

function buildUserPrompt(
  topic: string,
  plan: CarouselSlideRole[],
  mode: ContentMode,
  options?: GenerationOptions
) {
  const planLines = plan
    .map((role, index) => `${index + 1}. ${role}${roleIntent(mode, role) ? ` — ${roleIntent(mode, role)}` : ""}`)
    .join("\n");
  const context = [
    options?.niche ? `Ниша: ${options.niche}` : "",
    options?.audience ? `Аудитория: ${options.audience}` : "",
    options?.tone ? `Тон: ${options.tone}` : "",
    options?.goal ? `Цель: ${options.goal}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  return [
    `Тема: «${topic}»`,
    context,
    `Режим: ${mode}. Слайдов: ${plan.length}. План ролей по порядку:`,
    planLines,
    "Для каждого слайда заполни поля своей роли; нерелевантные поля — пустые строки/массив.",
    "Также напиши caption — подпись к публикации 400-900 символов, без хештегов в тексте."
  ]
    .filter(Boolean)
    .join("\n\n");
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
            role: {
              type: "string",
              enum: ["hook", "problem", "amplify", "mistake", "consequence", "shift", "solution", "example", "cta"]
            },
            title: {
              type: "string",
              maxLength: 90,
              description: "Заголовок 4-6 слов, конкретный. Для example — пустая строка."
            },
            body: {
              type: "string",
              maxLength: 700,
              description: "Для hook/cta — подзаголовок 8-16 слов. Для mistake/shift — 1-2 плотных предложения."
            },
            bullets: {
              type: "array",
              minItems: 0,
              maxItems: 4,
              description: "Для problem/amplify/consequence/solution: 3 пункта по 6-12 слов каждый.",
              items: { type: "string", maxLength: 110 }
            },
            before: {
              type: "string",
              maxLength: 150,
              description: "Только для example: «до» 6-12 слов с цифрой/фактом."
            },
            after: {
              type: "string",
              maxLength: 150,
              description: "Только для example: «после» 6-12 слов с цифрой/фактом."
            },
            cta_text: {
              type: "string",
              maxLength: 160,
              description: "Только для cta: начинается с глагола действия (сохраните/примените/напишите...)."
            }
          },
          required: ["role", "title", "body", "bullets", "before", "after", "cta_text"]
        }
      },
      caption: { type: "string", maxLength: 2200 }
    },
    required: ["slides", "caption"]
  };
}

// ---------------------------------------------------------------------------
// Лёгкая нормализация текста: только пробелы и длина. Без подмен слов.
// ---------------------------------------------------------------------------

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") {
    return "";
  }
  const normalized = value.replace(/\s+/gu, " ").replace(/\s+([,.!?;:])/gu, "$1").trim();
  if (normalized.length <= max) {
    return normalized;
  }
  const sliced = normalized.slice(0, max + 1);
  const boundary = sliced.lastIndexOf(" ");
  return (boundary > max * 0.6 ? sliced.slice(0, boundary) : sliced.slice(0, max)).replace(/[,;:—–-]+$/u, "").trim();
}

function cleanBullets(value: unknown, fallback: string[]): string[] {
  const bullets = Array.isArray(value)
    ? value.map((item) => clean(item, BULLET_MAX)).filter(Boolean).slice(0, 4)
    : [];
  return bullets.length >= 2 ? bullets : fallback;
}

// ---------------------------------------------------------------------------
// Фолбэк-контент: нейтральный, тематизированный только подстановкой темы.
// ---------------------------------------------------------------------------

function pickTitle(role: CarouselSlideRole, seed: number) {
  const variants = FALLBACK_TITLES[role];
  return variants[seed % variants.length];
}

function topicSeed(topic: string) {
  let hash = 0;
  for (const char of topic) {
    hash = (hash * 31 + char.charCodeAt(0)) % 997;
  }
  return hash;
}

function fallbackSlideFor(role: CarouselSlideRole, topic: string, seed: number): CarouselOutlineSlide {
  const shortTopic = clean(topic, 60) || "вашей теме";
  switch (role) {
    case "hook":
      return {
        type: "hook",
        title: pickTitle("hook", seed),
        subtitle: `Разбор по теме «${shortTopic}»: что мешает результату и с чего начать сегодня.`
      };
    case "problem":
      return {
        type: "problem",
        title: pickTitle("problem", seed),
        bullets: [
          "Усилия есть, а результат нестабильный и непредсказуемый.",
          "Непонятно, какой шаг двигает вперёд, а какой съедает время.",
          "Каждый раз приходится начинать почти с нуля."
        ]
      };
    case "amplify":
      return {
        type: "amplify",
        title: pickTitle("amplify", seed),
        bullets: [
          "Чем дольше откладывается разбор, тем дороже цена ошибки.",
          "Хаотичные попытки закрепляются как привычка.",
          "Уверенность падает, хотя ресурс тратится тот же."
        ]
      };
    case "mistake":
      return {
        type: "mistake",
        title: pickTitle("mistake", seed),
        body: "Пытаться делать всё сразу вместо одного проверяемого шага. Так не видно, что реально работает."
      };
    case "consequence":
      return {
        type: "consequence",
        title: pickTitle("consequence", seed),
        bullets: [
          "Результат зависит от случайности, а не от системы.",
          "Время уходит на переделки, а не на движение вперёд.",
          "Мотивация падает от повторяющихся откатов."
        ]
      };
    case "shift":
      return {
        type: "shift",
        title: pickTitle("shift", seed),
        body: "Смените фокус: не «сделать больше», а «сделать одно и проверить». Один шаг, один критерий результата."
      };
    case "solution":
      return {
        type: "solution",
        title: pickTitle("solution", seed),
        bullets: [
          "Выберите один конкретный шаг на ближайшие 2 дня.",
          "Зафиксируйте, по какому признаку поймёте, что сработало.",
          "Повторите то, что дало результат, и уберите лишнее."
        ]
      };
    case "example":
      return {
        type: "example",
        before: `До: «${shortTopic}» делали хаотично — результат скакал.`,
        after: "После: один проверяемый шаг за раз — результат стал повторяться."
      };
    default:
      return {
        type: "cta",
        title: pickTitle("cta", seed),
        subtitle: "Сохраните разбор и примените один пункт к ближайшей задаче."
      };
  }
}

function buildFallbackSlides(topic: string, plan: CarouselSlideRole[]): CarouselOutlineSlide[] {
  const seed = topicSeed(topic);
  return plan.map((role, index) => fallbackSlideFor(role, topic, seed + index));
}

// ---------------------------------------------------------------------------
// Маппинг ответа модели: роль диктуется планом, пустоты добираются фолбэком.
// ---------------------------------------------------------------------------

function mapModelSlides(
  raw: unknown,
  plan: CarouselSlideRole[],
  topic: string
): { slides: CarouselOutlineSlide[]; patched: number } {
  const source = Array.isArray(raw) ? (raw as ModelSlide[]) : [];
  const seed = topicSeed(topic);
  let patched = 0;

  const slides = plan.map((role, index) => {
    const record = source[index] ?? {};
    const fallback = fallbackSlideFor(role, topic, seed + index);
    const title = clean(record.title, TITLE_MAX);
    const body = clean(record.body, BODY_MAX);
    const ctaText = clean(record.cta_text, SUBTITLE_MAX);
    const before = clean(record.before, EXAMPLE_MAX);
    const after = clean(record.after, EXAMPLE_MAX);

    const need = (value: string, fallbackValue: string) => {
      if (value) {
        return value;
      }
      patched += 1;
      return fallbackValue;
    };

    switch (role) {
      case "hook":
        return {
          type: "hook",
          title: need(title, (fallback as { title: string }).title),
          subtitle: need(clean(record.body, SUBTITLE_MAX), (fallback as { subtitle: string }).subtitle)
        } satisfies CarouselOutlineSlide;
      case "cta":
        return {
          type: "cta",
          title: need(title, (fallback as { title: string }).title),
          subtitle: need(ctaText || clean(record.body, SUBTITLE_MAX), (fallback as { subtitle: string }).subtitle)
        } satisfies CarouselOutlineSlide;
      case "problem":
      case "amplify": {
        const fallbackBullets = (fallback as { bullets: string[] }).bullets;
        const bullets = cleanBullets(record.bullets, fallbackBullets);
        if (bullets === fallbackBullets) {
          patched += 1;
        }
        return {
          type: role,
          title: need(title, (fallback as { title: string }).title),
          bullets
        } satisfies CarouselOutlineSlide;
      }
      case "consequence":
      case "solution": {
        const fallbackBullets = (fallback as { bullets: string[] }).bullets;
        const bullets = cleanBullets(record.bullets, fallbackBullets);
        if (bullets === fallbackBullets) {
          patched += 1;
        }
        return {
          type: role,
          title: title || undefined,
          bullets
        } satisfies CarouselOutlineSlide;
      }
      case "mistake":
      case "shift":
        return {
          type: role,
          title: need(title, (fallback as { title: string }).title),
          body: body || (fallback as { body?: string }).body
        } satisfies CarouselOutlineSlide;
      default:
        return {
          type: "example",
          before: need(before, (fallback as { before: string }).before),
          after: need(after, (fallback as { after: string }).after)
        } satisfies CarouselOutlineSlide;
    }
  });

  return { slides, patched };
}

// ---------------------------------------------------------------------------
// Вызов модели.
// ---------------------------------------------------------------------------

function resolveTimeout(options?: GenerationOptions) {
  const raw = Number(options?.requestTimeoutMs ?? process.env.OPENAI_REQUEST_TIMEOUT_MS);
  if (!Number.isFinite(raw)) {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }
  return Math.max(10_000, Math.min(120_000, Math.round(raw)));
}

function readTokens(response: { usage?: { total_tokens?: number | null } | null }) {
  const raw = response.usage?.total_tokens;
  return typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 0;
}

function shouldTryNextModel(error: unknown) {
  const status = (error as { status?: number })?.status;
  if (status === 404 || status === 400 || status === 403) {
    return true;
  }
  const message = error instanceof Error ? error.message : "";
  return /model|schema|unsupported|invalid/iu.test(message);
}

function resolveFallbackReason(error: unknown): CarouselFallbackReason {
  const combined = `${(error as Error)?.name ?? ""} ${(error as Error)?.message ?? ""}`.toLowerCase();
  if (/quota|billing|insufficient|429/.test(combined)) {
    return "quota";
  }
  if (/timeout|timed out|abort|deadline/.test(combined)) {
    return "timeout";
  }
  return "error";
}

async function requestCarousel(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  slidesCount: number,
  timeoutMs: number
) {
  return await getClient().responses.create(
    {
      model,
      max_output_tokens: CAROUSEL_MAX_OUTPUT_TOKENS,
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: userPrompt }] }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "carousel_v3",
          strict: true,
          schema: buildResponseSchema(slidesCount)
        }
      }
    },
    { timeout: timeoutMs }
  );
}

function parseResponse(response: { output_text?: string | null }) {
  const raw = typeof response.output_text === "string" ? response.output_text.trim() : "";
  if (!raw) {
    throw new Error("OpenAI returned empty output.");
  }
  const parsed = JSON.parse(raw) as { slides?: unknown; caption?: unknown };
  if (!parsed || typeof parsed !== "object") {
    throw new Error("OpenAI returned invalid JSON payload.");
  }
  return parsed;
}

function buildProfile(
  modeDecision: ModeDecision,
  plan: CarouselSlideRole[],
  patched: number,
  fallbackUsed: boolean
): CarouselGenerationProfile {
  return {
    modeDetected: modeDecision.modeDetected,
    modeEffective: modeDecision.modeEffective,
    modeSource: modeDecision.modeSource,
    modeConfidence: modeDecision.confidence,
    flowTemplate: `${modeDecision.modeEffective}-${plan.length}`,
    ctaType: modeDecision.modeEffective === "sales" ? "direct" : "soft",
    firstSlideRepairs: 0,
    toneViolations: 0,
    modeValidationPassed: patched === 0,
    modeValidationErrors: patched > 0 ? [`patched_fields:${patched}`] : [],
    modeReasonCodes: modeDecision.reasonCodes,
    fallbackUsed
  };
}

// ---------------------------------------------------------------------------
// Публичное API.
// ---------------------------------------------------------------------------

export async function generateCarouselFromTopic(
  topic: string,
  requestedSlidesCount?: number,
  options?: GenerationOptions
): Promise<CarouselGenerationResult> {
  const cleanedTopic = clean(topic, 800) || "Новая карусель";
  const modeDecision = detectMode(cleanedTopic, options?.contentMode);
  const mode = modeDecision.modeEffective;
  const count = resolveSlidesCount(mode, requestedSlidesCount);
  const plan = resolveRolePlan(mode, count);
  const systemPrompt = buildSystemPrompt(mode);
  const userPrompt = buildUserPrompt(cleanedTopic, plan, mode, options);
  const timeoutMs = resolveTimeout(options);
  const promptVariant: PromptVariant = options?.promptVariant === "A" ? "A" : "B";

  const models = resolveModelCandidates();
  let tokensUsed = 0;
  let retried = false;
  let lastError: unknown = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await requestCarousel(model, systemPrompt, userPrompt, plan.length, timeoutMs);
        tokensUsed += readTokens(response);
        const payload = parseResponse(response);
        const { slides, patched } = mapModelSlides(payload.slides, plan, cleanedTopic);

        return {
          slides,
          caption: clean(payload.caption, 2100),
          promptVariant,
          generationSource: "model",
          generationMeta: {
            model,
            tokensUsed,
            validationErrors: patched > 0 ? [`patched_fields:${patched}`] : [],
            retried
          },
          generationProfile: buildProfile(modeDecision, plan, patched, false)
        };
      } catch (error) {
        lastError = error;
        if (shouldTryNextModel(error)) {
          console.warn(`Model "${model}" unavailable for carousel generation. Trying next.`, error);
          break;
        }
        if (attempt === 1) {
          retried = true;
          console.warn(`Model "${model}" attempt 1 failed. Retrying once.`, error);
          continue;
        }
      }
    }
  }

  console.error("Carousel generation failed for all models. Using deterministic fallback.", lastError);
  return generateFallbackCarouselFromTopic(topic, requestedSlidesCount, options, lastError);
}

export function generateFallbackCarouselFromTopic(
  topic: string,
  requestedSlidesCount?: number,
  options?: GenerationOptions,
  cause?: unknown
): CarouselGenerationResult {
  const cleanedTopic = clean(topic, 800) || "Новая карусель";
  const modeDecision = detectMode(cleanedTopic, options?.contentMode);
  const mode = modeDecision.modeEffective;
  const count = resolveSlidesCount(mode, requestedSlidesCount);
  const plan = resolveRolePlan(mode, count);

  return {
    slides: buildFallbackSlides(cleanedTopic, plan),
    caption: "",
    promptVariant: options?.promptVariant === "A" ? "A" : "B",
    generationSource: "fallback",
    generationMeta: {
      model: "fallback",
      tokensUsed: 0,
      validationErrors: [
        cause instanceof Error && cause.message.trim() ? cause.message.trim() : "fallback activated"
      ],
      retried: false
    },
    generationProfile: buildProfile(modeDecision, plan, 0, true),
    fallbackReason: resolveFallbackReason(cause)
  };
}

// ---------------------------------------------------------------------------
// Подпись к публикации (для /api/caption).
// ---------------------------------------------------------------------------

type CaptionInput = {
  topic: string;
  slides: CarouselOutlineSlide[];
  niche?: string;
  audience?: string;
  tone?: string;
  goal?: string;
  contentMode?: ContentModeInput;
};

function slideDigest(slides: CarouselOutlineSlide[]) {
  return slides
    .map((slide) => {
      switch (slide.type) {
        case "hook":
        case "cta":
          return `${slide.type}: ${slide.title} — ${slide.subtitle}`;
        case "problem":
        case "amplify":
          return `${slide.type}: ${slide.title}. ${slide.bullets.join("; ")}`;
        case "consequence":
        case "solution":
          return `${slide.type}: ${slide.bullets.join("; ")}`;
        case "mistake":
        case "shift":
          return `${slide.type}: ${slide.title}. ${slide.body ?? ""}`;
        default:
          return `example: до — ${slide.before}; после — ${slide.after}`;
      }
    })
    .join("\n");
}

function buildCaptionFallback(input: CaptionInput, mode: ContentMode): CarouselPostCaption {
  const hook = input.slides.find((slide) => slide.type === "hook");
  const solution = input.slides.find((slide) => slide.type === "solution");
  const lead = hook && hook.type === "hook" ? `${hook.title}. ${hook.subtitle}` : clean(input.topic, 140);
  const bullets =
    solution && solution.type === "solution" ? solution.bullets.slice(0, 3).map((item) => `— ${item}`) : [];
  const cta =
    mode === "sales"
      ? "Напишите в директ слово «РАЗБОР» — подскажу, как применить это к вашей ситуации."
      : "Сохраните, чтобы вернуться, и примените один пункт уже сегодня.";

  return {
    text: [lead, "", ...bullets].join("\n").trim(),
    cta,
    ctaSoft: "Сохраните, чтобы вернуться к разбору.",
    ctaAggressive: cta,
    hashtags: []
  };
}

export async function generateCaptionFromCarousel(input: CaptionInput): Promise<CarouselPostCaption> {
  const mode = detectMode(clean(input.topic, 400), input.contentMode).modeEffective;
  const fallback = buildCaptionFallback(input, mode);

  if (!input.slides.length) {
    return fallback;
  }

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      text: { type: "string", maxLength: 1800 },
      cta: { type: "string", maxLength: 220 },
      cta_soft: { type: "string", maxLength: 220 },
      cta_aggressive: { type: "string", maxLength: 220 },
      hashtags: { type: "array", minItems: 3, maxItems: 8, items: { type: "string", maxLength: 40 } }
    },
    required: ["text", "cta", "cta_soft", "cta_aggressive", "hashtags"]
  };

  const systemPrompt = [
    "Ты — русскоязычный копирайтер. Пишешь подпись к публикации по готовой карусели.",
    "Живой конкретный язык, без канцелярита и клише вроде «в современном мире».",
    "Не пересказывай слайды дословно и не упоминай их номера.",
    mode === "sales"
      ? "CTA может быть прямым и конверсионным."
      : "CTA мягкий, без «пишите в директ».",
    "Отвечай строго JSON по схеме."
  ].join(" ");

  const userPrompt = [
    `Тема: «${clean(input.topic, 300)}»`,
    input.niche ? `Ниша: ${input.niche}` : "",
    input.audience ? `Аудитория: ${input.audience}` : "",
    input.goal ? `Цель: ${input.goal}` : "",
    "Содержание карусели:",
    slideDigest(input.slides)
  ]
    .filter(Boolean)
    .join("\n");

  for (const model of resolveModelCandidates()) {
    try {
      const response = await getClient().responses.create(
        {
          model,
          max_output_tokens: CAPTION_MAX_OUTPUT_TOKENS,
          input: [
            { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
            { role: "user", content: [{ type: "input_text", text: userPrompt }] }
          ],
          text: { format: { type: "json_schema", name: "caption_v3", strict: true, schema } }
        },
        { timeout: 60_000 }
      );

      const raw = typeof response.output_text === "string" ? response.output_text.trim() : "";
      if (!raw) {
        throw new Error("Empty caption output.");
      }
      const parsed = JSON.parse(raw) as {
        text?: unknown;
        cta?: unknown;
        cta_soft?: unknown;
        cta_aggressive?: unknown;
        hashtags?: unknown;
      };

      return {
        text: clean(parsed.text, 1750) || fallback.text,
        cta: clean(parsed.cta, 210) || fallback.cta,
        ctaSoft: clean(parsed.cta_soft, 210) || fallback.ctaSoft,
        ctaAggressive: clean(parsed.cta_aggressive, 210) || fallback.ctaAggressive,
        hashtags: Array.isArray(parsed.hashtags)
          ? parsed.hashtags.map((tag) => clean(tag, 40)).filter(Boolean).slice(0, 8)
          : []
      };
    } catch (error) {
      console.warn("Caption generation attempt failed. Trying next model.", error);
    }
  }

  return fallback;
}
