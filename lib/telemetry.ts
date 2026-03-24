export type TelemetryEventName =
  | "generate_started"
  | "generate_succeeded"
  | "generate_failed"
  | "editor_opened"
  | "slide_selected"
  | "photo_slot_toggled"
  | "asset_uploaded"
  | "export_clicked"
  | "export_succeeded"
  | "caption_generated"
  | "caption_copied";

export type TelemetryPayload = Record<string, unknown>;

type TrackEventInput = {
  name: TelemetryEventName;
  payload?: TelemetryPayload;
};

const ENDPOINT = "/api/telemetry";

export function trackEvent(input: TrackEventInput) {
  if (typeof window === "undefined") {
    return;
  }

  const body = JSON.stringify({
    name: input.name,
    payload: input.payload ?? {},
    pathname: window.location.pathname,
    timestamp: new Date().toISOString()
  });

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(ENDPOINT, blob)) {
        return;
      }
    }

    void fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body,
      keepalive: true
    });
  } catch {
    // Telemetry must never block product actions.
  }
}
