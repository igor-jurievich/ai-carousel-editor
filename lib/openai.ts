import OpenAI from "openai";
import {
  clampSlidesCount,
  DEFAULT_SLIDES_COUNT,
  MAX_SLIDES_COUNT,
  MIN_SLIDES_COUNT
} from "@/lib/slides";
import type {
  CarouselImageIntent,
  CarouselLayoutType,
  CarouselOutlineSlide,
  CarouselSlideRole,
  CarouselTemplateId
} from "@/types/editor";

export { clampSlidesCount };

const ROLE_VALUES = [
  "cover",
  "problem",
  "myth",
  "mistake",
  "tip",
  "steps",
  "checklist",
  "case",
  "comparison",
  "summary",
  "cta"
] as const satisfies readonly CarouselSlideRole[];

const LAYOUT_VALUES = [
  "hero",
  "statement",
  "list",
  "split",
  "card",
  "dark-slide",
  "cover-hero",
  "title-body",
  "bullets",
  "steps",
  "checklist",
  "case-split",
  "comparison",
  "summary",
  "cta",
  "image-top"
] as const satisfies readonly CarouselLayoutType[];

const IMAGE_INTENT_VALUES = [
  "none",
  "subject-photo",
  "people-photo",
  "object-photo",
  "conceptual-photo"
] as const satisfies readonly CarouselImageIntent[];

const TEMPLATE_ID_VALUES = [
  "netflix",
  "matrix",
  "premium",
  "midnight",
  "noir",
  "founder-dark",
  "notes",
  "technology",
  "charge",
  "minimal",
  "blank",
  "editorial",
  "business-light",
  "jungle",
  "cyberpunk",
  "mandarin",
  "aurora",
  "coral",
  "atlas"
] as const satisfies readonly CarouselTemplateId[];

type TopicCategory =
  | "marketing-sales"
  | "real-estate"
  | "health-safety"
  | "personal-brand"
  | "education-visual"
  | "how-to"
  | "business"
  | "expert-education";

type TemplateFamilyId = "dark-premium" | "light-clean" | "accent-business";

type ParsedBrief = {
  coreTopic: string;
  sourceIdeas: string[];
  structureHints: string[];
  qualityHints: string[];
};

type TopicLens = {
  category: TopicCategory;
  audience: string;
  goal: string;
  tone: string;
  imageScore: number;
};

type CarouselPlanSlide = {
  role: CarouselSlideRole;
  coreIdea: string;
  layoutType: CarouselLayoutType;
  imageIntent: CarouselImageIntent;
  imageQueryDraft: string;
  templateId: CarouselTemplateId;
};

type CarouselPlan = {
  topic: string;
  audience: string;
  goal: string;
  tone: string;
  category: TopicCategory;
  slides: CarouselPlanSlide[];
};

type SlideDraft = {
  title: string;
  text: string;
};

type RepairDraft = {
  slideIndex: number;
  title: string;
  text: string;
};

type QualityReport = {
  needsRepair: boolean;
  score: number;
  problematicIndexes: number[];
};

type LayoutLimit = {
  titleMin: number;
  titleMax: number;
  bodyMin: number;
  bodyMax: number;
  preferredLinesMin: number;
  preferredLinesMax: number;
};

const TEMPLATE_FAMILY_POOLS: Record<
  TemplateFamilyId,
  Record<CarouselSlideRole, CarouselTemplateId[]>
> = {
  "dark-premium": {
    cover: ["netflix", "premium", "noir"],
    problem: ["noir", "founder-dark", "matrix"],
    myth: ["matrix", "midnight", "founder-dark"],
    mistake: ["founder-dark", "noir", "matrix"],
    tip: ["midnight", "founder-dark", "matrix"],
    steps: ["matrix", "founder-dark", "midnight"],
    checklist: ["midnight", "matrix", "founder-dark"],
    case: ["premium", "founder-dark", "netflix"],
    comparison: ["matrix", "noir", "founder-dark"],
    summary: ["midnight", "premium", "founder-dark"],
    cta: ["netflix", "founder-dark", "premium"]
  },
  "light-clean": {
    cover: ["minimal", "editorial", "technology"],
    problem: ["technology", "minimal", "editorial"],
    myth: ["notes", "technology", "minimal"],
    mistake: ["notes", "minimal", "technology"],
    tip: ["minimal", "technology", "business-light"],
    steps: ["technology", "business-light", "minimal"],
    checklist: ["minimal", "notes", "technology"],
    case: ["editorial", "business-light", "technology"],
    comparison: ["technology", "minimal", "business-light"],
    summary: ["notes", "minimal", "editorial"],
    cta: ["business-light", "minimal", "technology"]
  },
  "accent-business": {
    cover: ["atlas", "aurora", "mandarin"],
    problem: ["atlas", "aurora", "coral"],
    myth: ["aurora", "coral", "mandarin"],
    mistake: ["coral", "mandarin", "atlas"],
    tip: ["atlas", "mandarin", "coral"],
    steps: ["atlas", "mandarin", "aurora"],
    checklist: ["mandarin", "atlas", "coral"],
    case: ["atlas", "coral", "aurora"],
    comparison: ["atlas", "aurora", "mandarin"],
    summary: ["aurora", "mandarin", "atlas"],
    cta: ["atlas", "mandarin", "coral"]
  }
};

const LAYOUT_LIMITS: Record<CarouselLayoutType, LayoutLimit> = {
  hero: {
    titleMin: 14,
    titleMax: 72,
    bodyMin: 18,
    bodyMax: 120,
    preferredLinesMin: 1,
    preferredLinesMax: 2
  },
  statement: {
    titleMin: 14,
    titleMax: 64,
    bodyMin: 18,
    bodyMax: 110,
    preferredLinesMin: 1,
    preferredLinesMax: 2
  },
  list: {
    titleMin: 14,
    titleMax: 64,
    bodyMin: 36,
    bodyMax: 190,
    preferredLinesMin: 3,
    preferredLinesMax: 5
  },
  split: {
    titleMin: 14,
    titleMax: 66,
    bodyMin: 32,
    bodyMax: 170,
    preferredLinesMin: 2,
    preferredLinesMax: 3
  },
  card: {
    titleMin: 14,
    titleMax: 68,
    bodyMin: 34,
    bodyMax: 170,
    preferredLinesMin: 2,
    preferredLinesMax: 3
  },
  "dark-slide": {
    titleMin: 14,
    titleMax: 66,
    bodyMin: 22,
    bodyMax: 120,
    preferredLinesMin: 1,
    preferredLinesMax: 2
  },
  "cover-hero": {
    titleMin: 14,
    titleMax: 72,
    bodyMin: 18,
    bodyMax: 120,
    preferredLinesMin: 1,
    preferredLinesMax: 2
  },
  "title-body": {
    titleMin: 14,
    titleMax: 68,
    bodyMin: 34,
    bodyMax: 170,
    preferredLinesMin: 2,
    preferredLinesMax: 3
  },
  bullets: {
    titleMin: 14,
    titleMax: 64,
    bodyMin: 36,
    bodyMax: 190,
    preferredLinesMin: 3,
    preferredLinesMax: 5
  },
  steps: {
    titleMin: 14,
    titleMax: 64,
    bodyMin: 36,
    bodyMax: 190,
    preferredLinesMin: 3,
    preferredLinesMax: 5
  },
  checklist: {
    titleMin: 14,
    titleMax: 64,
    bodyMin: 36,
    bodyMax: 190,
    preferredLinesMin: 3,
    preferredLinesMax: 5
  },
  "case-split": {
    titleMin: 14,
    titleMax: 66,
    bodyMin: 32,
    bodyMax: 170,
    preferredLinesMin: 2,
    preferredLinesMax: 3
  },
  comparison: {
    titleMin: 14,
    titleMax: 66,
    bodyMin: 32,
    bodyMax: 170,
    preferredLinesMin: 2,
    preferredLinesMax: 3
  },
  summary: {
    titleMin: 14,
    titleMax: 66,
    bodyMin: 28,
    bodyMax: 150,
    preferredLinesMin: 2,
    preferredLinesMax: 3
  },
  cta: {
    titleMin: 14,
    titleMax: 62,
    bodyMin: 22,
    bodyMax: 120,
    preferredLinesMin: 1,
    preferredLinesMax: 2
  },
  "image-top": {
    titleMin: 14,
    titleMax: 68,
    bodyMin: 30,
    bodyMax: 150,
    preferredLinesMin: 2,
    preferredLinesMax: 3
  }
};

const LAYOUT_WORD_LIMITS: Record<
  CarouselLayoutType,
  {
    titleWords: number;
    bodyWords: number;
    lineWords: number;
  }
> = {
  hero: { titleWords: 8, bodyWords: 12, lineWords: 6 },
  statement: { titleWords: 8, bodyWords: 11, lineWords: 6 },
  list: { titleWords: 8, bodyWords: 24, lineWords: 6 },
  split: { titleWords: 8, bodyWords: 14, lineWords: 7 },
  card: { titleWords: 9, bodyWords: 16, lineWords: 7 },
  "dark-slide": { titleWords: 8, bodyWords: 12, lineWords: 6 },
  "cover-hero": { titleWords: 8, bodyWords: 12, lineWords: 6 },
  "title-body": { titleWords: 9, bodyWords: 16, lineWords: 7 },
  bullets: { titleWords: 8, bodyWords: 24, lineWords: 6 },
  steps: { titleWords: 8, bodyWords: 24, lineWords: 6 },
  checklist: { titleWords: 8, bodyWords: 24, lineWords: 6 },
  "case-split": { titleWords: 8, bodyWords: 14, lineWords: 7 },
  comparison: { titleWords: 8, bodyWords: 14, lineWords: 7 },
  summary: { titleWords: 8, bodyWords: 13, lineWords: 6 },
  cta: { titleWords: 8, bodyWords: 12, lineWords: 6 },
  "image-top": { titleWords: 8, bodyWords: 14, lineWords: 6 }
};

