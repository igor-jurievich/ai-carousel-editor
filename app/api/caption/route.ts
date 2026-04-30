import { NextResponse } from "next/server";
import { generateCaptionFromCarousel } from "@/lib/openai";
import type { CarouselOutlineSlide, ContentModeInput } from "@/types/editor";

export const runtime = "nodejs";

const MAX_TOPIC_CHARS = 4000;
const MIN_TOPIC_CHARS = 3;
const CONTENT_MODE_SET = new Set<ContentModeInput>([
  "auto",
  "sales",
  "expert",
  "instruction",
  "diagnostic",
  "case",
  "social"
]);

export async function POST(request: Request) {
  let body: {
    topic?: unknown;
    slides?: unknown;
    niche?: unknown;
    audience?: unknown;
    tone?: unknown;
    goal?: unknown;
    contentMode?: unknown;
  };

  try {
    body = (await request.json()) as {
      topic?: unknown;
      slides?: unknown;
      niche?: unknown;
      audience?: unknown;
      tone?: unknown;
      goal?: unknown;
      contentMode?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "Некорректный формат запроса." }, { status: 400 });
  }

  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const niche = typeof body.niche === "string" ? body.niche.trim().slice(0, 120) : "";
  const audience = typeof body.audience === "string" ? body.audience.trim().slice(0, 160) : "";
  const tone = typeof body.tone === "string" ? body.tone.trim().slice(0, 40) : "";
  const goal = typeof body.goal === "string" ? body.goal.trim().slice(0, 40) : "";
  const contentMode = resolveContentModeInput(body.contentMode);

  if (!topic) {
    return NextResponse.json({ error: "Подпись недоступна: сначала задайте тему карусели." }, { status: 400 });
  }

  if (topic.length < MIN_TOPIC_CHARS || topic.length > MAX_TOPIC_CHARS) {
    return NextResponse.json(
      { error: `Тема должна быть от ${MIN_TOPIC_CHARS} до ${MAX_TOPIC_CHARS} символов.` },
      { status: 400 }
    );
  }

  const slides = normalizeOutlineSlides(body.slides);
  if (!slides.length) {
    return NextResponse.json(
      { error: "Подпись недоступна: сначала сгенерируйте карусель." },
      { status: 400 }
    );
  }

  try {
    const caption = await generateCaptionFromCarousel({
      topic,
      slides,
      niche,
      audience,
      tone,
      goal,
      contentMode
    });

    return NextResponse.json({ caption });
  } catch (error) {
    console.error("Caption API failed:", error);
    return NextResponse.json({ error: "Не удалось сгенерировать подпись." }, { status: 500 });
  }
}

function resolveContentModeInput(value: unknown): ContentModeInput {
  if (typeof value !== "string") {
    return "auto";
  }

  const normalized = value.trim().toLowerCase();
  if (CONTENT_MODE_SET.has(normalized as ContentModeInput)) {
    return normalized as ContentModeInput;
  }

  return "auto";
}

function normalizeOutlineSlides(value: unknown): CarouselOutlineSlide[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    .map((slide) => normalizeSingleSlide(slide))
    .filter((item): item is CarouselOutlineSlide => Boolean(item));

  return normalized.slice(0, 10);
}

function normalizeSingleSlide(slide: Record<string, unknown>): CarouselOutlineSlide | null {
  const type = typeof slide.type === "string" ? slide.type : "";

  if (type === "hook" || type === "cta") {
    const title = toText(slide.title, 120);
    const subtitle = toText(slide.subtitle, 180);
    if (!title || !subtitle) {
      return null;
    }
    return { type, title, subtitle };
  }

  if (type === "problem" || type === "amplify") {
    const title = toText(slide.title, 120);
    const bullets = toTextArray(slide.bullets, 4);
    if (!title || !bullets.length) {
      return null;
    }
    return { type, title, bullets };
  }

  if (type === "mistake" || type === "shift") {
    const title = toText(slide.title, 120);
    if (!title) {
      return null;
    }
    return { type, title };
  }

  if (type === "consequence" || type === "solution") {
    const bullets = toTextArray(slide.bullets, 4);
    if (!bullets.length) {
      return null;
    }
    return { type, bullets };
  }

  if (type === "example") {
    const before = toText(slide.before, 160);
    const after = toText(slide.after, 160);
    if (!before || !after) {
      return null;
    }
    return { type, before, after };
  }

  return null;
}

function toText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.slice(0, maxLength);
}

function toTextArray(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((item) => toText(item, 140))
    .filter(Boolean)
    .slice(0, maxItems);
}
