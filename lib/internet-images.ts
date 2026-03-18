import type { CarouselOutlineSlide } from "@/types/editor";

const OPENVERSE_API_URL = "https://api.openverse.engineering/v1/images";
const WIKIMEDIA_API_URL = "https://commons.wikimedia.org/w/api.php";
const IMAGE_SEARCH_TIMEOUT_MS = 5500;
const MIN_RELEVANCE_SCORE = 0.34;
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

type ImageSuggestion = {
  slideIndex: number;
  imageUrl: string;
  source?: string;
  relevanceScore?: number;
};

type OpenverseResult = {
  url: string;
  title: string;
  tags: string[];
  source?: string;
};

type SearchCandidate = OpenverseResult & {
  relevanceScore?: number;
};

export async function findInternetImagesForCarousel(
  topic: string,
  slides: CarouselOutlineSlide[],
  maxImages = 3
) {
  const safeMaxImages = Math.max(1, Math.min(3, Math.round(maxImages)));
  if (!slides.length) {
    return [];
  }

  const slideIndexes = pickTargetIndexes(slides.length, safeMaxImages);
  const usedUrls = new Set<string>();
  const usedSlideIndexes = new Set<number>();
  const suggestions: ImageSuggestion[] = [];
  const topicTokens = tokenize(topic);

  for (const slideIndex of slideIndexes) {
    if (suggestions.length >= safeMaxImages) {
      break;
    }

    const slide = slides[slideIndex];
    if (!slide) {
      continue;
    }

    const query = buildSlideQuery(topic, slide);
    const queryTokens = tokenize(query);
    if (!queryTokens.length) {
      continue;
    }

    const results = await searchOpenverse(query);
    const ranked = rankCandidates(results, queryTokens, topicTokens).filter(
      (item) => !usedUrls.has(item.url) && item.relevanceScore >= MIN_RELEVANCE_SCORE
    );

    let top: SearchCandidate | null =
      ranked[0] ??
      results.find((item) => !usedUrls.has(item.url) && !isLowQualityUrl(item.url)) ??
      null;
    if (!top) {
      const wikimediaResults = await searchWikimedia(query);
      top =
        rankCandidates(wikimediaResults, queryTokens, topicTokens).find(
          (item) => !usedUrls.has(item.url) && item.relevanceScore >= MIN_RELEVANCE_SCORE - 0.08
        ) ??
        wikimediaResults.find((item) => !usedUrls.has(item.url) && !isLowQualityUrl(item.url)) ??
        null;
    }
    if (!top) {
      continue;
    }

    usedUrls.add(top.url);
    usedSlideIndexes.add(slideIndex);
    suggestions.push({
      slideIndex,
      imageUrl: `/api/image-proxy?src=${encodeURIComponent(top.url)}`,
      source: top.source,
      relevanceScore:
        typeof top.relevanceScore === "number"
          ? Number(top.relevanceScore.toFixed(3))
          : Number((MIN_RELEVANCE_SCORE - 0.06).toFixed(3))
    });
  }

  if (suggestions.length < safeMaxImages) {
    const topicQuery = normalizeQuery(topic);
    if (!topicQuery) {
      return suggestions;
    }

    const availableIndexes = slideIndexes.filter((index) => !usedSlideIndexes.has(index));
    if (!availableIndexes.length) {
      return suggestions;
    }

    const topicResults = await searchOpenverse(topicQuery);
    const rankedByTopic = rankCandidates(topicResults, topicTokens, topicTokens).filter(
      (item) => !usedUrls.has(item.url) && item.relevanceScore >= MIN_RELEVANCE_SCORE + 0.08
    );
    const wikimediaTopicResults =
      rankedByTopic.length > 0 ? [] : await searchWikimedia(topicQuery);
    const fallbackByTopic =
      rankedByTopic.length > 0
        ? rankedByTopic
        : topicResults
            .filter((item) => !usedUrls.has(item.url) && !isLowQualityUrl(item.url))
            .map((item) => ({
              ...item,
              relevanceScore: MIN_RELEVANCE_SCORE - 0.06
            }))
            .concat(
              rankCandidates(wikimediaTopicResults, topicTokens, topicTokens)
                .filter((item) => !usedUrls.has(item.url))
                .map((item) => ({
                  ...item,
                  relevanceScore: Math.max(MIN_RELEVANCE_SCORE - 0.06, item.relevanceScore)
                }))
            );

    for (const candidate of fallbackByTopic) {
      if (!availableIndexes.length || suggestions.length >= safeMaxImages) {
        break;
      }

      const targetIndex = availableIndexes.shift();
      if (targetIndex == null) {
        continue;
      }

      usedUrls.add(candidate.url);
      suggestions.push({
        slideIndex: targetIndex,
        imageUrl: `/api/image-proxy?src=${encodeURIComponent(candidate.url)}`,
        source: candidate.source,
        relevanceScore: Number(candidate.relevanceScore.toFixed(3))
      });
    }
  }

  return suggestions.sort((left, right) => left.slideIndex - right.slideIndex);
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
      results?: Array<{
        url?: string;
        thumbnail?: string;
        title?: string;
        provider?: string;
        source?: string;
        tags?: Array<string | { name?: string }>;
      }>;
    };

    return (data.results ?? [])
      .map((item) => {
        const url = normalizeRemoteImageUrl(item.url ?? item.thumbnail ?? "");
        if (!url) {
          return null;
        }

        const title = (item.title ?? "").trim();
        const tags = normalizeTags(item.tags);
        const source = [item.provider?.trim(), item.source?.trim()].find(Boolean);

        return {
          url,
          title,
          tags,
          source
        } as OpenverseResult;
      })
      .filter((item): item is OpenverseResult => Boolean(item));
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