const STRUCTURED_LAYOUTS = new Set<CarouselLayoutType>([
  "list",
  "bullets",
  "steps",
  "checklist"
]);

const META_PATTERNS = [
  /сделай\s+карусель/i,
  /используй\s+такую\s+логику/i,
  /^важно[:]?/i,
  /пиши\s+по-русски/i,
  /хочу\s+не\s+общие\s+советы/i,
  /заголовки\s+должны/i,
  /текст\s+на\s+слайдах\s+должен/i,
  /можно\s+использовать\s+списки/i,
  /карусель\s+должна\s+ощущаться/i,
  /техническ(ое|ий)\s+задани/i
];

const BRIEF_META_STARTERS = [/^сделай\b/i, /^хочу\b/i, /^используй\b/i, /^важно\b/i, /^пиши\b/i, /^логика\b/i, /^промпт\b/i];

const STRUCTURE_HINT_STARTERS = [/^жестк/i, /^объясн/i, /^покаж/i, /^дай\b/i, /^добав/i, /^заверш/i];

const QUALITY_HINT_STARTERS = [/^заголовки\b/i, /^текст на слайдах\b/i, /^можно использовать\b/i, /^карусель должна\b/i];

const DIRECTIVE_HINT_STARTERS = [
  ...BRIEF_META_STARTERS,
  ...STRUCTURE_HINT_STARTERS,
  ...QUALITY_HINT_STARTERS,
  /^стиль\b/i,
  /^формат\b/i,
  /^нужн[ао]\b/i,
  /^ожидаем(ый|ая)\b/i
];

const SEARCH_STOP_WORDS = new Set([
  "для",
  "как",
  "что",
  "это",
  "или",
  "при",
  "без",
  "под",
  "про",
  "из",
  "на",
  "по",
  "над",
  "в",
  "и",
  "к",
  "the",
  "and",
  "with",
  "from",
  "your",
  "this"
]);

const SIMILARITY_STOP_WORDS = new Set([
  "это",
  "этот",
  "эта",
  "эти",
  "что",
  "как",
  "для",
  "или",
  "чтобы",
  "когда",
  "почему",
  "который",
  "которое",
  "которые",
  "можно",
  "нужно",
  "очень",
  "слайд",
  "тема",
  "совет",
  "шаг"
]);

const KEYWORD_TRANSLATIONS: Record<string, string> = {
  грибы: "mushrooms",
  гриб: "mushroom",
  ядовитые: "poisonous",
  съедобные: "edible",
  конверсия: "conversion",
  продаж: "sales",
  продажи: "sales",
  продажа: "sales",
  клиент: "client",
  клиенты: "clients",
  недвижимость: "real estate",
  элитная: "luxury",
  элитной: "luxury",
  дорогая: "luxury",
  дорогой: "luxury",
  дорогую: "luxury",
  квартира: "apartment",
  квартиры: "apartments",
  дом: "house",
  дома: "houses",
  пенсионеры: "seniors",
  пенсионеров: "seniors",
  ипотека: "mortgage",
  безопасность: "safety",
  медицина: "medical",
  здоровье: "health",
  маркетинг: "marketing",
  бренд: "brand",
  личный: "personal",
  бизнес: "business",
  обучение: "education",
  инструкция: "guide",
  чеклист: "checklist",
  кейс: "case study",
  кейсы: "case study",
  экспертный: "expert",
  экспертная: "expert",
  фото: "photo",
  изображения: "image",
  изображение: "image"
};

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
  const brief = parseTopicBrief(topic);
  const coreTopic = brief.coreTopic || topic;
  const targetCount = clampSlidesCount(
    requestedSlidesCount ?? inferTargetSlides(topic) ?? DEFAULT_SLIDES_COUNT
  );
  const lens = inferTopicLens(coreTopic, brief.sourceIdeas);
  const deterministicPlan = buildDeterministicPlan(coreTopic, targetCount, lens, brief);

  let openai: OpenAI | null = null;
  try {
    openai = getOpenAIClient();
  } catch {
    return buildDeterministicFallbackSlides(coreTopic, deterministicPlan, brief, targetCount);
  }

  const modelCandidates = buildModelCandidates();
  const plan = await generatePlanWithFallback(
    openai,
    modelCandidates,
    topic,
    brief,
    lens,
    deterministicPlan,
    targetCount
  );

  const draftedSlides = await generateSlidesFromPlanWithFallback(
    openai,
    modelCandidates,
    topic,
    brief,
    plan,
    targetCount
  );

  let slides = normalizeSlides(coreTopic, draftedSlides, plan, targetCount, brief);
  let quality = assessSlidesQuality(coreTopic, slides, plan);

  for (let pass = 0; pass < 2 && quality.needsRepair; pass += 1) {
    const repairIndexes = quality.problematicIndexes.slice(0, Math.max(1, Math.min(4, targetCount)));

    let repaired = await repairSlidesWithFallback(
      openai,
      modelCandidates,
      topic,
      brief,
      plan,
      slides,
      repairIndexes,
      targetCount
    );

    if (!repaired) {
      repaired = buildDeterministicRepairs(coreTopic, plan, brief, repairIndexes, targetCount);
    }

    slides = applyRepairs(slides, repaired, plan, coreTopic, brief, targetCount);
    quality = assessSlidesQuality(coreTopic, slides, plan);
  }

  if (quality.needsRepair && quality.problematicIndexes.length) {
    const deterministicRepairs = buildDeterministicRepairs(
      coreTopic,
      plan,
      brief,
      quality.problematicIndexes,
      targetCount
    );
    slides = applyRepairs(slides, deterministicRepairs, plan, coreTopic, brief, targetCount);
  }

  return slides;
}

async function generatePlanWithFallback(
  openai: OpenAI,
  models: string[],
  topic: string,
  brief: ParsedBrief,
  lens: TopicLens,
  deterministicPlan: CarouselPlan,
  targetCount: number
) {
  let lastError: unknown = null;

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];

    try {
      const raw = await requestCarouselPlan(openai, model, topic, brief, lens, deterministicPlan, targetCount);
      return normalizePlan(raw, deterministicPlan, targetCount, lens);
    } catch (error) {
      lastError = error;
      const isLast = index === models.length - 1;
      if (isLast || !isModelAvailabilityError(error)) {
        break;
      }
    }
  }

  if (lastError) {
    return deterministicPlan;
  }

  return deterministicPlan;
}

async function generateSlidesFromPlanWithFallback(
  openai: OpenAI,
  models: string[],
  topic: string,
  brief: ParsedBrief,
  plan: CarouselPlan,
  targetCount: number
): Promise<SlideDraft[]> {
  let lastError: unknown = null;

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];

    try {
      return await requestCarouselSlides(openai, model, topic, brief, plan, targetCount);
    } catch (error) {
      lastError = error;
      const isLast = index === models.length - 1;
      if (isLast || !isModelAvailabilityError(error)) {
        break;
      }
    }
  }

  if (lastError) {
    return buildDraftSlidesFromPlan(plan, brief, targetCount);
  }

  return buildDraftSlidesFromPlan(plan, brief, targetCount);
}

async function repairSlidesWithFallback(
  openai: OpenAI,
  models: string[],
  topic: string,
  brief: ParsedBrief,
  plan: CarouselPlan,
  slides: CarouselOutlineSlide[],
  repairIndexes: number[],
  targetCount: number
): Promise<RepairDraft[] | null> {
  if (!repairIndexes.length) {
    return null;
  }

  let lastError: unknown = null;

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];

    try {
      return await requestCarouselSlideRepairs(
        openai,
        model,
        topic,
        brief,
        plan,
        slides,
        repairIndexes,
        targetCount
      );
    } catch (error) {
      lastError = error;
      const isLast = index === models.length - 1;
      if (isLast || !isModelAvailabilityError(error)) {
        break;
      }
    }
  }

  if (lastError) {
    return null;
  }

  return null;
}

function buildModelCandidates() {
  const configuredModel = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
  return [configuredModel, "gpt-4.1-mini"].filter(
    (value, index, list): value is string => Boolean(value) && list.indexOf(value) === index
  );
}

async function requestCarouselPlan(
  openai: OpenAI,
  model: string,
  topic: string,
  brief: ParsedBrief,
  lens: TopicLens,
  deterministicPlan: CarouselPlan,
  targetCount: number
) {
  const response = await openai.responses.create({
    model,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              "You design Russian social carousel plans for experts and creators.",
              "Return only JSON that matches schema.",
              "First create narrative flow and unique slide roles, then details.",
              "No duplicate core ideas between slides.",
              "First slide must be cover. Last slide must be cta.",
              "Carousel flow must be: hook -> tension/problem -> insight -> practice -> close/cta.",
              "Assign each slide one role, one core idea, one layout type, image intent, optional image query.",
              "Use visually varied layouts: hero, statement, list, split, card, dark-slide, cta, image-top when image is needed.",
              "imageQueryDraft must be concise and suitable for stock photo search (English keywords preferred).",
              "If image is not needed, set imageIntent='none' and imageQueryDraft=''.",
              `Use exactly ${targetCount} slides.`
            ].join(" ")
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildPlanPrompt(topic, brief, lens, deterministicPlan, targetCount)
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "carousel_plan",
        schema: buildPlanSchema(targetCount),
        strict: true
      }
    }
  });

  const raw = response.output_text;
  if (!raw) {
    throw new Error("OpenAI returned an empty carousel plan.");
  }

  return JSON.parse(raw) as CarouselPlan;
}

