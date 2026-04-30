import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { clampSlidesCount } from "@/lib/slides";
import { generateCarouselFromTopic, type PromptVariant } from "@/lib/openai";
import { getSupabasePublicConfig } from "@/lib/supabase";
import {
  CAROUSEL_TEMPLATE_IDS,
  type CarouselOutlineSlide,
  type ContentMode,
  type ContentModeInput,
  type CarouselTemplateId,
  type SlideFormat
} from "@/types/editor";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_TOPIC_CHARS = 800;
const MIN_TOPIC_CHARS = 3;
const DEFAULT_GENERATE_TIMEOUT_MS = 90_000;
const DEFAULT_GENERATE_AUTO_TIMEOUT_MS = 90_000;
const DEFAULT_GENERATE_NON_SALES_TIMEOUT_MS = 90_000;
const DEFAULT_GENERATE_WITH_IMAGES_TIMEOUT_MS = 90_000;
const DEFAULT_GENERATE_WITH_IMAGES_AUTO_TIMEOUT_MS = 90_000;
const DEFAULT_GENERATE_WITH_IMAGES_NON_SALES_TIMEOUT_MS = 90_000;
const DEFAULT_GENERATE_QA_TIMEOUT_MS = 120_000;
const GENERATE_KEEP_ALIVE_INTERVAL_MS = 15_000;
const DEFAULT_IMAGE_MODEL_RESOLVE_TIMEOUT_MS = 8_000;
const DEFAULT_IMAGE_GENERATE_TIMEOUT_MS = 60_000;
const DEFAULT_IMAGE_GENERATE_QA_TIMEOUT_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX = 12;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_SWEEP_THRESHOLD = 5000;
const IMAGE_GENERATION_LOCK_SWEEP_THRESHOLD = 4000;
const DEFAULT_IMAGE_GENERATION_LOCK_TTL_MS = 60_000;
const GENERATE_QA_BYPASS_HEADER = "x-qa-generate-key";
const GENERATE_QA_BYPASS_HEADER_LEGACY = "x-generate-qa-key";
const IMAGE_MODEL_CANDIDATES = ["gpt-image-1.5", "gpt-image-1", "gpt-image-1-mini"] as const;
const TEMPLATE_ID_SET = new Set<CarouselTemplateId>(CAROUSEL_TEMPLATE_IDS);
const CONTENT_MODE_SET = new Set<ContentModeInput>([
  "auto",
  "sales",
  "expert",
  "instruction",
  "diagnostic",
  "case",
  "social"
]);

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type GenerationCreditsReason = "carousel_text" | "carousel_with_images";
type ImageSlideRole = "hook" | "mistake" | "example";
type CarouselOutlineSlideWithImage = CarouselOutlineSlide & {
  image?: string | null;
  hasImage?: boolean;
};
type GenerateRouteClients = {
  sessionClient: any;
  serviceClient: any;
};

