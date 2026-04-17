"use client";

import * as Switch from "@radix-ui/react-switch";
import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type TouchEvent
} from "react";
import { AppIcon, type AppIconName } from "@/components/icons";
import { HexColorField } from "@/components/HexColorField";
import type {
  CanvasElement,
  CarouselPostCaption,
  Slide,
  SlidePhotoSettings,
  TextElement
} from "@/types/editor";

export type MobileToolTab = "slides" | "style" | "text" | "photo" | "export";

type MobileToolsProps = {
  activeTab: MobileToolTab | null;
  onTabChange: (tab: MobileToolTab | null) => void;
  slides: Slide[];
  activeSlideId: string | null;
  selectedElement: CanvasElement | null;
  selectedTextElement: TextElement | null;
  selectedTextTargetRole: "title" | "body";
  activeTemplateName: string;
  profileHandle: string;
  profileSubtitle: string;
  subtitlesVisibleAcrossSlides: boolean;
  photoSlotEnabled: boolean;
  photoSettings: SlidePhotoSettings;
  hasBackgroundImage: boolean;
  gridVisible: boolean;
  captionResult: CarouselPostCaption | null;
  isGenerating: boolean;
  isGeneratingCaption: boolean;
  isExporting: boolean;
  onGenerateCaption: () => void;
  onCopyCaption: () => void;
  onOpenExportModal: () => void;
  onSelectSlide: (slideId: string) => void;
  onInsertSlideAt: (index: number, slideType?: "text" | "image_text" | "big_text") => void;
  onDuplicateSlide: (slideId: string) => void;
  onMoveSlide: (slideId: string, direction: "up" | "down") => void;
  onDeleteSlide: (slideId: string) => void;
  onPhotoSlotEnabledChange: (value: boolean) => void;
  slideBackground: string;
  onUploadBackgroundImage: () => void;
  onRemoveBackgroundImage: () => void;
  onGridVisibilityChange: (visible: boolean, options?: { applyAll?: boolean }) => void;
  onOpenTemplateModal: () => void;
  onProfileHandleChange: (value: string) => void;
  onProfileSubtitleChange: (value: string) => void;
  onToggleSubtitleAcrossSlides: (visible: boolean) => void;
  onSlideBackgroundChange: (value: string, options?: { applyAll?: boolean }) => void;
  onSlidePhotoSettingsChange: (updates: Partial<SlidePhotoSettings>) => void;
  onApplyStylePreset: (
    presetId: "mono" | "grid" | "gradient" | "notes" | "dots" | "flash",
    options?: { applyAll?: boolean }
  ) => void;
  onSelectedTextChange: (value: string) => void;
  onSelectedTextColorChange: (value: string) => void;
  onSelectedTextHighlightColorChange: (value: string) => void;
  onSelectedTextHighlightOpacityChange: (value: number) => void;
  onSelectedTextSelectionChange: (start: number, end: number) => void;
  onSelectedTextFontChange: (value: string) => void;
  onSelectedTextSizeChange: (value: number) => void;
  onSelectedTextCaseChange: (mode: "normal" | "uppercase" | "lowercase" | "capitalize") => void;
  onSelectedTextAlignChange: (align: "left" | "center" | "right") => void;
  onCenterSelectedTextHorizontally: () => void;
  onSelectedTextTargetRoleChange: (role: "title" | "body") => void;
  onApplyColorScheme: (mode: "single" | "double", options?: { applyAll?: boolean }) => void;
  onApplyHighlightToSelection: () => void;
  onClearHighlightFromSelection: () => void;
  onClearAllHighlights: () => void;
  onApplyHighlightColorToAllSlides: () => void;
  selectedTextHighlightColor: string;
  selectedTextHighlightOpacity: number;
  toolbarRef?: MutableRefObject<HTMLElement | null>;
  toolSheetRef?: MutableRefObject<HTMLElement | null>;
  disabled?: boolean;
  previewMode?: boolean;
};

const TOOLBAR_ITEMS: Array<{ id: MobileToolTab; icon: AppIconName; label: string }> = [
  { id: "slides", icon: "layers", label: "Слайды" },
  { id: "style", icon: "palette", label: "Стиль" },
  { id: "text", icon: "text", label: "Текст" },
  { id: "photo", icon: "image", label: "Фото" },
  { id: "export", icon: "download", label: "Экспорт" }
];

