import type {
  CarouselImageIntent,
  CarouselOutlineSlide,
  CarouselSlideRole
} from "@/types/editor";

const OPENVERSE_API_URL = "https://api.openverse.engineering/v1/images";
const WIKIMEDIA_API_URL = "https://commons.wikimedia.org/w/api.php";
const IMAGE_SEARCH_TIMEOUT_MS = 5500;
const MIN_RELEVANCE_SCORE = 0.36;
const MAX_QUERY_VARIANTS = 4;
const MAX_QUERY_WORDS = 10;

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
  "над",
  "the",
  "and",
  "with",
  "from",
  "your",
  "this",
  "that"
]);

const QUERY_NOISE_WORDS = new Set([
  "subject",
  "photo",
  "hero",
  "visual",
  "concept",
  "editorial",
  "people",
  "object",
  "closeup",
  "case",
  "study",
  "compare",
  "clean",
  "real",
  "scene",
  "style"
]);

const GENERIC_QUERY_TOKENS = new Set([
  ...QUERY_NOISE_WORDS,
  "professional",
  "natural",
  "quality",
  "high",
  "image",
  "picture",
  "view",
  "shot",
  "realistic"
]);

const TRANSLATIONS: Record<string, string> = {
  грибы: "mushrooms",
  гриб: "mushroom",
  съедобные: "edible",
  ядовитые: "poisonous",
  недвижимость: "real estate",
  квартира: "apartment",
  квартиры: "apartments",
  дом: "house",
  дома: "houses",
  элитной: "luxury",
  элитная: "luxury",
  дорогую: "luxury",
  дорогая: "luxury",
  конверсия: "conversion",
  сайт: "website",
  сайта: "website",
  экспертный: "expert",
  instagram: "instagram",
  зубы: "teeth",
  зубов: "teeth",
  стоматология: "dental",
  стоматолог: "dentist",
  клиника: "clinic",
  пенсионеров: "seniors",
  пенсионеры: "seniors",
  продажа: "sales",
  продажи: "sales",
  продавать: "sales"
};

const SCENE_TRANSLATIONS: Array<{ re: RegExp; replacement: string }> = [
  {
    re: /(элитн|дорог|премиум).*(недвиж|квартир|дом)|недвиж.*(элитн|дорог|премиум)/i,
    replacement: "luxury real estate interior architecture"
  },
  {
    re: /(продаж|риелтор|ипотек|покупат|клиент).*(недвиж|квартир|дом)|недвиж.*(продаж|риелтор|ипотек)/i,
    replacement: "real estate consultation office meeting clients"
  },
  {
    re: /(съедоб|ядовит|гриб)/i,
    replacement: "edible poisonous mushrooms forest closeup macro"
  },
  {
    re: /(кофе|эспрессо|капучин|brew|coffee)/i,
    replacement: "coffee brewing barista closeup beans cup"
  },
  {
    re: /(конверси|продаж|лид|воронк|маркетинг|sales|conversion)/i,
    replacement: "business meeting analytics strategy team discussion"
  },
  {
    re: /(онбординг|saas|b2b|продукт|product)/i,
    replacement: "saas onboarding dashboard team workshop office"
  },
  {
    re: /(instagram|инстаграм|creator|контент|личн.*бренд)/i,
    replacement: "creator workspace smartphone content planning portrait"
  },
  {
    re: /(зуб|стомат|кариес|десн|дентал)/i,
    replacement: "dental clinic consultation healthy teeth closeup"
  }
];

const PEOPLE_TOKENS = new Set([
  "people",
  "person",
  "man",
  "woman",
  "family",
  "portrait",
  "couple",
  "team",
  "senior",
  "seniors"
]);

const OBJECT_TOKENS = new Set([
  "object",
  "product",
  "mushroom",
  "mushrooms",
  "document",
  "documents",
  "house",
  "apartment",
  "property",
  "coffee"
]);

const CONCEPTUAL_TOKENS = new Set([
  "concept",
  "business",
  "strategy",
  "workspace",
  "meeting",
  "architecture",
  "interior",
  "forest",
  "nature"
]);

const CRITICAL_ANCHOR_TOKENS = new Set([
  "mushroom",
  "mushrooms",
  "poisonous",
  "edible",
  "estate",
  "property",
  "apartment",
  "mortgage",
  "house",
  "interior",
  "architecture",
  "coffee",
  "dental",
  "teeth",
  "clinic"
]);

