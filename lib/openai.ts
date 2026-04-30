import OpenAI from "openai";
import { clampSlidesCount } from "@/lib/slides";
import type {
  CarouselOutlineSlide,
  CarouselPostCaption,
  CarouselSlideRole,
  ContentMode,
  ContentModeInput
} from "@/types/editor";

export type PromptVariant = "A" | "B";
export type CarouselGenerationSource = "model" | "fallback";
export type CarouselFallbackReason = "quota" | "error" | "timeout";
type TopicDomain =
  | "sales"
  | "education"
  | "psychology"
  | "health"
  | "fitness"
  | "beauty"
  | "finance"
  | "creator"
  | "general";

type GenerationOptions = {
  niche?: string;
  audience?: string;
  tone?: string;
  goal?: string;
  promptVariant?: PromptVariant;
  contentMode?: ContentModeInput;
};

type CaptionGenerationInput = {
  topic: string;
  slides: CarouselOutlineSlide[];
  niche?: string;
  audience?: string;
  tone?: string;
  goal?: string;
  contentMode?: ContentModeInput;
  resolvedMode?: ContentMode;
};

type CarouselGenerationMeta = {
  model: string;
  tokensUsed: number;
  validationErrors: string[];
  retried: boolean;
};

type CarouselGenerationResult = {
  slides: CarouselOutlineSlide[];
  caption: string;
  promptVariant: PromptVariant;
  generationSource: CarouselGenerationSource;
  generationMeta: CarouselGenerationMeta;
  generationProfile: {
    modeDetected: ContentMode;
    modeEffective: ContentMode;
    modeSource: "auto" | "manual";
    modeConfidence: number;
    flowTemplate: string;
    ctaType: "direct" | "soft";
    bulletStyle: "clean" | "numbers" | "dots" | "compact";
    firstSlideRepairs: number;
    toneViolations: number;
    modeValidationPassed: boolean;
    modeValidationErrors: string[];
    modeReasonCodes: string[];
    fallbackUsed: boolean;
  };
  fallbackReason?: CarouselFallbackReason;
};

type ModeDecision = {
  modeDetected: ContentMode;
  modeEffective: ContentMode;
  modeSource: "auto" | "manual";
  confidence: number;
  reasonCodes: string[];
};

type TonePreference = "soft" | "balanced" | "sharp";

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
    "example",
    "example",
    "cta"
  ]
};

type ModeSlidePlanStep = {
  role: CarouselSlideRole;
  intent: string;
};

const MODE_SLIDE_PLANS: Record<ContentMode, ModeSlidePlanStep[]> = {
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

const DEFAULT_MODEL_CANDIDATES = [
  "gpt-5.1",
  "gpt-4o"
] as const;

const HOOK_SUBTITLE_INPUT_MAX = 154;
const HOOK_SUBTITLE_OUTPUT_MAX = 148;
const CTA_SUBTITLE_INPUT_MAX = 160;
const CTA_SUBTITLE_OUTPUT_MAX = 152;
const BODY_BLOCK_INPUT_MAX = 380;
const BODY_BLOCK_OUTPUT_MAX = 330;
const BULLET_INPUT_MAX = 112;
const BULLET_OUTPUT_MAX = 92;
const MAX_BULLETS_PER_SLIDE = 3;
const DEFAULT_MODEL_ATTEMPTS = 1;
const DEFAULT_MODEL_CANDIDATE_LIMIT = 3;

const FALLBACK_TITLES: Record<CarouselSlideRole, string[]> = {
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

const CONTENT_MODE_LIST: ContentMode[] = [
  "sales",
  "expert",
  "instruction",
  "diagnostic",
  "case",
  "social"
];

const META_HOOK_PATTERNS: RegExp[] = [
  /(?:^|[^\p{L}])(дочитыва|досматрива|сохраня[а-яё]*|пересыла|вовлечени|удержани)(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])(узк[а-яё]*\s+мест[а-яё]*|результат\s+буксует|шаги\s+есть,\s*а\s+результат)(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])(покажу,\s*как\s+раскрыть|чтобы\s+люди\s+дочитывали|раскрыть\s+тему\s+так)(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])(карусел[ьи]|контент)(?=$|[^\p{L}])/iu
];

const NON_SALES_TONE_PATTERNS: RegExp[] = [
  /(?:^|[^\p{L}])ты\s+делаешь\s+неправильно(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])у\s+тебя\s+вс[её]\s+плохо(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])дом\s+превращается\s+в\s+собачий\s+туалет(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])это\s+не\s+пройдет\s+само(?:\s+по\s+себе)?(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])ты\s+учишь\s+через\s+страх\s+и\s+случай(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])стыдно\s+показывать(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])вечно(?:й|го)\s+(?:запах|хаос)(?=$|[^\p{L}])/iu,
  /!{2,}/u
];

type NonSalesToneReplacement = {
  detect: RegExp;
  replace: RegExp;
  value: string;
};

const NON_SALES_TONE_REPLACEMENTS: NonSalesToneReplacement[] = [
  {
    detect: /дом\s+превращается\s+в\s+собачий\s+туалет/iu,
    replace: /дом\s+превращается\s+в\s+собачий\s+туалет/giu,
    value: "дома регулярно появляются лужи"
  },
  {
    detect: /это\s+не\s+пройдет\s+само(?:\s+по\s+себе)?/iu,
    replace: /это\s+не\s+пройдет\s+само(?:\s+по\s+себе)?/giu,
    value: "само по себе это редко стабилизируется"
  },
  {
    detect: /ты\s+учишь\s+через\s+страх\s+и\s+случай/iu,
    replace: /ты\s+учишь\s+через\s+страх\s+и\s+случай/giu,
    value: "обучение получается непоследовательным"
  },
  {
    detect: /ты\s+делаешь\s+неправильно/iu,
    replace: /ты\s+делаешь\s+неправильно/giu,
    value: "этот подход обычно не срабатывает"
  },
  {
    detect: /у\s+тебя\s+вс[её]\s+плохо/iu,
    replace: /у\s+тебя\s+вс[её]\s+плохо/giu,
    value: "в этой точке часто возникает сбой"
  },
  {
    detect: /стыдно\s+показывать/iu,
    replace: /стыдно\s+показывать/giu,
    value: "некомфортно показывать"
  },
  {
    detect: /вечно(?:й|го)\s+(?:запах|хаос)/iu,
    replace: /вечно(?:й|го)\s+(?:запах|хаос)/giu,
    value: "постоянный запах и беспорядок"
  }
];

const CAROUSEL_SYSTEM_PROMPT = `Ты — топовый Instagram-копирайтер. Пишешь карусели которые люди сохраняют, пересылают друзьям и комментируют "блин, это про меня".

ТВОЯ ЗАДАЧА:
Создать карусель из 9 слайдов на тему, которую даст пользователь.
Ответ — строго JSON, без markdown, без пояснений.

═══════════════════════════════════════
СТРУКТУРА 9 СЛАЙДОВ (обязательная):
═══════════════════════════════════════

Слайд 1 — HOOK (крючок):
- Заголовок вызывает реакцию "что?!" или "это про меня"
- Не вопрос, а утверждение или провокация
- Описание: 1-2 предложения, усиливающие интригу
- ПЛОХО: "5 ошибок в рекламе" (скучно, клише)
- ХОРОШО: "Ты сливаешь 80% бюджета на людей, которым плевать на твой продукт"

Слайд 2 — PROBLEM (проблема):
- Заголовок называет боль аудитории конкретно
- Описание: 3 пункта-симптома (каждый с новой строки, без спецсимволов в начале)
- Пункты — это то, что человек УЗНАЁТ у себя
- Каждый пункт: конкретная ситуация, не абстракция

Слайд 3 — AMPLIFY (усиление):
- Заголовок показывает МАСШТАБ проблемы
- Описание: 3 пункта, каждый бьёт по нервам
- Используй цифры, сроки, деньги, сравнения
- Читатель должен подумать: "блин, это реально серьёзно"

Слайд 4 — MISTAKE (ошибка):
- Заголовок: конкретная ошибка, которую делает аудитория
- ОБЯЗАТЕЛЬНО описание: 3 пункта почему это ошибка
- Формулировка: что конкретно делают не так, с примерами
- ЭТОТ СЛАЙД ОБЯЗАН ИМЕТЬ BODY-ТЕКСТ, НЕ ТОЛЬКО ЗАГОЛОВОК

Слайд 5 — CONSEQUENCE (последствие):
- Заголовок: цена этой ошибки
- Описание: 3 последствия с конкретикой (цифры, сроки, деньги)
- Каждый пункт с новой строки, без спецсимволов в начале
- Должно быть больно читать

Слайд 6 — SHIFT (поворот):
- Заголовок: переворот мышления, "а вот как на самом деле"
- ОБЯЗАТЕЛЬНО описание: 2-3 предложения объясняющие новый взгляд
- Это момент "ага!" — когда всё встаёт на место
- ЭТОТ СЛАЙД ОБЯЗАН ИМЕТЬ BODY-ТЕКСТ, НЕ ТОЛЬКО ЗАГОЛОВОК

Слайд 7 — SOLUTION (решение):
- Заголовок: "Вот что работает" или подобный
- Описание: 3 конкретных действия (каждое с новой строки)
- Каждое действие — что КОНКРЕТНО делать, не "будьте лучше"
- Читатель должен смочь применить это завтра

Слайд 8 — EXAMPLE (пример/кейс):
- Заголовок: "До/после:" + конкретная ситуация
- Описание: До: [что было с цифрами]. После: [что стало с цифрами]
- Цифры могут быть примерными, но реалистичными
- Конкретное имя клиента НЕ нужно, но ситуация должна быть узнаваемой

Слайд 9 — CTA (призыв):
- Заголовок: чёткий призыв к действию
- НЕ "подпишись", а конкретный оффер
- Описание: 1-2 предложения что получит человек
- Примеры: "Напиши СТОП в директ — пришлю чек-лист", "Сохрани и проверь свою воронку по этим 5 пунктам"

═══════════════════════════════════════
ПРАВИЛА ТЕКСТА:
═══════════════════════════════════════

ЯЗЫК:
- Пиши как будто говоришь с другом-профессионалом за кофе
- Русский разговорный-деловой: не канцелярит, не пацанский
- "ты"-обращение по умолчанию (если аудитория B2C) или "вы" (если B2B/premium)
- Живые глаголы: "сливаешь", "прогорает", "улетает" — вместо "осуществляется", "происходит"

ЗАГОЛОВКИ:
- МАКСИМУМ 6 слов. Это жёсткий лимит.
- Если не влезает в 6 слов — переформулируй короче
- Первое слово заголовка — самое сильное (оно будет выделено цветом)
- Не начинай с "Как", "Почему", "5 способов" — это клише
- ХОРОШО: "Бюджет горит — лиды нулевые"
- ПЛОХО: "Как правильно настроить рекламу для бизнеса"

ОПИСАНИЯ (body текст):
- Максимум 3 пункта на слайд (не 4, не 5 — ровно 3)
- Каждый пункт — ОДНО предложение, максимум 15 слов
- Пункты пиши с новой строки, без префиксов вроде →, •, -
- Если слайд без списка — максимум 2 предложения

ЗАПРЕЩЕНО:
- Штампы: "в современном мире", "не секрет что", "давайте разберёмся", "каждый из нас", "всем известно"
- Вводные: "итак", "дело в том что", "стоит отметить", "важно понимать"
- Водянистые прилагательные: "эффективный", "качественный", "уникальный", "инновационный"
- Абстракции без цифр: "много денег", "долго", "часто" — заменяй на конкретику
- Кавычки-ёлочки в заголовках (они ломают вёрстку)
- @username, счётчики подписчиков, хештеги в тексте слайдов

═══════════════════════════════════════
АДАПТАЦИЯ ПОД НИШУ:
═══════════════════════════════════════

Если указана ниша пользователя — используй терминологию этой ниши:
- Недвижимость: "объект", "показ", "CPL", "лид", "Авито", "ЦИАН", "торг"
- Маркетинг: "креатив", "CTR", "конверсия", "воронка", "ретаргет"
- Фитнес: "дефицит калорий", "метаболизм", "прогрессия нагрузок"
- Бьюти: "запись", "LTV клиента", "повторный визит"
- Образование: "вовлечённость", "домашка", "отток учеников"

Если ниша НЕ указана — пиши универсально для экспертов и малого бизнеса.

═══════════════════════════════════════
ФОРМАТ ОТВЕТА (СТРОГО):
═══════════════════════════════════════

Ответ — ТОЛЬКО валидный JSON. Никакого текста до или после JSON.
Никаких markdown-блоков. Просто чистый JSON.

{
  "slides": [
    {
      "role": "hook",
      "title": "Заголовок максимум 6 слов",
      "body": "Описание слайда. Максимум 2 предложения."
    },
    {
      "role": "problem",
      "title": "Заголовок максимум 6 слов",
      "body": "Пункт раз максимум 15 слов\nПункт два максимум 15 слов\nПункт три максимум 15 слов"
    }
  ],
  "caption": "Подпись к посту для Instagram. 3-4 абзаца. Без хештегов."
}

ПРОВЕРЬ ПЕРЕД ОТВЕТОМ:
✓ Ровно 9 слайдов
✓ Каждый заголовок ≤ 6 слов
✓ Каждый body ≤ 3 пунктов (или ≤ 2 предложений)
✓ Нет штампов из списка ЗАПРЕЩЕНО
✓ Есть цифры минимум в 5 слайдах из 9
✓ Слайды mistake и shift ИМЕЮТ body-текст (не только заголовок!)
✓ Роли идут строго: hook → problem → amplify → mistake → consequence → shift → solution → example → cta
✓ Валидный JSON без markdown`;

const CAROUSEL_SYSTEM_PROMPT_EXPERT = `Ты — редактор экспертных и образовательных каруселей.

Цель:
- дать читателю ясное объяснение темы и применимый следующий шаг;
- писать спокойно, по делу, без продажного давления.

Базовые правила:
- слайд 1 сразу называет тему и пользу;
- текст предметный: симптомы, причины, механизм, решение, пример;
- без мета-хуков про дочитывание, без манипуляций и драмы;
- без обвинений читателя;
- CTA мягкий или отсутствует;
- пункты на новых строках, без символов в начале.

Примеры первого слайда:
- ПЛОХО: «Шаги есть, а результат буксует: где узкое место?»
- ПЛОХО: «Покажу, как раскрыть тему, чтобы дочитывали»
- ХОРОШО: «Почему щенок писает дома и как это исправить»
- ХОРОШО: «Почему спорят о качестве заявок и как синхронизировать критерии»

Тон и подача:
- объясняй причину через механизм: «почему происходит -> что изменить -> какой эффект ожидать»;
- допустима спокойная встряска, но не токсичное давление;
- избегай драматизации ради удержания и оценочных формулировок про читателя.

Формат:
- JSON only;
- роли слайдов и структура строго по запросу пользователя.`;

const CAROUSEL_SYSTEM_PROMPT_INSTRUCTION = `Ты — методист и редактор пошаговых инструкций.

Цель:
- собрать карусель-инструкцию, где читатель понимает что делать сразу после чтения.

Базовые правила:
- слайд 1 называет задачу напрямую;
- приоритет: порядок действий и условия выполнения;
- каждый шаг конкретный и проверяемый;
- отдельно обозначай типичные ошибки;
- без драматизации и без продавливания CTA;
- в конце — мягкий призыв применить первый шаг.

Правила шагов:
- каждый шаг начинается с действия (сделайте/проверьте/зафиксируйте/сравните);
- шаг должен быть операциональным: что сделать, когда, по какому критерию понять результат;
- если шаги неочевидны, добавь условие «если/когда».

Примеры:
- ПЛОХО: «Нужно быть последовательным и внимательным»
- ХОРОШО: «Сначала зафиксируйте текущую точку: сколько попыток и в какие часы»
- ХОРОШО: «Затем проверьте 1 переменную и сравните результат через 3 дня»

Формат:
- JSON only;
- роли слайдов и структура строго по запросу пользователя.`;

const BANNED_TEMPLATE_PATTERNS: RegExp[] = [
  /(?:^|[^\p{L}])в\s+современном\s+мире(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])как\s+известно(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])не\s+секрет\s+что(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])многие\s+задаются\s+вопросом(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])сегодня\s+как\s+никогда(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])в\s+эпоху\s+цифровизац(?:ии|и)(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])как\s+показывает\s+практика(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])важно\s+понимать(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])на\s+самом\s+деле(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])стоит\s+отметить(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])следует\s+учитывать(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])необходимо\s+помнить(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])ключ\s+к\s+успеху(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])почему\s+это\s+важно(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])что\s+нужно\s+знать(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])главный\s+секрет(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])простой\s+способ(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])эффективный\s+метод(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])ключевые\s+моменты(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])обратите\s+внимание(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])(топ|лучших|способов)(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])где\s+ломается\s+поток(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])по\s+теме(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])в\s+теме(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])разбор\s+под\s+ваш\s+кейс(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])быстрый\s+рычаг(?=$|[^\p{L}])/iu
];

const WEAK_SHIFT_PATTERNS: RegExp[] = [
  /(?:^|[^\p{L}])важно\s+выслушать(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])важнее\s+всего(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])пора\s+смотреть(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])нужно\s+просто(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])главное\s+—?\s*быть\s+собой(?=$|[^\p{L}])/iu
];

const WEAK_ROLE_TITLE_PATTERNS: RegExp[] = [
  /^почему\s+это\s+важно\??$/iu,
  /^что\s+нужно\s+знать\??$/iu,
  /^главный\s+секрет\??$/iu,
  /^простой\s+способ\??$/iu,
  /^эффективный\s+метод\??$/iu,
  /^ключевые\s+моменты\??$/iu,
  /^обратите\s+внимание\??$/iu,
  /(?:^|[^\p{L}])(топ|лучших|способов)(?=$|[^\p{L}])/iu,
  /^что\s+это\s+значит(\s+для\s+вас)?\??$/iu,
  /^что\s+делать\s+по\s+шагам\??$/iu,
  /^что\s+изменится,\s*если\s+оставить\s+как\s+есть\??$/iu,
  /^готов[а-яё]*\s+объединить\s+усилия\??$/iu,
  /^пора\s+работать\s+как\s+одна\s+команда\??$/iu,
  /^вместе\s+тестировать\s+новые\s+подходы\??$/iu,
  /^как\s+переформулировать\s+мысль\??$/iu,
  /^всё\s+держится\s+на\s+отдельных\s+звеньях\??$/iu,
  /^разные\s+цели\s+—?\s*слепые\s+зоны\??$/iu,
  /^что\s+теряет\s+бизнес\s+из[-\s]за\s+разногласий\??$/iu,
  /^разбор[:\s-]/iu,
  /^план,\s*который\s+можно\s+внедрить/iu,
  /^мини[-\s]?кейс[:\s-]/iu,
  /^[\p{L}-]+(?:у|ю)\s+[\p{L}-]{4,}ть\s*:/iu,
  /^[\p{L}-]+\s+[\p{L}-]{4,}ть:\s+как\b/iu
];

const WEAK_BULLET_PATTERNS: RegExp[] = [
  /(?:^|[^\p{L}])(важно\s+понимать|нужно\s+просто|следует\s+помнить|в\s+целом|в\s+общем|как\s+правило|на\s+самом\s+деле|стоит\s+отметить|следует\s+учитывать|необходимо\s+помнить)(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])(как\s+известно|не\s+секрет\s+что|многие\s+задаются\s+вопросом|сегодня\s+как\s+никогда|в\s+эпоху\s+цифровизац(?:ии|и)|как\s+показывает\s+практика)(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])(работайте\s+системно|держите\s+фокус|будьте\s+на\s+связи)(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])(улучшить|усилить|повысить)\s+(процесс|эффективность|результат)(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])(делать\s+контент|вести\s+соцсети|развивать\s+блог)\s*(?:регулярно)?(?=$|[^\p{L}])/iu
];

const OPENING_STYLE_RISK_PATTERNS: RegExp[] = [
  /(?:^|[^\p{L}])(необходимо|следует|требуется|важно)\s+(обеспечить|осуществить|реализовать|проводить|формировать)(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])(эффективн[а-яё]*|качественн[а-яё]*|оптимальн[а-яё]*)\s+(подход|решени[ея]|процесс|взаимодействи[ея]|механизм)(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])(улучшить|повысить|оптимизировать)\s+(эффективность|процесс)(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])(в\s+целом|в\s+общем|как\s+правило)(?=$|[^\p{L}])/iu
];

function resolveModelCandidates(mode: ContentMode = "expert") {
  const uniqueCandidates = [
    process.env.OPENAI_GENERATION_MODEL?.trim(),
    ...DEFAULT_MODEL_CANDIDATES,
    process.env.OPENAI_MODEL?.trim()
  ]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, list) => list.indexOf(value) === index);

  const requestedLimit = Number(process.env.OPENAI_MODEL_CANDIDATE_LIMIT);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(4, Math.round(requestedLimit)))
    : DEFAULT_MODEL_CANDIDATE_LIMIT;

  void mode;
  return uniqueCandidates.slice(0, limit);
}

function resolveModelAttemptsPerCandidate() {
  const raw = Number(process.env.OPENAI_MODEL_ATTEMPTS);
  if (!Number.isFinite(raw)) {
    return DEFAULT_MODEL_ATTEMPTS;
  }

  return Math.max(1, Math.min(3, Math.round(raw)));
}

function shouldRetryInvalidSchema(mode: ContentMode) {
  void mode;
  return true;
}

function shouldRetryWithAnotherModelAfterQualityFailure(mode: ContentMode) {
  void mode;
  return true;
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

async function requestCarouselCompletion(
  openai: OpenAI,
  model: string,
  systemPrompt: string,
  userMessage: string,
  slidesCount: number
) {
  return await openai.responses.create({
    model,
    max_output_tokens: 4000,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: systemPrompt
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: userMessage
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "carousel_text_structure_v2",
        strict: true,
        schema: buildResponseSchema(slidesCount)
      }
    }
  });
}

function readTotalTokens(response: { usage?: { total_tokens?: number | null } | null }) {
  const raw = response.usage?.total_tokens;
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return 0;
  }

  return Math.max(0, Math.trunc(raw));
}

