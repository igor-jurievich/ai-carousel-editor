import { NextResponse } from "next/server";
import { clampSlidesCount, generateCarouselFromTopic } from "@/lib/openai";
import { findInternetImagesForCarousel } from "@/lib/internet-images";
import type { CarouselOutlineSlide, CarouselSlideRole } from "@/types/editor";

export const runtime = "nodejs";

const MAX_TOPIC_CHARS = 4000;
const MIN_TOPIC_CHARS = 3;
const DEFAULT_GENERATE_TIMEOUT_MS = 70000;
const DEFAULT_RATE_LIMIT_MAX = 12;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_SWEEP_THRESHOLD = 5000;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type PainModelPayload = {
  pain: string;
  wrongAction: string;
  consequence: string;
  desiredOutcome: string;
  emotionalState: string;
};

type GenerationPayloadDiagnostics = {
  isValid: boolean;
  qualityScore: number;
  flags: {
    hasHook: boolean;
    hasProblem: boolean;
    hasAmplify: boolean;
    hasMistake: boolean;
    hasConsequence: boolean;
    hasShift: boolean;
    hasMindsetShift: boolean;
    hasSolution: boolean;
    hasStructure: boolean;
    hasExample: boolean;
    hasCta: boolean;
    hasNarrativeProgression: boolean;
  };
};

const generateRateLimit = new Map<string, RateLimitBucket>();

