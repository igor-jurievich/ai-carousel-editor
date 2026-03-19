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
type ScenarioId = "expert" | "educational" | "commercial" | "case-driven";
type GenerationOptions = {
  useInternetImages?: boolean;
};

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
  scenario?: ScenarioId;
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
    titleMax: 68,
    bodyMin: 18,
    bodyMax: 146,
    preferredLinesMin: 1,
    preferredLinesMax: 2
  },
  statement: {
    titleMin: 14,
    titleMax: 64,
    bodyMin: 18,
    bodyMax: 150,
    preferredLinesMin: 1,
    preferredLinesMax: 2
  },
  list: {
    titleMin: 14,
    titleMax: 64,
    bodyMin: 36,
    bodyMax: 188,
    preferredLinesMin: 3,
    preferredLinesMax: 4
  },
  split: {
    titleMin: 14,
    titleMax: 66,
    bodyMin: 32,
    bodyMax: 188,
    preferredLinesMin: 2,
    preferredLinesMax: 3
  },
  card: {
    titleMin: 14,
    titleMax: 68,
    bodyMin: 34,
    bodyMax: 188,
    preferredLinesMin: 2,
    preferredLinesMax: 3
  },
  "dark-slide": {
    titleMin: 14,
    titleMax: 66,
    bodyMin: 22,
    bodyMax: 138,
    preferredLinesMin: 1,
    preferredLinesMax: 2
  },
  "cover-hero": {
    titleMin: 14,
    titleMax: 68,
    bodyMin: 18,
    bodyMax: 116,
    preferredLinesMin: 1,
    preferredLinesMax: 2
  },
  "title-body": {
    titleMin: 14,
    titleMax: 68,
    bodyMin: 34,
    bodyMax: 188,
    preferredLinesMin: 2,
    preferredLinesMax: 3
  },
  bullets: {
    titleMin: 14,
    titleMax: 64,
    bodyMin: 36,
    bodyMax: 188,
    preferredLinesMin: 3,
    preferredLinesMax: 4
  },
  steps: {
    titleMin: 14,
    titleMax: 64,
    bodyMin: 36,
    bodyMax: 188,
    preferredLinesMin: 3,
    preferredLinesMax: 4
  },
  checklist: {
    titleMin: 14,
    titleMax: 64,
    bodyMin: 36,
    bodyMax: 188,
    preferredLinesMin: 3,
    preferredLinesMax: 4
  },
  "case-split": {
    titleMin: 14,
    titleMax: 66,
    bodyMin: 32,
    bodyMax: 188,
    preferredLinesMin: 2,
    preferredLinesMax: 3
  },
  comparison: {
    titleMin: 14,
    titleMax: 66,
    bodyMin: 32,
    bodyMax: 188,
    preferredLinesMin: 2,
    preferredLinesMax: 3
  },
  summary: {
    titleMin: 14,
    titleMax: 66,
    bodyMin: 28,
    bodyMax: 170,
    preferredLinesMin: 2,
    preferredLinesMax: 3
  },
  cta: {
    titleMin: 14,
    titleMax: 62,
    bodyMin: 22,
    bodyMax: 148,
    preferredLinesMin: 1,
    preferredLinesMax: 2
  },
  "image-top": {
    titleMin: 14,
    titleMax: 68,
    bodyMin: 30,
    bodyMax: 174,
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
  hero: { titleWords: 12, bodyWords: 24, lineWords: 12 },
  statement: { titleWords: 12, bodyWords: 30, lineWords: 12 },
  list: { titleWords: 10, bodyWords: 28, lineWords: 9 },
  split: { titleWords: 12, bodyWords: 30, lineWords: 12 },
  card: { titleWords: 12, bodyWords: 30, lineWords: 12 },
  "dark-slide": { titleWords: 12, bodyWords: 22, lineWords: 11 },
  "cover-hero": { titleWords: 12, bodyWords: 24, lineWords: 12 },
  "title-body": { titleWords: 12, bodyWords: 30, lineWords: 12 },
  bullets: { titleWords: 10, bodyWords: 28, lineWords: 9 },
  steps: { titleWords: 10, bodyWords: 28, lineWords: 9 },
  checklist: { titleWords: 10, bodyWords: 28, lineWords: 9 },
  "case-split": { titleWords: 12, bodyWords: 30, lineWords: 12 },
  comparison: { titleWords: 12, bodyWords: 30, lineWords: 12 },
  summary: { titleWords: 12, bodyWords: 28, lineWords: 12 },
  cta: { titleWords: 11, bodyWords: 24, lineWords: 11 },
  "image-top": { titleWords: 12, bodyWords: 28, lineWords: 12 }
};

const SCENARIO_ROLE_TEMPLATES: Record<ScenarioId, CarouselSlideRole[]> = {
  expert: [
    "cover",
    "problem",
    "problem",
    "mistake",
    "tip",
    "tip",
    "steps",
    "case",
    "comparison",
    "cta"
  ],
  educational: [
    "cover",
    "myth",
    "mistake",
    "mistake",
    "steps",
    "steps",
    "checklist",
    "summary",
    "case",
    "cta"
  ],
  commercial: [
    "cover",
    "problem",
    "problem",
    "mistake",
    "tip",
    "comparison",
    "case",
    "tip",
    "summary",
    "cta"
  ],
  "case-driven": [
    "cover",
    "problem",
    "tip",
    "case",
    "case",
    "comparison",
    "steps",
    "summary",
    "tip",
    "cta"
  ]
};