function parseCarouselModelResponse(response: {
  output_text?: string | null;
  choices?: Array<{ message?: { content?: string | null } | null }>;
}) {
  const raw =
    (typeof response.output_text === "string" ? response.output_text.trim() : "") ||
    response.choices?.[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error("OpenAI returned empty output.");
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("OpenAI returned invalid JSON payload.");
  }

  const payload = parsed as { slides?: unknown; caption?: unknown };
  return {
    slides: payload.slides,
    caption: payload.caption
  };
}

function validateCarouselResponse(
  data: { slides?: unknown; caption?: unknown },
  expectedFlow: CarouselSlideRole[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    errors.push("Пустой ответ модели");
    return { valid: false, errors };
  }

  if (!data.slides || !Array.isArray(data.slides)) {
    errors.push("Нет массива slides");
    return { valid: false, errors };
  }

  if (typeof data.caption !== "string" || !data.caption.trim()) {
    errors.push("Нет caption");
  }

  if (data.slides.length !== expectedFlow.length) {
    errors.push(`Ожидалось ${expectedFlow.length} слайдов, получено ${data.slides.length}`);
  }

  data.slides.forEach((slide: unknown, i: number) => {
    const record = toRecord(slide);
    const role = normalizeText(record.role, 24).toLowerCase();
    const title = normalizeText(record.title, 180);
    const body = normalizeText(record.body, 1200);

    if (!title) {
      errors.push(`Слайд ${i + 1}: нет заголовка`);
    }
    if (!body && role !== "hook") {
      errors.push(`Слайд ${i + 1} (${role || "unknown"}): нет описания`);
    }
    if (title && title.split(/\s+/u).length > 6) {
      errors.push(`Слайд ${i + 1}: заголовок слишком длинный (${title.split(/\s+/u).length} слов)`);
    }
    if (expectedFlow[i] && role !== expectedFlow[i]) {
      errors.push(`Слайд ${i + 1}: роль "${role}", ожидалась "${expectedFlow[i]}"`);
    }
  });

  return { valid: errors.length === 0, errors };
}

function mapModelSlidesToLegacyShape(
  rawSlides: unknown,
  expectedFlow: CarouselSlideRole[],
  mode: ContentMode = "expert"
) {
  const source = Array.isArray(rawSlides) ? rawSlides : [];

  return expectedFlow.map((role, index) => {
    const record = toRecord(source[index]);
    const title = normalizeText(record.title, 180);
    const body = normalizeBodyText(record.body, 1200);
    const bullets = extractBodyBullets(body);

    if (role === "hook") {
      return {
        type: "hook",
        title,
        subtitle:
          sanitizeCopyText(normalizeText(body, HOOK_SUBTITLE_INPUT_MAX), HOOK_SUBTITLE_OUTPUT_MAX) ||
          buildHookFallbackSubtitle("вашей теме", mode)
      };
    }

    if (role === "problem" || role === "amplify") {
      return {
        type: role,
        title,
        bullets
      };
    }

    if (role === "mistake") {
      return {
        type: "mistake",
        title,
        body: body || formatBulletsBody(bullets)
      };
    }

    if (role === "consequence") {
      return {
        type: "consequence",
        title,
        bullets
      };
    }

    if (role === "shift") {
      return {
        type: "shift",
        title,
        body: body || formatBulletsBody(bullets)
      };
    }

    if (role === "solution") {
      return {
        type: "solution",
        title,
        bullets
      };
    }

    if (role === "example") {
      const parsedExample = parseExampleBody(body);
      return {
        type: "example",
        before: parsedExample.before,
        after: parsedExample.after
      };
    }

    return {
      type: "cta",
      title,
      subtitle:
        sanitizeCopyText(normalizeText(body, CTA_SUBTITLE_INPUT_MAX), CTA_SUBTITLE_OUTPUT_MAX) ||
        buildGoalAwareCta(undefined)
    };
  });
}

function extractBodyBullets(body: string) {
  if (!body) {
    return [] as string[];
  }

  const normalizedLines = normalizeBodyText(body, 1200)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const markerLines = normalizedLines
    .filter((line) => /^(?:→|[-•·]|(?:\d+[.)]))\s*/u.test(line))
    .map((line) => line.replace(/^(?:→|[-•·]|(?:\d+[.)]))\s*/u, "").trim())
    .filter(Boolean);
  if (markerLines.length >= 2) {
    return dedupeBullets(markerLines);
  }

  const inlineArrowBullets = normalizedLines.flatMap((line) => {
    if (!line.includes("→")) {
      return [] as string[];
    }

    return line
      .split(/\s*→\s*/u)
      .map((part) => part.trim())
      .filter(Boolean);
  });
  if (inlineArrowBullets.length >= 2) {
    return dedupeBullets(inlineArrowBullets);
  }

  if (normalizedLines.length >= 2) {
    return dedupeBullets(normalizedLines);
  }

  const sentenceBullets = body
    .replace(/\s*→\s*/gu, ". ")
    .split(/[.!?]+/u)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return dedupeBullets(sentenceBullets);
}

function dedupeBullets(items: string[]) {
  const dedupe = new Set<string>();
  const cleaned: string[] = [];

  for (const item of items) {
    const normalized = sanitizeCopyText(normalizeText(item, BULLET_INPUT_MAX), BULLET_OUTPUT_MAX)
      .replace(/^[•·\-–—→\s]+/u, "")
      .replace(/[.!?]+\s*$/u, "")
      .trim();
    if (!normalized) {
      continue;
    }

    const fingerprint = normalizeWordTokens(normalized).join(" ");
    if (!fingerprint || dedupe.has(fingerprint)) {
      continue;
    }

    dedupe.add(fingerprint);
    cleaned.push(normalized);
    if (cleaned.length >= MAX_BULLETS_PER_SLIDE) {
      break;
    }
  }

  return cleaned;
}

function formatBulletsBody(bullets: string[]) {
  return bullets
    .filter(Boolean)
    .slice(0, MAX_BULLETS_PER_SLIDE)
    .map((item) => item)
    .join("\n");
}

function parseExampleBody(body: string) {
  if (!body) {
    return { before: "", after: "" };
  }

  const cleaned = body.replace(/\r/g, "").trim();
  const beforeMatch = cleaned.match(/до:\s*(.+?)(?:\n+после:|после:|$)/iu);
  const afterMatch = cleaned.match(/после:\s*(.+)$/iu);

  return {
    before: beforeMatch?.[1]?.trim() ?? "",
    after: afterMatch?.[1]?.trim() ?? ""
  };
}

function normalizeGeneratedCaption(value: unknown) {
  return sanitizeCopyText(normalizeText(value, 2200), 2100);
}

function dedupeErrors(errors: string[]) {
  const unique = new Set<string>();
  const result: string[] = [];

  for (const error of errors) {
    const normalized = normalizeText(error, 400);
    if (!normalized || unique.has(normalized)) {
      continue;
    }
    unique.add(normalized);
    result.push(normalized);
  }

  return result;
}

function resolveDefaultBulletStyle(mode: ContentMode) {
  if (mode === "instruction") {
    return "numbers" as const;
  }

  if (mode === "sales") {
    return "compact" as const;
  }

  return "clean" as const;
}

function resolveDefaultCtaType(mode: ContentMode, goal?: string) {
  if (mode === "sales" && isLeadsGoal(normalizeText(goal ?? "", 40).toLowerCase())) {
    return "direct" as const;
  }

  return "soft" as const;
}

function resolveFlowTemplateName(mode: ContentMode) {
  if (mode === "sales") {
    return "sales_funnel_v1";
  }
  if (mode === "instruction") {
    return "instruction_steps_v1";
  }
  if (mode === "diagnostic") {
    return "diagnostic_explain_v1";
  }
  if (mode === "case") {
    return "case_story_v1";
  }
  if (mode === "social") {
    return "social_relatable_v1";
  }
  return "expert_explain_v1";
}

function buildGenerationProfile(input: {
  modeDecision: ModeDecision;
  goal?: string;
  firstSlideRepairs: number;
  toneViolations: number;
  modeValidationErrors: string[];
  fallbackUsed: boolean;
}) {
  return {
    modeDetected: input.modeDecision.modeDetected,
    modeEffective: input.modeDecision.modeEffective,
    modeSource: input.modeDecision.modeSource,
    modeConfidence: Number(input.modeDecision.confidence.toFixed(2)),
    flowTemplate: resolveFlowTemplateName(input.modeDecision.modeEffective),
    ctaType: resolveDefaultCtaType(input.modeDecision.modeEffective, input.goal),
    bulletStyle: resolveDefaultBulletStyle(input.modeDecision.modeEffective),
    firstSlideRepairs: input.firstSlideRepairs,
    toneViolations: input.toneViolations,
    modeValidationPassed: input.modeValidationErrors.length === 0,
    modeValidationErrors: input.modeValidationErrors,
    modeReasonCodes: input.modeDecision.reasonCodes,
    fallbackUsed: input.fallbackUsed
  };
}

function resolveModeFromOptions(options?: GenerationOptions): ContentMode {
  const resolved = resolveContentMode(options?.contentMode);
  if (resolved !== "auto") {
    return resolved;
  }

  return isLeadsGoal(normalizeText(options?.goal ?? "", 40).toLowerCase()) ? "sales" : "expert";
}

