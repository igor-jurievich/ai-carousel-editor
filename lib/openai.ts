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
  "hook",
  "cover",
  "problem",
  "amplify",
  "myth",
  "mistake",
  "consequence",
  "shift",
  "solution",
  "structure",
  "tip",
  "steps",
  "checklist",
  "example",
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
type NarrativeAngle =
  | "loss-risk"
  | "mistake-breakdown"
  | "process-playbook"
  | "case-proof"
  | "opportunity-shift";
type CommercialIntensity = "low" | "medium" | "high";
type InputShape = "topic-only" | "idea-list" | "case-driven" | "directive";
type FunnelStage =
  | "hook"
  | "problem"
  | "amplify"
  | "mistake"
  | "consequence"
  | "shift"
  | "solution"
  | "structure"
  | "example"
  | "cta";
type GenerationOptions = {
  useInternetImages?: boolean;
  niche?: string;
  audience?: string;
};

type SlideStageAssignment = {
  role: CarouselSlideRole;
  stages: FunnelStage[];
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

type TopicLensOverrides = {
  niche?: string;
  audience?: string;
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
  painModel: CarouselPainModel;
  scenario?: ScenarioId;
  angle: NarrativeAngle;
  commercialIntensity: CommercialIntensity;
  inputShape: InputShape;
  slides: CarouselPlanSlide[];
};

type SlideDraft = {
  title: string;
  text: string;
};

export type CarouselPainModel = {
  pain: string;
  wrongAction: string;
  consequence: string;
  desiredOutcome: string;
  emotionalState: string;
};

type CarouselGenerationResult = {
  slides: CarouselOutlineSlide[];
  painModel: CarouselPainModel;
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

type GenerationQualityFlags = {
  hasPain: boolean;
  hasProgression: boolean;
  hasRecognitionMoment: boolean;
  hasMindsetShift: boolean;
  hasTopicLinkedCta: boolean;
  hasNarrativeCoverage: boolean;
};

type LayoutLimit = {
  titleMin: number;
  titleMax: number;
  bodyMin: number;
  bodyMax: number;
  preferredLinesMin: number;
  preferredLinesMax: number;
};

type TemplateRolePool = Partial<Record<CarouselSlideRole, CarouselTemplateId[]>>;

const TEMPLATE_FAMILY_POOLS: Record<TemplateFamilyId, TemplateRolePool> = {
  "dark-premium": {
    hook: ["netflix", "premium", "noir"],
    cover: ["netflix", "premium", "noir"],
    problem: ["noir", "founder-dark", "matrix"],
    amplify: ["noir", "founder-dark", "matrix"],
    myth: ["matrix", "midnight", "founder-dark"],
    mistake: ["founder-dark", "noir", "matrix"],
    consequence: ["founder-dark", "noir", "midnight"],
    shift: ["matrix", "founder-dark", "premium"],
    solution: ["midnight", "founder-dark", "matrix"],
    structure: ["matrix", "founder-dark", "midnight"],
    tip: ["midnight", "founder-dark", "matrix"],
    steps: ["matrix", "founder-dark", "midnight"],
    checklist: ["midnight", "matrix", "founder-dark"],
    example: ["premium", "founder-dark", "netflix"],
    case: ["premium", "founder-dark", "netflix"],
    comparison: ["matrix", "noir", "founder-dark"],
    summary: ["midnight", "premium", "founder-dark"],
    cta: ["netflix", "founder-dark", "premium"]
  },
  "light-clean": {
    hook: ["minimal", "editorial", "technology"],
    cover: ["minimal", "editorial", "technology"],
    problem: ["technology", "minimal", "editorial"],
    amplify: ["technology", "minimal", "editorial"],
    myth: ["notes", "technology", "minimal"],
    mistake: ["notes", "minimal", "technology"],
    consequence: ["notes", "minimal", "business-light"],
    shift: ["editorial", "technology", "minimal"],
    solution: ["minimal", "technology", "business-light"],
    structure: ["technology", "business-light", "minimal"],
    tip: ["minimal", "technology", "business-light"],
    steps: ["technology", "business-light", "minimal"],
    checklist: ["minimal", "notes", "technology"],
    example: ["editorial", "business-light", "technology"],
    case: ["editorial", "business-light", "technology"],
    comparison: ["technology", "minimal", "business-light"],
    summary: ["notes", "minimal", "editorial"],
    cta: ["business-light", "minimal", "technology"]
  },
  "accent-business": {
    hook: ["atlas", "aurora", "mandarin"],
    cover: ["atlas", "aurora", "mandarin"],
    problem: ["atlas", "aurora", "coral"],
    amplify: ["atlas", "aurora", "coral"],
    myth: ["aurora", "coral", "mandarin"],
    mistake: ["coral", "mandarin", "atlas"],
    consequence: ["coral", "atlas", "mandarin"],
    shift: ["aurora", "atlas", "mandarin"],
    solution: ["atlas", "mandarin", "coral"],
    structure: ["atlas", "mandarin", "aurora"],
    tip: ["atlas", "mandarin", "coral"],
    steps: ["atlas", "mandarin", "aurora"],
    checklist: ["mandarin", "atlas", "coral"],
    example: ["atlas", "coral", "aurora"],
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

const CANONICAL_FUNNEL_STAGES: FunnelStage[] = [
  "hook",
  "problem",
  "amplify",
  "mistake",
  "consequence",
  "shift",
  "solution",
  "structure",
  "example",
  "cta"
];

const FUNNEL_SEQUENCE_10: SlideStageAssignment[] = CANONICAL_FUNNEL_STAGES.map((stage) => ({
  role: stage,
  stages: [stage]
}));

const FUNNEL_SEQUENCE_9: SlideStageAssignment[] = [
  { role: "hook", stages: ["hook"] },
  { role: "problem", stages: ["problem"] },
  { role: "amplify", stages: ["amplify"] },
  { role: "mistake", stages: ["mistake", "consequence"] },
  { role: "shift", stages: ["shift"] },
  { role: "solution", stages: ["solution"] },
  { role: "structure", stages: ["structure"] },
  { role: "example", stages: ["example"] },
  { role: "cta", stages: ["cta"] }
];

const FUNNEL_SEQUENCE_8: SlideStageAssignment[] = [
  { role: "hook", stages: ["hook"] },
  { role: "problem", stages: ["problem", "amplify"] },
  { role: "mistake", stages: ["mistake", "consequence"] },
  { role: "shift", stages: ["shift"] },
  { role: "solution", stages: ["solution"] },
  { role: "structure", stages: ["structure"] },
  { role: "example", stages: ["example"] },
  { role: "cta", stages: ["cta"] }
];

const FUNNEL_BASE_SEQUENCE: CarouselSlideRole[] = FUNNEL_SEQUENCE_10.map((item) => item.role);

const SCENARIO_ROLE_TEMPLATES: Record<ScenarioId, CarouselSlideRole[]> = {
  expert: [...FUNNEL_BASE_SEQUENCE],
  educational: [...FUNNEL_BASE_SEQUENCE],
  commercial: [...FUNNEL_BASE_SEQUENCE],
  "case-driven": [...FUNNEL_BASE_SEQUENCE]
};

const SCENARIO_EXTRA_ROLES: Record<ScenarioId, CarouselSlideRole[]> = {
  expert: ["myth", "comparison", "summary", "example"],
  educational: ["myth", "steps", "checklist", "summary"],
  commercial: ["comparison", "myth", "summary", "example"],
  "case-driven": ["comparison", "summary", "myth", "example"]
};

const ROLE_ALIASES: Partial<Record<CarouselSlideRole, CarouselSlideRole>> = {
  cover: "hook",
  tip: "solution",
  steps: "structure",
  checklist: "structure",
  case: "example",
  comparison: "shift",
  summary: "solution"
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
  "Вы теряете результат в теме «%topic%» ещё до ключевого шага",
  "Ошибка в теме «%topic%», из-за которой сливаются тёплые клиенты",
  "В теме «%topic%» есть скрытый сбой, который ломает конверсию",
  "Пока вы делаете «%topic%», клиенты уходят к тем, кто объясняет лучше",
  "Главная причина провала в теме «%topic%» — не то, что вы думаете"
];

const HOOK_TITLE_PREFIXES_EN = [
  "You're losing results in %topic% before the key move",
  "The hidden failure in %topic% is killing conversion",
  "One costly mistake in %topic% keeps warm leads away",
  "Users still leave before value appears — your core flow is broken",
  "The real reason %topic% underperforms is not what you think"
];

const COMMERCIAL_HIGH_SIGNAL_PATTERN =
  /(лид|лиды|заявк|продаж|конверси|воронк|директ|чек|оффер|доход|выручк|прибыл|клиент|риелтор|недвиж|sales|leads|conversion|revenue|pipeline|deal|closing)/i;
const COMMERCIAL_MID_SIGNAL_PATTERN =
  /(контент|блог|маркетинг|аудитори|эксперт|бренд|стратег|рост|client|marketing|audience|brand|growth)/i;
const CASE_SIGNAL_PATTERN = /(кейс|пример|разбор|история|случай|case|example|proof)/i;
const DIRECTIVE_SIGNAL_PATTERN =
  /(сделай|нужно|должно|обязательно|запретить|добавь|fix|must|should|required|enforce)/i;
const LIST_SIGNAL_PATTERN = /(^|\n)\s*(\d+\s*[\)\.]|[-*•])|чеклист|список|пункты|bullet|checklist/i;

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

function normalizeScenarioRole(role: CarouselSlideRole): CarouselSlideRole {
  return ROLE_ALIASES[role] ?? role;
}

function isHookRole(role: CarouselSlideRole | undefined) {
  return role === "hook" || role === "cover";
}

function isStructureRole(role: CarouselSlideRole | undefined) {
  return role === "structure" || role === "steps" || role === "checklist";
}

function isExampleRole(role: CarouselSlideRole | undefined) {
  return role === "example" || role === "case";
}

export async function generateCarouselFromTopic(
  topic: string,
  requestedSlidesCount?: number,
  options?: GenerationOptions
): Promise<CarouselGenerationResult> {
  const niche = clean(String(options?.niche ?? "")).slice(0, 120);
  const audienceOverride = clean(String(options?.audience ?? "")).slice(0, 160);
  const brief = enrichBriefWithContext(parseTopicBrief(topic), niche, audienceOverride);
  const coreTopic = brief.coreTopic || topic;
  const normalizedRequested = clampSlidesCount(
    requestedSlidesCount ?? inferTargetSlides(topic) ?? DEFAULT_SLIDES_COUNT
  );
  const targetCount = Math.max(8, Math.min(10, normalizedRequested));
  const lens = inferTopicLens(coreTopic, brief.sourceIdeas, {
    niche,
    audience: audienceOverride
  });
  const deterministicPainModel = buildDeterministicPainModel(coreTopic, lens, brief);
  let activePainModel = deterministicPainModel;

  let openai: OpenAI | null = null;
  try {
    openai = getOpenAIClient();
  } catch {
    const deterministicPlan = buildDeterministicPlan(
      coreTopic,
      targetCount,
      lens,
      brief,
      deterministicPainModel,
      options
    );
    return {
      slides: buildDeterministicFallbackSlides(coreTopic, deterministicPlan, brief, targetCount),
      painModel: deterministicPainModel
    };
  }

  const model = resolvePrimaryGenerationModel();
  const modelFallbackChain = [model];
  try {
    activePainModel = await generatePainModelWithFallback(
      openai,
      modelFallbackChain,
      topic,
      brief,
      lens,
      deterministicPainModel
    );
  } catch (error) {
    console.error("OpenAI pain model stage failed, deterministic model engaged:", error);
    activePainModel = deterministicPainModel;
  }

  const deterministicPlan = buildDeterministicPlan(
    coreTopic,
    targetCount,
    lens,
    brief,
    activePainModel,
    options
  );
  let activePlan = deterministicPlan;
  try {
    activePlan = await generatePlanWithFallback(
      openai,
      modelFallbackChain,
      topic,
      brief,
      lens,
      deterministicPlan,
      activePainModel,
      targetCount
    );
  } catch (error) {
    console.error("OpenAI carousel planning failed, deterministic plan engaged:", error);
    activePlan = deterministicPlan;
  }

  let draftedSlides: SlideDraft[] = [];
  try {
    draftedSlides = await generateSlidesFromPlanWithFallback(
      openai,
      modelFallbackChain,
      topic,
      brief,
      activePlan,
      targetCount,
      options
    );
  } catch (error) {
    console.error("OpenAI carousel generation failed, deterministic drafts engaged:", error);
    draftedSlides = buildDraftSlidesFromPlan(activePlan, brief, targetCount);
  }

  let slides = normalizeSlides(coreTopic, draftedSlides, activePlan, targetCount, brief);
  slides = polishSlidesForPublishability(coreTopic, slides, activePlan, brief, targetCount);
  const quality = assessSlidesQuality(coreTopic, slides, activePlan);
  const criticalRepairIndexes = pickCriticalRepairIndexes(slides, quality.problematicIndexes);

  if (criticalRepairIndexes.length) {
    let repairedSlides = slides;
    let appliedModelRepairs = false;

    try {
      const modelRepairs = await repairSlidesWithFallback(
        openai,
        modelFallbackChain,
        topic,
        brief,
        activePlan,
        slides,
        criticalRepairIndexes,
        targetCount
      );
      if (modelRepairs?.length) {
        repairedSlides = applyRepairs(
          slides,
          modelRepairs,
          activePlan,
          coreTopic,
          brief,
          targetCount
        );
        appliedModelRepairs = true;
      }
    } catch (error) {
      console.error("OpenAI slide repairs failed, deterministic repairs engaged:", error);
    }

    if (!appliedModelRepairs) {
      const deterministicRepairs = buildDeterministicRepairs(
        coreTopic,
        activePlan,
        brief,
        criticalRepairIndexes,
        targetCount
      );
      repairedSlides = applyRepairs(
        slides,
        deterministicRepairs,
        activePlan,
        coreTopic,
        brief,
        targetCount
      );
    }

    slides = repairedSlides;
    const secondPassQuality = assessSlidesQuality(coreTopic, slides, activePlan);
    const followUpIndexes = pickCriticalRepairIndexes(slides, secondPassQuality.problematicIndexes);
    if (followUpIndexes.length) {
      const deterministicRepairs = buildDeterministicRepairs(
        coreTopic,
        activePlan,
        brief,
        followUpIndexes,
        targetCount
      );
      slides = applyRepairs(
        slides,
        deterministicRepairs,
        activePlan,
        coreTopic,
        brief,
        targetCount
      );
    }
  }

  let finalizedSlides: CarouselOutlineSlide[] = polishSlidesForPublishability(
    coreTopic,
    slides,
    activePlan,
    brief,
    targetCount
  );
  let qualityFlags = validateFunnelQuality(coreTopic, finalizedSlides, activePlan);
  if (!isFunnelQualityValid(qualityFlags)) {
    const funnelRepairIndexes = pickFunnelRepairIndexes(qualityFlags, finalizedSlides, activePlan);

    if (funnelRepairIndexes.length) {
      let repairedSlides: CarouselOutlineSlide[] = finalizedSlides;
      let appliedModelRepairs = false;

      try {
        const modelRepairs = await repairSlidesWithFallback(
          openai,
          modelFallbackChain,
          topic,
          brief,
          activePlan,
          finalizedSlides,
          funnelRepairIndexes,
          targetCount
        );
        if (modelRepairs?.length) {
          repairedSlides = applyRepairs(
            finalizedSlides,
            modelRepairs,
            activePlan,
            coreTopic,
            brief,
            targetCount
          );
          appliedModelRepairs = true;
        }
      } catch (error) {
        console.error("OpenAI funnel-quality repairs failed, deterministic repairs engaged:", error);
      }

      if (!appliedModelRepairs) {
        const deterministicRepairs = buildDeterministicRepairs(
          coreTopic,
          activePlan,
          brief,
          funnelRepairIndexes,
          targetCount
        );
        repairedSlides = applyRepairs(
          finalizedSlides,
          deterministicRepairs,
          activePlan,
          coreTopic,
          brief,
          targetCount
        );
      }

      finalizedSlides = polishSlidesForPublishability(
        coreTopic,
        repairedSlides,
        activePlan,
        brief,
        targetCount
      );
      qualityFlags = validateFunnelQuality(coreTopic, finalizedSlides, activePlan);
    }
  }

  if (!isFunnelQualityValid(qualityFlags)) {
    const deterministicPlanForRetry = buildDeterministicPlan(
      coreTopic,
      targetCount,
      lens,
      brief,
      deterministicPainModel,
      options
    );
    finalizedSlides = buildDeterministicFallbackSlides(
      coreTopic,
      deterministicPlanForRetry,
      brief,
      targetCount
    );
    qualityFlags = validateFunnelQuality(coreTopic, finalizedSlides, deterministicPlanForRetry);
  }

  if (!isFunnelQualityValid(qualityFlags)) {
    return {
      slides: finalizedSlides,
      painModel: deterministicPainModel
    };
  }

  return {
    slides: finalizedSlides,
    painModel: activePainModel
  };
}

async function generatePlanWithFallback(
  openai: OpenAI,
  models: string[],
  topic: string,
  brief: ParsedBrief,
  lens: TopicLens,
  deterministicPlan: CarouselPlan,
  painModel: CarouselPainModel,
  targetCount: number
) {
  let lastError: unknown = null;

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];

    try {
      const raw = await requestCarouselPlan(
        openai,
        model,
        topic,
        brief,
        lens,
        deterministicPlan,
        painModel,
        targetCount
      );
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
  targetCount: number,
  options?: GenerationOptions
): Promise<SlideDraft[]> {
  let lastError: unknown = null;

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];

    try {
      return await requestCarouselSlides(openai, model, topic, brief, plan, targetCount, options);
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

function buildDeterministicPainModel(
  topic: string,
  lens: TopicLens,
  brief: ParsedBrief
): CarouselPainModel {
  const source = `${topic} ${brief.sourceIdeas.join(" ")}`.trim();
  const useEnglish = isMostlyEnglish(source);
  const cleanTopic = clean(brief.coreTopic || topic).replace(/[«»"]/g, "").slice(0, 120) || (useEnglish ? "this topic" : "эта тема");
  const audience = clean(lens.audience).slice(0, 120);

  if (useEnglish) {
    return normalizePainModel(
      {
        pain: `People try to solve "${cleanTopic}" but still don't get a stable result.`,
        wrongAction: "They post generic content and explain too much instead of addressing one painful decision point.",
        consequence: "Engagement can look active, but trust stays weak and qualified leads keep leaking.",
        desiredOutcome: "A clear carousel flow that converts attention into trust and then into direct inquiries.",
        emotionalState: "Frustrated, overloaded, and unsure what to publish next."
      },
      {
        pain: `Audience around ${cleanTopic} is stuck without a clear decision path.`,
        wrongAction: "Generic educational posting without pressure, proof, or action.",
        consequence: "Low conversion from views to real conversations.",
        desiredOutcome: "Structured content that turns attention into action.",
        emotionalState: "Uncertain and tired of random posting."
      }
    );
  }

  const categoryPain: Partial<Record<TopicCategory, string>> = {
    "real-estate": `Клиент хочет безопасно купить/продать недвижимость, но боится ошибки и не доверяет экспертам на словах.`,
    "marketing-sales": `Есть активность и публикации, но лиды не переходят в диалог и заявки.`,
    "personal-brand": `Эксперт публикуется регулярно, но аудитория не считывает ценность и не пишет в директ.`,
    "health-safety": `Люди читают советы по теме, но не понимают, как применить их безопасно на практике.`,
    business: `Команда делает контент, но он не влияет на сделки и рост выручки.`,
    "expert-education": `Контент полезный, но слишком общий — аудитория не чувствует, что это про её конкретную ситуацию.`
  };

  return normalizePainModel(
    {
      pain:
        categoryPain[lens.category] ??
        `По теме «${cleanTopic}» люди тратят усилия, но не получают предсказуемый результат.`,
      wrongAction:
        `Вместо точного разбора боли ${audience ? `для ${audience}` : "для аудитории"} публикуются общие советы без конфликта и конкретики.`,
      consequence:
        "Человек не узнаёт себя в контенте, не доверяет и уходит к тому, кто объяснил проблему понятнее.",
      desiredOutcome:
        `Получать по теме «${cleanTopic}» стабильные входящие диалоги через серию слайдов от боли к действию.`,
      emotionalState:
        "Усталость от контента без отдачи, тревога из-за нестабильных заявок, ощущение «делаю много — получаю мало»."
    },
    {
      pain: `По теме «${cleanTopic}» есть интерес, но нет доверия и движения к действию.`,
      wrongAction: "Общий образовательный тон без давления на реальную боль клиента.",
      consequence: "Просмотры есть, заявок мало.",
      desiredOutcome: "Понятный сценарный контент, который ведёт к диалогу.",
      emotionalState: "Сомнения и перегруз."
    }
  );
}

function normalizePainModel(
  raw: Partial<CarouselPainModel> | null | undefined,
  fallback: CarouselPainModel
): CarouselPainModel {
  const normalizeField = (value: unknown, fallbackValue: string) => {
    const compact = clean(String(value ?? ""))
      .replace(/\s+/g, " ")
      .replace(/[«»"]/g, "\"")
      .trim();
    if (!compact) {
      return fallbackValue;
    }
    return clampSentence(compact, 220);
  };

  const merged: CarouselPainModel = {
    pain: normalizeField(raw?.pain, fallback.pain),
    wrongAction: normalizeField(raw?.wrongAction, fallback.wrongAction),
    consequence: normalizeField(raw?.consequence, fallback.consequence),
    desiredOutcome: normalizeField(raw?.desiredOutcome, fallback.desiredOutcome),
    emotionalState: normalizeField(raw?.emotionalState, fallback.emotionalState)
  };

  return merged;
}

function buildPainModelSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      pain: { type: "string", minLength: 12, maxLength: 220 },
      wrongAction: { type: "string", minLength: 12, maxLength: 220 },
      consequence: { type: "string", minLength: 12, maxLength: 220 },
      desiredOutcome: { type: "string", minLength: 12, maxLength: 220 },
      emotionalState: { type: "string", minLength: 8, maxLength: 180 }
    },
    required: ["pain", "wrongAction", "consequence", "desiredOutcome", "emotionalState"]
  } as const;
}

function buildPainModelPrompt(topic: string, brief: ParsedBrief, lens: TopicLens) {
  const sourceBlock = brief.sourceIdeas.slice(0, 10).map((line) => `- ${line}`).join("\n");
  return [
    `Тема: ${brief.coreTopic || topic}`,
    `Категория: ${lens.category}`,
    `Аудитория: ${lens.audience}`,
    `Цель: ${lens.goal}`,
    "",
    "Смысловые вводные:",
    sourceBlock || "- Нет доп. вводных, собери pain model по теме.",
    "",
    "Собери pain model из 5 полей:",
    "1) pain — конкретная боль клиента в бытовом языке.",
    "2) wrongAction — что человек обычно делает неправильно.",
    "3) consequence — к чему это приводит (потери/срыв результата).",
    "4) desiredOutcome — какой результат человек реально хочет.",
    "5) emotionalState — в каком эмоциональном состоянии он находится.",
    "",
    "Правила:",
    "- Пиши простым разговорным языком, без канцелярита.",
    "- Никаких абстракций и пустых фраз.",
    "- Формулировки должны читаться как «это про меня».",
    "- Не используй слова: «важно понимать», «необходимо», «следует учитывать», «данный аспект»."
  ].join("\n");
}

async function generatePainModelWithFallback(
  openai: OpenAI,
  models: string[],
  topic: string,
  brief: ParsedBrief,
  lens: TopicLens,
  deterministicPainModel: CarouselPainModel
) {
  let lastError: unknown = null;

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];

    try {
      const raw = await requestPainModel(openai, model, topic, brief, lens);
      return normalizePainModel(raw, deterministicPainModel);
    } catch (error) {
      lastError = error;
      const isLast = index === models.length - 1;
      if (isLast || !isModelAvailabilityError(error)) {
        break;
      }
    }
  }

  if (lastError) {
    return deterministicPainModel;
  }

  return deterministicPainModel;
}

async function requestPainModel(
  openai: OpenAI,
  model: string,
  topic: string,
  brief: ParsedBrief,
  lens: TopicLens
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
              "You build a practical pain model for social carousel strategy.",
              "Return only JSON matching schema.",
              "Write in the same language as input topic.",
              "No abstract marketing phrases.",
              "Pain model must be concrete, observable and emotionally recognizable."
            ].join(" ")
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildPainModelPrompt(topic, brief, lens)
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "carousel_pain_model",
        schema: buildPainModelSchema(),
        strict: true
      }
    }
  });

  const raw = response.output_text;
  if (!raw) {
    throw new Error("OpenAI returned an empty pain model.");
  }

  return JSON.parse(raw) as CarouselPainModel;
}

