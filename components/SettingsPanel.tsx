"use client";

import { getPrimaryTemplates } from "@/lib/carousel";
import { AppIcon } from "@/components/icons";
import type {
  CarouselTemplateId,
  Slide,
  SlideFormat
} from "@/types/editor";

type ExportMode = "zip" | "png" | "jpg" | "pdf";

type SettingsPanelProps = {
  slides: Slide[];
  activeSlideId: string | null;
  slide: Slide;
  slideIndex: number;
  totalSlides: number;
  activeTemplateId: CarouselTemplateId;
  activeFormat: SlideFormat;
  profileHandle: string;
  profileSubtitle: string;
  hasBackgroundImage: boolean;
  exportMode: ExportMode;
  isGenerating?: boolean;
  isExporting?: boolean;
  onExportModeChange: (mode: ExportMode) => void;
  onExport: () => void;
  onUploadBackgroundImage: () => void;
  onRemoveBackgroundImage: () => void;
  onFormatChange: (format: SlideFormat) => void;
  onApplyTemplate: (templateId: CarouselTemplateId) => void;
  onSelectSlide: (slideId: string) => void;
  onInsertSlideAt: (index: number, slideType?: "text" | "image_text" | "big_text") => void;
  onDeleteSlide: (slideId: string) => void;
  onProfileHandleChange: (value: string) => void;
  onProfileSubtitleChange: (value: string) => void;
  disabled?: boolean;
  previewMode?: boolean;
};

export function SettingsPanel({
  slides,
  activeSlideId,
  slide,
  slideIndex,
  totalSlides,
  activeTemplateId,
  activeFormat,
  profileHandle,
  profileSubtitle,
  hasBackgroundImage,
  exportMode,
  isGenerating = false,
  isExporting = false,
  onExportModeChange,
  onExport,
  onUploadBackgroundImage,
  onRemoveBackgroundImage,
  onFormatChange,
  onApplyTemplate,
  onSelectSlide,
  onInsertSlideAt,
  onDeleteSlide,
  onProfileHandleChange,
  onProfileSubtitleChange,
  disabled = false,
  previewMode = false
}: SettingsPanelProps) {
  const templates = getPrimaryTemplates();
  const activeIndex = Math.max(
    0,
    slides.findIndex((item) => item.id === (activeSlideId ?? slide.id))
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
          <h2 className="settings-title">Слайды</h2>
          <span className="status-pill">
            Слайд {slideIndex + 1} / {totalSlides}
          </span>
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
                    <span>{item.slideType ?? "text"}</span>
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

        <div className="field-row" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="ghost-chip"
            onClick={() => onInsertSlideAt(activeIndex + 1, "text")}
            disabled={disabled}
          >
            + Текст
          </button>
          <button
            type="button"
            className="ghost-chip"
            onClick={() => onInsertSlideAt(activeIndex + 1, "image_text")}
            disabled={disabled}
          >
            + Фото + текст
          </button>
          <button
            type="button"
            className="ghost-chip"
            onClick={() => onInsertSlideAt(activeIndex + 1, "big_text")}
            disabled={disabled}
          >
            + Большой текст
          </button>
        </div>
      </section>

      <section className="settings-card">
        <h3>Тема Карусели</h3>
        <div className="mobile-style-grid">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              className={`mobile-style-chip ${activeTemplateId === template.id ? "active" : ""}`}
              onClick={() => onApplyTemplate(template.id)}
              disabled={disabled}
            >
              {template.name}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-card">
        <h3>Формат</h3>
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
      </section>

      <section className="settings-card">
        <h3>Фото</h3>
        <div className="field-row">
          <button
            type="button"
            className="ghost-chip"
            onClick={onUploadBackgroundImage}
            disabled={disabled}
          >
            Загрузить
          </button>
          <button
            type="button"
            className="ghost-chip ghost-chip-muted"
            onClick={onRemoveBackgroundImage}
            disabled={!hasBackgroundImage || disabled}
          >
            Удалить
          </button>
        </div>
        <div className="settings-hint">
          Только ручная загрузка изображений. Автопоиск и AI-картинки отключены.
        </div>
      </section>

      <section className="settings-card">
        <h3>Подпись</h3>
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
            placeholder="Надпись"
            disabled={disabled}
          />
        </label>
      </section>

      <section className="settings-card">
        <h3>Экспорт</h3>
        <div className="field-row">
          <select
            className="select"
            value={exportMode}
            onChange={(event) => onExportModeChange(event.target.value as ExportMode)}
            disabled={disabled || isExporting}
          >
            <option value="zip">ZIP (PNG)</option>
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
            <option value="pdf">PDF</option>
          </select>
          <button
            type="button"
            className="btn"
            onClick={onExport}
            disabled={disabled || isExporting || isGenerating}
          >
            {isExporting ? "Экспорт..." : "Экспорт"}
          </button>
        </div>
      </section>

    </>
  );
}