async function requestCarouselSlides(
  openai: OpenAI,
  model: string,
  topic: string,
  brief: ParsedBrief,
  plan: CarouselPlan,
  targetCount: number
) {
  const response = await openai.responses.create({
    model,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              "You write final Russian carousel slide copy for social media.",
              "Return only JSON that matches schema.",
              "No meta phrases, no brief echo, no filler.",
              "Write practical, human, concise copy with clear hierarchy.",
              "Each slide should deliver a unique idea and advance the narrative.",
              "One slide = one thought. No mixed ideas on one slide.",
              "Keep copy short: up to 2-3 lines per slide, 8-12 words for regular lines.",
              "Keep text within provided layout limits. Do not overflow.",
              "Do not repeat same advice in different words.",
              `Use exactly ${targetCount} slides in the same order as the plan.`
            ].join(" ")
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildContentPrompt(topic, brief, plan)
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "carousel_content",
        schema: buildSlidesSchema(targetCount),
        strict: true
      }
    }
  });

  const raw = response.output_text;
  if (!raw) {
    throw new Error("OpenAI returned an empty carousel payload.");
  }

  const parsed = JSON.parse(raw) as { slides: SlideDraft[] };
  if (!Array.isArray(parsed.slides) || !parsed.slides.length) {
    throw new Error("OpenAI returned invalid slides payload.");
  }

  return parsed.slides;
}

async function requestCarouselSlideRepairs(
  openai: OpenAI,
  model: string,
  topic: string,
  brief: ParsedBrief,
  plan: CarouselPlan,
  slides: CarouselOutlineSlide[],
  repairIndexes: number[],
  targetCount: number
) {
  const response = await openai.responses.create({
    model,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              "You repair only weak or duplicate slides in a Russian social carousel.",
              "Return only JSON that matches schema.",
              "Rewrite only requested indexes.",
              "Preserve each slide role and core idea, but make copy unique and useful.",
              "No duplication with existing strong slides.",
              "Do not output technical commentary."
            ].join(" ")
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildRepairPrompt(topic, brief, plan, slides, repairIndexes)
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "carousel_repairs",
        schema: buildRepairsSchema(targetCount, repairIndexes.length),
        strict: true
      }
    }
  });

  const raw = response.output_text;
  if (!raw) {
    throw new Error("OpenAI returned an empty repair payload.");
  }

  const parsed = JSON.parse(raw) as { slides: RepairDraft[] };
  if (!Array.isArray(parsed.slides)) {
    throw new Error("OpenAI returned invalid repair payload.");
  }

  return parsed.slides.filter((item) => repairIndexes.includes(item.slideIndex));
}

function buildPlanSchema(targetCount: number) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      topic: { type: "string", minLength: 3, maxLength: 180 },
      audience: { type: "string", minLength: 3, maxLength: 180 },
      goal: { type: "string", minLength: 3, maxLength: 180 },
      tone: { type: "string", minLength: 3, maxLength: 120 },
      category: {
        type: "string",
        enum: [
          "marketing-sales",
          "real-estate",
          "health-safety",
          "personal-brand",
          "education-visual",
          "how-to",
          "business",
          "expert-education"
        ]
      },
      slides: {
        type: "array",
        minItems: targetCount,
        maxItems: targetCount,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            role: { type: "string", enum: [...ROLE_VALUES] },
            coreIdea: { type: "string", minLength: 8, maxLength: 220 },
            layoutType: { type: "string", enum: [...LAYOUT_VALUES] },
            imageIntent: { type: "string", enum: [...IMAGE_INTENT_VALUES] },
            imageQueryDraft: { type: "string", maxLength: 160 },
            templateId: { type: "string", enum: [...TEMPLATE_ID_VALUES] }
          },
          required: ["role", "coreIdea", "layoutType", "imageIntent", "imageQueryDraft", "templateId"]
        }
      }
    },
    required: ["topic", "audience", "goal", "tone", "category", "slides"]
  } as const;
}

function buildSlidesSchema(targetCount: number) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      slides: {
        type: "array",
        minItems: targetCount,
        maxItems: targetCount,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string", minLength: 4, maxLength: 120 },
            text: { type: "string", minLength: 14, maxLength: 260 }
          },
          required: ["title", "text"]
        }
      }
    },
    required: ["slides"]
  } as const;
}

function buildRepairsSchema(targetCount: number, maxItems: number) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      slides: {
        type: "array",
        minItems: 1,
        maxItems,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            slideIndex: {
              type: "integer",
              minimum: 0,
              maximum: Math.max(0, targetCount - 1)
            },
            title: { type: "string", minLength: 4, maxLength: 120 },
            text: { type: "string", minLength: 14, maxLength: 260 }
          },
          required: ["slideIndex", "title", "text"]
        }
      }
    },
    required: ["slides"]
  } as const;
}

function buildPlanPrompt(
  topic: string,
  brief: ParsedBrief,
  lens: TopicLens,
  deterministicPlan: CarouselPlan,
  targetCount: number
) {
  const sourceBlock = brief.sourceIdeas.slice(0, 16).map((line) => `- ${line}`).join("\n");
  const structureBlock = brief.structureHints.length
    ? brief.structureHints.map((line, index) => `${index + 1}. ${line}`).join("\n")
    : "- Выстрой структуру самостоятельно";

  return [
    `Тема: ${brief.coreTopic || topic}`,
    `Количество слайдов: ${targetCount}`,
    `Аудитория: ${lens.audience}`,
    `Цель: ${lens.goal}`,
    `Тон: ${lens.tone}`,
    `Категория: ${lens.category}`,
    `Рекомендуемая роль-сетка: ${deterministicPlan.slides.map((slide) => slide.role).join(" -> ")}`,
    "",
    "Смысловые вводные:",
    sourceBlock || "- Раскрой тему практично и конкретно.",
    "",
    "Дополнительные структурные подсказки:",
    structureBlock,
    "",
    "Требования:",
    "- Не дублируй coreIdea между слайдами.",
    "- Cover должен быть хуком через боль/конфликт/триггер, без слов «обзор», «сравнение», «гайд».",
    "- CTA должен завершать карусель и давать следующее действие.",
    "- Держи композиционный ритм: hero/statement/list/split/card/dark-slide/cta.",
    "- Внутри серии не ставь один и тот же layout подряд больше 2 раз.",
    "- templateId держи в одном визуальном семействе внутри всей карусели.",
    "- imageIntent = none, если фото не усиливает смысл.",
    "- imageQueryDraft делай коротким поисковым запросом (лучше на английском)."
  ].join("\n");
}

function buildContentPrompt(topic: string, brief: ParsedBrief, plan: CarouselPlan) {
  const layoutLimitsBlock = Object.entries(LAYOUT_LIMITS)
    .map(
      ([layout, limits]) =>
        `${layout}: title ${limits.titleMin}-${limits.titleMax} chars, body ${limits.bodyMin}-${limits.bodyMax} chars`
    )
    .join("\n");

  return [
    `Тема карусели: ${brief.coreTopic || topic}`,
    `Аудитория: ${plan.audience}`,
    `Цель: ${plan.goal}`,
    `Тон: ${plan.tone}`,
    "",
    "План слайдов (строго в этом порядке):",
    JSON.stringify(plan.slides, null, 2),
    "",
    "Лимиты по layout:",
    layoutLimitsBlock,
    "",
    "Правила:",
    "- Пиши живым русским языком, без воды и канцелярита.",
    "- Не повторяй мысли между слайдами.",
    "- Заголовок короткий и сильный.",
    "- 1 слайд = 1 мысль. Не склеивай несколько идей на одном слайде.",
    "- Для обычных layout делай 2-3 короткие строки (8-12 слов).",
    "- Для layout list/bullets/checklist/steps делай 3-5 пунктов по одной короткой строке.",
    "- На каждом 2-3 слайде добавляй один акцентный формулировочный крючок.",
    "- Не включай служебные слова типа 'слайд 1', 'логика', 'ТЗ'."
  ].join("\n");
}

function buildRepairPrompt(
  topic: string,
  brief: ParsedBrief,
  plan: CarouselPlan,
  slides: CarouselOutlineSlide[],
  repairIndexes: number[]
) {
  const existingSlides = slides.map((slide, index) => ({
    index,
    role: plan.slides[index]?.role ?? "tip",
    coreIdea: plan.slides[index]?.coreIdea ?? "",
    layoutType: plan.slides[index]?.layoutType ?? "title-body",
    title: slide.title,
    text: slide.text
  }));

  const targetBrief = repairIndexes
    .map((index) => {
      const planSlide = plan.slides[index];
      if (!planSlide) {
        return `- index ${index}: восстановить содержательный слайд без повторов`;
      }
      const limits = LAYOUT_LIMITS[normalizeLayoutType(planSlide.layoutType)];
      return [
        `- index ${index}`,
        `  role: ${planSlide.role}`,
        `  coreIdea: ${planSlide.coreIdea}`,
        `  layout: ${planSlide.layoutType}`,
        `  limits: title <= ${limits.titleMax}, body <= ${limits.bodyMax}`
      ].join("\n");
    })
    .join("\n");

  return [
    `Тема: ${brief.coreTopic || topic}`,
    "",
    "Текущий каркас карусели:",
    JSON.stringify(existingSlides, null, 2),
    "",
    `Нужно переписать только индексы: ${repairIndexes.join(", ")}`,
    "",
    "Требования к переписанным слайдам:",
    targetBrief,
    "",
    "Важно:",
    "- Не повторяй мысли уже сильных слайдов.",
    "- Сохрани роль и coreIdea каждого ремонтируемого слайда.",
    "- Дай полезную конкретику, без мета-фраз и шаблонной воды."
  ].join("\n");
}