async function requestCarouselPlan(
  openai: OpenAI,
  model: string,
  topic: string,
  brief: ParsedBrief,
  lens: TopicLens,
  deterministicPlan: CarouselPlan,
  painModel: CarouselPainModel,
  targetCount: number
) {
  const baseFunnelFlow = "hook -> problem -> amplify -> mistake -> consequence -> shift -> solution -> structure -> example -> cta";
  const mergedFlowRules = "For 9 slides merge mistake+consequence. For 8 slides merge problem+amplify and mistake+consequence. Do not drop any stage.";
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
              "First slide must be hook. Last slide must be cta.",
              `Base carousel flow must be: ${baseFunnelFlow}.`,
              mergedFlowRules,
              "Never skip funnel stages. Each stage must be represented explicitly or merged with adjacent stage.",
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
            text: buildPlanPrompt(topic, brief, lens, deterministicPlan, painModel, targetCount)
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
              "Increase commercial clarity and narrative pressure where needed.",
              "No duplication with existing strong slides.",
              "Each repaired slide must move the story forward (tension, shift, proof, or action).",
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
  painModel: CarouselPainModel,
  targetCount: number
) {
  const stageAssignments = buildFunnelStageAssignments(targetCount);
  const stageMap = stageAssignments
    .map(
      (item, index) =>
        `${index + 1}. role=${item.role}; stage=${item.stages.join("+")}`
    )
    .join("\n");
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
    `Угол подачи: ${deterministicPlan.angle}`,
    `Коммерческая интенсивность: ${deterministicPlan.commercialIntensity}`,
    `Тип входа: ${deterministicPlan.inputShape}`,
    `Боль: ${painModel.pain}`,
    `Неправильное действие: ${painModel.wrongAction}`,
    `Последствие: ${painModel.consequence}`,
    `Желаемый результат: ${painModel.desiredOutcome}`,
    `Эмоциональное состояние: ${painModel.emotionalState}`,
    `Рекомендуемая роль-сетка: ${deterministicPlan.slides.map((slide) => slide.role).join(" -> ")}`,
    "Фиксированная воронка (обязательная):",
    stageMap,
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
    "- Первый слайд всегда hook по формуле «вы делаете X, но не получаете Y».",
    "- Обязательная воронка: hook -> problem -> amplify -> mistake -> consequence -> shift -> solution -> structure -> example -> cta.",
    "- Если слайдов 8-9, объединяй только соседние этапы (problem+amplify, mistake+consequence), но не пропускай этапы.",
    "- Каждый слайд должен логически продолжать предыдущий без разрывов.",
    "- Минимум один слайд в первой половине должен выполнять роль consequence/pain (что теряет читатель).",
    "- CTA должен завершать карусель и давать следующее действие.",
    "- Держи композиционный ритм: hero/statement/list/split/card/dark-slide/cta.",
    "- Внутри серии не ставь один и тот же layout подряд больше 2 раз.",
    "- templateId держи в одном визуальном семействе внутри всей карусели.",
    "- imageIntent = none, если фото не усиливает смысл.",
    "- imageQueryDraft делай коротким поисковым запросом (лучше на английском)."
  ].join("\n");
}

