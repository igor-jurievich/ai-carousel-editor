"use client";

import type { Slide } from "@/types/editor";

type SlidesPanelProps = {
  slides: Slide[];
  activeSlideId: string;
  onSelectSlide: (slideId: string) => void;
  onAddSlide: () => void;
  onReorderSlides: (fromId: string, toId: string) => void;
};

export function SlidesPanel({
  slides,
  activeSlideId,
  onSelectSlide,
  onAddSlide,
  onReorderSlides
}: SlidesPanelProps) {
  return (
    <section className="settings-card">
      <div className="settings-card-header">
        <h3>Слайды</h3>
        <button className="ghost-chip" type="button" onClick={onAddSlide}>
          + Добавить
        </button>
      </div>

      <div className="slides-list">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            draggable
            className={`slides-list-item ${slide.id === activeSlideId ? "active" : ""}`}
            onClick={() => onSelectSlide(slide.id)}
            onDragStart={(event) => {
              event.dataTransfer.setData("text/plain", slide.id);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const draggedId = event.dataTransfer.getData("text/plain");

              if (draggedId && draggedId !== slide.id) {
                onReorderSlides(draggedId, slide.id);
              }
            }}
          >
            <span className="slides-list-index">{index + 1}</span>
            <span className="slides-list-copy">
              <strong>{slide.name}</strong>
              <span>{slide.templateId ?? "custom"}</span>
            </span>
            <span className="slides-list-arrow">›</span>
          </button>
        ))}
      </div>
    </section>
  );
}
