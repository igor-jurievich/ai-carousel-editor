import { fal } from "@fal-ai/client";

// fal.ai GPT Image 2 — лучшая на сегодня модель по адхеренсу промпта и рендеру
// текста, поэтому она основная для картинок карусели. OpenAI gpt-image остаётся
// фолбэком на стороне вызывающего кода (см. app/api/generate/route.ts).
const DEFAULT_FAL_IMAGE_MODEL = "fal-ai/gpt-image-2";

let configured = false;

function ensureConfigured() {
  const credentials = (process.env.FAL_KEY ?? "").trim();
  if (!credentials) {
    return false;
  }

  if (!configured) {
    fal.config({ credentials });
    configured = true;
  }

  return true;
}

export function isFalImageConfigured() {
  return Boolean((process.env.FAL_KEY ?? "").trim());
}

function resolveFalImageModel() {
  const raw = (process.env.FAL_IMAGE_MODEL ?? "").trim();
  return raw || DEFAULT_FAL_IMAGE_MODEL;
}

type FalImagePayload = { url?: unknown };
type FalSubscribeResult = { data?: { images?: FalImagePayload[] } | null } | null;

/**
 * Генерирует одно изображение через fal GPT Image 2 и возвращает сырой base64
 * (без префикса data:), чтобы совпадать с контрактом OpenAI-пути (b64_json).
 */
export async function generateImageViaFal(options: { prompt: string }): Promise<string> {
  if (!ensureConfigured()) {
    throw new Error("FAL_KEY is not configured.");
  }

  const result = (await fal.subscribe(resolveFalImageModel(), {
    input: {
      prompt: options.prompt,
      image_size: "square_hd",
      quality: "high",
      num_images: 1,
      output_format: "jpeg",
      // sync_mode возвращает картинку как data-URI прямо в ответе — без второго запроса.
      sync_mode: true
    }
  })) as FalSubscribeResult;

  const image = result?.data?.images?.[0];
  const url = image && typeof image.url === "string" ? image.url : "";
  if (!url) {
    throw new Error("fal image response did not include an image URL.");
  }

  return await falImageUrlToBase64(url);
}

async function falImageUrlToBase64(url: string): Promise<string> {
  const dataUri = url.match(/^data:[^;,]+;base64,(.+)$/);
  if (dataUri?.[1]) {
    return dataUri[1];
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download fal image (status ${response.status}).`);
  }

  const base64 = Buffer.from(await response.arrayBuffer()).toString("base64");
  if (base64.length < 16) {
    throw new Error("fal image payload was empty.");
  }

  return base64;
}
