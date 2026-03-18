"use client";

import { saveAs } from "file-saver";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import { AppIcon } from "@/components/icons";
import { CanvasEditor } from "@/components/CanvasEditor";
import { MobileTools, type MobileToolTab } from "@/components/MobileTools";
import { SettingsPanel } from "@/components/SettingsPanel";
import { SlideStage } from "@/components/SlideStage";
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
  setSlideBackgroundImageStyle,
  setSlideFrameColor,
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
import type {
  CanvasElement,
  CarouselOutlineSlide,
  CarouselTemplateId,
  FooterVariantId,
  Slide,
  SlideFormat,
  TemplateCategoryId,
  TextElement
} from "@/types/editor";

const DEFAULT_STATUS = "Новая сессия: между открытиями история не сохраняется.";
const MOBILE_BREAKPOINT = 768;
const MAX_TOPIC_CHARS = 4000;
const MIN_TOPIC_CHARS = 3;
const EXPORT_LOCK_STATUS = "Дождитесь завершения экспорта и повторите действие.";
const GENERATE_LOCK_STATUS = "Дождитесь завершения генерации и повторите действие.";
const IMAGE_MODE_TEMPLATE_ROTATION: CarouselTemplateId[] = [
  "technology",
  "editorial",
  "business-light"
];
const DECOR_BACKGROUND_META_KEYS = new Set([
  "decor-bg",
  "decor-paper",
  "decor-dots-bg",
  "decor-lines-bg",
  "decor-bolts-bg"
]);

type ExportMode = "zip" | "png" | "jpg" | "pdf";
const HISTORY_LIMIT = 40;
const MOBILE_PREVIEW_MAX_WIDTH: Record<SlideFormat, number> = {
  "1:1": 324,
  "4:5": 338,
  "9:16": 312
};

type HistorySnapshot = {
  slides: Slide[];
  activeSlideId: string | null;
  slideFormat: SlideFormat;
};

