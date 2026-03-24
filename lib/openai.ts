import OpenAI from "openai";
import { clampSlidesCount } from "@/lib/slides";
import type {
  CarouselOutlineSlide,
  CarouselPostCaption,
  CarouselSlideRole
} from "@/types/editor";

export type PromptVariant = "A" | "B";

type GenerationOptions = {
  niche?: string;
  audience?: string;
  tone?: string;
  goal?: string;
  promptVariant?: PromptVariant;
};

type CaptionGenerationInput = {
  topic: string;
  slides: CarouselOutlineSlide[];
  niche?: string;
  audience?: string;
  tone?: string;
  goal?: string;
};

type CarouselGenerationResult = {
  slides: CarouselOutlineSlide[];
  promptVariant: PromptVariant;
};

const CANONICAL_FLOW: CarouselSlideRole[] = [
  "hook",
  "problem",
  "amplify",
  "mistake",
  "consequence",
  "shift",
  "solution",
  "example",
  "cta"
];

const FLOW_BY_COUNT: Record<number, CarouselSlideRole[]> = {
  8: ["hook", "problem", "mistake", "consequence", "shift", "solution", "example", "cta"],
  9: [...CANONICAL_FLOW],
  10: [
    "hook",
    "problem",
    "amplify",
    "mistake",
    "consequence",
    "shift",
    "solution",
    "solution",
    "example",
    "cta"
  ]
};

const DEFAULT_MODEL_CANDIDATES = [
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4o-mini"
] as const;

const BANNED_TEMPLATE_PATTERNS: RegExp[] = [
  /(?:^|[^\p{L}])в\s+современном\s+мире(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])важно\s+понимать(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])ключ\s+к\s+успеху(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])где\s+ломается\s+поток(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])по\s+теме(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])в\s+теме(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])разбор\s+под\s+ваш\s+кейс(?=$|[^\p{L}])/iu
];

const WEAK_SHIFT_PATTERNS: RegExp[] = [
  /(?:^|[^\p{L}])важно\s+выслушать(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])важнее\s+всего(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])пора\s+смотреть(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])нужно\s+просто(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])главное\s+—?\s*быть\s+собой(?=$|[^\p{L}])/iu
];

const WEAK_ROLE_TITLE_PATTERNS: RegExp[] = [
  /^что\s+это\s+значит(\s+для\s+вас)?\??$/iu,
  /^что\s+делать\s+по\s+шагам\??$/iu,
  /^что\s+изменится,\s*если\s+оставить\s+как\s+есть\??$/iu,
  /^готов[а-яё]*\s+объединить\s+усилия\??$/iu,
  /^пора\s+работать\s+как\s+одна\s+команда\??$/iu,
  /^вместе\s+тестировать\s+новые\s+подходы\??$/iu
];

function resolveModelCandidates() {
  return [
    process.env.OPENAI_GENERATION_MODEL?.trim(),
    ...DEFAULT_MODEL_CANDIDATES,
    process.env.OPENAI_MODEL?.trim()
  ]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, list) => list.indexOf(value) === index);
}

let client: OpenAI | null = null;

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return client;
}

export async function generateCarouselFromTopic(
  topic: string,
  requestedSlidesCount?: number,
  options?: GenerationOptions
): Promise<CarouselGenerationResult> {
  const cleanedTopic = normalizeText(topic, 240) || "Новая карусель";
  const targetCount = resolveSlidesCount(requestedSlidesCount);
  const expectedFlow = resolveExpectedFlow(targetCount);
  const promptVariant = resolvePromptVariant(options?.promptVariant);

  try {
    const openai = getOpenAIClient();
    const models = resolveModelCandidates();
    let lastError: unknown = null;

    for (const model of models) {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const response = await openai.responses.create({
            model,
            temperature: 0.9,
            max_output_tokens: 2600,
            input: [
              {
                role: "system",
                content: [
                  {
                    type: "input_text",
                    text: [
                      "You are a senior Russian social carousel copywriter.",
                      "You generate only text and semantic slide structure for social carousels.",
                      "Never generate design, layout, style, colors, fonts, positions, image prompts or coordinates.",
                      "Return strict JSON only.",
                      "Write concise, conversational, high-signal Russian copy without fluff and without robotic phrasing.",
                      "Adapt voice to topic and audience. Keep it native for Instagram/Telegram style content.",
                      "Keep each slide self-contained and readable on a mobile card.",
                      "Keep text compact but substantial: title up to ~12 words, subtitle up to ~24 words, bullets up to ~20 words.",
                      "Start from the provided topic. Do not default to sales/real-estate language if topic is different.",
                      "If topic is educational/health/lifestyle/psychology etc, keep vocabulary in that domain.",
                      "Avoid generic opener like «Одна ошибка…» unless the topic explicitly asks for mistakes.",
                      "Hook title must be topic-specific and must not start with «ошибка», «одна ошибка», «главная ошибка».",
                      "Never use «ошибка» / «главная ошибка» / «одна ошибка» as the default first frame.",
                      "Avoid boilerplate phrases like «в теме ...», «где ломается поток», «что это стоит в теме».",
                      "Do not force the words «кейс», «разбор», «поток», «лиды» unless the topic needs them.",
                      "Avoid repeated words, broken compounds and malformed line fragments.",
                      "No clichés and no mechanical template substitutions.",
                      "Do not invent extra fields or extra slide types."
                    ].join(" ")
                  }
                ]
              },
              {
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: buildUserPrompt(cleanedTopic, expectedFlow, options, promptVariant)
                  }
                ]
              }
            ],
            text: {
              format: {
                type: "json_schema",
                name: "carousel_text_structure",
                strict: true,
                schema: buildResponseSchema(expectedFlow.length)
              }
            }
          });

          const raw = response.output_text?.trim();

          if (!raw) {
            throw new Error("OpenAI returned empty output.");
          }

          const parsed = JSON.parse(raw) as { slides?: unknown[] };
          const normalizedSlides = normalizeSlides(parsed.slides, expectedFlow, cleanedTopic, options);
          const constrainedSlides = enforceTopicAndHookIntegrity(
            normalizedSlides,
            expectedFlow,
            cleanedTopic,
            options
          );
          const repairedSlides = repairTopicCoverage(constrainedSlides, expectedFlow, cleanedTopic);
          const polishedSlides = applyFinalCopyPolish(
            repairedSlides,
            expectedFlow,
            cleanedTopic,
            options
          );
          const topicRelevantSlides = isOutlineTopicRelevant(polishedSlides, cleanedTopic)
            ? polishedSlides
            : buildFallbackSlides(cleanedTopic, expectedFlow, options);
          const qualityGuardedSlides = enforceSlideQuality(
            topicRelevantSlides,
            expectedFlow,
            cleanedTopic,
            options
          );
          const quality = evaluateSlideQuality(qualityGuardedSlides, expectedFlow, cleanedTopic);

          if (topicRelevantSlides !== polishedSlides) {
            console.warn("Generated outline was strongly off-topic. Using deterministic fallback slides.");
          }

          if (!quality.ok) {
            const reason = quality.reasons.join("; ") || "low narrative quality";
            if (attempt < 2) {
              console.warn(
                `Model "${model}" attempt ${attempt} returned weak copy (${reason}). Retrying.`
              );
              continue;
            }

            lastError = new Error(`Low-quality generation from model "${model}": ${reason}`);
            console.warn(
              `Model "${model}" produced weak copy after retries (${reason}). Trying next candidate.`
            );
            continue;
          }

          if (hasBannedTemplateLanguage(qualityGuardedSlides)) {
            if (attempt < 2) {
              console.warn(`Model "${model}" attempt ${attempt} returned templated language. Retrying.`);
              continue;
            }
            return {
              slides: stripBannedTemplateLanguage(
                qualityGuardedSlides,
                expectedFlow,
                cleanedTopic,
                options
              ),
              promptVariant
            };
          }

          return {
            slides: qualityGuardedSlides,
            promptVariant
          };
        } catch (error) {
          lastError = error;

          if (!canRetryWithAnotherModel(error)) {
            throw error;
          }

          if (attempt < 2) {
            continue;
          }
        }

        console.warn(`Model "${model}" failed for generation. Trying next candidate.`);
      }
    }

    throw lastError ?? new Error("OpenAI generation failed for all model candidates.");
  } catch (error) {
    console.error("AI generation failed. Falling back to deterministic slides:", error);

    return {
      slides: buildFallbackSlides(cleanedTopic, expectedFlow, options),
      promptVariant
    };
  }
}