function normalizePlan(
  rawPlan: CarouselPlan,
  fallbackPlan: CarouselPlan,
  targetCount: number,
  lens: TopicLens
): CarouselPlan {
  const rawSlides = Array.isArray(rawPlan?.slides) ? rawPlan.slides : [];
  const normalizedSlides: CarouselPlanSlide[] = [];

  for (let index = 0; index < targetCount; index += 1) {
    const rawSlide = rawSlides[index] as Partial<CarouselPlanSlide> | undefined;
    const fallback = fallbackPlan.slides[index];
    const role = isCarouselRole(rawSlide?.role) ? rawSlide.role : fallback.role;
    const layoutType = normalizeLayoutType(
      isCarouselLayout(rawSlide?.layoutType)
        ? rawSlide.layoutType
        : fallback.layoutType
    );
    const imageIntent = isImageIntent(rawSlide?.imageIntent) ? rawSlide.imageIntent : fallback.imageIntent;
    const templateId = isTemplateId(rawSlide?.templateId) ? rawSlide.templateId : fallback.templateId;
    const coreIdea = clean(String(rawSlide?.coreIdea ?? fallback.coreIdea)).slice(0, 220) || fallback.coreIdea;
    const imageQueryDraft = normalizeImageQuery(String(rawSlide?.imageQueryDraft ?? fallback.imageQueryDraft));

    normalizedSlides.push({
      role,
      coreIdea,
      layoutType,
      imageIntent,
      imageQueryDraft,
      templateId
    });
  }

  if (normalizedSlides[0]) {
    normalizedSlides[0].role = "cover";
    normalizedSlides[0].layoutType = normalizedSlides[0].imageIntent !== "none" ? "image-top" : "hero";
  }

  const last = normalizedSlides[normalizedSlides.length - 1];
  if (last) {
    last.role = "cta";
    last.layoutType = "cta";
    last.imageIntent = "none";
    last.imageQueryDraft = "";
  }

  dedupeCoreIdeas(normalizedSlides, fallbackPlan.slides);
  enforceLayoutRhythm(normalizedSlides);

  const maxImages = resolveImageBudget(lens, targetCount);
  limitImageUsage(normalizedSlides, maxImages, isTopicCategory(rawPlan.category) ? rawPlan.category : lens.category);
  const planTopic =
    clean(rawPlan.topic || fallbackPlan.topic || "").slice(0, 180) ||
    clean(fallbackPlan.topic || "").slice(0, 180);
  const family = chooseTemplateFamily(lens, planTopic || fallbackPlan.topic || "");
  enforceTemplateFamily(normalizedSlides, lens, planTopic || fallbackPlan.topic || "", family);

  return {
    topic: planTopic,
    audience: clean(rawPlan.audience || fallbackPlan.audience).slice(0, 180),
    goal: clean(rawPlan.goal || fallbackPlan.goal).slice(0, 180),
    tone: clean(rawPlan.tone || fallbackPlan.tone).slice(0, 120),
    category: isTopicCategory(rawPlan.category) ? rawPlan.category : fallbackPlan.category,
    slides: normalizedSlides
  };
}

function dedupeCoreIdeas(slides: CarouselPlanSlide[], fallbackSlides: CarouselPlanSlide[]) {
  const fingerprints = new Map<number, Set<string>>();

  for (let index = 0; index < slides.length; index += 1) {
    const tokens = toSimilaritySet(slides[index].coreIdea);
    fingerprints.set(index, tokens);
  }

  for (let left = 0; left < slides.length; left += 1) {
    for (let right = left + 1; right < slides.length; right += 1) {
      const leftTokens = fingerprints.get(left);
      const rightTokens = fingerprints.get(right);
      if (!leftTokens || !rightTokens) {
        continue;
      }

      const similarity = jaccardSimilarity(leftTokens, rightTokens);
      if (similarity < 0.68) {
        continue;
      }

      const fallback = fallbackSlides[right];
      slides[right].coreIdea = fallback?.coreIdea || `${slides[right].role}: дополнительный полезный ракурс`;
      slides[right].layoutType = normalizeLayoutType(
        fallback?.layoutType || chooseLayoutForRole(slides[right].role, "none")
      );
      slides[right].imageIntent = fallback?.imageIntent || "none";
      slides[right].imageQueryDraft = fallback?.imageQueryDraft || "";
      fingerprints.set(right, toSimilaritySet(slides[right].coreIdea));
    }
  }
}

function resolveImageBudget(lens: TopicLens, targetCount: number) {
  if (lens.imageScore < 0.32) {
    return 0;
  }

  if (lens.imageScore < 0.52) {
    return Math.min(1, Math.max(1, Math.round(targetCount / 7)));
  }

  if (lens.imageScore < 0.74) {
    return Math.min(2, Math.max(1, Math.round(targetCount / 5)));
  }

  return Math.min(3, Math.max(2, Math.round(targetCount / 4)));
}

function limitImageUsage(
  slides: CarouselPlanSlide[],
  maxImages: number,
  category: TopicCategory
) {
  if (maxImages <= 0) {
    slides.forEach((slide) => {
      slide.imageIntent = "none";
      slide.imageQueryDraft = "";
      if (slide.layoutType === "image-top") {
        slide.layoutType = normalizeLayoutType(chooseLayoutForRole(slide.role, "none"));
      }
    });
    return;
  }

  const ranked = slides
    .map((slide, index) => ({ index, score: rankImagePriority(slide.role, slide.imageIntent) }))
    .sort((left, right) => right.score - left.score)
    .map((item) => item.index);

  const selected = new Set<number>();
  for (const index of ranked) {
    const slide = slides[index];
    if (!slide || slide.imageIntent === "none") {
      continue;
    }

    selected.add(index);
    if (selected.size >= maxImages) {
      break;
    }
  }

  slides.forEach((slide, index) => {
    if (!selected.has(index)) {
      slide.imageIntent = "none";
      slide.imageQueryDraft = "";
      if (slide.layoutType === "image-top") {
        slide.layoutType = normalizeLayoutType(chooseLayoutForRole(slide.role, "none"));
      }
      return;
    }

    if (!slide.imageQueryDraft) {
      slide.imageQueryDraft = buildImageQueryDraft(
        slide.coreIdea,
        slide.role,
        slide.imageIntent,
        "",
        category
      );
    }

    if (slide.imageIntent !== "none") {
      slide.layoutType = "image-top";
    }
  });
}

function normalizeLayoutType(layoutType: CarouselLayoutType): CarouselLayoutType {
  if (layoutType === "cover-hero") {
    return "hero";
  }

  if (layoutType === "title-body" || layoutType === "summary") {
    return "card";
  }

  if (
    layoutType === "bullets" ||
    layoutType === "steps" ||
    layoutType === "checklist"
  ) {
    return "list";
  }

  if (layoutType === "case-split" || layoutType === "comparison") {
    return "split";
  }

  return layoutType;
}

function getLayoutAlternatives(
  role: CarouselSlideRole,
  imageIntent: CarouselImageIntent
): CarouselLayoutType[] {
  if (imageIntent !== "none" && (role === "cover" || role === "problem" || role === "case" || role === "comparison")) {
    return ["image-top", "hero", "statement"];
  }

  if (role === "cover") {
    return ["hero", "statement", "dark-slide"];
  }

  if (role === "problem") {
    return ["statement", "dark-slide", "split"];
  }

  if (role === "myth") {
    return ["split", "statement", "card"];
  }

  if (role === "mistake") {
    return ["card", "statement", "split"];
  }

  if (role === "tip") {
    return ["list", "card", "statement"];
  }

  if (role === "steps" || role === "checklist") {
    return ["list", "split", "card"];
  }

  if (role === "case" || role === "comparison") {
    return ["split", "card", "dark-slide"];
  }

  if (role === "summary") {
    return ["card", "statement", "dark-slide"];
  }

  if (role === "cta") {
    return ["cta"];
  }

  return ["card"];
}

function enforceLayoutRhythm(slides: CarouselPlanSlide[]) {
  if (!slides.length) {
    return;
  }

  slides.forEach((slide, index) => {
    slide.layoutType = normalizeLayoutType(slide.layoutType);
    if (index === 0 && slide.imageIntent === "none") {
      slide.layoutType = "hero";
    }
    if (index === slides.length - 1) {
      slide.layoutType = "cta";
    }
  });

  for (let index = 2; index < slides.length - 1; index += 1) {
    const current = slides[index];
    const prev = slides[index - 1];
    const prevPrev = slides[index - 2];
    if (
      current.layoutType === prev.layoutType &&
      current.layoutType === prevPrev.layoutType &&
      current.layoutType !== "image-top"
    ) {
      const alternatives = getLayoutAlternatives(current.role, current.imageIntent)
        .map((layout) => normalizeLayoutType(layout))
        .filter((layout) => layout !== prev.layoutType && layout !== "cta");
      if (alternatives[0]) {
        current.layoutType = alternatives[0];
      }
    }
  }

  const distinctLayouts = new Set(
    slides
      .slice(0, -1)
      .map((slide) => normalizeLayoutType(slide.layoutType))
      .filter((layout) => layout !== "image-top")
  );

  if (slides.length >= 5 && distinctLayouts.size < 3) {
    for (let index = 1; index < slides.length - 1 && distinctLayouts.size < 3; index += 1) {
      const slide = slides[index];
      const alternatives = getLayoutAlternatives(slide.role, slide.imageIntent)
        .map((layout) => normalizeLayoutType(layout))
        .filter((layout) => layout !== "image-top" && layout !== "cta");

      const next = alternatives.find((layout) => !distinctLayouts.has(layout));
      if (next) {
        slide.layoutType = next;
        distinctLayouts.add(next);
      }
    }
  }
}