const STRICT_VISUAL_ANCHOR_TOKENS = new Set([
  "mushroom",
  "mushrooms",
  "poisonous",
  "edible",
  "estate",
  "property",
  "apartment",
  "mortgage",
  "house",
  "coffee",
  "dental",
  "teeth",
  "clinic"
]);

const OUT_OF_CONTEXT_NOISE_TOKENS = new Set([
  "cat",
  "cats",
  "dog",
  "dogs",
  "bird",
  "birds",
  "wildlife",
  "zoo",
  "lion",
  "tiger",
  "elephant",
  "horse",
  "puppy",
  "kitten"
]);

const LOW_QUALITY_META_RE =
  /(illustration|drawing|painting|engraving|poster|clipart|vector|sketch|logo|icon|cartoon|meme|sticker|banner|screenshot|mockup|thumbnail|wallpaper|render|3d|template|isolated|transparent\s+background)/i;
const LOW_QUALITY_SOFT_RE =
  /(stock|preview|demo|sample|brochure|flyer|ad|advert|promo|mock-up|background|frame)/i;
const QUALITY_SIGNAL_RE =
  /(photo|photograph|portrait|interior|architecture|closeup|close-up|macro|documentary|editorial|natural|daylight|office|workspace|forest|nature|property|house|apartment|coffee|mushroom)/i;
const BLOCKED_HOST_FRAGMENTS = [
  "freepik.com",
  "vecteezy.com",
  "vectorstock.com",
  "pngtree.com",
  "pngwing.com",
  "clipart",
  "iconfinder",
  "icons8",
  "shutterstock",
  "istockphoto",
  "depositphotos",
  "123rf",
  "dreamstime"
];

type ImageSuggestion = {
  slideIndex: number;
  imageUrl: string;
  source?: string;
  relevanceScore?: number;
  query?: string;
};

type OpenverseResult = {
  url: string;
  title: string;
  tags: string[];
  source?: string;
  width?: number;
  height?: number;
  mimeType?: string;
};

type SearchCandidate = OpenverseResult & {
  relevanceScore: number;
  finalScore: number;
  queryUsed: string;
};

type SlideImageCandidate = {
  slideIndex: number;
  role: CarouselSlideRole;
  imageIntent: CarouselImageIntent;
  queryVariants: string[];
  priority: number;
};

type ImageTopicCategory =
  | "real-estate"
  | "nature-food"
  | "marketing-sales"
  | "creator-brand"
  | "business"
  | "generic";

export async function findInternetImagesForCarousel(
  topic: string,
  slides: CarouselOutlineSlide[],
  maxImages = 3
) {
  const safeMaxImages = Math.max(1, Math.min(3, Math.round(maxImages)));
  const topicCategory = inferImageTopicCategory(topic);
  if (!slides.length) {
    return [];
  }

  const candidates = pickTargetSlides(topic, slides, safeMaxImages);
  if (!candidates.length) {
    return [];
  }

  const usedUrls = new Set<string>();
  const suggestions: ImageSuggestion[] = [];
  const topicTokens = tokenize(topic);

  for (const slideCandidate of candidates) {
    if (suggestions.length >= safeMaxImages) {
      break;
    }

    const selected = await findBestCandidateForSlide(slideCandidate, topicTokens, usedUrls);
    if (!selected) {
      continue;
    }

    usedUrls.add(selected.url);
    suggestions.push({
      slideIndex: slideCandidate.slideIndex,
      imageUrl: `/api/image-proxy?src=${encodeURIComponent(selected.url)}`,
      source: selected.source,
      relevanceScore: Number(selected.relevanceScore.toFixed(3)),
      query: selected.queryUsed
    });
  }

  // Conservative topic-level fallback: only highly relevant candidates.
  if (suggestions.length < safeMaxImages) {
    const available = candidates
      .map((candidate) => candidate.slideIndex)
      .filter((index) => !suggestions.some((item) => item.slideIndex === index));

    if (available.length) {
      const topicFallbackThreshold =
        topicCategory === "real-estate" || topicCategory === "nature-food"
          ? MIN_RELEVANCE_SCORE + 0.12
          : MIN_RELEVANCE_SCORE + 0.16;
      const topicQuery = normalizeQuery(topic);
      const translatedTopicQuery = normalizeQuery(translateSceneToEnglish(topic));
      const categoryTopicQuery = normalizeQuery(
        `${getCategoryHintTokens(topicCategory, "cover").join(" ")} ${translatedTopicQuery}`
      );
      const fallbackQueries = Array.from(
        new Set([topicQuery, translatedTopicQuery, categoryTopicQuery].filter(Boolean))
      );

      if (fallbackQueries.length) {
        const topicBest = await findBestCandidateAcrossQueries(
          fallbackQueries,
          topicTokens,
          {
            role: "cover",
            imageIntent: "subject-photo"
          },
          usedUrls,
          topicFallbackThreshold
        );

        if (topicBest) {
          const index = available[0];
          usedUrls.add(topicBest.url);
          suggestions.push({
            slideIndex: index,
            imageUrl: `/api/image-proxy?src=${encodeURIComponent(topicBest.url)}`,
            source: topicBest.source,
            relevanceScore: Number(topicBest.relevanceScore.toFixed(3)),
            query: topicBest.queryUsed
          });
        }
      }
    }
  }

  return suggestions.sort((left, right) => left.slideIndex - right.slideIndex);
}

