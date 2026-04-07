"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import useImage from "use-image";
import {
  Group,
  Image as KonvaImage,
  Layer,
  Rect,
  Stage,
  Text,
  Transformer
} from "react-konva";
import type { CanvasElement, ImageElement, ShapeElement, Slide, TextElement } from "@/types/editor";

type SlideStageProps = {
  slide: Slide;
  width: number;
  height: number;
  canvasWidth: number;
  canvasHeight: number;
  selectedElementId?: string | null;
  interactive?: boolean;
  onSelectElement?: (elementId: string | null) => void;
  onUpdateElementPosition?: (elementId: string, x: number, y: number) => void;
  onTransformElement?: (elementId: string, updates: Record<string, number>) => void;
  onStartTextEditing?: (elementId: string) => void;
  onRequestSlidePhotoUpload?: (slideId: string) => void;
  hiddenElementId?: string | null;
  stageRef?: (node: Konva.Stage | null) => void;
  showSlideBadge?: boolean;
};

type SafeArea = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type DragBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

type SnapGuides = {
  vertical: number[];
  horizontal: number[];
};

const SNAP_THRESHOLD = 10;
const ROTATION_SNAP_VALUES = [-180, -90, 0, 90, 180];
const ROTATION_SNAP_THRESHOLD = 6;
const EMPTY_GUIDES: SnapGuides = { vertical: [], horizontal: [] };
const NON_INTERACTIVE_TEXT_META_KEYS = new Set<string>([
  "managed-title-accent-text",
  "slide-chip-text",
  "image-placeholder-text"
]);
const NON_CONTENT_TEXT_META_KEYS = new Set<string>([
  "slide-chip-text",
  "managed-title-accent-text",
  "profile-handle",
  "footer-counter",
  "profile-subtitle",
  "footer-arrow",
  "image-placeholder-text"
]);
const MANAGED_TEXT_META_KEYS = new Set<string>(["managed-title", "managed-body"]);
const UI_ACCENT = "#2caea1";
const UI_ACCENT_SOFT = "rgba(86, 207, 194, 0.24)";
const UI_ACCENT_FAINT = "rgba(86, 207, 194, 0.12)";
const UI_ACCENT_GUIDE = "rgba(86, 207, 194, 0.72)";
const LEGACY_ACCENT_TEXT_COLORS = new Set(["#ffffff", "#fff", "#f5f7ff", "#f7f9ff"]);
const LEGACY_ACCENT_CHIP_HEX_COLORS = new Set([
  "#1f49ff",
  "#254fff",
  "#325cff",
  "#3b5fff",
  "#4366ff",
  "#4a6dff",
  "#5676ff",
  "#ff2d00",
  "#ff3a1a",
  "#ff421f",
  "#ff4a25",
  "#ff552f",
  "#ff5e3d",
  "#ff6b3d",
  "#ff2a2a"
]);

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function resolveElementOpacity(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(0, Math.min(1, value as number));
}

function resolveLikelyManagedTitle(slide: Slide) {
  const preferredTitle = resolvePreferredManagedTextByMeta(slide, "managed-title");
  if (preferredTitle) {
    return preferredTitle;
  }
  return (
    slide.elements.find(
      (element): element is TextElement =>
        element.type === "text" &&
        (element.metaKey === "managed-title" || element.role === "title")
    ) ??
    slide.elements.find(
      (element): element is TextElement =>
        element.type === "text" &&
        !NON_CONTENT_TEXT_META_KEYS.has(element.metaKey ?? "")
    ) ??
    null
  );
}

function normalizeLegacyColorToken(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function parseRgbColor(value: string | undefined) {
  const normalized = normalizeLegacyColorToken(value);
  const match = normalized.match(/^rgba?\(([^)]+)\)$/u);
  if (!match) {
    return null;
  }
  const parts = match[1]
    .split(",")
    .map((chunk) => Number.parseFloat(chunk.trim()))
    .filter((chunk) => Number.isFinite(chunk));
  if (parts.length < 3) {
    return null;
  }
  return {
    r: parts[0],
    g: parts[1],
    b: parts[2]
  };
}

function isCloseRgbColor(
  color: { r: number; g: number; b: number } | null,
  target: { r: number; g: number; b: number }
) {
  if (!color) {
    return false;
  }
  return (
    Math.abs(color.r - target.r) <= 18 &&
    Math.abs(color.g - target.g) <= 18 &&
    Math.abs(color.b - target.b) <= 18
  );
}

function isLikelyLegacyAccentChipColor(fill: string | undefined) {
  const normalized = normalizeLegacyColorToken(fill);
  if (!normalized) {
    return false;
  }
  if (LEGACY_ACCENT_CHIP_HEX_COLORS.has(normalized)) {
    return true;
  }
  const rgb = parseRgbColor(normalized);
  return (
    isCloseRgbColor(rgb, { r: 31, g: 73, b: 255 }) ||
    isCloseRgbColor(rgb, { r: 255, g: 45, b: 0 }) ||
    isCloseRgbColor(rgb, { r: 255, g: 42, b: 42 })
  );
}

function resolvePreferredManagedTextByMeta(slide: Slide, metaKey: "managed-title" | "managed-body") {
  const candidates = slide.elements.filter(
    (element): element is TextElement => element.type === "text" && element.metaKey === metaKey
  );
  if (!candidates.length) {
    return null;
  }
  return [...candidates].sort((left, right) => {
    const leftLength = normalizeLegacyToken(left.text).length;
    const rightLength = normalizeLegacyToken(right.text).length;
    if (leftLength !== rightLength) {
      return rightLength - leftLength;
    }
    if (metaKey === "managed-title") {
      return left.y - right.y;
    }
    return left.y - right.y;
  })[0];
}

