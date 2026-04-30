"use client";

import { SLIDES_COUNT_OPTIONS } from "@/lib/slides";
import { AppSelect } from "@/components/AppSelect";

type ToolbarProps = {
  topic: string;
  slidesCount: number;
  topicMaxLength: number;
  status: string;
  onTopicChange: (value: string) => void;
  onSlidesCountChange: (value: number) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  disabled?: boolean;
};

export function Toolbar({
  topic,
  slidesCount,
  topicMaxLength,
  status,
  onTopicChange,
  onSlidesCountChange,
  onGenerate,
  isGenerating,
  disabled = false
}: ToolbarProps) {
  return (
    <header className="prompt-shell">
      <div className="prompt-brand">
        <span className="prompt-eyebrow">AI Carousel Editor</span>
        <h1>Из идеи в готовую карусель</h1>
      </div>

      <div className="prompt-composer">
        <textarea
          value={topic}
          onChange={(event) => onTopicChange(event.target.value)}
          placeholder="Например: «Как эксперту получать заявки через Instagram-карусели»"
          rows={3}
          maxLength={topicMaxLength}
          title={`Максимум ${topicMaxLength} символов`}
          disabled={disabled}
        />
        <div className="prompt-actions">
          <label className="prompt-count-field">
            <span>Карточек</span>
            <AppSelect
              value={String(slidesCount)}
              onValueChange={(value) => onSlidesCountChange(Number(value))}
              disabled={disabled}
              ariaLabel="Количество карточек"
              triggerClassName="prompt-count-select"
              options={SLIDES_COUNT_OPTIONS.map((count) => ({
                value: String(count),
                label: String(count)
              }))}
            />
          </label>
          <button
            className="btn prompt-generate-btn"
            type="button"
            onClick={onGenerate}
            disabled={isGenerating || disabled}
          >
            {isGenerating ? "Генерирую..." : "Сгенерировать"}
          </button>
        </div>
      </div>

      <div className="prompt-status">{status}</div>
    </header>
  );
}
