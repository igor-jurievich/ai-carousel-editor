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
  dark: "Тёмные",
  light: "Светлые",
  color: "Акцентные"
};

export const FONT_OPTIONS = [
  "Inter",
  "Manrope",
  "Fira Code",
  "Roboto Condensed",
  "Russo One",
  "Oswald",
  "Advent Pro",
  "El Messiri"
];

export const PRIMARY_TEMPLATE_IDS = [
  "minimal",
  "netflix",
  "atlas"
] as const satisfies readonly CarouselTemplateId[];

export const BACKGROUND_STYLE_PRESETS = [
  { id: "mono", label: "Монохром", templateId: "minimal" },
  { id: "grid", label: "Сетка", templateId: "technology" },
  { id: "gradient", label: "Градиент", templateId: "aurora" },
  { id: "notes", label: "Заметки", templateId: "notes" },
  { id: "dots", label: "Точки", templateId: "charge" },
  { id: "bolts", label: "Молнии", templateId: "cyberpunk" },
  { id: "lines", label: "Линии", templateId: "founder-dark" }
] as const;

export const CAROUSEL_TEMPLATES: CarouselTemplate[] = [
  {
    id: "netflix",
    category: "dark",
    name: "Premium Dark",
    description: "Чистый dark-hero для экспертного контента с сильной иерархией.",
    accent: "#ff6b3f",
    accentAlt: "#ff9a73",
    background: "#101114",
    surface: "#191b22",
    titleColor: "#f6f7fb",
    bodyColor: "#c7ccd8",
    titleFont: "Manrope",
    bodyFont: "Inter",
    titleOffsetY: 298,
    bodyOffsetY: 612,
    titleWidth: 858,
    bodyWidth: 812,
    bodyHeight: 262,
    chipStyle: "solid",
    decoration: "glow",
    preview: "Сильный крючок с аккуратным dark premium настроением."
  },
  {
    id: "matrix",
    category: "dark",
    name: "Tech Grid",
    description: "Тёмная сетка и холодные акценты для IT и продуктовых тем.",
    accent: "#57d4ff",
    accentAlt: "#8df3ff",
    background: "#0f131a",
    surface: "#171d27",
    titleColor: "#f3f8ff",
    bodyColor: "#b6c4d8",
    titleFont: "Space Grotesk",
    bodyFont: "Inter",
    titleOffsetY: 304,
    bodyOffsetY: 624,
    titleWidth: 876,
    bodyWidth: 812,
    bodyHeight: 258,
    chipStyle: "outline",
    decoration: "lines",
    preview: "Чистая data-композиция со спокойной неоновой акцентностью."
  },
  {
    id: "premium",
    category: "dark",
    name: "Noir Editorial",
    description: "Редакционный dark-стиль с акцентом на смысл и ритм.",
    accent: "#d7b06f",
    accentAlt: "#f1d9a7",
    background: "#131212",
    surface: "#1c1b1c",
    titleColor: "#f2ede4",
    bodyColor: "#cdc2b4",
    titleFont: "Georgia",
    bodyFont: "Inter",
    titleOffsetY: 324,
    bodyOffsetY: 646,
    titleWidth: 860,
    bodyWidth: 804,
    bodyHeight: 254,
    chipStyle: "solid",
    decoration: "band",
    preview: "Контент как в дорогой editorial-обложке."
  },
  {
    id: "midnight",
    category: "dark",
    name: "Midnight",
    description: "Гладкий ночной градиент с мягкой подложкой под текст.",
    accent: "#7e86ff",
    accentAlt: "#b8beff",
    background: "#0f1222",
    surface: "#181d33",
    titleColor: "#f5f6ff",
    bodyColor: "#c5c9e4",
    titleFont: "Manrope",
    bodyFont: "Inter",
    titleOffsetY: 286,
    bodyOffsetY: 600,
    titleWidth: 828,
    bodyWidth: 782,
    bodyHeight: 262,
    chipStyle: "outline",
    decoration: "glow",
    preview: "Спокойная ночная подача для образовательных и экспертных постов."
  },
  {
    id: "noir",
    category: "dark",
    name: "Obsidian",
    description: "Минималистичный чёрный стиль с контрастным CTA.",
    accent: "#ff7048",
    accentAlt: "#ffaf95",
    background: "#0d0d0f",
    surface: "#17171b",
    titleColor: "#f7f7f9",
    bodyColor: "#c6c7cf",
    titleFont: "Space Grotesk",
    bodyFont: "Inter",
    titleOffsetY: 302,
    bodyOffsetY: 618,
    titleWidth: 868,
    bodyWidth: 818,
    bodyHeight: 250,
    chipStyle: "solid",
    decoration: "paper",
    preview: "Сильная контрастная карточка под боль, миф, провокационный тезис."
  },
  {
    id: "founder-dark",
    category: "dark",
    name: "Founder",
    description: "Бизнес dark-шаблон с чистым вертикальным ритмом.",
    accent: "#31d3ad",
    accentAlt: "#79e8ca",
    background: "#0f1720",
    surface: "#1a2732",
    titleColor: "#f2f8fb",
    bodyColor: "#b9cad4",
    titleFont: "Manrope",
    bodyFont: "DM Sans",
    titleOffsetY: 318,
    bodyOffsetY: 636,
    titleWidth: 852,
    bodyWidth: 804,
    bodyHeight: 248,
    chipStyle: "outline",
    decoration: "lines",
    preview: "Премиальная business-структура для позиционирования и social proof."
  },
  {
    id: "notes",
    category: "light",
    name: "Soft Neutral",
    description: "Светлая нейтральная композиция в стиле clean notes.",
    accent: "#ff8b5c",
    accentAlt: "#ffd6c2",
    background: "#f7f6f4",
    surface: "#ffffff",
    titleColor: "#1d2128",
    bodyColor: "#535a66",
    titleFont: "Manrope",
    bodyFont: "Inter",
    titleOffsetY: 232,
    bodyOffsetY: 478,
    titleWidth: 856,
    bodyWidth: 804,
    bodyHeight: 264,
    chipStyle: "outline",
    decoration: "paper",
    preview: "Воздушная карточка с чистой типографикой и мягкой подложкой."
  },
  {
    id: "technology",
    category: "light",
    name: "Clean Grid",
    description: "Чистый сеточный светлый шаблон для продуктов и гайдов.",
    accent: "#4268ff",
    accentAlt: "#8ea3ff",
    background: "#f8fafc",
    surface: "#ffffff",
    titleColor: "#171d29",
    bodyColor: "#4f5a6b",
    titleFont: "Space Grotesk",
    bodyFont: "Inter",
    titleOffsetY: 246,
    bodyOffsetY: 492,
    titleWidth: 900,
    bodyWidth: 820,
    bodyHeight: 256,
    chipStyle: "outline",
    decoration: "grid",
    preview: "Современный product-стиль с предсказуемой сеткой и иерархией."
  },
  {
    id: "charge",
    category: "light",
    name: "Creator Light",
    description: "Светлая creator-подача с энергичным акцентом.",
    accent: "#ff662e",
    accentAlt: "#ffb38d",
    background: "#fdf8f4",
    surface: "#ffffff",
    titleColor: "#1f232a",
    bodyColor: "#525a67",
    titleFont: "Manrope",
    bodyFont: "DM Sans",
    titleOffsetY: 254,
    bodyOffsetY: 506,
    titleWidth: 862,
    bodyWidth: 790,
    bodyHeight: 248,
    chipStyle: "solid",
    decoration: "dots",
    preview: "Лёгкая социальная карточка с акцентом под CTA."
  },
  {
    id: "minimal",
    category: "light",
    name: "Minimal Light",
    description: "Минималистичный светлый шаблон с большим количеством воздуха.",
    accent: "#1f2937",
    accentAlt: "#9ba3af",
    background: "#f4f5f7",
    surface: "#ffffff",
    titleColor: "#181d27",
    bodyColor: "#4f5968",
    titleFont: "Manrope",
    bodyFont: "Inter",
    titleOffsetY: 262,
    bodyOffsetY: 520,
    titleWidth: 846,
    bodyWidth: 788,
    bodyHeight: 246,
    chipStyle: "outline",
    decoration: "band",
    preview: "Минимум визуального шума, максимум читабельности."
  },
  {
    id: "blank",
    category: "light",
    name: "Blank",
    description: "Чистый белый холст без декоративных слоёв.",
    accent: "#2caea1",
    accentAlt: "#72d6cb",
    background: "#ffffff",
    surface: "#ffffff",
    titleColor: "#161f21",
    bodyColor: "#374749",
    titleFont: "Manrope",
    bodyFont: "Inter",
    titleOffsetY: 232,
    bodyOffsetY: 504,
    titleWidth: 880,
    bodyWidth: 820,
    bodyHeight: 248,
    chipStyle: "outline",
    decoration: "none",
    preview: "Нейтральный стартовый шаблон под ручную сборку композиции."
  },
  {
    id: "editorial",
    category: "light",
    name: "Editorial",
    description: "Светлый editorial-стиль для экспертных колонок.",
    accent: "#7f5cff",
    accentAlt: "#c5b5ff",
    background: "#f8f6ff",
    surface: "#ffffff",
    titleColor: "#1d1f2d",
    bodyColor: "#535770",
    titleFont: "Georgia",
    bodyFont: "Inter",
    titleOffsetY: 246,
    bodyOffsetY: 500,
    titleWidth: 884,
    bodyWidth: 818,
    bodyHeight: 252,
    chipStyle: "outline",
    decoration: "paper",
    preview: "Журнальный подход с чистой структурой текста и мягким акцентом."
  },
  {
    id: "business-light",
    category: "light",
    name: "Modern Business",
    description: "Деловой шаблон с мягким контрастом и clean-ритмом.",
    accent: "#0f9d8d",
    accentAlt: "#8ed8cd",
    background: "#f4faf8",
    surface: "#ffffff",
    titleColor: "#172329",
    bodyColor: "#51626a",
    titleFont: "Manrope",
    bodyFont: "DM Sans",
    titleOffsetY: 250,
    bodyOffsetY: 506,
    titleWidth: 884,
    bodyWidth: 816,
    bodyHeight: 252,
    chipStyle: "solid",
    decoration: "grid",
    preview: "Бизнес-подача для кейсов, выгод и структурных списков."
  },
  {
    id: "jungle",
    category: "color",
    name: "Bold Contrast",
    description: "Смелая контрастная цветовая подача под creator и экспертов.",
    accent: "#ffd447",
    accentAlt: "#ff9e5a",
    background: "#11413a",
    surface: "#18584f",
    titleColor: "#f1fff8",
    bodyColor: "#caece1",
    titleFont: "Space Grotesk",
    bodyFont: "Inter",
    titleOffsetY: 302,
    bodyOffsetY: 620,
    titleWidth: 816,
    bodyWidth: 766,
    bodyHeight: 252,
    chipStyle: "solid",
    decoration: "glow",
    preview: "Дерзкая цветовая карточка для цепляющих тезисов и хуков."
  },
  {
    id: "cyberpunk",
    category: "color",
    name: "Neon Insight",
    description: "Электрический контраст для product и growth-контента.",
    accent: "#ff62c5",
    accentAlt: "#65f0ff",
    background: "#1737c9",
    surface: "#2448db",
    titleColor: "#ffffff",
    bodyColor: "#e6efff",
    titleFont: "Space Grotesk",
    bodyFont: "Inter",
    titleOffsetY: 308,
    bodyOffsetY: 626,
    titleWidth: 820,
    bodyWidth: 760,
    bodyHeight: 246,
    chipStyle: "solid",
    decoration: "bolts",
    preview: "Digital-стиль с яркой, но читаемой типографикой."
  },
  {
    id: "mandarin",
    category: "color",
    name: "Mandarin",
    description: "Тёплый акцентный шаблон для продающих и обучающих слайдов.",
    accent: "#ff6425",
    accentAlt: "#ffd4be",
    background: "#fff5ef",
    surface: "#ffffff",
    titleColor: "#2a2421",
    bodyColor: "#605954",
    titleFont: "Manrope",
    bodyFont: "Inter",
    titleOffsetY: 258,
    bodyOffsetY: 514,
    titleWidth: 896,
    bodyWidth: 820,
    bodyHeight: 248,
    chipStyle: "solid",
    decoration: "dots",
    preview: "Тёплая палитра и аккуратная структура для everyday-контента."
  },
  {
    id: "aurora",
    category: "color",
    name: "Aurora",
    description: "Плавные градиенты и premium-акцент в цветной эстетике.",
    accent: "#6f6bff",
    accentAlt: "#b39cff",
    background: "#f1eeff",
    surface: "#f8f5ff",
    titleColor: "#1e1933",
    bodyColor: "#4f4a71",
    titleFont: "Space Grotesk",
    bodyFont: "Inter",
    titleOffsetY: 266,
    bodyOffsetY: 522,
    titleWidth: 872,
    bodyWidth: 804,
    bodyHeight: 250,
    chipStyle: "outline",
    decoration: "glow",
    preview: "Градиентная modern-карточка для creator и personal brand."
  },
  {
    id: "coral",
    category: "color",
    name: "Coral",
    description: "Яркий коралловый стиль с мягкой типографикой.",
    accent: "#ff5e6e",
    accentAlt: "#ffb0b7",
    background: "#fff1f3",
    surface: "#ffffff",
    titleColor: "#2b1a1e",
    bodyColor: "#65545a",
    titleFont: "Manrope",
    bodyFont: "DM Sans",
    titleOffsetY: 264,
    bodyOffsetY: 520,
    titleWidth: 870,
    bodyWidth: 804,
    bodyHeight: 248,
    chipStyle: "solid",
    decoration: "paper",
    preview: "Эмоциональная social-proof карточка с тёплым характером."
  },
  {
    id: "atlas",
    category: "color",
    name: "Atlas",
    description: "Структурный цветной бизнес-шаблон под кейсы и фреймворки.",
    accent: "#00a3a8",
    accentAlt: "#90dfe1",
    background: "#ecfbfb",
    surface: "#f6fffe",
    titleColor: "#10262a",
    bodyColor: "#47666c",
    titleFont: "Space Grotesk",
    bodyFont: "Inter",
    titleOffsetY: 262,
    bodyOffsetY: 520,
    titleWidth: 890,
    bodyWidth: 816,
    bodyHeight: 252,
    chipStyle: "outline",
    decoration: "band",
    preview: "Сильная деловая композиция с цветовым якорем."
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

type ManagedTextStyle = Pick<
  TextElement,
  "fontSize" | "fontFamily" | "fontStyle" | "fill" | "align" | "lineHeight" | "letterSpacing" | "textDecoration"
>;

type BackgroundImageStyle = {
  fitMode?: ImageElement["fitMode"];
  zoom?: number;
  offsetX?: number;
  offsetY?: number;
  darken?: number;
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

function resolveTemplateId(candidate: CarouselTemplateId | undefined, fallback: CarouselTemplateId) {
  if (!candidate) {
    return fallback;
  }

  return CAROUSEL_TEMPLATES.some((template) => template.id === candidate)
    ? candidate
    : fallback;
}

export function getTemplatesByCategory(category: TemplateCategoryId) {
  return CAROUSEL_TEMPLATES.filter((template) => template.category === category);
}

export function getPrimaryTemplates() {
  const items = PRIMARY_TEMPLATE_IDS.map((id) =>
    CAROUSEL_TEMPLATES.find((template) => template.id === id)
  ).filter((template): template is CarouselTemplate => Boolean(template));

  return items.length ? items : CAROUSEL_TEMPLATES.slice(0, 3);
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
    fontFamily: overrides.fontFamily ?? (isTitle ? "Manrope" : "Inter"),
    fontStyle: overrides.fontStyle ?? (isTitle ? "bold" : "normal"),
    fill: overrides.fill ?? "#141414",
    align: overrides.align ?? "left",
    lineHeight: overrides.lineHeight ?? (isTitle ? 1.02 : 1.18),
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
    cornerRadius: overrides.cornerRadius ?? 32,
    fitMode: overrides.fitMode ?? "cover",
    zoom: overrides.zoom ?? 1,
    offsetX: overrides.offsetX ?? 0,
    offsetY: overrides.offsetY ?? 0,
    naturalWidth: overrides.naturalWidth,
    naturalHeight: overrides.naturalHeight,
    darken: overrides.darken ?? 0
  };
}

function createBackgroundImageElement(
  src: string,
  format: SlideFormat,
  options?: {
    fitMode?: ImageElement["fitMode"];
    zoom?: number;
    offsetX?: number;
    offsetY?: number;
    darken?: number;
  }
) {
  const { width, height } = SLIDE_FORMAT_DIMENSIONS[format];
  return createImageElement(src, {
    metaKey: "background-image",
    x: 0,
    y: 0,
    width,
    height,
    cornerRadius: 0,
    fitMode: options?.fitMode ?? "cover",
    zoom: options?.zoom ?? 1,
    offsetX: options?.offsetX ?? 0,
    offsetY: options?.offsetY ?? 0,
    darken: options?.darken ?? 0
  });
}

function getFormatLayout(format: SlideFormat) {
  if (format === "4:5") {
    return {
      titleFactor: 0.94,
      bodyFactor: 0.96,
      titleYBoost: 82,
      bodyYBoost: 148,
      footerBottom: 118
    };
  }

  if (format === "9:16") {
    return {
      titleFactor: 0.82,
      bodyFactor: 0.88,
      titleYBoost: 136,
      bodyYBoost: 276,
      footerBottom: 144
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

type ImageTopLayout = {
  cardX: number;
  cardY: number;
  cardWidth: number;
  cardHeight: number;
  imageX: number;
  imageY: number;
  imageWidth: number;
  imageHeight: number;
  textPanelY: number;
  textPanelHeight: number;
  textX: number;
  textWidth: number;
  titleY: number;
  textBottom: number;
};

function getImageTopLayout(format: SlideFormat): ImageTopLayout {
  const { height } = SLIDE_FORMAT_DIMENSIONS[format];
  const cardX = 52;
  const cardY = 52;
  const cardWidth = 976;
  const cardHeight = Math.max(360, height - cardY * 2);
  const imageX = cardX + 20;
  const imageY = cardY + 20;
  const imageWidth = cardWidth - 40;
  const imageHeight = format === "9:16" ? 708 : format === "4:5" ? 558 : 446;
  const textPanelY = imageY + imageHeight - 2;
  const textPanelHeight = Math.max(248, cardY + cardHeight - textPanelY - 16);
  const textX = cardX + 52;
  const textWidth = cardWidth - 104;
  const titleY = textPanelY + 46;
  const textBottom =
    cardY + cardHeight - (format === "9:16" ? 170 : format === "4:5" ? 154 : 144);

  return {
    cardX,
    cardY,
    cardWidth,
    cardHeight,
    imageX,
    imageY,
    imageWidth,
    imageHeight,
    textPanelY,
    textPanelHeight,
    textX,
    textWidth,
    titleY,
    textBottom
  };
}

function getImageBottomLayout(format: SlideFormat): ImageTopLayout {
  const { height } = SLIDE_FORMAT_DIMENSIONS[format];
  const cardX = 52;
  const cardY = 52;
  const cardWidth = 976;
  const cardHeight = Math.max(360, height - cardY * 2);
  const imageWidth = cardWidth - 40;
  const imageHeight = format === "9:16" ? 612 : format === "4:5" ? 468 : 368;
  const imageBottomReserve = format === "9:16" ? 194 : format === "4:5" ? 176 : 168;
  const imageBottom = cardY + cardHeight - imageBottomReserve;
  const imageX = cardX + 20;
  const imageY = Math.max(cardY + 220, imageBottom - imageHeight);
  const textPanelY = cardY + 18;
  const textPanelHeight = Math.max(180, imageY - textPanelY - 16);
  const textX = cardX + 52;
  const textWidth = cardWidth - 104;
  const titleY = textPanelY + 46;
  const textBottom = imageY - (format === "9:16" ? 164 : format === "4:5" ? 150 : 138);

  return {
    cardX,
    cardY,
    cardWidth,
    cardHeight,
    imageX,
    imageY,
    imageWidth,
    imageHeight,
    textPanelY,
    textPanelHeight,
    textX,
    textWidth,
    titleY,
    textBottom
  };
}

function createDecoration(template: CarouselTemplate, format: SlideFormat): CanvasElement[] {
  const { height } = SLIDE_FORMAT_DIMENSIONS[format];

  if (template.decoration === "none") {
    return [
      createShapeElement({
        metaKey: "decor-bg",
        x: 0,
        y: 0,
        width: SLIDE_SIZE,
        height,
        fill: template.background,
        cornerRadius: 0
      })
    ];
  }

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
      createShapeElement({
        metaKey: "decor-grid-surface",
        x: 52,
        y: 52,
        width: 976,
        height: Math.max(300, height - 104),
        fill: template.surface,
        cornerRadius: 34,
        opacity: 0.94
      }),
      ...Array.from({ length: 11 }, (_, index) =>
        createShapeElement({
          metaKey: `decor-grid-v-${index}`,
          x: 78 + index * 92,
          y: 50,
          width: 1,
          height,
          fill: "rgba(0,0,0,0.045)",
          cornerRadius: 0
        })
      ),
      ...Array.from({ length: Math.ceil(height / 92) }, (_, index) =>
        createShapeElement({
          metaKey: `decor-grid-h-${index}`,
          x: 52,
          y: 52 + index * 92,
          width: SLIDE_SIZE,
          height: 1,
          fill: "rgba(0,0,0,0.036)",
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
        x: 54,
        y: 52,
        width: 972,
        height: Math.max(380, height - 104),
        fill: template.surface,
        cornerRadius: 34,
        opacity: 0.96
      }),
      createShapeElement({
        metaKey: "decor-paper-top",
        x: 78,
        y: 80,
        width: 420,
        height: 74,
        fill: "rgba(255,255,255,0.78)",
        cornerRadius: 18,
        opacity: 0.72
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
      createShapeElement({
        metaKey: "decor-dots-surface",
        x: 56,
        y: 56,
        width: 968,
        height: Math.max(360, height - 112),
        fill: template.surface,
        cornerRadius: 34,
        opacity: 0.96
      }),
      ...Array.from({ length: 88 }, (_, index) =>
        createShapeElement({
          metaKey: `decor-dot-${index}`,
          x: 92 + (index % 8) * 114,
          y: 96 + Math.floor(index / 8) * 106,
          width: 7,
          height: 7,
          shape: "circle",
          fill: "rgba(0,0,0,0.075)",
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
        x: 52,
        y: 52,
        width: 976,
        height: Math.max(360, height - 104),
        fill: template.surface,
        cornerRadius: 36
      }),
      createShapeElement({
        metaKey: "decor-glow-left",
        x: -180,
        y: Math.round(height * 0.28),
        width: 460,
        height: 460,
        shape: "circle",
        fill: "rgba(255,255,255,0.13)",
        cornerRadius: 999,
        opacity: 0.78
      }),
      createShapeElement({
        metaKey: "decor-glow-right",
        x: 760,
        y: Math.round(height * 0.08),
        width: 420,
        height: 420,
        shape: "circle",
        fill: "rgba(255,255,255,0.1)",
        cornerRadius: 999,
        opacity: 0.62
      })
    ];
  }

  if (template.decoration === "lines") {
    return [
      createShapeElement({
        metaKey: "decor-lines-bg",
        x: 0,
        y: 0,
        width: SLIDE_SIZE,
        height,
        fill: template.background,
        cornerRadius: 0
      }),
      createShapeElement({
        metaKey: "decor-lines-surface",
        x: 54,
        y: 54,
        width: 972,
        height: Math.max(340, height - 108),
        fill: template.surface,
        cornerRadius: 36,
        opacity: 0.96
      }),
      ...Array.from({ length: 8 }, (_, index) =>
        createShapeElement({
          metaKey: `decor-line-${index}`,
          x: -120 + index * 165,
          y: 88 + index * 24,
          width: 320,
          height: 2,
          fill: "rgba(0,0,0,0.11)",
          cornerRadius: 999,
          rotation: -20
        })
      )
    ];
  }

  if (template.decoration === "bolts") {
    return [
      createShapeElement({
        metaKey: "decor-bolts-bg",
        x: 0,
        y: 0,
        width: SLIDE_SIZE,
        height,
        fill: template.background,
        cornerRadius: 0
      }),
      createShapeElement({
        metaKey: "decor-bolts-surface",
        x: 54,
        y: 54,
        width: 972,
        height: Math.max(340, height - 108),
        fill: template.surface,
        cornerRadius: 34,
        opacity: 0.95
      }),
      ...Array.from({ length: 4 }, (_, index) => {
        const x = 120 + index * 220;
        const y = 110 + (index % 2 === 0 ? 0 : 180);
        return createShapeElement({
          metaKey: `decor-bolt-a-${index}`,
          x,
          y,
          width: 120,
          height: 10,
          fill: "rgba(255,255,255,0.22)",
          cornerRadius: 999,
          rotation: 62
        });
      }),
      ...Array.from({ length: 4 }, (_, index) => {
        const x = 168 + index * 220;
        const y = 160 + (index % 2 === 0 ? 0 : 180);
        return createShapeElement({
          metaKey: `decor-bolt-b-${index}`,
          x,
          y,
          width: 100,
          height: 10,
          fill: "rgba(255,255,255,0.18)",
          cornerRadius: 999,
          rotation: -62
        });
      })
    ];
  }

  return [
    createShapeElement({
      metaKey: "decor-band-top",
      x: 0,
      y: 0,
      width: SLIDE_SIZE,
      height: Math.min(height * 0.4, 490),
      fill: template.surface,
      cornerRadius: 0
    }),
    createShapeElement({
      metaKey: "decor-band-bottom",
      x: 0,
      y: Math.min(height * 0.4, 490),
      width: SLIDE_SIZE,
      height: height - Math.min(height * 0.4, 490),
      fill: template.background,
      cornerRadius: 0
    }),
    createShapeElement({
      metaKey: "decor-band-sheet",
      x: 56,
      y: 62,
      width: 968,
      height: Math.max(360, height - 124),
      fill: "rgba(255,255,255,0.92)",
      cornerRadius: 34
    })
  ];
}

function createChip(_template: CarouselTemplate, index: number, format: SlideFormat) {
  const y = format === "9:16" ? 86 : 70;
  const x = 74;
  return createShapeElement({
    metaKey: "slide-chip",
    x,
    y,
    width: 168,
    height: 44,
    fill: "rgba(246, 255, 253, 0.92)",
    cornerRadius: 16,
    opacity: 1,
    stroke: "rgba(93, 176, 164, 0.44)",
    strokeWidth: 1
  });
}

function createChipText(_template: CarouselTemplate, index: number, format: SlideFormat) {
  const y = format === "9:16" ? 99 : 84;
  return createTextElement({
    metaKey: "slide-chip-text",
    role: "caption",
    text: `SLIDE ${index + 1}`,
    x: 95,
    y,
    width: 130,
    height: 24,
    fontSize: 15,
    fill: "#2f6f66",
    fontFamily: "Inter",
    fontStyle: "bold",
    letterSpacing: 1.2
  });
}

function createImageTopFrame(
  template: CarouselTemplate,
  format: SlideFormat,
  imageSrc: string,
  mode: "top" | "bottom" = "top"
): CanvasElement[] {
  const { height } = SLIDE_FORMAT_DIMENSIONS[format];
  const layout = mode === "bottom" ? getImageBottomLayout(format) : getImageTopLayout(format);

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
      metaKey: "image-top-card",
      x: layout.cardX,
      y: layout.cardY,
      width: layout.cardWidth,
      height: layout.cardHeight,
      fill: template.surface,
      cornerRadius: 36,
      opacity: 0.99
    }),
    createShapeElement({
      metaKey: "image-top-frame",
      x: layout.imageX - 2,
      y: layout.imageY - 2,
      width: layout.imageWidth + 4,
      height: layout.imageHeight + 4,
      fill: "rgba(255,255,255,0.82)",
      cornerRadius: 24,
      opacity: 0.92
    }),
    createImageElement(imageSrc, {
      metaKey: "internet-image-top",
      x: layout.imageX,
      y: layout.imageY,
      width: layout.imageWidth,
      height: layout.imageHeight,
      cornerRadius: 22
    }),
    createShapeElement({
      metaKey: "image-top-text-panel",
      x: layout.cardX + 18,
      y: layout.textPanelY,
      width: layout.cardWidth - 36,
      height: layout.textPanelHeight,
      fill: template.surface,
      cornerRadius: 28,
      opacity: 0.99
    }),
    createShapeElement({
      metaKey: "image-top-divider",
      x: layout.textX,
      y: layout.textPanelY + 20,
      width: 132,
      height: 4,
      fill: template.accent,
      cornerRadius: 999,
      opacity: 0.56
    })
  ];
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
    candidateText = words.slice(0, keepCount).join(" ").concat("...");
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
  const x = clampValue(Math.round((SLIDE_SIZE - width) / 2), 68, 170);
  const titleY = clampValue(
    template.titleOffsetY + layout.titleYBoost,
    78,
    Math.round(canvasHeight * 0.62)
  );
  const minBodyZone = format === "9:16" ? 330 : format === "4:5" ? 252 : 214;
  const footerReserve = layout.footerBottom + 84;
  const maxHeightByCanvas = canvasHeight - titleY - minBodyZone - footerReserve;
  const baseSize = Math.round((format === "9:16" ? 62 : 70) * layout.titleFactor);
  const maxHeight = clampValue(
    Math.max(118, maxHeightByCanvas),
    118,
    Math.round(canvasHeight * (format === "9:16" ? 0.31 : 0.34))
  );
  const fitted = fitTextBlock({
    text,
    width,
    initialFontSize: baseSize,
    minFontSize: format === "9:16" ? 18 : 20,
    maxHeight,
    lineHeight: 1.03,
    minLineHeight: 0.92
  });

  return createTextElement({
    metaKey: "managed-title",
    role: "title",
    text,
    x,
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
  const width = template.bodyWidth ?? 804;
  const x = clampValue(Math.round((SLIDE_SIZE - width) / 2), 72, 192);
  const preferredBodyY = Math.max(startY + 18, template.bodyOffsetY + layout.bodyYBoost);
  const footerReserve = layout.footerBottom + 74;
  const minBodyHeight = format === "9:16" ? 242 : format === "4:5" ? 196 : 166;
  const maxBodyY = Math.max(0, canvasHeight - footerReserve - minBodyHeight);
  const preferredMinBodyY =
    format === "9:16"
      ? Math.round(canvasHeight * 0.46)
      : format === "4:5"
        ? Math.round(canvasHeight * 0.43)
        : Math.round(canvasHeight * 0.4);
  const minBodyY = clampValue(preferredMinBodyY, 0, maxBodyY);
  const bodyY = clampValue(preferredBodyY, minBodyY, maxBodyY);
  const baseSize = Math.round((format === "9:16" ? 29 : 34) * layout.bodyFactor);
  const availableHeight = canvasHeight - bodyY - footerReserve;
  const maxHeight = Math.max(minBodyHeight, availableHeight);
  const fitted = fitTextBlock({
    text,
    width,
    initialFontSize: baseSize,
    minFontSize: format === "9:16" ? 12 : 13,
    maxHeight,
    lineHeight: 1.16,
    minLineHeight: 1
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
      lineHeight: Math.max(0.96, fallbackFitted.lineHeight),
      minLineHeight: 0.92
    },
    fallbackFitted
  );

  return createTextElement({
    metaKey: "managed-body",
    role: "body",
    wasAutoTruncated: overflowGuard.text !== text,
    text: overflowGuard.text,
    x,
    y: bodyY,
    width,
    height: overflowGuard.fitted.height,
    fontSize: overflowGuard.fitted.fontSize,
    fill: template.bodyColor,
    fontFamily: template.bodyFont,
    lineHeight: overflowGuard.fitted.lineHeight
  });
}

function createManagedTitleForImageTop(
  template: CarouselTemplate,
  text: string,
  format: SlideFormat,
  mode: "top" | "bottom" = "top"
): TextElement {
  const layout = mode === "bottom" ? getImageBottomLayout(format) : getImageTopLayout(format);
  const maxHeight =
    mode === "bottom"
      ? format === "9:16"
        ? 240
        : 210
      : format === "9:16"
        ? 196
        : 178;
  const fitted = fitTextBlock({
    text,
    width: layout.textWidth,
    initialFontSize: format === "9:16" ? 50 : format === "4:5" ? 54 : 58,
    minFontSize: format === "9:16" ? 16 : 18,
    maxHeight,
    lineHeight: 1.04,
    minLineHeight: 0.94
  });
  return createTextElement({
    metaKey: "managed-title",
    role: "title",
    text,
    x: layout.textX,
    y: layout.titleY,
    width: layout.textWidth,
    height: fitted.height,
    fontSize: fitted.fontSize,
    fill: template.titleColor,
    fontFamily: template.titleFont,
    fontStyle: "bold",
    lineHeight: fitted.lineHeight
  });
}

function createManagedBodyForImageTop(
  template: CarouselTemplate,
  text: string,
  format: SlideFormat,
  startY: number,
  mode: "top" | "bottom" = "top"
): TextElement {
  const layout = mode === "bottom" ? getImageBottomLayout(format) : getImageTopLayout(format);
  const bodyY = Math.max(layout.titleY + (mode === "bottom" ? 62 : 76), startY);
  const baseSize = format === "9:16" ? 23 : 27;
  const maxHeight = Math.max(mode === "bottom" ? 122 : 140, layout.textBottom - bodyY);
  const fitted = fitTextBlock({
    text,
    width: layout.textWidth,
    initialFontSize: baseSize,
    minFontSize: format === "9:16" ? 12 : 13,
    maxHeight,
    lineHeight: 1.14,
    minLineHeight: 0.94
  });
  const overflowGuard = applyTextOverflowGuard(
    text,
    {
      width: layout.textWidth,
      initialFontSize: Math.max(11, fitted.fontSize),
      minFontSize: 10,
      maxHeight,
      lineHeight: Math.max(0.96, fitted.lineHeight),
      minLineHeight: 0.92
    },
    fitted
  );

  return createTextElement({
    metaKey: "managed-body",
    role: "body",
    wasAutoTruncated: overflowGuard.text !== text,
    text: overflowGuard.text,
    x: layout.textX,
    y: bodyY,
    width: layout.textWidth,
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
  const footerColor = template.category === "dark" ? "#e9edf4" : "#252a33";
  const footerMuted = template.category === "dark" ? "#b5bdc9" : "#666f7c";
  const footerX = 80;
  const isTall = format === "9:16";
  const handleSize = isTall ? 22 : 19;
  const subtitleSize = isTall ? 17 : 15;
  const topSize = isTall ? 19 : 17;
  const arrowSize = isTall ? 34 : 30;
  const elements: CanvasElement[] = [];

  if (footerVariant === "v1") {
    elements.push(
      createTextElement({
        metaKey: "profile-handle",
        role: "caption",
        text: handle,
        x: footerX,
        y: height - footerBottom,
        width: 360,
        height: 30,
        fontSize: handleSize,
        fill: footerColor,
        fontFamily: "Inter",
        fontStyle: "bold"
      }),
      createTextElement({
        metaKey: "profile-subtitle",
        role: "caption",
        text: subtitle,
        x: footerX,
        y: height - (footerBottom - 24),
        width: 330,
        height: 24,
        fontSize: subtitleSize,
        fill: footerMuted,
        fontFamily: "Inter"
      })
    );
  }

  if (footerVariant === "v2") {
    elements.push(
      createTextElement({
        metaKey: "profile-handle",
        role: "caption",
        text: handle,
        x: footerX,
        y: 72,
        width: 320,
        height: 24,
        fontSize: topSize,
        fill: footerColor,
        fontFamily: "Inter",
        fontStyle: "bold"
      }),
      createTextElement({
        metaKey: "footer-counter",
        role: "caption",
        text: `[${index + 1}/${totalSlides}]`,
        x: 904,
        y: 72,
        width: 96,
        height: 24,
        fontSize: topSize,
        fill: footerMuted,
        fontFamily: "Inter",
        align: "right"
      }),
      createTextElement({
        metaKey: "profile-subtitle",
        role: "caption",
        text: subtitle,
        x: footerX,
        y: height - footerBottom,
        width: 330,
        height: 24,
        fontSize: subtitleSize,
        fill: footerMuted,
        fontFamily: "Inter"
      })
    );
  }

  if (footerVariant === "v3") {
    elements.push(
      createShapeElement({
        metaKey: "profile-dot",
        x: footerX,
        y: height - (footerBottom + 2),
        width: 24,
        height: 24,
        shape: "circle",
        fill: accent,
        cornerRadius: 999
      }),
      createTextElement({
        metaKey: "profile-handle",
        role: "caption",
        text: handle,
        x: footerX + 36,
        y: height - (footerBottom + 1),
        width: 320,
        height: 24,
        fontSize: handleSize,
        fill: footerColor,
        fontFamily: "Inter",
        fontStyle: "bold"
      }),
      createTextElement({
        metaKey: "profile-subtitle",
        role: "caption",
        text: subtitle,
        x: footerX + 36,
        y: height - (footerBottom - 22),
        width: 330,
        height: 22,
        fontSize: subtitleSize,
        fill: footerMuted,
        fontFamily: "Inter"
      })
    );
  }

  if (footerVariant === "v4") {
    elements.push(
      createTextElement({
        metaKey: "profile-handle",
        role: "caption",
        text: handle,
        x: 214,
        y: 72,
        width: 652,
        height: 24,
        fontSize: topSize,
        fill: footerColor,
        fontFamily: "Inter",
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
      x: 924,
      y: height - (footerBottom + 10),
      width: 54,
      height: 44,
      fontSize: arrowSize,
      fill: template.category === "dark" ? accent : "#171717",
      fontFamily: "Inter",
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

function extractManagedTextStyle(
  slide: Slide,
  target: "title" | "body"
): ManagedTextStyle | null {
  const byMeta = slide.elements.find(
    (element): element is TextElement =>
      element.type === "text" &&
      element.metaKey === (target === "title" ? "managed-title" : "managed-body")
  );

  const byRole = slide.elements.find(
    (element): element is TextElement =>
      element.type === "text" && element.role === (target === "title" ? "title" : "body")
  );

  const source = byMeta ?? byRole;
  if (!source) {
    return null;
  }

  return {
    fontSize: source.fontSize,
    fontFamily: source.fontFamily,
    fontStyle: source.fontStyle,
    fill: source.fill,
    align: source.align,
    lineHeight: source.lineHeight,
    letterSpacing: source.letterSpacing,
    textDecoration: source.textDecoration
  };
}

function applyManagedTextStyles(
  managedElements: CanvasElement[],
  styles: {
    title: ManagedTextStyle | null;
    body: ManagedTextStyle | null;
  }
) {
  return managedElements.map((element) => {
    if (element.type !== "text") {
      return element;
    }

    const style = element.metaKey === "managed-title"
      ? styles.title
      : element.metaKey === "managed-body"
        ? styles.body
        : null;

    if (!style) {
      return element;
    }

    return {
      ...element,
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
      fontStyle: style.fontStyle,
      fill: style.fill,
      align: style.align,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      textDecoration: style.textDecoration
    };
  });
}

function extractBackgroundImageStyle(slide: Slide): BackgroundImageStyle {
  const backgroundImage = slide.elements.find(
    (element): element is ImageElement =>
      element.type === "image" &&
      (element.metaKey === "background-image" || element.metaKey === "internet-image-top")
  );

  return {
    fitMode: slide.backgroundImageFitMode ?? backgroundImage?.fitMode ?? "cover",
    zoom: slide.backgroundImageZoom ?? backgroundImage?.zoom ?? 1,
    offsetX: slide.backgroundImageOffsetX ?? backgroundImage?.offsetX ?? 0,
    offsetY: slide.backgroundImageOffsetY ?? backgroundImage?.offsetY ?? 0,
    darken: slide.backgroundImageDarken ?? backgroundImage?.darken ?? 0
  };
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
  const imageBlockMode =
    slide.backgroundImage && (slide.imageLayoutMode === "top" || slide.imageLayoutMode === "bottom")
      ? slide.imageLayoutMode
      : null;
  const backgroundImageStyle = extractBackgroundImageStyle(slide);

  if (imageBlockMode && slide.backgroundImage) {
    managed.push(
      ...createImageTopFrame(template, format, slide.backgroundImage, imageBlockMode).map((element) =>
        element.type === "image" && element.metaKey === "internet-image-top"
          ? {
              ...element,
              fitMode: backgroundImageStyle.fitMode ?? "cover",
              zoom: backgroundImageStyle.zoom ?? 1,
              offsetX: backgroundImageStyle.offsetX ?? 0,
              offsetY: backgroundImageStyle.offsetY ?? 0,
              darken: backgroundImageStyle.darken ?? 0
            }
          : element
      )
    );
  } else {
    managed.push(...createDecoration(template, format));

    if (slide.backgroundImage) {
      managed.push(
        createBackgroundImageElement(slide.backgroundImage, format, backgroundImageStyle)
      );
    }
  }

  const imageMode = imageBlockMode ?? "top";
  const managedTitle = imageBlockMode
    ? createManagedTitleForImageTop(template, titleText, format, imageMode)
    : createManagedTitle(template, titleText, format);
  const bodyStart = managedTitle.y + managedTitle.height + (imageBlockMode ? 24 : 28);
  const managedBody = imageBlockMode
    ? createManagedBodyForImageTop(template, bodyText, format, bodyStart, imageMode)
    : createManagedBody(template, bodyText, format, bodyStart);

  managed.push(
    createChip(template, index, format),
    createChipText(template, index, format),
    managedTitle,
    managedBody
  );
  managed.push(...createFooterElements(slide, template, index, totalSlides, format));

  if (!slide.frameColor) {
    return managed;
  }

  return managed.map((element) => {
    if (
      element.type === "shape" &&
      element.metaKey &&
      /decor-(surface|card|sheet|grid-surface|dots-surface|lines-surface|bolts-surface|paper-top|band-sheet|card-surface|overlay|frame|text-panel)/.test(
        element.metaKey
      )
    ) {
      return {
        ...element,
        fill: slide.frameColor as string
      };
    }

    return element;
  });
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
  customElements: CanvasElement[],
  options?: {
    preserveTextStyles?: boolean;
  }
): Slide {
  const content = extractManagedContent(slide);
  const managedStyles = {
    title: options?.preserveTextStyles === false ? null : extractManagedTextStyle(slide, "title"),
    body: options?.preserveTextStyles === false ? null : extractManagedTextStyle(slide, "body")
  };
  const backgroundImageStyle = extractBackgroundImageStyle(slide);
  const existingBackgroundImage = slide.elements.find(
    (element): element is ImageElement =>
      element.type === "image" &&
      (element.metaKey === "background-image" || element.metaKey === "internet-image-top")
  )?.src;
  const resolvedBackgroundImage =
    slide.backgroundImage !== undefined ? slide.backgroundImage : existingBackgroundImage ?? null;
  const imageModeFromElements = (() => {
    const imageElement = slide.elements.find(
      (element): element is ImageElement =>
        element.type === "image" && element.metaKey === "internet-image-top"
    );
    if (!imageElement) {
      return undefined;
    }
    const { height } = SLIDE_FORMAT_DIMENSIONS[format];
    return imageElement.y > height * 0.5 ? "bottom" : "top";
  })();
  const resolvedImageLayoutMode = resolvedBackgroundImage
    ? slide.imageLayoutMode ??
      (imageModeFromElements ?? "background")
    : undefined;

  return {
    ...slide,
    name: content.title,
    background: getTemplate(templateId).background,
    templateId,
    footerVariant: slide.footerVariant ?? DEFAULT_FOOTER_VARIANT,
    profileHandle: content.handle,
    profileSubtitle: content.subtitle,
    backgroundImage: resolvedBackgroundImage,
    imageLayoutMode: resolvedImageLayoutMode,
    backgroundImageFitMode: backgroundImageStyle.fitMode ?? "cover",
    backgroundImageZoom: backgroundImageStyle.zoom ?? 1,
    backgroundImageOffsetX: backgroundImageStyle.offsetX ?? 0,
    backgroundImageOffsetY: backgroundImageStyle.offsetY ?? 0,
    backgroundImageDarken: backgroundImageStyle.darken ?? 0,
    elements: [
      ...applyManagedTextStyles(
        buildManagedElements(
          {
            ...slide,
            profileHandle: content.handle,
            profileSubtitle: content.subtitle,
            footerVariant: slide.footerVariant ?? DEFAULT_FOOTER_VARIANT,
            backgroundImage: resolvedBackgroundImage,
            imageLayoutMode: resolvedImageLayoutMode
          },
          templateId,
          index,
          totalSlides,
          format,
          content.title,
          content.body
        ),
        managedStyles
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
  const resolvedTemplateId = resolveTemplateId(outline.templateId, templateId);
  const rawTitle = readOutlineTitle(outline);
  const rawBody = readOutlineBody(outline);
  const title = rawTitle || "Новый заголовок";
  const body =
    rawBody ||
    "Добавьте текст, загрузите изображение или поставьте своё фото в фон. В этом блоке стоит раскрыть главную мысль и дать конкретику, чтобы карточка выглядела законченной.";
  const slide: Slide = {
    id: crypto.randomUUID(),
    name: title,
    background: getTemplate(resolvedTemplateId).background,
    templateId: resolvedTemplateId,
    footerVariant: DEFAULT_FOOTER_VARIANT,
    profileHandle: DEFAULT_PROFILE_HANDLE,
    profileSubtitle: DEFAULT_PROFILE_SUBTITLE,
    backgroundImage: null,
    imageLayoutMode: undefined,
    generationRole: outline.role,
    generationCoreIdea: outline.coreIdea,
    layoutType: outline.layoutType,
    imageIntent: outline.imageIntent,
    imageQueryDraft: outline.imageQueryDraft,
    elements: []
  };

  return {
    ...slide,
    elements: buildManagedElements(
      slide,
      resolvedTemplateId,
      index,
      totalSlides,
      format,
      title,
      body
    )
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
      text: readOutlineBody(item),
      role: item.role,
      coreIdea: item.coreIdea,
      layoutType: item.layoutType,
      imageIntent: item.imageIntent,
      imageQueryDraft: item.imageQueryDraft,
      templateId: item.templateId
    }))
    .filter((item) => item.title || item.text)
    .slice(0, targetCount);

  while (safeOutline.length < targetCount) {
    const index = safeOutline.length;
    safeOutline.push({
      title: `Слайд ${index + 1}`,
      text:
        "Добавьте конкретный тезис с примерами, последствиями и практическим действием, чтобы слайд не выглядел пустым.",
      role: undefined,
      coreIdea: undefined,
      layoutType: undefined,
      imageIntent: undefined,
      imageQueryDraft: undefined,
      templateId: undefined
    });
  }

  return safeOutline.map((item, index) => {
    const resolvedTemplateId = resolveTemplateId(item.templateId, templateId);
    return createSlideFromOutline(item, index, resolvedTemplateId, format, safeOutline.length);
  });
}

export function createStarterSlides(
  templateId: CarouselTemplateId = "technology",
  format: SlideFormat = "1:1"
): Slide[] {
  type StarterOutlineItem = CarouselOutlineSlide & {
    titleFont?: string;
    bodyFont?: string;
    includeDemoImage?: boolean;
  };

  const starterHandle = "@ai-carousel-editor";
  const starterSubtitle = "AI carousel workflow";
  const onboardingImage = getStarterOnboardingImage();
  const onboarding: StarterOutlineItem[] = [
    {
      templateId: "minimal",
      titleFont: "Manrope",
      bodyFont: "Inter",
      title: "AI Carousel Editor",
      text: "Соберите карусель за несколько минут: идея, генерация, правки и экспорт в одном редакторе."
    },
    {
      templateId: "atlas",
      titleFont: "Oswald",
      bodyFont: "DM Sans",
      title: "1. Введите тему и создайте карусель",
      text: "Напишите тему или вставьте набросок. AI соберёт структуру слайдов и сразу даст рабочий черновик под публикацию."
    },
    {
      templateId: "technology",
      titleFont: "Space Grotesk",
      bodyFont: "Inter",
      title: "2. Редактируйте текст как в привычном editor-flow",
      text: "Тап по блоку выбирает элемент, двойной тап включает редактирование. Заголовок и описание правятся прямо на canvas."
    },
    {
      titleFont: "El Messiri",
      bodyFont: "Roboto Condensed",
      templateId: "premium",
      title: "3. Управляйте шрифтами и ритмом",
      text: "Выберите пару «заголовок + описание» для всей серии или меняйте отдельные блоки. Стиль обновляется сразу."
    },
    {
      templateId: "aurora",
      titleFont: "Space Grotesk",
      bodyFont: "Inter",
      title: "4. Настраивайте фон и характер подачи",
      text: "Светлая, тёмная или акцентная карточка — переключайте шаблоны, фон и рамку без пересборки контента."
    },
    {
      templateId: "founder-dark",
      titleFont: "Manrope",
      bodyFont: "Inter",
      includeDemoImage: true,
      title: "5. Добавляйте изображения без хаоса",
      text: "Фото встраиваются в композицию с safe-зонами: текст остаётся читаемым, а карточка выглядит аккуратной."
    },
    {
      templateId: "netflix",
      titleFont: "Fira Code",
      bodyFont: "Inter",
      title: "6. Экспортируйте в нужном формате",
      text: "Когда всё готово — скачайте ZIP, PNG, JPG или PDF. Эта инструкция — демо, удалите её и создайте свою серию."
    }
  ];

  const starterSlides = createSlidesFromOutline(
    onboarding.map(({ titleFont: _titleFont, bodyFont: _bodyFont, includeDemoImage: _includeDemoImage, ...item }) => item),
    templateId,
    format,
    onboarding.length
  );

  const withDemoImage = starterSlides.map((slide, index) => {
    if (!onboarding[index]?.includeDemoImage) {
      return slide;
    }

    const withImage = setSlideBackgroundImage(
      slide,
      onboardingImage,
      index,
      starterSlides.length,
      format,
      "top"
    );

    return setSlideBackgroundImageStyle(
      withImage,
      {
        fitMode: "cover",
        zoom: 1.06,
        darken: 0.06
      },
      index,
      starterSlides.length,
      format
    );
  });

  return withDemoImage.map((slide, index) =>
    applyStarterSlidePolish(
      slide,
      onboarding[index]?.titleFont,
      onboarding[index]?.bodyFont,
      starterHandle,
      starterSubtitle
    )
  );
}

function applyStarterSlidePolish(
  slide: Slide,
  titleFont: string | undefined,
  bodyFont: string | undefined,
  handle: string,
  subtitle: string
) {
  return {
    ...slide,
    profileHandle: handle,
    profileSubtitle: subtitle,
    elements: slide.elements.map((element) => {
      if (element.type !== "text") {
        return element;
      }

      if (element.metaKey === "managed-title" && titleFont) {
        return {
          ...element,
          fontFamily: titleFont
        };
      }

      if (element.metaKey === "managed-body" && bodyFont) {
        return {
          ...element,
          fontFamily: bodyFont
        };
      }

      if (element.metaKey === "profile-handle") {
        return {
          ...element,
          text: handle
        };
      }

      if (element.metaKey === "profile-subtitle") {
        return {
          ...element,
          text: subtitle
        };
      }

      return element;
    })
  };
}

let starterOnboardingImageCache: string | null = null;

function getStarterOnboardingImage() {
  if (starterOnboardingImageCache) {
    return starterOnboardingImageCache;
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 900">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#0f2f38"/>
          <stop offset="55%" stop-color="#1f5e62"/>
          <stop offset="100%" stop-color="#7fd7ce"/>
        </linearGradient>
        <radialGradient id="glow" cx="68%" cy="22%" r="60%">
          <stop offset="0%" stop-color="#dcfff8" stop-opacity="0.78"/>
          <stop offset="100%" stop-color="#dcfff8" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1400" height="900" fill="url(#bg)"/>
      <rect width="1400" height="900" fill="url(#glow)"/>
      <g opacity="0.18" fill="#ffffff">
        <circle cx="230" cy="170" r="112"/>
        <circle cx="1180" cy="98" r="84"/>
        <circle cx="1260" cy="760" r="154"/>
      </g>
      <g fill="#ffffff" fill-opacity="0.9">
        <rect x="132" y="650" width="590" height="16" rx="8"/>
        <rect x="132" y="684" width="490" height="14" rx="7"/>
      </g>
      <text x="132" y="578" fill="#ffffff" font-size="92" font-family="Inter, Arial, sans-serif" font-weight="700">Visual Workflow</text>
    </svg>
  `.trim();

  starterOnboardingImageCache = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return starterOnboardingImageCache;
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
      customElements,
      {
        preserveTextStyles: false
      }
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
  format: SlideFormat,
  layoutMode: Slide["imageLayoutMode"] = "background"
) {
  const backgroundStyle = extractBackgroundImageStyle(slide);
  const customElements = slide.elements.filter((element) => !isManagedElement(element));
  return rebuildSlide(
    {
      ...slide,
      backgroundImage: src,
      imageLayoutMode: src ? layoutMode : undefined,
      backgroundImageFitMode: src ? backgroundStyle.fitMode ?? "cover" : undefined,
      backgroundImageZoom: src ? backgroundStyle.zoom ?? 1 : undefined,
      backgroundImageOffsetX: src ? backgroundStyle.offsetX ?? 0 : undefined,
      backgroundImageOffsetY: src ? backgroundStyle.offsetY ?? 0 : undefined,
      backgroundImageDarken: src ? backgroundStyle.darken ?? 0 : 0
    },
    index,
    totalSlides,
    slide.templateId ?? "technology",
    format,
    customElements
  );
}

export function setSlideBackgroundImageStyle(
  slide: Slide,
  updates: Partial<Pick<ImageElement, "fitMode" | "zoom" | "offsetX" | "offsetY" | "darken">>,
  index: number,
  totalSlides: number,
  format: SlideFormat
) {
  if (!slide.backgroundImage) {
    return slide;
  }

  const backgroundStyle = extractBackgroundImageStyle(slide);
  const nextStyle = {
    fitMode: updates.fitMode ?? backgroundStyle.fitMode ?? "cover",
    zoom: updates.zoom ?? backgroundStyle.zoom ?? 1,
    offsetX: updates.offsetX ?? backgroundStyle.offsetX ?? 0,
    offsetY: updates.offsetY ?? backgroundStyle.offsetY ?? 0,
    darken: updates.darken ?? backgroundStyle.darken ?? 0
  };

  const customElements = slide.elements.filter((element) => !isManagedElement(element));

  return rebuildSlide(
    {
      ...slide,
      backgroundImageFitMode: nextStyle.fitMode,
      backgroundImageZoom: nextStyle.zoom,
      backgroundImageOffsetX: nextStyle.offsetX,
      backgroundImageOffsetY: nextStyle.offsetY,
      backgroundImageDarken: nextStyle.darken
    },
    index,
    totalSlides,
    slide.templateId ?? "technology",
    format,
    customElements
  );
}

export function setSlideFrameColor(
  slide: Slide,
  color: string | null,
  index: number,
  totalSlides: number,
  format: SlideFormat
) {
  const customElements = slide.elements.filter((element) => !isManagedElement(element));
  return rebuildSlide(
    {
      ...slide,
      frameColor: color ?? undefined
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
