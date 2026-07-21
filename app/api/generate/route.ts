import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { clampSlidesCount, MAX_TOPIC_CHARS } from "@/lib/slides";
import {
  generateCarouselFromTopic,
  generateFallbackCarouselFromTopic,
  type PromptVariant
} from "@/lib/generation/engine";
import { getSupabasePublicConfig } from "@/lib/supabase";
import { deductCredits, normalizeCredits } from "@/lib/generation/credits";
import { generateImageViaFal, isFalImageConfigured } from "@/lib/generation/fal-image";
import {
  consumeGenerateSlot,
  acquireImageGenerationLock,
  releaseImageGenerationLock,
  getClientIp
} from "@/lib/generation/rate-limit";
import {
  CAROUSEL_TEMPLATE_IDS,
  type CarouselOutlineSlide,
  type ContentMode,
  type ContentModeInput,
  type CarouselTemplateId,
  type SlideFormat
} from "@/types/editor";
import type {
  AppDatabase,
  AppRouteSupabaseClient,
  AppServiceSupabaseClient
} from "@/types/supabase";

export const runtime = "nodejs";
export const maxDuration = 120;

const DEFAULT_GENERATE_TIMEOUT_MS = 90_000;
const DEFAULT_GENERATE_AUTO_TIMEOUT_MS = 90_000;
const DEFAULT_GENERATE_NON_SALES_TIMEOUT_MS = 90_000;
const DEFAULT_GENERATE_WITH_IMAGES_TIMEOUT_MS = 32_000;
const DEFAULT_GENERATE_WITH_IMAGES_AUTO_TIMEOUT_MS = 32_000;
const DEFAULT_GENERATE_WITH_IMAGES_NON_SALES_TIMEOUT_MS = 32_000;
const DEFAULT_GENERATE_QA_TIMEOUT_MS = 120_000;
const GENERATE_KEEP_ALIVE_INTERVAL_MS = 15_000;
const DEFAULT_IMAGE_MODEL_RESOLVE_TIMEOUT_MS = 6_000;
const DEFAULT_IMAGE_GENERATE_TIMEOUT_MS = 72_000;
const DEFAULT_IMAGE_GENERATE_QA_TIMEOUT_MS = 80_000;
const DEFAULT_IMAGE_MODEL_CACHE_TTL_MS = 60 * 60 * 1000;
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

