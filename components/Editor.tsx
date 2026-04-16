"use client";

import { saveAs } from "file-saver";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type Konva from "konva";
import { AppIcon } from "@/components/icons";
import { CanvasEditor } from "@/components/CanvasEditor";
import { MobileTools, type MobileToolTab } from "@/components/MobileTools";
import { SettingsPanel } from "@/components/SettingsPanel";
import { SlideExportModal } from "@/components/SlideExportModal";
import { SlideStage } from "@/components/SlideStage";
import { TemplateLibraryModal } from "@/components/TemplateLibraryModal";
import { Toolbar } from "@/components/Toolbar";
import {
  applyTemplateToSlide,
  applyTemplateToSlides,
  createBlankSlide,
  createImageElement,
  createSlidesFromOutline,
  createStarterSlides,
  createTextElement,
  getTemplate,
  projectTitleFromTopic,
  relayoutSlidesForFormat,
  reorderSlides,
  SLIDE_FORMAT_DIMENSIONS,
  setSlideBackgroundImage,
  syncSlideOrderMeta,
  updateSlideFooter
} from "@/lib/carousel";
import {
  clampSlidesCount,
  DEFAULT_SLIDES_COUNT,
  SLIDES_COUNT_OPTIONS
} from "@/lib/slides";
import { getLocalProject, saveLocalProject } from "@/lib/projects";
import { trackEvent } from "@/lib/telemetry";
import type {
  CanvasElement,
  CarouselOutlineSlide,
  CarouselPostCaption,
  CarouselTemplateId,
  ShapeElement,
  Slide,
  SlidePhotoSettings,
  SlideFormat,
  TextElement,
  TextHighlightRange
} from "@/types/editor";

const DEFAULT_STATUS =
  "Откройте demo-серию, затем введите свою тему и нажмите «Сгенерировать».";
const MOBILE_BREAKPOINT = 768;
const MAX_TOPIC_CHARS = 4000;
const MIN_TOPIC_CHARS = 3;
const EXPORT_LOCK_STATUS = "Дождитесь завершения экспорта и повторите действие.";
const GENERATE_LOCK_STATUS = "Дождитесь завершения генерации и повторите действие.";
const GENERATE_TIMEOUT_MS = 30_000;

type ExportMode = "zip" | "png" | "jpg" | "pdf";
const HISTORY_LIMIT = 40;
const EXPORT_ATTEMPTS_MAX = 3;
const EXPORT_CAPTURE_ATTEMPTS = 3;
const MOBILE_PREVIEW_MAX_WIDTH: Record<SlideFormat, number> = {
  "1:1": 324,
  "4:5": 338,
  "9:16": 312
};
const MANAGED_TEXT_META_KEYS = new Set(["managed-title", "managed-body"]);
const MANAGED_TITLE_META_KEY = "managed-title";
const MANAGED_BODY_META_KEY = "managed-body";
const DEFAULT_HIGHLIGHT_COLOR = "#6366f1";
const DEFAULT_SLIDE_PHOTO_SETTINGS: SlidePhotoSettings = {
  zoom: 100,
  offsetX: 0,
  offsetY: 0,
  overlay: 0
};
const NON_CONTENT_TEXT_META_KEYS = new Set([
  "slide-chip-text",
  "managed-title-accent-text",
  "profile-handle",
  "footer-counter",
  "profile-subtitle",
  "footer-arrow",
  "image-placeholder-text"
]);
const LEGACY_ACCENT_TEXT_COLORS = new Set(["#ffffff", "#fff", "#f5f7ff", "#f7f9ff"]);
const LEGACY_ACCENT_CHIP_HEX_COLORS = new Set([
  "#1f49ff",
  "#254fff",
  "#325cff",
  "#3b5fff",
  "#4366ff",
  "#4a6dff",
  "#5676ff",
  "#ff2d00",
  "#ff3a1a",
  "#ff421f",
  "#ff4a25",
  "#ff552f",
  "#ff5e3d",
  "#ff6b3d",
  "#ff2a2a"
]);
const HEX_COLOR_INPUT_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
type EditableTextTargetRole = "title" | "body";
type MobileColorSchemeMode = "single" | "double";
type GridDecorationMode = "full" | "vertical" | "dots";
type MobileStylePresetId = "mono" | "grid" | "gradient" | "notes" | "dots" | "flash";

const MOBILE_STYLE_PRESET_CONFIG: Record<
  MobileStylePresetId,
  { background: string; gridVisible: boolean; gridMode: GridDecorationMode }
> = {
  mono: {
    background: "#ffffff",
    gridVisible: false,
    gridMode: "full"
  },
  grid: {
    background: "#f8f8f9",
    gridVisible: true,
    gridMode: "full"
  },
  gradient: {
    background: "#f4ede8",
    gridVisible: false,
    gridMode: "vertical"
  },
  notes: {
    background: "#ececf1",
    gridVisible: true,
    gridMode: "vertical"
  },
  dots: {
    background: "#f5f5f6",
    gridVisible: true,
    gridMode: "dots"
  },
  flash: {
    background: "#e8e9ed",
    gridVisible: true,
    gridMode: "vertical"
  }
};

function makeEditorElementId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseRgbFromColor(value: string) {
  const normalized = value.trim().toLowerCase();
  const hex = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/u);
  if (hex) {
    const token = hex[1];
    const full =
      token.length === 3
        ? token
            .split("")
            .map((char) => `${char}${char}`)
            .join("")
        : token;
    return {
      r: Number.parseInt(full.slice(0, 2), 16),
      g: Number.parseInt(full.slice(2, 4), 16),
      b: Number.parseInt(full.slice(4, 6), 16)
    };
  }

  const rgb = normalized.match(/^rgba?\(([^)]+)\)$/u);
  if (!rgb) {
    return null;
  }

  const parts = rgb[1]
    .split(",")
    .map((part) => Number.parseFloat(part.trim()))
    .filter((part) => Number.isFinite(part));
  if (parts.length < 3) {
    return null;
  }

  return {
    r: Math.max(0, Math.min(255, parts[0])),
    g: Math.max(0, Math.min(255, parts[1])),
    b: Math.max(0, Math.min(255, parts[2]))
  };
}

function resolveGridColorForBackground(background: string) {
  const rgb = parseRgbFromColor(background);
  if (!rgb) {
    return "rgba(24, 28, 34, 0.14)";
  }

  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance < 0.48 ? "rgba(255, 255, 255, 0.16)" : "rgba(24, 28, 34, 0.14)";
}

function inferGridModeFromSlide(slide: Slide): GridDecorationMode | null {
  const gridElements = slide.elements.filter(
    (element): element is ShapeElement =>
      element.type === "shape" && element.metaKey === "decor-grid-line"
  );

  if (!gridElements.length) {
    return null;
  }

  if (gridElements.some((element) => element.shape === "circle")) {
    return "dots";
  }

  const verticalCount = gridElements.filter((element) => element.height > element.width * 3).length;
  const horizontalCount = gridElements.filter((element) => element.width > element.height * 3).length;
  if (verticalCount > 0 && horizontalCount > 0) {
    return "full";
  }
  return "vertical";
}

function buildGridDecorationElements(
  format: SlideFormat,
  mode: GridDecorationMode,
  color: string
): ShapeElement[] {
  const { width, height } = SLIDE_FORMAT_DIMENSIONS[format];
  const step = Math.max(58, format === "9:16" ? 84 : 72);
  const elements: ShapeElement[] = [];

  if (mode === "dots") {
    const dotSize = format === "9:16" ? 6 : 5;
    const offset = Math.round(step * 0.45);
    for (let y = offset; y <= height; y += step) {
      for (let x = offset; x <= width; x += step) {
        elements.push({
          id: makeEditorElementId("decor-grid"),
          type: "shape",
          metaKey: "decor-grid-line",
          shape: "circle",
          x: x - dotSize / 2,
          y: y - dotSize / 2,
          width: dotSize,
          height: dotSize,
          fill: color,
          opacity: 1,
          rotation: 0,
          cornerRadius: dotSize
        });
      }
    }
    return elements;
  }

  for (let x = 0; x <= width; x += step) {
    elements.push({
      id: makeEditorElementId("decor-grid"),
      type: "shape",
      metaKey: "decor-grid-line",
      shape: "rect",
      x,
      y: 0,
      width: 1,
      height,
      fill: color,
      opacity: 1,
      rotation: 0,
      cornerRadius: 0
    });
  }

  if (mode === "full") {
    for (let y = 0; y <= height; y += step) {
      elements.push({
        id: makeEditorElementId("decor-grid"),
        type: "shape",
        metaKey: "decor-grid-line",
        shape: "rect",
        x: 0,
        y,
        width,
        height: 1,
        fill: color,
        opacity: 1,
        rotation: 0,
        cornerRadius: 0
      });
    }
  }

  return elements;
}

function resolveGridElementOpacity(element: Pick<ShapeElement, "shape">) {
  return element.shape === "circle" ? 0.2 : 0.12;
}

function normalizeHighlightRanges(ranges: TextHighlightRange[] | undefined, textLength: number) {
  if (!ranges?.length || textLength <= 0) {
    return [] as TextHighlightRange[];
  }

  const normalized = ranges
    .map((range) => {
      const source = range && typeof range === "object" ? range : null;
      const startSource = source && Number.isFinite(source.start) ? source.start : 0;
      const endSource = source && Number.isFinite(source.end) ? source.end : 0;
      const colorSource = source && typeof source.color === "string" ? source.color : DEFAULT_HIGHLIGHT_COLOR;
      const opacitySource =
        source && Number.isFinite(source.opacity) ? (source.opacity as number) : 0.94;
      return {
        start: Math.max(0, Math.min(textLength, Math.floor(startSource))),
        end: Math.max(0, Math.min(textLength, Math.floor(endSource))),
        color: colorSource || DEFAULT_HIGHLIGHT_COLOR,
        opacity: Math.max(0.08, Math.min(1, opacitySource))
      };
    })
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  if (!normalized.length) {
    return [];
  }

  const merged: TextHighlightRange[] = [];
  for (const range of normalized) {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      range.start <= previous.end &&
      range.color.toLowerCase() === previous.color.toLowerCase() &&
      Math.abs((range.opacity ?? 0.94) - (previous.opacity ?? 0.94)) < 0.0001
    ) {
      previous.end = Math.max(previous.end, range.end);
      continue;
    }
    merged.push(range);
  }

  return merged;
}

function normalizeHighlightRangesForText(
  ranges: TextHighlightRange[] | undefined,
  text: string
): TextHighlightRange[] {
  const normalized = normalizeHighlightRanges(ranges, text.length);
  if (!normalized.length) {
    return [];
  }

  return normalized.filter((range) => /[\p{L}\p{N}]/u.test(text.slice(range.start, range.end)));
}

function removeHighlightRange(
  ranges: TextHighlightRange[],
  removeStart: number,
  removeEnd: number
): TextHighlightRange[] {
  if (removeEnd <= removeStart) {
    return ranges;
  }

  const next: TextHighlightRange[] = [];
  for (const range of ranges) {
    if (range.end <= removeStart || range.start >= removeEnd) {
      next.push(range);
      continue;
    }

    if (range.start < removeStart) {
      next.push({
        ...range,
        end: removeStart
      });
    }
    if (range.end > removeEnd) {
      next.push({
        ...range,
        start: removeEnd
      });
    }
  }

  return next;
}

type HistorySnapshot = {
  slides: Slide[];
  activeSlideId: string | null;
  slideFormat: SlideFormat;
};

type ExportSnapshot = {
  slides: Slide[];
  slideFormat: SlideFormat;
};

type EditorProps = {
  initialProjectId?: string | null;
};