function resolveSlideFunction(plan: CarouselPlan, index: number) {
  const slide = plan.slides[index];
  if (!slide) {
    return "value";
  }

  const role = normalizeScenarioRole(slide.role);
  const stages = getStagesForSlideIndex(plan.slides.length, index);

  if (stages.includes("hook")) {
    return "hook";
  }

  if (stages.includes("cta")) {
    return "cta";
  }

  if (stages.includes("problem") && stages.includes("amplify")) {
    return "problem-amplify";
  }

  if (stages.includes("mistake") && stages.includes("consequence")) {
    return "mistake-consequence";
  }

  if (stages.includes("consequence") || stages.includes("amplify")) {
    return "pain-consequence";
  }

  if (stages.includes("problem")) {
    return "problem";
  }

  if (stages.includes("mistake")) {
    return "mistake-break";
  }

  if (stages.includes("shift")) {
    return "reframing";
  }

  if (stages.includes("structure")) {
    return "steps";
  }

  if (stages.includes("example")) {
    return "proof-case";
  }

  if (stages.includes("solution")) {
    return "solution";
  }

  if (index === 0 || isHookRole(role)) {
    return "hook";
  }

  if (index === plan.slides.length - 1 || role === "cta") {
    return "cta";
  }

  if (role === "consequence" || (role === "problem" && index > 1) || role === "amplify") {
    return "pain-consequence";
  }

  if (role === "problem") {
    return "problem";
  }

  if (role === "myth" || role === "mistake") {
    return "mistake-break";
  }

  if (role === "shift" || role === "comparison") {
    return "reframing";
  }

  if (isStructureRole(role)) {
    return "steps";
  }

  if (isExampleRole(role)) {
    return "proof-case";
  }

  if (role === "summary") {
    return "summary";
  }

  return "solution";
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
        `function=${resolveSlideFunction(plan, index)}`,
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
    "hook: короткий конфликт по формуле «вы делаете X, но не получаете Y».",
    "problem: конкретная точка сбоя, которую читатель узнаёт в своей ситуации.",
    "amplify: усиление боли и тревоги через реальный триггер.",
    "mistake: список конкретных ошибочных действий (без абстракций).",
    "consequence: что человек теряет, если продолжает так же.",
    "shift: перелом мышления в формате «это не X, это Y».",
    "solution: новый рабочий принцип, который меняет результат.",
    "structure: конкретные шаги внедрения (что сделать по порядку).",
    "example: короткий кейс «действие -> результат».",
    "cta: мягкий призыв «хочешь результат -> напиши слово -> получишь ценность»."
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
    `Narrative angle: ${plan.angle}`,
    `Commercial intensity: ${plan.commercialIntensity}`,
    `Input shape: ${plan.inputShape}`,
    `Pain model:`,
    `- pain: ${plan.painModel.pain}`,
    `- wrongAction: ${plan.painModel.wrongAction}`,
    `- consequence: ${plan.painModel.consequence}`,
    `- desiredOutcome: ${plan.painModel.desiredOutcome}`,
    `- emotionalState: ${plan.painModel.emotionalState}`,
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
    "- Hook formula is mandatory: «ты делаешь X, но не получаешь Y».",
    "- Early series must include consequence framing: what exactly the reader loses if nothing changes.",
    "- Include at least one mindset shift slide using contrast: «это не X, это Y».",
    "- Middle series should include at least one reframing slide that changes reader perspective.",
    "- Keep momentum: each slide must either raise tension, shift perspective, add proof, or push action.",
    "- Final slide must close narrative with clear CTA action and one concrete next step.",
    "- For list/steps/checklist layouts, each bullet should be useful and concrete.",
    internetImagesEnabled
      ? "- Use image intent only where visual adds meaning (hook/example). Keep other slides text-first."
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
        `  function: ${resolveSlideFunction(plan, index)}`,
        `  coreIdea: ${planSlide.coreIdea}`,
        `  layout: ${planSlide.layoutType}`,
        `  limits: title <= ${limits.titleMax}, body <= ${limits.bodyMax}`
      ].join("\n");
    })
    .join("\n");

  return [
    `Тема: ${brief.coreTopic || topic}`,
    `Сценарий: ${plan.scenario ?? "expert"}`,
    `Угол: ${plan.angle}`,
    `Интенсивность: ${plan.commercialIntensity}`,
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
  const expectedRoles = buildRoleSequence(targetCount);
  const rawSlides = Array.isArray(rawPlan?.slides) ? rawPlan.slides : [];
  const normalizedSlides: CarouselPlanSlide[] = [];

  for (let index = 0; index < targetCount; index += 1) {
    const rawSlide = rawSlides[index] as Partial<CarouselPlanSlide> | undefined;
    const fallback = fallbackPlan.slides[index];
    const rawRole = isCarouselRole(rawSlide?.role) ? rawSlide.role : fallback.role;
    const fallbackRole = expectedRoles[index] ?? fallback.role;
    const role = normalizeScenarioRole(fallbackRole ?? rawRole);
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
      layoutType: chooseLayoutForRole(role, imageIntent, scenario) || layoutType,
      imageIntent,
      imageQueryDraft,
      templateId
    });
  }

  if (normalizedSlides[0]) {
    normalizedSlides[0].role = "hook";
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
    painModel: fallbackPlan.painModel,
    scenario,
    angle: fallbackPlan.angle,
    commercialIntensity: fallbackPlan.commercialIntensity,
    inputShape: fallbackPlan.inputShape,
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
  const normalizedRole = normalizeScenarioRole(role);

  if (
    imageIntent !== "none" &&
    (isHookRole(normalizedRole) ||
      normalizedRole === "problem" ||
      normalizedRole === "amplify" ||
      normalizedRole === "consequence" ||
      isExampleRole(normalizedRole) ||
      normalizedRole === "shift")
  ) {
    return ["image-top", "hero", "statement"];
  }

  if (isHookRole(normalizedRole)) {
    return ["hero", "statement", "dark-slide"];
  }

  if (normalizedRole === "problem" || normalizedRole === "amplify") {
    return ["statement", "dark-slide", "split"];
  }

  if (normalizedRole === "myth") {
    return ["split", "statement", "card"];
  }

  if (normalizedRole === "mistake" || normalizedRole === "consequence") {
    return ["card", "statement", "split"];
  }

  if (normalizedRole === "solution") {
    return ["list", "card", "statement"];
  }

  if (isStructureRole(normalizedRole)) {
    return ["list", "split", "card"];
  }

  if (isExampleRole(normalizedRole) || normalizedRole === "shift") {
    return ["split", "card", "dark-slide"];
  }

  if (normalizedRole === "summary") {
    return ["card", "statement", "dark-slide"];
  }

  if (normalizedRole === "cta") {
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
    setLayoutByRole(["problem", "amplify", "mistake", "myth", "consequence"], "statement");
  }

  if (!hasLayout("list")) {
    setLayoutByRole(["structure", "steps", "checklist", "solution", "tip"], "list");
  }

  if (!hasLayout("split")) {
    setLayoutByRole(["example", "case", "shift", "comparison", "myth", "mistake"], "split");
  }

  if (!hasLayout("card")) {
    setLayoutByRole(["solution", "tip", "summary", "example", "case"], "card");
  }

  if (!hasLayout("hero")) {
    const coverIndex = slides.findIndex((slide) => isHookRole(slide.role));
    if (coverIndex >= 0 && slides[coverIndex].imageIntent === "none") {
      slides[coverIndex].layoutType = "hero";
    }
  }
}

