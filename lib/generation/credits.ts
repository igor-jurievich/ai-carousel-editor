import type { AppServiceSupabaseClient } from "@/types/supabase";

export type GenerationCreditsReason = "carousel_text" | "carousel_with_images";
export type CreditsClients = { serviceClient: AppServiceSupabaseClient };

export async function deductCredits(params: {
  clients: CreditsClients;
  userId: string;
  amount: number;
  reason: GenerationCreditsReason;
}) {
  const { clients, userId, amount, reason } = params;
  const creditsToCharge = Math.max(1, Math.trunc(amount));

  const { data, error } = await clients.serviceClient
    .rpc("consume_generation_credits", {
      p_user_id: userId,
      p_amount: creditsToCharge,
      p_reason: reason
    })
    .maybeSingle();

  if (error) {
    if (isMissingConsumeCreditsRpcError(error)) {
      console.warn(
        "consume_generation_credits RPC is missing; falling back to compare-and-swap credits debit. Apply supabase/schema.sql to enable atomic debit."
      );
      return deductCreditsWithCompareAndSwap({
        clients,
        userId,
        amount: creditsToCharge,
        reason
      });
    }

    console.error("Failed to consume generation credits atomically:", error);
    return {
      ok: false as const,
      code: "failed" as const,
      message: "Не удалось списать кредиты за генерацию. Попробуйте снова."
    };
  }

  if (data?.ok) {
    return {
      ok: true as const,
      remainingCredits: normalizeCredits(data.current_credits)
    };
  }

  if (data?.code === "no_credits") {
    return {
      ok: false as const,
      code: "no_credits" as const,
      currentCredits: normalizeCredits(data.current_credits)
    };
  }

  return {
    ok: false as const,
    code: "failed" as const,
    message: data?.message || "Не удалось списать кредиты за генерацию. Попробуйте снова."
  };
}

function isMissingConsumeCreditsRpcError(error: { code?: string; message?: string }) {
  const code = String(error.code ?? "");
  const message = String(error.message ?? "").toLowerCase();

  return code === "PGRST202" || message.includes("consume_generation_credits");
}

async function deductCreditsWithCompareAndSwap(params: {
  clients: CreditsClients;
  userId: string;
  amount: number;
  reason: GenerationCreditsReason;
}) {
  const { clients, userId, amount, reason } = params;
  const creditsToCharge = Math.max(1, Math.trunc(amount));
  const maxAttempts = 4;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { data: profile, error: profileError } = await clients.serviceClient
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Failed to load profile before credits consume:", profileError);
      return {
        ok: false as const,
        code: "failed" as const,
        message: "Не удалось списать кредиты за генерацию. Попробуйте снова."
      };
    }

    if (!profile) {
      return {
        ok: false as const,
        code: "failed" as const,
        message: "Профиль пользователя не найден."
      };
    }

    const availableCredits = normalizeCredits(profile.credits);
    if (availableCredits < creditsToCharge) {
      return {
        ok: false as const,
        code: "no_credits" as const,
        currentCredits: availableCredits
      };
    }

    const nextCredits = availableCredits - creditsToCharge;
    const { data: updatedProfile, error: updateError } = await clients.serviceClient
      .from("profiles")
      .update({ credits: nextCredits })
      .eq("id", userId)
      .eq("credits", availableCredits)
      .select("credits")
      .maybeSingle();

    if (updateError) {
      console.error("Failed to update credits balance:", updateError);
      return {
        ok: false as const,
        code: "failed" as const,
        message: "Не удалось списать кредиты за генерацию. Попробуйте снова."
      };
    }

    if (!updatedProfile) {
      continue;
    }

    const { error: logError } = await clients.serviceClient.from("credits_log").insert({
      user_id: userId,
      amount: -creditsToCharge,
      reason
    });

    if (logError) {
      console.error("Failed to write generation credits log:", logError);

      const { error: rollbackError } = await clients.serviceClient
        .from("profiles")
        .update({ credits: availableCredits })
        .eq("id", userId)
        .eq("credits", nextCredits);

      if (rollbackError) {
        console.error("Failed to rollback credits after credits_log insert error:", rollbackError);
      }

      return {
        ok: false as const,
        code: "failed" as const,
        message: "Не удалось записать историю списания кредитов."
      };
    }

    return {
      ok: true as const,
      remainingCredits: normalizeCredits(updatedProfile.credits)
    };
  }

  return {
    ok: false as const,
    code: "failed" as const,
    message: "Не удалось списать кредиты из-за параллельной генерации. Попробуйте снова."
  };
}

export function normalizeCredits(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.trunc(numeric));
}
