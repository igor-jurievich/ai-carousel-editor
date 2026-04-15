"use client";

import { useRef, useState, type MutableRefObject, type TouchEvent } from "react";
import { AppIcon, type AppIconName } from "@/components/icons";
import type { CanvasElement, CarouselPostCaption, TextElement } from "@/types/editor";

export type MobileToolTab =
  | "templates"
  | "color"
  | "background"
  | "style"
  | "text"
  | "post"
  | "font"
  | "size";

type MobileToolsProps = {
  activeTab: MobileToolTab | null;
  onTabChange: (tab: MobileToolTab | null) => void;
  selectedElement: CanvasElement | null;
  selectedTextElement: TextElement | null;
  selectedTextTargetRole: "title" | "body";
  activeTemplateName: string;
  profileHandle: string;
  profileSubtitle: string;
  subtitlesVisibleAcrossSlides: boolean;
  photoSlotEnabled: boolean;
  hasBackgroundImage: boolean;
  gridVisible: boolean;
  captionResult: CarouselPostCaption | null;
  isGeneratingCaption: boolean;
  onGenerateCaption: () => void;
  onCopyCaption: () => void;
  onPhotoSlotEnabledChange: (value: boolean) => void;
  slideBackground: string;
  onUploadBackgroundImage: () => void;
  onAddSlidePhoto: () => void;
  onRemoveBackgroundImage: () => void;
  onGridVisibilityChange: (visible: boolean, options?: { applyAll?: boolean }) => void;
  onOpenTemplateModal: () => void;
  onProfileHandleChange: (value: string) => void;
  onProfileSubtitleChange: (value: string) => void;
  onToggleSubtitleAcrossSlides: (visible: boolean) => void;
  onSlideBackgroundChange: (value: string, options?: { applyAll?: boolean }) => void;
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
  onSelectedTextTargetRoleChange: (role: "title" | "body") => void;
  onApplyColorScheme: (mode: "single" | "double", options?: { applyAll?: boolean }) => void;
  onApplyHighlightToSelection: () => void;
  onClearHighlightFromSelection: () => void;
  onClearAllHighlights: () => void;
  selectedTextHighlightColor: string;
  selectedTextHighlightOpacity: number;
  toolbarRef?: MutableRefObject<HTMLElement | null>;
  toolSheetRef?: MutableRefObject<HTMLElement | null>;
  disabled?: boolean;
  previewMode?: boolean;
};

