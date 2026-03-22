"use client";

import { useEffect, useMemo, useState } from "react";
import { AppIcon } from "@/components/icons";
import { getPrimaryTemplates } from "@/lib/carousel";
import type { CarouselTemplate, CarouselTemplateId } from "@/types/editor";

type TemplateLibraryModalProps = {
  isOpen: boolean;
  activeTemplateId: CarouselTemplateId;
  onApplyTemplate: (templateId: CarouselTemplateId) => void;
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
  const [expandedCategory, setExpandedCategory] = useState<CarouselTemplateId>(activeTemplateId);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setExpandedCategory(activeTemplateId);
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
          <h3>Выбор шаблона</h3>
          <button
            type="button"
            className="editor-modal-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <AppIcon name="close" size={16} />
          </button>
        </header>

        <div className="editor-modal-content template-library-content">
          {TEMPLATE_CATEGORIES.map((category) => {
            const isExpanded = expandedCategory === category.id;
            const template =
              templates.find((item) => item.id === category.id) ?? templates[0];

            return (
              <section key={category.id} className="template-library-section">
                <button
                  type="button"
                  className={`template-library-section-toggle ${isExpanded ? "is-expanded" : ""}`}
                  onClick={() =>
                    setExpandedCategory((current) =>
                      current === category.id ? activeTemplateId : category.id
                    )
                  }
                >
                  <span>{category.title}</span>
                  <span className="template-library-section-arrow">
                    <AppIcon name="chevron-right" size={16} />
                  </span>
                </button>

                {isExpanded ? (
                  <div className="template-library-grid">
                    <button
                      type="button"
                      className={`template-library-card ${
                        activeTemplateId === template.id ? "active" : ""
                      }`}
                      onClick={() => {
                        onApplyTemplate(template.id);
                        onClose();
                      }}
                    >
                      <TemplatePreview template={template} />
                      <div className="template-library-card-meta">
                        <strong>{template.name}</strong>
                        <span>{template.preview ?? template.description}</span>
                      </div>
                    </button>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function TemplatePreview({ template }: { template: CarouselTemplate }) {
  return (
    <div
      className="template-library-preview"
      style={{
        backgroundColor: template.background,
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