function resolveSafeArea(canvasWidth: number, canvasHeight: number, stageWidth: number): SafeArea {
  const mobileLike = stageWidth <= 420;
  const insetX = mobileLike ? 26 : 58;
  const insetTop = mobileLike ? 26 : 58;
  const insetBottom = mobileLike ? 38 : 74;
  const right = Math.max(insetX, canvasWidth - insetX);
  const bottom = Math.max(insetTop, canvasHeight - insetBottom);

  return {
    left: insetX,
    right,
    top: insetTop,
    bottom
  };
}

function resolveDragBounds(
  element: CanvasElement,
  canvasWidth: number,
  canvasHeight: number,
  safeArea: SafeArea,
  width = element.width,
  height = element.height
): DragBounds {
  const measuredTextHeight =
    element.type === "text" ? Math.max(height, estimateTextHeight(element, width) + 14) : height;
  const effectiveHeight = measuredTextHeight;
  const textBleedX = element.type === "text" ? Math.min(26, Math.round(width * 0.08)) : 0;
  const textBleedY = element.type === "text" ? Math.min(20, Math.round(effectiveHeight * 0.08)) : 0;
  const safeMinX = Math.max(0, safeArea.left - textBleedX);
  const safeMaxX = Math.min(canvasWidth - width, safeArea.right - width + textBleedX);
  const safeMinY = Math.max(0, safeArea.top - textBleedY);
  const safeMaxY = Math.min(canvasHeight - effectiveHeight, safeArea.bottom - effectiveHeight + textBleedY);
  const safeWidth = Math.max(60, safeArea.right - safeArea.left);
  const safeHeight = Math.max(40, safeArea.bottom - safeArea.top);
  const useCanvasX = width > safeWidth + textBleedX * 2;
  const useCanvasY = effectiveHeight > safeHeight + textBleedY * 2;

  const minX = useCanvasX ? 0 : safeMinX;
  const maxX = useCanvasX ? Math.max(0, canvasWidth - width) : Math.max(minX, safeMaxX);
  const minY = useCanvasY ? 0 : safeMinY;
  const maxY = useCanvasY
    ? Math.max(0, canvasHeight - effectiveHeight)
    : Math.max(minY, safeMaxY);

  return {
    minX,
    maxX,
    minY,
    maxY
  };
}

function clampPosition(position: { x: number; y: number }, bounds: DragBounds) {
  return {
    x: clamp(position.x, bounds.minX, bounds.maxX),
    y: clamp(position.y, bounds.minY, bounds.maxY)
  };
}

function estimateTextHeight(element: TextElement, width: number) {
  const lineHeight = element.lineHeight ?? 1.1;
  const approxCharsPerLine = Math.max(6, Math.floor(width / Math.max(8, element.fontSize * 0.66)));
  const paragraphs = element.text.replace(/\r/g, "").split("\n");
  let lines = 0;

  for (const paragraph of paragraphs) {
    const normalized = paragraph.trim();
    if (!normalized) {
      lines += 1;
      continue;
    }
    lines += Math.max(1, Math.ceil(normalized.length / approxCharsPerLine));
  }

  return Math.ceil(lines * element.fontSize * lineHeight + element.fontSize * 0.4);
}

function resolveFontWeight(fontStyle?: string) {
  if (!fontStyle) {
    return "700";
  }
  const normalized = fontStyle.toLowerCase();
  if (normalized.includes("bold")) {
    return "700";
  }
  if (normalized.includes("500")) {
    return "500";
  }
  return "400";
}

let textMeasureCanvas: HTMLCanvasElement | null = null;

function measureTextWidth(value: string, element: TextElement) {
  if (!value) {
    return 0;
  }
  if (typeof document !== "undefined") {
    try {
      if (!textMeasureCanvas) {
        textMeasureCanvas = document.createElement("canvas");
      }
      const context = textMeasureCanvas.getContext("2d");
      if (context) {
        context.font = `${resolveFontWeight(element.fontStyle)} ${element.fontSize}px "${element.fontFamily}", sans-serif`;
        const width = context.measureText(value).width;
        if (Number.isFinite(width) && width > 0) {
          return width;
        }
      }
    } catch {
      // noop fallback below
    }
  }
  return value.length * element.fontSize * 0.58;
}

function measureLineWidth(value: string, element: TextElement) {
  if (!value) {
    return 0;
  }
  const base = measureTextWidth(value, element);
  const letterSpacing = element.letterSpacing ?? 0;
  return base + Math.max(0, value.length - 1) * letterSpacing;
}

function normalizeTextHighlights(element: TextElement) {
  const textLength = element.text.length;
  if (!element.highlights?.length || textLength <= 0) {
    return [] as Array<{ start: number; end: number; color: string; opacity: number }>;
  }

  const normalized = element.highlights
    .map((item) => {
      const source = item && typeof item === "object" ? item : null;
      const startSource = source && Number.isFinite(source.start) ? source.start : 0;
      const endSource = source && Number.isFinite(source.end) ? source.end : 0;
      const colorSource = source && typeof source.color === "string" ? source.color : "#1f49ff";
      const opacitySource =
        source && Number.isFinite(source.opacity) ? (source.opacity as number) : 0.94;
      return {
        start: Math.max(0, Math.min(textLength, Math.floor(startSource))),
        end: Math.max(0, Math.min(textLength, Math.floor(endSource))),
        color: colorSource || "#1f49ff",
        opacity: Math.max(0.08, Math.min(1, opacitySource))
      };
    })
    .filter((item) => item.end > item.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  if (!normalized.length) {
    return [];
  }

  const merged: Array<{ start: number; end: number; color: string; opacity: number }> = [];
  for (const item of normalized) {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      item.start <= previous.end &&
      item.color.toLowerCase() === previous.color.toLowerCase() &&
      Math.abs(item.opacity - previous.opacity) < 0.0001
    ) {
      previous.end = Math.max(previous.end, item.end);
      continue;
    }
    merged.push(item);
  }

  return merged;
}

