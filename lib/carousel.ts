import type {
  CanvasElement,
  CarouselOutlineSlide,
  CarouselTemplate,
  CarouselTemplateId,
  FooterVariantId,
  ImageElement,
  ShapeElement,
  Slide,
  SlideFormat,
  TemplateCategoryId,
  TextElement
} from "@/types/editor";
import {
  clampSlidesCount,
  DEFAULT_SLIDES_COUNT,
  MAX_SLIDES_COUNT,
  MIN_SLIDES_COUNT
} from "@/lib/slides";

export const SLIDE_SIZE = 1080;
export const DEFAULT_PROFILE_HANDLE = "@ваш_профиль";
export const DEFAULT_PROFILE_SUBTITLE = "Подпись";
export const DEFAULT_FOOTER_VARIANT: FooterVariantId = "v1";
export { clampSlidesCount, DEFAULT_SLIDES_COUNT, MAX_SLIDES_COUNT, MIN_SLIDES_COUNT };
export const FOOTER_VARIANTS: Array<{ id: FooterVariantId; label: string }> = [
  { id: "v1", label: "V1" },
  { id: "v2", label: "V2" },
  { id: "v3", label: "V3" },
  { id: "v4", label: "V4" }
];

export const SLIDE_FORMAT_DIMENSIONS: Record<
  SlideFormat,
  { width: number; height: number; label: string }
> = {
  "1:1": { width: 1080, height: 1080, label: "Instagram square" },
  "4:5": { width: 1080, height: 1350, label: "Instagram portrait" },
  "9:16": { width: 1080, height: 1920, label: "Stories / Reels" }
};

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategoryId, string> = {
  dark: "Темные",
  light: "Светлые",
  color: "Цветные"
};

export const FONT_OPTIONS = [
  "Arial",
  "Helvetica",
  "Trebuchet MS",
  "Verdana",
  "Georgia",
  "Impact",
  "Times New Roman"
];