function rankImagePriority(role: CarouselSlideRole, imageIntent: CarouselImageIntent) {
  if (imageIntent === "none") {
    return -100;
  }

  if (role === "cover") {
    return 100;
  }

  if (role === "case") {
    return 90;
  }

  if (role === "problem" || role === "comparison") {
    return 70;
  }

  if (role === "tip" || role === "summary") {
    return 45;
  }

  return 20;
}

function normalizeSlides(
  topic: string,
  draftedSlides: SlideDraft[],
  plan: CarouselPlan,
  targetCount: number,
  brief: ParsedBrief
): CarouselOutlineSlide[] {
  const safeDrafts = ensureDraftCount(draftedSlides, plan, brief, targetCount);

  const normalized = safeDrafts.map((draft, index) => {
    const planSlide = plan.slides[index] ?? plan.slides[plan.slides.length - 1] ?? buildFallbackPlanSlide(topic, "tip", index, targetCount, inferTopicLens(topic, brief.sourceIdeas), brief.sourceIdeas);
    const rawTitle = removeMetaLines(String(draft.title ?? ""));
    const rawText = removeMetaLines(String(draft.text ?? ""));

    const title = normalizeTitle(rawTitle, topic, planSlide, index, targetCount);
    const body = normalizeBody(rawText, title);
    const fallbackBody = buildFallbackBody(planSlide, topic, index, targetCount, brief);
    const preparedBody = isWeakBodyText(body, index > 0 && index < targetCount - 1) ? fallbackBody : body;

    const fitted = fitSlideTextToLayout(title, preparedBody, planSlide.layoutType, planSlide.role, planSlide.coreIdea);

    return {
      title: fitted.title,
      text: fitted.body,
      role: planSlide.role,
      coreIdea: planSlide.coreIdea,
      layoutType: normalizeLayoutType(planSlide.layoutType),
      imageIntent: planSlide.imageIntent,
      imageQueryDraft: planSlide.imageQueryDraft,
      templateId: planSlide.templateId
    };
  });

  if (normalized[0]) {
    if (/^(сравнение|обзор|гайд|guide|summary)\b/i.test(normalized[0].title)) {
      normalized[0].title = buildHookTitle(topic);
    }
    normalized[0].role = "cover";
    normalized[0].layoutType = normalized[0].imageIntent !== "none" ? "image-top" : "hero";
    normalized[0].text = fitSlideTextToLayout(
      normalized[0].title,
      normalized[0].text,
      normalized[0].layoutType ?? "hero",
      "cover",
      normalized[0].coreIdea ?? topic
    ).body;
  }

  const lastSlide = normalized[normalized.length - 1];
  if (lastSlide) {
    lastSlide.role = "cta";
    lastSlide.layoutType = "cta";
    lastSlide.imageIntent = "none";
    lastSlide.imageQueryDraft = "";
    if (!/(сделай|сохрани|подпиш|проверь|запусти|внедри|начни|попробуй)/i.test(lastSlide.text)) {
      lastSlide.text = fitSlideTextToLayout(
        lastSlide.title,
        `${lastSlide.text}\nСохраните карусель и примените первый шаг сегодня.`,
        "cta",
        "cta",
        lastSlide.coreIdea ?? topic
      ).body;
    }
  }

  return normalized;
}

function buildHookTitle(topic: string) {
  const basis = clean(topic).replace(/\s+/g, " ").trim();
  if (!basis) {
    return "Вы теряете результат и даже не замечаете";
  }

  const short = clampSentenceByWords(basis.replace(/^как\s+/i, ""), 7);
  return clampTitle(`Почему у вас не работает: ${short}`, 72);
}

function ensureDraftCount(
  drafts: SlideDraft[],
  plan: CarouselPlan,
  brief: ParsedBrief,
  targetCount: number
) {
  const safeDrafts = drafts
    .map((item) => ({
      title: clean(String(item?.title ?? "")),
      text: clean(String(item?.text ?? ""))
    }))
    .filter((item) => item.title || item.text)
    .slice(0, targetCount);

  while (safeDrafts.length < targetCount) {
    const index = safeDrafts.length;
    const planSlide = plan.slides[index];
    safeDrafts.push({
      title: buildFallbackTitle(planSlide, brief.coreTopic || plan.topic, index, targetCount),
      text: buildFallbackBody(planSlide, brief.coreTopic || plan.topic, index, targetCount, brief)
    });
  }

  return safeDrafts;
}

function assessSlidesQuality(topic: string, slides: CarouselOutlineSlide[], plan: CarouselPlan): QualityReport {
  if (!slides.length) {
    return { needsRepair: true, score: -100, problematicIndexes: [0] };
  }

  let score = 0;
  const problematic = new Set<number>();

  for (let index = 0; index < slides.length; index += 1) {
    const slide = slides[index];
    const planSlide = plan.slides[index];
    const title = clean(slide.title || "");
    const text = clean(slide.text || "");
    const merged = `${title}\n${text}`;
    const layout = normalizeLayoutType(planSlide?.layoutType ?? slide.layoutType ?? "card");
    const limits = LAYOUT_LIMITS[layout];
    const wordLimits = LAYOUT_WORD_LIMITS[layout];

    if (!title || !text) {
      problematic.add(index);
      score -= 12;
      continue;
    }

    if (hasMetaEcho(merged)) {
      problematic.add(index);
      score -= 10;
    }

    if (title.length < limits.titleMin || title.length > limits.titleMax + 6) {
      problematic.add(index);
      score -= 5;
    } else {
      score += 2;
    }

    if (text.length < Math.max(24, limits.bodyMin - 26) || text.length > limits.bodyMax + 24) {
      problematic.add(index);
      score -= 6;
    } else {
      score += 3;
    }

    const titleWords = countWords(title);
    const bodyWords = countWords(text);
    if (titleWords > wordLimits.titleWords + 1) {
      problematic.add(index);
      score -= 5;
    }

    if (bodyWords > wordLimits.bodyWords + 2) {
      problematic.add(index);
      score -= 6;
    }

    const lineCount = text.split(/\n+/).filter(Boolean).length;
    if (lineCount > limits.preferredLinesMax + 1) {
      problematic.add(index);
      score -= 4;
    }

    if (STRUCTURED_LAYOUTS.has(layout)) {
      const bulletLines = text
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => /^([•\-]|\d+\.)/.test(line)).length;
      if (bulletLines < 2) {
        problematic.add(index);
        score -= 4;
      }
    }

    if ((planSlide?.role ?? slide.role) === "cta") {
      const hasActionVerb = /(сделайт|запусти|проверь|примени|выбери|внедри|сохран|начни|попробуй)/i.test(text);
      if (!hasActionVerb) {
        problematic.add(index);
        score -= 5;
      }
    }

    if (/\b[a-z]{4,}\b/i.test(merged) && !/(cta|instagram|stories|reels)/i.test(merged)) {
      problematic.add(index);
      score -= 2;
    }
  }

  for (let left = 0; left < slides.length; left += 1) {
    for (let right = left + 1; right < slides.length; right += 1) {
      const titleSimilarity = semanticSimilarity(slides[left].title, slides[right].title);
      const ideaSimilarity = semanticSimilarity(
        `${slides[left].title} ${slides[left].text}`,
        `${slides[right].title} ${slides[right].text}`
      );

      if (titleSimilarity > 0.7 || ideaSimilarity > 0.68) {
        problematic.add(right);
        score -= 8;
      }
    }
  }

  const problematicIndexes = Array.from(problematic).sort((left, right) => left - right);
  return {
    needsRepair: problematicIndexes.length > 0,
    score,
    problematicIndexes
  };
}

function buildDeterministicRepairs(
  topic: string,
  plan: CarouselPlan,
  brief: ParsedBrief,
  repairIndexes: number[],
  totalSlides: number
): RepairDraft[] {
  return repairIndexes.map((index) => {
    const planSlide = plan.slides[index] ?? buildFallbackPlanSlide(topic, "tip", index, totalSlides, inferTopicLens(topic, brief.sourceIdeas), brief.sourceIdeas);
    const fallbackTitle = buildFallbackTitle(planSlide, topic, index, totalSlides);
    const fallbackBody = buildFallbackBody(planSlide, topic, index, totalSlides, brief);
    const fitted = fitSlideTextToLayout(fallbackTitle, fallbackBody, planSlide.layoutType, planSlide.role, planSlide.coreIdea);

    return {
      slideIndex: index,
      title: fitted.title,
      text: fitted.body
    };
  });
}

function applyRepairs(
  slides: CarouselOutlineSlide[],
  repairs: RepairDraft[],
  plan: CarouselPlan,
  topic: string,
  brief: ParsedBrief,
  totalSlides: number
) {
  if (!repairs.length) {
    return slides;
  }

  const patchMap = new Map<number, RepairDraft>();
  repairs.forEach((repair) => {
    patchMap.set(repair.slideIndex, repair);
  });

  return slides.map((slide, index) => {
    const repair = patchMap.get(index);
    if (!repair) {
      return slide;
    }

    const planSlide = plan.slides[index] ?? buildFallbackPlanSlide(topic, "tip", index, totalSlides, inferTopicLens(topic, brief.sourceIdeas), brief.sourceIdeas);
    const title = normalizeTitle(removeMetaLines(repair.title), topic, planSlide, index, totalSlides);
    const body = normalizeBody(removeMetaLines(repair.text), title);
    const fallbackBody = buildFallbackBody(planSlide, topic, index, totalSlides, brief);
    const preparedBody = isWeakBodyText(body, index > 0 && index < totalSlides - 1) ? fallbackBody : body;
    const fitted = fitSlideTextToLayout(title, preparedBody, planSlide.layoutType, planSlide.role, planSlide.coreIdea);

    return {
      ...slide,
      title: fitted.title,
      text: fitted.body,
      role: planSlide.role,
      coreIdea: planSlide.coreIdea,
      layoutType: normalizeLayoutType(planSlide.layoutType),
      imageIntent: planSlide.imageIntent,
      imageQueryDraft: planSlide.imageQueryDraft,
      templateId: planSlide.templateId
    };
  });
}

