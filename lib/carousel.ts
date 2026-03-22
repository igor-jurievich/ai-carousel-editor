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
export const DEFAULT_PROFILE_SUBTITLE = "Надпись";
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
    description: "Тёмная тема с вертикальной сеткой и красным акцентом.",
    accent: "#ff1111",
    accentAlt: "#ff4a4a",
    background: "#101216",
    surface: "#171920",
    titleColor: "#f4f5fb",
    bodyColor: "#eceff6",
    titleFont: "Roboto Condensed",
    bodyFont: "Inter",
    chipStyle: "outline",
    decoration: "grid",
    accentMode: "text",
    gridMode: "vertical",
    gridStep: 118,
    gridOpacity: 0.12,
    preview: "Контрастная тёмная подача"
  },
  {
    id: "light",
    name: "Светлый",
    description: "Светлая сетка с синим акцентом и контрастными вставками.",
    accent: "#1b3eff",
    accentAlt: "#4f67ff",
    background: "#ececef",
    surface: "#ffffff",
    titleColor: "#1f2228",
    bodyColor: "#282d36",
    titleFont: "Russo One",
    bodyFont: "Manrope",
    chipStyle: "solid",
    decoration: "grid",
    accentMode: "chip",
    gridMode: "full",
    gridStep: 74,
    gridOpacity: 0.08,
    preview: "Чистая светлая подача"
  },
  {
    id: "color",
    name: "Цветной",
    description: "Светлая тема с оранжевыми акцентами.",
    accent: "#ff4a1a",
    accentAlt: "#ff7a52",
    background: "#ececef",
    surface: "#ffffff",
    titleColor: "#202228",
    bodyColor: "#2b3038",
    titleFont: "Russo One",
    bodyFont: "Manrope",
    chipStyle: "solid",
    decoration: "grid",
    accentMode: "text",
    gridMode: "full",
    gridStep: 74,
    gridOpacity: 0.08,
    preview: "Светлая тема с тёплым акцентом"
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
  gridMode: "full" | "vertical";
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
  "managed-title-accent",
  "managed-title-accent-chip",
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

function compactTextLength(text: string, maxChars: number) {
  if (text.length <= maxChars) {
    return text;
  }

  const sliced = text.slice(0, maxChars).trimEnd();
  const lastSpace = sliced.lastIndexOf(" ");
  const safe = lastSpace > 36 ? sliced.slice(0, lastSpace) : sliced;
  return `${safe}…`;
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
      accentMode: blueprint.slideType === "image_text" ? "chip" : "text",
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
      accentMode:
        blueprint.slideType === "big_text"
          ? "none"
          : blueprint.slideType === "image_text"
            ? "chip"
            : "text",
      gridMode: "full",
      gridStep: baseGridStep,
      gridColor: baseGridColor
    };
  }

  if (template.id === "dark") {
    return {
      background: template.background,
      titleColor: template.titleColor,
      bodyColor: template.bodyColor,
      accent: template.accent,
      accentMode: blueprint.slideType === "big_text" ? "none" : "text",
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

const ACCENT_STOP_WORDS = new Set([
  "и",
  "в",
  "на",
  "по",
  "для",
  "как",
  "это",
  "где",
  "или",
  "а",
  "но",
  "к",
  "с",
  "у",
  "не",
  "вы",
  "мы",
  "что"
]);

const IMPACT_WORD_PATTERN =
  /\b(лид\w*|горяч\w*|стратег\w*|пряч\w*|магнит\w*|сроч\w*|фишк\w*|дешевл\w*|конкурент\w*|выгод\w*|продаж\w*|цен\w*|ошиб\w*|заяв\w*)\b/giu;

type AccentCandidate = {
  text: string;
  startIndex: number;
  score: number;
};

function trimAccentEdge(raw: string) {
  return raw
    .replace(/^[\s.,;:!?'"«»(){}\[\]—-]+/u, "")
    .replace(/[\s.,;:!?'"«»(){}\[\]—-]+$/u, "");
}

function resolveTitleAccent(title: string) {
  const normalized = normalizeMultilineText(title);
  if (!normalized) {
    return null;
  }

  const candidates: AccentCandidate[] = [];
  const pushCandidate = (rawText: string, startIndex: number, score: number) => {
    const text = trimAccentEdge(rawText);
    if (
      !text ||
      text.includes(" ") ||
      text.includes("\n") ||
      text.length < 4 ||
      text.length > 22 ||
      startIndex < 0
    ) {
      return;
    }
    candidates.push({ text, startIndex, score });
  };

  const tokenPattern = /[\p{L}\p{N}-]+/gu;
  const tokens = Array.from(normalized.matchAll(tokenPattern));
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const value = token[0];
    const lower = value.toLocaleLowerCase("ru-RU");
    const tokenStart = token.index ?? 0;

    if (ACCENT_STOP_WORDS.has(lower)) {
      continue;
    }

    let score = 0;
    IMPACT_WORD_PATTERN.lastIndex = 0;
    if (IMPACT_WORD_PATTERN.test(value)) {
      score += 220;
    }
    if (value.includes("-")) {
      score += 28;
    }
    if (/[0-9]/u.test(value)) {
      score += 18;
    }
    if (value.length >= 5 && value.length <= 15) {
      score += 16;
    } else {
      score += 8;
    }
    if (tokenStart <= 22) {
      score += 12;
    } else if (tokenStart <= 42) {
      score += 4;
    }

    if (score > 0) {
      pushCandidate(value, tokenStart, score);
    }
  }

  if (!candidates.length) {
    const fallback = tokens.find((token) => {
      const value = token[0];
      if (value.length < 4 || value.length > 18) {
        return false;
      }
      return !ACCENT_STOP_WORDS.has(value.toLocaleLowerCase("ru-RU"));
    });
    if (fallback) {
      return {
        text: fallback[0],
        startIndex: fallback.index ?? 0
      };
    }
  }

  if (!candidates.length) {
    return null;
  }

  candidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    if (left.startIndex !== right.startIndex) {
      return left.startIndex - right.startIndex;
    }
    return right.text.length - left.text.length;
  });

  const best = candidates[0];
  return {
    text: best.text,
    startIndex: best.startIndex
  };
}

function resolveTextOffsetByIndex(
  sourceText: string,
  width: number,
  fontSize: number,
  lineHeight: number,
  index: number
) {
  if (index <= 0) {
    return { x: 0, y: 0 };
  }

  const tokenPattern = /\n|[^\s\n]+|[ \t]+/gu;
  const tokens = Array.from(sourceText.matchAll(tokenPattern));

  let x = 0;
  let line = 0;

  const measureTextWidth = (value: string) =>
    value.split("").reduce((sum, char) => sum + estimateCharWidth(char, fontSize), 0);

  for (const token of tokens) {
    const tokenText = token[0] ?? "";
    const tokenStart = token.index ?? 0;
    const tokenEnd = tokenStart + tokenText.length;

    if (tokenText === "\n") {
      if (index >= tokenStart && index < tokenEnd) {
        return {
          x,
          y: line * fontSize * lineHeight
        };
      }
      line += 1;
      x = 0;
      continue;
    }

    if (/\S/u.test(tokenText)) {
      const tokenWidth = measureTextWidth(tokenText);
      if (x > 0 && x + tokenWidth > width) {
        line += 1;
        x = 0;
      }

      if (index >= tokenStart && index < tokenEnd) {
        const relativeText = tokenText.slice(0, index - tokenStart);
        return {
          x: x + measureTextWidth(relativeText),
          y: line * fontSize * lineHeight
        };
      }

      x += tokenWidth;
      continue;
    }

    if (x === 0) {
      continue;
    }

    const spaceWidth = measureTextWidth(tokenText);
    if (x + spaceWidth > width) {
      line += 1;
      x = 0;
      continue;
    }

    if (index >= tokenStart && index < tokenEnd) {
      const relativeText = tokenText.slice(0, index - tokenStart);
      return {
        x: x + measureTextWidth(relativeText),
        y: line * fontSize * lineHeight
      };
    }

    x += spaceWidth;
  }

  return {
    x,
    y: line * fontSize * lineHeight
  };
}

function buildTitleAccentElements(params: {
  titleElement: TextElement;
  palette: SlidePalette;
  template: CarouselTemplate;
}): CanvasElement[] {
  const { titleElement, palette, template } = params;

  if (palette.accentMode === "none") {
    return [];
  }

  const accent = resolveTitleAccent(titleElement.text);
  if (!accent?.text) {
    return [];
  }

  const accentLength = accent.text.length;
  if (accentLength < 2 || accentLength > 32) {
    return [];
  }

  if (accent.text.includes(" ") || accent.text.includes("\n")) {
    return [];
  }

  const { x: offsetX, y: offsetY } = resolveTextOffsetByIndex(
    titleElement.text,
    titleElement.width,
    titleElement.fontSize,
    titleElement.lineHeight ?? 1.05,
    accent.startIndex
  );

  const textX = titleElement.x + offsetX;
  const textY = titleElement.y + offsetY;
  const textWidth = Math.ceil(
    accent.text.split("").reduce((sum, char) => sum + estimateCharWidth(char, titleElement.fontSize), 0)
  );
  const textHeight = Math.ceil(titleElement.fontSize * (titleElement.lineHeight ?? 1.05));
  const maxWidth = titleElement.x + titleElement.width;

  if (textX >= maxWidth - 32 || textWidth > titleElement.width + 40) {
    return [];
  }

  if (textX + textWidth > maxWidth - 2) {
    return [];
  }

  const clippedWidth = textWidth;

  if (palette.accentMode === "chip") {
    return [
      createShapeElement({
        metaKey: "managed-title-accent-chip",
        x: Math.max(titleElement.x, textX - Math.round(titleElement.fontSize * 0.14)),
        y: textY - Math.round(titleElement.fontSize * 0.08),
        width: clippedWidth + Math.round(titleElement.fontSize * 0.24),
        height: textHeight + Math.round(titleElement.fontSize * 0.1),
        fill: palette.accent,
        opacity: 1,
        cornerRadius: Math.round(titleElement.fontSize * 0.08)
      }),
      createTextElement({
        role: "title",
        metaKey: "managed-title-accent",
        text: accent.text,
        x: textX,
        y: textY,
        width: clippedWidth,
        height: textHeight,
        fontSize: titleElement.fontSize,
        fontFamily: titleElement.fontFamily,
        fontStyle: titleElement.fontStyle,
        fill: "#f6f8ff",
        align: "left",
        lineHeight: titleElement.lineHeight ?? 1.05,
        letterSpacing: titleElement.letterSpacing ?? 0
      })
    ];
  }

  return [
    createTextElement({
      role: "title",
      metaKey: "managed-title-accent",
      text: accent.text,
      x: textX,
      y: textY,
      width: clippedWidth,
      height: textHeight,
      fontSize: titleElement.fontSize,
      fontFamily: template.titleFont,
      fontStyle: titleElement.fontStyle,
      fill: palette.accent,
      align: "left",
      lineHeight: titleElement.lineHeight ?? 1.05,
      letterSpacing: titleElement.letterSpacing ?? 0
    })
  ];
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
    return outline.title.trim();
  }

  if (role === "consequence") {
    return "Что произойдёт дальше";
  }

  if (role === "solution") {
    return "Что делать вместо этого";
  }

  if (role === "example") {
    return "Пример формулировки";
  }

  return "Новый слайд";
}

function readBody(role: CarouselSlideRole, outline: OutlineLike) {
  if (role === "hook") {
    const subtitle = typeof outline.subtitle === "string" ? outline.subtitle.trim() : "";
    return subtitle || "Серия покажет, как получать больше заявок без лишнего бюджета.";
  }

  if (role === "problem" || role === "amplify" || role === "consequence" || role === "solution") {
    const bullets = Array.isArray(outline.bullets)
      ? outline.bullets
          .map((item) => compactTextLength(String(item).replace(/\s+/g, " ").trim(), 82))
          .filter(Boolean)
          .slice(0, 4)
      : [];

    if (bullets.length > 0) {
      return bullets.map((item) => `→ ${item}`).join("\n");
    }

    if (typeof outline.text === "string" && outline.text.trim()) {
      return outline.text.trim();
    }

    if (role === "consequence") {
      return "→ Клиент торгуется по цене\n→ Ценность услуги падает\n→ Сделка уходит конкуренту";
    }

    return "→ Короткий тезис с конкретной выгодой\n→ Один факт вместо абстракции\n→ Ясный следующий шаг";
  }

  if (role === "example") {
    const before = typeof outline.before === "string" ? outline.before.trim() : "";
    const after = typeof outline.after === "string" ? outline.after.trim() : "";
    if (before || after) {
      return `До: ${before || "—"}\nПосле: ${after || "—"}`;
    }

    return "До: «Мы лучшие на рынке»\nПосле: «За 30 дней закрыли 12 сделок выше рынка»";
  }

  if (role === "cta") {
    const subtitle = typeof outline.subtitle === "string" ? outline.subtitle.trim() : "";
    return subtitle || "Напишите «ШАБЛОНЫ» и заберите готовую структуру.";
  }

  if (typeof outline.text === "string" && outline.text.trim()) {
    return outline.text.trim();
  }

  if (typeof outline.body === "string" && outline.body.trim()) {
    return outline.body.trim();
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
  const subtitleText = profileSubtitle.trim() || DEFAULT_PROFILE_SUBTITLE;
  const captionFontSize = format === "9:16" ? 40 : 38;
  const counterFontSize = format === "9:16" ? 39 : 37;
  const subtitleFontSize = format === "9:16" ? 42 : 40;
  const arrowFontSize = format === "9:16" ? 64 : 58;

  return [
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
    }),
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
    }),
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
  ];
}