export const CAROUSEL_TEMPLATES: CarouselTemplate[] = [
  {
    id: "netflix",
    category: "dark",
    name: "Нетфликс",
    description: "Темный фон, агрессивный акцент и крупный рекламный заголовок.",
    accent: "#ff5a1f",
    accentAlt: "#ff874e",
    background: "#121212",
    surface: "#1d1d1d",
    titleColor: "#f8f3ec",
    bodyColor: "#d9cdc0",
    titleFont: "Arial",
    bodyFont: "Helvetica",
    titleOffsetY: 520,
    bodyOffsetY: 792,
    titleWidth: 860,
    bodyWidth: 850,
    bodyHeight: 220,
    chipStyle: "solid",
    decoration: "glow",
    preview: "Темный hero-screen с сильным CTA."
  },
  {
    id: "matrix",
    category: "dark",
    name: "Матрица",
    description: "Темная сетка, неон и цифровой ритм.",
    accent: "#4cff3f",
    accentAlt: "#9eff88",
    background: "#121212",
    surface: "#1a1a1a",
    titleColor: "#f6f7f2",
    bodyColor: "#c8cec8",
    titleFont: "Trebuchet MS",
    bodyFont: "Helvetica",
    titleOffsetY: 460,
    bodyOffsetY: 740,
    titleWidth: 900,
    bodyWidth: 820,
    bodyHeight: 220,
    chipStyle: "outline",
    decoration: "grid",
    preview: "Неоновая сетка и контрастные выделения."
  },
  {
    id: "premium",
    category: "dark",
    name: "Премиум",
    description: "Глубокий фон и тёплый премиальный акцент.",
    accent: "#c9a86a",
    accentAlt: "#f1d39b",
    background: "#151515",
    surface: "#202020",
    titleColor: "#f4efe7",
    bodyColor: "#d6cbbf",
    titleFont: "Georgia",
    bodyFont: "Helvetica",
    titleOffsetY: 515,
    bodyOffsetY: 790,
    titleWidth: 880,
    bodyWidth: 840,
    bodyHeight: 210,
    chipStyle: "solid",
    decoration: "glow",
    preview: "Спокойный dark luxury с мягким золотом."
  },
  {
    id: "notes",
    category: "light",
    name: "Заметки",
    description: "Светлый бумажный экран в стиле заметок.",
    accent: "#e7b92a",
    accentAlt: "#f7d96d",
    background: "#fcfbf7",
    surface: "#ffffff",
    titleColor: "#222222",
    bodyColor: "#5d5850",
    titleFont: "Arial",
    bodyFont: "Helvetica",
    titleOffsetY: 220,
    bodyOffsetY: 446,
    titleWidth: 870,
    bodyWidth: 800,
    bodyHeight: 250,
    chipStyle: "outline",
    decoration: "paper",
    preview: "Воздушный светлый экран с чистым ритмом."
  },
  {
    id: "technology",
    category: "light",
    name: "Технология",
    description: "Сетка, белый фон и синий акцент.",
    accent: "#315cff",
    accentAlt: "#5f83ff",
    background: "#ffffff",
    surface: "#ffffff",
    titleColor: "#202020",
    bodyColor: "#555555",
    titleFont: "Arial",
    bodyFont: "Helvetica",
    titleOffsetY: 232,
    bodyOffsetY: 470,
    titleWidth: 912,
    bodyWidth: 820,
    bodyHeight: 250,
    chipStyle: "outline",
    decoration: "grid",
    preview: "Журнальный tech-layout на светлом фоне."
  },
  {
    id: "charge",
    category: "light",
    name: "Заряд",
    description: "Чистый светлый шаблон с энергичным акцентом.",
    accent: "#ffe600",
    accentAlt: "#1f1f1f",
    background: "#fbfbf8",
    surface: "#ffffff",
    titleColor: "#2a2a2a",
    bodyColor: "#555555",
    titleFont: "Trebuchet MS",
    bodyFont: "Helvetica",
    titleOffsetY: 255,
    bodyOffsetY: 495,
    titleWidth: 880,
    bodyWidth: 780,
    bodyHeight: 220,
    chipStyle: "solid",
    decoration: "paper",
    preview: "Белый экран с динамичным акцентным блоком."
  },
  {
    id: "jungle",
    category: "color",
    name: "Джунгли",
    description: "Глубокий зеленый фон и яркий оранжевый акцент.",
    accent: "#ff6a1f",
    accentAlt: "#ffd452",
    background: "#0d4f18",
    surface: "#125f1d",
    titleColor: "#f4f7ef",
    bodyColor: "#d7ebd7",
    titleFont: "Trebuchet MS",
    bodyFont: "Helvetica",
    titleOffsetY: 420,
    bodyOffsetY: 720,
    titleWidth: 820,
    bodyWidth: 760,
    bodyHeight: 220,
    chipStyle: "solid",
    decoration: "glow",
    preview: "Контрастный яркий экран под экспертный контент."
  },
  {
    id: "cyberpunk",
    category: "color",
    name: "Киберпанк",
    description: "Электрик-синий фон и сочный розовый акцент.",
    accent: "#ff53d7",
    accentAlt: "#2bf0ff",
    background: "#183bff",
    surface: "#2045ff",
    titleColor: "#ffffff",
    bodyColor: "#eff2ff",
    titleFont: "Arial",
    bodyFont: "Helvetica",
    titleOffsetY: 430,
    bodyOffsetY: 730,
    titleWidth: 820,
    bodyWidth: 760,
    bodyHeight: 220,
    chipStyle: "solid",
    decoration: "grid",
    preview: "Громкий digital-вид с яркими цветами."
  },
  {
    id: "mandarin",
    category: "color",
    name: "Мандарин",
    description: "Светлый сеточный шаблон с оранжевым выделением.",
    accent: "#ff6425",
    accentAlt: "#ffd2b5",
    background: "#f9f7f2",
    surface: "#ffffff",
    titleColor: "#262626",
    bodyColor: "#565656",
    titleFont: "Arial",
    bodyFont: "Helvetica",
    titleOffsetY: 250,
    bodyOffsetY: 500,
    titleWidth: 900,
    bodyWidth: 820,
    bodyHeight: 230,
    chipStyle: "solid",
    decoration: "dots",
    preview: "Минималистичный шаблон с ярким акцентом."
  }
];

const FORMAT_TEXT_SCALE: Record<SlideFormat, number> = {
  "1:1": 1,
  "4:5": 1.05,
  "9:16": 1.02
};

type ManagedContent = {
  title: string;
  body: string;
  handle: string;
  subtitle: string;
};

type OutlineLike = Partial<CarouselOutlineSlide> & {
  body?: string;
  description?: string;
  content?: string;
  textBody?: string;
};

export function getTemplate(templateId: CarouselTemplateId) {
  return CAROUSEL_TEMPLATES.find((template) => template.id === templateId) ?? CAROUSEL_TEMPLATES[0];
}

export function getTemplatesByCategory(category: TemplateCategoryId) {
  return CAROUSEL_TEMPLATES.filter((template) => template.category === category);
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
    x: overrides.x ?? 108,
    y: overrides.y ?? (isTitle ? 188 : 420),
    width: overrides.width ?? (isTitle ? 864 : 820),
    height: overrides.height ?? (isTitle ? 240 : 360),
    fontSize: overrides.fontSize ?? (isTitle ? 92 : 42),
    fontFamily: overrides.fontFamily ?? (isTitle ? "Arial" : "Helvetica"),
    fontStyle: overrides.fontStyle ?? (isTitle ? "bold" : "normal"),
    fill: overrides.fill ?? "#141414",
    align: overrides.align ?? "left",
    lineHeight: overrides.lineHeight ?? (isTitle ? 1.02 : 1.18),
    rotation: overrides.rotation ?? 0,
    opacity: overrides.opacity ?? 1,
    letterSpacing: overrides.letterSpacing ?? 0
  };
}