export function Editor({ initialProjectId = null }: EditorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [slides, setSlides] = useState<Slide[]>(() => createStarterSlides("light", "1:1"));
  const [topic, setTopic] = useState("");
  const [slidesCount, setSlidesCount] = useState(DEFAULT_SLIDES_COUNT);
  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const [promptVariant, setPromptVariant] = useState<"A" | "B">("B");
  const [niche, setNiche] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("balanced");
  const [goal, setGoal] = useState("engagement");
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);
  const [slideFormat, setSlideFormat] = useState<SlideFormat>("1:1");
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [displaySize, setDisplaySize] = useState(596);
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [isGeneratePanelVisible, setIsGeneratePanelVisible] = useState(!initialProjectId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingTextElementId, setEditingTextElementId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [selectedTextSelection, setSelectedTextSelection] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [selectedTextTargetRole, setSelectedTextTargetRole] = useState<EditableTextTargetRole>("title");
  const [selectedTextHighlightColorOverride, setSelectedTextHighlightColorOverride] = useState(
    DEFAULT_HIGHLIGHT_COLOR
  );
  const [selectedTextHighlightOpacityOverride, setSelectedTextHighlightOpacityOverride] = useState(0.94);
  const [exportMode, setExportMode] = useState<ExportMode>("zip");
  const [isExportRendering, setIsExportRendering] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isSlideExportModalOpen, setIsSlideExportModalOpen] = useState(false);
  const [selectedExportSlideIds, setSelectedExportSlideIds] = useState<string[]>([]);
  const [exportSnapshot, setExportSnapshot] = useState<ExportSnapshot | null>(null);
  const [mobileToolTab, setMobileToolTab] = useState<MobileToolTab | null>(null);
  const [mobileBottomOffset, setMobileBottomOffset] = useState(120);
  const [pendingImageSlideId, setPendingImageSlideId] = useState<string | null>(null);
  const [pendingBackgroundSlideId, setPendingBackgroundSlideId] = useState<string | null>(null);
  const [scrollToSlideRequest, setScrollToSlideRequest] = useState<{ id: string; token: number } | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [isProjectHydrated, setIsProjectHydrated] = useState(false);
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [captionResult, setCaptionResult] = useState<CarouselPostCaption | null>(null);
  const [historyPast, setHistoryPast] = useState<HistorySnapshot[]>([]);
  const [historyFuture, setHistoryFuture] = useState<HistorySnapshot[]>([]);
  const desktopCanvasHostRef = useRef<HTMLDivElement | null>(null);
  const mobileCanvasHostRef = useRef<HTMLDivElement | null>(null);
  const mobileGeneratePanelRef = useRef<HTMLDetailsElement | null>(null);
  const mobileGenerateTopicRef = useRef<HTMLTextAreaElement | null>(null);
  const mobileToolbarRef = useRef<HTMLElement | null>(null);
  const mobileToolSheetRef = useRef<HTMLElement | null>(null);
  const editingTextElementIdRef = useRef<string | null>(null);
  const editingValueRef = useRef("");
  const editingDirtyRef = useRef(false);
  const selectedTextSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const exportStageRefs = useRef<Record<string, Konva.Stage | null>>({});
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const backgroundImageInputRef = useRef<HTMLInputElement | null>(null);
  const generateRequestRef = useRef(0);
  const generateAbortRef = useRef<AbortController | null>(null);
  const lastHistoryAtRef = useRef(0);
  const skipAutosaveRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const autosaveSaveErrorNotifiedRef = useRef(false);
  const editorOpenedTrackedRef = useRef(false);
  const initialMobileToolAppliedRef = useRef(false);
  const generationLockedRef = useRef(false);
  const handleUndoRef = useRef<() => void>(() => undefined);
  const handleRedoRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (initialMobileToolAppliedRef.current || typeof window === "undefined") {
      return;
    }

    const toolFromQuery = searchParams.get("tool");
    const shouldOpenPostTool = window.innerWidth <= MOBILE_BREAKPOINT && toolFromQuery === "post";

    if (shouldOpenPostTool) {
      setMobileToolTab("post");
      setStatus("Открыта вкладка «Пост»: здесь можно сгенерировать подпись к карусели.");
    }

    initialMobileToolAppliedRef.current = true;

    if (!toolFromQuery) {
      return;
    }

    const nextQuery = new URLSearchParams(searchParams.toString());
    nextQuery.delete("tool");
    nextQuery.delete("from");
    const nextQueryString = nextQuery.toString();
    const nextPath = nextQueryString ? `${pathname}?${nextQueryString}` : pathname;
    router.replace(nextPath, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    editingTextElementIdRef.current = editingTextElementId;
  }, [editingTextElementId]);

  useEffect(() => {
    editingValueRef.current = editingValue;
  }, [editingValue]);


  useEffect(() => {
    if (!slides.length) {
      return;
    }

    setActiveSlideId((current) =>
      current && slides.some((slide) => slide.id === current) ? current : slides[0].id
    );
  }, [slides]);

  useEffect(() => {
    if (typeof document === "undefined") {
      setFontsReady(true);
      return;
    }

    if (!("fonts" in document) || !document.fonts?.ready) {
      setFontsReady(true);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        setFontsReady(true);
      }
    }, 2200);

    document.fonts.ready
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          window.clearTimeout(timeoutId);
          setFontsReady(true);
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const { width: canvasWidth, height: canvasHeight } = SLIDE_FORMAT_DIMENSIONS[slideFormat];
    const canvasAspectRatio = canvasWidth / canvasHeight;

    const updateSize = () => {
      const activeElement = document.activeElement;
      const isTextEntryFocused = isTextEntryElement(activeElement);
      const viewport = window.visualViewport;
      const viewportWidth = isTextEntryFocused
        ? window.innerWidth
        : viewport?.width ?? window.innerWidth;
      const viewportHeight = isTextEntryFocused
        ? window.innerHeight
        : viewport?.height ?? window.innerHeight;
      const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;

      if (isMobile) {
        if (isTextEntryFocused) {
          return;
        }

        const host = mobileCanvasHostRef.current;
        const hostWidth = host?.clientWidth ?? viewportWidth;
        const hostRect = host?.getBoundingClientRect();
        const overlays = [mobileToolbarRef.current, mobileToolSheetRef.current]
          .map((node) => node?.getBoundingClientRect())
          .filter((rect): rect is DOMRect => Boolean(rect && rect.width > 0 && rect.height > 0));
        const overlayTop = overlays.length
          ? Math.min(...overlays.map((rect) => rect.top))
          : viewportHeight;
        const availableHeight = Math.max(220, overlayTop - (hostRect?.top ?? 0));
        const widthLimit = Math.max(
          220,
          Math.min(
            hostWidth * 0.88,
            viewportWidth - 72,
            MOBILE_PREVIEW_MAX_WIDTH[slideFormat]
          )
        );
        const heightLimit = Math.max(220, availableHeight - 24) * canvasAspectRatio;
        const nextSize = Math.max(220, Math.min(widthLimit, heightLimit));
        const toolbarRect = mobileToolbarRef.current?.getBoundingClientRect();
        const nextBottomOffset = toolbarRect
          ? Math.max(72, Math.round(viewportHeight - toolbarRect.top))
          : 96;

        setMobileBottomOffset((current) =>
          Math.abs(current - nextBottomOffset) < 2 ? current : nextBottomOffset
        );
        setDisplaySize((current) =>
          Math.abs(current - nextSize) < 1 ? current : Math.round(nextSize)
        );
        return;
      }

      const hostWidth = desktopCanvasHostRef.current?.clientWidth ?? viewportWidth;
      const widthLimit = Math.max(360, Math.min(hostWidth, viewportWidth) - 148);
      const availableHeight = Math.max(260, viewportHeight - 236);
      const heightLimit = availableHeight * canvasAspectRatio;
      const nextSize = Math.max(360, Math.min(760, widthLimit, heightLimit));
      setDisplaySize((current) =>
        Math.abs(current - nextSize) < 1 ? current : Math.round(nextSize)
      );
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    if (desktopCanvasHostRef.current) {
      observer.observe(desktopCanvasHostRef.current);
    }
    if (mobileCanvasHostRef.current) {
      observer.observe(mobileCanvasHostRef.current);
    }
    if (mobileToolbarRef.current) {
      observer.observe(mobileToolbarRef.current);
    }
    if (mobileToolSheetRef.current) {
      observer.observe(mobileToolSheetRef.current);
    }

    window.addEventListener("resize", updateSize);
    window.visualViewport?.addEventListener("resize", updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
      window.visualViewport?.removeEventListener("resize", updateSize);
    };
  }, [mobileToolTab, slideFormat]);

  useEffect(() => {
    const isMobileViewport = () => window.innerWidth <= MOBILE_BREAKPOINT;
    const isInsideMobileShell = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest(".mobile-editor-shell"));
    const preventGesture = (event: Event) => {
      if (!isMobileViewport() || !isInsideMobileShell(event.target)) {
        return;
      }
      event.preventDefault();
    };
    const preventCtrlZoom = (event: WheelEvent) => {
      if (!isMobileViewport() || !event.ctrlKey || !isInsideMobileShell(event.target)) {
        return;
      }
      event.preventDefault();
    };

    let lastTapAt = 0;
    const preventDoubleTapZoom = (event: TouchEvent) => {
      if (!isMobileViewport() || !isInsideMobileShell(event.target)) {
        return;
      }

      const now = Date.now();
      if (now - lastTapAt < 320) {
        event.preventDefault();
      }
      lastTapAt = now;
    };

    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });
    document.addEventListener("gestureend", preventGesture, { passive: false });
    document.addEventListener("wheel", preventCtrlZoom, { passive: false });
    document.addEventListener("touchend", preventDoubleTapZoom, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
      document.removeEventListener("wheel", preventCtrlZoom);
      document.removeEventListener("touchend", preventDoubleTapZoom);
    };
  }, []);

  const slideDimensions = useMemo(
    () => SLIDE_FORMAT_DIMENSIONS[slideFormat],
    [slideFormat]
  );
  const displayHeight = Math.round(displaySize * (slideDimensions.height / slideDimensions.width));

  const activeSlide = useMemo(
    () => slides.find((slide) => slide.id === activeSlideId) ?? slides[0],
    [activeSlideId, slides]
  );

  const activeSlideIndex = useMemo(
    () => slides.findIndex((slide) => slide.id === activeSlide?.id),
    [activeSlide?.id, slides]
  );

  const selectedElement = useMemo(
    () => activeSlide?.elements.find((element) => element.id === selectedElementId) ?? null,
    [activeSlide, selectedElementId]
  );
  const selectedTextElement = useMemo(
    () => (selectedElement?.type === "text" ? selectedElement : null),
    [selectedElement]
  );
  const orderedTextElements = useMemo(
    () =>
      (activeSlide?.elements ?? [])
        .filter(
          (element): element is TextElement =>
            element.type === "text" &&
            !NON_CONTENT_TEXT_META_KEYS.has(element.metaKey ?? "")
        )
        .sort((left, right) => left.y - right.y),
    [activeSlide?.elements]
  );
  const managedTitleTextElement = useMemo(
    () => {
      const explicit = activeSlide
        ? resolvePreferredManagedTextByMeta(activeSlide, MANAGED_TITLE_META_KEY)
        : null;
      if (explicit) {
        return explicit;
      }
      return orderedTextElements[0] ?? null;
    },
    [activeSlide?.elements, orderedTextElements]
  );
  const managedBodyTextElement = useMemo(
    () => {
      const explicit = activeSlide
        ? resolvePreferredManagedTextByMeta(activeSlide, MANAGED_BODY_META_KEY)
        : null;
      if (explicit) {
        return explicit;
      }
      return orderedTextElements.find((element) => element.id !== managedTitleTextElement?.id) ?? null;
    },
    [activeSlide?.elements, managedTitleTextElement?.id, orderedTextElements]
  );
  const effectiveSelectedTextElement = useMemo(() => {
    if (selectedTextElement) {
      return selectedTextElement;
    }
    if (selectedTextTargetRole === "body") {
      return managedBodyTextElement ?? managedTitleTextElement;
    }
    return managedTitleTextElement ?? managedBodyTextElement;
  }, [managedBodyTextElement, managedTitleTextElement, selectedTextElement, selectedTextTargetRole]);

  useEffect(() => {
    if (!selectedTextElement) {
      return;
    }
    const nextRole: EditableTextTargetRole =
      selectedTextElement.metaKey === MANAGED_BODY_META_KEY || selectedTextElement.role === "body"
        ? "body"
        : "title";
    setSelectedTextTargetRole(nextRole);
  }, [selectedTextElement]);

  useEffect(() => {
    setSelectedTextSelection(null);
    selectedTextSelectionRef.current = null;
  }, [effectiveSelectedTextElement?.id]);
  useEffect(() => {
    const effectiveTemplateIdForHighlight =
      activeSlide?.templateId ?? slides[0]?.templateId ?? "light";
    const activeTemplate = getTemplate(effectiveTemplateIdForHighlight);
    const templateHighlightColor = normalizeColorForInput(
      activeTemplate.highlightColor ?? activeTemplate.accent,
      DEFAULT_HIGHLIGHT_COLOR
    );
    const templateHighlightOpacity =
      typeof activeTemplate.highlightOpacity === "number"
        ? Math.max(0.08, Math.min(1, activeTemplate.highlightOpacity))
        : undefined;
    const firstRange = effectiveSelectedTextElement?.highlights?.find(
      (range) => range.end > range.start
    );
    if (!firstRange) {
      setSelectedTextHighlightColorOverride(templateHighlightColor);
      if (templateHighlightOpacity !== undefined) {
        setSelectedTextHighlightOpacityOverride(templateHighlightOpacity);
      }
      return;
    }
    if (firstRange.color) {
      setSelectedTextHighlightColorOverride(normalizeColorForInput(firstRange.color, DEFAULT_HIGHLIGHT_COLOR));
    }
    if (Number.isFinite(firstRange.opacity)) {
      setSelectedTextHighlightOpacityOverride(
        Math.max(0.08, Math.min(1, firstRange.opacity as number))
      );
    }
  }, [
    activeSlide?.templateId,
    effectiveSelectedTextElement?.id,
    effectiveSelectedTextElement?.highlights,
    slides[0]?.templateId
  ]);
  const activeHasBackgroundImage = Boolean(activeSlide?.backgroundImage);
  const activePhotoSlotEnabled = Boolean(
    activeSlide?.slideType === "image_text" && activeSlide.photoSlotEnabled !== false
  );
  const activePhotoSettings = normalizeSlidePhotoSettings(activeSlide?.photoSettings);
  const activeGridVisible = Boolean(
    activeSlide?.elements.some(
      (element) =>
        element.type === "shape" &&
        element.metaKey === "decor-grid-line" &&
        (element.opacity ?? 1) > 0.04
    )
  );

  const editingTextElement = useMemo(() => {
    if (!activeSlide || !editingTextElementId) {
      return null;
    }

    return (
      activeSlide.elements.find(
        (element): element is TextElement =>
          element.id === editingTextElementId && element.type === "text"
      ) ?? null
    );
  }, [activeSlide, editingTextElementId]);

  const activeTemplateId = useMemo<CarouselTemplateId>(
    () => activeSlide?.templateId ?? slides[0]?.templateId ?? "light",
    [activeSlide, slides]
  );
  const activeTemplateName = useMemo(
    () => getTemplate(activeTemplateId).name,
    [activeTemplateId]
  );
  const subtitlesVisibleAcrossSlides = useMemo(
    () =>
      slides.some((slide) =>
        Boolean(normalizeProfileSubtitleForUi(slide.profileSubtitle ?? "").trim())
      ),
    [slides]
  );
  const generationLocked = isGenerating || isExportRendering;
  const exportModeLabel = getExportModeLabel(exportMode);
  const canUndo = historyPast.length > 0;
  const canRedo = historyFuture.length > 0;

  useEffect(() => {
    generationLockedRef.current = generationLocked;
  }, [generationLocked]);

  useEffect(() => {
    if (!initialProjectId) {
      setIsProjectHydrated(true);
      return;
    }

    const existing = getLocalProject(initialProjectId);
    if (!existing) {
      setStatus("Проект не найден. Открыта стартовая серия.");
      setProjectId(null);
      setIsGeneratePanelVisible(true);
      setIsProjectHydrated(true);
      return;
    }

    skipAutosaveRef.current = true;
    setProjectId(existing.id ?? initialProjectId);
    setSlides(existing.slides?.length ? cloneSlides(existing.slides) : createStarterSlides("light", "1:1"));
    setTopic(existing.topic ?? "");
    setPromptVariant(existing.promptVariant === "A" ? "A" : "B");
    setSlidesCount(clampSlidesCount(existing.slides?.length ?? DEFAULT_SLIDES_COUNT));
    setNiche(existing.niche ?? "");
    setAudience(existing.audience ?? "");
    setTone(existing.tone ?? "balanced");
    setGoal(existing.goal ?? "engagement");
    setSlideFormat(existing.format ?? "1:1");
    setActiveSlideId(existing.slides?.[0]?.id ?? null);
    setCaptionResult(existing.caption ?? null);
    setSelectedElementId(null);
    setEditingTextElementId(null);
    editingTextElementIdRef.current = null;
    editingDirtyRef.current = false;
    editingValueRef.current = "";
    setStatus("Проект загружен.");
    setIsGeneratePanelVisible(false);
    setIsProjectHydrated(true);
  }, [initialProjectId]);

  useEffect(() => {
    if (!isProjectHydrated || isExportRendering || isGenerating) {
      return;
    }

    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false;
      return;
    }

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      try {
        const saved = saveLocalProject({
          id: projectId ?? undefined,
          title: projectTitleFromTopic(topic),
          topic,
          slides: cloneSlides(slides),
          format: slideFormat,
          theme: activeTemplateId,
          promptVariant,
          niche: niche.trim() || undefined,
          audience: audience.trim() || undefined,
          tone,
          goal,
          language: "ru",
          schemaVersion: 1,
          caption: captionResult
        });

        autosaveSaveErrorNotifiedRef.current = false;

        if (!projectId || projectId !== saved.id) {
          setProjectId(saved.id ?? null);
        }

        if (saved.id && pathname !== `/editor/${saved.id}`) {
          router.replace(`/editor/${saved.id}`);
        }
      } catch (autosaveError) {
        if (!autosaveSaveErrorNotifiedRef.current) {
          autosaveSaveErrorNotifiedRef.current = true;
          setStatus(
            autosaveError instanceof Error
              ? autosaveError.message
              : "Не удалось сохранить проект. Освободите место в браузере и повторите."
          );
        }
      }
    }, 420);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [
    isProjectHydrated,
    isExportRendering,
    isGenerating,
    projectId,
    topic,
    slides,
    slideFormat,
    activeTemplateId,
    promptVariant,
    niche,
    audience,
    tone,
    goal,
    captionResult,
    pathname,
    router
  ]);

  useEffect(() => {
    if (!isProjectHydrated || editorOpenedTrackedRef.current) {
      return;
    }

    editorOpenedTrackedRef.current = true;
    trackEvent({
      name: "editor_opened",
      payload: {
        projectId: projectId ?? "unsaved",
        format: slideFormat
      }
    });
  }, [isProjectHydrated, projectId, slideFormat]);

  useEffect(() => {
    return () => {
      generateAbortRef.current?.abort();
      generateAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isSlideExportModalOpen) {
      return;
    }

    setSelectedExportSlideIds((current) => {
      const ordered = slides.map((slide) => slide.id);
      const currentSet = new Set(current);
      const synced = ordered.filter((slideId) => currentSet.has(slideId));

      return synced.length > 0 ? synced : ordered;
    });
  }, [isSlideExportModalOpen, slides]);

  const makeHistorySnapshot = () => ({
    slides: cloneSlides(slides),
    activeSlideId,
    slideFormat
  });

  const pushHistorySnapshot = (force = false) => {
    const now = Date.now();
    if (!force && now - lastHistoryAtRef.current < 320) {
      return;
    }
    lastHistoryAtRef.current = now;
    const snapshot = makeHistorySnapshot();
    setHistoryPast((current) => [...current.slice(-(HISTORY_LIMIT - 1)), snapshot]);
    setHistoryFuture([]);
  };

  const handleUndo = () => {
    if (!historyPast.length || generationLocked) {
      return;
    }

    const previous = historyPast[historyPast.length - 1];
    const current = makeHistorySnapshot();
    setHistoryPast((items) => items.slice(0, -1));
    setHistoryFuture((items) => [...items, current]);
    setSlides(cloneSlides(previous.slides));
    setActiveSlideId(previous.activeSlideId);
    setSlideFormat(previous.slideFormat);
    setSelectedElementId(null);
    setEditingTextElementId(null);
    setStatus("Действие отменено.");
  };

  const handleRedo = () => {
    if (!historyFuture.length || generationLocked) {
      return;
    }

    const next = historyFuture[historyFuture.length - 1];
    const current = makeHistorySnapshot();
    setHistoryFuture((items) => items.slice(0, -1));
    setHistoryPast((items) => [...items.slice(-(HISTORY_LIMIT - 1)), current]);
    setSlides(cloneSlides(next.slides));
    setActiveSlideId(next.activeSlideId);
    setSlideFormat(next.slideFormat);
    setSelectedElementId(null);
    setEditingTextElementId(null);
    setStatus("Действие повторено.");
  };

  useEffect(() => {
    handleUndoRef.current = handleUndo;
    handleRedoRef.current = handleRedo;
  }, [handleUndo, handleRedo]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isTypingTarget =
        event.target instanceof HTMLElement &&
        (event.target.tagName === "INPUT" ||
          event.target.tagName === "TEXTAREA" ||
          event.target.isContentEditable);

      if (!(event.metaKey || event.ctrlKey) || isTypingTarget || generationLockedRef.current) {
        return;
      }

      if (event.key.toLowerCase() !== "z") {
        return;
      }

      event.preventDefault();
      if (event.shiftKey) {
        handleRedoRef.current();
      } else {
        handleUndoRef.current();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const updateSlides = (
    updater: (slides: Slide[]) => Slide[],
    options?: { recordHistory?: boolean }
  ) => {
    if (options?.recordHistory !== false) {
      pushHistorySnapshot();
    }
    setSlides((current) => updater(current).map(stripLegacyAccentArtifactsFromSlide));
  };

  const updateSlide = (
    slideId: string,
    updater: (slide: Slide) => Slide,
    options?: { recordHistory?: boolean }
  ) => {
    if (options?.recordHistory !== false) {
      pushHistorySnapshot();
    }
    setSlides((current) =>
      current.map((slide) =>
        slide.id === slideId
          ? stripLegacyAccentArtifactsFromSlide(updater(slide))
          : stripLegacyAccentArtifactsFromSlide(slide)
      )
    );
  };

  const updateSlideWithContext = (
    slideId: string,
    updater: (slide: Slide, context: { index: number; total: number }) => Slide,
    options?: { recordHistory?: boolean }
  ) => {
    if (options?.recordHistory !== false) {
      pushHistorySnapshot();
    }
    setSlides((current) => {
      const total = current.length;
      return current.map((slide, index) =>
        slide.id === slideId
          ? stripLegacyAccentArtifactsFromSlide(updater(slide, { index, total }))
          : stripLegacyAccentArtifactsFromSlide(slide)
      );
    });
  };

  const updateActiveSlide = (
    updater: (slide: Slide) => Slide,
    options?: { recordHistory?: boolean }
  ) => {
    if (!activeSlide) {
      return;
    }

    updateSlide(activeSlide.id, updater, options);
  };

  const updateElementBySlide = (
    slideId: string,
    elementId: string,
    updater: (element: CanvasElement) => CanvasElement,
    options?: { recordHistory?: boolean }
  ) => {
    updateSlideWithContext(slideId, (slide, context) => {
      const previous = slide.elements.find((element) => element.id === elementId);
      const nextElements = slide.elements.map((element) =>
        element.id === elementId ? updater(element) : element
      );
      const next = nextElements.find((element) => element.id === elementId);

      const isManagedTextPair =
        previous?.type === "text" &&
        next?.type === "text" &&
        Boolean(next.metaKey && MANAGED_TEXT_META_KEYS.has(next.metaKey));

      const shouldReflowManagedText =
        isManagedTextPair &&
        (previous.text !== next.text ||
          JSON.stringify(previous.highlights ?? []) !== JSON.stringify(next.highlights ?? []) ||
          previous.x !== next.x ||
          previous.y !== next.y ||
          previous.width !== next.width ||
          previous.fontSize !== next.fontSize ||
          previous.fontFamily !== next.fontFamily ||
          previous.fontStyle !== next.fontStyle ||
          previous.lineHeight !== next.lineHeight ||
          previous.letterSpacing !== next.letterSpacing ||
          previous.align !== next.align ||
          previous.textDecoration !== next.textDecoration ||
          previous.fill !== next.fill);

      if (shouldReflowManagedText) {
        const preservedBackground = slide.background;
        const preservedGridElements = nextElements.filter(
          (element) => element.type === "shape" && element.metaKey === "decor-grid-line"
        );
        const managedTextSnapshot = new Map<
          string,
          Pick<
            TextElement,
            | "x"
            | "y"
            | "width"
            | "fontSize"
            | "fontFamily"
            | "fontStyle"
            | "fill"
            | "align"
            | "lineHeight"
            | "letterSpacing"
            | "textDecoration"
            | "highlights"
          >
        >();

        nextElements.forEach((element) => {
          if (
            element.type === "text" &&
            element.metaKey &&
            MANAGED_TEXT_META_KEYS.has(element.metaKey)
          ) {
            managedTextSnapshot.set(element.metaKey, {
              x: element.x,
              y: element.y,
              width: element.width,
              fontSize: element.fontSize,
              fontFamily: element.fontFamily,
              fontStyle: element.fontStyle,
              fill: element.fill,
              align: element.align,
              lineHeight: element.lineHeight,
              letterSpacing: element.letterSpacing,
              textDecoration: element.textDecoration,
              highlights: normalizeHighlightRangesForText(element.highlights, element.text)
            });
          }
        });

        const rebuiltSlide = applyTemplateToSlide(
          {
            ...slide,
            elements: nextElements
          },
          slide.templateId ?? "light",
          context.index,
          context.total,
          slideFormat
        );
        const rebuiltWithPinnedPosition = rebuiltSlide.elements.map((element) => {
          if (element.type !== "text" || !element.metaKey) {
            return element;
          }

          const snapshot = managedTextSnapshot.get(element.metaKey);
          if (!snapshot) {
            return element;
          }

          return {
            ...element,
            x: snapshot.x,
            y: snapshot.y,
            width: snapshot.width,
            // Keep visual style/position from all managed text elements,
            // while preserving rebuilt auto-height/content.
            fontSize: snapshot.fontSize,
            fontFamily: snapshot.fontFamily,
            fontStyle: snapshot.fontStyle,
            fill: snapshot.fill,
            align: snapshot.align,
            lineHeight: snapshot.lineHeight,
            letterSpacing: snapshot.letterSpacing,
            textDecoration: snapshot.textDecoration,
            highlights: snapshot.highlights
          };
        });
        const rebuiltWithoutGrid = rebuiltWithPinnedPosition.filter(
          (element) => !(element.type === "shape" && element.metaKey === "decor-grid-line")
        );
        const rebuiltWithPreservedStyle = [
          ...preservedGridElements,
          ...rebuiltWithoutGrid
        ];

        if (next.metaKey) {
          const replacement = rebuiltWithPreservedStyle.find(
            (element) => element.type === next.type && element.metaKey === next.metaKey
          );

          if (selectedElementId === elementId) {
            setSelectedElementId(replacement?.id ?? null);
          }

          if (editingTextElementId === elementId && replacement?.type === "text") {
            setEditingTextElementId(replacement.id);
            editingTextElementIdRef.current = replacement.id;
          }
        }

        return {
          ...rebuiltSlide,
          background: preservedBackground,
          elements: rebuiltWithPreservedStyle
        };
      }

      return {
        ...slide,
        elements: nextElements
      };
    }, options);
  };

  const updateElement = (
    elementId: string,
    updater: (element: CanvasElement) => CanvasElement,
    options?: { recordHistory?: boolean }
  ) => {
    if (!activeSlide) {
      return;
    }

    updateElementBySlide(activeSlide.id, elementId, updater, options);
  };

  const openMobileGeneratePanel = (focusTopic = false) => {
    const panel = mobileGeneratePanelRef.current;
    if (!panel) {
      return;
    }

    if (!panel.open) {
      panel.open = true;
    }

    if (!focusTopic) {
      return;
    }

    window.setTimeout(() => {
      mobileGenerateTopicRef.current?.focus();
    }, 20);
  };

  const handleGenerate = async (options?: { openPostTool?: boolean; source?: "editor" | "mobile" }) => {
    if (isGenerating) {
      return;
    }

    if (isExportRendering) {
      setStatus(EXPORT_LOCK_STATUS);
      return;
    }

    const normalizedTopic = topic.trim();

    if (!normalizedTopic) {
      setStatus("Введите тему карусели.");
      return;
    }

    if (normalizedTopic.length < MIN_TOPIC_CHARS) {
      setStatus(`Тема слишком короткая. Минимум ${MIN_TOPIC_CHARS} символа.`);
      return;
    }

    if (normalizedTopic.length > MAX_TOPIC_CHARS) {
      setStatus(`Тема слишком длинная. Максимум ${MAX_TOPIC_CHARS} символов.`);
      return;
    }

    const requestId = generateRequestRef.current + 1;
    generateRequestRef.current = requestId;
    const requestedSlidesCount = clampSlidesCount(slidesCount);
    const source = options?.source ?? "editor";
    const openPostTool = Boolean(options?.openPostTool);
    let controller: AbortController | null = null;

    try {
      setIsGenerating(true);
      setStatus(
        `Генерирую структуру через OpenAI (${requestedSlidesCount} слайдов, формат ${slideFormat})...`
      );
      trackEvent({
        name: "generate_started",
        payload: {
          source,
          format: slideFormat,
          slidesCount: requestedSlidesCount,
          promptVariant,
          openPostTool
        }
      });
      const activeController = new AbortController();
      controller = activeController;
      generateAbortRef.current = activeController;
      const timeoutId = window.setTimeout(() => activeController.abort(), GENERATE_TIMEOUT_MS);

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          topic: normalizedTopic,
          slidesCount: requestedSlidesCount,
          niche,
          audience,
          tone,
          goal,
          format: slideFormat,
          theme: activeTemplateId,
          promptVariant
        }),
        signal: activeController.signal
      }).finally(() => {
        window.clearTimeout(timeoutId);
      });

      let data: {
        slides?: CarouselOutlineSlide[];
        project?: {
          promptVariant?: "A" | "B";
        };
        error?: string;
      };
      try {
        data = (await response.json()) as {
          slides?: CarouselOutlineSlide[];
          project?: {
            promptVariant?: "A" | "B";
          };
          error?: string;
        };
      } catch {
        throw new Error("Сервер вернул некорректный ответ. Попробуйте ещё раз.");
      }

      if (requestId !== generateRequestRef.current) {
        return;
      }

      if (!response.ok || !data.slides) {
        throw new Error(data.error || "Не удалось получить ответ от AI.");
      }

      const nextSlides = createSlidesFromOutline(
        data.slides,
        activeTemplateId,
        slideFormat,
        requestedSlidesCount
      );
      pushHistorySnapshot(true);
      setSlides(nextSlides);
      setActiveSlideId(nextSlides[0]?.id ?? null);
      setSelectedElementId(null);
      setEditingTextElementId(null);
      setCaptionResult(null);
      setPromptVariant(data.project?.promptVariant === "A" ? "A" : "B");
      setIsGeneratePanelVisible(false);
      trackEvent({
        name: "generate_succeeded",
        payload: {
          source,
          format: slideFormat,
          slidesCount: nextSlides.length,
          promptVariant: data.project?.promptVariant ?? "B",
          openPostTool
        }
      });
      if (openPostTool && window.innerWidth <= MOBILE_BREAKPOINT) {
        setMobileToolTab("post");
        setStatus(`Создано ${nextSlides.length} слайдов. Открыта вкладка «Пост».`);
      } else {
        setStatus(`Создано ${nextSlides.length} слайдов в формате ${slideFormat}.`);
      }
    } catch (error) {
      trackEvent({
        name: "generate_failed",
        payload: {
          source,
          format: slideFormat,
          reason: error instanceof Error ? error.message.slice(0, 120) : "unknown",
          openPostTool
        }
      });
      if (requestId === generateRequestRef.current) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setStatus("Генерация заняла слишком много времени. Попробуйте ещё раз.");
        } else {
          setStatus(resolveUserFacingError(error, "Ошибка генерации. Попробуйте снова."));
        }
      }
    } finally {
      if (requestId === generateRequestRef.current) {
        setIsGenerating(false);
      }
      if (controller && generateAbortRef.current === controller) {
        generateAbortRef.current = null;
      }
    }
  };

  const handleInsertSlideAt = (
    index: number,
    slideType: "text" | "image_text" | "big_text" = "text"
  ) => {
    if (generationLocked) {
      setStatus(isGenerating ? GENERATE_LOCK_STATUS : EXPORT_LOCK_STATUS);
      return;
    }

    const nextSlide = createBlankSlide(
      index,
      activeTemplateId,
      slideFormat,
      slides.length + 1,
      slideType
    );
    pushHistorySnapshot(true);
    setSlides((current) => {
      const next = [...current];
      next.splice(index, 0, nextSlide);
      return syncSlideOrderMeta(next);
    });

    setActiveSlideId(nextSlide.id);
    setSelectedElementId(null);
    setStatus("Новый слайд вставлен в поток.");
  };

  const handleDeleteSlide = (slideId = activeSlideId ?? "") => {
    if (generationLocked) {
      setStatus(isGenerating ? GENERATE_LOCK_STATUS : EXPORT_LOCK_STATUS);
      return;
    }

    const targetSlide = slides.find((slide) => slide.id === slideId);

    if (!targetSlide || slides.length <= 1) {
      setStatus("Нельзя удалить последний слайд.");
      return;
    }

    const currentIndex = slides.findIndex((slide) => slide.id === slideId);
    const fallbackSlide = slides[currentIndex + 1] ?? slides[currentIndex - 1] ?? null;

    pushHistorySnapshot(true);
    setSlides((current) =>
      syncSlideOrderMeta(current.filter((slide) => slide.id !== slideId))
    );
    if (activeSlideId === slideId) {
      setActiveSlideId(fallbackSlide?.id ?? null);
      setSelectedElementId(null);
    }
    setStatus(`Слайд ${currentIndex + 1} удалён.`);
  };

  const handleDeleteElement = () => {
    if (generationLocked) {
      return;
    }

    if (!activeSlide || !selectedElementId) {
      return;
    }

    updateSlide(activeSlide.id, (slide) => ({
      ...slide,
      elements: slide.elements.filter((element) => element.id !== selectedElementId)
    }));
    setSelectedElementId(null);
    setEditingTextElementId(null);
    setStatus("Элемент удалён.");
  };

  const handleAddText = (slideId = activeSlideId ?? "") => {
    if (generationLocked) {
      setStatus(isGenerating ? GENERATE_LOCK_STATUS : EXPORT_LOCK_STATUS);
      return;
    }

    const element = createTextElement({
      role: "body",
      text: "Новый текст",
      x: 120,
      y: Math.max(120, slideDimensions.height - 320),
      width: 760,
      height: 140,
      fontSize: slideFormat === "9:16" ? 34 : 36,
      fill: "#1f2a2d",
      fontFamily: "Inter"
    });

    updateSlide(slideId, (slide) => ({
      ...slide,
      elements: [...slide.elements, element]
    }));
    setActiveSlideId(slideId);
    setSelectedElementId(element.id);
  };

  const openFilePicker = (input: HTMLInputElement | null) => {
    if (!input) {
      return;
    }
    input.value = "";
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch {
        // fallback to click below
      }
    }
    input.click();
  };

  const handleAddImage = (slideId = activeSlideId ?? "") => {
    if (generationLocked) {
      setStatus(isGenerating ? GENERATE_LOCK_STATUS : EXPORT_LOCK_STATUS);
      return;
    }

    setPendingImageSlideId(slideId);
    openFilePicker(imageInputRef.current);
  };

  const handleAddBackgroundImage = (slideId = activeSlideId ?? "") => {
    if (generationLocked) {
      setStatus(isGenerating ? GENERATE_LOCK_STATUS : EXPORT_LOCK_STATUS);
      return;
    }

    setPendingBackgroundSlideId(slideId);
    openFilePicker(backgroundImageInputRef.current);
  };

  const handleImageSelected = async (file: File | null) => {
    if (!file) {
      setPendingImageSlideId(null);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
      return;
    }

    try {
      const dataUrl = await fileToOptimizedDataUrl(file);
      const targetSlideId = pendingImageSlideId ?? activeSlideId;

      if (!targetSlideId) {
        throw new Error("Не найден слайд для добавления изображения.");
      }

      const targetSlide = slides.find((slide) => slide.id === targetSlideId) ?? null;

      if (!targetSlide) {
        throw new Error("Не найден слайд для добавления изображения.");
      }

      const imageMeta = await readImageMeta(dataUrl);
      const imageWidth = 200;
      const imageHeight = 200;
      const element = createImageElement(dataUrl, {
        width: imageWidth,
        height: imageHeight,
        x: Math.round((slideDimensions.width - imageWidth) / 2),
        y: Math.round((slideDimensions.height - imageHeight) / 2),
        fitMode: "cover",
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        naturalWidth: imageMeta.width,
        naturalHeight: imageMeta.height
      });

      updateSlide(targetSlideId, (slide) => ({
        ...slide,
        elements: [...slide.elements, element]
      }));
      setSelectedElementId(element.id);

      setActiveSlideId(targetSlideId);
      trackEvent({
        name: "asset_uploaded",
        payload: {
          source: "slide_photo",
          format: slideFormat,
          slideType: targetSlide.slideType ?? "text"
        }
      });
      setStatus(`Изображение "${file.name}" добавлено в макет.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось добавить изображение.");
    } finally {
      setPendingImageSlideId(null);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  };

  const handleBackgroundImageSelected = async (file: File | null) => {
    if (!file) {
      setPendingBackgroundSlideId(null);
      if (backgroundImageInputRef.current) {
        backgroundImageInputRef.current.value = "";
      }
      return;
    }

    try {
      const dataUrl = await fileToOptimizedDataUrl(file);
      const targetSlideId = pendingBackgroundSlideId ?? activeSlideId;

      if (!targetSlideId) {
        throw new Error("Не найден слайд для фона.");
      }

      const slideIndex = slides.findIndex((slide) => slide.id === targetSlideId);
      if (slideIndex === -1) {
        throw new Error("Не найден слайд для фона.");
      }

      updateSlide(targetSlideId, (slide) =>
        ({
          ...setSlideBackgroundImage(slide, dataUrl, slideIndex, slides.length, slideFormat),
          photoSlotEnabled: true
        })
      );

      setActiveSlideId(targetSlideId);
      setSelectedElementId(null);
      trackEvent({
        name: "asset_uploaded",
        payload: {
          source: "slide_background",
          format: slideFormat
        }
      });
      setStatus(`Фон "${file.name}" добавлен.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось добавить фоновое изображение.");
    } finally {
      setPendingBackgroundSlideId(null);
      if (backgroundImageInputRef.current) {
        backgroundImageInputRef.current.value = "";
      }
    }
  };

  const handlePhotoSlotToggle = (enabled: boolean, slideId = activeSlideId ?? "") => {
    if (generationLocked) {
      setStatus(isGenerating ? GENERATE_LOCK_STATUS : EXPORT_LOCK_STATUS);
      return;
    }

    if (!slideId) {
      return;
    }

    const slideIndex = slides.findIndex((slide) => slide.id === slideId);
    if (slideIndex === -1) {
      return;
    }

    updateSlide(slideId, (slide) => {
      const normalizedSlideType = enabled
        ? "image_text"
        : slide.slideType === "image_text"
          ? slide.slideType
          : "image_text";

      return applyTemplateToSlide(
        {
          ...slide,
          slideType: normalizedSlideType,
          photoSlotEnabled: enabled
        },
        slide.templateId ?? activeTemplateId,
        slideIndex,
        slides.length,
        slideFormat
      );
    });

    setSelectedElementId(null);
    setEditingTextElementId(null);
    trackEvent({
      name: "photo_slot_toggled",
      payload: {
        enabled,
        format: slideFormat,
        slideId
      }
    });
    setStatus(
      enabled
        ? "Фото-блок включен. Можно загрузить изображение."
        : "Фото-блок выключен: текстовый макет расширен автоматически."
    );
  };

  const handleApplyTemplate = (
    templateId: CarouselTemplateId,
    scope: "all" | "current" = "all"
  ) => {
    if (generationLocked) {
      setStatus(isGenerating ? GENERATE_LOCK_STATUS : EXPORT_LOCK_STATUS);
      return;
    }

    const templateName = getTemplate(templateId).name;

    pushHistorySnapshot(true);
    if (scope === "current" && activeSlide) {
      const slideIndex = slides.findIndex((slide) => slide.id === activeSlide.id);
      if (slideIndex >= 0) {
        setSlides((current) =>
          current.map((slide, index) =>
            index === slideIndex
              ? applyTemplateToSlide(slide, templateId, index, current.length, slideFormat, {
                  syncHighlightColor: true
                })
              : slide
          )
        );
        setStatus(`Шаблон «${templateName}» применён к текущему слайду.`);
      }
    } else {
      setSlides((current) =>
        applyTemplateToSlides(current, templateId, slideFormat, { syncHighlightColor: true })
      );
      setStatus(`Шаблон «${templateName}» применён ко всей карусели.`);
    }

    const nextTemplate = getTemplate(templateId);
    setSelectedTextHighlightColorOverride(
      normalizeColorForInput(nextTemplate.highlightColor ?? nextTemplate.accent, DEFAULT_HIGHLIGHT_COLOR)
    );
    if (typeof nextTemplate.highlightOpacity === "number") {
      setSelectedTextHighlightOpacityOverride(
        Math.max(0.08, Math.min(1, nextTemplate.highlightOpacity))
      );
    }

    setSelectedElementId(null);
    setEditingTextElementId(null);
  };

  const handleOpenTemplateModal = () => {
    if (generationLocked) {
      setStatus(isGenerating ? GENERATE_LOCK_STATUS : EXPORT_LOCK_STATUS);
      return;
    }

    setIsTemplateModalOpen(true);
  };

  const handleOpenSlideExportModal = () => {
    if (isGenerating) {
      setStatus(GENERATE_LOCK_STATUS);
      return;
    }

    if (isExportRendering) {
      setStatus(EXPORT_LOCK_STATUS);
      return;
    }

    if (!slides.length) {
      setStatus("Добавьте хотя бы один слайд перед экспортом.");
      return;
    }

    setSelectedExportSlideIds(slides.map((slide) => slide.id));
    setIsSlideExportModalOpen(true);
  };

  const handleToggleExportSlide = (slideId: string) => {
    setSelectedExportSlideIds((current) => {
      const selected = new Set(current);
      if (selected.has(slideId)) {
        selected.delete(slideId);
      } else {
        selected.add(slideId);
      }

      return slides
        .map((slide) => slide.id)
        .filter((orderedSlideId) => selected.has(orderedSlideId));
    });
  };

  const handleToggleAllExportSlides = () => {
    setSelectedExportSlideIds((current) =>
      current.length === slides.length ? [] : slides.map((slide) => slide.id)
    );
  };

  const handleConfirmSlideExport = () => {
    if (!selectedExportSlideIds.length) {
      setStatus("Выберите хотя бы один слайд для экспорта.");
      return;
    }

    setIsSlideExportModalOpen(false);
    void handleExport(selectedExportSlideIds);
  };

  const handleFormatChange = (format: SlideFormat) => {
    if (generationLocked) {
      setStatus(isGenerating ? GENERATE_LOCK_STATUS : EXPORT_LOCK_STATUS);
      return;
    }

    if (format === slideFormat) {
      return;
    }

    pushHistorySnapshot(true);
    setSlides((current) => relayoutSlidesForFormat(current, slideFormat, format));
    setSlideFormat(format);
    setSelectedElementId(null);
    setEditingTextElementId(null);
    setStatus(`Формат переключён на ${format}.`);
  };

  const handleUpdateFooter = (
    updates: Partial<Pick<Slide, "profileHandle" | "profileSubtitle">>
  ) => {
    if (generationLocked) {
      return;
    }

    if (!activeSlide || activeSlideIndex === -1) {
      return;
    }

    updateSlide(activeSlide.id, (slide) =>
      updateSlideFooter(slide, updates, activeSlideIndex, slides.length, slideFormat)
    );
    setSelectedElementId(null);
    setEditingTextElementId(null);
  };

  const handleToggleSubtitleAcrossSlides = (visible: boolean) => {
    if (generationLocked) {
      setStatus(isGenerating ? GENERATE_LOCK_STATUS : EXPORT_LOCK_STATUS);
      return;
    }

    pushHistorySnapshot(true);
    setSlides((current) =>
      current.map((slide, index, items) =>
        updateSlideFooter(
          slide,
          {
            profileSubtitle: visible
              ? normalizeProfileSubtitleForUi(slide.profileSubtitle ?? "") || "Подпись"
              : ""
          },
          index,
          items.length,
          slideFormat
        )
      )
    );
    setStatus(
      visible
        ? "Подпись включена на всех слайдах."
        : "Подпись скрыта на всех слайдах."
    );
  };

  const handleGenerateCaption = async () => {
    if (generationLocked || isGeneratingCaption) {
      setStatus("Дождитесь завершения текущей операции и повторите.");
      return;
    }

    const normalizedTopic = topic.trim();
    if (!normalizedTopic || normalizedTopic.length < MIN_TOPIC_CHARS) {
      setStatus("Подпись недоступна: сначала задайте тему карусели.");
      return;
    }

    const outline = buildOutlineFromSlides(slides);
    if (!outline.length) {
      setStatus("Подпись недоступна: сначала сгенерируйте карусель.");
      return;
    }

    try {
      setIsGeneratingCaption(true);
      setStatus("Генерирую подпись к посту...");

      const response = await fetch("/api/caption", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          topic: normalizedTopic,
          niche,
          audience,
          tone,
          goal,
          slides: outline
        })
      });

      const data = (await response.json()) as {
        caption?: CarouselPostCaption;
        error?: string;
      };

      if (!response.ok || !data.caption) {
        throw new Error(data.error || "Не удалось сгенерировать подпись.");
      }

      setCaptionResult(data.caption);
      trackEvent({
        name: "caption_generated",
        payload: {
          format: slideFormat,
          slidesCount: slides.length
        }
      });
      setStatus("Подпись к посту готова.");
    } catch (error) {
      setStatus(resolveUserFacingError(error, "Ошибка генерации подписи. Попробуйте снова."));
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const handleCopyCaption = async () => {
    if (!captionResult) {
      return;
    }

    const ctaLines = [
      captionResult.cta,
      captionResult.ctaSoft && captionResult.ctaSoft !== captionResult.cta
        ? `Soft CTA: ${captionResult.ctaSoft}`
        : "",
      captionResult.ctaAggressive && captionResult.ctaAggressive !== captionResult.cta
        ? `Aggressive CTA: ${captionResult.ctaAggressive}`
        : ""
    ]
      .filter(Boolean)
      .join("\n");

    const text = `${captionResult.text}\n\n${ctaLines}\n\n${captionResult.hashtags.join(" ")}`.trim();

    try {
      await navigator.clipboard.writeText(text);
      trackEvent({
        name: "caption_copied",
        payload: {
          length: text.length
        }
      });
      setStatus("Подпись скопирована в буфер обмена.");
    } catch {
      setStatus("Не удалось скопировать подпись. Попробуйте вручную.");
    }
  };

  const updateSelectedTextElement = (
    updater: (element: TextElement) => TextElement,
    options?: { recordHistory?: boolean }
  ) => {
    if (!effectiveSelectedTextElement) {
      return;
    }

    updateElement(
      effectiveSelectedTextElement.id,
      (element) => (element.type === "text" ? updater(element) : element),
      options
    );
  };

  const resolveSelectedRangeFromActiveField = () => {
    if (typeof document === "undefined") {
      return null;
    }

    const active = document.activeElement;
    if (!(active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement)) {
      return null;
    }

    if (active instanceof HTMLInputElement) {
      const selectionUnsafeTypes = new Set([
        "color",
        "date",
        "datetime-local",
        "month",
        "time",
        "week",
        "file",
        "range",
        "checkbox",
        "radio",
        "button",
        "submit",
        "reset"
      ]);
      if (selectionUnsafeTypes.has(active.type.toLowerCase())) {
        return null;
      }
    }

    let start: number | null = null;
    let end: number | null = null;
    try {
      start = active.selectionStart;
      end = active.selectionEnd;
    } catch {
      return null;
    }

    if (typeof start !== "number" || typeof end !== "number" || end <= start) {
      return null;
    }

    return {
      start: Math.max(0, Math.floor(start)),
      end: Math.max(0, Math.floor(end))
    };
  };

  const resolveSelectedRange = () => {
    const sourceSelection =
      selectedTextSelection ?? selectedTextSelectionRef.current ?? resolveSelectedRangeFromActiveField();
    if (!effectiveSelectedTextElement || !sourceSelection) {
      return null;
    }

    const isEditingSelectedElement =
      editingTextElementIdRef.current !== null &&
      editingTextElementIdRef.current === effectiveSelectedTextElement.id;
    const sourceTextLength = isEditingSelectedElement
      ? editingValueRef.current.replace(/\r/g, "").length
      : effectiveSelectedTextElement.text.length;

    const start = Math.max(0, Math.min(sourceTextLength, sourceSelection.start));
    const end = Math.max(0, Math.min(sourceTextLength, sourceSelection.end));
    if (end <= start) {
      return null;
    }

    const normalizedSelection = { start, end };
    selectedTextSelectionRef.current = normalizedSelection;
    return normalizedSelection;
  };

  const selectedHighlightColor = normalizeColorForInput(
    effectiveSelectedTextElement?.highlights?.find((range) => range.end > range.start)?.color ??
      selectedTextHighlightColorOverride,
    DEFAULT_HIGHLIGHT_COLOR
  );
  const selectedHighlightOpacity =
    effectiveSelectedTextElement?.highlights?.find((range) => range.end > range.start)?.opacity ??
    selectedTextHighlightOpacityOverride;

  const handleSelectedTextSelectionChange = (start: number, end: number) => {
    if (!effectiveSelectedTextElement) {
      setSelectedTextSelection(null);
      selectedTextSelectionRef.current = null;
      return;
    }

    const isEditingSelectedElement =
      editingTextElementIdRef.current !== null &&
      editingTextElementIdRef.current === effectiveSelectedTextElement.id;
    const sourceTextLength = isEditingSelectedElement
      ? editingValueRef.current.replace(/\r/g, "").length
      : effectiveSelectedTextElement.text.length;

    const normalizedStart = Math.max(0, Math.min(sourceTextLength, start));
    const normalizedEnd = Math.max(0, Math.min(sourceTextLength, end));
    if (normalizedEnd <= normalizedStart) {
      setSelectedTextSelection(null);
      selectedTextSelectionRef.current = null;
      return;
    }

    const nextSelection = {
      start: normalizedStart,
      end: normalizedEnd
    };
    selectedTextSelectionRef.current = nextSelection;
    setSelectedTextSelection(nextSelection);
  };

  const handleApplyHighlightToSelection = (color?: string, opacity?: number) => {
    if (!effectiveSelectedTextElement) {
      return;
    }

    const isEditingSelectedElement =
      editingTextElementIdRef.current !== null &&
      editingTextElementIdRef.current === effectiveSelectedTextElement.id;
    const sourceText = isEditingSelectedElement
      ? editingValueRef.current.replace(/\r/g, "")
      : effectiveSelectedTextElement.text;
    const textLength = sourceText.length;
    const rawRange = resolveSelectedRange();
    if (!rawRange) {
      setStatus("Выделите фрагмент текста, чтобы добавить акцент.");
      return;
    }
    const selectedRange = {
      start: Math.max(0, Math.min(textLength, rawRange.start)),
      end: Math.max(0, Math.min(textLength, rawRange.end))
    };
    if (selectedRange.end <= selectedRange.start) {
      setStatus("Выделите фрагмент текста, чтобы добавить акцент.");
      return;
    }

    const nextColor = color || selectedHighlightColor || DEFAULT_HIGHLIGHT_COLOR;
    const nextOpacity = Math.max(0.08, Math.min(1, opacity ?? selectedHighlightOpacity ?? 0.94));
    updateElement(effectiveSelectedTextElement.id, (element) => {
      if (element.type !== "text") {
        return element;
      }
      const elementText = isEditingSelectedElement ? sourceText : element.text;
      const baseline = normalizeHighlightRanges(element.highlights, elementText.length);
      const withoutRange = removeHighlightRange(baseline, selectedRange.start, selectedRange.end);
      return {
        ...element,
        text: elementText,
        highlights: normalizeHighlightRanges(
          [
            ...withoutRange,
            {
              start: selectedRange.start,
              end: selectedRange.end,
              color: nextColor,
              opacity: nextOpacity
            }
          ],
          elementText.length
        )
      };
    });
  };

  const handleClearHighlightFromSelection = () => {
    const selectedRange = resolveSelectedRange();
    if (!selectedRange) {
      setStatus("Выделите фрагмент, чтобы убрать акцент.");
      return;
    }

    updateSelectedTextElement((element) => ({
      ...element,
      highlights: removeHighlightRange(
        normalizeHighlightRanges(element.highlights, element.text.length),
        selectedRange.start,
        selectedRange.end
      )
    }));
  };

  const handleClearAllHighlights = () => {
    if (!effectiveSelectedTextElement?.highlights?.length) {
      return;
    }

    updateSelectedTextElement((element) => ({
      ...element,
      highlights: []
    }));
  };

  const handleSelectedTextHighlightColorChange = (value: string) => {
    setSelectedTextHighlightColorOverride(value);
    const selectedRange = resolveSelectedRange();
    if (selectedRange) {
      handleApplyHighlightToSelection(value, selectedHighlightOpacity);
      return;
    }

    updateSelectedTextElement((element) => {
      const baseline = normalizeHighlightRanges(element.highlights, element.text.length);
      if (!baseline.length) {
        return element;
      }

      return {
        ...element,
        highlights: baseline.map((range) => ({
          ...range,
          color: value
        }))
      };
    });
  };

  const handleApplyHighlightColorToAllSlides = () => {
    const nextColor = normalizeColorForInput(selectedHighlightColor, DEFAULT_HIGHLIGHT_COLOR);
    updateSlides(
      (current) =>
        current.map((slide) => ({
          ...slide,
          elements: slide.elements.map((element) => {
            if (element.type !== "text") {
              return element;
            }

            const baseline = normalizeHighlightRanges(element.highlights, element.text.length);
            if (!baseline.length) {
              return element;
            }

            return {
              ...element,
              highlights: baseline.map((range) => ({
                ...range,
                color: nextColor
              }))
            };
          })
        })),
      { recordHistory: false }
    );
    setSelectedTextHighlightColorOverride(nextColor);
    setStatus("Цвет выделения применён ко всем слайдам.");
  };

  const handleSelectedTextHighlightOpacityChange = (value: number) => {
    const nextOpacity = Math.max(0.08, Math.min(1, Number.isFinite(value) ? value : 0.94));
    setSelectedTextHighlightOpacityOverride(nextOpacity);
    const selectedRange = resolveSelectedRange();
    if (selectedRange) {
      handleApplyHighlightToSelection(selectedHighlightColor, nextOpacity);
      return;
    }

    updateSelectedTextElement((element) => {
      const baseline = normalizeHighlightRanges(element.highlights, element.text.length);
      if (!baseline.length) {
        return element;
      }

      return {
        ...element,
        highlights: baseline.map((range) => ({
          ...range,
          opacity: nextOpacity
        }))
      };
    });
  };

  const handleSelectedTextChange = (value: string) => {
    updateSelectedTextElement((element) => {
      const nextText = value.replace(/\r/g, "");
      if (!nextText.trim()) {
        return element;
      }
      return {
        ...element,
        text: nextText,
        highlights: normalizeHighlightRangesForText(element.highlights, nextText)
      };
    }, { recordHistory: false });
    setSelectedTextSelection(null);
    selectedTextSelectionRef.current = null;
  };

  const handleSelectedTextColorChange = (value: string) => {
    updateSelectedTextElement(
      (element) => ({
        ...element,
        fill: value
      }),
      { recordHistory: false }
    );
  };

  const handleSelectedTextFontChange = (value: string) => {
    updateSelectedTextElement(
      (element) => ({
        ...element,
        fontFamily: value
      }),
      { recordHistory: false }
    );
  };

  const handleSelectedTextSizeChange = (value: number) => {
    const nextSize = Math.max(14, Math.min(96, Math.round(value)));
    updateSelectedTextElement(
      (element) => ({
        ...element,
        fontSize: nextSize
      }),
      { recordHistory: false }
    );
  };

  const handleSelectedTextCaseChange = (
    mode: "normal" | "uppercase" | "lowercase" | "capitalize"
  ) => {
    updateSelectedTextElement(
      (element) => ({
        ...element,
        text: transformTextCase(element.text, mode)
      }),
      { recordHistory: false }
    );
  };

  const handleCenterSelectedTextHorizontally = () => {
    if (!effectiveSelectedTextElement) {
      return;
    }

    const centeredX = Math.round((slideDimensions.width - effectiveSelectedTextElement.width) / 2);
    const minX = 8;
    const maxX = Math.max(minX, slideDimensions.width - effectiveSelectedTextElement.width - 8);
    const nextX = Math.max(minX, Math.min(maxX, centeredX));

    updateElement(
      effectiveSelectedTextElement.id,
      (element) => (element.type === "text" ? { ...element, x: nextX } : element),
      { recordHistory: false }
    );
    setStatus("Текстовый блок выровнен по центру.");
  };

  const handleSelectedTextTargetRoleChange = (role: EditableTextTargetRole) => {
    setSelectedTextTargetRole(role);
    const nextTarget =
      role === "body"
        ? managedBodyTextElement ?? managedTitleTextElement
        : managedTitleTextElement ?? managedBodyTextElement;
    setSelectedElementId(nextTarget?.id ?? null);

    setSelectedTextSelection(null);
    selectedTextSelectionRef.current = null;
  };

  const handleApplyColorScheme = (
    mode: MobileColorSchemeMode,
    options?: { applyAll?: boolean }
  ) => {
    const currentSlide = activeSlide;
    if (!currentSlide) {
      return;
    }

    const applyOnSlide = (slide: Slide): Slide => {
      const editableTextElements = slide.elements.filter(
        (element): element is TextElement =>
          element.type === "text" && !NON_CONTENT_TEXT_META_KEYS.has(element.metaKey ?? "")
      );
      if (!editableTextElements.length) {
        return slide;
      }

      const preferredTitle =
        resolvePreferredManagedTextByMeta(slide, MANAGED_TITLE_META_KEY) ?? editableTextElements[0];
      const preferredBody =
        resolvePreferredManagedTextByMeta(slide, MANAGED_BODY_META_KEY) ??
        editableTextElements.find((element) => element.id !== preferredTitle?.id) ??
        preferredTitle;
      const palette = getTemplate(slide.templateId ?? activeTemplateId);
      const templateHighlightColor = normalizeColorForInput(
        palette.highlightColor ?? palette.accent,
        DEFAULT_HIGHLIGHT_COLOR
      );
      const templateHighlightOpacity =
        typeof palette.highlightOpacity === "number"
          ? Math.max(0.08, Math.min(1, palette.highlightOpacity))
          : undefined;
      const singleToneColor = selectedHighlightColor || templateHighlightColor;
      const nextHighlightColor =
        mode === "single" ? singleToneColor : templateHighlightColor;
      const nextHighlightOpacity = mode === "single" ? undefined : templateHighlightOpacity;

      return {
        ...slide,
        elements: slide.elements.map((element) => {
          if (element.type !== "text" || NON_CONTENT_TEXT_META_KEYS.has(element.metaKey ?? "")) {
            return element;
          }
          const isTitle = element.id === preferredTitle?.id;
          const baselineHighlights = normalizeHighlightRanges(element.highlights, element.text.length);
          return {
            ...element,
            fill:
              mode === "single"
                ? singleToneColor
                : isTitle
                  ? palette.titleColor
                  : palette.bodyColor,
            highlights: baselineHighlights.map((range) => {
              const nextRange = {
                ...range,
                color: nextHighlightColor
              };

              if (nextHighlightOpacity === undefined) {
                return nextRange;
              }

              return {
                ...nextRange,
                opacity: nextHighlightOpacity
              };
            })
          };
        })
      };
    };

    if (options?.applyAll) {
      updateSlides((current) => current.map(applyOnSlide), { recordHistory: false });
    } else {
      updateSlide(currentSlide.id, applyOnSlide, { recordHistory: false });
    }

    const currentTemplate = getTemplate(currentSlide.templateId ?? activeTemplateId);
    const currentTemplateHighlightColor = normalizeColorForInput(
      currentTemplate.highlightColor ?? currentTemplate.accent,
      DEFAULT_HIGHLIGHT_COLOR
    );
    setSelectedTextHighlightColorOverride(
      mode === "single"
        ? selectedHighlightColor || DEFAULT_HIGHLIGHT_COLOR
        : currentTemplateHighlightColor
    );
    setStatus(
      mode === "single"
        ? "Цветовая схема: единый цвет текста и выделения."
        : "Цветовая схема: раздельные цвета текста и выделения."
    );
  };

  const handleMobileToolTabChange = (nextTab: MobileToolTab | null) => {
    setMobileToolTab(nextTab);
    if (!nextTab) {
      return;
    }

    if (nextTab === "text" || nextTab === "font" || nextTab === "size" || nextTab === "color") {
      const preferredText =
        selectedTextTargetRole === "body"
          ? managedBodyTextElement ?? managedTitleTextElement
          : managedTitleTextElement ?? managedBodyTextElement;
      if (preferredText) {
        setSelectedElementId(preferredText.id);
      }
    }
  };

  const handleSlideBackgroundColorChange = (
    value: string,
    options?: { applyAll?: boolean }
  ) => {
    if (options?.applyAll) {
      updateSlides((current) =>
        current.map((slide) => ({
          ...slide,
          background: value
        })),
      { recordHistory: false });
      return;
    }

    if (!activeSlide) {
      return;
    }

    updateSlide(
      activeSlide.id,
      (slide) => ({
        ...slide,
        background: value
      }),
      { recordHistory: false }
    );
  };

  const handleActiveSlidePhotoSettingsChange = (updates: Partial<SlidePhotoSettings>) => {
    if (!activeSlide) {
      return;
    }

    updateSlide(
      activeSlide.id,
      (slide) => ({
        ...slide,
        photoSettings: normalizeSlidePhotoSettings({
          ...slide.photoSettings,
          ...updates
        })
      }),
      { recordHistory: false }
    );
  };

  const handleApplyStylePreset = (
    presetId: MobileStylePresetId,
    options?: { applyAll?: boolean }
  ) => {
    const preset = MOBILE_STYLE_PRESET_CONFIG[presetId];
    if (!preset) {
      return;
    }

    const applyOnSlide = (slide: Slide): Slide => {
      const withoutGrid = slide.elements.filter(
        (element) => !(element.type === "shape" && element.metaKey === "decor-grid-line")
      );
      if (!preset.gridVisible) {
        return {
          ...slide,
          background: preset.background,
          elements: withoutGrid
        };
      }

      const gridColor = resolveGridColorForBackground(preset.background);
      const nextGrid = buildGridDecorationElements(slideFormat, preset.gridMode, gridColor).map((element) => ({
        ...element,
        opacity: resolveGridElementOpacity(element)
      }));

      return {
        ...slide,
        background: preset.background,
        elements: [...withoutGrid, ...nextGrid]
      };
    };

    if (options?.applyAll) {
      updateSlides((current) => current.map(applyOnSlide), { recordHistory: false });
    } else if (activeSlide) {
      updateSlide(activeSlide.id, applyOnSlide, { recordHistory: false });
    }

    setStatus(`Применён стиль: ${presetId}.`);
  };

  const handleGridVisibilityChange = (
    enabled: boolean,
    options?: { applyAll?: boolean }
  ) => {
    const applyOnSlide = (slide: Slide) => {
      const hasGrid = slide.elements.some(
        (element) => element.type === "shape" && element.metaKey === "decor-grid-line"
      );

      if (!enabled) {
        if (!hasGrid) {
          return slide;
        }
        return {
          ...slide,
          elements: slide.elements.map((element) => {
            if (element.type !== "shape" || element.metaKey !== "decor-grid-line") {
              return element;
            }
            return {
              ...element,
              opacity: 0
            };
          })
        };
      }

      const inferredMode = inferGridModeFromSlide(slide) ?? "full";
      const gridColor = resolveGridColorForBackground(slide.background);
      if (!hasGrid) {
        const nextGrid = buildGridDecorationElements(slideFormat, inferredMode, gridColor).map((element) => ({
          ...element,
          opacity: resolveGridElementOpacity(element)
        }));
        return {
          ...slide,
          elements: [...slide.elements, ...nextGrid]
        };
      }

      return {
        ...slide,
        elements: slide.elements.map((element) => {
          if (element.type !== "shape" || element.metaKey !== "decor-grid-line") {
            return element;
          }
          return {
            ...element,
            fill: gridColor,
            opacity:
              (element.opacity ?? 0) > 0.04
                ? element.opacity ?? resolveGridElementOpacity(element)
                : resolveGridElementOpacity(element)
          };
        })
      };
    };

    if (options?.applyAll) {
      updateSlides((current) => current.map(applyOnSlide), { recordHistory: false });
      return;
    }

    if (!activeSlide) {
      return;
    }

    updateSlide(activeSlide.id, applyOnSlide, { recordHistory: false });
  };

  const handleStartTextEditing = (slideId: string, elementId: string) => {
    if (generationLocked) {
      return;
    }

    const targetSlide = slides.find((slide) => slide.id === slideId);
    const textElement = targetSlide?.elements.find(
      (element): element is TextElement => element.id === elementId && element.type === "text"
    );

    if (!textElement) {
      return;
    }

    setActiveSlideId(slideId);
    setSelectedElementId(elementId);
    setSelectedTextSelection(null);
    selectedTextSelectionRef.current = null;
    editingTextElementIdRef.current = null;
    editingDirtyRef.current = false;
    editingValueRef.current = "";
    setEditingTextElementId(null);
    setEditingValue("");
  };

  const handleEditingValueChange = (value: string) => {
    editingDirtyRef.current = true;
    editingValueRef.current = value;
    setEditingValue(value);
  };

  const handleCommitTextEditing = (nextValue?: string) => {
    if (generationLocked) {
      return;
    }

    const targetElementId = editingTextElementIdRef.current;
    if (!targetElementId) {
      return;
    }
    editingTextElementIdRef.current = null;
    const resolvedValue = (nextValue ?? editingValueRef.current).replace(/\r/g, "");
    const shouldKeepPrevious = resolvedValue.trim().length === 0;

    updateElement(targetElementId, (element) => {
      if (element.type !== "text") {
        return element;
      }

      const nextText = shouldKeepPrevious ? element.text : resolvedValue;
      return {
        ...element,
        text: nextText,
        highlights: normalizeHighlightRangesForText(element.highlights, nextText)
      };
    });

    editingDirtyRef.current = false;
    editingValueRef.current = "";
    setEditingTextElementId(null);
    setEditingValue("");
    setStatus("Текст обновлён.");
  };

  const handleCancelTextEditing = () => {
    editingTextElementIdRef.current = null;
    editingDirtyRef.current = false;
    editingValueRef.current = "";
    setEditingTextElementId(null);
    setEditingValue("");
  };

  const handleMoveSlide = (slideId: string, direction: "up" | "down") => {
    if (generationLocked) {
      setStatus(isGenerating ? GENERATE_LOCK_STATUS : EXPORT_LOCK_STATUS);
      return;
    }

    const currentIndex = slides.findIndex((slide) => slide.id === slideId);

    if (currentIndex === -1) {
      return;
    }

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= slides.length) {
      return;
    }

    const targetSlide = slides[targetIndex];
    pushHistorySnapshot(true);
    setSlides((current) => reorderSlides(current, slideId, targetSlide.id));
    setStatus("Порядок слайдов обновлён.");
  };

  const handleSelectSlide = (
    slideId: string,
    options?: {
      syncCanvas?: boolean;
      preserveSelection?: boolean;
      source?: "list" | "canvas" | "swipe" | "tools" | "system";
    }
  ) => {
    if (generationLocked) {
      return;
    }

    if (editingTextElementIdRef.current && slideId !== activeSlideId) {
      handleCommitTextEditing();
    }

    if (slideId !== activeSlideId) {
      trackEvent({
        name: "slide_selected",
        payload: {
          source: options?.source ?? "tools",
          slideId,
          format: slideFormat
        }
      });
    }

    setActiveSlideId(slideId);
    if (options?.syncCanvas) {
      setScrollToSlideRequest({
        id: slideId,
        token: Date.now()
      });
    }

    if (!options?.preserveSelection) {
      setSelectedElementId(null);
    }
  };

  const handleSelectElement = (slideId: string, elementId: string | null) => {
    if (generationLocked) {
      return;
    }

    if (editingTextElementIdRef.current && elementId !== editingTextElementIdRef.current) {
      handleCommitTextEditing();
    }

    setActiveSlideId(slideId);
    setSelectedElementId(elementId);
  };

  const handleVisibleSlideChange = (slideId: string) => {
    if (generationLocked || slideId === activeSlideId) {
      return;
    }

    trackEvent({
      name: "slide_selected",
      payload: {
        source: "canvas",
        slideId,
        format: slideFormat
      }
    });

    setActiveSlideId(slideId);
    setSelectedElementId(null);
    if (editingTextElementIdRef.current) {
      handleCommitTextEditing();
    }
  };

  const handleResetSession = () => {
    if (generationLocked) {
      setStatus("Дождитесь завершения текущей операции и повторите.");
      return;
    }

    const starterSlides = createStarterSlides("light", slideFormat);
    pushHistorySnapshot(true);
    setSlides(starterSlides);
    setTopic("");
    setPromptVariant("B");
    setSlidesCount(DEFAULT_SLIDES_COUNT);
    setNiche("");
    setAudience("");
    setTone("balanced");
    setGoal("engagement");
    setCaptionResult(null);
    setActiveSlideId(starterSlides[0]?.id ?? null);
    setSelectedElementId(null);
    setEditingTextElementId(null);
    editingTextElementIdRef.current = null;
    editingDirtyRef.current = false;
    editingValueRef.current = "";
    setEditingValue("");
    setMobileToolTab(null);
    setExportMode("zip");
    setIsGeneratePanelVisible(true);
    setStatus(DEFAULT_STATUS);
  };

  const handleUpdateElementPositionBySlide = (
    slideId: string,
    elementId: string,
    x: number,
    y: number
  ) => {
    if (generationLocked) {
      return;
    }

    setActiveSlideId(slideId);
    updateElementBySlide(slideId, elementId, (element) => ({ ...element, x, y }));
  };

  const handleTransformElementBySlide = (
    slideId: string,
    elementId: string,
    updates: Record<string, number>
  ) => {
    if (generationLocked) {
      return;
    }

    setActiveSlideId(slideId);
    updateElementBySlide(slideId, elementId, (element) => ({ ...element, ...updates }));
  };

  const getSlideDataUrl = async (slideId: string) => {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= EXPORT_CAPTURE_ATTEMPTS; attempt += 1) {
      const stage = exportStageRefs.current[slideId];

      if (!stage) {
        lastError = new Error("Экспортируемый слайд ещё не готов.");
        await waitForNextFrame();
        continue;
      }

      stage.draw();

      if (!areStageImagesReady(stage)) {
        lastError = new Error("Изображения ещё догружаются для экспорта.");
        await waitForNextFrame();
        continue;
      }

      const dataUrl = stage.toDataURL({ pixelRatio: 2 });
      if (dataUrl.startsWith("data:image/") && dataUrl.length > 1400) {
        return dataUrl;
      }

      lastError = new Error("Слайд экспортировался некорректно, пробую повторно.");
      await waitForNextFrame();
    }

    throw lastError ?? new Error("Не удалось подготовить слайд к экспорту.");
  };

  const ensureExportStagesReady = async (targetIds: string[]) => {
    let stageAttempts = 0;

    while (stageAttempts < 240) {
      const allStagesReady = targetIds.every((slideId) => Boolean(exportStageRefs.current[slideId]));

      if (allStagesReady) {
        await waitForNextFrame();
        break;
      }

      stageAttempts += 1;
      await waitForNextFrame();
    }

    if (stageAttempts >= 240) {
      throw new Error("Не удалось подготовить слайды к экспорту.");
    }

    let imageAttempts = 0;
    while (imageAttempts < 720) {
      const allImagesReady = targetIds.every((slideId) => {
        const stage = exportStageRefs.current[slideId];
        return stage ? areStageImagesReady(stage) : false;
      });

      if (allImagesReady) {
        targetIds.forEach((slideId) => {
          exportStageRefs.current[slideId]?.draw();
        });
        return true;
      }

      imageAttempts += 1;
      await waitForNextFrame();
    }

    return false;
  };

  const exportSlidesAsZip = async (
    targetSlideIds: string[],
    filenameSuffix = "slides",
    imageType: "png" | "jpg" = "png"
  ) => {
    const zip = new JSZip();

    for (let index = 0; index < targetSlideIds.length; index += 1) {
      const rawDataUrl = await getSlideDataUrl(targetSlideIds[index]);
      const exportDataUrl =
        imageType === "jpg" ? await convertDataUrlToJpeg(rawDataUrl) : rawDataUrl;
      const base64 = exportDataUrl.replace(/^data:image\/(?:png|jpeg);base64,/, "");
      zip.file(`slide${index + 1}.${imageType}`, base64, { base64: true });
    }

    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${slugify(projectTitleFromTopic(topic))}-${filenameSuffix}.zip`);
  };

  const handleExport = async (requestedSlideIds?: string[]) => {
    if (isGenerating) {
      setStatus(GENERATE_LOCK_STATUS);
      return;
    }

    if (isExportRendering) {
      return;
    }

    try {
      if (!slides.length) {
        return;
      }

      const exportFormat = slideFormat;
      const exportTemplateId = activeTemplateId;
      const exportSlides = prepareSlidesForExport(slides, exportTemplateId, exportFormat);
      const exportDimensions = SLIDE_FORMAT_DIMENSIONS[exportFormat];
      const pdfOrientation = exportDimensions.height >= exportDimensions.width ? "portrait" : "landscape";
      const selectedIds = requestedSlideIds?.length
        ? new Set(requestedSlideIds)
        : new Set(exportSlides.map((slide) => slide.id));
      const targetSlides = exportSlides.filter((slide) => selectedIds.has(slide.id));
      const targetSlideIds = targetSlides.map((slide) => slide.id);

      if (!targetSlideIds.length) {
        throw new Error("Выберите хотя бы один слайд для экспорта.");
      }

      trackEvent({
        name: "export_clicked",
        payload: {
          mode: exportMode,
          format: exportFormat,
          slides: targetSlideIds.length
        }
      });

      const firstExportSlideIndex = exportSlides.findIndex((slide) => slide.id === targetSlideIds[0]);

      setExportSnapshot({
        slides: exportSlides,
        slideFormat: exportFormat
      });
      setIsExportRendering(true);

      await waitForNextFrame();
      await waitForNextFrame();

      let lastAttemptError: unknown = null;

      for (let attempt = 1; attempt <= EXPORT_ATTEMPTS_MAX; attempt += 1) {
        try {
          setStatus(
            `Подготавливаю экспорт: ${exportModeLabel}, ${targetSlideIds.length} слайд(ов) (${attempt}/${EXPORT_ATTEMPTS_MAX}).`
          );
          await ensureFontsReadyForExport();

          const imagesReady = await ensureExportStagesReady(targetSlideIds);
          if (!imagesReady) {
            throw new Error(
              "Не удалось дождаться загрузки всех изображений для экспорта. Повторите попытку через несколько секунд."
            );
          }

          if (exportMode === "png" || exportMode === "jpg") {
            const imageType = exportMode === "jpg" ? "jpg" : "png";

            if (targetSlideIds.length === 1) {
              const rawDataUrl = await getSlideDataUrl(targetSlideIds[0]);
              const exportDataUrl =
                imageType === "jpg" ? await convertDataUrlToJpeg(rawDataUrl) : rawDataUrl;
              const blob = await dataUrlToBlob(exportDataUrl);
              const slideNumber = firstExportSlideIndex >= 0 ? firstExportSlideIndex + 1 : 1;
              saveAs(blob, `${slugify(projectTitleFromTopic(topic))}-slide${slideNumber}.${imageType}`);
              trackEvent({
                name: "export_succeeded",
                payload: {
                  mode: imageType,
                  format: exportFormat,
                  slides: 1
                }
              });
              setStatus(`${imageType.toUpperCase()} скачан.`);
              return;
            }

            await exportSlidesAsZip(
              targetSlideIds,
              imageType === "jpg" ? "slides-jpg" : "slides-png",
              imageType
            );
            trackEvent({
              name: "export_succeeded",
              payload: {
                mode: `${imageType}_zip`,
                format: exportFormat,
                slides: targetSlideIds.length
              }
            });
            setStatus(`${imageType.toUpperCase()} экспортирован архивом (${targetSlideIds.length} шт.).`);
            return;
          }

          if (exportMode === "pdf") {
            const pdf = new jsPDF({
              orientation: pdfOrientation,
              unit: "px",
              format: [exportDimensions.width, exportDimensions.height]
            });

            for (let index = 0; index < targetSlideIds.length; index += 1) {
              const dataUrl = await getSlideDataUrl(targetSlideIds[index]);

              if (index > 0) {
                pdf.addPage([exportDimensions.width, exportDimensions.height], pdfOrientation);
              }

              pdf.addImage(dataUrl, "PNG", 0, 0, exportDimensions.width, exportDimensions.height);
            }

            pdf.save(`${slugify(projectTitleFromTopic(topic))}.pdf`);
            trackEvent({
              name: "export_succeeded",
              payload: {
                mode: "pdf",
                format: exportFormat,
                slides: targetSlideIds.length
              }
            });
            setStatus(`PDF экспортирован (${targetSlideIds.length} слайд(ов)).`);
            return;
          }

          await exportSlidesAsZip(targetSlideIds, "slides", "png");
          trackEvent({
            name: "export_succeeded",
            payload: {
              mode: "zip",
              format: exportFormat,
              slides: targetSlideIds.length
            }
          });
          setStatus(`Архив со слайдами скачан (${targetSlideIds.length} шт.).`);
          return;
        } catch (attemptError) {
          lastAttemptError = attemptError;
          if (attempt >= EXPORT_ATTEMPTS_MAX) {
            break;
          }

          await waitForNextFrame();
          await waitForNextFrame();
        }
      }

      throw lastAttemptError ?? new Error("Экспорт не удалось завершить.");
    } catch (error) {
      setStatus(resolveUserFacingError(error, "Ошибка экспорта. Попробуйте снова."));
    } finally {
      setIsExportRendering(false);
      setExportSnapshot(null);
      exportStageRefs.current = {};
    }
  };

  return (
    <main
      className="page-shell"
      style={{
        ["--mobile-bottom-offset" as string]: `${mobileBottomOffset}px`
      }}
    >
      <div className="desktop-only">
        <div className="editor-shell editor-shell-redesigned">
          {isGeneratePanelVisible ? (
            <Toolbar
              topic={topic}
              slidesCount={slidesCount}
              topicMaxLength={MAX_TOPIC_CHARS}
              status={status}
              onTopicChange={setTopic}
              onSlidesCountChange={(value) => setSlidesCount(clampSlidesCount(value))}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
              disabled={generationLocked}
            />
          ) : null}

          <div className="studio-grid">
            <aside className="action-rail">
              <button
                className="rail-button"
                type="button"
                title="Отменить (Ctrl/Cmd + Z)"
                onClick={handleUndo}
                disabled={!canUndo || generationLocked}
              >
                <AppIcon name="history-back" size={18} />
              </button>
              <button
                className="rail-button"
                type="button"
                title="Повторить (Ctrl/Cmd + Shift + Z)"
                onClick={handleRedo}
                disabled={!canRedo || generationLocked}
              >
                <AppIcon name="history-forward" size={18} />
              </button>
              <button
                className="rail-button"
                type="button"
                title="Выбрать шаблон"
                onClick={handleOpenTemplateModal}
                disabled={generationLocked}
              >
                <AppIcon name="templates" size={18} />
              </button>
              <button
                className="rail-button"
                type="button"
                title={isPreviewMode ? "Вернуться в режим редактирования" : "Режим предпросмотра"}
                onClick={() => setIsPreviewMode((value) => !value)}
                disabled={generationLocked}
              >
                <AppIcon name={isPreviewMode ? "eye-off" : "eye"} size={18} />
              </button>
              <button
                className="rail-button"
                type="button"
                title="Новая сессия"
                onClick={handleResetSession}
                disabled={generationLocked}
              >
                <AppIcon name="reset" size={18} />
              </button>
            </aside>

            <section className="canvas-column" ref={desktopCanvasHostRef}>
              <CanvasEditor
                slides={slides}
                activeSlideId={activeSlideId}
                activeFormat={slideFormat}
                displayWidth={displaySize}
                displayHeight={displayHeight}
                canvasWidth={slideDimensions.width}
                canvasHeight={slideDimensions.height}
                selectedElementId={selectedElementId}
                selectedElement={selectedElement}
                editingTextElementId={editingTextElementId}
                editingTextElement={editingTextElement}
                editingValue={editingValue}
                onEditingValueChange={handleEditingValueChange}
                onEditingSelectionChange={handleSelectedTextSelectionChange}
                onCommitTextEditing={handleCommitTextEditing}
                onCancelTextEditing={handleCancelTextEditing}
                onStartTextEditing={handleStartTextEditing}
                onSelectSlide={(slideId) => handleSelectSlide(slideId, { source: "canvas" })}
                onVisibleSlideChange={handleVisibleSlideChange}
                scrollToSlideRequest={scrollToSlideRequest}
                onSelectElement={handleSelectElement}
                onUpdateElementPosition={handleUpdateElementPositionBySlide}
                onTransformElement={handleTransformElementBySlide}
                onInsertSlideAt={handleInsertSlideAt}
                onAddTextToSlide={handleAddText}
                onAddImageToSlide={handleAddImage}
                onAddBackgroundImageToSlide={handleAddBackgroundImage}
                onDeleteSelectedElement={handleDeleteElement}
                onMoveSlide={handleMoveSlide}
                onDeleteSlide={handleDeleteSlide}
                onOpenTemplateModal={handleOpenTemplateModal}
                disabled={generationLocked}
                previewMode={isPreviewMode}
                showSlideBadge={false}
                fontsReady={fontsReady}
              />
            </section>

            <aside className="right-sidebar">
              {activeSlide ? (
                <SettingsPanel
                  slides={slides}
                  activeSlideId={activeSlideId}
                  slide={activeSlide}
                  slideIndex={activeSlideIndex}
                  totalSlides={slides.length}
                  activeTemplateName={activeTemplateName}
                  activeFormat={slideFormat}
                  slideBackground={activeSlide.background}
                  gridVisible={activeGridVisible}
                  profileHandle={activeSlide.profileHandle ?? ""}
                  profileSubtitle={normalizeProfileSubtitleForUi(activeSlide.profileSubtitle ?? "")}
                  subtitlesVisibleAcrossSlides={subtitlesVisibleAcrossSlides}
                  photoSlotEnabled={activePhotoSlotEnabled}
                  canUsePhotoSlot
                  hasBackgroundImage={activeHasBackgroundImage}
                  captionResult={captionResult}
                  exportMode={exportMode}
                  isGenerating={isGenerating}
                  isGeneratingCaption={isGeneratingCaption}
                  isExporting={isExportRendering}
                  onExportModeChange={setExportMode}
                  onOpenExportModal={handleOpenSlideExportModal}
                  onGenerateCaption={handleGenerateCaption}
                  onCopyCaption={handleCopyCaption}
                  onPhotoSlotEnabledChange={(value) => handlePhotoSlotToggle(value, activeSlide.id)}
                  onAddSlidePhoto={() => handleAddImage(activeSlide.id)}
                  onUploadBackgroundImage={() => handleAddBackgroundImage(activeSlide.id)}
                  onRemoveBackgroundImage={() => {
                    if (activeSlideIndex === -1) {
                      return;
                    }
                    updateSlide(activeSlide.id, (slide) =>
                      setSlideBackgroundImage(slide, null, activeSlideIndex, slides.length, slideFormat)
                    );
                    setSelectedElementId(null);
                    setEditingTextElementId(null);
                    setStatus("Фоновое изображение удалено.");
                  }}
                  onFormatChange={handleFormatChange}
                  onSlideBackgroundChange={handleSlideBackgroundColorChange}
                  photoSettings={activePhotoSettings}
                  onSlidePhotoSettingsChange={handleActiveSlidePhotoSettingsChange}
                  onApplyStylePreset={handleApplyStylePreset}
                  onGridVisibilityChange={handleGridVisibilityChange}
                  onOpenTemplateModal={handleOpenTemplateModal}
                  onSelectSlide={(slideId) =>
                    handleSelectSlide(slideId, { syncCanvas: true, source: "list" })
                  }
                  onInsertSlideAt={handleInsertSlideAt}
                  onDeleteSlide={handleDeleteSlide}
                  onProfileHandleChange={(value) => handleUpdateFooter({ profileHandle: value })}
                  onProfileSubtitleChange={(value) =>
                    handleUpdateFooter({ profileSubtitle: normalizeProfileSubtitleForUi(value) })
                  }
                  onToggleSubtitleAcrossSlides={handleToggleSubtitleAcrossSlides}
                  selectedTextElement={effectiveSelectedTextElement}
                  selectedTextTargetRole={selectedTextTargetRole}
                  onSelectedTextChange={handleSelectedTextChange}
                  onSelectedTextColorChange={handleSelectedTextColorChange}
                  onSelectedTextHighlightColorChange={handleSelectedTextHighlightColorChange}
                  onSelectedTextHighlightOpacityChange={handleSelectedTextHighlightOpacityChange}
                  onSelectedTextSelectionChange={handleSelectedTextSelectionChange}
                  onSelectedTextFontChange={handleSelectedTextFontChange}
                  onSelectedTextSizeChange={handleSelectedTextSizeChange}
                  onSelectedTextCaseChange={handleSelectedTextCaseChange}
                  onCenterSelectedTextHorizontally={handleCenterSelectedTextHorizontally}
                  onSelectedTextTargetRoleChange={handleSelectedTextTargetRoleChange}
                  onApplyHighlightToSelection={handleApplyHighlightToSelection}
                  onClearHighlightFromSelection={handleClearHighlightFromSelection}
                  onClearAllHighlights={handleClearAllHighlights}
                  onApplyHighlightColorToAllSlides={handleApplyHighlightColorToAllSlides}
                  selectedTextHighlightColor={selectedHighlightColor}
                  selectedTextHighlightOpacity={selectedHighlightOpacity}
                  disabled={generationLocked}
                  previewMode={isPreviewMode}
                />
              ) : null}
            </aside>
          </div>
        </div>
      </div>

      <div className="mobile-only">
        <div className="mobile-editor-shell">
          <header className="mobile-topbar">
            <div className="mobile-top-left">
              <button
                className="mobile-icon-button"
                type="button"
                title="Отменить"
                onClick={handleUndo}
                disabled={!canUndo || generationLocked}
              >
                <AppIcon name="history-back" size={16} />
              </button>
              <button
                className="mobile-icon-button"
                type="button"
                title="Повторить"
                onClick={handleRedo}
                disabled={!canRedo || generationLocked}
              >
                <AppIcon name="history-forward" size={16} />
              </button>
            </div>

            <div className="mobile-top-center">
              <select
                className="mobile-compact-select"
                value={slideFormat}
                onChange={(event) => handleFormatChange(event.target.value as SlideFormat)}
                aria-label="Формат"
                disabled={generationLocked}
              >
                <option value="1:1">1:1</option>
                <option value="4:5">4:5</option>
                <option value="9:16">9:16</option>
              </select>
            </div>

            <button
              className="mobile-export-button"
              type="button"
              onClick={handleOpenSlideExportModal}
              disabled={isExportRendering || isGenerating}
              title={`Экспорт в ${exportModeLabel}`}
            >
              <AppIcon name="download" size={16} />
              <span>{isExportRendering ? "Экспорт..." : "Экспорт"}</span>
            </button>
          </header>

          {isGeneratePanelVisible ? (
            <details className="mobile-generate-panel" ref={mobileGeneratePanelRef}>
              <summary>Создать новую карусель</summary>
              <div className="mobile-generate-body">
                <textarea
                  ref={mobileGenerateTopicRef}
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="Например: «Как эксперту получать заявки через Instagram-карусели»"
                  rows={3}
                  maxLength={MAX_TOPIC_CHARS}
                  title={`Максимум ${MAX_TOPIC_CHARS} символов`}
                  disabled={generationLocked}
                />
                <div className="mobile-generate-row">
                  <label className="mobile-count-label">
                    Карточек
                    <select
                      value={slidesCount}
                      onChange={(event) => setSlidesCount(clampSlidesCount(Number(event.target.value)))}
                      disabled={generationLocked}
                    >
                      {SLIDES_COUNT_OPTIONS.map((count) => (
                        <option key={count} value={count}>
                          {count}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="mobile-generate-actions">
                    <button
                      className="btn"
                      type="button"
                      onClick={() => void handleGenerate({ source: "mobile" })}
                      disabled={generationLocked}
                    >
                      {isGenerating ? "Генерирую..." : "Сгенерировать"}
                    </button>
                    <button
                      className="btn secondary"
                      type="button"
                      onClick={() => void handleGenerate({ source: "mobile", openPostTool: true })}
                      disabled={generationLocked}
                    >
                      {isGenerating ? "Подождите..." : "Сгенерировать + пост"}
                    </button>
                  </div>
                </div>
              </div>
            </details>
          ) : null}

          <div className="mobile-status-pill">{status}</div>

          <section className="mobile-canvas-zone" ref={mobileCanvasHostRef}>
            <CanvasEditor
              mode="single"
              slides={slides}
              activeSlideId={activeSlideId}
              activeFormat={slideFormat}
              displayWidth={displaySize}
              displayHeight={displayHeight}
              canvasWidth={slideDimensions.width}
              canvasHeight={slideDimensions.height}
              selectedElementId={selectedElementId}
              selectedElement={selectedElement}
              editingTextElementId={editingTextElementId}
              editingTextElement={editingTextElement}
              editingValue={editingValue}
              onEditingValueChange={handleEditingValueChange}
              onEditingSelectionChange={handleSelectedTextSelectionChange}
              onCommitTextEditing={handleCommitTextEditing}
              onCancelTextEditing={handleCancelTextEditing}
              onStartTextEditing={handleStartTextEditing}
              onSelectSlide={(slideId) => handleSelectSlide(slideId, { source: "canvas" })}
              onVisibleSlideChange={handleVisibleSlideChange}
              scrollToSlideRequest={scrollToSlideRequest}
              onSelectElement={handleSelectElement}
              onUpdateElementPosition={handleUpdateElementPositionBySlide}
              onTransformElement={handleTransformElementBySlide}
              onInsertSlideAt={handleInsertSlideAt}
              onAddTextToSlide={handleAddText}
              onAddImageToSlide={handleAddImage}
              onAddBackgroundImageToSlide={handleAddBackgroundImage}
              onDeleteSelectedElement={handleDeleteElement}
              onMoveSlide={handleMoveSlide}
              onDeleteSlide={handleDeleteSlide}
              onOpenTemplateModal={handleOpenTemplateModal}
              disabled={generationLocked}
              previewMode={isPreviewMode}
              showSlideBadge={false}
              fontsReady={fontsReady}
              hideMobileSlideTools={false}
            />
          </section>

          {activeSlide ? (
            <MobileTools
              activeTab={mobileToolTab}
              onTabChange={handleMobileToolTabChange}
              selectedElement={selectedElement}
              selectedTextElement={effectiveSelectedTextElement}
              selectedTextTargetRole={selectedTextTargetRole}
              activeTemplateName={activeTemplateName}
              profileHandle={activeSlide.profileHandle ?? ""}
              profileSubtitle={normalizeProfileSubtitleForUi(activeSlide.profileSubtitle ?? "")}
              subtitlesVisibleAcrossSlides={subtitlesVisibleAcrossSlides}
              photoSlotEnabled={activePhotoSlotEnabled}
              hasBackgroundImage={activeHasBackgroundImage}
              gridVisible={activeGridVisible}
              captionResult={captionResult}
              isGeneratingCaption={isGeneratingCaption}
              onGenerateCaption={handleGenerateCaption}
              onCopyCaption={handleCopyCaption}
              onPhotoSlotEnabledChange={(value) => handlePhotoSlotToggle(value, activeSlide.id)}
              slideBackground={activeSlide.background}
              onAddSlidePhoto={() => handleAddImage(activeSlide.id)}
              onUploadBackgroundImage={() => handleAddBackgroundImage(activeSlide.id)}
              onRemoveBackgroundImage={() => {
                if (activeSlideIndex === -1) {
                  return;
                }
                updateSlide(activeSlide.id, (slide) =>
                  setSlideBackgroundImage(slide, null, activeSlideIndex, slides.length, slideFormat)
                );
                setSelectedElementId(null);
                setEditingTextElementId(null);
                setStatus("Фоновое изображение удалено.");
              }}
              onOpenTemplateModal={handleOpenTemplateModal}
              onProfileHandleChange={(value) => handleUpdateFooter({ profileHandle: value })}
              onProfileSubtitleChange={(value) =>
                handleUpdateFooter({ profileSubtitle: normalizeProfileSubtitleForUi(value) })
              }
              onToggleSubtitleAcrossSlides={handleToggleSubtitleAcrossSlides}
              onSlideBackgroundChange={handleSlideBackgroundColorChange}
              photoSettings={activePhotoSettings}
              onSlidePhotoSettingsChange={handleActiveSlidePhotoSettingsChange}
              onApplyStylePreset={handleApplyStylePreset}
              onGridVisibilityChange={handleGridVisibilityChange}
              onSelectedTextChange={handleSelectedTextChange}
              onSelectedTextColorChange={handleSelectedTextColorChange}
              onSelectedTextHighlightColorChange={handleSelectedTextHighlightColorChange}
              onSelectedTextHighlightOpacityChange={handleSelectedTextHighlightOpacityChange}
              onSelectedTextSelectionChange={handleSelectedTextSelectionChange}
              onSelectedTextFontChange={handleSelectedTextFontChange}
              onSelectedTextSizeChange={handleSelectedTextSizeChange}
              onSelectedTextCaseChange={handleSelectedTextCaseChange}
              onCenterSelectedTextHorizontally={handleCenterSelectedTextHorizontally}
              onSelectedTextTargetRoleChange={handleSelectedTextTargetRoleChange}
              onApplyColorScheme={handleApplyColorScheme}
              onApplyHighlightToSelection={handleApplyHighlightToSelection}
              onClearHighlightFromSelection={handleClearHighlightFromSelection}
              onClearAllHighlights={handleClearAllHighlights}
              onApplyHighlightColorToAllSlides={handleApplyHighlightColorToAllSlides}
              selectedTextHighlightColor={selectedHighlightColor}
              selectedTextHighlightOpacity={selectedHighlightOpacity}
              toolbarRef={mobileToolbarRef}
              toolSheetRef={mobileToolSheetRef}
              disabled={generationLocked}
              previewMode={isPreviewMode}
            />
          ) : null}
        </div>
      </div>

      <TemplateLibraryModal
        isOpen={isTemplateModalOpen}
        activeTemplateId={activeTemplateId}
        onApplyTemplate={handleApplyTemplate}
        onClose={() => setIsTemplateModalOpen(false)}
      />

      <SlideExportModal
        isOpen={isSlideExportModalOpen}
        slides={slides}
        selectedSlideIds={selectedExportSlideIds}
        exportMode={exportMode}
        exportModeLabel={exportModeLabel}
        onExportModeChange={setExportMode}
        onToggleSlide={handleToggleExportSlide}
        onToggleAll={handleToggleAllExportSlides}
        onConfirm={handleConfirmSlideExport}
        onClose={() => setIsSlideExportModalOpen(false)}
      />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="visually-hidden-file-input"
        onChange={(event) => void handleImageSelected(event.target.files?.[0] ?? null)}
      />
      <input
        ref={backgroundImageInputRef}
        type="file"
        accept="image/*"
        className="visually-hidden-file-input"
        onChange={(event) => void handleBackgroundImageSelected(event.target.files?.[0] ?? null)}
      />

      {isExportRendering && exportSnapshot ? (
        <div className="hidden-export-stages" aria-hidden="true">
          {exportSnapshot.slides.map((slide) => (
            <SlideStage
              key={`export-${slide.id}`}
              slide={slide}
              width={SLIDE_FORMAT_DIMENSIONS[exportSnapshot.slideFormat].width}
              height={SLIDE_FORMAT_DIMENSIONS[exportSnapshot.slideFormat].height}
              canvasWidth={SLIDE_FORMAT_DIMENSIONS[exportSnapshot.slideFormat].width}
              canvasHeight={SLIDE_FORMAT_DIMENSIONS[exportSnapshot.slideFormat].height}
              showSlideBadge={false}
              stageRef={(node) => {
                exportStageRefs.current[slide.id] = node;
              }}
            />
          ))}
        </div>
      ) : null}
    </main>
  );
}

function isTextEntryElement(element: Element | null) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  if (element.isContentEditable) {
    return true;
  }

  const tagName = element.tagName;
  if (tagName === "TEXTAREA") {
    return true;
  }

  if (tagName !== "INPUT") {
    return false;
  }

  const input = element as HTMLInputElement;
  const type = input.type.toLowerCase();
  return !["checkbox", "radio", "range", "button", "submit", "reset", "file"].includes(type);
}

function normalizeProfileSubtitleForUi(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  return /^надпись$/iu.test(normalized) ? "" : normalized;
}

async function waitForNextFrame() {
  return await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

async function ensureFontsReadyForExport() {
  if (typeof document === "undefined") {
    return;
  }

  if (!("fonts" in document) || !document.fonts?.ready) {
    return;
  }

  await Promise.race([
    document.fonts.ready.catch(() => undefined),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, 1800);
    })
  ]);
}

function normalizeSlidePhotoSettings(
  value: Partial<SlidePhotoSettings> | Slide["photoSettings"] | undefined
): SlidePhotoSettings {
  const source = value ?? DEFAULT_SLIDE_PHOTO_SETTINGS;
  return {
    zoom: Math.max(100, Math.min(200, typeof source.zoom === "number" ? source.zoom : 100)),
    offsetX: Math.max(-50, Math.min(50, typeof source.offsetX === "number" ? source.offsetX : 0)),
    offsetY: Math.max(-50, Math.min(50, typeof source.offsetY === "number" ? source.offsetY : 0)),
    overlay: Math.max(0, Math.min(80, typeof source.overlay === "number" ? source.overlay : 0))
  };
}

function hasCustomSlidePhoto(slide: Slide) {
  return slide.elements.some(
    (element) =>
      (element.type === "image" || element.type === "image_element") &&
      element.metaKey !== "image-top"
  );
}

function normalizeAccentToken(value: string) {
  return value
    .toLowerCase()
    .replace(/[«»"“”„'`]/gu, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizeColorForInput(value: string | undefined, fallback: string) {
  const normalized = (value ?? "").trim();
  if (HEX_COLOR_INPUT_RE.test(normalized)) {
    return normalized.length === 4
      ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
      : normalized;
  }
  return fallback;
}

