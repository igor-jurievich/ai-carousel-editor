"use client";

import { useMemo, useState } from "react";
import {
  BACKGROUND_STYLE_PRESETS,
  FOOTER_VARIANTS,
  FONT_OPTIONS,
  getPrimaryTemplates,
  getTemplatesByCategory,
  TEMPLATE_CATEGORY_LABELS
} from "@/lib/carousel";
import { AppIcon } from "@/components/icons";
import type {
  CanvasElement,
  CarouselTemplateId,
  FooterVariantId,
  Slide,
  SlideFormat,
  TemplateCategoryId
} from "@/types/editor";

type ExportMode = "zip" | "png" | "jpg" | "pdf";
type ExportPresetId = "instagram" | "instagram-stories" | "tiktok";

type SettingsPanelProps = {
  slides: Slide[];
  activeSlideId: string | null;
  slide: Slide;
  slideIndex: number;
  totalSlides: number;
  selectedElement: CanvasElement | null;
  activeTemplateId: CarouselTemplateId;
  activeTemplateCategory: TemplateCategoryId;
  templateScope: "slide" | "all";
  activeFormat: SlideFormat;
  footerVariant: FooterVariantId;
  profileHandle: string;
  profileSubtitle: string;
  hasBackgroundImage: boolean;
  exportMode: ExportMode;
  isGenerating?: boolean;
  isExporting?: boolean;
  onExportModeChange: (mode: ExportMode) => void;
  onExport: () => void;
  onBackgroundChange: (color: string) => void;
  onUploadBackgroundImage: () => void;
  onRemoveBackgroundImage: () => void;
  onFormatChange: (format: SlideFormat) => void;
  onTemplateCategoryChange: (category: TemplateCategoryId) => void;
  onTemplateScopeChange: (scope: "slide" | "all") => void;
  onApplyTemplate: (templateId: CarouselTemplateId) => void;
  onSelectSlide: (slideId: string) => void;
  onInsertSlideAt: (index: number) => void;
  onDeleteSlide: (slideId: string) => void;
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
  disabled?: boolean;
  previewMode?: boolean;
};

