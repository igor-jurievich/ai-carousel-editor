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

const MODEL_NAME = process.env.OPENAI_GENERATION_MODEL?.trim() || "gpt-5.3";

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
    const response = await openai.responses.create({
      model: MODEL_NAME,
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

    return {
      slides: normalizedSlides
    };
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
    "Bullets must be short: 1 sentence each, 2-4 bullets, no long clauses.",
    "Avoid long clauses and nested lists.",
    "No markdown, no emojis, no extra commentary."
  ]
    .filter(Boolean)
    .join("\n");
}

function buildResponseSchema(slidesCount: number) {
  const hookSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      type: { type: "string", const: "hook" },
      title: { type: "string", maxLength: 96 },
      subtitle: { type: "string", maxLength: 140 }
    },
    required: ["type", "title", "subtitle"]
  };

  const problemSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      type: { type: "string", const: "problem" },
      title: { type: "string", maxLength: 92 },
      bullets: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: { type: "string", maxLength: 92 }
      }
    },
    required: ["type", "title", "bullets"]
  };

  const amplifySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      type: { type: "string", const: "amplify" },
      title: { type: "string", maxLength: 92 },
      bullets: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: { type: "string", maxLength: 92 }
      }
    },
    required: ["type", "title", "bullets"]
  };

  const mistakeSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      type: { type: "string", const: "mistake" },
      title: { type: "string", maxLength: 104 }
    },
    required: ["type", "title"]
  };

  const consequenceSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      type: { type: "string", const: "consequence" },
      bullets: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: { type: "string", maxLength: 92 }
      }
    },
    required: ["type", "bullets"]
  };

  const shiftSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      type: { type: "string", const: "shift" },
      title: { type: "string", maxLength: 104 }
    },
    required: ["type", "title"]
  };

  const solutionSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      type: { type: "string", const: "solution" },
      bullets: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: { type: "string", maxLength: 92 }
      }
    },
    required: ["type", "bullets"]
  };

  const exampleSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      type: { type: "string", const: "example" },
      before: { type: "string", maxLength: 132 },
      after: { type: "string", maxLength: 132 }
    },
    required: ["type", "before", "after"]
  };

  const ctaSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      type: { type: "string", const: "cta" },
      title: { type: "string", maxLength: 96 },
      subtitle: { type: "string", maxLength: 140 }
    },
    required: ["type", "title", "subtitle"]
  };

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      slides: {
        type: "array",
        minItems: slidesCount,
        maxItems: slidesCount,
        items: {
          oneOf: [
            hookSchema,
            problemSchema,
            amplifySchema,
            mistakeSchema,
            consequenceSchema,
            shiftSchema,
            solutionSchema,
            exampleSchema,
            ctaSchema
          ]
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
    (preferred as { type?: unknown }).type === expectedType &&
    !usedIndexes.has(preferredIndex)
  ) {
    return preferredIndex;
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

  return usedIndexes.has(preferredIndex) ? -1 : preferredIndex < source.length ? preferredIndex : -1;
}

function normalizeSlideByType(
  expectedType: CarouselSlideRole,
  rawSlide: unknown,
  topic: string,
  index: number
): CarouselOutlineSlide {
  const safe = toRecord(rawSlide);

  if (expectedType === "hook") {
    return {
      type: "hook",
      title: normalizeText(safe.title, 92) || `Одна ошибка в теме «${topic}» съедает заявки`,
      subtitle:
        normalizeText(safe.subtitle, 138) ||
        "Сейчас коротко покажу, где именно теряются клиенты и как это исправить."
    };
  }

  if (expectedType === "problem") {
    return {
      type: "problem",
      title: normalizeText(safe.title, 90) || "Где ломается поток клиентов",
      bullets: normalizeBullets(safe.bullets, [
        "Пишете много, но человек не видит прямую выгоду.",
        "Сообщение выглядит как «ещё одно объявление».",
        "Клиент сравнивает только цену, а не результат."
      ])
    };
  }

  if (expectedType === "amplify") {
    return {
      type: "amplify",
      title: normalizeText(safe.title, 90) || "Что это стоит на практике",
      bullets: normalizeBullets(safe.bullets, [
        "Уходят горячие лиды, пока вы «дожимаете» холодных.",
        "Бюджет на продвижение растет, а конверсия почти стоит.",
        "Каждая неделя без корректной подачи усиливает просадку."
      ])
    };
  }

  if (expectedType === "mistake") {
    return {
      type: "mistake",
      title:
        normalizeText(safe.title, 102) ||
        "Главная ошибка: продавать «услугу», а не конкретный финансовый результат"
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
    return {
      type: "shift",
      title:
        normalizeText(safe.title, 102) ||
        "Сдвиг: сначала фиксируете выгоду клиента, потом обсуждаете цену"
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
      before: normalizeText(safe.before, 128) || "До: «Мы работаем лучше всех»",
      after:
        normalizeText(safe.after, 128) ||
        "После: «За 30 дней закрыли 12 сделок на 14% выше средней цены района»"
    };
  }

  return {
    type: "cta",
    title: normalizeText(safe.title, 94) || "Нужен такой же разбор под ваш кейс?",
    subtitle:
      normalizeText(safe.subtitle, 138) ||
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

  const cleaned = value
    .map((item) => normalizeText(item, 90))
    .filter(Boolean)
    .slice(0, 4);

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

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}