function resolveLikelyManagedTitle(slide: Slide) {
  return (
    slide.elements.find(
      (element): element is TextElement =>
        element.type === "text" &&
        (element.metaKey === MANAGED_TITLE_META_KEY || element.role === "title")
    ) ??
    slide.elements.find(
      (element): element is TextElement =>
        element.type === "text" &&
        !NON_CONTENT_TEXT_META_KEYS.has(element.metaKey ?? "")
    ) ??
    null
  );
}

function normalizeLegacyColorToken(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function parseRgbColor(value: string | undefined) {
  const normalized = normalizeLegacyColorToken(value);
  const match = normalized.match(/^rgba?\(([^)]+)\)$/u);
  if (!match) {
    return null;
  }

  const parts = match[1]
    .split(",")
    .map((chunk) => Number.parseFloat(chunk.trim()))
    .filter((chunk) => Number.isFinite(chunk));
  if (parts.length < 3) {
    return null;
  }

  return {
    r: parts[0],
    g: parts[1],
    b: parts[2]
  };
}

function isCloseRgbColor(
  color: { r: number; g: number; b: number } | null,
  target: { r: number; g: number; b: number }
) {
  if (!color) {
    return false;
  }
  return (
    Math.abs(color.r - target.r) <= 18 &&
    Math.abs(color.g - target.g) <= 18 &&
    Math.abs(color.b - target.b) <= 18
  );
}