const generateRateLimit = new Map<string, RateLimitBucket>();
const imageGenerationLocks = new Map<string, number>();

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
  const startTime = Date.now();
  const qaBypass = isQaBypassAuthorized(request);
  const clients = qaBypass ? null : await createGenerateRouteClients();
  let userId: string | null = null;
  let currentCredits = 0;

  if (!qaBypass) {
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

    userId = user.id;

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

    currentCredits = normalizeCredits(profile?.credits);
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
    withImages?: unknown;
    contentMode?: unknown;
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
      withImages?: unknown;
      contentMode?: unknown;
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
  const contentMode = resolveContentModeInput(body.contentMode);
  const withImages = body.withImages === true;
  const requiredCredits = withImages ? 5 : 1;

  if (!qaBypass && currentCredits < requiredCredits) {
    return NextResponse.json(
      {
        error: "no_credits",
        message: `Недостаточно кредитов. Нужно ${requiredCredits}, у вас ${currentCredits}.`,
        requiredCredits,
        currentCredits
      },
      { status: 403 }
    );
  }

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

  let imageGenerationLockKey: string | null = null;

  if (withImages) {
    const lockKey = userId ? `user:${userId}` : `ip:${ip}`;
    const lockResult = acquireImageGenerationLock(lockKey, Date.now());

    if (!lockResult.allowed) {
      return NextResponse.json(
        {
          error: "image_generation_busy",
          message: "У вас уже запущена генерация с фото. Дождитесь завершения текущей."
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(lockResult.retryAfterSeconds)
          }
        }
      );
    }

    imageGenerationLockKey = lockKey;
  }

  const timeoutMs = resolveGenerateTimeoutMs(withImages, contentMode, qaBypass);
  return createKeepAliveJsonResponse(async () => {
    try {
      const generationData = await (async () => {
        const generationResult = await withTimeout(
          generateCarouselFromTopic(topic, slidesCount, {
            niche,
            audience,
            tone,
            goal,
            promptVariant,
            contentMode
          }),
          timeoutMs,
          {
            errorName: "GenerateTimeoutError",
            errorMessage: "Text generation timed out."
          }
        );

        const slidesPayload: unknown = generationResult.slides;

        if (!isValidSlidesPayload(slidesPayload)) {
          console.error("Generate API returned invalid slides payload.", {
            reason: diagnoseSlidesPayload(slidesPayload),
            generationSource: generationResult.generationSource,
            generationMeta: generationResult.generationMeta,
            fallbackReason: generationResult.fallbackReason,
            slidesShape: Array.isArray(slidesPayload)
              ? slidesPayload.map((slide) => {
                  if (!slide || typeof slide !== "object") {
                    return { type: "invalid" };
                  }
                  const record = slide as Record<string, unknown>;
                  return {
                    type: typeof record.type === "string" ? record.type : null,
                    hasTitle: typeof record.title === "string" && record.title.trim().length > 0,
                    hasSubtitle: typeof record.subtitle === "string" && record.subtitle.trim().length > 0,
                    hasBody: typeof record.body === "string" && record.body.trim().length > 0,
                    hasText: typeof record.text === "string" && record.text.trim().length > 0,
                    bullets: Array.isArray(record.bullets) ? record.bullets.length : 0,
                    hasBefore: typeof record.before === "string" && record.before.trim().length > 0,
                    hasAfter: typeof record.after === "string" && record.after.trim().length > 0
                  };
                })
              : null
          });
          const payloadError = new Error("Generate API returned invalid slides payload.");
          payloadError.name = "GeneratePayloadValidationError";
          throw payloadError;
        }

        const slides: CarouselOutlineSlideWithImage[] = slidesPayload.map((slide) => ({
          ...slide,
          image: null,
          hasImage: false
        }));

        let imageModel: (typeof IMAGE_MODEL_CANDIDATES)[number] | null = null;
        let imagesGenerated = 0;

        if (withImages) {
          const imageClient = getOpenAiClient();
          const resolvedImageModel = await withTimeout(
            resolveImageModel(imageClient),
            resolveImageModelResolveTimeoutMs(qaBypass),
            {
              errorName: "ImageModelResolveTimeoutError",
              errorMessage: "Image model resolution timed out."
            }
          );
          imageModel = resolvedImageModel;

          const imageTargets = resolveImageTargets(slides);
          const imageTimeoutMs = resolveImageGenerateTimeoutMs(qaBypass);
          const imageTasks = imageTargets.map(async ({ index, role }) => {
            try {
              const image = await withTimeout(
                generateSlideImage({
                  client: imageClient,
                  model: resolvedImageModel,
                  slide: slides[index],
                  role,
                  topic,
                  niche,
                  mode: generationResult.generationProfile.modeEffective
                }),
                imageTimeoutMs,
                {
                  errorName: "ImageGenerateTimeoutError",
                  errorMessage: `Image generation timed out for ${role}.`
                }
              );
              return { index, image };
            } catch (imageError) {
              console.error(
                `Image generation failed for slide ${index + 1} (${role}) with timeout ${imageTimeoutMs}ms:`,
                imageError
              );
              return { index, image: null };
            }
          });

          const imageResults = await Promise.all(imageTasks);

          imageResults.forEach(({ index, image }) => {
            if (!image) {
              return;
            }

            slides[index] = {
              ...slides[index],
              image,
              hasImage: true
            };
            imagesGenerated += 1;
          });
        }

        return {
          generationResult,
          slides,
          imageModel,
          imagesGenerated
        };
      })();

    const { generationResult, slides, imageModel, imagesGenerated } = generationData;
    const creditsToCharge = withImages && imagesGenerated === 0 ? 1 : withImages ? 5 : 1;
    const creditsReason: GenerationCreditsReason =
      creditsToCharge >= 5 ? "carousel_with_images" : "carousel_text";
    let remainingCredits: number | null = null;
    const creditsCharged = qaBypass ? 0 : creditsToCharge;
    const generationProfile = {
      ...generationResult.generationProfile,
      model: generationResult.generationMeta.model
    };

    if (!qaBypass) {
      if (!clients || !userId) {
        return { error: "Сервис недоступен: не удалось определить пользователя." };
      }

      const creditsResult = await consumeGenerationCredits({
        clients,
        userId,
        amount: creditsToCharge,
        reason: creditsReason
      });

      if (!creditsResult.ok) {
        if (creditsResult.code === "no_credits") {
          return {
            error: "no_credits",
            message: `Недостаточно кредитов. Нужно ${creditsToCharge}, у вас ${creditsResult.currentCredits}.`,
            requiredCredits: creditsToCharge,
            currentCredits: creditsResult.currentCredits
          };
        }

        return { error: creditsResult.message };
      }

      remainingCredits = creditsResult.remainingCredits;
    }

    console.log("[generation-profile]", JSON.stringify({
      topic: topic.slice(0, 80),
      modeDetected: generationProfile.modeDetected,
      modeEffective: generationProfile.modeEffective,
      modeSource: generationProfile.modeSource,
      modeConfidence: generationProfile.modeConfidence,
      flowTemplate: generationProfile.flowTemplate,
      ctaType: generationProfile.ctaType,
      firstSlideRepairs: generationProfile.firstSlideRepairs,
      toneViolations: generationProfile.toneViolations,
      model: generationProfile.model,
      creditsCharged,
      durationMs: Date.now() - startTime
    }));

    return {
      slides: slides.map((slide) => ({
        ...slide,
        image: typeof slide.image === "string" && slide.image.trim() ? slide.image : null,
        hasImage: slide.hasImage === true
      })),
      caption: generationResult.caption || "",
      generationSource: generationResult.generationSource,
      generationMeta: {
        ...generationResult.generationMeta,
        imageModel: withImages ? imageModel : null,
        imagesGenerated: withImages ? imagesGenerated : 0,
        creditsCharged
      },
      generationProfile,
      withImages,
      fallbackReason: generationResult.fallbackReason,
      project: {
        title: projectTitleFromTopic(topic),
        topic,
        format,
        theme,
        promptVariant: generationResult.promptVariant,
        contentMode: generationResult.generationProfile.modeEffective,
        language: "ru",
        version: 1
      },
      remainingCredits:
        typeof remainingCredits === "number" ? Math.max(0, Math.trunc(remainingCredits)) : null,
      qaBypass
    };
  } catch (error) {
    if (error instanceof Error && error.name === "GeneratePayloadValidationError") {
      return {
        error:
          "AI вернул некорректную структуру. Уточните тему или переформулируйте запрос и попробуйте снова."
      };
    }

    if (
      error instanceof Error &&
      (error.name === "GenerateTimeoutError" || error.name === "ImageModelResolveTimeoutError")
    ) {
      return {
        error: withImages
          ? "Генерация с фото заняла слишком много времени. Попробуйте снова или временно переключитесь в режим «Текст»."
          : "Генерация заняла слишком много времени. Попробуйте короче сформулировать тему."
      };
    }

    console.error("Generate API failed:", error);

    return { error: "Не удалось сгенерировать. Попробуйте переформулировать тему или выберите другой тон." };
  } finally {
    if (imageGenerationLockKey) {
      releaseImageGenerationLock(imageGenerationLockKey);
    }
  }
  });
}

