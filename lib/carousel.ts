import type {
  CanvasElement,
  CarouselLayoutType,
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

export type StylePresetId = "minimal" | "contrast" | "insta" | "dark";

export const STYLE_PRESETS: Array<{ id: StylePresetId; label: string; hint: string }> = [
  { id: "minimal", label: "Минимал", hint: "Чистые светлые карточки" },
  { id: "contrast", label: "Контраст", hint: "Светлые + тёмные акценты" },
  { id: "insta", label: "Инста стиль", hint: "Яркая creator-подача" },
  { id: "dark", label: "Тёмный", hint: "Премиум dark-серия" }
];

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
    titleOffsetY: 312,
    bodyOffsetY: 626,
    titleWidth: 840,
    bodyWidth: 782,
    bodyHeight: 242,
    chipStyle: "outline",
    decoration: "none",
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
    titleOffsetY: 248,
    bodyOffsetY: 496,
    titleWidth: 860,
    bodyWidth: 810,
    bodyHeight: 238,
    chipStyle: "outline",
    decoration: "none",
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
    bodyWidth: 804,
    bodyHeight: 252,
    chipStyle: "outline",
    decoration: "grid",
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
    darken: overrides.darken ?? 0,
    stroke: overrides.stroke ?? "#ffffff",
    strokeWidth: overrides.strokeWidth ?? 0
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

type SlideCompositionLayout =
  | "hero"
  | "statement"
  | "list"
  | "split"
  | "card"
  | "dark-slide"
  | "cta"
  | "image-top";

function resolveCompositionLayout(layoutType?: CarouselLayoutType): SlideCompositionLayout {
  if (layoutType === "image-top") {
    return "image-top";
  }

  if (layoutType === "hero" || layoutType === "cover-hero") {
    return "hero";
  }

  if (layoutType === "statement") {
    return "statement";
  }

  if (
    layoutType === "list" ||
    layoutType === "bullets" ||
    layoutType === "steps" ||
    layoutType === "checklist"
  ) {
    return "list";
  }

  if (layoutType === "split" || layoutType === "case-split" || layoutType === "comparison") {
    return "split";
  }

  if (layoutType === "dark-slide") {
    return "dark-slide";
  }

  if (layoutType === "cta") {
    return "cta";
  }

  return "card";
}

function composeManagedTextLayout(options: {
  layoutType?: CarouselLayoutType;
  template: CarouselTemplate;
  format: SlideFormat;
  title: TextElement;
  body: TextElement;
}): CanvasElement[] {
  const composition = resolveCompositionLayout(options.layoutType);
  if (composition === "image-top") {
    return [options.title, options.body];
  }

  const { template, format } = options;
  const { height } = SLIDE_FORMAT_DIMENSIONS[format];
  const title: TextElement = { ...options.title };
  const body: TextElement = { ...options.body };
  const extras: CanvasElement[] = [];

  if (composition === "hero") {
    title.align = "center";
    title.width = clampValue(Math.round(title.width * 0.88), 620, 910);
    title.x = Math.round((SLIDE_SIZE - title.width) / 2);
    title.y = clampValue(Math.round(height * 0.2), 150, Math.round(height * 0.38));
    title.fontSize = clampValue(Math.round(title.fontSize * 1.14), 62, 156);
    body.align = "center";
    body.width = clampValue(Math.round(title.width * 0.88), 520, 820);
    body.x = Math.round((SLIDE_SIZE - body.width) / 2);
    body.y = title.y + title.height + 34;
    body.fontSize = clampValue(Math.round(body.fontSize * 0.84), 20, 54);
    body.lineHeight = Math.max(1.05, body.lineHeight ?? 1.1);

    extras.push(
      createShapeElement({
        metaKey: "layout-hero-line",
        x: Math.round((SLIDE_SIZE - 176) / 2),
        y: title.y - 36,
        width: 176,
        height: 6,
        fill: template.accent,
        cornerRadius: 999,
        opacity: 0.72
      })
    );
  } else if (composition === "statement") {
    title.width = clampValue(Math.round(title.width * 0.8), 560, 840);
    title.x = clampValue(120, 88, SLIDE_SIZE - title.width - 88);
    title.y = clampValue(Math.round(height * 0.32), 220, Math.round(height * 0.48));
    title.fontSize = clampValue(Math.round(title.fontSize * 1.3), 72, 176);
    title.lineHeight = 0.98;
    body.width = clampValue(Math.round(title.width * 0.92), 500, 790);
    body.x = title.x;
    body.y = title.y + title.height + 26;
    body.fontSize = clampValue(Math.round(body.fontSize * 0.78), 18, 44);
    body.lineHeight = 1.05;
  } else if (composition === "list") {
    title.width = clampValue(Math.round(title.width * 0.88), 620, 900);
    title.x = Math.round((SLIDE_SIZE - title.width) / 2);
    title.y = clampValue(title.y - 20, 180, Math.round(height * 0.42));
    body.width = clampValue(Math.round(title.width * 0.88), 560, 820);
    body.x = Math.round((SLIDE_SIZE - body.width) / 2);
    body.y = title.y + title.height + 30;
    body.fontSize = clampValue(Math.round(body.fontSize * 0.92), 18, 42);
    body.lineHeight = Math.max(1.2, body.lineHeight ?? 1.14);
  } else if (composition === "split") {
    const textWidth = format === "9:16" ? 656 : 708;

    title.x = 104;
    title.y = clampValue(title.y - 26, 176, Math.round(height * 0.42));
    title.width = clampValue(textWidth, 460, 620);
    title.fontSize = clampValue(Math.round(title.fontSize * 0.95), 34, 102);
    body.x = title.x;
    body.y = title.y + title.height + 28;
    body.width = title.width;
    body.fontSize = clampValue(Math.round(body.fontSize * 0.9), 18, 40);

    extras.push(
      createShapeElement({
        metaKey: "layout-split-accent",
        x: 88,
        y: title.y - 18,
        width: 6,
        height: body.y + body.height - (title.y - 18),
        fill: template.accent,
        cornerRadius: 12,
        opacity: 0.42
      })
    );
  } else if (composition === "dark-slide") {
    title.align = "center";
    title.width = clampValue(Math.round(title.width * 0.84), 560, 860);
    title.x = Math.round((SLIDE_SIZE - title.width) / 2);
    title.y = clampValue(Math.round(height * 0.28), 188, Math.round(height * 0.46));
    title.fill = "#f5f9ff";
    title.fontSize = clampValue(Math.round(title.fontSize * 1.08), 40, 128);
    body.align = "center";
    body.width = clampValue(Math.round(title.width * 0.9), 540, 790);
    body.x = Math.round((SLIDE_SIZE - body.width) / 2);
    body.y = title.y + title.height + 28;
    body.fill = "#d6e2f0";
    body.fontSize = clampValue(Math.round(body.fontSize * 0.88), 18, 40);
  } else if (composition === "cta") {
    title.align = "center";
    title.width = clampValue(Math.round(title.width * 0.82), 540, 820);
    title.x = Math.round((SLIDE_SIZE - title.width) / 2);
    title.y = clampValue(Math.round(height * 0.34), 210, Math.round(height * 0.52));
    title.fontSize = clampValue(Math.round(title.fontSize * 1.04), 40, 120);
    body.align = "center";
    body.width = clampValue(Math.round(title.width * 0.9), 500, 760);
    body.x = Math.round((SLIDE_SIZE - body.width) / 2);
    body.y = title.y + title.height + 24;
    body.fontSize = clampValue(Math.round(body.fontSize * 0.86), 18, 38);
  } else {
    title.width = clampValue(Math.round(title.width * 0.9), 600, 870);
    title.x = Math.round((SLIDE_SIZE - title.width) / 2);
    body.width = clampValue(Math.round(title.width * 0.9), 560, 790);
    body.x = Math.round((SLIDE_SIZE - body.width) / 2);
    body.y = title.y + title.height + 30;
  }

  const cappedBodyHeight = Math.max(42, height - body.y - (format === "9:16" ? 180 : 140));
  body.height = clampValue(body.height, 42, cappedBodyHeight);

  return [...extras, title, body];
}

function createDecoration(template: CarouselTemplate, format: SlideFormat): CanvasElement[] {
  const { height } = SLIDE_FORMAT_DIMENSIONS[format];
  const base: CanvasElement[] = [
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
      height: Math.max(340, height - 104),
      fill: template.surface,
      cornerRadius: 34,
      opacity: template.decoration === "none" ? 1 : 0.98
    })
  ];

  if (template.decoration === "none") {
    return base;
  }

  if (template.decoration === "grid") {
    return [
      ...base,
      ...Array.from({ length: 4 }, (_, index) =>
        createShapeElement({
          metaKey: `decor-grid-v-${index}`,
          x: 232 + index * 184,
          y: 72,
          width: 1,
          height: height - 144,
          fill: "rgba(0,0,0,0.045)",
          cornerRadius: 0
        })
      )
    ];
  }

  if (template.decoration === "dots") {
    return [
      ...base,
      ...Array.from({ length: 14 }, (_, index) =>
        createShapeElement({
          metaKey: `decor-dot-${index}`,
          x: 760 + (index % 7) * 28,
          y: 120 + Math.floor(index / 7) * 28,
          width: 5,
          height: 5,
          shape: "circle",
          fill: "rgba(0,0,0,0.085)",
          cornerRadius: 999,
          opacity: 0.8
        })
      )
    ];
  }

  if (template.decoration === "lines") {
    return [
      ...base,
      createShapeElement({
        metaKey: "decor-line-top",
        x: 86,
        y: 118,
        width: 280,
        height: 2,
        fill: "rgba(0,0,0,0.1)",
        cornerRadius: 999
      }),
      createShapeElement({
        metaKey: "decor-line-bottom",
        x: 86,
        y: height - 134,
        width: 220,
        height: 2,
        fill: "rgba(0,0,0,0.08)",
        cornerRadius: 999
      })
    ];
  }

  if (template.decoration === "glow") {
    return [
      ...base,
      createShapeElement({
        metaKey: "decor-glow",
        x: 762,
        y: 96,
        width: 208,
        height: 208,
        shape: "circle",
        fill: "rgba(255,255,255,0.12)",
        cornerRadius: 999,
        opacity: 0.62
      })
    ];
  }

  if (template.decoration === "paper") {
    return [
      ...base,
      createShapeElement({
        metaKey: "decor-paper-strip",
        x: 86,
        y: 110,
        width: 300,
        height: 26,
        fill: "rgba(255,255,255,0.42)",
        cornerRadius: 14,
        opacity: 0.74
      })
    ];
  }

  if (template.decoration === "bolts") {
    return [
      ...base,
      createShapeElement({
        metaKey: "decor-bolt-a",
        x: 818,
        y: 126,
        width: 120,
        height: 8,
        fill: "rgba(255,255,255,0.2)",
        cornerRadius: 999,
        rotation: -36
      }),
      createShapeElement({
        metaKey: "decor-bolt-b",
        x: 792,
        y: 152,
        width: 104,
        height: 8,
        fill: "rgba(255,255,255,0.16)",
        cornerRadius: 999,
        rotation: 36
      })
    ];
  }

  return base;
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
  const hardMinFontSize = Math.max(9, options.minFontSize - 2);
  const minLineHeight = Math.max(0.86, options.minLineHeight ?? options.lineHeight ?? 1.02);
  let lineHeight = options.lineHeight ?? 1.1;
  const safetyLines = options.text.length > 60 ? 1 : 0.6;
  let fontSize = options.initialFontSize;
  let lines = countWrappedLines(options.text, options.width, fontSize);
  let requiredHeight = Math.ceil((lines + safetyLines) * fontSize * lineHeight + fontSize * 0.4);

  while (fontSize > hardMinFontSize && requiredHeight > options.maxHeight) {
    fontSize -= 2;
    lines = countWrappedLines(options.text, options.width, fontSize);
    requiredHeight = Math.ceil((lines + safetyLines) * fontSize * lineHeight + fontSize * 0.4);
  }

  while (lineHeight > minLineHeight && requiredHeight > options.maxHeight) {
    lineHeight = Math.max(minLineHeight, Number((lineHeight - 0.03).toFixed(2)));
    lines = countWrappedLines(options.text, options.width, fontSize);
    requiredHeight = Math.ceil((lines + safetyLines) * fontSize * lineHeight + fontSize * 0.4);
  }

  // Final hard-fit pass: keep full text and shrink typography instead of truncating content.
  while (requiredHeight > options.maxHeight && fontSize > 9) {
    fontSize = Math.max(9, fontSize - 1);
    if (lineHeight > 0.86) {
      lineHeight = Math.max(0.86, Number((lineHeight - 0.01).toFixed(2)));
    }
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
  // Keep full text. Never trim content with ellipsis at this stage.
  const candidateFit = initialFit.overflow
    ? fitTextBlock({
        ...options,
        text
      })
    : initialFit;

  return {
    text,
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
  const width = template.titleWidth ?? 900;
  const x = clampValue(Math.round((SLIDE_SIZE - width) / 2), 48, 170);
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
  const width = template.bodyWidth ?? 848;
  const x = clampValue(Math.round((SLIDE_SIZE - width) / 2), 54, 192);
  const preferredBodyY = Math.max(startY + 18, template.bodyOffsetY + layout.bodyYBoost);
  const footerReserve = layout.footerBottom + 74;
  const minBodyHeight = format === "9:16" ? 220 : format === "4:5" ? 186 : 156;
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
    minFontSize: format === "9:16" ? 11 : 12,
    maxHeight,
    lineHeight: 1.16,
    minLineHeight: 0.9
  });

  const fallbackFitted =
    fitted.overflow && fitted.fontSize <= (format === "9:16" ? 11 : 12)
      ? fitTextBlock({
          text,
          width,
          initialFontSize: Math.max(10, fitted.fontSize - 1),
          minFontSize: 9,
          maxHeight,
          lineHeight: 1.04,
          minLineHeight: 0.86
        })
      : fitted;
  const overflowGuard = applyTextOverflowGuard(
    text,
    {
      width,
      initialFontSize: Math.max(9, fallbackFitted.fontSize),
      minFontSize: 9,
      maxHeight,
      lineHeight: Math.max(0.9, fallbackFitted.lineHeight),
      minLineHeight: 0.86
    },
    fallbackFitted
  );

  return createTextElement({
    metaKey: "managed-body",
    role: "body",
    wasAutoTruncated: false,
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
    minFontSize: format === "9:16" ? 11 : 12,
    maxHeight,
    lineHeight: 1.14,
    minLineHeight: 0.88
  });
  const overflowGuard = applyTextOverflowGuard(
    text,
    {
      width: layout.textWidth,
      initialFontSize: Math.max(10, fitted.fontSize),
      minFontSize: 9,
      maxHeight,
      lineHeight: Math.max(0.9, fitted.lineHeight),
      minLineHeight: 0.86
    },
    fitted
  );

  return createTextElement({
    metaKey: "managed-body",
    role: "body",
    wasAutoTruncated: false,
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
  const composedManagedText = composeManagedTextLayout({
    layoutType: imageBlockMode ? "image-top" : slide.layoutType,
    template,
    format,
    title: managedTitle,
    body: managedBody
  });

  managed.push(
    createChip(template, index, format),
    createChipText(template, index, format),
    ...composedManagedText
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
  const resolvedLayoutType =
    outline.layoutType ??
    (index === 0 ? "hero" : index === totalSlides - 1 ? "cta" : "card");
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
    layoutType: resolvedLayoutType,
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

const STYLE_PRESET_ROTATIONS: Record<StylePresetId, CarouselTemplateId[]> = {
  minimal: ["minimal", "notes", "technology", "editorial", "business-light"],
  contrast: ["minimal", "netflix", "technology", "premium", "atlas"],
  insta: ["charge", "mandarin", "aurora", "coral", "atlas"],
  dark: ["netflix", "matrix", "premium", "midnight", "founder-dark"]
};

export function applyStylePresetToSlides(
  slides: Slide[],
  presetId: StylePresetId,
  format: SlideFormat
) {
  const rotation = STYLE_PRESET_ROTATIONS[presetId] ?? STYLE_PRESET_ROTATIONS.minimal;

  return slides.map((slide, index) => {
    const isFirst = index === 0;
    const isLast = index === slides.length - 1;
    let templateId = rotation[index % rotation.length];

    if (isFirst && presetId === "contrast") {
      templateId = "netflix";
    } else if (isFirst && presetId === "insta") {
      templateId = "mandarin";
    } else if (isFirst && presetId === "minimal") {
      templateId = "minimal";
    } else if (isFirst && presetId === "dark") {
      templateId = "premium";
    }

    if (isLast) {
      templateId =
        presetId === "dark"
          ? "netflix"
          : presetId === "insta"
            ? "charge"
            : presetId === "contrast"
              ? "atlas"
              : "business-light";
    }

    return applyTemplateToSlide(slide, templateId, index, slides.length, format);
  });
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
  type StarterDemoImageKind = "composer" | "editor" | "export";
  type StarterOutlineItem = CarouselOutlineSlide & {
    titleFont?: string;
    bodyFont?: string;
    demoImageKind?: StarterDemoImageKind;
    demoImageMode?: "top" | "bottom";
    demoImageZoom?: number;
    demoImageDarken?: number;
  };

  const starterHandle = "@ai-carousel-editor";
  const starterSubtitle = "Onboarding demo";
  const onboarding: StarterOutlineItem[] = [
    {
      templateId: "minimal",
      titleFont: "Manrope",
      bodyFont: "Inter",
      layoutType: "hero",
      title: "Соберите карусель, которую хочется публиковать",
      text: "Это не техничка, а живая demo-серия: тема, генерация, правки, стиль и экспорт в одном потоке."
    },
    {
      templateId: "atlas",
      titleFont: "Space Grotesk",
      bodyFont: "DM Sans",
      layoutType: "list",
      title: "1. Начните с темы и задачи",
      text: "• Опишите идею в 1-2 фразах.\n• Выберите количество карточек.\n• Запустите генерацию и получите целостный сценарий."
    },
    {
      templateId: "technology",
      titleFont: "Oswald",
      bodyFont: "Inter",
      layoutType: "image-top",
      demoImageKind: "composer",
      demoImageMode: "top",
      demoImageZoom: 1.04,
      demoImageDarken: 0,
      title: "2. Генерация сразу даёт рабочую структуру",
      text: "Слайды приходят уже с ритмом: хук, раскрытие, польза и финал. Вы не пишете всё с нуля."
    },
    {
      templateId: "editorial",
      titleFont: "El Messiri",
      bodyFont: "Inter",
      layoutType: "split",
      title: "3. Правьте текст прямо на canvas",
      text: "Тап выделяет блок, двойной тап открывает редактирование. Вы видите итоговую композицию без переключений."
    },
    {
      templateId: "premium",
      titleFont: "Fira Code",
      bodyFont: "Inter",
      layoutType: "dark-slide",
      title: "4. Меняйте стиль серии, не теряя смысл",
      text: "Светлые, тёмные и акцентные шаблоны переключаются быстро, а текст и порядок карточек сохраняются."
    },
    {
      templateId: "business-light",
      titleFont: "Manrope",
      bodyFont: "Inter",
      layoutType: "image-top",
      demoImageKind: "editor",
      demoImageMode: "top",
      demoImageZoom: 1.03,
      demoImageDarken: 0.02,
      title: "5. Добавляйте фото без визуального шума",
      text: "Image-top держит баланс: иллюстрация сверху, читабельный текст снизу, аккуратный ритм карточки."
    },
    {
      templateId: "aurora",
      titleFont: "Advent Pro",
      bodyFont: "Inter",
      layoutType: "card",
      title: "6. Подгоните под свой бренд за пару кликов",
      text: "Шрифт, фон, рамка, подпись, бейдж — всё настраивается локально или сразу для всей серии."
    },
    {
      templateId: "founder-dark",
      titleFont: "Russo One",
      bodyFont: "Inter",
      layoutType: "image-top",
      demoImageKind: "export",
      demoImageMode: "top",
      demoImageZoom: 1.02,
      demoImageDarken: 0.05,
      title: "7. Экспортируйте в нужный формат",
      text: "PNG, JPG, PDF или ZIP — выбирайте режим и забирайте серию для публикации без ручной сборки."
    },
    {
      templateId: "netflix",
      titleFont: "Oswald",
      bodyFont: "Inter",
      layoutType: "statement",
      title: "Готовая карусель за один рабочий проход",
      text: "Сначала сценарий, потом polish и экспорт."
    },
    {
      templateId: "mandarin",
      titleFont: "Russo One",
      bodyFont: "Inter",
      layoutType: "cta",
      title: "8. Очистите демо и запустите свою серию",
      text: "Введите тему, сгенерируйте карусель и доведите её до публикации в этом же редакторе."
    }
  ];

  const starterSlides = createSlidesFromOutline(
    onboarding.map(
      ({
        titleFont: _titleFont,
        bodyFont: _bodyFont,
        demoImageKind: _demoImageKind,
        demoImageMode: _demoImageMode,
        demoImageZoom: _demoImageZoom,
        demoImageDarken: _demoImageDarken,
        ...item
      }) => item
    ),
    templateId,
    format,
    onboarding.length
  );

  const withDemoImage = starterSlides.map((slide, index) => {
    const onboardingItem = onboarding[index];
    if (!onboardingItem?.demoImageKind) {
      return slide;
    }

    const imageSource = getStarterOnboardingImage(onboardingItem.demoImageKind);
    const withImage = setSlideBackgroundImage(
      slide,
      imageSource,
      index,
      starterSlides.length,
      format,
      onboardingItem.demoImageMode ?? "top"
    );

    return setSlideBackgroundImageStyle(
      withImage,
      {
        fitMode: "cover",
        zoom: onboardingItem.demoImageZoom ?? 1.02,
        darken: onboardingItem.demoImageDarken ?? 0
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

type StarterDemoImageKind = "composer" | "editor" | "export";

const starterOnboardingImageCache: Partial<Record<StarterDemoImageKind, string>> = {};

function getStarterOnboardingImage(kind: StarterDemoImageKind) {
  if (starterOnboardingImageCache[kind]) {
    return starterOnboardingImageCache[kind] as string;
  }

  const svg = resolveStarterOnboardingSvg(kind).trim();
  const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  starterOnboardingImageCache[kind] = encoded;
  return encoded;
}

function resolveStarterOnboardingSvg(kind: StarterDemoImageKind) {
  if (kind === "editor") {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 900">
        <defs>
          <linearGradient id="editorBg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="#eaf5f3"/>
            <stop offset="100%" stop-color="#dcefeb"/>
          </linearGradient>
          <filter id="shadowEditor" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="26" stdDeviation="18" flood-color="#2e7f77" flood-opacity="0.14"/>
          </filter>
        </defs>
        <rect width="1400" height="900" fill="url(#editorBg)"/>
        <g opacity="0.17" stroke="#91bcb6" stroke-width="18" stroke-linecap="round">
          <path d="M110 124l62-42-62-42"/>
          <path d="M304 124l62-42-62-42"/>
          <path d="M498 124l62-42-62-42"/>
          <path d="M692 124l62-42-62-42"/>
          <path d="M886 124l62-42-62-42"/>
          <path d="M1080 124l62-42-62-42"/>
        </g>
        <g filter="url(#shadowEditor)">
          <rect x="166" y="118" width="1068" height="674" rx="56" fill="#f9fdfc" stroke="#b9d6d1" stroke-width="4"/>
          <rect x="218" y="176" width="964" height="80" rx="30" fill="#ffffff" stroke="#c5ddda" stroke-width="3"/>
          <rect x="250" y="198" width="196" height="38" rx="19" fill="#f06a36"/>
          <text x="280" y="224" fill="#ffffff" font-size="26" font-family="Inter, Arial, sans-serif" font-weight="700">Generate</text>
          <rect x="470" y="198" width="464" height="38" rx="19" fill="#eef5f4"/>
          <text x="500" y="224" fill="#688280" font-size="24" font-family="Inter, Arial, sans-serif">How to launch carousel editor faster</text>
          <rect x="966" y="198" width="184" height="38" rx="19" fill="#ffffff" stroke="#c5ddda" stroke-width="3"/>
          <text x="1016" y="224" fill="#355e63" font-size="24" font-family="Inter, Arial, sans-serif" font-weight="700">7 slides</text>
          <rect x="248" y="296" width="250" height="430" rx="26" fill="#ffffff" stroke="#c7dfdb" stroke-width="3"/>
          <text x="282" y="346" fill="#2d4e52" font-size="28" font-family="Inter, Arial, sans-serif" font-weight="700">Slides</text>
          <rect x="282" y="372" width="182" height="52" rx="18" fill="#e9f7f4" stroke="#b9ddd7" stroke-width="2"/>
          <text x="312" y="405" fill="#2f5f66" font-size="24" font-family="Inter, Arial, sans-serif" font-weight="700">01 cover</text>
          <rect x="282" y="440" width="182" height="52" rx="18" fill="#ffffff" stroke="#d4e5e2" stroke-width="2"/>
          <rect x="282" y="508" width="182" height="52" rx="18" fill="#ffffff" stroke="#d4e5e2" stroke-width="2"/>
          <rect x="540" y="296" width="610" height="430" rx="28" fill="#eff7f5" stroke="#b7d7d2" stroke-width="3"/>
          <rect x="628" y="344" width="434" height="290" rx="24" fill="#ffffff" stroke="#c4dfda" stroke-width="3"/>
          <text x="676" y="414" fill="#223337" font-size="44" font-family="Manrope, Inter, sans-serif" font-weight="800">Build publish-ready</text>
          <text x="676" y="468" fill="#223337" font-size="44" font-family="Manrope, Inter, sans-serif" font-weight="800">carousel in minutes</text>
          <rect x="676" y="516" width="268" height="16" rx="8" fill="#f06a36" fill-opacity="0.82"/>
          <rect x="676" y="546" width="332" height="12" rx="6" fill="#6a7e82" fill-opacity="0.36"/>
        </g>
      </svg>
    `;
  }

  if (kind === "export") {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 900">
        <defs>
          <linearGradient id="exportBg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="#12242d"/>
            <stop offset="62%" stop-color="#1f3a42"/>
            <stop offset="100%" stop-color="#305f66"/>
          </linearGradient>
          <filter id="exportShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="24" stdDeviation="16" flood-color="#09141a" flood-opacity="0.34"/>
          </filter>
        </defs>
        <rect width="1400" height="900" fill="url(#exportBg)"/>
        <g opacity="0.15" fill="#ecfffb">
          <circle cx="170" cy="730" r="120"/>
          <circle cx="1220" cy="130" r="140"/>
          <circle cx="1060" cy="780" r="96"/>
        </g>
        <g filter="url(#exportShadow)">
          <rect x="204" y="132" width="992" height="640" rx="52" fill="#f7fcfb"/>
          <rect x="264" y="198" width="872" height="70" rx="30" fill="#ebf6f4"/>
          <text x="314" y="243" fill="#365c61" font-size="30" font-family="Inter, Arial, sans-serif" font-weight="700">Export carousel</text>
          <rect x="264" y="304" width="416" height="388" rx="30" fill="#ffffff" stroke="#d2e6e2" stroke-width="3"/>
          <text x="308" y="364" fill="#1f3036" font-size="46" font-family="Manrope, Inter, sans-serif" font-weight="800">Ready to publish</text>
          <rect x="308" y="394" width="190" height="14" rx="7" fill="#f06a36" fill-opacity="0.88"/>
          <rect x="308" y="430" width="316" height="12" rx="6" fill="#65757f" fill-opacity="0.3"/>
          <rect x="716" y="304" width="420" height="388" rx="30" fill="#eff8f6" stroke="#c2ddd8" stroke-width="3"/>
          <text x="758" y="362" fill="#25474d" font-size="30" font-family="Inter, Arial, sans-serif" font-weight="700">Formats</text>
          <rect x="758" y="392" width="120" height="56" rx="20" fill="#f06a36"/>
          <text x="792" y="428" fill="#ffffff" font-size="28" font-family="Inter, Arial, sans-serif" font-weight="800">PNG</text>
          <rect x="900" y="392" width="120" height="56" rx="20" fill="#ffffff" stroke="#bdd8d4" stroke-width="3"/>
          <text x="938" y="428" fill="#2b5156" font-size="28" font-family="Inter, Arial, sans-serif" font-weight="800">JPG</text>
          <rect x="758" y="466" width="120" height="56" rx="20" fill="#ffffff" stroke="#bdd8d4" stroke-width="3"/>
          <text x="793" y="502" fill="#2b5156" font-size="28" font-family="Inter, Arial, sans-serif" font-weight="800">PDF</text>
          <rect x="900" y="466" width="120" height="56" rx="20" fill="#ffffff" stroke="#bdd8d4" stroke-width="3"/>
          <text x="940" y="502" fill="#2b5156" font-size="28" font-family="Inter, Arial, sans-serif" font-weight="800">ZIP</text>
          <rect x="758" y="560" width="262" height="72" rx="26" fill="#1f5f64"/>
          <text x="818" y="607" fill="#ffffff" font-size="30" font-family="Inter, Arial, sans-serif" font-weight="700">Download</text>
        </g>
      </svg>
    `;
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 900">
      <defs>
        <linearGradient id="composerBg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#e9f4f2"/>
          <stop offset="100%" stop-color="#dcefeb"/>
        </linearGradient>
        <filter id="composerShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="20" stdDeviation="14" flood-color="#2d7b73" flood-opacity="0.15"/>
        </filter>
      </defs>
      <rect width="1400" height="900" fill="url(#composerBg)"/>
      <g opacity="0.18" stroke="#9dc1bc" stroke-width="16" stroke-linecap="round">
        <path d="M128 156l56-38-56-38"/>
        <path d="M302 156l56-38-56-38"/>
        <path d="M476 156l56-38-56-38"/>
        <path d="M650 156l56-38-56-38"/>
        <path d="M824 156l56-38-56-38"/>
        <path d="M998 156l56-38-56-38"/>
      </g>
      <g filter="url(#composerShadow)">
        <rect x="186" y="148" width="1028" height="602" rx="52" fill="#fbfefd" stroke="#bfdad5" stroke-width="4"/>
        <rect x="262" y="220" width="876" height="72" rx="30" fill="#ffffff" stroke="#c8dedb" stroke-width="3"/>
        <rect x="284" y="238" width="184" height="36" rx="18" fill="#f06a36"/>
        <text x="324" y="262" fill="#ffffff" font-size="22" font-family="Inter, Arial, sans-serif" font-weight="700">Topic</text>
        <rect x="488" y="238" width="478" height="36" rx="18" fill="#edf6f4"/>
        <text x="516" y="262" fill="#678083" font-size="21" font-family="Inter, Arial, sans-serif">How to get clients from social media</text>
        <rect x="984" y="238" width="132" height="36" rx="18" fill="#ffffff" stroke="#c8dedb" stroke-width="3"/>
        <text x="1018" y="262" fill="#345d62" font-size="21" font-family="Inter, Arial, sans-serif" font-weight="700">7 cards</text>
        <rect x="262" y="326" width="556" height="316" rx="30" fill="#ffffff" stroke="#c7dfdb" stroke-width="3"/>
        <text x="304" y="384" fill="#21353b" font-size="38" font-family="Manrope, Inter, sans-serif" font-weight="800">Generate storyboard</text>
        <rect x="304" y="412" width="182" height="12" rx="6" fill="#f06a36" fill-opacity="0.84"/>
        <rect x="304" y="446" width="468" height="12" rx="6" fill="#6f8086" fill-opacity="0.28"/>
        <rect x="304" y="470" width="422" height="12" rx="6" fill="#6f8086" fill-opacity="0.28"/>
        <rect x="304" y="494" width="438" height="12" rx="6" fill="#6f8086" fill-opacity="0.28"/>
        <rect x="304" y="536" width="286" height="62" rx="22" fill="#1f6267"/>
        <text x="350" y="576" fill="#ffffff" font-size="28" font-family="Inter, Arial, sans-serif" font-weight="700">Generate</text>
        <rect x="846" y="326" width="292" height="316" rx="30" fill="#eff8f6" stroke="#c4ddd9" stroke-width="3"/>
        <text x="878" y="378" fill="#2b4f54" font-size="26" font-family="Inter, Arial, sans-serif" font-weight="700">Flow</text>
        <rect x="878" y="398" width="206" height="44" rx="16" fill="#ffffff"/>
        <text x="904" y="427" fill="#2f5e64" font-size="22" font-family="Inter, Arial, sans-serif" font-weight="700">Hook</text>
        <rect x="878" y="454" width="206" height="44" rx="16" fill="#ffffff"/>
        <text x="904" y="483" fill="#2f5e64" font-size="22" font-family="Inter, Arial, sans-serif" font-weight="700">Value</text>
        <rect x="878" y="510" width="206" height="44" rx="16" fill="#ffffff"/>
        <text x="904" y="539" fill="#2f5e64" font-size="22" font-family="Inter, Arial, sans-serif" font-weight="700">CTA</text>
      </g>
    </svg>
  `;
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
