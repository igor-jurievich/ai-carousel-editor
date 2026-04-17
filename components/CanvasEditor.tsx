"use client";

import { FileSliders, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type TouchEvent } from "react";
import { SLIDE_FORMAT_DIMENSIONS } from "@/lib/carousel";
import type { CanvasElement, Slide, SlideFormat, TextElement } from "@/types/editor";
import { SlideStage } from "@/components/SlideStage";
import { AppIcon, type AppIconName } from "@/components/icons";

type CanvasEditorProps = {
  slides: Slide[];
  activeSlideId: string | null;
  activeFormat: SlideFormat;
  mode?: "stack" | "single";
  displayWidth: number;
  displayHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  selectedElementId: string | null;
  selectedElement: CanvasElement | null;
  editingTextElementId?: string | null;
  editingTextElement: TextElement | null;
  editingValue: string;
  onEditingValueChange: (value: string) => void;
  onEditingSelectionChange?: (start: number, end: number) => void;
  onCommitTextEditing: (value?: string) => void;
  onCancelTextEditing: () => void;
  onStartTextEditing: (slideId: string, elementId: string) => void;
  onSelectSlide: (slideId: string) => void;
  onSelectElement: (slideId: string, elementId: string | null) => void;
  onUpdateElementPosition: (slideId: string, elementId: string, x: number, y: number) => void;
  onTransformElement: (
    slideId: string,
    elementId: string,
    updates: Record<string, number>
  ) => void;
  onInsertSlideAt: (index: number, slideType?: "text" | "image_text" | "big_text") => void;
  onAddTextToSlide: (slideId: string) => void;
  onAddImageToSlide: (slideId: string) => void;
  onAddBackgroundImageToSlide?: (slideId: string) => void;
  onDeleteSelectedElement: () => void;
  onDuplicateSlide: (slideId: string) => void;
  onMoveSlide: (slideId: string, direction: "up" | "down") => void;
  onDeleteSlide: (slideId: string) => void;
  onOpenTemplateModal: () => void;
  onRequestProfileHandleEdit?: () => void;
  onVisibleSlideChange?: (slideId: string) => void;
  scrollToSlideRequest?: { id: string; token: number } | null;
  disabled?: boolean;
  previewMode?: boolean;
  showSlideBadge?: boolean;
  fontsReady?: boolean;
  hideMobileSlideTools?: boolean;
  isLoading?: boolean;
  onNavigateToPrompt?: () => void;
};