function buildDeterministicFallbackSlides(
  topic: string,
  plan: CarouselPlan,
  brief: ParsedBrief,
  targetCount: number
) {
  const drafts = buildDraftSlidesFromPlan(plan, brief, targetCount);
  return normalizeSlides(topic, drafts, plan, targetCount, brief);
}

function buildDraftSlidesFromPlan(plan: CarouselPlan, brief: ParsedBrief, targetCount: number): SlideDraft[] {
  const coreTopic = brief.coreTopic || plan.topic;

  return plan.slides.slice(0, targetCount).map((slide, index) => ({
    title: buildFallbackTitle(slide, coreTopic, index, targetCount),
    text: buildFallbackBody(slide, coreTopic, index, targetCount, brief)
  }));
}

function buildDeterministicPlan(
  topic: string,
  targetCount: number,
  lens: TopicLens,
  brief: ParsedBrief
): CarouselPlan {
  const roles = buildRoleSequence(targetCount);
  const seeds = brief.sourceIdeas.length ? brief.sourceIdeas : [topic];
  const family = chooseTemplateFamily(lens, topic);

  const slides = roles.map((role, index) => {
    const planSlide = buildFallbackPlanSlide(topic, role, index, targetCount, lens, seeds, family);
    return planSlide;
  });

  const maxImages = resolveImageBudget(lens, targetCount);
  limitImageUsage(slides, maxImages, lens.category);
  enforceLayoutRhythm(slides);

  return {
    topic,
    audience: lens.audience,
    goal: lens.goal,
    tone: lens.tone,
    category: lens.category,
    slides
  };
}

function buildFallbackPlanSlide(
  topic: string,
  role: CarouselSlideRole,
  index: number,
  totalSlides: number,
  lens: TopicLens,
  seeds: string[],
  family?: TemplateFamilyId
): CarouselPlanSlide {
  const seed = pickSeedLine(seeds, index, topic);
  const coreIdea = buildCoreIdea(role, seed, topic, index, totalSlides);
  const imageIntent = chooseImageIntent(role, lens, index, totalSlides);
  const layoutType = chooseLayoutForRole(role, imageIntent);
  const templateId = chooseTemplateForRole(role, lens, index, topic, family);
  const imageQueryDraft =
    imageIntent === "none"
      ? ""
      : buildImageQueryDraft(coreIdea, role, imageIntent, topic, lens.category);

  return {
    role,
    coreIdea,
    layoutType,
    imageIntent,
    imageQueryDraft,
    templateId
  };
}

function buildRoleSequence(targetCount: number): CarouselSlideRole[] {
  if (targetCount <= 5) {
    const compact: CarouselSlideRole[] = ["cover", "problem", "tip", "mistake", "cta"];
    return compact.slice(0, targetCount);
  }

  if (targetCount === 6) {
    return ["cover", "problem", "myth", "tip", "summary", "cta"];
  }

  if (targetCount === 7) {
    return ["cover", "problem", "mistake", "tip", "tip", "case", "cta"];
  }

  if (targetCount === 8) {
    return ["cover", "problem", "myth", "steps", "tip", "case", "summary", "cta"];
  }

  if (targetCount === 9) {
    return ["cover", "problem", "myth", "steps", "tip", "comparison", "case", "summary", "cta"];
  }

  const base: CarouselSlideRole[] = [
    "cover",
    "problem",
    "myth",
    "mistake",
    "steps",
    "tip",
    "comparison",
    "case",
    "checklist",
    "cta"
  ];

  const result = [...base];
  const extras: CarouselSlideRole[] = ["tip", "summary", "case", "checklist", "mistake"];

  while (result.length < targetCount) {
    result.splice(result.length - 1, 0, extras[(result.length - base.length) % extras.length]);
  }

  result[0] = "cover";
  result[result.length - 1] = "cta";
  return result.slice(0, targetCount);
}

function chooseLayoutForRole(role: CarouselSlideRole, imageIntent: CarouselImageIntent): CarouselLayoutType {
  if (imageIntent !== "none" && (role === "cover" || role === "problem" || role === "case" || role === "comparison")) {
    return "image-top";
  }

  if (role === "cover") {
    return "hero";
  }

  if (role === "problem") {
    return "statement";
  }

  if (role === "myth") {
    return "split";
  }

  if (role === "mistake") {
    return "card";
  }

  if (role === "tip") {
    return "list";
  }

  if (role === "steps") {
    return "list";
  }

  if (role === "checklist") {
    return "list";
  }

  if (role === "case") {
    return "split";
  }

  if (role === "comparison") {
    return "split";
  }

  if (role === "summary") {
    return "card";
  }

  if (role === "cta") {
    return "cta";
  }

  return "title-body";
}

function chooseTemplateForRole(
  role: CarouselSlideRole,
  lens: TopicLens,
  index: number,
  topic: string,
  family?: TemplateFamilyId
): CarouselTemplateId {
  const activeFamily = family ?? chooseTemplateFamily(lens, topic);
  const familyPool = TEMPLATE_FAMILY_POOLS[activeFamily];
  const pool = familyPool[role] ?? familyPool.tip;
  return pool[index % pool.length];
}

function chooseTemplateFamily(lens: TopicLens, topic: string): TemplateFamilyId {
  const candidates: TemplateFamilyId[] =
    lens.category === "marketing-sales" || lens.category === "business"
      ? ["dark-premium", "accent-business"]
      : lens.category === "real-estate"
        ? ["light-clean", "dark-premium"]
        : lens.category === "personal-brand"
          ? ["accent-business", "light-clean"]
          : ["light-clean", "accent-business"];

  const hash = Math.abs(stableHash(`${lens.category}|${topic}`));
  return candidates[hash % candidates.length];
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return hash;
}

function enforceTemplateFamily(
  slides: CarouselPlanSlide[],
  lens: TopicLens,
  topic: string,
  forcedFamily?: TemplateFamilyId
) {
  const family = forcedFamily ?? chooseTemplateFamily(lens, topic);

  slides.forEach((slide, index) => {
    if (slide.layoutType === "dark-slide") {
      const darkPool = TEMPLATE_FAMILY_POOLS["dark-premium"][slide.role] ?? TEMPLATE_FAMILY_POOLS["dark-premium"].tip;
      slide.templateId = darkPool[index % darkPool.length];
      return;
    }

    slide.templateId = chooseTemplateForRole(slide.role, lens, index, topic, family);
  });

  return family;
}

function chooseImageIntent(
  role: CarouselSlideRole,
  lens: TopicLens,
  index: number,
  totalSlides: number
): CarouselImageIntent {
  if (role === "cta" || role === "steps" || role === "checklist") {
    return "none";
  }

  if (lens.imageScore < 0.34) {
    return "none";
  }

  if (lens.category === "education-visual") {
    if (role === "cover") {
      return "object-photo";
    }
    if (role === "problem") {
      return "subject-photo";
    }
    if (role === "case" || role === "comparison") {
      return "object-photo";
    }
  }

  if (lens.category === "real-estate") {
    if (role === "cover") {
      return "subject-photo";
    }
    if (role === "problem" && index <= Math.max(2, Math.floor(totalSlides * 0.35))) {
      return "subject-photo";
    }
    if (role === "case") {
      return "people-photo";
    }
  }

  if (lens.category === "health-safety") {
    if (role === "cover") {
      return "object-photo";
    }
    if (role === "problem") {
      return "conceptual-photo";
    }
    if (role === "case") {
      return "subject-photo";
    }
  }

  if (role === "cover") {
    return lens.imageScore > 0.58 ? "subject-photo" : "conceptual-photo";
  }

  if (role === "case") {
    return "people-photo";
  }

  if (role === "comparison" && lens.imageScore > 0.62) {
    return "object-photo";
  }

  if (role === "problem" && lens.imageScore > 0.48 && index < Math.max(2, totalSlides - 2)) {
    return "conceptual-photo";
  }

  return "none";
}

function buildCoreIdea(
  role: CarouselSlideRole,
  seed: string,
  topic: string,
  index: number,
  totalSlides: number
) {
  const cleanedSeed = clean(seed).slice(0, 160);

  if (role === "cover") {
    return `Ключевой хук: ${cleanedSeed || topic}`;
  }

  if (role === "problem") {
    return `Почему результат по теме «${topic}» часто не растёт: ${cleanedSeed || "типичная причина"}`;
  }

  if (role === "myth") {
    return `Миф, который тормозит прогресс: ${cleanedSeed || "ложное убеждение"}`;
  }

  if (role === "mistake") {
    return `Ошибка, из-за которой теряется эффективность: ${cleanedSeed || "типичный провал"}`;
  }

  if (role === "tip") {
    return `Практический совет #${Math.max(1, index)}: ${cleanedSeed || "конкретный приём"}`;
  }

  if (role === "steps") {
    return `Пошаговая схема внедрения по теме: ${cleanedSeed || topic}`;
  }

  if (role === "checklist") {
    return `Чеклист перед запуском: ${cleanedSeed || topic}`;
  }

  if (role === "case") {
    return `Мини-кейс: как это работает на практике — ${cleanedSeed || topic}`;
  }

  if (role === "comparison") {
    return `Что делать vs чего избегать в теме «${topic}»`;
  }

  if (role === "summary") {
    return `Итог по теме и главный вывод: ${cleanedSeed || topic}`;
  }

  if (index === totalSlides - 1) {
    return `Финальный шаг и призыв к действию по теме «${topic}»`;
  }

  return cleanedSeed || topic;
}

