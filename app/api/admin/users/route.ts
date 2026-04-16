import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "@/lib/supabase";

export const runtime = "nodejs";

type AdminUserRow = {
  id: string;
  name: string | null;
  role: string | null;
  topic: string | null;
  credits: number | null;
  created_at: string | null;
};

type UserPatchBody = {
  userId?: unknown;
  action?: unknown;
  amount?: unknown;
};

export async function GET() {
  const sessionClient = await createSessionClient();
  const serviceClient = createServiceRoleClient();

  if (!sessionClient || !serviceClient) {
    return NextResponse.json(
      { error: "Admin API недоступен: проверь NEXT_PUBLIC_SUPABASE_* и SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 }
    );
  }

  const adminCheck = await requireAdmin(sessionClient, serviceClient);
  if (adminCheck) {
    return adminCheck;
  }

  const { data: profiles, error: profilesError } = await serviceClient
    .from("profiles")
    .select("id,name,role,topic,credits,created_at")
    .order("created_at", { ascending: false });

  if (profilesError) {
    console.error("Failed to fetch profiles for admin panel:", profilesError);
    return NextResponse.json(
      { error: "Не удалось загрузить список пользователей." },
      { status: 500 }
    );
  }

  const users = ((profiles ?? []) as AdminUserRow[]).map((profile) => ({
    id: profile.id,
    name: profile.name,
    role: profile.role,
    topic: profile.topic,
    credits: Number.isFinite(Number(profile.credits)) ? Number(profile.credits) : 0,
    createdAt: profile.created_at
  }));

  return NextResponse.json({ users });
}

export async function PATCH(request: Request) {
  const sessionClient = await createSessionClient();
  const serviceClient = createServiceRoleClient();

  if (!sessionClient || !serviceClient) {
    return NextResponse.json(
      { error: "Admin API недоступен: проверь NEXT_PUBLIC_SUPABASE_* и SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 }
    );
  }

  const adminCheck = await requireAdmin(sessionClient, serviceClient);
  if (adminCheck) {
    return adminCheck;
  }

  let body: UserPatchBody;
  try {
    body = (await request.json()) as UserPatchBody;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON в запросе." }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const action = typeof body.action === "string" ? body.action : "";

  if (!userId) {
    return NextResponse.json({ error: "Не передан userId." }, { status: 400 });
  }

  if (action !== "add" && action !== "reset") {
    return NextResponse.json({ error: "Неизвестное действие." }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (action === "add" && (!Number.isInteger(amount) || amount <= 0)) {
    return NextResponse.json({ error: "amount должен быть положительным целым числом." }, { status: 400 });
  }

  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("Failed to load target profile for credits update:", profileError);
    return NextResponse.json({ error: "Не удалось загрузить профиль пользователя." }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Пользователь не найден." }, { status: 404 });
  }

  const currentCredits = Number.isFinite(Number(profile.credits)) ? Number(profile.credits) : 0;
  const nextCredits = action === "reset" ? 5 : currentCredits + amount;
  const logReason = action === "reset" ? "admin_reset" : "admin_top_up";
  const logAmount = action === "reset" ? 5 - currentCredits : amount;

  const { error: updateError } = await serviceClient
    .from("profiles")
    .update({ credits: nextCredits })
    .eq("id", userId);

  if (updateError) {
    console.error("Failed to update user credits:", updateError);
    return NextResponse.json({ error: "Не удалось обновить баллы." }, { status: 500 });
  }

  const { error: logError } = await serviceClient.from("credits_log").insert({
    user_id: userId,
    amount: logAmount,
    reason: logReason
  });

  if (logError) {
    console.error("Failed to write credits log for admin action:", logError);

    const { error: rollbackError } = await serviceClient
      .from("profiles")
      .update({ credits: currentCredits })
      .eq("id", userId);

    if (rollbackError) {
      console.error("Failed to rollback credits after log insert error:", rollbackError);
    }

    return NextResponse.json({ error: "Не удалось записать историю изменения баллов." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    credits: nextCredits
  });
}

async function createSessionClient() {
  const config = getSupabasePublicConfig();
  if (!config) {
    return null;
  }

  const cookieStore = await cookies();

  return createRouteHandlerClient(
    { cookies: (() => cookieStore) as any },
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

  return createClient(config.supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function requireAdmin(sessionClient: any, serviceClient: any) {
  const {
    data: { user },
    error: userError
  } = await sessionClient.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.is_admin) {
    return NextResponse.json({ error: "Доступ разрешён только администратору." }, { status: 403 });
  }

  return null;
}
