"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSlidesFromOutline, projectTitleFromTopic } from "@/lib/carousel";
import { clampSlidesCount, DEFAULT_SLIDES_COUNT, SLIDES_COUNT_OPTIONS } from "@/lib/slides";
import { saveLocalProject } from "@/lib/projects";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { trackEvent } from "@/lib/telemetry";
import type { CarouselOutlineSlide, CarouselTemplateId, SlideFormat } from "@/types/editor";
import styles from "./generate-page.module.css";

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
  message?: string;
  remainingCredits?: number;
  error?: string;
};

type ProfileCreditsResponse = {
  name?: string | null;
  credits?: number;
  error?: string;
};

const MAX_TOPIC_CHARS = 4000;

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
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [accountName, setAccountName] = useState("Пользователь");
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [isNoCreditsNoticeOpen, setIsNoCreditsNoticeOpen] = useState(false);

  const composerRef = useRef<HTMLDivElement | null>(null);
  const topicInputRef = useRef<HTMLTextAreaElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const input = topicInputRef.current;
    if (!input) {
      return;
    }

    input.style.height = "0px";
    input.style.height = `${Math.min(220, Math.max(80, input.scrollHeight))}px`;
  }, [topic]);

  useEffect(() => {
    if (!isAdvancedOpen) {
      return;
    }

    const handleOutsidePointer = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) {
        return;
      }
      if (!composerRef.current?.contains(event.target)) {
        setIsAdvancedOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAdvancedOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleOutsidePointer);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isAdvancedOpen]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    let isActive = true;

    const loadAccount = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!isActive || !user) {
        return;
      }

      const fallbackName =
        typeof user.user_metadata?.name === "string" && user.user_metadata.name.trim()
          ? user.user_metadata.name.trim()
          : typeof user.user_metadata?.login === "string" && user.user_metadata.login.trim()
            ? user.user_metadata.login.trim()
            : "Пользователь";
      setAccountName(fallbackName);

      const profileResponse = await fetch("/api/generate", {
        method: "GET",
        cache: "no-store"
      });

      const profileData = (await profileResponse.json()) as ProfileCreditsResponse;

      if (!isActive) {
        return;
      }

      if (profileResponse.ok && typeof profileData.name === "string" && profileData.name.trim()) {
        setAccountName(profileData.name.trim());
      }

      if (profileResponse.ok && typeof profileData.credits === "number" && Number.isFinite(profileData.credits)) {
        setCredits(Math.max(0, Math.trunc(profileData.credits)));
      }
    };

    void loadAccount();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return;
    }

    const handleOutsidePointer = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) {
        return;
      }
      if (!accountMenuRef.current?.contains(event.target)) {
        setIsAccountMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAccountMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleOutsidePointer);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isAccountMenuOpen]);

  const handleGenerate = async () => {
    if (!canGenerate) {
      return;
    }

    try {
      setIsAdvancedOpen(false);
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
      if (!response.ok) {
        if (response.status === 403 && data.error === "no_credits") {
          setCredits(0);
          setIsNoCreditsNoticeOpen(true);
          setError(null);
          return;
        }

        throw new Error(data.error || "Не удалось сгенерировать карусель.");
      }

      if (!data.slides?.length) {
        throw new Error(data.error || "Не удалось сгенерировать карусель.");
      }

      setPreviewSlides(data.slides);
      setGeneratedProjectMeta(data.project ?? null);
      if (typeof data.remainingCredits === "number" && Number.isFinite(data.remainingCredits)) {
        setCredits(Math.max(0, Math.trunc(data.remainingCredits)));
      } else {
        setCredits((current) =>
          typeof current === "number" ? Math.max(0, current - 1) : current
        );
      }
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

  const handleOpenInEditor = (tool?: "post") => {
    if (!previewSlides?.length) {
      return;
    }

    try {
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
          format: resolvedFormat,
          requestedTool: tool ?? "none"
        }
      });

      const targetUrl =
        tool === "post" ? `/editor/${saved.id}?tool=post&from=generate` : `/editor/${saved.id}`;
      router.push(targetUrl);

      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          if (window.location.pathname === "/generate") {
            window.location.assign(targetUrl);
          }
        }, 450);
      }
    } catch (openEditorError) {
      const message =
        openEditorError instanceof Error
          ? openEditorError.message
          : "Не удалось открыть редактор. Проверьте хранилище браузера и попробуйте снова.";
      setError(message);
      trackEvent({
        name: "editor_open_failed",
        payload: {
          source: "generate_page",
          requestedTool: tool ?? "none",
          reason: message.slice(0, 120)
        }
      });
    }
  };

  const handleSignOut = async () => {
    setIsAccountMenuOpen(false);

    try {
      const supabase = getSupabaseBrowserClient();
      await supabase?.auth.signOut();
    } catch {
      // Ignore sign-out API failures and still route to login.
    }

    router.replace("/login");
    router.refresh();
  };

  const accountInitial = (accountName.trim().charAt(0) || "P").toUpperCase();
  const hasNoCredits = typeof credits === "number" && credits <= 0;
  const creditsLabel = typeof credits === "number" ? credits : "...";

  return (
    <main className={`page-shell ${styles.page}`}>
      <div className={`${styles.layout} ${previewList.length ? styles.layoutWithPreview : styles.layoutStart}`}>
        <header className={styles.hero}>
          <div className={styles.heroTop}>
            <div className={styles.accountControls}>
              <span className={`${styles.creditsBadge} ${hasNoCredits ? styles.creditsBadgeZero : ""}`}>
                ⚡ {creditsLabel}
              </span>

              <div className={styles.accountMenu} ref={accountMenuRef}>
                <button
                  className={styles.accountAvatar}
                  type="button"
                  onClick={() => setIsAccountMenuOpen((current) => !current)}
                  aria-expanded={isAccountMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Меню аккаунта"
                >
                  {accountInitial}
                </button>

                {isAccountMenuOpen ? (
                  <div className={styles.accountDropdown} role="menu">
                    <p className={styles.accountGreeting}>Привет, {accountName}!</p>
                    <div className={styles.accountDivider} />
                    <button
                      type="button"
                      className={styles.accountSignOut}
                      onClick={() => void handleSignOut()}
                    >
                      Выйти
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            <h1 className={styles.heroTitle}>Один промпт. Готовая карусель.</h1>
            <p className={styles.heroSubtitle}>Опиши тему одним сообщением — AI соберёт слайды, хук и структуру.</p>
          </div>

          <div className={styles.chatComposer} ref={composerRef}>
            <div className={styles.chatBar}>
              <button
                type="button"
                className={`${styles.plusButton} ${isAdvancedOpen ? styles.plusButtonActive : ""}`}
                onClick={() => setIsAdvancedOpen((current) => !current)}
                aria-expanded={isAdvancedOpen}
                aria-label="Уточнить генерацию"
                title="Уточнить генерацию"
              >
                +
              </button>

              <textarea
                ref={topicInputRef}
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleGenerate();
                  }
                }}
                placeholder="Например: 5 ошибок в рекламе недвижимости которые сжигают бюджет..."
                rows={1}
                maxLength={MAX_TOPIC_CHARS}
                className={styles.chatInput}
              />

              <button
                className={styles.sendButton}
                type="button"
                onClick={() => void handleGenerate()}
                disabled={!canGenerate}
                aria-label={isGenerating ? "Генерируем" : "Сгенерировать карусель"}
                title={isGenerating ? "Генерируем..." : "Сгенерировать карусель"}
              >
                {isGenerating ? "…" : "→"}
              </button>
            </div>

            {isAdvancedOpen ? (
              <section className={styles.advancedPopover} aria-label="Уточнение генерации">
                <div className={styles.advancedHead}>Настройки</div>
                <div className={styles.advancedGrid}>
                  <label className={styles.fieldLabel}>
                    🎯 Ниша
                    <input
                      className={styles.field}
                      value={niche}
                      onChange={(event) => setNiche(event.target.value)}
                      placeholder="Например: недвижимость, фитнес, образование"
                    />
                  </label>
                  <label className={styles.fieldLabel}>
                    👥 Целевая аудитория
                    <input
                      className={styles.field}
                      value={audience}
                      onChange={(event) => setAudience(event.target.value)}
                      placeholder="Например: собственники 25–40, эксперты, маркетологи"
                    />
                  </label>
                  <label className={styles.fieldLabel}>
                    🎨 Тон
                    <select
                      className={styles.field}
                      value={tone}
                      onChange={(event) => setTone(event.target.value)}
                    >
                      <option value="soft">Мягкий</option>
                      <option value="balanced">Сбалансированный</option>
                      <option value="sharp">Острый</option>
                    </select>
                  </label>
                  <label className={styles.fieldLabel}>
                    🚀 Цель
                    <select
                      className={styles.field}
                      value={goal}
                      onChange={(event) => setGoal(event.target.value)}
                    >
                      <option value="engagement">Вовлечение</option>
                      <option value="leads">Заявки</option>
                      <option value="warming">Прогрев</option>
                    </select>
                  </label>
                  <label className={styles.fieldLabel}>
                    📐 Формат
                    <select
                      className={styles.field}
                      value={format}
                      onChange={(event) => setFormat(event.target.value as SlideFormat)}
                    >
                      <option value="1:1">1:1</option>
                      <option value="4:5">4:5</option>
                      <option value="9:16">9:16</option>
                    </select>
                  </label>
                  <label className={styles.fieldLabel}>
                    🌗 Тема
                    <select
                      className={styles.field}
                      value={theme}
                      onChange={(event) => setTheme(event.target.value as CarouselTemplateId)}
                    >
                      <option value="light">Светлая</option>
                      <option value="dark">Тёмная</option>
                      <option value="color">Цветная</option>
                    </select>
                  </label>
                  <label className={styles.fieldLabel}>
                    🧩 Количество карточек
                    <select
                      className={styles.field}
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
              </section>
            ) : null}
          </div>

          {error ? <div className={`${styles.status} ${styles.statusError}`}>{error}</div> : null}
        </header>

        {previewList.length ? (
          <section className={styles.previewCard}>
            <div className={styles.previewHead}>
              <h3>Предпросмотр структуры</h3>
              <span className={styles.previewCount}>{previewList.length} слайдов</span>
            </div>

            <div className={styles.previewList}>
              {previewList.map((item, index) => (
                <div key={`${item.type}-${index}`} className={styles.previewItem}>
                  <span className={styles.previewIndex}>{index + 1}</span>
                  <span className={styles.previewCopy}>
                    <strong>{item.title}</strong>
                    <span>{item.type}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className={styles.previewActions}>
              <button type="button" className={styles.primaryAction} onClick={() => handleOpenInEditor()}>
                Открыть в редакторе
              </button>
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={() => handleOpenInEditor("post")}
              >
                Открыть + пост
              </button>
            </div>

            <div className={styles.previewHint}>
              На мобильной версии генерация подписи к карусели находится во вкладке «Пост» внутри
              редактора.
            </div>
          </section>
        ) : null}

        <p className={styles.signature}>pastello.io — AI carousel generator</p>
      </div>

      {isNoCreditsNoticeOpen ? (
        <div className={styles.noticeOverlay} role="dialog" aria-modal="true" aria-label="Закончились баллы">
          <div className={styles.noticeCard}>
            <p className={styles.noticeText}>
              У тебя закончились баллы ⚡
              <br />
              Скоро здесь появится возможность пополнить.
              <br />
              А пока — напиши нам: @igor_jurievich_01
            </p>
            <button
              type="button"
              className={styles.noticeButton}
              onClick={() => setIsNoCreditsNoticeOpen(false)}
            >
              Понятно
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