function rankImagePriority(role: CarouselSlideRole, imageIntent: CarouselImageIntent) {
  const normalizedRole = normalizeScenarioRole(role);
  if (imageIntent === "none") {
    return -100;
  }

  if (isHookRole(normalizedRole)) {
    return 100;
  }

  if (isExampleRole(normalizedRole)) {
    return 90;
  }

  if (
    normalizedRole === "problem" ||
    normalizedRole === "amplify" ||
    normalizedRole === "consequence" ||
    normalizedRole === "shift"
  ) {
    return 70;
  }

  if (normalizedRole === "solution" || normalizedRole === "summary") {
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
    const planSlide =
      plan.slides[index] ??
      plan.slides[plan.slides.length - 1] ??
      buildFallbackPlanSlide(
        topic,
        "solution",
        index,
        targetCount,
        inferTopicLens(topic, brief.sourceIdeas),
        brief.sourceIdeas
      );
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
    normalized[0].role = "hook";
    normalized[0].layoutType = normalized[0].imageIntent !== "none" ? "image-top" : "hero";
    normalized[0].text = fitSlideTextToLayout(
      normalized[0].title,
      normalized[0].text,
      normalized[0].layoutType ?? "hero",
      "hook",
      normalized[0].coreIdea ?? topic
    ).body;
  }

  const lastSlide = normalized[normalized.length - 1];
  if (lastSlide) {
    lastSlide.role = "cta";
    lastSlide.layoutType = "cta";
    lastSlide.imageIntent = "none";
    lastSlide.imageQueryDraft = "";
    if (assessCtaStrength(lastSlide.title, lastSlide.text) < 3) {
      const useEnglish = isMostlyEnglish(topic);
      const keyword = buildActionKeyword(topic, useEnglish);
      const ctaPadding = useEnglish
        ? `${buildCtaBody(topic, keyword, useEnglish)}\nSave this carousel and apply one step today.`
        : `${buildCtaBody(topic, keyword, useEnglish)}\nСохраните карусель и внедрите один шаг сегодня.`;
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
  return /^(сравнение|обзор|гайд|guide|summary|чек-?лист|подборка|как\b|почему\b|что\b|где\b|what\b|why\b|how\b)/i.test(
    value.trim()
  );
}

function detectHookActionPhrase(topic: string, useEnglish: boolean) {
  const normalized = clean(topic).toLowerCase();

  if (useEnglish) {
    if (/(instagram|reels|content|posts?)/i.test(normalized)) {
      return "publishing content";
    }
    if (/(real estate|property|realtor|listing)/i.test(normalized)) {
      return "posting property listings";
    }
    if (/(onboarding|activation)/i.test(normalized)) {
      return "improving onboarding";
    }
    if (/(pricing|price competition|discount)/i.test(normalized)) {
      return "competing on price";
    }
    if (/(mushroom|poison|edible|safety)/i.test(normalized)) {
      return "relying on guesswork";
    }
    return "working hard on this topic";
  }

  if (/(instagram|инстаграм|рилс|пост|контент)/i.test(normalized)) {
    return "постите контент в Instagram";
  }
  if (/(риелтор|недвиж|квартир|объект|сделк)/i.test(normalized)) {
    return "показываете объекты";
  }
  if (/(цен|конкуренц|скидк|дешев)/i.test(normalized)) {
    return "конкурируете ценой";
  }
  if (/(гриб|ядов|съедоб|безопас)/i.test(normalized)) {
    return "выбираете грибы наугад";
  }
  if (/(бренд|эксперт|блог)/i.test(normalized)) {
    return "ведёте экспертный блог";
  }
  return "делаете всё как обычно";
}

function detectHookOutcomePhrase(topic: string, useEnglish: boolean) {
  const normalized = clean(topic).toLowerCase();

  if (useEnglish) {
    if (/(lead|inbound|demand|request|application)/i.test(normalized)) {
      return "qualified leads";
    }
    if (/(sale|deal|close|revenue)/i.test(normalized)) {
      return "closed deals";
    }
    if (/(conversion|activation)/i.test(normalized)) {
      return "conversion growth";
    }
    if (/(trust|brand)/i.test(normalized)) {
      return "trust from the audience";
    }
    if (/(mushroom|poison|edible|safety)/i.test(normalized)) {
      return "safe decisions";
    }
    return "stable results";
  }

  if (/(заявк|лид|директ|клиент)/i.test(normalized)) {
    return "входящие заявки";
  }
  if (/(продаж|сделк|выручк|доход)/i.test(normalized)) {
    return "стабильные продажи";
  }
  if (/(конверс)/i.test(normalized)) {
    return "рост конверсии";
  }
  if (/(довер|бренд|эксперт)/i.test(normalized)) {
    return "доверие аудитории";
  }
  if (/(гриб|ядов|съедоб|безопас)/i.test(normalized)) {
    return "безопасный результат";
  }
  return "стабильный результат";
}

function buildHookTitle(topic: string) {
  const basis = clean(topic).replace(/\s+/g, " ").trim();
  if (!basis) {
    return "Вы делаете всё как раньше, но не получаете стабильный результат";
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
  const topicTokensForLimit = topicNucleus
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const looksLikeRuInfinitiveStart =
    !useEnglish && topicTokensForLimit.length >= 3 && /(ть|ти)$/.test(topicTokensForLimit[0] ?? "");
  const topicWordLimit = useEnglish ? 3 : looksLikeRuInfinitiveStart ? 3 : 2;
  let compactTopic = clampSentenceByWords(topicNucleus, topicWordLimit)
    .replace(/[.!?…]+$/g, "")
    .trim();

  if (!useEnglish) {
    const ruTokens = topicNucleus
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
    const hasDativeInfinitiveLead =
      ruTokens.length >= 3 && /у$/.test((ruTokens[0] ?? "").toLowerCase()) && /(ть|ти)$/.test((ruTokens[1] ?? "").toLowerCase());

    if (hasDativeInfinitiveLead) {
      const semanticTail = ruTokens
        .slice(2)
        .map((token) => token.replace(/[^\p{L}\p{N}-]/gu, ""))
        .filter((token) => token.length >= 4)
        .filter((token) => !SEARCH_STOP_WORDS.has(token.toLowerCase()))
        .slice(0, 2);
      if (semanticTail.length) {
        compactTopic = semanticTail.join(" ");
      }
    }
  }

  if (useEnglish) {
    compactTopic = compactTopic
      .replace(/\b(?:that|which)\b.*$/i, "")
      .trim();
  } else {
    compactTopic = compactTopic
      .replace(/\bкотор[а-яё]*\b.*$/i, "")
      .trim();
  }

  compactTopic = stripHangingEnding(compactTopic) || compactTopic;
  compactTopic = compactTopic
    .replace(/(?:^|\s)(вам|тебе|мне|нам|you|your|котор[а-яё]*)\s*$/i, "")
    .trim();

  if (/(?:^|\s)(which|that)\s*$/i.test(compactTopic) || /(?:^|\s)(не|without)\s*$/i.test(compactTopic)) {
    compactTopic = useEnglish ? "your content system" : "ваш контент";
  }
  if (countWords(compactTopic) < 2) {
    compactTopic = useEnglish ? "this topic" : "эта тема";
  }
  const normalizedTopic = compactTopic
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/^(эта|этот|эту)\s+/i, "")
    .trim();

  const actionPhrase = detectHookActionPhrase(normalizedTopic || basis, useEnglish);
  const outcomePhrase = detectHookOutcomePhrase(normalizedTopic || basis, useEnglish);
  const title = useEnglish
    ? `You keep ${actionPhrase}, but you're not getting ${outcomePhrase}`
    : `Вы ${actionPhrase}, но не получаете ${outcomePhrase}`;

  return clampTitle(title.replace(/\s{2,}/g, " "), 72);
}

function hasHookConflictFormula(value: string) {
  const normalized = clean(value).toLowerCase();
  if (!normalized) {
    return false;
  }

  const hasActor = /\b(вы|ты|you|your|ваш|ваши)\b/i.test(normalized);
  const hasAction = /(дела|публику|пиш|запуска|trying|doing|posting|publishing|working)/i.test(normalized);
  const hasConflictJoin = /\b(но|а|while|yet|but)\b/i.test(normalized);
  const hasNegativeOutcome =
    /(не\s+получ|не\s+вид|не\s+раст|не\s+работ|буксу|теря|слива|don't get|no leads|not getting|still no|no result)/i.test(
      normalized
    );

  return hasActor && hasAction && hasConflictJoin && hasNegativeOutcome;
}

function isMostlyEnglish(value: string) {
  const latin = (value.match(/[a-z]/gi) ?? []).length;
  const cyrillic = (value.match(/[а-яё]/gi) ?? []).length;
  return latin > 0 && latin >= cyrillic;
}

function countLatinLetters(value: string) {
  return (value.match(/[a-z]/gi) ?? []).length;
}

function countCyrillicLetters(value: string) {
  return (value.match(/[а-яё]/gi) ?? []).length;
}

function hasLanguageDriftForTopic(title: string, topic: string) {
  const topicIsEnglish = isMostlyEnglish(topic);
  if (!topicIsEnglish) {
    return false;
  }

  const latin = countLatinLetters(title);
  const cyrillic = countCyrillicLetters(title);
  return cyrillic >= 3 && cyrillic > latin;
}

function isHookLikeTitle(value: string) {
  const normalized = value.toLowerCase();
  if (hasHookConflictFormula(value)) {
    return true;
  }

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

function hasMalformedTitle(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  if (/^%/.test(normalized)) {
    return true;
  }

  if (/%\s*(пользовател|users|клиент|clients)/i.test(normalized)) {
    return true;
  }

  return false;
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
  const progressionFunctions: string[] = [];

  for (let index = 0; index < slides.length; index += 1) {
    const slide = slides[index];
    const planSlide = plan.slides[index];
    const title = clean(slide.title || "");
    const text = clean(slide.text || "");
    const merged = `${title}\n${text}`;
    const layout = normalizeLayoutType(planSlide?.layoutType ?? slide.layoutType ?? "card");
    const limits = LAYOUT_LIMITS[layout];
    const wordLimits = LAYOUT_WORD_LIMITS[layout];
    const role = normalizeScenarioRole(planSlide?.role ?? slide.role ?? "solution");
    const functionTag = resolveSlideFunction(plan, index);
    const isPainFunctionTag =
      functionTag === "pain-consequence" ||
      functionTag === "problem-amplify" ||
      functionTag === "mistake-consequence";
    progressionFunctions.push(functionTag);

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

    if (hasTemplateArtifactTitle(title)) {
      problematic.add(index);
      score -= 7;
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

    if (normalizeScenarioRole(planSlide?.role ?? slide.role ?? role) === "cta") {
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

    if (index === 0) {
      const hookStrength = assessHookStrength(title, text);
      if (hookStrength < 2) {
        problematic.add(index);
        score -= 10;
      } else {
        score += hookStrength;
      }
    }

    if (isPainFunctionTag && !hasConsequenceSignal(merged)) {
      problematic.add(index);
      score -= 8;
    }

    if (
      index > 0 &&
      index < slides.length - 1 &&
      !isPainFunctionTag &&
      !hasConcreteSpecificity(merged)
    ) {
      problematic.add(index);
      score -= 4;
    }

    if (functionTag === "proof-case" && !hasProofSignal(merged)) {
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

    if (topicIsEnglish && /[а-яё]{3,}/i.test(merged)) {
      problematic.add(index);
      score -= 5;
    }

    if (role === "cta") {
      const ctaStrength = assessCtaStrength(title, text);
      if (ctaStrength < 3) {
        problematic.add(index);
        score -= 8;
      } else {
        score += ctaStrength;
      }
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

  const uniqueFunctions = new Set(progressionFunctions);
  if (!uniqueFunctions.has("hook")) {
    problematic.add(0);
    score -= 12;
  }
  const hasProblemRole = plan.slides.some((slide) => normalizeScenarioRole(slide.role) === "problem");
  const hasComparisonRole = plan.slides.some((slide) => normalizeScenarioRole(slide.role) === "shift");
  const hasCaseRole = plan.slides.some((slide) => normalizeScenarioRole(slide.role) === "example");

  const hasPainFunction =
    uniqueFunctions.has("pain-consequence") ||
    uniqueFunctions.has("problem-amplify") ||
    uniqueFunctions.has("mistake-consequence");
  if (slides.length >= 6 && hasProblemRole && !hasPainFunction) {
    const firstProblem = plan.slides.findIndex(
      (slide, index) => index > 0 && normalizeScenarioRole(slide.role) === "problem"
    );
    if (firstProblem >= 0) {
      problematic.add(firstProblem);
    }
    score -= 8;
  }
  if (hasComparisonRole && !uniqueFunctions.has("reframing")) {
    const comparisonIndex = plan.slides.findIndex(
      (slide) => normalizeScenarioRole(slide.role) === "shift"
    );
    if (comparisonIndex >= 0) {
      problematic.add(comparisonIndex);
    }
    score -= 5;
  }
  if (hasCaseRole && !uniqueFunctions.has("proof-case")) {
    const caseIndex = plan.slides.findIndex(
      (slide) => normalizeScenarioRole(slide.role) === "example"
    );
    if (caseIndex >= 0) {
      problematic.add(caseIndex);
    }
    score -= 5;
  }
  if (!uniqueFunctions.has("cta")) {
    problematic.add(slides.length - 1);
    score -= 14;
  }

  const problematicIndexes = Array.from(problematic).sort((left, right) => left - right);
  return {
    needsRepair: problematicIndexes.length > 0,
    score,
    problematicIndexes
  };
}

function assessHookStrength(title: string, text: string) {
  const merged = `${title}\n${text}`.toLowerCase();
  let score = 0;

  if (hasHookConflictFormula(title)) {
    score += 2;
  }

  if (/(теря|слива|провал|ошиб|срыв|утечк|боль|потер|не\s+работ|дорого|loss|leak|costly|fail|mistake|pain|risk)/i.test(merged)) {
    score += 2;
  }
  if (/[!?]/.test(title) || /(главн|hidden|real reason|пока вы|you keep)/i.test(title)) {
    score += 1;
  }
  if (countWords(title) <= 12 && countWords(title) >= 4) {
    score += 1;
  }
  if (/(обзор|гайд|guide|summary|что такое|что работает)/i.test(title)) {
    score -= 2;
  }
  if (!hasHookConflictFormula(title)) {
    score -= 1;
  }

  return score;
}

function hasConsequenceSignal(value: string) {
  return /(теря|потер|утечк|срыв|дорог|риски|уходят|падает|просед|выгора|loss|leak|drop|risk|waste|stall|leads?\s+lost)/i.test(
    value
  );
}

function hasMistakeSignal(value: string) {
  return /(ошибк|миф|неправильн|делаете не то|wrong move|mistake|myth|wrong approach)/i.test(value);
}

function hasStructureSignal(value: string) {
  return /(шаг|план|структур|чеклист|что делать|по порядку|step|plan|framework|checklist|playbook|sequence)/i.test(
    value
  );
}

function hasConcreteSpecificity(value: string) {
  if (/\d/.test(value)) {
    return true;
  }
  if (/(чеклист|шаг|пример|кейс|формула|план|сценар|script|step|checklist|case|framework|example)/i.test(value)) {
    return true;
  }

  const words = countWords(value);
  return words >= 16 && !hasWeakCopy(value);
}

function hasProofSignal(value: string) {
  return /(кейс|пример|результат|получили|вырос|снизил|за\s+\d+|case|example|result|grew|reduced|within|after)/i.test(
    value
  );
}

function assessCtaStrength(title: string, text: string) {
  const merged = `${title}\n${text}`;
  let score = 0;

  if (CTA_ACTION_PATTERN.test(merged)) {
    score += 1;
  }
  if (/(получ|отправ|чеклист|шаблон|разбор|план|template|checklist|framework|audit|guide|dm)/i.test(merged)) {
    score += 1;
  }
  if (/(директ|direct|dm|comment|коммент|save|сохран)/i.test(merged)) {
    score += 1;
  }
  if (/(сейчас|сегодня|today|now)/i.test(merged)) {
    score += 1;
  }

  return score;
}

function validateFunnelQuality(
  topic: string,
  slides: CarouselOutlineSlide[],
  plan: CarouselPlan
): GenerationQualityFlags {
  if (!slides.length) {
    return {
      hasPain: false,
      hasProgression: false,
      hasRecognitionMoment: false,
      hasMindsetShift: false,
      hasTopicLinkedCta: false,
      hasNarrativeCoverage: false
    };
  }

  const normalizedTopicTokens = extractTopicKeywords(topic);
  const functionTags = slides.map((_, index) => resolveSlideFunction(plan, index));
  const hasFunctionTag = (targets: string[]) =>
    functionTags.some((tag) => targets.includes(tag));
  const normalizedRoles = slides.map((slide, index) =>
    normalizeScenarioRole(plan.slides[index]?.role ?? slide.role ?? "solution")
  );

  const hasPain = slides.some((slide, index) => {
    const role = normalizedRoles[index];
    const merged = `${slide.title}\n${slide.text}`;
    return (
      role === "problem" ||
      role === "amplify" ||
      role === "consequence" ||
      hasConsequenceSignal(merged) ||
      /(теря|слива|срыв|дорог|потер|утечк|бол|не работает|проблем|loss|leak|pain|fails|risk)/i.test(
        merged
      )
    );
  });

  const indexOfHook = functionTags.findIndex((item) => item === "hook");
  const indexOfProblem = functionTags.findIndex(
    (item) =>
      item === "problem" ||
      item === "problem-amplify" ||
      item === "pain-consequence"
  );
  const indexOfShift = functionTags.findIndex((item) => item === "reframing");
  const indexOfSolution = functionTags.findIndex((item) => item === "solution" || item === "steps");
  const indexOfCta = functionTags.findIndex((item) => item === "cta");
  const hasProgression =
    indexOfHook === 0 &&
    indexOfProblem > indexOfHook &&
    indexOfShift > indexOfProblem &&
    indexOfSolution > indexOfShift &&
    indexOfCta === slides.length - 1;

  const hasRecognitionMoment = slides.some((slide, index) => {
    if (index === 0 || index === slides.length - 1) {
      return false;
    }

    const merged = `${slide.title}\n${slide.text}`;
    return (
      /(вы|тебя|вам|вас|you|your|client|клиент)/i.test(merged) &&
      /(теря|ошиб|проблем|буксу|слив|не работает|бол|loss|mistake|pain|fails|leak|risk)/i.test(
        merged
      )
    );
  });

  const hasMindsetShift = slides.some((slide, index) => {
    const role = normalizedRoles[index];
    const merged = `${slide.title}\n${slide.text}`;
    return (
      role === "shift" ||
      /это\s+не\s+.+,\s*это\s+.+/i.test(merged) ||
      /\bне\b.+\bа\b.+/i.test(merged) ||
      /not\s+.+,\s*but\s+.+/i.test(merged) ||
      /mindset shift|reframe|new lens/i.test(merged)
    );
  });

  const hasAmplify =
    hasFunctionTag(["problem-amplify", "pain-consequence"]) ||
    slides.some((slide, index) => {
    const role = normalizedRoles[index];
    if (role === "amplify") {
      return true;
    }
    if (role === "problem" || role === "mistake" || role === "consequence") {
      return hasConsequenceSignal(`${slide.title}\n${slide.text}`);
    }
    return false;
  });

  const hasMistake =
    hasFunctionTag(["mistake-break", "mistake-consequence"]) ||
    slides.some((slide, index) => {
    const role = normalizedRoles[index];
    return role === "mistake" || role === "myth" || hasMistakeSignal(`${slide.title}\n${slide.text}`);
  });

  const hasConsequence =
    hasFunctionTag(["pain-consequence", "mistake-consequence"]) ||
    slides.some((slide, index) => {
    const role = normalizedRoles[index];
    return role === "consequence" || hasConsequenceSignal(`${slide.title}\n${slide.text}`);
  });

  const hasStructure =
    hasFunctionTag(["steps"]) ||
    slides.some((slide, index) => {
    const role = normalizedRoles[index];
    const merged = `${slide.title}\n${slide.text}`;
    return role === "structure" || isStructureRole(role) || hasStructureSignal(merged);
  });

  const hasExample =
    hasFunctionTag(["proof-case"]) ||
    slides.some((slide, index) => {
    const role = normalizedRoles[index];
    return isExampleRole(role) || hasProofSignal(`${slide.title}\n${slide.text}`);
  });

  const ctaSlide = slides[slides.length - 1];
  const ctaMerged = ctaSlide ? `${ctaSlide.title}\n${ctaSlide.text}` : "";
  const ctaHasAction = CTA_ACTION_PATTERN.test(ctaMerged);
  const ctaHasTopicLink =
    normalizedTopicTokens.length === 0 ||
    normalizedTopicTokens.some((token) => new RegExp(`\\b${escapeRegExp(token)}\\b`, "i").test(ctaMerged)) ||
    new RegExp(`\\b${escapeRegExp(buildActionKeyword(topic, isMostlyEnglish(topic)))}\\b`, "i").test(
      ctaMerged
    );
  const hasTopicLinkedCta =
    ctaHasAction && ctaHasTopicLink && assessCtaStrength(ctaSlide?.title ?? "", ctaSlide?.text ?? "") >= 3;
  const hasNarrativeCoverage =
    hasAmplify &&
    hasMistake &&
    hasConsequence &&
    hasStructure &&
    (slides.length <= 8 ? true : hasExample);

  return {
    hasPain,
    hasProgression,
    hasRecognitionMoment,
    hasMindsetShift,
    hasTopicLinkedCta,
    hasNarrativeCoverage
  };
}

function isFunnelQualityValid(flags: GenerationQualityFlags) {
  return (
    flags.hasPain &&
    flags.hasProgression &&
    flags.hasRecognitionMoment &&
    flags.hasMindsetShift &&
    flags.hasTopicLinkedCta &&
    flags.hasNarrativeCoverage
  );
}

function extractTopicKeywords(topic: string) {
  return Array.from(
    new Set(
      clean(topic)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, " ")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 4)
        .filter((token) => !SEARCH_STOP_WORDS.has(token))
        .slice(0, 8)
    )
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pickFunnelRepairIndexes(
  flags: GenerationQualityFlags,
  slides: CarouselOutlineSlide[],
  plan: CarouselPlan
) {
  const selected = new Set<number>();
  const findIndexByFunction = (target: string) =>
    slides.findIndex((_, index) => resolveSlideFunction(plan, index) === target);

  if (!flags.hasPain) {
    ["problem", "problem-amplify", "pain-consequence", "mistake-consequence"].forEach((fn) => {
      const index = findIndexByFunction(fn);
      if (index >= 0) {
        selected.add(index);
      }
    });
  }

  if (!flags.hasRecognitionMoment) {
    const problemIndex = findIndexByFunction("problem");
    const mergedProblemIndex = findIndexByFunction("problem-amplify");
    if (problemIndex >= 0) {
      selected.add(problemIndex);
    } else if (mergedProblemIndex >= 0) {
      selected.add(mergedProblemIndex);
    }
  }

  if (!flags.hasMindsetShift) {
    const shiftIndex = findIndexByFunction("reframing");
    if (shiftIndex >= 0) {
      selected.add(shiftIndex);
    }
  }

  if (!flags.hasNarrativeCoverage) {
    ["mistake-break", "mistake-consequence", "steps", "proof-case"].forEach((fn) => {
      const index = findIndexByFunction(fn);
      if (index >= 0) {
        selected.add(index);
      }
    });
  }

  if (!flags.hasTopicLinkedCta) {
    selected.add(Math.max(0, slides.length - 1));
  }

  if (!flags.hasProgression) {
    [0, 1, Math.max(0, slides.length - 2), Math.max(0, slides.length - 1)].forEach((index) => {
      selected.add(index);
    });
  }

  return Array.from(selected)
    .filter((index) => index >= 0 && index < slides.length)
    .slice(0, 6)
    .sort((left, right) => left - right);
}

function pickCriticalRepairIndexes(
  slides: CarouselOutlineSlide[],
  problematicIndexes: number[]
) {
  if (!problematicIndexes.length) {
    return [];
  }

  const maxRepairs = Math.max(2, Math.min(5, Math.ceil(slides.length * 0.55)));
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
      if (index === 0 && assessHookStrength(title, text) < 2) {
        severity += 8;
      }

      if (index === slides.length - 1 && !CTA_ACTION_PATTERN.test(text)) {
        severity += 7;
      }
      if (index === slides.length - 1 && assessCtaStrength(title, text) < 3) {
        severity += 8;
      }

      if (hasTemplateArtifactTitle(title)) {
        severity += 6;
      }

      if (index > 0 && index < slides.length - 1 && !hasConcreteSpecificity(`${title}\n${text}`)) {
        severity += 4;
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
    const planSlide = plan.slides[index] ?? buildFallbackPlanSlide(topic, "solution", index, totalSlides, inferTopicLens(topic, brief.sourceIdeas), brief.sourceIdeas);
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

    const planSlide = plan.slides[index] ?? buildFallbackPlanSlide(topic, "solution", index, totalSlides, inferTopicLens(topic, brief.sourceIdeas), brief.sourceIdeas);
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
        index === 0 ? "hook" : index === totalSlides - 1 ? "cta" : "solution",
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
          right === 0 ? "hook" : right === totalSlides - 1 ? "cta" : "solution",
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
  if (last && assessCtaStrength(last.title, last.text) < 3) {
    const useEnglish = isMostlyEnglish(topic);
    const keyword = buildActionKeyword(topic, useEnglish);
    const ctaPadding = useEnglish
      ? `${buildCtaBody(topic, keyword, useEnglish)}\nSave this carousel and apply one step today.`
      : `${buildCtaBody(topic, keyword, useEnglish)}\nСохраните карусель и внедрите один шаг сегодня.`;
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
  painModel: CarouselPainModel,
  options?: GenerationOptions
): CarouselPlan {
  const inputShape = deriveInputShape(topic, brief);
  const scenario = chooseScenarioId(topic, lens, brief, inputShape);
  const angle = deriveNarrativeAngle(topic, lens, brief, scenario, inputShape);
  const commercialIntensity = deriveCommercialIntensity(topic, lens, brief, scenario, inputShape);
  const roles = buildRoleSequence(targetCount);
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
      allowInternetImages,
      angle,
      commercialIntensity,
      inputShape
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
    painModel,
    scenario,
    angle,
    commercialIntensity,
    inputShape,
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
  allowInternetImages = true,
  angle: NarrativeAngle = "opportunity-shift",
  commercialIntensity: CommercialIntensity = "medium",
  inputShape: InputShape = "topic-only"
): CarouselPlanSlide {
  const seed = pickSeedLine(seeds, index, topic);
  const coreIdea = buildCoreIdea(
    role,
    seed,
    topic,
    index,
    totalSlides,
    scenario,
    angle,
    commercialIntensity,
    inputShape
  );
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

function deriveInputShape(topic: string, brief: ParsedBrief): InputShape {
  const merged = `${topic}\n${brief.sourceIdeas.join("\n")}`.toLowerCase();
  if (CASE_SIGNAL_PATTERN.test(merged)) {
    return "case-driven";
  }
  if (DIRECTIVE_SIGNAL_PATTERN.test(merged) && brief.structureHints.length >= 2) {
    return "directive";
  }
  if (LIST_SIGNAL_PATTERN.test(merged) || brief.sourceIdeas.length >= 4) {
    return "idea-list";
  }

  return "topic-only";
}

function deriveNarrativeAngle(
  topic: string,
  lens: TopicLens,
  brief: ParsedBrief,
  scenario: ScenarioId,
  inputShape: InputShape
): NarrativeAngle {
  const merged = `${topic} ${brief.sourceIdeas.join(" ")} ${brief.structureHints.join(" ")}`.toLowerCase();

  if (/(потер|срыв|риски|утечк|слив|теря|loss|risk|leak|drop|fail)/i.test(merged)) {
    return "loss-risk";
  }
  if (/(ошибк|миф|не работает|wrong|mistake|myth)/i.test(merged)) {
    return "mistake-breakdown";
  }
  if (inputShape === "case-driven" || scenario === "case-driven") {
    return "case-proof";
  }
  if (inputShape === "idea-list" || /(план|шаг|чеклист|структур|step|plan|checklist)/i.test(merged)) {
    return "process-playbook";
  }
  if (
    lens.category === "marketing-sales" ||
    lens.category === "business" ||
    scenario === "commercial"
  ) {
    return "loss-risk";
  }

  return "opportunity-shift";
}

function deriveCommercialIntensity(
  topic: string,
  lens: TopicLens,
  brief: ParsedBrief,
  scenario: ScenarioId,
  inputShape: InputShape
): CommercialIntensity {
  const merged = `${topic} ${brief.sourceIdeas.join(" ")} ${brief.qualityHints.join(" ")}`.toLowerCase();
  let score = 0;

  if (COMMERCIAL_HIGH_SIGNAL_PATTERN.test(merged)) {
    score += 2;
  }
  if (COMMERCIAL_MID_SIGNAL_PATTERN.test(merged)) {
    score += 1;
  }
  if (scenario === "commercial") {
    score += 2;
  }
  if (lens.category === "marketing-sales" || lens.category === "real-estate") {
    score += 1;
  }
  if (inputShape === "case-driven") {
    score += 1;
  }
  if (/(срочно|прямо сейчас|urgent|now|today)/i.test(merged)) {
    score += 1;
  }

  if (score >= 5) {
    return "high";
  }
  if (score >= 3) {
    return "medium";
  }

  return "low";
}

function chooseScenarioId(
  topic: string,
  lens: TopicLens,
  brief: ParsedBrief,
  inputShape: InputShape = "topic-only"
): ScenarioId {
  const merged = `${topic} ${brief.sourceIdeas.join(" ")} ${brief.structureHints.join(" ")}`.toLowerCase();

  if (inputShape === "case-driven" || /(кейс|пример|разбор|реальный случай|case study|case\b|example\b)/i.test(merged)) {
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

function buildFunnelStageAssignments(targetCount: number): SlideStageAssignment[] {
  const safeTarget = Math.max(8, Math.min(10, targetCount));

  if (safeTarget >= 10) {
    return FUNNEL_SEQUENCE_10.map((assignment) => ({
      role: assignment.role,
      stages: [...assignment.stages]
    }));
  }

  if (safeTarget === 9) {
    return FUNNEL_SEQUENCE_9.map((assignment) => ({
      role: assignment.role,
      stages: [...assignment.stages]
    }));
  }

  return FUNNEL_SEQUENCE_8.map((assignment) => ({
    role: assignment.role,
    stages: [...assignment.stages]
  }));
}

function buildRoleSequence(targetCount: number): CarouselSlideRole[] {
  return buildFunnelStageAssignments(targetCount).map((assignment) => assignment.role);
}

function getStagesForSlideIndex(totalSlides: number, index: number): FunnelStage[] {
  const assignments = buildFunnelStageAssignments(totalSlides);
  const safeIndex = Math.max(0, Math.min(index, assignments.length - 1));
  return assignments[safeIndex]?.stages ?? [];
}

function chooseLayoutForRole(
  role: CarouselSlideRole,
  imageIntent: CarouselImageIntent,
  scenario: ScenarioId = "expert"
): CarouselLayoutType {
  const normalizedRole = normalizeScenarioRole(role);

  if (
    imageIntent !== "none" &&
    (isHookRole(normalizedRole) ||
      normalizedRole === "problem" ||
      normalizedRole === "amplify" ||
      isExampleRole(normalizedRole))
  ) {
    return "image-top";
  }

  if (isHookRole(normalizedRole)) {
    return "hero";
  }

  if (normalizedRole === "problem") {
    return scenario === "commercial" ? "dark-slide" : "statement";
  }

  if (normalizedRole === "amplify") {
    return scenario === "commercial" ? "dark-slide" : "statement";
  }

  if (normalizedRole === "myth") {
    return scenario === "educational" ? "split" : "statement";
  }

  if (normalizedRole === "mistake") {
    return scenario === "commercial" ? "statement" : "list";
  }

  if (normalizedRole === "consequence") {
    return scenario === "commercial" ? "dark-slide" : "statement";
  }

  if (normalizedRole === "shift") {
    return "split";
  }

  if (normalizedRole === "solution") {
    return scenario === "commercial" ? "card" : "title-body";
  }

  if (normalizedRole === "structure") {
    return "list";
  }

  if (normalizedRole === "example") {
    return scenario === "case-driven" ? "split" : "card";
  }

  if (normalizedRole === "comparison") {
    return "split";
  }

  if (normalizedRole === "summary") {
    return scenario === "commercial" ? "statement" : "split";
  }

  if (normalizedRole === "cta") {
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
  const normalizedRole = normalizeScenarioRole(role);
  const pool =
    familyPool[normalizedRole] ??
    familyPool.solution ??
    familyPool.tip ??
    familyPool.hook ??
    familyPool.problem ??
    ["minimal"];
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
      const darkPool =
        TEMPLATE_FAMILY_POOLS["dark-premium"][normalizeScenarioRole(slide.role)] ??
        TEMPLATE_FAMILY_POOLS["dark-premium"].solution ??
        TEMPLATE_FAMILY_POOLS["dark-premium"].tip ??
        TEMPLATE_FAMILY_POOLS["dark-premium"].hook ??
        ["netflix"];
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
  const normalizedRole = normalizeScenarioRole(role);

  if (!allowInternetImages) {
    return "none";
  }

  if (
    normalizedRole === "cta" ||
    isStructureRole(normalizedRole) ||
    normalizedRole === "solution" ||
    normalizedRole === "problem" ||
    normalizedRole === "amplify" ||
    normalizedRole === "consequence" ||
    normalizedRole === "mistake" ||
    normalizedRole === "shift"
  ) {
    return "none";
  }

  if (lens.imageScore < 0.34) {
    return "none";
  }

  if (isHookRole(normalizedRole)) {
    if (lens.category === "education-visual" || lens.category === "health-safety") {
      return "object-photo";
    }
    if (lens.category === "real-estate") {
      return "subject-photo";
    }
    return lens.imageScore > 0.58 ? "subject-photo" : "conceptual-photo";
  }

  if (isExampleRole(normalizedRole)) {
    if (lens.category === "health-safety") {
      return "subject-photo";
    }
    return lens.category === "real-estate" ? "people-photo" : "object-photo";
  }

  return "none";
}

function buildCoreIdea(
  role: CarouselSlideRole,
  seed: string,
  topic: string,
  index: number,
  totalSlides: number,
  scenario: ScenarioId = "expert",
  angle: NarrativeAngle = "opportunity-shift",
  commercialIntensity: CommercialIntensity = "medium",
  _inputShape: InputShape = "topic-only"
) {
  const normalizedRole = normalizeScenarioRole(role);
  const topicClean = clean(topic).slice(0, 140) || "теме";
  const seedClean = clean(seed).slice(0, 140);
  const seedUseful = seedClean && seedClean.toLowerCase() !== topicClean.toLowerCase() ? seedClean : "";
  const focus = seedUseful || topicClean;
  const useEnglish = isMostlyEnglish(`${topicClean} ${focus}`);
  const isConsequenceSlide =
    normalizedRole === "consequence" ||
    normalizedRole === "amplify" ||
    (normalizedRole === "problem" && index > 1);
  const isCommercialTone = commercialIntensity === "high" || scenario === "commercial";

  if (useEnglish) {
    if (isHookRole(normalizedRole)) {
      if (isCommercialTone) {
        return `You do ${focus}, but still don't get stable qualified demand`;
      }
      if (angle === "loss-risk") {
        return `Hidden loss in ${focus}: activity is high, but pipeline keeps leaking`;
      }
      if (angle === "mistake-breakdown") {
        return `One mistake in ${focus} quietly destroys conversion`;
      }
      if (angle === "case-proof") {
        return `Real-world conflict in ${focus}: why effort still fails without a system`;
      }
      return `Core conflict in ${focus}: effort is high, outcomes stay unstable`;
    }
    if (normalizedRole === "problem") {
      return `Core problem in ${focus}: the audience does not see a reason to trust your decision logic`;
    }
    if (normalizedRole === "amplify") {
      return `Pressure point in ${focus}: while you publish content, client intent keeps cooling down`;
    }
    if (normalizedRole === "consequence" || isConsequenceSlide) {
      return `Consequence in ${focus}: no trust means no action, no action means unstable revenue`;
    }
    if (normalizedRole === "myth") {
      return `Popular myth in ${focus} that creates false confidence`;
    }
    if (normalizedRole === "mistake") {
      return isCommercialTone
        ? `Costly mistake in ${focus}: you sell features while client still fears risk`
        : `Critical mistake in ${focus} that quietly kills momentum`;
    }
    if (normalizedRole === "shift") {
      return `Mindset shift in ${focus}: this is not louder promotion, it's trust architecture`;
    }
    if (normalizedRole === "solution") {
      return angle === "process-playbook"
        ? `Working principle for ${focus}: turn painful questions into practical answers`
        : `Working principle for ${focus}: move from generic claims to pain-led proof`;
    }
    if (normalizedRole === "structure") {
      return `Execution structure for ${focus}: a short sequence from pain to action`;
    }
    if (normalizedRole === "tip") {
      return `Practical system move for ${focus} that can be executed today`;
    }
    if (normalizedRole === "steps") {
      return `Action plan: 3-5 steps to execute ${focus} without chaos`;
    }
    if (normalizedRole === "checklist") {
      return `Checklist before launch: what must be true in ${focus}`;
    }
    if (normalizedRole === "example") {
      return `Short case in ${focus}: one concrete action that produced measurable result`;
    }
    if (normalizedRole === "comparison") {
      return `Reframing: high-leverage approach vs weak routine in ${focus}`;
    }
    if (normalizedRole === "summary") {
      return isCommercialTone
        ? `Summary: the trust-first principle that turns ${focus} into predictable demand`
        : `Key principle behind sustainable progress in ${focus}`;
    }
    if (index === totalSlides - 1 || normalizedRole === "cta") {
      return isCommercialTone
        ? `CTA: make one concrete move in ${focus} today and capture qualified demand`
        : `CTA: the first concrete move to make in ${focus} today`;
    }
    return `Practical insight that improves ${focus}`;
  }

  if (isHookRole(normalizedRole)) {
    if (isCommercialTone) {
      return `Вы делаете «${focus}», но всё равно не получаете стабильные заявки`;
    }
    if (angle === "loss-risk") {
      return `Скрытая потеря в теме «${focus}»: действий много, а заявки продолжают утекать`;
    }
    if (angle === "mistake-breakdown") {
      return `Одна ошибка в теме «${focus}» тихо убивает конверсию`;
    }
    if (angle === "case-proof") {
      return `Реальный конфликт в теме «${focus}»: почему усилия не дают результата без системы`;
    }
    return `Главный конфликт в теме «${focus}»: усилия есть, результат нестабилен`;
  }
  if (normalizedRole === "problem") {
    return `Проблема в теме «${focus}»: клиент не видит причин доверять вам решение своей задачи`;
  }
  if (normalizedRole === "amplify") {
    return `Усиление проблемы в теме «${focus}»: вы постите контент, а диалоги в директе не запускаются`;
  }
  if (normalizedRole === "consequence" || isConsequenceSlide) {
    return `Последствие в теме «${focus}»: без доверия теряются заявки, деньги и темп роста`;
  }
  if (normalizedRole === "myth") {
    return `Популярный миф в теме «${focus}», который даёт ложную уверенность`;
  }
  if (normalizedRole === "mistake") {
    return isCommercialTone
      ? `Дорогая ошибка в теме «${focus}»: вы продаёте услугу, пока клиент не прожил свою боль`
      : `Критичная ошибка в теме «${focus}», которая съедает прогресс`;
  }
  if (normalizedRole === "shift") {
    return `Перелом мышления в теме «${focus}»: это не про больше контента, это про точное попадание в боль клиента`;
  }
  if (normalizedRole === "solution") {
    return angle === "process-playbook"
      ? `Решение по теме «${focus}»: превращайте боль клиента в понятный сценарий решения`
      : `Рабочий принцип по теме «${focus}»: меньше общих слов, больше доказуемой пользы`;
  }
  if (normalizedRole === "structure") {
    return `Структура действий по теме «${focus}»: маршрут от боли к заявке`;
  }
  if (normalizedRole === "tip") {
    return `Практический приём в теме «${focus}», который даёт измеримый сдвиг`;
  }
  if (normalizedRole === "steps") {
    return `План действий: 3-5 шагов, чтобы внедрить решение по теме «${focus}»`;
  }
  if (normalizedRole === "checklist") {
    return `Чеклист перед запуском: что обязательно проверить в теме «${focus}»`;
  }
  if (normalizedRole === "example") {
    return `Кейс по теме «${focus}»: конкретное действие и измеримый результат`;
  }
  if (normalizedRole === "comparison") {
    return `Смена рамки: рабочий подход и путь, который тормозит результат в теме «${focus}»`;
  }
  if (normalizedRole === "summary") {
    return isCommercialTone
      ? `Итог: принцип доверия, который превращает тему «${focus}» в прогнозируемые заявки`
      : `Ключевой принцип устойчивого результата в теме «${focus}»`;
  }
  if (index === totalSlides - 1 || normalizedRole === "cta") {
    return isCommercialTone
      ? `CTA: какой шаг по теме «${focus}» сделать сегодня, чтобы получить входящий спрос`
      : `CTA: что сделать прямо сейчас по теме «${focus}»`;
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
    hook: "Вы делаете много, но результат не меняется",
    cover: "Вы теряете результат и даже не замечаете",
    problem: "Где система ломается и почему клиент не выбирает вас",
    amplify: "Что вы теряете каждый раз, когда оставляете всё как есть",
    myth: "Миф, который мешает результату",
    mistake: "Ошибка, которая всё ломает",
    consequence: "К чему это приводит на практике",
    shift: "Главный перелом мышления",
    solution: "Что работает вместо этого",
    structure: "Пошаговая структура действий",
    tip: "Что сделать прямо сейчас",
    steps: "Пошаговый план действий",
    checklist: "Чеклист перед запуском",
    example: "Пример из практики",
    case: "Кейс из практики",
    comparison: "Как правильно и как не надо",
    summary: "Ключевой вывод",
    cta: "Хотите готовый следующий шаг?"
  };
  const fallbackByRoleEn: Record<CarouselSlideRole, string> = {
    hook: "You do a lot, but outcomes stay unstable",
    cover: "You're losing results without noticing",
    problem: "Where the system breaks and trust disappears",
    amplify: "What keeps getting lost while you repeat this pattern",
    myth: "Myth that blocks your result",
    mistake: "Mistake that breaks performance",
    consequence: "What this leads to in practice",
    shift: "Main mindset shift",
    solution: "What works instead",
    structure: "Action structure",
    tip: "Action you can take today",
    steps: "Step-by-step plan",
    checklist: "Pre-launch checklist",
    example: "Practical example",
    case: "Real case snapshot",
    comparison: "What to do vs avoid",
    summary: "Key takeaway",
    cta: "Want the exact next step?"
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

  const normalizedRole = normalizeScenarioRole(planSlide.role);
  const rawIdea = clean(planSlide.coreIdea);
  const idea = rawIdea && !isTemplateCoreIdea(rawIdea) ? rawIdea : "";
  if (isHookRole(normalizedRole) && (!idea || isWeakHookTitle(idea))) {
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
    : isHookRole(normalizedRole)
      ? buildHookTitle(topic)
      : fallbackByRole[normalizedRole] || fallbackByRole.solution;
  const maxLength = LAYOUT_LIMITS[normalizeLayoutType(planSlide.layoutType)].titleMax;
  const fitted = clampTitle(basis, maxLength);
  if (!isIncompleteTitle(fitted)) {
    return fitted;
  }

  return clampTitle(fallbackByRole[normalizedRole] || fallbackByRole.solution, maxLength);
}

function buildRoleFallbackTitle(role: CarouselSlideRole, coreIdea: string) {
  const useEnglish = isMostlyEnglish(coreIdea);
  const ru: Record<CarouselSlideRole, string> = {
    hook: "Боль понятна, но результат всё ещё буксует",
    cover: "Где сливается результат и как это остановить",
    problem: "Где теряется результат",
    amplify: "Почему проблема становится острее",
    myth: "Миф, который мешает",
    mistake: "Ошибка, которая тормозит рост",
    consequence: "Цена этой ошибки",
    shift: "Перелом в мышлении",
    solution: "Что реально работает",
    structure: "Структура внедрения",
    tip: "Что реально работает",
    steps: "Пошаговый план",
    checklist: "Короткий чеклист",
    example: "Пример на практике",
    case: "Кейс из практики",
    comparison: "Что работает vs что тормозит",
    summary: "Главный вывод",
    cta: "Что сделать сейчас"
  };
  const en: Record<CarouselSlideRole, string> = {
    hook: "Pain is clear, but outcome still stalls",
    cover: "Where results leak and how to fix it",
    problem: "Where results leak",
    amplify: "Why the issue gets worse",
    myth: "Myth that blocks progress",
    mistake: "Costly mistake to fix first",
    consequence: "Cost of this mistake",
    shift: "Mindset shift",
    solution: "What actually works",
    structure: "Execution structure",
    tip: "What actually works",
    steps: "Step-by-step plan",
    checklist: "Quick checklist",
    example: "Practical example",
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
  const lens = inferTopicLens(topic, brief.sourceIdeas);
  const isCommercialContext =
    lens.category === "marketing-sales" ||
    lens.category === "business" ||
    lens.category === "real-estate" ||
    lens.category === "personal-brand";
  const useEnglish = isMostlyEnglish(`${topic} ${planSlide?.coreIdea ?? ""}`);
  const role = normalizeScenarioRole(
    planSlide?.role ?? (index === 0 ? "hook" : index === totalSlides - 1 ? "cta" : "solution")
  );
  const coreIdea = planSlide?.coreIdea ?? pickSeedLine(brief.sourceIdeas, index, topic);
  const shortIdea = summarizeCoreIdea(coreIdea, useEnglish);
  const ctaKeyword = buildActionKeyword(topic, useEnglish);

  if (role === "hook") {
    return useEnglish
      ? [
          isCommercialContext
            ? "You're doing the work, but qualified demand still doesn't move."
            : "You're putting in effort, but the result still feels unstable.",
          isCommercialContext
            ? "Swipe: we turn this pain into a practical lead-ready flow."
            : "Swipe: we turn this pain into a clear step-by-step outcome."
        ].join("\n")
      : [
          isCommercialContext
            ? "Вы делаете действия, но заявки всё равно буксуют."
            : "Вы прикладываете усилия, но результат всё равно нестабилен.",
          isCommercialContext
            ? "Листайте: превратим тему в рабочую систему от боли к действию."
            : "Листайте: соберём тему в понятную систему от проблемы к действию."
        ].join("\n");
  }

  if (role === "problem") {
    return useEnglish
      ? [
          `Problem: ${shortIdea}.`,
          isCommercialContext
            ? "People consume content, but still hesitate to trust and act."
            : "People read the content, but still don't know what exact action to take."
        ].join("\n")
      : [
          `Проблема: ${shortIdea}.`,
          isCommercialContext
            ? "Люди читают контент, но не переходят к диалогу и решению."
            : "Люди читают материал, но не понимают, что делать дальше."
        ].join("\n");
  }

  if (role === "amplify") {
    return useEnglish
      ? [
          `Amplification: ${shortIdea}.`,
          isCommercialContext
            ? "While you explain details, client anxiety grows and decision gets postponed."
            : "While details increase, clarity drops and mistakes become more likely."
        ].join("\n")
      : [
          `Усиление: ${shortIdea}.`,
          isCommercialContext
            ? "Пока вы объясняете детали, тревога клиента растёт, а решение откладывается."
            : "Пока деталей становится больше, ясность падает, а риск ошибки растёт."
        ].join("\n");
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

  if (role === "consequence") {
    return useEnglish
      ? [
          `Consequence: ${shortIdea}.`,
          isCommercialContext
            ? "You lose trust first, then response rate, then predictable revenue."
            : "You lose confidence first, then consistency, then reliable outcomes."
        ].join("\n")
      : [
          `Последствие: ${shortIdea}.`,
          isCommercialContext
            ? "Сначала падает доверие, затем ответы, затем предсказуемость заявок."
            : "Сначала теряется ясность, затем стабильность, потом предсказуемый результат."
        ].join("\n");
  }

  if (role === "shift") {
    return useEnglish
      ? [
          "Mindset shift: this is not about more posts.",
          "This is about hitting one painful decision point and proving expertise there."
        ].join("\n")
      : [
          "Перелом: проблема не в количестве постов.",
          "Проблема в том, попадаете ли вы в болевую точку и доказываете ли экспертизу."
        ].join("\n");
  }

  if (role === "solution" || role === "tip") {
    return useEnglish
      ? [
          `Solution: ${shortIdea}.`,
          "Use one pain-led message, one practical mechanic, one explicit next step."
        ].join("\n")
      : [
          `Решение: ${shortIdea}.`,
          "Одна боль, одна рабочая механика, один понятный следующий шаг."
        ].join("\n");
  }

  if (role === "structure" || role === "steps") {
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

  if (role === "example" || role === "case") {
    return useEnglish
      ? [
          `Case: ${shortIdea}.`,
          isCommercialContext
            ? "Action: switched to pain-led storytelling. Result: inbound messages became predictable."
            : "Action: replaced generic tips with clear steps. Result: people started applying it without confusion."
        ].join("\n")
      : [
          `Кейс: ${shortIdea}.`,
          isCommercialContext
            ? "Действие: перешли на контент от боли к решению. Результат: входящие стали регулярными."
            : "Действие: заменили общие советы на чёткие шаги. Результат: люди начали применять материал без путаницы."
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
        buildCtaBody(topic, ctaKeyword, useEnglish),
        "Save this carousel so you can reuse the framework today."
      ].join("\n")
    : [
        buildCtaBody(topic, ctaKeyword, useEnglish),
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

function buildCtaBody(source: string, keyword: string, useEnglish: boolean) {
  const intensity = COMMERCIAL_HIGH_SIGNAL_PATTERN.test(source)
    ? "high"
    : COMMERCIAL_MID_SIGNAL_PATTERN.test(source)
      ? "medium"
      : "low";

  if (useEnglish) {
    if (intensity === "high") {
      return `Want a conversion-ready result? Write "${keyword}" in DM — I’ll send the script and first-step framework.`;
    }
    if (intensity === "medium") {
      return `Want a practical result? Write "${keyword}" in DM — I’ll send the structure you can apply today.`;
    }

    return `Want a clear next step? Write "${keyword}" in DM — I’ll send a compact action template.`;
  }

  if (intensity === "high") {
    return `Хотите результат в заявках? Напишите в директ «${keyword}» — отправлю сценарий и структуру под вашу тему.`;
  }
  if (intensity === "medium") {
    return `Хотите рабочий результат? Напишите в директ «${keyword}» — отправлю практичный шаблон на сегодня.`;
  }

  return `Хотите готовый следующий шаг? Напишите в директ «${keyword}» — отправлю короткий рабочий шаблон.`;
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
  const normalizedRole = normalizeScenarioRole(role);
  const resolvedLayout = normalizeLayoutType(layoutType);
  const limits = LAYOUT_LIMITS[resolvedLayout];
  const wordLimits = LAYOUT_WORD_LIMITS[resolvedLayout];
  let fittedTitle = clampTitle(title, limits.titleMax);
  if (countWords(fittedTitle) > wordLimits.titleWords + 2) {
    fittedTitle = clampSentenceByWords(fittedTitle, wordLimits.titleWords + 2);
  }
  if (isIncompleteTitle(fittedTitle) || countWords(fittedTitle) < 3) {
    fittedTitle = buildRoleFallbackTitle(normalizedRole, coreIdea);
  }
  fittedTitle = clampTitle(fittedTitle, limits.titleMax);

  let preparedBody = ensureMicroIdeaBody(body, normalizedRole, coreIdea, resolvedLayout);
  if (STRUCTURED_LAYOUTS.has(resolvedLayout)) {
    preparedBody = toStructuredBody(
      preparedBody,
      resolvedLayout,
      normalizedRole,
      coreIdea,
      wordLimits.lineWords
    );
  } else {
    preparedBody = toCompactBody(preparedBody, wordLimits.bodyWords, wordLimits.lineWords, limits.preferredLinesMax);
  }

  preparedBody = clampBody(preparedBody, limits.bodyMax);

  if (preparedBody.length < Math.max(16, limits.bodyMin - 28)) {
    const expanded = `${preparedBody}\n${buildBodyPadding(normalizedRole, coreIdea)}`.trim();
    const compactExpanded = STRUCTURED_LAYOUTS.has(resolvedLayout)
      ? toStructuredBody(expanded, resolvedLayout, normalizedRole, coreIdea, wordLimits.lineWords)
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
      `${buildBodyPadding(normalizedRole, coreIdea)} ${buildMicroConclusion(normalizedRole, coreIdea)}`,
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
    !isHookRole(normalizedRole) &&
    normalizedRole !== "cta" &&
    !STRUCTURED_LAYOUTS.has(resolvedLayout)
  ) {
    const lines = normalizedLines
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      const support = ensureLineClosure(buildMicroConclusion(normalizedRole, coreIdea));
      if (support && support !== lines[0]) {
        normalizedLines = [lines[0], support]
          .filter(Boolean)
          .slice(0, limits.preferredLinesMax)
          .join("\n");
      }
    }
  }

  if (normalizedRole === "cta" && assessCtaStrength(fittedTitle, normalizedLines) < 3) {
    const ctaLanguageProbe = `${fittedTitle} ${normalizedLines} ${coreIdea}`.trim();
    const useEnglish = isMostlyEnglish(ctaLanguageProbe);
    const keyword = buildActionKeyword(ctaLanguageProbe || coreIdea, useEnglish);
    normalizedLines = useEnglish
      ? `${buildCtaBody(coreIdea, keyword, useEnglish)}\nSave this carousel and apply one step today.`
      : `${buildCtaBody(coreIdea, keyword, useEnglish)}\nСохраните карусель и внедрите один шаг сегодня.`;
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
  const normalizedRole = normalizeScenarioRole(role);
  const useEnglish = isMostlyEnglish(coreIdea);
  if (normalizedRole === "hook") {
    return useEnglish
      ? "Swipe: we break the conflict into practical steps."
      : "Листайте: дальше разберём конфликт и рабочие шаги.";
  }

  if (normalizedRole === "cta") {
    return useEnglish ? "Save and apply this today." : "Сохраните и примените это сегодня.";
  }

  if (normalizedRole === "solution" || normalizedRole === "structure" || normalizedRole === "checklist" || normalizedRole === "steps") {
    return useEnglish
      ? "Test the step in practice and measure the outcome."
      : "Проверьте шаг на практике и замерьте результат.";
  }

  if (normalizedRole === "problem") {
    return useEnglish
      ? "Show where results are lost and why it is critical."
      : "Здесь теряется результат и именно это нужно исправить первым.";
  }

  if (normalizedRole === "amplify" || normalizedRole === "consequence") {
    return useEnglish
      ? "Make the loss visible: what exactly gets worse if nothing changes."
      : "Сделайте потерю ощутимой: что конкретно ухудшается, если ничего не менять.";
  }

  if (normalizedRole === "myth") {
    return useEnglish
      ? "Validate the belief with facts and remove false confidence."
      : "Проверьте убеждение на фактах и уберите ложную опору.";
  }

  if (normalizedRole === "mistake") {
    return useEnglish
      ? "Name one mistake and replace it with a working action."
      : "Назовите одну ошибку и сразу замените её рабочим действием.";
  }

  if (normalizedRole === "shift") {
    return useEnglish
      ? "Contrast old and new thinking so the reader feels the shift."
      : "Покажите контраст старой и новой логики, чтобы читатель почувствовал перелом.";
  }

  if (normalizedRole === "example") {
    return useEnglish
      ? "Short case: one action, one measurable result."
      : "Короткий кейс: одно действие, один измеримый результат.";
  }

  if (normalizedRole === "comparison") {
    return useEnglish
      ? "Compare working and weak options on one concrete example."
      : "Сравните рабочий и слабый вариант на одном конкретном примере.";
  }

  if (normalizedRole === "summary") {
    return useEnglish
      ? "Compress the key takeaway into one formula and act on it."
      : "Соберите главный вывод в одну формулу и закрепите действием.";
  }

  return useEnglish
    ? "Use one specific, measurable action instead of broad advice."
    : "Сфокусируйтесь на одном конкретном действии и измеримом результате.";
}

function buildMicroConclusion(role: CarouselSlideRole, coreIdea: string) {
  const normalizedRole = normalizeScenarioRole(role);
  const useEnglish = isMostlyEnglish(coreIdea);
  if (normalizedRole === "problem") {
    return useEnglish
      ? "Until the root cause is fixed, growth will keep hitting a ceiling."
      : "Пока причина не устранена, рост будет упираться в потолок.";
  }

  if (normalizedRole === "amplify" || normalizedRole === "consequence") {
    return useEnglish
      ? "If this stays unresolved, the next stage of the funnel weakens even faster."
      : "Если это не исправить, следующий этап воронки будет проседать ещё сильнее.";
  }

  if (normalizedRole === "myth") {
    return useEnglish
      ? "Validate this with data, not habit."
      : "Проверьте это на данных, а не на привычке.";
  }

  if (normalizedRole === "mistake") {
    return useEnglish
      ? "Fix this first and your metrics stabilize faster."
      : "Исправьте это первым — и метрики стабилизируются быстрее.";
  }

  if (normalizedRole === "shift") {
    return useEnglish
      ? "Change the lens first, then tactics start working."
      : "Сначала смените оптику, и только потом тактики начнут работать.";
  }

  if (normalizedRole === "example") {
    return useEnglish
      ? "Key lesson: one precise move outperformed ten random attempts."
      : "Смысл кейса: сработал один точный шаг, а не десять хаотичных.";
  }

  if (normalizedRole === "comparison") {
    return useEnglish
      ? "The winning option always has a clear action and a result check."
      : "Выигрывает вариант, где есть чёткое действие и проверка результата.";
  }

  if (normalizedRole === "summary") {
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

  const normalizedRole = normalizeScenarioRole(planSlide.role);
  const fallback = buildFallbackTitle(planSlide, topic, index, total);
  const basis = cleaned || fallback;
  const normalized = enforceRoleTitleTone(
    capitalizeTitle(
      clampTitle(basis, LAYOUT_LIMITS[normalizeLayoutType(planSlide.layoutType)].titleMax)
    ),
    normalizedRole,
    topic
  );
  const normalizedWithoutPunctuation = normalized.replace(/\s{2,}/g, " ").trim();

  if (hasMalformedTitle(normalizedWithoutPunctuation) || hasLanguageDriftForTopic(normalizedWithoutPunctuation, topic)) {
    if (isHookRole(normalizedRole)) {
      return buildHookTitle(topic);
    }
    return enforceRoleTitleTone(
      buildFallbackTitle(planSlide, topic, index, total),
      normalizedRole,
      topic
    );
  }

  if (isHookRole(normalizedRole) && isWeakHookTitle(normalizedWithoutPunctuation)) {
    return buildHookTitle(topic);
  }

  if (isIncompleteTitle(normalizedWithoutPunctuation)) {
    if (isHookRole(normalizedRole)) {
      return buildHookTitle(topic);
    }

    const fallbackTitle = enforceRoleTitleTone(
      buildFallbackTitle(planSlide, topic, index, total),
      normalizedRole,
      topic
    );
    return fallbackTitle;
  }

  if (hasTemplateArtifactTitle(normalizedWithoutPunctuation)) {
    return enforceRoleTitleTone(
      buildFallbackTitle(planSlide, topic, index, total),
      normalizedRole,
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
  const normalizedRole = normalizeScenarioRole(role);
  const compact = clean(title).replace(/\s{2,}/g, " ").trim();
  if (!compact) {
    return title;
  }

  const useEnglish = isMostlyEnglish(topic);
  const lowercase = compact.toLowerCase();

  if (isHookRole(normalizedRole)) {
    if (hasLanguageDriftForTopic(compact, topic)) {
      return buildHookTitle(topic);
    }
    if (/(в теме|по теме|core conflict|главный конфликт)/i.test(compact)) {
      return buildHookTitle(topic);
    }
    if (/\b(котор\w*|which|that)\b/i.test(compact) && !compact.includes("?")) {
      return buildHookTitle(topic);
    }
    return hasHookConflictFormula(compact) ? compact : buildHookTitle(topic);
  }

  if (
    normalizedRole === "problem" &&
    !/(проблема|теря|срыв|не работает|проседает|problem|loss|leak|fails)/i.test(lowercase)
  ) {
    return clampTitle(
      `${useEnglish ? "Problem:" : "Проблема:"} ${compact}`,
      72
    );
  }

  if (
    (normalizedRole === "mistake" || normalizedRole === "amplify") &&
    !/(ошибка|миф|mistake|myth|усилен|amplif)/i.test(lowercase)
  ) {
    return clampTitle(
      `${useEnglish ? "Mistake:" : "Ошибка:"} ${compact}`,
      72
    );
  }

  if (normalizedRole === "example" && !/(кейс|пример|case|example)/i.test(lowercase)) {
    return clampTitle(
      `${useEnglish ? "Case:" : "Кейс:"} ${compact}`,
      72
    );
  }

  if (isStructureRole(normalizedRole)) {
    if (/^шага(?=\b|[,:;.!?])/i.test(compact)) {
      return clampTitle(compact.replace(/^шага(?=\b|[,:;.!?])/i, useEnglish ? "Steps" : "Шаги"), 72);
    }
    if (!/(шаг|план|структур|step|plan|structure)/i.test(lowercase)) {
      return clampTitle(useEnglish ? `Structure: ${compact}` : `Структура: ${compact}`, 72);
    }
  }

  if (normalizedRole === "checklist" && !/(чеклист|checklist)/i.test(lowercase)) {
    return clampTitle(useEnglish ? `Checklist: ${compact}` : `Чеклист: ${compact}`, 72);
  }

  if (normalizedRole === "cta") {
    const ctaPrefixPattern =
      /^(сделайте этот шаг|сделайте шаг|сделай сегодня|что сделать сейчас|что делать сейчас|что сделать прямо сейчас|сделай шаг сейчас|сделайте прямо сейчас|следующий шаг|сделай следующий шаг|start from this step|start now|start here|next step|what to do now|first move|first step|do this next|take this step next)\s*:?\s*/i;
    let compactCta = compact
      .replace(/^[^\p{L}\p{N}]+/gu, "")
      .trim();
    while (ctaPrefixPattern.test(compactCta)) {
      compactCta = compactCta.replace(ctaPrefixPattern, "").trim();
    }
    compactCta = compactCta
      .replace(/^[^\p{L}\p{N}]+/gu, "")
      .trim();
    compactCta = compactCta.replace(/[:\-–—\s]+$/g, "").trim();

    if (
      /^(?:хочешь|хотите|если)(?:\s|$)/i.test(compactCta) ||
      /^(?:want|if)(?:\s|$)/i.test(compactCta)
    ) {
      return clampTitle(compactCta, 72);
    }

    const hasActionVerb = /(сделайт|сдела(й|ть)|напис|сохран|проверь|получ|забер|write|save|get|start|try|apply|send)/i.test(compactCta);
    if (hasActionVerb) {
      return clampTitle(compactCta, 72);
    }

    const ctaTail =
      compactCta ||
      (useEnglish ? "comment a keyword and get a ready framework" : "напишите кодовое слово и получите готовый шаблон");
    return clampTitle(
      useEnglish ? `Do this next: ${ctaTail}` : `Следующий шаг: ${ctaTail}`,
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

function enrichBriefWithContext(
  brief: ParsedBrief,
  niche?: string,
  audience?: string
): ParsedBrief {
  const normalizedNiche = clean(String(niche ?? "")).slice(0, 120);
  const normalizedAudience = clean(String(audience ?? "")).slice(0, 160);
  const enrichedIdeas = [...brief.sourceIdeas];
  const enrichedQualityHints = [...brief.qualityHints];

  if (normalizedNiche) {
    enrichedIdeas.unshift(`Ниша: ${normalizedNiche}`);
    enrichedQualityHints.unshift(`Ниша: ${normalizedNiche}`);
  }

  if (normalizedAudience) {
    enrichedIdeas.unshift(`Аудитория: ${normalizedAudience}`);
    enrichedQualityHints.unshift(`Аудитория: ${normalizedAudience}`);
  }

  return {
    coreTopic: brief.coreTopic,
    sourceIdeas: Array.from(new Set(enrichedIdeas)).slice(0, 22),
    structureHints: brief.structureHints,
    qualityHints: Array.from(new Set(enrichedQualityHints)).slice(0, 16)
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

function inferTopicLens(
  topic: string,
  sourceIdeas: string[],
  overrides: TopicLensOverrides = {}
): TopicLens {
  const normalizedNiche = clean(String(overrides.niche ?? "")).slice(0, 120).toLowerCase();
  const audienceOverride = clean(String(overrides.audience ?? "")).slice(0, 160);
  const merged = `${normalizedNiche} ${topic} ${sourceIdeas.join(" ")}`.toLowerCase();

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
    if (audienceOverride) {
      return audienceOverride;
    }
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
  const normalizedRole = normalizeScenarioRole(role);

  const inferredCategory = category ?? inferTopicLens(topic || coreIdea, [coreIdea]).category;
  const baseKeywords = extractSearchKeywords(`${coreIdea} ${topic}`).slice(0, 6);
  const translated = baseKeywords.map((token) => KEYWORD_TRANSLATIONS[token] ?? token);
  const sceneKeywords = extractSearchKeywords(
    translateSceneToEnglish(`${topic} ${coreIdea}`)
  ).slice(0, 6);
  const queryLanguageIsEnglish = isMostlyEnglish(`${topic} ${coreIdea}`);
  const categoryHints = getCategoryVisualHints(inferredCategory, normalizedRole);
  const intentPrefix =
    imageIntent === "people-photo"
      ? ["professional", "people", "photo"]
      : imageIntent === "object-photo"
        ? ["object", "closeup", "photo"]
        : imageIntent === "subject-photo"
          ? ["subject", "natural", "photo"]
          : ["concept", "clean", "editorial", "photo"];
  const roleHint =
    normalizedRole === "example"
      ? ["real", "situation"]
      : isHookRole(normalizedRole)
        ? ["hero", "clean", "visual"]
        : normalizedRole === "shift"
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
  const normalizedRole = normalizeScenarioRole(role);
  if (category === "real-estate") {
    return normalizedRole === "example"
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
    return normalizedRole === "example"
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