export function createShapeElement(overrides: Partial<ShapeElement> = {}): ShapeElement {
  return {
    id: crypto.randomUUID(),
    type: "shape",
    metaKey: overrides.metaKey,
    shape: overrides.shape ?? "rect",
    x: overrides.x ?? 84,
    y: overrides.y ?? 82,
    width: overrides.width ?? 188,
    height: overrides.height ?? 56,
    fill: overrides.fill ?? "#ff5a1f",
    opacity: overrides.opacity ?? 1,
    rotation: overrides.rotation ?? 0,
    cornerRadius: overrides.cornerRadius ?? 18,
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
    y: overrides.y ?? 76,
    width: overrides.width ?? 936,
    height: overrides.height ?? 430,
    opacity: overrides.opacity ?? 1,
    rotation: overrides.rotation ?? 0,
    cornerRadius: overrides.cornerRadius ?? 32
  };
}

function createBackgroundImageElement(src: string, format: SlideFormat) {
  const { width, height } = SLIDE_FORMAT_DIMENSIONS[format];
  return createImageElement(src, {
    metaKey: "background-image",
    x: 0,
    y: 0,
    width,
    height,
    cornerRadius: 0
  });
}

function getFormatLayout(format: SlideFormat) {
  if (format === "4:5") {
    return {
      titleFactor: 1.04,
      bodyFactor: 1.08,
      titleYBoost: 60,
      bodyYBoost: 115,
      footerBottom: 116
    };
  }

  if (format === "9:16") {
    return {
      titleFactor: 0.96,
      bodyFactor: 1.02,
      titleYBoost: 96,
      bodyYBoost: 180,
      footerBottom: 122
    };
  }

  return {
    titleFactor: 1,
    bodyFactor: 1,
    titleYBoost: 0,
    bodyYBoost: 0,
    footerBottom: 108
  };
}

function createDecoration(template: CarouselTemplate, format: SlideFormat): CanvasElement[] {
  const { height } = SLIDE_FORMAT_DIMENSIONS[format];

  if (template.decoration === "grid") {
    return [
      createShapeElement({
        metaKey: "decor-bg",
        x: 0,
        y: 0,
        width: SLIDE_SIZE,
        height,
        fill: template.background,
        cornerRadius: 0
      }),
      ...Array.from({ length: 11 }, (_, index) =>
        createShapeElement({
          metaKey: `decor-grid-v-${index}`,
          x: 78 + index * 92,
          y: 0,
          width: 2,
          height,
          fill: "rgba(0,0,0,0.05)",
          cornerRadius: 0
        })
      ),
      ...Array.from({ length: Math.ceil(height / 92) }, (_, index) =>
        createShapeElement({
          metaKey: `decor-grid-h-${index}`,
          x: 0,
          y: index * 92,
          width: SLIDE_SIZE,
          height: 2,
          fill: "rgba(0,0,0,0.04)",
          cornerRadius: 0
        })
      )
    ];
  }

  if (template.decoration === "paper") {
    return [
      createShapeElement({
        metaKey: "decor-paper",
        x: 0,
        y: 0,
        width: SLIDE_SIZE,
        height,
        fill: template.background,
        cornerRadius: 0
      }),
      createShapeElement({
        metaKey: "decor-card",
        x: 68,
        y: 72,
        width: 944,
        height: Math.max(280, Math.min(height * 0.32, 420)),
        fill: "#fffaf3",
        cornerRadius: 26,
        opacity: 0.82
      })
    ];
  }

  if (template.decoration === "dots") {
    return [
      createShapeElement({
        metaKey: "decor-dots-bg",
        x: 0,
        y: 0,
        width: SLIDE_SIZE,
        height,
        fill: template.background,
        cornerRadius: 0
      }),
      ...Array.from({ length: 110 }, (_, index) =>
        createShapeElement({
          metaKey: `decor-dot-${index}`,
          x: 40 + (index % 10) * 100,
          y: 44 + Math.floor(index / 10) * 95,
          width: 10,
          height: 10,
          shape: "circle",
          fill: "rgba(0,0,0,0.05)",
          cornerRadius: 999
        })
      )
    ];
  }

  if (template.decoration === "glow") {
    return [
      createShapeElement({
        metaKey: "decor-bg",
        x: 0,
        y: 0,
        width: SLIDE_SIZE,
        height,
        fill: template.background,
        cornerRadius: 0
      }),
      createShapeElement({
        metaKey: "decor-surface",
        x: 54,
        y: 54,
        width: 972,
        height: Math.min(height - 108, 972),
        fill: template.surface,
        cornerRadius: 38
      })
    ];
  }

  return [
    createShapeElement({
      metaKey: "decor-band-top",
      x: 0,
      y: 0,
      width: SLIDE_SIZE,
      height: Math.min(height * 0.48, 540),
      fill: template.surface,
      cornerRadius: 0
    }),
    createShapeElement({
      metaKey: "decor-band-bottom",
      x: 0,
      y: Math.min(height * 0.48, 540),
      width: SLIDE_SIZE,
      height: height - Math.min(height * 0.48, 540),
      fill: "#ffffff",
      cornerRadius: 0
    })
  ];
}