function buildFallbackTitle(
  planSlide: CarouselPlanSlide | undefined,
  topic: string,
  index: number,
  totalSlides: number
): string {
  if (!planSlide) {
    if (index === 0) {
      return "Главная мысль по теме";
    }
    if (index === totalSlides - 1) {
      return "Что делать дальше";
    }
    return "Ключевой рабочий тезис";
  }

  const idea = clean(planSlide.coreIdea).replace(/^[^:]+:\s*/, "");
  const fallbackByRole: Record<CarouselSlideRole, string> = {
    cover: "Главная мысль, которую нельзя пропустить",
    problem: "Почему это не работает",
    myth: "Миф, который мешает результату",
    mistake: "Ошибка, которая всё ломает",
    tip: "Что сделать прямо сейчас",
    steps: "Пошаговый план действий",
    checklist: "Чеклист перед запуском",
    case: "Кейс из практики",
    comparison: "Как правильно и как не надо",
    summary: "Ключевой вывод",
    cta: "Что делать дальше"
  };

  const basis = idea || fallbackByRole[planSlide.role] || fallbackByRole.tip;
  return clampTitle(basis, LAYOUT_LIMITS[normalizeLayoutType(planSlide.layoutType)].titleMax);
}

function buildFallbackBody(
  planSlide: CarouselPlanSlide | undefined,
  topic: string,
  index: number,
  totalSlides: number,
  brief: ParsedBrief
) {
  const role = planSlide?.role ?? (index === 0 ? "cover" : index === totalSlides - 1 ? "cta" : "tip");
  const coreIdea = planSlide?.coreIdea ?? pickSeedLine(brief.sourceIdeas, index, topic);
  const shortIdea = clampSentenceByWords(clean(coreIdea).replace(/^[^:]+:\s*/, ""), 8);

  if (role === "cover") {
    return [
      "Где вы теряете результат прямо сейчас.",
      "Листайте: дальше только рабочие шаги."
    ].join("\n");
  }

  if (role === "problem") {
    return [
      `Проблема: ${shortIdea}.`,
      "Из-за этого действия есть, а роста нет."
    ].join("\n");
  }

  if (role === "myth") {
    return [
      `Миф: ${shortIdea}.`,
      "Звучит логично, но на практике тормозит."
    ].join("\n");
  }

  if (role === "mistake") {
    return [
      `Ошибка: ${shortIdea}.`,
      "Уберите её первой и получите быстрый прирост."
    ].join("\n");
  }

  if (role === "tip") {
    return [
      `• Фокус: ${shortIdea}.`,
      "• Сделайте один шаг сегодня.",
      "• Проверьте эффект через 3-7 дней."
    ].join("\n");
  }

  if (role === "steps") {
    return [
      "1. Определите текущую точку.",
      `2. Запустите шаг: ${shortIdea}.`,
      "3. Измерьте результат и закрепите."
    ].join("\n");
  }

  if (role === "checklist") {
    return [
      "• Цель формулируется в 1 строку.",
      "• Ответственный назначен заранее.",
      "• Действие можно сделать сегодня.",
      "• Проверка результата в календаре."
    ].join("\n");
  }

  if (role === "case") {
    return [
      `Кейс: ${shortIdea}.`,
      "Один узкий фикс дал заметный рост уже в первый цикл."
    ].join("\n");
  }

  if (role === "comparison") {
    return [
      "Делать: один чёткий сценарий и метрика.",
      "Не делать: хаотичные действия без проверки."
    ].join("\n");
  }

  if (role === "summary") {
    return [
      `Итог: ${shortIdea}.`,
      "Лучшая стратегия: меньше шума, больше точных шагов."
    ].join("\n");
  }

  return [
    "Сохраните эту карусель, чтобы не потерять.",
    "Сделайте первый шаг сегодня."
  ].join("\n");
}

function fitSlideTextToLayout(
  title: string,
  body: string,
  layoutType: CarouselLayoutType,
  role: CarouselSlideRole,
  coreIdea: string
) {
  const resolvedLayout = normalizeLayoutType(layoutType);
  const limits = LAYOUT_LIMITS[resolvedLayout];
  const wordLimits = LAYOUT_WORD_LIMITS[resolvedLayout];
  const fittedTitle = clampSentenceByWords(
    clampTitle(title, limits.titleMax),
    wordLimits.titleWords
  );

  let preparedBody = body;
  if (STRUCTURED_LAYOUTS.has(resolvedLayout)) {
    preparedBody = toStructuredBody(preparedBody, resolvedLayout, coreIdea, wordLimits.lineWords);
  } else {
    preparedBody = toCompactBody(preparedBody, wordLimits.bodyWords, wordLimits.lineWords, limits.preferredLinesMax);
  }

  preparedBody = clampBody(preparedBody, limits.bodyMax);

  if (preparedBody.length < limits.bodyMin) {
    const expanded = `${preparedBody}\n${buildBodyPadding(role, coreIdea)}`.trim();
    const compactExpanded = STRUCTURED_LAYOUTS.has(resolvedLayout)
      ? toStructuredBody(expanded, resolvedLayout, coreIdea, wordLimits.lineWords)
      : toCompactBody(expanded, wordLimits.bodyWords, wordLimits.lineWords, limits.preferredLinesMax);
    preparedBody = clampBody(compactExpanded, limits.bodyMax);
  }

  const normalizedLines = preparedBody
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, limits.preferredLinesMax)
    .map((line) => clampSentenceByWords(line, wordLimits.lineWords))
    .join("\n");

  return {
    title: fittedTitle,
    body: normalizedLines
  };
}

function toStructuredBody(
  body: string,
  layoutType: CarouselLayoutType,
  coreIdea: string,
  lineWords: number
) {
  const lines = extractBodyLines(body);
  const safeLines = lines.length ? lines : extractBodyLines(coreIdea);
  const targetLines = Math.max(3, Math.min(5, safeLines.length || 3));
  const compact = safeLines
    .slice(0, targetLines)
    .map((line) => clampSentenceByWords(clampSentence(line, 78), lineWords));

  if (layoutType === "steps") {
    return compact.map((line, index) => `${index + 1}. ${line}`).join("\n");
  }

  return compact.map((line) => `• ${line}`).join("\n");
}

function toCompactBody(
  body: string,
  bodyWords: number,
  lineWords: number,
  maxLines: number
) {
  const normalized = clean(body).replace(/\n+/g, " ").trim();
  if (!normalized) {
    return normalized;
  }

  const words = normalized.split(/\s+/).filter(Boolean).slice(0, bodyWords);
  if (!words.length) {
    return "";
  }

  const lines: string[] = [];
  let cursor = 0;

  while (cursor < words.length && lines.length < maxLines) {
    const chunk = words.slice(cursor, cursor + lineWords).join(" ");
    lines.push(chunk);
    cursor += lineWords;
  }

  const trimmedLines = lines.map((line, index) =>
    index === lines.length - 1 ? clampSentence(line, 84) : line
  );

  return trimmedLines.join("\n");
}

function extractBodyLines(value: string) {
  const rawLines = clean(value)
    .split(/\n+/)
    .map((line) => line.replace(/^([•\-]|\d+\.)\s*/, "").trim())
    .filter(Boolean);

  if (rawLines.length >= 2) {
    return rawLines;
  }

  return clean(value)
    .split(/[.!?;]+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 18)
    .slice(0, 5);
}

function buildBodyPadding(role: CarouselSlideRole, coreIdea: string) {
  if (role === "cta") {
    return "Сохраните и примените это сегодня.";
  }

  if (role === "tip" || role === "checklist" || role === "steps") {
    return "Проверьте шаг на практике и замерьте результат.";
  }

  return `${coreIdea}. Дайте один конкретный пример.`;
}

function clampSentenceByWords(value: string, maxWords: number) {
  const words = value
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  if (words.length <= maxWords) {
    return value;
  }

  return clampSentence(words.slice(0, maxWords).join(" "), value.length);
}

function clampTitle(value: string, maxLength: number) {
  const cleaned = clean(value).replace(/\n+/g, " ").trim();
  if (!cleaned) {
    return "Ключевой тезис";
  }

  return clampSentence(cleaned, maxLength);
}

function clampBody(value: string, maxLength: number) {
  let cleaned = clean(value)
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const lines = cleaned.split(/\n+/).filter(Boolean);
  while (lines.length > 2 && lines.join("\n").length > maxLength) {
    lines.pop();
  }

  cleaned = lines.join("\n");
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return clampSentence(cleaned.replace(/\n+/g, " "), maxLength);
}

function clampSentence(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  const truncated = value.slice(0, maxLength - 1).trimEnd();
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > 24) {
    return `${truncated.slice(0, lastSpace).trimEnd()}…`;
  }

  return `${truncated}…`;
}

function normalizeTitle(
  rawTitle: string,
  topic: string,
  planSlide: CarouselPlanSlide,
  index: number,
  total: number
): string {
  const cleaned = clean(rawTitle)
    .replace(/^\s*\d+[\)\.]?\s*/, "")
    .split("\n")[0]
    ?.trim();

  const fallback = buildFallbackTitle(planSlide, topic, index, total);
  const basis = cleaned || fallback;
  const normalized = capitalizeTitle(
    clampTitle(basis, LAYOUT_LIMITS[normalizeLayoutType(planSlide.layoutType)].titleMax)
  );

  if (
    planSlide.role === "cover" &&
    /^(сравнение|обзор|гайд|guide|summary)\b/i.test(normalized)
  ) {
    return "Вы теряете результат и даже не замечаете";
  }

  return normalized;
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

