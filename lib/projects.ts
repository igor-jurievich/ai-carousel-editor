import { CAROUSEL_TEMPLATE_IDS } from "@/types/editor";
import type {
  CanvasElement,
  CarouselProject,
  CarouselProjectSummary,
  CarouselTemplateId,
  Slide
} from "@/types/editor";

const STORAGE_KEY = "ai-carousel.projects.v1";
const MAX_PERSISTED_DATA_URL_LENGTH = 420_000;
const TEMPLATE_ID_SET = new Set<CarouselTemplateId>(CAROUSEL_TEMPLATE_IDS);

type StoredProject = CarouselProject & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function toFiniteNumber(value: unknown, fallback: number) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function toStringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeTextHighlights(value: unknown, textLength: number) {
  if (!Array.isArray(value) || textLength <= 0) {
    return [] as Array<{ start: number; end: number; color: string; opacity?: number }>;
  }

  return value
    .map((item) => {
      const source = item && typeof item === "object" ? item : null;
      const startSource = source && Number.isFinite((source as { start?: unknown }).start)
        ? Number((source as { start: number }).start)
        : 0;
      const endSource = source && Number.isFinite((source as { end?: unknown }).end)
        ? Number((source as { end: number }).end)
        : 0;
      const opacitySource = source && Number.isFinite((source as { opacity?: unknown }).opacity)
        ? Number((source as { opacity: number }).opacity)
        : undefined;
      return {
        start: Math.max(0, Math.min(textLength, Math.floor(startSource))),
        end: Math.max(0, Math.min(textLength, Math.floor(endSource))),
        color:
          source && typeof (source as { color?: unknown }).color === "string"
            ? String((source as { color: string }).color)
            : "#1f49ff",
        opacity:
          opacitySource === undefined ? undefined : Math.max(0.08, Math.min(1, opacitySource))
      };
    })
    .filter((range) => range.end > range.start);
}

function normalizeElement(element: unknown): CanvasElement | null {
  if (!element || typeof element !== "object" || Array.isArray(element)) {
    return null;
  }

  const source = element as Record<string, unknown>;
  const type = source.type;

  if (type === "text") {
    const text = toStringValue(source.text, "");
    const role = source.role === "title" || source.role === "body" || source.role === "caption" ? source.role : "body";
    return {
      id: toStringValue(source.id, crypto.randomUUID()),
      type: "text",
      role,
      metaKey: typeof source.metaKey === "string" ? source.metaKey : undefined,
      wasAutoTruncated: Boolean(source.wasAutoTruncated),
      text,
      highlights: normalizeTextHighlights(source.highlights, text.length),
      x: toFiniteNumber(source.x, 84),
      y: toFiniteNumber(source.y, role === "title" ? 320 : 530),
      width: Math.max(32, toFiniteNumber(source.width, 912)),
      height: Math.max(24, toFiniteNumber(source.height, role === "title" ? 220 : 300)),
      fontSize: Math.max(8, toFiniteNumber(source.fontSize, role === "title" ? 92 : 44)),
      fontFamily: toStringValue(source.fontFamily, role === "title" ? "Russo One" : "Manrope"),
      fontStyle: typeof source.fontStyle === "string" ? source.fontStyle : undefined,
      fill: toStringValue(source.fill, "#1b1e24"),
      align: source.align === "center" || source.align === "right" ? source.align : "left",
      lineHeight: toFiniteNumber(source.lineHeight, role === "title" ? 1.04 : 1.2),
      rotation: toFiniteNumber(source.rotation, 0),
      opacity: Math.max(0, Math.min(1, toFiniteNumber(source.opacity, 1))),
      letterSpacing: toFiniteNumber(source.letterSpacing, 0),
      textDecoration: typeof source.textDecoration === "string" ? source.textDecoration : undefined
    };
  }

  if (type === "shape") {
    return {
      id: toStringValue(source.id, crypto.randomUUID()),
      type: "shape",
      metaKey: typeof source.metaKey === "string" ? source.metaKey : undefined,
      shape: source.shape === "circle" ? "circle" : "rect",
      x: toFiniteNumber(source.x, 0),
      y: toFiniteNumber(source.y, 0),
      width: Math.max(2, toFiniteNumber(source.width, 100)),
      height: Math.max(2, toFiniteNumber(source.height, 100)),
      fill: toStringValue(source.fill, "#000000"),
      opacity: Math.max(0, Math.min(1, toFiniteNumber(source.opacity, 1))),
      rotation: toFiniteNumber(source.rotation, 0),
      cornerRadius: Math.max(0, toFiniteNumber(source.cornerRadius, 0)),
      stroke: typeof source.stroke === "string" ? source.stroke : undefined,
      strokeWidth: Math.max(0, toFiniteNumber(source.strokeWidth, 0))
    };
  }

  if (type === "image") {
    const src = toStringValue(source.src, "");
    if (!src) {
      return null;
    }

    return {
      id: toStringValue(source.id, crypto.randomUUID()),
      type: "image",
      metaKey: typeof source.metaKey === "string" ? source.metaKey : undefined,
      src,
      x: toFiniteNumber(source.x, 72),
      y: toFiniteNumber(source.y, 82),
      width: Math.max(8, toFiniteNumber(source.width, 936)),
      height: Math.max(8, toFiniteNumber(source.height, 460)),
      opacity: Math.max(0, Math.min(1, toFiniteNumber(source.opacity, 1))),
      rotation: toFiniteNumber(source.rotation, 0),
      cornerRadius: Math.max(0, toFiniteNumber(source.cornerRadius, 0)),
      fitMode:
        source.fitMode === "contain" || source.fitMode === "original" ? source.fitMode : "cover",
      zoom: Math.max(0.2, Math.min(6, toFiniteNumber(source.zoom, 1))),
      offsetX: toFiniteNumber(source.offsetX, 0),
      offsetY: toFiniteNumber(source.offsetY, 0),
      naturalWidth: toFiniteNumber(source.naturalWidth, 0) || undefined,
      naturalHeight: toFiniteNumber(source.naturalHeight, 0) || undefined,
      darken: Math.max(0, Math.min(1, toFiniteNumber(source.darken, 0))),
      stroke: typeof source.stroke === "string" ? source.stroke : undefined,
      strokeWidth: Math.max(0, toFiniteNumber(source.strokeWidth, 0))
    };
  }

  return null;
}