const SCENARIO_EXTRA_ROLES: Record<ScenarioId, CarouselSlideRole[]> = {
  expert: ["tip", "summary", "case", "checklist", "comparison"],
  educational: ["steps", "checklist", "tip", "summary", "case"],
  commercial: ["tip", "comparison", "summary", "case", "steps"],
  "case-driven": ["case", "tip", "comparison", "summary", "steps"]
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

const WEAK_COPY_PATTERNS = [
  /в\s+современном\s+мире/i,
  /следует\s+отметить/i,
  /данн(ый|ая|ое)\s+аспект/i,
  /явля(ет|ются)\s+важн/i,
  /для\s+достижения\s+максимальн/i,
  /необходимо\s+(учитывать|понимать|помнить)/i,
  /можно\s+сказать/i,
  /в\s+целом/i,
  /it\s+is\s+important\s+to\s+note/i,
  /in\s+today(?:'s)?\s+world/i,
  /it\s+should\s+be\s+considered/i
];

const HANGING_ENDING_PATTERN =
  /\b(и|но|или|либо|чтобы|если|когда|потому|так\s+как|поэтому|а|а\s+также|в|на|по|к|с|из|от|до|за|to|for|with|from|of|in|on|at|by|and|or|as|a|an|the|when|if|because)\s*$/i;

const FRAGMENT_START_PATTERN =
  /^(если|когда|чтобы|пока|так\s+как|потому\s+что|if|when|while|because|unless|although)\b/i;

const CTA_ACTION_PATTERN =
  /(сделайт|сдела(й|ть)|запусти|проверь|примени|выбери|внедри|сохран|начни|попробуй|поделись|подпиш|напиш|получ|забер|save|start|try|share|follow|apply|check|write|get|send)/i;

const HOOK_TITLE_PREFIXES = [
  "Почему «%topic%» не даёт результата",
  "Где в теме «%topic%» теряются клиенты",
  "Ошибка в теме «%topic%», из-за которой сливаются заявки",
  "Что в теме «%topic%» тормозит рост прямо сейчас",
  "Почему «%topic%» выглядит активно, но не приносит продажи"
];

const HOOK_TITLE_PREFIXES_EN = [
  "Why \"%topic%\" still fails to convert",
  "Where \"%topic%\" leaks results",
  "The costly mistake inside \"%topic%\"",
  "Why \"%topic%\" looks active but brings weak sales",
  "What's blocking growth in \"%topic%\" right now"
];

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

export async function generateCarouselFromTopic(
  topic: string,
  requestedSlidesCount?: number,
  options?: GenerationOptions
) {
  const brief = parseTopicBrief(topic);
  const coreTopic = brief.coreTopic || topic;
  const targetCount = clampSlidesCount(
    requestedSlidesCount ?? inferTargetSlides(topic) ?? DEFAULT_SLIDES_COUNT
  );
  const lens = inferTopicLens(coreTopic, brief.sourceIdeas);
  const deterministicPlan = buildDeterministicPlan(coreTopic, targetCount, lens, brief, options);

  let openai: OpenAI | null = null;
  try {
    openai = getOpenAIClient();
  } catch {
    return buildDeterministicFallbackSlides(coreTopic, deterministicPlan, brief, targetCount);
  }

  const model = resolvePrimaryGenerationModel();
  let draftedSlides: SlideDraft[] = [];
  try {
    draftedSlides = await requestCarouselSlides(
      openai,
      model,
      topic,
      brief,
      deterministicPlan,
      targetCount,
      options
    );
  } catch (error) {
    console.error("OpenAI carousel generation failed, fallback engaged:", error);
    draftedSlides = buildDraftSlidesFromPlan(deterministicPlan, brief, targetCount);
  }

  let slides = normalizeSlides(coreTopic, draftedSlides, deterministicPlan, targetCount, brief);
  slides = polishSlidesForPublishability(coreTopic, slides, deterministicPlan, brief, targetCount);
  const quality = assessSlidesQuality(coreTopic, slides, deterministicPlan);
  const criticalRepairIndexes = pickCriticalRepairIndexes(slides, quality.problematicIndexes);

  if (criticalRepairIndexes.length) {
    const deterministicRepairs = buildDeterministicRepairs(
      coreTopic,
      deterministicPlan,
      brief,
      criticalRepairIndexes,
      targetCount
    );
    slides = applyRepairs(
      slides,
      deterministicRepairs,
      deterministicPlan,
      coreTopic,
      brief,
      targetCount
    );
  }

  return polishSlidesForPublishability(coreTopic, slides, deterministicPlan, brief, targetCount);
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

function resolvePrimaryGenerationModel() {
  const configuredModel = process.env.OPENAI_MODEL?.trim();
  if (configuredModel && !/mini/i.test(configuredModel)) {
    return configuredModel;
  }

  return "gpt-4.1";
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
  targetCount: number,
  options?: GenerationOptions
) {
  const response = await openai.responses.create({
    model,
    temperature: 0.4,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              "You write publication-ready social carousel slides.",
              "Return only JSON that matches schema.",
              "Write in the same language as topic.",
              "Every slide must be a complete micro-idea with real value.",
              "One slide = one finished thought. No fragments, no hanging endings.",
              "Avoid filler and fake expertise.",
              "Do not produce abstract textbook language. Write as a practical social post.",
              "Write as publication-ready Instagram carousel copy: concise, high-signal, concrete.",
              `Scenario family: ${plan.scenario ?? "expert"}.`,
              "Forbidden RU filler: «в современном мире», «следует отметить», «необходимо учитывать», «данный аспект».",
              "Forbidden EN filler: «it is important to note», «in today’s world», «it should be considered».",
              "Use simple conversational phrasing, concrete causal logic and actionable clarity.",
              "Do not duplicate ideas across slides.",
              "Keep copy compact and readable for social cards (2-3 lines usually), but complete in meaning.",
              "If text is too long, rewrite it shorter instead of dropping the ending.",
              `Use exactly ${targetCount} slides in provided order with fixed role and layout.`
            ].join(" ")
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildContentPrompt(topic, brief, plan, options)
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
  const qualityBlock = brief.qualityHints.length
    ? brief.qualityHints.map((line, index) => `${index + 1}. ${line}`).join("\n")
    : "- Делай коротко, конкретно и без обрывков.";

  return [
    `Тема: ${brief.coreTopic || topic}`,
    `Количество слайдов: ${targetCount}`,
    `Аудитория: ${lens.audience}`,
    `Цель: ${lens.goal}`,
    `Тон: ${lens.tone}`,
    `Категория: ${lens.category}`,
    `Сценарий серии: ${deterministicPlan.scenario ?? "expert"}`,
    `Рекомендуемая роль-сетка: ${deterministicPlan.slides.map((slide) => slide.role).join(" -> ")}`,
    "",
    "Смысловые вводные:",
    sourceBlock || "- Раскрой тему практично и конкретно.",
    "",
    "Дополнительные структурные подсказки:",
    structureBlock,
    "",
    "Пожелания по качеству текста:",
    qualityBlock,
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

function buildContentPrompt(
  topic: string,
  brief: ParsedBrief,
  plan: CarouselPlan,
  options?: GenerationOptions
) {
  const layoutLimitsBlock = Object.entries(LAYOUT_LIMITS)
    .map(
      ([layout, limits]) =>
        `${layout}: title ${limits.titleMin}-${limits.titleMax} chars, body ${limits.bodyMin}-${limits.bodyMax} chars`
    )
    .join("\n");
  const languageHint = isMostlyEnglish(brief.coreTopic || topic)
    ? "English"
    : "Russian";
  const slideSequence = plan.slides
    .map((slide, index) =>
      [
        `#${index + 1}`,
        `role=${slide.role}`,
        `layout=${normalizeLayoutType(slide.layoutType)}`,
        `idea=${slide.coreIdea}`,
        `imageIntent=${slide.imageIntent}`,
        slide.imageQueryDraft ? `imageQueryDraft=${slide.imageQueryDraft}` : "imageQueryDraft="
      ].join(" | ")
    )
    .join("\n");
  const qualityBlock = brief.qualityHints.length
    ? brief.qualityHints.map((line, index) => `${index + 1}. ${line}`).join("\n")
    : "—";
  const internetImagesEnabled = options?.useInternetImages === true;
  const imagePolicy = internetImagesEnabled
    ? "Internet image mode is ON. Use image-enabled framing only for 1-3 slides where visual context adds meaning."
    : "Internet image mode is OFF. Keep all slides text-first and set image intent to none.";
  const rolePlaybook = [
    "cover: резкий хук через боль/конфликт, без нейтральных слов вроде «обзор/гайд».",
    "problem: где и почему теряется результат, с конкретным последствием.",
    "myth/mistake: что именно делают не так и чем это бьёт по метрике.",
    "tip/steps/checklist: прикладные шаги, которые можно сделать сегодня.",
    "case/comparison: короткий пример и вывод «что работает vs что тормозит».",
    "summary: собрать суть в одну рабочую формулу.",
    "cta: финальный призыв с конкретным действием (сохранить/написать/применить)."
  ].join("\n");
  const scenarioGuidanceById: Record<ScenarioId, string> = {
    expert:
      "Flow: hook -> core problem -> costly mistake -> practical fix -> real example -> clear CTA.",
    educational:
      "Flow: hook -> myth -> mistakes -> steps/checklist -> summary -> CTA. Teach clearly, avoid jargon.",
    commercial:
      "Flow: hook -> pain -> wrong approach -> right approach -> case -> offer/CTA. Focus on leads and measurable outcomes.",
    "case-driven":
      "Flow: hook -> context -> what was done -> concrete result -> takeaway -> CTA."
  };
  const scenarioGuidance = scenarioGuidanceById[plan.scenario ?? "expert"];

  return [
    `Topic: ${brief.coreTopic || topic}`,
    `Language: ${languageHint}`,
    `Audience: ${plan.audience}`,
    `Goal: ${plan.goal}`,
    `Tone: ${plan.tone}`,
    `Scenario: ${plan.scenario ?? "expert"}`,
    "",
    "Fixed slide sequence (strict order, do not reorder):",
    slideSequence,
    "",
    "Role playbook:",
    rolePlaybook,
    "",
    "Scenario guidance:",
    scenarioGuidance,
    "",
    "Quality hints from user brief:",
    qualityBlock,
    "",
    "Image policy:",
    imagePolicy,
    "",
    "Layout limits:",
    layoutLimitsBlock,
    "",
    "Strict writing rules:",
    "- Each slide must be self-sufficient and understandable even as a standalone card.",
    "- 1 slide = 1 complete micro-idea: claim + short explanation + practical value.",
    "- No unfinished endings. No sentence fragments.",
    "- No generic empty phrases. No pseudo-expert jargon.",
    "- Keep copy concise, but never cut meaning for brevity.",
    "- Keep each line compact: usually up to 8-10 words.",
    "- If idea is complex, compress into a clear micro-insight, not a broken draft.",
    "- Every text line must be a complete sentence.",
    "- Start each non-cover slide with concrete value, not a generic intro.",
    "- Never end a line with a conjunction/preposition (e.g., и/но/а/to/for/with).",
    "- Avoid repeating the same advice with different wording.",
    "- Keep Instagram rhythm: short hook, dense value, readable bullets, strong close.",
    "- Hook slide must create tension (pain, conflict, sharp question or costly mistake).",
    "- Final slide must close narrative with clear CTA action and one concrete next step.",
    "- For list/steps/checklist layouts, each bullet should be useful and concrete.",
    internetImagesEnabled
      ? "- Use image intent only where visual adds meaning (cover/case/comparison). Keep other slides text-first."
      : "- Keep all slide bodies self-sufficient without relying on images.",
    "- Do not add technical notes, labels like 'slide 1', or prompt echoes."
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
    "- Дай полезную конкретику, без мета-фраз и шаблонной воды.",
    "- Каждая переписанная карточка должна содержать завершённую микро-идею, не обрывок."
  ].join("\n");
}

function normalizePlan(
  rawPlan: CarouselPlan,
  fallbackPlan: CarouselPlan,
  targetCount: number,
  lens: TopicLens
): CarouselPlan {
  const scenario = isScenarioId(rawPlan.scenario) ? rawPlan.scenario : fallbackPlan.scenario ?? "expert";
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

  dedupeCoreIdeas(normalizedSlides, fallbackPlan.slides, scenario);
  enforceLayoutRhythm(normalizedSlides);
  enforceNarrativeLayoutMix(normalizedSlides);

  const maxImages = resolveImageBudget(lens, targetCount);
  limitImageUsage(
    normalizedSlides,
    maxImages,
    isTopicCategory(rawPlan.category) ? rawPlan.category : lens.category,
    scenario
  );
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
    scenario,
    slides: normalizedSlides
  };
}

function dedupeCoreIdeas(
  slides: CarouselPlanSlide[],
  fallbackSlides: CarouselPlanSlide[],
  scenario: ScenarioId = "expert"
) {
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
        fallback?.layoutType || chooseLayoutForRole(slides[right].role, "none", scenario)
      );
      slides[right].imageIntent = fallback?.imageIntent || "none";
      slides[right].imageQueryDraft = fallback?.imageQueryDraft || "";
      fingerprints.set(right, toSimilaritySet(slides[right].coreIdea));
    }
  }
}

function resolveImageBudget(lens: TopicLens, targetCount: number, allowInternetImages = true) {
  if (!allowInternetImages) {
    return 0;
  }

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
  category: TopicCategory,
  scenario: ScenarioId = "expert"
) {
  if (maxImages <= 0) {
    slides.forEach((slide) => {
      slide.imageIntent = "none";
      slide.imageQueryDraft = "";
      if (slide.layoutType === "image-top") {
        slide.layoutType = normalizeLayoutType(chooseLayoutForRole(slide.role, "none", scenario));
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
        slide.layoutType = normalizeLayoutType(chooseLayoutForRole(slide.role, "none", scenario));
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

function enforceNarrativeLayoutMix(slides: CarouselPlanSlide[]) {
  if (slides.length < 5) {
    return;
  }

  const isCoreSlide = (index: number) => index > 0 && index < slides.length - 1;
  const hasLayout = (layout: CarouselLayoutType) =>
    slides.some((slide) => normalizeLayoutType(slide.layoutType) === layout);
  const setLayoutByRole = (
    preferredRoles: CarouselSlideRole[],
    layout: CarouselLayoutType,
    guard?: (slide: CarouselPlanSlide, index: number) => boolean
  ) => {
    const candidateIndex = slides.findIndex((slide, index) => {
      if (!isCoreSlide(index)) {
        return false;
      }
      if (!preferredRoles.includes(slide.role)) {
        return false;
      }
      if (slide.layoutType === "image-top") {
        return false;
      }
      if (guard && !guard(slide, index)) {
        return false;
      }
      return true;
    });

    if (candidateIndex !== -1) {
      slides[candidateIndex].layoutType = layout;
    }
  };

  if (!hasLayout("statement")) {
    setLayoutByRole(["problem", "mistake", "myth"], "statement");
  }

  if (!hasLayout("list")) {
    setLayoutByRole(["steps", "checklist", "tip"], "list");
  }

  if (!hasLayout("split")) {
    setLayoutByRole(["case", "comparison", "myth", "mistake"], "split");
  }

  if (!hasLayout("card")) {
    setLayoutByRole(["tip", "summary", "case"], "card");
  }

  if (!hasLayout("hero")) {
    const coverIndex = slides.findIndex((slide) => slide.role === "cover");
    if (coverIndex >= 0 && slides[coverIndex].imageIntent === "none") {
      slides[coverIndex].layoutType = "hero";
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
    if (isWeakHookTitle(normalized[0].title)) {
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
    if (!CTA_ACTION_PATTERN.test(lastSlide.text)) {
      const useEnglish = isMostlyEnglish(topic);
      const keyword = buildActionKeyword(topic, useEnglish);
      const ctaPadding = useEnglish
        ? `Write "${keyword}" in DM to get the ready template.\nSave this carousel and apply one step today.`
        : `Напишите в директ «${keyword}» — отправлю готовый шаблон.\nСохраните карусель и внедрите один шаг сегодня.`;
      lastSlide.text = fitSlideTextToLayout(
        lastSlide.title,
        ctaPadding,
        "cta",
        "cta",
        lastSlide.coreIdea ?? topic
      ).body;
    }
  }

  return normalized;
}

function isWeakHookTitle(value: string) {
  return /^(сравнение|обзор|гайд|guide|summary|чек-?лист|подборка|как\b)/i.test(value.trim());
}

function buildHookTitle(topic: string) {
  const basis = clean(topic).replace(/\s+/g, " ").trim();
  if (!basis) {
    return "Вы теряете результат и даже не замечаете";
  }

  const useEnglish = isMostlyEnglish(basis);
  const topicNucleus = basis
    .replace(/^\d+\s+/i, "")
    .replace(/^как\s+/i, "")
    .replace(/^почему\s+/i, "")
    .replace(/[«»"]/g, " ")
    .replace(/[,:;!?]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  let compactTopic = clampSentenceByWords(topicNucleus, 6)
    .replace(/[.!?…]+$/g, "")
    .trim();
  compactTopic = stripHangingEnding(compactTopic) || compactTopic;
  compactTopic = compactTopic
    .replace(/(?:^|\s)(вам|тебе|мне|нам|you|your|which|that|котор[а-яё]*)\s*$/i, "")
    .trim();
  if (/(котор[а-яё]*|which|that)/i.test(compactTopic) || /(?:^|\s)(не|without)\s*$/i.test(compactTopic)) {
    compactTopic = useEnglish ? "your content system" : "ваш контент";
  }
  if (countWords(compactTopic) < 2) {
    compactTopic = useEnglish ? "this topic" : "эта тема";
  }
  const variant =
    useEnglish
      ? HOOK_TITLE_PREFIXES_EN[Math.abs(stableHash(`${basis}|hook-en`)) % HOOK_TITLE_PREFIXES_EN.length]
      : HOOK_TITLE_PREFIXES[Math.abs(stableHash(`${basis}|hook`)) % HOOK_TITLE_PREFIXES.length];
  const title = variant.includes("%topic%")
    ? variant.replace("%topic%", compactTopic)
    : `${variant} ${compactTopic}`.trim();

  return clampTitle(title.replace(/\s{2,}/g, " "), 72);
}

function isMostlyEnglish(value: string) {
  const latin = (value.match(/[a-z]/gi) ?? []).length;
  const cyrillic = (value.match(/[а-яё]/gi) ?? []).length;
  return latin > 0 && latin >= cyrillic;
}

function isHookLikeTitle(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("?")) {
    return true;
  }

  return /(почему|ошибк|теря|слива|тормоз|буксу|не\s+раст|не\s+работ|провал|риск|цена\s+ошибки)/i.test(
    normalized
  );
}

function isIncompleteTitle(value: string) {
  const leftAngleQuotes = (value.match(/«/g) ?? []).length;
  const rightAngleQuotes = (value.match(/»/g) ?? []).length;
  const straightQuotes = (value.match(/"/g) ?? []).length;
  if (leftAngleQuotes !== rightAngleQuotes || straightQuotes % 2 === 1) {
    return true;
  }

  const normalized = value
    .replace(/[.!?…]+$/g, "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return true;
  }

  if (/[-–—]\s*$/.test(normalized)) {
    return true;
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  const lastWord = words.at(-1) ?? "";
  if (
    words.length >= 6 &&
    /(ый|ий|ой|ая|ое|ые|ого|ему|ым|ую|able|ive|al|ful|less)$/i.test(lastWord)
  ) {
    return true;
  }

  return /\b(?:to|for|with|from|of|in|on|at|by|and|or|as|while|when|if|because|because of|из-за|для|при|как|когда|если|потому|чтобы|и|или|а)\s*$/i.test(
    normalized
  );
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
  const topicIsEnglish = isMostlyEnglish(topic);

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

    if (hasWeakCopy(merged)) {
      problematic.add(index);
      score -= 5;
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

    if (index > 0 && index < slides.length - 1 && !STRUCTURED_LAYOUTS.has(layout) && bodyWords < 8) {
      problematic.add(index);
      score -= 4;
    }

    if (
      index > 0 &&
      index < slides.length - 1 &&
      !STRUCTURED_LAYOUTS.has(layout) &&
      layout !== "cta" &&
      lineCount < 2
    ) {
      problematic.add(index);
      score -= 4;
    }

    const tooLongLines = text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => countWords(line) > wordLimits.lineWords + 3).length;
    if (tooLongLines >= 2) {
      problematic.add(index);
      score -= 4;
    }

    const bodyLines = text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (
      index > 0 &&
      index < slides.length - 1 &&
      bodyLines.some((line) => countWords(line) < 4) &&
      !STRUCTURED_LAYOUTS.has(layout)
    ) {
      problematic.add(index);
      score -= 3;
    }
    if (bodyLines.some((line) => hasHangingEnding(line))) {
      problematic.add(index);
      score -= 5;
    }

    if (STRUCTURED_LAYOUTS.has(layout)) {
      const bulletLines = text
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => /^([•\-]|\d+\.)/.test(line)).length;
      if (bulletLines < 3) {
        problematic.add(index);
        score -= 4;
      }
    }

    if ((planSlide?.role ?? slide.role) === "cta") {
      const hasActionVerb = CTA_ACTION_PATTERN.test(text);
      if (!hasActionVerb) {
        problematic.add(index);
        score -= 5;
      }
    }

    if (index === 0 && !isHookLikeTitle(title)) {
      problematic.add(index);
      score -= 4;
    }

    if (
      !topicIsEnglish &&
      /\b[a-z]{4,}\b/i.test(merged) &&
      !/(cta|instagram|stories|reels)/i.test(merged)
    ) {
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

function pickCriticalRepairIndexes(
  slides: CarouselOutlineSlide[],
  problematicIndexes: number[]
) {
  if (!problematicIndexes.length) {
    return [];
  }

  const maxRepairs = Math.max(2, Math.min(4, Math.ceil(slides.length * 0.4)));
  const scored = problematicIndexes
    .map((index) => {
      const slide = slides[index];
      if (!slide) {
        return { index, severity: 0 };
      }

      const title = clean(slide.title || "");
      const text = clean(slide.text || "");
      let severity = 0;

      if (!title || !text) {
        severity += 10;
      }

      if (hasMetaEcho(`${title}\n${text}`)) {
        severity += 8;
      }

      if (hasWeakCopy(`${title}\n${text}`)) {
        severity += 4;
      }

      if (hasHangingEnding(text)) {
        severity += 4;
      }

      if (index === 0 && !isHookLikeTitle(title)) {
        severity += 7;
      }

      if (index === slides.length - 1 && !CTA_ACTION_PATTERN.test(text)) {
        severity += 7;
      }

      const prev = slides[index - 1];
      if (prev) {
        const prevTitle = clean(prev.title || "");
        const prevText = clean(prev.text || "");
        if (
          semanticSimilarity(title, prevTitle) > 0.84 ||
          semanticSimilarity(`${title} ${text}`, `${prevTitle} ${prevText}`) > 0.83
        ) {
          severity += 8;
        }
      }

      return { index, severity };
    })
    .sort((left, right) => right.severity - left.severity);

  const selected = scored
    .filter((item) => item.severity >= 4)
    .slice(0, maxRepairs)
    .map((item) => item.index);

  return Array.from(new Set(selected)).sort((left, right) => left - right);
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

function polishSlidesForPublishability(
  topic: string,
  slides: CarouselOutlineSlide[],
  plan: CarouselPlan,
  brief: ParsedBrief,
  totalSlides: number
) {
  const polished = slides.map((slide, index) => {
    const planSlide =
      plan.slides[index] ??
      buildFallbackPlanSlide(
        topic,
        index === 0 ? "cover" : index === totalSlides - 1 ? "cta" : "tip",
        index,
        totalSlides,
        inferTopicLens(topic, brief.sourceIdeas),
        brief.sourceIdeas
      );

    const normalizedTitle = normalizeTitle(
      removeMetaLines(String(slide.title ?? "")),
      topic,
      planSlide,
      index,
      totalSlides
    );
    const normalizedBody = normalizeBody(removeMetaLines(String(slide.text ?? "")), normalizedTitle);
    const fallbackBody = buildFallbackBody(planSlide, topic, index, totalSlides, brief);
    const preparedBody = isWeakBodyText(normalizedBody, index > 0 && index < totalSlides - 1)
      ? fallbackBody
      : normalizedBody;
    const fitted = fitSlideTextToLayout(
      normalizedTitle,
      preparedBody,
      planSlide.layoutType,
      planSlide.role,
      planSlide.coreIdea
    );

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

  for (let left = 0; left < polished.length; left += 1) {
    for (let right = left + 1; right < polished.length; right += 1) {
      const leftSlide = polished[left];
      const rightSlide = polished[right];
      if (!leftSlide || !rightSlide || right === polished.length - 1) {
        continue;
      }

      const similarity = semanticSimilarity(
        `${leftSlide.title} ${leftSlide.text}`,
        `${rightSlide.title} ${rightSlide.text}`
      );
      if (similarity < 0.74) {
        continue;
      }

      const replacementPlanSlide =
        plan.slides[right] ??
        buildFallbackPlanSlide(
          topic,
          right === 0 ? "cover" : right === totalSlides - 1 ? "cta" : "tip",
          right,
          totalSlides,
          inferTopicLens(topic, brief.sourceIdeas),
          brief.sourceIdeas
        );
      const replacementTitle = buildFallbackTitle(replacementPlanSlide, topic, right, totalSlides);
      const replacementBody = buildFallbackBody(
        replacementPlanSlide,
        topic,
        right,
        totalSlides,
        brief
      );
      const fitted = fitSlideTextToLayout(
        replacementTitle,
        replacementBody,
        replacementPlanSlide.layoutType,
        replacementPlanSlide.role,
        replacementPlanSlide.coreIdea
      );
      polished[right] = {
        ...rightSlide,
        title: fitted.title,
        text: fitted.body,
        role: replacementPlanSlide.role,
        coreIdea: replacementPlanSlide.coreIdea,
        layoutType: normalizeLayoutType(replacementPlanSlide.layoutType),
        imageIntent: replacementPlanSlide.imageIntent,
        imageQueryDraft: replacementPlanSlide.imageQueryDraft,
        templateId: replacementPlanSlide.templateId
      };
    }
  }

  const lastIndex = polished.length - 1;
  const last = polished[lastIndex];
  if (last && !CTA_ACTION_PATTERN.test(last.text)) {
    const useEnglish = isMostlyEnglish(topic);
    const keyword = buildActionKeyword(topic, useEnglish);
    const ctaPadding = useEnglish
      ? `Write "${keyword}" in DM to get the ready framework.\nSave this carousel and apply one step today.`
      : `Напишите в директ «${keyword}» — отправлю готовую структуру.\nСохраните карусель и внедрите один шаг сегодня.`;
    const planSlide = plan.slides[lastIndex];
    if (planSlide) {
      const fitted = fitSlideTextToLayout(
        last.title,
        ctaPadding,
        "cta",
        "cta",
        planSlide.coreIdea
      );
      polished[lastIndex] = {
        ...last,
        title: fitted.title,
        text: fitted.body,
        role: "cta",
        layoutType: "cta",
        imageIntent: "none",
        imageQueryDraft: ""
      };
    }
  }

  return polished;
}

function buildDeterministicFallbackSlides(
  topic: string,
  plan: CarouselPlan,
  brief: ParsedBrief,
  targetCount: number
) {
  const drafts = buildDraftSlidesFromPlan(plan, brief, targetCount);
  const normalized = normalizeSlides(topic, drafts, plan, targetCount, brief);
  return polishSlidesForPublishability(topic, normalized, plan, brief, targetCount);
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
  brief: ParsedBrief,
  options?: GenerationOptions
): CarouselPlan {
  const scenario = chooseScenarioId(topic, lens, brief);
  const roles = buildRoleSequence(targetCount, scenario);
  const seeds = brief.sourceIdeas.length ? brief.sourceIdeas : [topic];
  const family = chooseTemplateFamily(lens, topic);
  const allowInternetImages = options?.useInternetImages === true;

  const slides = roles.map((role, index) => {
    const planSlide = buildFallbackPlanSlide(
      topic,
      role,
      index,
      targetCount,
      lens,
      seeds,
      family,
      scenario,
      allowInternetImages
    );
    return planSlide;
  });

  const maxImages = resolveImageBudget(lens, targetCount, allowInternetImages);
  limitImageUsage(slides, maxImages, lens.category, scenario);
  enforceLayoutRhythm(slides);
  enforceNarrativeLayoutMix(slides);

  return {
    topic,
    audience: lens.audience,
    goal: lens.goal,
    tone: lens.tone,
    category: lens.category,
    scenario,
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
  family?: TemplateFamilyId,
  scenario: ScenarioId = "expert",
  allowInternetImages = true
): CarouselPlanSlide {
  const seed = pickSeedLine(seeds, index, topic);
  const coreIdea = buildCoreIdea(role, seed, topic, index, totalSlides);
  const imageIntent = chooseImageIntent(role, lens, index, totalSlides, allowInternetImages);
  const layoutType = chooseLayoutForRole(role, imageIntent, scenario);
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

function chooseScenarioId(topic: string, lens: TopicLens, brief: ParsedBrief): ScenarioId {
  const merged = `${topic} ${brief.sourceIdeas.join(" ")} ${brief.structureHints.join(" ")}`.toLowerCase();

  if (/(кейс|пример|разбор|реальный случай|case study|case\b|example\b)/i.test(merged)) {
    return "case-driven";
  }

  if (
    lens.category === "marketing-sales" ||
    /(лид|лиды|заявк|директ|продаж|конверси|воронк|оффер|sales|conversion|leads)/i.test(merged)
  ) {
    return "commercial";
  }

  if (
    lens.category === "how-to" ||
    lens.category === "education-visual" ||
    /(инструкц|чек-?лист|пошаг|как\s+сделать|how to|checklist|guide|ошибк|миф)/i.test(merged)
  ) {
    return "educational";
  }

  return "expert";
}

function compressRoleSequence(base: CarouselSlideRole[], targetCount: number): CarouselSlideRole[] {
  if (targetCount <= 2) {
    return (["cover", "cta"] as CarouselSlideRole[]).slice(0, targetCount);
  }

  const interior = base.slice(1, -1);
  const interiorNeeded = Math.max(0, targetCount - 2);
  const pickedIndexes: number[] = [];

  for (let slot = 0; slot < interiorNeeded; slot += 1) {
    const ratio = interiorNeeded === 1 ? 0 : slot / (interiorNeeded - 1);
    const candidate = Math.round(ratio * Math.max(0, interior.length - 1));
    let resolved = candidate;

    while (pickedIndexes.includes(resolved) && resolved < interior.length - 1) {
      resolved += 1;
    }

    while (pickedIndexes.includes(resolved) && resolved > 0) {
      resolved -= 1;
    }

    pickedIndexes.push(resolved);
  }

  const sequence: CarouselSlideRole[] = [
    base[0],
    ...pickedIndexes.map((index) => interior[Math.max(0, Math.min(index, interior.length - 1))]),
    base[base.length - 1]
  ];

  sequence[0] = "cover";
  sequence[sequence.length - 1] = "cta";
  return sequence;
}

function buildRoleSequence(targetCount: number, scenario: ScenarioId = "expert"): CarouselSlideRole[] {
  const canonical = SCENARIO_ROLE_TEMPLATES[scenario] ?? SCENARIO_ROLE_TEMPLATES.expert;

  if (targetCount === canonical.length) {
    return [...canonical];
  }

  if (targetCount < canonical.length) {
    return compressRoleSequence(canonical, targetCount);
  }

  const expanded = [...canonical];
  const extras = SCENARIO_EXTRA_ROLES[scenario] ?? SCENARIO_EXTRA_ROLES.expert;
  while (expanded.length < targetCount) {
    expanded.splice(
      expanded.length - 1,
      0,
      extras[(expanded.length - canonical.length) % extras.length]
    );
  }

  expanded[0] = "cover";
  expanded[expanded.length - 1] = "cta";
  return expanded.slice(0, targetCount);
}

function chooseLayoutForRole(
  role: CarouselSlideRole,
  imageIntent: CarouselImageIntent,
  scenario: ScenarioId = "expert"
): CarouselLayoutType {
  if (imageIntent !== "none" && (role === "cover" || role === "problem" || role === "case" || role === "comparison")) {
    return "image-top";
  }

  if (role === "cover") {
    return "hero";
  }

  if (role === "problem") {
    return scenario === "commercial" ? "dark-slide" : "statement";
  }

  if (role === "myth") {
    return scenario === "educational" ? "split" : "statement";
  }

  if (role === "mistake") {
    return scenario === "commercial" ? "statement" : "list";
  }

  if (role === "tip") {
    return scenario === "educational" ? "list" : "card";
  }

  if (role === "steps") {
    return "list";
  }

  if (role === "checklist") {
    return "list";
  }

  if (role === "case") {
    return scenario === "case-driven" ? "split" : "card";
  }

  if (role === "comparison") {
    return "split";
  }

  if (role === "summary") {
    return scenario === "commercial" ? "statement" : "split";
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
  totalSlides: number,
  allowInternetImages = true
): CarouselImageIntent {
  if (!allowInternetImages) {
    return "none";
  }

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
  const topicClean = clean(topic).slice(0, 140) || "теме";
  const seedClean = clean(seed).slice(0, 140);
  const seedUseful = seedClean && seedClean.toLowerCase() !== topicClean.toLowerCase() ? seedClean : "";
  const focus = seedUseful || topicClean;
  const useEnglish = isMostlyEnglish(`${topicClean} ${focus}`);

  if (useEnglish) {
    if (role === "cover") {
      return `Core conflict in ${focus}: effort is high, outcomes stay unstable`;
    }
    if (role === "problem") {
      return index <= 1
        ? `Where ${focus} breaks in practice and why users lose value`
        : `What happens if ${focus} stays unresolved this quarter`;
    }
    if (role === "myth") {
      return `Popular myth in ${focus} that creates false confidence`;
    }
    if (role === "mistake") {
      return `Critical mistake in ${focus} that quietly kills momentum`;
    }
    if (role === "tip") {
      return `Practical tactic for ${focus} that gives measurable progress`;
    }
    if (role === "steps") {
      return `Action plan: 3-5 steps to execute ${focus} without chaos`;
    }
    if (role === "checklist") {
      return `Checklist before launch: what must be true in ${focus}`;
    }
    if (role === "case") {
      return `Short case: specific move that improved ${focus}`;
    }
    if (role === "comparison") {
      return `Comparison: high-leverage approach vs low-impact routine in ${focus}`;
    }
    if (role === "summary") {
      return `Key principle behind sustainable progress in ${focus}`;
    }
    if (index === totalSlides - 1) {
      return `CTA: the first concrete move to make in ${focus} today`;
    }
    return `Practical insight that improves ${focus}`;
  }

  if (role === "cover") {
    return `Главный конфликт в теме «${focus}»: усилия есть, результат нестабилен`;
  }
  if (role === "problem") {
    return index <= 1
      ? `Где именно в теме «${focus}» теряется результат и почему это критично`
      : `Что будет, если проблему в теме «${focus}» не исправить сейчас`;
  }
  if (role === "myth") {
    return `Популярный миф в теме «${focus}», который даёт ложную уверенность`;
  }
  if (role === "mistake") {
    return `Критичная ошибка в теме «${focus}», которая съедает прогресс`;
  }
  if (role === "tip") {
    return `Практический приём в теме «${focus}», который даёт измеримый сдвиг`;
  }
  if (role === "steps") {
    return `План действий: 3-5 шагов, чтобы внедрить решение по теме «${focus}»`;
  }
  if (role === "checklist") {
    return `Чеклист перед запуском: что обязательно проверить в теме «${focus}»`;
  }
  if (role === "case") {
    return `Короткий кейс: какое действие дало результат в теме «${focus}»`;
  }
  if (role === "comparison") {
    return `Сравнение: рабочий подход и путь, который тормозит результат в теме «${focus}»`;
  }
  if (role === "summary") {
    return `Ключевой принцип устойчивого результата в теме «${focus}»`;
  }
  if (index === totalSlides - 1) {
    return `CTA: что сделать прямо сейчас по теме «${focus}»`;
  }
  return `Практический тезис по теме «${focus}»`;
}

function isTemplateCoreIdea(value: string) {
  return /^(хук|проблема|усиление|миф|ошибка|объяснение|решение|план действий|чеклист|кейс|сравнение|вывод|cta)\s*:/i.test(
    value
  ) || /по\s+теме\s+«.+»/i.test(value);
}

function buildFallbackTitle(
  planSlide: CarouselPlanSlide | undefined,
  topic: string,
  index: number,
  totalSlides: number
): string {
  const useEnglish = isMostlyEnglish(topic);
  const fallbackByRoleRu: Record<CarouselSlideRole, string> = {
    cover: "Вы теряете результат и даже не замечаете",
    problem: "Почему это не работает",
    myth: "Миф, который мешает результату",
    mistake: "Ошибка, которая всё ломает",
    tip: "Что сделать прямо сейчас",
    steps: "Пошаговый план действий",
    checklist: "Чеклист перед запуском",
    case: "Кейс из практики",
    comparison: "Как правильно и как не надо",
    summary: "Ключевой вывод",
    cta: "Закрепите результат сегодня"
  };
  const fallbackByRoleEn: Record<CarouselSlideRole, string> = {
    cover: "You're losing results without noticing",
    problem: "Why this doesn't work",
    myth: "Myth that blocks your result",
    mistake: "Mistake that breaks performance",
    tip: "Action you can take today",
    steps: "Step-by-step plan",
    checklist: "Pre-launch checklist",
    case: "Real case snapshot",
    comparison: "What to do vs avoid",
    summary: "Key takeaway",
    cta: "Take the first step today"
  };
  const fallbackByRole = useEnglish ? fallbackByRoleEn : fallbackByRoleRu;

  if (!planSlide) {
    if (index === 0) {
      return useEnglish ? "Main idea you should not miss" : "Главная мысль по теме";
    }
    if (index === totalSlides - 1) {
      return useEnglish ? "What to do next" : "Что делать дальше";
    }
    return useEnglish ? "Key practical point" : "Ключевой рабочий тезис";
  }

  const rawIdea = clean(planSlide.coreIdea);
  const idea = rawIdea && !isTemplateCoreIdea(rawIdea) ? rawIdea : "";
  if (planSlide.role === "cover" && (!idea || isWeakHookTitle(idea))) {
    return buildHookTitle(topic);
  }

  const compactIdea = clampTitle(idea.replace(/^[^:]+:\s*/, ""), 76);
  const ideaWords = countWords(compactIdea);
  const canUseIdeaAsTitle =
    compactIdea &&
    ideaWords >= 3 &&
    ideaWords <= 10 &&
    !/[,:;]/.test(compactIdea) &&
    !isIncompleteTitle(compactIdea);
  const basis = canUseIdeaAsTitle
    ? compactIdea
    : fallbackByRole[planSlide.role] || fallbackByRole.tip;
  const maxLength = LAYOUT_LIMITS[normalizeLayoutType(planSlide.layoutType)].titleMax;
  const fitted = clampTitle(basis, maxLength);
  if (!isIncompleteTitle(fitted)) {
    return fitted;
  }

  return clampTitle(fallbackByRole[planSlide.role] || fallbackByRole.tip, maxLength);
}

function buildRoleFallbackTitle(role: CarouselSlideRole, coreIdea: string) {
  const useEnglish = isMostlyEnglish(coreIdea);
  const ru: Record<CarouselSlideRole, string> = {
    cover: "Где сливается результат и как это остановить",
    problem: "Где теряется результат",
    myth: "Миф, который мешает",
    mistake: "Ошибка, которая тормозит рост",
    tip: "Что реально работает",
    steps: "Пошаговый план",
    checklist: "Короткий чеклист",
    case: "Кейс из практики",
    comparison: "Что работает vs что тормозит",
    summary: "Главный вывод",
    cta: "Что сделать сейчас"
  };
  const en: Record<CarouselSlideRole, string> = {
    cover: "Where results leak and how to fix it",
    problem: "Where results leak",
    myth: "Myth that blocks progress",
    mistake: "Costly mistake to fix first",
    tip: "What actually works",
    steps: "Step-by-step plan",
    checklist: "Quick checklist",
    case: "Short case snapshot",
    comparison: "What works vs what stalls",
    summary: "Key takeaway",
    cta: "What to do now"
  };

  return (useEnglish ? en[role] : ru[role]) || (useEnglish ? "Key point" : "Ключевой тезис");
}

function buildFallbackBody(
  planSlide: CarouselPlanSlide | undefined,
  topic: string,
  index: number,
  totalSlides: number,
  brief: ParsedBrief
) {
  const useEnglish = isMostlyEnglish(`${topic} ${planSlide?.coreIdea ?? ""}`);
  const role = planSlide?.role ?? (index === 0 ? "cover" : index === totalSlides - 1 ? "cta" : "tip");
  const coreIdea = planSlide?.coreIdea ?? pickSeedLine(brief.sourceIdeas, index, topic);
  const shortIdea = summarizeCoreIdea(coreIdea, useEnglish);
  const ctaKeyword = buildActionKeyword(topic, useEnglish);

  if (role === "cover") {
    return useEnglish
      ? [
          "You're doing the work, but results still leak between steps.",
          "Swipe: we turn this topic into a practical lead-ready system."
        ].join("\n")
      : [
          "Действия есть, но результат всё равно утекает между шагами.",
          "Листайте: соберём тему в систему, которая приводит к заявкам."
        ].join("\n");
  }

  if (role === "problem") {
    return useEnglish
      ? [`Problem: ${shortIdea}.`, "You post regularly, but users still don't make a clear next move."].join("\n")
      : [`Проблема: ${shortIdea}.`, "Контент выходит регулярно, но люди не понимают следующий шаг."].join("\n");
  }

  if (role === "myth") {
    return useEnglish
      ? [`Myth: ${shortIdea}.`, "It sounds right, but in real funnels this kills conversion speed."].join("\n")
      : [`Миф: ${shortIdea}.`, "Звучит логично, но в реальной воронке замедляет конверсию."].join("\n");
  }

  if (role === "mistake") {
    return useEnglish
      ? [`Mistake: ${shortIdea}.`, "You show features instead of client pain, so trust never forms."].join("\n")
      : [`Ошибка: ${shortIdea}.`, "Вы показываете витрину, а не боль клиента — доверие не формируется."].join("\n");
  }

  if (role === "tip") {
    return useEnglish
      ? [
          `• Focus on this move: ${shortIdea}.`,
          "• Replace one weak block with a concrete client-facing insight.",
          "• Measure replies or lead quality within a week."
        ].join("\n")
      : [
          `• Фокус: ${shortIdea}.`,
          "• Замените один слабый блок на конкретный инсайт для клиента.",
          "• Через неделю проверьте ответы и качество входящих."
        ].join("\n");
  }

  if (role === "steps") {
    return useEnglish
      ? [
          "1. Start with one painful client question.",
          `2. Show your working mechanic: ${shortIdea}.`,
          "3. Close the slide with one explicit next action."
        ].join("\n")
      : [
          "1. Возьмите один болезненный вопрос клиента.",
          `2. Покажите рабочую механику: ${shortIdea}.`,
          "3. Закройте слайд конкретным следующим действием."
        ].join("\n");
  }

  if (role === "checklist") {
    return useEnglish
      ? [
          "• One clear message per slide.",
          "• One concrete proof or mechanism.",
          "• One useful takeaway for the reader.",
          "• One direct CTA at the end."
        ].join("\n")
      : [
          "• Одна чёткая мысль на слайд.",
          "• Один конкретный механизм или доказательство.",
          "• Один полезный вывод для читателя.",
          "• Один прямой CTA в финале."
        ].join("\n");
  }

  if (role === "case") {
    return useEnglish
      ? [
          `Case: ${shortIdea}.`,
          "After switching to pain-led slides, inbound messages became predictable."
        ].join("\n")
      : [
          `Кейс: ${shortIdea}.`,
          "После перехода на контент через боли входящие запросы стали регулярными."
        ].join("\n");
  }

  if (role === "comparison") {
    return useEnglish
      ? [
          "• Weak path: generic claims without client context.",
          "• Strong path: concrete pain, concrete mechanism, concrete result."
        ].join("\n")
      : [
          "• Слабый путь: общие заявления без контекста клиента.",
          "• Сильный путь: боль, рабочая механика и конкретный результат."
        ].join("\n");
  }

  if (role === "summary") {
    return useEnglish
      ? [`Summary: ${shortIdea}.`, "Less noise, more role-based slides, stronger trust and better conversion."].join("\n")
      : [`Итог: ${shortIdea}.`, "Меньше шума, больше ролевых слайдов, выше доверие и конверсия."].join("\n");
  }

  return useEnglish
    ? [
        `Write "${ctaKeyword}" in DM — I'll send the ready-to-use structure.`,
        "Save this carousel so you can reuse the framework today."
      ].join("\n")
    : [
        `Напишите в директ «${ctaKeyword}» — отправлю готовую структуру под вашу тему.`,
        "Сохраните карусель, чтобы не потерять рабочий сценарий."
      ].join("\n");
}

function buildActionKeyword(source: string, useEnglish: boolean) {
  const tokens = clean(source)
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => token.length >= 4)
    .filter((token) => !SEARCH_STOP_WORDS.has(token.toLowerCase()));

  const preferred = tokens[0] ?? (useEnglish ? "SYSTEM" : "СИСТЕМА");
  const normalized = preferred
    .replace(/[^a-zа-яё0-9]/giu, "")
    .slice(0, 14);

  if (!normalized) {
    return useEnglish ? "SYSTEM" : "СИСТЕМА";
  }

  return normalized.toLocaleUpperCase(useEnglish ? "en-US" : "ru-RU");
}

function summarizeCoreIdea(coreIdea: string, useEnglish: boolean) {
  const normalized = tidyLineEnding(clean(coreIdea).replace(/^[^:]+:\s*/, "").replace(/[«»"]/g, ""));
  const compact = stripHangingEnding(clampSentenceByWords(normalized, 9)).replace(/[.!?…]+$/g, "").trim();
  if (countWords(compact) >= 3) {
    return compact;
  }

  return useEnglish ? "this topic" : "этот фокус";
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
  let fittedTitle = clampTitle(title, limits.titleMax);
  if (countWords(fittedTitle) > wordLimits.titleWords + 2) {
    fittedTitle = clampSentenceByWords(fittedTitle, wordLimits.titleWords + 2);
  }
  if (isIncompleteTitle(fittedTitle) || countWords(fittedTitle) < 3) {
    fittedTitle = buildRoleFallbackTitle(role, coreIdea);
  }
  fittedTitle = clampTitle(fittedTitle, limits.titleMax);

  let preparedBody = ensureMicroIdeaBody(body, role, coreIdea, resolvedLayout);
  if (STRUCTURED_LAYOUTS.has(resolvedLayout)) {
    preparedBody = toStructuredBody(preparedBody, resolvedLayout, role, coreIdea, wordLimits.lineWords);
  } else {
    preparedBody = toCompactBody(preparedBody, wordLimits.bodyWords, wordLimits.lineWords, limits.preferredLinesMax);
  }

  preparedBody = clampBody(preparedBody, limits.bodyMax);

  if (preparedBody.length < Math.max(16, limits.bodyMin - 28)) {
    const expanded = `${preparedBody}\n${buildBodyPadding(role, coreIdea)}`.trim();
    const compactExpanded = STRUCTURED_LAYOUTS.has(resolvedLayout)
      ? toStructuredBody(expanded, resolvedLayout, role, coreIdea, wordLimits.lineWords)
      : toCompactBody(expanded, wordLimits.bodyWords, wordLimits.lineWords, limits.preferredLinesMax);
    preparedBody = clampBody(compactExpanded, limits.bodyMax);
  }

  let normalizedLines = preparedBody
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, limits.preferredLinesMax)
    .map((line) =>
      STRUCTURED_LAYOUTS.has(resolvedLayout)
        ? tidyLineEnding(clampSentence(stripHangingEnding(line), 120))
        : ensureLineClosure(line)
    )
    .map((line) => capitalizeLineStart(line))
    .filter(Boolean)
    .join("\n");

  if (!STRUCTURED_LAYOUTS.has(resolvedLayout) && hasBrokenBodyStructure(normalizedLines)) {
    const recoveryBody = toCompactBody(
      `${buildBodyPadding(role, coreIdea)} ${buildMicroConclusion(role, coreIdea)}`,
      wordLimits.bodyWords,
      wordLimits.lineWords,
      limits.preferredLinesMax
    );
    const recoveredLines = recoveryBody
      .split(/\n+/)
      .map((line) => ensureLineClosure(line))
      .filter(Boolean)
      .slice(0, limits.preferredLinesMax)
      .join("\n");
    if (recoveredLines) {
      normalizedLines = recoveredLines;
    }
  }

  if (
    role !== "cover" &&
    role !== "cta" &&
    !STRUCTURED_LAYOUTS.has(resolvedLayout)
  ) {
    const lines = normalizedLines
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      const support = ensureLineClosure(buildMicroConclusion(role, coreIdea));
      if (support && support !== lines[0]) {
        normalizedLines = [lines[0], support]
          .filter(Boolean)
          .slice(0, limits.preferredLinesMax)
          .join("\n");
      }
    }
  }

  if (role === "cta" && !CTA_ACTION_PATTERN.test(normalizedLines)) {
    const useEnglish = isMostlyEnglish(coreIdea);
    const keyword = buildActionKeyword(coreIdea, useEnglish);
    normalizedLines = useEnglish
      ? `Write "${keyword}" in DM to get the practical framework.\nSave this carousel and apply one step today.`
      : `Напишите в директ «${keyword}» — отправлю практичный шаблон.\nСохраните карусель и внедрите один шаг сегодня.`;
  }

  return {
    title: fittedTitle,
    body: normalizedLines
  };
}

function ensureMicroIdeaBody(
  body: string,
  role: CarouselSlideRole,
  coreIdea: string,
  layoutType: CarouselLayoutType
) {
  const normalizedLayout = normalizeLayoutType(layoutType);
  if (STRUCTURED_LAYOUTS.has(normalizedLayout)) {
    return body;
  }

  const rawLines = extractBodyLines(body)
    .map((line) => line.replace(/^([•\-]|\d+\.)\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
  const nextLines = rawLines.length ? [...rawLines] : [buildBodyPadding(role, coreIdea)];

  if (hasWeakCopy(nextLines.join(" "))) {
    nextLines[0] = buildBodyPadding(role, coreIdea);
  }

  const lastIndex = nextLines.length - 1;
  if (lastIndex >= 0 && hasHangingEnding(nextLines[lastIndex])) {
    const stripped = stripHangingEnding(nextLines[lastIndex]);
    nextLines[lastIndex] = stripped ? `${stripped}.` : buildBodyPadding(role, coreIdea);
  }

  if (role === "cta" && !CTA_ACTION_PATTERN.test(nextLines.join(" "))) {
    nextLines[lastIndex] = isMostlyEnglish(coreIdea)
      ? "Save this carousel and apply the first step today."
      : "Сохраните карусель и внедрите первый шаг сегодня.";
  }

  const deduped = Array.from(
    new Set(
      nextLines.map((line) => {
        let normalized = clean(line).replace(/\.+$/g, "").trim();
        if (hasHangingEnding(normalized)) {
          normalized = stripHangingEnding(normalized);
        }
        return normalized;
      })
    )
  )
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, lineIndex) => {
      if (countWords(line) < 2) {
        return buildBodyPadding(role, coreIdea);
      }
      if (FRAGMENT_START_PATTERN.test(line)) {
        return lineIndex === 0
          ? buildBodyPadding(role, coreIdea)
          : buildMicroConclusion(role, coreIdea);
      }
      return line;
    })
    .slice(0, 3);

  const finalized = Array.from(
    new Set(
      deduped
        .map((line) => tidyLineEnding(line))
        .filter(Boolean)
    )
  );
  if (!finalized.length) {
    finalized.push(buildBodyPadding(role, coreIdea));
  }

  return finalized.slice(0, 3).join("\n");
}

function toStructuredBody(
  body: string,
  layoutType: CarouselLayoutType,
  role: CarouselSlideRole,
  coreIdea: string,
  lineWords: number
) {
  const lines = extractBodyLines(body);
  const normalizedLines = lines.flatMap((line) => splitInlineBullets(line));
  const safeLines = normalizedLines.length ? normalizedLines : extractBodyLines(coreIdea);
  const fallbackLines = buildStructuredFallbackLines(role, coreIdea);
  const minLines = layoutType === "steps" || layoutType === "checklist" ? 3 : 2;
  const targetLines = Math.max(minLines, Math.min(4, safeLines.length || minLines));
  const compact = safeLines
    .slice(0, targetLines)
    .map((line) => line.replace(/^\d+\s*[\).:-]\s*/, "").trim())
    .filter((line) => !isWeakStructuredLine(line))
    .concat(fallbackLines)
    .slice(0, targetLines)
    .map((line) => {
      const normalized = tidyLineEnding(line);
      if (!normalized) {
        return "";
      }
      return countWords(normalized) > lineWords + 5
        ? clampSentenceByWords(normalized, lineWords + 5)
        : normalized;
    })
    .map((line) => ensureLineClosure(line))
    .map((line) => (countWords(line) < 3 ? ensureLineClosure(buildBodyPadding(role, coreIdea)) : line))
    .filter(Boolean);

  if (layoutType === "steps") {
    return compact.map((line, index) => `${index + 1}. ${line}`).join("\n");
  }

  return compact.map((line) => `• ${line}`).join("\n");
}

function isWeakStructuredLine(line: string) {
  const compact = clean(line).toLowerCase();
  if (!compact) {
    return true;
  }

  if (countWords(compact) < 3) {
    return true;
  }

  return /(3-5 steps|step-by-step|по теме|without chaos|без хаоса|action plan|checklist before|чеклист перед|core conflict)/i.test(
    compact
  );
}

function buildStructuredFallbackLines(role: CarouselSlideRole, coreIdea: string) {
  const useEnglish = isMostlyEnglish(coreIdea);
  if (role === "steps") {
    return useEnglish
      ? [
          "Start from one concrete client pain and phrase it clearly.",
          "Show your method on one practical example instead of theory.",
          "Close with one direct action the reader can do today."
        ]
      : [
          "Начните с одной конкретной боли клиента и сформулируйте её прямо.",
          "Покажите решение на практическом примере, а не в теории.",
          "Закройте слайд одним действием, которое можно сделать сегодня."
        ];
  }

  if (role === "checklist") {
    return useEnglish
      ? [
          "One clear idea per slide.",
          "One practical proof or mechanic per point.",
          "One concrete CTA in the final card."
        ]
      : [
          "Одна чёткая мысль на слайд.",
          "Один практический аргумент в каждом пункте.",
          "Один конкретный CTA в финальной карточке."
        ];
  }

  return useEnglish
    ? [
        "Name one specific client problem in plain language.",
        "Show the practical move that solves this problem.",
        "Add a short takeaway the reader can apply today."
      ]
    : [
        "Назовите конкретную проблему клиента простыми словами.",
        "Покажите практический шаг, который её решает.",
        "Добавьте короткий вывод, который можно применить сегодня."
      ];
}

function toCompactBody(
  body: string,
  bodyWords: number,
  _lineWords: number,
  maxLines: number
) {
  const normalized = injectClauseBoundaries(body);
  if (!normalized) {
    return normalized;
  }

  const compactSource = clampSentenceByWords(normalized, bodyWords + 5);
  const explicitLines = splitInlineBullets(body)
    .map((line) => tidyLineEnding(line))
    .map((line) => ensureLineClosure(line))
    .filter(Boolean);
  if (explicitLines.length >= 2) {
    return explicitLines.slice(0, maxLines).join("\n");
  }

  const sentenceSource = clean(compactSource)
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?…:])\s+/)
    .map((line) => line.trim())
    .filter((line) => countWords(line) >= 3);
  const safeSentences = sentenceSource.length
    ? sentenceSource
    : extractBodyLines(compactSource).length
      ? extractBodyLines(compactSource)
      : [compactSource];
  const preparedLines = safeSentences
    .slice(0, maxLines)
    .map((line) => tidyLineEnding(line))
    .map((line) => ensureLineClosure(line))
    .filter(Boolean);

  if (preparedLines.length) {
    return preparedLines.join("\n");
  }

  const fallbackSource = tidyLineEnding(compactSource);
  const fallbackLine = ensureLineClosure(fallbackSource);
  if (!fallbackLine) {
    return "";
  }

  return fallbackLine;
}

function splitInlineBullets(value: string) {
  const normalized = clean(value)
    .replace(/\s*([•▪◦●])\s*/g, "\n")
    .split(/\n+/)
    .map((line) => line.replace(/^([•\-]|\d+\.)\s*/, "").trim())
    .filter(Boolean);

  if (!normalized.length) {
    return [];
  }

  return normalized;
}

function extractBodyLines(value: string) {
  const rawLines = clean(injectClauseBoundaries(value))
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
  const useEnglish = isMostlyEnglish(coreIdea);
  if (role === "cover") {
    return useEnglish
      ? "Swipe: we break the conflict into practical steps."
      : "Листайте: дальше разберём конфликт и рабочие шаги.";
  }

  if (role === "cta") {
    return useEnglish ? "Save and apply this today." : "Сохраните и примените это сегодня.";
  }

  if (role === "tip" || role === "checklist" || role === "steps") {
    return useEnglish
      ? "Test the step in practice and measure the outcome."
      : "Проверьте шаг на практике и замерьте результат.";
  }

  if (role === "problem") {
    return useEnglish
      ? "Show where results are lost and why it is critical."
      : "Здесь теряется результат и именно это нужно исправить первым.";
  }

  if (role === "myth") {
    return useEnglish
      ? "Validate the belief with facts and remove false confidence."
      : "Проверьте убеждение на фактах и уберите ложную опору.";
  }

  if (role === "mistake") {
    return useEnglish
      ? "Name one mistake and replace it with a working action."
      : "Назовите одну ошибку и сразу замените её рабочим действием.";
  }

  if (role === "case") {
    return useEnglish
      ? "Short case: one action, one measurable result."
      : "Короткий кейс: одно действие, один измеримый результат.";
  }

  if (role === "comparison") {
    return useEnglish
      ? "Compare working and weak options on one concrete example."
      : "Сравните рабочий и слабый вариант на одном конкретном примере.";
  }

  if (role === "summary") {
    return useEnglish
      ? "Compress the key takeaway into one formula and act on it."
      : "Соберите главный вывод в одну формулу и закрепите действием.";
  }

  return useEnglish
    ? "Use one specific, measurable action instead of broad advice."
    : "Сфокусируйтесь на одном конкретном действии и измеримом результате.";
}

function buildMicroConclusion(role: CarouselSlideRole, coreIdea: string) {
  const useEnglish = isMostlyEnglish(coreIdea);
  if (role === "problem") {
    return useEnglish
      ? "Until the root cause is fixed, growth will keep hitting a ceiling."
      : "Пока причина не устранена, рост будет упираться в потолок.";
  }

  if (role === "myth") {
    return useEnglish
      ? "Validate this with data, not habit."
      : "Проверьте это на данных, а не на привычке.";
  }

  if (role === "mistake") {
    return useEnglish
      ? "Fix this first and your metrics stabilize faster."
      : "Исправьте это первым — и метрики стабилизируются быстрее.";
  }

  if (role === "case") {
    return useEnglish
      ? "Key lesson: one precise move outperformed ten random attempts."
      : "Смысл кейса: сработал один точный шаг, а не десять хаотичных.";
  }

  if (role === "comparison") {
    return useEnglish
      ? "The winning option always has a clear action and a result check."
      : "Выигрывает вариант, где есть чёткое действие и проверка результата.";
  }

  if (role === "summary") {
    return useEnglish
      ? "Focus on one step and carry it to an actual result."
      : "Сфокусируйтесь на одном шаге и доведите его до результата.";
  }

  return buildBodyPadding(role, coreIdea);
}

function injectClauseBoundaries(value: string) {
  const normalized = clean(value).replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim();
  if (!normalized) {
    return "";
  }

  return normalized.replace(/([a-zа-яё0-9])\s+(?=(?:Если|Когда|Чтобы|Пока|Сохраните|Сделайте|Проверьте|Откройте|Запустите|Листайте|Save|Start|Try|Check|Open|Apply|Then)\b)/giu, "$1. ");
}

function hasBrokenBodyStructure(value: string) {
  const lines = value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return true;
  }

  return lines.some((line) => {
    if (FRAGMENT_START_PATTERN.test(line)) {
      return true;
    }
    if (hasHangingEnding(line)) {
      return true;
    }
    if (/•\s*•/.test(line)) {
      return true;
    }

    return countWords(line) < 3;
  });
}

function hasWeakCopy(value: string) {
  return WEAK_COPY_PATTERNS.some((pattern) => pattern.test(value));
}

function hasHangingEnding(value: string) {
  return HANGING_ENDING_PATTERN.test(
    value
      .replace(/[.!?…]+$/g, "")
      .trim()
      .toLowerCase()
  );
}

function clampLineByWordsSoft(value: string, targetWords: number, overflow = 2) {
  const words = value
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  if (words.length <= targetWords + overflow) {
    return value.trim();
  }

  return clampSentenceByWords(value, targetWords);
}

function ensureLineClosure(value: string) {
  const trimmed = tidyLineEnding(value);
  if (!trimmed) {
    return "";
  }

  const withoutHanging = hasHangingEnding(trimmed)
    ? stripHangingEnding(trimmed)
    : trimmed;
  if (!withoutHanging) {
    return "";
  }

  if (countWords(withoutHanging) < 3) {
    return "";
  }

  if (/[.!?…:]$/.test(withoutHanging)) {
    return withoutHanging;
  }

  if (countWords(withoutHanging) >= 3) {
    return `${withoutHanging}.`;
  }

  return withoutHanging;
}

function capitalizeLineStart(value: string) {
  const line = clean(value);
  if (!line) {
    return "";
  }

  const bulletMatch = line.match(/^([•\-]|\d+\.)\s+(.*)$/);
  if (bulletMatch) {
    const [, bullet, rest] = bulletMatch;
    const trimmed = rest.trim();
    if (!trimmed) {
      return line;
    }
    const [first, ...tail] = Array.from(trimmed);
    return `${bullet} ${first.toLocaleUpperCase("ru-RU")}${tail.join("")}`;
  }

  const [first, ...tail] = Array.from(line);
  return `${first.toLocaleUpperCase("ru-RU")}${tail.join("")}`;
}

function stripHangingEnding(value: string) {
  const noPunctuation = clean(value).replace(/[.!?…]+$/g, "").trim();
  return noPunctuation.replace(HANGING_ENDING_PATTERN, "").trim();
}

function tidyLineEnding(value: string) {
  let normalized = clean(value).replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  normalized = normalized
    .replace(/\s+[,:;.!?…]+$/g, (match) => match.trim())
    .replace(/[,:;–—-]+$/g, "")
    .trim();

  if (/[«"(\[]$/.test(normalized)) {
    normalized = normalized.slice(0, -1).trim();
  }

  return normalized;
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

  return clampSentence(cleaned, maxLength).replace(/[.!?…]+$/g, "").trim();
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

  const truncated = value.slice(0, maxLength).trimEnd();
  const sentenceBoundary = Math.max(
    truncated.lastIndexOf("."),
    truncated.lastIndexOf("!"),
    truncated.lastIndexOf("?"),
    truncated.lastIndexOf(";"),
    truncated.lastIndexOf(":")
  );
  if (sentenceBoundary > Math.floor(maxLength * 0.55)) {
    return truncated.slice(0, sentenceBoundary + 1).trimEnd();
  }

  const commaBoundary = truncated.lastIndexOf(",");
  if (commaBoundary > Math.floor(maxLength * 0.6)) {
    return `${truncated.slice(0, commaBoundary).trimEnd()}.`;
  }

  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > 24) {
    return `${truncated.slice(0, lastSpace).trimEnd()}.`;
  }

  return `${truncated.trimEnd()}.`;
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
  const normalized = enforceRoleTitleTone(
    capitalizeTitle(
      clampTitle(basis, LAYOUT_LIMITS[normalizeLayoutType(planSlide.layoutType)].titleMax)
    ),
    planSlide.role,
    topic
  );
  const normalizedWithoutPunctuation = normalized.replace(/\s{2,}/g, " ").trim();

  if (planSlide.role === "cover" && isWeakHookTitle(normalizedWithoutPunctuation)) {
    return buildHookTitle(topic);
  }

  if (isIncompleteTitle(normalizedWithoutPunctuation)) {
    if (planSlide.role === "cover") {
      return buildHookTitle(topic);
    }

    const fallbackTitle = enforceRoleTitleTone(
      buildFallbackTitle(planSlide, topic, index, total),
      planSlide.role,
      topic
    );
    return fallbackTitle;
  }

  if (hasTemplateArtifactTitle(normalizedWithoutPunctuation)) {
    return enforceRoleTitleTone(
      buildFallbackTitle(planSlide, topic, index, total),
      planSlide.role,
      topic
    );
  }

  return normalizedWithoutPunctuation;
}

function hasTemplateArtifactTitle(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  if (/^[-–—]/.test(normalized)) {
    return true;
  }

  return /(3-5 steps|without chaos|core conflict|по теме «|action plan continued|-5 steps|continued:)/i.test(
    normalized
  );
}

function enforceRoleTitleTone(
  title: string,
  role: CarouselSlideRole,
  topic: string
) {
  const compact = clean(title).replace(/\s{2,}/g, " ").trim();
  if (!compact) {
    return title;
  }

  const useEnglish = isMostlyEnglish(`${title} ${topic}`);
  const lowercase = compact.toLowerCase();

  if (role === "cover") {
    if (/(в теме|по теме|core conflict|главный конфликт)/i.test(compact)) {
      return buildHookTitle(topic);
    }
    if (/\b(котор\w*|which|that)\b/i.test(compact) && !compact.includes("?")) {
      return buildHookTitle(topic);
    }
    return isHookLikeTitle(compact) ? compact : buildHookTitle(topic);
  }

  if (role === "problem" && !/(проблема|теря|срыв|не работает|проседает|problem|loss|leak|fails)/i.test(lowercase)) {
    return clampTitle(
      `${useEnglish ? "Problem:" : "Проблема:"} ${compact}`,
      72
    );
  }

  if (role === "mistake" && !/(ошибка|миф|mistake|myth)/i.test(lowercase)) {
    return clampTitle(
      `${useEnglish ? "Mistake:" : "Ошибка:"} ${compact}`,
      72
    );
  }

  if (role === "case" && !/(кейс|пример|case|example)/i.test(lowercase)) {
    return clampTitle(
      `${useEnglish ? "Case:" : "Кейс:"} ${compact}`,
      72
    );
  }

  if (role === "cta") {
    const ctaPrefixPattern = /^(сделайте этот шаг|сделайте шаг|сделай сегодня|что сделать сейчас|что делать сейчас|что сделать прямо сейчас|сделай шаг сейчас|сделайте прямо сейчас|start from this step|start now|start here|next step|what to do now|first move|first step)\s*:?\s*/i;
    let compactCta = compact;
    while (ctaPrefixPattern.test(compactCta)) {
      compactCta = compactCta.replace(ctaPrefixPattern, "").trim();
    }
    compactCta = compactCta.replace(/[:\-–—\s]+$/g, "").trim();

    if (/^(хотите|если|want|if)\b/i.test(compactCta)) {
      return useEnglish
        ? "What to do now: take one practical step today"
        : "Что сделать сейчас: внедрите один практический шаг";
    }

    const hasActionVerb = /(сделайт|сдела(й|ть)|напис|сохран|проверь|получ|забер|write|save|get|start|try|apply|send)/i.test(compactCta);
    if (hasActionVerb) {
      return clampTitle(compactCta, 72);
    }

    const ctaTail = compactCta || (useEnglish ? "apply one practical step" : "сделайте один практический шаг");
    return clampTitle(
      useEnglish ? `What to do now: ${ctaTail}` : `Что сделать сейчас: ${ctaTail}`,
      72
    );
  }

  return compact;
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
  const sceneKeywords = extractSearchKeywords(
    translateSceneToEnglish(`${topic} ${coreIdea}`)
  ).slice(0, 6);
  const queryLanguageIsEnglish = isMostlyEnglish(`${topic} ${coreIdea}`);
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
  const subjectTokens = queryLanguageIsEnglish ? baseKeywords : translated;

  const query = uniqueSearchTokens([
    ...intentPrefix,
    ...categoryHints,
    ...roleHint,
    ...sceneKeywords,
    ...subjectTokens
  ])
    .slice(0, 10)
    .join(" ");

  return normalizeImageQuery(query);
}

function translateSceneToEnglish(value: string) {
  const topic = value.toLowerCase();

  if (/(элитн|дорог|премиум).*(недвиж|квартир|дом)|недвиж.*(элитн|дорог|премиум)/i.test(topic)) {
    return "luxury real estate interior architecture daylight";
  }

  if (/(продаж|риелтор|ипотек|клиент).*(недвиж|квартир|дом)|недвиж.*(продаж|риелтор|ипотек)/i.test(topic)) {
    return "real estate consultation office clients meeting";
  }

  if (/(съедоб|ядовит|гриб)/i.test(topic)) {
    return "edible poisonous mushrooms forest closeup macro";
  }

  if (/(кофе|coffee|brew|barista)/i.test(topic)) {
    return "coffee brewing barista closeup beans cup";
  }

  if (/(конверси|продаж|лид|воронк|маркетинг|sales|conversion)/i.test(topic)) {
    return "business growth analytics strategy meeting";
  }

  if (/(instagram|creator|личн.*бренд)/i.test(topic)) {
    return "creator workspace smartphone content planning portrait";
  }

  if (/(onboarding|saas|b2b)/i.test(topic)) {
    return "saas onboarding workspace product team";
  }

  if (/(зуб|стомат|дентал|teeth|dental)/i.test(topic)) {
    return "dental clinic consultation healthy teeth closeup";
  }

  return extractSearchKeywords(value)
    .slice(0, 8)
    .map((token) => KEYWORD_TRANSLATIONS[token] ?? token)
    .join(" ");
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

function isScenarioId(value: unknown): value is ScenarioId {
  return (
    value === "expert" ||
    value === "educational" ||
    value === "commercial" ||
    value === "case-driven"
  );
}