export function Editor() {
  const [slides, setSlides] = useState<Slide[]>(() => createStarterSlides("technology", "1:1"));
  const [topic, setTopic] = useState("");
  const [slidesCount, setSlidesCount] = useState(DEFAULT_SLIDES_COUNT);
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);
  const [slideFormat, setSlideFormat] = useState<SlideFormat>("1:1");
  const [activeTemplateCategory, setActiveTemplateCategory] =
    useState<TemplateCategoryId>("light");
  const [templateScope, setTemplateScope] = useState<"slide" | "all">("slide");
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [displaySize, setDisplaySize] = useState(596);
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingTextElementId, setEditingTextElementId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [exportMode, setExportMode] = useState<ExportMode>("zip");
  const [isExportRendering, setIsExportRendering] = useState(false);
  const [mobileToolTab, setMobileToolTab] = useState<MobileToolTab | null>(null);
  const [mobileBottomOffset, setMobileBottomOffset] = useState(120);
  const [pendingImageSlideId, setPendingImageSlideId] = useState<string | null>(null);
  const [pendingBackgroundSlideId, setPendingBackgroundSlideId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showSlideBadge, setShowSlideBadge] = useState(true);
  const [useInternetImages, setUseInternetImages] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
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
  const activeImageBlockElement = useMemo(
    () =>
      activeSlide?.elements.find(
        (element): element is Extract<CanvasElement, { type: "image" }> =>
          element.type === "image" && element.metaKey === "internet-image-top"
      ) ?? null,
    [activeSlide]
  );
  const hasImageBlockLayout = Boolean(
    activeSlide?.backgroundImage &&
      (activeSlide?.imageLayoutMode === "top" || activeSlide?.imageLayoutMode === "bottom")
  );
  const activeHasBackgroundImage = useMemo(() => {
    if (!activeSlide) {
      return false;
    }
    if (Boolean(activeSlide.backgroundImage)) {
      return true;
    }
    return activeSlide.elements.some(
      (element) =>
        element.type === "image" &&
        (element.metaKey === "background-image" || element.metaKey === "internet-image-top")
    );
  }, [activeSlide]);

  useEffect(() => {
    if (
      selectedElement &&
      (selectedElement.type === "shape" ||
        (selectedElement.type === "image" && selectedElement.metaKey === "background-image"))
    ) {
      setSelectedElementId(null);
    }
  }, [selectedElement]);

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
    () => activeSlide?.templateId ?? slides[0]?.templateId ?? "technology",
    [activeSlide, slides]
  );
  const generationLocked = isGenerating || isExportRendering;
  const exportModeLabel = getExportModeLabel(exportMode);
  const canUndo = historyPast.length > 0;
  const canRedo = historyFuture.length > 0;

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

  useEffect(() => {
    setActiveTemplateCategory(getTemplate(activeTemplateId).category);
  }, [activeTemplateId]);

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

  const updateElement = (
    elementId: string,
    updater: (element: CanvasElement) => CanvasElement,
    options?: { recordHistory?: boolean }
  ) => {
    updateActiveSlide((slide) => {
      const previous = slide.elements.find((element) => element.id === elementId);
      const nextElements = slide.elements.map((element) =>
        element.id === elementId ? updater(element) : element
      );
      const next = nextElements.find((element) => element.id === elementId);

      const shouldReflowManagedText =
        activeSlideIndex !== -1 &&
        previous?.type === "text" &&
        next?.type === "text" &&
        previous.text !== next.text &&
        (next.metaKey === "managed-title" || next.metaKey === "managed-body");

      if (shouldReflowManagedText) {
        const rebuiltSlide = applyTemplateToSlide(
          {
            ...slide,
            elements: nextElements
          },
          slide.templateId ?? "technology",
          activeSlideIndex,
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
            height: next.height,
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

  const normalizeImageBlockLayout = (
    slide: Slide,
    options?: {
      mode?: "top" | "bottom";
      imageHeight?: number;
    }
  ) => {
    const card = slide.elements.find(
      (element): element is Extract<CanvasElement, { type: "shape" }> =>
        element.type === "shape" && element.metaKey === "image-top-card"
    );
    const image = slide.elements.find(
      (element): element is Extract<CanvasElement, { type: "image" }> =>
        element.type === "image" && element.metaKey === "internet-image-top"
    );

    if (!card || !image) {
      return slide;
    }

    const mode =
      options?.mode ??
      (slide.imageLayoutMode === "bottom" ? "bottom" : "top");
    const imageHeight = clampValue(
      options?.imageHeight ?? image.height,
      slideFormat === "9:16" ? 300 : slideFormat === "4:5" ? 240 : 210,
      slideFormat === "9:16" ? 760 : slideFormat === "4:5" ? 610 : 500
    );
    const cardPadding = 20;
    const textPadX = 52;
    const panelPad = 18;
    const footerReserve = slideFormat === "9:16" ? 194 : slideFormat === "4:5" ? 176 : 166;
    const maxImageBottom = card.y + card.height - footerReserve;
    const imageY =
      mode === "bottom" ? Math.max(card.y + 220, maxImageBottom - imageHeight) : card.y + cardPadding;
    const imageX = card.x + cardPadding;
    const imageWidth = card.width - cardPadding * 2;
    const panelY = mode === "bottom" ? card.y + panelPad : imageY + imageHeight - 2;
    const panelHeight =
      mode === "bottom"
        ? Math.max(170, imageY - panelY - 16)
        : Math.max(170, card.y + card.height - panelY - 16);
    const textX = card.x + textPadX;
    const textWidth = card.width - textPadX * 2;
    const titleY = panelY + 46;
    const maxBodyBottom =
      mode === "bottom"
        ? imageY - 34
        : card.y + card.height - (slideFormat === "9:16" ? 170 : 146);

    const nextElements = slide.elements.map((element) => {
      if (element.type === "image" && element.metaKey === "internet-image-top") {
        return {
          ...element,
          x: imageX,
          y: imageY,
          width: imageWidth,
          height: imageHeight
        };
      }

      if (element.type === "shape" && element.metaKey === "image-top-frame") {
        return {
          ...element,
          x: imageX - 2,
          y: imageY - 2,
          width: imageWidth + 4,
          height: imageHeight + 4
        };
      }

      if (element.type === "shape" && element.metaKey === "image-top-text-panel") {
        return {
          ...element,
          x: card.x + panelPad,
          y: panelY,
          width: card.width - panelPad * 2,
          height: panelHeight
        };
      }

      if (element.type === "shape" && element.metaKey === "image-top-divider") {
        return {
          ...element,
          x: textX,
          y: panelY + 20
        };
      }

      if (element.type === "text" && element.metaKey === "managed-title") {
        const titleHeight = clampValue(element.height, 54, Math.max(84, panelHeight - 120));
        return {
          ...element,
          x: textX,
          y: titleY,
          width: textWidth,
          height: titleHeight
        };
      }

      if (element.type === "text" && element.metaKey === "managed-body") {
        const titleElement = slide.elements.find(
          (item): item is Extract<CanvasElement, { type: "text" }> =>
            item.type === "text" && item.metaKey === "managed-title"
        );
        const nextBodyY =
          titleY +
          clampValue(titleElement?.height ?? 92, 52, Math.max(84, panelHeight - 120)) +
          24;
        const maxHeight = Math.max(42, maxBodyBottom - nextBodyY);
        return {
          ...element,
          x: textX,
          y: nextBodyY,
          width: textWidth,
          height: clampValue(element.height, 42, maxHeight)
        };
      }

      return element;
    });

    return {
      ...slide,
      imageLayoutMode: mode,
      elements: nextElements
    };
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
        useInternetImages
          ? `Генерирую ${requestedSlidesCount} слайдов и подбираю интернет-фото...`
          : `Генерирую структуру через OpenAI (${requestedSlidesCount} слайдов, формат ${slideFormat})...`
      );
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
          useInternetImages
        }),
        signal: controller.signal
      }).finally(() => {
        window.clearTimeout(timeoutId);
      });

      let data: {
        slides?: CarouselOutlineSlide[];
        internetImages?: Array<{
          slideIndex: number;
          imageUrl: string;
          relevanceScore?: number;
          source?: string;
          query?: string;
        }>;
        error?: string;
      };
      try {
        data = (await response.json()) as {
          slides?: CarouselOutlineSlide[];
          internetImages?: Array<{
            slideIndex: number;
            imageUrl: string;
            relevanceScore?: number;
            source?: string;
            query?: string;
          }>;
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
      const withInternetImages = useInternetImages
        ? applyInternetImagesToSlides(nextSlides, data.internetImages ?? [], slideFormat)
        : nextSlides;
      const addedInternetImages =
        withInternetImages.filter((slide) => Boolean(slide.backgroundImage)).length -
        nextSlides.filter((slide) => Boolean(slide.backgroundImage)).length;
      pushHistorySnapshot(true);
      setSlides(withInternetImages);
      setActiveSlideId(withInternetImages[0]?.id ?? null);
      setSelectedElementId(null);
      setEditingTextElementId(null);
      setStatus(
        addedInternetImages > 0
          ? `Создано ${withInternetImages.length} слайдов, добавлено ${addedInternetImages} интернет-фото.`
          : useInternetImages
            ? `Создано ${withInternetImages.length} слайдов. Релевантные интернет-фото не найдены, оставлен текстовый layout.`
            : `Создано ${withInternetImages.length} слайдов в формате ${slideFormat}.`
      );
    } catch (error) {
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

  const handleBackgroundChange = (color: string) => {
    if (generationLocked) {
      setStatus(GENERATE_LOCK_STATUS);
      return;
    }

    updateActiveSlide((slide) => ({
      ...slide,
      background: color,
      elements: slide.elements.map((element) => {
        if (
          element.type === "shape" &&
          element.metaKey &&
          DECOR_BACKGROUND_META_KEYS.has(element.metaKey)
        ) {
          return {
            ...element,
            fill: color
          };
        }

        return element;
      })
    }));
  };

  const handleFrameColorChange = (color: string) => {
    if (generationLocked) {
      return;
    }

    if (!activeSlide || activeSlideIndex === -1) {
      return;
    }

    updateSlide(activeSlide.id, (slide) =>
      setSlideFrameColor(slide, color, activeSlideIndex, slides.length, slideFormat)
    );
  };

  const handleUpdateBackgroundImageStyle = (updates: {
    fitMode?: "cover" | "contain" | "original";
    zoom?: number;
    offsetX?: number;
    offsetY?: number;
    darken?: number;
  }) => {
    if (generationLocked) {
      return;
    }

    if (!activeSlide || activeSlideIndex === -1 || !activeSlide.backgroundImage) {
      return;
    }

    updateSlide(activeSlide.id, (slide) =>
      setSlideBackgroundImageStyle(slide, updates, activeSlideIndex, slides.length, slideFormat)
    );
  };

  const handleApplyGlobalTypography = (titleFont: string, bodyFont: string) => {
    if (generationLocked) {
      return;
    }

    pushHistorySnapshot(true);
    setSlides((current) =>
      current.map((slide) => ({
        ...slide,
        elements: slide.elements.map((element) => {
          if (element.type !== "text") {
            return element;
          }

          if (element.metaKey === "managed-title" || element.role === "title") {
            return {
              ...element,
              fontFamily: titleFont
            };
          }

          if (
            element.metaKey === "managed-body" ||
            element.role === "body" ||
            element.metaKey === "profile-handle" ||
            element.metaKey === "profile-subtitle"
          ) {
            return {
              ...element,
              fontFamily: bodyFont
            };
          }

          return element;
        })
      }))
    );
    setStatus("Глобальная типографика применена ко всей карусели.");
  };

  const handleToggleImageBlockPosition = () => {
    if (generationLocked || !activeSlide || activeSlideIndex === -1 || !hasImageBlockLayout) {
      return;
    }

    const nextMode = activeSlide.imageLayoutMode === "bottom" ? "top" : "bottom";
    updateSlide(activeSlide.id, (slide) => normalizeImageBlockLayout(slide, { mode: nextMode }));
    setStatus(
      nextMode === "bottom"
        ? "Блок изображения перемещён вниз."
        : "Блок изображения перемещён вверх."
    );
  };

  const handleSetImageBlockHeight = (height: number) => {
    if (generationLocked || !activeSlide || activeSlideIndex === -1 || !hasImageBlockLayout) {
      return;
    }

    updateSlide(activeSlide.id, (slide) =>
      normalizeImageBlockLayout(slide, {
        imageHeight: height
      })
    );
  };

  const handleResetSelectedRotation = () => {
    if (generationLocked || !selectedElementId) {
      return;
    }

    updateElement(selectedElementId, (element) => ({
      ...element,
      rotation: 0
    }));
    setStatus("Поворот элемента сброшен.");
  };

  const handleUpdateElementPosition = (elementId: string, x: number, y: number) => {
    if (generationLocked) {
      return;
    }

    updateElement(elementId, (element) => ({
      ...element,
      x,
      y
    }));
  };

  const handleTransformElement = (elementId: string, updates: Record<string, number>) => {
    if (generationLocked) {
      return;
    }

    updateElement(elementId, (element) => ({
      ...element,
      ...updates
    }));
  };

  const handleInsertSlideAt = (index: number) => {
    if (generationLocked) {
      setStatus(isGenerating ? GENERATE_LOCK_STATUS : EXPORT_LOCK_STATUS);
      return;
    }

    const nextSlide = createBlankSlide(index, activeTemplateId, slideFormat, slides.length + 1);
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
      fill: "#1f2a2d"
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
      const targetSlideId = pendingImageSlideId ?? activeSlideId;

      if (!targetSlideId) {
        throw new Error("Не найден слайд для добавления изображения.");
      }

      updateSlide(targetSlideId, (slide) => ({
        ...slide,
        elements: [...slide.elements, element]
      }));

      setActiveSlideId(targetSlideId);
      setSelectedElementId(element.id);
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
        setSlideBackgroundImage(slide, dataUrl, slideIndex, slides.length, slideFormat)
      );

      setActiveSlideId(targetSlideId);
      setSelectedElementId(null);
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

  const handleApplyTemplate = (templateId: CarouselTemplateId) => {
    if (generationLocked) {
      setStatus(isGenerating ? GENERATE_LOCK_STATUS : EXPORT_LOCK_STATUS);
      return;
    }

    pushHistorySnapshot(true);
    if (templateScope === "all") {
      setSlides((current) => applyTemplateToSlides(current, templateId, slideFormat));
      setStatus("Шаблон применён ко всей карусели.");
    } else {
      if (!activeSlide || activeSlideIndex === -1) {
        return;
      }

      updateSlide(activeSlide.id, (slide) =>
        applyTemplateToSlide(slide, templateId, activeSlideIndex, slides.length, slideFormat)
      );
      setStatus("Шаблон применён к текущему слайду.");
    }

    setSelectedElementId(null);
    setEditingTextElementId(null);
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
    updates: Partial<Pick<Slide, "profileHandle" | "profileSubtitle" | "footerVariant">>
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

  const handleSelectSlide = (slideId: string) => {
    if (generationLocked) {
      return;
    }

    setActiveSlideId(slideId);
    setSelectedElementId(null);
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

  const handleResetSession = () => {
    if (generationLocked) {
      setStatus("Дождитесь завершения текущей операции и повторите.");
      return;
    }

    const starterSlides = createStarterSlides("technology", slideFormat);
    pushHistorySnapshot(true);
    setSlides(starterSlides);
    setTopic("");
    setSlidesCount(DEFAULT_SLIDES_COUNT);
    setActiveSlideId(starterSlides[0]?.id ?? null);
    setSelectedElementId(null);
    setEditingTextElementId(null);
    setEditingValue("");
    setMobileToolTab(null);
    setExportMode("zip");
    setUseInternetImages(false);
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
    updateSlide(slideId, (slide) => ({
      ...slide,
      elements: slide.elements.map((element) =>
        element.id === elementId ? { ...element, x, y } : element
      )
    }));
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
    updateSlide(slideId, (slide) => ({
      ...normalizeImageBlockLayout({
        ...slide,
        elements: slide.elements.map((element) =>
          element.id === elementId ? { ...element, ...updates } : element
        )
      })
    }));
  };

  const getSlideDataUrl = (slideId: string) => {
    const stage = exportStageRefs.current[slideId];

    if (!stage) {
      throw new Error("Экспортируемый слайд ещё не готов.");
    }

    stage.draw();

    return stage.toDataURL({ pixelRatio: 2 });
  };

  const ensureExportStagesReady = async () => {
    const targetIds = slides.map((slide) => slide.id);
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
    filenameSuffix = "slides",
    imageType: "png" | "jpg" = "png"
  ) => {
    const zip = new JSZip();

    for (let index = 0; index < slides.length; index += 1) {
      const rawDataUrl = getSlideDataUrl(slides[index].id);
      const exportDataUrl =
        imageType === "jpg" ? await convertDataUrlToJpeg(rawDataUrl) : rawDataUrl;
      const base64 = exportDataUrl.replace(/^data:image\/(?:png|jpeg);base64,/, "");
      zip.file(`slide${index + 1}.${imageType}`, base64, { base64: true });
    }

    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${slugify(projectTitleFromTopic(topic))}-${filenameSuffix}.zip`);
  };

  const handleExport = async () => {
    if (isGenerating) {
      setStatus(GENERATE_LOCK_STATUS);
      return;
    }

    if (isExportRendering) {
      return;
    }

    setIsExportRendering(true);
    try {
      if (!slides.length) {
        return;
      }

      setStatus(`Подготавливаю экспорт: ${exportModeLabel}.`);
      const imagesReady = await ensureExportStagesReady();
      if (!imagesReady) {
        throw new Error(
          "Не удалось дождаться загрузки всех изображений для экспорта. Повторите попытку через несколько секунд."
        );
      }

      if (exportMode === "png" || exportMode === "jpg") {
        const imageType = exportMode === "jpg" ? "jpg" : "png";

        if (slides.length === 1) {
          const rawDataUrl = getSlideDataUrl(slides[0].id);
          const exportDataUrl =
            imageType === "jpg" ? await convertDataUrlToJpeg(rawDataUrl) : rawDataUrl;
          const blob = await dataUrlToBlob(exportDataUrl);
          saveAs(blob, `${slugify(projectTitleFromTopic(topic))}-slide1.${imageType}`);
          setStatus(`${imageType.toUpperCase()} скачан.`);
          return;
        }

        await exportSlidesAsZip(
          imageType === "jpg" ? "slides-jpg" : "slides-png",
          imageType
        );
        setStatus(`${imageType.toUpperCase()} всех слайдов скачаны одним архивом.`);
        return;
      }

      if (exportMode === "pdf") {
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "px",
          format: [slideDimensions.width, slideDimensions.height]
        });

        slides.forEach((slide, index) => {
          const dataUrl = getSlideDataUrl(slide.id);

          if (index > 0) {
            pdf.addPage([slideDimensions.width, slideDimensions.height], "portrait");
          }

          pdf.addImage(dataUrl, "PNG", 0, 0, slideDimensions.width, slideDimensions.height);
        });

        pdf.save(`${slugify(projectTitleFromTopic(topic))}.pdf`);
        setStatus("PDF экспортирован.");
        return;
      }

      await exportSlidesAsZip("slides", "png");
      setStatus("Архив со слайдами скачан.");
    } catch (error) {
      setStatus(resolveUserFacingError(error, "Ошибка экспорта. Попробуйте снова."));
    } finally {
      setIsExportRendering(false);
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
            useInternetImages={useInternetImages}
            onUseInternetImagesChange={setUseInternetImages}
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
                onSelectSlide={handleSelectSlide}
                onSelectElement={handleSelectElement}
                onUpdateElementPosition={handleUpdateElementPositionBySlide}
                onTransformElement={handleTransformElementBySlide}
                onInsertSlideAt={handleInsertSlideAt}
                onAddTextToSlide={handleAddText}
                onAddImageToSlide={handleAddImage}
                onDeleteSelectedElement={handleDeleteElement}
                onMoveSlide={handleMoveSlide}
                onDeleteSlide={handleDeleteSlide}
                disabled={generationLocked}
                previewMode={isPreviewMode}
                showSlideBadge={showSlideBadge}
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
                  selectedElement={selectedElement}
                  activeTemplateId={activeTemplateId}
                  activeTemplateCategory={activeTemplateCategory}
                  templateScope={templateScope}
                  activeFormat={slideFormat}
                  footerVariant={activeSlide.footerVariant ?? "v1"}
                  profileHandle={activeSlide.profileHandle ?? ""}
                  profileSubtitle={activeSlide.profileSubtitle ?? ""}
                  hasBackgroundImage={activeHasBackgroundImage}
                  exportMode={exportMode}
                  isGenerating={isGenerating}
                  isExporting={isExportRendering}
                  onExportModeChange={setExportMode}
                  onExport={handleExport}
                  onBackgroundChange={handleBackgroundChange}
                  frameColor={activeSlide.frameColor ?? "#ffffff"}
                  onFrameColorChange={handleFrameColorChange}
                  onUpdateBackgroundImageStyle={handleUpdateBackgroundImageStyle}
                  backgroundImageFitMode={activeSlide.backgroundImageFitMode ?? "cover"}
                  backgroundImageZoom={activeSlide.backgroundImageZoom ?? 1}
                  backgroundImageOffsetX={activeSlide.backgroundImageOffsetX ?? 0}
                  backgroundImageOffsetY={activeSlide.backgroundImageOffsetY ?? 0}
                  backgroundImageDarken={activeSlide.backgroundImageDarken ?? 0}
                  hasImageBlockLayout={hasImageBlockLayout}
                  imageBlockPosition={activeSlide.imageLayoutMode ?? "background"}
                  imageBlockHeight={activeImageBlockElement?.height ?? 360}
                  onToggleImageBlockPosition={handleToggleImageBlockPosition}
                  onImageBlockHeightChange={handleSetImageBlockHeight}
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
                  onTemplateCategoryChange={setActiveTemplateCategory}
                  onTemplateScopeChange={setTemplateScope}
                  onApplyTemplate={handleApplyTemplate}
                  onSelectSlide={handleSelectSlide}
                  onInsertSlideAt={handleInsertSlideAt}
                  onDeleteSlide={handleDeleteSlide}
                  onProfileHandleChange={(value) => handleUpdateFooter({ profileHandle: value })}
                  onProfileSubtitleChange={(value) => handleUpdateFooter({ profileSubtitle: value })}
                  onFooterVariantChange={(value) =>
                    handleUpdateFooter({ footerVariant: value as FooterVariantId })
                  }
                  onUpdateElement={updateElement}
                  onApplyGlobalTypography={handleApplyGlobalTypography}
                  onResetElementRotation={handleResetSelectedRotation}
                  disabled={generationLocked}
                  previewMode={isPreviewMode}
                  showSlideBadge={showSlideBadge}
                  onToggleSlideBadge={() => setShowSlideBadge((value) => !value)}
                />
              ) : null}
            </aside>
          </div>
        </div>
      </div>

      <div className="mobile-only">
        <div className="mobile-editor-shell">
          <header className="mobile-topbar">
            <div className="mobile-top-actions">
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
              <button
                className="mobile-icon-button"
                type="button"
                title={isPreviewMode ? "Выключить превью" : "Включить превью"}
                onClick={() => setIsPreviewMode((value) => !value)}
                disabled={generationLocked}
              >
                <AppIcon name={isPreviewMode ? "eye-off" : "eye"} size={16} />
              </button>
              <button
                className="mobile-icon-button mobile-icon-button-muted"
                type="button"
                title="Новая сессия"
                onClick={handleResetSession}
                disabled={generationLocked}
              >
                <AppIcon name="reset" size={16} />
              </button>
            </div>

            <div className="mobile-top-selects">
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

              <select
                className="mobile-export-mode-select"
                value={exportMode}
                onChange={(event) => setExportMode(event.target.value as ExportMode)}
                aria-label="Режим экспорта"
                disabled={generationLocked}
              >
                <option value="zip">ZIP</option>
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
                <option value="pdf">PDF</option>
              </select>
            </div>

            <button
              className="mobile-export-button"
              type="button"
              onClick={handleExport}
              disabled={isExportRendering || isGenerating}
              title={`Экспорт в ${exportModeLabel}`}
            >
              {isExportRendering ? "Экспорт..." : "Экспорт"}
            </button>
          </header>

          <details className="mobile-generate-panel">
            <summary>Генерация карусели</summary>
            <div className="mobile-generate-body">
              <textarea
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Введите тему карусели или вставьте готовую идею"
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
              <label className="mobile-generate-toggle">
                <input
                  type="checkbox"
                  checked={useInternetImages}
                  onChange={(event) => setUseInternetImages(event.target.checked)}
                  disabled={generationLocked}
                />
                <span>
                  Использовать картинки из интернета
                  <small>Автоподбор 1-3 релевантных фото по теме</small>
                </span>
              </label>
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
              onSelectSlide={handleSelectSlide}
              onSelectElement={handleSelectElement}
              onUpdateElementPosition={handleUpdateElementPositionBySlide}
              onTransformElement={handleTransformElementBySlide}
              onInsertSlideAt={handleInsertSlideAt}
              onAddTextToSlide={handleAddText}
              onAddImageToSlide={handleAddImage}
              onDeleteSelectedElement={handleDeleteElement}
              onMoveSlide={handleMoveSlide}
              onDeleteSlide={handleDeleteSlide}
              disabled={generationLocked}
              previewMode={isPreviewMode}
              showSlideBadge={showSlideBadge}
              fontsReady={fontsReady}
            />
          </section>

          {activeSlide ? (
            <MobileTools
              activeTab={mobileToolTab}
              onTabChange={setMobileToolTab}
              slide={activeSlide}
              selectedElement={selectedElement}
              activeTemplateId={activeTemplateId}
              activeTemplateCategory={activeTemplateCategory}
              templateScope={templateScope}
              footerVariant={activeSlide.footerVariant ?? "v1"}
              profileHandle={activeSlide.profileHandle ?? ""}
              profileSubtitle={activeSlide.profileSubtitle ?? ""}
              hasBackgroundImage={activeHasBackgroundImage}
              onBackgroundChange={handleBackgroundChange}
              frameColor={activeSlide.frameColor ?? "#ffffff"}
              onFrameColorChange={handleFrameColorChange}
              onUpdateBackgroundImageStyle={handleUpdateBackgroundImageStyle}
              backgroundImageFitMode={activeSlide.backgroundImageFitMode ?? "cover"}
              backgroundImageZoom={activeSlide.backgroundImageZoom ?? 1}
              backgroundImageOffsetX={activeSlide.backgroundImageOffsetX ?? 0}
              backgroundImageOffsetY={activeSlide.backgroundImageOffsetY ?? 0}
              backgroundImageDarken={activeSlide.backgroundImageDarken ?? 0}
              hasImageBlockLayout={hasImageBlockLayout}
              imageBlockPosition={activeSlide.imageLayoutMode ?? "background"}
              imageBlockHeight={activeImageBlockElement?.height ?? 360}
              onToggleImageBlockPosition={handleToggleImageBlockPosition}
              onImageBlockHeightChange={handleSetImageBlockHeight}
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
              onTemplateCategoryChange={setActiveTemplateCategory}
              onTemplateScopeChange={setTemplateScope}
              onApplyTemplate={handleApplyTemplate}
              onProfileHandleChange={(value) => handleUpdateFooter({ profileHandle: value })}
              onProfileSubtitleChange={(value) => handleUpdateFooter({ profileSubtitle: value })}
              onFooterVariantChange={(value) => handleUpdateFooter({ footerVariant: value })}
              onUpdateElement={updateElement}
              onApplyGlobalTypography={handleApplyGlobalTypography}
              onResetElementRotation={handleResetSelectedRotation}
              toolbarRef={mobileToolbarRef}
              toolSheetRef={mobileToolSheetRef}
              disabled={generationLocked}
              previewMode={isPreviewMode}
              showSlideBadge={showSlideBadge}
              onToggleSlideBadge={() => setShowSlideBadge((value) => !value)}
            />
          ) : null}
        </div>
      </div>

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

      {isExportRendering ? (
        <div className="hidden-export-stages" aria-hidden="true">
          {slides.map((slide) => (
            <SlideStage
              key={`export-${slide.id}`}
              slide={slide}
              width={slideDimensions.width}
              height={slideDimensions.height}
              canvasWidth={slideDimensions.width}
              canvasHeight={slideDimensions.height}
              showSlideBadge={showSlideBadge}
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

function applyInternetImagesToSlides(
  slides: Slide[],
  suggestions: Array<{
    slideIndex: number;
    imageUrl: string;
    relevanceScore?: number;
    source?: string;
    query?: string;
  }>,
  format: SlideFormat
) {
  if (!suggestions.length) {
    return slides;
  }

  const nextSlides = cloneSlides(slides);
  const maxSuggestions = Math.min(3, suggestions.length);
  const usedSlides = new Set<number>();

  for (let index = 0; index < maxSuggestions; index += 1) {
    const suggestion = suggestions[index];
    if (
      !suggestion ||
      !suggestion.imageUrl ||
      (typeof suggestion.relevanceScore === "number" && suggestion.relevanceScore < 0.38)
    ) {
      continue;
    }

    const safeSlideIndex = clampValue(
      Number.isFinite(suggestion.slideIndex) ? Math.round(suggestion.slideIndex) : 0,
      0,
      nextSlides.length - 1
    );
    if (usedSlides.has(safeSlideIndex)) {
      continue;
    }
    const targetSlide = nextSlides[safeSlideIndex];

    if (!targetSlide) {
      continue;
    }

    const fallbackTemplateId = IMAGE_MODE_TEMPLATE_ROTATION[index % IMAGE_MODE_TEMPLATE_ROTATION.length];
    const templateId =
      typeof targetSlide.templateId === "string" && targetSlide.templateId.trim()
        ? targetSlide.templateId
        : fallbackTemplateId;
    const withImage = setSlideBackgroundImage(
      targetSlide,
      suggestion.imageUrl,
      safeSlideIndex,
      nextSlides.length,
      format,
      "top"
    );
    nextSlides[safeSlideIndex] =
      withImage.templateId === templateId
        ? withImage
        : applyTemplateToSlide(withImage, templateId, safeSlideIndex, nextSlides.length, format);
    usedSlides.add(safeSlideIndex);
  }

  return nextSlides;
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

async function waitForNextFrame() {
  return await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function cloneSlides(slides: Slide[]) {
  return slides.map((slide) => ({
    ...slide,
    elements: slide.elements.map((element) => ({ ...element }))
  }));
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

function clampValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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
