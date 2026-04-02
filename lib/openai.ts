import OpenAI from "openai";
import { clampSlidesCount } from "@/lib/slides";
import type {
  CarouselOutlineSlide,
  CarouselPostCaption,
  CarouselSlideRole
} from "@/types/editor";

export type PromptVariant = "A" | "B";
type TopicDomain =
  | "sales"
  | "education"
  | "psychology"
  | "health"
  | "fitness"
  | "beauty"
  | "finance"
  | "creator"
  | "general";

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

const HOOK_SUBTITLE_INPUT_MAX = 154;
const HOOK_SUBTITLE_OUTPUT_MAX = 148;
const CTA_SUBTITLE_INPUT_MAX = 172;
const CTA_SUBTITLE_OUTPUT_MAX = 164;
const DEFAULT_MODEL_ATTEMPTS = 1;
const DEFAULT_MODEL_CANDIDATE_LIMIT = 2;

const BANNED_TEMPLATE_PATTERNS: RegExp[] = [
  /(?:^|[^\p{L}])в\s+современном\s+мире(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])важно\s+понимать(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])ключ\s+к\s+успеху(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])где\s+ломается\s+поток(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])по\s+теме(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])в\s+теме(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])разбор\s+под\s+ваш\s+кейс(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])быстрый\s+рычаг(?=$|[^\p{L}])/iu
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
  /^вместе\s+тестировать\s+новые\s+подходы\??$/iu,
  /^как\s+переформулировать\s+мысль\??$/iu,
  /^всё\s+держится\s+на\s+отдельных\s+звеньях\??$/iu,
  /^разные\s+цели\s+—?\s*слепые\s+зоны\??$/iu,
  /^что\s+теряет\s+бизнес\s+из[-\s]за\s+разногласий\??$/iu,
  /^разбор[:\s-]/iu,
  /^план,\s*который\s+можно\s+внедрить/iu,
  /^мини[-\s]?кейс[:\s-]/iu,
  /^[\p{L}-]+(?:у|ю)\s+[\p{L}-]{4,}ть\s*:/iu,
  /^[\p{L}-]+\s+[\p{L}-]{4,}ть:\s+как\b/iu
];

const WEAK_BULLET_PATTERNS: RegExp[] = [
  /(?:^|[^\p{L}])(важно\s+понимать|нужно\s+просто|следует\s+помнить|в\s+целом|в\s+общем|как\s+правило)(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])(работайте\s+системно|держите\s+фокус|будьте\s+на\s+связи)(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])(улучшить|усилить|повысить)\s+(процесс|эффективность|результат)(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])(делать\s+контент|вести\s+соцсети|развивать\s+блог)\s*(?:регулярно)?(?=$|[^\p{L}])/iu
];

function resolveModelCandidates() {
  const uniqueCandidates = [
    process.env.OPENAI_GENERATION_MODEL?.trim(),
    ...DEFAULT_MODEL_CANDIDATES,
    process.env.OPENAI_MODEL?.trim()
  ]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, list) => list.indexOf(value) === index);

  const requestedLimit = Number(process.env.OPENAI_MODEL_CANDIDATE_LIMIT);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(4, Math.round(requestedLimit)))
    : DEFAULT_MODEL_CANDIDATE_LIMIT;

  return uniqueCandidates.slice(0, limit);
}

