"use client";

import { SLIDE_FORMAT_DIMENSIONS } from "@/lib/carousel";
import type { CanvasElement, Slide, SlideFormat, TextElement } from "@/types/editor";
import { SlideStage } from "@/components/SlideStage";

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
  editingTextElement: TextElement | null;
  editingValue: string;
  onEditingValueChange: (value: string) => void;
  onCommitTextEditing: () => void;
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
  onInsertSlideAt: (index: number) => void;
  onAddTextToSlide: (slideId: string) => void;
  onAddImageToSlide: (slideId: string) => void;
  onDeleteSelectedElement: () => void;
  onMoveSlide: (slideId: string, direction: "up" | "down") => void;
  onDeleteSlide: (slideId: string) => void;
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
  editingTextElement,
  editingValue,
  onEditingValueChange,
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
  onDeleteSelectedElement,
  onMoveSlide,
  onDeleteSlide
}: CanvasEditorProps) {
  const scale = displayWidth / canvasWidth;
  const formatLabel = SLIDE_FORMAT_DIMENSIONS[activeFormat].label;
  const activeSlide = slides.find((slide) => slide.id === activeSlideId) ?? slides[0] ?? null;
  const activeSlideIndex = activeSlide ? slides.findIndex((slide) => slide.id === activeSlide.id) : -1;

  if (mode === "single" && activeSlide) {
    const isEditingActiveSlide = editingTextElement && activeSlide.id === activeSlideId;
    const selectedElementStyle =
      selectedElement ? getFloatingActionStyle(selectedElement, scale, displayWidth, displayHeight) : null;
    const canGoPrev = activeSlideIndex > 0;
    const canGoNext = activeSlideIndex >= 0 && activeSlideIndex < slides.length - 1;

    return (
      <section className="panel canvas-panel canvas-panel-mobile">
        <div className="mobile-canvas-root">
          <div className="mobile-canvas-frame">
            <div className="slide-stack-shell active mobile-slide-shell">
              <div className="active-slide-pill">
                Слайд {activeSlideIndex + 1} • {formatLabel}
              </div>

              <div className="canvas-stage canvas-stage-editor mobile-stage-editor">
                <div className="canvas-stage-center">
                  <SlideStage
                    slide={activeSlide}
                    width={displayWidth}
                    height={displayHeight}
                    canvasWidth={canvasWidth}
                    canvasHeight={canvasHeight}
                    selectedElementId={selectedElementId}
                    interactive
                    onSelectElement={(elementId) => onSelectElement(activeSlide.id, elementId)}
                    onUpdateElementPosition={(elementId, x, y) =>
                      onUpdateElementPosition(activeSlide.id, elementId, x, y)
                    }
                    onTransformElement={(elementId, updates) =>
                      onTransformElement(activeSlide.id, elementId, updates)
                    }
                    onStartTextEditing={(elementId) => onStartTextEditing(activeSlide.id, elementId)}
                  />
                </div>

                {isEditingActiveSlide && editingTextElement ? (
                  <textarea
                    className="inline-text-editor"
                    autoFocus
                    value={editingValue}
                    onChange={(event) => onEditingValueChange(event.target.value)}
                    onBlur={onCommitTextEditing}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                        event.preventDefault();
                        onCommitTextEditing();
                      }

                      if (event.key === "Escape") {
                        event.preventDefault();
                        onCancelTextEditing();
                      }
                    }}
                    style={{
                      left: editingTextElement.x * scale,
                      top: editingTextElement.y * scale,
                      width: editingTextElement.width * scale,
                      height: Math.max(48, editingTextElement.height * scale),
                      fontSize: editingTextElement.fontSize * scale,
                      fontFamily: editingTextElement.fontFamily,
                      color: editingTextElement.fill,
                      textAlign: editingTextElement.align,
                      lineHeight: String(editingTextElement.lineHeight ?? 1.1),
                      transform: `rotate(${editingTextElement.rotation}deg)`
                    }}
                  />
                ) : null}

                {selectedElement && selectedElementStyle ? (
                  <button
                    type="button"
                    className="floating-element-action"
                    title="Удалить выбранный элемент"
                    style={selectedElementStyle}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteSelectedElement();
                    }}
                  >
                    ⌫
                  </button>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              className="mobile-side-nav mobile-side-nav-left"
              onClick={() => {
                if (canGoPrev) {
                  onSelectSlide(slides[activeSlideIndex - 1].id);
                }
              }}
              aria-label="Предыдущий слайд"
              disabled={!canGoPrev}
            >
              ‹
            </button>

            <button
              type="button"
              className="mobile-side-nav mobile-side-nav-right"
              onClick={() => {
                if (canGoNext) {
                  onSelectSlide(slides[activeSlideIndex + 1].id);
                }
              }}
              aria-label="Следующий слайд"
              disabled={!canGoNext}
            >
              ›
            </button>
          </div>

          <div className="mobile-slide-tools">
            <ToolButton
              label="+"
              title="Добавить слайд после текущего"
              onClick={() => onInsertSlideAt(activeSlideIndex + 1)}
            />
            <ToolButton
              label="▣"
              title="Загрузить фото на этот слайд"
              onClick={() => onAddImageToSlide(activeSlide.id)}
            />
            <ToolButton
              label="T"
              title="Добавить текст на этот слайд"
              onClick={() => onAddTextToSlide(activeSlide.id)}
            />
            <ToolButton
              label="⌫"
              title="Удалить этот слайд"
              onClick={() => onDeleteSlide(activeSlide.id)}
              disabled={slides.length <= 1}
            />
          </div>
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
                Слайды идут друг под другом. Двойной клик по тексту включает inline-редактирование.
              </div>
            </div>
            <span className="status-pill">{formatLabel}</span>
          </div>

          <div className="slides-stack">
            <InsertButton onClick={() => onInsertSlideAt(0)} />

            {slides.map((slide, index) => {
              const isActive = slide.id === activeSlideId;
              const isEditingSlide = editingTextElement && slide.id === activeSlideId;
              const selectedElementStyle =
                isActive && selectedElement
                  ? getFloatingActionStyle(selectedElement, scale, displayWidth, displayHeight)
                  : null;

              return (
                <div key={slide.id} className="slide-stack-block">
                  <div
                    className={`slide-stack-shell ${isActive ? "active" : ""}`}
                    onClick={(event) => {
                      if (event.target === event.currentTarget) {
                        onSelectSlide(slide.id);
                      }
                    }}
                  >
                    {isActive ? (
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
                      <div className="canvas-stage-center">
                        <SlideStage
                          slide={slide}
                          width={displayWidth}
                          height={displayHeight}
                          canvasWidth={canvasWidth}
                          canvasHeight={canvasHeight}
                          selectedElementId={isActive ? selectedElementId : null}
                          interactive={isActive}
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
                        />
                      </div>

                      {isEditingSlide && editingTextElement ? (
                        <textarea
                          className="inline-text-editor"
                          autoFocus
                          value={editingValue}
                          onChange={(event) => onEditingValueChange(event.target.value)}
                          onBlur={onCommitTextEditing}
                          onKeyDown={(event) => {
                            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                              event.preventDefault();
                              onCommitTextEditing();
                            }

                            if (event.key === "Escape") {
                              event.preventDefault();
                              onCancelTextEditing();
                            }
                          }}
                          style={{
                            left: editingTextElement.x * scale,
                            top: editingTextElement.y * scale,
                            width: editingTextElement.width * scale,
                            height: Math.max(48, editingTextElement.height * scale),
                            fontSize: editingTextElement.fontSize * scale,
                            fontFamily: editingTextElement.fontFamily,
                            color: editingTextElement.fill,
                            textAlign: editingTextElement.align,
                            lineHeight: String(editingTextElement.lineHeight ?? 1.1),
                            transform: `rotate(${editingTextElement.rotation}deg)`
                          }}
                        />
                      ) : null}

                      {isActive && selectedElement && selectedElementStyle ? (
                        <button
                          type="button"
                          className="floating-element-action"
                          title="Удалить выбранный элемент"
                          style={selectedElementStyle}
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteSelectedElement();
                          }}
                        >
                          ⌫
                        </button>
                      ) : null}
                    </div>

                    <div className="slide-tools-rail">
                      <ToolButton label="✎" title="Выбрать и редактировать слайд" onClick={() => onSelectSlide(slide.id)} />
                      <ToolButton label="▣" title="Загрузить фото на этот слайд" onClick={() => onAddImageToSlide(slide.id)} />
                      <ToolButton label="T" title="Добавить текст на этот слайд" onClick={() => onAddTextToSlide(slide.id)} />
                      <ToolButton label="˄" title="Переместить слайд вверх" onClick={() => onMoveSlide(slide.id, "up")} />
                      <ToolButton label="˅" title="Переместить слайд вниз" onClick={() => onMoveSlide(slide.id, "down")} />
                      <ToolButton label="⌫" title="Удалить этот слайд" onClick={() => onDeleteSlide(slide.id)} />
                    </div>
                  </div>

                  <InsertButton onClick={() => onInsertSlideAt(index + 1)} />
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
  displayHeight: number
) {
  const buttonSize = 40;
  const right = element.x + element.width;
  const top = element.y;
  const nextLeft = Math.min(
    displayWidth - buttonSize - 8,
    Math.max(8, right * scale - buttonSize * 0.2)
  );
  const preferredTop = top * scale - buttonSize - 10;
  const nextTop =
    preferredTop < 8
      ? Math.min(displayHeight - buttonSize - 8, (element.y + element.height) * scale + 10)
      : preferredTop;

  return {
    left: `${nextLeft}px`,
    top: `${nextTop}px`
  };
}

function InsertButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="insert-slide-button" onClick={onClick}>
      +
    </button>
  );
}

function ToolButton({
  label,
  title,
  onClick,
  disabled = false
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`slide-tool-button ${disabled ? "is-disabled" : ""}`}
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
      {label}
    </button>
  );
}