function isLikelyLegacyAccentChipColor(fill: string | undefined) {
  const normalized = normalizeLegacyColorToken(fill);
  if (!normalized) {
    return false;
  }
  if (LEGACY_ACCENT_CHIP_HEX_COLORS.has(normalized)) {
    return true;
  }
  const rgb = parseRgbColor(normalized);
  return (
    isCloseRgbColor(rgb, { r: 31, g: 73, b: 255 }) ||
    isCloseRgbColor(rgb, { r: 255, g: 45, b: 0 }) ||
    isCloseRgbColor(rgb, { r: 255, g: 42, b: 42 })
  );
}

function resolvePreferredManagedTextByMeta(slide: Slide, metaKey: "managed-title" | "managed-body") {
  const candidates = slide.elements.filter(
    (element): element is TextElement => element.type === "text" && element.metaKey === metaKey
  );
  if (!candidates.length) {
    return null;
  }

  return [...candidates].sort((left, right) => {
    const leftLength = normalizeAccentToken(left.text).length;
    const rightLength = normalizeAccentToken(right.text).length;
    if (leftLength !== rightLength) {
      return rightLength - leftLength;
    }
    if (metaKey === MANAGED_TITLE_META_KEY) {
      return left.y - right.y;
    }
    return left.y - right.y;
  })[0];
}