function splitLongTokenByWidth(token: string, maxWidth: number, element: TextElement) {
  if (!token) {
    return [] as string[];
  }

  const chunks: string[] = [];
  let buffer = "";
  for (const char of token) {
    const candidate = `${buffer}${char}`;
    if (!buffer || measureLineWidth(candidate, element) <= maxWidth) {
      buffer = candidate;
      continue;
    }

    chunks.push(buffer);
    buffer = char;
  }

  if (buffer) {
    chunks.push(buffer);
  }

  return chunks;
}

type TextLineLayout = {
  text: string;
  start: number;
  width: number;
};

function buildTextLineLayout(element: TextElement): TextLineLayout[] {
  const source = element.text.replace(/\r/g, "");
  if (!source) {
    return [];
  }

  const maxWidth = Math.max(1, element.width);
  const result: TextLineLayout[] = [];
  const paragraphs = source.split("\n");
  let globalOffset = 0;

  for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex += 1) {
    const paragraph = paragraphs[paragraphIndex] ?? "";
    const paragraphStart = globalOffset;
    globalOffset += paragraph.length;
    if (paragraphIndex < paragraphs.length - 1) {
      globalOffset += 1;
    }

    if (!paragraph) {
      result.push({ text: "", start: paragraphStart, width: 0 });
      continue;
    }

    const tokens = paragraph.split(/(\s+)/u).filter((token) => token.length > 0);
    const lines: string[] = [];
    let currentLine = "";

    const commitLine = () => {
      lines.push(currentLine.trimEnd());
      currentLine = "";
    };

    for (const token of tokens) {
      const isWhitespace = /^\s+$/u.test(token);

      if (isWhitespace) {
        if (currentLine) {
          currentLine += token;
        }
        continue;
      }

      if (!currentLine) {
        if (measureLineWidth(token, element) <= maxWidth) {
          currentLine = token;
          continue;
        }

        const pieces = splitLongTokenByWidth(token, maxWidth, element);
        if (!pieces.length) {
          currentLine = token;
          continue;
        }
        lines.push(...pieces.slice(0, -1));
        currentLine = pieces[pieces.length - 1] ?? "";
        continue;
      }

      const candidate = `${currentLine}${token}`;
      if (measureLineWidth(candidate, element) <= maxWidth) {
        currentLine = candidate;
        continue;
      }

      commitLine();
      if (measureLineWidth(token, element) <= maxWidth) {
        currentLine = token;
        continue;
      }

      const pieces = splitLongTokenByWidth(token, maxWidth, element);
      if (!pieces.length) {
        currentLine = token;
        continue;
      }
      lines.push(...pieces.slice(0, -1));
      currentLine = pieces[pieces.length - 1] ?? "";
    }

    if (currentLine || !lines.length) {
      lines.push(currentLine.trimEnd());
    }

    let paragraphCursor = 0;
    for (const line of lines) {
      const normalizedLine = line.trimEnd();
      const foundAt = normalizedLine
        ? paragraph.indexOf(normalizedLine, paragraphCursor)
        : paragraphCursor;
      const lineStart = foundAt >= 0 ? foundAt : paragraphCursor;
      paragraphCursor = lineStart + normalizedLine.length;
      result.push({
        text: normalizedLine,
        start: paragraphStart + lineStart,
        width: measureLineWidth(normalizedLine, element)
      });
    }
  }

  return result;
}

type TextHighlightRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
};

function resolveHighlightRects(element: TextElement): TextHighlightRect[] {
  const ranges = normalizeTextHighlights(element);
  if (!ranges.length || !element.text.trim()) {
    return [];
  }

  const lineLayout = buildTextLineLayout(element);
  if (!lineLayout.length) {
    return [];
  }

  const lineHeight = element.lineHeight ?? 1.1;
  const lineHeightPx = element.fontSize * lineHeight;
  const fontHeight = Math.max(10, element.fontSize);
  const padX = Math.max(3, Math.round(element.fontSize * 0.1));
  const padY = Math.max(2, Math.round(element.fontSize * 0.08));
  const rects: TextHighlightRect[] = [];

  for (let lineIndex = 0; lineIndex < lineLayout.length; lineIndex += 1) {
    const line = lineLayout[lineIndex];
    const lineStart = line.start;
    const lineEnd = line.start + line.text.length;
    if (lineEnd <= lineStart) {
      continue;
    }

    const alignOffset =
      element.align === "center"
        ? Math.max(0, (element.width - line.width) / 2)
        : element.align === "right"
          ? Math.max(0, element.width - line.width)
          : 0;
    const lineTop = lineIndex * lineHeightPx;
    const baseY = lineTop + Math.max(0, (lineHeightPx - fontHeight) / 2);

    for (const range of ranges) {
      const overlapStart = Math.max(range.start, lineStart);
      const overlapEnd = Math.min(range.end, lineEnd);

      if (overlapEnd <= overlapStart) {
        continue;
      }

      const startInLine = overlapStart - lineStart;
      const endInLine = overlapEnd - lineStart;
      const prefix = line.text.slice(0, startInLine);
      const highlighted = line.text.slice(startInLine, endInLine);
      if (!/[\p{L}\p{N}]/u.test(highlighted)) {
        continue;
      }
      const width = measureLineWidth(highlighted, element);
      if (width <= 0) {
        continue;
      }

      rects.push({
        x: Math.round(alignOffset + measureLineWidth(prefix, element) - padX),
        y: Math.round(baseY - padY),
        width: Math.round(width + padX * 2),
        height: Math.round(fontHeight + padY * 2),
        color: range.color,
        opacity: Math.max(0.08, Math.min(1, range.opacity ?? 0.94))
      });
    }
  }

  return rects;
}