function createKeepAliveJsonResponse(resolveBody: () => Promise<unknown>) {
  const encoder = new TextEncoder();
  let keepAliveId: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (value: string) => {
        controller.enqueue(encoder.encode(value));
      };

      keepAliveId = setInterval(() => {
        enqueue(" \n");
      }, GENERATE_KEEP_ALIVE_INTERVAL_MS);

      enqueue(" \n");

      try {
        const body = await resolveBody();
        enqueue(JSON.stringify(body));
      } catch (error) {
        console.error("Generate keep-alive response failed:", error);
        enqueue(JSON.stringify({ error: "Не удалось сгенерировать. Попробуйте ещё раз." }));
      } finally {
        if (keepAliveId) {
          clearInterval(keepAliveId);
          keepAliveId = null;
        }
        controller.close();
      }
    },
    cancel() {
      if (keepAliveId) {
        clearInterval(keepAliveId);
        keepAliveId = null;
      }
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no"
    }
  });
}

function isQaBypassAuthorized(request: Request) {
  const configuredKey = (process.env.GENERATE_QA_BYPASS_KEY ?? "").trim();
  if (!configuredKey) {
    return false;
  }

  const providedKey =
    request.headers.get(GENERATE_QA_BYPASS_HEADER)?.trim() ||
    request.headers.get(GENERATE_QA_BYPASS_HEADER_LEGACY)?.trim() ||
    "";

  if (!providedKey) {
    return false;
  }

  return safeSecretCompare(configuredKey, providedKey);
}