export function SettingsPanel({
  slides,
  activeSlideId,
  slide,
  slideIndex,
  totalSlides,
  selectedElement,
  activeTemplateId,
  activeTemplateCategory,
  templateScope,
  activeFormat,
  footerVariant,
  profileHandle,
  profileSubtitle,
  hasBackgroundImage,
  exportMode,
  isGenerating = false,
  isExporting = false,
  onExportModeChange,
  onExport,
  onBackgroundChange,
  onUploadBackgroundImage,
  onRemoveBackgroundImage,
  onFormatChange,
  onTemplateCategoryChange,
  onTemplateScopeChange,
  onApplyTemplate,
  onSelectSlide,
  onInsertSlideAt,
  onDeleteSlide,
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
  disabled = false,
  previewMode = false
}: SettingsPanelProps) {
  const [showExtendedTemplates, setShowExtendedTemplates] = useState(false);
  const visibleTemplates = getTemplatesByCategory(activeTemplateCategory);
  const primaryTemplates = getPrimaryTemplates();
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [globalTitleFont, setGlobalTitleFont] = useState("");
  const [globalBodyFont, setGlobalBodyFont] = useState("");
  const currentTemplate = visibleTemplates.find((template) => template.id === activeTemplateId);
  const activeIndex = Math.max(
    0,
    slides.findIndex((item) => item.id === (activeSlideId ?? slide.id))
  );

  const updateTextElement = (
    updater: (
      element: Extract<CanvasElement, { type: "text" }>
    ) => Extract<CanvasElement, { type: "text" }>
  ) => {
    if (!selectedElement || selectedElement.type !== "text") {
      return;
    }

    onUpdateElement(selectedElement.id, (element) =>
      element.type === "text" ? updater(element) : element
    );
  };

  const updateImageElement = (
    updater: (
      element: Extract<CanvasElement, { type: "image" }>
    ) => Extract<CanvasElement, { type: "image" }>
  ) => {
    if (!selectedElement || selectedElement.type !== "image") {
      return;
    }

    onUpdateElement(selectedElement.id, (element) =>
      element.type === "image" ? updater(element) : element
    );
  };
  const exportLabel = getExportLabel(exportMode);
  const selectedElementLabel = selectedElement
    ? selectedElement.type === "text"
      ? "Выбран текст"
      : selectedElement.type === "image"
        ? "Выбрано изображение"
        : "Выбрана фигура"
    : null;
  const firstTitleFont = useMemo(
    () =>
      slide.elements.find(
        (element): element is Extract<CanvasElement, { type: "text" }> =>
          element.type === "text" && (element.metaKey === "managed-title" || element.role === "title")
      )?.fontFamily ?? "Manrope",
    [slide.elements]
  );
  const firstBodyFont = useMemo(
    () =>
      slide.elements.find(
        (element): element is Extract<CanvasElement, { type: "text" }> =>
          element.type === "text" && (element.metaKey === "managed-body" || element.role === "body")
      )?.fontFamily ?? "Inter",
    [slide.elements]
  );

  if (previewMode) {
    return (
      <section className="settings-card">
        <h3>Preview mode</h3>
        <div className="settings-hint">
          Режим просмотра скрывает управляющие элементы на canvas. Отключите Preview, чтобы
          вернуться к редактированию.
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="settings-card">
        <div className="settings-card-header">
          <h2 className="settings-title">Общие настройки</h2>
          <span className="status-pill">Слайд {slideIndex + 1} / {totalSlides}</span>
        </div>

        <div className="settings-block">
          <div className="settings-inline-head">
            <span className="settings-label">Слайды</span>
            <button
              type="button"
              className="ghost-chip ghost-chip-small"
              onClick={() => onInsertSlideAt(activeIndex + 1)}
              disabled={disabled}
            >
              <span className="chip-with-icon">
                <AppIcon name="plus" size={14} />
                Добавить
              </span>
            </button>
          </div>

          <div className="slides-list slides-list-compact">
            {slides.map((item, index) => {
              const isActive = item.id === activeSlideId;
              return (
                <div key={item.id} className="slides-list-row">
                  <button
                    type="button"
                    className={`slides-list-item ${isActive ? "active" : ""}`}
                    onClick={() => onSelectSlide(item.id)}
                    disabled={disabled}
                  >
                    <span className="slides-list-index">{index + 1}</span>
                    <span className="slides-list-copy">
                      <strong>{item.name}</strong>
                      <span>{item.templateId ?? "custom"}</span>
                    </span>
                    <span className="slides-list-arrow">
                      <AppIcon name="chevron-right" size={14} />
                    </span>
                  </button>

                  <button
                    type="button"
                    className="slides-list-delete"
                    onClick={() => onDeleteSlide(item.id)}
                    title="Удалить слайд"
                    aria-label={`Удалить слайд ${index + 1}`}
                    disabled={slides.length <= 1 || disabled}
                  >
                    <AppIcon name="trash" size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="settings-block">
          <span className="settings-label">Быстрый старт: 3 базовых шаблона</span>
          <div className="template-grid template-grid-primary">
            {primaryTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                className={`template-card ${template.id === activeTemplateId ? "active" : ""}`}
                onClick={() => onApplyTemplate(template.id)}
                disabled={disabled}
              >
                <span
                  className="template-preview"
                  style={{
                    background:
                      template.accentAlt
                        ? `linear-gradient(140deg, ${template.background} 0%, ${template.surface} 56%, ${template.accentAlt} 100%)`
                        : template.background
                  }}
                >
                  <span className="template-preview-sheen" />
                  <span
                    className="template-preview-chip"
                    style={{ backgroundColor: template.accent }}
                  />
                  <span
                    className="template-preview-title"
                    style={{ color: template.titleColor }}
                  >
                    {getTemplatePreviewHeadline(template)}
                  </span>
                  <span className="template-preview-lines">
                    <span style={{ backgroundColor: template.bodyColor }} />
                    <span style={{ backgroundColor: template.bodyColor }} />
                    <span style={{ backgroundColor: template.bodyColor }} />
                  </span>
                  <span className="template-preview-footer" style={{ color: template.bodyColor }}>
                    @creator <strong>→</strong>
                  </span>
                </span>
                <span className="template-card-meta">
                  <strong>{template.name}</strong>
                  <span>{getTemplatePreviewCaption(template)}</span>
                </span>
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
              <strong>{showExtendedTemplates ? "Скрыть расширенную библиотеку" : "Расширенная библиотека"}</strong>
              <span>{currentTemplate?.description ?? "Дополнительные шаблоны"}</span>
            </span>
            <span>{showExtendedTemplates ? "Свернуть" : "Открыть"}</span>
          </button>

          {showExtendedTemplates ? (
            <>
              <span className="settings-label">Категория шаблонов</span>
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

              <button
                type="button"
                className="template-disclosure"
                onClick={() => setTemplatesOpen((value) => !value)}
                disabled={disabled}
              >
                <span>
                  <strong>{currentTemplate?.name ?? "Выберите шаблон"}</strong>
                  <span>{currentTemplate?.description ?? "Открыть список шаблонов"}</span>
                </span>
                <span>{templatesOpen ? "Скрыть" : "Показать"}</span>
              </button>

              {templatesOpen ? (
                <div className="template-grid">
                  {visibleTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      className={`template-card ${template.id === activeTemplateId ? "active" : ""}`}
                      onClick={() => {
                        onApplyTemplate(template.id);
                        setTemplatesOpen(false);
                      }}
                      disabled={disabled}
                    >
                      <span
                        className="template-preview"
                        style={{
                          background:
                            template.accentAlt
                              ? `linear-gradient(140deg, ${template.background} 0%, ${template.surface} 56%, ${template.accentAlt} 100%)`
                              : template.background
                        }}
                      >
                        <span className="template-preview-sheen" />
                        <span
                          className="template-preview-chip"
                          style={{ backgroundColor: template.accent }}
                        />
                        <span
                          className="template-preview-title"
                          style={{ color: template.titleColor }}
                        >
                          {getTemplatePreviewHeadline(template)}
                        </span>
                        <span className="template-preview-lines">
                          <span style={{ backgroundColor: template.bodyColor }} />
                          <span style={{ backgroundColor: template.bodyColor }} />
                          <span style={{ backgroundColor: template.bodyColor }} />
                        </span>
                        <span className="template-preview-footer" style={{ color: template.bodyColor }}>
                          @creator <strong>→</strong>
                        </span>
                      </span>
                      <span className="template-card-meta">
                        <strong>{template.name}</strong>
                        <span>{getTemplatePreviewCaption(template)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="settings-block">
          <span className="settings-label">Формат</span>
          <div className="segment-control">
            {(["1:1", "4:5", "9:16"] as SlideFormat[]).map((format) => (
              <button
                key={format}
                type="button"
                className={`segment-item ${activeFormat === format ? "active" : ""}`}
                onClick={() => onFormatChange(format)}
                disabled={isGenerating || isExporting || disabled}
              >
                {format}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-block">
          <span className="settings-label">Фон слайда</span>
          <label className="color-row">
            <input
              className="color-input"
              type="color"
              value={slide.background}
              onChange={(event) => onBackgroundChange(event.target.value)}
              disabled={disabled}
            />
            <span>Background: {slide.background}</span>
          </label>
          <label className="color-row">
            <input
              className="color-input"
              type="color"
              value={frameColor}
              onChange={(event) => onFrameColorChange(event.target.value)}
              disabled={disabled}
            />
            <span>Frame: {frameColor}</span>
          </label>
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
          <div className="field-row">
            <button
              type="button"
              className="ghost-chip"
              onClick={onUploadBackgroundImage}
              disabled={disabled}
            >
              Загрузить фон
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
                    className={`segment-item ${backgroundImageFitMode === mode ? "active" : ""}`}
                    onClick={() => onUpdateBackgroundImageStyle({ fitMode: mode })}
                    disabled={disabled}
                  >
                    {mode}
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
                      ? "Картинка снизу (переместить вверх)"
                      : "Картинка сверху (переместить вниз)"}
                  </button>
                  <label className="field-label">
                    Высота блока изображения
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

        <div className="settings-block">
          <span className="settings-label">Глобальная типографика</span>
          <div className="field-row">
            <label className="field-label">
              Заголовок
              <select
                className="select"
                value={globalTitleFont || firstTitleFont}
                onChange={(event) => setGlobalTitleFont(event.target.value)}
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
                onChange={(event) => setGlobalBodyFont(event.target.value)}
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
        </div>

        <div className="settings-block">
          <span className="settings-label">Блок профиля на слайде</span>
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
        </div>
      </section>

      <section className="settings-card">
        <h3>Настройки элемента</h3>
        {selectedElementLabel ? <div className="settings-selected-pill">{selectedElementLabel}</div> : null}

        {selectedElement ? (
          <div className="field-grid">
            <button
              type="button"
              className="ghost-chip ghost-chip-muted"
              onClick={onResetElementRotation}
              disabled={disabled}
            >
              Reset rotation (0°)
            </button>

            {selectedElement.type === "text" ? (
              <>
                <label className="field-label">
                  Текст
                  <textarea
                    className="textarea"
                    rows={5}
                    value={selectedElement.text}
                    onChange={(event) =>
                      updateTextElement((element) => ({
                        ...element,
                        text: event.target.value
                      }))
                    }
                    disabled={disabled}
                  />
                </label>

                {selectedElement.metaKey === "managed-body" && selectedElement.wasAutoTruncated ? (
                  <div className="settings-warning">
                    Текст автоматически сокращён, чтобы не выйти за границы макета. Сократите формулировку,
                    если нужна полная версия.
                  </div>
                ) : null}

                <div className="field-label">
                  Форматирование
                  <div className="icon-segment">
                    <button
                      type="button"
                      className={`icon-segment-item ${
                        selectedElement.fontStyle?.includes("bold") ? "active" : ""
                      }`}
                      onClick={() =>
                        updateTextElement((element) => ({
                          ...element,
                          fontStyle: toggleFontStyleToken(element.fontStyle, "bold")
                        }))
                      }
                      disabled={disabled}
                    >
                      <AppIcon name="bold" size={14} />
                    </button>
                    <button
                      type="button"
                      className={`icon-segment-item ${
                        selectedElement.fontStyle?.includes("italic") ? "active" : ""
                      }`}
                      onClick={() =>
                        updateTextElement((element) => ({
                          ...element,
                          fontStyle: toggleFontStyleToken(element.fontStyle, "italic")
                        }))
                      }
                      disabled={disabled}
                    >
                      <AppIcon name="italic" size={14} />
                    </button>
                    <button
                      type="button"
                      className={`icon-segment-item ${
                        selectedElement.textDecoration?.includes("underline") ? "active" : ""
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
                    >
                      <AppIcon name="underline" size={14} />
                    </button>
                    <button
                      type="button"
                      className={`icon-segment-item ${
                        selectedElement.textDecoration?.includes("line-through") ? "active" : ""
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
                    >
                      <AppIcon name="strike" size={14} />
                    </button>
                  </div>
                </div>

                <div className="field-row">
                  <label className="field-label">
                    Шрифт
                    <select
                      className="select"
                      value={selectedElement.fontFamily}
                      onChange={(event) =>
                        updateTextElement((element) => ({
                          ...element,
                          fontFamily: event.target.value
                        }))
                      }
                      disabled={disabled}
                    >
                      {FONT_OPTIONS.map((font) => (
                        <option key={font} value={font}>
                          {font}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field-label">
                    Выравнивание
                    <select
                      className="select"
                      value={selectedElement.align}
                      onChange={(event) =>
                        updateTextElement((element) => ({
                          ...element,
                          align: event.target.value as "left" | "center" | "right"
                        }))
                      }
                      disabled={disabled}
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </label>
                </div>

                <div className="field-row">
                  <label className="field-label">
                    Межстрочный
                    <input
                      className="field"
                      type="number"
                      min={0.8}
                      max={2}
                      step={0.02}
                      value={selectedElement.lineHeight ?? 1.1}
                      onChange={(event) =>
                        updateTextElement((element) => ({
                          ...element,
                          lineHeight: Number(event.target.value) || element.lineHeight
                        }))
                      }
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
                      value={selectedElement.letterSpacing ?? 0}
                      onChange={(event) =>
                        updateTextElement((element) => ({
                          ...element,
                          letterSpacing: Number(event.target.value) || 0
                        }))
                      }
                      disabled={disabled}
                    />
                  </label>
                </div>

                <div className="field-row">
                  <label className="field-label">
                    Размер
                    <input
                      className="field"
                      type="number"
                      min={12}
                      max={220}
                      value={selectedElement.fontSize}
                      onChange={(event) =>
                        updateTextElement((element) => ({
                          ...element,
                          fontSize: Number(event.target.value) || element.fontSize
                        }))
                      }
                      disabled={disabled}
                    />
                  </label>

                  <label className="field-label">
                    Цвет
                    <input
                      className="field"
                      type="color"
                      value={selectedElement.fill}
                      onChange={(event) =>
                        updateTextElement((element) => ({
                          ...element,
                          fill: event.target.value
                        }))
                      }
                      disabled={disabled}
                    />
                  </label>
                </div>
              </>
            ) : null}

            {selectedElement.type === "image" ? (
              <>
                <label className="field-label">
                  Ссылка на изображение
                  <textarea
                    className="textarea"
                    rows={4}
                    value={selectedElement.src}
                    onChange={(event) =>
                      updateImageElement((element) => ({
                        ...element,
                        src: event.target.value
                      }))
                    }
                    disabled={disabled}
                  />
                </label>

                <div className="field-label">
                  Режим
                  <div className="segment-control">
                    {(["cover", "contain", "original"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`segment-item ${
                          (selectedElement.fitMode ?? "cover") === mode ? "active" : ""
                        }`}
                        onClick={() =>
                          updateImageElement((element) => ({
                            ...applyImageFitMode(element, mode),
                            fitMode: mode
                          }))
                        }
                        disabled={disabled}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
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
                      value={selectedElement.zoom ?? 1}
                      onChange={(event) =>
                        updateImageElement((element) => ({
                          ...element,
                          zoom: Number(event.target.value) || 1
                        }))
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
                      value={selectedElement.darken ?? 0}
                      onChange={(event) =>
                        updateImageElement((element) => ({
                          ...element,
                          darken: Number(event.target.value) || 0
                        }))
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
                      value={selectedElement.offsetX ?? 0}
                      onChange={(event) =>
                        updateImageElement((element) => ({
                          ...element,
                          offsetX: Number(event.target.value) || 0
                        }))
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
                      value={selectedElement.offsetY ?? 0}
                      onChange={(event) =>
                        updateImageElement((element) => ({
                          ...element,
                          offsetY: Number(event.target.value) || 0
                        }))
                      }
                      disabled={disabled}
                    />
                  </label>
                </div>
              </>
            ) : null}
          </div>
        ) : (
          <div className="settings-empty">
            Выберите элемент на слайде. Двойной клик по тексту включает редактирование прямо на макете.
          </div>
        )}
      </section>

      <section className="settings-card">
        <h3>Экспорт</h3>
        <div className="settings-hint">
          ZIP, PNG и JPG выгружаются архивом, PDF собирается в один многостраничный файл.
          {isGenerating ? " Экспорт станет доступен после завершения генерации." : ""}
        </div>

        <div className="settings-block">
          <span className="settings-label">Пресеты</span>
          <div className="segment-control">
            {EXPORT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="segment-item"
                onClick={() => onFormatChange(preset.format)}
                disabled={isExporting || isGenerating || disabled}
                title={preset.hint}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="segment-control">
          <button
            type="button"
            className={`segment-item ${exportMode === "zip" ? "active" : ""}`}
            onClick={() => onExportModeChange("zip")}
            disabled={isExporting || isGenerating || disabled}
          >
            ZIP
          </button>
          <button
            type="button"
            className={`segment-item ${exportMode === "png" ? "active" : ""}`}
            onClick={() => onExportModeChange("png")}
            disabled={isExporting || isGenerating || disabled}
          >
            PNG
          </button>
          <button
            type="button"
            className={`segment-item ${exportMode === "jpg" ? "active" : ""}`}
            onClick={() => onExportModeChange("jpg")}
            disabled={isExporting || isGenerating || disabled}
          >
            JPG
          </button>
          <button
            type="button"
            className={`segment-item ${exportMode === "pdf" ? "active" : ""}`}
            onClick={() => onExportModeChange("pdf")}
            disabled={isExporting || isGenerating || disabled}
          >
            PDF
          </button>
        </div>

        <button
          className="export-button"
          type="button"
          onClick={onExport}
          disabled={isExporting || isGenerating || disabled}
        >
          {isExporting ? `Экспортирую ${exportLabel}...` : `Скачать ${exportLabel}`}
        </button>
      </section>
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

function getExportLabel(mode: ExportMode) {
  if (mode === "png") {
    return "PNG (архив)";
  }
  if (mode === "jpg") {
    return "JPG (архив)";
  }
  if (mode === "pdf") {
    return "PDF";
  }
  return "ZIP";
}

const EXPORT_PRESETS: Array<{
  id: ExportPresetId;
  label: string;
  hint: string;
  format: SlideFormat;
}> = [
  {
    id: "instagram",
    label: "Instagram",
    hint: "Квадратный пост 1:1",
    format: "1:1"
  },
  {
    id: "instagram-stories",
    label: "Stories",
    hint: "Вертикальные сторис 9:16",
    format: "9:16"
  },
  {
    id: "tiktok",
    label: "TikTok",
    hint: "Вертикальный формат 9:16",
    format: "9:16"
  }
];

function getTemplatePreviewHeadline(template: { name: string; preview?: string }) {
  const source = template.preview?.trim() || template.name;
  return source.length > 32 ? `${source.slice(0, 32)}…` : source;
}

function getTemplatePreviewCaption(template: { description: string; preview?: string }) {
  const source = template.preview?.trim() || template.description;
  return source.length > 70 ? `${source.slice(0, 70)}…` : source;
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
