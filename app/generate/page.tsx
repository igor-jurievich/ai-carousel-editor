"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Hash,
  Info,
  LayoutGrid,
  Palette,
  Rocket,
  SunMoon,
  Target,
  Users,
  Zap
} from "lucide-react";
import { toast } from "sonner";
import { createSlidesFromOutline, projectTitleFromTopic } from "@/lib/carousel";
import { clampSlidesCount, DEFAULT_SLIDES_COUNT, SLIDES_COUNT_OPTIONS } from "@/lib/slides";
import { saveLocalProject } from "@/lib/projects";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { trackEvent } from "@/lib/telemetry";
import type { CarouselOutlineSlide, CarouselTemplateId, SlideFormat } from "@/types/editor";
import styles from "./generate-page.module.css";

type GenerateResponse = {
  slides?: CarouselOutlineSlide[];
  generationSource?: "model" | "fallback";
  fallbackReason?: "quota" | "error" | "timeout";
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

type SelectOption = {
  value: string;
  label: string;
};

const MAX_TOPIC_CHARS = 4000;

const TONE_OPTIONS: SelectOption[] = [
  { value: "soft", label: "Мягкий" },
  { value: "balanced", label: "Сбалансированный" },
  { value: "sharp", label: "Острый" }
];

const GOAL_OPTIONS: SelectOption[] = [
  { value: "engagement", label: "Вовлечение" },
  { value: "leads", label: "Заявки" },
  { value: "warming", label: "Прогрев" }
];

const FORMAT_OPTIONS: SelectOption[] = [
  { value: "1:1", label: "1:1" },
  { value: "4:5", label: "4:5" },
  { value: "9:16", label: "9:16" }
];

const THEME_OPTIONS: SelectOption[] = [
  { value: "light", label: "Светлая" },
  { value: "dark", label: "Тёмная" },
  { value: "color", label: "Цветная" }
];

const ROLE_LABELS: Record<string, string> = {
  hook: "Крючок",
  problem: "Проблема",
  amplify: "Усиление",
  mistake: "Ошибка",
  consequence: "Последствие",
  shift: "Поворот",
  solution: "Решение",
  example: "Пример",
  cta: "Призыв"
};

type GenerateSelectFieldProps = {
  className?: string;
  icon: ReactNode;
  id: string;
  isOpen: boolean;
  label: string;
  onChange: (nextValue: string) => void;
  onClose: () => void;
  onToggle: (fieldId: string) => void;
  options: SelectOption[];
  value: string;
};

function GenerateSelectField({
  className,
  icon,
  id,
  isOpen,
  label,
  onChange,
  onClose,
  onToggle,
  options,
  value
}: GenerateSelectFieldProps) {
  const selectedOption = options.find((option) => option.value === value);
  const rootClassName = [styles.fieldLabel, className].filter(Boolean).join(" ");

  return (
    <div className={rootClassName}>
      <span className={styles.fieldLabelText}>
        <span className={styles.fieldLabelIcon} aria-hidden="true">
          {icon}
        </span>
        <span>{label}</span>
      </span>

      <div
        className={styles.selectRoot}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            onClose();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
      >
        <button
          type="button"
          className={styles.selectTrigger}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          onClick={() => onToggle(id)}
        >
          <span>{selectedOption?.label ?? value}</span>
          <ChevronDown
            size={16}
            className={`${styles.selectChevron} ${isOpen ? styles.selectChevronOpen : ""}`}
            aria-hidden="true"
          />
        </button>

        <div
          className={`${styles.selectDropdown} ${isOpen ? styles.selectDropdownOpen : ""}`}
          role="listbox"
          aria-hidden={!isOpen}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`${styles.selectOption} ${isSelected ? styles.selectOptionSelected : ""}`}
                onClick={() => {
                  onChange(option.value);
                  onClose();
                }}
              >
                <span>{option.label}</span>
                {isSelected ? <Check size={14} className={styles.selectOptionCheck} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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
  const [openSelectId, setOpenSelectId] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("Пользователь");
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [isNoCreditsNoticeOpen, setIsNoCreditsNoticeOpen] = useState(false);

  const composerRef = useRef<HTMLDivElement | null>(null);
  const topicInputRef = useRef<HTMLTextAreaElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const slidesCountOptions = useMemo<SelectOption[]>(
    () => SLIDES_COUNT_OPTIONS.map((count) => ({ value: String(count), label: String(count) })),
    []
  );

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
        setOpenSelectId(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAdvancedOpen(false);
        setOpenSelectId(null);
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
    if (!isAdvancedOpen) {
      setOpenSelectId(null);
    }
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
      setOpenSelectId(null);
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
      if (data.generationSource === "fallback") {
        console.warn("[generate] Deterministic fallback was used.", {
          reason: data.fallbackReason ?? "error"
        });
      }
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
      toast.error("Не удалось сгенерировать");
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
  const isCreditsLoading = typeof credits !== "number";

  return (
    <main className={`page-shell ${styles.page}`}>
      <header className={styles.stickyHeader}>
        <div className={styles.headerInner}>
          <span className={styles.logo}>pastello.io</span>

          <div className={styles.headerControls}>
            <span
              className={`pill-badge pill-badge-primary ${styles.creditsBadge} ${hasNoCredits ? styles.creditsBadgeZero : ""}`}
            >
              <Zap size={14} aria-hidden="true" />
              {isCreditsLoading ? (
                <span className={styles.creditsSkeleton} aria-hidden="true" />
              ) : (
                <span>{credits}</span>
              )}
            </span>

            <div className={styles.accountMenu} ref={accountMenuRef}>
              <button
                className={`${styles.accountAvatar} tap-feedback`}
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
        </div>
      </header>

      <div className={`${styles.layout} ${previewList.length ? styles.layoutWithPreview : styles.layoutStart}`}>
        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <h1 className={styles.heroTitle}>Один промпт. Готовая карусель.</h1>
            <p className={styles.heroSubtitle}>Опиши тему одним сообщением — AI соберёт слайды, хук и структуру.</p>
          </div>

          <div className={styles.chatComposer} ref={composerRef}>
            <div className={styles.chatBar}>
              <button
                type="button"
                className={`${styles.plusButton} ${isAdvancedOpen ? styles.plusButtonActive : ""}`}
                onClick={() =>
                  setIsAdvancedOpen((current) => {
                    const nextState = !current;
                    if (!nextState) {
                      setOpenSelectId(null);
                    }
                    return nextState;
                  })
                }
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

            <section
              className={`${styles.advancedPanel} ${isAdvancedOpen ? styles.advancedPanelOpen : ""}`}
              aria-label="Уточнение генерации"
              aria-hidden={!isAdvancedOpen}
            >
              <div className={styles.advancedGrid}>
                <label className={`${styles.fieldLabel} ${styles.fieldNiche}`}>
                  <span className={styles.fieldLabelText}>
                    <Target size={14} className={styles.fieldLabelIcon} aria-hidden="true" />
                    <span>Ниша</span>
                  </span>
                  <input
                    className={styles.field}
                    value={niche}
                    onChange={(event) => setNiche(event.target.value)}
                    placeholder="Например: недвижимость, фитнес, образование"
                  />
                </label>

                <label className={`${styles.fieldLabel} ${styles.fieldAudience}`}>
                  <span className={styles.fieldLabelText}>
                    <Users size={14} className={styles.fieldLabelIcon} aria-hidden="true" />
                    <span>Целевая аудитория</span>
                  </span>
                  <input
                    className={styles.field}
                    value={audience}
                    onChange={(event) => setAudience(event.target.value)}
                    placeholder="Например: собственники 25–40, эксперты, маркетологи"
                  />
                </label>

                <GenerateSelectField
                  className={styles.fieldTone}
                  icon={<Palette size={14} />}
                  id="tone"
                  isOpen={openSelectId === "tone"}
                  label="Тон"
                  onChange={setTone}
                  onClose={() => setOpenSelectId(null)}
                  onToggle={(fieldId) => setOpenSelectId((current) => (current === fieldId ? null : fieldId))}
                  options={TONE_OPTIONS}
                  value={tone}
                />

                <GenerateSelectField
                  className={styles.fieldGoal}
                  icon={<Rocket size={14} />}
                  id="goal"
                  isOpen={openSelectId === "goal"}
                  label="Цель"
                  onChange={setGoal}
                  onClose={() => setOpenSelectId(null)}
                  onToggle={(fieldId) => setOpenSelectId((current) => (current === fieldId ? null : fieldId))}
                  options={GOAL_OPTIONS}
                  value={goal}
                />

                <GenerateSelectField
                  className={styles.fieldFormat}
                  icon={<LayoutGrid size={14} />}
                  id="format"
                  isOpen={openSelectId === "format"}
                  label="Формат"
                  onChange={(nextValue) => setFormat(nextValue as SlideFormat)}
                  onClose={() => setOpenSelectId(null)}
                  onToggle={(fieldId) => setOpenSelectId((current) => (current === fieldId ? null : fieldId))}
                  options={FORMAT_OPTIONS}
                  value={format}
                />

                <GenerateSelectField
                  className={styles.fieldTheme}
                  icon={<SunMoon size={14} />}
                  id="theme"
                  isOpen={openSelectId === "theme"}
                  label="Тема"
                  onChange={(nextValue) => setTheme(nextValue as CarouselTemplateId)}
                  onClose={() => setOpenSelectId(null)}
                  onToggle={(fieldId) => setOpenSelectId((current) => (current === fieldId ? null : fieldId))}
                  options={THEME_OPTIONS}
                  value={theme}
                />

                <GenerateSelectField
                  className={styles.fieldCount}
                  icon={<Hash size={14} />}
                  id="slides-count"
                  isOpen={openSelectId === "slides-count"}
                  label="Количество карточек"
                  onChange={(nextValue) => setSlidesCount(clampSlidesCount(Number(nextValue)))}
                  onClose={() => setOpenSelectId(null)}
                  onToggle={(fieldId) => setOpenSelectId((current) => (current === fieldId ? null : fieldId))}
                  options={slidesCountOptions}
                  value={String(slidesCount)}
                />
              </div>
            </section>
          </div>

          {error ? <div className={`${styles.status} ${styles.statusError}`}>{error}</div> : null}
        </section>

        {previewList.length ? (
          <section className={styles.previewCard}>
            <div className={styles.previewHead}>
              <h3>Предпросмотр структуры</h3>
              <span className={`pill-badge pill-badge-primary ${styles.previewCount}`}>
                {previewList.length} слайдов
              </span>
            </div>

            <div className={styles.previewList}>
              {previewList.map((item, index) => (
                <div key={`${item.type}-${index}`} className={`${styles.previewItem} tap-feedback`}>
                  <span className={styles.previewIndex}>{index + 1}</span>
                  <span className={styles.previewCopy}>
                    <strong>{item.title}</strong>
                    <span className={styles.previewRole}>{ROLE_LABELS[item.type] ?? item.type}</span>
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
              <Info size={14} aria-hidden="true" />
              <span>Подпись к посту сгенерируешь в редакторе — вкладка «Пост»</span>
            </div>
          </section>
        ) : null}
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
