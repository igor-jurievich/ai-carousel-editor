import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { clampSlidesCount } from "@/lib/slides";
import { generateCarouselFromTopic, type PromptVariant } from "@/lib/openai";
import { getSupabasePublicConfig } from "@/lib/supabase";
import {
  CAROUSEL_TEMPLATE_IDS,
  type CarouselOutlineSlide,
  type CarouselTemplateId,
  type SlideFormat
} from "@/types/editor";

export const runtime = "nodejs";

const MAX_TOPIC_CHARS = 800;
const MIN_TOPIC_CHARS = 3;
const DEFAULT_GENERATE_TIMEOUT_MS = 30_000;
const DEFAULT_RATE_LIMIT_MAX = 12;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_SWEEP_THRESHOLD = 5000;
const TEMPLATE_ID_SET = new Set<CarouselTemplateId>(CAROUSEL_TEMPLATE_IDS);

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const generateRateLimit = new Map<string, RateLimitBucket>();

export async function GET() {
  const clients = await createGenerateRouteClients();
  if (!clients) {
    return NextResponse.json(
      { error: "Сервис недоступен: не настроен Supabase." },
      { status: 500 }
    );
  }

  const {
    data: { user },
    error: userError
  } = await clients.sessionClient.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await clients.serviceClient
    .from("profiles")
    .select("name,credits")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Failed to load profile in generate GET route:", profileError);
    return NextResponse.json(
      { error: "Не удалось загрузить профиль пользователя." },
      { status: 500 }
    );
  }

  const credits =
    typeof profile?.credits === "number" && Number.isFinite(profile.credits)
      ? Math.max(0, Math.trunc(profile.credits))
      : 0;

  return NextResponse.json({
    name: typeof profile?.name === "string" ? profile.name : null,
    credits
  });
}