async function findBestCandidateForSlide(
  slideCandidate: SlideImageCandidate,
  topicTokens: string[],
  usedUrls: Set<string>
) {
  const minScore = resolveMinScoreForSlide(slideCandidate.role, slideCandidate.imageIntent);

  return await findBestCandidateAcrossQueries(
    slideCandidate.queryVariants,
    topicTokens,
    {
      role: slideCandidate.role,
      imageIntent: slideCandidate.imageIntent
    },
    usedUrls,
    minScore
  );
}

async function findBestCandidateAcrossQueries(
  queries: string[],
  topicTokens: string[],
  context: {
    role: CarouselSlideRole;
    imageIntent: CarouselImageIntent;
  },
  usedUrls: Set<string>,
  minScore: number
) {
  let best: SearchCandidate | null = null;

  for (const query of queries.slice(0, MAX_QUERY_VARIANTS)) {
    const queryTokens = tokenize(query);
    if (!queryTokens.length) {
      continue;
    }

    const anchorTokens = extractAnchorTokens(queryTokens, topicTokens);
    const criticalAnchors = extractCriticalAnchors(anchorTokens, topicTokens, queryTokens);

    const openverseResults = await searchOpenverse(query);
    const openverseRanked = rankCandidates(
      openverseResults,
      query,
      queryTokens,
      anchorTokens,
      criticalAnchors,
      topicTokens,
      context
    ).filter((item) => !usedUrls.has(item.url) && item.finalScore >= minScore);

    if (openverseRanked[0] && (!best || openverseRanked[0].finalScore > best.finalScore)) {
      best = openverseRanked[0];
      if (best.finalScore >= minScore + 0.16) {
        break;
      }
    }

    const wikimediaResults = await searchWikimedia(query);
    const wikimediaRanked = rankCandidates(
      wikimediaResults,
      query,
      queryTokens,
      anchorTokens,
      criticalAnchors,
      topicTokens,
      context
    ).filter((item) => !usedUrls.has(item.url) && item.finalScore >= minScore + 0.02);

    if (wikimediaRanked[0] && (!best || wikimediaRanked[0].finalScore > best.finalScore)) {
      best = wikimediaRanked[0];
      if (best.finalScore >= minScore + 0.16) {
        break;
      }
    }
  }

  return best;
}

function resolveMinScoreForSlide(role: CarouselSlideRole, intent: CarouselImageIntent) {
  const roleThreshold =
    role === "cover"
      ? 0.52
      : role === "case"
        ? 0.47
        : role === "problem"
          ? 0.44
          : role === "comparison"
            ? 0.43
            : 0.4;

  const intentBoost =
    intent === "subject-photo"
      ? 0.04
      : intent === "people-photo"
        ? 0.03
        : intent === "object-photo"
          ? 0.02
          : 0;

  return Math.max(MIN_RELEVANCE_SCORE + 0.04, roleThreshold + intentBoost);
}

