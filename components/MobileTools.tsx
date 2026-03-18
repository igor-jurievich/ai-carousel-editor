"use client";

import { useRef, useState, type MutableRefObject, type TouchEvent } from "react";
import {
  BACKGROUND_STYLE_PRESETS,
  FOOTER_VARIANTS,
  FONT_OPTIONS,
  getPrimaryTemplates,
  STYLE_PRESETS,
  getTemplatesByCategory,
  type StylePresetId,
  TEMPLATE_CATEGORY_LABELS
} from "@/lib/carousel";
import { AppIcon, type AppIconName } from "@/components/icons";
import type {
  CanvasElement,
  CarouselTemplateId,
  FooterVariantId,
  Slide,
  TemplateCategoryId
} from "@/types/editor";

export type MobileToolTab =
  | "templates"
  | "background"
  | "style"
  | "text"
  | "font"
  | "size";

type MobileToolsProps = {
  activeTab: MobileToolTab | null;
  onTabChange: (tab: MobileToolTab | null) => void;
  slide: Slide;
  selectedElement: CanvasElement | null;
  activeTemplateId: CarouselTemplateId;
  activeTemplateCategory: TemplateCategoryId;
  templateScope: "slide" | "all";
  footerVariant: FooterVariantId;
  profileHandle: string;
  profileSubtitle: string;
  hasBackgroundImage: boolean;
  onBackgroundChange: (color: string) => void;
  onUploadBackgroundImage: () => void;
  onRemoveBackgroundImage: () => void;
  onTemplateCategoryChange: (category: TemplateCategoryId) => void;
  onTemplateScopeChange: (scope: "slide" | "all") => void;
  onApplyTemplate: (templateId: CarouselTemplateId) => void;
  onApplyStylePreset: (presetId: StylePresetId) => void;
  onProfileHandleChange: (value: string) => void;
  onProfileSubtitleChange: (value: string) => void;
  onFooterVariantChange: (value: FooterVariantId) => void;
  onUpdateElement: (elementId: string, updater: (element: CanvasElement) => CanvasElement) => void;
  onApplyGlobalTypography: (titleFont: string, bodyFont: string) => void;
  frameColor: string;
  onFrameColorChange: (value: string) => void;
  onUpdateBackgroundImageStyle: (updates: {
    fitMode?: "cover" | "contain" | "original";
    zoom?: number;
    offsetX?: number;
    offsetY?: number;
    darken?: number;
  }) => void;
  backgroundImageFitMode: "cover" | "contain" | "original";
  backgroundImageZoom: number;
  backgroundImageOffsetX: number;
  backgroundImageOffsetY: number;
  backgroundImageDarken: number;
  hasImageBlockLayout: boolean;
  imageBlockPosition: "top" | "bottom" | "background";
  imageBlockHeight: number;
  onToggleImageBlockPosition: () => void;
  onImageBlockHeightChange: (height: number) => void;
  onResetElementRotation: () => void;
  showSlideBadge: boolean;
  onToggleSlideBadge: () => void;
  toolbarRef?: MutableRefObject<HTMLElement | null>;
  toolSheetRef?: MutableRefObject<HTMLElement | null>;
  disabled?: boolean;
  previewMode?: boolean;
};

const TOOLBAR_ITEMS: Array<{ id: MobileToolTab; icon: AppIconName; label: string }> = [
  { id: "templates", icon: "templates", label: "Шаблоны" },
  { id: "background", icon: "background", label: "Фон" },
  { id: "style", icon: "style", label: "Стиль" },
  { id: "text", icon: "text", label: "Текст" },
  { id: "font", icon: "font", label: "Шрифт" },
  { id: "size", icon: "size", label: "Размер" }
];

