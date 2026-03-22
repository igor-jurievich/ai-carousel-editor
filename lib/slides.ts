export const MIN_SLIDES_COUNT = 8;
export const MAX_SLIDES_COUNT = 10;
export const DEFAULT_SLIDES_COUNT = 9;
export const SLIDES_COUNT_OPTIONS = [8, 9, 10] as const;

export function clampSlidesCount(value?: number | null) {
  if (!Number.isFinite(value)) {
    return DEFAULT_SLIDES_COUNT;
  }

  return Math.max(MIN_SLIDES_COUNT, Math.min(MAX_SLIDES_COUNT, Math.round(Number(value))));
}
