"use client";

import { AppIcon } from "@/components/icons";
import type { CarouselPostCaption, Slide, SlideFormat, TextElement } from "@/types/editor";

type ExportMode = "zip" | "png" | "jpg" | "pdf";

type SettingsPanelProps = {
  slides: Slide[];
  activeSlideId: string | null;
  slide: Slide;
  slideIndex: number;
  totalSlides: number;
  activeTemplateName: string;
  activeFormat: SlideFormat;
  profileHandle: string;
  profileSubtitle: string;
  photoSlotEnabled: boolean;
  canUsePhotoSlot: boolean;
  hasBackgroundImage: boolean;
  captionResult: CarouselPostCaption | null;
  exportMode: ExportMode;
  isGenerating?: boolean;
  isGeneratingCaption?: boolean;
  isExporting?: boolean;
  onExportModeChange: (mode: ExportMode) => void;
  onOpenExportModal: () => void;
  onGenerateCaption: () => void;
  onCopyCaption: () => void;
  onPhotoSlotEnabledChange: (value: boolean) => void;
  onUploadBackgroundImage: () => void;
  onRemoveBackgroundImage: () => void;
  onFormatChange: (format: SlideFormat) => void;
  onOpenTemplateModal: () => void;
  onSelectSlide: (slideId: string) => void;
  onInsertSlideAt: (index: number, slideType?: "text" | "image_text" | "big_text") => void;
  onDeleteSlide: (slideId: string) => void;
  onProfileHandleChange: (value: string) => void;
  onProfileSubtitleChange: (value: string) => void;
  selectedTextElement: TextElement | null;
  onSelectedTextChange: (value: string) => void;
  onSelectedTextColorChange: (value: string) => void;
  onSelectedTextHighlightColorChange: (value: string) => void;
  onSelectedTextSelectionChange: (start: number, end: number) => void;
  onSelectedTextFontChange: (value: string) => void;
  onSelectedTextSizeChange: (value: number) => void;
  onSelectedTextCaseChange: (mode: "normal" | "uppercase" | "lowercase" | "capitalize") => void;
  onApplyHighlightToSelection: () => void;
  onClearHighlightFromSelection: () => void;
  onClearAllHighlights: () => void;
  selectedTextHighlightColor: string;
  disabled?: boolean;
  previewMode?: boolean;
};

const FONT_OPTIONS = ["Inter", "Manrope", "Advent Pro", "Fira Code", "Russo One", "Oswald"];