function pickTargetSlides(topic: string, slides: CarouselOutlineSlide[], imagesCount: number) {
  const semantic = slides
    .map<SlideImageCandidate | null>((slide, slideIndex) => {
      const imageIntent = slide.imageIntent ?? "none";
      if (imageIntent === "none") {
        return null;
      }

      const role = slide.role ?? inferRoleByIndex(slideIndex, slides.length);
      const queryVariants = buildQueryVariants(topic, slide, role, imageIntent);
      if (!queryVariants.length) {
        return null;
      }

      return {
        slideIndex,
        role,
        imageIntent,
        queryVariants,
        priority: rankSlideImagePriority(role, imageIntent, slide.imageQueryDraft)
      };
    })
    .filter((item): item is SlideImageCandidate => item !== null)
    .sort((left, right) => right.priority - left.priority);

  if (semantic.length) {
    return pickDistributedCandidates(semantic, imagesCount);
  }

  const fallbackCandidates = slides
    .map<SlideImageCandidate | null>((slide, slideIndex) => {
      const role = inferRoleByIndex(slideIndex, slides.length);
      const imageIntent: CarouselImageIntent =
        role === "cover" || role === "case" || role === "problem"
          ? "subject-photo"
          : "none";
      if (imageIntent === "none") {
        return null;
      }

      return {
        slideIndex,
        role,
        imageIntent,
        queryVariants: buildQueryVariants(topic, slide, role, imageIntent),
        priority: rankSlideImagePriority(role, imageIntent, slide?.imageQueryDraft)
      };
    })
    .filter((item): item is SlideImageCandidate => item !== null)
    .sort((left, right) => right.priority - left.priority);

  return pickDistributedCandidates(fallbackCandidates, Math.min(imagesCount, 2));
}

function buildQueryVariants(
  topic: string,
  slide: CarouselOutlineSlide,
  role: CarouselSlideRole,
  imageIntent: CarouselImageIntent
) {
  const category = inferImageTopicCategory(`${topic} ${slide.title} ${slide.text}`);
  const manual = normalizeQuery(slide.imageQueryDraft ?? "");
  const semantic = buildSlideQuery(topic, slide, role, imageIntent, category);
  const translated = buildTranslatedSemanticQuery(topic, slide, role, imageIntent, category);
  const categoryVariant = buildCategoryVisualQuery(topic, slide, role, imageIntent, category);
  const intentFallback = buildIntentFallbackQuery(topic, role, imageIntent, category);

  const variants = [manual, semantic, translated, categoryVariant, intentFallback].filter(Boolean);
  const unique = Array.from(new Set(variants.map((value) => normalizeQuery(value)).filter(Boolean)));

  return unique.slice(0, MAX_QUERY_VARIANTS);
}

function buildSlideQuery(
  topic: string,
  slide: CarouselOutlineSlide,
  role: CarouselSlideRole,
  imageIntent: CarouselImageIntent,
  category: ImageTopicCategory
) {
  const intentHint =
    imageIntent === "people-photo"
      ? "professional people portrait"
      : imageIntent === "object-photo"
        ? "detailed object closeup"
        : imageIntent === "conceptual-photo"
          ? "clean conceptual scene"
          : "subject photo";

  const roleHint =
    role === "case"
      ? "real case study"
      : role === "cover"
        ? "hero visual"
        : role === "comparison"
          ? "comparison concept"
          : role === "problem"
            ? "problem situation"
            : "";

  const categoryHint = getCategoryHintTokens(category, role).join(" ");
  const title = normalizeQuery(slide.title);
  const body = tokenize(slide.text).slice(0, 5).join(" ");
  const topicQuery = normalizeQuery(topic);

  return [intentHint, roleHint, categoryHint, title, body, topicQuery].filter(Boolean).join(" ");
}

function buildTranslatedSemanticQuery(
  topic: string,
  slide: CarouselOutlineSlide,
  role: CarouselSlideRole,
  imageIntent: CarouselImageIntent,
  category: ImageTopicCategory
) {
  const tokens = tokenize(`${topic} ${slide.title} ${slide.text}`)
    .slice(0, 10)
    .map((token) => TRANSLATIONS[token] ?? token)
    .flatMap((token) => token.split(/\s+/))
    .filter(Boolean);

  const intentTokens =
    imageIntent === "people-photo"
      ? ["people", "portrait"]
      : imageIntent === "object-photo"
        ? ["object", "detail"]
        : imageIntent === "conceptual-photo"
          ? ["conceptual", "scene"]
          : ["subject", "photo"];
  const roleTokens =
    role === "case"
      ? ["real", "scenario"]
      : role === "cover"
        ? ["hero", "visual"]
        : role === "problem"
          ? ["situation"]
          : [];

  return normalizeQuery([...getCategoryHintTokens(category, role), ...roleTokens, ...intentTokens, ...tokens].join(" "));
}