type ImageSlideRole = CarouselOutlineSlide["type"];
type ImageTargetKind = "cover" | "middle" | "final";
type CarouselOutlineSlideWithImage = CarouselOutlineSlide & {
  image?: string | null;
  hasImage?: boolean;
};
type GenerateRouteClients = {
  sessionClient: AppRouteSupabaseClient;
  serviceClient: AppServiceSupabaseClient;
};

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
  const requestedSlidesCount = resolveRequestedSlidesCount(body.slidesCount ?? body.slides);
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
        const generationOptions = {
            niche,
            audience,
            tone,
            goal,
            promptVariant,
            contentMode,
            requestTimeoutMs: resolveTextRequestTimeoutMs(timeoutMs, withImages)
          };
        let generationResult: Awaited<ReturnType<typeof generateCarouselFromTopic>>;

        try {
          generationResult = await withTimeout(
            generateCarouselFromTopic(topic, requestedSlidesCount, generationOptions),
            timeoutMs,
            {
              errorName: "GenerateTimeoutError",
              errorMessage: "Text generation timed out."
            }
          );
        } catch (generationError) {
          if (!isTimeoutError(generationError)) {
            throw generationError;
          }

          console.warn(
            "[WARN] Text generation timed out; using deterministic fallback slides.",
            generationError
          );
          generationResult = generateFallbackCarouselFromTopic(
            topic,
            requestedSlidesCount,
            generationOptions,
            generationError
          );
        }

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
          const resolvedImageModel = await resolveImageModelWithFallback(imageClient, qaBypass);
          imageModel = resolvedImageModel;

          const imageTargets = resolveImageTargets(slides);
          const imageTimeoutMs = resolveImageGenerateTimeoutMs(qaBypass);
          const imageTasks = imageTargets.map(async ({ index, role, kind }) => {
            try {
              const image = await withTimeout(
                generateSlideImage({
                  client: imageClient,
                  model: resolvedImageModel,
                  slide: slides[index],
                  role,
                  targetKind: kind,
                  topic,
                  niche,
                  mode: generationResult.generationProfile.modeEffective,
                  timeoutMs: imageTimeoutMs
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
    const creditsReason =
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

      const creditsResult = await deductCredits({
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

    if (process.env.NODE_ENV !== "production") {
      console.info("[generation-profile]", JSON.stringify({
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
    }

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

function isTimeoutError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /\btimeout\b|timed out|time out|deadline|abort/i.test(
    `${error.name} ${error.message}`
  );
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

  return Math.max(60_000, Math.min(95_000, Math.round(raw)));
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

function resolveTextRequestTimeoutMs(routeTimeoutMs: number, withImages: boolean) {
  const availableMs = Math.max(8_000, Math.round(routeTimeoutMs - 4_000));
  const capMs = withImages ? 28_000 : 82_000;

  return Math.min(capMs, availableMs);
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

let cachedImageModel: {
  model: (typeof IMAGE_MODEL_CANDIDATES)[number];
  expiresAt: number;
} | null = null;

function resolveImageModelCacheTtlMs(qaBypass: boolean) {
  if (qaBypass) {
    return 5 * 60 * 1000;
  }

  const raw = Number(process.env.GENERATE_IMAGE_MODEL_CACHE_TTL_MS);
  if (!Number.isFinite(raw)) {
    return DEFAULT_IMAGE_MODEL_CACHE_TTL_MS;
  }

  return Math.max(60_000, Math.min(24 * 60 * 60 * 1000, Math.round(raw)));
}

async function resolveImageModelWithFallback(client: OpenAI, qaBypass: boolean) {
  const now = Date.now();
  if (cachedImageModel && cachedImageModel.expiresAt > now) {
    return cachedImageModel.model;
  }

  try {
    const model = await withTimeout(
      resolveImageModel(client),
      resolveImageModelResolveTimeoutMs(qaBypass),
      {
        errorName: "ImageModelResolveTimeoutError",
        errorMessage: "Image model resolution timed out."
      }
    );
    cachedImageModel = {
      model,
      expiresAt: now + resolveImageModelCacheTtlMs(qaBypass)
    };
    return model;
  } catch (error) {
    console.warn(
      "[WARN] Image model resolution failed; using default image model.",
      error
    );
    const fallbackModel = IMAGE_MODEL_CANDIDATES[0];
    cachedImageModel = {
      model: fallbackModel,
      expiresAt: now + Math.min(resolveImageModelCacheTtlMs(qaBypass), 10 * 60 * 1000)
    };
    return fallbackModel;
  }
}

function resolveImageTargets(slides: CarouselOutlineSlide[]) {
  const middleIndex = Math.floor((slides.length - 1) / 2);
  const candidates: Array<{ kind: ImageTargetKind; index: number }> = [
    { kind: "cover", index: 0 },
    { kind: "middle", index: middleIndex },
    { kind: "final", index: slides.length - 1 }
  ];
  const seen = new Set<number>();

  return candidates
    .filter((target) => Number.isInteger(target.index) && target.index >= 0 && target.index < slides.length)
    .filter((target) => {
      if (seen.has(target.index)) {
        return false;
      }
      seen.add(target.index);
      return true;
    })
    .map((target) => ({
      ...target,
      role: slides[target.index].type
    }));
}

async function generateSlideImage(options: {
  client: OpenAI;
  model: (typeof IMAGE_MODEL_CANDIDATES)[number];
  slide: CarouselOutlineSlide;
  role: ImageSlideRole;
  targetKind: ImageTargetKind;
  topic: string;
  niche: string;
  mode: ContentMode;
  timeoutMs: number;
}) {
  const { client, model, slide, role, targetKind, topic, niche, mode, timeoutMs } = options;
  const slideTitle = getOutlineSlideTitle(slide);
  const slideBody = getOutlineSlideBody(slide);
  const imagePrompt = buildImagePrompt({
    slideTitle,
    slideBody,
    slideRole: role,
    targetKind,
    topic,
    niche: niche || undefined,
    mode
  });

  // Основной провайдер картинок — fal GPT Image 2 (лучший рендер текста и
  // адхеренс промпта). При ошибке/отсутствии ключа падаем на OpenAI gpt-image,
  // чтобы генерация карусели никогда не ломалась из-за картинок.
  if (isFalImageConfigured()) {
    try {
      return await generateImageViaFal({ prompt: imagePrompt });
    } catch (falError) {
      console.warn(
        "fal GPT Image 2 failed; falling back to OpenAI image model.",
        falError
      );
    }
  }

  const result = await client.images.generate(
    {
      model,
      prompt: imagePrompt,
      size: "1024x1024",
      quality: "medium",
      output_format: "jpeg",
      output_compression: 70,
      n: 1
    },
    {
      timeout: timeoutMs
    }
  );

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
  targetKind: ImageTargetKind;
  topic: string;
  niche?: string;
  mode: ContentMode;
}) {
  const { slideTitle, slideBody, slideRole, targetKind, topic, niche, mode } = input;
  const nicheContext = niche ? `Ниша: ${niche}.` : "";
  const bodyContext = slideBody ? `Текст слайда: "${slideBody}".` : "";
  const modeContext =
    mode === "sales"
      ? "Режим: sales. Можно больше напряжения, контраста и коммерческого контекста."
      : "Режим: non-sales. Фото спокойное, экспертное, без давления, страха и чрезмерной драматизации.";

  const styleByKind: Record<ImageTargetKind, string> = {
    cover: `
Создай фото для обложки Instagram-карусели.
Тема: "${topic}". ${nicheContext}
${modeContext}
Роль слайда: ${slideRole}.
Заголовок слайда: "${slideTitle}".
${bodyContext}

Требования:
- Стиль: профессиональная фотография, уровень бизнес-журнала
- Сюжет: понятная сцена из темы, а не абстрактный фон
- Ракурс: портрет, средний план или рабочая сцена
- Освещение: мягкое, естественное, теплое
- Фон: нейтральный или в тему ниши
- Человек: уверенный профессионал, экспертный образ
- Одежда: деловой casual
- Настроение: доверие, компетентность
- Без текста на изображении
- Без логотипов и водяных знаков
- Квадратный формат, Instagram-ready
- Оставь свободное место сверху и снизу под текст
`,
    middle: `
Создай фото для смыслового среднего слайда Instagram-карусели.
Тема: "${topic}". ${nicheContext}
${modeContext}
Роль слайда: ${slideRole}.
Заголовок слайда: "${slideTitle}".
${bodyContext}

Требования:
- Стиль: реалистичная профессиональная фотография
- Сцена: визуально объясни идею слайда через действие, объект или рабочий процесс
- Эмоция: спокойное узнавание проблемы или момента решения, без агрессии
- Освещение: мягкое, с достаточным контрастом
- Фон: место, связанное с нишей или темой
- Без текста на изображении
- Без логотипов и водяных знаков
- Квадратный формат
- Оставь свободную зону для текста поверх фото
`,
    final: `
Создай фото для финального слайда Instagram-карусели.
Тема: "${topic}". ${nicheContext}
${modeContext}
Роль слайда: ${slideRole}.
Заголовок слайда: "${slideTitle}".
${bodyContext}

Требования:
- Стиль: позитивный и чистый, про вывод, результат или следующий шаг
- Сцена: показать итог, ясное решение или спокойное действие после прочтения
- Человек: уверенный, собранный, в рабочем контексте
- Освещение: светлое, позитивное
- Фон: рабочая обстановка в тему ниши
- Без текста на изображении
- Без логотипов и водяных знаков
- Квадратный формат
- Оставь чистую зону под CTA или короткий вывод
`
  };

  return styleByKind[targetKind];
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

function isValidSlidesPayload(slides: unknown): slides is CarouselOutlineSlide[] {
  return getSlidesPayloadIssue(slides) === null;
}

function diagnoseSlidesPayload(slides: unknown) {
  return getSlidesPayloadIssue(slides) ?? "valid slides payload";
}

function getSlidesPayloadIssue(slides: unknown) {
  if (!Array.isArray(slides)) {
    return "slides is not an array";
  }

  if (slides.length < 6 || slides.length > 10) {
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

  return null;
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

function resolveRequestedSlidesCount(value: unknown) {
  if (value === undefined || value === null || value === "" || value === "auto") {
    return undefined;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }

  return clampSlidesCount(numeric);
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

async function createGenerateRouteClients(): Promise<GenerateRouteClients | null> {
  const config = getSupabasePublicConfig();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  if (!config || !serviceRoleKey) {
    return null;
  }

  const cookieStore = await cookies();
  const cookieAccessor = (() => cookieStore) as unknown as () => ReturnType<typeof cookies>;
  const sessionClient = createRouteHandlerClient<AppDatabase>(
    { cookies: cookieAccessor },
    {
      supabaseUrl: config.supabaseUrl,
      supabaseKey: config.supabaseKey
    }
  );
  const serviceClient = createClient<AppDatabase>(config.supabaseUrl, serviceRoleKey, {
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