function resolveRectOverlapRatio(left: TextElement, right: TextElement) {
  const leftX2 = left.x + left.width;
  const leftY2 = left.y + left.height;
  const rightX2 = right.x + right.width;
  const rightY2 = right.y + right.height;
  const overlapWidth = Math.max(0, Math.min(leftX2, rightX2) - Math.max(left.x, right.x));
  const overlapHeight = Math.max(0, Math.min(leftY2, rightY2) - Math.max(left.y, right.y));
  if (overlapWidth <= 0 || overlapHeight <= 0) {
    return 0;
  }
  const overlapArea = overlapWidth * overlapHeight;
  const minArea = Math.max(1, Math.min(left.width * left.height, right.width * right.height));
  return overlapArea / minArea;
}

function isLikelyDuplicatedManagedTextElement(
  element: CanvasElement,
  preferredTitle: TextElement | null,
  preferredBody: TextElement | null
) {
  if (element.type !== "text" || element.metaKey) {
    return false;
  }

  const normalizedElementText = normalizeAccentToken(element.text);
  if (!normalizedElementText || normalizedElementText.length < 8) {
    return false;
  }

  const checkAgainst = (managed: TextElement | null) => {
    if (!managed) {
      return false;
    }
    const normalizedManagedText = normalizeAccentToken(managed.text);
    if (!normalizedManagedText || normalizedManagedText.length < 8) {
      return false;
    }

    const sameOrNested =
      normalizedManagedText === normalizedElementText ||
      normalizedManagedText.includes(normalizedElementText) ||
      normalizedElementText.includes(normalizedManagedText);
    if (!sameOrNested) {
      return false;
    }
    const overlapRatio = resolveRectOverlapRatio(element, managed);
    if (overlapRatio >= 0.42) {
      return true;
    }

    const nearSameBlock =
      Math.abs(element.x - managed.x) <= Math.max(56, managed.width * 0.18) &&
      Math.abs(element.y - managed.y) <= Math.max(64, managed.height * 0.38) &&
      Math.abs(element.width - managed.width) <= Math.max(96, managed.width * 0.34);

    return nearSameBlock;
  };

  return checkAgainst(preferredTitle) || checkAgainst(preferredBody);
}

