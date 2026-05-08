import type { ContentMode, ContentModeInput } from "@/types/editor";

const VALID_CONTENT_MODES = new Set<ContentMode>([
  "sales",
  "expert",
  "instruction",
  "diagnostic",
  "case",
  "social"
]);

export function resolveContentModeInput(value: unknown): ContentModeInput {
  if (typeof value === "string" && VALID_CONTENT_MODES.has(value as ContentMode)) {
    return value as ContentMode;
  }

  return "auto";
}