function buildIntentFallbackQuery(
  topic: string,
  role: CarouselSlideRole,
  imageIntent: CarouselImageIntent,
  category: ImageTopicCategory
) {
  const topicTokens = tokenize(topic).slice(0, 4).map((token) => TRANSLATIONS[token] ?? token);
  const roleTokens =
    role === "case"
      ? ["business", "meeting", "real", "people"]
      : role === "cover"
        ? ["hero", "editorial", "clean"]
        : role === "problem"
          ? ["situation", "professional"]
          : role === "comparison"
            ? ["contrast", "choice"]
            : ["editorial", "clean"];
  const intentTokens =
    imageIntent === "people-photo"
      ? ["people", "portrait"]
      : imageIntent === "object-photo"
        ? ["object", "closeup"]
        : imageIntent === "conceptual-photo"
          ? ["concept", "scene"]
          : ["subject", "photo"];
  const categoryTokens = getCategoryHintTokens(category, role);

  return normalizeQuery([...categoryTokens, ...roleTokens, ...intentTokens, ...topicTokens].join(" "));
}

function buildCategoryVisualQuery(
  topic: string,
  slide: CarouselOutlineSlide,
  role: CarouselSlideRole,
  imageIntent: CarouselImageIntent,
  category: ImageTopicCategory
) {
  const categoryTokens = getCategoryHintTokens(category, role);
  const roleTokens =
    role === "cover"
      ? ["clean", "hero", "editorial"]
      : role === "case"
        ? ["real", "documentary", "scene"]
        : role === "problem"
          ? ["situation", "realistic"]
          : ["clean", "minimal", "photo"];
  const intentTokens =
    imageIntent === "people-photo"
      ? ["people", "portrait", "natural-light"]
      : imageIntent === "object-photo"
        ? ["object", "closeup", "detail"]
        : imageIntent === "conceptual-photo"
          ? ["concept", "editorial", "scene"]
          : ["subject", "photo"];
  const translatedScene = translateSceneToEnglish(`${topic} ${slide.title}`);

  return normalizeQuery(
    [...categoryTokens, ...roleTokens, ...intentTokens, translatedScene].filter(Boolean).join(" ")
  );
}

function rankSlideImagePriority(
  role: CarouselSlideRole,
  intent: CarouselImageIntent,
  imageQueryDraft?: string
) {
  const roleScore =
    role === "cover"
      ? 0.65
      : role === "case"
        ? 0.56
        : role === "problem"
          ? 0.44
          : role === "comparison"
            ? 0.38
            : 0.2;

  const intentScore =
    intent === "subject-photo"
      ? 0.5
      : intent === "people-photo"
        ? 0.48
        : intent === "object-photo"
          ? 0.44
          : intent === "conceptual-photo"
            ? 0.36
            : 0;

  const queryBoost = imageQueryDraft?.trim() ? 0.2 : 0;
  return roleScore + intentScore + queryBoost;
}

function inferRoleByIndex(index: number, total: number): CarouselSlideRole {
  if (index <= 0) {
    return "cover";
  }

  if (index >= total - 1) {
    return "cta";
  }

  if (index === total - 2) {
    return "case";
  }

  return "tip";
}

function pickDistributedCandidates(candidates: SlideImageCandidate[], imagesCount: number) {
  if (candidates.length <= imagesCount) {
    return candidates;
  }

  const pool = [...candidates];
  const selected: SlideImageCandidate[] = [];

  while (pool.length && selected.length < imagesCount) {
    const preferredIndex = pool.findIndex((candidate) =>
      selected.every((picked) => Math.abs(picked.slideIndex - candidate.slideIndex) > 1)
    );

    if (preferredIndex !== -1) {
      selected.push(pool.splice(preferredIndex, 1)[0]);
      continue;
    }

    selected.push(pool.shift() as SlideImageCandidate);
  }

  return selected;
}

function inferImageTopicCategory(source: string): ImageTopicCategory {
  const value = source.toLowerCase();

  if (/недвиж|квартир|дом|property|real\s*estate|mortgage|realtor/.test(value)) {
    return "real-estate";
  }

  if (/гриб|еда|кофе|forest|nature|mushroom|food|recipe|coffee/.test(value)) {
    return "nature-food";
  }

  if (/конверси|продаж|воронк|маркетинг|sales|conversion|lead|funnel/.test(value)) {
    return "marketing-sales";
  }

  if (/instagram|creator|личн.*бренд|контент|social|expert/.test(value)) {
    return "creator-brand";
  }

  if (/бизнес|компан|saas|b2b|strategy|business|workflow|onboarding/.test(value)) {
    return "business";
  }

  return "generic";
}