function createChip(template: CarouselTemplate, index: number) {
  return createShapeElement({
    metaKey: "slide-chip",
    x: 74,
    y: 74,
    width: 212,
    height: 68,
    fill: template.chipStyle === "solid" ? template.accent : "#ffffff",
    cornerRadius: 20,
    opacity: 1,
    stroke: template.chipStyle === "outline" ? template.accent : undefined,
    strokeWidth: template.chipStyle === "outline" ? 3 : 0
  });
}

function createChipText(template: CarouselTemplate, index: number) {
  return createTextElement({
    metaKey: "slide-chip-text",
    role: "caption",
    text: `SLIDE ${index + 1}`,
    x: 110,
    y: 94,
    width: 160,
    height: 32,
    fontSize: 23,
    fill: template.chipStyle === "solid" ? "#ffffff" : template.accent,
    fontFamily: "Helvetica",
    fontStyle: "bold",
    letterSpacing: 1.2
  });
}

function countWrappedLines(text: string, width: number, fontSize: number) {
  const paragraphs = text.replace(/\r/g, "").split("\n");
  const approxCharsPerLine = Math.max(6, Math.floor(width / Math.max(1, fontSize * 0.62)));
  let totalLines = 0;

  for (const paragraph of paragraphs) {
    const normalized = paragraph.trim();

    if (!normalized) {
      totalLines += 1;
      continue;
    }

    const words = normalized.split(/\s+/);
    let lineLength = 0;
    let lines = 1;

    for (const word of words) {
      // If a single token is very long, account for forced wraps.
      if (word.length > approxCharsPerLine) {
        const forcedLines = Math.ceil(word.length / approxCharsPerLine);
        lines += Math.max(1, forcedLines - (lineLength === 0 ? 1 : 0));
        lineLength = word.length % approxCharsPerLine;
        continue;
      }

      const nextLength = lineLength === 0 ? word.length : lineLength + word.length + 1;

      if (nextLength > approxCharsPerLine) {
        lines += 1;
        lineLength = word.length;
      } else {
        lineLength = nextLength;
      }
    }

    totalLines += lines;
  }

  return totalLines;
}

function fitTextBlock(options: {
  text: string;
  width: number;
  initialFontSize: number;
  minFontSize: number;
  maxHeight: number;
  lineHeight?: number;
  minLineHeight?: number;
}) {
  const minLineHeight = options.minLineHeight ?? options.lineHeight ?? 1.02;
  let lineHeight = options.lineHeight ?? 1.1;
  const safetyLines = options.text.length > 60 ? 1 : 0.6;
  let fontSize = options.initialFontSize;
  let lines = countWrappedLines(options.text, options.width, fontSize);
  let requiredHeight = Math.ceil((lines + safetyLines) * fontSize * lineHeight + fontSize * 0.4);

  while (fontSize > options.minFontSize && requiredHeight > options.maxHeight) {
    fontSize -= 2;
    lines = countWrappedLines(options.text, options.width, fontSize);
    requiredHeight = Math.ceil((lines + safetyLines) * fontSize * lineHeight + fontSize * 0.4);
  }

  while (lineHeight > minLineHeight && requiredHeight > options.maxHeight) {
    lineHeight = Math.max(minLineHeight, Number((lineHeight - 0.03).toFixed(2)));
    lines = countWrappedLines(options.text, options.width, fontSize);
    requiredHeight = Math.ceil((lines + safetyLines) * fontSize * lineHeight + fontSize * 0.4);
  }

  const overflow = requiredHeight > options.maxHeight;

  return {
    fontSize,
    lineHeight,
    overflow,
    requiredHeight,
    height: Math.min(
      options.maxHeight,
      Math.max(requiredHeight, Math.ceil(fontSize * lineHeight + fontSize * 0.4))
    )
  };
}

function applyTextOverflowGuard(
  text: string,
  options: Omit<Parameters<typeof fitTextBlock>[0], "text">,
  initialFit: ReturnType<typeof fitTextBlock>
) {
  if (!initialFit.overflow) {
    return {
      text,
      fitted: initialFit
    };
  }

  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return {
      text,
      fitted: initialFit
    };
  }

  const words = normalized.split(" ");
  let keepCount = words.length;
  let candidateText = text;
  let candidateFit = initialFit;

  while (keepCount > 6) {
    keepCount = Math.max(6, keepCount - Math.max(2, Math.ceil(keepCount * 0.1)));
    candidateText = `${words.slice(0, keepCount).join(" ")}…`;
    candidateFit = fitTextBlock({
      ...options,
      text: candidateText
    });

    if (!candidateFit.overflow) {
      break;
    }

    if (keepCount === 6) {
      break;
    }
  }

  return {
    text: candidateText,
    fitted: candidateFit
  };
}

function clampValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function createManagedTitle(
  template: CarouselTemplate,
  text: string,
  format: SlideFormat
): TextElement {
  const layout = getFormatLayout(format);
  const { height: canvasHeight } = SLIDE_FORMAT_DIMENSIONS[format];
  const width = template.titleWidth ?? 860;
  const titleY = clampValue(
    template.titleOffsetY + layout.titleYBoost,
    78,
    Math.round(canvasHeight * 0.62)
  );
  const minBodyZone = format === "9:16" ? 300 : format === "4:5" ? 250 : 210;
  const footerReserve = layout.footerBottom + 68;
  const maxHeightByCanvas = canvasHeight - titleY - minBodyZone - footerReserve;
  const baseSize = Math.round((format === "9:16" ? 74 : 84) * layout.titleFactor);
  const maxHeight = clampValue(
    Math.max(132, maxHeightByCanvas),
    132,
    Math.round(canvasHeight * (format === "9:16" ? 0.36 : 0.4))
  );
  const fitted = fitTextBlock({
    text,
    width,
    initialFontSize: baseSize,
    minFontSize: format === "9:16" ? 20 : 22,
    maxHeight,
    lineHeight: 1.02,
    minLineHeight: 0.94
  });

  return createTextElement({
    metaKey: "managed-title",
    role: "title",
    text,
    x: template.id === "technology" ? 86 : template.id === "notes" ? 96 : 78,
    y: titleY,
    width,
    height: fitted.height,
    fontSize: fitted.fontSize,
    fill: template.titleColor,
    fontFamily: template.titleFont,
    fontStyle: "bold",
    lineHeight: fitted.lineHeight
  });
}

function createManagedBody(
  template: CarouselTemplate,
  text: string,
  format: SlideFormat,
  startY: number
): TextElement {
  const layout = getFormatLayout(format);
  const { height: canvasHeight } = SLIDE_FORMAT_DIMENSIONS[format];
  const width = template.bodyWidth ?? 820;
  const preferredBodyY = template.bodyOffsetY + layout.bodyYBoost;
  const footerReserve = layout.footerBottom + 62;
  const minBodyHeight = format === "9:16" ? 230 : format === "4:5" ? 200 : 170;
  const bodyY = clampValue(
    Math.max(preferredBodyY, startY),
    0,
    Math.max(0, canvasHeight - footerReserve - minBodyHeight)
  );
  const baseSize = Math.round((format === "9:16" ? 34 : 38) * layout.bodyFactor);
  const availableHeight = canvasHeight - bodyY - footerReserve;
  const maxHeight = Math.max(minBodyHeight, availableHeight);
  const fitted = fitTextBlock({
    text,
    width,
    initialFontSize: baseSize,
    minFontSize: format === "9:16" ? 12 : 13,
    maxHeight,
    lineHeight: 1.16,
    minLineHeight: 0.98
  });

  const fallbackFitted =
    fitted.overflow && fitted.fontSize <= (format === "9:16" ? 12 : 13)
      ? fitTextBlock({
          text,
          width,
          initialFontSize: Math.max(12, fitted.fontSize - 2),
          minFontSize: 10,
          maxHeight,
          lineHeight: 1.08,
          minLineHeight: 0.92
        })
      : fitted;
  const overflowGuard = applyTextOverflowGuard(
    text,
    {
      width,
      initialFontSize: Math.max(10, fallbackFitted.fontSize),
      minFontSize: 10,
      maxHeight,
      lineHeight: Math.max(0.92, fallbackFitted.lineHeight),
      minLineHeight: 0.9
    },
    fallbackFitted
  );

  return createTextElement({
    metaKey: "managed-body",
    role: "body",
    wasAutoTruncated: overflowGuard.text !== text,
    text: overflowGuard.text,
    x: template.id === "technology" ? 86 : template.id === "notes" ? 96 : 82,
    y: bodyY,
    width,
    height: overflowGuard.fitted.height,
    fontSize: overflowGuard.fitted.fontSize,
    fill: template.bodyColor,
    fontFamily: template.bodyFont,
    lineHeight: overflowGuard.fitted.lineHeight
  });
}