export async function generateCaptionFromCarousel(
  input: CaptionGenerationInput
): Promise<CarouselPostCaption> {
  const topic = normalizeText(input.topic, 220) || "вашей теме";
  const slides = Array.isArray(input.slides) ? input.slides.slice(0, 10) : [];
  const fallback = buildCaptionFallback(topic, slides, input.goal);

  if (!slides.length) {
    return fallback;
  }

  try {
    const openai = getOpenAIClient();
    const models = resolveModelCandidates();
    let lastError: unknown = null;

    for (const model of models) {
      try {
        const response = await openai.responses.create({
          model,
          temperature: 0.85,
          max_output_tokens: 1600,
          input: [
            {
              role: "system",
              content: [
                {
                  type: "input_text",
                  text: [
                    "You are a senior Russian Instagram copywriter.",
                    "Write a post caption based on a finished carousel.",
                    "Do not repeat slide lines verbatim. Expand meaning and keep it lively.",
                    "Output strict JSON only.",
                    "Tone: social-native, concrete, no office language, no robotic templates.",
                    "Avoid clichés like «в современном мире» and other boilerplate.",
                    "Do not mention slides by number. Keep smooth narrative flow."
                  ].join(" ")
                }
              ]
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: buildCaptionPrompt({
                    topic,
                    slides,
                    niche: input.niche,
                    audience: input.audience,
                    tone: input.tone,
                    goal: input.goal
                  })
                }
              ]
            }
          ],
          text: {
            format: {
              type: "json_schema",
              name: "carousel_caption",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  text: { type: "string", maxLength: 1800 },
                  cta: { type: "string", maxLength: 220 },
                  cta_soft: { type: "string", maxLength: 220 },
                  cta_aggressive: { type: "string", maxLength: 220 },
                  hashtags: {
                    type: "array",
                    minItems: 3,
                    maxItems: 8,
                    items: { type: "string", maxLength: 40 }
                  }
                },
                required: ["text", "cta", "cta_soft", "cta_aggressive", "hashtags"]
              }
            }
          }
        });

        const raw = response.output_text?.trim();
        if (!raw) {
          throw new Error("OpenAI returned empty caption output.");
        }

        const parsed = JSON.parse(raw) as {
          text?: unknown;
          cta?: unknown;
          cta_soft?: unknown;
          cta_aggressive?: unknown;
          hashtags?: unknown;
        };

        return normalizeCaption(parsed, fallback, input.goal);
      } catch (error) {
        lastError = error;

        if (!canRetryWithAnotherModel(error)) {
          throw error;
        }

        console.warn(`Model "${model}" failed for caption generation. Trying next candidate.`);
      }
    }

    throw lastError ?? new Error("Caption generation failed for all model candidates.");
  } catch (error) {
    console.error("Caption generation failed. Using deterministic fallback:", error);
    return fallback;
  }
}

function resolveSlidesCount(value?: number | null) {
  const normalized = clampSlidesCount(value);
  return Math.max(8, Math.min(10, normalized));
}

function resolveExpectedFlow(targetCount: number) {
  const flow = FLOW_BY_COUNT[targetCount];
  if (flow?.length) {
    return flow;
  }

  return CANONICAL_FLOW;
}

function resolvePromptVariant(value?: PromptVariant | string) {
  return value === "A" ? "A" : "B";
}

function buildUserPrompt(
  topic: string,
  flow: CarouselSlideRole[],
  options?: GenerationOptions,
  promptVariant: PromptVariant = "B"
) {
  const niche = normalizeText(options?.niche ?? "", 120);
  const audience = normalizeText(options?.audience ?? "", 160);
  const tone = normalizeText(options?.tone ?? "", 40);
  const goal = normalizeText(options?.goal ?? "", 48);

  const variantRules =
    promptVariant === "A"
      ? [
          "Hook must be clear and topic-specific.",
          "Shift should present a practical mindset change.",
          "CTA should end with one specific next action."
        ]
      : [
          "Draft 3 hook ideas internally and choose the strongest stop-scroll variant.",
          "Hook must include contrast or concrete scene (before/after, click->result, call->silence).",
          "Shift must be a counterintuitive turning point, not motivational cliché.",
          "CTA should include action + value + response format (code-word/DM/save-checklist)."
        ];

  return [
    `Topic: ${topic}`,
    niche ? `Niche: ${niche}` : "",
    audience ? `Audience: ${audience}` : "",
    tone ? `Tone preference: ${tone}` : "",
    goal ? `Goal: ${goal}` : "",
    `Slides count: ${flow.length}`,
    `Required flow (strict order): ${flow.join(" -> ")}`,
    "Field rules by type:",
    "- hook: title, subtitle",
    "- problem: title, bullets[]",
    "- amplify: title, bullets[]",
    "- mistake: title",
    "- consequence: bullets[]",
    "- shift: title",
    "- solution: bullets[]",
    "- example: before, after",
    "- cta: title, subtitle",
    "Schema note: each slide object must include all fields: type, title, subtitle, bullets, before, after.",
    "For fields that are not used by the current type, return empty string \"\" or empty array [].",
    "Tone: vivid, social-native, high signal, no bureaucratic wording.",
    "Each slide should carry a strong standalone idea with natural spoken Russian.",
    "Bullets must be concise but meaningful: 1 short sentence each, 2-4 bullets, include concrete detail instead of generic slogans.",
    "Keep wording topic-specific. Avoid universal sales jargon if topic is not sales-related.",
    "Avoid stale templates like «в теме ...», «одна ошибка ...», «где ломается поток ...».",
    "Ban phrases: «в современном мире», «важно понимать», «ключ к успеху».",
    ...variantRules,
    "Avoid title collisions and duplicated words inside one line.",
    "Avoid long clauses and nested lists.",
    "No markdown, no emojis, no extra commentary."
  ]
    .filter(Boolean)
    .join("\n");
}

function buildResponseSchema(slidesCount: number) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      slides: {
        type: "array",
        minItems: slidesCount,
        maxItems: slidesCount,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            type: {
              type: "string",
              enum: ["hook", "problem", "amplify", "mistake", "consequence", "shift", "solution", "example", "cta"]
            },
            title: { type: ["string", "null"], maxLength: 120 },
            subtitle: { type: ["string", "null"], maxLength: 180 },
            bullets: {
              type: ["array", "null"],
              minItems: 0,
              maxItems: 4,
              items: { type: "string", maxLength: 120 }
            },
            before: { type: ["string", "null"], maxLength: 160 },
            after: { type: ["string", "null"], maxLength: 160 }
          },
          required: ["type", "title", "subtitle", "bullets", "before", "after"]
        }
      }
    },
    required: ["slides"]
  };
}

