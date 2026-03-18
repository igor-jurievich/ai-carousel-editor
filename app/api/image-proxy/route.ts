import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_PROXY_TIMEOUT_MS = 9000;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const source = url.searchParams.get("src")?.trim() ?? "";

  if (!source) {
    return NextResponse.json({ error: "Не указан источник изображения." }, { status: 400 });
  }

  let parsedSource: URL;

  try {
    parsedSource = new URL(source);
  } catch {
    return NextResponse.json({ error: "Некорректный URL изображения." }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsedSource.protocol)) {
    return NextResponse.json({ error: "Поддерживаются только HTTP/HTTPS изображения." }, { status: 400 });
  }

  if (isPrivateOrLocalHost(parsedSource.hostname)) {
    return NextResponse.json({ error: "Источник изображения заблокирован." }, { status: 403 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), IMAGE_PROXY_TIMEOUT_MS);

  try {
    const upstream = await fetch(parsedSource.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "ai-carousel-editor/1.0"
      }
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: "Не удалось загрузить изображение из интернета." },
        { status: 502 }
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Источник не является изображением." }, { status: 415 });
    }

    const arrayBuffer = await upstream.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Изображение слишком большое для обработки." },
        { status: 413 }
      );
    }

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400"
      }
    });
  } catch {
    return NextResponse.json(
      { error: "Не удалось получить изображение. Попробуйте другую тему." },
      { status: 504 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function isPrivateOrLocalHost(hostname: string) {
  const value = hostname.trim().toLowerCase();

  if (!value) {
    return true;
  }

  if (
    value === "localhost" ||
    value === "127.0.0.1" ||
    value === "::1" ||
    value.endsWith(".local")
  ) {
    return true;
  }

  if (/^(10\.|127\.|169\.254\.|192\.168\.)/.test(value)) {
    return true;
  }

  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(value)) {
    return true;
  }

  return false;
}