function isLegacyAccentMetaKey(metaKey: string | undefined) {
  if (!metaKey) {
    return false;
  }
  const normalized = metaKey.toLowerCase();
  return (
    normalized === "managed-title-accent-chip" ||
    normalized === "managed-title-accent-text" ||
    normalized.includes("accent-highlight") ||
    normalized.includes("highlight-chip") ||
    normalized.includes("accent-chip") ||
    normalized.includes("accent-text") ||
    normalized.includes("title-accent") ||
    normalized.includes("highlight")
  );
}

function isLegacyAccentChipShape(element: CanvasElement, slide?: Slide): element is ShapeElement {
  if (element.type !== "shape") {
    return false;
  }
  if (isLegacyAccentMetaKey(element.metaKey)) {
    return true;
  }
  if (element.metaKey) {
    return false;
  }

  const geometryMatches =
    element.shape === "rect" &&
    element.width >= 24 &&
    element.width <= 760 &&
    element.height >= 8 &&
    element.height <= 180 &&
    element.width / Math.max(1, element.height) >= 1.15 &&
    (element.opacity ?? 1) >= 0.25;

  if (!geometryMatches) {
    return false;
  }

  if (!slide) {
    return true;
  }

  // Keep cleanup aggressive for legacy artifacts: there is no user-facing tool that creates
  // free decorative rectangles in this zone, so removing them is safer than leaving "orphan chips".
  return element.y <= Math.round(SLIDE_FORMAT_DIMENSIONS["9:16"].height * 0.9);
}