function getCategoryHintTokens(category: ImageTopicCategory, role: CarouselSlideRole) {
  if (category === "real-estate") {
    if (role === "case") {
      return ["real", "estate", "consultation", "office"];
    }
    return ["luxury", "property", "architecture", "interior", "daylight"];
  }

  if (category === "nature-food") {
    return ["natural", "closeup", "detailed", "real", "photo"];
  }

  if (category === "marketing-sales") {
    return role === "case"
      ? ["business", "meeting", "discussion", "clients"]
      : ["business", "strategy", "workspace", "professional"];
  }

  if (category === "creator-brand") {
    return ["creator", "workspace", "portrait", "minimal"];
  }

  if (category === "business") {
    return ["executive", "office", "team", "professional", "clean"];
  }

  return ["editorial", "professional", "clean", "photo"];
}

function translateSceneToEnglish(source: string) {
  const normalized = source.toLowerCase();

  for (const item of SCENE_TRANSLATIONS) {
    if (item.re.test(normalized)) {
      return item.replacement;
    }
  }

  const translatedTokens = tokenize(source)
    .slice(0, 8)
    .map((token) => TRANSLATIONS[token] ?? token)
    .flatMap((token) => token.split(/\s+/))
    .filter(Boolean);

  return translatedTokens.join(" ");
}

async function searchOpenverse(query: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), IMAGE_SEARCH_TIMEOUT_MS);

  try {
    const endpoint = `${OPENVERSE_API_URL}?q=${encodeURIComponent(query)}&page_size=10`;
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
        width?: number;
        height?: number;
        filetype?: string;
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
          source,
          width: toFiniteNumber(item.width),
          height: toFiniteNumber(item.height),
          mimeType: typeof item.filetype === "string" ? item.filetype : undefined
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
    endpoint.searchParams.set("gsrlimit", "10");
    endpoint.searchParams.set("gsrsearch", query);
    endpoint.searchParams.set("prop", "imageinfo");
    endpoint.searchParams.set("iiprop", "url|size|mime");
    endpoint.searchParams.set("iiurlwidth", "1800");
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
            imageinfo?: Array<{
              thumburl?: string;
              url?: string;
              width?: number;
              height?: number;
              mime?: string;
            }>;
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
          source: "wikimedia",
          width: toFiniteNumber(imageInfo?.width),
          height: toFiniteNumber(imageInfo?.height),
          mimeType: typeof imageInfo?.mime === "string" ? imageInfo.mime : undefined
        } as OpenverseResult;
      })
      .filter((item): item is OpenverseResult => Boolean(item));
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

function rankCandidates(
  results: OpenverseResult[],
  query: string,
  queryTokens: string[],
  anchorTokens: string[],
  criticalAnchors: string[],
  topicTokens: string[],
  context: {
    role: CarouselSlideRole;
    imageIntent: CarouselImageIntent;
  }
) {
  return results
    .map((result) =>
      scoreCandidate(result, query, queryTokens, anchorTokens, criticalAnchors, topicTokens, context)
    )
    .filter((item): item is SearchCandidate => Boolean(item))
    .sort((left, right) => right.finalScore - left.finalScore);
}

