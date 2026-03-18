import type { CarouselOutlineSlide } from "@/types/editor";

const OPENVERSE_API_URL = "https://api.openverse.engineering/v1/images";
const IMAGE_SEARCH_TIMEOUT_MS = 5500;
const MAX_QUERY_COUNT = 8;
const STOP_WORDS = new Set([
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
  "the",
  "and",
  "with",
  "from",
  "your",
  "this"
]);

export async function findInternetImagesForCarousel(
  topic: string,
  slides: CarouselOutlineSlide[],
  maxImages = 3
) {
  const safeMaxImages = Math.max(1, Math.min(3, Math.round(maxImages)));
  const queries = buildSearchQueries(topic, slides).slice(0, MAX_QUERY_COUNT);

  if (!queries.length) {
    return [];
  }

  const collectedUrls: string[] = [];
  const used = new Set<string>();

  for (const query of queries) {
    if (collectedUrls.length >= safeMaxImages) {
      break;
    }

    const results = await searchOpenverse(query);
    for (const item of results) {
      if (!item || used.has(item)) {
        continue;
      }

      used.add(item);
      collectedUrls.push(item);

      if (collectedUrls.length >= safeMaxImages) {
        break;
      }
    }
  }

  if (collectedUrls.length < safeMaxImages) {
    for (const query of queries) {
      if (collectedUrls.length >= safeMaxImages) {
        break;
      }

      const fallbackUrl = buildFallbackImageUrl(query);
      if (!fallbackUrl || used.has(fallbackUrl)) {
        continue;
      }

      used.add(fallbackUrl);
      collectedUrls.push(fallbackUrl);
    }
  }

  const targetIndexes = pickTargetIndexes(slides.length, collectedUrls.length);

  return collectedUrls.map((url, index) => ({
    slideIndex: targetIndexes[index] ?? 0,
    imageUrl: `/api/image-proxy?src=${encodeURIComponent(url)}`
  }));
}

async function searchOpenverse(query: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), IMAGE_SEARCH_TIMEOUT_MS);

  try {
    const endpoint = `${OPENVERSE_API_URL}?q=${encodeURIComponent(query)}&page_size=8`;
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        "User-Agent": "ai-carousel-editor/1.0"
      }
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as {
      results?: Array<{ url?: string; thumbnail?: string; title?: string }>;
    };

    return (data.results ?? [])
      .map((item) => normalizeRemoteImageUrl(item.url ?? item.thumbnail ?? ""))
      .filter((url): url is string => Boolean(url));
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeRemoteImageUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function buildSearchQueries(topic: string, slides: CarouselOutlineSlide[]) {
  const queries: string[] = [];
  const seen = new Set<string>();

  const pushQuery = (value: string) => {
    const normalized = normalizeQuery(value);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    queries.push(normalized);
  };

  pushQuery(topic);
  for (const slide of slides) {
    pushQuery(slide.title);
  }

  return queries;
}

function normalizeQuery(value: string) {
  const words = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));

  return words.slice(0, 6).join(" ").trim();
}

function pickTargetIndexes(totalSlides: number, imagesCount: number) {
  if (totalSlides <= 0 || imagesCount <= 0) {
    return [];
  }

  const pool =
    totalSlides > 2
      ? Array.from({ length: totalSlides - 2 }, (_, index) => index + 1)
      : Array.from({ length: totalSlides }, (_, index) => index);

  if (imagesCount >= pool.length) {
    return pool;
  }

  if (imagesCount === 1) {
    return [pool[Math.floor(pool.length / 2)]];
  }

  const picked = new Set<number>();
  for (let index = 0; index < imagesCount; index += 1) {
    const ratio = index / Math.max(1, imagesCount - 1);
    const target = pool[Math.round(ratio * (pool.length - 1))];
    picked.add(target);
  }

  return Array.from(picked).slice(0, imagesCount);
}

function buildFallbackImageUrl(query: string) {
  const normalized = normalizeQuery(query).replace(/\s+/g, ",");
  if (!normalized) {
    return null;
  }

  return `https://loremflickr.com/1600/1066/${encodeURIComponent(normalized)}`;
}
