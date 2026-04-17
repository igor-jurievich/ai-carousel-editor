import OpenAI from "openai";
import { clampSlidesCount } from "@/lib/slides";
import type {
  CarouselOutlineSlide,
  CarouselPostCaption,
  CarouselSlideRole
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
};

type CaptionGenerationInput = {
  topic: string;
  slides: CarouselOutlineSlide[];
  niche?: string;
  audience?: string;
  tone?: string;
  goal?: string;
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
  fallbackReason?: CarouselFallbackReason;
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
    "example",
    "example",
    "cta"
  ]
};

const DEFAULT_MODEL_CANDIDATES = [
  "gpt-5.1",
  "gpt-4o"
] as const;

const HOOK_SUBTITLE_INPUT_MAX = 154;
const HOOK_SUBTITLE_OUTPUT_MAX = 148;
const CTA_SUBTITLE_INPUT_MAX = 172;
const CTA_SUBTITLE_OUTPUT_MAX = 164;
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
    "Сохрани и примени",
    "Напиши в директ — пришлю шаблон",
    "Попробуй и напиши что получилось"
  ]
};

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
- Описание: 3 пункта-симптома (начинаются с →)
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
- Каждый пункт начинается с →
- Должно быть больно читать

Слайд 6 — SHIFT (поворот):
- Заголовок: переворот мышления, "а вот как на самом деле"
- ОБЯЗАТЕЛЬНО описание: 2-3 предложения объясняющие новый взгляд
- Это момент "ага!" — когда всё встаёт на место
- ЭТОТ СЛАЙД ОБЯЗАН ИМЕТЬ BODY-ТЕКСТ, НЕ ТОЛЬКО ЗАГОЛОВОК

Слайд 7 — SOLUTION (решение):
- Заголовок: "Вот что работает" или подобный
- Описание: 3 конкретных действия (начинаются с →)
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
- Пункты начинаются с → (стрелка)
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
      "body": "→ Пункт раз максимум 15 слов\n→ Пункт два максимум 15 слов\n→ Пункт три максимум 15 слов"
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

function resolveModelCandidates() {
  const uniqueCandidates = [
    process.env.OPENAI_GENERATION_MODEL?.trim(),
    ...DEFAULT_MODEL_CANDIDATES,
    process.env.OPENAI_MODEL?.trim()
  ]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, list) => list.indexOf(value) === index);

  const requestedLimit = Number(process.env.OPENAI_MODEL_CANDIDATE_LIMIT);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(3, Math.min(4, Math.round(requestedLimit)))
    : DEFAULT_MODEL_CANDIDATE_LIMIT;

  return uniqueCandidates.slice(0, limit);
}