export function MobileTools({
  activeTab,
  onTabChange,
  slide,
  selectedElement,
  activeTemplateId,
  activeTemplateCategory,
  templateScope,
  footerVariant,
  profileHandle,
  profileSubtitle,
  hasBackgroundImage,
  onBackgroundChange,
  onUploadBackgroundImage,
  onRemoveBackgroundImage,
  onTemplateCategoryChange,
  onTemplateScopeChange,
  onApplyTemplate,
  onApplyStylePreset,
  onProfileHandleChange,
  onProfileSubtitleChange,
  onFooterVariantChange,
  onUpdateElement,
  onApplyGlobalTypography,
  frameColor,
  onFrameColorChange,
  onUpdateBackgroundImageStyle,
  backgroundImageFitMode,
  backgroundImageZoom,
  backgroundImageOffsetX,
  backgroundImageOffsetY,
  backgroundImageDarken,
  hasImageBlockLayout,
  imageBlockPosition,
  imageBlockHeight,
  onToggleImageBlockPosition,
  onImageBlockHeightChange,
  onResetElementRotation,
  showSlideBadge,
  onToggleSlideBadge,
  toolbarRef,
  toolSheetRef,
  disabled = false,
  previewMode = false
}: MobileToolsProps) {
  const [showExtendedTemplates, setShowExtendedTemplates] = useState(false);
  const [globalTitleFont, setGlobalTitleFont] = useState("");
  const [globalBodyFont, setGlobalBodyFont] = useState("");
  const templates = getTemplatesByCategory(activeTemplateCategory);
  const primaryTemplates = getPrimaryTemplates();
  const selectedTextElement = selectedElement?.type === "text" ? selectedElement : null;
  const selectedImageElement = selectedElement?.type === "image" ? selectedElement : null;
  const firstTitleFont =
    slide.elements.find(
      (element): element is Extract<CanvasElement, { type: "text" }> =>
        element.type === "text" && (element.metaKey === "managed-title" || element.role === "title")
    )?.fontFamily ?? "Manrope";
  const firstBodyFont =
    slide.elements.find(
      (element): element is Extract<CanvasElement, { type: "text" }> =>
        element.type === "text" && (element.metaKey === "managed-body" || element.role === "body")
    )?.fontFamily ?? "Inter";
  const managedTitle =
    slide.elements.find(
      (element): element is Extract<CanvasElement, { type: "text" }> =>
        element.type === "text" && element.metaKey === "managed-title"
    ) ?? null;
  const managedBody =
    slide.elements.find(
      (element): element is Extract<CanvasElement, { type: "text" }> =>
        element.type === "text" && element.metaKey === "managed-body"
    ) ?? null;
  const swipeRef = useRef<{ startY: number; startX: number; drag: number } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const selectedElementLabel = selectedElement
    ? selectedElement.type === "text"
      ? "Выбран текстовый элемент"
      : selectedElement.type === "image"
        ? "Выбрано изображение"
        : "Выбрана фигура"
    : "Элемент не выбран";

  const updateTextElement = (
    updater: (
      element: Extract<CanvasElement, { type: "text" }>
    ) => Extract<CanvasElement, { type: "text" }>
  ) => {
    if (!selectedTextElement) {
      return;
    }

    onUpdateElement(selectedTextElement.id, (element) =>
      element.type === "text" ? updater(element) : element
    );
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
    const shouldClose = swipeRef.current.drag > 90;
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
        className="mobile-bottom-toolbar"
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
                <AppIcon name={item.icon} size={16} />
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
          className={`mobile-tool-sheet ${dragOffset > 0 ? "is-dragging" : ""}`}
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
          <div className="mobile-tool-sheet-handle" />

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

          <div className="mobile-tool-sheet-body">
            <div className="settings-selected-pill">{selectedElementLabel}</div>
            {selectedElement ? (
              <button
                type="button"
                className="ghost-chip ghost-chip-small"
                onClick={onResetElementRotation}
                disabled={disabled || Math.abs(selectedElement.rotation) < 0.01}
              >
                Сбросить поворот (0°)
              </button>
            ) : null}
            {activeTab === "templates" ? (
              <div className="settings-block">
                <span className="settings-label">Быстрый старт</span>
                <div className="mobile-template-list mobile-template-list-primary">
                  {primaryTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      className={`mobile-template-card ${activeTemplateId === template.id ? "active" : ""}`}
                      onClick={() => onApplyTemplate(template.id)}
                      disabled={disabled}
                    >
                      <span
                        className="mobile-template-preview"
                        style={{
                          background:
                            template.accentAlt
                              ? `linear-gradient(150deg, ${template.background} 0%, ${template.surface} 60%, ${template.accentAlt} 100%)`
                              : template.background
                        }}
                      >
                        <span className="mobile-template-preview-sheen" />
                        <span
                          className="mobile-template-preview-chip"
                          style={{ backgroundColor: template.accent }}
                        />
                        <span
                          className="mobile-template-preview-title"
                          style={{ color: template.titleColor }}
                        >
                          {getTemplatePreviewHeadline(template)}
                        </span>
                        <span className="mobile-template-preview-lines">
                          <span style={{ backgroundColor: template.bodyColor }} />
                          <span style={{ backgroundColor: template.bodyColor }} />
                          <span style={{ backgroundColor: template.bodyColor }} />
                        </span>
                        <span
                          className="mobile-template-preview-footer"
                          style={{ color: template.bodyColor }}
                        >
                          @creator <strong>→</strong>
                        </span>
                      </span>
                      <span className="mobile-template-name">{template.name}</span>
                      <span className="mobile-template-caption">
                        {getTemplatePreviewCaption(template)}
                      </span>
                    </button>
                  ))}
                </div>

                <span className="settings-label">Пресеты серии</span>
                <div className="mobile-style-grid">
                  {STYLE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className="mobile-style-chip"
                      onClick={() => onApplyStylePreset(preset.id)}
                      disabled={disabled}
                      title={preset.hint}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="template-disclosure"
                  onClick={() => setShowExtendedTemplates((value) => !value)}
                  disabled={disabled}
                >
                  <span>
                    <strong>Расширенная библиотека</strong>
                    <span>Дополнительные шаблоны для тонкой настройки</span>
                  </span>
                  <span>{showExtendedTemplates ? "Свернуть" : "Открыть"}</span>
                </button>

                {showExtendedTemplates ? (
                  <>
                    <span className="settings-label">Категория</span>
                    <div className="segment-control">
                      {(Object.keys(TEMPLATE_CATEGORY_LABELS) as TemplateCategoryId[]).map((category) => (
                        <button
                          key={category}
                          type="button"
                          className={`segment-item ${activeTemplateCategory === category ? "active" : ""}`}
                          onClick={() => onTemplateCategoryChange(category)}
                          disabled={disabled}
                        >
                          {TEMPLATE_CATEGORY_LABELS[category]}
                        </button>
                      ))}
                    </div>

                    <span className="settings-label">Применение</span>
                    <div className="segment-control">
                      <button
                        type="button"
                        className={`segment-item ${templateScope === "slide" ? "active" : ""}`}
                        onClick={() => onTemplateScopeChange("slide")}
                        disabled={disabled}
                      >
                        Этот слайд
                      </button>
                      <button
                        type="button"
                        className={`segment-item ${templateScope === "all" ? "active" : ""}`}
                        onClick={() => onTemplateScopeChange("all")}
                        disabled={disabled}
                      >
                        Вся карусель
                      </button>
                    </div>

                    <div className="mobile-template-list">
                      {templates.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          className={`mobile-template-card ${
                            activeTemplateId === template.id ? "active" : ""
                          }`}
                          onClick={() => onApplyTemplate(template.id)}
                          disabled={disabled}
                        >
                          <span
                            className="mobile-template-preview"
                            style={{
                              background:
                                template.accentAlt
                                  ? `linear-gradient(150deg, ${template.background} 0%, ${template.surface} 60%, ${template.accentAlt} 100%)`
                                  : template.background
                            }}
                          >
                            <span className="mobile-template-preview-sheen" />
                            <span
                              className="mobile-template-preview-chip"
                              style={{ backgroundColor: template.accent }}
                            />
                            <span
                              className="mobile-template-preview-title"
                              style={{ color: template.titleColor }}
                            >
                              {getTemplatePreviewHeadline(template)}
                            </span>
                            <span className="mobile-template-preview-lines">
                              <span style={{ backgroundColor: template.bodyColor }} />
                              <span style={{ backgroundColor: template.bodyColor }} />
                              <span style={{ backgroundColor: template.bodyColor }} />
                            </span>
                            <span
                              className="mobile-template-preview-footer"
                              style={{ color: template.bodyColor }}
                            >
                              @creator <strong>→</strong>
                            </span>
                          </span>
                          <span className="mobile-template-name">{template.name}</span>
                          <span className="mobile-template-caption">
                            {getTemplatePreviewCaption(template)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            {activeTab === "background" ? (
              <div className="settings-block">
                <span className="settings-label">Фон слайда</span>
                <div className="background-preview-card" aria-hidden="true">
                  <div
                    className="background-preview-sample"
                    style={{
                      background: slide.background,
                      borderColor: frameColor
                    }}
                  />
                  <div className="background-preview-copy">
                    <strong>Предпросмотр</strong>
                    <span>Фон: {slide.background}</span>
                    <span>Рамка: {frameColor}</span>
                  </div>
                </div>
                <label className="color-row">
                  <input
                    className="color-input"
                    type="color"
                    value={slide.background}
                    onChange={(event) => onBackgroundChange(event.target.value)}
                    disabled={disabled}
                  />
                  <span>Фон карточки • {slide.background}</span>
                </label>
                <label className="color-row">
                  <input
                    className="color-input"
                    type="color"
                    value={frameColor}
                    onChange={(event) => onFrameColorChange(event.target.value)}
                    disabled={disabled}
                  />
                  <span>Цвет рамки • {frameColor}</span>
                </label>

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
                    Удалить фон
                  </button>
                </div>

                {hasBackgroundImage ? (
                  <>
                    <span className="settings-label">Режим изображения</span>
                    <div className="segment-control">
                      {(["cover", "contain", "original"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          className={`segment-item ${
                            backgroundImageFitMode === mode ? "active" : ""
                          }`}
                          onClick={() => onUpdateBackgroundImageStyle({ fitMode: mode })}
                          disabled={disabled}
                        >
                          {getFitModeLabel(mode)}
                        </button>
                      ))}
                    </div>

                    <div className="field-row">
                      <label className="field-label">
                        Zoom
                        <input
                          className="field"
                          type="number"
                          min={0.4}
                          max={4}
                          step={0.05}
                          value={backgroundImageZoom}
                          onChange={(event) =>
                            onUpdateBackgroundImageStyle({
                              zoom: Number(event.target.value) || 1
                            })
                          }
                          disabled={disabled}
                        />
                      </label>
                      <label className="field-label">
                        Darken
                        <input
                          className="field"
                          type="number"
                          min={0}
                          max={1}
                          step={0.05}
                          value={backgroundImageDarken}
                          onChange={(event) =>
                            onUpdateBackgroundImageStyle({
                              darken: Number(event.target.value) || 0
                            })
                          }
                          disabled={disabled}
                        />
                      </label>
                    </div>

                    <div className="field-row">
                      <label className="field-label">
                        Offset X
                        <input
                          className="field"
                          type="number"
                          min={-640}
                          max={640}
                          step={1}
                          value={backgroundImageOffsetX}
                          onChange={(event) =>
                            onUpdateBackgroundImageStyle({
                              offsetX: Number(event.target.value) || 0
                            })
                          }
                          disabled={disabled}
                        />
                      </label>
                      <label className="field-label">
                        Offset Y
                        <input
                          className="field"
                          type="number"
                          min={-640}
                          max={640}
                          step={1}
                          value={backgroundImageOffsetY}
                          onChange={(event) =>
                            onUpdateBackgroundImageStyle({
                              offsetY: Number(event.target.value) || 0
                            })
                          }
                          disabled={disabled}
                        />
                      </label>
                    </div>

                    {hasImageBlockLayout ? (
                      <>
                        <button
                          type="button"
                          className="ghost-chip"
                          onClick={onToggleImageBlockPosition}
                          disabled={disabled}
                        >
                          {imageBlockPosition === "bottom"
                            ? "Картинка снизу (вверх)"
                            : "Картинка сверху (вниз)"}
                        </button>
                        <label className="field-label">
                          Высота блока
                          <input
                            className="range"
                            type="range"
                            min={180}
                            max={760}
                            value={imageBlockHeight}
                            onChange={(event) =>
                              onImageBlockHeightChange(Number(event.target.value) || imageBlockHeight)
                            }
                            disabled={disabled}
                          />
                        </label>
                      </>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}

            {activeTab === "style" ? (
              <div className="settings-block">
                <span className="settings-label">Стили фона</span>
                <div className="mobile-style-grid">
                  {BACKGROUND_STYLE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className="mobile-style-chip"
                      onClick={() => onApplyTemplate(preset.templateId)}
                      disabled={disabled}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <span className="settings-label">Профиль и подпись</span>
                <div className="segment-control">
                  {FOOTER_VARIANTS.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      className={`segment-item ${footerVariant === variant.id ? "active" : ""}`}
                      onClick={() => onFooterVariantChange(variant.id)}
                      disabled={disabled}
                    >
                      {variant.label}
                    </button>
                  ))}
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
                    placeholder="Подпись"
                    disabled={disabled}
                  />
                </label>

                <button
                  type="button"
                  className={`ghost-chip ${showSlideBadge ? "" : "ghost-chip-muted"}`}
                  onClick={onToggleSlideBadge}
                  disabled={disabled}
                >
                  {showSlideBadge ? "Скрыть бейдж слайда" : "Показать бейдж слайда"}
                </button>

                {selectedTextElement ? (
                  <div className="field-label">
                    Выравнивание текста
                    <div className="icon-segment">
                      <button
                        type="button"
                        className={`icon-segment-item ${
                          selectedTextElement.align === "left" ? "active" : ""
                        }`}
                        onClick={() =>
                          updateTextElement((element) => ({
                            ...element,
                            align: "left"
                          }))
                        }
                        disabled={disabled}
                      >
                        <AppIcon name="align-left" size={14} />
                      </button>
                      <button
                        type="button"
                        className={`icon-segment-item ${
                          selectedTextElement.align === "center" ? "active" : ""
                        }`}
                        onClick={() =>
                          updateTextElement((element) => ({
                            ...element,
                            align: "center"
                          }))
                        }
                        disabled={disabled}
                      >
                        <AppIcon name="align-center" size={14} />
                      </button>
                      <button
                        type="button"
                        className={`icon-segment-item ${
                          selectedTextElement.align === "right" ? "active" : ""
                        }`}
                        onClick={() =>
                          updateTextElement((element) => ({
                            ...element,
                            align: "right"
                          }))
                        }
                        disabled={disabled}
                      >
                        <AppIcon name="align-right" size={14} />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeTab === "text" ? (
              <div className="settings-block">
                {selectedTextElement ? (
                  <>
                    {disabled ? (
                      <div className="settings-warning">
                        Перемещение и редактирование временно заблокированы во время генерации/экспорта.
                      </div>
                    ) : null}
                    <div className="field-label">
                      Форматирование
                      <div className="icon-segment">
                        <button
                          type="button"
                          className={`icon-segment-item ${
                            selectedTextElement.fontStyle?.includes("bold") ? "active" : ""
                          }`}
                          onClick={() =>
                            updateTextElement((element) => ({
                              ...element,
                              fontStyle: toggleFontStyleToken(element.fontStyle, "bold")
                            }))
                          }
                          disabled={disabled}
                          title="Жирный"
                        >
                          <AppIcon name="bold" size={14} />
                        </button>
                        <button
                          type="button"
                          className={`icon-segment-item ${
                            selectedTextElement.fontStyle?.includes("italic") ? "active" : ""
                          }`}
                          onClick={() =>
                            updateTextElement((element) => ({
                              ...element,
                              fontStyle: toggleFontStyleToken(element.fontStyle, "italic")
                            }))
                          }
                          disabled={disabled}
                          title="Курсив"
                        >
                          <AppIcon name="italic" size={14} />
                        </button>
                        <button
                          type="button"
                          className={`icon-segment-item ${
                            selectedTextElement.textDecoration?.includes("underline")
                              ? "active"
                              : ""
                          }`}
                          onClick={() =>
                            updateTextElement((element) => ({
                              ...element,
                              textDecoration: toggleTextDecorationToken(
                                element.textDecoration,
                                "underline"
                              )
                            }))
                          }
                          disabled={disabled}
                          title="Подчеркнутый"
                        >
                          <AppIcon name="underline" size={14} />
                        </button>
                        <button
                          type="button"
                          className={`icon-segment-item ${
                            selectedTextElement.textDecoration?.includes("line-through")
                              ? "active"
                              : ""
                          }`}
                          onClick={() =>
                            updateTextElement((element) => ({
                              ...element,
                              textDecoration: toggleTextDecorationToken(
                                element.textDecoration,
                                "line-through"
                              )
                            }))
                          }
                          disabled={disabled}
                          title="Зачёркнутый"
                        >
                          <AppIcon name="strike" size={14} />
                        </button>
                      </div>
                    </div>

                    <label className="color-row">
                      <input
                        className="color-input"
                        type="color"
                        value={selectedTextElement.fill}
                        onChange={(event) =>
                          updateTextElement((element) => ({
                            ...element,
                            fill: event.target.value
                          }))
                        }
                        disabled={disabled}
                      />
                      <span>Цвет текста • {selectedTextElement.fill}</span>
                    </label>

                    <div className="field-row">
                      <label className="field-label">
                        Межстрочный
                        <input
                          className="field"
                          type="number"
                          min={0.8}
                          max={2}
                          step={0.02}
                          value={selectedTextElement.lineHeight ?? 1.1}
                          onChange={(event) => {
                            const next = Number(event.target.value);
                            updateTextElement((element) => ({
                              ...element,
                              lineHeight: Number.isFinite(next) ? next : element.lineHeight
                            }));
                          }}
                          disabled={disabled}
                        />
                      </label>
                      <label className="field-label">
                        Интервал
                        <input
                          className="field"
                          type="number"
                          min={-2}
                          max={12}
                          step={0.1}
                          value={selectedTextElement.letterSpacing ?? 0}
                          onChange={(event) => {
                            const next = Number(event.target.value);
                            updateTextElement((element) => ({
                              ...element,
                              letterSpacing: Number.isFinite(next)
                                ? next
                                : element.letterSpacing
                            }));
                          }}
                          disabled={disabled}
                        />
                      </label>
                    </div>

                    <label className="field-label">
                      Текст
                      <textarea
                        className="textarea"
                        rows={6}
                        value={selectedTextElement.text}
                        onChange={(event) =>
                          updateTextElement((element) => ({
                            ...element,
                            text: event.target.value
                          }))
                        }
                        disabled={disabled}
                      />
                    </label>
                  </>
                ) : (
                  <div className="settings-empty">
                    Выберите текстовый элемент на слайде, чтобы редактировать его содержимое.
                  </div>
                )}

                {selectedTextElement?.metaKey === "managed-body" &&
                selectedTextElement.wasAutoTruncated ? (
                  <div className="settings-warning">
                    Текст автоматически сокращён для безопасной высоты в макете.
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeTab === "font" ? (
              <div className="settings-block">
                <span className="settings-label">Глобальные шрифты</span>
                <div className="field-row">
                  <label className="field-label">
                    Заголовок
                    <select
                      className="select"
                      value={globalTitleFont || firstTitleFont}
                      onChange={(event) => {
                        const nextTitleFont = event.target.value;
                        setGlobalTitleFont(nextTitleFont);
                        onApplyGlobalTypography(nextTitleFont, globalBodyFont || firstBodyFont);
                      }}
                      disabled={disabled}
                    >
                      {FONT_OPTIONS.map((font) => (
                        <option key={`global-title-${font}`} value={font}>
                          {font}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-label">
                    Описание
                    <select
                      className="select"
                      value={globalBodyFont || firstBodyFont}
                      onChange={(event) => {
                        const nextBodyFont = event.target.value;
                        setGlobalBodyFont(nextBodyFont);
                        onApplyGlobalTypography(globalTitleFont || firstTitleFont, nextBodyFont);
                      }}
                      disabled={disabled}
                    >
                      {FONT_OPTIONS.map((font) => (
                        <option key={`global-body-${font}`} value={font}>
                          {font}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  className="ghost-chip"
                  onClick={() =>
                    onApplyGlobalTypography(
                      globalTitleFont || firstTitleFont,
                      globalBodyFont || firstBodyFont
                    )
                  }
                  disabled={disabled}
                >
                  Применить ко всем слайдам
                </button>
                <span className="settings-hint">Шрифты применяются мгновенно ко всей серии.</span>
                <span className="settings-label">Выравнивание заголовка</span>
                <div className="icon-segment">
                  <button
                    type="button"
                    className={`icon-segment-item ${managedTitle?.align === "left" ? "active" : ""}`}
                    onClick={() =>
                      managedTitle
                        ? onUpdateElement(managedTitle.id, (element) =>
                            element.type === "text"
                              ? {
                                  ...element,
                                  align: "left"
                                }
                              : element
                          )
                        : undefined
                    }
                    disabled={disabled || !managedTitle}
                  >
                    <AppIcon name="align-left" size={14} />
                  </button>
                  <button
                    type="button"
                    className={`icon-segment-item ${managedTitle?.align === "center" ? "active" : ""}`}
                    onClick={() =>
                      managedTitle
                        ? onUpdateElement(managedTitle.id, (element) =>
                            element.type === "text"
                              ? {
                                  ...element,
                                  align: "center"
                                }
                              : element
                          )
                        : undefined
                    }
                    disabled={disabled || !managedTitle}
                  >
                    <AppIcon name="align-center" size={14} />
                  </button>
                  <button
                    type="button"
                    className={`icon-segment-item ${managedTitle?.align === "right" ? "active" : ""}`}
                    onClick={() =>
                      managedTitle
                        ? onUpdateElement(managedTitle.id, (element) =>
                            element.type === "text"
                              ? {
                                  ...element,
                                  align: "right"
                                }
                              : element
                          )
                        : undefined
                    }
                    disabled={disabled || !managedTitle}
                  >
                    <AppIcon name="align-right" size={14} />
                  </button>
                </div>
                <span className="settings-label">Выравнивание описания</span>
                <div className="icon-segment">
                  <button
                    type="button"
                    className={`icon-segment-item ${managedBody?.align === "left" ? "active" : ""}`}
                    onClick={() =>
                      managedBody
                        ? onUpdateElement(managedBody.id, (element) =>
                            element.type === "text"
                              ? {
                                  ...element,
                                  align: "left"
                                }
                              : element
                          )
                        : undefined
                    }
                    disabled={disabled || !managedBody}
                  >
                    <AppIcon name="align-left" size={14} />
                  </button>
                  <button
                    type="button"
                    className={`icon-segment-item ${managedBody?.align === "center" ? "active" : ""}`}
                    onClick={() =>
                      managedBody
                        ? onUpdateElement(managedBody.id, (element) =>
                            element.type === "text"
                              ? {
                                  ...element,
                                  align: "center"
                                }
                              : element
                          )
                        : undefined
                    }
                    disabled={disabled || !managedBody}
                  >
                    <AppIcon name="align-center" size={14} />
                  </button>
                  <button
                    type="button"
                    className={`icon-segment-item ${managedBody?.align === "right" ? "active" : ""}`}
                    onClick={() =>
                      managedBody
                        ? onUpdateElement(managedBody.id, (element) =>
                            element.type === "text"
                              ? {
                                  ...element,
                                  align: "right"
                                }
                              : element
                          )
                        : undefined
                    }
                    disabled={disabled || !managedBody}
                  >
                    <AppIcon name="align-right" size={14} />
                  </button>
                </div>

                {selectedTextElement ? (
                  <>
                    <span className="settings-label">Шрифты</span>
                    <div className="mobile-font-grid">
                      {FONT_OPTIONS.map((font) => (
                        <button
                          key={font}
                          type="button"
                          className={`mobile-font-item ${
                            selectedTextElement.fontFamily === font ? "active" : ""
                          }`}
                          onClick={() =>
                            updateTextElement((element) => ({
                              ...element,
                              fontFamily: font
                            }))
                          }
                          disabled={disabled}
                          style={{ fontFamily: font }}
                        >
                          {font}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="settings-empty">
                    Выберите текстовый элемент, чтобы настроить шрифт.
                  </div>
                )}
              </div>
            ) : null}

            {activeTab === "size" ? (
              <div className="settings-block">
                {selectedTextElement ? (
                  <>
                    <span className="settings-label">Размер шрифта</span>
                    <label className="field-label">
                      <input
                        className="range"
                        type="range"
                        min={12}
                        max={220}
                        value={selectedTextElement.fontSize}
                        onChange={(event) => {
                          const nextValue = Number(event.target.value);
                          updateTextElement((element) => ({
                            ...element,
                            fontSize: Number.isFinite(nextValue) ? nextValue : element.fontSize
                          }));
                        }}
                        disabled={disabled}
                      />
                    </label>
                    <label className="field-label">
                      Значение
                      <input
                        className="field"
                        type="number"
                        min={12}
                        max={220}
                        value={selectedTextElement.fontSize}
                        onChange={(event) => {
                          const nextValue = Number(event.target.value);
                          updateTextElement((element) => ({
                            ...element,
                            fontSize: Number.isFinite(nextValue) ? nextValue : element.fontSize
                          }));
                        }}
                        disabled={disabled}
                      />
                    </label>
                  </>
                ) : selectedImageElement ? (
                  <>
                    <span className="settings-label">Изображение</span>
                    <div className="segment-control">
                      <button
                        type="button"
                        className="segment-item"
                        onClick={() =>
                          onUpdateElement(selectedImageElement.id, (element) =>
                            element.type === "image"
                              ? {
                                  ...element,
                                  fitMode: "contain",
                                  cornerRadius: 22
                                }
                              : element
                          )
                        }
                        disabled={disabled}
                      >
                        Карточка
                      </button>
                      <button
                        type="button"
                        className="segment-item"
                        onClick={() =>
                          onUpdateElement(selectedImageElement.id, (element) =>
                            element.type === "image"
                              ? {
                                  ...applyImageFitMode(element, "cover"),
                                  fitMode: "cover",
                                  cornerRadius: 0
                                }
                              : element
                          )
                        }
                        disabled={disabled}
                      >
                        Обложка
                      </button>
                      <button
                        type="button"
                        className="segment-item"
                        onClick={() =>
                          onUpdateElement(selectedImageElement.id, (element) =>
                            element.type === "image"
                              ? {
                                  ...element,
                                  fitMode: "cover",
                                  cornerRadius: Math.max(
                                    18,
                                    Math.min(element.width, element.height) / 2
                                  )
                                }
                              : element
                          )
                        }
                        disabled={disabled}
                      >
                        Круг
                      </button>
                    </div>

                    <button
                      type="button"
                      className={`ghost-chip ${(selectedImageElement.strokeWidth ?? 0) > 0 ? "" : "ghost-chip-muted"}`}
                      onClick={() =>
                        onUpdateElement(selectedImageElement.id, (element) =>
                          element.type === "image"
                            ? {
                                ...element,
                                strokeWidth: (element.strokeWidth ?? 0) > 0 ? 0 : 8,
                                stroke: element.stroke || "#ffffff"
                              }
                            : element
                        )
                      }
                      disabled={disabled}
                    >
                      {(selectedImageElement.strokeWidth ?? 0) > 0 ? "Убрать рамку" : "Добавить рамку"}
                    </button>

                    <div className="segment-control">
                      {(["cover", "contain", "original"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          className={`segment-item ${
                            (selectedImageElement.fitMode ?? "cover") === mode ? "active" : ""
                          }`}
                          onClick={() =>
                            onUpdateElement(selectedImageElement.id, (element) =>
                              element.type === "image"
                                ? {
                                    ...applyImageFitMode(element, mode),
                                    fitMode: mode
                                  }
                                : element
                            )
                          }
                          disabled={disabled}
                        >
                          {getFitModeLabel(mode)}
                        </button>
                      ))}
                    </div>
                    <div className="field-row">
                      <label className="field-label">
                        Zoom
                        <input
                          className="field"
                          type="number"
                          min={0.4}
                          max={4}
                          step={0.05}
                          value={selectedImageElement.zoom ?? 1}
                          onChange={(event) =>
                            onUpdateElement(selectedImageElement.id, (element) =>
                              element.type === "image"
                                ? {
                                    ...element,
                                    zoom: Number(event.target.value) || 1
                                  }
                                : element
                            )
                          }
                          disabled={disabled}
                        />
                      </label>
                      <label className="field-label">
                        Darken
                        <input
                          className="field"
                          type="number"
                          min={0}
                          max={1}
                          step={0.05}
                          value={selectedImageElement.darken ?? 0}
                          onChange={(event) =>
                            onUpdateElement(selectedImageElement.id, (element) =>
                              element.type === "image"
                                ? {
                                    ...element,
                                    darken: Number(event.target.value) || 0
                                  }
                                : element
                            )
                          }
                          disabled={disabled}
                        />
                      </label>
                    </div>

                    {(selectedImageElement.strokeWidth ?? 0) > 0 ? (
                      <div className="field-row">
                        <label className="field-label">
                          Цвет рамки
                          <input
                            className="field"
                            type="color"
                            value={selectedImageElement.stroke ?? "#ffffff"}
                            onChange={(event) =>
                              onUpdateElement(selectedImageElement.id, (element) =>
                                element.type === "image"
                                  ? {
                                      ...element,
                                      stroke: event.target.value
                                    }
                                  : element
                              )
                            }
                            disabled={disabled}
                          />
                        </label>
                        <label className="field-label">
                          Толщина
                          <input
                            className="field"
                            type="number"
                            min={1}
                            max={28}
                            step={1}
                            value={selectedImageElement.strokeWidth ?? 8}
                            onChange={(event) =>
                              onUpdateElement(selectedImageElement.id, (element) =>
                                element.type === "image"
                                  ? {
                                      ...element,
                                      strokeWidth: Number(event.target.value) || 0
                                    }
                                  : element
                              )
                            }
                            disabled={disabled}
                          />
                        </label>
                      </div>
                    ) : null}
                    <div className="field-row">
                      <label className="field-label">
                        Offset X
                        <input
                          className="field"
                          type="number"
                          min={-640}
                          max={640}
                          step={1}
                          value={selectedImageElement.offsetX ?? 0}
                          onChange={(event) =>
                            onUpdateElement(selectedImageElement.id, (element) =>
                              element.type === "image"
                                ? {
                                    ...element,
                                    offsetX: Number(event.target.value) || 0
                                  }
                                : element
                            )
                          }
                          disabled={disabled}
                        />
                      </label>
                      <label className="field-label">
                        Offset Y
                        <input
                          className="field"
                          type="number"
                          min={-640}
                          max={640}
                          step={1}
                          value={selectedImageElement.offsetY ?? 0}
                          onChange={(event) =>
                            onUpdateElement(selectedImageElement.id, (element) =>
                              element.type === "image"
                                ? {
                                    ...element,
                                    offsetY: Number(event.target.value) || 0
                                  }
                                : element
                            )
                          }
                          disabled={disabled}
                        />
                      </label>
                    </div>
                  </>
                ) : (
                  <div className="settings-empty">
                    Выберите текст или изображение, чтобы изменить размер и параметры.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}

function applyImageFitMode(
  element: Extract<CanvasElement, { type: "image" }>,
  mode: "cover" | "contain" | "original"
) {
  const sourceWidth = element.naturalWidth ?? element.width;
  const sourceHeight = element.naturalHeight ?? element.height;
  if (!sourceWidth || !sourceHeight) {
    return element;
  }

  const sourceRatio = sourceWidth / sourceHeight;
  const frameRatio = element.width / Math.max(1, element.height);
  let width = element.width;
  let height = element.height;

  if (mode === "contain") {
    if (sourceRatio > frameRatio) {
      height = Math.max(24, Math.round(element.width / sourceRatio));
    } else {
      width = Math.max(24, Math.round(element.height * sourceRatio));
    }
  } else if (mode === "original") {
    const capRatio = Math.min(1.2, 1280 / Math.max(sourceWidth, sourceHeight));
    width = Math.max(24, Math.round(sourceWidth * capRatio));
    height = Math.max(24, Math.round(sourceHeight * capRatio));
  } else if (sourceRatio > frameRatio) {
    width = Math.max(24, Math.round(element.height * sourceRatio));
  } else {
    height = Math.max(24, Math.round(element.width / sourceRatio));
  }

  return {
    ...element,
    width,
    height
  };
}

function getFitModeLabel(mode: "cover" | "contain" | "original") {
  if (mode === "cover") {
    return "Заполнить";
  }

  if (mode === "contain") {
    return "Вписать";
  }

  return "Оригинал";
}

function getTabTitle(tab: MobileToolTab) {
  if (tab === "templates") {
    return "Шаблоны";
  }
  if (tab === "background") {
    return "Фон";
  }
  if (tab === "style") {
    return "Стиль";
  }
  if (tab === "text") {
    return "Редактирование текста";
  }
  if (tab === "font") {
    return "Шрифты";
  }
  return "Размер текста";
}

function getTemplatePreviewHeadline(template: { name: string; preview?: string }) {
  const source = template.preview?.trim() || template.name;
  return source.length > 28 ? `${source.slice(0, 28)}…` : source;
}

function getTemplatePreviewCaption(template: { description: string; preview?: string }) {
  const source = template.preview?.trim() || template.description;
  return source.length > 52 ? `${source.slice(0, 52)}…` : source;
}

function toggleFontStyleToken(value: string | undefined, token: "bold" | "italic") {
  const current = new Set((value || "normal").split(" ").filter(Boolean));
  if (current.has("normal")) {
    current.delete("normal");
  }

  if (current.has(token)) {
    current.delete(token);
  } else {
    current.add(token);
  }

  if (!current.size) {
    return "normal";
  }

  return Array.from(current).join(" ");
}

function toggleTextDecorationToken(value: string | undefined, token: "underline" | "line-through") {
  const current = new Set((value || "").split(" ").filter(Boolean));
  if (current.has(token)) {
    current.delete(token);
  } else {
    current.add(token);
  }
  return Array.from(current).join(" ");
}
