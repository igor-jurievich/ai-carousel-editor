"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import useImage from "use-image";
import {
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
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
  const safeWidth = Math.max(60, safeArea.right - safeArea.left);
  const safeHeight = Math.max(40, safeArea.bottom - safeArea.top);
  const forceCanvasBounds =
    element.type === "text" ||
    (element.type === "image" && element.metaKey === "background-image");
  const useCanvasX = forceCanvasBounds || width > safeWidth;
  const useCanvasY = forceCanvasBounds || effectiveHeight > safeHeight;

  const minX = useCanvasX ? 0 : safeArea.left;
  const maxX = useCanvasX ? Math.max(0, canvasWidth - width) : Math.max(minX, safeArea.right - width);
  const minY = useCanvasY ? 0 : safeArea.top;
  const maxY = useCanvasY
    ? Math.max(0, canvasHeight - effectiveHeight)
    : Math.max(minY, safeArea.bottom - effectiveHeight);

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
  const approxCharsPerLine = Math.max(6, Math.floor(width / Math.max(8, element.fontSize * 0.58)));
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

function resolveBackgroundPlacement(
  element: ImageElement,
  sourceWidth: number,
  sourceHeight: number
) {
  const fitMode = element.fitMode ?? "cover";
  const zoom = clamp(element.zoom ?? 1, 0.4, 4);
  const offsetX = element.offsetX ?? 0;
  const offsetY = element.offsetY ?? 0;

  if (fitMode === "cover") {
    return {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      crop: getCoverCrop(
        sourceWidth,
        sourceHeight,
        element.width,
        element.height,
        zoom,
        offsetX,
        offsetY
      )
    };
  }

  const baseScale =
    fitMode === "contain"
      ? Math.min(element.width / sourceWidth, element.height / sourceHeight)
      : 1;
  const scale = Math.max(0.02, baseScale * zoom);
  const renderWidth = sourceWidth * scale;
  const renderHeight = sourceHeight * scale;

  return {
    x: element.x + (element.width - renderWidth) / 2 + offsetX,
    y: element.y + (element.height - renderHeight) / 2 + offsetY,
    width: renderWidth,
    height: renderHeight,
    crop: null
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
  const isBackground = element.metaKey === "background-image";
  const isManagedImageBlock = element.metaKey === "internet-image-top";
  const sourceWidth = image?.naturalWidth || image?.width || 0;
  const sourceHeight = image?.naturalHeight || image?.height || 0;
  const backgroundPlacement =
    isBackground && sourceWidth > 0 && sourceHeight > 0
      ? resolveBackgroundPlacement(element, sourceWidth, sourceHeight)
      : null;
  const shouldCrop =
    !backgroundPlacement &&
    sourceWidth > 0 &&
    sourceHeight > 0 &&
    ((element.fitMode ?? "cover") === "cover" ||
      element.metaKey === "internet-image-top" ||
      element.metaKey === "background-image");
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
  const drawX = backgroundPlacement?.x ?? element.x;
  const drawY = backgroundPlacement?.y ?? element.y;
  const drawWidth = backgroundPlacement?.width ?? element.width;
  const drawHeight = backgroundPlacement?.height ?? element.height;
  const darken = clamp(element.darken ?? 0, 0, 1);
  const outlineStroke =
    selected
      ? "#72d6cb"
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
        cropX={backgroundPlacement?.crop?.x ?? coverCrop?.x}
        cropY={backgroundPlacement?.crop?.y ?? coverCrop?.y}
        cropWidth={backgroundPlacement?.crop?.width ?? coverCrop?.width}
        cropHeight={backgroundPlacement?.crop?.height ?? coverCrop?.height}
        listening={!isBackground}
        draggable={interactive && selected && !isBackground && !isManagedImageBlock}
        dragDistance={10}
        dragBoundFunc={isBackground || isManagedImageBlock ? undefined : dragBoundFunc}
        onClick={isBackground ? undefined : onSelect}
        onTap={isBackground ? undefined : onSelect}
        onDragEnd={
          isBackground || isManagedImageBlock
            ? undefined
            : (event) => onDragEnd?.(event.target.x(), event.target.y())
        }
        onTransformEnd={
          isBackground ? undefined : (event) => onTransformEnd?.(event.target as Konva.Image)
        }
        stroke={outlineStroke}
        strokeWidth={outlineWidth}
        shadowBlur={selected ? 18 : 0}
        shadowColor={selected ? "rgba(114, 214, 203, 0.35)" : undefined}
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
      stroke={selected ? "#72d6cb" : element.stroke}
      strokeWidth={selected ? 4 : element.strokeWidth}
      shadowBlur={selected ? 14 : 0}
      shadowColor={selected ? "rgba(114, 214, 203, 0.28)" : undefined}
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
  return (
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

  const selectedElement = selectedElementId
    ? slide.elements.find((element) => element.id === selectedElementId) ?? null
    : null;

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

    if (element.type === "image" && element.metaKey !== "internet-image-top") {
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
              stroke="rgba(64, 167, 156, 0.22)"
              strokeWidth={1.2}
              dash={[8, 8]}
              listening={false}
            />
            <Rect
              x={canvasWidth / 2}
              y={safeArea.top}
              width={1}
              height={Math.max(4, safeArea.bottom - safeArea.top)}
              fill="rgba(64, 167, 156, 0.12)"
              listening={false}
            />
            <Rect
              x={safeArea.left}
              y={canvasHeight / 2}
              width={Math.max(4, safeArea.right - safeArea.left)}
              height={1}
              fill="rgba(64, 167, 156, 0.12)"
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
            fill="rgba(56, 170, 158, 0.7)"
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
            fill="rgba(56, 170, 158, 0.7)"
            listening={false}
          />
        ))}

        {slide.elements
          .filter((element) => {
            if (showSlideBadge) {
              return true;
            }
            return element.metaKey !== "slide-chip" && element.metaKey !== "slide-chip-text";
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
              return (
                <SlideTextNode
                  key={element.id}
                  element={element}
                  selected={selected}
                  interactive={interactive}
                  nodeRef={nodeRef as (node: Konva.Text | null) => void}
                  dragBoundFunc={dragBoundFunc}
                  onSelect={() => onSelectElement?.(element.id)}
                  onDoubleClick={() => onStartTextEditing?.(element.id)}
                  onDragEnd={handleDragEnd}
                  onTransformEnd={(node) => handleTransformEnd(element, node)}
                />
              );
            }

            if (element.type === "shape") {
              return (
                <SlideShapeNode
                  key={element.id}
                  element={element}
                  selected={false}
                  interactive={false}
                  nodeRef={nodeRef as (node: Konva.Rect | null) => void}
                  dragBoundFunc={dragBoundFunc}
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
          })}

        {interactive ? (
          <Transformer
            ref={transformerRef}
            rotateEnabled
            flipEnabled={false}
            keepRatio={
              selectedElement?.type === "image" &&
              selectedElement.metaKey !== "internet-image-top"
            }
            enabledAnchors={
              selectedElement?.type === "text"
                ? ["middle-left", "middle-right"]
                : selectedElement?.type === "image" &&
                    selectedElement.metaKey === "internet-image-top"
                  ? ["top-center", "bottom-center"]
                : ["top-left", "top-right", "bottom-left", "bottom-right"]
            }
            borderStroke="#72d6cb"
            anchorFill="#ffffff"
            anchorStroke="#2d6f69"
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