const FONT_OPTIONS = [
  "Inter",
  "Manrope",
  "Advent Pro",
  "Fira Code",
  "Russo One",
  "Oswald",
  "Space Grotesk",
  "Playfair Display"
];
const BACKGROUND_COLOR_PRESETS: Array<{ label: string; value: string }> = [
  { label: "Белый", value: "#ffffff" },
  { label: "Черный", value: "#111111" },
  { label: "Светло-серый", value: "#f0f0f5" },
  { label: "Теплый", value: "#f5e6d3" },
  { label: "Холодный", value: "#e0eaf5" },
  { label: "Графит", value: "#2a2a2a" }
];
const HEX_COLOR_INPUT_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const STYLE_PRESETS = [
  {
    id: "mono",
    label: "Монохром",
    background: "#ffffff",
    preview: "none"
  },
  {
    id: "grid",
    label: "Сетка",
    background: "#f8f8f9",
    preview:
      "repeating-linear-gradient(90deg, rgba(18,21,27,0.14) 0 1px, transparent 1px 10px), repeating-linear-gradient(180deg, rgba(18,21,27,0.14) 0 1px, transparent 1px 10px)"
  },
  {
    id: "gradient",
    label: "Градиент",
    background: "#f4ede8",
    preview: "linear-gradient(135deg, #f7f7f7 0%, #f2e8df 100%)"
  },
  {
    id: "notes",
    label: "Заметки",
    background: "#ececf1",
    preview:
      "repeating-linear-gradient(180deg, rgba(63,67,77,0.18) 0 1px, transparent 1px 10px), linear-gradient(180deg, #f8f9fc 0%, #eef1f7 100%)"
  },
  {
    id: "dots",
    label: "Точки",
    background: "#f5f5f6",
    preview:
      "radial-gradient(circle, rgba(18,21,27,0.24) 1px, transparent 1.2px), radial-gradient(circle, rgba(18,21,27,0.16) 1px, transparent 1.2px)"
  },
  {
    id: "flash",
    label: "Молнии",
    background: "#e8e9ed",
    preview:
      "repeating-linear-gradient(135deg, rgba(56,60,70,0.15) 0 6px, transparent 6px 16px), repeating-linear-gradient(45deg, rgba(56,60,70,0.12) 0 6px, transparent 6px 18px), linear-gradient(135deg, #f7f7f9 0%, #e4e6ec 100%)"
  }
] as const;