function createFooterElements(
  slide: Slide,
  template: CarouselTemplate,
  index: number,
  totalSlides: number,
  format: SlideFormat
) {
  const { height } = SLIDE_FORMAT_DIMENSIONS[format];
  const footerBottom = getFormatLayout(format).footerBottom;
  const handle = slide.profileHandle || DEFAULT_PROFILE_HANDLE;
  const subtitle = slide.profileSubtitle || DEFAULT_PROFILE_SUBTITLE;
  const footerVariant = slide.footerVariant ?? DEFAULT_FOOTER_VARIANT;
  const accent = template.accentAlt ?? template.accent;
  const footerColor = template.id.startsWith("netflix") || template.category === "dark"
    ? "#ebe1d5"
    : "#3c3c3c";
  const footerMuted = template.category === "dark" ? "#c0b5a9" : "#7f786e";
  const elements: CanvasElement[] = [];

  if (footerVariant === "v1") {
    elements.push(
      createTextElement({
        metaKey: "profile-handle",
        role: "caption",
        text: handle,
        x: 78,
        y: height - footerBottom,
        width: 320,
        height: 30,
        fontSize: 25,
        fill: footerColor,
        fontFamily: "Helvetica",
        fontStyle: "bold"
      }),
      createTextElement({
        metaKey: "profile-subtitle",
        role: "caption",
        text: subtitle,
        x: 78,
        y: height - (footerBottom - 30),
        width: 280,
        height: 28,
        fontSize: 24,
        fill: footerMuted,
        fontFamily: "Helvetica"
      })
    );
  }

  if (footerVariant === "v2") {
    elements.push(
      createTextElement({
        metaKey: "profile-handle",
        role: "caption",
        text: handle,
        x: 78,
        y: 72,
        width: 320,
        height: 28,
        fontSize: 22,
        fill: footerColor,
        fontFamily: "Helvetica",
        fontStyle: "bold"
      }),
      createTextElement({
        metaKey: "footer-counter",
        role: "caption",
        text: `[${index + 1}/${totalSlides}]`,
        x: 928,
        y: 72,
        width: 80,
        height: 28,
        fontSize: 22,
        fill: footerMuted,
        fontFamily: "Helvetica",
        align: "right"
      }),
      createTextElement({
        metaKey: "profile-subtitle",
        role: "caption",
        text: subtitle,
        x: 78,
        y: height - footerBottom,
        width: 280,
        height: 28,
        fontSize: 23,
        fill: footerMuted,
        fontFamily: "Helvetica"
      })
    );
  }

  if (footerVariant === "v3") {
    elements.push(
      createShapeElement({
        metaKey: "profile-dot",
        x: 70,
        y: height - (footerBottom + 2),
        width: 36,
        height: 36,
        shape: "circle",
        fill: accent,
        cornerRadius: 999
      }),
      createTextElement({
        metaKey: "profile-handle",
        role: "caption",
        text: handle,
        x: 122,
        y: height - (footerBottom + 4),
        width: 260,
        height: 28,
        fontSize: 24,
        fill: footerColor,
        fontFamily: "Helvetica",
        fontStyle: "bold"
      }),
      createTextElement({
        metaKey: "profile-subtitle",
        role: "caption",
        text: subtitle,
        x: 122,
        y: height - (footerBottom - 24),
        width: 280,
        height: 26,
        fontSize: 23,
        fill: footerMuted,
        fontFamily: "Helvetica"
      })
    );
  }

  if (footerVariant === "v4") {
    elements.push(
      createTextElement({
        metaKey: "profile-handle",
        role: "caption",
        text: handle,
        x: 270,
        y: 72,
        width: 540,
        height: 28,
        fontSize: 22,
        fill: footerColor,
        fontFamily: "Helvetica",
        fontStyle: "bold",
        align: "center"
      })
    );
  }

  elements.push(
    createTextElement({
      metaKey: "cta-arrow",
      role: "caption",
      text: "\u2192",
      x: 938,
      y: height - (footerBottom + 10),
      width: 48,
      height: 48,
      fontSize: 40,
      fill: template.category === "dark" ? accent : "#171717",
      fontFamily: "Arial",
      fontStyle: "bold",
      align: "center"
    })
  );

  return elements;
}

function isManagedElement(element: CanvasElement) {
  return Boolean(element.metaKey);
}

function extractManagedContent(slide: Slide): ManagedContent {
  const title =
    slide.elements.find(
      (element): element is TextElement =>
        element.type === "text" && element.metaKey === "managed-title"
    )?.text ??
    slide.elements.find(
      (element): element is TextElement =>
        element.type === "text" && element.role === "title"
    )?.text ??
    slide.name;

  const body =
    slide.elements.find(
      (element): element is TextElement =>
        element.type === "text" && element.metaKey === "managed-body"
    )?.text ??
    slide.elements.find(
      (element): element is TextElement =>
        element.type === "text" && element.role === "body"
    )?.text ??
    "";

  const handle =
    slide.profileHandle ??
    slide.elements.find(
      (element): element is TextElement =>
        element.type === "text" && element.metaKey === "profile-handle"
    )?.text ??
    DEFAULT_PROFILE_HANDLE;

  const subtitle =
    slide.profileSubtitle ??
    slide.elements.find(
      (element): element is TextElement =>
        element.type === "text" && element.metaKey === "profile-subtitle"
    )?.text ??
    DEFAULT_PROFILE_SUBTITLE;

  return { title, body, handle, subtitle };
}

function buildManagedElements(
  slide: Slide,
  templateId: CarouselTemplateId,
  index: number,
  totalSlides: number,
  format: SlideFormat,
  titleText: string,
  bodyText: string
) {
  const template = getTemplate(templateId);
  const managed: CanvasElement[] = [];
  managed.push(
    ...createDecoration(template, format)
  );

  if (slide.backgroundImage) {
    managed.push(createBackgroundImageElement(slide.backgroundImage, format));
  }

  const managedTitle = createManagedTitle(template, titleText, format);
  const bodyStart = managedTitle.y + managedTitle.height + 28;
  const managedBody = createManagedBody(template, bodyText, format, bodyStart);

  managed.push(createChip(template, index), createChipText(template, index), managedTitle, managedBody);
  managed.push(...createFooterElements(slide, template, index, totalSlides, format));

  return managed;
}