function isLikelyLegacyAccentTextElement(
  element: CanvasElement,
  legacyChips: ShapeElement[],
  titleText: string,
  titleElement: TextElement | null
) {
  if (element.type !== "text") {
    return false;
  }
  if (element.metaKey) {
    return isLegacyAccentMetaKey(element.metaKey);
  }

  const compact = element.text.replace(/\s+/gu, " ").trim();
  if (!compact || compact.length > 42 || compact.includes("\n")) {
    return false;
  }

  const words = compact.split(" ").filter(Boolean);
  if (words.length > 4) {
    return false;
  }

  const centerX = element.x + element.width / 2;
  const centerY = element.y + Math.max(12, element.height / 2);
  const overlapsChip = legacyChips.some(
    (chip) =>
      centerX >= chip.x - 28 &&
      centerX <= chip.x + chip.width + 28 &&
      centerY >= chip.y - 34 &&
      centerY <= chip.y + chip.height + 34
  );
  const nearTitle = titleElement
    ? element.y <= titleElement.y + Math.max(420, titleElement.height + 320) &&
      element.y + element.height >= titleElement.y - 100 &&
      element.x + element.width >= titleElement.x - 96 &&
      element.x <= titleElement.x + titleElement.width + 96
    : false;
  if (!overlapsChip && !nearTitle) {
    return false;
  }

  const normalizedText = normalizeAccentToken(compact);
  const normalizedTitle = normalizeAccentToken(titleText);
  if (!normalizedText) {
    return false;
  }

  if (!normalizedTitle) {
    return words.length <= 2 && LEGACY_ACCENT_TEXT_COLORS.has((element.fill ?? "").toLowerCase());
  }

  if (normalizedTitle.includes(normalizedText)) {
    return true;
  }

  return normalizedText
    .split(" ")
    .filter((token) => token.length >= 4)
    .some((token) => normalizedTitle.includes(token));
}

