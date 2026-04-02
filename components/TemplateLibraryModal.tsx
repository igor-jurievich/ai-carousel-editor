"use client";

import { useEffect, useMemo, useState } from "react";
import { AppIcon } from "@/components/icons";
import { getPrimaryTemplates } from "@/lib/carousel";
import type { CarouselTemplate, CarouselTemplateId } from "@/types/editor";

type TemplateLibraryModalProps = {
  isOpen: boolean;
  activeTemplateId: CarouselTemplateId;
  onApplyTemplate: (templateId: CarouselTemplateId, scope: "all" | "current") => void;
  onClose: () => void;
};

type TemplateCategory = {
  id: CarouselTemplateId;
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
  const templates = useMemo(() => getPrimaryTemplates(), []);
  const [activeCategory, setActiveCategory] = useState<CarouselTemplateId>(activeTemplateId);
  const [applyScope, setApplyScope] = useState<"all" | "current">("all");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setActiveCategory(activeTemplateId);
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

  const visibleTemplates = templates.filter((template) => template.id === activeCategory);

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
  const backgroundImage =
    template.id === "dark"
      ? "repeating-linear-gradient(90deg, rgba(255,255,255,0.11) 0 1px, transparent 1px 62px)"
      : "repeating-linear-gradient(90deg, rgba(23,28,36,0.08) 0 1px, transparent 1px 62px), repeating-linear-gradient(180deg, rgba(23,28,36,0.08) 0 1px, transparent 1px 62px)";

  return (
    <div
      className={`template-library-preview template-library-preview-${template.id}`}
      style={{
        backgroundColor: template.background,
        backgroundImage,
        color: template.bodyColor,
        borderColor: template.surface
      }}
    >
      <div className="template-library-preview-chip" style={{ backgroundColor: template.accent }} />
      <strong
        className="template-library-preview-title"
        style={{ color: template.titleColor, fontFamily: template.titleFont }}
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
        <strong style={{ color: template.accent }}>→</strong>
      </div>
    </div>
  );
}