function shouldHideLegacyAccentChip(element: CanvasElement, slide?: Slide) {
  if (element.type !== "shape") {
    return false;
  }
  if (element.metaKey === "managed-title-accent-chip") {
    return true;
  }
  if (element.metaKey) {
    return false;
  }

  const looksLikeChip =
    element.width >= 24 &&
    element.width <= 760 &&
    element.height >= 8 &&
    element.height <= 180 &&
    element.shape === "rect" &&
    element.width / Math.max(1, element.height) >= 1.15 &&
    (element.opacity ?? 1) >= 0.25;

  if (!looksLikeChip) {
    return false;
  }

  const strokeWidth = element.strokeWidth ?? 0;
  const strokeLooksDecorative = Boolean(element.stroke) && strokeWidth > 3;
  if (strokeLooksDecorative && !isLikelyLegacyAccentChipColor(element.fill)) {
    return false;
  }
  if (!isLikelyLegacyAccentChipColor(element.fill) && Boolean(element.stroke)) {
    return false;
  }

  if (!slide) {
    return true;
  }
  return element.y <= Math.round(heightByFormat("9:16") * 0.82);
}

function normalizeLegacyToken(value: string) {
  return value
    .toLowerCase()
    .replace(/[«»"“”„'`]/gu, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function shouldHideLegacyAccentText(
  element: CanvasElement,
  legacyChipRects: Array<{ x: number; y: number; width: number; height: number }>,
  titleText: string,
  titleElement: TextElement | null
) {
  if (element.type !== "text" || element.metaKey) {
    return false;
  }

  const compact = element.text.replace(/\s+/gu, " ").trim();
  if (!compact || compact.includes("\n") || compact.length > 42) {
    return false;
  }

  const words = compact.split(" ").filter(Boolean);
  if (words.length > 4) {
    return false;
  }

  const centerX = element.x + element.width / 2;
  const centerY = element.y + Math.max(12, element.height / 2);
  const overlapsChip = legacyChipRects.some(
    (chip) =>
      centerX >= chip.x - 30 &&
      centerX <= chip.x + chip.width + 30 &&
      centerY >= chip.y - 34 &&
      centerY <= chip.y + chip.height + 34
  );
  const nearTitle = titleElement
    ? element.y <= titleElement.y + Math.max(420, titleElement.height + 320) &&
      element.y + element.height >= titleElement.y - 100 &&
      element.x + element.width >= titleElement.x - 96 &&
      element.x <= titleElement.x + titleElement.width + 96
    : false;
  if (!overlapsChip && !nearTitle) {
    return false;
  }

  const normalizedTitle = normalizeLegacyToken(titleText);
  const normalizedText = normalizeLegacyToken(compact);
  if (!normalizedText) {
    return false;
  }

  if (!normalizedTitle) {
    return words.length <= 2 && LEGACY_ACCENT_TEXT_COLORS.has((element.fill ?? "").toLowerCase());
  }

  if (normalizedTitle.includes(normalizedText)) {
    return true;
  }

  return normalizedText
    .split(" ")
    .filter((token) => token.length >= 4)
    .some((token) => normalizedTitle.includes(token));
}

function heightByFormat(format: "1:1" | "4:5" | "9:16") {
  switch (format) {
    case "1:1":
      return 1080;
    case "4:5":
      return 1350;
    case "9:16":
      return 1920;
    default:
      return 1920;
  }
}

function areGuidesEqual(left: SnapGuides, right: SnapGuides) {
  if (left.vertical.length !== right.vertical.length || left.horizontal.length !== right.horizontal.length) {
    return false;
  }

  return (
    left.vertical.every((value, index) => Math.abs(value - right.vertical[index]) < 0.25) &&
    left.horizontal.every((value, index) => Math.abs(value - right.horizontal[index]) < 0.25)
  );
}

function getCoverCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  zoom = 1,
  offsetX = 0,
  offsetY = 0
) {
  if (!sourceWidth || !sourceHeight || !targetWidth || !targetHeight) {
    return null;
  }

  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  let cropWidth: number;
  let cropHeight: number;
  let cropX = 0;
  let cropY = 0;

  if (sourceRatio > targetRatio) {
    cropHeight = sourceHeight;
    cropWidth = cropHeight * targetRatio;
    cropX = (sourceWidth - cropWidth) / 2;
  } else {
    cropWidth = sourceWidth;
    cropHeight = cropWidth / targetRatio;
    cropY = (sourceHeight - cropHeight) / 2;
  }

  const safeZoom = clamp(zoom, 0.4, 4);
  if (safeZoom > 1) {
    cropWidth /= safeZoom;
    cropHeight /= safeZoom;
  }

  const offsetScaleX = cropWidth / Math.max(1, targetWidth);
  const offsetScaleY = cropHeight / Math.max(1, targetHeight);

  cropX = clamp(cropX + offsetX * offsetScaleX, 0, Math.max(0, sourceWidth - cropWidth));
  cropY = clamp(cropY + offsetY * offsetScaleY, 0, Math.max(0, sourceHeight - cropHeight));

  return {
    x: cropX,
    y: cropY,
    width: cropWidth,
    height: cropHeight
  };
}

function snapRotationAngle(value: number) {
  const normalized = ((value % 360) + 360) % 360;
  const signed = normalized > 180 ? normalized - 360 : normalized;
  let best = signed;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const angle of ROTATION_SNAP_VALUES) {
    const distance = Math.abs(signed - angle);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = angle;
    }
  }

  return bestDistance <= ROTATION_SNAP_THRESHOLD ? best : signed;
}