function resolveModelAttemptsPerCandidate() {
  const raw = Number(process.env.OPENAI_MODEL_ATTEMPTS);
  if (!Number.isFinite(raw)) {
    return DEFAULT_MODEL_ATTEMPTS;
  }

  return Math.max(1, Math.min(3, Math.round(raw)));
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
    const modelAttempts = resolveModelAttemptsPerCandidate();
    let lastError: unknown = null;

    for (const model of models) {
      for (let attempt = 1; attempt <= modelAttempts; attempt += 1) {
        try {
          const response = await openai.responses.create({
            model,
            temperature: 0.78,
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
                      "Keep text compact but substantial: title up to ~14 words, subtitle up to ~30 words, bullets up to ~22 words.",
                      "Start from the provided topic. Do not default to sales/real-estate language if topic is different.",
                      "If topic is educational/health/lifestyle/psychology etc, keep vocabulary in that domain.",
                      "Avoid generic opener like «Одна ошибка…» unless the topic explicitly asks for mistakes.",
                      "Hook title must be topic-specific and must not start with «ошибка», «одна ошибка», «главная ошибка».",
                      "Never use «ошибка» / «главная ошибка» / «одна ошибка» as the default first frame.",
                      "Avoid awkward title constructions like «эксперту повысить: ...» or «психологу объяснять: ...».",
                      "Avoid boilerplate phrases like «в теме ...», «где ломается поток», «что это стоит в теме».",
                      "Do not force the words «кейс», «разбор», «поток», «лиды» unless the topic needs them.",
                      "Avoid repeated words, broken compounds and malformed line fragments.",
                      "For problem/amplify/solution bullets avoid abstract office wording like «работайте системно», «важно понимать», «улучшить процесс».",
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
            const locallyRepairedSlides = rescueWeakSlidesAfterQualityCheck(
              qualityGuardedSlides,
              expectedFlow,
              cleanedTopic,
              options,
              quality.reasons
            );
            const repairedQuality = evaluateSlideQuality(locallyRepairedSlides, expectedFlow, cleanedTopic);

            if (repairedQuality.ok) {
              return {
                slides: locallyRepairedSlides,
                promptVariant
              };
            }

            const reason = quality.reasons.join("; ") || "low narrative quality";
            if (attempt < modelAttempts) {
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

          if (attempt < modelAttempts) {
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

function resolveTopicDomain(topic: string, options?: GenerationOptions): TopicDomain {
  const source = normalizeText(
    [topic, options?.niche ?? "", options?.audience ?? ""].filter(Boolean).join(" "),
    420
  ).toLowerCase();

  if (
    /\b(финанс|инвест|бюджет|деньг|доход|портфел|кредит|налог|капитал|риск)\w*\b/iu.test(source)
  ) {
    return "finance";
  }

  if (
    /\b(врач|медицин|диагноз|пациент|клиник|здоров|лечение|терапи|симптом)\w*\b/iu.test(source)
  ) {
    return "health";
  }

  if (
    /\b(психолог|тревог|выгоран|терапевт|эмоци|самооцен|отношен|стресс)\w*\b/iu.test(source)
  ) {
    return "psychology";
  }

  if (/\b(фитнес|тренер|трениров|зал|спорт|форма|похуд|нагрузк)\w*\b/iu.test(source)) {
    return "fitness";
  }

  if (
    /\b(бьюти|салон|мастер|космет|ресниц|маник|ногт|бров|стилист)\w*\b/iu.test(source)
  ) {
    return "beauty";
  }

  if (
    /\b(репетитор|обучен|ученик|урок|школ|курс|преподав|студент|образован)\w*\b/iu.test(source)
  ) {
    return "education";
  }

  if (
    /\b(личн[а-яё]*\s+бренд|эксперт|блог|контент|instagram|telegram|соцсет|автор)\b/iu.test(source)
  ) {
    return "creator";
  }

  if (
    /\b(продаж|заявк|лид|воронк|конверс|маркетолог|риелтор|агентств|клиент|сделк|реклам)\w*\b/iu.test(
      source
    )
  ) {
    return "sales";
  }

  return "general";
}

function buildDomainPromptAddendum(domain: TopicDomain) {
  if (domain === "education") {
    return [
      "Domain: education. Speak through progress, practice, motivation, lesson rhythm and homework.",
      "Avoid hard-sales vocabulary unless user explicitly asks for selling mechanics."
    ];
  }

  if (domain === "psychology") {
    return [
      "Domain: psychology. Keep language careful, humane, and practical for client communication.",
      "No manipulative pressure, no aggressive selling language."
    ];
  }

  if (domain === "health") {
    return [
      "Domain: health. Prioritize clarity, trust, and understandable explanations over hype.",
      "Avoid miracle claims and loud marketing clichés."
    ];
  }

  if (domain === "fitness") {
    return [
      "Domain: fitness. Use concrete routine, consistency, load, recovery and return-to-training angles.",
      "Avoid generic motivational slogans without actionable steps."
    ];
  }

  if (domain === "beauty") {
    return [
      "Domain: beauty. Use client journey: first visit, repeat booking, trust, service value.",
      "Avoid abstract business jargon."
    ];
  }

  if (domain === "finance") {
    return [
      "Domain: finance. Explain through risk, decisions, scenario outcomes and client confidence.",
      "No clickbait promises or unrealistic certainty."
    ];
  }

  if (domain === "creator") {
    return [
      "Domain: creator/personal brand. Keep voice native for social media and practical content creation.",
      "Avoid sterile corporate wording."
    ];
  }

  if (domain === "sales") {
    return [
      "Domain: commercial growth. Keep copy persuasive but specific and human, not pushy.",
      "Use sales language only where it is contextually relevant."
    ];
  }

  return [
    "Domain: mixed/general. Stay close to the topic semantics and avoid importing sales jargon by default."
  ];
}

function buildUserPrompt(
  topic: string,
  flow: CarouselSlideRole[],
  options?: GenerationOptions,
  promptVariant: PromptVariant = "B"
) {
  const topicDomain = resolveTopicDomain(topic, options);
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
    `Detected domain: ${topicDomain}`,
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
    "Bullets must be concise but meaningful: 3-4 bullets when natural, each ~10-24 words with concrete detail instead of generic slogans.",
    "For problem/amplify/consequence/solution include at least one concrete symptom, cost, or action in bullets.",
    "Avoid abstract bullets like «важно понимать», «нужно просто», «улучшить процесс» without a concrete situation.",
    "No ellipsis («...» or «…») and no unfinished tails. Every line must end as a complete thought.",
    "Avoid ultra-short list items (<5 words) unless it is a metric or a strict action command.",
    "Keep wording topic-specific. Avoid universal sales jargon if topic is not sales-related.",
    "Do not use broken hook syntax like «эксперту повысить: ...» or «психологу объяснять: ...».",
    ...buildDomainPromptAddendum(topicDomain),
    "Avoid stale templates like «в теме ...», «одна ошибка ...», «где ломается поток ...».",
    "Avoid generic headings like «Что делать по шагам», «Что это значит для вас», «Что изменится, если оставить как есть».",
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
              items: { type: "string", maxLength: 150 }
            },
            before: { type: ["string", "null"], maxLength: 190 },
            after: { type: ["string", "null"], maxLength: 190 }
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
          ? sanitizeCopyText(
              normalizeText(current.subtitle, HOOK_SUBTITLE_INPUT_MAX),
              HOOK_SUBTITLE_OUTPUT_MAX
            )
          : "";
      const hookCopy = [normalizedTitle, safeSubtitle].filter(Boolean).join(" ");
      const hookTopicMismatch = !isCopyTopicAligned(hookCopy, topic);
      const hookAnchorMismatch = !hasPrimaryTopicAnchor(hookCopy, topic);
      const hookLooksAwkward = hasAwkwardHookTitle(normalizedTitle);

      if (!normalizedTitle || hasGenericMistakeLead || hookTopicMismatch || hookAnchorMismatch || hookLooksAwkward) {
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
      typeof hook.subtitle === "string"
        ? sanitizeCopyText(normalizeText(hook.subtitle, HOOK_SUBTITLE_INPUT_MAX), HOOK_SUBTITLE_OUTPUT_MAX)
        : "";
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
      const normalizedSubtitle = sanitizeCopyText(
        normalizeText(hook.subtitle, HOOK_SUBTITLE_INPUT_MAX),
        HOOK_SUBTITLE_OUTPUT_MAX
      );
      const combinedHook = `${normalizedTitle} ${normalizedSubtitle}`.trim();
      const shouldRepairHook =
        !normalizedTitle ||
        hasDanglingTail(normalizedTitle) ||
        isHookEchoingTopic(normalizedTitle, topic) ||
        hasAwkwardHookTitle(normalizedTitle) ||
        startsWithGenericMistakeLead(normalizedTitle) ||
        hasLegacyTemplatePhrase(combinedHook) ||
        BANNED_TEMPLATE_PATTERNS.some((pattern) => pattern.test(combinedHook)) ||
        !hasPrimaryTopicAnchor(combinedHook, topic);
      const generatedScore = scoreHookCandidate(normalizedTitle, normalizedSubtitle);
      const candidates = buildHookCandidates(topic, options);
      const best = pickBestHookCandidate(candidates);
      const bestScore = best ? scoreHookCandidate(best.title, best.subtitle) : Number.NEGATIVE_INFINITY;
      const shouldUpgradeHook = Boolean(best && bestScore >= generatedScore + 2);

      if (shouldRepairHook || shouldUpgradeHook) {
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

      const anchoredHook = `${hook.title} ${hook.subtitle}`.trim();
      if (!hasPrimaryTopicAnchor(anchoredHook, topic)) {
        hook.title = addTopicAnchorToTitle(hook.title, buildTopicAnchorLabel(topic));
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
        shift.title = buildRoleTitleFallback("shift", topic, options);
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
      const normalizedSubtitle = sanitizeCopyText(
        normalizeText(cta.subtitle, CTA_SUBTITLE_INPUT_MAX),
        CTA_SUBTITLE_OUTPUT_MAX
      );
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
      const subtitle = sanitizeCopyText(
        normalizeText(hook.subtitle, HOOK_SUBTITLE_INPUT_MAX),
        HOOK_SUBTITLE_OUTPUT_MAX
      );
      const weakTitle =
        !title ||
        hasDanglingTail(title) ||
        isHookEchoingTopic(title, topic) ||
        hasAwkwardHookTitle(title) ||
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
      const strongBullets = pickStrongBullets(bullets, problemFallback.bullets);
      return {
        type: "problem",
        title:
          !title || startsWithGenericMistakeLead(title) || hasLegacyTemplatePhrase(title) || isWeakRoleTitle(title)
            ? buildRoleTitleFallback("problem", topic, options)
            : title,
        bullets: strongBullets
      };
    }

    if (role === "amplify") {
      const amplify = current as Extract<CarouselOutlineSlide, { type: "amplify" }>;
      const amplifyFallback = fallback as Extract<CarouselOutlineSlide, { type: "amplify" }>;
      const title = sanitizeTitleValue(amplify.title, 80);
      const bullets = normalizeBullets(amplify.bullets, amplifyFallback.bullets);
      const strongBullets = pickStrongBullets(bullets, amplifyFallback.bullets);
      return {
        type: "amplify",
        title:
          !title || startsWithGenericMistakeLead(title) || hasLegacyTemplatePhrase(title) || isWeakRoleTitle(title)
            ? buildRoleTitleFallback("amplify", topic, options)
            : title,
        bullets: strongBullets
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
        title: weakTitle ? buildRoleTitleFallback("mistake", topic, options) : title
      };
    }

    if (role === "consequence") {
      const consequence = current as Extract<CarouselOutlineSlide, { type: "consequence" }>;
      const consequenceFallback = fallback as Extract<CarouselOutlineSlide, { type: "consequence" }>;
      const bullets = normalizeBullets(consequence.bullets, consequenceFallback.bullets);
      const strongBullets = pickStrongBullets(bullets, consequenceFallback.bullets);
      return {
        type: "consequence",
        bullets: strongBullets
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
        title: weakTitle ? buildRoleTitleFallback("shift", topic, options) : title
      };
    }

    if (role === "solution") {
      const solution = current as Extract<CarouselOutlineSlide, { type: "solution" }>;
      const solutionFallback = fallback as Extract<CarouselOutlineSlide, { type: "solution" }>;
      const bullets = normalizeBullets(solution.bullets, solutionFallback.bullets);
      const strongBullets = pickStrongBullets(bullets, solutionFallback.bullets);
      return {
        type: "solution",
        bullets: strongBullets
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
    const subtitle = sanitizeCopyText(
      normalizeText(cta.subtitle, CTA_SUBTITLE_INPUT_MAX),
      CTA_SUBTITLE_OUTPUT_MAX
    );
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
      if (
        countWords(hook.title) < 4 ||
        countWords(hook.subtitle) < 5 ||
        isWeakRoleTitle(hook.title) ||
        hasDanglingTail(hook.title)
      ) {
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
      if (problem.bullets.some((item) => isWeakBulletText(item))) {
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
      if (amplify.bullets.some((item) => isWeakBulletText(item))) {
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
      if (consequence.bullets.some((item) => isWeakBulletText(item))) {
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
      if (solution.bullets.some((item) => isWeakBulletText(item))) {
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

function rescueWeakSlidesAfterQualityCheck(
  slides: CarouselOutlineSlide[],
  expectedFlow: CarouselSlideRole[],
  topic: string,
  options: GenerationOptions | undefined,
  reasons: string[]
) {
  const nextSlides = slides.map((slide) => ({ ...slide })) as CarouselOutlineSlide[];
  const hookIndex = expectedFlow.findIndex((role) => role === "hook");

  if (hookIndex >= 0 && nextSlides[hookIndex]?.type === "hook") {
    const hasHookIssue = reasons.some((reason) => reason.includes("hook") || reason.includes("topic"));
    if (hasHookIssue) {
      const hook = nextSlides[hookIndex] as Extract<CarouselOutlineSlide, { type: "hook" }>;
      const bestHook = pickBestHookCandidate(buildHookCandidates(topic, options));
      hook.title = bestHook?.title || buildHookFallbackTitle(topic);
      hook.subtitle = bestHook?.subtitle || buildHookFallbackSubtitle(topic);
      const anchoredHook = `${hook.title} ${hook.subtitle}`.trim();
      if (!hasPrimaryTopicAnchor(anchoredHook, topic)) {
        hook.title = addTopicAnchorToTitle(hook.title, buildTopicAnchorLabel(topic));
      }
    }
  }

  return applyFinalCopyPolish(
    enforceSlideQuality(nextSlides, expectedFlow, topic, options),
    expectedFlow,
    topic,
    options
  );
}

function isWeakBulletText(value: string) {
  const normalized = sanitizeCopyText(normalizeText(value, 140), 132).toLowerCase();
  if (!normalized) {
    return true;
  }

  if (hasLegacyTemplatePhrase(normalized)) {
    return true;
  }

  return WEAK_BULLET_PATTERNS.some((pattern) => pattern.test(normalized));
}

function pickStrongBullets(
  bullets: string[],
  fallback: string[],
  minimum = 2
) {
  const strong = bullets
    .filter((item) => countWords(item) >= 4)
    .filter((item) => !isWeakBulletText(item));

  if (strong.length >= minimum) {
    return strong.slice(0, 4);
  }

  return fallback.slice(0, 4);
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
  const cleanTopic = normalizeText(topic, 96)
    .replace(/[.?!…]+$/u, "")
    .trim();
  const topicAnchor = extractHookAnchor(topic);
  const topicDomain = resolveTopicDomain(topic, options);
  const isAdContext = /\b(реклам|клик|лендинг|заяв|лид|воронк)\b/iu.test(normalizedTopic);
  const isCallContext = /\b(звон|созвон|переговор|клиент\s+пропал)\b/iu.test(normalizedTopic);
  const goalCue = normalizeText(options?.goal ?? "", 30).toLowerCase();
  const safeQuestionAnchor = removeDanglingTail(trimToWordBoundary(cleanTopic || topicAnchor, 74));
  const canUseQuestionAnchor =
    !!safeQuestionAnchor &&
    countWords(safeQuestionAnchor) >= 4 &&
    !hasAwkwardHookTitle(safeQuestionAnchor);
  const tensionTitle =
    topicDomain === "education"
      ? "Уроки идут, а прогресса не видно: где узкое место?"
      : topicDomain === "psychology"
        ? "Слова поддержки есть, а облегчения нет: где разрыв?"
        : topicDomain === "health"
          ? "Объяснение было, а ясности у пациента нет: почему?"
          : topicDomain === "fitness"
            ? "План есть, а дисциплина срывается: где стоп-фактор?"
            : topicDomain === "beauty"
              ? "Первый визит прошел, а повтора нет: где теряется ценность?"
              : topicDomain === "finance"
                ? "Цифры есть, а решение не принимается: что мешает?"
                : topicDomain === "creator"
                  ? "Контент есть, а реакции мало: где ломается интерес?"
                  : "Шаги есть, а результат буксует: где узкое место?";

  const firstTitle = isCallContext
    ? "Созвон прошёл. Почему дальше тишина?"
    : isAdContext
      ? "Клики есть. Почему заявок нет?"
      : canUseQuestionAnchor
        ? trimToWordBoundary(
            /[?]$/u.test(safeQuestionAnchor) ? safeQuestionAnchor : `${safeQuestionAnchor}?`,
            72
          )
        : tensionTitle;

  const firstSubtitle = isCallContext
    ? "Разберём, какая фраза ломает доверие в первые 2 минуты."
    : isAdContext
      ? "Покажу, где после клика теряется доверие и деньги."
      : trimToWordBoundary(
          `Покажу, как раскрыть «${buildCompactTopicFocus(topic, 34)}» так, чтобы люди дочитывали и сохраняли.`,
          132
        );

  const candidates = [
    {
      title: trimToWordBoundary(firstTitle, 72),
      subtitle: trimToWordBoundary(firstSubtitle, 132)
    },
    {
      title: trimToWordBoundary(`Почему «${buildCompactTopicFocus(topic, 30)}» пролистывают слишком быстро?`, 72),
      subtitle: trimToWordBoundary(
        "Разберём, какая формулировка убивает интерес в первых слайдах и чем её заменить.",
        132
      )
    },
    {
      title: trimToWordBoundary(`Как сделать «${buildCompactTopicFocus(topic, 28)}» понятным и цепляющим?`, 72),
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
  if (
    startsWithGenericMistakeLead(normalizedTitle) ||
    hasLegacyTemplatePhrase(combined) ||
    hasAwkwardHookTitle(normalizedTitle)
  ) {
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
        sanitizeCopyText(normalizeText(safe.subtitle, HOOK_SUBTITLE_INPUT_MAX), HOOK_SUBTITLE_OUTPUT_MAX) ||
        buildHookFallbackSubtitle(topic)
    };
  }

  if (expectedType === "problem") {
    const rawTitle = sanitizeTitleValue(safe.title, 80);
    return {
      type: "problem",
      title:
        (rawTitle && !startsWithGenericMistakeLead(rawTitle) && !hasLegacyTemplatePhrase(rawTitle)
          ? rawTitle
          : "") || buildRoleTitleFallback("problem", topic, options),
      bullets: normalizeBullets(safe.bullets, buildRoleBulletsFallback("problem", topic, options))
    };
  }

  if (expectedType === "amplify") {
    const rawTitle = sanitizeTitleValue(safe.title, 80);
    return {
      type: "amplify",
      title:
        (rawTitle && !startsWithGenericMistakeLead(rawTitle) && !hasLegacyTemplatePhrase(rawTitle)
          ? rawTitle
          : "") || buildRoleTitleFallback("amplify", topic, options),
      bullets: normalizeBullets(safe.bullets, buildRoleBulletsFallback("amplify", topic, options))
    };
  }

  if (expectedType === "mistake") {
    const rawTitle = sanitizeTitleValue(safe.title, 92);
    return {
      type: "mistake",
      title:
        (rawTitle && !hasLegacyTemplatePhrase(rawTitle) ? rawTitle : "") ||
        buildRoleTitleFallback("mistake", topic, options)
    };
  }

  if (expectedType === "consequence") {
    return {
      type: "consequence",
      bullets: normalizeBullets(safe.bullets, buildRoleBulletsFallback("consequence", topic, options))
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
        buildRoleTitleFallback("shift", topic, options)
    };
  }

  if (expectedType === "solution") {
    return {
      type: "solution",
      bullets: normalizeBullets(safe.bullets, buildRoleBulletsFallback("solution", topic, options))
    };
  }

  if (expectedType === "example") {
    return {
      type: "example",
      before:
        sanitizeCopyText(normalizeText(safe.before, 128), 122) ||
        `До: «${topicFocus} объясняли общо, и человек терял нить»`,
      after:
        sanitizeCopyText(normalizeText(safe.after, 128), 122) ||
        `После: «Добавили конкретные шаги, и отклик по ${topicFocus} стал стабильнее»`
    };
  }

  const ctaTitle = sanitizeTitleValue(safe.title, 84);
  const goalAwareCta = buildGoalAwareCta(options?.goal, topic);
  return {
    type: "cta",
    title: ctaTitle || trimToWordBoundary("Хотите адаптацию под свою тему?", 84),
    subtitle:
      sanitizeCopyText(normalizeText(safe.subtitle, CTA_SUBTITLE_INPUT_MAX), CTA_SUBTITLE_OUTPUT_MAX) ||
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

function buildRoleTitleFallback(
  role: CarouselSlideRole,
  topic: string,
  options?: GenerationOptions
) {
  const domain = resolveTopicDomain(topic, options);
  const focus = upperFirst(buildCompactTopicFocus(topic, 44));

  const commonByRole: Record<"problem" | "amplify" | "mistake" | "shift", string[]> = {
    problem: [
      `${focus}: где начинается просадка`,
      `${focus}: что срывает результат в начале`,
      `${focus}: почему внимание теряется слишком рано`
    ],
    amplify: [
      `${focus}: почему это быстро накапливается`,
      `${focus}: чем затяжная проблема бьет дальше`,
      `${focus}: как незаметная мелочь превращается в системный провал`
    ],
    mistake: [
      `${focus}: привычный ход, который режет результат`,
      `${focus}: где шаблон подменяет смысл`,
      `${focus}: тонкая ошибка, из-за которой всё буксует`
    ],
    shift: [
      `${focus}: разворот, после которого появляется отклик`,
      `${focus}: точка, где меняется сценарий`,
      `${focus}: как перейти от хаоса к понятному шагу`
    ]
  };

  const domainByRole: Partial<Record<"problem" | "amplify" | "mistake" | "shift", string[]>> =
    buildDomainRoleTitleVariants(domain, focus);

  if (
    role === "problem" ||
    role === "amplify" ||
    role === "mistake" ||
    role === "shift"
  ) {
    const variants = domainByRole[role]?.length
      ? [...(domainByRole[role] as string[]), ...commonByRole[role]]
      : commonByRole[role];
    const maxLength = role === "mistake" || role === "shift" ? 92 : 80;
    return trimToWordBoundary(pickVariantByTopic(`${focus}-${role}-${domain}`, variants), maxLength);
  }

  return trimToWordBoundary(`${focus}: как усилить подачу на практике`, 84);
}

function buildDomainRoleTitleVariants(domain: TopicDomain, focus: string) {
  if (domain === "education") {
    return {
      problem: [
        `${focus}: почему ученики теряют ритм`,
        `${focus}: где пропадает мотивация между занятиями`
      ],
      amplify: [
        `${focus}: как паузы в практике ускоряют откат`,
        `${focus}: почему «потом доделаю» ломает прогресс`
      ],
      mistake: [
        `${focus}: шаг, который убивает вовлеченность`,
        `${focus}: где объяснение становится слишком абстрактным`
      ],
      shift: [
        `${focus}: как вернуть ощущение прогресса`,
        `${focus}: разворот в пользу регулярной практики`
      ]
    };
  }

  if (domain === "psychology") {
    return {
      problem: [
        `${focus}: где клиент теряет ясность`,
        `${focus}: почему важные различия звучат «всё одинаково»`
      ],
      amplify: [
        `${focus}: как путаница усиливает тревогу`,
        `${focus}: почему без рамки запрос застревает`
      ],
      mistake: [
        `${focus}: формулировка, которая повышает сопротивление`,
        `${focus}: где профессиональный язык мешает контакту`
      ],
      shift: [
        `${focus}: как говорить точно и бережно`,
        `${focus}: разворот к понятному действию`
      ]
    };
  }

  if (domain === "health") {
    return {
      problem: [
        `${focus}: где пациент теряет понимание`,
        `${focus}: почему рекомендации не доходят до действия`
      ],
      amplify: [
        `${focus}: как неясность влияет на приверженность`,
        `${focus}: почему общие формулировки повышают тревогу`
      ],
      mistake: [
        `${focus}: что ломает доверие в объяснении`,
        `${focus}: где термин важнее смысла для пациента`
      ],
      shift: [
        `${focus}: как объяснять по-человечески и по делу`,
        `${focus}: точка перехода к понятным шагам`
      ]
    };
  }

  if (domain === "fitness") {
    return {
      problem: [
        `${focus}: где срывается возвращение в режим`,
        `${focus}: почему мотивация тухнет после паузы`
      ],
      amplify: [
        `${focus}: как пропуски быстро откатывают результат`,
        `${focus}: почему без системы человек снова выпадает`
      ],
      mistake: [
        `${focus}: фраза, после которой клиент исчезает`,
        `${focus}: где обещание сильнее плана`
      ],
      shift: [
        `${focus}: как вернуть ритм без перегруза`,
        `${focus}: разворот к устойчивой дисциплине`
      ]
    };
  }

  if (domain === "beauty") {
    return {
      problem: [
        `${focus}: где теряются повторные записи`,
        `${focus}: почему клиент не возвращается после первого визита`
      ],
      amplify: [
        `${focus}: как тишина после визита бьет по загрузке`,
        `${focus}: почему ценность услуги не считывается`
      ],
      mistake: [
        `${focus}: шаг, который обнуляет доверие`,
        `${focus}: где сервис выглядит как «просто процедура»`
      ],
      shift: [
        `${focus}: как переводить визит в долгий цикл`,
        `${focus}: разворот к повторным визитам без скидок`
      ]
    };
  }

  if (domain === "finance") {
    return {
      problem: [
        `${focus}: где клиент перестает понимать риски`,
        `${focus}: почему решения откладываются до бесконечности`
      ],
      amplify: [
        `${focus}: как неопределенность съедает доверие`,
        `${focus}: почему «проценты» без сценариев не работают`
      ],
      mistake: [
        `${focus}: где цифры есть, а ясности нет`,
        `${focus}: ошибка в подаче, не в аналитике`
      ],
      shift: [
        `${focus}: как объяснять риск через сценарии`,
        `${focus}: разворот к уверенным решениям`
      ]
    };
  }

  if (domain === "creator") {
    return {
      problem: [
        `${focus}: где контент становится «как у всех»`,
        `${focus}: почему подписчик уходит на втором слайде`
      ],
      amplify: [
        `${focus}: как слабый ритм режет досмотры`,
        `${focus}: почему полезность не превращается в диалоги`
      ],
      mistake: [
        `${focus}: где экспертность звучит сухо`,
        `${focus}: ошибка подачи, которая убивает интерес`
      ],
      shift: [
        `${focus}: как вернуть живой темп карусели`,
        `${focus}: разворот к тексту, который сохраняют`
      ]
    };
  }

  if (domain === "sales") {
    return {
      problem: [
        `${focus}: где лиды застревают после первого контакта`,
        `${focus}: почему заявки не доходят до сделки`
      ],
      amplify: [
        `${focus}: как паузы в коммуникации сжигают спрос`,
        `${focus}: почему команда спорит вместо роста конверсии`
      ],
      mistake: [
        `${focus}: шаг, который охлаждает горячий спрос`,
        `${focus}: где скрипт звучит как шаблон`
      ],
      shift: [
        `${focus}: как перевести диалог в следующий шаг`,
        `${focus}: разворот к прогнозируемой конверсии`
      ]
    };
  }

  return {};
}

function buildRoleBulletsFallback(
  role: "problem" | "amplify" | "consequence" | "solution",
  topic: string,
  options?: GenerationOptions
) {
  const domain = resolveTopicDomain(topic, options);

  if (domain === "education") {
    if (role === "problem") {
      return [
        "Ученик понимает тему на уроке, но между занятиями быстро теряет ритм.",
        "Домашка кажется формальностью, поэтому прогресс не ощущается.",
        "Цель звучит абстрактно, и мотивация падает уже на второй неделе."
      ];
    }
    if (role === "amplify") {
      return [
        "Паузы в практике дают откат, и каждый новый урок стартует «с нуля».",
        "Без коротких побед вовлеченность тает от недели к неделе.",
        "Время уходит на возврат дисциплины вместо движения вперед."
      ];
    }
    if (role === "consequence") {
      return [
        "Часть учеников уходит, даже если программа сильная по сути.",
        "Темп группы проседает: приходится постоянно догонять базу.",
        "Преподаватель выгорает из-за постоянного «подтягивания» мотивации."
      ];
    }
    return [
      "Ставьте микро-цель на 7 дней с понятным критерием «сделано».",
      "Добавляйте короткую практику 10–15 минут между занятиями.",
      "Показывайте прогресс формулой «было -> стало» на реальных примерах."
    ];
  }

  if (domain === "psychology") {
    if (role === "problem") {
      return [
        "Клиент смешивает тревогу, выгорание и усталость в одно состояние.",
        "Профессиональные термины звучат сложно и не превращаются в действие.",
        "После сессии остаются эмоции, но не остается опоры для шага."
      ];
    }
    if (role === "amplify") {
      return [
        "Без ясной рамки человек снова возвращается в тот же цикл.",
        "Непонятные объяснения повышают сопротивление и тревожность.",
        "Каждый пропущенный шаг усиливает чувство беспомощности."
      ];
    }
    if (role === "consequence") {
      return [
        "Прогресс идет медленнее, чем мог бы при точной формулировке.",
        "Доверие к процессу падает из-за ощущения «я снова не понял».",
        "Запрос затягивается, а ресурс человека продолжает снижаться."
      ];
    }
    return [
      "Объясняйте через маркеры: признаки, триггеры и первый безопасный шаг.",
      "Давайте формулировку, которую клиент может повторить сам себе.",
      "Фиксируйте одно действие на ближайшие 24 часа."
    ];
  }

  if (domain === "health") {
    if (role === "problem") {
      return [
        "Пациент слышит диагноз, но не понимает последовательность действий.",
        "На приеме много информации сразу, ключевые шаги теряются.",
        "Риски и польза объясняются общо, поэтому растет тревога."
      ];
    }
    if (role === "amplify") {
      return [
        "Непонимание схемы лечения снижает приверженность назначениям.",
        "Часть шагов откладывается, потому что нет ясного приоритета.",
        "Повторные вопросы перегружают коммуникацию клиники."
      ];
    }
    if (role === "consequence") {
      return [
        "Растет число пропусков контроля и срывов рекомендаций.",
        "Пациент чувствует неопределенность вместо спокойной опоры.",
        "Команда тратит больше времени на повтор базовых объяснений."
      ];
    }
    return [
      "Объясняйте диагноз в 3 пунктах: что это, почему важно, что делать дальше.",
      "Давайте памятку «сегодня / на неделе / когда срочно обратиться».",
      "Проверяйте понимание одним финальным вопросом в конце приема."
    ];
  }

  if (domain === "fitness") {
    if (role === "problem") {
      return [
        "После паузы клиент боится вернуться и снова сорваться через неделю.",
        "План кажется слишком большим, поэтому старт постоянно откладывается.",
        "Результат не фиксируется, и мотивация быстро гаснет."
      ];
    }
    if (role === "amplify") {
      return [
        "Каждый пропуск усиливает ощущение «я опять не справился».",
        "Нерегулярность ломает технику и повышает риск перегруза.",
        "Восстановление занимает больше времени, чем могло бы."
      ];
    }
    if (role === "consequence") {
      return [
        "Клиент уходит из процесса, даже имея запрос и ресурс.",
        "Тренер теряет долгую работу и повторные циклы сопровождения.",
        "Прогресс рваный: усилий много, устойчивого результата нет."
      ];
    }
    return [
      "Стартуйте с мягкого протокола на 2 недели без гонки за рекордами.",
      "Фиксируйте микро-результаты: сон, энергия, самочувствие, регулярность.",
      "Добавьте короткий ритуал обратной связи после каждой тренировки."
    ];
  }

  if (domain === "beauty") {
    if (role === "problem") {
      return [
        "После первого визита клиент доволен, но не бронирует следующий.",
        "Ценность услуги не проговорена в языке результата для клиента.",
        "Коммуникация после процедуры слишком формальная и редкая."
      ];
    }
    if (role === "amplify") {
      return [
        "Пауза после визита быстро охлаждает интерес к повторной записи.",
        "Человек забывает, зачем возвращаться именно к вам, а не «куда ближе».",
        "Появляется ценовая чувствительность даже при хорошем сервисе."
      ];
    }
    if (role === "consequence") {
      return [
        "График заполняется нестабильно, выручка «качает» от недели к неделе.",
        "Приходится чаще добирать клиентов через скидки.",
        "Лояльность не формируется, и база не растет системно."
      ];
    }
    return [
      "Закрывайте визит конкретным планом следующей процедуры и сроком.",
      "Отправляйте персональный follow-up с напоминанием и микро-советом.",
      "Показывайте результат в языке выгоды клиента, а не только процесса."
    ];
  }

  if (domain === "finance") {
    if (role === "problem") {
      return [
        "Клиент слышит цифры доходности, но не понимает рамку риска.",
        "Сценарии «что будет если» не проговорены до принятия решения.",
        "Финансовые термины создают дистанцию вместо ясности."
      ];
    }
    if (role === "amplify") {
      return [
        "Неопределенность переводит решение в бесконечное «подумаю».",
        "Каждое колебание рынка усиливает тревогу и недоверие.",
        "Обсуждение упирается в спор о процентах без общей картины."
      ];
    }
    if (role === "consequence") {
      return [
        "Решение откладывается, и окно возможностей закрывается.",
        "Клиент теряет уверенность и возвращается к хаотичным действиям.",
        "Консультант тратит время на повторное объяснение базовых вещей."
      ];
    }
    return [
      "Объясняйте через 2-3 сценария: базовый, стрессовый и целевой.",
      "Фиксируйте допуск по риску до обсуждения доходности.",
      "Завершайте встречу понятным планом действий на ближайший месяц."
    ];
  }

  if (domain === "creator") {
    if (role === "problem") {
      return [
        "Сильная экспертиза звучит ровно, но без крючка на первом экране.",
        "Мысль растягивается, и читатель теряет нить уже на втором слайде.",
        "Нет конкретного действия, ради которого человек дочитывает."
      ];
    }
    if (role === "amplify") {
      return [
        "Низкий досмотр сигнализирует алгоритму, что контент «средний».",
        "Полезность есть, но она не превращается в сохранения и диалоги.",
        "Каждый следующий пост сложнее раскачать на старте."
      ];
    }
    if (role === "consequence") {
      return [
        "Охваты нестабильны, даже при регулярной публикации.",
        "Аудитория запоминает формат, но не запоминает вашу позицию.",
        "Контент-план есть, а воронка доверия не собирается."
      ];
    }
    return [
      "Делайте один слайд = одна мысль с четким микровыводом.",
      "Добавляйте контраст «до/после» или конкретный пример из практики.",
      "Закрывайте блок действием: сохранить, ответить, написать код-слово."
    ];
  }

  if (domain === "sales") {
    if (role === "problem") {
      return [
        "Заявка приходит, но первый контакт затягивается и интерес остывает.",
        "Клиент не понимает следующий шаг и откладывает решение «на потом».",
        "В диалоге много общих слов, мало точной логики под запрос."
      ];
    }
    if (role === "amplify") {
      return [
        "Паузы между касаниями увеличивают стоимость каждой сделки.",
        "Реклама продолжает лить лиды, а команда спорит о причинах провала.",
        "Чем дольше нет системы, тем ниже доходимость до оплаты."
      ];
    }
    if (role === "consequence") {
      return [
        "Горячие заявки уходят к тем, кто отвечает быстрее и точнее.",
        "Бюджет растет, а предсказуемого результата по сделкам нет.",
        "Команда выгорает из-за хаоса и взаимных претензий."
      ];
    }
    return [
      "Соберите единый сценарий: первый ответ, квалификация, следующий шаг.",
      "Поставьте SLA на ответ и follow-up касания в первые 24 часа.",
      "Раз в неделю разбирайте потерянные диалоги и правьте формулировки."
    ];
  }

  if (role === "problem") {
    return [
      "Человек видит общий посыл, но не понимает, что делать именно ему.",
      "Польза заявлена, но нет конкретного признака результата.",
      "Старт перегружен, поэтому ключевая мысль теряется до сути."
    ];
  }
  if (role === "amplify") {
    return [
      "Когда смысл неясен на старте, до финала доходит только часть аудитории.",
      "Слабый ритм снижает досмотры и обесценивает даже сильную мысль.",
      "Время и усилия уходят в контент, который не дает обратной связи."
    ];
  }
  if (role === "consequence") {
    return [
      "Экспертиза выглядит «как у всех», потому что фокус не считывается.",
      "Люди уходят без действия: не сохраняют и не возвращаются к материалу.",
      "Команда выгорает: усилий много, а стабильного результата мало."
    ];
  }
  return [
    "Начинайте с одной боли и сразу показывайте понятный выигрыш.",
    "На каждом слайде добавляйте факт: ситуацию, цифру или мини-кейс.",
    "Закрывайте блок действием, которое реально сделать сегодня."
  ];
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

  const safeQuestion = removeDanglingTail(trimToWordBoundary(cleanTopic, 74));
  if (safeQuestion && countWords(safeQuestion) >= 3) {
    return /[?]$/u.test(safeQuestion) ? safeQuestion : `${safeQuestion}?`;
  }

  const topicFocus = buildCompactTopicFocus(cleanTopic, 42);
  const variants = [
    `Где теряется внимание в «${topicFocus}»?`,
    `Почему в «${topicFocus}» пропадает отклик?`,
    `Что в «${topicFocus}» мешает дочитыванию?`,
    `Как в «${topicFocus}» включить интерес?`
  ];
  const picked = trimToWordBoundary(pickVariantByTopic(topicFocus, variants), 72);
  return removeDanglingTail(picked) || "Идея, которая усиливает ваш контент";
}

function buildHookFallbackSubtitle(topic: string) {
  const topicFocus = buildTopicFocus(topic);
  const variants = [
    `Покажу структуру по ${topicFocus}: что сказать, чтобы читатель дошёл до действия.`,
    "Разберём реальные формулировки вместо общих советов — с примерами под тему.",
    "Соберём цепочку: крючок, напряжение, разворот и ясный CTA без давления."
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

function normalizeFocusLead(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const words = trimmed.split(/\s+/u).filter(Boolean);
  const infinitiveIndex = words.findIndex((word) => /[\p{L}-]{4,}(?:ть|ти)$/iu.test(word));
  const hasDativeLead =
    infinitiveIndex >= 1 &&
    infinitiveIndex <= 3 &&
    words
      .slice(0, infinitiveIndex)
      .some((word) => /[\p{L}-]+(?:у|ю|ам|ям|е|ом|ем)$/iu.test(word));

  // Remove awkward "кому + (описание) + инфинитив" lead-ins:
  // "психологу объяснять ...", "репетитору английского удерживать ..."
  if (hasDativeLead) {
    const tail = words.slice(infinitiveIndex + 1).join(" ").trim();
    if (tail) {
      return tail;
    }
  }

  return trimmed;
}

function buildTopicFocus(topic: string) {
  const cleaned = normalizeText(topic, 120)
    .replace(/^(как|почему|зачем|что)\s+/iu, "")
    .replace(/[.?!…]+$/u, "")
    .trim();

  const leadNormalized = normalizeFocusLead(cleaned)
    .replace(/^по\s+теме\s+/iu, "")
    .replace(/^тема\s*[:—-]\s*/iu, "")
    .trim();

  if (!leadNormalized) {
    return "вашей теме";
  }

  const compact = removeDanglingTail(trimToWordBoundary(leadNormalized, 58));
  if (compact.length >= 8) {
    return compact;
  }

  return removeDanglingTail(trimToWordBoundary(leadNormalized, 52)) || "вашей теме";
}

function buildCompactTopicFocus(topic: string, maxLength = 42) {
  const focus = buildTopicFocus(topic)
    .replace(/^по\s+теме\s+/iu, "")
    .trim();

  if (!focus) {
    return "вашей теме";
  }

  return removeDanglingTail(trimToWordBoundary(focus, maxLength)) || "вашей теме";
}

function extractHookAnchor(topic: string) {
  const normalized = normalizeText(topic, 140)
    .replace(/[.?!…]+$/u, "")
    .trim();

  if (!normalized) {
    return "вашей теме";
  }

  if (normalized.length <= 74) {
    return normalized;
  }

  const parts = normalized
    .split(/[—–:]/u)
    .map((item) => item.trim())
    .filter(Boolean);

  const firstPart = parts[0];
  if (firstPart && firstPart.length >= 16) {
    return trimToWordBoundary(firstPart, 74);
  }

  return trimToWordBoundary(normalized, 74);
}

function hasDanglingTail(value: string) {
  return /\b(и|а|но|или|что|чтобы|потому|когда|где|как|если|по|в|на|для|с|к|от|из|у|до|за|без|при|о|об|обо|над|под|между|через|про|который|которого|которой|которые|первого|второго|третьего|четвертого|пятого|обычно|живой|стабильному)\s*$/iu.test(
    value.trim()
  );
}

function removeDanglingTail(value: string) {
  return value
    .replace(
      /(?:^|[\s\u00A0])(и|а|но|или|что|чтобы|потому|когда|где|как|если|по|в|на|для|с|к|от|из|у|до|за|без|при|о|об|обо|над|под|между|через|про|который|которого|которой|которые|первого|второго|третьего|четвертого|пятого|обычно|живой|стабильному)\s*$/iu,
      ""
    )
    .replace(/[,:;—–-]+\s*$/u, "")
    .trim();
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

  const withoutEllipsis = noDoubleSpaces
    .replace(/(?:\.{3,}|…+)/gu, ".")
    .replace(/\s+/gu, " ")
    .trim();

  if (!withoutEllipsis) {
    return "";
  }

  const words = withoutEllipsis.split(" ");
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

  const trimmed = trimToWordBoundary(cleaned, maxLength);
  if (!trimmed) {
    return "";
  }

  const endsWithQuestion = /[?]\s*$/u.test(trimmed);
  const endsWithExclamation = /!\s*$/u.test(trimmed);
  const endsWithTerminal = /[.?!]\s*$/u.test(trimmed);
  const withoutTerminal = trimmed.replace(/[.?!]+\s*$/u, "").trim();
  const noTail = removeDanglingTail(withoutTerminal);
  if (!noTail) {
    return "";
  }

  if (endsWithQuestion && countWords(noTail) >= 3) {
    return `${noTail}?`;
  }

  if (endsWithExclamation && countWords(noTail) >= 2) {
    return `${noTail}!`;
  }

  if (endsWithTerminal) {
    return `${noTail}.`;
  }

  return noTail;
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

function hasAwkwardHookTitle(value: string) {
  const normalized = value
    .replace(/\s+/gu, " ")
    .replace(/[«»“”„]/gu, "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return false;
  }

  return (
    /^[\p{L}-]+(?:у|ю)\s+[\p{L}-]{4,}ть\s*:/iu.test(normalized) ||
    /^[\p{L}-]+\s+[\p{L}-]{4,}ть:\s+как\b/iu.test(normalized) ||
    /«[^»]*\b(и|а|но|или|к|по|на|для|без|от)\s*»/iu.test(normalized)
  );
}

function isHookEchoingTopic(title: string, topic: string) {
  const titleNormalized = normalizeWordTokens(
    normalizeText(removeDanglingTail(title), 140)
      .replace(/[«»“”„]/gu, " ")
      .replace(/[!?.,:;—–-]+/gu, " ")
  );
  const topicNormalized = normalizeWordTokens(
    normalizeText(topic, 180)
      .replace(/[«»“”„]/gu, " ")
      .replace(/[!?.,:;—–-]+/gu, " ")
  );

  if (titleNormalized.length < 4 || topicNormalized.length < 4) {
    return false;
  }

  const titleCore = titleNormalized.filter((token) => !TOPIC_STOP_WORDS.has(token));
  const topicCore = topicNormalized.filter((token) => !TOPIC_STOP_WORDS.has(token));

  if (titleCore.length < 3 || topicCore.length < 3) {
    return false;
  }

  const titleJoined = titleCore.join(" ");
  const topicJoined = topicCore.join(" ");

  if (titleJoined === topicJoined) {
    return true;
  }

  if (
    (topicJoined.includes(titleJoined) || titleJoined.includes(topicJoined)) &&
    Math.abs(topicJoined.length - titleJoined.length) <= 14
  ) {
    return true;
  }

  return false;
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
  const cleanTitle = rawTitle
    .replace(/[,:;—–-]+\s*$/u, "")
    .replace(/[.!]+\s*$/u, "")
    .replace(/\b(и|а|но|или|что|чтобы|как|где|когда|по|в|на|для|с)\s*$/iu, "")
    .trim();
  if (!cleanTitle) {
    return "";
  }

  const words = cleanTitle.split(" ").filter(Boolean);
  if (words.length <= 2) {
    return cleanTitle;
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

  return sanitizeCopyText(compactWords.join(" "), maxLength)
    .replace(/[.!]+\s*$/u, "")
    .trim();
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

function buildPrimaryTopicAnchors(topic: string) {
  return normalizeWordTokens(normalizeText(topic, 180))
    .filter((token) => token.length >= 4 && !TOPIC_STOP_WORDS.has(token))
    .slice(0, 4);
}

function hasPrimaryTopicAnchor(copy: string, topic: string) {
  const anchors = buildPrimaryTopicAnchors(topic);
  if (!anchors.length) {
    return true;
  }

  const copyTokens = normalizeWordTokens(copy).filter(
    (token) => token.length >= 4 && !TOPIC_STOP_WORDS.has(token)
  );
  if (!copyTokens.length) {
    return false;
  }

  return anchors.some((anchor) =>
    copyTokens.some((token) => token.startsWith(anchor) || anchor.startsWith(token))
  );
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
    return removeDanglingTail(normalizedTitle) || normalizedTitle;
  }

  const anchoredTitle = trimToWordBoundary(`${normalizedTitle} — про ${topicAnchor}`, 90);
  return removeDanglingTail(anchoredTitle) || anchoredTitle;
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

function buildGoalAwareCta(goal?: string, topic?: string) {
  return buildCtaVariants(goal, topic).selected;
}

function buildCtaVariants(goal?: string, topic?: string) {
  const normalizedGoal = normalizeText(goal, 40).toLowerCase();
  const domain = resolveTopicDomain(topic ?? "");
  const focus = buildCompactTopicFocus(topic ?? "", 34);

  const aggressive = isLeadsGoal(normalizedGoal)
    ? "Напишите «ПЛАН» в директ — соберу структуру под ваши заявки."
    : pickVariantByTopic(topic ?? domain, [
        `Напишите «КАРКАС» в директ — пришлю короткий шаблон под «${focus}».`,
        `Напишите «ШАБЛОН» в директ — отправлю готовый скелет под «${focus}».`
      ]);

  const soft = isFollowersGoal(normalizedGoal)
    ? pickVariantByTopic(topic ?? domain, [
        "Сохраните пост и подпишитесь — разберу следующий кейс в этом формате.",
        "Сохраните карусель и перешлите коллеге, с кем хотите сверить подход."
      ])
    : buildDomainSoftCta(domain, focus, topic);

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

function buildDomainSoftCta(domain: TopicDomain, focus: string, topicSeed?: string) {
  const variantsByDomain: Record<TopicDomain, string[]> = {
    education: [
      "Сохраните карусель и возьмите один приём на ближайший урок.",
      "Сохраните и протестируйте один шаг на следующем занятии."
    ],
    psychology: [
      "Сохраните схему и используйте её в следующей консультации.",
      "Сохраните карусель и попробуйте один вопрос уже в ближайшей сессии."
    ],
    health: [
      "Сохраните памятку и проверьте, какой шаг можно внедрить уже сегодня.",
      "Сохраните карусель, чтобы вернуться к схеме без спешки и паники."
    ],
    fitness: [
      "Сохраните план и выполните первый шаг уже на этой неделе.",
      "Сохраните карусель и отметьте один шаг, который внедрите на ближайшей тренировке."
    ],
    beauty: [
      "Сохраните разбор и внедрите один шаг с ближайшим клиентом.",
      "Сохраните карусель и проверьте, как меняется отклик после первого шага."
    ],
    finance: [
      "Сохраните чек-лист и сверяйте с ним решения перед следующим вложением.",
      "Сохраните карусель и выберите один шаг, который снизит тревогу в финансах."
    ],
    creator: [
      "Сохраните карусель и выберите пункт, который внедрите в ближайшем посте.",
      `Сохраните разбор по «${focus}» и используйте его в следующей публикации.`
    ],
    sales: [
      "Сохраните карусель и внедрите первый шаг в работу уже сегодня.",
      "Сохраните пост и выберите один пункт, который добавите в воронку на этой неделе."
    ],
    general: [
      "Сохраните карусель и выберите первый шаг, который внедрите сегодня.",
      `Сохраните разбор по «${focus}» и вернитесь к нему перед следующей публикацией.`
    ]
  };

  return pickVariantByTopic(topicSeed ?? domain, variantsByDomain[domain] ?? variantsByDomain.general);
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
