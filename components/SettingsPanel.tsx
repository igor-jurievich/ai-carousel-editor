"use client";

import { useState } from "react";
import {
  FOOTER_VARIANTS,
  FONT_OPTIONS,
  getTemplatesByCategory,
  TEMPLATE_CATEGORY_LABELS
} from "@/lib/carousel";
import type {
  CanvasElement,
  CarouselTemplateId,
  FooterVariantId,
  Slide,
  SlideFormat,
  TemplateCategoryId
} from "@/types/editor";

type ExportMode = "zip" | "png" | "pdf";

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
  onUpdateElement
}: SettingsPanelProps) {
  const visibleTemplates = getTemplatesByCategory(activeTemplateCategory);
  const [templatesOpen, setTemplatesOpen] = useState(false);
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
            >
              + Добавить
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
                  >
                    <span className="slides-list-index">{index + 1}</span>
                    <span className="slides-list-copy">
                      <strong>{item.name}</strong>
                      <span>{item.templateId ?? "custom"}</span>
                    </span>
                    <span className="slides-list-arrow">›</span>
                  </button>

                  <button
                    type="button"
                    className="slides-list-delete"
                    onClick={() => onDeleteSlide(item.id)}
                    title="Удалить слайд"
                    aria-label={`Удалить слайд ${index + 1}`}
                    disabled={slides.length <= 1}
                  >
                    ⌫
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="settings-block">
          <span className="settings-label">Категория шаблонов</span>
          <div className="segment-control">
            {(Object.keys(TEMPLATE_CATEGORY_LABELS) as TemplateCategoryId[]).map((category) => (
              <button
                key={category}
                type="button"
                className={`segment-item ${activeTemplateCategory === category ? "active" : ""}`}
                onClick={() => onTemplateCategoryChange(category)}
              >
                {TEMPLATE_CATEGORY_LABELS[category]}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-block">
          <span className="settings-label">Шаблоны внутри категории</span>
          <div className="segment-control">
            <button
              type="button"
              className={`segment-item ${templateScope === "slide" ? "active" : ""}`}
              onClick={() => onTemplateScopeChange("slide")}
            >
              Этот слайд
            </button>
            <button
              type="button"
              className={`segment-item ${templateScope === "all" ? "active" : ""}`}
              onClick={() => onTemplateScopeChange("all")}
            >
              Вся карусель
            </button>
          </div>

          <button
            type="button"
            className="template-disclosure"
            onClick={() => setTemplatesOpen((value) => !value)}
          >
            <span>
              <strong>{currentTemplate?.name ?? "Выберите шаблон"}</strong>
              <span>{currentTemplate?.description ?? "Открыть список шаблонов"}</span>
            </span>
            <span>{templatesOpen ? "˄" : "˅"}</span>
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
                    <span
                      className="template-preview-chip"
                      style={{ backgroundColor: template.accent }}
                    />
                    <span className="template-preview-title" style={{ color: template.titleColor }}>
                      {template.name}
                    </span>
                  </span>
                  <span className="template-card-meta">
                    <strong>{template.name}</strong>
                    <span>{template.description}</span>
                  </span>
                </button>
              ))}
            </div>
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
                disabled={isGenerating || isExporting}
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
            />
            <span>{slide.background}</span>
          </label>
          <div className="field-row">
            <button type="button" className="ghost-chip" onClick={onUploadBackgroundImage}>
              Загрузить фон
            </button>
            <button
              type="button"
              className="ghost-chip ghost-chip-muted"
              onClick={onRemoveBackgroundImage}
              disabled={!hasBackgroundImage}
            >
              Удалить фон
            </button>
          </div>
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
            />
          </label>

          <label className="field-label">
            Подпись
            <input
              className="field"
              value={profileSubtitle}
              onChange={(event) => onProfileSubtitleChange(event.target.value)}
              placeholder="Подпись"
            />
          </label>
        </div>
      </section>

      <section className="settings-card">
        <h3>Настройки элемента</h3>
        {selectedElementLabel ? <div className="settings-selected-pill">{selectedElementLabel}</div> : null}

        {selectedElement ? (
          <div className="field-grid">
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
                  />
                </label>

                {selectedElement.metaKey === "managed-body" && selectedElement.wasAutoTruncated ? (
                  <div className="settings-warning">
                    Текст автоматически сокращён, чтобы не выйти за границы макета. Сократите формулировку,
                    если нужна полная версия.
                  </div>
                ) : null}

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
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
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
                    />
                  </label>
                </div>
              </>
            ) : null}

            {selectedElement.type === "image" ? (
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
                />
              </label>
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
          ZIP и PNG все выгружаются архивом, PDF собирается в один многостраничный файл.
          {isGenerating ? " Экспорт станет доступен после завершения генерации." : ""}
        </div>
        <div className="segment-control">
          <button
            type="button"
            className={`segment-item ${exportMode === "zip" ? "active" : ""}`}
            onClick={() => onExportModeChange("zip")}
            disabled={isExporting || isGenerating}
          >
            ZIP
          </button>
          <button
            type="button"
            className={`segment-item ${exportMode === "png" ? "active" : ""}`}
            onClick={() => onExportModeChange("png")}
            disabled={isExporting || isGenerating}
          >
            PNG все
          </button>
          <button
            type="button"
            className={`segment-item ${exportMode === "pdf" ? "active" : ""}`}
            onClick={() => onExportModeChange("pdf")}
            disabled={isExporting || isGenerating}
          >
            PDF
          </button>
        </div>

        <button
          className="export-button"
          type="button"
          onClick={onExport}
          disabled={isExporting || isGenerating}
        >
          {isExporting ? `Экспортирую ${exportLabel}...` : `Скачать ${exportLabel}`}
        </button>
      </section>
    </>
  );
}

function getExportLabel(mode: ExportMode) {
  if (mode === "png") {
    return "PNG (архив)";
  }
  if (mode === "pdf") {
    return "PDF";
  }
  return "ZIP";
}