function buildSystemPrompt(mode: ContentMode, topic: string, options?: GenerationOptions) {
  const domainHints = buildDomainPromptAddendum(resolveTopicDomain(topic, options))
    .map((line) => `- ${line}`)
    .join("\n");
  const basePrompt =
    mode === "sales"
      ? CAROUSEL_SYSTEM_PROMPT
      : mode === "instruction"
        ? CAROUSEL_SYSTEM_PROMPT_INSTRUCTION
        : CAROUSEL_SYSTEM_PROMPT_EXPERT;

  if (mode === "sales") {
    return `${basePrompt}\n\nDOMAIN CONTEXT:\n${domainHints}`;
  }

  const nonSalesOverrides = [
    "ПРИОРИТЕТНЫЕ ПРАВИЛА ДЛЯ NON-SALES (важнее базовых правил выше):",
    "- Никакой воронки дожима. Удержание через ясность и пользу, а не через страх.",
    "- Слайд 1 обязан прямо назвать предмет темы. Запрещены мета-хуки про дочитывание/сохранение.",
    "- Избегай формулировок: «узкое место», «результат буксует», «покажу как раскрыть тему».",
    "- Не обвиняй читателя. Нельзя токсичный тон и давление через стыд.",
    "- Не усиливай драму искусственно. Допустима только реалистичная конкретика.",
    "- CTA только мягкий или отсутствует. Нельзя «напиши слово в директ» и двойные CTA.",
    "- Пункты списка без символов в начале строки (без →, •, -)."
  ];

  if (mode === "instruction") {
    nonSalesOverrides.push(
      "- Логика контента: цель -> шаги -> условия -> частые ошибки -> итог.",
      "- Каждый шаг практичный и применимый сразу."
    );
  } else if (mode === "diagnostic") {
    nonSalesOverrides.push(
      "- Логика контента: симптомы -> причины -> механизм -> как исправить.",
      "- Не запугивай последствиями, объясняй причинно-следственно."
    );
  } else if (mode === "case") {
    nonSalesOverrides.push(
      "- Логика контента: контекст -> действия -> результат -> вывод.",
      "- Цифры и факты допускаются только реалистичные и проверяемые."
    );
  } else if (mode === "social") {
    nonSalesOverrides.push(
      "- Допускается более живой тон, но без крика, продавливания и агрессивного дожима."
    );
  } else {
    nonSalesOverrides.push(
      "- Логика контента: объяснение -> причины -> механизм -> решение -> пример -> краткий итог."
    );
  }

  const modeExamples = buildModePromptExamples(mode);

  return [
    basePrompt,
    nonSalesOverrides.join("\n"),
    modeExamples ? `MODE EXAMPLES:\n${modeExamples}` : "",
    `DOMAIN CONTEXT:\n${domainHints}`
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildModePromptExamples(mode: ContentMode) {
  if (mode === "instruction") {
    return [
      "- GOOD TITLE: «План выгула щенка: пошаговая схема»",
      "- BAD TITLE: «Как наладить щенка к туалету»",
      "- GOOD STEP: «Сначала зафиксируйте текущий режим: 6 выходов в день по таймеру»",
      "- BAD STEP: «Будьте последовательны и терпеливы»"
    ].join("\n");
  }

  if (mode === "expert") {
    return [
      "- GOOD TITLE: «Почему щенок писает дома: ключевые причины»",
      "- BAD TITLE: «Шаги есть, а результат буксует»",
      "- GOOD EXPLANATION: «Щенок закрепляет действие по ближайшему поощрению, поэтому важен тайминг 2-3 секунды»",
      "- BAD EXPLANATION: «Это не пройдет само, всё станет хуже»"
    ].join("\n");
  }

  return "";
}

function containsMetaHookLanguage(value: string) {
  const normalized = normalizeText(value, 320).toLowerCase();
  if (!normalized) {
    return false;
  }

  return META_HOOK_PATTERNS.some((pattern) => pattern.test(normalized));
}

function buildFirstSlideTitleForMode(topic: string, mode: ContentMode) {
  const focus = buildCompactTopicFocus(sanitizeTopic(topic), 34);
  const capitalizedFocus = upperFirst(focus);

  if (mode === "instruction") {
    return trimToWordBoundary(`«${capitalizedFocus}»: пошаговый план`, 84);
  }

  if (mode === "diagnostic") {
    return trimToWordBoundary(`«${capitalizedFocus}»: где возникает сбой`, 84);
  }

  if (mode === "case") {
    return trimToWordBoundary(`Кейс: «${capitalizedFocus}» и рабочее решение`, 84);
  }

  if (mode === "social") {
    return trimToWordBoundary(`«${capitalizedFocus}»: спокойный план без хаоса`, 84);
  }

  return trimToWordBoundary(`«${capitalizedFocus}»: почему нет стабильного результата`, 84);
}

function buildFirstSlideSubtitleForMode(topic: string, mode: ContentMode) {
  const focus = buildCompactTopicFocus(sanitizeTopic(topic), 42);

  if (mode === "instruction") {
    return trimToWordBoundary(
      `Дам пошаговый план для «${focus}»: что сделать сегодня и на что смотреть дальше.`,
      148
    );
  }

  if (mode === "diagnostic") {
    return trimToWordBoundary(
      `Разберём причины срывов в «${focus}» и покажем, как их исправить без перегруза.`,
      148
    );
  }

  if (mode === "case") {
    return trimToWordBoundary(
      `Покажу, что было до, какие действия сработали и какой результат получили в «${focus}».`,
      148
    );
  }

  if (mode === "social") {
    return trimToWordBoundary(
      `Коротко и по делу: почему вокруг «${focus}» бывает хаос и что реально помогает.`,
      148
    );
  }

  return trimToWordBoundary(
    "Большинство делает это неправильно — и не понимает почему результата нет. Разберём по шагам.",
    148
  );
}

function enforceFirstSlidePolicy(
  slides: CarouselOutlineSlide[],
  expectedFlow: CarouselSlideRole[],
  topic: string,
  mode: ContentMode
) {
  if (mode === "sales") {
    return {
      slides,
      repairs: 0
    };
  }

  const hookIndex = expectedFlow.findIndex((role) => role === "hook");
  if (hookIndex < 0 || hookIndex >= slides.length) {
    return {
      slides,
      repairs: 0
    };
  }

  const nextSlides = slides.map((slide) => ({ ...slide })) as CarouselOutlineSlide[];
  const currentHook = nextSlides[hookIndex];
  let repairs = 0;

  let hook: Extract<CarouselOutlineSlide, { type: "hook" }>;

  if (currentHook?.type === "hook") {
    hook = { ...currentHook };
  } else {
    hook = {
      type: "hook",
      title: "",
      subtitle: ""
    };
    repairs += 1;
  }

  const title = sanitizeTitleValue(hook.title, 84);
  const subtitle = sanitizeCopyText(
    normalizeText(hook.subtitle, HOOK_SUBTITLE_INPUT_MAX),
    HOOK_SUBTITLE_OUTPUT_MAX
  );
  const combinedCopy = [title, subtitle].filter(Boolean).join(" ").trim();

  const lacksTopicAnchor =
    !hasPrimaryTopicAnchor(combinedCopy, topic) && !isCopyTopicAligned(combinedCopy, topic);
  const hasMetaHook = containsMetaHookLanguage(combinedCopy);
  const weakTitle =
    !title ||
    countWords(title) < 3 ||
    hasDanglingTail(title) ||
    startsWithGenericMistakeLead(title) ||
    hasNonSalesGrammarRisk(title) ||
    hasAwkwardHookTitle(title);
  const weakSubtitle = !subtitle || containsMetaHookLanguage(subtitle);

  if (weakTitle || hasMetaHook || lacksTopicAnchor) {
    hook.title = buildFirstSlideTitleForMode(topic, mode);
    repairs += 1;
  } else {
    hook.title = title;
  }

  if (weakSubtitle || hasMetaHook) {
    hook.subtitle = buildFirstSlideSubtitleForMode(topic, mode);
    repairs += 1;
  } else {
    hook.subtitle = subtitle;
  }

  const finalHookText = `${hook.title} ${hook.subtitle}`.trim();
  if (!hasPrimaryTopicAnchor(finalHookText, topic)) {
    hook.title = addTopicAnchorToTitle(hook.title, buildTopicAnchorLabel(topic));
    repairs += 1;
  }

  nextSlides[hookIndex] = hook;

  return {
    slides: nextSlides,
    repairs
  };
}

function polishQuotedTopicFragments(value: string, maxLength: number) {
  const source = sanitizeCopyText(normalizeText(value, maxLength + 40), maxLength);
  if (!source) {
    return "";
  }

  let next = source.replace(/«([^»]+)»/gu, (_, inner: string) => {
    const cleanedInner = removeDanglingTail(
      inner
        .replace(/^[\s"'`«»“”„:;,.!?—–-]+/gu, "")
        .replace(/^(по|в|на|для|про|о|об)\s+/iu, "")
        .replace(/[,:;—–-]+\s*$/u, "")
        .trim()
    );

    if (!cleanedInner) {
      return "";
    }

    return `«${upperFirst(cleanedInner)}»`;
  });

  next = next.replace(/«\s*»/gu, "").replace(/\s{2,}/gu, " ").trim();

  return sanitizeCopyText(normalizeText(next, maxLength), maxLength);
}

function hasHookSubtitleStyleRisk(value: string) {
  const normalized = sanitizeCopyText(
    normalizeText(value, HOOK_SUBTITLE_OUTPUT_MAX),
    HOOK_SUBTITLE_OUTPUT_MAX
  );
  if (!normalized) {
    return true;
  }

  const words = countWords(normalized);
  const punctuationCount = (normalized.match(/[,:;.!?]/gu) ?? []).length;
  const clauseCueCount = (
    normalized.match(/\b(что|как|какие|какой|почему|где|когда|чтобы|которые|который)\b/giu) ?? []
  ).length;
  const hasUpperCaseQuoteWord = /«[А-ЯЁ][а-яё]{2,}»/u.test(normalized);
  const hasDenseCueChain =
    clauseCueCount >= 3 && punctuationCount < 2 && words >= 15;

  return words > 28 || hasUpperCaseQuoteWord || hasDenseCueChain;
}

function polishHookSubtitleStyle(value: string, mode: ContentMode, topic: string) {
  let next = polishQuotedTopicFragments(value, HOOK_SUBTITLE_OUTPUT_MAX);
  if (!next) {
    return buildFirstSlideSubtitleForMode(topic, mode);
  }

  next = next
    .replace(/«([А-ЯЁ])([а-яё]{2,})»/gu, (_, head: string, tail: string) => `«${head.toLowerCase()}${tail}»`)
    .replace(/»\s+(какие|какой|как|почему|где|когда|что)\b/giu, "», $1")
    .replace(/\s{2,}/gu, " ")
    .trim();

  if (!/[.!?]$/u.test(next)) {
    next = `${next}.`;
  }

  next = sanitizeCopyText(normalizeText(next, HOOK_SUBTITLE_OUTPUT_MAX), HOOK_SUBTITLE_OUTPUT_MAX);
  if (!next || hasHookSubtitleStyleRisk(next) || containsMetaHookLanguage(next)) {
    return buildFirstSlideSubtitleForMode(topic, mode);
  }

  return next;
}

function applyHookEditorialPolish(
  slides: CarouselOutlineSlide[],
  mode: ContentMode,
  topic: string
) {
  if (mode === "sales") {
    return slides;
  }

  const nextSlides = slides.map((slide) => ({ ...slide })) as CarouselOutlineSlide[];
  const hookIndex = nextSlides.findIndex((slide) => slide.type === "hook");
  if (hookIndex < 0 || nextSlides[hookIndex]?.type !== "hook") {
    return nextSlides;
  }

  const hook = nextSlides[hookIndex] as Extract<CarouselOutlineSlide, { type: "hook" }>;
  const polishedTitle = polishQuotedTopicFragments(hook.title, 84);
  const polishedSubtitle = polishHookSubtitleStyle(hook.subtitle, mode, topic);

  hook.title = polishedTitle || buildFirstSlideTitleForMode(topic, mode);
  hook.subtitle = polishedSubtitle || buildFirstSlideSubtitleForMode(topic, mode);

  if (hasNonSalesGrammarRisk(hook.title) || hasDanglingTail(hook.title) || countWords(hook.title) < 3) {
    hook.title = buildFirstSlideTitleForMode(topic, mode);
  }

  if (!hook.subtitle || containsMetaHookLanguage(hook.subtitle)) {
    hook.subtitle = buildFirstSlideSubtitleForMode(topic, mode);
  }

  const combined = `${hook.title} ${hook.subtitle}`.trim();
  if (!hasPrimaryTopicAnchor(combined, topic)) {
    hook.title = addTopicAnchorToTitle(hook.title, buildTopicAnchorLabel(topic));
  }

  nextSlides[hookIndex] = hook;
  return nextSlides;
}

function hasOpeningStyleRisk(value: string) {
  const normalized = sanitizeCopyText(normalizeText(value, 260), 240).toLowerCase();
  if (!normalized) {
    return false;
  }

  if (hasLegacyTemplatePhrase(normalized) || WEAK_BULLET_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  return OPENING_STYLE_RISK_PATTERNS.some((pattern) => pattern.test(normalized));
}

function applyNonSalesOpeningStyleGuardrails(
  slides: CarouselOutlineSlide[],
  mode: ContentMode,
  topic: string,
  options?: GenerationOptions
) {
  if (mode === "sales") {
    return slides;
  }

  const nextSlides = slides.map((slide) => ({ ...slide })) as CarouselOutlineSlide[];
  const openingCount = Math.min(3, nextSlides.length);

  for (let index = 0; index < openingCount; index += 1) {
    const slide = nextSlides[index];
    if (!slide) {
      continue;
    }

    if (slide.type === "hook") {
      const title = sanitizeTitleValue(slide.title, 84);
      const subtitle = sanitizeCopyText(
        normalizeText(slide.subtitle, HOOK_SUBTITLE_INPUT_MAX),
        HOOK_SUBTITLE_OUTPUT_MAX
      );

      slide.title =
        !title || hasOpeningStyleRisk(title) || hasNonSalesGrammarRisk(title)
          ? buildFirstSlideTitleForMode(topic, mode)
          : title;
      slide.subtitle =
        !subtitle || hasOpeningStyleRisk(subtitle) || !hasConcreteAnchorInCopy(subtitle)
          ? buildFirstSlideSubtitleForMode(topic, mode)
          : subtitle;
      continue;
    }

    if (
      slide.type === "problem" ||
      slide.type === "amplify" ||
      slide.type === "consequence" ||
      slide.type === "solution"
    ) {
      const fallbackBullets = buildRoleBulletsFallback(slide.type, topic, options);
      const normalizedBullets = (slide.bullets ?? [])
        .map((item) => sanitizeCopyText(normalizeText(item, BULLET_INPUT_MAX), BULLET_OUTPUT_MAX))
        .filter(Boolean)
        .slice(0, MAX_BULLETS_PER_SLIDE);
      const polishedBullets = normalizedBullets.map((item, bulletIndex) => {
        if (hasOpeningStyleRisk(item) && !hasConcreteAnchorInCopy(item)) {
          return fallbackBullets[bulletIndex] ?? fallbackBullets[0] ?? item;
        }
        return item;
      });
      slide.bullets = pickStrongBullets(polishedBullets, fallbackBullets);
      continue;
    }

    if (slide.type === "mistake" || slide.type === "shift") {
      const title = sanitizeTitleValue(slide.title, 92);
      const body = sanitizeCopyText(
        normalizeText(slide.body ?? "", BODY_BLOCK_INPUT_MAX),
        BODY_BLOCK_OUTPUT_MAX
      );

      slide.title =
        !title || hasOpeningStyleRisk(title) ? buildRoleTitleFallback(slide.type, topic, options) : title;
      if (!body || (hasOpeningStyleRisk(body) && !hasConcreteAnchorInCopy(body))) {
        slide.body =
          mode === "instruction"
            ? "Сначала зафиксируйте исходную точку, затем измените один шаг и проверьте результат через 3 дня."
            : "Покажите причину на конкретном примере, затем дайте один шаг, который можно сделать сегодня.";
      } else {
        slide.body = body;
      }
    }
  }

  return nextSlides;
}

function resolveTonePreference(tone?: string): TonePreference {
  const normalized = normalizeText(tone, 20).toLowerCase();
  if (normalized === "soft" || normalized === "sharp") {
    return normalized;
  }

  return "balanced";
}

function softenNonSalesText(value: string, maxLength: number, tonePreference: TonePreference = "balanced") {
  const source = sanitizeCopyText(normalizeText(value, maxLength * 2), maxLength);
  if (!source) {
    return { text: "", violations: 0 };
  }

  let next = source;
  let violations = 0;

  for (const pattern of NON_SALES_TONE_PATTERNS) {
    if (pattern.test(source)) {
      violations += 1;
    }
  }

  for (const replacement of NON_SALES_TONE_REPLACEMENTS) {
    if (!replacement.detect.test(next)) {
      continue;
    }

    next = next.replace(replacement.replace, replacement.value);
  }

  if (/!{2,}/u.test(next)) {
    next = next.replace(/!{2,}/gu, "!");
  }

  if (tonePreference === "soft") {
    next = next
      .replace(/\b(срочно|немедленно)\b/giu, "лучше")
      .replace(/\b(должен|должны|обязан|обязаны)\b/giu, "лучше")
      .replace(/\b(катастрофа|провал)\b/giu, "сбой")
      .replace(/!/gu, ".");
  }

  next = next
    .replace(/\bвсегда\b/giu, "часто")
    .replace(/\bникогда\b/giu, "редко")
    .replace(/\s{2,}/gu, " ")
    .trim();

  return {
    text: sanitizeCopyText(normalizeText(next, maxLength), maxLength),
    violations
  };
}

function applyToneGuardrails(
  slides: CarouselOutlineSlide[],
  mode: ContentMode,
  tonePreference: TonePreference = "balanced"
) {
  if (mode === "sales") {
    return {
      slides,
      violations: 0
    };
  }

  let violations = 0;
  const nextSlides = slides.map((slide) => ({ ...slide })) as CarouselOutlineSlide[];

  for (let index = 0; index < nextSlides.length; index += 1) {
    const current = nextSlides[index];
    if (!current) {
      continue;
    }

    if (current.type === "hook") {
      const softenedTitle = softenNonSalesText(current.title, 84, tonePreference);
      const softenedSubtitle = softenNonSalesText(
        current.subtitle,
        HOOK_SUBTITLE_OUTPUT_MAX,
        tonePreference
      );
      violations += softenedTitle.violations + softenedSubtitle.violations;
      current.title = sanitizeTitleValue(softenedTitle.text, 84);
      current.subtitle = softenedSubtitle.text;
      continue;
    }

    if (
      current.type === "problem" ||
      current.type === "amplify" ||
      current.type === "consequence" ||
      current.type === "solution"
    ) {
      const softenedTitle = softenNonSalesText(current.title ?? "", 84, tonePreference);
      violations += softenedTitle.violations;
      current.title = sanitizeTitleValue(softenedTitle.text, 84);
      current.bullets = current.bullets
        .map((item) => {
          const softened = softenNonSalesText(item, BULLET_OUTPUT_MAX, tonePreference);
          violations += softened.violations;
          return softened.text;
        })
        .filter(Boolean)
        .slice(0, MAX_BULLETS_PER_SLIDE);
      continue;
    }

    if (current.type === "mistake" || current.type === "shift") {
      const softenedTitle = softenNonSalesText(current.title, 92, tonePreference);
      const softenedBody = softenNonSalesText(current.body ?? "", BODY_BLOCK_OUTPUT_MAX, tonePreference);
      violations += softenedTitle.violations + softenedBody.violations;
      const previousTitle = sanitizeTitleValue(current.title, 92);
      const nextTitle = sanitizeTitleValue(softenedTitle.text, 92);
      current.title = countWords(nextTitle) >= 4 ? nextTitle : previousTitle;
      current.body = softenedBody.text;
      continue;
    }

    if (current.type === "example") {
      const softenedBefore = softenNonSalesText(current.before, 122, tonePreference);
      const softenedAfter = softenNonSalesText(current.after, 122, tonePreference);
      violations += softenedBefore.violations + softenedAfter.violations;
      current.before = softenedBefore.text;
      current.after = softenedAfter.text;
      continue;
    }

    if (current.type === "cta") {
      const softenedTitle = softenNonSalesText(current.title, 84, tonePreference);
      const softenedSubtitle = softenNonSalesText(
        current.subtitle,
        CTA_SUBTITLE_OUTPUT_MAX,
        tonePreference
      );
      violations += softenedTitle.violations + softenedSubtitle.violations;
      current.title = sanitizeTitleValue(softenedTitle.text, 84);
      current.subtitle = softenedSubtitle.text;
    }
  }

  return {
    slides: nextSlides,
    violations
  };
}

function dedupeReasonCodes(reasons: string[]) {
  return Array.from(new Set(reasons.filter(Boolean)));
}

function validateNonSalesCommonOutput(slides: CarouselOutlineSlide[], topic: string) {
  const reasons: string[] = [];
  const hook = slides.find((slide) => slide.type === "hook");
  const cta = slides.find((slide) => slide.type === "cta");

  if (hook) {
    const hookText = `${hook.title} ${hook.subtitle}`.trim();
    if (containsMetaHookLanguage(hookText)) {
      reasons.push("first_slide_meta_hook");
    }
    if (!hasPrimaryTopicAnchor(hookText, topic) && !isCopyTopicAligned(hookText, topic)) {
      reasons.push("first_slide_topic_unclear");
    }
  } else {
    reasons.push("missing_hook_slide");
  }

  const firstThree = slides.slice(0, 3);
  if (firstThree.some((slide) => containsMetaHookLanguage(collectSlideCopy(slide)))) {
    reasons.push("meta_hook_in_opening");
  }

  if (cta && containsDirectMessageCta(`${cta.title} ${cta.subtitle}`)) {
    reasons.push("non_sales_direct_cta");
  }

  return dedupeReasonCodes(reasons);
}

function validateSalesOutput(slides: CarouselOutlineSlide[]) {
  const reasons: string[] = [];
  const cta = slides.find((slide) => slide.type === "cta");
  const hook = slides.find((slide) => slide.type === "hook");

  if (!hook) {
    reasons.push("missing_hook_slide");
  }

  if (!cta) {
    reasons.push("missing_cta_slide");
  } else if (!hasPrimaryCtaActionVerb(`${cta.title} ${cta.subtitle}`)) {
    reasons.push("sales_cta_missing_action");
  }

  return dedupeReasonCodes(reasons);
}

function validateExpertOutput(slides: CarouselOutlineSlide[], topic: string) {
  const reasons = validateNonSalesCommonOutput(slides, topic);
  const shift = slides.find((slide) => slide.type === "shift");
  const solution = slides.find((slide) => slide.type === "solution");
  const explanation = shift && "body" in shift ? shift.body ?? "" : "";
  const hasMechanismCue = /(?:^|[^\p{L}])(потому|поэтому|из-за|когда|если|чтобы)(?=$|[^\p{L}])/iu.test(
    explanation
  );

  if (!hasMechanismCue) {
    reasons.push("expert_missing_mechanism_explanation");
  }

  if (!solution || !("bullets" in solution) || solution.bullets.length < 2) {
    reasons.push("expert_solution_too_weak");
  }

  return dedupeReasonCodes(reasons);
}

function validateInstructionOutput(slides: CarouselOutlineSlide[], topic: string) {
  const reasons = validateNonSalesCommonOutput(slides, topic);
  const solution = slides.find((slide) => slide.type === "solution");
  const mistake = slides.find((slide) => slide.type === "mistake");
  const solutionCopy = solution && "bullets" in solution ? solution.bullets.join(" ") : "";
  const stepCue = /(?:^|[^\p{L}])(шаг|сначала|потом|затем|проверьте|сделайте|1|2|3)(?=$|[^\p{L}])/iu.test(
    solutionCopy
  );
  if (!solution || !("bullets" in solution) || solution.bullets.length < 2 || !stepCue) {
    reasons.push("instruction_missing_step_logic");
  }
  if (!mistake || !("body" in mistake) || countWords(mistake.body ?? "") < 7) {
    reasons.push("instruction_missing_mistakes_block");
  }

  return dedupeReasonCodes(reasons);
}

function validateDiagnosticOutput(slides: CarouselOutlineSlide[], topic: string) {
  const reasons = validateNonSalesCommonOutput(slides, topic);
  const problem = slides.find((slide) => slide.type === "problem");
  const mistake = slides.find((slide) => slide.type === "mistake");
  const consequence = slides.find((slide) => slide.type === "consequence");
  const shift = slides.find((slide) => slide.type === "shift");

  if (!problem || !("bullets" in problem) || problem.bullets.length < 2) {
    reasons.push("diagnostic_missing_symptoms");
  }

  const hasDiagnosticDepth =
    (mistake && "body" in mistake && countWords(mistake.body ?? "") >= 8) ||
    (consequence && "bullets" in consequence && consequence.bullets.length >= 2);
  if (!hasDiagnosticDepth) {
    reasons.push("diagnostic_shallow_explanation");
  }

  const shiftBody = shift && "body" in shift ? shift.body ?? "" : "";
  const hasCorrectionCue = /(?:^|[^\p{L}])(исправ|проверь|сделай|сделайте|меняй|меняйте)(?=$|[^\p{L}])/iu.test(
    shiftBody
  );
  if (!hasCorrectionCue) {
    reasons.push("diagnostic_missing_correction_path");
  }

  return dedupeReasonCodes(reasons);
}

function validateCaseOutput(slides: CarouselOutlineSlide[], topic: string) {
  const reasons = validateNonSalesCommonOutput(slides, topic);
  const example = slides.find((slide) => slide.type === "example");
  const consequence = slides.find((slide) => slide.type === "consequence");

  if (!example || !example.before || !example.after) {
    reasons.push("case_missing_before_after");
  }

  const hasResultCue =
    (example && /\d/.test(`${example.before} ${example.after}`)) ||
    (consequence && "bullets" in consequence && consequence.bullets.some((item) => /\d/.test(item)));
  if (!hasResultCue) {
    reasons.push("case_missing_result_signal");
  }

  return dedupeReasonCodes(reasons);
}

function validateSocialOutput(slides: CarouselOutlineSlide[], topic: string) {
  const reasons = validateNonSalesCommonOutput(slides, topic);
  const openingText = slides
    .slice(0, 4)
    .map((slide) => collectSlideCopy(slide))
    .join(" ");

  if (NON_SALES_TONE_PATTERNS.some((pattern) => pattern.test(openingText))) {
    reasons.push("social_tone_too_harsh");
  }

  return dedupeReasonCodes(reasons);
}

function validateModeSpecificOutput(
  slides: CarouselOutlineSlide[],
  mode: ContentMode,
  topic: string
) {
  const reasons =
    mode === "sales"
      ? validateSalesOutput(slides)
      : mode === "instruction"
        ? validateInstructionOutput(slides, topic)
        : mode === "diagnostic"
          ? validateDiagnosticOutput(slides, topic)
          : mode === "case"
            ? validateCaseOutput(slides, topic)
            : mode === "social"
              ? validateSocialOutput(slides, topic)
              : validateExpertOutput(slides, topic);

  return {
    ok: reasons.length === 0,
    reasons
  };
}

function repairModeSpecificOutput(
  slides: CarouselOutlineSlide[],
  mode: ContentMode,
  topic: string,
  options?: GenerationOptions
) {
  const nextSlides = slides.map((slide) => ({ ...slide })) as CarouselOutlineSlide[];
  const currentFlow = nextSlides.map((slide) => slide.type);

  if (mode !== "sales") {
    const firstSlide = enforceFirstSlidePolicy(nextSlides, currentFlow, topic, mode);
    for (let index = 0; index < nextSlides.length; index += 1) {
      nextSlides[index] = firstSlide.slides[index] ?? nextSlides[index];
    }
  }

  const ctaIndex = nextSlides.findIndex((slide) => slide.type === "cta");
  if (ctaIndex >= 0 && nextSlides[ctaIndex]?.type === "cta") {
    const cta = nextSlides[ctaIndex] as Extract<CarouselOutlineSlide, { type: "cta" }>;
    const ctaVariants = buildCtaVariants(options?.goal, topic, mode);
    if (mode !== "sales" || containsDirectMessageCta(`${cta.title} ${cta.subtitle}`)) {
      cta.title = buildCtaTitleFallback(options?.goal, topic, mode);
      cta.subtitle = ctaVariants.soft;
    }
  }

  if (mode === "instruction") {
    const solutionIndex = nextSlides.findIndex((slide) => slide.type === "solution");
    if (solutionIndex >= 0 && nextSlides[solutionIndex]?.type === "solution") {
      const solution = nextSlides[solutionIndex] as Extract<CarouselOutlineSlide, { type: "solution" }>;
      const solutionFallback = buildDeterministicSolutionFallback(topic, options);
      if (!solution.bullets || solution.bullets.length < 2) {
        solution.title = solutionFallback.title;
        solution.bullets = solutionFallback.bullets;
      }

      if (hasForbiddenNegativeBulletsForPositiveSlide("solution", solution.bullets)) {
        solution.title = solutionFallback.title;
        solution.bullets = solutionFallback.bullets;
      }

      const solutionCopy = solution.bullets.join(" ");
      const hasStepCue =
        /(?:^|[^\p{L}])(шаг|сначала|потом|затем|проверьте|сделайте|1|2|3)(?=$|[^\p{L}])/iu.test(
          solutionCopy
        );
      if (!hasStepCue && solution.bullets.length > 0) {
        const [first, ...rest] = solution.bullets;
        const normalizedFirst = sanitizeCopyText(normalizeText(first, BULLET_INPUT_MAX), BULLET_OUTPUT_MAX);
        solution.bullets = [`Сначала: ${normalizedFirst || "выполни первый шаг из плана"}`, ...rest]
          .map((item) => sanitizeCopyText(normalizeText(item, BULLET_INPUT_MAX), BULLET_OUTPUT_MAX))
          .filter(Boolean)
          .slice(0, MAX_BULLETS_PER_SLIDE);
      }
    }
  }

  if (mode === "expert") {
    const shiftIndex = nextSlides.findIndex((slide) => slide.type === "shift");
    if (shiftIndex >= 0 && nextSlides[shiftIndex]?.type === "shift") {
      const shift = nextSlides[shiftIndex] as Extract<CarouselOutlineSlide, { type: "shift" }>;
      const hasMechanismCue = /(?:^|[^\p{L}])(потому|поэтому|из-за|когда|если|чтобы)(?=$|[^\p{L}])/iu.test(
        shift.body ?? ""
      );
      if (!shift.body || countWords(shift.body) < 8 || !hasMechanismCue) {
        shift.body =
          "Сначала закрепи базовую причину, потом меняй действие. Поэтому результат становится стабильным и предсказуемым.";
      }
    }
  }

  if (mode === "case") {
    const exampleIndex = nextSlides.findIndex((slide) => slide.type === "example");
    if (exampleIndex >= 0 && nextSlides[exampleIndex]?.type === "example") {
      const example = nextSlides[exampleIndex] as Extract<CarouselOutlineSlide, { type: "example" }>;
      if (!example.before || !example.after) {
        const focus = buildCompactTopicFocus(sanitizeTopic(topic), 38);
        example.before = example.before || `До: в вопросе «${focus}» действия были несистемными.`;
        example.after = example.after || "После: ввели понятный алгоритм и получили стабильную динамику.";
      }
    }
  }

  if (mode === "diagnostic") {
    const problemIndex = nextSlides.findIndex((slide) => slide.type === "problem");
    if (problemIndex >= 0 && nextSlides[problemIndex]?.type === "problem") {
      const problem = nextSlides[problemIndex] as Extract<CarouselOutlineSlide, { type: "problem" }>;
      if (!problem.bullets || problem.bullets.length < 2) {
        problem.bullets = buildRoleBulletsFallback("problem", topic, options);
      }
    }

    const shiftIndex = nextSlides.findIndex((slide) => slide.type === "shift");
    if (shiftIndex >= 0 && nextSlides[shiftIndex]?.type === "shift") {
      const shift = nextSlides[shiftIndex] as Extract<CarouselOutlineSlide, { type: "shift" }>;
      if (!shift.body || !/(?:исправ|проверь|сделай|сделайте|меняй|меняйте)/iu.test(shift.body)) {
        shift.body =
          "Проверь один триггер, который запускает сбой, и измени одно действие в тайминге. Так схема стабилизируется.";
      }
    }
  }

  if (mode === "social") {
    const hookIndex = nextSlides.findIndex((slide) => slide.type === "hook");
    if (hookIndex >= 0 && nextSlides[hookIndex]?.type === "hook") {
      const hook = nextSlides[hookIndex] as Extract<CarouselOutlineSlide, { type: "hook" }>;
      const softened = softenNonSalesText(`${hook.title}. ${hook.subtitle}`, 180);
      const parts = softened.text.split(".").map((part) => part.trim()).filter(Boolean);
      hook.title = sanitizeTitleValue(parts[0] || hook.title, 84);
      hook.subtitle =
        sanitizeCopyText(normalizeText(parts.slice(1).join(". "), HOOK_SUBTITLE_INPUT_MAX), HOOK_SUBTITLE_OUTPUT_MAX) ||
        buildFirstSlideSubtitleForMode(topic, mode);
    }
  }

  return nextSlides;
}

function finalizeSlidesForOutput(
  slides: CarouselOutlineSlide[],
  mode: ContentMode,
  topic: string,
  options?: GenerationOptions
) {
  const tonePreference = resolveTonePreference(options?.tone);
  const firstPass = applyToneGuardrails(slides, mode, tonePreference);
  let nextSlides = firstPass.slides;
  let toneViolations = firstPass.violations;

  const modeValidation = validateModeSpecificOutput(nextSlides, mode, topic);
  if (!modeValidation.ok) {
    nextSlides = repairModeSpecificOutput(nextSlides, mode, topic, options);
    const secondPass = applyToneGuardrails(nextSlides, mode, tonePreference);
    nextSlides = secondPass.slides;
    toneViolations += secondPass.violations;
  }

  nextSlides = applyHookEditorialPolish(nextSlides, mode, topic);
  nextSlides = applyNonSalesOpeningStyleGuardrails(nextSlides, mode, topic, options);
  nextSlides = stripBodyArrowsForNonSales(nextSlides, mode);

  nextSlides = nextSlides.map((slide) => {
    if ((slide.type === "mistake" || slide.type === "shift") && countWords(slide.title) < 4) {
      const rebuiltTitle = sanitizeTitleValue(buildRoleTitleFallback(slide.type, topic, options), 92);
      const guaranteedTitle =
        countWords(rebuiltTitle) >= 4
          ? rebuiltTitle
          : slide.type === "shift"
            ? "Как изменить подход к теме"
            : "Ошибка, которая тормозит результат";
      return {
        ...slide,
        title: guaranteedTitle
      };
    }
    return slide;
  });

  const finalValidation = validateModeSpecificOutput(nextSlides, mode, topic);

  return {
    slides: nextSlides,
    toneViolations,
    modeValidationErrors: finalValidation.ok ? [] : finalValidation.reasons
  };
}

function stripBodyArrowsForNonSales(
  slides: CarouselOutlineSlide[],
  mode: ContentMode
): CarouselOutlineSlide[] {
  if (mode === "sales") {
    return slides;
  }

  return slides.map((slide) => {
    if (!("body" in slide) || typeof slide.body !== "string") {
      return slide;
    }

    return {
      ...slide,
      body: slide.body.replace(/\s*→\s*/gu, " ").replace(/\s{2,}/g, " ").trim()
    };
  });
}

export async function generateCarouselFromTopic(
  topic: string,
  requestedSlidesCount?: number,
  options?: GenerationOptions
): Promise<CarouselGenerationResult> {
  const cleanedTopic = normalizeText(topic, 800) || "Новая карусель";
  const modeDecision = detectContentMode({
    topic: cleanedTopic,
    niche: options?.niche,
    audience: options?.audience,
    goal: options?.goal,
    rawPrompt: cleanedTopic,
    modeOverride: options?.contentMode
  });
  const effectiveOptions: GenerationOptions = {
    ...options,
    contentMode: modeDecision.modeEffective
  };
  const slidesCount = resolveSlidesCount(requestedSlidesCount);
  const systemPrompt = buildSystemPrompt(modeDecision.modeEffective, cleanedTopic, effectiveOptions);
  const expectedFlow = resolveExpectedFlowByMode(modeDecision.modeEffective, slidesCount);
  const promptVariant = resolvePromptVariant(options?.promptVariant);

  try {
    const openai = getOpenAIClient();
    const models = resolveModelCandidates(modeDecision.modeEffective);
    const modelAttempts = resolveModelAttemptsPerCandidate();
    const retryInvalidSchema = shouldRetryInvalidSchema(modeDecision.modeEffective);
    const retryAnotherModelAfterQualityFailure = shouldRetryWithAnotherModelAfterQualityFailure(
      modeDecision.modeEffective
    );
    let lastError: unknown = null;

    for (const model of models) {
      for (let attempt = 1; attempt <= modelAttempts; attempt += 1) {
        try {
          const userMessage = buildUserPrompt(
            cleanedTopic,
            options?.niche,
            options?.audience,
            options?.tone,
            options?.goal,
            modeDecision.modeEffective,
            expectedFlow
          );
          const validationErrors: string[] = [];
          let wasRetried = false;
          let tokensUsed = 0;

          const response = await requestCarouselCompletion(
            openai,
            model,
            systemPrompt,
            userMessage,
            expectedFlow.length
          );
          tokensUsed += readTotalTokens(response);
          let parsedResponse = parseCarouselModelResponse(response);
          let validationResult = validateCarouselResponse(parsedResponse, expectedFlow);
          validationErrors.push(...validationResult.errors);

          if (!validationResult.valid && retryInvalidSchema) {
            wasRetried = true;
            const retryUserMessage =
              userMessage +
              "\n\nВАЖНО: В прошлый раз были ошибки: " +
              validationResult.errors.join("; ") +
              ". Исправь их.";
            const retryResponse = await requestCarouselCompletion(
              openai,
              model,
              systemPrompt,
              retryUserMessage,
              expectedFlow.length
            );
            tokensUsed += readTotalTokens(retryResponse);
            parsedResponse = parseCarouselModelResponse(retryResponse);
            validationResult = validateCarouselResponse(parsedResponse, expectedFlow);
            validationErrors.push(...validationResult.errors);
          } else if (!validationResult.valid) {
            validationErrors.push("schema_retry_skipped");
          }

          const normalizedSlides = normalizeSlides(
            mapModelSlidesToLegacyShape(parsedResponse.slides, expectedFlow, modeDecision.modeEffective),
            expectedFlow,
            cleanedTopic,
            effectiveOptions
          );
          const constrainedSlides = enforceTopicAndHookIntegrity(
            normalizedSlides,
            expectedFlow,
            cleanedTopic,
            effectiveOptions,
            modeDecision.modeEffective
          );
          const repairedSlides = repairTopicCoverage(
            constrainedSlides,
            expectedFlow,
            cleanedTopic,
            effectiveOptions,
            modeDecision.modeEffective
          );
          const polishedSlides = applyFinalCopyPolish(
            repairedSlides,
            expectedFlow,
            cleanedTopic,
            effectiveOptions,
            modeDecision.modeEffective
          );
          const firstSlideApplied = enforceFirstSlidePolicy(
            polishedSlides,
            expectedFlow,
            cleanedTopic,
            modeDecision.modeEffective
          );
          let firstSlideRepairs = firstSlideApplied.repairs;
          const topicRelevantSlides = isOutlineTopicRelevant(firstSlideApplied.slides, cleanedTopic)
            ? firstSlideApplied.slides
            : buildFallbackSlides(cleanedTopic, expectedFlow, effectiveOptions);
          const qualityGuardedSlides = enforceSlideQuality(
            topicRelevantSlides,
            expectedFlow,
            cleanedTopic,
            effectiveOptions
          );
          const topicCoveredSlides = repairTopicCoverage(
            qualityGuardedSlides,
            expectedFlow,
            cleanedTopic,
            effectiveOptions,
            modeDecision.modeEffective
          );
          const finalFirstSlideApplied = enforceFirstSlidePolicy(
            topicCoveredSlides,
            expectedFlow,
            cleanedTopic,
            modeDecision.modeEffective
          );
          firstSlideRepairs += finalFirstSlideApplied.repairs;
          const quality = evaluateSlideQuality(finalFirstSlideApplied.slides, expectedFlow, cleanedTopic);

          if (topicRelevantSlides !== firstSlideApplied.slides) {
            console.warn("Generated outline was strongly off-topic. Using deterministic fallback slides.");
          }

          if (!quality.ok) {
            const locallyRepairedSlides = rescueWeakSlidesAfterQualityCheck(
              qualityGuardedSlides,
              expectedFlow,
              cleanedTopic,
              effectiveOptions,
              quality.reasons,
              modeDecision.modeEffective
            );
            const firstSlideAfterRescue = enforceFirstSlidePolicy(
              locallyRepairedSlides,
              expectedFlow,
              cleanedTopic,
              modeDecision.modeEffective
            );
            firstSlideRepairs += firstSlideAfterRescue.repairs;
            const repairedQuality = evaluateSlideQuality(
              firstSlideAfterRescue.slides,
              expectedFlow,
              cleanedTopic
            );

            if (repairedQuality.ok) {
              const finalizedOutput = finalizeSlidesForOutput(
                firstSlideAfterRescue.slides,
                modeDecision.modeEffective,
                cleanedTopic,
                effectiveOptions
              );
              validationErrors.push(
                ...finalizedOutput.modeValidationErrors.map((reasonCode) => `mode:${reasonCode}`)
              );
              if (finalizedOutput.modeValidationErrors.length > 0 && attempt < modelAttempts) {
                console.warn(
                  `Model "${model}" attempt ${attempt} failed mode quality gate (${finalizedOutput.modeValidationErrors.join(", ")}). Retrying.`
                );
                continue;
              }
              return {
                slides: finalizedOutput.slides,
                caption: normalizeGeneratedCaption(parsedResponse.caption),
                promptVariant,
                generationSource: "model",
                generationMeta: {
                  model,
                  tokensUsed,
                  validationErrors: dedupeErrors(validationErrors),
                  retried: wasRetried
                },
                generationProfile: {
                  ...buildGenerationProfile({
                    modeDecision,
                    goal: options?.goal,
                    firstSlideRepairs,
                    toneViolations: finalizedOutput.toneViolations,
                    modeValidationErrors: finalizedOutput.modeValidationErrors,
                    fallbackUsed: false
                  })
                }
              };
            }

            const reason = quality.reasons.join("; ") || "low narrative quality";
            if (attempt < modelAttempts) {
              console.warn(
                `Model "${model}" attempt ${attempt} returned weak copy (${reason}). Retrying.`
              );
              continue;
            }

            lastError = new Error(`Low-quality generation from model "${model}": ${reason}`);
            if (!retryAnotherModelAfterQualityFailure) {
              throw lastError;
            }
            console.warn(
              `Model "${model}" produced weak copy after retries (${reason}). Trying next candidate.`
            );
            continue;
          }

          if (hasBannedTemplateLanguage(qualityGuardedSlides)) {
            if (attempt < modelAttempts) {
              console.warn(`Model "${model}" attempt ${attempt} returned templated language. Retrying.`);
              continue;
            }
            const strippedSlides = stripBannedTemplateLanguage(
              finalFirstSlideApplied.slides,
              expectedFlow,
              cleanedTopic,
              effectiveOptions
            );
            const finalizedOutput = finalizeSlidesForOutput(
              strippedSlides,
              modeDecision.modeEffective,
              cleanedTopic,
              effectiveOptions
            );
            validationErrors.push(
              ...finalizedOutput.modeValidationErrors.map((reasonCode) => `mode:${reasonCode}`)
            );
            if (finalizedOutput.modeValidationErrors.length > 0 && attempt < modelAttempts) {
              console.warn(
                `Model "${model}" attempt ${attempt} failed mode quality gate after strip (${finalizedOutput.modeValidationErrors.join(", ")}). Retrying.`
              );
              continue;
            }
            return {
              slides: finalizedOutput.slides,
              caption: normalizeGeneratedCaption(parsedResponse.caption),
              promptVariant,
              generationSource: "model",
              generationMeta: {
                model,
                tokensUsed,
                validationErrors: dedupeErrors(validationErrors),
                retried: wasRetried
              },
              generationProfile: {
                ...buildGenerationProfile({
                  modeDecision,
                  goal: options?.goal,
                  firstSlideRepairs,
                  toneViolations: finalizedOutput.toneViolations,
                  modeValidationErrors: finalizedOutput.modeValidationErrors,
                  fallbackUsed: false
                })
              }
            };
          }

          const finalizedOutput = finalizeSlidesForOutput(
            finalFirstSlideApplied.slides,
            modeDecision.modeEffective,
            cleanedTopic,
            effectiveOptions
          );
          validationErrors.push(
            ...finalizedOutput.modeValidationErrors.map((reasonCode) => `mode:${reasonCode}`)
          );
          if (finalizedOutput.modeValidationErrors.length > 0 && attempt < modelAttempts) {
            console.warn(
              `Model "${model}" attempt ${attempt} failed mode quality gate (${finalizedOutput.modeValidationErrors.join(", ")}). Retrying.`
            );
            continue;
          }
          return {
            slides: finalizedOutput.slides,
            caption: normalizeGeneratedCaption(parsedResponse.caption),
            promptVariant,
            generationSource: "model",
            generationMeta: {
              model,
              tokensUsed,
              validationErrors: dedupeErrors(validationErrors),
              retried: wasRetried
            },
            generationProfile: {
              ...buildGenerationProfile({
                modeDecision,
                goal: options?.goal,
                firstSlideRepairs,
                toneViolations: finalizedOutput.toneViolations,
                modeValidationErrors: finalizedOutput.modeValidationErrors,
                fallbackUsed: false
              })
            }
          };
        } catch (error) {
          lastError = error;
          logModelFailure(model, error);

          if (!canRetryWithAnotherModel(error)) {
            throw error;
          }

          if (attempt < modelAttempts) {
            continue;
          }
        }

        console.warn(`Model "${model}" failed for generation. Trying next candidate.`);
      }
    }

    throw lastError ?? new Error("OpenAI generation failed for all model candidates.");
  } catch (error) {
    console.error("AI generation failed. Falling back to deterministic slides:", error);

    const fallbackSlides = buildFallbackSlides(cleanedTopic, expectedFlow, effectiveOptions);
    const firstSlideFallbackApplied = enforceFirstSlidePolicy(
      fallbackSlides,
      expectedFlow,
      cleanedTopic,
      modeDecision.modeEffective
    );
    const finalizedFallback = finalizeSlidesForOutput(
      firstSlideFallbackApplied.slides,
      modeDecision.modeEffective,
      cleanedTopic,
      effectiveOptions
    );

    return {
      slides: finalizedFallback.slides,
      caption: "",
      promptVariant,
      generationSource: "fallback",
      generationMeta: {
        model: "fallback",
        tokensUsed: 0,
        validationErrors: dedupeErrors(
          [
            ...(error instanceof Error && error.message.trim()
              ? [error.message.trim()]
              : ["fallback activated"]),
            ...finalizedFallback.modeValidationErrors.map((reasonCode) => `mode:${reasonCode}`)
          ].filter(Boolean)
        ),
        retried: false
      },
      generationProfile: {
        ...buildGenerationProfile({
          modeDecision,
          goal: options?.goal,
          firstSlideRepairs: firstSlideFallbackApplied.repairs,
          toneViolations: finalizedFallback.toneViolations,
          modeValidationErrors: finalizedFallback.modeValidationErrors,
          fallbackUsed: true
        })
      },
      fallbackReason: resolveFallbackReason(error)
    };
  }
}

export async function generateCaptionFromCarousel(
  input: CaptionGenerationInput
): Promise<CarouselPostCaption> {
  const topic = normalizeText(input.topic, 220) || "вашей теме";
  const slides = Array.isArray(input.slides) ? input.slides.slice(0, 10) : [];
  const modeDecision = detectContentMode({
    topic,
    niche: input.niche,
    audience: input.audience,
    goal: input.goal,
    rawPrompt: slides.map((slide) => collectSlideCopy(slide)).join(" "),
    modeOverride: input.contentMode
  });
  const mode = input.resolvedMode ?? modeDecision.modeEffective;
  const fallback = buildCaptionFallback(topic, slides, input.goal, mode);

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
                    "Do not mention slides by number. Keep smooth narrative flow.",
                    mode === "sales"
                      ? "Sales mode: CTA may be direct and conversion-focused."
                      : "Non-sales mode: CTA must be soft, without «write in direct» patterns."
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
                    goal: input.goal,
                    contentMode: input.contentMode,
                    resolvedMode: mode
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
                  cta_soft: { type: "string", maxLength: 220 },
                  cta_aggressive: { type: "string", maxLength: 220 },
                  hashtags: {
                    type: "array",
                    minItems: 3,
                    maxItems: 8,
                    items: { type: "string", maxLength: 40 }
                  }
                },
                required: ["text", "cta", "cta_soft", "cta_aggressive", "hashtags"]
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
          cta_soft?: unknown;
          cta_aggressive?: unknown;
          hashtags?: unknown;
        };

        return normalizeCaption(parsed, fallback, input.goal, mode);
      } catch (error) {
        lastError = error;
        logModelFailure(model, error);

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

function resolveExpectedFlowByMode(mode: ContentMode, targetCount: number) {
  if (targetCount !== 9) {
    return resolveExpectedFlow(targetCount);
  }

  const plannedFlow = MODE_SLIDE_PLANS[mode]?.map((step) => step.role);
  if (Array.isArray(plannedFlow) && plannedFlow.length === 9) {
    return plannedFlow;
  }

  return resolveExpectedFlow(targetCount);
}

function formatModeSlidePlan(mode: ContentMode, flow: CarouselSlideRole[]) {
  const plan = MODE_SLIDE_PLANS[mode] ?? MODE_SLIDE_PLANS.expert;
  const intentByRole = new Map(plan.map((step) => [step.role, step.intent]));

  return flow
    .map((role, index) => {
      const intent = intentByRole.get(role) ?? "раскрыть мысль по делу";
      return `${index + 1}. ${role} — ${intent}`;
    })
    .join("\n");
}

function resolvePromptVariant(value?: PromptVariant | string) {
  return value === "A" ? "A" : "B";
}

function resolveContentMode(value?: ContentModeInput | string): ContentModeInput {
  if (value === "auto") {
    return "auto";
  }

  if (typeof value !== "string") {
    return "auto";
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "auto";
  }

  return CONTENT_MODE_LIST.includes(normalized as ContentMode)
    ? (normalized as ContentMode)
    : "auto";
}

function detectContentMode(input: {
  topic: string;
  niche?: string;
  audience?: string;
  goal?: string;
  rawPrompt?: string;
  modeOverride?: ContentModeInput;
}): ModeDecision {
  const override = resolveContentMode(input.modeOverride);
  const source = normalizeText(
    [
      input.topic,
      input.niche ?? "",
      input.audience ?? "",
      input.goal ?? "",
      input.rawPrompt ?? ""
    ]
      .filter(Boolean)
      .join(" "),
    720
  ).toLowerCase();
  const goal = normalizeText(input.goal ?? "", 64).toLowerCase();

  const modeScores: Record<ContentMode, number> = {
    sales: 0,
    expert: 0,
    instruction: 0,
    diagnostic: 0,
    case: 0,
    social: 0
  };
  const reasonCodes: string[] = [];

  const addScore = (mode: ContentMode, score: number, reason: string, condition: boolean) => {
    if (!condition) {
      return;
    }
    modeScores[mode] += score;
    reasonCodes.push(reason);
  };

  addScore(
    "sales",
    4,
    "sales_keywords",
    containsStem(source, [
      "куп",
      "прод",
      "заяв",
      "лид",
      "ворон",
      "сделк",
      "доход",
      "roi",
      "конверс",
      "ипотек"
    ])
  );
  addScore("sales", 3, "goal_leads", isLeadsGoal(goal));

  addScore(
    "expert",
    3,
    "expert_keywords",
    containsStem(source, ["почему", "объясн", "разбор", "что меш", "как работ"])
  );

  addScore(
    "instruction",
    4,
    "instruction_keywords",
    containsStem(source, ["пошаг", "инструк", "чек-лист", "алгоритм", "как сдел"])
  );

  addScore(
    "diagnostic",
    3,
    "diagnostic_keywords",
    containsStem(source, ["ошиб", "миф", "не получ", "почему не", "где срыв"])
  );

  addScore(
    "case",
    3,
    "case_keywords",
    containsStem(source, ["кейс", "пример", "до/после", "до после"])
  );

  addScore(
    "social",
    2,
    "social_keywords",
    containsStem(source, ["истори", "опыт", "путь", "жизн", "быт", "поддерж"])
  );

  // Household and pet-care topics should not fall into default sales framing.
  addScore(
    "expert",
    3,
    "household_pet_topic",
    containsStem(source, ["щен", "собак", "туалет", "выгул", "луж", "пелен"])
  );

  if (override !== "auto") {
    return {
      modeDetected: override,
      modeEffective: override,
      modeSource: "manual" as const,
      confidence: 1,
      reasonCodes: ["manual_override", ...reasonCodes]
    };
  }

  const ranked = (Object.entries(modeScores) as Array<[ContentMode, number]>).sort((a, b) => b[1] - a[1]);
  const [topMode, topScore] = ranked[0] ?? ["expert", 0];
  const secondScore = ranked[1]?.[1] ?? 0;

  if (topScore <= 0) {
    return {
      modeDetected: "expert" as const,
      modeEffective: "expert" as const,
      modeSource: "auto" as const,
      confidence: 0.55,
      reasonCodes: ["auto_default_expert", ...reasonCodes]
    };
  }

  const hasTie = ranked.filter(([, score]) => score === topScore).length > 1;
  if (hasTie) {
    return {
      modeDetected: "expert" as const,
      modeEffective: "expert" as const,
      modeSource: "auto" as const,
      confidence: 0.56,
      reasonCodes: ["score_tie_default_expert", ...reasonCodes]
    };
  }

  const confidence = Math.max(0.55, Math.min(0.95, 0.55 + (topScore - secondScore) * 0.08));

  return {
    modeDetected: topMode,
    modeEffective: topMode,
    modeSource: "auto" as const,
    confidence,
    reasonCodes
  };
}

function containsStem(source: string, stems: string[]) {
  if (!source) {
    return false;
  }

  const variants = stems
    .map((stem) => stem.trim())
    .filter(Boolean)
    .map((stem) => escapeRegExp(stem));

  if (!variants.length) {
    return false;
  }

  return new RegExp(
    `(?:^|[^\\p{L}\\p{N}])(?:${variants.join("|")})[\\p{L}\\p{N}-]*(?=$|[^\\p{L}\\p{N}])`,
    "iu"
  ).test(source);
}

function resolveTopicDomain(topic: string, options?: GenerationOptions): TopicDomain {
  const source = normalizeText(
    [topic, options?.niche ?? "", options?.audience ?? ""].filter(Boolean).join(" "),
    420
  ).toLowerCase();

  if (containsStem(source, ["финанс", "инвест", "бюджет", "деньг", "доход", "портфел", "кредит", "налог", "капитал", "риск"])) {
    return "finance";
  }

  if (containsStem(source, ["врач", "медицин", "диагноз", "пациент", "клиник", "здоров", "лечение", "терапи", "симптом"])) {
    return "health";
  }

  if (containsStem(source, ["психолог", "тревог", "выгоран", "терапевт", "эмоци", "самооцен", "отношен", "стресс"])) {
    return "psychology";
  }

  if (containsStem(source, ["фитнес", "тренер", "трениров", "зал", "спорт", "форма", "похуд", "нагрузк"])) {
    return "fitness";
  }

  if (containsStem(source, ["бьюти", "салон", "мастер", "космет", "ресниц", "маник", "ногт", "бров", "стилист"])) {
    return "beauty";
  }

  if (containsStem(source, ["репетитор", "обучен", "ученик", "урок", "школ", "курс", "преподав", "студент", "образован"])) {
    return "education";
  }

  if (
    containsStem(source, [
      "продаж",
      "заявк",
      "лид",
      "воронк",
      "конверс",
      "маркетолог",
      "риелтор",
      "агентств",
      "клиент",
      "сделк",
      "реклам",
      "недвижим",
      "квартир",
      "показ",
      "объект",
      "авито",
      "циан",
      "ипотек"
    ])
  ) {
    return "sales";
  }

  const hasPersonalBrandPhrase = /(?:^|[^\p{L}\p{N}])личн[а-яё]*\s+бренд(?=$|[^\p{L}\p{N}])/iu.test(
    source
  );
  if (
    hasPersonalBrandPhrase ||
    containsStem(source, ["эксперт", "блог", "контент", "instagram", "telegram", "соцсет", "автор"])
  ) {
    return "creator";
  }

  return "general";
}

function buildDomainPromptAddendum(domain: TopicDomain) {
  if (domain === "education") {
    return [
      "Domain: education. Speak through progress, practice, motivation, lesson rhythm and homework.",
      "Avoid hard-sales vocabulary unless user explicitly asks for selling mechanics."
    ];
  }

  if (domain === "psychology") {
    return [
      "Domain: psychology. Keep language careful, humane, and practical for client communication.",
      "No manipulative pressure, no aggressive selling language."
    ];
  }

  if (domain === "health") {
    return [
      "Domain: health. Prioritize clarity, trust, and understandable explanations over hype.",
      "Avoid miracle claims and loud marketing clichés."
    ];
  }

  if (domain === "fitness") {
    return [
      "Domain: fitness. Use concrete routine, consistency, load, recovery and return-to-training angles.",
      "Avoid generic motivational slogans without actionable steps."
    ];
  }

  if (domain === "beauty") {
    return [
      "Domain: beauty. Use client journey: first visit, repeat booking, trust, service value.",
      "Avoid abstract business jargon."
    ];
  }

  if (domain === "finance") {
    return [
      "Domain: finance. Explain through risk, decisions, scenario outcomes and client confidence.",
      "No clickbait promises or unrealistic certainty."
    ];
  }

  if (domain === "creator") {
    return [
      "Domain: creator/personal brand. Keep voice native for social media and practical content creation.",
      "Avoid sterile corporate wording."
    ];
  }

  if (domain === "sales") {
    return [
      "Domain: commercial growth. Keep copy persuasive but specific and human, not pushy.",
      "Use sales language only where it is contextually relevant."
    ];
  }

  return [
    "Domain: mixed/general. Stay close to the topic semantics and avoid importing sales jargon by default."
  ];
}

function buildUserPrompt(
  topic: string,
  niche?: string,
  audience?: string,
  tone?: string,
  goal?: string,
  mode: ContentMode = "expert",
  expectedFlow: CarouselSlideRole[] = CANONICAL_FLOW
) {
  const resolvedNiche = normalizeText(niche, 120);
  const resolvedAudience = normalizeText(audience, 160);
  const resolvedTone = normalizeText(tone, 40);
  const resolvedGoal = normalizeText(goal, 48);

  let prompt = `Тема карусели: "${topic}"`;

  if (resolvedNiche) {
    prompt += `\nНиша автора: ${resolvedNiche}`;
  }
  if (resolvedAudience) {
    prompt += `\nЦелевая аудитория: ${resolvedAudience}`;
  }
  if (resolvedTone) {
    prompt += `\nТон: ${resolvedTone}`;
  }
  if (resolvedGoal) {
    prompt += `\nЦель карусели: ${resolvedGoal}`;
  }

  prompt += `\nРежим контента: ${mode}`;

  if (mode !== "sales") {
    prompt +=
      "\nПравило 1-го слайда: прямо назови тему, без мета-хука и без интриги про подачу." +
      "\nЗапрещено для 1-го слайда: «узкое место», «результат буксует», «дочитывали/сохраняли», «покажу, как раскрыть тему»." +
      "\nТон: спокойный экспертный, без обвинений и лишней драматизации." +
      "\nCTA: мягкий или отсутствует, без «напиши слово в директ» и без двойного призыва.";
  }

  if (mode === "instruction") {
    prompt += "\nФокус структуры: цель -> шаги -> условия -> частые ошибки -> краткое резюме.";
  } else if (mode === "diagnostic") {
    prompt += "\nФокус структуры: симптомы -> причины -> механизм -> как исправить.";
  } else if (mode === "case") {
    prompt += "\nФокус структуры: контекст -> действия -> результат -> выводы.";
  }

  prompt += `\n\nПлан слайдов по ролям:\n${formatModeSlidePlan(mode, expectedFlow)}`;
  prompt += `\n\nСоздай карусель из ${expectedFlow.length} слайдов. Ответ — только JSON.`;

  return prompt;
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
            title: { type: "string", maxLength: 120 },
            body: { type: "string", maxLength: 1200 }
          },
          required: ["role", "title", "body"]
        }
      },
      caption: { type: "string", maxLength: 2400 }
    },
    required: ["slides", "caption"]
  };
}