function resolveModelAttemptsPerCandidate() {
  const raw = Number(process.env.OPENAI_MODEL_ATTEMPTS);
  if (!Number.isFinite(raw)) {
    return DEFAULT_MODEL_ATTEMPTS;
  }

  return Math.max(1, Math.min(3, Math.round(raw)));
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
            text: CAROUSEL_SYSTEM_PROMPT
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

function mapModelSlidesToLegacyShape(rawSlides: unknown, expectedFlow: CarouselSlideRole[]) {
  const source = Array.isArray(rawSlides) ? rawSlides : [];

  return expectedFlow.map((role, index) => {
    const record = toRecord(source[index]);
    const title = normalizeText(record.title, 180);
    const body = normalizeText(record.body, 1200);
    const bullets = extractBodyBullets(body);

    if (role === "hook") {
      return {
        type: "hook",
        title,
        subtitle: body
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
        body
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
      subtitle: body
    };
  });
}

function extractBodyBullets(body: string) {
  if (!body) {
    return [] as string[];
  }

  const normalizedLines = body
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const arrowLines = normalizedLines
    .map((line) => line.replace(/^(?:→|-|•)\s*/u, "").trim())
    .filter(Boolean);

  if (arrowLines.length) {
    return arrowLines.slice(0, 3);
  }

  const sentenceBullets = body
    .split(/[.!?]+/u)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return sentenceBullets.slice(0, 3);
}

function formatBulletsBody(bullets: string[]) {
  return bullets
    .filter(Boolean)
    .slice(0, 3)
    .map((item) => `→ ${item}`)
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

export async function generateCarouselFromTopic(
  topic: string,
  requestedSlidesCount?: number,
  options?: GenerationOptions
): Promise<CarouselGenerationResult> {
  const cleanedTopic = normalizeText(topic, 800) || "Новая карусель";
  const expectedFlow = [...CANONICAL_FLOW];
  const promptVariant = resolvePromptVariant(options?.promptVariant);

  try {
    const openai = getOpenAIClient();
    const models = resolveModelCandidates();
    const modelAttempts = resolveModelAttemptsPerCandidate();
    let lastError: unknown = null;

    for (const model of models) {
      for (let attempt = 1; attempt <= modelAttempts; attempt += 1) {
        try {
          const userMessage = buildUserPrompt(
            cleanedTopic,
            options?.niche,
            options?.audience,
            options?.tone,
            options?.goal
          );
          const validationErrors: string[] = [];
          let wasRetried = false;
          let tokensUsed = 0;

          const response = await requestCarouselCompletion(openai, model, userMessage, expectedFlow.length);
          tokensUsed += readTotalTokens(response);
          let parsedResponse = parseCarouselModelResponse(response);
          let validationResult = validateCarouselResponse(parsedResponse, expectedFlow);
          validationErrors.push(...validationResult.errors);

          if (!validationResult.valid) {
            wasRetried = true;
            const retryUserMessage =
              userMessage +
              "\n\nВАЖНО: В прошлый раз были ошибки: " +
              validationResult.errors.join("; ") +
              ". Исправь их.";
            const retryResponse = await requestCarouselCompletion(
              openai,
              model,
              retryUserMessage,
              expectedFlow.length
            );
            tokensUsed += readTotalTokens(retryResponse);
            parsedResponse = parseCarouselModelResponse(retryResponse);
            validationResult = validateCarouselResponse(parsedResponse, expectedFlow);
            validationErrors.push(...validationResult.errors);
          }

          const normalizedSlides = normalizeSlides(
            mapModelSlidesToLegacyShape(parsedResponse.slides, expectedFlow),
            expectedFlow,
            cleanedTopic,
            options
          );
          const constrainedSlides = enforceTopicAndHookIntegrity(
            normalizedSlides,
            expectedFlow,
            cleanedTopic,
            options
          );
          const repairedSlides = repairTopicCoverage(constrainedSlides, expectedFlow, cleanedTopic);
          const polishedSlides = applyFinalCopyPolish(
            repairedSlides,
            expectedFlow,
            cleanedTopic,
            options
          );
          const topicRelevantSlides = isOutlineTopicRelevant(polishedSlides, cleanedTopic)
            ? polishedSlides
            : buildFallbackSlides(cleanedTopic, expectedFlow, options);
          const qualityGuardedSlides = enforceSlideQuality(
            topicRelevantSlides,
            expectedFlow,
            cleanedTopic,
            options
          );
          const topicCoveredSlides = repairTopicCoverage(
            qualityGuardedSlides,
            expectedFlow,
            cleanedTopic
          );
          const quality = evaluateSlideQuality(topicCoveredSlides, expectedFlow, cleanedTopic);

          if (topicRelevantSlides !== polishedSlides) {
            console.warn("Generated outline was strongly off-topic. Using deterministic fallback slides.");
          }

          if (!quality.ok) {
            const locallyRepairedSlides = rescueWeakSlidesAfterQualityCheck(
              qualityGuardedSlides,
              expectedFlow,
              cleanedTopic,
              options,
              quality.reasons
            );
            const repairedQuality = evaluateSlideQuality(locallyRepairedSlides, expectedFlow, cleanedTopic);

            if (repairedQuality.ok) {
              return {
                slides: locallyRepairedSlides,
                caption: normalizeGeneratedCaption(parsedResponse.caption),
                promptVariant,
                generationSource: "model",
                generationMeta: {
                  model,
                  tokensUsed,
                  validationErrors: dedupeErrors(validationErrors),
                  retried: wasRetried
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
            console.warn(
              `Model "${model}" produced weak copy after retries (${reason}). Trying next candidate.`
            );
            continue;
          }

          if (hasBannedTemplateLanguage(qualityGuardedSlides)) {
            if (attempt < 2) {
              console.warn(`Model "${model}" attempt ${attempt} returned templated language. Retrying.`);
              continue;
            }
            return {
              slides: stripBannedTemplateLanguage(
                topicCoveredSlides,
                expectedFlow,
                cleanedTopic,
                options
              ),
              caption: normalizeGeneratedCaption(parsedResponse.caption),
              promptVariant,
              generationSource: "model",
              generationMeta: {
                model,
                tokensUsed,
                validationErrors: dedupeErrors(validationErrors),
                retried: wasRetried
              }
            };
          }

          return {
            slides: topicCoveredSlides,
            caption: normalizeGeneratedCaption(parsedResponse.caption),
            promptVariant,
            generationSource: "model",
            generationMeta: {
              model,
              tokensUsed,
              validationErrors: dedupeErrors(validationErrors),
              retried: wasRetried
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

    return {
      slides: buildFallbackSlides(cleanedTopic, expectedFlow, options),
      caption: "",
      promptVariant,
      generationSource: "fallback",
      generationMeta: {
        model: "fallback",
        tokensUsed: 0,
        validationErrors:
          error instanceof Error && error.message.trim() ? [error.message.trim()] : ["fallback activated"],
        retried: false
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

        return normalizeCaption(parsed, fallback, input.goal);
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

function resolvePromptVariant(value?: PromptVariant | string) {
  return value === "A" ? "A" : "B";
}

function resolveTopicDomain(topic: string, options?: GenerationOptions): TopicDomain {
  const source = normalizeText(
    [topic, options?.niche ?? "", options?.audience ?? ""].filter(Boolean).join(" "),
    420
  ).toLowerCase();

  if (
    /\b(финанс|инвест|бюджет|деньг|доход|портфел|кредит|налог|капитал|риск)\w*\b/iu.test(source)
  ) {
    return "finance";
  }

  if (
    /\b(врач|медицин|диагноз|пациент|клиник|здоров|лечение|терапи|симптом)\w*\b/iu.test(source)
  ) {
    return "health";
  }

  if (
    /\b(психолог|тревог|выгоран|терапевт|эмоци|самооцен|отношен|стресс)\w*\b/iu.test(source)
  ) {
    return "psychology";
  }

  if (/\b(фитнес|тренер|трениров|зал|спорт|форма|похуд|нагрузк)\w*\b/iu.test(source)) {
    return "fitness";
  }

  if (
    /\b(бьюти|салон|мастер|космет|ресниц|маник|ногт|бров|стилист)\w*\b/iu.test(source)
  ) {
    return "beauty";
  }

  if (
    /\b(репетитор|обучен|ученик|урок|школ|курс|преподав|студент|образован)\w*\b/iu.test(source)
  ) {
    return "education";
  }

  if (
    /\b(личн[а-яё]*\s+бренд|эксперт|блог|контент|instagram|telegram|соцсет|автор)\b/iu.test(source)
  ) {
    return "creator";
  }

  if (
    /\b(продаж|заявк|лид|воронк|конверс|маркетолог|риелтор|агентств|клиент|сделк|реклам)\w*\b/iu.test(
      source
    )
  ) {
    return "sales";
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
  goal?: string
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

  prompt += "\n\nСоздай карусель из 9 слайдов. Ответ — только JSON.";

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
    `Напиши подпись к Instagram-посту для карусели на тему: "${input.topic}".`,
    niche ? `Ниша: ${niche}` : "",
    audience ? `Аудитория: ${audience}` : "",
    tone ? `Тон: ${tone}` : "",
    goal ? `Цель: ${goal}` : "",
    "",
    "Формат:",
    "- 3-4 абзаца",
    "- Первый абзац: крючок, цепляющее начало (вопрос или утверждение)",
    "- Второй абзац: суть — о чём карусель и зачем листать",
    "- Третий абзац: личный опыт или наблюдение автора (1-2 предложения)",
    "- Четвёртый абзац: призыв к действию (сохрани / перешли другу / напиши в комментариях)",
    "",
    "НЕ используй:",
    "- Хештеги внутри текста подписи",
    "- Эмодзи в начале абзацев",
    "- «Всем привет!» и подобные вступления",
    "- @username, счётчики, ссылки",
    "",
    "Тон: как пишет умный человек в своём блоге — не продающий, не нудный, а по делу.",
    "",
    "Контекст карусели:",
    slideDigest,
    "",
    "Ответ верни в JSON с полями: text, cta, cta_soft, cta_aggressive, hashtags.",
    "- text: 3-4 абзаца в заданном формате, без хештегов.",
    "- cta: основной призыв из 1-2 предложений.",
    "- cta_soft: мягкий CTA (сохрани / отправь другу).",
    "- cta_aggressive: прямой CTA (напиши слово / оставь комментарий).",
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
  options?: GenerationOptions
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
      typeof hook.subtitle === "string"
        ? sanitizeCopyText(normalizeText(hook.subtitle, HOOK_SUBTITLE_INPUT_MAX), HOOK_SUBTITLE_OUTPUT_MAX)
        : "";
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

function applyFinalCopyPolish(
  slides: CarouselOutlineSlide[],
  expectedFlow: CarouselSlideRole[],
  topic: string,
  options?: GenerationOptions
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
        hasAwkwardHookTitle(normalizedTitle) ||
        startsWithGenericMistakeLead(normalizedTitle) ||
        hasLegacyTemplatePhrase(combinedHook) ||
        BANNED_TEMPLATE_PATTERNS.some((pattern) => pattern.test(combinedHook)) ||
        !hasPrimaryTopicAnchor(combinedHook, topic);
      const generatedScore = scoreHookCandidate(normalizedTitle, normalizedSubtitle);
      const candidates = buildHookCandidates(topic, options);
      const best = pickBestHookCandidate(candidates);
      const bestScore = best ? scoreHookCandidate(best.title, best.subtitle) : Number.NEGATIVE_INFINITY;
      const shouldUpgradeHook = Boolean(best && bestScore >= generatedScore + 2);

      if (shouldRepairHook || shouldUpgradeHook) {
        if (!best) {
          hook.title = buildHookFallbackTitle(topic);
          hook.subtitle = normalizedSubtitle || buildHookFallbackSubtitle(topic);
        } else {
          hook.title = best.title;
          hook.subtitle = best.subtitle;
        }
      } else {
        hook.title = normalizedTitle;
        hook.subtitle = normalizedSubtitle || buildHookFallbackSubtitle(topic);
      }

      if (countSentenceMarks(`${hook.title} ${hook.subtitle}`) > 2) {
        hook.subtitle = buildHookFallbackSubtitle(topic);
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
      const ctaVariants = buildCtaVariants(options?.goal, topic);
      const normalizedTitle = sanitizeTitleValue(cta.title, 84);
      const normalizedSubtitle = sanitizeCopyText(
        normalizeText(cta.subtitle, CTA_SUBTITLE_INPUT_MAX),
        CTA_SUBTITLE_OUTPUT_MAX
      );
      const hasAction = hasActionVerb(normalizedSubtitle);
      const weakTitle =
        !normalizedTitle ||
        /\b(готов[а-яё]*|объединить\s+усилия|поехали|пора\s+действовать|давайте\s+начнем)\b/iu.test(
          normalizedTitle
        );

      cta.title = weakTitle
        ? buildCtaTitleFallback(options?.goal, topic)
        : normalizedTitle;
      cta.subtitle = hasAction ? normalizedSubtitle : ctaVariants.selected;
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
        hasAwkwardHookTitle(title) ||
        startsWithGenericMistakeLead(title) ||
        hasLegacyTemplatePhrase(title) ||
        isWeakRoleTitle(title);

      return {
        type: "hook",
        title: weakTitle ? buildHookFallbackTitle(topic) : title,
        subtitle: subtitle || buildHookFallbackSubtitle(topic)
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
      const title = sanitizeTitleValue(mistake.title, 92);
      const weakTitle =
        !title ||
        startsWithGenericMistakeLead(title) ||
        hasLegacyTemplatePhrase(title) ||
        isWeakRoleTitle(title) ||
        countWords(title) < 4;

      return {
        type: "mistake",
        title: weakTitle ? buildRoleTitleFallback("mistake", topic, options) : title
      };
    }

    if (role === "consequence") {
      const consequence = current as Extract<CarouselOutlineSlide, { type: "consequence" }>;
      const consequenceFallback = fallback as Extract<CarouselOutlineSlide, { type: "consequence" }>;
      const bullets = normalizeBullets(consequence.bullets, consequenceFallback.bullets);
      const strongBullets = pickStrongBullets(bullets, consequenceFallback.bullets);
      return {
        type: "consequence",
        bullets: strongBullets
      };
    }

    if (role === "shift") {
      const shift = current as Extract<CarouselOutlineSlide, { type: "shift" }>;
      const title = sanitizeTitleValue(shift.title, 92);
      const weakTitle =
        !title ||
        startsWithGenericMistakeLead(title) ||
        hasLegacyTemplatePhrase(title) ||
        isWeakRoleTitle(title) ||
        countWords(title) < 4;

      return {
        type: "shift",
        title: weakTitle ? buildRoleTitleFallback("shift", topic, options) : title
      };
    }

    if (role === "solution") {
      const solution = current as Extract<CarouselOutlineSlide, { type: "solution" }>;
      const solutionFallback = fallback as Extract<CarouselOutlineSlide, { type: "solution" }>;
      const bullets = normalizeBullets(solution.bullets, solutionFallback.bullets);
      const strongBullets = pickStrongBullets(bullets, solutionFallback.bullets);
      return {
        type: "solution",
        bullets: strongBullets
      };
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
    const ctaVariants = buildCtaVariants(options?.goal, topic);
    const title = sanitizeTitleValue(cta.title, 84);
    const subtitle = sanitizeCopyText(
      normalizeText(cta.subtitle, CTA_SUBTITLE_INPUT_MAX),
      CTA_SUBTITLE_OUTPUT_MAX
    );
    const hasAction = hasActionVerb(subtitle);
    return {
      type: "cta",
      title:
        !title || countWords(title) < 2 || isWeakRoleTitle(title) || hasLegacyTemplatePhrase(title)
          ? buildCtaTitleFallback(options?.goal, topic)
          : title,
      subtitle: hasAction ? subtitle : ctaVariants.selected
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

  const hasNumber = /\b\d+(?:[.,]\d+)?\s*%?\b/u.test(text);
  const hasAction = /\b(сделай|сделайте|проверь|проверьте|замени|замените|добавь|добавьте|запусти|запустите|опиши|вынеси|попробуй|попробуйте|начни|начните|внедри|внедрите|напиши|напишите|сохраните|ответьте|пришлите|оставьте)\b/iu.test(
    text
  );
  const hasScenario = /\b(когда|если|утром|вечером|на\s+встрече|в\s+переписке|в\s+ленте|в\s+instagram|сегодня|за\s+неделю|за\s+месяц|после\s+первой\s+встречи)\b/iu.test(
    text
  );
  const hasComparison = /\b(vs|против|вместо|чем\s+больше.+тем\s+меньше|не\s+.+,\s+а\s+.+)\b/iu.test(
    text
  );

  return hasNumber || hasAction || hasScenario || hasComparison;
}

function hasActionVerb(value: string) {
  return /(?:^|[^\p{L}])(напиши|напишите|сохраните|оставьте|отправьте|ответьте|пришлите|подпишитесь|выберите|проверь|проверьте|сделай|сделайте|попробуй|попробуйте|внедри|внедрите|запусти|запустите|начни|начните)(?=$|[^\p{L}])/iu.test(
    value
  );
}

function rescueWeakSlidesAfterQualityCheck(
  slides: CarouselOutlineSlide[],
  expectedFlow: CarouselSlideRole[],
  topic: string,
  options: GenerationOptions | undefined,
  reasons: string[]
) {
  const nextSlides = slides.map((slide) => ({ ...slide })) as CarouselOutlineSlide[];
  const hookIndex = expectedFlow.findIndex((role) => role === "hook");

  if (hookIndex >= 0 && nextSlides[hookIndex]?.type === "hook") {
    const hasHookIssue = reasons.some((reason) => reason.includes("hook") || reason.includes("topic"));
    if (hasHookIssue) {
      const hook = nextSlides[hookIndex] as Extract<CarouselOutlineSlide, { type: "hook" }>;
      const bestHook = pickBestHookCandidate(buildHookCandidates(topic, options));
      hook.title = bestHook?.title || buildHookFallbackTitle(topic);
      hook.subtitle = bestHook?.subtitle || buildHookFallbackSubtitle(topic);
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
  const strong = bullets
    .filter((item) => countWords(item) >= 4)
    .filter((item) => !isWeakBulletText(item));

  if (strong.length >= minimum) {
    return strong.slice(0, 4);
  }

  return fallback.slice(0, 4);
}

function isWeakRoleTitle(value: string) {
  const normalized = sanitizeTitleValue(value, 96).toLowerCase();
  if (!normalized) {
    return true;
  }

  return WEAK_ROLE_TITLE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function buildHookCandidates(topic: string, options?: GenerationOptions) {
  const normalizedTopic = normalizeText(topic, 220).toLowerCase();
  const topicDomain = resolveTopicDomain(topic, options);
  const isAdContext = /\b(реклам|клик|лендинг|заяв|лид|воронк)\b/iu.test(normalizedTopic);
  const isCallContext = /\b(звон|созвон|переговор|клиент\s+пропал)\b/iu.test(normalizedTopic);
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
                : topicDomain === "creator"
                  ? "Контент есть, а реакции мало: где ломается интерес?"
                  : "Шаги есть, а результат буксует: где узкое место?";

  const firstTitle = isCallContext
    ? "Созвон прошёл. Почему дальше тишина?"
    : isAdContext
      ? "Клики есть. Почему заявок нет?"
      : tensionTitle;

  const firstSubtitle = isCallContext
    ? "Разберём, какая фраза ломает доверие в первые 2 минуты."
    : isAdContext
      ? "Покажу, где после клика теряется доверие и деньги."
      : trimToWordBoundary(
          `Покажу, как раскрыть «${buildCompactTopicFocus(topic, 34)}» так, чтобы люди дочитывали и сохраняли.`,
          132
        );

  const candidates = [
    {
      title: trimToWordBoundary(firstTitle, 72),
      subtitle: trimToWordBoundary(firstSubtitle, 132)
    },
    {
      title: trimToWordBoundary(
        `Ты вкладываешь часы в «${buildCompactTopicFocus(topic, 24)}», а отклик уходит за 2 секунды`,
        72
      ),
      subtitle: trimToWordBoundary(
        "Разберём, какая формулировка убивает интерес в первых слайдах и чем её заменить.",
        132
      )
    },
    {
      title: trimToWordBoundary(
        `В «${buildCompactTopicFocus(topic, 22)}» досмотры падают из-за воды и повтора мыслей`,
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
    const flags = `${pattern.flags.includes("i") ? "i" : ""}g`;
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
        sanitizeCopyText(normalizeText(safe.subtitle, HOOK_SUBTITLE_INPUT_MAX), HOOK_SUBTITLE_OUTPUT_MAX) ||
        buildHookFallbackSubtitle(topic)
    };
  }

  if (expectedType === "problem") {
    const rawTitle = sanitizeTitleValue(safe.title, 80);
    return {
      type: "problem",
      title:
        (rawTitle && !startsWithGenericMistakeLead(rawTitle) && !hasLegacyTemplatePhrase(rawTitle)
          ? rawTitle
          : "") || buildRoleTitleFallback("problem", topic, options),
      bullets: normalizeBullets(safe.bullets, buildRoleBulletsFallback("problem", topic, options))
    };
  }

  if (expectedType === "amplify") {
    const rawTitle = sanitizeTitleValue(safe.title, 80);
    return {
      type: "amplify",
      title:
        (rawTitle && !startsWithGenericMistakeLead(rawTitle) && !hasLegacyTemplatePhrase(rawTitle)
          ? rawTitle
          : "") || buildRoleTitleFallback("amplify", topic, options),
      bullets: normalizeBullets(safe.bullets, buildRoleBulletsFallback("amplify", topic, options))
    };
  }

  if (expectedType === "mistake") {
    const rawTitle = sanitizeTitleValue(safe.title, 92);
    const body =
      sanitizeCopyText(normalizeText(safe.body, 420), 390) ||
      "→ Ты даёшь общий совет, и человек не узнаёт себя в ситуации\n→ Нет конкретного примера, поэтому мысль звучит как шаблон\n→ После слайда непонятно, что менять прямо сейчас";
    return {
      type: "mistake",
      title:
        (rawTitle && !hasLegacyTemplatePhrase(rawTitle) ? rawTitle : "") ||
        buildRoleTitleFallback("mistake", topic, options),
      body
    } as CarouselOutlineSlide;
  }

  if (expectedType === "consequence") {
    const rawTitle = sanitizeTitleValue(safe.title, 84);
    return {
      type: "consequence",
      title: rawTitle || buildRoleTitleFallback("consequence", topic, options),
      bullets: normalizeBullets(safe.bullets, buildRoleBulletsFallback("consequence", topic, options))
    } as CarouselOutlineSlide;
  }

  if (expectedType === "shift") {
    const rawTitle = sanitizeTitleValue(safe.title, 92);
    const body =
      sanitizeCopyText(normalizeText(safe.body, 420), 390) ||
      "Сначала покажи конкретный факт, потом вывод. Так читатель понимает логику и доходит до действия.";
    return {
      type: "shift",
      title:
        (rawTitle && !startsWithGenericMistakeLead(rawTitle) && !hasLegacyTemplatePhrase(rawTitle)
          ? rawTitle
          : "") ||
        buildRoleTitleFallback("shift", topic, options),
      body
    } as CarouselOutlineSlide;
  }

  if (expectedType === "solution") {
    const rawTitle = sanitizeTitleValue(safe.title, 84);
    return {
      type: "solution",
      title: rawTitle || buildRoleTitleFallback("solution", topic, options),
      bullets: normalizeBullets(safe.bullets, buildRoleBulletsFallback("solution", topic, options))
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
        `После: «Добавили конкретные шаги, и отклик по ${topicFocus} стал стабильнее»`
    };
  }

  const ctaTitle = sanitizeTitleValue(safe.title, 84);
  const goalAwareCta = buildGoalAwareCta(options?.goal, topic);
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
    return fallback;
  }

  const dedupe = new Set<string>();
  const cleaned: string[] = [];

  for (const item of value) {
    const normalized = sanitizeCopyText(normalizeText(item, 128), 122);
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

function buildCtaTitleFallback(goal: string | undefined, topic: string) {
  void goal;
  void topic;
  return trimToWordBoundary(getFallbackTitle("cta"), 96);
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
  void topic;
  void options;
  const maxLength = role === "mistake" || role === "shift" ? 92 : 96;
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
  const domain = resolveTopicDomain(topic, options);

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
      "Показывайте прогресс формулой «было -> стало» на реальных примерах."
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

function buildHookFallbackTitle(topic: string) {
  void topic;
  return trimToWordBoundary(getFallbackTitle("hook"), 96);
}

function buildHookFallbackSubtitle(topic: string) {
  const topicFocus = buildTopicFocus(topic);
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
  return /\b(и|а|но|или|что|чтобы|потому|когда|где|как|если|по|в|на|для|с|к|от|из|у|до|за|без|при|о|об|обо|над|под|между|через|про|который|которого|которой|которые|первого|второго|третьего|четвертого|пятого|обычно|живой|стабильному)\s*$/iu.test(
    value.trim()
  );
}

function removeDanglingTail(value: string) {
  return value
    .replace(
      /(?:^|[\s\u00A0])(и|а|но|или|что|чтобы|потому|когда|где|как|если|по|в|на|для|с|к|от|из|у|до|за|без|при|о|об|обо|над|под|между|через|про|который|которого|которой|которые|первого|второго|третьего|четвертого|пятого|обычно|живой|стабильному)\s*$/iu,
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
  goal?: string
): CarouselPostCaption {
  const text = formatCaptionText(sanitizeCopyText(normalizeText(raw.text, 1800), 1750) || fallback.text);
  const ctaSoft =
    sanitizeCopyText(normalizeText(raw.cta_soft, 220), 210) || fallback.ctaSoft || fallback.cta;
  const ctaAggressive =
    sanitizeCopyText(normalizeText(raw.cta_aggressive, 220), 210) ||
    fallback.ctaAggressive ||
    fallback.cta;
  const requestedCta = sanitizeCopyText(normalizeText(raw.cta, 220), 210);
  const cta = requestedCta || selectCtaByGoal(goal, { soft: ctaSoft, aggressive: ctaAggressive });
  const hashtags = normalizeHashtags(raw.hashtags);

  return {
    text,
    cta,
    ctaSoft,
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

function buildCaptionFallback(topic: string, slides: CarouselOutlineSlide[], goal?: string): CarouselPostCaption {
  const hook = slides.find((slide) => slide.type === "hook");
  const solution = slides.find((slide) => slide.type === "solution");
  const firstIdea = hook?.title || buildHookFallbackTitle(topic);
  const solutionLine =
    solution && "bullets" in solution && solution.bullets.length
      ? solution.bullets[0]
      : "Разбейте тему на короткие, самостоятельные мысли — так дочитывают чаще.";
  const ctaVariants = buildCtaVariants(goal, topic);

  const text = formatCaptionText(
    trimToWordBoundary(
    [
      `${firstIdea}.`,
      `Главная мысль этой карусели: ${solutionLine}`,
      "Сфокусируйтесь на одной проблеме аудитории и разверните её через контраст: было -> стало.",
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
    hashtags: buildFallbackHashtags(topic)
  };
}

function buildGoalAwareCta(goal?: string, topic?: string) {
  return buildCtaVariants(goal, topic).selected;
}

function buildCtaVariants(goal?: string, topic?: string) {
  const normalizedGoal = normalizeText(goal, 40).toLowerCase();
  const domain = resolveTopicDomain(topic ?? "");
  const focus = buildCompactTopicFocus(topic ?? "", 34);

  const aggressive = isLeadsGoal(normalizedGoal)
    ? "Напишите «ПЛАН» в директ — соберу структуру под ваши заявки."
    : pickVariantByTopic(topic ?? domain, [
        `Напишите «КАРКАС» в директ — пришлю короткий шаблон под «${focus}».`,
        `Напишите «ШАБЛОН» в директ — отправлю готовый скелет под «${focus}».`
      ]);

  const soft = isFollowersGoal(normalizedGoal)
    ? pickVariantByTopic(topic ?? domain, [
        "Сохраните пост и подпишитесь — разберу следующий кейс в этом формате.",
        "Сохраните карусель и перешлите коллеге, с кем хотите сверить подход."
      ])
    : buildDomainSoftCta(domain, focus, topic);

  return {
    aggressive: trimToWordBoundary(aggressive, 210),
    soft: trimToWordBoundary(soft, 210),
    selected: selectCtaByGoal(goal, { soft, aggressive })
  };
}

function selectCtaByGoal(goal: string | undefined, variants: { soft: string; aggressive: string }) {
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
