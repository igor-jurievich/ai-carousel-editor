"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSlidesFromOutline, projectTitleFromTopic } from "@/lib/carousel";
import { clampSlidesCount, DEFAULT_SLIDES_COUNT, SLIDES_COUNT_OPTIONS } from "@/lib/slides";
import { saveLocalProject } from "@/lib/projects";
import { trackEvent } from "@/lib/telemetry";
import type { CarouselOutlineSlide, CarouselTemplateId, SlideFormat } from "@/types/editor";

type GenerateResponse = {
  slides?: CarouselOutlineSlide[];
  project?: {
    title?: string;
    topic?: string;
    format?: SlideFormat;
    theme?: CarouselTemplateId;
    promptVariant?: "A" | "B";
    language?: "ru";
    version?: number;
  };
  error?: string;
};

const MAX_TOPIC_CHARS = 4000;
const PRESET_TOPICS = [
  "Лайки есть — заявок нет: почему и что изменить",
  "3 ошибки эксперта в карусели, из-за которых не дочитывают",
  "Как упаковать кейс в 9 слайдов без воды",
  "Ответы на частые возражения в нише услуг"
];

export default function GeneratePage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [slidesCount, setSlidesCount] = useState(DEFAULT_SLIDES_COUNT);
  const [format, setFormat] = useState<SlideFormat>("1:1");
  const [theme, setTheme] = useState<CarouselTemplateId>("light");
  const [niche, setNiche] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("balanced");
  const [goal, setGoal] = useState("engagement");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewSlides, setPreviewSlides] = useState<CarouselOutlineSlide[] | null>(null);
  const [generatedProjectMeta, setGeneratedProjectMeta] = useState<GenerateResponse["project"] | null>(null);

  const normalizedTopic = topic.trim();
  const canGenerate = normalizedTopic.length >= 3 && !isGenerating;

  const previewList = useMemo(() => {
    if (!previewSlides?.length) {
      return [] as Array<{ type: string; title: string }>;
    }

    return previewSlides.map((slide) => {
      if ("title" in slide && slide.title) {
        return { type: slide.type, title: slide.title };
      }

      if ("before" in slide && slide.before) {
        return { type: slide.type, title: slide.before };
      }

      if ("bullets" in slide && slide.bullets?.[0]) {
        return { type: slide.type, title: slide.bullets[0] };
      }

      return { type: slide.type, title: "Слайд без заголовка" };
    });
  }, [previewSlides]);

  const handleGenerate = async () => {
    if (!canGenerate) {
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);
      trackEvent({
        name: "generate_started",
        payload: {
          source: "generate_page",
          format,
          slidesCount: clampSlidesCount(slidesCount),
          theme
        }
      });

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          topic: normalizedTopic,
          slidesCount: clampSlidesCount(slidesCount),
          niche,
          audience,
          tone,
          goal,
          format,
          theme
        })
      });

      const data = (await response.json()) as GenerateResponse;
      if (!response.ok || !data.slides?.length) {
        throw new Error(data.error || "Не удалось сгенерировать карусель.");
      }

      setPreviewSlides(data.slides);
      setGeneratedProjectMeta(data.project ?? null);
      trackEvent({
        name: "generate_succeeded",
        payload: {
          source: "generate_page",
          format: data.project?.format ?? format,
          slidesCount: data.slides.length,
          theme: data.project?.theme ?? theme,
          promptVariant: data.project?.promptVariant ?? "B"
        }
      });
    } catch (generationError) {
      trackEvent({
        name: "generate_failed",
        payload: {
          source: "generate_page",
          format,
          reason:
            generationError instanceof Error ? generationError.message.slice(0, 120) : "unknown"
        }
      });
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Не смогли сгенерировать. Попробуйте переформулировать тему."
      );
      setPreviewSlides(null);
      setGeneratedProjectMeta(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenInEditor = () => {
    if (!previewSlides?.length) {
      return;
    }

    const resolvedFormat = generatedProjectMeta?.format ?? format;
    const resolvedTheme = generatedProjectMeta?.theme ?? theme;
    const slides = createSlidesFromOutline(
      previewSlides,
      resolvedTheme,
      resolvedFormat,
      clampSlidesCount(slidesCount)
    );

    const saved = saveLocalProject({
      title: generatedProjectMeta?.title || projectTitleFromTopic(normalizedTopic),
      topic: generatedProjectMeta?.topic || normalizedTopic,
      slides,
      format: resolvedFormat,
      theme: resolvedTheme,
      promptVariant: generatedProjectMeta?.promptVariant ?? "B",
      niche: niche.trim() || undefined,
      audience: audience.trim() || undefined,
      tone,
      goal,
      language: "ru",
      schemaVersion: 1
    });

    trackEvent({
      name: "editor_opened",
      payload: {
        source: "generate_page",
        projectId: saved.id,
        format: resolvedFormat
      }
    });

    router.push(`/editor/${saved.id}`);
  };

  return (
    <main className="page-shell">
      <div className="editor-shell editor-shell-redesigned">
        <header className="prompt-shell">
          <div className="prompt-brand">
            <span className="prompt-eyebrow">AI Carousel Editor</span>
            <h1>Сгенерируйте карусель за 30–90 секунд</h1>
          </div>

          <div className="prompt-composer">
            <textarea
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="Например: «Почему посты не дают заявок» или «Как эксперту поднять чек»"
              rows={4}
              maxLength={MAX_TOPIC_CHARS}
            />
            <div className="field-row" style={{ gap: 8, flexWrap: "wrap" }}>
              {PRESET_TOPICS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="ghost-chip"
                  onClick={() => setTopic(preset)}
                  disabled={isGenerating}
                >
                  {preset}
                </button>
              ))}
            </div>

            <details className="settings-card generate-advanced" style={{ marginTop: 12 }}>
              <summary className="generate-advanced-summary">Дополнительные настройки</summary>
              <div className="generate-advanced-grid">
                <label className="field-label generate-advanced-field">
                  Ниша
                  <input className="field" value={niche} onChange={(event) => setNiche(event.target.value)} />
                </label>
                <label className="field-label generate-advanced-field">
                  Целевая аудитория
                  <input
                    className="field"
                    value={audience}
                    onChange={(event) => setAudience(event.target.value)}
                  />
                </label>
                <label className="field-label generate-advanced-field">
                  Тон
                  <select className="field" value={tone} onChange={(event) => setTone(event.target.value)}>
                    <option value="soft">Мягкий</option>
                    <option value="balanced">Сбалансированный</option>
                    <option value="sharp">Острый</option>
                  </select>
                </label>
                <label className="field-label generate-advanced-field">
                  Цель
                  <select className="field" value={goal} onChange={(event) => setGoal(event.target.value)}>
                    <option value="engagement">Вовлечение</option>
                    <option value="leads">Заявки</option>
                    <option value="warming">Прогрев</option>
                  </select>
                </label>
                <label className="field-label generate-advanced-field">
                  Формат
                  <select
                    className="field"
                    value={format}
                    onChange={(event) => setFormat(event.target.value as SlideFormat)}
                  >
                    <option value="1:1">1:1</option>
                    <option value="4:5">4:5</option>
                    <option value="9:16">9:16</option>
                  </select>
                </label>
                <label className="field-label generate-advanced-field">
                  Тема
                  <select
                    className="field"
                    value={theme}
                    onChange={(event) => setTheme(event.target.value as CarouselTemplateId)}
                  >
                    <option value="light">Светлая</option>
                    <option value="dark">Тёмная</option>
                    <option value="color">Цветная</option>
                  </select>
                </label>
                <label className="field-label generate-advanced-field">
                  Количество карточек
                  <select
                    className="field"
                    value={slidesCount}
                    onChange={(event) => setSlidesCount(clampSlidesCount(Number(event.target.value)))}
                  >
                    {SLIDES_COUNT_OPTIONS.map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </details>

            <div className="prompt-actions" style={{ marginTop: 14 }}>
              <button className="btn prompt-generate-btn" type="button" onClick={handleGenerate} disabled={!canGenerate}>
                {isGenerating ? "Генерируем..." : "Сгенерировать карусель"}
              </button>
            </div>
          </div>

          <div className="prompt-status">
            {error ? error : "Сначала сгенерируйте карусель, затем откройте проект в редакторе."}
          </div>
        </header>

        {previewList.length ? (
          <section className="settings-card" style={{ marginTop: 16 }}>
            <div className="settings-inline-head">
              <h3>Предпросмотр структуры</h3>
              <span className="status-pill">{previewList.length} слайдов</span>
            </div>
            <div className="slides-list slides-list-compact">
              {previewList.map((item, index) => (
                <div key={`${item.type}-${index}`} className="slides-list-row">
                  <div className="slides-list-item active" style={{ cursor: "default" }}>
                    <span className="slides-list-index">{index + 1}</span>
                    <span className="slides-list-copy">
                      <strong>{item.title}</strong>
                      <span>{item.type}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="field-row" style={{ marginTop: 14 }}>
              <button type="button" className="btn" onClick={handleOpenInEditor}>
                Открыть в редакторе
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