function cloneSlides(slides: Slide[]): Slide[] {
  if (!Array.isArray(slides)) {
    return [] as Slide[];
  }

  return slides.map((rawSlide, index) => {
    const slideSource =
      rawSlide && typeof rawSlide === "object" && !Array.isArray(rawSlide)
        ? (rawSlide as Record<string, unknown>)
        : {};

    const elements = Array.isArray(slideSource.elements)
      ? slideSource.elements
          .map(normalizeElement)
          .filter((element): element is CanvasElement => Boolean(element))
      : [];

    const slideType =
      slideSource.slideType === "text" ||
      slideSource.slideType === "list" ||
      slideSource.slideType === "big_text" ||
      slideSource.slideType === "image_text" ||
      slideSource.slideType === "cta"
        ? slideSource.slideType
        : "text";

    const generationRole =
      slideSource.generationRole === "hook" ||
      slideSource.generationRole === "problem" ||
      slideSource.generationRole === "amplify" ||
      slideSource.generationRole === "mistake" ||
      slideSource.generationRole === "consequence" ||
      slideSource.generationRole === "shift" ||
      slideSource.generationRole === "solution" ||
      slideSource.generationRole === "example" ||
      slideSource.generationRole === "cta"
        ? slideSource.generationRole
        : undefined;

    const templateId: CarouselTemplateId | undefined =
      typeof slideSource.templateId === "string" &&
      TEMPLATE_ID_SET.has(slideSource.templateId as CarouselTemplateId)
        ? (slideSource.templateId as CarouselTemplateId)
        : undefined;

    const backgroundImage =
      typeof slideSource.backgroundImage === "string"
        ? slideSource.backgroundImage
        : slideSource.backgroundImage === null
          ? null
          : null;

    const normalizedSlide: Slide = {
      id: toStringValue(slideSource.id, crypto.randomUUID()),
      name: toStringValue(slideSource.name, `Слайд ${index + 1}`),
      background: toStringValue(slideSource.background, "#ffffff"),
      elements,
      templateId,
      profileHandle: toStringValue(slideSource.profileHandle, "@username"),
      profileSubtitle: toStringValue(slideSource.profileSubtitle, ""),
      backgroundImage,
      photoSlotEnabled: Boolean(slideSource.photoSlotEnabled),
      generationRole,
      slideType,
      generationCoreIdea: toStringValue(slideSource.generationCoreIdea, "")
    };

    return normalizedSlide;
  });
}

