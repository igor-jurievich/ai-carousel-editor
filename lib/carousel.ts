import type {
  CanvasElement,
  CanvasSlideType,
  CarouselOutlineSlide,
  CarouselSlideRole,
  CarouselTemplate,
  CarouselTemplateId,
  ImageElement,
  ShapeElement,
  Slide,
  SlideFormat,
  TextElement
} from "@/types/editor";
import {
  clampSlidesCount,
  DEFAULT_SLIDES_COUNT,
  MAX_SLIDES_COUNT,
  MIN_SLIDES_COUNT
} from "@/lib/slides";

export const SLIDE_SIZE = 1080;
export const DEFAULT_PROFILE_HANDLE = "@username";
export const DEFAULT_PROFILE_SUBTITLE = "";
export { clampSlidesCount, DEFAULT_SLIDES_COUNT, MAX_SLIDES_COUNT, MIN_SLIDES_COUNT };

export const SLIDE_FORMAT_DIMENSIONS: Record<
  SlideFormat,
  { width: number; height: number; label: string }
> = {
  "1:1": { width: 1080, height: 1080, label: "Instagram square" },
  "4:5": { width: 1080, height: 1350, label: "Instagram portrait" },
  "9:16": { width: 1080, height: 1920, label: "Stories / Reels" }
};

export const PRIMARY_TEMPLATE_IDS = ["dark", "light", "color"] as const satisfies readonly CarouselTemplateId[];

export const CAROUSEL_TEMPLATES: CarouselTemplate[] = [
  {
    id: "dark",
    name: "Тёмный",
    description: "Контрастная тёмная тема в стиле editorial: глубокий фон и резкий акцент.",
    accent: "#ff2a2a",
    accentAlt: "#ff5e5e",
    background: "#090d16",
    surface: "#101523",
    titleColor: "#f6f8ff",
    bodyColor: "#d7deee",
    titleFont: "Oswald",
    bodyFont: "Manrope",
    chipStyle: "outline",
    decoration: "grid",
    accentMode: "text",
    gridMode: "vertical",
    gridStep: 108,
    gridOpacity: 0.14,
    preview: "Контрастная тёмная подача"
  },
  {
    id: "light",
    name: "Светлый",
    description: "Чистая светлая тема с сеткой и холодным синим акцентом.",
    accent: "#1f49ff",
    accentAlt: "#5a77ff",
    background: "#f1f3f7",
    surface: "#ffffff",
    titleColor: "#181d29",
    bodyColor: "#2a3342",
    titleFont: "Russo One",
    bodyFont: "Manrope",
    chipStyle: "solid",
    decoration: "grid",
    accentMode: "chip",
    gridMode: "full",
    gridStep: 72,
    gridOpacity: 0.1,
    preview: "Чистая светлая подача"
  },
  {
    id: "color",
    name: "Цветной",
    description: "Яркая журнальная тема: жёлтый фон, красные плашки и плотная типографика.",
    accent: "#ff2d00",
    accentAlt: "#ff6b3d",
    background: "#ffeb0a",
    surface: "#fff06a",
    titleColor: "#171b24",
    bodyColor: "#1e2431",
    titleFont: "Oswald",
    bodyFont: "Manrope",
    chipStyle: "solid",
    decoration: "grid",
    accentMode: "chip",
    gridMode: "dots",
    gridStep: 72,
    gridOpacity: 0.12,
    preview: "Яркая журнальная подача"
  }
];

type OutlineLike = Partial<CarouselOutlineSlide> & {
  title?: string;
  text?: string;
  body?: string;
  subtitle?: string;
  bullets?: string[];
  before?: string;
  after?: string;
  type?: CarouselSlideRole;
};

type SlideBlueprint = {
  role: CarouselSlideRole;
  slideType: CanvasSlideType;
  title: string;
  body: string;
};

type SlidePalette = {
  background: string;
  titleColor: string;
  bodyColor: string;
  accent: string;
  accentMode: "none" | "text" | "chip";
  gridMode: "full" | "vertical" | "dots";
  gridStep: number;
  gridColor: string;
};

type TextFitResult = {
  text: string;
  fontSize: number;
  height: number;
  wasAutoTruncated: boolean;
};

const MANAGED_META_KEYS = new Set([
  "decor-grid-line",
  "profile-handle",
  "footer-counter",
  "profile-subtitle",
  "footer-arrow",
  "managed-title",
  "managed-title-accent-chip",
  "managed-title-accent-text",
  "managed-body",
  "image-placeholder",
  "image-placeholder-text",
  "image-top"
]);

const ROLE_FLOW_BY_COUNT: Record<number, CarouselSlideRole[]> = {
  8: ["hook", "problem", "mistake", "consequence", "shift", "solution", "example", "cta"],
  9: ["hook", "problem", "amplify", "mistake", "consequence", "shift", "solution", "example", "cta"],
  10: [
    "hook",
    "problem",
    "amplify",
    "mistake",
    "consequence",
    "shift",
    "solution",
    "solution",
    "example",
    "cta"
  ]
};

const ROLE_TO_SLIDE_TYPE: Record<CarouselSlideRole, CanvasSlideType> = {
  hook: "image_text",
  problem: "list",
  amplify: "list",
  mistake: "big_text",
  consequence: "list",
  shift: "big_text",
  solution: "list",
  example: "text",
  cta: "cta"
};

export function getTemplate(templateId: CarouselTemplateId) {
  return CAROUSEL_TEMPLATES.find((template) => template.id === templateId) ?? CAROUSEL_TEMPLATES[1];
}

function resolveTemplateId(candidate: CarouselTemplateId | undefined, fallback: CarouselTemplateId) {
  if (candidate && CAROUSEL_TEMPLATES.some((template) => template.id === candidate)) {
    return candidate;
  }

  return fallback;
}

export function getPrimaryTemplates() {
  return PRIMARY_TEMPLATE_IDS.map((id) => getTemplate(id));
}

function clampValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeMultilineText(value: string) {
  return value
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .trim();
}