const TOOLBAR_ITEMS: Array<{ id: MobileToolTab; icon: AppIconName; label: string }> = [
  { id: "templates", icon: "templates", label: "Шаблоны" },
  { id: "post", icon: "edit", label: "Пост" },
  { id: "color", icon: "palette", label: "Цвет" },
  { id: "background", icon: "background", label: "Фон" },
  { id: "style", icon: "style", label: "Стиль" },
  { id: "text", icon: "text", label: "Текст" },
  { id: "font", icon: "font", label: "Шрифт" },
  { id: "size", icon: "size", label: "Размер" }
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
const HEX_COLOR_INPUT_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const STYLE_PRESETS = [
  {
    id: "mono",
    label: "Монохром",
    background: "#ffffff",
    preview: "none",
    gridVisible: false
  },
  {
    id: "grid",
    label: "Сетка",
    background: "#f8f8f9",
    preview:
      "repeating-linear-gradient(90deg, rgba(18,21,27,0.12) 0 1px, transparent 1px 10px), repeating-linear-gradient(180deg, rgba(18,21,27,0.12) 0 1px, transparent 1px 10px)",
    gridVisible: true
  },
  {
    id: "gradient",
    label: "Градиент",
    background: "#f4ede8",
    preview: "linear-gradient(135deg, #f7f7f7 0%, #f2e8df 100%)",
    gridVisible: false
  },
  {
    id: "notes",
    label: "Заметки",
    background: "#ececf1",
    preview: "linear-gradient(180deg, #f2f2f6 0%, #eaebef 100%)",
    gridVisible: false
  },
  {
    id: "dots",
    label: "Точки",
    background: "#f5f5f6",
    preview:
      "radial-gradient(circle, rgba(18,21,27,0.2) 1px, transparent 1.2px), radial-gradient(circle, rgba(18,21,27,0.14) 1px, transparent 1.2px)",
    gridVisible: true
  },
  {
    id: "flash",
    label: "Молнии",
    background: "#e8e9ed",
    preview: "linear-gradient(130deg, #f6f6f7 10%, #e8e9ed 46%, #dfe1e7 100%)",
    gridVisible: false
  }
] as const;

export function MobileTools({
  activeTab,
  onTabChange,
  selectedElement,
  selectedTextElement,
  selectedTextTargetRole,
  activeTemplateName,
  profileHandle,
  profileSubtitle,
  subtitlesVisibleAcrossSlides,
  photoSlotEnabled,
  hasBackgroundImage,
  gridVisible,
  captionResult,
  isGeneratingCaption,
  onGenerateCaption,
  onCopyCaption,
  onPhotoSlotEnabledChange,
  slideBackground,
  onUploadBackgroundImage,
  onAddSlidePhoto,
  onRemoveBackgroundImage,
  onGridVisibilityChange,
  onOpenTemplateModal,
  onProfileHandleChange,
  onProfileSubtitleChange,
  onToggleSubtitleAcrossSlides,
  onSlideBackgroundChange,
  onApplyStylePreset,
  onSelectedTextChange,
  onSelectedTextColorChange,
  onSelectedTextHighlightColorChange,
  onSelectedTextHighlightOpacityChange,
  onSelectedTextSelectionChange,
  onSelectedTextFontChange,
  onSelectedTextSizeChange,
  onSelectedTextCaseChange,
  onSelectedTextTargetRoleChange,
  onApplyColorScheme,
  onApplyHighlightToSelection,
  onClearHighlightFromSelection,
  onClearAllHighlights,
  selectedTextHighlightColor,
  selectedTextHighlightOpacity,
  toolbarRef,
  toolSheetRef,
  disabled = false,
  previewMode = false
}: MobileToolsProps) {
  const swipeRef = useRef<{ startY: number; startX: number; drag: number } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [colorMode, setColorMode] = useState<"single" | "double">("single");
  const [applyColorForAll, setApplyColorForAll] = useState(true);
  const [applyStyleForAll, setApplyStyleForAll] = useState(true);
  const [applySizeForAll, setApplySizeForAll] = useState(false);
  const activeTextElement = selectedTextElement;
  const normalizedTextColor = normalizeColorForInput(activeTextElement?.fill, "#56cfc2");
  const normalizedHighlightColor = normalizeColorForInput(selectedTextHighlightColor, "#1f49ff");
  const applyColorMode = (nextMode: "single" | "double") => {
    setColorMode(nextMode);
    onApplyColorScheme(nextMode, { applyAll: applyColorForAll });

    if (!activeTextElement || disabled) {
      return;
    }

    if (nextMode === "single") {
      const unifiedColor = activeTextElement.fill || selectedTextHighlightColor || "#56cfc2";
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
  const selectedElementLabel = selectedElement
    ? selectedElement.type === "text"
      ? "Выбран текст"
      : selectedElement.type === "image"
        ? "Выбрано изображение"
        : "Выбрана фигура"
    : activeTextElement
      ? selectedTextTargetRole === "body"
        ? "Автовыбор: описание"
        : "Автовыбор: заголовок"
      : "";

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
      <nav
        ref={(node) => {
          if (toolbarRef) {
            toolbarRef.current = node;
          }
        }}
        className={`mobile-bottom-toolbar mobile-bottom-toolbar-v2 ${activeTab ? "is-sheet-open" : ""}`}
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
              onClick={() => {
                if (item.id === "templates") {
                  onOpenTemplateModal();
                  onTabChange(null);
                  return;
                }
                onTabChange(isActive ? null : item.id);
              }}
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
          className={`mobile-tool-sheet mobile-tool-sheet-v2 ${dragOffset > 0 ? "is-dragging" : ""}`}
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
          <div className="mobile-tool-sheet-header">
            <div className="mobile-tool-sheet-title-row">
              <h3>{getTabTitle(activeTab)}</h3>
              {activeTab === "text" ? <span className="mobile-sheet-badge">Подсказка</span> : null}
            </div>
            <button
              type="button"
              className="mobile-tool-close"
              onClick={() => onTabChange(null)}
              aria-label="Закрыть панель"
            >
              <AppIcon name="close" size={16} />
            </button>
          </div>

          <div className={`mobile-tool-sheet-body mobile-tool-sheet-body-${activeTab}`}>
            {selectedElementLabel ? <div className="settings-selected-pill">{selectedElementLabel}</div> : null}

            {activeTab === "templates" ? (
              <div className="settings-block">
                <span className="settings-label">Шаблон карусели</span>
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
                    <strong>Открыть библиотеку</strong>
                    <small>{activeTemplateName}</small>
                  </span>
                  <AppIcon name="chevron-right" size={14} />
                </button>
              </div>
            ) : null}

            {activeTab === "color" ? (
              <div className="settings-block">
                <span className="settings-label">Цветовая схема</span>
                <label className="mobile-switch-row">
                  <span>Применить для всех слайдов</span>
                  <input
                    type="checkbox"
                    checked={applyColorForAll}
                    onChange={(event) => setApplyColorForAll(event.target.checked)}
                    disabled={disabled}
                  />
                </label>
                <div className="segment-control">
                  <button
                    type="button"
                    className={`segment-item ${colorMode === "single" ? "active" : ""}`}
                    onClick={() => applyColorMode("single")}
                    disabled={disabled}
                  >
                    Одинарная
                  </button>
                  <button
                    type="button"
                    className={`segment-item ${colorMode === "double" ? "active" : ""}`}
                    onClick={() => applyColorMode("double")}
                    disabled={disabled}
                  >
                    Двойная
                  </button>
                </div>

                {colorMode === "single" ? (
                  <div className="mobile-sheet-row">
                    <label className="field-label">
                      Единый цвет текста и выделения
                      <div className="mobile-color-inline">
                        <input
                          type="color"
                          className="color-input"
                          value={normalizedTextColor}
                          onChange={(event) => handleSinglePaletteColorChange(event.target.value)}
                          disabled={disabled || !activeTextElement}
                        />
                        <input
                          className="field"
                          value={normalizedTextColor.toUpperCase()}
                          readOnly
                        />
                      </div>
                    </label>
                  </div>
                ) : (
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
                        <input
                          className="field"
                          value={normalizedTextColor.toUpperCase()}
                          readOnly
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
                        <input
                          className="field"
                          value={normalizedHighlightColor.toUpperCase()}
                          readOnly
                        />
                      </div>
                    </label>
                  </div>
                )}
              </div>
            ) : null}

            {activeTab === "background" ? (
              <div className="settings-block">
                <span className="settings-label">Фон</span>
                <label className="field-label">
                  Цвет фона
                  <select
                    className="field"
                    value={normalizeColor(slideBackground)}
                    onChange={(event) =>
                      onSlideBackgroundChange(event.target.value, { applyAll: applyStyleForAll })
                    }
                    disabled={disabled}
                  >
                    <option value="#ffffff">Белый</option>
                    <option value="#f2f2f2">Светло-серый</option>
                    <option value="#f6f2ed">Теплый</option>
                    <option value="#edf3f6">Холодный</option>
                    <option value="#1f2428">Графит</option>
                  </select>
                </label>
                <label className="mobile-switch-row">
                  <span>Фото-блок</span>
                  <input
                    type="checkbox"
                    checked={photoSlotEnabled}
                    onChange={(event) => onPhotoSlotEnabledChange(event.target.checked)}
                    disabled={disabled}
                  />
                </label>
                <label className="mobile-switch-row">
                  <span>Применить для всех слайдов</span>
                  <input
                    type="checkbox"
                    checked={applyStyleForAll}
                    onChange={(event) => setApplyStyleForAll(event.target.checked)}
                    disabled={disabled}
                  />
                </label>
                <div className="field-row">
                  <button
                    type="button"
                    className="ghost-chip"
                    onClick={onAddSlidePhoto}
                    disabled={disabled}
                  >
                    + Добавить фото на слайд
                  </button>
                </div>
                <div className="field-row">
                  <button
                    type="button"
                    className="ghost-chip"
                    onClick={onUploadBackgroundImage}
                    disabled={disabled}
                  >
                    + Выбрать файл
                  </button>
                  <button
                    type="button"
                    className="ghost-chip ghost-chip-muted"
                    onClick={onRemoveBackgroundImage}
                    disabled={!hasBackgroundImage || disabled}
                  >
                    Очистить фото
                  </button>
                </div>
              </div>
            ) : null}

            {activeTab === "style" ? (
              <div className="settings-block">
                <span className="settings-label">Стиль фона</span>
                <label className="mobile-switch-row">
                  <span>Применить для всех слайдов</span>
                  <input
                    type="checkbox"
                    checked={applyStyleForAll}
                    onChange={(event) => setApplyStyleForAll(event.target.checked)}
                    disabled={disabled}
                  />
                </label>
                <div className="mobile-style-grid">
                  {STYLE_PRESETS.map((preset) => {
                    const isActive = normalizeColor(slideBackground) === preset.background;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={`mobile-style-chip ${isActive ? "active" : ""}`}
                        disabled={disabled}
                        onClick={() =>
                          onApplyStylePreset(preset.id, { applyAll: applyStyleForAll })
                        }
                      >
                        <span
                          className="mobile-style-chip-preview"
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
                <label className="mobile-switch-row">
                  <span>Показывать сетку</span>
                  <input
                    type="checkbox"
                    checked={gridVisible}
                    onChange={(event) =>
                      onGridVisibilityChange(event.target.checked, { applyAll: applyStyleForAll })
                    }
                    disabled={disabled}
                  />
                </label>
              </div>
            ) : null}

            {activeTab === "text" ? (
              <div className="settings-block">
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
                    rows={3}
                    disabled={disabled || !activeTextElement}
                  />
                </label>

                <div className="mobile-sheet-row">
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
                      <input className="field" value={normalizedHighlightColor.toUpperCase()} readOnly />
                    </div>
                  </label>
                  <div className="field-row">
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
                  <button
                    type="button"
                    className="ghost-chip ghost-chip-muted"
                    onClick={onClearAllHighlights}
                    disabled={disabled || !activeTextElement}
                  >
                    Очистить все выделения
                  </button>
                </div>

                <label className="field-label">
                  Прозрачность выделения
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
                </label>

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
                    Норм
                  </button>
                </div>

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
                <label className="mobile-switch-row">
                  <span>Показывать подпись на всех слайдах</span>
                  <input
                    type="checkbox"
                    checked={subtitlesVisibleAcrossSlides}
                    onChange={(event) => onToggleSubtitleAcrossSlides(event.target.checked)}
                    disabled={disabled}
                  />
                </label>
              </div>
            ) : null}

            {activeTab === "post" ? (
              <div className="settings-block">
                <span className="settings-label">Подпись к посту</span>
                <div className="field-row field-row-actions">
                  <button
                    type="button"
                    className="ghost-chip"
                    onClick={onGenerateCaption}
                    disabled={disabled || isGeneratingCaption}
                  >
                    {isGeneratingCaption ? "Генерирую..." : "Сгенерировать"}
                  </button>
                  <button
                    type="button"
                    className="ghost-chip ghost-chip-muted"
                    onClick={onCopyCaption}
                    disabled={disabled || !captionResult}
                  >
                    Копировать
                  </button>
                </div>

                {captionResult ? (
                  <textarea
                    className="textarea"
                    value={[
                      captionResult.text,
                      "",
                      `CTA: ${captionResult.cta}`,
                      captionResult.ctaSoft ? `Soft CTA: ${captionResult.ctaSoft}` : "",
                      captionResult.ctaAggressive ? `Aggressive CTA: ${captionResult.ctaAggressive}` : "",
                      "",
                      captionResult.hashtags.join(" ")
                    ]
                      .filter(Boolean)
                      .join("\n")}
                    rows={8}
                    readOnly
                  />
                ) : (
                  <div className="settings-hint">
                    Сначала сгенерируйте карусель, затем нажмите «Сгенерировать».
                  </div>
                )}
              </div>
            ) : null}

            {activeTab === "font" ? (
              <div className="settings-block">
                <span className="settings-label">Шрифты</span>
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

                <button type="button" className="mobile-upload-font-btn" disabled>
                  + Добавить шрифт
                </button>
                <div className="mobile-font-note">
                  Убедитесь, что у Вас есть лицензия на использование загружаемого шрифта
                </div>
              </div>
            ) : null}

            {activeTab === "size" ? (
              <div className="settings-block">
                <span className="settings-label">Размер текста</span>
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
                <span className="field-label">Регистр</span>
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
                    Aa
                  </button>
                </div>
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
                <label className="mobile-switch-row">
                  <span>Применить для всех слайдов</span>
                  <input
                    type="checkbox"
                    checked={applySizeForAll}
                    onChange={(event) => setApplySizeForAll(event.target.checked)}
                    disabled={disabled}
                  />
                </label>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}

function getTabTitle(tab: MobileToolTab) {
  if (tab === "templates") {
    return "Шаблоны";
  }

  if (tab === "color") {
    return "Цветовая схема";
  }

  if (tab === "background") {
    return "Фон";
  }

  if (tab === "style") {
    return "Стиль фона";
  }

  if (tab === "text") {
    return "Редактирование текста";
  }

  if (tab === "font") {
    return "Шрифты";
  }

  if (tab === "post") {
    return "Подпись к посту";
  }

  return "Размер текста";
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
