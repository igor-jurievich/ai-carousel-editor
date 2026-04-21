"use client";

import * as Popover from "@radix-ui/react-popover";
import * as Switch from "@radix-ui/react-switch";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ChevronDown,
  ImageIcon,
  Loader2,
  Sparkles,
  Type as TypeIcon
} from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { AppSelect } from "@/components/AppSelect";
import { AppIcon } from "@/components/icons";
import { HexColorField } from "@/components/HexColorField";
import { HexColorPicker } from "react-colorful";
import type {
  CarouselPostCaption,
  Slide,
  SlideFormat,
  SlidePhotoSettings,
  TextElement
} from "@/types/editor";

type ExportMode = "zip" | "png" | "jpg" | "pdf";
type StylePresetId = "mono" | "grid" | "gradient" | "notes" | "dots" | "flash";
type TextCaseMode = "normal" | "uppercase" | "lowercase" | "capitalize";
type BackgroundStylePreset = { id: StylePresetId; label: string; background: string; preview: string };

type SettingsPanelProps = {
  slides: Slide[];
  activeSlideId: string | null;
  slide: Slide;
  slideIndex: number;
  totalSlides: number;
  activeTemplateName: string;
  activeFormat: SlideFormat;
  slideBackground: string;
  gridVisible: boolean;
  profileHandle: string;
  profileSubtitle: string;
  subtitlesVisibleAcrossSlides: boolean;
  photoSlotEnabled: boolean;
  photoSettings: SlidePhotoSettings;
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
  onAddSlidePhoto: () => void;
  onUploadBackgroundImage: () => void;
  onRemoveBackgroundImage: () => void;
  onSlideBackgroundChange: (value: string) => void;
  onSlidePhotoSettingsChange: (updates: Partial<SlidePhotoSettings>) => void;
  onApplyStylePreset: (presetId: StylePresetId, options?: { applyAll?: boolean }) => void;
  onGridVisibilityChange: (visible: boolean) => void;
  onFormatChange: (format: SlideFormat) => void;
  onOpenTemplateModal: () => void;
  onSelectSlide: (slideId: string) => void;
  onInsertSlideAt: (index: number, slideType?: "text" | "image_text" | "big_text") => void;
  onDeleteSlide: (slideId: string) => void;
  onProfileHandleChange: (value: string) => void;
  onProfileSubtitleChange: (value: string) => void;
  onToggleSubtitleAcrossSlides: (visible: boolean) => void;
  selectedTextElement: TextElement | null;
  selectedTextTargetRole: "title" | "body";
  onSelectedTextChange: (value: string) => void;
  onSelectedTextColorChange: (value: string) => void;
  onSelectedTextHighlightColorChange: (value: string) => void;
  onSelectedTextHighlightOpacityChange: (value: number) => void;
  onSelectedTextSelectionChange: (start: number, end: number) => void;
  onSelectedTextFontChange: (value: string) => void;
  onSelectedTextSizeChange: (value: number) => void;
  onSelectedTextCaseChange: (mode: "normal" | "uppercase" | "lowercase" | "capitalize") => void;
  onSelectedTextAlignChange: (align: "left" | "center" | "right") => void;
  onSelectedTextTargetRoleChange: (role: "title" | "body") => void;
  onApplyHighlightToSelection: () => void;
  onClearHighlightFromSelection: () => void;
  onClearAllHighlights: () => void;
  onApplyHighlightColorToAllSlides: () => void;
  selectedTextHighlightColor: string;
  selectedTextHighlightOpacity: number;
  slidesSectionRef?: RefObject<HTMLElement | null>;
  signatureSectionRef?: RefObject<HTMLElement | null>;
  profileHandleInputRef?: RefObject<HTMLInputElement | null>;
  disabled?: boolean;
  previewMode?: boolean;
};

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
  { label: "Чёрный", value: "#111111" },
  { label: "Светло-серый", value: "#f0f0f5" },
  { label: "Тёплый", value: "#f5e6d3" },
  { label: "Холодный", value: "#e0eaf5" },
  { label: "Графит", value: "#2a2a2a" }
];
const NON_CONTENT_TEXT_META_KEYS = new Set([
  "slide-chip-text",
  "managed-title-accent-text",
  "profile-handle",
  "footer-counter",
  "profile-subtitle",
  "footer-arrow",
  "image-placeholder-text"
]);
const HEX_COLOR_INPUT_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalizeColorForInput(value: string | undefined, fallback: string) {
  const normalized = (value ?? "").trim();
  if (HEX_COLOR_INPUT_RE.test(normalized)) {
    return normalized.length === 4
      ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
      : normalized;
  }
  return fallback;
}