export async function POST(request: Request) {
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
    useInternetImages?: unknown;
    niche?: unknown;
    audience?: unknown;
  };

  try {
    body = (await request.json()) as {
      topic?: unknown;
      slidesCount?: unknown;
      useInternetImages?: unknown;
      niche?: unknown;
      audience?: unknown;
    };
  } catch {
    return NextResponse.json(
      { error: "Некорректный формат запроса. Обновите страницу и попробуйте снова." },
      { status: 400 }
    );
  }

  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const slidesCount = clampSlidesCount(
    typeof body.slidesCount === "number" ? body.slidesCount : Number(body.slidesCount)
  );
  const useInternetImages =
    body.useInternetImages === true || body.useInternetImages === "true";
  const niche = typeof body.niche === "string" ? body.niche.trim().slice(0, 120) : "";
  const audience = typeof body.audience === "string" ? body.audience.trim().slice(0, 160) : "";

  if (!topic) {
    return NextResponse.json(
      { error: "Введите тему карусели." },
      { status: 400 }
    );
  }

  if (topic.length < MIN_TOPIC_CHARS) {
    return NextResponse.json(
      { error: `Тема слишком короткая. Минимум ${MIN_TOPIC_CHARS} символа.` },
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
    let generationResult = await withTimeout(
      generateCarouselFromTopic(topic, slidesCount, {
        useInternetImages,
        niche,
        audience
      }),
      timeoutMs
    );

    const firstAttemptDiagnostics = assessGenerationPayload(
      generationResult.slides,
      generationResult.painModel
    );

    if (!firstAttemptDiagnostics.isValid) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Generate payload rejected (attempt 1):", firstAttemptDiagnostics);
      }

      generationResult = await withTimeout(
        generateCarouselFromTopic(topic, slidesCount, {
          useInternetImages,
          niche,
          audience
        }),
        timeoutMs
      );
    }

    const { slides, painModel } = generationResult;

    if (!slides.length) {
      return NextResponse.json(
        { error: "Генерация вернула пустой результат. Попробуйте переформулировать тему." },
        { status: 502 }
      );
    }

    const secondAttemptDiagnostics = assessGenerationPayload(slides, painModel);

    if (!secondAttemptDiagnostics.isValid) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Generate payload rejected (attempt 2):", secondAttemptDiagnostics);
      }

      return NextResponse.json(
        {
          error:
            "Не удалось собрать цельную карусель. Уточните тему или добавьте больше исходных мыслей и попробуйте снова."
        },
        { status: 502 }
      );
    }

    let internetImages: Array<{
      slideIndex: number;
      imageUrl: string;
      source?: string;
      relevanceScore?: number;
      query?: string;
    }> = [];
    if (useInternetImages) {
      internetImages = await findInternetImagesForCarousel(topic, slides, 2).catch(() => []);
    }

    return NextResponse.json({ slides, painModel, internetImages });
  } catch (error) {
    if (error instanceof Error && error.name === "GenerateTimeoutError") {
      return NextResponse.json(
        { error: "Генерация заняла слишком много времени. Попробуйте короче сформулировать тему." },
        { status: 504 }
      );
    }

    console.error("Generate API failed:", error);

    return NextResponse.json(
      { error: "Не удалось сгенерировать карусель. Попробуйте снова." },
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

function assessGenerationPayload(
  slides: CarouselOutlineSlide[],
  painModel: unknown
): GenerationPayloadDiagnostics {
  if (!Array.isArray(slides) || slides.length < 8 || slides.length > 10) {
    return {
      isValid: false,
      qualityScore: 0,
      flags: {
        hasHook: false,
        hasProblem: false,
        hasAmplify: false,
        hasMistake: false,
        hasConsequence: false,
        hasShift: false,
        hasMindsetShift: false,
        hasSolution: false,
        hasStructure: false,
        hasExample: false,
        hasCta: false,
        hasNarrativeProgression: false
      }
    };
  }

  if (!isValidPainModel(painModel)) {
    return {
      isValid: false,
      qualityScore: 0,
      flags: {
        hasHook: false,
        hasProblem: false,
        hasAmplify: false,
        hasMistake: false,
        hasConsequence: false,
        hasShift: false,
        hasMindsetShift: false,
        hasSolution: false,
        hasStructure: false,
        hasExample: false,
        hasCta: false,
        hasNarrativeProgression: false
      }
    };
  }

  const normalizedRoles = slides.map((slide, index) => normalizeRole(slide.role, index, slides.length));
  const mergedSlides = slides.map((slide) => `${slide.title ?? ""}\n${slide.text ?? ""}`);

  const hasEmptySlide = slides.some(
    (slide) =>
      typeof slide?.title !== "string" ||
      typeof slide?.text !== "string" ||
      slide.title.trim().length < 4 ||
      slide.text.trim().length < 14
  );
  if (hasEmptySlide) {
    return {
      isValid: false,
      qualityScore: 0,
      flags: {
        hasHook: false,
        hasProblem: false,
        hasAmplify: false,
        hasMistake: false,
        hasConsequence: false,
        hasShift: false,
        hasMindsetShift: false,
        hasSolution: false,
        hasStructure: false,
        hasExample: false,
        hasCta: false,
        hasNarrativeProgression: false
      }
    };
  }

  const hasHook = normalizedRoles[0] === "hook";
  const hasMergedProblemAmplify =
    slides.length <= 8 && normalizedRoles.some((role) => role === "problem");
  const hasMergedMistakeConsequence =
    slides.length <= 9 && normalizedRoles.some((role) => role === "mistake");
  const hasProblem = normalizedRoles.some((role) =>
    role === "problem" || role === "amplify" || role === "consequence" || role === "mistake"
  );
  const hasAmplify =
    normalizedRoles.some((role) => role === "amplify") ||
    hasMergedProblemAmplify ||
    mergedSlides.some((slide) => /(усили|обостр|worse|worsen|escalat|deeper pain|дороже)/i.test(slide));
  const hasMistake = normalizedRoles.some((role) => role === "mistake");
  const hasConsequence =
    normalizedRoles.some((role) => role === "consequence") ||
    hasMergedMistakeConsequence ||
    mergedSlides.some(hasConsequenceSignal);
  const hasShift = normalizedRoles.some((role) => role === "shift");
  const hasSolution = normalizedRoles.some((role) => role === "solution");
  const hasStructure =
    normalizedRoles.some((role) => role === "structure") || mergedSlides.some(hasStructureSignal);
  const hasExample =
    normalizedRoles.some((role) => role === "example") || mergedSlides.some(hasProofSignal);
  const hasMindsetShift = hasShift || mergedSlides.some(hasShiftSignal);
  const hasNarrativeProgression = hasProblem && (hasConsequence || hasAmplify) && hasShift && hasSolution;

  const lastRole = normalizedRoles[normalizedRoles.length - 1];
  const lastSlide = slides[slides.length - 1];
  const hasCta =
    lastRole === "cta" &&
    /(напиш|сохран|получ|write|save|send|dm|direct|коммент|директ|чеклист|шаблон)/i.test(
      `${lastSlide?.title ?? ""}\n${lastSlide?.text ?? ""}`
    );

  const qualityScore = [
    hasHook,
    hasProblem,
    hasAmplify,
    hasMistake,
    hasConsequence,
    hasShift,
    hasMindsetShift,
    hasSolution,
    hasStructure,
    hasExample,
    hasCta
  ].filter(Boolean).length;

  const isValid =
    hasHook &&
    hasNarrativeProgression &&
    hasMindsetShift &&
    hasCta &&
    (hasStructure || hasExample) &&
    qualityScore >= 8;

  return {
    isValid,
    qualityScore,
    flags: {
      hasHook,
      hasProblem,
      hasAmplify,
      hasMistake,
      hasConsequence,
      hasShift,
      hasMindsetShift,
      hasSolution,
      hasStructure,
      hasExample,
      hasCta,
      hasNarrativeProgression
    }
  };
}

function isValidPainModel(value: unknown): value is PainModelPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const model = value as Record<string, unknown>;
  const fields: Array<keyof PainModelPayload> = [
    "pain",
    "wrongAction",
    "consequence",
    "desiredOutcome",
    "emotionalState"
  ];

  return fields.every((field) => {
    const current = model[field];
    return typeof current === "string" && current.trim().length >= 8;
  });
}

function normalizeRole(role: CarouselSlideRole | undefined, index: number, total: number): CarouselSlideRole {
  if (!role) {
    return index === 0 ? "hook" : index === total - 1 ? "cta" : "solution";
  }

  if (role === "cover") {
    return "hook";
  }

  if (role === "case") {
    return "example";
  }

  if (role === "tip" || role === "summary") {
    return "solution";
  }

  if (role === "steps" || role === "checklist") {
    return "structure";
  }

  if (role === "comparison") {
    return "shift";
  }

  return role;
}

function hasConsequenceSignal(value: string) {
  return /(теря|потер|слива|срыв|риски|дорого|loss|risk|drop|leak|fails?)/i.test(value);
}

function hasStructureSignal(value: string) {
  return /(шаг|план|структур|чеклист|по порядку|step|plan|framework|checklist|playbook)/i.test(value);
}

function hasProofSignal(value: string) {
  return /(кейс|пример|результат|case|example|result|получил|вырос|снизил|grew|increased|reduced)/i.test(value);
}

function hasShiftSignal(value: string) {
  return (
    /это\s+не\s+.+,\s*это\s+.+/i.test(value) ||
    /\bне\b.+\bа\b.+/i.test(value) ||
    /not\s+.+,\s*but\s+.+/i.test(value)
  );
}
