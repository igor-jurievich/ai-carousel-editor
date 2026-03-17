"use client";

import { useState, type MutableRefObject } from "react";
import {
  BACKGROUND_STYLE_PRESETS,
  FOOTER_VARIANTS,
  FONT_OPTIONS,
  getPrimaryTemplates,
  getTemplatesByCategory,
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
  | "color"
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
  onProfileHandleChange: (value: string) => void;
  onProfileSubtitleChange: (value: string) => void;
  onFooterVariantChange: (value: FooterVariantId) => void;
  onUpdateElement: (elementId: string, updater: (element: CanvasElement) => CanvasElement) => void;
  onCenterSelectedElement: () => void;
  showSlideBadge: boolean;
  onToggleSlideBadge: () => void;
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
  onProfileHandleChange,
  onProfileSubtitleChange,
  onFooterVariantChange,
  onUpdateElement,
  onCenterSelectedElement,
  showSlideBadge,
  onToggleSlideBadge,
  toolbarRef,
  toolSheetRef,
  disabled = false,
  previewMode = false
}: MobileToolsProps) {
  const [showExtendedTemplates, setShowExtendedTemplates] = useState(false);
  const templates = getTemplatesByCategory(activeTemplateCategory);
  const primaryTemplates = getPrimaryTemplates();
  const selectedTextElement = selectedElement?.type === "text" ? selectedElement : null;
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
          className="mobile-tool-sheet"
          role="dialog"
          aria-label="Инструменты редактора"
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
                onClick={onCenterSelectedElement}
                disabled={disabled}
              >
                Center element
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

            {activeTab === "color" ? (
              <div className="settings-block">
                <span className="settings-label">Цвет фона</span>
                <label className="color-row">
                  <input
                    className="color-input"
                    type="color"
                    value={slide.background}
                    onChange={(event) => onBackgroundChange(event.target.value)}
                    disabled={disabled}
                  />
                  <span>{slide.background}</span>
                </label>

                {selectedTextElement ? (
                  <>
                    <span className="settings-label">Цвет текста</span>
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
                      <span>{selectedTextElement.fill}</span>
                    </label>
                  </>
                ) : (
                  <div className="settings-empty">
                    Выберите текстовый элемент, чтобы менять цвет текста.
                  </div>
                )}
              </div>
            ) : null}

            {activeTab === "background" ? (
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
                  <span>{slide.background}</span>
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
                ) : (
                  <div className="settings-empty">
                    Выберите текстовый элемент, чтобы изменить размер шрифта.
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

function getTabTitle(tab: MobileToolTab) {
  if (tab === "templates") {
    return "Шаблоны";
  }
  if (tab === "color") {
    return "Цвет";
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