function detectTextCaseMode(value: string): TextCaseMode {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "normal";
  }

  const hasLetters = /[A-Za-zА-Яа-яЁё]/.test(normalized);
  if (!hasLetters) {
    return "normal";
  }

  if (normalized === normalized.toUpperCase() && normalized !== normalized.toLowerCase()) {
    return "uppercase";
  }

  if (normalized === normalized.toLowerCase() && normalized !== normalized.toUpperCase()) {
    return "lowercase";
  }

  const titleCased = normalized
    .split(" ")
    .map((word) => {
      if (!word) {
        return word;
      }
      const [first, ...rest] = word;
      return `${first.toLocaleUpperCase("ru-RU")}${rest.join("").toLocaleLowerCase("ru-RU")}`;
    })
    .join(" ");

  if (normalized === titleCased) {
    return "capitalize";
  }

  return "normal";
}

function getSlideTypeLabel(slideType: Slide["slideType"] | undefined) {
  if (slideType === "image_text" || slideType === "list" || slideType === "big_text") {
    return slideType;
  }
  if (slideType === "cta") {
    return "cta";
  }
  return "text";
}

export function SettingsPanel({
  slides,
  activeSlideId,
  slide,
  slideIndex,
  totalSlides,
  activeTemplateName,
  activeFormat,
  slideBackground,
  gridVisible,
  profileHandle,
  profileSubtitle,
  subtitlesVisibleAcrossSlides,
  photoSlotEnabled,
  photoSettings,
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
  onAddSlidePhoto,
  onUploadBackgroundImage,
  onRemoveBackgroundImage,
  onSlideBackgroundChange,
  onSlidePhotoSettingsChange,
  onApplyStylePreset,
  onGridVisibilityChange,
  onFormatChange,
  onOpenTemplateModal,
  onSelectSlide,
  onInsertSlideAt,
  onDeleteSlide,
  onProfileHandleChange,
  onProfileSubtitleChange,
  onToggleSubtitleAcrossSlides,
  selectedTextElement,
  selectedTextTargetRole,
  onSelectedTextChange,
  onSelectedTextColorChange,
  onSelectedTextHighlightColorChange,
  onSelectedTextHighlightOpacityChange,
  onSelectedTextSelectionChange,
  onSelectedTextFontChange,
  onSelectedTextSizeChange,
  onSelectedTextCaseChange,
  onSelectedTextAlignChange,
  onSelectedTextTargetRoleChange,
  onApplyHighlightToSelection,
  onClearHighlightFromSelection,
  onClearAllHighlights,
  onApplyHighlightColorToAllSlides,
  selectedTextHighlightColor,
  selectedTextHighlightOpacity,
  slidesSectionRef,
  signatureSectionRef,
  profileHandleInputRef,
  disabled = false,
  previewMode = false
}: SettingsPanelProps) {
  const stylePresets: BackgroundStylePreset[] = [
    {
      id: "mono",
      label: "Монохром",
      background: "#ffffff",
      preview: "linear-gradient(145deg, #ffffff 0%, #f4f5f7 100%)"
    },
    {
      id: "grid",
      label: "Сетка",
      background: "#f1f3f7",
      preview:
        "repeating-linear-gradient(90deg, rgba(17,24,39,0.12) 0 1px, transparent 1px 12px), repeating-linear-gradient(180deg, rgba(17,24,39,0.12) 0 1px, transparent 1px 12px), #f1f3f7"
    },
    {
      id: "gradient",
      label: "Градиент",
      background: "#e9f3ff",
      preview: "linear-gradient(140deg, #f4e9ff 0%, #e9f3ff 100%)"
    },
    {
      id: "notes",
      label: "Заметки",
      background: "#f6f2ed",
      preview:
        "repeating-linear-gradient(180deg, rgba(86,96,112,0.14) 0 1px, transparent 1px 12px), #f6f2ed"
    },
    {
      id: "dots",
      label: "Точки",
      background: "#ffeb0a",
      preview: "radial-gradient(circle at 25% 25%, rgba(17,24,39,0.16) 0 2px, transparent 3px), #ffeb0a"
    },
    {
      id: "flash",
      label: "Молнии",
      background: "#090d16",
      preview:
        "linear-gradient(135deg, #090d16 0%, #1a2440 100%), repeating-linear-gradient(120deg, rgba(99,102,241,0.45) 0 1px, transparent 1px 10px)"
    }
  ];
  const activeIndex = Math.max(
    0,
    slides.findIndex((item) => item.id === (activeSlideId ?? slide.id))
  );
  const orderedTextElements = slide.elements
    .filter(
      (element): element is TextElement =>
        element.type === "text" && !NON_CONTENT_TEXT_META_KEYS.has(element.metaKey ?? "")
    )
    .sort((left, right) => left.y - right.y);
  const fallbackTitleTextElement =
    slide.elements.find(
      (element): element is TextElement =>
        element.type === "text" &&
        (element.metaKey === "managed-title" || element.role === "title")
    ) ??
    orderedTextElements[0] ??
    null;
  const fallbackBodyTextElement =
    slide.elements.find(
      (element): element is TextElement =>
        element.type === "text" &&
        (element.metaKey === "managed-body" || element.role === "body")
    ) ??
    orderedTextElements.find((element) => element.id !== fallbackTitleTextElement?.id) ??
    fallbackTitleTextElement;
  const activeTextElement =
    selectedTextElement ??
    (selectedTextTargetRole === "body"
      ? fallbackBodyTextElement ?? fallbackTitleTextElement
      : fallbackTitleTextElement ?? fallbackBodyTextElement);
  const isAutoSelectedText = !selectedTextElement && Boolean(activeTextElement);
  const normalizedTextColor = normalizeColorForInput(activeTextElement?.fill, "#1b1e24");
  const normalizedHighlightColor = normalizeColorForInput(selectedTextHighlightColor, "#1f49ff");
  const normalizedBackgroundColor = normalizeColorForInput(slideBackground, "#ffffff");
  const [isAddSlidePopoverOpen, setIsAddSlidePopoverOpen] = useState(false);
  const [isBackgroundPickerOpen, setIsBackgroundPickerOpen] = useState(false);
  const [isHighlightPickerOpen, setIsHighlightPickerOpen] = useState(false);
  const [isTextColorPickerOpen, setIsTextColorPickerOpen] = useState(false);
  const [isFontPopoverOpen, setIsFontPopoverOpen] = useState(false);
  const [isCaptionCopied, setIsCaptionCopied] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const captionCopyResetTimeoutRef = useRef<number | null>(null);
  const selectedTextCaseMode = detectTextCaseMode(activeTextElement?.text ?? "");
  const selectedTextHighlightOpacityPercent = Math.round(selectedTextHighlightOpacity * 100);

  const syncTextAreaHeight = () => {
    const node = textAreaRef.current;
    if (!node) {
      return;
    }
    node.style.height = "0px";
    node.style.height = `${Math.max(80, node.scrollHeight)}px`;
  };

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

  useEffect(() => {
    syncTextAreaHeight();
  }, [activeTextElement?.id, activeTextElement?.text]);

  const handleCopyCaptionClick = () => {
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
      <section className="settings-card settings-card-slides" ref={slidesSectionRef}>
        <div className="settings-card-header">
          <h2 className="settings-title">Слайды</h2>
          <span className="status-pill">
            Слайд {slideIndex + 1} / {totalSlides}
          </span>
        </div>

        <div className="slides-list slides-list-compact custom-scroll">
          {slides.length ? (
            slides.map((item, index) => {
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
                      <span className="slides-list-type-badge">{getSlideTypeLabel(item.slideType)}</span>
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
            })
          ) : (
            <div className="settings-empty">Пока нет слайдов. Создайте первую карусель на главной.</div>
          )}
        </div>

        <Popover.Root open={isAddSlidePopoverOpen} onOpenChange={setIsAddSlidePopoverOpen}>
          <Popover.Trigger asChild>
            <button type="button" className="btn secondary add-slide-trigger" disabled={disabled}>
              <span>+ Добавить слайд</span>
              <ChevronDown size={14} />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="settings-popover add-slide-popover"
              align="start"
              side="bottom"
              sideOffset={8}
            >
              <button
                type="button"
                className="add-slide-option"
                onClick={() => {
                  onInsertSlideAt(activeIndex + 1, "text");
                  setIsAddSlidePopoverOpen(false);
                }}
              >
                <TypeIcon size={16} />
                <span>+ Текст</span>
              </button>
              <button
                type="button"
                className="add-slide-option"
                onClick={() => {
                  onInsertSlideAt(activeIndex + 1, "image_text");
                  setIsAddSlidePopoverOpen(false);
                }}
              >
                <span className="add-slide-option-icons">
                  <ImageIcon size={16} />
                  <TypeIcon size={16} />
                </span>
                <span>+ Фото + текст</span>
              </button>
              <button
                type="button"
                className="add-slide-option"
                onClick={() => {
                  onInsertSlideAt(activeIndex + 1, "big_text");
                  setIsAddSlidePopoverOpen(false);
                }}
              >
                <AlignJustify size={16} />
                <span>+ Большой текст</span>
              </button>
              <button
                type="button"
                className="add-slide-option"
                onClick={() => {
                  onAddSlidePhoto();
                  setIsAddSlidePopoverOpen(false);
                }}
              >
                <ImageIcon size={16} />
                <span>+ Фото</span>
              </button>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </section>

      <section className="settings-card settings-card-template">
        <button
          type="button"
          className="template-library-card"
          onClick={onOpenTemplateModal}
          disabled={disabled}
        >
          <span className="template-library-preview" style={{ background: normalizedBackgroundColor }}>
            <span className="template-library-preview-chip" />
            <span className="template-library-preview-title" />
            <span className="template-library-preview-body" />
          </span>
          <span className="template-library-card-copy">
            <h3>Шаблон</h3>
            <strong>{activeTemplateName}</strong>
            <small>Нажми чтобы сменить</small>
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

      <section className="settings-card settings-card-style">
        <h3>Стиль фона</h3>
        <div className="desktop-style-row">
          {stylePresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`desktop-style-card ${
                slideBackground.toLowerCase() === preset.background.toLowerCase() ? "active" : ""
              }`}
              onClick={() => onApplyStylePreset(preset.id, { applyAll: true })}
              disabled={disabled}
            >
              <span className="desktop-style-preview" style={{ background: preset.preview }} />
              <span className="desktop-style-label">{preset.label}</span>
            </button>
          ))}
        </div>
        <label className="settings-switch-row">
          <span>Показывать сетку</span>
          <Switch.Root
            className="settings-switch-root"
            checked={gridVisible}
            onCheckedChange={(value) => onGridVisibilityChange(Boolean(value))}
            disabled={disabled}
          >
            <Switch.Thumb className="settings-switch-thumb" />
          </Switch.Root>
        </label>
      </section>

      <section className="settings-card settings-card-background">
        <h3>Цвет фона</h3>
        <label className="field-label">
          Цвет (HEX)
          <div className="color-row color-row-inline">
            <Popover.Root open={isBackgroundPickerOpen} onOpenChange={setIsBackgroundPickerOpen}>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className="color-preview-trigger"
                  style={{ backgroundColor: normalizedBackgroundColor }}
                  aria-label="Открыть выбор цвета фона"
                  disabled={disabled}
                />
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="settings-popover color-picker-popover"
                  align="start"
                  side="bottom"
                  sideOffset={8}
                >
                  <HexColorPicker
                    color={normalizedBackgroundColor}
                    onChange={onSlideBackgroundChange}
                    className="background-color-picker"
                  />
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
            <HexColorField
              value={normalizedBackgroundColor}
              onValidChange={onSlideBackgroundChange}
              disabled={disabled}
              className="field color-hex-input"
            />
          </div>
        </label>
        <label className="field-label">
          Пресеты
          <div className="color-swatches-row color-swatches-row-single-line">
            {BACKGROUND_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={`color-swatch ${
                  normalizedBackgroundColor.toLowerCase() === preset.value.toLowerCase() ? "active" : ""
                } ${preset.value.toLowerCase() === "#ffffff" ? "is-light" : ""}`}
                style={{ backgroundColor: preset.value }}
                title={preset.label}
                aria-label={preset.label}
                onClick={() => onSlideBackgroundChange(preset.value)}
                disabled={disabled}
              />
            ))}
          </div>
        </label>
      </section>

      <section className="settings-card settings-card-photo">
        <h3>Фото</h3>
        <label className="settings-switch-row">
          <span>Фото-блок</span>
          <Switch.Root
            className="settings-switch-root"
            checked={photoSlotEnabled}
            onCheckedChange={(value) => onPhotoSlotEnabledChange(Boolean(value))}
            disabled={disabled || !canUsePhotoSlot}
          >
            <Switch.Thumb className="settings-switch-thumb" />
          </Switch.Root>
        </label>
        <div className="field-row field-row-export">
          <button
            type="button"
            className="btn secondary desktop-photo-upload-btn"
            onClick={onUploadBackgroundImage}
            disabled={disabled || !photoSlotEnabled}
          >
            Загрузить фото
          </button>
          <button
            type="button"
            className="ghost-chip ghost-chip-muted"
            onClick={onRemoveBackgroundImage}
            disabled={!hasBackgroundImage || disabled || !photoSlotEnabled}
          >
            Очистить
          </button>
        </div>
        <div className="desktop-photo-preview-row">
          {hasBackgroundImage && slide.backgroundImage ? (
            <img
              src={slide.backgroundImage}
              alt="Превью фото"
              className="desktop-photo-preview"
            />
          ) : (
            <div className="desktop-photo-preview desktop-photo-preview-empty">Нет фото</div>
          )}
          <button
            type="button"
            className="ghost-chip"
            onClick={onAddSlidePhoto}
            disabled={disabled || !photoSlotEnabled}
          >
            + Фото
          </button>
        </div>
      </section>

      <section className="settings-card settings-card-signature" ref={signatureSectionRef}>
        <h3>Подпись</h3>
        <label className="settings-switch-row">
          <span>Показывать подпись на всех слайдах</span>
          <Switch.Root
            className="settings-switch-root"
            checked={subtitlesVisibleAcrossSlides}
            onCheckedChange={(value) => onToggleSubtitleAcrossSlides(Boolean(value))}
            disabled={disabled}
          >
            <Switch.Thumb className="settings-switch-thumb" />
          </Switch.Root>
        </label>
        <label className="field-label">
          Ник
          <input
            ref={profileHandleInputRef}
            className="field"
            value={profileHandle}
            onChange={(event) => onProfileHandleChange(event.target.value)}
            placeholder="@username"
            disabled={disabled}
          />
        </label>
      </section>

      <section className="settings-card settings-card-text-controls">
        <div className="settings-inline-head">
          <h3>Текст и шрифт</h3>
          <span className="status-pill">
            {activeTextElement ? (isAutoSelectedText ? "Автовыбор текста" : "Элемент выбран") : "Элемент не выбран"}
          </span>
        </div>

        {activeTextElement ? (
          <>
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
                ref={textAreaRef}
                className="field settings-textarea"
                value={activeTextElement.text}
                rows={1}
                onChange={(event) => {
                  onSelectedTextChange(event.target.value);
                  syncTextAreaHeight();
                }}
                onInput={syncTextAreaHeight}
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
                disabled={disabled}
              />
            </label>

            <div className="field-row field-row-inline">
              <label className="field-label" style={{ flex: 1 }}>
                Цвет выделения
                <div className="color-row color-row-inline">
                  <Popover.Root open={isHighlightPickerOpen} onOpenChange={setIsHighlightPickerOpen}>
                    <Popover.Trigger asChild>
                      <button
                        type="button"
                        className="color-preview-trigger color-preview-circle"
                        style={{ backgroundColor: normalizedHighlightColor }}
                        aria-label="Открыть выбор цвета выделения"
                        disabled={disabled}
                      />
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content
                        className="settings-popover color-picker-popover"
                        align="start"
                        side="bottom"
                        sideOffset={8}
                      >
                        <HexColorPicker
                          color={normalizedHighlightColor}
                          onChange={onSelectedTextHighlightColorChange}
                          className="background-color-picker"
                        />
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                  <HexColorField
                    value={normalizedHighlightColor}
                    onValidChange={onSelectedTextHighlightColorChange}
                    disabled={disabled}
                    className="field color-hex-input"
                  />
                </div>
              </label>
              <div className="field-row field-row-actions highlight-selection-actions" style={{ flex: 1 }}>
                <button
                  type="button"
                  className="ghost-chip"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={onApplyHighlightToSelection}
                  disabled={disabled}
                >
                  Выделить
                </button>
                <button
                  type="button"
                  className="ghost-chip ghost-chip-muted"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={onClearHighlightFromSelection}
                  disabled={disabled}
                >
                  Снять
                </button>
              </div>
            </div>

            <div className="field-row field-row-balanced-actions highlight-bulk-actions">
              <button
                type="button"
                className="ghost-chip ghost-chip-muted balanced-action-button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={onApplyHighlightColorToAllSlides}
                disabled={disabled}
              >
                Все слайды
              </button>
              <button
                type="button"
                className="ghost-chip ghost-chip-muted balanced-action-button"
                onClick={onClearAllHighlights}
                disabled={disabled}
              >
                Очистить всё
              </button>
            </div>

            <label className="field-label">
              <span>Прозрачность выделения</span>
              <div className="range-row">
                <input
                  className="range"
                  type="range"
                  min={8}
                  max={100}
                  step={1}
                  value={selectedTextHighlightOpacityPercent}
                  onChange={(event) =>
                    onSelectedTextHighlightOpacityChange(Number(event.target.value) / 100)
                  }
                  disabled={disabled}
                />
                <span className="range-value">{selectedTextHighlightOpacityPercent}%</span>
              </div>
            </label>

            <div className="field-row field-row-inline">
              <label className="field-label" style={{ flex: 1 }}>
                Шрифт
                <Popover.Root open={isFontPopoverOpen} onOpenChange={setIsFontPopoverOpen}>
                  <Popover.Trigger asChild>
                    <button type="button" className="font-picker-trigger" disabled={disabled}>
                      <span
                        className="font-picker-trigger-value"
                        style={{ fontFamily: `${activeTextElement.fontFamily}, Inter, sans-serif` }}
                      >
                        {activeTextElement.fontFamily}
                      </span>
                      <ChevronDown size={14} />
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content
                      className="settings-popover font-picker-popover"
                      align="start"
                      side="bottom"
                      sideOffset={8}
                    >
                      {FONT_OPTIONS.map((fontName) => {
                        const isActiveFont = activeTextElement.fontFamily === fontName;
                        return (
                          <button
                            key={fontName}
                            type="button"
                            className={`font-picker-option ${isActiveFont ? "active" : ""}`}
                            style={{ fontFamily: `${fontName}, Inter, sans-serif` }}
                            onClick={() => {
                              onSelectedTextFontChange(fontName);
                              setIsFontPopoverOpen(false);
                            }}
                          >
                            {fontName}
                          </button>
                        );
                      })}
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              </label>

              <label className="field-label" style={{ width: 120 }}>
                Размер
                <input
                  className="field"
                  type="number"
                  min={14}
                  max={96}
                  value={Math.round(activeTextElement.fontSize)}
                  onChange={(event) => onSelectedTextSizeChange(Number(event.target.value))}
                  disabled={disabled}
                />
              </label>
            </div>

            <div className="segment-control segment-control-neutral segment-control-case">
              <button
                type="button"
                className={`segment-item segment-item-neutral ${selectedTextCaseMode === "normal" ? "active" : ""}`}
                onClick={() => onSelectedTextCaseChange("normal")}
                title="Обычный регистр"
                disabled={disabled}
              >
                Aa
              </button>
              <button
                type="button"
                className={`segment-item segment-item-neutral ${selectedTextCaseMode === "uppercase" ? "active" : ""}`}
                onClick={() => onSelectedTextCaseChange("uppercase")}
                title="Верхний регистр"
                disabled={disabled}
              >
                AA
              </button>
              <button
                type="button"
                className={`segment-item segment-item-neutral ${selectedTextCaseMode === "lowercase" ? "active" : ""}`}
                onClick={() => onSelectedTextCaseChange("lowercase")}
                title="Нижний регистр"
                disabled={disabled}
              >
                aa
              </button>
              <button
                type="button"
                className={`segment-item segment-item-neutral ${selectedTextCaseMode === "capitalize" ? "active" : ""}`}
                onClick={() => onSelectedTextCaseChange("capitalize")}
                title="Каждое слово с заглавной"
                disabled={disabled}
              >
                Aa
              </button>
            </div>

            <div className="segment-control segment-control-neutral segment-control-align">
              <button
                type="button"
                className={`segment-item segment-item-neutral segment-item-icon ${
                  activeTextElement.align === "left" ? "active" : ""
                }`}
                onClick={() => onSelectedTextAlignChange("left")}
                title="Выравнивание по левому краю"
                disabled={disabled}
              >
                <AlignLeft size={14} />
              </button>
              <button
                type="button"
                className={`segment-item segment-item-neutral segment-item-icon ${
                  activeTextElement.align === "center" ? "active" : ""
                }`}
                onClick={() => onSelectedTextAlignChange("center")}
                title="Выравнивание по центру"
                disabled={disabled}
              >
                <AlignCenter size={14} />
              </button>
              <button
                type="button"
                className={`segment-item segment-item-neutral segment-item-icon ${
                  activeTextElement.align === "right" ? "active" : ""
                }`}
                onClick={() => onSelectedTextAlignChange("right")}
                title="Выравнивание по правому краю"
                disabled={disabled}
              >
                <AlignRight size={14} />
              </button>
            </div>

            <label className="field-label">
              Цвет текста
              <div className="color-row color-row-inline">
                <Popover.Root open={isTextColorPickerOpen} onOpenChange={setIsTextColorPickerOpen}>
                  <Popover.Trigger asChild>
                    <button
                      type="button"
                      className="color-preview-trigger color-preview-circle"
                      style={{ backgroundColor: normalizedTextColor }}
                      aria-label="Открыть выбор цвета текста"
                      disabled={disabled}
                    />
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content
                      className="settings-popover color-picker-popover"
                      align="start"
                      side="bottom"
                      sideOffset={8}
                    >
                      <HexColorPicker
                        color={normalizedTextColor}
                        onChange={onSelectedTextColorChange}
                        className="background-color-picker"
                      />
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
                <HexColorField
                  value={normalizedTextColor}
                  onValidChange={onSelectedTextColorChange}
                  disabled={disabled}
                  className="field color-hex-input"
                />
              </div>
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
        <button
          type="button"
          className="btn export-primary-cta"
          onClick={onOpenExportModal}
          disabled={disabled || isExporting || isGenerating}
        >
          {isExporting ? <Loader2 size={16} className="spinner-icon" /> : <AppIcon name="download" size={16} />}
          <span>{isExporting ? "Экспорт..." : "Экспортировать карусель"}</span>
        </button>
        <div className="field-row field-row-export export-secondary-row">
          <AppSelect
            value={exportMode}
            onValueChange={(value) => onExportModeChange(value as ExportMode)}
            disabled={disabled || isExporting}
            ariaLabel="Формат экспорта"
            triggerClassName="select export-mode-select"
            options={[
              { value: "zip", label: "ZIP (PNG)" },
              { value: "png", label: "PNG" },
              { value: "jpg", label: "JPG" },
              { value: "pdf", label: "PDF" }
            ]}
          />
          <button
            type="button"
            className="ghost-chip ghost-chip-muted export-slides-button"
            onClick={onOpenExportModal}
            disabled={disabled || isExporting || isGenerating}
          >
            Выбрать слайды
          </button>
        </div>
      </section>

      <section className="settings-card settings-card-caption">
        <h3>Подпись к посту</h3>
        <div className="field-row field-row-actions caption-actions-row">
          <button
            type="button"
            className="btn caption-generate-button"
            onClick={onGenerateCaption}
            disabled={disabled || isGenerating || isGeneratingCaption}
          >
            <Sparkles size={16} />
            <span>{isGeneratingCaption ? "Генерирую..." : "Сгенерировать подпись"}</span>
          </button>
          {captionResult ? (
            <button
              type="button"
              className="ghost-chip ghost-chip-muted caption-copy-button"
              onClick={handleCopyCaptionClick}
              disabled={disabled}
            >
              {isCaptionCopied ? "Скопировано ✓" : "Копировать"}
            </button>
          ) : null}
        </div>

        <label className="field-label">
          Текст
          <textarea
            className={`field settings-textarea caption-main-textarea ${
              captionResult ? "" : "caption-main-textarea-placeholder"
            }`}
            readOnly
            value={captionResult?.text ?? ""}
            placeholder="Здесь появится подпись после генерации"
            rows={6}
          />
        </label>
        {captionResult ? (
          <>
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
        ) : null}
      </section>
    </>
  );
}
