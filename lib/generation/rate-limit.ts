export type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export const generateRateLimit = new Map<string, RateLimitBucket>();
export const imageGenerationLocks = new Map<string, number>();

export const DEFAULT_RATE_LIMIT_MAX = 12;
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_SWEEP_THRESHOLD = 5000;
export const IMAGE_GENERATION_LOCK_SWEEP_THRESHOLD = 4000;
export const DEFAULT_IMAGE_GENERATION_LOCK_TTL_MS = 60_000;
export function getClientIp(request: Request) {
  const directIp =
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-vercel-forwarded-for")?.trim();

  if (directIp) {
    return directIp;
  }

  if (process.env.TRUST_UNVERIFIED_X_FORWARDED_FOR === "true") {
    const forwardedFor = request.headers.get("x-forwarded-for");
    const first = forwardedFor
      ?.split(",")
      .map((value) => value.trim())
      .find(Boolean);

    if (first) {
      return first;
    }
  }

  return "unknown";
}

export function consumeGenerateSlot(ip: string, now: number) {
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

export function acquireImageGenerationLock(key: string, now: number) {
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

export function releaseImageGenerationLock(key: string) {
  imageGenerationLocks.delete(key);
}