function prepareSlidesForExport(
  sourceSlides: Slide[],
  templateId: CarouselTemplateId,
  slideFormat: SlideFormat
) {
  const themedSlides = cloneSlides(sourceSlides).map((slide, index, items) =>
    applyTemplateToSlide(
      slide,
      slide.templateId ?? templateId,
      index,
      items.length,
      slideFormat
    )
  );

  return themedSlides.map((slide, index) => {
    if (slide.slideType !== "image_text") {
      return slide;
    }

    const hasPhoto = Boolean(slide.backgroundImage) || hasCustomSlidePhoto(slide);
    if (hasPhoto) {
      return slide;
    }

    return applyTemplateToSlide(
      {
        ...slide,
        slideType: "text"
      },
      slide.templateId ?? templateId,
      index,
      themedSlides.length,
      slideFormat
    );
  });
}

function stripLegacyAccentArtifactsFromSlide(slide: Slide): Slide {
  const titleElement = resolveLikelyManagedTitle(slide);
  const titleText = titleElement?.text ?? "";
  const preferredManagedTitle = resolvePreferredManagedTextByMeta(slide, MANAGED_TITLE_META_KEY);
  const preferredManagedBody = resolvePreferredManagedTextByMeta(slide, MANAGED_BODY_META_KEY);
  const legacyChips = slide.elements.filter((element): element is ShapeElement =>
    isLegacyAccentChipShape(element, slide)
  );

  const elements: CanvasElement[] = slide.elements
    .filter((element) => {
      if (
        element.type === "text" &&
        element.metaKey === MANAGED_TITLE_META_KEY &&
        preferredManagedTitle &&
        element.id !== preferredManagedTitle.id
      ) {
        return false;
      }
      if (
        element.type === "text" &&
        element.metaKey === MANAGED_BODY_META_KEY &&
        preferredManagedBody &&
        element.id !== preferredManagedBody.id
      ) {
        return false;
      }
      if (isLegacyAccentMetaKey(element.metaKey)) {
        return false;
      }
      if (isLegacyAccentChipShape(element, slide)) {
        return false;
      }
      if (isLikelyLegacyAccentTextElement(element, legacyChips, titleText, titleElement)) {
        return false;
      }
      if (isLikelyDuplicatedManagedTextElement(element, preferredManagedTitle, preferredManagedBody)) {
        return false;
      }
      return true;
    })
    .map((element): CanvasElement =>
      element.type === "text"
        ? {
            ...element,
            highlights: normalizeHighlightRangesForText(element.highlights, element.text)
          }
        : { ...element }
    );

  return {
    ...slide,
    elements
  };
}

function cloneSlides(slides: Slide[]): Slide[] {
  return slides.map(stripLegacyAccentArtifactsFromSlide);
}

function buildOutlineFromSlides(slides: Slide[]): CarouselOutlineSlide[] {
  return slides
    .map((slide, index) => toOutlineSlide(slide, index))
    .filter((slide): slide is CarouselOutlineSlide => Boolean(slide));
}

function toOutlineSlide(slide: Slide, index: number): CarouselOutlineSlide | null {
  const role = slide.generationRole ?? inferRoleByIndex(index);
  const textLines = extractOrderedTextLines(slide);
  const title = textLines[0] || `Слайд ${index + 1}`;
  const bodyLines = textLines.slice(1);
  const bullets = toBullets(bodyLines.length ? bodyLines : textLines.slice(0, 4));

  if (role === "hook" || role === "cta") {
    return {
      type: role,
      title: trimTextLine(title, 120),
      subtitle: trimTextLine(bodyLines[0] || "Короткая мысль, которая продолжает главный тезис.", 180)
    };
  }

  if (role === "problem" || role === "amplify") {
    return {
      type: role,
      title: trimTextLine(title, 120),
      bullets: bullets.length ? bullets : [trimTextLine("Ключевая проблема раскрывается в тексте слайда.", 140)]
    };
  }

  if (role === "mistake" || role === "shift") {
    return {
      type: role,
      title: trimTextLine(title, 120)
    };
  }

  if (role === "consequence" || role === "solution") {
    return {
      type: role,
      bullets: bullets.length ? bullets : [trimTextLine(title, 140)]
    };
  }

  if (role === "example") {
    return {
      type: "example",
      before: trimTextLine(title, 160),
      after: trimTextLine(bodyLines[0] || bodyLines[1] || "Новый подход даёт более понятный и сильный результат.", 160)
    };
  }

  return {
    type: "cta",
    title: trimTextLine(title, 120),
    subtitle: trimTextLine(bodyLines[0] || "Сохраните и примените это к своему контенту.", 180)
  };
}

function inferRoleByIndex(index: number): CarouselOutlineSlide["type"] {
  const flow: CarouselOutlineSlide["type"][] = [
    "hook",
    "problem",
    "amplify",
    "mistake",
    "consequence",
    "shift",
    "solution",
    "example",
    "cta"
  ];
  if (index < flow.length) {
    return flow[index];
  }
  return "solution";
}

function extractOrderedTextLines(slide: Slide) {
  return slide.elements
    .filter((element): element is TextElement => element.type === "text")
    .filter((element) => element.metaKey !== "slide-chip-text")
    .sort((left, right) => left.y - right.y)
    .flatMap((element) =>
      element.text
        .split(/\n+/)
        .map((line) => trimTextLine(line, 180))
        .filter(Boolean)
    )
    .slice(0, 10);
}

function toBullets(lines: string[]) {
  const normalized = lines
    .map((line) => trimTextLine(line.replace(/^[-•–]\s*/u, ""), 140))
    .filter(Boolean);
  return normalized.slice(0, 4);
}

function trimTextLine(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  return normalized.slice(0, maxLength);
}

function areStageImagesReady(stage: Konva.Stage) {
  const found = stage.find("Image") as unknown;
  const imageNodes = (
    Array.isArray(found)
      ? found
      : found && typeof found === "object" && "toArray" in found && typeof found.toArray === "function"
        ? found.toArray()
        : []
  ) as Konva.Image[];

  return imageNodes.every((node) => {
    const image = node.image();
    if (!image) {
      return false;
    }
    return isCanvasImageSourceReady(image);
  });
}

function isCanvasImageSourceReady(image: CanvasImageSource) {
  if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement) {
    return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
  }

  if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) {
    return image.width > 0 && image.height > 0;
  }

  if ("width" in image && "height" in image) {
    const width = Number(image.width);
    const height = Number(image.height);
    return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
  }

  return true;
}

function getExportModeLabel(mode: ExportMode) {
  if (mode === "png") {
    return "PNG";
  }
  if (mode === "jpg") {
    return "JPG";
  }
  if (mode === "pdf") {
    return "PDF";
  }
  return "ZIP";
}

function resolveUserFacingError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();
  if (!message) {
    return fallback;
  }

  if (/failed to fetch|networkerror|load failed|fetch/i.test(message)) {
    return "Проблема с соединением. Проверьте интернет и попробуйте снова.";
  }

  if (/unexpected token|json|doctype/i.test(message)) {
    return "Сервер вернул некорректный ответ. Попробуйте снова.";
  }

  if (message.length > 220) {
    return fallback;
  }

  return message;
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Не удалось прочитать изображение."));
        return;
      }

      resolve(reader.result);
    };

    reader.onerror = () => reject(reader.error ?? new Error("Ошибка чтения файла."));
    reader.readAsDataURL(file);
  });
}

async function fileToOptimizedDataUrl(file: File) {
  const original = await fileToDataUrl(file);
  let best = original;

  const candidates: Array<{ maxSide: number; format: "webp" | "jpeg"; quality: number }> = [
    { maxSide: 1600, format: "webp", quality: 0.84 },
    { maxSide: 1280, format: "webp", quality: 0.78 },
    { maxSide: 1024, format: "webp", quality: 0.72 },
    { maxSide: 1024, format: "jpeg", quality: 0.76 }
  ];

  for (const candidate of candidates) {
    try {
      const optimized = await downscaleDataUrl(
        best,
        candidate.maxSide,
        candidate.format,
        candidate.quality
      );
      if (optimized.length < best.length) {
        best = optimized;
      }
    } catch {
      // keep current best result
    }
  }

  // Hard cap for browser localStorage friendliness (roughly 350-400KB base64 payload).
  if (best.length > 520_000) {
    try {
      const forced = await downscaleDataUrl(best, 900, "jpeg", 0.68);
      if (forced.length < best.length) {
        best = forced;
      }
    } catch {
      // keep current best result
    }
  }

  return best;
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  return await response.blob();
}

async function convertDataUrlToJpeg(dataUrl: string, quality = 0.92) {
  const image = await loadHtmlImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext("2d");

  if (!context) {
    return dataUrl;
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const jpeg = canvas.toDataURL("image/jpeg", quality);
  return jpeg.startsWith("data:image/jpeg") ? jpeg : dataUrl;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function transformTextCase(
  value: string,
  mode: "normal" | "uppercase" | "lowercase" | "capitalize"
) {
  if (mode === "uppercase") {
    return value.toUpperCase();
  }

  if (mode === "lowercase") {
    return value.toLowerCase();
  }

  if (mode === "capitalize") {
    return value.replace(
      /\p{L}+/gu,
      (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    );
  }

  return value
    .toLowerCase()
    .replace(/(^\s*|[.!?]\s*)(\p{L})/gu, (_, prefix: string, letter: string) => {
      return `${prefix}${letter.toUpperCase()}`;
    });
}

async function downscaleDataUrl(
  dataUrl: string,
  maxSide: number,
  format: "webp" | "jpeg" = "webp",
  quality = 0.82
) {
  const image = await loadHtmlImage(dataUrl);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  if (!longestSide) {
    return dataUrl;
  }

  const ratio = longestSide > maxSide ? maxSide / longestSide : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * ratio);
  canvas.height = Math.round(image.naturalHeight * ratio);

  const context = canvas.getContext("2d");
  if (!context) {
    return dataUrl;
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const mime = format === "jpeg" ? "image/jpeg" : "image/webp";
  const encoded = canvas.toDataURL(mime, quality);
  return encoded.startsWith(`data:${mime}`) ? encoded : dataUrl;
}

async function readImageMeta(dataUrl: string) {
  const image = await loadHtmlImage(dataUrl);
  return {
    width: image.naturalWidth || image.width || 1,
    height: image.naturalHeight || image.height || 1
  };
}

async function loadHtmlImage(src: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Не удалось подготовить изображение."));
    image.src = src;
  });
}
