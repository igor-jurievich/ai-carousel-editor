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

export function normalizeCredits(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.trunc(numeric));
}
