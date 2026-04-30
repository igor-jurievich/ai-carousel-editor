"use client";

import { useEffect } from "react";
import * as Switch from "@radix-ui/react-switch";
import { AppSelect } from "@/components/AppSelect";
import { AppIcon } from "@/components/icons";
import type { Slide, TextElement } from "@/types/editor";

type SlideExportModalProps = {
  isOpen: boolean;
  slides: Slide[];
  selectedSlideIds: string[];
  exportMode: "zip" | "png" | "jpg" | "pdf";
  exportModeLabel: string;
  onExportModeChange: (mode: "zip" | "png" | "jpg" | "pdf") => void;
  onToggleSlide: (slideId: string) => void;
  onToggleAll: () => void;
  onConfirm: () => void;
  onClose: () => void;
};

export function SlideExportModal({
  isOpen,
  slides,
  selectedSlideIds,
  exportMode,
  exportModeLabel,
  onExportModeChange,
  onToggleSlide,
  onToggleAll,
  onConfirm,
  onClose
}: SlideExportModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const isAllSelected = slides.length > 0 && selectedSlideIds.length === slides.length;

  return (
    <div className="editor-modal-overlay" onClick={onClose} role="presentation">
      <section
        className="editor-modal slide-export-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Выбор слайдов для экспорта"
      >
        <header className="editor-modal-header">
          <h3>Выбор слайдов</h3>
          <button
            type="button"
            className="editor-modal-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <AppIcon name="close" size={16} />
          </button>
        </header>

        <div className="editor-modal-content slide-export-content">
          <div className="slide-export-mode-row">
            <span>Формат</span>
            <AppSelect
              value={exportMode}
              onValueChange={(value) => onExportModeChange(value as "zip" | "png" | "jpg" | "pdf")}
              ariaLabel="Формат экспорта"
              triggerClassName="select slide-export-mode-select"
              options={[
                { value: "zip", label: "ZIP (PNG)" },
                { value: "png", label: "PNG" },
                { value: "jpg", label: "JPG" },
                { value: "pdf", label: "PDF" }
              ]}
            />
          </div>

          <div className="slide-export-all-toggle">
            <span>Все слайды ({slides.length})</span>
            <Switch.Root
              className="slide-export-switch-root"
              checked={isAllSelected}
              onCheckedChange={() => onToggleAll()}
              aria-label="Выбрать все слайды"
            >
              <Switch.Thumb className="slide-export-switch-thumb" />
            </Switch.Root>
          </div>

          <div className="slide-export-list">
            {slides.map((slide, index) => {
              const isSelected = selectedSlideIds.includes(slide.id);
              const preview = getSlidePreview(slide);

              return (
                <div
                  key={slide.id}
                  className={`slide-export-item ${isSelected ? "selected" : ""}`}
                >
                  <div className="slide-export-item-copy">
                    <strong>Слайд {index + 1}</strong>
                    <span>{preview}</span>
                  </div>
                  <Switch.Root
                    className="slide-export-switch-root"
                    checked={isSelected}
                    onCheckedChange={() => onToggleSlide(slide.id)}
                    aria-label={`Выбрать слайд ${index + 1}`}
                  >
                    <Switch.Thumb className="slide-export-switch-thumb" />
                  </Switch.Root>
                </div>
              );
            })}
          </div>
        </div>

        <footer className="editor-modal-footer">
          <button type="button" className="modal-secondary-btn" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="modal-primary-btn"
            onClick={onConfirm}
            disabled={selectedSlideIds.length === 0}
          >
            Экспорт {exportModeLabel} ({selectedSlideIds.length})
          </button>
        </footer>
      </section>
    </div>
  );
}

function getSlidePreview(slide: Slide) {
  const titleLike = slide.elements.find(
    (element): element is TextElement =>
      element.type === "text" && (element.role === "title" || element.role === "body")
  );

  if (!titleLike?.text) {
    return "Без текста";
  }

  const normalized = titleLike.text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Без текста";
  }

  const words = normalized.split(" ");
  if (words.length <= 7) {
    return normalized;
  }

  return `${words.slice(0, 7).join(" ")}...`;
}
