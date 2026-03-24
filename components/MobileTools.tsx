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
  | "font"
  | "size";

type MobileToolsProps = {
  activeTab: MobileToolTab | null;
  onTabChange: (tab: MobileToolTab | null) => void;
  selectedElement: CanvasElement | null;
  selectedTextElement: TextElement | null;
  activeTemplateName: string;
  profileHandle: string;
  profileSubtitle: string;
  photoSlotEnabled: boolean;
  hasBackgroundImage: boolean;
  captionResult: CarouselPostCaption | null;
  isGeneratingCaption: boolean;
  onGenerateCaption: () => void;
  onCopyCaption: () => void;
  onPhotoSlotEnabledChange: (value: boolean) => void;
  slideBackground: string;
  onUploadBackgroundImage: () => void;
  onRemoveBackgroundImage: () => void;
  onOpenTemplateModal: () => void;
  onProfileHandleChange: (value: string) => void;
  onProfileSubtitleChange: (value: string) => void;
  onSlideBackgroundChange: (value: string) => void;
  onSelectedTextChange: (value: string) => void;
  onSelectedTextColorChange: (value: string) => void;
  onSelectedTextFontChange: (value: string) => void;
  onSelectedTextSizeChange: (value: number) => void;
  onSelectedTextCaseChange: (mode: "normal" | "uppercase" | "lowercase" | "capitalize") => void;
  toolbarRef?: MutableRefObject<HTMLElement | null>;
  toolSheetRef?: MutableRefObject<HTMLElement | null>;
  disabled?: boolean;
  previewMode?: boolean;
};

const TOOLBAR_ITEMS: Array<{ id: MobileToolTab; icon: AppIconName; label: string }> = [
  { id: "templates", icon: "templates", label: "Шаблоны" },
  { id: "color", icon: "palette", label: "Цвет" },
  { id: "background", icon: "background", label: "Фон" },
  { id: "style", icon: "style", label: "Стиль" },
  { id: "text", icon: "text", label: "Текст" },
  { id: "font", icon: "font", label: "Шрифт" },
  { id: "size", icon: "size", label: "Размер" }
];

const FONT_OPTIONS = ["Inter", "Manrope", "Advent Pro", "Fira Code", "Russo One", "Oswald"];

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
      "repeating-linear-gradient(90deg, rgba(18,21,27,0.12) 0 1px, transparent 1px 10px), repeating-linear-gradient(180deg, rgba(18,21,27,0.12) 0 1px, transparent 1px 10px)"
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
    preview: "linear-gradient(180deg, #f2f2f6 0%, #eaebef 100%)"
  },
  {
    id: "dots",
    label: "Точки",
    background: "#f5f5f6",
    preview:
      "radial-gradient(circle, rgba(18,21,27,0.2) 1px, transparent 1.2px), radial-gradient(circle, rgba(18,21,27,0.14) 1px, transparent 1.2px)"
  },
  {
    id: "flash",
    label: "Молнии",
    background: "#e8e9ed",
    preview: "linear-gradient(130deg, #f6f6f7 10%, #e8e9ed 46%, #dfe1e7 100%)"
  }
] as const;

