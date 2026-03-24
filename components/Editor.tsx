"use client";

import { saveAs } from "file-saver";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  Slide,
  SlideFormat,
  TextElement
} from "@/types/editor";

const DEFAULT_STATUS =
  "Откройте demo-серию, затем введите свою тему и нажмите «Сгенерировать».";
const MOBILE_BREAKPOINT = 768;
const MAX_TOPIC_CHARS = 4000;
const MIN_TOPIC_CHARS = 3;
const EXPORT_LOCK_STATUS = "Дождитесь завершения экспорта и повторите действие.";
const GENERATE_LOCK_STATUS = "Дождитесь завершения генерации и повторите действие.";

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingTextElementId, setEditingTextElementId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
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
  const mobileToolbarRef = useRef<HTMLElement | null>(null);
  const mobileToolSheetRef = useRef<HTMLElement | null>(null);
  const exportStageRefs = useRef<Record<string, Konva.Stage | null>>({});
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const backgroundImageInputRef = useRef<HTMLInputElement | null>(null);
  const generateRequestRef = useRef(0);
  const lastHistoryAtRef = useRef(0);
  const skipAutosaveRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const editorOpenedTrackedRef = useRef(false);

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
  const activeHasBackgroundImage = Boolean(activeSlide?.backgroundImage);
  const activePhotoSlotEnabled = Boolean(
    activeSlide?.slideType === "image_text" && activeSlide.photoSlotEnabled !== false
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
  const generationLocked = isGenerating || isExportRendering;
  const exportModeLabel = getExportModeLabel(exportMode);
  const canUndo = historyPast.length > 0;
  const canRedo = historyFuture.length > 0;

  useEffect(() => {
    if (!initialProjectId) {
      setIsProjectHydrated(true);
      return;
    }

    const existing = getLocalProject(initialProjectId);
    if (!existing) {
      setStatus("Проект не найден. Открыта стартовая серия.");
      setProjectId(null);
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
    setStatus("Проект загружен.");
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

      if (!projectId || projectId !== saved.id) {
        setProjectId(saved.id ?? null);
      }

      if (saved.id && pathname !== `/editor/${saved.id}`) {
        router.replace(`/editor/${saved.id}`);
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
    const onKeyDown = (event: KeyboardEvent) => {
      const isTypingTarget =
        event.target instanceof HTMLElement &&
        (event.target.tagName === "INPUT" ||
          event.target.tagName === "TEXTAREA" ||
          event.target.isContentEditable);

      if (!(event.metaKey || event.ctrlKey) || isTypingTarget || generationLocked) {
        return;
      }

      if (event.key.toLowerCase() !== "z") {
        return;
      }

      event.preventDefault();
      if (event.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [generationLocked, historyPast, historyFuture, slides, activeSlideId, slideFormat]);

  const updateSlide = (
    slideId: string,
    updater: (slide: Slide) => Slide,
    options?: { recordHistory?: boolean }
  ) => {
    if (options?.recordHistory !== false) {
      pushHistorySnapshot();
    }
    setSlides((current) =>
      current.map((slide) => (slide.id === slideId ? updater(slide) : slide))
    );
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
    const targetSlideIndex = slides.findIndex((slide) => slide.id === slideId);
    if (targetSlideIndex === -1) {
      return;
    }

    updateSlide(slideId, (slide) => {
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
        const rebuiltSlide = applyTemplateToSlide(
          {
            ...slide,
            elements: nextElements
          },
          slide.templateId ?? "light",
          targetSlideIndex,
          slides.length,
          slideFormat
        );
        const rebuiltWithPinnedPosition = rebuiltSlide.elements.map((element) => {
          if (
            element.type !== "text" ||
            next.type !== "text" ||
            element.metaKey !== next.metaKey
          ) {
            return element;
          }

          return {
            ...element,
            x: next.x,
            y: next.y,
            width: next.width,
            // Keep visual style/position from edited element, but keep rebuilt auto-height.
            fontSize: next.fontSize,
            fontFamily: next.fontFamily,
            fontStyle: next.fontStyle,
            fill: next.fill,
            align: next.align,
            lineHeight: next.lineHeight,
            letterSpacing: next.letterSpacing,
            textDecoration: next.textDecoration
          };
        });

        if (next.metaKey) {
          const replacement = rebuiltWithPinnedPosition.find(
            (element) => element.type === next.type && element.metaKey === next.metaKey
          );

          if (selectedElementId === elementId) {
            setSelectedElementId(replacement?.id ?? null);
          }

          if (editingTextElementId === elementId && replacement?.type === "text") {
            setEditingTextElementId(replacement.id);
          }
        }

        return {
          ...rebuiltSlide,
          elements: rebuiltWithPinnedPosition
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

  const handleGenerate = async () => {
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

    try {
      setIsGenerating(true);
      setStatus(
        `Генерирую структуру через OpenAI (${requestedSlidesCount} слайдов, формат ${slideFormat})...`
      );
      trackEvent({
        name: "generate_started",
        payload: {
          source: "editor",
          format: slideFormat,
          slidesCount: requestedSlidesCount,
          promptVariant
        }
      });
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 70000);

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
        signal: controller.signal
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
      trackEvent({
        name: "generate_succeeded",
        payload: {
          source: "editor",
          format: slideFormat,
          slidesCount: nextSlides.length,
          promptVariant: data.project?.promptVariant ?? "B"
        }
      });
      setStatus(`Создано ${nextSlides.length} слайдов в формате ${slideFormat}.`);
    } catch (error) {
      trackEvent({
        name: "generate_failed",
        payload: {
          source: "editor",
          format: slideFormat,
          reason: error instanceof Error ? error.message.slice(0, 120) : "unknown"
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

  const handleAddImage = (slideId = activeSlideId ?? "") => {
    if (generationLocked) {
      setStatus(isGenerating ? GENERATE_LOCK_STATUS : EXPORT_LOCK_STATUS);
      return;
    }

    setPendingImageSlideId(slideId);
    imageInputRef.current?.click();
  };

  const handleAddBackgroundImage = (slideId = activeSlideId ?? "") => {
    if (generationLocked) {
      setStatus(isGenerating ? GENERATE_LOCK_STATUS : EXPORT_LOCK_STATUS);
      return;
    }

    setPendingBackgroundSlideId(slideId);
    backgroundImageInputRef.current?.click();
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

      const targetSlideIndex = slides.findIndex((slide) => slide.id === targetSlideId);
      const targetSlide = targetSlideIndex >= 0 ? slides[targetSlideIndex] : null;

      if (!targetSlide) {
        throw new Error("Не найден слайд для добавления изображения.");
      }

      if (targetSlide.slideType === "image_text") {
        updateSlide(targetSlideId, (slide) => {
          const withBackground = setSlideBackgroundImage(
            slide,
            dataUrl,
            targetSlideIndex,
            slides.length,
            slideFormat
          );
          return {
            ...withBackground,
            photoSlotEnabled: true
          };
        });
        setSelectedElementId(null);
      } else {
        const imageMeta = await readImageMeta(dataUrl);
        const maxWidth = Math.min(900, slideDimensions.width - 180);
        const maxHeight = Math.max(180, Math.min(560, slideDimensions.height * 0.42));
        const fitRatio = Math.min(
          1,
          maxWidth / Math.max(1, imageMeta.width),
          maxHeight / Math.max(1, imageMeta.height)
        );
        const imageWidth = Math.round(Math.max(160, imageMeta.width * fitRatio));
        const imageHeight = Math.round(Math.max(120, imageMeta.height * fitRatio));
        const element = createImageElement(dataUrl, {
          width: imageWidth,
          height: imageHeight,
          x: Math.round((slideDimensions.width - imageWidth) / 2),
          y: Math.round(Math.max(72, (slideDimensions.height - imageHeight) * 0.26)),
          fitMode: "contain",
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
      }

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
              ? applyTemplateToSlide(slide, templateId, index, current.length, slideFormat)
              : slide
          )
        );
        setStatus(`Шаблон «${templateName}» применён к текущему слайду.`);
      }
    } else {
      setSlides((current) => applyTemplateToSlides(current, templateId, slideFormat));
      setStatus(`Шаблон «${templateName}» применён ко всей карусели.`);
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
    if (!selectedTextElement) {
      return;
    }

    updateElement(
      selectedTextElement.id,
      (element) => (element.type === "text" ? updater(element) : element),
      options
    );
  };

  const handleSelectedTextChange = (value: string) => {
    updateSelectedTextElement(
      (element) => ({
        ...element,
        text: value
      }),
      { recordHistory: false }
    );
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

  const handleSlideBackgroundColorChange = (value: string) => {
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
    setEditingTextElementId(elementId);
    setEditingValue(textElement.text);
  };

  const handleCommitTextEditing = () => {
    if (generationLocked) {
      return;
    }

    if (!editingTextElementId) {
      return;
    }

    updateElement(editingTextElementId, (element) =>
      element.type === "text"
        ? {
            ...element,
            text: editingValue
          }
        : element
    );

    setEditingTextElementId(null);
    setStatus("Текст обновлён.");
  };

  const handleCancelTextEditing = () => {
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

    setActiveSlideId(slideId);
    setSelectedElementId(elementId);

    if (editingTextElementId && elementId !== editingTextElementId) {
      setEditingTextElementId(null);
    }
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
    if (editingTextElementId) {
      setEditingTextElementId(null);
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
    setEditingValue("");
    setMobileToolTab(null);
    setExportMode("zip");
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
                editingTextElement={editingTextElement}
                editingValue={editingValue}
                onEditingValueChange={setEditingValue}
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
                  profileHandle={activeSlide.profileHandle ?? ""}
                  profileSubtitle={normalizeProfileSubtitleForUi(activeSlide.profileSubtitle ?? "")}
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

          <details className="mobile-generate-panel">
            <summary>Создать новую карусель</summary>
            <div className="mobile-generate-body">
              <textarea
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
                <button
                  className="btn"
                  type="button"
                  onClick={handleGenerate}
                  disabled={generationLocked}
                >
                  {isGenerating ? "Генерирую..." : "Сгенерировать"}
                </button>
              </div>
            </div>
          </details>

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
              editingTextElement={editingTextElement}
              editingValue={editingValue}
              onEditingValueChange={setEditingValue}
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

          {activeSlide ? (
            <MobileTools
              activeTab={mobileToolTab}
              onTabChange={setMobileToolTab}
              selectedElement={selectedElement}
              selectedTextElement={selectedTextElement}
              activeTemplateName={activeTemplateName}
              profileHandle={activeSlide.profileHandle ?? ""}
              profileSubtitle={normalizeProfileSubtitleForUi(activeSlide.profileSubtitle ?? "")}
              photoSlotEnabled={activePhotoSlotEnabled}
              hasBackgroundImage={activeHasBackgroundImage}
              captionResult={captionResult}
              isGeneratingCaption={isGeneratingCaption}
              onGenerateCaption={handleGenerateCaption}
              onCopyCaption={handleCopyCaption}
              onPhotoSlotEnabledChange={(value) => handlePhotoSlotToggle(value, activeSlide.id)}
              slideBackground={activeSlide.background}
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
              onSlideBackgroundChange={handleSlideBackgroundColorChange}
              onSelectedTextChange={handleSelectedTextChange}
              onSelectedTextColorChange={handleSelectedTextColorChange}
              onSelectedTextFontChange={handleSelectedTextFontChange}
              onSelectedTextSizeChange={handleSelectedTextSizeChange}
              onSelectedTextCaseChange={handleSelectedTextCaseChange}
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
        hidden
        onChange={(event) => void handleImageSelected(event.target.files?.[0] ?? null)}
      />
      <input
        ref={backgroundImageInputRef}
        type="file"
        accept="image/*"
        hidden
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

function hasCustomSlidePhoto(slide: Slide) {
  return slide.elements.some(
    (element) => element.type === "image" && element.metaKey !== "image-top"
  );
}

function prepareSlidesForExport(
  sourceSlides: Slide[],
  templateId: CarouselTemplateId,
  slideFormat: SlideFormat
) {
  const themedSlides = applyTemplateToSlides(cloneSlides(sourceSlides), templateId, slideFormat);

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
      templateId,
      index,
      themedSlides.length,
      slideFormat
    );
  });
}

function cloneSlides(slides: Slide[]) {
  return slides.map((slide) => ({
    ...slide,
    elements: slide.elements.map((element) => ({ ...element }))
  }));
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

  try {
    const optimized = await downscaleDataUrl(original, 1800);
    return optimized.length < original.length ? optimized : original;
  } catch {
    return original;
  }
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

  return value;
}

async function downscaleDataUrl(dataUrl: string, maxSide: number) {
  const image = await loadHtmlImage(dataUrl);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);

  if (!longestSide || longestSide <= maxSide) {
    return dataUrl;
  }

  const ratio = maxSide / longestSide;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * ratio);
  canvas.height = Math.round(image.naturalHeight * ratio);

  const context = canvas.getContext("2d");
  if (!context) {
    return dataUrl;
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const webp = canvas.toDataURL("image/webp", 0.88);
  return webp.startsWith("data:image/webp") ? webp : dataUrl;
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
