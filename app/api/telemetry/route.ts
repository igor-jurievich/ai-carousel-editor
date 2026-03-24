import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_NAME_LENGTH = 80;
const MAX_PAYLOAD_CHARS = 2000;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: unknown;
      payload?: unknown;
      pathname?: unknown;
      timestamp?: unknown;
    };

    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim().slice(0, MAX_NAME_LENGTH)
        : "unknown_event";

    const pathname = typeof body.pathname === "string" ? body.pathname.slice(0, 180) : "";
    const timestamp =
      typeof body.timestamp === "string" ? body.timestamp : new Date().toISOString();

    let payload: Record<string, unknown> = {};
    if (body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)) {
      payload = body.payload as Record<string, unknown>;
    }

    const payloadString = JSON.stringify(payload).slice(0, MAX_PAYLOAD_CHARS);

    console.info("[telemetry]", name, { pathname, timestamp, payload: payloadString });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