function safeSecretCompare(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  options?: { errorName?: string; errorMessage?: string }
) {
  return await new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const error = new Error(options?.errorMessage ?? "Generation timed out.");
      error.name = options?.errorName ?? "GenerateTimeoutError";
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

function resolveImageModelResolveTimeoutMs(qaBypass = false) {
  const raw = Number(
    qaBypass
      ? process.env.GENERATE_QA_IMAGE_MODEL_TIMEOUT_MS ?? process.env.GENERATE_IMAGE_MODEL_TIMEOUT_MS
      : process.env.GENERATE_IMAGE_MODEL_TIMEOUT_MS
  );

  if (!Number.isFinite(raw)) {
    return DEFAULT_IMAGE_MODEL_RESOLVE_TIMEOUT_MS;
  }

  return Math.max(4000, Math.min(60_000, Math.round(raw)));
}

function resolveImageGenerateTimeoutMs(qaBypass = false) {
  const raw = Number(
    qaBypass
      ? process.env.GENERATE_QA_IMAGE_TIMEOUT_MS ?? process.env.GENERATE_IMAGE_TIMEOUT_MS
      : process.env.GENERATE_IMAGE_TIMEOUT_MS
  );
  const fallback = qaBypass
    ? DEFAULT_IMAGE_GENERATE_QA_TIMEOUT_MS
    : DEFAULT_IMAGE_GENERATE_TIMEOUT_MS;

  if (!Number.isFinite(raw)) {
    return fallback;
  }

  return Math.max(60_000, Math.min(120_000, Math.round(raw)));
}

function resolveGenerateTimeoutMs(
  withImages: boolean,
  contentMode: ContentModeInput,
  qaBypass = false
) {
  if (qaBypass) {
    const qaRaw = Number(process.env.GENERATE_QA_TIMEOUT_MS);
    if (Number.isFinite(qaRaw)) {
      return Math.max(10000, Math.min(300000, Math.round(qaRaw)));
    }

    return DEFAULT_GENERATE_QA_TIMEOUT_MS;
  }

  const mode = resolveContentModeInput(contentMode);
  const isNonSales = mode !== "auto" && mode !== "sales";
  const isAuto = mode === "auto";
  const raw = Number(
    withImages
      ? isNonSales
        ? process.env.GENERATE_WITH_IMAGES_NON_SALES_TIMEOUT_MS ??
          process.env.GENERATE_WITH_IMAGES_TIMEOUT_MS ??
          process.env.GENERATE_TIMEOUT_MS
        : isAuto
          ? process.env.GENERATE_WITH_IMAGES_AUTO_TIMEOUT_MS ??
            process.env.GENERATE_WITH_IMAGES_TIMEOUT_MS ??
            process.env.GENERATE_TIMEOUT_MS
          : process.env.GENERATE_WITH_IMAGES_TIMEOUT_MS ?? process.env.GENERATE_TIMEOUT_MS
      : isNonSales
        ? process.env.GENERATE_NON_SALES_TIMEOUT_MS ?? process.env.GENERATE_TIMEOUT_MS
        : isAuto
          ? process.env.GENERATE_AUTO_TIMEOUT_MS ?? process.env.GENERATE_TIMEOUT_MS
          : process.env.GENERATE_TIMEOUT_MS
  );

  const fallback = withImages
    ? isNonSales
      ? DEFAULT_GENERATE_WITH_IMAGES_NON_SALES_TIMEOUT_MS
      : isAuto
        ? DEFAULT_GENERATE_WITH_IMAGES_AUTO_TIMEOUT_MS
        : DEFAULT_GENERATE_WITH_IMAGES_TIMEOUT_MS
    : isNonSales
      ? DEFAULT_GENERATE_NON_SALES_TIMEOUT_MS
      : isAuto
        ? DEFAULT_GENERATE_AUTO_TIMEOUT_MS
        : DEFAULT_GENERATE_TIMEOUT_MS;

  if (!Number.isFinite(raw)) {
    return fallback;
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

function resolveImageGenerationLockTtlMs() {
  const raw = Number(process.env.GENERATE_IMAGE_LOCK_TTL_MS);

  if (!Number.isFinite(raw)) {
    return DEFAULT_IMAGE_GENERATION_LOCK_TTL_MS;
  }

  return Math.max(10_000, Math.min(300_000, Math.round(raw)));
}

function sweepImageGenerationLocks(now: number) {
  if (imageGenerationLocks.size < IMAGE_GENERATION_LOCK_SWEEP_THRESHOLD) {
    return;
  }

  for (const [key, expiresAt] of imageGenerationLocks.entries()) {
    if (now >= expiresAt) {
      imageGenerationLocks.delete(key);
    }
  }
}

function acquireImageGenerationLock(key: string, now: number) {
  sweepImageGenerationLocks(now);

  const expiresAt = imageGenerationLocks.get(key);
  if (typeof expiresAt === "number" && expiresAt > now) {
    return {
      allowed: false as const,
      retryAfterSeconds: Math.max(1, Math.ceil((expiresAt - now) / 1000))
    };
  }

  const ttlMs = resolveImageGenerationLockTtlMs();
  imageGenerationLocks.set(key, now + ttlMs);

  return {
    allowed: true as const,
    retryAfterSeconds: 0
  };
}

function releaseImageGenerationLock(key: string) {
  imageGenerationLocks.delete(key);
}

let openAiClient: OpenAI | null = null;

function getOpenAiClient() {
  if (!openAiClient) {
    openAiClient = new OpenAI();
  }

  return openAiClient;
}

async function resolveImageModel(client: OpenAI): Promise<(typeof IMAGE_MODEL_CANDIDATES)[number]> {
  for (const model of IMAGE_MODEL_CANDIDATES) {
    try {
      await client.models.retrieve(model);
      return model;
    } catch (error) {
      if (isModelUnavailableError(error)) {
        continue;
      }

      console.warn(`Failed to verify image model "${model}". Trying fallback.`, error);
    }
  }

  return IMAGE_MODEL_CANDIDATES[0];
}

function resolveImageTargets(slides: CarouselOutlineSlide[]) {
  const rolePriority: ImageSlideRole[] = ["hook", "mistake", "example"];

  return rolePriority
    .map((role) => ({
      role,
      index: slides.findIndex((slide) => slide.type === role)
    }))
    .filter(
      (target): target is { role: ImageSlideRole; index: number } =>
        Number.isInteger(target.index) && target.index >= 0
    );
}

async function generateSlideImage(options: {
  client: OpenAI;
  model: (typeof IMAGE_MODEL_CANDIDATES)[number];
  slide: CarouselOutlineSlide;
  role: ImageSlideRole;
  topic: string;
  niche: string;
  mode: ContentMode;
}) {
  const { client, model, slide, role, topic, niche, mode } = options;
  const slideTitle = getOutlineSlideTitle(slide);
  const slideBody = getOutlineSlideBody(slide);
  const imagePrompt = buildImagePrompt({
    slideTitle,
    slideBody,
    slideRole: role,
    topic,
    niche: niche || undefined,
    mode
  });

  const result = await client.images.generate({
    model,
    prompt: imagePrompt,
    size: "1024x1024",
    quality: "medium",
    output_format: "jpeg",
    output_compression: 70,
    n: 1
  });

  const imageBase64 = result.data?.[0]?.b64_json;
  if (!isText(imageBase64, 16)) {
    throw new Error("Image API returned empty b64_json payload.");
  }

  return imageBase64;
}

function buildImagePrompt(input: {
  slideTitle: string;
  slideBody: string;
  slideRole: ImageSlideRole;
  topic: string;
  niche?: string;
  mode: ContentMode;
}) {
  const { slideTitle, slideBody, slideRole, topic, niche, mode } = input;
  const nicheContext = niche ? `Ниша: ${niche}.` : "";
  const bodyContext = slideBody ? `Текст слайда: "${slideBody}".` : "";
  const modeContext =
    mode === "sales"
      ? "Режим: sales. Можно больше напряжения, контраста и коммерческого контекста."
      : "Режим: non-sales. Фото спокойное, экспертное, без давления, страха и чрезмерной драматизации.";

  const styleByRole: Record<ImageSlideRole, string> = {
    hook: `
Создай привлекательное фото для обложки Instagram-карусели.
Тема: "${topic}". ${nicheContext}
${modeContext}
Заголовок слайда: "${slideTitle}".
${bodyContext}

Требования:
- Стиль: профессиональная фотография, уровень бизнес-журнала
- Ракурс: портрет или средний план
- Освещение: мягкое, естественное, теплое
- Фон: нейтральный или в тему ниши, можно легкое боке
- Человек: уверенный профессионал, экспертный образ
- Одежда: деловой casual
- Настроение: доверие, компетентность
- Без текста на изображении
- Без логотипов и водяных знаков
- Квадратный формат, Instagram-ready
- Оставь больше свободного места сверху и снизу под текст
`,
    mistake: `
Создай фото для слайда про типичную ошибку в Instagram-карусели.
Тема: "${topic}". ${nicheContext}
${modeContext}
Заголовок слайда: "${slideTitle}".
${bodyContext}

Требования:
- Стиль: эмоциональный кадр с эффектом "это про меня"
- Сцена: рабочая обстановка, человек задумчивый или слегка фрустрированный
- Без агрессии и негатива, акцент на упущенной возможности
- Освещение: контрастное, немного драматичное
- Фон: офис, рабочее место или нейтральная среда
- Без текста на изображении
- Без логотипов и водяных знаков
- Квадратный формат
- Оставь свободную зону для текста поверх фото
`,
    example: `
Создай фото для слайда с кейсом/примером в Instagram-карусели.
Тема: "${topic}". ${nicheContext}
${modeContext}
Заголовок слайда: "${slideTitle}".
${bodyContext}

Требования:
- Стиль: позитивный, про результат и рост
- Сцена: показать итог или процесс получения результата
- Человек: довольный, демонстрирует результат или рабочий процесс
- Освещение: светлое, позитивное
- Фон: рабочая обстановка в тему ниши
- Без текста на изображении
- Без логотипов и водяных знаков
- Квадратный формат
- Оставь место под подпись "До/После"
`
  };

  return styleByRole[slideRole];
}

function getOutlineSlideTitle(slide: CarouselOutlineSlide) {
  switch (slide.type) {
    case "hook":
    case "problem":
    case "amplify":
    case "mistake":
    case "shift":
    case "cta":
      return slide.title;
    case "consequence":
    case "solution":
      return slide.title?.trim() || slide.bullets[0] || "Ключевая мысль";
    case "example":
      return slide.before;
    default:
      return "Ключевая мысль";
  }
}

function getOutlineSlideBody(slide: CarouselOutlineSlide) {
  switch (slide.type) {
    case "hook":
    case "cta":
      return slide.subtitle;
    case "problem":
    case "amplify":
    case "consequence":
    case "solution":
      return slide.bullets.join(" ");
    case "mistake":
    case "shift":
      return slide.body?.trim() || "";
    case "example":
      return `До: ${slide.before}. После: ${slide.after}.`;
    default:
      return "";
  }
}

function isModelUnavailableError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const status = Number((error as { status?: unknown }).status ?? NaN);
  const code = String((error as { code?: unknown }).code ?? "");
  const message = String((error as { message?: unknown }).message ?? "").toLowerCase();

  return (
    status === 400 ||
    status === 403 ||
    status === 404 ||
    code.toLowerCase().includes("model") ||
    message.includes("model") ||
    message.includes("access")
  );
}

async function consumeGenerationCredits(params: {
  clients: GenerateRouteClients;
  userId: string;
  amount: number;
  reason: GenerationCreditsReason;
}) {
  const { clients, userId, amount, reason } = params;
  const creditsToCharge = Math.max(1, Math.trunc(amount));
  const maxAttempts = 4;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { data: profile, error: profileError } = await clients.serviceClient
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Failed to load profile before credits consume:", profileError);
      return {
        ok: false as const,
        code: "failed" as const,
        message: "Не удалось списать кредиты за генерацию. Попробуйте снова."
      };
    }

    if (!profile) {
      return {
        ok: false as const,
        code: "failed" as const,
        message: "Профиль пользователя не найден."
      };
    }

    const availableCredits = normalizeCredits(profile.credits);
    if (availableCredits < creditsToCharge) {
      return {
        ok: false as const,
        code: "no_credits" as const,
        currentCredits: availableCredits
      };
    }

    const nextCredits = availableCredits - creditsToCharge;
    const { data: updatedProfile, error: updateError } = await clients.serviceClient
      .from("profiles")
      .update({ credits: nextCredits })
      .eq("id", userId)
      .eq("credits", availableCredits)
      .select("credits")
      .maybeSingle();

    if (updateError) {
      console.error("Failed to update credits balance:", updateError);
      return {
        ok: false as const,
        code: "failed" as const,
        message: "Не удалось списать кредиты за генерацию. Попробуйте снова."
      };
    }

    if (!updatedProfile) {
      continue;
    }

    const { error: logError } = await clients.serviceClient.from("credits_log").insert({
      user_id: userId,
      amount: -creditsToCharge,
      reason
    });

    if (logError) {
      console.error("Failed to write generation credits log:", logError);

      const { error: rollbackError } = await clients.serviceClient
        .from("profiles")
        .update({ credits: availableCredits })
        .eq("id", userId)
        .eq("credits", nextCredits);

      if (rollbackError) {
        console.error("Failed to rollback credits after credits_log insert error:", rollbackError);
      }

      return {
        ok: false as const,
        code: "failed" as const,
        message: "Не удалось записать историю списания кредитов."
      };
    }

    return {
      ok: true as const,
      remainingCredits: normalizeCredits(updatedProfile.credits)
    };
  }

  return {
    ok: false as const,
    code: "failed" as const,
    message: "Не удалось списать кредиты из-за параллельной генерации. Попробуйте снова."
  };
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

function diagnoseSlidesPayload(slides: unknown) {
  if (!Array.isArray(slides)) {
    return "slides is not an array";
  }

  if (slides.length < 8 || slides.length > 10) {
    return `slides length is ${slides.length}`;
  }

  for (let index = 0; index < slides.length; index += 1) {
    const slide = slides[index];
    if (!slide || typeof slide !== "object") {
      return `slide ${index + 1} is not an object`;
    }

    const current = slide as Record<string, unknown>;
    const type = current.type;

    if (type === "hook" || type === "cta") {
      if (!isText(current.title, 4)) {
        return `slide ${index + 1} (${String(type)}): invalid title`;
      }
      if (!isText(current.subtitle, 8)) {
        return `slide ${index + 1} (${String(type)}): invalid subtitle`;
      }
      continue;
    }

    if (type === "problem" || type === "amplify") {
      if (!isText(current.title, 4)) {
        return `slide ${index + 1} (${String(type)}): invalid title`;
      }
      if (!isStringArray(current.bullets, 1)) {
        return `slide ${index + 1} (${String(type)}): invalid bullets`;
      }
      continue;
    }

    if (type === "mistake" || type === "shift") {
      if (!isText(current.title, 4)) {
        return `slide ${index + 1} (${String(type)}): invalid title`;
      }
      if (!(isText(current.body, 8) || isText(current.text, 8) || isStringArray(current.bullets, 1))) {
        return `slide ${index + 1} (${String(type)}): missing body/text/bullets`;
      }
      continue;
    }

    if (type === "consequence" || type === "solution") {
      if (!isStringArray(current.bullets, 1)) {
        return `slide ${index + 1} (${String(type)}): invalid bullets`;
      }
      continue;
    }

    if (type === "example") {
      if (!isText(current.before, 4) || !isText(current.after, 4)) {
        return `slide ${index + 1} (example): invalid before/after`;
      }
      continue;
    }

    return `slide ${index + 1}: unknown type "${String(type)}"`;
  }

  return "unknown validation failure";
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

function resolveContentModeInput(value: unknown): ContentModeInput {
  if (typeof value !== "string") {
    return "auto";
  }

  const normalized = value.trim().toLowerCase() as ContentModeInput;
  if (!normalized) {
    return "auto";
  }

  return CONTENT_MODE_SET.has(normalized) ? normalized : "auto";
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

function normalizeCredits(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.trunc(numeric));
}

async function createGenerateRouteClients(): Promise<GenerateRouteClients | null> {
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