export function SettingsPanel({
  slides,
  activeSlideId,
  slide,
  slideIndex,
  totalSlides,
  activeTemplateName,
  activeFormat,
  profileHandle,
  profileSubtitle,
  photoSlotEnabled,
  canUsePhotoSlot,
  hasBackgroundImage,
  captionResult,
  exportMode,
  isGenerating = false,
  isGeneratingCaption = false,
  isExporting = false,
  onExportModeChange,
  onOpenExportModal,
  onGenerateCaption,
  onCopyCaption,
  onPhotoSlotEnabledChange,
  onUploadBackgroundImage,
  onRemoveBackgroundImage,
  onFormatChange,
  onOpenTemplateModal,
  onSelectSlide,
  onInsertSlideAt,
  onDeleteSlide,
  onProfileHandleChange,
  onProfileSubtitleChange,
  selectedTextElement,
  onSelectedTextChange,
  onSelectedTextColorChange,
  onSelectedTextHighlightColorChange,
  onSelectedTextSelectionChange,
  onSelectedTextFontChange,
  onSelectedTextSizeChange,
  onSelectedTextCaseChange,
  onApplyHighlightToSelection,
  onClearHighlightFromSelection,
  onClearAllHighlights,
  selectedTextHighlightColor,
  disabled = false,
  previewMode = false
}: SettingsPanelProps) {
  const activeIndex = Math.max(
    0,
    slides.findIndex((item) => item.id === (activeSlideId ?? slide.id))
  );

  if (previewMode) {
    return (
      <section className="settings-card settings-card-slides">
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

        <div className="field-row field-row-add">
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

      <section className="settings-card settings-card-template">
        <div className="settings-inline-head">
          <h3>Шаблон</h3>
          <span className="status-pill">{activeTemplateName}</span>
        </div>
        <button
          type="button"
          className="template-library-trigger"
          onClick={onOpenTemplateModal}
          disabled={disabled}
        >
          <span className="template-library-trigger-icon">
            <AppIcon name="templates" size={16} />
          </span>
          <span className="template-library-trigger-copy">
            <strong>Открыть библиотеку шаблонов</strong>
            <small>Применяется ко всей карусели</small>
          </span>
          <AppIcon name="chevron-right" size={14} />
        </button>
      </section>

      <section className="settings-card settings-card-format">
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

      <section className="settings-card settings-card-photo">
        <h3>Фото</h3>
        <label className="mobile-switch-row">
          <span>Фото-блок</span>
          <input
            type="checkbox"
            checked={photoSlotEnabled}
            onChange={(event) => onPhotoSlotEnabledChange(event.target.checked)}
            disabled={disabled || !canUsePhotoSlot}
          />
        </label>
        <div className="field-row field-row-actions">
          <button
            type="button"
            className="ghost-chip"
            onClick={onUploadBackgroundImage}
            disabled={disabled || !photoSlotEnabled}
          >
            Загрузить
          </button>
          <button
            type="button"
            className="ghost-chip ghost-chip-muted"
            onClick={onRemoveBackgroundImage}
            disabled={!hasBackgroundImage || disabled || !photoSlotEnabled}
          >
            Удалить
          </button>
        </div>
        <div className="settings-hint">
          Если фото-блок выключен, контентный блок автоматически расширится.
        </div>
      </section>

      <section className="settings-card settings-card-signature">
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
            placeholder="Подпись (необязательно)"
            disabled={disabled}
          />
        </label>
      </section>

      <section className="settings-card settings-card-text-controls">
        <div className="settings-inline-head">
          <h3>Текст и шрифт</h3>
          <span className="status-pill">
            {selectedTextElement ? "Элемент выбран" : "Элемент не выбран"}
          </span>
        </div>

        {selectedTextElement ? (
          <>
            <label className="field-label">
              Текст элемента
              <textarea
                className="field"
                value={selectedTextElement.text}
                rows={4}
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
                disabled={disabled}
              />
            </label>

            <div className="field-row field-row-inline">
              <label className="field-label" style={{ width: 136 }}>
                Цвет выделения
                <input
                  className="field"
                  type="color"
                  value={selectedTextHighlightColor}
                  onChange={(event) => onSelectedTextHighlightColorChange(event.target.value)}
                  disabled={disabled}
                />
              </label>
              <div className="field-row field-row-actions" style={{ flex: 1 }}>
                <button
                  type="button"
                  className="ghost-chip"
                  onClick={onApplyHighlightToSelection}
                  disabled={disabled}
                >
                  Выделить
                </button>
                <button
                  type="button"
                  className="ghost-chip ghost-chip-muted"
                  onClick={onClearHighlightFromSelection}
                  disabled={disabled}
                >
                  Снять
                </button>
                <button
                  type="button"
                  className="ghost-chip ghost-chip-muted"
                  onClick={onClearAllHighlights}
                  disabled={disabled}
                >
                  Очистить все
                </button>
              </div>
            </div>

            <div className="field-row field-row-inline">
              <label className="field-label" style={{ flex: 1 }}>
                Шрифт
                <select
                  className="select"
                  value={selectedTextElement.fontFamily}
                  onChange={(event) => onSelectedTextFontChange(event.target.value)}
                  disabled={disabled}
                >
                  {FONT_OPTIONS.map((fontName) => (
                    <option key={fontName} value={fontName}>
                      {fontName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-label" style={{ width: 120 }}>
                Размер
                <input
                  className="field"
                  type="number"
                  min={14}
                  max={96}
                  value={Math.round(selectedTextElement.fontSize)}
                  onChange={(event) => onSelectedTextSizeChange(Number(event.target.value))}
                  disabled={disabled}
                />
              </label>
            </div>

            <div className="field-row field-row-actions">
              <button
                type="button"
                className="ghost-chip"
                onClick={() => onSelectedTextCaseChange("normal")}
                disabled={disabled}
              >
                Норм
              </button>
              <button
                type="button"
                className="ghost-chip"
                onClick={() => onSelectedTextCaseChange("uppercase")}
                disabled={disabled}
              >
                ВЕРХНИЙ
              </button>
              <button
                type="button"
                className="ghost-chip"
                onClick={() => onSelectedTextCaseChange("lowercase")}
                disabled={disabled}
              >
                нижний
              </button>
              <button
                type="button"
                className="ghost-chip"
                onClick={() => onSelectedTextCaseChange("capitalize")}
                disabled={disabled}
              >
                Каждое Слово
              </button>
            </div>

            <label className="field-label">
              Цвет текста
              <input
                className="field"
                type="color"
                value={selectedTextElement.fill}
                onChange={(event) => onSelectedTextColorChange(event.target.value)}
                disabled={disabled}
              />
            </label>
          </>
        ) : (
          <div className="settings-hint">
            Выберите заголовок или описание на слайде, чтобы изменить текст, шрифт, размер и цвет.
          </div>
        )}
      </section>

      <section className="settings-card settings-card-export">
        <h3>Экспорт</h3>
        <div className="field-row field-row-export">
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
            onClick={onOpenExportModal}
            disabled={disabled || isExporting || isGenerating}
          >
            {isExporting ? "Экспорт..." : "Выбрать слайды"}
          </button>
        </div>
      </section>

      <section className="settings-card settings-card-caption">
        <h3>Подпись к посту</h3>
        <div className="field-row field-row-actions">
          <button
            type="button"
            className="ghost-chip"
            onClick={onGenerateCaption}
            disabled={disabled || isGenerating || isGeneratingCaption}
          >
            {isGeneratingCaption ? "Генерирую..." : "Сгенерировать подпись"}
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
          <>
            <label className="field-label">
              Текст
              <textarea className="field" readOnly value={captionResult.text} rows={6} />
            </label>
            <label className="field-label">
              CTA
              <textarea className="field" readOnly value={captionResult.cta} rows={2} />
            </label>
            {captionResult.ctaSoft ? (
              <label className="field-label">
                CTA Soft
                <textarea className="field" readOnly value={captionResult.ctaSoft} rows={2} />
              </label>
            ) : null}
            {captionResult.ctaAggressive ? (
              <label className="field-label">
                CTA Aggressive
                <textarea className="field" readOnly value={captionResult.ctaAggressive} rows={2} />
              </label>
            ) : null}
            <label className="field-label">
              Хэштеги
              <textarea className="field" readOnly value={captionResult.hashtags.join(" ")} rows={2} />
            </label>
          </>
        ) : (
          <div className="settings-hint">
            Сначала соберите карусель, затем нажмите «Сгенерировать подпись».
          </div>
        )}
      </section>
    </>
  );
}
