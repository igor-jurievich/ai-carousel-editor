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
    description: "Тёмная сетка с красным акцентом.",
    accent: "#ff2a2a",
    accentAlt: "#ff6a6a",
    background: "#101216",
    surface: "#161a20",
    titleColor: "#f4f6fa",
    bodyColor: "#d7dbe4",
    titleFont: "Oswald",
    bodyFont: "Inter",
    chipStyle: "solid",
    decoration: "grid",
    preview: "Контрастный dark стиль"
  },
  {
    id: "light",
    name: "Светлый",
    description: "Светлая сетка с синим акцентом.",
    accent: "#2340ff",
    accentAlt: "#5970ff",
    background: "#f1f2f4",
    surface: "#ffffff",
    titleColor: "#1b1e24",
    bodyColor: "#2a2f38",
    titleFont: "Oswald",
    bodyFont: "Inter",
    chipStyle: "solid",
    decoration: "grid",
    preview: "Минималистичный light стиль"
  },
  {
    id: "color",
    name: "Цветной",
    description: "Насыщенный фон с белой типографикой.",
    accent: "#ff4a1f",
    accentAlt: "#ff7d5a",
    background: "#233cff",
    surface: "#304aff",
    titleColor: "#f7f8ff",
    bodyColor: "#f2f4ff",
    titleFont: "Oswald",
    bodyFont: "Inter",
    chipStyle: "solid",
    decoration: "grid",
    preview: "Яркий цветной стиль"
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

const MANAGED_META_KEYS = new Set([
  "decor-grid-line",
  "profile-handle",
  "footer-counter",
  "profile-subtitle",
  "footer-arrow",
  "managed-title",
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
    fontFamily: overrides.fontFamily ?? (isTitle ? "Oswald" : "Inter"),
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
      ? outline.bullets.map((item) => String(item).trim()).filter(Boolean)
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
  const y = Math.round(height * 0.12);
  const imageHeight = Math.round(height * 0.42);

  return {
    x: 0,
    y,
    width,
    height: imageHeight
  };
}

function resolveTextMetrics(format: SlideFormat) {
  const { width, height } = SLIDE_FORMAT_DIMENSIONS[format];

  return {
    width,
    height,
    contentX: 86,
    contentWidth: width - 172,
    titleY: Math.round(height * 0.34),
    bodyY: Math.round(height * 0.56)
  };
}

function buildGridDecoration(format: SlideFormat, color: string) {
  const { width, height } = SLIDE_FORMAT_DIMENSIONS[format];
  const step = Math.round(width / 18);
  const lines: ShapeElement[] = [];

  for (let x = 0; x <= width; x += step) {
    lines.push(
      createShapeElement({
        metaKey: "decor-grid-line",
        x,
        y: 0,
        width: 1,
        height,
        fill: color,
        opacity: 1,
        cornerRadius: 0
      })
    );
  }

  for (let y = 0; y <= height; y += step) {
    lines.push(
      createShapeElement({
        metaKey: "decor-grid-line",
        x: 0,
        y,
        width,
        height: 1,
        fill: color,
        opacity: 1,
        cornerRadius: 0
      })
    );
  }

  return lines;
}

function buildHeaderAndFooter(
  template: CarouselTemplate,
  index: number,
  totalSlides: number,
  format: SlideFormat,
  profileHandle: string,
  profileSubtitle: string
): TextElement[] {
  const { width, height } = SLIDE_FORMAT_DIMENSIONS[format];

  return [
    createTextElement({
      role: "caption",
      metaKey: "profile-handle",
      text: profileHandle,
      x: 86,
      y: Math.round(height * 0.048),
      width: 360,
      height: 44,
      fontSize: format === "9:16" ? 50 : 44,
      fontFamily: template.bodyFont,
      fontStyle: "normal",
      fill: template.bodyColor,
      align: "left",
      lineHeight: 1.1
    }),
    createTextElement({
      role: "caption",
      metaKey: "footer-counter",
      text: `[ ${index + 1}/${totalSlides} ]`,
      x: width - 250,
      y: Math.round(height * 0.048),
      width: 164,
      height: 44,
      fontSize: format === "9:16" ? 48 : 42,
      fontFamily: template.bodyFont,
      fontStyle: "normal",
      fill: template.bodyColor,
      align: "right",
      lineHeight: 1.1
    }),
    createTextElement({
      role: "caption",
      metaKey: "profile-subtitle",
      text: profileSubtitle,
      x: 86,
      y: height - Math.round(format === "9:16" ? 104 : 88),
      width: 520,
      height: 48,
      fontSize: format === "9:16" ? 48 : 42,
      fontFamily: template.bodyFont,
      fontStyle: "normal",
      fill: template.bodyColor,
      align: "left",
      lineHeight: 1.1
    }),
    createTextElement({
      role: "caption",
      metaKey: "footer-arrow",
      text: "→",
      x: width - 130,
      y: height - Math.round(format === "9:16" ? 108 : 92),
      width: 60,
      height: 56,
      fontSize: format === "9:16" ? 66 : 58,
      fontFamily: template.titleFont,
      fontStyle: "bold",
      fill: template.bodyColor,
      align: "right",
      lineHeight: 1
    })
  ];
}

function buildMainContent(
  slide: Slide,
  blueprint: SlideBlueprint,
  template: CarouselTemplate,
  format: SlideFormat
): CanvasElement[] {
  const metrics = resolveTextMetrics(format);
  const titleFill = template.titleColor;
  const bodyFill = template.bodyColor;

  if (blueprint.slideType === "big_text") {
    return [
      createTextElement({
        role: "title",
        metaKey: "managed-title",
        text: blueprint.title,
        x: metrics.contentX,
        y: Math.round(metrics.height * 0.42),
        width: metrics.contentWidth,
        height: Math.round(metrics.height * 0.24),
        fontSize: format === "9:16" ? 108 : format === "4:5" ? 94 : 88,
        fontFamily: template.titleFont,
        fontStyle: "bold",
        fill: titleFill,
        align: "left",
        lineHeight: 1.02
      })
    ];
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
          fill: template.id === "dark" ? "#2a2e38" : "#d9d9dc",
          opacity: 1,
          cornerRadius: 0
        }),
        createTextElement({
          role: "body",
          metaKey: "image-placeholder-text",
          text: "+ Добавить фото",
          x: imageArea.x,
          y: imageArea.y + Math.round(imageArea.height * 0.44),
          width: imageArea.width,
          height: 72,
          fontSize: format === "9:16" ? 66 : 58,
          fontFamily: template.titleFont,
          fontStyle: "bold",
          fill: template.id === "dark" ? "#8a8f99" : "#8d8f93",
          align: "center",
          lineHeight: 1
        })
      );
    }

    elements.push(
      createTextElement({
        role: "title",
        metaKey: "managed-title",
        text: blueprint.title,
        x: metrics.contentX,
        y: imageArea.y + imageArea.height + Math.round(metrics.height * 0.06),
        width: metrics.contentWidth,
        height: Math.round(metrics.height * 0.2),
        fontSize: format === "9:16" ? 100 : format === "4:5" ? 88 : 82,
        fontFamily: template.titleFont,
        fontStyle: "bold",
        fill: titleFill,
        align: "left",
        lineHeight: 1.04
      }),
      createTextElement({
        role: "body",
        metaKey: "managed-body",
        text: blueprint.body,
        x: metrics.contentX,
        y: imageArea.y + imageArea.height + Math.round(metrics.height * 0.24),
        width: metrics.contentWidth,
        height: Math.round(metrics.height * 0.2),
        fontSize: format === "9:16" ? 56 : 48,
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
    return [
      createTextElement({
        role: "title",
        metaKey: "managed-title",
        text: blueprint.title,
        x: metrics.contentX,
        y: Math.round(metrics.height * 0.42),
        width: metrics.contentWidth,
        height: Math.round(metrics.height * 0.18),
        fontSize: format === "9:16" ? 98 : format === "4:5" ? 88 : 82,
        fontFamily: template.titleFont,
        fontStyle: "bold",
        fill: titleFill,
        align: "left",
        lineHeight: 1.02
      }),
      createTextElement({
        role: "body",
        metaKey: "managed-body",
        text: blueprint.body,
        x: metrics.contentX,
        y: Math.round(metrics.height * 0.58),
        width: metrics.contentWidth,
        height: Math.round(metrics.height * 0.2),
        fontSize: format === "9:16" ? 56 : 48,
        fontFamily: template.bodyFont,
        fontStyle: "normal",
        fill: bodyFill,
        align: "left",
        lineHeight: 1.22
      })
    ];
  }

  return [
    createTextElement({
      role: "title",
      metaKey: "managed-title",
      text: blueprint.title,
      x: metrics.contentX,
      y: metrics.titleY,
      width: metrics.contentWidth,
      height: Math.round(metrics.height * 0.22),
      fontSize: format === "9:16" ? 104 : format === "4:5" ? 92 : 86,
      fontFamily: template.titleFont,
      fontStyle: "bold",
      fill: titleFill,
      align: "left",
      lineHeight: 1.04
    }),
    createTextElement({
      role: "body",
      metaKey: "managed-body",
      text: blueprint.body,
      x: metrics.contentX,
      y: metrics.bodyY,
      width: metrics.contentWidth,
      height: Math.round(metrics.height * 0.28),
      fontSize: format === "9:16" ? 58 : 50,
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
  const gridColor = template.id === "dark" ? "rgba(255,255,255,0.07)" : "rgba(20,28,38,0.08)";

  const managed: CanvasElement[] = [
    ...buildGridDecoration(format, gridColor),
    ...buildMainContent(slide, blueprint, template, format),
    ...buildHeaderAndFooter(
      template,
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

  const rebuiltBase: Slide = {
    ...slide,
    name: blueprint.title,
    background: getTemplate(templateId).background,
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

  const slide: Slide = {
    id: crypto.randomUUID(),
    name: blueprint.title,
    background: getTemplate(resolvedTemplateId).background,
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