function resolveSnap(
  position: { x: number; y: number },
  elementSize: { width: number; height: number },
  bounds: DragBounds,
  safeArea: SafeArea,
  canvasWidth: number,
  canvasHeight: number
) {
  const minXGuide = bounds.minX <= 0 ? 0 : safeArea.left;
  const maxXGuide = bounds.maxX >= canvasWidth - elementSize.width ? canvasWidth : safeArea.right;
  const minYGuide = bounds.minY <= 0 ? 0 : safeArea.top;
  const maxYGuide = bounds.maxY >= canvasHeight - elementSize.height ? canvasHeight : safeArea.bottom;
  const xCandidates = [
    { target: bounds.minX, guide: minXGuide },
    { target: bounds.maxX, guide: maxXGuide },
    {
      target: clamp((canvasWidth - elementSize.width) / 2, bounds.minX, bounds.maxX),
      guide: canvasWidth / 2
    }
  ];
  const yCandidates = [
    { target: bounds.minY, guide: minYGuide },
    { target: bounds.maxY, guide: maxYGuide },
    {
      target: clamp((canvasHeight - elementSize.height) / 2, bounds.minY, bounds.maxY),
      guide: canvasHeight / 2
    }
  ];

  let nextX = position.x;
  let nextY = position.y;
  const guides: SnapGuides = { vertical: [], horizontal: [] };

  const nearestX = xCandidates
    .map((candidate) => ({ ...candidate, diff: Math.abs(position.x - candidate.target) }))
    .sort((left, right) => left.diff - right.diff)[0];
  if (nearestX && nearestX.diff <= SNAP_THRESHOLD) {
    nextX = nearestX.target;
    guides.vertical.push(nearestX.guide);
  }

  const nearestY = yCandidates
    .map((candidate) => ({ ...candidate, diff: Math.abs(position.y - candidate.target) }))
    .sort((left, right) => left.diff - right.diff)[0];
  if (nearestY && nearestY.diff <= SNAP_THRESHOLD) {
    nextY = nearestY.target;
    guides.horizontal.push(nearestY.guide);
  }

  return {
    position: {
      x: clamp(nextX, bounds.minX, bounds.maxX),
      y: clamp(nextY, bounds.minY, bounds.maxY)
    },
    guides
  };
}

function SlideImageNode({
  element,
  interactive = false,
  selected,
  onSelect,
  onDragEnd,
  onTransformEnd,
  nodeRef,
  dragBoundFunc
}: {
  element: ImageElement;
  interactive?: boolean;
  selected: boolean;
  onSelect?: () => void;
  onDragEnd?: (x: number, y: number) => void;
  onTransformEnd?: (node: Konva.Image) => void;
  nodeRef: (node: Konva.Image | null) => void;
  dragBoundFunc?: (position: { x: number; y: number }) => { x: number; y: number };
}) {
  const [image] = useImage(element.src, "anonymous");
  const isManagedImageBlock = element.metaKey === "image-top";
  const sourceWidth = image?.naturalWidth || image?.width || 0;
  const sourceHeight = image?.naturalHeight || image?.height || 0;
  const shouldCrop =
    sourceWidth > 0 &&
    sourceHeight > 0 &&
    ((element.fitMode ?? "cover") === "cover" || element.metaKey === "image-top");
  const coverCrop = shouldCrop
    ? getCoverCrop(
        sourceWidth,
        sourceHeight,
        element.width,
        element.height,
        element.zoom ?? 1,
        element.offsetX ?? 0,
        element.offsetY ?? 0
      )
    : null;
  const drawX = element.x;
  const drawY = element.y;
  const drawWidth = element.width;
  const drawHeight = element.height;
  const darken = clamp(element.darken ?? 0, 0, 1);
  const outlineStroke =
    selected
      ? UI_ACCENT
      : element.strokeWidth && element.strokeWidth > 0
        ? element.stroke
        : undefined;
  const outlineWidth = selected ? 4 : element.strokeWidth ?? 0;

  return (
    <>
      <KonvaImage
        ref={nodeRef}
        image={image}
        x={drawX}
        y={drawY}
        width={drawWidth}
        height={drawHeight}
        opacity={element.opacity}
        rotation={element.rotation}
        cornerRadius={element.cornerRadius}
        cropX={coverCrop?.x}
        cropY={coverCrop?.y}
        cropWidth={coverCrop?.width}
        cropHeight={coverCrop?.height}
        listening
        draggable={interactive && selected && !isManagedImageBlock}
        dragDistance={10}
        dragBoundFunc={isManagedImageBlock ? undefined : dragBoundFunc}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={
          isManagedImageBlock
            ? undefined
            : (event) => onDragEnd?.(event.target.x(), event.target.y())
        }
        onTransformEnd={(event) => onTransformEnd?.(event.target as Konva.Image)}
        stroke={outlineStroke}
        strokeWidth={outlineWidth}
        shadowBlur={selected ? 18 : 0}
        shadowColor={selected ? UI_ACCENT_SOFT : undefined}
      />
      {darken > 0 ? (
        <Rect
          x={drawX}
          y={drawY}
          width={drawWidth}
          height={drawHeight}
          cornerRadius={element.cornerRadius}
          fill="#000000"
          opacity={darken}
          listening={false}
        />
      ) : null}
    </>
  );
}

function SlideShapeNode({
  element,
  interactive = false,
  selected,
  onSelect,
  onDragEnd,
  onTransformEnd,
  nodeRef,
  dragBoundFunc
}: {
  element: ShapeElement;
  interactive?: boolean;
  selected: boolean;
  onSelect?: () => void;
  onDragEnd?: (x: number, y: number) => void;
  onTransformEnd?: (node: Konva.Rect) => void;
  nodeRef: (node: Konva.Rect | null) => void;
  dragBoundFunc?: (position: { x: number; y: number }) => { x: number; y: number };
}) {
  return (
    <Rect
      ref={nodeRef}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      fill={element.fill}
      opacity={element.opacity}
      rotation={element.rotation}
      cornerRadius={element.shape === "circle" ? Math.min(element.width, element.height) / 2 : element.cornerRadius}
      stroke={selected ? UI_ACCENT : element.stroke}
      strokeWidth={selected ? 4 : element.strokeWidth}
      shadowBlur={selected ? 14 : 0}
      shadowColor={selected ? UI_ACCENT_SOFT : undefined}
      listening={interactive}
      draggable={interactive && selected}
      dragDistance={10}
      dragBoundFunc={dragBoundFunc}
      onClick={interactive ? onSelect : undefined}
      onTap={interactive ? onSelect : undefined}
      onDragEnd={interactive ? (event) => onDragEnd?.(event.target.x(), event.target.y()) : undefined}
      onTransformEnd={interactive ? (event) => onTransformEnd?.(event.target as Konva.Rect) : undefined}
    />
  );
}

