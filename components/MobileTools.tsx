"use client";

import type { MutableRefObject } from "react";
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
  toolbarRef?: MutableRefObject<HTMLElement | null>;
  toolSheetRef?: MutableRefObject<HTMLElement | null>;
};

const TOOLBAR_ITEMS: Array<{ id: MobileToolTab; icon: string; label: string }> = [
  { id: "templates", icon: "▦", label: "Шаблоны" },
  { id: "color", icon: "◉", label: "Цвет" },
  { id: "background", icon: "🖼", label: "Фон" },
  { id: "style", icon: "✦", label: "Стиль" },
  { id: "text", icon: "T", label: "Текст" },
  { id: "font", icon: "Aa", label: "Шрифт" },
  { id: "size", icon: "A↑", label: "Размер" }
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
  toolbarRef,
  toolSheetRef
}: MobileToolsProps) {
  const templates = getTemplatesByCategory(activeTemplateCategory);
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
              onClick={() => onTabChange(isActive ? null : item.id)}
            >
              <span>{item.icon}</span>
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
          <div className="mobile-tool-sheet-header">
            <h3>{getTabTitle(activeTab)}</h3>
            <button
              type="button"
              className="mobile-tool-close"
              onClick={() => onTabChange(null)}
              aria-label="Закрыть панель"
            >
              ✕
            </button>
          </div>

          <div className="mobile-tool-sheet-body">
            <div className="settings-selected-pill">{selectedElementLabel}</div>
            {selectedElement ? (
              <button type="button" className="ghost-chip ghost-chip-small" onClick={onCenterSelectedElement}>
                Center element
              </button>
            ) : null}
            {activeTab === "templates" ? (
              <div className="settings-block">
                <span className="settings-label">Категория</span>
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

                <span className="settings-label">Применение</span>
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

                <div className="mobile-template-list">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      className={`mobile-template-card ${activeTemplateId === template.id ? "active" : ""}`}
                      onClick={() => onApplyTemplate(template.id)}
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
                        <span
                          className="mobile-template-preview-chip"
                          style={{ backgroundColor: template.accent }}
                        />
                      </span>
                      <span className="mobile-template-name">{template.name}</span>
                    </button>
                  ))}
                </div>
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
                  />
                  <span>{slide.background}</span>
                </label>

                <div className="field-row">
                  <button type="button" className="ghost-chip" onClick={onUploadBackgroundImage}>
                    + Выбрать файл
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
            ) : null}

            {activeTab === "style" ? (
              <div className="settings-block">
                <span className="settings-label">Профиль и подпись</span>
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

                {selectedTextElement ? (
                  <label className="field-label">
                    Выравнивание текста
                    <select
                      className="select"
                      value={selectedTextElement.align}
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
                ) : null}
              </div>
            ) : null}

            {activeTab === "text" ? (
              <div className="settings-block">
                {selectedTextElement ? (
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
                    />
                  </label>
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