export function CanvasEditor({
  slides,
  activeSlideId,
  activeFormat,
  mode = "stack",
  displayWidth,
  displayHeight,
  canvasWidth,
  canvasHeight,
  selectedElementId,
  selectedElement,
  editingTextElementId = null,
  editingTextElement,
  editingValue,
  onEditingValueChange,
  onEditingSelectionChange,
  onCommitTextEditing,
  onCancelTextEditing,
  onStartTextEditing,
  onSelectSlide,
  onSelectElement,
  onUpdateElementPosition,
  onTransformElement,
  onInsertSlideAt,
  onAddTextToSlide,
  onAddImageToSlide,
  onAddBackgroundImageToSlide,
  onDeleteSelectedElement,
  onDuplicateSlide,
  onMoveSlide,
  onDeleteSlide,
  onOpenTemplateModal,
  onRequestProfileHandleEdit,
  onVisibleSlideChange,
  scrollToSlideRequest,
  disabled = false,
  previewMode = false,
  showSlideBadge = true,
  fontsReady = true,
  hideMobileSlideTools = false,
  isLoading = false,
  onNavigateToPrompt
}: CanvasEditorProps) {
  const SWIPE_THRESHOLD_PX = 50;
  const SWIPE_MAX_Y_DELTA_PX = 44;
  const SWIPE_MAX_ELAPSED_MS = 650;
  const SWIPE_TRANSITION_MS = 200;
  const scale = displayWidth / canvasWidth;
  const formatLabel = SLIDE_FORMAT_DIMENSIONS[activeFormat].label;
  const activeSlide = slides.find((slide) => slide.id === activeSlideId) ?? slides[0] ?? null;
  const activeSlideIndex = activeSlide ? slides.findIndex((slide) => slide.id === activeSlide.id) : -1;
  const swipeStateRef = useRef<{ x: number; y: number; timestamp: number } | null>(null);
  const swipeCommitTimeoutRef = useRef<number | null>(null);
  const swipeResetTimeoutRef = useRef<number | null>(null);
  const [swipeOffsetX, setSwipeOffsetX] = useState(0);
  const [swipeTransitionEnabled, setSwipeTransitionEnabled] = useState(false);
  const stackScrollRef = useRef<HTMLDivElement | null>(null);
  const stackSlideRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const visibleFrameRef = useRef<number | null>(null);
  const lastVisibleSlideIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (swipeCommitTimeoutRef.current !== null) {
        window.clearTimeout(swipeCommitTimeoutRef.current);
      }
      if (swipeResetTimeoutRef.current !== null) {
        window.clearTimeout(swipeResetTimeoutRef.current);
      }
    };
  }, []);

  const emitMostVisibleSlide = () => {
    if (mode !== "stack" || !onVisibleSlideChange || !stackScrollRef.current || !slides.length) {
      return;
    }

    const root = stackScrollRef.current;
    const rootRect = root.getBoundingClientRect();
    const viewportTop = rootRect.top;
    const viewportBottom = rootRect.bottom;
    const viewportCenter = (viewportTop + viewportBottom) / 2;
    let bestId: string | null = null;
    let bestRatio = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const slide of slides) {
      const node = stackSlideRefs.current[slide.id];
      if (!node) {
        continue;
      }

      const rect = node.getBoundingClientRect();
      const overlap = Math.max(0, Math.min(rect.bottom, viewportBottom) - Math.max(rect.top, viewportTop));
      const ratio = overlap / Math.max(1, rect.height);
      if (ratio <= 0) {
        continue;
      }

      const center = (rect.top + rect.bottom) / 2;
      const distance = Math.abs(center - viewportCenter);

      if (ratio > bestRatio || (Math.abs(ratio - bestRatio) < 0.02 && distance < bestDistance)) {
        bestId = slide.id;
        bestRatio = ratio;
        bestDistance = distance;
      }
    }

    if (bestId && bestId !== lastVisibleSlideIdRef.current) {
      lastVisibleSlideIdRef.current = bestId;
      onVisibleSlideChange(bestId);
    }
  };

  const scheduleVisibleSlideCheck = () => {
    if (mode !== "stack") {
      return;
    }

    if (visibleFrameRef.current !== null) {
      cancelAnimationFrame(visibleFrameRef.current);
    }

    visibleFrameRef.current = requestAnimationFrame(() => {
      visibleFrameRef.current = null;
      emitMostVisibleSlide();
    });
  };

  useEffect(() => {
    scheduleVisibleSlideCheck();
    return () => {
      if (visibleFrameRef.current !== null) {
        cancelAnimationFrame(visibleFrameRef.current);
      }
    };
  }, [slides, mode]);

  useEffect(() => {
    if (mode !== "stack" || !scrollToSlideRequest?.id) {
      return;
    }

    const target = stackSlideRefs.current[scrollToSlideRequest.id];
    if (!target) {
      return;
    }

    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest"
    });
  }, [mode, scrollToSlideRequest]);

  if (isLoading) {
    return (
      <section className={`panel canvas-panel ${mode === "single" ? "canvas-panel-mobile" : ""}`}>
        <div className={`canvas-loading-shell ${mode === "single" ? "canvas-loading-shell-mobile" : ""}`}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="canvas-loading-card" aria-hidden="true" />
          ))}
        </div>
      </section>
    );
  }

  if (!slides.length) {
    return (
      <section className={`panel canvas-panel ${mode === "single" ? "canvas-panel-mobile" : ""}`}>
        <div className="canvas-empty-state">
          <FileSliders size={60} color="#d1d5db" />
          <p>Начни с промпта на главной</p>
          <button
            type="button"
            className="btn secondary canvas-empty-action"
            onClick={onNavigateToPrompt}
          >
            К промпту
          </button>
        </div>
      </section>
    );
  }

  if (mode === "single" && activeSlide) {
    const hiddenEditingElementId: string | null = null;
    const selectedElementStyle =
      selectedElement
        ? getFloatingActionStyle(selectedElement, scale, displayWidth, displayHeight, {
            buttonSize: 32,
            horizontalInset: 8,
            verticalInset: 8,
            horizontalOffset: 10,
            verticalOffset: 16
          })
        : null;
    const canGoPrev = activeSlideIndex > 0;
    const canGoNext = activeSlideIndex >= 0 && activeSlideIndex < slides.length - 1;
    const canSwipeNavigate =
      !disabled &&
      !previewMode &&
      !selectedElementId &&
      !editingTextElement &&
      slides.length > 1 &&
      !isLoading;

    const resetSwipeOffset = () => {
      if (swipeResetTimeoutRef.current !== null) {
        window.clearTimeout(swipeResetTimeoutRef.current);
      }
      setSwipeTransitionEnabled(true);
      setSwipeOffsetX(0);
      swipeResetTimeoutRef.current = window.setTimeout(() => {
        setSwipeTransitionEnabled(false);
        swipeResetTimeoutRef.current = null;
      }, SWIPE_TRANSITION_MS);
    };

    const handleSwipeStart = (event: TouchEvent<HTMLElement>) => {
      if (!canSwipeNavigate) {
        return;
      }

      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("button, input, select, textarea, [role='button']")
      ) {
        return;
      }

      const touch = event.touches[0];
      if (!touch) {
        return;
      }

      if (swipeCommitTimeoutRef.current !== null) {
        window.clearTimeout(swipeCommitTimeoutRef.current);
        swipeCommitTimeoutRef.current = null;
      }
      if (swipeResetTimeoutRef.current !== null) {
        window.clearTimeout(swipeResetTimeoutRef.current);
        swipeResetTimeoutRef.current = null;
      }
      setSwipeTransitionEnabled(false);
      setSwipeOffsetX(0);
      swipeStateRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        timestamp: Date.now()
      };
    };

    const handleSwipeMove = (event: TouchEvent<HTMLElement>) => {
      if (!canSwipeNavigate || !swipeStateRef.current) {
        return;
      }

      const touch = event.touches[0];
      if (!touch) {
        return;
      }

      const deltaX = touch.clientX - swipeStateRef.current.x;
      const deltaY = touch.clientY - swipeStateRef.current.y;

      if (Math.abs(deltaY) > Math.abs(deltaX) * 0.9 && Math.abs(deltaY) > 10) {
        return;
      }

      setSwipeTransitionEnabled(false);
      setSwipeOffsetX(Math.max(-displayWidth, Math.min(displayWidth, deltaX)));
      event.preventDefault();
    };

    const handleSwipeEnd = (event: TouchEvent<HTMLElement>) => {
      if (!canSwipeNavigate || !swipeStateRef.current) {
        swipeStateRef.current = null;
        if (swipeOffsetX !== 0) {
          resetSwipeOffset();
        }
        return;
      }

      const touch = event.changedTouches[0];
      if (!touch) {
        swipeStateRef.current = null;
        if (swipeOffsetX !== 0) {
          resetSwipeOffset();
        }
        return;
      }

      const deltaX = touch.clientX - swipeStateRef.current.x;
      const deltaY = touch.clientY - swipeStateRef.current.y;
      const elapsed = Date.now() - swipeStateRef.current.timestamp;
      swipeStateRef.current = null;

      if (elapsed > SWIPE_MAX_ELAPSED_MS) {
        resetSwipeOffset();
        return;
      }

      if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaY) > SWIPE_MAX_Y_DELTA_PX) {
        resetSwipeOffset();
        return;
      }

      if (Math.abs(deltaX) < Math.abs(deltaY) * 1.3) {
        resetSwipeOffset();
        return;
      }

      const targetSlideId =
        deltaX < 0 && canGoNext
          ? slides[activeSlideIndex + 1]?.id
          : deltaX > 0 && canGoPrev
            ? slides[activeSlideIndex - 1]?.id
            : null;

      if (!targetSlideId) {
        resetSwipeOffset();
        return;
      }

      setSwipeTransitionEnabled(true);
      setSwipeOffsetX(deltaX < 0 ? -displayWidth : displayWidth);
      if (swipeCommitTimeoutRef.current !== null) {
        window.clearTimeout(swipeCommitTimeoutRef.current);
      }
      swipeCommitTimeoutRef.current = window.setTimeout(() => {
        onSelectSlide(targetSlideId);
        setSwipeTransitionEnabled(false);
        setSwipeOffsetX(0);
        swipeCommitTimeoutRef.current = null;
      }, SWIPE_TRANSITION_MS);
    };

    const activeSlideOrdinal = Math.max(1, activeSlideIndex + 1);

    return (
      <section className="panel canvas-panel canvas-panel-mobile">
        <div className="mobile-canvas-root">
          <div
            className="mobile-canvas-frame"
            onTouchStartCapture={handleSwipeStart}
            onTouchMoveCapture={handleSwipeMove}
            onTouchEndCapture={handleSwipeEnd}
            onTouchCancelCapture={handleSwipeEnd}
          >
            <div
              className="mobile-slide-shell-motion"
              style={{
                transform: `translateX(${swipeOffsetX}px)`,
                transition: swipeTransitionEnabled ? `transform ${SWIPE_TRANSITION_MS}ms ease` : undefined
              }}
            >
              <div className="slide-stack-shell active mobile-slide-shell mobile-preview-shell">
                {showSlideBadge ? (
                  <div className="active-slide-pill">
                    Слайд {activeSlideIndex + 1} • {formatLabel}
                  </div>
                ) : null}

                <div className="canvas-stage canvas-stage-editor mobile-stage-editor">
                  <div
                    className={`canvas-stage-center mobile-stage-surface ${
                      fontsReady ? "" : "is-loading-fonts"
                    }`}
                  >
                    <SlideStage
                      slide={activeSlide}
                      width={displayWidth}
                      height={displayHeight}
                      canvasWidth={canvasWidth}
                      canvasHeight={canvasHeight}
                      hiddenElementId={hiddenEditingElementId}
                      selectedElementId={selectedElementId}
                      interactive={!disabled && !previewMode}
                      onSelectElement={(elementId) => onSelectElement(activeSlide.id, elementId)}
                      onUpdateElementPosition={(elementId, x, y) =>
                        onUpdateElementPosition(activeSlide.id, elementId, x, y)
                      }
                      onTransformElement={(elementId, updates) =>
                        onTransformElement(activeSlide.id, elementId, updates)
                      }
                      onStartTextEditing={(elementId) => onStartTextEditing(activeSlide.id, elementId)}
                      onRequestSlidePhotoUpload={() =>
                        onAddBackgroundImageToSlide?.(activeSlide.id) ?? onAddImageToSlide(activeSlide.id)
                      }
                      onRequestProfileHandleEdit={onRequestProfileHandleEdit}
                      hideResizeHandles
                      showSlideBadge={showSlideBadge}
                    />
                  </div>

                  {!previewMode && selectedElement && selectedElementStyle ? (
                    <>
                      <div
                        className="mobile-selection-outline"
                        aria-hidden="true"
                        style={{
                          left: `${selectedElement.x * scale}px`,
                          top: `${selectedElement.y * scale}px`,
                          width: `${Math.max(8, selectedElement.width * scale)}px`,
                          height: `${Math.max(8, selectedElement.height * scale)}px`
                        }}
                      />
                      <button
                        type="button"
                        className="floating-element-action floating-element-action-mobile"
                        title="Удалить выбранный элемент"
                        style={selectedElementStyle}
                        disabled={disabled}
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteSelectedElement();
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {slides.length > 1 ? (
            <div className="mobile-slide-pagination" aria-label="Индикатор слайдов">
              {slides.length > 9 ? (
                <span className="mobile-slide-counter">
                  {activeSlideOrdinal} / {slides.length}
                </span>
              ) : (
                <div className="mobile-slide-dots">
                  {slides.map((slide, index) => (
                    <span
                      key={slide.id}
                      className={`mobile-slide-dot ${index === activeSlideIndex ? "active" : ""}`}
                      aria-hidden="true"
                    />
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {previewMode || hideMobileSlideTools ? null : (
            <div className="mobile-slide-tools" aria-label="Управление слайдами">
              <MobileIconButton
                icon="plus"
                title="Добавить слайд"
                label="Добав."
                onClick={() => onInsertSlideAt(activeSlideIndex + 1, "text")}
                disabled={disabled}
              />
              <MobileIconButton
                icon="templates"
                title="Выбрать шаблон"
                label="Шаблон"
                onClick={onOpenTemplateModal}
                disabled={disabled}
              />
              <MobileIconButton
                icon="image"
                title="Добавить фото"
                label="Фото"
                onClick={() => onAddImageToSlide(activeSlide.id)}
                disabled={disabled}
              />
              <MobileIconButton
                icon="layers"
                title="Добавить текстовый слой"
                label="Текст"
                onClick={() => onAddTextToSlide(activeSlide.id)}
                disabled={disabled}
              />
              <MobileIconButton
                icon="chevron-left"
                title="Предыдущий слайд"
                label="Назад"
                onClick={() => {
                  if (canGoPrev) {
                    onSelectSlide(slides[activeSlideIndex - 1].id);
                  }
                }}
                disabled={!canGoPrev || disabled}
              />
              <MobileIconButton
                icon="chevron-right"
                title="Следующий слайд"
                label="Вперёд"
                onClick={() => {
                  if (canGoNext) {
                    onSelectSlide(slides[activeSlideIndex + 1].id);
                  }
                }}
                disabled={!canGoNext || disabled}
              />
              <MobileIconButton
                icon="trash"
                title="Удалить слайд"
                label="Удал."
                onClick={() => onDeleteSlide(activeSlide.id)}
                disabled={slides.length <= 1 || disabled}
                destructive
              />
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="panel canvas-panel">
      <div className="canvas-workbench canvas-workbench-stack">
        <div className="canvas-stage-wrap canvas-stage-wrap-stack">
          <div className="canvas-stage-meta">
              <div>
                <h2 className="panel-title" style={{ marginBottom: 4 }}>
                  Canvas
                </h2>
                <div className="muted">
                  Слайды идут друг под другом. Редактирование текста выполняется через панель справа.
                </div>
              </div>
            <span className="status-pill">{formatLabel}</span>
          </div>

          <div
            className="slides-stack"
            ref={stackScrollRef}
            onScroll={scheduleVisibleSlideCheck}
          >
            <InsertButton onClick={() => onInsertSlideAt(0)} />

            {slides.map((slide, index) => {
              const isActive = slide.id === activeSlideId;
              const selectedElementStyle =
                isActive && selectedElement
                  ? getFloatingActionStyle(selectedElement, scale, displayWidth, displayHeight)
                  : null;

              return (
                <div
                  key={slide.id}
                  className="slide-stack-block"
                  ref={(node) => {
                    stackSlideRefs.current[slide.id] = node;
                  }}
                >
                  <div
                    className={`slide-stack-shell ${isActive ? "active" : ""}`}
                    onClick={(event) => {
                      if (event.target === event.currentTarget) {
                        onSelectSlide(slide.id);
                      }
                    }}
                  >
                    {isActive && !previewMode && showSlideBadge ? (
                      <div className="active-slide-pill">
                        Активный слайд • {formatLabel}
                      </div>
                    ) : null}

                    <div
                      className="canvas-stage canvas-stage-editor"
                      onMouseDownCapture={() => {
                        if (!isActive) {
                          onSelectSlide(slide.id);
                        }
                      }}
                      onTouchStartCapture={() => {
                        if (!isActive) {
                          onSelectSlide(slide.id);
                        }
                      }}
                    >
                      <div className={`canvas-stage-center ${fontsReady ? "" : "is-loading-fonts"}`}>
                        <SlideStage
                          slide={slide}
                          width={displayWidth}
                          height={displayHeight}
                          canvasWidth={canvasWidth}
                          canvasHeight={canvasHeight}
                          hiddenElementId={null}
                          selectedElementId={isActive ? selectedElementId : null}
                          interactive={isActive && !disabled && !previewMode}
                          onSelectElement={(elementId) => onSelectElement(slide.id, elementId)}
                          onUpdateElementPosition={(elementId, x, y) =>
                            onUpdateElementPosition(slide.id, elementId, x, y)
                          }
                          onTransformElement={(elementId, updates) =>
                            onTransformElement(slide.id, elementId, updates)
                          }
                          onStartTextEditing={(elementId) =>
                            onStartTextEditing(slide.id, elementId)
                          }
                          onRequestSlidePhotoUpload={() =>
                            onAddBackgroundImageToSlide?.(slide.id) ?? onAddImageToSlide(slide.id)
                          }
                          onRequestProfileHandleEdit={onRequestProfileHandleEdit}
                          hideResizeHandles={false}
                          showSlideBadge={showSlideBadge}
                        />
                      </div>

                      {isActive && !previewMode && selectedElement && selectedElementStyle ? (
                        <button
                          type="button"
                          className="floating-element-action"
                          title="Удалить выбранный элемент"
                          style={selectedElementStyle}
                          disabled={disabled}
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteSelectedElement();
                          }}
                        >
                          <AppIcon name="trash" size={14} />
                        </button>
                      ) : null}
                    </div>

                    {previewMode ? null : (
                      <div className="slide-tools-shell">
                        <div className="slide-tools-rail">
                          <ToolButton
                            icon="copy"
                            title="Копировать"
                            onClick={() => onDuplicateSlide(slide.id)}
                            disabled={disabled}
                          />
                          <ToolButton
                            icon="image"
                            title="Вставить изображение"
                            onClick={() => onAddImageToSlide(slide.id)}
                            disabled={disabled}
                          />
                          <ToolButton
                            icon="text"
                            title="Добавить текст"
                            onClick={() => onAddTextToSlide(slide.id)}
                            disabled={disabled}
                          />
                          <ToolButton
                            icon="move-up"
                            title="Вверх"
                            onClick={() => onMoveSlide(slide.id, "up")}
                            disabled={disabled}
                          />
                          <ToolButton
                            icon="move-down"
                            title="Вниз"
                            onClick={() => onMoveSlide(slide.id, "down")}
                            disabled={disabled}
                          />
                          <ToolButton
                            icon="trash"
                            title="Удалить"
                            onClick={() => onDeleteSlide(slide.id)}
                            destructive
                            disabled={disabled || slides.length <= 1}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {previewMode ? null : (
                    <InsertButton onClick={() => onInsertSlideAt(index + 1)} disabled={disabled} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function getFloatingActionStyle(
  element: CanvasElement,
  scale: number,
  displayWidth: number,
  displayHeight: number,
  options?: {
    buttonSize?: number;
    horizontalInset?: number;
    verticalInset?: number;
    horizontalOffset?: number;
    verticalOffset?: number;
  }
) {
  const buttonSize = options?.buttonSize ?? 28;
  const horizontalInset = options?.horizontalInset ?? 10;
  const verticalInset = options?.verticalInset ?? 8;
  const horizontalOffset = options?.horizontalOffset ?? 8;
  const verticalOffset = options?.verticalOffset ?? 16;
  const right = element.x + element.width;
  const top = element.y * scale;
  const nextLeft = Math.min(
    displayWidth - buttonSize - horizontalInset,
    Math.max(horizontalInset, right * scale + horizontalOffset)
  );
  const preferredTop = top - verticalOffset;
  const nextTop =
    preferredTop < verticalInset
      ? Math.min(
          displayHeight - buttonSize - verticalInset,
          (element.y + element.height) * scale + 8
        )
      : preferredTop;

  return {
    left: `${nextLeft}px`,
    top: `${nextTop}px`
  };
}

function InsertButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="insert-slide-button" onClick={onClick} disabled={disabled}>
      <span className="insert-slide-line" aria-hidden="true" />
      <span className="insert-slide-plus" aria-hidden="true">
        <AppIcon name="plus" size={14} />
      </span>
    </button>
  );
}

function ToolButton({
  icon,
  title,
  onClick,
  destructive = false,
  disabled = false
}: {
  icon: AppIconName;
  title: string;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`slide-tool-button ${disabled ? "is-disabled" : ""} ${
        destructive ? "is-destructive" : ""
      }`}
      title={title}
      data-tooltip={title}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        if (disabled) {
          return;
        }
        onClick();
      }}
    >
      <AppIcon name={icon} size={18} />
    </button>
  );
}

function MobileIconButton({
  icon,
  title,
  label,
  onClick,
  destructive = false,
  disabled = false
}: {
  icon: AppIconName;
  title: string;
  label?: string;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`mobile-slide-tool ${destructive ? "is-destructive" : ""}`}
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        if (disabled) {
          return;
        }
        onClick();
      }}
    >
      <span className="mobile-slide-tool-icon">
        <AppIcon name={icon} size={18} />
      </span>
      {label ? <span className="mobile-slide-tool-label">{label}</span> : null}
    </button>
  );
}
