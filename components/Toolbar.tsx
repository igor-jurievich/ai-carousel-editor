"use client";

import { SLIDES_COUNT_OPTIONS } from "@/lib/slides";

type ToolbarProps = {
  topic: string;
  slidesCount: number;
  topicMaxLength: number;
  status: string;
  onTopicChange: (value: string) => void;
  onSlidesCountChange: (value: number) => void;
  useInternetImages: boolean;
  onUseInternetImagesChange: (value: boolean) => void;
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
  useInternetImages,
  onUseInternetImagesChange,
  onGenerate,
  isGenerating,
  disabled = false
}: ToolbarProps) {
  return (
    <header className="prompt-shell">
      <div className="prompt-brand">
        <span className="prompt-eyebrow">Created by: укажите имя профиля</span>
        <h1>Помощник эксперта</h1>
      </div>

      <div className="prompt-composer">
        <textarea
          value={topic}
          onChange={(event) => onTopicChange(event.target.value)}
          placeholder="Введите тему карусели или вставьте готовую идею"
          rows={3}
          maxLength={topicMaxLength}
          title={`Максимум ${topicMaxLength} символов`}
          disabled={disabled}
        />
        <label className="prompt-count-field">
          <span>Карточек</span>
          <select
            value={slidesCount}
            onChange={(event) => onSlidesCountChange(Number(event.target.value))}
            disabled={disabled}
          >
            {SLIDES_COUNT_OPTIONS.map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>
        <label className="prompt-toggle-field">
          <input
            type="checkbox"
            checked={useInternetImages}
            onChange={(event) => onUseInternetImagesChange(event.target.checked)}
            disabled={disabled}
          />
          <span>
            Картинки из интернета
            <small>Автоподбор 1-3 фото по теме</small>
          </span>
        </label>
        <button className="btn" type="button" onClick={onGenerate} disabled={isGenerating || disabled}>
          {isGenerating ? "Генерирую..." : "Сгенерировать"}
        </button>
      </div>

      <div className="prompt-status">{status}</div>
    </header>
  );
}