function scoreCandidate(
  candidate: OpenverseResult,
  query: string,
  queryTokens: string[],
  anchorTokens: string[],
  criticalAnchors: string[],
  topicTokens: string[],
  context: {
    role: CarouselSlideRole;
    imageIntent: CarouselImageIntent;
  }
) {
  if (!queryTokens.length) {
    return null;
  }

  if (isLowQualityUrl(candidate.url)) {
    return null;
  }

  if (isLowQualityMetadata(candidate.title, candidate.tags)) {
    return null;
  }

  if (isLowQualityDimensions(candidate.width, candidate.height)) {
    return null;
  }

  if (isUnsupportedMimeType(candidate.mimeType)) {
    return null;
  }

  const candidateTokens = new Set(tokenize(`${candidate.title} ${candidate.tags.join(" ")}`));
  if (!candidateTokens.size) {
    return null;
  }

  const queryOverlap = getOverlapScore(queryTokens, candidateTokens);
  if (queryOverlap <= 0) {
    return null;
  }

  const anchorOverlap = anchorTokens.length
    ? getOverlapScore(anchorTokens, candidateTokens)
    : queryOverlap;
  if (anchorTokens.length >= 2 && anchorOverlap < 0.26) {
    return null;
  }

  if (criticalAnchors.length > 0) {
    const hasStrictVisualAnchor = criticalAnchors.some((token) =>
      STRICT_VISUAL_ANCHOR_TOKENS.has(token)
    );
    if (hasStrictVisualAnchor && getOverlapScore(criticalAnchors, candidateTokens) < 0.16) {
      return null;
    }
  }

  if (
    hasOutOfContextNoise(
      candidateTokens,
      queryTokens,
      topicTokens,
      context.imageIntent,
      anchorOverlap
    )
  ) {
    return null;
  }

  const topicOverlap = topicTokens.length ? getOverlapScore(topicTokens, candidateTokens) : 0;
  const intentAffinity = getIntentAffinity(candidateTokens, context.imageIntent);
  const sourceQuality = getSourceQuality(candidate.source);
  const aspectQuality = getAspectQuality(candidate.width, candidate.height);
  const resolutionQuality = getResolutionQuality(candidate.width, candidate.height);
  const qualitySignal = getVisualQualitySignal(candidate.title, candidate.tags);
  const qualityPenalty = getQualityPenalty(candidate.url, candidate.title, candidate.tags);
  if (qualityPenalty >= 0.3) {
    return null;
  }
  const roleBonus =
    context.role === "cover"
      ? 0.04
      : context.role === "case"
        ? 0.03
        : context.role === "problem"
          ? 0.02
          : 0;

  const finalScore =
    queryOverlap * 0.34 +
    anchorOverlap * 0.25 +
    topicOverlap * 0.12 +
    intentAffinity * 0.12 +
    qualitySignal * 0.08 +
    sourceQuality * 0.05 +
    aspectQuality * 0.03 +
    resolutionQuality * 0.03 +
    roleBonus -
    qualityPenalty;

  const relevanceScore = queryOverlap * 0.52 + anchorOverlap * 0.28 + topicOverlap * 0.2;

  if (finalScore < MIN_RELEVANCE_SCORE - 0.04) {
    return null;
  }

  if (context.imageIntent !== "conceptual-photo" && qualitySignal < 0.18 && anchorOverlap < 0.4) {
    return null;
  }

  return {
    ...candidate,
    relevanceScore,
    finalScore,
    queryUsed: query
  };
}

function hasOutOfContextNoise(
  candidateTokens: Set<string>,
  queryTokens: string[],
  topicTokens: string[],
  imageIntent: CarouselImageIntent,
  anchorOverlap: number
) {
  if (imageIntent === "conceptual-photo") {
    return false;
  }

  const noisyTokens = Array.from(candidateTokens).filter((token) =>
    OUT_OF_CONTEXT_NOISE_TOKENS.has(token)
  );
  if (!noisyTokens.length) {
    return false;
  }

  const semanticTopic = new Set([...queryTokens, ...topicTokens]);
  const hasTopicSupport = noisyTokens.some((token) => semanticTopic.has(token));
  if (hasTopicSupport) {
    return false;
  }

  return anchorOverlap < 0.42;
}

function getIntentAffinity(tokens: Set<string>, intent: CarouselImageIntent) {
  if (intent === "none") {
    return 0;
  }

  if (intent === "people-photo") {
    return getTokenSetOverlap(tokens, PEOPLE_TOKENS);
  }

  if (intent === "object-photo") {
    return getTokenSetOverlap(tokens, OBJECT_TOKENS);
  }

  if (intent === "conceptual-photo") {
    return getTokenSetOverlap(tokens, CONCEPTUAL_TOKENS);
  }

  // subject-photo
  return Math.max(getTokenSetOverlap(tokens, OBJECT_TOKENS), getTokenSetOverlap(tokens, PEOPLE_TOKENS) * 0.82);
}

function getTokenSetOverlap(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) {
    return 0;
  }

  let hits = 0;
  for (const token of left) {
    if (right.has(token)) {
      hits += 1;
    }
  }

  return Math.min(1, hits / 3);
}

function getSourceQuality(source?: string) {
  const normalized = (source ?? "").toLowerCase();
  if (!normalized) {
    return 0.35;
  }

  if (normalized.includes("flickr") || normalized.includes("unsplash") || normalized.includes("wikimedia")) {
    return 0.9;
  }

  if (normalized.includes("wordpress") || normalized.includes("pinterest")) {
    return 0.45;
  }

  return 0.65;
}

function getAspectQuality(width?: number, height?: number) {
  if (!width || !height || width <= 0 || height <= 0) {
    return 0.55;
  }

  const ratio = width / height;
  const target = 1.65;
  const distance = Math.abs(ratio - target);
  return Math.max(0.2, 1 - distance / 1.8);
}