function buildMainContent(
  slide: Slide,
  blueprint: SlideBlueprint,
  template: CarouselTemplate,
  palette: SlidePalette,
  format: SlideFormat
): CanvasElement[] {
  const metrics = resolveTextMetrics(format);
  const footerTop = metrics.footerY - 8;
  const titleFill = palette.titleColor;
  const bodyFill = palette.bodyColor;

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
      text: compactTextLength(overrides.text ?? blueprint.title, 160),
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

  if (blueprint.slideType === "big_text") {
    const title = titleElementFor({
      x: metrics.contentX,
      y: Math.round(metrics.height * (format === "9:16" ? 0.40 : 0.42)),
      width: metrics.contentWidth,
      height: Math.max(160, footerTop - Math.round(metrics.height * 0.4) - 12),
      preferredFontSize: format === "9:16" ? 92 : format === "4:5" ? 82 : 78,
      minFontSize: format === "9:16" ? 52 : 46,
      lineHeight: 1.03
    });

    return [title, ...buildTitleAccentElements({ titleElement: title, palette, template })];
  }

  if (blueprint.slideType === "image_text") {
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
      minFontSize: format === "9:16" ? 42 : 38,
      lineHeight: 1.03
    });

    elements.push(
      title,
      ...buildTitleAccentElements({ titleElement: title, palette, template }),
      createFittedTextElement({
        role: "body",
        metaKey: "managed-body",
        text: compactTextLength(blueprint.body, 250),
        x: metrics.contentX,
        y: imageArea.y + imageArea.height + Math.round(metrics.height * 0.22),
        width: metrics.contentWidth,
        height: Math.max(96, footerTop - (imageArea.y + imageArea.height + Math.round(metrics.height * 0.22)) - 14),
        preferredFontSize: format === "9:16" ? 45 : 40,
        minFontSize: 26,
        fontFamily: template.bodyFont,
        fontStyle: "normal",
        fill: bodyFill,
        align: "left",
        lineHeight: 1.2
      })
    );

    return elements;
  }

  if (blueprint.slideType === "cta") {
    const title = titleElementFor({
      x: metrics.contentX,
      y: Math.round(metrics.height * 0.40),
      width: metrics.contentWidth,
      height: Math.round(metrics.height * 0.18),
      preferredFontSize: format === "9:16" ? 84 : format === "4:5" ? 74 : 68,
      minFontSize: format === "9:16" ? 46 : 40,
      lineHeight: 1.03
    });

    return [
      title,
      ...buildTitleAccentElements({ titleElement: title, palette, template }),
      createFittedTextElement({
        role: "body",
        metaKey: "managed-body",
        text: compactTextLength(blueprint.body, 210),
        x: metrics.contentX,
        y: Math.round(metrics.height * 0.58),
        width: metrics.contentWidth,
        height: Math.max(96, footerTop - Math.round(metrics.height * 0.58) - 18),
        preferredFontSize: format === "9:16" ? 44 : 40,
        minFontSize: 26,
        fontFamily: template.bodyFont,
        fontStyle: "normal",
        fill: bodyFill,
        align: "left",
        lineHeight: 1.22
      })
    ];
  }

  const title = titleElementFor({
    x: metrics.contentX,
    y: metrics.titleY,
    width: metrics.contentWidth,
    height: Math.round(metrics.height * 0.2),
    preferredFontSize: format === "9:16" ? 82 : format === "4:5" ? 74 : 68,
    minFontSize: format === "9:16" ? 44 : 38,
    lineHeight: 1.04
  });

  return [
    title,
    ...buildTitleAccentElements({ titleElement: title, palette, template }),
    createFittedTextElement({
      role: "body",
      metaKey: "managed-body",
      text: compactTextLength(blueprint.body, 300),
      x: metrics.contentX,
      y: metrics.bodyY,
      width: metrics.contentWidth,
      height: Math.max(100, footerTop - metrics.bodyY - 16),
      preferredFontSize: format === "9:16" ? 46 : 41,
      minFontSize: 25,
      fontFamily: template.bodyFont,
      fontStyle: "normal",
      fill: bodyFill,
      align: "left",
      lineHeight: 1.22
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
  const template = getTemplate(templateId);
  const palette = resolveSlidePalette(template, blueprint);

  const managed: CanvasElement[] = [
    ...buildGridDecoration(format, palette),
    ...buildMainContent(slide, blueprint, template, palette, format),
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
    profileSubtitle: slide.profileSubtitle ?? DEFAULT_PROFILE_SUBTITLE,
    generationRole: blueprint.role,
    slideType: blueprint.slideType,
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
      title: "Один точный сдвиг повышает конверсию",
      subtitle: "Показываю, как перестать сливать бюджет на холодные заявки"
    };
  }

  if (role === "problem") {
    return {
      type: "problem",
      title: "Почему заявки не доходят до сделки",
      bullets: [
        "Подача звучит как у всех",
        "Клиент не видит измеримую выгоду",
        "Цена обсуждается раньше результата"
      ]
    };
  }

  if (role === "amplify") {
    return {
      type: "amplify",
      title: "Во что это превращается",
      bullets: ["Уходят горячие лиды", "Маркетинг дорожает", "Время команды сгорает"]
    };
  }

  if (role === "mistake") {
    return {
      type: "mistake",
      title: "Ошибка: вы продаёте процесс, а не итог для клиента"
    };
  }

  if (role === "consequence") {
    return {
      type: "consequence",
      bullets: ["Торг начинается сразу", "Экспертность падает", "Сделки срываются"]
    };
  }

  if (role === "shift") {
    return {
      type: "shift",
      title: "Сдвиг мышления: сначала ценность, потом цена"
    };
  }

  if (role === "solution") {
    return {
      type: "solution",
      bullets: ["Фраза с конкретной выгодой", "2-3 факта вместо общих слов", "Ясный CTA"]
    };
  }

  if (role === "example") {
    return {
      type: "example",
      before: "До: «Мы работаем качественно»",
      after: "После: «За месяц закрыли 12 сделок по цене выше рынка»"
    };
  }

  return {
    type: "cta",
    title: "Нужна такая же структура под ваш кейс?",
    subtitle: "Напишите «ШАБЛОНЫ» и получите готовый каркас карусели"
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
    const item = fromInput ? { ...fallback, ...fromInput } : fallback;
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
      title: "Ошибка: вы пишете «про себя», а не про результат клиента"
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
      profileSubtitle: updates.profileSubtitle ?? slide.profileSubtitle
    },
    index,
    totalSlides,
    slide.templateId ?? "light",
    format,
    customElements
  );
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