function buildCaptionPrompt(input: CaptionGenerationInput) {
  const niche = normalizeText(input.niche ?? "", 120);
  const audience = normalizeText(input.audience ?? "", 160);
  const tone = normalizeText(input.tone ?? "", 40);
  const goal = normalizeText(input.goal ?? "", 48);
  const slideDigest = input.slides
    .map((slide, index) => {
      if (slide.type === "hook" || slide.type === "cta") {
        return `${index + 1}. ${slide.type}: ${slide.title} — ${slide.subtitle}`;
      }
      if (slide.type === "problem" || slide.type === "amplify") {
        return `${index + 1}. ${slide.type}: ${slide.title} | ${slide.bullets.join(" | ")}`;
      }
      if (slide.type === "solution") {
        return `${index + 1}. solution: ${slide.bullets.join(" | ")}`;
      }
      if (slide.type === "mistake" || slide.type === "shift") {
        return `${index + 1}. ${slide.type}: ${slide.title}`;
      }
      if (slide.type === "consequence") {
        return `${index + 1}. consequence: ${slide.bullets.join(" | ")}`;
      }
      return `${index + 1}. example: ${slide.before} => ${slide.after}`;
    })
    .join("\n");

  return [
    `Topic: ${input.topic}`,
    niche ? `Niche: ${niche}` : "",
    audience ? `Audience: ${audience}` : "",
    tone ? `Tone: ${tone}` : "",
    goal ? `Goal: ${goal}` : "",
    "Carousel summary:",
    slideDigest,
    "Requirements:",
    "- text: 900-1500 chars, coherent post caption in Russian.",
    "- include one practical mini-example or mini-story.",
    "- avoid repeating slide text line-by-line.",
    "- keep high readability and social tone, split into short paragraphs.",
    "- cta_soft: save/checklist style CTA.",
    "- cta_aggressive: code-word/DM style CTA with explicit value.",
    "- cta: pick the best CTA for the provided goal.",
    "- hashtags: 4-8 relevant hashtags."
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeSlides(
  rawSlides: unknown,
  expectedFlow: CarouselSlideRole[],
  topic: string,
  options?: GenerationOptions
): CarouselOutlineSlide[] {
  const source = Array.isArray(rawSlides) ? rawSlides : [];
  const usedIndexes = new Set<number>();

  return expectedFlow.map((expectedType, index) => {
    const candidateIndex = pickCandidateIndex(source, expectedType, index, usedIndexes);
    if (candidateIndex >= 0) {
      usedIndexes.add(candidateIndex);
    }
    const candidate = candidateIndex >= 0 ? source[candidateIndex] : null;

    return normalizeSlideByType(expectedType, candidate, topic, index, options);
  });
}

function enforceTopicAndHookIntegrity(
  slides: CarouselOutlineSlide[],
  expectedFlow: CarouselSlideRole[],
  topic: string,
  options?: GenerationOptions
) {
  return expectedFlow.map((role, index) => {
    const current = slides[index];
    const fallback = normalizeSlideByType(role, null, topic, index, options);

    if (!current) {
      return fallback;
    }

    const normalizedTitle =
      "title" in current && typeof current.title === "string"
        ? sanitizeTitleValue(current.title, 96)
        : "";
    const hasGenericMistakeLead =
      role !== "mistake" && normalizedTitle ? startsWithGenericMistakeLead(normalizedTitle) : false;
    if (role === "hook") {
      const safeSubtitle =
        "subtitle" in current && typeof current.subtitle === "string" && current.subtitle.trim()
          ? sanitizeCopyText(normalizeText(current.subtitle, 138), 132)
          : "";
      const hookCopy = [normalizedTitle, safeSubtitle].filter(Boolean).join(" ");
      const hookTopicMismatch = !isCopyTopicAligned(hookCopy, topic);

      if (!normalizedTitle || hasGenericMistakeLead || hookTopicMismatch) {
        return {
          ...current,
          title: buildHookFallbackTitle(topic),
          subtitle: safeSubtitle || buildHookFallbackSubtitle(topic)
        };
      }
    }

    if (hasGenericMistakeLead) {
      if ("title" in fallback && typeof fallback.title === "string") {
        return {
          ...current,
          title: fallback.title
        };
      }

      return {
        ...current,
        ...(fallback as CarouselOutlineSlide)
      };
    }

    if ("title" in current && normalizedTitle) {
      return {
        ...current,
        title: normalizedTitle
      };
    }

    return current;
  });
}

function repairTopicCoverage(
  slides: CarouselOutlineSlide[],
  expectedFlow: CarouselSlideRole[],
  topic: string
) {
  const topicStems = buildTopicStemSet(topic);
  if (topicStems.size === 0) {
    return slides;
  }

  const topicMatches = slides.map((slide) =>
    slide ? hasTopicStemMatch(collectSlideCopy(slide), topicStems) : false
  );
  const hookIndex = expectedFlow.findIndex((role) => role === "hook");
  const resolvedHookIndex = hookIndex >= 0 ? hookIndex : 0;
  const hasHookTopic = topicMatches[resolvedHookIndex] ?? false;
  const hasSupportingTopic = topicMatches.some((match, index) => match && index !== resolvedHookIndex);

  if (hasHookTopic && hasSupportingTopic) {
    return slides;
  }

  const patchedSlides = slides.map((slide) => ({ ...slide })) as CarouselOutlineSlide[];
  const hook = patchedSlides[resolvedHookIndex];

  if (hook && !hasHookTopic && hook.type === "hook") {
    const safeSubtitle =
      typeof hook.subtitle === "string" ? sanitizeCopyText(normalizeText(hook.subtitle, 138), 132) : "";
    hook.title = buildHookFallbackTitle(topic);
    hook.subtitle = safeSubtitle || buildHookFallbackSubtitle(topic);
  }

  if (hasSupportingTopic) {
    return patchedSlides;
  }

  const topicAnchor = buildTopicAnchorLabel(topic);

  for (let index = 0; index < expectedFlow.length; index += 1) {
    if (index === resolvedHookIndex) {
      continue;
    }

    const slide = patchedSlides[index];
    if (!slide || topicMatches[index]) {
      continue;
    }

    if ("title" in slide && typeof slide.title === "string" && slide.title.trim()) {
      slide.title = addTopicAnchorToTitle(slide.title, topicAnchor);
      return patchedSlides;
    }

    if ("bullets" in slide && Array.isArray(slide.bullets) && slide.bullets.length > 0) {
      const [first, ...rest] = slide.bullets;
      const normalizedFirst = sanitizeCopyText(normalizeText(first, 90), 86);
      slide.bullets = [`${normalizedFirst} (${topicAnchor})`, ...rest]
        .map((item) => sanitizeCopyText(normalizeText(item, 90), 86))
        .filter(Boolean);
      return patchedSlides;
    }
  }

  return patchedSlides;
}

function applyFinalCopyPolish(
  slides: CarouselOutlineSlide[],
  expectedFlow: CarouselSlideRole[],
  topic: string,
  options?: GenerationOptions
) {
  const nextSlides = slides.map((slide) => ({ ...slide })) as CarouselOutlineSlide[];
  const hookIndex = expectedFlow.findIndex((role) => role === "hook");
  const shiftIndex = expectedFlow.findIndex((role) => role === "shift");
  const ctaIndex = expectedFlow.findIndex((role) => role === "cta");

  if (hookIndex >= 0) {
    const hook = nextSlides[hookIndex];
    if (hook?.type === "hook") {
      const normalizedTitle = sanitizeTitleValue(hook.title, 84);
      const normalizedSubtitle = sanitizeCopyText(normalizeText(hook.subtitle, 138), 132);
      const combinedHook = `${normalizedTitle} ${normalizedSubtitle}`.trim();
      const shouldRepairHook =
        !normalizedTitle ||
        startsWithGenericMistakeLead(normalizedTitle) ||
        hasLegacyTemplatePhrase(combinedHook) ||
        BANNED_TEMPLATE_PATTERNS.some((pattern) => pattern.test(combinedHook));

      if (shouldRepairHook) {
        const candidates = buildHookCandidates(topic, options);
        const best = pickBestHookCandidate(candidates);
        if (!best) {
          hook.title = buildHookFallbackTitle(topic);
          hook.subtitle = normalizedSubtitle || buildHookFallbackSubtitle(topic);
        } else {
          hook.title = best.title;
          hook.subtitle = best.subtitle;
        }
      } else {
        hook.title = normalizedTitle;
        hook.subtitle = normalizedSubtitle || buildHookFallbackSubtitle(topic);
      }
    }
  }

  if (shiftIndex >= 0) {
    const shift = nextSlides[shiftIndex];
    if (shift?.type === "shift") {
      const cleanShift = sanitizeTitleValue(shift.title, 92);
      const weakShift =
        !cleanShift ||
        WEAK_SHIFT_PATTERNS.some((pattern) => pattern.test(cleanShift)) ||
        cleanShift.length < 16;

      if (weakShift) {
        shift.title = buildRoleTitleFallback("shift", topic);
      } else {
        shift.title = cleanShift;
      }
    }
  }

  if (ctaIndex >= 0) {
    const cta = nextSlides[ctaIndex];
    if (cta?.type === "cta") {
      const ctaVariants = buildCtaVariants(options?.goal, topic);
      const normalizedTitle = sanitizeTitleValue(cta.title, 84);
      const normalizedSubtitle = sanitizeCopyText(normalizeText(cta.subtitle, 138), 132);
      const hasAction = hasActionVerb(normalizedSubtitle);
      const weakTitle =
        !normalizedTitle ||
        /\b(готов[а-яё]*|объединить\s+усилия|поехали|пора\s+действовать|давайте\s+начнем)\b/iu.test(
          normalizedTitle
        );

      cta.title = weakTitle
        ? buildCtaTitleFallback(options?.goal, topic)
        : normalizedTitle;
      cta.subtitle = hasAction ? normalizedSubtitle : ctaVariants.selected;
    }
  }

  return nextSlides;
}

function enforceSlideQuality(
  slides: CarouselOutlineSlide[],
  expectedFlow: CarouselSlideRole[],
  topic: string,
  options?: GenerationOptions
): CarouselOutlineSlide[] {
  return expectedFlow.map((role, index) => {
    const current = slides[index];
    const fallback = normalizeSlideByType(role, null, topic, index, options);

    if (!current || current.type !== role) {
      return fallback;
    }

    if (role === "hook") {
      const hook = current as Extract<CarouselOutlineSlide, { type: "hook" }>;
      const title = sanitizeTitleValue(hook.title, 84);
      const subtitle = sanitizeCopyText(normalizeText(hook.subtitle, 138), 132);
      const weakTitle =
        !title ||
        startsWithGenericMistakeLead(title) ||
        hasLegacyTemplatePhrase(title) ||
        isWeakRoleTitle(title);

      return {
        type: "hook",
        title: weakTitle ? buildHookFallbackTitle(topic) : title,
        subtitle: subtitle || buildHookFallbackSubtitle(topic)
      };
    }

    if (role === "problem") {
      const problem = current as Extract<CarouselOutlineSlide, { type: "problem" }>;
      const problemFallback = fallback as Extract<CarouselOutlineSlide, { type: "problem" }>;
      const title = sanitizeTitleValue(problem.title, 80);
      const bullets = normalizeBullets(problem.bullets, problemFallback.bullets);
      const denseBullets = bullets.filter((item) => countWords(item) >= 4);
      return {
        type: "problem",
        title:
          !title || startsWithGenericMistakeLead(title) || hasLegacyTemplatePhrase(title) || isWeakRoleTitle(title)
            ? buildRoleTitleFallback("problem", topic)
            : title,
        bullets: (denseBullets.length >= 2 ? denseBullets : problemFallback.bullets).slice(0, 4)
      };
    }

    if (role === "amplify") {
      const amplify = current as Extract<CarouselOutlineSlide, { type: "amplify" }>;
      const amplifyFallback = fallback as Extract<CarouselOutlineSlide, { type: "amplify" }>;
      const title = sanitizeTitleValue(amplify.title, 80);
      const bullets = normalizeBullets(amplify.bullets, amplifyFallback.bullets);
      const denseBullets = bullets.filter((item) => countWords(item) >= 4);
      return {
        type: "amplify",
        title:
          !title || startsWithGenericMistakeLead(title) || hasLegacyTemplatePhrase(title) || isWeakRoleTitle(title)
            ? buildRoleTitleFallback("amplify", topic)
            : title,
        bullets: (denseBullets.length >= 2 ? denseBullets : amplifyFallback.bullets).slice(0, 4)
      };
    }

    if (role === "mistake") {
      const mistake = current as Extract<CarouselOutlineSlide, { type: "mistake" }>;
      const title = sanitizeTitleValue(mistake.title, 92);
      const weakTitle =
        !title ||
        startsWithGenericMistakeLead(title) ||
        hasLegacyTemplatePhrase(title) ||
        isWeakRoleTitle(title) ||
        countWords(title) < 4;

      return {
        type: "mistake",
        title: weakTitle ? buildRoleTitleFallback("mistake", topic) : title
      };
    }

    if (role === "consequence") {
      const consequence = current as Extract<CarouselOutlineSlide, { type: "consequence" }>;
      const consequenceFallback = fallback as Extract<CarouselOutlineSlide, { type: "consequence" }>;
      const bullets = normalizeBullets(consequence.bullets, consequenceFallback.bullets);
      const denseBullets = bullets.filter((item) => countWords(item) >= 4);
      return {
        type: "consequence",
        bullets: (denseBullets.length >= 2 ? denseBullets : consequenceFallback.bullets).slice(0, 4)
      };
    }

    if (role === "shift") {
      const shift = current as Extract<CarouselOutlineSlide, { type: "shift" }>;
      const title = sanitizeTitleValue(shift.title, 92);
      const weakTitle =
        !title ||
        startsWithGenericMistakeLead(title) ||
        hasLegacyTemplatePhrase(title) ||
        isWeakRoleTitle(title) ||
        countWords(title) < 4;

      return {
        type: "shift",
        title: weakTitle ? buildRoleTitleFallback("shift", topic) : title
      };
    }

    if (role === "solution") {
      const solution = current as Extract<CarouselOutlineSlide, { type: "solution" }>;
      const solutionFallback = fallback as Extract<CarouselOutlineSlide, { type: "solution" }>;
      const bullets = normalizeBullets(solution.bullets, solutionFallback.bullets);
      const denseBullets = bullets.filter((item) => countWords(item) >= 4);
      return {
        type: "solution",
        bullets: (denseBullets.length >= 2 ? denseBullets : solutionFallback.bullets).slice(0, 4)
      };
    }

    if (role === "example") {
      const example = current as Extract<CarouselOutlineSlide, { type: "example" }>;
      const exampleFallback = fallback as Extract<CarouselOutlineSlide, { type: "example" }>;
      const before = sanitizeCopyText(normalizeText(example.before, 128), 122);
      const after = sanitizeCopyText(normalizeText(example.after, 128), 122);
      const beforeLooksWeak = !before || countWords(before) < 4;
      const afterLooksWeak = !after || countWords(after) < 4;
      return {
        type: "example",
        before: beforeLooksWeak ? exampleFallback.before : before,
        after: afterLooksWeak ? exampleFallback.after : after
      };
    }

    const cta = current as Extract<CarouselOutlineSlide, { type: "cta" }>;
    const ctaVariants = buildCtaVariants(options?.goal, topic);
    const title = sanitizeTitleValue(cta.title, 84);
    const subtitle = sanitizeCopyText(normalizeText(cta.subtitle, 138), 132);
    const hasAction = hasActionVerb(subtitle);
    return {
      type: "cta",
      title:
        !title || countWords(title) < 2 || isWeakRoleTitle(title) || hasLegacyTemplatePhrase(title)
          ? buildCtaTitleFallback(options?.goal, topic)
          : title,
      subtitle: hasAction ? subtitle : ctaVariants.selected
    };
  });
}

function evaluateSlideQuality(
  slides: CarouselOutlineSlide[],
  expectedFlow: CarouselSlideRole[],
  topic: string
) {
  const reasons: string[] = [];

  if (slides.length !== expectedFlow.length) {
    reasons.push("unexpected slide count");
    return { ok: false, reasons };
  }

  const topicStemSet = buildTopicStemSet(topic);
  const topicCoverage =
    topicStemSet.size === 0
      ? slides.length
      : slides.filter((slide) => hasTopicStemMatch(collectSlideCopy(slide), topicStemSet)).length;

  if (topicCoverage < 2) {
    reasons.push("weak topic coverage");
  }

  for (let index = 0; index < expectedFlow.length; index += 1) {
    const role = expectedFlow[index];
    const slide = slides[index];

    if (!slide || slide.type !== role) {
      reasons.push(`flow mismatch at ${index + 1}`);
      continue;
    }

    if (role === "hook") {
      const hook = slide as Extract<CarouselOutlineSlide, { type: "hook" }>;
      if (countWords(hook.title) < 4 || countWords(hook.subtitle) < 5 || isWeakRoleTitle(hook.title)) {
        reasons.push("weak hook");
      }
      continue;
    }

    if (role === "problem") {
      const problem = slide as Extract<CarouselOutlineSlide, { type: "problem" }>;
      if (!Array.isArray(problem.bullets) || problem.bullets.length < 2) {
        reasons.push("thin bullets on problem");
        continue;
      }

      const hasDetailedBullet = problem.bullets.some((item) => countWords(item) >= 5);
      if (!hasDetailedBullet) {
        reasons.push("low detail on problem");
      }
      continue;
    }

    if (role === "amplify") {
      const amplify = slide as Extract<CarouselOutlineSlide, { type: "amplify" }>;
      if (!Array.isArray(amplify.bullets) || amplify.bullets.length < 2) {
        reasons.push("thin bullets on amplify");
        continue;
      }

      const hasDetailedBullet = amplify.bullets.some((item) => countWords(item) >= 5);
      if (!hasDetailedBullet) {
        reasons.push("low detail on amplify");
      }
      continue;
    }

    if (role === "mistake") {
      const mistake = slide as Extract<CarouselOutlineSlide, { type: "mistake" }>;
      if (countWords(mistake.title) < 4 || isWeakRoleTitle(mistake.title)) {
        reasons.push("weak mistake");
      }
      continue;
    }

    if (role === "consequence") {
      const consequence = slide as Extract<CarouselOutlineSlide, { type: "consequence" }>;
      if (!Array.isArray(consequence.bullets) || consequence.bullets.length < 2) {
        reasons.push("thin bullets on consequence");
        continue;
      }

      const hasDetailedBullet = consequence.bullets.some((item) => countWords(item) >= 5);
      if (!hasDetailedBullet) {
        reasons.push("low detail on consequence");
      }
      continue;
    }

    if (role === "shift") {
      const shift = slide as Extract<CarouselOutlineSlide, { type: "shift" }>;
      if (countWords(shift.title) < 4 || isWeakRoleTitle(shift.title)) {
        reasons.push("weak shift");
      }
      continue;
    }

    if (role === "solution") {
      const solution = slide as Extract<CarouselOutlineSlide, { type: "solution" }>;
      if (!Array.isArray(solution.bullets) || solution.bullets.length < 2) {
        reasons.push("thin bullets on solution");
        continue;
      }

      const hasDetailedBullet = solution.bullets.some((item) => countWords(item) >= 5);
      if (!hasDetailedBullet) {
        reasons.push("low detail on solution");
      }
      continue;
    }

    if (role === "example") {
      const example = slide as Extract<CarouselOutlineSlide, { type: "example" }>;
      if (countWords(example.before) < 4 || countWords(example.after) < 4) {
        reasons.push("weak example");
      }
      continue;
    }

    const cta = slide as Extract<CarouselOutlineSlide, { type: "cta" }>;
    if (countWords(cta.title) < 2 || !hasActionVerb(cta.subtitle)) {
      reasons.push("weak cta");
    }
  }

  return {
    ok: reasons.length === 0,
    reasons
  };
}

function countWords(value: string) {
  return normalizeWordTokens(value).length;
}

function hasActionVerb(value: string) {
  return /(?:^|[^\p{L}])(напиши|напишите|сохраните|оставьте|отправьте|ответьте|пришлите|подпишитесь|выберите)(?=$|[^\p{L}])/iu.test(
    value
  );
}

function isWeakRoleTitle(value: string) {
  const normalized = sanitizeTitleValue(value, 96).toLowerCase();
  if (!normalized) {
    return true;
  }

  return WEAK_ROLE_TITLE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function buildHookCandidates(topic: string, options?: GenerationOptions) {
  const normalizedTopic = normalizeText(topic, 220).toLowerCase();
  const topicAnchor = extractHookAnchor(topic);
  const isAdContext = /\b(реклам|клик|лендинг|заяв|лид|воронк)\b/iu.test(normalizedTopic);
  const isCallContext = /\b(звон|созвон|переговор|клиент\s+пропал)\b/iu.test(normalizedTopic);
  const goalCue = normalizeText(options?.goal ?? "", 30).toLowerCase();
  const isQuestionAnchor = /^(как|почему|зачем|что|когда|где)\b/iu.test(topicAnchor);

  const firstTitle = isCallContext
    ? "Созвон прошёл. Почему дальше тишина?"
    : isAdContext
      ? "Клики есть. Почему заявок нет?"
      : isQuestionAnchor
        ? trimToWordBoundary(topicAnchor.replace(/[.?!…]+$/u, "") + "?", 72)
        : trimToWordBoundary(`${upperFirst(topicAnchor)}: где теряется результат`, 72);

  const firstSubtitle = isCallContext
    ? "Разберём, какая фраза ломает доверие в первые 2 минуты."
    : isAdContext
      ? "Покажу, где после клика теряется доверие и деньги."
      : "Разберём 3 узких места и соберём рабочий ход без шаблонных фраз.";

  const candidates = [
    {
      title: trimToWordBoundary(firstTitle, 72),
      subtitle: trimToWordBoundary(firstSubtitle, 132)
    },
    {
      title: "Есть контент. Нет реакции. Где провал?",
      subtitle: trimToWordBoundary(
        "Короткий разбор: крючок, перелом мысли и следующий шаг без давления.",
        132
      )
    },
    {
      title: "Где после первого экрана теряется результат?",
      subtitle: trimToWordBoundary(
        goalCue.includes("заяв")
          ? "Соберём структуру, которая доводит до заявки, а не до пролистывания."
          : "Соберём структуру, которую дочитывают, сохраняют и пересылают дальше.",
        132
      )
    }
  ];

  return candidates;
}

function scoreHookCandidate(title: string, subtitle: string) {
  const normalizedTitle = sanitizeTitleValue(title, 84);
  const normalizedSubtitle = sanitizeCopyText(normalizeText(subtitle, 132), 132);
  const combined = `${normalizedTitle} ${normalizedSubtitle}`;
  let score = 0;

  if (/\?|!/.test(normalizedTitle)) {
    score += 1;
  }
  if (/\b(есть|нет|но|а|после|до|тишин|клик|созвон)\b/iu.test(combined)) {
    score += 2;
  }
  if (/\b\d{1,2}\b/.test(combined) || /\b(чек-лист|шаг|минут)\b/iu.test(combined)) {
    score += 1;
  }
  if (startsWithGenericMistakeLead(normalizedTitle) || hasLegacyTemplatePhrase(combined)) {
    score -= 3;
  }
  if (BANNED_TEMPLATE_PATTERNS.some((pattern) => pattern.test(combined))) {
    score -= 3;
  }

  return score;
}

function pickBestHookCandidate(candidates: Array<{ title: string; subtitle: string }>) {
  let best: { title: string; subtitle: string } | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const score = scoreHookCandidate(candidate.title, candidate.subtitle);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

function hasBannedTemplateLanguage(slides: CarouselOutlineSlide[]) {
  return slides.some((slide) => {
    const text = collectSlideCopy(slide);
    return BANNED_TEMPLATE_PATTERNS.some((pattern) => pattern.test(text));
  });
}

function stripBannedTemplateLanguage(
  slides: CarouselOutlineSlide[],
  expectedFlow: CarouselSlideRole[],
  topic: string,
  options?: GenerationOptions
) {
  return expectedFlow.map((role, index) => {
    const current = slides[index];
    const fallback = normalizeSlideByType(role, null, topic, index, options);
    if (!current) {
      return fallback;
    }

    if ("title" in current && typeof current.title === "string") {
      const cleanedTitle = removeBannedPhrases(current.title);
      if (cleanedTitle) {
        current.title = cleanedTitle;
      } else if ("title" in fallback && typeof fallback.title === "string") {
        current.title = fallback.title;
      }
    }

    if ("subtitle" in current && typeof current.subtitle === "string") {
      const cleanedSubtitle = removeBannedPhrases(current.subtitle);
      current.subtitle =
        cleanedSubtitle ||
        ("subtitle" in fallback && typeof fallback.subtitle === "string"
          ? fallback.subtitle
          : current.subtitle);
    }

    if ("before" in current && typeof current.before === "string") {
      current.before = removeBannedPhrases(current.before) || current.before;
    }
    if ("after" in current && typeof current.after === "string") {
      current.after = removeBannedPhrases(current.after) || current.after;
    }
    if ("bullets" in current && Array.isArray(current.bullets)) {
      current.bullets = current.bullets
        .map((item) => removeBannedPhrases(item))
        .filter(Boolean) as string[];
      if (!current.bullets.length && "bullets" in fallback && Array.isArray(fallback.bullets)) {
        current.bullets = fallback.bullets;
      }
    }

    return current;
  });
}

function removeBannedPhrases(value: string) {
  let next = value;
  for (const pattern of BANNED_TEMPLATE_PATTERNS) {
    const flags = `${pattern.flags.includes("i") ? "i" : ""}g`;
    next = next.replace(new RegExp(pattern.source, flags), " ");
  }
  return sanitizeCopyText(normalizeText(next, 180), 170);
}

function pickCandidateIndex(
  source: unknown[],
  expectedType: CarouselSlideRole,
  preferredIndex: number,
  usedIndexes: Set<number>
) {
  const preferred = source[preferredIndex];
  if (
    preferred &&
    typeof preferred === "object" &&
    !Array.isArray(preferred) &&
    !usedIndexes.has(preferredIndex)
  ) {
    const preferredType = (preferred as { type?: unknown }).type;
    if (preferredType === expectedType) {
      return preferredIndex;
    }

    // Backward compatibility for legacy payloads without `type`.
    if (typeof preferredType !== "string") {
      return preferredIndex;
    }
  }

  for (let index = 0; index < source.length; index += 1) {
    if (usedIndexes.has(index)) {
      continue;
    }

    const item = source[index];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    if ((item as { type?: unknown }).type === expectedType) {
      return index;
    }
  }

  for (let index = 0; index < source.length; index += 1) {
    if (usedIndexes.has(index)) {
      continue;
    }

    const item = source[index];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    if (typeof (item as { type?: unknown }).type !== "string") {
      return index;
    }
  }

  return -1;
}

function normalizeSlideByType(
  expectedType: CarouselSlideRole,
  rawSlide: unknown,
  topic: string,
  index: number,
  options?: GenerationOptions
): CarouselOutlineSlide {
  const safe = toRecord(rawSlide);
  const topicFocus = buildTopicFocus(topic);

  if (expectedType === "hook") {
    const rawTitle = sanitizeTitleValue(safe.title, 84);
    const normalizedTitle =
      rawTitle &&
      !startsWithGenericMistakeLead(rawTitle) &&
      !hasLegacyTemplatePhrase(rawTitle)
        ? rawTitle
        : "";
    return {
      type: "hook",
      title: normalizedTitle || buildHookFallbackTitle(topic),
      subtitle:
        sanitizeCopyText(normalizeText(safe.subtitle, 138), 132) || buildHookFallbackSubtitle(topic)
    };
  }

  if (expectedType === "problem") {
    const rawTitle = sanitizeTitleValue(safe.title, 80);
    return {
      type: "problem",
      title:
        (rawTitle && !startsWithGenericMistakeLead(rawTitle) && !hasLegacyTemplatePhrase(rawTitle)
          ? rawTitle
          : "") || buildRoleTitleFallback("problem", topic),
      bullets: normalizeBullets(safe.bullets, [
        "Формулировка звучит слишком общей и не цепляет с первых строк.",
        "Тема есть, но человеку непонятно, какую пользу он получит дальше.",
        "Сильная мысль теряется в длинных фразах и лишних пояснениях."
      ])
    };
  }

  if (expectedType === "amplify") {
    const rawTitle = sanitizeTitleValue(safe.title, 80);
    return {
      type: "amplify",
      title:
        (rawTitle && !startsWithGenericMistakeLead(rawTitle) && !hasLegacyTemplatePhrase(rawTitle)
          ? rawTitle
          : "") || buildRoleTitleFallback("amplify", topic),
      bullets: normalizeBullets(safe.bullets, [
        "Просмотры есть, но сохранений и пересылок почти не появляется.",
        "Часть аудитории не доходит до сути и теряет интерес по дороге.",
        "На контент уходит время, а результат остается неровным."
      ])
    };
  }

  if (expectedType === "mistake") {
    const rawTitle = sanitizeTitleValue(safe.title, 92);
    return {
      type: "mistake",
      title:
        (rawTitle && !hasLegacyTemplatePhrase(rawTitle) ? rawTitle : "") ||
        buildRoleTitleFallback("mistake", topic)
    };
  }

  if (expectedType === "consequence") {
    return {
      type: "consequence",
      bullets: normalizeBullets(safe.bullets, [
        "Аудитория листает дальше, не доходя до главного.",
        "Экспертность считывается слабее, чем могла бы.",
        "Контент есть, а системного эффекта по отклику нет."
      ])
    };
  }

  if (expectedType === "shift") {
    const rawTitle = sanitizeTitleValue(safe.title, 92);
    return {
      type: "shift",
      title:
        (rawTitle && !startsWithGenericMistakeLead(rawTitle) && !hasLegacyTemplatePhrase(rawTitle)
          ? rawTitle
          : "") ||
        buildRoleTitleFallback("shift", topic)
    };
  }

  if (expectedType === "solution") {
    return {
      type: "solution",
      bullets: normalizeBullets(safe.bullets, [
        "Держите одну мысль на слайд, чтобы взгляд не распадался.",
        "Подкрепляйте тезис фактом, мини-примером или короткой цифрой.",
        "В конце оставляйте простой следующий шаг без лишнего давления."
      ])
    };
  }

  if (expectedType === "example") {
    return {
      type: "example",
      before:
        sanitizeCopyText(normalizeText(safe.before, 128), 122) ||
        `До: «${topicFocus} важен, мы делаем это качественно»`,
      after:
        sanitizeCopyText(normalizeText(safe.after, 128), 122) ||
        `После: «Внедрили 3 шага и получили заметный рост отклика по ${topicFocus}»`
    };
  }

  const ctaTitle = sanitizeTitleValue(safe.title, 84);
  const goalAwareCta = buildGoalAwareCta(options?.goal);
  return {
    type: "cta",
    title: ctaTitle || trimToWordBoundary("Хотите адаптацию под свою тему?", 84),
    subtitle:
      sanitizeCopyText(normalizeText(safe.subtitle, 138), 132) ||
      goalAwareCta
  };
}

function buildFallbackSlides(
  topic: string,
  flow: CarouselSlideRole[],
  options?: GenerationOptions
): CarouselOutlineSlide[] {
  return flow.map((type, index) => normalizeSlideByType(type, null, topic, index, options));
}

function normalizeBullets(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const dedupe = new Set<string>();
  const cleaned: string[] = [];

  for (const item of value) {
    const normalized = sanitizeCopyText(normalizeText(item, 128), 122);
    if (!normalized) {
      continue;
    }

    const fingerprint = normalizeWordTokens(normalized).join(" ");
    if (!fingerprint || dedupe.has(fingerprint)) {
      continue;
    }

    dedupe.add(fingerprint);
    cleaned.push(normalized);

    if (cleaned.length >= 4) {
      break;
    }
  }

  return cleaned.length ? cleaned : fallback;
}

function buildCtaTitleFallback(goal: string | undefined, topic: string) {
  const normalizedGoal = normalizeText(goal, 40).toLowerCase();
  const focus = buildTopicFocus(topic);

  if (isLeadsGoal(normalizedGoal)) {
    return trimToWordBoundary("Нужна структура, которая доводит до заявки?", 84);
  }

  if (isFollowersGoal(normalizedGoal)) {
    return trimToWordBoundary("Хотите карусели, которые сохраняют и пересылают?", 84);
  }

  return trimToWordBoundary(`Хотите усилить ${focus} без шаблонных фраз?`, 84);
}

function buildRoleTitleFallback(role: CarouselSlideRole, topic: string) {
  const focus = buildTopicFocus(topic);

  if (role === "problem") {
    return trimToWordBoundary(`Где в ${focus} читатель теряет интерес`, 80);
  }

  if (role === "amplify") {
    return trimToWordBoundary(`Почему это бьёт по результату сильнее, чем кажется`, 80);
  }

  if (role === "mistake") {
    return trimToWordBoundary(`Миф про ${focus}, который тормозит рост`, 92);
  }

  if (role === "shift") {
    return trimToWordBoundary(`Поворот, после которого ${focus} начинает работать`, 92);
  }

  return trimToWordBoundary(`Как усилить ${focus} на практике`, 84);
}

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  return normalized.slice(0, maxLength);
}

function buildHookFallbackTitle(topic: string) {
  const cleanTopic = normalizeText(topic, 96)
    .replace(/[.?!…]+$/u, "")
    .trim();

  if (!cleanTopic) {
    return "Идея, которая усиливает ваш контент";
  }

  if (/^(как|почему|когда|зачем|что)\b/iu.test(cleanTopic)) {
    return trimToWordBoundary(cleanTopic, 72);
  }

  const topicFocus = buildTopicFocus(cleanTopic);
  const variants = [
    `Как усилить ${topicFocus} так, чтобы дочитывали до конца`,
    `Что в ${topicFocus} реально цепляет с первого экрана`,
    `Сильный вход в ${topicFocus}: фраза, которая удерживает внимание`,
    `Где в ${topicFocus} лежит быстрый рычаг роста отклика`
  ];
  return trimToWordBoundary(pickVariantByTopic(topicFocus, variants), 72);
}

function buildHookFallbackSubtitle(topic: string) {
  const topicFocus = buildTopicFocus(topic);
  const variants = [
    `Покажу короткую структуру по ${topicFocus} без воды и штампов.`,
    "Только практичные формулировки, которые можно применить сразу после чтения.",
    "Соберем живую карусельную логику: крючок, напряжение, решение и CTA."
  ];

  return trimToWordBoundary(pickVariantByTopic(topicFocus, variants), 132);
}

function pickVariantByTopic(topic: string, variants: string[]) {
  const seed = Array.from(topic).reduce((acc, char) => {
    const code = char.codePointAt(0) ?? 0;
    return (acc * 33 + code) % 1_000_003;
  }, 7);

  return variants[Math.abs(seed) % variants.length] ?? variants[0] ?? "";
}

function buildTopicFocus(topic: string) {
  const cleaned = normalizeText(topic, 84)
    .replace(/^как\s+/iu, "")
    .replace(/[.?!…]+$/u, "")
    .trim();

  if (!cleaned) {
    return "вашей теме";
  }

  if (cleaned.length <= 52) {
    return cleaned;
  }

  const sliced = cleaned.slice(0, 52).trimEnd();
  const lastSpace = sliced.lastIndexOf(" ");
  return (lastSpace > 26 ? sliced.slice(0, lastSpace) : sliced).trimEnd();
}

function extractHookAnchor(topic: string) {
  const normalized = normalizeText(topic, 140)
    .replace(/[.?!…]+$/u, "")
    .trim();

  if (!normalized) {
    return "вашей теме";
  }

  if (normalized.length <= 56) {
    return normalized;
  }

  const parts = normalized
    .split(/[—–:]/u)
    .map((item) => item.trim())
    .filter(Boolean);

  const firstPart = parts[0];
  if (firstPart && firstPart.length >= 16) {
    return trimToWordBoundary(firstPart, 56);
  }

  return trimToWordBoundary(normalized, 56);
}

function sanitizeCopyText(value: string, maxLength: number) {
  if (!value) {
    return "";
  }

  const noDoubleSpaces = value
    .replace(/\s+([.,!?;:])/gu, "$1")
    .replace(/([«„])\s+/gu, "$1")
    .replace(/\s+([»”])/gu, "$1")
    .replace(/\s+/gu, " ")
    .trim();

  if (!noDoubleSpaces) {
    return "";
  }

  const words = noDoubleSpaces.split(" ");
  const compactWords: string[] = [];
  let previousNormalized = "";

  for (const word of words) {
    const normalizedWord = normalizeWordTokens(word)[0] ?? "";
    if (normalizedWord && normalizedWord === previousNormalized) {
      continue;
    }

    compactWords.push(word);
    previousNormalized = normalizedWord || previousNormalized;
  }

  const cleaned = compactWords.join(" ").trim();
  if (!cleaned) {
    return "";
  }

  return trimToWordBoundary(cleaned, maxLength);
}

function normalizeWordTokens(value: string) {
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function startsWithGenericMistakeLead(value: string) {
  const normalizedLead = value
    .replace(/^[\s"'`«»“”„(){}\[\].,;:!?—–-]+/gu, "")
    .replace(/\s+/gu, " ")
    .trim();

  if (!normalizedLead) {
    return false;
  }

  return /^(одн[а-яё]*\s+)?(типичн[а-яё]*\s+)?(главн[а-яё]*\s+)?ошиб[а-яё]*/iu.test(normalizedLead);
}

function hasLegacyTemplatePhrase(value: string) {
  return /(?:^|[^\p{L}])(по\s+теме|в\s+теме|где\s+ломается\s+поток|где\s+теряется\s+внимание|что\s+это\s+стоит\s+в\s+теме|разбор\s+под\s+ваш\s+кейс)(?=$|[^\p{L}])/iu.test(
    value
  );
}

function upperFirst(value: string) {
  if (!value) {
    return "";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function sanitizeTitleValue(value: unknown, maxLength: number) {
  const rawTitle = sanitizeCopyText(normalizeText(value, maxLength + 20), maxLength);
  if (!rawTitle) {
    return "";
  }

  const words = rawTitle.split(" ").filter(Boolean);
  if (words.length <= 2) {
    return rawTitle;
  }

  const seen = new Set<string>();
  const compactWords: string[] = [];

  for (const word of words) {
    const token = normalizeWordTokens(word)[0] ?? "";
    const shouldDeduplicate = token.length >= 4 && !TOPIC_STOP_WORDS.has(token);

    if (shouldDeduplicate && seen.has(token)) {
      continue;
    }

    if (shouldDeduplicate) {
      seen.add(token);
    }

    compactWords.push(word);
  }

  return sanitizeCopyText(compactWords.join(" "), maxLength);
}

const TOPIC_STOP_WORDS = new Set([
  "как",
  "что",
  "это",
  "или",
  "для",
  "про",
  "под",
  "без",
  "при",
  "где",
  "надо",
  "нужно",
  "тема",
  "теме",
  "почему",
  "когда",
  "чтобы",
  "если",
  "так",
  "еще",
  "ещё"
]);

function topicStem(token: string) {
  return token.slice(0, Math.min(6, token.length));
}

function buildTopicStemSet(topic: string) {
  return new Set(
    normalizeWordTokens(normalizeText(topic, 180))
      .filter((token) => token.length >= 3 && !TOPIC_STOP_WORDS.has(token))
      .map((token) => topicStem(token))
  );
}

function collectSlideCopy(slide: CarouselOutlineSlide) {
  const parts: string[] = [];

  if ("title" in slide && slide.title) {
    parts.push(slide.title);
  }
  if ("subtitle" in slide && slide.subtitle) {
    parts.push(slide.subtitle);
  }
  if ("before" in slide && slide.before) {
    parts.push(slide.before);
  }
  if ("after" in slide && slide.after) {
    parts.push(slide.after);
  }
  if ("bullets" in slide && Array.isArray(slide.bullets)) {
    parts.push(...slide.bullets);
  }

  return normalizeText(parts.join(" "), 420);
}

function hasTopicStemMatch(copy: string, topicStems: Set<string>) {
  if (topicStems.size === 0) {
    return true;
  }

  const copyTokens = normalizeWordTokens(copy).filter(
    (token) => token.length >= 4 && !TOPIC_STOP_WORDS.has(token)
  );
  if (copyTokens.length === 0) {
    return false;
  }

  return copyTokens.some((token) => {
    const stem = topicStem(token);
    if (topicStems.has(stem)) {
      return true;
    }

    for (const topicToken of topicStems) {
      if (stem.startsWith(topicToken) || topicToken.startsWith(stem)) {
        return true;
      }
    }

    return false;
  });
}

function isCopyTopicAligned(copy: string, topic: string) {
  return hasTopicStemMatch(copy, buildTopicStemSet(topic));
}

function isOutlineTopicRelevant(slides: CarouselOutlineSlide[], topic: string) {
  const hook = slides.find((slide) => slide.type === "hook");
  const hookTitle = hook?.title?.trim() ?? "";
  const hookLooksBad = !hookTitle || startsWithGenericMistakeLead(hookTitle);
  const repeatedGenericMistakes = slides.filter((slide) => {
    if (!("title" in slide) || !slide.title) {
      return false;
    }
    return startsWithGenericMistakeLead(slide.title);
  }).length;

  if (hookLooksBad || repeatedGenericMistakes > 1) {
    return false;
  }

  const topicStems = buildTopicStemSet(topic);
  if (topicStems.size === 0) {
    return true;
  }
  const slideHasTopic = (slide: CarouselOutlineSlide) => hasTopicStemMatch(collectSlideCopy(slide), topicStems);
  const slidesWithTopic = slides.reduce((count, slide) => (slideHasTopic(slide) ? count + 1 : count), 0);

  if (slidesWithTopic === 0) {
    return false;
  }

  const hookText = [hook?.title ?? "", hook?.subtitle ?? ""].join(" ").trim();
  if (!hookText) {
    return false;
  }

  if (hasTopicStemMatch(hookText, topicStems)) {
    return true;
  }

  return slidesWithTopic >= 2;
}

function buildTopicAnchorLabel(topic: string) {
  const focus = buildTopicFocus(topic).replace(/^как\s+/iu, "").trim();
  return trimToWordBoundary(focus || "вашу тему", 34);
}

function addTopicAnchorToTitle(title: string, topicAnchor: string) {
  const normalizedTitle = sanitizeTitleValue(title, 90);
  if (!normalizedTitle) {
    return `Про ${topicAnchor}`;
  }

  const alreadyAnchored = new RegExp(
    `(?:^|[^\\p{L}\\p{N}])${escapeRegExp(topicAnchor)}(?=$|[^\\p{L}\\p{N}])`,
    "iu"
  ).test(normalizedTitle);
  if (alreadyAnchored) {
    return normalizedTitle;
  }

  return trimToWordBoundary(`${normalizedTitle} — про ${topicAnchor}`, 90);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function trimToWordBoundary(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value.trim();
  }

  const sliced = value.slice(0, maxLength).trimEnd();
  const lastSpace = sliced.lastIndexOf(" ");
  return (lastSpace > Math.floor(maxLength * 0.55) ? sliced.slice(0, lastSpace) : sliced).trim();
}

function normalizeCaption(
  raw: {
    text?: unknown;
    cta?: unknown;
    cta_soft?: unknown;
    cta_aggressive?: unknown;
    hashtags?: unknown;
  },
  fallback: CarouselPostCaption,
  goal?: string
): CarouselPostCaption {
  const text = formatCaptionText(sanitizeCopyText(normalizeText(raw.text, 1800), 1750) || fallback.text);
  const ctaSoft =
    sanitizeCopyText(normalizeText(raw.cta_soft, 220), 210) || fallback.ctaSoft || fallback.cta;
  const ctaAggressive =
    sanitizeCopyText(normalizeText(raw.cta_aggressive, 220), 210) ||
    fallback.ctaAggressive ||
    fallback.cta;
  const requestedCta = sanitizeCopyText(normalizeText(raw.cta, 220), 210);
  const cta = requestedCta || selectCtaByGoal(goal, { soft: ctaSoft, aggressive: ctaAggressive });
  const hashtags = normalizeHashtags(raw.hashtags);

  return {
    text,
    cta,
    ctaSoft,
    ctaAggressive,
    hashtags: hashtags.length ? hashtags : fallback.hashtags
  };
}

function normalizeHashtags(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  const seen = new Set<string>();
  const hashtags: string[] = [];

  for (const item of value) {
    const normalized = normalizeText(item, 40)
      .replace(/\s+/g, "")
      .replace(/^#+/g, "")
      .replace(/[^\p{L}\p{N}_-]+/gu, "")
      .toLowerCase();

    if (!normalized) {
      continue;
    }

    const tag = `#${normalized}`;
    if (seen.has(tag)) {
      continue;
    }

    seen.add(tag);
    hashtags.push(tag);

    if (hashtags.length >= 8) {
      break;
    }
  }

  return hashtags;
}

function buildCaptionFallback(topic: string, slides: CarouselOutlineSlide[], goal?: string): CarouselPostCaption {
  const hook = slides.find((slide) => slide.type === "hook");
  const solution = slides.find((slide) => slide.type === "solution");
  const firstIdea = hook?.title || buildHookFallbackTitle(topic);
  const solutionLine =
    solution && "bullets" in solution && solution.bullets.length
      ? solution.bullets[0]
      : "Разбейте тему на короткие, самостоятельные мысли — так дочитывают чаще.";
  const ctaVariants = buildCtaVariants(goal, topic);

  const text = formatCaptionText(
    trimToWordBoundary(
    [
      `${firstIdea}.`,
      `Главная мысль этой карусели: ${solutionLine}`,
      "Сфокусируйтесь на одной проблеме аудитории и разверните её через контраст: было -> стало.",
      "Так текст звучит живо, не теряет ритм и даёт человеку понятный следующий шаг."
    ].join(" "),
    1700
    )
  );

  return {
    text,
    cta: ctaVariants.selected,
    ctaSoft: ctaVariants.soft,
    ctaAggressive: ctaVariants.aggressive,
    hashtags: buildFallbackHashtags(topic)
  };
}

function buildGoalAwareCta(goal?: string) {
  return buildCtaVariants(goal).selected;
}

function buildCtaVariants(goal?: string, topic?: string) {
  const normalizedGoal = normalizeText(goal, 40).toLowerCase();

  const aggressive = isLeadsGoal(normalizedGoal)
    ? "Напишите «ПЛАН» в директ — соберу структуру под ваши заявки."
    : "Напишите «СКРИПТ» в директ — пришлю короткий шаблон под вашу тему.";

  const soft = isFollowersGoal(normalizedGoal)
    ? "Сохраните пост и подпишитесь — разберу следующий кейс в этом формате."
    : trimToWordBoundary(
        "Сохраните карусель и выберите первый шаг, который внедрите сегодня.",
        210
      );

  return {
    aggressive: trimToWordBoundary(aggressive, 210),
    soft: trimToWordBoundary(soft, 210),
    selected: selectCtaByGoal(goal, { soft, aggressive })
  };
}

function selectCtaByGoal(goal: string | undefined, variants: { soft: string; aggressive: string }) {
  const normalizedGoal = normalizeText(goal, 40).toLowerCase();
  if (isLeadsGoal(normalizedGoal)) {
    return variants.aggressive;
  }

  return variants.soft;
}

function isLeadsGoal(goal: string) {
  const normalized = goal.toLowerCase();
  return (
    normalized.includes("lead") ||
    normalized.includes("лид") ||
    normalized.includes("заяв") ||
    normalized.includes("клиент")
  );
}

function isFollowersGoal(goal: string) {
  const normalized = goal.toLowerCase();
  return normalized.includes("подпис") || normalized.includes("follow") || normalized.includes("follower");
}

function formatCaptionText(value: string) {
  const normalized = sanitizeCopyText(normalizeText(value, 1800), 1750);
  if (!normalized) {
    return "";
  }

  const chunks = normalized
    .split(/(?<=[.!?])\s+/u)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (chunks.length <= 2) {
    return normalized;
  }

  const grouped: string[] = [];
  for (let index = 0; index < chunks.length; index += 2) {
    grouped.push(chunks.slice(index, index + 2).join(" "));
  }

  return grouped.join("\n\n");
}

function buildFallbackHashtags(topic: string) {
  const base = normalizeWordTokens(topic)
    .filter((token) => token.length >= 4 && !TOPIC_STOP_WORDS.has(token))
    .slice(0, 3)
    .map((token) => `#${token}`);

  const defaults = ["#контент", "#карусель", "#маркетинг", "#instagram"];
  const unique = new Set<string>();
  const result: string[] = [];

  for (const item of [...base, ...defaults]) {
    const normalized = item.startsWith("#") ? item : `#${item}`;
    if (unique.has(normalized)) {
      continue;
    }
    unique.add(normalized);
    result.push(normalized);
    if (result.length >= 6) {
      break;
    }
  }

  return result;
}

function canRetryWithAnotherModel(error: unknown) {
  if (error instanceof SyntaxError) {
    return true;
  }

  if (!error || typeof error !== "object") {
    return false;
  }

  const status = typeof (error as { status?: unknown }).status === "number"
    ? (error as { status?: number }).status
    : null;
  const message =
    error instanceof Error
      ? error.message
      : typeof (error as { message?: unknown }).message === "string"
        ? String((error as { message?: unknown }).message)
        : "";

  if (status === 404) {
    return true;
  }

  if (status === 400) {
    return /\bmodel\b|does not exist|unknown model|unsupported model|not found|unsupported parameter|unknown parameter|invalid value|invalid_request|json|schema|temperature|max_output_tokens/i.test(
      message
    );
  }

  if (status === null && /empty output|json|schema|unexpected token/i.test(message)) {
    return true;
  }

  return false;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}