export function MobileTools({
  activeTab,
  onTabChange,
  slides,
  activeSlideId,
  selectedElement,
  selectedTextElement,
  selectedTextTargetRole,
  activeTemplateName,
  profileHandle,
  profileSubtitle,
  subtitlesVisibleAcrossSlides,
  photoSlotEnabled,
  photoSettings,
  hasBackgroundImage,
  gridVisible,
  captionResult,
  isGenerating,
  isGeneratingCaption,
  isExporting,
  onGenerateCaption,
  onCopyCaption,
  onOpenExportModal,
  onSelectSlide,
  onInsertSlideAt,
  onDuplicateSlide,
  onMoveSlide,
  onDeleteSlide,
  onPhotoSlotEnabledChange,
  slideBackground,
  onUploadBackgroundImage,
  onRemoveBackgroundImage,
  onGridVisibilityChange,
  onOpenTemplateModal,
  onProfileHandleChange,
  onProfileSubtitleChange,
  onToggleSubtitleAcrossSlides,
  onSlideBackgroundChange,
  onSlidePhotoSettingsChange,
  onApplyStylePreset,
  onSelectedTextChange,
  onSelectedTextColorChange,
  onSelectedTextHighlightColorChange,
  onSelectedTextHighlightOpacityChange,
  onSelectedTextSelectionChange,
  onSelectedTextFontChange,
  onSelectedTextSizeChange,
  onSelectedTextCaseChange,
  onSelectedTextAlignChange,
  onCenterSelectedTextHorizontally,
  onSelectedTextTargetRoleChange,
  onApplyColorScheme,
  onApplyHighlightToSelection,
  onClearHighlightFromSelection,
  onClearAllHighlights,
  onApplyHighlightColorToAllSlides,
  selectedTextHighlightColor,
  selectedTextHighlightOpacity,
  toolbarRef,
  toolSheetRef,
  disabled = false,
  previewMode = false
}: MobileToolsProps) {
  const swipeRef = useRef<{ startY: number; startX: number; drag: number } | null>(null);
  const captionCopyResetTimeoutRef = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [colorMode, setColorMode] = useState<"single" | "double">("single");
  const [applyColorForAll, setApplyColorForAll] = useState(true);
  const [applyStyleForAll, setApplyStyleForAll] = useState(true);
  const [isCaptionCopied, setIsCaptionCopied] = useState(false);
  const activeTextElement = selectedTextElement;
  const normalizedTextColor = normalizeColorForInput(activeTextElement?.fill, "#6366f1");
  const normalizedHighlightColor = normalizeColorForInput(selectedTextHighlightColor, "#1f49ff");
  const normalizedBackgroundColor = normalizeColorForInput(slideBackground, "#ffffff");
  const normalizedSlideBackground = normalizeColor(slideBackground).toLowerCase();
  const activeSlideIndex = slides.findIndex((slide) => slide.id === activeSlideId);
  const fallbackSlideIndex = activeSlideIndex >= 0 ? activeSlideIndex : 0;
  const currentSlide = slides[fallbackSlideIndex] ?? null;
  const selectedElementLabel = selectedElement
    ? selectedElement.type === "text"
      ? "Выбран текст"
      : selectedElement.type === "image" || selectedElement.type === "image_element"
        ? "Выбрано изображение"
        : "Выбрана фигура"
    : activeTextElement
      ? selectedTextTargetRole === "body"
        ? "Автовыбор: описание"
        : "Автовыбор: заголовок"
      : "";

  useEffect(() => {
    return () => {
      if (captionCopyResetTimeoutRef.current !== null) {
        window.clearTimeout(captionCopyResetTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setIsCaptionCopied(false);
  }, [captionResult]);

  const applyColorMode = (nextMode: "single" | "double") => {
    setColorMode(nextMode);
    onApplyColorScheme(nextMode, { applyAll: applyColorForAll });

    if (!activeTextElement || disabled) {
      return;
    }

    if (nextMode === "single") {
      const unifiedColor = activeTextElement.fill || selectedTextHighlightColor || "#6366f1";
      onSelectedTextColorChange(unifiedColor);
      onSelectedTextHighlightColorChange(unifiedColor);
      if (selectedTextHighlightOpacity < 0.65) {
        onSelectedTextHighlightOpacityChange(0.82);
      }
      return;
    }

    const normalizedText = (activeTextElement.fill ?? "").trim().toLowerCase();
    const normalizedHighlight = (selectedTextHighlightColor ?? "").trim().toLowerCase();
    if (normalizedText && normalizedText === normalizedHighlight) {
      onSelectedTextHighlightColorChange(normalizedText === "#1f49ff" ? "#ff2d00" : "#1f49ff");
    }
    if (selectedTextHighlightOpacity < 0.65) {
      onSelectedTextHighlightOpacityChange(0.9);
    }
  };

  const handleSinglePaletteColorChange = (value: string) => {
    onSelectedTextColorChange(value);
    onSelectedTextHighlightColorChange(value);
  };

  const handleCaptionCopyClick = () => {
    if (!captionResult || disabled) {
      return;
    }

    onCopyCaption();
    setIsCaptionCopied(true);

    if (captionCopyResetTimeoutRef.current !== null) {
      window.clearTimeout(captionCopyResetTimeoutRef.current);
    }

    captionCopyResetTimeoutRef.current = window.setTimeout(() => {
      setIsCaptionCopied(false);
      captionCopyResetTimeoutRef.current = null;
    }, 2000);
  };

  const handleSheetTouchStart = (event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }
    swipeRef.current = {
      startY: touch.clientY,
      startX: touch.clientX,
      drag: 0
    };
  };

  const handleSheetTouchMove = (event: TouchEvent<HTMLElement>) => {
    if (!swipeRef.current) {
      return;
    }
    const touch = event.touches[0];
    if (!touch) {
      return;
    }
    const deltaY = touch.clientY - swipeRef.current.startY;
    const deltaX = touch.clientX - swipeRef.current.startX;
    if (deltaY <= 0 || Math.abs(deltaX) > deltaY * 0.9) {
      return;
    }
    swipeRef.current.drag = deltaY;
    setDragOffset(Math.min(180, deltaY));
    event.preventDefault();
  };

  const handleSheetTouchEnd = () => {
    if (!swipeRef.current) {
      return;
    }
    const shouldClose = swipeRef.current.drag > 100;
    swipeRef.current = null;
    setDragOffset(0);
    if (shouldClose) {
      onTabChange(null);
    }
  };

  if (previewMode) {
    return null;
  }

  return (
    <>
      {activeTab ? (
        <button
          type="button"
          className="mobile-tool-sheet-backdrop"
          aria-label="Закрыть панель"
          onClick={() => onTabChange(null)}
        />
      ) : null}

      <nav
        ref={(node) => {
          if (toolbarRef) {
            toolbarRef.current = node;
          }
        }}
        className={`mobile-bottom-toolbar mobile-bottom-toolbar-v2 bottom-tab-bar ${
          activeTab ? "is-sheet-open" : ""
        }`}
        aria-label="Панель инструментов"
      >
        {TOOLBAR_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`mobile-bottom-tool ${isActive ? "active" : ""}`}
              disabled={disabled}
              onClick={() => onTabChange(isActive ? null : item.id)}
            >
              <span className="mobile-bottom-tool-icon">
                <AppIcon name={item.icon} size={18} />
              </span>
              <small>{item.label}</small>
            </button>
          );
        })}
      </nav>

      {activeTab ? (
        <section
          ref={(node) => {
            if (toolSheetRef) {
              toolSheetRef.current = node;
            }
          }}
          className={`mobile-tool-sheet mobile-tool-sheet-v2 bottom-sheet ${
            dragOffset > 0 ? "is-dragging" : ""
          }`}
          role="dialog"
          aria-label="Инструменты редактора"
          onTouchStart={handleSheetTouchStart}
          onTouchMove={handleSheetTouchMove}
          onTouchEnd={handleSheetTouchEnd}
          onTouchCancel={handleSheetTouchEnd}
          style={{
            transform: dragOffset ? `translateY(${dragOffset}px)` : undefined
          }}
        >
          <div className="mobile-tool-sheet-handle" aria-hidden="true" />

          <div className="mobile-tool-sheet-header">
            <h3>{getTabTitle(activeTab)}</h3>
            <button
              type="button"
              className="mobile-tool-close"
              onClick={() => onTabChange(null)}
              aria-label="Закрыть панель"
            >
              <AppIcon name="close" size={16} />
            </button>
          </div>

          <div
            className={`mobile-tool-sheet-body sheet-content custom-scroll mobile-tool-sheet-body-${activeTab}`}
          >
            {activeTab === "slides" ? (
              <div className="settings-block">
                <button
                  type="button"
                  className="template-library-trigger template-library-trigger-mobile"
                  onClick={() => {
                    onOpenTemplateModal();
                    onTabChange(null);
                  }}
                  disabled={disabled}
                >
                  <span className="template-library-trigger-icon">
                    <AppIcon name="templates" size={16} />
                  </span>
                  <span className="template-library-trigger-copy">
                    <strong>Шаблоны</strong>
                    <small>{activeTemplateName}</small>
                  </span>
                  <AppIcon name="chevron-right" size={14} />
                </button>

                <div className="mobile-slide-list custom-scroll">
                  {slides.length ? (
                    slides.map((slide, index) => {
                      const isActive = slide.id === activeSlideId;
                      return (
                        <div
                          key={slide.id}
                          className={`mobile-slide-list-item ${isActive ? "active" : ""}`}
                        >
                          <button
                            type="button"
                            className="mobile-slide-list-main"
                            onClick={() => onSelectSlide(slide.id)}
                            disabled={disabled}
                          >
                            <span className="mobile-slide-list-index">{index + 1}</span>
                            <span className="mobile-slide-list-copy">
                              <strong>{slide.name || `Слайд ${index + 1}`}</strong>
                              <small>{getSlideRoleLabel(slide.generationRole)}</small>
                            </span>
                          </button>
                          <div className="mobile-slide-list-actions">
                            <button
                              type="button"
                              className="mobile-slide-list-action"
                              onClick={() => onMoveSlide(slide.id, "up")}
                              disabled={disabled || index === 0}
                              title="Вверх"
                              aria-label="Переместить вверх"
                            >
                              <AppIcon name="move-up" size={14} />
                            </button>
                            <button
                              type="button"
                              className="mobile-slide-list-action"
                              onClick={() => onMoveSlide(slide.id, "down")}
                              disabled={disabled || index === slides.length - 1}
                              title="Вниз"
                              aria-label="Переместить вниз"
                            >
                              <AppIcon name="move-down" size={14} />
                            </button>
                            <button
                              type="button"
                              className="mobile-slide-list-action mobile-slide-list-action-danger"
                              onClick={() => onDeleteSlide(slide.id)}
                              disabled={disabled || slides.length <= 1}
                              title="Удалить"
                              aria-label="Удалить слайд"
                            >
                              <AppIcon name="trash" size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="settings-empty">Пока нет слайдов. Создайте первую карусель на главной.</div>
                  )}
                </div>

                <div className="field-row field-row-actions">
                  <button
                    type="button"
                    className="ghost-chip"
                    onClick={() => onInsertSlideAt(fallbackSlideIndex + 1, "text")}
                    disabled={disabled}
                  >
                    + Текст
                  </button>
                  <button
                    type="button"
                    className="ghost-chip"
                    onClick={() => onInsertSlideAt(fallbackSlideIndex + 1, "image_text")}
                    disabled={disabled}
                  >
                    + Фото + текст
                  </button>
                </div>

                <div className="field-row field-row-actions">
                  <button
                    type="button"
                    className="ghost-chip"
                    onClick={() => onInsertSlideAt(fallbackSlideIndex + 1, "big_text")}
                    disabled={disabled}
                  >
                    + Большой текст
                  </button>
                  <button
                    type="button"
                    className="ghost-chip ghost-chip-muted"
                    onClick={() => {
                      if (currentSlide) {
                        onDuplicateSlide(currentSlide.id);
                      }
                    }}
                    disabled={disabled || !currentSlide}
                  >
                    Дублировать
                  </button>
                </div>
              </div>
            ) : null}

            {activeTab === "style" ? (
              <div className="settings-block">
                <div className="mobile-sheet-subsection">
                  <div className="mobile-sheet-subsection-header">
                    <span className="settings-label">Цветовая схема</span>
                    <MobileSwitchRow
                      label="Применить для всех"
                      checked={applyColorForAll}
                      onCheckedChange={setApplyColorForAll}
                      disabled={disabled}
                      compact
                    />
                  </div>

                  <div className="segment-control">
                    <button
                      type="button"
                      className={`segment-item ${colorMode === "single" ? "active" : ""}`}
                      onClick={() => applyColorMode("single")}
                      disabled={disabled}
                    >
                      Один цвет
                    </button>
                    <button
                      type="button"
                      className={`segment-item ${colorMode === "double" ? "active" : ""}`}
                      onClick={() => applyColorMode("double")}
                      disabled={disabled}
                    >
                      Два цвета
                    </button>
                  </div>

                  {colorMode === "single" ? (
                    <label className="field-label">
                      Цвет текста и выделения
                      <div className="mobile-color-inline">
                        <input
                          type="color"
                          className="color-input"
                          value={normalizedTextColor}
                          onChange={(event) => handleSinglePaletteColorChange(event.target.value)}
                          disabled={disabled || !activeTextElement}
                        />
                        <HexColorField
                          value={normalizedTextColor}
                          onValidChange={handleSinglePaletteColorChange}
                          disabled={disabled || !activeTextElement}
                        />
                      </div>
                    </label>
                  ) : (
                    <div className="mobile-sheet-row mobile-sheet-row-two">
                      <label className="field-label">
                        Цвет текста
                        <div className="mobile-color-inline">
                          <input
                            type="color"
                            className="color-input"
                            value={normalizedTextColor}
                            onChange={(event) => onSelectedTextColorChange(event.target.value)}
                            disabled={disabled || !activeTextElement}
                          />
                          <HexColorField
                            value={normalizedTextColor}
                            onValidChange={onSelectedTextColorChange}
                            disabled={disabled || !activeTextElement}
                          />
                        </div>
                      </label>
                      <label className="field-label">
                        Цвет выделения
                        <div className="mobile-color-inline">
                          <input
                            type="color"
                            className="color-input"
                            value={normalizedHighlightColor}
                            onChange={(event) => onSelectedTextHighlightColorChange(event.target.value)}
                            disabled={disabled || !activeTextElement}
                          />
                          <HexColorField
                            value={normalizedHighlightColor}
                            onValidChange={onSelectedTextHighlightColorChange}
                            disabled={disabled || !activeTextElement}
                          />
                        </div>
                      </label>
                    </div>
                  )}
                </div>

                <div className="mobile-sheet-subsection">
                  <div className="mobile-sheet-subsection-header">
                    <span className="settings-label">Фон</span>
                    <MobileSwitchRow
                      label="Применить для всех"
                      checked={applyStyleForAll}
                      onCheckedChange={setApplyStyleForAll}
                      disabled={disabled}
                      compact
                    />
                  </div>

                  <label className="field-label">
                    Цвет фона (HEX)
                    <div className="mobile-color-inline">
                      <input
                        type="color"
                        className="color-input"
                        value={normalizedBackgroundColor}
                        onChange={(event) =>
                          onSlideBackgroundChange(event.target.value, { applyAll: applyStyleForAll })
                        }
                        disabled={disabled}
                      />
                      <HexColorField
                        value={normalizedBackgroundColor}
                        onValidChange={(value) =>
                          onSlideBackgroundChange(value, { applyAll: applyStyleForAll })
                        }
                        disabled={disabled}
                      />
                    </div>
                  </label>

                  <div className="mobile-color-swatches">
                    {BACKGROUND_COLOR_PRESETS.map((preset) => {
                      const isActive = normalizedSlideBackground === preset.value.toLowerCase();
                      return (
                        <button
                          key={preset.value}
                          type="button"
                          className={`mobile-color-swatch ${isActive ? "active" : ""} ${
                            preset.value.toLowerCase() === "#ffffff" ? "is-light" : ""
                          }`}
                          style={{ backgroundColor: preset.value }}
                          title={preset.label}
                          aria-label={preset.label}
                          onClick={() =>
                            onSlideBackgroundChange(preset.value, { applyAll: applyStyleForAll })
                          }
                          disabled={disabled}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="mobile-sheet-subsection">
                  <span className="settings-label">Стиль фона</span>
                  <div className="mobile-style-grid mobile-style-grid-preview">
                    {STYLE_PRESETS.map((preset) => {
                      const isActive = normalizedSlideBackground === preset.background.toLowerCase();
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          className={`mobile-style-chip mobile-style-chip-preview ${
                            isActive ? "active" : ""
                          }`}
                          disabled={disabled}
                          onClick={() =>
                            onApplyStylePreset(preset.id, { applyAll: applyStyleForAll })
                          }
                        >
                          <span
                            className="mobile-style-chip-preview-box"
                            style={{
                              backgroundColor: preset.background,
                              backgroundImage: preset.preview === "none" ? undefined : preset.preview,
                              backgroundSize:
                                preset.id === "dots"
                                  ? "8px 8px, 8px 8px"
                                  : preset.id === "grid"
                                    ? "10px 10px, 10px 10px"
                                    : undefined
                            }}
                          />
                          <span>{preset.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <MobileSwitchRow
                    label="Показывать сетку"
                    checked={gridVisible}
                    onCheckedChange={(checked) =>
                      onGridVisibilityChange(checked, { applyAll: applyStyleForAll })
                    }
                    disabled={disabled}
                  />
                </div>
              </div>
            ) : null}

            {activeTab === "text" ? (
              <div className="settings-block">
                {selectedElementLabel ? <div className="settings-selected-pill">{selectedElementLabel}</div> : null}

                <div className="segment-control">
                  <button
                    type="button"
                    className={`segment-item ${selectedTextTargetRole === "title" ? "active" : ""}`}
                    onClick={() => onSelectedTextTargetRoleChange("title")}
                    disabled={disabled}
                  >
                    Заголовок
                  </button>
                  <button
                    type="button"
                    className={`segment-item ${selectedTextTargetRole === "body" ? "active" : ""}`}
                    onClick={() => onSelectedTextTargetRoleChange("body")}
                    disabled={disabled}
                  >
                    Описание
                  </button>
                </div>

                <label className="field-label">
                  Текст элемента
                  <textarea
                    className="textarea"
                    value={activeTextElement?.text ?? ""}
                    onChange={(event) => onSelectedTextChange(event.target.value)}
                    onSelect={(event) =>
                      onSelectedTextSelectionChange(
                        event.currentTarget.selectionStart ?? 0,
                        event.currentTarget.selectionEnd ?? 0
                      )
                    }
                    onKeyUp={(event) =>
                      onSelectedTextSelectionChange(
                        event.currentTarget.selectionStart ?? 0,
                        event.currentTarget.selectionEnd ?? 0
                      )
                    }
                    onMouseUp={(event) =>
                      onSelectedTextSelectionChange(
                        event.currentTarget.selectionStart ?? 0,
                        event.currentTarget.selectionEnd ?? 0
                      )
                    }
                    onTouchEnd={(event) =>
                      onSelectedTextSelectionChange(
                        event.currentTarget.selectionStart ?? 0,
                        event.currentTarget.selectionEnd ?? 0
                      )
                    }
                    placeholder="Выберите текст на слайде"
                    rows={4}
                    disabled={disabled || !activeTextElement}
                  />
                </label>

                <div className="mobile-sheet-row">
                  <label className="field-label">
                    Цвет текста
                    <div className="mobile-color-inline">
                      <input
                        type="color"
                        className="color-input"
                        value={normalizedTextColor}
                        onChange={(event) => onSelectedTextColorChange(event.target.value)}
                        disabled={disabled || !activeTextElement}
                      />
                      <HexColorField
                        value={normalizedTextColor}
                        onValidChange={onSelectedTextColorChange}
                        disabled={disabled || !activeTextElement}
                      />
                    </div>
                  </label>

                  <label className="field-label">
                    Цвет выделения
                    <div className="mobile-color-inline">
                      <input
                        type="color"
                        className="color-input"
                        value={normalizedHighlightColor}
                        onChange={(event) => onSelectedTextHighlightColorChange(event.target.value)}
                        disabled={disabled || !activeTextElement}
                      />
                      <HexColorField
                        value={normalizedHighlightColor}
                        onValidChange={onSelectedTextHighlightColorChange}
                        disabled={disabled || !activeTextElement}
                      />
                    </div>
                  </label>

                  <div className="field-row field-row-actions">
                    <button
                      type="button"
                      className="ghost-chip"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={onApplyHighlightToSelection}
                      disabled={disabled || !activeTextElement}
                    >
                      Выделить
                    </button>
                    <button
                      type="button"
                      className="ghost-chip ghost-chip-muted"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={onClearHighlightFromSelection}
                      disabled={disabled || !activeTextElement}
                    >
                      Снять
                    </button>
                  </div>

                  <div className="field-row field-row-actions">
                    <button
                      type="button"
                      className="ghost-chip ghost-chip-muted"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={onApplyHighlightColorToAllSlides}
                      disabled={disabled || !activeTextElement}
                    >
                      Все слайды
                    </button>
                    <button
                      type="button"
                      className="ghost-chip ghost-chip-muted"
                      onClick={onClearAllHighlights}
                      disabled={disabled || !activeTextElement}
                    >
                      Очистить всё
                    </button>
                  </div>
                </div>

                <label className="field-label">
                  <span>Прозрачность выделения</span>
                  <div className="mobile-size-control">
                    <input
                      type="range"
                      className="range"
                      min={8}
                      max={100}
                      step={1}
                      value={Math.round(selectedTextHighlightOpacity * 100)}
                      onChange={(event) =>
                        onSelectedTextHighlightOpacityChange(Number(event.target.value) / 100)
                      }
                      disabled={disabled || !activeTextElement}
                    />
                    <div className="mobile-size-value">{Math.round(selectedTextHighlightOpacity * 100)}%</div>
                  </div>
                </label>

                <span className="settings-label">Шрифт</span>
                <div className="mobile-font-grid">
                  {FONT_OPTIONS.map((fontName) => {
                    const isActive = activeTextElement?.fontFamily === fontName;
                    return (
                      <button
                        key={`font-${fontName}`}
                        type="button"
                        className={`mobile-font-item ${isActive ? "active" : ""}`}
                        onClick={() => onSelectedTextFontChange(fontName)}
                        disabled={disabled || !activeTextElement}
                        style={{ fontFamily: fontName }}
                      >
                        {fontName}
                      </button>
                    );
                  })}
                </div>

                <span className="settings-label">Размер и регистр</span>
                <div className="mobile-size-control">
                  <input
                    type="range"
                    className="range"
                    min={14}
                    max={96}
                    step={1}
                    value={Math.round(activeTextElement?.fontSize ?? 28)}
                    onChange={(event) => onSelectedTextSizeChange(Number(event.target.value))}
                    disabled={disabled || !activeTextElement}
                  />
                  <div className="mobile-size-value">{Math.round(activeTextElement?.fontSize ?? 28)}px</div>
                </div>

                <div className="mobile-case-grid">
                  <button
                    type="button"
                    className="mobile-case-btn"
                    onClick={() => onSelectedTextCaseChange("capitalize")}
                    disabled={disabled || !activeTextElement}
                  >
                    Aa
                  </button>
                  <button
                    type="button"
                    className="mobile-case-btn"
                    onClick={() => onSelectedTextCaseChange("uppercase")}
                    disabled={disabled || !activeTextElement}
                  >
                    AA
                  </button>
                  <button
                    type="button"
                    className="mobile-case-btn"
                    onClick={() => onSelectedTextCaseChange("lowercase")}
                    disabled={disabled || !activeTextElement}
                  >
                    aa
                  </button>
                  <button
                    type="button"
                    className="mobile-case-btn"
                    onClick={() => onSelectedTextCaseChange("normal")}
                    disabled={disabled || !activeTextElement}
                  >
                    аА
                  </button>
                </div>

                <span className="settings-label">Выравнивание</span>
                <div className="segment-control segment-control-neutral segment-control-align">
                  <button
                    type="button"
                    className={`segment-item segment-item-neutral segment-item-icon ${
                      activeTextElement?.align === "left" ? "active" : ""
                    }`}
                    onClick={() => onSelectedTextAlignChange("left")}
                    title="По левому краю"
                    disabled={disabled || !activeTextElement}
                  >
                    <AppIcon name="align-left" size={14} />
                  </button>
                  <button
                    type="button"
                    className={`segment-item segment-item-neutral segment-item-icon ${
                      activeTextElement?.align === "center" ? "active" : ""
                    }`}
                    onClick={() => onSelectedTextAlignChange("center")}
                    title="По центру"
                    disabled={disabled || !activeTextElement}
                  >
                    <AppIcon name="align-center" size={14} />
                  </button>
                  <button
                    type="button"
                    className={`segment-item segment-item-neutral segment-item-icon ${
                      activeTextElement?.align === "right" ? "active" : ""
                    }`}
                    onClick={() => onSelectedTextAlignChange("right")}
                    title="По правому краю"
                    disabled={disabled || !activeTextElement}
                  >
                    <AppIcon name="align-right" size={14} />
                  </button>
                </div>

                <button
                  type="button"
                  className="ghost-chip ghost-chip-muted"
                  onClick={onCenterSelectedTextHorizontally}
                  disabled={disabled || !activeTextElement}
                >
                  —|— По центру
                </button>
              </div>
            ) : null}

            {activeTab === "photo" ? (
              <div className="settings-block">
                <MobileSwitchRow
                  label="Фото-блок"
                  checked={photoSlotEnabled}
                  onCheckedChange={onPhotoSlotEnabledChange}
                  disabled={disabled}
                />

                <div className="field-row field-row-actions">
                  <button
                    type="button"
                    className="ghost-chip"
                    onClick={onUploadBackgroundImage}
                    disabled={disabled || !photoSlotEnabled}
                  >
                    Загрузить фото
                  </button>
                  <button
                    type="button"
                    className="ghost-chip ghost-chip-muted"
                    onClick={onRemoveBackgroundImage}
                    disabled={disabled || !photoSlotEnabled || !hasBackgroundImage}
                  >
                    Очистить фото
                  </button>
                </div>

                {hasBackgroundImage ? (
                  <div className="field-grid">
                    <label className="field-label">
                      Зум ({photoSettings.zoom}%)
                      <input
                        className="range"
                        type="range"
                        min={100}
                        max={200}
                        step={1}
                        value={photoSettings.zoom}
                        onChange={(event) =>
                          onSlidePhotoSettingsChange({ zoom: Number(event.target.value) })
                        }
                        disabled={disabled || !photoSlotEnabled}
                      />
                    </label>
                    <label className="field-label">
                      Позиция X ({photoSettings.offsetX}%)
                      <input
                        className="range"
                        type="range"
                        min={-50}
                        max={50}
                        step={1}
                        value={photoSettings.offsetX}
                        onChange={(event) =>
                          onSlidePhotoSettingsChange({ offsetX: Number(event.target.value) })
                        }
                        disabled={disabled || !photoSlotEnabled}
                      />
                    </label>
                    <label className="field-label">
                      Позиция Y ({photoSettings.offsetY}%)
                      <input
                        className="range"
                        type="range"
                        min={-50}
                        max={50}
                        step={1}
                        value={photoSettings.offsetY}
                        onChange={(event) =>
                          onSlidePhotoSettingsChange({ offsetY: Number(event.target.value) })
                        }
                        disabled={disabled || !photoSlotEnabled}
                      />
                    </label>
                    <label className="field-label">
                      Затемнение ({photoSettings.overlay}%)
                      <input
                        className="range"
                        type="range"
                        min={0}
                        max={80}
                        step={1}
                        value={photoSettings.overlay}
                        onChange={(event) =>
                          onSlidePhotoSettingsChange({ overlay: Number(event.target.value) })
                        }
                        disabled={disabled || !photoSlotEnabled}
                      />
                    </label>
                  </div>
                ) : null}

                <label className="field-label">
                  Ник
                  <input
                    className="field"
                    value={profileHandle}
                    onChange={(event) => onProfileHandleChange(event.target.value)}
                    placeholder="@username"
                    disabled={disabled}
                  />
                </label>

                <label className="field-label">
                  Подпись
                  <input
                    className="field"
                    value={profileSubtitle}
                    onChange={(event) => onProfileSubtitleChange(event.target.value)}
                    placeholder="Подпись (необязательно)"
                    disabled={disabled}
                  />
                </label>

                <MobileSwitchRow
                  label="Показывать подпись на всех слайдах"
                  checked={subtitlesVisibleAcrossSlides}
                  onCheckedChange={onToggleSubtitleAcrossSlides}
                  disabled={disabled}
                />
              </div>
            ) : null}

            {activeTab === "export" ? (
              <div className="settings-block">
                <button
                  type="button"
                  className="btn export-primary-cta"
                  onClick={onOpenExportModal}
                  disabled={disabled || isExporting || isGenerating}
                >
                  <AppIcon name="download" size={16} />
                  <span>{isExporting ? "Экспорт..." : "Экспортировать карусель"}</span>
                </button>

                <div className="field-row field-row-actions caption-actions-row">
                  <button
                    type="button"
                    className="btn caption-generate-button"
                    onClick={onGenerateCaption}
                    disabled={disabled || isGenerating || isGeneratingCaption}
                  >
                    <span>{isGeneratingCaption ? "Генерирую..." : "Сгенерировать подпись"}</span>
                  </button>
                  {captionResult ? (
                    <button
                      type="button"
                      className="ghost-chip ghost-chip-muted caption-copy-button"
                      onClick={handleCaptionCopyClick}
                      disabled={disabled}
                    >
                      {isCaptionCopied ? "Скопировано ✓" : "Копировать"}
                    </button>
                  ) : null}
                </div>

                <textarea
                  className={`textarea caption-main-textarea ${
                    captionResult ? "" : "caption-main-textarea-placeholder"
                  }`}
                  value={
                    captionResult
                      ? [
                          captionResult.text,
                          "",
                          `CTA: ${captionResult.cta}`,
                          captionResult.ctaSoft ? `Soft CTA: ${captionResult.ctaSoft}` : "",
                          captionResult.ctaAggressive ? `Aggressive CTA: ${captionResult.ctaAggressive}` : "",
                          "",
                          captionResult.hashtags.join(" ")
                        ]
                          .filter(Boolean)
                          .join("\n")
                      : ""
                  }
                  placeholder="Здесь появится подпись к посту после нажатия «Сгенерировать»"
                  rows={8}
                  readOnly
                />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}

function MobileSwitchRow({
  label,
  checked,
  onCheckedChange,
  disabled,
  compact = false
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled: boolean;
  compact?: boolean;
}) {
  return (
    <label className={`mobile-switch-row ${compact ? "mobile-switch-row-compact" : ""}`}>
      <span>{label}</span>
      <Switch.Root
        className="mobile-switch-root"
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={label}
      >
        <Switch.Thumb className="mobile-switch-thumb" />
      </Switch.Root>
    </label>
  );
}

function getTabTitle(tab: MobileToolTab) {
  if (tab === "slides") {
    return "Слайды";
  }

  if (tab === "style") {
    return "Стиль";
  }

  if (tab === "text") {
    return "Текст";
  }

  if (tab === "photo") {
    return "Фото";
  }

  return "Экспорт";
}

function getSlideRoleLabel(role: Slide["generationRole"]) {
  if (role === "hook") {
    return "Крючок";
  }
  if (role === "problem") {
    return "Проблема";
  }
  if (role === "amplify") {
    return "Усиление";
  }
  if (role === "mistake") {
    return "Ошибка";
  }
  if (role === "consequence") {
    return "Последствие";
  }
  if (role === "shift") {
    return "Поворот";
  }
  if (role === "solution") {
    return "Решение";
  }
  if (role === "example") {
    return "Пример";
  }
  if (role === "cta") {
    return "Призыв";
  }
  return "Слайд";
}

function normalizeColor(value: string) {
  if (!value || !value.startsWith("#") || (value.length !== 7 && value.length !== 4)) {
    return "#ffffff";
  }

  return value;
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