function getResolutionQuality(width?: number, height?: number) {
  if (!width || !height || width <= 0 || height <= 0) {
    return 0.45;
  }

  const area = width * height;
  if (area >= 2_000_000) {
    return 1;
  }
  if (area >= 1_200_000) {
    return 0.85;
  }
  if (area >= 700_000) {
    return 0.62;
  }
  return 0.3;
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
  const focused = words.filter((word) => !QUERY_NOISE_WORDS.has(word));
  const source = focused.length >= 2 ? focused : words;

  return Array.from(new Set(source)).slice(0, MAX_QUERY_WORDS).join(" ").trim();
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

function extractAnchorTokens(queryTokens: string[], topicTokens: string[]) {
  const merged = [...queryTokens, ...topicTokens];
  const filtered = merged.filter(
    (token) =>
      token.length > 3 &&
      !GENERIC_QUERY_TOKENS.has(token) &&
      !QUERY_NOISE_WORDS.has(token)
  );

  return Array.from(new Set(filtered)).slice(0, 7);
}

function extractCriticalAnchors(
  anchorTokens: string[],
  topicTokens: string[],
  queryTokens: string[]
) {
  const merged = Array.from(new Set([...anchorTokens, ...topicTokens, ...queryTokens]));
  const strictFirst = merged.filter((token) => STRICT_VISUAL_ANCHOR_TOKENS.has(token));
  if (strictFirst.length > 0) {
    return strictFirst.slice(0, 3);
  }

  const critical = merged.filter((token) => CRITICAL_ANCHOR_TOKENS.has(token));

  if (critical.length > 0) {
    return critical.slice(0, 4);
  }

  const fallback = merged.filter(
    (token) =>
      token.length >= 5 &&
      !GENERIC_QUERY_TOKENS.has(token) &&
      !QUERY_NOISE_WORDS.has(token)
  );

  return fallback.slice(0, 3);
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

function getVisualQualitySignal(title: string, tags: string[]) {
  const metadata = `${title} ${tags.join(" ")}`.toLowerCase();
  if (!metadata.trim()) {
    return 0.34;
  }

  let score = 0.32;
  if (QUALITY_SIGNAL_RE.test(metadata)) {
    score += 0.3;
  }
  if (/\b(high[\s-]?res|4k|hd|dslr|bokeh|daylight)\b/i.test(metadata)) {
    score += 0.14;
  }
  if (/\b(editorial|documentary|realistic|natural)\b/i.test(metadata)) {
    score += 0.12;
  }
  if (LOW_QUALITY_SOFT_RE.test(metadata)) {
    score -= 0.18;
  }

  return clampScore(score);
}

function getQualityPenalty(url: string, title: string, tags: string[]) {
  let penalty = 0;
  const metadata = `${title} ${tags.join(" ")}`.toLowerCase();

  if (LOW_QUALITY_SOFT_RE.test(metadata)) {
    penalty += 0.08;
  }

  if (url.toLowerCase().includes("watermark")) {
    penalty += 0.18;
  }

  if (isBlockedHost(url)) {
    penalty += 0.32;
  }

  return penalty;
}

function isLowQualityUrl(url: string) {
  const lower = url.toLowerCase();
  return (
    lower.includes("placeholder") ||
    lower.includes("watermark") ||
    lower.includes("logo") ||
    lower.includes("icon") ||
    lower.includes("sprite") ||
    isBlockedHost(lower) ||
    lower.endsWith(".svg") ||
    lower.endsWith(".gif")
  );
}

function isLowQualityMetadata(title: string, tags: string[]) {
  const metadata = `${title} ${tags.join(" ")}`.toLowerCase();
  return LOW_QUALITY_META_RE.test(metadata);
}

function isLowQualityDimensions(width?: number, height?: number) {
  if (!width || !height || width <= 0 || height <= 0) {
    return false;
  }

  const minSide = Math.min(width, height);
  const area = width * height;
  const ratio = width / height;

  if (minSide < 360) {
    return true;
  }

  if (area < 260_000) {
    return true;
  }

  return ratio < 0.42 || ratio > 3.4;
}

function isUnsupportedMimeType(mimeType?: string) {
  if (!mimeType) {
    return false;
  }

  const normalized = mimeType.toLowerCase();
  return normalized.includes("svg") || normalized.includes("gif");
}

function toFiniteNumber(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return undefined;
  }

  return Math.round(numeric);
}

function isBlockedHost(url: string) {
  const lower = url.toLowerCase();
  return BLOCKED_HOST_FRAGMENTS.some((fragment) => lower.includes(fragment));
}

function clampScore(score: number) {
  return Math.max(0, Math.min(1, score));
}