function scaleElement(
  element: CanvasElement,
  fromFormat: SlideFormat,
  toFormat: SlideFormat
): CanvasElement {
  const from = SLIDE_FORMAT_DIMENSIONS[fromFormat];
  const to = SLIDE_FORMAT_DIMENSIONS[toFormat];
  const scaleX = to.width / from.width;
  const scaleY = to.height / from.height;
  const textScale = FORMAT_TEXT_SCALE[toFormat] / FORMAT_TEXT_SCALE[fromFormat];
  const round = (value: number) => Number(value.toFixed(2));

  if (element.type === "text") {
    const nextWidth = clampValue(element.width * scaleX, 60, to.width);
    const nextHeight = clampValue(element.height * scaleY, 28, to.height);
    const nextX = clampValue(element.x * scaleX, 0, Math.max(0, to.width - nextWidth));
    const nextY = clampValue(element.y * scaleY, 0, Math.max(0, to.height - nextHeight));
    return {
      ...element,
      x: round(nextX),
      y: round(nextY),
      width: round(nextWidth),
      height: round(nextHeight),
      fontSize: round(clampValue(element.fontSize * textScale, 14, 240))
    };
  }

  const nextWidth = clampValue(element.width * scaleX, 60, to.width);
  const nextHeight = clampValue(element.height * scaleY, 60, to.height);
  const nextX = clampValue(element.x * scaleX, 0, Math.max(0, to.width - nextWidth));
  const nextY = clampValue(element.y * scaleY, 0, Math.max(0, to.height - nextHeight));

  return {
    ...element,
    x: round(nextX),
    y: round(nextY),
    width: round(nextWidth),
    height: round(nextHeight)
  };
}

function rebuildSlide(
  slide: Slide,
  index: number,
  totalSlides: number,
  templateId: CarouselTemplateId,
  format: SlideFormat,
  customElements: CanvasElement[]
): Slide {
  const content = extractManagedContent(slide);

  return {
    ...slide,
    name: content.title,
    background: getTemplate(templateId).background,
    templateId,
    footerVariant: slide.footerVariant ?? DEFAULT_FOOTER_VARIANT,
    profileHandle: content.handle,
    profileSubtitle: content.subtitle,
    backgroundImage:
      slide.backgroundImage ??
      (slide.elements.find(
        (element): element is ImageElement =>
          element.type === "image" && element.metaKey === "background-image"
      )?.src ?? null),
    elements: [
      ...buildManagedElements(
        {
          ...slide,
          profileHandle: content.handle,
          profileSubtitle: content.subtitle,
          footerVariant: slide.footerVariant ?? DEFAULT_FOOTER_VARIANT
        },
        templateId,
        index,
        totalSlides,
        format,
        content.title,
        content.body
      ),
      ...customElements
    ]
  };
}