export function MobileTools({
  activeTab,
  onTabChange,
  selectedElement,
  selectedTextElement,
  activeTemplateName,
  profileHandle,
  profileSubtitle,
  photoSlotEnabled,
  hasBackgroundImage,
  captionResult,
  isGeneratingCaption,
  onGenerateCaption,
  onCopyCaption,
  onPhotoSlotEnabledChange,
  slideBackground,
  onUploadBackgroundImage,
  onRemoveBackgroundImage,
  onOpenTemplateModal,
  onProfileHandleChange,
  onProfileSubtitleChange,
  onSlideBackgroundChange,
  onSelectedTextChange,
  onSelectedTextColorChange,
  onSelectedTextFontChange,
  onSelectedTextSizeChange,
  onSelectedTextCaseChange,
  toolbarRef,
  toolSheetRef,
  disabled = false,
  previewMode = false
}: MobileToolsProps) {
  const swipeRef = useRef<{ startY: number; startX: number; drag: number } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [colorMode, setColorMode] = useState<"single" | "double">("single");
  const [sizeTarget, setSizeTarget] = useState<"title" | "body">("title");
  const [applyStyleForAll, setApplyStyleForAll] = useState(true);
  const [applySizeForAll, setApplySizeForAll] = useState(false);
  const selectedElementLabel = selectedElement
    ? selectedElement.type === "text"
      ? "Выбран текст"
      : selectedElement.type === "image"
        ? "Выбрано изображение"
        : "Выбрана фигура"
    : "Элемент не выбран";

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
            <div className="settings-selected-pill">{selectedElementLabel}</div>

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
                <div className="segment-control">
                  <button
                    type="button"
                    className={`segment-item ${colorMode === "single" ? "active" : ""}`}
                    onClick={() => setColorMode("single")}
                    disabled={disabled}
                  >
                    Одинарная
                  </button>
                  <button
                    type="button"
                    className={`segment-item ${colorMode === "double" ? "active" : ""}`}
                    onClick={() => setColorMode("double")}
                    disabled={disabled}
                  >
                    Двойная
                  </button>
                </div>

                <div className="mobile-sheet-row">
                  <label className="field-label">
                    Цвет выделений
                    <div className="mobile-color-inline">
                      <input
                        type="color"
                        className="color-input"
                        value={selectedTextElement?.fill ?? "#56cfc2"}
                        onChange={(event) => onSelectedTextColorChange(event.target.value)}
                        disabled={disabled || !selectedTextElement}
                      />
                      <input
                        className="field"
                        value={(selectedTextElement?.fill ?? "#56cfc2").toUpperCase()}
                        readOnly
                      />
                    </div>
                  </label>
                </div>
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
                    onChange={(event) => onSlideBackgroundChange(event.target.value)}
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
                    onClick={onUploadBackgroundImage}
                    disabled={disabled || !photoSlotEnabled}
                  >
                    + Выбрать файл
                  </button>
                  <button
                    type="button"
                    className="ghost-chip ghost-chip-muted"
                    onClick={onRemoveBackgroundImage}
                    disabled={!hasBackgroundImage || disabled || !photoSlotEnabled}
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
                        onClick={() => onSlideBackgroundChange(preset.background)}
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
              </div>
            ) : null}

            {activeTab === "text" ? (
              <div className="settings-block">
                <div className="segment-control">
                  <button type="button" className="segment-item active">
                    Заголовок
                  </button>
                  <button type="button" className="segment-item" disabled>
                    Описание
                  </button>
                </div>

                <label className="field-label">
                  Текст элемента
                  <textarea
                    className="textarea"
                    value={selectedTextElement?.text ?? ""}
                    onChange={(event) => onSelectedTextChange(event.target.value)}
                    placeholder="Выберите текст на слайде"
                    rows={3}
                    disabled={disabled || !selectedTextElement}
                  />
                </label>

                <div className="mobile-case-grid">
                  <button
                    type="button"
                    className="mobile-case-btn"
                    onClick={() => onSelectedTextCaseChange("capitalize")}
                    disabled={disabled || !selectedTextElement}
                  >
                    Aa
                  </button>
                  <button
                    type="button"
                    className="mobile-case-btn"
                    onClick={() => onSelectedTextCaseChange("uppercase")}
                    disabled={disabled || !selectedTextElement}
                  >
                    AA
                  </button>
                  <button
                    type="button"
                    className="mobile-case-btn"
                    onClick={() => onSelectedTextCaseChange("lowercase")}
                    disabled={disabled || !selectedTextElement}
                  >
                    aa
                  </button>
                  <button
                    type="button"
                    className="mobile-case-btn"
                    onClick={() => onSelectedTextCaseChange("normal")}
                    disabled={disabled || !selectedTextElement}
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
                    placeholder="Надпись"
                    disabled={disabled}
                  />
                </label>

                <div className="field-row field-row-actions">
                  <button
                    type="button"
                    className="ghost-chip"
                    onClick={onGenerateCaption}
                    disabled={disabled || isGeneratingCaption}
                  >
                    {isGeneratingCaption ? "Генерирую..." : "Подпись к посту"}
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
                    value={[captionResult.text, "", captionResult.cta, "", captionResult.hashtags.join(" ")].join(
                      "\n"
                    )}
                    rows={6}
                    readOnly
                  />
                ) : null}
              </div>
            ) : null}

            {activeTab === "font" ? (
              <div className="settings-block">
                <span className="settings-label">Шрифты</span>
                <label className="field-label">Заголовок</label>
                <div className="mobile-font-grid">
                  {FONT_OPTIONS.map((fontName) => {
                    const isActive = selectedTextElement?.fontFamily === fontName;
                    return (
                      <button
                        key={`title-${fontName}`}
                        type="button"
                        className={`mobile-font-item ${isActive ? "active" : ""}`}
                        onClick={() => onSelectedTextFontChange(fontName)}
                        disabled={disabled || !selectedTextElement}
                        style={{ fontFamily: fontName }}
                      >
                        {fontName}
                      </button>
                    );
                  })}
                </div>
                <label className="field-label">Описание</label>
                <div className="mobile-font-grid">
                  {FONT_OPTIONS.map((fontName) => {
                    const isActive = selectedTextElement?.fontFamily === fontName;
                    return (
                      <button
                        key={`body-${fontName}`}
                        type="button"
                        className={`mobile-font-item ${isActive ? "active" : ""}`}
                        onClick={() => onSelectedTextFontChange(fontName)}
                        disabled={disabled || !selectedTextElement}
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
                    className={`segment-item ${sizeTarget === "title" ? "active" : ""}`}
                    onClick={() => setSizeTarget("title")}
                    disabled={disabled}
                  >
                    Заголовок
                  </button>
                  <button
                    type="button"
                    className={`segment-item ${sizeTarget === "body" ? "active" : ""}`}
                    onClick={() => setSizeTarget("body")}
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
                    disabled={disabled || !selectedTextElement}
                  >
                    Aa
                  </button>
                  <button
                    type="button"
                    className="mobile-case-btn"
                    onClick={() => onSelectedTextCaseChange("uppercase")}
                    disabled={disabled || !selectedTextElement}
                  >
                    AA
                  </button>
                  <button
                    type="button"
                    className="mobile-case-btn"
                    onClick={() => onSelectedTextCaseChange("lowercase")}
                    disabled={disabled || !selectedTextElement}
                  >
                    aa
                  </button>
                  <button
                    type="button"
                    className="mobile-case-btn"
                    onClick={() => onSelectedTextCaseChange("normal")}
                    disabled={disabled || !selectedTextElement}
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
                    value={Math.round(selectedTextElement?.fontSize ?? 28)}
                    onChange={(event) => onSelectedTextSizeChange(Number(event.target.value))}
                    disabled={disabled || !selectedTextElement}
                  />
                  <div className="mobile-size-value">{Math.round(selectedTextElement?.fontSize ?? 28)}px</div>
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

  return "Размер текста";
}

function normalizeColor(value: string) {
  if (!value || !value.startsWith("#") || (value.length !== 7 && value.length !== 4)) {
    return "#ffffff";
  }

  return value;
}
