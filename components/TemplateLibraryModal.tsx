"use client";

import { useEffect, useMemo, useState } from "react";
import { AppIcon } from "@/components/icons";
import { getTemplate, getTemplatesByCategory } from "@/lib/carousel";
import type {
  CarouselTemplate,
  CarouselTemplateCategory,
  CarouselTemplateId
} from "@/types/editor";

type TemplateLibraryModalProps = {
  isOpen: boolean;
  activeTemplateId: CarouselTemplateId;
  onApplyTemplate: (templateId: CarouselTemplateId, scope: "all" | "current") => void;
  onClose: () => void;
};

type TemplateCategory = {
  id: CarouselTemplateCategory;
  title: string;
};

const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { id: "dark", title: "Темные" },
  { id: "light", title: "Светлые" },
  { id: "color", title: "Цветные" }
];

export function TemplateLibraryModal({
  isOpen,
  activeTemplateId,
  onApplyTemplate,
  onClose
}: TemplateLibraryModalProps) {
  const [activeCategory, setActiveCategory] = useState<CarouselTemplateCategory>(
    getTemplate(activeTemplateId).category
  );
  const [applyScope, setApplyScope] = useState<"all" | "current">("all");
  const visibleTemplates = useMemo(
    () => getTemplatesByCategory(activeCategory),
    [activeCategory]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setActiveCategory(getTemplate(activeTemplateId).category);
    setApplyScope("all");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [activeTemplateId, isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="editor-modal-overlay" onClick={onClose} role="presentation">
      <section
        className="editor-modal template-library-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Выбор шаблона"
      >
        <header className="editor-modal-header">
          <h3>Шаблоны</h3>
          <button
            type="button"
            className="editor-modal-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <AppIcon name="close" size={16} />
          </button>
        </header>

        <div className="editor-modal-content template-library-content template-library-content-v2">
          <div className="segment-control" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className={`segment-item ${applyScope === "all" ? "active" : ""}`}
              onClick={() => setApplyScope("all")}
            >
              Ко всей карусели
            </button>
            <button
              type="button"
              className={`segment-item ${applyScope === "current" ? "active" : ""}`}
              onClick={() => setApplyScope("current")}
            >
              Только текущий
            </button>
          </div>

          <div className="template-library-categories-row">
            {TEMPLATE_CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`template-library-category-tab ${
                  activeCategory === category.id ? "active" : ""
                }`}
                onClick={() => setActiveCategory(category.id)}
              >
                {category.title}
              </button>
            ))}
          </div>

          <div className="template-library-grid template-library-grid-v2">
            {visibleTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                className={`template-library-card ${activeTemplateId === template.id ? "active" : ""}`}
                onClick={() => {
                  onApplyTemplate(template.id, applyScope);
                  onClose();
                }}
              >
                <TemplatePreview template={template} />
                <div className="template-library-card-meta">
                  <strong>{template.name}</strong>
                  <span>{template.preview ?? template.description}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function TemplatePreview({ template }: { template: CarouselTemplate }) {
  const isDarkCategory = template.category === "dark";
  const hasDecoration = template.decoration !== "none" && template.gridMode !== "none";
  const previewBackground = template.previewBackground ?? template.background;
  const previewHighlightColor = template.highlightColor ?? template.accent;
  const previewBaseImage = previewBackground.includes("gradient(") ? previewBackground : "none";
  const decorationImage =
    !hasDecoration
      ? "none"
      : isDarkCategory
        ? "repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 62px)"
        : "repeating-linear-gradient(90deg, rgba(0,0,0,0.05) 0 1px, transparent 1px 62px), repeating-linear-gradient(180deg, rgba(0,0,0,0.05) 0 1px, transparent 1px 62px)";
  const composedBackgroundImage = [previewBaseImage, decorationImage]
    .filter((layer) => layer && layer !== "none")
    .join(", ");

  return (
    <div
      className={`template-library-preview template-library-preview-${template.id}`}
      style={{
        backgroundColor: template.background,
        backgroundImage: composedBackgroundImage || "none",
        color: template.bodyColor,
        borderColor: template.surface
      }}
    >
      {template.accentMode !== "none" ? (
        <div className="template-library-preview-chip" style={{ backgroundColor: previewHighlightColor }} />
      ) : null}
      {template.id === "cinema" ? (
        <div
          style={{
            width: "58%",
            height: 3,
            borderRadius: 999,
            marginTop: 7,
            backgroundColor: previewHighlightColor
          }}
        />
      ) : null}
      <strong
        className="template-library-preview-title"
        style={{
          color: template.titleColor,
          fontFamily: template.titleFont,
          fontWeight: template.titleWeight ?? 700
        }}
      >
        Заголовок
      </strong>
      <div className="template-library-preview-lines">
        <span style={{ backgroundColor: template.bodyColor }} />
        <span style={{ backgroundColor: template.bodyColor }} />
        <span style={{ backgroundColor: template.bodyColor }} />
      </div>
      <div className="template-library-preview-footer" style={{ color: template.bodyColor }}>
        <span>@username</span>
        {template.accentMode !== "none" ? (
          <strong style={{ color: template.accent }}>→</strong>
        ) : (
          <strong style={{ color: template.bodyColor }}>→</strong>
        )}
      </div>
    </div>
  );
}