async function searchWikimedia(query: string): Promise<OpenverseResult[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), IMAGE_SEARCH_TIMEOUT_MS);

  try {
    const endpoint = new URL(WIKIMEDIA_API_URL);
    endpoint.searchParams.set("action", "query");
    endpoint.searchParams.set("format", "json");
    endpoint.searchParams.set("generator", "search");
    endpoint.searchParams.set("gsrnamespace", "6");
    endpoint.searchParams.set("gsrlimit", "8");
    endpoint.searchParams.set("gsrsearch", query);
    endpoint.searchParams.set("prop", "imageinfo");
    endpoint.searchParams.set("iiprop", "url");
    endpoint.searchParams.set("iiurlwidth", "1600");
    endpoint.searchParams.set("origin", "*");

    const response = await fetch(endpoint.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "ai-carousel-editor/1.0"
      }
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            title?: string;
            imageinfo?: Array<{ thumburl?: string; url?: string }>;
          }
        >;
      };
    };

    const pages = data.query?.pages ? Object.values(data.query.pages) : [];
    return pages
      .map((page) => {
        const imageInfo = page.imageinfo?.[0];
        const url = normalizeRemoteImageUrl(imageInfo?.thumburl ?? imageInfo?.url ?? "");
        if (!url) {
          return null;
        }

        return {
          url,
          title: (page.title ?? "").replace(/^File:/i, "").trim(),
          tags: [],
          source: "wikimedia"
        } as OpenverseResult;
      })
      .filter((item): item is OpenverseResult => Boolean(item));
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

function normalizeQuery(value: string) {
  const words = tokenize(value);

  return words.slice(0, 6).join(" ").trim();
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function normalizeTags(rawTags: Array<string | { name?: string }> | undefined) {
  if (!rawTags?.length) {
    return [];
  }

  const tags: string[] = [];
  for (const entry of rawTags) {
    if (typeof entry === "string") {
      const value = entry.trim();
      if (value) {
        tags.push(value);
      }
      continue;
    }

    const value = entry.name?.trim();
    if (value) {
      tags.push(value);
    }
  }

  return tags;
}

function buildSlideQuery(topic: string, slide: CarouselOutlineSlide) {
  const title = normalizeQuery(slide.title);
  const body = normalizeQuery(slide.text).split(" ").slice(0, 4).join(" ");
  const base = [title, body].filter(Boolean).join(" ").trim();

  if (base) {
    return `${base} ${normalizeQuery(topic)}`.trim();
  }

  return normalizeQuery(topic);
}

function rankCandidates(results: OpenverseResult[], queryTokens: string[], topicTokens: string[]) {
  return results
    .map((result) => {
      const relevanceScore = scoreCandidate(result, queryTokens, topicTokens);
      return {
        ...result,
        relevanceScore
      };
    })
    .filter((item) => item.relevanceScore > 0)
    .sort((left, right) => right.relevanceScore - left.relevanceScore);
}

function scoreCandidate(
  candidate: OpenverseResult,
  queryTokens: string[],
  topicTokens: string[]
) {
  if (!queryTokens.length) {
    return 0;
  }

  if (isLowQualityUrl(candidate.url)) {
    return 0;
  }

  const candidateTokens = new Set(tokenize(`${candidate.title} ${candidate.tags.join(" ")}`));
  if (!candidateTokens.size) {
    return 0;
  }

  const queryOverlap = getOverlapScore(queryTokens, candidateTokens);
  if (queryOverlap <= 0) {
    return 0;
  }

  const topicOverlap = topicTokens.length ? getOverlapScore(topicTokens, candidateTokens) : 0;
  const richness = Math.min(1, candidateTokens.size / 12) * 0.08;
  return queryOverlap * 0.72 + topicOverlap * 0.2 + richness;
}

function getOverlapScore(tokens: string[], candidateTokens: Set<string>) {
  if (!tokens.length) {
    return 0;
  }

  let hits = 0;
  for (const token of tokens) {
    if (candidateTokens.has(token)) {
      hits += 1;
    }
  }

  return hits / tokens.length;
}

function isLowQualityUrl(url: string) {
  const lower = url.toLowerCase();
  return (
    lower.includes("placeholder") ||
    lower.includes("watermark") ||
    lower.includes("logo") ||
    lower.includes("icon")
  );
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