function SlideTextNode({
  element,
  interactive = false,
  selected,
  onSelect,
  onDoubleClick,
  onDragEnd,
  onTransformEnd,
  nodeRef,
  dragBoundFunc
}: {
  element: TextElement;
  interactive?: boolean;
  selected: boolean;
  onSelect?: () => void;
  onDoubleClick?: () => void;
  onDragEnd?: (x: number, y: number) => void;
  onTransformEnd?: (node: Konva.Text) => void;
  nodeRef: (node: Konva.Text | null) => void;
  dragBoundFunc?: (position: { x: number; y: number }) => { x: number; y: number };
}) {
  const highlightRects = useMemo(() => resolveHighlightRects(element), [element]);

  return (
    <Group>
      <Group x={element.x} y={element.y} rotation={element.rotation} listening={false}>
        {highlightRects.map((rect, index) => (
          <Rect
            key={`${element.id}-hl-${index}`}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            cornerRadius={Math.max(3, Math.round(element.fontSize * 0.08))}
            fill={rect.color}
            opacity={rect.opacity}
            listening={false}
          />
        ))}
      </Group>
      <Text
        ref={nodeRef}
        text={element.text}
        x={element.x}
        y={element.y}
        width={element.width}
        fontSize={element.fontSize}
        fontFamily={element.fontFamily}
        fontStyle={element.fontStyle}
        fill={element.fill}
        align={element.align}
        lineHeight={element.lineHeight ?? 1.1}
        wrap="word"
        ellipsis={false}
        opacity={element.opacity}
        rotation={element.rotation}
        letterSpacing={element.letterSpacing}
        textDecoration={element.textDecoration}
        draggable={interactive && selected}
        dragDistance={4}
        dragBoundFunc={dragBoundFunc}
        onClick={onSelect}
        onTap={onSelect}
        onDblClick={onDoubleClick}
        onDblTap={onDoubleClick}
        onMouseEnter={(event) => {
          if (!interactive) {
            return;
          }
          const container = event.target.getStage()?.container();
          if (container) {
            container.style.cursor = selected ? "grab" : "pointer";
          }
        }}
        onMouseLeave={(event) => {
          const container = event.target.getStage()?.container();
          if (container) {
            container.style.cursor = "default";
          }
        }}
        onDragStart={(event) => {
          const container = event.target.getStage()?.container();
          if (container) {
            container.style.cursor = "grabbing";
          }
        }}
        onDragEnd={(event) => {
          const container = event.target.getStage()?.container();
          if (container) {
            container.style.cursor = selected ? "grab" : "default";
          }
          onDragEnd?.(event.target.x(), event.target.y());
        }}
        onTransformEnd={(event) => onTransformEnd?.(event.target as Konva.Text)}
        strokeEnabled={false}
        shadowEnabled={false}
        perfectDrawEnabled={false}
      />
    </Group>
  );
}

