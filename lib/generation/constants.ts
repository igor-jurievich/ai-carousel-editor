import type { CarouselSlideRole, ContentMode } from "@/types/editor";

export type PromptVariant = "A" | "B";
export type CarouselGenerationSource = "model" | "fallback";
export type CarouselFallbackReason = "quota" | "error" | "timeout";
export type TopicDomain =
  | "sales"
  | "pet"
  | "education"
  | "psychology"
  | "health"
  | "fitness"
  | "beauty"
  | "finance"
  | "creator"
  | "general";

export type GenerationOptions = {
  niche?: string;
  audience?: string;
  tone?: string;
  goal?: string;
  promptVariant?: PromptVariant;
  contentMode?: import("@/types/editor").ContentModeInput;
};

export type CarouselGenerationMeta = {
  model: string;
  tokensUsed: number;
  validationErrors: string[];
  retried: boolean;
};

export type ModeDecision = {
  modeDetected: ContentMode;
  modeEffective: ContentMode;
  modeSource: "auto" | "manual";
  confidence: number;
  reasonCodes: string[];
};

export type TonePreference = "soft" | "balanced" | "sharp";

export const CANONICAL_FLOW: CarouselSlideRole[] = [
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

export const FLOW_BY_COUNT: Record<number, CarouselSlideRole[]> = {
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
    "example",
    "example",
    "cta"
  ]
};

export type ModeSlidePlanStep = {
  role: CarouselSlideRole;
  intent: string;
};

export const MODE_SLIDE_PLANS: Record<ContentMode, ModeSlidePlanStep[]> = {
  sales: [
    { role: "hook", intent: "сильный захват внимания" },
    { role: "problem", intent: "узнаваемые симптомы боли" },
    { role: "amplify", intent: "усиление цены бездействия" },
    { role: "mistake", intent: "ключевая ошибка аудитории" },
    { role: "consequence", intent: "чем это заканчивается" },
    { role: "shift", intent: "поворот мышления" },
    { role: "solution", intent: "практические действия" },
    { role: "example", intent: "мини-кейс или до/после" },
    { role: "cta", intent: "прямой следующий шаг" }
  ],
  expert: [
    { role: "hook", intent: "прямо назвать тему и пользу" },
    { role: "problem", intent: "описать симптомы ситуации" },
    { role: "amplify", intent: "раскрыть ключевые причины" },
    { role: "mistake", intent: "показать типичную ошибку" },
    { role: "shift", intent: "объяснить механизм: как работает на деле" },
    { role: "solution", intent: "дать рабочие шаги" },
    { role: "example", intent: "короткий пример применения" },
    { role: "consequence", intent: "какой результат получим при внедрении" },
    { role: "cta", intent: "мягкий вывод/следующий шаг" }
  ],
  instruction: [
    { role: "hook", intent: "какую задачу решаем" },
    { role: "problem", intent: "исходная точка и ограничения" },
    { role: "shift", intent: "главный принцип выполнения" },
    { role: "solution", intent: "пошаговый алгоритм действий" },
    { role: "mistake", intent: "типичные ошибки при выполнении" },
    { role: "amplify", intent: "условия, тайминг, важные нюансы" },
    { role: "example", intent: "как это выглядит на практике" },
    { role: "consequence", intent: "критерии, что все идет правильно" },
    { role: "cta", intent: "сделать первый шаг сегодня" }
  ],
  diagnostic: [
    { role: "hook", intent: "какой сбой разбираем" },
    { role: "problem", intent: "внешние симптомы" },
    { role: "mistake", intent: "частая неверная реакция" },
    { role: "consequence", intent: "к чему ведет текущий сценарий" },
    { role: "amplify", intent: "почему сбой закрепляется" },
    { role: "shift", intent: "что меняем в понимании" },
    { role: "solution", intent: "корректирующие действия" },
    { role: "example", intent: "мини-диагностика на примере" },
    { role: "cta", intent: "проверка у себя без давления" }
  ],
  case: [
    { role: "hook", intent: "контекст кейса" },
    { role: "problem", intent: "исходная проблема" },
    { role: "example", intent: "точка до: факты и цифры" },
    { role: "amplify", intent: "ключевые ограничения" },
    { role: "shift", intent: "гипотеза и поворот подхода" },
    { role: "solution", intent: "что конкретно сделали" },
    { role: "mistake", intent: "что убрали/исправили" },
    { role: "consequence", intent: "результат после изменений" },
    { role: "cta", intent: "вывод и мягкий следующий шаг" }
  ],
  social: [
    { role: "hook", intent: "узнаваемая бытовая ситуация" },
    { role: "problem", intent: "что мешает и раздражает" },
    { role: "amplify", intent: "почему это затягивается" },
    { role: "mistake", intent: "неочевидная ошибка" },
    { role: "shift", intent: "спокойный разворот мысли" },
    { role: "solution", intent: "что реально помогает" },
    { role: "example", intent: "живой короткий пример" },
    { role: "consequence", intent: "как меняется повседневность" },
    { role: "cta", intent: "мягкое вовлечение без дожима" }
  ]
};

export const DEFAULT_MODEL_CANDIDATES = [
  "gpt-5.1",
  "gpt-4o"
] as const;

export const HOOK_SUBTITLE_INPUT_MAX = 154;
export const HOOK_SUBTITLE_OUTPUT_MAX = 148;
export const CTA_SUBTITLE_INPUT_MAX = 160;
export const CTA_SUBTITLE_OUTPUT_MAX = 152;
export const BODY_BLOCK_INPUT_MAX = 380;
export const BODY_BLOCK_OUTPUT_MAX = 330;
export const BULLET_INPUT_MAX = 112;
export const BULLET_OUTPUT_MAX = 92;
export const MAX_BULLETS_PER_SLIDE = 3;
export const DEFAULT_MODEL_ATTEMPTS = 1;
export const DEFAULT_MODEL_CANDIDATE_LIMIT = 3;

export const FALLBACK_TITLES: Record<CarouselSlideRole, string[]> = {
  hook: [
    "Это ломает результат с первого дня",
    "Пока ты это делаешь — результат стоит",
    "Одна деталь, которую все пропускают"
  ],
  problem: [
    "Знакомая ситуация?",
    "Вот с чего всё начинается",
    "Так выглядит проблема изнутри"
  ],
  amplify: [
    "Дальше — хуже",
    "Масштаб больше, чем кажется",
    "Это тянет за собой всё остальное"
  ],
  mistake: [
    "Главная ошибка — вот эта",
    "Вот что делают не так",
    "Ошибка, которая дорого обходится"
  ],
  consequence: [
    "Цена этой ошибки",
    "Вот чем это заканчивается",
    "К чему это приводит"
  ],
  shift: [
    "А теперь посмотри иначе",
    "Вот что меняет картину",
    "Разворот: всё проще чем кажется"
  ],
  solution: [
    "Вот что работает",
    "Три шага к результату",
    "Делай так — и увидишь разницу"
  ],
  example: [
    "Пример из практики",
    "До/после: реальный кейс",
    "Как это сработало"
  ],
  cta: [
    "Сохраните и примените",
    "Проверьте это у себя",
    "Сделайте первый шаг сегодня"
  ]
};

export const CONTENT_MODE_LIST: ContentMode[] = [
  "sales",
  "expert",
  "instruction",
  "diagnostic",
  "case",
  "social"
];

export const TOPIC_STOP_WORDS = new Set([
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