export function createSlideFromOutline(
  outline: OutlineLike,
  index: number,
  templateId: CarouselTemplateId = "netflix",
  format: SlideFormat = "1:1",
  totalSlides = 1
): Slide {
  const rawTitle = readOutlineTitle(outline);
  const rawBody = readOutlineBody(outline);
  const title = rawTitle || "Новый заголовок";
  const body =
    rawBody ||
    "Добавьте текст, загрузите изображение или поставьте своё фото в фон. В этом блоке стоит раскрыть главную мысль и дать конкретику, чтобы карточка выглядела законченной.";
  const slide: Slide = {
    id: crypto.randomUUID(),
    name: title,
    background: getTemplate(templateId).background,
    templateId,
    footerVariant: DEFAULT_FOOTER_VARIANT,
    profileHandle: DEFAULT_PROFILE_HANDLE,
    profileSubtitle: DEFAULT_PROFILE_SUBTITLE,
    backgroundImage: null,
    elements: []
  };

  return {
    ...slide,
    elements: buildManagedElements(slide, templateId, index, totalSlides, format, title, body)
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
  return slides.map((slide, index) =>
    applyTemplateToSlide(slide, templateId, index, slides.length, format)
  );
}

export function createSlidesFromOutline(
  outline: OutlineLike[],
  templateId: CarouselTemplateId = "netflix",
  format: SlideFormat = "1:1",
  requestedCount?: number
): Slide[] {
  const rawCount =
    requestedCount ?? (outline.length > 0 ? outline.length : DEFAULT_SLIDES_COUNT);
  const targetCount = clampSlidesCount(rawCount);
  const safeOutline = outline
    .map((item) => ({
      title: readOutlineTitle(item),
      text: readOutlineBody(item)
    }))
    .filter((item) => item.title || item.text)
    .slice(0, targetCount);

  while (safeOutline.length < targetCount) {
    const index = safeOutline.length;
    safeOutline.push({
      title: `Слайд ${index + 1}`,
      text:
        "Добавьте конкретный тезис с примерами, последствиями и практическим действием, чтобы слайд не выглядел пустым."
    });
  }

  return safeOutline.map((item, index) =>
    createSlideFromOutline(item, index, templateId, format, safeOutline.length)
  );
}

export function createStarterSlides(
  templateId: CarouselTemplateId = "technology",
  format: SlideFormat = "1:1"
): Slide[] {
  return createSlidesFromOutline(
    [
      {
        title: "Как пользоваться Помощником эксперта",
        text: "Это стартовый onboarding внутри «Помощника эксперта». Здесь показано, как вставить идею, сгенерировать глубокую карусель, выбрать шаблон, настроить свой профиль и быстро довести карточки до публикации."
      },
      {
        title: "1. Вставьте тему или сырой набросок",
        text: "В верхнее поле можно вставить не только короткую тему, но и целую подборку идей, возражений, мифов, тезисов и фраз. Генератор использует это как исходный материал и превращает в полноценную структуру карусели."
      },
      {
        title: "2. Генерация делает готовый смысл, а не пустой каркас",
        text: "После нажатия на кнопку AI не просто разбивает тему по слайдам, а пишет заголовки, раскрывает посыл, добавляет доказательства, ошибки, шаги, формулировки и финальный CTA. Получается текст, который уже можно публиковать и усиливать."
      },
      {
        title: "3. Один клик выбирает элемент",
        text: "Клик по тексту или картинке делает элемент активным. После этого можно двигать его, менять размер, править текст справа и удалять кнопкой рядом с выделением, как в обычных редакторах."
      },
      {
        title: "4. Добавляйте фото на слайд и в фон",
        text: "Возле каждого слайда есть быстрая кнопка загрузки изображения в сам макет. А в правой панели можно отдельно поставить фоновое фото, если хотите сделать более эмоциональную или премиальную подачу."
      },
      {
        title: "5. Форматы и шаблоны адаптируются",
        text: "Переключайте 1:1, 4:5 и 9:16. Редактор перестраивает композицию под формат, а справа можно выбрать шаблон только для текущего слайда или для всей карусели сразу."
      },
      {
        title: "6. Быстрые действия находятся справа от карточки",
        text: "У каждого слайда есть своё компактное меню: выбрать карточку, загрузить фото, добавить текст, поднять выше, опустить ниже или удалить сам слайд. Плюсик между слайдами вставляет новую карточку ровно в нужное место."
      },
      {
        title: "7. История не тянется между открытиями",
        text: "Каждое новое открытие редактора начинается как новая сессия. Старые черновики автоматически не подтягиваются, поэтому на входе вы всегда видите чистую инструкцию и можете начать заново без мусора."
      },
      {
        title: "8. Эти слайды можно спокойно удалить",
        text: "Onboarding нужен только для первого знакомства. Удалите эти карточки по одной, замените их своими или просто вставьте новую структуру через генератор и начните собирать реальную карусель."
      }
    ],
    templateId,
    format
  );
}

export function createBlankSlide(
  index: number,
  templateId: CarouselTemplateId = "netflix",
  format: SlideFormat = "1:1",
  totalSlides = index + 1
): Slide {
  return createSlideFromOutline(
    {
      title: "Новый заголовок",
      text: "Добавьте текст, загрузите изображение или поставьте своё фото в фон."
    },
    index,
    templateId,
    format,
    totalSlides
  );
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
      slide.templateId ?? "technology",
      toFormat,
      customElements
    );
  });
}

export function updateSlideFooter(
  slide: Slide,
  updates: Partial<Pick<Slide, "profileHandle" | "profileSubtitle" | "footerVariant">>,
  index: number,
  totalSlides: number,
  format: SlideFormat
) {
  const customElements = slide.elements.filter((element) => !isManagedElement(element));
  return rebuildSlide(
    {
      ...slide,
      profileHandle: updates.profileHandle ?? slide.profileHandle,
      profileSubtitle: updates.profileSubtitle ?? slide.profileSubtitle,
      footerVariant: updates.footerVariant ?? slide.footerVariant
    },
    index,
    totalSlides,
    slide.templateId ?? "technology",
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
    slide.templateId ?? "technology",
    format,
    customElements
  );
}

export function reorderSlides(slides: Slide[], fromId: string, toId: string) {
  const fromIndex = slides.findIndex((slide) => slide.id === fromId);
  const toIndex = slides.findIndex((slide) => slide.id === toId);

  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
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

      if (element.metaKey === "slide-chip-text") {
        return {
          ...element,
          text: `SLIDE ${index + 1}`
        };
      }

      if (element.metaKey === "footer-counter") {
        return {
          ...element,
          text: `[${index + 1}/${slides.length}]`
        };
      }

      return element;
    })
  }));
}

export function projectTitleFromTopic(topic: string) {
  return topic.trim() || "Новая карусель";
}

function normalizeOutlineValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readOutlineTitle(outline: OutlineLike) {
  return normalizeOutlineValue(outline.title);
}

function readOutlineBody(outline: OutlineLike) {
  return (
    normalizeOutlineValue(outline.text) ||
    normalizeOutlineValue(outline.body) ||
    normalizeOutlineValue(outline.description) ||
    normalizeOutlineValue(outline.content) ||
    normalizeOutlineValue(outline.textBody)
  );
}
