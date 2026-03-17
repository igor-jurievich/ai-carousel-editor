export const MIN_SLIDES_COUNT = 5;
export const MAX_SLIDES_COUNT = 12;
export const DEFAULT_SLIDES_COUNT = 7;
export const SLIDES_COUNT_OPTIONS = [5, 7, 10, 12] as const;

export function clampSlidesCount(value?: number | null) {
  if (!Number.isFinite(value)) {
    return DEFAULT_SLIDES_COUNT;
  }

  return Math.max(MIN_SLIDES_COUNT, Math.min(MAX_SLIDES_COUNT, Math.round(Number(value))));
}