function normalizeStoredProject(project: StoredProject): StoredProject {
  return {
    ...project,
    language: "ru",
    schemaVersion: Math.max(1, Number(project.schemaVersion ?? 1)),
    format: project.format ?? "1:1",
    theme: project.theme ?? "light",
    caption: project.caption ?? null,
    slides: cloneSlides(project.slides ?? [])
  };
}

function readAllProjects() {
  if (!canUseStorage()) {
    return [] as StoredProject[];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [] as StoredProject[];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [] as StoredProject[];
    }

    return parsed
      .filter((item): item is StoredProject => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      .filter((item) => typeof item.id === "string" && item.id.trim().length > 0)
      .map((item) => normalizeStoredProject(item))
      .sort((left, right) => (left.updatedAt < right.updatedAt ? 1 : -1));
  } catch {
    return [] as StoredProject[];
  }
}

function isLargeImageDataUrl(value: unknown) {
  return (
    typeof value === "string" &&
    value.startsWith("data:image/") &&
    value.length > MAX_PERSISTED_DATA_URL_LENGTH
  );
}

function compactSlideForStorage(slide: Slide) {
  let changed = false;

  const backgroundImage =
    isLargeImageDataUrl(slide.backgroundImage) || slide.backgroundImage === undefined
      ? null
      : slide.backgroundImage ?? null;
  if (backgroundImage !== (slide.backgroundImage ?? null)) {
    changed = true;
  }

  const elements = slide.elements.filter((element) => {
    if (element.type !== "image") {
      return true;
    }

    if (isLargeImageDataUrl(element.src)) {
      changed = true;
      return false;
    }

    return true;
  });

  return {
    slide: changed
      ? {
          ...slide,
          backgroundImage,
          elements
        }
      : slide,
    changed
  };
}

function compactProjectForStorage(project: StoredProject) {
  let changed = false;
  const slides = project.slides.map((slide) => {
    const compacted = compactSlideForStorage(slide);
    if (compacted.changed) {
      changed = true;
    }
    return compacted.slide;
  });

  return {
    project: changed
      ? normalizeStoredProject({
          ...project,
          slides
        })
      : project,
    changed
  };
}

function writeAllProjects(projects: StoredProject[]) {
  if (!canUseStorage()) {
    return;
  }
  let next = [...projects];

  while (next.length > 0) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return;
    } catch {
      if (next.length === 1) {
        const compacted = compactProjectForStorage(next[0]);
        if (compacted.changed) {
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify([compacted.project]));
            return;
          } catch {
            // no-op, throw below
          }
        }
        throw new Error(
          "Не удалось сохранить проект в браузере. Освободите место в хранилище или удалите часть старых проектов."
        );
      }
      // Drop the oldest project and retry if storage quota is exceeded.
      next = next.slice(0, -1);
    }
  }
}

export function listLocalProjects() {
  return readAllProjects().map((project) => ({
    id: project.id,
    title: project.title,
    topic: project.topic,
    updatedAt: project.updatedAt
  })) satisfies CarouselProjectSummary[];
}

export function getLocalProject(projectId: string) {
  if (!projectId.trim()) {
    return null;
  }

  const found = readAllProjects().find((project) => project.id === projectId);
  if (!found) {
    return null;
  }

  return {
    ...found,
    slides: cloneSlides(found.slides)
  } satisfies CarouselProject;
}

export function saveLocalProject(project: CarouselProject) {
  const now = new Date().toISOString();
  const current = readAllProjects();
  const projectId = (project.id && project.id.trim()) || crypto.randomUUID();
  const existing = current.find((item) => item.id === projectId);

  const nextProject = normalizeStoredProject({
    ...project,
    id: projectId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  });

  const next = [nextProject, ...current.filter((item) => item.id !== projectId)];
  writeAllProjects(next);

  return {
    ...nextProject,
    slides: cloneSlides(nextProject.slides)
  } satisfies CarouselProject;
}

export function deleteLocalProject(projectId: string) {
  const current = readAllProjects();
  const next = current.filter((project) => project.id !== projectId);
  writeAllProjects(next);
}
