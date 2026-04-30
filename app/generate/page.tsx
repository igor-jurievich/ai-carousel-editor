"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Hash,
  ImagePlus,
  Info,
  LayoutGrid,
  Palette,
  Rocket,
  Sparkles,
  SunMoon,
  Target,
  Type,
  Users,
  Zap
} from "lucide-react";
import { toast } from "sonner";
import { createSlidesFromOutline, projectTitleFromTopic } from "@/lib/carousel";
import { clampSlidesCount, DEFAULT_SLIDES_COUNT, SLIDES_COUNT_OPTIONS } from "@/lib/slides";
import { saveLocalProject } from "@/lib/projects";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { trackEvent } from "@/lib/telemetry";
import type {
  CarouselOutlineSlide,
  CarouselTemplateId,
  ContentModeInput,
  SlideFormat
} from "@/types/editor";
import styles from "./generate-page.module.css";

type GeneratedPreviewSlide = CarouselOutlineSlide & {
  image?: string | null;
  hasImage?: boolean;
};

type GenerateResponse = {
  slides?: GeneratedPreviewSlide[];
  generationSource?: "model" | "fallback";
  fallbackReason?: "quota" | "error" | "timeout";
  generationMeta?: {
    model?: string;
    imageModel?: string | null;
    imagesGenerated?: number;
    tokensUsed?: number;
    creditsCharged?: number;
    [key: string]: unknown;
  };
  generationProfile?: {
    modeDetected?: ContentModeInput;
    modeEffective?: ContentModeInput;
    modeSource?: "auto" | "manual";
    modeConfidence?: number;
    flowTemplate?: string;
    ctaType?: "direct" | "soft";
    bulletStyle?: "clean" | "numbers" | "dots" | "compact";
    firstSlideRepairs?: number;
    toneViolations?: number;
    modeValidationPassed?: boolean;
    modeValidationErrors?: string[];
    modeReasonCodes?: string[];
    fallbackUsed?: boolean;
  };
  project?: {
    title?: string;
    topic?: string;
    format?: SlideFormat;
    theme?: CarouselTemplateId;
    promptVariant?: "A" | "B";
    contentMode?: ContentModeInput;
    language?: "ru";
    version?: number;
  };
  message?: string;
  remainingCredits?: number;
  withImages?: boolean;
  requiredCredits?: number;
  currentCredits?: number;
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
type GenerationStatus = "idle" | "loading" | "success" | "error";

const MAX_TOPIC_CHARS = 4000;
const STATUS_ROTATION_MS = 2500;
const STATUS_MESSAGES_BY_MODE: Record<ContentModeInput, string[]> = {
  auto: [
    "Определяю структуру темы...",
    "Формулирую ключевые причины...",
    "Уточняю практические шаги...",
    "Проверяю тон и ясность...",
    "Собираю финальную версию..."
  ],
  sales: [
    "Придумываю крючок...",
    "Формулирую проблему...",
    "Усиливаю боль...",
    "Ищу ошибку...",
    "Собираю решение...",
    "Пишу призыв к действию..."
  ],
  expert: [
    "Называю тему без воды...",
    "Разбираю симптомы и причины...",
    "Объясняю механизм...",
    "Собираю рабочие шаги...",
    "Проверяю спокойный экспертный тон..."
  ],
  instruction: [
    "Формулирую цель инструкции...",
    "Собираю последовательность шагов...",
    "Проверяю условия и тайминг...",
    "Добавляю блок частых ошибок...",
    "Делаю краткий итог..."
  ],
  diagnostic: [
    "Определяю симптомы сбоя...",
    "Проверяю типичные ошибки...",
    "Раскладываю причины...",
    "Собираю коррекцию...",
    "Проверяю ясный вывод..."
  ],
  case: [
    "Описываю контекст кейса...",
    "Фиксирую точку «до»...",
    "Собираю действия...",
    "Показываю результат «после»...",
    "Формирую вывод..."
  ],
  social: [
    "Собираю живой заход...",
    "Уточняю бытовые триггеры...",
    "Добавляю практичные шаги...",
    "Смягчаю тон...",
    "Формирую мягкий финал..."
  ]
};

const IMAGE_STATUS_INSERTS_BY_MODE: Partial<Record<ContentModeInput, string[]>> = {
  sales: ["Генерирую фото для обложки...", "Генерирую фото для ошибки...", "Рисую кейс..."],
  expert: ["Генерирую фото для темы...", "Генерирую фото для разбора...", "Генерирую фото для примера..."],
  instruction: ["Генерирую фото для цели...", "Генерирую фото для шагов...", "Генерирую фото для результата..."],
  diagnostic: ["Генерирую фото симптома...", "Генерирую фото ошибки...", "Генерирую фото исправления..."],
  case: ["Генерирую фото контекста...", "Генерирую фото действий...", "Генерирую фото результата..."],
  social: ["Генерирую фото ситуации...", "Генерирую фото поворота...", "Генерирую фото итога..."],
  auto: ["Генерирую фото для обложки...", "Генерирую фото для середины...", "Генерирую фото для примера..."]
};

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

const CONTENT_MODE_OPTIONS: SelectOption[] = [
  { value: "auto", label: "Авто (по теме)" },
  { value: "sales", label: "Продажи / лиды" },
  { value: "expert", label: "Экспертный разбор" },
  { value: "instruction", label: "Пошаговая инструкция" },
  { value: "diagnostic", label: "Диагностика / ошибки" },
  { value: "case", label: "Кейс / до-после" },
  { value: "social", label: "Социальный / life" }
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
  const [withImages, setWithImages] = useState(false);
  const [niche, setNiche] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("balanced");
  const [goal, setGoal] = useState("engagement");
  const [contentMode, setContentMode] = useState<ContentModeInput>("auto");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>("idle");
  const [generationErrorMessage, setGenerationErrorMessage] = useState<string | null>(null);
  const [statusIndex, setStatusIndex] = useState(0);
  const [progressWidth, setProgressWidth] = useState(0);
  const [isProgressVisible, setIsProgressVisible] = useState(false);
  const [isProgressFading, setIsProgressFading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewSlides, setPreviewSlides] = useState<GeneratedPreviewSlide[] | null>(null);
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
  const previewRevealTimeoutRef = useRef<number | null>(null);
  const hideErrorStatusTimeoutRef = useRef<number | null>(null);
  const hideProgressTimeoutRef = useRef<number | null>(null);

  const slidesCountOptions = useMemo<SelectOption[]>(
    () => SLIDES_COUNT_OPTIONS.map((count) => ({ value: String(count), label: String(count) })),
    []
  );

  const normalizedTopic = topic.trim();
  const canGenerate = normalizedTopic.length >= 3 && !isGenerating;
  const requiredCredits = withImages ? 5 : 1;
  const statusMessages = useMemo(() => {
    const base = STATUS_MESSAGES_BY_MODE[contentMode] ?? STATUS_MESSAGES_BY_MODE.auto;
    if (!withImages) {
      return base;
    }

    const inserts = IMAGE_STATUS_INSERTS_BY_MODE[contentMode] ?? IMAGE_STATUS_INSERTS_BY_MODE.auto ?? [];
    if (!inserts.length) {
      return base;
    }

    const next = [...base];
    next.splice(1, 0, ...inserts);
    return next;
  }, [contentMode, withImages]);
  const generationStatusMessage =
    generationStatus === "loading"
      ? statusMessages[statusIndex]
      : generationStatus === "success"
        ? "Готово! ✓"
        : generationStatus === "error"
          ? generationErrorMessage
          : null;
  const progressTransition =
    generationStatus === "loading"
      ? "width 15s ease-out, opacity 300ms ease"
      : "width 200ms linear, opacity 300ms ease";

  const previewList = useMemo(() => {
    if (!previewSlides?.length) {
      return [] as Array<{ type: string; title: string; hasImage: boolean }>;
    }

    return previewSlides.map((slide) => {
      const hasImage =
        slide.hasImage === true || (typeof slide.image === "string" && slide.image.trim().length > 0);

      if ("title" in slide && slide.title) {
        return { type: slide.type, title: slide.title, hasImage };
      }

      if ("before" in slide && slide.before) {
        return { type: slide.type, title: slide.before, hasImage };
      }

      if ("bullets" in slide && slide.bullets?.[0]) {
        return { type: slide.type, title: slide.bullets[0], hasImage };
      }

      return { type: slide.type, title: "Слайд без заголовка", hasImage };
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
    if (generationStatus !== "loading") {
      return;
    }

    const intervalId = window.setInterval(() => {
      setStatusIndex((current) => (current + 1) % statusMessages.length);
    }, STATUS_ROTATION_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [generationStatus, statusMessages]);

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

  useEffect(() => {
    return () => {
      if (previewRevealTimeoutRef.current !== null) {
        window.clearTimeout(previewRevealTimeoutRef.current);
      }
      if (hideErrorStatusTimeoutRef.current !== null) {
        window.clearTimeout(hideErrorStatusTimeoutRef.current);
      }
      if (hideProgressTimeoutRef.current !== null) {
        window.clearTimeout(hideProgressTimeoutRef.current);
      }
    };
  }, []);

  const handleGenerate = async () => {
    if (!canGenerate) {
      return;
    }

    if (typeof credits === "number" && credits < requiredCredits) {
      toast.error(`Недостаточно кредитов. Нужно ${requiredCredits}, у вас ${credits}.`);
      return;
    }

    if (previewRevealTimeoutRef.current !== null) {
      window.clearTimeout(previewRevealTimeoutRef.current);
      previewRevealTimeoutRef.current = null;
    }
    if (hideErrorStatusTimeoutRef.current !== null) {
      window.clearTimeout(hideErrorStatusTimeoutRef.current);
      hideErrorStatusTimeoutRef.current = null;
    }
    if (hideProgressTimeoutRef.current !== null) {
      window.clearTimeout(hideProgressTimeoutRef.current);
      hideProgressTimeoutRef.current = null;
    }

    try {
      setIsAdvancedOpen(false);
      setOpenSelectId(null);
      setIsGenerating(true);
      setError(null);
      setPreviewSlides(null);
      setGeneratedProjectMeta(null);
      setGenerationStatus("loading");
      setGenerationErrorMessage(null);
      setStatusIndex(0);
      setIsProgressVisible(true);
      setIsProgressFading(false);
      setProgressWidth(0);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setProgressWidth(85);
        });
      });
      trackEvent({
        name: "generate_started",
        payload: {
          source: "generate_page",
          format,
          slidesCount: clampSlidesCount(slidesCount),
          theme,
          contentMode,
          withImages,
          requiredCredits
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
          contentMode,
          format,
          theme,
          withImages
        })
      });

      const data = (await response.json()) as GenerateResponse;
      if (!response.ok) {
        if (response.status === 403 && data.error === "no_credits") {
          const needed =
            typeof data.requiredCredits === "number" && Number.isFinite(data.requiredCredits)
              ? Math.max(1, Math.trunc(data.requiredCredits))
              : requiredCredits;
          const available =
            typeof data.currentCredits === "number" && Number.isFinite(data.currentCredits)
              ? Math.max(0, Math.trunc(data.currentCredits))
              : typeof credits === "number"
                ? Math.max(0, Math.trunc(credits))
                : 0;

          setCredits(available);
          toast.error(`Недостаточно кредитов. Нужно ${needed}, у вас ${available}.`);
          if (available <= 0) {
            setIsNoCreditsNoticeOpen(true);
          }
          setError(null);
          setGenerationStatus("idle");
          setGenerationErrorMessage(null);
          setIsProgressVisible(false);
          setIsProgressFading(false);
          setProgressWidth(0);
          return;
        }

        throw new Error(data.error || "Не удалось сгенерировать карусель.");
      }

      if (!data.slides?.length) {
        throw new Error(data.error || "Не удалось сгенерировать карусель.");
      }

      setGenerationStatus("success");
      setGenerationErrorMessage(null);
      setProgressWidth(100);
      setIsProgressFading(true);
      hideProgressTimeoutRef.current = window.setTimeout(() => {
        setIsProgressVisible(false);
        setIsProgressFading(false);
        setProgressWidth(0);
        hideProgressTimeoutRef.current = null;
      }, 300);
      previewRevealTimeoutRef.current = window.setTimeout(() => {
        setPreviewSlides(data.slides ?? null);
        setGeneratedProjectMeta(data.project ?? null);
        setGenerationStatus("idle");
        previewRevealTimeoutRef.current = null;
      }, 1000);

      if (data.generationSource === "fallback") {
        console.warn("[generate] Deterministic fallback was used.", {
          reason: data.fallbackReason ?? "error"
        });
      }
      if (typeof data.remainingCredits === "number" && Number.isFinite(data.remainingCredits)) {
        setCredits(Math.max(0, Math.trunc(data.remainingCredits)));
      } else {
        const creditsCharged =
          typeof data.generationMeta?.creditsCharged === "number" && Number.isFinite(data.generationMeta.creditsCharged)
            ? Math.max(1, Math.trunc(data.generationMeta.creditsCharged))
            : requiredCredits;
        setCredits((current) =>
          typeof current === "number" ? Math.max(0, current - creditsCharged) : current
        );
      }
      trackEvent({
        name: "generate_succeeded",
        payload: {
          source: "generate_page",
          format: data.project?.format ?? format,
          slidesCount: data.slides.length,
          theme: data.project?.theme ?? theme,
          promptVariant: data.project?.promptVariant ?? "B",
          contentMode: data.project?.contentMode ?? contentMode,
          modeDetected: data.generationProfile?.modeDetected ?? null,
          modeEffective:
            data.generationProfile?.modeEffective ?? data.project?.contentMode ?? contentMode,
          modeSource: data.generationProfile?.modeSource ?? null,
          modeConfidence: data.generationProfile?.modeConfidence ?? null,
          flowTemplate: data.generationProfile?.flowTemplate ?? null,
          ctaType: data.generationProfile?.ctaType ?? null,
          toneViolations: data.generationProfile?.toneViolations ?? null,
          modeValidationPassed: data.generationProfile?.modeValidationPassed ?? null,
          modeValidationErrorsCount: Array.isArray(data.generationProfile?.modeValidationErrors)
            ? data.generationProfile.modeValidationErrors.length
            : null,
          withImages,
          imagesGenerated:
            typeof data.generationMeta?.imagesGenerated === "number"
              ? Math.max(0, Math.trunc(data.generationMeta.imagesGenerated))
              : 0
        }
      });
    } catch (generationError) {
      trackEvent({
        name: "generate_failed",
        payload: {
          source: "generate_page",
          format,
          contentMode,
          reason:
            generationError instanceof Error ? generationError.message.slice(0, 120) : "unknown"
        }
      });
      const message =
        generationError instanceof Error
          ? generationError.message
          : "Не смогли сгенерировать. Попробуйте переформулировать тему.";
      setGenerationStatus("error");
      setGenerationErrorMessage(message);
      setIsProgressVisible(false);
      setIsProgressFading(false);
      setProgressWidth(0);
      toast.error("Не удалось сгенерировать");
      setPreviewSlides(null);
      setGeneratedProjectMeta(null);
      hideErrorStatusTimeoutRef.current = window.setTimeout(() => {
        setGenerationStatus("idle");
        setGenerationErrorMessage(null);
        hideErrorStatusTimeoutRef.current = null;
      }, 5000);
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
        contentMode: generatedProjectMeta?.contentMode ?? contentMode,
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <img src="/logo.svg" alt="pastello.io" width={32} height={32} />
            <span className={styles.logo}>
              pastello
              <span style={{ color: "#6366f1", fontWeight: 400 }}>.io</span>
            </span>
          </div>

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
                disabled={isGenerating}
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
                disabled={isGenerating}
              />

              <button
                className={styles.sendButton}
                type="button"
                onClick={() => void handleGenerate()}
                disabled={!canGenerate}
                aria-label={isGenerating ? "Генерируем" : "Сгенерировать карусель"}
                title={isGenerating ? "Генерируем..." : "Сгенерировать карусель"}
              >
                {isGenerating ? <span className={styles.sendButtonSpinner} aria-hidden="true" /> : "→"}
              </button>
            </div>

            <section
              className={`${styles.advancedPanel} ${isAdvancedOpen ? styles.advancedPanelOpen : ""}`}
              aria-label="Уточнение генерации"
              aria-hidden={!isAdvancedOpen}
            >
              <div className={styles.advancedGrid}>
                <div className={`${styles.fieldLabel} ${styles.fieldGenerationMode}`}>
                  <span className={styles.fieldLabelText}>
                    <ImagePlus size={14} className={styles.fieldLabelIcon} aria-hidden="true" />
                    <span>Режим генерации</span>
                  </span>

                  <div className={styles.modeSwitch} role="radiogroup" aria-label="Режим генерации">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={!withImages}
                      className={`${styles.modeSwitchOption} ${!withImages ? styles.modeSwitchOptionActive : ""}`}
                      onClick={() => setWithImages(false)}
                      disabled={isGenerating}
                    >
                      <span className={styles.modeSwitchTitle}>
                        <Type size={14} aria-hidden="true" />
                        <span>Текст</span>
                      </span>
                      <small className={styles.modeSwitchCredits}>1 кредит</small>
                    </button>

                    <button
                      type="button"
                      role="radio"
                      aria-checked={withImages}
                      className={`${styles.modeSwitchOption} ${withImages ? styles.modeSwitchOptionActive : ""}`}
                      onClick={() => setWithImages(true)}
                      disabled={isGenerating}
                    >
                      <span className={styles.modeSwitchTitle}>
                        <Sparkles size={14} aria-hidden="true" />
                        <span>Текст + AI фото</span>
                      </span>
                      <small className={styles.modeSwitchCredits}>5 кредитов</small>
                    </button>
                  </div>

                  {withImages ? (
                    <span className={styles.modeSwitchHint}>
                      AI сгенерирует уникальные фото для обложки, ошибки и кейса
                    </span>
                  ) : null}
                </div>

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
                  className={styles.fieldContentMode}
                  icon={<Target size={14} />}
                  id="content-mode"
                  isOpen={openSelectId === "content-mode"}
                  label="Контентный режим"
                  onChange={(nextValue) => setContentMode(nextValue as ContentModeInput)}
                  onClose={() => setOpenSelectId(null)}
                  onToggle={(fieldId) => setOpenSelectId((current) => (current === fieldId ? null : fieldId))}
                  options={CONTENT_MODE_OPTIONS}
                  value={contentMode}
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

            {isProgressVisible ? (
              <div
                className={`${styles.generationProgress} ${isProgressFading ? styles.generationProgressFading : ""}`}
                aria-hidden="true"
              >
                <span
                  className={styles.generationProgressBar}
                  style={{
                    width: `${progressWidth}%`,
                    transition: progressTransition
                  }}
                />
              </div>
            ) : null}
          </div>

          {generationStatusMessage ? (
            <div
              className={`${styles.generationStatus} ${
                generationStatus === "success"
                  ? styles.generationStatusSuccess
                  : generationStatus === "error"
                    ? styles.generationStatusError
                    : styles.generationStatusLoading
              }`}
            >
              {generationStatus === "loading" ? (
                <span className={styles.generationStatusSpinner} aria-hidden="true" />
              ) : generationStatus === "success" ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <AlertCircle size={16} aria-hidden="true" />
              )}
              <span className={generationStatus === "loading" ? styles.statusTextAnimated : undefined}>
                {generationStatusMessage}
              </span>
            </div>
          ) : null}

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
                  <span className={styles.previewIndexMeta}>
                    <span className={styles.previewIndex}>{index + 1}</span>
                    {item.hasImage ? (
                      <span className={styles.previewImageBadge} role="img" aria-label="На слайде есть AI-фото">
                        🖼
                      </span>
                    ) : null}
                  </span>
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