function normalizeWordTokens(value: string) {
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

const GENERIC_ERROR_LEAD_RE = /^(одн[а-яё]*\s+)?(типичн[а-яё]*\s+)?(главн[а-яё]*\s+)?ошиб[а-яё]*/iu;
const TITLE_DEDUPE_STOP_WORDS = new Set([
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
  "когда",
  "почему",
  "вместо",
  "после",
  "до"
]);
const LEGACY_TITLE_TEMPLATE_RE =
  /\b(по\s+теме|в\s+теме|где\s+ломается\s+поток|что\s+это\s+стоит\s+в\s+теме|разбор\s+под\s+ваш\s+кейс)\b/iu;
const TITLE_ACCENT_STOP_WORDS = new Set([
  "как",
  "когда",
  "почему",
  "что",
  "это",
  "если",
  "или",
  "чтобы",
  "для",
  "про",
  "под",
  "без",
  "при",
  "у",
  "в",
  "на",
  "по",
  "из",
  "до",
  "после",
  "и",
  "а",
  "но",
  "мы",
  "вы"
]);

function shouldDedupeTitleToken(token: string) {
  return token.length >= 4 && !TITLE_DEDUPE_STOP_WORDS.has(token);
}

function sanitizeBlueprintText(value: string, maxLength: number, dedupeGlobal = false) {
  const normalized = normalizeMultilineText(value).replace(/\s+([.,!?;:])/gu, "$1");
  if (!normalized) {
    return "";
  }

  const globalTokens = dedupeGlobal ? new Set<string>() : null;
  const lines = normalized.split("\n");
  const resultLines = lines.map((line) => {
    const words = line.split(" ").filter(Boolean);
    const compactWords: string[] = [];
    let previousToken = "";

    for (const word of words) {
      const token = normalizeWordTokens(word)[0] ?? "";
      if (token && token === previousToken) {
        continue;
      }

      if (globalTokens && token && shouldDedupeTitleToken(token) && globalTokens.has(token)) {
        continue;
      }

      compactWords.push(word);
      previousToken = token || previousToken;
      if (globalTokens && token && shouldDedupeTitleToken(token)) {
        globalTokens.add(token);
      }
    }

    return compactWords.join(" ").trim();
  });

  const compacted = dedupeGlobal
    ? collapseTitleRepetition(resultLines.join("\n").trim())
    : resultLines.join("\n").trim();

  return compactTextLength(compacted, maxLength);
}

function sanitizeBulletLine(value: string) {
  return sanitizeBlueprintText(value, 132).replace(/^[•·\-–—→\s]+/u, "").trim();
}

function collapseTitleRepetition(value: string) {
  if (!value) {
    return "";
  }

  const words = value.split(/\s+/u).filter(Boolean);
  if (words.length <= 2) {
    return value;
  }

  const compactWords: string[] = [];
  for (const word of words) {
    const token = normalizeWordTokens(word)[0] ?? "";
    const previous = compactWords[compactWords.length - 1] ?? "";
    const previousToken = normalizeWordTokens(previous)[0] ?? "";
    const prePrevious = compactWords[compactWords.length - 2] ?? "";
    const prePreviousToken = normalizeWordTokens(prePrevious)[0] ?? "";

    if (token && token === previousToken) {
      continue;
    }

    if (token && shouldDedupeTitleToken(token) && token === prePreviousToken) {
      continue;
    }

    compactWords.push(word);
  }

  return compactWords.join(" ");
}

function compactTextLength(text: string, maxChars: number) {
  const normalized = normalizeMultilineText(text);
  if (normalized.length <= maxChars) {
    return normalized;
  }

  const sliced = normalized.slice(0, maxChars + 1).trimEnd();
  if (!sliced) {
    return "";
  }

  const minBoundary = Math.max(20, Math.floor(maxChars * 0.45));
  const sentenceBoundary = Math.max(
    sliced.lastIndexOf(". "),
    sliced.lastIndexOf("! "),
    sliced.lastIndexOf("? "),
    sliced.lastIndexOf(".\n"),
    sliced.lastIndexOf("!\n"),
    sliced.lastIndexOf("?\n")
  );
  if (sentenceBoundary >= minBoundary) {
    return sliced.slice(0, sentenceBoundary + 1).trim();
  }

  const lineBoundary = sliced.lastIndexOf("\n");
  if (lineBoundary >= minBoundary) {
    return sliced.slice(0, lineBoundary).trim();
  }

  const pauseBoundary = Math.max(sliced.lastIndexOf(", "), sliced.lastIndexOf(": "), sliced.lastIndexOf(" — "));
  if (pauseBoundary >= minBoundary) {
    return sliced.slice(0, pauseBoundary).trim();
  }

  const wordBoundary = sliced.lastIndexOf(" ");
  if (wordBoundary >= Math.max(16, Math.floor(maxChars * 0.4))) {
    return sliced.slice(0, wordBoundary).trim();
  }

  return sliced.slice(0, maxChars).trim();
}

function estimateCharWidth(char: string, fontSize: number) {
  if (char === " ") {
    return fontSize * 0.34;
  }

  if (char === "→") {
    return fontSize * 0.56;
  }

  if (/[.,;:!?'"`(){}[\]-]/.test(char)) {
    return fontSize * 0.38;
  }

  if (/[0-9]/.test(char)) {
    return fontSize * 0.58;
  }

  if (/[A-ZА-ЯЁ]/.test(char)) {
    return fontSize * 0.66;
  }

  return fontSize * 0.57;
}

function estimateTextHeight(text: string, width: number, fontSize: number, lineHeight: number) {
  if (!text.trim()) {
    return fontSize * lineHeight;
  }

  const lines = text.split("\n");
  let visualLines = 0;

  for (const line of lines) {
    if (!line) {
      visualLines += 1;
      continue;
    }

    let currentLineWidth = 0;

    for (const char of line) {
      const charWidth = estimateCharWidth(char, fontSize);
      if (currentLineWidth + charWidth > width && currentLineWidth > 0) {
        visualLines += 1;
        currentLineWidth = 0;
      }
      currentLineWidth += charWidth;
    }

    visualLines += 1;
  }

  return Math.ceil(visualLines * fontSize * lineHeight + fontSize * 0.3);
}

function estimateVisualLineCount(text: string, width: number, fontSize: number, lineHeight: number) {
  const measured = estimateTextHeight(text, width, fontSize, lineHeight) - fontSize * 0.3;
  return Math.max(1, Math.round(measured / Math.max(1, fontSize * lineHeight)));
}

function fitTextToBounds(
  text: string,
  width: number,
  maxHeight: number,
  preferredFontSize: number,
  minFontSize: number,
  lineHeight: number
): TextFitResult {
  const normalized = normalizeMultilineText(text);
  const measuredHeight = (value: string, size: number) =>
    estimateTextHeight(value, width, size, lineHeight) * 1.08;
  let fontSize = preferredFontSize;

  while (fontSize > minFontSize && measuredHeight(normalized, fontSize) > maxHeight) {
    fontSize -= 2;
  }

  // Keep full copy whenever possible by allowing a small reserve below min font before truncation.
  const reserveMinFontSize = Math.max(16, minFontSize - 10);
  while (fontSize > reserveMinFontSize && measuredHeight(normalized, fontSize) > maxHeight) {
    fontSize -= 1;
  }

  if (measuredHeight(normalized, fontSize) <= maxHeight) {
    return {
      text: normalized,
      fontSize,
      height: Math.ceil(estimateTextHeight(normalized, width, fontSize, lineHeight)),
      wasAutoTruncated: false
    };
  }

  let candidate = normalized;
  while (candidate.length > 24) {
    const shortened = compactTextLength(candidate, candidate.length - 2);
    if (!shortened || shortened === candidate) {
      break;
    }

    candidate = shortened;
    if (measuredHeight(candidate, minFontSize) <= maxHeight) {
      break;
    }
  }

  return {
    text: candidate,
    fontSize: minFontSize,
    height: Math.ceil(
      clampValue(
        estimateTextHeight(candidate, width, minFontSize, lineHeight),
        minFontSize * lineHeight,
        maxHeight
      )
    ),
    wasAutoTruncated: true
  };
}

function createFittedTextElement(
  overrides: Partial<TextElement> &
    Pick<TextElement, "text" | "role" | "x" | "y" | "width" | "height" | "fontFamily" | "fontStyle" | "fill"> & {
      preferredFontSize: number;
      minFontSize: number;
      lineHeight: number;
    }
) {
  const fitted = fitTextToBounds(
    overrides.text,
    overrides.width,
    overrides.height,
    overrides.preferredFontSize,
    overrides.minFontSize,
    overrides.lineHeight
  );

  return createTextElement({
    ...overrides,
    text: fitted.text,
    fontSize: fitted.fontSize,
    height: clampValue(
      fitted.height,
      Math.round(overrides.minFontSize * overrides.lineHeight),
      overrides.height
    ),
    lineHeight: overrides.lineHeight,
    wasAutoTruncated: fitted.wasAutoTruncated
  });
}

function resolveSlidePalette(template: CarouselTemplate, blueprint: SlideBlueprint): SlidePalette {
  const baseGridStep = template.gridStep ?? 74;
  const baseGridOpacity = template.gridOpacity ?? 0.08;
  const baseGridColor =
    template.id === "dark"
      ? `rgba(255, 255, 255, ${baseGridOpacity})`
      : `rgba(20, 27, 36, ${baseGridOpacity})`;

  if (template.id === "light" && blueprint.slideType === "big_text") {
    return {
      background: template.accent,
      titleColor: "#f5f7ff",
      bodyColor: "#eff3ff",
      accent: "#f5f7ff",
      accentMode: "none",
      gridMode: "full",
      gridStep: baseGridStep,
      gridColor: "rgba(255, 255, 255, 0.12)"
    };
  }

  if (template.id === "light") {
    return {
      background: template.background,
      titleColor: template.titleColor,
      bodyColor: template.bodyColor,
      accent: template.accent,
      accentMode: "chip",
      gridMode: "full",
      gridStep: baseGridStep,
      gridColor: baseGridColor
    };
  }

  if (template.id === "color") {
    return {
      background: template.background,
      titleColor: template.titleColor,
      bodyColor: template.bodyColor,
      accent: template.accent,
      accentMode: "chip",
      gridMode: "dots",
      gridStep: baseGridStep,
      gridColor: "rgba(20, 24, 32, 0.12)"
    };
  }

  if (template.id === "dark") {
    return {
      background: template.background,
      titleColor: template.titleColor,
      bodyColor: template.bodyColor,
      accent: template.accent,
      accentMode: blueprint.slideType === "big_text" ? "none" : "chip",
      gridMode: "vertical",
      gridStep: baseGridStep,
      gridColor: baseGridColor
    };
  }

  return {
    background: template.background,
    titleColor: template.titleColor,
    bodyColor: template.bodyColor,
    accent: template.accent,
    accentMode: template.accentMode ?? "none",
    gridMode: template.gridMode ?? "full",
    gridStep: baseGridStep,
    gridColor: baseGridColor
  };
}

function trimAccentEdge(raw: string) {
  return raw
    .replace(/^[\s.,;:!?'"«»(){}\[\]—-]+/u, "")
    .replace(/[\s.,;:!?'"«»(){}\[\]—-]+$/u, "");
}

function isAccentCandidateWord(value: string) {
  const normalized = trimAccentEdge(value).toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized.length < 2 || normalized.length > 24) {
    return false;
  }
  return !TITLE_ACCENT_STOP_WORDS.has(normalized);
}

function resolveTitleAccent(title: string) {
  const normalized = normalizeMultilineText(title);
  if (!normalized) {
    return null;
  }

  const tokenPattern = /[\p{L}\p{N}-]+/gu;
  const tokens = Array.from(normalized.matchAll(tokenPattern));
  if (!tokens.length) {
    return null;
  }

  const pickToken = (token: RegExpMatchArray | undefined) => {
    if (!token) {
      return null;
    }
    const raw = token[0] ?? "";
    const text = trimAccentEdge(raw);
    if (!isAccentCandidateWord(text)) {
      return null;
    }
    const start = typeof token.index === "number" ? token.index : normalized.indexOf(raw);
    if (start < 0) {
      return null;
    }
    return {
      text,
      start,
      end: start + text.length
    };
  };

  const quotePattern = /["«](.+?)["»]/gu;
  const quotes = Array.from(normalized.matchAll(quotePattern));
  for (const quoteMatch of quotes) {
    const quoteStart = quoteMatch.index ?? -1;
    if (quoteStart < 0) {
      continue;
    }
    const quoteText = quoteMatch[0] ?? "";
    const quoteEnd = quoteStart + quoteText.length;
    const tokensInQuote = tokens.filter((token) => {
      if (typeof token.index !== "number") {
        return false;
      }
      return token.index > quoteStart && token.index < quoteEnd;
    });

    for (let index = tokensInQuote.length - 1; index >= 0; index -= 1) {
      const picked = pickToken(tokensInQuote[index]);
      if (picked) {
        return picked;
      }
    }
  }

  const numericCandidate = tokens.find((token) => /[\d%]/u.test(token[0] ?? ""));
  const pickedNumeric = pickToken(numericCandidate);
  if (pickedNumeric) {
    return pickedNumeric;
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const picked = pickToken(tokens[index]);
    if (!picked) {
      continue;
    }
    if (picked.text.length >= 5 || index === 0) {
      return picked;
    }
  }

  const fallbackToken = tokens[0];
  const fallbackText = trimAccentEdge(fallbackToken?.[0] ?? "");
  if (!fallbackText || fallbackText.length < 2 || fallbackText.length > 24) {
    return null;
  }
  const fallbackStart =
    typeof fallbackToken?.index === "number" ? fallbackToken.index : normalized.indexOf(fallbackText);
  if (fallbackStart < 0) {
    return null;
  }

  return {
    text: fallbackText,
    start: fallbackStart,
    end: fallbackStart + fallbackText.length
  };
}

function resolveLeadingTitleAccent(title: string) {
  const normalized = normalizeMultilineText(title);
  if (!normalized) {
    return null;
  }

  const tokenPattern = /[\p{L}\p{N}-]+/gu;
  const tokens = Array.from(normalized.matchAll(tokenPattern));
  if (!tokens.length) {
    return null;
  }

  for (const token of tokens) {
    const raw = token[0] ?? "";
    const text = trimAccentEdge(raw);
    if (!isAccentCandidateWord(text)) {
      continue;
    }
    const start = typeof token.index === "number" ? token.index : normalized.indexOf(raw);
    if (start < 0) {
      continue;
    }
    return {
      text,
      start,
      end: start + text.length
    };
  }

  return null;
}

function resolveReadableAccentTextColor(fill: string) {
  const hex = fill.trim().replace(/^#/, "");
  const normalized =
    hex.length === 3
      ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
      : hex.length === 6
        ? hex
        : "";

  if (!normalized) {
    return "#ffffff";
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  return luma > 0.6 ? "#101621" : "#ffffff";
}

function estimateTextWidth(value: string, fontSize: number) {
  if (!value) {
    return 0;
  }
  return value.split("").reduce((sum, char) => sum + estimateCharWidth(char, fontSize), 0);
}

let textMeasureCanvas: HTMLCanvasElement | null = null;

function resolveFontWeight(fontStyle?: string) {
  if (!fontStyle) {
    return "700";
  }

  const normalized = fontStyle.toLowerCase();
  if (normalized.includes("bold")) {
    return "700";
  }
  if (normalized.includes("500")) {
    return "500";
  }

  return "400";
}

function measureTextWidth(
  value: string,
  fontSize: number,
  fontFamily: string,
  fontStyle?: string
) {
  if (!value) {
    return 0;
  }

  if (typeof document !== "undefined") {
    try {
      if (!textMeasureCanvas) {
        textMeasureCanvas = document.createElement("canvas");
      }
      const context = textMeasureCanvas.getContext("2d");
      if (context) {
        const weight = resolveFontWeight(fontStyle);
        context.font = `${weight} ${fontSize}px "${fontFamily}", sans-serif`;
        const measured = context.measureText(value).width;
        if (Number.isFinite(measured) && measured > 0) {
          return measured;
        }
      }
    } catch {
      // Fallback to rough estimate when canvas context/font is unavailable.
    }
  }

  return estimateTextWidth(value, fontSize);
}

function wrapTextLinesByWidth(
  text: string,
  width: number,
  fontSize: number,
  fontFamily: string,
  fontStyle?: string
) {
  const normalized = normalizeMultilineText(text);
  if (!normalized) {
    return [] as string[];
  }

  const lines: string[] = [];
  const spaceWidth = measureTextWidth(" ", fontSize, fontFamily, fontStyle);
  const paragraphs = normalized.split("\n");

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/u).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }

    let currentLine = words[0];
    let currentWidth = measureTextWidth(words[0], fontSize, fontFamily, fontStyle);

    for (let index = 1; index < words.length; index += 1) {
      const word = words[index];
      const wordWidth = measureTextWidth(word, fontSize, fontFamily, fontStyle);
      const nextWidth = currentWidth + spaceWidth + wordWidth;

      if (nextWidth <= width || !currentLine) {
        currentLine = `${currentLine} ${word}`;
        currentWidth = nextWidth;
        continue;
      }

      lines.push(currentLine);
      currentLine = word;
      currentWidth = wordWidth;
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

function isWordChar(value: string) {
  return /[\p{L}\p{N}-]/u.test(value);
}

function findAccentInLine(line: string, accentText: string) {
  const haystack = line.toLowerCase();
  const needle = accentText.toLowerCase();
  if (!needle) {
    return -1;
  }

  let index = haystack.indexOf(needle);
  while (index !== -1) {
    const before = index > 0 ? line[index - 1] : "";
    const after = index + needle.length < line.length ? line[index + needle.length] : "";
    const isBoundaryBefore = !before || !isWordChar(before);
    const isBoundaryAfter = !after || !isWordChar(after);
    if (isBoundaryBefore && isBoundaryAfter) {
      return index;
    }
    index = haystack.indexOf(needle, index + 1);
  }

  return -1;
}

function resolveTitleAccentPosition(titleElement: TextElement, accentText: string) {
  const lineHeight = titleElement.lineHeight ?? 1.05;
  const lines = wrapTextLinesByWidth(
    titleElement.text,
    titleElement.width,
    titleElement.fontSize,
    titleElement.fontFamily,
    titleElement.fontStyle
  );
  if (!lines.length) {
    return null;
  }

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const startInLine = findAccentInLine(line, accentText);
    if (startInLine === -1) {
      continue;
    }

    const prefix = line.slice(0, startInLine);
    const suffix = line.slice(startInLine + accentText.length);
    const xOffset = Math.round(
      measureTextWidth(prefix, titleElement.fontSize, titleElement.fontFamily, titleElement.fontStyle)
    );
    const suffixWidth = Math.round(
      measureTextWidth(suffix, titleElement.fontSize, titleElement.fontFamily, titleElement.fontStyle)
    );
    const yOffset = Math.round(lineIndex * titleElement.fontSize * lineHeight);

    return {
      x: titleElement.x + xOffset,
      y: titleElement.y + yOffset,
      lineIndex,
      startInLine,
      suffixWidth
    };
  }

  return null;
}

function buildTitleAccentElements(params: {
  titleElement: TextElement;
  palette: SlidePalette;
  template: CarouselTemplate;
}): CanvasElement[] {
  const { titleElement, palette } = params;

  if (palette.accentMode === "none") {
    return [];
  }

  // Long/truncated headings are already visually dense; accent overlays there tend to look noisy.
  if (titleElement.wasAutoTruncated || normalizeMultilineText(titleElement.text).length > 86) {
    return [];
  }
  const lineHeight = titleElement.lineHeight ?? 1.05;
  const visualLines = estimateVisualLineCount(
    titleElement.text,
    titleElement.width,
    titleElement.fontSize,
    lineHeight
  );
  if (visualLines > 2) {
    return [];
  }

  let accent = resolveTitleAccent(titleElement.text);
  if (!accent?.text) {
    return [];
  }

  const accentLength = accent.text.length;
  if (accentLength < 2 || accentLength > 32) {
    return [];
  }

  let accentPosition = resolveTitleAccentPosition(titleElement, accent.text);
  if (accentPosition && accentPosition.lineIndex > 1) {
    const leadingAccent = resolveLeadingTitleAccent(titleElement.text);
    if (!leadingAccent?.text) {
      return [];
    }
    const leadingPosition = resolveTitleAccentPosition(titleElement, leadingAccent.text);
    if (!leadingPosition || leadingPosition.lineIndex > 1) {
      return [];
    }
    accent = leadingAccent;
    accentPosition = leadingPosition;
  }
  if (!accentPosition) {
    return [];
  }

  // Keep chip-accent geometry deterministic.
  // If selected token lands on lower lines, too late in line, or very close to wrap edge,
  // fallback to leading stable token to avoid visual duplication/drift.
  const unstableAccentPosition =
    accentPosition.lineIndex > 0 ||
    accentPosition.startInLine > 16 ||
    accentPosition.suffixWidth < Math.round(titleElement.fontSize * 0.22);
  if (unstableAccentPosition) {
    const leadingAccent = resolveLeadingTitleAccent(titleElement.text);
    const leadingPosition =
      leadingAccent?.text ? resolveTitleAccentPosition(titleElement, leadingAccent.text) : null;
    if (leadingAccent?.text && leadingPosition && leadingPosition.lineIndex === 0) {
      accent = leadingAccent;
      accentPosition = leadingPosition;
    } else if (accentPosition.lineIndex > 0) {
      return [];
    }
  }

  const accentX = accentPosition.x;
  const accentY = accentPosition.y;
  const accentWidth = Math.ceil(
    measureTextWidth(accent.text, titleElement.fontSize, titleElement.fontFamily, titleElement.fontStyle)
  );
  const textWidth = Math.ceil(clampValue(accentWidth + 4, 16, titleElement.width));
  const textHeight = Math.ceil(titleElement.fontSize * lineHeight);
  const accentCoverage = textWidth / Math.max(1, titleElement.width);
  if (accentCoverage > 0.7 && visualLines > 1) {
    return [];
  }

  if (palette.accentMode === "chip" || palette.accentMode === "text") {
    const chipPadX = Math.max(8, Math.round(titleElement.fontSize * 0.14));
    const chipPadY = Math.max(5, Math.round(titleElement.fontSize * 0.08));
    const maxChipWidth = Math.max(34, titleElement.width - Math.max(0, accentX - titleElement.x));
    const chipWidth = clampValue(accentWidth + chipPadX * 2, 34, maxChipWidth);
    const accentTextWidth = Math.max(18, maxChipWidth - chipPadX);
    return [
      createShapeElement({
        metaKey: "managed-title-accent-chip",
        x: accentX - chipPadX,
        y: accentY - chipPadY,
        width: chipWidth,
        height: textHeight + chipPadY * 2,
        fill: palette.accent,
        opacity: 0.94,
        cornerRadius: Math.round(titleElement.fontSize * 0.08)
      }),
      createTextElement({
        role: "title",
        metaKey: "managed-title-accent-text",
        text: accent.text,
        x: accentX,
        y: accentY,
        // Keep enough width so Konva does not wrap the last symbol to the next visual line.
        width: accentTextWidth,
        height: textHeight,
        fontSize: titleElement.fontSize,
        lineHeight: titleElement.lineHeight ?? 1.05,
        fontFamily: titleElement.fontFamily,
        fontStyle: titleElement.fontStyle ?? "bold",
        fill: resolveReadableAccentTextColor(palette.accent),
        align: "left",
        rotation: titleElement.rotation,
        opacity: titleElement.opacity
      })
    ];
  }
  return [];
}

function composeTitleAndAccentElements(params: {
  titleElement: TextElement;
  palette: SlidePalette;
  template: CarouselTemplate;
}) {
  const { titleElement, palette, template } = params;
  const accents = buildTitleAccentElements({ titleElement, palette, template });

  if (!accents.length) {
    return [titleElement];
  }

  const accentShapes = accents.filter((element) => element.type === "shape");
  const accentText = accents.filter((element) => element.type === "text");

  if (palette.accentMode === "chip") {
    return [...accentShapes, titleElement, ...accentText];
  }

  return [...accentShapes, ...accentText, titleElement];
}

export function createTextElement(
  overrides: Partial<TextElement> & Pick<TextElement, "text" | "role">
): TextElement {
  const isTitle = overrides.role === "title";

  return {
    id: crypto.randomUUID(),
    type: "text",
    role: overrides.role,
    metaKey: overrides.metaKey,
    wasAutoTruncated: overrides.wasAutoTruncated ?? false,
    text: overrides.text,
    x: overrides.x ?? 84,
    y: overrides.y ?? (isTitle ? 320 : 530),
    width: overrides.width ?? 912,
    height: overrides.height ?? (isTitle ? 220 : 300),
    fontSize: overrides.fontSize ?? (isTitle ? 92 : 44),
    fontFamily: overrides.fontFamily ?? (isTitle ? "Russo One" : "Manrope"),
    fontStyle: overrides.fontStyle ?? (isTitle ? "bold" : "normal"),
    fill: overrides.fill ?? "#1b1e24",
    align: overrides.align ?? "left",
    lineHeight: overrides.lineHeight ?? (isTitle ? 1.04 : 1.2),
    rotation: overrides.rotation ?? 0,
    opacity: overrides.opacity ?? 1,
    letterSpacing: overrides.letterSpacing ?? 0,
    textDecoration: overrides.textDecoration
  };
}

export function createShapeElement(overrides: Partial<ShapeElement> = {}): ShapeElement {
  return {
    id: crypto.randomUUID(),
    type: "shape",
    metaKey: overrides.metaKey,
    shape: overrides.shape ?? "rect",
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    width: overrides.width ?? 100,
    height: overrides.height ?? 100,
    fill: overrides.fill ?? "#000000",
    opacity: overrides.opacity ?? 1,
    rotation: overrides.rotation ?? 0,
    cornerRadius: overrides.cornerRadius ?? 0,
    stroke: overrides.stroke,
    strokeWidth: overrides.strokeWidth ?? 0
  };
}

export function createImageElement(src: string, overrides: Partial<ImageElement> = {}): ImageElement {
  return {
    id: crypto.randomUUID(),
    type: "image",
    metaKey: overrides.metaKey,
    src,
    x: overrides.x ?? 72,
    y: overrides.y ?? 82,
    width: overrides.width ?? 936,
    height: overrides.height ?? 460,
    opacity: overrides.opacity ?? 1,
    rotation: overrides.rotation ?? 0,
    cornerRadius: overrides.cornerRadius ?? 0,
    fitMode: overrides.fitMode ?? "cover",
    zoom: overrides.zoom ?? 1,
    offsetX: overrides.offsetX ?? 0,
    offsetY: overrides.offsetY ?? 0,
    naturalWidth: overrides.naturalWidth,
    naturalHeight: overrides.naturalHeight,
    darken: overrides.darken ?? 0,
    stroke: overrides.stroke,
    strokeWidth: overrides.strokeWidth ?? 0
  };
}

function resolveOutlineRole(
  outline: OutlineLike,
  index: number,
  totalSlides: number
): CarouselSlideRole {
  if (
    outline.type === "hook" ||
    outline.type === "problem" ||
    outline.type === "amplify" ||
    outline.type === "mistake" ||
    outline.type === "consequence" ||
    outline.type === "shift" ||
    outline.type === "solution" ||
    outline.type === "example" ||
    outline.type === "cta"
  ) {
    return outline.type;
  }

  if (index === 0) {
    return "hook";
  }

  if (index === totalSlides - 1) {
    return "cta";
  }

  return "solution";
}

function readTitle(role: CarouselSlideRole, outline: OutlineLike) {
  if (typeof outline.title === "string" && outline.title.trim()) {
    const cleaned = sanitizeBlueprintText(outline.title, titleMaxLengthByRole(role), true);
    if (cleaned && GENERIC_ERROR_LEAD_RE.test(cleaned) && role !== "mistake") {
      return fallbackTitleByRole(role);
    }

    if (cleaned && LEGACY_TITLE_TEMPLATE_RE.test(cleaned)) {
      return fallbackTitleByRole(role);
    }

    if (cleaned) {
      return cleaned;
    }
  }

  const derived = deriveTitleFromOutline(role, outline);
  if (derived) {
    return derived;
  }

  return fallbackTitleByRole(role);
}

function titleMaxLengthByRole(role: CarouselSlideRole) {
  if (role === "hook") {
    return 78;
  }

  if (role === "mistake" || role === "shift") {
    return 86;
  }

  if (role === "cta") {
    return 82;
  }

  return 80;
}

function fallbackTitleByRole(role: CarouselSlideRole) {
  if (role === "hook") {
    return "Точка роста, которую часто упускают";
  }

  if (role === "problem") {
    return "Почему читатель теряет нить на старте";
  }

  if (role === "amplify") {
    return "Как эта просадка накапливается";
  }

  if (role === "mistake") {
    return "Ключевой миф, который мешает";
  }

  if (role === "consequence") {
    return "Где начинаются потери после этого шага";
  }

  if (role === "shift") {
    return "Что поменять в логике подачи";
  }

  if (role === "solution") {
    return "Следующий шаг, который можно применить сразу";
  }

  if (role === "example") {
    return "До/после на реальной ситуации";
  }

  if (role === "cta") {
    return "Хотите адаптацию под свою тему?";
  }

  return "Новый слайд";
}

function deriveTitleFromOutline(role: CarouselSlideRole, outline: OutlineLike) {
  const firstBullet = Array.isArray(outline.bullets)
    ? sanitizeBlueprintText(String(outline.bullets[0] ?? ""), 84, true)
    : "";

  if (firstBullet) {
    return sanitizeBlueprintText(firstBullet, titleMaxLengthByRole(role), true);
  }

  if (role === "example") {
    const before = typeof outline.before === "string" ? sanitizeBlueprintText(outline.before, 84) : "";
    const after = typeof outline.after === "string" ? sanitizeBlueprintText(outline.after, 84) : "";
    const anchor = before || after;
    if (anchor) {
      const cleanedAnchor = sanitizeBlueprintText(
        anchor
          .replace(/^до:\s*/iu, "")
          .replace(/^после:\s*/iu, ""),
        62
      );
      if (cleanedAnchor) {
        return sanitizeBlueprintText(`До/после: ${cleanedAnchor}`, titleMaxLengthByRole(role), true);
      }
    }
  }

  return "";
}

function readBody(role: CarouselSlideRole, outline: OutlineLike) {
  if (role === "hook") {
    const subtitle = typeof outline.subtitle === "string" ? outline.subtitle.trim() : "";
    return sanitizeBlueprintText(
      subtitle || "Коротко разложим тему на практичные шаги без воды.",
      320
    );
  }

  if (role === "problem" || role === "amplify" || role === "consequence" || role === "solution") {
    const bullets = Array.isArray(outline.bullets)
      ? outline.bullets
          .map((item) => sanitizeBulletLine(String(item)))
          .filter(Boolean)
          .slice(0, 4)
      : [];

    if (bullets.length > 0) {
      const denseBullets = bullets.filter((item) => item.length >= 88).length >= 2;
      const visibleBullets = denseBullets ? bullets.slice(0, 3) : bullets;
      return visibleBullets.map((item) => `→ ${item}`).join("\n");
    }

    if (typeof outline.text === "string" && outline.text.trim()) {
      return sanitizeBlueprintText(outline.text, 430);
    }

    if (role === "consequence") {
      return "→ Подписчики читают, но не доходят до действия и не возвращаются к материалу\n→ Экспертность воспринимается слабее из-за нечеткой логики подачи\n→ Команда тратит больше времени, а результат по отклику остается нестабильным";
    }

    return "→ Покажите одну ключевую мысль и сразу добавьте практический контекст\n→ Подкрепите тезис фактом: цифрой, ситуацией или коротким кейсом\n→ Закройте слайд действием, которое читатель может сделать прямо сейчас";
  }

  if (role === "example") {
    const before = typeof outline.before === "string" ? outline.before.trim() : "";
    const after = typeof outline.after === "string" ? outline.after.trim() : "";
    if (before || after) {
      return sanitizeBlueprintText(`До: ${before || "—"}\nПосле: ${after || "—"}`, 320);
    }

    return "До: «Мы делаем качественно»\nПосле: «За 3 шага получили понятный и предсказуемый результат»";
  }

  if (role === "cta") {
    const subtitle = typeof outline.subtitle === "string" ? outline.subtitle.trim() : "";
    return sanitizeBlueprintText(
      subtitle || "Напишите «РАЗБОР» и получите структуру, адаптированную под вашу задачу.",
      300
    );
  }

  if (typeof outline.text === "string" && outline.text.trim()) {
    return sanitizeBlueprintText(outline.text, 340);
  }

  if (typeof outline.body === "string" && outline.body.trim()) {
    return sanitizeBlueprintText(outline.body, 340);
  }

  return "Добавьте короткий тезис и конкретный шаг.";
}

function outlineToBlueprint(
  outline: OutlineLike,
  index: number,
  totalSlides: number,
  forcedSlideType?: CanvasSlideType
): SlideBlueprint {
  const role = resolveOutlineRole(outline, index, totalSlides);
  const title = readTitle(role, outline);
  const body = readBody(role, outline);

  return {
    role,
    slideType: forcedSlideType ?? ROLE_TO_SLIDE_TYPE[role],
    title,
    body
  };
}

function resolveImageArea(format: SlideFormat) {
  const { width, height } = SLIDE_FORMAT_DIMENSIONS[format];
  const imageHeightRatio = format === "9:16" ? 0.42 : format === "4:5" ? 0.44 : 0.45;
  const imageHeight = Math.round(height * imageHeightRatio);

  return {
    x: 0,
    y: 0,
    width,
    height: imageHeight
  };
}

function resolveTextMetrics(format: SlideFormat) {
  const { width, height } = SLIDE_FORMAT_DIMENSIONS[format];
  const contentX = format === "9:16" ? 102 : format === "4:5" ? 96 : 86;
  const horizontalPadding = contentX * 2;
  const contentWidth = width - horizontalPadding;
  const headerY = format === "9:16" ? 78 : format === "4:5" ? 64 : 50;
  const footerY = height - (format === "9:16" ? 114 : 86);
  const titleY = Math.round(height * (format === "9:16" ? 0.34 : 0.33));
  const bodyY = Math.round(height * (format === "9:16" ? 0.51 : 0.52));

  return {
    width,
    height,
    contentX,
    contentWidth,
    headerY,
    footerY,
    titleY,
    bodyY
  };
}

function buildGridDecoration(format: SlideFormat, palette: SlidePalette) {
  const { width, height } = SLIDE_FORMAT_DIMENSIONS[format];
  const step = Math.max(58, Math.round(palette.gridStep));
  const lines: ShapeElement[] = [];

  if (palette.gridMode === "dots") {
    const dotSize = format === "9:16" ? 6 : 5;
    const offset = Math.round(step * 0.45);
    for (let y = offset; y <= height; y += step) {
      for (let x = offset; x <= width; x += step) {
        lines.push(
          createShapeElement({
            metaKey: "decor-grid-line",
            shape: "circle",
            x: x - dotSize / 2,
            y: y - dotSize / 2,
            width: dotSize,
            height: dotSize,
            fill: palette.gridColor,
            opacity: 1,
            cornerRadius: dotSize
          })
        );
      }
    }
    return lines;
  }

  for (let x = 0; x <= width; x += step) {
    lines.push(
      createShapeElement({
        metaKey: "decor-grid-line",
        x,
        y: 0,
        width: 1,
        height,
        fill: palette.gridColor,
        opacity: 1,
        cornerRadius: 0
      })
    );
  }

  if (palette.gridMode === "full") {
    for (let y = 0; y <= height; y += step) {
      lines.push(
        createShapeElement({
          metaKey: "decor-grid-line",
          x: 0,
          y,
          width,
          height: 1,
          fill: palette.gridColor,
          opacity: 1,
          cornerRadius: 0
        })
      );
    }
  }

  return lines;
}

function buildHeaderAndFooter(
  template: CarouselTemplate,
  palette: SlidePalette,
  index: number,
  totalSlides: number,
  format: SlideFormat,
  profileHandle: string,
  profileSubtitle: string
): TextElement[] {
  const metrics = resolveTextMetrics(format);
  const { width } = metrics;
  const bodyColor = palette.bodyColor;
  const handleText = profileHandle.trim() || DEFAULT_PROFILE_HANDLE;
  const subtitleText = normalizeProfileSubtitle(profileSubtitle);
  const captionFontSize = format === "9:16" ? 40 : 38;
  const counterFontSize = format === "9:16" ? 39 : 37;
  const subtitleFontSize = format === "9:16" ? 42 : 40;
  const arrowFontSize = format === "9:16" ? 64 : 58;

  const items: TextElement[] = [
    createFittedTextElement({
      role: "caption",
      metaKey: "profile-handle",
      text: handleText,
      x: metrics.contentX,
      y: metrics.headerY,
      width: Math.round(width * 0.44),
      height: 44,
      preferredFontSize: captionFontSize,
      minFontSize: 24,
      fontFamily: template.bodyFont,
      fontStyle: "normal",
      fill: bodyColor,
      align: "left",
      lineHeight: 1.1
    }),
    createFittedTextElement({
      role: "caption",
      metaKey: "footer-counter",
      text: `[ ${index + 1}/${totalSlides} ]`,
      x: width - Math.round(width * 0.25),
      y: metrics.headerY,
      width: Math.round(width * 0.17),
      height: 44,
      preferredFontSize: counterFontSize,
      minFontSize: 24,
      fontFamily: template.bodyFont,
      fontStyle: "normal",
      fill: bodyColor,
      align: "right",
      lineHeight: 1.1
    })
  ];

  if (subtitleText) {
    items.push(
      createFittedTextElement({
        role: "caption",
        metaKey: "profile-subtitle",
        text: subtitleText,
        x: metrics.contentX,
        y: metrics.footerY,
        width: Math.round(width * 0.45),
        height: 48,
        preferredFontSize: subtitleFontSize,
        minFontSize: 24,
        fontFamily: template.bodyFont,
        fontStyle: "normal",
        fill: bodyColor,
        align: "left",
        lineHeight: 1.1
      })
    );
  }

  items.push(
    createTextElement({
      role: "caption",
      metaKey: "footer-arrow",
      text: "→",
      x: width - Math.round(width * 0.12),
      y: metrics.footerY - Math.round(subtitleFontSize * 0.08),
      width: 60,
      height: 56,
      fontSize: arrowFontSize,
      fontFamily: template.titleFont,
      fontStyle: "bold",
      fill: bodyColor,
      align: "right",
      lineHeight: 1
    })
  );

  return items;
}

function buildMainContent(
  slide: Slide,
  blueprint: SlideBlueprint,
  template: CarouselTemplate,
  palette: SlidePalette,
  format: SlideFormat
): CanvasElement[] {
  const effectiveSlideType: CanvasSlideType =
    blueprint.slideType === "image_text" && slide.photoSlotEnabled === false
      ? "text"
      : blueprint.slideType;
  const metrics = resolveTextMetrics(format);
  const bodyTextLimit = format === "9:16" ? 840 : format === "4:5" ? 740 : 660;
  const footerTop = metrics.footerY - 8;
  const titleFill = palette.titleColor;
  const bodyFill = palette.bodyColor;
  const bodyGap = format === "9:16" ? 34 : format === "4:5" ? 28 : 24;
  const resolveBodyStartY = (title: TextElement, preferredY: number) => {
    const lineHeight = title.lineHeight ?? 1.04;
    const estimatedTitleHeight = estimateTextHeight(title.text, title.width, title.fontSize, lineHeight);
    return Math.max(preferredY, Math.round(title.y + estimatedTitleHeight + bodyGap));
  };

  const titleElementFor = (overrides: {
    x: number;
    y: number;
    width: number;
    height: number;
    preferredFontSize: number;
    minFontSize: number;
    lineHeight: number;
    text?: string;
  }) =>
    createFittedTextElement({
      role: "title",
      metaKey: "managed-title",
      text: compactTextLength(overrides.text ?? blueprint.title, 220),
      x: overrides.x,
      y: overrides.y,
      width: overrides.width,
      height: overrides.height,
      preferredFontSize: overrides.preferredFontSize,
      minFontSize: overrides.minFontSize,
      fontFamily: template.titleFont,
      fontStyle: "bold",
      fill: titleFill,
      align: "left",
      lineHeight: overrides.lineHeight
    });

  if (effectiveSlideType === "big_text") {
    const title = titleElementFor({
      x: metrics.contentX,
      y: Math.round(metrics.height * (format === "9:16" ? 0.40 : 0.42)),
      width: metrics.contentWidth,
      height: Math.max(160, footerTop - Math.round(metrics.height * 0.4) - 12),
      preferredFontSize: format === "9:16" ? 92 : format === "4:5" ? 82 : 78,
      minFontSize: format === "9:16" ? 52 : 46,
      lineHeight: 1.03
    });

    return composeTitleAndAccentElements({ titleElement: title, palette, template });
  }

  if (effectiveSlideType === "image_text") {
    const imageArea = resolveImageArea(format);
    const elements: CanvasElement[] = [];

    if (slide.backgroundImage) {
      elements.push(
        createImageElement(slide.backgroundImage, {
          metaKey: "image-top",
          x: imageArea.x,
          y: imageArea.y,
          width: imageArea.width,
          height: imageArea.height,
          cornerRadius: 0
        })
      );
    } else {
      elements.push(
        createShapeElement({
          metaKey: "image-placeholder",
          x: imageArea.x,
          y: imageArea.y,
          width: imageArea.width,
          height: imageArea.height,
          fill: template.id === "dark" ? "#2c2f36" : "#d2d3d6",
          opacity: 1,
          cornerRadius: 0
        }),
        createFittedTextElement({
          role: "body",
          metaKey: "image-placeholder-text",
          text: "+ Добавить фото",
          x: imageArea.x,
          y: imageArea.y + Math.round(imageArea.height * 0.44),
          width: imageArea.width,
          height: 68,
          preferredFontSize: format === "9:16" ? 62 : 54,
          minFontSize: 30,
          fontFamily: template.bodyFont,
          fontStyle: "normal",
          fill: template.id === "dark" ? "#8a8f99" : "#8d8f93",
          align: "center",
          lineHeight: 1.02
        })
      );
    }

    const title = titleElementFor({
      x: metrics.contentX,
      y: imageArea.y + imageArea.height + Math.round(metrics.height * 0.05),
      width: metrics.contentWidth,
      height: Math.round(metrics.height * 0.18),
      preferredFontSize: format === "9:16" ? 80 : format === "4:5" ? 72 : 68,
      minFontSize: format === "9:16" ? 34 : 32,
      lineHeight: 1.03
    });

    const imageTextBodyY = resolveBodyStartY(
      title,
      imageArea.y + imageArea.height + Math.round(metrics.height * 0.22)
    );

    elements.push(
      ...composeTitleAndAccentElements({ titleElement: title, palette, template }),
      createFittedTextElement({
        role: "body",
        metaKey: "managed-body",
        text: compactTextLength(blueprint.body, format === "9:16" ? 620 : 540),
        x: metrics.contentX,
        y: imageTextBodyY,
        width: metrics.contentWidth,
        height: Math.max(96, footerTop - imageTextBodyY - 14),
        preferredFontSize: format === "9:16" ? 43 : 39,
        minFontSize: 22,
        fontFamily: template.bodyFont,
        fontStyle: "normal",
        fill: bodyFill,
        align: "left",
        lineHeight: 1.18
      })
    );

    return elements;
  }

  if (effectiveSlideType === "cta") {
    const title = titleElementFor({
      x: metrics.contentX,
      y: Math.round(metrics.height * 0.40),
      width: metrics.contentWidth,
      height: Math.round(metrics.height * 0.18),
      preferredFontSize: format === "9:16" ? 84 : format === "4:5" ? 74 : 68,
      minFontSize: format === "9:16" ? 34 : 32,
      lineHeight: 1.03
    });

    const ctaBodyY = resolveBodyStartY(title, Math.round(metrics.height * 0.58));

    return [
      ...composeTitleAndAccentElements({ titleElement: title, palette, template }),
      createFittedTextElement({
        role: "body",
        metaKey: "managed-body",
        text: compactTextLength(blueprint.body, format === "9:16" ? 590 : 520),
        x: metrics.contentX,
        y: ctaBodyY,
        width: metrics.contentWidth,
        height: Math.max(96, footerTop - ctaBodyY - 18),
        preferredFontSize: format === "9:16" ? 42 : 39,
        minFontSize: 22,
        fontFamily: template.bodyFont,
        fontStyle: "normal",
        fill: bodyFill,
        align: "left",
        lineHeight: 1.18
      })
    ];
  }

  const title = titleElementFor({
    x: metrics.contentX,
    y: metrics.titleY,
    width: metrics.contentWidth,
    height: Math.round(metrics.height * 0.2),
    preferredFontSize: format === "9:16" ? 82 : format === "4:5" ? 74 : 68,
    minFontSize: format === "9:16" ? 34 : 32,
    lineHeight: 1.04
  });

  const bodyY = resolveBodyStartY(title, metrics.bodyY);

  return [
    ...composeTitleAndAccentElements({ titleElement: title, palette, template }),
    createFittedTextElement({
      role: "body",
      metaKey: "managed-body",
      text: compactTextLength(blueprint.body, bodyTextLimit),
      x: metrics.contentX,
      y: bodyY,
      width: metrics.contentWidth,
      height: Math.max(100, footerTop - bodyY - 16),
      preferredFontSize: format === "9:16" ? 44 : 40,
      minFontSize: 22,
      fontFamily: template.bodyFont,
      fontStyle: "normal",
      fill: bodyFill,
      align: "left",
      lineHeight: 1.18
    })
  ];
}

function buildManagedElements(
  slide: Slide,
  blueprint: SlideBlueprint,
  templateId: CarouselTemplateId,
  index: number,
  totalSlides: number,
  format: SlideFormat
) {
  const effectiveBlueprint: SlideBlueprint =
    blueprint.slideType === "image_text" && slide.photoSlotEnabled === false
      ? {
          ...blueprint,
          slideType: "text"
        }
      : blueprint;
  const template = getTemplate(templateId);
  const palette = resolveSlidePalette(template, effectiveBlueprint);

  const managed: CanvasElement[] = [
    ...buildGridDecoration(format, palette),
    ...buildMainContent(slide, effectiveBlueprint, template, palette, format),
    ...buildHeaderAndFooter(
      template,
      palette,
      index,
      totalSlides,
      format,
      slide.profileHandle ?? DEFAULT_PROFILE_HANDLE,
      slide.profileSubtitle ?? DEFAULT_PROFILE_SUBTITLE
    )
  ];

  return managed;
}

function isManagedElement(element: CanvasElement) {
  return Boolean(element.metaKey && MANAGED_META_KEYS.has(element.metaKey));
}

function extractManagedText(slide: Slide, key: "managed-title" | "managed-body") {
  const found = slide.elements.find(
    (element): element is TextElement => element.type === "text" && element.metaKey === key
  );
  return found?.text?.trim() || "";
}

function rebuildSlide(
  slide: Slide,
  index: number,
  totalSlides: number,
  templateId: CarouselTemplateId,
  format: SlideFormat,
  customElements: CanvasElement[]
) {
  const blueprint: SlideBlueprint = {
    role: slide.generationRole ?? (index === 0 ? "hook" : index === totalSlides - 1 ? "cta" : "solution"),
    slideType: slide.slideType ?? "text",
    title: extractManagedText(slide, "managed-title") || slide.name || "Новый слайд",
    body: extractManagedText(slide, "managed-body") || "Добавьте основной тезис"
  };
  const nextTemplate = getTemplate(templateId);
  const palette = resolveSlidePalette(nextTemplate, blueprint);

  const rebuiltBase: Slide = {
    ...slide,
    name: blueprint.title,
    background: palette.background,
    templateId,
    profileHandle: slide.profileHandle ?? DEFAULT_PROFILE_HANDLE,
    profileSubtitle: normalizeProfileSubtitle(slide.profileSubtitle),
    generationRole: blueprint.role,
    slideType: blueprint.slideType,
    photoSlotEnabled:
      slide.photoSlotEnabled ?? (blueprint.slideType === "image_text" ? Boolean(slide.backgroundImage) : false),
    elements: []
  };

  return {
    ...rebuiltBase,
    elements: [...buildManagedElements(rebuiltBase, blueprint, templateId, index, totalSlides, format), ...customElements]
  };
}

export function createSlideFromOutline(
  outline: OutlineLike,
  index: number,
  templateId: CarouselTemplateId = "light",
  format: SlideFormat = "1:1",
  totalSlides = 1,
  forcedSlideType?: CanvasSlideType
): Slide {
  const resolvedTemplateId = resolveTemplateId(
    (outline as { templateId?: CarouselTemplateId }).templateId,
    templateId
  );
  const blueprint = outlineToBlueprint(outline, index, totalSlides, forcedSlideType);
  const template = getTemplate(resolvedTemplateId);
  const palette = resolveSlidePalette(template, blueprint);

  const slide: Slide = {
    id: crypto.randomUUID(),
    name: blueprint.title,
    background: palette.background,
    templateId: resolvedTemplateId,
    profileHandle: DEFAULT_PROFILE_HANDLE,
    profileSubtitle: DEFAULT_PROFILE_SUBTITLE,
    backgroundImage: null,
    generationRole: blueprint.role,
    generationCoreIdea: blueprint.body,
    slideType: blueprint.slideType,
    photoSlotEnabled: false,
    elements: []
  };

  return {
    ...slide,
    elements: buildManagedElements(slide, blueprint, resolvedTemplateId, index, totalSlides, format)
  };
}

export function applyTemplateToSlide(
  slide: Slide,
  templateId: CarouselTemplateId,
  index: number,
  totalSlides: number,
  format: SlideFormat
): Slide {
  const customElements = slide.elements.filter((element) => !isManagedElement(element));
  return rebuildSlide(slide, index, totalSlides, templateId, format, customElements);
}

export function applyTemplateToSlides(
  slides: Slide[],
  templateId: CarouselTemplateId,
  format: SlideFormat
) {
  return slides.map((slide, index) => applyTemplateToSlide(slide, templateId, index, slides.length, format));
}

function resolveRoleFlow(targetCount: number) {
  return ROLE_FLOW_BY_COUNT[targetCount] ?? ROLE_FLOW_BY_COUNT[9];
}

function resolveFallbackOutline(role: CarouselSlideRole): CarouselOutlineSlide {
  if (role === "hook") {
    return {
      type: "hook",
      title: "Точка роста, которую чаще всего пропускают",
      subtitle: "Коротко покажу, как собрать сильную карусель без воды"
    };
  }

  if (role === "problem") {
    return {
      type: "problem",
      title: "Где теряется внимание",
      bullets: [
        "Главная мысль тонет в общих словах",
        "Человек не понимает, что забрать себе",
        "Слайды читают, но не двигаются дальше"
      ]
    };
  }

  if (role === "amplify") {
    return {
      type: "amplify",
      title: "Почему это усиливается",
      bullets: ["Отклик падает на первых экранах", "Публикации не удерживают внимание", "Растет усталость от контента"]
    };
  }

  if (role === "mistake") {
    return {
      type: "mistake",
      title: "Ключевой миф: больше текста не равно больше пользы"
    };
  }

  if (role === "consequence") {
    return {
      type: "consequence",
      bullets: ["Снижается доверие к подаче", "Люди не доходят до CTA", "Контент работает нестабильно"]
    };
  }

  if (role === "shift") {
    return {
      type: "shift",
      title: "Сдвиг: сначала ясная ценность, потом детали"
    };
  }

  if (role === "solution") {
    return {
      type: "solution",
      bullets: ["Одна мысль на один слайд", "Факты и примеры вместо общих обещаний", "Четкий следующий шаг в конце"]
    };
  }

  if (role === "example") {
    return {
      type: "example",
      before: "До: «Мы работаем качественно»",
      after: "После: «За 14 дней получили стабильный отклик и входящие вопросы»"
    };
  }

  return {
    type: "cta",
    title: "Хотите такую же структуру под свою тему?",
    subtitle: "Напишите «РАЗБОР» и получите каркас, адаптированный под вашу задачу"
  };
}

export function createSlidesFromOutline(
  outline: OutlineLike[],
  templateId: CarouselTemplateId = "light",
  format: SlideFormat = "1:1",
  requestedCount?: number
): Slide[] {
  const targetCount = clampSlidesCount(requestedCount ?? outline.length ?? DEFAULT_SLIDES_COUNT);
  const flow = resolveRoleFlow(targetCount);

  return flow.map((role, index) => {
    const fromInput = outline[index];
    const fallback = resolveFallbackOutline(role);
    const item = fromInput ? { ...fallback, ...fromInput, type: role } : fallback;
    return createSlideFromOutline(item, index, templateId, format, flow.length);
  });
}

export function createStarterSlides(
  templateId: CarouselTemplateId = "light",
  format: SlideFormat = "1:1"
): Slide[] {
  const starter: CarouselOutlineSlide[] = [
    {
      type: "hook",
      title: "Одно слово в объявлении может утроить звонки",
      subtitle: "Большинство специалистов просто не тестируют этот триггер"
    },
    {
      type: "problem",
      title: "Что происходит сейчас",
      bullets: [
        "Реклама идет на всех площадках",
        "Лидов мало и они холодные",
        "Бюджет уходит в пустую"
      ]
    },
    {
      type: "amplify",
      title: "Почему ситуация становится хуже",
      bullets: [
        "Каждый день без изменений стоит денег",
        "Торг съедает маржу",
        "Клиент уходит туда, где яснее выгода"
      ]
    },
    {
      type: "mistake",
      title: "Ключевой разрыв: вы пишете «про себя», а не про результат клиента"
    },
    {
      type: "consequence",
      bullets: ["Цена давит сильнее экспертизы", "Падает доверие", "Сделки закрываются реже"]
    },
    {
      type: "shift",
      title: "Сдвиг: покажите конкретную выгоду в первом экране"
    },
    {
      type: "solution",
      bullets: ["Короткий тезис с цифрой", "Факт вместо обещания", "Четкий следующий шаг"]
    },
    {
      type: "example",
      before: "До: «Поможем продать квартиру»",
      after: "После: «За 30 дней привели 25 горячих покупателей по вашему бюджету»"
    },
    {
      type: "cta",
      title: "Хотите такой же шаблон под ваш рынок?",
      subtitle: "Напишите «ШАБЛОНЫ» и получите готовую структуру"
    }
  ];

  return createSlidesFromOutline(starter, templateId, format, starter.length);
}

export function createBlankSlide(
  index: number,
  templateId: CarouselTemplateId = "light",
  format: SlideFormat = "1:1",
  totalSlides = index + 1,
  slideType: CanvasSlideType = "text"
): Slide {
  const role: CarouselSlideRole =
    slideType === "cta"
      ? "cta"
      : slideType === "big_text"
        ? "shift"
        : slideType === "image_text"
          ? "hook"
          : slideType === "list"
            ? "solution"
            : "example";

  const blueprint: OutlineLike =
    role === "hook"
      ? {
          type: "hook",
          title: "Новый заголовок",
          subtitle: "Коротко раскройте ценность этого слайда"
        }
      : role === "solution"
        ? {
            type: "solution",
            bullets: ["Добавьте пункт 1", "Добавьте пункт 2", "Добавьте пункт 3"]
          }
        : role === "shift"
          ? {
              type: "shift",
              title: "Большой ключевой тезис"
            }
          : role === "cta"
            ? {
                type: "cta",
                title: "Призыв к действию",
                subtitle: "Что нужно сделать читателю прямо сейчас"
              }
            : {
                type: "example",
                before: "До: ваш старый вариант",
                after: "После: усиленный вариант"
              };

  return createSlideFromOutline(blueprint, index, templateId, format, totalSlides, slideType);
}

function scaleElement(element: CanvasElement, fromFormat: SlideFormat, toFormat: SlideFormat): CanvasElement {
  const from = SLIDE_FORMAT_DIMENSIONS[fromFormat];
  const to = SLIDE_FORMAT_DIMENSIONS[toFormat];

  const scaleX = to.width / from.width;
  const scaleY = to.height / from.height;
  const scaleFont = Math.sqrt(scaleX * scaleY);

  if (element.type === "text") {
    return {
      ...element,
      x: Math.round(element.x * scaleX),
      y: Math.round(element.y * scaleY),
      width: Math.round(element.width * scaleX),
      height: Math.round(element.height * scaleY),
      fontSize: Math.max(16, Math.round(element.fontSize * scaleFont))
    };
  }

  return {
    ...element,
    x: Math.round(element.x * scaleX),
    y: Math.round(element.y * scaleY),
    width: Math.round(element.width * scaleX),
    height: Math.round(element.height * scaleY)
  };
}

export function relayoutSlidesForFormat(
  slides: Slide[],
  fromFormat: SlideFormat,
  toFormat: SlideFormat
) {
  return slides.map((slide, index) => {
    const customElements = slide.elements
      .filter((element) => !isManagedElement(element))
      .map((element) => scaleElement(element, fromFormat, toFormat));

    return rebuildSlide(
      slide,
      index,
      slides.length,
      slide.templateId ?? "light",
      toFormat,
      customElements
    );
  });
}

export function updateSlideFooter(
  slide: Slide,
  updates: Partial<Pick<Slide, "profileHandle" | "profileSubtitle">>,
  index: number,
  totalSlides: number,
  format: SlideFormat
) {
  const customElements = slide.elements.filter((element) => !isManagedElement(element));

  return rebuildSlide(
    {
      ...slide,
      profileHandle: updates.profileHandle ?? slide.profileHandle,
      profileSubtitle:
        updates.profileSubtitle !== undefined
          ? normalizeProfileSubtitle(updates.profileSubtitle)
          : slide.profileSubtitle
    },
    index,
    totalSlides,
    slide.templateId ?? "light",
    format,
    customElements
  );
}

function normalizeProfileSubtitle(value?: string) {
  const cleaned = (value ?? "").trim();
  if (!cleaned) {
    return "";
  }

  if (/^надпись$/iu.test(cleaned)) {
    return "";
  }

  return cleaned;
}

export function setSlideBackgroundImage(
  slide: Slide,
  src: string | null,
  index: number,
  totalSlides: number,
  format: SlideFormat
) {
  const customElements = slide.elements.filter((element) => !isManagedElement(element));

  return rebuildSlide(
    {
      ...slide,
      backgroundImage: src
    },
    index,
    totalSlides,
    slide.templateId ?? "light",
    format,
    customElements
  );
}

export function reorderSlides(slides: Slide[], fromId: string, toId: string) {
  const fromIndex = slides.findIndex((slide) => slide.id === fromId);
  const toIndex = slides.findIndex((slide) => slide.id === toId);

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return slides;
  }

  const next = [...slides];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);

  return syncSlideOrderMeta(next);
}

export function syncSlideOrderMeta(slides: Slide[]) {
  return slides.map((slide, index) => ({
    ...slide,
    elements: slide.elements.map((element) => {
      if (element.type !== "text") {
        return element;
      }

      if (element.metaKey === "footer-counter") {
        return {
          ...element,
          text: `[ ${index + 1}/${slides.length} ]`
        };
      }

      return element;
    })
  }));
}

export function projectTitleFromTopic(topic: string) {
  return topic.trim() || "Новая карусель";
}
