"use client";

import { useEffect } from "react";
import { AppIcon } from "@/components/icons";
import type { Slide, TextElement } from "@/types/editor";

type SlideExportModalProps = {
  isOpen: boolean;
  slides: Slide[];
  selectedSlideIds: string[];
  exportModeLabel: string;
  onToggleSlide: (slideId: string) => void;
  onToggleAll: () => void;
  onConfirm: () => void;
  onClose: () => void;
};

export function SlideExportModal({
  isOpen,
  slides,
  selectedSlideIds,
  exportModeLabel,
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
          <label className="slide-export-all-toggle">
            <input type="checkbox" checked={isAllSelected} onChange={onToggleAll} />
            <span>Все слайды ({slides.length})</span>
          </label>

          <div className="slide-export-list">
            {slides.map((slide, index) => {
              const isSelected = selectedSlideIds.includes(slide.id);
              const preview = getSlidePreview(slide);

              return (
                <label
                  key={slide.id}
                  className={`slide-export-item ${isSelected ? "selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSlide(slide.id)}
                  />
                  <div className="slide-export-item-copy">
                    <strong>Слайд {index + 1}</strong>
                    <span>{preview}</span>
                  </div>
                </label>
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