export function SlideStage({
  slide,
  width,
  height,
  canvasWidth,
  canvasHeight,
  selectedElementId,
  interactive = false,
  onSelectElement,
  onUpdateElementPosition,
  onTransformElement,
  onStartTextEditing,
  onRequestSlidePhotoUpload,
  hiddenElementId = null,
  stageRef,
  showSlideBadge = true
}: SlideStageProps) {
  const scale = useMemo(() => width / canvasWidth, [canvasWidth, width]);
  const stageNodeRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Record<string, Konva.Node | null>>({});
  const safeArea = useMemo(
    () => resolveSafeArea(canvasWidth, canvasHeight, width),
    [canvasHeight, canvasWidth, width]
  );
  const [snapGuides, setSnapGuides] = useState<SnapGuides>(EMPTY_GUIDES);
  const snapGuidesRef = useRef<SnapGuides>(EMPTY_GUIDES);

  const updateSnapGuides = (next: SnapGuides) => {
    if (areGuidesEqual(snapGuidesRef.current, next)) {
      return;
    }
    snapGuidesRef.current = next;
    setSnapGuides(next);
  };

  useEffect(() => {
    if (!interactive || !transformerRef.current) {
      return;
    }

    const selectedNode = selectedElementId ? nodeRefs.current[selectedElementId] : null;

    transformerRef.current.nodes(selectedNode ? [selectedNode] : []);
    transformerRef.current.getLayer()?.batchDraw();
  }, [interactive, selectedElementId, slide.elements]);

  useEffect(() => {
    stageNodeRef.current?.batchDraw();
  }, [slide.elements, showSlideBadge]);

  const handleStageRef = (node: Konva.Stage | null) => {
    stageNodeRef.current = node;
    stageRef?.(node);
  };

  useEffect(() => {
    updateSnapGuides(EMPTY_GUIDES);
  }, [selectedElementId, slide.id]);

  const selectedElement = useMemo(() => {
    if (!selectedElementId) {
      return null;
    }
    return slide.elements.find((element) => element.id === selectedElementId) ?? null;
  }, [selectedElementId, slide.elements]);

  const likelyTitleElement = useMemo(() => resolveLikelyManagedTitle(slide), [slide]);
  const preferredManagedTitle = useMemo(
    () => resolvePreferredManagedTextByMeta(slide, "managed-title"),
    [slide]
  );
  const preferredManagedBody = useMemo(
    () => resolvePreferredManagedTextByMeta(slide, "managed-body"),
    [slide]
  );
  const titleText = useMemo(() => likelyTitleElement?.text ?? "", [likelyTitleElement]);

  const legacyChipRects = useMemo(
    () =>
      slide.elements
        .filter((element): element is ShapeElement => element.type === "shape" && shouldHideLegacyAccentChip(element, slide))
        .map((element) => ({
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height
        })),
    [slide.elements, slide]
  );

  const hiddenLegacyAccentTextIds = useMemo(
    () =>
      new Set(
        slide.elements
          .filter((element) => shouldHideLegacyAccentText(element, legacyChipRects, titleText, likelyTitleElement))
          .map((element) => element.id)
      ),
    [legacyChipRects, likelyTitleElement, slide.elements, titleText]
  );

  const handleTransformEnd = (element: CanvasElement, node: Konva.Node) => {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const safeWidth = Math.max(120, safeArea.right - safeArea.left);
    const safeHeight = Math.max(42, safeArea.bottom - safeArea.top);
    const maxWidth = element.type === "text" ? canvasWidth - 12 : canvasWidth;
    const maxHeight = element.type === "text" ? canvasHeight - 12 : canvasHeight;
    let nextWidth = clamp(
      element.width * scaleX,
      element.type === "text" ? 120 : 30,
      maxWidth
    );
    let nextHeight = clamp(
      element.height * scaleY,
      element.type === "text" ? 42 : 24,
      maxHeight
    );

    if (element.type === "image" && element.metaKey !== "image-top") {
      const aspect = element.width / Math.max(1, element.height);
      if (Math.abs(scaleX - 1) >= Math.abs(scaleY - 1)) {
        nextHeight = clamp(nextWidth / aspect, 24, maxHeight);
        if (nextHeight >= maxHeight) {
          nextWidth = clamp(nextHeight * aspect, 30, maxWidth);
        }
      } else {
        nextWidth = clamp(nextHeight * aspect, 30, maxWidth);
        if (nextWidth >= maxWidth) {
          nextHeight = clamp(nextWidth / aspect, 24, maxHeight);
        }
      }
    }

    if (element.type === "text") {
      nextHeight = clamp(estimateTextHeight(element, nextWidth) + 14, 42, maxHeight);
    }

    const bounds = resolveDragBounds(
      element,
      canvasWidth,
      canvasHeight,
      safeArea,
      nextWidth,
      nextHeight
    );
    const clampedPosition = clampPosition({ x: node.x(), y: node.y() }, bounds);
    const updates: Record<string, number> = {
      x: clampedPosition.x,
      y: clampedPosition.y,
      width: nextWidth,
      height: nextHeight,
      rotation: snapRotationAngle(node.rotation())
    };

    node.scaleX(1);
    node.scaleY(1);
    updateSnapGuides(EMPTY_GUIDES);
    onTransformElement?.(element.id, updates);
  };

  return (
    <Stage
      ref={handleStageRef}
      width={width}
      height={height}
      draggable={false}
      style={{ touchAction: "none" }}
      onWheel={(event) => {
        if (event.evt.ctrlKey) {
          event.evt.preventDefault();
        }
      }}
      onMouseDown={(event) => {
        if (event.target === event.target.getStage()) {
          updateSnapGuides(EMPTY_GUIDES);
          onSelectElement?.(null);
        }
      }}
      onTouchStart={(event) => {
        if (event.target === event.target.getStage()) {
          updateSnapGuides(EMPTY_GUIDES);
          onSelectElement?.(null);
        }
      }}
      onTouchMove={(event) => {
        const touchEvent = event.evt as TouchEvent;
        if (touchEvent.touches.length > 1) {
          touchEvent.preventDefault();
        }
      }}
    >
      <Layer scaleX={scale} scaleY={scale}>
        <Rect
          x={0}
          y={0}
          width={canvasWidth}
          height={canvasHeight}
          fill={slide.background}
          listening={false}
        />

        {interactive ? (
          <>
            <Rect
              x={safeArea.left}
              y={safeArea.top}
              width={Math.max(4, safeArea.right - safeArea.left)}
              height={Math.max(4, safeArea.bottom - safeArea.top)}
              stroke={UI_ACCENT_SOFT}
              strokeWidth={1.2}
              dash={[8, 8]}
              listening={false}
            />
            <Rect
              x={canvasWidth / 2}
              y={safeArea.top}
              width={1}
              height={Math.max(4, safeArea.bottom - safeArea.top)}
              fill={UI_ACCENT_FAINT}
              listening={false}
            />
            <Rect
              x={safeArea.left}
              y={canvasHeight / 2}
              width={Math.max(4, safeArea.right - safeArea.left)}
              height={1}
              fill={UI_ACCENT_FAINT}
              listening={false}
            />
          </>
        ) : null}

        {snapGuides.vertical.map((value) => (
          <Rect
            key={`snap-v-${value}`}
            x={value}
            y={safeArea.top}
            width={1.4}
            height={Math.max(4, safeArea.bottom - safeArea.top)}
            fill={UI_ACCENT_GUIDE}
            listening={false}
          />
        ))}
        {snapGuides.horizontal.map((value) => (
          <Rect
            key={`snap-h-${value}`}
            x={safeArea.left}
            y={value}
            width={Math.max(4, safeArea.right - safeArea.left)}
            height={1.4}
            fill={UI_ACCENT_GUIDE}
            listening={false}
          />
        ))}

        {(() => {
          const seenManagedTextMeta = new Set<string>();
          return slide.elements
          .filter((element) => {
            if (hiddenElementId && element.id === hiddenElementId) {
              return false;
            }
            if (
              element.type === "text" &&
              element.metaKey === "managed-title" &&
              preferredManagedTitle &&
              element.id !== preferredManagedTitle.id
            ) {
              return false;
            }
            if (
              element.type === "text" &&
              element.metaKey === "managed-body" &&
              preferredManagedBody &&
              element.id !== preferredManagedBody.id
            ) {
              return false;
            }
            if (shouldHideLegacyAccentChip(element, slide)) {
              return false;
            }
            if (hiddenLegacyAccentTextIds.has(element.id)) {
              return false;
            }
            if (showSlideBadge) {
              if (element.metaKey === "managed-title-accent-text") {
                return false;
              }
              if (element.metaKey === "managed-title-accent-chip") {
                return false;
              }
              return true;
            }
            return (
              element.metaKey !== "slide-chip" &&
              element.metaKey !== "slide-chip-text" &&
              element.metaKey !== "managed-title-accent-text" &&
              element.metaKey !== "managed-title-accent-chip"
            );
          })
          .filter((element) => {
            if (element.type !== "text" || !element.metaKey) {
              return true;
            }
            if (!MANAGED_TEXT_META_KEYS.has(element.metaKey)) {
              return true;
            }
            if (seenManagedTextMeta.has(element.metaKey)) {
              return false;
            }
            seenManagedTextMeta.add(element.metaKey);
            return true;
          })
          .map((element) => {
            const selected = selectedElementId === element.id;
            const elementSize = {
              width: element.width,
              height:
                element.type === "text"
                  ? Math.max(element.height, estimateTextHeight(element, element.width) + 14)
                  : element.height
            };
            const dragBounds = resolveDragBounds(
              element,
              canvasWidth,
              canvasHeight,
              safeArea,
              elementSize.width,
              elementSize.height
            );

            const handleDragEnd = (x: number, y: number) => {
              const snapped = resolveSnap(
                clampPosition({ x, y }, dragBounds),
                elementSize,
                dragBounds,
                safeArea,
                canvasWidth,
                canvasHeight
              );
              updateSnapGuides(EMPTY_GUIDES);
              onUpdateElementPosition?.(element.id, snapped.position.x, snapped.position.y);
            };

            const dragBoundFunc = (position: { x: number; y: number }) => {
              const clamped = clampPosition(position, dragBounds);
              const snapped = resolveSnap(
                clamped,
                elementSize,
                dragBounds,
                safeArea,
                canvasWidth,
                canvasHeight
              );
              if (interactive && selected) {
                updateSnapGuides(snapped.guides);
              }
              return snapped.position;
            };

            const nodeRef = (node: Konva.Node | null) => {
              nodeRefs.current[element.id] = node;
            };

            if (element.type === "text") {
              const isLockedTextLayer = Boolean(
                element.metaKey && NON_INTERACTIVE_TEXT_META_KEYS.has(element.metaKey)
              );
              const isImagePlaceholderText =
                element.metaKey === "image-placeholder-text" &&
                !slide.backgroundImage &&
                Boolean(onRequestSlidePhotoUpload);
              const interactiveText = interactive && !isLockedTextLayer && !isImagePlaceholderText;

              return (
                <SlideTextNode
                  key={element.id}
                  element={element}
                  selected={selected && !isLockedTextLayer && !isImagePlaceholderText}
                  interactive={interactiveText}
                  nodeRef={nodeRef as (node: Konva.Text | null) => void}
                  dragBoundFunc={dragBoundFunc}
                  onSelect={
                    isImagePlaceholderText
                      ? () => onRequestSlidePhotoUpload?.(slide.id)
                      : isLockedTextLayer
                        ? undefined
                        : () => onSelectElement?.(element.id)
                  }
                  onDoubleClick={
                    isLockedTextLayer || isImagePlaceholderText
                      ? undefined
                      : () => onStartTextEditing?.(element.id)
                  }
                  onDragEnd={isLockedTextLayer || isImagePlaceholderText ? undefined : handleDragEnd}
                  onTransformEnd={
                    isLockedTextLayer || isImagePlaceholderText
                      ? undefined
                      : (node) => handleTransformEnd(element, node)
                  }
                />
              );
            }

            if (element.type === "shape") {
              const isImagePlaceholderShape =
                element.metaKey === "image-placeholder" &&
                !slide.backgroundImage &&
                Boolean(onRequestSlidePhotoUpload);

              return (
                <SlideShapeNode
                  key={element.id}
                  element={element}
                  selected={false}
                  interactive={interactive && isImagePlaceholderShape}
                  nodeRef={nodeRef as (node: Konva.Rect | null) => void}
                  dragBoundFunc={dragBoundFunc}
                  onSelect={
                    isImagePlaceholderShape
                      ? () => onRequestSlidePhotoUpload?.(slide.id)
                      : undefined
                  }
                />
              );
            }

            return (
              <SlideImageNode
                key={element.id}
                element={element}
                selected={selected}
                interactive={interactive}
                nodeRef={nodeRef as (node: Konva.Image | null) => void}
                dragBoundFunc={dragBoundFunc}
                onSelect={() => onSelectElement?.(element.id)}
                onDragEnd={handleDragEnd}
                onTransformEnd={(node) => handleTransformEnd(element, node)}
              />
            );
          });
        })()}

        {interactive ? (
          <Transformer
            ref={transformerRef}
            rotateEnabled
            flipEnabled={false}
            keepRatio={
              selectedElement?.type === "image" &&
              selectedElement.metaKey !== "image-top"
            }
            enabledAnchors={
              selectedElement?.type === "text"
                ? ["middle-left", "middle-right"]
                : selectedElement?.type === "image" &&
                    selectedElement.metaKey === "image-top"
                  ? ["top-center", "bottom-center"]
                : ["top-left", "top-right", "bottom-left", "bottom-right"]
            }
            borderStroke={UI_ACCENT}
            anchorFill="#ffffff"
            anchorStroke="#278f85"
            anchorStrokeWidth={1}
            anchorSize={10}
            boundBoxFunc={(oldBox, newBox) => {
              if (Math.abs(newBox.width) < 30 || Math.abs(newBox.height) < 24) {
                return oldBox;
              }

              return newBox;
            }}
          />
        ) : null}
      </Layer>
    </Stage>
  );
}
