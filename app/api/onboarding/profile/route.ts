import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "@/lib/supabase";
import type {
  AppDatabase,
  AppRouteSupabaseClient,
  AppServiceSupabaseClient
} from "@/types/supabase";

export const runtime = "nodejs";

type ProfileBody = {
  name?: unknown;
  role?: unknown;
  topic?: unknown;
  login?: unknown;
};

export async function POST(request: Request) {
  const sessionClient = await createSessionClient();
  const serviceClient = createServiceRoleClient();

  if (!sessionClient || !serviceClient) {
    return NextResponse.json(
      { error: "Сервис регистрации временно недоступен." },
      { status: 500 }
    );
  }

  const {
    data: { user },
    error: userError
  } = await sessionClient.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
  }

  let body: ProfileBody;
  try {
    body = (await request.json()) as ProfileBody;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON в запросе." }, { status: 400 });
  }

  const name = normalizeProfileText(body.name, 120);
  const role = normalizeProfileText(body.role, 120);
  const topic = normalizeProfileText(body.topic, 240);
  const login = normalizeLogin(body.login);

  if (!login) {
    return NextResponse.json({ error: "Некорректный логин." }, { status: 400 });
  }

  const { error: profileError } = await serviceClient.from("profiles").upsert(
    {
      id: user.id,
      name,
      role,
      topic,
      login
    },
    {
      onConflict: "id"
    }
  );

  if (profileError) {
    console.error("Failed to save onboarding profile:", profileError);
    return NextResponse.json(
      { error: "Не удалось сохранить профиль пользователя." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

async function createSessionClient() {
  const config = getSupabasePublicConfig();
  if (!config) {
    return null;
  }

  const cookieStore = await cookies();
  const cookieAccessor = (() => cookieStore) as unknown as () => ReturnType<typeof cookies>;

  return createRouteHandlerClient<AppDatabase>(
    { cookies: cookieAccessor },
    {
      supabaseUrl: config.supabaseUrl,
      supabaseKey: config.supabaseKey
    }
  );
}

function createServiceRoleClient() {
  const config = getSupabasePublicConfig();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  if (!config || !serviceRoleKey) {
    return null;
  }

  return createClient<AppDatabase>(config.supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function normalizeProfileText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeLogin(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const localPart = value.trim().toLowerCase().split("@")[0] ?? "";
  return localPart
    .replace(/\s+/gu, "")
    .replace(/[^a-z0-9._-]/giu, "")
    .slice(0, 80);
}
