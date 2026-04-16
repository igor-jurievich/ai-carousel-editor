import {
  createClientComponentClient
} from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CarouselProject,
  CarouselProjectSummary,
  Slide
} from "@/types/editor";

type DatabaseClient = SupabaseClient;
const STORAGE_BUCKET = "carousel-assets";
const KNOWN_SUPABASE_URL_TYPO = "https://mpklqwogzhxivijebcwl.supabase.co";
const KNOWN_SUPABASE_URL_CORRECT = "https://mpklqwogzhxiwijebcwl.supabase.co";

let browserClient: DatabaseClient | null = null;

function resolveSupabaseUrl(rawUrl: string | undefined) {
  const value = (rawUrl ?? "").trim();
  if (!value) {
    return value;
  }

  if (value === KNOWN_SUPABASE_URL_TYPO) {
    return KNOWN_SUPABASE_URL_CORRECT;
  }

  return value;
}

export function getSupabasePublicConfig() {
  const supabaseUrl = resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return {
    supabaseUrl,
    supabaseKey
  };
}

export function isSupabaseConfigured() {
  return Boolean(getSupabasePublicConfig());
}

export function getSupabaseBrowserClient() {
  const config = getSupabasePublicConfig();
  if (!config || typeof window === "undefined") {
    return null;
  }

  if (!browserClient) {
    browserClient = createClientComponentClient({
      supabaseUrl: config.supabaseUrl,
      supabaseKey: config.supabaseKey
    }) as DatabaseClient;
  }

  return browserClient;
}

export function createSupabaseClientComponentClient() {
  const config = getSupabasePublicConfig();
  if (!config) {
    return null;
  }
  return createClientComponentClient({
    supabaseUrl: config.supabaseUrl,
    supabaseKey: config.supabaseKey
  }) as DatabaseClient;
}

export async function createSupabaseServerComponentClient() {
  const config = getSupabasePublicConfig();
  if (!config) {
    return null;
  }

  const [{ createServerComponentClient }, { cookies }] = await Promise.all([
    import("@supabase/auth-helpers-nextjs"),
    import("next/headers")
  ]);

  return createServerComponentClient(
    { cookies },
    {
      supabaseUrl: config.supabaseUrl,
      supabaseKey: config.supabaseKey
    }
  ) as DatabaseClient;
}

function mapSlides(rows: Array<{ id: string; name: string; background: string; elements: Slide["elements"] }>): Slide[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    background: row.background,
    elements: row.elements
  }));
}

export async function signInWithOtp(email: string) {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await supabase.auth.signInWithOtp({ email });

  if (error) {
    throw error;
  }
}

export async function signOut() {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    return;
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export async function fetchCurrentUserEmail() {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { session }
  } = await supabase.auth.getSession();

  return session?.user.email ?? null;
}

export async function fetchProjects() {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    return [] as CarouselProjectSummary[];
  }

  const { data, error } = await supabase
    .from("projects")
    .select("id,title,topic,updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) => ({
    id: item.id as string,
    title: item.title as string,
    topic: item.topic as string,
    updatedAt: item.updated_at as string
  }));
}

export async function fetchProject(projectId: string) {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,title,topic")
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

  return {
    id: project.id as string,
    title: project.title as string,
    topic: project.topic as string,
    slides: mapSlides(
      (slides ?? []) as Array<{
        id: string;
        name: string;
        background: string;
        elements: Slide["elements"];
      }>
    )
  } satisfies CarouselProject;
}

export async function saveProject(project: CarouselProject) {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Sign in to save projects.");
  }

  let projectId = project.id;

  if (projectId) {
    const { error } = await supabase
      .from("projects")
      .update({
        title: project.title,
        topic: project.topic,
        updated_at: new Date().toISOString()
      })
      .eq("id", projectId);

    if (error) {
      throw error;
    }
  } else {
    const { data, error } = await supabase
      .from("projects")
      .insert({
        title: project.title,
        topic: project.topic,
        user_id: user.id
      })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    projectId = data.id as string;
  }

  const { error: deleteError } = await supabase
    .from("project_slides")
    .delete()
    .eq("project_id", projectId);

  if (deleteError) {
    throw deleteError;
  }

  const slideRows = project.slides.map((slide, index) => ({
    project_id: projectId,
    position: index,
    name: slide.name,
    background: slide.background,
    elements: slide.elements
  }));

  const { error: insertError } = await supabase
    .from("project_slides")
    .insert(slideRows);

  if (insertError) {
    throw insertError;
  }

  return projectId;
}

export async function uploadImageToStorage(file: File) {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Sign in to upload images to Supabase Storage.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  const filePath = `${user.id}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, file, {
    cacheControl: "3600",
    upsert: false
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);

  return data.publicUrl;
}