function isWeakBodyText(text: string, isMiddleSlide: boolean) {
  if (!text.trim()) {
    return true;
  }

  const words = countWords(text);
  if (isMiddleSlide) {
    return text.length < 26 || words < 5;
  }

  return text.length < 16 || words < 3;
}

function countWords(text: string) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean).length;
}

function hasMetaEcho(text: string) {
  const normalized = text.toLowerCase();
  return META_PATTERNS.some((pattern) => pattern.test(normalized));
}

function semanticSimilarity(left: string, right: string) {
  return jaccardSimilarity(toSimilaritySet(left), toSimilaritySet(right));
}

function toSimilaritySet(value: string) {
  const tokens = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !SIMILARITY_STOP_WORDS.has(word));

  return new Set(tokens);
}

function jaccardSimilarity(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) {
    return 0;
  }

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }

  return intersection / (left.size + right.size - intersection);
}

function isModelAvailabilityError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /(model|permission|access|not found|unsupported|does not exist|unavailable)/i.test(
    error.message
  );
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

function normalizeBriefLine(value: string) {
  const withoutBullet = value.replace(/^[\-*\u2022]\s*/, "");
  const numberedMatch = withoutBullet.match(/^\d+\s*[\)\.\-\:]\s*(.+)$/);
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

function inferTopicLens(topic: string, sourceIdeas: string[]): TopicLens {
  const merged = `${topic} ${sourceIdeas.join(" ")}`.toLowerCase();

  const category: TopicCategory = (() => {
    if (/недвиж|квартир|ипотек|дом|объект|риелтор|жк/i.test(merged)) {
      return "real-estate";
    }

    if (/медицин|здоров|симптом|ядов|безопас|диагноз|врач|лекар/i.test(merged)) {
      return "health-safety";
    }

    if (/конверси|продаж|лид|воронк|чек|оффер|маркетинг|клиент/i.test(merged)) {
      return "marketing-sales";
    }

    if (/личн\s*бренд|блог|контент|экспертность|аудитория/i.test(merged)) {
      return "personal-brand";
    }

    if (/гриб|растени|птиц|живот|природ|рецепт|еда|путешеств|ландшафт/i.test(merged)) {
      return "education-visual";
    }

    if (/инструкц|пошаг|как\s+сделать|чеклист|гайд/i.test(merged)) {
      return "how-to";
    }

    if (/бизнес|компан|команда|управлен|стратег|операц/i.test(merged)) {
      return "business";
    }

    return "expert-education";
  })();

  const audience = (() => {
    if (/пенсионер|50\+|пожил/i.test(merged)) {
      return "люди 50+ и их семьи";
    }
    if (/предприним|владелец|бизнес/i.test(merged)) {
      return "предприниматели и руководители";
    }
    if (/маркетолог|продажник|отдел продаж/i.test(merged)) {
      return "маркетологи, руководители продаж и эксперты";
    }
    if (/нович|начинающ/i.test(merged)) {
      return "новички, которым нужны понятные шаги";
    }
    return "эксперты и практики, которым нужен прикладной результат";
  })();

  const goal = (() => {
    if (category === "marketing-sales") {
      return "повысить конверсию и качество аргументации";
    }
    if (category === "real-estate") {
      return "помочь принять решение и снизить риск ошибки";
    }
    if (category === "health-safety") {
      return "обучить безопасным действиям и предупредить риски";
    }
    if (category === "personal-brand") {
      return "усилить доверие и экспертное позиционирование";
    }
    if (category === "education-visual") {
      return "объяснить тему наглядно и запоминаемо";
    }
    if (category === "how-to") {
      return "дать пошаговый план, который можно выполнить сразу";
    }
    if (category === "business") {
      return "дать рабочую бизнес-логику и практические шаги";
    }
    return "дать прикладную структуру и полезные решения";
  })();

  const tone = (() => {
    if (category === "health-safety") {
      return "спокойный, ответственный, без сенсаций";
    }
    if (category === "marketing-sales") {
      return "уверенный экспертный, с конкретикой и примерами";
    }
    if (category === "real-estate") {
      return "доверительный, практичный, без давления";
    }
    return "практичный, ясный, ориентированный на действие";
  })();

  let imageScore = (() => {
    if (category === "education-visual") {
      return 0.86;
    }
    if (category === "real-estate") {
      return 0.72;
    }
    if (category === "health-safety") {
      return 0.58;
    }
    if (category === "personal-brand") {
      return 0.5;
    }
    if (category === "marketing-sales") {
      return 0.4;
    }
    if (category === "how-to") {
      return 0.38;
    }
    if (category === "business") {
      return 0.34;
    }
    return 0.42;
  })();

  if (/фото|изображен|визуал|иллюстрац|покажи/i.test(merged)) {
    imageScore += 0.12;
  }

  if (/чеклист|пошаг|инструкция|таблица|формула/i.test(merged)) {
    imageScore -= 0.08;
  }

  imageScore = Math.max(0, Math.min(1, imageScore));

  return {
    category,
    audience,
    goal,
    tone,
    imageScore
  };
}

function inferTargetSlides(topic: string) {
  const numbered = (topic.match(/(^|\n)\s*\d+\s*[\)\.]/g) ?? []).length;
  if (numbered >= 5 && numbered <= 12) {
    return numbered;
  }

  const markerCount = [/миф\/факт/i, /ошибка/i, /подборка/i, /инструкция/i, /лайфхак/i].reduce(
    (count, marker) => count + (marker.test(topic) ? 1 : 0),
    0
  );

  if (markerCount >= 4) {
    return DEFAULT_SLIDES_COUNT;
  }

  return null;
}

function pickSeedLine(lines: string[], index: number, fallback: string) {
  if (!lines.length) {
    return fallback;
  }

  return lines[index % lines.length];
}

function capitalizeTitle(value: string) {
  if (!value) {
    return value;
  }

  const [first, ...rest] = Array.from(value);
  return `${first.toLocaleUpperCase("ru-RU")}${rest.join("")}`;
}

function buildImageQueryDraft(
  coreIdea: string,
  role: CarouselSlideRole,
  imageIntent: CarouselImageIntent,
  topic: string,
  category?: TopicCategory
) {
  if (imageIntent === "none") {
    return "";
  }

  const inferredCategory = category ?? inferTopicLens(topic || coreIdea, [coreIdea]).category;
  const baseKeywords = extractSearchKeywords(`${coreIdea} ${topic}`).slice(0, 6);
  const translated = baseKeywords.map((token) => KEYWORD_TRANSLATIONS[token] ?? token);
  const categoryHints = getCategoryVisualHints(inferredCategory, role);
  const intentPrefix =
    imageIntent === "people-photo"
      ? ["professional", "people", "photo"]
      : imageIntent === "object-photo"
        ? ["object", "closeup", "photo"]
        : imageIntent === "subject-photo"
          ? ["subject", "natural", "photo"]
          : ["concept", "clean", "editorial", "photo"];
  const roleHint =
    role === "case"
      ? ["real", "situation"]
      : role === "cover"
        ? ["hero", "clean", "visual"]
        : role === "comparison"
          ? ["contrast", "scene"]
          : [];

  const query = uniqueSearchTokens([
    ...intentPrefix,
    ...categoryHints,
    ...roleHint,
    ...translated
  ])
    .slice(0, 10)
    .join(" ");

  return normalizeImageQuery(query);
}

function getCategoryVisualHints(category: TopicCategory, role: CarouselSlideRole) {
  if (category === "real-estate") {
    return role === "case"
      ? ["real", "estate", "consultation", "office"]
      : ["luxury", "property", "architecture", "interior"];
  }

  if (category === "education-visual") {
    return ["natural", "closeup", "detailed", "macro"];
  }

  if (category === "health-safety") {
    return ["safety", "education", "clean", "realistic"];
  }

  if (category === "marketing-sales") {
    return role === "case"
      ? ["business", "meeting", "discussion"]
      : ["business", "strategy", "professional"];
  }

  if (category === "personal-brand") {
    return ["creator", "workspace", "portrait", "minimal"];
  }

  if (category === "how-to") {
    return ["instructional", "workflow", "practical", "scene"];
  }

  if (category === "business") {
    return ["executive", "professional", "workspace", "clean"];
  }

  return ["editorial", "professional", "clean"];
}

function uniqueSearchTokens(tokens: string[]) {
  const normalized = tokens
    .flatMap((token) => token.split(/\s+/))
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 2);

  return Array.from(new Set(normalized));
}

function normalizeImageQuery(value: string) {
  const keywords = extractSearchKeywords(value).slice(0, 10);
  return keywords.join(" ").trim();
}

function extractSearchKeywords(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !SEARCH_STOP_WORDS.has(word));
}

function isCarouselRole(value: unknown): value is CarouselSlideRole {
  return typeof value === "string" && (ROLE_VALUES as readonly string[]).includes(value);
}

function isCarouselLayout(value: unknown): value is CarouselLayoutType {
  return typeof value === "string" && (LAYOUT_VALUES as readonly string[]).includes(value);
}

function isImageIntent(value: unknown): value is CarouselImageIntent {
  return typeof value === "string" && (IMAGE_INTENT_VALUES as readonly string[]).includes(value);
}

function isTemplateId(value: unknown): value is CarouselTemplateId {
  return typeof value === "string" && (TEMPLATE_ID_VALUES as readonly string[]).includes(value);
}

function isTopicCategory(value: unknown): value is TopicCategory {
  return (
    value === "marketing-sales" ||
    value === "real-estate" ||
    value === "health-safety" ||
    value === "personal-brand" ||
    value === "education-visual" ||
    value === "how-to" ||
    value === "business" ||
    value === "expert-education"
  );
}
