import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { CAROUSEL_TEMPLATE_IDS } from "@/types/editor";
import type {
  CarouselProject,
  CarouselTemplateId,
  ContentModeInput,
  Slide,
  SlideFormat
} from "@/types/editor";
import type { AppDatabase, Json } from "@/types/supabase";

type RouteContext = {
  params: Promise<{ id: string }>;
};
type RouteSupabaseClient = any;
type ProjectSettings = Omit<CarouselProject, "id" | "title" | "topic" | "slides" | "createdAt" | "updatedAt">;

const TEMPLATE_ID_SET = new Set<CarouselTemplateId>(CAROUSEL_TEMPLATE_IDS);
const CONTENT_MODE_SET = new Set<ContentModeInput>([
  "auto",
  "sales",
  "expert",
  "instruction",
  "diagnostic",
  "case",
  "social"
]);

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

async function getProjectId(context: RouteContext) {
  const params = await context.params;
  return params.id;
}

async function getAuthedClient() {
  const supabase = createRouteHandlerClient<AppDatabase>({ cookies });
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null };
  }

  return { supabase: supabase as unknown as RouteSupabaseClient, user };
}

function isMissingProjectJsonColumns(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const source = error as { code?: unknown; message?: unknown };
  const code = String(source.code ?? "");
  const message = String(source.message ?? "").toLowerCase();

  return code === "42703" || code === "PGRST204" || message.includes("slides") || message.includes("settings");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toStringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeSlides(value: unknown): Slide[] {
  return Array.isArray(value) ? (value as Slide[]) : [];
}

function resolveFormat(value: unknown): SlideFormat | undefined {
  return value === "1:1" || value === "4:5" || value === "9:16" ? value : undefined;
}

function resolveTemplate(value: unknown): CarouselTemplateId | undefined {
  return typeof value === "string" && TEMPLATE_ID_SET.has(value as CarouselTemplateId)
    ? (value as CarouselTemplateId)
    : undefined;
}

function resolvePromptVariant(value: unknown) {
  return value === "A" || value === "B" ? value : undefined;
}

function resolveContentMode(value: unknown): ContentModeInput | undefined {
  return typeof value === "string" && CONTENT_MODE_SET.has(value as ContentModeInput)
    ? (value as ContentModeInput)
    : undefined;
}

function extractSettings(project: CarouselProject): ProjectSettings {
  return {
    format: project.format,
    theme: project.theme,
    promptVariant: project.promptVariant,
    contentMode: project.contentMode,
    niche: project.niche,
    audience: project.audience,
    tone: project.tone,
    goal: project.goal,
    language: project.language ?? "ru",
    schemaVersion: project.schemaVersion ?? 1,
    caption: project.caption ?? null
  };
}

function projectFromJsonRow(row: {
  id: string;
  title: string;
  topic: string;
  slides?: Json | null;
  settings?: Json | null;
  created_at?: string | null;
  updated_at?: string | null;
}) {
  const settings = isRecord(row.settings) ? row.settings : {};

  return {
    id: row.id,
    title: row.title,
    topic: row.topic,
    format: resolveFormat(settings.format) ?? "1:1",
    theme: resolveTemplate(settings.theme) ?? "light",
    promptVariant: resolvePromptVariant(settings.promptVariant) ?? "B",
    contentMode: resolveContentMode(settings.contentMode) ?? "auto",
    niche: typeof settings.niche === "string" ? settings.niche : undefined,
    audience: typeof settings.audience === "string" ? settings.audience : undefined,
    tone: toStringValue(settings.tone, "balanced"),
    goal: toStringValue(settings.goal, "engagement"),
    language: "ru",
    schemaVersion: Number(settings.schemaVersion ?? 1) || 1,
    caption: isRecord(settings.caption) ? (settings.caption as CarouselProject["caption"]) : null,
    slides: normalizeSlides(row.slides),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  } satisfies CarouselProject;
}

function projectFromLegacyRows(
  row: { id: string; title: string; topic: string; created_at?: string | null; updated_at?: string | null },
  slides: Array<{ id: string; name: string; background: string; elements: Json }>
) {
  return {
    id: row.id,
    title: row.title,
    topic: row.topic,
    format: "1:1",
    theme: "light",
    promptVariant: "B",
    contentMode: "auto",
    language: "ru",
    schemaVersion: 1,
    caption: null,
    slides: slides.map((slide) => ({
      id: slide.id,
      name: slide.name,
      background: slide.background,
      elements: Array.isArray(slide.elements) ? (slide.elements as Slide["elements"]) : []
    })),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  } satisfies CarouselProject;
}

function parseProjectBody(body: unknown, projectId: string) {
  const source = isRecord(body) ? body : {};
  const project = isRecord(source.project) ? source.project : source;
  const title = toStringValue(project.title, "Без названия").trim().slice(0, 120) || "Без названия";
  const topic = toStringValue(project.topic, title).trim().slice(0, 800) || title;

  return {
    id: projectId,
    title,
    topic,
    slides: normalizeSlides(project.slides),
    format: resolveFormat(project.format),
    theme: resolveTemplate(project.theme),
    promptVariant: resolvePromptVariant(project.promptVariant),
    contentMode: resolveContentMode(project.contentMode),
    niche: typeof project.niche === "string" ? project.niche : undefined,
    audience: typeof project.audience === "string" ? project.audience : undefined,
    tone: typeof project.tone === "string" ? project.tone : undefined,
    goal: typeof project.goal === "string" ? project.goal : undefined,
    language: "ru" as const,
    schemaVersion: Number(project.schemaVersion ?? 1) || 1,
    caption: isRecord(project.caption) ? (project.caption as CarouselProject["caption"]) : null
  } satisfies CarouselProject;
}

async function replaceLegacySlideRows(
  supabase: RouteSupabaseClient,
  projectId: string,
  slides: Slide[]
) {
  const { error: deleteError } = await supabase
    .from("project_slides")
    .delete()
    .eq("project_id", projectId);

  if (deleteError) {
    throw deleteError;
  }

  if (!slides.length) {
    return;
  }

  const { error: insertError } = await supabase.from("project_slides").insert(
    slides.map((slide, index) => ({
      project_id: projectId,
      position: index,
      name: slide.name,
      background: slide.background,
      elements: slide.elements as Json
    }))
  );

  if (insertError) {
    throw insertError;
  }
}

async function fetchLegacyProject(supabase: RouteSupabaseClient, projectId: string) {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,title,topic,created_at,updated_at")
    .eq("id", projectId)
    .single();

  if (projectError) {
    throw projectError;
  }

  const { data: slides, error: slidesError } = await supabase
    .from("project_slides")
    .select("id,name,background,elements")
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  if (slidesError) {
    throw slidesError;
  }

  return projectFromLegacyRows(project, slides ?? []);
}

async function patchLegacyProject(
  supabase: RouteSupabaseClient,
  projectId: string,
  project: CarouselProject
) {
  const { data, error } = await supabase
    .from("projects")
    .update({
      title: project.title,
      topic: project.topic,
      updated_at: new Date().toISOString()
    })
    .eq("id", projectId)
    .select("id,title,topic,created_at,updated_at")
    .single();

  if (error) {
    throw error;
  }

  await replaceLegacySlideRows(supabase, projectId, project.slides);

  return {
    ...project,
    id: data.id,
    createdAt: data.created_at ?? undefined,
    updatedAt: data.updated_at ?? undefined
  } satisfies CarouselProject;
}

export async function GET(_request: Request, context: RouteContext) {
  const projectId = await getProjectId(context);
  const { supabase, user } = await getAuthedClient();
  if (!user) {
    return jsonResponse({ error: "Требуется авторизация." }, 401);
  }

  const { data, error } = await supabase
    .from("projects")
    .select("id,title,topic,slides,settings,created_at,updated_at")
    .eq("id", projectId)
    .single();

  if (error) {
    if (isMissingProjectJsonColumns(error)) {
      try {
        return jsonResponse({ project: await fetchLegacyProject(supabase, projectId) });
      } catch (fallbackError) {
        console.error("Failed to load fallback project:", fallbackError);
      }
    }

    return jsonResponse({ error: "Проект не найден." }, 404);
  }

  return jsonResponse({ project: projectFromJsonRow(data) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const projectId = await getProjectId(context);
  const { supabase, user } = await getAuthedClient();
  if (!user) {
    return jsonResponse({ error: "Требуется авторизация." }, 401);
  }

  let project: CarouselProject;
  try {
    project = parseProjectBody(await request.json(), projectId);
  } catch {
    return jsonResponse({ error: "Некорректный JSON проекта." }, 400);
  }

  const { data, error } = await supabase
    .from("projects")
    .update({
      title: project.title,
      topic: project.topic,
      slides: project.slides as Json,
      settings: extractSettings(project) as Json,
      updated_at: new Date().toISOString()
    })
    .eq("id", projectId)
    .select("id,title,topic,slides,settings,created_at,updated_at")
    .single();

  if (error) {
    if (isMissingProjectJsonColumns(error)) {
      try {
        return jsonResponse({ project: await patchLegacyProject(supabase, projectId, project) });
      } catch (fallbackError) {
        console.error("Failed to patch fallback project:", fallbackError);
      }
    }

    console.error("Failed to update project:", error);
    return jsonResponse({ error: "Не удалось обновить проект." }, 500);
  }

  return jsonResponse({ project: projectFromJsonRow(data) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const projectId = await getProjectId(context);
  const { supabase, user } = await getAuthedClient();
  if (!user) {
    return jsonResponse({ error: "Требуется авторизация." }, 401);
  }

  const { error } = await supabase.from("projects").delete().eq("id", projectId);

  if (error) {
    console.error("Failed to delete project:", error);
    return jsonResponse({ error: "Не удалось удалить проект." }, 500);
  }

  return jsonResponse({ ok: true });
}
