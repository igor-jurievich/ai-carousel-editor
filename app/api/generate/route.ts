import { NextResponse } from "next/server";
import { clampSlidesCount, generateCarouselFromTopic } from "@/lib/openai";
import { findInternetImagesForCarousel } from "@/lib/internet-images";

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

  let body: { topic?: unknown; slidesCount?: unknown; useInternetImages?: unknown };

  try {
    body = (await request.json()) as {
      topic?: unknown;
      slidesCount?: unknown;
      useInternetImages?: unknown;
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
    const slides = await withTimeout(
      generateCarouselFromTopic(topic, slidesCount),
      resolveGenerateTimeoutMs()
    );

    if (!slides.length) {
      return NextResponse.json(
        { error: "Генерация вернула пустой результат. Попробуйте переформулировать тему." },
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

    return NextResponse.json({ slides, internetImages });
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