function buildCaptionPrompt(input: CaptionGenerationInput) {
  const niche = normalizeText(input.niche ?? "", 120);
  const audience = normalizeText(input.audience ?? "", 160);
  const tone = normalizeText(input.tone ?? "", 40);
  const goal = normalizeText(input.goal ?? "", 48);
  const modeOverride = resolveContentMode(input.contentMode);
  const mode: ContentMode =
    input.resolvedMode ??
    (modeOverride === "auto" ? (isLeadsGoal(goal.toLowerCase()) ? "sales" : "expert") : modeOverride);
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

  const formatLines =
    mode === "sales"
      ? [
          "- 3-4 абзаца",
          "- Первый абзац: крючок, цепляющее начало (вопрос или утверждение)",
          "- Второй абзац: суть — о чём карусель и зачем листать",
          "- Третий абзац: личный опыт или наблюдение автора (1-2 предложения)",
          "- Четвёртый абзац: призыв к действию"
        ]
      : [
          "- 3-4 абзаца",
          "- Первый абзац: прямо назови тему и кому это полезно",
          "- Второй абзац: объясни причину/механику без драмы",
          "- Третий абзац: практический шаг, который можно применить сразу",
          "- Четвёртый абзац: мягкий вывод или мягкий CTA"
        ];

  const ctaLines =
    mode === "sales"
      ? [
          "- cta: основной призыв из 1-2 предложений.",
          "- cta_soft: мягкий CTA (сохрани / отправь другу).",
          "- cta_aggressive: прямой CTA (напиши слово / оставь комментарий)."
        ]
      : [
          "- cta: мягкий CTA или спокойный следующий шаг.",
          "- cta_soft: мягкий CTA (сохрани / проверь у себя / попробуй шаг).",
          "- cta_aggressive: резервная версия без «напиши в директ» и без давления."
        ];

  return [
    `Напиши подпись к Instagram-посту для карусели на тему: "${input.topic}".`,
    `Режим контента: ${mode}.`,
    niche ? `Ниша: ${niche}` : "",
    audience ? `Аудитория: ${audience}` : "",
    tone ? `Тон: ${tone}` : "",
    goal ? `Цель: ${goal}` : "",
    "",
    "Формат:",
    ...formatLines,
    "",
    "НЕ используй:",
    "- Хештеги внутри текста подписи",
    "- Эмодзи в начале абзацев",
    "- «Всем привет!» и подобные вступления",
    "- @username, счётчики, ссылки",
    mode === "sales" ? "" : "- Прямые призывы в директ и манипулятивный дожим",
    "",
    mode === "sales"
      ? "Тон: живой, практичный, без канцелярита."
      : "Тон: спокойный экспертный, без обвинений и давления.",
    "",
    "Контекст карусели:",
    slideDigest,
    "",
    "Ответ верни в JSON с полями: text, cta, cta_soft, cta_aggressive, hashtags.",
    "- text: 3-4 абзаца в заданном формате, без хештегов.",
    ...ctaLines,
    "- hashtags: 4-8 тематических хештегов отдельным массивом."
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeSlides(
  rawSlides: unknown,
  expectedFlow: CarouselSlideRole[],
  topic: string,
  options?: GenerationOptions
): CarouselOutlineSlide[] {
  const source = Array.isArray(rawSlides) ? rawSlides : [];
  const usedIndexes = new Set<number>();

  return expectedFlow.map((expectedType, index) => {
    const candidateIndex = pickCandidateIndex(source, expectedType, index, usedIndexes);
    if (candidateIndex >= 0) {
      usedIndexes.add(candidateIndex);
    }
    const candidate = candidateIndex >= 0 ? source[candidateIndex] : null;

    return normalizeSlideByType(expectedType, candidate, topic, index, options);
  });
}

function enforceTopicAndHookIntegrity(
  slides: CarouselOutlineSlide[],
  expectedFlow: CarouselSlideRole[],
  topic: string,
  options?: GenerationOptions,
  mode: ContentMode = resolveModeFromOptions(options)
) {
  return expectedFlow.map((role, index) => {
    const current = slides[index];
    const fallback = normalizeSlideByType(role, null, topic, index, options);

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
          ? sanitizeCopyText(
              normalizeText(current.subtitle, HOOK_SUBTITLE_INPUT_MAX),
              HOOK_SUBTITLE_OUTPUT_MAX
            )
          : "";
      const hookCopy = [normalizedTitle, safeSubtitle].filter(Boolean).join(" ");
      const hookTopicMismatch = !isCopyTopicAligned(hookCopy, topic);
      const hookAnchorMismatch = !hasPrimaryTopicAnchor(hookCopy, topic);
      const hookLooksAwkward = hasAwkwardHookTitle(normalizedTitle);

      if (!normalizedTitle || hasGenericMistakeLead || hookTopicMismatch || hookAnchorMismatch || hookLooksAwkward) {
        return {
          ...current,
          title: buildHookFallbackTitle(topic, mode),
          subtitle: safeSubtitle || buildHookFallbackSubtitle(topic, mode)
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
  topic: string,
  options?: GenerationOptions,
  mode: ContentMode = resolveModeFromOptions(options)
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
      typeof hook.subtitle === "string"
        ? sanitizeCopyText(normalizeText(hook.subtitle, HOOK_SUBTITLE_INPUT_MAX), HOOK_SUBTITLE_OUTPUT_MAX)
        : "";
    hook.title = buildHookFallbackTitle(topic, mode);
    hook.subtitle = safeSubtitle || buildHookFallbackSubtitle(topic, mode);
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

function applyFinalCopyPolish(
  slides: CarouselOutlineSlide[],
  expectedFlow: CarouselSlideRole[],
  topic: string,
  options?: GenerationOptions,
  mode: ContentMode = resolveModeFromOptions(options)
) {
  const nextSlides = slides.map((slide) => ({ ...slide })) as CarouselOutlineSlide[];
  const hookIndex = expectedFlow.findIndex((role) => role === "hook");
  const shiftIndex = expectedFlow.findIndex((role) => role === "shift");
  const ctaIndex = expectedFlow.findIndex((role) => role === "cta");

  if (hookIndex >= 0) {
    const hook = nextSlides[hookIndex];
    if (hook?.type === "hook") {
      const normalizedTitle = sanitizeTitleValue(hook.title, 84);
      const normalizedSubtitle = sanitizeCopyText(
        normalizeText(hook.subtitle, HOOK_SUBTITLE_INPUT_MAX),
        HOOK_SUBTITLE_OUTPUT_MAX
      );
      const combinedHook = `${normalizedTitle} ${normalizedSubtitle}`.trim();
      const shouldRepairHook =
        !normalizedTitle ||
        hasDanglingTail(normalizedTitle) ||
        isHookEchoingTopic(normalizedTitle, topic) ||
        isListLikeHookTitle(normalizedTitle) ||
        isHookQuestionTemplate(normalizedTitle) ||
        (mode !== "sales" && hasNonSalesGrammarRisk(normalizedTitle)) ||
        hasAwkwardHookTitle(normalizedTitle) ||
        startsWithGenericMistakeLead(normalizedTitle) ||
        hasLegacyTemplatePhrase(combinedHook) ||
        BANNED_TEMPLATE_PATTERNS.some((pattern) => pattern.test(combinedHook)) ||
        !hasPrimaryTopicAnchor(combinedHook, topic);
      const candidates = buildHookCandidates(topic, options, mode);
      const best = pickBestHookCandidate(candidates);

      if (shouldRepairHook) {
        if (!best) {
          hook.title = buildHookFallbackTitle(topic, mode);
          hook.subtitle = normalizedSubtitle || buildHookFallbackSubtitle(topic, mode);
        } else {
          hook.title = best.title;
          hook.subtitle = best.subtitle;
        }
      } else {
        hook.title = normalizedTitle;
        hook.subtitle = normalizedSubtitle || buildHookFallbackSubtitle(topic, mode);
      }

      if (countSentenceMarks(`${hook.title} ${hook.subtitle}`) > 2) {
        hook.subtitle = buildHookFallbackSubtitle(topic, mode);
      }

      const anchoredHook = `${hook.title} ${hook.subtitle}`.trim();
      if (!hasPrimaryTopicAnchor(anchoredHook, topic)) {
        hook.title = addTopicAnchorToTitle(hook.title, buildTopicAnchorLabel(topic));
      }
    }
  }

  if (shiftIndex >= 0) {
    const shift = nextSlides[shiftIndex];
    if (shift?.type === "shift") {
      const cleanShift = sanitizeTitleValue(shift.title, 92);
      const weakShift =
        !cleanShift ||
        WEAK_SHIFT_PATTERNS.some((pattern) => pattern.test(cleanShift)) ||
        cleanShift.length < 16;

      if (weakShift) {
        shift.title = buildRoleTitleFallback("shift", topic, options);
      } else {
        shift.title = cleanShift;
      }
    }
  }

  if (ctaIndex >= 0) {
    const cta = nextSlides[ctaIndex];
    if (cta?.type === "cta") {
      const ctaVariants = buildCtaVariants(options?.goal, topic, mode);
      const normalizedTitle = sanitizeTitleValue(cta.title, 84);
      const normalizedSubtitle = sanitizeCopyText(
        normalizeText(cta.subtitle, CTA_SUBTITLE_INPUT_MAX),
        CTA_SUBTITLE_OUTPUT_MAX
      );
      const hasPrimaryAction = hasPrimaryCtaActionVerb(normalizedSubtitle);
      const directCtaDetected = containsDirectMessageCta(normalizedSubtitle);
      const shouldUseSoftCta = mode !== "sales" && (directCtaDetected || !hasPrimaryAction);
      const actionIsAcceptable = hasPrimaryAction;
      const weakTitle =
        !normalizedTitle ||
        /\b(готов[а-яё]*|объединить\s+усилия|поехали|пора\s+действовать|давайте\s+начнем)\b/iu.test(
          normalizedTitle
        );

      cta.title = weakTitle
        ? buildCtaTitleFallback(options?.goal, topic, mode)
        : normalizedTitle;
      cta.subtitle = shouldUseSoftCta
        ? ctaVariants.soft
        : actionIsAcceptable
          ? normalizedSubtitle
          : ctaVariants.selected;
    }
  }

  return nextSlides;
}

function enforceSlideQuality(
  slides: CarouselOutlineSlide[],
  expectedFlow: CarouselSlideRole[],
  topic: string,
  options?: GenerationOptions
): CarouselOutlineSlide[] {
  const mode = resolveModeFromOptions(options);

  return expectedFlow.map((role, index) => {
    const current = slides[index];
    const fallback = normalizeSlideByType(role, null, topic, index, options);

    if (!current || current.type !== role) {
      return fallback;
    }

    if (role === "hook") {
      const hook = current as Extract<CarouselOutlineSlide, { type: "hook" }>;
      const title = sanitizeTitleValue(hook.title, 84);
      const subtitle = sanitizeCopyText(
        normalizeText(hook.subtitle, HOOK_SUBTITLE_INPUT_MAX),
        HOOK_SUBTITLE_OUTPUT_MAX
      );
      const weakTitle =
        !title ||
        hasDanglingTail(title) ||
        isHookEchoingTopic(title, topic) ||
        isListLikeHookTitle(title) ||
        isHookQuestionTemplate(title) ||
        (mode !== "sales" && hasNonSalesGrammarRisk(title)) ||
        hasAwkwardHookTitle(title) ||
        startsWithGenericMistakeLead(title) ||
        hasLegacyTemplatePhrase(title) ||
        isWeakRoleTitle(title);

      return {
        type: "hook",
        title: weakTitle ? buildHookFallbackTitle(topic, mode) : title,
        subtitle: subtitle || buildHookFallbackSubtitle(topic, mode)
      };
    }

    if (role === "problem") {
      const problem = current as Extract<CarouselOutlineSlide, { type: "problem" }>;
      const problemFallback = fallback as Extract<CarouselOutlineSlide, { type: "problem" }>;
      const title = sanitizeTitleValue(problem.title, 80);
      const bullets = normalizeBullets(problem.bullets, problemFallback.bullets);
      const strongBullets = pickStrongBullets(bullets, problemFallback.bullets);
      return {
        type: "problem",
        title:
          !title || startsWithGenericMistakeLead(title) || hasLegacyTemplatePhrase(title) || isWeakRoleTitle(title)
            ? buildRoleTitleFallback("problem", topic, options)
            : title,
        bullets: strongBullets
      };
    }

    if (role === "amplify") {
      const amplify = current as Extract<CarouselOutlineSlide, { type: "amplify" }>;
      const amplifyFallback = fallback as Extract<CarouselOutlineSlide, { type: "amplify" }>;
      const title = sanitizeTitleValue(amplify.title, 80);
      const bullets = normalizeBullets(amplify.bullets, amplifyFallback.bullets);
      const strongBullets = pickStrongBullets(bullets, amplifyFallback.bullets);
      return {
        type: "amplify",
        title:
          !title || startsWithGenericMistakeLead(title) || hasLegacyTemplatePhrase(title) || isWeakRoleTitle(title)
            ? buildRoleTitleFallback("amplify", topic, options)
            : title,
        bullets: strongBullets
      };
    }

    if (role === "mistake") {
      const mistake = current as Extract<CarouselOutlineSlide, { type: "mistake" }>;
      const mistakeFallback = fallback as CarouselOutlineSlide & { body?: string };
      const title = sanitizeTitleValue(mistake.title, 92);
      const body =
        normalizeBodyText((mistake as { body?: unknown }).body, BODY_BLOCK_INPUT_MAX) ||
        normalizeBodyText(mistakeFallback.body, BODY_BLOCK_OUTPUT_MAX) ||
        mistakeFallback.body ||
        "Совет звучит слишком общо, поэтому человек не узнаёт свою ситуацию\nНет конкретного примера, из-за этого мысль воспринимается как шаблон\nПосле слайда неясно, какое действие сделать прямо сейчас";
      const weakTitle =
        !title ||
        startsWithGenericMistakeLead(title) ||
        hasLegacyTemplatePhrase(title) ||
        isWeakRoleTitle(title) ||
        countWords(title) < 4;

      return {
        type: "mistake",
        title: weakTitle ? buildRoleTitleFallback("mistake", topic, options) : title,
        body
      } as CarouselOutlineSlide;
    }

    if (role === "consequence") {
      const consequence = current as Extract<CarouselOutlineSlide, { type: "consequence" }>;
      const consequenceFallback = fallback as Extract<CarouselOutlineSlide, { type: "consequence" }>;
      const title = sanitizeTitleValue((consequence as { title?: unknown }).title, 84);
      const bullets = normalizeBullets(consequence.bullets, consequenceFallback.bullets);
      const strongBullets = pickStrongBullets(bullets, consequenceFallback.bullets);
      return {
        type: "consequence",
        title:
          !title || hasLegacyTemplatePhrase(title) || isWeakRoleTitle(title)
            ? buildRoleTitleFallback("consequence", topic, options)
            : title,
        bullets: strongBullets
      } as CarouselOutlineSlide;
    }

    if (role === "shift") {
      const shift = current as Extract<CarouselOutlineSlide, { type: "shift" }>;
      const shiftFallback = fallback as CarouselOutlineSlide & { body?: string };
      const title = sanitizeTitleValue(shift.title, 92);
      const body =
        normalizeBodyText((shift as { body?: unknown }).body, BODY_BLOCK_INPUT_MAX) ||
        normalizeBodyText(shiftFallback.body, BODY_BLOCK_OUTPUT_MAX) ||
        shiftFallback.body ||
        "Сначала покажи конкретный факт, потом вывод. Так читатель понимает логику и доходит до действия.";
      const weakTitle =
        !title ||
        startsWithGenericMistakeLead(title) ||
        hasLegacyTemplatePhrase(title) ||
        isWeakRoleTitle(title) ||
        countWords(title) < 4;

      return {
        type: "shift",
        title: weakTitle ? buildRoleTitleFallback("shift", topic, options) : title,
        body
      } as CarouselOutlineSlide;
    }

    if (role === "solution") {
      const solution = current as Extract<CarouselOutlineSlide, { type: "solution" }>;
      const solutionFallback = buildDeterministicSolutionFallback(topic, options);
      const title = sanitizeTitleValue((solution as { title?: unknown }).title, 84);
      const bullets = normalizeBullets(solution.bullets, solutionFallback.bullets);
      const strongBullets = pickStrongBullets(bullets, solutionFallback.bullets);
      if (strongBullets.length < 2) {
        return solutionFallback;
      }
      if (hasForbiddenNegativeBulletsForPositiveSlide(role, strongBullets)) {
        return solutionFallback;
      }
      return {
        type: "solution",
        title:
          !title || hasLegacyTemplatePhrase(title) || isWeakRoleTitle(title)
            ? solutionFallback.title
            : title,
        bullets: strongBullets
      } as CarouselOutlineSlide;
    }

    if (role === "example") {
      const example = current as Extract<CarouselOutlineSlide, { type: "example" }>;
      const exampleFallback = fallback as Extract<CarouselOutlineSlide, { type: "example" }>;
      const before = sanitizeCopyText(normalizeText(example.before, 128), 122);
      const after = sanitizeCopyText(normalizeText(example.after, 128), 122);
      const beforeLooksWeak = !before || countWords(before) < 4;
      const afterLooksWeak = !after || countWords(after) < 4;
      return {
        type: "example",
        before: beforeLooksWeak ? exampleFallback.before : before,
        after: afterLooksWeak ? exampleFallback.after : after
      };
    }

    const cta = current as Extract<CarouselOutlineSlide, { type: "cta" }>;
    const ctaVariants = buildCtaVariants(options?.goal, topic, mode);
    const title = sanitizeTitleValue(cta.title, 84);
    const subtitle = sanitizeCopyText(
      normalizeText(cta.subtitle, CTA_SUBTITLE_INPUT_MAX),
      CTA_SUBTITLE_OUTPUT_MAX
    );
    const hasPrimaryAction = hasPrimaryCtaActionVerb(subtitle);
    const directCtaDetected = containsDirectMessageCta(subtitle);
    const shouldUseSoftCta = mode !== "sales" && (directCtaDetected || !hasPrimaryAction);
    const actionIsAcceptable = hasPrimaryAction;
    return {
      type: "cta",
      title:
        !title || countWords(title) < 2 || isWeakRoleTitle(title) || hasLegacyTemplatePhrase(title)
          ? buildCtaTitleFallback(options?.goal, topic, mode)
          : title,
      subtitle: shouldUseSoftCta ? ctaVariants.soft : actionIsAcceptable ? subtitle : ctaVariants.selected
    };
  });
}

function evaluateSlideQuality(
  slides: CarouselOutlineSlide[],
  expectedFlow: CarouselSlideRole[],
  topic: string
) {
  const reasons: string[] = [];

  if (slides.length !== expectedFlow.length) {
    reasons.push("unexpected slide count");
    return { ok: false, reasons };
  }

  const topicStemSet = buildTopicStemSet(topic);
  const topicCoverage =
    topicStemSet.size === 0
      ? slides.length
      : slides.filter((slide) => hasTopicStemMatch(collectSlideCopy(slide), topicStemSet)).length;

  if (topicCoverage < 2) {
    reasons.push("weak topic coverage");
  }

  for (let index = 0; index < expectedFlow.length; index += 1) {
    const role = expectedFlow[index];
    const slide = slides[index];

    if (!slide || slide.type !== role) {
      reasons.push(`flow mismatch at ${index + 1}`);
      continue;
    }

    if (role === "hook") {
      const hook = slide as Extract<CarouselOutlineSlide, { type: "hook" }>;
      if (
        countWords(hook.title) < 4 ||
        countWords(hook.subtitle) < 5 ||
        isWeakRoleTitle(hook.title) ||
        hasDanglingTail(hook.title)
      ) {
        reasons.push("weak hook");
      }
      continue;
    }

    if (role === "problem") {
      const problem = slide as Extract<CarouselOutlineSlide, { type: "problem" }>;
      if (!Array.isArray(problem.bullets) || problem.bullets.length < 2) {
        reasons.push("thin bullets on problem");
        continue;
      }

      const hasDetailedBullet = problem.bullets.some((item) => countWords(item) >= 5);
      if (!hasDetailedBullet) {
        reasons.push("low detail on problem");
      }
      if (problem.bullets.some((item) => isWeakBulletText(item))) {
        reasons.push("low detail on problem");
      }
      continue;
    }

    if (role === "amplify") {
      const amplify = slide as Extract<CarouselOutlineSlide, { type: "amplify" }>;
      if (!Array.isArray(amplify.bullets) || amplify.bullets.length < 2) {
        reasons.push("thin bullets on amplify");
        continue;
      }

      const hasDetailedBullet = amplify.bullets.some((item) => countWords(item) >= 5);
      if (!hasDetailedBullet) {
        reasons.push("low detail on amplify");
      }
      if (amplify.bullets.some((item) => isWeakBulletText(item))) {
        reasons.push("low detail on amplify");
      }
      continue;
    }

    if (role === "mistake") {
      const mistake = slide as Extract<CarouselOutlineSlide, { type: "mistake" }>;
      if (countWords(mistake.title) < 4 || isWeakRoleTitle(mistake.title)) {
        reasons.push("weak mistake");
      }
      continue;
    }

    if (role === "consequence") {
      const consequence = slide as Extract<CarouselOutlineSlide, { type: "consequence" }>;
      if (!Array.isArray(consequence.bullets) || consequence.bullets.length < 2) {
        reasons.push("thin bullets on consequence");
        continue;
      }

      const hasDetailedBullet = consequence.bullets.some((item) => countWords(item) >= 5);
      if (!hasDetailedBullet) {
        reasons.push("low detail on consequence");
      }
      if (consequence.bullets.some((item) => isWeakBulletText(item))) {
        reasons.push("low detail on consequence");
      }
      continue;
    }

    if (role === "shift") {
      const shift = slide as Extract<CarouselOutlineSlide, { type: "shift" }>;
      if (countWords(shift.title) < 4 || isWeakRoleTitle(shift.title)) {
        reasons.push("weak shift");
      }
      continue;
    }

    if (role === "solution") {
      const solution = slide as Extract<CarouselOutlineSlide, { type: "solution" }>;
      if (!Array.isArray(solution.bullets) || solution.bullets.length < 2) {
        reasons.push("thin bullets on solution");
        continue;
      }

      const hasDetailedBullet = solution.bullets.some((item) => countWords(item) >= 5);
      if (!hasDetailedBullet) {
        reasons.push("low detail on solution");
      }
      if (solution.bullets.some((item) => isWeakBulletText(item))) {
        reasons.push("low detail on solution");
      }
      if (hasForbiddenNegativeBulletsForPositiveSlide(role, solution.bullets)) {
        reasons.push("solution_contains_negative_outcome_language");
      }
      continue;
    }

    if (role === "example") {
      const example = slide as Extract<CarouselOutlineSlide, { type: "example" }>;
      if (countWords(example.before) < 4 || countWords(example.after) < 4) {
        reasons.push("weak example");
      }
      continue;
    }

    const cta = slide as Extract<CarouselOutlineSlide, { type: "cta" }>;
    if (countWords(cta.title) < 2 || !hasActionVerb(cta.subtitle)) {
      reasons.push("weak cta");
    }

    if (role !== "cta" && !hasConcreteAnchorInCopy(collectSlideCopy(slide))) {
      reasons.push(`low concreteness at ${index + 1}`);
    }
  }

  return {
    ok: reasons.length === 0,
    reasons
  };
}

function countWords(value: string) {
  return normalizeWordTokens(value).length;
}

function countSentenceMarks(value: string) {
  return (value.match(/[.!?]+/g) ?? []).length;
}

function hasConcreteAnchorInCopy(value: string) {
  const text = normalizeText(value, 600).toLowerCase();
  if (!text) {
    return false;
  }

  const hasNumber = /(?:^|[^\p{L}\p{N}])\d+(?:[.,]\d+)?\s*%?(?=$|[^\p{L}\p{N}])/u.test(text);
  const hasAction = /(?:^|[^\p{L}])(сделай|сделайте|проверь|проверьте|замени|замените|добавь|добавьте|запусти|запустите|опиши|вынеси|попробуй|попробуйте|начни|начните|внедри|внедрите|напиши|напишите|сохраните|ответьте|пришлите|оставьте)(?=$|[^\p{L}])/iu.test(
    text
  );
  const hasScenario = /(?:^|[^\p{L}])(когда|если|утром|вечером|на\s+встрече|в\s+переписке|в\s+ленте|в\s+instagram|сегодня|за\s+неделю|за\s+месяц|после\s+первой\s+встречи)(?=$|[^\p{L}])/iu.test(
    text
  );
  const hasComparison =
    /(?:^|[^\p{L}])(vs|против|вместо)(?=$|[^\p{L}])/iu.test(text) ||
    /чем\s+больше.+тем\s+меньше|не\s+.+,\s+а\s+.+/iu.test(text);

  return hasNumber || hasAction || hasScenario || hasComparison;
}

function hasActionVerb(value: string) {
  return /(?:^|[^\p{L}])(напиши|напишите|сохраните|оставьте|отправьте|ответьте|пришлите|подпишитесь|выберите|проверь|проверьте|сделай|сделайте|попробуй|попробуйте|внедри|внедрите|запусти|запустите|начни|начните)(?=$|[^\p{L}])/iu.test(
    value
  );
}

function hasPrimaryCtaActionVerb(value: string) {
  return /(?:^|[^\p{L}])(напиши|напишите|сохраните|оставьте|отправьте|ответьте|пришлите|подпишитесь|выберите)(?=$|[^\p{L}])/iu.test(
    value
  );
}

function rescueWeakSlidesAfterQualityCheck(
  slides: CarouselOutlineSlide[],
  expectedFlow: CarouselSlideRole[],
  topic: string,
  options: GenerationOptions | undefined,
  reasons: string[],
  mode: ContentMode = resolveModeFromOptions(options)
) {
  const nextSlides = slides.map((slide) => ({ ...slide })) as CarouselOutlineSlide[];
  const hookIndex = expectedFlow.findIndex((role) => role === "hook");

  if (hookIndex >= 0 && nextSlides[hookIndex]?.type === "hook") {
    const hasHookIssue = reasons.some((reason) => reason.includes("hook") || reason.includes("topic"));
    if (hasHookIssue) {
      const hook = nextSlides[hookIndex] as Extract<CarouselOutlineSlide, { type: "hook" }>;
      const bestHook = pickBestHookCandidate(buildHookCandidates(topic, options, mode));
      hook.title = bestHook?.title || buildHookFallbackTitle(topic, mode);
      hook.subtitle = bestHook?.subtitle || buildHookFallbackSubtitle(topic, mode);
      const anchoredHook = `${hook.title} ${hook.subtitle}`.trim();
      if (!hasPrimaryTopicAnchor(anchoredHook, topic)) {
        hook.title = addTopicAnchorToTitle(hook.title, buildTopicAnchorLabel(topic));
      }
    }
  }

  return applyFinalCopyPolish(
    enforceSlideQuality(nextSlides, expectedFlow, topic, options),
    expectedFlow,
    topic,
    options
  );
}

function isWeakBulletText(value: string) {
  const normalized = sanitizeCopyText(normalizeText(value, 140), 132).toLowerCase();
  if (!normalized) {
    return true;
  }

  if (hasLegacyTemplatePhrase(normalized)) {
    return true;
  }

  return WEAK_BULLET_PATTERNS.some((pattern) => pattern.test(normalized));
}

function pickStrongBullets(
  bullets: string[],
  fallback: string[],
  minimum = 2
) {
  const cleaned = bullets
    .map((item) => sanitizeCopyText(normalizeText(item, BULLET_INPUT_MAX), BULLET_OUTPUT_MAX))
    .filter(Boolean);
  const strong = cleaned
    .filter((item) => countWords(item) >= 4)
    .filter((item) => !isWeakBulletText(item));

  if (strong.length >= minimum) {
    return strong.slice(0, MAX_BULLETS_PER_SLIDE);
  }

  const medium = cleaned.filter((item) => countWords(item) >= 3);
  if (medium.length >= minimum) {
    return medium.slice(0, MAX_BULLETS_PER_SLIDE);
  }

  if (cleaned.length) {
    return cleaned.slice(0, MAX_BULLETS_PER_SLIDE);
  }

  return fallback.slice(0, MAX_BULLETS_PER_SLIDE);
}

function isWeakRoleTitle(value: string) {
  const normalized = sanitizeTitleValue(value, 96).toLowerCase();
  if (!normalized) {
    return true;
  }

  return WEAK_ROLE_TITLE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function buildHookCandidates(
  topic: string,
  options?: GenerationOptions,
  mode: ContentMode = resolveModeFromOptions(options)
) {
  const topicFocus = buildCompactTopicFocus(sanitizeTopic(topic), 34);
  if (mode !== "sales") {
    const nonSalesSubtitle =
      mode === "instruction"
        ? "Покажу последовательность шагов, условия и частые ошибки без перегруза."
        : mode === "diagnostic"
          ? "Разберём симптомы, причины и план исправления без запугивания."
          : mode === "case"
            ? "Покажу контекст, действия и результат на реальном сценарии."
            : mode === "social"
              ? "Коротко разложим, что мешает и что реально помогает в быту."
              : "Разложим причины, механизм и рабочие шаги без агрессивных хуков.";

    return [
      {
        title: trimToWordBoundary(buildFirstSlideTitleForMode(topic, mode), 72),
        subtitle: trimToWordBoundary(buildFirstSlideSubtitleForMode(topic, mode), 132)
      },
      {
        title: trimToWordBoundary(`Почему вокруг «${topicFocus}» случаются срывы`, 72),
        subtitle: trimToWordBoundary(nonSalesSubtitle, 132)
      },
      {
        title: trimToWordBoundary(
          mode === "instruction"
            ? `Как по «${topicFocus}» сделать план`
            : `Что мешает стабильно решить «${topicFocus}»`,
          72
        ),
        subtitle: trimToWordBoundary(
          mode === "instruction"
            ? "Соберём план: шаги, тайминг и проверка результата."
            : "Соберём ясную структуру: причина, действие и ожидаемый эффект.",
          132
        )
      }
    ];
  }

  const normalizedTopic = normalizeText(topic, 220).toLowerCase();
  const safeTopicForCopy = sanitizeTopic(topic);
  const topicDomain = resolveTopicDomain(topic, options);
  const isAdContext = containsStem(normalizedTopic, ["реклам", "клик", "лендинг", "заяв", "лид", "воронк"]);
  const isCallContext =
    containsStem(normalizedTopic, ["звон", "созвон", "переговор"]) ||
    /клиент\s+пропал/iu.test(normalizedTopic);
  const isRealEstateContext = containsStem(normalizedTopic, [
    "риелтор",
    "недвижим",
    "квартир",
    "показ",
    "объект",
    "авито",
    "циан",
    "ипотек",
    "сделк"
  ]);
  const goalCue = normalizeText(options?.goal ?? "", 30).toLowerCase();
  const tensionTitle =
    topicDomain === "education"
      ? "Уроки идут, а прогресса не видно: где узкое место?"
      : topicDomain === "psychology"
        ? "Слова поддержки есть, а облегчения нет: где разрыв?"
        : topicDomain === "health"
          ? "Объяснение было, а ясности у пациента нет: почему?"
          : topicDomain === "fitness"
            ? "План есть, а дисциплина срывается: где стоп-фактор?"
            : topicDomain === "beauty"
              ? "Первый визит прошел, а повтора нет: где теряется ценность?"
              : topicDomain === "finance"
                ? "Цифры есть, а решение не принимается: что мешает?"
                : topicDomain === "sales"
                  ? "Показы идут, а сделки буксуют: где разрыв?"
                : topicDomain === "creator"
                  ? "Контент есть, а реакции мало: где ломается интерес?"
                  : "Шаги есть, а результат буксует: где узкое место?";

  const firstTitle = isCallContext
    ? "Созвон прошёл. Почему дальше тишина?"
    : isAdContext
      ? "Клики есть. Почему заявок нет?"
      : isRealEstateContext
        ? "Показы есть, а сделки стоят"
      : tensionTitle;

  const firstSubtitle = isCallContext
    ? "Разберём, какая фраза ломает доверие в первые 2 минуты."
    : isAdContext
      ? "Покажу, где после клика теряется доверие и деньги."
      : isRealEstateContext
        ? "Покажу, где рвётся диалог на показе и после него."
      : trimToWordBoundary(
          `Покажу, как раскрыть «${buildCompactTopicFocus(safeTopicForCopy, 34)}» так, чтобы люди дочитывали и сохраняли.`,
          132
        );

  const candidates = [
    {
      title: trimToWordBoundary(firstTitle, 72),
      subtitle: trimToWordBoundary(firstSubtitle, 132)
    },
    {
      title: trimToWordBoundary(
        `Ты вкладываешь часы в «${buildCompactTopicFocus(safeTopicForCopy, 24)}», а отклик уходит за 2 секунды`,
        72
      ),
      subtitle: trimToWordBoundary(
        "Разберём, какая формулировка убивает интерес в первых слайдах и чем её заменить.",
        132
      )
    },
    {
      title: trimToWordBoundary(
        `В «${buildCompactTopicFocus(safeTopicForCopy, 22)}» досмотры падают из-за воды и повтора мыслей`,
        72
      ),
      subtitle: trimToWordBoundary(
        goalCue.includes("заяв")
          ? "Соберём структуру, которая доводит до заявки, а не до пролистывания."
          : "Соберём структуру, которую дочитывают, сохраняют и пересылают дальше.",
        132
      )
    }
  ];

  return candidates;
}

function scoreHookCandidate(title: string, subtitle: string) {
  const normalizedTitle = sanitizeTitleValue(title, 84);
  const normalizedSubtitle = sanitizeCopyText(normalizeText(subtitle, 132), 132);
  const combined = `${normalizedTitle} ${normalizedSubtitle}`;
  let score = 0;

  if (/\?|!/.test(normalizedTitle)) {
    score += 1;
  }
  if (/\b(есть|нет|но|а|после|до|тишин|клик|созвон)\b/iu.test(combined)) {
    score += 2;
  }
  if (/\b\d{1,2}\b/.test(combined) || /\b(чек-лист|шаг|минут)\b/iu.test(combined)) {
    score += 1;
  }
  if (
    startsWithGenericMistakeLead(normalizedTitle) ||
    isListLikeHookTitle(normalizedTitle) ||
    isHookQuestionTemplate(normalizedTitle) ||
    hasLegacyTemplatePhrase(combined) ||
    hasAwkwardHookTitle(normalizedTitle)
  ) {
    score -= 3;
  }
  if (BANNED_TEMPLATE_PATTERNS.some((pattern) => pattern.test(combined))) {
    score -= 3;
  }

  return score;
}

function pickBestHookCandidate(candidates: Array<{ title: string; subtitle: string }>) {
  let best: { title: string; subtitle: string } | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const score = scoreHookCandidate(candidate.title, candidate.subtitle);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

function hasBannedTemplateLanguage(slides: CarouselOutlineSlide[]) {
  return slides.some((slide) => {
    const text = collectSlideCopy(slide);
    return BANNED_TEMPLATE_PATTERNS.some((pattern) => pattern.test(text));
  });
}

function stripBannedTemplateLanguage(
  slides: CarouselOutlineSlide[],
  expectedFlow: CarouselSlideRole[],
  topic: string,
  options?: GenerationOptions
) {
  return expectedFlow.map((role, index) => {
    const current = slides[index];
    const fallback = normalizeSlideByType(role, null, topic, index, options);
    if (!current) {
      return fallback;
    }

    if ("title" in current && typeof current.title === "string") {
      const cleanedTitle = removeBannedPhrases(current.title);
      if (cleanedTitle) {
        current.title = cleanedTitle;
      } else if ("title" in fallback && typeof fallback.title === "string") {
        current.title = fallback.title;
      }
    }

    if ("subtitle" in current && typeof current.subtitle === "string") {
      const cleanedSubtitle = removeBannedPhrases(current.subtitle);
      current.subtitle =
        cleanedSubtitle ||
        ("subtitle" in fallback && typeof fallback.subtitle === "string"
          ? fallback.subtitle
          : current.subtitle);
    }

    if ("before" in current && typeof current.before === "string") {
      current.before = removeBannedPhrases(current.before) || current.before;
    }
    if ("after" in current && typeof current.after === "string") {
      current.after = removeBannedPhrases(current.after) || current.after;
    }
    if ("bullets" in current && Array.isArray(current.bullets)) {
      current.bullets = current.bullets
        .map((item) => removeBannedPhrases(item))
        .filter(Boolean) as string[];
      if (!current.bullets.length && "bullets" in fallback && Array.isArray(fallback.bullets)) {
        current.bullets = fallback.bullets;
      }
    }

    return current;
  });
}

function removeBannedPhrases(value: string) {
  let next = value;
  for (const pattern of BANNED_TEMPLATE_PATTERNS) {
    const flags = `${pattern.flags.includes("i") ? "i" : ""}${pattern.flags.includes("u") ? "u" : ""}g`;
    next = next.replace(new RegExp(pattern.source, flags), " ");
  }
  return sanitizeCopyText(normalizeText(next, 180), 170);
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
  index: number,
  options?: GenerationOptions
): CarouselOutlineSlide {
  void index;
  const safe = toRecord(rawSlide);
  const sanitizedTopic = sanitizeTopic(topic);
  const topicFocus = buildTopicFocus(sanitizedTopic);
  const mode = resolveModeFromOptions(options);

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
      title: normalizedTitle || buildHookFallbackTitle(sanitizedTopic, mode),
      subtitle:
        sanitizeCopyText(normalizeText(safe.subtitle, HOOK_SUBTITLE_INPUT_MAX), HOOK_SUBTITLE_OUTPUT_MAX) ||
        buildHookFallbackSubtitle(sanitizedTopic, mode)
    };
  }

  if (expectedType === "problem") {
    const rawTitle = sanitizeTitleValue(safe.title, 80);
    return {
      type: "problem",
      title:
        (rawTitle && !startsWithGenericMistakeLead(rawTitle) && !hasLegacyTemplatePhrase(rawTitle)
          ? rawTitle
          : "") || buildRoleTitleFallback("problem", sanitizedTopic, options),
      bullets: normalizeBullets(safe.bullets, buildRoleBulletsFallback("problem", sanitizedTopic, options))
    };
  }

  if (expectedType === "amplify") {
    const rawTitle = sanitizeTitleValue(safe.title, 80);
    return {
      type: "amplify",
      title:
        (rawTitle && !startsWithGenericMistakeLead(rawTitle) && !hasLegacyTemplatePhrase(rawTitle)
          ? rawTitle
          : "") || buildRoleTitleFallback("amplify", sanitizedTopic, options),
      bullets: normalizeBullets(safe.bullets, buildRoleBulletsFallback("amplify", sanitizedTopic, options))
    };
  }

  if (expectedType === "mistake") {
    const rawTitle = sanitizeTitleValue(safe.title, 92);
    const body =
      normalizeBodyText(safe.body, BODY_BLOCK_INPUT_MAX) ||
      "Совет звучит слишком общо, поэтому человек не узнаёт свою ситуацию\nНет конкретного примера, из-за этого мысль воспринимается как шаблон\nПосле слайда неясно, какое действие сделать прямо сейчас";
    return {
      type: "mistake",
      title:
        (rawTitle && !hasLegacyTemplatePhrase(rawTitle) ? rawTitle : "") ||
        buildRoleTitleFallback("mistake", sanitizedTopic, options),
      body
    } as CarouselOutlineSlide;
  }

  if (expectedType === "consequence") {
    const rawTitle = sanitizeTitleValue(safe.title, 84);
    return {
      type: "consequence",
      title: rawTitle || buildRoleTitleFallback("consequence", sanitizedTopic, options),
      bullets: normalizeBullets(safe.bullets, buildRoleBulletsFallback("consequence", sanitizedTopic, options))
    } as CarouselOutlineSlide;
  }

  if (expectedType === "shift") {
    const rawTitle = sanitizeTitleValue(safe.title, 92);
    const body =
      normalizeBodyText(safe.body, BODY_BLOCK_INPUT_MAX) ||
      "Сначала покажи конкретный факт, потом вывод. Так читатель понимает логику и доходит до действия.";
    return {
      type: "shift",
      title:
        (rawTitle && !startsWithGenericMistakeLead(rawTitle) && !hasLegacyTemplatePhrase(rawTitle)
          ? rawTitle
          : "") ||
        buildRoleTitleFallback("shift", sanitizedTopic, options),
      body
    } as CarouselOutlineSlide;
  }

  if (expectedType === "solution") {
    const deterministicSolution = buildDeterministicSolutionFallback(sanitizedTopic, options);
    const rawTitle = sanitizeTitleValue(safe.title, 84);
    return {
      type: "solution",
      title: rawTitle || deterministicSolution.title,
      bullets: normalizeBullets(safe.bullets, deterministicSolution.bullets)
    } as CarouselOutlineSlide;
  }

  if (expectedType === "example") {
    return {
      type: "example",
      before:
        sanitizeCopyText(normalizeText(safe.before, 128), 122) ||
        `До: «${topicFocus} объясняли общо, и человек терял нить»`,
      after:
        sanitizeCopyText(normalizeText(safe.after, 128), 122) ||
        "После: «Сменили подход — и результат стал стабильным»"
    };
  }

  const ctaTitle = sanitizeTitleValue(safe.title, 84);
  const goalAwareCta = buildGoalAwareCta(options?.goal, sanitizedTopic, mode);
  return {
    type: "cta",
    title: ctaTitle || trimToWordBoundary("Хотите адаптацию под свою тему?", 84),
    subtitle:
      sanitizeCopyText(normalizeText(safe.subtitle, CTA_SUBTITLE_INPUT_MAX), CTA_SUBTITLE_OUTPUT_MAX) ||
      goalAwareCta
  };
}

function buildFallbackSlides(
  topic: string,
  flow: CarouselSlideRole[],
  options?: GenerationOptions
): CarouselOutlineSlide[] {
  return flow.map((type, index) => normalizeSlideByType(type, null, topic, index, options));
}

function normalizeBullets(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback.slice(0, MAX_BULLETS_PER_SLIDE);
  }

  const dedupe = new Set<string>();
  const cleaned: string[] = [];

  for (const item of value) {
    const normalized = sanitizeCopyText(normalizeText(item, BULLET_INPUT_MAX), BULLET_OUTPUT_MAX)
      .replace(/^[•·\-–—→\s]+/u, "")
      .replace(/[.!?]+\s*$/u, "")
      .trim();
    if (!normalized) {
      continue;
    }

    const fingerprint = normalizeWordTokens(normalized).join(" ");
    if (!fingerprint || dedupe.has(fingerprint)) {
      continue;
    }

    dedupe.add(fingerprint);
    cleaned.push(normalized);

    if (cleaned.length >= MAX_BULLETS_PER_SLIDE) {
      break;
    }
  }

  return cleaned.length ? cleaned : fallback.slice(0, MAX_BULLETS_PER_SLIDE);
}

function buildCtaTitleFallback(goal: string | undefined, topic: string, mode: ContentMode = "expert") {
  void goal;
  void topic;
  if (mode !== "sales") {
    return "Сохраните и примените";
  }
  return trimToWordBoundary(getFallbackTitle("cta"), 96);
}

function sanitizeTopic(topic: string): string {
  const normalized = normalizeText(topic, 180)
    .replace(/[?!]+/gu, " ")
    .replace(/[«»"'`]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  if (!normalized) {
    return "вашей теме";
  }

  const cleaned = normalized
    .replace(/^(как\s+правильн[а-яё]*\s+)/iu, "")
    .replace(/^(почему\s+)/iu, "")
    .replace(/^(что\s*бы\s+)/iu, "")
    .replace(/^(чтобы\s+)/iu, "")
    .replace(/^(как\s+)/iu, "")
    .replace(/^(что\s+делать\s+(?:с|если|когда)\s+)/iu, "")
    .replace(/\bкак\s+правильн[а-яё]*\b/giu, "")
    .replace(/\bпочему\b/giu, "")
    .replace(/\bчто\s*бы\b/giu, "")
    .replace(/\s+/gu, " ")
    .replace(/^[\s,.:;—–-]+|[\s,.:;—–-]+$/gu, "")
    .trim();

  const compact = removeDanglingTail(trimToWordBoundary(cleaned, 40));
  if (compact.length >= 4) {
    return compact;
  }

  const fallback = removeDanglingTail(trimToWordBoundary(normalized, 40));
  return fallback || "вашей теме";
}

function buildSolutionTitleFallback(topic: string) {
  const focus = upperFirst(buildCompactTopicFocus(sanitizeTopic(topic), 34));
  return trimToWordBoundary(`План действий по «${focus}»`, 84);
}

function buildDeterministicSolutionFallback(
  topic: string,
  options?: GenerationOptions
): Extract<CarouselOutlineSlide, { type: "solution" }> {
  void options;
  return {
    type: "solution",
    title: buildSolutionTitleFallback(topic),
    bullets: [
      "Выбери одно конкретное действие и начни с него сегодня",
      "Результат приходит от системы, а не от разового усилия",
      "Маленький стабильный шаг работает лучше большого но редкого"
    ]
  };
}

function resolvePositiveSlideType(role: string): "solution" | "pivot" | "what_works" | null {
  const normalizedRole = normalizeText(role, 64)
    .toLowerCase()
    .replace(/[\s-]+/gu, "_");
  if (!normalizedRole) {
    return null;
  }

  if (
    normalizedRole === "solution" ||
    normalizedRole === "solution_slide" ||
    normalizedRole === "решение" ||
    normalizedRole.includes("solution")
  ) {
    return "solution";
  }

  if (
    normalizedRole === "pivot" ||
    normalizedRole === "pivot_slide" ||
    normalizedRole === "поворот" ||
    normalizedRole === "разворот" ||
    normalizedRole === "shift" ||
    normalizedRole.includes("pivot")
  ) {
    return "pivot";
  }

  if (
    normalizedRole === "what_works" ||
    normalizedRole === "whatworks" ||
    normalizedRole === "что_работает" ||
    normalizedRole === "чтоработает" ||
    normalizedRole.includes("what_works") ||
    normalizedRole.includes("whatworks")
  ) {
    return "what_works";
  }

  return null;
}

function isPositiveActionSlideType(role: string) {
  return resolvePositiveSlideType(role) !== null;
}

function findNegativeOutcomeSignal(value: string): string | null {
  const normalized = normalizeText(value, 180).toLowerCase();
  if (!normalized) {
    return null;
  }

  const signals: Array<{ signal: string; pattern: RegExp }> = [
    { signal: "снижается", pattern: /(?:^|[^\p{L}])снижается(?=$|[^\p{L}])/iu },
    { signal: "не доходят", pattern: /(?:^|[^\p{L}])не\s+доходят(?=$|[^\p{L}])/iu },
    { signal: "нестабильно*", pattern: /(?:^|[^\p{L}])нестабильн[а-яё]*(?=$|[^\p{L}])/iu },
    { signal: "сливается*", pattern: /(?:^|[^\p{L}])слива(?:ется|ются|ешь|ете|ем)(?=$|[^\p{L}])/iu },
    { signal: "теряется*", pattern: /(?:^|[^\p{L}])теря(?:ется|ются|ешь|ете|ем)(?=$|[^\p{L}])/iu }
  ];

  for (const entry of signals) {
    if (entry.pattern.test(normalized)) {
      return entry.signal;
    }
  }

  return null;
}

function containsNegativeOutcomeSignal(value: string) {
  return Boolean(findNegativeOutcomeSignal(value));
}

function hasForbiddenNegativeBulletsForPositiveSlide(role: string, bullets: string[]) {
  const positiveSlideType = resolvePositiveSlideType(role);
  if (!positiveSlideType) {
    return false;
  }

  for (const item of bullets) {
    const signal = findNegativeOutcomeSignal(item);
    if (!signal) {
      continue;
    }

    console.error("[positive-slide-negative-signal]", {
      slideType: role,
      normalizedSlideType: positiveSlideType,
      signal,
      bullet: item
    });

    return true;
  }

  return false;
}

function getFallbackTitle(role: CarouselSlideRole): string {
  const titles = FALLBACK_TITLES[role] ?? [""];
  if (!titles.length) {
    return "";
  }

  return titles[Math.floor(Math.random() * titles.length)] ?? "";
}

function buildRoleTitleFallback(
  role: CarouselSlideRole,
  topic: string,
  options?: GenerationOptions
) {
  const maxLength = role === "mistake" || role === "shift" ? 92 : 96;
  const sanitizedTopic = sanitizeTopic(topic);
  const domain = resolveTopicDomain(sanitizedTopic, options);
  const focus = upperFirst(buildCompactTopicFocus(sanitizedTopic, 40));
  const domainVariants = buildDomainRoleTitleVariants(domain, focus);
  const roleVariants = (
    domainVariants as Partial<Record<"problem" | "amplify" | "mistake" | "shift", string[]>>
  )[role as "problem" | "amplify" | "mistake" | "shift"];

  if (
    (role === "problem" || role === "amplify" || role === "mistake" || role === "shift") &&
    roleVariants?.length
  ) {
    return trimToWordBoundary(pickVariantByTopic(`${sanitizedTopic}:${role}`, roleVariants), maxLength);
  }

  if (role === "consequence") {
    return trimToWordBoundary(`${focus}: цена ошибки`, maxLength);
  }

  if (role === "solution") {
    return trimToWordBoundary(buildSolutionTitleFallback(topic), maxLength);
  }

  return trimToWordBoundary(getFallbackTitle(role), maxLength);
}

function buildDomainRoleTitleVariants(domain: TopicDomain, focus: string) {
  if (domain === "education") {
    return {
      problem: [
        `${focus}: почему ученики теряют ритм`,
        `${focus}: где пропадает мотивация между занятиями`
      ],
      amplify: [
        `${focus}: как паузы в практике ускоряют откат`,
        `${focus}: почему «потом доделаю» ломает прогресс`
      ],
      mistake: [
        `${focus}: шаг, который убивает вовлеченность`,
        `${focus}: где объяснение становится слишком абстрактным`
      ],
      shift: [
        `${focus}: как вернуть ощущение прогресса`,
        `${focus}: разворот в пользу регулярной практики`
      ]
    };
  }

  if (domain === "psychology") {
    return {
      problem: [
        `${focus}: где клиент теряет ясность`,
        `${focus}: почему важные различия звучат «всё одинаково»`
      ],
      amplify: [
        `${focus}: как путаница усиливает тревогу`,
        `${focus}: почему без рамки запрос застревает`
      ],
      mistake: [
        `${focus}: формулировка, которая повышает сопротивление`,
        `${focus}: где профессиональный язык мешает контакту`
      ],
      shift: [
        `${focus}: как говорить точно и бережно`,
        `${focus}: разворот к понятному действию`
      ]
    };
  }

  if (domain === "health") {
    return {
      problem: [
        `${focus}: где пациент теряет понимание`,
        `${focus}: почему рекомендации не доходят до действия`
      ],
      amplify: [
        `${focus}: как неясность влияет на приверженность`,
        `${focus}: почему общие формулировки повышают тревогу`
      ],
      mistake: [
        `${focus}: что ломает доверие в объяснении`,
        `${focus}: где термин важнее смысла для пациента`
      ],
      shift: [
        `${focus}: как объяснять по-человечески и по делу`,
        `${focus}: точка перехода к понятным шагам`
      ]
    };
  }

  if (domain === "fitness") {
    return {
      problem: [
        `${focus}: где срывается возвращение в режим`,
        `${focus}: почему мотивация тухнет после паузы`
      ],
      amplify: [
        `${focus}: как пропуски быстро откатывают результат`,
        `${focus}: почему без системы человек снова выпадает`
      ],
      mistake: [
        `${focus}: фраза, после которой клиент исчезает`,
        `${focus}: где обещание сильнее плана`
      ],
      shift: [
        `${focus}: как вернуть ритм без перегруза`,
        `${focus}: разворот к устойчивой дисциплине`
      ]
    };
  }

  if (domain === "beauty") {
    return {
      problem: [
        `${focus}: где теряются повторные записи`,
        `${focus}: почему клиент не возвращается после первого визита`
      ],
      amplify: [
        `${focus}: как тишина после визита бьет по загрузке`,
        `${focus}: почему ценность услуги не считывается`
      ],
      mistake: [
        `${focus}: шаг, который обнуляет доверие`,
        `${focus}: где сервис выглядит как «просто процедура»`
      ],
      shift: [
        `${focus}: как переводить визит в долгий цикл`,
        `${focus}: разворот к повторным визитам без скидок`
      ]
    };
  }

  if (domain === "finance") {
    return {
      problem: [
        `${focus}: где клиент перестает понимать риски`,
        `${focus}: почему решения откладываются до бесконечности`
      ],
      amplify: [
        `${focus}: как неопределенность съедает доверие`,
        `${focus}: почему «проценты» без сценариев не работают`
      ],
      mistake: [
        `${focus}: где цифры есть, а ясности нет`,
        `${focus}: ошибка в подаче, не в аналитике`
      ],
      shift: [
        `${focus}: как объяснять риск через сценарии`,
        `${focus}: разворот к уверенным решениям`
      ]
    };
  }

  if (domain === "creator") {
    return {
      problem: [
        `${focus}: где контент становится «как у всех»`,
        `${focus}: почему подписчик уходит на втором слайде`
      ],
      amplify: [
        `${focus}: как слабый ритм режет досмотры`,
        `${focus}: почему полезность не превращается в диалоги`
      ],
      mistake: [
        `${focus}: где экспертность звучит сухо`,
        `${focus}: ошибка подачи, которая убивает интерес`
      ],
      shift: [
        `${focus}: как вернуть живой темп карусели`,
        `${focus}: разворот к тексту, который сохраняют`
      ]
    };
  }

  if (domain === "sales") {
    return {
      problem: [
        `${focus}: где лиды застревают после первого контакта`,
        `${focus}: почему заявки не доходят до сделки`
      ],
      amplify: [
        `${focus}: как паузы в коммуникации сжигают спрос`,
        `${focus}: почему команда спорит вместо роста конверсии`
      ],
      mistake: [
        `${focus}: шаг, который охлаждает горячий спрос`,
        `${focus}: где скрипт звучит как шаблон`
      ],
      shift: [
        `${focus}: как перевести диалог в следующий шаг`,
        `${focus}: разворот к прогнозируемой конверсии`
      ]
    };
  }

  return {};
}

function buildRoleBulletsFallback(
  role: "problem" | "amplify" | "consequence" | "solution",
  topic: string,
  options?: GenerationOptions
) {
  if (role === "solution") {
    return buildDeterministicSolutionFallback(topic, options).bullets;
  }

  const domain = resolveTopicDomain(sanitizeTopic(topic), options);

  if (domain === "education") {
    if (role === "problem") {
      return [
        "Ученик понимает тему на уроке, но между занятиями быстро теряет ритм.",
        "Домашка кажется формальностью, поэтому прогресс не ощущается.",
        "Цель звучит абстрактно, и мотивация падает уже на второй неделе."
      ];
    }
    if (role === "amplify") {
      return [
        "Паузы в практике дают откат, и каждый новый урок стартует «с нуля».",
        "Без коротких побед вовлеченность тает от недели к неделе.",
        "Время уходит на возврат дисциплины вместо движения вперед."
      ];
    }
    if (role === "consequence") {
      return [
        "Часть учеников уходит, даже если программа сильная по сути.",
        "Темп группы проседает: приходится постоянно догонять базу.",
        "Преподаватель выгорает из-за постоянного «подтягивания» мотивации."
      ];
    }
    return [
      "Ставьте микро-цель на 7 дней с понятным критерием «сделано».",
      "Добавляйте короткую практику 10–15 минут между занятиями.",
      "Показывайте прогресс формулой «было и стало» на реальных примерах."
    ];
  }

  if (domain === "psychology") {
    if (role === "problem") {
      return [
        "Клиент смешивает тревогу, выгорание и усталость в одно состояние.",
        "Профессиональные термины звучат сложно и не превращаются в действие.",
        "После сессии остаются эмоции, но не остается опоры для шага."
      ];
    }
    if (role === "amplify") {
      return [
        "Без ясной рамки человек снова возвращается в тот же цикл.",
        "Непонятные объяснения повышают сопротивление и тревожность.",
        "Каждый пропущенный шаг усиливает чувство беспомощности."
      ];
    }
    if (role === "consequence") {
      return [
        "Прогресс идет медленнее, чем мог бы при точной формулировке.",
        "Доверие к процессу падает из-за ощущения «я снова не понял».",
        "Запрос затягивается, а ресурс человека продолжает снижаться."
      ];
    }
    return [
      "Объясняйте через маркеры: признаки, триггеры и первый безопасный шаг.",
      "Давайте формулировку, которую клиент может повторить сам себе.",
      "Фиксируйте одно действие на ближайшие 24 часа."
    ];
  }

  if (domain === "health") {
    if (role === "problem") {
      return [
        "Пациент слышит диагноз, но не понимает последовательность действий.",
        "На приеме много информации сразу, ключевые шаги теряются.",
        "Риски и польза объясняются общо, поэтому растет тревога."
      ];
    }
    if (role === "amplify") {
      return [
        "Непонимание схемы лечения снижает приверженность назначениям.",
        "Часть шагов откладывается, потому что нет ясного приоритета.",
        "Повторные вопросы перегружают коммуникацию клиники."
      ];
    }
    if (role === "consequence") {
      return [
        "Растет число пропусков контроля и срывов рекомендаций.",
        "Пациент чувствует неопределенность вместо спокойной опоры.",
        "Команда тратит больше времени на повтор базовых объяснений."
      ];
    }
    return [
      "Объясняйте диагноз в 3 пунктах: что это, почему важно, что делать дальше.",
      "Давайте памятку «сегодня / на неделе / когда срочно обратиться».",
      "Проверяйте понимание одним финальным вопросом в конце приема."
    ];
  }

  if (domain === "fitness") {
    if (role === "problem") {
      return [
        "После паузы клиент боится вернуться и снова сорваться через неделю.",
        "План кажется слишком большим, поэтому старт постоянно откладывается.",
        "Результат не фиксируется, и мотивация быстро гаснет."
      ];
    }
    if (role === "amplify") {
      return [
        "Каждый пропуск усиливает ощущение «я опять не справился».",
        "Нерегулярность ломает технику и повышает риск перегруза.",
        "Восстановление занимает больше времени, чем могло бы."
      ];
    }
    if (role === "consequence") {
      return [
        "Клиент уходит из процесса, даже имея запрос и ресурс.",
        "Тренер теряет долгую работу и повторные циклы сопровождения.",
        "Прогресс рваный: усилий много, устойчивого результата нет."
      ];
    }
    return [
      "Стартуйте с мягкого протокола на 2 недели без гонки за рекордами.",
      "Фиксируйте микро-результаты: сон, энергия, самочувствие, регулярность.",
      "Добавьте короткий ритуал обратной связи после каждой тренировки."
    ];
  }

  if (domain === "beauty") {
    if (role === "problem") {
      return [
        "После первого визита клиент доволен, но не бронирует следующий.",
        "Ценность услуги не проговорена в языке результата для клиента.",
        "Коммуникация после процедуры слишком формальная и редкая."
      ];
    }
    if (role === "amplify") {
      return [
        "Пауза после визита быстро охлаждает интерес к повторной записи.",
        "Человек забывает, зачем возвращаться именно к вам, а не «куда ближе».",
        "Появляется ценовая чувствительность даже при хорошем сервисе."
      ];
    }
    if (role === "consequence") {
      return [
        "График заполняется нестабильно, выручка «качает» от недели к неделе.",
        "Приходится чаще добирать клиентов через скидки.",
        "Лояльность не формируется, и база не растет системно."
      ];
    }
    return [
      "Закрывайте визит конкретным планом следующей процедуры и сроком.",
      "Отправляйте персональный follow-up с напоминанием и микро-советом.",
      "Показывайте результат в языке выгоды клиента, а не только процесса."
    ];
  }

  if (domain === "finance") {
    if (role === "problem") {
      return [
        "Клиент слышит цифры доходности, но не понимает рамку риска.",
        "Сценарии «что будет если» не проговорены до принятия решения.",
        "Финансовые термины создают дистанцию вместо ясности."
      ];
    }
    if (role === "amplify") {
      return [
        "Неопределенность переводит решение в бесконечное «подумаю».",
        "Каждое колебание рынка усиливает тревогу и недоверие.",
        "Обсуждение упирается в спор о процентах без общей картины."
      ];
    }
    if (role === "consequence") {
      return [
        "Решение откладывается, и окно возможностей закрывается.",
        "Клиент теряет уверенность и возвращается к хаотичным действиям.",
        "Консультант тратит время на повторное объяснение базовых вещей."
      ];
    }
    return [
      "Объясняйте через 2-3 сценария: базовый, стрессовый и целевой.",
      "Фиксируйте допуск по риску до обсуждения доходности.",
      "Завершайте встречу понятным планом действий на ближайший месяц."
    ];
  }

  if (domain === "creator") {
    if (role === "problem") {
      return [
        "Сильная экспертиза звучит ровно, но без крючка на первом экране.",
        "Мысль растягивается, и читатель теряет нить уже на втором слайде.",
        "Нет конкретного действия, ради которого человек дочитывает."
      ];
    }
    if (role === "amplify") {
      return [
        "Низкий досмотр сигнализирует алгоритму, что контент «средний».",
        "Полезность есть, но она не превращается в сохранения и диалоги.",
        "Каждый следующий пост сложнее раскачать на старте."
      ];
    }
    if (role === "consequence") {
      return [
        "Охваты нестабильны, даже при регулярной публикации.",
        "Аудитория запоминает формат, но не запоминает вашу позицию.",
        "Контент-план есть, а воронка доверия не собирается."
      ];
    }
    return [
      "Делайте один слайд = одна мысль с четким микровыводом.",
      "Добавляйте контраст «до/после» или конкретный пример из практики.",
      "Закрывайте блок действием: сохранить, ответить, написать код-слово."
    ];
  }

  if (domain === "sales") {
    if (role === "problem") {
      return [
        "Заявка приходит, но первый контакт затягивается и интерес остывает.",
        "Клиент не понимает следующий шаг и откладывает решение «на потом».",
        "В диалоге много общих слов, мало точной логики под запрос."
      ];
    }
    if (role === "amplify") {
      return [
        "Паузы между касаниями увеличивают стоимость каждой сделки.",
        "Реклама продолжает лить лиды, а команда спорит о причинах провала.",
        "Чем дольше нет системы, тем ниже доходимость до оплаты."
      ];
    }
    if (role === "consequence") {
      return [
        "Горячие заявки уходят к тем, кто отвечает быстрее и точнее.",
        "Бюджет растет, а предсказуемого результата по сделкам нет.",
        "Команда выгорает из-за хаоса и взаимных претензий."
      ];
    }
    return [
      "Соберите единый сценарий: первый ответ, квалификация, следующий шаг.",
      "Поставьте SLA на ответ и follow-up касания в первые 24 часа.",
      "Раз в неделю разбирайте потерянные диалоги и правьте формулировки."
    ];
  }

  if (role === "problem") {
    return [
      "Человек видит общий посыл, но не понимает, что делать именно ему.",
      "Польза заявлена, но нет конкретного признака результата.",
      "Старт перегружен, поэтому ключевая мысль теряется до сути."
    ];
  }
  if (role === "amplify") {
    return [
      "Когда смысл неясен на старте, до финала доходит только часть аудитории.",
      "Слабый ритм снижает досмотры и обесценивает даже сильную мысль.",
      "Время и усилия уходят в контент, который не дает обратной связи."
    ];
  }
  if (role === "consequence") {
    return [
      "Экспертиза выглядит «как у всех», потому что фокус не считывается.",
      "Люди уходят без действия: не сохраняют и не возвращаются к материалу.",
      "Команда выгорает: усилий много, а стабильного результата мало."
    ];
  }
  return [
    "Начинайте с одной боли и сразу показывайте понятный выигрыш.",
    "На каждом слайде добавляйте факт: ситуацию, цифру или мини-кейс.",
    "Закрывайте блок действием, которое реально сделать сегодня."
  ];
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

function normalizeBodyText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  const normalizedLines = value
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (!normalizedLines.length) {
    return "";
  }

  const joined = normalizedLines.join("\n");
  if (joined.length <= maxLength) {
    return joined;
  }

  const compact = joined.replace(/\n+/g, " ");
  return trimToWordBoundary(compact, maxLength);
}

function buildHookFallbackTitle(topic: string, mode: ContentMode = "expert") {
  if (mode === "sales") {
    return trimToWordBoundary(getFallbackTitle("hook"), 96);
  }

  return trimToWordBoundary(buildFirstSlideTitleForMode(topic, mode), 96);
}

function buildHookFallbackSubtitle(topic: string, mode: ContentMode = "expert") {
  if (mode !== "sales") {
    return trimToWordBoundary(buildFirstSlideSubtitleForMode(topic, mode), 132);
  }

  const topicFocus = buildTopicFocus(sanitizeTopic(topic));
  const variants = [
    `Покажу 3 формулировки по ${topicFocus}, которые удерживают внимание в первые 5 секунд.`,
    `Разберём 1 реальный сценарий по ${topicFocus}: где люди уходят и какой шаг возвращает диалог.`,
    `Соберём короткий каркас по ${topicFocus}: факт -> разворот -> действие без воды.`
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

function normalizeFocusLead(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const words = trimmed.split(/\s+/u).filter(Boolean);
  const infinitiveIndex = words.findIndex((word) => /[\p{L}-]{4,}(?:ть|ти)$/iu.test(word));
  const hasDativeLead =
    infinitiveIndex >= 1 &&
    infinitiveIndex <= 3 &&
    words
      .slice(0, infinitiveIndex)
      .some((word) => /[\p{L}-]+(?:у|ю|ам|ям|е|ом|ем)$/iu.test(word));

  // Remove awkward "кому + (описание) + инфинитив" lead-ins:
  // "психологу объяснять ...", "репетитору английского удерживать ..."
  if (hasDativeLead) {
    const tail = words.slice(infinitiveIndex + 1).join(" ").trim();
    if (tail) {
      return tail;
    }
  }

  return trimmed;
}

function buildTopicFocus(topic: string) {
  const cleaned = normalizeText(topic, 120)
    .replace(/^(как|почему|зачем|что)\s+/iu, "")
    .replace(/[.?!…]+$/u, "")
    .trim();

  const leadNormalized = normalizeFocusLead(cleaned)
    .replace(/^по\s+теме\s+/iu, "")
    .replace(/^тема\s*[:—-]\s*/iu, "")
    .trim();

  if (!leadNormalized) {
    return "вашей теме";
  }

  const compact = removeDanglingTail(trimToWordBoundary(leadNormalized, 58));
  if (compact.length >= 8) {
    return compact;
  }

  return removeDanglingTail(trimToWordBoundary(leadNormalized, 52)) || "вашей теме";
}

function buildCompactTopicFocus(topic: string, maxLength = 42) {
  const focus = buildTopicFocus(topic)
    .replace(/^по\s+теме\s+/iu, "")
    .trim();

  if (!focus) {
    return "вашей теме";
  }

  return removeDanglingTail(trimToWordBoundary(focus, maxLength)) || "вашей теме";
}

function extractHookAnchor(topic: string) {
  const normalized = normalizeText(topic, 140)
    .replace(/[.?!…]+$/u, "")
    .trim();

  if (!normalized) {
    return "вашей теме";
  }

  if (normalized.length <= 74) {
    return normalized;
  }

  const parts = normalized
    .split(/[—–:]/u)
    .map((item) => item.trim())
    .filter(Boolean);

  const firstPart = parts[0];
  if (firstPart && firstPart.length >= 16) {
    return trimToWordBoundary(firstPart, 74);
  }

  return trimToWordBoundary(normalized, 74);
}

function hasDanglingTail(value: string) {
  return /\b(и|а|но|или|что|чтобы|потому|когда|где|как|если|по|в|на|для|с|к|от|из|из-за|у|до|за|без|при|о|об|обо|над|под|между|через|про|который|которого|которой|которые|первого|второго|третьего|четвертого|пятого|обычно|живой|стабильному)\s*$/iu.test(
    value.trim()
  );
}

function removeDanglingTail(value: string) {
  return value
    .replace(
      /(?:^|[\s\u00A0])(и|а|но|или|что|чтобы|потому|когда|где|как|если|по|в|на|для|с|к|от|из|из-за|у|до|за|без|при|о|об|обо|над|под|между|через|про|который|которого|которой|которые|первого|второго|третьего|четвертого|пятого|обычно|живой|стабильному)\s*$/iu,
      ""
    )
    .replace(/[,:;—–-]+\s*$/u, "")
    .trim();
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

  const withoutEllipsis = noDoubleSpaces
    .replace(/(?:\.{3,}|…+)/gu, ".")
    .replace(/\s+/gu, " ")
    .trim();

  if (!withoutEllipsis) {
    return "";
  }

  const words = withoutEllipsis.split(" ");
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

  const trimmed = trimToWordBoundary(cleaned, maxLength);
  if (!trimmed) {
    return "";
  }

  const endsWithQuestion = /[?]\s*$/u.test(trimmed);
  const endsWithExclamation = /!\s*$/u.test(trimmed);
  const endsWithTerminal = /[.?!]\s*$/u.test(trimmed);
  const withoutTerminal = trimmed.replace(/[.?!]+\s*$/u, "").trim();
  const noTail = removeDanglingTail(withoutTerminal);
  if (!noTail) {
    return "";
  }

  if (endsWithQuestion && countWords(noTail) >= 3) {
    return `${noTail}?`;
  }

  if (endsWithExclamation && countWords(noTail) >= 2) {
    return `${noTail}!`;
  }

  if (endsWithTerminal) {
    return `${noTail}.`;
  }

  return noTail;
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

function hasAwkwardHookTitle(value: string) {
  const normalized = value
    .replace(/\s+/gu, " ")
    .replace(/[«»“”„]/gu, "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return false;
  }

  return (
    /^[\p{L}-]+(?:у|ю)\s+[\p{L}-]{4,}ть\s*:/iu.test(normalized) ||
    /^[\p{L}-]+\s+[\p{L}-]{4,}ть:\s+как\b/iu.test(normalized) ||
    /«[^»]*\b(и|а|но|или|к|по|на|для|без|от)\s*»/iu.test(normalized)
  );
}

function hasNonSalesGrammarRisk(value: string) {
  const normalized = value.replace(/\s+/gu, " ").trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (/[«»"]/u.test(normalized)) {
    return false;
  }

  return (
    /^почему\s+.+\s+не\s+работает$/iu.test(normalized) ||
    /^как\s+наладить\s+.+$/iu.test(normalized) ||
    /^почему\s+срывается\s+.+$/iu.test(normalized) ||
    /^кейс:\s+как\s+наладили\s+.+$/iu.test(normalized)
  );
}

function isListLikeHookTitle(value: string) {
  const normalized = value.toLowerCase().replace(/\s+/gu, " ").trim();
  if (!normalized) {
    return false;
  }

  return (
    /^\d+\s+(ошиб|способ|шаг|причин|пункт|иде)/iu.test(normalized) ||
    /(?:^|[^\p{L}])(топ|лучших|способов|best|top)(?=$|[^\p{L}])/iu.test(normalized)
  );
}

function isHookQuestionTemplate(value: string) {
  const normalized = value.toLowerCase().replace(/\s+/gu, " ").trim();
  if (!normalized) {
    return false;
  }

  return /хотите\s+узнать\s+как|how\s+to|many\s+wonder|do\s+you\s+want\s+to\s+know/iu.test(normalized);
}

function isHookEchoingTopic(title: string, topic: string) {
  const titleNormalized = normalizeWordTokens(
    normalizeText(removeDanglingTail(title), 140)
      .replace(/[«»“”„]/gu, " ")
      .replace(/[!?.,:;—–-]+/gu, " ")
  );
  const topicNormalized = normalizeWordTokens(
    normalizeText(topic, 180)
      .replace(/[«»“”„]/gu, " ")
      .replace(/[!?.,:;—–-]+/gu, " ")
  );

  if (titleNormalized.length < 4 || topicNormalized.length < 4) {
    return false;
  }

  const titleCore = titleNormalized.filter((token) => !TOPIC_STOP_WORDS.has(token));
  const topicCore = topicNormalized.filter((token) => !TOPIC_STOP_WORDS.has(token));

  if (titleCore.length < 3 || topicCore.length < 3) {
    return false;
  }

  const titleJoined = titleCore.join(" ");
  const topicJoined = topicCore.join(" ");

  if (titleJoined === topicJoined) {
    return true;
  }

  if (
    (topicJoined.includes(titleJoined) || titleJoined.includes(topicJoined)) &&
    Math.abs(topicJoined.length - titleJoined.length) <= 14
  ) {
    return true;
  }

  return false;
}

function hasLegacyTemplatePhrase(value: string) {
  return /(?:^|[^\p{L}])(по\s+теме|в\s+теме|где\s+ломается\s+поток|где\s+теряется\s+внимание|что\s+это\s+стоит\s+в\s+теме|разбор\s+под\s+ваш\s+кейс)(?=$|[^\p{L}])/iu.test(
    value
  );
}

function upperFirst(value: string) {
  if (!value) {
    return "";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function sanitizeTitleValue(value: unknown, maxLength: number) {
  const rawTitle = sanitizeCopyText(normalizeText(value, maxLength + 20), maxLength);
  if (!rawTitle) {
    return "";
  }
  const cleanTitle = rawTitle
    .replace(/[,:;—–-]+\s*$/u, "")
    .replace(/[.!]+\s*$/u, "")
    .replace(/\b(и|а|но|или|что|чтобы|как|где|когда|по|в|на|для|с)\s*$/iu, "")
    .trim();
  if (!cleanTitle) {
    return "";
  }

  const words = cleanTitle.split(" ").filter(Boolean);
  if (words.length <= 2) {
    return cleanTitle;
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

  return sanitizeCopyText(compactWords.join(" "), maxLength)
    .replace(/[.!]+\s*$/u, "")
    .trim();
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

function buildPrimaryTopicAnchors(topic: string) {
  return normalizeWordTokens(normalizeText(topic, 180))
    .filter((token) => token.length >= 4 && !TOPIC_STOP_WORDS.has(token))
    .slice(0, 4);
}

function hasPrimaryTopicAnchor(copy: string, topic: string) {
  const anchors = buildPrimaryTopicAnchors(topic);
  if (!anchors.length) {
    return true;
  }

  const copyTokens = normalizeWordTokens(copy).filter(
    (token) => token.length >= 4 && !TOPIC_STOP_WORDS.has(token)
  );
  if (!copyTokens.length) {
    return false;
  }

  return anchors.some((anchor) =>
    copyTokens.some((token) => token.startsWith(anchor) || anchor.startsWith(token))
  );
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

  const alreadyAnchored = new RegExp(
    `(?:^|[^\\p{L}\\p{N}])${escapeRegExp(topicAnchor)}(?=$|[^\\p{L}\\p{N}])`,
    "iu"
  ).test(normalizedTitle);
  if (alreadyAnchored) {
    return removeDanglingTail(normalizedTitle) || normalizedTitle;
  }

  const anchoredTitle = trimToWordBoundary(`${normalizedTitle} — про ${topicAnchor}`, 90);
  return removeDanglingTail(anchoredTitle) || anchoredTitle;
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
  raw: {
    text?: unknown;
    cta?: unknown;
    cta_soft?: unknown;
    cta_aggressive?: unknown;
    hashtags?: unknown;
  },
  fallback: CarouselPostCaption,
  goal?: string,
  mode: ContentMode = "expert"
): CarouselPostCaption {
  const text = formatCaptionText(sanitizeCopyText(normalizeText(raw.text, 1800), 1750) || fallback.text);
  const ctaSoft =
    sanitizeCopyText(normalizeText(raw.cta_soft, 220), 210) || fallback.ctaSoft || fallback.cta;
  const ctaAggressive =
    sanitizeCopyText(normalizeText(raw.cta_aggressive, 220), 210) ||
    fallback.ctaAggressive ||
    fallback.cta;
  const safeCtaSoft =
    mode !== "sales" && containsDirectMessageCta(ctaSoft)
      ? sanitizeCopyText(normalizeText(fallback.ctaSoft, 220), 210) || fallback.cta
      : ctaSoft;
  const requestedCta = sanitizeCopyText(normalizeText(raw.cta, 220), 210);
  const safeRequestedCta =
    mode !== "sales" && requestedCta && containsDirectMessageCta(requestedCta) ? "" : requestedCta;
  const cta =
    safeRequestedCta || selectCtaByGoal(goal, { soft: safeCtaSoft, aggressive: ctaAggressive }, mode);
  const hashtags = normalizeHashtags(raw.hashtags);

  return {
    text,
    cta,
    ctaSoft: safeCtaSoft,
    ctaAggressive,
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

function buildCaptionFallback(
  topic: string,
  slides: CarouselOutlineSlide[],
  goal?: string,
  mode: ContentMode = "expert"
): CarouselPostCaption {
  const sanitizedTopic = sanitizeTopic(topic);
  const hook = slides.find((slide) => slide.type === "hook");
  const solution = slides.find((slide) => slide.type === "solution");
  const firstIdea = hook?.title || buildHookFallbackTitle(sanitizedTopic, mode);
  const solutionLine =
    solution && "bullets" in solution && solution.bullets.length
      ? solution.bullets[0]
      : mode === "sales"
        ? "Разбейте тему на короткие, самостоятельные мысли — так дочитывают чаще."
        : "Возьмите один шаг из карусели и примените его в ближайшей практике.";
  const ctaVariants = buildCtaVariants(goal, sanitizedTopic, mode);

  const text = formatCaptionText(
    trimToWordBoundary(
    [
      `${firstIdea}.`,
      `Главная мысль этой карусели: ${solutionLine}`,
      mode === "sales"
        ? "Сфокусируйтесь на одной проблеме аудитории и разверните её через контраст: было -> стало."
        : "Сфокусируйтесь на одной причине и разверните её через механизм: почему это происходит и что менять.",
      "Так текст звучит живо, не теряет ритм и даёт человеку понятный следующий шаг."
    ].join(" "),
    1700
    )
  );

  return {
    text,
    cta: ctaVariants.selected,
    ctaSoft: ctaVariants.soft,
    ctaAggressive: ctaVariants.aggressive,
    hashtags: buildFallbackHashtags(sanitizedTopic)
  };
}

function containsDirectMessageCta(value: string) {
  const normalized = normalizeText(value, 220).toLowerCase();
  if (!normalized) {
    return false;
  }

  return /(?:^|[^\p{L}])(директ|дир|личк|лс|в\s+сообщени|в\s+личн|напиши\s+\p{L}|пиши\s+\p{L})(?=$|[^\p{L}])/iu.test(
    normalized
  );
}

function buildGoalAwareCta(goal?: string, topic?: string, mode: ContentMode = "expert") {
  return buildCtaVariants(goal, topic, mode).selected;
}

function buildCtaVariants(goal?: string, topic?: string, mode: ContentMode = "expert") {
  const normalizedGoal = normalizeText(goal, 40).toLowerCase();
  const sanitizedTopic = sanitizeTopic(topic ?? "");
  const domain = resolveTopicDomain(sanitizedTopic || topic || "");
  const focus = buildCompactTopicFocus(sanitizedTopic, 34);
  const seed = sanitizedTopic || domain;

  const aggressive = isLeadsGoal(normalizedGoal)
    ? "Напишите «ПЛАН» в директ — соберу структуру под ваши заявки."
    : pickVariantByTopic(seed, [
        `Напишите «КАРКАС» в директ — пришлю короткий шаблон под «${focus}».`,
        `Напишите «ШАБЛОН» в директ — отправлю готовый скелет под «${focus}».`
      ]);

  const soft = isFollowersGoal(normalizedGoal)
    ? pickVariantByTopic(seed, [
        "Сохраните пост и подпишитесь — разберу следующий кейс в этом формате.",
        "Сохраните карусель и перешлите коллеге, с кем хотите сверить подход."
      ])
    : buildDomainSoftCta(domain, focus, sanitizedTopic);

  const normalizedAggressive = trimToWordBoundary(aggressive, 210);
  const normalizedSoft = trimToWordBoundary(soft, 210);
  const selected =
    mode === "sales"
      ? selectCtaByGoal(goal, { soft: normalizedSoft, aggressive: normalizedAggressive }, mode)
      : normalizedSoft;

  return {
    aggressive: normalizedAggressive,
    soft: normalizedSoft,
    selected
  };
}

function selectCtaByGoal(
  goal: string | undefined,
  variants: { soft: string; aggressive: string },
  mode: ContentMode = "expert"
) {
  if (mode !== "sales") {
    return variants.soft;
  }

  const normalizedGoal = normalizeText(goal, 40).toLowerCase();
  if (isLeadsGoal(normalizedGoal)) {
    return variants.aggressive;
  }

  return variants.soft;
}

function isLeadsGoal(goal: string) {
  const normalized = goal.toLowerCase();
  return (
    normalized.includes("lead") ||
    normalized.includes("лид") ||
    normalized.includes("заяв") ||
    normalized.includes("клиент")
  );
}

function isFollowersGoal(goal: string) {
  const normalized = goal.toLowerCase();
  return normalized.includes("подпис") || normalized.includes("follow") || normalized.includes("follower");
}

function buildDomainSoftCta(domain: TopicDomain, focus: string, topicSeed?: string) {
  const variantsByDomain: Record<TopicDomain, string[]> = {
    education: [
      "Сохраните карусель и возьмите один приём на ближайший урок.",
      "Сохраните и протестируйте один шаг на следующем занятии."
    ],
    psychology: [
      "Сохраните схему и используйте её в следующей консультации.",
      "Сохраните карусель и попробуйте один вопрос уже в ближайшей сессии."
    ],
    health: [
      "Сохраните памятку и проверьте, какой шаг можно внедрить уже сегодня.",
      "Сохраните карусель, чтобы вернуться к схеме без спешки и паники."
    ],
    fitness: [
      "Сохраните план и выполните первый шаг уже на этой неделе.",
      "Сохраните карусель и отметьте один шаг, который внедрите на ближайшей тренировке."
    ],
    beauty: [
      "Сохраните разбор и внедрите один шаг с ближайшим клиентом.",
      "Сохраните карусель и проверьте, как меняется отклик после первого шага."
    ],
    finance: [
      "Сохраните чек-лист и сверяйте с ним решения перед следующим вложением.",
      "Сохраните карусель и выберите один шаг, который снизит тревогу в финансах."
    ],
    creator: [
      "Сохраните карусель и выберите пункт, который внедрите в ближайшем посте.",
      `Сохраните разбор по «${focus}» и используйте его в следующей публикации.`
    ],
    sales: [
      "Сохраните карусель и внедрите первый шаг в работу уже сегодня.",
      "Сохраните пост и выберите один пункт, который добавите в воронку на этой неделе."
    ],
    general: [
      "Сохраните карусель и выберите первый шаг, который внедрите сегодня.",
      `Сохраните разбор по «${focus}» и вернитесь к нему перед следующей публикацией.`
    ]
  };

  return pickVariantByTopic(topicSeed ?? domain, variantsByDomain[domain] ?? variantsByDomain.general);
}

function formatCaptionText(value: string) {
  const normalized = sanitizeCopyText(normalizeText(value, 1800), 1750);
  if (!normalized) {
    return "";
  }

  const chunks = normalized
    .split(/(?<=[.!?])\s+/u)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (chunks.length <= 2) {
    return normalized;
  }

  const grouped: string[] = [];
  for (let index = 0; index < chunks.length; index += 2) {
    grouped.push(chunks.slice(index, index + 2).join(" "));
  }

  return grouped.join("\n\n");
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

function readErrorStringField(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function getModelErrorDetails(error: unknown) {
  const details = toRecord(error);
  const nestedError = toRecord(details.error);

  return {
    status: typeof details.status === "number" && Number.isFinite(details.status) ? details.status : null,
    message:
      readErrorStringField(details.message) ??
      readErrorStringField(nestedError.message) ??
      (error instanceof Error ? error.message : "Unknown error"),
    type: readErrorStringField(details.type) ?? readErrorStringField(nestedError.type),
    code: readErrorStringField(details.code) ?? readErrorStringField(nestedError.code)
  };
}

function logModelFailure(model: string, error: unknown) {
  console.error(`Model "${model}" failed:`, getModelErrorDetails(error));
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

  if (status === 403) {
    return /\bmodel\b|access|permission|not allowed|not authorized|insufficient/i.test(message);
  }

  if (status === null && /empty output|json|schema|unexpected token/i.test(message)) {
    return true;
  }

  return false;
}

function resolveFallbackReason(error: unknown): CarouselFallbackReason {
  if (!error || typeof error !== "object") {
    return "error";
  }

  const status =
    typeof (error as { status?: unknown }).status === "number"
      ? (error as { status?: number }).status
      : null;
  const message =
    error instanceof Error
      ? error.message
      : typeof (error as { message?: unknown }).message === "string"
        ? String((error as { message?: unknown }).message)
        : "";
  const code =
    typeof (error as { code?: unknown }).code === "string"
      ? String((error as { code?: string }).code)
      : "";
  const name =
    typeof (error as { name?: unknown }).name === "string"
      ? String((error as { name?: string }).name)
      : "";
  const source = `${name} ${code} ${message}`.toLowerCase();

  if (status === 429 || /\bquota\b|insufficient_quota|rate limit|billing/i.test(source)) {
    return "quota";
  }

  if (/\btimeout\b|timed out|time out|etimedout|econnaborted|abort|deadline/i.test(source)) {
    return "timeout";
  }

  return "error";
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}