export async function POST(request: Request) {
  const clients = await createGenerateRouteClients();
  if (!clients) {
    return NextResponse.json(
      { error: "Сервис недоступен: не настроен Supabase." },
      { status: 500 }
    );
  }

  const {
    data: { user },
    error: userError
  } = await clients.sessionClient.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Необходимо войти в аккаунт, чтобы генерировать карусели." },
      { status: 401 }
    );
  }

  const { data: profile, error: profileError } = await clients.serviceClient
    .from("profiles")
    .select("credits")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Failed to load profile credits:", profileError);
    return NextResponse.json(
      { error: "Не удалось проверить баланс баллов. Попробуйте чуть позже." },
      { status: 500 }
    );
  }

  const initialCredits = Number(profile?.credits ?? 0);
  if (!Number.isFinite(initialCredits) || initialCredits <= 0) {
    return NextResponse.json(
      { error: "no_credits", message: "У тебя закончились баллы" },
      { status: 403 }
    );
  }

  const now = Date.now();
  const ip = getClientIp(request);
  const rateLimit = consumeGenerateSlot(ip, now);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Слишком много запросов на генерацию. Подождите ${rateLimit.retryAfterSeconds} сек. и попробуйте снова.`
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds)
        }
      }
    );
  }

  let body: {
    topic?: unknown;
    slidesCount?: unknown;
    slides?: unknown;
    niche?: unknown;
    audience?: unknown;
    tone?: unknown;
    goal?: unknown;
    format?: unknown;
    theme?: unknown;
    promptVariant?: unknown;
  };

  try {
    body = (await request.json()) as {
      topic?: unknown;
      slidesCount?: unknown;
      slides?: unknown;
      niche?: unknown;
      audience?: unknown;
      tone?: unknown;
      goal?: unknown;
      format?: unknown;
      theme?: unknown;
      promptVariant?: unknown;
    };
  } catch {
    return NextResponse.json(
      { error: "Некорректный формат запроса. Обновите страницу и попробуйте снова." },
      { status: 400 }
    );
  }

  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const slidesCount = clampSlidesCount(
    typeof body.slidesCount === "number"
      ? body.slidesCount
      : Number(body.slidesCount ?? body.slides)
  );
  const niche = typeof body.niche === "string" ? body.niche.trim().slice(0, 120) : "";
  const audience = typeof body.audience === "string" ? body.audience.trim().slice(0, 160) : "";
  const tone = typeof body.tone === "string" ? body.tone.trim().slice(0, 40) : "";
  const goal = typeof body.goal === "string" ? body.goal.trim().slice(0, 40) : "";
  const format = resolveFormat(body.format);
  const theme = resolveTheme(body.theme);
  const promptVariant = resolvePromptVariant(body.promptVariant);

  if (!topic) {
    return NextResponse.json({ error: "Введите тему карусели." }, { status: 400 });
  }

  if (topic.length < MIN_TOPIC_CHARS) {
    return NextResponse.json(
      { error: "Тема слишком короткая — добавьте 2–3 слова." },
      { status: 400 }
    );
  }

  if (topic.length > MAX_TOPIC_CHARS) {
    return NextResponse.json(
      { error: `Тема слишком длинная. Максимум ${MAX_TOPIC_CHARS} символов.` },
      { status: 400 }
    );
  }

  try {
    const timeoutMs = resolveGenerateTimeoutMs();
    const generationResult = await withTimeout(
      generateCarouselFromTopic(topic, slidesCount, {
        niche,
        audience,
        tone,
        goal,
        promptVariant
      }),
      timeoutMs
    );

    const slides = generationResult.slides;

    if (!isValidSlidesPayload(slides)) {
      return NextResponse.json(
        {
          error:
            "AI вернул некорректную структуру. Уточните тему или переформулируйте запрос и попробуйте снова."
        },
        { status: 502 }
      );
    }

    const { data: remainingCredits, error: consumeCreditError } = await clients.serviceClient.rpc(
      "consume_generation_credit",
      {
        p_user_id: user.id
      }
    );

    if (consumeCreditError) {
      console.error("Failed to consume generation credit:", consumeCreditError);
      return NextResponse.json(
        { error: "Не удалось списать балл за генерацию. Попробуйте снова." },
        { status: 500 }
      );
    }

    if (typeof remainingCredits !== "number") {
      return NextResponse.json(
        { error: "no_credits", message: "У тебя закончились баллы" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      slides,
      caption: generationResult.caption || "",
      generationSource: generationResult.generationSource,
      generationMeta: generationResult.generationMeta,
      fallbackReason: generationResult.fallbackReason,
      project: {
        title: projectTitleFromTopic(topic),
        topic,
        format,
        theme,
        promptVariant: generationResult.promptVariant,
        language: "ru",
        version: 1
      },
      remainingCredits: Math.max(0, Math.trunc(remainingCredits))
    });
  } catch (error) {
    if (error instanceof Error && error.name === "GenerateTimeoutError") {
      return NextResponse.json(
        { error: "Генерация заняла слишком много времени. Попробуйте короче сформулировать тему." },
        { status: 504 }
      );
    }

    console.error("Generate API failed:", error);

    return NextResponse.json(
      { error: "Не удалось сгенерировать. Попробуйте переформулировать тему или выберите другой тон." },
      { status: 500 }
    );
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return await new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const error = new Error("Generation timed out.");
      error.name = "GenerateTimeoutError";
      reject(error);
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function resolveGenerateTimeoutMs() {
  const raw = Number(process.env.GENERATE_TIMEOUT_MS);

  if (!Number.isFinite(raw)) {
    return DEFAULT_GENERATE_TIMEOUT_MS;
  }

  return Math.max(10000, Math.min(180000, Math.round(raw)));
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor
      .split(",")
      .map((value) => value.trim())
      .find(Boolean);

    if (first) {
      return first;
    }
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function consumeGenerateSlot(ip: string, now: number) {
  const maxRequests = resolveRateLimitMax();
  const windowMs = resolveRateLimitWindowMs();

  sweepRateLimit(now);

  const current = generateRateLimit.get(ip);
  if (!current || now >= current.resetAt) {
    generateRateLimit.set(ip, {
      count: 1,
      resetAt: now + windowMs
    });

    return {
      allowed: true,
      retryAfterSeconds: 0
    };
  }

  if (current.count >= maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));

    return {
      allowed: false,
      retryAfterSeconds
    };
  }

  current.count += 1;
  generateRateLimit.set(ip, current);

  return {
    allowed: true,
    retryAfterSeconds: 0
  };
}

function resolveRateLimitMax() {
  const raw = Number(process.env.GENERATE_RATE_LIMIT_MAX);

  if (!Number.isFinite(raw)) {
    return DEFAULT_RATE_LIMIT_MAX;
  }

  return Math.max(1, Math.min(200, Math.round(raw)));
}

function resolveRateLimitWindowMs() {
  const raw = Number(process.env.GENERATE_RATE_LIMIT_WINDOW_MS);

  if (!Number.isFinite(raw)) {
    return DEFAULT_RATE_LIMIT_WINDOW_MS;
  }

  return Math.max(5000, Math.min(10 * 60_000, Math.round(raw)));
}

function sweepRateLimit(now: number) {
  if (generateRateLimit.size < RATE_LIMIT_SWEEP_THRESHOLD) {
    return;
  }

  for (const [key, value] of generateRateLimit.entries()) {
    if (now >= value.resetAt) {
      generateRateLimit.delete(key);
    }
  }
}

function isValidSlidesPayload(slides: unknown): slides is CarouselOutlineSlide[] {
  if (!Array.isArray(slides) || slides.length < 8 || slides.length > 10) {
    return false;
  }

  return slides.every((slide) => {
    if (!slide || typeof slide !== "object") {
      return false;
    }

    const current = slide as Record<string, unknown>;
    const type = current.type;

    if (type === "hook" || type === "cta") {
      return isText(current.title, 4) && isText(current.subtitle, 8);
    }

    if (type === "problem" || type === "amplify") {
      return isText(current.title, 4) && isStringArray(current.bullets, 1);
    }

    if (type === "mistake" || type === "shift") {
      return (
        isText(current.title, 4) &&
        (isText(current.body, 8) || isText(current.text, 8) || isStringArray(current.bullets, 1))
      );
    }

    if (type === "consequence" || type === "solution") {
      return isStringArray(current.bullets, 1);
    }

    if (type === "example") {
      return isText(current.before, 4) && isText(current.after, 4);
    }

    return false;
  });
}

function resolveFormat(value: unknown): SlideFormat {
  return value === "1:1" || value === "4:5" || value === "9:16" ? value : "1:1";
}

function resolveTheme(value: unknown): CarouselTemplateId {
  return typeof value === "string" && TEMPLATE_ID_SET.has(value as CarouselTemplateId)
    ? (value as CarouselTemplateId)
    : "light";
}

function resolvePromptVariant(value: unknown): PromptVariant {
  if (value === "A" || value === "B") {
    return value;
  }

  return "B";
}

function projectTitleFromTopic(topic: string) {
  const normalized = topic.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Новая карусель";
  }

  return normalized.slice(0, 72);
}

function isText(value: unknown, minLength = 1) {
  return typeof value === "string" && value.trim().length >= minLength;
}

function isStringArray(value: unknown, minLength = 0) {
  return (
    Array.isArray(value) &&
    value.length >= minLength &&
    value.every((item) => typeof item === "string" && item.trim().length > 0)
  );
}

async function createGenerateRouteClients() {
  const config = getSupabasePublicConfig();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  if (!config || !serviceRoleKey) {
    return null;
  }

  const cookieStore = await cookies();
  const cookieAccessor: any = () => cookieStore;
  const sessionClient = createRouteHandlerClient(
    { cookies: cookieAccessor },
    {
      supabaseUrl: config.supabaseUrl,
      supabaseKey: config.supabaseKey
    }
  );
  const serviceClient = createClient(config.supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return {
    sessionClient,
    serviceClient
  };
}
